/**
 * v1.3 政治终端 —— 六部门、部长圆环头像、派系色条、关系矩阵、
 * 任免 / 调解 / 峰会与政治资本。所有操作都绑定真实 GameActions。
 */
import type {
  DepartmentPoliticalView,
  FactionView,
  MinisterView,
  MinisterRelationView,
  PoliticsView,
  ViewModel,
} from "../game/viewTypes";
import type { DepartmentId } from "../core/types";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, delegate, el, setText } from "./dom";
import { icon } from "./icons";
import { num, pct, signed } from "./format";

const TONE_LABEL: Record<PoliticsView["tone"], string> = {
  stable: "政局稳定",
  tense: "暗流紧张",
  fragile: "联合政府脆弱",
  crisis: "政治危机",
};

const SEVERITY_LABEL: Record<string, string> = {
  info: "记录",
  success: "推进",
  warning: "警告",
  critical: "危机",
};

export function buildPoliticsModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-politics" });
  let current: ViewModel | null = shell.view();
  let selectedPair: { a: DepartmentId; b: DepartmentId } | null = null;
  let armedDismiss: DepartmentId | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let signature = "";

  const archLayer = el("div", { cls: "tri-pol-arch tri-hidden" });
  archLayer.appendChild(el("span", { cls: "tri-archival-kicker", text: "// ARCHIVE SEALED" }));
  archLayer.appendChild(el("p", { cls: "tri-archival-title", text: "联合政府档案尚未解封" }));
  archLayer.appendChild(
    el("p", {
      cls: "tri-archival-text",
      text: "六部门部长名录、派系关系与政治资本账目仍在封存中。待纪元政务模块接入后，此处将开放任免、调解与峰会。",
    }),
  );
  const body = el("div", { cls: "tri-pol-body" });
  append(root, body, archLayer);

  const offAction = delegate(root, "[data-pol-action]", "click", (_ev, target) => {
    const api = shell.api();
    if (!api) return;
    const action = target.dataset.polAction;
    const politics = current?.politics;
    if (!politics) return;
    if (action === "summit") {
      if (!politics.actions.canSummit || politics.capital < politics.actions.summitCost) return;
      api.actions.holdSummit();
      shell.requestRefresh();
      return;
    }
    if (action === "appoint") {
      const candidateId = target.dataset.candidate;
      if (!candidateId || politics.capital < politics.actions.appointCost) return;
      api.actions.appointMinister(candidateId);
      shell.requestRefresh();
      return;
    }
    if (action === "dismiss") {
      const dept = target.dataset.dept as DepartmentId | undefined;
      if (!dept) return;
      if (armedDismiss !== dept) {
        armedDismiss = dept;
        if (dismissTimer) clearTimeout(dismissTimer);
        dismissTimer = setTimeout(() => {
          armedDismiss = null;
          dismissTimer = null;
          render(true);
        }, 3600);
        render(true);
        return;
      }
      if (politics.capital < politics.actions.dismissCost) return;
      armedDismiss = null;
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = null;
      api.actions.dismissMinister(dept);
      shell.requestRefresh();
      return;
    }
    if (action === "mediate") {
      if (!selectedPair) return;
      const { a, b } = selectedPair;
      if (a === b) return;
      if (politics.capital < politics.actions.mediateCost) return;
      api.actions.mediateMinisters(a, b);
      selectedPair = null;
      shell.requestRefresh();
      return;
    }
    if (action === "clear-relation") {
      selectedPair = null;
      render(true);
      return;
    }
    if (action === "select-relation") {
      const a = target.dataset.a as DepartmentId | undefined;
      const b = target.dataset.b as DepartmentId | undefined;
      if (!a || !b) return;
      selectedPair = { a, b };
      render(true);
    }
  });

  function polSignature(politics: PoliticsView): string {
    const depts = politics.departments
      .map((department) => department.id + ":" + (department.minister?.id ?? "-") + ":" + Math.round(department.efficiency * 100))
      .join("|");
    const factions = politics.factions.map((faction) => faction.id + ":" + Math.round(faction.influence) + ":" + Math.round(faction.satisfaction)).join("|");
    const candidates = politics.candidates.map((candidate) => candidate.id).join(",");
    const relations = politics.relations.map((relation) => relation.a + relation.b + Math.round(relation.score)).join(",");
    return [Math.round(politics.capital), politics.tone, depts, factions, candidates, relations, politics.history.length, politics.actions.canSummit].join("#");
  }

  function render(force = false): void {
    const view = current;
    const politics = view?.politics;
    body.classList.toggle("tri-hidden", !politics);
    archLayer.classList.toggle("tri-hidden", Boolean(politics));
    if (!politics) {
      signature = "";
      return;
    }
    const nextSignature = polSignature(politics);
    if (!force && nextSignature === signature) {
      // Only cheap counters change between renders; keep them live.
      const cap = body.querySelector<HTMLElement>("[data-pol-capital]");
      if (cap) setText(cap, num(politics.capital, 1));
      return;
    }
    signature = nextSignature;
    clear(body);
    body.appendChild(renderTop(politics));
    body.appendChild(renderDepartments(politics));
    body.appendChild(renderLower(politics));
    body.appendChild(renderRelations(politics));
    body.appendChild(renderHistory(politics));
  }

  function renderTop(politics: PoliticsView): HTMLElement {
    const top = el("div", { cls: "tri-pol-top", attrs: { "data-tone": politics.tone } });
    const capBox = el("div", { cls: "tri-pol-capitalbox" });
    capBox.appendChild(el("span", { cls: "tri-pol-kicker", text: "// POLITICAL CAPITAL" }));
    const capRow = el("div", { cls: "tri-pol-caprow" });
    const capValue = el("span", { cls: "tri-pol-capital", text: num(politics.capital, 1) });
    capValue.dataset.polCapital = "1";
    capRow.appendChild(capValue);
    capRow.appendChild(el("span", { cls: "tri-pol-caprate", text: "每回合 " + signed(politics.capitalRate, 1) }));
    append(capBox, capValue.parentElement ?? capRow);
    const metaBox = el("div", { cls: "tri-pol-metabox" });
    metaBox.appendChild(el("span", { cls: "tri-pol-kicker", text: "// CABINET STATUS" }));
    const toneRow = el("div", { cls: "tri-pol-tonerow" });
    toneRow.appendChild(el("span", { cls: "tri-pol-tone", text: TONE_LABEL[politics.tone] }));
    toneRow.appendChild(el("span", { cls: "tri-pol-impact", text: "稳定修正 " + signed(politics.stabilityImpact, 1) + " · " + politics.stabilityImpactLabel }));
    metaBox.appendChild(toneRow);
    metaBox.appendChild(el("p", { cls: "tri-pol-summary", text: politics.summary }));
    const summitBox = el("div", { cls: "tri-pol-summitbox" });
    const summitBtn = el("button", {
      cls: "tri-btn tri-btn-primary tri-pol-summitbtn",
      attrs: { type: "button", "data-pol-action": "summit", title: politics.actions.canSummit ? "举行峰会提升派系满意度" : "峰会冷却中或条件不足" },
    });
    summitBtn.appendChild(icon("shield", 15));
    summitBtn.appendChild(el("span", { cls: "tri-btn-label", text: "举行政治峰会 · " + politics.actions.summitCost }));
    if (!politics.actions.canSummit || politics.capital < politics.actions.summitCost) summitBtn.disabled = true;
    summitBox.appendChild(summitBtn);
    summitBox.appendChild(
      el("span", {
        cls: "tri-pol-hint",
        text: politics.actions.canSummit ? "峰会将暂时凝聚五派" : "峰会冷却中 · 剩余 " + politics.actions.cooldownTurns + " 回合",
      }),
    );
    append(top, capBox, metaBox, summitBox);
    return top;
  }

  function renderDepartments(politics: PoliticsView): HTMLElement {
    const wrap = el("div", { cls: "tri-pol-sectiondepts" });
    const head = el("div", { cls: "tri-pol-sectionhead" });
    head.appendChild(el("span", { cls: "tri-pol-kicker", text: "// SIX DEPARTMENTS" }));
    head.appendChild(el("span", { cls: "tri-pol-sectiontitle", text: "六部门内阁" }));
    const staffed = politics.departments.filter((department) => department.minister != null).length;
    head.appendChild(el("span", { cls: "tri-pol-sectionhint", text: "在任 " + staffed + " / " + politics.departments.length + " · 罢免 " + politics.actions.dismissCost }));
    wrap.appendChild(head);
    const grid = el("div", { cls: "tri-pol-depts" });
    for (const department of politics.departments) grid.appendChild(renderDepartment(department, politics));
    wrap.appendChild(grid);
    return wrap;
  }

  function renderDepartment(department: DepartmentPoliticalView, politics: PoliticsView): HTMLElement {
    const card = el("article", { cls: "tri-pol-dept", attrs: { "data-dept": department.id, "data-warn": department.warning ? "1" : "0" } });
    const head = el("header", { cls: "tri-pol-depthead" });
    const iconWrap = el("span", { cls: "tri-pol-depticon" });
    iconWrap.appendChild(icon(department.icon || "system", 16));
    const titleWrap = el("div", { cls: "tri-pol-depttitle" });
    titleWrap.appendChild(el("span", { cls: "tri-pol-deptname", text: department.name }));
    titleWrap.appendChild(el("span", { cls: "tri-pol-deptshort", text: department.short + " · " + department.description }));
    const eff = el("span", { cls: "tri-pol-eff", text: "效率 " + pct(department.efficiency, 0) });
    eff.dataset.tone = department.efficiency >= 1 ? "good" : "bad";
    append(head, iconWrap, titleWrap, eff);
    card.appendChild(head);

    const minister = department.minister;
    if (minister) {
      card.appendChild(renderMinister(minister, department, politics));
    } else {
      const empty = el("div", { cls: "tri-pol-vacant" });
      empty.appendChild(icon("alert", 14));
      empty.appendChild(el("span", { text: "席位空缺 · 部门效率受罚。可在右侧候选人中任命。" }));
      card.appendChild(empty);
    }

    const mods = el("div", { cls: "tri-pol-mods" });
    for (const modifier of department.modifiers.slice(0, 4)) {
      const row = el("div", { cls: "tri-pol-mod", attrs: { "data-tone": modifier.tone } });
      row.appendChild(el("span", { cls: "tri-pol-modlabel", text: modifier.label }));
      row.appendChild(el("span", { cls: "tri-pol-modvalue", text: modifier.value }));
      row.title = modifier.detail;
      mods.appendChild(row);
    }
    if (mods.children.length > 0) card.appendChild(mods);
    if (department.warning) card.appendChild(el("p", { cls: "tri-pol-warn", text: department.warning }));
    return card;
  }

  function renderMinister(minister: MinisterView, department: DepartmentPoliticalView, politics: PoliticsView): HTMLElement {
    const wrap = el("div", { cls: "tri-pol-minister" });
    const avatar = el("div", { cls: "tri-pol-avatar", attrs: { title: minister.summary } });
    avatar.style.setProperty("--faction", minister.factions[0]?.color ?? "#888");
    if (minister.factions[1]) avatar.style.setProperty("--faction2", minister.factions[1].color);
    avatar.appendChild(el("span", { cls: "tri-pol-avatar-initial", text: minister.name.slice(0, 1) }));
    const info = el("div", { cls: "tri-pol-mininfo" });
    const nameRow = el("div", { cls: "tri-pol-minnamerow" });
    nameRow.appendChild(el("strong", { cls: "tri-pol-minname", text: minister.name }));
    nameRow.appendChild(el("span", { cls: "tri-pol-minmeta", text: minister.age + " 岁 · 任命于星历 " + Math.round(minister.appointedYear) }));
    info.appendChild(nameRow);
    const factionRow = el("div", { cls: "tri-pol-minfactions" });
    for (const faction of minister.factions) {
      const chipNode = el("span", { cls: "tri-pol-factionchip", text: faction.name });
      chipNode.style.setProperty("--faction", faction.color);
      factionRow.appendChild(chipNode);
    }
    for (const trait of minister.traits) {
      factionRow.appendChild(el("span", { cls: "tri-pol-trait", attrs: { title: trait.description, "data-tone": trait.tone }, text: trait.name }));
    }
    info.appendChild(factionRow);
    const stats = el("div", { cls: "tri-pol-stats" });
    for (const stat of [
      { label: "能力", value: minister.competence * 10, text: String(minister.competence) + "/10" },
      { label: "忠诚", value: minister.loyalty, text: String(Math.round(minister.loyalty)) },
      { label: "廉洁", value: minister.integrity, text: String(Math.round(minister.integrity)) },
      { label: "野心", value: minister.ambition, text: String(Math.round(minister.ambition)) },
    ]) {
      const item = el("div", { cls: "tri-pol-stat" });
      item.appendChild(el("span", { cls: "tri-pol-statlabel", text: stat.label }));
      const track = el("span", { cls: "tri-pol-statbar" });
      const fill = el("span", { cls: "tri-pol-statfill" });
      fill.style.width = Math.max(0, Math.min(100, stat.value)) + "%";
      if (stat.label === "野心") fill.dataset.tone = "warn";
      track.appendChild(fill);
      item.appendChild(track);
      item.appendChild(el("span", { cls: "tri-pol-statvalue", text: stat.text }));
      stats.appendChild(item);
    }
    info.appendChild(stats);
    info.appendChild(el("p", { cls: "tri-pol-minsummary", text: minister.summary }));
    const actions = el("div", { cls: "tri-pol-minactions" });
    const dismissBtn = el("button", {
      cls: "tri-btn tri-btn-sm tri-pol-dismiss" + (armedDismiss === department.id ? " is-armed" : ""),
      attrs: { type: "button", "data-pol-action": "dismiss", "data-dept": department.id, title: "罢免部长 · 消耗 " + politics.actions.dismissCost + " 政治资本" },
    });
    dismissBtn.appendChild(icon("close", 13));
    dismissBtn.appendChild(el("span", { cls: "tri-btn-label", text: armedDismiss === department.id ? "确认罢免 " + politics.actions.dismissCost : "罢免" }));
    if (politics.capital < politics.actions.dismissCost) dismissBtn.disabled = true;
    actions.appendChild(dismissBtn);
    append(wrap, avatar, info, actions);
    return wrap;
  }

  function renderLower(politics: PoliticsView): HTMLElement {
    const lower = el("div", { cls: "tri-pol-lower" });
    /* factions */
    const factionBox = el("section", { cls: "tri-pol-panel tri-pol-factions" });
    const fHead = el("div", { cls: "tri-pol-sectionhead" });
    fHead.appendChild(el("span", { cls: "tri-pol-kicker", text: "// FACTIONS" }));
    fHead.appendChild(el("span", { cls: "tri-pol-sectiontitle", text: "五派系" }));
    factionBox.appendChild(fHead);
    const factionBar = el("div", { cls: "tri-pol-factionbar", attrs: { title: "派系影响力分布" } });
    for (const faction of politics.factions) {
      const seg = el("span", { cls: "tri-pol-factionbar-seg" });
      seg.style.width = Math.max(2, faction.influence) + "%";
      seg.style.background = faction.color;
      seg.title = faction.name + " · 影响力 " + Math.round(faction.influence);
      factionBar.appendChild(seg);
    }
    factionBox.appendChild(factionBar);
    for (const faction of politics.factions) factionBox.appendChild(renderFaction(faction));
    lower.appendChild(factionBox);

    /* candidates */
    const candidateBox = el("section", { cls: "tri-pol-panel tri-pol-candidates" });
    const cHead = el("div", { cls: "tri-pol-sectionhead" });
    cHead.appendChild(el("span", { cls: "tri-pol-kicker", text: "// CANDIDATES" }));
    cHead.appendChild(el("span", { cls: "tri-pol-sectiontitle", text: "候任部长" }));
    cHead.appendChild(el("span", { cls: "tri-pol-sectionhint", text: "任命 " + politics.actions.appointCost + " 资本" }));
    candidateBox.appendChild(cHead);
    if (politics.candidates.length === 0) {
      candidateBox.appendChild(el("p", { cls: "tri-pol-hint", text: "暂无候选人 · 名单每 3 回合刷新一次。" }));
    }
    for (const candidate of politics.candidates.slice(0, 6)) {
      const row = el("div", { cls: "tri-pol-candidate" });
      const avatar = el("div", { cls: "tri-pol-avatar tri-pol-avatar-sm", attrs: { title: candidate.summary } });
      avatar.style.setProperty("--faction", candidate.factions[0]?.color ?? "#888");
      if (candidate.factions[1]) avatar.style.setProperty("--faction2", candidate.factions[1].color);
      avatar.appendChild(el("span", { cls: "tri-pol-avatar-initial", text: candidate.name.slice(0, 1) }));
      const info = el("div", { cls: "tri-pol-candinfo" });
      const nameRow = el("div", { cls: "tri-pol-minnamerow" });
      nameRow.appendChild(el("strong", { cls: "tri-pol-minname", text: candidate.name }));
      nameRow.appendChild(el("span", { cls: "tri-pol-minmeta", text: candidate.departmentName }));
      info.appendChild(nameRow);
      const factionRow = el("div", { cls: "tri-pol-minfactions" });
      for (const faction of candidate.factions) {
        const chipNode = el("span", { cls: "tri-pol-factionchip", text: faction.name });
        chipNode.style.setProperty("--faction", faction.color);
        factionRow.appendChild(chipNode);
      }
      factionRow.appendChild(el("span", { cls: "tri-pol-trait", text: "能力 " + candidate.competence + " · 忠诚 " + Math.round(candidate.loyalty) }));
      info.appendChild(factionRow);
      const appoint = el("button", {
        cls: "tri-btn tri-btn-sm",
        attrs: { type: "button", "data-pol-action": "appoint", "data-candidate": candidate.id, title: "任命其为 " + candidate.departmentName + " 部长" },
      });
      appoint.appendChild(el("span", { cls: "tri-btn-label", text: "任命" }));
      if (politics.capital < politics.actions.appointCost) appoint.disabled = true;
      append(row, avatar, info, appoint);
      candidateBox.appendChild(row);
    }
    lower.appendChild(candidateBox);
    return lower;
  }

  function renderFaction(faction: FactionView): HTMLElement {
    const row = el("div", { cls: "tri-pol-faction" });
    const nameRow = el("div", { cls: "tri-pol-factionhead" });
    const color = el("span", { cls: "tri-pol-factiondot" });
    color.style.background = faction.color;
    nameRow.appendChild(color);
    nameRow.appendChild(el("span", { cls: "tri-pol-factionname", text: faction.name }));
    nameRow.appendChild(el("span", { cls: "tri-pol-factionideology", text: faction.ideology }));
    const label = el("span", { cls: "tri-pol-factionsat", attrs: { "data-tone": faction.satisfactionTone }, text: faction.satisfactionLabel });
    nameRow.appendChild(label);
    row.appendChild(nameRow);
    const bars = el("div", { cls: "tri-pol-factionbars" });
    const inf = el("div", { cls: "tri-pol-factionmetric" });
    inf.appendChild(el("span", { text: "影响 " + Math.round(faction.influence) }));
    const infTrack = el("span", { cls: "tri-pol-statbar" });
    const infFill = el("span", { cls: "tri-pol-statfill" });
    infFill.style.width = Math.max(0, Math.min(100, faction.influence)) + "%";
    infTrack.appendChild(infFill);
    inf.appendChild(infTrack);
    const sat = el("div", { cls: "tri-pol-factionmetric" });
    sat.appendChild(el("span", { text: "满意 " + Math.round(faction.satisfaction) }));
    const satTrack = el("span", { cls: "tri-pol-statbar" });
    const satFill = el("span", { cls: "tri-pol-statfill", attrs: { "data-tone": faction.satisfactionTone } });
    satFill.style.width = Math.max(0, Math.min(100, faction.satisfaction)) + "%";
    satTrack.appendChild(satFill);
    sat.appendChild(satTrack);
    append(bars, inf, sat);
    row.appendChild(bars);
    row.title = faction.description;
    return row;
  }

  function renderRelations(politics: PoliticsView): HTMLElement {
    const box = el("section", { cls: "tri-pol-panel tri-pol-relations" });
    const head = el("div", { cls: "tri-pol-sectionhead" });
    head.appendChild(el("span", { cls: "tri-pol-kicker", text: "// RELATION MATRIX" }));
    head.appendChild(el("span", { cls: "tri-pol-sectiontitle", text: "部长关系矩阵" }));
    const mediateInfo = el("span", { cls: "tri-pol-sectionhint", text: selectedPair ? "已选两位部长 · 调解消耗 " + politics.actions.mediateCost : "点击矩阵单元选择一对部长" });
    head.appendChild(mediateInfo);
    const mediateBtn = el("button", { cls: "tri-btn tri-btn-sm tri-pol-mediatebtn", attrs: { type: "button", "data-pol-action": "mediate" } });
    mediateBtn.appendChild(el("span", { cls: "tri-btn-label", text: "调解所选 · " + politics.actions.mediateCost }));
    mediateBtn.disabled = !selectedPair || politics.capital < politics.actions.mediateCost;
    head.appendChild(mediateBtn);
    if (selectedPair) {
      const clearBtn = el("button", { cls: "tri-btn tri-btn-sm tri-btn-ghost", attrs: { type: "button", "data-pol-action": "clear-relation", title: "取消选择" } });
      clearBtn.appendChild(el("span", { cls: "tri-btn-label", text: "取消" }));
      head.appendChild(clearBtn);
    }
    box.appendChild(head);

    const table = el("div", { cls: "tri-pol-matrix" });
    const corner = el("div", { cls: "tri-pol-matrix-corner", text: "部门" });
    table.appendChild(corner);
    for (const department of politics.departments) {
      table.appendChild(el("div", { cls: "tri-pol-matrix-head", text: department.short, attrs: { title: department.name } }));
    }
    for (const rowDept of politics.departments) {
      table.appendChild(el("div", { cls: "tri-pol-matrix-rowhead", text: rowDept.short, attrs: { title: rowDept.name } }));
      for (const colDept of politics.departments) {
        const cell = el("div", { cls: "tri-pol-matrix-cell" });
        if (rowDept.id === colDept.id) {
          cell.classList.add("is-self");
          cell.textContent = "—";
        } else {
          const relation = findRelation(politics.relations, rowDept.id, colDept.id);
          if (!relation) {
            cell.classList.add("is-empty");
            cell.textContent = "·";
          } else {
            cell.dataset.tone = relation.tone;
            const selected = selectedPair != null && samePair(selectedPair, rowDept.id, colDept.id);
            cell.classList.add("is-clickable");
            if (selected) cell.classList.add("is-selected");
            const btn = el("button", {
              cls: "tri-pol-matrix-btn",
              attrs: {
                type: "button",
                "data-pol-action": "select-relation",
                "data-a": rowDept.id,
                "data-b": colDept.id,
                title: relation.aName + " × " + relation.bName + "：" + relation.label + "（" + signed(relation.score, 0) + "）",
              },
            });
            btn.appendChild(el("b", { text: selected ? "✓" : String(Math.round(relation.score)) }));
            btn.appendChild(el("span", { text: relation.label }));
            cell.appendChild(btn);
          }
        }
        table.appendChild(cell);
      }
    }
    box.appendChild(table);
    return box;
  }

  function renderHistory(politics: PoliticsView): HTMLElement {
    const box = el("section", { cls: "tri-pol-panel tri-pol-history" });
    const head = el("div", { cls: "tri-pol-sectionhead" });
    head.appendChild(el("span", { cls: "tri-pol-kicker", text: "// POLITICAL RECORD" }));
    head.appendChild(el("span", { cls: "tri-pol-sectiontitle", text: "政务记录" }));
    box.appendChild(head);
    const list = el("div", { cls: "tri-pol-historylist" });
    const entries = politics.history.slice(-10).reverse();
    if (entries.length === 0) list.appendChild(el("p", { cls: "tri-pol-hint", text: "还没有政治记录。" }));
    for (const entry of entries) {
      const row = el("div", { cls: "tri-pol-historyrow", attrs: { "data-severity": entry.severity } });
      row.appendChild(el("span", { cls: "tri-pol-historyyear", text: "星历 " + Math.round(entry.year) + " · 回合 " + entry.turn }));
      row.appendChild(el("span", { cls: "tri-pol-historykind", text: SEVERITY_LABEL[entry.severity] ?? entry.severity }));
      row.appendChild(el("span", { cls: "tri-pol-historymsg", text: entry.message }));
      list.appendChild(row);
    }
    box.appendChild(list);
    return box;
  }

  return {
    el: root,
    update(view) {
      current = view;
      render();
    },
    destroy() {
      if (dismissTimer) clearTimeout(dismissTimer);
      offAction();
    },
  };
}

function findRelation(relations: MinisterRelationView[], a: DepartmentId, b: DepartmentId): MinisterRelationView | null {
  return relations.find((relation) => (relation.a === a && relation.b === b) || (relation.a === b && relation.b === a)) ?? null;
}

function samePair(pair: { a: DepartmentId; b: DepartmentId }, a: DepartmentId, b: DepartmentId): boolean {
  return (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a);
}
