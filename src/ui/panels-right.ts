/** Right panel: stars, environment, observation, prediction, technology, hazards. */
import type {
  CrisisView,
  DiscoveryView,
  EnvironmentView,
  FactionView,
  GameApi,
  HazardView,
  ObservationTaskOptionView,
  ObservationView,
  ObservedPlanetView,
  ObservedStarView,
  PoliticsView,
  PredictionStarView,
  PredictionView,
  TechBranchView,
  TechView,
  ViewModel,
  WarningView,
} from "../game/viewTypes";
import type { GameShell, RightTab } from "./types";
import { append, clear, delegate, el, KeyedList, on, q, setClass, setText } from "./dom";
import { icon } from "./icons";
import { lineChart, meterBar, sparkline, statTile, toneForConfidence } from "./charts";
import type { LineChartHandle, MeterHandle, SparkHandle } from "./charts";
import { au, clamp01, int, num, pct, perYear, signed, temp, years } from "./format";
import { cornerArc, curvedScale } from "./curves";
import type { CornerArcHandle, CurveTone, CurvedScaleHandle } from "./curves";
import { coordText, inclinationText, readPlanetCoords, readStarCoords } from "./coords";
import type { Coord3 } from "./coords";
import { chip, divider, emptyBox, knowledgeFlag, kv, resourceIconName, section } from "./widgets";
import { ART, artImage, setArtBackground, setArtImage } from "./art";
import { ERA_COUNT, currencyIcon, eraInfo, eraTag, lockHint } from "./era-ui";

type ObservationKind = ObservationTaskOptionView["kind"];
type StarTargetParam = Parameters<GameApi["actions"]["startObservation"]>[1];

const RIGHT_TABS: { id: RightTab; label: string; icon: string }[] = [
  { id: "stars", label: "恒星", icon: "star" },
  { id: "environment", label: "环境", icon: "thermometer" },
  { id: "observation", label: "观测", icon: "telescope" },
  { id: "prediction", label: "预测", icon: "target" },
  { id: "tech", label: "科技", icon: "research" },
  { id: "hazards", label: "灾害", icon: "alert" },
  { id: "politics", label: "政治", icon: "system" },
  { id: "events", label: "事件", icon: "book" },
];

interface Pane {
  el: HTMLElement;
  built: boolean;
  build: () => void;
  update: (view: ViewModel) => void;
}

export interface RightPanelHandle {
  el: HTMLElement;
  update(view: ViewModel): void;
  setTab(tab: RightTab): void;
  toggleCollapsed(): void;
  /** v1.4 移动端：右侧决策栏改为全屏页签抽屉。 */
  openDrawer(): void;
  closeDrawer(): void;
  drawerOpen(): boolean;
  destroy(): void;
}

export function createRightPanel(shell: GameShell): RightPanelHandle {
  const root = el("aside", { cls: "tri-panel tri-panel-right" });
  if (shell.state.rightCollapsed) root.classList.add("is-collapsed");
  const subscriptions: (() => void)[] = [];

  const head = el("header", { cls: "tri-panel-head tri-deck-head" });
  const headTitle = el("div", { cls: "tri-panel-title tri-deck-title" });
  headTitle.appendChild(el("span", { cls: "tri-deck-kicker", text: "// DECISION DECK · 指挥页" }));
  headTitle.appendChild(el("span", { cls: "tri-deck-name", text: "观测与决策" }));
  const headNote = el("span", { cls: "tri-deck-note", text: "仅显示已观测数据" });
  const collapseBtn = el("button", { cls: "tri-btn tri-btn-icon tri-panel-collapse tri-deck-collapse", attrs: { type: "button", title: "折叠右侧决策栏" } });
  collapseBtn.appendChild(icon("chevronRight", 15));
  append(head, headTitle, headNote, collapseBtn);

  const tabs = el("nav", { cls: "tri-tabs tri-tabs-right", attrs: { role: "tablist" } });
  const tabButtons = new Map<RightTab, HTMLButtonElement>();
  for (const tab of RIGHT_TABS) {
    const button = el("button", {
      cls: "tri-tab tri-tab-compact",
      attrs: { type: "button", role: "tab", "data-tab-right": tab.id, title: tab.label },
    });
    button.appendChild(icon(tab.icon, 15));
    button.appendChild(el("span", { text: tab.label }));
    tabs.appendChild(button);
    tabButtons.set(tab.id, button);
  }

  /* v1.4 曲线分隔线：标记位置 = 当前决策页签序号（关系型刻度，不是纯装饰）。 */
  const deckCurve: CurvedScaleHandle = curvedScale({ width: 300, height: 16, ticks: 8, className: "tri-deck-arc" });
  const deckCurveWrap = el("div", { cls: "tri-deck-curvewrap", attrs: { "aria-hidden": "true" } });
  deckCurveWrap.appendChild(deckCurve.el);

  const body = el("div", { cls: "tri-panel-body" });
  const foot = el("footer", { cls: "tri-panel-foot" });
  foot.appendChild(el("span", { text: "仅显示已观测数据 · 未观测保持未知" }));

  append(root, head, tabs, deckCurveWrap, body, foot);

  const panes = new Map<RightTab, Pane>();
  let active: RightTab = shell.state.rightTab;

  registerPane("stars", buildStars);
  registerPane("environment", buildEnvironment);
  registerPane("observation", buildObservation);
  registerPane("prediction", buildPrediction);
  registerPane("tech", buildTech);
  registerPane("hazards", buildHazards);
  registerPane("politics", buildPolitics);
  registerPane("events", buildEvents);

  subscriptions.push(
    delegate(root, "[data-tab-right]", "click", (_ev, target) => {
      const tab = target.dataset.tabRight as RightTab;
      if (tab) setTab(tab);
    }),
  );
  subscriptions.push(
    on(collapseBtn, "click", () => {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) {
        if (root.classList.contains("is-mobile-open")) closeDrawer();
        else openDrawer();
      } else {
        toggleCollapsed();
      }
    }),
  );
  subscriptions.push(
    delegate(root, "[data-action]", "click", (_ev, clicked) => {
      const api = shell.api();
      if (!api) return;
      const action = clicked.dataset.action;
      switch (action) {
        case "select-star": {
          const star = clicked.dataset.star;
          if (star === "A" || star === "B" || star === "C") api.actions.select(star);
          break;
        }
        case "select-planet":
          api.actions.select("planet");
          break;
        case "upgrade-observatory":
          api.actions.upgradeObservatory();
          shell.requestRefresh();
          break;
        case "cancel-observation":
          api.actions.cancelObservation();
          shell.requestRefresh();
          break;
        case "refresh-prediction":
          api.actions.refreshPrediction();
          shell.requestRefresh();
          break;
        case "start-observation": {
          const card = clicked.closest(".tri-obs-option") as HTMLElement | null;
          if (!card) return;
          const kind = card.dataset.kind as ObservationKind | undefined;
          if (!kind) return;
          const mode = card.dataset.targetMode;
          let observationTarget: StarTargetParam;
          if (mode === "star") {
            const select = q<HTMLSelectElement>(card, "select[data-obs-target]");
            const value = (select?.value ?? "A") as "A" | "B" | "C";
            observationTarget = value;
          } else if (mode === "planet") {
            observationTarget = "planet";
          } else {
            observationTarget = "all";
          }
          api.actions.startObservation(kind, observationTarget);
          shell.requestRefresh();
          break;
        }
        default:
          break;
      }
    }),
  );
  subscriptions.push(
    delegate(root, "[data-tech-action]", "click", (_ev, target) => {
      if (target.dataset.available !== "true") return;
      const techId = target.dataset.techId;
      const api = shell.api();
      if (!techId || !api) return;
      api.actions.startResearch(techId);
      shell.requestRefresh();
    }),
  );
  subscriptions.push(
    delegate(root, "[data-tech-branch-toggle]", "click", (_ev, target) => {
      const branch = target.closest(".tri-tech-branch");
      if (branch) branch.classList.toggle("is-collapsed");
    }),
  );
  subscriptions.push(
    delegate(root, "[data-event-choice]", "click", (_ev, target) => {
      const choiceId = target.dataset.eventChoice;
      const api = shell.api();
      if (!choiceId || !api) return;
      api.actions.resolveEvent(choiceId);
      shell.requestRefresh();
    }),
  );

  setTab(active);

  function registerPane(tab: RightTab, builder: () => { el: HTMLElement; update: (view: ViewModel) => void }): void {
    const holder = el("div", { cls: "tri-pane", attrs: { "data-pane-right": tab, role: "tabpanel" } });
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

  function ensurePane(tab: RightTab): Pane {
    const pane = panes.get(tab) as Pane;
    if (!pane.built) pane.build();
    return pane;
  }

  function setTab(tab: RightTab): void {
    active = tab;
    shell.state.rightTab = tab;
    for (const [id, button] of tabButtons) {
      const isActive = id === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    for (const [id, pane] of panes) pane.el.classList.toggle("tri-hidden", id !== tab);
    let index = 0;
    for (let i = 0; i < RIGHT_TABS.length; i += 1) if (RIGHT_TABS[i].id === tab) index = i;
    deckCurve.update((index + 1) / RIGHT_TABS.length, { label: "决策页签 " + (index + 1) + "/" + RIGHT_TABS.length });
    const view = shell.view();
    if (view) ensurePane(tab).update(view);
  }

  function toggleCollapsed(): void {
    const collapsed = !root.classList.contains("is-collapsed");
    root.classList.toggle("is-collapsed", collapsed);
    shell.state.rightCollapsed = collapsed;
    collapseBtn.title = collapsed ? "展开右侧面板" : "折叠右侧面板";
    clear(collapseBtn);
    collapseBtn.appendChild(icon(collapsed ? "chevronLeft" : "chevronRight", 15));
    if (!collapsed) {
      const view = shell.view();
      if (view) ensurePane(active).update(view);
    }
  }

  /** v1.4 移动端抽屉：全屏页签页的开合（桌面无副作用）。 */
  function openDrawer(): void {
    root.classList.add("is-mobile-open");
    if (shell.state.rightCollapsed) {
      shell.state.rightCollapsed = false;
      root.classList.remove("is-collapsed");
    }
    const view = shell.view();
    if (view) ensurePane(active).update(view);
  }

  function closeDrawer(): void {
    root.classList.remove("is-mobile-open");
  }

  const handle: RightPanelHandle = {
    el: root,
    update(view) {
      updateTabBadges(view);
      if (root.classList.contains("is-collapsed")) return;
      ensurePane(active).update(view);
    },
    setTab,
    toggleCollapsed,
    openDrawer,
    closeDrawer,
    drawerOpen: () => root.classList.contains("is-mobile-open"),
    destroy() {
      for (const off of subscriptions.splice(0)) off();
    },
  };

  /* ================================================================== *
   *  POLITICS / EVENTS (v1.3 档案页；数据未接入时安全降级)              *
   * ================================================================== */
  function setTabBadge(tab: RightTab, text: string): void {
    const button = tabButtons.get(tab);
    if (!button) return;
    if (text.length > 0) button.dataset.badge = text;
    else delete button.dataset.badge;
  }

  function updateTabBadges(view: ViewModel): void {
    const events = view.events;
    setTabBadge("events", events && events.active ? "!" : events && events.pendingCount > 0 ? String(events.pendingCount) : "");
    const politics = view.politics;
    setTabBadge("politics", politics && politics.tone === "crisis" ? "!" : "");
  }

  function buildPolitics(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack tri-politics-pane" });
    const summary = el("p", { cls: "tri-deck-lead", text: "联合政府档案尚未解封。" });
    const grid = el("div", { cls: "tri-deck-grid" });
    const cells = ["政治资本", "稳定修正", "部门席位", "派系格局"].map((label) => {
      const cell = el("div", { cls: "tri-deck-stat" });
      cell.appendChild(el("span", { cls: "tri-deck-stat-label", text: label }));
      const value = el("span", { cls: "tri-deck-stat-value", text: "—" });
      const sub = el("span", { cls: "tri-deck-stat-sub", text: "" });
      append(cell, value, sub);
      grid.appendChild(cell);
      return { value, sub };
    });
    const factionBox = el("div", { cls: "tri-faction-box" });
    const factionRows = new Map<string, { row: HTMLElement; infl: MeterHandle; sat: MeterHandle; label: HTMLElement }>();
    const archival = el("div", { cls: "tri-archival" });
    archival.appendChild(el("span", { cls: "tri-archival-kicker", text: "// ARCHIVE SEALED" }));
    archival.appendChild(el("p", { cls: "tri-archival-title", text: "联合政府档案尚未解封" }));
    archival.appendChild(
      el("p", {
        cls: "tri-archival-text",
        text: "六部门部长名录、派系关系与政治资本账目将在纪元政务模块接入后启封。当前文明仍以议事会形式运转：观测与工程优先，政治保持沉默。",
      }),
    );
    const hint = el("p", { cls: "tri-archival-hint", text: "档案接入后，此处将记录任免、调解与峰会。" });
    const openBar = el("div", { cls: "tri-deck-openbar" });
    const openPolitics = el("button", { cls: "tri-btn tri-btn-sm", attrs: { type: "button" } });
    openPolitics.appendChild(icon("system", 14));
    openPolitics.appendChild(el("span", { cls: "tri-btn-label", text: "打开政治终端" }));
    openPolitics.addEventListener("click", () => shell.openModal("politics"));
    openBar.appendChild(openPolitics);
    append(wrap, openBar, summary, grid, factionBox, archival, hint);

    function syncFactions(politics: PoliticsView): void {
      const seen = new Set<string>();
      for (const faction of politics.factions) {
        seen.add(faction.id);
        let row = factionRows.get(faction.id);
        if (!row) {
          const rowEl = el("div", { cls: "tri-faction-row" });
          rowEl.appendChild(el("span", { cls: "tri-faction-name", text: faction.name }));
          const infl = meterBar("accent");
          infl.el.classList.add("tri-faction-meter");
          const sat = meterBar("ok");
          sat.el.classList.add("tri-faction-meter");
          const label = el("span", { cls: "tri-faction-label", text: "" });
          append(rowEl, infl.el, sat.el, label);
          factionBox.appendChild(rowEl);
          row = { row: rowEl, infl, sat, label };
          factionRows.set(faction.id, row);
        }
        row.infl.update(faction.influence / 100, { tone: "accent" });
        const tone = faction.satisfactionTone === "good" ? "ok" : faction.satisfactionTone === "ok" ? "accent" : faction.satisfactionTone === "warn" ? "warn" : "danger";
        row.sat.update(faction.satisfaction / 100, { tone });
        setText(row.label, faction.satisfactionLabel);
      }
      for (const [id, row] of Array.from(factionRows.entries())) {
        if (seen.has(id)) continue;
        row.row.remove();
        factionRows.delete(id);
      }
    }

    return {
      el: wrap,
      update(view) {
        const politics = view.politics;
        const ready = politics != null;
        for (const node of [summary, grid, factionBox]) node.classList.toggle("tri-hidden", !ready);
        archival.classList.toggle("tri-hidden", ready);
        hint.classList.toggle("tri-hidden", ready);
        if (!politics) return;
        setText(summary, politics.summary);
        setText(cells[0].value, num(politics.capital, 1));
        setText(cells[0].sub, "每回合 " + signed(politics.capitalRate, 1));
        setText(cells[1].value, signed(politics.stabilityImpact, 1));
        setText(cells[1].sub, politics.stabilityImpactLabel);
        const staffed = politics.departments.filter((department) => department.minister != null).length;
        setText(cells[2].value, staffed + " / " + politics.departments.length);
        setText(cells[2].sub, politics.departments.some((department) => department.warning) ? "存在空缺或低效部门" : "六部运转正常");
        setText(cells[3].value, politics.factions.length + " 派");
        const dominant = politics.factions.slice().sort((a, b) => b.influence - a.influence)[0];
        setText(cells[3].sub, dominant ? dominant.name + "影响力最高" : "暂无派系记录");
        syncFactions(politics);
      },
    };
  }

  function buildEvents(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack tri-events-pane" });
    const activeBox = el("div", { cls: "tri-event-card" });
    const activeKicker = el("span", { cls: "tri-event-kicker", text: "" });
    const activeTitle = el("h3", { cls: "tri-event-title", text: "" });
    const activeShort = el("p", { cls: "tri-event-short", text: "" });
    const activeBody = el("p", { cls: "tri-event-body", text: "" });
    const choiceList = el("div", { cls: "tri-event-choices" });
    append(activeBox, activeKicker, activeTitle, activeShort, activeBody, choiceList);
    const empty = el("div", { cls: "tri-event-empty" });
    empty.appendChild(el("span", { cls: "tri-event-empty-kicker", text: "// NO PENDING FILE" }));
    empty.appendChild(el("p", { text: "纪元档案暂时平静。观测与建设将继续推进。" }));
    const historySection = section("事件纪年", { icon: "book", hint: "决策留痕" });
    const historyList = el("div", { cls: "tri-event-history" });
    historySection.body.appendChild(historyList);
    const modsBox = el("div", { cls: "tri-event-mods" });
    const archival = el("div", { cls: "tri-archival" });
    archival.appendChild(el("span", { cls: "tri-archival-kicker", text: "// ARCHIVE SEALED" }));
    archival.appendChild(el("p", { cls: "tri-archival-title", text: "事件档案尚未建卷" }));
    archival.appendChild(
      el("p", {
        cls: "tri-archival-text",
        text: "随机事件的插图、抉择与后果链将在纪元事件模块接入后归档。当前历史仍由观测记录与建造日志书写。",
      }),
    );
    const openBar = el("div", { cls: "tri-deck-openbar" });
    const openEvents = el("button", { cls: "tri-btn tri-btn-sm", attrs: { type: "button" } });
    openEvents.appendChild(icon("book", 14));
    openEvents.appendChild(el("span", { cls: "tri-btn-label", text: "打开事件档案" }));
    openEvents.addEventListener("click", () => shell.openModal("event"));
    openBar.appendChild(openEvents);
    append(wrap, openBar, activeBox, empty, modsBox, historySection.el, archival);

    return {
      el: wrap,
      update(view) {
        const events = view.events;
        const ready = events != null;
        archival.classList.toggle("tri-hidden", ready);
        if (!ready) {
          activeBox.classList.add("tri-hidden");
          empty.classList.add("tri-hidden");
          modsBox.classList.add("tri-hidden");
          historySection.el.classList.add("tri-hidden");
          return;
        }
        historySection.el.classList.remove("tri-hidden");
        const active = events.active;
        activeBox.classList.toggle("tri-hidden", active == null);
        empty.classList.toggle("tri-hidden", active != null);
        if (active) {
          setText(activeKicker, "// " + active.categoryName.toUpperCase() + " · 星历 " + Math.round(active.triggerYear));
          setText(activeTitle, active.title);
          setText(activeShort, active.short);
          setText(activeBody, active.body);
          clear(choiceList);
          for (const choice of active.choices) {
            const button = el("button", {
              cls: "tri-event-choice",
              attrs: { type: "button", "data-event-choice": choice.id },
            });
            button.appendChild(el("span", { cls: "tri-event-choice-label", text: choice.label }));
            if (choice.description) button.appendChild(el("span", { cls: "tri-event-choice-desc", text: choice.description }));
            if (choice.preview.length > 0) button.appendChild(el("span", { cls: "tri-event-choice-preview", text: choice.preview.join(" · ") }));
            if (choice.risk) button.appendChild(el("span", { cls: "tri-event-choice-risk", text: choice.risk }));
            if (!choice.available) {
              button.disabled = true;
              button.title = choice.unavailableReason ?? "当前条件不满足";
            }
            choiceList.appendChild(button);
          }
        }
        clear(modsBox);
        for (const modifier of events.modifiers) {
          const chipNode = el("span", { cls: "tri-event-mod", attrs: { "data-tone": modifier.tone } });
          chipNode.appendChild(el("span", { text: modifier.label }));
          chipNode.appendChild(el("b", { text: "×" + modifier.multiplier.toFixed(2) }));
          modsBox.appendChild(chipNode);
        }
        modsBox.classList.toggle("tri-hidden", events.modifiers.length === 0);
        clear(historyList);
        for (const entry of events.history.slice(0, 5)) {
          const row = el("div", { cls: "tri-event-history-row" });
          row.appendChild(el("span", { cls: "tri-event-history-year", text: "星历 " + Math.round(entry.year) }));
          const body = el("div", { cls: "tri-event-history-body" });
          body.appendChild(el("span", { cls: "tri-event-history-title", text: entry.title }));
          body.appendChild(el("span", { cls: "tri-event-history-choice", text: "抉择：" + entry.choiceLabel }));
          row.appendChild(body);
          historyList.appendChild(row);
        }
        if (events.history.length === 0) {
          historyList.appendChild(el("p", { cls: "tri-archival-hint", text: "尚未有事件被记入历史。" }));
        }
      },
    };
  }

  /* ================================================================== *
   *  STARS                                                             *
   * ================================================================== */
  function buildStars(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });
    const starSection = section("恒星观测档案", { icon: "star", hint: "点击卡片选中" });
    const starList = el("div", { cls: "tri-star-list" });
    const starEmpty = emptyBox("尚未获得任何恒星观测数据");
    starSection.body.appendChild(starList);
    starSection.body.appendChild(starEmpty);
    wrap.appendChild(starSection.el);
    const starRows = new KeyedList<ObservedStarView>(starList, (star) => star.id, createStarCard, patchStarCard);

    const planetSection = section("母星观测", { icon: "planet" });
    const planetList = el("div", { cls: "tri-planet-list" });
    const planetEmpty = emptyBox("尚未对母星进行系统观测");
    planetSection.body.appendChild(planetList);
    planetSection.body.appendChild(planetEmpty);
    wrap.appendChild(planetSection.el);
    let planetCard: PlanetCard | null = null;

    return {
      el: wrap,
      update(view) {
        const observation = view.observation;
        starEmpty.classList.toggle("tri-hidden", observation.stars.length > 0);
        starRows.update(observation.stars);
        for (const star of observation.stars) {
          const node = q<HTMLElement>(starList, '[data-key="' + star.id + '"]');
          if (node) setClass(node, "is-selected", view.selection === star.id);
        }
        planetEmpty.classList.toggle("tri-hidden", observation.planet != null);
        if (observation.planet) {
          if (!planetCard) {
            planetCard = createPlanetCard(observation.planet);
            planetList.appendChild(planetCard.el);
          }
          planetCard.update(observation.planet);
          setClass(planetCard.el, "is-selected", view.selection === "planet");
        }
      },
    };
  }

  function createStarCard(star: ObservedStarView): HTMLElement {
    const card = el("div", { cls: "tri-star-card", attrs: { "data-star": star.id, title: "点击选中 " + star.name } });
    const head = el("div", { cls: "tri-star-head" });
    const thumbWrap = el("span", { cls: "tri-star-thumb-wrap" });
    thumbWrap.style.borderColor = star.color;
    thumbWrap.appendChild(artImage(ART.star(star.id), "tri-star-thumb", star.name + " 恒星图像"));
    head.appendChild(thumbWrap);
    head.appendChild(el("span", { cls: "tri-star-name", text: star.name }));
    head.appendChild(el("span", { cls: "tri-star-id", text: star.id }));
    const badge = el("span", { cls: "tri-badge tri-star-confidence", text: "—" });
    head.appendChild(badge);
    card.appendChild(head);

    const confMeter = meterBar("accent");
    confMeter.el.classList.add("tri-star-meter");
    card.appendChild(confMeter.el);
    const confArc = cornerArc(clamp01(star.confidence), toneForConfidence(star.confidenceTone));
    card.appendChild(confArc.el);

    const flags = el("div", { cls: "tri-flag-row" });
    for (const [key, label] of FLAG_LABELS) {
      const flag = el("span", { cls: "tri-flag is-unknown", text: "— " + label, attrs: { "data-flag": key } });
      flags.appendChild(flag);
    }
    card.appendChild(flags);

    const values = el("div", { cls: "tri-star-values" });
    for (const [field, label] of STAR_FIELDS) {
      const row = kv(label).el;
      row.dataset.field = field;
      values.appendChild(row);
    }
    card.appendChild(values);
    const fields = new Map<string, HTMLElement>();
    for (const [field] of STAR_FIELDS) {
      const node = q<HTMLElement>(values, '[data-field="' + field + '"] .tri-kv-value');
      if (node) fields.set(field, node);
    }

    const coords = createCoordStrip();
    card.appendChild(coords.el);

    // Store handles on the node for the patch pass.
    cardHandles.set(card, { confMeter, badge, fields, coords, confArc });
    return card;
  }

  function patchStarCard(node: HTMLElement, star: ObservedStarView): void {
    const handles = cardHandles.get(node);
    setText(q(node, ".tri-star-name"), star.name);
    setText(q(node, ".tri-star-id"), star.id);
    if (handles) {
      handles.confMeter.update(star.confidence, { tone: toneForConfidence(star.confidenceTone) });
      handles.confArc.update(clamp01(star.confidence), toneForConfidence(star.confidenceTone));
      setText(handles.badge, star.confidenceLabel + " " + pct(star.confidence, 0));
      handles.badge.dataset.tone = star.confidenceTone;
      const known = star.known;
      for (const [key, label] of FLAG_LABELS) {
        const flag = q(node, '[data-flag="' + key + '"]');
        if (!flag) continue;
        const value = known[key as keyof typeof known];
        flag.className = "tri-flag " + (value ? "is-known" : "is-unknown");
        flag.textContent = (value ? "✓ " : "— ") + label;
      }
      handles.fields.get("distance") && setText(handles.fields.get("distance"), star.distance == null ? "— 未观测" : au(star.distance));
      handles.fields.get("speed") && setText(handles.fields.get("speed"), star.speed == null ? "— 未观测" : num(star.speed, 2) + " AU/年");
      handles.fields.get("mass") && setText(handles.fields.get("mass"), star.mass == null ? "— 未观测" : star.mass.toFixed(3) + " M☉");
      handles.fields.get("eccentricity") && setText(handles.fields.get("eccentricity"), star.eccentricity == null ? "— 未观测" : star.eccentricity.toFixed(3));
      handles.fields.get("sigmaPos") && setText(handles.fields.get("sigmaPos"), star.sigmaPos == null ? "—" : "±" + star.sigmaPos.toFixed(4) + " AU");
      handles.fields.get("sigmaVel") && setText(handles.fields.get("sigmaVel"), star.sigmaVel == null ? "—" : "±" + star.sigmaVel.toFixed(3));
      handles.fields.get("relation") && setText(handles.fields.get("relation"), star.relationToPlanetAU == null ? "— 未观测" : au(star.relationToPlanetAU));
      handles.fields.get("samples") && setText(handles.fields.get("samples"), int(star.sampleCount) + " 组");
      handles.fields.get("lastYear") && setText(handles.fields.get("lastYear"), star.lastMeasuredYear > 0 ? "星历 " + Math.round(star.lastMeasuredYear) : "— 未测量");
      handles.fields.get("height") &&
        setText(handles.fields.get("height"), star.known.position ? coordText(star.height) + " AU" : "— 未观测");
      handles.fields.get("inclination") && setText(handles.fields.get("inclination"), inclinationText(star.inclination));
      handles.coords.update(readStarCoords(star));
    }
    setClass(node, "is-selected", false);
  }

  const cardHandles = new WeakMap<HTMLElement, {
    confMeter: MeterHandle;
    badge: HTMLElement;
    fields: Map<string, HTMLElement>;
    coords: CoordStrip;
    confArc: CornerArcHandle;
  }>();

  function createPlanetCard(planet: ObservedPlanetView): PlanetCard {
    const card = el("div", { cls: "tri-star-card tri-planet-card", attrs: { "data-planet": "true", title: "点击选中母星" } });
    const head = el("div", { cls: "tri-star-head" });
    const thumbWrap = el("span", { cls: "tri-star-thumb-wrap tri-star-thumb-planet" });
    thumbWrap.appendChild(artImage(ART.planet, "tri-star-thumb", "母星图像"));
    head.appendChild(thumbWrap);
    head.appendChild(el("span", { cls: "tri-star-name", text: "母星" }));
    const badge = el("span", { cls: "tri-badge", text: "—" });
    head.appendChild(badge);
    card.appendChild(head);
    const confMeter = meterBar("accent");
    confMeter.el.classList.add("tri-star-meter");
    card.appendChild(confMeter.el);
    const planetArc = cornerArc(clamp01(planet.confidence), toneForConfidence(planet.confidence > 0.7 ? "good" : planet.confidence > 0.45 ? "ok" : planet.confidence > 0.25 ? "warn" : "bad"));
    card.appendChild(planetArc.el);

    const values = el("div", { cls: "tri-star-values" });
    const fields = new Map<string, HTMLElement>();
    for (const [field, label] of PLANET_FIELDS) {
      const row = kv(label).el;
      row.dataset.field = field;
      values.appendChild(row);
      fields.set(field, q<HTMLElement>(row, ".tri-kv-value") as HTMLElement);
    }
    card.appendChild(values);
    const coords = createCoordStrip();
    card.appendChild(coords.el);
    const habitRow = el("div", { cls: "tri-meter-row" });
    habitRow.appendChild(el("span", { cls: "tri-meter-label", text: "宜居度" }));
    const habitMeter = meterBar("ok");
    habitRow.appendChild(habitMeter.el);
    const habitValue = el("span", { cls: "tri-meter-value", text: "—" });
    habitRow.appendChild(habitValue);
    card.appendChild(habitRow);

    const planetCard: PlanetCard = {
      el: card,
      update(next: ObservedPlanetView) {
        const nextTone = toneForConfidence(next.confidence > 0.7 ? "good" : next.confidence > 0.45 ? "ok" : next.confidence > 0.25 ? "warn" : "bad");
        confMeter.update(next.confidence, { tone: nextTone });
        planetArc.update(clamp01(next.confidence), nextTone);
        setText(badge, "置信 " + pct(next.confidence, 0));
        setField(fields, "distance", next.distanceFromPrimary == null ? "— 未观测" : au(next.distanceFromPrimary));
        setField(fields, "temp", next.tempC == null ? "— 未观测" : temp(next.tempC));
        setField(fields, "orbit", next.orbitRadius == null ? "— 未观测" : au(next.orbitRadius));
        setField(fields, "eccentricity", next.eccentricity == null ? "— 未观测" : next.eccentricity.toFixed(3));
        setField(fields, "sigma", next.sigmaPos == null ? "—" : "±" + next.sigmaPos.toFixed(4) + " AU");
        setField(fields, "lastYear", next.lastMeasuredYear > 0 ? "星历 " + Math.round(next.lastMeasuredYear) : "—");
        setField(fields, "height", coordText(next.height) + " AU");
        setField(fields, "inclination", inclinationText(next.inclination));
        habitMeter.update(next.habitability ?? 0, { tone: (next.habitability ?? 0) > 0.5 ? "ok" : "warn" });
        setText(habitValue, next.habitability == null ? "未观测" : pct(next.habitability, 0));
        coords.update(readPlanetCoords(next));
      },
    };
    return planetCard;
  }

  /* ================================================================== *
   *  ENVIRONMENT                                                       *
   * ================================================================== */
  function buildEnvironment(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });
    const env = new EnvironmentReadout();
    wrap.appendChild(env.el);
    return { el: wrap, update: (view) => env.update(view.environment) };
  }

  class EnvironmentReadout {
    readonly el: HTMLElement;
    private readonly tempValue: HTMLElement;
    private readonly tempTrend: HTMLElement;
    private readonly weatherChip: HTMLElement;
    private readonly stressLabel: HTMLElement;
    private readonly equilibrium: HTMLElement;
    private readonly tempChart: LineChartHandle;
    private readonly fluxSpark: SparkHandle;
    private readonly habitMeter: MeterHandle;
    private readonly habitValue: HTMLElement;
    private readonly ecologyMeter: MeterHandle;
    private readonly ecologyValue: HTMLElement;
    private readonly waterMeter: MeterHandle;
    private readonly waterValue: HTMLElement;
    private readonly atmoMeter: MeterHandle;
    private readonly atmoValue: HTMLElement;
    private readonly fluxValue: HTMLElement;
    private readonly anomalyValue: HTMLElement;
    private readonly albedoValue: HTMLElement;
    private readonly greenhouseValue: HTMLElement;

    constructor() {
      const wrap = el("div", { cls: "tri-pane-stack" });
      const hero = el("div", { cls: "tri-env-hero" });
      const tempBox = el("div", { cls: "tri-env-temp" });
      tempBox.appendChild(el("span", { cls: "tri-env-temp-label", text: "地表温度" }));
      this.tempValue = el("span", { cls: "tri-env-temp-value", text: "—" });
      this.tempTrend = el("span", { cls: "tri-env-temp-trend", text: "—" });
      append(tempBox, this.tempValue, this.tempTrend);
      const statusBox = el("div", { cls: "tri-env-status" });
      this.weatherChip = el("span", { cls: "tri-chip", text: "—" });
      this.stressLabel = el("span", { cls: "tri-env-stress", text: "—" });
      append(statusBox, this.weatherChip, this.stressLabel);
      append(hero, tempBox, statusBox);
      wrap.appendChild(hero);

      const chartSection = section("温度历史", { icon: "thermometer", hint: "地表温度 / 平衡温度" });
      this.tempChart = lineChart({
        width: 320,
        height: 128,
        series: [
          { color: "#ffc857", fill: false, width: 1.8 },
          { color: "#5ad2ff", dashed: true, width: 1.2 },
        ],
      });
      chartSection.body.appendChild(this.tempChart.el);
      this.equilibrium = el("div", { cls: "tri-section-meta", text: "—" });
      chartSection.body.appendChild(this.equilibrium);
      wrap.appendChild(chartSection.el);

      const ecologySection = section("宜居与生态", { icon: "seedling" });
      this.habitMeter = meterBar("ok");
      this.habitValue = el("span", { cls: "tri-meter-value", text: "—" });
      this.ecologyMeter = meterBar("accent");
      this.ecologyValue = el("span", { cls: "tri-meter-value", text: "—" });
      this.waterMeter = meterBar("accent");
      this.waterValue = el("span", { cls: "tri-meter-value", text: "—" });
      this.atmoMeter = meterBar("accent");
      this.atmoValue = el("span", { cls: "tri-meter-value", text: "—" });
      append(
        ecologySection.body,
        meterLine("综合宜居度", this.habitMeter, this.habitValue),
        meterLine("生态健康", this.ecologyMeter, this.ecologyValue),
        meterLine("液态水储量", this.waterMeter, this.waterValue),
        meterLine("大气密度", this.atmoMeter, this.atmoValue),
      );
      wrap.appendChild(ecologySection.el);

      const fluxSection = section("辐照与大气", { icon: "sun" });
      this.fluxSpark = sparkline({ width: 280, height: 40, color: "#ffb347", fill: true, zeroLine: true });
      fluxSection.body.appendChild(this.fluxSpark.el);
      const fluxGrid = el("div", { cls: "tri-kv-grid" });
      const fluxRow = kv("当前辐照", "—");
      this.fluxValue = rowValue(fluxRow);
      const anomalyRow = kv("辐照异常", "—");
      this.anomalyValue = rowValue(anomalyRow);
      const albedoRow = kv("反照率", "—");
      this.albedoValue = rowValue(albedoRow);
      const greenhouseRow = kv("温室效应", "—");
      this.greenhouseValue = rowValue(greenhouseRow);
      append(fluxGrid, fluxRow.el, anomalyRow.el, albedoRow.el, greenhouseRow.el);
      fluxSection.body.appendChild(fluxGrid);
      wrap.appendChild(fluxSection.el);

      this.el = wrap;
    }

    update(view: EnvironmentView): void {
      setText(this.tempValue, temp(view.tempC));
      setText(this.tempTrend, (view.tempTrend >= 0 ? "↑ " : "↓ ") + signed(view.tempTrend, 2) + " °C/年");
      this.tempTrend.dataset.tone = view.tempTrend > 0.5 ? "warn" : view.tempTrend < -0.5 ? "danger" : "ok";
      setText(this.weatherChip, view.weatherLabel);
      this.weatherChip.dataset.weather = view.weather;
      setText(this.stressLabel, view.stressLabel);
      const tempSeries = view.history.map((point) => point.tempC);
      const fluxSeries = view.history.map((point) => point.flux);
      this.tempChart.update([tempSeries], {
        xLabels:
          view.history.length > 0
            ? [Math.round(view.history[0].year) + " 年", Math.round(view.history[view.history.length - 1].year) + " 年"]
            : undefined,
      });
      setText(this.equilibrium, "平衡温度 " + temp(view.equilibriumTempC) + " · 温室 " + signed(view.greenhouseK, 1) + " K");
      this.habitMeter.update(view.habitability, { tone: view.habitability > 0.55 ? "ok" : view.habitability > 0.3 ? "warn" : "danger" });
      setText(this.habitValue, pct(view.habitability, 0));
      this.ecologyMeter.update(view.ecology, { tone: view.ecology > 0.5 ? "ok" : view.ecology > 0.25 ? "warn" : "danger" });
      setText(this.ecologyValue, pct(view.ecology, 0));
      this.waterMeter.update(clamp01(view.water), { tone: "accent" });
      setText(this.waterValue, pct(view.water, 0));
      this.atmoMeter.update(clamp01(view.atmosphere), { tone: "accent" });
      setText(this.atmoValue, pct(view.atmosphere, 0));
      setText(this.fluxValue, num(view.flux, 2) + " S☉");
      setText(this.anomalyValue, signed(view.fluxAnomaly * 100, 1) + "%");
      setText(this.albedoValue, view.albedo.toFixed(2));
      setText(this.greenhouseValue, signed(view.greenhouseK, 1) + " K");
      this.fluxSpark.update(fluxSeries);
    }
  }

  /* ================================================================== *
   *  OBSERVATION                                                       *
   * ================================================================== */
  function buildObservation(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });

    const observatorySection = section("观测站", { icon: "telescope" });
    const obsHead = el("div", { cls: "tri-obs-head" });
    const obsLevel = el("span", { cls: "tri-obs-level", text: "Lv.0" });
    const obsName = el("span", { cls: "tri-obs-name", text: "—" });
    const obsData = el("span", { cls: "tri-badge", text: "数据点 —" });
    append(obsHead, obsLevel, obsName, obsData);
    const obsDesc = el("p", { cls: "tri-hint", text: "—" });
    const obsCaps = el("div", { cls: "tri-chip-row" });
    const obsMeta = el("div", { cls: "tri-kv-grid" });
    const equipRow = kv("观测设备", "—");
    const efficiencyRow = kv("观测效率", "—");
    append(obsMeta, equipRow.el, efficiencyRow.el);
    const upgradeBox = el("div", { cls: "tri-upgrade-box" });
    const upgradeTitle = el("div", { cls: "tri-upgrade-title", text: "升级观测站" });
    const upgradeDesc = el("p", { cls: "tri-hint", text: "—" });
    const upgradeCosts = el("div", { cls: "tri-cost-list" });
    const upgradeEra = el("div", { cls: "tri-upgrade-era", text: "" });
    const upgradeReq = el("div", { cls: "tri-upgrade-req", text: "" });
    const upgradeBtn = el("button", { cls: "tri-btn tri-btn-primary", attrs: { type: "button", "data-action": "upgrade-observatory" } });
    upgradeBtn.appendChild(icon("bolt", 15));
    upgradeBtn.appendChild(el("span", { cls: "tri-btn-label", text: "升级观测站" }));
    append(upgradeBox, upgradeTitle, upgradeDesc, upgradeEra, upgradeCosts, upgradeReq, upgradeBtn);
    append(observatorySection.body, obsHead, obsDesc, obsCaps, obsMeta, upgradeBox);
    wrap.appendChild(observatorySection.el);

    const activeSection = section("进行中的观测任务", { icon: "clock" });
    const activeEmpty = emptyBox("当前没有进行中的观测任务");
    const activeBox = el("div", { cls: "tri-obs-active" });
    const activeHead = el("div", { cls: "tri-obs-active-head" });
    const activeKind = el("span", { cls: "tri-obs-active-kind", text: "—" });
    const activeTarget = el("span", { cls: "tri-badge", text: "—" });
    append(activeHead, activeKind, activeTarget);
    const activeMeter = meterBar("accent");
    const activeMeta = el("div", { cls: "tri-section-meta", text: "—" });
    const activeSummary = el("p", { cls: "tri-hint", text: "" });
    const cancelBtn = el("button", { cls: "tri-btn tri-btn-danger tri-btn-sm", attrs: { type: "button", "data-action": "cancel-observation" } });
    cancelBtn.appendChild(icon("close", 14));
    cancelBtn.appendChild(el("span", { cls: "tri-btn-label", text: "中止观测" }));
    append(activeBox, activeHead, activeMeter.el, activeMeta, activeSummary, cancelBtn);
    activeSection.body.appendChild(activeBox);
    activeSection.body.appendChild(activeEmpty);
    wrap.appendChild(activeSection.el);

    const optionsSection = section("发起观测", { icon: "target", hint: "消耗食物 / 能源与回合" });
    const optionsList = el("div", { cls: "tri-obs-options" });
    const optionsEmpty = emptyBox("观测站等级不足，无法执行观测任务");
    optionsSection.body.appendChild(optionsList);
    optionsSection.body.appendChild(optionsEmpty);
    wrap.appendChild(optionsSection.el);
    let optionsBuilt = false;
    let optionRows: KeyedList<ObservationTaskOptionView> | null = null;

    const modelSection = section("轨道模型", { icon: "orbit" });
    const modelGrid = el("div", { cls: "tri-kv-grid" });
    const modelState = kv("模型状态", "—");
    const modelAccuracy = kv("模型精度", "—");
    const modelHorizon = kv("可靠预测年限", "—");
    const modelData = kv("累计数据点", "—");
    append(modelGrid, modelState.el, modelAccuracy.el, modelHorizon.el, modelData.el);
    const modelNote = el("p", { cls: "tri-hint", text: "—" });
    modelSection.body.appendChild(modelGrid);
    modelSection.body.appendChild(modelNote);
    wrap.appendChild(modelSection.el);

    const discoverySection = section("科学发现", { icon: "book" });
    const discoveryList = el("div", { cls: "tri-discovery-list" });
    const discoveryEmpty = emptyBox("尚未产生科学发现");
    discoverySection.body.appendChild(discoveryList);
    discoverySection.body.appendChild(discoveryEmpty);
    wrap.appendChild(discoverySection.el);
    const discoveryRows = new KeyedList<DiscoveryView>(discoveryList, (item) => String(item.id), createDiscoveryRow, patchDiscoveryRow);

    return {
      el: wrap,
      update(view) {
        updateObservatory(view.observatory);
        updateActiveTask(view.observation);
        updateOptions(view);
        updateModel(view.observation);
        discoveryEmpty.classList.toggle("tri-hidden", view.observation.discoveries.length > 0);
        discoveryRows.update(view.observation.discoveries);
      },
    };

    function updateObservatory(observatory: ViewModel["observatory"]): void {
      setText(obsLevel, "Lv." + observatory.level + " / " + observatory.maxLevel);
      setText(obsName, observatory.name);
      setText(obsData, "数据点 " + int(observatory.dataPoints));
      setText(obsDesc, observatory.description);
      clear(obsCaps);
      if (observatory.capabilities.length === 0) {
        obsCaps.appendChild(chip("无观测能力", "danger"));
      } else {
        for (const capability of observatory.capabilities) obsCaps.appendChild(chip(capability));
      }
      setText(equipRow.valueNode, observatory.equipmentName || "—");
      setText(efficiencyRow.valueNode, pct(observatory.efficiency, 0));
      const next = observatory.next;
      clear(upgradeCosts);
      if (!next) {
        setText(upgradeTitle, "已达最高等级");
        setText(upgradeDesc, "超级观测网络已逼近混沌系统的可见极限。");
        upgradeBtn.disabled = true;
        upgradeBtn.title = "已达最高观测等级";
        upgradeReq.textContent = "";
        upgradeEra.textContent = "";
        return;
      }
      setText(upgradeTitle, "升级至 Lv." + next.level + " · " + next.name);
      setText(upgradeDesc, next.description);
      if (next.capabilities.length > 0) {
        upgradeReq.textContent = "解锁能力：" + next.capabilities.join(" / ");
      } else {
        upgradeReq.textContent = "";
      }
      for (const cost of next.cost) {
        const row = el("div", { cls: "tri-cost-row" });
        row.appendChild(icon(resourceIconName(cost.resourceId), 14));
        row.appendChild(el("span", { cls: "tri-cost-name", text: cost.name }));
        const amount = el("span", { cls: "tri-cost-amount", text: num(cost.amount) });
        if (!cost.affordable) amount.dataset.tone = "danger";
        row.appendChild(amount);
        row.appendChild(el("span", { cls: "tri-cost-have", text: "库存 " + num(cost.have) }));
        upgradeCosts.appendChild(row);
      }
      if (next.upgradeScience > 0) {
        const sciRow = el("div", { cls: "tri-cost-row" });
        sciRow.appendChild(icon("flask", 14));
        sciRow.appendChild(el("span", { cls: "tri-cost-name", text: "科研点" }));
        sciRow.appendChild(el("span", { cls: "tri-cost-amount", text: int(next.upgradeScience) }));
        upgradeCosts.appendChild(sciRow);
      }
      const requiresEra = typeof next.requiresEra === "number" ? next.requiresEra : 1;
      const eraOk = next.eraOk !== false;
      const eraInfoNext = eraInfo(requiresEra);
      clear(upgradeEra);
      const eraChip = eraTag(requiresEra, "tri-upgrade-era-tag");
      eraChip.dataset.ok = eraOk ? "true" : "false";
      append(
        upgradeEra,
        eraChip,
        el("span", { cls: "tri-upgrade-era-text", text: (eraOk ? "时代门槛已满足 · " : "需要进入 ") + "E" + requiresEra + " " + eraInfoNext.name }),
      );
      const reqParts: string[] = [];
      if (next.requiresTechName) reqParts.push("前置科技：" + next.requiresTechName);
      if (next.blockedReason && !String(next.blockedReason).includes("时代")) reqParts.push(next.blockedReason);
      if (reqParts.length > 0) upgradeReq.textContent = reqParts.join(" · ");
      upgradeBtn.disabled = !next.canUpgrade;
      upgradeBtn.title = next.canUpgrade ? "升级观测站" : next.blockedReason ?? "条件不足";
      setText(q(upgradeBtn, ".tri-btn-label"), next.canUpgrade ? "升级观测站" : eraOk ? "条件不足" : "时代未达");
    }

    function updateActiveTask(observation: ObservationView): void {
      const task = observation.activeTask;
      activeBox.classList.toggle("tri-hidden", task == null);
      activeEmpty.classList.toggle("tri-hidden", task != null);
      if (!task) return;
      setText(activeKind, task.kindLabel);
      setText(activeTarget, task.targetLabel);
      activeMeter.update(task.progress, { tone: "accent" });
      setText(
        activeMeta,
        "进度 " + pct(task.progress, 0) + " · 回合 " + task.turnsElapsed + " / " + task.turnsRequired + " · 能耗 " + num(task.energyCost),
      );
      setText(activeSummary, task.summary);
    }

    function updateOptions(view: ViewModel): void {
      const options = view.observation.taskOptions;
      optionsEmpty.classList.toggle("tri-hidden", options.length > 0);
      if (!optionsBuilt && options.length > 0) {
        optionsBuilt = true;
        optionRows = new KeyedList<ObservationTaskOptionView>(
          optionsList,
          (option) => option.kind,
          (option) => createObservationOption(option, view),
          patchObservationOption,
        );
      }
      optionRows?.update(options);
    }

    function createObservationOption(option: ObservationTaskOptionView, view: ViewModel): HTMLElement {
      const card = el("div", {
        cls: "tri-obs-option",
        attrs: { "data-kind": option.kind, "data-target-mode": option.targetMode },
      });
      const head = el("div", { cls: "tri-obs-option-head" });
      head.appendChild(el("span", { cls: "tri-obs-option-name", text: option.label }));
      const costWrap = el("span", { cls: "tri-obs-option-cost" });
      const costIcon = el("span", { cls: "tri-obs-option-cost-icon" });
      costIcon.appendChild(icon(currencyIcon(option.costResource ?? "energy"), 12));
      const costText = el("span", { cls: "tri-obs-option-cost-text", text: optionCostText(option) });
      append(costWrap, costIcon, costText);
      head.appendChild(costWrap);
      card.appendChild(head);
      card.appendChild(el("p", { cls: "tri-obs-option-desc", text: option.description }));
      if (option.targetMode === "star") {
        const targetRow = el("div", { cls: "tri-obs-target-row" });
        targetRow.appendChild(el("span", { cls: "tri-meter-label", text: "目标恒星" }));
        const select = el("select", { cls: "tri-select", attrs: { "data-obs-target": "true" } });
        const stars = view.observation.stars.length > 0 ? view.observation.stars.map((star) => ({ id: star.id, name: star.name })) : [{ id: "A" as const, name: "赤曜" }, { id: "B" as const, name: "青曜" }, { id: "C" as const, name: "幽曜" }];
        for (const star of stars) {
          const optionNode = el("option", { text: star.name + " (" + star.id + ")", attrs: { value: star.id } });
          select.appendChild(optionNode);
        }
        if (view.selection === "A" || view.selection === "B" || view.selection === "C") select.value = view.selection;
        targetRow.appendChild(select);
        card.appendChild(targetRow);
      }
      const reason = el("div", { cls: "tri-obs-option-reason tri-hidden", text: "" });
      const footer = el("div", { cls: "tri-obs-option-footer" });
      const startBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button", "data-action": "start-observation" } });
      startBtn.appendChild(icon("target", 14));
      startBtn.appendChild(el("span", { cls: "tri-btn-label", text: "开始观测" }));
      footer.appendChild(startBtn);
      append(card, reason, footer);
      return card;
    }

    function patchObservationOption(node: HTMLElement, option: ObservationTaskOptionView): void {
      node.dataset.targetMode = option.targetMode;
      node.dataset.currency = option.costResource ?? "energy";
      setText(q(node, ".tri-obs-option-cost-text"), optionCostText(option));
      const costIcon = q(node, ".tri-obs-option-cost-icon");
      if (costIcon && costIcon.dataset.currency !== (option.costResource ?? "energy")) {
        costIcon.dataset.currency = option.costResource ?? "energy";
        clear(costIcon);
        costIcon.appendChild(icon(currencyIcon(option.costResource ?? "energy"), 12));
      }
      setText(q(node, ".tri-obs-option-desc"), option.description);
      const reason = q<HTMLElement>(node, ".tri-obs-option-reason");
      if (reason) {
        reason.textContent = option.enabled ? "" : option.reason ?? "当前条件不满足";
        reason.classList.toggle("tri-hidden", option.enabled);
      }
      const btn = q<HTMLButtonElement>(node, "[data-action='start-observation']");
      if (btn) {
        btn.disabled = !option.enabled;
        btn.title = option.enabled ? "发起 " + option.label : option.reason ?? "条件不足";
      }
      const targetRow = q<HTMLElement>(node, ".tri-obs-target-row");
      if (targetRow) targetRow.classList.toggle("tri-hidden", option.targetMode !== "star");
    }

    function updateModel(observation: ObservationView): void {
      setText(modelState.valueNode, observation.hasModel ? "模型可用" : "尚无轨道模型");
      setStateTone(modelState, observation.hasModel ? "ok" : "muted");
      setText(
        modelAccuracy.valueNode,
        observation.modelAccuracy == null ? "— 未建模" : pct(observation.modelAccuracy, 0),
      );
      setText(
        modelHorizon.valueNode,
        observation.modelHorizon == null ? "—" : years(observation.modelHorizon, 1),
      );
      setText(modelData.valueNode, int(observation.dataPoints) + " 点" + (observation.observedTrailAvailable ? " · 存在观测轨迹" : ""));
      setText(
        modelNote,
        observation.modelNote ??
          (observation.lastObservationYear == null
            ? "尚未获得任何观测数据。先建造观测站并发起观测任务。"
            : "最近观测：星历 " + Math.round(observation.lastObservationYear) + " 年。继续观测可提高模型精度。"),
      );
    }
  }

  /* ================================================================== *
   *  PREDICTION                                                        *
   * ================================================================== */
  function buildPrediction(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });

    const headerSection = section("预测状态", { icon: "target" });
    const stateBox = el("div", { cls: "tri-predict-state" });
    const availability = el("span", { cls: "tri-badge", text: "—" });
    const refreshBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button", "data-action": "refresh-prediction" } });
    refreshBtn.appendChild(icon("reset", 14));
    refreshBtn.appendChild(el("span", { cls: "tri-btn-label", text: "刷新预测" }));
    append(stateBox, availability, refreshBtn);
    const reasonText = el("p", { cls: "tri-hint", text: "—" });
    headerSection.body.appendChild(stateBox);
    headerSection.body.appendChild(reasonText);
    wrap.appendChild(headerSection.el);

    const statsSection = section("预测包络", { icon: "orbit" });
    const statsGrid = el("div", { cls: "tri-kv-grid" });
    const createdRow = kv("建立年份", "—");
    const horizonRow = kv("预测范围", "—");
    const reliableRow = kv("可靠年限", "—");
    const agreementRow = kv("模型一致性", "—");
    const divergedRow = kv("发散状态", "—");
    append(statsGrid, createdRow.el, horizonRow.el, reliableRow.el, agreementRow.el, divergedRow.el);
    const agreementMeter = meterBar("ok");
    agreementMeter.el.classList.add("tri-predict-meter");
    const noteText = el("p", { cls: "tri-hint", text: "—" });
    append(statsSection.body, statsGrid, agreementMeter.el, noteText);
    wrap.appendChild(statsSection.el);

    const starsSection = section("恒星预测", { icon: "star", hint: "可靠年限 / 最近接近" });
    const starsList = el("div", { cls: "tri-predict-list" });
    const starsEmpty = emptyBox("尚无预测数据 · 需要先建立轨道模型");
    starsSection.body.appendChild(starsList);
    starsSection.body.appendChild(starsEmpty);
    wrap.appendChild(starsSection.el);
    const starRows = new KeyedList<PredictionStarView>(starsList, (star) => star.id, createPredictionStarRow, patchPredictionStarRow);

    const planetSection = section("母星预测", { icon: "planet" });
    const planetGrid = el("div", { cls: "tri-kv-grid" });
    const planetReliable = kv("可靠年限", "—");
    const planetClosest = kv("最近接近距离", "—");
    const planetClosestYear = kv("最近接近年份", "—");
    append(planetGrid, planetReliable.el, planetClosest.el, planetClosestYear.el);
    planetSection.body.appendChild(planetGrid);
    wrap.appendChild(planetSection.el);

    return {
      el: wrap,
      update(view) {
        const prediction = view.prediction;
        setText(availability, prediction.available ? "预测可用" : "预测不可用");
        availability.dataset.tone = prediction.available ? "ok" : "warn";
        refreshBtn.disabled = !view.observation.hasModel;
        refreshBtn.title = view.observation.hasModel ? "基于当前观测数据刷新预测" : "需要先建立轨道模型";
        setText(
          reasonText,
          prediction.available
            ? "预测基于当前观测模型外推，可靠性随时间下降。虚线为预测轨迹，半透明区域为不确定范围。"
            : prediction.reason ?? "需要更多观测数据才能建立可靠的轨道预测。",
        );
        setText(createdRow.valueNode, prediction.createdYear == null ? "—" : "星历 " + Math.round(prediction.createdYear));
        setText(horizonRow.valueNode, prediction.horizonYears == null ? "—" : years(prediction.horizonYears, 1));
        setText(reliableRow.valueNode, prediction.reliableYears == null ? "—" : years(prediction.reliableYears, 1));
        setText(agreementRow.valueNode, prediction.agreement == null ? "— 未评估" : pct(prediction.agreement, 0));
        setText(divergedRow.valueNode, prediction.diverged ? "已发散 · 超出可靠窗口" : "收敛");
        setStateTone(divergedRow, prediction.diverged ? "danger" : "ok");
        agreementMeter.update(prediction.agreement ?? 0, { tone: (prediction.agreement ?? 0) > 0.6 ? "ok" : "warn" });
        setText(noteText, prediction.note ?? "暂无模型备注。");

        starsEmpty.classList.toggle("tri-hidden", prediction.stars.length > 0);
        starRows.update(prediction.stars);
        const horizon = prediction.horizonYears ?? 0;
        for (const star of prediction.stars) {
          const node = q<HTMLElement>(starsList, '[data-key="' + star.id + '"]');
          if (node) patchMeter(node, horizon > 0 ? star.reliableYears / horizon : 0, star.reliableYears > 0 ? "accent" : "danger");
        }

        const planetPredict = prediction.planet;
        setText(planetReliable.valueNode, planetPredict ? years(planetPredict.reliableYears, 1) : "—");
        setText(planetClosest.valueNode, planetPredict?.closestApproachAU == null ? "— 未预测" : au(planetPredict.closestApproachAU));
        setText(
          planetClosestYear.valueNode,
          planetPredict?.closestApproachYear == null ? "— 未预测" : "星历 " + Math.round(planetPredict.closestApproachYear),
        );
      },
    };
  }

  function createPredictionStarRow(star: PredictionStarView): HTMLElement {
    const row = el("div", { cls: "tri-predict-row" });
    const head = el("div", { cls: "tri-predict-head" });
    const dotEl = el("i", { cls: "tri-dot" });
    dotEl.style.background = star.color;
    head.appendChild(dotEl);
    head.appendChild(el("span", { cls: "tri-predict-name", text: star.name }));
    head.appendChild(el("span", { cls: "tri-predict-reliable", text: "—" }));
    const meter = meterBar("accent");
    meter.el.classList.add("tri-predict-meter");
    const closest = el("span", { cls: "tri-predict-closest", text: "—" });
    append(row, head, meter.el, closest);
    return row;
  }

  function patchPredictionStarRow(node: HTMLElement, star: PredictionStarView): void {
    setText(q(node, ".tri-predict-name"), star.name);
    setText(q(node, ".tri-predict-reliable"), "可靠 " + years(star.reliableYears, 1));
    setText(
      q(node, ".tri-predict-closest"),
      "最近接近 " +
        (star.closestApproachAU == null ? "— 未预测" : au(star.closestApproachAU) + " · 星历 " + Math.round(star.closestApproachYear ?? 0)),
    );
  }

  /* ================================================================== *
   *  TECH — era columns with lock masks                               *
   * ================================================================== */
  function buildTech(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });
    const activeSection = section("当前研究", { icon: "flask" });
    const activeName = el("div", { cls: "tri-research-active-name", text: "无进行中的研究" });
    const activeMeter = meterBar("accent");
    const activeMeta = el("div", { cls: "tri-section-meta", text: "—" });
    const cancelBtn = el("button", { cls: "tri-btn tri-btn-danger tri-btn-sm", attrs: { type: "button", "data-action": "cancel-research" } });
    cancelBtn.appendChild(icon("close", 14));
    cancelBtn.appendChild(el("span", { cls: "tri-btn-label", text: "中止研究" }));
    append(activeSection.body, activeName, activeMeter.el, activeMeta, cancelBtn);
    wrap.appendChild(activeSection.el);

    const board = el("div", { cls: "tri-tech-era-board" });
    wrap.appendChild(board);
    const columns: EraTechColumn[] = [];
    let built = false;
    let lastEra = -1;

    return {
      el: wrap,
      update(view) {
        const civ = view.civ.science;
        setText(activeName, civ.activeTechName ?? "无进行中的研究");
        activeMeter.update(civ.percent, { tone: civ.activeTechName ? "accent" : "muted" });
        setText(
          activeMeta,
          civ.activeTechName
            ? pct(civ.percent, 0) + " · " + num(civ.progress, 0) + " / " + num(civ.cost, 0) + " · " + (civ.etaTurns == null ? "预计 —" : "预计 " + civ.etaTurns + " 回合") + " · 科研 +" + perYear(civ.rate, 2)
            : "科研速率 +" + perYear(civ.rate, 2) + " · 点击可用科技开始研究",
        );
        cancelBtn.classList.toggle("tri-hidden", civ.activeTechName == null);

        if (!built) {
          built = true;
          for (let era = 1; era <= ERA_COUNT; era += 1) {
            const column = new EraTechColumn(era);
            columns.push(column);
            board.appendChild(column.el);
          }
        }
        const currentEra = view.civ.era.value;
        for (const column of columns) column.update(view.tech.branches, currentEra, civ.activeTechId);
        if (lastEra !== currentEra) {
          lastEra = currentEra;
          for (const column of columns) column.setCollapsed(column.era !== currentEra);
        }
      },
    };
  }

  /** One era of the technology board: header, tech rows and a lock mask. */
  class EraTechColumn {
    readonly era: number;
    readonly el: HTMLElement;
    private readonly info: { era: number; name: string; subtitle: string };
    private readonly count: HTMLElement;
    private readonly lockMask: HTMLElement;
    private readonly rows: KeyedList<TechView>;
    private currentEra = 1;

    constructor(era: number) {
      this.era = era;
      this.info = eraInfo(era);
      const root = el("section", { cls: "tri-tech-era", attrs: { "data-era": String(era) } });
      const head = el("button", { cls: "tri-tech-era-head", attrs: { type: "button", "data-tech-era-toggle": "true" } });
      head.appendChild(eraTag(era, "tri-tech-era-tag"));
      head.appendChild(el("span", { cls: "tri-tech-era-name", text: this.info.name }));
      head.appendChild(el("span", { cls: "tri-tech-era-sub", text: this.info.subtitle }));
      this.count = el("span", { cls: "tri-tech-era-count", text: "0 / 0" });
      head.appendChild(this.count);
      head.appendChild(icon("chevronDown", 13, "tri-tech-era-chevron"));

      const body = el("div", { cls: "tri-tech-era-body" });
      const list = el("div", { cls: "tri-tech-era-list" });
      this.lockMask = el("div", { cls: "tri-tech-era-lock tri-hidden" });
      const lockIcon = el("span", { cls: "tri-tech-era-lock-icon" });
      lockIcon.appendChild(icon("lock", 14));
      append(this.lockMask, lockIcon, el("span", { cls: "tri-tech-era-lock-text", text: "E" + era + " 解锁" }));
      append(body, list, this.lockMask);
      append(root, head, body);
      this.el = root;
      this.rows = new KeyedList<TechView>(
        list,
        (tech) => tech.id,
        createEraTechRow,
        (node, tech) => patchEraTechRow(node, tech, this.currentEra, this.era),
      );
      head.addEventListener("click", () => this.setCollapsed(!root.classList.contains("is-collapsed")));
    }

    setCollapsed(collapsed: boolean): void {
      this.el.classList.toggle("is-collapsed", collapsed);
    }

    update(branches: TechBranchView[], currentEra: number, activeTechId: string | null): void {
      this.currentEra = currentEra;
      const locked = this.era > currentEra;
      this.el.dataset.locked = locked ? "true" : "false";
      this.lockMask.classList.toggle("tri-hidden", !locked);
      setText(q(this.lockMask, ".tri-tech-era-lock-text"), "E" + this.era + " 解锁 · " + this.info.name);
      const techs: TechView[] = [];
      for (const branch of branches) {
        for (const tech of branch.techs) {
          if (eraOfTech(tech) === this.era) techs.push(tech);
        }
      }
      techs.sort((a, b) => a.tier - b.tier || a.cost - b.cost || a.name.localeCompare(b.name, "zh-Hans-CN"));
      this.rows.update(techs);
      const researched = techs.filter((tech) => tech.researched).length;
      setText(this.count, researched + " / " + techs.length);
      const hasActive = activeTechId != null && techs.some((tech) => tech.id === activeTechId || tech.isActive);
      this.el.classList.toggle("has-active", hasActive);
      setClass(this.el, "is-locked", locked);
    }
  }

  function eraOfTech(tech: TechView): number {
    const value = typeof tech.era === "number" && Number.isFinite(tech.era) ? tech.era : tech.tier;
    return Math.min(ERA_COUNT, Math.max(1, Math.round(value)));
  }

  function createEraTechRow(tech: TechView): HTMLElement {
    const row = el("div", { cls: "tri-tech-row", attrs: { "data-tech-row": tech.id } });
    const branchTag = el("span", { cls: "tri-tech-branch-tag", text: tech.branchName || tech.branch });
    const main = el("div", { cls: "tri-tech-main" });
    const head = el("div", { cls: "tri-tech-head" });
    const name = el("span", { cls: "tri-tech-name", text: tech.name });
    const cost = el("span", { cls: "tri-tech-cost", text: "—" });
    append(head, name, cost);
    const effect = el("div", { cls: "tri-tech-effect", text: "—" });
    const desc = el("div", { cls: "tri-tech-desc", text: tech.description });
    append(main, head, effect, desc);
    const side = el("div", { cls: "tri-tech-side" });
    const status = el("span", { cls: "tri-tech-status", text: "" });
    const action = el("button", { cls: "tri-btn tri-btn-sm tri-tech-action", attrs: { type: "button", "data-tech-action": "true" } });
    action.appendChild(el("span", { cls: "tri-btn-label", text: "研究" }));
    append(side, status, action);
    append(row, branchTag, main, side);
    return row;
  }

  function patchEraTechRow(node: HTMLElement, tech: TechView, currentEra: number, rowEra: number): void {
    const locked = rowEra > currentEra;
    node.dataset.locked = locked ? "true" : "false";
    setText(q(node, ".tri-tech-name"), tech.name);
    setText(q(node, ".tri-tech-cost"), int(tech.cost) + " 科研点");
    setText(q(node, ".tri-tech-effect"), tech.effectSummary);
    setText(q(node, ".tri-tech-desc"), tech.description);
    const branchTag = q(node, ".tri-tech-branch-tag");
    if (branchTag) {
      branchTag.textContent = tech.branchName || tech.branch;
      branchTag.dataset.branch = tech.branch;
    }
    setClass(node, "is-researched", tech.researched);
    setClass(node, "is-active", tech.isActive);
    setClass(node, "is-locked", locked);
    const status = q(node, ".tri-tech-status");
    if (status) {
      status.textContent = tech.researched ? "已研究" : tech.isActive ? "研究中" : locked ? "时代锁定" : tech.available ? "可研究" : "前置锁定";
      status.dataset.tone = tech.researched ? "ok" : tech.isActive ? "accent" : tech.available && !locked ? "accent" : "muted";
    }
    const action = q(node, "[data-tech-action]") as HTMLButtonElement | null;
    if (action) {
      action.dataset.techId = tech.id;
      action.dataset.available = tech.available ? "true" : "false";
      action.disabled = !tech.available || locked;
      const label = tech.researched ? "已研究" : tech.isActive ? "进行中" : locked ? "锁定" : tech.available ? "研究" : "锁定";
      setText(q(action, ".tri-btn-label"), label);
      action.className =
        "tri-btn tri-btn-sm tri-tech-action" +
        (tech.researched ? " is-done" : tech.isActive ? " is-active" : tech.available && !locked ? " tri-btn-primary" : " is-locked");
      action.title = locked
        ? "进入 E" + rowEra + " 时代后解锁"
        : tech.researched
          ? "该科技已研究完成"
          : tech.isActive
            ? "正在研究中"
            : tech.available
              ? "开始研究 " + tech.name
              : tech.blockedReason ?? "前置条件不满足";
    }
  }

  /* ================================================================== *
   *  HAZARDS                                                           *
   * ================================================================== */
  function buildHazards(): { el: HTMLElement; update: (view: ViewModel) => void } {
    const wrap = el("div", { cls: "tri-pane-stack" });
    const hazardArt = el("div", { cls: "tri-hazard-art" });
    hazardArt.style.backgroundPosition = "center 28%";
    const hazardArtShade = el("div", { cls: "tri-hazard-art-shade", attrs: { "aria-hidden": "true" } });
    const hazardArtLabel = el("div", { cls: "tri-hazard-art-label", text: "深空监测中" });
    append(hazardArt, hazardArtShade, hazardArtLabel);
    wrap.appendChild(hazardArt);
    const riskSection = section("风险态势", { icon: "alert" });
    const riskHead = el("div", { cls: "tri-risk-head" });
    const riskBadge = el("span", { cls: "tri-badge tri-risk-badge", text: "—" });
    const stressValue = el("span", { cls: "tri-risk-stress", text: "—" });
    append(riskHead, riskBadge, stressValue);
    const stressSpark: SparkHandle = sparkline({ width: 300, height: 42, color: "#ff5b6e", fill: true, zeroLine: true });
    append(riskSection.body, riskHead, stressSpark.el);
    wrap.appendChild(riskSection.el);

    const hazardSection = section("已探测灾害", { icon: "warning" });
    const hazardList = el("div", { cls: "tri-hazard-list" });
    const hazardEmpty = emptyBox("暂无已确认的灾害信号 · 提高观测能力可扩大预警范围");
    hazardSection.body.appendChild(hazardList);
    hazardSection.body.appendChild(hazardEmpty);
    wrap.appendChild(hazardSection.el);
    const hazardRows = new KeyedList<HazardView>(hazardList, (hazard) => String(hazard.id), createHazardRow, patchHazardRow);

    const warningSection = section("灾害预警", { icon: "bell" });
    const warningList = el("div", { cls: "tri-warning-list" });
    const warningEmpty = emptyBox("当前没有预警 · 预警依赖轨道模型精度");
    warningSection.body.appendChild(warningList);
    warningSection.body.appendChild(warningEmpty);
    wrap.appendChild(warningSection.el);
    const warningRows = new KeyedList<WarningView>(warningList, (item) => String(item.id), createWarningRow, patchWarningRow);

    const crisisSection = section("社会危机", { icon: "info" });
    const crisisList = el("div", { cls: "tri-crisis-list" });
    const crisisEmpty = emptyBox("社会运行平稳，未爆发危机");
    crisisSection.body.appendChild(crisisList);
    crisisSection.body.appendChild(crisisEmpty);
    wrap.appendChild(crisisSection.el);
    const crisisRows = new KeyedList<CrisisView>(crisisList, (item) => String(item.id), createCrisisRow, patchCrisisRow);

    return {
      el: wrap,
      update(view) {
        const hazards = view.hazards;
        const detected = hazards.hazards.filter((hazard) => hazard.detected);
        const leadingHazard = detected[0] ?? null;
        const leadingWarning = hazards.warnings[0] ?? null;
        const hazardKind = leadingHazard?.kind ?? leadingWarning?.kind ?? null;
        hazardArt.dataset.tone = hazards.riskLevel;
        setArtBackground(hazardArt, hazardKind ? ART.hazard(hazardKind) : ART.nebulaBackground);
        setText(
          hazardArtLabel,
          leadingHazard
            ? "已探测灾害 · " + leadingHazard.title
            : leadingWarning
              ? "预警信号 · " + leadingWarning.title
              : "暂未发现灾害信号 · 深空监测中",
        );
        setText(riskBadge, hazards.riskLabel);
        riskBadge.dataset.risk = hazards.riskLevel;
        setText(stressValue, "环境压力 " + pct(clamp01(hazards.stress), 0));
        stressSpark.update(hazards.historyStress.map((point) => point.stress));
        hazardEmpty.classList.toggle("tri-hidden", detected.length > 0);
        hazardRows.update(detected);
        warningEmpty.classList.toggle("tri-hidden", hazards.warnings.length > 0);
        warningRows.update(hazards.warnings);
        crisisEmpty.classList.toggle("tri-hidden", hazards.crises.length > 0);
        crisisRows.update(hazards.crises);
      },
    };
  }

  function createHazardRow(hazard: HazardView): HTMLElement {
    const row = el("div", { cls: "tri-hazard-row", attrs: { "data-severity": String(Math.min(5, Math.max(1, Math.round(hazard.severity)))) } });
    const head = el("div", { cls: "tri-hazard-head" });
    head.appendChild(icon("alert", 14));
    head.appendChild(el("span", { cls: "tri-hazard-kind", text: hazard.kindLabel }));
    head.appendChild(el("span", { cls: "tri-hazard-severity", text: "—" }));
    const title = el("div", { cls: "tri-hazard-title", text: hazard.title });
    const desc = el("p", { cls: "tri-hazard-desc", text: hazard.description });
    const meter = meterBar("danger");
    meter.el.classList.add("tri-hazard-meter");
    const timeline = el("div", { cls: "tri-hazard-timeline", text: "—" });
    append(row, head, title, desc, meter.el, timeline);
    return row;
  }

  function patchHazardRow(node: HTMLElement, hazard: HazardView): void {
    node.dataset.severity = String(Math.min(5, Math.max(1, Math.round(hazard.severity))));
    setText(q(node, ".tri-hazard-kind"), hazard.kindLabel);
    setText(q(node, ".tri-hazard-severity"), hazard.severityLabel + " · 置信 " + pct(hazard.confidence, 0));
    setText(q(node, ".tri-hazard-title"), hazard.title);
    setText(q(node, ".tri-hazard-desc"), hazard.description);
    patchMeter(node, clamp01(hazard.severity / 5), hazard.severity >= 4 ? "danger" : hazard.severity >= 2.5 ? "warn" : "accent");
    setText(
      q(node, ".tri-hazard-timeline"),
      "起始 星历 " + Math.round(hazard.startYear) + " · 峰值 " + Math.round(hazard.peakYear) + " · 结束 " + Math.round(hazard.endYear),
    );
  }

  function createWarningRow(warning: WarningView): HTMLElement {
    const row = el("div", { cls: "tri-warning-row" });
    const head = el("div", { cls: "tri-warning-head" });
    head.appendChild(icon("bell", 14));
    head.appendChild(el("span", { cls: "tri-warning-title", text: warning.title }));
    const lead = el("span", { cls: "tri-warning-lead", text: "—" });
    head.appendChild(lead);
    const desc = el("p", { cls: "tri-warning-desc", text: warning.description });
    const meter = meterBar("warn");
    meter.el.classList.add("tri-hazard-meter");
    const meta = el("div", { cls: "tri-hazard-timeline", text: "—" });
    append(row, head, desc, meter.el, meta);
    return row;
  }

  function patchWarningRow(node: HTMLElement, warning: WarningView): void {
    setText(q(node, ".tri-warning-title"), warning.title);
    setText(q(node, ".tri-warning-lead"), "提前 " + years(warning.leadYears, 1));
    setText(q(node, ".tri-warning-desc"), warning.description);
    patchMeter(node, clamp01(warning.confidence), warning.confidence > 0.6 ? "warn" : "danger");
    setText(
      q(node, ".tri-hazard-timeline"),
      "置信 " + pct(warning.confidence, 0) + " · 预估烈度 " + warning.severityEstimate.toFixed(1) + " · 发布于星历 " + Math.round(warning.createdYear),
    );
  }

  function createCrisisRow(crisis: CrisisView): HTMLElement {
    const row = el("div", { cls: "tri-crisis-row" });
    const head = el("div", { cls: "tri-crisis-head" });
    head.appendChild(icon("people", 14));
    head.appendChild(el("span", { cls: "tri-crisis-title", text: crisis.title }));
    head.appendChild(el("span", { cls: "tri-crisis-state", text: "—" }));
    const desc = el("p", { cls: "tri-crisis-desc", text: crisis.description });
    const mitigated = el("div", { cls: "tri-crisis-mitigated", text: "—" });
    append(row, head, desc, mitigated);
    return row;
  }

  function patchCrisisRow(node: HTMLElement, crisis: CrisisView): void {
    setText(q(node, ".tri-crisis-title"), crisis.title);
    setText(q(node, ".tri-crisis-desc"), crisis.description);
    const state = q(node, ".tri-crisis-state");
    if (state) {
      state.textContent = crisis.active ? "危机中" : "已结束";
      state.dataset.tone = crisis.active ? "danger" : "muted";
    }
    setText(
      q(node, ".tri-crisis-mitigated"),
      "起始 星历 " + Math.round(crisis.startYear) + " · 烈度 " + crisis.severity.toFixed(1) + " · 缓解 " + pct(clamp01(crisis.mitigated), 0),
    );
    setClass(node, "is-active", crisis.active);
  }

  function createDiscoveryRow(discovery: DiscoveryView): HTMLElement {
    const row = el("div", { cls: "tri-discovery-row" });
    const head = el("div", { cls: "tri-discovery-head" });
    head.appendChild(el("span", { cls: "tri-discovery-year", text: "—" }));
    head.appendChild(el("span", { cls: "tri-badge tri-discovery-cat", text: discovery.category }));
    head.appendChild(el("span", { cls: "tri-discovery-title", text: discovery.title }));
    const detail = el("p", { cls: "tri-discovery-detail", text: discovery.detail });
    const evidence = el("div", { cls: "tri-discovery-evidence", text: "—" });
    append(row, head, detail, evidence);
    return row;
  }

  function patchDiscoveryRow(node: HTMLElement, discovery: DiscoveryView): void {
    setText(q(node, ".tri-discovery-year"), "星历 " + Math.round(discovery.year));
    setText(q(node, ".tri-badge"), discovery.category);
    setText(q(node, ".tri-discovery-title"), discovery.title);
    setText(q(node, ".tri-discovery-detail"), discovery.detail);
    setText(q(node, ".tri-discovery-evidence"), "证据：" + discovery.evidence);
  }

  /* ------------------------------- shared ---------------------------- */
  return handle;
}

/* ------------------------------------------------------------------ *
 *  helpers                                                           *
 * ------------------------------------------------------------------ */
interface CoordStrip {
  el: HTMLElement;
  update(coords: Coord3): void;
}

interface PlanetCard {
  el: HTMLElement;
  update(planet: ObservedPlanetView): void;
}

const FLAG_LABELS: [string, string][] = [
  ["position", "位置"],
  ["distance", "距离"],
  ["velocity", "速度"],
  ["mass", "质量"],
  ["acceleration", "加速度"],
  ["orbit", "轨道"],
];

const STAR_FIELDS: [string, string][] = [
  ["distance", "距系统质心"],
  ["speed", "当前速度"],
  ["mass", "恒星质量"],
  ["eccentricity", "轨道偏心率"],
  ["sigmaPos", "位置误差"],
  ["sigmaVel", "速度误差"],
  ["relation", "相对母星"],
  ["samples", "观测样本"],
  ["lastYear", "最近测量"],
  ["height", "高度 Y"],
  ["inclination", "轨道倾角"],
];

const PLANET_FIELDS: [string, string][] = [
  ["distance", "距主星"],
  ["temp", "表面温度"],
  ["orbit", "轨道半径"],
  ["eccentricity", "轨道偏心率"],
  ["sigma", "位置误差"],
  ["lastYear", "最近测量"],
  ["height", "高度 Y"],
  ["inclination", "轨道倾角"],
];

function createCoordStrip(): CoordStrip {
  const strip = el("div", { cls: "tri-coord-strip" });
  const title = el("div", { cls: "tri-coord-title", text: "三维坐标（AU，X-Z 投影 + Y 高度）" });
  strip.appendChild(title);
  const cells = el("div", { cls: "tri-coord-cells" });
  const values: Record<"x" | "y" | "z", HTMLElement> = {
    x: createCoordCell(cells, "X", "水平"),
    y: createCoordCell(cells, "Y", "高度", true),
    z: createCoordCell(cells, "Z", "深度"),
  };
  strip.appendChild(cells);
  return {
    el: strip,
    update(coords) {
      setText(values.x, coordText(coords.x));
      setText(values.y, coordText(coords.y));
      setText(values.z, coordText(coords.z));
      values.y.dataset.unknown = coords.y == null ? "true" : "false";
    },
  };
}

function createCoordCell(parent: HTMLElement, axis: string, hint: string, highlight = false): HTMLElement {
  const cell = el("div", { cls: "tri-coord-cell" + (highlight ? " is-highlight" : "") });
  const label = el("span", { cls: "tri-coord-label" });
  label.appendChild(el("b", { text: axis }));
  label.appendChild(el("span", { text: hint }));
  const value = el("span", { cls: "tri-coord-value", text: "— 未观测" });
  append(cell, label, value);
  parent.appendChild(cell);
  return value;
}

function createSectionMeta(text: string): HTMLElement {
  return el("div", { cls: "tri-section-meta", text });
}

function rowValue(handle: { valueNode: HTMLElement }): HTMLElement {
  return handle.valueNode;
}

function optionCostText(option: ObservationTaskOptionView): string {
  const label = option.costLabel && option.costLabel.length > 0 ? option.costLabel : "能源 " + option.energyCost;
  return label + " · " + option.turnsRequired + " 回合";
}

function setField(fields: Map<string, HTMLElement>, key: string, value: string): void {
  const node = fields.get(key);
  if (node) setText(node, value);
}

function setStateTone(handle: { valueNode: HTMLElement }, tone: "ok" | "warn" | "danger" | "muted"): void {
  handle.valueNode.dataset.tone = tone;
}

function meterLine(label: string, meter: MeterHandle, value: HTMLElement): HTMLElement {
  const row = el("div", { cls: "tri-meter-row" });
  row.appendChild(el("span", { cls: "tri-meter-label", text: label }));
  row.appendChild(meter.el);
  row.appendChild(value);
  return row;
}

function patchMeter(node: HTMLElement, ratio: number, tone: string): void {
  const meter = q<HTMLElement>(node, ".tri-meter");
  if (!meter) return;
  meter.dataset.tone = tone;
  const fill = q<HTMLElement>(meter, ".tri-meter-fill");
  if (fill) fill.style.width = (clamp01(ratio) * 100).toFixed(1) + "%";
}
