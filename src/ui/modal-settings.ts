/** Settings modal: display toggles, honest audio placeholder, session info. */
import type { ViewModel, ViewSettings } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, el, setClass, setText } from "./dom";
import { icon } from "./icons";
import { kv, section } from "./widgets";
import { yearText } from "./format";

type SettingKey = keyof ViewSettings;

const SETTING_ROWS: { key: SettingKey; label: string; description: string; icon: string }[] = [
  { key: "showTrails", label: "观测轨迹", description: "绘制恒星与母星的实测历史轨迹（实线）", icon: "chart" },
  { key: "showPrediction", label: "预测轨迹", description: "绘制基于当前模型的预测轨迹（虚线）", icon: "target" },
  { key: "showUncertainty", label: "不确定范围", description: "绘制观测/预测的 1σ 不确定区域", icon: "orbit" },
  { key: "showGrid", label: "参考网格", description: "显示 AU 参考网格与坐标轴", icon: "grid" },
  { key: "showLabels", label: "天体标签", description: "在 2D/3D 视图中标注天体名称", icon: "eye" },
];

export function buildSettingsModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-settings-modal" });

  const displaySection = section("显示", { icon: "grid", hint: "立即生效" });
  const switchMap = new Map<SettingKey, HTMLButtonElement>();
  for (const item of SETTING_ROWS) {
    const row = el("div", { cls: "tri-setting-row" });
    const iconWrap = el("span", { cls: "tri-setting-icon" });
    iconWrap.appendChild(icon(item.icon, 16));
    const text = el("div", { cls: "tri-setting-text" });
    text.appendChild(el("span", { cls: "tri-setting-label", text: item.label }));
    text.appendChild(el("span", { cls: "tri-setting-desc", text: item.description }));
    const toggle = el("button", { cls: "tri-switch", attrs: { type: "button", title: "切换" + item.label, "data-setting": item.key, "aria-pressed": "true" } });
    toggle.appendChild(el("span", { cls: "tri-switch-knob" }));
    toggle.addEventListener("click", () => {
      shell.api()?.actions.toggleSetting(item.key);
      shell.requestRefresh();
    });
    append(row, iconWrap, text, toggle);
    displaySection.body.appendChild(row);
    switchMap.set(item.key, toggle);
  }
  root.appendChild(displaySection.el);

  const audioSection = section("音频", { icon: "wave", hint: "预留占位" });
  const audioRow = el("div", { cls: "tri-setting-row tri-setting-disabled" });
  const audioText = el("div", { cls: "tri-setting-text" });
  audioText.appendChild(el("span", { cls: "tri-setting-label", text: "主音量" }));
  audioText.appendChild(el("span", { cls: "tri-setting-desc", text: "音频系统尚未实装：此滑杆为预留占位，调整不会产生任何声音，也不会保存设置。" }));
  const slider = el("input", { cls: "tri-slider", attrs: { type: "range", min: "0", max: "100", value: "60", disabled: "true", "aria-label": "主音量（未实装）" } });
  append(audioRow, icon("wave", 16), audioText, slider);
  audioSection.body.appendChild(audioRow);
  root.appendChild(audioSection.el);

  const infoSection = section("本局信息", { icon: "info" });
  const infoGrid = el("div", { cls: "tri-kv-grid" });
  const seedRow = kv("星系种子", "—");
  const diffRow = kv("难度", "—");
  const modeRow = kv("模式", "—");
  const galaxyRow = kv("星系分类", "—");
  const calendarRow = kv("当前时间", "—");
  append(infoGrid, seedRow.el, diffRow.el, modeRow.el, galaxyRow.el, calendarRow.el);
  infoSection.body.appendChild(infoGrid);
  root.appendChild(infoSection.el);

  const sessionSection = section("会话", { icon: "cpu" });
  const sessionRow = el("div", { cls: "tri-session-actions" });
  const savesBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button" } });
  savesBtn.appendChild(icon("save", 15));
  savesBtn.appendChild(el("span", { cls: "tri-btn-label", text: "打开存档终端" }));
  savesBtn.addEventListener("click", () => shell.openModal("saves"));
  const menuBtn = el("button", { cls: "tri-btn tri-btn-danger", attrs: { type: "button" } });
  menuBtn.appendChild(icon("chevronLeft", 15));
  menuBtn.appendChild(el("span", { cls: "tri-btn-label", text: "返回主菜单" }));
  armConfirm(menuBtn, "确认返回主菜单（未保存进度将丢失）", () => {
    shell.closeModal();
    shell.backToMenu();
  });
  append(sessionRow, savesBtn, menuBtn);
  sessionSection.body.appendChild(sessionRow);
  root.appendChild(sessionSection.el);

  let current: ViewModel | null = shell.view();
  if (current) update(current);

  function update(view: ViewModel): void {
    current = view;
    for (const item of SETTING_ROWS) {
      const toggle = switchMap.get(item.key);
      if (toggle) {
        const on = view.settings[item.key];
        setClass(toggle, "is-on", on);
        toggle.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
    setText(seedRow.valueNode, view.meta.seed);
    setText(diffRow.valueNode, view.meta.difficultyName);
    setText(modeRow.valueNode, view.meta.modeName);
    setText(galaxyRow.valueNode, view.meta.galaxyClassName);
    setText(calendarRow.valueNode, yearText(view.meta.calendarYear) + " · 回合 " + view.meta.turn);
  }

  return {
    el: root,
    update,
    destroy() {
      /* listeners live on the subtree */
    },
  };
}

function armConfirm(button: HTMLButtonElement, confirmLabel: string, action: () => void): void {
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const original = button.querySelector(".tri-btn-label")?.textContent ?? "确认";
  button.addEventListener("click", () => {
    if (armed) {
      if (timer) clearTimeout(timer);
      armed = false;
      button.classList.remove("is-armed");
      setText(button.querySelector(".tri-btn-label"), original);
      action();
      return;
    }
    armed = true;
    button.classList.add("is-armed");
    setText(button.querySelector(".tri-btn-label"), confirmLabel);
    timer = setTimeout(() => {
      armed = false;
      button.classList.remove("is-armed");
      setText(button.querySelector(".tri-btn-label"), original);
      timer = null;
    }, 3600);
  });
}
