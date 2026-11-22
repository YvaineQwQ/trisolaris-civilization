/**
 * v1.4 移动端底部导航（≤1024 生效，桌面由 CSS 隐藏）。
 *
 * 五个拇指可达入口：文明档案 / 观测 / 暂停 / 决策 / 终端。
 *  - 文明档案：打开左侧白纸抽屉（移动端全屏档案页）；
 *  - 观测：关闭所有抽屉，回到单列观测主舞台；
 *  - 暂停：直接调用 actions.togglePause（与空格/停靠坞等价）；
 *  - 决策：打开右侧决策栏（移动端全屏页签页）；
 *  - 终端：上滑底部停靠坞（建造/科研/天文台/星系图/日志/存档/设置/帮助 + 时间控制）。
 *
 * 这里不复制任何业务逻辑，所有动作都复用既有 handle / actions，
 * 因此桌面端 data-action / data-dock 契约完全不受影响。
 */
import type { ViewModel } from "../game/viewTypes";
import type { GameShell } from "./types";
import { append, clear, el, on, setClass, setText } from "./dom";
import { icon } from "./icons";

export interface MobileNavActions {
  openDossier(): void;
  closeAll(): void;
  openDecision(): void;
  toggleTerminal(): void;
  dossierOpen(): boolean;
  decisionOpen(): boolean;
  terminalOpen(): boolean;
}

export interface MobileNavHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  sync(): void;
  destroy(): void;
}

interface NavItem {
  id: "dossier" | "observe" | "pause" | "decision" | "terminal";
  label: string;
  icon: string;
  primary?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dossier", label: "文明", icon: "book" },
  { id: "observe", label: "观测", icon: "compass" },
  { id: "pause", label: "暂停", icon: "pause", primary: true },
  { id: "decision", label: "决策", icon: "target" },
  { id: "terminal", label: "终端", icon: "grid" },
];

export function createMobileNav(shell: GameShell, actions: MobileNavActions): MobileNavHandle {
  const root = el("nav", { cls: "tri-mobilenav", attrs: { "aria-label": "移动端主菜单" } });
  const subscriptions: (() => void)[] = [];
  const buttons = new Map<NavItem["id"], HTMLButtonElement>();
  let pauseIconWrap: HTMLElement | null = null;
  let pauseLabel: HTMLElement | null = null;

  for (const item of NAV_ITEMS) {
    const button = el("button", {
      cls: "tri-mobilenav-btn" + (item.primary ? " is-primary" : ""),
      attrs: { type: "button", "data-mobile-nav": item.id, title: item.label, "aria-label": item.label },
    });
    const iconWrap = el("span", { cls: "tri-mobilenav-icon" });
    iconWrap.appendChild(icon(item.icon, 19));
    const label = el("span", { cls: "tri-mobilenav-label", text: item.label });
    append(button, iconWrap, label);
    if (item.id === "pause") {
      pauseIconWrap = iconWrap;
      pauseLabel = label;
    }
    subscriptions.push(
      on(button, "click", () => {
        switch (item.id) {
          case "dossier":
            if (actions.dossierOpen()) actions.closeAll();
            else actions.openDossier();
            break;
          case "decision":
            if (actions.decisionOpen()) actions.closeAll();
            else actions.openDecision();
            break;
          case "terminal":
            actions.toggleTerminal();
            break;
          case "observe":
            actions.closeAll();
            break;
          case "pause":
            shell.api()?.actions.togglePause();
            break;
          default:
            break;
        }
        sync();
      }),
    );
    root.appendChild(button);
    buttons.set(item.id, button);
  }

  function sync(): void {
    const dossier = actions.dossierOpen();
    const decision = actions.decisionOpen();
    const terminal = actions.terminalOpen();
    const anyOpen = dossier || decision || terminal;
    setClass(buttons.get("dossier"), "is-active", dossier);
    setClass(buttons.get("decision"), "is-active", decision);
    setClass(buttons.get("terminal"), "is-active", terminal);
    setClass(buttons.get("observe"), "is-active", !anyOpen);
    root.classList.toggle("is-sheet-open", anyOpen);
  }

  return {
    el: root,
    update(view) {
      const paused = view.meta.paused;
      setClass(buttons.get("pause"), "is-active", paused);
      buttons.get("pause")?.setAttribute("aria-pressed", paused ? "true" : "false");
      if (pauseIconWrap) {
        clear(pauseIconWrap);
        pauseIconWrap.appendChild(icon(paused ? "play" : "pause", 19));
      }
      if (pauseLabel) setText(pauseLabel, paused ? "继续" : "暂停");
      sync();
    },
    sync,
    destroy() {
      for (const off of subscriptions.splice(0)) off();
      root.remove();
    },
  };
}
