/**
 * v1.6 科研终端 —— 真正的树状科技图（SVG 连线 + 节点、分支/时代筛选、缩放与滚动）
 * 同时保留：开始/中止研究、互斥教义、学派重心、发展纲领、科研资源倾斜、注入资源加速。
 * 视觉样式在 research-v6.css（不改动全局 styles.css / theme-print.css）。
 */
import "./research-v6.css";
import type {
  DevelopmentCategoryView, DoctrineGroupView, TechBranchView, TechSchoolView, TechView, ViewModel,
} from "../game/viewTypes";
import type { ResearchCategory, TechSchool } from "../core/types";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, setClass, setText } from "./dom";
import { icon } from "./icons";
import { num, pct, signed } from "./format";
import { ERA_INFOS } from "./era-ui";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 132;
const NODE_H = 32;
const COL_GAP = 52;
const ROW_PAD = 18;
const ROW_GAP = 22;
const LEFT_PAD = 128;
const TOP_PAD = 34;

interface NodePos {
  x: number;
  y: number;
  tech: TechView;
  branchId: string;
}

export function buildResearchModal(shell: GameShell, _close: () => void): ModalInstance {
  let current: ViewModel | null = shell.view();
  let filterBranch = "";
  let filterEra = 0;
  let filterSchool: TechSchool | null = null;
  let selectedTechId: string | null = null;
  let scale = 0.72;
  let signature = "";
  let pendingDev: ResearchCategory[] | null = null;
  let fundingDraft: number | null = null;

  const root = el("div", { cls: "tri-techbook tri-v6" });
  const head = el("div", { cls: "tri-v6-head" });
  const controls = el("div", { cls: "tri-v6-controls" });
  const body = el("div", { cls: "tri-v6-body" });
  const side = el("aside", { cls: "tri-v6-side" });
  const scroll = el("div", { cls: "tri-v6-scroll" });
  const svgHost = el("div", { cls: "tri-v6-svghost" });
  const drawer = el("aside", { cls: "tri-v6-drawer tri-hidden" });
  scroll.appendChild(svgHost);
  append(body, side, scroll, drawer);
  append(root, head, controls);

  const branchSelect = el("select", { cls: "tri-v6-select", attrs: { "data-v6-control": "branch", title: "按分支筛选" } });
  branchSelect.appendChild(el("option", { text: "全部分支", attrs: { value: "" } }));
  const eraSelect = el("select", { cls: "tri-v6-select", attrs: { "data-v6-control": "era", title: "按时代筛选" } });
  eraSelect.appendChild(el("option", { text: "全部时代", attrs: { value: "0" } }));
  for (const era of ERA_INFOS) eraSelect.appendChild(el("option", { text: "E" + era.era + " " + era.name, attrs: { value: String(era.era) } }));
  const schoolSelect = el("select", { cls: "tri-v6-select", attrs: { "data-v6-control": "school", title: "按学说筛选" } });
  schoolSelect.appendChild(el("option", { text: "全部学说", attrs: { value: "" } }));
  const zoomOut = el("button", { cls: "tri-v6-btn", attrs: { type: "button", title: "缩小" } });
  zoomOut.appendChild(icon("zoomOut", 14));
  const zoomReset = el("button", { cls: "tri-v6-btn", attrs: { type: "button", title: "重置缩放" }, text: "1:1" });
  const zoomIn = el("button", { cls: "tri-v6-btn", attrs: { type: "button", title: "放大" } });
  zoomIn.appendChild(icon("zoomIn", 14));
  const fundingValue = el("span", { cls: "tri-v6-funding-value", text: "50%" });
  const fundingSlider = el("input", { cls: "tri-v6-range", attrs: { type: "range", min: "0", max: "100", step: "5", value: "50", title: "科研资源倾斜 0~100%" } });
  const fundingMeta = el("span", { cls: "tri-v6-funding-meta", text: "研究 ×1.00 · 其他产出 ×1.00" });
  const boostBtn = el("button", { cls: "tri-v6-btn tri-v6-btn-ghost", attrs: { type: "button" } });
  const devChips = el("div", { cls: "tri-v6-devchips" });
  const devConfirm = el("button", { cls: "tri-v6-btn tri-v6-btn-primary", attrs: { type: "button" }, text: "确认纲领" });
  const devHint = el("span", { cls: "tri-v6-devhint", text: "" });

  append(
    controls,
    el("span", { cls: "tri-v6-ctrl-label", text: "筛选" }),
    branchSelect, eraSelect, schoolSelect,
    el("span", { cls: "tri-v6-ctrl-sep" }),
    zoomOut, zoomReset, zoomIn,
    el("span", { cls: "tri-v6-ctrl-sep" }),
    el("span", { cls: "tri-v6-ctrl-label", text: "资源倾斜" }), fundingSlider, fundingValue,
    el("span", { cls: "tri-v6-ctrl-sep" }),
    boostBtn,
  );
  const devBar = el("div", { cls: "tri-v6-devbar" });
  append(
    devBar,
    el("span", { cls: "tri-v6-ctrl-label", text: "发展纲领" }),
    devChips, devConfirm, devHint,
  );
  append(root, devBar, body);

  branchSelect.addEventListener("change", () => { filterBranch = branchSelect.value; render(true); });
  eraSelect.addEventListener("change", () => { filterEra = Number(eraSelect.value) || 0; render(true); });
  schoolSelect.addEventListener("change", () => { filterSchool = (schoolSelect.value as TechSchool) || null; render(true); });
  zoomOut.addEventListener("click", () => { scale = Math.max(0.36, Math.round((scale - 0.08) * 100) / 100); applyScale(); });
  zoomIn.addEventListener("click", () => { scale = Math.min(1.3, Math.round((scale + 0.08) * 100) / 100); applyScale(); });
  zoomReset.addEventListener("click", () => { scale = 0.72; applyScale(); });
  fundingSlider.addEventListener("input", () => {
    fundingDraft = Number(fundingSlider.value);
    updateFundingText();
  });
  fundingSlider.addEventListener("change", () => {
    const api = shell.api();
    if (!api) return;
    api.actions.setResearchFunding(Number(fundingSlider.value));
    shell.requestRefresh();
  });
  boostBtn.addEventListener("click", () => {
    shell.api()?.actions.boostResearch();
    shell.requestRefresh();
  });
  devConfirm.addEventListener("click", () => {
    const api = shell.api();
    if (!api || !pendingDev || pendingDev.length === 0) return;
    api.actions.chooseDevelopmentCategories([...pendingDev]);
    shell.requestRefresh();
  });
  devChips.addEventListener("click", (ev) => {
    const target = (ev.target as Element | null)?.closest("[data-dev-category]") as HTMLElement | null;
    if (!target) return;
    const category = target.dataset.devCategory as ResearchCategory | undefined;
    if (!category) return;
    const list = pendingDev ? [...pendingDev] : [];
    const index = list.indexOf(category);
    if (index >= 0) list.splice(index, 1);
    else if (list.length < 2) list.push(category);
    pendingDev = list;
    renderDev();
  });

  const offAction = delegate(root, "[data-v6-action]", "click", (_ev, target) => {
    const action = target.dataset.v6Action;
    const api = shell.api();
    if (!api || !action) return;
    if (action === "tech") {
      selectedTechId = target.dataset.techId ?? null;
      renderDrawer();
      return;
    }
    if (action === "close-drawer") {
      selectedTechId = null;
      renderDrawer();
      return;
    }
    if (action === "research") {
      const techId = target.dataset.techId;
      if (techId) api.actions.startResearch(techId);
      shell.requestRefresh();
      renderDrawer();
      return;
    }
    if (action === "cancel") {
      api.actions.cancelResearch();
      shell.requestRefresh();
      return;
    }
    if (action === "doctrine") {
      const techId = target.dataset.techId;
      if (techId) api.actions.chooseDoctrine(techId);
      shell.requestRefresh();
      return;
    }
    if (action === "school-focus") {
      const school = target.dataset.school as TechSchool | "";
      api.actions.chooseSchoolFocus(school ? (school as TechSchool) : null);
      shell.requestRefresh();
      return;
    }
  });

  function treeSignature(view: ViewModel): string {
    const tech = view.tech;
    if (!tech) return "";
    return [
      tech.researchedTotal, tech.totalTechs, tech.activeTechId ?? "-",
      tech.schoolFocus ?? "-",
      tech.doctrines.map((group) => group.id + ":" + (group.chosenTechId ?? "-")).join("|"),
      (tech.development?.categories ?? []).join(","),
      filterBranch, filterEra, filterSchool ?? "-", selectedTechId ?? "-",
    ].join("#");
  }

  function applyScale(): void {
    const svg = svgHost.querySelector("svg");
    if (!svg) return;
    const baseW = Number(svg.dataset.basew ?? 0);
    const baseH = Number(svg.dataset.baseh ?? 0);
    if (baseW <= 0 || baseH <= 0) return;
    svg.setAttribute("width", String(Math.round(baseW * scale)));
    svg.setAttribute("height", String(Math.round(baseH * scale)));
  }

  /* ------------------------------ header --------------------------- */
  function renderHead(): void {
    clear(head);
    const view = current;
    const tech = view?.tech;
    if (!view || !tech) {
      head.appendChild(el("p", { cls: "tri-pol-hint", text: "科技档案尚未解封。" }));
      return;
    }
    const science = view.civ.science;
    const left = el("div", { cls: "tri-v6-headmain" });
    left.appendChild(el("span", { cls: "tri-v6-kicker", text: "// RESEARCH TREE v1.6 · 9 分支 × 6 时代 × " + tech.totalTechs + " 项" }));
    const active = el("div", { cls: "tri-v6-active" });
    active.appendChild(el("span", { cls: "tri-v6-activename", text: science.activeTechName ?? "无在研项目" }));
    if (science.activeTechName) {
      active.appendChild(el("span", { cls: "tri-v6-activemeta", text: "进度 " + pct(science.percent, 0) + " · " + num(science.progress) + " / " + num(science.cost) + " · 预计 " + (science.etaTurns == null ? "—" : science.etaTurns + " 回合") }));
      const cancel = el("button", { cls: "tri-v6-btn tri-v6-btn-ghost", attrs: { type: "button", "data-v6-action": "cancel" } });
      cancel.appendChild(icon("close", 12));
      cancel.appendChild(el("span", { text: "中止" }));
      active.appendChild(cancel);
    }
    left.appendChild(active);
    const track = el("span", { cls: "tri-v6-track" });
    const fill = el("span", { cls: "tri-v6-trackfill" });
    fill.style.width = Math.max(0, Math.min(100, science.percent * 100)) + "%";
    track.appendChild(fill);
    left.appendChild(track);
    const speed = tech.activeSpeed;
    const speedText = speed
      ? "研究速度 ×" + speed.total.toFixed(2) + "（学派 ×" + speed.schoolFactor.toFixed(2) + " · 纲领 ×" + speed.developmentFactor.toFixed(2) + " · 倾斜 ×" + speed.fundingFactor.toFixed(2) + " · 科学院 ×" + speed.academyFactor.toFixed(2) + "）"
      : "已研究 " + tech.researchedTotal + " / " + tech.totalTechs + " 项科技";
    left.appendChild(el("span", { cls: "tri-v6-headmeta", text: "科研速率 " + signed(science.rate, 1) + " / 回合 · " + speedText }));
    head.appendChild(left);

    const right = el("div", { cls: "tri-v6-headstats" });
    const funding = tech.funding;
    right.appendChild(el("span", { cls: "tri-v6-kicker", text: "// POLICY" }));
    right.appendChild(el("span", { cls: "tri-v6-headmeta", text: "资源倾斜 " + Math.round(funding?.percent ?? 50) + "% · 研究 ×" + (funding?.researchSpeed ?? 1).toFixed(2) + " · 非科研产出 ×" + (funding?.otherProduction ?? 1).toFixed(2) }));
    const chosen = tech.development?.categories ?? [];
    const devNames = chosen.map((id) => (id === "natural" ? "自然科学" : id === "engineering" ? "工程应用" : "社会科学"));
    right.appendChild(el("span", { cls: "tri-v6-headmeta", text: chosen.length > 0 ? "发展纲领：" + devNames.join(" + ") + "（已选 +10% / 未选 -35%）" : "发展纲领：未选择（E3 起可选 1~2 个大类）" }));
    head.appendChild(right);
  }

  /* ------------------------------ controls ------------------------- */
  function renderControls(): void {
    const tech = current?.tech;
    if (!tech) return;
    branchSelect.value = filterBranch;
    eraSelect.value = String(filterEra);
    schoolSelect.value = filterSchool ?? "";
    if (schoolSelect.options.length <= 1) {
      for (const school of tech.schools) schoolSelect.appendChild(el("option", { text: school.name, attrs: { value: school.id } }));
    }
    if (fundingDraft == null) fundingDraft = Math.round(tech.funding?.percent ?? 50);
    if (document.activeElement !== fundingSlider) fundingSlider.value = String(Math.round(tech.funding?.percent ?? 50));
    updateFundingText();
    const boost = tech.boost;
    if (boost && boost.techName) {
      boostBtn.disabled = !boost.available;
      const costText = boost.cost.map((cost) => cost.name + " " + num(cost.amount)).join(" / ") || "—";
      setText(boostBtn, boost.available
        ? "注入资源加速 · +" + num(boost.gain) + " 进度（" + costText + "）"
        : "注入资源加速不可用" + (boost.reason ? "：" + boost.reason : ""));
    } else {
      boostBtn.disabled = true;
      setText(boostBtn, "注入资源加速 · 需先选择研究项目");
    }
    renderDev();
  }

  function updateFundingText(): void {
    const tech = current?.tech;
    if (!tech) return;
    const percent = fundingDraft ?? Math.round(tech.funding?.percent ?? 50);
    const researchSpeed = percent <= 50 ? 0.6 + (percent / 50) * 0.4 : 1 + ((percent - 50) / 50) * 0.35;
    const other = 1.1 + (0.9 - 1.1) * (percent / 100);
    setText(fundingValue, Math.round(percent) + "%");
    setText(fundingMeta, "研究 ×" + researchSpeed.toFixed(2) + " · 其他产出 ×" + other.toFixed(2));
    if (document.activeElement !== fundingSlider) fundingSlider.value = String(Math.round(percent));
  }

  function renderDev(): void {
    const tech = current?.tech;
    if (!tech) return;
    const development = tech.development;
    if (!development) return;
    if (pendingDev == null) pendingDev = [...development.categories];
    clear(devChips);
    for (const option of development.options as DevelopmentCategoryView[]) {
      const selected = pendingDev.includes(option.id);
      const btn = el("button", {
        cls: "tri-v6-chip" + (selected ? " is-selected" : ""),
        attrs: { type: "button", "data-dev-category": option.id, title: option.description },
      });
      btn.appendChild(el("span", { cls: "tri-v6-chip-name", text: option.name }));
      btn.appendChild(el("span", { cls: "tri-v6-chip-count", text: option.researchedCount + "/" + option.total }));
      devChips.appendChild(btn);
    }
    const disabled = !development.unlocked || !pendingDev || pendingDev.length === 0;
    devConfirm.disabled = disabled;
    setText(devHint, development.unlocked
      ? "已选：+10% 研究速度 · 未选：-35%（1~2 个大类）"
      : "E3 蒸汽纪元起可以确定发展纲领");
  }

  /* ------------------------------ tree ----------------------------- */
  function renderTree(): void {
    const view = current;
    if (!view?.tech) return;
    clear(svgHost);
    const branches = view.tech.branches;
    // layout: rows = branches, columns = eras
    const rowHeights = branches.map((branch) => {
      let maxCount = 2;
      for (const era of ERA_INFOS) {
        const count = branch.techs.filter((tech) => tech.era === era.era).length;
        maxCount = Math.max(maxCount, count);
      }
      return Math.max(98, maxCount * (NODE_H + 8) + ROW_PAD * 2);
    });
    const baseW = LEFT_PAD + ERA_INFOS.length * (NODE_W + COL_GAP) + 40;
    const baseH = TOP_PAD + rowHeights.reduce((sum, value) => sum + value + ROW_GAP, 0) + 24;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + baseW + " " + baseH);
    svg.dataset.basew = String(baseW);
    svg.dataset.baseh = String(baseH);
    svg.setAttribute("class", "tri-v6-svg");
    const positions = new Map<string, NodePos>();

    // era header
    const headerY = 16;
    for (let i = 0; i < ERA_INFOS.length; i += 1) {
      const era = ERA_INFOS[i];
      const x = LEFT_PAD + i * (NODE_W + COL_GAP);
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", String(x + NODE_W / 2));
      label.setAttribute("y", String(headerY));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "tri-v6-erahead" + (era.era === view.civ.era.value ? " is-current" : ""));
      label.textContent = "E" + era.era + " " + era.name;
      svg.appendChild(label);
    }

    let rowY = TOP_PAD;
    for (let b = 0; b < branches.length; b += 1) {
      const branch = branches[b];
      const rowHeight = rowHeights[b];
      const dimRow = Boolean(filterBranch && filterBranch !== branch.id);
      const band = document.createElementNS(SVG_NS, "rect");
      band.setAttribute("x", "6");
      band.setAttribute("y", String(rowY));
      band.setAttribute("width", String(baseW - 12));
      band.setAttribute("height", String(rowHeight));
      band.setAttribute("rx", "6");
      band.setAttribute("class", "tri-v6-band" + (dimRow ? " is-dim" : "") + (b % 2 === 0 ? " is-alt" : ""));
      band.dataset.branch = branch.id;
      svg.appendChild(band);
      const branchLabel = document.createElementNS(SVG_NS, "text");
      branchLabel.setAttribute("x", "14");
      branchLabel.setAttribute("y", String(rowY + rowHeight / 2 - 4));
      branchLabel.setAttribute("class", "tri-v6-branchlabel");
      branchLabel.textContent = branch.name;
      svg.appendChild(branchLabel);
      const branchCount = document.createElementNS(SVG_NS, "text");
      branchCount.setAttribute("x", "14");
      branchCount.setAttribute("y", String(rowY + rowHeight / 2 + 13));
      branchCount.setAttribute("class", "tri-v6-branchcount");
      branchCount.textContent = branch.researchedCount + " / " + branch.total;
      svg.appendChild(branchCount);

      for (let e = 0; e < ERA_INFOS.length; e += 1) {
        const era = ERA_INFOS[e];
        const list = branch.techs.filter((tech) => tech.era === era.era);
        const cellX = LEFT_PAD + e * (NODE_W + COL_GAP);
        const totalH = list.length * (NODE_H + 8);
        let y = rowY + (rowHeight - totalH) / 2 + 4;
        for (const tech of list) {
          positions.set(tech.id, { x: cellX, y, tech, branchId: branch.id });
          y += NODE_H + 8;
        }
      }
      rowY += rowHeight + ROW_GAP;
    }

    // edges first
    const edgeLayer = document.createElementNS(SVG_NS, "g");
    for (const tech of branches.flatMap((branch) => branch.techs)) {
      const child = positions.get(tech.id);
      if (!child) continue;
      for (const req of tech.requires) {
        const parent = positions.get(req);
        if (!parent) continue;
        const x1 = parent.x + NODE_W;
        const y1 = parent.y + NODE_H / 2;
        const x2 = child.x;
        const y2 = child.y + NODE_H / 2;
        const mid = x1 + Math.max(18, (x2 - x1) / 2);
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", "M" + x1 + " " + y1 + " C" + mid + " " + y1 + " " + mid + " " + y2 + " " + x2 + " " + y2);
        path.setAttribute("class", "tri-v6-edge" + edgeStateClass(parent.tech, tech, filterBranch, filterEra, filterSchool));
        edgeLayer.appendChild(path);
      }
    }
    svg.appendChild(edgeLayer);

    // nodes
    const nodeLayer = document.createElementNS(SVG_NS, "g");
    for (const entry of positions.values()) {
      const tech = entry.tech;
      const dim = (filterBranch && filterBranch !== entry.branchId)
        || (filterEra !== 0 && filterEra !== tech.era)
        || (filterSchool !== null && tech.school !== filterSchool);
      const state = tech.researched ? "researched" : tech.isActive ? "active" : tech.blockedReason ? "locked" : tech.available ? "available" : "blocked";
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", "tri-v6-node is-" + state + (dim ? " is-dim" : "") + (selectedTechId === tech.id ? " is-selected" : "") + (tech.exclusiveBlockedBy ? " is-doctrine-blocked" : ""));
      group.setAttribute("transform", "translate(" + entry.x + " " + entry.y + ")");
      group.dataset.techId = tech.id;
      group.dataset.branch = entry.branchId;
      group.dataset.tech = tech.id;
      group.dataset.available = tech.available ? "true" : "false";
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("data-v6-action", "tech");
      group.setAttribute("title", tech.name + " · " + tech.effectSummary + (tech.blockedReason ? "（" + tech.blockedReason + "）" : ""));
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("width", String(NODE_W));
      rect.setAttribute("height", String(NODE_H));
      rect.setAttribute("rx", "5");
      rect.setAttribute("class", "tri-v6-noderect");
      const name = document.createElementNS(SVG_NS, "text");
      name.setAttribute("x", "8");
      name.setAttribute("y", "14");
      name.setAttribute("class", "tri-v6-nodename");
      name.textContent = tech.name.length > 11 ? tech.name.slice(0, 10) + "…" : tech.name;
      const meta = document.createElementNS(SVG_NS, "text");
      meta.setAttribute("x", "8");
      meta.setAttribute("y", "26");
      meta.setAttribute("class", "tri-v6-nodemeta");
      meta.textContent = "T" + tech.tier + " · " + num(tech.cost) + (tech.researched ? " · 已完成" : tech.isActive ? " · 研究中" : "");
      group.append(rect, name, meta);
      nodeLayer.appendChild(group);
    }
    svg.appendChild(nodeLayer);
    svgHost.appendChild(svg);
    applyScale();
  }

  function edgeStateClass(parent: TechView, child: TechView, branch: string, era: number, school: TechSchool | null): string {
    if (filterBranch && filterBranch !== branch) return " is-dim";
    if (filterEra !== 0 && filterEra !== (parent.era as number) && filterEra !== (child.era as number)) return " is-dim";
    if (school && parent.school !== school && child.school !== school) return " is-dim";
    return child.researched ? " is-done" : parent.researched ? " is-open" : "";
  }

  /* ------------------------------ sidebar -------------------------- */
  function renderSide(): void {
    const view = current;
    if (!view?.tech) return;
    const tech = view.tech;
    clear(side);
    const schoolHead = el("div", { cls: "tri-v6-sidehead" });
    schoolHead.appendChild(el("span", { cls: "tri-v6-kicker", text: "// SCHOOLS · 研究重心" }));
    side.appendChild(schoolHead);
    for (const school of tech.schools) side.appendChild(renderSchoolRow(school));
    if (tech.schoolFocus) {
      const clearFocus = el("button", { cls: "tri-v6-btn tri-v6-btn-ghost", attrs: { type: "button", "data-v6-action": "school-focus", "data-school": "" }, text: "取消研究重心" });
      side.appendChild(clearFocus);
    }
    const docHead = el("div", { cls: "tri-v6-sidehead" });
    docHead.appendChild(el("span", { cls: "tri-v6-kicker", text: "// DOCTRINES · 互斥教义" }));
    side.appendChild(docHead);
    if (tech.doctrines.length === 0) {
      side.appendChild(el("p", { cls: "tri-v6-hint", text: "当前时代尚未出现互斥教义。" }));
    } else {
      for (const group of tech.doctrines) side.appendChild(renderDoctrine(group));
    }
  }

  function renderSchoolRow(school: TechSchoolView): HTMLElement {
    const row = el("div", { cls: "tri-v6-school" + (school.focused ? " is-focused" : "") });
    const main = el("div", { cls: "tri-v6-schoolmain" });
    const dot = el("span", { cls: "tri-v6-dot" });
    dot.style.background = school.color;
    main.appendChild(dot);
    main.appendChild(el("span", { cls: "tri-v6-schoolname", text: school.name }));
    main.appendChild(el("span", { cls: "tri-v6-schoolcount", text: school.researchedCount + "/" + school.total }));
    row.appendChild(main);
    row.appendChild(el("span", { cls: "tri-v6-schoolsub", text: school.short + " · 精通 " + pct(school.mastery, 0) }));
    const focusBtn = el("button", {
      cls: "tri-v6-btn tri-v6-btn-xs" + (school.focused ? " is-armed" : ""),
      attrs: { type: "button", "data-v6-action": "school-focus", "data-school": school.id, title: "设为研究重心（同派 +15% / 跨派 -5%）" },
      text: school.focused ? "重心" : "设为重点",
    });
    if (school.focused) focusBtn.disabled = true;
    row.appendChild(focusBtn);
    return row;
  }

  function renderDoctrine(group: DoctrineGroupView): HTMLElement {
    const box = el("div", { cls: "tri-v6-doctrine" });
    const headRow = el("div", { cls: "tri-v6-doctrine-head" });
    headRow.appendChild(el("span", { cls: "tri-v6-doctrine-title", text: group.title }));
    const chosen = group.options.find((option) => option.chosen);
    headRow.appendChild(el("span", { cls: "tri-v6-doctrine-state" + (chosen ? " is-chosen" : ""), text: chosen ? "已裁定 · " + chosen.name : "待裁定" }));
    box.appendChild(headRow);
    box.appendChild(el("p", { cls: "tri-v6-doctrine-desc", text: group.description }));
    const options = el("div", { cls: "tri-v6-doctrine-options" });
    for (const option of group.options) {
      const isChosen = group.chosenTechId === option.techId;
      const locked = Boolean(group.chosenTechId) && !isChosen;
      const btn = el("button", {
        cls: "tri-v6-doctrine-opt" + (isChosen ? " is-chosen" : "") + (locked ? " is-locked" : ""),
        attrs: {
          type: "button",
          "data-v6-action": "doctrine",
          "data-tech-id": option.techId,
          title: locked ? "同组教义已被裁定，永久封闭" : option.description,
        },
      });
      btn.appendChild(el("span", { cls: "tri-v6-doctrine-optname", text: option.name }));
      btn.appendChild(el("span", { cls: "tri-v6-doctrine-opttag", text: isChosen ? "已选择" : option.researched ? "已研究" : locked ? "封闭" : "可选" }));
      if (isChosen || locked) btn.disabled = true;
      options.appendChild(btn);
    }
    box.appendChild(options);
    return box;
  }

  /* ------------------------------ drawer --------------------------- */
  function findTech(id: string): TechView | null {
    for (const branch of current?.tech?.branches ?? []) {
      const hit = branch.techs.find((tech) => tech.id === id);
      if (hit) return hit;
    }
    return null;
  }

  function renderDrawer(): void {
    const view = current;
    const selected = selectedTechId ? findTech(selectedTechId) : null;
    if (!selected || !view?.tech) {
      drawer.classList.add("tri-hidden");
      clear(drawer);
      return;
    }
    drawer.classList.remove("tri-hidden");
    clear(drawer);
    const closeBtn = el("button", { cls: "tri-v6-btn tri-v6-btn-icon tri-v6-drawerclose", attrs: { type: "button", "data-v6-action": "close-drawer", title: "收起详情" } });
    closeBtn.appendChild(icon("close", 14));
    drawer.appendChild(closeBtn);
    drawer.appendChild(el("span", { cls: "tri-v6-kicker", text: "// TECH DOSSIER · " + selected.branchName }));
    drawer.appendChild(el("h3", { cls: "tri-v6-drawertitle", text: selected.name }));
    const meta = el("div", { cls: "tri-v6-drawermeta" });
    meta.appendChild(el("span", { cls: "tri-v6-tag", text: "E" + selected.era + " · T" + selected.tier }));
    meta.appendChild(el("span", { cls: "tri-v6-tag", text: num(selected.cost) + " 科研点" }));
    if (selected.schoolName) meta.appendChild(el("span", { cls: "tri-v6-tag", text: selected.schoolName }));
    drawer.appendChild(meta);
    if (selected.flavor) drawer.appendChild(el("blockquote", { cls: "tri-v6-flavor", text: selected.flavor }));
    if (selected.description) drawer.appendChild(el("p", { cls: "tri-v6-desc", text: selected.description }));
    if (selected.descriptionLong) drawer.appendChild(el("p", { cls: "tri-v6-long", text: selected.descriptionLong }));
    if (selected.effectsDetail && selected.effectsDetail.length > 0) {
      const effects = el("div", { cls: "tri-v6-effects" });
      effects.appendChild(el("span", { cls: "tri-v6-kicker", text: "// EFFECTS" }));
      const list = el("ul", { cls: "tri-v6-effectlist" });
      for (const line of selected.effectsDetail) list.appendChild(el("li", { text: line }));
      effects.appendChild(list);
      drawer.appendChild(effects);
    } else if (selected.effectSummary) {
      drawer.appendChild(el("p", { cls: "tri-v6-effectline", text: selected.effectSummary }));
    }
    if (selected.requiresNames.length > 0) {
      drawer.appendChild(el("p", { cls: "tri-v6-req", text: "前置：" + selected.requiresNames.join(" · ") }));
    }
    if (selected.exclusiveGroup) {
      const doctr = el("div", { cls: "tri-v6-doctrine" });
      doctr.appendChild(el("span", { cls: "tri-v6-kicker", text: "// EXCLUSIVE DOCTRINE" }));
      doctr.appendChild(el("p", { cls: "tri-v6-doctrine-desc", text: selected.exclusiveChosen
        ? "此教义已被采纳，同组其他技术永久封闭。"
        : selected.exclusiveBlockedBy
          ? "同组教义已被「" + selected.exclusiveBlockedBy + "」裁定，此项永久封闭。"
          : "与本项同组的互斥技术将在裁定后永久封闭，只能择其一。" }));
      if (!selected.exclusiveChosen && !selected.exclusiveBlockedBy) {
        const pick = el("button", { cls: "tri-v6-btn tri-v6-btn-primary", attrs: { type: "button", "data-v6-action": "doctrine", "data-tech-id": selected.id }, text: "裁定此教义" });
        doctr.appendChild(pick);
      }
      drawer.appendChild(doctr);
    }
    const foot = el("div", { cls: "tri-v6-drawerfoot" });
    if (selected.researched) {
      foot.appendChild(el("span", { cls: "tri-v6-done", text: "✓ 已研究" }));
    } else if (selected.isActive) {
      foot.appendChild(el("span", { cls: "tri-v6-active", text: "研究中 · " + pct(view.civ.science.percent, 0) }));
      foot.appendChild(el("button", { cls: "tri-v6-btn tri-v6-btn-ghost", attrs: { type: "button", "data-v6-action": "cancel" }, text: "中止研究" }));
    } else {
      const researchBtn = el("button", {
        cls: "tri-v6-btn tri-v6-btn-primary",
        attrs: {
          type: "button",
          "data-v6-action": "research",
          "data-tech-id": selected.id,
          "data-action": "start-research",
          "data-available": selected.available ? "true" : "false",
        },
        text: "开始研究 · " + num(selected.cost),
      });
      if (!selected.available || selected.blockedReason || selected.exclusiveBlockedBy) researchBtn.disabled = true;
      foot.appendChild(researchBtn);
      if (selected.blockedReason) foot.appendChild(el("span", { cls: "tri-v6-blocked", text: selected.blockedReason }));
    }
    drawer.appendChild(foot);
  }

  function render(force = false): void {
    const view = current;
    renderHead();
    renderControls();
    if (!view?.tech) return;
    const next = treeSignature(view);
    if (force || next !== signature) {
      signature = next;
      renderTree();
      renderSide();
      renderDrawer();
    }
  }

  return {
    el: root,
    update(view) {
      const activeChanged = (current?.tech?.activeTechId ?? null) !== (view.tech?.activeTechId ?? null);
      current = view;
      if (activeChanged) fundingDraft = null;
      render();
    },
    destroy() {
      offAction();
    },
  };
}
