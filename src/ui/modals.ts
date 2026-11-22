/** Modal host: one dialog at a time, built fresh on open, patched while open. */
import type { ViewModel } from "../game/viewTypes";
import type { GameShell, ModalBuilder, ModalInstance, ModalKind } from "./types";
import { clear, el, on } from "./dom";
import { icon } from "./icons";
import { buildBuildModal } from "./modal-build";
import { buildResearchModal } from "./modal-research";
import { buildObservatoryModal } from "./modal-observatory";
import { buildMapModal } from "./modal-map";
import { buildLogModal } from "./modal-log";
import { buildSavesModal } from "./modal-saves";
import { buildSettingsModal } from "./modal-settings";
import { buildHelpModal } from "./modal-help";
import { buildPoliticsModal } from "./modal-politics";
import { buildEventModal } from "./modal-event";
import { buildEventResultModal } from "./modal-event-result";

const TITLES: Record<ModalKind, { title: string; icon: string; hint: string }> = {
  build: { title: "建造终端", icon: "build", hint: "资源与工业产能将立即扣除" },
  research: { title: "科技树", icon: "research", hint: "科研点按回合累积" },
  observatory: { title: "天文台", icon: "telescope", hint: "观测能力决定你能看见什么" },
  map: { title: "星系地图", icon: "map", hint: "X-Z 投影 · 高度 Y 单独标注" },
  log: { title: "事件日志", icon: "log", hint: "按分类筛选记录" },
  saves: { title: "存档终端", icon: "save", hint: "存档保存在浏览器本地" },
  settings: { title: "设置", icon: "settings", hint: "显示选项立即生效" },
  help: { title: "帮助与科学假设", icon: "help", hint: "操作说明 · 模型边界" },
  politics: { title: "政治终端", icon: "system", hint: "六部门 · 派系 · 关系网 · 政治资本" },
  event: { title: "纪元事件档案", icon: "book", hint: "抉择会写入文明史，并影响后续事件概率" },
  eventResult: { title: "事件结算报告", icon: "book", hint: "30 秒延迟结算 · 实际收益与减益" },
};

const BUILDERS: Record<ModalKind, ModalBuilder> = {
  build: buildBuildModal,
  research: buildResearchModal,
  observatory: buildObservatoryModal,
  map: buildMapModal,
  log: buildLogModal,
  saves: buildSavesModal,
  settings: buildSettingsModal,
  help: buildHelpModal,
  politics: buildPoliticsModal,
  event: buildEventModal,
  eventResult: buildEventResultModal,
};

export interface ModalsHandle {
  el: HTMLElement;
  open(kind: ModalKind): void;
  close(): void;
  active(): ModalKind | null;
  update(view: ViewModel): void;
  destroy(): void;
}

export function createModals(shell: GameShell): ModalsHandle {
  const layer = el("div", { cls: "tri-modal-layer tri-hidden" });
  const backdrop = el("div", { cls: "tri-modal-backdrop" });
  const dialog = el("div", { cls: "tri-modal", attrs: { role: "dialog", "aria-modal": "true" } });
  layer.append(backdrop, dialog);

  let current: { kind: ModalKind; instance: ModalInstance } | null = null;
  const offBackdrop = on(backdrop, "click", () => close());

  function open(kind: ModalKind): void {
    if (current && current.kind === kind) {
      close();
      return;
    }
    close();
    shell.state.modal = kind;
    const meta = TITLES[kind];
    clear(dialog);
    dialog.className = "tri-modal tri-modal-" + kind;
    const head = el("header", { cls: "tri-modal-head" });
    const titleWrap = el("div", { cls: "tri-modal-title" });
    const iconWrap = el("span", { cls: "tri-modal-icon" });
    iconWrap.appendChild(icon(meta.icon, 18));
    titleWrap.appendChild(iconWrap);
    const titleText = el("div", { cls: "tri-modal-title-text" });
    titleText.appendChild(el("h2", { text: meta.title }));
    titleText.appendChild(el("span", { cls: "tri-kicker", text: meta.hint }));
    titleWrap.appendChild(titleText);
    head.appendChild(titleWrap);
    const closeBtn = el("button", { cls: "tri-btn tri-btn-icon tri-modal-close", attrs: { type: "button", title: "关闭（Esc）" } });
    closeBtn.appendChild(icon("close", 17));
    closeBtn.addEventListener("click", () => close());
    head.appendChild(closeBtn);

    const body = el("div", { cls: "tri-modal-content" });
    let instance: ModalInstance;
    try {
      instance = BUILDERS[kind](shell, () => close());
    } catch (error) {
      console.error("[trisolaris] modal build failed", error);
      instance = {
        el: el("div", { cls: "tri-empty", text: "面板构建失败：" + messageOf(error) }),
        update: () => undefined,
        destroy: () => undefined,
      };
    }
    body.appendChild(instance.el);
    const foot = el("footer", { cls: "tri-modal-foot" });
    foot.appendChild(icon("info", 13));
    foot.appendChild(el("span", { text: "Esc 关闭 · 所有操作直接作用于模拟状态" }));
    dialog.append(head, body, foot);
    layer.classList.remove("tri-hidden");
    current = { kind, instance };
    const focusTarget = dialog.querySelector<HTMLButtonElement>("button:not([disabled])");
    focusTarget?.focus();
  }

  function close(): void {
    if (!current) {
      shell.state.modal = null;
      layer.classList.add("tri-hidden");
      return;
    }
    const instance = current.instance;
    current = null;
    shell.state.modal = null;
    layer.classList.add("tri-hidden");
    try {
      instance.onClose?.();
    } catch (error) {
      console.warn("[trisolaris] modal onClose failed", error);
    }
    try {
      instance.destroy();
    } catch (error) {
      console.warn("[trisolaris] modal destroy failed", error);
    }
    clear(dialog);
  }

  return {
    el: layer,
    open,
    close,
    active: () => current?.kind ?? null,
    update(view) {
      if (!current) return;
      try {
        current.instance.update(view);
      } catch (error) {
        console.warn("[trisolaris] modal update failed", error);
      }
    },
    destroy() {
      offBackdrop();
      close();
      layer.remove();
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
