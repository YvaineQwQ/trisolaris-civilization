/**
 * v1.3 科技树大画册 —— 8 分支 × 5 时代矩阵，支持横向/纵向滚动；
 * 学说筛选、研究重心、互斥教义、流派进度与长文本详情抽屉。
 */
import type { DoctrineGroupView, TechSchoolView, TechView, ViewModel } from "../game/viewTypes";
import type { TechSchool } from "../core/types";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, setClass, setText } from "./dom";
import { icon } from "./icons";
import { num, pct, signed } from "./format";
import { ERA_INFOS } from "./era-ui";

const NO_SCHOOL = "all";
const SELECTED_NONE = "";

export function buildResearchModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-techbook" });
  let current: ViewModel | null = shell.view();
  let filterSchool: TechSchool | null = null;
  let selectedTechId: string | null = null;
  let signature = "";

  const statusBar = el("div", { cls: "tri-techbook-head" });
  const body = el("div", { cls: "tri-techbook-body" });
  const side = el("aside", { cls: "tri-techbook-side" });
  const scroll = el("div", { cls: "tri-techbook-scroll" });
  const matrix = el("div", { cls: "tri-techbook-grid" });
  scroll.appendChild(matrix);
  const drawer = el("aside", { cls: "tri-techbook-drawer tri-hidden" });
  append(body, side, scroll, drawer);
  append(root, statusBar, body);

  const offAction = delegate(root, "[data-tb-action]", "click", (_ev, target) => {
    const action = target.dataset.tbAction;
    const api = shell.api();
    if (!api) return;
    if (action === "tech") {
      const id = target.dataset.techId ?? "";
      selectedTechId = id || null;
      render(true);
      return;
    }
    if (action === "close-drawer") {
      selectedTechId = null;
      render(true);
      return;
    }
    if (action === "research") {
      const techId = target.dataset.techId;
      if (!techId) return;
      api.actions.startResearch(techId);
      shell.requestRefresh();
      return;
    }
    if (action === "cancel") {
      api.actions.cancelResearch();
      shell.requestRefresh();
      return;
    }
    if (action === "doctrine") {
      const techId = target.dataset.techId;
      if (!techId) return;
      api.actions.chooseDoctrine(techId);
      shell.notify("教义已裁定 · 同组其他技术永久封闭", "ok");
      shell.requestRefresh();
      return;
    }
    if (action === "school-focus") {
      const school = target.dataset.school as TechSchool | "";
      api.actions.chooseSchoolFocus(school ? (school as TechSchool) : null);
      shell.requestRefresh();
      return;
    }
    if (action === "filter") {
      const school = target.dataset.school;
      filterSchool = school && school !== NO_SCHOOL ? (school as TechSchool) : null;
      render(true);
    }
  });

  function treeSignature(view: ViewModel): string {
    const tech = view.tech;
    if (!tech) return "";
    const doctrines = tech.doctrines.map((group) => group.id + ":" + (group.chosenTechId ?? "-")).join("|");
    return [
      tech.researchedTotal,
      tech.totalTechs,
      tech.activeTechId ?? "-",
      tech.schoolFocus ?? "-",
      doctrines,
      filterSchool ?? "-",
      selectedTechId ?? "-",
      tech.schools.map((school) => school.researchedCount + ":" + school.points + ":" + Math.round(school.mastery)).join(","),
      Math.round((view.civ.science.percent ?? 0) * 100),
    ].join("#");
  }

  function render(force = false): void {
    const view = current;
    if (!view || !view.tech) {
      setText(statusBar, "");
      clear(statusBar);
      statusBar.appendChild(el("p", { cls: "tri-pol-hint", text: "科技档案尚未解封。" }));
      clear(body);
      body.appendChild(el("p", { cls: "tri-pol-hint", text: "科技树数据接入后，此处将展示 8 大分支 × 5 个时代的完整画册。" }));
      return;
    }
    if (!body.contains(side)) append(body, side, scroll, drawer);
    const nextSignature = treeSignature(view);
    if (!force && nextSignature === signature) return;
    signature = nextSignature;
    renderStatus(view);
    renderSidebar(view);
    renderMatrix(view);
    renderDrawer(view);
  }

  /* ------------------------------ status --------------------------- */
  function renderStatus(view: ViewModel): void {
    const tech = view.tech;
    const science = view.civ.science;
    clear(statusBar);
    const left = el("div", { cls: "tri-techbook-status" });
    left.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// RESEARCH ATLAS · 科技树大画册" }));
    const row = el("div", { cls: "tri-techbook-statusrow" });
    const activeTitle = el("span", { cls: "tri-techbook-activename", text: science.activeTechName ?? "无在研项目" });
    row.appendChild(activeTitle);
    if (science.activeTechName) {
      row.appendChild(el("span", { cls: "tri-techbook-activemeta", text: "进度 " + pct(science.percent, 0) + " · " + num(science.progress) + " / " + num(science.cost) + " · 预计 " + (science.etaTurns == null ? "—" : science.etaTurns + " 回合") }));
      const cancelBtn = el("button", { cls: "tri-btn tri-btn-sm tri-btn-ghost", attrs: { type: "button", "data-tb-action": "cancel" } });
      cancelBtn.appendChild(icon("close", 12));
      cancelBtn.appendChild(el("span", { cls: "tri-btn-label", text: "中止研究" }));
      row.appendChild(cancelBtn);
    }
    left.appendChild(row);
    const track = el("span", { cls: "tri-techbook-progress" });
    const fill = el("span", { cls: "tri-techbook-progressfill" });
    fill.style.width = Math.max(0, Math.min(100, science.percent * 100)) + "%";
    track.appendChild(fill);
    left.appendChild(track);
    left.appendChild(el("span", { cls: "tri-techbook-statusmeta", text: "科研速率 " + signed(science.rate, 1) + " / 回合 · 已研究 " + tech.researchedTotal + " / " + tech.totalTechs }));
    statusBar.appendChild(left);

    const right = el("div", { cls: "tri-techbook-stats" });
    const focus = tech.schools.find((school) => school.focused) ?? null;
    const focusBox = el("div", { cls: "tri-techbook-focus" });
    focusBox.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// RESEARCH FOCUS" }));
    focusBox.appendChild(el("span", { cls: "tri-techbook-focusname", text: focus ? focus.name + " · " + focus.short : "未指定研究重心" }));
    focusBox.appendChild(el("span", { cls: "tri-techbook-focusmeta", text: focus ? "精通 " + pct(focus.mastery, 0) + " · 学派点数 " + num(focus.points) : "指定重心后同派研究 +15%" }));
    right.appendChild(focusBox);
    const counts = el("div", { cls: "tri-techbook-counts" });
    for (const school of tech.schools) {
      const item = el("button", {
        cls: "tri-techbook-count" + (filterSchool === school.id ? " is-active" : "") + (school.focused ? " is-focused" : ""),
        attrs: { type: "button", "data-tb-action": "filter", "data-school": school.id, title: school.description },
      });
      const dot = el("span", { cls: "tri-techbook-schooldot" });
      dot.style.background = school.color;
      item.appendChild(dot);
      item.appendChild(el("span", { cls: "tri-techbook-countname", text: school.short }));
      item.appendChild(el("span", { cls: "tri-techbook-countvalue", text: school.researchedCount + "/" + school.total }));
      counts.appendChild(item);
    }
    right.appendChild(counts);
    statusBar.appendChild(right);
  }

  /* ------------------------------ sidebar -------------------------- */
  function renderSidebar(view: ViewModel): void {
    const tech = view.tech;
    clear(side);
    const schoolHead = el("div", { cls: "tri-techbook-sidehead" });
    schoolHead.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// SCHOOLS · 学派" }));
    schoolHead.appendChild(el("span", { cls: "tri-techbook-sidehint", text: "点击筛选 · 设为重点" }));
    side.appendChild(schoolHead);
    const allBtn = el("button", {
      cls: "tri-techbook-all" + (filterSchool == null ? " is-active" : ""),
      attrs: { type: "button", "data-tb-action": "filter", "data-school": NO_SCHOOL },
    });
    allBtn.appendChild(el("span", { text: "全部学派" }));
    allBtn.appendChild(el("span", { cls: "tri-techbook-allcount", text: tech.researchedTotal + " / " + tech.totalTechs }));
    side.appendChild(allBtn);
    for (const school of tech.schools) side.appendChild(renderSchoolRow(school));
    if (tech.schoolFocus) {
      const clearFocus = el("button", { cls: "tri-btn tri-btn-sm tri-btn-ghost tri-techbook-clearfocus", attrs: { type: "button", "data-tb-action": "school-focus", "data-school": "" } });
      clearFocus.appendChild(el("span", { cls: "tri-btn-label", text: "取消研究重心" }));
      side.appendChild(clearFocus);
    }

    const docHead = el("div", { cls: "tri-techbook-sidehead tri-techbook-dochead" });
    docHead.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// DOCTRINES · 互斥教义" }));
    docHead.appendChild(el("span", { cls: "tri-techbook-sidehint", text: "一经裁定 · 不可回退" }));
    side.appendChild(docHead);
    if (tech.doctrines.length === 0) {
      side.appendChild(el("p", { cls: "tri-pol-hint", text: "当前时代尚未出现互斥教义。" }));
    } else {
      for (const group of tech.doctrines) side.appendChild(renderDoctrine(group));
    }
  }

  function renderSchoolRow(school: TechSchoolView): HTMLElement {
    const row = el("div", { cls: "tri-school" + (school.focused ? " is-focused" : "") + (filterSchool === school.id ? " is-filtered" : "") });
    const main = el("button", { cls: "tri-school-main", attrs: { type: "button", "data-tb-action": "filter", "data-school": school.id, title: school.description } });
    const dot = el("span", { cls: "tri-school-dot" });
    dot.style.background = school.color;
    main.appendChild(dot);
    main.appendChild(el("span", { cls: "tri-school-name", text: school.name }));
    main.appendChild(el("span", { cls: "tri-school-count", text: school.researchedCount + " / " + school.total }));
    const nameRow = el("span", { cls: "tri-school-sub", text: school.short + " · 精通 " + pct(school.mastery, 0) + " · 点数 " + num(school.points) });
    const track = el("span", { cls: "tri-school-track" });
    const fill = el("span", { cls: "tri-school-fill" });
    fill.style.width = school.total > 0 ? Math.max(0, Math.min(100, (school.researchedCount / school.total) * 100)) + "%" : "0%";
    track.appendChild(fill);
    const focusBtn = el("button", {
      cls: "tri-btn tri-btn-xs" + (school.focused ? " is-armed" : ""),
      attrs: { type: "button", "data-tb-action": "school-focus", "data-school": school.id, title: school.focused ? "当前研究重心" : "设为研究重心（同派研究 +15%）" },
    });
    focusBtn.appendChild(el("span", { cls: "tri-btn-label", text: school.focused ? "重心" : "设为重点" }));
    if (school.focused) focusBtn.disabled = true;
    append(row, main, nameRow, track, focusBtn);
    return row;
  }

  function renderDoctrine(group: DoctrineGroupView): HTMLElement {
    const box = el("div", { cls: "tri-doctrine" });
    const head = el("div", { cls: "tri-doctrine-head" });
    head.appendChild(el("span", { cls: "tri-doctrine-title", text: group.title }));
    const chosen = group.options.find((option) => option.chosen);
    head.appendChild(el("span", { cls: "tri-doctrine-state" + (chosen ? " is-chosen" : ""), text: chosen ? "已裁定 · " + chosen.name : "待裁定" }));
    box.appendChild(head);
    box.appendChild(el("p", { cls: "tri-doctrine-desc", text: group.description }));
    const options = el("div", { cls: "tri-doctrine-options" });
    for (const option of group.options) {
      const isChosen = group.chosenTechId === option.techId;
      const locked = Boolean(group.chosenTechId) && !isChosen;
      const btn = el("button", {
        cls: "tri-doctrine-opt" + (isChosen ? " is-chosen" : "") + (locked ? " is-locked" : ""),
        attrs: {
          type: "button",
          "data-tb-action": "doctrine",
          "data-tech-id": option.techId,
          title: locked ? "同组教义已被裁定，永久封闭" : option.description,
        },
      });
      btn.appendChild(el("span", { cls: "tri-doctrine-optname", text: option.name }));
      btn.appendChild(el("span", { cls: "tri-doctrine-opttag", text: isChosen ? "已选择" : option.researched ? "已研究" : locked ? "封闭" : "可选" }));
      if (isChosen || locked) btn.disabled = true;
      options.appendChild(btn);
    }
    box.appendChild(options);
    return box;
  }

  /* ------------------------------ matrix --------------------------- */
  function renderMatrix(view: ViewModel): void {
    const tech = view.tech;
    clear(matrix);
    matrix.appendChild(el("div", { cls: "tri-tb-corner", text: "分支 / 时代" }));
    for (const era of ERA_INFOS) {
      const head = el("div", { cls: "tri-tb-erahead", attrs: { "data-era": String(era.era) } });
      head.appendChild(el("span", { cls: "tri-tb-eracode", text: "E" + era.era }));
      head.appendChild(el("span", { cls: "tri-tb-eraname", text: era.name }));
      head.appendChild(el("span", { cls: "tri-tb-erasub", text: era.subtitle }));
      matrix.appendChild(head);
    }
    for (const branch of tech.branches) {
      const branchHead = el("div", { cls: "tri-tb-branchhead" });
      const iconWrap = el("span", { cls: "tri-tb-branchicon" });
      iconWrap.appendChild(icon(branch.icon || "research", 15));
      branchHead.appendChild(iconWrap);
      const text = el("span", { cls: "tri-tb-branchtext" });
      text.appendChild(el("span", { cls: "tri-tb-branchname", text: branch.name }));
      text.appendChild(el("span", { cls: "tri-tb-branchcount", text: branch.researchedCount + " / " + branch.total }));
      branchHead.appendChild(text);
      if (branch.color) {
        const strip = el("span", { cls: "tri-tb-branchstrip" });
        strip.style.background = branch.color;
        branchHead.appendChild(strip);
      }
      matrix.appendChild(branchHead);
      for (const era of ERA_INFOS) {
        const cell = el("div", { cls: "tri-tb-cell", attrs: { "data-era": String(era.era) } });
        const entries = branch.techs.filter((entry) => entry.era === era.era);
        if (entries.length === 0) cell.appendChild(el("span", { cls: "tri-tb-empty", text: "—" }));
        for (const entry of entries) cell.appendChild(renderTechCard(entry, branch.id));
        matrix.appendChild(cell);
      }
    }
  }

  function renderTechCard(tech: TechView, branchId: string): HTMLElement {
    const btn = el("button", {
      cls: "tri-tb-card",
      attrs: {
        type: "button",
        "data-tb-action": "tech",
        "data-tech-id": tech.id,
        "data-state": tech.researched ? "researched" : tech.isActive ? "active" : tech.blockedReason ? "locked" : "available",
        "data-branch": branchId,
        title: tech.name + " · " + (tech.effectSummary || "") + (tech.blockedReason ? "（" + tech.blockedReason + "）" : ""),
      },
    });
    if (filterSchool && tech.school && tech.school !== filterSchool) btn.classList.add("is-filtered-out");
    if (tech.exclusiveChosen) btn.classList.add("is-doctrine-chosen");
    if (tech.exclusiveBlockedBy) btn.classList.add("is-doctrine-blocked");
    const head = el("span", { cls: "tri-tb-cardhead" });
    head.appendChild(el("span", { cls: "tri-tb-cardname", text: tech.name }));
    head.appendChild(el("span", { cls: "tri-tb-tier", text: "T" + tech.tier }));
    btn.appendChild(head);
    if (tech.effectSummary) btn.appendChild(el("span", { cls: "tri-tb-effect", text: tech.effectSummary }));
    const meta = el("span", { cls: "tri-tb-meta" });
    meta.appendChild(el("span", { cls: "tri-tb-cost", text: tech.researched ? "已研究" : num(tech.cost) + " 科研" }));
    const state = tech.researched ? "已研究" : tech.isActive ? "研究中" : tech.blockedReason ? "锁定" : tech.exclusiveBlockedBy ? "教义封闭" : "可研究";
    meta.appendChild(el("span", { cls: "tri-tb-state", text: state }));
    if (tech.schoolName) meta.appendChild(el("span", { cls: "tri-tb-school", text: tech.schoolName }));
    btn.appendChild(meta);
    return btn;
  }

  /* ------------------------------ drawer --------------------------- */
  function renderDrawer(view: ViewModel): void {
    const tech = view.tech;
    const selected = selectedTechId ? findTech(tech.branches, selectedTechId) : null;
    if (!selected) {
      selectedTechId = null;
      drawer.classList.add("tri-hidden");
      clear(drawer);
      return;
    }
    drawer.classList.remove("tri-hidden");
    clear(drawer);
    const closeBtn = el("button", { cls: "tri-btn tri-btn-icon tri-techbook-drawerclose", attrs: { type: "button", "data-tb-action": "close-drawer", title: "收起详情（Esc）" } });
    closeBtn.appendChild(icon("close", 15));
    drawer.appendChild(closeBtn);
    const kicker = el("span", { cls: "tri-techbook-drawerkicker", text: "// TECH DOSSIER · " + selected.branchName });
    drawer.appendChild(kicker);
    drawer.appendChild(el("h3", { cls: "tri-techbook-drawertitle", text: selected.name }));
    const meta = el("div", { cls: "tri-techbook-drawermeta" });
    meta.appendChild(el("span", { cls: "tri-tb-tier", text: "T" + selected.tier }));
    meta.appendChild(el("span", { text: "E" + selected.era + " 时代" }));
    meta.appendChild(el("span", { text: num(selected.cost) + " 科研点" }));
    if (selected.schoolName) meta.appendChild(el("span", { cls: "tri-techbook-drawerschool", text: selected.schoolName }));
    drawer.appendChild(meta);
    if (selected.flavor) {
      const quote = el("blockquote", { cls: "tri-techbook-flavor" });
      quote.appendChild(el("span", { text: selected.flavor }));
      drawer.appendChild(quote);
    }
    if (selected.description) drawer.appendChild(el("p", { cls: "tri-techbook-desc", text: selected.description }));
    if (selected.descriptionLong) drawer.appendChild(el("p", { cls: "tri-techbook-long", text: selected.descriptionLong }));
    if (selected.effectsDetail && selected.effectsDetail.length > 0) {
      const effects = el("div", { cls: "tri-techbook-effects" });
      effects.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// EFFECTS" }));
      const list = el("ul", { cls: "tri-techbook-effectlist" });
      for (const line of selected.effectsDetail) list.appendChild(el("li", { text: line }));
      effects.appendChild(list);
      drawer.appendChild(effects);
    } else if (selected.effectSummary) {
      drawer.appendChild(el("p", { cls: "tri-techbook-effectline", text: selected.effectSummary }));
    }
    if (selected.requiresNames.length > 0) {
      drawer.appendChild(el("p", { cls: "tri-techbook-req", text: "前置：" + selected.requiresNames.join(" · ") }));
    }
    if (selected.exclusiveGroup) {
      const doctr = el("div", { cls: "tri-techbook-doctrine" });
      doctr.appendChild(el("span", { cls: "tri-techbook-kicker", text: "// EXCLUSIVE DOCTRINE" }));
      doctr.appendChild(
        el("p", {
          cls: "tri-techbook-doctrine-text",
          text: selected.exclusiveChosen
            ? "此教义已被采纳，同组其他技术永久封闭。"
            : selected.exclusiveBlockedBy
              ? "同组教义已被「" + selected.exclusiveBlockedBy + "」裁定，此项永久封闭。"
              : "与本项同组的互斥技术将在裁定后永久封闭，只能择其一。",
        }),
      );
      if (!selected.exclusiveChosen && !selected.exclusiveBlockedBy) {
        const pick = el("button", { cls: "tri-btn tri-btn-sm", attrs: { type: "button", "data-tb-action": "doctrine", "data-tech-id": selected.id } });
        pick.appendChild(el("span", { cls: "tri-btn-label", text: "裁定此教义" }));
        doctr.appendChild(pick);
      }
      drawer.appendChild(doctr);
    }
    const footer = el("div", { cls: "tri-techbook-drawerfoot" });
    if (selected.researched) {
      footer.appendChild(el("span", { cls: "tri-techbook-done", text: "✓ 已研究" }));
    } else if (selected.isActive) {
      const cancel = el("button", { cls: "tri-btn tri-btn-sm tri-btn-ghost", attrs: { type: "button", "data-tb-action": "cancel" } });
      cancel.appendChild(el("span", { cls: "tri-btn-label", text: "中止研究" }));
      footer.appendChild(el("span", { cls: "tri-techbook-active", text: "研究中 · " + pct(view.civ.science.percent, 0) }));
      footer.appendChild(cancel);
    } else {
      const researchBtn = el("button", { cls: "tri-btn tri-btn-sm tri-btn-primary", attrs: { type: "button", "data-tb-action": "research", "data-tech-id": selected.id } });
      researchBtn.appendChild(icon("research", 13));
      researchBtn.appendChild(el("span", { cls: "tri-btn-label", text: "开始研究 · " + num(selected.cost) }));
      if (!selected.available || selected.blockedReason || selected.exclusiveBlockedBy) researchBtn.disabled = true;
      footer.appendChild(researchBtn);
      if (selected.blockedReason) footer.appendChild(el("span", { cls: "tri-techbook-blocked", text: selected.blockedReason }));
    }
    drawer.appendChild(footer);
  }

  return {
    el: root,
    update(view) {
      current = view;
      render();
    },
    destroy() {
      offAction();
    },
  };
}

function findTech(branches: ViewModel["tech"]["branches"], id: string): TechView | null {
  for (const branch of branches) {
    const hit = branch.techs.find((tech) => tech.id === id);
    if (hit) return hit;
  }
  return null;
}
