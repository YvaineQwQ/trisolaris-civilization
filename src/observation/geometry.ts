/**
 * 观测几何工具（三维）。
 *
 * 坐标约定与核心层一致：X = 水平，Y = 垂直高度，Z = 深度；2D 主视图为 X-Z 俯视投影。
 * 本模块只做纯几何计算，不读取任何真实物理状态。
 */
import { G } from "../core/constants";
import { clamp } from "../core/math";
import type { Vec3 } from "../core/math";

export interface OrbitGeometry {
  /** 半长轴（AU），双曲线轨道为 Infinity。 */
  semiMajor: number;
  /** 偏心率。 */
  eccentricity: number;
  /** 轨道周期（年），非束缚轨道为 Infinity。 */
  periodYears: number;
  /** 轨道面相对 X-Z 参考面的倾角（弧度，0 = 完全位于参考面内）。 */
  inclinationRad: number;
  /** 单位轨道角动量方向（轨道面法向），退化轨道为 null。 */
  orbitNormal: Vec3 | null;
}

/** 轨道面法向 = 归一化角动量 r × v。 */
export function orbitNormalOf(relPos: Vec3, relVel: Vec3): Vec3 | null {
  const hx = relPos.y * relVel.z - relPos.z * relVel.y;
  const hy = relPos.z * relVel.x - relPos.x * relVel.z;
  const hz = relPos.x * relVel.y - relPos.y * relVel.x;
  const h = Math.hypot(hx, hy, hz);
  if (!Number.isFinite(h) || h < 1e-9) return null;
  return { x: hx / h, y: hy / h, z: hz / h };
}

/**
 * 轨道面相对 X-Z 参考面的倾角。
 * 参考面法向为 +Y，因此 equatorial 轨道（位于 X-Z 平面）倾角为 0。
 */
export function inclinationFromState(relPos: Vec3, relVel: Vec3): number | null {
  const n = orbitNormalOf(relPos, relVel);
  if (!n) return null;
  return Math.acos(clamp(Math.abs(n.y), 0, 1));
}

/** 二体近似下的轨道根数（由观测估计状态反演，绝不使用真实质量）。 */
export function orbitalGeometry(relPos: Vec3, relVel: Vec3, primaryMass: number): OrbitGeometry {
  const r = Math.hypot(relPos.x, relPos.y, relPos.z);
  const mu = G * Math.max(1e-6, primaryMass);
  const v2 = relVel.x * relVel.x + relVel.y * relVel.y + relVel.z * relVel.z;
  const normal = orbitNormalOf(relPos, relVel);
  if (!Number.isFinite(r) || r < 1e-9 || !Number.isFinite(mu)) {
    return { semiMajor: Infinity, eccentricity: 1, periodYears: Infinity, inclinationRad: 0, orbitNormal: null };
  }
  const h = normal
    ? Math.hypot(
        relPos.y * relVel.z - relPos.z * relVel.y,
        relPos.z * relVel.x - relPos.x * relVel.z,
        relPos.x * relVel.y - relPos.y * relVel.x,
      )
    : 0;
  const energy = v2 / 2 - mu / r;
  const e2 = 1 + (2 * energy * h * h) / (mu * mu);
  const eccentricity = Number.isFinite(e2) ? Math.sqrt(Math.max(0, e2)) : 1;
  const semiMajor = energy < 0 ? -mu / (2 * energy) : Infinity;
  const periodYears = Number.isFinite(semiMajor)
    ? Math.sqrt((4 * Math.PI * Math.PI * semiMajor * semiMajor * semiMajor) / mu)
    : Infinity;
  const inclinationRad = normal ? Math.acos(clamp(Math.abs(normal.y), 0, 1)) : 0;
  return { semiMajor, eccentricity, periodYears, inclinationRad, orbitNormal: normal };
}

export interface BarycenterState {
  pos: Vec3;
  vel: Vec3;
  mass: number;
}

/** 由若干带质量天体的估计状态求系统质心（只使用观测估计值）。 */
export function systemBarycenter(bodies: { mass: number; pos: Vec3; vel: Vec3 }[]): BarycenterState {
  let mass = 0;
  let px = 0, py = 0, pz = 0;
  let vx = 0, vy = 0, vz = 0;
  for (const b of bodies) {
    const m = Math.max(1e-9, b.mass);
    mass += m;
    px += m * b.pos.x; py += m * b.pos.y; pz += m * b.pos.z;
    vx += m * b.vel.x; vy += m * b.vel.y; vz += m * b.vel.z;
  }
  if (mass <= 0) return { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, mass: 0 };
  return {
    pos: { x: px / mass, y: py / mass, z: pz / mass },
    vel: { x: vx / mass, y: vy / mass, z: vz / mass },
    mass,
  };
}

/** 三维位置标准差（把一个点集压缩为单一标量不确定度）。 */
export function scatterSigma(points: Vec3[], center?: Vec3): number {
  if (points.length === 0) return 0;
  let cx = 0, cy = 0, cz = 0;
  if (center) {
    cx = center.x; cy = center.y; cz = center.z;
  } else {
    for (const p of points) { cx += p.x; cy += p.y; cz += p.z; }
    cx /= points.length; cy /= points.length; cz /= points.length;
  }
  let sx = 0, sy = 0, sz = 0;
  for (const p of points) {
    sx += (p.x - cx) * (p.x - cx);
    sy += (p.y - cy) * (p.y - cy);
    sz += (p.z - cz) * (p.z - cz);
  }
  const n = Math.max(1, points.length - 1);
  return Math.sqrt((sx + sy + sz) / (3 * n));
}

/** 用三个采样点近似拟合轨迹平面，返回相对 X-Z 参考面的倾角。 */
export function trajectoryInclination(points: Vec3[]): number | null {
  if (points.length < 3) return null;
  const p0 = points[0];
  const p1 = points[Math.floor(points.length / 2)];
  const p2 = points[points.length - 1];
  const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
  const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(len) || len < 1e-9) return null;
  return Math.acos(clamp(Math.abs(ny / len), 0, 1));
}
