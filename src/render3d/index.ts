/**
 * index.ts —— 3D 辅助视图（Three.js）入口，实现冻结契约 SceneRenderer3D：
 *   createRenderer3D(options: Renderer3DOptions): SceneRenderer3D
 *   resize() / frame(scene, dt) / destroy() / resetView() / setViewPreset(preset)
 *
 * 数据边界（docs/ARCH_3D.md）：只消费 RenderScene3D（观测数据），不 import physics / game 模拟模块；
 * 3D 视图与 2D 主视图共享同一份观测数据，不计算天体运动、不私藏第二套天体表。
 *
 * 相机交互：左键旋转 / 滚轮缩放 / 右键或中键平移 / 双击聚焦；预设俯视 / 侧视 / 自由。
 * 渲染循环由 UI 主循环调用 frame() 驱动，本模块不常驻 RAF；仅在交互后（主循环可能已暂停时）
 * 通过单次 requestAnimationFrame 补一帧。
 *
 * 降级策略：
 *  - 无 document / WebGL 不可用（jsdom、无 GPU）→ 返回 no-op 实现，所有方法安全无操作；
 *  - 容器暂时没有尺寸 → 使用上一次有效尺寸（初始 640×360）继续初始化，等 ResizeObserver 补齐；
 *  - 帧渲染连续异常 → 停止绘制（与 2D 渲染器一致的降级保护），不拖垮游戏主循环。
 */
import {
  Color,
  Mesh,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type { Vec3 } from "../core/math";
import type { RenderScene3D, Renderer3DOptions, SceneRenderer3D, ViewSettings } from "../game/viewTypes";
import { OrbitCamera3D, type ViewPreset3D } from "./camera-3d";
import { DistanceLines3D } from "./distance-lines-3d";
import "./hud-print.css";
import { createHud3D, type Hud3D, type Hud3DNearView } from "./hud-3d";
import { createLabelOverlay, type LabelOverlay } from "./labels-3d";
import { clamp, pixelsPerWorld, projectToScreen, vDist3, vMid3 } from "./math-3d";
import { buildNearInfo, nearOrientationFor, nearSurfaceRadiusFor } from "./near-view-3d";
import { OrbitPlanes3D } from "./orbit-plane-3d";
import { Picker3D } from "./picking";
import { Planet3D } from "./planet-3d";
import { Pulses3D } from "./pulses-3d";
import { createSceneRoot, type SceneRoot } from "./scene-root";
import {
  DEFAULT_VIEW_SETTINGS_3D,
  type BodyAnchor,
  type BodyId3D,
  type DistancePair,
  type DistancePairView,
  type Selection3D,
  type ViewerFrame,
} from "./shared-3d";
import { Stars3D } from "./stars-3d";
import { BODY_TEXTURE_IDS, disposeTextureLibrary3D, textureLibrary3D, type TextureLoadState } from "./texture-3d";
import { disposeTextureCache, PALETTE_3D, safeHex } from "./theme-3d";
import { Trails3D } from "./trails-3d";
import { Uncertainty3D } from "./uncertainty-3d";

const MAX_DPR = 2;
/** 画布总像素上限，避免 4K + dpr2 的低端 GPU 过载。 */
const MAX_CANVAS_PIXELS = 4_500_000;
const FRAME_FAILURE_LIMIT = 6;
const IDLE_REDRAW_MIN_GAP_MS = 90;
const MAX_DISTANCE_PAIRS = 8;
const DEFAULT_BASE_RADIUS = 3;
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 360;
/** 帧率统计窗口（秒）。 */
const FPS_WINDOW_SECONDS = 0.5;

/**
 * QA/调试快照：真实浏览器验收脚本通过
 * `(await import('/src/render3d/index.ts')).getRenderer3DDebug()` 读取；
 * 生产运行时只占一个模块级引用，不做任何全局挂载。
 */
export interface Renderer3DDebugState {
  near: BodyId3D | null;
  nearRadius: number;
  quality: "high" | "low";
  camera: {
    mode: "orbit" | "near";
    distance: number;
    min: number;
    max: number;
    moving: boolean;
    transitioning: boolean;
  };
  textures: Record<string, TextureLoadState>;
  renderer: { frames: number; fps: number };
  /** 天体当前屏幕坐标（CSS px，含画布偏移）；用于验收脚本点击真实位置。 */
  project(bodyId: BodyId3D): { x: number; y: number; visible: boolean } | null;
}

/** 无头/软件渲染（SwiftShader 等）检测：用于近景降级分段与 HUD 性能提示。 */
function detectSoftwareRendering(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    if (!gl) return false;
    let name = "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
    if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
    if (!name) name = String(gl.getParameter(gl.RENDERER) ?? "");
    return /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(name);
  } catch {
    return false;
  }
}

/** 当前存活的 ThreeSceneRenderer（调试/QA 用；销毁时清空）。 */
let activeRenderer3D: ThreeSceneRenderer | null = null;

/**
 * 读取当前 3D 渲染器的调试快照；无 3D 视图（未挂载 / WebGL 不可用）时返回 null。
 * 仅供 QA 与性能验收脚本使用，不参与渲染逻辑。
 */
export function getRenderer3DDebug(): Renderer3DDebugState | null {
  const renderer = activeRenderer3D;
  if (!renderer || renderer.isDisposed()) return null;
  return renderer.debugState();
}

interface BoundListener {
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function normalizeSeed(seed: unknown): string {
  return typeof seed === "string" && seed.length > 0 ? seed : "trisolaris";
}

/** WebGL 可用性探测（jsdom / 无 GPU 环境返回 false，绝不抛异常）。 */
export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return false;
  try {
    const canvas = document.createElement("canvas");
    if (typeof canvas.getContext !== "function") return false;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/** 当前存活的 3D 渲染器数量（用于最后一个实例销毁时释放共享纹理缓存）。 */
let activeRendererCount = 0;

/**
 * Three.js 渲染器实现。
 * 注意：构造顺序敏感（canvas → WebGLRenderer → 场景/模块），失败时由 createRenderer3D 兜底。
 */
class ThreeSceneRenderer implements SceneRenderer3D {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly orbit = new OrbitCamera3D();
  private readonly stars = new Stars3D();
  private readonly planet = new Planet3D();
  private readonly trails = new Trails3D();
  private readonly clouds = new Uncertainty3D();
  private readonly orbitPlanes = new OrbitPlanes3D();
  private readonly pulses = new Pulses3D();
  private readonly distanceLines = new DistanceLines3D();
  private readonly picker = new Picker3D();
  private readonly labels: LabelOverlay | null;
  private readonly hud: Hud3D | null;
  private readonly onPick: ((id: Selection3D) => void) | undefined;
  private sceneRoot: SceneRoot;

  private readonly listeners: BoundListener[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private idleRafId = 0;
  private lastFrameAt = 0;
  private time = 0;
  private frameCount = 0;
  private failures = 0;
  private dead = false;
  private disposed = false;
  private contextLost = false;
  private resizeWarned = false;
  private width = FALLBACK_WIDTH;
  private height = FALLBACK_HEIGHT;
  private dpr = 1;
  private seed: string;
  private preset: ViewPreset3D = "free";
  private lastScene: RenderScene3D | null = null;
  private lastBaseRadius = DEFAULT_BASE_RADIUS;
  private containerPositionRestore: string | null = null;

  /** 近景模式：目标天体与视觉半径（null = 全景）。 */
  private nearBody: BodyId3D | null = null;
  private nearSurfaceRadius = 0;
  /** 近景入场后等待 scene.selection 同步，避免 API 更新滞后导致误退出。 */
  private nearArmed = false;
  /** 渲染质量档（软件渲染降级）。 */
  private quality: "high" | "low" = "high";
  /** 帧率统计。 */
  private fpsValue = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private textureUnsubscribe: (() => void) | null = null;

  /** 复用的帧上下文 / 距离标注容器（避免帧内分配）。 */
  private readonly frameContext: ViewerFrame;
  private readonly pairPool: DistancePair[] = [];
  private readonly pairView: DistancePairView;
  private readonly anchorView: BodyAnchor[] = [];
  private readonly pickTargets: Mesh[] = [];
  private readonly selectionPos: Vec3 = { x: 0, y: 0, z: 0 };

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragMode: "none" | "rotate" | "pan" | "pinch" = "none";
  private dragMoved = 0;
  private pinchDistance = 0;

  constructor(options: Renderer3DOptions) {
    this.container = options.container;
    this.seed = normalizeSeed(options.seed);
    this.onPick = typeof options.onPick === "function" ? options.onPick : undefined;

    const doc = this.container.ownerDocument ?? document;
    this.canvas = doc.createElement("canvas");
    this.canvas.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;outline:none;" +
      "touch-action:none;cursor:grab;";
    this.container.appendChild(this.canvas);
    this.adjustContainerPosition(doc);

    let renderer: WebGLRenderer | null = null;
    try {
      renderer = new WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
      });
    } catch (err) {
      try {
        this.canvas.remove();
      } catch {
        try {
          this.container.removeChild(this.canvas);
        } catch {
          /* ignore */
        }
      }
      throw err;
    }
    this.renderer = renderer;
    try {
      this.renderer.setClearColor(new Color(PALETTE_3D.void), 1);
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = SRGBColorSpace;
    } catch {
      /* 老驱动上个别属性不可写时忽略 */
    }

    this.sceneRoot = createSceneRoot({ seed: this.seed, baseRadius: DEFAULT_BASE_RADIUS });
    this.scene.background = this.sceneRoot.background;
    this.scene.add(
      this.sceneRoot.group,
      this.stars.group,
      this.planet.group,
      this.trails.group,
      this.clouds.group,
      this.orbitPlanes.group,
      this.pulses.group,
      this.distanceLines.group,
    );

    this.quality = detectSoftwareRendering(this.renderer) ? "low" : "high";
    try {
      textureLibrary3D.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    } catch {
      /* 个别驱动不提供 anisotropy 上限 */
    }
    this.textureUnsubscribe = textureLibrary3D.onChange(() => this.requestIdleRedraw());

    this.labels = createLabelOverlay(this.container);
    this.hud = createHud3D(this.container, {
      onExitNear: () => this.exitNearView("button"),
      onSelectBody: (id) => this.requestNear(id, true),
    });

    for (let i = 0; i < MAX_DISTANCE_PAIRS; i++) {
      this.pairPool.push({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: 0 },
        mid: { x: 0, y: 0, z: 0 },
        distanceAU: 0,
        deltaHeightAU: null,
        color: PALETTE_3D.distance,
      });
    }
    this.pairView = { items: this.pairPool, count: 0 };
    this.frameContext = {
      camera: this.orbit.camera,
      width: this.width,
      height: this.height,
      time: 0,
      viewRadius: DEFAULT_BASE_RADIUS,
      cameraDistance: this.orbit.cameraDistance,
      settings: DEFAULT_VIEW_SETTINGS_3D,
      selection: null,
      heightDataAvailable: false,
      nearBody: null,
      nearRadius: 0,
      quality: this.quality,
    };

    activeRendererCount += 1;
    activeRenderer3D = this;
    // QA 调试钩子直接挂在画布上：避免 Vite 开发态下动态 import 命中另一份模块实例。
    try {
      (this.canvas as HTMLCanvasElement & { __trisolarisR3D?: unknown }).__trisolarisR3D = {
        state: () => this.debugState(),
        project: (bodyId: BodyId3D) => this.debugState().project(bodyId),
      };
    } catch {
      /* ignore */
    }
    this.bindEvents();
    this.resize();
    try {
      this.renderer.render(this.scene, this.orbit.camera);
    } catch {
      /* 初始空场景渲染失败不致命，后续帧会重试 */
    }
  }

  /* ---------------------------------------------------------------- *
   *  生命周期 / 尺寸                                                  *
   * ---------------------------------------------------------------- */

  resize(): void {
    if (this.disposed) return;
    try {
      this.applyViewport(true);
    } catch (err) {
      if (!this.resizeWarned) {
        this.resizeWarned = true;
        console.warn("[render3d] 画布尺寸同步失败：", err);
      }
    }
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dead = true;
    this.detachEvents();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch {
        /* ignore */
      }
      this.resizeObserver = null;
    }
    if (this.idleRafId !== 0 && typeof cancelAnimationFrame === "function") {
      try {
        cancelAnimationFrame(this.idleRafId);
      } catch {
        /* ignore */
      }
    }
    this.idleRafId = 0;

    const disposeStep = (fn: () => void): void => {
      try {
        fn();
      } catch {
        /* 单个模块释放失败不应阻断其余清理 */
      }
    };
    disposeStep(() => this.stars.dispose());
    disposeStep(() => this.planet.dispose());
    disposeStep(() => this.trails.dispose());
    disposeStep(() => this.clouds.dispose());
    disposeStep(() => this.orbitPlanes.dispose());
    disposeStep(() => this.pulses.dispose());
    disposeStep(() => this.distanceLines.dispose());
    disposeStep(() => this.picker.dispose());
    disposeStep(() => this.labels?.dispose());
    disposeStep(() => this.hud?.dispose());
    this.scene.background = null;
    disposeStep(() => this.sceneRoot.dispose());
    disposeStep(() => this.scene.clear());
    disposeStep(() => this.renderer.dispose());
    disposeStep(() => {
      const maybe = this.renderer as unknown as { forceContextLoss?: () => void };
      maybe.forceContextLoss?.();
    });
    try {
      this.canvas.remove();
    } catch {
      try {
        this.container.removeChild(this.canvas);
      } catch {
        /* ignore */
      }
    }
    if (this.containerPositionRestore !== null) {
      try {
        this.container.style.position = this.containerPositionRestore;
      } catch {
        /* ignore */
      }
    }
    this.lastScene = null;
    this.anchorView.length = 0;
    this.pickTargets.length = 0;
    this.pairView.count = 0;
    this.pointers.clear();
    this.nearBody = null;
    this.nearSurfaceRadius = 0;
    this.nearArmed = false;
    if (this.textureUnsubscribe) {
      try {
        this.textureUnsubscribe();
      } catch {
        /* ignore */
      }
      this.textureUnsubscribe = null;
    }
    if (activeRenderer3D === this) activeRenderer3D = null;
    activeRendererCount = Math.max(0, activeRendererCount - 1);
    if (activeRendererCount === 0) {
      disposeTextureCache();
      disposeTextureLibrary3D();
    }
  }

  frame(scene: RenderScene3D, dtSeconds: number): void {
    if (this.disposed || this.dead) return;
    if (!scene || !Array.isArray(scene.stars)) return;
    try {
      this.renderScene(scene, dtSeconds);
    } catch (err) {
      this.failures += 1;
      if (this.failures === 1) console.warn("[render3d] 帧渲染异常，进入降级保护：", err);
      if (this.failures >= FRAME_FAILURE_LIMIT) {
        this.dead = true;
        console.warn("[render3d] 连续帧渲染失败，3D 视图停止绘制（模拟与 2D 视图不受影响）");
      }
    }
  }

  resetView(): void {
    if (this.disposed) return;
    if (this.nearBody) {
      // 近景下「复位」= 平滑回到进入近景前的全景机位。
      this.exitNearView("reset");
      this.preset = "free";
      return;
    }
    this.orbit.reset();
    this.preset = "free";
    this.requestIdleRedraw();
  }

  setViewPreset(preset: "top" | "side" | "free"): void {
    if (this.disposed) return;
    if (preset !== "top" && preset !== "side" && preset !== "free") return;
    if (this.nearBody) {
      // 近景下切换预设 = 平滑退出近景并落到该全景预设（相机内部做 0.85s 补间）。
      this.clearNearState();
    }
    this.orbit.setPreset(preset);
    this.preset = preset;
    this.requestIdleRedraw();
  }

  /* ---------------------------------------------------------------- *
   *  帧渲染                                                          *
   * ---------------------------------------------------------------- */

  private renderScene(scene: RenderScene3D, dtSeconds: number): void {
    const now = nowMs();
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0.016, 0, 0.1);
    this.time += dt;
    this.frameCount += 1;
    if (this.frameCount % 20 === 0) {
      try {
        this.applyViewport(false);
      } catch {
        /* 尺寸同步失败留待下次 */
      }
    }
    if (scene.seed && scene.seed !== this.seed) this.rebuildForSeed(scene.seed);
    this.lastScene = scene;

    const base =
      Number.isFinite(scene.recommendedRadiusAU) && scene.recommendedRadiusAU > 1e-6
        ? scene.recommendedRadiusAU
        : this.lastBaseRadius;
    this.lastBaseRadius = base;
    this.orbit.setBaseRadius(base);
    this.orbit.update(dt);

    const settings: ViewSettings = scene.settings ?? DEFAULT_VIEW_SETTINGS_3D;
    // 近景：跟随目标天体 + 与 scene.selection 同步（外部取消选择 / 改选时平滑退出或切换）。
    this.syncNearSelection(scene);
    if (this.nearBody) {
      const nearPos = this.findBodyPos(scene, this.nearBody);
      if (nearPos) this.orbit.trackNearTarget(nearPos);
    }
    const ctx = this.frameContext;
    ctx.camera = this.orbit.camera;
    ctx.width = this.width;
    ctx.height = this.height;
    ctx.time = this.time;
    ctx.viewRadius = base;
    ctx.cameraDistance = this.orbit.cameraDistance;
    ctx.settings = settings;
    ctx.selection = scene.selection ?? null;
    ctx.heightDataAvailable = !!scene.heightDataAvailable;
    ctx.nearBody = this.nearBody;
    ctx.nearRadius = this.nearBody ? this.nearSurfaceRadius : 0;
    ctx.quality = this.quality;

    const near = this.nearBody !== null;
    if (!near) {
      this.sceneRoot.setBaseRadius(base);
      this.sceneRoot.setShowGrid(settings.showGrid);
      this.sceneRoot.update(this.orbit.camera);
    }
    this.applyNearVisibility(near);

    this.stars.sync(scene, ctx);
    this.planet.sync(scene, ctx);
    if (!near) {
      this.trails.sync(scene.observedTrails, scene.predictedTrails, scene.predictedPlanetTrail, ctx);
      this.clouds.sync(scene.uncertaintyClouds, scene.planetUncertainty, ctx);
      this.orbitPlanes.sync(scene, ctx);
      this.pulses.sync(scene.pulses, ctx);
    }

    // 锚点 / 拾取代理（模块内部已复用数组，这里只做汇总）。
    this.anchorView.length = 0;
    const starAnchors = this.stars.anchors();
    for (let i = 0; i < starAnchors.length; i++) this.anchorView.push(starAnchors[i]);
    const planetAnchor = this.planet.anchorOrNull();
    if (planetAnchor) this.anchorView.push(planetAnchor);
    this.pickTargets.length = 0;
    if (!near) {
      const starPicks = this.stars.pickTargets();
      for (let i = 0; i < starPicks.length; i++) this.pickTargets.push(starPicks[i]);
      for (let i = 0; i < this.planet.pickables.length; i++) this.pickTargets.push(this.planet.pickables[i]);
    }

    if (!near) {
      const selectedPos = this.computeSelectionPos(scene, ctx.selection);
      this.buildDistancePairs(scene, ctx, selectedPos);
      this.distanceLines.sync(this.pairView, selectedPos, ctx);
    }
    this.labels?.sync(
      scene,
      ctx,
      this.anchorView,
      this.pairView,
      this.sceneRoot.axisAnchors(),
      (bodyId) => this.orbitPlanes.inclinationDeg(bodyId),
    );
    this.hud?.sync(scene, ctx, this.preset, this.buildNearHudView(scene), this.hudPerf());

    if (!this.contextLost) this.renderer.render(this.scene, this.orbit.camera);
    this.updateFps(dt);
    this.lastFrameAt = now;
  }

  /** 重建种子相关的场景家具（仅 seed 变化时）。 */
  private rebuildForSeed(seed: string): void {
    this.seed = seed;
    const old = this.sceneRoot;
    this.scene.background = null;
    try {
      this.scene.remove(old.group);
    } catch {
      /* ignore */
    }
    try {
      old.dispose();
    } catch {
      /* ignore */
    }
    this.sceneRoot = createSceneRoot({ seed, baseRadius: this.lastBaseRadius });
    this.scene.background = this.sceneRoot.background;
    this.scene.add(this.sceneRoot.group);
  }

  /* ------------------------------------------------------------------ *
   *  近景模式（点击天体 → 0.85s 缓出拉近）                              *
   * ------------------------------------------------------------------ */

  /** 是否为可拾取天体 id。 */
  private static isBodyId(id: Selection3D): id is BodyId3D {
    return id === "A" || id === "B" || id === "C" || id === "planet";
  }

  /**
   * 进入/切换近景目标。
   * @param userInitiated 由用户点击触发时同步游戏选中（onPick）；外部选中同步时不再回写。
   */
  private requestNear(id: BodyId3D, userInitiated: boolean): boolean {
    if (this.disposed || this.dead) return false;
    const scene = this.lastScene;
    if (!scene) return false;
    const pos = this.findBodyPos(scene, id);
    if (!pos) return false;
    if (this.nearBody === id) {
      if (userInitiated && scene.selection !== id) this.onPick?.(id);
      return true;
    }
    const radius = nearSurfaceRadiusFor(id, this.lastBaseRadius);
    const orientation = nearOrientationFor(
      scene,
      id,
      this.orbit.presetOrientation.theta,
      this.orbit.presetOrientation.phi,
    );
    this.nearBody = id;
    this.nearSurfaceRadius = radius;
    this.nearArmed = false;
    this.orbit.enterNear(pos, radius, orientation);
    // 贴图惰性加载：只在天体首次进入近景时请求，全景模式不浪费带宽。
    textureLibrary3D.requestForBody(id);
    this.applyNearVisibility(true);
    if (userInitiated) this.onPick?.(id);
    this.requestIdleRedraw();
    return true;
  }

  /** 平滑退出近景（Esc / 点击空白 / 返回全景按钮 / 复位）。 */
  private exitNearView(reason: "esc" | "blank" | "button" | "reset" | "external"): void {
    if (!this.nearBody) return;
    this.nearBody = null;
    this.nearSurfaceRadius = 0;
    this.nearArmed = false;
    this.orbit.exitNear();
    this.applyNearVisibility(false);
    if (reason === "blank") this.onPick?.(null);
    this.requestIdleRedraw();
  }

  /** 仅清理近景状态（相机切换预设时由相机自己完成平滑过渡）。 */
  private clearNearState(): void {
    this.nearBody = null;
    this.nearSurfaceRadius = 0;
    this.nearArmed = false;
    this.applyNearVisibility(false);
  }

  /** 近景时隐藏与天体细节无关的场景元素（星穹/轨迹/不确定度/轨道面/距离线），提升帧率与可读性。 */
  private applyNearVisibility(near: boolean): void {
    const visible = !near;
    this.sceneRoot.group.visible = visible;
    this.trails.group.visible = visible;
    this.clouds.group.visible = visible;
    this.orbitPlanes.group.visible = visible;
    this.pulses.group.visible = visible;
    this.distanceLines.group.visible = visible;
  }

  /** 判断屏幕点击是否落在近景天体圆盘内（近景无拾取代理球，用投影 + 像素半径判断）。 */
  private isClickOnNearBody(clientX: number, clientY: number): boolean {
    const scene = this.lastScene;
    const id = this.nearBody;
    if (!scene || !id) return false;
    const pos = this.findBodyPos(scene, id);
    if (!pos) return false;
    let rect: { left: number; top: number };
    try {
      const domRect = typeof this.canvas.getBoundingClientRect === "function" ? this.canvas.getBoundingClientRect() : null;
      rect = domRect ? { left: domRect.left, top: domRect.top } : { left: 0, top: 0 };
    } catch {
      rect = { left: 0, top: 0 };
    }
    const projection = projectToScreen(this.orbit.camera, pos, this.width, this.height);
    if (!projection.visible) return false;
    const screenX = rect.left + projection.x;
    const screenY = rect.top + projection.y;
    let radiusPx = 0;
    try {
      radiusPx = this.nearSurfaceRadius * pixelsPerWorld(this.orbit.camera, pos, this.height);
    } catch {
      radiusPx = 0;
    }
    const threshold = Math.max(26, radiusPx * 1.08);
    return Math.hypot(clientX - screenX, clientY - screenY) <= threshold;
  }

  /** 近景与 scene.selection 的双向同步：外部取消选择 → 平滑退出；外部改选 → 平滑切换。 */
  private syncNearSelection(scene: RenderScene3D): void {
    const near = this.nearBody;
    if (!near) return;
    const selection = scene.selection ?? null;
    if (!this.nearArmed) {
      if (selection === near || selection === null) this.nearArmed = true;
      return;
    }
    if (selection === near) return;
    if (selection === null) {
      this.exitNearView("external");
      return;
    }
    if (ThreeSceneRenderer.isBodyId(selection)) this.requestNear(selection, false);
  }

  /** 组装近景 HUD 数据（观测字段 + 缩放限位 + 贴图状态）。 */
  private buildNearHudView(scene: RenderScene3D): Hud3DNearView | null {
    const id = this.nearBody;
    if (!id) return null;
    const info = buildNearInfo(scene, id, !!scene.heightDataAvailable);
    if (!info) return null;
    return {
      info,
      zoom: this.orbit.zoomRange,
      textures: this.textureStats(),
    };
  }

  private textureStats(): { loaded: number; pending: number; total: number; states: Record<string, TextureLoadState> } {
    const counts = textureLibrary3D.loadedCount();
    return { loaded: counts.loaded, pending: counts.pending, total: counts.total, states: textureLibrary3D.snapshot() };
  }

  /** 组装 HUD 性能读数。 */
  private hudPerf(): { fps: number; quality: "high" | "low"; textures: ReturnType<ThreeSceneRenderer["textureStats"]> } {
    return { fps: this.fpsValue, quality: this.quality, textures: this.textureStats() };
  }

  private updateFps(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.fpsFrames += 1;
    this.fpsElapsed += step;
    if (this.fpsElapsed >= FPS_WINDOW_SECONDS) {
      this.fpsValue = this.fpsElapsed > 0 ? this.fpsFrames / this.fpsElapsed : 0;
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }
  }

  /** QA/调试快照（见 getRenderer3DDebug）。 */
  debugState(): Renderer3DDebugState {
    const scene = this.lastScene;
    const rect = (() => {
      try {
        const domRect = typeof this.canvas.getBoundingClientRect === "function" ? this.canvas.getBoundingClientRect() : null;
        return domRect ?? { left: 0, top: 0, width: this.width, height: this.height };
      } catch {
        return { left: 0, top: 0, width: this.width, height: this.height };
      }
    })();
    const projectPoint = (pos: Vec3 | null): { x: number; y: number; visible: boolean } | null => {
      if (!pos) return null;
      const projection = projectToScreen(this.orbit.camera, pos, this.width, this.height);
      return { x: rect.left + projection.x, y: rect.top + projection.y, visible: projection.visible };
    };
    return {
      near: this.nearBody,
      nearRadius: this.nearSurfaceRadius,
      quality: this.quality,
      camera: {
        mode: this.orbit.isNear ? "near" : "orbit",
        distance: this.orbit.cameraDistance,
        min: this.orbit.zoomRange.min,
        max: this.orbit.zoomRange.max,
        moving: this.orbit.isMoving,
        transitioning: this.orbit.isTransitioning,
      },
      textures: textureLibrary3D.snapshot(),
      renderer: { frames: this.frameCount, fps: this.fpsValue },
      project: (bodyId: BodyId3D) => projectPoint(scene ? this.findBodyPos(scene, bodyId) : null),
    };
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  /** 计算选中天体的世界坐标（写入复用对象，返回 null 表示无选中/数据无效）。 */
  private computeSelectionPos(scene: RenderScene3D, selection: Selection3D): Vec3 | null {
    const pos = this.selectionPos;
    if (!selection) return null;
    if (selection === "planet") {
      const planet = scene.planet;
      if (!planet || !Number.isFinite(planet.pos?.x) || !Number.isFinite(planet.pos?.y) || !Number.isFinite(planet.pos?.z)) {
        return null;
      }
      pos.x = planet.pos.x;
      pos.y = planet.pos.y;
      pos.z = planet.pos.z;
      return pos;
    }
    for (let i = 0; i < scene.stars.length; i++) {
      const star = scene.stars[i];
      if (star.id !== selection) continue;
      if (!Number.isFinite(star.pos?.x) || !Number.isFinite(star.pos?.y) || !Number.isFinite(star.pos?.z)) return null;
      pos.x = star.pos.x;
      pos.y = star.pos.y;
      pos.z = star.pos.z;
      return pos;
    }
    return null;
  }

  /** 组装"选中天体 → 其他天体"的三维距离标注（复用 pairPool，不分配对象）。 */
  private buildDistancePairs(scene: RenderScene3D, ctx: ViewerFrame, selectedPos: Vec3 | null): void {
    const view = this.pairView;
    view.count = 0;
    if (!ctx.selection || !selectedPos || !ctx.settings.showLabels) return;
    let count = 0;
    const push = (to: Vec3, color: string, deltaHeightAU: number | null): void => {
      if (count >= view.items.length || count >= MAX_DISTANCE_PAIRS) return;
      const pair = view.items[count];
      pair.from.x = selectedPos.x;
      pair.from.y = selectedPos.y;
      pair.from.z = selectedPos.z;
      pair.to.x = to.x;
      pair.to.y = to.y;
      pair.to.z = to.z;
      const mid = vMid3(selectedPos, to);
      pair.mid.x = mid.x;
      pair.mid.y = mid.y;
      pair.mid.z = mid.z;
      pair.distanceAU = vDist3(selectedPos, to);
      pair.deltaHeightAU = ctx.heightDataAvailable ? deltaHeightAU : null;
      pair.color = color;
      count += 1;
    };
    for (let i = 0; i < scene.stars.length; i++) {
      const star = scene.stars[i];
      if (!star || star.id === ctx.selection) continue;
      if (!Number.isFinite(star.pos?.x) || !Number.isFinite(star.pos?.y) || !Number.isFinite(star.pos?.z)) continue;
      push(star.pos, safeHex(star.color, PALETTE_3D.accent), star.pos.y - selectedPos.y);
    }
    if (ctx.selection !== "planet" && scene.planet) {
      const planet = scene.planet;
      if (Number.isFinite(planet.pos?.x) && Number.isFinite(planet.pos?.y) && Number.isFinite(planet.pos?.z)) {
        push(planet.pos, PALETTE_3D.planet, planet.pos.y - selectedPos.y);
      }
    }
    view.count = count;
  }

  /* ---------------------------------------------------------------- *
   *  视口 / DPR                                                       *
   * ---------------------------------------------------------------- */

  private applyViewport(force: boolean): void {
    const size = this.measureSize();
    const dpr = this.computeDpr(size.width, size.height);
    if (
      !force &&
      size.width === this.width &&
      size.height === this.height &&
      Math.abs(dpr - this.dpr) < 0.001
    ) {
      return;
    }
    this.width = size.width;
    this.height = size.height;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(size.width, size.height, false);
    this.orbit.setViewport(size.width, size.height);
    this.orbit.update(0);
    if (this.lastScene) this.requestIdleRedraw();
  }

  private measureSize(): { width: number; height: number } {
    const el = this.container;
    let width = 0;
    let height = 0;
    try {
      width = el.clientWidth || 0;
      height = el.clientHeight || 0;
    } catch {
      width = 0;
      height = 0;
    }
    if (width < 2 || height < 2) {
      try {
        const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
        if (rect) {
          width = rect.width;
          height = rect.height;
        }
      } catch {
        /* ignore */
      }
    }
    // 容器暂未布局（display:none / jsdom）：沿用上一次有效尺寸，等 ResizeObserver 补正。
    if (!(width >= 2) || !(height >= 2)) {
      width = this.width;
      height = this.height;
    }
    return {
      width: Math.max(2, Math.floor(width)),
      height: Math.max(2, Math.floor(height)),
    };
  }

  private computeDpr(width: number, height: number): number {
    let dpr = 1;
    if (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) {
      dpr = window.devicePixelRatio;
    }
    dpr = clamp(dpr, 1, MAX_DPR);
    const pixels = width * height * dpr * dpr;
    if (pixels > MAX_CANVAS_PIXELS) {
      dpr = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
    }
    return Math.round(dpr * 100) / 100;
  }

  /* ---------------------------------------------------------------- *
   *  交互                                                            *
   * ---------------------------------------------------------------- */

  private handleWheel = (ev: WheelEvent): void => {
    if (this.disposed) return;
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
    const raw = Number.isFinite(ev.deltaY) ? ev.deltaY : 0;
    const dy = ev.deltaMode === 1 ? raw * 16 : ev.deltaMode === 2 ? raw * this.height : raw;
    this.orbit.zoomBy(clamp(Math.exp(-dy * 0.0012), 0.2, 5));
    this.requestIdleRedraw();
  };

  private handlePointerDown = (ev: PointerEvent): void => {
    if (this.disposed) return;
    const button = typeof ev.button === "number" ? ev.button : 0;
    if (button !== 0 && button !== 1 && button !== 2) return;
    try {
      if (typeof ev.preventDefault === "function" && button !== 0) ev.preventDefault();
    } catch {
      /* ignore */
    }
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    this.dragMoved = 0;
    if (this.pointers.size >= 2) {
      this.dragMode = "pinch";
      this.pinchDistance = this.currentPinchDistance();
    } else {
      this.dragMode = button === 0 && !ev.shiftKey ? "rotate" : "pan";
    }
    try {
      if (typeof this.canvas.setPointerCapture === "function") this.canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    this.setCursor(this.dragMode === "pan" ? "move" : "grabbing");
  };

  private handlePointerMove = (ev: PointerEvent): void => {
    if (this.disposed) return;
    const previous = this.pointers.get(ev.pointerId);
    if (!previous) {
      if (this.pointers.size === 0) this.updateHoverCursor(ev.clientX, ev.clientY);
      return;
    }
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const dx = ev.clientX - previous.x;
    const dy = ev.clientY - previous.y;
    this.dragMoved += Math.abs(dx) + Math.abs(dy);

    if (this.dragMode === "pinch" || this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0.5 && distance > 0.5) {
        this.orbit.zoomBy(clamp(distance / this.pinchDistance, 0.5, 2));
        this.requestIdleRedraw();
      }
      this.pinchDistance = distance;
      return;
    }
    if (this.dragMode === "rotate") {
      this.orbit.rotateByPixels(dx, dy);
      this.preset = "free";
      this.requestIdleRedraw();
    } else if (this.dragMode === "pan") {
      this.orbit.panByPixels(dx, dy);
      this.requestIdleRedraw();
    }
  };

  private handlePointerUp = (ev: PointerEvent): void => {
    if (this.disposed) return;
    if (!this.pointers.has(ev.pointerId)) return;
    const wasRotate = this.dragMode === "rotate";
    const click = wasRotate && this.dragMoved <= 4;
    this.pointers.delete(ev.pointerId);
    this.pinchDistance = this.pointers.size >= 2 ? this.currentPinchDistance() : 0;
    if (this.pointers.size === 0) {
      this.dragMode = "none";
      this.setCursor("grab");
    } else if (this.pointers.size === 1) {
      this.dragMode = "rotate";
    }
    try {
      if (typeof this.canvas.releasePointerCapture === "function" && this.canvas.hasPointerCapture?.(ev.pointerId)) {
        this.canvas.releasePointerCapture(ev.pointerId);
      }
    } catch {
      /* ignore */
    }
    if (click) {
      const picked = this.pickAt(ev.clientX, ev.clientY);
      if (this.nearBody) {
        // 近景：点击其他天体 = 平滑切换目标；点击空白 = 平滑返回全景（并清除选中）；
        // 点在近景天体自身（屏幕圆盘）上则保持不动，避免误退出。
        if (picked && picked !== this.nearBody) {
          this.requestNear(picked, true);
        } else if (!picked && !this.isClickOnNearBody(ev.clientX, ev.clientY)) {
          this.exitNearView("blank");
        }
      } else {
        // 点击空白也回调 null：契约要求点击空白清除选中。
        this.onPick?.(picked);
        // 点击天体：选中 + 0.85s 缓出拉近（selection 由 onPick 同步给游戏）。
        if (picked) this.requestNear(picked, false);
      }
    }
  };

  private handlePointerCancel = (ev: PointerEvent): void => {
    this.pointers.delete(ev.pointerId);
    this.pinchDistance = 0;
    if (this.pointers.size === 0) {
      this.dragMode = "none";
      this.setCursor("grab");
    }
  };

  private handlePointerLeave = (): void => {
    if (this.pointers.size > 0) return;
    this.setCursor("grab");
  };

  private handleDoubleClick = (ev: MouseEvent): void => {
    if (this.disposed) return;
    // 近景模式：双击不再重置视角（退出近景走 Esc / 空白 / 返回按钮），避免误触。
    if (this.nearBody) return;
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
    const scene = this.lastScene;
    if (!scene) return;
    const picked = this.pickAt(ev.clientX, ev.clientY);
    const target: Selection3D = picked ?? scene.selection ?? null;
    if (!target) {
      this.resetView();
      return;
    }
    const pos = this.findBodyPos(scene, target);
    if (!pos) {
      this.resetView();
      return;
    }
    const radius = Math.max(0.02, this.lastBaseRadius * (target === "planet" ? 0.32 : 0.38));
    this.orbit.focus(pos, radius);
    this.requestIdleRedraw();
  };

  private handleContextMenu = (ev: Event): void => {
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
  };

  private handleWindowResize = (): void => {
    this.resize();
  };

  /**
   * 键盘：近景模式下 Esc 平滑返回全景。
   * 用捕获阶段 + stopImmediatePropagation，避免主 UI 的 Esc（暂停）同时触发；
   * 仅在近景激活时拦截，其余按键/状态完全交给主 UI。
   */
  private handleWindowKeyDown = (ev: KeyboardEvent): void => {
    if (this.disposed || !this.nearBody) return;
    if (ev.key !== "Escape" && ev.code !== "Escape") return;
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName ?? "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
    } catch {
      /* ignore */
    }
    this.exitNearView("esc");
  };

  private handleContextLost = (ev: Event): void => {
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.requestIdleRedraw();
  };

  /** 屏幕坐标拾取（代理球 Raycaster；点空白返回 null）。 */
  private pickAt(clientX: number, clientY: number): Selection3D {
    if (this.pickTargets.length === 0) return null;
    let rect: { left: number; top: number; width: number; height: number };
    try {
      const domRect = typeof this.canvas.getBoundingClientRect === "function" ? this.canvas.getBoundingClientRect() : null;
      rect = domRect
        ? { left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height }
        : { left: 0, top: 0, width: this.width, height: this.height };
    } catch {
      rect = { left: 0, top: 0, width: this.width, height: this.height };
    }
    return this.picker.pick(clientX, clientY, rect, this.orbit.camera, this.pickTargets);
  }

  private findBodyPos(scene: RenderScene3D, id: Selection3D): Vec3 | null {
    if (!id) return null;
    if (id === "planet") {
      const planet = scene.planet;
      if (!planet || !Number.isFinite(planet.pos?.x) || !Number.isFinite(planet.pos?.y) || !Number.isFinite(planet.pos?.z)) {
        return null;
      }
      return planet.pos;
    }
    for (let i = 0; i < scene.stars.length; i++) {
      const star = scene.stars[i];
      if (star.id !== id) continue;
      if (!Number.isFinite(star.pos?.x) || !Number.isFinite(star.pos?.y) || !Number.isFinite(star.pos?.z)) return null;
      return star.pos;
    }
    return null;
  }

  private updateHoverCursor(clientX: number, clientY: number): void {
    const picked = this.pickAt(clientX, clientY);
    this.setCursor(picked ? "pointer" : "grab");
  }

  private setCursor(cursor: string): void {
    try {
      if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
    } catch {
      /* ignore */
    }
  }

  private currentPinchDistance(): number {
    if (this.pointers.size < 2) return 0;
    const points: { x: number; y: number }[] = [];
    this.pointers.forEach((point) => points.push(point));
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  /**
   * 主循环可能已暂停：交互后补帧。
   * 近景补间 / 阻尼运动 / 贴图加载期间会连续补帧，直到画面稳定（不常驻 RAF）。
   */
  private requestIdleRedraw(): void {
    if (this.disposed || this.dead || this.idleRafId !== 0) return;
    if (typeof requestAnimationFrame !== "function") return;
    if (nowMs() - this.lastFrameAt < IDLE_REDRAW_MIN_GAP_MS) return;
    this.scheduleIdleFrame();
  }

  private scheduleIdleFrame(): void {
    if (this.disposed || this.dead || this.idleRafId !== 0) return;
    if (typeof requestAnimationFrame !== "function") return;
    this.idleRafId = requestAnimationFrame(() => {
      this.idleRafId = 0;
      if (this.disposed || this.dead || !this.lastScene) return;
      this.frame(this.lastScene, 0.016);
      if (this.needsAnimation()) this.scheduleIdleFrame();
    });
  }

  /** 是否还有需要连续推进的视觉动画（远/近景相机运动、近景贴图加载）。 */
  private needsAnimation(): boolean {
    if (this.disposed || this.dead) return false;
    if (this.orbit.isMoving || this.orbit.isTransitioning) return true;
    if (this.nearBody && textureLibrary3D.loadedCount().pending > 0) return true;
    return false;
  }

  /* ---------------------------------------------------------------- *
   *  事件绑定 / 容器                                                   *
   * ---------------------------------------------------------------- */

  private adjustContainerPosition(doc: Document): void {
    try {
      const view = doc.defaultView;
      if (!view || typeof view.getComputedStyle !== "function") return;
      const computed = view.getComputedStyle(this.container);
      if (computed && computed.position === "static") {
        this.containerPositionRestore = this.container.style.position || "";
        this.container.style.position = "relative";
      }
    } catch {
      /* ignore */
    }
  }

  private listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    try {
      target.addEventListener(type, handler, options);
      this.listeners.push({ target, type, handler, options });
    } catch {
      /* 该环境不支持此事件类型 */
    }
  }

  private bindEvents(): void {
    this.listen(this.canvas, "wheel", this.handleWheel as unknown as EventListener, { passive: false });
    this.listen(this.canvas, "pointerdown", this.handlePointerDown as unknown as EventListener);
    this.listen(this.canvas, "pointermove", this.handlePointerMove as unknown as EventListener);
    this.listen(this.canvas, "pointerup", this.handlePointerUp as unknown as EventListener);
    this.listen(this.canvas, "pointercancel", this.handlePointerCancel as unknown as EventListener);
    this.listen(this.canvas, "pointerleave", this.handlePointerLeave as unknown as EventListener);
    this.listen(this.canvas, "dblclick", this.handleDoubleClick as unknown as EventListener);
    this.listen(this.canvas, "contextmenu", this.handleContextMenu as unknown as EventListener);
    this.listen(this.canvas, "webglcontextlost", this.handleContextLost as unknown as EventListener);
    this.listen(this.canvas, "webglcontextrestored", this.handleContextRestored as unknown as EventListener);
    if (typeof window !== "undefined") {
      this.listen(window, "resize", this.handleWindowResize as unknown as EventListener);
      // 捕获阶段：近景 Esc 优先于主 UI 的暂停快捷键。
      this.listen(window, "keydown", this.handleWindowKeyDown as unknown as EventListener, { capture: true });
    }
    if (typeof ResizeObserver !== "undefined") {
      try {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
      } catch {
        this.resizeObserver = null;
      }
    }
  }

  private detachEvents(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      const listener = this.listeners[i];
      try {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
      } catch {
        /* ignore */
      }
    }
    this.listeners.length = 0;
  }
}

/** 空实现：无 WebGL / 无 DOM 环境（jsdom、测试、无 GPU）下的完全降级。 */
export function createNoopRenderer3D(): SceneRenderer3D {
  return {
    resize(): void {
      /* no-op */
    },
    frame(): void {
      /* no-op */
    },
    destroy(): void {
      /* no-op */
    },
    resetView(): void {
      /* no-op */
    },
    setViewPreset(): void {
      /* no-op */
    },
  };
}

/**
 * 创建 3D 辅助视图渲染器。
 * 无 WebGL / 无 DOM / 初始化异常时返回 no-op 实现，绝不抛异常 —— UI 主循环可以无脑调用。
 */
export function createRenderer3D(options: Renderer3DOptions): SceneRenderer3D {
  try {
    if (!options || !options.container) return createNoopRenderer3D();
    if (typeof document === "undefined") return createNoopRenderer3D();
    if (!isWebGLAvailable()) {
      console.warn("[render3d] WebGL 不可用，3D 视图使用空实现（2D 视图与模拟不受影响）");
      return createNoopRenderer3D();
    }
    return new ThreeSceneRenderer(options);
  } catch (err) {
    console.warn("[render3d] 渲染器初始化失败，使用空实现：", err);
    return createNoopRenderer3D();
  }
}

export default createRenderer3D;