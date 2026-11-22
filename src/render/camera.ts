/**
 * camera.ts —— 世界坐标(AU) ⇄ 屏幕坐标 的观测相机。
 *
 * 约定：
 *  - 世界原点 = 三星系统质心；y 轴向上为正；
 *  - viewRadius（= scene.recommendedRadiusAU / zoom）映射到屏幕垂直半高，
 *    因此 16:9 画布的水平视野更宽，世界单位在 x/y 上等比例（正圆天体不会被拉扁）；
 *  - 缩放与居中带指数平滑，交互（拖动）立即生效，观感不拖沓。
 */
import { clamp, lerp, type Point } from "./theme";

export const ZOOM_MIN = 0.02;
export const ZOOM_MAX = 200;

export class Camera {
  /** 视口 CSS 宽高。 */
  width = 2;
  height = 2;
  dpr = 1;
  /** 参考视野半径（由场景 recommendedRadiusAU 提供），zoom = baseRadius / radius。 */
  baseRadius = 3;
  /** 当前视野半径（垂直半高，AU）。 */
  radius = 3;
  /** 目标视野半径（缩放动画终点）。 */
  targetRadius = 3;
  /** 屏幕像素 / AU，随 radius 变化。 */
  pxPerAU = 1;

  private minRadius = 3 / ZOOM_MAX;
  private maxRadius = 3 / ZOOM_MIN;
  private cx = 0;
  private cy = 0;
  private tcx = 0;
  private tcy = 0;

  get centerX(): number { return this.cx; }
  get centerY(): number { return this.cy; }
  get viewRadius(): number { return this.radius; }
  get zoom(): number { return this.baseRadius / Math.max(1e-9, this.radius); }
  get halfWidthAU(): number { return (this.width * 0.5) / Math.max(1e-9, this.pxPerAU); }
  get minViewRadius(): number { return this.minRadius; }
  get maxViewRadius(): number { return this.maxRadius; }

  setViewport(width: number, height: number, dpr: number): void {
    this.width = Math.max(2, width);
    this.height = Math.max(2, height);
    this.dpr = Math.max(1, dpr);
    this.recompute();
  }

  /** 每帧同步场景给出的参考视野；换局/推荐半径变化时保持相对缩放。 */
  setBaseRadius(base: number): void {
    const next = Number.isFinite(base) && base > 1e-6 ? base : this.baseRadius;
    if (Math.abs(next - this.baseRadius) > Math.max(1e-6, this.baseRadius * 1e-4)) {
      const ratio = next / this.baseRadius;
      this.baseRadius = next;
      this.minRadius = next / ZOOM_MAX;
      this.maxRadius = next / ZOOM_MIN;
      this.radius = clamp(this.radius * ratio, this.minRadius, this.maxRadius);
      this.targetRadius = clamp(this.targetRadius * ratio, this.minRadius, this.maxRadius);
    }
    this.recompute();
  }

  private recompute(): void {
    this.pxPerAU = (this.height * 0.5) / Math.max(1e-9, this.radius);
  }

  worldToScreen(x: number, y: number): Point {
    return {
      x: this.width * 0.5 + (x - this.cx) * this.pxPerAU,
      y: this.height * 0.5 - (y - this.cy) * this.pxPerAU,
    };
  }

  worldToScreenX(x: number): number {
    return this.width * 0.5 + (x - this.cx) * this.pxPerAU;
  }

  worldToScreenY(y: number): number {
    return this.height * 0.5 - (y - this.cy) * this.pxPerAU;
  }

  screenToWorld(sx: number, sy: number): Point {
    return {
      x: this.cx + (sx - this.width * 0.5) / Math.max(1e-9, this.pxPerAU),
      y: this.cy - (sy - this.height * 0.5) / Math.max(1e-9, this.pxPerAU),
    };
  }

  worldLengthToPx(len: number): number {
    return len * this.pxPerAU;
  }

  isVisibleWorld(x: number, y: number, marginWorld = 0): boolean {
    return (
      Math.abs(x - this.cx) <= this.halfWidthAU + marginWorld &&
      Math.abs(y - this.cy) <= this.radius + marginWorld
    );
  }

  /** 每帧推进平滑动画（dt 秒，做上限保护）。 */
  update(dtSeconds: number): void {
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0.016, 0, 0.1);
    if (dt > 0) {
      const kr = 1 - Math.exp(-13 * dt);
      const kc = 1 - Math.exp(-19 * dt);
      if (Math.abs(this.targetRadius - this.radius) > this.radius * 1e-4) {
        this.radius = lerp(this.radius, this.targetRadius, kr);
      } else {
        this.radius = this.targetRadius;
      }
      if (Math.abs(this.tcx - this.cx) > this.radius * 1e-5 || Math.abs(this.tcy - this.cy) > this.radius * 1e-5) {
        this.cx = lerp(this.cx, this.tcx, kc);
        this.cy = lerp(this.cy, this.tcy, kc);
      } else {
        this.cx = this.tcx;
        this.cy = this.tcy;
      }
    } else {
      this.cx = this.tcx;
      this.cy = this.tcy;
    }
    this.recompute();
  }

  /** 拖动平移：dx/dy 为屏幕像素增量（拖动期间立即生效）。 */
  panByPixels(dx: number, dy: number): void {
    const scale = Math.max(1e-9, this.pxPerAU);
    this.tcx -= dx / scale;
    this.tcy += dy / scale;
    this.cx = this.tcx;
    this.cy = this.tcy;
  }

  /** 以屏幕点为中心缩放，保证该点下的世界坐标不漂移。 */
  zoomAt(sx: number, sy: number, factor: number): void {
    const f = clamp(Number.isFinite(factor) ? factor : 1, 0.2, 5);
    if (Math.abs(f - 1) < 1e-6) return;
    const nextTarget = clamp(this.targetRadius / f, this.minRadius, this.maxRadius);
    if (Math.abs(nextTarget - this.targetRadius) < this.targetRadius * 1e-6) return;
    const oldPx = (this.height * 0.5) / Math.max(1e-9, this.targetRadius);
    const wx = this.tcx + (sx - this.width * 0.5) / oldPx;
    const wy = this.tcy - (sy - this.height * 0.5) / oldPx;
    const newPx = (this.height * 0.5) / nextTarget;
    this.tcx = wx - (sx - this.width * 0.5) / newPx;
    this.tcy = wy + (sy - this.height * 0.5) / newPx;
    this.targetRadius = nextTarget;
  }

  zoomBy(factor: number): void {
    this.zoomAt(this.width * 0.5, this.height * 0.5, factor);
  }

  /** 平滑聚焦到世界坐标（视野半径不变，由调用方决定是否继续缩放）。 */
  focusOn(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.tcx = x;
    this.tcy = y;
  }

  /** 复位到系统质心 + 初始视野。 */
  reset(radius?: number): void {
    const r = clamp(
      Number.isFinite(radius) ? (radius as number) : this.baseRadius,
      this.minRadius,
      this.maxRadius,
    );
    this.tcx = 0;
    this.tcy = 0;
    this.cx = 0;
    this.cy = 0;
    this.targetRadius = r;
    this.radius = r;
    this.recompute();
  }
}
