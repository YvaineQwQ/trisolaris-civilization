/**
 * draw-planet.ts —— 母星绘制：昼夜终止线、大气散射亮边、气候色、城市灯光、卫星。
 *
 * 光照方向按「距母星最近的恒星」计算（场景只提供投影后的恒星位置，
 * 这里用屏幕空间方向近似，足够表现昼夜明暗关系）。
 */
import type { Camera } from "./camera";
import type { RenderScene, ScenePlanet, SceneStar } from "../game/viewTypes";
import {
  PALETTE,
  TAU,
  clamp,
  hashString,
  heightGuideLength,
  heightModulation,
  heightOf,
  mixColors,
  mulberry32,
  planeX,
  planeY,
  rgba,
  setDash,
} from "./theme";
import type { Point } from "./theme";

/** 母星屏幕半径：以地球半径为基准做视觉放大，随缩放轻微变大。 */
export function planetVisualRadius(cam: Camera, planet: ScenePlanet): number {
  const earth = clamp(Math.sqrt(Math.max(1, planet.radiusKm) / 6371), 0.55, 2.2);
  const zoomBoost = clamp(Math.log10(Math.max(1, cam.zoom)), 0, 2.4);
  return clamp((9.4 + zoomBoost * 3.4) * earth, 6.2, 46);
}

/** 朝向最近恒星的光照方向（屏幕空间单位向量）。 */
function lightDirection(cam: Camera, scene: RenderScene, planet: ScenePlanet): Point {
  const p = cam.worldToScreen(planeX(planet.pos), planeY(planet.pos));
  let best: SceneStar | null = null;
  let bestD = Infinity;
  const stars = scene.stars;
  const px = planeX(planet.pos);
  const py = planeY(planet.pos);
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const dx = planeX(s.pos) - px;
    const dy = planeY(s.pos) - py;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) return { x: -0.62, y: -0.55 };
  const sp = cam.worldToScreen(planeX(best.pos), planeY(best.pos));
  const dx = sp.x - p.x;
  const dy = sp.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { x: 0.7, y: -0.5 };
  return { x: dx / len, y: dy / len };
}

interface PlanetColors {
  lit: string;
  rim: string;
  atmo: string;
}

/** 由温度与宜居度推导行星表面色：高温偏红，低温偏冰蓝，死寂世界灰化。 */
function planetColors(planet: ScenePlanet): PlanetColors {
  const hab = clamp(planet.habitability ?? 0.45, 0, 1);
  const t = planet.tempC;
  let base: string;
  if (t === null || !Number.isFinite(t)) base = "#5b8fa8";
  else if (t > 120) base = "#c9542f";
  else if (t > 45) base = "#b98246";
  else if (t > 12) base = "#4c9a72";
  else if (t > -12) base = "#4a8f9a";
  else if (t > -60) base = "#6f97b8";
  else base = "#a9c6dd";
  const dead = mixColors("#8a7a70", "#5c6a72", clamp((t ?? 0) / 240 + 0.5, 0, 1));
  const lit = mixColors(base, dead, clamp(1 - hab, 0, 1) * 0.62);
  const rim = mixColors(PALETTE.planetRim, lit, 0.45);
  const atmo = mixColors(rim, "#9fd6ff", 0.35);
  return { lit, rim, atmo };
}

/** 母星上的城市灯光（夜面确定性散点）。 */
function drawCityLights(
  ctx: CanvasRenderingContext2D,
  p: Point,
  r: number,
  light: Point,
  hab: number,
  planet: ScenePlanet,
  isNightSide: (ox: number, oy: number) => boolean,
): void {
  const rng = mulberry32(hashString("planet-lights|" + Math.round(planet.radiusKm)));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 11; i++) {
    const ang = rng() * TAU;
    const dist = Math.sqrt(rng()) * r * 0.76;
    const ox = Math.cos(ang) * dist;
    const oy = Math.sin(ang) * dist * 0.92;
    if (!isNightSide(ox, oy)) continue;
    const a = 0.2 + rng() * 0.45;
    ctx.fillStyle = rgba("#ffd39a", a * hab);
    ctx.beginPath();
    ctx.arc(p.x + ox, p.y + oy, Math.max(0.5, r * 0.022), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** 卫星：淡轨道虚线 + 半明半暗的小球。 */
function drawMoons(
  ctx: CanvasRenderingContext2D,
  p: Point,
  r: number,
  light: Point,
  planet: ScenePlanet,
  tint: string,
  time: number,
): void {
  if (r < 6.5) return;
  const rng = mulberry32(hashString("moons|" + Math.round(planet.radiusKm)));
  const count = planet.radiusKm > 8200 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const phase = rng() * TAU;
    const speed = 0.16 + rng() * 0.12;
    const orbit = r * (2.0 + rng() * 0.5);
    const squash = 0.22 + rng() * 0.12;
    const tilt = -0.4 + rng() * 0.3;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(tilt);
    ctx.strokeStyle = rgba(tint, 0.12);
    ctx.lineWidth = 0.7;
    setDash(ctx, [3, 6]);
    ctx.save();
    ctx.scale(1, squash);
    ctx.beginPath();
    ctx.arc(0, 0, orbit, 0, TAU);
    ctx.stroke();
    ctx.restore();
    setDash(ctx, []);
    ctx.restore();

    const a = phase + time * speed;
    const ox = Math.cos(a) * orbit;
    const oy = Math.sin(a) * orbit * squash;
    const mx = p.x + ox * Math.cos(tilt) - oy * Math.sin(tilt);
    const my = p.y + ox * Math.sin(tilt) + oy * Math.cos(tilt);
    const mr = clamp(r * 0.16, 0.9, 2.6);

    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.clip();
    ctx.fillStyle = "#c9d6e4";
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.fillStyle = "rgba(4,8,14,0.78)";
    ctx.beginPath();
    ctx.arc(mx - light.x * mr * 0.95, my - light.y * mr * 0.95, mr * 1.02, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  scene: RenderScene,
  time: number,
): void {
  const planet = scene.planet;
  if (!planet) return;
  const p = cam.worldToScreen(planeX(planet.pos), planeY(planet.pos));
  const r = planetVisualRadius(cam, planet);
  const h = heightOf(planet.pos);
  const hMod = heightModulation(h, cam.viewRadius);
  const hMul = hMod[0];
  if (p.x < -r * 8 || p.x > cam.width + r * 8 || p.y < -r * 8 || p.y > cam.height + r * 8) return;

  const light = lightDirection(cam, scene, planet);
  const colors = planetColors(planet);
  const hab = clamp(planet.habitability ?? 0.4, 0, 1);

  // 1) 大气外辉光
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glowR = r * 2.4;
  const gg = ctx.createRadialGradient(p.x, p.y, r * 0.86, p.x, p.y, glowR);
  gg.addColorStop(0, rgba(colors.atmo, (0.2 + hab * 0.14) * hMul));
  gg.addColorStop(0.45, rgba(colors.atmo, 0.07));
  gg.addColorStop(1, rgba(colors.atmo, 0));
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 2) 行星圆盘（夜面底色 + 受光球面渐变）
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, TAU);
  ctx.clip();

  ctx.fillStyle = mixColors(PALETTE.planetNight, colors.lit, 0.08);
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

  const lx = p.x + light.x * r * 0.58;
  const ly = p.y + light.y * r * 0.58;
  const dayG = ctx.createRadialGradient(lx, ly, r * 0.06, lx, ly, r * 2.05);
  dayG.addColorStop(0, rgba(mixColors(colors.lit, "#ffffff", 0.55), 0.96));
  dayG.addColorStop(0.34, rgba(colors.lit, 0.93));
  dayG.addColorStop(0.62, rgba(mixColors(colors.lit, "#050a12", 0.45), 0.86));
  dayG.addColorStop(0.85, rgba("#050a12", 0.88));
  dayG.addColorStop(1, rgba("#02040a", 0.92));
  ctx.fillStyle = dayG;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, TAU);
  ctx.fill();

  // 纬向气候条纹
  if (r > 9) {
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = mixColors(colors.lit, "#ffffff", 0.4);
    ctx.lineWidth = Math.max(0.6, r * 0.04);
    for (let i = -2; i <= 2; i++) {
      const yy = p.y + (i / 2.7) * r;
      const dy = yy - p.y;
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy)) * 0.94;
      if (hw < 1) continue;
      ctx.save();
      ctx.translate(p.x, yy);
      ctx.scale(1, 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, hw, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 夜面城市灯光
  if (hab > 0.4 && r > 7) {
    drawCityLights(
      ctx,
      p,
      r,
      light,
      hab,
      planet,
      (ox, oy) => (ox * light.x + oy * light.y) / Math.max(1e-6, r) < -0.14,
    );
  }

  // 边缘暗化（球体体积感）
  const limb = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
  limb.addColorStop(0, "rgba(0,0,0,0)");
  limb.addColorStop(0.82, "rgba(0,0,0,0.28)");
  limb.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, TAU);
  ctx.fill();

  // 受光侧大气散射亮边
  ctx.globalCompositeOperation = "lighter";
  const limbAngle = Math.atan2(light.y, light.x);
  ctx.strokeStyle = rgba(colors.atmo, 0.32 + hab * 0.22);
  ctx.lineWidth = Math.max(0.8, r * 0.06);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.985, limbAngle - 1.15, limbAngle + 1.15);
  ctx.stroke();
  ctx.restore();

  // 3) 外缘细线
  ctx.save();
  ctx.strokeStyle = rgba(colors.atmo, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 0.6, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // 4) 卫星
  drawMoons(ctx, p, r, light, planet, colors.atmo, time);

  // 5) 极淡高度指引线（三维高度只做示意，不改变投影位置）
  const guide = heightGuideLength(h, cam.viewRadius);
  if (guide > 0) {
    const dir = h >= 0 ? -1 : 1;
    const gx = p.x + r + 7;
    ctx.save();
    ctx.globalAlpha = clamp(0.16 * hMul, 0, 1);
    ctx.strokeStyle = rgba(colors.atmo, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, p.y);
    ctx.lineTo(gx, p.y + dir * guide);
    ctx.moveTo(gx - 4, p.y + dir * guide);
    ctx.lineTo(gx + 4, p.y + dir * guide);
    ctx.stroke();
    ctx.restore();
  }
}