/**
 * 随机事件系统 v3 测试（docs/EXPANSION_V3.md §2）。
 *
 * 覆盖：内容完整性（60+ / 8 类 / E1–E5 / 文本长度 / 插图路径 / 选项与效果上限）、
 * requirements、概率修正（tag modifiers / 衰减 / CHAIN_INFLUENCE / 重复衰减 / 冷却）、
 * 事件链 followUp 延迟、历史记录、seed 可复现、无数值泄漏、pending 上限与不灭国。
 */
import { describe, expect, it } from "vitest";
import type {
  CivilizationState,
  EventState,
  MinisterState,
  PoliticsState,
  ResourceId,
  TechState,
} from "../../src/core/types";
import { createCivilizationState, BASE_RESOURCE_CAPACITY, RESOURCE_IDS } from "../../src/civilization";
import { createTechState } from "../../src/technology";
import { BASE_YEARS_PER_SECOND, TURN_YEARS } from "../../src/core/constants";
import { createHazardState } from "../../src/events/hazards";
import { EVENT_CATEGORY_NAMES, EVENT_DEFS, getEventDef } from "../../src/events/definitions";
import {
  CHAIN_INFLUENCE,
  EVENT_EFFECT_CAPS,
  EVENT_INTERVAL_MAX,
  EVENT_INTERVAL_MIN,
  EVENT_OUTCOME_DELAY_SECONDS,
  MAX_PENDING_EVENTS,
  acknowledgeEventOutcome,
  forecastEventEffects,
  updateEventOutcome,
  MODIFIER_DECAY,
  applyEventEffects,
  checkRequirements,
  createEventState,
  eligibleEvents,
  eventAvailable,
  eventCandidates,
  eventModifiersView,
  getActiveEvent,
  isChoiceAvailable,
  maybeTriggerEvent,
  resolveEventChoice,
  scheduledEventsView,
} from "../../src/events/system";
import type { EventContext, EventResolution } from "../../src/events/system";
import { forecastEffectBands } from "../../src/events/outcome-ranges";

const CATEGORIES = Object.keys(EVENT_CATEGORY_NAMES);
const TEST_SEED = "EVENTS-TEST-SEED";

function makePolitics(capital = 30): PoliticsState {
  const emptyMinisters = {
    administration: null,
    science: null,
    industry: null,
    agriculture: null,
    defense: null,
    observation: null,
  } as Record<string, MinisterState | null>;
  return {
    ministers: emptyMinisters as PoliticsState["ministers"],
    candidates: [],
    nextId: 1,
    factions: {
      technocrats: { influence: 20, satisfaction: 50 },
      militarists: { influence: 20, satisfaction: 50 },
      agrarians: { influence: 20, satisfaction: 50 },
      industrialists: { influence: 20, satisfaction: 50 },
      scholars: { influence: 20, satisfaction: 50 },
    },
    relations: {},
    capital,
    capitalRate: 3,
    lastSummitTurn: 0,
    history: [],
    nextHistoryId: 1,
  };
}

interface CtxPatch {
  era?: number;
  turn?: number;
  year?: number;
  population?: number;
  stability?: number;
  researched?: string[];
  resources?: Partial<Record<ResourceId, number>>;
  politics?: PoliticsState | null;
  randomSeed?: string;
  difficulty?: EventContext["difficulty"];
}

function makeCtx(patch: CtxPatch = {}): EventContext {
  const civ: CivilizationState = createCivilizationState({
    difficulty: patch.difficulty ?? "normal",
    mode: "normal",
    seed: TEST_SEED,
  });
  civ.era = patch.era ?? 3;
  civ.population = patch.population ?? 2000;
  if (patch.stability != null) civ.stability = patch.stability;
  if (patch.resources) {
    for (const id of RESOURCE_IDS) {
      const wanted = patch.resources[id];
      if (wanted == null) continue;
      const stock = civ.resources[id];
      stock.capacity = Math.max(stock.capacity, wanted);
      stock.amount = Math.max(0, wanted);
    }
  }
  const tech: TechState = createTechState();
  tech.researched = patch.researched ? [...patch.researched] : [];
  const turn = patch.turn ?? 0;
  return {
    civ,
    tech,
    politics: patch.politics === undefined ? makePolitics() : patch.politics,
    era: civ.era,
    turn,
    year: patch.year ?? turn * 0.5,
    difficulty: patch.difficulty ?? "normal",
    randomSeed: patch.randomSeed ?? TEST_SEED,
  };
}

/** 强制下一次抽签立即发生（只用于测试）。 */
function forceDue(state: EventState, turn: number): void {
  state.nextRollTurn = turn;
}

function resolveAnyAvailable(state: EventState, ctx: EventContext): EventResolution {
  const def = getActiveEvent(state);
  if (!def) throw new Error("没有待处理事件");
  for (const choice of def.choices) {
    const result = resolveEventChoice(state, choice.id, ctx);
    if (result.ok) {
      finishOutcome(state);
      return result;
    }
  }
  throw new Error("事件《" + def.title + "》没有任何可用选项");
}

/** 测试中跳过 30 秒等待：直接生成报告并确认，便于继续下一轮抽签。 */
function finishOutcome(state: EventState): void {
  if (state.pendingOutcome) {
    updateEventOutcome(state, state.pendingOutcome.dueElapsedSeconds + 0.001);
  }
  acknowledgeEventOutcome(state);
}

function collectNumbers(value: unknown, path: string, out: string[]): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.push(path + " = " + String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNumbers(item, path + "[" + index + "]", out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collectNumbers(item, path + "." + key, out);
    }
  }
}

describe("事件内容完整性", () => {
  it("事件数量 ≥ 60、id 唯一、8 类全覆盖", () => {
    expect(EVENT_DEFS.length).toBeGreaterThanOrEqual(60);
    const ids = EVENT_DEFS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of EVENT_DEFS) {
      expect(def.id.length, def.id).toBeGreaterThan(2);
      expect(CATEGORIES, def.id).toContain(def.category);
      expect(EVENT_CATEGORY_NAMES[def.category].length, def.id).toBeGreaterThan(0);
    }
  });

  it("E1–E5 每个时代都有可出场事件", () => {
    for (let era = 1; era <= 5; era++) {
      const ctx = makeCtx({ era });
      const defs = eligibleEvents(ctx);
      expect(defs.length, "第 " + era + " 时代无事件").toBeGreaterThanOrEqual(4);
    }
  });

  it("文本规格：short 20–40 字、body 120–220 字、无占位符", () => {
    const problems: string[] = [];
    const placeholder = /TODO|lorem|占位|待补|TBD|xxx/i;
    for (const def of EVENT_DEFS) {
      const shortLen = Array.from(def.short).length;
      const bodyLen = Array.from(def.body).length;
      if (shortLen < 20 || shortLen > 40) problems.push(def.id + " short=" + shortLen);
      if (bodyLen < 120 || bodyLen > 220) problems.push(def.id + " body=" + bodyLen);
      if (def.longBody != null) {
        const longLen = Array.from(def.longBody).length;
        if (longLen < 250 || longLen > 450) problems.push(def.id + " longBody=" + longLen);
      }
      if (def.title.length < 2) problems.push(def.id + " 标题过短");
      if (placeholder.test(def.title + def.short + def.body + (def.flavor ?? ""))) {
        problems.push(def.id + " 含占位文本");
      }
      if (def.illustration !== "events/" + def.id + ".jpg") problems.push(def.id + " 插图路径错误");
    }
    expect(problems.join("\n")).toBe("");
  });

  it("每事件 2–3 个选择：字段齐全、id 不重复、outcome 完整", () => {
    for (const def of EVENT_DEFS) {
      expect(def.choices.length, def.id).toBeGreaterThanOrEqual(2);
      expect(def.choices.length, def.id).toBeLessThanOrEqual(3);
      const choiceIds = def.choices.map((choice) => choice.id);
      expect(new Set(choiceIds).size, def.id + " 选项 id 重复").toBe(choiceIds.length);
      for (const choice of def.choices) {
        expect(choice.label.length, def.id + "/" + choice.id).toBeGreaterThan(1);
        expect(choice.description.length, def.id + "/" + choice.id).toBeGreaterThan(6);
        expect(choice.outcome.length, def.id + "/" + choice.id).toBeGreaterThan(12);
        expect(choice.effects, def.id + "/" + choice.id).toBeTruthy();
      }
    }
  });

  it("效果数值合法且不超过上限（人口 8% / 稳定 12 / 资源 8% / 资本 15）", () => {
    const problems: string[] = [];
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices) {
        const effects = choice.effects;
        const label = def.id + "/" + choice.id;
        if (effects.stability != null) {
          if (!Number.isFinite(effects.stability)) problems.push(label + " stability 非有限");
          else if (Math.abs(effects.stability) > EVENT_EFFECT_CAPS.stability) problems.push(label + " stability 超限");
        }
        if (effects.populationPct != null) {
          if (!Number.isFinite(effects.populationPct)) problems.push(label + " populationPct 非有限");
          else if (Math.abs(effects.populationPct) > EVENT_EFFECT_CAPS.populationPct) {
            problems.push(label + " populationPct 超限");
          }
        }
        if (effects.population != null) {
          if (!Number.isFinite(effects.population)) problems.push(label + " population 非有限");
          else if (Math.abs(effects.population) > 2000 * EVENT_EFFECT_CAPS.populationPct) {
            problems.push(label + " population 超限");
          }
        }
        if (effects.capital != null) {
          if (!Number.isFinite(effects.capital)) problems.push(label + " capital 非有限");
          else if (Math.abs(effects.capital) > EVENT_EFFECT_CAPS.capital) problems.push(label + " capital 超限");
        }
        if (effects.science != null && !Number.isFinite(effects.science)) problems.push(label + " science 非有限");
        if (effects.resources) {
          for (const [id, delta] of Object.entries(effects.resources)) {
            if (delta == null) continue;
            if (!Number.isFinite(delta)) {
              problems.push(label + " " + id + " 非有限");
              continue;
            }
            const cap = BASE_RESOURCE_CAPACITY[id as ResourceId] * EVENT_EFFECT_CAPS.resourcePct;
            if (Math.abs(delta) > cap) problems.push(label + " " + id + " 超出 " + cap);
          }
        }
        if (effects.influence) {
          for (const [tag, multiplier] of Object.entries(effects.influence)) {
            if (!Number.isFinite(multiplier)) problems.push(label + " influence " + tag + " 非有限");
            else if (multiplier < 0.2 || multiplier > 3) problems.push(label + " influence " + tag + " 超出 0.2–3");
          }
        }
      }
    }
    expect(problems.join("\n")).toBe("");
  });

  it("followUps 引用真实事件、delay 1–4、事件链 ≥ 15 条", () => {
    const ids = new Set(EVENT_DEFS.map((def) => def.id));
    let edges = 0;
    const problems: string[] = [];
    for (const def of EVENT_DEFS) {
      for (const follow of def.followUps ?? []) {
        edges += 1;
        if (!ids.has(follow.eventId)) problems.push(def.id + " → " + follow.eventId + " 不存在");
        if (follow.eventId === def.id) problems.push(def.id + " 自引用");
        const delay = follow.delayTurns ?? 2;
        if (delay < 1 || delay > 4) problems.push(def.id + " → " + follow.eventId + " delay=" + delay);
        if (!Number.isFinite(follow.weight) || follow.weight <= 0) problems.push(def.id + " → " + follow.eventId + " weight 非法");
      }
    }
    expect(problems.join("\n")).toBe("");
    expect(edges).toBeGreaterThanOrEqual(15);
  });

  it("CHAIN_INFLUENCE ≥25 条，引用真实 id，乘数合法", () => {
    const ids = new Set(EVENT_DEFS.map((def) => def.id));
    const entries = Object.entries(CHAIN_INFLUENCE);
    expect(entries.length).toBeGreaterThanOrEqual(25);
    const problems: string[] = [];
    for (const [from, table] of entries) {
      if (!ids.has(from)) problems.push("来源事件不存在：" + from);
      for (const [to, multiplier] of Object.entries(table)) {
        if (!ids.has(to)) problems.push(from + " → " + to + " 目标不存在");
        if (!Number.isFinite(multiplier) || multiplier < 0.2 || multiplier > 3) {
          problems.push(from + " → " + to + " 乘数非法");
        }
      }
    }
    expect(problems.join("\n")).toBe("");
  });

  it("requirements 合法：时代区间、科技 id、flag 有来源", () => {
    const era = (value: number | undefined) => (value == null ? null : Math.floor(value));
    const allFlags = new Set<string>();
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices) {
        for (const flag of choice.effects.flags ?? []) allFlags.add(flag);
      }
    }
    const problems: string[] = [];
    const checkReq = (req: typeof EVENT_DEFS[number]["requirements"], label: string) => {
      if (!req) return;
      if (req.minEra != null && (era(req.minEra) as number) < 1) problems.push(label + " minEra 非法");
      if (req.maxEra != null && (era(req.maxEra) as number) > 5) problems.push(label + " maxEra 非法");
      if (req.minEra != null && req.maxEra != null && req.minEra > req.maxEra) problems.push(label + " 时代区间倒置");
      for (const flag of req.flags ?? []) {
        if (!allFlags.has(flag)) problems.push(label + " 要求未生成的 flag：" + flag);
      }
    };
    for (const def of EVENT_DEFS) {
      checkReq(def.requirements, def.id);
      for (const choice of def.choices) checkReq(choice.requirements, def.id + "/" + choice.id);
    }
    expect(problems.join("\n")).toBe("");
  });

  it("eraMin/eraMax 覆盖 E1–E6 且互不矛盾", () => {
    for (const def of EVENT_DEFS) {
      expect(def.eraMin, def.id).toBeGreaterThanOrEqual(1);
      expect(def.eraMax, def.id).toBeLessThanOrEqual(6);
      expect(def.eraMin, def.id).toBeLessThanOrEqual(def.eraMax);
      expect(def.weight, def.id).toBeGreaterThan(0);
      expect(Number.isFinite(def.weight), def.id).toBe(true);
      expect(def.tags.length, def.id).toBeGreaterThan(0);
    }
  });
});

describe("初始状态与可复现性", () => {
  it("createEventState 初始化完整且同 seed 可复现", () => {
    const a = createEventState("SEED-REPRO");
    const b = createEventState("SEED-REPRO");
    expect(a).toEqual(b);
    expect(a.pending).toEqual([]);
    expect(a.history).toEqual([]);
    expect(a.flags).toEqual([]);
    expect(a.modifiers).toEqual({});
    expect(a.triggeredTotal).toBe(0);
    expect(a.nextRollTurn).toBeGreaterThanOrEqual(36);
    expect(a.nextRollTurn).toBeLessThanOrEqual(40);
    const c = createEventState("SEED-OTHER");
    expect(c.nextRollTurn).toBeGreaterThanOrEqual(1);
  });

  it("同 seed 同操作序列的触发结果完全一致", () => {
    const run = () => {
      const state = createEventState("REPRO-2");
      const ctx = makeCtx({ era: 2, randomSeed: "REPRO-2" });
      const ids: string[] = [];
      for (let turn = 1; turn <= 40; turn++) {
        ctx.turn = turn;
        ctx.year = turn * 0.5;
        const pending = maybeTriggerEvent(state, ctx);
        if (pending) {
          ids.push(pending.defId);
          resolveAnyAvailable(state, ctx);
        }
      }
      return ids;
    };
    expect(run()).toEqual(run());
  });
});

describe("概率修正衰减", () => {
  it("modifiers 向 1 衰减：1.8 在 30 回合无事件后回到 1.0±0.05（回归 lead 集成 bug）", () => {
    const state = createEventState("DECAY-REG");
    const ctx = makeCtx({ era: 2 });
    state.modifiers = { science: 1.8, meteor: 1.2, famine: 0.7 };
    state.modifierTurn = 0;
    // 连续 30 回合没有任何事件触发（把 nextRollTurn 推到很远），只推进时钟。
    state.nextRollTurn = 100000;
    for (let turn = 1; turn <= 30; turn++) {
      ctx.turn = turn;
      expect(maybeTriggerEvent(state, ctx)).toBeNull();
    }
    const science = state.modifiers.science ?? 1;
    const meteor = state.modifiers.meteor ?? 1;
    const famine = state.modifiers.famine ?? 1;
    expect(science).toBeGreaterThan(0.95);
    expect(science).toBeLessThan(1.05);
    expect(meteor).toBeGreaterThan(0.95);
    expect(meteor).toBeLessThan(1.05);
    expect(famine).toBeGreaterThan(0.95);
    expect(famine).toBeLessThan(1.05);
    // 中途不能被夹到 0.1 这种“永久压制”值
    const mid = createEventState("DECAY-MID");
    mid.modifiers = { science: 1.8 };
    mid.modifierTurn = 0;
    mid.nextRollTurn = 100000;
    ctx.turn = 1;
    maybeTriggerEvent(mid, ctx);
    expect(mid.modifiers.science).toBeGreaterThan(1.2);
    expect(mid.modifiers.science).toBeLessThan(1.6);
  });

  it("modifiers 不会压到 0.1 以下，也不会超过 4", () => {
    const state = createEventState("DECAY-CLAMP");
    const ctx = makeCtx({ era: 2 });
    state.nextRollTurn = 100000;
    state.modifiers = { famine: 6 };
    state.modifierTurn = 0;
    ctx.turn = 1;
    maybeTriggerEvent(state, ctx);
    expect(state.modifiers.famine).toBeLessThanOrEqual(4);
    state.modifiers = { famine: 0.01 };
    ctx.turn = 2;
    maybeTriggerEvent(state, ctx);
    const value = state.modifiers.famine ?? 1;
    expect(value).toBeGreaterThanOrEqual(0.1);
  });
});

describe("触发与结算", () => {
  it("节拍未到不触发；到期后触发且 pending 最多 1 个", () => {
    const state = createEventState("PACE");
    const ctx = makeCtx({ era: 2 });
    for (let turn = 0; turn < state.nextRollTurn; turn++) {
      ctx.turn = turn;
      expect(maybeTriggerEvent(state, ctx)).toBeNull();
    }
    ctx.turn = state.nextRollTurn;
    const pending = maybeTriggerEvent(state, ctx);
    expect(pending).not.toBeNull();
    expect(state.pending.length).toBe(MAX_PENDING_EVENTS);
    expect(getActiveEvent(state)?.id).toBe(pending?.defId);
    expect(maybeTriggerEvent(state, ctx)).toBeNull();
    expect(state.pending.length).toBe(MAX_PENDING_EVENTS);
  });

  it("结算写入 civ（资源/稳定度/人口）与历史，并清空 pending", () => {
    const state = createEventState("RESOLVE");
    const ctx = makeCtx({ era: 3, stability: 60, population: 2000 });
    forceDue(state, 0);
    const pending = maybeTriggerEvent(state, ctx);
    expect(pending).not.toBeNull();
    const beforePop = ctx.civ.population;
    const beforeStability = ctx.civ.stability;
    const result = resolveAnyAvailable(state, ctx);
    expect(result.ok).toBe(true);
    expect(result.def).not.toBeNull();
    expect(result.choice).not.toBeNull();
    expect(result.outcome.length).toBeGreaterThan(0);
    expect(state.pending).toEqual([]);
    expect(state.history.length).toBe(1);
    expect(state.history[0].defId).toBe(result.def?.id);
    expect(state.history[0].choiceLabel).toBe(result.choice?.label);
    expect(state.nextHistoryId).toBe(2);
    expect(Number.isFinite(ctx.civ.population)).toBe(true);
    expect(Number.isFinite(ctx.civ.stability)).toBe(true);
    expect(ctx.civ.stability).toBeGreaterThanOrEqual(0);
    expect(ctx.civ.stability).toBeLessThanOrEqual(100);
    expect(ctx.civ.population).toBeGreaterThan(0);
    expect(ctx.civ.population).not.toBe(beforePop);
    expect(result.logs.length).toBeGreaterThan(0);
    expect(ctx.civ.stability).not.toBe(beforeStability);
  });

  it("非法选项被拒绝且 pending 保留；无待处理事件时结算失败", () => {
    const state = createEventState("INVALID");
    const ctx = makeCtx({ era: 2 });
    const empty = resolveEventChoice(state, "nope", ctx);
    expect(empty.ok).toBe(false);
    expect(empty.reason).toContain("没有待处理事件");
    forceDue(state, 0);
    expect(maybeTriggerEvent(state, ctx)).not.toBeNull();
    const invalid = resolveEventChoice(state, "definitely-not-a-choice", ctx);
    expect(invalid.ok).toBe(false);
    expect(state.pending.length).toBe(1);
    expect(resolveAnyAvailable(state, ctx).ok).toBe(true);
  });
});

describe("概率与事件链机制", () => {
  it("tag modifiers 精确乘到候选权重上，并随回合向 1 回落", () => {
    const ctx = makeCtx({ era: 3 });
    const state = createEventState("MOD-WEIGHT");
    state.nextRollTurn = 100000;
    const target = eventCandidates(state, ctx).find((candidate) => candidate.def.tags.includes("famine"));
    expect(target).toBeTruthy();
    const base = target!.weight;
    state.modifiers = { famine: 1.8 };
    const boosted = eventCandidates(state, ctx).find((candidate) => candidate.def.id === target!.def.id)!;
    expect(boosted.tagMultiplier).toBeCloseTo(1.8, 6);
    expect(boosted.weight).toBeCloseTo(base * 1.8, 6);
    // 推进 2 回合（不触发事件）：1 + 0.8 * 0.65^2 = 1.338
    for (let turn = 1; turn <= 2; turn++) {
      ctx.turn = turn;
      maybeTriggerEvent(state, ctx);
    }
    const decayed = eventCandidates(state, ctx).find((candidate) => candidate.def.id === target!.def.id)!;
    expect(decayed.tagMultiplier).toBeCloseTo(1 + 0.8 * Math.pow(MODIFIER_DECAY, 2), 5);
  });

  it("CHAIN_INFLUENCE：上一事件显式提高/降低指定下一事件的权重", () => {
    const ctx = makeCtx({ era: 3 });
    const state = createEventState("CHAIN-WEIGHT");
    state.nextRollTurn = 100000;
    const pair = Object.entries(CHAIN_INFLUENCE).find(([from, table]) =>
      Object.keys(table).some((to) => getEventDef(to)?.eraMin === 2 || getEventDef(to)?.eraMin === 1),
    );
    expect(pair).toBeTruthy();
    const [from, table] = pair!;
    const to = Object.keys(table)[0];
    const targetDef = getEventDef(to);
    expect(targetDef).toBeTruthy();
    const before = eventCandidates(state, ctx).find((candidate) => candidate.def.id === to);
    if (!before) return; // 目标事件在当前时代/条件下不可出场则跳过（其余 id 由内容完整性测试保证）
    state.lastEventIds = [from];
    const after = eventCandidates(state, ctx).find((candidate) => candidate.def.id === to)!;
    expect(after.chainMultiplier).toBeCloseTo(table[to], 6);
    expect(after.weight).toBeCloseTo(before.weight * table[to], 6);
    // 上一事件不改变“可出场性”，只改变权重
    expect(eligibleEvents(ctx).some((def) => def.id === to)).toBe(true);
  });

  it("followUp 延迟 1–4 回合后以确定方式成链（resolve → chainQueue → 到期触发）", () => {
    const state = createEventState("CHAIN-DELAY");
    const ctx = makeCtx({ era: 2, turn: 5, year: 2.5 });
    const def = getEventDef("env_red_dawn")!;
    // 手动注入 pending，避免初始抽签节拍干扰事件链验证。
    state.nextRollTurn = 100000;
    state.pending = [{ defId: def.id, triggerTurn: 5, triggerYear: 2.5, context: "测试" }];
    const result = resolveEventChoice(state, "shelter", ctx);
    expect(result.ok).toBe(true);
    expect(result.followUp).not.toBeNull();
    const followUp = result.followUp!;
    expect(followUp.dueTurn - 5).toBeGreaterThanOrEqual(1);
    expect(followUp.dueTurn - 5).toBeLessThanOrEqual(4);
    expect(scheduledEventsView(state).length).toBe(1);
    expect(state.pending).toEqual([]);
    finishOutcome(state);
    // 到期前不触发后续事件
    for (let turn = 6; turn < followUp.dueTurn; turn++) {
      ctx.turn = turn;
      ctx.year = turn * 0.5;
      expect(maybeTriggerEvent(state, ctx)).toBeNull();
    }
    ctx.turn = followUp.dueTurn;
    ctx.year = followUp.dueTurn * 0.5;
    const pending = maybeTriggerEvent(state, ctx);
    expect(pending).not.toBeNull();
    expect(pending!.defId).toBe(followUp.eventId);
    expect(scheduledEventsView(state).length).toBe(0);
  });

  it("冷却与不可重复：事件结算后按 cooldownTurns 锁定，不可重复事件只出现一次", () => {
    const ctx = makeCtx({ era: 3 });
    const state = createEventState("COOLDOWN");
    const repeatable = getEventDef("env_red_dawn")!;
    state.nextRollTurn = 100000;
    state.seenCounts[repeatable.id] = 1;
    state.cooldowns[repeatable.id] = 20;
    ctx.turn = 10;
    const locked = eventAvailable(repeatable, state, ctx);
    expect(locked.ok).toBe(false);
    expect(locked.reason).toContain("冷却");
    ctx.turn = 21;
    expect(eventAvailable(repeatable, state, ctx).ok).toBe(true);
    const unique = getEventDef("soc_dehydrated_cult")!;
    expect(unique.repeatable).toBe(false);
    state.seenCounts[unique.id] = 1;
    const blocked = eventAvailable(unique, state, ctx);
    expect(blocked.ok).toBe(false);
  });

  it("重复衰减：seenCounts 增加时可重复事件权重按 0.55^n 下降且不低于 0.15", () => {
    const ctx = makeCtx({ era: 3 });
    const state = createEventState("REPEAT-DECAY");
    state.nextRollTurn = 100000;
    const def = getEventDef("env_red_dawn")!;
    state.seenCounts[def.id] = 2;
    const candidate = eventCandidates(state, ctx).find((item) => item.def.id === def.id)!;
    expect(candidate.repeatMultiplier).toBeCloseTo(Math.pow(0.55, 2), 6);
    state.seenCounts[def.id] = 20;
    const floor = eventCandidates(state, ctx).find((item) => item.def.id === def.id)!;
    expect(floor.repeatMultiplier).toBeCloseTo(0.15, 6);
  });

  it("选项 requirements：条件不足时拒绝且 pending 保留，条件满足后可结算", () => {
    const state = createEventState("CHOICE-REQ");
    const ctx = makeCtx({ era: 1, researched: [] });
    const def = getEventDef("env_red_dawn")!;
    state.pending = [{ defId: def.id, triggerTurn: 0, triggerYear: 0, context: "测试" }];
    const rejected = resolveEventChoice(state, "observe", ctx);
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toContain("科技");
    expect(state.pending.length).toBe(1);
    ctx.tech!.researched = ["astro_basic"];
    const accepted = resolveEventChoice(state, "observe", ctx);
    expect(accepted.ok).toBe(true);
    expect(state.pending).toEqual([]);
    // 时代门槛型选项
    const state2 = createEventState("CHOICE-ERA");
    const def2 = getEventDef("soc_dehydrated_cult")!;
    const ctx1 = makeCtx({ era: 1 });
    state2.pending = [{ defId: def2.id, triggerTurn: 0, triggerYear: 0, context: "测试" }];
    expect(resolveEventChoice(state2, "debate", ctx1).ok).toBe(false);
    const ctx2 = makeCtx({ era: 2 });
    state2.pending = [{ defId: def2.id, triggerTurn: 0, triggerYear: 0, context: "测试" }];
    expect(resolveEventChoice(state2, "debate", ctx2).ok).toBe(true);
  });

  it("applyEventEffects：越界数值被夹到上限，civ/politics/hazards 无 NaN", () => {
    const ctx = makeCtx({ era: 3, stability: 60, population: 2000, resources: { food: 300 } });
    ctx.politics = makePolitics(30);
    ctx.hazards = createHazardState();
    const state = createEventState("CLAMP");
    const def = getEventDef("haz_fire")!;
    const choice = {
      id: "absurd",
      label: "越界数值",
      description: "测试用",
      outcome: "测试用结果文案。",
      effects: {
        resources: { food: -99999 },
        stability: -999,
        populationPct: -9,
        capital: -999,
        science: 999999,
        hazardStress: 999,
        influence: { famine: 99 },
      },
    } as Parameters<typeof applyEventEffects>[2];
    const beforePop = ctx.civ.population;
    const report = applyEventEffects(state, def, choice, ctx);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(ctx.civ.resources.food.amount).toBeGreaterThanOrEqual(0);
    expect(ctx.civ.stability).toBeGreaterThanOrEqual(0);
    expect(ctx.civ.stability).toBeGreaterThanOrEqual(60 - EVENT_EFFECT_CAPS.stability - 1e-9);
    expect(ctx.civ.population).toBeGreaterThanOrEqual(beforePop * (1 - EVENT_EFFECT_CAPS.populationPct) - 1);
    expect(ctx.politics!.capital).toBeGreaterThanOrEqual(30 - EVENT_EFFECT_CAPS.capital);
    expect(ctx.hazards!.stress).toBeLessThanOrEqual(50 + EVENT_EFFECT_CAPS.hazardStress);
    expect(state.modifiers.famine).toBeLessThanOrEqual(4);
    expect(Number.isFinite(ctx.hazards!.stress)).toBe(true);
    const bad: string[] = [];
    collectNumbers(ctx.civ, "civ", bad);
    collectNumbers(ctx.politics!, "politics", bad);
    expect(bad.join("\n")).toBe("");
  });

  it("flags：选择写入/移除世界标记，requirements 能立即读到", () => {
    const state = createEventState("FLAGS");
    const ctx = makeCtx({ era: 2 });
    const def = getEventDef("sci_star_anomaly")!;
    state.pending = [{ defId: def.id, triggerTurn: 0, triggerYear: 0, context: "测试" }];
    const result = resolveEventChoice(state, "seal", ctx);
    expect(result.ok).toBe(true);
    expect(state.flags).toContain("star_anomaly_kept");
    expect(checkRequirements({ flags: ["star_anomaly_kept"] }, ctx, state).ok).toBe(true);
    expect(checkRequirements({ notFlags: ["star_anomaly_kept"] }, ctx, state).ok).toBe(false);
    // removeFlags 路径
    const removal = getEventDef("sci_star_anomaly")!;
    const effects = removal.choices.find((choice) => choice.id === "seal")!.effects;
    expect(effects.flags).toContain("star_anomaly_kept");
  });

  it("eventModifiersView：中文标签 / 有限倍率 / up-down 倾向 / 最多 8 条并按强度排序", () => {
    const state = createEventState("MOD-VIEW");
    state.modifiers = { famine: 1.8, science: 0.7, cold: 1.2 };
    state.lastEventIds = ["env_red_dawn", "haz_solar_flare"];
    const view = eventModifiersView(state);
    expect(view.length).toBeGreaterThan(0);
    expect(view.length).toBeLessThanOrEqual(8);
    for (const entry of view) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(Number.isFinite(entry.multiplier)).toBe(true);
      expect(["up", "down"]).toContain(entry.tone);
      expect(entry.multiplier).toBeGreaterThanOrEqual(0.2);
      expect(entry.multiplier).toBeLessThanOrEqual(3);
    }
    for (let i = 1; i < view.length; i++) {
      expect(Math.abs(view[i - 1].multiplier - 1)).toBeGreaterThanOrEqual(Math.abs(view[i].multiplier - 1));
    }
    // 空状态安全
    expect(eventModifiersView(null)).toEqual([]);
    expect(eventModifiersView(createEventState("EMPTY"))).toEqual([]);
  });

  it("pending 上下文与触发年份被正确填写", () => {
    const state = createEventState("PENDING-META");
    const ctx = makeCtx({ era: 2, turn: 8, year: 4 });
    state.nextRollTurn = 8;
    const pending = maybeTriggerEvent(state, ctx);
    expect(pending).not.toBeNull();
    expect(pending!.triggerTurn).toBe(8);
    expect(pending!.triggerYear).toBe(4);
    expect(pending!.context).toContain("回合");
    expect(pending!.context.length).toBeGreaterThan(6);
  });

  it("长时间模拟（90 回合）：pending ≤1、无 NaN、人口不灭、修正不会被永久压到 0.1", () => {
    const state = createEventState("LONG-RUN");
    const ctx = makeCtx({ era: 3, population: 2600, stability: 62, randomSeed: "LONG-RUN" });
    let resolved = 0;
    for (let turn = 1; turn <= 90; turn++) {
      ctx.turn = turn;
      ctx.year = turn * 0.5;
      const pending = maybeTriggerEvent(state, ctx);
      if (pending) {
        expect(state.pending.length).toBeLessThanOrEqual(1);
        resolveAnyAvailable(state, ctx);
        resolved += 1;
      }
      expect(state.pending.length).toBeLessThanOrEqual(1);
      for (const multiplier of Object.values(state.modifiers)) {
        expect(Number.isFinite(multiplier)).toBe(true);
        expect(multiplier).toBeGreaterThanOrEqual(0.1);
        expect(multiplier).toBeLessThanOrEqual(4);
        // 向 1 衰减：保留下来的修正不应恰好卡在 0.1
        if (Math.abs(multiplier - 1) > 0.02) expect(multiplier).toBeGreaterThan(0.1);
      }
    }
    expect(resolved).toBeGreaterThan(0);
    expect(state.triggeredTotal).toBeGreaterThanOrEqual(resolved);
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.history.length).toBeLessThanOrEqual(80);
    expect(ctx.civ.population).toBeGreaterThan(0);
    expect(ctx.civ.stability).toBeGreaterThanOrEqual(0);
    expect(ctx.civ.stability).toBeLessThanOrEqual(100);
    expect(state.modifiers.famine ?? 1).toBeGreaterThan(0.5);
    const bad: string[] = [];
    collectNumbers(ctx.civ, "civ", bad);
    collectNumbers(state, "events", bad);
    expect(bad.join("\n")).toBe("");
    // 历史 id 单调递增
    for (let i = 1; i < state.history.length; i++) {
      expect(state.history[i].id).toBeGreaterThan(state.history[i - 1].id);
    }
  });
});


describe("v1.5 事件节奏 / 量化 / 30 秒延迟结算", () => {
  it("间隔约 90 秒（1x 下 44–48 回合），且难度/时代修正后仍在合理范围", () => {
    const minSeconds = EVENT_INTERVAL_MIN * TURN_YEARS / BASE_YEARS_PER_SECOND;
    const maxSeconds = EVENT_INTERVAL_MAX * TURN_YEARS / BASE_YEARS_PER_SECOND;
    expect(minSeconds).toBeGreaterThanOrEqual(85);
    expect(maxSeconds).toBeLessThanOrEqual(100);
    expect(EVENT_OUTCOME_DELAY_SECONDS).toBe(30);
  });

  it("选择前区间覆盖实际结算，且同 seed 可复现（v1.6 范围结算）", () => {
    const run = () => {
      const ctx = makeCtx({ era: 2, stability: 60, population: 1200 });
      ctx.elapsedRealSeconds = 12;
      const state = createEventState("FORECAST");
      const def = getEventDef("env_red_dawn")!;
      state.pending = [{ defId: def.id, triggerTurn: 0, triggerYear: 0, context: "测试" }];
      const choice = def.choices.find((item) => item.id === "shelter")!;
      // v1.6：选择前只展示区间；结算在区间内确定性取值，不再等于精确中心值。
      const bands = forecastEffectBands(choice.effects, ctx, state, def.category, forecastEventEffects);
      const foodBand = bands.find((band) => band.key === "resource:food")!;
      const stabilityBand = bands.find((band) => band.key === "stability")!;
      expect(foodBand.deltaMin).not.toBeNull();
      expect(foodBand.deltaMax).not.toBeNull();
      expect(foodBand.deltaMin!).toBeLessThan(foodBand.deltaMax!);
      const beforeFood = ctx.civ.resources.food.amount;
      const beforeStability = ctx.civ.stability;
      expect(resolveEventChoice(state, "shelter", ctx).ok).toBe(true);
      const actualFood = ctx.civ.resources.food.amount - beforeFood;
      const actualStability = ctx.civ.stability - beforeStability;
      // 实际结算值必须落在玩家选择前看到的区间内
      expect(actualFood).toBeGreaterThanOrEqual(foodBand.deltaMin! - 1e-6);
      expect(actualFood).toBeLessThanOrEqual(foodBand.deltaMax! + 1e-6);
      expect(actualStability).toBeGreaterThanOrEqual(stabilityBand.deltaMin! - 1e-6);
      expect(actualStability).toBeLessThanOrEqual(stabilityBand.deltaMax! + 1e-6);
      // 30 秒结算报告与真实落地使用同一套数字
      expect(state.pendingOutcome).not.toBeNull();
      const reportFood = state.pendingOutcome!.effects.find((effect) => effect.key === "resource:food")!;
      const reportStability = state.pendingOutcome!.effects.find((effect) => effect.key === "stability")!;
      // 报告数值保留两位小数，与真实落地允许 0.01 级舍入差
      expect(reportFood.delta).toBeCloseTo(actualFood, 2);
      expect(reportStability.delta).toBeCloseTo(actualStability, 2);
      expect(state.pendingOutcome!.effects.some((effect) => effect.kind === "influence")).toBe(true);
      return { actualFood, actualStability };
    };
    const first = run();
    const second = run();
    // 同一 seed + 同一操作序列 => 同一实际结算
    expect(first).toEqual(second);
  });

  it("选择后 30 秒才生成报告；报告未确认前不会抽取新事件", () => {
    const ctx = makeCtx({ era: 2 });
    ctx.elapsedRealSeconds = 100;
    const state = createEventState("DELAY");
    const def = getEventDef("env_red_dawn")!;
    state.pending = [{ defId: def.id, triggerTurn: 3, triggerYear: 1.5, context: "测试" }];
    state.pendingOutcome = null;
    const result = resolveEventChoice(state, "shelter", ctx);
    expect(result.ok).toBe(true);
    expect(state.pendingOutcome).not.toBeNull();
    expect(state.pendingOutcome!.dueElapsedSeconds).toBeCloseTo(130, 5);
    expect(updateEventOutcome(state, 129.9)).toBeNull();
    expect(updateEventOutcome(state, 130)).not.toBeNull();
    expect(state.outcomeReport).not.toBeNull();
    expect(state.outcomeReport!.effects.length).toBeGreaterThan(0);
    finishOutcome(state);
    expect(state.outcomeReport).toBeNull();
    expect(state.pendingOutcome).toBeNull();
  });

  it("acknowledgeEventOutcome 幂等；无报告时安全", () => {
    const state = createEventState("ACK");
    expect(acknowledgeEventOutcome(state)).toBe(false);
    state.outcomeReport = {
      id: 1, defId: "env_red_dawn", title: "t", category: "environment", choiceId: "shelter",
      choiceLabel: "c", outcome: "o", turn: 0, year: 0, dueElapsedSeconds: 30, resolvedElapsedSeconds: 30,
      summary: "s", effects: [], followUpTitle: null,
    };
    expect(acknowledgeEventOutcome(state)).toBe(true);
    expect(acknowledgeEventOutcome(state)).toBe(false);
  });
});
