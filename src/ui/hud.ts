/**
 * v1.4 主舞台页眉 —— 「终末地工业画册」× 曲线仪表：
 *  - 时代进度弧：5 段同心刻度（E1–E5），弧长 = 文明总进度；
 *  - 人口环形仪表：环 = 住房覆盖比，圆心 = 人口总数；
 *  - 稳定度环形仪表：环 = 稳定度 0–100，圆心 = 当前值；
 *  - 资源环形摘要：食物 / 能源 / 科研 三个小环（储备比），替代原先的直线进度条；
 *  - 桌面（v1.5）：默认只留「品牌行 + 读数/警报 + 一行关键摘要」，完整仪表收起；
 *    点右上「读数」展开、再点收起；HUD 高度随内容自适应，主舞台自动补满。
 *  - ≤1024：同样折叠为「顶栏 + 读数摘要」，展开时以浮层显示完整仪表；
 *  - ≤720：摘要行 + 安全区，触摸区 ≥44px。
 * 时间控制仍在底部停靠坞；此处只保留读数与灾害入口。
 */
import type { ResourceView, ViewModel } from "../game/viewTypes";
import type { GameShell } from "./types";
import { append, el, on, setClass, setText } from "./dom";
import { icon } from "./icons";
import { int, num, pct, perYear } from "./format";
import { resourceIconName } from "./widgets";
import { arcGauge, reserveRing } from "./curves";
import type { ArcGaugeHandle, CurveTone, ReserveRingHandle } from "./curves";

export interface HudHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  destroy(): void;
}

interface HudResourceRow {
  root: HTMLElement;
  name: HTMLElement;
  value: HTMLElement;
  net: HTMLElement;
  lock: HTMLElement;
  gauge: ArcGaugeHandle;
  icon: HTMLElement;
}

const HUD_RESOURCES = ["food", "energy", "science"];

const STABILITY_TONE: Record<string, CurveTone> = {
  good: "ok",
  ok: "accent",
  warn: "warn",
  bad: "danger",
};

export function createHud(shell: GameShell): HudHandle {
  const root = el("header", { cls: "tri-hud" });
  const subscriptions: (() => void)[] = [];

  /* 顶部信号黄色带（全界面唯一常驻色带，约占页面 2%） */
  const band = el("div", { cls: "tri-hud-band", attrs: { "aria-hidden": "true" } });
  band.appendChild(el("span", { cls: "tri-hud-band-mark", text: "三体纪元 · TRISOLARIS: CIVILIZATION" }));
  band.appendChild(el("span", { cls: "tri-hud-band-rule" }));
  const bandTurn = el("span", { cls: "tri-hud-band-turn", text: "TURN 000" });
  band.appendChild(bandTurn);

  /* 字号行：品牌 / 运行状态 / 灾害入口 / 读数折叠 */
  const top = el("div", { cls: "tri-hud-top" });
  const brand = el("div", { cls: "tri-hud-brand" });
  brand.appendChild(el("span", { cls: "tri-hud-mark", text: "∴" }));
  const brandText = el("div", { cls: "tri-hud-brandtext" });
  brandText.appendChild(el("b", { text: "三体纪元" }));
  brandText.appendChild(el("span", { text: "TRISOLARIS : CIVILIZATION" }));
  const mode = el("em", { cls: "tri-hud-mode", text: "—" });
  const runState = el("span", { cls: "tri-hud-runstate", text: "—" });
  append(brand, brandText, mode, runState);

  const actions = el("div", { cls: "tri-hud-actions" });
  const toggleBtn = el("button", {
    cls: "tri-hud-act tri-hud-toggle",
    attrs: { type: "button", title: "展开/收起完整读数", "aria-expanded": "false" },
  });
  toggleBtn.appendChild(icon("chart", 15));
  const toggleLabel = el("span", { cls: "tri-hud-act-label", text: "读数" });
  toggleBtn.appendChild(toggleLabel);
  const alertBtn = el("button", { cls: "tri-hud-alert tri-hud-act", attrs: { type: "button", title: "灾害与预警" } });
  alertBtn.appendChild(icon("bell", 15));
  alertBtn.appendChild(el("span", { cls: "tri-hud-act-label", text: "警报" }));
  const alertCount = el("span", { cls: "tri-hud-alert-count", text: "0" });
  alertBtn.appendChild(alertCount);
  append(actions, toggleBtn, alertBtn);
  append(top, brand, actions);

  /* 折叠态关键摘要（桌面与移动端共用一行：年 / 回合 / 时代 / 人口 / 稳定 / 食能研） */
  const mobileSum = el("div", { cls: "tri-hud-mobilesum" });
  const mobileYear = summaryCell(mobileSum, "星历");
  const mobileTurn = summaryCell(mobileSum, "回合");
  const mobileEra = summaryCell(mobileSum, "时代");
  const mobilePop = summaryCell(mobileSum, "人口");
  const mobileStability = summaryCell(mobileSum, "稳定");
  const mobileRes = summaryCell(mobileSum, "资源");

  /* 主体：时代弧 / 人口·稳定度环 / 资源环 */
  const main = el("div", { cls: "tri-hud-main" });

  /* ---- 1) 时代进度弧 ---- */
  const chrono = el("div", { cls: "tri-hud-chrono" });
  const chronoText = el("div", { cls: "tri-hud-chronotext" });
  const chronoKicker = el("span", { cls: "tri-hud-kicker", text: "// STAR EPHEMERIS" });
  const yearRow = el("div", { cls: "tri-hud-yearrow" });
  yearRow.appendChild(el("span", { cls: "tri-hud-year-prefix", text: "星历" }));
  const yearNum = el("span", { cls: "tri-hud-year", text: "—" });
  yearRow.appendChild(yearNum);
  yearRow.appendChild(el("span", { cls: "tri-hud-year-suffix", text: "年" }));
  const eraRow = el("div", { cls: "tri-hud-era" });
  const eraChip = el("span", { cls: "tri-hud-era-chip", text: "E—" });
  const eraName = el("span", { cls: "tri-hud-era-name", text: "—" });
  const eraSub = el("span", { cls: "tri-hud-era-sub", text: "—" });
  append(eraRow, eraChip, eraName, eraSub);
  const eraNext = el("span", { cls: "tri-hud-era-next", text: "—" });
  append(chronoText, chronoKicker, yearRow, eraRow, eraNext);

  const eraDial = el("div", { cls: "tri-hud-eradial" });
  const eraArc = arcGauge({ className: "tri-hud-arc tri-hud-earc", ticks: 5, stroke: 4.6, label: "时代进度" });
  const eraDialNote = el("span", { cls: "tri-hud-eradial-note", text: "—" });
  append(eraDial, eraArc.el, eraDialNote);
  append(chrono, chronoText, eraDial);

  /* ---- 2) 人口 / 稳定度环形仪表 ---- */
  const stat = el("div", { cls: "tri-hud-stat" });
  const statKicker = el("span", { cls: "tri-hud-kicker", text: "// POPULATION & STABILITY" });
  const rings = el("div", { cls: "tri-hud-rings" });

  const popBox = el("div", { cls: "tri-hud-ringbox", attrs: { "data-ring": "population" } });
  const popArc = arcGauge({ className: "tri-hud-arc tri-hud-ring", ticks: 10, stroke: 5, label: "人口与住房覆盖" });
  const popMeta = el("div", { cls: "tri-hud-ringmeta" });
  const popGrowth = el("span", { cls: "tri-hud-pop-growth", text: "—" });
  const popSub = el("span", { cls: "tri-hud-sub", text: "住房 —" });
  append(popMeta, popGrowth, el("span", { cls: "tri-hud-ringdot" }), popSub);
  append(popBox, popArc.el, popMeta);

  const stabilityBox = el("div", { cls: "tri-hud-ringbox", attrs: { "data-ring": "stability" } });
  const stabilityArc = arcGauge({ className: "tri-hud-arc tri-hud-ring", ticks: 10, stroke: 5, label: "稳定度" });
  const stabilityMeta = el("div", { cls: "tri-hud-ringmeta" });
  const stabilityLabel = el("span", { cls: "tri-hud-stability-label", text: "—" });
  const stabilityFactors = el("span", { cls: "tri-hud-sub", text: "六项因子" });
  append(stabilityMeta, stabilityLabel, stabilityFactors);
  append(stabilityBox, stabilityArc.el, stabilityMeta);
  append(rings, popBox, stabilityBox);
  append(stat, statKicker, rings);

  /* ---- 3) 资源环形摘要 ---- */
  const resources = el("div", { cls: "tri-hud-resources" });
  const resKicker = el("span", { cls: "tri-hud-kicker", text: "// RESOURCE RING" });
  const resRow = el("div", { cls: "tri-hud-resringrow" });
  const resourceRows = new Map<string, HudResourceRow>();
  for (const id of HUD_RESOURCES) {
    const row = el("div", { cls: "tri-hud-res", attrs: { "data-resource": id, "data-ring": id } });
    const gauge = arcGauge({ className: "tri-hud-arc tri-hud-resarc", ticks: 5, stroke: 4.2, label: "资源储备比" });
    const info = el("div", { cls: "tri-hud-res-info" });
    const nameRow = el("div", { cls: "tri-hud-res-top" });
    const iconWrap = el("span", { cls: "tri-hud-res-icon" });
    iconWrap.appendChild(icon(resourceIconName(id), 12));
    const name = el("span", { cls: "tri-hud-res-name", text: "—" });
    append(nameRow, iconWrap, name);
    const value = el("span", { cls: "tri-hud-res-value", text: "—" });
    const net = el("span", { cls: "tri-hud-res-net", text: "—" });
    const lock = el("span", { cls: "tri-hud-res-lock tri-hidden", text: "" });
    append(info, nameRow, value, net, lock);
    append(row, gauge.el, info);
    resRow.appendChild(row);
    resourceRows.set(id, { root: row, name, value, net, lock, gauge, icon: iconWrap });
  }
  append(resources, resKicker, resRow);

  append(main, chrono, stat, resources);

  /* 警报色带（有警报时出现） */
  const alertBand = el("button", { cls: "tri-hud-alertband tri-hidden", attrs: { type: "button" } });
  alertBand.appendChild(el("span", { cls: "tri-hud-alertband-tag", text: "ALERT" }));
  const alertBandText = el("span", { cls: "tri-hud-alertband-text", text: "" });
  alertBand.appendChild(alertBandText);
  alertBand.appendChild(el("span", { cls: "tri-hud-alertband-more", text: "查看灾害档案 →" }));

  append(root, band, top, mobileSum, main, alertBand);

  subscriptions.push(on(alertBtn, "click", () => shell.setRightTab("hazards")));
  subscriptions.push(on(alertBand, "click", () => shell.setRightTab("hazards")));
  subscriptions.push(on(toggleBtn, "click", () => setExpanded(!root.classList.contains("is-expanded"))));

  let expanded = false;

  function setExpanded(next: boolean): void {
    expanded = next;
    root.classList.toggle("is-expanded", expanded);
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggleBtn.title = expanded ? "收起完整读数" : "展开完整读数";
    mobileSum.setAttribute("aria-hidden", expanded ? "true" : "false");
  }

  return {
    el: root,
    update(view) {
      const meta = view.meta;
      const era = view.civ.era;
      setText(mode, meta.difficultyName + " · " + meta.modeName);
      setText(runState, meta.paused ? "时间冻结" : "模拟运行");
      runState.dataset.paused = meta.paused ? "true" : "false";
      setText(bandTurn, "TURN " + String(meta.turn).padStart(3, "0"));
      setText(chronoKicker, "// STAR EPHEMERIS · 模拟 +" + meta.year.toFixed(2) + " 年");
      setText(yearNum, int(meta.calendarYear));
      setText(eraChip, "E" + era.value);
      eraChip.dataset.era = String(era.value);
      setText(eraName, era.name);
      setText(eraSub, era.subtitle || "");
      setText(eraNext, era.nextEraName
        ? "距 " + era.nextEraName + " 门槛 · " + pct(era.progress, 0) + "（" + era.nextThreshold + "）"
        : "已达最高时代 · 文明进入星际纪元");

      /* 时代进度弧：E1→E5 共 5 段，填充 = 历史时代数 + 当前时代进度 */
      const eraOverall = clamp01((era.value - 1 + era.progress) / 5);
      eraArc.update(eraOverall, {
        text: "E" + era.value,
        caption: pct(era.progress, 0),
        tone: era.canAdvance ? "ok" : "accent",
        marker: era.nextEraName ? era.value / 5 : null,
      });
      setText(eraDialNote, era.nextEraName ? "→ " + era.nextEraName : "最终时代");

      const population = view.civ.population;
      const housingRatio = clamp01(population.housingRatio);
      popArc.update(housingRatio, {
        text: num(population.total),
        caption: "人口",
        tone: housingRatio < 0.85 ? (housingRatio < 0.7 ? "danger" : "warn") : "accent",
        marker: 1,
      });
      setText(popGrowth, perYear(population.growthPerYear, 1));
      popGrowth.dataset.tone = population.growthPerYear >= 0 ? "ok" : "bad";
      setText(popSub, "住房 " + pct(population.housingRatio, 0));

      const stability = view.civ.stability;
      stabilityArc.update(clamp01(stability.value / 100), {
        text: num(stability.value, 0),
        caption: "稳定度",
        tone: STABILITY_TONE[stability.tone] ?? "accent",
      });
      setText(stabilityLabel, stability.label);
      stabilityBox.dataset.tone = STABILITY_TONE[stability.tone] ?? "accent";
      const factorCount = stability.factors.length;
      const positive = stability.factors.filter((factor) => factor.value >= 0).length;
      setText(stabilityFactors, positive + "/" + factorCount + " 因子为正");

      for (const resource of view.resources) {
        const row = resourceRows.get(resource.id);
        if (row) updateResourceRow(row, resource);
      }

      /* 移动端摘要行 */
      mobileYear.dataset.value = int(meta.calendarYear) + " 年";
      setText(mobileYear, int(meta.calendarYear) + " 年");
      setText(mobileTurn, "T" + String(meta.turn).padStart(3, "0"));
      setText(mobileEra, "E" + era.value + " " + era.name);
      setText(mobilePop, num(population.total));
      setText(mobileStability, num(stability.value, 0) + " " + stability.label);
      const food = view.resources.find((resource) => resource.id === "food");
      const energy = view.resources.find((resource) => resource.id === "energy");
      const science = view.resources.find((resource) => resource.id === "science");
      setText(
        mobileRes,
        "食 " + (food && !food.locked ? num(food.amount) : "—")
          + " · 能 " + (energy && !energy.locked ? num(energy.amount) : "E" + (energy?.unlockEra ?? "?"))
          + " · 研 " + (science && !science.locked ? num(science.amount) : "—"),
      );

      const alerts = view.alerts;
      const severity = alerts.some((alert) => alert.severity === "critical")
        ? "critical"
        : alerts.some((alert) => alert.severity === "warning")
          ? "warning"
          : alerts.some((alert) => alert.severity === "info")
            ? "info"
            : "idle";
      alertBtn.dataset.severity = severity;
      setText(alertCount, String(alerts.length));
      alertBtn.title = alerts.length === 0 ? "无警报" : alerts.slice(0, 3).map((alert) => "• " + alert.title).join("\n");
      const firstAlert = alerts[0];
      alertBand.classList.toggle("tri-hidden", !firstAlert);
      if (firstAlert) {
        alertBand.dataset.severity = firstAlert.severity;
        setText(alertBandText, firstAlert.title + " · " + firstAlert.detail);
      }
    },
    destroy() {
      for (const off of subscriptions.splice(0)) off();
    },
  };

  function updateResourceRow(row: HudResourceRow, resource: ResourceView): void {
    const locked = resource.locked === true;
    row.root.classList.toggle("is-locked", locked);
    row.root.dataset.resource = resource.id;
    setText(row.name, resource.name);
    if (locked) {
      row.gauge.update(0, { text: "E" + resource.unlockEra, caption: "锁定", tone: "muted" });
      setText(row.value, "");
      setText(row.net, "");
      setText(row.lock, "E" + resource.unlockEra + " 解锁");
      row.lock.classList.remove("tri-hidden");
      row.root.title = resource.name + " 将在 E" + resource.unlockEra + " 解锁";
      return;
    }
    row.lock.classList.add("tri-hidden");
    const ratio = clamp01(resource.ratio);
    row.gauge.update(ratio, {
      text: pct(ratio, 0),
      caption: resource.unit || "储备",
      tone: resource.critical ? "danger" : ratio < 0.15 ? "warn" : "accent",
    });
    setText(row.value, num(resource.amount) + (resource.unit ? " " + resource.unit : ""));
    setText(row.net, perYear(resource.net, 1));
    row.net.dataset.tone = resource.critical ? "danger" : resource.net >= 0 ? "ok" : "warn";
    row.root.dataset.critical = resource.critical ? "true" : "false";
    row.root.title = resource.name + "：" + num(resource.amount) + " / " + num(resource.capacity) + " " + resource.unit;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function summaryCell(parent: HTMLElement, label: string): HTMLElement {
  const cell = el("span", { cls: "tri-hud-mobilecell" });
  cell.appendChild(el("i", { cls: "tri-hud-mobilelabel", text: label }));
  const value = el("b", { cls: "tri-hud-mobilevalue", text: "—" });
  cell.appendChild(value);
  parent.appendChild(cell);
  return value;
}
