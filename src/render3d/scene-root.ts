/**
 * scene-root.ts —— 三维场景"家具"：深空背景、种子确定性星点、X-Z 参考网格、轴向指示。
 *
 * 设计要点：
 *  - 背景是程序化径向渐变 CanvasTexture（不参与深度）；
 *  - 星空用 Points 生成：位置/颜色由 seed 确定性决定，相机移动时星穹跟随相机（无限远近似），
 *    关闭深度测试并以 renderOrder 最先绘制，保证永远位于所有天体之后；
 *  - 参考网格只画在 X-Z 平面（物理中的"轨道参考面"），极低透明度；
 *  - 轴向指示画 +X / +Y / +Z 三条轴线与单位刻度，末端 anchor 由 HTML 标签层显示 "X · AU"。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Texture,
  type PerspectiveCamera,
} from "three";
import type { Vec3 } from "../core/math";
import { clamp, v3 } from "./math-3d";
import type { AxisAnchor } from "./shared-3d";
import {
  PALETTE_3D,
  colorForTempK,
  createBackgroundTexture,
  getSoftDotTexture,
  hashString,
  mulberry32,
  niceNumber,
  TAU,
} from "./theme-3d";

/** 星穹半径（世界单位）：跟随相机，仅作视觉背景。 */
const STAR_DOME_RADIUS = 150;
/** 星点数量：兼顾深空密度与低端 GPU 的填充率。 */
const STAR_DOME_COUNT = 1500;

export interface SceneRoot {
  readonly group: Group;
  /** 深空渐变背景纹理（由调用方挂到 scene.background，销毁时先置 null）。 */
  readonly background: Texture | null;
  /** 参考网格 + 轴向指示的可见性（settings.showGrid）。 */
  setShowGrid(show: boolean): void;
  /** 推荐视野半径变化时重建网格/轴线尺度。 */
  setBaseRadius(base: number): void;
  /** 每帧：星穹跟随相机。 */
  update(camera: PerspectiveCamera): void;
  /** 轴向指示末端锚点（HTML 标签用）。 */
  axisAnchors(): readonly AxisAnchor[];
  dispose(): void;
}

function disposeObject3D(root: Group): void {
  root.traverse((obj) => {
    const anyObj = obj as unknown as {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | { dispose?: () => void }[];
    };
    if (anyObj.geometry && typeof anyObj.geometry.dispose === "function") {
      try {
        anyObj.geometry.dispose();
      } catch {
        /* ignore */
      }
    }
    const material = anyObj.material;
    if (Array.isArray(material)) {
      for (const m of material) {
        try {
          m.dispose?.();
        } catch {
          /* ignore */
        }
      }
    } else if (material) {
      try {
        material.dispose?.();
      } catch {
        /* ignore */
      }
    }
  });
}

function createStarDome(seed: string): Points | null {
  const rand = mulberry32(hashString(seed + "|render3d|star-dome"));
  const positions = new Float32Array(STAR_DOME_COUNT * 3);
  const colors = new Float32Array(STAR_DOME_COUNT * 3);
  const color = new Color();
  for (let i = 0; i < STAR_DOME_COUNT; i++) {
    // 均匀球面分布
    const z = 1 - 2 * rand();
    const angle = rand() * TAU;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const i3 = i * 3;
    positions[i3] = Math.cos(angle) * r * STAR_DOME_RADIUS;
    positions[i3 + 1] = z * STAR_DOME_RADIUS;
    positions[i3 + 2] = Math.sin(angle) * r * STAR_DOME_RADIUS;
    // 星点色温 / 亮度与种子确定性相关（真实星空多为冷白，少量暖色）
    const t = rand();
    const tempK = t < 0.72 ? 5200 + rand() * 5200 : t < 0.92 ? 3000 + rand() * 2400 : 8200 + rand() * 6000;
    color.set(colorForTempK(tempK));
    const brightness = 0.22 + Math.pow(rand(), 2.2) * 0.95;
    colors[i3] = color.r * brightness;
    colors[i3 + 1] = color.g * brightness;
    colors[i3 + 2] = color.b * brightness;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  const dot = getSoftDotTexture();
  const material = new PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    alphaTest: 0.01,
    toneMapped: false,
  });
  // 运行环境没有 2D canvas 时不挂 map，避免 THREE.Material 的 "parameter 'map' has value of undefined" 警告。
  if (dot) material.map = dot;
  const points = new Points(geometry, material);
  points.name = "r3d-star-dome";
  points.frustumCulled = false;
  points.renderOrder = -1000;
  return points;
}

export interface SceneRootOptions {
  seed: string;
  baseRadius: number;
}

export function createSceneRoot(options: SceneRootOptions): SceneRoot {
  const seed = options.seed || "trisolaris";
  const group = new Group();
  group.name = "r3d-scene-root";
  const background = createBackgroundTexture();

  const dome = createStarDome(seed);
  if (dome) group.add(dome);

  const gridGroup = new Group();
  gridGroup.name = "r3d-reference-grid";
  const axesGroup = new Group();
  axesGroup.name = "r3d-axes";
  group.add(gridGroup, axesGroup);

  const axisAnchors: AxisAnchor[] = [
    { label: "X", pos: v3(1, 0, 0) },
    { label: "Y", pos: v3(0, 1, 0) },
    { label: "Z", pos: v3(0, 0, 1) },
  ];

  const state = {
    baseRadius: 0,
    gridVisible: true,
    gridBuilt: false,
  };

  let gridMaterials: LineBasicMaterial[] = [];
  let axisMaterials: LineBasicMaterial[] = [];

  function clearGrid(): void {
    for (const child of [...gridGroup.children]) {
      gridGroup.remove(child);
      const obj = child as unknown as { geometry?: { dispose?: () => void } };
      try {
        obj.geometry?.dispose?.();
      } catch {
        /* ignore */
      }
    }
    for (const m of gridMaterials) {
      try {
        m.dispose();
      } catch {
        /* ignore */
      }
    }
    gridMaterials = [];
  }

  function clearAxes(): void {
    for (const child of [...axesGroup.children]) {
      axesGroup.remove(child);
      const obj = child as unknown as { geometry?: { dispose?: () => void } };
      try {
        obj.geometry?.dispose?.();
      } catch {
        /* ignore */
      }
    }
    for (const m of axisMaterials) {
      try {
        m.dispose();
      } catch {
        /* ignore */
      }
    }
    axisMaterials = [];
  }

  function lineSegments(positions: number[], colorHex: string, opacity: number): LineSegments {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    const material = new LineBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    gridMaterials.push(material);
    const lines = new LineSegments(geometry, material);
    lines.frustumCulled = false;
    return lines;
  }

  function rebuildFurniture(base: number): void {
    clearGrid();
    clearAxes();
    const radius = clamp(Number.isFinite(base) ? base : 3, 1e-4, 1e6);
    const extent = radius * 3.4;
    const majorStep = niceNumber(extent / 5);
    const minorStep = majorStep / 5;
    const major: number[] = [];
    const minor: number[] = [];
    const pushLine = (arr: number[], x1: number, z1: number, x2: number, z2: number): void => {
      arr.push(x1, 0, z1, x2, 0, z2);
    };
    const steps = Math.max(2, Math.ceil(extent / majorStep));
    for (let i = -steps; i <= steps; i++) {
      const v = i * majorStep;
      if (Math.abs(v) > extent + 1e-9) continue;
      // 主网格线（平行于 Z 轴 / X 轴）
      if (i !== 0) {
        pushLine(major, v, -extent, v, extent);
        pushLine(major, -extent, v, extent, v);
      }
      // 次网格线（只在主网格之间补 4 条）
      for (let k = 1; k < 5; k++) {
        const mv = v + k * minorStep;
        if (Math.abs(mv) > extent + 1e-9) continue;
        pushLine(minor, mv, -extent, mv, extent);
        pushLine(minor, -extent, mv, extent, mv);
      }
    }
    const minorLines = lineSegments(minor, PALETTE_3D.grid, 0.055);
    const majorLines = lineSegments(major, PALETTE_3D.grid, 0.14);
    gridGroup.add(minorLines, majorLines);

    // 参考面外框（仪器视野感）
    const border: number[] = [
      -extent, 0, -extent, extent, 0, -extent,
      extent, 0, -extent, extent, 0, extent,
      extent, 0, extent, -extent, 0, extent,
      -extent, 0, extent, -extent, 0, -extent,
    ];
    gridGroup.add(lineSegments(border, PALETTE_3D.grid, 0.18));

    // 轴向指示：+X 红 / +Y 绿 / +Z 蓝，单位刻度
    const axisLength = radius * 1.25;
    const axes: { dir: Vec3; color: string }[] = [
      { dir: v3(1, 0, 0), color: PALETTE_3D.axisX },
      { dir: v3(0, 1, 0), color: PALETTE_3D.axisY },
      { dir: v3(0, 0, 1), color: PALETTE_3D.axisZ },
    ];
    const unit = niceNumber(axisLength / 2.6);
    for (let a = 0; a < axes.length; a++) {
      const axis = axes[a];
      const positions: number[] = [0, 0, 0, axis.dir.x * axisLength, axis.dir.y * axisLength, axis.dir.z * axisLength];
      // 刻度短线（每 unit 一个，最多 8 个）
      const tickCount = Math.min(8, Math.floor(axisLength / unit));
      const tickLen = radius * 0.018;
      for (let i = 1; i <= tickCount; i++) {
        const d = i * unit;
        const px = axis.dir.x * d;
        const py = axis.dir.y * d;
        const pz = axis.dir.z * d;
        // 沿垂直于轴的方向画刻度短线：Y 轴沿 X，X/Z 轴沿 Y。
        if (axis.dir.y !== 0) {
          positions.push(px - tickLen, py, pz, px + tickLen, py, pz);
        } else {
          positions.push(px, py - tickLen, pz, px, py + tickLen, pz);
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      const material = new LineBasicMaterial({
        color: new Color(axis.color),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        toneMapped: false,
      });
      axisMaterials.push(material);
      const line = new LineSegments(geometry, material);
      line.frustumCulled = false;
      axesGroup.add(line);
      const anchor = axisAnchors[a];
      if (anchor) {
        anchor.pos = v3(
          axis.dir.x * axisLength * 1.06,
          axis.dir.y * axisLength * 1.06,
          axis.dir.z * axisLength * 1.06,
        );
      }
    }
    state.gridBuilt = true;
  }

  return {
    group,
    background,
    setShowGrid(show: boolean): void {
      const visible = !!show;
      if (state.gridVisible === visible) return;
      state.gridVisible = visible;
      gridGroup.visible = visible;
      axesGroup.visible = visible;
    },
    setBaseRadius(base: number): void {
      const next = Number.isFinite(base) && base > 1e-6 ? base : 3;
      if (!state.gridBuilt || Math.abs(next - state.baseRadius) > Math.max(1e-6, state.baseRadius * 0.02)) {
        state.baseRadius = next;
        rebuildFurniture(next);
        gridGroup.visible = state.gridVisible;
        axesGroup.visible = state.gridVisible;
      }
    },
    update(camera: PerspectiveCamera): void {
      if (dome) dome.position.copy(camera.position);
    },
    axisAnchors(): readonly AxisAnchor[] {
      return axisAnchors;
    },
    dispose(): void {
      clearGrid();
      clearAxes();
      if (dome) {
        group.remove(dome);
        try {
          dome.geometry.dispose();
        } catch {
          /* ignore */
        }
        const material = dome.material as { dispose?: () => void } | undefined;
        material?.dispose?.();
      }
      group.remove(gridGroup, axesGroup);
      try {
        background?.dispose();
      } catch {
        /* ignore */
      }
      group.clear();
    },
  };
}
