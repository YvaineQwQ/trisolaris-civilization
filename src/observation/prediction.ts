/**
 * 预测集成（三维蒙特卡洛）。
 *
 * 预测只从**玩家模型**出发（模型又只来自观测估计）：对模型初值按各星的位置/速度/
 * 质量 1σ 不确定度扰动，生成 6+2·level 个集合成员（上限 18），用物理层同一个
 * stepSimpleBodies 积分器推演，输出每个时间切片的集合均值与离散度。
 *
 * 三体系统对初值极端敏感，集合离散度会随时间快速增长；reliableFraction 表示
 * "集合仍然一致"的时间占预测窗口的比例，diverged 表示预测在窗口内大部分时间不可信。
 */
import { OBSERVATORY_LEVELS, SOFTENING } from "../core/constants";
import { clamp, clamp01 } from "../core/math";
import type { Vec3 } from "../core/math";
import { Rng } from "../core/rng";
import { stepSimpleBodies, testParticleAcceleration, type SimpleBody } from "../physics/nbody";
import type {
  ObservationState, PredictionBundle, PredictionSample, PredictionStarSample, StarId,
} from "../core/types";
import { cloneModel, propagateModel } from "./model";
import { scatterSigma, trajectoryInclination } from "./geometry";

export const MIN_ENSEMBLE_MEMBERS = 6;
export const MAX_ENSEMBLE_MEMBERS = 18;
/** 单个集合成员的积分步数上限（性能护栏）。 */
export const MAX_STEPS_PER_MEMBER = 900;
/** 集合离散度阈值：基础量 + 到质心距离的比例。 */
export const DISPERSION_BASE_AU = 0.25;
export const DISPERSION_DISTANCE_FRACTION = 0.03;
/** 预测窗口内的采样切片数。 */
export const PREDICTION_SAMPLE_COUNT = 30;
/** 预测窗口的绝对上限（年）。 */
export const MAX_PREDICTION_HORIZON = 140;

const STAR_IDS: StarId[] = ["A", "B", "C"];

interface MemberPlanet {
  pos: Vec3;
  vel: Vec3;
}

interface EnsembleMember {
  bodies: SimpleBody[];
  /** 仅当玩家模型知道母星状态时存在。 */
  planet: MemberPlanet | null;
}

function integrateTestParticle(planet: MemberPlanet, stars: SimpleBody[], dt: number): void {
  const a0 = testParticleAcceleration(planet.pos, stars, SOFTENING);
  planet.vel.x += 0.5 * a0.x * dt;
  planet.vel.y += 0.5 * a0.y * dt;
  planet.vel.z += 0.5 * a0.z * dt;
  planet.pos.x += planet.vel.x * dt;
  planet.pos.y += planet.vel.y * dt;
  planet.pos.z += planet.vel.z * dt;
  const a1 = testParticleAcceleration(planet.pos, stars, SOFTENING);
  planet.vel.x += 0.5 * a1.x * dt;
  planet.vel.y += 0.5 * a1.y * dt;
  planet.vel.z += 0.5 * a1.z * dt;
}

function centering(positions: Vec3[]): Vec3 {
  if (positions.length === 0) return { x: 0, y: 0, z: 0 };
  let x = 0, y = 0, z = 0;
  for (const p of positions) { x += p.x; y += p.y; z += p.z; }
  return { x: x / positions.length, y: y / positions.length, z: z / positions.length };
}

/** 计算样本切片的集合离散度阈值（0.25 AU + 3% 到质心距离）。 */
function dispersionThreshold(meanPositions: Vec3[]): number {
  const c = centering(meanPositions);
  let meanDist = 0;
  for (const p of meanPositions) meanDist += Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
  meanDist = meanPositions.length > 0 ? meanDist / meanPositions.length : 0;
  return DISPERSION_BASE_AU + DISPERSION_DISTANCE_FRACTION * meanDist;
}

/**
 * 基于玩家模型的三维蒙特卡洛预测集成。
 * 返回 null 表示当前没有可用模型 / 等级不足 / 预测窗口为 0。
 */
export function computePrediction(
  obs: ObservationState,
  level: number,
  techPredictionMultiplier: number,
  now: number,
): PredictionBundle | null {
  const base = obs.playerModel;
  if (!base || !base.valid || obs.modelDirty) return null;
  const lv = clamp(Math.round(level), 0, 6);
  const info = OBSERVATORY_LEVELS[lv];
  const tech = Math.max(0, Number.isFinite(techPredictionMultiplier) ? techPredictionMultiplier : 0);
  const horizon = Math.min(MAX_PREDICTION_HORIZON, info.predictionHorizon * (1 + tech));
  if (!(horizon > 0)) return null;

  // 克隆模型并同步到当前时间：预测必须从"现在"开始。
  const model = cloneModel(base);
  const syncDelta = Math.max(0, now - obs.lastModelSyncYear);
  if (syncDelta > 0) propagateModel(model, Math.min(syncDelta, 5));
  if (!model.valid) return null;

  const memberCount = clamp(MIN_ENSEMBLE_MEMBERS + 2 * lv, MIN_ENSEMBLE_MEMBERS, MAX_ENSEMBLE_MEMBERS);
  // 步长自适应：短预测窗口用更细的步长（紧密双星的轨道周期可能只有 0.5 年），
  // 长窗口受性能上限约束而变粗——此时预测本来就已进入混沌发散区。
  const steps = clamp(Math.ceil(horizon / 0.04), 140, 720);
  const dt = horizon / steps;
  const rng = new Rng(obs.seedBase + "|prediction|" + now.toFixed(3) + "|" + lv + "|" + horizon.toFixed(2));
  const planetPosSigma = obs.planet ? Math.max(0, obs.planet.sigmaPos) : 0;
  const planetVelSigma = clamp(planetPosSigma * 0.5, 1e-3, 0.2);

  const members: EnsembleMember[] = [];
  for (let m = 0; m < memberCount; m++) {
    const bodies: SimpleBody[] = model.stars.map((s) => {
      const est = obs.stars[s.id];
      const sigmaPos = m === 0 ? 0 : (est ? Math.max(0, est.sigmaPos) : 0);
      const sigmaVel = m === 0 ? 0 : (est ? Math.max(0, est.sigmaVel) : 0);
      const sigmaMass = m === 0 ? 0 : (est ? Math.max(0, est.sigmaMass) : 0);
      return {
        mass: clamp(s.mass + (sigmaMass > 0 ? rng.normal(0, sigmaMass) : 0), 0.05, 20),
        pos: {
          x: s.pos.x + (sigmaPos > 0 ? rng.normal(0, sigmaPos) : 0),
          y: s.pos.y + (sigmaPos > 0 ? rng.normal(0, sigmaPos) : 0),
          z: s.pos.z + (sigmaPos > 0 ? rng.normal(0, sigmaPos) : 0),
        },
        vel: {
          x: s.vel.x + (sigmaVel > 0 ? rng.normal(0, sigmaVel) : 0),
          y: s.vel.y + (sigmaVel > 0 ? rng.normal(0, sigmaVel) : 0),
          z: s.vel.z + (sigmaVel > 0 ? rng.normal(0, sigmaVel) : 0),
        },
      };
    });
    let planet: MemberPlanet | null = null;
    if (model.planet && model.planet.known) {
      planet = {
        pos: {
          x: model.planet.pos.x + (m === 0 ? 0 : rng.normal(0, planetPosSigma)),
          y: model.planet.pos.y + (m === 0 ? 0 : rng.normal(0, planetPosSigma)),
          z: model.planet.pos.z + (m === 0 ? 0 : rng.normal(0, planetPosSigma)),
        },
        vel: {
          x: model.planet.vel.x + (m === 0 ? 0 : rng.normal(0, planetVelSigma)),
          y: model.planet.vel.y + (m === 0 ? 0 : rng.normal(0, planetVelSigma)),
          z: model.planet.vel.z + (m === 0 ? 0 : rng.normal(0, planetVelSigma)),
        },
      };
    }
    members.push({ bodies, planet });
  }

  // 采样步序号（含首尾）。
  const sampleSteps: number[] = [];
  for (let i = 0; i < PREDICTION_SAMPLE_COUNT; i++) {
    const step = Math.round((i * steps) / (PREDICTION_SAMPLE_COUNT - 1));
    if (sampleSteps.length === 0 || sampleSteps[sampleSteps.length - 1] !== step) sampleSteps.push(step);
  }
  const sampleSet = new Set(sampleSteps);
  const totalSamples = sampleSteps.length;
  const samples: PredictionSample[] = [];
  let firstExceedYear: number | null = null;
  let collapsed = false;
  let earlyStopped = false;
  // 母星轨道远慢于恒星，按 stride 大步推进以节省计算（预测窗口内误差可忽略）。
  const planetStride = 4;

  const recordSample = (step: number) => {
    const t = (step / steps) * horizon;
    const meanStars: PredictionStarSample[] = [];
    const starMeans: Vec3[] = [];
    let maxSigma = 0;
    for (let si = 0; si < model.stars.length; si++) {
      const points = members.map((m) => m.bodies[si].pos);
      const center = centering(points);
      const sigma = scatterSigma(points, center);
      if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
        collapsed = true;
        return;
      }
      meanStars.push({ id: model.stars[si].id, pos: center, sigma });
      starMeans.push(center);
      if (sigma > maxSigma) maxSigma = sigma;
    }
    let planetSample: PredictionSample["planet"] = null;
    if (model.planet && model.planet.known) {
      const points = members.map((m) => m.planet!.pos);
      const center = centering(points);
      const sigma = scatterSigma(points, center);
      planetSample = { pos: center, sigma };
      if (sigma > maxSigma) maxSigma = sigma;
    }
    const threshold = dispersionThreshold(starMeans);
    const agreement = clamp01(1 - maxSigma / Math.max(1e-6, threshold));
    if (firstExceedYear === null && maxSigma > threshold) firstExceedYear = t;
    samples.push({ t, stars: meanStars, planet: planetSample, agreement });
  };

  recordSample(0);
  for (let step = 1; step <= steps; step++) {
    for (const member of members) {
      stepSimpleBodies(member.bodies, dt, SOFTENING);
      if (member.planet && step % planetStride === 0) {
        integrateTestParticle(member.planet, member.bodies, dt * planetStride);
      }
    }
    if (sampleSet.has(step)) recordSample(step);
    if (collapsed) break;
    // 性能优化：一旦集合明确发散（首个超阈值样本之后又推演了 2.5 倍时间），
    // 更远的样本只剩"不确定度标度"意义，直接按指数增长外推，避免无谓积分。
    if (firstExceedYear !== null) {
      const t = (step / steps) * horizon;
      if (t >= Math.min(horizon, Math.max(firstExceedYear * 2.5, firstExceedYear + 1))) {
        earlyStopped = true;
        break;
      }
    }
  }
  if (samples.length === 0) return null;

  // 外推填充：位置冻结在最后一个物理样本，不确定度按最近两样本的增长率指数外推。
  if (samples.length < totalSamples) {
    const tail = samples.slice(-2);
    const lastSample = tail[tail.length - 1];
    let growthPerYear = 0;
    if (tail.length === 2 && tail[0].t < lastSample.t) {
      const sigmaOf = (sample: PredictionSample) => {
        let m = 0;
        for (const star of sample.stars) m = Math.max(m, star.sigma);
        if (sample.planet) m = Math.max(m, sample.planet.sigma);
        return m;
      };
      const s0 = sigmaOf(tail[0]);
      const s1 = sigmaOf(lastSample);
      if (s0 > 1e-9 && s1 > 1e-9) {
        growthPerYear = clamp(Math.log(s1 / s0) / Math.max(1e-6, lastSample.t - tail[0].t), 0, 3);
      }
    }
    const startIndex = samples.length;
    for (let i = startIndex; i < totalSamples; i++) {
      const t = (sampleSteps[i] / steps) * horizon;
      const dtg = Math.max(0, t - lastSample.t);
      const factor = Math.exp(growthPerYear * dtg);
      const filled: PredictionSample = {
        t,
        stars: lastSample.stars.map((star) => ({
          id: star.id,
          pos: { ...star.pos },
          sigma: star.sigma * factor,
        })),
        planet: lastSample.planet
          ? { pos: { ...lastSample.planet.pos }, sigma: lastSample.planet.sigma * factor }
          : null,
        agreement: 0,
      };
      samples.push(filled);
    }
  }

  const reliableFraction = collapsed ? 0 : Math.min(1, (firstExceedYear ?? horizon) / horizon);
  const diverged = reliableFraction < 0.5;
  const reliableYears = reliableFraction * horizon;
  const agreementLast = samples[samples.length - 1].agreement;
  let note = "基于玩家三维三体模型的 " + memberCount + " 体蒙特卡洛集成，预测窗口 " + horizon.toFixed(1) +
    " 年；位置不确定度随预测时间增长，集合一致度逐步下降。";
  note += diverged
    ? "集成在约 " + reliableYears.toFixed(1) + " 年后发散：更远的未来已经不可信，只能作为概率性参考。"
    : "在约 " + reliableYears.toFixed(1) + " 年内集合仍保持基本一致，超出该窗口后预测可靠性快速下降。";
  note += "（混沌敏感性：三体系统对初值的微小误差呈指数放大，这是物理限制而非仪器缺陷。）";
  void agreementLast;

  return {
    createdYear: now,
    horizonYears: horizon,
    samples,
    diverged,
    reliableFraction,
    note,
  };
}

/** 每颗恒星的可靠预测时长（集合离散度首次超过阈值的年份）。 */
export function computeStarReliableYears(bundle: PredictionBundle | null): Partial<Record<StarId, number>> {
  const out: Partial<Record<StarId, number>> = {};
  if (!bundle || bundle.samples.length === 0) return out;
  for (const id of STAR_IDS) {
    let reliable: number | null = null;
    for (const sample of bundle.samples) {
      const star = sample.stars.find((s) => s.id === id);
      if (!star) continue;
      const c = centering(sample.stars.map((s) => s.pos));
      const dist = Math.hypot(star.pos.x - c.x, star.pos.y - c.y, star.pos.z - c.z);
      const threshold = DISPERSION_BASE_AU + DISPERSION_DISTANCE_FRACTION * dist;
      if (star.sigma > threshold) {
        reliable = sample.t;
        break;
      }
    }
    out[id] = reliable === null ? bundle.horizonYears : reliable;
  }
  return out;
}

export interface StarClosestApproach {
  id: StarId;
  /** 预测窗口内到系统质心（三星几何中心近似）的最近距离（AU）。 */
  toBarycenterAU: number;
  toBarycenterYear: number;
  /** 预测窗口内到母星的最近距离（AU）；母星状态未知时为 null。 */
  toPlanetAU: number | null;
  toPlanetYear: number | null;
}

export interface PlanetClosestApproach {
  /** 预测窗口内母星到最近恒星的最近距离（AU）。 */
  toNearestStarAU: number;
  nearestStar: StarId;
  year: number;
  toBarycenterAU: number;
  toBarycenterYear: number;
}

export interface ClosestApproachReport {
  stars: StarClosestApproach[];
  planet: PlanetClosestApproach | null;
  horizonYears: number;
}

/**
 * 未来预测窗口内的最近接近事件（供 UI 与灾害预警使用）。
 * 恒星之间的最近接近不在这里计算（那是双星问题），这里给出"恒星—质心"与
 * "恒星—母星"以及"母星—最近恒星"的最近距离与年份。
 */
export function computeClosestApproach(bundle: PredictionBundle | null): ClosestApproachReport {
  const report: ClosestApproachReport = { stars: [], planet: null, horizonYears: 0 };
  if (!bundle || bundle.samples.length === 0) return report;
  report.horizonYears = bundle.horizonYears;
  const ids = bundle.samples[0].stars.map((s) => s.id);
  const stars: StarClosestApproach[] = ids.map((id) => ({
    id,
    toBarycenterAU: Infinity,
    toBarycenterYear: bundle.createdYear,
    toPlanetAU: null,
    toPlanetYear: null,
  }));
  let planet: PlanetClosestApproach | null = null;

  for (const sample of bundle.samples) {
    const year = bundle.createdYear + sample.t;
    const meanStars = sample.stars.map((s) => s.pos);
    const c = centering(meanStars);
    for (const star of sample.stars) {
      const entry = stars.find((s) => s.id === star.id)!;
      const db = Math.hypot(star.pos.x - c.x, star.pos.y - c.y, star.pos.z - c.z);
      if (db < entry.toBarycenterAU) {
        entry.toBarycenterAU = db;
        entry.toBarycenterYear = year;
      }
      if (sample.planet) {
        const dp = Math.hypot(star.pos.x - sample.planet.pos.x, star.pos.y - sample.planet.pos.y, star.pos.z - sample.planet.pos.z);
        if (entry.toPlanetAU === null || dp < entry.toPlanetAU) {
          entry.toPlanetAU = dp;
          entry.toPlanetYear = year;
        }
      }
    }
    if (sample.planet) {
      const dpb = Math.hypot(sample.planet.pos.x - c.x, sample.planet.pos.y - c.y, sample.planet.pos.z - c.z);
      let nearestStar: StarId = ids[0];
      let nearest = Infinity;
      for (const star of sample.stars) {
        const d = Math.hypot(star.pos.x - sample.planet.pos.x, star.pos.y - sample.planet.pos.y, star.pos.z - sample.planet.pos.z);
        if (d < nearest) {
          nearest = d;
          nearestStar = star.id;
        }
      }
      if (!planet) {
        planet = {
          toNearestStarAU: nearest,
          nearestStar,
          year,
          toBarycenterAU: dpb,
          toBarycenterYear: year,
        };
      } else {
        if (nearest < planet.toNearestStarAU) {
          planet.toNearestStarAU = nearest;
          planet.nearestStar = nearestStar;
          planet.year = year;
        }
        if (dpb < planet.toBarycenterAU) {
          planet.toBarycenterAU = dpb;
          planet.toBarycenterYear = year;
        }
      }
    }
  }
  report.stars = stars;
  report.planet = planet;
  return report;
}

export interface PredictionStarGeometry {
  id: StarId;
  /** 集合保持一致的时长（年）。 */
  reliableYears: number;
  /** 预测轨迹平面相对 X-Z 参考面的倾角（弧度）。 */
  inclinationRad: number | null;
  /** 当前（窗口起点）垂直高度（AU）。 */
  heightNowAU: number;
  minHeightAU: number;
  maxHeightAU: number;
  /** 平均到质心距离（AU）。 */
  meanDistanceFromBarycenterAU: number;
}

export interface PredictionGeometry {
  stars: PredictionStarGeometry[];
  planet: {
    reliableYears: number;
    inclinationRad: number | null;
    minHeightAU: number;
    maxHeightAU: number;
  } | null;
  horizonYears: number;
  reliableYears: number;
  diverged: boolean;
}

/**
 * 从预测集合中提取三维几何信息（轨道倾角 / 垂直高度范围 / 每星可靠时长），
 * 供 2D 视图的高度提示与 Three.js 3D 视图使用。
 */
export function computePredictionGeometry(bundle: PredictionBundle | null): PredictionGeometry {
  const empty: PredictionGeometry = {
    stars: [], planet: null, horizonYears: 0, reliableYears: 0, diverged: false,
  };
  if (!bundle || bundle.samples.length === 0) return empty;
  const reliableByStar = computeStarReliableYears(bundle);
  const byStar = new Map<StarId, Vec3[]>();
  const planetPositions: Vec3[] = [];
  for (const sample of bundle.samples) {
    for (const star of sample.stars) {
      if (!byStar.has(star.id)) byStar.set(star.id, []);
      byStar.get(star.id)!.push(star.pos);
    }
    if (sample.planet) planetPositions.push(sample.planet.pos);
  }
  const stars: PredictionStarGeometry[] = [];
  for (const [id, positions] of byStar) {
    const heights = positions.map((p) => p.y);
    const c = centering(positions);
    let meanDist = 0;
    for (const p of positions) meanDist += Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
    meanDist = positions.length > 0 ? meanDist / positions.length : 0;
    stars.push({
      id,
      reliableYears: reliableByStar[id] ?? bundle.horizonYears,
      inclinationRad: trajectoryInclination(positions),
      heightNowAU: positions[0].y,
      minHeightAU: heights.length > 0 ? Math.min(...heights) : 0,
      maxHeightAU: heights.length > 0 ? Math.max(...heights) : 0,
      meanDistanceFromBarycenterAU: meanDist,
    });
  }
  let planet: PredictionGeometry["planet"] = null;
  if (planetPositions.length > 0) {
    const heights = planetPositions.map((p) => p.y);
    const reliable = computeStarReliableYears(bundle);
    void reliable;
    // 母星可靠时长按预测集合离散度阈值近似（与恒星同一尺度）。
    let reliableYears = bundle.horizonYears;
    for (const sample of bundle.samples) {
      if (!sample.planet) continue;
      const c = centering(sample.stars.map((s) => s.pos));
      const dist = Math.hypot(sample.planet.pos.x - c.x, sample.planet.pos.y - c.y, sample.planet.pos.z - c.z);
      const threshold = DISPERSION_BASE_AU + DISPERSION_DISTANCE_FRACTION * Math.max(dist, 1);
      if (sample.planet.sigma > threshold) {
        reliableYears = sample.t;
        break;
      }
    }
    planet = {
      reliableYears,
      inclinationRad: trajectoryInclination(planetPositions),
      minHeightAU: Math.min(...heights),
      maxHeightAU: Math.max(...heights),
    };
  }
  return {
    stars,
    planet,
    horizonYears: bundle.horizonYears,
    reliableYears: bundle.reliableFraction * bundle.horizonYears,
    diverged: bundle.diverged,
  };
}
