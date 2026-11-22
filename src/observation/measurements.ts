/**
 * 测量模型（三维）：把"真实物理状态"转换成带噪仪器读数。
 *
 * 这是观测系统里唯一允许读取真实 PhysicsState 的文件；下游（估计器、玩家模型、
 * UI）只能消费 StarMeasurement / PlanetMeasurement。噪声在 X / Y / Z 三轴独立采样，
 * 每次观测任务有一个三维系统偏差 sessionBias（单次任务内不会通过平均消除）。
 */
import { clamp } from "../core/math";
import { Rng } from "../core/rng";
import type { Vec3 } from "../core/math";
import type {
  ObservationKind, PlanetMeasurement, PhysicsState, StarId, StarMeasurement, WeatherKind,
} from "../core/types";
import { getCapabilities } from "./observatory";

export interface MeasurementContext {
  difficultyNoise: number;
  weather: WeatherKind;
  efficiency: number;
  techObservationMultiplier: number;
  level: number;
}

export interface SessionParams {
  id: string;
  kind: ObservationKind;
  targets: StarId[];
  /** 本次观测任务的三维系统偏差（以 sigma 为单位）。 */
  sessionBias: Vec3;
  sampleIndex: number;
  /** 任务级的精度倍率（<1 表示该任务更精密）。 */
  sigmaMultiplier?: number;
}

function weatherFactor(weather: WeatherKind): number {
  switch (weather) {
    case "clear": return 1;
    case "cloudy": return 1.35;
    case "storm": return 1.9;
    case "ash": return 2.4;
    case "freezing": return 1.45;
    case "scorching": return 1.7;
  }
}

function kindSigma(kind: ObservationKind): number {
  switch (kind) {
    case "star-position": return 1.0;
    case "star-distance": return 0.85;
    case "star-velocity": return 0.72;
    case "planet-survey": return 1.0;
    case "binary-relative": return 0.8;
    case "triple-joint": return 0.65;
    case "long-term": return 0.55;
    case "anomaly": return 0.45;
  }
}

export interface NoiseModel {
  positionSigmaAt1AU: number;
  velocitySigma: number;
  massSigmaFraction: number;
  tempSigma: number;
}

export function noiseModel(level: number, ctx: MeasurementContext): NoiseModel {
  const caps = getCapabilities(level);
  const tech = 1 / (1 + Math.max(0, ctx.techObservationMultiplier));
  const weather = weatherFactor(ctx.weather);
  const eff = clamp(ctx.efficiency, 0.25, 1.6);
  return {
    positionSigmaAt1AU: caps.positionSigma * ctx.difficultyNoise * weather * tech / eff,
    velocitySigma: caps.velocitySigma * ctx.difficultyNoise * tech / eff,
    massSigmaFraction: caps.massSigma * ctx.difficultyNoise / eff,
    tempSigma: 12 / (1 + level * 1.1) * ctx.difficultyNoise,
  };
}

/** 三轴独立高斯噪声。 */
function noise3(rng: Rng, sigma: number): Vec3 {
  return {
    x: rng.normal(0, sigma),
    y: rng.normal(0, sigma),
    z: rng.normal(0, sigma),
  };
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function sampleStarMeasurements(
  physics: PhysicsState,
  ctx: MeasurementContext,
  session: SessionParams,
  timeYears: number,
): StarMeasurement[] {
  const model = noiseModel(ctx.level, ctx);
  const rng = new Rng(session.id + "|star|" + session.sampleIndex + "|" + timeYears.toFixed(4));
  const taskScale = session.sigmaMultiplier !== undefined ? Math.max(0.05, session.sigmaMultiplier) : 1;
  const out: StarMeasurement[] = [];
  for (const starId of session.targets) {
    const star = physics.stars.find((s) => s.id === starId);
    if (!star) continue;
    const dPlanetStar = dist3(physics.planet.pos, star.pos);
    const distanceFactor = Math.pow(Math.max(dPlanetStar, 0.15), 0.65);
    const sigma = Math.max(1e-5, model.positionSigmaAt1AU * distanceFactor * kindSigma(session.kind) * taskScale);
    // 系统偏差：每个任务抽取一次，三轴独立，不随采样平均消除。
    const bias = { x: session.sessionBias.x * sigma, y: session.sessionBias.y * sigma, z: session.sessionBias.z * sigma };
    const n = noise3(rng, sigma);
    const measured: Vec3 = { x: star.pos.x + bias.x + n.x, y: star.pos.y + bias.y + n.y, z: star.pos.z + bias.z + n.z };
    const measurement: StarMeasurement = {
      starId,
      timeYears,
      pos: measured,
      posSigma: sigma,
      distanceAU: dist3(measured, physics.planet.pos),
      kind: session.kind,
    };
    // 速度/质量只有等级 >= 3 的仪器才能直接测得（低等级由位置拟合间接给出，或无）。
    if (ctx.level >= 3) {
      const vsigma = Math.max(model.velocitySigma * kindSigma(session.kind) * taskScale, 1e-4);
      const vn = noise3(rng, vsigma);
      measurement.vel = {
        x: star.vel.x + session.sessionBias.x * vsigma + vn.x,
        y: star.vel.y + session.sessionBias.y * vsigma + vn.y,
        z: star.vel.z + session.sessionBias.z * vsigma + vn.z,
      };
      measurement.velSigma = vsigma;
    }
    if (ctx.level >= 3) {
      const msigma = Math.max(0.02, star.mass * model.massSigmaFraction * kindSigma(session.kind) * taskScale);
      measurement.mass = Math.max(0.05, star.mass + rng.normal(0, msigma));
      measurement.massSigma = msigma;
    }
    out.push(measurement);
  }
  return out;
}

export function samplePlanetMeasurement(
  physics: PhysicsState,
  ctx: MeasurementContext,
  session: SessionParams,
  timeYears: number,
): PlanetMeasurement {
  const model = noiseModel(ctx.level, ctx);
  const rng = new Rng(session.id + "|planet|" + session.sampleIndex + "|" + timeYears.toFixed(4));
  const taskScale = session.sigmaMultiplier !== undefined ? Math.max(0.05, session.sigmaMultiplier) : 1;
  const dist = Math.hypot(physics.planet.pos.x, physics.planet.pos.y, physics.planet.pos.z);
  const sigma = Math.max(
    1e-5,
    model.positionSigmaAt1AU * Math.pow(Math.max(dist, 0.2), 0.65) * kindSigma(session.kind) * taskScale,
  );
  const bias = { x: session.sessionBias.x * sigma, y: session.sessionBias.y * sigma, z: session.sessionBias.z * sigma };
  const n = noise3(rng, sigma);
  return {
    timeYears,
    pos: {
      x: physics.planet.pos.x + bias.x + n.x,
      y: physics.planet.pos.y + bias.y + n.y,
      z: physics.planet.pos.z + bias.z + n.z,
    },
    posSigma: sigma,
    // 温度由观测编排器从环境状态（带测量噪声）填入。
    tempC: undefined,
    tempSigma: model.tempSigma,
    kind: session.kind,
  };
}

/**
 * 开局肉眼观测：三颗恒星只有粗略位置（sigma 约 0.25~0.6 AU，随距离增大），
 * 没有速度与质量；母星位置也只有一个粗略点。
 */
export interface NakedEyeResult {
  stars: StarMeasurement[];
  planet: PlanetMeasurement;
}

export function sampleNakedEyeMeasurements(
  physics: PhysicsState,
  seedBase: string,
  timeYears: number,
): NakedEyeResult {
  const rng = new Rng(seedBase + "|naked-eye|" + timeYears.toFixed(4));
  const sessionBias: Vec3 = { x: rng.normal(0, 0.6), y: rng.normal(0, 0.6), z: rng.normal(0, 0.6) };
  const planetSigma = 0.11;
  const planetPos: Vec3 = {
    x: physics.planet.pos.x + sessionBias.x * planetSigma + rng.normal(0, planetSigma),
    y: physics.planet.pos.y + sessionBias.y * planetSigma + rng.normal(0, planetSigma),
    z: physics.planet.pos.z + sessionBias.z * planetSigma + rng.normal(0, planetSigma),
  };
  const planet: PlanetMeasurement = {
    timeYears,
    pos: planetPos,
    posSigma: planetSigma,
    tempC: undefined,
    tempSigma: 22,
    kind: "star-position",
  };
  const stars: StarMeasurement[] = [];
  for (const star of physics.stars) {
    const dist = dist3(physics.planet.pos, star.pos);
    const sigma = clamp(0.24 + 0.055 * dist, 0.25, 0.6);
    const bias = { x: sessionBias.x * sigma, y: sessionBias.y * sigma, z: sessionBias.z * sigma };
    const n = noise3(rng, sigma);
    stars.push({
      starId: star.id,
      timeYears,
      pos: { x: star.pos.x + bias.x + n.x, y: star.pos.y + bias.y + n.y, z: star.pos.z + bias.z + n.z },
      posSigma: sigma,
      distanceAU: clamp(dist + rng.normal(0, 0.35), 0.1, 80),
      kind: "star-position",
    });
  }
  return { stars, planet };
}
