/**
 * pulses-3d.ts —— 危险/事件脉冲的三维指示器：面向相机的加法混合细环 + 中心辉光。
 *
 * 只表达"此处有事件"这一观测事实：位置严格取 ScenePulse3D.pos，颜色/强度来自 severity，
 * 不做屏幕空间缩放伪造物理量。数量少（一般 ≤ 8），每帧只更新 transform/opacity。
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
} from "three";
import type { ScenePulse3D } from "../game/viewTypes";
import { clamp } from "./math-3d";
import type { ViewerFrame } from "./shared-3d";
import { getGlowTexture, hash01, lighten, safeHex } from "./theme-3d";

interface PulseVisual {
  key: string;
  group: Group;
  ring: Mesh;
  ringMat: MeshBasicMaterial;
  glow: Sprite;
  glowMat: SpriteMaterial;
  colorHex: string;
  phase: number;
}

export class Pulses3D {
  readonly group = new Group();
  private readonly ringGeometry = new RingGeometry(0.84, 1, 48);
  private readonly visuals = new Map<string, PulseVisual>();
  private readonly usedKeys = new Set<string>();

  constructor() {
    this.group.name = "r3d-pulses";
  }

  sync(pulses: readonly ScenePulse3D[] | null | undefined, frame: ViewerFrame): void {
    this.usedKeys.clear();
    if (pulses) {
      for (let i = 0; i < pulses.length; i++) {
        const pulse = pulses[i];
        if (!pulse) continue;
        if (!Number.isFinite(pulse.pos?.x) || !Number.isFinite(pulse.pos?.y) || !Number.isFinite(pulse.pos?.z)) continue;
        this.syncPulse(pulse, frame);
      }
    }
    this.visuals.forEach((visual, key) => {
      if (!this.usedKeys.has(key)) visual.group.visible = false;
    });
  }

  private syncPulse(pulse: ScenePulse3D, frame: ViewerFrame): void {
    const key = "pulse:" + pulse.id;
    const visual = this.ensure(key);
    this.usedKeys.add(key);
    visual.group.visible = true;
    visual.group.position.set(pulse.pos.x, pulse.pos.y, pulse.pos.z);
    visual.group.quaternion.copy(frame.camera.quaternion);

    const colorHex = safeHex(pulse.color, "#ff7a5b");
    if (visual.colorHex !== colorHex) {
      visual.colorHex = colorHex;
      visual.ringMat.color.set(colorHex);
      visual.glowMat.map = getGlowTexture(colorHex) ?? null;
      visual.glowMat.needsUpdate = true;
    }
    const severity = clamp(Number.isFinite(pulse.severity) ? pulse.severity : 0.5, 0, 1);
    const base = Math.max(frame.cameraDistance * 0.018, frame.viewRadius * 0.012) * (0.7 + severity * 0.7);
    const breathe = 0.85 + 0.3 * Math.sin(frame.time * 2.6 + visual.phase);
    const scale = base * breathe;
    visual.ring.scale.set(scale, scale, 1);
    visual.glow.scale.set(scale * 2.2, scale * 2.2, 1);
    visual.ringMat.opacity = clamp(0.25 + severity * 0.5, 0.2, 0.9);
    visual.glowMat.opacity = clamp(0.12 + severity * 0.3, 0.1, 0.55);
  }

  private ensure(key: string): PulseVisual {
    const existing = this.visuals.get(key);
    if (existing) return existing;
    const colorHex = "#ff7a5b";
    const ringMat = new MeshBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const ring = new Mesh(this.ringGeometry, ringMat);
    ring.frustumCulled = false;
    ring.renderOrder = 20;

    const glowMat = new SpriteMaterial({
      map: getGlowTexture(colorHex) ?? null,
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const glow = new Sprite(glowMat);
    glow.frustumCulled = false;
    glow.renderOrder = 19;

    const group = new Group();
    group.name = "r3d-" + key;
    group.add(ring, glow);
    this.group.add(group);
    const visual: PulseVisual = {
      key,
      group,
      ring,
      ringMat,
      glow,
      glowMat,
      colorHex: "",
      phase: hash01(key, 11) * Math.PI * 2,
    };
    this.visuals.set(key, visual);
    return visual;
  }

  dispose(): void {
    this.visuals.forEach((visual) => {
      try {
        this.group.remove(visual.group);
        visual.ringMat.dispose();
        visual.glowMat.dispose();
      } catch {
        /* ignore */
      }
    });
    this.visuals.clear();
    this.usedKeys.clear();
    this.ringGeometry.dispose();
    this.group.clear();
  }
}
