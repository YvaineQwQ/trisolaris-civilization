/** Left panel: era command deck, civilization overview, population, buildings, society. */
import type {
  AlertView,
  BuildingView,
  BuiltBuildingView,
  BuildingsView,
  FlowCostView,
  ObjectiveView,
  QueueView,
  ResourceView,
  ViewModel,
} from "../game/viewTypes";
import type { GameShell, LeftTab, ModalKind } from "./types";
import { append, clear, delegate, el, KeyedList, on, q, setClass, setText } from "./dom";
import { cornerArc, curvedScale, reserveRing } from "./curves";
import type { CurvedScaleHandle, ReserveRingHandle } from "./curves";
import { icon } from "./icons";
import { lineChart, meterBar, ringGauge, sparkline, toneForConfidence } from "./charts";
import type { LineChartHandle, MeterHandle, RingHandle, SparkHandle } from "./charts";
import { au, clamp01, int, num, pct, perYear, signed, temp } from "./format";
import { chip, divider, emptyBox, knowledgeFlag, kv, resourceIconName, section, statBig } from "./widgets";
import type { KvHandle } from "./widgets";
import { ART, artImage, setArtImage } from "./art";
import {
  eraEmblem,
  eraInfo,
  eraRail,
  eraTag,
  lockHint,
  outdatedBadge,
  queueKindInfo,
  requirementList,
  tierTicks,
} from "./era-ui";
import type { EraEmblemHandle, EraRailHandle, RequirementListHandle } from "./era-ui";

const LEFT_TABS: { id: LeftTab; label: string; icon: string }[] = [
  { id: "overview", label: "文明概况", icon: "chart" },
  { id: "population", label: "人口资源", icon: "people" },
  { id: "buildings", label: "建筑", icon: "build" },
  { id: "society", label: "社会状态", icon: "shield" },
];

interface Pane {
  el: HTMLElement;
  built: boolean;
  build: () => void;
  update: (view: ViewModel) => void;
}

export interface LeftPanelHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  setTab(tab: LeftTab): void;
  /** v1.3：左侧通高导航轨，内容以白纸抽屉浮出（不推挤主舞台）。 */
  toggleCollapsed(): void;
  openDrawer(): void;
  closeDrawer(): void;
  drawerOpen(): boolean;
  destroy(): void;
}

/** 导航轨底部的终端入口（全部连接真实模态与动作）。 */
const RAIL_TOOLS: { kind: ModalKind; label: string; icon: string }[] = [
  { kind: "politics", label: "政治终端", icon: "system" },
  { kind: "event", label: "事件档案", icon: "book" },
  { kind: "log", label: "事件日志", icon: "log" },
  { kind: "map", label: "星系地图", icon: "map" },
  { kind: "saves", label: "存档终端", icon: "save" },
  { kind: "settings", label: "显示设置", icon: "settings" },
  { kind: "help", label: "帮助与假设", icon: "help" },
];

export function createLeftPanel(shell: GameShell): LeftPanelHandle {
  /* 通高导航轨：只放图标，悬停向右浮出文字；内容以白纸抽屉浮出。 */
  const root = el("aside", { cls: "tri-panel tri-panel-left", attrs: { "aria-label": "文明导航轨" } });
  const subscriptions: (() => void)[] = [];
  let open = !shell.state.leftCollapsed;

  const rail = el("div", { cls: "tri-rail" });
  const brand = el("div", { cls: "tri-rail-brand", attrs: { title: "三体纪元 · TRISOLARIS: CIVILIZATION" } });
  brand.appendChild(el("span", { cls: "tri-rail-mark", text: "∴" }));
  brand.appendChild(el("span", { cls: "tri-rail-brand-meta", text: "TRISOLARIS" }));
  brand.appendChild(el("span", { cls: "tri-rail-brand-sub", text: "CIVILIZATION DOSSIER" }));

  const tabs = el("nav", { cls: "tri-rail-tabs", attrs: { role: "tablist", "aria-label": "文明档案" } });
  const tabButtons = new Map<LeftTab, HTMLButtonElement>();
  for (const tab of LEFT_TABS) {
    const button = el("button", {
      cls: "tri-nav-item",
      attrs: { type: "button", role: "tab", "data-tab": tab.id, title: tab.label, "aria-selected": "false" },
    });
    button.appendChild(el("span", { cls: "tri-nav-bar", attrs: { "aria-hidden": "true" } }));
    button.appendChild(icon(tab.icon, 20));
    button.appendChild(el("span", { cls: "tri-nav-flyout", text: tab.label }));
    tabs.appendChild(button);
    tabButtons.set(tab.id, button);
  }

  const tools = el("nav", { cls: "tri-rail-tools", attrs: { "aria-label": "终端入口" } });
  const toolButtons = new Map<ModalKind, HTMLButtonElement>();
  for (const tool of RAIL_TOOLS) {
    const button = el("button", {
      cls: "tri-nav-item tri-nav-item-tool",
      attrs: { type: "button", title: tool.label, "data-rail": tool.kind },
    });
    button.appendChild(icon(tool.icon, 17));
    button.appendChild(el("span", { cls: "tri-nav-flyout", text: tool.label }));
    tools.appendChild(button);
    toolButtons.set(tool.kind, button);
  }

  const railFoot = el("div", { cls: "tri-rail-foot", attrs: { "aria-hidden": "true" } });
  railFoot.appendChild(el("span", { text: "PRINT" }));
  railFoot.appendChild(el("span", { cls: "tri-rail-foot-ticks" }));

  append(rail, brand, tabs, el("span", { cls: "tri-rail-rule", attrs: { "aria-hidden": "true" } }), tools, railFoot);

  /* 白纸抽屉：标题栏 + 卷宗正文 + 页脚。 */
  const drawer = el("div", { cls: "tri-rail-drawer" });
  const head = el("header", { cls: "tri-panel-head tri-drawer-head" });
  const headTitle = el("div", { cls: "tri-panel-title tri-drawer-title" });
  const headKicker = el("span", { cls: "tri-drawer-kicker", text: "// CIVILIZATION DOSSIER" });
  const headText = el("span", { cls: "tri-drawer-title-text", text: "文明档案" });
  append(headTitle, headKicker, headText);
  const collapseBtn = el("button", { cls: "tri-btn tri-btn-icon tri-panel-collapse tri-drawer-close", attrs: { type: "button", title: "收起档案（5）" } });
  collapseBtn.appendChild(icon("close", 16));
  append(head, headTitle, collapseBtn);

  /* v1.4 移动端：白纸抽屉变成全屏档案页，页内提供页签与终端入口（桌面 CSS 隐藏）。 */
  const drawerTabs = el("nav", { cls: "tri-drawer-tabs", attrs: { role: "tablist", "aria-label": "文明档案页签" } });
  const drawerTabButtons = new Map<LeftTab, HTMLButtonElement>();
  for (const tab of LEFT_TABS) {
    const button = el("button", { cls: "tri-drawer-tab", attrs: { type: "button", "data-tab": tab.id, title: tab.label } });
    button.appendChild(icon(tab.icon, 16));
    button.appendChild(el("span", { text: tab.label }));
    drawerTabs.appendChild(button);
    drawerTabButtons.set(tab.id, button);
  }
  const drawerTools = el("nav", { cls: "tri-drawer-tools", attrs: { "aria-label": "终端入口" } });
  for (const tool of RAIL_TOOLS) {
    const button = el("button", { cls: "tri-drawer-tool", attrs: { type: "button", "data-rail": tool.kind, title: tool.label } });
    button.appendChild(icon(tool.icon, 15));
    button.appendChild(el("span", { text: tool.label }));
    drawerTools.appendChild(button);
  }
  /* 曲线分隔线：标记位置 = 当前档案页签序号（关系型刻度） */
  const drawerCurve = curvedScale({ width: 246, height: 18, ticks: 12, className: "tri-drawer-arc" });
  const drawerCurveWrap = el("div", { cls: "tri-drawer-curvewrap", attrs: { "aria-hidden": "true" } });
  drawerCurveWrap.appendChild(drawerCurve.el);

  const body = el("div", { cls: "tri-panel-body" });
  append(drawer, head, drawerTabs, drawerCurveWrap, drawerTools, body);
  root.append(rail, drawer);
  if (open) root.classList.add("is-open");

  const panes = new Map<LeftTab, Pane>();
  let active: LeftTab = shell.state.leftTab;

  registerPane("overview", buildOverview);
  registerPane("population", buildPopulation);
  registerPane("buildings", buildBuildings);
  registerPane("society", buildSociety);

  subscriptions.push(
    delegate(root, "[data-tab]", "click", (_ev, target) => {
      const tab = target.dataset.tab as LeftTab;
      if (!tab) return;
      setTab(tab);
      openDrawer();
    }),
  );
  subscriptions.push(
    delegate(root, "[data-rail]", "click", (_ev, target) => {
      const kind = target.dataset.rail as ModalKind | undefined;
      if (!kind) return;
      shell.openModal(kind);
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) closeDrawer();
    }),
  );
  subscriptions.push(on(collapseBtn, "click", () => closeDrawer()));
  subscriptions.push(
    delegate(root, "[data-action]", "click", (_ev, target) => {
      const action = target.dataset.action;
      const api = shell.api();
      if (!api) return;
      if (action === "cancel-build") {
        const jobId = Number(target.dataset.jobId);
        if (Number.isFinite(jobId)) {
          api.actions.cancelConstruction(jobId);
          shell.requestRefresh();
        }
      } else if (action === "open-build") {
        shell.openModal("build");
      } else if (action === "found-colony") {
        api.actions.foundColony();
        shell.requestRefresh();
      } else if (action === "build-planet-engine") {
        api.actions.buildPlanetEngine();
        shell.requestRefresh();
      } else if (action === "open-research") {
        shell.openModal("research");
      } else if (action === "upgrade-building") {
        const buildingId = target.dataset.buildingId;
        if (buildingId) {
          api.actions.upgradeBuilding(buildingId);
          shell.requestRefresh();
        }
      }
    }),
  );

  setTab(active);

  function registerPane(tab: LeftTab, builder: () => { el: HTMLElement; update: (view: ViewModel) => void }): void {
    const holder = el("div", { cls: "tri-pane", attrs: { "data-pane": tab, role: "tabpanel" } });
    if (tab !== active) holder.classList.add("tri-hidden");
    body.appendChild(holder);
    const pane: Pane = {
      el: holder,
      built: false,
      build: () => {
        const built = builder();
        holder.appendChild(built.el);
        pane.update = built.update;
        pane.built = true;
      },
      update: () => undefined,
    };
    panes.set(tab, pane);
  }

  function ensurePane(tab: LeftTab): Pane {
    const pane = panes.get(tab) as Pane;
    if (!pane.built) pane.build();
    return pane;
  }

  function setTab(tab: LeftTab): void {
    active = tab;
    shell.state.leftTab = tab;
    for (const [id, button] of tabButtons) {
      const isActive = id === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    for (const [id, pane] of panes) {
      pane.el.classList.toggle("tri-hidden", id !== tab);
    }
    const label = LEFT_TABS.find((item) => item.id === tab)?.label ?? "文明档案";
    setText(headText, label);
    let index = 0;
    for (let i = 0; i < LEFT_TABS.length; i += 1) if (LEFT_TABS[i].id === tab) index = i;
    for (const [id, button] of drawerTabButtons) button.classList.toggle("is-active", id === tab);
    drawerCurve.update((index + 1) / LEFT_TABS.length, { label: "档案页签 " + (index + 1) + "/" + LEFT_TABS.length });
    const view = shell.view();
    if (view) ensurePane(tab).update(view);
  }

  function openDrawer(): void {
    if (open) return;
    open = true;
    root.classList.add("is-open");
    shell.state.leftCollapsed = false;
    const view = shell.view();
    if (view) ensurePane(active).update(view);
  }

  function closeDrawer(): void {
    if (!open) return;
    open = false;
    root.classList.remove("is-open");
    shell.state.leftCollapsed = true;
    tabButtons.get(active)?.focus();
  }

  function toggleCollapsed(): void {
    if (open) closeDrawer();
    else openDrawer();
  }

  return {
    el: root,
    update(view) {
      ensurePane(active).update(view);
      const modal = shell.activeModal();
      for (const [kind, button] of toolButtons) button.classList.toggle("is-active", modal === kind);
      toolButtons.get("event")?.classList.toggle("is-alert", Boolean(view.events?.active));
    },
    setTab,
    toggleCollapsed,
    openDrawer,
    closeDrawer,
    drawerOpen: () => open,
    destroy() {
      for (const off of subscriptions.splice(0)) off();
    },
  };

  /* ------------------------------------------------------------------ *
   *  Overview pane: era command deck + timeline + requirements         *
   * ------------------------------------------------------------------ */
  function buildOverview(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });

    const eraCard = el("div", { cls: "tri-era-card tri-era-command" });
    const eraMedia = el("div", { cls: "tri-era-media", attrs: { "aria-hidden": "true" } });
    const eraArt = artImage(ART.era(1), "tri-era-art", "");
    eraMedia.appendChild(eraArt);
    eraCard.appendChild(eraMedia);
    const eraTop = el("div", { cls: "tri-era-top" });
    const eraIndex = el("span", { cls: "tri-era-index", text: "E—" });
    const eraName = el("span", { cls: "tri-era-name", text: "—" });
    const eraEmblemHandle: EraEmblemHandle = eraEmblem(44, "tri-era-emblem-svg");
    const eraEmblemBox = el("div", { cls: "tri-era-emblem" });
    eraEmblemBox.appendChild(eraEmblemHandle.el);
    append(eraTop, eraIndex, eraName, eraEmblemBox);
    const eraSub = el("div", { cls: "tri-era-subtitle", text: "—" });
    const eraDesc = el("p", { cls: "tri-era-desc", text: "" });
    const eraBar = meterBar("violet");
    eraBar.el.classList.add("tri-era-bar");
    const eraNext = el("div", { cls: "tri-era-next", text: "" });
    const rail: EraRailHandle = eraRail({ compact: true, className: "tri-era-rail-inline" });
    const unlockLabel = el("div", { cls: "tri-era-unlock-label", text: "本时代解锁" });
    const unlockSummary = el("p", { cls: "tri-era-unlock", text: "" });
    append(eraCard, eraTop, eraSub, eraDesc, eraBar.el, eraNext, rail.el, unlockLabel, unlockSummary);

    const reqSection = section("时代进程", { icon: "target", hint: "达成条件后自动进入下一时代", arc: true });
    const requirements: RequirementListHandle = requirementList();
    reqSection.body.appendChild(requirements.el);
    wrap.appendChild(eraCard);
    wrap.appendChild(reqSection.el);

    const statRow = el("div", { cls: "tri-stat-row tri-stat-row-split" });
    const population = statBig("人口总数", "—", "—");
    const stabilityBox = el("div", { cls: "tri-ring-box" });
    const stabilityRing = ringGauge({ size: 92, label: "稳定度" });
    const stabilityLabel = el("span", { cls: "tri-ring-caption", text: "—" });
    append(stabilityBox, stabilityRing.el, stabilityLabel);
    append(statRow, population.el, stabilityBox);
    wrap.appendChild(statRow);

    const factorsSection = section("稳定度分解", { icon: "shield", hint: "六项社会因子", arc: true });
    const factorList = el("div", { cls: "tri-factor-list" });
    factorsSection.body.appendChild(factorList);
    wrap.appendChild(factorsSection.el);
    const factorRows: { label: HTMLElement; meter: MeterHandle; value: HTMLElement }[] = [];

    const alertsSection = section("警报", { icon: "bell" });
    const alertsList = el("div", { cls: "tri-alert-list" });
    const alertsEmpty = emptyBox("暂无警报 · 保持观测");
    alertsSection.body.appendChild(alertsList);
    alertsSection.body.appendChild(alertsEmpty);
    const alertRows = new KeyedList<AlertView>(
      alertsList,
      (alert) => String(alert.id),
      createAlertRow,
      patchAlertRow,
    );
    wrap.appendChild(alertsSection.el);

    const objectiveSection = section("文明目标", { icon: "target", arc: true });
    const objectiveList = el("div", { cls: "tri-objective-list" });
    const objectiveEmpty = emptyBox("暂无公开目标");
    objectiveSection.body.appendChild(objectiveList);
    objectiveSection.body.appendChild(objectiveEmpty);
    const objectiveRows = new KeyedList<ObjectiveView>(
      objectiveList,
      (objective) => objective.id,
      createObjectiveRow,
      patchObjectiveRow,
    );
    wrap.appendChild(objectiveSection.el);

    const colonySection = section("殖民地方舟", { icon: "planet" });
    const colonyKv = kv("状态", "尚未建立殖民地");
    const colonyName = kv("名称", "—");
    const colonyLevel = kv("等级", "—");
    const colonyPop = kv("人口", "—");
    const colonyMeters = el("div", { cls: "tri-meter-rows" });
    const selfSuffRow = meterRowSmall("自给率");
    const integrityRow = meterRowSmall("结构完整度");
    append(colonyMeters, selfSuffRow.row, integrityRow.row);
    append(colonySection.body, colonyKv.el, colonyName.el, colonyLevel.el, colonyPop.el, colonyMeters);
    wrap.appendChild(colonySection.el);

    return {
      el: wrap,
      update(view) {
        const era = view.civ.era;
        setArtImage(eraArt, ART.era(era.value));
        setText(eraIndex, "E" + era.value);
        setText(eraName, era.name);
        setText(eraSub, (era.subtitle || eraInfo(era.value).subtitle) + " · " + eraInfo(era.value).name);
        setText(eraDesc, era.description);
        eraBar.update(era.progress, { tone: "violet" });
        eraEmblemHandle.update(era.value, era.progress);
        rail.update(era.value, era.progress);
        setText(
          eraNext,
          era.nextEraName
            ? "下一时代 " + era.nextEraName + " · " + pct(era.progress, 0) + " 条件达标 · 门槛 " + era.nextThreshold
            : "已达最终时代 · 文明走向星际",
        );
        setText(unlockSummary, era.unlockSummary || "—");
        requirements.update(era.requirements, era.nextEraName);
        const metCount = era.requirements.filter((requirement) => requirement.met).length;
        reqSection.setArc(
          era.requirements.length > 0 ? metCount / era.requirements.length : era.progress,
          era.canAdvance ? "ok" : "accent",
        );

        const civ = view.civ;
        population.set(num(civ.population.total), "增长 " + perYear(civ.population.growthPerYear, 1));
        const stabilityRatio = normalizeStability(civ.stability.value);
        stabilityRing.update(stabilityRatio, civ.stability.value.toFixed(civ.stability.value <= 1 ? 2 : 0), toneForConfidence(civ.stability.tone));
        setText(stabilityLabel, civ.stability.label);
        factorsSection.setArc(stabilityRatio, toneForConfidence(civ.stability.tone));

        ensureFactorRows(view);
        updateFactorRows(view);

        alertsEmpty.classList.toggle("tri-hidden", view.alerts.length > 0);
        alertRows.update(view.alerts);

        objectiveEmpty.classList.toggle("tri-hidden", view.objectives.length > 0);
        objectiveRows.update(view.objectives);
        const doneObjectives = view.objectives.filter((objective) => objective.complete).length;
        objectiveSection.setArc(
          view.objectives.length > 0 ? doneObjectives / view.objectives.length : 0,
          doneObjectives > 0 ? "ok" : "accent",
        );

        const colony = civ.colony;
        if (!colony) {
          colonyKv.set("尚未建立殖民地");
          colonyName.set("—", "muted");
          colonyLevel.set("—", "muted");
          colonyPop.set("—", "muted");
          selfSuffRow.meter.update(0);
          integrityRow.meter.update(0);
          setText(selfSuffRow.value, "—");
          setText(integrityRow.value, "—");
          colonyMeters.classList.add("tri-hidden");
        } else {
          colonyKv.set("已建立", "ok");
          colonyName.set(colony.name);
          colonyLevel.set("Lv." + colony.level);
          colonyPop.set(num(colony.population));
          selfSuffRow.meter.update(colony.selfSufficiency, { tone: colony.selfSufficiency > 0.6 ? "ok" : "warn" });
          integrityRow.meter.update(colony.integrity, { tone: colony.integrity > 0.6 ? "ok" : integrityTone(colony.integrity) });
          setText(selfSuffRow.value, pct(colony.selfSufficiency, 0));
          setText(integrityRow.value, pct(colony.integrity, 0));
          colonyMeters.classList.remove("tri-hidden");
        }
      },
    };

    function ensureFactorRows(view: ViewModel): void {
      if (factorRows.length > 0) return;
      for (const factor of view.civ.stability.factors) {
        const row = el("div", { cls: "tri-meter-row" });
        const label = el("span", { cls: "tri-meter-label", text: factor.label });
        const meter = meterBar("accent");
        const value = el("span", { cls: "tri-meter-value", text: "—" });
        append(row, label, meter.el, value);
        factorList.appendChild(row);
        factorRows.push({ label, meter, value });
      }
    }

    function updateFactorRows(view: ViewModel): void {
      const factors = view.civ.stability.factors;
      let maxAbs = 0.0001;
      for (const factor of factors) maxAbs = Math.max(maxAbs, Math.abs(factor.value));
      for (let i = 0; i < factors.length && i < factorRows.length; i += 1) {
        const factor = factors[i];
        const row = factorRows[i];
        setText(row.label, factor.label);
        const ratio = clamp01(Math.abs(factor.value) / maxAbs);
        row.meter.update(ratio, { tone: factor.value < 0 ? "danger" : ratio > 0.66 ? "ok" : "accent" });
        setText(row.value, formatFactor(factor.value));
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  Population pane                                                   *
   * ------------------------------------------------------------------ */
  function buildPopulation(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });

    const historySection = section("人口曲线", { icon: "people", hint: "模拟年 / 人口" });
    const historyChart: LineChartHandle = lineChart({
      width: 320,
      height: 128,
      series: [{ color: "#3fe0ff", fill: true }],
    });
    const historyCount = el("div", { cls: "tri-section-meta", text: "—" });
    historySection.body.appendChild(historyChart.el);
    historySection.body.appendChild(historyCount);
    wrap.appendChild(historySection.el);

    const stabilitySection = section("稳定度趋势", { icon: "shield" });
    const stabilitySpark: SparkHandle = sparkline({ width: 280, height: 44, color: "#4ef2b0", fill: true, zeroLine: true });
    stabilitySection.body.appendChild(stabilitySpark.el);
    wrap.appendChild(stabilitySection.el);

    const resourceSection = section("资源储备与净流量", { icon: "mineral", hint: "存量 / 容量 · 年流量", arc: true });
    const resourceRingBox = el("div", { cls: "tri-reserve-ringbox" });
    const resourceRing: ReserveRingHandle = reserveRing({ className: "tri-reserve-ring" });
    const resourceRingMeta = el("div", { cls: "tri-reserve-ringmeta", text: "外环 食物 · 中环 能源 · 内环 科研 · 环长 = 储备比" });
    append(resourceRingBox, resourceRing.el, resourceRingMeta);
    const resourceHint = el("div", { cls: "tri-resource-era-hint", text: "" });
    const resourceList = el("div", { cls: "tri-resource-list" });
    resourceSection.body.appendChild(resourceRingBox);
    resourceSection.body.appendChild(resourceHint);
    resourceSection.body.appendChild(resourceList);
    wrap.appendChild(resourceSection.el);
    const resourceRows = new Map<string, ResourceRow>();
    let resourceOrder = "";

    const jobsSection = section("劳动力与居住", { icon: "home" });
    const jobGrid = el("div", { cls: "tri-kv-grid" });
    const workforce = kv("劳动力", "—");
    const jobs = kv("就业岗位", "—");
    const employed = kv("在岗人口", "—");
    const unemployment = kv("失业率", "—");
    append(jobGrid, workforce.el, jobs.el, employed.el, unemployment.el);
    const housingRow = meterRowSmall("住房满足率");
    const employmentRow = meterRowSmall("岗位填充率");
    append(jobsSection.body, jobGrid, housingRow.row, employmentRow.row);
    wrap.appendChild(jobsSection.el);

    return {
      el: wrap,
      update(view) {
        const history = view.environment.populationHistory;
        const values = history.map((point) => point.population);
        const stabilityValues = history.map((point) => point.stability);
        historyChart.update([values], {
          xLabels:
            history.length > 0
              ? [Math.round(history[0].year) + " 年", Math.round(history[history.length - 1].year) + " 年"]
              : undefined,
        });
        historyCount.textContent =
          history.length > 0
            ? "样本 " + history.length + " · 当前 " + num(values[values.length - 1]) + " · 峰值 " + num(Math.max(...values))
            : "尚无人口历史样本";
        stabilitySpark.update(stabilityValues);

        const resources = view.resources;
        const idOrder = resources.map((resource) => resource.id).join(",");
        if (idOrder !== resourceOrder) {
          resourceOrder = idOrder;
          resourceRows.clear();
          clear(resourceList);
          for (const resource of resources) {
            const row = createResourceRow(resource);
            resourceList.appendChild(row.el);
            resourceRows.set(resource.id, row);
          }
        }
        for (const resource of resources) resourceRows.get(resource.id)?.update(resource);
        const locked = resources.filter((resource) => resource.locked === true);
        setText(
          resourceHint,
          locked.length > 0
            ? locked.map((resource) => resource.name + " · E" + (resource.unlockEra ?? 1) + " 解锁").join("   ")
            : "全部资源已由当前时代解锁",
        );
        resourceHint.classList.toggle("is-locked", locked.length > 0);

        const ringIds = ["food", "energy", "science"];
        const unlockedCount = resources.filter((resource) => !resource.locked).length;
        resourceRing.update(
          ringIds.map((id) => {
            const resource = resources.find((candidate) => candidate.id === id);
            if (!resource) return { id, short: id, label: id, fraction: 0, locked: true };
            return {
              id,
              short: resource.short,
              label: resource.name,
              fraction: resource.ratio,
              tone: resource.critical ? "danger" as const : resource.locked ? "muted" as const : "accent" as const,
              locked: resource.locked,
            };
          }),
          { centerText: String(unlockedCount), caption: "已解锁" },
        );
        resourceSection.setArc(
          resources.length > 0 ? clamp01(resources.reduce((sum, resource) => sum + (resource.locked ? 0 : resource.ratio), 0) / resources.length) : 0,
          "accent",
        );

        const population = view.civ.population;
        workforce.set(num(population.workforce));
        jobs.set(num(population.jobs));
        employed.set(num(population.employed));
        unemployment.set(pct(population.unemploymentRate, 1), population.unemploymentRate > 0.15 ? "warn" : "ok");
        housingRow.meter.update(population.housingRatio, {
          tone: population.housingRatio < 0.85 ? "warn" : "ok",
        });
        setText(housingRow.value, pct(population.housingRatio, 0));
        const jobRatio = population.jobs > 0 ? population.employed / population.jobs : 0;
        employmentRow.meter.update(jobRatio, { tone: jobRatio < 0.7 ? "warn" : "accent" });
        setText(employmentRow.value, pct(jobRatio, 0));
      },
    };
  }

  /* ------------------------------------------------------------------ *
   *  Buildings pane                                                    *
   * ------------------------------------------------------------------ */
  function buildBuildings(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });
    let latestBuildings: BuildingsView | null = null;

    const actions = el("div", { cls: "tri-pane-actions" });
    const openBuild = el("button", { cls: "tri-btn tri-btn-primary", attrs: { type: "button", "data-action": "open-build" } });
    openBuild.appendChild(icon("build", 16));
    openBuild.appendChild(el("span", { cls: "tri-btn-label", text: "打开建造终端" }));
    actions.appendChild(openBuild);
    wrap.appendChild(actions);

    const upgradeSummary = el("div", { cls: "tri-build-upgrade-summary", text: "—" });
    wrap.appendChild(upgradeSummary);

    const queueSection = section("施工队列", { icon: "clock", hint: "新建 / 升级 并行推进" });
    const queueList = el("div", { cls: "tri-queue-list" });
    const queueEmpty = emptyBox("队列空闲 · 工业产能可分配");
    queueSection.body.appendChild(queueList);
    queueSection.body.appendChild(queueEmpty);
    const queueRows = new KeyedList<QueueView>(queueList, (job) => String(job.jobId), createQueueRow, patchQueueRow);
    wrap.appendChild(queueSection.el);

    const builtSection = section("已建成建筑", { icon: "factory" });
    const builtList = el("div", { cls: "tri-built-grid" });
    const builtEmpty = emptyBox("尚无建筑 · 从建造终端开始");
    builtSection.body.appendChild(builtList);
    builtSection.body.appendChild(builtEmpty);
    const builtRows = new KeyedList<BuiltBuildingView>(builtList, (building) => building.id, createBuiltCard, patchBuiltCard);
    wrap.appendChild(builtSection.el);

    const maintenanceSection = section("维护开支", { icon: "bolt", hint: "每回合" });
    const maintenanceList = el("div", { cls: "tri-cost-list" });
    maintenanceSection.body.appendChild(maintenanceList);
    wrap.appendChild(maintenanceSection.el);
    let maintenanceKey = "";

    return {
      el: wrap,
      update(view) {
        const buildings = view.buildings;
        latestBuildings = buildings;
        queueEmpty.classList.toggle("tri-hidden", buildings.queue.length > 0);
        queueRows.update(buildings.queue);
        builtEmpty.classList.toggle("tri-hidden", buildings.built.length > 0);
        builtRows.update(buildings.built);
        const currentEra = buildings.currentEra ?? view.civ.era.value;
        setText(
          upgradeSummary,
          buildings.upgradableCount > 0
            ? "科技时代 E" + currentEra + " · " + buildings.upgradableCount + " 座旧时代建筑可升级（产出衰减中）"
            : "科技时代 E" + currentEra + " · 暂无待升级建筑",
        );
        upgradeSummary.dataset.tone = buildings.upgradableCount > 0 ? "warn" : "ok";

        const key = buildings.totalMaintenance.map((cost) => cost.resourceId + ":" + cost.amount.toFixed(2)).join("|");
        if (key !== maintenanceKey) {
          maintenanceKey = key;
          clear(maintenanceList);
          if (buildings.totalMaintenance.length === 0) {
            maintenanceList.appendChild(el("div", { cls: "tri-hint", text: "无需维护材料" }));
          } else {
            for (const cost of buildings.totalMaintenance) maintenanceList.appendChild(createCostRow(cost, true));
          }
        }
      },
    };

    function findBuildingView(id: string): BuildingView | null {
      if (!latestBuildings) return null;
      return latestBuildings.available.find((building) => building.id === id) ?? null;
    }

    function createBuiltCard(building: BuiltBuildingView): HTMLElement {
      const card = el("div", { cls: "tri-built-card", attrs: { title: building.description } });
      const iconWrap = el("span", { cls: "tri-built-icon" });
      iconWrap.appendChild(icon(building.icon || "build", 17));
      const text = el("div", { cls: "tri-built-text" });
      const top = el("div", { cls: "tri-built-top" });
      top.appendChild(el("span", { cls: "tri-built-name", text: building.name }));
      const eraSlot = el("span", { cls: "tri-built-era-slot" });
      top.appendChild(eraSlot);
      const desc = el("span", { cls: "tri-built-desc", text: building.description });
      const flags = el("div", { cls: "tri-built-flags" });
      const count = el("span", { cls: "tri-built-count", text: "×0" });
      const upgradeSlot = el("span", { cls: "tri-built-upgrade-slot" });
      append(text, top, desc, flags, upgradeSlot);
      append(card, iconWrap, text, count);
      return card;
    }

    function patchBuiltCard(node: HTMLElement, building: BuiltBuildingView): void {
      setText(q(node, ".tri-built-name"), building.name);
      setText(q(node, ".tri-built-desc"), building.description);
      setText(q(node, ".tri-built-count"), "×" + building.count);
      node.title = building.description;
      const def = findBuildingView(building.id);
      const eraSlot = q<HTMLElement>(node, ".tri-built-era-slot");
      if (eraSlot) {
        clear(eraSlot);
        if (def) {
          eraSlot.appendChild(eraTag(def.era));
          const ticks = tierTicks(def.tier);
          eraSlot.appendChild(ticks);
        }
      }
      const flags = q<HTMLElement>(node, ".tri-built-flags");
      if (flags) {
        clear(flags);
        if (def?.outdated) flags.appendChild(outdatedBadge(def.era));
      }
      const upgradeSlot = q<HTMLElement>(node, ".tri-built-upgrade-slot");
      if (upgradeSlot) {
        clear(upgradeSlot);
        if (def && def.upgradeToId && def.count > 0) {
          const row = el("div", { cls: "tri-built-upgrade" });
          const label = el("span", { cls: "tri-built-upgrade-label", text: "升级 → " + (def.upgradeToName ?? "下一层级") });
          const btn = el("button", {
            cls: "tri-btn tri-btn-primary tri-btn-xs",
            attrs: { type: "button", "data-action": "upgrade-building", "data-building-id": def.id },
          });
          btn.appendChild(icon("chevronUp", 12));
          btn.appendChild(el("span", { cls: "tri-btn-label", text: "升级" }));
          btn.disabled = !def.canUpgrade;
          btn.title = def.canUpgrade
            ? "升级 " + def.name + " → " + (def.upgradeToName ?? "下一层级") + " · " + def.upgradeTurns + " 回合"
            : def.upgradeBlockedReason ?? "条件不足";
          row.append(label, btn);
          upgradeSlot.appendChild(row);
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  Society pane                                                      *
   * ------------------------------------------------------------------ */
  function buildSociety(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });

    const eraSection = section("文明阶段", { icon: "calendar" });
    const eraGrid = el("div", { cls: "tri-kv-grid" });
    const eraName = kv("时代", "—");
    const eraDesc = kv("特征", "—");
    const modeHint = kv("模式", "—");
    append(eraGrid, eraName.el, eraDesc.el, modeHint.el);
    eraSection.body.appendChild(eraGrid);
    wrap.appendChild(eraSection.el);

    const factorSection = section("社会稳定因子", { icon: "shield", hint: "正值提升稳定" });
    const factorList = el("div", { cls: "tri-factor-list" });
    factorSection.body.appendChild(factorList);
    wrap.appendChild(factorSection.el);
    const factorRows: { label: HTMLElement; meter: MeterHandle; value: HTMLElement }[] = [];

    const colonySection = section("殖民地方舟", { icon: "planet" });
    const colonyStatus = el("div", { cls: "tri-colony-status" });
    const colonyEmpty = emptyBox("尚未建立殖民地");
    const colonyDetails = el("div", { cls: "tri-colony-details" });
    const colonyName = kv("名称", "—");
    const colonyLevel = kv("等级", "—");
    const colonyPop = kv("人口", "—");
    const selfRow = meterRowSmall("自给率");
    const integrityRow = meterRowSmall("结构完整度");
    append(colonyDetails, colonyName.el, colonyLevel.el, colonyPop.el, selfRow.row, integrityRow.row);
    const foundBtn = el("button", { cls: "tri-btn tri-btn-primary", attrs: { type: "button", "data-action": "found-colony" } });
    foundBtn.appendChild(icon("seedling", 15));
    foundBtn.appendChild(el("span", { cls: "tri-btn-label", text: "建立殖民地" }));
    const engineBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button", "data-action": "build-planet-engine" } });
    engineBtn.appendChild(icon("spaceship", 15));
    engineBtn.appendChild(el("span", { cls: "tri-btn-label", text: "建造行星发动机" }));
    const unlockNotes = el("div", { cls: "tri-unlock-notes" });
    append(colonySection.body, colonyStatus, colonyEmpty, colonyDetails, foundBtn, engineBtn, unlockNotes);
    wrap.appendChild(colonySection.el);

    const researchSection = section("科技路线", { icon: "research" });
    const activeTechText = el("div", { cls: "tri-active-tech", text: "当前没有进行中的研究" });
    const openResearch = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button", "data-action": "open-research" } });
    openResearch.appendChild(icon("research", 15));
    openResearch.appendChild(el("span", { cls: "tri-btn-label", text: "打开科技树" }));
    append(researchSection.body, activeTechText, openResearch);
    wrap.appendChild(researchSection.el);

    return {
      el: wrap,
      update(view) {
        const civ = view.civ;
        setText(eraName.valueNode, civ.era.name + " · E" + civ.era.value);
        setText(eraDesc.valueNode, civ.era.subtitle || civ.era.description);
        setText(modeHint.valueNode, view.meta.modeName + " · " + view.meta.modeHint);

        ensureFactors(view);
        const factors = civ.stability.factors;
        let maxAbs = 0.0001;
        for (const factor of factors) maxAbs = Math.max(maxAbs, Math.abs(factor.value));
        for (let i = 0; i < factors.length && i < factorRows.length; i += 1) {
          const factor = factors[i];
          setText(factorRows[i].label, factor.label);
          const ratio = clamp01(Math.abs(factor.value) / maxAbs);
          factorRows[i].meter.update(ratio, { tone: factor.value < 0 ? "danger" : ratio > 0.66 ? "ok" : "accent" });
          setText(factorRows[i].value, formatFactor(factor.value));
        }

        const colony = civ.colony;
        if (colony) {
          colonyEmpty.classList.add("tri-hidden");
          colonyStatus.textContent = "殖民地运转中 · 自给率 " + pct(colony.selfSufficiency, 0);
          colonyStatus.dataset.tone = colony.integrity < 0.4 ? "danger" : "ok";
          colonyDetails.classList.remove("tri-hidden");
          foundBtn.classList.add("tri-hidden");
          colonyName.set(colony.name);
          colonyLevel.set("Lv." + colony.level);
          colonyPop.set(num(colony.population));
          selfRow.meter.update(colony.selfSufficiency, { tone: colony.selfSufficiency > 0.6 ? "ok" : "warn" });
          setText(selfRow.value, pct(colony.selfSufficiency, 0));
          integrityRow.meter.update(colony.integrity, { tone: colony.integrity > 0.6 ? "ok" : "danger" });
          setText(integrityRow.value, pct(colony.integrity, 0));
        } else {
          colonyEmpty.classList.remove("tri-hidden");
          colonyDetails.classList.add("tri-hidden");
          foundBtn.classList.remove("tri-hidden");
          colonyStatus.textContent = civ.unlocks.colony ? "已具备建立殖民地的条件" : "尚未解锁殖民地科技";
          colonyStatus.dataset.tone = civ.unlocks.colony ? "ok" : "muted";
          setColonyActionState(foundBtn, civ.unlocks.colony, "需要推进航天学科技并达到相应时代");
        }
        setColonyActionState(
          engineBtn,
          civ.unlocks.planetEngine,
          "行星发动机需要航天学与能源学的高阶科技",
        );
        clear(unlockNotes);
        append(
          unlockNotes,
          knowledgeFlag(civ.unlocks.colony, "殖民地科技"),
          knowledgeFlag(civ.unlocks.planetEngine, "行星发动机"),
          knowledgeFlag(civ.unlocks.deepSpace, "深空航行"),
        );

        const active = civ.science.activeTechName;
        activeTechText.textContent =
          active != null
            ? "研究中：" + active + " · " + pct(civ.science.percent, 0) + (civ.science.etaTurns != null ? " · 预计 " + civ.science.etaTurns + " 回合" : "")
            : "当前没有进行中的研究 · 科研点数 +" + perYear(civ.science.rate, 2);
      },
    };

    function ensureFactors(view: ViewModel): void {
      if (factorRows.length > 0) return;
      for (const factor of view.civ.stability.factors) {
        const row = el("div", { cls: "tri-meter-row" });
        const label = el("span", { cls: "tri-meter-label", text: factor.label });
        const meter = meterBar("accent");
        const value = el("span", { cls: "tri-meter-value", text: "—" });
        append(row, label, meter.el, value);
        factorList.appendChild(row);
        factorRows.push({ label, meter, value });
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  Row factories                                                     *
   * ------------------------------------------------------------------ */
  function createAlertRow(alert: AlertView): HTMLElement {
    const row = el("div", { cls: "tri-alert", attrs: { "data-severity": alert.severity } });
    const iconWrap = el("span", { cls: "tri-alert-icon" });
    iconWrap.appendChild(icon(severityIcon(alert.severity), 14));
    const text = el("div", { cls: "tri-alert-text" });
    text.appendChild(el("div", { cls: "tri-alert-title", text: alert.title }));
    text.appendChild(el("div", { cls: "tri-alert-detail", text: alert.detail }));
    append(row, iconWrap, text);
    return row;
  }

  function patchAlertRow(node: HTMLElement, alert: AlertView): void {
    const previous = node.dataset.severity;
    node.dataset.severity = alert.severity;
    if (previous !== alert.severity) {
      const iconWrap = q(node, ".tri-alert-icon");
      if (iconWrap) {
        clear(iconWrap);
        iconWrap.appendChild(icon(severityIcon(alert.severity), 14));
      }
    }
    setText(q(node, ".tri-alert-title"), alert.title);
    setText(q(node, ".tri-alert-detail"), alert.detail);
  }

  function createObjectiveRow(objective: ObjectiveView): HTMLElement {
    const row = el("div", { cls: "tri-objective" });
    const head = el("div", { cls: "tri-objective-head" });
    const title = el("span", { cls: "tri-objective-title", text: objective.title });
    const state = el("span", { cls: "tri-objective-state", text: "—" });
    append(head, title, state);
    const detail = el("div", { cls: "tri-objective-detail", text: objective.detail });
    const meter = meterBar("accent");
    const meta = el("div", { cls: "tri-objective-meta", text: "—" });
    append(row, head, detail, meter.el, meta);
    return row;
  }

  function patchObjectiveRow(node: HTMLElement, objective: ObjectiveView): void {
    setText(q(node, ".tri-objective-title"), objective.title);
    setText(q(node, ".tri-objective-detail"), objective.detail);
    const state = q(node, ".tri-objective-state");
    if (state) {
      state.textContent = objective.complete ? "已完成" : "进行中";
      state.dataset.tone = objective.complete ? "ok" : "accent";
    }
    const ratio = objective.target > 0 ? clamp01(objective.progress / objective.target) : objective.complete ? 1 : 0;
    patchMeter(node, ratio, objective.complete ? "ok" : "accent");
    setText(
      q(node, ".tri-objective-meta"),
      num(objective.progress) + " / " + num(objective.target) + " · " + pct(ratio, 0),
    );
    setClass(node, "is-complete", objective.complete);
  }

  function createQueueRow(job: QueueView): HTMLElement {
    const row = el("div", { cls: "tri-queue-row" });
    const iconWrap = el("span", { cls: "tri-queue-icon" });
    iconWrap.appendChild(icon(job.icon || "build", 15));
    const main = el("div", { cls: "tri-queue-main" });
    const top = el("div", { cls: "tri-queue-top" });
    const kind = el("span", { cls: "tri-queue-kind" });
    top.appendChild(kind);
    top.appendChild(el("span", { cls: "tri-queue-name", text: job.name }));
    top.appendChild(el("span", { cls: "tri-queue-turns", text: "—" }));
    const meter = meterBar("warn");
    meter.el.classList.add("tri-queue-meter");
    const cancel = el("button", {
      cls: "tri-btn tri-btn-icon tri-btn-danger",
      attrs: { type: "button", title: "取消施工（返还部分资源）", "data-action": "cancel-build" },
    });
    cancel.appendChild(icon("close", 14));
    append(top, cancel);
    append(main, top, meter.el);
    append(row, iconWrap, main);
    return row;
  }

  function patchQueueRow(node: HTMLElement, job: QueueView): void {
    const info = queueKindInfo(job);
    node.dataset.kind = info.kind;
    const kind = q(node, ".tri-queue-kind");
    if (kind) {
      kind.textContent = info.label;
      kind.title = info.detail;
    }
    setText(q(node, ".tri-queue-name"), job.name);
    setText(q(node, ".tri-queue-turns"), "剩余 " + job.turnsLeft + " / " + job.totalTurns + " 回合");
    patchMeter(node, job.progress, "warn");
    const cancel = q<HTMLButtonElement>(node, "[data-action='cancel-build']");
    if (cancel) cancel.dataset.jobId = String(job.jobId);
    const iconWrap = q(node, ".tri-queue-icon");
    if (iconWrap && iconWrap.dataset.icon !== job.icon) {
      iconWrap.dataset.icon = job.icon;
      clear(iconWrap);
      iconWrap.appendChild(icon(job.icon || "build", 15));
    }
  }

  function createResourceRow(resource: ResourceView): ResourceRow {
    const row = el("div", { cls: "tri-resource-row", attrs: { "data-resource": resource.id, title: resource.description } });
    const reserveArc = cornerArc(clamp01(resource.ratio), resource.critical ? "danger" : "accent");
    const iconWrap = el("span", { cls: "tri-resource-icon" });
    iconWrap.appendChild(icon(resourceIconName(resource.id), 15));
    iconWrap.style.color = resource.color || "";
    const main = el("div", { cls: "tri-resource-main" });
    const top = el("div", { cls: "tri-resource-top" });
    const name = el("span", { cls: "tri-resource-name", text: resource.name });
    const stock = el("span", { cls: "tri-resource-stock", text: "—" });
    const lockSlot = el("span", { cls: "tri-resource-lock tri-hidden" });
    append(top, name, lockSlot, stock);
    const meterWrap = el("div", { cls: "tri-resource-meter" });
    const meter = meterBar("accent");
    meterWrap.appendChild(meter.el);
    const flows = el("div", { cls: "tri-resource-flows" });
    const produced = el("span", { cls: "tri-resource-prod", text: "—" });
    const consumed = el("span", { cls: "tri-resource-cons", text: "—" });
    const net = el("span", { cls: "tri-resource-net", text: "—" });
    append(flows, produced, consumed, net);
    append(main, top, meterWrap, flows);
    append(row, iconWrap, main, reserveArc.el);
    return {
      el: row,
      update: (next) => {
        const locked = next.locked === true;
        row.classList.toggle("is-locked", locked);
        if (locked) {
          setText(stock, "");
          setText(produced, "");
          setText(consumed, "");
          setText(net, "");
          lockSlot.classList.remove("tri-hidden");
          if (!lockSlot.firstChild) lockSlot.appendChild(lockHint(next.unlockEra));
          meter.update(0, { tone: "muted" });
          flows.classList.add("tri-hidden");
          reserveArc.update(0, "muted");
          return;
        }
        lockSlot.classList.add("tri-hidden");
        flows.classList.remove("tri-hidden");
        setText(stock, num(next.amount) + " / " + num(next.capacity) + " " + next.unit);
        meter.update(next.ratio, { tone: next.critical ? "danger" : next.ratio < 0.2 ? "warn" : "accent" });
        reserveArc.update(clamp01(next.ratio), next.critical ? "danger" : next.ratio < 0.2 ? "warn" : "accent");
        setText(produced, "产出 +" + num(next.produced, 1));
        setText(consumed, "消耗 −" + num(next.consumed, 1));
        setText(net, perYear(next.net, 2));
        net.dataset.tone = next.critical ? "danger" : next.net >= 0 ? "ok" : "warn";
        row.dataset.critical = next.critical ? "true" : "false";
      },
    };
  }

  function createCostRow(cost: FlowCostView, perTurn = false): HTMLElement {
    const row = el("div", { cls: "tri-cost-row" });
    row.appendChild(icon(resourceIconName(cost.resourceId), 14));
    row.appendChild(el("span", { cls: "tri-cost-name", text: cost.name }));
    const amount = el("span", { cls: "tri-cost-amount", text: (perTurn ? "−" : "") + num(cost.amount, 1) + (perTurn ? " /回合" : "") });
    if (!cost.affordable) amount.dataset.tone = "danger";
    row.appendChild(amount);
    if (!perTurn) row.appendChild(el("span", { cls: "tri-cost-have", text: "库存 " + num(cost.have) }));
    return row;
  }
}

interface ResourceRow {
  el: HTMLElement;
  update(resource: ResourceView): void;
}

function setColonyActionState(button: HTMLButtonElement, enabled: boolean, reason: string): void {
  button.disabled = !enabled;
  setClass(button, "is-locked", !enabled);
  if (enabled) {
    button.removeAttribute("title");
  } else {
    button.title = reason;
  }
}

function meterRowSmall(label: string): { row: HTMLElement; meter: MeterHandle; value: HTMLElement } {
  const row = el("div", { cls: "tri-meter-row" });
  row.appendChild(el("span", { cls: "tri-meter-label", text: label }));
  const meter = meterBar("accent");
  row.appendChild(meter.el);
  const value = el("span", { cls: "tri-meter-value", text: "—" });
  row.appendChild(value);
  return { row, meter, value };
}

function patchMeter(node: HTMLElement, ratio: number, tone: string): void {
  const meter = q<HTMLElement>(node, ".tri-meter");
  if (!meter) return;
  meter.dataset.tone = tone;
  const fill = q<HTMLElement>(meter, ".tri-meter-fill");
  if (fill) fill.style.width = (clamp01(ratio) * 100).toFixed(1) + "%";
}

export function normalizeStability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return clamp01(value);
  if (value <= 100) return clamp01(value / 100);
  return clamp01(value / 1000);
}

function integrityTone(value: number): "danger" | "warn" | "accent" {
  if (value < 0.3) return "danger";
  if (value < 0.6) return "warn";
  return "accent";
}

function formatFactor(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const text = abs >= 10 ? abs.toFixed(0) : abs.toFixed(2);
  return (value > 0 ? "+" : value < 0 ? "−" : "") + text;
}

function severityIcon(severity: AlertView["severity"]): string {
  switch (severity) {
    case "critical":
      return "alert";
    case "warning":
      return "alert";
    case "success":
      return "check";
    default:
      return "info";
  }
}
