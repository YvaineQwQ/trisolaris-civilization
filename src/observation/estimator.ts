/**
 * 观测状态估计器（三维）。
 *
 * 设计说明（重要）：
 * 三体系统中的恒星可能在不到 1 年就绕行一圈（紧密双星），远短于观测任务的时间基线。
 * 对这类快速轨道做全基线多项式拟合会把轨道运动"抹平"，得到动力上自相矛盾的状态
 * （速度方向与位置不匹配），进而让玩家模型在几分钟内自我瓦解。因此：
 *  - 瞬时位置/速度采用**测量融合**：位置取最新一批测量的加权结果（并用已测速度做短距
 *    外推），速度取 >=3 级多普勒速度测量的加权平均；
 *  - 加权二次最小二乘拟合（fit3D）用于短弧速度推导、长基线趋势与测试，
 *    不再直接决定瞬时状态；
 *  - 轨道要素由融合后的瞬时状态做二体近似反演（osculting elements）。
 *
 * 数据隔离：本文件只消费 StarMeasurement / PlanetMeasurement，不导入 PhysicsState；
 * 质量只由实测质量融合，没有实测时使用太阳质量先验（绝不读取真实质量）。
 */
import { clamp, clamp01, solveLinearSystem } from "../core/math";
import type { Vec3 } from "../core/math";
import { v3 } from "../core/math";
import type {
  KnownFlags, PlanetEstimate, PlanetMeasurement, StarEstimate, StarId, StarMeasurement,
} from "../core/types";
import { getCapabilities, levelInfo } from "./observatory";
import { orbitalGeometry, systemBarycenter } from "./geometry";

const STAR_IDS: StarId[] = ["A", "B", "C"];
/** 位置融合窗口（年）：只融合最近约 0.12 年的测量，避免把轨道运动平均掉。 */
const POSITION_FUSE_WINDOW_YEARS = 0.12;
/** 位置融合最多使用的测量批数。 */
const POSITION_FUSE_MAX_SAMPLES = 6;
/** 母星速度由位置轨迹线性拟合的窗口（年）。 */
const PLANET_VELOCITY_WINDOW_YEARS = 0.45;

/** 单坐标加权拟合结果（值已折算到参考历元）。 */
export interface CoordFit {
  pos: number;
  vel: number;
  acc: number;
  sigmaPos: number;
  sigmaVel: number | null;
  spanYears: number;
  sampleCount: number;
  order: number;
}

export interface Fit3D {
  pos: Vec3;
  vel: Vec3 | null;
  acc: Vec3 | null;
  sigmaPos: number;
  sigmaVel: number | null;
  spanYears: number;
  sampleCount: number;
  order: number;
}

const MIN_LINEAR_SPAN = 0.08;
const MIN_QUAD_SPAN = 1.2;

interface Sample1D {
  t: number;
  x: number;
  sigma: number;
}

function basis(order: number, t: number): number[] {
  if (order === 0) return [1];
  if (order === 1) return [1, t];
  return [1, t, 0.5 * t * t];
}

function derivativeBasis(order: number, t: number): number[] {
  if (order === 0) return [0];
  if (order === 1) return [0, 1];
  return [0, 1, t];
}

/**
 * 加权多项式拟合 + 协方差外推（用于短弧速度 / 趋势分析 / 单元测试）。
 * 阶数自适应：短弧只用均值 / 线性，长弧（>=1.2 年、>=3 点）才升到二次。
 */
export function fitCoord(samples: Sample1D[], refTime?: number, maxOrder = 2): CoordFit | null {
  const valid = samples
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.x) && Number.isFinite(s.sigma) && s.sigma > 0)
    .sort((a, b) => a.t - b.t);
  if (valid.length === 0) return null;
  const t0 = valid[0].t;
  const rel = valid.map((s) => ({ t: s.t - t0, x: s.x, w: 1 / (s.sigma * s.sigma) }));
  const span = rel[rel.length - 1].t;
  const desiredRef = refTime ?? rel[rel.length - 1].t;

  let order = 0;
  if (rel.length >= 2 && span >= MIN_LINEAR_SPAN) order = 1;
  if (rel.length >= 3 && span >= MIN_QUAD_SPAN) order = 2;
  order = Math.min(order, Math.max(0, maxOrder));

  // 二次拟合在外推到数据窗口以外较多时不稳定：把求解点限制在窗口边缘附近。
  const tau = clamp(desiredRef - t0, -(0.25 * Math.max(span, 0.05)), rel[rel.length - 1].t + 0.25 * Math.max(span, 0.05));

  for (let o = order; o >= 0; o--) {
    const m = o + 1;
    const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const b = new Array<number>(m).fill(0);
    for (const s of rel) {
      const bs = basis(o, s.t);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) A[i][j] += s.w * bs[i] * bs[j];
        b[i] += s.w * bs[i] * s.x;
      }
    }
    const coef = solveLinearSystem(A, b);
    if (!coef) continue;
    const inv: number[][] = [];
    let ok = true;
    for (let i = 0; i < m; i++) {
      const e = new Array<number>(m).fill(0);
      e[i] = 1;
      const col = solveLinearSystem(A, e);
      if (!col) { ok = false; break; }
      inv.push(col);
    }
    if (!ok) continue;
    const pBasis = basis(o, tau);
    const dBasis = derivativeBasis(o, tau);
    let pos = 0;
    let vel = 0;
    for (let i = 0; i < m; i++) {
      pos += coef[i] * pBasis[i];
      vel += coef[i] * dBasis[i];
    }
    const quad = (vec: number[]) => {
      let out = 0;
      for (let i = 0; i < m; i++) {
        let row = 0;
        for (let j = 0; j < m; j++) row += inv[i][j] * vec[j];
        out += vec[i] * row;
      }
      return out;
    };
    const varPos = quad(pBasis);
    const varVel = quad(dBasis);
    if (!Number.isFinite(varPos) || varPos < 0 || varPos > 1e10) continue;
    const sigmaPos = Math.sqrt(varPos);
    const sigmaVel = o >= 1 && Number.isFinite(varVel) ? Math.sqrt(Math.max(0, varVel)) : null;
    // 参考历元远在窗口外时，用线性速度外推并计入外推不确定度。
    const beyond = desiredRef - (t0 + tau);
    let outPos = pos;
    let outSigmaPos = sigmaPos;
    if (beyond !== 0) {
      outPos += vel * beyond;
      outSigmaPos = Math.hypot(outSigmaPos, (sigmaVel ?? 0.05) * Math.abs(beyond));
    }
    if (!Number.isFinite(outPos) || !Number.isFinite(outSigmaPos)) continue;
    return {
      pos: outPos,
      vel: o >= 1 ? vel : 0,
      acc: o >= 2 ? coef[2] : 0,
      sigmaPos: Math.max(1e-6, outSigmaPos),
      sigmaVel,
      spanYears: span,
      sampleCount: rel.length,
      order: o,
    };
  }
  return null;
}

/** 三维加权轨迹拟合（短弧速度 / 趋势分析用；不直接作为瞬时状态）。 */
export function fit3D(
  samples: { t: number; pos: Vec3; sigma: number }[],
  refTime?: number,
  maxOrder = 2,
): Fit3D | null {
  if (samples.length === 0) return null;
  const fx = fitCoord(samples.map((s) => ({ t: s.t, x: s.pos.x, sigma: s.sigma })), refTime, maxOrder);
  const fy = fitCoord(samples.map((s) => ({ t: s.t, x: s.pos.y, sigma: s.sigma })), refTime, maxOrder);
  const fz = fitCoord(samples.map((s) => ({ t: s.t, x: s.pos.z, sigma: s.sigma })), refTime, maxOrder);
  if (!fx || !fy || !fz) return null;
  const hasVel = fx.sigmaVel !== null && fy.sigmaVel !== null && fz.sigmaVel !== null;
  const vel: Vec3 | null = hasVel && (fx.order >= 1 || fy.order >= 1 || fz.order >= 1)
    ? { x: fx.vel, y: fy.vel, z: fz.vel }
    : null;
  const sigmaVel = hasVel ? Math.sqrt((fx.sigmaVel! ** 2 + fy.sigmaVel! ** 2 + fz.sigmaVel! ** 2) / 3) : null;
  const sigmaPos = Math.sqrt((fx.sigmaPos ** 2 + fy.sigmaPos ** 2 + fz.sigmaPos ** 2) / 3);
  const order = Math.max(fx.order, fy.order, fz.order);
  return {
    pos: { x: fx.pos, y: fy.pos, z: fz.pos },
    vel,
    acc: order >= 2 ? { x: fx.acc, y: fy.acc, z: fz.acc } : null,
    sigmaPos,
    sigmaVel,
    spanYears: Math.max(fx.spanYears, fy.spanYears, fz.spanYears),
    sampleCount: Math.max(fx.sampleCount, fy.sampleCount, fz.sampleCount),
    order,
  };
}

/** 加权平均（考虑 1/sigma^2 权重）。 */
function weightedMean(values: number[], sigmas: number[]): { value: number; sigma: number } {
  let sw = 0;
  let swv = 0;
  for (let i = 0; i < values.length; i++) {
    const s = Math.max(1e-9, sigmas[i]);
    const w = 1 / (s * s);
    sw += w;
    swv += w * values[i];
  }
  if (sw <= 0) return { value: 0, sigma: Infinity };
  return { value: swv / sw, sigma: Math.sqrt(1 / sw) };
}

function weightedMean3(points: Vec3[], sigmas: number[]): { pos: Vec3; sigma: number } {
  const x = weightedMean(points.map((p) => p.x), sigmas);
  const y = weightedMean(points.map((p) => p.y), sigmas);
  const z = weightedMean(points.map((p) => p.z), sigmas);
  return {
    pos: { x: x.value, y: y.value, z: z.value },
    sigma: Math.max(1e-6, Math.sqrt((x.sigma ** 2 + y.sigma ** 2 + z.sigma ** 2) / 3)),
  };
}

export interface EstimateInputs {
  level: number;
  stars: StarMeasurement[];
  planet: PlanetMeasurement[] | null;
  starIds: StarId[];
  starNames: Record<StarId, string>;
  starColors: Record<StarId, string>;
  previous: Record<StarId, StarEstimate>;
  seedBase: string;
  /** 参考历元（通常为当前模拟年）。 */
  time: number;
}

function emptyKnown(prev?: KnownFlags): KnownFlags {
  return {
    position: prev?.position ?? false,
    distance: prev?.distance ?? false,
    velocity: prev?.velocity ?? false,
    mass: prev?.mass ?? false,
    acceleration: prev?.acceleration ?? false,
    orbit: prev?.orbit ?? false,
  };
}

interface FusedStarState {
  pos: Vec3;
  vel: Vec3;
  mass: number;
  sigmaPos: number;
  sigmaVel: number;
  sigmaMass: number;
  known: KnownFlags;
  lastMeasuredYear: number;
  sampleCount: number;
  confidence: number;
}

function fuseStar(
  samples: StarMeasurement[],
  prev: StarEstimate | undefined,
  caps: { velocity: boolean; distance: boolean; mass: boolean; acceleration: boolean; orbit: boolean },
  refTime: number,
  refSigma: number,
): FusedStarState {
  const known = emptyKnown(prev?.known);
  const sorted = [...samples].sort((a, b) => a.timeYears - b.timeYears);
  const latest = sorted[sorted.length - 1];
  let pos: Vec3 = prev?.pos ? { ...prev.pos } : v3(0, 0, 0);
  let vel: Vec3 = prev?.vel ? { ...prev.vel } : v3(0, 0, 0);
  let sigmaPos = prev?.sigmaPos ?? 1;
  let sigmaVel = prev?.sigmaVel ?? 9;
  let lastMeasuredYear = prev?.lastMeasuredYear ?? 0;
  let sampleCount = prev?.sampleCount ?? 0;

  if (latest) {
    sampleCount += sorted.length;
    lastMeasuredYear = latest.timeYears;
    known.position = true;
    known.distance = caps.distance;
    // 位置：直接采用最新一批测量（它本身就是"当前时刻"的最佳位置估计）。
    // 不在时间上做平均：紧密三体轨道在 0.1 年内就能移动 0.5 AU，平均会引入巨大偏差。
    pos = { ...latest.pos };
    sigmaPos = Math.max(1e-6, latest.posSigma);
    // 速度：>=3 级的多普勒测量。快速轨道上速度矢量方向变化极快（0.1 年可转 80°），
    // 多批测量做矢量平均会人为缩小速度，因此只使用最新一次测量。
    let velocityKnown = false;
    if (caps.velocity) {
      const vmeas = sorted.filter((m) => m.vel !== undefined && Number.isFinite(m.vel!.x));
      const latestV = vmeas[vmeas.length - 1];
      if (latestV && Math.abs(refTime - latestV.timeYears) <= 0.35) {
        vel = { x: latestV.vel!.x, y: latestV.vel!.y, z: latestV.vel!.z };
        sigmaVel = Math.max(1e-5, latestV.velSigma ?? 0.5);
        known.velocity = true;
        velocityKnown = true;
      } else if (prev?.known.velocity) {
        known.velocity = true;
        velocityKnown = true;
      }
    }
    void velocityKnown;
    // 低等级没有速度测量：速度保持为零/旧值，known.velocity 不置位（升级后能力提升）。
  }

  // 质量：只融合实测质量，没有实测时使用太阳质量先验（不是真实质量）。
  const massSamples = sorted.filter((m) => m.mass !== undefined);
  let mass = prev?.mass && prev.mass > 0 ? prev.mass : 1;
  let sigmaMass = prev?.sigmaMass && prev.sigmaMass > 0 ? prev.sigmaMass : 0.6;
  if (caps.mass && massSamples.length > 0) {
    const measured = weightedMean(massSamples.map((m) => m.mass!), massSamples.map((m) => m.massSigma ?? 0.3));
    const dataW = 1 / Math.pow(Math.max(1e-6, measured.sigma), 2);
    const priorW = 1 / Math.pow(0.6, 2);
    mass = (measured.value * dataW + 1.0 * priorW * 0.05) / (dataW + priorW * 0.05);
    sigmaMass = Math.max(1e-5, Math.sqrt(1 / (dataW + priorW * 0.05)));
    known.mass = true;
  }

  // 加速度 / 轨道：>=4 级在已知速度后可反演引力扰动与轨道要素。
  if (caps.acceleration && known.velocity) known.acceleration = true;
  if (caps.orbit && known.velocity && sampleCount >= 3) known.orbit = true;

  const precision = 1 / (1 + sigmaPos / refSigma);
  const arcScore = clamp01((lastMeasuredYear - (prev?.lastMeasuredYear ?? lastMeasuredYear)) / 2);
  const countScore = clamp01(sampleCount / 30);
  let confidence = 0.28 + 0.34 * precision + 0.22 * arcScore + 0.16 * countScore;
  if (known.velocity) confidence += 0.06;
  if (!caps.velocity) confidence *= 0.92;
  if (!known.position) confidence = Math.min(confidence, 0.12);
  confidence = clamp(confidence, 0.08, 0.98);

  return { pos, vel, mass, sigmaPos, sigmaVel, sigmaMass, known, lastMeasuredYear, sampleCount, confidence };
}

/**
 * 由全部测量历史重建三星估计（位置/速度/质量/置信度/高度/倾角）。
 * 只使用测量数据与既有估计，不接触真实物理状态。
 */
export function recomputeEstimates(inputs: EstimateInputs): Record<StarId, StarEstimate> {
  const caps = getCapabilities(inputs.level);
  const refSigma = Math.max(1e-4, levelInfo(inputs.level).positionSigma * 3.2);
  const fused = {} as Record<StarId, FusedStarState>;
  for (const id of inputs.starIds) {
    const samples = inputs.stars.filter((m) => m.starId === id);
    fused[id] = fuseStar(samples, inputs.previous[id], caps, inputs.time, refSigma);
  }
  const bary = systemBarycenter(inputs.starIds.map((id) => ({
    mass: fused[id].mass,
    pos: fused[id].pos,
    vel: fused[id].vel,
  })));
  const result = {} as Record<StarId, StarEstimate>;
  for (const id of inputs.starIds) {
    const f = fused[id];
    const relPos = { x: f.pos.x - bary.pos.x, y: f.pos.y - bary.pos.y, z: f.pos.z - bary.pos.z };
    const relVel = { x: f.vel.x - bary.vel.x, y: f.vel.y - bary.vel.y, z: f.vel.z - bary.vel.z };
    let eccentricity = inputs.previous[id]?.eccentricity ?? null;
    let inclinationRad = inputs.previous[id]?.inclinationRad ?? null;
    if (f.known.orbit && f.known.velocity) {
      const geo = orbitalGeometry(relPos, relVel, Math.max(1e-6, bary.mass));
      eccentricity = Number.isFinite(geo.eccentricity) && geo.eccentricity < 3 ? geo.eccentricity : null;
      inclinationRad = geo.inclinationRad;
    }
    result[id] = {
      id,
      name: inputs.starNames[id] ?? inputs.previous[id]?.name ?? id,
      color: inputs.starColors[id] ?? inputs.previous[id]?.color ?? "#ffffff",
      pos: f.pos,
      vel: f.vel,
      mass: f.mass,
      sigmaPos: f.sigmaPos,
      sigmaVel: f.sigmaVel,
      sigmaMass: f.sigmaMass,
      lastMeasuredYear: f.lastMeasuredYear,
      confidence: f.confidence,
      known: f.known,
      sampleCount: f.sampleCount,
      distanceFromBarycenter: Math.hypot(relPos.x, relPos.y, relPos.z),
      height: f.pos.y,
      eccentricity,
      inclinationRad,
      speed: Math.hypot(f.vel.x, f.vel.y, f.vel.z),
    };
  }
  return result;
}

/** 由母星测量轨迹与观测环境推导母星估计（三维）。 */
export function computePlanetEstimate(
  measurements: PlanetMeasurement[],
  previous: PlanetEstimate | null,
  level: number,
  tempC: number,
  tempSigma: number,
  habitability: number,
  knownOrbit: boolean,
  time?: number,
  starEstimates?: Record<StarId, StarEstimate>,
): PlanetEstimate | null {
  void tempSigma;
  const caps = getCapabilities(level);
  const sorted = [...measurements].sort((a, b) => a.timeYears - b.timeYears);
  if (sorted.length === 0 && !previous) return null;
  const reference = time ?? (sorted.length > 0 ? sorted[sorted.length - 1].timeYears : 0);
  const latest = sorted[sorted.length - 1];

  // 位置：最新测量（并融合最近窗口的少量测量）。
  let pos: Vec3 = previous ? { ...previous.pos } : v3(0, 0, 0);
  let sigmaPos = previous?.sigmaPos ?? 1;
  let lastMeasuredYear = previous?.lastMeasuredYear ?? 0;
  let sampleCount = sorted.length;
  let velocityKnown = previous?.known.velocity ?? false;
  let vel: Vec3 = previous ? { ...previous.vel } : v3(0, 0, 0);
  if (latest) {
    const recent = sorted.filter((m) => Math.abs(reference - m.timeYears) <= POSITION_FUSE_WINDOW_YEARS);
    const pts = (recent.length > 0 ? recent : [latest]).slice(-POSITION_FUSE_MAX_SAMPLES);
    const fused = weightedMean3(pts.map((m) => m.pos), pts.map((m) => Math.max(1e-6, m.posSigma)));
    pos = fused.pos;
    sigmaPos = Math.max(1e-6, fused.sigma);
    lastMeasuredYear = latest.timeYears;
    // 速度：>=3 级时用最近窗口内的位置轨迹做线性拟合（母星轨道慢，短线速度可用）。
    if (caps.velocity && sorted.length >= 2) {
      const window = sorted.filter((m) => latest.timeYears - m.timeYears <= Math.max(0.2, Math.min(PLANET_VELOCITY_WINDOW_YEARS, 0.25 * Math.max(0.4, lastMeasuredYear - sorted[0].timeYears))));
      if (window.length >= 2) {
        const fit = fit3D(window.map((m) => ({ t: m.timeYears, pos: m.pos, sigma: m.posSigma })), latest.timeYears, 1);
        if (fit?.vel) {
          vel = fit.vel;
          velocityKnown = true;
        }
      }
    }
  }

  const stars = starEstimates ? STAR_IDS.map((id) => starEstimates[id]).filter(Boolean) : [];
  const bary = stars.length > 0
    ? systemBarycenter(stars.map((s) => ({ mass: s.mass, pos: s.pos, vel: s.vel })))
    : { pos: v3(0, 0, 0), vel: v3(0, 0, 0), mass: 1 };
  const relPos = { x: pos.x - bary.pos.x, y: pos.y - bary.pos.y, z: pos.z - bary.pos.z };
  const relVel = { x: vel.x - bary.vel.x, y: vel.y - bary.vel.y, z: vel.z - bary.vel.z };
  let distanceFromPrimary: number | null = null;
  for (const s of stars) {
    const d = Math.hypot(pos.x - s.pos.x, pos.y - s.pos.y, pos.z - s.pos.z);
    if (distanceFromPrimary === null || d < distanceFromPrimary) distanceFromPrimary = d;
  }
  if (distanceFromPrimary === null) distanceFromPrimary = Math.hypot(relPos.x, relPos.y, relPos.z);

  const orbitKnown = knownOrbit && caps.orbit && velocityKnown;
  let eccentricity = previous?.eccentricity ?? null;
  let inclinationRad = previous?.inclinationRad ?? null;
  if (orbitKnown) {
    const geo = orbitalGeometry(relPos, relVel, Math.max(1e-6, bary.mass));
    eccentricity = Number.isFinite(geo.eccentricity) && geo.eccentricity < 3 ? geo.eccentricity : eccentricity;
    inclinationRad = geo.inclinationRad;
  }
  const confidence = clamp(
    Math.max(previous?.confidence ?? 0.1, 0.22 + Math.min(0.5, sampleCount / 60) + (velocityKnown ? 0.16 : 0)),
    0.08,
    0.98,
  );

  return {
    pos,
    vel,
    distanceFromPrimary,
    tempC,
    sigmaPos,
    habitability,
    orbitRadius: Math.hypot(relPos.x, relPos.y, relPos.z),
    eccentricity,
    inclinationRad,
    height: pos.y,
    lastMeasuredYear,
    confidence,
    known: {
      position: latest !== undefined || (previous?.known.position ?? false),
      distance: (latest !== undefined && caps.distance) || (previous?.known.distance ?? false),
      velocity: velocityKnown,
      mass: false,
      acceleration: false,
      orbit: orbitKnown || (previous?.known.orbit ?? false),
    },
  };
}
