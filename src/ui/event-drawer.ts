/**
 * v1.6 非阻塞事件抉择抽屉（EVENT DRAWER）.
 *
 * 契约（供 lead 接线）：
 *   const drawer = createEventDrawer(shell);
 *   stage.appendChild(drawer.el);        // 建议放在 .tri-game-stage 内、居中视口之外
 *   drawer.update(view);                 // 每次 view 刷新调用
 *   drawer.el / open() / close() / visible() / destroy()
 *
 * 设计：
 *  - 没有全屏遮罩、不暂停模拟、不挡中央观测；从右侧滑出停靠；
 *  - 效果只显示「区间」，不显示精确结算值；
 *  - 旧 modal-event 保留为「完整档案」，抽屉里通过按钮打开；
 *  - 根类 .tri-event-drawer，默认隐藏，.is-open 显示；选择按钮 data-evdraw-choice。
 */
import type { ActiveEventView, EventChoiceView, EventEffectView, ViewModel } from "../game/viewTypes";
import type { GameShell } from "./types";
import type { EffectBand } from "../events/outcome-ranges";
import { append, clear, delegate, disposeAll, el, on } from "./dom";
import { icon } from "./icons";
import "./event-report.css";

/** 抽屉接受的区间形状：优先用 view 上由 forecastEffectBands 生成的 bands；否则用 delta ±25% 兜底。 */
export interface DrawerBand {
  key: string;
  label: string;
  kind: string;
  unit: string;
  before?: number | null;
  deltaMin?: number | null;
  deltaMax?: number | null;
  afterMin?: number | null;
  afterMax?: number | null;
  min?: number | null;
  max?: number | null;
  tone?: "gain" | "loss" | "neutral";
  detail?: string | null;
}

const MINUS = "\u2212";

function round(value: number, digits = 1): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function fmtMagnitude(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e4) return (abs / 1e3).toFixed(1) + "k";
  if (abs >= 100 || Math.abs(abs - Math.round(abs)) < 0.049) return String(Math.round(abs));
  return String(round(abs, 1));
}

function signed(value: number): string {
  if (value > 0) return "+" + fmtMagnitude(value);
  if (value < 0) return MINUS + fmtMagnitude(value);
  return "\u00b10";
}

/**
 * 区间文本：损失按「较小损失 ~ 较大损失」排列。
 * 例：formatBandRange("食物", -210, -120, "吨") => "食物 −120 ~ −210 吨"
 */
export function formatBandRange(label: string, min: number, max: number, unit = ""): string {
  const suffix = unit ? " " + unit : "";
  if (min < 0 && max < 0) return label + " " + signed(max) + " ~ " + signed(min) + suffix;
  return label + " " + signed(min) + " ~ " + signed(max) + suffix;
}

/** 把一个 band（outcome-ranges.EffectBand 或其它等价结构）转成抽屉里的区间文本。 */
export function formatDrawerBand(band: DrawerBand): string {
  const deltaMin = band.deltaMin ?? band.min ?? null;
  const deltaMax = band.deltaMax ?? band.max ?? null;
  if (deltaMin != null && deltaMax != null) {
    return formatBandRange(band.label, deltaMin, deltaMax, band.unit);
  }
  if (band.detail) return band.label + " · " + band.detail;
  return band.label;
}

/** view 还没有 bands 字段时的兜底：用现有精确 delta 生成 ±25% 区间（不显示精确值）。 */
export function fallbackBandsFromEffects(
  effects: ReadonlyArray<Pick<EventEffectView, "key" | "label" | "kind" | "unit" | "delta" | "detail" | "tone">>,
  spread = 0.25,
): DrawerBand[] {
  return effects.map((effect) => {
    if (effect.delta == null || !Number.isFinite(effect.delta) || effect.delta === 0) {
      return {
        key: effect.key,
        label: effect.label,
        kind: effect.kind,
        unit: effect.unit,
        min: null,
        max: null,
        tone: effect.tone,
        detail: effect.detail,
      };
    }
    const magnitude = Math.abs(effect.delta);
    const padding = Math.max(
      effect.kind === "population" || effect.kind === "resource" || effect.kind === "science" ? 1 : 0.5,
      magnitude * spread,
    );
    return {
      key: effect.key,
      label: effect.label,
      kind: effect.kind,
      unit: effect.unit,
      min: round(effect.delta - padding, 2),
      max: round(effect.delta + padding, 2),
      tone: effect.tone,
      detail: effect.detail,
    };
  });
}

/** 从 EventChoiceView 取得显示用区间：优先 view 上由 forecastEffectBands 填好的 bands。 */
export function drawerBandsForChoice(choice: EventChoiceView): DrawerBand[] {
  const bands = (choice as EventChoiceView & { bands?: EffectBand[] }).bands;
  if (Array.isArray(bands) && bands.length > 0) {
    return bands.map((band) => ({
      key: band.key,
      label: band.label,
      kind: band.kind,
      unit: band.unit,
      before: band.before,
      deltaMin: band.deltaMin,
      deltaMax: band.deltaMax,
      afterMin: band.afterMin,
      afterMax: band.afterMax,
      tone: band.tone,
      detail: band.detail,
    }));
  }
  return fallbackBandsFromEffects(choice.effects);
}

export interface EventDrawerHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  open(): void;
  close(): void;
  visible(): boolean;
  destroy(): void;
}

export function createEventDrawer(shell: GameShell): EventDrawerHandle {
  const root = el("aside", {
    cls: "tri-event-drawer",
    attrs: { "aria-label": "事件抉择", "data-event-drawer": "1", "aria-hidden": "true" },
  });

  const head = el("header", { cls: "tri-evdraw-head" });
  const kicker = el("span", { cls: "tri-evdraw-kicker", text: "// PENDING DECISION · 待决事件" });
  const title = el("h2", { cls: "tri-evdraw-title", text: "" });
  const short = el("p", { cls: "tri-evdraw-short", text: "" });
  head.appendChild(kicker);
  head.appendChild(title);
  head.appendChild(short);

  const figure = el("figure", { cls: "tri-evdraw-figure" });
  const fallback = el("div", { cls: "tri-evdraw-artfallback" });
  fallback.appendChild(el("span", { cls: "tri-evdraw-artkicker", text: "// EVENT PLATE" }));
  fallback.appendChild(el("span", { cls: "tri-evdraw-artmark", text: "事件档案" }));
  figure.appendChild(fallback);
  const image = document.createElement("img");
  image.className = "tri-evdraw-img";
  image.alt = "";
  image.decoding = "async";
  image.addEventListener("load", () => figure.classList.remove("is-missing"));
  image.addEventListener("error", () => {
    image.remove();
    figure.classList.add("is-missing");
  });
  figure.classList.add("is-missing");
  figure.appendChild(image);

  const choicesBox = el("div", { cls: "tri-evdraw-choices" });
  const foot = el("footer", { cls: "tri-evdraw-foot" });
  const hint = el("span", { cls: "tri-evdraw-hint", text: "区间为当前文明状态下的估算；实际结算按硬上限夹取并写入编年史。" });
  const archiveBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-evdraw-archive", attrs: { type: "button", "data-evdraw-archive": "1" } });
  archiveBtn.appendChild(icon("book", 14));
  archiveBtn.appendChild(el("span", { cls: "tri-btn-label", text: "查看完整档案" }));
  const commitBtn = el("button", { cls: "tri-btn tri-btn-primary tri-evdraw-commit", attrs: { type: "button", "data-evdraw-commit": "1" } });
  commitBtn.appendChild(icon("check", 14));
  commitBtn.appendChild(el("span", { cls: "tri-btn-label", text: "做出抉择" }));
  const closeBtn = el("button", {
    cls: "tri-evdraw-close",
    attrs: { type: "button", "data-evdraw-close": "1", title: "稍后处理", "aria-label": "稍后处理" },
  });
  closeBtn.appendChild(icon("close", 14));
  append(foot, hint, archiveBtn, commitBtn);
  append(root, head, closeBtn, figure, choicesBox, foot);

  const subscriptions: (() => void)[] = [];
  let current: ActiveEventView | null = null;
  let selectedId: string | null = null;
  let visible = false;
  let signature = "";
  let dismissedDefId: string | null = null;

  function sync(): void {
    root.classList.toggle("is-open", visible);
    root.setAttribute("aria-hidden", String(!visible));
  }

  function availableChoices(): EventChoiceView[] {
    return current ? current.choices.filter((choice) => choice.available) : [];
  }

  function selectChoice(id: string | null): void {
    selectedId = id;
    for (const node of Array.from(choicesBox.querySelectorAll<HTMLElement>("[data-evdraw-choice]"))) {
      node.classList.toggle("is-selected", node.dataset.evdrawChoice === id);
      node.setAttribute("aria-pressed", String(node.dataset.evdrawChoice === id));
    }
    commitBtn.disabled = id == null;
    const choice = current?.choices.find((item) => item.id === id) ?? null;
    commitBtn.title = choice?.label ? "提交抉择：" + choice.label : "先选择一个抉择";
  }

  function bandNodes(choice: EventChoiceView): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    const bands = drawerBandsForChoice(choice);
    const seenText = new Set<string>();
    for (const band of bands.slice(0, 4)) {
      const text = formatDrawerBand(band);
      if (seenText.has(text)) continue;
      seenText.add(text);
      const tag = el("span", {
        cls: "tri-evdraw-band",
        attrs: { "data-tone": band.tone ?? "neutral", "data-kind": band.kind },
        text,
      });
      nodes.push(tag);
    }
    const stateBands = bands.filter((band) => band.deltaMin == null && band.min == null && band.detail);
    for (const band of stateBands.slice(0, 2)) {
      nodes.push(el("span", { cls: "tri-evdraw-band", attrs: { "data-tone": "neutral", "data-kind": band.kind }, text: band.label + " · " + (band.detail ?? "") }));
    }
    return nodes;
  }

  function render(): void {
    if (!current) return;
    title.textContent = current.title;
    short.textContent = current.short;
    const src = current.illustration.startsWith("http") ? current.illustration : "./" + current.illustration.replace(/^\/+/, "");
    if (image.getAttribute("src") !== src) {
      figure.classList.add("is-missing");
      image.src = src;
    }
    image.alt = current.title;
    clear(choicesBox);
    if (availableChoices().length === 0) {
      choicesBox.appendChild(el("p", { cls: "tri-evdraw-empty", text: "当前没有可执行的抉择（条件不足）。" }));
    }
    current.choices.forEach((choice, index) => {
      const card = el("button", {
        cls: "tri-evdraw-choice",
        attrs: {
          type: "button",
          "data-evdraw-choice": choice.id,
          "data-risk": choice.risk ? "1" : "0",
          "aria-pressed": "false",
          disabled: !choice.available ? "" : undefined,
        },
      });
      if (!choice.available) {
        card.disabled = true;
        card.title = choice.unavailableReason ?? "条件不足";
      }
      const numNode = el("span", { cls: "tri-evdraw-choicenum", text: String(index + 1).padStart(2, "0") });
      const main = el("span", { cls: "tri-evdraw-choicemain" });
      main.appendChild(el("span", { cls: "tri-evdraw-choicelabel", text: choice.label }));
      if (choice.description) main.appendChild(el("span", { cls: "tri-evdraw-choicedesc", text: choice.description }));
      if (choice.risk) main.appendChild(el("span", { cls: "tri-evdraw-risk", text: "风险 · " + choice.risk }));
      if (!choice.available) {
        main.appendChild(el("span", { cls: "tri-evdraw-locked", text: choice.unavailableReason ?? "条件不足" }));
      }
      const ranges = el("span", { cls: "tri-evdraw-bands" });
      for (const node of bandNodes(choice)) ranges.appendChild(node);
      if (ranges.childElementCount > 0) main.appendChild(ranges);
      const arrow = el("span", { cls: "tri-evdraw-choicearrow", text: "→" });
      append(card, numNode, main, arrow);
      choicesBox.appendChild(card);
    });
    selectChoice(availableChoices()[0]?.id ?? null);
  }

  function open(): void {
    visible = true;
    dismissedDefId = null;
    sync();
  }

  function close(): void {
    visible = false;
    if (current) dismissedDefId = current.defId;
    sync();
  }

  subscriptions.push(delegate(root, "[data-evdraw-choice]", "click", (_ev, target) => {
    const id = target.getAttribute("data-evdraw-choice");
    if (!id) return;
    const choice = current?.choices.find((item) => item.id === id);
    if (!choice || !choice.available) return;
    selectChoice(id);
  }));
  subscriptions.push(delegate(root, "[data-evdraw-commit]", "click", () => {
    if (!current || !selectedId) return;
    const api = shell.api();
    if (!api) return;
    const choice = current.choices.find((item) => item.id === selectedId);
    if (!choice || !choice.available) return;
    try {
      api.actions.resolveEvent(selectedId);
      shell.notify("抉择已提交 · 结算报告将在 30 秒后送达", "ok");
      shell.requestRefresh();
    } catch (error) {
      console.warn("[trisolaris] resolve event from drawer failed", error);
      shell.notify("提交抉择失败，请稍后再试", "warn");
      return;
    }
    visible = false;
    current = null;
    selectedId = null;
    signature = "";
    sync();
  }));
  subscriptions.push(delegate(root, "[data-evdraw-archive]", "click", () => {
    shell.openModal("event");
  }));
  subscriptions.push(delegate(root, "[data-evdraw-close]", "click", () => close()));
  subscriptions.push(on(root, "keydown", (ev) => {
    const event = ev as KeyboardEvent;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }));

  sync();

  return {
    el: root,
    update(view: ViewModel) {
      const active = view.events?.active ?? null;
      current = active;
      if (!active) {
        if (visible) close();
        if (dismissedDefId) dismissedDefId = null;
        signature = "";
        return;
      }
      const nextSignature = [
        active.defId,
        active.choices.length,
        active.choices.map((choice) => choice.id + ":" + (choice.available ? "1" : "0")).join("+"),
      ].join("#");
      if (nextSignature !== signature) {
        signature = nextSignature;
        render();
      }
      if (!visible && dismissedDefId !== active.defId) open();
      else sync();
    },
    open,
    close,
    visible: () => visible,
    destroy() {
      disposeAll(subscriptions);
      clear(root);
      root.remove();
    },
  };
}
