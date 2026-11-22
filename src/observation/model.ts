/**
 * 玩家动力学模型（三维）。
 *
 * 铁律：模型只能由**观测估计值**构造，绝不读取真实 PhysicsState 的恒星/行星状态。
 * 模型是玩家对系统的内部推演：位置/速度来自估计器，质量来自质量测量（无实测时用
 * 太阳质量先验）。模型残差用于检测"预测模型失效"——当实测与模型预测偏差超过测量
 * 误差的若干倍时，说明玩家的动力学模型已经无法描述真实系统。
 */
import { MAX_TRAIL_RENDER_POINTS, SOFTENING, TRAIL_INTERVAL } from "../core/constants";
import { clamp, clamp01 } from "../core/math";
import type { Vec3 } from "../core/math";
import type {
  Discovery, ObservationState, PhysicsState, PlanetMeasurement, PlayerModel, PlayerModelStar,
  StarId, StarMeasurement, StarEstimate,
} from "../core/types";
import { stepSimpleBodies, testParticleAcceleration, type SimpleBody } from "../physics/nbody";
import { addDiscovery } from "./discovery";
import { orbitalGeometry, systemBarycenter } from "./geometry";
import { getCapabilities } from "./observatory";

export const MODEL_FAILURE_KEY = "model-failure";

const STAR_IDS: StarId[] = ["A", "B", "C"];

function cloneVec(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function pushTrail(target: Vec3[], point: Vec3): void {
  target.push({ x: point.x, y: point.y, z: point.z });
  if (target.length > MAX_TRAIL_RENDER_POINTS) {
    target.splice(0, target.length - MAX_TRAIL_RENDER_POINTS);
  }
}

/**
 * 由观测估计构造玩家三体模型。
 * 只有三颗恒星都已知位置、且观测等级 >=3（能测速度）时才建模；否则返回 null。
 */
export function buildPlayerModel(obs: ObservationState, level: number, now: number): PlayerModel | null {
  const caps = getCapabilities(level);
  if (level < 3 || !caps.velocity) return null;
  const modelStars: PlayerModelStar[] = [];
  let confSum = 0;
  let velQualitySum = 0;
  let sigmaPosSum = 0;
  let sigmaVelSum = 0;
  let massKnownCount = 0;
  for (const id of STAR_IDS) {
    const est: StarEstimate | undefined = obs.stars[id];
    if (!est) return null;
    if (!est.known.position || !est.known.velocity) return null;
    massKnownCount += est.known.mass ? 1 : 0;
    confSum += clamp01(est.confidence);
    velQualitySum += clamp01(1 - est.sigmaVel / 0.5);
    sigmaPosSum += Math.max(0, est.sigmaPos);
    sigmaVelSum += Math.max(0, est.sigmaVel);
    modelStars.push({
      id,
      name: est.name,
      color: est.color,
      // 质量未知时使用太阳质量先验（观测量级的先验，不是真实质量）。
      mass: est.mass > 0 ? est.mass : 1,
      pos: cloneVec(est.pos),
      vel: cloneVec(est.vel),
      known: { ...est.known },
    });
  }
  if (modelStars.length !== 3) return null;
  const meanConf = confSum / 3;
  const meanVelQuality = velQualitySum / 3;
  const massQuality = massKnownCount / 3;
  const accuracy = clamp01(0.4 * meanConf + 0.4 * meanVelQuality + 0.2 * massQuality);
  const sigmaPosAvg = sigmaPosSum / 3;
  const sigmaVelAvg = sigmaVelSum / 3;
  const horizon = Math.max(1, caps.predictionHorizon);

  let planet: PlayerModel["planet"] = null;
  if (obs.planet && obs.planet.known.position) {
    planet = {
      pos: cloneVec(obs.planet.pos),
      vel: cloneVec(obs.planet.vel),
      known: Boolean(obs.planet.known.velocity),
    };
  }

  const accuracyPct = Math.round(accuracy * 100);
  const note = "基于观测估计的三维三体动力学模型：三颗恒星位置精度约 ±" + sigmaPosAvg.toFixed(4) +
    " AU、速度精度约 ±" + sigmaVelAvg.toFixed(4) + " AU/年，模型置信度 " + accuracyPct + "%。" +
    (massKnownCount < 3 ? "部分恒星质量仍为太阳质量先验，长期推演的系统性偏差更大。" : "") +
    (planet && !planet.known ? "母星速度尚未测得，模型无法可靠推演母星轨道。" : "") +
    "三体系统对初值极端敏感，模型有意义的外推窗口约 " + horizon + " 年。";

  return {
    stars: modelStars,
    planet,
    createdYear: now,
    accuracy,
    horizonYears: horizon,
    valid: true,
    note,
  };
}

/** 测试粒子（母星）在模型恒星引力场中推进一个子步（速度 Verlet）。 */
function integrateModelPlanet(planet: { pos: Vec3; vel: Vec3 }, stars: SimpleBody[], dt: number, softening: number): void {
  const a0 = testParticleAcceleration(planet.pos, stars, softening);
  planet.vel.x += 0.5 * a0.x * dt;
  planet.vel.y += 0.5 * a0.y * dt;
  planet.vel.z += 0.5 * a0.z * dt;
  planet.pos.x += planet.vel.x * dt;
  planet.pos.y += planet.vel.y * dt;
  planet.pos.z += planet.vel.z * dt;
  const a1 = testParticleAcceleration(planet.pos, stars, softening);
  planet.vel.x += 0.5 * a1.x * dt;
  planet.vel.y += 0.5 * a1.y * dt;
  planet.vel.z += 0.5 * a1.z * dt;
}

/**
 * 用物理层提供的 stepSimpleBodies 推进模型恒星；行星若 known 则作为测试粒子推进。
 * 内部按 0.005 年上限细分步长，保证长 dt（例如整回合）也能稳定积分。
 */
export function propagateModel(model: PlayerModel | null, dtYears: number, softening = SOFTENING): void {
  if (!model || !model.valid) return;
  if (!Number.isFinite(dtYears) || dtYears <= 0) return;
  const steps = clamp(Math.ceil(dtYears / 0.005), 1, 400);
  const dt = dtYears / steps;
  const bodies: SimpleBody[] = model.stars.map((s) => ({
    mass: s.mass,
    pos: cloneVec(s.pos),
    vel: cloneVec(s.vel),
  }));
  const planet = model.planet && model.planet.known
    ? { pos: cloneVec(model.planet.pos), vel: cloneVec(model.planet.vel) }
    : null;
  for (let i = 0; i < steps; i++) {
    stepSimpleBodies(bodies, dt, softening);
    if (planet) integrateModelPlanet(planet, bodies, dt, softening);
  }
  for (let i = 0; i < model.stars.length; i++) {
    const b = bodies[i];
    if (!Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || !Number.isFinite(b.pos.z)) {
      model.valid = false;
      return;
    }
    model.stars[i].pos = cloneVec(b.pos);
    model.stars[i].vel = cloneVec(b.vel);
  }
  if (planet) {
    if (!Number.isFinite(planet.pos.x) || !Number.isFinite(planet.pos.y) || !Number.isFinite(planet.pos.z)) {
      model.valid = false;
      return;
    }
    model.planet!.pos = cloneVec(planet.pos);
    model.planet!.vel = cloneVec(planet.vel);
  }
}

/** 深拷贝模型（残差检查 / 预测集成使用，绝不扰动玩家当前模型）。 */
export function cloneModel(model: PlayerModel): PlayerModel {
  return {
    stars: model.stars.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      mass: s.mass,
      pos: cloneVec(s.pos),
      vel: cloneVec(s.vel),
      known: { ...s.known },
    })),
    planet: model.planet
      ? { pos: cloneVec(model.planet.pos), vel: cloneVec(model.planet.vel), known: model.planet.known }
      : null,
    createdYear: model.createdYear,
    accuracy: model.accuracy,
    horizonYears: model.horizonYears,
    valid: model.valid,
    note: model.note,
  };
}

/** 模型当前位置（供"下一次观测后"计算残差 / 渲染"当前天空"）。 */
export function modelPredictedStarPositions(model: PlayerModel | null): { id: StarId; pos: Vec3 }[] {
  if (!model || !model.valid) return [];
  return model.stars.map((s) => ({ id: s.id, pos: cloneVec(s.pos) }));
}

/**
 * 把玩家模型推演出的当前位置追加进观测轨迹。
 * 观测轨迹的含义是"玩家推断出的轨迹"，不是真实轨迹；调用方按 TRAIL_INTERVAL 控制频率。
 */
export function appendObservedTrail(
  obs: ObservationState,
  model: PlayerModel | null,
  intervalYears = TRAIL_INTERVAL,
): void {
  void intervalYears;
  if (!model || !model.valid) return;
  for (const s of model.stars) {
    if (!obs.observedTrail[s.id]) obs.observedTrail[s.id] = [];
    pushTrail(obs.observedTrail[s.id]!, s.pos);
  }
  if (model.planet && model.planet.known) {
    pushTrail(obs.planetObservedTrail, model.planet.pos);
  }
}

/** 把原始测量点追加进观测轨迹（无模型时轨迹只有测量点）。 */
export function appendMeasurementTrails(
  obs: ObservationState,
  starMeasurements: StarMeasurement[],
  planetMeasurement: PlanetMeasurement | null,
): void {
  for (const m of starMeasurements) {
    if (!obs.observedTrail[m.starId]) obs.observedTrail[m.starId] = [];
    pushTrail(obs.observedTrail[m.starId]!, m.pos);
  }
  if (planetMeasurement) pushTrail(obs.planetObservedTrail, planetMeasurement.pos);
}

export interface StarResidual {
  id: StarId;
  /** 模型预测位置与最新实测位置的三维偏差（AU）。 */
  residualAU: number;
  /** 最新测量的 1-sigma 位置误差（AU）。 */
  sigmaAU: number;
  /** 判定失效的阈值（AU）。 */
  thresholdAU: number;
  /** 偏差 / 测量误差（单位 sigma）。 */
  sigmaRatio: number;
  /** true = 最新测量太旧（>0.2 年），不参与残差判定。 */
  stale: boolean;
  failed: boolean;
}

export interface ResidualReport {
  starResiduals: StarResidual[];
  /** 最大残差（AU）；没有可比数据时为 0。 */
  worst: number;
  worstId: StarId | null;
  /** 本次判定使用的失效阈值（AU）。 */
  thresholdAU: number;
  modelAgeYears: number;
  failed: boolean;
  /** true = 本次调用刚刚触发"预测模型失效"（已写入发现并置 modelDirty）。 */
  triggered: boolean;
  discovery: Discovery | null;
  note: string;
}

const SIGMA_FAILURE_FACTOR = 5;
const RESIDUAL_FRESH_WINDOW_YEARS = 0.2;

function emptyReport(note: string): ResidualReport {
  return {
    starResiduals: [],
    worst: 0,
    worstId: null,
    thresholdAU: 0,
    modelAgeYears: 0,
    failed: false,
    triggered: false,
    discovery: null,
    note,
  };
}

function latestMeasurement(obs: ObservationState, id: StarId): StarMeasurement | null {
  let best: StarMeasurement | null = null;
  for (const m of obs.measurements.stars) {
    if (m.starId !== id) continue;
    if (!best || m.timeYears >= best.timeYears) best = m;
  }
  return best;
}

/**
 * 计算模型在"当前真实时间"的预测位置与最新实测位置的残差。
 * 偏差超过 max(5σ, 0.02 + 0.01·模型年龄) 且模型已推演至少 0.02 年时判定模型失效：
 * 写入"预测模型失效"发现、置 modelDirty=true、清空预测缓存。
 */
export function computeResiduals(obs: ObservationState, physics: PhysicsState): ResidualReport {
  const model = obs.playerModel;
  if (!model || !model.valid) return emptyReport("当前没有可用的玩家模型，无法计算残差。");
  const now = physics.timeYears;
  const modelAge = Math.max(0, now - model.createdYear);
  const delta = clamp(now - obs.lastModelSyncYear, 0, 20);
  const predicted = cloneModel(model);
  propagateModel(predicted, delta);
  if (!predicted.valid) return emptyReport("玩家模型在推演中数值失稳，无法给出预测。");

  const thresholdBase = 0.02 + 0.01 * modelAge;
  const starResiduals: StarResidual[] = [];
  let worst = 0;
  let worstId: StarId | null = null;
  let failed = false;
  for (const ms of predicted.stars) {
    const meas = latestMeasurement(obs, ms.id);
    const stale = !meas || Math.abs(now - meas.timeYears) > RESIDUAL_FRESH_WINDOW_YEARS;
    const residualAU = meas ? dist3(ms.pos, meas.pos) : 0;
    const sigmaAU = meas ? Math.max(1e-6, meas.posSigma) : 0;
    const thresholdAU = Math.max(SIGMA_FAILURE_FACTOR * sigmaAU, thresholdBase);
    // 刚重建的模型允许 3 倍阈值的强违反直接判定失效（避免用同一个刚拟合的模型自证）。
    const ageFactor = modelAge < 0.02 ? 3 : 1;
    const thisFailed = !stale && residualAU > thresholdAU * ageFactor;
    if (!stale) {
      if (residualAU > worst) {
        worst = residualAU;
        worstId = ms.id;
      }
      if (thisFailed) failed = true;
    }
    starResiduals.push({
      id: ms.id,
      residualAU,
      sigmaAU,
      thresholdAU,
      sigmaRatio: sigmaAU > 0 ? residualAU / sigmaAU : 0,
      stale,
      failed: thisFailed,
    });
  }

  let discovery: Discovery | null = null;
  let triggered = false;
  if (failed) {
    triggered = true;
    obs.modelDirty = true;
    model.valid = false;
    obs.prediction = null;
    const worstEntry = starResiduals
      .filter((r) => !r.stale)
      .sort((a, b) => b.residualAU - a.residualAU)[0];
    discovery = addDiscovery(obs, {
      key: MODEL_FAILURE_KEY,
      title: "预测模型失效",
      detail: "新的观测数据与玩家模型给出的预测位置严重不符，说明当前三体动力学模型漏掉了关键的引力扰动，" +
        "或模型的初始条件已经失效。必须用新的观测数据重建模型，否则一切预测都不可信。",
      category: "anomaly",
      evidence: "第 " + now.toFixed(2) + " 年：模型对 " + (worstEntry?.id ?? "?") + " 星的预测与最新实测偏差 " +
        worst.toFixed(3) + " AU（约 " + (worstEntry ? worstEntry.sigmaRatio.toFixed(1) : "—") + "σ，判定阈值 " +
        (worstEntry ? worstEntry.thresholdAU.toFixed(3) : thresholdBase.toFixed(3)) + " AU）。 [key:" + MODEL_FAILURE_KEY + "]",
    }, now);
  } else if (worst > 0) {
    obs.modelDirty = false;
  }

  const note = failed
    ? "模型预测与最新实测偏差超过 " + SIGMA_FAILURE_FACTOR + "σ 判定阈值，模型已标记为失效。"
    : worst > 0
      ? "模型预测与最新实测一致（最大偏差 " + worst.toFixed(3) + " AU，阈值 " + thresholdBase.toFixed(3) + " AU）。"
      : "最新测量已过期，无法判定模型是否失效。";

  return {
    starResiduals,
    worst,
    worstId,
    thresholdAU: thresholdBase,
    modelAgeYears: modelAge,
    failed,
    triggered,
    discovery,
    note,
  };
}

export interface ModelOrbitInfo {
  id: StarId;
  name: string;
  /** 轨道面相对 X-Z 参考面的倾角（弧度），退化轨道为 null。 */
  inclinationRad: number | null;
  /** 当前垂直高度（AU）。 */
  heightAU: number;
  speed: number;
  distanceFromBarycenter: number;
}

/** 模型的三维轨道几何信息（供 2D 高度提示与 3D 视图使用）。 */
export function modelOrbitGeometry(model: PlayerModel | null): {
  stars: ModelOrbitInfo[];
  planet: { inclinationRad: number | null; heightAU: number } | null;
} {
  if (!model || !model.valid) return { stars: [], planet: null };
  const bary = systemBarycenter(model.stars.map((s) => ({ mass: s.mass, pos: s.pos, vel: s.vel })));
  const stars = model.stars.map((s) => {
    const relPos = { x: s.pos.x - bary.pos.x, y: s.pos.y - bary.pos.y, z: s.pos.z - bary.pos.z };
    const relVel = { x: s.vel.x - bary.vel.x, y: s.vel.y - bary.vel.y, z: s.vel.z - bary.vel.z };
    const geo = orbitalGeometry(relPos, relVel, bary.mass);
    return {
      id: s.id,
      name: s.name,
      inclinationRad: geo.orbitNormal ? geo.inclinationRad : null,
      heightAU: s.pos.y,
      speed: Math.hypot(s.vel.x, s.vel.y, s.vel.z),
      distanceFromBarycenter: Math.hypot(relPos.x, relPos.y, relPos.z),
    };
  });
  let planet: { inclinationRad: number | null; heightAU: number } | null = null;
  if (model.planet) {
    const relPos = { x: model.planet.pos.x - bary.pos.x, y: model.planet.pos.y - bary.pos.y, z: model.planet.pos.z - bary.pos.z };
    const geo = orbitalGeometry(
      relPos,
      { x: model.planet.vel.x - bary.vel.x, y: model.planet.vel.y - bary.vel.y, z: model.planet.vel.z - bary.vel.z },
      bary.mass,
    );
    planet = { inclinationRad: geo.orbitNormal ? geo.inclinationRad : null, heightAU: model.planet.pos.y };
  }
  return { stars, planet };
}

export { STAR_IDS as OBSERVATION_STAR_IDS };
