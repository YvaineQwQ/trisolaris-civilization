/**
 * orbit-plane-3d.ts —— 由观测轨迹点拟合的轨道平面可视化（半透明圆盘 + 边缘细环）。
 *
 * 规范（docs/ARCH_3D.md）：轨道平面必须由真实运动数据拟合，不得统一画成水平圆环。
 * 因此这里对每条观测轨迹（观测不足时回退到预测轨迹，仍属玩家模型数据）做平面拟合：
 *  - 有效样本 ≥ 3 且不共线才绘制；
 *  - 圆盘朝向 = 拟合平面法向量，半径 = 轨迹在平面内的最大半径；
 *  - 默认极低透明度，选中天体所在平面增强显示
 *    （RenderScene3D.settings 没有独立开关，故始终低透明度显示）。
 *
 * 性能：平面拟合只在轨迹签名变化时执行；其余帧只更新可见性/透明度。
 */
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import type { RenderScene3D, SceneTrail3D } from "../game/viewTypes";
import { clamp, emptyOrbitPlaneFit, fitOrbitPlane, type OrbitPlaneFit } from "./math-3d";
import type { ViewerFrame } from "./shared-3d";
import { bodyIdFromSceneId, PALETTE_3D, lighten, safeHex, sceneColorForId } from "./theme-3d";

const MAX_PLANES = 6;
const RING_SEGMENTS = 72;

interface PlaneVisual {
  key: string;
  group: Group;
  disc: Mesh;
  ring: LineLoop;
  discMat: MeshBasicMaterial;
  ringMat: LineBasicMaterial;
  fit: OrbitPlaneFit;
  signature: string;
  colorHex: string;
}

function circleRingGeometry(segments: number): BufferGeometry {
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(a);
    positions[i * 3 + 1] = Math.sin(a);
    positions[i * 3 + 2] = 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return geometry;
}

function trailSignature(trail: SceneTrail3D): string {
  const points = trail.points;
  const len = points ? points.length : 0;
  if (len === 0) return "empty";
  const first = points[0];
  const last = points[len - 1];
  return (
    trail.id +
    "|" +
    len +
    "|" +
    (first.x.toFixed(3) + "," + first.y.toFixed(3) + "," + first.z.toFixed(3)) +
    "|" +
    (last.x.toFixed(3) + "," + last.y.toFixed(3) + "," + last.z.toFixed(3))
  );
}

export class OrbitPlanes3D {
  readonly group = new Group();
  private readonly visuals = new Map<string, PlaneVisual>();
  private readonly usedKeys = new Set<string>();
  private readonly discGeometry = new CircleGeometry(1, 96);
  private readonly ringGeometry = circleRingGeometry(RING_SEGMENTS);
  private readonly forward = new Vector3(0, 0, 1);
  private readonly normal = new Vector3(0, 1, 0);

  constructor() {
    this.group.name = "r3d-orbit-planes";
  }

  sync(scene: RenderScene3D, frame: ViewerFrame): void {
    this.usedKeys.clear();
    const sources: SceneTrail3D[] = [];
    const observed = scene.observedTrails ?? [];
    let observedEnough = false;
    for (let i = 0; i < observed.length; i++) {
      if ((observed[i]?.points?.length ?? 0) >= 3) {
        observedEnough = true;
        break;
      }
    }
    if (observedEnough) {
      for (let i = 0; i < observed.length; i++) if (observed[i]) sources.push(observed[i]);
    } else {
      const predicted = scene.predictedTrails ?? [];
      for (let i = 0; i < predicted.length; i++) if (predicted[i]) sources.push(predicted[i]);
    }

    for (let i = 0; i < sources.length && i < MAX_PLANES; i++) {
      const trail = sources[i];
      const key = "plane:" + trail.id;
      const signature = trailSignature(trail);
      const visual = this.ensure(key);
      this.usedKeys.add(key);
      if (visual.signature !== signature) {
        visual.signature = signature;
        const fit = fitOrbitPlane(trail.points ?? []);
        visual.fit = fit;
        if (fit.valid) {
          visual.group.position.set(fit.center.x, fit.center.y, fit.center.z);
          this.normal.set(fit.normal.x, fit.normal.y, fit.normal.z);
          visual.group.quaternion.setFromUnitVectors(this.forward, this.normal);
          visual.group.scale.setScalar(Math.max(1e-6, fit.radiusAU * 1.04));
        }
      }
      const fit = visual.fit;
      if (!fit.valid) {
        visual.group.visible = false;
        continue;
      }
      visual.group.visible = true;
      // 颜色按天体 id 映射：轨迹 id 可能是 "obs-A" / "pred-A" / "obs-planet"。
      const colorHex = sceneColorForId(trail.id, trail.color);
      if (visual.colorHex !== colorHex) {
        visual.colorHex = colorHex;
        visual.discMat.color.set(colorHex);
        visual.ringMat.color.set(lighten(colorHex, 0.25));
      }
      const selected = !!frame.selection && bodyIdFromSceneId(trail.id) === frame.selection;
      const baseAlpha = clamp(0.04 + (trail.alpha ?? 0.8) * 0.05, 0.035, 0.11);
      visual.discMat.opacity = selected ? baseAlpha * 2.8 : baseAlpha;
      visual.ringMat.opacity = selected ? 0.42 : 0.16;
    }

    this.visuals.forEach((visual, key) => {
      if (!this.usedKeys.has(key)) visual.group.visible = false;
    });
  }

  /**
   * 选中天体的轨道倾角（相对 X-Z 参考面，度）。
   * 由已拟合平面的法向量计算：inclination = acos(|n·Y|)，仅在平面有效时返回。
   * 这是"倾角标注"的数据来源，heightDataAvailable = false 时渲染层不会显示它。
   */
  inclinationDeg(bodyId: string): number | null {
    if (!bodyId) return null;
    let best: number | null = null;
    this.visuals.forEach((visual, key) => {
      if (!visual.fit.valid) return;
      if (bodyIdFromSceneId(key.replace("plane:", "")) !== bodyId) return;
      const ny = clamp(Math.abs(visual.fit.normal.y), 0, 1);
      const deg = (Math.acos(ny) * 180) / Math.PI;
      if (best === null || deg > best) best = deg;
    });
    return best;
  }

  private ensure(key: string): PlaneVisual {
    const existing = this.visuals.get(key);
    if (existing) return existing;
    const discMat = new MeshBasicMaterial({
      color: new Color(PALETTE_3D.orbitPlane),
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      toneMapped: false,
    });
    const disc = new Mesh(this.discGeometry, discMat);
    disc.frustumCulled = false;
    disc.renderOrder = 2;

    const ringMat = new LineBasicMaterial({
      color: new Color(lighten(PALETTE_3D.orbitPlane, 0.25)),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const ring = new LineLoop(this.ringGeometry, ringMat);
    ring.frustumCulled = false;
    ring.renderOrder = 3;

    const group = new Group();
    group.name = "r3d-orbit-plane-" + key;
    group.add(disc, ring);
    this.group.add(group);

    const visual: PlaneVisual = {
      key,
      group,
      disc,
      ring,
      discMat,
      ringMat,
      fit: emptyOrbitPlaneFit(),
      signature: "",
      colorHex: "",
    };
    this.visuals.set(key, visual);
    return visual;
  }

  dispose(): void {
    this.visuals.forEach((visual) => {
      try {
        this.group.remove(visual.group);
        visual.discMat.dispose();
        visual.ringMat.dispose();
      } catch {
        /* ignore */
      }
    });
    this.visuals.clear();
    this.usedKeys.clear();
    this.discGeometry.dispose();
    this.ringGeometry.dispose();
    this.group.clear();
  }
}
