/**
 * distance-lines-3d.ts —— 三维距离标注的 WebGL 部分：
 *  - 选中天体 → 其他天体的细线（颜色随目标天体，加法混合低透明度）；
 *  - 选中天体的方向矢量（原点 → 选中天体，细箭头），对应 ARCH_3D §3 "选中天体方向矢量"。
 *
 * 标注文字在 labels-3d.ts 的 HTML 覆盖层中显示（仅 settings.showLabels 时）。
 * 全部使用预分配缓冲，帧内只写 position/color 与 drawRange。
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import type { Vec3 } from "../core/math";
import { clamp, vLen3, vNorm3 } from "./math-3d";
import type { DistancePairView, ViewerFrame } from "./shared-3d";
import { PALETTE_3D, safeHex } from "./theme-3d";

const MAX_PAIRS = 12;
const MAX_VERTICES = MAX_PAIRS * 2;

export class DistanceLines3D {
  readonly group = new Group();

  private readonly positions = new Float32Array(MAX_VERTICES * 3);
  private readonly colors = new Float32Array(MAX_VERTICES * 3);
  private readonly positionAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;
  private readonly lineGeometry = new BufferGeometry();
  private readonly lineSegments: LineSegments;
  private readonly lineMat = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });

  private readonly arrowPositions = new Float32Array(2 * 3);
  private readonly arrowPositionAttr: BufferAttribute;
  private readonly arrowGeometry = new BufferGeometry();
  private readonly arrowLine: Line;
  private readonly arrowLineMat = new LineBasicMaterial({
    color: new Color(PALETTE_3D.selection),
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  private readonly coneGeometry = new ConeGeometry(0.35, 1, 14);
  private readonly coneMaterial = new MeshBasicMaterial({
    color: new Color(PALETTE_3D.selection),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  private readonly arrowCone: Mesh;

  private readonly tmpColor = new Color();
  private readonly tmpDir = new Vector3();
  private readonly tmpForward = new Vector3(0, 1, 0);
  private lastSelectionKey = "";

  constructor() {
    this.group.name = "r3d-distance-lines";
    this.positionAttr = new BufferAttribute(this.positions, 3);
    this.positionAttr.setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(this.colors, 3);
    this.colorAttr.setUsage(DynamicDrawUsage);
    this.lineGeometry.setAttribute("position", this.positionAttr);
    this.lineGeometry.setAttribute("color", this.colorAttr);
    this.lineGeometry.setDrawRange(0, 0);
    this.lineSegments = new LineSegments(this.lineGeometry, this.lineMat);
    this.lineSegments.frustumCulled = false;
    this.lineSegments.renderOrder = 8;

    this.arrowPositionAttr = new BufferAttribute(this.arrowPositions, 3);
    this.arrowPositionAttr.setUsage(DynamicDrawUsage);
    this.arrowGeometry.setAttribute("position", this.arrowPositionAttr);
    this.arrowLine = new Line(this.arrowGeometry, this.arrowLineMat);
    this.arrowLine.frustumCulled = false;
    this.arrowLine.renderOrder = 9;

    this.arrowCone = new Mesh(this.coneGeometry, this.coneMaterial);
    this.arrowCone.frustumCulled = false;
    this.arrowCone.renderOrder = 9;

    this.group.add(this.lineSegments, this.arrowLine, this.arrowCone);
  }

  /**
   * @param pairs 选中天体到其他天体的距离标注（HTML 标签另行绘制）
   * @param selectionPos 选中天体世界坐标（null = 无选中）
   * @param frame 本帧上下文
   */
  sync(pairs: DistancePairView, selectionPos: Vec3 | null, frame: ViewerFrame): void {
    // ---- 距离细线 ----
    const count = clamp(pairs.count, 0, MAX_PAIRS);
    const showLines = count > 0 && frame.settings.showLabels;
    this.lineSegments.visible = showLines;
    if (showLines) {
      let v = 0;
      for (let i = 0; i < count; i++) {
        const pair = pairs.items[i];
        if (!pair) continue;
        this.tmpColor.set(safeHex(pair.color, PALETTE_3D.distance));
        for (let k = 0; k < 2; k++) {
          const p = k === 0 ? pair.from : pair.to;
          const i3 = v * 3;
          this.positions[i3] = p.x;
          this.positions[i3 + 1] = p.y;
          this.positions[i3 + 2] = p.z;
          this.colors[i3] = this.tmpColor.r;
          this.colors[i3 + 1] = this.tmpColor.g;
          this.colors[i3 + 2] = this.tmpColor.b;
          v++;
        }
      }
      this.lineGeometry.setDrawRange(0, v);
      this.positionAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    } else {
      this.lineGeometry.setDrawRange(0, 0);
    }

    // ---- 选中天体方向矢量（原点 → 选中天体） ----
    const showArrow =
      !!selectionPos &&
      frame.settings.showLabels &&
      Number.isFinite(selectionPos.x) &&
      Number.isFinite(selectionPos.y) &&
      Number.isFinite(selectionPos.z);
    this.arrowLine.visible = showArrow;
    this.arrowCone.visible = showArrow;
    if (!showArrow || !selectionPos) {
      this.lastSelectionKey = "";
      return;
    }
    const length = vLen3(selectionPos);
    this.lastSelectionKey = length.toExponential(3);
    if (!(length > 1e-6)) {
      this.arrowLine.visible = false;
      this.arrowCone.visible = false;
      return;
    }
    const dir = vNorm3(selectionPos);
    this.tmpDir.set(dir.x, dir.y, dir.z);
    const head = clamp(length * 0.16, frame.viewRadius * 0.008, Math.max(frame.viewRadius * 0.008, frame.viewRadius * 0.05));
    const tail = Math.max(0, length - head * 1.05);

    this.arrowPositions[0] = 0;
    this.arrowPositions[1] = 0;
    this.arrowPositions[2] = 0;
    this.arrowPositions[3] = dir.x * tail;
    this.arrowPositions[4] = dir.y * tail;
    this.arrowPositions[5] = dir.z * tail;
    this.arrowPositionAttr.needsUpdate = true;
    this.arrowLine.visible = tail > 1e-6;

    this.arrowCone.position.set(
      selectionPos.x - dir.x * head * 0.5,
      selectionPos.y - dir.y * head * 0.5,
      selectionPos.z - dir.z * head * 0.5,
    );
    this.arrowCone.quaternion.setFromUnitVectors(this.tmpForward, this.tmpDir);
    this.arrowCone.scale.set(head, head, head);
  }

  dispose(): void {
    this.lineGeometry.dispose();
    this.lineMat.dispose();
    this.arrowGeometry.dispose();
    this.arrowLineMat.dispose();
    this.coneGeometry.dispose();
    this.coneMaterial.dispose();
    this.group.clear();
    this.lastSelectionKey = "";
  }
}
