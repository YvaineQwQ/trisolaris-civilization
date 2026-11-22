/**
 * index.ts —— Canvas 2D 星系观测渲染器入口。
 *
 * 对外只暴露冻结契约里的 `createRenderer(options): SceneRenderer`：
 *   - resize() / frame(scene, dt) / destroy() / zoomBy(factor) / resetView()
 *
 * 关键保证：
 *  - 无 2D context（例如 jsdom）时返回空实现，所有方法均为 no-op，不抛异常；
 *  - 帧渲染异常有降级保护：首帧告警，连续失败后自动停止绘制而不是拖垮游戏；
 *  - devicePixelRatio 自适应（上限 2，并限制总像素数），ResizeObserver + window.resize；
 *  - 滚轮以光标为中心缩放、左键拖动平移、双击聚焦、单击拾取（onPick）。
 */
import type {
  RenderScene,
  RendererOptions,
  SceneRenderer,
  SceneStar,
  ViewSettings,
} from "../game/viewTypes";

/**
 * 选择标识类型直接从冻结契约派生，避免额外依赖 core 模块：
 * RenderScene["selection"] = SceneSelection
 */
type SceneSelection = RenderScene["selection"];
type SceneStarId = Exclude<NonNullable<SceneSelection>, "planet">;
import { Camera } from "./camera";
import { drawStarUncertainty, drawStars, starVisualRadius, clearStarSpriteCache } from "./draw-stars";
import { drawPlanet, planetVisualRadius } from "./draw-planet";
import { drawTrails, drawUncertaintyBands } from "./draw-trails";
import {
  createScreenFx,
  drawFrameCorners,
  drawGrid,
  drawHud,
  drawLabels,
  drawPulses,
  drawSelection,
  type ScreenFx,
} from "./overlay";
import { createStarfield, type Starfield } from "./starfield";
import { clamp, planeX, planeY, type Point } from "./theme";

const DEFAULT_SETTINGS: ViewSettings = {
  showTrails: true,
  showPrediction: true,
  showGrid: true,
  showLabels: true,
  showUncertainty: true,
};

/** 画布总像素上限（4K × dpr2 会被压制），保证低端 GPU 也能 60fps。 */
const MAX_CANVAS_PIXELS = 6_500_000;
/** 拾取判定的最小半径（CSS px）。 */
const PICK_MIN_RADIUS = 16;

interface BoundListener {
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.fillRect !== "function") return null;
    return ctx;
  } catch {
    return null;
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

class CanvasSceneRenderer implements SceneRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera = new Camera();
  private readonly onPick: ((id: SceneSelection) => void) | undefined;
  private starfield: Starfield;
  private fx: ScreenFx;
  private seed: string;

  private width = 2;
  private height = 2;
  private dpr = 1;
  private time = 0;
  private frameCount = 0;
  private lastFrameAt = 0;
  private failures = 0;
  private dead = false;
  private disposed = false;
  private resizeWarned = false;

  private lastScene: RenderScene | null = null;
  private readonly pulseBirths = new Map<string, number>();
  private readonly listeners: BoundListener[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;

  private dragging = false;
  private dragMoved = 0;
  private lastPointer: Point = { x: 0, y: 0 };
  private hoverId: SceneSelection = null;

  constructor(options: RendererOptions, ctx: CanvasRenderingContext2D) {
    this.canvas = options.canvas;
    this.ctx = ctx;
    this.seed = options.seed ? String(options.seed) : "trisolaris";
    this.onPick = options.onPick;
    this.starfield = createStarfield(this.seed);
    this.fx = createScreenFx();
    try {
      this.attach();
    } catch {
      /* 事件绑定失败不应阻止渲染器构造 */
    }
    try {
      this.syncViewport(true);
    } catch {
      /* 初始尺寸测量失败时留待后续 frame 内重试 */
    }
  }

  /* ---------------------------------------------------------------- *
   *  生命周期 / 尺寸                                                  *
   * ---------------------------------------------------------------- */

  resize(): void {
    if (this.disposed) return;
    try {
      if (this.syncViewport(true)) this.requestIdleRedraw();
    } catch (err) {
      if (!this.resizeWarned) {
        this.resizeWarned = true;
        console.warn("[render] 画布尺寸同步失败：", err);
      }
    }
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch {
        /* ignore */
      }
      this.resizeObserver = null;
    }
    if (this.rafId !== 0 && typeof cancelAnimationFrame === "function") {
      try {
        cancelAnimationFrame(this.rafId);
      } catch {
        /* ignore */
      }
    }
    this.rafId = 0;
    this.starfield.destroy();
    this.fx.destroy();
    clearStarSpriteCache();
    this.pulseBirths.clear();
    this.lastScene = null;
  }

  frame(scene: RenderScene, dtSeconds: number): void {
    if (this.disposed || this.dead) return;
    if (!scene || !Array.isArray(scene.stars)) return;
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0.016, 0, 0.1);
    try {
      this.render(scene, dt);
    } catch (err) {
      this.failures += 1;
      if (this.failures === 1) console.warn("[render] 帧渲染异常，进入降级保护：", err);
      if (this.failures >= 6) {
        this.dead = true;
        this.detach();
      }
    }
  }

  zoomBy(factor: number): void {
    if (this.disposed) return;
    this.camera.zoomBy(Number.isFinite(factor) && factor > 0 ? factor : 1);
    this.requestIdleRedraw();
  }

  resetView(): void {
    if (this.disposed) return;
    const scene = this.lastScene;
    const base =
      scene && Number.isFinite(scene.recommendedRadiusAU) ? scene.recommendedRadiusAU : this.camera.baseRadius;
    this.camera.reset(base);
    this.requestIdleRedraw();
  }

  /* ---------------------------------------------------------------- *
   *  帧渲染                                                          *
   * ---------------------------------------------------------------- */

  private render(scene: RenderScene, dt: number): void {
    const ctx = this.ctx;
    const now = nowMs();
    const realDt = this.lastFrameAt > 0 ? clamp((now - this.lastFrameAt) / 1000, 0, 0.25) : clamp(dt, 0, 0.1);
    this.lastFrameAt = now;
    this.time += realDt;
    this.frameCount += 1;

    // 兜底尺寸检测（主循环没有调 resize() 或容器尺寸变化时）
    if (this.frameCount % 30 === 0) this.syncViewport(false);

    if (scene.seed && scene.seed !== this.seed) {
      this.seed = scene.seed;
      this.starfield.destroy();
      this.starfield = createStarfield(this.seed);
      this.starfield.resize(this.width, this.height, this.dpr);
    }

    this.lastScene = scene;
    this.camera.setBaseRadius(
      Number.isFinite(scene.recommendedRadiusAU) ? scene.recommendedRadiusAU : this.camera.baseRadius,
    );
    this.camera.update(realDt);

    const settings = scene.settings ?? DEFAULT_SETTINGS;
    if (typeof ctx.setTransform === "function") ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // 背景 → 网格 → 脉冲 → 轨迹 → 恒星 → 行星 → 选中 → 标签 → 后期 → HUD
    this.starfield.draw(ctx, this.camera, this.time);
    if (settings.showGrid) drawGrid(ctx, this.camera);
    if (scene.pulses && scene.pulses.length > 0) {
      drawPulses(ctx, this.camera, scene.pulses, this.time, this.pulseBirths);
    }
    drawUncertaintyBands(ctx, this.camera, scene);
    drawTrails(ctx, this.camera, scene);
    drawStarUncertainty(ctx, this.camera, scene);
    drawStars(ctx, this.camera, scene, this.time);
    drawPlanet(ctx, this.camera, scene, this.time);
    drawSelection(ctx, this.camera, scene, this.time);
    if (settings.showLabels) drawLabels(ctx, this.camera, scene, this.width, this.height);
    this.fx.draw(ctx, this.width, this.height, this.time);
    drawHud(ctx, this.camera, scene, this.width, this.height);
    drawFrameCorners(ctx, this.width, this.height);
  }

  /** 主循环停止（暂停且无外部 frame 调用）时，交互也能立刻出图。 */
  private requestIdleRedraw(): void {
    if (this.disposed || this.dead || this.rafId !== 0) return;
    if (typeof requestAnimationFrame !== "function") return;
    if (nowMs() - this.lastFrameAt < 120) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (this.disposed || this.dead || !this.lastScene) return;
      this.frame(this.lastScene, 0.016);
    });
  }

  /* ---------------------------------------------------------------- *
   *  尺寸与 DPR                                                      *
   * ---------------------------------------------------------------- */

  private syncViewport(force: boolean): boolean {
    const dims = this.measureViewport();
    const dpr = this.computeDpr(dims.w, dims.h);
    if (
      !force &&
      dims.w === this.width &&
      dims.h === this.height &&
      Math.abs(dpr - this.dpr) < 0.001
    ) {
      return false;
    }
    this.width = dims.w;
    this.height = dims.h;
    this.dpr = dpr;
    const pw = Math.max(1, Math.round(dims.w * dpr));
    const ph = Math.max(1, Math.round(dims.h * dpr));
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    if (typeof this.ctx.setTransform === "function") this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.setViewport(dims.w, dims.h, dpr);
    this.starfield.resize(dims.w, dims.h, dpr);
    this.fx.resize(dims.w, dims.h);
    return true;
  }

  private measureViewport(): { w: number; h: number } {
    const canvas = this.canvas;
    let w = canvas.clientWidth || 0;
    let h = canvas.clientHeight || 0;
    if (w < 4 || h < 4) {
      const parent = canvas.parentElement;
      if (parent) {
        w = parent.clientWidth || w;
        h = parent.clientHeight || h;
      }
    }
    if (w < 4 || h < 4) {
      if (typeof window !== "undefined") {
        w = window.innerWidth || w;
        h = window.innerHeight || h;
      }
    }
    return {
      w: Math.max(2, Math.floor(w || 1280)),
      h: Math.max(2, Math.floor(h || 720)),
    };
  }

  private computeDpr(w: number, h: number): number {
    let dpr = 1;
    if (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) {
      dpr = window.devicePixelRatio;
    }
    dpr = clamp(dpr, 1, 2);
    const pixels = w * h * dpr * dpr;
    if (pixels > MAX_CANVAS_PIXELS) {
      dpr = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, w * h)));
    }
    return Math.round(dpr * 100) / 100;
  }

  /* ---------------------------------------------------------------- *
   *  交互                                                            *
   * ---------------------------------------------------------------- */

  private localPoint(ev: { clientX?: number; clientY?: number; offsetX?: number; offsetY?: number }): Point {
    const canvas = this.canvas;
    const cx = typeof ev.clientX === "number" ? ev.clientX : 0;
    const cy = typeof ev.clientY === "number" ? ev.clientY : 0;
    let rect: DOMRect | null = null;
    try {
      rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    } catch {
      rect = null;
    }
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        x: ((cx - rect.left) / rect.width) * this.width,
        y: ((cy - rect.top) / rect.height) * this.height,
      };
    }
    return {
      x: typeof ev.offsetX === "number" ? ev.offsetX : 0,
      y: typeof ev.offsetY === "number" ? ev.offsetY : 0,
    };
  }

  /** 拾取：优先最近的恒星 / 行星，返回 null 表示点空白处。 */
  private pickAt(x: number, y: number): SceneSelection {
    const scene = this.lastScene;
    if (!scene) return null;
    let best: SceneSelection = null;
    let bestDist = Infinity;

    for (let i = 0; i < scene.stars.length; i++) {
      const star = scene.stars[i];
      const p = this.camera.worldToScreen(planeX(star.pos), planeY(star.pos));
      const r = Math.max(PICK_MIN_RADIUS, starVisualRadius(star, this.camera) + PICK_MIN_RADIUS);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= r && d < bestDist) {
        bestDist = d;
        best = star.id;
      }
    }

    if (scene.planet) {
      const p = this.camera.worldToScreen(planeX(scene.planet.pos), planeY(scene.planet.pos));
      const r = Math.max(PICK_MIN_RADIUS, planetVisualRadius(this.camera, scene.planet) + PICK_MIN_RADIUS);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= r && d < bestDist) {
        bestDist = d;
        best = "planet";
      }
    }
    return best;
  }

  /** 双击：聚焦当前选中天体，无选中则复位视野。 */
  private focusSelection(): void {
    const scene = this.lastScene;
    if (!scene) return;
    const sel = scene.selection;
    if (sel === "planet" && scene.planet) {
      this.camera.focusOn(planeX(scene.planet.pos), planeY(scene.planet.pos));
      this.camera.zoomBy(2.4);
    } else if (sel) {
      let star: SceneStar | null = null;
      for (let i = 0; i < scene.stars.length; i++) {
        if (scene.stars[i].id === sel) {
          star = scene.stars[i];
          break;
        }
      }
      if (star) {
        this.camera.focusOn(planeX(star.pos), planeY(star.pos));
        this.camera.zoomBy(2.7);
      } else {
        this.resetView();
      }
    } else {
      this.resetView();
    }
    this.requestIdleRedraw();
  }

  private updateCursor(): void {
    const style = this.canvas.style;
    if (!style) return;
    const next = this.dragging ? "grabbing" : this.hoverId ? "pointer" : "grab";
    if (style.cursor !== next) style.cursor = next;
  }

  /* ---------------------------------------------------------------- *
   *  事件绑定                                                        *
   * ---------------------------------------------------------------- */

  private handleWheel = (ev: WheelEvent): void => {
    if (this.disposed) return;
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
    const rawDelta = Number.isFinite(ev.deltaY) ? ev.deltaY : 0;
    const dy = ev.deltaMode === 1 ? rawDelta * 16 : ev.deltaMode === 2 ? rawDelta * this.height : rawDelta;
    const factor = Math.exp(-dy * 0.0015);
    const pt = this.localPoint(ev);
    this.camera.zoomAt(pt.x, pt.y, factor);
    this.requestIdleRedraw();
  };

  private handlePointerDown = (ev: PointerEvent): void => {
    if (this.disposed) return;
    if (typeof ev.button === "number" && ev.button !== 0) return;
    this.dragging = true;
    this.dragMoved = 0;
    this.lastPointer = this.localPoint(ev);
    if (typeof this.canvas.setPointerCapture === "function" && typeof ev.pointerId === "number") {
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    this.updateCursor();
  };

  private handlePointerMove = (ev: PointerEvent): void => {
    if (this.disposed) return;
    const pt = this.localPoint(ev);
    if (this.dragging) {
      const dx = pt.x - this.lastPointer.x;
      const dy = pt.y - this.lastPointer.y;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      if (this.dragMoved > 3) {
        this.camera.panByPixels(dx, dy);
        this.requestIdleRedraw();
      }
      this.lastPointer = pt;
      return;
    }
    const hovered = this.pickAt(pt.x, pt.y);
    if (hovered !== this.hoverId) {
      this.hoverId = hovered;
      this.updateCursor();
    }
  };

  private handlePointerUp = (ev: PointerEvent): void => {
    if (this.disposed) return;
    if (!this.dragging) return;
    const pt = this.localPoint(ev);
    const wasDrag = this.dragMoved > 4;
    this.dragging = false;
    if (typeof this.canvas.releasePointerCapture === "function" && typeof ev.pointerId === "number") {
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    this.updateCursor();
    if (!wasDrag && this.onPick) {
      this.onPick(this.pickAt(pt.x, pt.y));
    }
  };

  private handlePointerCancel = (): void => {
    this.dragging = false;
    this.dragMoved = 0;
    this.updateCursor();
  };

  private handlePointerLeave = (): void => {
    if (this.dragging) return;
    if (this.hoverId !== null) {
      this.hoverId = null;
      this.updateCursor();
    }
  };

  private handleDoubleClick = (ev: MouseEvent): void => {
    if (this.disposed) return;
    try {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    } catch {
      /* ignore */
    }
    this.focusSelection();
  };

  private handleWindowResize = (): void => {
    this.resize();
  };

  private listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void {
    try {
      target.addEventListener(type, handler, options);
      this.listeners.push({ target, type, handler, options });
    } catch {
      /* 该环境不支持此事件类型 */
    }
  }

  private attach(): void {
    this.listen(this.canvas, "wheel", this.handleWheel as unknown as EventListener, { passive: false });
    this.listen(this.canvas, "pointerdown", this.handlePointerDown as unknown as EventListener);
    this.listen(this.canvas, "pointermove", this.handlePointerMove as unknown as EventListener);
    this.listen(this.canvas, "pointerup", this.handlePointerUp as unknown as EventListener);
    this.listen(this.canvas, "pointercancel", this.handlePointerCancel as unknown as EventListener);
    this.listen(this.canvas, "pointerleave", this.handlePointerLeave as unknown as EventListener);
    this.listen(this.canvas, "dblclick", this.handleDoubleClick as unknown as EventListener);
    if (typeof window !== "undefined") {
      this.listen(window, "resize", this.handleWindowResize as unknown as EventListener);
    }
    try {
      if (this.canvas.style) this.canvas.style.touchAction = "none";
    } catch {
      /* ignore */
    }
    if (typeof ResizeObserver !== "undefined") {
      try {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
      } catch {
        this.resizeObserver = null;
      }
    }
  }

  private detach(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      const l = this.listeners[i];
      try {
        l.target.removeEventListener(l.type, l.handler, l.options);
      } catch {
        /* ignore */
      }
    }
    this.listeners.length = 0;
  }
}

/** 空实现：无 Canvas 2D 环境（jsdom / 测试）下的完全降级。 */
export function createNoopRenderer(): SceneRenderer {
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
    zoomBy(): void {
      /* no-op */
    },
    resetView(): void {
      /* no-op */
    },
  };
}

/**
 * 创建场景渲染器。
 * 无 2D context 时返回 no-op 实现，绝不抛异常 —— 主循环可以无脑调用。
 */
export function createRenderer(options: RendererOptions): SceneRenderer {
  try {
    if (!options || !options.canvas) return createNoopRenderer();
    const ctx = get2dContext(options.canvas);
    if (!ctx) return createNoopRenderer();
    return new CanvasSceneRenderer(options, ctx);
  } catch (err) {
    console.warn("[render] 渲染器初始化失败，使用空实现：", err);
    return createNoopRenderer();
  }
}

export default createRenderer;