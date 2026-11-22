/**
 * 科技系统 v3：研究前置检查 / 学派重心 / 精通 / 互斥教义 / 每回合推进 / 效果聚合。
 *
 * v1.3 新增（详见 docs/EXPANSION_V3.md §1 与 docs/TECH_TREE.md）：
 *  - 研究重心：TechState.schoolFocus；同派研究速度 +15%，跨派 -5%（advanceResearch 内生效）。
 *  - 学派精通：每完成一项科技，按 tier×cost/10 累加 TechState.schoolPoints；
 *    精通 = 该派已得点数 / 该派全部科技点数，满精通使该派效果 +10%（aggregateTechEffects 内生效）。
 *  - 互斥教义：TechDef.exclusiveGroup + TechState.doctrineChoices；chooseDoctrine / applyDoctrine 写入，
 *    canResearch / startResearch 永久拦截同组其他选项。
 *  - 新效果字段：stabilityBonus / eventRiskMultiplier / politicalCapital / departmentBoost / researchSpeed。
 *
 * 典型调用顺序（game 层）：
 *   const check = canResearch(techId, techState, civ.era);
 *   startResearch(techState, techId, civ.era);
 *   const r = advanceResearch(techState, scienceBudget);   // 返回实际消耗 spent
 *   civ.resources.science.amount -= r.spent;
 *   const fx = aggregateTechEffects(techState);            // 含学派精通加成
 *   const mult = getTechMultipliers(techState);
 *
 * 效果字段的数值约定（lead / politics / events 接入时以此为准）：
 *  - 乘数字段（productionMultiplier / researchMultiplier / observationMultiplier / ...）：1 = 无加成，连乘。
 *  - stabilityBonus：稳定度加性点数（可为负，聚合后夹在 [-10, 15]）。
 *  - eventRiskMultiplier：事件风险乘数，<1 表示降低风险（聚合后夹在 [0.5, 1.2]）。
 *  - politicalCapital：每回合政治资本加性收入（聚合后夹在 [0, 8]）。
 *  - departmentBoost：六部门效率加性百分比（0.03 = +3%，聚合后每项夹在 [0, 0.5]）。
 *  - researchSpeed：研究速度加性百分比（0.05 = +5%），最终并入 getTechMultipliers().research。
 */
import type {
  DepartmentId,
  ResearchCategory,
  ResourceId,
  TechBranch,
  TechDef,
  TechEffects,
  TechSchool,
  TechState,
} from "../core/types";
import { RESOURCE_IDS } from "../civilization/resources";
import { clamp } from "../core/math";
import {
  DOCTRINE_GROUPS,
  TECH_CATEGORIES,
  TECH_CATEGORY_OF_BRANCH,
  TECH_CATEGORY_ORDER,
  TECH_DEFS,
  TECH_MAP,
  TECH_SCHOOLS,
  TECH_SCHOOL_ORDER,
  getDoctrineGroupMeta,
  getTechDef,
  researchCategoryOf,
  techName,
  techSchoolOf,
  techsByCategory,
} from "./tree";
import type { DoctrineGroupMeta, ResearchCategoryMeta, TechSchoolMeta } from "./tree";

/** 科技乘数集合（1 = 无加成；disaster 为伤害倍率，<1 表示减伤）。 */
export interface TechMultipliers {
  production: Record<ResourceId, number>;
  research: number;
  agriculture: number;
  energy: number;
  industry: number;
  observation: number;
  prediction: number;
  habitability: number;
  /** 灾害伤害倍率：1 = 无减免，0.7 = 受到 70% 伤害。 */
  disaster: number;
  populationCapacity: number;
}

export interface ResearchCheck {
  ok: boolean;
  reason: string | null;
}

export interface ResearchStartResult extends ResearchCheck {
  /** 非错误但值得提示的信息（例如切换目标导致进度损失）。 */
  notice?: string;
}

export interface ResearchAdvance {
  completedId: string | null;
  /** 实际从预算中扣除的科研点（可能是小数；调用方直接扣除即可）。 */
  spent: number;
  /** 若本次完成的是互斥教义科技，返回被采纳的教义 id。 */
  doctrineChosen?: string;
  /** 本次完成科技为该学派贡献的精通点数。 */
  schoolPointsGained?: number;
}

/** 学派重心：同派研究速度 +15%。 */
export const FOCUS_SPEED_BONUS = 0.15;
/** 学派重心：跨派研究速度 -5%。 */
export const CROSS_SCHOOL_PENALTY = 0.05;
/** 满精通时该学派效果 +10%。 */
export const MASTERY_EFFECT_BONUS = 0.1;
/** 精通点数归一化单位：单项科技贡献 = tier × cost / SCHOOL_POINT_UNIT。 */
export const SCHOOL_POINT_UNIT = 10;

/* ---- v1.6 发展纲领 ---- */
/** 已选发展大类：研究速度 +10%。 */
export const DEVELOPMENT_FOCUS_BONUS = 0.1;
/** 未选发展大类：研究速度 -35%。 */
export const DEVELOPMENT_NEGLECT_PENALTY = 0.35;
/** 发展纲领开放时代（E3 蒸汽纪元起）。 */
export const DEVELOPMENT_MIN_ERA = 3;
/** 可选择的发展大类数量上限。 */
export const DEVELOPMENT_MAX_CATEGORIES = 2;

/* ---- v1.6 科研资源倾斜 ---- */
/** 中性倾斜值：50% → 研究速度 ×1。 */
export const RESEARCH_FUNDING_NEUTRAL = 50;
/** 倾斜 0% 时的研究速度乘数（约 -40%）。 */
export const RESEARCH_FUNDING_MIN_SPEED = 0.6;
/** 倾斜 100% 时的研究速度乘数（约 +35%）。 */
export const RESEARCH_FUNDING_MAX_SPEED = 1.35;
/** 倾斜 100% 时非科研资源产出的乘数（用产出换速度）。 */
export const RESEARCH_FUNDING_OTHER_PENALTY = 0.9;
/** 倾斜 0% 时非科研资源产出的乘数（减少科研换产出）。 */
export const RESEARCH_FUNDING_OTHER_BONUS = 1.1;

/* ---- v1.6 注入资源加速 ---- */
/** 每次加速获得当前项目剩余进度的比例。 */
export const RESEARCH_BOOST_PROGRESS_RATIO = 0.2;
/** 每多使用一次，加速资源成本额外增加的比例（价格随次数递增）。 */
export const RESEARCH_BOOST_COST_GROWTH = 0.75;

const DEPARTMENT_IDS: readonly DepartmentId[] = [
  "administration",
  "science",
  "industry",
  "agriculture",
  "defense",
  "observation",
] as const;

/** 空的科技状态（开新游戏时使用；v1.3 初始化学派/教义字段）。 */
export function createTechState(): TechState {
  return {
    researched: [],
    activeTech: null,
    progress: 0,
    totalScience: 0,
    schoolFocus: null,
    doctrineChoices: {},
    schoolPoints: {},
    developmentCategories: null,
    researchFunding: RESEARCH_FUNDING_NEUTRAL,
    researchBoostCounts: {},
    lastBoostTurn: -1,
  };
}

/** 该科技是否已经研究完成。 */
export function isResearched(techState: TechState, techId: string): boolean {
  return techState.researched.includes(techId);
}

/** 已完成的科技数量（未知 id 不计入）。 */
export function researchedCount(techState: TechState): number {
  return techState.researched.filter((id) => !!getTechDef(id)).length;
}

/** 科技中文名。 */
export function techDisplayName(techId: string): string {
  return techName(techId);
}

/** 当前正在研究的科技定义；没有则 null。 */
export function activeTechDef(techState: TechState): TechDef | null {
  return techState.activeTech ? (getTechDef(techState.activeTech) ?? null) : null;
}

/** 把任意输入夹到合法时代 1..6（非法/缺省 = 6，保持旧调用"全解锁"语义）。 */
export function clampTechEra(era: number | undefined): number {
  if (era == null || !Number.isFinite(era)) return 6;
  return Math.max(1, Math.min(6, Math.floor(era)));
}

/* ------------------------------------------------------------------ *
 *  学派：重心 / 精通 / 点数                                            *
 * ------------------------------------------------------------------ */

/** 某项科技的精通点数贡献 = tier × cost / 10。 */
export function schoolPointsOfTech(tech: TechDef): number {
  return (tech.tier * tech.cost) / SCHOOL_POINT_UNIT;
}

/** 某学派全部科技的精通点数上限（研究全学派时达到，用于归一化）。 */
export function schoolPointTotal(school: TechSchool): number {
  return TECH_DEFS.reduce((sum, tech) => {
    return techSchoolOf(tech.id) === school ? sum + schoolPointsOfTech(tech) : sum;
  }, 0);
}

/** 由 researched 列表直接推导某学派点数（旧存档 / 测试直接写 researched 时使用）。 */
export function derivedSchoolPoints(techState: TechState, school: TechSchool): number {
  return techState.researched.reduce((sum, id) => {
    const def = TECH_MAP[id];
    if (!def || techSchoolOf(id) !== school) return sum;
    return sum + schoolPointsOfTech(def);
  }, 0);
}

/** 某学派已累计精通点数；优先读 state.schoolPoints，缺失时由 researched 推导。 */
export function schoolPointsFor(techState: TechState, school: TechSchool): number {
  const stored = techState.schoolPoints?.[school];
  if (typeof stored === "number" && Number.isFinite(stored)) return Math.max(0, stored);
  return derivedSchoolPoints(techState, school);
}

/** 某学派精通度 0..1（1 = 研究完该学派全部科技）。 */
export function schoolMastery(techState: TechState, school: TechSchool): number {
  if (!TECH_SCHOOLS[school]) return 0;
  const total = schoolPointTotal(school);
  if (total <= 0) return 0;
  return clamp(schoolPointsFor(techState, school) / total, 0, 1);
}

/**
 * 重新计算并写回 schoolPoints（供旧存档迁移 / 测试构造状态后调用）。
 * 返回同一个 state 以支持链式调用。
 */
export function syncSchoolPoints(techState: TechState): TechState {
  const points: Partial<Record<TechSchool, number>> = {};
  for (const school of TECH_SCHOOL_ORDER) points[school] = derivedSchoolPoints(techState, school);
  techState.schoolPoints = points;
  return techState;
}

/** 科研资源倾斜 0..100 对应的研究速度乘数（50 → 1；0 → 0.6；100 → 1.35）。 */
export function fundingResearchSpeedFactor(percent: number | undefined): number {
  const p = Number.isFinite(percent as number) ? Math.max(0, Math.min(100, percent as number)) : RESEARCH_FUNDING_NEUTRAL;
  if (p <= RESEARCH_FUNDING_NEUTRAL) {
    const t = p / RESEARCH_FUNDING_NEUTRAL;
    return RESEARCH_FUNDING_MIN_SPEED + (1 - RESEARCH_FUNDING_MIN_SPEED) * t;
  }
  const t = (p - RESEARCH_FUNDING_NEUTRAL) / (100 - RESEARCH_FUNDING_NEUTRAL);
  return 1 + (RESEARCH_FUNDING_MAX_SPEED - 1) * t;
}

/** 当前科研资源倾斜百分比（缺省 50）。 */
export function researchFundingPercent(techState: TechState): number {
  const raw = techState.researchFunding;
  return Number.isFinite(raw as number) ? Math.max(0, Math.min(100, raw as number)) : RESEARCH_FUNDING_NEUTRAL;
}

/** 发展纲领对某项科技的速度乘数：已选大类 +10%，未选大类 -35%，未选择时 1。 */
export function developmentSpeedFactor(techState: TechState, techId: string): number {
  const chosen = techState.developmentCategories;
  if (!Array.isArray(chosen) || chosen.length === 0) return 1;
  const category = researchCategoryOf(techId);
  if (!category) return 1;
  return chosen.includes(category) ? 1 + DEVELOPMENT_FOCUS_BONUS : 1 - DEVELOPMENT_NEGLECT_PENALTY;
}

/**
 * 研究某项科技的速度倍率（v1.6 汇总）：
 *  - 学派重心：同派 +15% / 跨派 -5%；
 *  - 发展纲领：已选大类 +10% / 未选大类 -35%；
 *  - 科研资源倾斜：0% → 0.6，50% → 1，100% → 1.35。
 */
export function researchSpeedFor(techState: TechState, techId: string): number {
  const def = getTechDef(techId);
  if (!def) return 1;
  const focus = techState.schoolFocus ?? null;
  const school = schoolOfDef(def);
  const schoolFactor = !focus ? 1 : school === focus ? 1 + FOCUS_SPEED_BONUS : 1 - CROSS_SCHOOL_PENALTY;
  return (
    schoolFactor *
    developmentSpeedFactor(techState, techId) *
    fundingResearchSpeedFactor(researchFundingPercent(techState))
  );
}

/** 给定重心下研究该项科技所需的有效科研点（含速度加成，向上取整，供 UI 显示）。 */
export function researchCostFor(techState: TechState, techId: string): number {
  const def = getTechDef(techId);
  if (!def) return 0;
  const speed = researchSpeedFor(techState, techId);
  return speed > 0 ? Math.max(1, Math.ceil(def.cost / speed)) : def.cost;
}

/** 设置研究重心；null = 均衡发展。非法学派 id 会被拒绝。 */
export function setSchoolFocus(techState: TechState, school: TechSchool | null): ResearchCheck {
  if (school !== null && !TECH_SCHOOLS[school]) return { ok: false, reason: "未知学派" };
  techState.schoolFocus = school;
  return { ok: true, reason: null };
}

/** 科技所属学派（缺省时按分支推断，保证恒有值）。 */
export function schoolOfTech(techId: string): TechSchool | null {
  return techSchoolOf(techId);
}

function schoolOfDef(def: TechDef): TechSchool {
  return def.school ?? techSchoolOf(def.id) ?? "observation";
}

/* ------------------------------------------------------------------ *
 *  互斥教义                                                           *
 * ------------------------------------------------------------------ */

export interface DoctrineOptionInfo {
  techId: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  school: TechSchool;
  researched: boolean;
  chosen: boolean;
}

export interface DoctrineGroupInfo extends DoctrineGroupMeta {
  chosenTechId: string | null;
  options: DoctrineOptionInfo[];
}

/** 列出互斥教义组（含当前状态）；供 UI / lead 组装 TechTreeView 使用。 */
export function doctrineGroups(techState?: TechState): DoctrineGroupInfo[] {
  const state = techState ?? createTechState();
  return DOCTRINE_GROUPS.map((group) => {
    const chosenTechId = state.doctrineChoices?.[group.id] ?? null;
    return {
      ...group,
      chosenTechId,
      options: group.techIds.reduce<DoctrineOptionInfo[]>((list, techId) => {
        const def = TECH_MAP[techId];
        if (!def) return list;
        list.push({
          techId,
          name: def.name,
          description: def.effectSummary,
          tier: def.tier,
          cost: def.cost,
          school: schoolOfDef(def),
          researched: isResearched(state, techId),
          chosen: chosenTechId === techId,
        });
        return list;
      }, []),
    };
  });
}

/** 某科技所在教义组已选中的科技 id；无组/未选返回 null。 */
export function chosenDoctrineFor(techState: TechState, groupId: string): string | null {
  return techState.doctrineChoices?.[groupId] ?? null;
}

/** 教义选择结果。 */
export interface DoctrineChoiceResult extends ResearchCheck {
  groupId?: string;
  techId?: string;
  notice?: string;
}

/**
 * 选择互斥教义：写入 doctrineChoices[groupId] = techId，同组其他选项永久不可研究。
 * 规则：
 *  - 未知科技 / 非教义科技 / 未知教义组 → 拒绝；
 *  - 该组已选择同一科技 → 幂等成功；
 *  - 该组已选择其他科技 / 已研究其他选项 → 拒绝并说明；
 *  - 尚未研究该科技时，要求它当前满足时代与前置（避免锁定一个永远无法完成的选项）。
 */
export function chooseDoctrine(techState: TechState, techId: string, era: number = 5): DoctrineChoiceResult {
  const def = getTechDef(techId);
  if (!def) return { ok: false, reason: "未知科技：" + techId };
  const groupId = def.exclusiveGroup;
  if (!groupId) return { ok: false, reason: "该科技不属于互斥教义组" };
  const meta = getDoctrineGroupMeta(groupId);
  if (!meta) return { ok: false, reason: "未知教义组：" + groupId, groupId };
  if (!techState.doctrineChoices) techState.doctrineChoices = {};

  const chosen = techState.doctrineChoices[groupId] ?? null;
  if (chosen === techId) {
    return { ok: true, reason: null, groupId, techId, notice: "该教义已处于选中状态" };
  }
  if (chosen) {
    return { ok: false, reason: "同组已选择其他教义：" + techName(chosen), groupId };
  }
  for (const otherId of meta.techIds) {
    if (otherId !== techId && isResearched(techState, otherId)) {
      return { ok: false, reason: "同组其他教义已完成研究：" + techName(otherId), groupId };
    }
  }
  if (!isResearched(techState, techId)) {
    const check = canResearch(techId, techState, era);
    if (!check.ok) return { ok: false, reason: check.reason, groupId };
  }
  techState.doctrineChoices[groupId] = techId;
  return { ok: true, reason: null, groupId, techId };
}

/** chooseDoctrine 的别名（规格允许任选其一命名）。 */
export function applyDoctrine(techState: TechState, techId: string, era: number = 5): DoctrineChoiceResult {
  return chooseDoctrine(techState, techId, era);
}

/** 某项科技是否因同组已选其他教义而被永久锁闭；返回带教义组名称的具体原因。 */
export function doctrineLockReason(techState: TechState, techId: string): string | null {
  const def = getTechDef(techId);
  if (!def?.exclusiveGroup) return null;
  const group = getDoctrineGroupMeta(def.exclusiveGroup);
  const title = group ? "「" + group.title + "」" : "";
  const chosen = techState.doctrineChoices?.[def.exclusiveGroup] ?? null;
  if (chosen && chosen !== techId) {
    return "已选择其他教义：" + techName(chosen) + "（" + title + "同组互斥，其余选项永久锁闭）";
  }
  for (const otherId of group?.techIds ?? []) {
    if (otherId !== techId && isResearched(techState, otherId)) {
      return "已选择其他教义：" + techName(otherId) + "（" + title + "同组互斥，其余选项永久锁闭）";
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  研究检查 / 推进                                                     *
 * ------------------------------------------------------------------ */

/** 前置检查结果（供 canResearch 组装完整原因）。 */
function missingPrerequisites(def: TechDef, techState: TechState): string[] {
  const reasons: string[] = [];
  const missingHard = def.requires.filter((req) => !isResearched(techState, req));
  if (missingHard.length > 0) {
    reasons.push("需要前置科技：" + missingHard.map(techName).join("、"));
  }
  if (def.requiresAny && def.requiresAny.length > 0) {
    const anyOk = def.requiresAny.some((req) => isResearched(techState, req));
    if (!anyOk) {
      reasons.push("需要以下任一前置科技：" + def.requiresAny.map(techName).join(" / "));
    }
  }
  return reasons;
}

/**
 * 能否开始研究某科技。
 * 拒绝原因（按检查顺序）：未知科技 / 已研究 / 正在研究 / 时代未到 / 互斥教义冲突 / 前置未满足。
 * era 缺省为 5 —— 旧调用（不传时代）保持全解锁语义，向后兼容。
 */
export function canResearch(techId: string, techState: TechState, era: number = 5): ResearchCheck {
  const def = getTechDef(techId);
  if (!def) return { ok: false, reason: "未知科技：" + techId };
  if (isResearched(techState, techId)) return { ok: false, reason: "该科技已研究完成" };
  if (techState.activeTech === techId) return { ok: false, reason: "该科技正在研究中" };
  const eraLimit = clampTechEra(era);
  if (def.tier > eraLimit) return { ok: false, reason: `需要第 ${def.tier} 时代` };
  const lock = doctrineLockReason(techState, techId);
  if (lock) return { ok: false, reason: "同组路线永久锁闭——" + lock };
  const reasons = missingPrerequisites(def, techState);
  if (reasons.length > 0) return { ok: false, reason: reasons.join("；") };
  return { ok: true, reason: null };
}

/**
 * 选定研究方向。切换方向会清空当前研究进度（已投入的科研点不返还）。
 * 互斥教义冲突由 canResearch 拦截，因此不会出现"研究到一半才被锁"的状态。
 */
export function startResearch(techState: TechState, techId: string, era: number = 5): ResearchStartResult {
  const check = canResearch(techId, techState, era);
  if (!check.ok) return check;
  let notice: string | undefined;
  if (techState.activeTech && techState.progress > 0) {
    notice = "已切换研究目标，原方向的研究进度已损失";
  }
  techState.activeTech = techId;
  techState.progress = 0;
  return { ok: true, reason: null, notice };
}

/** 中止当前研究，进度清空、预算保留（科研点是库存资源，不返还已投入部分）。 */
export function cancelResearch(techState: TechState): boolean {
  if (!techState.activeTech) return false;
  techState.activeTech = null;
  techState.progress = 0;
  return true;
}

/**
 * 当前项目进度达到成本时结算完成：写入 researched、累计 schoolPoints，
 * 若为互斥教义科技则自动写入 doctrineChoices。返回完成信息；未完成时 completedId 为 null。
 */
function completeActiveResearch(techState: TechState): Omit<ResearchAdvance, "spent"> {
  const def = activeTechDef(techState);
  if (!def || techState.progress < def.cost - 1e-9) return { completedId: null };
  techState.progress = def.cost;
  if (!techState.researched.includes(def.id)) techState.researched.push(def.id);
  const points = schoolPointsOfTech(def);
  const school = schoolOfDef(def);
  if (!techState.schoolPoints) techState.schoolPoints = {};
  const prev = techState.schoolPoints[school];
  techState.schoolPoints[school] = (typeof prev === "number" && Number.isFinite(prev) ? prev : 0) + points;
  let doctrineChosen: string | undefined;
  if (def.exclusiveGroup) {
    if (!techState.doctrineChoices) techState.doctrineChoices = {};
    if (!techState.doctrineChoices[def.exclusiveGroup]) {
      techState.doctrineChoices[def.exclusiveGroup] = def.id;
      doctrineChosen = def.id;
    }
  }
  techState.activeTech = null;
  techState.progress = 0;
  return { completedId: def.id, doctrineChosen, schoolPointsGained: points };
}

/**
 * 用 scienceBudget 点科研投入推进当前研究。
 *  - 学派重心 / 发展纲领 / 科研资源倾斜在此生效：实际进度 = 消耗科研点 × 研究速度；
 *  - externalSpeed 为建筑层加成（科学院建筑群的全文明研究速度）；
 *  - 只消耗完成本科技所需的点数，多余预算不扣除（由调用方保留）；
 *  - 完成时写入 researched、累计 schoolPoints，若为互斥教义科技则自动写入 doctrineChoices。
 */
export function advanceResearch(techState: TechState, scienceBudget: number, externalSpeed = 1): ResearchAdvance {
  const def = activeTechDef(techState);
  if (!def) return { completedId: null, spent: 0 };
  const budget = Number.isFinite(scienceBudget) ? Math.max(0, scienceBudget) : 0;
  if (budget <= 0) return { completedId: null, spent: 0 };

  const buildingSpeed = Number.isFinite(externalSpeed) && externalSpeed > 0 ? externalSpeed : 1;
  const speed = researchSpeedFor(techState, def.id) * buildingSpeed;
  const remaining = Math.max(0, def.cost - techState.progress);
  const spent = Math.min(budget, speed > 0 ? remaining / speed : remaining);
  const gained = spent * speed;
  techState.progress = clamp(techState.progress + gained, 0, def.cost);
  techState.totalScience += spent;

  const done = completeActiveResearch(techState);
  return { completedId: done.completedId, spent, doctrineChosen: done.doctrineChosen, schoolPointsGained: done.schoolPointsGained };
}

/** 当前研究进度信息（供 UI 科研面板）。 */
export interface ActiveResearchInfo {
  techId: string;
  name: string;
  cost: number;
  progress: number;
  percent: number;
  remaining: number;
  /** v1.3：学派与当前研究速度倍率。 */
  school?: TechSchool;
  schoolName?: string;
  speed?: number;
}

export function activeResearchInfo(techState: TechState): ActiveResearchInfo | null {
  const def = activeTechDef(techState);
  if (!def) return null;
  const progress = clamp(techState.progress, 0, def.cost);
  const school = schoolOfDef(def);
  return {
    techId: def.id,
    name: def.name,
    cost: def.cost,
    progress,
    percent: def.cost <= 0 ? 1 : clamp(progress / def.cost, 0, 1),
    remaining: Math.max(0, def.cost - progress),
    school,
    schoolName: TECH_SCHOOLS[school]?.name ?? school,
    speed: researchSpeedFor(techState, def.id),
  };
}

/* ------------------------------------------------------------------ *
 *  效果聚合                                                           *
 * ------------------------------------------------------------------ */

/** 单一学派的效果累加器（乘数字段用连乘，加性字段用求和）。 */
interface SchoolAccumulator {
  production: Record<ResourceId, number>;
  research: number;
  observation: number;
  agriculture: number;
  energy: number;
  industry: number;
  prediction: number;
  habitability: number;
  disaster: number;
  populationCapacity: number;
  stability: number;
  politicalCapital: number;
  researchSpeed: number;
  eventRisk: number;
  department: Record<DepartmentId, number>;
  allowColony: boolean;
  allowPlanetEngine: boolean;
  observationLevelUnlock: number;
}

function createSchoolAccumulator(): SchoolAccumulator {
  const production = {} as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) production[r] = 1;
  const department = {} as Record<DepartmentId, number>;
  for (const id of DEPARTMENT_IDS) department[id] = 0;
  return {
    production,
    research: 1,
    observation: 1,
    agriculture: 1,
    energy: 1,
    industry: 1,
    prediction: 1,
    habitability: 0,
    disaster: 0,
    populationCapacity: 0,
    stability: 0,
    politicalCapital: 0,
    researchSpeed: 0,
    eventRisk: 1,
    department,
    allowColony: false,
    allowPlanetEngine: false,
    observationLevelUnlock: 0,
  };
}

function accumulateInto(acc: SchoolAccumulator, e: TechEffects): void {
  if (e.productionMultiplier) {
    for (const r of RESOURCE_IDS) acc.production[r] *= e.productionMultiplier[r] ?? 1;
  }
  acc.research *= e.researchMultiplier ?? 1;
  acc.observation *= e.observationMultiplier ?? 1;
  acc.agriculture *= e.agricultureMultiplier ?? 1;
  acc.energy *= e.energyMultiplier ?? 1;
  acc.industry *= e.industryMultiplier ?? 1;
  acc.prediction *= e.predictionMultiplier ?? 1;
  acc.eventRisk *= e.eventRiskMultiplier ?? 1;
  acc.habitability += e.habitabilityBonus ?? 0;
  acc.disaster += e.disasterResistance ?? 0;
  acc.populationCapacity += e.populationCapacityBonus ?? 0;
  acc.stability += e.stabilityBonus ?? 0;
  acc.politicalCapital += e.politicalCapital ?? 0;
  acc.researchSpeed += e.researchSpeed ?? 0;
  if (e.departmentBoost) {
    for (const id of DEPARTMENT_IDS) acc.department[id] += e.departmentBoost[id] ?? 0;
  }
  acc.allowColony = acc.allowColony || e.allowColony === true;
  acc.allowPlanetEngine = acc.allowPlanetEngine || e.allowPlanetEngine === true;
  acc.observationLevelUnlock = Math.max(acc.observationLevelUnlock, e.observationLevelUnlock ?? 0);
}

function emptyAggregate(): TechEffects {
  const productionMultiplier = {} as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) productionMultiplier[r] = 1;
  const departmentBoost = {} as Record<DepartmentId, number>;
  for (const id of DEPARTMENT_IDS) departmentBoost[id] = 0;
  return {
    productionMultiplier,
    researchMultiplier: 1,
    observationMultiplier: 1,
    agricultureMultiplier: 1,
    energyMultiplier: 1,
    industryMultiplier: 1,
    habitabilityBonus: 0,
    disasterResistance: 0,
    predictionMultiplier: 1,
    populationCapacityBonus: 0,
    allowColony: false,
    allowPlanetEngine: false,
    observationLevelUnlock: 0,
    stabilityBonus: 0,
    eventRiskMultiplier: 1,
    politicalCapital: 0,
    departmentBoost,
    researchSpeed: 0,
  };
}

/**
 * 聚合全部已研究科技的原始效果（含学派精通加成）。
 * 输出恒定包含所有字段（乘数默认 1，加成为 0，departmentBoost 六部门齐全），便于 game 层直接读取。
 *
 * 学派精通：某学派的效果先在该学派内聚合，再按 (1 + 0.1 × mastery) 放大其"超出基数"的部分；
 * 满精通时该派效果恰好 +10%（上限）。空科技状态输出与 v1.2 完全一致。
 */
export function aggregateTechEffects(techState: TechState): TechEffects {
  const perSchool = new Map<TechSchool, SchoolAccumulator>();
  for (const id of techState.researched) {
    const def = getTechDef(id);
    if (!def) continue;
    const school = schoolOfDef(def);
    let acc = perSchool.get(school);
    if (!acc) {
      acc = createSchoolAccumulator();
      perSchool.set(school, acc);
    }
    accumulateInto(acc, def.effects);
  }

  const totals = createSchoolAccumulator();
  for (const [school, acc] of perSchool) {
    const mastery = schoolMastery(techState, school);
    const boost = 1 + MASTERY_EFFECT_BONUS * clamp(mastery, 0, 1);
    for (const r of RESOURCE_IDS) {
      totals.production[r] *= 1 + (acc.production[r] - 1) * boost;
    }
    totals.research *= 1 + (acc.research - 1) * boost;
    totals.observation *= 1 + (acc.observation - 1) * boost;
    totals.agriculture *= 1 + (acc.agriculture - 1) * boost;
    totals.energy *= 1 + (acc.energy - 1) * boost;
    totals.industry *= 1 + (acc.industry - 1) * boost;
    totals.prediction *= 1 + (acc.prediction - 1) * boost;
    totals.eventRisk *= 1 - (1 - acc.eventRisk) * boost;
    totals.habitability += acc.habitability * boost;
    totals.disaster += acc.disaster * boost;
    totals.populationCapacity += acc.populationCapacity * boost;
    totals.stability += acc.stability * boost;
    totals.politicalCapital += acc.politicalCapital * boost;
    totals.researchSpeed += acc.researchSpeed * boost;
    for (const id of DEPARTMENT_IDS) totals.department[id] += acc.department[id] * boost;
    totals.allowColony = totals.allowColony || acc.allowColony;
    totals.allowPlanetEngine = totals.allowPlanetEngine || acc.allowPlanetEngine;
    totals.observationLevelUnlock = Math.max(totals.observationLevelUnlock, acc.observationLevelUnlock);
  }

  const agg = emptyAggregate();
  const prod = agg.productionMultiplier as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) prod[r] = clamp(totals.production[r], 0.2, 5);
  agg.researchMultiplier = clamp(totals.research, 0.2, 5);
  agg.observationMultiplier = clamp(totals.observation, 0.2, 5);
  agg.agricultureMultiplier = clamp(totals.agriculture, 0.2, 5);
  agg.energyMultiplier = clamp(totals.energy, 0.2, 5);
  agg.industryMultiplier = clamp(totals.industry, 0.5, 4);
  agg.predictionMultiplier = clamp(totals.prediction, 0.2, 5);
  agg.habitabilityBonus = clamp(totals.habitability, 0, 0.6);
  agg.disasterResistance = clamp(totals.disaster, 0, 0.8);
  agg.populationCapacityBonus = clamp(totals.populationCapacity, 0, 0.8);
  agg.allowColony = totals.allowColony;
  agg.allowPlanetEngine = totals.allowPlanetEngine;
  agg.observationLevelUnlock = clamp(totals.observationLevelUnlock, 0, 6);
  agg.stabilityBonus = clamp(totals.stability, -10, 15);
  agg.eventRiskMultiplier = clamp(totals.eventRisk, 0.5, 1.2);
  agg.politicalCapital = clamp(totals.politicalCapital, 0, 8);
  const departmentBoost = {} as Record<DepartmentId, number>;
  for (const id of DEPARTMENT_IDS) departmentBoost[id] = clamp(totals.department[id], 0, 0.5);
  agg.departmentBoost = departmentBoost;
  agg.researchSpeed = clamp(totals.researchSpeed, 0, 1.5);
  return agg;
}

/**
 * 把科技效果折算成可直接相乘的乘数集合。
 * 农业科技并入 food 产出，能源科技并入 energy 产出，避免调用方重复相乘。
 * researchSpeed（加性）在此并入 research 乘数，因此旧调用方无需改动即享受新效果。
 */
export function getTechMultipliers(techState: TechState): TechMultipliers {
  const agg = aggregateTechEffects(techState);
  const prod = agg.productionMultiplier as Record<ResourceId, number>;
  const production = {} as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) production[r] = prod[r] ?? 1;
  production.food *= agg.agricultureMultiplier ?? 1;
  production.energy *= agg.energyMultiplier ?? 1;

  return {
    production,
    research: clamp((agg.researchMultiplier ?? 1) * (1 + (agg.researchSpeed ?? 0)), 0.2, 5),
    agriculture: agg.agricultureMultiplier ?? 1,
    energy: agg.energyMultiplier ?? 1,
    industry: agg.industryMultiplier ?? 1,
    observation: agg.observationMultiplier ?? 1,
    prediction: agg.predictionMultiplier ?? 1,
    habitability: 1 + (agg.habitabilityBonus ?? 0),
    disaster: clamp(1 - (agg.disasterResistance ?? 0), 0.05, 1),
    populationCapacity: 1 + (agg.populationCapacityBonus ?? 0),
  };
}

/** 全部科技的总科研点成本（用于时代进度的分母/统计）。 */
export function totalTechCost(): number {
  return TECH_DEFS.reduce((sum, tech) => sum + tech.cost, 0);
}

/** 某分支已研究 / 总数（UI 分支标题用）。 */
export function branchProgress(
  techState: TechState,
  branch: TechBranch,
): { researched: number; total: number } {
  const list = TECH_DEFS.filter((tech) => tech.branch === branch);
  return {
    researched: list.filter((tech) => isResearched(techState, tech.id)).length,
    total: list.length,
  };
}

/** 六学派元数据（order 保证 UI 渲染顺序稳定）。 */
export const TECH_SCHOOL_LIST: readonly TechSchoolMeta[] = TECH_SCHOOL_ORDER.map((id) => TECH_SCHOOLS[id]);


/* ------------------------------------------------------------------ *
 *  v1.6 发展纲领 / 科研资源倾斜 / 注入资源加速                         *
 * ------------------------------------------------------------------ */

export interface ResearchCategoryView extends ResearchCategoryMeta {
  selected: boolean;
}

export interface DevelopmentProgramInfo {
  /** 是否已选择发展纲领（至少 1 个大类）。 */
  chosen: boolean;
  /** 当前选择的大类。 */
  categories: ResearchCategory[];
  options: ResearchCategoryView[];
  /** 已选大类研究速度加成（0.1 = +10%）。 */
  focusBonus: number;
  /** 未选大类研究速度惩罚（0.35 = -35%）。 */
  neglectPenalty: number;
  /** 是否已到可选时代（E3）。 */
  unlocked: boolean;
}

/** 发展纲领状态（供科研 UI）。 */
export function developmentProgramInfo(techState: TechState, era: number): DevelopmentProgramInfo {
  const chosen = Array.isArray(techState.developmentCategories)
    ? TECH_CATEGORY_ORDER.filter((id) => (techState.developmentCategories ?? []).includes(id))
    : [];
  return {
    chosen: chosen.length > 0,
    categories: chosen,
    options: TECH_CATEGORY_ORDER.map((id) => ({ ...TECH_CATEGORIES[id], selected: chosen.includes(id) })),
    focusBonus: DEVELOPMENT_FOCUS_BONUS,
    neglectPenalty: DEVELOPMENT_NEGLECT_PENALTY,
    unlocked: clampTechEra(era) >= DEVELOPMENT_MIN_ERA,
  };
}

export interface DevelopmentChoiceResult extends ResearchCheck {
  categories?: ResearchCategory[];
  notice?: string;
}

/**
 * 选择发展纲领：E3 起可指定 1~2 个研究大类作为重点。
 * 已选大类研究速度 +10%，未选大类 -35%；再次调用即调整重点（写入 TechState 持久化）。
 */
export function setDevelopmentCategories(
  techState: TechState,
  categories: readonly ResearchCategory[],
  era: number = 6,
): DevelopmentChoiceResult {
  if (clampTechEra(era) < DEVELOPMENT_MIN_ERA) {
    return { ok: false, reason: "发展纲领需到第 3 时代（蒸汽纪元）才能确定" };
  }
  const list: ResearchCategory[] = [];
  for (const raw of categories) {
    if (!TECH_CATEGORY_ORDER.includes(raw)) return { ok: false, reason: "未知研究大类：" + raw };
    if (!list.includes(raw)) list.push(raw);
  }
  if (list.length < 1) return { ok: false, reason: "至少选择 1 个发展大类" };
  if (list.length > DEVELOPMENT_MAX_CATEGORIES) {
    return { ok: false, reason: "最多只能选择 2 个发展大类（玩家只能选择其中一个或两个大类发展）" };
  }
  const previous = techState.developmentCategories?.length ?? 0;
  techState.developmentCategories = list;
  return {
    ok: true,
    reason: null,
    categories: list,
    notice: previous > 0 ? "发展纲领已调整" : "发展纲领已确立",
  };
}

export interface FundingChoiceResult extends ResearchCheck {
  percent: number;
}

/** 设置科研资源倾斜 0..100；非法输入夹取，缺省 50。 */
export function setResearchFunding(techState: TechState, percent: number): FundingChoiceResult {
  if (!Number.isFinite(percent)) return { ok: false, reason: "倾斜值必须是 0~100 的数字", percent: researchFundingPercent(techState) };
  const value = Math.max(0, Math.min(100, Math.round(percent * 10) / 10));
  techState.researchFunding = value;
  return { ok: true, reason: null, percent: value };
}

export interface FundingModifiers {
  percent: number;
  /** 科研速度乘数（0.6..1.35）。 */
  researchSpeed: number;
  /** 科研点（science 资源）产出乘数。 */
  scienceProduction: number;
  /** 非科研资源产出乘数（用产出换取科研倾斜）。 */
  otherProduction: number;
}

/** 科研资源倾斜的完整乘数：倾斜越高研究越快，但非科研产出下降。 */
export function fundingModifiers(techState: TechState): FundingModifiers {
  const percent = researchFundingPercent(techState);
  const researchSpeed = fundingResearchSpeedFactor(percent);
  const t = percent / 100;
  const scienceProduction = 0.75 + 0.55 * t; // 0% → 0.75，100% → 1.30
  const otherProduction = RESEARCH_FUNDING_OTHER_BONUS
    + (RESEARCH_FUNDING_OTHER_PENALTY - RESEARCH_FUNDING_OTHER_BONUS) * t; // 0% → 1.10，100% → 0.90
  return { percent, researchSpeed, scienceProduction, otherProduction };
}

/** 研究速度构成（供 UI 解释当前倍率）。 */
export interface ResearchSpeedBreakdown {
  total: number;
  schoolFactor: number;
  developmentFactor: number;
  fundingFactor: number;
}

export function researchSpeedBreakdown(techState: TechState, techId: string): ResearchSpeedBreakdown {
  const def = getTechDef(techId);
  if (!def) return { total: 1, schoolFactor: 1, developmentFactor: 1, fundingFactor: 1 };
  const focus = techState.schoolFocus ?? null;
  const school = schoolOfDef(def);
  const schoolFactor = !focus ? 1 : school === focus ? 1 + FOCUS_SPEED_BONUS : 1 - CROSS_SCHOOL_PENALTY;
  const developmentFactor = developmentSpeedFactor(techState, techId);
  const fundingFactor = fundingResearchSpeedFactor(researchFundingPercent(techState));
  return { total: schoolFactor * developmentFactor * fundingFactor, schoolFactor, developmentFactor, fundingFactor };
}

export interface ResearchBoostQuote {
  ok: boolean;
  reason: string | null;
  techId: string | null;
  techName: string;
  /** 本次注入立即增加的科研点。 */
  gain: number;
  /** 注入后完成度占剩余进度的比例 0..1。 */
  progressRatio: number;
  /** 资源消耗（矿物 / 金属 / 能源，未解锁的资源不会出现）。 */
  cost: Partial<Record<ResourceId, number>>;
  /** 当前项目已加速次数。 */
  uses: number;
  /** 本回合是否已使用过加速。 */
  usedThisTurn: boolean;
}

/**
 * 注入资源加速报价：消耗矿物/金属/能源中的一种或组合，立即给当前项目增加进度。
 * 价格随「同一项目使用次数」递增；每回合只能使用一次（由 lastBoostTurn 判定）。
 */
export function researchBoostQuote(techState: TechState, era: number, turn: number): ResearchBoostQuote {
  const def = activeTechDef(techState);
  const empty: ResearchBoostQuote = {
    ok: false, reason: null, techId: null, techName: "", gain: 0, progressRatio: 0, cost: {}, uses: 0, usedThisTurn: false,
  };
  if (!def) return { ...empty, reason: "没有正在研究的项目" };
  const uses = Math.max(0, Math.floor(techState.researchBoostCounts?.[def.id] ?? 0));
  const usedThisTurn = typeof techState.lastBoostTurn === "number" && techState.lastBoostTurn === turn;
  const remaining = Math.max(0, def.cost - techState.progress);
  if (remaining <= 1e-9) return { ...empty, techId: def.id, techName: def.name, uses, usedThisTurn, reason: "当前项目已经完成" };
  const gain = Math.min(remaining, Math.max(1, Math.ceil(remaining * RESEARCH_BOOST_PROGRESS_RATIO * 100) / 100));
  const base = Math.max(20, Math.ceil(gain * 2));
  const costMultiplier = 1 + RESEARCH_BOOST_COST_GROWTH * uses;
  const cost: Partial<Record<ResourceId, number>> = {};
  const unlocked = clampTechEra(era);
  const shares: { id: ResourceId; share: number }[] = [{ id: "minerals", share: 0.5 }];
  if (unlocked >= 2) shares.push({ id: "metals", share: 0.25 });
  if (unlocked >= 3) shares.push({ id: "energy", share: 0.25 });
  const shareTotal = shares.reduce((sum, item) => sum + item.share, 0);
  for (const item of shares) {
    cost[item.id] = Math.max(1, Math.ceil(base * (item.share / shareTotal) * costMultiplier));
  }
  if (usedThisTurn) {
    return { ok: false, reason: "本回合已经注入过一次资源，每回合限一次", techId: def.id, techName: def.name, gain, progressRatio: gain / remaining, cost, uses, usedThisTurn };
  }
  return { ok: true, reason: null, techId: def.id, techName: def.name, gain, progressRatio: gain / remaining, cost, uses, usedThisTurn };
}

export interface ResearchBoostResult extends ResearchAdvance {
  gain: number;
}

/**
 * 提交一次注入资源加速（资源已由调用方扣除）。
 * 直接把 gain 点进度写入当前项目；达到成本时按正常研究完成流程结算。
 */
export function applyResearchBoost(techState: TechState, gain: number, turn: number): ResearchBoostResult {
  const def = activeTechDef(techState);
  const amount = Number.isFinite(gain) ? Math.max(0, gain) : 0;
  if (!def || amount <= 0) return { completedId: null, spent: 0, gain: 0 };
  const delta = Math.min(Math.max(0, def.cost - techState.progress), amount);
  techState.progress = clamp(techState.progress + delta, 0, def.cost);
  if (!techState.researchBoostCounts) techState.researchBoostCounts = {};
  techState.researchBoostCounts[def.id] = Math.max(0, Math.floor(techState.researchBoostCounts[def.id] ?? 0)) + 1;
  techState.lastBoostTurn = turn;
  const done = completeActiveResearch(techState);
  return {
    completedId: done.completedId,
    spent: 0,
    doctrineChosen: done.doctrineChosen,
    schoolPointsGained: done.schoolPointsGained,
    gain: delta,
  };
}

/**
 * 归一化旧存档的科技状态：补齐 v1.6 字段并夹取非法值。
 * 返回同一个 state 以支持链式调用。
 */
export function normalizeTechState(techState: TechState): TechState {
  if (!Array.isArray(techState.researched)) techState.researched = [];
  if (!techState.activeTech) techState.activeTech = null;
  if (!Number.isFinite(techState.progress)) techState.progress = 0;
  if (!Number.isFinite(techState.totalScience)) techState.totalScience = 0;
  if (!techState.doctrineChoices || typeof techState.doctrineChoices !== "object") techState.doctrineChoices = {};
  if (!techState.schoolPoints || typeof techState.schoolPoints !== "object") techState.schoolPoints = {};
  const rawCats = techState.developmentCategories;
  if (Array.isArray(rawCats)) {
    const filtered = rawCats.filter((id): id is ResearchCategory => TECH_CATEGORY_ORDER.includes(id));
    techState.developmentCategories = filtered.length > 0 ? filtered.slice(0, DEVELOPMENT_MAX_CATEGORIES) : null;
  } else {
    techState.developmentCategories = null;
  }
  if (!Number.isFinite(techState.researchFunding)) techState.researchFunding = RESEARCH_FUNDING_NEUTRAL;
  techState.researchFunding = Math.max(0, Math.min(100, techState.researchFunding as number));
  if (!techState.researchBoostCounts || typeof techState.researchBoostCounts !== "object") techState.researchBoostCounts = {};
  if (!Number.isFinite(techState.lastBoostTurn)) techState.lastBoostTurn = -1;
  return techState;
}

/** 是否旧版（v1.5 及更早）存档：缺失 v1.6 科研政策字段。 */
export function isLegacyTechState(techState: TechState): boolean {
  return techState.researchFunding == null;
}

/** 三大研究大类元数据（供 UI 渲染顺序稳定）。 */
export const RESEARCH_CATEGORY_LIST: readonly ResearchCategoryMeta[] = TECH_CATEGORY_ORDER.map((id) => TECH_CATEGORIES[id]);

/** 某研究大类下的科技数量。 */
export function categoryTechCount(category: ResearchCategory): number {
  return techsByCategory(category).length;
}

/** 某科技的分支所属研究大类；未知返回 null。 */
export function researchCategoryFor(techId: string): ResearchCategory | null {
  return researchCategoryOf(techId);
}

/** 分支 → 研究大类。 */
export function categoryOfBranch(branch: TechBranch): ResearchCategory {
  return TECH_CATEGORY_OF_BRANCH[branch];
}
