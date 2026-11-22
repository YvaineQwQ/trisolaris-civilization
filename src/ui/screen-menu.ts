/** Main menu: title screen, save browser and credits overlays. */
import type { SaveSlotMeta } from "../game/viewTypes";
import type { ScreenHandle, UiContext } from "./types";
import { append, clear, delegate, el, on, q, qa, setText } from "./dom";
import { icon } from "./icons";
import { createStarfield } from "./starfield";
import { ART, artImage } from "./art";
import { dateTime, num } from "./format";

const GAME_TITLE = "三体纪元";
const GAME_SUBTITLE = "TRISOLARIS: CIVILIZATION";
const VERSION = "1.6.0";

export function createMenuScreen(ctx: UiContext): ScreenHandle {
  const root = el("div", { cls: "tri-screen tri-menu" });
  const fallback = el("div", { cls: "tri-menu-fallback" });
  const canvas = el("canvas", { cls: "tri-menu-stars", attrs: { "aria-hidden": "true" } });
  const bg = artImage(ART.menuBackground, "tri-menu-bg", "");
  root.appendChild(fallback);
  root.appendChild(canvas);
  // v1.3：世界观大图以「印刷图版」形式占据右侧版块，其余为白纸。
  const plate = el("div", { cls: "tri-menu-plate", attrs: { "aria-hidden": "true" } });
  const plateFrame = el("div", { cls: "tri-menu-plate-frame" });
  const plateCaption = el("div", { cls: "tri-menu-plate-caption" });
  plateCaption.appendChild(el("span", { cls: "tri-menu-plate-index", text: "PLATE 01" }));
  plateCaption.appendChild(el("span", { cls: "tri-menu-plate-title", text: "三体系统 / TRISOLARIS" }));
  plateCaption.appendChild(el("span", { cls: "tri-menu-plate-meta", text: "混沌三体轨道 · 观测者视角" }));
  const plateReg = el("span", { cls: "tri-menu-plate-reg" });
  for (const key of ["c", "m", "y", "k"]) plateReg.appendChild(el("span", { cls: "tri-reg-cell is-" + key }));
  const plateShade = el("div", { cls: "tri-menu-shade" });
  append(plate, bg, plateShade, plateFrame, plateCaption, plateReg);
  root.appendChild(plate);
  root.appendChild(el("div", { cls: "tri-vignette" }));
  root.appendChild(el("div", { cls: "tri-scanlines", attrs: { "aria-hidden": "true" } }));

  // Geometric terminal frame: corner brackets, concentric arcs and ruler ticks.
  const frame = el("div", { cls: "tri-menu-frame", attrs: { "aria-hidden": "true" } });
  const arcA = el("span", { cls: "tri-menu-arc is-a" });
  const arcB = el("span", { cls: "tri-menu-arc is-b" });
  const arcC = el("span", { cls: "tri-menu-arc is-c" });
  const ruler = el("span", { cls: "tri-menu-ruler is-top" });
  const rulerBottom = el("span", { cls: "tri-menu-ruler is-bottom" });
  append(
    frame,
    el("span", { cls: "tri-frame-corner is-tl" }),
    el("span", { cls: "tri-frame-corner is-tr" }),
    el("span", { cls: "tri-frame-corner is-bl" }),
    el("span", { cls: "tri-frame-corner is-br" }),
    arcA,
    arcB,
    arcC,
    ruler,
    rulerBottom,
  );
  root.appendChild(frame);

  const content = el("div", { cls: "tri-menu-content" });
  root.appendChild(content);

  const head = el("header", { cls: "tri-menu-head" });
  const masthead = el("div", { cls: "tri-menu-masthead" });
  masthead.appendChild(el("span", { cls: "tri-menu-masthead-mark", text: "■" }));
  masthead.appendChild(el("span", { text: "TRISOLARIS CIVILIZATION SIMULATION" }));
  masthead.appendChild(el("span", { cls: "tri-menu-masthead-rule" }));
  masthead.appendChild(el("span", { text: "EDITION 01 · 单机离线" }));
  const eyebrow = el("div", { cls: "tri-menu-eyebrow" });
  eyebrow.append(
    el("span", { cls: "tri-menu-eyebrow-tick" }),
    el("span", { text: "TRISOLARIS // CIVILIZATION SIMULATION" }),
    el("span", { cls: "tri-menu-eyebrow-tick" }),
  );
  const title = el("h1", { cls: "tri-menu-title", text: GAME_TITLE });
  const titleEn = el("div", { cls: "tri-menu-title-en", text: "T R I S O L A R I S" });
  const subtitle = el("div", { cls: "tri-menu-subtitle", text: GAME_SUBTITLE });
  const tagline = el("p", {
    cls: "tri-menu-tagline",
    text: "三个太阳在混沌轨道上永恒追逐。观测它，预测它，然后让文明活过下一次乱纪元。",
  });
  const chips = el("div", { cls: "tri-menu-chips" });
  append(
    chips,
    chip("硬科幻 · 天体力学"),
    chip("单机 · 本地存档"),
    chip("观测即真相"),
  );
  append(head, masthead, eyebrow, title, titleEn, subtitle, tagline, chips);

  const nav = el("nav", { cls: "tri-menu-nav" });
  const continueBtn = menuButton("继续游戏", "forward", "primary");
  const newBtn = menuButton("开始新纪元", "play", "primary");
  const loadBtn = menuButton("读取存档", "folder", "ghost");
  const helpBtn = menuButton("游戏说明", "book", "ghost");
  const creditsBtn = menuButton("制作说明", "info", "ghost");
  append(nav, newBtn, continueBtn, loadBtn, helpBtn, creditsBtn);

  const status = el("div", { cls: "tri-menu-status", text: "正在扫描本地存档…" });
  const foot = el("footer", { cls: "tri-menu-foot" });
  append(
    foot,
    el("span", { cls: "tri-menu-version", text: "v" + VERSION + " · 单机离线" }),
    el("span", { cls: "tri-menu-divider" }),
    el("span", { text: "科学模型：牛顿 N 体引力 · 软化势 · 混沌敏感性" }),
    el("span", { cls: "tri-menu-divider" }),
    el("span", { text: "本作设定纯属虚构" }),
  );
  append(content, head, nav, status, foot);

  const screen: ScreenHandle = {
    el: root,
    destroy,
    onKey,
  };

  const starfield = createStarfield(canvas, { density: 260, seed: 987654321, constellationLines: true });

  let saves: SaveSlotMeta[] = [];
  let savesLoaded = false;
  let overlay: HTMLElement | null = null;
  const subscriptions: (() => void)[] = [];
  const loadTimers: ReturnType<typeof setTimeout>[] = [];

  const offNew = on(newBtn, "click", () => ctx.setScreen("newgame"));
  subscriptions.push(offNew);
  const offContinue = on(continueBtn, "click", () => void continueGame());
  subscriptions.push(offContinue);
  const offLoad = on(loadBtn, "click", () => void openSaveBrowser());
  subscriptions.push(offLoad);
  const offHelp = on(helpBtn, "click", () => openManual());
  subscriptions.push(offHelp);
  const offCredits = on(creditsBtn, "click", () => openCredits());
  subscriptions.push(offCredits);

  void refreshSaves();

  function destroy(): void {
    starfield.destroy();
    for (const off of subscriptions.splice(0)) off();
    for (const timer of loadTimers) clearTimeout(timer);
    closeOverlay();
  }

  function onKey(ev: KeyboardEvent): boolean {
    if (ev.key === "Escape" && overlay) {
      closeOverlay();
      return true;
    }
    if (ev.key === "Enter" && !overlay) {
      ctx.setScreen("newgame");
      return true;
    }
    return false;
  }

  function setStatus(text: string, tone?: "warn" | "danger" | "ok"): void {
    setText(status, text);
    status.dataset.tone = tone ?? "";
  }

  async function refreshSaves(): Promise<void> {
    try {
      saves = await ctx.host.listSaves();
      savesLoaded = true;
      saves.sort((a, b) => b.savedAt - a.savedAt);
      updateContinueState();
      setStatus(saves.length > 0 ? "检测到 " + saves.length + " 个本地存档槽位" : "暂无本地存档 · 开始新纪元以创建第一个存档");
    } catch (error) {
      savesLoaded = true;
      updateContinueState();
      setStatus("存档索引读取失败：" + messageOf(error), "warn");
    }
  }

  function updateContinueState(): void {
    const game = activeGameSafe();
    if (game) {
      continueBtn.disabled = false;
      continueBtn.title = "返回当前进行中的纪元";
      return;
    }
    if (!savesLoaded) {
      continueBtn.disabled = true;
      continueBtn.title = "正在扫描存档…";
      return;
    }
    if (saves.length === 0) {
      continueBtn.disabled = true;
      continueBtn.title = "没有可继续的游戏或存档";
      return;
    }
    const latest = saves[0];
    continueBtn.disabled = false;
    continueBtn.title = "读取最近存档：星历 " + Math.round(latest.year) + " 年 · " + latest.name;
  }

  function activeGameSafe(): boolean {
    try {
      return ctx.host.hasActiveGame();
    } catch {
      return false;
    }
  }

  async function continueGame(): Promise<void> {
    if (activeGameSafe()) {
      ctx.setScreen("game");
      return;
    }
    if (!savesLoaded) {
      setStatus("正在扫描存档，请稍候…");
      return;
    }
    if (saves.length === 0) return;
    const latest = saves[0];
    setStatus("正在读取存档「" + latest.name + "」…");
    continueBtn.disabled = true;
    try {
      const ok = await ctx.host.loadSave(latest.id);
      if (ok) {
        ctx.notify("已载入存档「" + latest.name + "」", "ok");
        ctx.setScreen("game");
      } else {
        setStatus("读档失败：存档可能已损坏", "danger");
        continueBtn.disabled = false;
      }
    } catch (error) {
      setStatus("读档异常：" + messageOf(error), "danger");
      continueBtn.disabled = false;
    }
  }

  function openOverlay(titleText: string, iconName: string, body: HTMLElement, wide = false): HTMLElement {
    closeOverlay();
    const layer = el("div", { cls: "tri-menu-overlay" });
    const panel = el("div", { cls: "tri-menu-panel" + (wide ? " tri-menu-panel-wide" : "") });
    const head = el("div", { cls: "tri-menu-panel-head" });
    head.appendChild(icon(iconName, 18));
    head.appendChild(el("h2", { text: titleText }));
    const close = el("button", { cls: "tri-btn tri-btn-icon", attrs: { type: "button", title: "关闭（Esc）" } });
    close.appendChild(icon("close", 16));
    close.addEventListener("click", closeOverlay);
    head.appendChild(close);
    const bodyWrap = el("div", { cls: "tri-menu-panel-body" });
    bodyWrap.appendChild(body);
    panel.appendChild(head);
    panel.appendChild(bodyWrap);
    layer.appendChild(panel);
    layer.addEventListener("click", (ev) => {
      if (ev.target === layer) closeOverlay();
    });
    root.appendChild(layer);
    overlay = layer;
    const focusable = q<HTMLButtonElement>(layer, "button");
    focusable?.focus();
    return bodyWrap;
  }

  function closeOverlay(): void {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  async function openSaveBrowser(): Promise<void> {
    const body = el("div", { cls: "tri-savebrowser" });
    const list = el("div", { cls: "tri-save-list" });
    const info = el("div", { cls: "tri-save-info", text: "读取中…" });
    const actions = el("div", { cls: "tri-save-actions" });
    const importBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button" } });
    importBtn.appendChild(icon("upload", 15));
    importBtn.appendChild(el("span", { cls: "tri-btn-label", text: "导入存档文件" }));
    const fileInput = el("input", {
      attrs: { type: "file", accept: ".json,application/json", multiple: false },
      style: { display: "none" },
    });
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void (async () => {
        setText(info, "正在导入「" + file.name + "」…");
        try {
          const ok = await ctx.host.importSaveFile(file);
          if (ok) {
            setText(info, "导入成功");
            await refreshSaves();
            await renderList();
          } else {
            setText(info, "导入失败：文件不是有效的存档");
          }
        } catch (error) {
          setText(info, "导入失败：" + messageOf(error));
        } finally {
          fileInput.value = "";
        }
      })();
    });
    append(actions, importBtn, fileInput);
    append(body, el("p", { cls: "tri-hint", text: "存档保存在浏览器本地（IndexedDB）。读取前请确认已保存当前进度。" }), list, info, actions);
    openOverlay("存档库", "folder", body, true);
    await refreshSaves();
    await renderList();

    async function renderList(): Promise<void> {
      clear(list);
      if (saves.length === 0) {
        list.appendChild(el("div", { cls: "tri-empty", text: "暂无存档。开始一局游戏后可在底部 dock 打开存档面板保存。" }));
        return;
      }
      for (const slot of saves) {
        list.appendChild(slotRow(slot));
      }
    }

    function slotRow(slot: SaveSlotMeta): HTMLElement {
      const row = el("div", { cls: "tri-save-row" });
      const meta = el("div", { cls: "tri-save-meta" });
      const name = el("div", { cls: "tri-save-name" });
      name.appendChild(el("span", { text: slot.name || "未命名纪元" }));
      if (slot.auto) name.appendChild(el("span", { cls: "tri-badge tri-badge-dim", text: "自动" }));
      if (slot.version) name.appendChild(el("span", { cls: "tri-badge tri-badge-dim", text: "v" + slot.version }));
      meta.appendChild(name);
      append(
        meta,
        el("div", {
          cls: "tri-save-sub",
          text:
            "种子 " + slot.seed + " · " + slot.difficulty + " · " + slot.mode + " · 星历 " +
            Math.round(slot.year) + " 年 · 回合 " + slot.turn,
        }),
        el("div", {
          cls: "tri-save-sub",
          text: "人口 " + num(slot.population) + " · 时代 " + slot.era + " · " + dateTime(slot.savedAt),
        }),
      );
      const buttons = el("div", { cls: "tri-save-buttons" });
      const load = smallButton("读取", "play", () => {
        void (async () => {
          setText(info, "正在读取「" + slot.name + "」…");
          setButtonsDisabled(true);
          try {
            const ok = await ctx.host.loadSave(slot.id);
            if (ok) {
              ctx.notify("已载入存档「" + slot.name + "」", "ok");
              closeOverlay();
              ctx.setScreen("game");
            } else {
              setText(info, "读取失败：存档不可用");
              setButtonsDisabled(false);
            }
          } catch (error) {
            setText(info, "读取异常：" + messageOf(error));
            setButtonsDisabled(false);
          }
        })();
      });
      const exportBtn = smallButton("导出", "download", () => {
        void (async () => {
          try {
            await ctx.host.exportSaveFile(slot.id);
            setText(info, "已导出存档「" + slot.name + "」");
          } catch (error) {
            setText(info, "导出失败：" + messageOf(error));
          }
        })();
      });
      const remove = smallButton("删除", "trash", () => {
        void (async () => {
          setText(info, "正在删除「" + slot.name + "」…");
          try {
            await ctx.host.deleteSave(slot.id);
            await refreshSaves();
            await renderList();
            setText(info, "存档已删除");
          } catch (error) {
            setText(info, "删除失败：" + messageOf(error));
          }
        })();
      });
      remove.classList.add("tri-btn-danger");
      append(buttons, load, exportBtn, remove);
      row.appendChild(meta);
      row.appendChild(buttons);
      return row;
    }

    function setButtonsDisabled(disabled: boolean): void {
      for (const button of qa<HTMLButtonElement>(list, "button")) button.disabled = disabled;
    }
  }

  function openManual(): void {
    const body = el("div", { cls: "tri-manual" });
    const sections: [string, string[]][] = [
      ["观测是唯一真相", [
        "开局时你对三颗恒星几乎一无所知。右侧「观测」页可发起观测任务：单星定位、测距、测速、双星相对、三星联合、异常分析等。",
        "只有被观测过的量才会显示数值；未观测的数据一律标记为「未观测」，系统不会伪造。",
        "观测精度受天文台等级、设备与效率影响。数据点越多，轨道模型与预测越可靠。",
      ]],
      ["预测有限且会失效", [
        "预测基于当前观测数据对未来的推演，随时间推移不确定性会指数增长。混沌系统中没有无限期的确定未来。",
        "预测页会给出可靠年限、模型一致性、最近接近距离；虚线轨迹表示预测，实线表示已观测历史。",
      ]],
      ["文明在乱纪元中生存", [
        "人口、食物、水、能源、矿物、金属与科研相互制约。稳定度由食物、水、住房、温度、健康、秩序六项决定。",
        "建造与科研需要消耗资源与工业产能。科技树分为天文学、能源学、工业学、生物学、航天学五个方向。",
      ]],
      ["时间控制", [
        "顶部时间条：暂停 / 0.5x / 1x / 2x / 4x / 8x / 16x / 32x，另有「结束回合」按钮可单步推进。",
        "快捷键：空格暂停，1–4 切换左侧页签，5 收起/展开右侧面板，6 收起/展开底部 dock，Esc 关闭弹窗/暂停，T 切换轨迹，P 切换预测。",
      ]],
    ];
    for (const [titleText, lines] of sections) {
      const section = el("section", { cls: "tri-manual-section" });
      section.appendChild(el("h3", { text: titleText }));
      for (const line of lines) section.appendChild(el("p", { text: line }));
      body.appendChild(section);
    }
    openOverlay("游戏说明", "book", body, true);
  }

  function openCredits(): void {
    const body = el("div", { cls: "tri-credits" });
    append(
      body,
      el("div", { cls: "tri-credits-title", text: GAME_TITLE }),
      el("div", { cls: "tri-credits-sub", text: GAME_SUBTITLE }),
      el("p", {
        text: "一个以刘慈欣《三体》宇宙为灵感的硬科幻单机策略游戏。玩家扮演一个在三个太阳的混沌引力场中挣扎求生的文明的观测者与决策者。",
      }),
      el("h3", { text: "系统" }),
      el("p", { text: "引力模拟：牛顿 N 体（G = 4π²，AU / 太阳质量 / 年）· 软化势近似 · 固定步长积分。" }),
      el("p", { text: "观测与预测：带噪声的最小二乘估计、轨道外推、集合模型一致性评估。" }),
      el("p", { text: "界面：Canvas 2D 渲染 + DOM HUD，全部图标与图表为程序化内联 SVG，无第三方 UI 依赖。" }),
      el("h3", { text: "声明" }),
      el("p", { text: "本作是虚构作品。恒星系统、行星环境与文明演化均为游戏机制服务，不代表真实天体物理结论。" }),
      el("div", { cls: "tri-credits-version", text: "版本 " + VERSION + " · 本地单机 · 无网络请求" }),
    );
    openOverlay("制作说明", "info", body, true);
  }

  return screen;

  function chip(text: string): HTMLElement {
    return el("span", { cls: "tri-menu-chip", text });
  }

  function menuButton(label: string, iconName: string, variant: "primary" | "ghost"): HTMLButtonElement {
    const node = el("button", { cls: "tri-menu-btn tri-menu-btn-" + variant, attrs: { type: "button" } });
    node.appendChild(icon(iconName, 18));
    node.appendChild(el("span", { cls: "tri-btn-label", text: label }));
    node.appendChild(el("span", { cls: "tri-menu-btn-arrow", text: "→" }));
    return node;
  }

  function smallButton(label: string, iconName: string, handler: () => void): HTMLButtonElement {
    const node = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
    node.appendChild(icon(iconName, 14));
    node.appendChild(el("span", { cls: "tri-btn-label", text: label }));
    node.addEventListener("click", handler);
    return node;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
