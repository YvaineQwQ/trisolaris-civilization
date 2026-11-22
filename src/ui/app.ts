/**
 * UI entry point: owns the root DOM node, screen routing, keyboard dispatch,
 * global error strip and transient toasts.
 *
 * main.ts only has to call mountApp(controller); every screen below is created
 * and destroyed here so no listener leaks between menu <-> game transitions.
 */
import "./styles.css";
// v1.3「终末地工业画册」主题层：白纸墨字、印刷装饰、单一信号黄。
import "./theme-print.css";
import type { AppController } from "../game/viewTypes";
import type { ScreenHandle, ScreenKind, Tone, UiContext, UiState } from "./types";
import { createMenuScreen } from "./screen-menu";
import { createNewGameScreen } from "./screen-newgame";
import { createGameScreen } from "./screen-game";
import { clear, disposeAll, el, setText } from "./dom";
import { icon } from "./icons";

interface MountedApp {
  host: AppController;
  root: HTMLElement;
  uiRoot: HTMLElement;
  createdUiRoot: boolean;
  screenHost: HTMLElement;
  errorStrip: HTMLElement;
  errorText: HTMLElement;
  toasts: HTMLElement;
  state: UiState;
  current: ScreenHandle | null;
  subscriptions: (() => void)[];
  toastTimers: ReturnType<typeof setTimeout>[];
  toastId: number;
  switching: boolean;
}

let mounted: MountedApp | null = null;

function createUiRoot(): { node: HTMLElement; created: boolean } {
  const existing = document.getElementById("ui-root");
  if (existing) return { node: existing, created: false };
  const node = el("div");
  node.id = "ui-root";
  document.body.appendChild(node);
  return { node, created: true };
}

function buildState(host: AppController): UiState {
  return {
    screen: "menu",
    leftTab: "overview",
    rightTab: "stars",
    // v1.3：主舞台优先，导航轨常驻；文明档案抽屉默认收起。
    leftCollapsed: true,
    rightCollapsed: false,
    dockCollapsed: false,
    viewMode: "2d",
    modal: null,
    logFilter: "all",
    newSeed: safeSeed(host),
    difficulty: "normal",
    mode: "normal",
  };
}

function safeSeed(host: AppController): string {
  try {
    return host.randomSeed();
  } catch {
    return "trisolaris-" + Date.now().toString(36);
  }
}

function pushToast(app: MountedApp, text: string, tone: Tone): void {
  const node = el("div", { cls: "tri-toast", attrs: { "data-tone": tone } });
  node.appendChild(icon(tone === "danger" || tone === "warn" ? "alert" : tone === "ok" ? "check" : "info", 16));
  node.appendChild(el("span", { cls: "tri-toast-text", text }));
  app.toasts.appendChild(node);
  while (app.toasts.children.length > 4) app.toasts.removeChild(app.toasts.firstElementChild as Element);
  const timer = setTimeout(() => {
    node.classList.add("is-leaving");
    const removeTimer = setTimeout(() => node.remove(), 260);
    app.toastTimers.push(removeTimer);
  }, 3600);
  app.toastTimers.push(timer);
}

function showError(app: MountedApp, text: string | null): void {
  if (!text) {
    app.errorStrip.classList.add("tri-hidden");
    setText(app.errorText, "");
    return;
  }
  setText(app.errorText, text);
  app.errorStrip.classList.remove("tri-hidden");
}

function switchScreen(kind: ScreenKind): void {
  const app = mounted;
  if (!app || app.switching) return;
  app.switching = true;
  try {
    if (app.current) {
      try {
        app.current.destroy();
      } catch (error) {
        console.warn("[trisolaris] screen destroy failed", error);
      }
      app.current.el.remove();
      app.current = null;
    }
    app.state.screen = kind;
    app.state.modal = null;
    showError(app, null);
    const ctx: UiContext = {
      root: app.screenHost,
      host: app.host,
      state: app.state,
      setScreen: (next) => switchScreen(next),
      notify: (text, tone) => pushToast(app, text, tone ?? "info"),
      showError: (text) => showError(app, text),
    };
    let screen: ScreenHandle;
    switch (kind) {
      case "newgame":
        screen = createNewGameScreen(ctx);
        break;
      case "game":
        screen = createGameScreen(ctx);
        break;
      default:
        screen = createMenuScreen(ctx);
        break;
    }
    app.current = screen;
    app.screenHost.appendChild(screen.el);
  } finally {
    app.switching = false;
  }
}

/* ------------------------------------------------------------------ *
 *  Boot / loading plate: near-black sheet, yellow progress running down
 *  the left edge, oversized percentage. Pointer-events: none so tests and
 *  players can already interact with the mounted menu underneath.
 * ------------------------------------------------------------------ */
interface BootPlate {
  el: HTMLElement;
  destroy(): void;
}

function createBootPlate(): BootPlate {
  const el = document.createElement("div");
  el.className = "tri-boot";
  el.setAttribute("aria-hidden", "true");

  const track = document.createElement("div");
  track.className = "tri-boot-track";
  const fill = document.createElement("span");
  fill.className = "tri-boot-fill";
  track.appendChild(fill);

  const readout = document.createElement("div");
  readout.className = "tri-boot-readout";
  const pctNode = document.createElement("span");
  pctNode.className = "tri-boot-pct";
  pctNode.textContent = "000";
  const pctSign = document.createElement("span");
  pctSign.className = "tri-boot-pct-sign";
  pctSign.textContent = "%";
  readout.append(pctNode, pctSign);

  const body = document.createElement("div");
  body.className = "tri-boot-body";
  const kicker = document.createElement("span");
  kicker.className = "tri-boot-kicker";
  kicker.textContent = "// TRISOLARIS :: COLD START";
  const title = document.createElement("h1");
  title.className = "tri-boot-title";
  title.textContent = "三体纪元";
  const sub = document.createElement("p");
  sub.className = "tri-boot-sub";
  sub.textContent = "装订星图 · 校准观测视口 · 载入文明档案";
  const steps = document.createElement("div");
  steps.className = "tri-boot-steps";
  body.append(kicker, title, sub, steps);

  const veil = document.createElement("div");
  veil.className = "tri-boot-veil";

  el.append(track, readout, body, veil);

  const reduceMotion = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;
  let destroyed = false;
  const STEP_LABELS = ["载入天体力学内核", "校验本地存档索引", "排版印刷装饰层", "校准观测视口刻度"];

  const setPct = (pct: number): void => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    pctNode.textContent = String(clamped).padStart(3, "0");
    fill.style.height = clamped + "%";
  };

  const finish = (): void => {
    if (destroyed) return;
    setPct(100);
    el.classList.add("is-done");
    timers.push(
      setTimeout(() => {
        if (destroyed) return;
        el.classList.add("is-gone");
        timers.push(
          setTimeout(() => {
            el.remove();
          }, 2600),
        );
      }, reduceMotion ? 30 : 260),
    );
  };

  if (reduceMotion) {
    setPct(100);
    timers.push(setTimeout(() => el.classList.add("is-gone"), 60));
    timers.push(setTimeout(() => el.remove(), 400));
    return { el, destroy: () => { destroyed = true; el.remove(); } };
  }

  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const DURATION = 1150;
  let stepIndex = -1;
  const tick = (): void => {
    if (destroyed) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - t, 2.1);
    setPct(eased * 100);
    const nextStep = Math.min(STEP_LABELS.length - 1, Math.floor(t * STEP_LABELS.length));
    if (nextStep !== stepIndex) {
      stepIndex = nextStep;
      const line = document.createElement("span");
      line.className = "tri-boot-step";
      line.textContent = (nextStep + 1).toString().padStart(2, "0") + " · " + STEP_LABELS[nextStep];
      steps.appendChild(line);
      while (steps.children.length > 2) steps.removeChild(steps.firstElementChild as Element);
    }
    if (t < 1) raf = requestAnimationFrame(tick);
    else finish();
  };
  raf = requestAnimationFrame(tick);

  return {
    el,
    destroy(): void {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      for (const timer of timers.splice(0)) clearTimeout(timer);
      el.remove();
    },
  };
}

/**
 * v1.4：移动端安全区 —— index.html 不在 UI 写入范围，因此在此补齐
 * viewport-fit=cover（否则 env(safe-area-inset-*) 恒为 0）。
 */
function ensureViewportFit(): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const content = meta.getAttribute("content") ?? "";
  if (content.includes("viewport-fit")) return;
  meta.setAttribute("content", content ? content + ", viewport-fit=cover" : "width=device-width, initial-scale=1, viewport-fit=cover");
}

/** Mount the full UI on top of the render canvas / #ui-root anchor. */
export function mountApp(host: AppController): void {
  if (mounted) unmountApp();
  ensureViewportFit();
  const rootInfo = createUiRoot();
  const root = el("div", { cls: "tri-root" });
  // index.html declares "#ui-root > * { pointer-events: auto }"; the play field
  // must stay click-through so the renderer canvas receives picks.
  root.style.pointerEvents = "none";
  const errorStrip = el("div", { cls: "tri-errorbar tri-hidden" });
  errorStrip.appendChild(icon("alert", 16));
  const errorText = el("span", { cls: "tri-errorbar-text" });
  errorStrip.appendChild(errorText);
  const screenHost = el("div", { cls: "tri-screen-host" });
  const toasts = el("div", { cls: "tri-toasts" });
  root.appendChild(errorStrip);
  root.appendChild(screenHost);
  root.appendChild(toasts);
  rootInfo.node.appendChild(root);

  const app: MountedApp = {
    host,
    root,
    uiRoot: rootInfo.node,
    createdUiRoot: rootInfo.created,
    screenHost,
    errorStrip,
    errorText,
    toasts,
    state: buildState(host),
    current: null,
    subscriptions: [],
    toastTimers: [],
    toastId: 0,
    switching: false,
  };
  mounted = app;

  /* 印刷装订加载页：挂在 ui-root 最上层，结束后自行销毁。 */
  const boot = createBootPlate();
  rootInfo.node.appendChild(boot.el);
  app.subscriptions.push(() => boot.destroy());

  const onKey = (ev: KeyboardEvent): void => {
    const current = mounted;
    if (!current) return;
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName?.toUpperCase() ?? "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true;
    if (typing) {
      if (ev.key === "Escape" && target) target.blur();
      return;
    }
    let handled = false;
    try {
      handled = current.current?.onKey?.(ev) ?? false;
    } catch (error) {
      console.warn("[trisolaris] key handler failed", error);
    }
    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKey);
    app.subscriptions.push(() => window.removeEventListener("keydown", onKey));
  }

  const startScreen: ScreenKind = host.autostart && safeHasGame(host) ? "game" : "menu";
  switchScreen(startScreen);
}

function safeHasGame(host: AppController): boolean {
  try {
    return host.hasActiveGame();
  } catch {
    return false;
  }
}

/** Tear down every screen, listener and DOM node created by mountApp. */
export function unmountApp(): void {
  const app = mounted;
  if (!app) return;
  mounted = null;
  try {
    app.current?.destroy();
  } catch (error) {
    console.warn("[trisolaris] screen destroy failed", error);
  }
  app.current = null;
  for (const timer of app.toastTimers) clearTimeout(timer);
  app.toastTimers.length = 0;
  disposeAll(app.subscriptions);
  clear(app.toasts);
  app.screenHost.remove();
  app.errorStrip.remove();
  app.root.remove();
  if (app.createdUiRoot && app.uiRoot.parentNode) app.uiRoot.remove();
}

/** True while the UI tree is attached (useful for smoke tests). */
export function isAppMounted(): boolean {
  return mounted !== null;
}
