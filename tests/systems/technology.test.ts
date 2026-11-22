import { describe, expect, it } from "vitest";
import {
  DOCTRINE_GROUPS,
  TECH_BRANCHES,
  TECH_BRANCH_ORDER,
  TECH_DEFS,
  TECH_MAP,
  TECH_SCHOOLS,
  TECH_SCHOOL_ORDER,
  activeResearchInfo,
  activeTechDef,
  advanceResearch,
  aggregateTechEffects,
  applyDoctrine,
  branchProgress,
  canResearch,
  cancelResearch,
  chooseDoctrine,
  clampTechEra,
  createTechState,
  doctrineGroups,
  doctrineLockReason,
  doctrineTechs,
  getDoctrineGroupMeta,
  getTechDef,
  getTechMultipliers,
  isDoctrineTech,
  isResearched,
  researchedCount,
  researchCostFor,
  researchSpeedFor,
  schoolMastery,
  schoolPointTotal,
  schoolPointsFor,
  setSchoolFocus,
  startResearch,
  syncSchoolPoints,
  techChainCost,
  techDisplayName,
  techName,
  techSchoolOf,
  techsAvailableInEra,
  techsByBranch,
  techsInTier,
  totalTechCost,
  CROSS_SCHOOL_PENALTY,
  FOCUS_SPEED_BONUS,
  MASTERY_EFFECT_BONUS,
} from "../../src/technology";
import type { TechState } from "../../src/core/types";
import { ERAS, OBSERVATORY_LEVELS } from "../../src/core/constants";

/** 外部依赖冻结的科技 id（天文台升级链 / 星际链）。 */
const ASTRO_CHAIN = [
  "astro_basic",
  "astro_distance",
  "astro_orbit",
  "astro_threebody",
  "astro_chaos",
  "astro_supernet",
] as const;
const SPACE_CHAIN = ["space_basic", "space_orbital", "space_colony", "space_deep", "space_engine"] as const;

/** 规格 §1.2 的成本区间。 */
const SPEC_TECH_COST_RANGE: Record<number, [number, number]> = {
  1: [25, 60],
  2: [80, 150],
  3: [240, 400],
  4: [650, 1000],
  5: [1400, 2400],
};

/** 文本字段的字数要求（按 Unicode 字符计）。 */
const TEXT_LENGTH = {
  description: [80, 140],
  descriptionLong: [160, 320],
  flavor: [30, 60],
} as const;

function charLen(text: string | undefined): number {
  return Array.from(text ?? "").length;
}

function stateWith(researched: string[], patch: Partial<TechState> = {}): TechState {
  const state = createTechState();
  state.researched = [...researched];
  Object.assign(state, patch);
  return state;
}

/** 研究一项科技（假定前置已满足，era 足够）。 */
function finishResearch(state: TechState, techId: string, era = 5): void {
  const started = startResearch(state, techId, era);
  expect(started.ok, `startResearch(${techId}) 失败：${started.reason}`).toBe(true);
  const result = advanceResearch(state, (TECH_MAP[techId]?.cost ?? 1000) * 4 + 1000);
  expect(result.completedId).toBe(techId);
}

describe("科技树 v3 完整性", () => {
  it("72 项科技、8 个分支、每分支 9 项、分支元数据完整", () => {
    expect(TECH_DEFS.length).toBeGreaterThanOrEqual(64);
    expect(TECH_DEFS.length).toBe(72);
    expect(TECH_BRANCH_ORDER.length).toBe(8);
    for (const branch of TECH_BRANCH_ORDER) {
      const meta = TECH_BRANCHES[branch];
      expect(meta, branch).toBeDefined();
      expect(meta.name.length, branch).toBeGreaterThan(0);
      expect(meta.description.length, branch).toBeGreaterThan(10);
      expect(meta.color, branch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(techsByBranch(branch).length, branch).toBe(9);
    }
    // 8 个分支都出现在 TECH_BRANCH_ORDER 中，且每项科技的 branch 合法
    for (const tech of TECH_DEFS) expect(TECH_BRANCH_ORDER).toContain(tech.branch);
  });

  it("tier 1~5、每时代均有科技、tier1 分支根节点无前置", () => {
    expect([1, 2, 3, 4, 5].map((tier) => techsInTier(tier).length)).toEqual([8, 15, 18, 17, 14]);
    for (let era = 1; era <= 5; era++) {
      expect(techsAvailableInEra(era).length).toBe(
        TECH_DEFS.filter((tech) => tech.tier <= era).length,
      );
    }
    // 可研究科技数量随时代严格递增（科研产出的时代梯度）
    const curve = [1, 2, 3, 4, 5].map((era) => techsAvailableInEra(era).length);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    for (const branch of TECH_BRANCH_ORDER) {
      const root = techsByBranch(branch)[0];
      expect(root.tier, branch).toBe(1);
      expect(root.requires, branch).toEqual([]);
    }
  });

  it("字段完整：描述 80-140 字 / 长文 160-320 字 / 引文 30-60 字 / 效果说明 2-4 条", () => {
    const ids = TECH_DEFS.map((tech) => tech.id);
    expect(new Set(ids).size).toBe(ids.length);
    const named = new Set<string>();
    for (const tech of TECH_DEFS) {
      expect(tech.name.length, tech.id).toBeGreaterThan(1);
      expect(named.has(tech.name), `科技名重复：${tech.name}`).toBe(false);
      named.add(tech.name);
      expect(tech.effectSummary.length, tech.id).toBeGreaterThan(6);
      for (const [field, [min, max]] of Object.entries(TEXT_LENGTH)) {
        const value = (tech as unknown as Record<string, string | undefined>)[field];
        const length = charLen(value);
        expect(length, `${tech.id} ${field} 长度 ${length} 不在 ${min}-${max}`).toBeGreaterThanOrEqual(min);
        expect(length, `${tech.id} ${field} 长度 ${length} 不在 ${min}-${max}`).toBeLessThanOrEqual(max);
      }
      expect(tech.effectsDetail, tech.id).toBeDefined();
      expect((tech.effectsDetail ?? []).length, tech.id).toBeGreaterThanOrEqual(2);
      expect((tech.effectsDetail ?? []).length, tech.id).toBeLessThanOrEqual(4);
      for (const line of tech.effectsDetail ?? []) expect(line.length, tech.id).toBeGreaterThan(4);
      expect(tech.school, tech.id).toBeDefined();
      expect(TECH_SCHOOL_ORDER).toContain(tech.school);
      expect(techSchoolOf(tech.id)).toBe(tech.school);
      expect(tech.effects, tech.id).toBeTruthy();
      // 效果只能使用已定义的 TechEffects 字段（禁止漂移/拼写错误）
      const allowedEffectKeys = new Set([
        "productionMultiplier", "researchMultiplier", "observationMultiplier",
        "agricultureMultiplier", "energyMultiplier", "industryMultiplier",
        "habitabilityBonus", "disasterResistance", "predictionMultiplier",
        "populationCapacityBonus", "allowColony", "allowPlanetEngine",
        "observationLevelUnlock", "stabilityBonus", "eventRiskMultiplier",
        "politicalCapital", "departmentBoost", "researchSpeed",
      ]);
      for (const key of Object.keys(tech.effects)) {
        expect(allowedEffectKeys.has(key), `${tech.id} 使用未定义的 TechEffects 字段 ${key}`).toBe(true);
      }
      // 禁止占位符 / lorem / TODO 文案
      const fullText = [
        tech.description,
        tech.descriptionLong,
        tech.flavor,
        tech.effectSummary,
        ...(tech.effectsDetail ?? []),
        tech.unlockNotes ?? "",
      ].join(" ");
      expect(/TODO|lorem|Lorem|XXX|占位符|placeholder/i.test(fullText), tech.id).toBe(false);
    }
    // 6 个学说都至少被 6 项科技使用（保证精通体系与 UI 筛选有意义）
    const schoolCount = new Map<string, number>();
    for (const tech of TECH_DEFS) {
      schoolCount.set(tech.school!, (schoolCount.get(tech.school!) ?? 0) + 1);
    }
    for (const school of TECH_SCHOOL_ORDER) {
      expect(TECH_SCHOOLS[school].name.length, school).toBeGreaterThan(0);
      expect(TECH_SCHOOLS[school].description.length, school).toBeGreaterThan(8);
      expect(schoolCount.get(school) ?? 0, school).toBeGreaterThanOrEqual(6);
    }
  });

  it("成本按 tier 区间、同 tier 跨分支 ±20%、成本为有限正数", () => {
    for (const tech of TECH_DEFS) {
      const [min, max] = SPEC_TECH_COST_RANGE[tech.tier];
      expect(Number.isFinite(tech.cost), tech.id).toBe(true);
      expect(tech.cost, `${tech.id} 成本低于 E${tech.tier} 下限`).toBeGreaterThanOrEqual(min);
      expect(tech.cost, `${tech.id} 成本高于 E${tech.tier} 上限`).toBeLessThanOrEqual(max);
    }
    for (let tier = 1; tier <= 5; tier++) {
      const list = TECH_DEFS.filter((tech) => tech.tier === tier);
      const mean = list.reduce((sum, tech) => sum + tech.cost, 0) / list.length;
      for (const tech of list) {
        expect(
          Math.abs(tech.cost - mean) / mean,
          `${tech.id} 偏离 E${tier} 均值超过 20%`,
        ).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it("保留全部旧 id 与旧名称：astro 六项链、space 五项链、energy/industry/bio 现有 id", () => {
    const OLD_IDS: [string, string][] = [
      ["astro_basic", "天象记录"],
      ["astro_distance", "恒星测距"],
      ["astro_orbit", "轨道几何"],
      ["astro_threebody", "三体问题求解"],
      ["astro_chaos", "混沌统计学"],
      ["astro_supernet", "超空间观测网"],
      ["energy_basic", "火种与薪柴"],
      ["energy_grid", "水车与风车"],
      ["energy_solar", "蒸汽与电力"],
      ["energy_fusion", "核能工程"],
      ["energy_zero", "受控聚变与零点能"],
      ["industry_basic", "石器与木工"],
      ["industry_automation", "青铜与轮轴"],
      ["industry_alloys", "蒸汽机械与钢铁"],
      ["industry_megastructure", "自动化与巨型工程"],
      ["industry_quantum", "纳米制造"],
      ["bio_basic", "采集与驯化"],
      ["bio_medicine", "灌溉与草药"],
      ["bio_ecology", "现代医学与生态工程"],
      ["bio_genetic", "基因适应"],
      ["bio_biosphere", "闭合生态圈"],
      ["space_basic", "星象与历法"],
      ["space_orbital", "几何与测绘"],
      ["space_colony", "星际殖民技术"],
      ["space_deep", "火箭与卫星"],
      ["space_engine", "星际航行与行星发动机"],
    ];
    for (const [id, name] of OLD_IDS) {
      const def = getTechDef(id);
      expect(def, id).toBeDefined();
      expect(def!.name, id).toBe(name);
      expect(techDisplayName(id)).toBe(name);
    }
    // 天文台升级链 / 星际链的前置仍为链式，且星际链保留解锁标记
    for (let i = 1; i < ASTRO_CHAIN.length; i++) {
      expect(TECH_MAP[ASTRO_CHAIN[i]].requires, ASTRO_CHAIN[i]).toContain(ASTRO_CHAIN[i - 1]);
    }
    expect(TECH_MAP["astro_supernet"].requires).toEqual(["astro_chaos"]);
    for (let i = 1; i < SPACE_CHAIN.length; i++) {
      expect(TECH_MAP[SPACE_CHAIN[i]].requires, SPACE_CHAIN[i]).toContain(SPACE_CHAIN[i - 1]);
    }
    expect(TECH_MAP["space_colony"].effects.allowColony).toBe(true);
    expect(TECH_MAP["space_engine"].effects.allowPlanetEngine).toBe(true);
    expect(techDisplayName("ghost")).toBe("ghost");
    expect(techName("ghost")).toBe("ghost");
  });
});

describe("科技 DAG：前置、无环、E1 可达", () => {
  it("前置真实存在、不晚于自身 tier、全图无环、每项从 E1 可达（requiresAny 任一）", () => {
    for (const tech of TECH_DEFS) {
      for (const req of [...tech.requires, ...(tech.requiresAny ?? [])]) {
        const def = TECH_MAP[req];
        expect(def, `${tech.id} 依赖未知科技 ${req}`).toBeDefined();
        expect(def!.tier, `${tech.id} 的前置 ${req} 晚于自身时代`).toBeLessThanOrEqual(tech.tier);
      }
    }
    // 无环
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

    // 可达性 fixpoint：requires 全满足 + requiresAny 至少一项满足
    const reached = new Set(
      TECH_DEFS.filter((tech) => tech.requires.length === 0 && (tech.requiresAny ?? []).length === 0)
        .map((tech) => tech.id),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const tech of TECH_DEFS) {
        if (reached.has(tech.id)) continue;
        const hardOk = tech.requires.every((req) => reached.has(req));
        const softOk = (tech.requiresAny ?? []).length === 0
          || (tech.requiresAny ?? []).some((req) => reached.has(req));
        if (hardOk && softOk) {
          reached.add(tech.id);
          changed = true;
        }
      }
    }
    for (const tech of TECH_DEFS) {
      expect(reached.has(tech.id), `${tech.id} 无法从 E1 路径到达`).toBe(true);
    }
  });

  it("互斥教义不得成为硬前置；requiresAny 引用教义时必须覆盖整组或给出非教义选项", () => {
    for (const tech of TECH_DEFS) {
      for (const req of tech.requires) {
        expect(isDoctrineTech(req), `${tech.id} 把互斥教义 ${req} 当作硬前置，会导致路线锁死`).toBe(false);
      }
      const soft = tech.requiresAny ?? [];
      const doctrineSoft = soft.filter((id) => isDoctrineTech(id));
      if (doctrineSoft.length > 0) {
        const groups = new Set(doctrineSoft.map((id) => TECH_MAP[id].exclusiveGroup));
        for (const groupId of groups) {
          const group = getDoctrineGroupMeta(groupId!)!;
          const coveredAll = group.techIds.every((id) => soft.includes(id));
          const hasNonDoctrine = soft.some((id) => !isDoctrineTech(id));
          expect(
            coveredAll || hasNonDoctrine,
            `${tech.id} 的 requiresAny 只覆盖了教义组 ${groupId} 的部分选项`,
          ).toBe(true);
        }
      }
    }
  });

  it("techChainCost 与 totalTechCost 正确（旧链成本可加总）", () => {
    expect(techChainCost("astro_supernet")).toBe(
      ASTRO_CHAIN.reduce((sum, id) => sum + TECH_MAP[id].cost, 0),
    );
    expect(techChainCost("space_engine")).toBe(
      SPACE_CHAIN.reduce((sum, id) => sum + TECH_MAP[id].cost, 0),
    );
    expect(techChainCost("ghost")).toBe(0);
    expect(totalTechCost()).toBe(TECH_DEFS.reduce((sum, tech) => sum + tech.cost, 0));
    expect(totalTechCost()).toBeGreaterThan(45000);
  });

  it("时代推进门槛可被满足：每个时代要求的同代科技数量不超过该 tier 科技数", () => {
    for (const eraDef of ERAS) {
      for (const req of eraDef.requirements) {
        if (req.kind === "techsInEra") {
          const count = TECH_DEFS.filter((tech) => tech.tier === (req.era ?? 1)).length;
          expect(count, `${eraDef.name} 要求 ${req.era} 时代 ${req.target} 项`).toBeGreaterThanOrEqual(req.target);
        }
      }
    }
    // 天文台升级链与 core/constants.ts 冻结一致
    for (let level = 1; level <= 6; level++) {
      const info = OBSERVATORY_LEVELS[level];
      expect(info.requiresTech, `观测 Lv${level}`).toBe(ASTRO_CHAIN[level - 1]);
      expect(info.requiresEra).toBeGreaterThanOrEqual(1);
      const def = getTechDef(info.requiresTech!);
      expect(def, `观测 Lv${level} 的科技不存在`).toBeDefined();
      expect(def!.tier, `观测 Lv${level} 的科技晚于 requiresEra`).toBeLessThanOrEqual(info.requiresEra);
    }
  });
});

describe("互斥教义（exclusiveGroup）", () => {
  it("至少 6 组、每组 2-3 项、同组同 tier、元数据与科技字段一致", () => {
    expect(DOCTRINE_GROUPS.length).toBeGreaterThanOrEqual(6);
    const techGroups = new Map<string, string[]>();
    for (const tech of TECH_DEFS) {
      if (!tech.exclusiveGroup) continue;
      const list = techGroups.get(tech.exclusiveGroup) ?? [];
      list.push(tech.id);
      techGroups.set(tech.exclusiveGroup, list);
    }
    for (const group of DOCTRINE_GROUPS) {
      expect(group.title.length, group.id).toBeGreaterThan(0);
      expect(group.description.length, group.id).toBeGreaterThan(10);
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
      }
      expect(doctrineTechs(group.id).map((tech) => tech.id)).toEqual([...group.techIds]);
      // 科技侧的 group 也必须在元数据中出现
      for (const id of techGroups.get(group.id) ?? []) expect(group.techIds).toContain(id);
    }
    // 每组都必须是唯一组 id
    expect(new Set(DOCTRINE_GROUPS.map((g) => g.id)).size).toBe(DOCTRINE_GROUPS.length);
  });

  it("选择教义后同组其他项永久不可研究，canResearch 给出具体原因", () => {
    const state = stateWith(["energy_basic", "energy_grid", "industry_basic", "industry_automation"]);
    const first = chooseDoctrine(state, "energy_coal", 3);
    expect(first.ok, first.reason ?? "").toBe(true);
    expect(state.doctrineChoices?.["doctrine_energy"]).toBe("energy_coal");
    // 已选中的教义本身仍可研究
    expect(canResearch("energy_coal", state, 3).ok).toBe(true);
    // 同组其他两个选项被永久锁闭
    for (const other of ["energy_nuclear", "energy_solar_array"]) {
      const check = canResearch(other, state, 5);
      expect(check.ok, other).toBe(false);
      expect(check.reason ?? "", other).toContain("教义");
      expect(check.reason ?? "", other).toContain("能源路线");
    }
    expect(doctrineLockReason(state, "energy_nuclear")).toContain("燃煤扩张");
    // 非本组科技不受影响
    expect(canResearch("energy_solar", state, 3).ok).toBe(true);
  });

  it("chooseDoctrine 校验：未知科技 / 非教义科技 / 重复选择幂等 / 同组冲突 / applyDoctrine 别名", () => {
    const state = stateWith(["energy_basic", "energy_grid", "industry_basic", "industry_automation"]);
    expect(chooseDoctrine(state, "ghost_tech", 5).ok).toBe(false);
    expect(chooseDoctrine(state, "energy_solar", 5).ok).toBe(false); // 非教义科技
    expect(chooseDoctrine(state, "energy_coal", 5).ok).toBe(true);
    const again = chooseDoctrine(state, "energy_coal", 5);
    expect(again.ok).toBe(true);
    expect(again.notice).toBeTruthy();
    const conflict = chooseDoctrine(state, "energy_nuclear", 5);
    expect(conflict.ok).toBe(false);
    expect(conflict.reason ?? "").toContain("燃煤扩张");

    const other = stateWith([
      "energy_basic",
      "energy_grid",
      "industry_basic",
      "industry_automation",
      "industry_alloys",
    ]);
    const applied = applyDoctrine(other, "energy_solar_array", 3);
    expect(applied.ok, applied.reason ?? "").toBe(true);
    expect(other.doctrineChoices?.["doctrine_energy"]).toBe("energy_solar_array");

    // 时代不足时拒绝选择，避免锁定一个永远无法完成的教义
    const lowEra = stateWith(["energy_basic", "energy_grid", "industry_basic", "industry_automation"]);
    const rejected = chooseDoctrine(lowEra, "energy_coal", 2);
    expect(rejected.ok).toBe(false);
    expect(rejected.reason ?? "").toContain("第 3 时代");
    expect(lowEra.doctrineChoices?.["doctrine_energy"]).toBeUndefined();
  });

  it("研究完成教义科技时自动采纳教义，并锁定同组其他路线", () => {
    const state = stateWith(["energy_basic", "energy_grid", "industry_basic", "industry_automation"]);
    const started = startResearch(state, "energy_coal", 3);
    expect(started.ok, started.reason ?? "").toBe(true);
    const done = advanceResearch(state, 4000);
    expect(done.completedId).toBe("energy_coal");
    expect(done.doctrineChosen).toBe("energy_coal");
    expect(state.doctrineChoices?.["doctrine_energy"]).toBe("energy_coal");
    expect(canResearch("energy_nuclear", state, 5).ok).toBe(false);
    // 再次研究同组选项会被锁
    expect(startResearch(state, "energy_solar_array", 5).ok).toBe(false);
  });

  it("doctrineGroups 输出 6 组、选项状态与选择一致", () => {
    const state = stateWith(["energy_basic", "energy_grid", "industry_basic", "industry_automation"]);
    chooseDoctrine(state, "energy_coal", 3);
    const groups = doctrineGroups(state);
    expect(groups.length).toBe(DOCTRINE_GROUPS.length);
    const energy = groups.find((group) => group.id === "doctrine_energy")!;
    expect(energy.chosenTechId).toBe("energy_coal");
    expect(energy.options.length).toBe(3);
    expect(energy.options.find((option) => option.techId === "energy_coal")!.chosen).toBe(true);
    expect(energy.options.filter((option) => option.chosen).length).toBe(1);
    for (const option of energy.options) {
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.school).toBeTruthy();
    }
    // 无状态调用也能返回完整元数据
    expect(doctrineGroups().length).toBe(DOCTRINE_GROUPS.length);
  });
});

describe("canResearch 校验与原因", () => {
  it("未知科技 / 已研究 / 正在研究 的具体原因", () => {
    const state = createTechState();
    expect(canResearch("ghost_tech", state, 5)).toEqual({ ok: false, reason: "未知科技：ghost_tech" });
    state.researched = ["astro_basic"];
    expect(canResearch("astro_basic", state, 5).reason).toContain("已研究");
    state.activeTech = "energy_basic";
    expect(canResearch("energy_basic", state, 5).reason).toContain("正在研究");
    expect(activeTechDef(state)?.id).toBe("energy_basic");
    expect(activeResearchInfo(state)?.techId).toBe("energy_basic");
  });

  it("时代门槛优先于前置检查；era 缺省 5、非法 era 被夹取", () => {
    const state = createTechState();
    const gate = canResearch("astro_distance", state, 1);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain("第 2 时代");
    expect(gate.reason).not.toContain("前置科技");
    expect(canResearch("astro_supernet", state, 4).reason).toContain("第 5 时代");
    // era 缺省 = 5（旧调用全解锁）
    expect(canResearch("astro_distance", state).reason).toContain("前置科技");
    // era=0 → 夹到 1；NaN → 夹到 5
    expect(canResearch("energy_grid", state, 0).reason).toContain("第 2 时代");
    expect(clampTechEra(Number.NaN)).toBe(5);
    expect(clampTechEra(undefined)).toBe(5);
    expect(clampTechEra(-3)).toBe(1);
    expect(clampTechEra(9.8)).toBe(5);
  });

  it("requires 与 requiresAny 的拒绝原因与满足条件", () => {
    const state = stateWith(["astro_basic", "astro_distance", "astro_orbit"]);
    // requiresAny 未满足：给出可选项列表
    const missingAny = canResearch("astro_gravwave", state, 4);
    expect(missingAny.ok).toBe(false);
    expect(missingAny.reason ?? "").toContain("任一前置科技");
    expect(missingAny.reason ?? "").toContain("光谱分析");
    // 满足 requiresAny 的任一分支即可
    const viaSpectra = stateWith(["astro_basic", "astro_distance", "astro_orbit", "astro_spectra"]);
    expect(canResearch("astro_gravwave", viaSpectra, 4).ok).toBe(true);
    const viaComputer = stateWith(["astro_basic", "astro_distance", "astro_orbit", "comp_mechanism"]);
    expect(canResearch("astro_gravwave", viaComputer, 4).ok).toBe(true);
    // requiresAny 之外的硬前置仍需满足
    const missingHard = stateWith(["astro_basic", "astro_distance", "astro_spectra"]);
    const check = canResearch("astro_gravwave", missingHard, 4);
    expect(check.ok).toBe(false);
    expect(check.reason ?? "").toContain("轨道几何");
  });

  it("天文链在各自时代逐级可研究（旧覆盖保留）", () => {
    const state = createTechState();
    for (const id of ASTRO_CHAIN) {
      const def = getTechDef(id)!;
      if (def.tier > 1) {
        const blocked = canResearch(id, state, def.tier - 1);
        expect(blocked.ok, `${id} 在第 ${def.tier - 1} 时代不应可研究`).toBe(false);
        expect(blocked.reason).toContain(`第 ${def.tier} 时代`);
      }
      const check = canResearch(id, state, def.tier);
      expect(check.ok, `${id} 在第 ${def.tier} 时代应可研究：${check.reason}`).toBe(true);
      expect(startResearch(state, id, def.tier).ok).toBe(true);
      expect(advanceResearch(state, def.cost + 999).completedId).toBe(id);
    }
    expect([...state.researched]).toEqual([...ASTRO_CHAIN]);
    expect(branchProgress(state, "astronomy")).toEqual({ researched: 6, total: 9 });
  });
});

describe("研究推进、学派重心与研究速度", () => {
  it("createTechState 初始化 v1.3 字段", () => {
    const state = createTechState();
    expect(state.schoolFocus).toBeNull();
    expect(state.doctrineChoices).toEqual({});
    expect(state.schoolPoints).toEqual({});
    expect(state.researched).toEqual([]);
    expect(state.activeTech).toBeNull();
    expect(researchedCount(state)).toBe(0);
  });

  it("逐点投入 / 切换目标 / 无目标时不消耗（旧覆盖）", () => {
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
    expect(state.progress).toBe(0);
    expect(state.activeTech).toBe("industry_basic");

    expect(cancelResearch(state)).toBe(true);
    expect(state.activeTech).toBeNull();
    expect(cancelResearch(state)).toBe(false);
    expect(advanceResearch(state, 500)).toEqual({ completedId: null, spent: 0 });
    expect(state.totalScience).toBe(20);
    // 非法预算（NaN / 负数）不产生推进
    startResearch(state, "energy_basic", 1);
    expect(advanceResearch(state, Number.NaN)).toEqual({ completedId: null, spent: 0 });
    expect(advanceResearch(state, -100)).toEqual({ completedId: null, spent: 0 });
    expect(state.progress).toBe(0);
  });

  it("研究重心：同派 +15% / 跨派 -5% / 均衡 1.0，且 spent 不超过剩余所需", () => {
    const prereq = ["astro_basic", "astro_distance", "astro_orbit", "astro_threebody", "astro_chaos"];
    const focused = stateWith(prereq, { schoolFocus: "observation" });
    expect(researchSpeedFor(focused, "astro_supernet")).toBeCloseTo(1 + FOCUS_SPEED_BONUS, 9);
    startResearch(focused, "astro_supernet", 5);
    const r1 = advanceResearch(focused, 100);
    expect(r1.spent).toBeCloseTo(100, 9);
    expect(focused.progress).toBeCloseTo(115, 9);

    const crossed = stateWith(prereq, { schoolFocus: "industrial" });
    expect(researchSpeedFor(crossed, "astro_supernet")).toBeCloseTo(1 - CROSS_SCHOOL_PENALTY, 9);
    startResearch(crossed, "astro_supernet", 5);
    const r2 = advanceResearch(crossed, 100);
    expect(r2.spent).toBeCloseTo(100, 9);
    expect(crossed.progress).toBeCloseTo(95, 9);

    const balanced = stateWith(prereq, { schoolFocus: null });
    expect(researchSpeedFor(balanced, "astro_supernet")).toBe(1);
    startResearch(balanced, "astro_supernet", 5);
    advanceResearch(balanced, 100);
    expect(balanced.progress).toBeCloseTo(100, 9);

    // 剩余不足一次预算时，只消耗 remaining / speed
    const nearDone = stateWith(prereq, { schoolFocus: "observation" });
    startResearch(nearDone, "astro_supernet", 5);
    nearDone.progress = (getTechDef("astro_supernet")!.cost) - 11.5;
    const done = advanceResearch(nearDone, 1000);
    expect(done.completedId).toBe("astro_supernet");
    expect(done.spent).toBeCloseTo(10, 6);
    expect(nearDone.totalScience).toBeCloseTo(10, 6);
  });

  it("researchCostFor 随重心变化；setSchoolFocus 拒绝非法学派", () => {
    const balanced = createTechState();
    const focused = stateWith([], { schoolFocus: "calculation" });
    const base = getTechDef("astro_supernet")!.cost;
    expect(researchCostFor(balanced, "astro_supernet")).toBe(base);
    expect(researchCostFor(focused, "astro_supernet")).toBe(Math.ceil(base / (1 - CROSS_SCHOOL_PENALTY)));
    expect(researchCostFor(focused, "comp_ai")).toBe(Math.ceil(base / (1 + FOCUS_SPEED_BONUS)));
    expect(researchCostFor(balanced, "ghost_tech")).toBe(0);
    expect(setSchoolFocus(balanced, "observation").ok).toBe(true);
    expect(balanced.schoolFocus).toBe("observation");
    expect(setSchoolFocus(balanced, null).ok).toBe(true);
    expect(balanced.schoolFocus).toBeNull();
    expect(setSchoolFocus(balanced, "ghost_school" as never).ok).toBe(false);
  });

  it("schoolPoints 累计、schoolMastery 归一化、syncSchoolPoints 可从 researched 重建", () => {
    const state = createTechState();
    finishResearch(state, "energy_basic", 1);
    const expected = (getTechDef("energy_basic")!.tier * getTechDef("energy_basic")!.cost) / 10;
    expect(schoolPointsFor(state, "industrial")).toBeCloseTo(expected, 9);
    expect(schoolPointsFor(state, "ecological")).toBe(0);
    const mastery = schoolMastery(state, "industrial");
    expect(mastery).toBeGreaterThan(0);
    expect(mastery).toBeLessThan(1);
    expect(schoolPointTotal("industrial")).toBeGreaterThan(expected);

    // 直接构造 researched（旧存档 / 测试）：无 schoolPoints 时由列表推导
    const derived = stateWith(TECH_DEFS.filter((tech) => tech.school === "authority").map((tech) => tech.id));
    expect(schoolMastery(derived, "authority")).toBeCloseTo(1, 9);
    expect(schoolMastery(derived, "observation")).toBe(0);

    // syncSchoolPoints 写回缓存，且与推导一致
    syncSchoolPoints(derived);
    expect(derived.schoolPoints?.authority).toBeCloseTo(schoolPointTotal("authority"), 6);
    expect(schoolPointsFor(derived, "authority")).toBeCloseTo(schoolPointTotal("authority"), 6);
  });

  it("满精通使该学派效果 +10%（上限 +10%），部分精通按比例", () => {
    const authorityTechs = TECH_DEFS.filter((tech) => tech.school === "authority");
    const state = stateWith(authorityTechs.map((tech) => tech.id));
    expect(schoolMastery(state, "authority")).toBeCloseTo(1, 9);
    const rawStability = authorityTechs.reduce((sum, tech) => sum + (tech.effects.stabilityBonus ?? 0), 0);
    expect(rawStability).toBeGreaterThan(1);
    const agg = aggregateTechEffects(state);
    expect(agg.stabilityBonus).toBeCloseTo(rawStability * (1 + MASTERY_EFFECT_BONUS), 6);

    // 单科技状态：精通 = 该科技点数 / 全派点数，加成远小于满精通
    const single = stateWith(["society_tribe"]);
    const singleRaw = getTechDef("society_tribe")!.effects.stabilityBonus ?? 0;
    const singleMastery = schoolMastery(single, "authority");
    expect(singleMastery).toBeGreaterThan(0);
    expect(singleMastery).toBeLessThan(0.2);
    const singleAgg = aggregateTechEffects(single);
    expect(singleAgg.stabilityBonus).toBeCloseTo(singleRaw * (1 + MASTERY_EFFECT_BONUS * singleMastery), 6);
    expect(singleAgg.stabilityBonus).toBeLessThan(singleRaw * (1 + MASTERY_EFFECT_BONUS));
  });
});

describe("效果聚合 aggregateTechEffects / getTechMultipliers", () => {
  it("空科技状态：旧乘数为 1、加成为 0、新字段为中性默认值", () => {
    const state = createTechState();
    const mult = getTechMultipliers(state);
    expect(mult.research).toBe(1);
    expect(mult.observation).toBe(1);
    expect(mult.industry).toBe(1);
    expect(mult.agriculture).toBe(1);
    expect(mult.energy).toBe(1);
    expect(mult.prediction).toBe(1);
    expect(mult.habitability).toBe(1);
    expect(mult.disaster).toBe(1);
    expect(mult.populationCapacity).toBe(1);
    for (const value of Object.values(mult.production)) expect(value).toBe(1);
    const fx = aggregateTechEffects(state);
    expect(fx.allowColony).toBe(false);
    expect(fx.allowPlanetEngine).toBe(false);
    expect(fx.stabilityBonus).toBe(0);
    expect(fx.eventRiskMultiplier).toBe(1);
    expect(fx.politicalCapital).toBe(0);
    expect(fx.researchSpeed).toBe(0);
    expect(fx.departmentBoost).toBeDefined();
    for (const value of Object.values(fx.departmentBoost ?? {})) expect(value).toBe(0);
  });

  it("旧字段聚合仍正确：能源 / 农业 / 工业 / 观测 / 预测 / 解锁标记", () => {
    const state = stateWith(["energy_basic", "energy_grid", "energy_solar"]);
    const energy = getTechMultipliers(state);
    expect(energy.production.food).toBeGreaterThan(1);
    expect(energy.production.energy).toBeGreaterThan(1.1);
    // 能源乘数包含该学派精通加成（少量），应接近但不超过 1.12 × 1.1
    expect(energy.energy).toBeGreaterThan(1.1);
    expect(energy.energy).toBeLessThanOrEqual(1.12 * 1.1);
    expect(energy.industry).toBeGreaterThan(1);

    const astro = getTechMultipliers(stateWith(["astro_basic", "astro_distance", "astro_orbit"]));
    expect(astro.observation).toBeGreaterThan(1.15);
    expect(astro.prediction).toBeGreaterThan(1.05);

    const bio = aggregateTechEffects(stateWith(["bio_basic", "bio_medicine", "bio_ecology"]));
    expect(bio.habitabilityBonus ?? 0).toBeGreaterThan(0.04);
    expect(bio.populationCapacityBonus ?? 0).toBeGreaterThan(0.03);

    const space = aggregateTechEffects(stateWith(["space_basic", "space_orbital", "space_colony"]));
    expect(space.allowColony).toBe(true);
    expect(space.allowPlanetEngine).toBe(false);
    const spaceFull = aggregateTechEffects(stateWith([...SPACE_CHAIN]));
    expect(spaceFull.allowPlanetEngine).toBe(true);
  });

  it("新字段聚合：稳定度 / 事件风险 / 政治资本 / 部门增益 / 研究速度", () => {
    const state = stateWith([
      "society_tribe",
      "society_law",
      "comp_archive",
      "comp_crypto",
      "comp_distributed",
      "society_bureau",
      "society_publicschool",
      "society_technocracy",
    ]);
    const fx = aggregateTechEffects(state);
    expect(fx.stabilityBonus ?? 0).toBeGreaterThan(2);
    expect(fx.eventRiskMultiplier ?? 1).toBeLessThan(1);
    expect(fx.eventRiskMultiplier ?? 1).toBeGreaterThanOrEqual(0.5);
    expect(fx.politicalCapital ?? 0).toBeGreaterThan(1);
    expect((fx.departmentBoost?.administration ?? 0)).toBeGreaterThan(0.03);
    expect((fx.departmentBoost?.science ?? 0)).toBeGreaterThan(0);
    expect(fx.researchSpeed ?? 0).toBeGreaterThan(0.03);
    // researchSpeed 并入 getTechMultipliers().research
    const mult = getTechMultipliers(state);
    expect(mult.research).toBeCloseTo((fx.researchMultiplier ?? 1) * (1 + (fx.researchSpeed ?? 0)), 6);
    // 科技乘数顺序不影响结果（正向效果 > 1）
    expect(mult.research).toBeGreaterThan(1);
  });

  it("全部 72 项科技学完：所有数值有限且不越界（不会让经济爆炸）", () => {
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
    for (const value of numbers) {
      expect(typeof value === "number" && Number.isFinite(value), String(value)).toBe(true);
    }
    for (const value of Object.values(fx.productionMultiplier ?? {})) {
      expect(value).toBeGreaterThanOrEqual(0.2);
      expect(value).toBeLessThanOrEqual(5);
    }
    expect(fx.industryMultiplier ?? 1).toBeLessThanOrEqual(4);
    expect(fx.habitabilityBonus ?? 0).toBeLessThanOrEqual(0.6);
    expect(fx.disasterResistance ?? 0).toBeLessThanOrEqual(0.8);
    expect(fx.populationCapacityBonus ?? 0).toBeLessThanOrEqual(0.8);
    expect(fx.stabilityBonus ?? 0).toBeGreaterThanOrEqual(-10);
    expect(fx.stabilityBonus ?? 0).toBeLessThanOrEqual(15);
    expect(fx.eventRiskMultiplier ?? 1).toBeGreaterThanOrEqual(0.5);
    expect(fx.eventRiskMultiplier ?? 1).toBeLessThanOrEqual(1.2);
    expect(fx.politicalCapital ?? 0).toBeLessThanOrEqual(8);
    expect(fx.researchSpeed ?? 0).toBeLessThanOrEqual(1.5);
    for (const value of Object.values(fx.departmentBoost ?? {})) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0.5);
    }
    expect(fx.allowColony).toBe(true);
    expect(fx.allowPlanetEngine).toBe(true);
    const mult = getTechMultipliers(state);
    for (const value of Object.values(mult)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
    for (const value of Object.values(mult.production)) expect(Number.isFinite(value)).toBe(true);
  });

  it("未知 id 被安全忽略；非有限数值不会泄漏到聚合结果", () => {
    const state = stateWith(["ghost_tech", "energy_basic"]);
    expect(() => aggregateTechEffects(state)).not.toThrow();
    expect(getTechMultipliers(state).production.food).toBeGreaterThan(1);
    // 非法输入
    const weird = createTechState();
    weird.researched = ["ghost_tech"];
    weird.progress = Number.NaN;
    weird.totalScience = Number.POSITIVE_INFINITY;
    expect(() => aggregateTechEffects(weird)).not.toThrow();
    expect(() => getTechMultipliers(weird)).not.toThrow();
    const fx = aggregateTechEffects(weird);
    expect(Number.isFinite(fx.researchMultiplier ?? 1)).toBe(true);
    expect(Number.isFinite(fx.stabilityBonus ?? 0)).toBe(true);
  });

  it("branchProgress / researchedCount / techSchoolOf 覆盖 8 分支", () => {
    const state = stateWith(["energy_basic", "energy_grid", "industry_basic", "bio_basic", "space_basic", "comp_abacus"]);
    expect(researchedCount(state)).toBe(6);
    for (const branch of TECH_BRANCH_ORDER) {
      const progress = branchProgress(state, branch);
      expect(progress.total, branch).toBe(9);
      expect(progress.researched).toBeGreaterThanOrEqual(0);
      expect(progress.researched).toBeLessThanOrEqual(progress.total);
    }
    expect(branchProgress(state, "energy")).toEqual({ researched: 2, total: 9 });
    expect(branchProgress(state, "astronomy").researched).toBe(0);
    expect(techSchoolOf("energy_basic")).toBe("industrial");
    expect(techSchoolOf("ghost_tech")).toBeNull();
    // 学完某分支全部科技后进度为满
    const astronomy = stateWith(techsByBranch("astronomy").map((tech) => tech.id));
    expect(branchProgress(astronomy, "astronomy")).toEqual({ researched: 9, total: 9 });
    expect(isResearched(astronomy, "astro_supernet")).toBe(true);
    expect(isResearched(astronomy, "energy_basic")).toBe(false);
    expect(isDoctrineTech("astro_watch")).toBe(true);
    expect(isDoctrineTech("astro_supernet")).toBe(false);
  });
});
