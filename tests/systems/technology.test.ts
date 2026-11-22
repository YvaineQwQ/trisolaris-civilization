import { describe, expect, it } from "vitest";
import {
  DOCTRINE_GROUPS,
  TECH_BRANCHES,
  TECH_BRANCH_ORDER,
  TECH_CATEGORIES,
  TECH_CATEGORY_ORDER,
  TECH_DEFS,
  TECH_MAP,
  TECH_SCHOOLS,
  TECH_SCHOOL_ORDER,
  activeResearchInfo,
  activeTechDef,
  advanceResearch,
  aggregateTechEffects,
  applyResearchBoost,
  applyDoctrine,
  branchProgress,
  canResearch,
  cancelResearch,
  categoryTechCount,
  chooseDoctrine,
  clampTechEra,
  createTechState,
  developmentProgramInfo,
  doctrineGroups,
  doctrineLockReason,
  doctrineTechs,
  fundingModifiers,
  getDoctrineGroupMeta,
  getTechDef,
  getTechMultipliers,
  isDoctrineTech,
  isLegacyTechState,
  isResearched,
  normalizeTechState,
  researchCategoryFor,
  researchFundingPercent,
  researchBoostQuote,
  researchCostFor,
  researchSpeedFor,
  schoolMastery,
  schoolPointTotal,
  schoolPointsFor,
  setDevelopmentCategories,
  setResearchFunding,
  setSchoolFocus,
  startResearch,
  syncSchoolPoints,
  techChainCost,
  techDisplayName,
  techName,
  techSchoolOf,
  techsAvailableInEra,
  techsByBranch,
  techsByCategory,
  techsInTier,
  totalTechCost,
  CROSS_SCHOOL_PENALTY,
  DEVELOPMENT_FOCUS_BONUS,
  DEVELOPMENT_NEGLECT_PENALTY,
  FOCUS_SPEED_BONUS,
  MASTERY_EFFECT_BONUS,
  RESEARCH_FUNDING_MAX_SPEED,
  RESEARCH_FUNDING_MIN_SPEED,
} from "../../src/technology";
import type { TechState } from "../../src/core/types";
import { ERA_MAX, ERAS, OBSERVATORY_LEVELS } from "../../src/core/constants";

const ASTRO_CHAIN = [
  "astro_basic",
  "astro_distance",
  "astro_orbit",
  "astro_threebody",
  "astro_chaos",
  "astro_supernet",
] as const;

/** 旧 v1.3 的 72 个科技 id 全部保留（存档 / 事件引用兼容）。 */
const LEGACY_IDS = [
  "astro_basic","astro_distance","astro_orbit","astro_spectra","astro_threebody","astro_gravwave",
  "astro_chaos","astro_supernet","astro_watch",
  "energy_basic","energy_grid","energy_wind","energy_solar","energy_coal","energy_nuclear",
  "energy_solar_array","energy_fusion","energy_zero",
  "industry_basic","industry_automation","industry_ceramics","industry_alloys","industry_chemistry",
  "industry_megastructure","industry_precision","industry_quantum","industry_orbital_belt",
  "bio_basic","bio_medicine","bio_preserve","bio_ecology","bio_breeding","bio_genetic",
  "bio_gene_design","bio_symbiosis","bio_biosphere",
  "space_basic","space_orbital","space_lifesupport","space_colony","space_station","space_deep",
  "space_ion","space_engine","space_arkship",
  "comp_abacus","comp_mechanism","comp_archive","comp_electronic","comp_crypto","comp_central",
  "comp_distributed","comp_ai","comp_quantum",
  "society_tribe","society_law","society_market","society_bureau","society_publicschool",
  "society_technocracy","society_military_order","society_commune","society_cohesion",
  "mil_watch","mil_wall","mil_bronze","mil_fortress","mil_mobile","mil_radar","mil_bunker",
  "mil_planetary","mil_fleet",
] as const;

const TOTAL_TECHS = 192;
const PER_TIER = [20, 25, 24, 35, 42, 46];

function stateWith(researched: string[], patch: Partial<TechState> = {}): TechState {
  const state = createTechState();
  state.researched = [...researched];
  Object.assign(state, patch);
  return state;
}

/** 递归研究前置链（用真实系统 API），返回完成后的状态。 */
function researchedState(ids: string[], era = 6): TechState {
  const state = createTechState();
  const finish = (id: string): void => {
    if (!getTechDef(id) || isResearched(state, id)) return;
    for (const req of getTechDef(id)!.requires) finish(req);
    const def = getTechDef(id)!;
    expect(startResearch(state, id, Math.max(era, def.tier)).ok).toBe(true);
    expect(advanceResearch(state, def.cost * 4 + 100).completedId).toBe(id);
  };
  for (const id of ids) finish(id);
  return state;
}

describe("科技树 v6 完整性（192 项 · 9 分支 · 6 时代）", () => {
  it("总量 >=180、9 分支、分支元数据完整、每支 >=20 项", () => {
    expect(TECH_DEFS.length).toBeGreaterThanOrEqual(180);
    expect(TECH_DEFS.length).toBe(TOTAL_TECHS);
    expect(TECH_BRANCH_ORDER.length).toBe(9);
    expect(TECH_BRANCH_ORDER).toContain("social");
    for (const branch of TECH_BRANCH_ORDER) {
      const meta = TECH_BRANCHES[branch];
      expect(meta, branch).toBeDefined();
      expect(meta.name.length, branch).toBeGreaterThan(0);
      expect(meta.description.length, branch).toBeGreaterThan(10);
      expect(meta.color, branch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(techsByBranch(branch).length, branch).toBeGreaterThanOrEqual(20);
    }
    for (const tech of TECH_DEFS) expect(TECH_BRANCH_ORDER).toContain(tech.branch);
  });

  it("tier 1~6、每时代每支至少 2 项、tier1 为根节点", () => {
    expect([1, 2, 3, 4, 5, 6].map((tier) => techsInTier(tier).length)).toEqual(PER_TIER);
    for (let era = 1; era <= 6; era++) {
      expect(techsAvailableInEra(era).length).toBe(TECH_DEFS.filter((tech) => tech.tier <= era).length);
    }
    const curve = [1, 2, 3, 4, 5, 6].map((era) => techsAvailableInEra(era).length);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    for (const branch of TECH_BRANCH_ORDER) {
      const list = techsByBranch(branch);
      for (let tier = 1; tier <= 6; tier++) {
        expect(list.filter((tech) => tech.tier === tier).length, `${branch} E${tier}`).toBeGreaterThanOrEqual(2);
      }
      const roots = list.filter((tech) => tech.tier === 1);
      expect(roots.length).toBeGreaterThanOrEqual(2);
      for (const root of roots) expect(root.requires, root.id).toEqual([]);
    }
  });

  it("字段完整：id/中文名唯一、描述/效果/学说/成本合法", () => {
    const ids = TECH_DEFS.map((tech) => tech.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = new Set<string>();
    const allowedEffectKeys = new Set([
      "productionMultiplier", "researchMultiplier", "observationMultiplier",
      "agricultureMultiplier", "energyMultiplier", "industryMultiplier",
      "habitabilityBonus", "disasterResistance", "predictionMultiplier",
      "populationCapacityBonus", "allowColony", "allowPlanetEngine",
      "observationLevelUnlock", "stabilityBonus", "eventRiskMultiplier",
      "politicalCapital", "departmentBoost", "researchSpeed",
    ]);
    for (const tech of TECH_DEFS) {
      expect(tech.name.length, tech.id).toBeGreaterThan(1);
      expect(names.has(tech.name), `科技名重复：${tech.name}`).toBe(false);
      names.add(tech.name);
      expect(tech.tier, tech.id).toBeGreaterThanOrEqual(1);
      expect(tech.tier, tech.id).toBeLessThanOrEqual(6);
      expect(Number.isFinite(tech.cost), tech.id).toBe(true);
      expect(tech.cost, tech.id).toBeGreaterThan(0);
      expect(tech.description.length, tech.id).toBeGreaterThanOrEqual(30);
      expect(tech.effectSummary.length, tech.id).toBeGreaterThan(6);
      expect(tech.effectsDetail, tech.id).toBeDefined();
      expect((tech.effectsDetail ?? []).length, tech.id).toBeGreaterThanOrEqual(2);
      expect((tech.effectsDetail ?? []).length, tech.id).toBeLessThanOrEqual(4);
      for (const line of tech.effectsDetail ?? []) expect(line.length, tech.id).toBeGreaterThan(3);
      expect(tech.school, tech.id).toBeDefined();
      expect(TECH_SCHOOL_ORDER).toContain(tech.school);
      expect(techSchoolOf(tech.id)).toBe(tech.school);
      for (const key of Object.keys(tech.effects)) {
        expect(allowedEffectKeys.has(key), `${tech.id} 使用未定义效果字段 ${key}`).toBe(true);
      }
      const fullText = [tech.description, tech.descriptionLong, tech.flavor, tech.effectSummary, ...(tech.effectsDetail ?? [])].join(" ");
      expect(/TODO|lorem|Lorem|XXX|占位符|placeholder/i.test(fullText), tech.id).toBe(false);
    }
    for (const school of TECH_SCHOOL_ORDER) {
      expect(TECH_SCHOOLS[school].name.length, school).toBeGreaterThan(0);
      expect(TECH_DEFS.filter((tech) => tech.school === school).length, school).toBeGreaterThanOrEqual(6);
    }
  });

  it("成本按 6 时代梯度收敛", () => {
    const ranges: Record<number, [number, number]> = {
      1: [35, 50], 2: [110, 150], 3: [300, 360], 4: [680, 760], 5: [1550, 1650], 6: [3150, 3250],
    };
    for (const tech of TECH_DEFS) {
      const [min, max] = ranges[tech.tier];
      expect(tech.cost, `${tech.id} 成本不在 E${tech.tier} 区间`).toBeGreaterThanOrEqual(min);
      expect(tech.cost, `${tech.id} 成本不在 E${tech.tier} 区间`).toBeLessThanOrEqual(max);
    }
    expect(totalTechCost()).toBe(TECH_DEFS.reduce((sum, tech) => sum + tech.cost, 0));
    expect(totalTechCost()).toBeGreaterThan(150000);
  });

  it("保留全部 v1.3 旧 id（含重命名项的旧 id）,新名符合时代语义", () => {
    for (const id of LEGACY_IDS) {
      expect(getTechDef(id), id).toBeDefined();
      expect(techDisplayName(id).length, id).toBeGreaterThan(1);
    }
    expect(techDisplayName("energy_solar")).toBe("蒸汽动力");
    expect(techDisplayName("comp_mechanism")).toBe("差分机与机械计算");
    expect(techDisplayName("energy_fusion")).toBe("聚变工程");
    // 天文台 6 级升级链与 OBSERVATORY_LEVELS 冻结一致
    for (let level = 1; level <= 6; level++) {
      const info = OBSERVATORY_LEVELS[level];
      expect(info.requiresTech, `观测 Lv${level}`).toBe(ASTRO_CHAIN[level - 1]);
      const def = getTechDef(info.requiresTech!);
      expect(def, String(info.requiresTech)).toBeDefined();
      expect(def!.tier, `观测 Lv${level} 科技晚于 requiresEra`).toBeLessThanOrEqual(info.requiresEra);
    }
    // 时代硬约束：卫星 / 火箭 / 空间站 / 星际殖民 / 计算机不早于应属时代
    const eraOf = (id: string): number => getTechDef(id)!.tier;
    expect(eraOf("space_deep")).toBeGreaterThanOrEqual(5); // 火箭与卫星
    expect(eraOf("space_station")).toBeGreaterThanOrEqual(5); // 空间站
    expect(eraOf("space_colony")).toBeGreaterThanOrEqual(5); // 星际殖民
    expect(eraOf("comp_electronic")).toBe(4); // 早期计算机只允许在电气纪元
    expect(eraOf("comp_radio")).toBe(4); // 无线电
    expect(eraOf("energy_electric")).toBe(4); // 电网
    expect(eraOf("energy_rail")).toBe(3); // 蒸汽铁路
    expect(eraOf("energy_internal_combustion")).toBe(4); // 内燃机只允许在电气纪元
  });
});

describe("科技 DAG：前置、无环、同支前置、无时代倒挂", () => {
  it("前置真实存在、严格早于自身 tier、非根节点必须有同支前置、全图无环可达", () => {
    for (const tech of TECH_DEFS) {
      for (const req of tech.requires) {
        const def = TECH_MAP[req];
        expect(def, `${tech.id} 依赖未知科技 ${req}`).toBeDefined();
        expect(def!.tier, `${tech.id} 的前置 ${req} 不早于自身时代（时代倒挂）`).toBeLessThan(tech.tier);
      }
      if (tech.tier > 1) {
        expect(
          tech.requires.some((req) => TECH_MAP[req]?.branch === tech.branch),
          `${tech.id} 缺少同支前置科技`,
        ).toBe(true);
      } else {
        expect(tech.requires, tech.id).toEqual([]);
      }
    }
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      expect(visiting.has(id), `科技依赖成环：${id}`).toBe(false);
      visiting.add(id);
      for (const req of TECH_MAP[id].requires) visit(req);
      visiting.delete(id);
      done.add(id);
    };
    for (const tech of TECH_DEFS) visit(tech.id);
    // 可达性 fixpoint
    const reached = new Set(TECH_DEFS.filter((tech) => tech.requires.length === 0).map((tech) => tech.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const tech of TECH_DEFS) {
        if (reached.has(tech.id)) continue;
        if (tech.requires.every((req) => reached.has(req))) {
          reached.add(tech.id);
          changed = true;
        }
      }
    }
    for (const tech of TECH_DEFS) expect(reached.has(tech.id), `${tech.id} 无法从根节点到达`).toBe(true);
  });

  it("旧天文链可按时代逐级完成（含跨支前置）", () => {
    const state = researchedState([...ASTRO_CHAIN]);
    for (const id of ASTRO_CHAIN) expect(isResearched(state, id), id).toBe(true);
    expect(branchProgress(state, "astronomy").researched).toBeGreaterThanOrEqual(6);
    expect(techChainCost("ghost")).toBe(0);
    expect(techChainCost("astro_supernet")).toBeGreaterThan(getTechDef("astro_supernet")!.cost);
    // 未研究前置时逐级被时代门槛拦截
    const fresh = createTechState();
    expect(canResearch("astro_distance", fresh, 1).reason).toContain("第 2 时代");
    expect(canResearch("astro_supernet", fresh, 5).reason).toContain("第 6 时代");
  });
});

describe("互斥教义（exclusiveGroup）", () => {
  it("至少 5 组、每组 2-3 项、同组同 tier、教义科技不得成为硬前置", () => {
    expect(DOCTRINE_GROUPS.length).toBeGreaterThanOrEqual(5);
    for (const group of DOCTRINE_GROUPS) {
      expect(group.techIds.length, group.id).toBeGreaterThanOrEqual(2);
      expect(group.techIds.length, group.id).toBeLessThanOrEqual(3);
      const tiers = new Set(group.techIds.map((id) => TECH_MAP[id]?.tier));
      expect(tiers.size, `${group.id} 组内 tier 不一致`).toBe(1);
      expect([...tiers][0]).toBe(group.tier);
      for (const techId of group.techIds) {
        const def = TECH_MAP[techId];
        expect(def, `${group.id} 引用未知科技 ${techId}`).toBeDefined();
        expect(def.exclusiveGroup).toBe(group.id);
        expect(isDoctrineTech(techId)).toBe(true);
        for (const tech of TECH_DEFS) {
          expect(tech.requires.includes(techId), `教义 ${techId} 被 ${tech.id} 当作硬前置`).toBe(false);
        }
      }
      expect(doctrineTechs(group.id).map((tech) => tech.id)).toEqual([...group.techIds]);
    }
    expect(new Set(DOCTRINE_GROUPS.map((group) => group.id)).size).toBe(DOCTRINE_GROUPS.length);
  });

  it("选择教义后同组其他项永久不可研究（能源路线为 E4）", () => {
    const state = researchedState(["energy_solar", "industry_alloys", "industry_ceramics"]);
    const first = chooseDoctrine(state, "energy_coal", 4);
    expect(first.ok, first.reason ?? "").toBe(true);
    expect(state.doctrineChoices?.["doctrine_energy"]).toBe("energy_coal");
    expect(canResearch("energy_coal", state, 4).ok).toBe(true);
    for (const other of ["energy_nuclear", "energy_solar_array"]) {
      const check = canResearch(other, state, 6);
      expect(check.ok, other).toBe(false);
      expect(check.reason ?? "", other).toContain("教义");
    }
    expect(doctrineLockReason(state, "energy_nuclear")).toContain("燃煤扩张");
    expect(canResearch("energy_boiler", state, 5).ok).toBe(true);
  });

  it("chooseDoctrine 校验与时代门槛", () => {
    const state = researchedState(["energy_solar", "industry_alloys", "industry_ceramics"]);
    expect(chooseDoctrine(state, "ghost_tech", 6).ok).toBe(false);
    expect(chooseDoctrine(state, "energy_solar", 6).ok).toBe(false);
    const lowEra = researchedState(["energy_solar", "industry_alloys"]);
    const rejected = chooseDoctrine(lowEra, "energy_coal", 3);
    expect(rejected.ok).toBe(false);
    expect(rejected.reason ?? "").toContain("第 4 时代");
    expect(lowEra.doctrineChoices?.["doctrine_energy"]).toBeUndefined();
    const applied = applyDoctrine(researchedState(["energy_solar", "industry_alloys", "industry_ceramics"]), "energy_solar_array", 4);
    expect(applied.ok, applied.reason ?? "").toBe(true);
  });

  it("研究完成教义科技时自动采纳教义，并锁定同组其他路线", () => {
    const state = researchedState(["energy_solar", "industry_alloys"]);
    expect(startResearch(state, "energy_coal", 4).ok).toBe(true);
    const done = advanceResearch(state, 5000);
    expect(done.completedId).toBe("energy_coal");
    expect(done.doctrineChosen).toBe("energy_coal");
    expect(state.doctrineChoices?.["doctrine_energy"]).toBe("energy_coal");
    expect(canResearch("energy_nuclear", state, 6).ok).toBe(false);
  });

  it("doctrineGroups 输出 7 组、选项状态与选择一致", () => {
    const state = researchedState(["energy_solar", "industry_alloys"]);
    chooseDoctrine(state, "energy_coal", 4);
    const groups = doctrineGroups(state);
    expect(groups.length).toBe(DOCTRINE_GROUPS.length);
    expect(groups.length).toBeGreaterThanOrEqual(6);
    const energy = groups.find((group) => group.id === "doctrine_energy")!;
    expect(energy.chosenTechId).toBe("energy_coal");
    expect(energy.options.length).toBe(3);
    expect(energy.options.filter((option) => option.chosen).length).toBe(1);
    for (const option of energy.options) expect(option.school).toBeTruthy();
    expect(doctrineGroups().length).toBe(DOCTRINE_GROUPS.length);
  });
});

describe("canResearch 校验、六时代门槛与 clampTechEra", () => {
  it("未知 / 已研究 / 正在研究 / 时代门槛的具体原因", () => {
    const state = createTechState();
    expect(canResearch("ghost_tech", state, 6)).toEqual({ ok: false, reason: "未知科技：ghost_tech" });
    state.researched = ["astro_basic"];
    expect(canResearch("astro_basic", state, 6).reason).toContain("已研究");
    state.activeTech = "energy_basic";
    expect(canResearch("energy_basic", state, 6).reason).toContain("正在研究");
    expect(activeTechDef(state)?.id).toBe("energy_basic");
    expect(activeResearchInfo(state)?.techId).toBe("energy_basic");
    expect(canResearch("astro_distance", state, 1).reason).toContain("第 2 时代");
    expect(canResearch("astro_supernet", state, 5).reason).toContain("第 6 时代");
    // era 缺省 = 6（旧调用全解锁）
    expect(canResearch("astro_orbit", state).reason).toContain("前置科技");
    expect(clampTechEra(Number.NaN)).toBe(6);
    expect(clampTechEra(undefined)).toBe(6);
    expect(clampTechEra(-3)).toBe(1);
    expect(clampTechEra(9.8)).toBe(6);
  });

  it("硬前置缺失给出具体科技名", () => {
    const state = stateWith(["astro_basic"]);
    const check = canResearch("astro_orbit", state, 6);
    expect(check.ok).toBe(false);
    expect(check.reason ?? "").toContain("前置科技");
    expect(check.reason ?? "").toContain("恒星测距");
    const ok = researchedState(["astro_supernet"]);
    expect(canResearch("astro_supernet", ok, 6).reason ?? "").toContain("已研究");
  });
});

describe("研究推进、学派重心、发展纲领、资源倾斜、加速研究", () => {
  it("createTechState 初始化 v1.6 字段", () => {
    const state = createTechState();
    expect(state.schoolFocus).toBeNull();
    expect(state.doctrineChoices).toEqual({});
    expect(state.schoolPoints).toEqual({});
    expect(state.developmentCategories).toBeNull();
    expect(researchFundingPercent(state)).toBe(50);
    expect(state.researchBoostCounts).toEqual({});
    expect(state.lastBoostTurn).toBe(-1);
    expect(researchedCountOf(state)).toBe(0);
  });

  it("逐点投入 / 切换目标 / 中止 / 非法预算（旧覆盖）", () => {
    const state = createTechState();
    expect(startResearch(state, "energy_basic", 1).ok).toBe(true);
    const def = getTechDef("energy_basic")!;
    const partial = advanceResearch(state, 20);
    expect(partial.completedId).toBeNull();
    expect(partial.spent).toBeCloseTo(20, 9);
    expect(state.progress).toBeCloseTo(20, 9);
    expect(activeResearchInfo(state)?.remaining).toBeCloseTo(def.cost - 20, 9);
    const switched = startResearch(state, "industry_basic", 1);
    expect(switched.ok).toBe(true);
    expect(switched.notice).toContain("进度");
    expect(cancelResearch(state)).toBe(true);
    expect(state.activeTech).toBeNull();
    expect(advanceResearch(state, 500)).toEqual({ completedId: null, spent: 0 });
    startResearch(state, "energy_basic", 1);
    expect(advanceResearch(state, Number.NaN)).toEqual({ completedId: null, spent: 0 });
    expect(advanceResearch(state, -100)).toEqual({ completedId: null, spent: 0 });
  });

  it("研究重心：同派 +15% / 跨派 -5% / 均衡 1.0", () => {
    const prereq = researchedState(["astro_supernet"]);
    prereq.researched = prereq.researched.filter((id) => id !== "astro_supernet");
    prereq.activeTech = null;
    prereq.progress = 0;
    const focused = { ...prereq, schoolFocus: "observation" as const };
    expect(researchSpeedFor(focused, "astro_supernet")).toBeCloseTo(1 + FOCUS_SPEED_BONUS, 9);
    startResearch(focused, "astro_supernet", 6);
    const r1 = advanceResearch(focused, 100);
    expect(r1.spent).toBeCloseTo(100, 9);
    expect(focused.progress).toBeCloseTo(115, 9);
    const balanced = { ...prereq, schoolFocus: null };
    expect(researchSpeedFor(balanced, "astro_supernet")).toBe(1);
    const crossed = { ...prereq, schoolFocus: "industrial" as const };
    expect(researchSpeedFor(crossed, "astro_supernet")).toBeCloseTo(1 - CROSS_SCHOOL_PENALTY, 9);
    expect(researchCostFor(focused, "astro_supernet")).toBe(Math.ceil(getTechDef("astro_supernet")!.cost / (1 + FOCUS_SPEED_BONUS)));
    expect(researchCostFor(balanced, "ghost_tech")).toBe(0);
    expect(setSchoolFocus(createTechState(), "observation").ok).toBe(true);
    expect(setSchoolFocus(createTechState(), "ghost_school" as never).ok).toBe(false);
  });

  it("发展纲领：E3 起选择 1~2 个大类，已选 +10% / 未选 -35%", () => {
    const state = createTechState();
    expect(setDevelopmentCategories(state, ["natural"], 2).ok).toBe(false);
    expect(setDevelopmentCategories(state, [], 3).ok).toBe(false);
    expect(setDevelopmentCategories(state, ["natural", "engineering", "social"], 3).ok).toBe(false);
    const chosen = setDevelopmentCategories(state, ["natural", "engineering"], 3);
    expect(chosen.ok, chosen.reason ?? "").toBe(true);
    expect(state.developmentCategories).toEqual(["natural", "engineering"]);
    const info = developmentProgramInfo(state, 3);
    expect(info.chosen).toBe(true);
    expect(info.unlocked).toBe(true);
    expect(info.options.filter((option) => option.selected).length).toBe(2);
    // 已选大类 +10%，未选大类 -35%
    expect(researchSpeedFor(state, "astro_basic")).toBeCloseTo(1 + DEVELOPMENT_FOCUS_BONUS, 9);
    expect(researchSpeedFor(state, "industry_basic")).toBeCloseTo(1 + DEVELOPMENT_FOCUS_BONUS, 9);
    expect(researchSpeedFor(state, "society_tribe")).toBeCloseTo(1 - DEVELOPMENT_NEGLECT_PENALTY, 9);
    // 只选 1 个大类时另外两个都 -35%
    const single = createTechState();
    setDevelopmentCategories(single, ["social"], 3);
    expect(researchSpeedFor(single, "society_tribe")).toBeCloseTo(1 + DEVELOPMENT_FOCUS_BONUS, 9);
    expect(researchSpeedFor(single, "astro_basic")).toBeCloseTo(1 - DEVELOPMENT_NEGLECT_PENALTY, 9);
    expect(researchCategoryFor("astro_basic")).toBe("natural");
    expect(categoryTechCount("social")).toBeGreaterThan(15);
  });

  it("科研资源倾斜：0% ≈ -40%、100% ≈ +35%，并以非科研产出为代价", () => {
    const state = createTechState();
    expect(fundingModifiers(state).researchSpeed).toBeCloseTo(1, 9);
    setResearchFunding(state, 0);
    expect(researchFundingPercent(state)).toBe(0);
    const low = fundingModifiers(state);
    expect(low.researchSpeed).toBeCloseTo(RESEARCH_FUNDING_MIN_SPEED, 9);
    expect(low.otherProduction).toBeGreaterThan(1);
    setResearchFunding(state, 100);
    const high = fundingModifiers(state);
    expect(high.researchSpeed).toBeCloseTo(RESEARCH_FUNDING_MAX_SPEED, 9);
    expect(high.otherProduction).toBeLessThan(1);
    expect(researchSpeedFor(state, "astro_basic")).toBeCloseTo(RESEARCH_FUNDING_MAX_SPEED, 9);
    setResearchFunding(state, 250);
    expect(researchFundingPercent(state)).toBe(100);
    setResearchFunding(state, Number.NaN);
  });

  it("注入资源加速：立即增加进度、价格随次数递增、每回合限一次", () => {
    const state = createTechState();
    startResearch(state, "energy_basic", 6);
    state.progress = 10;
    const quote1 = researchBoostQuote(state, 6, 5);
    expect(quote1.ok, quote1.reason ?? "").toBe(true);
    expect(quote1.techId).toBe("energy_basic");
    expect(quote1.gain).toBeGreaterThan(0);
    const first = applyResearchBoost(state, quote1.gain, 5);
    expect(first.gain).toBeGreaterThan(0);
    expect(state.progress).toBeGreaterThan(10);
    expect(state.lastBoostTurn).toBe(5);
    expect(state.researchBoostCounts?.["energy_basic"]).toBe(1);
    const sameTurn = researchBoostQuote(state, 6, 5);
    expect(sameTurn.ok).toBe(false);
    expect(sameTurn.reason ?? "").toContain("每回合");
    const quote2 = researchBoostQuote(state, 6, 6);
    expect(quote2.ok).toBe(true);
    expect(quote2.uses).toBe(1);
    const cost1 = Object.values(quote1.cost).reduce((a, b) => a + (b ?? 0), 0);
    const cost2 = Object.values(quote2.cost).reduce((a, b) => a + (b ?? 0), 0);
    expect(cost2).toBeGreaterThan(cost1);
  });

  it("旧档归一化：缺字段补默认值、非法值被夹取", () => {
    const legacy = { researched: ["astro_basic"], activeTech: null, progress: 0, totalScience: 0 } as TechState;
    expect(isLegacyTechState(legacy)).toBe(true);
    normalizeTechState(legacy);
    expect(legacy.researchFunding).toBe(50);
    expect(legacy.developmentCategories).toBeNull();
    expect(legacy.researchBoostCounts).toEqual({});
    expect(legacy.lastBoostTurn).toBe(-1);
    const broken = { researched: [] as string[], activeTech: null, progress: 0, totalScience: 0, researchFunding: 999, developmentCategories: ["natural", "bogus"] } as unknown as TechState;
    normalizeTechState(broken);
    expect(broken.researchFunding).toBe(100);
    expect(broken.developmentCategories).toEqual(["natural"]);
    expect(isLegacyTechState(createTechState())).toBe(false);
  });
});

describe("效果聚合与学派精通", () => {
  it("空科技状态中性", () => {
    const state = createTechState();
    const mult = getTechMultipliers(state);
    expect(mult.research).toBe(1);
    for (const value of Object.values(mult.production)) expect(value).toBe(1);
    const fx = aggregateTechEffects(state);
    expect(fx.allowColony).toBe(false);
    expect(fx.researchSpeed).toBe(0);
  });

  it("学派精通归一化、满精通效果 +10%（受聚合上限夹取）", () => {
    const state = createTechState();
    const authorityTechs = TECH_DEFS.filter((tech) => tech.school === "authority");
    const full = stateWith(authorityTechs.map((tech) => tech.id));
    expect(schoolMastery(full, "authority")).toBeCloseTo(1, 9);
    const rawStability = authorityTechs.reduce((sum, tech) => sum + (tech.effects.stabilityBonus ?? 0), 0);
    expect(rawStability).toBeGreaterThan(1);
    const agg = aggregateTechEffects(full);
    expect(agg.stabilityBonus).toBeCloseTo(Math.min(15, rawStability * (1 + MASTERY_EFFECT_BONUS)), 6);
    const single = stateWith(["society_tribe"]);
    const singleRaw = getTechDef("society_tribe")!.effects.stabilityBonus ?? 0;
    const singleAgg = aggregateTechEffects(single);
    expect(singleAgg.stabilityBonus).toBeCloseTo(singleRaw * (1 + MASTERY_EFFECT_BONUS * schoolMastery(single, "authority")), 6);
    expect(schoolPointsFor(single, "industrial")).toBe(0);
    syncSchoolPoints(full);
    expect(full.schoolPoints?.authority).toBeCloseTo(schoolPointTotal("authority"), 6);
  });

  it("全部 192 项学完：数值有限且不越界", () => {
    const state = stateWith(TECH_DEFS.map((tech) => tech.id));
    const fx = aggregateTechEffects(state);
    const numbers = [
      ...Object.values(fx.productionMultiplier ?? {}),
      fx.researchMultiplier, fx.observationMultiplier, fx.agricultureMultiplier,
      fx.energyMultiplier, fx.industryMultiplier, fx.predictionMultiplier,
      fx.habitabilityBonus, fx.disasterResistance, fx.populationCapacityBonus,
      fx.stabilityBonus, fx.eventRiskMultiplier, fx.politicalCapital, fx.researchSpeed,
      ...Object.values(fx.departmentBoost ?? {}),
    ];
    for (const value of numbers) expect(Number.isFinite(value), String(value)).toBe(true);
    for (const value of Object.values(fx.productionMultiplier ?? {})) {
      expect(value).toBeGreaterThanOrEqual(0.2);
      expect(value).toBeLessThanOrEqual(5);
    }
    expect(fx.stabilityBonus ?? 0).toBeLessThanOrEqual(15);
    expect(fx.eventRiskMultiplier ?? 1).toBeGreaterThanOrEqual(0.5);
    expect(fx.researchSpeed ?? 0).toBeLessThanOrEqual(1.5);
    expect(fx.allowColony).toBe(true);
    expect(fx.allowPlanetEngine).toBe(true);
  });

  it("branchProgress / 大类统计覆盖 9 分支", () => {
    const state = stateWith(["energy_basic", "astro_basic", "social_tribal_politics"]);
    for (const branch of TECH_BRANCH_ORDER) {
      const progress = branchProgress(state, branch);
      expect(progress.total, branch).toBeGreaterThanOrEqual(20);
      expect(progress.researched).toBeGreaterThanOrEqual(0);
      expect(progress.researched).toBeLessThanOrEqual(progress.total);
    }
    expect(branchProgress(state, "astronomy").researched).toBe(1);
    expect(techSchoolOf("astro_basic")).toBe("observation");
    expect(techSchoolOf("ghost_tech")).toBeNull();
    const astronomy = stateWith(techsByBranch("astronomy").map((tech) => tech.id));
    expect(branchProgress(astronomy, "astronomy")).toEqual({ researched: 21, total: 21 });
    expect(categoryTechCount("social")).toBeGreaterThan(15);
    expect(TECH_CATEGORY_ORDER).toEqual(["natural", "engineering", "social"]);
    expect(TECH_CATEGORIES.natural.name).toBe("自然科学");
  });
});

function researchedCountOf(state: TechState): number {
  return state.researched.filter((id) => Boolean(getTechDef(id))).length;
}
