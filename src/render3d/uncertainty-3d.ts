/**
 * uncertainty-3d.ts —— 1σ 位置不确定范围：半透明加法混合球壳 + 线框内壳。
 *
 * 观测限制：球的半径严格取 RenderScene3D.uncertaintyClouds[*].radiusAU / planetUncertainty.radiusAU，
 * 不做视觉最小半径伪造；半径很小、几乎不可见时也保持真实，由标签与选中环提供读数。
 *
 * 性能：球几何共享，池化复用；帧内只写 position / scale / opacity / color。
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import type { RenderScene3D, SceneCloud3D } from "../game/viewTypes";
import { clamp } from "./math-3d";
import type { ViewerFrame } from "./shared-3d";
import { bodyIdFromSceneId, lighten, safeHex } from "./theme-3d";

interface CloudVisual {
  key: string;
  group: Group;
  shell: Mesh;
  wire: Mesh;
  shellMat: MeshBasicMaterial;
  wireMat: MeshBasicMaterial;
  colorHex: string;
}

export class Uncertainty3D {
  readonly group = new Group();
  private readonly sphereGeometry = new SphereGeometry(1, 24, 16);
  private readonly visuals = new Map<string, CloudVisual>();
  private readonly usedKeys = new Set<string>();

  constructor() {
    this.group.name = "r3d-uncertainty";
  }

  sync(
    clouds: readonly SceneCloud3D[] | null | undefined,
    planetCloud: SceneCloud3D | null | undefined,
    frame: ViewerFrame,
  ): void {
    this.usedKeys.clear();
    if (frame.settings.showUncertainty) {
      if (clouds) {
        for (let i = 0; i < clouds.length; i++) {
          if (clouds[i]) {
            const selected = !!frame.selection && bodyIdFromSceneId(clouds[i].id) === frame.selection;
            this.syncCloud("star:" + clouds[i].id, clouds[i], frame, selected);
          }
        }
      }
      if (planetCloud) {
        this.syncCloud("planet", planetCloud, frame, frame.selection === "planet");
      }
    }
    this.visuals.forEach((visual, key) => {
      if (!this.usedKeys.has(key)) visual.group.visible = false;
    });
  }

  private syncCloud(key: string, cloud: SceneCloud3D, frame: ViewerFrame, selected: boolean): void {
    const radius = Number.isFinite(cloud.radiusAU) ? cloud.radiusAU : 0;
    if (!(radius > 0) || !Number.isFinite(cloud.center?.x) || !Number.isFinite(cloud.center?.y) || !Number.isFinite(cloud.center?.z)) {
      return;
    }
    const visual = this.ensure(key);
    this.usedKeys.add(key);
    visual.group.visible = true;
    visual.group.position.set(cloud.center.x, cloud.center.y, cloud.center.z);
    visual.group.scale.setScalar(radius);

    const colorHex = safeHex(cloud.color, "#4fa8ff");
    if (visual.colorHex !== colorHex) {
      visual.colorHex = colorHex;
      visual.shellMat.color.set(colorHex);
      visual.wireMat.color.set(lighten(colorHex, 0.3));
    }
    const alpha = clamp(Number.isFinite(cloud.alpha) ? cloud.alpha : 0.35, 0, 1);
    visual.shellMat.opacity = clamp(0.05 + alpha * 0.26, 0.035, 0.4) * (selected ? 1.9 : 1);
    visual.wireMat.opacity = clamp(0.02 + alpha * 0.14, 0.012, 0.22) * (selected ? 1.7 : 1);
  }

  private ensure(key: string): CloudVisual {
    const existing = this.visuals.get(key);
    if (existing) return existing;
    const colorHex = "#4fa8ff";
    const shellMat = new MeshBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const shell = new Mesh(this.sphereGeometry, shellMat);
    shell.frustumCulled = false;
    shell.renderOrder = 4;

    const wireMat = new MeshBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      depthTest: true,
      wireframe: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const wire = new Mesh(this.sphereGeometry, wireMat);
    wire.frustumCulled = false;
    wire.renderOrder = 5;

    const group = new Group();
    group.name = "r3d-cloud-" + key;
    group.add(shell, wire);
    this.group.add(group);
    const visual: CloudVisual = { key, group, shell, wire, shellMat, wireMat, colorHex: "" };
    this.visuals.set(key, visual);
    return visual;
  }

  dispose(): void {
    this.visuals.forEach((visual) => {
      try {
        this.group.remove(visual.group);
        visual.shellMat.dispose();
        visual.wireMat.dispose();
      } catch {
        /* ignore */
      }
    });
    this.visuals.clear();
    this.usedKeys.clear();
    this.sphereGeometry.dispose();
    this.group.clear();
  }
}
