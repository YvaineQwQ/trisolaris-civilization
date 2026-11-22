/**
 * 回合结算核心（resolveTurn）。
 *
 * 一次 resolveTurn 调用完成：
 *  1. 环境修正（温度 / 宜居度 / 生态 / 天气 → 农业与取水效率，温度 → 能源需求）
 *  2. 资源生产（人口自给 + 建筑产出 × 人力充足率 × 科技乘数 × 危机修正）
 *  3. 资源消耗（人口口粮 / 饮水 / 能源、建筑维护、殖民地上供）
 *  4. 库存上限结算与溢出
 *  5. 稳定度六因子 + 平滑
 *  6. 人口增长 / 死亡（食物、饮水、住房、温度、稳定度）
 *  7. 教育科研产出
 *  8. 时代资源门槛（E1 无金属/电力、E2 无电力）与时代内效率修正
 *  9. 殖民地成长（内部调用 colonyReport）
 * 10. 胜利 / 失败判定与人口历史采样
 *
 * 阶段 12 起 resolveTurn 不再自行推进时代（eraChanged 恒为 null），
 * 时代推进由 game 层基于 civilization/eras.ts 的条件清单驱动。
 *
 * 调用顺序建议：先 advanceConstruction / advanceResearch（消耗上回合库存），
 * 再把本回合完工、科研完成、维护费、工人需求通过 TurnContext 的可选字段传进来。
 */
import { DIFFICULTIES, ERAS, TURN_YEARS } from "../core/constants";
import type {
  BuildingEffects,
  BuildingState,
  CivilizationState,
  ColonyState,
  DifficultyKey,
  EnvironmentState,
  GameMode,
  PhysicsState,
  ResourceId,
  ResourceStock,
  TechEffects,
  TechState,
  WeatherKind,
} from "../core/types";
import { clamp, clamp01 } from "../core/math";
import {
  BASE_RESOURCE_CAPACITY,
  RESOURCE_IDS,
  amountText,
  formatResourceAmount,
  resourceName,
} from "../civilization/resources";
import {
  BASE_HOUSING,
  BASE_INDUSTRY,
  MAX_POPULATION_HISTORY,
  gainResource,
  resourceStock,
  setFlow,
  workforceFor,
} from "../civilization/state";
import {
  COMFORT_TEMP_C,
  STABILITY_FACTOR_LABELS,
  combineStability,
  computeStabilityFactors,
  stabilityDisplay,
  weakestFactor,
} from "../civilization/stability";
import { aggregateTechEffects, getTechMultipliers, techDisplayName } from "../technology/system";
import type { TechMultipliers } from "../technology/system";
import { getBuildingCount } from "../buildings/system";
import { getBuildingDef } from "../buildings/definitions";
import { civilizationSummary } from "../civilization/state";

/* ------------------------------------------------------------------ *
 *  数值常量（平衡口径见 docs/SYSTEMS_API.md）                          *
 * ------------------------------------------------------------------ */

/**
 * 每人每回合（0.5 年）口粮消耗（吨）。
 * 阶段 12 原始开局（人口 500、2 座原始农田）下必须保持第一回合食物为正，
 * 因此从 0.5 下调为 0.45（E1 每回合 225 吨，2 农田 220 + 自给 ~58 可覆盖）。
 */
export const FOOD_PER_CAPITA_TURN = 0.45;
/** 每人每回合饮水消耗（吨）。原始水井产能有限，取 0.28 保证 E1 不以水崩盘。 */
export const WATER_PER_CAPITA_TURN = 0.28;
/** 每人每回合基础能源消耗（MWh，不含温度调节）。 */
export const ENERGY_PER_CAPITA_TURN = 0.1;
/** 人口自给农业（小农 / 采集），抵消部分口粮需求。 */
export const SUBSISTENCE_FOOD_PER_CAPITA = 0.12;
/** 人口自给取水（雨水 / 地下水）。 */
export const SUBSISTENCE_WATER_PER_CAPITA = 0.12;
/** 人口自给能源（人力 / 小型设备）。 */
export const SUBSISTENCE_ENERGY_PER_CAPITA = 0.03;
/** 人均基础教育科研产出（点/回合）。 */
export const SCIENCE_PER_CAPITA_TURN = 0.01;
/** 基础人口年增长率（再乘难度系数），1.8%/年 ≈ 40 年翻倍。 */
export const BASE_GROWTH_PER_YEAR = 0.018;
/** 饥荒压力达到该值文明崩溃。 */
export const STARVATION_COLLAPSE = 100;
/** 稳定度崩溃需要持续的回合数。 */
export const CRISIS_STREAK_COLLAPSE = 4;
/** 能源满足率低于该值时开始明显拖累生产。 */
export const ENERGY_CRITICAL_SATISFACTION = 0.9;
/** 温度舒适区半宽（摄氏度）：超出部分开始产生压力。 */
export const TEMP_TOLERANCE_C = 8;

/* ------------------------------------------------------------------ *
 *  时代经济修正（阶段 12）                                             *
 * ------------------------------------------------------------------ */

export interface EraEconomyModifier {
  /** 建筑产出效率乘数（只作用于建筑产出，人口自给不受影响）。 */
  buildingEfficiency: number;
  /** 建筑科研效率乘数（只作用于建筑 research 产出）。 */
  researchEfficiency: number;
}

/**
 * 时代内效率修正：文明越进步，同样的建筑在组织、分工与维护上效率越高。
 * 仅当 TurnContext.era 被显式传入时生效；旧调用（不传 era）使用中性 1，
 * 完全保持旧测试/旧存档的结算行为。
 */
export const ERA_ECONOMY_MODIFIERS: Record<number, EraEconomyModifier> = {
  1: { buildingEfficiency: 1, researchEfficiency: 1 },
  2: { buildingEfficiency: 1, researchEfficiency: 1.05 },
  3: { buildingEfficiency: 1.05, researchEfficiency: 1.1 },
  4: { buildingEfficiency: 1.1, researchEfficiency: 1.15 },
  5: { buildingEfficiency: 1.15, researchEfficiency: 1.2 },
};

const NEUTRAL_ERA_MODIFIER: EraEconomyModifier = { buildingEfficiency: 1, researchEfficiency: 1 };

/** 取时代经济修正；era 缺省/非法时返回中性值（向后兼容）。 */
export function eraEconomyModifier(era?: number): EraEconomyModifier {
  if (era == null || !Number.isFinite(era)) return NEUTRAL_ERA_MODIFIER;
  const key = Math.max(1, Math.min(5, Math.floor(era)));
  return ERA_ECONOMY_MODIFIERS[key] ?? NEUTRAL_ERA_MODIFIER;
}

/** 天气对农业的影响系数。 */
const WEATHER_FOOD_FACTOR: Record<WeatherKind, number> = {
  clear: 1,
  cloudy: 0.96,
  storm: 0.86,
  ash: 0.68,
  freezing: 0.55,
  scorching: 0.5,
};

/** 天气对取水的影响系数。 */
const WEATHER_WATER_FACTOR: Record<WeatherKind, number> = {
  clear: 1,
  cloudy: 0.98,
  storm: 0.9,
  ash: 0.85,
  freezing: 0.45,
  scorching: 0.55,
};

/** 殖民地成本（startColony 一次性扣除）。 */
export const COLONY_COST: Partial<Record<ResourceId, number>> = {
  minerals: 2500,
  metals: 1500,
  energy: 1000,
};
/** 殖民地人口等级门槛（索引 = 等级-1）。 */
export const COLONY_LEVEL_THRESHOLDS: readonly number[] = [0, 600, 1500, 3000, 6000];

/* ------------------------------------------------------------------ *
 *  TurnContext / TurnReport                                           *
 * ------------------------------------------------------------------ */

export interface TurnCrisis {
  /** 食物产出乘数（饥荒 / 生态灾难，1 = 正常，<1 减产）。 */
  foodMultiplier: number;
  /** 能源需求乘数（寒冬 / 酷暑）。 */
  energyDemandMultiplier: number;
  /** 稳定度直接惩罚（点）。 */
  stabilityPenalty: number;
  /** 本回合持续灾害的瞬时破坏比例（0..1）；离散事件请用 applyCrisisEffects 并把此处置 0。 */
  disasterDamage: number;
}

export interface TurnContext {
  years: number;
  turn: number;
  env: EnvironmentState;
  physics: PhysicsState;
  buildingEffects: BuildingEffects;
  techEffects: TechEffects;
  techMultipliers: TechMultipliers;
  crisis: TurnCrisis;
  mode: GameMode;
  difficulty: DifficultyKey;
  year: number;
  /* --- 可选扩展：不传时使用安全默认值（推荐传入以保证数值完整） --- */
  /** 本回合建筑维护消耗（buildings.totalMaintenance）。缺省视为 0。 */
  maintenance?: Partial<Record<ResourceId, number>>;
  /** 当前天文台等级 0..6（observation.level）。默认 1。 */
  observatoryLevel?: number;
  /** 已研究科技数量。默认 0。 */
  researchedCount?: number;
  /** 本回合完工的建筑 id 列表（advanceConstruction 的 completedIds）。 */
  buildingsCompleted?: string[];
  /** 本回合完成的科技 id（advanceResearch 的 completedId）。 */
  researchCompleted?: string | null;
  /** 本回合建筑需要的总工人数（buildings.totalWorkers）；缺省沿用 civ.jobs。 */
  workerJobs?: number;
  /** 本回合投入研究并已扣除的科研点（用于流量显示）。 */
  researchSpent?: number;
  /** 正在施工的工程数量（用于 industryUsed 估算，每个工程占用 10 点产能）。 */
  constructionCount?: number;
  /** 行星发动机是否已建成（胜利判定用）；建议由 game 层用 planetEngineReady 计算。 */
  hasPlanetEngine?: boolean;
  /**
   * 当前文明时代 1..5（阶段 12）。显式传入时启用：
   *  - 资源门槛：era<2 金属锁定、era<3 能源（电力）锁定；
   *  - 时代内效率修正（ERA_ECONOMY_MODIFIERS）与无电力时代的 powerEfficiency=1。
   * 缺省时不启用任何时代修正（向后兼容旧调用/旧测试）。
   */
  era?: number;
}

export type TurnLogCategory = "civilization" | "build" | "tech" | "milestone" | "hazard";
export type TurnLogSeverity = "info" | "warning" | "critical" | "success";

export interface TurnLog {
  category: TurnLogCategory;
  severity: TurnLogSeverity;
  message: string;
}

export interface TurnReport {
  logs: TurnLog[];
  buildingsCompleted: string[];
  researchCompleted: string | null;
  eraChanged: number | null;
  era: number;
  collapsed: boolean;
  collapseReason: string | null;
  victory: boolean;
  victoryReason: string | null;
  populationDelta: number;
}

/** 空报告（便于 game 层在异常情况下返回）。 */
export function createEmptyTurnReport(civ: CivilizationState): TurnReport {
  return {
    logs: [],
    buildingsCompleted: [],
    researchCompleted: null,
    eraChanged: null,
    era: civ.era,
    collapsed: false,
    collapseReason: null,
    victory: false,
    victoryReason: null,
    populationDelta: 0,
  };
}

/* ------------------------------------------------------------------ *
 *  环境修正                                                            *
 * ------------------------------------------------------------------ */

/** 考虑建筑隔热后的“体感温度”。隔热把极端温度往舒适区拉。 */
export function effectiveTemperature(tempC: number, thermalShielding: number): number {
  const shield = Math.max(0, thermalShielding);
  if (tempC >= COMFORT_TEMP_C) return tempC - shield;
  return tempC + shield;
}

/** 超出舒适区的温差（用于稳定度与能源需求）。 */
export function temperatureStress(effectiveTempC: number): number {
  return Math.max(0, Math.abs(effectiveTempC - COMFORT_TEMP_C) - TEMP_TOLERANCE_C);
}

/** 温度对农业的影响：16°C 附近最优，极端温度急剧减产。 */
export function agricultureTemperatureFactor(effectiveTempC: number): number {
  const delta = Math.abs(effectiveTempC - COMFORT_TEMP_C);
  return clamp(1.02 - Math.max(0, delta - 6) / 55, 0.08, 1.02);
}

/** 温度对取水的影响（严寒结冰、酷热蒸发）。 */
export function waterTemperatureFactor(effectiveTempC: number): number {
  const cold = Math.max(0, -10 - effectiveTempC) / 50 * 0.7;
  const hot = Math.max(0, effectiveTempC - 55) / 100 * 0.6;
  return clamp(1 - cold - hot, 0.15, 1);
}

/** 综合农业环境效率（0..~1.1）。 */
export function agricultureEfficiency(env: EnvironmentState, effectiveTempC: number): number {
  const temp = agricultureTemperatureFactor(effectiveTempC);
  const habitability = clamp01(env.habitability);
  const ecology = clamp01(env.ecology ?? habitability);
  const water = clamp01(env.water / 0.5);
  const weather = WEATHER_FOOD_FACTOR[env.weather] ?? 1;
  const landQuality = 0.35 + 0.45 * habitability + 0.2 * ecology;
  return temp * landQuality * (0.55 + 0.45 * water) * weather;
}

/** 综合取水环境效率（0..1）。 */
export function waterEfficiency(env: EnvironmentState, effectiveTempC: number): number {
  const temp = waterTemperatureFactor(effectiveTempC);
  const water = clamp01(env.water / 0.6);
  const weather = WEATHER_WATER_FACTOR[env.weather] ?? 1;
  return temp * (0.35 + 0.65 * water) * weather;
}

/* ------------------------------------------------------------------ *
 *  安全取数                                                            *
 * ------------------------------------------------------------------ */

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMultipliers(m: TechMultipliers | undefined): TechMultipliers {
  const prod = (m?.production ?? {}) as Partial<Record<ResourceId, number>>;
  const production = {} as Record<ResourceId, number>;
  for (const r of RESOURCE_IDS) production[r] = num(prod[r], 1);
  return {
    production,
    research: num(m?.research, 1),
    agriculture: num(m?.agriculture, 1),
    energy: num(m?.energy, 1),
    industry: num(m?.industry, 1),
    observation: num(m?.observation, 1),
    prediction: num(m?.prediction, 1),
    habitability: num(m?.habitability, 1),
    disaster: num(m?.disaster, 1),
    populationCapacity: num(m?.populationCapacity, 1),
  };
}

function normalizeTechEffects(e: TechEffects | undefined): TechEffects {
  return {
    productionMultiplier: {},
    researchMultiplier: num(e?.researchMultiplier, 1),
    observationMultiplier: num(e?.observationMultiplier, 1),
    agricultureMultiplier: num(e?.agricultureMultiplier, 1),
    energyMultiplier: num(e?.energyMultiplier, 1),
    industryMultiplier: num(e?.industryMultiplier, 1),
    habitabilityBonus: num(e?.habitabilityBonus, 0),
    disasterResistance: num(e?.disasterResistance, 0),
    predictionMultiplier: num(e?.predictionMultiplier, 1),
    populationCapacityBonus: num(e?.populationCapacityBonus, 0),
    allowColony: e?.allowColony === true,
    allowPlanetEngine: e?.allowPlanetEngine === true,
    observationLevelUnlock: num(e?.observationLevelUnlock, 0),
  };
}

/* ------------------------------------------------------------------ *
 *  时代                                                                *
 * ------------------------------------------------------------------ */

interface EraEntry {
  era: number;
  name: string;
  description: string;
  threshold: number;
}

const ERA_LIST: EraEntry[] = ERAS.map((e) => ({
  era: e.era,
  name: e.name,
  description: e.description,
  threshold: (e as { threshold?: number }).threshold ?? e.era,
}));

/** 时代评分：天文台等级 与 科技总量 双轨取高。每 4 项科技 ≈ +1。 */
export function eraScore(observatoryLevel: number, researchedCount: number): number {
  return Math.max(Math.max(0, observatoryLevel), 1 + Math.floor(Math.max(0, researchedCount) / 4));
}

export interface EraInfo {
  era: number;
  name: string;
  description: string;
  /** 0..1 距离下一个时代阈值的进度。 */
  progress: number;
  /** 下一个时代阈值；已是最后时代时返回当前阈值。 */
  nextThreshold: number;
}

/**
 * 计算当前时代与进度（ERAS 的 threshold 逻辑）。
 * @deprecated 阶段 12 起请使用 civilization/eras.ts 的 eraStatus/canAdvanceEra
 * （人口/科技时代分布/观测等级的显式条件清单）。此函数仅为旧 UI/旧测试保留。
 */
export function eraInfo(
  civ: CivilizationState,
  observatoryLevel: number,
  researchedCount: number,
): EraInfo {
  const score = eraScore(observatoryLevel, researchedCount);
  let index = 0;
  for (let i = 0; i < ERA_LIST.length; i++) {
    if (score >= ERA_LIST[i].threshold) index = i;
  }
  const current = ERA_LIST[index];
  const next = ERA_LIST[index + 1];
  const progress = next
    ? clamp01((score - current.threshold) / Math.max(1e-6, next.threshold - current.threshold))
    : 1;
  // 兼容存档中可能越界的 era：取更靠后的定义。
  const era = Math.max(current.era, civ.era);
  return {
    era,
    name: current.name,
    description: current.description,
    progress: era > current.era ? 1 : progress,
    nextThreshold: next ? next.threshold : current.threshold,
  };
}

/* ------------------------------------------------------------------ *
 *  殖民地                                                              *
 * ------------------------------------------------------------------ */

export interface ColonyStartResult {
  ok: boolean;
  reason: string | null;
  colony: ColonyState | null;
}

/**
 * 建立星际殖民地（需 space_colony 科技、第 4 时代、且资源足够）。
 * 成功后 civ.colony 被写入、金币式资源被扣除。
 */
export function startColony(
  civ: CivilizationState,
  techState: TechState,
  resources: Record<ResourceId, ResourceStock>,
  year: number,
): ColonyStartResult {
  if (civ.colony) return { ok: false, reason: "文明已经拥有殖民地", colony: civ.colony };
  const tech = aggregateTechEffects(techState);
  if (!tech.allowColony) return { ok: false, reason: "需要先研究「星际殖民技术」", colony: null };
  if (civ.era < 4) return { ok: false, reason: "需要进入第 4 时代", colony: null };

  for (const r of RESOURCE_IDS) {
    const need = COLONY_COST[r] ?? 0;
    if (need <= 0) continue;
    const stock = resources[r];
    if (!stock || stock.amount < need) {
      return { ok: false, reason: `资源不足：需要 ${resourceName(r)} ${amountText(need)}`, colony: null };
    }
  }
  for (const r of RESOURCE_IDS) {
    const need = COLONY_COST[r] ?? 0;
    if (need <= 0) continue;
    const stock = resources[r];
    stock.amount = clamp(stock.amount - need, 0, stock.capacity);
  }

  const colony: ColonyState = {
    name: "火种站",
    foundedYear: year,
    population: 200,
    selfSufficiency: 0.35,
    integrity: 0.85,
    level: 1,
    lastReportYear: year,
  };
  civ.colony = colony;
  civ.unlockFlags.colony = true;
  return { ok: true, reason: null, colony };
}

/** startColony 的别名（game 层按语义可任选其一）。 */
export function foundColony(
  civ: CivilizationState,
  techState: TechState,
  resources: Record<ResourceId, ResourceStock>,
  year: number,
): ColonyStartResult {
  return startColony(civ, techState, resources, year);
}

export interface ColonyReport {
  logs: TurnLog[];
  populationDelta: number;
}

/** 推进殖民地成长；返回日志与人口变化（直接修改 civ.colony）。 */
export function colonyReport(civ: CivilizationState, env: EnvironmentState, years: number): ColonyReport {
  const logs: TurnLog[] = [];
  const colony = civ.colony;
  if (!colony) return { logs, populationDelta: 0 };
  const span = Number.isFinite(years) && years > 0 ? years : TURN_YEARS;

  const before = colony.population;
  const homeSupport = 0.6 + 0.4 * clamp01(env.habitability);
  const growthRate = (0.02 + colony.selfSufficiency * 0.02 + colony.level * 0.004) * homeSupport;
  colony.population = Math.max(0, colony.population * (1 + growthRate * span));
  colony.selfSufficiency = clamp(colony.selfSufficiency + 0.012 * span * (0.6 + 0.1 * colony.level), 0, 0.95);
  colony.integrity = clamp(colony.integrity - 0.0015 * span + colony.selfSufficiency * 0.001 * span, 0.3, 1);

  let level = 1;
  for (let i = 0; i < COLONY_LEVEL_THRESHOLDS.length; i++) {
    if (colony.population >= COLONY_LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  level = clamp(level, 1, 5);
  if (level > colony.level) {
    colony.level = level;
    logs.push({
      category: "civilization",
      severity: "success",
      message: `星际殖民地「${colony.name}」扩张至 ${level} 级（人口 ${Math.round(colony.population)}）。`,
    });
  }
  colony.lastReportYear += span;
  return { logs, populationDelta: colony.population - before };
}

/* ------------------------------------------------------------------ *
 *  危机 / 失败判定                                                     *
 * ------------------------------------------------------------------ */

/**
 * 应用一次离散危机（灾害）的即时破坏：按比例削减人口与资源，并降低稳定度。
 * 注意：持续型灾害若已通过 TurnContext.crisis 传入，请勿在同一回合重复调用，
 * 或把 ctx.crisis.disasterDamage 置 0。
 */
export function applyCrisisEffects(
  civ: CivilizationState,
  crisis: Pick<TurnCrisis, "stabilityPenalty" | "disasterDamage">,
): void {
  const damage = clamp01(num(crisis.disasterDamage, 0));
  if (damage > 0) {
    civ.population = Math.max(0, civ.population * (1 - damage));
    civ.starvation = clamp(civ.starvation + damage * 50, 0, 120);
    for (const r of RESOURCE_IDS) {
      const stock = civ.resources[r];
      if (!stock) continue;
      stock.amount = clamp(stock.amount * (1 - damage * 0.5), 0, stock.capacity);
    }
    civ.crisisStreak += 1;
  }
  const penalty = num(crisis.stabilityPenalty, 0);
  if (penalty > 0) civ.stability = clamp(civ.stability - penalty, 0, 100);
}

export interface DefeatCheck {
  defeated: boolean;
  reason: string | null;
}

/** 失败判定（不修改文明状态）。 */
export function checkDefeat(civ: CivilizationState, env: EnvironmentState): DefeatCheck {
  if (!civ.alive) {
    return { defeated: true, reason: civ.causeOfCollapse ?? civ.defeatReason ?? "文明已经消亡" };
  }
  if (civ.population < 1) return { defeated: true, reason: "人口归零，文明失去了延续的可能" };
  if (civ.starvation >= STARVATION_COLLAPSE) {
    return { defeated: true, reason: "长期饥荒耗尽了文明的体力，最后一批居民倒在了粮仓前" };
  }
  if (civ.stability <= 0 && civ.crisisStreak >= CRISIS_STREAK_COLLAPSE) {
    return { defeated: true, reason: "社会秩序彻底崩溃，城市陷入无政府状态" };
  }
  if (env.habitability <= 0.02 && (!civ.colony || civ.colony.level < 3)) {
    return { defeated: true, reason: "母星环境已经无法支撑生命，且没有可存续的殖民地" };
  }
  return { defeated: false, reason: null };
}

/** 行星发动机是否已具备启动条件（科技解锁 + 第 5 时代 + 已建成）。 */
export function planetEngineReady(
  civ: CivilizationState,
  buildings: BuildingState,
  techState: TechState,
): boolean {
  const tech = aggregateTechEffects(techState);
  if (!tech.allowPlanetEngine) return false;
  if (civ.era < 5) return false;
  return getBuildingCount(buildings, "planetEngine") >= 1;
}

/* ------------------------------------------------------------------ *
 *  主结算                                                              *
 * ------------------------------------------------------------------ */

/** 回合结算主入口。原地修改 civ，返回本回合报告。 */
export function resolveTurn(civ: CivilizationState, ctx: TurnContext): TurnReport {
  const report = createEmptyTurnReport(civ);
  const log = (category: TurnLogCategory, severity: TurnLogSeverity, message: string): void => {
    report.logs.push({ category, severity, message });
  };

  const years = Number.isFinite(ctx.years) && ctx.years > 0 ? ctx.years : TURN_YEARS;
  const scale = years / TURN_YEARS;
  // Era gating: energy (electricity) from era 3, metals from era 2.
  // Explicit ctx.era is authoritative; legacy calls without it keep the old
  // all-resources-unlocked behaviour (era 5) so unit fixtures stay valid.
  const eraExplicit = ctx.era != null && Number.isFinite(ctx.era);
  const era = eraExplicit ? Math.max(1, Math.min(5, Math.floor(ctx.era as number))) : 5;
  const energyLocked = era < 3;
  const metalsLocked = era < 2;
  // 时代效率修正只在显式传入 ctx.era 时生效（旧调用保持中性 1）。
  const eraMod = eraEconomyModifier(eraExplicit ? era : undefined);
  const env = ctx.env;
  const difficultyKey = (ctx.difficulty ?? "normal") as DifficultyKey;
  const difficulty = DIFFICULTIES[difficultyKey] ?? DIFFICULTIES.normal;
  const mode = ctx.mode ?? "normal";
  const bfx = ctx.buildingEffects ?? {};
  const techMult = normalizeMultipliers(ctx.techMultipliers);
  const techFx = normalizeTechEffects(ctx.techEffects);
  const crisis: TurnCrisis = {
    foodMultiplier: num(ctx.crisis?.foodMultiplier, 1),
    energyDemandMultiplier: num(ctx.crisis?.energyDemandMultiplier, 1),
    stabilityPenalty: num(ctx.crisis?.stabilityPenalty, 0),
    disasterDamage: clamp01(num(ctx.crisis?.disasterDamage, 0)),
  };
  const maintenance = ctx.maintenance ?? {};

  if (!civ.alive) {
    report.collapsed = true;
    report.collapseReason = civ.causeOfCollapse ?? civ.defeatReason ?? "文明已经消亡";
    report.era = civ.era;
    return report;
  }

  // 记录回合与历史采样点。
  civ.turn = Math.max(civ.turn + 1, ctx.turn || civ.turn + 1);
  report.buildingsCompleted = [...(ctx.buildingsCompleted ?? [])];
  report.researchCompleted = ctx.researchCompleted ?? null;

  /* ---------- 0. 基础人口 / 温度 / 人力 ---------- */
  const population = Math.max(0, civ.population);
  const workforce = workforceFor(population);
  const workerJobs = Math.max(0, ctx.workerJobs ?? civ.jobs ?? 0);
  const staffing = workerJobs > 0 ? clamp01(workforce / workerJobs) : 1;

  const thermalShielding = Math.max(0, num(bfx.thermalShielding, 0));
  const tempC = num(env.surfaceTempC, COMFORT_TEMP_C);
  const effTempC = effectiveTemperature(tempC, thermalShielding);
  const tempStressC = temperatureStress(effTempC);
  const energyDemandFactor = 1 + tempStressC * 0.02;

  /* ---------- 1. 能源供需（先行，影响全局生产） ---------- */
  const production = (r: ResourceId): number => num(bfx.production?.[r], 0);
  const energyGross = energyLocked
    ? 0
    : (population * SUBSISTENCE_ENERGY_PER_CAPITA +
        production("energy") * staffing * eraMod.buildingEfficiency) *
      techMult.production.energy *
      scale;
  const energyDemand = energyLocked
    ? 0
    : (population * ENERGY_PER_CAPITA_TURN * energyDemandFactor +
      num(maintenance.energy, 0)) *
    crisis.energyDemandMultiplier *
    scale;
  const energyStockBefore = resourceStock(civ, "energy").amount;
  const energySatisfaction =
    energyDemand <= 0 ? 1 : clamp01((energyStockBefore + energyGross) / Math.max(1e-6, energyDemand));
  // 无电力时代（E1/E2）不使用电力：不存在能源满足率，动力效率恒为 1（人力/畜力/水力）。
  const powerEfficiency = energyLocked || energyDemand <= 0 ? 1 : 0.55 + 0.45 * energySatisfaction;

  /* ---------- 2. 生产 ---------- */
  const agriEnv = agricultureEfficiency(env, effTempC);
  const waterEnv = waterEfficiency(env, effTempC);
  const habitability = clamp01(env.habitability) * techMult.habitability;
  const stabilityRatio = clamp01(civ.stability / 100);
  const stormFactor = env.weather === "storm" || env.weather === "ash" ? 0.9 : 1;

  const foodSubsistence = population * SUBSISTENCE_FOOD_PER_CAPITA;
  const foodFromBuildings = production("food") * staffing * powerEfficiency * eraMod.buildingEfficiency;
  const foodProduced =
    (foodSubsistence * (0.6 + 0.4 * agriEnv) + foodFromBuildings) *
    techMult.production.food *
    agriEnv *
    Math.max(0, crisis.foodMultiplier) *
    scale;

  const waterSubsistence = population * SUBSISTENCE_WATER_PER_CAPITA;
  const waterFromBuildings = production("water") * staffing * powerEfficiency * eraMod.buildingEfficiency;
  const waterProduced =
    (waterSubsistence * (0.6 + 0.4 * waterEnv) + waterFromBuildings) * techMult.production.water * waterEnv * scale;

  const energyProduced = energyGross;

  const mineralsProduced =
    production("minerals") * staffing * powerEfficiency * eraMod.buildingEfficiency *
    techMult.production.minerals * stormFactor * scale;
  const metalsProduced = metalsLocked
    ? 0
    : production("metals") * staffing * powerEfficiency * eraMod.buildingEfficiency *
      techMult.production.metals * stormFactor * scale;

  const scienceBase =
    population * SCIENCE_PER_CAPITA_TURN + num(bfx.research, 0) * staffing * eraMod.researchEfficiency;
  const scienceProduced =
    scienceBase *
    techMult.research *
    (0.5 + 0.5 * stabilityRatio) *
    (1 - 0.3 * clamp01(civ.unemploymentRate)) *
    scale;

  /* ---------- 3. 消耗 ---------- */
  const foodConsumed = population * FOOD_PER_CAPITA_TURN * scale;
  const waterConsumed = population * WATER_PER_CAPITA_TURN * scale;
  const energyConsumed = energyDemand;
  const mineralsConsumed = num(maintenance.minerals, 0) * scale;
  const metalsConsumed = metalsLocked ? 0 : num(maintenance.metals, 0) * scale;
  const foodMaintenance = num(maintenance.food, 0) * scale;
  const waterMaintenance = num(maintenance.water, 0) * scale;

  // 殖民地对母星的补给需求（population 越大消耗越多）。
  let colonyEnergy = 0;
  let colonyMetals = 0;
  let colonyFood = 0;
  const colony = civ.colony;
  if (colony) {
    colonyEnergy = (25 + colony.population * 0.02) * scale;
    colonyMetals = 4 * scale;
    colonyFood = 6 * scale;
  }

  const totalFoodConsumed = foodConsumed + foodMaintenance + colonyFood;
  const totalWaterConsumed = waterConsumed + waterMaintenance;
  const totalEnergyConsumed = energyConsumed + colonyEnergy;
  const totalMetalsConsumed = metalsConsumed + colonyMetals;
  const totalScienceConsumed = Math.max(0, num(ctx.researchSpent, 0));

  /* ---------- 4. 库存结算 ---------- */
  const capacityOf = (r: ResourceId): number =>
    Math.max(1, BASE_RESOURCE_CAPACITY[r] + Math.max(0, num(bfx.capacity?.[r], 0)));

  interface SettleResult {
    produced: number;
    consumed: number;
    shortage: number;
    overflow: number;
    before: number;
  }

  const settle = (r: ResourceId, produced: number, consumed: number): SettleResult => {
    const stock = resourceStock(civ, r);
    stock.capacity = capacityOf(r);
    const before = stock.amount;
    const available = before + Math.max(0, produced);
    const need = Math.max(0, consumed);
    let shortage = 0;
    let overflow = 0;
    if (available >= need) {
      const next = available - need;
      overflow = Math.max(0, next - stock.capacity);
      stock.amount = clamp(next, 0, stock.capacity);
    } else {
      shortage = need - available;
      stock.amount = 0;
    }
    setFlow(civ, r, produced, need);
    return { produced, consumed: need, shortage, overflow, before };
  };

  const foodResult = settle("food", foodProduced, totalFoodConsumed);
  const waterResult = settle("water", waterProduced, totalWaterConsumed);
  const energyResult = settle("energy", energyProduced, totalEnergyConsumed);
  const mineralsResult = settle("minerals", mineralsProduced, mineralsConsumed);
  const metalsResult = settle("metals", metalsProduced, totalMetalsConsumed);
  const scienceResult = settle("science", scienceProduced, totalScienceConsumed);

  const foodSatisfaction = clamp01((foodResult.before + foodResult.produced) / Math.max(1e-6, totalFoodConsumed));
  const waterSatisfaction = clamp01(
    (waterResult.before + waterResult.produced) / Math.max(1e-6, totalWaterConsumed),
  );
  const foodShortageRatio = totalFoodConsumed > 0 ? clamp01(foodResult.shortage / totalFoodConsumed) : 0;
  const waterShortageRatio = totalWaterConsumed > 0 ? clamp01(waterResult.shortage / totalWaterConsumed) : 0;
  const energyShortageRatio = totalEnergyConsumed > 0 ? clamp01(energyResult.shortage / totalEnergyConsumed) : 0;

  /* ---------- 5. 饥荒压力 ---------- */
  const starvationBefore = civ.starvation;
  if (foodShortageRatio > 0) {
    civ.starvation = clamp(civ.starvation + foodShortageRatio * 45 * scale, 0, 120);
  } else {
    civ.starvation = Math.max(0, civ.starvation - 10 * scale);
  }

  /* ---------- 6. 灾害冲击（持续型） ---------- */
  const resistance = clamp01(num(bfx.disasterResistance, 0) + num(techFx.disasterResistance, 0));
  const disasterShock = clamp01(crisis.disasterDamage * techMult.disaster * (1 - resistance));
  if (disasterShock > 0) {
    civ.population = civ.population * (1 - disasterShock);
    for (const r of RESOURCE_IDS) {
      const stock = civ.resources[r];
      if (!stock) continue;
      stock.amount = clamp(stock.amount * (1 - disasterShock * 0.3), 0, stock.capacity);
    }
    civ.crisisStreak += 1;
    log("hazard", "critical", `灾害冲击：人口损失 ${(disasterShock * 100).toFixed(1)}%，库存受损。`);
  }

  /* ---------- 7. 人口增长 ---------- */
  const housingCapacity = Math.max(0, BASE_HOUSING + num(bfx.housing, 0));
  const effectiveHousing = housingCapacity * techMult.populationCapacity;
  const housingRatio = effectiveHousing / Math.max(1, civ.population);

  const baseGrowth = BASE_GROWTH_PER_YEAR * num(difficulty.populationGrowth, 1);
  const foodSecurity = Math.pow(clamp01(foodSatisfaction), 1.5);
  const waterSecurity = clamp01(waterSatisfaction);
  const housingGrowth = clamp01((housingRatio - 0.5) / 0.7);
  const stabilityGrowth = 0.35 + 0.65 * clamp01((civ.stability ?? 65) / 100);
  const tempGrowth = 1 - clamp01(tempStressC / 50) * 0.7;
  const habitabilityGrowth = clamp(0.4 + 0.6 * habitability, 0, 1.1);

  let deathRate = 0;
  if (civ.starvation > 0) deathRate += (civ.starvation / 100) * 0.18;
  if (foodShortageRatio > 0) deathRate += foodShortageRatio * 0.12;
  if (waterShortageRatio > 0) deathRate += waterShortageRatio * 0.08;
  if (civ.stability < 25) deathRate += (1 - civ.stability / 25) * 0.03;
  if (energyShortageRatio > 0.5) deathRate += (energyShortageRatio - 0.5) * 0.02;

  const growthPerYear =
    baseGrowth * foodSecurity * waterSecurity * housingGrowth * stabilityGrowth * tempGrowth * habitabilityGrowth -
    deathRate;
  const popBefore = civ.population;
  const popNext = Math.max(0, civ.population * (1 + growthPerYear * years));
  civ.population = popNext;
  civ.growthPerYear = growthPerYear;
  report.populationDelta = civ.population - popBefore;

  if (civ.population < 1) civ.population = 0;

  /* ---------- 8. 就业 / 工业 ---------- */
  const workforceNext = workforceFor(civ.population);
  // 建筑岗位 + 服务业/自雇等非建筑岗位（人口越多，非建筑岗位越多）。
  const jobsNext = Math.max(workerJobs, 0) + Math.floor(civ.population * 0.3);
  const employmentNext = Math.min(workforceNext, jobsNext);
  civ.workforce = workforceNext;
  civ.jobs = jobsNext;
  civ.employment = employmentNext;
  civ.unemploymentRate = workforceNext > 0 ? clamp01((workforceNext - employmentNext) / workforceNext) : 0;

  const industryCapacity =
    (BASE_INDUSTRY + Math.max(0, num(bfx.industry, 0))) * techMult.industry;
  civ.industryCapacity = Math.max(0, industryCapacity);
  const constructionCount = Math.max(0, num(ctx.constructionCount, 0));
  civ.industryUsed = clamp(
    constructionCount > 0 ? Math.min(civ.industryCapacity, constructionCount * 10) : Math.min(civ.industryUsed, civ.industryCapacity),
    0,
    civ.industryCapacity,
  );
  civ.scienceRate = scienceProduced / Math.max(1e-6, scale) * TURN_YEARS;
  civ.housing = housingCapacity;

  /* ---------- 9. 稳定度 ---------- */
  const factors = computeStabilityFactors({
    foodSatisfaction,
    foodCoverageTurns: foodResult.before / Math.max(1e-6, totalFoodConsumed / Math.max(1e-6, scale)),
    waterSatisfaction,
    waterCoverageTurns: waterResult.before / Math.max(1e-6, totalWaterConsumed / Math.max(1e-6, scale)),
    housingRatio,
    tempStressC,
    habitability,
    unemployment: civ.unemploymentRate,
    starvation: civ.starvation,
    buildingStability: num(bfx.stability, 0),
    crisisPenalty: crisis.stabilityPenalty,
    disasterShock,
  });
  civ.stabilityFactors = factors;
  const targetStability = combineStability(factors);
  const smoothing = 1 - Math.exp(-years / 1.1);
  civ.stability = clamp(civ.stability + (targetStability - civ.stability) * smoothing, 0, 100);

  const crisisNow =
    civ.stability < 15 || civ.starvation > 60 || (foodShortageRatio > 0.25 && energyShortageRatio > 0.25);
  civ.crisisStreak = crisisNow ? civ.crisisStreak + 1 : 0;

  /* ---------- 10. 殖民地对母星的联动 ---------- */
  // 殖民地的成长由 game 层每回合单独调用 colonyReport() 推进（避免重复结算）；
  // 这里只把「殖民进度」类建筑的效果折算成自给率加成。
  if (civ.colony) {
    const progress = num(bfx.colonyProgress, 0);
    if (progress > 0) {
      civ.colony.selfSufficiency = clamp(civ.colony.selfSufficiency + (progress / 20000) * scale, 0, 0.95);
    }
  }

  /* ---------- 11. 科技解锁标记 ---------- */
  civ.unlockFlags.colony = civ.unlockFlags.colony || techFx.allowColony === true;
  civ.unlockFlags.planetEngine = civ.unlockFlags.planetEngine || techFx.allowPlanetEngine === true;
  civ.unlockFlags.deepSpace = civ.unlockFlags.deepSpace || techFx.allowColony === true;

  /* ---------- 12. 时代推进 ---------- */
  // 阶段 12 起，时代推进由 game 层基于 civilization/eras.ts 的条件清单驱动
  // （人口 / 科技时代分布 / 观测等级），经济结算不再自动跳时代。
  // report.eraChanged 恒为 null；game 层通过 applyEraAdvance 推进并自行记录里程碑。
  report.era = civ.era;

  /* ---------- 13. 完工 / 科研日志 ---------- */
  for (const id of report.buildingsCompleted) {
    const def = getBuildingDef(id);
    const name = def?.name ?? id;
    log("build", "success", def ? `建筑工程完工：${name}投入运行。` : `建筑工程完工：${name}。`);
  }
  if (report.researchCompleted) {
    log("tech", "success", `科技突破：「${techDisplayName(report.researchCompleted)}」研究完成。`);
  }

  /* ---------- 14. 环境 / 资源告警 ---------- */
  if (foodShortageRatio > 0.001) {
    const severity = foodShortageRatio > 0.35 ? "critical" : "warning";
    const missing = amountText(foodResult.shortage);
    log("civilization", severity, `食物短缺：本回合缺口 ${missing} 吨，饥荒压力升至 ${civ.starvation.toFixed(0)}。`);
  } else if (starvationBefore >= 20 && civ.starvation < 5) {
    log("civilization", "success", "饥荒压力解除，粮仓重新填满。");
  }
  if (waterShortageRatio > 0.05) {
    log("civilization", "warning", `饮水短缺：缺口 ${amountText(waterResult.shortage)} 吨，居民健康受损。`);
  }
  if (!energyLocked && energySatisfaction < ENERGY_CRITICAL_SATISFACTION) {
    log(
      "civilization",
      energySatisfaction < 0.6 ? "critical" : "warning",
      `能源供应不足（满足率 ${(energySatisfaction * 100).toFixed(0)}%），生产效率下降。`,
    );
  }
  if (tempStressC > 30 && civ.turn % 4 === 1) {
    log(
      "civilization",
      "warning",
      `极端温度：体感 ${effTempC.toFixed(0)}°C（超出舒适区 ${tempStressC.toFixed(0)}°C），农业与能源承压。`,
    );
  }
  const overflowFood = foodResult.overflow;
  if (overflowFood > 1 && civ.turn % 5 === 0) {
    log("civilization", "info", `仓储不足：约 ${amountText(overflowFood)} 吨食物在运输途中损失，建议增建仓库。`);
  }
  if (civ.stability < 30) {
    const weak = weakestFactor(factors);
    const display = stabilityDisplay(civ.stability);
    log(
      "civilization",
      civ.stability < 15 ? "critical" : "warning",
      `社会${display.label}：稳定度 ${civ.stability.toFixed(0)}，最薄弱环节是「${STABILITY_FACTOR_LABELS[weak.key]}」。`,
    );
  }
  if (civ.crisisStreak >= 2) {
    log("civilization", "warning", `文明已连续 ${civ.crisisStreak} 个回合处于危急状态。`);
  }

  /* ---------- 15. 胜利 / 失败判定 ---------- */
  if (mode !== "sandbox") {
    const defeat = checkDefeat(civ, env);
    let defeatReason = defeat.reason;
    if (!defeat.defeated && !ctx.physics?.planetAlive) {
      defeatReason =
        civ.colony && civ.colony.level >= 3
          ? null
          : "母星在三星的引力漩涡中湮灭，文明失去了家园";
    }
    if (!defeat.defeated && defeatReason) {
      // 条件覆盖：母星被毁。
      civ.alive = false;
      civ.causeOfCollapse = defeatReason;
      civ.defeatReason = defeatReason;
      report.collapsed = true;
      report.collapseReason = defeatReason;
      log("milestone", "critical", `文明崩溃：${defeatReason}`);
    } else if (defeat.defeated) {
      civ.alive = false;
      civ.causeOfCollapse = defeat.reason;
      civ.defeatReason = defeat.reason;
      report.collapsed = true;
      report.collapseReason = defeat.reason;
      log("milestone", "critical", `文明崩溃：${defeat.reason}`);
    }
  }

  if (civ.alive && !civ.hasWon) {
    const eraOk = civ.era >= 5;
    if (eraOk && civ.colony && civ.colony.level >= 4 && civ.colony.selfSufficiency >= 0.8) {
      civ.hasWon = true;
      report.victory = true;
      report.victoryReason = "星际文明：母星的火种已在异星扎根，文明不再只有一颗行星可以失去";
      log("milestone", "success", report.victoryReason);
    } else if (eraOk && ctx.hasPlanetEngine) {
      civ.hasWon = true;
      report.victory = true;
      report.victoryReason = "流浪行星：行星发动机点火，文明带着母星驶向新的轨道";
      log("milestone", "success", report.victoryReason);
    } else if (env.habitability <= 0.02 && civ.colony && civ.colony.level >= 3) {
      civ.hasWon = true;
      report.victory = true;
      report.victoryReason = "火种计划：母星已经死去，但文明在异星继续呼吸";
      log("milestone", "success", report.victoryReason);
    }
  }

  /* ---------- 16. 人口历史采样 ---------- */
  const historyYear = Number.isFinite(ctx.year) ? ctx.year : civ.turn * TURN_YEARS;
  civ.populationHistory.push({
    year: historyYear,
    population: Math.max(0, civ.population),
    stability: civ.stability,
    tempC,
  });
  if (civ.populationHistory.length > MAX_POPULATION_HISTORY) {
    civ.populationHistory.splice(0, civ.populationHistory.length - MAX_POPULATION_HISTORY);
  }

  if (civ.turn % 10 === 0) {
    log("civilization", "info", civilizationSummary(civ));
  }

  return report;
}

/* ------------------------------------------------------------------ *
 *  便捷：组装 TurnContext                                               *
 * ------------------------------------------------------------------ */

export interface AssembleTurnContextOptions {
  civ: CivilizationState;
  env: EnvironmentState;
  physics: PhysicsState;
  buildingEffects: BuildingEffects;
  techEffects: TechEffects;
  techMultipliers: TechMultipliers;
  crisis?: Partial<TurnCrisis>;
  mode: GameMode;
  difficulty: DifficultyKey;
  year: number;
  years?: number;
  turn?: number;
  maintenance?: Partial<Record<ResourceId, number>>;
  observatoryLevel?: number;
  researchedCount?: number;
  buildingsCompleted?: string[];
  researchCompleted?: string | null;
  workerJobs?: number;
  researchSpent?: number;
  constructionCount?: number;
  hasPlanetEngine?: boolean;
  /** 当前文明时代 1..5（阶段 12）；缺省视为 5 兼容旧调用。 */
  era?: number;
}

/**
 * 用默认值补齐一个 TurnContext，减少 game 层的样板代码。
 * maintenance / observatoryLevel / researchedCount 等务必从对应系统取真实值传入。
 */
export function assembleTurnContext(opts: AssembleTurnContextOptions): TurnContext {
  return {
    years: opts.years ?? TURN_YEARS,
    turn: opts.turn ?? opts.civ.turn + 1,
    env: opts.env,
    physics: opts.physics,
    buildingEffects: opts.buildingEffects,
    techEffects: opts.techEffects,
    techMultipliers: opts.techMultipliers,
    crisis: {
      foodMultiplier: num(opts.crisis?.foodMultiplier, 1),
      energyDemandMultiplier: num(opts.crisis?.energyDemandMultiplier, 1),
      stabilityPenalty: num(opts.crisis?.stabilityPenalty, 0),
      disasterDamage: clamp01(num(opts.crisis?.disasterDamage, 0)),
    },
    mode: opts.mode,
    difficulty: opts.difficulty,
    year: opts.year,
    maintenance: opts.maintenance,
    observatoryLevel: opts.observatoryLevel,
    researchedCount: opts.researchedCount,
    buildingsCompleted: opts.buildingsCompleted,
    researchCompleted: opts.researchCompleted,
    workerJobs: opts.workerJobs,
    researchSpent: opts.researchSpent,
    constructionCount: opts.constructionCount,
    hasPlanetEngine: opts.hasPlanetEngine,
    era: opts.era,
  };
}

/** 兼容导出：由科技状态直接算乘数（等价 technology.getTechMultipliers）。 */
export { getTechMultipliers };

/** 兼容导出：文明简述 / 资源工具。 */
export { civilizationSummary, gainResource, formatResourceAmount };
/** 兼容导出：文明初始状态工厂（规范要求 economy 层可直接创建）。 */
export { createCivilizationState } from "../civilization/state";
export type { TechMultipliers } from "../technology/system";
