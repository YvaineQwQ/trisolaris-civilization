/**
 * 观测系统测试夹具：构造一个确定性的三维层级三体 + 母星系统，并提供
 * "按文明回合推进物理 + 观测流程" 的辅助函数。
 */
import {
  G, SOLAR_RADIUS_AU, STAR_BASE_NAMES, STAR_COLORS, TURN_YEARS,
} from "../../src/core/constants";
import { orbitPlaneToWorld, rad, v3 } from "../../src/core/math";
import { Rng } from "../../src/core/rng";
import { createPhysicsState, stepPhysics, type PlanetInit, type StarInit } from "../../src/physics/nbody";
import { createEnvironmentState, updateEnvironment } from "../../src/environment/climate";
import type {
  EnvironmentState, ObservationKind, ObservationState, PhysicsState, StarTarget,
} from "../../src/core/types";
import {
  createObservationState, finishTurns, levelInfo, performNakedEyeCalibration, sampleTick,
  startObservation, syncObservation, taskMeta, type ObservationContext,
} from "../../src/observation/observation";
import type { ObservationLogEntry, StartObservationResult } from "../../src/observation/observation";

/** 物理积分步长（测试用；比生产 PHYSICS_DT 粗，但足够稳定且快）。 */
export const TEST_DT = 0.01;
/** 一个回合的观测采样切片数（0.05 年/片）。 */
export const SLICES_PER_TURN = Math.round(TURN_YEARS / 0.05);

function starInit(id: "A" | "B" | "C", mass: number): StarInit {
  return {
    id,
    name: STAR_BASE_NAMES[id],
    mass,
    radius: SOLAR_RADIUS_AU * Math.pow(mass, 0.8),
    luminosity: Math.pow(mass, 3.45),
    surfaceTempK: 5772 * Math.pow(mass, 0.55),
    color: STAR_COLORS[id],
    pos: v3(0, 0, 0),
    vel: v3(0, 0, 0),
  };
}

export interface TestSystem {
  physics: PhysicsState;
  env: EnvironmentState;
}

/** 确定性构造：内双星 AB（0.7 AU、e=0.15、倾角 25°）+ 外恒星 C（2.6 AU、倾角 35°）+ 母星（3.2 AU）。 */
export function makeTestSystem(): TestSystem {
  const rng = new Rng("observation-fixture-v1");
  const mA = 1.05;
  const mB = 0.82;
  const mC = 0.61;
  const A = starInit("A", mA);
  const B = starInit("B", mB);
  const C = starInit("C", mC);

  // 内双星
  const aAB = 0.7;
  const eAB = 0.15;
  const incAB = rad(25);
  const nodeAB = rad(40);
  const muAB = G * (mA + mB);
  const rRel = aAB * (1 - eAB);
  const hAB = Math.sqrt(muAB * aAB * (1 - eAB * eAB));
  const vt = hAB / rRel;
  const v2rel = muAB * (2 / rRel - 1 / aAB);
  const vr = Math.sqrt(Math.max(0, v2rel - vt * vt));
  const phase = rng.float(0, Math.PI * 2);
  const cP = Math.cos(phase);
  const sP = Math.sin(phase);
  const posRel = orbitPlaneToWorld(rRel * cP, rRel * sP, incAB, nodeAB);
  const velRel = orbitPlaneToWorld(vr * cP - vt * sP, vr * sP + vt * cP, incAB, nodeAB);
  const fA = mB / (mA + mB);
  const fB = mA / (mA + mB);
  A.pos = { x: -posRel.x * fA, y: -posRel.y * fA, z: -posRel.z * fA };
  B.pos = { x: posRel.x * fB, y: posRel.y * fB, z: posRel.z * fB };
  A.vel = { x: -velRel.x * fA, y: -velRel.y * fA, z: -velRel.z * fA };
  B.vel = { x: velRel.x * fB, y: velRel.y * fB, z: velRel.z * fB };

  // 外恒星 C
  const rC = 2.6;
  const incC = rad(35);
  const nodeC = rad(120);
  const muC = G * (mA + mB + mC);
  const vCmag = Math.sqrt(muC / rC);
  const phaseC = rng.float(0, Math.PI * 2);
  const cC = Math.cos(phaseC);
  const sC = Math.sin(phaseC);
  C.pos = orbitPlaneToWorld(rC * cC, rC * sC, incC, nodeC);
  C.vel = orbitPlaneToWorld(-vCmag * sC, vCmag * cC, incC, nodeC);
  const abMass = mA + mB;
  const totalMass = mA + mB + mC;
  const shift = {
    x: -(mC * C.vel.x) / totalMass,
    y: -(mC * C.vel.y) / totalMass,
    z: -(mC * C.vel.z) / totalMass,
  };
  A.vel.x += shift.x; A.vel.y += shift.y; A.vel.z += shift.z;
  B.vel.x += shift.x; B.vel.y += shift.y; B.vel.z += shift.z;
  void abMass;

  // 母星
  const rP = 3.2;
  const incP = rad(18);
  const nodeP = rad(200);
  const phaseP = rng.float(0, Math.PI * 2);
  const cPl = Math.cos(phaseP);
  const sPl = Math.sin(phaseP);
  const vPMag = Math.sqrt((G * totalMass) / rP);
  const planet: PlanetInit = {
    name: "曦和",
    mass: 1.0,
    radiusKm: 6371,
    pos: orbitPlaneToWorld(rP * cPl, rP * sPl, incP, nodeP),
    vel: orbitPlaneToWorld(-vPMag * sPl, vPMag * cPl, incP, nodeP),
    albedo: 0.3,
    greenhouseK: 26,
    thermalTauYears: 0.2,
    water: 0.7,
    atmosphere: 0.95,
    ecology: 0.7,
  };

  // 平移到总质心并归零总动量（含母星，质量按地球质量换算成太阳质量级）。
  const bodies = [
    { m: mA, p: A.pos, v: A.vel },
    { m: mB, p: B.pos, v: B.vel },
    { m: mC, p: C.pos, v: C.vel },
    { m: planet.mass * 3.0034896e-6, p: planet.pos, v: planet.vel },
  ];
  const mt = bodies.reduce((s, b) => s + b.m, 0);
  const cx = bodies.reduce((s, b) => s + b.m * b.p.x, 0) / mt;
  const cy = bodies.reduce((s, b) => s + b.m * b.p.y, 0) / mt;
  const cz = bodies.reduce((s, b) => s + b.m * b.p.z, 0) / mt;
  const px = bodies.reduce((s, b) => s + b.m * b.v.x, 0) / mt;
  const py = bodies.reduce((s, b) => s + b.m * b.v.y, 0) / mt;
  const pz = bodies.reduce((s, b) => s + b.m * b.v.z, 0) / mt;
  for (const b of bodies) {
    b.p.x -= cx; b.p.y -= cy; b.p.z -= cz;
    b.v.x -= px; b.v.y -= py; b.v.z -= pz;
  }

  const physics = createPhysicsState([A, B, C], planet, TEST_DT, 0.008);
  const env = createEnvironmentState(physics);
  return { physics, env };
}

export function makeCtx(overrides: Partial<ObservationContext> = {}): ObservationContext {
  return {
    level: 3,
    difficultyNoise: 1,
    techObservationMultiplier: 0,
    techPredictionMultiplier: 0,
    efficiency: 1,
    weather: "clear",
    time: 0,
    turn: 0,
    ...overrides,
  };
}

export interface ObservationFixture extends TestSystem {
  obs: ObservationState;
  ctx: ObservationContext;
}

/** 新建系统 + 观测状态 + 开局肉眼校准。 */
export function makeObservation(seed = "OBS-TEST", level = 1): ObservationFixture {
  const system = makeTestSystem();
  const obs = createObservationState(seed, 0);
  const ctx = makeCtx({ level });
  performNakedEyeCalibration(obs, system.physics, system.env, ctx);
  return { ...system, obs, ctx };
}

/** 推进物理与气候 years 年（一次步进），并把 ctx.weather 同步为当前天气。 */
export function advancePhysicsYears(system: TestSystem, years: number, ctx?: ObservationContext): void {
  const steps = Math.max(1, Math.round(years / system.physics.dtYears));
  for (let i = 0; i < steps; i++) stepPhysics(system.physics);
  updateEnvironment(system.env, system.physics, years);
  if (ctx) {
    ctx.weather = system.env.weather;
    ctx.time = system.physics.timeYears;
  }
}

export interface RunTaskResult {
  start: StartObservationResult;
  logs: ObservationLogEntry[];
  discovery: string | null;
  turnsRun: number;
}

/**
 * 完整跑一个观测任务：每 0.05 年切片调用 sampleTick + syncObservation，
 * 每回合结束调用 finishTurns。返回日志与发现。
 */
export function runObservationTask(
  fixture: ObservationFixture,
  opts: { kind: ObservationKind; target: StarTarget; turns?: number; level?: number; energy?: number },
): RunTaskResult {
  const level = opts.level ?? fixture.ctx.level;
  fixture.ctx.level = level;
  const required = levelInfo(level).taskTurns + taskMeta(opts.kind).extraTurns;
  const turns = opts.turns ?? required;
  const start = startObservation(
    fixture.obs,
    fixture.physics,
    level,
    opts.kind,
    opts.target,
    fixture.physics.timeYears,
    opts.energy ?? 10_000,
  );
  const logs: ObservationLogEntry[] = [];
  let discovery: string | null = null;
  if (!start.ok) return { start, logs, discovery, turnsRun: 0 };
  for (let t = 0; t < turns; t++) {
    for (let slice = 0; slice < SLICES_PER_TURN; slice++) {
      advancePhysicsYears(fixture, 0.05, fixture.ctx);
      sampleTick(fixture.obs, fixture.physics, fixture.env, 0.05, fixture.ctx);
      syncObservation(fixture.obs, fixture.physics, fixture.env, 0.05, fixture.ctx);
    }
    fixture.ctx.turn += 1;
    const result = finishTurns(fixture.obs, fixture.physics, fixture.env, 1, fixture.ctx);
    logs.push(...result.logs);
    if (result.discovery && !discovery) discovery = result.discovery;
  }
  return { start, logs, discovery, turnsRun: turns };
}

export interface TurnResult {
  logs: ObservationLogEntry[];
  discovery: string | null;
  completed: boolean;
}

/** 推进一个文明回合（10 个 0.05 年切片 + finishTurns），用于逐回合检查任务进度。 */
export function advanceObservationTurn(fixture: ObservationFixture): TurnResult {
  for (let slice = 0; slice < SLICES_PER_TURN; slice++) {
    advancePhysicsYears(fixture, 0.05, fixture.ctx);
    sampleTick(fixture.obs, fixture.physics, fixture.env, 0.05, fixture.ctx);
    syncObservation(fixture.obs, fixture.physics, fixture.env, 0.05, fixture.ctx);
  }
  fixture.ctx.turn += 1;
  const result = finishTurns(fixture.obs, fixture.physics, fixture.env, 1, fixture.ctx);
  return { logs: result.logs, discovery: result.discovery, completed: result.completed };
}

/** 推进 n 个"空回合"（无观测任务）：物理前进 + syncObservation + finishTurns。 */
export function runIdleTurns(fixture: ObservationFixture, turns: number): ObservationLogEntry[] {
  const logs: ObservationLogEntry[] = [];
  for (let t = 0; t < turns; t++) {
    for (let slice = 0; slice < SLICES_PER_TURN; slice++) {
      advancePhysicsYears(fixture, 0.05, fixture.ctx);
      syncObservation(fixture.obs, fixture.physics, fixture.env, 0.05, fixture.ctx);
    }
    fixture.ctx.turn += 1;
    const result = finishTurns(fixture.obs, fixture.physics, fixture.env, 1, fixture.ctx);
    logs.push(...result.logs);
  }
  return logs;
}

/** 真实状态与观测估计的误差（仅测试用于断言数据隔离，生产代码禁止）。 */
export function trueStateErrors(fixture: ObservationFixture): {
  starPosError: { A: number; B: number; C: number };
  meanStarPosError: number;
} {
  const errors = { A: 0, B: 0, C: 0 };
  for (const star of fixture.physics.stars) {
    const est = fixture.obs.stars[star.id];
    errors[star.id] = Math.hypot(est.pos.x - star.pos.x, est.pos.y - star.pos.y, est.pos.z - star.pos.z);
  }
  return {
    starPosError: errors,
    meanStarPosError: (errors.A + errors.B + errors.C) / 3,
  };
}
