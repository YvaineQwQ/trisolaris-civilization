/**
 * Game screen: owns the renderer bridge, the animation loop and every in-game
 * widget. All simulation access goes through GameApi; failures are surfaced in
 * the global error strip instead of blanking the page.
 */
import { createRenderer } from "../render/index";
import type { GameApi, RenderScene, RendererOptions, SceneRenderer, SceneRenderer3D, ViewModel } from "../game/viewTypes";

/** Picked id type without requiring viewTypes to re-export StarId. */
type ScenePickId = Parameters<NonNullable<RendererOptions["onPick"]>>[0];
import type { GameShell, ModalInstance, ScreenHandle, Tone, UiContext, ViewMode } from "./types";
import { createHud } from "./hud";
import { createLeftPanel } from "./panels-left";
import { createRightPanel } from "./panels-right";
import { createCenterOverlay } from "./center-overlay";
import { createDock } from "./dock";
import { createModals } from "./modals";
import type { ModalsHandle } from "./modals";
import { createMobileNav } from "./mobile-nav";
import type { MobileNavHandle } from "./mobile-nav";
import { append, clear, disposeAll, el, on, rafLoop, setClass, setText } from "./dom";
import { icon } from "./icons";
import { ART, setArtBackground } from "./art";
import { num, yearText } from "./format";

const VIEW_REFRESH_MS = 100;
const ERROR_THROTTLE_MS = 2200;

export function createGameScreen(ctx: UiContext): ScreenHandle {
  const root = el("div", { cls: "tri-screen tri-game" });
  const scene3dHost = el("div", { cls: "tri-scene3d-host tri-hidden", attrs: { "aria-hidden": "true" } });
  /* 白纸基底 + 印刷装饰层（点阵 / 注册色条 / 裁切线） */
  const decorPaper = el("div", { cls: "tri-game-paper", attrs: { "aria-hidden": "true" } });
  const decorRegister = el("div", { cls: "tri-game-register", attrs: { "aria-hidden": "true" } });
  for (const key of ["c", "m", "y", "k"]) {
    decorRegister.appendChild(el("span", { cls: "tri-reg-cell is-" + key }));
  }
  append(decorRegister, el("span", { cls: "tri-reg-label", text: "REG // TRISOLARIS PRINT" }));
  root.append(decorPaper, decorRegister);
  const eraFlash = el("div", { cls: "tri-era-flash tri-hidden", attrs: { "aria-hidden": "true" } });
  const eraFlashKicker = el("span", { cls: "tri-era-flash-kicker", text: "ERA ADVANCE" });
  const eraFlashTitle = el("strong", { cls: "tri-era-flash-title", text: "E—" });
  const eraFlashSub = el("span", { cls: "tri-era-flash-sub", text: "" });
  append(eraFlash, eraFlashKicker, eraFlashTitle, eraFlashSub);
  root.appendChild(eraFlash);

  let currentView: ViewModel | null = null;
  let currentScene: RenderScene | null = null;
  let renderer: SceneRenderer | null = null;
  let rendererSeed = "";
  let renderer3d: SceneRenderer3D | null = null;
  let attaching3d = false;
  let viewModeBusyState = false;
  let viewMode: ViewMode = ctx.state.viewMode;
  let endingBuilt = false;
  let endingVisible = false;
  let lastFlashEra = 0;
  let eraFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let errorVisible = false;
  let lastErrorAt = 0;
  let lastNoGameNotice = 0;
  let modals: ModalsHandle | null = null;
  let destroyed = false;
  /* v1.3：随机事件触发时自动弹出档案并冻结时间。 */
  let eventPromptDefId: string | null = null;
  let dismissedEventDefId: string | null = null;
  let autoPausedForEvent = false;
  const subscriptions: (() => void)[] = [];

  /* ----------------------------- shell -------------------------------- */
  const shell: GameShell = {
    host: ctx.host,
    state: ctx.state,
    api: () => safeApi(),
    view: () => currentView,
    openModal: (kind) => {
      if (!safeApi()) {
        ctx.notify("尚未进入游戏，无法打开该面板", "warn");
        return;
      }
      modals?.open(kind);
    },
    closeModal: () => modals?.close(),
    activeModal: () => modals?.active() ?? null,
    renderer: () => renderer,
    renderer3d: () => renderer3d,
    setLeftTab: (tab) => {
      left.setTab(tab);
      left.openDrawer();
    },
    setRightTab: (tab) => {
      if (ctx.state.rightCollapsed) right.toggleCollapsed();
      right.setTab(tab);
    },
    viewMode: () => viewMode,
    setViewMode,
    viewModeBusy: () => viewModeBusyState,
    notify: (text, tone) => ctx.notify(text, tone),
    setError: (text) => {
      ctx.showError(text);
      errorVisible = text != null;
    },
    backToMenu,
    requestRefresh: () => {
      nextViewAt = 0;
    },
  };

  /* --------------------------- widgets -------------------------------- */
  const hud = createHud(shell);
  const left = createLeftPanel(shell);
  const right = createRightPanel(shell);
  const center = createCenterOverlay(shell);
  const dock = createDock(shell);
  modals = createModals(shell);

  /* v1.4 移动端：底部导航 + 抽屉遮罩。桌面端两者都由 CSS 隐藏。 */
  const scrim = el("div", { cls: "tri-mobile-scrim tri-hidden", attrs: { "aria-hidden": "true" } });
  const closeMobileSheets = (): void => {
    left.closeDrawer();
    right.closeDrawer();
    dock.closeMobile();
  };
  const mobileNav: MobileNavHandle = createMobileNav(shell, {
    openDossier: () => {
      closeMobileSheets();
      left.openDrawer();
    },
    closeAll: closeMobileSheets,
    openDecision: () => {
      closeMobileSheets();
      right.openDrawer();
    },
    toggleTerminal: () => {
      if (dock.mobileOpen()) {
        dock.closeMobile();
      } else {
        closeMobileSheets();
        dock.openMobile();
      }
    },
    dossierOpen: () => left.drawerOpen(),
    decisionOpen: () => right.drawerOpen(),
    terminalOpen: () => dock.mobileOpen(),
  });
  const syncMobileSheets = (): void => {
    const anyOpen = left.drawerOpen() || right.drawerOpen() || dock.mobileOpen();
    scrim.classList.toggle("tri-hidden", !anyOpen);
    root.classList.toggle("has-mobile-sheet", anyOpen);
    mobileNav.sync();
  };
  subscriptions.push(on(scrim, "click", () => {
    closeMobileSheets();
    syncMobileSheets();
  }));

  /* 3D 辅助视图挂载在中央观测视口内，避免全屏画布与纸面版块错位。 */
  center.el.appendChild(scene3dHost);

  const main = el("div", { cls: "tri-game-main" });
  append(main, center.el, right.el);
  const stage = el("div", { cls: "tri-game-stage" });
  append(stage, hud.el, main, dock.el);

  /* --------------------------- overlays ------------------------------- */
  const pauseOverlay = el("div", { cls: "tri-pause-overlay tri-hidden" });
  const pauseCard = el("div", { cls: "tri-pause-card" });
  const pauseIcon = el("div", { cls: "tri-pause-icon" });
  pauseIcon.appendChild(icon("pause", 30));
  const pauseTitle = el("h2", { text: "模拟已暂停" });
  const pauseHint = el("p", { cls: "tri-pause-hint", text: "时间推进已停止。观测数据与建造指令仍然有效。" });
  const pauseStats = el("div", { cls: "tri-pause-stats", text: "—" });
  const pauseActions = el("div", { cls: "tri-pause-actions" });
  const resumeBtn = el("button", { cls: "tri-btn tri-btn-primary", attrs: { type: "button" } });
  resumeBtn.appendChild(icon("play", 16));
  resumeBtn.appendChild(el("span", { cls: "tri-btn-label", text: "继续游戏" }));
  const pauseSaveBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button" } });
  pauseSaveBtn.appendChild(icon("save", 15));
  pauseSaveBtn.appendChild(el("span", { cls: "tri-btn-label", text: "保存进度" }));
  const pauseSettingsBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button" } });
  pauseSettingsBtn.appendChild(icon("settings", 15));
  pauseSettingsBtn.appendChild(el("span", { cls: "tri-btn-label", text: "设置" }));
  const pauseMenuBtn = el("button", { cls: "tri-btn tri-btn-danger", attrs: { type: "button" } });
  pauseMenuBtn.appendChild(icon("chevronLeft", 15));
  pauseMenuBtn.appendChild(el("span", { cls: "tri-btn-label", text: "返回主菜单" }));
  append(pauseActions, resumeBtn, pauseSaveBtn, pauseSettingsBtn, pauseMenuBtn);
  const pauseKeys = el("div", { cls: "tri-pause-keys", text: "空格 继续 · Esc 关闭暂停 · 5/6 折叠面板 · F 聚焦选中 · T/P 切换轨迹" });
  append(pauseCard, pauseIcon, pauseTitle, pauseHint, pauseStats, pauseActions, pauseKeys);
  pauseOverlay.appendChild(pauseCard);

  const endingOverlay = el("div", { cls: "tri-ending-layer tri-hidden" });

  /* 导航轨通高：独立于舞台，抽屉从轨右缘浮出，不推挤观测大图。 */
  append(root, left.el, stage, scrim, mobileNav.el, modals.el, pauseOverlay, endingOverlay);

  subscriptions.push(on(resumeBtn, "click", () => safeApi()?.actions.togglePause()));
  subscriptions.push(on(pauseSaveBtn, "click", () => modals?.open("saves")));
  subscriptions.push(on(pauseSettingsBtn, "click", () => modals?.open("settings")));
  armConfirm(pauseMenuBtn, "确认返回主菜单（未保存进度将丢失）", backToMenu);

  const onResize = (): void => {
    try {
      renderer?.resize();
      renderer3d?.resize();
    } catch (error) {
      reportError(error, "渲染器尺寸更新失败");
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("resize", onResize);
    subscriptions.push(() => window.removeEventListener("resize", onResize));
  }
  /* v1.4：移动端旋转 / 抽屉开合会改变中央视口尺寸，用 ResizeObserver 保证画布按容器 resize。 */
  let centerResizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    centerResizeObserver = new ResizeObserver(() => onResize());
    centerResizeObserver.observe(center.el);
    subscriptions.push(() => centerResizeObserver?.disconnect());
  }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => onResize());

  /* --------------------------- lifecycle ------------------------------ */
  try {
    currentView = safeApi()?.view() ?? null;
  } catch (error) {
    reportError(error, "读取游戏视图失败");
  }

  let lastTick = 0;
  let lastViewAt = 0;
  let nextViewAt = 0;
  const stopLoop = rafLoop(tick);

  // Warm the WebGL/Three.js chunk during idle time (first 3D switch should not
  // stall the simulation loop). Failures are harmless: 2D keeps working.
  const prefetchTimer = setTimeout(() => {
    if (destroyed) return;
    void import("../render3d/index").catch((error) => {
      console.warn("[trisolaris] 3D module prefetch failed", error);
    });
  }, 2000);
  subscriptions.push(() => clearTimeout(prefetchTimer));

  function tick(now: number): void {
    if (destroyed) return;
    const dt = lastTick === 0 ? 1 / 60 : Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;
    const api = safeApi();
    if (!api) {
      if (now - lastNoGameNotice > 5000) {
        lastNoGameNotice = now;
        ctx.showError("当前没有进行中的游戏。返回主菜单后可以开始新纪元或读取存档。");
        errorVisible = true;
      }
      return;
    }
    try {
      // Re-attach the 3D backend if the UI state was persisted across screens.
      if (viewMode === "3d" && !renderer3d && !attaching3d) {
        void attach3D().then((ready) => {
          if (destroyed) return;
          if (!ready && viewMode === "3d") {
            viewMode = "2d";
            ctx.state.viewMode = "2d";
          }
          updateViewModeUi();
        });
      }
      let sceneForCenter: RenderScene | null = null;
      if (viewMode === "3d" && renderer3d) {
        renderer3d.frame(api.scene3d(), dt);
      } else {
        const scene = api.scene();
        currentScene = scene;
        sceneForCenter = scene;
        ensureRenderer(scene.seed);
        renderer?.frame(scene, dt);
      }
      if (now >= nextViewAt) {
        lastViewAt = now;
        nextViewAt = now + VIEW_REFRESH_MS;
        const view = api.view();
        currentView = view;
        updateAll(view, sceneForCenter);
      }
      if (errorVisible && now - lastErrorAt > 4000) {
        errorVisible = false;
        ctx.showError(null);
      }
    } catch (error) {
      reportError(error, "模拟数据读取失败");
    }
  }

  function ensureRenderer(seed: string): void {
    if (renderer && rendererSeed === seed) return;
    if (renderer) {
      try {
        renderer.destroy();
      } catch (error) {
        console.warn("[trisolaris] renderer destroy failed", error);
      }
      renderer = null;
    }
    rendererSeed = seed;
    const canvas = typeof document !== "undefined" ? (document.getElementById("scene-canvas") as HTMLCanvasElement | null) : null;
    if (!canvas) {
      if (!errorVisible) reportError(new Error("未找到 #scene-canvas 画布"), "渲染器初始化失败");
      return;
    }
    try {
      renderer = createRenderer({
        canvas,
        seed,
        onPick: (id) => {
          const api = safeApi();
          if (api) api.actions.select(id);
        },
      });
      renderer.resize();
    } catch (error) {
      renderer = null;
      reportError(error, "渲染器初始化失败");
    }
  }

  function updateAll(view: ViewModel, scene: RenderScene | null): void {
    updateEraFlash(view);
    syncPendingEvent(view);
    root.classList.toggle("is-drawer-open", left.drawerOpen());
    hud.update(view);
    left.update(view);
    right.update(view);
    dock.update(view);
    center.update(view, scene);
    modals?.update(view);
    updateEnding(view);
    updatePause(view);
    mobileNav.update(view);
    syncMobileSheets();
  }

  /**
   * v1.3：事件触发 → 自动弹出事件档案并暂停模拟；玩家关闭档案而未抉择时
   * 记录为「稍后处理」，避免每帧重新弹窗，并在关闭后恢复时间。
   */
  function syncPendingEvent(view: ViewModel): void {
    const active = view.events?.active ?? null;
    const modalActive = modals?.active() ?? null;
    if (!active) {
      eventPromptDefId = null;
      dismissedEventDefId = null;
      if (autoPausedForEvent) {
        autoPausedForEvent = false;
        if (view.meta.paused) {
          try {
            safeApi()?.actions.togglePause();
          } catch (error) {
            console.warn("[trisolaris] resume after event failed", error);
          }
        }
      }
      return;
    }
    if (eventPromptDefId === active.defId) {
      if (modalActive !== "event") {
        dismissedEventDefId = active.defId;
        eventPromptDefId = null;
        if (autoPausedForEvent) {
          autoPausedForEvent = false;
          if (view.meta.paused) {
            try {
              safeApi()?.actions.togglePause();
            } catch (error) {
              console.warn("[trisolaris] resume after event failed", error);
            }
          }
        }
      }
      return;
    }
    if (dismissedEventDefId === active.defId) return;
    if (modalActive != null) return;
    eventPromptDefId = active.defId;
    if (!view.meta.paused) {
      try {
        safeApi()?.actions.togglePause();
        autoPausedForEvent = true;
      } catch (error) {
        console.warn("[trisolaris] pause for event failed", error);
      }
    }
    modals?.open("event");
  }

  /** One-shot era transition banner (pure decoration, no simulation effect). */
  function updateEraFlash(view: ViewModel): void {
    const era = view.civ.era.value;
    if (lastFlashEra === 0) {
      lastFlashEra = era;
      return;
    }
    if (era <= lastFlashEra) {
      lastFlashEra = era;
      return;
    }
    lastFlashEra = era;
    eraFlashTitle.textContent = "E" + era + " · " + (view.civ.era.name || "");
    eraFlashSub.textContent = (view.civ.era.subtitle || "") + (view.civ.era.unlockSummary ? " · " + view.civ.era.unlockSummary : "");
    eraFlash.classList.remove("tri-hidden");
    if (eraFlashTimer) clearTimeout(eraFlashTimer);
    eraFlashTimer = setTimeout(() => {
      eraFlash.classList.add("tri-hidden");
      eraFlashTimer = null;
    }, 4200);
  }

  function updatePause(view: ViewModel): void {
    const finished = isFinished(view);
    const shouldShow = view.meta.paused && !finished && (modals?.active() ?? null) == null;
    pauseOverlay.classList.toggle("tri-hidden", !shouldShow);
    if (shouldShow) {
      setText(
        pauseStats,
        yearText(view.meta.calendarYear) +
          " · 回合 " +
          view.meta.turn +
          " · 人口 " +
          num(view.civ.population.total) +
          " · 时代 E" +
          view.meta.era +
          " " +
          view.meta.eraName,
      );
    }
  }

  function updateEnding(view: ViewModel): void {
    const finished = isFinished(view);
    if (!finished) {
      if (endingVisible) {
        endingOverlay.classList.add("tri-hidden");
        endingVisible = false;
        endingBuilt = false;
        clear(endingOverlay);
      }
      return;
    }
    if (!endingBuilt) {
      endingBuilt = true;
      renderEnding(view);
    }
    if (!endingVisible) {
      endingVisible = true;
      endingOverlay.classList.remove("tri-hidden");
      pauseOverlay.classList.add("tri-hidden");
    }
  }

  function renderEnding(view: ViewModel): void {
    clear(endingOverlay);
    const ending = view.ending;
    const victory = ending?.victory ?? view.meta.victory;
    endingOverlay.dataset.outcome = victory ? "victory" : "defeat";
    const card = el("div", { cls: "tri-ending-card" });
    const endingArtLayer = el("div", { cls: "tri-ending-art", attrs: { "aria-hidden": "true" } });
    setArtBackground(endingArtLayer, ART.ending(victory));
    card.appendChild(endingArtLayer);
    card.appendChild(el("div", { cls: "tri-ending-shade", attrs: { "aria-hidden": "true" } }));
    const kicker = el("div", { cls: "tri-kicker", text: victory ? "CIVILIZATION ENDURES" : "CIVILIZATION COLLAPSED" });
    const title = el("h2", { cls: "tri-ending-title", text: ending?.title ?? view.meta.endingTitle ?? (victory ? "文明延续" : "文明终结") });
    const text = el("p", { cls: "tri-ending-text", text: ending?.text ?? (victory ? "文明在三个太阳的混沌中找到了自己的道路。" : view.meta.defeatReason ?? "文明未能等到下一个恒纪元。") });
    card.append(kicker, title, text);

    const stats = el("div", { cls: "tri-ending-stats" });
    const rows: { label: string; value: string }[] =
      ending?.stats && ending.stats.length > 0
        ? ending.stats
        : [
            { label: "生存模拟年", value: num(view.meta.year, 1) + " 年" },
            { label: "回合", value: String(view.meta.turn) },
            { label: "最终人口", value: num(view.civ.population.total) },
            { label: "时代", value: "E" + view.meta.era + " " + view.meta.eraName },
            { label: "星系分类", value: view.meta.galaxyClassName },
            { label: "星系种子", value: view.meta.seed },
          ];
    for (const row of rows) {
      const item = el("div", { cls: "tri-ending-stat" });
      item.appendChild(el("span", { cls: "tri-ending-stat-label", text: row.label }));
      item.appendChild(el("span", { cls: "tri-ending-stat-value", text: row.value }));
      stats.appendChild(item);
    }
    card.appendChild(stats);

    const actions = el("div", { cls: "tri-ending-actions" });
    const menuBtn = el("button", { cls: "tri-btn tri-btn-primary tri-btn-lg", attrs: { type: "button" } });
    menuBtn.appendChild(icon("chevronLeft", 16));
    menuBtn.appendChild(el("span", { cls: "tri-btn-label", text: "返回主菜单" }));
    menuBtn.addEventListener("click", backToMenu);
    const logBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-lg", attrs: { type: "button" } });
    logBtn.appendChild(icon("log", 16));
    logBtn.appendChild(el("span", { cls: "tri-btn-label", text: "查看最终日志" }));
    logBtn.addEventListener("click", () => modals?.open("log"));
    append(actions, menuBtn, logBtn);
    card.appendChild(actions);
    card.appendChild(el("div", { cls: "tri-ending-hint", text: "这一局的观测记录与决策已成为文明史的一部分。" }));
    endingOverlay.appendChild(card);
  }

  function updateViewModeUi(): void {
    const is3d = viewMode === "3d" && renderer3d != null;
    scene3dHost.classList.toggle("tri-hidden", !is3d);
    scene3dHost.classList.toggle("is-3d-active", is3d);
    const canvas = document.getElementById("scene-canvas");
    if (canvas) canvas.style.visibility = is3d ? "hidden" : "";
    center.el.classList.toggle("is-3d", is3d);
    if (is3d) {
      try {
        renderer3d?.resize();
      } catch (error) {
        console.warn("[trisolaris] 3D resize failed", error);
      }
    }
    if (currentView) center.update(currentView, is3d ? null : currentScene);
  }

  function setViewMode(next: ViewMode): void {
    if (next === viewMode) return;
    if (next === "3d") {
      void enter3D();
    } else {
      leave3D();
    }
  }

  /** Switch to the 3D auxiliary view. Never touches game time or selection. */
  async function enter3D(): Promise<void> {
    if (destroyed || viewMode === "3d") return;
    if (!renderer3d) {
      viewModeBusyState = true;
      if (currentView) center.update(currentView, currentScene);
      ctx.notify("正在加载 3D 空间渲染器…首次加载可能需要数秒", "info");
      const ready = await attach3D();
      viewModeBusyState = false;
      if (destroyed) return;
      if (!ready) {
        // Keep the fully functional 2D view instead of showing a blank scene.
        if (currentView) center.update(currentView, currentScene);
        return;
      }
    }
    viewMode = "3d";
    ctx.state.viewMode = "3d";
    try {
      const api = safeApi();
      if (api && renderer3d) renderer3d.frame(api.scene3d(), 1 / 60);
    } catch (error) {
      reportError(error, "3D 场景读取失败");
    }
    updateViewModeUi();
    if (currentView) center.update(currentView, null);
    ctx.notify("已切换到 3D 空间视图 · 同一物理状态与观测数据", "info");
  }

  /** Tear the WebGL context down; the simulation keeps running untouched. */
  function leave3D(): void {
    if (viewMode !== "3d") return;
    viewMode = "2d";
    ctx.state.viewMode = "2d";
    if (renderer3d) {
      try {
        renderer3d.destroy();
      } catch (error) {
        console.warn("[trisolaris] 3D renderer destroy failed", error);
      }
      renderer3d = null;
    }
    updateViewModeUi();
    ctx.notify("已切换到 2D 星系视图", "info");
  }

  /**
   * Lazily load the Three.js auxiliary renderer. It consumes GameApi.scene3d()
   * (the same CelestialSystem / observation data as the 2D view), so switching
   * never resets simulation state, selection or game time.
   */
  async function attach3D(): Promise<boolean> {
    if (renderer3d) return true;
    if (attaching3d) return false;
    attaching3d = true;
    scene3dHost.classList.remove("tri-hidden");
    try {
      const module = await import("../render3d/index");
      const createRenderer3D = module.createRenderer3D;
      if (typeof createRenderer3D !== "function") {
        throw new Error("render3d 模块未导出 createRenderer3D");
      }
      const seed = currentView?.meta.seed ?? rendererSeed;
      const instance = createRenderer3D({
        container: scene3dHost,
        seed,
        onPick: (id: ScenePickId) => {
          const api = safeApi();
          if (api) api.actions.select(id);
        },
      });
      if (destroyed) {
        instance.destroy();
        return false;
      }
      instance.resize();
      renderer3d = instance;
      return true;
    } catch (error) {
      scene3dHost.classList.add("tri-hidden");
      console.warn("[trisolaris] 3D renderer unavailable", error);
      ctx.notify("3D 渲染器加载失败：" + (error instanceof Error ? error.message : String(error)), "warn");
      return false;
    } finally {
      attaching3d = false;
    }
  }

  function backToMenu(): void {
    const api = safeApi();
    try {
      api?.actions.returnToMenu();
    } catch (error) {
      console.warn("[trisolaris] actions.returnToMenu failed", error);
    }
    try {
      ctx.host.returnToMenu();
    } catch (error) {
      console.warn("[trisolaris] host.returnToMenu failed", error);
    }
    ctx.setScreen("menu");
  }

  function focusSelection(): void {
    const view = currentView;
    if (!view || view.selection == null) {
      ctx.notify("尚未选中天体：点击星系中的天体后再按 F 聚焦", "info");
      return;
    }
    if (!renderer) {
      ctx.notify("渲染器尚未就绪", "warn");
      return;
    }
    renderer.resetView();
    renderer.zoomBy(1.5);
    const label = view.selection === "planet" ? "母星" : "恒星 " + view.selection;
    ctx.notify("已聚焦 " + label, "info");
  }

  function safeApi(): GameApi | null {
    try {
      return ctx.host.activeGame();
    } catch (error) {
      reportError(error, "游戏实例读取失败");
      return null;
    }
  }

  function reportError(error: unknown, prefix: string): void {
    const now = Date.now();
    if (now - lastErrorAt < ERROR_THROTTLE_MS) return;
    lastErrorAt = now;
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[trisolaris] " + prefix, error);
    ctx.showError(prefix + "：" + message);
    errorVisible = true;
  }

  function onKey(ev: KeyboardEvent): boolean {
    if (modals?.active()) {
      if (ev.key === "Escape") {
        modals.close();
        return true;
      }
      return false;
    }
    if (endingVisible) return false;
    if (ev.key === "Escape" && (left.drawerOpen() || right.drawerOpen() || dock.mobileOpen())) {
      closeMobileSheets();
      syncMobileSheets();
      return true;
    }
    const api = safeApi();
    switch (ev.key) {
      case " ":
        api?.actions.togglePause();
        return true;
      case "Escape":
        api?.actions.togglePause();
        return true;
      case "1":
        shell.setLeftTab("overview");
        return true;
      case "2":
        shell.setLeftTab("population");
        return true;
      case "3":
        shell.setLeftTab("buildings");
        return true;
      case "4":
        shell.setLeftTab("society");
        return true;
      case "5":
        left.toggleCollapsed();
        return true;
      case "6":
        dock.toggleCollapsed();
        return true;
      case "f":
      case "F":
        focusSelection();
        return true;
      case "t":
      case "T":
        api?.actions.toggleSetting("showTrails");
        nextViewAt = 0;
        return true;
      case "p":
      case "P":
        api?.actions.toggleSetting("showPrediction");
        nextViewAt = 0;
        return true;
      default:
        return false;
    }
  }

  return {
    el: root,
    onKey,
    destroy() {
      destroyed = true;
      stopLoop();
      if (eraFlashTimer) clearTimeout(eraFlashTimer);
      disposeAll(subscriptions);
      try {
        renderer?.destroy();
      } catch (error) {
        console.warn("[trisolaris] renderer destroy failed", error);
      }
      renderer = null;
      try {
        renderer3d?.destroy();
      } catch (error) {
        console.warn("[trisolaris] 3D renderer destroy failed", error);
      }
      renderer3d = null;
      scene3dHost.classList.add("tri-hidden");
      const canvas = document.getElementById("scene-canvas");
      if (canvas) canvas.style.visibility = "";
      hud.destroy();
      left.destroy();
      right.destroy();
      center.destroy();
      dock.destroy();
      mobileNav.destroy();
      modals?.destroy();
      modals = null;
      root.remove();
    },
  };

  function armConfirm(button: HTMLButtonElement, confirmLabel: string, action: () => void): void {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const labelNode = button.querySelector(".tri-btn-label");
    const original = labelNode?.textContent ?? "确认";
    button.addEventListener("click", () => {
      if (armed) {
        if (timer) clearTimeout(timer);
        armed = false;
        button.classList.remove("is-armed");
        if (labelNode) labelNode.textContent = original;
        action();
        return;
      }
      armed = true;
      button.classList.add("is-armed");
      if (labelNode) labelNode.textContent = confirmLabel;
      timer = setTimeout(() => {
        armed = false;
        button.classList.remove("is-armed");
        if (labelNode) labelNode.textContent = original;
        timer = null;
      }, 3600);
    });
  }
}

function isFinished(view: ViewModel): boolean {
  return view.ending != null || view.meta.gameOver || view.meta.victory;
}
