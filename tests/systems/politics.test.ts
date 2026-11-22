/**
 * 政治系统 v3 单测（docs/EXPANSION_V3.md §3）。
 *
 * 覆盖：初始化 / 派系 / 候选 / 任命 / 罢免 / 关系标签 / 调解 / 峰会 / 资本边界 /
 *       部门修正 / 稳定度上限 / 回合结算 / 丑闻野心 / 空部长容错 / 非法动作 /
 *       seed 复现 / 数值有限 / 事件集成钩子。
 *
 * 只依赖 src/politics，不依赖其它系统模块（科技模块并行重写期间本文件也能独立跑）。
 */
import { describe, it, expect } from "vitest";
import type { DepartmentId, MinisterState, PoliticsState } from "../../src/core/types";
import {
  DEPARTMENT_DEFS,
  DEPARTMENT_ORDER,
  FACTION_DEFS,
  FACTION_ORDER,
  MINISTER_TRAITS,
  MINISTER_TRAIT_MAP,
  POLITICS_CONFIG,
  POLITICS_FLAVOR,
  adjustFactionSatisfaction,
  ambitionChance,
  appointMinister,
  canAppoint,
  canDismiss,
  canHoldSummit,
  canMediate,
  changeCapital,
  computeCapitalRate,
  createPoliticsState,
  departmentEfficiency,
  departmentModifiers,
  departmentRelationInfo,
  dismissMinister,
  effectiveCompetence,
  getRelation,
  holdSummit,
  mediateMinisters,
  ministerSummary,
  politicsActionAvailability,
  politicsStabilityImpact,
  politicsStabilityImpactLabel,
  politicsSummary,
  politicsTurn,
  refreshCandidates,
  relationKey,
  relationLabel,
  relationsBetween,
  sanitizePoliticsState,
  scandalChance,
  servingMinisters,
  shiftDepartmentRelation,
  shiftRelation,
  vacantDepartments,
} from "../../src/politics";

/* ------------------------------------------------------------------ *
 *  测试工具
 * ------------------------------------------------------------------ */

const DEPTS: readonly DepartmentId[] = DEPARTMENT_ORDER;
const EPS = 1e-9;

function servingOf(state: PoliticsState): MinisterState[] {
  return servingMinisters(state);
}

function allFinite(value: unknown, path = "state"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("非有限数值：" + path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => allFinite(v, path + "[" + i + "]"));
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      allFinite((value as Record<string, unknown>)[key], path + "." + key);
    }
  }
}

function emptyMinisters(state: PoliticsState): void {
  for (const dept of DEPTS) state.ministers[dept] = null;
}

function effectOf(state: PoliticsState, civStability = 55, year = 1, turn = 1) {
  return politicsTurn(state, { stability: civStability }, year, turn);
}

/** 构造可自由操作的富余状态（资本充足、便于测试动作）。 */
function richState(seed: string): PoliticsState {
  const state = createPoliticsState(seed);
  state.capital = 120;
  return state;
}

/* ------------------------------------------------------------------ *
 *  1. 初始化与内容
 * ------------------------------------------------------------------ */

describe("政治系统：初始化", () => {
  it("创建 6 部门 6 部长 / 5 派系 / 候选人池 / 资本 20..30 / 关系矩阵", () => {
    const state = createPoliticsState("POL-INIT");
    expect(DEPTS.length).toBe(6);
    expect(FACTION_ORDER.length).toBe(5);

    const ids = new Set<string>();
    for (const dept of DEPTS) {
      const minister = state.ministers[dept];
      expect(minister, dept).not.toBeNull();
      if (!minister) continue;
      expect(minister.department).toBe(dept);
      expect(minister.name.length).toBeGreaterThan(0);
      expect(ids.has(minister.id)).toBe(false);
      ids.add(minister.id);
    }

    for (const faction of FACTION_ORDER) {
      const entry = state.factions[faction];
      expect(entry).toBeDefined();
      expect(entry.influence).toBeGreaterThanOrEqual(0);
      expect(entry.influence).toBeLessThanOrEqual(100);
      expect(entry.satisfaction).toBeGreaterThanOrEqual(0);
      expect(entry.satisfaction).toBeLessThanOrEqual(100);
    }
    const influenceSum = FACTION_ORDER.reduce((sum, id) => sum + state.factions[id].influence, 0);
    expect(influenceSum).toBeGreaterThan(99.5);
    expect(influenceSum).toBeLessThan(100.5);

    expect(state.candidates.length).toBeGreaterThanOrEqual(POLITICS_CONFIG.candidatePoolMin);
    expect(state.candidates.length).toBeLessThanOrEqual(POLITICS_CONFIG.candidatePoolMax);
    expect(state.capital).toBeGreaterThanOrEqual(20);
    expect(state.capital).toBeLessThanOrEqual(30);
    expect(state.capitalRate).toBeGreaterThanOrEqual(2);
    expect(state.capitalRate).toBeLessThanOrEqual(6);
    expect(state.history.length).toBe(POLITICS_FLAVOR.opening.length);
    expect(Object.keys(state.relations).length).toBe(15);
    allFinite(state);
  });

  it("每名部长属于 1-2 个派系、2 个合法特质、属性全部在区间内", () => {
    const state = createPoliticsState("POL-STATS");
    for (const minister of servingOf(state)) {
      expect(minister.factions.length).toBeGreaterThanOrEqual(1);
      expect(minister.factions.length).toBeLessThanOrEqual(2);
      for (const faction of minister.factions) expect(FACTION_ORDER).toContain(faction);
      expect(minister.traits.length).toBe(2);
      for (const trait of minister.traits) expect(MINISTER_TRAIT_MAP[trait]).toBeDefined();
      expect(minister.competence).toBeGreaterThanOrEqual(1);
      expect(minister.competence).toBeLessThanOrEqual(10);
      for (const value of [minister.loyalty, minister.integrity, minister.ambition]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(minister.age).toBeGreaterThanOrEqual(POLITICS_CONFIG.ageMin);
      expect(minister.age).toBeLessThanOrEqual(POLITICS_CONFIG.ageMax);
      expect(minister.portraitSeed).toBeGreaterThan(0);
    }
  });

  it("内容表完整：5 派系 / 6 部门文案与价值观非空、16 个特质带效果", () => {
    for (const faction of FACTION_ORDER) {
      const def = FACTION_DEFS[faction];
      expect(def.name.length).toBeGreaterThan(1);
      expect(def.description.length).toBeGreaterThan(20);
      expect(def.ideology.length).toBeGreaterThan(10);
      expect(def.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(def.preferredDepartments.length).toBeGreaterThan(0);
      for (const dept of def.preferredDepartments) expect(DEPTS).toContain(dept);
    }
    for (const dept of DEPTS) {
      expect(DEPARTMENT_DEFS[dept].name.length).toBeGreaterThan(1);
      expect(DEPARTMENT_DEFS[dept].description.length).toBeGreaterThan(20);
      expect(DEPARTMENT_DEFS[dept].responsibilities.length).toBeGreaterThan(0);
    }
    expect(MINISTER_TRAITS.length).toBeGreaterThanOrEqual(12);
    for (const trait of MINISTER_TRAITS) {
      expect(trait.name.length).toBeGreaterThan(1);
      expect(trait.description.length).toBeGreaterThan(8);
      expect(["good", "bad", "mixed"]).toContain(trait.tone);
      expect(Object.keys(trait.effect).length).toBeGreaterThan(0);
    }
  });

  it("配置口径符合规格：成本区间 / 稳定度上限 / 效率区间", () => {
    expect(POLITICS_CONFIG.appointCost).toBeGreaterThanOrEqual(8);
    expect(POLITICS_CONFIG.appointCost).toBeLessThanOrEqual(15);
    expect(POLITICS_CONFIG.dismissCost).toBeGreaterThanOrEqual(12);
    expect(POLITICS_CONFIG.dismissCost).toBeLessThanOrEqual(20);
    expect(POLITICS_CONFIG.mediateCost).toBeGreaterThanOrEqual(6);
    expect(POLITICS_CONFIG.mediateCost).toBeLessThanOrEqual(10);
    expect(POLITICS_CONFIG.summitCost).toBeGreaterThanOrEqual(20);
    expect(POLITICS_CONFIG.summitCost).toBeLessThanOrEqual(30);
    expect(POLITICS_CONFIG.startingCapitalMin).toBe(20);
    expect(POLITICS_CONFIG.startingCapitalMax).toBe(30);
    expect(POLITICS_CONFIG.stabilityTurnMin).toBe(-3);
    expect(POLITICS_CONFIG.stabilityTurnMax).toBe(3);
    expect(POLITICS_CONFIG.dismissalStabilityMin).toBe(-8);
    expect(POLITICS_CONFIG.dismissalStabilityMax).toBe(-4);
    expect(POLITICS_CONFIG.efficiencyMin).toBe(0.7);
    expect(POLITICS_CONFIG.efficiencyMax).toBe(1.3);
    expect(POLITICS_CONFIG.candidateRefreshInterval).toBe(3);
  });

  it("同 seed 完全复现，不同 seed 产生不同内阁", () => {
    const a = createPoliticsState("SEED-ALPHA");
    const b = createPoliticsState("SEED-ALPHA");
    const c = createPoliticsState("SEED-BETA");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));

    for (let turn = 1; turn <= 12; turn++) {
      politicsTurn(a, { stability: 60 }, turn * 0.5, turn);
      politicsTurn(b, { stability: 60 }, turn * 0.5, turn);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("JSON 存档往返后继续结算与未读档完全一致（无隐藏 RNG 状态）", () => {
    const original = createPoliticsState("POL-SAVE");
    for (let turn = 1; turn <= 5; turn++) politicsTurn(original, { stability: 58 }, turn * 0.5, turn);
    const restored = JSON.parse(JSON.stringify(original)) as PoliticsState;
    for (let turn = 6; turn <= 12; turn++) {
      politicsTurn(original, { stability: 58 }, turn * 0.5, turn);
      politicsTurn(restored, { stability: 58 }, turn * 0.5, turn);
    }
    expect(JSON.stringify(restored)).toBe(JSON.stringify(original));
    allFinite(restored);
  });
});

/* ------------------------------------------------------------------ *
 *  2. 任命 / 罢免
 * ------------------------------------------------------------------ */

describe("政治系统：任命与罢免", () => {
  it("任命成功：扣资本、部长就位、候选移除、关系初始化、写日志", () => {
    const state = richState("POL-APPOINT");
    const dept: DepartmentId = "science";
    const dismissed = dismissMinister(state, dept, 1, 1);
    expect(dismissed.ok).toBe(true);
    const candidate = state.candidates.find((c) => c.department === dept);
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const capitalBefore = state.capital;
    const historyBefore = state.history.length;
    const result = appointMinister(state, candidate.id, 2, 2);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.logs.length).toBe(1);
    expect(result.logs[0].kind).toBe("appoint");
    expect(state.capital).toBeCloseTo(capitalBefore - POLITICS_CONFIG.appointCost, 5);
    expect(state.ministers[dept]?.id).toBe(candidate.id);
    expect(state.ministers[dept]?.appointedYear).toBe(2);
    expect(state.candidates.some((c) => c.id === candidate.id)).toBe(false);
    expect(state.history.length).toBe(historyBefore + 1);
    expect(Object.keys(state.relations).length).toBe(15);
    // 新部长与其余 5 人都有关系记录
    for (const other of servingOf(state)) {
      if (other.id === candidate.id) continue;
      expect(state.relations[relationKey(candidate.id, other.id)]).toBeDefined();
    }
    allFinite(state);
  });

  it("任命非法：候选人不存在 / 部门已占 / 资本不足，均拒绝且不扣资本", () => {
    const state = richState("POL-APPOINT-FAIL");
    const capitalBefore = state.capital;

    const unknown = appointMinister(state, "m-does-not-exist", 1, 1);
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toBeTruthy();

    // 初始 6 部门全满：任取一名候选人都应被拒绝
    for (const candidate of state.candidates.slice(0, 3)) {
      const occupied = appointMinister(state, candidate.id, 1, 1);
      expect(occupied.ok).toBe(false);
      expect(occupied.reason).toContain("已有在任部长");
    }
    expect(state.capital).toBeCloseTo(capitalBefore, 5);

    // 制造空缺但资本不足
    const dismissed = dismissMinister(state, "agriculture", 1, 1);
    expect(dismissed.ok).toBe(true);
    state.capital = 3;
    const candidate = state.candidates.find((c) => c.department === "agriculture");
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const poor = appointMinister(state, candidate.id, 1, 1);
    expect(poor.ok).toBe(false);
    expect(poor.reason).toContain("政治资本不足");
    expect(state.capital).toBe(3);
  });

  it("罢免成功：扣资本、部门空缺、关系清理、派系反弹、即时稳定度冲击 -8..-4", () => {
    const state = richState("POL-DISMISS");
    const dept: DepartmentId = "industry";
    const minister = state.ministers[dept];
    expect(minister).not.toBeNull();
    if (!minister) return;
    const faction = minister.factions[0];
    const satisfactionBefore = state.factions[faction].satisfaction;
    const capitalBefore = state.capital;

    const result = dismissMinister(state, dept, 3, 4);
    expect(result.ok).toBe(true);
    expect(result.stabilityImpact).toBeGreaterThanOrEqual(-8 - EPS);
    expect(result.stabilityImpact).toBeLessThanOrEqual(-4 + EPS);
    expect(state.capital).toBeCloseTo(capitalBefore - POLITICS_CONFIG.dismissCost, 5);
    expect(state.ministers[dept]).toBeNull();
    expect(result.logs[0].kind).toBe("dismiss");
    expect(result.logs[0].severity).toBe("critical");
    expect(vacantDepartments(state)).toContain(dept);
    expect(state.factions[faction].satisfaction).toBeLessThan(satisfactionBefore + EPS);
    expect(Object.keys(state.relations).length).toBe(10);
    // 空缺部门立刻有候选人可补位
    expect(state.candidates.some((c) => c.department === dept)).toBe(true);
    allFinite(state);
  });

  it("罢免非法：空部门 / 未知部门 / 资本不足均返回失败且冲击为 0", () => {
    const state = richState("POL-DISMISS-FAIL");
    state.ministers.defense = null;
    const empty = dismissMinister(state, "defense", 1, 1);
    expect(empty.ok).toBe(false);
    expect(empty.stabilityImpact).toBe(0);

    const unknown = dismissMinister(state, "not-a-department" as DepartmentId, 1, 1);
    expect(unknown.ok).toBe(false);

    state.capital = 1;
    const poor = dismissMinister(state, "science", 1, 1);
    expect(poor.ok).toBe(false);
    expect(poor.reason).toContain("政治资本不足");
    expect(state.ministers.science).not.toBeNull();
    expect(state.capital).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 *  3. 关系 / 调解 / 峰会
 * ------------------------------------------------------------------ */

describe("政治系统：关系网", () => {
  it("关系五档标签边界与色调", () => {
    expect(relationLabel(100)).toEqual({ label: "亲密", tone: "intimate" });
    expect(relationLabel(60)).toEqual({ label: "亲密", tone: "intimate" });
    expect(relationLabel(59)).toEqual({ label: "友好", tone: "friendly" });
    expect(relationLabel(25)).toEqual({ label: "友好", tone: "friendly" });
    expect(relationLabel(24)).toEqual({ label: "中立", tone: "neutral" });
    expect(relationLabel(0)).toEqual({ label: "中立", tone: "neutral" });
    expect(relationLabel(-24)).toEqual({ label: "中立", tone: "neutral" });
    expect(relationLabel(-25)).toEqual({ label: "冷淡", tone: "cold" });
    expect(relationLabel(-59)).toEqual({ label: "冷淡", tone: "cold" });
    expect(relationLabel(-60)).toEqual({ label: "敌对", tone: "hostile" });
    expect(relationLabel(-100)).toEqual({ label: "敌对", tone: "hostile" });
  });

  it("关系矩阵：键字典序、数值 -100..100 且对称", () => {
    const state = richState("POL-REL");
    const serving = servingOf(state);
    for (let i = 0; i < serving.length; i++) {
      for (let j = i + 1; j < serving.length; j++) {
        const a = serving[i];
        const b = serving[j];
        const key = relationKey(a.id, b.id);
        expect(key.indexOf("|")).toBeGreaterThan(0);
        expect(state.relations[key]).toBeGreaterThanOrEqual(-100);
        expect(state.relations[key]).toBeLessThanOrEqual(100);
        expect(relationsBetween(state, a.id, b.id)).toBe(relationsBetween(state, b.id, a.id));
        expect(getRelation(state, a.id, b.id)).toBe(state.relations[key]);
      }
    }
    const info = departmentRelationInfo(state, "science", "industry");
    expect(info.score).toBeGreaterThanOrEqual(-100);
    expect(info.score).toBeLessThanOrEqual(100);
    expect(["intimate", "friendly", "neutral", "cold", "hostile"]).toContain(info.tone);
    expect(info.label.length).toBeGreaterThan(0);
  });

  it("调解：花费 8 资本，关系提升 8..15，标签同步刷新", () => {
    const state = richState("POL-MEDIATE");
    const a: DepartmentId = "science";
    const b: DepartmentId = "industry";
    const ma = state.ministers[a];
    const mb = state.ministers[b];
    expect(ma).not.toBeNull();
    expect(mb).not.toBeNull();
    if (!ma || !mb) return;
    // 归零，确保不会被上限截断
    shiftRelation(state, ma.id, mb.id, -getRelation(state, ma.id, mb.id));
    const before = relationsBetween(state, ma.id, mb.id);
    const capitalBefore = state.capital;

    const result = mediateMinisters(state, a, b, 5);
    expect(result.ok).toBe(true);
    const after = relationsBetween(state, ma.id, mb.id);
    expect(after - before).toBeGreaterThanOrEqual(8);
    expect(after - before).toBeLessThanOrEqual(15);
    expect(state.capital).toBeCloseTo(capitalBefore - POLITICS_CONFIG.mediateCost, 5);
    expect(result.logs[0].kind).toBe("mediate");
    expect(result.logs[0].message).toContain("关系");
  });

  it("调解非法：同部门 / 空缺部门 / 资本不足", () => {
    const state = richState("POL-MEDIATE-FAIL");
    expect(mediateMinisters(state, "science", "science", 1).ok).toBe(false);
    state.ministers.observation = null;
    expect(mediateMinisters(state, "science", "observation", 1).ok).toBe(false);
    state.capital = 0;
    expect(mediateMinisters(state, "science", "industry", 1).ok).toBe(false);
  });

  it("关系自然回归：极端值向自然目标靠拢", () => {
    const state = richState("POL-REL-DRIFT");
    const ma = state.ministers.science;
    const mb = state.ministers.industry;
    expect(ma).not.toBeNull();
    expect(mb).not.toBeNull();
    if (!ma || !mb) return;
    shiftRelation(state, ma.id, mb.id, -999);
    const start = relationsBetween(state, ma.id, mb.id);
    expect(start).toBe(-100);
    for (let turn = 1; turn <= 20; turn++) {
      politicsTurn(state, { stability: 55 }, turn * 0.5, turn);
    }
    const end = relationsBetween(state, ma.id, mb.id);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThan(100);

    shiftRelation(state, ma.id, mb.id, 999);
    expect(relationsBetween(state, ma.id, mb.id)).toBe(100);
    for (let turn = 21; turn <= 40; turn++) {
      politicsTurn(state, { stability: 55 }, turn * 0.5, turn);
    }
    expect(relationsBetween(state, ma.id, mb.id)).toBeLessThan(100);
  });

  it("峰会：花费 24 资本，全派系满意度上升，冷却期内拒绝二次召开", () => {
    const state = richState("POL-SUMMIT");
    state.capital = 200;
    const satisfactionBefore = FACTION_ORDER.map((id) => state.factions[id].satisfaction);
    const result = holdSummit(state, 5);
    expect(result.ok).toBe(true);
    expect(state.capital).toBe(200 - POLITICS_CONFIG.summitCost);
    expect(state.lastSummitTurn).toBe(5);
    FACTION_ORDER.forEach((id, index) => {
      expect(state.factions[id].satisfaction).toBeGreaterThanOrEqual(satisfactionBefore[index]);
    });
    expect(result.logs[0].kind).toBe("faction");

    const again = holdSummit(state, 6);
    expect(again.ok).toBe(false);
    expect(again.reason).toContain("回合");
    const availability = politicsActionAvailability(state, 6);
    expect(availability.canSummit).toBe(false);
    expect(availability.cooldownTurns).toBeGreaterThan(0);

    // 冷却结束后可再次召开（资本重新补足）
    state.capital = 200;
    const readyTurn = 5 + POLITICS_CONFIG.summitCooldownTurns;
    expect(canHoldSummit(state, readyTurn).ok).toBe(true);
    expect(holdSummit(state, readyTurn).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 *  4. 政治资本 / 部门修正 / 稳定度
 * ------------------------------------------------------------------ */

describe("政治系统：资本、部门修正与稳定度", () => {
  it("政治资本始终 clamp 在 0..200，收入 2..6", () => {
    const state = richState("POL-CAPITAL");
    const capitalNow = state.capital;
    expect(changeCapital(state, -9999)).toBe(-capitalNow);
    expect(state.capital).toBe(0);
    changeCapital(state, 9999);
    expect(state.capital).toBe(POLITICS_CONFIG.capitalMax);

    state.capital = 40;
    for (let turn = 1; turn <= 20; turn++) {
      const effects = politicsTurn(state, { stability: 55 }, turn * 0.5, turn);
      expect(effects.capitalGain).toBeGreaterThanOrEqual(0);
      expect(state.capital).toBeGreaterThanOrEqual(0);
      expect(state.capital).toBeLessThanOrEqual(POLITICS_CONFIG.capitalMax);
      expect(state.capitalRate).toBeGreaterThanOrEqual(2);
      expect(state.capitalRate).toBeLessThanOrEqual(6);
    }
    // 资本未触顶时，单回合收入落在 2..6
    state.capital = 20;
    const single = politicsTurn(state, { stability: 80 }, 1, 1);
    expect(single.capitalGain).toBeGreaterThanOrEqual(2);
    expect(single.capitalGain).toBeLessThanOrEqual(6);
  });

  it("部门修正：6 部门效率 0.7..1.3，五项乘数有限且同区间", () => {
    const state = createPoliticsState("POL-MODS");
    const mods = departmentModifiers(state);
    expect(mods.departments.length).toBe(6);
    for (const dept of mods.departments) {
      expect(dept.efficiency).toBeGreaterThanOrEqual(0.7);
      expect(dept.efficiency).toBeLessThanOrEqual(1.3);
      expect(dept.efficiencyLabel.length).toBeGreaterThan(0);
      expect(dept.name.length).toBeGreaterThan(0);
      expect(dept.icon.length).toBeGreaterThan(0);
      expect(dept.modifiers.length).toBeGreaterThan(0);
      for (const modifier of dept.modifiers) {
        expect(modifier.label.length).toBeGreaterThan(0);
        expect(modifier.detail.length).toBeGreaterThan(0);
        expect(["good", "bad", "neutral"]).toContain(modifier.tone);
      }
    }
    for (const key of [
      "researchMultiplier",
      "industryMultiplier",
      "agricultureMultiplier",
      "observationMultiplier",
      "defenseMultiplier",
    ] as const) {
      const value = mods[key];
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0.7);
      expect(value).toBeLessThanOrEqual(1.3);
    }
    expect(Number.isFinite(mods.capitalRate)).toBe(true);
    expect(mods.capitalRate).toBeGreaterThanOrEqual(2);
    expect(mods.capitalRate).toBeLessThanOrEqual(6);
    expect(mods.stabilityDelta).toBeGreaterThanOrEqual(-3);
    expect(mods.stabilityDelta).toBeLessThanOrEqual(3);
    expect(mods.stabilityImpactLabel.length).toBeGreaterThan(0);
    expect(computeCapitalRate(state)).toBeGreaterThanOrEqual(2);
    expect(computeCapitalRate(state)).toBeLessThanOrEqual(6);
  });

  it("部长能力越高部门效率越高，空缺部门固定 0.70 并给出警告", () => {
    const state = createPoliticsState("POL-EFF");
    const science = state.ministers.science;
    expect(science).not.toBeNull();
    if (!science) return;
    shiftRelation(state, science.id, state.ministers.industry!.id, 40);
    science.competence = 10;
    science.loyalty = 90;
    science.integrity = 95;
    science.ambition = 10;
    const high = departmentEfficiency(state, "science");
    science.competence = 1;
    const low = departmentEfficiency(state, "science");
    expect(high).toBeGreaterThan(low);
    expect(effectiveCompetence(science)).toBe(1);

    state.ministers.observation = null;
    const mods = departmentModifiers(state);
    const observation = mods.departments.find((d) => d.id === "observation");
    expect(observation).toBeDefined();
    if (!observation) return;
    expect(observation.efficiency).toBe(0.7);
    expect(observation.efficiencyLabel).toBe("空缺");
    expect(observation.warning).toBeTruthy();
    expect(observation.ministerId).toBeNull();
  });

  it("稳定度修正恒定 -3..3，且中文评价覆盖全部档位", () => {
    const state = createPoliticsState("POL-STAB");
    expect(politicsStabilityImpact(state)).toBeGreaterThanOrEqual(-3);
    expect(politicsStabilityImpact(state)).toBeLessThanOrEqual(3);
    emptyMinisters(state);
    const emptyImpact = politicsStabilityImpact(state);
    expect(emptyImpact).toBeGreaterThanOrEqual(-3);
    expect(emptyImpact).toBeLessThanOrEqual(3);
    expect(politicsStabilityImpactLabel(2)).toContain("稳固");
    expect(politicsStabilityImpactLabel(0.5).length).toBeGreaterThan(0);
    expect(politicsStabilityImpactLabel(0).length).toBeGreaterThan(0);
    expect(politicsStabilityImpactLabel(-1).length).toBeGreaterThan(0);
    expect(politicsStabilityImpactLabel(-3).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ *
 *  5. 回合结算
 * ------------------------------------------------------------------ */

describe("政治系统：回合结算", () => {
  it("politicsTurn 返回完整 PoliticsTurnEffects，资本到账且日志合法", () => {
    const state = createPoliticsState("POL-TURN");
    const capitalBefore = state.capital;
    const historyBefore = state.history.length;
    const effects = politicsTurn(state, { stability: 60 }, 0.5, 1);

    expect(effects.stabilityDelta).toBeGreaterThanOrEqual(-6);
    expect(effects.stabilityDelta).toBeLessThanOrEqual(3);
    expect(effects.capitalGain).toBeGreaterThanOrEqual(2);
    expect(effects.capitalGain).toBeLessThanOrEqual(6);
    // 若本回合触发丑闻会有额外资本损失（3..6），否则资本变动应恰好等于 capitalGain
    const capitalDelta = state.capital - capitalBefore;
    const eventLogged = effects.logs.some((log) => log.kind === "event");
    if (eventLogged) {
      expect(capitalDelta).toBeLessThanOrEqual(effects.capitalGain);
      expect(capitalDelta).toBeGreaterThanOrEqual(effects.capitalGain - 6);
    } else {
      expect(capitalDelta).toBeCloseTo(effects.capitalGain, 5);
    }
    expect(state.capitalRate).toBeGreaterThanOrEqual(2);
    expect(state.capitalRate).toBeLessThanOrEqual(6);
    for (const key of [
      "researchMultiplier",
      "industryMultiplier",
      "agricultureMultiplier",
      "observationMultiplier",
      "defenseMultiplier",
    ] as const) {
      expect(effects[key]).toBeGreaterThanOrEqual(0.7);
      expect(effects[key]).toBeLessThanOrEqual(1.3);
    }
    expect(Array.isArray(effects.logs)).toBe(true);
    for (const log of effects.logs) {
      expect(["appoint", "dismiss", "mediate", "faction", "warning", "event"]).toContain(log.kind);
      expect(["info", "success", "warning", "critical"]).toContain(log.severity);
      expect(log.message.length).toBeGreaterThan(0);
    }
    expect(state.history.length).toBe(historyBefore + effects.logs.length);
    allFinite(effects);
    allFinite(state);
  });

  it("连续 200 回合：所有数值有限、稳定度不越界、空缺部门始终有候选人", () => {
    const state = createPoliticsState("POL-LONG");
    let witnessedEvent = false;
    for (let turn = 1; turn <= 200; turn++) {
      const effects = politicsTurn(state, { stability: 50 + (turn % 40) }, turn * 0.5, turn);
      expect(effects.stabilityDelta).toBeGreaterThanOrEqual(-6);
      expect(effects.stabilityDelta).toBeLessThanOrEqual(3);
      expect(state.capital).toBeGreaterThanOrEqual(0);
      expect(state.capital).toBeLessThanOrEqual(200);
      const servingIds = new Set<string>();
      for (const dept of DEPTS) {
        const minister = state.ministers[dept];
        if (!minister) continue;
        servingIds.add(minister.id);
        expect(minister.competence).toBeGreaterThanOrEqual(1);
        expect(minister.competence).toBeLessThanOrEqual(10);
      }
      for (const key of Object.keys(state.relations)) {
        const value = state.relations[key];
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }
      for (const faction of FACTION_ORDER) {
        expect(state.factions[faction].influence).toBeGreaterThanOrEqual(0);
        expect(state.factions[faction].satisfaction).toBeGreaterThanOrEqual(0);
        expect(state.factions[faction].satisfaction).toBeLessThanOrEqual(100);
      }
      if (effects.logs.some((log) => log.kind === "event")) witnessedEvent = true;
    }
    allFinite(state);
    for (const dept of vacantDepartments(state)) {
      expect(state.candidates.some((c) => c.department === dept)).toBe(true);
    }
    expect(witnessedEvent).toBe(true);
  });

  it("候选人每 3 回合刷新且名额在 4..8，空部门立刻补候选", () => {
    const state = richState("POL-CANDIDATES");
    const before = state.candidates.map((c) => c.id);
    const added = refreshCandidates(state, 1, 3);
    expect(added.length).toBeGreaterThan(0);
    expect(state.candidates.length).toBeGreaterThanOrEqual(POLITICS_CONFIG.candidatePoolMin);
    expect(state.candidates.length).toBeLessThanOrEqual(POLITICS_CONFIG.candidatePoolMax);
    const newIds = state.candidates.filter((c) => before.indexOf(c.id) < 0).map((c) => c.id);
    expect(newIds.length).toBeGreaterThan(0);

    const dismissed = dismissMinister(state, "defense", 2, 4);
    expect(dismissed.ok).toBe(true);
    expect(state.candidates.some((c) => c.department === "defense")).toBe(true);

    // 通过回合结算再验证一次 3 回合刷新规则
    const state2 = createPoliticsState("POL-CANDIDATES-TURN");
    const idsBefore = state2.candidates.map((c) => c.id);
    politicsTurn(state2, { stability: 55 }, 1.5, 3);
    expect(state2.candidates.some((c) => idsBefore.indexOf(c.id) < 0)).toBe(true);
  });

  it("空部长容错：全部部门空缺时结算 / 修正 / 摘要仍安全", () => {
    const state = createPoliticsState("POL-EMPTY");
    emptyMinisters(state);
    const effects = politicsTurn(state, { stability: 40 }, 1, 1);
    expect(effects.stabilityDelta).toBeGreaterThanOrEqual(-6);
    expect(effects.stabilityDelta).toBeLessThanOrEqual(3);
    expect(effects.capitalGain).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(effects.researchMultiplier)).toBe(true);

    const mods = departmentModifiers(state);
    expect(mods.departments.length).toBe(6);
    for (const dept of mods.departments) {
      expect(dept.efficiency).toBe(0.7);
      expect(dept.ministerId).toBeNull();
      expect(dept.warning).toBeTruthy();
    }
    expect(politicsStabilityImpact(state)).toBeGreaterThanOrEqual(-3);
    expect(politicsStabilityImpact(state)).toBeLessThanOrEqual(3);
    expect(dismissMinister(state, "science", 1, 1).ok).toBe(false);
    expect(mediateMinisters(state, "science", "industry", 1).ok).toBe(false);
    expect(canMediate(state, "science", "industry").ok).toBe(false);

    // 峰会与任命仍可执行（候选人和资本存在）
    state.capital = 100;
    expect(holdSummit(state, 2).ok).toBe(true);
    const candidate = state.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;
    expect(appointMinister(state, candidate.id, 3, 3).ok).toBe(true);
    expect(servingOf(state).length).toBe(1);
    expect(politicsSummary(state).text.length).toBeGreaterThan(0);
  });

  it("非法动作与脏数据：不会把 NaN / Infinity / 未知 id 写进状态", () => {
    const state = createPoliticsState("POL-DIRTY");
    state.capital = Number.NaN;
    state.capitalRate = Number.POSITIVE_INFINITY;
    state.factions.technocrats.influence = Number.NaN;
    state.factions.scholars.satisfaction = Number.NEGATIVE_INFINITY;
    state.relations["m-999|m-998"] = Number.NaN;
    const science = state.ministers.science;
    expect(science).not.toBeNull();
    if (!science) return;
    science.competence = Number.NaN;
    science.loyalty = Number.POSITIVE_INFINITY;
    state.candidates.push({ id: "bad", department: "not-a-dept" } as unknown as MinisterState);
    const effects = politicsTurn(state, { stability: Number.NaN }, Number.NaN, Number.NaN);
    allFinite(state);
    allFinite(effects);
    expect(state.capital).toBeGreaterThanOrEqual(0);
    expect(state.capital).toBeLessThanOrEqual(200);
    expect(state.ministers.science?.competence).toBeGreaterThanOrEqual(1);
    expect(state.ministers.science?.competence).toBeLessThanOrEqual(10);
    expect(state.factions.scholars.satisfaction).toBeGreaterThanOrEqual(0);

    const invalid = appointMinister(state, "" as string, 1, 1);
    expect(invalid.ok).toBe(false);
    const invalidDismiss = dismissMinister(state, "nope" as DepartmentId, 1, 1);
    expect(invalidDismiss.ok).toBe(false);
    expect(invalidDismiss.stabilityImpact).toBe(0);
    expect(sanitizePoliticsState(state)).toBe(state);
  });
});

/* ------------------------------------------------------------------ *
 *  6. 丑闻 / 野心事件
 * ------------------------------------------------------------------ */

describe("政治系统：丑闻与野心", () => {
  it("低廉洁高野心显著提高丑闻概率，且随属性下降而降低", () => {
    const state = createPoliticsState("POL-SCANDAL-CHANCE");
    const minister = state.ministers.science;
    expect(minister).not.toBeNull();
    if (!minister) return;
    minister.traits = [];
    minister.integrity = 5;
    minister.ambition = 95;
    const risky = scandalChance(minister);
    minister.integrity = 95;
    minister.ambition = 10;
    const clean = scandalChance(minister);
    expect(risky).toBeGreaterThan(clean);
    expect(risky).toBeGreaterThan(0.1);
    expect(clean).toBeLessThan(0.02);
    expect(risky).toBeLessThanOrEqual(0.3);

    minister.ambition = 100;
    expect(ambitionChance(state, minister)).toBeGreaterThan(0.05);
    minister.ambition = 30;
    expect(ambitionChance(state, minister)).toBe(0);
  });

  it("丑闻 / 野心事件触发时写日志并扣稳定度，单回合惩罚有上限", () => {
    const state = richState("POL-SCANDAL-TURN");
    for (const minister of servingOf(state)) {
      minister.integrity = 5;
      minister.ambition = 95;
    }
    let eventLogged = false;
    let maxPenalty = 0;
    for (let turn = 1; turn <= 60; turn++) {
      const effects = politicsTurn(state, { stability: 50 }, turn * 0.5, turn);
      expect(effects.stabilityDelta).toBeGreaterThanOrEqual(-6);
      expect(effects.stabilityDelta).toBeLessThanOrEqual(3);
      if (effects.logs.some((log) => log.kind === "event")) {
        eventLogged = true;
        expect(effects.logs.some((log) => log.severity === "critical" || log.severity === "warning")).toBe(true);
        maxPenalty = Math.max(maxPenalty, -effects.stabilityDelta);
      }
    }
    expect(eventLogged).toBe(true);
    expect(maxPenalty).toBeGreaterThan(0);
    // 事件类稳定度惩罚合计不超过 6（含基础修正）
    expect(maxPenalty).toBeLessThanOrEqual(6 + EPS);
    expect(state.history.some((entry) => entry.kind === "event")).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 *  7. 展示数据与集成钩子
 * ------------------------------------------------------------------ */

describe("政治系统：展示数据与集成钩子", () => {
  it("ministerSummary 输出稳定、包含部门与特质，politicsSummary 给出色调", () => {
    const state = createPoliticsState("POL-SUMMARY");
    for (const minister of servingOf(state)) {
      const summary = ministerSummary(minister);
      expect(summary.length).toBeGreaterThan(20);
      expect(summary).toContain("部长");
      const traitNames = minister.traits
        .map((id) => MINISTER_TRAIT_MAP[id]?.name)
        .filter((name): name is string => typeof name === "string");
      expect(traitNames.some((name) => summary.indexOf(name) >= 0)).toBe(true);
      expect(ministerSummary(minister)).toBe(summary);
    }
    const summary = politicsSummary(state);
    expect(summary.text.length).toBeGreaterThan(10);
    expect(["stable", "tense", "fragile", "crisis"]).toContain(summary.tone);
  });

  it("动作可用性数据与视图契约一致", () => {
    const state = createPoliticsState("POL-ACTIONS");
    const availability = politicsActionAvailability(state, 1);
    expect(availability.appointCost).toBe(POLITICS_CONFIG.appointCost);
    expect(availability.dismissCost).toBe(POLITICS_CONFIG.dismissCost);
    expect(availability.mediateCost).toBe(POLITICS_CONFIG.mediateCost);
    expect(availability.summitCost).toBe(POLITICS_CONFIG.summitCost);
    expect(availability.canSummit).toBe(true);
    expect(availability.cooldownTurns).toBe(0);
    expect(canAppoint(state, state.candidates[0].id).ok).toBe(false);
    expect(canDismiss(state, "science").ok).toBe(true);
    expect(canMediate(state, "science", "industry").ok).toBe(true);
  });

  it("事件集成钩子：资本 / 关系 / 派系满意度修改均 clamp 且不产生 NaN", () => {
    const state = createPoliticsState("POL-HOOKS");
    state.capital = 50;
    expect(changeCapital(state, 15)).toBe(15);
    expect(state.capital).toBe(65);
    expect(changeCapital(state, -1000)).toBe(-65);
    expect(state.capital).toBe(0);

    const ma = state.ministers.science;
    const mb = state.ministers.industry;
    expect(ma).not.toBeNull();
    expect(mb).not.toBeNull();
    if (!ma || !mb) return;
    shiftRelation(state, ma.id, mb.id, -999);
    expect(getRelation(state, ma.id, mb.id)).toBe(-100);
    shiftDepartmentRelation(state, "science", "industry", 1000);
    expect(getRelation(state, ma.id, mb.id)).toBe(100);
    expect(shiftDepartmentRelation(state, "science", "observation", 10)).toBeGreaterThan(0);

    adjustFactionSatisfaction(state, "agrarians", -1000);
    expect(state.factions.agrarians.satisfaction).toBe(0);
    adjustFactionSatisfaction(state, "agrarians", 1000);
    expect(state.factions.agrarians.satisfaction).toBe(100);
    allFinite(state);
  });
});
