import { describe, it, expect } from "vitest";
import {
  BUILDING_DEFS,
  BUILDING_DEF_MAP,
  BUILDING_CATEGORY_ORDER,
  STARTING_BUILDINGS,
  advanceConstruction,
  aggregateBuildingEffects,
  buildingMaxCount,
  buildingUpgradeChain,
  capacityBonus,
  checkBuild,
  constructionProgress,
  constructionSpeed,
  costUsesOnlyEraResources,
  createBuildingState,
  createInitialBuildingState,
  describeEffects,
  getBuildingCount,
  getBuildingDef,
  getObservatoryBuildingLevel,
  isUniqueBuilding,
  staffingRatio,
  startConstruction,
  startUpgrade,
  totalBuiltCount,
  totalHousing,
  totalMaintenance,
  totalWorkers,
} from "../../src/buildings";
import { RESOURCE_UNLOCK_ERA } from "../../src/core/constants";
import type { ResourceId } from "../../src/core/types";
import { RESOURCE_IDS } from "../../src/civilization/resources";
import { aggregateTechEffects, TECH_MAP } from "../../src/technology";
import { createGameState } from "../../src/game/state";
import { Game } from "../../src/game/game";
import { MemorySaveStorage, setSaveStorage } from "../../src/save/storage";
import {
  createWorld,
  fillResources,
  grantResources,
  makeEnvironment,
  resourceAmounts,
  runTurn,
} from "./helpers";

/** 该时代已解锁资源的判定器（用于内容自检）。 */
function unlockedAt(era: number): (id: ResourceId) => boolean {
  return (id: ResourceId) => (RESOURCE_UNLOCK_ERA[id] ?? 1) <= era;
}

/** 主升级链的冻结内容（id / 时代 / 链内层级）。 */
const MAIN_CHAINS: Record<string, { ids: string[]; eras: number[]; tiers: number[] }> = {
  housing: {
    ids: ["camp", "townHouse", "housingDistrict", "apartmentBlock", "highRise", "ecodomeCity"],
    eras: [1, 2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5, 6],
  },
  food: {
    ids: ["farm1", "irrigatedFarm", "mechanizedFarm", "fertilizedFarm", "verticalFarm", "biosphereFarm"],
    eras: [1, 2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5, 6],
  },
  water: {
    ids: ["well1", "aqueduct", "waterPlant", "sewagePlant", "recyclingPlant", "atmosphericWater"],
    eras: [1, 2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5, 6],
  },
  industry: {
    ids: ["quarry1", "mine", "steelMill", "electrifiedFactory", "automatedMine", "nanoFactory"],
    eras: [1, 2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5, 6],
  },
  research: {
    ids: ["elderHall", "academy", "scienceAcademy", "researchInstitute", "supercomputer", "quantumLab"],
    eras: [1, 2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5, 6],
  },
  energy: {
    ids: ["coalPlant", "nuclearPlant", "fusionReactor"],
    eras: [3, 4, 5],
    tiers: [1, 2, 3],
  },
  academyComplex: {
    ids: ["academyComplex1", "academyComplex2", "academyComplex3", "academyComplex4", "academyComplex5"],
    eras: [2, 3, 4, 5, 6],
    tiers: [1, 2, 3, 4, 5],
  },
};

describe("建筑内容自检（v1.6 · 六时代 48 座）", () => {
  it("共 48 座建筑、id 唯一，六个时代每代至少 5 座可新建", () => {
    expect(BUILDING_DEFS.length).toBe(48);
    const ids = BUILDING_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !BUILDING_DEF_MAP[id])).toEqual([]);

    for (let era = 1; era <= 6; era++) {
      const list = BUILDING_DEFS.filter((d) => d.era === era);
      expect(list.length, `第 ${era} 时代可新建建筑不足 5 座`).toBeGreaterThanOrEqual(5);
    }
    // 时代分布（内容冻结值）
    expect([1, 2, 3, 4, 5, 6].map((era) => BUILDING_DEFS.filter((d) => d.era === era).length)).toEqual([
      6, 7, 9, 8, 9, 9,
    ]);
    // 四个分类都有建筑
    for (const category of BUILDING_CATEGORY_ORDER) {
      expect(BUILDING_DEFS.some((d) => d.category === category), category).toBe(true);
    }
  });

  it("每座建筑字段完整，前置科技真实存在且不晚于建筑时代", () => {
    for (const def of BUILDING_DEFS) {
      expect(def.name.length, def.id).toBeGreaterThan(0);
      expect(def.description.length, def.id).toBeGreaterThan(0);
      expect(def.icon.length, def.id).toBeGreaterThan(0);
      expect(BUILDING_CATEGORY_ORDER).toContain(def.category);
      expect(def.era, def.id).toBeGreaterThanOrEqual(1);
      expect(def.era, def.id).toBeLessThanOrEqual(6);
      expect(def.requiresEra, `${def.id} requiresEra 必须与 era 一致`).toBe(def.era);
      expect(def.tier, `${def.id} tier`).toBeGreaterThanOrEqual(1);
      expect(def.buildTurns, `${def.id} 工期`).toBeGreaterThanOrEqual(1);
      expect(def.workers, `${def.id} 工人`).toBeGreaterThanOrEqual(0);
      expect(def.upgradeGroup, `${def.id} 升级分组`).toBeTruthy();
      expect(Object.keys(def.cost).length, `${def.id} 成本不能为空`).toBeGreaterThan(0);
      for (const [rid, value] of Object.entries(def.cost)) {
        expect(RESOURCE_IDS, `${def.id} 成本使用未知资源 ${rid}`).toContain(rid);
        expect(value, `${def.id} 成本 ${rid}`).toBeGreaterThan(0);
      }
      for (const [rid, value] of Object.entries(def.maintenance)) {
        expect(RESOURCE_IDS, `${def.id} 维护使用未知资源 ${rid}`).toContain(rid);
        expect(value, `${def.id} 维护 ${rid}`).toBeGreaterThanOrEqual(0);
      }
      expect(describeEffects(def).length, `${def.id} 没有可展示的效果`).toBeGreaterThan(0);
      for (const techId of def.requiresTech) {
        const tech = TECH_MAP[techId];
        expect(tech, `${def.id} 依赖未知科技 ${techId}`).toBeDefined();
        expect(tech.tier, `${def.id} 的前置科技 ${techId} 晚于建筑时代`).toBeLessThanOrEqual(def.era!);
      }
      if (def.maxCount !== undefined) expect(def.maxCount, def.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("E1 建筑的成本 / 维护 / 升级成本只使用 food-water-minerals-science（无 metals、无 energy）", () => {
    const e1 = BUILDING_DEFS.filter((d) => d.era === 1);
    expect(e1.length).toBeGreaterThanOrEqual(5);
    for (const def of e1) {
      for (const rid of ["metals", "energy"] as ResourceId[]) {
        expect(def.cost[rid] ?? 0, `${def.id} 成本含 ${rid}`).toBe(0);
        expect(def.maintenance[rid] ?? 0, `${def.id} 维护含 ${rid}`).toBe(0);
        expect(def.upgradeCost?.[rid] ?? 0, `${def.id} 升级成本含 ${rid}`).toBe(0);
      }
      expect(costUsesOnlyEraResources(def, unlockedAt(1)), def.id).toBe(true);
    }
    // E1 初始建筑集合中不存在 metals / energy 产出
    const initial = aggregateBuildingEffects(createInitialBuildingState(), BUILDING_DEFS, 1);
    expect(initial.production!.energy).toBe(0);
    expect(initial.production!.metals).toBe(0);
  });

  it("E2 建筑仍不使用 energy（能源自 E3 解锁），E3 起能源进入成本 / 维护", () => {
    const e2 = BUILDING_DEFS.filter((d) => d.era === 2);
    expect(e2.length).toBeGreaterThanOrEqual(5);
    for (const def of e2) {
      expect(def.cost.energy ?? 0, `${def.id} 成本含 energy`).toBe(0);
      expect(def.maintenance.energy ?? 0, `${def.id} 维护含 energy`).toBe(0);
      expect(def.upgradeCost?.energy ?? 0, `${def.id} 升级成本含 energy`).toBe(0);
      expect(costUsesOnlyEraResources(def, unlockedAt(2)), def.id).toBe(true);
    }
    const e3 = BUILDING_DEFS.filter((d) => d.era === 3);
    expect(e3.some((d) => (d.cost.energy ?? 0) > 0 || (d.maintenance.energy ?? 0) > 0)).toBe(true);

    // 全体建筑：成本 / 维护 / 升级成本只能使用其所属时代已解锁资源
    for (const def of BUILDING_DEFS) {
      expect(costUsesOnlyEraResources(def, unlockedAt(def.era ?? 1)), `${def.id} 使用了未解锁资源`).toBe(true);
    }
  });

  it("主升级链完整：housing/food/water/industry/research 各 6 级，energy 3 级，科学院建筑群 5 级", () => {
    for (const [group, spec] of Object.entries(MAIN_CHAINS)) {
      const chain = buildingUpgradeChain(group);
      expect(chain.map((d) => d.id), group).toEqual(spec.ids);
      expect(chain.map((d) => d.era), group).toEqual(spec.eras);
      expect(chain.map((d) => d.tier), group).toEqual(spec.tiers);
      for (let i = 0; i < chain.length; i++) {
        const node = chain[i];
        expect(node.upgradeGroup, `${node.id} 分组`).toBe(group);
        if (i === chain.length - 1) {
          expect(node.upgradeTo, `${node.id} 应为链末端`).toBeNull();
        } else {
          expect(node.upgradeTo, `${node.id} 升级目标`).toBe(chain[i + 1].id);
        }
      }
    }
  });

  it("升级目标合法：同组、时代+1、tier+1，且 upgradeCost / upgradeTurns 完整且低于新建成本", () => {
    for (const def of BUILDING_DEFS) {
      if (!def.upgradeTo) continue;
      const target = BUILDING_DEF_MAP[def.upgradeTo];
      expect(target, `${def.id} 升级目标 ${def.upgradeTo} 缺失`).toBeDefined();
      expect(target.upgradeGroup).toBe(def.upgradeGroup);
      expect(target.era).toBe(def.era! + 1);
      expect(target.tier).toBe(def.tier! + 1);
      expect(target.upgradeTurns ?? 0, `${target.id} 升级工期`).toBeGreaterThanOrEqual(1);

      const upgradeCost = target.upgradeCost ?? {};
      expect(Object.keys(upgradeCost).length, `${target.id} 缺少 upgradeCost`).toBeGreaterThan(0);
      for (const [rid, value] of Object.entries(upgradeCost)) {
        expect(value, `${target.id} 升级成本 ${rid}`).toBeGreaterThan(0);
        const newBuildCost = target.cost[rid as ResourceId] ?? 0;
        expect(value, `${target.id} 升级成本 ${rid} 不应高于新建成本`).toBeLessThanOrEqual(newBuildCost);
        // 平衡口径：升级成本约为目标建筑新建成本的 45%~80%
        expect(value / newBuildCost, `${target.id} 升级成本 ${rid} 占比`).toBeGreaterThanOrEqual(0.45);
        expect(value / newBuildCost, `${target.id} 升级成本 ${rid} 占比`).toBeLessThanOrEqual(0.8);
      }
    }
  });

  it("每个有前置的升级目标都定义了非空 upgradeCost（升级链不缺价）", () => {
    const targets = BUILDING_DEFS.map((d) => d.upgradeTo).filter((id): id is string => id !== null);
    expect(targets.length).toBeGreaterThan(5);
    for (const id of targets) {
      const target = BUILDING_DEF_MAP[id];
      expect(target, id).toBeDefined();
      expect(Object.keys(target.upgradeCost ?? {}).length, `${target.id} 缺少 upgradeCost`).toBeGreaterThan(0);
    }
  });

  it("观星台与终局建筑唯一；数量上限合法", () => {
    const observatory = getBuildingDef("observatory")!;
    expect(observatory.era).toBe(1);
    expect(observatory.maxCount).toBe(1);
    expect(observatory.observationLevel).toBe(1);
    expect(observatory.cost.energy ?? 0).toBe(0);
    expect(observatory.upgradeTo).toBeNull();
    expect(isUniqueBuilding("observatory")).toBe(true);
    expect(isUniqueBuilding("planetEngine")).toBe(true);
    expect(isUniqueBuilding("colonyBase")).toBe(true);
    expect(buildingMaxCount("farm1")).toBe(20);
    expect(buildingMaxCount("planetEngine")).toBe(1);
    expect(buildingMaxCount("no-such-building")).toBe(0);
  });

  it("开局建筑为原始聚落：camp×1 / farm1×2 / well1×1 / quarry1×1，不含观星台与 E2+ 建筑", () => {
    expect({ ...STARTING_BUILDINGS }).toEqual({ camp: 1, farm1: 2, well1: 1, quarry1: 1 });
    const state = createInitialBuildingState();
    expect(state).toEqual({
      counts: { camp: 1, farm1: 2, well1: 1, quarry1: 1 },
      queue: [],
      nextJobId: 1,
    });
    for (const id of Object.keys(state.counts)) {
      expect(getBuildingDef(id)!.era, id).toBe(1);
    }
    expect(getBuildingCount(state, "observatory")).toBe(0);
    expect(totalBuiltCount(state)).toBe(5);
    expect(totalWorkers(state, BUILDING_DEFS)).toBe(86);
    expect(totalMaintenance(state, BUILDING_DEFS)).toEqual({ minerals: 2, water: 16, food: 8 });
    expect(totalHousing(state, BUILDING_DEFS)).toBe(220);
    expect(getObservatoryBuildingLevel(state, BUILDING_DEFS)).toBe(0);
  });
});

describe("建造前置检查 checkBuild", () => {
  it("时代不足 / 科技不足 / 未知建筑 / 唯一建筑 的拒绝原因", () => {
    const world = createWorld({ era: 1 });
    const fx = aggregateTechEffects(world.tech);

    const eraBlocked = checkBuild("housingDistrict", world.civ, world.buildings, world.tech, fx, "normal");
    expect(eraBlocked.ok).toBe(false);
    expect(eraBlocked.reason).toContain("第 3 时代");
    const eraBlocked2 = checkBuild("mechanizedFarm", world.civ, world.buildings, world.tech, fx, "normal");
    expect(eraBlocked2.ok).toBe(false);
    expect(eraBlocked2.reason).toContain("第 3 时代");

    const unknown = checkBuild("not-a-building", world.civ, world.buildings, world.tech, fx, "normal");
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toContain("未知建筑");

    const withObservatory = createBuildingState({ camp: 1, observatory: 1 });
    const dup = checkBuild("observatory", world.civ, withObservatory, world.tech, fx, "normal");
    expect(dup.ok).toBe(false);
    expect(dup.reason).toContain("唯一");

    // 时代满足后，缺少前置科技
    world.civ.era = 3;
    fillResources(world.civ);
    const noTech = checkBuild("mechanizedFarm", world.civ, world.buildings, world.tech, fx, "normal");
    expect(noTech.ok).toBe(false);
    expect(noTech.reason).toContain("科技");
    expect(noTech.reason).toContain("青铜与轮轴");

    world.tech.researched = ["industry_basic", "industry_automation"];
    const withTech = checkBuild(
      "mechanizedFarm",
      world.civ,
      world.buildings,
      world.tech,
      aggregateTechEffects(world.tech),
      "normal",
    );
    expect(withTech.ok).toBe(true);

    // 资源不足
    world.civ.resources.minerals.amount = 0;
    const broke = checkBuild(
      "mechanizedFarm",
      world.civ,
      world.buildings,
      world.tech,
      aggregateTechEffects(world.tech),
      "normal",
    );
    expect(broke.ok).toBe(false);
    expect(broke.reason).toContain("资源不足");
    expect(broke.reason).toContain("矿物");
  });

  it("sandbox 模式绕过时代与科技门槛，但仍需资源与数量上限", () => {
    const world = createWorld({ mode: "sandbox", era: 1 });
    fillResources(world.civ);
    const fx = aggregateTechEffects(world.tech);

    const sandbox = checkBuild("housingDistrict", world.civ, world.buildings, world.tech, fx, "sandbox");
    expect(sandbox.ok).toBe(true);
    const engine = checkBuild("planetEngine", world.civ, world.buildings, world.tech, fx, "sandbox");
    expect(engine.ok).toBe(true);

    world.civ.resources.minerals.amount = 0;
    const broke = checkBuild("housingDistrict", world.civ, world.buildings, world.tech, fx, "sandbox");
    expect(broke.ok).toBe(false);
    expect(broke.reason).toContain("资源不足");
  });
});

describe("施工流程 startConstruction / advanceConstruction", () => {
  it("开工扣除成本并入队，工期结束后写入数量", () => {
    const world = createWorld();
    const def = getBuildingDef("farm1")!;
    const before = resourceAmounts(world.civ);

    const start = startConstruction(world.buildings, world.civ, def, 0);
    expect(start).toEqual({ ok: true, reason: null, jobId: 1 });
    expect(world.buildings.queue).toHaveLength(1);
    expect(world.buildings.queue[0]).toMatchObject({
      id: 1,
      buildingId: "farm1",
      turnsLeft: 2,
      totalTurns: 2,
      startedYear: 0,
    });
    const after = resourceAmounts(world.civ);
    expect(after.minerals).toBeCloseTo(before.minerals - (def.cost.minerals ?? 0), 9);
    expect(after.food).toBeCloseTo(before.food - (def.cost.food ?? 0), 9);
    expect(after.water).toBe(before.water);

    // farm1 工期 2 回合
    let advance = advanceConstruction(world.buildings, world.civ, 1, 1, BUILDING_DEFS);
    expect(advance.completedIds).toEqual([]);
    expect(getBuildingCount(world.buildings, "farm1")).toBe(2);
    advance = advanceConstruction(world.buildings, world.civ, 1, 1, BUILDING_DEFS);
    expect(advance.completedIds).toEqual(["farm1"]);
    expect(getBuildingCount(world.buildings, "farm1")).toBe(3);
    expect(world.buildings.queue).toHaveLength(0);
  });

  it("工业倍率会加快工期", () => {
    const world = createWorld();
    const observatory = getBuildingDef("observatory")!;
    expect(startConstruction(world.buildings, world.civ, observatory, 0).ok).toBe(true);
    // 工期 4 回合，工业倍率 2 → 两回合完工
    advanceConstruction(world.buildings, world.civ, 1, 2, BUILDING_DEFS);
    const second = advanceConstruction(world.buildings, world.civ, 1, 2, BUILDING_DEFS);
    expect(second.completedIds).toEqual(["observatory"]);
    expect(getBuildingCount(world.buildings, "observatory")).toBe(1);
  });

  it("资源不足 / 数量上限 / 未知建筑时无法开工", () => {
    const world = createWorld();
    const observatory = getBuildingDef("observatory")!;
    const dupState = createBuildingState({ camp: 1, observatory: 1 });
    const dup = startConstruction(dupState, world.civ, observatory, 0);
    expect(dup.ok).toBe(false);
    expect(dup.reason).toContain("上限");

    world.civ.resources.minerals.amount = 0;
    const broke = startConstruction(world.buildings, world.civ, getBuildingDef("farm1")!, 0);
    expect(broke.ok).toBe(false);
    expect(broke.reason).toContain("资源不足");
  });
});

describe("升级流程 startUpgrade", () => {
  it("扣除目标建筑 upgradeCost 入队，完工后旧建筑 -1 / 新建筑 +1", () => {
    const world = createWorld({ era: 2, resources: { minerals: 1000, food: 1000 } });
    const source = getBuildingDef("camp")!;
    const target = getBuildingDef("townHouse")!;
    const before = resourceAmounts(world.civ);

    const result = startUpgrade(world.buildings, world.civ, source, target, 1);
    expect(result.ok).toBe(true);
    expect(result.jobId).toBe(1);
    expect(world.civ.industryUsed).toBe(1);
    const after = resourceAmounts(world.civ);
    expect(after.minerals).toBeCloseTo(before.minerals - (target.upgradeCost!.minerals ?? 0), 9);
    expect(after.food).toBeCloseTo(before.food - (target.upgradeCost!.food ?? 0), 9);

    const job = world.buildings.queue[0];
    expect(job).toMatchObject({
      buildingId: "townHouse",
      upgradeFrom: "camp",
      turnsLeft: 3,
      totalTurns: 3,
    });
    expect(job.upgradePaid).toEqual(target.upgradeCost);

    // 工期 3 回合
    expect(advanceConstruction(world.buildings, world.civ, 1, 1, BUILDING_DEFS).completedIds).toEqual([]);
    expect(advanceConstruction(world.buildings, world.civ, 1, 1, BUILDING_DEFS).completedIds).toEqual([]);
    const done = advanceConstruction(world.buildings, world.civ, 1, 1, BUILDING_DEFS);
    expect(done.completedIds).toEqual(["townHouse"]);
    expect(getBuildingCount(world.buildings, "camp")).toBe(0);
    expect(world.buildings.counts["camp"]).toBeUndefined();
    expect(getBuildingCount(world.buildings, "townHouse")).toBe(1);
    expect(world.civ.industryUsed).toBe(0);
  });

  it("拒绝：时代不足 / 未拥有 / 升级链不匹配 / 该建筑全部在升级中", () => {
    const era1 = createWorld({ era: 1, resources: { minerals: 2000, food: 2000 } });
    const early = startUpgrade(
      era1.buildings,
      era1.civ,
      getBuildingDef("camp")!,
      getBuildingDef("townHouse")!,
      0,
    );
    expect(early.ok).toBe(false);
    expect(early.reason).toContain("第 2 时代");

    const world = createWorld({ era: 2, resources: { minerals: 2000, food: 2000 } });
    const mismatch = startUpgrade(
      world.buildings,
      world.civ,
      getBuildingDef("camp")!,
      getBuildingDef("farm1")!,
      0,
    );
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toContain("无法升级");

    const empty = createBuildingState({});
    const noOwn = startUpgrade(empty, world.civ, getBuildingDef("camp")!, getBuildingDef("townHouse")!, 0);
    expect(noOwn.ok).toBe(false);
    expect(noOwn.reason).toContain("尚未建造");

    const camp = getBuildingDef("camp")!;
    const town = getBuildingDef("townHouse")!;
    expect(startUpgrade(world.buildings, world.civ, camp, town, 0).ok).toBe(true);
    const second = startUpgrade(world.buildings, world.civ, camp, town, 0);
    expect(second.ok).toBe(false);
    expect(second.reason).toContain("升级中");
  });
});

describe("取消施工（game 层集成：返还 50%）", () => {
  it("取消建造返还一半成本；取消升级返还一半 upgradePaid", () => {
    setSaveStorage(new MemorySaveStorage());
    const state = createGameState({ seed: "ERA-CANCEL-TEST", difficulty: "normal", mode: "normal" });
    const game = new Game(state, { onReturnToMenu: () => {}, autosaveIntervalSeconds: 0 });
    const civ = state.civ;

    // 建造：farm1 成本 minerals 80 / food 40
    const farm = getBuildingDef("farm1")!;
    const beforeBuild = resourceAmounts(civ);
    game.startBuilding("farm1");
    expect(state.buildings.queue).toHaveLength(1);
    expect(resourceAmounts(civ).minerals).toBeCloseTo(beforeBuild.minerals - (farm.cost.minerals ?? 0), 9);
    const buildJob = state.buildings.queue[0];
    game.cancelConstruction(buildJob.id);
    expect(state.buildings.queue).toHaveLength(0);
    expect(resourceAmounts(civ).minerals).toBeCloseTo(
      beforeBuild.minerals - (farm.cost.minerals ?? 0) * 0.5,
      9,
    );
    expect(resourceAmounts(civ).food).toBeCloseTo(beforeBuild.food - (farm.cost.food ?? 0) * 0.5, 9);

    // 升级：camp → townHouse（E2 才能升级），取消返还 upgradePaid 的 50%
    civ.era = 2;
    grantResources(civ, { minerals: 2000, food: 2000 });
    const town = getBuildingDef("townHouse")!;
    const beforeUpgrade = resourceAmounts(civ);
    game.upgradeBuilding("camp");
    expect(state.buildings.queue).toHaveLength(1);
    const upgradeJob = state.buildings.queue[0];
    expect(upgradeJob.upgradeFrom).toBe("camp");
    expect(upgradeJob.upgradePaid).toEqual(town.upgradeCost);
    game.cancelConstruction(upgradeJob.id);
    expect(state.buildings.queue).toHaveLength(0);
    expect(resourceAmounts(civ).minerals).toBeCloseTo(
      beforeUpgrade.minerals - (town.upgradeCost!.minerals ?? 0) * 0.5,
      9,
    );
    expect(resourceAmounts(civ).food).toBeCloseTo(
      beforeUpgrade.food - (town.upgradeCost!.food ?? 0) * 0.5,
      9,
    );
    // 取消不存在的工程是安全 no-op
    expect(() => game.cancelConstruction(99999)).not.toThrow();
  });
});

describe("建筑效果聚合与时代折减 aggregateBuildingEffects", () => {
  it("开局聚落：住房 220 / 食物 220 / 水 120 / 矿物 40 / 稳定 +1，无能源与金属产出", () => {
    const state = createInitialBuildingState();
    const effects = aggregateBuildingEffects(state, BUILDING_DEFS, 1);
    expect(effects.housing).toBe(220);
    expect(effects.production!.food).toBe(220);
    expect(effects.production!.water).toBe(120);
    expect(effects.production!.minerals).toBe(40);
    expect(effects.production!.energy).toBe(0);
    expect(effects.production!.metals).toBe(0);
    expect(effects.research).toBe(0);
    expect(effects.stability).toBe(1);
    expect(capacityBonus(state, BUILDING_DEFS, 1).food).toBe(0);
  });

  it("不传 era 与 era=1 完全一致；旧 1 个时代 ×0.8、旧 2 个及以上 ×0.6", () => {
    const state = createInitialBuildingState();
    const legacy = aggregateBuildingEffects(state, BUILDING_DEFS);
    const current = aggregateBuildingEffects(state, BUILDING_DEFS, 1);
    expect(legacy).toEqual(current);

    const e2 = aggregateBuildingEffects(state, BUILDING_DEFS, 2);
    expect(e2.housing).toBeCloseTo(220 * 0.8, 9);
    expect(e2.production!.food).toBeCloseTo(220 * 0.8, 9);
    expect(e2.production!.water).toBeCloseTo(120 * 0.8, 9);
    expect(e2.stability).toBeCloseTo(1 * 0.8, 9);

    for (const era of [3, 4, 5]) {
      const outdated = aggregateBuildingEffects(state, BUILDING_DEFS, era);
      expect(outdated.housing, `era ${era} 住房折减`).toBeCloseTo(220 * 0.6, 9);
      expect(outdated.production!.food, `era ${era} 食物折减`).toBeCloseTo(220 * 0.6, 9);
      expect(outdated.production!.minerals, `era ${era} 矿物折减`).toBeCloseTo(40 * 0.6, 9);
    }
    // 折减只作用于产出类效果；维护与工人不折减
    expect(totalMaintenance(state, BUILDING_DEFS)).toEqual({ minerals: 2, water: 16, food: 8 });
  });

  it("混合时代建筑在 era=3 分别按 0.6 / 0.8 折减", () => {
    const mixed = createBuildingState({ camp: 1, townHouse: 1 });
    const e2 = aggregateBuildingEffects(mixed, BUILDING_DEFS, 2);
    expect(e2.housing).toBeCloseTo(220 * 0.8 + 620, 9); // camp 旧 1 代，townHouse 当前代
    const e3 = aggregateBuildingEffects(mixed, BUILDING_DEFS, 3);
    expect(e3.housing).toBeCloseTo(220 * 0.6 + 620 * 0.8, 9);
    expect(e3.stability).toBeCloseTo(1 * 0.6 + 2 * 0.8, 9);
    const legacy = aggregateBuildingEffects(mixed, BUILDING_DEFS);
    expect(legacy.housing).toBe(220 + 620);
  });

  it("效果描述为中文，覆盖产出 / 住房 / 科研 / 仓储 / 观测", () => {
    expect(describeEffects(getBuildingDef("farm1")!).join("")).toContain("食物");
    expect(describeEffects(getBuildingDef("camp")!).join("")).toContain("住房");
    expect(describeEffects(getBuildingDef("elderHall")!).join("")).toContain("科研");
    expect(describeEffects(getBuildingDef("observatory")!).join("")).toContain("观测质量");
    expect(describeEffects(getBuildingDef("market")!).join("")).toContain("仓储上限");
    expect(describeEffects(getBuildingDef("planetEngine")!).join("")).toContain("殖民");
  });

  it("劳动力充足率 / 施工速度 / 观测等级辅助函数", () => {
    const world = createWorld();
    expect(staffingRatio(world.civ, 86)).toBe(1);
    expect(staffingRatio(world.civ, 550)).toBeCloseTo(0.5, 9);
    const slow = constructionSpeed(world.civ, 1);
    world.civ.industryCapacity = 325;
    expect(constructionSpeed(world.civ, 1)).toBeGreaterThan(slow);
    expect(constructionProgress(0, 3)).toBe(1);
    expect(constructionProgress(3, 3)).toBe(0);
    const state = createBuildingState({ observatory: 1 });
    expect(getObservatoryBuildingLevel(state, BUILDING_DEFS)).toBe(1);
    expect(totalBuiltCount(state)).toBe(1);
  });

  it("建筑效果进入回合结算：额外原始农田提高食物产出，且 E1 无能源消耗", () => {
    const baseline = createWorld();
    const more = createWorld();
    more.buildings.counts["farm1"] = (more.buildings.counts["farm1"] ?? 0) + 1;
    const env = makeEnvironment();
    const baselineReport = runTurn(baseline, env);
    const moreReport = runTurn(more, env);
    expect(baselineReport.collapsed).toBe(false);
    expect(moreReport.collapsed).toBe(false);
    expect(more.civ.flows.food.produced).toBeGreaterThan(baseline.civ.flows.food.produced);
    expect(baseline.civ.flows.energy.consumed).toBe(0);
    expect(baseline.civ.flows.energy.produced).toBe(0);
  });
});
