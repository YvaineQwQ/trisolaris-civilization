import { describe, expect, it } from "vitest";
import { ERA_MAX, ERAS, OBSERVATORY_LEVELS, RESOURCE_UNLOCK_ERA } from "../../src/core/constants";
import {
  applyEraAdvance, canAdvanceEra, eraStatus, getEraDef, migrateLegacyEra, resourceUnlocked, techsInEra,
} from "../../src/civilization/eras";
import { createCivilizationState } from "../../src/civilization/state";
import { createBuildingState } from "../../src/buildings/system";
import { BUILDING_DEFS, BUILDING_DEF_MAP, buildingUpgradeChain, getBuildingDef } from "../../src/buildings/definitions";
import { aggregateBuildingEffects, describeEffects } from "../../src/buildings/system";
import { TECH_DEFS, getTechDef } from "../../src/technology/tree";
import { createTechState } from "../../src/technology/system";

const ERA_NAMES = ["仰望星空", "文明曙光", "蒸汽纪元", "电气纪元", "信息纪元", "文明的选择"];
const ERA_SUBTITLES = ["原始部落", "农业城邦", "蒸汽与钢铁", "电力与内燃机", "信息与早期航天", "星际文明"];

function researchedForEra(targetEra: number): string[] {
  const def = getEraDef(targetEra);
  const researched: string[] = [];
  let techsTotal = 0;
  const perEra: { era: number; count: number }[] = [];
  for (const req of def.requirements) {
    if (req.kind === "techsTotal") techsTotal = req.target;
    else if (req.kind === "techsInEra") perEra.push({ era: req.era ?? 1, count: req.target });
  }
  for (const need of perEra) {
    researched.push(...TECH_DEFS.filter((tech) => tech.tier === need.era).slice(0, need.count).map((tech) => tech.id));
  }
  for (const tech of TECH_DEFS) {
    if (researched.length >= techsTotal) break;
    if (!researched.includes(tech.id)) researched.push(tech.id);
  }
  return researched;
}

describe("v1.6 六时代常量", () => {
  it("ERA_MAX = 6，ERAS 六项且名称/副标题符合六时代设定", () => {
    expect(ERA_MAX).toBe(6);
    expect(ERAS.length).toBe(6);
    expect(ERAS.map((era) => era.era)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ERAS.map((era) => era.name)).toEqual(ERA_NAMES);
    expect(ERAS.map((era) => era.subtitle)).toEqual(ERA_SUBTITLES);
    for (const era of ERAS) {
      expect(era.description.length, era.name).toBeGreaterThan(10);
      expect(era.unlockSummary.length, era.name).toBeGreaterThan(10);
      if (era.era === 1) expect(era.requirements).toEqual([]);
      else expect(era.requirements.length, era.name).toBeGreaterThanOrEqual(3);
    }
    expect(getEraDef(0).era).toBe(1);
    expect(getEraDef(99).era).toBe(6);
  });

  it("时代条件可被满足：同代科技数量、观测等级与科技 tier 一致", () => {
    for (const era of ERAS) {
      for (const req of era.requirements) {
        if (req.kind === "techsInEra") {
          expect(TECH_DEFS.filter((tech) => tech.tier === (req.era ?? 1)).length, era.name).toBeGreaterThanOrEqual(req.target);
        }
      }
    }
    for (let level = 1; level <= 6; level += 1) {
      const info = OBSERVATORY_LEVELS[level];
      const tech = getTechDef(info.requiresTech!);
      expect(tech, info.requiresTech!).toBeDefined();
      expect(tech!.tier, "观测 Lv" + level).toBeLessThanOrEqual(info.requiresEra);
    }
    expect(RESOURCE_UNLOCK_ERA.metals).toBe(2);
    expect(RESOURCE_UNLOCK_ERA.energy).toBe(3);
  });

  it("逐代构造满足条件的文明，canAdvanceEra 为 true；E6 封顶", () => {
    for (const era of ERAS) {
      if (era.era === 1) continue;
      const civ = createCivilizationState({ difficulty: "normal", mode: "normal", seed: "V6-ERA" });
      civ.era = era.era - 1;
      const tech = createTechState();
      tech.researched = researchedForEra(era.era);
      let observatoryLevel = 0;
      for (const req of era.requirements) {
        if (req.kind === "population") civ.population = req.target;
        if (req.kind === "observatoryLevel") observatoryLevel = req.target;
      }
      const buildings = createBuildingState({ camp: 1 });
      expect(canAdvanceEra(civ, tech, buildings, observatoryLevel), "E" + (era.era - 1) + "→E" + era.era).toBe(true);
      expect(eraStatus(civ, tech, buildings, observatoryLevel).next?.era).toBe(era.era);
    }
    const civ = createCivilizationState({ difficulty: "normal", mode: "normal", seed: "V6-CAP" });
    civ.era = 6;
    expect(applyEraAdvance(civ)).toBeNull();
    expect(civ.era).toBe(6);
  });

  it("旧存档时代迁移：E3 保留、旧 E4→E5、旧 E5→E6", () => {
    expect(migrateLegacyEra(1)).toBe(1);
    expect(migrateLegacyEra(2)).toBe(2);
    expect(migrateLegacyEra(3)).toBe(3);
    expect(migrateLegacyEra(4)).toBe(5);
    expect(migrateLegacyEra(5)).toBe(6);
    expect(migrateLegacyEra(99)).toBe(6);
  });

  it("资源与科技的时代语义：蒸汽时代禁止电力/内燃机/无线电/计算机/卫星/空间站/核能", () => {
    const tier = (id: string): number => {
      const def = getTechDef(id);
      expect(def, id).toBeDefined();
      return def!.tier;
    };
    // E3 蒸汽：铁路与高压锅炉存在，电网/内燃机/无线电/电子计算机不在 E3
    expect(tier("energy_rail")).toBe(3);
    expect(tier("energy_boiler")).toBe(3);
    expect(tier("energy_electric")).toBeGreaterThanOrEqual(4);
    expect(tier("energy_internal_combustion")).toBeGreaterThanOrEqual(4);
    expect(tier("comp_radio")).toBeGreaterThanOrEqual(4);
    expect(tier("comp_electronic")).toBeGreaterThanOrEqual(4);
    expect(tier("energy_nuclear")).toBeGreaterThanOrEqual(4);
    expect(tier("energy_solar")).toBe(3); // 蒸汽动力
    // 卫星 / 火箭 / 空间站 / 星际殖民不得早于 E5
    for (const id of ["space_deep", "space_station", "space_lifesupport", "space_colony"]) {
      expect(tier(id), id).toBeGreaterThanOrEqual(5);
    }
    // 聚变不得早于 E5（电气纪元禁止核聚变）
    expect(tier("energy_fusion")).toBeGreaterThanOrEqual(5);
    // 核裂变允许在 E4 电气纪元
    expect(tier("energy_nuclear")).toBe(4);
    expect(resourceUnlocked(2, "energy")).toBe(false);
    expect(resourceUnlocked(3, "energy")).toBe(true);
  });

  it("时代推进后 techsInEra 统计使用科技 tier", () => {
    const state = createTechState();
    state.researched = ["astro_basic", "energy_basic", "industry_basic"];
    expect(techsInEra(state, 1)).toBe(3);
    expect(techsInEra(state, 2)).toBe(0);
    state.researched.push("astro_distance");
    expect(techsInEra(state, 2)).toBe(1);
  });
});

describe("v1.6 科学院建筑群（academy complex Lv.1–5）", () => {
  it("五级链完整、独立于学园与超算、每级研究速度 +8%..+40%", () => {
    const chain = buildingUpgradeChain("academyComplex");
    expect(chain.map((def) => def.id)).toEqual([
      "academyComplex1", "academyComplex2", "academyComplex3", "academyComplex4", "academyComplex5",
    ]);
    expect(chain.map((def) => def.era)).toEqual([2, 3, 4, 5, 6]);
    expect(chain.map((def) => def.tier)).toEqual([1, 2, 3, 4, 5]);
    const speeds = [0.08, 0.16, 0.24, 0.32, 0.4];
    chain.forEach((def, index) => {
      expect(def.effects.researchSpeed, def.id).toBeCloseTo(speeds[index], 9);
      expect(def.effects.research, def.id).toBeGreaterThan(0);
      expect(def.requiresTech.length, def.id).toBeGreaterThan(0);
      expect(def.requiresEra, def.id).toBe(def.era);
      expect(describeEffects(def).some((line) => line.includes("研究速度")), def.id).toBe(true);
      if (index < chain.length - 1) {
        expect(def.upgradeTo, def.id).toBe(chain[index + 1].id);
        const upgradeValues = Object.values(chain[index + 1].upgradeCost ?? {}) as number[];
        expect(upgradeValues.length, def.id).toBeGreaterThan(0);
        expect(upgradeValues.every((value) => value > 0), def.id).toBe(true);
      } else {
        expect(def.upgradeTo, def.id).toBeNull();
      }
    });
    // 独立于既有学园与超算：不在 research 主链内
    const researchChain = buildingUpgradeChain("research");
    expect(researchChain.map((def) => def.id)).toEqual([
      "elderHall", "academy", "scienceAcademy", "researchInstitute", "supercomputer", "quantumLab",
    ]);
    expect(researchChain.map((def) => def.id)).not.toContain("academyComplex1");
  });

  it("建筑效果聚合：等级研究速度进入 buildingEffects.researchSpeed，旧等级按时代折减", () => {
    const state = createBuildingState({ academyComplex3: 1 });
    const live = aggregateBuildingEffects(state, BUILDING_DEFS, 4);
    expect(live.researchSpeed).toBeCloseTo(0.24, 9);
    expect(live.research).toBe(90);
    const late = aggregateBuildingEffects(state, BUILDING_DEFS, 6);
    expect(late.researchSpeed).toBeLessThan(live.researchSpeed!);
    expect(late.researchSpeed).toBeCloseTo(0.24 * 0.6, 9);
    const empty = aggregateBuildingEffects(createBuildingState(), BUILDING_DEFS, 6);
    expect(empty.researchSpeed).toBe(0);
    // E2 的 Lv.1 只使用 E2 已解锁资源
    const level1 = getBuildingDef("academyComplex1")!;
    expect(level1.cost.energy ?? 0).toBe(0);
    expect(level1.maintenance.energy ?? 0).toBe(0);
    expect(BUILDING_DEF_MAP["academyComplex5"].era).toBe(6);
  });
});
