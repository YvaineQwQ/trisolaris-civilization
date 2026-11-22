/**
 * near-view-3d.ts —— 3D 近景模式的纯数据层：近景取景参数 + 观测信息卡内容。
 *
 * 观测边界（docs/V4_SPEC.md §4.2）：信息卡只消费 RenderScene3D 里已经存在的观测字段
 * （name / color / radiusAU / mass / tempK / sigmaAU / confidence / known；
 *  母星 tempC / habitability / radiusKm / sigmaAU），绝不 import game / physics，
 * 也绝不读取模拟真值；缺失字段统一显示“未测”，不做推断补全。
 *
 * 本模块不触碰 DOM / three，可在 node 下直接单元验证。
 */
import type { Vec3 } from "../core/math";
import type { RenderScene3D, ScenePlanet3D, SceneStar3D } from "../game/viewTypes";
import {
  AU_KM,
  formatConfidence,
  formatDistanceAU,
  formatHabitability,
  formatHeightAU,
  formatKm,
  formatMass,
  formatSigmaAU,
  formatTempC,
  formatTempK,
  trimNumber,
} from "./theme-3d";
import type { BodyId3D } from "./shared-3d";

/** 近景相机距离 = 视觉半径 × 该系数（约 3.3R，球体占画面高度 ~78%）。 */
export const NEAR_DISTANCE_FACTOR = 3.3;
/** 近景模式允许的最近 / 最远相机距离（相对视觉半径）。 */
export const NEAR_MIN_FACTOR = 1.55;
export const NEAR_MAX_FACTOR = 9;

/**
 * 近景视觉半径（世界 AU）：与全景推荐半径同阶，保证数值稳定；仅影响取景尺度，
 * 不冒充天体真实尺寸（真实尺寸只在信息卡里按观测字段显示）。
 */
export function nearSurfaceRadiusFor(id: BodyId3D, baseRadius: number): number {
  const base = Number.isFinite(baseRadius) && baseRadius > 1e-6 ? baseRadius : 3;
  return base * (id === "planet" ? 0.02 : 0.022);
}

export interface NearOrientation {
  /** 球坐标方位角（与 OrbitCamera3D 同一约定）。 */
  theta: number;
  /** 球坐标极角。 */
  phi: number;
}

/**
 * 近景入场的取景方位：
 *  - 母星：从“观测到的最近恒星方向”偏 40° 左右布置相机，默认看到昼面 + 晨昏线；
 *  - 恒星：自身发光，沿用当前方位并略微抬高，避免正对赤道显得扁平。
 */
export function nearOrientationFor(
  scene: RenderScene3D | null,
  bodyId: BodyId3D,
  currentTheta: number,
  currentPhi: number,
): NearOrientation {
  const fallbackPhi = Number.isFinite(currentPhi) ? currentPhi : 1.02;
  const fallbackTheta = Number.isFinite(currentTheta) ? currentTheta : 0.86;
  if (bodyId !== "planet") {
    return {
      theta: fallbackTheta + 0.42,
      phi: Math.min(2.35, Math.max(0.62, fallbackPhi * 0.72 + 0.34)),
    };
  }
  const planet = scene?.planet;
  const stars = scene?.stars ?? [];
  if (!planet || !isFiniteVec(planet.pos)) {
    return { theta: fallbackTheta + 0.5, phi: 1.18 };
  }
  const nearest = nearestStar(stars, planet.pos);
  if (!nearest) return { theta: fallbackTheta + 0.5, phi: 1.18 };
  const dx = nearest.pos.x - planet.pos.x;
  const dy = nearest.pos.y - planet.pos.y;
  const dz = nearest.pos.z - planet.pos.z;
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-9)) return { theta: fallbackTheta + 0.5, phi: 1.18 };
  const lx = dx / len;
  const ly = dy / len;
  const lz = dz / len;
  // 相机方位 ≈ 恒星方向再绕 Y 偏 38°、抬高 22°，使昼面占 2/3、晨昏线可见。
  const theta = Math.atan2(lx, lz) + 0.66;
  const phi = Math.min(2.3, Math.max(0.45, Math.acos(Math.max(-0.92, Math.min(0.92, ly))) + 0.36));
  return { theta, phi };
}

export function nearestStar(stars: readonly SceneStar3D[], pos: Vec3): SceneStar3D | null {
  let best: SceneStar3D | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    if (!star || !isFiniteVec(star.pos)) continue;
    const dx = star.pos.x - pos.x;
    const dy = star.pos.y - pos.y;
    const dz = star.pos.z - pos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestDist) {
      bestDist = d2;
      best = star;
    }
  }
  return best;
}

/** 观测色温 → 光谱型（仅基于观测温度，属于观测数据的派生展示）。 */
export function spectralClassForTempK(tempK: number | null | undefined): string | null {
  if (tempK === null || tempK === undefined || !Number.isFinite(tempK) || tempK <= 0) return null;
  if (tempK < 3700) return "M 型 · 红矮/红巨星";
  if (tempK < 5200) return "K 型 · 橙色";
  if (tempK < 6000) return "G 型 · 黄色（类太阳）";
  if (tempK < 7500) return "F 型 · 黄白";
  if (tempK < 10000) return "A 型 · 蓝白";
  return "B/O 型 · 高温蓝白";
}

export interface NearInfoRow {
  label: string;
  value: string;
  /** 展示语气：默认墨黑；muted 灰；warn 表示观测缺项。 */
  tone?: "ink" | "muted" | "warn" | "ok";
}

export interface NearBodyInfo {
  id: BodyId3D;
  kind: "star" | "planet";
  title: string;
  /** 一行副标题：类型 / 观测状态。 */
  subtitle: string;
  /** 主色（数据给的观测颜色，回退到主题色）。 */
  accent: string;
  rows: NearInfoRow[];
  /** 观测缺口提示（known=false / 参数未测时）。null 表示数据齐备。 */
  warning: string | null;
}

/**
 * 组装近景信息卡。仅使用 RenderScene3D 内的观测字段；数据缺失时 rows 显示“未测”，
 * 不伪造任何模拟真值或内部状态。
 */
export function buildNearInfo(
  scene: RenderScene3D,
  bodyId: BodyId3D,
  heightDataAvailable: boolean,
): NearBodyInfo | null {
  if (!scene) return null;
  if (bodyId === "planet") {
    const planet = scene.planet;
    if (!planet) return null;
    return buildPlanetInfo(planet, scene, heightDataAvailable);
  }
  const star = findStar(scene, bodyId);
  if (!star) return null;
  const rows: NearInfoRow[] = [];
  const known = !!star.known;
  const spectral = spectralClassForTempK(star.tempK);
  rows.push({
    label: "观测置信度",
    value: known ? formatConfidence(star.confidence) : "仅确认存在",
    tone: known ? "ink" : "warn",
  });
  rows.push({ label: "光谱类型（按观测温度）", value: spectral ?? "温度未测", tone: spectral ? "ink" : "warn" });
  rows.push({ label: "表面温度", value: formatTempK(star.tempK), tone: star.tempK === null ? "warn" : "ink" });
  rows.push({ label: "恒星质量", value: formatMass(star.mass), tone: star.mass === null ? "warn" : "ink" });
  rows.push({
    label: "估计半径",
    value: Number.isFinite(star.radiusAU) && star.radiusAU > 0 ? formatKm(star.radiusAU * AU_KM) : "—",
    tone: Number.isFinite(star.radiusAU) && star.radiusAU > 0 ? "muted" : "warn",
  });
  rows.push({ label: "位置不确定度", value: formatSigmaAU(star.sigmaAU), tone: star.sigmaAU > 0 ? "muted" : "warn" });
  rows.push({ label: "距系统原点", value: isFiniteVec(star.pos) ? formatDistanceAU(Math.hypot(star.pos.x, star.pos.y, star.pos.z)) : "—" });
  if (scene.planet && isFiniteVec(scene.planet.pos) && isFiniteVec(star.pos)) {
    rows.push({
      label: "相对母星",
      value: formatDistanceAU(distance3(star.pos, scene.planet.pos)),
      tone: "muted",
    });
  }
  if (heightDataAvailable && isFiniteVec(star.pos)) {
    rows.push({ label: "高度 Y（三维观测）", value: formatHeightAU(star.pos.y), tone: "muted" });
  }
  const warning = known
    ? null
    : "该恒星仅确认存在：位置与物理参数尚未测定，近景表面为程序化占位材质。";
  return {
    id: bodyId,
    kind: "star",
    title: star.name || "恒星 " + bodyId,
    subtitle: "恒星 · " + (spectral ?? "光谱未测") + (known ? "" : " · 未定位"),
    accent: star.color,
    rows,
    warning,
  };
}

function buildPlanetInfo(
  planet: ScenePlanet3D,
  scene: RenderScene3D,
  heightDataAvailable: boolean,
): NearBodyInfo {
  const rows: NearInfoRow[] = [
    { label: "天体类型", value: "类地行星 · 母星" },
    { label: "表面温度", value: formatTempC(planet.tempC), tone: planet.tempC === null ? "warn" : "ink" },
    {
      label: "宜居度（观测估计）",
      value: formatHabitability(planet.habitability),
      tone: planet.habitability === null ? "warn" : "ok",
    },
    {
      label: "估计半径",
      value: Number.isFinite(planet.radiusKm) && planet.radiusKm > 0 ? formatKm(planet.radiusKm) : "—",
      tone: Number.isFinite(planet.radiusKm) && planet.radiusKm > 0 ? "muted" : "warn",
    },
    { label: "位置不确定度", value: formatSigmaAU(planet.sigmaAU), tone: planet.sigmaAU > 0 ? "muted" : "warn" },
    {
      label: "距系统原点",
      value: isFiniteVec(planet.pos) ? formatDistanceAU(Math.hypot(planet.pos.x, planet.pos.y, planet.pos.z)) : "—",
    },
  ];
  const nearest = nearestStar(scene.stars ?? [], planet.pos);
  if (nearest && isFiniteVec(nearest.pos) && isFiniteVec(planet.pos)) {
    rows.push({
      label: "距最近恒星",
      value: formatDistanceAU(distance3(planet.pos, nearest.pos)),
      tone: "muted",
    });
  }
  if (heightDataAvailable && isFiniteVec(planet.pos)) {
    rows.push({ label: "高度 Y（三维观测）", value: formatHeightAU(planet.pos.y), tone: "muted" });
  }
  const missing: string[] = [];
  if (planet.tempC === null) missing.push("温度");
  if (planet.habitability === null) missing.push("宜居度");
  return {
    id: "planet",
    kind: "planet",
    title: "母星",
    subtitle: "类地行星 · 母星 · 观测档案",
    accent: "#7fe0c8",
    rows,
    warning: missing.length > 0 ? "观测缺口：" + missing.join("、") + " 尚未测定（信息卡只显示观测数据）。" : null,
  };
}

/** 近景目标切换条的数据（顺序与 2D/3D 选择 id 一致）。 */
export const NEAR_TARGETS: readonly { id: BodyId3D; label: string }[] = [
  { id: "A", label: "恒星 A" },
  { id: "B", label: "恒星 B" },
  { id: "C", label: "恒星 C" },
  { id: "planet", label: "母星" },
];

function findStar(scene: RenderScene3D, id: BodyId3D): SceneStar3D | null {
  for (let i = 0; i < scene.stars.length; i++) {
    const star = scene.stars[i];
    if (star && star.id === id) return star;
  }
  return null;
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isFiniteVec(v: Vec3 | null | undefined): v is Vec3 {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** 近景 HUD 调试/说明用：把“近景取景距离”描述成人话。 */
export function describeNearDistance(distanceAU: number): string {
  return Number.isFinite(distanceAU) && distanceAU > 0 ? "取景距离 " + trimNumber(distanceAU, 3) + " AU" : "取景距离 —";
}
