/** Small, dependency-free math helpers shared by every system. */

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Three-dimensional Cartesian vector.
 * Game convention: X = horizontal, Y = vertical (height), Z = depth.
 * The 2D primary view projects onto the X-Z plane and expresses Y as height cues.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v2 = (x = 0, y = 0): Vec2 => ({ x, y });
export const vAdd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const vSub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const vScale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const vLen = (a: Vec2): number => Math.hypot(a.x, a.y);
export const vLen2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const vDist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const vClone = (a: Vec2): Vec2 => ({ x: a.x, y: a.y });
export const vDot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const vCross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const vNorm = (a: Vec2): Vec2 => {
  const l = vLen(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const vRot = (a: Vec2, angle: number): Vec2 => ({
  x: a.x * Math.cos(angle) - a.y * Math.sin(angle),
  y: a.x * Math.sin(angle) + a.y * Math.cos(angle),
});

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);
export const invLerp = (a: number, b: number, v: number): number => (b - a === 0 ? 0 : clamp01((v - a) / (b - a)));
export const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = invLerp(edge0, edge1, v);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a: number): number => {
  let x = a % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x;
};
export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const rad = (d: number): number => (d * Math.PI) / 180;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let s = 0;
  for (const v of values) s += (v - m) * (v - m);
  return Math.sqrt(s / (values.length - 1));
}

/** Deterministic gaussian sample from a uniform generator (Box-Muller). */
export function gaussianFrom(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Solve a small dense linear system with Gaussian elimination (used by least squares fits). */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-14) return null;
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
    }
    const p = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + "k";
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(digits);
  return n.toFixed(Math.min(2, digits + 1));
}

export function fmtSigned(n: number, digits = 1): string {
  const s = fmt(Math.abs(n), digits);
  return (n >= 0 ? "+" : "−") + s;
}

export function fmtPercent(v: number, digits = 0): string {
  return (v * 100).toFixed(digits) + "%";
}

export function fmtYears(years: number): string {
  if (!Number.isFinite(years)) return "—";
  if (Math.abs(years) >= 1) return years.toFixed(1) + " 年";
  return (years * 12).toFixed(1) + " 月";
}

export function fmtDistance(au: number): string {
  if (au < 0.001) return (au * AU_KM).toFixed(0) + " km";
  return au.toFixed(au < 1 ? 3 : 2) + " AU";
}

const AU_KM = 149_597_870.7;

export function uniqueId(prefix: string, counter: { n: number }): string {
  counter.n += 1;
  return prefix + "-" + counter.n;
}

/** Weighted pick helper. */
export function pickWeighted<T>(items: { item: T; weight: number }[], rand: () => number): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return items[0].item;
  let r = rand() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it.item;
  }
  return items[items.length - 1].item;
}

export function safeDiv(a: number, b: number, fallback = 0): number {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-12 ? a / b : fallback;
}

// ------------------------------------------------------------------ *
// Vec3 helpers (3D celestial mechanics).                              *
// ------------------------------------------------------------------ *
export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const vAdd3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vSub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vScale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vLen3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const vLen3Sq = (a: Vec3): number => a.x * a.x + a.y * a.y + a.z * a.z;
export const vDist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const vClone3 = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });
export const vDot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const vCross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const vNorm3 = (a: Vec3): Vec3 => {
  const l = vLen3(a);
  return l < 1e-12 ? v3(0, 0, 0) : { x: a.x / l, y: a.y / l, z: a.z / l };
};
/** Project a 3D position into the 2D X-Z primary view. Height (Y) is preserved separately. */
export const projectXZ = (a: Vec3): Vec2 => ({ x: a.x, y: a.z });
/** Convert an orbital-plane vector (u along nodes, v in-plane) to world coordinates. */
export function orbitPlaneToWorld(u: number, v: number, inclinationRad: number, nodeRad: number): Vec3 {
  const cO = Math.cos(nodeRad);
  const sO = Math.sin(nodeRad);
  const cI = Math.cos(inclinationRad);
  const sI = Math.sin(inclinationRad);
  return {
    x: u * cO - v * cI * sO,
    z: u * sO + v * cI * cO,
    y: v * sI,
  };
}
