/** Build terminal: era-grouped construction queue and building cards with upgrades. */
import type { BuildingView, FlowCostView, QueueView, ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, KeyedList, q, setClass, setText } from "./dom";
import { icon } from "./icons";
import { meterBar } from "./charts";
import { int, num } from "./format";
import { emptyBox, resourceIconName } from "./widgets";
import {
  ERA_COUNT,
  eraInfo,
  eraTag,
  lockHint,
  outdatedBadge,
  queueKindInfo,
  tierTicks,
} from "./era-ui";

interface CategoryTab {
  id: string;
  label: string;
}

interface EraSection {
  era: number;
  root: HTMLElement;
  grid: HTMLElement;
  count: HTMLElement;
  lockMask: HTMLElement;
  rows: KeyedList<BuildingView>;
}

export function buildBuildModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-build" });
  const summary = el("div", { cls: "tri-build-summary" });
  const summaryQueue = el("span", { text: "队列 —" });
  const summaryIndustry = el("span", { text: "工业产能 —" });
  const summaryMaintenance = el("span", { text: "维护 —" });
  const summaryEra = el("span", { cls: "tri-build-summary-era", text: "时代 —" });
  append(summary, summaryQueue, summaryIndustry, summaryMaintenance, summaryEra);
  root.appendChild(summary);

  const queueSection = el("div", { cls: "tri-build-queue" });
  const queueHead = el("div", { cls: "tri-build-queue-head" });
  queueHead.appendChild(icon("clock", 13));
  queueHead.appendChild(el("span", { cls: "tri-subhead", text: "进行中的工程" }));
  const queueLegend = el("div", { cls: "tri-build-queue-legend" });
  queueLegend.append(el("span", { cls: "tri-queue-kind is-build", text: "新建" }), el("span", { cls: "tri-queue-kind is-upgrade", text: "升级" }));
  queueHead.appendChild(queueLegend);
  const queueList = el("div", { cls: "tri-build-queue-list" });
  const queueEmpty = emptyBox("建造队列空闲 · 工业产能可分配");
  append(queueSection, queueHead, queueList, queueEmpty);
  root.appendChild(queueSection);
  const queueRows = new KeyedList<QueueView>(queueList, (job) => String(job.jobId), createQueueRow, patchQueueRow);

  const filterRow = el("div", { cls: "tri-chip-row tri-build-filters" });
  root.appendChild(filterRow);
  const erasBox = el("div", { cls: "tri-build-eras" });
  root.appendChild(erasBox);
  const empty = emptyBox("当前没有可建造的建筑 · 检查科技与时代前置");
  root.appendChild(empty);

  const eraSections: EraSection[] = [];
  let filter = "all";
  let categories: CategoryTab[] = [];
  let lastView: ViewModel | null = null;

  delegate(root, "[data-build-filter]", "click", (_ev, target) => {
    const next = target.dataset.buildFilter;
    if (!next) return;
    filter = next;
    applyFilter();
  });
  delegate(root, "[data-action='start-building']", "click", (_ev, target) => {
    const id = target.dataset.buildingId;
    if (!id) return;
    shell.api()?.actions.startBuilding(id);
    shell.requestRefresh();
  });
  delegate(root, "[data-action='upgrade-building']", "click", (_ev, target) => {
    const id = target.dataset.buildingId;
    if (!id) return;
    shell.api()?.actions.upgradeBuilding(id);
    shell.requestRefresh();
  });
  delegate(root, "[data-action='cancel-build']", "click", (_ev, target) => {
    const jobId = Number(target.dataset.jobId);
    if (!Number.isFinite(jobId)) return;
    shell.api()?.actions.cancelConstruction(jobId);
    shell.requestRefresh();
  });

  function ensureEraSections(currentEra: number): void {
    if (eraSections.length === ERA_COUNT) {
      for (const section of eraSections) setSectionLock(section, currentEra);
      return;
    }
    for (let era = 1; era <= ERA_COUNT; era += 1) {
      const info = eraInfo(era);
      const sectionEl = el("section", { cls: "tri-build-era", attrs: { "data-era": String(era) } });
      const head = el("header", { cls: "tri-build-era-head" });
      head.appendChild(eraTag(era));
      head.appendChild(el("span", { cls: "tri-build-era-name", text: info.name }));
      head.appendChild(el("span", { cls: "tri-build-era-sub", text: info.subtitle }));
      const count = el("span", { cls: "tri-build-era-count", text: "0 项" });
      head.appendChild(count);
      sectionEl.appendChild(head);
      const grid = el("div", { cls: "tri-build-grid" });
      sectionEl.appendChild(grid);
      const lockMask = el("div", { cls: "tri-build-era-lock tri-hidden" });
      const lockInner = el("div", { cls: "tri-build-era-lock-inner" });
      lockInner.appendChild(icon("lock", 16));
      lockInner.appendChild(el("span", { cls: "tri-build-era-lock-text", text: "E" + era + " 解锁" }));
      lockMask.appendChild(lockInner);
      sectionEl.appendChild(lockMask);
      erasBox.appendChild(sectionEl);
      const rows = new KeyedList<BuildingView>(grid, (building) => building.id, createBuildCard, patchBuildCard);
      const section: EraSection = { era, root: sectionEl, grid, count, lockMask, rows };
      eraSections.push(section);
      setSectionLock(section, currentEra);
    }
  }

  function setSectionLock(section: EraSection, currentEra: number): void {
    const locked = section.era > currentEra;
    section.root.dataset.locked = locked ? "true" : "false";
    section.lockMask.classList.toggle("tri-hidden", !locked);
    const label = q(section.lockMask, ".tri-build-era-lock-text");
    if (label) label.textContent = "E" + section.era + " " + eraInfo(section.era).name + " 解锁";
  }

  function ensureCategories(view: ViewModel): void {
    const seen = new Map<string, string>();
    for (const building of view.buildings.available) {
      if (!seen.has(building.category)) seen.set(building.category, building.categoryName);
    }
    const next: CategoryTab[] = [{ id: "all", label: "全部" }, ...Array.from(seen, ([id, label]) => ({ id, label }))];
    if (JSON.stringify(next) === JSON.stringify(categories)) return;
    categories = next;
    clear(filterRow);
    for (const category of categories) {
      const button = el("button", {
        cls: "tri-chip tri-chip-btn" + (category.id === filter ? " is-active" : ""),
        text: category.label,
        attrs: { type: "button", "data-build-filter": category.id },
      });
      filterRow.appendChild(button);
    }
  }

  function applyFilter(): void {
    const view = lastView;
    if (!view) return;
    const currentEra = view.buildings.currentEra ?? view.civ.era.value;
    ensureEraSections(currentEra);
    let total = 0;
    let visible = 0;
    for (const section of eraSections) {
      const list = view.buildings.available.filter(
        (building) => buildingEraOf(building) === section.era && (filter === "all" || building.category === filter),
      );
      total += view.buildings.available.filter((building) => buildingEraOf(building) === section.era).length;
      visible += list.length;
      section.rows.update(list);
      setText(section.count, list.length + " 项" + (section.era > currentEra ? " · 时代锁定" : ""));
      section.root.classList.toggle("tri-hidden", view.buildings.available.length > 0 && list.length === 0);
    }
    for (const button of filterRow.querySelectorAll<HTMLElement>("[data-build-filter]")) {
      setClass(button, "is-active", button.dataset.buildFilter === filter);
    }
    empty.classList.toggle("tri-hidden", view.buildings.available.length === 0);
    if (view.buildings.available.length > 0 && visible === 0 && total > 0) {
      empty.classList.remove("tri-hidden");
      setText(empty, "该分类下没有建筑 · 切换分类或推进时代");
    } else {
      empty.classList.add("tri-hidden");
    }
  }

  function update(view: ViewModel): void {
    lastView = view;
    ensureCategories(view);
    const buildings = view.buildings;
    const currentEra = buildings.currentEra ?? view.civ.era.value;
    setText(summaryQueue, "施工队列 " + buildings.queue.length + " 项");
    setText(
      summaryIndustry,
      "工业产能 " + num(view.civ.industry.used, 1) + " / " + num(view.civ.industry.capacity, 1) + " · 空闲 " + num(view.civ.industry.free, 1),
    );
    setText(
      summaryMaintenance,
      buildings.totalMaintenance.length === 0
        ? "维护：无"
        : "维护：" + buildings.totalMaintenance.map((cost) => cost.name + " " + num(cost.amount, 1) + "/回合").join(" · "),
    );
    setText(
      summaryEra,
      "当前 E" + currentEra + " " + eraInfo(currentEra).name + " · 可升级 " + (buildings.upgradableCount ?? 0) + " 座",
    );
    queueEmpty.classList.toggle("tri-hidden", buildings.queue.length > 0);
    queueRows.update(buildings.queue);
    applyFilter();
  }

  const view = shell.view();
  if (view) update(view);
  return {
    el: root,
    update,
    destroy() {
      /* element listeners are removed with the subtree */
    },
  };
}

function buildingEraOf(building: BuildingView): number {
  const era = typeof building.era === "number" && Number.isFinite(building.era) ? building.era : 1;
  return Math.min(ERA_COUNT, Math.max(1, Math.round(era)));
}

/* ------------------------------------------------------------------ *
 *  Building cards                                                    *
 * ------------------------------------------------------------------ */

interface CardHandles {
  card: HTMLElement;
  count: HTMLElement;
  maintenance: HTMLElement;
  reason: HTMLElement;
  buildBtn: HTMLButtonElement;
  turns: HTMLElement;
  workers: HTMLElement;
  flags: HTMLElement;
  upgradeBox: HTMLElement;
  upgradeTitle: HTMLElement;
  upgradeMeta: HTMLElement;
  upgradeCosts: HTMLElement;
  upgradeReason: HTMLElement;
  upgradeBtn: HTMLButtonElement;
  upgradeKey: string;
}

function createBuildCard(building: BuildingView): HTMLElement {
  const card = el("div", { cls: "tri-build-card", attrs: { "data-building": building.id } });
  const head = el("div", { cls: "tri-build-head" });
  const iconWrap = el("span", { cls: "tri-build-icon" });
  iconWrap.appendChild(icon(building.icon || "build", 19));
  const titleWrap = el("div", { cls: "tri-build-title" });
  const titleRow = el("div", { cls: "tri-build-title-row" });
  titleRow.appendChild(el("span", { cls: "tri-build-name", text: building.name }));
  titleRow.appendChild(eraTag(building.era));
  titleRow.appendChild(tierTicks(building.tier));
  const cat = el("span", { cls: "tri-build-cat", text: building.categoryName });
  append(titleWrap, titleRow, cat);
  const count = el("span", { cls: "tri-build-count", text: "—" });
  append(head, iconWrap, titleWrap, count);
  const flags = el("div", { cls: "tri-build-flags" });
  const desc = el("p", { cls: "tri-build-desc", text: building.description });
  const costs = el("div", { cls: "tri-build-costs" });
  for (const cost of building.cost) costs.appendChild(createCostChip(cost));
  const meta = el("div", { cls: "tri-build-meta" });
  const turns = el("span", { cls: "tri-build-turns", text: "工期 " + building.buildTurns + " 回合" });
  const workers = el("span", { cls: "tri-build-workers", text: "用工 " + building.workers });
  const maintenance = el("span", { cls: "tri-build-maint" });
  append(meta, turns, workers, maintenance);
  const effects = el("ul", { cls: "tri-build-effects" });
  for (const effect of building.effects) effects.appendChild(el("li", { text: effect }));

  const footer = el("div", { cls: "tri-build-footer" });
  const reason = el("span", { cls: "tri-build-reason", text: "" });
  const buildBtn = el("button", { cls: "tri-btn tri-btn-primary tri-btn-sm", attrs: { type: "button", "data-action": "start-building" } });
  buildBtn.appendChild(icon("build", 14));
  buildBtn.appendChild(el("span", { cls: "tri-btn-label", text: "建造" }));
  append(footer, reason, buildBtn);

  const upgradeBox = el("div", { cls: "tri-build-upgrade tri-hidden" });
  const upgradeHead = el("div", { cls: "tri-build-upgrade-head" });
  const upgradeTitle = el("span", { cls: "tri-build-upgrade-title", text: "" });
  const upgradeMeta = el("span", { cls: "tri-build-upgrade-meta", text: "" });
  append(upgradeHead, upgradeTitle, upgradeMeta);
  const upgradeCosts = el("div", { cls: "tri-build-costs tri-build-upgrade-costs" });
  const upgradeReason = el("div", { cls: "tri-build-upgrade-reason", text: "" });
  const upgradeBtn = el("button", {
    cls: "tri-btn tri-btn-primary tri-btn-sm",
    attrs: { type: "button", "data-action": "upgrade-building" },
  });
  upgradeBtn.appendChild(icon("chevronUp", 14));
  upgradeBtn.appendChild(el("span", { cls: "tri-btn-label", text: "升级" }));
  append(upgradeBox, upgradeHead, upgradeCosts, upgradeReason, upgradeBtn);

  append(card, head, flags, desc, costs, meta, effects, upgradeBox, footer);
  handles.set(card, {
    card,
    count,
    maintenance,
    reason,
    buildBtn,
    turns,
    workers,
    flags,
    upgradeBox,
    upgradeTitle,
    upgradeMeta,
    upgradeCosts,
    upgradeReason,
    upgradeBtn,
    upgradeKey: "",
  });
  return card;
}

const handles = new WeakMap<HTMLElement, CardHandles>();

function patchBuildCard(node: HTMLElement, building: BuildingView): void {
  const view = handles.get(node);
  if (!view) return;
  setText(view.count, building.maxCount == null ? "已建 " + building.count : "已建 " + building.count + " / " + building.maxCount);
  setText(view.turns, "工期 " + building.buildTurns + " 回合");
  setText(view.workers, "用工 " + building.workers);
  setText(
    view.maintenance,
    building.maintenance.length === 0
      ? "维护 无"
      : "维护 " + building.maintenance.map((cost) => cost.name + " " + num(cost.amount, 2)).join(" · ") + "/回合",
  );
  setText(view.reason, building.canBuild ? "" : building.blockedReason ?? "条件不足");
  view.buildBtn.disabled = !building.canBuild;
  view.buildBtn.title = building.canBuild ? "建造 " + building.name : building.blockedReason ?? "条件不足";
  view.buildBtn.dataset.buildingId = building.id;
  setClass(node, "is-locked", !building.canBuild);
  node.dataset.era = String(buildingEraOf(building));
  node.dataset.count = String(building.count);

  // flags: outdated / upgraded chain hint
  clear(view.flags);
  if (building.outdated) view.flags.appendChild(outdatedBadge(building.era));
  if (building.upgradeToId && building.count > 0) {
    const chain = el("span", { cls: "tri-build-chain" });
    chain.appendChild(icon("chevronUp", 11));
    chain.appendChild(el("span", { text: "可升级 → " + (building.upgradeToName ?? "下一层级") }));
    view.flags.appendChild(chain);
  }

  // upgrade section
  const upgradeVisible = Boolean(building.upgradeToId) && building.count > 0;
  view.upgradeBox.classList.toggle("tri-hidden", !upgradeVisible);
  if (!upgradeVisible) return;
  setText(view.upgradeTitle, "升级为 " + (building.upgradeToName ?? "下一层级"));
  setText(view.upgradeMeta, building.upgradeTurns + " 回合 · 保留建筑数量");
  const key =
    building.upgradeCost.map((cost) => cost.resourceId + ":" + cost.amount.toFixed(2)).join("|") +
    "|" +
    (building.upgradeBlockedReason ?? "");
  if (view.upgradeKey !== key) {
    view.upgradeKey = key;
    clear(view.upgradeCosts);
    for (const cost of building.upgradeCost) view.upgradeCosts.appendChild(createCostChip(cost));
  } else {
    const chips = view.upgradeCosts.querySelectorAll<HTMLElement>(".tri-cost-chip");
    let index = 0;
    for (const cost of building.upgradeCost) {
      const chip = chips[index];
      if (chip) {
        chip.dataset.affordable = cost.affordable ? "true" : "false";
        chip.title = "库存 " + num(cost.have) + (cost.affordable ? " · 充足" : " · 不足");
        setText(q(chip, ".tri-cost-chip-amount"), num(cost.amount));
        setText(q(chip, ".tri-cost-chip-have"), "/" + num(cost.have));
      }
      index += 1;
    }
  }
  view.upgradeReason.textContent = building.canUpgrade ? "" : building.upgradeBlockedReason ?? "升级条件不足";
  view.upgradeBtn.disabled = !building.canUpgrade;
  view.upgradeBtn.dataset.buildingId = building.id;
  view.upgradeBtn.title = building.canUpgrade
    ? "升级 " + building.name + " → " + (building.upgradeToName ?? "下一层级")
    : building.upgradeBlockedReason ?? "升级条件不足";
  setClass(view.upgradeBox, "is-blocked", !building.canUpgrade);
}

function createCostChip(cost: FlowCostView): HTMLElement {
  const chipNode = el("span", { cls: "tri-cost-chip", attrs: { "data-resource": cost.resourceId, "data-affordable": cost.affordable ? "true" : "false" } });
  chipNode.appendChild(icon(resourceIconName(cost.resourceId), 13));
  chipNode.appendChild(el("span", { cls: "tri-cost-chip-amount", text: num(cost.amount) }));
  chipNode.appendChild(el("span", { cls: "tri-cost-chip-have", text: "/" + num(cost.have) }));
  return chipNode;
}

/* ------------------------------------------------------------------ *
 *  Construction queue                                                *
 * ------------------------------------------------------------------ */

function createQueueRow(job: QueueView): HTMLElement {
  const row = el("div", { cls: "tri-build-queue-row" });
  const iconWrap = el("span", { cls: "tri-build-queue-icon" });
  iconWrap.appendChild(icon(job.icon || "build", 15));
  const main = el("div", { cls: "tri-build-queue-main" });
  const top = el("div", { cls: "tri-build-queue-top" });
  const kind = el("span", { cls: "tri-queue-kind", text: "新建" });
  top.appendChild(kind);
  top.appendChild(el("span", { cls: "tri-build-queue-name", text: job.name }));
  top.appendChild(el("span", { cls: "tri-build-queue-turns", text: "—" }));
  const meter = meterBar("warn");
  meter.el.classList.add("tri-build-queue-meter");
  const cancel = el("button", { cls: "tri-btn tri-btn-icon tri-btn-danger", attrs: { type: "button", title: "取消施工", "data-action": "cancel-build" } });
  cancel.appendChild(icon("close", 13));
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
    kind.className = "tri-queue-kind is-" + info.kind;
    kind.title = info.detail;
  }
  node.title = info.detail;
  setText(q(node, ".tri-build-queue-name"), job.name);
  setText(q(node, ".tri-build-queue-turns"), "剩余 " + job.turnsLeft + " / " + job.totalTurns + " 回合");
  const meter = q<HTMLElement>(node, ".tri-meter");
  if (meter) {
    meter.dataset.tone = "warn";
    const fill = q<HTMLElement>(meter, ".tri-meter-fill");
    if (fill) fill.style.width = (Math.max(0, Math.min(1, job.progress)) * 100).toFixed(1) + "%";
  }
  const cancel = q<HTMLButtonElement>(node, "[data-action='cancel-build']");
  if (cancel) cancel.dataset.jobId = String(job.jobId);
}
