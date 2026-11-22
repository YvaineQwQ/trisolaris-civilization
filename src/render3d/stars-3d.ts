/**
 * stars-3d.ts —— 恒星三维绘制：球体（近景贴图/程序化回退）+ 加法混合辉光 Sprite + 白热核心 + 选中环 + 拾取代理。
 *
 * 观感约定（硬科幻望远镜/全息投影，非卡通）：
 *  - 全景：核心球体用观测颜色，不加光照、不做卡通描边；辉光为程序化 CanvasTexture，加法混合；
 *  - 近景（V4）：球体换成高分段几何并贴上 public/textures/star-*.jpg|png 等距贴图（自发光材质），
 *    外圈保留日冕辉光；贴图惰性加载、失败时回退为观测色球体，未知恒星（known=false）不使用写实贴图；
 *  - 尺寸同时考虑 radiusAU 与相机距离：宏观尺度保证可见，近景由相机模块给出固定视觉半径；
 *  - 低置信度 / 未定位恒星显著变暗，不用外观伪造物理参数。
 *
 * 性能：全景几何体全局共享，材质每颗恒星一份；近景几何体仅按需创建一份；
 * 帧内只写 position / scale / quaternion / opacity / map 引用（纹理变化时才 needsUpdate）。
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type BufferGeometry,
} from "three";
import type { Vec3 } from "../core/math";
import type { RenderScene3D, SceneStar3D } from "../game/viewTypes";
import { clamp } from "./math-3d";
import type { BodyAnchor, ViewerFrame } from "./shared-3d";
import { starTextureId, textureLibrary3D } from "./texture-3d";
import {
  PALETTE_3D,
  SUN_RADIUS_AU,
  bodyColorForId,
  getGlowTexture,
  lighten,
  mixColors,
  safeHex,
} from "./theme-3d";

/** 恒星核心视觉半径（世界 AU）：按"角尺寸"自适应，同时给物理半径一个下限。 */
export function starWorldRadius(star: SceneStar3D, cameraDistance: number): number {
  const dist = Math.max(1e-3, Number.isFinite(cameraDistance) ? cameraDistance : 1);
  const phys = Number.isFinite(star.radiusAU) && star.radiusAU > 1e-6 ? star.radiusAU : SUN_RADIUS_AU;
  const ratio = clamp(phys / SUN_RADIUS_AU, 0.02, 30);
  // 角尺寸基准：太阳尺度约 0.0073 rad，按物理半径开方缓慢放大，保持恒星层次。
  const angular = 0.0045 + 0.0028 * Math.sqrt(ratio);
  const adaptive = dist * angular;
  const physical = phys * 2.4;
  return clamp(Math.max(adaptive, physical), dist * 0.0022, dist * 0.075);
}

/** 辉光 Sprite 世界宽度 = 核心半径 × 该系数（纹理核心占比约 8%，实际光晕约 5 倍核心）。 */
const GLOW_SCALE = 11;
/** 白热核心 Sprite 世界宽度系数。 */
const CORE_GLOW_SCALE = 2.8;
/** 近景球体分段（软件渲染降级）。 */
const NEAR_SEGMENTS_HIGH: [number, number] = [72, 48];
const NEAR_SEGMENTS_LOW: [number, number] = [40, 26];

interface StarVisual {
  root: Group;
  core: Mesh;
  coreMat: MeshBasicMaterial;
  glow: Sprite;
  glowMat: SpriteMaterial;
  inner: Sprite;
  innerMat: SpriteMaterial;
  ring: Mesh;
  ringMat: MeshBasicMaterial;
  pick: Mesh;
  anchor: BodyAnchor;
  color: string;
  radius: number;
  /** 当前核心几何体种类，避免每帧重复赋值。 */
  geometryKind: "far" | "near-high" | "near-low";
  /** 当前是否使用了贴图（用于回退与释放判断）。 */
  textured: boolean;
}

export class Stars3D {
  readonly group = new Group();
  private readonly coreGeometry = new SphereGeometry(1, 24, 16);
  private nearGeometryHigh: SphereGeometry | null = null;
  private nearGeometryLow: SphereGeometry | null = null;
  private readonly ringGeometry = new RingGeometry(0.9, 1.0, 56);
  private readonly pickGeometry = new SphereGeometry(1, 8, 6);
  private readonly pickMaterial = new MeshBasicMaterial({ visible: false });
  private readonly visuals = new Map<string, StarVisual>();
  private readonly anchorList: BodyAnchor[] = [];
  private readonly pickable: Mesh[] = [];
  private readonly ringColor = new Color(PALETTE_3D.selection);

  constructor() {
    this.group.name = "r3d-stars";
  }

  /** 当前帧的锚点（复用对象，勿持久引用）。 */
  anchors(): readonly BodyAnchor[] {
    return this.anchorList;
  }

  /** 当前帧的拾取代理球（复用数组，勿持久引用）。 */
  pickTargets(): readonly Mesh[] {
    return this.pickable;
  }

  /**
   * 同步恒星可视化。
   * @param scene 只读渲染数据（观测数据）
   * @param frame 本帧视图上下文（含近景目标 / 视觉半径 / 质量档）
   */
  sync(scene: RenderScene3D, frame: ViewerFrame): void {
    const stars = scene.stars ?? [];
    const seen = new Set<string>();
    const selection = frame.selection;
    const nearBody = frame.nearBody;
    this.anchorList.length = 0;
    this.pickable.length = 0;

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (!star || typeof star.id !== "string") continue;
      const id = star.id;
      seen.add(id);
      const isNear = nearBody === id;
      const colorHex = safeHex(star.color, bodyColorForId(id));
      const visual = this.ensure(id, colorHex);
      const selected = star.selected || selection === id;
      const known = !!star.known;
      const confidence = clamp(Number.isFinite(star.confidence) ? star.confidence : 0.3, 0, 1) * (known ? 1 : 0.55);
      const pos: Vec3 =
        Number.isFinite(star.pos?.x) && Number.isFinite(star.pos?.y) && Number.isFinite(star.pos?.z)
          ? star.pos
          : { x: 0, y: 0, z: 0 };
      const radius = isNear && frame.nearRadius > 0 ? frame.nearRadius : starWorldRadius(star, frame.cameraDistance);
      visual.radius = radius;

      // 近景中只保留目标天体的可视化，其余天体隐藏（它们在近景尺度下不可见，隐藏可省填充率）。
      visual.root.visible = !nearBody || isNear;
      if (!visual.root.visible) continue;

      visual.root.position.set(pos.x, pos.y, pos.z);
      visual.core.scale.setScalar(radius);

      // 颜色/材质随数据变化时才写（避免每帧触发 uniform/attribute 更新）。
      if (visual.color !== colorHex) {
        visual.color = colorHex;
        const shown = known ? lighten(colorHex, 0.18) : mixColors(colorHex, PALETTE_3D.muted, 0.45);
        visual.coreMat.color.set(shown);
        visual.glowMat.map = getGlowTexture(colorHex) ?? null;
        visual.glowMat.needsUpdate = true;
      }

      if (isNear) {
        // 近景：高分段 + 自发光等距贴图（仅在已知恒星上使用写实贴图，未知恒星保持程序化占位）。
        this.setGeometryKind(visual, frame.quality === "low" ? "near-low" : "near-high");
        const texId = starTextureId(id);
        // v1.4.1: 近景只保证“观测色/光谱”来自观测；表面颗粒纹理是通用美术资源，
        // 不冒充质量/半径等未测真值，因此不再因 known=false 而禁用贴图。
        const texture = texId ? textureLibrary3D.get(texId) : null;
        if (texture) {
          if (visual.coreMat.map !== texture) {
            visual.coreMat.map = texture;
            // 恒星贴图平均亮度很高（~240）；轻微暖色乘算让米粒组织/黑子在近景可见。
            visual.coreMat.color.set("#f4e2c4");
            visual.coreMat.needsUpdate = true;
            visual.textured = true;
          }
        } else if (visual.textured || visual.coreMat.map) {
          visual.coreMat.map = null;
          visual.coreMat.color.set(known ? lighten(colorHex, 0.18) : mixColors(colorHex, PALETTE_3D.muted, 0.45));
          visual.coreMat.needsUpdate = true;
          visual.textured = false;
        }
        visual.coreMat.opacity = known ? 1 : 0.62;
        visual.core.rotation.y = (frame.time * 0.055) % (Math.PI * 2);
        // 日冕：贴图球体之外一圈柔和光晕 + 白热核心，近景下收窄到球体边缘附近。
        const glowOpacity = clamp(0.42 + confidence * 0.22, 0.2, 0.8) * (0.94 + 0.06 * Math.sin(frame.time * 0.7 + i * 1.3));
        visual.glowMat.opacity = glowOpacity;
        const glowScale = radius * (known ? 5.2 : 6.4);
        visual.glow.scale.set(glowScale, glowScale, 1);
        visual.innerMat.opacity = clamp(0.42 + confidence * 0.2, 0.2, 0.68);
        const innerScale = radius * 2.15;
        visual.inner.scale.set(innerScale, innerScale, 1);
        visual.ring.visible = false;
      } else {
        this.setGeometryKind(visual, "far");
        if (visual.textured || visual.coreMat.map) {
          visual.coreMat.map = null;
          visual.coreMat.needsUpdate = true;
          visual.textured = false;
        }
        visual.core.rotation.y = 0;
        visual.coreMat.color.set(known ? lighten(colorHex, 0.18) : mixColors(colorHex, PALETTE_3D.muted, 0.45));
        visual.coreMat.opacity = known ? 0.98 : 0.5;

        const pulse = 0.9 + 0.1 * Math.sin(frame.time * 0.8 + i * 1.7);
        const glowOpacity = clamp((0.2 + confidence * 0.62) * pulse * (selected ? 1.18 : 1), 0.05, 1);
        visual.glowMat.opacity = glowOpacity;
        const glowScale = radius * GLOW_SCALE * (known ? 1 : 0.8) * (selected ? 1.08 : 1);
        visual.glow.scale.set(glowScale, glowScale, 1);
        visual.glow.renderOrder = 10;

        visual.innerMat.opacity = clamp(0.32 + confidence * 0.42, 0.1, 0.85) * (known ? 1 : 0.5);
        const innerScale = radius * CORE_GLOW_SCALE;
        visual.inner.scale.set(innerScale, innerScale, 1);
        visual.inner.renderOrder = 11;

        // 选中环：面向相机的细环 + 呼吸透明度。
        visual.ring.visible = selected;
        if (selected) {
          visual.ring.quaternion.copy(frame.camera.quaternion);
          const ringSize = radius * 2.6;
          visual.ring.scale.set(ringSize, ringSize, 1);
          visual.ringMat.opacity = 0.4 + 0.18 * Math.sin(frame.time * 2.2);
          visual.ringMat.color.copy(this.ringColor);
        }
      }

      // 拾取代理：全景模式至少约 2% 相机距离，保证细小恒星也易于点击；近景不参与拾取。
      if (!nearBody) {
        const pickRadius = Math.max(radius * 2.0, frame.cameraDistance * 0.02);
        visual.pick.scale.setScalar(pickRadius);
        // 拾取代理是 root 的子节点：保持在局部原点（root.position 已在天体世界坐标），
        // 否则会被叠加两次位置偏移，导致点击天体拾取不到（v1.3 遗留 bug，v1.4 修复）。
        visual.pick.position.set(0, 0, 0);
        visual.pick.userData.id = id;
        this.pickable.push(visual.pick);
      }

      visual.anchor.pos = pos;
      visual.anchor.worldRadius = radius;
      visual.anchor.color = colorHex;
      visual.anchor.id = id as BodyAnchor["id"];
      this.anchorList.push(visual.anchor);
    }

    // 场景中已不存在的恒星：隐藏并回收（几何共享，材质单独释放）。
    this.visuals.forEach((visual, id) => {
      if (seen.has(id)) return;
      visual.root.visible = false;
      this.disposeVisual(visual);
      this.visuals.delete(id);
    });
  }

  private ensure(id: string, colorHex: string): StarVisual {
    const existing = this.visuals.get(id);
    if (existing) {
      existing.root.visible = true;
      return existing;
    }
    const root = new Group();
    root.name = "r3d-star-" + id;

    const coreMat = new MeshBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity: 0.98,
      toneMapped: false,
    });
    const core = new Mesh(this.coreGeometry, coreMat);
    core.frustumCulled = false;

    const glowMat = new SpriteMaterial({
      map: getGlowTexture(colorHex) ?? null,
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const glow = new Sprite(glowMat);
    glow.frustumCulled = false;
    glow.renderOrder = 10;

    const innerMat = new SpriteMaterial({
      map: getGlowTexture("#ffffff") ?? null,
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const inner = new Sprite(innerMat);
    inner.frustumCulled = false;
    inner.renderOrder = 11;

    const ringMat = new MeshBasicMaterial({
      color: new Color(PALETTE_3D.selection),
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
    ring.visible = false;
    ring.renderOrder = 12;

    const pick = new Mesh(this.pickGeometry, this.pickMaterial);
    pick.visible = true;
    pick.frustumCulled = false;
    pick.userData.id = id;

    root.add(core, glow, inner, ring, pick);
    this.group.add(root);

    const anchor: BodyAnchor = {
      id: id as BodyAnchor["id"],
      pos: { x: 0, y: 0, z: 0 },
      worldRadius: 0,
      color: colorHex,
    };
    const visual: StarVisual = {
      root,
      core,
      coreMat,
      glow,
      glowMat,
      inner,
      innerMat,
      ring,
      ringMat,
      pick,
      anchor,
      color: colorHex,
      radius: 0,
      geometryKind: "far",
      textured: false,
    };
    this.visuals.set(id, visual);
    return visual;
  }

  /** 按需切换核心球体分段（近景高模只创建一份，所有恒星共享）。 */
  private setGeometryKind(visual: StarVisual, kind: StarVisual["geometryKind"]): void {
    if (visual.geometryKind === kind) return;
    visual.geometryKind = kind;
    visual.core.geometry = this.geometryFor(kind);
  }

  private geometryFor(kind: StarVisual["geometryKind"]): SphereGeometry {
    if (kind === "near-high") {
      if (!this.nearGeometryHigh) this.nearGeometryHigh = new SphereGeometry(1, NEAR_SEGMENTS_HIGH[0], NEAR_SEGMENTS_HIGH[1]);
      return this.nearGeometryHigh;
    }
    if (kind === "near-low") {
      if (!this.nearGeometryLow) this.nearGeometryLow = new SphereGeometry(1, NEAR_SEGMENTS_LOW[0], NEAR_SEGMENTS_LOW[1]);
      return this.nearGeometryLow;
    }
    return this.coreGeometry;
  }

  private disposeVisual(visual: StarVisual): void {
    try {
      this.group.remove(visual.root);
      visual.coreMat.dispose();
      visual.glowMat.dispose();
      visual.innerMat.dispose();
      visual.ringMat.dispose();
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    this.visuals.forEach((visual) => this.disposeVisual(visual));
    this.visuals.clear();
    this.anchorList.length = 0;
    this.pickable.length = 0;
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();
    this.pickGeometry.dispose();
    this.pickMaterial.dispose();
    const nearGeometries: BufferGeometry[] = [];
    if (this.nearGeometryHigh) nearGeometries.push(this.nearGeometryHigh);
    if (this.nearGeometryLow) nearGeometries.push(this.nearGeometryLow);
    for (const geometry of nearGeometries) {
      try {
        geometry.dispose();
      } catch {
        /* ignore */
      }
    }
    this.nearGeometryHigh = null;
    this.nearGeometryLow = null;
    this.group.clear();
  }
}