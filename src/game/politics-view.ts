/**
 * PoliticsView assembly (v1.3). Lead-owned presentation adapter:
 * the UI never imports politics modules directly.
 */
import type { PoliticsState, MinisterState } from "../core/types";
import {
  DEPARTMENT_ORDER, FACTION_ORDER, factionMembers, factionName, factionShort,
  departmentRelationInfo, departmentModifiers, ministerSummary, politicsActionAvailability,
  politicsStabilityImpact, politicsStabilityImpactLabel, politicsSummary, factionInfluence,
  factionSatisfaction, factionDef, departmentName, MINISTER_TRAIT_MAP,
} from "../politics";
import type {
  DepartmentPoliticalView, FactionView, MinisterRelationView, MinisterTraitView,
  MinisterView, PoliticsView,
} from "./viewTypes";

function ministerView(m: MinisterState): MinisterView {
  const traits: MinisterTraitView[] = (m.traits ?? []).map((id) => {
    const def = MINISTER_TRAIT_MAP[id];
    return {
      id,
      name: def?.name ?? id,
      description: def?.description ?? "",
      tone: def?.tone ?? "mixed",
    };
  });
  return {
    id: m.id,
    name: m.name,
    department: m.department,
    departmentName: departmentName(m.department),
    factions: (m.factions ?? []).map((id) => ({ id, name: factionName(id), color: factionDef(id)?.color ?? "#888888" })),
    competence: Math.round(m.competence),
    loyalty: Math.round(m.loyalty),
    integrity: Math.round(m.integrity),
    ambition: Math.round(m.ambition),
    age: Math.round(m.age),
    traits,
    portraitSeed: m.portraitSeed,
    summary: ministerSummary(m),
    appointedYear: m.appointedYear,
  };
}

function satisfactionTone(v: number): FactionView["satisfactionTone"] {
  if (v >= 65) return "good";
  if (v >= 45) return "ok";
  if (v >= 28) return "warn";
  return "bad";
}

function satisfactionLabel(v: number): string {
  if (v >= 75) return "拥护";
  if (v >= 60) return "满意";
  if (v >= 45) return "观望";
  if (v >= 30) return "不满";
  return "敌意";
}

export function politicsView(state: PoliticsState | undefined, turn: number): PoliticsView | undefined {
  if (!state) return undefined;
  const modifiers = departmentModifiers(state);
  const ministerViews = new Map<string, MinisterView>();
  const departments: DepartmentPoliticalView[] = DEPARTMENT_ORDER.map((id) => {
    const detail = modifiers.departments.find((d) => d.id === id);
    const minister = state.ministers[id] ?? null;
    const view = minister ? ministerView(minister) : null;
    if (view) ministerViews.set(view.id, view);
    return {
      id,
      name: detail?.name ?? id,
      short: detail?.short ?? id,
      icon: detail?.icon ?? "dept",
      description: detail?.description ?? "",
      minister: view,
      modifiers: detail?.modifiers ?? [],
      efficiency: detail?.efficiency ?? 0.7,
      efficiencyLabel: detail?.efficiencyLabel ?? "空缺",
      warning: detail?.warning ?? (minister ? null : "部门空缺：效率 -30%"),
    };
  });

  const factions: FactionView[] = FACTION_ORDER.map((id) => {
    const influence = factionInfluence(state, id);
    const satisfaction = factionSatisfaction(state, id);
    const members = factionMembers(state, id);
    const def = factionDef(id);
    return {
      id,
      name: factionName(id),
      short: factionShort(id),
      description: def?.description ?? "",
      ideology: def?.ideology ?? "",
      color: def?.color ?? "#888888",
      influence: Math.round(influence * 10) / 10,
      satisfaction: Math.round(satisfaction * 10) / 10,
      satisfactionLabel: satisfactionLabel(satisfaction),
      satisfactionTone: satisfactionTone(satisfaction),
      ministers: members.map((m) => m.name),
    };
  });

  const relations: MinisterRelationView[] = [];
  for (let i = 0; i < DEPARTMENT_ORDER.length; i++) {
    for (let j = i + 1; j < DEPARTMENT_ORDER.length; j++) {
      const a = DEPARTMENT_ORDER[i];
      const b = DEPARTMENT_ORDER[j];
      if (!state.ministers[a] || !state.ministers[b]) continue;
      const info = departmentRelationInfo(state, a, b);
      relations.push({
        a, b,
        aName: departmentName(a),
        bName: departmentName(b),
        score: Math.round(info.score),
        label: info.label,
        tone: info.tone,
      });
    }
  }
  relations.sort((x, y) => x.score - y.score);

  const availability = politicsActionAvailability(state, turn);
  const summary = politicsSummary(state);
  const stabilityImpact = politicsStabilityImpact(state);
  return {
    capital: Math.round(state.capital * 10) / 10,
    capitalRate: Math.round((state.capitalRate ?? modifiers.capitalRate) * 10) / 10,
    departments,
    factions,
    relations,
    candidates: (state.candidates ?? []).map(ministerView),
    stabilityImpact: Math.round(stabilityImpact * 100) / 100,
    stabilityImpactLabel: politicsStabilityImpactLabel(stabilityImpact),
    actions: {
      ...availability,
      canSummit: availability.canSummit,
    },
    lastSummitTurn: state.lastSummitTurn,
    history: (state.history ?? []).slice(-24).reverse(),
    summary: summary.text,
    tone: summary.tone,
  };
}
