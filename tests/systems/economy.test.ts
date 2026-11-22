import { describe, it, expect } from "vitest";
import {
  BASE_RESOURCE_CAPACITY,
  canAfford,
  createCivilizationState,
  workforceFor,
} from "../../src/civilization";
import {
  ENERGY_PER_CAPITA_TURN,
  FOOD_PER_CAPITA_TURN,
  SUBSISTENCE_ENERGY_PER_CAPITA,
  WATER_PER_CAPITA_TURN,
  applyCrisisEffects,
  assembleTurnContext,
  checkDefeat,
  civilizationSummary,
  colonyReport,
  eraInfo,
  eraScore,
  foundColony,
  planetEngineReady,
  resolveTurn,
  startColony,
} from "../../src/economy";
import { ERAS, RESOURCE_UNLOCK_ERA, TURN_YEARS } from "../../src/core/constants";
import type { ColonyState, EnvironmentState, ResourceId } from "../../src/core/types";
import {
  BUILDING_DEFS,
  advanceConstruction,
  aggregateBuildingEffects,
  constructionSpeed,
  createBuildingState,
  getBuildingDef,
  startConstruction,
} from "../../src/buildings";
import {
  TECH_DEFS,
  advanceResearch,
  aggregateTechEffects,
  createTechState,
  getTechMultipliers,
  startResearch,
} from "../../src/technology";
import {
  applyEraAdvance,
  buildingEra,
  canAdvanceEra,
  eraStatus,
  evaluateRequirements,
  isBuildingAvailableInEra,
  outdatedMultiplier,
  resourceUnlocked,
  techsInEra,
} from "../../src/civilization/eras";
import {
  createWorld,
  fillResources,
  grantResources,
  makeEnvironment,
  resourceAmounts,
  runTurn,
  runTurns,
} from "./helpers";

function makeColony(overrides: Partial<ColonyState> = {}): ColonyState {
  return {
    name: "火种站",
    foundedYear: 10,
    population: 300,
    selfSufficiency: 0.5,
    integrity: 0.8,
    level: 2,
    lastReportYear: 10,
    ...overrides,
  };
}

function expectFiniteCiv(civ: ReturnType<typeof createWorld>["civ"]): void {
  expect(Number.isFinite(civ.population)).toBe(true);
  expect(Number.isFinite(civ.stability)).toBe(true);
  expect(Number.isFinite(civ.starvation)).toBe(true);
  for (const stock of Object.values(civ.resources)) {
    expect(Number.isFinite(stock.amount)).toBe(true);
    expect(stock.amount).toBeGreaterThanOrEqual(0);
    expect(stock.amount).toBeLessThanOrEqual(stock.capacity + 1e-6);
  }
  for (const flow of Object.values(civ.flows)) {
    expect(Number.isFinite(flow.produced)).toBe(true);
    expect(Number.isFinite(flow.consumed)).toBe(true);
    expect(Number.isFinite(flow.net)).toBe(true);
  }
}

describe("文明初始状态 createCivilizationState（E1 原始部落）", () => {
  it("normal：人口 500 / era=1 / 资源正确 / metals 与 energy 为 0", () => {
    const civ = createCivilizationState({ difficulty: "normal", mode: "normal", seed: "A" });
    expect(civ.population).toBe(500);
    expect(civ.era).toBe(1);
    expect(civ.resources.food.amount).toBe(900);
    expect(civ.resources.water.amount).toBe(500);
    expect(civ.resources.minerals.amount).toBe(130);
    expect(civ.resources.metals.amount).toBe(0);
    expect(civ.resources.energy.amount).toBe(0);
    expect(civ.resources.science.amount).toBe(10);
    expect(civ.stability).toBe(65);
    expect(civ.housing).toBe(200);
    expect(civ.industryCapacity).toBe(10);
    expect(civ.workforce).toBe(workforceFor(500));
    expect(civ.workforce).toBe(275);
    expect(civ.colony).toBeNull();
    expect(civ.alive).toBe(true);
    expect(civ.hasWon).toBe(false);
    expect(civ.starvation).toBe(0);
    expect(civ.unlockFlags).toEqual({ colony: false, planetEngine: false, deepSpace: false });
    expect(civ.populationHistory).toHaveLength(1);
    expect(civ.populationHistory[0].population).toBe(500);
    for (const stock of Object.values(civ.resources)) {
      expect(stock.amount).toBeGreaterThanOrEqual(0);
      expect(stock.amount).toBeLessThanOrEqual(stock.capacity);
      expect(stock.capacity).toBeGreaterThan(0);
    }
  });

  it("难度预设：nightmare 人口 400 且科研 0；easy/hard 起始食物不同", () => {
    const nightmare = createCivilizationState({ difficulty: "nightmare", mode: "normal", seed: "B" });
    expect(nightmare.population).toBe(400);
    expect(nightmare.resources.food.amount).toBe(700);
    expect(nightmare.resources.science.amount).toBe(0);
    expect(nightmare.resources.metals.amount).toBe(0);
    expect(nightmare.resources.energy.amount).toBe(0);

    const easy = createCivilizationState({ difficulty: "easy", mode: "normal", seed: "C" });
    expect(easy.population).toBe(500);
    expect(easy.resources.food.amount).toBe(1000);
    expect(easy.resources.science.amount).toBe(20);

    const hard = createCivilizationState({ difficulty: "hard", mode: "normal", seed: "D" });
    expect(hard.resources.food.amount).toBe(800);
    expect(hard.resources.science.amount).toBe(5);
  });

  it("难度名称非法时回退到 normal，不抛异常", () => {
    const civ = createCivilizationState({ difficulty: "unknown" as never, mode: "normal", seed: "D" });
    expect(civ.population).toBe(500);
    expect(civ.resources.food.amount).toBe(900);
  });

  it("开局建筑为原始聚落单一来源（camp/farm1/well1/quarry1）", () => {
    const world = createWorld();
    expect(world.buildings.counts).toEqual({ camp: 1, farm1: 2, well1: 1, quarry1: 1 });
    expect(world.buildings.queue).toEqual([]);
    expect(world.civ.era).toBe(1);
  });
});

describe("单回合结算 resolveTurn（E1 原始经济）", () => {
  it("开局第一回合不崩溃：无能源/金属流量，食物与水为正，住房 420", () => {
    const world = createWorld();
    const report = runTurn(world, makeEnvironment());
    const civ = world.civ;

    expect(report.collapsed).toBe(false);
    expect(report.victory).toBe(false);
    expect(report.era).toBe(1);
    expect(report.eraChanged).toBeNull();
    expect(civ.alive).toBe(true);
    expect(civ.turn).toBe(1);
    expect(civ.era).toBe(1);

    // E1 未解锁 metals / energy：生产与需求恒为 0
    expect(civ.flows.energy.produced).toBe(0);
    expect(civ.flows.energy.consumed).toBe(0);
    expect(civ.flows.metals.produced).toBe(0);
    expect(civ.flows.metals.consumed).toBe(0);

    // 食物 / 水 / 矿物正常
    expect(civ.flows.food.produced).toBeGreaterThan(civ.flows.food.consumed);
    expect(civ.flows.food.produced).toBeGreaterThan(200);
    expect(civ.flows.water.produced).toBeGreaterThan(civ.flows.water.consumed);
    expect(civ.flows.water.produced).toBeCloseTo(180, 6); // 人口自给 + 水井
    expect(civ.flows.minerals.produced).toBeCloseTo(40, 6); // 采石场

    expect(civ.stability).toBeGreaterThan(65);
    expect(civ.housing).toBe(420); // BASE_HOUSING 200 + 聚落营地 220
    expect(civ.population).toBeGreaterThanOrEqual(500);
    expect(civ.populationHistory).toHaveLength(2);
    expect(civ.scienceRate).toBeGreaterThan(0);
    expectFiniteCiv(civ);

    // E1 没有能源需求，不应出现「能源供应不足」告警
    expect(report.logs.some((l) => l.message.includes("能源供应不足"))).toBe(false);

    for (const log of report.logs) {
      expect(["civilization", "build", "tech", "milestone", "hazard"]).toContain(log.category);
      expect(["info", "warning", "critical", "success"]).toContain(log.severity);
      expect(log.message.length).toBeGreaterThan(0);
    }
  });

  it("库存上限生效，溢出不会产生负数或 NaN", () => {
    const world = createWorld();
    const foodCap = BASE_RESOURCE_CAPACITY.food; // 原始聚落没有仓储加成
    world.civ.resources.food.amount = foodCap - 1;
    const report = runTurn(world, makeEnvironment());
    expect(report.collapsed).toBe(false);
    expect(world.civ.resources.food.amount).toBeLessThanOrEqual(foodCap);
    expect(world.civ.resources.food.amount).toBeGreaterThanOrEqual(0);
    expectFiniteCiv(world.civ);
  });

  it("建筑维护费计入消耗（E1 维护为食物 / 水 / 矿物，无能源）", () => {
    const world = createWorld();
    runTurn(world, makeEnvironment());
    expect(world.civ.flows.food.consumed).toBeCloseTo(500 * FOOD_PER_CAPITA_TURN + 8, 6);
    expect(world.civ.flows.water.consumed).toBeCloseTo(500 * WATER_PER_CAPITA_TURN + 16, 6);
    expect(world.civ.flows.minerals.consumed).toBeCloseTo(2, 6);
    expect(world.civ.flows.energy.consumed).toBe(0);
  });

  it("未知 id 的科技被容忍，缺失的可选字段有安全默认值", () => {
    const world = createWorld();
    world.tech.researched = ["ghost_tech"];
    expect(() => runTurn(world, makeEnvironment())).not.toThrow();
    expectFiniteCiv(world.civ);

    const bare = createWorld();
    const ctx = assembleTurnContext({
      civ: bare.civ,
      env: makeEnvironment(),
      physics: { planetAlive: true, planetEjected: false } as never,
      buildingEffects: {},
      techEffects: {},
      techMultipliers: getTechMultipliers(createTechState()),
      mode: "normal",
      difficulty: "normal",
      year: 1,
    });
    expect(() => resolveTurn(bare.civ, ctx)).not.toThrow();
    expectFiniteCiv(bare.civ);
  });
});

describe("时代资源门槛（TurnContext.era）", () => {
  it("ctx.era=1：energy/metals 的生产与需求恒为 0，食物/水正常", () => {
    const world = createWorld({
      era: 1,
      buildings: { camp: 1, farm1: 2, well1: 1, quarry1: 1, mine: 1, coalPlant: 1, housingDistrict: 1 },
    });
    const report = runTurn(world, makeEnvironment());
    expect(report.collapsed).toBe(false);
    expect(world.civ.flows.energy.produced).toBe(0);
    expect(world.civ.flows.energy.consumed).toBe(0);
    expect(world.civ.flows.metals.produced).toBe(0);
    expect(world.civ.flows.metals.consumed).toBe(0);
    expect(world.civ.flows.food.produced).toBeGreaterThan(world.civ.flows.food.consumed);
    expect(world.civ.flows.water.produced).toBeGreaterThan(world.civ.flows.water.consumed);
  });

  it("未解锁资源的维护需求被忽略（不会出现「需求为 0 但必须维护」矛盾）", () => {
    const era1 = createWorld({ era: 1 });
    runTurn(era1, makeEnvironment(), { maintenance: { energy: 500, metals: 100 } });
    expect(era1.civ.flows.energy.consumed).toBe(0);
    expect(era1.civ.flows.metals.consumed).toBe(0);

    const era2 = createWorld({ era: 2 });
    runTurn(era2, makeEnvironment(), { maintenance: { energy: 500, metals: 100 } });
    expect(era2.civ.flows.energy.consumed).toBe(0); // energy 仍锁定
    expect(era2.civ.flows.metals.consumed).toBeCloseTo(100, 6); // 金属已解锁

    const era3 = createWorld({ era: 3 });
    runTurn(era3, makeEnvironment(), { maintenance: { energy: 500, metals: 100 } });
    expect(era3.civ.flows.energy.consumed).toBeGreaterThan(400);
    expect(era3.civ.flows.metals.consumed).toBeCloseTo(100, 6);
  });

  it("ctx.era=2：金属生产生效，能源仍然锁定", () => {
    const buildings = { camp: 1, farm1: 2, well1: 1, quarry1: 1, mine: 1 };
    const world = createWorld({ era: 2, buildings });
    runTurn(world, makeEnvironment());
    expect(world.civ.flows.metals.produced).toBeCloseTo(60, 6); // 矿场 60 金属
    // 采石场（E1）在 E2 按 0.8 折减 → 32，矿场（E2）220，合计 252
    expect(world.civ.flows.minerals.produced).toBeCloseTo(40 * 0.8 + 220, 6);
    expect(world.civ.flows.energy.produced).toBe(0);
    expect(world.civ.flows.energy.consumed).toBe(0);
  });

  it("ctx.era=3：能源生效（燃煤电站产出 + 人口需求）", () => {
    const world = createWorld({ era: 3, buildings: { camp: 1, coalPlant: 1 } });
    runTurn(world, makeEnvironment());
    expect(world.civ.flows.energy.produced).toBeCloseTo(
      500 * SUBSISTENCE_ENERGY_PER_CAPITA + 560 * 1.05,
      6,
    );
    expect(world.civ.flows.energy.produced).toBeGreaterThan(500);
    expect(world.civ.flows.energy.consumed).toBeCloseTo(500 * ENERGY_PER_CAPITA_TURN, 6);
    expect(world.civ.flows.energy.consumed).toBeGreaterThan(0);
  });

  it("不传 era 时保持旧行为：全资源解锁、建筑效果不折减", () => {
    const buildings = { camp: 1, coalPlant: 1, mine: 1 };
    const legacy = createWorld({ era: 1, buildings });
    runTurn(legacy, makeEnvironment(), { era: null });
    expect(legacy.civ.flows.energy.consumed).toBeCloseTo(500 * ENERGY_PER_CAPITA_TURN, 6);
    expect(legacy.civ.flows.energy.produced).toBeCloseTo(
      500 * SUBSISTENCE_ENERGY_PER_CAPITA + 560,
      6,
    ); // 无时代效率修正
    expect(legacy.civ.flows.metals.produced).toBeCloseTo(60, 6);

    // era=3 同配置会叠加 1.05 建筑效率修正，且 E1/E2 建筑按 0.8/0.6 折减
    const era3 = createWorld({ era: 3, buildings });
    runTurn(era3, makeEnvironment());
    expect(era3.civ.flows.energy.produced).toBeGreaterThan(legacy.civ.flows.energy.produced);
    expect(era3.civ.flows.metals.produced).toBeLessThan(legacy.civ.flows.metals.produced);
  });
});

describe("环境联动（高温 / 低温 / 低宜居度）", () => {
  function firstTurnFood(
    tempC: number,
    habitability = 0.85,
    weather: EnvironmentState["weather"] = "clear",
  ) {
    const world = createWorld();
    const report = runTurn(world, makeEnvironment({ surfaceTempC: tempC, habitability, weather }));
    expect(report.collapsed).toBe(false);
    return world.civ;
  }

  it("高温显著降低食物生产，低温同时降低食物与取水", () => {
    const mild = firstTurnFood(16);
    const hot = firstTurnFood(60);
    const scorching = firstTurnFood(70, 0.2, "scorching");
    expect(hot.flows.food.produced).toBeLessThan(mild.flows.food.produced * 0.6);
    expect(scorching.flows.food.produced).toBeLessThan(mild.flows.food.produced * 0.4);

    const cold = firstTurnFood(-40);
    const freezing = firstTurnFood(-45, 0.2, "freezing");
    expect(cold.flows.food.produced).toBeLessThan(mild.flows.food.produced * 0.6);
    expect(freezing.flows.food.produced).toBeLessThan(mild.flows.food.produced * 0.4);
    expect(freezing.flows.water.produced).toBeLessThan(mild.flows.water.produced * 0.8);
  });

  it("宜居度低的环境同样拖累农业", () => {
    const good = firstTurnFood(16, 0.9);
    const bad = firstTurnFood(16, 0.15);
    expect(bad.flows.food.produced).toBeLessThan(good.flows.food.produced * 0.7);
  });

  it("隔热建筑（地下避难所）缓解极端温度冲击", () => {
    const exposed = createWorld({ era: 3, buildings: { camp: 1 } });
    const sheltered = createWorld({ era: 3, buildings: { camp: 1, bunker: 3 } });
    expect(aggregateBuildingEffects(createBuildingState({ bunker: 3 }), BUILDING_DEFS, 3).thermalShielding).toBe(15);
    const env = makeEnvironment({ surfaceTempC: 55, habitability: 0.4 });
    const a = runTurn(exposed, env);
    const b = runTurn(sheltered, env);
    expect(a.collapsed).toBe(false);
    expect(b.collapsed).toBe(false);
    expect(sheltered.civ.flows.food.produced).toBeGreaterThanOrEqual(exposed.civ.flows.food.produced);
    expect(sheltered.civ.stability).toBeGreaterThan(exposed.civ.stability);
  });
});

describe("危机修正", () => {
  it("饥荒 / 能源危机 / 灾害伤害全部生效", () => {
    const env = makeEnvironment();
    const base = createWorld();
    const famine = createWorld();
    const disaster = createWorld();
    runTurn(base, env);
    runTurn(famine, env, { crisis: { foodMultiplier: 0.5 } });
    const disasterReport = runTurn(disaster, env, { crisis: { disasterDamage: 0.05 } });

    expect(famine.civ.flows.food.produced).toBeLessThan(base.civ.flows.food.produced * 0.75);
    expect(disaster.civ.population).toBeLessThan(base.civ.population);
    expect(disasterReport.logs.some((l) => l.category === "hazard")).toBe(true);

    // 能源危机只在有电力的时代（E3+）生效
    const baseE3 = createWorld({ era: 3, buildings: { camp: 1, coalPlant: 1 } });
    const energyE3 = createWorld({ era: 3, buildings: { camp: 1, coalPlant: 1 } });
    runTurn(baseE3, env);
    runTurn(energyE3, env, { crisis: { energyDemandMultiplier: 1.5 } });
    expect(energyE3.civ.flows.energy.consumed).toBeGreaterThan(baseE3.civ.flows.energy.consumed * 1.3);
  });

  it("稳定度惩罚会压低稳定度", () => {
    const calm = createWorld();
    const riot = createWorld();
    const env = makeEnvironment();
    for (let i = 0; i < 5; i++) {
      runTurn(calm, env);
      runTurn(riot, env, { crisis: { stabilityPenalty: 25 } });
    }
    expect(riot.civ.stability).toBeLessThan(calm.civ.stability - 5);
  });

  it("applyCrisisEffects 直接削减人口 / 资源 / 稳定度", () => {
    const world = createWorld();
    const popBefore = world.civ.population;
    const foodBefore = world.civ.resources.food.amount;
    const stabilityBefore = world.civ.stability;
    applyCrisisEffects(world.civ, { disasterDamage: 0.1, stabilityPenalty: 15 });
    expect(world.civ.population).toBeCloseTo(popBefore * 0.9, 6);
    expect(world.civ.resources.food.amount).toBeLessThan(foodBefore);
    expect(world.civ.stability).toBeCloseTo(stabilityBefore - 15, 6);
  });
});

describe("时代条件与推进（civilization/eras.ts）", () => {
  it("E1→E2：人口 / 科技总数 / 观测等级 三项条件", () => {
    const world = createWorld();
    const status = eraStatus(world.civ, world.tech, world.buildings, 0);
    expect(status.era).toBe(1);
    expect(status.next?.era).toBe(2);
    expect(status.requirements).toHaveLength(3);
    expect(status.requirements.map((r) => r.kind)).toEqual(["population", "techsTotal", "observatoryLevel"]);
    expect(status.canAdvance).toBe(false);
    expect(status.progress).toBeGreaterThanOrEqual(0);
    expect(status.progress).toBeLessThan(1);
    expect(status.unlockSummary.length).toBeGreaterThan(0);
    for (const req of status.requirements) {
      expect(req.current).toBeGreaterThanOrEqual(0);
      expect(req.target).toBeGreaterThan(0);
      expect(req.met).toBe(req.current >= req.target);
      expect(req.label.length).toBeGreaterThan(0);
    }
    expect(canAdvanceEra(world.civ, world.tech, world.buildings, 0)).toBe(false);

    // 满足全部条件
    world.civ.population = 900;
    world.tech.researched = ["astro_basic", "energy_basic"];
    const withObservatory = createBuildingState({ camp: 1, observatory: 1 });
    expect(canAdvanceEra(world.civ, world.tech, withObservatory, 1)).toBe(true);
    const met = evaluateRequirements(2, world.civ, world.tech, withObservatory, 1);
    expect(met.every((r) => r.met)).toBe(true);
    // 少一项科技 / 观测等级时不能推进
    expect(canAdvanceEra(world.civ, world.tech, withObservatory, 0)).toBe(false);
    world.tech.researched = ["astro_basic"];
    expect(canAdvanceEra(world.civ, world.tech, withObservatory, 1)).toBe(false);
  });

  it("E2→E3：额外要求「2 项城邦时代科技」与观测 Lv.2", () => {
    const world = createWorld({
      era: 2,
      researched: ["astro_basic", "astro_distance", "energy_basic", "energy_grid", "industry_basic", "bio_basic"],
    });
    world.civ.population = 1800;
    const buildings = createBuildingState({ camp: 1 });
    expect(techsInEra(world.tech, 2)).toBe(2);
    expect(canAdvanceEra(world.civ, world.tech, buildings, 2)).toBe(true);

    // 去掉一项 E2 科技 → techsInEra 条件不满足
    world.tech.researched = [
      "astro_basic",
      "energy_basic",
      "industry_basic",
      "bio_basic",
      "space_basic",
      "energy_grid",
    ];
    expect(techsInEra(world.tech, 2)).toBe(1);
    expect(canAdvanceEra(world.civ, world.tech, buildings, 2)).toBe(false);

    // 人口不足
    world.tech.researched = [
      "astro_basic",
      "astro_distance",
      "energy_basic",
      "energy_grid",
      "industry_basic",
      "bio_basic",
    ];
    world.civ.population = 1799;
    expect(canAdvanceEra(world.civ, world.tech, buildings, 2)).toBe(false);
    world.civ.population = 1800;
    // 观测等级不足
    expect(canAdvanceEra(world.civ, world.tech, buildings, 1)).toBe(false);
    expect(canAdvanceEra(world.civ, world.tech, buildings, 2)).toBe(true);
  });

  it("E2~E5 逐代构造满足条件的文明，canAdvanceEra 为 true", () => {
    for (const eraDef of ERAS) {
      if (eraDef.era === 1) continue;
      const target = eraDef.era;
      const world = createWorld({ era: target - 1 });
      let population = 0;
      let observatoryLevel = 0;
      let techsTotal = 0;
      const perEraTech: { era: number; count: number }[] = [];
      for (const req of eraDef.requirements) {
        if (req.kind === "population") population = req.target;
        else if (req.kind === "observatoryLevel") observatoryLevel = req.target;
        else if (req.kind === "techsTotal") techsTotal = req.target;
        else if (req.kind === "techsInEra") perEraTech.push({ era: req.era ?? 1, count: req.target });
      }
      world.civ.population = Math.max(1, population);
      const researched: string[] = [];
      for (const need of perEraTech) {
        const pool = TECH_DEFS.filter((t) => t.tier === need.era).map((t) => t.id);
        researched.push(...pool.slice(0, need.count));
      }
      for (const tech of TECH_DEFS) {
        if (researched.length >= techsTotal) break;
        if (!researched.includes(tech.id)) researched.push(tech.id);
      }
      world.tech.researched = researched;
      const buildings = createBuildingState({ camp: 1 });
      expect(canAdvanceEra(world.civ, world.tech, buildings, observatoryLevel), `E${target - 1}→E${target}`).toBe(
        true,
      );
      if (observatoryLevel > 0) {
        expect(
          canAdvanceEra(world.civ, world.tech, buildings, observatoryLevel - 1),
          `E${target - 1}→E${target} 观测不足`,
        ).toBe(false);
      }
    }
  });

  it("eraStatus 在 E6：next=null、无待满足条件、cannot advance；applyEraAdvance 封顶", () => {
    const world = createWorld({ era: 6 });
    const status = eraStatus(world.civ, world.tech, world.buildings, 6);
    expect(status.era).toBe(6);
    expect(status.next).toBeNull();
    expect(status.requirements).toEqual([]);
    expect(status.canAdvance).toBe(false);
    expect(canAdvanceEra(world.civ, world.tech, world.buildings, 7)).toBe(false);
    expect(applyEraAdvance(world.civ)).toBeNull();
    expect(world.civ.era).toBe(6);
  });

  it("applyEraAdvance 逐代推进返回新时代", () => {
    const civ = createCivilizationState({ difficulty: "normal", mode: "normal", seed: "E" });
    expect(civ.era).toBe(1);
    expect(applyEraAdvance(civ)).toBe(2);
    expect(civ.era).toBe(2);
    expect(applyEraAdvance(civ)).toBe(3);
    expect(applyEraAdvance(civ)).toBe(4);
    expect(applyEraAdvance(civ)).toBe(5);
    expect(applyEraAdvance(civ)).toBe(6);
    expect(civ.era).toBe(6);
    expect(applyEraAdvance(civ)).toBeNull();
  });

  it("资源解锁与建筑时代可用性：metals E2、energy E3", () => {
    expect(resourceUnlocked(1, "food")).toBe(true);
    expect(resourceUnlocked(1, "water")).toBe(true);
    expect(resourceUnlocked(1, "minerals")).toBe(true);
    expect(resourceUnlocked(1, "science")).toBe(true);
    expect(resourceUnlocked(1, "metals")).toBe(false);
    expect(resourceUnlocked(2, "metals")).toBe(true);
    expect(resourceUnlocked(2, "energy")).toBe(false);
    expect(resourceUnlocked(3, "energy")).toBe(true);
    expect(resourceUnlocked(5, "energy")).toBe(true);
    for (const [rid, era] of Object.entries(RESOURCE_UNLOCK_ERA)) {
      expect(resourceUnlocked(era, rid as ResourceId), `${rid} 应在第 ${era} 时代解锁`).toBe(true);
      if (era > 1) expect(resourceUnlocked(era - 1, rid as ResourceId), `${rid} 不应早于第 ${era} 时代解锁`).toBe(false);
    }

    const camp = getBuildingDef("camp")!;
    const coalPlant = getBuildingDef("coalPlant")!;
    expect(buildingEra(camp)).toBe(1);
    expect(buildingEra(coalPlant)).toBe(3);
    expect(isBuildingAvailableInEra(1, camp)).toBe(true);
    expect(isBuildingAvailableInEra(1, coalPlant)).toBe(false);
    expect(isBuildingAvailableInEra(3, coalPlant)).toBe(true);
  });

  it("旧时代折减等级：当前代 1 / 旧 1 代 0.8 / 旧 2 代以上 0.6", () => {
    const camp = getBuildingDef("camp")!;
    expect(outdatedMultiplier(1, camp)).toBe(1);
    expect(outdatedMultiplier(2, camp)).toBe(0.8);
    expect(outdatedMultiplier(3, camp)).toBe(0.6);
    expect(outdatedMultiplier(5, camp)).toBe(0.6);
  });

  it("resolveTurn 不再自动推进时代（eraChanged 恒为 null）", () => {
    const world = createWorld();
    world.civ.population = 900;
    world.tech.researched = ["astro_basic", "energy_basic"];
    world.buildings.counts["observatory"] = 1;
    const report = runTurn(world, makeEnvironment());
    expect(report.eraChanged).toBeNull();
    expect(report.era).toBe(1);
    expect(world.civ.era).toBe(1);
  });

  it("（legacy）eraInfo / eraScore 仍可用于旧 UI", () => {
    expect(eraScore(1, 0)).toBe(1);
    expect(eraScore(2, 0)).toBe(2);
    expect(eraScore(1, 4)).toBe(2);
    expect(eraScore(1, 16)).toBe(5);

    const civ = createCivilizationState({ difficulty: "normal", mode: "normal", seed: "E" });
    const e1 = eraInfo(civ, 1, 0);
    expect(e1.era).toBe(1);
    expect(e1.name).toBe("仰望星空");
    expect(e1.nextThreshold).toBe(2);
    expect(e1.progress).toBeGreaterThanOrEqual(0);
    expect(e1.progress).toBeLessThanOrEqual(1);
    expect(e1.name.length).toBeGreaterThan(0);
    const e6 = eraInfo(civ, 6, 0);
    expect(e6.era).toBe(6);
    expect(e6.progress).toBe(1);
  });
});

describe("中长期经济模拟（E1 起步 · 平衡底线）", () => {
  it("50 回合无操作：不崩、不 NaN、库存不溢出、人口合理", () => {
    const world = createWorld();
    const env = makeEnvironment();
    for (let i = 1; i <= 50; i++) {
      const report = runTurn(world, env);
      expectFiniteCiv(world.civ);
      expect(report.collapsed).toBe(false);
      expect(world.civ.alive).toBe(true);
    }
    expect(world.civ.population).toBeGreaterThan(500);
    expect(world.civ.population).toBeLessThan(2500);
    expect(world.civ.stability).toBeGreaterThan(20);
    expect(world.civ.stability).toBeLessThanOrEqual(100);
    expect(world.civ.populationHistory).toHaveLength(51);
    expect(world.civ.starvation).toBeLessThan(100);
  });

  it("60 年（120 回合）空转 easy/normal 不崩（规格平衡底线）", () => {
    for (const difficulty of ["easy", "normal"] as const) {
      const world = createWorld({ difficulty });
      const env = makeEnvironment();
      const reports = runTurns(world, env, 120);
      expect(reports.some((r) => r.collapsed), difficulty).toBe(false);
      expect(world.civ.alive, difficulty).toBe(true);
      expect(world.civ.era, difficulty).toBe(1); // 无操作时不会自动跳时代
      expect(world.civ.population, difficulty).toBeGreaterThan(400);
    }
  });

  it("玩家中期补建水井 + 研究火种科技后，文明继续增长到 50 回合", () => {
    const world = createWorld();
    const env = makeEnvironment();
    const techState = world.tech;
    let wellCompleted = false;

    for (let i = 1; i <= 50; i++) {
      if (i === 12) {
        const started = startConstruction(world.buildings, world.civ, getBuildingDef("well1")!, i * TURN_YEARS);
        expect(started.ok).toBe(true);
      }
      const advance = advanceConstruction(
        world.buildings,
        world.civ,
        1,
        constructionSpeed(world.civ, getTechMultipliers(techState).industry),
        BUILDING_DEFS,
      );
      if (advance.completedIds.includes("well1")) wellCompleted = true;

      if (i === 6) {
        expect(startResearch(techState, "energy_basic", 1).ok).toBe(true);
      }
      const budget = world.civ.resources.science.amount;
      const research = advanceResearch(techState, budget);
      if (research.spent > 0) world.civ.resources.science.amount -= research.spent;

      const report = runTurn(world, env, {
        buildingsCompleted: advance.completedIds,
        researchCompleted: research.completedId,
        researchedCount: techState.researched.length,
      });
      expect(report.collapsed).toBe(false);
      expectFiniteCiv(world.civ);
    }

    expect(wellCompleted).toBe(true);
    expect(techState.researched).toContain("energy_basic");
    expect(world.civ.flows.water.produced).toBeGreaterThan(180);
    expect(world.civ.alive).toBe(true);
  });
});

describe("胜利 / 失败判定", () => {
  it("殖民等级 + 自给率达到门槛触发星际文明胜利", () => {
    const world = createWorld({ era: 5 });
    world.civ.colony = makeColony({ level: 4, selfSufficiency: 0.85, population: 3200 });
    const report = runTurn(world, makeEnvironment());
    expect(report.victory).toBe(true);
    expect(report.victoryReason).toContain("星际");
    expect(world.civ.hasWon).toBe(true);
  });

  it("行星发动机建成触发流浪行星胜利", () => {
    const world = createWorld({ era: 5 });
    const report = runTurn(world, makeEnvironment(), { hasPlanetEngine: true });
    expect(report.victory).toBe(true);
    expect(report.victoryReason).toContain("行星");
    expect(world.civ.hasWon).toBe(true);
  });

  it("母星生态崩溃且无殖民地 → 失败；有三级殖民地则存活", () => {
    const world = createWorld();
    world.civ.population = 500;
    const dead = makeEnvironment({ habitability: 0.01, surfaceTempC: 300 });
    const defeat = checkDefeat(world.civ, dead);
    expect(defeat.defeated).toBe(true);
    expect(defeat.reason).toContain("母星");

    world.civ.colony = makeColony({ level: 3, population: 2000 });
    expect(checkDefeat(world.civ, dead).defeated).toBe(false);
  });

  it("人口归零 / 饥荒压力 / 母星湮灭都会导致崩溃", () => {
    const world = createWorld();
    world.civ.population = 0;
    expect(checkDefeat(world.civ, makeEnvironment()).defeated).toBe(true);

    const starved = createWorld();
    starved.civ.starvation = 100;
    expect(checkDefeat(starved.civ, makeEnvironment()).defeated).toBe(true);

    const lost = createWorld();
    const report = runTurn(lost, makeEnvironment(), { planetAlive: false });
    expect(report.collapsed).toBe(true);
    expect(report.collapseReason).toBeTruthy();
    expect(lost.civ.alive).toBe(false);

    const famine = createWorld();
    famine.civ.starvation = 120;
    const famineReport = runTurn(famine, makeEnvironment());
    expect(famineReport.collapsed).toBe(true);
    expect(famineReport.collapseReason).toContain("饥荒");
  });

  it("sandbox 模式下不会因稳定度 / 饥荒崩溃", () => {
    const world = createWorld({ mode: "sandbox" });
    world.civ.starvation = 120;
    const report = runTurn(world, makeEnvironment());
    expect(report.collapsed).toBe(false);
    expect(world.civ.alive).toBe(true);
  });
});

describe("殖民地与行星发动机", () => {
  it("startColony 需要科技 / 时代 / 资源，成功后扣除资源并可成长", () => {
    const world = createWorld({ era: 4 });
    grantResources(world.civ, { minerals: 3000, metals: 1600, energy: 1200 });
    const noTech = startColony(world.civ, world.tech, world.civ.resources, 20);
    expect(noTech.ok).toBe(false);
    expect(noTech.reason).toContain("星际殖民技术");

    world.tech.researched = ["space_basic", "space_orbital", "space_colony"];
    const ok = foundColony(world.civ, world.tech, world.civ.resources, 20);
    expect(ok.ok).toBe(true);
    expect(ok.colony).not.toBeNull();
    expect(world.civ.colony?.name).toBe("火种站");
    expect(world.civ.resources.minerals.amount).toBe(500);
    expect(world.civ.unlockFlags.colony).toBe(true);

    const again = startColony(world.civ, world.tech, world.civ.resources, 21);
    expect(again.ok).toBe(false);

    const before = world.civ.colony!.population;
    const growth = colonyReport(world.civ, makeEnvironment(), TURN_YEARS * 4);
    expect(world.civ.colony!.population).toBeGreaterThan(before);
    expect(growth.populationDelta).toBeGreaterThan(0);
  });

  it("殖民地人口跨过门槛会升级并写日志", () => {
    const world = createWorld();
    world.civ.colony = makeColony({ population: 599, level: 1, selfSufficiency: 0.4 });
    const report = colonyReport(world.civ, makeEnvironment(), TURN_YEARS);
    expect(world.civ.colony!.level).toBeGreaterThanOrEqual(2);
    expect(report.logs.some((l) => l.severity === "success")).toBe(true);
  });

  it("planetEngineReady 需要科技 + 第 5 时代 + 发动机建成", () => {
    const world = createWorld();
    expect(planetEngineReady(world.civ, world.buildings, world.tech)).toBe(false);

    world.tech.researched = ["space_basic", "space_orbital", "space_colony", "space_deep", "space_engine"];
    world.civ.era = 5;
    expect(planetEngineReady(world.civ, world.buildings, world.tech)).toBe(false);
    world.buildings.counts["planetEngine"] = 1;
    expect(planetEngineReady(world.civ, world.buildings, world.tech)).toBe(true);
  });
});

describe("辅助函数", () => {
  it("civilizationSummary 为中文简述，包含人口 / 稳定度 / 时代", () => {
    const world = createWorld();
    runTurn(world, makeEnvironment());
    const text = civilizationSummary(world.civ);
    expect(text).toContain("人口");
    expect(text).toContain("稳定度");
    expect(text).toContain("时代");
  });

  it("canAfford / assembleTurnContext 行为正确", () => {
    const world = createWorld();
    expect(canAfford(world.civ, { minerals: 100 }).ok).toBe(true);
    expect(canAfford(world.civ, { minerals: 999999 }).ok).toBe(false);

    const ctx = assembleTurnContext({
      civ: world.civ,
      env: makeEnvironment(),
      physics: { planetAlive: true } as never,
      buildingEffects: aggregateBuildingEffects(world.buildings, BUILDING_DEFS),
      techEffects: aggregateTechEffects(world.tech),
      techMultipliers: getTechMultipliers(world.tech),
      mode: "normal",
      difficulty: "normal",
      year: 1,
    });
    expect(ctx.years).toBe(TURN_YEARS);
    expect(ctx.crisis.foodMultiplier).toBe(1);
    expect(ctx.turn).toBe(world.civ.turn + 1);
    expect(ctx.era).toBeUndefined(); // 旧调用不传 era 时保持向后兼容
  });

  it("多次运行同一世界状态结果一致（可重复性）", () => {
    const run = () => {
      const world = createWorld();
      const env = makeEnvironment();
      runTurns(world, env, 10);
      return {
        pop: world.civ.population,
        stability: world.civ.stability,
        food: world.civ.resources.food.amount,
        water: world.civ.resources.water.amount,
        era: world.civ.era,
      };
    };
    expect(run()).toEqual(run());
  });
});
