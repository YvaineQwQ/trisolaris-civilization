/**
 * 资源系统（六种基础资源）。
 *
 * 单位说明：
 *  - 食物/水/矿物/金属：吨（文明尺度的人均年消耗按 0.5 回合粒度换算）
 *  - 能源：MWh（1 回合 = 0.5 年）
 *  - 科研点：点（可长期积累的“科研货币”）
 *
 * 库存容量 = BASE_RESOURCE_CAPACITY + 建筑 capacity 加成（见 buildings/system.ts）。
 * 科研点容量故意设得很大，允许玩家囤积以冲击高级科技。
 */
import type { ResourceDef, ResourceId, ResourceStock } from "../core/types";
import { clamp } from "../core/math";

/** 固定的资源顺序，所有 UI / 结算都按此顺序展示。 */
export const RESOURCE_IDS: readonly ResourceId[] = [
  "food",
  "water",
  "energy",
  "minerals",
  "metals",
  "science",
] as const;

export const RESOURCE_DEFS: Record<ResourceId, ResourceDef> = {
  food: {
    id: "food",
    name: "食物",
    short: "食",
    unit: "吨",
    color: "#8fd16a",
    description: "维持人口生存的农产品与合成口粮。短缺会直接引发饥荒与人口损失。",
  },
  water: {
    id: "water",
    name: "水",
    short: "水",
    unit: "吨",
    color: "#5cc8ff",
    description: "可直接利用的液态水。极端高温或严寒会降低取水效率。",
  },
  energy: {
    id: "energy",
    name: "能源",
    short: "能",
    unit: "MWh",
    color: "#ffd166",
    description: "电力与工业动力。温度越极端，供暖/制冷需求越高，能源压力越大。",
  },
  minerals: {
    id: "minerals",
    name: "矿物",
    short: "矿",
    unit: "吨",
    color: "#c9a06b",
    description: "矿石与基础原料，是建造与冶炼的起点。由矿场开采。",
  },
  metals: {
    id: "metals",
    name: "金属",
    short: "金",
    unit: "吨",
    color: "#aeb8c4",
    description: "精炼金属与合金，高级建筑和航天工程的主要材料。由冶炼厂生产。",
  },
  science: {
    id: "science",
    name: "科研点",
    short: "科",
    unit: "点",
    color: "#b48cff",
    description: "文明积累的知识与数据。用于研究科技与升级观测设施，可跨回合囤积。",
  },
};

/** 未计算建筑加成时的库存上限。 */
export const BASE_RESOURCE_CAPACITY: Record<ResourceId, number> = {
  food: 4000,
  water: 3000,
  energy: 2500,
  minerals: 2500,
  metals: 1800,
  science: 20000,
};

/**
 * 基础初始库存（食物/能源/科研由 DifficultyPreset 给出，见 createResourceStocks）。
 *
 * 阶段 12 原始开局口径：水 500 / 矿物 130 / 金属 0 / 能源 0。
 * 金属需 E2 解锁、能源需 E3 解锁，因此 E1 初始库存必须为 0，避免出现
 * "资源未解锁但库存非零" 的矛盾状态（game 层也会在 era 推进时把未解锁资源归零）。
 */
export const BASE_RESOURCE_STOCK: Record<ResourceId, number> = {
  food: 0,
  water: 500,
  energy: 0,
  minerals: 130,
  metals: 0,
  science: 0,
};

/** 库存低于容量的该比例时视为“告急”（供 UI 高亮）。 */
export const CRITICAL_STOCK_RATIO = 0.12;

export function isResourceId(value: string): value is ResourceId {
  return (RESOURCE_IDS as readonly string[]).includes(value);
}

export function getResourceDef(id: ResourceId): ResourceDef {
  return RESOURCE_DEFS[id];
}

/** 资源中文名。未知 id 原样返回，方便日志容错。 */
export function resourceName(id: string): string {
  return isResourceId(id) ? RESOURCE_DEFS[id].name : id;
}

/** 资源单位。 */
export function resourceUnit(id: string): string {
  return isResourceId(id) ? RESOURCE_DEFS[id].unit : "";
}

/** 资源颜色。 */
export function resourceColor(id: string): string {
  return isResourceId(id) ? RESOURCE_DEFS[id].color : "#8b949e";
}

export interface ResourceInitOptions {
  /** 食物 / 能源 / 科研的起始值（通常来自 DifficultyPreset）。 */
  startingFood: number;
  startingEnergy: number;
  startingScience: number;
  /** 额外的容量加成（通常来自初始建筑）。 */
  capacityBonus?: Partial<Record<ResourceId, number>>;
}

/** 创建六种资源的初始库存，全部裁剪到合法范围。 */
export function createResourceStocks(opts: ResourceInitOptions): Record<ResourceId, ResourceStock> {
  const amount: Record<ResourceId, number> = {
    ...BASE_RESOURCE_STOCK,
    food: Math.max(0, opts.startingFood),
    energy: Math.max(0, opts.startingEnergy),
    science: Math.max(0, opts.startingScience),
  };
  const out = {} as Record<ResourceId, ResourceStock>;
  for (const id of RESOURCE_IDS) {
    const capacity = computeCapacity(id, opts.capacityBonus?.[id] ?? 0);
    out[id] = { amount: clamp(amount[id], 0, capacity), capacity };
  }
  return out;
}

/** 单个资源的库存上限：基础容量 + 建筑加成。 */
export function computeCapacity(id: ResourceId, bonus = 0): number {
  return Math.max(1, BASE_RESOURCE_CAPACITY[id] + Math.max(0, bonus));
}

/** 资源占容量比例 0..1。 */
export function stockRatio(stock: ResourceStock): number {
  return stock.capacity <= 0 ? 0 : clamp(stock.amount / stock.capacity, 0, 1);
}

/** 是否处于告急状态（低于 CRITICAL_STOCK_RATIO）。 */
export function isResourceCritical(stock: ResourceStock): boolean {
  return stockRatio(stock) < CRITICAL_STOCK_RATIO;
}

/** 当前告急的资源列表。 */
export function criticalResources(resources: Record<ResourceId, ResourceStock>): ResourceId[] {
  return RESOURCE_IDS.filter((id) => isResourceCritical(resources[id]));
}

/** 数字文本：小于一万取整，大于则用 k/M 缩写（供 UI / 日志复用）。 */
export function amountText(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (abs >= 1e4) return (value / 1e3).toFixed(1) + "k";
  if (abs >= 100) return Math.round(value).toString();
  return value.toFixed(1);
}

/** 资源数量文本，例如 “1.2k 吨”。 */
export function formatResourceAmount(id: ResourceId, value: number): string {
  return `${amountText(value)} ${RESOURCE_DEFS[id].unit}`;
}
