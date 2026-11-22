/**
 * draw-stars.ts —— 恒星绘制（辉光精灵缓存、白热内核、闪烁、不确定性环）。
 *
 * 性能设计：
 *  - 径向渐变辉光烘焙成按 (颜色, 核心半径) 分桶的精灵图并缓存，每帧只做 drawImage；
 *  - 精灵缓存有上限，超出即整体回收，缩放动画期间不会无限增长；
 *  - 每颗星每帧最多 3 次 drawImage，恒星数量为 3，开销可忽略。
 */
import type { Camera } from "./camera";
import type { RenderScene, SceneStar } from "../game/viewTypes";
import {
  PALETTE,
  TAU,
  clamp,
  hashString,
  heightGuideLength,
  heightModulation,
  heightOf,
  planeX,
  planeY,
  rgba,
  setDash,
} from "./theme";

/** 太阳半径（AU），用于把物理半径换算成视觉尺寸的基准。 */
const SUN_RADIUS_AU = 0.00465047;

/** 精灵图总宽 / 核心半径。径向渐变最外圈为透明，留出光晕空间。 */
export const GLOW_SPRITE_SCALE = 7.2;

const spriteCache = new Map<string, HTMLCanvasElement>();
const MAX_SPRITES = 240;

function createSpriteCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !document.createElement) return null;
  try {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  } catch {
    return null;
  }
}

function spriteContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

/** 取得（或创建）恒星辉光精灵。核心半径按 0.5px 分桶以复用缓存。 */
export function getStarGlowSprite(color: string, coreRadiusCss: number): HTMLCanvasElement | null {
  const r = clamp(Number.isFinite(coreRadiusCss) ? coreRadiusCss : 3, 1, 72);
  const bucket = Math.max(1, Math.round(r * 2) / 2);
  const key = color + "|" + bucket;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const extent = Math.ceil(bucket * GLOW_SPRITE_SCALE);
  const canvas = createSpriteCanvas(extent, extent);
  const ctx = canvas ? spriteContext(canvas) : null;
  if (!canvas || !ctx) return null;
  const c = extent / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.05, rgba(color, 1));
  grad.addColorStop(0.11, rgba(color, 0.9));
  grad.addColorStop(0.24, rgba(color, 0.52));
  grad.addColorStop(0.44, rgba(color, 0.2));
  grad.addColorStop(0.7, rgba(color, 0.055));
  grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, extent, extent);
  if (spriteCache.size >= MAX_SPRITES) spriteCache.clear();
  spriteCache.set(key, canvas);
  return canvas;
}

export function clearStarSpriteCache(): void {
  spriteCache.clear();
}

/** 恒星物理半径（AU），异常数据回落到太阳半径。 */
function starRadiusAU(star: SceneStar): number {
  const r = star.radiusAU;
  return Number.isFinite(r) && r > 1e-6 ? r : SUN_RADIUS_AU;
}

/**
 * 恒星屏幕核心半径（CSS px）。
 * 基础尺寸让恒星在宏观尺度上可见；放大到行星尺度时逐步逼近真实比例（上限截断）。
 */
export function starVisualRadius(star: SceneStar, cam: Camera): number {
  const phys = starRadiusAU(star);
  const base = 3.4 + 4.9 * Math.sqrt(phys / SUN_RADIUS_AU);
  const physicalPx = phys * cam.pxPerAU * 1.8;
  const mixed = Math.max(base, Math.min(54, physicalPx));
  const conf = clamp(star.known ? (star.confidence ?? 0.7) : 0.35, 0.2, 1);
  return clamp(mixed * (0.82 + 0.3 * conf), 2.5, 56);
}

/** 恒星定位不确定性环（虚线圆 + 四向刻度 + 置信度弧）。 */
export function drawStarUncertainty(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
): void {
  if (!scene.settings?.showUncertainty) return;
  const limit = Math.max(cam.width, cam.height) * 2.5;
  for (let i = 0; i < scene.stars.length; i++) {
    const star = scene.stars[i];
    const sigma = star.sigmaAU;
    if (!Number.isFinite(sigma) || sigma <= 0) continue;
    const p = cam.worldToScreen(planeX(star.pos), planeY(star.pos));
    let r = sigma * cam.pxPerAU;
    if (!Number.isFinite(r) || r < 7) r = 7;
    if (r > limit) continue;
    const color = star.color || PALETTE.accent;
    const conf = clamp(star.confidence ?? 0.5, 0, 1);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(color, 0.3);
    setDash(ctx, [4, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
    setDash(ctx, []);

    // 置信度弧（从 12 点方向顺时针），低置信度时明显更短
    ctx.strokeStyle = rgba(color, 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -TAU * 0.25, -TAU * 0.25 + TAU * conf);
    ctx.stroke();

    // 四象限刻度
    const tick = Math.min(6, Math.max(2, r * 0.12));
    ctx.strokeStyle = rgba(color, 0.45);
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI * 0.5;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const cx = p.x + cos * r;
      const cy = p.y + sin * r;
      ctx.beginPath();
      ctx.moveTo(cx - cos * tick, cy - sin * tick);
      ctx.lineTo(cx + cos * tick, cy + sin * tick);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 绘制全部恒星：大气光晕 → 主辉光 → 白热内核 → 衍射环/横向光斑。 */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
  time: number,
): void {
  const stars = scene.stars;
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const p = cam.worldToScreen(planeX(star.pos), planeY(star.pos));
    const baseR = starVisualRadius(star, cam);
    // 三维高度只影响亮度/虚焦程度，绝不改变投影位置
    const heightAU = heightOf(star.pos);
    const hMod = heightModulation(heightAU, cam.viewRadius);
    const hMul = hMod[0];
    const r = baseR * hMod[1];
    const extent = r * GLOW_SPRITE_SCALE;
    if (
      p.x < -extent * 2.2 ||
      p.x > cam.width + extent * 2.2 ||
      p.y < -extent * 2.2 ||
      p.y > cam.height + extent * 2.2
    ) {
      continue;
    }
    const color = star.color || PALETTE.accent;
    const h = hashString(star.id + "|" + (star.name || ""));
    const phase = ((h % 1000) / 1000) * TAU;
    const freq = 0.45 + (((h >>> 10) % 100) / 100) * 0.75;
    const amp = star.known ? 0.028 : 0.075;
    const flicker = 1 + Math.sin(time * freq + phase) * amp;
    const knownMul = star.known ? 1 : 0.5;
    const sprite = getStarGlowSprite(color, r);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (sprite) {
      // 大气光晕
      const halo = extent * 2.1;
      ctx.globalAlpha = clamp(0.26 * knownMul * flicker * hMul, 0, 1);
      ctx.drawImage(sprite, p.x - halo / 2, p.y - halo / 2, halo, halo);
      // 主辉光
      ctx.globalAlpha = clamp(0.95 * knownMul * flicker * hMul, 0, 1);
      ctx.drawImage(sprite, p.x - extent / 2, p.y - extent / 2, extent, extent);
    } else {
      ctx.globalAlpha = clamp(0.9 * knownMul * flicker * hMul, 0, 1);
      ctx.fillStyle = rgba(color, 0.85);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, r * 0.8), 0, TAU);
      ctx.fill();
    }

    // 色温外圈 + 白热内核
    ctx.globalAlpha = clamp(0.5 * knownMul * flicker * hMul, 0, 1);
    ctx.fillStyle = rgba(color, 0.75);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.4, r * 0.56), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = clamp(0.92 * flicker * (0.55 + 0.45 * hMul), 0, 1);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, r * 0.4), 0, TAU);
    ctx.fill();

    // 横向光斑（望远镜衍射质感，仅较大恒星）
    if (star.known && r > 5) {
      const len = extent * 1.35;
      const g = ctx.createLinearGradient(p.x - len, p.y, p.x + len, p.y);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.5, rgba(color, 0.85));
      g.addColorStop(1, rgba(color, 0));
      ctx.globalAlpha = clamp(0.14 * flicker * hMul, 0, 1);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - len, p.y - 0.5, len * 2, 1);
    }

    // 艾里环（极淡）——强化“光学观测”观感
    if (r > 4) {
      ctx.globalAlpha = clamp(0.06 * knownMul * hMul, 0, 1);
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.05, 0, TAU);
      ctx.stroke();
    }

    // 极淡的垂直高度指引线：长度表示 |h|，不参与位置投影
    const guide = heightGuideLength(heightAU, cam.viewRadius);
    if (guide > 0) {
      const dir = heightAU >= 0 ? -1 : 1;
      const gx = p.x + r + 6;
      ctx.globalAlpha = clamp(0.18 * hMul, 0, 1);
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, p.y);
      ctx.lineTo(gx, p.y + dir * guide);
      ctx.moveTo(gx - 4, p.y + dir * guide);
      ctx.lineTo(gx + 4, p.y + dir * guide);
      ctx.moveTo(gx - 2, p.y);
      ctx.lineTo(gx + 2, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}