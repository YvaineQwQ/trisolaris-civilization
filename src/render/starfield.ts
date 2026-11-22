/**
 * starfield.ts —— 程序化深空背景（三层视差星空 + 淡银河带 + 星尘）。
 *
 * 性能设计：
 *  - 银河带噪声、星尘、远景星点全部在 resize 时烘焙进离屏 canvas，
 *    每帧只做 1 次背景 blit + 3 次分层 blit；
 *  - 近景亮星（约 44 颗）单独保存相位，每帧用极少量 arc 绘制实现缓慢闪烁；
 *  - 视差随相机平移按 tanh 饱和，永不出现贴图接缝或跳变；
 *  - 所有随机数由 seed 决定，换种子/换窗口尺寸都确定性重建。
 */
import type { Camera } from "./camera";
import {
  PALETTE,
  TAU,
  clamp,
  colorForTempK,
  hashString,
  lerp,
  mulberry32,
  rgba,
  smoothstep,
} from "./theme";

interface LayerSpec {
  count: number;
  minSize: number;
  maxSize: number;
  minAlpha: number;
  maxAlpha: number;
  parallax: number;
}

/** 三层视差：远（细密暗淡）/ 中 / 近（稀疏明亮）。 */
const LAYER_SPECS: LayerSpec[] = [
  { count: 380, minSize: 0.35, maxSize: 0.8, minAlpha: 0.14, maxAlpha: 0.42, parallax: 0.05 },
  { count: 170, minSize: 0.6, maxSize: 1.25, minAlpha: 0.24, maxAlpha: 0.7, parallax: 0.11 },
  { count: 76, minSize: 1.0, maxSize: 2.1, minAlpha: 0.5, maxAlpha: 1.0, parallax: 0.2 },
];

const MAX_LIVE_STARS = 44;

interface BakedLayer {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  margin: number;
  parallax: number;
}

interface BrightStar {
  /** 图层内坐标（layer canvas 的 CSS 像素）。 */
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  phase: number;
  freq: number;
  amp: number;
  parallax: number;
  margin: number;
  spikes: boolean;
}

interface NoiseGrid {
  cols: number;
  rows: number;
  data: Float32Array;
}

export interface Starfield {
  resize(width: number, height: number, dpr: number): void;
  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number): void;
  destroy(): void;
}

function createCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !document.createElement) return null;
  try {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  } catch {
    return null;
  }
}

function get2d(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas || typeof canvas.getContext !== "function") return null;
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function gauss(rand: () => number): number {
  return (rand() + rand() + rand() - 1.5) / 1.5;
}

function randomStarColor(rand: () => number): string {
  const roll = rand();
  if (roll < 0.5) return colorForTempK(2400 + rand() * 1500);
  if (roll < 0.78) return colorForTempK(3900 + rand() * 1700);
  if (roll < 0.94) return colorForTempK(5600 + rand() * 2600);
  return colorForTempK(8200 + rand() * 16000);
}

function makeGrid(rand: () => number, cols: number, rows: number): NoiseGrid {
  const data = new Float32Array((cols + 1) * (rows + 1));
  for (let i = 0; i < data.length; i++) data[i] = rand();
  return { cols, rows, data };
}

function sampleGrid(g: NoiseGrid, u: number, v: number): number {
  const x = clamp(u, 0, 0.999999) * g.cols;
  const y = clamp(v, 0, 0.999999) * g.rows;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(g.cols, x0 + 1);
  const y1 = Math.min(g.rows, y0 + 1);
  const fx = smoothstep(0, 1, x - x0);
  const fy = smoothstep(0, 1, y - y0);
  const stride = g.cols + 1;
  const a = g.data[y0 * stride + x0];
  const b = g.data[y0 * stride + x1];
  const c = g.data[y1 * stride + x0];
  const d = g.data[y1 * stride + x1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** 银河带里多尺度尘埃噪声贴图（一次性烘焙，之后只做缩放拉伸）。 */
function bakeBandNoise(rand: () => number, aspect: number): HTMLCanvasElement | null {
  // 贴图长宽比与银河带一致，保证拉伸后噪声各向同性（否则会出现横向条纹）
  const nw = 360;
  const nh = Math.max(28, Math.round(nw / Math.max(1.2, aspect)));
  const canvas = createCanvas(nw, nh);
  const ctx = get2d(canvas);
  if (!canvas || !ctx) return null;
  let img: ImageData;
  try {
    img = ctx.createImageData(nw, nh);
  } catch {
    return null;
  }
  const data = img.data;
  const g1 = makeGrid(rand, 14, Math.max(4, Math.round(nh / 14)));
  const g2 = makeGrid(rand, 40, Math.max(6, Math.round(nh / 5)));
  const g3 = makeGrid(rand, 88, Math.max(10, Math.round(nh / 2.2)));
  for (let y = 0; y < nh; y++) {
    const ty = y / (nh - 1);
    const v = ty * 2 - 1;
    const env = Math.exp(-v * v * 5.0);
    for (let x = 0; x < nw; x++) {
      const u = x / (nw - 1);
      const n =
        sampleGrid(g1, u, ty) * 0.52 +
        sampleGrid(g2, u, ty) * 0.31 +
        sampleGrid(g3, u, ty) * 0.17 +
        (rand() - 0.5) * 0.1;
      const a = clamp(Math.pow(clamp(n, 0, 1), 1.3) * env, 0, 1);
      const tint = clamp(n * 1.15, 0, 1);
      const idx = (y * nw + x) * 4;
      data[idx] = Math.round(138 + tint * 104);
      data[idx + 1] = Math.round(168 + tint * 74);
      data[idx + 2] = Math.round(218 + tint * 37);
      data[idx + 3] = Math.round(a * 205);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function drawGalaxyBand(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(w * 0.5, h * 0.52);
  ctx.rotate(-0.36 + (rand() - 0.5) * 0.22);
  const L = Math.hypot(w, h) * 1.16;
  const bandH = Math.max(h * 0.52, w * 0.24);

  const band = ctx.createLinearGradient(0, -bandH * 0.5, 0, bandH * 0.5);
  band.addColorStop(0, rgba("#8eb4ff", 0));
  band.addColorStop(0.3, rgba("#8fb6ff", 0.035));
  band.addColorStop(0.5, rgba("#cfe0ff", 0.1));
  band.addColorStop(0.7, rgba("#8fb6ff", 0.035));
  band.addColorStop(1, rgba("#8eb4ff", 0));
  ctx.fillStyle = band;
  ctx.fillRect(-L * 0.5, -bandH * 0.5, L, bandH);

  const noise = bakeBandNoise(rand, L / Math.max(1, bandH));
  if (noise) {
    ctx.globalAlpha = 0.32;
    ctx.drawImage(noise, -L * 0.5, -bandH * 0.5, L, bandH);
    ctx.globalAlpha = 1;
  }

  const core = ctx.createLinearGradient(0, -bandH * 0.1, 0, bandH * 0.1);
  core.addColorStop(0, rgba("#dce8ff", 0));
  core.addColorStop(0.5, rgba("#eef4ff", 0.085));
  core.addColorStop(1, rgba("#dce8ff", 0));
  ctx.fillStyle = core;
  ctx.fillRect(-L * 0.5, -bandH * 0.1, L, bandH * 0.2);

  // 第二层高频星尘纹理：让银河带有“细颗粒”质感而不是均匀雾面
  const fine = bakeBandNoise(rand, L / Math.max(1, bandH));
  if (fine) {
    ctx.globalAlpha = 0.16;
    ctx.drawImage(fine, -L * 0.5, -bandH * 0.5, L, bandH * 1.02);
    ctx.globalAlpha = 1;
  }

  // 带内亮星尘埃
  const bandStars = Math.round(clamp((w * h) / 1500, 220, 1300));
  for (let i = 0; i < bandStars; i++) {
    const x = (rand() - 0.5) * L;
    const y = gauss(rand) * bandH * 0.17;
    const a = 0.06 + Math.pow(rand(), 2.0) * 0.36;
    ctx.fillStyle = rgba(rand() < 0.75 ? "#dbe8ff" : "#ffe3c4", a);
    ctx.fillRect(x, y, 1, 1);
  }

  // 暗尘带：沿银河方向的柔和线性渐变条带（两条边缘都淡出，不会出现硬边黑块）
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 4; i++) {
    const cx = (rand() - 0.5) * L * 0.6;
    const cy = (rand() - 0.5) * bandH * 0.34;
    const hh = bandH * (0.018 + rand() * 0.042);
    const half = L * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rand() - 0.5) * 0.22);
    const dg = ctx.createLinearGradient(0, -hh, 0, hh);
    dg.addColorStop(0, "rgba(1,3,9,0)");
    dg.addColorStop(0.5, "rgba(1,3,9,0.32)");
    dg.addColorStop(1, "rgba(1,3,9,0)");
    ctx.fillStyle = dg;
    ctx.fillRect(-half, -hh, half * 2, hh * 2);
    ctx.restore();
  }
  ctx.restore();
}

function bakeBackground(w: number, h: number, rand: () => number): HTMLCanvasElement | null {
  const canvas = createCanvas(w, h);
  const ctx = get2d(canvas);
  if (!canvas || !ctx) return null;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#000208");
  base.addColorStop(0.42, "#02060f");
  base.addColorStop(0.72, "#020610");
  base.addColorStop(1, "#00030a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
  halo.addColorStop(0, "rgba(18,40,72,0.28)");
  halo.addColorStop(0.4, "rgba(11,26,48,0.16)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const tints = ["#1b3357", "#2b2053", "#123c42", "#392243", "#1e2f4d", "#26404f"];
  for (let i = 0; i < 6; i++) {
    const x = rand() * w;
    const y = h * (0.12 + rand() * 0.78);
    const r = Math.max(w, h) * (0.1 + rand() * 0.2);
    const tint = tints[i % tints.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(tint, 0.028 + rand() * 0.04));
    g.addColorStop(0.55, rgba(tint, 0.014 + rand() * 0.02));
    g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  drawGalaxyBand(ctx, rand, w, h);

  const dust = Math.round(clamp((w * h) / 460, 900, 6200));
  for (let i = 0; i < dust; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = 0.03 + Math.pow(rand(), 2.1) * 0.22;
    const s = rand() < 0.86 ? 1 : 2;
    ctx.fillStyle = rgba(rand() < 0.7 ? "#cfe0ff" : "#ffddbb", a);
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  return canvas;
}

function bakeLayer(
  rand: () => number,
  spec: LayerSpec,
  width: number,
  height: number,
  margin: number,
  areaScale: number,
  layerIndex: number,
): { layer: BakedLayer; brights: BrightStar[] } | null {
  const cw = Math.round(width + margin * 2);
  const ch = Math.round(height + margin * 2);
  const canvas = createCanvas(cw, ch);
  const ctx = get2d(canvas);
  if (!canvas || !ctx) return null;
  const count = Math.max(16, Math.round(spec.count * areaScale));
  const brights: BrightStar[] = [];
  const liveQuota = layerIndex === LAYER_SPECS.length - 1 ? MAX_LIVE_STARS : 0;

  for (let i = 0; i < count; i++) {
    const x = rand() * cw;
    const y = rand() * ch;
    const t = Math.pow(rand(), 1.7);
    const size = spec.minSize + t * (spec.maxSize - spec.minSize);
    const alpha = spec.minAlpha + rand() * (spec.maxAlpha - spec.minAlpha);
    const color = randomStarColor(rand);

    if (brights.length < liveQuota) {
      brights.push({
        x,
        y,
        size,
        color,
        alpha,
        phase: rand() * TAU,
        freq: 0.35 + rand() * 0.95,
        amp: 0.18 + rand() * 0.2,
        parallax: spec.parallax,
        margin,
        spikes: false,
      });
      continue;
    }

    if (size >= 1.35) {
      const r = size * 2.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba("#ffffff", alpha));
      g.addColorStop(0.28, rgba(color, alpha * 0.85));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else {
      const px = Math.max(1, Math.round(size));
      ctx.fillStyle = rgba(color, alpha);
      ctx.fillRect(Math.round(x - px / 2), Math.round(y - px / 2), px, px);
    }
  }

  // 最亮的几颗加十字星芒（只在近景层，数量极少）
  const ranked = brights.slice().sort((a, b) => b.size - a.size);
  for (let i = 0; i < Math.min(6, ranked.length); i++) ranked[i].spikes = true;

  return { layer: { canvas, width: cw, height: ch, margin, parallax: spec.parallax }, brights };
}

export function createStarfield(seed: string): Starfield {
  let width = 0;
  let height = 0;
  let disposed = false;
  let background: HTMLCanvasElement | null = null;
  let layers: BakedLayer[] = [];
  let brights: BrightStar[] = [];

  function build(): void {
    background = null;
    layers = [];
    brights = [];
    if (width < 8 || height < 8) return;
    const key = String(seed || "trisolaris");
    const rand = mulberry32(hashString(key));
    background = bakeBackground(width, height, rand);
    const margin = Math.round(clamp(Math.min(width, height) * 0.14, 40, 200));
    const areaScale = clamp((width * height) / (1440 * 810), 0.4, 2.2);
    for (let i = 0; i < LAYER_SPECS.length; i++) {
      const built = bakeLayer(rand, LAYER_SPECS[i], width, height, margin, areaScale, i);
      if (built) {
        layers.push(built.layer);
        brights.push(...built.brights);
      }
    }
  }

  return {
    resize(w: number, h: number, _dpr: number): void {
      if (disposed) return;
      const nextW = Math.max(2, Math.floor(w));
      const nextH = Math.max(2, Math.floor(h));
      if (nextW === width && nextH === height) return;
      width = nextW;
      height = nextH;
      build();
    },

    draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number): void {
      if (disposed) return;
      if (background) {
        ctx.drawImage(background, 0, 0, width, height);
      } else {
        ctx.fillStyle = PALETTE.void;
        ctx.fillRect(0, 0, width, height);
      }
      if (layers.length === 0) return;

      const cx = width * 0.5;
      const cy = height * 0.5;
      const zoomN = clamp(Math.log2(Math.max(0.02, cam.zoom)), -5, 5);
      const panX = cam.centerX * cam.pxPerAU;
      const panY = -cam.centerY * cam.pxPerAU;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const margin = Math.max(1, (layer.width - width) * 0.5);
        const spread = Math.max(1, 1 + zoomN * (0.006 + layer.parallax * 0.1));
        const offX = -Math.tanh((panX * layer.parallax) / (margin * 3)) * margin * 0.6;
        const offY = -Math.tanh((panY * layer.parallax) / (margin * 3)) * margin * 0.6;
        const drawW = layer.width * spread;
        const drawH = layer.height * spread;
        const left = cx + (offX - margin - cx) * spread;
        const top = cy + (offY - margin - cy) * spread;
        ctx.drawImage(layer.canvas, left, top, drawW, drawH);
      }

      // 近景亮星：缓慢闪烁（视觉主体外的氛围层，不参与天体投影）
      for (let i = 0; i < brights.length; i++) {
        const b = brights[i];
        const margin = b.margin;
        const spread = Math.max(1, 1 + zoomN * (0.006 + b.parallax * 0.1));
        const offX = -Math.tanh((panX * b.parallax) / (margin * 3)) * margin * 0.6;
        const offY = -Math.tanh((panY * b.parallax) / (margin * 3)) * margin * 0.6;
        const sx = cx + (offX - margin - cx) * spread + b.x * spread;
        const sy = cy + (offY - margin - cy) * spread + b.y * spread;
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
        const tw = 1 + b.amp * Math.sin(time * b.freq + b.phase);
        const a = clamp(b.alpha * tw, 0, 1);
        ctx.globalAlpha = a * 0.95;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.6, b.size * 0.44), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a * 0.13;
        ctx.beginPath();
        ctx.arc(sx, sy, b.size * 2.6, 0, TAU);
        ctx.fill();
        if (b.spikes) {
          const len = b.size * 5.5;
          ctx.globalAlpha = a * 0.22;
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(sx - len, sy);
          ctx.lineTo(sx + len, sy);
          ctx.moveTo(sx, sy - len);
          ctx.lineTo(sx, sy + len);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    destroy(): void {
      disposed = true;
      background = null;
      layers = [];
      brights = [];
    },
  };
}