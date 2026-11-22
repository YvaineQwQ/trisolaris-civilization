/**
 * planet-3d.ts —— 母星三维绘制：昼面贴图 + 云层 + 夜面灯光 + 大气 Fresnel 边缘光。
 *
 * 观测边界：只使用 RenderScene3D.planet 提供的观测估计（温度/宜居度/半径/不确定度），
 * 缺失时用中性岩质色，不伪造宜居结论；近景贴图是美术资源（texture-art），不参与数据计算。
 *
 * 远近两套呈现：
 *  - 全景：低分段球体 + 观测色调 + 柔和辉光 Sprite + 最近恒星方向定向光，单球极低成本；
 *  - 近景：高分段球体贴 day/night 贴图（自发光夜面），独立云层壳缓慢相对漂移，
 *          外层大气 Fresnel 壳（加法混合 BackSide）；海洋高光由 day 贴图程序化推导的
 *          specularMap 提供；贴图缺失时全部回退到观测色调材质，不黑屏。
 *
 * 性能：几何体共享；云层/大气壳只在近景可见；帧内只写 transform / opacity / 少量 uniform。
 */
import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  NormalBlending,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from "three";
import type { Vec3 } from "../core/math";
import type { RenderScene3D, ScenePlanet3D, SceneStar3D } from "../game/viewTypes";
import { clamp, vNorm3, vSub3 } from "./math-3d";
import type { BodyAnchor, ViewerFrame } from "./shared-3d";
import { deriveOceanSpecularMap, textureHasAlpha, textureLibrary3D } from "./texture-3d";
import {
  AU_KM,
  PALETTE_3D,
  getGlowTexture,
  lighten,
  mixColors,
  safeHex,
} from "./theme-3d";

/** 母星视觉半径（世界 AU）：以角尺寸为主，兼顾真实半径下限（全景模式）。 */
export function planetWorldRadius(planet: ScenePlanet3D, cameraDistance: number): number {
  const dist = Math.max(1e-3, Number.isFinite(cameraDistance) ? cameraDistance : 1);
  const physAU = Number.isFinite(planet.radiusKm) && planet.radiusKm > 1 ? planet.radiusKm / AU_KM : 4.26e-5;
  const adaptive = dist * 0.0052;
  const physical = physAU * 16;
  return clamp(Math.max(adaptive, physical), dist * 0.0018, dist * 0.06);
}

/** 温度 + 宜居度 → 母星基础色调（只做观测数据的可视化，不替代环境模型）。 */
export function planetTone(tempC: number | null, habitability: number | null): string {
  let base = "#93aebf";
  if (tempC !== null && Number.isFinite(tempC)) {
    if (tempC <= -80) base = "#8fb9d8";
    else if (tempC <= -25) base = "#a8cbe2";
    else if (tempC >= 150) base = "#d9885f";
    else if (tempC >= 70) base = "#c9a575";
    else base = "#9fb9c6";
  }
  if (habitability !== null && Number.isFinite(habitability)) {
    const h = clamp(habitability, 0, 1);
    base = mixColors(base, h >= 0.5 ? "#6fe0b0" : "#b5a98c", 0.18 + h * 0.5);
  }
  return base;
}

const FAR_SEGMENTS: [number, number] = [32, 24];
const NEAR_SEGMENTS_HIGH: [number, number] = [96, 64];
const NEAR_SEGMENTS_LOW: [number, number] = [56, 36];

const ATMOSPHERE_VERTEX = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vec4 viewPosition = viewMatrix * worldPosition;
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize( mat3( modelMatrix ) * normal );
  gl_Position = projectionMatrix * viewPosition;
}
`;

const ATMOSPHERE_FRAGMENT = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 viewDir = normalize( cameraPosition - vWorldPosition );
  float rim = 1.0 - clamp( dot( normalize( vWorldNormal ), viewDir ), 0.0, 1.0 );
  float glow = pow( rim, 3.1 ) * uIntensity;
  gl_FragColor = vec4( uColor * glow, glow );
}
`;

interface ShaderUniforms {
  uniforms: { uNightDirView?: { value: Vector3 } };
}

export class Planet3D {
  readonly group = new Group();
  readonly pickables: Mesh[] = [];

  private farGeometry: SphereGeometry | null = null;
  private nearGeometryHigh: SphereGeometry | null = null;
  private nearGeometryLow: SphereGeometry | null = null;
  private geometryKind: "far" | "near-high" | "near-low" | null = null;

  private readonly ringGeometry = new RingGeometry(0.9, 1.0, 56);
  private readonly pickGeometry = new SphereGeometry(1, 8, 6);
  private readonly pickMaterial = new MeshBasicMaterial({ visible: false });

  private readonly surfaceMat: MeshPhongMaterial;
  private readonly surface: Mesh;
  private readonly cloudsMat: MeshPhongMaterial;
  private readonly clouds: Mesh;
  private readonly atmosphereMat: ShaderMaterial;
  private readonly atmosphere: Mesh;
  private readonly glowMat: SpriteMaterial;
  private readonly glow: Sprite;
  private readonly ringMat: MeshBasicMaterial;
  private readonly ring: Mesh;
  private readonly pick: Mesh;
  private readonly light: DirectionalLight;
  private readonly ambient: AmbientLight;

  private readonly anchor: BodyAnchor = {
    id: "planet",
    pos: { x: 0, y: 0, z: 0 },
    worldRadius: 0,
    color: PALETTE_3D.planet,
  };
  private lastTone = "";
  private visible = false;
  private nearMode = false;
  private textured = false;
  private cloudsTextured = false;
  private oceanSpecular: Texture | null = null;
  /** specularMap 是否为本模块程序化生成的纹理（true 才由本模块 dispose）。 */
  private oceanSpecularOwned = false;
  private dayTexture: Texture | null = null;
  private nightTexture: Texture | null = null;
  private cloudsTexture: Texture | null = null;
  private shaderRef: ShaderUniforms | null = null;
  private readonly nightDirView = new Vector3();
  private readonly tmpVec = new Vector3();

  constructor() {
    this.group.name = "r3d-planet";

    // 昼面：Phong 材质（海洋高光）+ 夜面自发光贴图（通过 onBeforeCompile 注入夜面遮罩）。
    this.surfaceMat = new MeshPhongMaterial({
      color: new Color("#93aebf"),
      specular: new Color("#b9d6e8"),
      shininess: 46,
      emissive: new Color("#0c2028"),
      emissiveIntensity: 0.16,
      toneMapped: false,
    });
    this.surfaceMat.customProgramCacheKey = () => "r3d-planet-night-mask-v1";
    this.surfaceMat.onBeforeCompile = (shader) => {
      try {
        shader.uniforms.uNightDirView = { value: this.nightDirView };
        shader.fragmentShader = "uniform vec3 uNightDirView;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\n\tfloat r3dNightMask = 1.0 - smoothstep( -0.28, 0.12, dot( nonPerturbedNormal, uNightDirView ) );",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= r3dNightMask;",
        );
        this.shaderRef = shader as unknown as ShaderUniforms;
      } catch {
        this.shaderRef = null;
      }
    };
    this.surface = new Mesh(this.geometryFor("far"), this.surfaceMat);
    this.surface.frustumCulled = false;
    this.surface.renderOrder = 0;

    this.cloudsMat = new MeshPhongMaterial({
      color: new Color("#ffffff"),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.clouds = new Mesh(this.surface.geometry, this.cloudsMat);
    this.clouds.frustumCulled = false;
    this.clouds.visible = false;
    this.clouds.renderOrder = 4;

    this.atmosphereMat = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(PALETTE_3D.planet) },
        uIntensity: { value: 0.9 },
      },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
    });
    this.atmosphere = new Mesh(this.surface.geometry, this.atmosphereMat);
    this.atmosphere.frustumCulled = false;
    this.atmosphere.visible = false;
    this.atmosphere.renderOrder = 6;

    this.glowMat = new SpriteMaterial({
      map: getGlowTexture(PALETTE_3D.planet) ?? null,
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.glow = new Sprite(this.glowMat);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 8;

    this.ringMat = new MeshBasicMaterial({
      color: new Color(PALETTE_3D.selection),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.ring = new Mesh(this.ringGeometry, this.ringMat);
    this.ring.frustumCulled = false;
    this.ring.visible = false;
    this.ring.renderOrder = 12;

    this.light = new DirectionalLight(new Color(0xffffff), 2.4);
    this.light.position.set(0, 0, 6);
    this.light.target.position.set(0, 0, 0);
    this.ambient = new AmbientLight(new Color(0x2a3f57), 0.75);

    this.pick = new Mesh(this.pickGeometry, this.pickMaterial);
    this.pick.userData.id = "planet";
    this.pick.frustumCulled = false;

    this.group.add(this.surface, this.clouds, this.atmosphere, this.glow, this.ring, this.pick, this.light, this.light.target, this.ambient);
    this.group.visible = false;
  }

  /** 当前帧母星锚点（不可见时返回 null）。 */
  anchorOrNull(): BodyAnchor | null {
    return this.visible ? this.anchor : null;
  }

  /** 近景是否使用贴图（QA/HUD 提示用）。 */
  get textureReady(): boolean {
    return this.textured;
  }

  sync(scene: RenderScene3D, frame: ViewerFrame): void {
    const planet = scene.planet;
    this.pickables.length = 0;
    if (!planet || !Number.isFinite(planet.pos?.x) || !Number.isFinite(planet.pos?.y) || !Number.isFinite(planet.pos?.z)) {
      this.visible = false;
      this.group.visible = false;
      return;
    }
    const near = frame.nearBody === "planet";
    this.nearMode = near;
    this.visible = true;
    this.group.visible = true;

    const radius = near && frame.nearRadius > 0 ? frame.nearRadius : planetWorldRadius(planet, frame.cameraDistance);
    this.group.position.set(planet.pos.x, planet.pos.y, planet.pos.z);
    this.surface.scale.setScalar(radius);

    this.setGeometryKind(near ? (frame.quality === "low" ? "near-low" : "near-high") : "far");

    // 自转：昼面球体缓慢自转；云层相对球体再慢一点漂移。
    const surfaceSpin = near ? 0.1 : 0.12;
    this.surface.rotation.y = (frame.time * surfaceSpin) % (Math.PI * 2);

    // 最近恒星方向 → 定向光（颜色取恒星色，强度固定：只表达方向性，不冒充绝对亮度）。
    const nearest = this.nearestStar(planet.pos, scene.stars ?? []);
    let starDir: Vec3 = { x: 0, y: 0, z: 1 };
    if (nearest) {
      const dir = vNorm3(vSub3(nearest.pos, planet.pos));
      if (dir.x !== 0 || dir.y !== 0 || dir.z !== 0) {
        starDir = dir;
        this.light.position.set(dir.x * 6, dir.y * 6, dir.z * 6);
      }
      const starColor = new Color(safeHex(nearest.color, "#fff3dd"));
      if (near) {
        // 近景“观测补光”：保留恒星色相，但向中性白混合，保证海洋/陆地/云层细节可辨；
        // 这不是伪造物理亮度，只是观察模式的照明选择（信息卡仍显示真实观测值）。
        this.light.color.copy(starColor.lerp(new Color(0xffffff), 0.68));
        this.light.intensity = 2.35;
      } else {
        this.light.color.copy(starColor);
        this.light.intensity = nearest.known ? 2.6 : 1.9;
      }
    }
    this.ambient.intensity = near ? 0.58 : 0.75;
    this.cloudsMat.opacity = near ? 0.4 : 0.62;

    const tone = planetTone(planet.tempC, planet.habitability);
    const selected = planet.selected || frame.selection === "planet";
    if (tone !== this.lastTone) {
      this.lastTone = tone;
      this.atmosphereMat.uniforms.uColor = { value: new Color(lighten(tone, 0.34)) };
      this.anchor.color = tone;
    }
    this.anchor.color = tone;

    if (near) {
      this.applyNearMaterials(planet, frame, radius);
    } else {
      this.applyFarMaterials(tone, selected);
    }

    // 夜面遮罩方向：恒星方向变换到相机视图空间（Phong 片元的 nonPerturbedNormal 也在视图空间）。
    if (this.shaderRef?.uniforms.uNightDirView) {
      this.tmpVec.set(starDir.x, starDir.y, starDir.z);
      try {
        this.tmpVec.transformDirection(frame.camera.matrixWorldInverse);
      } catch {
        /* ignore */
      }
      this.shaderRef.uniforms.uNightDirView.value.copy(this.tmpVec);
    }

    // 大气壳 / 柔和辉光
    this.atmosphere.visible = near;
    this.glow.visible = !near;
    if (near) {
      this.atmosphere.scale.setScalar(radius * 1.045);
      this.atmosphereMat.uniforms.uIntensity = { value: clamp(0.3 + (planet.habitability ?? 0.25) * 0.32, 0.22, 0.62) };
    } else if (this.clouds.visible) {
      this.clouds.visible = false;
    }
    const glowScale = radius * 5.6;
    this.glow.scale.set(glowScale, glowScale, 1);
    this.glowMat.opacity = clamp(0.22 + (planet.habitability ?? 0.2) * 0.26 + (selected ? 0.1 : 0), 0.14, 0.6);

    this.ring.visible = selected && !near;
    if (this.ring.visible) {
      this.ring.quaternion.copy(frame.camera.quaternion);
      const ringSize = radius * 2.8;
      this.ring.scale.set(ringSize, ringSize, 1);
      this.ringMat.opacity = 0.45 + 0.18 * Math.sin(frame.time * 2.2);
    }

    if (!near) {
      const pickRadius = Math.max(radius * 2.2, frame.cameraDistance * 0.024);
      this.pick.scale.setScalar(pickRadius);
      this.pick.position.set(0, 0, 0);
      this.pickables.push(this.pick);
    }

    this.anchor.pos = planet.pos;
    this.anchor.worldRadius = radius;
  }

  /** 近景材质：day / night / specular / clouds 贴图就绪时逐项启用，缺项自动回退。 */
  private applyNearMaterials(planet: ScenePlanet3D, frame: ViewerFrame, radius: number): void {
    const day = textureLibrary3D.get("planet-day");
    if (day) {
      if (this.dayTexture !== day) {
        this.dayTexture = day;
        this.surfaceMat.map = day;
        this.surfaceMat.color.set("#ffffff");
        this.surfaceMat.needsUpdate = true;
        // 优先使用 texture-art 额外提供的海洋遮罩（白=水）；缺失时由昼面贴图程序化推导。
        const waterMask = textureLibrary3D.get("planet-water-mask");
        if (this.oceanSpecularOwned) {
          try {
            this.oceanSpecular?.dispose();
          } catch {
            /* ignore */
          }
          this.oceanSpecular = null;
          this.oceanSpecularOwned = false;
        }
        this.oceanSpecular = waterMask ?? deriveOceanSpecularMap(day.image);
        this.oceanSpecularOwned = !waterMask && !!this.oceanSpecular;
        if (this.oceanSpecular) {
          this.surfaceMat.specularMap = this.oceanSpecular;
          this.surfaceMat.specular.set("#cfe6f4");
          this.surfaceMat.shininess = 52;
        }
        this.textured = true;
      }
    } else if (this.textured) {
      this.textured = false;
      this.surfaceMat.map = null;
      this.surfaceMat.needsUpdate = true;
    }
    if (!day) {
      // 贴图未就绪：使用观测色调的哑光表面（保持可见、不黑屏）。
      this.surfaceMat.color.set(this.lastTone || planetTone(planet.tempC, planet.habitability));
      this.surfaceMat.emissive.set(mixColors(this.lastTone || PALETTE_3D.planet, "#06121a", 0.55));
      this.surfaceMat.emissiveIntensity = 0.2;
    } else {
      this.surfaceMat.emissive.set("#ffffff");
      this.surfaceMat.emissiveIntensity = 0.85;
      const night = textureLibrary3D.get("planet-night");
      if (night) {
        if (this.nightTexture !== night) {
          this.nightTexture = night;
          this.surfaceMat.emissiveMap = night;
          this.surfaceMat.needsUpdate = true;
        }
      } else if (this.nightTexture) {
        this.nightTexture = null;
        this.surfaceMat.emissiveMap = null;
        this.surfaceMat.needsUpdate = true;
      }
    }

    const clouds = textureLibrary3D.get("planet-clouds");
    const cloudsRadius = radius * 1.012;
    if (clouds) {
      if (this.cloudsTexture !== clouds) {
        this.cloudsTexture = clouds;
        this.cloudsMat.map = clouds;
        this.cloudsMat.needsUpdate = true;
        const hasAlpha = textureHasAlpha(clouds);
        this.cloudsMat.transparent = true;
        this.cloudsMat.depthWrite = false;
        this.cloudsMat.blending = hasAlpha ? NormalBlending : AdditiveBlending;
        this.cloudsMat.opacity = hasAlpha ? 0.72 : 0.45;
        if (!hasAlpha) this.cloudsMat.color.set("#ffffff");
      }
      this.clouds.visible = true;
      this.clouds.scale.setScalar(cloudsRadius);
      this.clouds.rotation.y = (frame.time * 0.135) % (Math.PI * 2);
      this.cloudsTextured = true;
    } else {
      this.clouds.visible = false;
      this.cloudsTextured = false;
    }
  }

  /** 全景材质：观测色调 + 噪声感辉光（保持低开销）。 */
  private applyFarMaterials(tone: string, selected: boolean): void {
    if (this.textured || this.dayTexture) {
      this.textured = false;
      this.dayTexture = null;
      this.nightTexture = null;
      this.cloudsTexture = null;
      this.surfaceMat.map = null;
      this.surfaceMat.emissiveMap = null;
      this.surfaceMat.specularMap = null;
      this.oceanSpecular = null;
      this.surfaceMat.needsUpdate = true;
    }
    this.surfaceMat.color.set(tone);
    this.surfaceMat.emissive.set(mixColors(tone, "#06121a", 0.55));
    this.surfaceMat.emissiveIntensity = selected ? 0.26 : 0.16;
    this.surfaceMat.specular.set("#2b4a5e");
    this.surfaceMat.shininess = 18;
    this.clouds.visible = false;
    this.cloudsTextured = false;
  }

  private setGeometryKind(kind: "far" | "near-high" | "near-low"): void {
    if (this.geometryKind === kind) return;
    this.geometryKind = kind;
    const geometry = this.geometryFor(kind);
    this.surface.geometry = geometry;
    this.clouds.geometry = geometry;
    this.atmosphere.geometry = geometry;
  }

  private geometryFor(kind: "far" | "near-high" | "near-low"): SphereGeometry {
    if (kind === "near-high") {
      if (!this.nearGeometryHigh) this.nearGeometryHigh = new SphereGeometry(1, NEAR_SEGMENTS_HIGH[0], NEAR_SEGMENTS_HIGH[1]);
      return this.nearGeometryHigh;
    }
    if (kind === "near-low") {
      if (!this.nearGeometryLow) this.nearGeometryLow = new SphereGeometry(1, NEAR_SEGMENTS_LOW[0], NEAR_SEGMENTS_LOW[1]);
      return this.nearGeometryLow;
    }
    if (!this.farGeometry) this.farGeometry = new SphereGeometry(1, FAR_SEGMENTS[0], FAR_SEGMENTS[1]);
    return this.farGeometry;
  }

  private nearestStar(pos: Vec3, stars: readonly SceneStar3D[]): SceneStar3D | null {
    let best: SceneStar3D | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (!s || !Number.isFinite(s.pos?.x) || !Number.isFinite(s.pos?.y) || !Number.isFinite(s.pos?.z)) continue;
      const d = (s.pos.x - pos.x) ** 2 + (s.pos.y - pos.y) ** 2 + (s.pos.z - pos.z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  dispose(): void {
    const geometries = [this.farGeometry, this.nearGeometryHigh, this.nearGeometryLow, this.ringGeometry, this.pickGeometry];
    for (const geometry of geometries) {
      try {
        geometry?.dispose();
      } catch {
        /* ignore */
      }
    }
    this.farGeometry = null;
    this.nearGeometryHigh = null;
    this.nearGeometryLow = null;
    this.pickMaterial.dispose();
    this.surfaceMat.dispose();
    this.cloudsMat.dispose();
    this.atmosphereMat.dispose();
    this.glowMat.dispose();
    this.ringMat.dispose();
    if (this.oceanSpecularOwned) {
      try {
        this.oceanSpecular?.dispose();
      } catch {
        /* ignore */
      }
    }
    this.oceanSpecular = null;
    this.oceanSpecularOwned = false;
    this.shaderRef = null;
    this.group.clear();
    this.pickables.length = 0;
  }
}