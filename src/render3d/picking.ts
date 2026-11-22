/**
 * picking.ts —— 3D 辅助视图拾取（Raycaster）。
 *
 * 恒星/行星的可见球体在宏观尺度上很小，直接点选会非常困难；
 * 因此 stars-3d / planet-3d 会为每个天体维护一个不可见、按相机距离自适应的"拾取代理球"，
 * 并在 mesh.userData.id 写入天体 id。这里对这些代理球做 Raycaster 求交：
 *  - 命中天体 → 返回 StarId / "planet"；
 *  - 点空白处 → 返回 null（严格符合契约，不猜测最近天体）。
 */
import { Raycaster, Vector2, type Mesh, type PerspectiveCamera } from "three";
import type { BodyId3D, Selection3D } from "./shared-3d";
import { isBodyId3D } from "./shared-3d";

export interface PickRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class Picker3D {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();

  /**
   * 屏幕坐标拾取。
   * @param clientX / clientY 指针的 client 坐标（CSS px）
   * @param rect canvas 的 getBoundingClientRect 结果
   * @param camera 本帧最新的相机
   * @param targets 拾取代理球列表（已写入 userData.id）
   */
  pick(
    clientX: number,
    clientY: number,
    rect: PickRect,
    camera: PerspectiveCamera,
    targets: readonly Mesh[],
  ): Selection3D {
    if (!targets || targets.length === 0) return null;
    const width = rect.width > 1 ? rect.width : 1;
    const height = rect.height > 1 ? rect.height : 1;
    const x = ((clientX - rect.left) / width) * 2 - 1;
    const y = -((clientY - rect.top) / height) * 2 + 1;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, camera);
    let hits: { object: unknown }[] = [];
    try {
      hits = this.raycaster.intersectObjects(targets as Mesh[], false);
    } catch {
      return null;
    }
    for (let i = 0; i < hits.length; i++) {
      const object = hits[i].object as { userData?: { id?: unknown } };
      const id: BodyId3D | unknown = object?.userData?.id;
      if (isBodyId3D(id)) return id;
    }
    return null;
  }

  dispose(): void {
    this.ndc.set(0, 0);
  }
}
