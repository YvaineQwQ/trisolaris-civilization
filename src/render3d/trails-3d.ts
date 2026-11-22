/**
 * trails-3d.ts —— 轨迹三维绘制：观测轨迹（实线 + 加法混合辉光层）与预测轨迹（虚线）。
 *
 * 契约映射：
 *  - observedTrails（实线） ← settings.showTrails；
 *  - predictedTrails / predictedPlanetTrail（虚线） ← settings.showPrediction；
 *  - 颜色优先用数据给的 color，非法时按天体 id 稳定映射（A/B/C/planet）。
 *
 * 性能设计：
 *  - 每条轨迹预分配固定容量顶点缓冲（MAX_TRAIL_POINTS），帧内只写 position/lineDistance、
 *    调整 drawRange，不重建 Geometry；
 *  - 超过 2000 点的轨迹由 math-3d.decimatePoints 抽稀到 512 点以内；
 *  - 虚线用预分配的 lineDistance 属性（累计弧长）配合 LineDashedMaterial；
 *  - 观测量轨迹额外生成稀疏的加法混合发光点，强化"光学观测"辉光感（≤128 点）。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Points,
  PointsMaterial,
} from "three";
import type { SceneTrail3D } from "../game/viewTypes";
import { accumulateLineDistances, clamp, decimatePoints } from "./math-3d";
import type { ViewerFrame } from "./shared-3d";
import { getSoftDotTexture, lighten, sceneColorForId } from "./theme-3d";

/** 单条轨迹最大顶点数（>2000 点的观测轨迹会被抽稀到该上限）。 */
const MAX_TRAIL_POINTS = 512;
/** 观测轨迹发光点上限。 */
const MAX_GLOW_POINTS = 128;

type LineMaterial = LineBasicMaterial | LineDashedMaterial;

interface TrailVisual {
  key: string;
  dashed: boolean;
  group: Group;
  geometry: BufferGeometry;
  positionAttr: BufferAttribute;
  lineDistanceAttr: BufferAttribute | null;
  positions: Float32Array;
  core: Line;
  halo: Line;
  coreMat: LineMaterial;
  haloMat: LineMaterial;
  dots: Points | null;
  dotGeometry: BufferGeometry | null;
  dotPositions: Float32Array | null;
  dotAttr: BufferAttribute | null;
  dotMat: PointsMaterial | null;
  colorHex: string;
  count: number;
  dashRadius: number;
}

function createCapGeometry(capacity: number, dashed: boolean): {
  geometry: BufferGeometry;
  positionAttr: BufferAttribute;
  lineDistanceAttr: BufferAttribute | null;
  positions: Float32Array;
} {
  const positions = new Float32Array(capacity * 3);
  const positionAttr = new BufferAttribute(positions, 3);
  positionAttr.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttr);
  geometry.setDrawRange(0, 0);
  let lineDistanceAttr: BufferAttribute | null = null;
  if (dashed) {
    const distances = new Float32Array(capacity);
    lineDistanceAttr = new BufferAttribute(distances, 1);
    lineDistanceAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute("lineDistance", lineDistanceAttr);
  }
  return { geometry, positionAttr, lineDistanceAttr, positions };
}

export class Trails3D {
  readonly group = new Group();
  private readonly visuals = new Map<string, TrailVisual>();
  private readonly usedKeys = new Set<string>();
  private readonly tmpColor = new Color();
  private readonly dotTexture = getSoftDotTexture();

  constructor() {
    this.group.name = "r3d-trails";
  }

  /**
   * 同步所有轨迹。
   * @param observed 观测轨迹（实线）
   * @param predicted 预测轨迹（虚线）
   * @param planetTrail 预测母星轨迹（虚线，单独传入）
   */
  sync(
    observed: readonly SceneTrail3D[] | null | undefined,
    predicted: readonly SceneTrail3D[] | null | undefined,
    planetTrail: SceneTrail3D | null | undefined,
    frame: ViewerFrame,
  ): void {
    this.usedKeys.clear();
    const settings = frame.settings;
    if (settings.showTrails && observed) {
      for (let i = 0; i < observed.length; i++) {
        if (observed[i]) this.syncTrail("observed:" + observed[i].id, observed[i], frame, false);
      }
    }
    if (settings.showPrediction && predicted) {
      for (let i = 0; i < predicted.length; i++) {
        if (predicted[i]) this.syncTrail("predicted:" + predicted[i].id, predicted[i], frame, true);
      }
    }
    if (settings.showPrediction && planetTrail) {
      this.syncTrail("planet:predicted", planetTrail, frame, true);
    }
    // 未使用的轨迹隐藏（保留对象以复用缓冲，数量上限 = 天体数 + 1）。
    this.visuals.forEach((visual, key) => {
      if (!this.usedKeys.has(key)) {
        visual.group.visible = false;
        visual.count = 0;
      }
    });
  }

  private syncTrail(key: string, trail: SceneTrail3D, frame: ViewerFrame, predicted: boolean): void {
    const points = trail.points;
    if (!points || points.length < 2) return;
    const dashed = trail.dashed !== undefined ? !!trail.dashed : predicted;
    const visual = this.ensure(key, dashed);
    if (!visual) return;
    this.usedKeys.add(key);

    const count = this.writePositions(visual, points);
    if (count < 2) {
      visual.group.visible = false;
      return;
    }
    visual.group.visible = true;

    const colorHex = sceneColorForId(trail.id, trail.color);
    const alpha = clamp(Number.isFinite(trail.alpha) ? trail.alpha : 0.85, 0.04, 1);
    const width = clamp(Number.isFinite(trail.width) ? trail.width : 1.4, 0.5, 8);

    if (visual.colorHex !== colorHex) {
      visual.colorHex = colorHex;
      const base = new Color(colorHex);
      visual.coreMat.color.copy(base);
      this.tmpColor.set(lighten(colorHex, 0.35));
      visual.haloMat.color.copy(this.tmpColor);
      if (visual.dotMat) visual.dotMat.color.copy(base);
    }
    visual.coreMat.opacity = alpha * (predicted ? 0.72 : 0.95);
    visual.haloMat.opacity = alpha * clamp(0.16 + width * 0.05, 0.14, 0.42);
    visual.core.visible = true;
    visual.halo.visible = true;

    // 虚线 dash 尺度随视野半径缩放，保证不同缩放下观感一致。
    if (visual.dashed) {
      const dashSize = Math.max(1e-6, frame.viewRadius * 0.028);
      const gapSize = Math.max(1e-6, frame.viewRadius * 0.02);
      if (Math.abs(visual.dashRadius - frame.viewRadius) > frame.viewRadius * 0.02) {
        visual.dashRadius = frame.viewRadius;
        const coreDash = visual.coreMat as LineDashedMaterial;
        const haloDash = visual.haloMat as LineDashedMaterial;
        coreDash.dashSize = dashSize;
        coreDash.gapSize = gapSize;
        haloDash.dashSize = dashSize;
        haloDash.gapSize = gapSize;
      }
    }

    // 观测轨迹的稀疏发光点（预测轨迹不加强调，避免误导为已观测）。
    if (!predicted && visual.dots && visual.dotGeometry && visual.dotAttr && visual.dotPositions) {
      const step = Math.max(1, Math.floor(count / MAX_GLOW_POINTS));
      let dots = 0;
      for (let i = 0; i < count && dots < MAX_GLOW_POINTS; i += step) {
        const src = i * 3;
        const dst = dots * 3;
        visual.dotPositions[dst] = visual.positions[src];
        visual.dotPositions[dst + 1] = visual.positions[src + 1];
        visual.dotPositions[dst + 2] = visual.positions[src + 2];
        dots++;
      }
      visual.dotAttr.needsUpdate = true;
      visual.dotGeometry.setDrawRange(0, dots);
      visual.dots.visible = dots > 1;
      if (visual.dotMat) visual.dotMat.opacity = alpha * 0.32;
    } else if (visual.dots) {
      visual.dots.visible = false;
    }
  }

  /** 把轨迹点写入预分配缓冲，返回有效顶点数。 */
  private writePositions(visual: TrailVisual, points: readonly { x: number; y: number; z: number }[]): number {
    const sampled = decimatePoints(points, MAX_TRAIL_POINTS);
    const positions = visual.positions;
    let count = 0;
    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;
      const i3 = count * 3;
      positions[i3] = p.x;
      positions[i3 + 1] = p.y;
      positions[i3 + 2] = p.z;
      count++;
    }
    visual.count = count;
    if (count < 2) {
      visual.geometry.setDrawRange(0, 0);
      return count;
    }
    visual.geometry.setDrawRange(0, count);
    visual.positionAttr.needsUpdate = true;
    if (visual.dashed && visual.lineDistanceAttr) {
      const distances = visual.lineDistanceAttr.array as Float32Array;
      accumulateLineDistances(positions, count, distances);
      visual.lineDistanceAttr.needsUpdate = true;
    }
    return count;
  }

  private ensure(key: string, dashed: boolean): TrailVisual | null {
    const existing = this.visuals.get(key);
    if (existing) {
      if (existing.dashed === dashed) return existing;
      this.disposeVisual(existing);
      this.visuals.delete(key);
    }
    const capacity = MAX_TRAIL_POINTS;
    const { geometry, positionAttr, lineDistanceAttr, positions } = createCapGeometry(capacity, dashed);
    const color = new Color(0xffffff);
    const baseMatParams = {
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    };
    const coreMat: LineMaterial = dashed
      ? new LineDashedMaterial({ ...baseMatParams, dashSize: 0.1, gapSize: 0.06, scale: 1 })
      : new LineBasicMaterial(baseMatParams);
    const haloMat: LineMaterial = dashed
      ? new LineDashedMaterial({
          ...baseMatParams,
          color: color.clone(),
          opacity: 0.25,
          dashSize: 0.1,
          gapSize: 0.06,
          scale: 1,
          blending: AdditiveBlending,
        })
      : new LineBasicMaterial({ ...baseMatParams, color: color.clone(), opacity: 0.25, blending: AdditiveBlending });

    const core = new Line(geometry, coreMat);
    core.frustumCulled = false;
    core.renderOrder = 6;
    const halo = new Line(geometry, haloMat);
    halo.frustumCulled = false;
    halo.renderOrder = 5;

    const group = new Group();
    group.name = "r3d-trail-" + key;
    group.add(core, halo);

    let dots: Points | null = null;
    let dotGeometry: BufferGeometry | null = null;
    let dotPositions: Float32Array | null = null;
    let dotAttr: BufferAttribute | null = null;
    let dotMat: PointsMaterial | null = null;
    if (!dashed) {
      dotPositions = new Float32Array(MAX_GLOW_POINTS * 3);
      dotAttr = new BufferAttribute(dotPositions, 3);
      dotAttr.setUsage(DynamicDrawUsage);
      dotGeometry = new BufferGeometry();
      dotGeometry.setAttribute("position", dotAttr);
      dotGeometry.setDrawRange(0, 0);
      dotMat = new PointsMaterial({
        map: this.dotTexture ?? undefined,
        color: color.clone(),
        size: 2.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      dots = new Points(dotGeometry, dotMat);
      dots.frustumCulled = false;
      dots.renderOrder = 7;
      group.add(dots);
    }
    this.group.add(group);

    const visual: TrailVisual = {
      key,
      dashed,
      group,
      geometry,
      positionAttr,
      lineDistanceAttr,
      positions,
      core,
      halo,
      coreMat,
      haloMat,
      dots,
      dotGeometry,
      dotPositions,
      dotAttr,
      dotMat,
      colorHex: "",
      count: 0,
      dashRadius: -1,
    };
    this.visuals.set(key, visual);
    return visual;
  }

  private disposeVisual(visual: TrailVisual): void {
    try {
      this.group.remove(visual.group);
      visual.geometry.dispose();
      visual.coreMat.dispose();
      visual.haloMat.dispose();
      if (visual.dotGeometry) visual.dotGeometry.dispose();
      if (visual.dotMat) visual.dotMat.dispose();
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    this.visuals.forEach((visual) => this.disposeVisual(visual));
    this.visuals.clear();
    this.usedKeys.clear();
    this.group.clear();
  }
}
