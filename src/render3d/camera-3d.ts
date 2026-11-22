/**
 * camera-3d.ts —— 3D 辅助视图的轨道相机（自写指针控制，不引入 OrbitControls 依赖）。
 *
 * 两套模式：
 *  - orbit（全景）：绕轨道中心旋转；滚轮以轨道中心为锚点缩放；右键/中键平移；
 *    预设俯视 / 侧视 / 自由；
 *  - near（天体近景）：点击天体后由渲染器调用 enterNear()，相机在 0.85s 内缓出到
 *    目标天体；近景中拖拽绕该天体旋转、滚轮在该天体表面尺度的限位内缩放，并每帧跟随
 *    天体位置；exitNear()/setPreset()/reset() 会平滑回原机位。
 *
 * 视角状态用球坐标（theta 方位角 / phi 极角 / radius 距离）+ 轨道中心描述；
 * 普通交互用指数阻尼，进入/退出近景用显式缓出补间（0.6–1.0s，符合 V4 规格）。
 */
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3 } from "../core/math";
import { clamp, lerp } from "./math-3d";
import { NEAR_DISTANCE_FACTOR, NEAR_MAX_FACTOR, NEAR_MIN_FACTOR } from "./near-view-3d";

export type ViewPreset3D = "top" | "side" | "free";
export type CameraMode3D = "orbit" | "near";

export const CAMERA_FOV_3D = 45;

/** 初始斜视方位角 / 极角。 */
const DEFAULT_THETA = 0.86;
const DEFAULT_PHI = 1.02;
/** 相机距离相对场景推荐半径的倍数。 */
const BASE_DISTANCE_FACTOR = 2.2;
const MIN_DISTANCE_FACTOR = 0.06;
const MAX_DISTANCE_FACTOR = 9;
/** 极角限制：避免相机与 up 向量共线导致 lookAt 退化，也避免穿透参考平面。 */
const MIN_POLAR = 0.07;
const MAX_POLAR = Math.PI - 0.07;
/** 俯瞰预设的极角（接近但不到 0，保持 lookAt 数值稳定）。 */
const TOP_POLAR = 0.085;
/** 轨道中心可偏离原点的最大距离（× 推荐半径），防止把系统拖出视野。 */
const MAX_TARGET_OFFSET_FACTOR = 5;
/** 普通阻尼系数（每秒）。 */
const DAMPING = 15;
/** 近景相机动画时长（秒），规格要求 0.6–1.0s 缓出。 */
export const NEAR_TRANSITION_SECONDS = 0.85;

interface CameraPose {
  theta: number;
  phi: number;
  distance: number;
  tx: number;
  ty: number;
  tz: number;
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export class OrbitCamera3D {
  readonly camera: PerspectiveCamera;
  /** 轨道中心（只读引用；外部不要修改）。 */
  readonly target = new Vector3();

  private baseRadius = 3;
  private minDistance = 0.18;
  private maxDistance = 27;
  private theta = DEFAULT_THETA;
  private goalTheta = DEFAULT_THETA;
  private phi = DEFAULT_PHI;
  private goalPhi = DEFAULT_PHI;
  private distance = BASE_DISTANCE_FACTOR * 3;
  private goalDistance = BASE_DISTANCE_FACTOR * 3;
  private readonly goalTarget = new Vector3();
  private viewportWidth = 640;
  private viewportHeight = 360;
  private lastNear = -1;
  private lastFar = -1;
  private moving = false;
  private readonly tmpRight = new Vector3();
  private readonly tmpUp = new Vector3();

  /** 当前模式 / 近景状态。 */
  private mode: CameraMode3D = "orbit";
  private nearRadius = 0;
  /** 进入近景前的全景机位（退出时平滑恢复）。 */
  private savedPose: CameraPose | null = null;
  /** 近景补间动画。 */
  private tween: { from: CameraPose; to: CameraPose; progress: number; duration: number } | null = null;

  constructor() {
    this.camera = new PerspectiveCamera(CAMERA_FOV_3D, 16 / 9, 0.01, 200);
    this.goalTarget.set(0, 0, 0);
    this.applyPosition(true);
  }

  /** 场景推荐视野半径（= RenderScene3D.recommendedRadiusAU）。 */
  get viewRadius(): number {
    return this.baseRadius;
  }

  /** 当前相机到轨道中心的距离（AU）。 */
  get cameraDistance(): number {
    return this.distance;
  }

  /** 预设过渡 / 聚焦动画是否仍在进行。 */
  get isMoving(): boolean {
    return this.moving;
  }

  /** 是否处于近景模式。 */
  get isNear(): boolean {
    return this.mode === "near";
  }

  /** 近景/退出补间是否进行中。 */
  get isTransitioning(): boolean {
    return this.tween !== null;
  }

  /** 近景缩放限位（世界 AU），供 HUD 提示与 QA 断言。 */
  get zoomRange(): { min: number; max: number; current: number } {
    return { min: this.minDistance, max: this.maxDistance, current: this.distance };
  }

  get presetOrientation(): { theta: number; phi: number } {
    return { theta: this.goalTheta, phi: this.goalPhi };
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(2, Math.floor(Number.isFinite(width) ? width : 2));
    this.viewportHeight = Math.max(2, Math.floor(Number.isFinite(height) ? height : 2));
    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.updateProjectionMatrix();
  }

  /** 同步场景推荐半径；变化时保持相对缩放，并把限位重新计算（近景不动近景尺度）。 */
  setBaseRadius(base: number): void {
    const next = Number.isFinite(base) && base > 1e-6 ? base : this.baseRadius;
    if (Math.abs(next - this.baseRadius) > Math.max(1e-5, this.baseRadius * 1e-3)) {
      const ratio = next / this.baseRadius;
      this.baseRadius = next;
      if (this.mode === "orbit") {
        this.applyZoomLimits();
        this.distance = clamp(this.distance * ratio, this.minDistance, this.maxDistance);
        this.goalDistance = clamp(this.goalDistance * ratio, this.minDistance, this.maxDistance);
      }
    }
    this.applyPosition(false);
  }

  /**
   * 每帧推进：补间优先，否则按阻尼趋近目标值，并在同一帧写回相机。
   * dtSeconds 由 UI 主循环提供（0 表示立即收敛，用于 resize 后补一次姿态）。
   */
  update(dtSeconds: number): void {
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0.016, 0, 0.1);
    if (this.tween) {
      const tween = this.tween;
      tween.progress = clamp(tween.progress + dt / Math.max(0.05, tween.duration), 0, 1);
      const k = easeOutCubic(tween.progress);
      this.theta = lerp(tween.from.theta, tween.to.theta, k);
      this.phi = lerp(tween.from.phi, tween.to.phi, k);
      this.distance = lerp(tween.from.distance, tween.to.distance, k);
      this.target.set(
        lerp(tween.from.tx, tween.to.tx, k),
        lerp(tween.from.ty, tween.to.ty, k),
        lerp(tween.from.tz, tween.to.tz, k),
      );
      this.moving = true;
      if (tween.progress >= 1) {
        this.tween = null;
        this.theta = tween.to.theta;
        this.phi = tween.to.phi;
        this.distance = tween.to.distance;
        this.target.set(tween.to.tx, tween.to.ty, tween.to.tz);
      }
      this.applyPosition(false);
      return;
    }
    const k = dt > 0 ? 1 - Math.exp(-DAMPING * dt) : 1;
    this.theta = lerp(this.theta, this.goalTheta, k);
    this.phi = lerp(this.phi, this.goalPhi, k);
    this.distance = lerp(this.distance, this.goalDistance, k);
    this.target.lerp(this.goalTarget, k);
    this.moving =
      Math.abs(this.goalTheta - this.theta) > 1e-4 ||
      Math.abs(this.goalPhi - this.phi) > 1e-4 ||
      Math.abs(this.goalDistance - this.distance) > Math.max(1e-5, this.distance * 1e-4) ||
      this.target.distanceToSquared(this.goalTarget) > Math.max(1e-10, this.baseRadius * this.baseRadius * 1e-8);
    this.applyPosition(false);
  }

  /* ------------------------------------------------------------------ *
   *  近景模式                                                          *
   * ------------------------------------------------------------------ */

  /**
   * 平滑进入天体近景（或从近景平滑切换目标）。
   * @param pos 天体世界坐标
   * @param surfaceRadius 近景视觉半径（世界 AU；决定取景与缩放限位）
   * @param orientation 入场方位（theta/phi），省略时沿用当前方位
   * @param duration 补间时长（默认 0.85s）
   */
  enterNear(pos: Vec3, surfaceRadius: number, orientation?: { theta?: number; phi?: number }, duration = NEAR_TRANSITION_SECONDS): void {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    const radius = Number.isFinite(surfaceRadius) && surfaceRadius > 1e-9 ? surfaceRadius : Math.max(1e-4, this.baseRadius * 0.02);
    if (this.mode === "near") {
      this.nearRadius = radius;
      this.applyZoomLimits();
      this.cancelTweenIntoGoals();
      this.startTween(this.composeNearPose(pos, radius, orientation), this.clampDuration(duration));
      return;
    }
    this.savedPose = this.currentPose();
    this.mode = "near";
    this.nearRadius = radius;
    this.applyZoomLimits();
    this.startTween(this.composeNearPose(pos, radius, orientation), this.clampDuration(duration));
  }

  /** 近景尺度变化（切换天体时视觉半径不同）。 */
  setNearSurfaceRadius(surfaceRadius: number): void {
    if (this.mode !== "near") return;
    const radius = Number.isFinite(surfaceRadius) && surfaceRadius > 1e-9 ? surfaceRadius : this.nearRadius;
    if (!(radius > 0)) return;
    const ratio = radius / Math.max(1e-9, this.nearRadius);
    this.nearRadius = radius;
    this.applyZoomLimits();
    if (Math.abs(ratio - 1) > 1e-3) {
      this.goalDistance = clamp(this.goalDistance * ratio, this.minDistance, this.maxDistance);
    }
  }

  /** 每帧跟随目标天体（天体在观测数据更新时会缓慢移动）。 */
  trackNearTarget(pos: Vec3): void {
    if (this.mode !== "near" || this.tween) return;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    this.goalTarget.set(pos.x, pos.y, pos.z);
  }

  /**
   * 平滑退出近景，回到进入前的全景机位。
   * @returns 是否确实从近景退出
   */
  exitNear(duration = NEAR_TRANSITION_SECONDS): boolean {
    if (this.mode !== "near") return false;
    const restore = this.savedPose ?? this.defaultPose();
    this.mode = "orbit";
    this.savedPose = null;
    this.nearRadius = 0;
    this.applyZoomLimits();
    this.startTween(restore, this.clampDuration(duration));
    return true;
  }

  /** 立即重置近景状态（销毁/重建时使用，不做动画）。 */
  clearNearState(): void {
    this.mode = "orbit";
    this.savedPose = null;
    this.nearRadius = 0;
    this.tween = null;
    this.applyZoomLimits();
  }

  /** 左键拖动旋转（像素增量；立即生效）。 */
  rotateByPixels(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.cancelTweenIntoGoals();
    const nextTheta = this.goalTheta - dx * 0.0055;
    const nextPhi = clamp(this.goalPhi - dy * 0.0055, MIN_POLAR, MAX_POLAR);
    this.goalTheta = nextTheta;
    this.goalPhi = nextPhi;
    this.theta = nextTheta;
    this.phi = nextPhi;
    this.applyPosition(false);
  }

  /** 右键/中键拖动平移（像素增量；立即生效；近景模式忽略，避免把天体拖出取景）。 */
  panByPixels(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (dx === 0 && dy === 0) return;
    if (this.mode === "near") return;
    this.cancelTweenIntoGoals();
    const worldPerPixel =
      (2 * this.distance * Math.tan((CAMERA_FOV_3D * Math.PI) / 360)) / this.viewportHeight;
    const right = this.tmpRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = this.tmpUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.goalTarget.addScaledVector(right, -dx * worldPerPixel);
    this.goalTarget.addScaledVector(up, dy * worldPerPixel);
    this.clampTarget();
    this.target.copy(this.goalTarget);
    this.applyPosition(false);
  }

  /** 滚轮缩放：factor > 1 拉近，< 1 推远（指数阻尼；限位随模式变化）。 */
  zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.cancelTweenIntoGoals();
    const f = clamp(factor, 0.2, 5);
    this.goalDistance = clamp(this.goalDistance / f, this.minDistance, this.maxDistance);
  }

  /** 平滑聚焦到指定世界坐标；distance 省略时按推荐半径取景。 */
  focus(pos: Vec3, distance?: number): void {
    if (this.mode === "near") return;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    this.goalTarget.set(pos.x, pos.y, pos.z);
    this.clampTarget();
    const wanted = Number.isFinite(distance as number) ? (distance as number) : this.baseRadius * 0.4;
    this.goalDistance = clamp(wanted, this.minDistance, this.maxDistance);
  }

  /** 回到初始自由视角（原点 + 推荐取景距离 + 默认斜视方位）；近景下先平滑退出。 */
  reset(): void {
    if (this.mode === "near") {
      this.exitNear();
      return;
    }
    this.goalTarget.set(0, 0, 0);
    this.goalTheta = DEFAULT_THETA;
    this.goalPhi = DEFAULT_PHI;
    this.goalDistance = clamp(this.baseRadius * BASE_DISTANCE_FACTOR, this.minDistance, this.maxDistance);
  }

  /**
   * 切换预设视角（平滑过渡）。近景下切换预设 = 平滑退出近景并落到该全景预设。
   */
  setPreset(preset: ViewPreset3D): void {
    if (this.mode === "near") {
      this.mode = "orbit";
      this.savedPose = null;
      this.nearRadius = 0;
      this.applyZoomLimits();
      this.startTween(this.presetPose(preset), NEAR_TRANSITION_SECONDS);
      return;
    }
    const goal = this.presetPose(preset);
    this.goalTheta = goal.theta;
    this.goalPhi = goal.phi;
    this.goalTarget.set(goal.tx, goal.ty, goal.tz);
    this.goalDistance = clamp(goal.distance, this.minDistance, this.maxDistance);
  }

  /* ------------------------------------------------------------------ *
   *  内部工具                                                          *
   * ------------------------------------------------------------------ */

  private applyZoomLimits(): void {
    if (this.mode === "near") {
      const radius = Math.max(1e-6, this.nearRadius);
      this.minDistance = Math.max(1e-5, radius * NEAR_MIN_FACTOR);
      this.maxDistance = Math.max(this.minDistance * 1.8, radius * NEAR_MAX_FACTOR);
      this.goalDistance = clamp(this.goalDistance, this.minDistance, this.maxDistance);
      this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
      return;
    }
    this.minDistance = Math.max(0.02, this.baseRadius * MIN_DISTANCE_FACTOR);
    this.maxDistance = Math.max(2, this.baseRadius * MAX_DISTANCE_FACTOR);
    this.goalDistance = clamp(this.goalDistance, this.minDistance, this.maxDistance);
    this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
  }

  private clampDuration(duration: number): number {
    if (!Number.isFinite(duration)) return NEAR_TRANSITION_SECONDS;
    return clamp(duration, 0.3, 2);
  }

  private currentPose(): CameraPose {
    return {
      theta: this.theta,
      phi: this.phi,
      distance: this.distance,
      tx: this.target.x,
      ty: this.target.y,
      tz: this.target.z,
    };
  }

  private defaultPose(): CameraPose {
    return {
      theta: DEFAULT_THETA,
      phi: DEFAULT_PHI,
      distance: clamp(this.baseRadius * BASE_DISTANCE_FACTOR, this.minDistance, this.maxDistance),
      tx: 0,
      ty: 0,
      tz: 0,
    };
  }

  private presetPose(preset: ViewPreset3D): CameraPose {
    if (preset === "top") {
      return {
        theta: 0,
        phi: TOP_POLAR,
        distance: clamp(this.baseRadius * 2.15, this.minDistance, this.maxDistance),
        tx: 0,
        ty: 0,
        tz: 0,
      };
    }
    if (preset === "side") {
      return {
        theta: 0,
        phi: Math.PI / 2,
        distance: clamp(this.baseRadius * 2.3, this.minDistance, this.maxDistance),
        tx: 0,
        ty: 0,
        tz: 0,
      };
    }
    return {
      theta: DEFAULT_THETA,
      phi: DEFAULT_PHI,
      distance: clamp(this.baseRadius * BASE_DISTANCE_FACTOR, this.minDistance, this.maxDistance),
      tx: 0,
      ty: 0,
      tz: 0,
    };
  }

  private composeNearPose(pos: Vec3, radius: number, orientation?: { theta?: number; phi?: number }): CameraPose {
    const theta = Number.isFinite(orientation?.theta as number) ? (orientation as { theta: number }).theta : this.goalTheta;
    const phiRaw = Number.isFinite(orientation?.phi as number) ? (orientation as { phi: number }).phi : this.goalPhi;
    const phi = clamp(phiRaw, 0.42, Math.PI - 0.42);
    return {
      theta,
      phi,
      distance: clamp(radius * NEAR_DISTANCE_FACTOR, this.minDistance, this.maxDistance),
      tx: pos.x,
      ty: pos.y,
      tz: pos.z,
    };
  }

  /** 开始一段补间；同时把目标值写为目的地，保证补间结束后阻尼不会回弹。 */
  private startTween(to: CameraPose, duration: number): void {
    this.tween = { from: this.currentPose(), to, progress: 0, duration: Math.max(0.05, duration) };
    this.goalTheta = to.theta;
    this.goalPhi = to.phi;
    this.goalDistance = clamp(to.distance, this.minDistance, this.maxDistance);
    this.goalTarget.set(to.tx, to.ty, to.tz);
    this.moving = true;
  }

  /** 用户输入打断补间：保留目标值，从当前姿态继续阻尼（无跳变）。 */
  private cancelTweenIntoGoals(): void {
    if (!this.tween) return;
    this.tween = null;
    this.goalTheta = this.theta;
    this.goalPhi = this.phi;
  }

  private clampTarget(): void {
    const limit = Math.max(1e-3, this.baseRadius * MAX_TARGET_OFFSET_FACTOR);
    const len = this.goalTarget.length();
    if (len > limit) this.goalTarget.multiplyScalar(limit / len);
  }

  /** 把球坐标写回相机（位置 / 朝向 / 近远裁剪面）。 */
  private applyPosition(force: boolean): void {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);
    this.camera.position.set(
      this.target.x + this.distance * sinPhi * sinTheta,
      this.target.y + this.distance * cosPhi,
      this.target.z + this.distance * sinPhi * cosTheta,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    // 近景时把近裁剪面抬到取景距离的 ~2%，尽量保留 24bit 深度精度（云层壳/大气壳间距很小）。
    const near = this.mode === "near"
      ? clamp(this.distance * 0.02, 0.0004, 5)
      : clamp(this.distance * 0.0015, 0.0008, 5);
    const far = this.mode === "near"
      ? Math.max(120, this.distance * 90)
      : Math.max(200, this.distance * 8 + this.baseRadius * 40);
    if (
      force ||
      Math.abs(near - this.lastNear) > Math.max(this.lastNear * 0.08, 1e-6) ||
      Math.abs(far - this.lastFar) > Math.max(this.lastFar * 0.08, 1e-4)
    ) {
      this.camera.near = near;
      this.camera.far = far;
      this.lastNear = near;
      this.lastFar = far;
      this.camera.updateProjectionMatrix();
    }
    // 投影/拾取/标签都读取 matrixWorld，本帧必须是最新的。
    this.camera.updateMatrixWorld();
  }
}
