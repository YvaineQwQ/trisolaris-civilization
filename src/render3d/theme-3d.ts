/**
 * theme-3d.ts —— 3D 辅助视图视觉主题：调色板、颜色数学、确定性随机与程序化纹理工厂。
 *
 * 约定：
 *  - 除纹理工厂外不触碰 DOM；模块加载时不访问 document / window（jsdom 安全）；
 *  - 与 2D 主视图 src/render/theme.ts 使用同一套硬科幻调色板，但独立复制，
 *    3D 视图不反向依赖 2D Canvas 渲染器；
 *  - CanvasTexture 按颜色缓存并设上限，长期运行不膨胀。
 */
import { CanvasTexture, SRGBColorSpace } from "three";
import { clamp } from "./math-3d";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 天文单位（km）。与 core/constants 数值一致；渲染层独立复制，避免依赖模拟核心。 */
export const AU_KM = 149_597_870.7;
/** 太阳半径（AU），用于把物理半径换算成视觉尺寸的基准。 */
export const SUN_RADIUS_AU = 0.00465047;
export const TAU = Math.PI * 2;

/** 深空观测 / 精密天文仪器调色板。 */
export const PALETTE_3D = {
  void: "#02050b",
  voidCenter: "#071523",
  accent: "#3fd0ff",
  accentDim: "#2b93bb",
  warm: "#ffc857",
  danger: "#ff5b6e",
  ok: "#4ef2b0",
  text: "#d7e9f8",
  muted: "#7d96ad",
  grid: "#2f6d8d",
  axisX: "#ff8a7a",
  axisY: "#7cf0a8",
  axisZ: "#6fb8ff",
  planet: "#7fe0c8",
  planetCold: "#9cc4e0",
  planetHot: "#e0a070",
  orbitPlane: "#3a90b8",
  selection: "#8fe8ff",
  distance: "#9fd8ff",
  uncertainty: "#4fa8ff",
  pulse: "#ff7a5b",
} as const;

export const FONTS_3D = {
  mono: '"JetBrains Mono", "Cascadia Mono", Consolas, "SFMono-Regular", "Microsoft YaHei", monospace',
  ui: '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
} as const;

/** 天体 id → 缺省颜色（数据未给 color 或颜色非法时使用）。 */
const BODY_FALLBACK_COLORS: Record<string, string> = {
  A: "#ffcf8a",
  B: "#9fd8ff",
  C: "#ff9fb8",
  planet: PALETTE_3D.planet,
};

/* ------------------------------------------------------------------ *
 *  数值 / 文本格式化                                                 *
 * ------------------------------------------------------------------ */

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

/** 天文距离：大尺度 AU，小尺度自动换算 km。 */
export function formatDistanceAU(au: number): string {
  if (!Number.isFinite(au) || au < 0) return "—";
  if (au >= 0.01) return trimNumber(au, 3) + " AU";
  const km = au * AU_KM;
  if (km >= 1e4) return trimNumber(km / 1e4, 3) + " 万 km";
  if (km >= 1) return Math.round(km) + " km";
  return trimNumber(km, 2) + " km";
}

/** 高度数值：h=+1.83 AU / h=−0.42 AU。 */
export function formatHeightAU(h: number): string {
  if (!Number.isFinite(h)) return "h=—";
  const v = Math.abs(h) < 5e-4 ? 0 : h;
  const abs = Math.abs(v);
  const txt = abs >= 0.01 ? abs.toFixed(2) : abs >= 0.001 ? abs.toFixed(3) : abs.toFixed(4);
  return "h=" + (v < 0 ? "\u2212" : "+") + txt + " AU";
}

/** 高度差：Δh=+0.12 AU。 */
export function formatDeltaHeightAU(dh: number): string {
  if (!Number.isFinite(dh)) return "Δh=—";
  const abs = Math.abs(dh);
  const txt = abs >= 0.01 ? abs.toFixed(2) : abs >= 0.001 ? abs.toFixed(3) : abs.toFixed(4);
  return "Δh=" + (dh < 0 ? "\u2212" : "+") + txt + " AU";
}

/** 1σ 位置不确定度：σ±0.03 AU。 */
export function formatSigmaAU(sigma: number): string {
  if (!Number.isFinite(sigma) || sigma <= 0) return "—";
  return "σ±" + formatDistanceAU(sigma);
}

export function formatTempC(t: number | null | undefined): string {
  if (t === null || t === undefined || !Number.isFinite(t)) return "温度未知";
  return (t >= 0 ? "+" : "−") + Math.abs(t).toFixed(1) + " °C";
}

export function formatTempK(k: number | null | undefined): string {
  if (k === null || k === undefined || !Number.isFinite(k)) return "—";
  return Math.round(k) + " K";
}

export function formatHabitability(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "宜居度未知";
  return "宜居度 " + (clamp(h, 0, 1) * 100).toFixed(0) + "%";
}

export function formatMass(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  return m.toFixed(2) + " M☉";
}

export function formatConfidence(c: number | null | undefined): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return "—";
  return "置信度 " + (clamp(c, 0, 1) * 100).toFixed(0) + "%";
}

export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km) || km <= 0) return "—";
  return Math.round(km).toLocaleString("en-US") + " km";
}

export function formatCalendarYear(year: number | null | undefined): string {
  if (year === null || year === undefined || !Number.isFinite(year)) return "—";
  return String(Math.round(year)) + " 年";
}

/** 取整到 1/2/5 × 10^n 的"好看刻度"。 */
export function niceNumber(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * base;
}

/* ------------------------------------------------------------------ *
 *  颜色工具                                                          *
 * ------------------------------------------------------------------ */

const rgbCache = new Map<string, Rgb>();

export function toRgb(color: string | null | undefined): Rgb {
  const key = typeof color === "string" ? color : "";
  const cached = rgbCache.get(key);
  if (cached) return cached;
  let out: Rgb = { r: 200, g: 220, b: 255 };
  const s = key.trim();
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
  out = {
    r: clamp(Math.round(out.r), 0, 255),
    g: clamp(Math.round(out.g), 0, 255),
    b: clamp(Math.round(out.b), 0, 255),
  };
  if (rgbCache.size > 512) rgbCache.clear();
  rgbCache.set(key, out);
  return out;
}

function hex2(v: number): string {
  const s = clamp(Math.round(v), 0, 255).toString(16);
  return s.length === 1 ? "0" + s : s;
}

export function rgbToHex(c: Rgb): string {
  return "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
}

/** 颜色合法性归一化：非法输入回落到强调色。 */
export function safeHex(color: string | null | undefined, fallback: string = PALETTE_3D.accent): string {
  if (typeof color !== "string" || color.trim().length === 0) return fallback;
  const s = color.trim();
  if (s.charCodeAt(0) === 35 || s.startsWith("rgb")) return rgbToHex(toRgb(s));
  return fallback;
}

export function rgba(color: string | null | undefined, alpha: number): string {
  const c = toRgb(color);
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + clamp(alpha, 0, 1) + ")";
}

export function mixColors(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  const f = clamp(t, 0, 1);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * f,
    g: ca.g + (cb.g - ca.g) * f,
    b: ca.b + (cb.b - ca.b) * f,
  });
}

export function lighten(color: string, t: number): string {
  return mixColors(color, "#ffffff", t);
}

export function darken(color: string, t: number): string {
  return mixColors(color, "#02040a", t);
}

/** 黑体色温近似（程序化星空与恒星色温着色）。 */
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

/** 天体 id → 颜色（数据未给合法颜色时的回退，保证颜色与天体 id 稳定映射）。 */
export function bodyColorForId(id: string | null | undefined): string {
  if (!id) return PALETTE_3D.accent;
  const key = String(id);
  return BODY_FALLBACK_COLORS[key] ?? PALETTE_3D.accent;
}

/**
 * 场景 id → 天体 id。
 * game/scene.ts 的轨迹/不确定度 id 带前缀（"obs-A" / "pred-A" / "sigma-A" /
 * "pred-cloud-A" / "obs-planet" / "plane:A" 等），渲染层需要还原成 "A" | "B" | "C" | "planet"
 * 才能做"选中天体增强"等映射；无法识别时原样返回。
 */
export function bodyIdFromSceneId(sceneId: string | null | undefined): string {
  if (typeof sceneId !== "string" || sceneId.length === 0) return "";
  let key = sceneId;
  if (key.startsWith("plane:")) key = key.slice(6);
  if (key.startsWith("obs-")) key = key.slice(4);
  else if (key.startsWith("pred-cloud-")) key = key.slice(11);
  else if (key.startsWith("pred-sigma-")) key = key.slice(11);
  else if (key.startsWith("pred-")) key = key.slice(5);
  else if (key.startsWith("sigma-")) key = key.slice(6);
  else if (key.startsWith("hazard-")) return "";
  if (key === "planet" || key === "A" || key === "B" || key === "C") return key;
  // 形如 "A-0" / "planet-2" 的复合 id
  const head = key.split("-")[0];
  if (head === "A" || head === "B" || head === "C" || head === "planet") return head;
  return key;
}

/** 轨迹/云团 id 的稳定颜色回退（先还原天体 id，再按 id 映射）。 */
export function sceneColorForId(sceneId: string | null | undefined, color: string | null | undefined): string {
  const direct = safeHex(color, "");
  if (direct.length > 0) return direct;
  return bodyColorForId(bodyIdFromSceneId(sceneId));
}

export function severityColor(severity: number): string {
  const s = clamp(Number.isFinite(severity) ? severity : 0, 0, 1);
  if (s >= 0.7) return PALETTE_3D.danger;
  if (s >= 0.35) return PALETTE_3D.warm;
  return PALETTE_3D.accent;
}

export function confidenceColor(confidence: number | null | undefined): string {
  const c = clamp(Number.isFinite(confidence as number) ? (confidence as number) : 0.5, 0, 1);
  if (c >= 0.6) return PALETTE_3D.ok;
  if (c >= 0.35) return PALETTE_3D.warm;
  return PALETTE_3D.danger;
}

/* ------------------------------------------------------------------ *
 *  确定性随机（种子相关，与 2D 渲染器同样的 hash 算法）              *
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
 *  程序化纹理工厂（CanvasTexture）                                   *
 * ------------------------------------------------------------------ */

const textureCache = new Map<string, CanvasTexture>();
let softDotTexture: CanvasTexture | null = null;
const MAX_TEXTURE_CACHE = 64;

function createCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(size));
    canvas.height = Math.max(1, Math.floor(size));
    return canvas;
  } catch {
    return null;
  }
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function wrapTexture(canvas: HTMLCanvasElement): CanvasTexture | null {
  try {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null;
  }
}

/** 恒星/行星/脉冲共用的径向辉光纹理（中心白热，外层按颜色淡出）。 */
export function getGlowTexture(color: string | null | undefined): CanvasTexture | null {
  const hex = safeHex(color);
  const cached = textureCache.get(hex);
  if (cached) return cached;
  const canvas = createCanvas(128);
  const ctx = canvas ? canvasContext(canvas) : null;
  if (!canvas || !ctx) return null;
  const c = 64;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.05, rgba(hex, 0.98));
  grad.addColorStop(0.12, rgba(hex, 0.86));
  grad.addColorStop(0.24, rgba(hex, 0.44));
  grad.addColorStop(0.44, rgba(hex, 0.15));
  grad.addColorStop(0.68, rgba(hex, 0.04));
  grad.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = wrapTexture(canvas);
  if (!texture) return null;
  if (textureCache.size >= MAX_TEXTURE_CACHE) {
    const first = textureCache.keys().next().value as string | undefined;
    if (first !== undefined) {
      const old = textureCache.get(first);
      textureCache.delete(first);
      try {
        old?.dispose();
      } catch {
        /* ignore */
      }
    }
  }
  textureCache.set(hex, texture);
  return texture;
}

/** 轨迹发光点 / 星空使用的柔和圆点纹理（白色，用材质 color 着色）。 */
export function getSoftDotTexture(): CanvasTexture | null {
  if (softDotTexture) return softDotTexture;
  const canvas = createCanvas(64);
  const ctx = canvas ? canvasContext(canvas) : null;
  if (!canvas || !ctx) return null;
  const c = 32;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.22, "rgba(255,255,255,0.82)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grad.addColorStop(0.72, "rgba(255,255,255,0.05)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  softDotTexture = wrapTexture(canvas);
  return softDotTexture;
}

/**
 * 深空背景的径向渐变纹理（场景背景，不参与深度）。
 * 每次调用创建新纹理，由调用方（scene-root）负责 dispose。
 */
export function createBackgroundTexture(): CanvasTexture | null {
  const canvas = createCanvas(512);
  const ctx = canvas ? canvasContext(canvas) : null;
  if (!canvas || !ctx) return null;
  const c = 256;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c * 1.42);
  grad.addColorStop(0, "#081827");
  grad.addColorStop(0.32, "#04101c");
  grad.addColorStop(0.62, "#020a12");
  grad.addColorStop(0.86, "#01060c");
  grad.addColorStop(1, PALETTE_3D.void);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  return wrapTexture(canvas);
}

/** 释放所有缓存的程序化纹理（所有 3D 渲染器销毁后调用）。 */
export function disposeTextureCache(): void {
  textureCache.forEach((texture) => {
    try {
      texture.dispose();
    } catch {
      /* ignore */
    }
  });
  textureCache.clear();
  if (softDotTexture) {
    try {
      softDotTexture.dispose();
    } catch {
      /* ignore */
    }
    softDotTexture = null;
  }
  rgbCache.clear();
}
