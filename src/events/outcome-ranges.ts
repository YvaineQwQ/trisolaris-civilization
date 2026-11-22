/**
 * v1.6 事件结果区间与随机结算（纯函数，不依赖 system.ts，避免循环导入）。
 *
 * 设计：
 *  - 选择前只展示区间（min ~ max），不展示精确值；
 *  - 历史同类事件、flags、难度会移动/放宽区间；
 *  - 选择后用确定性 RNG 在区间内取值，实际值再经 system.applyEventEffects 的
 *    同一套上限与夹取规则落地；报告显示实际 before/after/delta。
 */
import type { EventEffects, EventEffectForecast, EventState, EventCategory, DifficultyKey, GameState } from "../core/types";

export interface EffectBand {
  key: string;
  label: string;
  kind: EventEffectForecast["kind"];
  before: number | null;
  deltaMin: number | null;
  deltaMax: number | null;
  afterMin: number | null;
  afterMax: number | null;
  unit: string;
  tone: "gain" | "loss" | "neutral";
  detail: string | null;
}

export interface BandContext {
  category: EventCategory;
  turn: number;
  randomSeed: string;
  era: number;
  difficulty: DifficultyKey;
  eventId: string;
  choiceId: string;
}

export interface EffectBandOptions {
  /** 历史同类事件造成的区间移动：-1..1，正数表示更幸运/更温和。 */
  historyShift?: number;
  /** 历史同类事件造成的区间放宽：0..0.5。 */
  historySpread?: number;
}

export type ForecastFn = (effects: EventEffects | null | undefined, ctx: any) => EventEffectForecast[];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 根据最近历史与难度计算区间宽度/偏移。 */
export function historyBandOptions(
  state: EventState | null | undefined,
  category: EventCategory,
  difficulty: DifficultyKey,
  era: number,
): EffectBandOptions & { low: number; high: number; spread: number; shift: number; historySpread: number; historyShift: number } {
  let spread = 0.25;
  let shift = 0;
  const history = state?.history ?? [];
  const recent = history.slice(-6);
  for (const entry of recent) {
    if (entry.category === category) {
      spread += 0.035;
      /* 连续同类打击：区间整体向更坏的一侧移动，但不会无限恶化。 */
      shift -= 0.035;
    }
  }
  if (difficulty === "hard") spread += 0.04;
  if (difficulty === "nightmare") spread += 0.08;
  if (era >= 4) spread -= 0.02;
  /* 上一轮事件留下的 modifier 是真实状态：同一 tag 越强，区间越不稳定。 */
  const mods = state?.modifiers ?? {};
  for (const key of Object.keys(mods)) {
    const v = mods[key];
    if (!Number.isFinite(v)) continue;
    if (key === "heat" || key === "famine" || key === "fear" || key === "drought") shift -= 0.02;
    if (key === "hope" || key === "unity" || key === "harvest") shift += 0.02;
  }
  spread = clamp(spread, 0.12, 0.5);
  shift = clamp(shift, -0.18, 0.18);
  return {
    historyShift: shift,
    historySpread: spread,
    spread,
    shift,
    low: clamp(1 - spread + shift, 0.55, 1.25),
    high: clamp(1 + spread + shift, 0.75, 1.45),
  };
}

function scaled(effects: EventEffects, factor: number): EventEffects {
  const scaleNum = (n: number | undefined): number | undefined =>
    n == null || !Number.isFinite(n) ? n : n * factor;
  const resources = effects.resources
    ? Object.fromEntries(Object.entries(effects.resources).map(([k, v]) => [k, scaleNum(v)]))
    : undefined;
  return {
    ...effects,
    resources: resources as EventEffects["resources"],
    stability: scaleNum(effects.stability),
    population: scaleNum(effects.population),
    populationPct: scaleNum(effects.populationPct),
    science: scaleNum(effects.science),
    capital: scaleNum(effects.capital),
    hazardStress: scaleNum(effects.hazardStress),
    relation: effects.relation ? { ...effects.relation, delta: effects.relation.delta * factor } : undefined,
  };
}

/** 在区间内随机取一组真实效果；由 seed 决定，可复现。 */
export function rollEventEffects(
  effects: EventEffects,
  state: EventState | null | undefined,
  ctx: BandContext,
): EventEffects {
  const options = historyBandOptions(state, ctx.category, ctx.difficulty, ctx.era);
  const rng = mulberry32(hashSeed(
    [ctx.randomSeed, ctx.turn, ctx.eventId, ctx.choiceId, state?.nextHistoryId ?? 0, state?.triggeredTotal ?? 0].join("|"),
  ));
  const factors: number[] = [
    options.low + (options.high - options.low) * rng(),
    options.low + (options.high - options.low) * rng(),
    options.low + (options.high - options.low) * rng(),
    options.low + (options.high - options.low) * rng(),
    options.low + (options.high - options.low) * rng(),
    options.low + (options.high - options.low) * rng(),
  ];
  let index = 0;
  const next = (): number => factors[index++ % factors.length];
  const scaledNum = (n: number | undefined): number | undefined =>
    n == null || !Number.isFinite(n) ? n : n * next();
  const resources = effects.resources
    ? Object.fromEntries(Object.entries(effects.resources).map(([k, v]) => [k, scaledNum(v)]))
    : undefined;
  return {
    ...effects,
    resources: resources as EventEffects["resources"],
    stability: scaledNum(effects.stability),
    population: scaledNum(effects.population),
    populationPct: scaledNum(effects.populationPct),
    science: scaledNum(effects.science),
    capital: scaledNum(effects.capital),
    hazardStress: scaledNum(effects.hazardStress),
    relation: effects.relation
      ? { ...effects.relation, delta: effects.relation.delta * next() }
      : undefined,
  };
}

/** 计算选择前的范围；forecastFn 由调用方传入 system.forecastEventEffects。 */
export function forecastEffectBands(
  effects: EventEffects | null | undefined,
  ctx: any,
  state: EventState | null | undefined,
  category: EventCategory,
  forecastFn: ForecastFn,
): EffectBand[] {
  if (!effects) return [];
  const options = historyBandOptions(state, category, ctx?.difficulty ?? "normal", ctx?.era ?? 1);
  const center = forecastFn(effects, ctx);
  const low = forecastFn(scaled(effects, options.low), ctx);
  const high = forecastFn(scaled(effects, options.high), ctx);
  const byKey = new Map(low.map((e) => [e.key, e]));
  const highBy = new Map(high.map((e) => [e.key, e]));
  return center.map((entry) => {
    if (entry.delta == null) {
      return {
        key: entry.key, label: entry.label, kind: entry.kind,
        before: entry.before, deltaMin: null, deltaMax: null, afterMin: null, afterMax: null,
        unit: entry.unit, tone: entry.tone, detail: entry.detail,
      };
    }
    const lo = byKey.get(entry.key)?.delta;
    const hi = highBy.get(entry.key)?.delta;
    const deltaMin = Math.min(entry.delta, lo ?? entry.delta, hi ?? entry.delta);
    const deltaMax = Math.max(entry.delta, lo ?? entry.delta, hi ?? entry.delta);
    const afterMin = entry.before == null ? null : entry.before + deltaMin;
    const afterMax = entry.before == null ? null : entry.before + deltaMax;
    return {
      key: entry.key, label: entry.label, kind: entry.kind,
      before: entry.before,
      deltaMin: Math.round(deltaMin * 100) / 100,
      deltaMax: Math.round(deltaMax * 100) / 100,
      afterMin: afterMin == null ? null : Math.round(afterMin * 100) / 100,
      afterMax: afterMax == null ? null : Math.round(afterMax * 100) / 100,
      unit: entry.unit, tone: entry.tone, detail: entry.detail,
    };
  });
}

/** 审计一个事件定义中的明显逻辑问题（供测试 / 启动前检查）。 */
export function auditEventLogic(def: {
  id: string;
  eraMin: number;
  eraMax: number;
  choices: { id: string; effects: EventEffects; risk?: string }[];
  followUps?: { eventId: string }[];
}, knownEventIds: Set<string>): string[] {
  const issues: string[] = [];
  if (def.eraMin > def.eraMax) issues.push(def.id + ": eraMin > eraMax");
  if (!def.choices || def.choices.length < 2) issues.push(def.id + ": 少于 2 个选项");
  for (const choice of def.choices ?? []) {
    const e = choice.effects ?? {};
    const pop = (e.populationPct ?? 0) + (e.population ?? 0);
    const food = e.resources?.food ?? 0;
    if (pop > 0.05 && food < 0) issues.push(def.id + "/" + choice.id + ": 人口大增同时食物大减");
    if ((e.stability ?? 0) > 10 && (e.capital ?? 0) < -10) issues.push(def.id + "/" + choice.id + ": 稳定度大涨同时政治资本大跌");
    if (Math.abs(e.population ?? 0) > 0 && Math.abs(e.population ?? 0) > (e.resources?.food ?? 0) * 10) {
      /* 仅提示，不自动判错：人口绝对量与资源量纲不同。 */
    }
    if (e.hazardStress != null && e.hazardStress < -6 && (e.resources?.food ?? 0) > 100) {
      issues.push(def.id + "/" + choice.id + ": 灾害压力大降同时食物大增，疑似过强");
    }
  }
  for (const f of def.followUps ?? []) {
    if (!knownEventIds.has(f.eventId)) issues.push(def.id + ": followUp 指向不存在事件 " + f.eventId);
  }
  return issues;
}
