/**
 * 随机事件系统 v3（规格：docs/EXPANSION_V3.md §2）。
 *
 * 设计要点：
 *  - 纯函数式推进：所有随机数由 seed + 回合数 + 已触发次数派生（Seeded RNG），
 *    同一 seed / 同一操作序列必然得到同一结果，可复现、可测试。
 *  - 同时最多 1 个 pending 事件（getActiveEvent 只看 pending[0]），结算后才继续抽签。
 *  - 抽签间隔 8–16 回合，难度 / 时代做小幅修正；事件链后续（followUps）走独立
 *    排期队列，到期后优先以确定方式出场，不占 pending 名额。
 *  - 概率修正两层：tag modifiers（选择写入、每回合 ×0.65 衰减）与
 *    CHAIN_INFLUENCE（上一事件 → 下一事件显式乘数）。
 *  - 数值硬上限：人口 ±8%、稳定度 ±12、资源 ±8%（相对基础库存容量）、政治资本 ±15，
 *    单次事件不会直接灭国。
 *  - 事件效果由本系统直接写入传入的 civ / politics / hazards 对象（与 lead 约定），
 *    resolveEventChoice 同时把 effects / logs / outcome / followUp 返回给调用方记日志与 UI。
 *
 * 写入范围：src/events/**。不修改 src/core/types.ts（仅用 declare module 追加可选字段）。
 */
import { BASE_RESOURCE_CAPACITY, RESOURCE_IDS, resourceName } from "../civilization/resources";
import { gainResource, workforceFor } from "../civilization/state";
import { TURN_YEARS } from "../core/constants";
import { clamp } from "../core/math";
import { hashString, Rng } from "../core/rng";
import type {
  CivilizationState,
  DifficultyKey,
  EventChoiceDef,
  EventEffects,
  EventFollowUpDef,
  EventHistoryEntry,
  EventRequirement,
  EventState,
  GameEventDef,
  HazardState,
  LogEntry,
  PendingEventState,
  PoliticsState,
  ResourceId,
  TechState,
} from "../core/types";
import { EVENT_DEFS, TAG_LABELS, getEventDef } from "./definitions";

/** 事件链排期条目：followUps 的延迟落地。 */
export interface ScheduledEvent {
  /** 目标事件 id。 */
  eventId: string;
  /** 到期回合（含）。 */
  dueTurn: number;
  /** 抽取权重（越大越容易结出这一条链）。 */
  weight: number;
  /** 来源事件 id。 */
  fromEventId: string;
  /** 目标事件标题（用于 UI / 日志）。 */
  label: string;
}

/**
 * 以声明合并方式给冻结的 EventState 追加可选运行字段：
 * 不修改 src/core/types.ts，旧存档 / 外部构造的 EventState 缺字段时全部有兜底。
 */
declare module "../core/types" {
  interface EventState {
    /** createEventState 时的种子（无 ctx.randomSeed 时的确定性回退）。 */
    eventSeed?: string;
    /** 事件链排期队列（不占 pending 名额，JSON 序列化友好）。 */
    chainQueue?: ScheduledEvent[];
    /** 概率修正已经衰减到的回合。 */
    modifierTurn?: number;
  }
}

/** 事件系统上下文：lead 在每回合结算后组装。 */
export interface EventContext {
  civ: CivilizationState;
  tech?: TechState | null;
  politics?: PoliticsState | null;
  hazards?: HazardState | null;
  era?: number;
  turn: number;
  year?: number;
  difficulty?: DifficultyKey;
  /** 游戏种子。缺省时回退到 EventState.eventSeed。 */
  randomSeed?: string;
}

/** 事件日志（lead 转写成 LogEntry 时 category 固定 event）。 */
export interface EventLog {
  category: "event";
  severity: LogEntry["severity"];
  message: string;
}

export interface RequirementCheck {
  ok: boolean;
  reason: string | null;
}

/** 加权候选（eligibleEvents / 测试用）。 */
export interface EventCandidate {
  def: GameEventDef;
  /** 最终权重（含 tag 修正 / 事件链修正 / 重复衰减）。 */
  weight: number;
  baseWeight: number;
  tagMultiplier: number;
  chainMultiplier: number;
  repeatMultiplier: number;
}

/** 事件链排期 + 结算结果。 */
export interface EventResolution {
  ok: boolean;
  reason: string | null;
  def: GameEventDef | null;
  choice: EventChoiceDef | null;
  outcome: string;
  effectsSummary: string;
  logs: EventLog[];
  followUp: ScheduledEvent | null;
  historyEntry: EventHistoryEntry | null;
  /** 原始 effects（已应用；lead 不要重复应用，只用于展示/日志）。 */
  effects: EventEffects | null;
}

/** 一次选择实际落地的效果报告。 */
export interface AppliedEventEffects {
  summary: string;
  logs: EventLog[];
  applied: EventEffects;
}

/* ------------------------------------------------------------------ *
 *  常量与契约上限
 * ------------------------------------------------------------------ */

/** 同时最多 1 个待处理事件。 */
export const MAX_PENDING_EVENTS = 1;
/** 抽签间隔（回合）。 */
export const EVENT_INTERVAL_MIN = 20;
export const EVENT_INTERVAL_MAX = 34;
/** 开局到第一次事件的回合数下限。 */
export const FIRST_EVENT_TURN_MIN = 12;
/** tag 权重修正每回合衰减系数。 */
export const MODIFIER_DECAY = 0.65;
/** 单次事件效果的硬上限（与文档一致）。 */
export const EVENT_EFFECT_CAPS = {
  /** 人口变化占当前人口比例上限。 */
  populationPct: 0.08,
  /** 稳定度绝对变化上限。 */
  stability: 12,
  /** 政治资本绝对变化上限。 */
  capital: 15,
  /** 单种资源变化占其基础库存容量的比例上限。 */
  resourcePct: 0.08,
  /** 部门关系单次变化上限。 */
  relation: 25,
  /** 灾害压力单次变化上限。 */
  hazardStress: 20,
} as const;
/** 历史条目上限。 */
export const HISTORY_LIMIT = 80;
/** lastEventIds 记忆长度。 */
export const LAST_EVENT_MEMORY = 6;
/** 事件链排期队列上限。 */
export const MAX_CHAIN_QUEUE = 8;
/** 重复事件的权重衰减系数（第 n 次重复权重 ×0.55^n，下限 0.15）。 */
export const REPEAT_DECAY = 0.55;

/** 上一事件 → 下一事件权重的显式乘数表（≥25 条，见 docs/EVENTS.md）。 */
export const CHAIN_INFLUENCE: Record<string, Record<string, number>> = {
  env_red_dawn: { env_dust_storm: 1.7, haz_solar_flare: 1.5, env_flux_surge: 1.4 },
  env_long_night: { haz_cold_wave: 1.9, soc_underground_city: 1.4, ind_power_cut: 1.3 },
  env_ice_river: { haz_flood: 1.6, haz_cold_wave: 1.4, ind_rail_line: 1.2 },
  env_quiet_spring: { soc_harvest_feast: 1.8, soc_birth_boom: 1.5, sci_breakthrough_flux: 1.2 },
  env_flux_surge: { haz_radiation_belt: 1.5, sci_gene_lab_leak: 1.4, ind_steam_overheat: 1.2 },
  soc_harvest_feast: { soc_birth_boom: 1.7, pol_hero_statue: 1.4, env_quiet_spring: 1.2 },
  soc_birth_boom: { pol_ration_debate: 1.4, ind_rail_line: 1.3, soc_school_wars: 1.2 },
  soc_famine_rumor: { pol_ration_debate: 1.9, haz_plague: 1.5, soc_migrant_wave: 1.6 },
  soc_dehydrated_cult: { mys_prophet: 1.6, mys_three_body_dream: 1.4, pol_hero_statue: 1.2 },
  soc_migrant_wave: { pol_succession_quarrel: 1.4, ind_factory_strike: 1.3, pol_corruption_ring: 1.2 },
  soc_generation_gap: { pol_city_referendum: 1.5, mys_fifth_column: 1.3, sci_calculator_cult: 1.2 },
  pol_ration_debate: { soc_migrant_wave: 1.7, pol_senate_deadlock: 1.6, soc_dehydrated_cult: 1.3 },
  pol_general_ambition: { pol_senate_deadlock: 1.8, pol_city_referendum: 1.2, haz_fire: 1.2 },
  pol_senate_deadlock: { pol_city_referendum: 1.9, soc_generation_gap: 1.3, pol_corruption_ring: 1.4 },
  pol_city_referendum: { spc_generation_ship: 1.7, spc_colony_signal: 1.2, soc_generation_gap: 1.3 },
  pol_hero_statue: { soc_harvest_feast: 1.5, pol_succession_quarrel: 1.3, soc_school_wars: 1.2 },
  pol_corruption_ring: { pol_senate_deadlock: 1.6, ind_factory_strike: 1.3, soc_migrant_wave: 1.2 },
  pol_scholar_appeal: { pol_senate_deadlock: 1.3, sci_breakthrough_flux: 1.4, soc_school_wars: 1.5 },
  pol_succession_quarrel: { pol_general_ambition: 1.8, pol_corruption_ring: 1.3, soc_migrant_wave: 1.2 },
  sci_star_anomaly: { sci_mad_astronomer: 1.9, mys_listening_stars: 1.5, sci_breakthrough_flux: 1.3 },
  sci_mad_astronomer: { mys_prophet: 1.8, sci_calculator_cult: 1.5, mys_time_loop: 1.2 },
  sci_lost_archives: { sci_calculator_cult: 1.8, mys_impossible_ruin: 1.3, sci_breakthrough_flux: 1.4 },
  sci_breakthrough_flux: { ind_fusion_test: 1.6, spc_deep_probe: 1.4, sci_ai_dream: 1.3 },
  sci_calculator_cult: { mys_fifth_column: 1.4, sci_ai_dream: 1.7, pol_scholar_appeal: 1.2 },
  sci_ai_dream: { sci_signal_echo: 1.8, spc_colony_signal: 1.4, mys_dead_signal: 1.3 },
  ind_mine_collapse: { ind_factory_strike: 1.8, pol_scholar_appeal: 1.3, haz_quake: 1.4 },
  ind_factory_strike: { pol_general_ambition: 1.4, soc_generation_gap: 1.5, ind_power_cut: 1.3 },
  ind_power_cut: { pol_ration_debate: 1.5, soc_underground_city: 1.3, ind_steam_overheat: 1.2 },
  ind_rail_line: { soc_harvest_feast: 1.4, ind_scrap_windfall: 1.5, soc_migrant_wave: 1.2 },
  ind_steam_overheat: { haz_fire: 1.5, ind_power_cut: 1.4, haz_quake: 1.1 },
  ind_fusion_test: { env_tidal_heating: 1.4, spc_generation_ship: 1.4, ind_power_cut: 1.2 },
  spc_generation_ship: { spc_engine_rumor: 1.9, spc_colony_signal: 1.5, pol_city_referendum: 1.3 },
  spc_deep_probe: { mys_dead_signal: 1.6, sci_signal_echo: 1.5, spc_colony_signal: 1.2 },
  spc_orbit_debris: { spc_moon_quarantine: 1.8, spc_orbital_elevator: 1.4, haz_radiation_belt: 1.3 },
  spc_colony_signal: { pol_city_referendum: 1.3, mys_dead_signal: 1.4, spc_engine_rumor: 1.2 },
  spc_meteor_swarm: { haz_meteor_shower: 1.7, spc_orbit_debris: 1.4, env_dust_storm: 1.2 },
  spc_engine_rumor: { pol_city_referendum: 1.5, spc_orbital_elevator: 1.2, soc_generation_gap: 1.2 },
  mys_listening_stars: { mys_dead_signal: 1.8, sci_signal_echo: 1.5, mys_impossible_ruin: 1.3 },
  mys_prophet: { mys_three_body_dream: 2.0, soc_dehydrated_cult: 1.7, mys_time_loop: 1.2 },
  mys_three_body_dream: { mys_fifth_column: 1.5, mys_dead_signal: 1.4, sci_star_anomaly: 1.3 },
  mys_impossible_ruin: { mys_dead_signal: 1.6, spc_deep_probe: 1.5, sci_lost_archives: 1.2 },
  mys_frozen_astronomer: { sci_lost_archives: 1.7, mys_listening_stars: 1.4, soc_dehydrated_cult: 1.2 },
  mys_dead_signal: { mys_fifth_column: 1.3, sci_signal_echo: 1.2, mys_time_loop: 1.2 },
  haz_solar_flare: { env_flux_surge: 2.2, sci_breakthrough_flux: 1.5, env_red_dawn: 1.6 },
  haz_meteor_shower: { sci_breakthrough_flux: 1.8, mys_impossible_ruin: 1.4, ind_mine_collapse: 1.3 },
  haz_quake: { ind_mine_collapse: 1.9, pol_succession_quarrel: 1.2, haz_flood: 1.4 },
  haz_flood: { env_ice_river: 1.5, ind_smelter_spore: 1.6, soc_migrant_wave: 1.4 },
  haz_plague: { sci_gene_lab_leak: 1.6, soc_generation_gap: 1.3, pol_ration_debate: 1.4 },
  haz_cold_wave: { soc_underground_city: 1.7, ind_power_cut: 1.6, env_long_night: 1.5 },
  haz_fire: { ind_factory_strike: 1.4, ind_power_cut: 1.3, soc_generation_gap: 1.2 },
  haz_radiation_belt: { sci_gene_lab_leak: 1.5, sci_signal_echo: 1.3, spc_orbit_debris: 1.4 },
};

/* ------------------------------------------------------------------ *
 *  基础设施
 * ------------------------------------------------------------------ */

const OK: RequirementCheck = { ok: true, reason: null };

function fail(reason: string): RequirementCheck {
  return { ok: false, reason };
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeTurn(turn: number | undefined): number {
  const t = Math.floor(finite(turn ?? 0, 0));
  return Math.max(0, t);
}

function normalizeEra(era: number | undefined): number {
  const e = Math.floor(finite(era ?? 1, 1));
  return clamp(e, 1, 5);
}

function resolveEra(ctx: EventContext): number {
  return normalizeEra(ctx.era ?? ctx.civ?.era ?? 1);
}

function seedOf(state: EventState): string {
  return typeof state.eventSeed === "string" && state.eventSeed.length > 0 ? state.eventSeed : "EVENTS";
}

function queueOf(state: EventState): ScheduledEvent[] {
  if (!Array.isArray(state.chainQueue)) state.chainQueue = [];
  return state.chainQueue;
}

function round2(value: number): number {
  const v = finite(value, 0);
  return Math.round(v * 100) / 100;
}

function signed(value: number): string {
  const v = round2(value);
  return v >= 0 ? "+" + v : String(v);
}

function yearOf(ctx: EventContext): number {
  const y = finite(ctx.year ?? Number.NaN, Number.NaN);
  if (Number.isFinite(y)) return y;
  return normalizeTurn(ctx.turn) * TURN_YEARS;
}

function resourceDeltaCap(id: ResourceId): number {
  return Math.max(1, BASE_RESOURCE_CAPACITY[id] * EVENT_EFFECT_CAPS.resourcePct);
}

/* ------------------------------------------------------------------ *
 *  状态创建
 * ------------------------------------------------------------------ */

/** 开新游戏时创建事件状态。同一 seed 得到同一初始抽签节奏。 */
export function createEventState(seed: string): EventState {
  const cleanSeed = typeof seed === "string" && seed.length > 0 ? seed : "EVENTS";
  const rng = new Rng(cleanSeed + "|events-init");
  const firstTurn = FIRST_EVENT_TURN_MIN + rng.int(0, 3);
  const state: EventState = {
    pending: [],
    history: [],
    nextHistoryId: 1,
    flags: [],
    modifiers: {},
    cooldowns: {},
    lastEventIds: [],
    seenCounts: {},
    triggeredTotal: 0,
    nextRollTurn: firstTurn,
    eventSeed: cleanSeed,
    chainQueue: [],
    modifierTurn: 0,
  };
  return state;
}

/* ------------------------------------------------------------------ *
 *  条件判定
 * ------------------------------------------------------------------ */

/** 检查一组事件条件是否满足（choices / followUps / 事件本体共用）。 */
export function checkRequirements(
  req: EventRequirement | undefined,
  ctx: EventContext | null | undefined,
  state?: EventState | null,
): RequirementCheck {
  if (!req) return OK;
  if (!ctx || !ctx.civ) return fail("缺少文明上下文");
  const civ = ctx.civ;
  const era = resolveEra(ctx);

  if (req.minEra != null && era < req.minEra) return fail("需要第 " + req.minEra + " 时代");
  if (req.maxEra != null && era > req.maxEra) return fail("仅限第 " + req.maxEra + " 时代及更早");
  if (req.minStability != null && civ.stability < req.minStability) {
    return fail("稳定度不足（需要 " + req.minStability + "）");
  }
  if (req.maxStability != null && civ.stability > req.maxStability) {
    return fail("局势过于安定（需要稳定度不高于 " + req.maxStability + "）");
  }
  if (req.minPopulation != null && civ.population < req.minPopulation) {
    return fail("人口不足（需要 " + req.minPopulation + "）");
  }
  if (req.resources) {
    for (const [rawId, need] of Object.entries(req.resources)) {
      if (need == null || !(need > 0)) continue;
      const id = rawId as ResourceId;
      const stock = civ.resources[id];
      if (!stock) return fail("缺少资源 " + resourceName(id));
      if (stock.amount < need) {
        return fail(resourceName(id) + "不足（需要 " + need + "）");
      }
    }
  }
  if (req.techs && req.techs.length > 0) {
    const researched = ctx.tech?.researched ?? [];
    const missing = req.techs.filter((id) => !researched.includes(id));
    if (missing.length > 0) return fail("需要科技：" + missing.join("、"));
  }
  if (req.anyTechs && req.anyTechs.length > 0) {
    const researched = ctx.tech?.researched ?? [];
    if (!req.anyTechs.some((id) => researched.includes(id))) return fail("缺少相关科技");
  }
  if (req.flags && req.flags.length > 0) {
    const flags = state?.flags ?? [];
    const missing = req.flags.filter((flag) => !flags.includes(flag));
    if (missing.length > 0) return fail("世界状态尚未满足");
  }
  if (req.notFlags && req.notFlags.length > 0) {
    const flags = state?.flags ?? [];
    if (req.notFlags.some((flag) => flags.includes(flag))) return fail("世界状态已改变");
  }
  if (req.department) {
    const minister = ctx.politics?.ministers?.[req.department.id] ?? null;
    if (!minister) return fail("该部门暂无部长");
    if (req.department.minCompetence != null && minister.competence < req.department.minCompetence) {
      return fail("部长能力不足");
    }
  }
  return OK;
}

/** 选项在当前上下文是否可选（UI 的 available / unavailableReason 直接消费）。 */
export function isChoiceAvailable(
  choice: EventChoiceDef,
  ctx: EventContext | null | undefined,
  state?: EventState | null,
): RequirementCheck {
  if (!choice) return fail("选项不存在");
  return checkRequirements(choice.requirements, ctx, state);
}

/** 事件本体在当前上下文是否可出场（时代 / 条件 / 冷却 / 重复限制）。 */
export function eventAvailable(
  def: GameEventDef,
  state: EventState | null | undefined,
  ctx: EventContext,
): RequirementCheck {
  if (!def) return fail("事件不存在");
  const era = resolveEra(ctx);
  if (era < def.eraMin) return fail("时代未到（需要第 " + def.eraMin + " 时代）");
  if (era > def.eraMax) return fail("时代已过（仅限第 " + def.eraMax + " 时代及更早）");
  const req = checkRequirements(def.requirements, ctx, state);
  if (!req.ok) return req;
  if (state) {
    if (!def.repeatable && (state.seenCounts[def.id] ?? 0) > 0) return fail("该事件不会重复发生");
    const cooldown = state.cooldowns[def.id];
    if (typeof cooldown === "number" && Number.isFinite(cooldown) && normalizeTurn(ctx.turn) < cooldown) {
      return fail("事件冷却中");
    }
  }
  return OK;
}

/* ------------------------------------------------------------------ *
 *  概率模型
 * ------------------------------------------------------------------ */

/** 该事件当前的条件可用性（测试 / UI 用；不含权重）。 */
export function eligibleEvents(ctx: EventContext, state?: EventState | null): GameEventDef[] {
  if (!ctx || !ctx.civ) return [];
  return EVENT_DEFS.filter((def) => eventAvailable(def, state ?? null, ctx).ok);
}

interface WeightParts {
  baseWeight: number;
  tagMultiplier: number;
  chainMultiplier: number;
  repeatMultiplier: number;
  weight: number;
}

function weightParts(state: EventState, def: GameEventDef, ctx: EventContext): WeightParts {
  const baseWeight = Number.isFinite(def.weight) && def.weight > 0 ? def.weight : 10;
  let tagMultiplier = 1;
  for (const tag of def.tags) {
    const modifier = state.modifiers[tag];
    if (typeof modifier === "number" && Number.isFinite(modifier) && modifier > 0) {
      tagMultiplier *= clamp(modifier, 0.1, 4);
    }
  }
  const difficulty = ctx.difficulty ?? "normal";
  if (def.category === "hazard") {
    tagMultiplier *= difficulty === "nightmare" ? 1.3 : difficulty === "hard" ? 1.15 : difficulty === "easy" ? 0.85 : 1;
  } else if (def.category === "mystery") {
    tagMultiplier *= difficulty === "nightmare" ? 1.15 : difficulty === "easy" ? 0.9 : 1;
  }
  let chainMultiplier = 1;
  const memory = Array.isArray(state.lastEventIds) ? state.lastEventIds.slice(-2) : [];
  for (let i = 0; i < memory.length; i++) {
    const previous = memory[memory.length - 1 - i];
    const table = CHAIN_INFLUENCE[previous];
    if (!table) continue;
    const value = table[def.id];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      chainMultiplier *= i === 0 ? clamp(value, 0.2, 3) : Math.sqrt(clamp(value, 0.2, 3));
    }
  }
  const seen = state.seenCounts[def.id] ?? 0;
  const repeatMultiplier = seen > 0 ? Math.max(0.15, Math.pow(REPEAT_DECAY, seen)) : 1;
  const raw = baseWeight * tagMultiplier * chainMultiplier * repeatMultiplier;
  const weight = clamp(finite(raw, 0.01), 0.01, 1e6);
  return { baseWeight, tagMultiplier, chainMultiplier, repeatMultiplier, weight };
}

/** 当前所有可出场事件的加权候选（weight 已含全部修正），按权重降序。 */
export function eventCandidates(state: EventState, ctx: EventContext): EventCandidate[] {
  if (!state || !ctx || !ctx.civ) return [];
  const out: EventCandidate[] = [];
  for (const def of EVENT_DEFS) {
    if (!eventAvailable(def, state, ctx).ok) continue;
    out.push({ def, ...weightParts(state, def, ctx) });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

/** 难度 / 时代对抽签间隔的修正。 */
function rollInterval(state: EventState, ctx: EventContext, turn: number): number {
  const difficulty = ctx.difficulty ?? "normal";
  const difficultyAdj =
    difficulty === "easy" ? 2 : difficulty === "hard" ? -2 : difficulty === "nightmare" ? -3 : 0;
  const era = resolveEra(ctx);
  const eraAdj = era >= 4 ? -2 : era >= 2 ? -1 : 0;
  const rng = new Rng(hashString(seedOf(state) + "|interval|" + turn + "|" + state.triggeredTotal));
  const span = EVENT_INTERVAL_MAX - EVENT_INTERVAL_MIN;
  const base = EVENT_INTERVAL_MIN + rng.int(0, span);
  return clamp(base + difficultyAdj + eraAdj, 5, 20);
}

/* ------------------------------------------------------------------ *
 *  每回合推进
 * ------------------------------------------------------------------ */

/**
 * 推进事件时钟：按回合衰减 modifiers、清理过期冷却。
 * maybeTriggerEvent / resolveEventChoice 内部会自动调用；lead 无需单独调用。
 */
export function advanceEventClock(state: EventState, turn: number): void {
  if (!state) return;
  const t = normalizeTurn(turn);
  if (!state.modifiers || typeof state.modifiers !== "object") state.modifiers = {};
  const last = typeof state.modifierTurn === "number" && Number.isFinite(state.modifierTurn) ? state.modifierTurn : t;
  const delta = t - last;
  if (delta > 0) {
    const factor = Math.pow(MODIFIER_DECAY, delta);
    for (const tag of Object.keys(state.modifiers)) {
      const raw = state.modifiers[tag];
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        delete state.modifiers[tag];
        continue;
      }
      // 向中性值 1 衰减（不是向 0 指数衰减）：1.8 的修正应逐回合回落到 1，
      // 负向修正同样回到 1，否则漏乘会让 tag 事件被永久压制/放大。
      const next = 1 + (raw - 1) * factor;
      if (Math.abs(next - 1) < 0.02) delete state.modifiers[tag];
      else state.modifiers[tag] = clamp(next, 0.1, 4);
    }
    state.modifierTurn = t;
  } else if (state.modifierTurn == null) {
    state.modifierTurn = t;
  }
  for (const id of Object.keys(state.cooldowns ?? {})) {
    const cooldown = state.cooldowns[id];
    if (!Number.isFinite(cooldown) || cooldown <= t) delete state.cooldowns[id];
  }
}

function noteTriggered(state: EventState, def: GameEventDef): void {
  state.triggeredTotal = Math.max(0, finite(state.triggeredTotal, 0)) + 1;
  state.seenCounts[def.id] = (state.seenCounts[def.id] ?? 0) + 1;
  const memory = Array.isArray(state.lastEventIds) ? state.lastEventIds.filter((id) => id !== def.id) : [];
  memory.push(def.id);
  state.lastEventIds = memory.slice(-LAST_EVENT_MEMORY);
}

function makePending(def: GameEventDef, turn: number, ctx: EventContext, context: string): PendingEventState {
  const era = resolveEra(ctx);
  const stability = Math.round(finite(ctx.civ?.stability, 0));
  const population = Math.round(finite(ctx.civ?.population, 0));
  const detail =
    "第 " + (turn + 1) + " 回合 · 第 " + era + " 时代 · 稳定度 " + stability + " · 人口 " + population;
  return {
    defId: def.id,
    triggerTurn: turn,
    triggerYear: yearOf(ctx),
    context: detail + (context ? " · " + context : ""),
  };
}

/**
 * 每回合调用：满足节拍时生成一个待处理事件。
 * 返回 null 表示本回合无事件；返回非 null 后应暂停游戏，等 resolveEventChoice。
 */
export function maybeTriggerEvent(state: EventState, ctx: EventContext): PendingEventState | null {
  if (!state || !ctx || !ctx.civ) return null;
  if (!Array.isArray(state.pending)) state.pending = [];
  if (state.pending.length >= MAX_PENDING_EVENTS) return null;
  const turn = normalizeTurn(ctx.turn);
  advanceEventClock(state, turn);

  // 1) 事件链后续优先：到期后以确定性方式落地，保证链可测试、可复现。
  const queue = queueOf(state);
  const due = queue.filter((entry) => entry.dueTurn <= turn);
  if (due.length > 0) {
    due.sort((a, b) => a.dueTurn - b.dueTurn || b.weight - a.weight || a.eventId.localeCompare(b.eventId));
    for (const entry of due) {
      const index = queue.indexOf(entry);
      if (index >= 0) queue.splice(index, 1);
      const def = getEventDef(entry.eventId);
      if (!def) continue;
      if (!eventAvailable(def, state, ctx).ok) continue;
      const pending = makePending(def, turn, ctx, "事件链 · " + entry.label);
      state.pending = [pending];
      state.nextRollTurn = turn + rollInterval(state, ctx, turn);
      noteTriggered(state, def);
      return pending;
    }
  }

  // 2) 节拍未到：不抽签。
  const dueTurn = Number.isFinite(state.nextRollTurn) ? state.nextRollTurn : 0;
  if (turn < dueTurn) return null;

  // 3) 加权抽签。
  const candidates = eventCandidates(state, ctx).filter((candidate) => candidate.weight > 0);
  if (candidates.length === 0) {
    state.nextRollTurn = turn + 2;
    return null;
  }
  state.nextRollTurn = turn + rollInterval(state, ctx, turn);
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (!(total > 0) || !Number.isFinite(total)) {
    state.nextRollTurn = turn + 2;
    return null;
  }
  const rng = new Rng(hashString(seedOf(state) + "|roll|" + turn + "|" + state.triggeredTotal + "|" + (ctx.randomSeed ?? "")));
  let cursor = rng.next() * total;
  let chosen = candidates[candidates.length - 1].def;
  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) {
      chosen = candidate.def;
      break;
    }
  }
  const pending = makePending(chosen, turn, ctx, "星海异动");
  state.pending = [pending];
  noteTriggered(state, chosen);
  return pending;
}

/* ------------------------------------------------------------------ *
 *  效果落地
 * ------------------------------------------------------------------ */

function choiceSeverity(summaryText: string, negative: number): LogEntry["severity"] {
  if (negative >= 3) return "critical";
  if (negative >= 1) return "warning";
  if (summaryText.length === 0) return "info";
  return "info";
}

/**
 * 把一组 EventEffects 直接写入 civ / politics / hazards，并夹到文档规定的硬上限。
 * 导出以便测试与 lead 复用；resolveEventChoice 内部使用同一实现。
 */
export function applyEventEffects(
  state: EventState,
  def: GameEventDef,
  choice: EventChoiceDef,
  ctx: EventContext,
): AppliedEventEffects {
  const effects: EventEffects = choice.effects ?? {};
  const civ = ctx.civ;
  const parts: string[] = [];
  const logs: EventLog[] = [];
  let negativity = 0;

  // 资源
  if (effects.resources) {
    for (const [rawId, rawDelta] of Object.entries(effects.resources)) {
      if (rawDelta == null || !Number.isFinite(rawDelta) || rawDelta === 0) continue;
      const id = rawId as ResourceId;
      if (!RESOURCE_IDS.includes(id)) continue;
      const cap = resourceDeltaCap(id);
      const delta = clamp(rawDelta, -cap, cap);
      const actual = gainResource(civ, id, delta);
      if (Math.abs(actual) >= 0.5) {
        parts.push(resourceName(id) + " " + signed(actual));
        if (actual < 0) negativity += 1;
      }
    }
  }

  // 稳定度（单次 ±12）
  if (effects.stability != null && Number.isFinite(effects.stability) && effects.stability !== 0) {
    const delta = clamp(effects.stability, -EVENT_EFFECT_CAPS.stability, EVENT_EFFECT_CAPS.stability);
    const before = finite(civ.stability, 0);
    civ.stability = clamp(before + delta, 0, 100);
    const actual = civ.stability - before;
    if (Math.abs(actual) >= 0.5) {
      parts.push("稳定度 " + signed(actual));
      if (actual < 0) negativity += 2;
    }
  }

  // 人口（百分比 + 绝对值，合计不超过 ±8%）
  const popBefore = finite(civ.population, 0);
  if (popBefore > 0) {
    const popCap = popBefore * EVENT_EFFECT_CAPS.populationPct;
    const pctRaw = effects.populationPct != null && Number.isFinite(effects.populationPct) ? effects.populationPct : 0;
    const flatRaw = effects.population != null && Number.isFinite(effects.population) ? effects.population : 0;
    const pctDelta = clamp(pctRaw, -EVENT_EFFECT_CAPS.populationPct, EVENT_EFFECT_CAPS.populationPct) * popBefore;
    let popDelta = pctDelta + clamp(flatRaw, -popCap, popCap);
    popDelta = clamp(popDelta, -popCap, popCap);
    if (Math.abs(popDelta) >= 1) {
      const next = Math.max(1, popBefore + Math.round(popDelta));
      civ.population = next;
      const actual = next - popBefore;
      parts.push("人口 " + signed(actual));
      if (actual < 0) negativity += 2;
      const workforce = workforceFor(next);
      if (Number.isFinite(workforce)) civ.workforce = workforce;
    }
  }

  // 科研点
  if (effects.science != null && Number.isFinite(effects.science) && effects.science !== 0) {
    const cap = resourceDeltaCap("science");
    const delta = clamp(effects.science, -cap, cap);
    const actual = gainResource(civ, "science", delta);
    if (Math.abs(actual) >= 0.5) parts.push("科研点 " + signed(actual));
  }

  // 政治资本（单次 ±15）
  if (effects.capital != null && Number.isFinite(effects.capital) && effects.capital !== 0) {
    if (ctx.politics) {
      const delta = clamp(effects.capital, -EVENT_EFFECT_CAPS.capital, EVENT_EFFECT_CAPS.capital);
      const before = finite(ctx.politics.capital, 0);
      ctx.politics.capital = clamp(before + delta, 0, 999);
      const actual = ctx.politics.capital - before;
      if (Math.abs(actual) >= 0.5) {
        parts.push("政治资本 " + signed(actual));
        if (actual < 0) negativity += 1;
      }
    }
  }

  // 部门关系
  if (effects.relation && ctx.politics) {
    const a = effects.relation.a;
    const b = effects.relation.b;
    if (a && b && Number.isFinite(effects.relation.delta)) {
      const key = [a, b].sort().join("|");
      const before = finite(ctx.politics.relations?.[key] ?? 0, 0);
      const delta = clamp(effects.relation.delta, -EVENT_EFFECT_CAPS.relation, EVENT_EFFECT_CAPS.relation);
      ctx.politics.relations = ctx.politics.relations ?? {};
      ctx.politics.relations[key] = clamp(before + delta, -100, 100);
      const actual = ctx.politics.relations[key] - before;
      if (Math.abs(actual) >= 0.5) parts.push("部门关系 " + signed(actual));
    }
  }

  // 灾害压力
  if (effects.hazardStress != null && Number.isFinite(effects.hazardStress) && ctx.hazards) {
    const delta = clamp(effects.hazardStress, -EVENT_EFFECT_CAPS.hazardStress, EVENT_EFFECT_CAPS.hazardStress);
    const before = finite(ctx.hazards.stress, 0);
    ctx.hazards.stress = clamp(before + delta, 0, 100);
    const actual = ctx.hazards.stress - before;
    if (Math.abs(actual) >= 0.5) parts.push("灾害压力 " + signed(actual));
  }

  // 世界标记
  if (effects.flags && effects.flags.length > 0) {
    if (!Array.isArray(state.flags)) state.flags = [];
    const added: string[] = [];
    for (const flag of effects.flags) {
      if (typeof flag !== "string" || flag.length === 0) continue;
      if (!state.flags.includes(flag)) {
        state.flags.push(flag);
        added.push(flag);
      }
    }
    if (added.length > 0) parts.push("世界标记：" + added.join("、"));
  }
  if (effects.removeFlags && effects.removeFlags.length > 0 && Array.isArray(state.flags)) {
    const removed = new Set(effects.removeFlags);
    state.flags = state.flags.filter((flag) => !removed.has(flag));
  }

  // 概率修正（tag → 乘数，逐回合衰减）
  if (effects.influence) {
    if (!state.modifiers || typeof state.modifiers !== "object") state.modifiers = {};
    const touched: string[] = [];
    for (const [tag, rawMultiplier] of Object.entries(effects.influence)) {
      if (!Number.isFinite(rawMultiplier) || rawMultiplier <= 0) continue;
      const multiplier = clamp(rawMultiplier, 0.2, 3);
      const existing = state.modifiers[tag] ?? 1;
      state.modifiers[tag] = clamp(existing * multiplier, 0.1, 4);
      touched.push((TAG_LABELS[tag] ?? tag) + " ×" + round2(multiplier));
    }
    if (touched.length > 0) parts.push("余波：" + touched.slice(0, 2).join("、"));
  }

  const summary = parts.length > 0 ? parts.join(" · ") : "无直接数值影响，但世界记住了这次选择。";
  const severity =
    negativity >= 3 ? "critical" : negativity >= 1 ? "warning" : effects.flags && effects.flags.length > 0 ? "success" : "info";
  logs.push({ category: "event", severity, message: "事件后果：" + summary });
  return { summary, logs, applied: effects };
}

/** 选项效果 → UI 预览关键词（不泄露隐藏概率）。 */
export function effectKeywords(effects: EventEffects | null | undefined): string[] {
  if (!effects) return [];
  const out: string[] = [];
  if (effects.populationPct != null && effects.populationPct !== 0) {
    out.push("人口 " + (effects.populationPct > 0 ? "上升" : "下降"));
  }
  if (effects.population != null && effects.population !== 0) {
    out.push("人口 " + (effects.population > 0 ? "上升" : "下降"));
  }
  if (effects.stability != null && effects.stability !== 0) {
    out.push("稳定度 " + (effects.stability > 0 ? "上升" : "下降"));
  }
  if (effects.resources) {
    for (const [id, delta] of Object.entries(effects.resources)) {
      if (delta == null || delta === 0) continue;
      out.push(resourceName(id) + (delta > 0 ? " 增加" : " 减少"));
    }
  }
  if (effects.science != null && effects.science !== 0) out.push("科研点 " + (effects.science > 0 ? "增加" : "减少"));
  if (effects.capital != null && effects.capital !== 0) out.push("政治资本 " + (effects.capital > 0 ? "增加" : "减少"));
  if (effects.hazardStress != null && effects.hazardStress !== 0) out.push("灾害压力变化");
  if (effects.relation) out.push("部门关系变化");
  if (effects.flags && effects.flags.length > 0) out.push("改变世界局势");
  if (effects.influence) {
    const tags = Object.keys(effects.influence).slice(0, 2).map((tag) => TAG_LABELS[tag] ?? tag);
    if (tags.length > 0) out.push("后续：" + tags.join("、") + " 更容易发生");
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  结算
 * ------------------------------------------------------------------ */

function pickFollowUp(
  state: EventState,
  def: GameEventDef,
  ctx: EventContext,
  turn: number,
): ScheduledEvent | null {
  const options = (def.followUps ?? []).filter((item: EventFollowUpDef) => {
    if (!item || typeof item.eventId !== "string") return false;
    if (!getEventDef(item.eventId)) return false;
    return checkRequirements(item.requirements, ctx, state).ok;
  });
  if (options.length === 0) return null;
  const rng = new Rng(hashString(seedOf(state) + "|followup|" + def.id + "|" + turn + "|" + state.triggeredTotal));
  const weights = options.map((item) => (Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = rng.next() * total;
  let target = options[options.length - 1];
  for (let i = 0; i < options.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) {
      target = options[i];
      break;
    }
  }
  const declared = target.delayTurns != null && Number.isFinite(target.delayTurns) ? target.delayTurns : 2;
  const delay = clamp(Math.round(declared), 1, 4);
  const targetDef = getEventDef(target.eventId);
  const entry: ScheduledEvent = {
    eventId: target.eventId,
    dueTurn: turn + delay,
    weight: Number.isFinite(target.weight) && target.weight > 0 ? target.weight : 1,
    fromEventId: def.id,
    label: targetDef ? targetDef.title : target.eventId,
  };
  const queue = queueOf(state);
  queue.push(entry);
  if (queue.length > MAX_CHAIN_QUEUE) queue.splice(0, queue.length - MAX_CHAIN_QUEUE);
  return entry;
}

/**
 * 结算当前待处理事件的一个选项。
 * 成功后：写入 civ / politics / hazards、追加历史、设置冷却、排期后续事件、清空 pending。
 * 失败时 pending 保持不变（玩家可以重新选择）。
 */
export function resolveEventChoice(state: EventState, choiceId: string, ctx: EventContext): EventResolution {
  const failure = (reason: string): EventResolution => ({
    ok: false,
    reason,
    def: null,
    choice: null,
    outcome: "",
    effectsSummary: "",
    logs: [],
    followUp: null,
    historyEntry: null,
    effects: null,
  });
  if (!state || !ctx || !ctx.civ) return failure("缺少事件上下文");
  if (!Array.isArray(state.pending)) state.pending = [];
  const pending = state.pending[0];
  if (!pending) return failure("当前没有待处理事件");
  const def = getEventDef(pending.defId);
  if (!def) {
    state.pending = [];
    return failure("事件定义缺失：" + pending.defId);
  }
  const choice = def.choices.find((item) => item.id === choiceId);
  if (!choice) return failure("事件《" + def.title + "》没有选项 " + choiceId);
  const available = isChoiceAvailable(choice, ctx, state);
  if (!available.ok) return failure("该选项当前不可选：" + (available.reason ?? "条件不足"));

  const turn = normalizeTurn(ctx.turn);
  advanceEventClock(state, turn);
  const applied = applyEventEffects(state, def, choice, ctx);

  const year = yearOf(ctx);
  const entry: EventHistoryEntry = {
    id: Math.max(1, Math.floor(finite(state.nextHistoryId, 1))),
    defId: def.id,
    title: def.title,
    category: def.category,
    turn,
    year,
    choiceId: choice.id,
    choiceLabel: choice.label,
    outcome: choice.outcome,
    illustration: def.illustration,
    effectsSummary: applied.summary,
  };
  state.nextHistoryId = entry.id + 1;
  state.history.push(entry);
  if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);

  const cooldownTurns = Math.max(0, Math.round(finite(def.cooldownTurns ?? 0, 0)));
  if (!def.repeatable) {
    state.cooldowns[def.id] = Math.max(state.cooldowns[def.id] ?? 0, turn + 1);
  } else if (cooldownTurns > 0) {
    state.cooldowns[def.id] = Math.max(state.cooldowns[def.id] ?? 0, turn + cooldownTurns);
  }

  const followUp = pickFollowUp(state, def, ctx, turn);
  state.pending = [];

  const logs: EventLog[] = [
    {
      category: "event",
      severity: "info",
      message: "《" + def.title + "》你选择了「" + choice.label + "」。" + choice.outcome,
    },
    ...applied.logs,
  ];
  if (followUp) {
    logs.push({
      category: "event",
      severity: "info",
      message: "事件链延续：世界正在把这次选择推向下一幕。",
    });
  }
  return {
    ok: true,
    reason: null,
    def,
    choice,
    outcome: choice.outcome,
    effectsSummary: applied.summary,
    logs,
    followUp,
    historyEntry: entry,
    effects: choice.effects,
  };
}

/* ------------------------------------------------------------------ *
 *  视图辅助
 * ------------------------------------------------------------------ */

/** 当前待处理事件的定义；没有则 null。 */
export function getActiveEvent(state: EventState | null | undefined): GameEventDef | null {
  if (!state || !Array.isArray(state.pending) || state.pending.length === 0) return null;
  return getEventDef(state.pending[0].defId);
}

export interface EventModifierView {
  label: string;
  multiplier: number;
  tone: "up" | "down";
}

/**
 * 玩家可见的概率修正：tag 修正 + 上一事件的事件链余波。
 * 直接对应 viewTypes.EventsView.modifiers。
 */
export function eventModifiersView(state: EventState | null | undefined): EventModifierView[] {
  if (!state) return [];
  const out: EventModifierView[] = [];
  if (state.modifiers && typeof state.modifiers === "object") {
    for (const tag of Object.keys(state.modifiers)) {
      const raw = state.modifiers[tag];
      if (!Number.isFinite(raw) || Math.abs(raw - 1) < 0.02) continue;
      out.push({
        label: TAG_LABELS[tag] ?? tag,
        multiplier: round2(clamp(raw, 0.1, 4)),
        tone: raw >= 1 ? "up" : "down",
      });
    }
  }
  const memory = Array.isArray(state.lastEventIds) ? state.lastEventIds.slice(-2) : [];
  for (let i = memory.length - 1; i >= 0; i--) {
    const id = memory[i];
    const def = getEventDef(id);
    const table = CHAIN_INFLUENCE[id];
    if (!def || !table) continue;
    const values = Object.values(table).filter((value) => Number.isFinite(value) && value > 0);
    if (values.length === 0) continue;
    const geometric = Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
    if (Math.abs(geometric - 1) < 0.02) continue;
    out.push({
      label: "余波 · " + def.title,
      multiplier: round2(clamp(geometric, 0.2, 3)),
      tone: geometric >= 1 ? "up" : "down",
    });
  }
  out.sort((a, b) => Math.abs(b.multiplier - 1) - Math.abs(a.multiplier - 1));
  return out.slice(0, 8);
}

/** 已排期的事件链（UI / 调试用）。 */
export function scheduledEventsView(state: EventState | null | undefined): ScheduledEvent[] {
  if (!state || !Array.isArray(state.chainQueue)) return [];
  return state.chainQueue.slice();
}
