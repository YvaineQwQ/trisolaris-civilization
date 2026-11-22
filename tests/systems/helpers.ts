/**
 * tests/systems 共用夹具：构造文明世界（文明 + 建筑 + 科技 + 环境）并推进回合。
 *
 * 阶段 12「时代进化」口径：
 *  - 新开文明为 E1 原始部落（人口 500 / nightmare 400、era=1、无 metals/energy）；
 *  - runTurn 与 game 层保持一致：aggregateBuildingEffects 传入 civ.era（旧时代产出折减），
 *    TurnContext.era 也传入 civ.era（资源门槛 + 时代内效率修正）。
 *  - 需要测试「不传 era 的旧行为」时，给 TurnOverrides.era 传 null 即可（ctx.era 缺省）。
 */
import type {
  BuildingState,
  CivilizationState,
  DifficultyKey,
  EnvironmentState,
  GameMode,
  PhysicsState,
  ResourceId,
  TechState,
} from "../../src/core/types";
import { TURN_YEARS } from "../../src/core/constants";
import { createCivilizationState } from "../../src/civilization";
import { RESOURCE_IDS } from "../../src/civilization/resources";
import {
  BUILDING_DEFS,
  aggregateBuildingEffects,
  createBuildingState,
  createInitialBuildingState,
  totalMaintenance,
  totalWorkers,
} from "../../src/buildings";
import { aggregateTechEffects, createTechState, getTechMultipliers } from "../../src/technology";
import { resolveTurn } from "../../src/economy";
import type { TurnContext, TurnCrisis, TurnReport } from "../../src/economy";

export function makeEnvironment(overrides: Partial<EnvironmentState> = {}): EnvironmentState {
  const base: EnvironmentState = {
    stellarFlux: 1,
    equilibriumTempC: 16,
    surfaceTempC: 16,
    greenhouseK: 33,
    albedo: 0.3,
    habitability: 0.85,
    ecology: 0.8,
    water: 0.8,
    atmosphere: 1,
    weather: "clear",
    fluxAnomaly: 1,
    lastUpdateYear: 0,
    temperatureHistory: [{ year: 0, tempC: 16, flux: 1 }],
    lastHistorySample: 0,
  };
  return { ...base, ...overrides };
}

/** 只包含文明回合结算所需的字段的物理状态 stub。 */
export function makePhysics(planetAlive = true): PhysicsState {
  return { planetAlive, planetEjected: false } as unknown as PhysicsState;
}

export interface WorldOptions {
  difficulty?: DifficultyKey;
  mode?: GameMode;
  /** 已研究科技 id 列表。 */
  researched?: string[];
  /** 覆盖初始建筑数量；传 undefined 使用 createInitialBuildingState 的默认开局。 */
  buildings?: Record<string, number>;
  /** 文明时代（默认 1，即 E1 原始部落）。 */
  era?: number;
  /** 额外覆盖初始资源数量（会把库存上限一并抬高，方便测试高价建筑）。 */
  resources?: Partial<Record<ResourceId, number>>;
}

export interface World {
  civ: CivilizationState;
  buildings: BuildingState;
  tech: TechState;
  difficulty: DifficultyKey;
  mode: GameMode;
}

/** 把文明资源补到指定数量（同时抬高库存上限，避免被 clamp 掉）。 */
export function grantResources(civ: CivilizationState, patch: Partial<Record<ResourceId, number>>): void {
  for (const id of RESOURCE_IDS) {
    const want = patch[id];
    if (want == null) continue;
    const stock = civ.resources[id];
    stock.capacity = Math.max(stock.capacity, want);
    stock.amount = Math.max(0, Math.min(want, stock.capacity));
  }
}

/** 六种资源全部补到同一数量（建造/升级/科技前置测试用）。 */
export function fillResources(civ: CivilizationState, amount = 50000): void {
  const patch: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) patch[id] = amount;
  grantResources(civ, patch);
}

/** 读取若干资源的当前数量，便于断言「扣费 / 返还」。 */
export function resourceAmounts(
  civ: CivilizationState,
  ids: readonly ResourceId[] = ["food", "water", "minerals", "metals", "energy", "science"],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = civ.resources[id].amount;
  return out;
}

export function createWorld(options: WorldOptions = {}): World {
  const difficulty = options.difficulty ?? "normal";
  const mode = options.mode ?? "normal";
  const civ = createCivilizationState({ difficulty, mode, seed: "TEST-SEED" });
  civ.era = options.era ?? 1;
  if (options.resources) grantResources(civ, options.resources);
  const buildings = options.buildings
    ? createBuildingState(options.buildings)
    : createInitialBuildingState();
  const tech = createTechState();
  if (options.researched) tech.researched = [...options.researched];
  return { civ, buildings, tech, difficulty, mode };
}

export interface TurnOverrides {
  crisis?: Partial<TurnCrisis>;
  observatoryLevel?: number;
  researchedCount?: number;
  buildingsCompleted?: string[];
  researchCompleted?: string | null;
  workerJobs?: number;
  researchSpent?: number;
  constructionCount?: number;
  hasPlanetEngine?: boolean;
  planetAlive?: boolean;
  years?: number;
  /**
   * 本回合 ctx.era：
   *  - undefined（默认）：使用 world.civ.era（game 层真实行为）；
   *  - null：完全不传 era，测试「旧行为向后兼容」；
   *  - number：覆盖为指定时代。
   */
  era?: number | null;
  /** 覆盖建筑维护费（默认由建筑状态计算）；测试资源门槛对维护费的过滤用。 */
  maintenance?: Partial<Record<ResourceId, number>>;
}

/** 用当前世界状态组装 TurnContext 并结算一个回合。 */
export function runTurn(world: World, env: EnvironmentState, overrides: TurnOverrides = {}): TurnReport {
  const era = overrides.era === undefined ? world.civ.era : overrides.era === null ? undefined : overrides.era;
  const effects = aggregateBuildingEffects(world.buildings, BUILDING_DEFS, era);
  const techEffects = aggregateTechEffects(world.tech);
  const techMultipliers = getTechMultipliers(world.tech);
  const crisis: TurnCrisis = {
    foodMultiplier: 1,
    energyDemandMultiplier: 1,
    stabilityPenalty: 0,
    disasterDamage: 0,
    ...(overrides.crisis ?? {}),
  };
  const ctx: TurnContext = {
    years: overrides.years ?? TURN_YEARS,
    turn: world.civ.turn + 1,
    env,
    physics: makePhysics(overrides.planetAlive ?? true),
    buildingEffects: effects,
    techEffects,
    techMultipliers,
    crisis,
    mode: world.mode,
    difficulty: world.difficulty,
    year: (world.civ.turn + 1) * TURN_YEARS,
    maintenance: overrides.maintenance ?? totalMaintenance(world.buildings, BUILDING_DEFS),
    observatoryLevel: overrides.observatoryLevel ?? 0,
    researchedCount: overrides.researchedCount ?? world.tech.researched.length,
    buildingsCompleted: overrides.buildingsCompleted,
    researchCompleted: overrides.researchCompleted,
    workerJobs: overrides.workerJobs ?? totalWorkers(world.buildings, BUILDING_DEFS),
    researchSpent: overrides.researchSpent ?? 0,
    constructionCount: overrides.constructionCount ?? 0,
    hasPlanetEngine: overrides.hasPlanetEngine,
    era,
  };
  return resolveTurn(world.civ, ctx);
}

/** 连续跑 n 个回合（固定环境与覆盖项），返回报告数组。 */
export function runTurns(world: World, env: EnvironmentState, n: number, overrides: TurnOverrides = {}): TurnReport[] {
  const reports: TurnReport[] = [];
  for (let i = 0; i < n; i++) reports.push(runTurn(world, env, overrides));
  return reports;
}
