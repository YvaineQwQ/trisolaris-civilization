/**
 * theme.ts —— 渲染层视觉主题：调色板、字体、颜色计算与共享工具。
 *
 * 设计约定：
 *  - 纯计算模块，模块导入时不触碰 DOM（jsdom 下安全）；
 *  - 颜色统一用 #rrggbb 表示，需要透明度时一律经 rgba() 生成；
 *  - 模块内缓存（颜色解析）有容量上限，长期运行不膨胀。
 */

export interface Rgb { r: number; g: number; b: number }
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** 与 core/constants 数值一致；渲染层独立复制，避免依赖模拟核心模块。 */
export const AU_KM = 149_597_870.7;

export const TAU = Math.PI * 2;

/** 硬科幻航天控制中心调色板（与 UI 的 CSS 变量同源）。 */
export const PALETTE = {
  void: "#02050b",
  voidSoft: "#040a14",
  panelBase: "#040b15",
  accent: "#3fd0ff",
  accentDim: "#2b93bb",
  warm: "#ffc857",
  danger: "#ff5b6e",
  ok: "#4ef2b0",
  text: "#d7e9f8",
  muted: "#7d96ad",
  textDim: "#5b738a",
  gridLine: "#5f9ec9",
  axisLine: "#7fc8ff",
  barycenter: "#9db8cc",
  planetNight: "#070d16",
  planetRim: "#8fd4ff",
  observedTrail: "#63d9ff",
  predictedTrail: "#ffb454",
  uncertainty: "#4fa8ff",
  selection: "#8fe8ff",
} as const;

export const FONTS = {
  mono: '"JetBrains Mono", "Cascadia Mono", Consolas, "SFMono-Regular", "Microsoft YaHei", monospace',
  ui: '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
} as const;

/* ------------------------------------------------------------------ *
 *  数值工具                                                          *
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  三维物理 → 2D 俯视投影（X-Z 平面）辅助                            *
 * ------------------------------------------------------------------ *
 *  架构约定：物理层使用真实三维坐标 (x, y, z)，2D 主视图是 X-Z 俯视投影。
 *  本渲染器不直接把 y 加到屏幕坐标上，而是：
 *    - 屏幕水平 = x，屏幕垂直 = z（与相机 2D 平面坐标一致，y 轴向上）；
 *    - y（高度）只用于：标签 h=±x.xx AU、辉光亮度/色深、极淡高度指引线。
 *  兼容 Vec2 旧契约：缺少 z 时退化为 (x, y) 平面投影，高度视为 0。
 */

export interface PosLike {
  x: number;
  y: number;
  z?: number;
}

/** 是否存在第三维（Vec3 契约）。 */
export function hasHeightAxis(pos: PosLike): boolean {
  return typeof pos.z === "number" && Number.isFinite(pos.z);
}

/** 投影平面水平坐标（X）。 */
export function planeX(pos: PosLike): number {
  return Number.isFinite(pos.x) ? pos.x : 0;
}

/** 投影平面纵向坐标：Vec3 用 z（深度轴），Vec2 退化为 y。 */
export function planeY(pos: PosLike): number {
  const z = pos.z;
  if (typeof z === "number" && Number.isFinite(z)) return z;
  return Number.isFinite(pos.y) ? pos.y : 0;
}

/** 垂直于黄道面的高度（AU）；Vec2 契约下恒为 0。 */
export function heightOf(pos: PosLike): number {
  if (typeof pos.z === "number" && Number.isFinite(pos.z)) {
    return Number.isFinite(pos.y) ? pos.y : 0;
  }
  return 0;
}

/** 高度数值展示：h=+1.83 AU / h=−0.42 AU。 */
export function formatHeight(h: number): string {
  const v = Math.abs(h) < 5e-3 ? 0 : h;
  return "h=" + (v >= 0 ? "+" : "\u2212") + Math.abs(v).toFixed(2) + " AU";
}

/**
 * 高度对亮度的克制映射：偏离黄道面越远，观测越暗、越虚。
 * 返回 [亮度系数, 虚焦放大系数]。
 */
export function heightModulation(h: number, viewRadius: number): [number, number] {
  const scale = Math.max(0.8, Math.abs(viewRadius) * 0.9);
  const depth = Math.tanh(Math.abs(h) / scale);
  return [1 - depth * 0.3, 1 + depth * 0.09];
}

/**
 * 屏幕坐标投影：vec3 → 屏幕；返回 { x, y, h }。
 * 调用前必须已传入 camera（保持唯一投影入口，避免各处散落 (x,z) 约定）。
 */
export function heightGuideLength(h: number, viewRadius: number): number {
  if (!Number.isFinite(h) || Math.abs(h) < 1e-4) return 0;
  const ratio = Math.abs(h) / Math.max(1e-6, viewRadius);
  return clamp(6 + ratio * 70, 4, 30);
}

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return Math.abs(b - a) < 1e-12 ? 0 : clamp((v - a) / (b - a), 0, 1);
}

export function smoothstep(a: number, b: number, v: number): number {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
}

/** 取整到 1/2/5 × 10^n 的「好看刻度」。 */
export function niceNumber(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * base;
}

/** 去掉多余尾零的有效数字格式。 */
export function trimNumber(n: number, sig = 3): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    return n.toExponential(Math.max(0, sig - 1)).replace("e+", "e");
  }
  const p = n.toPrecision(sig);
  return p.includes(".") ? p.replace(/0+$/, "").replace(/\.$/, "") : p;
}

/** 天文距离：大尺度用 AU，小尺度自动换算成 km / 万 km。 */
export function formatScaleLength(au: number): string {
  if (!Number.isFinite(au) || au <= 0) return "—";
  if (au >= 0.01) return trimNumber(au, 3) + " AU";
  const km = au * AU_KM;
  if (km >= 1e4) return trimNumber(km / 1e4, 3) + " 万 km";
  if (km >= 1000) return trimNumber(km / 1000, 2) + " 千 km";
  return Math.round(km) + " km";
}

export function formatTick(v: number, step: number): string {
  if (!Number.isFinite(v)) return "";
  const digits = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const s = v.toFixed(digits);
  return s === "-0" ? "0" : s;
}

export function formatYear(y: number): string {
  if (!Number.isFinite(y)) return "—";
  return Number.isInteger(y) ? String(y) : y.toFixed(1);
}

/* ------------------------------------------------------------------ *
 *  颜色工具                                                          *
 * ------------------------------------------------------------------ */

const rgbCache = new Map<string, Rgb>();

export function toRgb(color: string): Rgb {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  let out: Rgb = { r: 200, g: 220, b: 255 };
  const s = typeof color === "string" ? color.trim() : "";
  if (s.charCodeAt(0) === 35) {
    if (s.length === 4) {
      out = {
        r: parseInt(s[1] + s[1], 16),
        g: parseInt(s[2] + s[2], 16),
        b: parseInt(s[3] + s[3], 16),
      };
    } else if (s.length >= 7) {
      out = {
        r: parseInt(s.slice(1, 3), 16),
        g: parseInt(s.slice(3, 5), 16),
        b: parseInt(s.slice(5, 7), 16),
      };
    }
  } else if (s.startsWith("rgb")) {
    const m = s.match(/-?\d+(?:\.\d+)?/g);
    if (m && m.length >= 3) out = { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
  }
  if (!Number.isFinite(out.r)) out.r = 200;
  if (!Number.isFinite(out.g)) out.g = 220;
  if (!Number.isFinite(out.b)) out.b = 255;
  out = { r: clamp(Math.round(out.r), 0, 255), g: clamp(Math.round(out.g), 0, 255), b: clamp(Math.round(out.b), 0, 255) };
  if (rgbCache.size > 512) rgbCache.clear();
  rgbCache.set(color, out);
  return out;
}

export function rgba(color: string, alpha: number): string {
  const c = toRgb(color);
  const a = clamp(alpha, 0, 1);
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
}

export function mixColors(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  const f = clamp(t, 0, 1);
  const r = Math.round(ca.r + (cb.r - ca.r) * f);
  const g = Math.round(ca.g + (cb.g - ca.g) * f);
  const bl = Math.round(ca.b + (cb.b - ca.b) * f);
  return "#" + hex2(r) + hex2(g) + hex2(bl);
}

export function lighten(color: string, t: number): string {
  return mixColors(color, "#ffffff", t);
}

export function darken(color: string, t: number): string {
  return mixColors(color, "#02040a", t);
}

function hex2(v: number): string {
  const s = clamp(Math.round(v), 0, 255).toString(16);
  return s.length === 1 ? "0" + s : s;
}

/** 黑体色温近似（用于程序化星空与恒星色温着色）。 */
const BLACKBODY_STOPS: [number, string][] = [
  [1800, "#ff5a2b"],
  [2600, "#ff7b3d"],
  [3600, "#ffa25c"],
  [4600, "#ffcf9a"],
  [5800, "#fff3dd"],
  [7000, "#eef4ff"],
  [9000, "#d7e6ff"],
  [13000, "#bcd3ff"],
  [22000, "#a8c4ff"],
  [40000, "#9db8ff"],
];

export function colorForTempK(k: number): string {
  const t = clamp(Number.isFinite(k) ? k : 5800, 1800, 40000);
  for (let i = 1; i < BLACKBODY_STOPS.length; i++) {
    const [k1, c1] = BLACKBODY_STOPS[i];
    if (t <= k1) {
      const [k0, c0] = BLACKBODY_STOPS[i - 1];
      return mixColors(c0, c1, (t - k0) / (k1 - k0));
    }
  }
  return BLACKBODY_STOPS[BLACKBODY_STOPS.length - 1][1];
}

/* ------------------------------------------------------------------ *
 *  确定性随机                                                        *
 * ------------------------------------------------------------------ */

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

export function hash01(str: string, salt = 0): number {
  return hashString(str + "#" + salt) / 4294967296;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 *  Canvas 绘制小工具                                                  *
 * ------------------------------------------------------------------ */

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 兼容性安全的虚线设置（部分测试替身没有 setLineDash）。 */
export function setDash(ctx: CanvasRenderingContext2D, pattern: number[]): void {
  if (typeof ctx.setLineDash === "function") ctx.setLineDash(pattern);
}