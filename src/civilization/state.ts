/**
 * 文明初始状态工厂与资源读写辅助。
 *
 * 阶段 12 起，文明从「原始聚落（E1 · 仰望星空）」起步：
 *  - 人口 500（nightmare 400）
 *  - 食物 700–1000 / 水 500 / 矿物 130 / 金属 0 / 能源 0 / 科研 0–20
 *    （食物/科研来自 difficulty Preset，见 constants.DIFFICULTIES）
 *  - 稳定度 65，六因子同值起步
 *  - 时代 era = 1（E1 仅解锁 food / water / minerals / science；metals 需 E2，energy 需 E3）
 *  - 基础住房 200（营地/聚落建筑另计）、基础工业产能 10（原始工坊）
 *
 * 原始聚落的生产能力由 buildings.createInitialBuildingState() 单一来源提供：
 *   聚落营地 ×1、原始农田 ×2、水井 ×1、采石场 ×1（见 STARTING_BUILDINGS）。
 * 即使遗漏初始建筑，人口自给产出仍能保证第一回合不直接饿死。
 */
import { DIFFICULTIES } from "../core/constants";
import type {
  CivilizationState,
  DifficultyKey,
  GameMode,
  ResourceFlow,
  ResourceId,
  ResourceStock,
  StabilityFactors,
} from "../core/types";
import { clamp } from "../core/math";
import {
  BASE_RESOURCE_STOCK,
  RESOURCE_IDS,
  createResourceStocks,
  formatResourceAmount,
} from "./resources";

export const BASE_POPULATION = 500;
export const NIGHTMARE_POPULATION = 400;
export const START_STABILITY = 65;
/** 人口中可参与劳动的占比。 */
export const WORKFORCE_RATIO = 0.55;
/** 初始庇护所提供的住房（不含建筑；E1 聚落营地再提供 220）。 */
export const BASE_HOUSING = 200;
/** 基础工业产能（不含建筑；原始工坊 10，后续由能源/工业建筑提升）。 */
export const BASE_INDUSTRY = 10;
export const START_ERA = 1;
/** 人口历史最多保留的采样点数（与 UI 折线图一致）。 */
export const MAX_POPULATION_HISTORY = 600;
/** 初始舒适温度（无环境数据时的占位）。 */
export const DEFAULT_COMFORT_TEMP_C = 16;

export interface CreateCivilizationOptions {
  difficulty: DifficultyKey;
  mode: GameMode;
  seed: string;
  /** 可选：起始年份（用于人口历史采样）。默认 0。 */
  startYear?: number;
  /** 可选：起始地表温度（用于人口历史采样）。默认 16°C。 */
  startTempC?: number;
}

export function emptyResources(): Record<ResourceId, ResourceFlow> {
  const out = {} as Record<ResourceId, ResourceFlow>;
  for (const id of RESOURCE_IDS) out[id] = { produced: 0, consumed: 0, net: 0 };
  return out;
}

export function uniformStability(value: number): StabilityFactors {
  const v = clamp(value, 0, 100);
  return { food: v, water: v, housing: v, temperature: v, health: v, order: v };
}

/** 按难度 / 模式 / 种子创建文明初始状态。 */
export function createCivilizationState(opts: CreateCivilizationOptions): CivilizationState {
  const preset = DIFFICULTIES[opts.difficulty] ?? DIFFICULTIES.normal;
  const population = opts.difficulty === "nightmare" ? NIGHTMARE_POPULATION : BASE_POPULATION;
  const resources = createResourceStocks({
    startingFood: preset.startingFood,
    startingEnergy: preset.startingEnergy,
    startingScience: preset.startingScience,
  });
  const workforce = workforceFor(population);
  const startYear = opts.startYear ?? 0;

  return {
    population,
    housing: BASE_HOUSING,
    jobs: workforce,
    workforce,
    employment: workforce,
    unemploymentRate: 0,
    growthPerYear: 0,
    stability: START_STABILITY,
    stabilityFactors: uniformStability(START_STABILITY),
    resources,
    flows: emptyResources(),
    scienceRate: 0,
    industryCapacity: BASE_INDUSTRY,
    industryUsed: 0,
    era: START_ERA,
    turn: 0,
    starvation: 0,
    crisisStreak: 0,
    alive: true,
    causeOfCollapse: null,
    colony: null,
    hasWon: false,
    defeatReason: null,
    populationHistory: [
      {
        year: startYear,
        population,
        stability: START_STABILITY,
        tempC: opts.startTempC ?? DEFAULT_COMFORT_TEMP_C,
      },
    ],
    unlockFlags: { colony: false, planetEngine: false, deepSpace: false },
  };
}

/** 可用劳动力。 */
export function workforceFor(population: number): number {
  return Math.max(0, Math.floor(Math.max(0, population) * WORKFORCE_RATIO));
}

/** 安全读取资源库存。 */
export function resourceStock(civ: CivilizationState, id: ResourceId): ResourceStock {
  const stock = civ.resources[id];
  if (stock) return stock;
  // 容错：旧存档缺少资源字段时补一个空库存，避免 NaN 扩散。
  const fallback: ResourceStock = { amount: 0, capacity: 1 };
  civ.resources[id] = fallback;
  return fallback;
}

/** 是否付得起一组资源成本（负数按 0 处理）。 */
export function canAfford(
  civ: CivilizationState,
  cost: Partial<Record<ResourceId, number>>,
): { ok: boolean; missing: ResourceId[] } {
  const missing: ResourceId[] = [];
  for (const id of RESOURCE_IDS) {
    const need = cost[id] ?? 0;
    if (need > 0 && resourceStock(civ, id).amount + 1e-9 < need) missing.push(id);
  }
  return { ok: missing.length === 0, missing };
}

/** 扣除资源成本（调用方应先 canAfford），返回是否成功。 */
export function spendResources(
  civ: CivilizationState,
  cost: Partial<Record<ResourceId, number>>,
): boolean {
  const check = canAfford(civ, cost);
  if (!check.ok) return false;
  for (const id of RESOURCE_IDS) {
    const need = cost[id] ?? 0;
    if (need <= 0) continue;
    const stock = resourceStock(civ, id);
    stock.amount = clamp(stock.amount - need, 0, stock.capacity);
  }
  return true;
}

/** 增加资源（自动按库存上限截断），返回实际增加量。 */
export function gainResource(civ: CivilizationState, id: ResourceId, amount: number): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const stock = resourceStock(civ, id);
  const before = stock.amount;
  stock.amount = clamp(stock.amount + amount, 0, stock.capacity);
  return stock.amount - before;
}

/** 按库存上限截断资源，返回是否发生溢出。 */
export function clampResource(civ: CivilizationState, id: ResourceId, amount: number): number {
  const stock = resourceStock(civ, id);
  stock.amount = clamp(Number.isFinite(amount) ? amount : 0, 0, stock.capacity);
  return stock.amount;
}

/** 更新单个资源的流量记录。 */
export function setFlow(
  civ: CivilizationState,
  id: ResourceId,
  produced: number,
  consumed: number,
): void {
  const flow = civ.flows[id];
  flow.produced = Math.max(0, produced);
  flow.consumed = Math.max(0, consumed);
  flow.net = flow.produced - flow.consumed;
}

/** 供日志使用的文明简述（人口 / 稳定度 / 时代 / 资源）。 */
export function civilizationSummary(civ: CivilizationState): string {
  const food = civ.resources.food;
  const energy = civ.resources.energy;
  const pop = Math.max(0, Math.round(civ.population));
  return `人口 ${pop.toLocaleString("zh-CN")} · 稳定度 ${civ.stability.toFixed(0)} · 第 ${civ.era} 时代 · 食物 ${formatResourceAmount("food", food.amount)}（${flowText(civ, "food")}） · 能源 ${formatResourceAmount("energy", energy.amount)}（${flowText(civ, "energy")}）`;
}

function flowText(civ: CivilizationState, id: ResourceId): string {
  const net = civ.flows[id]?.net ?? 0;
  const sign = net >= 0 ? "+" : "−";
  const abs = Math.abs(net);
  const text = abs >= 1000 ? (abs / 1000).toFixed(1) + "k" : abs.toFixed(0);
  return `每回合 ${sign}${text}`;
}

/** 便捷：当前资源数量。 */
export function resourceAmount(civ: CivilizationState, id: ResourceId): number {
  return resourceStock(civ, id).amount;
}

/** 资源基础储备常量透出（供 game 层初始化参考）。 */
export const INITIAL_RESOURCE_BASE_STOCK = BASE_RESOURCE_STOCK;
