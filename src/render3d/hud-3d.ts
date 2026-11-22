/**
 * hud-3d.ts —— 3D 视图的仪器化 HUD 覆盖层（v1.4 印刷语言）。
 *
 * 视觉语言与主 UI（docs/UI_PRINT.md）一致：纸白卡片 + 墨黑文字 + 单一信号黄点缀、
 * 直角/微圆角、等宽微标；具体样式集中在同目录 hud-print.css（.r3d-* 类），
 * 本文件只创建一次 DOM，帧内仅在内容变化时写文本/类名，避免布局抖动。
 *
 * 布局（3D 画布容器的内部坐标；容器已由主 UI 让开顶部 HUD 与左右面板）：
 *  - 左上：观测状态卡（状态 / 年份·观测等级 / 选中天体 / 高度数据提示）；
 *  - 右下：视角卡（预设、操作提示、AU 比例尺、渲染性能提示）；
 *  - 右上：近景卡（进入近景后替代上面两张卡）：观测信息、目标切换、返回全景；
 *  - 所有元素 pointer-events:none，仅按钮/切换条自身接收指针事件，不拦截画布交互。
 *
 * 数据边界：只消费 RenderScene3D（观测数据）与 near-view-3d 组装的观测字段；
 * 不读取模拟真值，不 import game/physics。
 */
import type { RenderScene3D } from "../game/viewTypes";
import type { ViewPreset3D } from "./camera-3d";
import { clamp } from "./math-3d";
import { NEAR_TARGETS, type NearBodyInfo } from "./near-view-3d";
import type { BodyId3D, ViewerFrame } from "./shared-3d";
import {
  formatDistanceAU,
  formatHeightAU,
  formatSigmaAU,
  niceNumber,
  trimNumber,
} from "./theme-3d";
import { BODY_TEXTURE_IDS, type TextureLoadState } from "./texture-3d";

/** 贴图状态快照（HUD 性能行用）。 */
export interface Hud3DTextureStats {
  loaded: number;
  pending: number;
  total: number;
  states: Record<string, TextureLoadState>;
}

/** 近景 HUD 数据。 */
export interface Hud3DNearView {
  info: NearBodyInfo;
  zoom: { min: number; max: number; current: number };
  textures: Hud3DTextureStats;
}

/** 渲染性能读数。 */
export interface Hud3DPerf {
  /** 最近一个统计窗口的平均帧率（0 表示尚未统计）。 */
  fps: number;
  quality: "high" | "low";
  textures: Hud3DTextureStats;
}

export interface Hud3DOptions {
  /** 点击「返回全景」/关闭近景卡。 */
  onExitNear?: () => void;
  /** 近景卡上的天体切换条。 */
  onSelectBody?: (id: BodyId3D) => void;
}

export interface Hud3D {
  readonly root: HTMLDivElement;
  sync(
    scene: RenderScene3D,
    frame: ViewerFrame,
    preset: ViewPreset3D,
    near: Hud3DNearView | null,
    perf: Hud3DPerf,
  ): void;
  dispose(): void;
}

const PRESET_LABELS: Record<ViewPreset3D, string> = {
  top: "俯视",
  side: "侧视",
  free: "自由",
};

const TEXTURE_LABELS: Record<string, string> = {
  "star-a": "恒星 A",
  "star-b": "恒星 B",
  "star-c": "恒星 C",
  "planet-day": "母星昼面",
  "planet-clouds": "母星云层",
  "planet-night": "母星夜面",
};

function makeEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text = "",
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function createHud3D(container: HTMLElement, options: Hud3DOptions = {}): Hud3D | null {
  if (typeof document === "undefined" || !container || typeof container.appendChild !== "function") return null;
  let root: HTMLDivElement;
  try {
    root = document.createElement("div");
  } catch {
    return null;
  }
  root.className = "r3d-hud";
  try {
    container.appendChild(root);
  } catch {
    return null;
  }
  const doc = root.ownerDocument ?? document;

  /* ------------------------------ 左上：观测状态卡 ------------------------------ */
  const statusCard = makeEl(doc, "div", "r3d-card r3d-status");
  const statusKicker = makeEl(doc, "div", "r3d-kicker", "OBSERVATION SPACE · 3D");
  const statusTitle = makeEl(doc, "div", "r3d-title", "观测中");
  const statusMeta = makeEl(doc, "div", "r3d-meta", "");
  const statusSelection = makeEl(doc, "div", "r3d-line", "未选中天体 · 点击天体进入近景");
  const statusHeight = makeEl(doc, "div", "r3d-note", "高度数据未解锁 · 仅显示二维等价信息");
  statusHeight.style.display = "none";
  statusCard.append(statusKicker, statusTitle, statusMeta, statusSelection, statusHeight);

  /* ------------------------------ 右下：视角卡 ------------------------------ */
  const viewCard = makeEl(doc, "div", "r3d-card r3d-view");
  const viewKicker = makeEl(doc, "div", "r3d-kicker", "VIEW / 视角");
  const viewRow = makeEl(doc, "div", "r3d-view-row");
  const viewPreset = makeEl(doc, "div", "r3d-view-preset", "自由");
  const viewQuality = makeEl(doc, "div", "r3d-tag", "硬件加速");
  viewRow.append(viewPreset, viewQuality);
  const viewHint = makeEl(doc, "div", "r3d-hint", "拖拽旋转 · 滚轮缩放 · 右键平移 · 点击天体进入近景");
  const scaleRow = makeEl(doc, "div", "r3d-scale-row");
  const scaleLabel = makeEl(doc, "span", "r3d-scale-label", "");
  const scaleBar = makeEl(doc, "span", "r3d-scale-bar");
  const tick0 = makeEl(doc, "i", "r3d-scale-tick is-start");
  const tick1 = makeEl(doc, "i", "r3d-scale-tick is-mid");
  const tick2 = makeEl(doc, "i", "r3d-scale-tick is-end");
  scaleBar.append(tick0, tick1, tick2);
  scaleRow.append(scaleBar, scaleLabel);
  const perfLine = makeEl(doc, "div", "r3d-perf", "渲染 — fps · 贴图 0/6");
  viewCard.append(viewKicker, viewRow, viewHint, scaleRow, perfLine);

  /* ------------------------------ 右上：近景卡 ------------------------------ */
  const nearCard = makeEl(doc, "div", "r3d-card r3d-near");
  const nearHead = makeEl(doc, "div", "r3d-near-head");
  const nearHeadText = makeEl(doc, "div", "r3d-near-headtext");
  const nearKicker = makeEl(doc, "div", "r3d-kicker", "NEAR OBSERVATION · 近景观测");
  const nearTitle = makeEl(doc, "div", "r3d-near-title", "—");
  nearHeadText.append(nearKicker, nearTitle);
  const nearClose = makeEl(doc, "button", "r3d-icon-btn", "×");
  nearClose.type = "button";
  nearClose.title = "返回全景（Esc）";
  nearClose.setAttribute("aria-label", "返回全景");
  nearHead.append(nearHeadText, nearClose);
  const nearAccent = makeEl(doc, "div", "r3d-near-accent");
  const nearSub = makeEl(doc, "div", "r3d-near-sub", "");
  const nearWarning = makeEl(doc, "div", "r3d-near-warning", "");
  nearWarning.style.display = "none";
  const nearGrid = makeEl(doc, "div", "r3d-near-grid");
  const NEAR_ROWS = 10;
  const nearRowEls: { row: HTMLDivElement; label: HTMLDivElement; value: HTMLDivElement }[] = [];
  for (let i = 0; i < NEAR_ROWS; i += 1) {
    const row = makeEl(doc, "div", "r3d-near-row");
    const label = makeEl(doc, "div", "r3d-near-label", "");
    const value = makeEl(doc, "div", "r3d-near-value", "");
    row.append(label, value);
    row.style.display = "none";
    nearGrid.appendChild(row);
    nearRowEls.push({ row, label, value });
  }
  const nearTargetsWrap = makeEl(doc, "div", "r3d-near-targets");
  const nearTargetBtns = new Map<BodyId3D, HTMLButtonElement>();
  for (const target of NEAR_TARGETS) {
    const btn = makeEl(doc, "button", "r3d-target-btn", target.label);
    btn.type = "button";
    btn.dataset.body = target.id;
    btn.title = "切换近景目标：" + target.label;
    nearTargetsWrap.appendChild(btn);
    nearTargetBtns.set(target.id, btn);
  }
  const nearFooter = makeEl(doc, "div", "r3d-near-footer");
  const nearNote = makeEl(doc, "div", "r3d-near-note", "仅显示观测数据 · 不含模拟真值");
  const nearZoom = makeEl(doc, "div", "r3d-near-zoom", "拖拽旋转 · 滚轮缩放");
  const nearReturn = makeEl(doc, "button", "r3d-return-btn", "返回全景 · ESC");
  nearReturn.type = "button";
  nearFooter.append(nearNote, nearZoom, nearReturn);
  nearCard.append(nearHead, nearAccent, nearSub, nearWarning, nearGrid, nearTargetsWrap, nearFooter);
  nearCard.style.display = "none";

  root.append(statusCard, viewCard, nearCard);

  nearClose.addEventListener("click", () => options.onExitNear?.());
  nearReturn.addEventListener("click", () => options.onExitNear?.());
  nearTargetsWrap.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    const btn = target?.closest?.(".r3d-target-btn") as HTMLButtonElement | null;
    const body = btn?.dataset?.body;
    if (body === "A" || body === "B" || body === "C" || body === "planet") options.onSelectBody?.(body);
  });

  let lastStatus = "";
  let lastMeta = "";
  let lastSelection = "";
  let lastHeightNote: boolean | null = null;
  let lastPreset = "";
  let lastScaleLabel = "";
  let lastScaleWidth = -1;
  let lastPerf = "";
  let lastNearKey = "";
  let nearVisible = false;
  let lastTargetId: BodyId3D | null = null;

  function findStar(scene: RenderScene3D, id: string): { name: string; posY: number; sigmaAU: number } | null {
    for (let i = 0; i < scene.stars.length; i++) {
      const star = scene.stars[i];
      if (star.id === id) {
        return { name: star.name || id, posY: Number.isFinite(star.pos?.y) ? star.pos.y : 0, sigmaAU: star.sigmaAU };
      }
    }
    return null;
  }

  return {
    root,
    sync(scene: RenderScene3D, frame: ViewerFrame, preset: ViewPreset3D, near: Hud3DNearView | null, perf: Hud3DPerf): void {
      const isNear = near !== null;
      if (isNear !== nearVisible) {
        nearVisible = isNear;
        nearCard.style.display = isNear ? "" : "none";
        statusCard.style.display = isNear ? "none" : "";
        viewCard.style.display = isNear ? "none" : "";
      }

      /* ---------- 全景：观测状态卡 + 视角卡 ---------- */
      if (!isNear) {
        const nextStatus = scene.statusLabel && scene.statusLabel.length > 0 ? scene.statusLabel : "观测中";
        if (nextStatus !== lastStatus) {
          lastStatus = nextStatus;
          statusTitle.textContent = nextStatus;
        }
        const metaParts: string[] = [];
        metaParts.push(String(Math.round(scene.calendarYear)) + " 年");
        metaParts.push("观测等级 " + String(Number.isFinite(scene.observatoryLevel) ? scene.observatoryLevel : 0));
        if (scene.hasColony) metaParts.push("殖民地在线");
        if (scene.paused) metaParts.push("暂停");
        const nextMeta = metaParts.join(" · ");
        if (nextMeta !== lastMeta) {
          lastMeta = nextMeta;
          statusMeta.textContent = nextMeta;
        }

        let selectionText = "未选中天体 · 点击天体进入近景";
        if (scene.selection === "planet" && scene.planet) {
          selectionText = "选中 · 母星 · 点击再次进入近景";
          if (frame.heightDataAvailable) selectionText += " · " + formatHeightAU(scene.planet.pos.y);
        } else if (scene.selection) {
          const star = findStar(scene, scene.selection);
          if (star) {
            selectionText = "选中 · " + star.name + " · 点击再次进入近景";
            if (frame.heightDataAvailable) selectionText += " · " + formatHeightAU(star.posY);
            if (Number.isFinite(star.sigmaAU) && star.sigmaAU > 0) selectionText += " · " + formatSigmaAU(star.sigmaAU);
          }
        }
        if (selectionText !== lastSelection) {
          lastSelection = selectionText;
          statusSelection.textContent = selectionText;
        }

        const showHeightNote = !frame.heightDataAvailable;
        if (showHeightNote !== lastHeightNote) {
          lastHeightNote = showHeightNote;
          statusHeight.style.display = showHeightNote ? "block" : "none";
        }

        const nextPreset = PRESET_LABELS[preset] ?? "自由";
        if (nextPreset !== lastPreset) {
          lastPreset = nextPreset;
          viewPreset.textContent = nextPreset;
        }

        // 比例尺：以相机到轨道中心的距离估算世界/像素比，取 1/2/5 × 10^n。
        const fovRad = (frame.camera.fov * Math.PI) / 180;
        const heightPx = Math.max(2, frame.height);
        const worldPerPixel = (2 * Math.max(1e-6, frame.cameraDistance) * Math.tan(fovRad * 0.5)) / heightPx;
        const targetPx = clamp(frame.width * 0.07, 56, 110);
        let barPx = 80;
        let barAU = 0;
        if (Number.isFinite(worldPerPixel) && worldPerPixel > 0) {
          barAU = niceNumber(worldPerPixel * targetPx);
          barPx = clamp(barAU / worldPerPixel, 24, 180);
        }
        const nextScaleLabel = Number.isFinite(barAU) && barAU > 0 ? formatDistanceAU(barAU) : "";
        if (nextScaleLabel !== lastScaleLabel) {
          lastScaleLabel = nextScaleLabel;
          scaleLabel.textContent = nextScaleLabel;
        }
        const rounded = Math.round(barPx);
        if (rounded !== lastScaleWidth) {
          lastScaleWidth = rounded;
          scaleBar.style.width = rounded + "px";
        }
      }

      /* ---------- 性能 / 质量提示（两种模式都显示在对应卡片里） ---------- */
      const fpsText = perf.fps > 0 ? Math.round(perf.fps) + " fps" : "统计中";
      const qualityText = perf.quality === "low" ? "软件渲染 · 降级分段" : "硬件加速";
      const textureText = "贴图 " + perf.textures.loaded + "/" + perf.textures.total;
      const perfText = isNear
        ? "近景渲染 · " + fpsText + " · " + qualityText + " · " + textureText
        : "渲染 " + fpsText + " · " + qualityText + " · " + textureText;
      if (perfText !== lastPerf) {
        lastPerf = perfText;
        perfLine.textContent = perfText;
        if (viewQuality) viewQuality.textContent = perf.quality === "low" ? "软件渲染" : "硬件加速";
        nearZoom.textContent = isNear
          ? "缩放限位 " + formatDistanceAU(near.zoom.min) + " – " + formatDistanceAU(near.zoom.max) + " · " + fpsText
          : "";
      }

      /* ---------- 近景卡 ---------- */
      if (isNear) {
        const info = near.info;
        const key =
          info.id +
          "|" +
          info.title +
          "|" +
          info.rows.map((row) => row.label + "=" + row.value).join(";") +
          "|" +
          (info.warning ?? "");
        if (key !== lastNearKey) {
          lastNearKey = key;
          nearTitle.textContent = info.title;
          nearSub.textContent = info.subtitle;
          nearAccent.style.background = info.accent;
          nearAccent.dataset.kind = info.kind;
          if (info.warning) {
            nearWarning.style.display = "block";
            nearWarning.textContent = info.warning;
          } else {
            nearWarning.style.display = "none";
            nearWarning.textContent = "";
          }
          for (let i = 0; i < nearRowEls.length; i += 1) {
            const row = nearRowEls[i];
            const data = info.rows[i];
            if (!data) {
              row.row.style.display = "none";
              continue;
            }
            row.row.style.display = "";
            row.label.textContent = data.label;
            row.value.textContent = data.value;
            row.value.dataset.tone = data.tone ?? "ink";
          }
        }
        if (lastTargetId !== info.id) {
          lastTargetId = info.id;
          nearTargetBtns.forEach((btn, id) => {
            btn.classList.toggle("is-active", id === info.id);
          });
        }
      }
    },
    dispose(): void {
      try {
        root.remove();
      } catch {
        try {
          container.removeChild(root);
        } catch {
          /* ignore */
        }
      }
    },
  };
}
