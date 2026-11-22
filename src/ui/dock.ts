/**
 * v1.3 底部停靠坞 —— 面板入口 + 时间控制。
 * v1.5：移除与顶部 HUD 重复的回合/时代/速度读数块与装饰刻度线；
 * 收起状态只保留图标；时间轴（暂停 / 倍速 / 单步）在此统一管理。
 */
import { TIME_SPEEDS } from "../core/constants";
import type { ViewModel } from "../game/viewTypes";
import type { GameShell, ModalKind } from "./types";
import { append, clear, el, on, setClass, setText } from "./dom";
import { icon } from "./icons";

interface DockItem {
  kind: ModalKind;
  label: string;
  icon: string;
}

const DOCK_ITEMS: DockItem[] = [
  { kind: "build", label: "建造", icon: "build" },
  { kind: "research", label: "科研", icon: "research" },
  { kind: "observatory", label: "天文台", icon: "telescope" },
  { kind: "map", label: "星系图", icon: "map" },
  { kind: "log", label: "日志", icon: "log" },
  { kind: "saves", label: "存档", icon: "save" },
  { kind: "settings", label: "设置", icon: "settings" },
  { kind: "help", label: "帮助", icon: "help" },
];

export interface DockHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  toggleCollapsed(): void;
  /** v1.4 移动端：底部坞变为可上滑的「终端」抽屉。 */
  toggleMobileOpen(): void;
  openMobile(): void;
  closeMobile(): void;
  mobileOpen(): boolean;
  destroy(): void;
}

export function createDock(shell: GameShell): DockHandle {
  const root = el("footer", { cls: "tri-dock" });
  if (shell.state.dockCollapsed) root.classList.add("is-collapsed");
  const subscriptions: (() => void)[] = [];

  const inner = el("div", { cls: "tri-dock-inner" });

  /* 面板入口（回合/时代/速度读数已并入顶部 HUD 摘要行，坞内不再重复） */
  const actions = el("nav", { cls: "tri-dock-actions", attrs: { "aria-label": "游戏面板" } });
  const buttons = new Map<ModalKind, HTMLButtonElement>();
  const badges = new Map<ModalKind, HTMLElement>();
  for (const item of DOCK_ITEMS) {
    const button = el("button", {
      cls: "tri-dock-btn",
      attrs: { type: "button", title: item.label, "data-dock": item.kind },
    });
    const iconWrap = el("span", { cls: "tri-dock-icon" });
    iconWrap.appendChild(icon(item.icon, 18));
    const label = el("span", { cls: "tri-dock-label", text: item.label });
    const badge = el("span", { cls: "tri-dock-badge tri-hidden", text: "" });
    append(button, iconWrap, label, badge);
    button.addEventListener("click", () => {
      if (button.disabled) return;
      shell.openModal(item.kind);
    });
    actions.appendChild(button);
    buttons.set(item.kind, button);
    badges.set(item.kind, badge);
  }

  /* 右：时间控制（暂停 / 倍速 / 单步） */
  const time = el("div", { cls: "tri-dock-time" });
  const pauseBtn = el("button", { cls: "tri-hud-pause", attrs: { type: "button", title: "暂停 / 继续（空格）" } });
  const pauseIconWrap = el("span", { cls: "tri-hud-pause-icon" });
  pauseIconWrap.appendChild(icon("pause", 16));
  pauseBtn.appendChild(pauseIconWrap);
  const speeds = el("div", { cls: "tri-speed-group", attrs: { role: "group", "aria-label": "模拟速度" } });
  const speedButtons: HTMLButtonElement[] = [];
  for (let i = 1; i < TIME_SPEEDS.length; i += 1) {
    const value = TIME_SPEEDS[i];
    const node = el("button", {
      cls: "tri-speed-btn",
      text: (value < 1 ? value.toFixed(1) : String(value)) + "×",
      attrs: { type: "button", title: "设置速度 " + value + "×", "data-speed": i },
    });
    node.addEventListener("click", () => shell.api()?.actions.setSpeedIndex(i));
    speeds.appendChild(node);
    speedButtons.push(node);
  }
  const stepBtn = el("button", { cls: "tri-hud-icon-btn tri-dock-step", attrs: { type: "button", title: "结束当前回合（单步推进）" } });
  stepBtn.appendChild(icon("step", 16));
  append(time, pauseBtn, speeds, stepBtn);

  /* 收起钮 */
  const right = el("div", { cls: "tri-dock-right" });
  const collapseBtn = el("button", { cls: "tri-btn tri-btn-icon tri-dock-collapse", attrs: { type: "button", title: "收起底部栏" } });
  collapseBtn.appendChild(icon("chevronDown", 15));
  right.appendChild(collapseBtn);

  append(inner, actions, time, right);
  root.appendChild(inner);

  subscriptions.push(
    on(collapseBtn, "click", () => {
      /* 移动端抽屉态：收起钮变成「关闭终端」 */
      if (root.classList.contains("is-mobile-open")) closeMobile();
      else toggleCollapsed();
    }),
  );
  subscriptions.push(on(pauseBtn, "click", () => shell.api()?.actions.togglePause()));
  subscriptions.push(on(stepBtn, "click", () => shell.api()?.actions.advanceTurn()));

  function openMobile(): void {
    if (root.classList.contains("is-mobile-open")) return;
    root.classList.add("is-mobile-open");
  }

  function closeMobile(): void {
    root.classList.remove("is-mobile-open");
  }

  function toggleMobileOpen(): void {
    if (root.classList.contains("is-mobile-open")) closeMobile();
    else openMobile();
  }

  function toggleCollapsed(): void {
    const collapsed = !root.classList.contains("is-collapsed");
    root.classList.toggle("is-collapsed", collapsed);
    shell.state.dockCollapsed = collapsed;
    collapseBtn.title = collapsed ? "展开底部栏" : "收起底部栏";
    clear(collapseBtn);
    collapseBtn.appendChild(icon(collapsed ? "chevronUp" : "chevronDown", 15));
  }

  return {
    el: root,
    update(view) {
      const hasGame = shell.api() != null;
      for (const [kind, button] of buttons) {
        const needsGame = kind !== "settings" && kind !== "help";
        button.disabled = needsGame && !hasGame;
        if (button.disabled) button.title = "尚未进入游戏";
        button.classList.toggle("is-active", shell.activeModal() === kind);
      }
      setBadge("build", view.buildings.queue.length > 0 ? String(view.buildings.queue.length) : "");
      setBadge("research", view.civ.science.activeTechName ? "研" : "");
      setBadge("observatory", view.observatory.next?.canUpgrade ? "↑" : "");
      setBadge("log", view.log.length > 0 ? String(Math.min(99, view.log.length)) : "");
      setBadge("saves", view.saving?.busy ? "…" : "");
      setBadge("map", view.observation.stars.some((star) => star.known.position) ? "" : "!");
      setBadge("settings", countDisabledSettings(view) > 0 ? String(countDisabledSettings(view)) : "");

      setClass(pauseBtn, "is-active", view.meta.paused);
      clear(pauseIconWrap);
      pauseIconWrap.appendChild(icon(view.meta.paused ? "play" : "pause", 16));
      pauseBtn.title = view.meta.paused ? "继续游戏（空格）" : "暂停游戏（空格）";
      for (let i = 0; i < speedButtons.length; i += 1) {
        setClass(speedButtons[i], "is-active", view.meta.speedIndex === i + 1);
      }
    },
    toggleCollapsed,
    toggleMobileOpen,
    openMobile,
    closeMobile,
    mobileOpen: () => root.classList.contains("is-mobile-open"),
    destroy() {
      for (const off of subscriptions.splice(0)) off();
    },
  };

  function setBadge(kind: ModalKind, text: string): void {
    const badge = badges.get(kind);
    if (!badge) return;
    setText(badge, text);
    badge.classList.toggle("tri-hidden", text.length === 0);
  }
}

function countDisabledSettings(view: ViewModel): number {
  const settings = view.settings;
  let count = 0;
  if (!settings.showTrails) count += 1;
  if (!settings.showPrediction) count += 1;
  if (!settings.showGrid) count += 1;
  if (!settings.showLabels) count += 1;
  if (!settings.showUncertainty) count += 1;
  return count;
}
