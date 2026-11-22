/**
 * math-3d.ts —— 3D 辅助视图的纯数学层（向量 / 轨迹抽稀 / 轨道平面拟合 / 世界→屏幕投影）。
 *
 * 设计约束：
 *  - 不依赖 DOM，不依赖模拟核心（physics / game），可在 node（vite-node）下直接自测；
 *  - 只用到 three 的 Vector3 / PerspectiveCamera 求投影矩阵；
 *  - 所有函数对 NaN / Infinity / 空输入安全，对应位置返回"不可用"而不是伪造数据。
 */
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3 } from "../core/math";

/* ------------------------------------------------------------------ *
 *  数值工具                                                          *
 * ------------------------------------------------------------------ */

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, v: number): number {
  const span = edge1 - edge0;
  const t = clamp(Math.abs(span) < 1e-12 ? 0 : (v - edge0) / span, 0, 1);
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ *
 *  Vec3 运算（纯函数，不修改入参）                                   *
 * ------------------------------------------------------------------ */

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function vAdd3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vSub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vScale3(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function vLen3(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function vLen3Sq(a: Vec3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function vDist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function vNorm3(a: Vec3): Vec3 {
  const l = vLen3(a);
  if (!(l > 1e-12)) return v3(0, 0, 0);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function vDot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vCross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vMid3(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: (a.z + b.z) * 0.5 };
}

export function isFiniteVec3(v: Vec3 | null | undefined): v is Vec3 {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/* ------------------------------------------------------------------ *
 *  轨迹抽稀                                                          *
 * ------------------------------------------------------------------ */

/**
 * 轨迹抽稀：点数量超过 maxPoints 时按等距索引采样，保留首尾点与顺序。
 * 短于上限时原样返回（不复制）。用于 >2000 点的长轨迹，保证每帧顶点写入量可控。
 */
export function decimatePoints<T extends Vec3>(points: readonly T[], maxPoints: number): readonly T[] {
  if (!points || points.length === 0) return [];
  const limit = Math.max(2, Math.floor(Number.isFinite(maxPoints) ? maxPoints : 2));
  if (points.length <= limit) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i++) {
    const index = Math.min(points.length - 1, Math.max(0, Math.round(i * step)));
    out.push(points[index]);
  }
  return out;
}

/** 把折线顶点（xyz 平铺）的累计弧长写入 out（LineDashedMaterial 的 lineDistance 需要）。 */
export function accumulateLineDistances(positions: Float32Array, count: number, out: Float32Array): void {
  if (!positions || !out || count <= 0) return;
  out[0] = 0;
  let dist = 0;
  for (let i = 1; i < count; i++) {
    const i3 = i * 3;
    const p3 = i3 - 3;
    const dx = positions[i3] - positions[p3];
    const dy = positions[i3 + 1] - positions[p3 + 1];
    const dz = positions[i3 + 2] - positions[p3 + 2];
    dist += Math.hypot(dx, dy, dz);
    out[i] = dist;
  }
}

/* ------------------------------------------------------------------ *
 *  轨道平面拟合（最小二乘 / Newell 法向量）                          *
 * ------------------------------------------------------------------ */

export interface OrbitPlaneFit {
  valid: boolean;
  /** 平面质心（AU，系统坐标系）。 */
  center: Vec3;
  /** 单位法向量；方向确定化（最大分量取正），避免同级旋转抖动。 */
  normal: Vec3;
  /** 采样点在平面内的最大半径（AU）。 */
  radiusAU: number;
  /** 采样点偏离平面的最大距离（AU）；越小拟合越好。 */
  thicknessAU: number;
  /** 实际参与拟合的采样点数。 */
  samples: number;
}

export function emptyOrbitPlaneFit(): OrbitPlaneFit {
  return {
    valid: false,
    center: v3(0, 0, 0),
    normal: v3(0, 1, 0),
    radiusAU: 0,
    thicknessAU: 0,
    samples: 0,
  };
}

/**
 * 由观测轨迹点拟合轨道平面：Newell 法求法向量，退化（共线）时回退为最大叉积。
 * 少于 3 个有限点、或点共线时返回 valid = false —— 渲染层据此不画平面。
 */
export function fitOrbitPlane(points: readonly Vec3[], maxSamples = 512): OrbitPlaneFit {
  const fit = emptyOrbitPlaneFit();
  if (!points || points.length < 3) return fit;
  const picked = decimatePoints(points, Math.max(3, Math.floor(maxSamples)));
  const samples: Vec3[] = [];
  for (let i = 0; i < picked.length; i++) {
    const p = picked[i];
    if (isFiniteVec3(p)) samples.push(p);
  }
  if (samples.length < 3) return fit;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < samples.length; i++) {
    cx += samples[i].x;
    cy += samples[i].y;
    cz += samples[i].z;
  }
  const inv = 1 / samples.length;
  cx *= inv;
  cy *= inv;
  cz *= inv;

  // Newell 法：对有序折线求面法向量（等价于 2 × 有向面积）。
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let scale2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
    const dx = a.x - cx;
    const dy = a.y - cy;
    const dz = a.z - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > scale2) scale2 = d2;
  }
  let nLen = Math.hypot(nx, ny, nz);
  const threshold = Math.max(1e-14, scale2 * 1e-6);
  if (!(nLen > threshold)) {
    // 退化回退：取相邻弦中最大的叉积方向（共线时全为 0 → 判为无效）。
    let bx = 0;
    let by = 0;
    let bz = 0;
    let best = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % samples.length];
      const ax = a.x - cx;
      const ay = a.y - cy;
      const az = a.z - cz;
      const bx2 = b.x - cx;
      const by2 = b.y - cy;
      const bz2 = b.z - cz;
      const crx = ay * bz2 - az * by2;
      const cry = az * bx2 - ax * bz2;
      const crz = ax * by2 - ay * bx2;
      const len = Math.hypot(crx, cry, crz);
      if (len > best) {
        best = len;
        bx = crx;
        by = cry;
        bz = crz;
      }
    }
    if (!(best > 0)) return fit;
    nx = bx;
    ny = by;
    nz = bz;
    nLen = best;
  }
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  // 方向确定化：绝对值最大的分量保持为正，避免同一平面因采样顺序翻转。
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  const lead = ax >= ay && ax >= az ? nx : ay >= az ? ny : nz;
  if (lead < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  let radius = 0;
  let thickness = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    const along = dx * nx + dy * ny + dz * nz;
    const total = dx * dx + dy * dy + dz * dz;
    const inPlane = Math.sqrt(Math.max(0, total - along * along));
    if (inPlane > radius) radius = inPlane;
    const absAlong = Math.abs(along);
    if (absAlong > thickness) thickness = absAlong;
  }
  if (!(radius > 1e-9)) return fit;

  fit.valid = true;
  fit.center = { x: cx, y: cy, z: cz };
  fit.normal = { x: nx, y: ny, z: nz };
  fit.radiusAU = radius;
  fit.thicknessAU = thickness;
  fit.samples = samples.length;
  return fit;
}

/* ------------------------------------------------------------------ *
 *  世界 → 屏幕投影                                                   *
 * ------------------------------------------------------------------ */

export interface ScreenProjection {
  /** CSS 像素坐标（相对画布左上角）。 */
  x: number;
  y: number;
  /** NDC 深度：-1 近裁剪面，1 远裁剪面。 */
  depth: number;
  /** true 表示位于相机前方且未被裁剪（可用于决定是否显示 HTML 标签）。 */
  visible: boolean;
}

const scratchWorld = new Vector3();
const scratchPos = new Vector3();

/**
 * 世界坐标 → CSS 像素投影。
 * 调用方必须保证相机矩阵（matrixWorldInverse / projectionMatrix）是本帧最新的。
 */
export function projectToScreen(
  camera: PerspectiveCamera,
  pos: Vec3,
  width: number,
  height: number,
  out?: ScreenProjection,
): ScreenProjection {
  const res: ScreenProjection = out ?? { x: 0, y: 0, depth: 0, visible: false };
  scratchWorld.set(pos.x, pos.y, pos.z).project(camera);
  const ndcX = scratchWorld.x;
  const ndcY = scratchWorld.y;
  const ndcZ = scratchWorld.z;
  res.x = (ndcX * 0.5 + 0.5) * width;
  res.y = (-ndcY * 0.5 + 0.5) * height;
  res.depth = ndcZ;
  // visible = 位于相机前方、未被近/远裁剪面裁剪，且落在视口 NDC 范围内（HTML 标签据此决定显示）。
  res.visible =
    Number.isFinite(ndcX) &&
    Number.isFinite(ndcY) &&
    Number.isFinite(ndcZ) &&
    ndcZ > -1 &&
    ndcZ < 1 &&
    ndcX >= -1 &&
    ndcX <= 1 &&
    ndcY >= -1 &&
    ndcY <= 1;
  return res;
}

/** 指定世界坐标处的透视比例（CSS 像素 / AU），用于把物理半径换算成屏幕尺寸。 */
export function pixelsPerWorld(camera: PerspectiveCamera, pos: Vec3, viewportHeight: number): number {
  const h = Math.max(2, Number.isFinite(viewportHeight) ? viewportHeight : 2);
  scratchPos.set(pos.x, pos.y, pos.z);
  const dist = Math.max(1e-6, camera.position.distanceTo(scratchPos));
  const fovRad = (camera.fov * Math.PI) / 180;
  const halfTan = Math.max(1e-6, Math.tan(fovRad * 0.5));
  return h / (2 * dist * halfTan);
}

/** 指定世界坐标处的 1 CSS 像素对应的世界长度（AU）。 */
export function worldPerPixel(camera: PerspectiveCamera, pos: Vec3, viewportHeight: number): number {
  const px = pixelsPerWorld(camera, pos, viewportHeight);
  return px > 1e-9 ? 1 / px : 0;
}
