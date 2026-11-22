/**
 * overlay.ts —— 屏幕叠加层：坐标系网格、观测脉冲、选中标记、天体标签、
 * 比例尺/HUD、暗角与扫描线。所有内容都是 Canvas 2D 绘制，不产生 DOM。
 *
 * 设计原则：
 *  - 画布上只放极短的技术型标注（名称、距离、等级、时间），大段说明交给 UI 层；
 *  - 标签有占用区检测（HUD 区域 + 已放置标签），避免重叠；
 *  - 渐变/贴图尽量烘焙缓存：暗角与扫描线在 resize 时烘焙，扫描光束是一条拉伸贴图。
 */
import type { Camera } from "./camera";
import type { RenderScene, ScenePulse, SceneStar } from "../game/viewTypes";
import { planetVisualRadius } from "./draw-planet";
import { starVisualRadius } from "./draw-stars";
import {
  FONTS,
  PALETTE,
  TAU,
  clamp,
  formatHeight,
  formatScaleLength,
  formatTick,
  formatYear,
  hasHeightAxis,
  hashString,
  heightOf,
  mulberry32,
  niceNumber,
  planeX,
  planeY,
  rgba,
  roundRectPath,
  setDash,
  trimNumber,
  type Point,
  type Rect,
} from "./theme";

/* ------------------------------------------------------------------ *
 *  科技感标签                                                        *
 * ------------------------------------------------------------------ */

export interface TagLine {
  text: string;
  font: string;
  color: string;
}

interface TagMetrics {
  w: number;
  h: number;
  heights: number[];
}

function measureTag(ctx: CanvasRenderingContext2D, lines: TagLine[]): TagMetrics {
  const heights: number[] = [];
  let textW = 0;
  let totalH = 0;
  for (let i = 0; i < lines.length; i++) {
    const lh = i === 0 ? 15 : 13;
    heights.push(lh);
    totalH += lh;
    ctx.font = lines[i].font;
    const w = ctx.measureText(lines[i].text).width;
    if (w > textW) textW = w;
  }
  return {
    w: Math.ceil(textW + 22),
    h: Math.ceil(totalH + 12),
    heights,
  };
}

function paintTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: TagLine[],
  accent: string,
  metrics: TagMetrics,
): Rect {
  const m = metrics;
  ctx.save();
  roundRectPath(ctx, x, y, m.w, m.h, 3);
  ctx.fillStyle = "rgba(4,10,18,0.66)";
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.26);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = rgba(accent, 0.8);
  ctx.fillRect(x + 1, y + 4, 2, Math.max(2, m.h - 8));
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let ty = y + 6;
  for (let i = 0; i < lines.length; i++) {
    const lh = m.heights[i];
    ctx.font = lines[i].font;
    ctx.fillStyle = lines[i].color;
    ctx.fillText(lines[i].text, x + 10, ty + lh / 2 + 0.5);
    ty += lh;
  }
  ctx.restore();
  return { x, y, w: m.w, h: m.h };
}

function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/** 射线从矩形中心指向 toward，求矩形边框交点（用于引线落点）。 */
function boxEdgePoint(rect: Rect, toward: Point): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;
  const tx = Math.abs(ux) < 1e-6 ? Infinity : rect.w / 2 / Math.abs(ux);
  const ty = Math.abs(uy) < 1e-6 ? Infinity : rect.h / 2 / Math.abs(uy);
  const t = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}

/** HUD 占用区域：标签不得压到这些地方。 */
function hudReservedRects(width: number, height: number): Rect[] {
  return [
    { x: 0, y: height - 100, w: Math.min(320, width * 0.3), h: 100 },
    { x: width - Math.min(330, width * 0.32), y: height - 160, w: Math.min(330, width * 0.32), h: 160 },
    { x: 0, y: 0, w: Math.min(260, width * 0.28), h: 44 },
    { x: width - Math.min(320, width * 0.32), y: 0, w: Math.min(320, width * 0.32), h: 44 },
  ];
}

/* ------------------------------------------------------------------ *
 *  坐标系网格                                                        *
 * ------------------------------------------------------------------ */

export function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const step = niceNumber((cam.viewRadius * 2) / 7);
  if (!Number.isFinite(step) || step <= 0) return;
  const halfW = cam.halfWidthAU;
  const halfH = cam.viewRadius;
  const i0 = Math.ceil((cam.centerX - halfW) / step);
  const i1 = Math.floor((cam.centerX + halfW) / step);
  const j0 = Math.ceil((cam.centerY - halfH) / step);
  const j1 = Math.floor((cam.centerY + halfH) / step);
  if (i1 - i0 > 160 || j1 - j0 > 160) return;

  ctx.save();
  ctx.lineWidth = 1;

  for (let i = i0; i <= i1; i++) {
    const x = Math.round(cam.worldToScreenX(i * step)) + 0.5;
    if (x < -1 || x > cam.width + 1) continue;
    if (i === 0) {
      ctx.strokeStyle = rgba(PALETTE.axisLine, 0.2);
    } else if (i % 5 === 0) {
      ctx.strokeStyle = rgba(PALETTE.gridLine, 0.13);
    } else {
      ctx.strokeStyle = rgba(PALETTE.gridLine, 0.055);
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cam.height);
    ctx.stroke();
  }

  for (let j = j0; j <= j1; j++) {
    const y = Math.round(cam.worldToScreenY(j * step)) + 0.5;
    if (y < -1 || y > cam.height + 1) continue;
    if (j === 0) {
      ctx.strokeStyle = rgba(PALETTE.axisLine, 0.2);
    } else if (j % 5 === 0) {
      ctx.strokeStyle = rgba(PALETTE.gridLine, 0.13);
    } else {
      ctx.strokeStyle = rgba(PALETTE.gridLine, 0.055);
    }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cam.width, y);
    ctx.stroke();
  }
  ctx.restore();

  drawGridLabels(ctx, cam, step, i0, i1, j0, j1);
  drawBarycenter(ctx, cam);
}

function drawGridLabels(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  step: number,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
): void {
  ctx.save();
  ctx.font = "9px " + FONTS.mono;
  ctx.fillStyle = rgba("#9fc6e8", 0.42);

  const axisY = cam.worldToScreenY(0);
  const rowY = axisY >= 44 && axisY <= cam.height - 60 ? axisY + 5 : cam.height - 56;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = i0; i <= i1; i++) {
    if (i === 0) continue;
    const x = cam.worldToScreenX(i * step);
    if (x < 28 || x > cam.width - 28) continue;
    ctx.fillText(formatTick(i * step, step), x, rowY);
  }

  const axisX = cam.worldToScreenX(0);
  const colX = axisX >= 44 && axisX <= cam.width - 60 ? axisX - 6 : 30;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let j = j0; j <= j1; j++) {
    if (j === 0) continue;
    const y = cam.worldToScreenY(j * step);
    if (y < 28 || y > cam.height - 28) continue;
    ctx.fillText(formatTick(j * step, step), colX, y);
  }
  ctx.restore();
}

function drawBarycenter(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const o = cam.worldToScreen(0, 0);
  if (o.x < -20 || o.x > cam.width + 20 || o.y < -20 || o.y > cam.height + 20) return;
  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.barycenter, 0.5);
  ctx.lineWidth = 1;
  const rr = 4.5;
  ctx.beginPath();
  ctx.arc(o.x, o.y, rr, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(o.x - rr - 4, o.y);
  ctx.lineTo(o.x - rr - 1, o.y);
  ctx.moveTo(o.x + rr + 1, o.y);
  ctx.lineTo(o.x + rr + 4, o.y);
  ctx.moveTo(o.x, o.y - rr - 4);
  ctx.lineTo(o.x, o.y - rr - 1);
  ctx.moveTo(o.x, o.y + rr + 1);
  ctx.lineTo(o.x, o.y + rr + 4);
  ctx.stroke();
  ctx.font = "9px " + FONTS.mono;
  ctx.fillStyle = rgba(PALETTE.muted, 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("质心", o.x + 9, o.y + 7);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 *  观测脉冲（扩散波）                                                *
 * ------------------------------------------------------------------ */

/** 绘制脉冲扩散波；births 由渲染器持有，用于稳定的波前计时。 */
export function drawPulses(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  pulses: ScenePulse[],
  time: number,
  births: Map<string, number>,
): void {
  if (!pulses || pulses.length === 0) {
    if (births.size > 0) births.clear();
    return;
  }
  const seen = new Set<string>();
  const viewR = Math.max(1e-6, cam.viewRadius);
  for (let i = 0; i < pulses.length; i++) {
    const pulse = pulses[i];
    if (!pulse || !pulse.pos) continue;
    seen.add(pulse.id);
    let born = births.get(pulse.id);
    if (born === undefined || !Number.isFinite(born)) {
      born = time;
      births.set(pulse.id, born);
    }
    const age = time - born;
    if (age < 0 || age > 4.5) continue;
    const p = cam.worldToScreen(planeX(pulse.pos), planeY(pulse.pos));
    const sev = clamp(Number.isFinite(pulse.severity) ? pulse.severity : 0.3, 0, 1);
    const color = sev >= 0.66 ? PALETTE.danger : sev >= 0.4 ? PALETTE.warm : pulse.color || PALETTE.accent;
    const ringPx = (0.08 + age * 0.17) * viewR * cam.pxPerAU;
    const fade = clamp(1 - age / 4.5, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(color, 0.55 * fade * (0.5 + sev * 0.8));
    ctx.lineWidth = 1.3 + sev * 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringPx, 0, TAU);
    ctx.stroke();

    const echo = ringPx * 0.72;
    if (echo > 2) {
      ctx.strokeStyle = rgba(color, 0.2 * fade);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, echo, 0, TAU);
      ctx.stroke();
    }

    if (ringPx > 16) {
      ctx.strokeStyle = rgba(color, 0.38 * fade);
      ctx.lineWidth = 1;
      const tick = Math.min(7, ringPx * 0.08);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + time * 0.15;
        const cx = p.x + Math.cos(a) * ringPx;
        const cy = p.y + Math.sin(a) * ringPx;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * tick, cy + Math.sin(a) * tick);
        ctx.stroke();
      }
    }

    ctx.fillStyle = rgba(color, 0.65 * fade);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6 + sev * 1.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (sev >= 0.55 && age < 2.6 && pulse.label) {
      ctx.save();
      ctx.font = "10px " + FONTS.mono;
      ctx.fillStyle = rgba(color, clamp(fade * 0.8, 0, 0.85));
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(pulse.label, p.x, p.y - ringPx - 6);
      ctx.restore();
    }
  }

  for (const [id, born] of births) {
    if (!seen.has(id) && time - born > 6) births.delete(id);
  }
}

/* ------------------------------------------------------------------ *
 *  选中标记                                                          *
 * ------------------------------------------------------------------ */

function findStar(scene: RenderScene, id: string): SceneStar | null {
  for (let i = 0; i < scene.stars.length; i++) {
    if (scene.stars[i].id === id) return scene.stars[i];
  }
  return null;
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
  time: number,
): void {
  const sel = scene.selection;
  if (!sel) return;

  let p: Point;
  let baseR: number;
  let color: string;
  let name: string;
  const details: TagLine[] = [];

  if (sel === "planet") {
    const planet = scene.planet;
    if (!planet) return;
    p = cam.worldToScreen(planeX(planet.pos), planeY(planet.pos));
    baseR = planetVisualRadius(cam, planet);
    color = PALETTE.selection;
    name = "母星";
    if (hasHeightAxis(planet.pos)) {
      details.push({ text: formatHeight(heightOf(planet.pos)), font: "10px " + FONTS.mono, color: rgba("#8fd4ff", 0.9) });
    }
    if (planet.tempC !== null && Number.isFinite(planet.tempC)) {
      details.push({ text: "表面温度 " + planet.tempC.toFixed(1) + " °C", font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.86) });
    }
    if (planet.habitability !== null && Number.isFinite(planet.habitability)) {
      details.push({ text: "宜居度 " + (planet.habitability * 100).toFixed(0) + "%", font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.86) });
    }
    if (Number.isFinite(planet.radiusKm) && planet.radiusKm > 0) {
      details.push({ text: "半径 " + Math.round(planet.radiusKm) + " km", font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.8) });
    }
  } else {
    const star = findStar(scene, sel);
    if (!star) return;
    p = cam.worldToScreen(planeX(star.pos), planeY(star.pos));
    baseR = starVisualRadius(star, cam);
    color = star.color || PALETTE.accent;
    name = star.name || "未知恒星";
    const dist = Math.hypot(planeX(star.pos), planeY(star.pos));
    details.push({
      text: (star.known ? "R " + trimNumber(dist, 3) + " AU" : "位置未定") +
        (hasHeightAxis(star.pos) ? " · " + formatHeight(heightOf(star.pos)) : ""),
      font: "10px " + FONTS.mono,
      color: rgba("#a9c9e4", 0.86),
    });
    if (star.mass !== null && Number.isFinite(star.mass)) {
      details.push({ text: "质量 " + star.mass.toFixed(2) + " M☉", font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.86) });
    }
    if (star.tempK !== null && Number.isFinite(star.tempK)) {
      details.push({ text: "色温 " + Math.round(star.tempK) + " K", font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.8) });
    }
    const conf = star.confidence ?? 0.5;
    details.push({
      text: "置信度 " + (conf * 100).toFixed(0) + "%" + (star.known ? "" : " · 待定位"),
      font: "9px " + FONTS.mono,
      color: conf >= 0.6 ? rgba(PALETTE.ok, 0.8) : rgba(PALETTE.warm, 0.88),
    });
  }

  const ringR = baseR * 2.4 + 18;
  if (p.x < -ringR - 200 || p.x > cam.width + ringR + 200 || p.y < -ringR - 200 || p.y > cam.height + ringR + 200) {
    return;
  }

  ctx.save();
  // 旋转虚线环
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(time * 0.42);
  ctx.strokeStyle = rgba(color, 0.5);
  ctx.lineWidth = 1.2;
  setDash(ctx, [5, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, ringR, 0, TAU);
  ctx.stroke();
  setDash(ctx, []);
  ctx.strokeStyle = rgba(color, 0.62);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cos * (ringR - 7), sin * (ringR - 7));
    ctx.lineTo(cos * (ringR + 7), sin * (ringR + 7));
    ctx.stroke();
  }
  ctx.restore();

  // 屏幕对齐的四角括号
  const half = ringR + 13;
  const arm = 9;
  ctx.strokeStyle = rgba(color, 0.72);
  ctx.lineWidth = 1.4;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < corners.length; i++) {
    const sx = corners[i][0];
    const sy = corners[i][1];
    const cx = p.x + sx * half;
    const cy = p.y + sy * half;
    ctx.beginPath();
    ctx.moveTo(cx - sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - sy * arm);
    ctx.stroke();
  }

  // 呼吸外环
  const breathe = 0.5 + 0.5 * Math.sin(time * 2.1);
  ctx.strokeStyle = rgba(color, 0.1 + breathe * 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, ringR + 4 + breathe * 5, 0, TAU);
  ctx.stroke();

  // 十字准星
  ctx.strokeStyle = rgba(color, 0.55);
  ctx.lineWidth = 1;
  const ch = ringR - 2;
  ctx.beginPath();
  ctx.moveTo(p.x - ch, p.y);
  ctx.lineTo(p.x - ch + 6, p.y);
  ctx.moveTo(p.x + ch - 6, p.y);
  ctx.lineTo(p.x + ch, p.y);
  ctx.moveTo(p.x, p.y - ch);
  ctx.lineTo(p.x, p.y - ch + 6);
  ctx.moveTo(p.x, p.y + ch - 6);
  ctx.lineTo(p.x, p.y + ch);
  ctx.stroke();
  ctx.restore();

  // 名称 + 参数标签
  const lines: TagLine[] = [{ text: name, font: "600 12px " + FONTS.ui, color: "#eaf7ff" }];
  for (let i = 0; i < details.length; i++) lines.push(details[i]);
  const m = measureTag(ctx, lines);
  let tagX = p.x + half + 12;
  let tagY = p.y - m.h / 2;
  if (tagX + m.w > cam.width - 16) {
    tagX = p.x - half - 12 - m.w;
    if (tagX < 16) {
      tagX = clamp(p.x - m.w / 2, 12, Math.max(12, cam.width - m.w - 12));
      tagY = p.y + half + 14;
    }
  }
  tagY = clamp(tagY, 12, Math.max(12, cam.height - m.h - 12));

  const rect = paintTag(ctx, tagX, tagY, lines, color, m);

  // 引线
  const edge = boxEdgePoint(rect, p);
  const dx = edge.x - p.x;
  const dy = edge.y - p.y;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl;
  const uy = dy / dl;
  const startLen = ringR + 4;
  if (dl > startLen + 6) {
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + ux * startLen, p.y + uy * startLen);
    ctx.lineTo(edge.x - ux * 3, edge.y - uy * 3);
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ *
 *  天体标签                                                          *
 * ------------------------------------------------------------------ */

function starLabelLines(star: SceneStar): TagLine[] {
  const lines: TagLine[] = [
    {
      text: star.name || "未知恒星",
      font: "600 12px " + FONTS.ui,
      color: star.known ? "#eaf7ff" : rgba("#d7e9f8", 0.72),
    },
  ];
  const parts: string[] = [];
  if (star.known) {
    parts.push("R " + trimNumber(Math.hypot(planeX(star.pos), planeY(star.pos)), 3) + " AU");
  } else {
    parts.push("位置未定");
  }
  if (hasHeightAxis(star.pos)) {
    // 三维物理：X-Z 俯视投影下的垂直高度单独展示
    lines.push({ text: formatHeight(heightOf(star.pos)), font: "10px " + FONTS.mono, color: rgba("#8fd4ff", 0.88) });
  }
  lines.push({ text: parts.join(" · "), font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.85) });
  const extra: string[] = [];
  if (star.mass !== null && Number.isFinite(star.mass)) extra.push(star.mass.toFixed(2) + " M☉");
  if (star.tempK !== null && Number.isFinite(star.tempK)) extra.push(Math.round(star.tempK) + " K");
  if (extra.length > 0) {
    lines.push({ text: extra.join(" · "), font: "10px " + FONTS.mono, color: rgba("#a9c9e4", 0.78) });
  }
  if ((star.confidence ?? 1) < 0.45) {
    lines.push({ text: "低置信度 · 待复核", font: "9px " + FONTS.mono, color: rgba(PALETTE.warm, 0.86) });
  }
  return lines;
}

export function drawLabels(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
  width: number,
  height: number,
): void {
  if (!scene.settings?.showLabels) return;
  const blocked: Rect[] = hudReservedRects(width, height);
  if (scene.selection === "planet" && scene.planet) {
    const pp = cam.worldToScreen(planeX(scene.planet.pos), planeY(scene.planet.pos));
    blocked.push({ x: pp.x - 170, y: pp.y - 80, w: 340, h: 160 });
  } else if (scene.selection) {
    // 选中恒星的瞄准环 + 名称面板区域同样要避开，避免普通标签压到选中面板
    for (let i = 0; i < scene.stars.length; i++) {
      const selStar = scene.stars[i];
      if (selStar.id !== scene.selection) continue;
      const sp = cam.worldToScreen(planeX(selStar.pos), planeY(selStar.pos));
      const rr = starVisualRadius(selStar, cam) * 2.4 + 18 + 14;
      blocked.push({ x: sp.x - rr - 8, y: sp.y - rr - 8, w: rr * 2 + 16, h: rr * 2 + 16 });
      blocked.push({ x: sp.x + rr + 4, y: sp.y - 80, w: 260, h: 160 });
      break;
    }
  }

  const items: { star: SceneStar; p: Point; r: number; lines: TagLine[] }[] = [];
  for (let i = 0; i < scene.stars.length; i++) {
    const star = scene.stars[i];
    if (scene.selection === star.id) continue;
    const p = cam.worldToScreen(planeX(star.pos), planeY(star.pos));
    const r = starVisualRadius(star, cam);
    if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) continue;
    items.push({ star, p, r, lines: starLabelLines(star) });
  }
  items.sort((a, b) => (b.star.confidence ?? 0) - (a.star.confidence ?? 0));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const m = measureTag(ctx, item.lines);
    const gap = item.r * 2.6 + 16;
    const candidates: Point[] = [
      { x: item.p.x + gap, y: item.p.y - m.h / 2 },
      { x: item.p.x - gap - m.w, y: item.p.y - m.h / 2 },
      { x: item.p.x - m.w / 2, y: item.p.y - gap - m.h },
      { x: item.p.x - m.w / 2, y: item.p.y + gap },
      { x: item.p.x + gap * 0.7, y: item.p.y - gap * 0.9 - m.h },
      { x: item.p.x - gap * 0.7 - m.w, y: item.p.y + gap * 0.9 },
    ];
    let placed: Rect | null = null;
    for (let c = 0; c < candidates.length; c++) {
      const rect: Rect = { x: candidates[c].x, y: candidates[c].y, w: m.w, h: m.h };
      if (rect.x < 10 || rect.y < 10 || rect.x + rect.w > width - 10 || rect.y + rect.h > height - 10) continue;
      let hit = false;
      for (let b = 0; b < blocked.length; b++) {
        if (overlaps(rect, blocked[b], 4)) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      placed = rect;
      break;
    }
    if (!placed) continue;

    const color = item.star.color || PALETTE.accent;
    const edge = boxEdgePoint(placed, item.p);
    const dx = edge.x - item.p.x;
    const dy = edge.y - item.p.y;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    const startLen = item.r * 1.4 + 3;
    if (dl > startLen + 8) {
      ctx.save();
      ctx.strokeStyle = rgba(color, 0.24);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.p.x + ux * startLen, item.p.y + uy * startLen);
      ctx.lineTo(edge.x - ux * 4, edge.y - uy * 4);
      ctx.stroke();
      ctx.restore();
    }
    paintTag(ctx, placed.x, placed.y, item.lines, color, m);
    blocked.push(placed);
  }
}

/* ------------------------------------------------------------------ *
 *  比例尺 / 状态 HUD / 边框                                          *
 * ------------------------------------------------------------------ */

function drawScaleBar(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number): void {
  const x = 24;
  const y = height - 30;
  const targetPx = clamp(width * 0.085, 84, 150);
  const worldPerPx = 1 / Math.max(1e-9, cam.pxPerAU);
  const nice = niceNumber(targetPx * worldPerPx);
  const barPx = nice * cam.pxPerAU;
  if (!Number.isFinite(barPx) || barPx <= 0) return;

  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.accent, 0.62);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + barPx, y - 4);
  ctx.lineTo(x + barPx, y + 4);
  ctx.moveTo(x + barPx * 0.5, y - 2);
  ctx.lineTo(x + barPx * 0.5, y + 2);
  ctx.stroke();

  ctx.fillStyle = rgba(PALETTE.accent, 0.55);
  ctx.fillRect(x - 1, y - 0.5, 2, 1);
  ctx.fillRect(x + barPx - 1, y - 0.5, 2, 1);

  ctx.font = "10px " + FONTS.mono;
  ctx.fillStyle = rgba("#cfe3f5", 0.75);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(formatScaleLength(nice), x, y - 8);

  ctx.font = "9px " + FONTS.mono;
  ctx.fillStyle = rgba(PALETTE.muted, 0.55);
  ctx.textBaseline = "top";
  ctx.fillText("比例尺", x, y + 7);
  ctx.restore();
}

function drawStatusHud(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  width: number,
  height: number,
): void {
  interface Row {
    text: string;
    color: string;
  }
  const rows: Row[] = [];
  rows.push({ text: "观测台 LV." + Math.max(0, Math.round(scene.observatoryLevel)), color: rgba(PALETTE.accent, 0.9) });
  rows.push({
    text: scene.paused ? "时间流 · 暂停" : "时间流 · 运行",
    color: scene.paused ? rgba(PALETTE.warm, 0.95) : rgba(PALETTE.ok, 0.9),
  });
  rows.push({ text: "纪年 " + formatYear(scene.calendarYear), color: rgba("#cfe3f5", 0.74) });
  if (scene.statusLabel) rows.push({ text: scene.statusLabel, color: rgba("#bcd6ea", 0.82) });
  if (scene.hasColony) rows.push({ text: "殖民地 · 在线", color: rgba(PALETTE.ok, 0.86) });

  const right = width - 24;
  const bottom = height - 26;
  ctx.save();
  ctx.font = "10.5px " + FONTS.mono;
  let textW = 0;
  for (let i = 0; i < rows.length; i++) {
    const w = ctx.measureText(rows[i].text).width;
    if (w > textW) textW = w;
  }
  const lineH = 16;
  const panelW = Math.ceil(textW + 26);
  const panelH = rows.length * lineH + 12;
  const panelX = right - panelW;
  const panelY = bottom - panelH + 2;

  roundRectPath(ctx, panelX, panelY, panelW, panelH, 3);
  ctx.fillStyle = "rgba(4,10,18,0.42)";
  ctx.fill();
  ctx.fillStyle = rgba(PALETTE.accent, 0.32);
  ctx.fillRect(right - 1, panelY + 4, 1, panelH - 8);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i < rows.length; i++) {
    const cy = panelY + 6 + lineH * i + lineH / 2;
    if (i === 0) {
      // 等级行加一个状态灯
      ctx.fillStyle = rgba(PALETTE.accent, 0.75);
      ctx.fillRect(right - panelW + 9, cy - 2, 4, 4);
    }
    ctx.fillStyle = rows[i].color;
    ctx.fillText(rows[i].text, right - 10, cy + 0.5);
  }
  ctx.restore();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
  width: number,
  height: number,
): void {
  drawScaleBar(ctx, cam, width, height);
  drawStatusHud(ctx, scene, width, height);

  // 顶部两个角标（极短文字，仅提供观测状态）
  ctx.save();
  ctx.font = "10px " + FONTS.mono;
  ctx.fillStyle = rgba("#8fb2cc", 0.42);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("实时星图 · 观测视界", 24, 18);
  ctx.textAlign = "right";
  const zoomText = cam.zoom >= 10 ? cam.zoom.toFixed(0) : cam.zoom.toFixed(2);
  ctx.fillText(
    "缩放 ×" + zoomText + " · 视野 R " + trimNumber(cam.viewRadius, 3) + " AU",
    width - 24,
    18,
  );
  ctx.restore();
}

export function drawFrameCorners(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const arm = 22;
  const pad = 10;
  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.gridLine, 0.3);
  ctx.lineWidth = 1;
  const corners: [number, number, number, number][] = [
    [pad, pad, 1, 1],
    [width - pad, pad, -1, 1],
    [width - pad, height - pad, -1, -1],
    [pad, height - pad, 1, -1],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [x, y, sx, sy] = corners[i];
    ctx.beginPath();
    ctx.moveTo(x + sx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * arm);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 *  屏幕后期：暗角 + 扫描线 + 缓慢扫描光束                            *
 * ------------------------------------------------------------------ */

export interface ScreenFx {
  resize(width: number, height: number): void;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void;
  destroy(): void;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
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

export function createScreenFx(): ScreenFx {
  let overlayCanvas: HTMLCanvasElement | null = null;
  let sweepCanvas: HTMLCanvasElement | null = null;
  let width = 0;
  let height = 0;

  function build(w: number, h: number): void {
    overlayCanvas = null;
    sweepCanvas = null;
    if (w < 8 || h < 8) return;
    const bakeScale = Math.min(1, Math.sqrt(3_200_000 / (w * h)));
    const bw = Math.max(2, Math.round(w * bakeScale));
    const bh = Math.max(2, Math.round(h * bakeScale));
    const canvas = makeCanvas(bw, bh);
    let ctx: CanvasRenderingContext2D | null = null;
    if (canvas) {
      try {
        ctx = canvas.getContext("2d");
      } catch {
        ctx = null;
      }
    }
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.scale(bakeScale, bakeScale);

    // 暗角
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.47, Math.min(w, h) * 0.3, w * 0.5, h * 0.47, Math.hypot(w, h) * 0.62);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.62, "rgba(0,0,0,0.18)");
    vignette.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 上下压缩（仪表屏幕感）
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.18);
    top.addColorStop(0, "rgba(0,0,0,0.34)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.18);
    const bottom = ctx.createLinearGradient(0, h, 0, h * 0.82);
    bottom.addColorStop(0, "rgba(0,0,0,0.34)");
    bottom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);

    // 扫描线（很低的透明度）
    ctx.fillStyle = "rgba(0,0,0,0.055)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // 极轻的胶片颗粒（确定性，避免每次 rebuild 画面闪变）
    const grain = mulberry32(hashString("screen-fx|" + w + "x" + h));
    for (let i = 0; i < 1600; i++) {
      const x = grain() * w;
      const y = grain() * h;
      ctx.fillStyle = "rgba(180,215,245," + (0.012 + grain() * 0.03).toFixed(3) + ")";
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
    overlayCanvas = canvas;

    // 扫描光束贴图
    const sweep = makeCanvas(4, 200);
    let sctx: CanvasRenderingContext2D | null = null;
    if (sweep) {
      try {
        sctx = sweep.getContext("2d");
      } catch {
        sctx = null;
      }
    }
    if (sweep && sctx) {
      const g = sctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, "rgba(110,190,255,0)");
      g.addColorStop(0.44, "rgba(110,190,255,0.05)");
      g.addColorStop(0.5, "rgba(160,225,255,0.10)");
      g.addColorStop(0.56, "rgba(110,190,255,0.05)");
      g.addColorStop(1, "rgba(110,190,255,0)");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 4, 200);
      sweepCanvas = sweep;
    }
  }

  return {
    resize(w: number, h: number): void {
      const nextW = Math.max(2, Math.floor(w));
      const nextH = Math.max(2, Math.floor(h));
      if (nextW === width && nextH === height) return;
      width = nextW;
      height = nextH;
      build(width, height);
    },

    draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
      if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, w, h);
      if (sweepCanvas) {
        const period = 11;
        const t = ((time % period) + period) % period / period;
        const y = t * (h + 260) - 130;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.75;
        ctx.drawImage(sweepCanvas, 0, y, w, 210);
        ctx.restore();
      }
    },

    destroy(): void {
      overlayCanvas = null;
      sweepCanvas = null;
      width = 0;
      height = 0;
    },
  };
}