/**
 * 建筑系统：建造检查 / 开工 / 工期推进 / 升级 / 效果聚合。
 *
 * 典型调用顺序（game 层每个回合）：
 *   const check = checkBuild(id, civ, buildings, tech, techEffects, mode);
 *   startConstruction(buildings, civ, def, year);
 *   advanceConstruction(buildings, civ, 1, constructionSpeed(civ, mult), BUILDING_DEFS);
 *   const effects = aggregateBuildingEffects(buildings, BUILDING_DEFS, civ.era); // era 可选
 *   const maintenance = totalMaintenance(buildings, BUILDING_DEFS);
 *
 * 阶段 12 时代折减：aggregateBuildingEffects 的第三个可选参数 era 传入文明当前时代，
 * 内部对每座建筑的全部效果乘 outdatedMultiplier(era, def)：
 *   - 当前时代建筑 ×1；旧 1 个时代 ×0.8（下限）；旧 2 个及以上 ×def.outdatedMultiplier（默认 0.6）；
 *   - 折减范围：production / capacity / housing / research / observationBonus / thermalShielding /
 *     industry / stability / disasterResistance / warningBonus / colonyProgress 全部同乘；
 *   - maintenance 与 workers 不折减（旧建筑仍需全额维护与人力），因此"不升级"是双重惩罚。
 * 不传 era 时完全保持旧行为（×1），向后兼容。
 */
import { clamp, clamp01 } from "../core/math";
import { buildingEra, outdatedMultiplier } from "../civilization/eras";
import { RESOURCE_IDS, amountText, resourceName } from "../civilization/resources";
import { canAfford, spendResources } from "../civilization/state";
import { techDisplayName } from "../technology/system";
import type {
  BuildingDef,
  BuildingEffects,
  BuildingState,
  CivilizationState,
  GameMode,
  ResourceId,
  TechEffects,
  TechState,
} from "../core/types";
import {
  BUILDING_DEF_MAP,
  BUILDING_DEFS,
  STARTING_BUILDINGS,
  getBuildingDef,
  isUniqueBuilding,
  type BuildingDefEx,
} from "./definitions";

/** 建筑表来源：定义数组或 id->定义 映射均可。 */
export type BuildingDefSource = readonly BuildingDef[] | Record<string, BuildingDef>;

const BUILTIN_DEFS: BuildingDefSource = BUILDING_DEFS;

function defOf(defs: BuildingDefSource, id: string): BuildingDef | undefined {
  if (Array.isArray(defs)) return (defs as readonly BuildingDef[]).find((d) => d.id === id);
  return (defs as Record<string, BuildingDef>)[id];
}

/** 创建一个空的建筑状态；initial 中的数量会写入 counts。 */
export function createBuildingState(initial?: Record<string, number>): BuildingState {
  const counts: Record<string, number> = {};
  if (initial) {
    for (const id of Object.keys(initial)) {
      const n = Math.max(0, Math.floor(initial[id] ?? 0));
      if (n > 0 && BUILDING_DEF_MAP[id]) counts[id] = n;
    }
  }
  return { counts, queue: [], nextJobId: 1 };
}

/** 开局自带建筑状态：原始聚落（营地 ×1、原始农田 ×2、水井 ×1、采石场 ×1）。 */
export function createInitialBuildingState(): BuildingState {
  // Single source of truth: the starting settlement is defined in definitions.ts.
  return createBuildingState({ ...STARTING_BUILDINGS });
}

export interface BuildCheck {
  ok: boolean;
  reason: string | null;
}

/**
 * 建造前置检查（资源 / 科技 / 时代 / 数量上限）。
 * sandbox 模式下忽略科技与时代门槛（资源与数量上限仍然生效）。
 */
export function checkBuild(
  buildingId: string,
  civ: CivilizationState,
  buildingState: BuildingState,
  techState: TechState,
  techEffects: TechEffects,
  mode: GameMode,
): BuildCheck {
  const def = getBuildingDef(buildingId);
  if (!def) return { ok: false, reason: "未知建筑" };

  const built = getBuildingCount(buildingState, buildingId);
  const queued = buildingState.queue.filter((j) => j.buildingId === buildingId).length;
  const maxCount = def.maxCount ?? (def.unique ? 1 : null);
  if (maxCount !== null && built + queued >= maxCount) {
    return {
      ok: false,
      reason: def.unique || maxCount === 1 ? "该建筑为文明唯一建筑，已建造或正在建造" : `已达到数量上限（${maxCount} 座）`,
    };
  }

  if (mode !== "sandbox") {
    const requiredEra = buildingEra(def);
    if (civ.era < requiredEra) {
      return { ok: false, reason: `需要进入第 ${requiredEra} 时代` };
    }
    const missingTech = def.requiresTech.filter((t) => !techState.researched.includes(t));
    if (missingTech.length > 0) {
      return { ok: false, reason: `需要科技：${missingTech.map(techDisplayName).join("、")}` };
    }
    // 大型工程额外的“能力门槛”：科技效果未解锁时不允许建造。
    if (buildingId === "colonyBase" && !techEffects.allowColony) {
      return { ok: false, reason: "尚未掌握星际殖民技术" };
    }
    if (buildingId === "planetEngine" && !techEffects.allowPlanetEngine) {
      return { ok: false, reason: "尚未掌握行星发动机技术" };
    }
  }

  const afford = canAfford(civ, def.cost);
  if (!afford.ok) {
    const detail = afford.missing
      .map((id) => `${resourceName(id)} ${amountText(def.cost[id] ?? 0)}`)
      .join("、");
    return { ok: false, reason: `资源不足：缺少 ${detail}` };
  }
  return { ok: true, reason: null };
}

export interface StartConstructionResult {
  ok: boolean;
  reason: string | null;
  jobId: number | null;
}

/**
 * 扣除资源并把建筑加入施工队列。
 * 注意：科技 / 时代 / 唯一性等硬门槛由 checkBuild 负责；这里只兜底资源与数量上限。
 */
export function startConstruction(
  buildingState: BuildingState,
  civ: CivilizationState,
  def: BuildingDef,
  year: number,
): StartConstructionResult {
  const built = getBuildingCount(buildingState, def.id);
  const queued = buildingState.queue.filter((j) => j.buildingId === def.id).length;
  const maxCount = def.maxCount ?? ((def as BuildingDefEx).unique ? 1 : null);
  if (maxCount !== null && built + queued >= maxCount) {
    return { ok: false, reason: "已达到该建筑的数量上限", jobId: null };
  }

  const afford = canAfford(civ, def.cost);
  if (!afford.ok) {
    const detail = afford.missing
      .map((id) => `${resourceName(id)} ${amountText(def.cost[id] ?? 0)}`)
      .join("、");
    return { ok: false, reason: `资源不足：缺少 ${detail}`, jobId: null };
  }
  if (!spendResources(civ, def.cost)) {
    return { ok: false, reason: "资源扣除失败", jobId: null };
  }

  const jobId = buildingState.nextJobId;
  buildingState.nextJobId += 1;
  buildingState.queue.push({
    id: jobId,
    buildingId: def.id,
    turnsLeft: Math.max(1, def.buildTurns),
    totalTurns: Math.max(1, def.buildTurns),
    startedYear: year,
    invested: 0,
  });
  return { ok: true, reason: null, jobId };
}

export interface UpgradeStartResult {
  ok: boolean;
  reason: string | null;
  jobId: number | null;
}

/**
 * 把已建成的一座旧时代建筑升级为下一时代层级（阶段 12）。
 * 只负责资源校验/扣费/入队；时代门槛由调用方（game 层）用 eras 系统检查。
 */
export function startUpgrade(
  buildingState: BuildingState,
  civ: CivilizationState,
  sourceDef: BuildingDef,
  targetDef: BuildingDef,
  year: number,
): UpgradeStartResult {
  if (sourceDef.upgradeTo !== targetDef.id) {
    return { ok: false, reason: sourceDef.name + " 无法升级为 " + targetDef.name, jobId: null };
  }
  const requiredEra = buildingEra(targetDef);
  if (civ.era < requiredEra) {
    return { ok: false, reason: `升级到 ${targetDef.name} 需要进入第 ${requiredEra} 时代`, jobId: null };
  }
  const owned = getBuildingCount(buildingState, sourceDef.id);
  if (owned <= 0) return { ok: false, reason: "尚未建造 " + sourceDef.name, jobId: null };
  const queued = buildingState.queue.filter((j) => j.upgradeFrom === sourceDef.id).length;
  if (queued >= owned) return { ok: false, reason: "所有 " + sourceDef.name + " 都在升级中", jobId: null };
  const cost = targetDef.upgradeCost ?? {};
  if (!canAfford(civ, cost).ok) return { ok: false, reason: "升级资源不足", jobId: null };
  spendResources(civ, cost);
  const jobId = buildingState.nextJobId++;
  buildingState.queue.push({
    id: jobId,
    buildingId: targetDef.id,
    turnsLeft: Math.max(1, targetDef.upgradeTurns ?? targetDef.buildTurns),
    totalTurns: Math.max(1, targetDef.upgradeTurns ?? targetDef.buildTurns),
    startedYear: year,
    invested: 0,
    upgradeFrom: sourceDef.id,
    upgradePaid: { ...cost },
  });
  civ.industryUsed += 1;
  return { ok: true, reason: null, jobId };
}

export interface ConstructionAdvance {
  /** 本回合刚刚完工的建筑 id 列表（可能重复，表示同时完工多座）。 */
  completedIds: string[];
}

/**
 * 推进施工队列。industryMultiplier 为工业加速倍率（见 constructionSpeed），
 * 例如 1.5 表示本回合等效 1.5 个回合的工程量。所有工事并行推进。
 */
export function advanceConstruction(
  buildingState: BuildingState,
  civ: CivilizationState,
  turns: number,
  industryMultiplier: number,
  defs: BuildingDefSource = BUILTIN_DEFS,
): ConstructionAdvance {
  const completedIds: string[] = [];
  const stepTurns = Math.max(1e-6, (Number.isFinite(turns) ? turns : 1) * Math.max(0.1, industryMultiplier));
  const remaining: typeof buildingState.queue = [];
  for (const job of buildingState.queue) {
    job.turnsLeft -= stepTurns;
    job.invested += stepTurns;
    if (job.turnsLeft <= 1e-9) {
      // 只有定义表里存在的建筑才会真正落成，避免脏存档产生幽灵建筑。
      if (defOf(defs, job.buildingId)) {
        if (job.upgradeFrom && defOf(defs, job.upgradeFrom)) {
          const remaining = Math.max(0, getBuildingCount(buildingState, job.upgradeFrom) - 1);
          buildingState.counts[job.upgradeFrom] = remaining;
          if (remaining === 0) delete buildingState.counts[job.upgradeFrom];
        }
        buildingState.counts[job.buildingId] = getBuildingCount(buildingState, job.buildingId) + 1;
        completedIds.push(job.buildingId);
        civ.industryUsed = Math.max(0, civ.industryUsed - 1);
      }
    } else {
      remaining.push(job);
    }
  }
  buildingState.queue = remaining;
  return { completedIds };
}

/** 工业加速倍率：基础 1.0，产能越高施工越快，并叠加科技工业乘数。 */
export function constructionSpeed(civ: CivilizationState, industryMultiplier = 1): number {
  const fromCapacity = 1 + Math.max(0, civ.industryCapacity - 25) / 300;
  return clamp(fromCapacity * Math.max(0.2, industryMultiplier), 0.5, 4);
}

function emptyEffects(): Required<Omit<BuildingEffects, "capacity" | "production">> & {
  production: Record<ResourceId, number>;
  capacity: Record<ResourceId, number>;
} {
  return {
    production: { food: 0, water: 0, energy: 0, minerals: 0, metals: 0, science: 0 },
    capacity: { food: 0, water: 0, energy: 0, minerals: 0, metals: 0, science: 0 },
    housing: 0,
    research: 0,
    researchSpeed: 0,
    observationBonus: 0,
    thermalShielding: 0,
    industry: 0,
    stability: 0,
    disasterResistance: 0,
    warningBonus: 0,
    colonyProgress: 0,
  };
}

/**
 * 单座建筑在当前时代的产出折减系数（1 = 无折减）。
 * 不传 era 时恒为 1（旧调用向后兼容）。
 */
export function buildingEffectScale(era: number | undefined, def: BuildingDef): number {
  if (era == null || !Number.isFinite(era)) return 1;
  return outdatedMultiplier(Math.max(1, Math.min(6, Math.floor(era))), def);
}

/**
 * 聚合全部已建成建筑的效果（数量线性叠加）。
 * 返回对象所有字段都已是数字，可直接参与运算。
 *
 * era 可选（阶段 12）：传入文明当前时代后，每座建筑的**全部效果**都乘
 * outdatedMultiplier(era, def)（旧 1 时代 ×0.8；旧 2+ 时代 ×outdatedMultiplier，默认 0.6）。
 * 住房 / 仓储 / 稳定度 / 观测 / 隔热 / 灾害抗性等非产出效果同样折减——因为一栋 E1 的
 * 木石棚屋在 E4 城市里既住不了多少人，也提供不了多少仓储与社会稳定。
 * 不传 era 时行为与旧版完全一致。
 */
export function aggregateBuildingEffects(
  state: BuildingState,
  defs: BuildingDefSource = BUILTIN_DEFS,
  era?: number,
): BuildingEffects {
  const total = emptyEffects();
  for (const [id, count] of Object.entries(state.counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const def = defOf(defs, id);
    if (!def) continue;
    const scale = buildingEffectScale(era, def);
    const effective = count * scale;
    const e = def.effects;
    if (e.production) {
      for (const r of RESOURCE_IDS) total.production[r] += (e.production[r] ?? 0) * effective;
    }
    if (e.capacity) {
      for (const r of RESOURCE_IDS) total.capacity[r] += (e.capacity[r] ?? 0) * effective;
    }
    total.housing += (e.housing ?? 0) * effective;
    total.research += (e.research ?? 0) * effective;
    total.researchSpeed += (e.researchSpeed ?? 0) * effective;
    total.observationBonus += (e.observationBonus ?? 0) * effective;
    total.thermalShielding += (e.thermalShielding ?? 0) * effective;
    total.industry += (e.industry ?? 0) * effective;
    total.stability += (e.stability ?? 0) * effective;
    total.disasterResistance += (e.disasterResistance ?? 0) * effective;
    total.warningBonus += (e.warningBonus ?? 0) * effective;
    total.colonyProgress += (e.colonyProgress ?? 0) * effective;
  }

  total.researchSpeed = clamp(total.researchSpeed, 0, 1.5);
  total.observationBonus = clamp(total.observationBonus, 0, 2);
  total.disasterResistance = clamp(total.disasterResistance, 0, 0.9);
  total.housing = Math.max(0, total.housing);
  total.industry = Math.max(0, total.industry);
  total.warningBonus = Math.max(0, total.warningBonus);
  return total;
}

/** 每回合全部建筑的维护消耗（含以矿石为输入的冶炼厂）。 */
export function totalMaintenance(
  state: BuildingState,
  defs: BuildingDefSource = BUILTIN_DEFS,
): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [id, count] of Object.entries(state.counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const def = defOf(defs, id);
    if (!def) continue;
    for (const r of RESOURCE_IDS) {
      const need = def.maintenance[r] ?? 0;
      if (need === 0) continue;
      out[r] = (out[r] ?? 0) + need * count;
    }
  }
  return out;
}

/** 满负荷运转所需的总工人数。 */
export function totalWorkers(state: BuildingState, defs: BuildingDefSource = BUILTIN_DEFS): number {
  let total = 0;
  for (const [id, count] of Object.entries(state.counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const def = defOf(defs, id);
    if (!def) continue;
    total += def.workers * count;
  }
  return total;
}

/** 全部建筑提供的住房总量。 */
export function totalHousing(state: BuildingState, defs: BuildingDefSource = BUILTIN_DEFS): number {
  let total = 0;
  for (const [id, count] of Object.entries(state.counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const def = defOf(defs, id);
    if (!def) continue;
    total += (def.effects.housing ?? 0) * count;
  }
  return total;
}

/** 某建筑当前建成数量。 */
export function getBuildingCount(state: BuildingState, id: string): number {
  return state.counts[id] ?? 0;
}

/** 全部已建成建筑的数量总和（用于成就/统计）。 */
export function totalBuiltCount(state: BuildingState): number {
  return Object.values(state.counts).reduce((s, n) => s + (Number.isFinite(n) && n > 0 ? n : 0), 0);
}

/** 已建成建筑中的最高观测设施等级（无天文台返回 0）。 */
export function getObservatoryBuildingLevel(
  state: BuildingState,
  defs: BuildingDefSource = BUILTIN_DEFS,
): number {
  let level = 0;
  for (const [id, count] of Object.entries(state.counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const def = defOf(defs, id);
    if (!def) continue;
    level = Math.max(level, def.observationLevel ?? 0);
  }
  return level;
}

/** 劳动力充足率 0..1：满员 1；人手不足时所有建筑产出按该比例打折。 */
export function staffingRatio(civ: CivilizationState, workerNeed: number): number {
  if (workerNeed <= 0) return 1;
  return clamp01(civ.workforce / workerNeed);
}

/** 由建筑状态推算的资源容量加成（供 UI 展示库存上限；era 可选，旧时代仓储会折减）。 */
export function capacityBonus(
  state: BuildingState,
  defs: BuildingDefSource = BUILTIN_DEFS,
  era?: number,
): Record<ResourceId, number> {
  const effects = aggregateBuildingEffects(state, defs, era);
  const out = { food: 0, water: 0, energy: 0, minerals: 0, metals: 0, science: 0 } as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) {
    out[r] = (effects.capacity as Partial<Record<ResourceId, number>>)?.[r] ?? 0;
  }
  return out;
}

function signedPercent(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%`;
}

function signedNumber(v: number): string {
  return `${v >= 0 ? "+" : "−"}${amountText(Math.abs(v))}`;
}

/**
 * 建筑效果的中文描述列表（给 UI 的 BuildingView.effects）。
 * 例如 ["每回合 +300 食物", "住房 +800", "稳定度 +1"]。
 */
export function describeEffects(def: BuildingDef): string[] {
  const out: string[] = [];
  const e = def.effects ?? {};
  if (e.production) {
    for (const r of RESOURCE_IDS) {
      const v = e.production[r] ?? 0;
      if (v === 0) continue;
      out.push(`每回合 ${signedNumber(v)} ${resourceName(r)}`);
    }
  }
  if (e.capacity) {
    for (const r of RESOURCE_IDS) {
      const v = e.capacity[r] ?? 0;
      if (v === 0) continue;
      out.push(`仓储上限 ${signedNumber(v)} ${resourceName(r)}`);
    }
  }
  if (e.housing) out.push(`住房 ${signedNumber(e.housing)}`);
  if (e.research) out.push(`科研 ${signedNumber(e.research)}/回合`);
  if (e.researchSpeed) out.push(`全文明研究速度 ${signedPercent(e.researchSpeed)}`);
  if (e.observationBonus) out.push(`观测质量 ${signedPercent(e.observationBonus)}`);
  if (e.thermalShielding) out.push(`温度耐受 ${signedNumber(e.thermalShielding)}°C`);
  if (e.industry) out.push(`工业产能 ${signedNumber(e.industry)}`);
  if (e.stability) out.push(`稳定度 ${signedNumber(e.stability)}`);
  if (e.disasterResistance) out.push(`灾害抗性 ${signedPercent(e.disasterResistance)}`);
  if (e.warningBonus) out.push(`灾害预警提前 ${signedNumber(e.warningBonus)} 回合`);
  if (e.colonyProgress) out.push(`殖民进度 ${signedNumber(e.colonyProgress)}/回合`);
  return out;
}

/** 建造资源是否足够（UI 置灰用，等价 checkBuild 的资源段）。 */
export function canAffordBuilding(civ: CivilizationState, buildingId: string): boolean {
  const def = getBuildingDef(buildingId);
  if (!def) return false;
  return canAfford(civ, def.cost).ok;
}

/** 施工进度 0..1（供 UI 队列）。 */
export function constructionProgress(turnsLeft: number, totalTurns: number): number {
  if (totalTurns <= 0) return 1;
  return clamp01(1 - turnsLeft / totalTurns);
}

export { isUniqueBuilding };
