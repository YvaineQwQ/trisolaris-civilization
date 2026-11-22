/**
 * v1.6 事件范围结算 + 编年史测试。
 *
 * 覆盖：
 *  - outcome-ranges：区间上下界、历史/难度修正、确定性 roll 可复现；
 *  - 审计 auditEventLogic：已知坏数据（时代倒置 / 悬空 followUp / 逻辑谬误）；
 *  - chronicle：死亡与人口骤降识别、重大事件（时代推进 / 重灾 / 危机 / 科技）、
 *    过滤、排序、不编造数据、ViewModel 派生；
 *  - event-drawer 纯函数：区间文本与兜底区间（不依赖被科技线修改的六时代）。
 */
import { describe, expect, it } from "vitest";
import type { CivilizationState, EventState, PoliticsState } from "../../src/core/types";
import { createCivilizationState } from "../../src/civilization";
import { createHazardState } from "../../src/events/hazards";
import { EVENT_DEFS, getEventDef } from "../../src/events/definitions";
import { forecastEventEffects } from "../../src/events/system";
import type { EventContext } from "../../src/events/system";
import {
  auditEventLogic,
  forecastEffectBands,
  historyBandOptions,
  rollEventEffects,
} from "../../src/events/outcome-ranges";
import type { BandContext } from "../../src/events/outcome-ranges";
import {
  CHRONICLE_FILTER_PRESETS,
  chronicleKindCounts,
  chronicleSignature,
  chronicleYears,
  deriveChronicle,
  deriveChronicleFromView,
  filterChronicle,
  mentionsDeath,
} from "../../src/events/chronicle";
import type { ChronicleSource } from "../../src/events/chronicle";
import {
  drawerBandsForChoice,
  fallbackBandsFromEffects,
  formatBandRange,
  formatDrawerBand,
} from "../../src/ui/event-drawer";

const TEST_SEED = "EVENTS-V6-RANGE";

function makePolitics(): PoliticsState {
  const ministers = {
    administration: null, science: null, industry: null,
    agriculture: null, defense: null, observation: null,
  } as unknown as PoliticsState["ministers"];
  return {
    ministers,
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
    capital: 30,
    capitalRate: 3,
    lastSummitTurn: 0,
    history: [],
    nextHistoryId: 1,
  };
}

/** 不依赖六时代改动：只使用 1–5 的既有 era 值构造上下文。 */
function makeCtx(era = 3): EventContext {
  const civ: CivilizationState = createCivilizationState({ difficulty: "normal", mode: "normal", seed: TEST_SEED });
  civ.era = era;
  civ.population = 2000;
  civ.stability = 60;
  return {
    civ,
    tech: null,
    politics: makePolitics(),
    hazards: createHazardState(),
    era: civ.era,
    turn: 12,
    year: 2200,
    difficulty: "normal",
    randomSeed: TEST_SEED,
  };
}

function makeEventState(history: EventState["history"] = []): EventState {
  return {
    pending: [],
    history,
    nextHistoryId: 100,
    flags: [],
    modifiers: {},
    cooldowns: {},
    lastEventIds: [],
    seenCounts: { env_red_dawn: 1 },
    triggeredTotal: 1,
    nextRollTurn: 99,
  };
}

function bandCtx(patch: Partial<BandContext> = {}): BandContext {
  return {
    category: "environment",
    turn: 12,
    randomSeed: TEST_SEED,
    era: 3,
    difficulty: "normal",
    eventId: "env_red_dawn",
    choiceId: "harvest",
    ...patch,
  };
}

const SAMPLE_EFFECTS = {
  resources: { food: -150, water: 60 },
  stability: 4,
  populationPct: -0.02,
  science: 200,
  capital: -3,
  hazardStress: 5,
  influence: { heat: 1.6, hope: 0.9 },
};

describe("区间基础：historyBandOptions", () => {
  it("默认 ±25%，难度越高区间越宽，heat 修正移动倍率区间", () => {
    const base = historyBandOptions(makeEventState(), "environment", "normal", 2);
    expect(base.low).toBeCloseTo(0.75, 6);
    expect(base.high).toBeCloseTo(1.25, 6);

    const hard = historyBandOptions(makeEventState(), "environment", "hard", 2);
    expect(hard.historySpread).toBeGreaterThan(base.historySpread);
    expect(hard.high - hard.low).toBeGreaterThan(base.high - base.low);

    const nightmare = historyBandOptions(makeEventState(), "environment", "nightmare", 2);
    expect(nightmare.high - nightmare.low).toBeGreaterThan(hard.high - hard.low);

    const hot = makeEventState();
    hot.modifiers = { heat: 1.8 };
    const shifted = historyBandOptions(hot, "environment", "normal", 2);
    expect(shifted.historyShift).toBeLessThan(0);
    expect(shifted.high).toBeLessThan(base.high);

    const hopeful = makeEventState();
    hopeful.modifiers = { hope: 1.5, unity: 1.3 };
    const up = historyBandOptions(hopeful, "environment", "normal", 2);
    expect(up.historyShift).toBeGreaterThan(0);
    expect(up.low).toBeGreaterThan(base.low);
  });

  it("最近同类事件重复出现会放宽区间并整体下移倍率", () => {
    const state = makeEventState([
      { id: 1, defId: "env_red_dawn", title: "赤色黎明", category: "environment", turn: 4, year: 2200, choiceId: "shelter", choiceLabel: "躲", outcome: "o", illustration: "events/env_red_dawn.jpg", effectsSummary: "" },
      { id: 2, defId: "env_red_dawn", title: "赤色黎明", category: "environment", turn: 8, year: 2202, choiceId: "shelter", choiceLabel: "躲", outcome: "o", illustration: "events/env_red_dawn.jpg", effectsSummary: "" },
    ]);
    const normal = historyBandOptions(makeEventState(), "environment", "normal", 3);
    const repeated = historyBandOptions(state, "environment", "normal", 3);
    expect(repeated.historySpread).toBeGreaterThan(normal.historySpread);
    expect(repeated.historyShift).toBeLessThan(0);
    // 区间变宽且倍率整体下移（lead 模块约定：正 shift = 更温和，负 shift = 更不利）
    expect(repeated.high - repeated.low).toBeGreaterThan(normal.high - normal.low);
    expect(repeated.low).toBeLessThan(normal.low);
  });

  it("范围夹取在合法区间内（0.12–0.5 宽度 / ±0.18 偏移）", () => {
    const state = makeEventState();
    state.modifiers = { heat: 2, fear: 1.6, famine: 1.9, drought: 1.4 };
    const options = historyBandOptions(state, "hazard", "nightmare", 1);
    expect(options.historySpread).toBeGreaterThanOrEqual(0.12);
    expect(options.historySpread).toBeLessThanOrEqual(0.5);
    expect(options.historyShift).toBeGreaterThanOrEqual(-0.18);
    expect(options.historyShift).toBeLessThanOrEqual(0.18);
    expect(options.low).toBeGreaterThanOrEqual(0.55);
    expect(options.high).toBeLessThanOrEqual(1.45);
  });
});

describe("选择前区间 forecastEffectBands", () => {
  it("给出上下界而不是精确值：deltaMin < deltaMax，中心落在区间内", () => {
    const ctx = makeCtx(2);
    const bands = forecastEffectBands(SAMPLE_EFFECTS, ctx, makeEventState(), "environment", forecastEventEffects);
    const food = bands.find((band) => band.key === "resource:food");
    const stability = bands.find((band) => band.key === "stability");
    const influence = bands.find((band) => band.key === "influence:heat");
    expect(food).toBeTruthy();
    expect(food!.deltaMin).not.toBeNull();
    expect(food!.deltaMax).not.toBeNull();
    expect(food!.deltaMin!).toBeLessThan(food!.deltaMax!);
    // 中心值应落在区间内（不给精确值，但区间必须覆盖真实效果）
    expect(food!.deltaMin!).toBeLessThanOrEqual(-150 + 1e-6);
    expect(food!.deltaMax!).toBeGreaterThanOrEqual(-150 - 1e-6);
    expect(food!.tone).toBe("loss");
    expect(food!.unit).toBe("吨");
    expect(stability!.deltaMin!).toBeLessThan(stability!.deltaMax!);
    expect(influence?.deltaMin).toBeNull();
    expect(influence?.detail).toContain("酷热");
    // 所有数值区间都满足 min <= max，且 after = before + delta
    for (const band of bands) {
      if (band.deltaMin == null || band.deltaMax == null) continue;
      expect(band.deltaMin).toBeLessThanOrEqual(band.deltaMax);
      if (band.before != null && band.afterMin != null && band.afterMax != null) {
        expect(band.afterMin).toBeCloseTo(band.before + band.deltaMin, 6);
        expect(band.afterMax).toBeCloseTo(band.before + band.deltaMax, 6);
      }
    }
  });

  it("历史同类事件会放宽区间并移动倍率（lead 语义：负 shift = 更不利）", () => {
    const ctx = makeCtx(2);
    const calm = forecastEffectBands(SAMPLE_EFFECTS, ctx, makeEventState(), "hazard", forecastEventEffects);
    const rough = makeEventState([
      { id: 1, defId: "haz_solar_flare", title: "日冕爆发", category: "hazard", turn: 4, year: 2200, choiceId: "shelter", choiceLabel: "躲", outcome: "o", illustration: "events/haz_solar_flare.jpg", effectsSummary: "" },
      { id: 2, defId: "haz_solar_flare", title: "日冕爆发", category: "hazard", turn: 8, year: 2202, choiceId: "shelter", choiceLabel: "躲", outcome: "o", illustration: "events/haz_solar_flare.jpg", effectsSummary: "" },
    ]);
    const harsh = forecastEffectBands(SAMPLE_EFFECTS, ctx, rough, "hazard", forecastEventEffects);
    const calmFood = calm.find((band) => band.key === "resource:food")!;
    const harshFood = harsh.find((band) => band.key === "resource:food")!;
    // 同一类别连续受击：区间更宽，且 lead 模块的「更温和倍率」整体下移
    // （historyBandOptions 约定：正数=更幸运/更温和；负向效果因此乘数变小、幅度变窄）
    const calmWidth = calmFood.deltaMax! - calmFood.deltaMin!;
    const harshWidth = harshFood.deltaMax! - harshFood.deltaMin!;
    expect(harshWidth).toBeGreaterThan(calmWidth);
    // 负向效果：影响幅度整体收窄（historyShift 语义为倍率移动，正=更温和）
    expect(harshFood.deltaMax!).toBeGreaterThan(calmFood.deltaMax!);
  });
});

describe("确定性区间结算 rollEventEffects", () => {
  it("同一 seed + turn + eventId + choiceId 完全可复现", () => {
    const ctx = makeCtx(3);
    const state = makeEventState();
    const a = rollEventEffects(SAMPLE_EFFECTS, state, bandCtx());
    const b = rollEventEffects(SAMPLE_EFFECTS, state, bandCtx());
    expect(a).toEqual(b);
    expect(a.resources?.food).not.toBe(-150); // 已被区间化，不是精确中心值
  });

  it("不同回合得到不同结果；flags / influence 保持原样", () => {
    const ctx = makeCtx(3);
    const state = makeEventState();
    const a = rollEventEffects(SAMPLE_EFFECTS, state, bandCtx({ turn: 12 }));
    const b = rollEventEffects(SAMPLE_EFFECTS, state, bandCtx({ turn: 13 }));
    const changed = ["food", "water"].some((key) => {
      const av = (a.resources as Record<string, number>)[key];
      const bv = (b.resources as Record<string, number>)[key];
      return av !== bv;
    }) || a.stability !== b.stability;
    expect(changed).toBe(true);
    expect(a.influence).toEqual(SAMPLE_EFFECTS.influence);
    expect(a.populationPct).toBeTypeOf("number");
    expect(a.hazardStress).toBeTypeOf("number");
    void ctx;
  });

  it("实际取值落在 historyBandOptions 给出的倍率区间内", () => {
    const state = makeEventState();
    const ctx = bandCtx();
    const options = historyBandOptions(state, ctx.category, ctx.difficulty, ctx.era);
    const rolled = rollEventEffects(SAMPLE_EFFECTS, state, ctx);
    const ratios = [
      (rolled.resources!.food as number) / SAMPLE_EFFECTS.resources.food,
      (rolled.resources!.water as number) / SAMPLE_EFFECTS.resources.water,
      (rolled.stability as number) / SAMPLE_EFFECTS.stability,
      (rolled.science as number) / SAMPLE_EFFECTS.science,
      (rolled.capital as number) / SAMPLE_EFFECTS.capital,
      (rolled.hazardStress as number) / SAMPLE_EFFECTS.hazardStress,
      (rolled.populationPct as number) / SAMPLE_EFFECTS.populationPct,
    ];
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(options.low - 1e-9);
      expect(ratio).toBeLessThanOrEqual(options.high + 1e-9);
    }
  });
});

describe("内容审计 auditEventLogic", () => {
  const known = new Set(EVENT_DEFS.map((def) => def.id));

  it("真实事件库没有时代倒置 / 悬空 followUp 硬错误", () => {
    for (const def of EVENT_DEFS) {
      const issues = auditEventLogic(def, known);
      expect(issues.filter((item) => item.includes("eraMin > eraMax") || item.includes("不存在事件")), def.id).toEqual([]);
    }
  });

  it("发现已知错例：时代倒置、悬空事件链、人口/粮食逻辑谬误、风险收益倒挂", () => {
    const bad = {
      id: "bad_event",
      eraMin: 4,
      eraMax: 2,
      choices: [
        {
          id: "boom",
          label: "反常人口",
          risk: "看似有风险",
          effects: { populationPct: 0.08, resources: { food: -300 }, stability: 13, capital: -15 },
        },
        {
          id: "too_good",
          label: "过强",
          effects: { hazardStress: -8, resources: { food: 200 } },
        },
      ],
      followUps: [{ eventId: "does_not_exist" }],
    };
    const issues = auditEventLogic(bad, known);
    expect(issues.some((item) => item.includes("eraMin > eraMax"))).toBe(true);
    expect(issues.some((item) => item.includes("不存在事件"))).toBe(true);
    expect(issues.some((item) => item.includes("人口大增同时食物大减"))).toBe(true);
    expect(issues.some((item) => item.includes("稳定度大涨同时政治资本大跌"))).toBe(true);
    expect(issues.some((item) => item.includes("灾害压力大降同时食物大增"))).toBe(true);
  });
});

describe("编年史派生 deriveChronicle", () => {
  function makeSource(): ChronicleSource {
    return {
      meta: { calendarStartYear: 2187 },
      yearsElapsed: 12,
      civ: {
        population: 880,
        stability: 48,
        era: 2,
        turn: 24,
        populationHistory: [
          { year: 2187, population: 1000 },
          { year: 2188, population: 1200 },
          { year: 2189, population: 900 }, // -25% → 人口崩溃
          { year: 2190, population: 880 }, // -2.2% → 人口下降
        ],
      },
      events: {
        history: [
          {
            id: 1, defId: "env_red_dawn", title: "赤色黎明", category: "environment",
            turn: 10, year: 2192, choiceLabel: "躲进地窖", outcome: "高温退去",
            effectsSummary: "食物 -150 · 稳定度 +4",
          },
          {
            id: 2, defId: "sci_breakthrough_flux", title: "辐照周期", category: "science",
            turn: 14, year: 2194, choiceLabel: "公开算式", outcome: "恐惧变成准备",
            effectsSummary: "科研点 +320 · 稳定度 +2",
          },
          {
            id: 3, defId: "haz_fire", title: "大火", category: "hazard",
            turn: 16, year: 2195, choiceLabel: "全力扑救", outcome: "扑灭",
            effectsSummary: "食物 -160 · 人口 -20 · 稳定度 +3",
          },
        ],
        pending: [],
      },
      hazards: {
        history: [{ id: 1, title: "极端严寒", description: "母星表面温度骤降", severity: 0.8, startYear: 8, peakYear: 9, endYear: 10 }],
        crises: [{ id: 2, title: "饥荒", description: "粮食产出低于消耗", severity: 0.5, startYear: 11, endYear: 12, active: true }],
      },
      log: [
        { id: 1, year: 2191, turn: 12, category: "milestone", severity: "success", message: "文明进入第 2 时代「文明曙光」（农业城邦）：解锁金属。" },
        { id: 2, year: 2193, turn: 14, category: "hazard", severity: "critical", message: "灾害造成人口损失 120 人（防护已生效）。" },
        { id: 3, year: 2193, turn: 14, category: "tech", severity: "success", message: "科技突破：「灌溉」研究完成。" },
        { id: 4, year: 2192, turn: 10, category: "system", severity: "info", message: "系统噪声，不进入编年史。" },
        { id: 5, year: 2192, turn: 10, category: "hazard", severity: "warning", message: "辐射风暴：峰值辐照 2.4 S" },
      ],
    };
  }

  it("识别事件 / 抉择 / 后果，且最新在前", () => {
    const entries = deriveChronicle(makeSource());
    const redDawn = entries.find((entry) => entry.sourceId === "event:1");
    expect(redDawn).toBeTruthy();
    expect(redDawn!.kind).toBe("event");
    expect(redDawn!.title).toBe("赤色黎明");
    expect(redDawn!.detail).toContain("躲进地窖");
    expect(redDawn!.detail).toContain("食物 -150");
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].year).toBeGreaterThanOrEqual(entries[i].year);
    }
  });

  it("识别居民死亡 / 人口骤降（来自人口历史与事件效果）", () => {
    const entries = deriveChronicle(makeSource());
    const collapse = entries.find((entry) => entry.sourceId === "population:2189");
    expect(collapse).toBeTruthy();
    expect(collapse!.kind).toBe("death");
    expect(collapse!.title).toBe("人口崩溃");
    expect(collapse!.importance).toBeGreaterThanOrEqual(4);
    expect(collapse!.detail).toContain("1200");
    expect(collapse!.detail).toContain("900");

    const eventDeath = entries.find((entry) => entry.id === "event-death:3");
    expect(eventDeath).toBeTruthy();
    expect(eventDeath!.kind).toBe("death");
    expect(eventDeath!.detail).toContain("20");

    const hazardLoss = entries.find((entry) => entry.sourceId === "log:2");
    expect(hazardLoss).toBeTruthy();
    expect(hazardLoss!.kind).toBe("death");
    expect(hazardLoss!.importance).toBeGreaterThanOrEqual(3);
  });

  it("识别重大事件：时代推进 / 重灾 / 危机 / 科技突破", () => {
    const entries = deriveChronicle(makeSource());
    const era = entries.find((entry) => entry.sourceId === "log:1");
    expect(era).toBeTruthy();
    expect(era!.kind).toBe("major");
    expect(era!.tone).toBe("major");
    expect(era!.importance).toBe(5);
    expect(era!.title).toContain("第 2 时代");

    const hazard = entries.find((entry) => entry.sourceId === "hazard:1");
    expect(hazard).toBeTruthy();
    expect(hazard!.kind).toBe("disaster");
    expect(hazard!.year).toBe(2197); // 相对年 10 + calendarStart 2187
    expect(hazard!.importance).toBeGreaterThanOrEqual(4);

    const crisis = entries.find((entry) => entry.sourceId === "crisis:2");
    expect(crisis).toBeTruthy();
    expect(crisis!.title).toContain("危机持续");
    expect(crisis!.kind).toBe("disaster");

    const tech = entries.find((entry) => entry.sourceId === "log:3");
    expect(tech).toBeTruthy();
    expect(tech!.kind).toBe("science");
    expect(tech!.title).toContain("科技突破");

    const scienceEvent = entries.find((entry) => entry.id === "event:2");
    expect(scienceEvent!.kind).toBe("science");
    expect(scienceEvent!.tone).toBe("science");
  });

  it("不编造数据：空输入 / 系统噪声 / 否定死亡句都不生成条目", () => {
    expect(deriveChronicle(null)).toEqual([]);
    expect(deriveChronicle({})).toEqual([]);
    const noise = deriveChronicle({
      log: [{ id: 9, year: 2200, turn: 1, category: "system", severity: "info", message: "系统噪声" }],
    });
    expect(noise).toEqual([]);
    expect(mentionsDeath("这个春天没有人饿死，也没有人累死。")).toBe(false);
    expect(mentionsDeath("没有人再饿死在街上。")).toBe(false);
    expect(mentionsDeath("队伍里冻死了三个人。")).toBe(true);
    expect(mentionsDeath("灾害造成人口损失 120 人。")).toBe(true);
  });

  it("过滤：按年 / 按类型 / 仅重大；计数与年份列表", () => {
    const entries = deriveChronicle(makeSource());
    const year2197 = filterChronicle(entries, { year: 2197 });
    expect(year2197.length).toBeGreaterThan(0);
    expect(year2197.every((entry) => Math.round(entry.year) === 2197)).toBe(true);

    const deaths = filterChronicle(entries, { kinds: ["death"] });
    expect(deaths.length).toBeGreaterThan(0);
    expect(deaths.every((entry) => entry.kind === "death")).toBe(true);

    const major = filterChronicle(entries, CHRONICLE_FILTER_PRESETS.major);
    expect(major.length).toBeGreaterThan(0);
    expect(major.every((entry) => entry.importance >= 4 || entry.kind === "major")).toBe(true);

    const casualty = filterChronicle(entries, CHRONICLE_FILTER_PRESETS.casualty);
    expect(casualty.every((entry) => entry.kind === "death")).toBe(true);

    const searched = filterChronicle(entries, { query: "科技突破" });
    expect(searched.length).toBe(1);
    expect(filterChronicle(entries, { limit: 3 }).length).toBe(3);

    const counts = chronicleKindCounts(entries);
    expect(counts.event).toBeGreaterThan(0);
    expect(counts.death).toBeGreaterThan(0);
    expect(counts.major).toBeGreaterThan(0);
    expect(counts.disaster).toBeGreaterThan(0);
    expect(counts.science).toBeGreaterThan(0);

    const years = chronicleYears(entries);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(chronicleSignature(entries)).toBe(chronicleSignature(deriveChronicle(makeSource())));
  });
});

describe("ViewModel 派生 deriveChronicleFromView", () => {
  it("从 EventsView / 日志 / 灾害视图派生（不依赖 GameState）", () => {
    const entries = deriveChronicleFromView({
      meta: { turn: 24, year: 12, calendarYear: 2199 },
      civ: { population: { total: 880 }, stability: { value: 48 }, era: { value: 2 } },
      events: {
        active: {
          defId: "env_red_dawn",
          title: "赤色黎明",
          category: "environment",
          triggerYear: 2199,
          context: "第 25 回合 · 第 2 时代",
          short: "三颗太阳同时越过地平线。",
        },
        history: [
          { id: 1, defId: "env_red_dawn", title: "赤色黎明", category: "environment", turn: 10, year: 2192, choiceLabel: "躲进地窖", outcome: "高温退去" },
          { id: 2, defId: "sci_breakthrough_flux", title: "辐照周期", category: "science", turn: 14, year: 2194, choiceLabel: "公开算式", outcome: "恐惧变成准备" },
        ],
        totalTriggered: 2,
      },
      hazards: {
        hazards: [{ id: 7, title: "极端高温", description: "地表温度 58°C", severity: 0.7, startYear: 9, peakYear: 10, endYear: 11 }],
        crises: [{ id: 8, title: "干旱", description: "可用水低于需求", severity: 0.4, startYear: 11, endYear: null, active: false }],
      },
      log: [
        { id: 1, year: 2196, turn: 18, category: "milestone", severity: "success", message: "文明进入第 3 时代「蒸汽纪元」（蒸汽与钢铁）：解锁能源。" },
        { id: 2, year: 2197, turn: 20, category: "hazard", severity: "critical", message: "灾害造成人口损失 60 人（防护已生效）。" },
      ],
    });
    expect(entries.some((entry) => entry.id === "event-trigger:env_red_dawn")).toBe(true);
    expect(entries.some((entry) => entry.kind === "science" && entry.id === "event:2")).toBe(true);
    expect(entries.some((entry) => entry.kind === "major" && entry.title.includes("第 3 时代"))).toBe(true);
    expect(entries.some((entry) => entry.kind === "death")).toBe(true);
    expect(entries.some((entry) => entry.kind === "disaster" && entry.title.includes("极端高温"))).toBe(true);
    expect(deriveChronicleFromView(null)).toEqual([]);
  });
});

describe("event-drawer 区间文本（非阻塞抽屉）", () => {
  it("formatBandRange：损失按「较小损失 ~ 较大损失」排列，显示符号与单位", () => {
    expect(formatBandRange("食物", -210, -120, "吨")).toBe("食物 \u2212120 ~ \u2212210 吨");
    expect(formatBandRange("稳定度", 1, 4, "点")).toBe("稳定度 +1 ~ +4 点");
    expect(formatBandRange("政治资本", -2, 3, "点")).toBe("政治资本 \u22122 ~ +3 点");
    expect(formatBandRange("科研点", 10, 10, "点")).toBe("科研点 +10 ~ +10 点");
  });

  it("fallbackBandsFromEffects：用 delta ±25% 生成区间，不暴露精确值", () => {
    const bands = fallbackBandsFromEffects([
      { key: "resource:food", label: "食物", kind: "resource", unit: "吨", delta: -150, detail: null, tone: "loss" },
      { key: "stability", label: "稳定度", kind: "stability", unit: "点", delta: 4, detail: null, tone: "gain" },
      { key: "flags", label: "世界局势", kind: "flag", unit: "", delta: null, detail: "engine_project", tone: "neutral" },
    ]);
    expect(bands).toHaveLength(3);
    expect(bands[0].min).toBeCloseTo(-187.5, 5);
    expect(bands[0].max).toBeCloseTo(-112.5, 5);
    expect(bands[1].min).toBeCloseTo(3, 5);
    expect(bands[1].max).toBeCloseTo(5, 5);
    expect(bands[2].min).toBeNull();
    const text = formatDrawerBand(bands[0]);
    expect(text).toContain("食物");
    expect(text).toContain("吨");
    expect(text).not.toContain("150");
  });

  it("drawerBandsForChoice 优先使用 view 上 forecastEffectBands 生成的区间", () => {
    const viewChoice = {
      id: "harvest",
      label: "抢收作物",
      description: "赶在田地被烤焦前抢收",
      risk: "高温下劳作会死人",
      available: true,
      unavailableReason: null,
      effects: [
        { key: "resource:food", label: "食物", kind: "resource", before: 500, after: 720, delta: 220, unit: "吨", tone: "gain", detail: null },
        { key: "population", label: "人口", kind: "population", before: 2000, after: 1960, delta: -40, unit: "人", tone: "loss", detail: "约 -2%" },
      ],
      preview: [],
      bands: [
        {
          key: "resource:food", label: "食物", kind: "resource", before: 500,
          deltaMin: 160, deltaMax: 280, afterMin: 660, afterMax: 780,
          unit: "吨", tone: "gain", detail: null,
        },
        {
          key: "population", label: "人口", kind: "population", before: 2000,
          deltaMin: -55, deltaMax: -25, afterMin: 1945, afterMax: 1975,
          unit: "人", tone: "loss", detail: "约 -2%",
        },
      ],
    } as unknown as Parameters<typeof drawerBandsForChoice>[0];
    const bands = drawerBandsForChoice(viewChoice);
    expect(bands[0].deltaMin).toBe(160);
    expect(bands[0].deltaMax).toBe(280);
    expect(formatDrawerBand(bands[0])).toBe("食物 +160 ~ +280 吨");
    expect(formatDrawerBand(bands[1])).toBe("人口 \u221225 ~ \u221255 人");
  });
});

describe("事件定义抽样：区间与真实选项兼容", () => {
  it("对真实事件每个选项都能生成合法区间（不抛错、min<=max、中心在界内）", () => {
    const ctx = makeCtx(3);
    const state = makeEventState();
    let checked = 0;
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices) {
        const bands = forecastEffectBands(choice.effects, ctx, state, def.category, forecastEventEffects);
        for (const band of bands) {
          if (band.deltaMin == null || band.deltaMax == null) continue;
          expect(Number.isFinite(band.deltaMin)).toBe(true);
          expect(Number.isFinite(band.deltaMax)).toBe(true);
          expect(band.deltaMin).toBeLessThanOrEqual(band.deltaMax);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  it("抽样事件（赤色黎明）roll 结果可落地且不越过硬上限", () => {
    const ctx = makeCtx(2);
    const state = makeEventState();
    const def = getEventDef("env_red_dawn")!;
    const choice = def.choices.find((item) => item.id === "harvest")!;
    const bands = forecastEffectBands(choice.effects, ctx, state, def.category, forecastEventEffects);
    expect(bands.length).toBeGreaterThan(0);
    const rolled = rollEventEffects(choice.effects, state, {
      ...bandCtx(),
      category: def.category,
      eventId: def.id,
      choiceId: choice.id,
    });
    expect(Number.isFinite(rolled.resources?.food ?? NaN)).toBe(true);
    expect(Number.isFinite(rolled.populationPct ?? NaN)).toBe(true);
    expect(Math.abs((rolled.populationPct ?? 0))).toBeLessThanOrEqual(0.08 + 1e-9);
    expect(Math.abs((rolled.resources?.food ?? 0))).toBeLessThanOrEqual(4000 * 0.08 * 1.45 + 1e-6);
  });
});
