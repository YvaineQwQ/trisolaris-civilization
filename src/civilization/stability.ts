/**
 * 社会稳定度模型。
 *
 * 稳定度 = 六个因子（食物/饮水/住房/温度/健康/秩序）的加权平均，0..100。
 * 每个因子自身也是 0..100，便于 UI 直接画进度条；因子计算完全由
 * resolveTurn 传入的“本回合实况”驱动，不做隐藏状态。
 */
import type { StabilityFactors } from "../core/types";
import { clamp, clamp01 } from "../core/math";

/** 稳定度六因子键（core/types 只保留 StabilityFactors 本体，这里给出键类型）。 */
export type StabilityFactorKey = keyof StabilityFactors;

export const STABILITY_FACTOR_KEYS: readonly StabilityFactorKey[] = [
  "food",
  "water",
  "housing",
  "temperature",
  "health",
  "order",
] as const;

export const STABILITY_FACTOR_LABELS: Record<StabilityFactorKey, string> = {
  food: "食物保障",
  water: "饮水供应",
  housing: "住房条件",
  temperature: "温度适应",
  health: "公众健康",
  order: "社会秩序",
};

export const STABILITY_WEIGHTS: Record<StabilityFactorKey, number> = {
  food: 0.22,
  water: 0.15,
  housing: 0.13,
  temperature: 0.17,
  health: 0.16,
  order: 0.17,
};

/** 舒适温度基线（摄氏度），与气候模块的 16°C 宜居中心一致。 */
export const COMFORT_TEMP_C = 16;

export interface StabilityInput {
  /** 本回合食物满足率 0..1（产量+库存 对 需求）。 */
  foodSatisfaction: number;
  /** 食物库存可支撑回合数（0..∞）。 */
  foodCoverageTurns: number;
  waterSatisfaction: number;
  waterCoverageTurns: number;
  /** 住房/人口 比。 */
  housingRatio: number;
  /** 超出舒适区后的温差（摄氏度，>=0）。 */
  tempStressC: number;
  /** 母星宜居度 0..1。 */
  habitability: number;
  /** 失业率 0..1。 */
  unemployment: number;
  /** 饥荒压力 0..100。 */
  starvation: number;
  /** 建筑提供的稳定度加成（可能为负，例如行星发动机的“恐惧”）。 */
  buildingStability: number;
  /** 本回合危机带来的稳定度惩罚。 */
  crisisPenalty: number;
  /** 本回合灾害冲击 0..1（已计算抗性减免）。 */
  disasterShock: number;
  /** 外部稳定度修正（例如剧情/胜利条件），默认 0。 */
  extraStability?: number;
}

/** 由本回合实况计算六项稳定度因子（0..100）。 */
export function computeStabilityFactors(input: StabilityInput): StabilityFactors {
  const foodSat = clamp01(input.foodSatisfaction);
  const waterSat = clamp01(input.waterSatisfaction);
  const stockBuffer = clamp01(input.foodCoverageTurns / 6);
  const waterBuffer = clamp01(input.waterCoverageTurns / 6);

  const food = clamp(100 * foodSat * (0.55 + 0.45 * stockBuffer) - input.starvation * 0.5, 0, 100);
  const water = clamp(100 * waterSat * (0.6 + 0.4 * waterBuffer), 0, 100);
  const housing = clamp(100 * (0.35 + 0.65 * clamp01((input.housingRatio - 0.6) / 0.6)), 0, 100);
  const temperature = clamp(100 - input.tempStressC * 1.7, 0, 100);
  const health = clamp(
    30 +
      35 * clamp01(input.habitability) +
      15 * waterSat +
      10 * foodSat -
      input.starvation * 0.6 -
      input.unemployment * 25,
    0,
    100,
  );
  const order = clamp(
    45 +
      input.buildingStability * 2 +
      20 * (1 - input.unemployment) -
      input.starvation * 0.25 -
      input.crisisPenalty * 2 -
      input.disasterShock * 40 +
      (input.extraStability ?? 0),
    0,
    100,
  );

  return { food, water, housing, temperature, health, order };
}

/** 六因子加权平均得到目标稳定度 0..100。 */
export function combineStability(factors: StabilityFactors): number {
  let sum = 0;
  let weight = 0;
  for (const key of STABILITY_FACTOR_KEYS) {
    sum += factors[key] * STABILITY_WEIGHTS[key];
    weight += STABILITY_WEIGHTS[key];
  }
  return weight <= 0 ? 0 : clamp(sum / weight, 0, 100);
}

export interface StabilityDisplay {
  /** 简短中文评价。 */
  label: string;
  /** 给 UI 的色调（与 game/viewTypes.ts 的约定一致）。 */
  tone: "good" | "ok" | "warn" | "bad";
}

/** 稳定度的中文标签与色调。 */
export function stabilityDisplay(stability: number): StabilityDisplay {
  if (stability >= 80) return { label: "安定", tone: "good" };
  if (stability >= 60) return { label: "平稳", tone: "good" };
  if (stability >= 42) return { label: "紧张", tone: "ok" };
  if (stability >= 25) return { label: "动荡", tone: "warn" };
  return { label: "濒临崩溃", tone: "bad" };
}

/** 稳定度因子最差的一项（用于日志/提示）。 */
export function weakestFactor(factors: StabilityFactors): { key: StabilityFactorKey; value: number } {
  let key: StabilityFactorKey = "food";
  let value = Number.POSITIVE_INFINITY;
  for (const k of STABILITY_FACTOR_KEYS) {
    if (factors[k] < value) {
      value = factors[k];
      key = k;
    }
  }
  return { key, value };
}
