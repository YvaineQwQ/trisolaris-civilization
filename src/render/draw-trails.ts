/**
 * draw-trails.ts —— 轨迹与不确定性区域。
 *
 *  - observedTrails：实测轨迹，实线 + 微发光 + 稀疏采样点标记；
 *  - predictedTrails：预测轨迹，虚线 + 低透明度；
 *  - predictedPlanetTrail：母星预测轨迹，点线 + 方向箭头；
 *  - uncertaintyRings / planetUncertainty：半透明填充的误差带。
 *
 * 性能：几何点按 720 点上限抽稀，单条轨迹最多两次 stroke。
 */
import type { Camera } from "./camera";
import type { RenderScene, ScenePolyline, SceneUncertainty } from "../game/viewTypes";
import { PALETTE, TAU, clamp, planeX, planeY, rgba, setDash, type PosLike } from "./theme";

const MAX_POINTS = 720;

function strideFor(count: number): number {
  return count > MAX_POINTS ? Math.ceil(count / MAX_POINTS) : 1;
}

/** 投影 polyline 到当前路径；返回是否成功形成路径。 */
function tracePolyline(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  points: readonly PosLike[],
  stride: number,
): boolean {
  let started = false;
  let lastIdx = -1;
  for (let i = 0; i < points.length; i += stride) {
    const pt = points[i];
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      started = false;
      continue;
    }
    const sx = cam.worldToScreenX(planeX(pt));
    const sy = cam.worldToScreenY(planeY(pt));
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else {
      ctx.lineTo(sx, sy);
    }
    lastIdx = i;
  }
  // 补上被抽稀跳过的最后一个点，避免轨迹末端短一截
  const last = points[points.length - 1];
  if (started && lastIdx !== points.length - 1 && last && Number.isFinite(last.x) && Number.isFinite(last.y)) {
    ctx.lineTo(cam.worldToScreenX(planeX(last)), cam.worldToScreenY(planeY(last)));
  }
  return started;
}

/** 半透明不确定性区域（多边形带）。 */
export function drawUncertaintyBands(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
): void {
  if (!scene.settings?.showUncertainty) return;
  const rings: SceneUncertainty[] = scene.uncertaintyRings.slice();
  if (scene.planetUncertainty) rings.push(scene.planetUncertainty);
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const pts = ring.ring;
    if (!pts || pts.length < 3) continue;
    const stride = strideFor(pts.length);
    ctx.save();
    ctx.beginPath();
    tracePolyline(ctx, cam, pts, stride);
    ctx.closePath();
    const color = ring.color || PALETTE.uncertainty;
    const alpha = clamp(Number.isFinite(ring.alpha) ? ring.alpha : 0.18, 0, 1);
    ctx.fillStyle = rgba(color, alpha * 0.45);
    ctx.fill();
    ctx.strokeStyle = rgba(color, clamp(alpha * 1.7, 0, 0.85));
    ctx.lineWidth = 1;
    setDash(ctx, [5, 6]);
    ctx.stroke();
    setDash(ctx, []);
    ctx.restore();
  }
}

function strokeObserved(ctx: CanvasRenderingContext2D, cam: Camera, line: ScenePolyline): void {
  const pts = line.points;
  if (!pts || pts.length < 2) return;
  const stride = strideFor(pts.length);
  const color = line.color || PALETTE.observedTrail;
  const width = clamp(Number.isFinite(line.width) ? line.width : 1.2, 0.6, 3);
  const alpha = clamp(Number.isFinite(line.alpha) ? line.alpha : 0.8, 0, 1);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 微发光底层
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha * 0.15;
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = width * 3.2;
  ctx.beginPath();
  if (!tracePolyline(ctx, cam, pts, stride)) {
    ctx.restore();
    return;
  }
  ctx.stroke();

  // 实线主体
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = width;
  ctx.beginPath();
  tracePolyline(ctx, cam, pts, stride);
  ctx.stroke();

  // 稀疏采样点（观测样本标记）
  if (pts.length > 8) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = rgba(color, 1);
    const step = Math.max(3, Math.floor(pts.length / 16)) * stride;
    for (let i = 0; i < pts.length; i += step) {
      const pt = pts[i];
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
      ctx.fillRect(cam.worldToScreenX(planeX(pt)) - 0.6, cam.worldToScreenY(planeY(pt)) - 0.6, 1.2, 1.2);
    }
  }
  ctx.restore();
}

function strokePredicted(ctx: CanvasRenderingContext2D, cam: Camera, line: ScenePolyline): void {
  const pts = line.points;
  if (!pts || pts.length < 2) return;
  const stride = strideFor(pts.length);
  const color = line.color || PALETTE.predictedTrail;
  const width = clamp(Number.isFinite(line.width) ? line.width : 1, 0.5, 2.5);
  const alpha = clamp(Number.isFinite(line.alpha) ? line.alpha : 0.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  setDash(ctx, [5, 7]);
  ctx.beginPath();
  if (tracePolyline(ctx, cam, pts, stride)) ctx.stroke();
  setDash(ctx, []);
  ctx.restore();
}

function strokePredictedPlanet(ctx: CanvasRenderingContext2D, cam: Camera, line: ScenePolyline): void {
  const pts = line.points;
  if (!pts || pts.length < 2) return;
  const stride = strideFor(pts.length);
  const color = line.color || PALETTE.predictedTrail;
  const width = clamp(Number.isFinite(line.width) ? line.width : 1, 0.5, 2.5);
  const alpha = clamp(Number.isFinite(line.alpha) ? line.alpha : 0.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  setDash(ctx, [2, 5]);
  ctx.beginPath();
  if (tracePolyline(ctx, cam, pts, stride)) ctx.stroke();
  setDash(ctx, []);

  // 方向箭头（每约 1/8 轨迹一处，示意预测运动方向）
  const step = Math.max(2, Math.floor(pts.length / 8)) * stride;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = rgba(color, 1);
  for (let i = step; i < pts.length; i += step) {
    const a = pts[i - step];
    const b = pts[i];
    if (!a || !b) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    const ax = cam.worldToScreenX(planeX(a));
    const ay = cam.worldToScreenY(planeY(a));
    const bx = cam.worldToScreenX(planeX(b));
    const by = cam.worldToScreenY(planeY(b));
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 8) continue;
    const ux = dx / len;
    const uy = dy / len;
    const size = 3.2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - ux * size - uy * size * 0.6, by - uy * size + ux * size * 0.6);
    ctx.lineTo(bx - ux * size + uy * size * 0.6, by - uy * size - ux * size * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 轨迹总入口：按 settings 决定绘制哪些层级。 */
export function drawTrails(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
): void {
  const settings = scene.settings;
  if (!settings) return;
  if (settings.showTrails && scene.observedTrails) {
    for (let i = 0; i < scene.observedTrails.length; i++) strokeObserved(ctx, cam, scene.observedTrails[i]);
  }
  if (settings.showPrediction) {
    if (scene.predictedTrails) {
      for (let i = 0; i < scene.predictedTrails.length; i++) strokePredicted(ctx, cam, scene.predictedTrails[i]);
    }
    if (scene.predictedPlanetTrail) strokePredictedPlanet(ctx, cam, scene.predictedPlanetTrail);
  }
}