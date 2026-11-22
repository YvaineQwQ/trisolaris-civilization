/**
 * shared-3d.ts —— 3D 辅助视图内部共享的类型与常量。
 *
 * 这些类型只服务于 src/render3d/**，不进入冻结契约（契约在 src/game/viewTypes.ts）。
 */
import type { PerspectiveCamera } from "three";
import type { Vec3 } from "../core/math";
import type { RenderScene3D, ViewSettings } from "../game/viewTypes";

/** 选中标识（StarId | "planet" | null），直接从冻结契约派生。 */
export type Selection3D = RenderScene3D["selection"];

/** 可拾取/可标注的天体 id（不含 null）。 */
export type BodyId3D = Exclude<Selection3D, null>;

/** 视图设置缺省值：scene.settings 缺失时的安全兜底。 */
export const DEFAULT_VIEW_SETTINGS_3D: ViewSettings = {
  showTrails: true,
  showPrediction: true,
  showGrid: true,
  showLabels: true,
  showUncertainty: true,
};

/** 判断任意值是否为合法天体 id（用于拾取结果校验）。 */
export function isBodyId3D(id: unknown): id is BodyId3D {
  return id === "A" || id === "B" || id === "C" || id === "planet";
}

/** 每帧一次性组装的只读视图上下文（对象复用，避免帧内分配）。 */
export interface ViewerFrame {
  camera: PerspectiveCamera;
  /** 视口 CSS 宽高。 */
  width: number;
  height: number;
  /** 渲染器启动以来的秒数（仅用于视觉呼吸/旋转动画，不参与物理）。 */
  time: number;
  /** 场景推荐视野半径（= RenderScene3D.recommendedRadiusAU，AU）。 */
  viewRadius: number;
  /** 相机到轨道中心的距离（AU），用于视觉尺寸自适应。 */
  cameraDistance: number;
  settings: ViewSettings;
  selection: Selection3D;
  /** false 时隐藏高度/倾角标注（3D 空间本身照常渲染）。 */
  heightDataAvailable: boolean;
  /** 近景模式的目标天体（null = 全景模式）；标签层与 HUD 据此切换呈现。 */
  nearBody: BodyId3D | null;
  /** 渲染质量：软件渲染（SwiftShader 等）时降级分段/特效。 */
  quality: "high" | "low";
  /** 近景视觉半径（世界 AU）；全景模式为 0。 */
  nearRadius: number;
}

/** 天体锚点：投影 HTML 标签与拾取代理球共用的位置/视觉半径。 */
export interface BodyAnchor {
  id: BodyId3D;
  /** 世界坐标（AU）。 */
  pos: Vec3;
  /** 当前帧的视觉半径（AU，已按相机距离自适应）。 */
  worldRadius: number;
  /** 该天体的显示颜色（CSS 颜色字符串）。 */
  color: string;
}

/** 选中天体到其他天体的三维距离标注。 */
export interface DistancePair {
  from: Vec3;
  to: Vec3;
  mid: Vec3;
  distanceAU: number;
  /** 高度差（AU）；heightDataAvailable = false 时为 null，标签不显示高度信息。 */
  deltaHeightAU: number | null;
  color: string;
}

/** 距离标注的复用容器（避免每帧创建数组/对象）。 */
export interface DistancePairView {
  readonly items: DistancePair[];
  count: number;
}

/** 轴向指示（X/Y/Z 轴末端）的 HTML 标签锚点。 */
export interface AxisAnchor {
  label: string;
  pos: Vec3;
}