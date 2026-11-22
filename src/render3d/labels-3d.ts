/**
 * labels-3d.ts —— 3D 视图的 HTML 覆盖层标签（自绘投影，不依赖 CSS2DRenderer）。
 *
 * 内容：
 *  - 天体名称 + 二维等价信息（X-Z 投影距离 R）；heightDataAvailable 时才追加高度 h；
 *  - 预测/选中天体的距离标注（"1.42 AU"、可选 "Δh=+0.12 AU"）；
 *  - X/Y/Z 轴向指示（单位 AU）；
 *  - 事件脉冲标签。
 *
 * 工程约定：
 *  - 标签节点按 key 复用，帧内只更新 transform / textContent / color；
 *  - 简易碰撞避让：按优先级尝试上/右/左/下等候选位，失败则本帧隐藏；
 *  - settings.showLabels = false 时整层 display:none，不做无用 DOM 写入。
 */
import type { Vec3 } from "../core/math";
import type { RenderScene3D, ScenePlanet3D, SceneStar3D } from "../game/viewTypes";
import { clamp, pixelsPerWorld, projectToScreen } from "./math-3d";
import type { AxisAnchor, BodyAnchor, DistancePairView, ViewerFrame } from "./shared-3d";
import {
  FONTS_3D,
  PALETTE_3D,
  formatConfidence,
  formatDeltaHeightAU,
  formatDistanceAU,
  formatHabitability,
  formatHeightAU,
  formatKm,
  formatMass,
  formatSigmaAU,
  formatTempC,
  formatTempK,
  lighten,
  rgba,
  safeHex,
  severityColor,
} from "./theme-3d";

const MAX_LABELS = 96;
const MAX_LINES = 5;
const MARGIN = 10;

/* v1.4 印刷语言：纸白标签 + 墨黑字 + 单一信号黄（见 hud-print.css .r3d-label*）。 */
const NAME_FONT = "650 10.5px " + FONTS_3D.ui;
const DETAIL_FONT = "9px " + FONTS_3D.mono;
const TINY_FONT = "8.5px " + FONTS_3D.mono;
const PULSE_FONT = "600 9px " + FONTS_3D.mono;

/** 标签芯片内边距（碰撞计算用）。 */
const LABEL_PAD_X = 12;
const LABEL_PAD_Y = 7;

const DETAIL_COLOR = "#3a3a3a";
const DETAIL_DIM = "#6b6b6b";
const HEIGHT_COLOR = "#2b2b2b";
const WARN_COLOR = "#7a5200";

interface LabelLine {
  text: string;
  color: string;
  font: string;
}

interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 待放置的天体标签（先投影，再按屏幕 Y 排序后放置，减少聚集时的相互遮挡）。 */
interface PendingBodyLabel {
  key: string;
  x: number;
  y: number;
  radiusPx: number;
  lines: LabelLine[];
}

interface LabelEntry {
  key: string;
  el: HTMLDivElement;
  lines: HTMLDivElement[];
  texts: string[];
  colors: string[];
  fonts: string[];
  visible: boolean;
  lastTransform: string;
}

export interface LabelOverlay {
  readonly root: HTMLDivElement;
  sync(
    scene: RenderScene3D,
    frame: ViewerFrame,
    anchors: readonly BodyAnchor[],
    pairs: DistancePairView,
    axes: readonly AxisAnchor[],
    inclinationFor?: (bodyId: string) => number | null,
  ): void;
  dispose(): void;
}

/**
 * 粗略文本宽度估算：等宽字体下 CJK 约 1.22×字号、ASCII 约 0.64×字号。
 * 坐标用于碰撞判定，宁可高估也不要低估，否则星体聚集时标签会视觉上贴在一起。
 */
function estimateWidth(text: string, font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  const size = match ? Number(match[1]) : 10;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += text.charCodeAt(i) > 0x2e7f ? size * 1.22 : size * 0.64;
  }
  return width;
}

function estimateHeight(lines: LabelLine[]): number {
  let height = LABEL_PAD_Y;
  for (const line of lines) {
    const match = /(\d+(?:\.\d+)?)px/.exec(line.font);
    height += (match ? Number(match[1]) : 10) * 1.34;
  }
  return height;
}

function overlaps(a: PlacedRect, b: PlacedRect, pad = 5): boolean {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

function starLabelLines(
  star: SceneStar3D,
  selected: boolean,
  frame: ViewerFrame,
  inclinationDeg: number | null = null,
): LabelLine[] {
  const colorHex = safeHex(star.color, PALETTE_3D.accent);
  const lines: LabelLine[] = [
    {
      text: star.name || "未知恒星",
      color: star.known ? lighten(colorHex, 0.45) : rgba(colorHex, 0.7),
      font: NAME_FONT,
    },
  ];
  const xz = Math.hypot(Number.isFinite(star.pos?.x) ? star.pos.x : 0, Number.isFinite(star.pos?.z) ? star.pos.z : 0);
  // 二维等价信息：X-Z 投影距离（与 2D 主视图标签一致）。
  lines.push({
    text: (star.known ? "R " + formatDistanceAU(xz) : "位置未定") + " · " + formatConfidence(star.confidence),
    color: star.known ? DETAIL_COLOR : WARN_COLOR,
    font: DETAIL_FONT,
  });
  if (frame.heightDataAvailable) {
    lines.push({ text: formatHeightAU(star.pos.y), color: HEIGHT_COLOR, font: DETAIL_FONT });
  }
  if (selected) {
    // 倾角属高度/三维轨道信息：heightDataAvailable = false 时绝不显示。
    if (frame.heightDataAvailable && inclinationDeg !== null && Number.isFinite(inclinationDeg)) {
      lines.push({
        text: "轨道倾角 " + inclinationDeg.toFixed(1) + "°",
        color: HEIGHT_COLOR,
        font: TINY_FONT,
      });
    }
    if (Number.isFinite(star.sigmaAU) && star.sigmaAU > 0) {
      lines.push({ text: formatSigmaAU(star.sigmaAU), color: DETAIL_DIM, font: TINY_FONT });
    }
    const extra: string[] = [];
    if (star.mass !== null && Number.isFinite(star.mass)) extra.push(formatMass(star.mass));
    if (star.tempK !== null && Number.isFinite(star.tempK)) extra.push(formatTempK(star.tempK));
    if (extra.length > 0) lines.push({ text: extra.join(" · "), color: DETAIL_DIM, font: TINY_FONT });
  }
  return lines;
}

function planetLabelLines(planet: ScenePlanet3D, selected: boolean, frame: ViewerFrame): LabelLine[] {
  const lines: LabelLine[] = [{ text: "母星", color: "#eaf7ff", font: NAME_FONT }];
  const info: string[] = [];
  if (planet.tempC !== null && Number.isFinite(planet.tempC)) info.push(formatTempC(planet.tempC));
  if (planet.habitability !== null && Number.isFinite(planet.habitability)) {
    info.push(formatHabitability(planet.habitability));
  }
  if (info.length > 0) lines.push({ text: info.join(" · "), color: DETAIL_COLOR, font: DETAIL_FONT });
  else lines.push({ text: "环境数据待观测", color: WARN_COLOR, font: DETAIL_FONT });
  if (frame.heightDataAvailable) {
    lines.push({ text: formatHeightAU(planet.pos.y), color: HEIGHT_COLOR, font: DETAIL_FONT });
  }
  if (selected) {
    if (Number.isFinite(planet.sigmaAU) && planet.sigmaAU > 0) {
      lines.push({ text: formatSigmaAU(planet.sigmaAU), color: DETAIL_DIM, font: TINY_FONT });
    }
    if (Number.isFinite(planet.radiusKm) && planet.radiusKm > 0) {
      lines.push({ text: "半径 " + formatKm(planet.radiusKm), color: DETAIL_DIM, font: TINY_FONT });
    }
  }
  return lines;
}

export function createLabelOverlay(container: HTMLElement): LabelOverlay | null {
  if (typeof document === "undefined" || !container || typeof container.appendChild !== "function") return null;
  let root: HTMLDivElement;
  try {
    root = document.createElement("div");
  } catch {
    return null;
  }
  root.style.cssText =
    "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:3;contain:layout style;";
  try {
    container.appendChild(root);
  } catch {
    return null;
  }

  const doc = root.ownerDocument ?? document;
  const entries = new Map<string, LabelEntry>();
  const used = new Set<string>();
  const placed: PlacedRect[] = [];
  const projection = { x: 0, y: 0, depth: 0, visible: false };
  let rootVisible = true;

  function createEntry(key: string): LabelEntry {
    const el = doc.createElement("div");
    el.className = "r3d-label";
    el.style.cssText = "position:absolute;left:0;top:0;display:none;white-space:nowrap;text-align:center;pointer-events:none;will-change:transform;";
    const lines: HTMLDivElement[] = [];
    for (let i = 0; i < MAX_LINES; i++) {
      const line = doc.createElement("div");
      line.className = "r3d-label-line";
      el.appendChild(line);
      lines.push(line);
    }
    root.appendChild(el);
    const entry: LabelEntry = {
      key,
      el,
      lines,
      texts: [],
      colors: [],
      fonts: [],
      visible: false,
      lastTransform: "",
    };
    entries.set(key, entry);
    return entry;
  }

  function ensureEntry(key: string): LabelEntry {
    return entries.get(key) ?? createEntry(key);
  }

  function hideEntry(entry: LabelEntry): void {
    if (!entry.visible) return;
    entry.visible = false;
    entry.el.style.display = "none";
  }

  function writeEntry(entry: LabelEntry, lines: LabelLine[], transform: string): void {
    for (let i = 0; i < entry.lines.length; i++) {
      const line = lines[i];
      const node = entry.lines[i];
      if (!line) {
        if (entry.texts[i] !== "") {
          entry.texts[i] = "";
          node.textContent = "";
          node.style.display = "none";
        }
        continue;
      }
      if (entry.texts[i] !== line.text) {
        entry.texts[i] = line.text;
        node.textContent = line.text;
      }
      if (entry.colors[i] !== line.color) {
        entry.colors[i] = line.color;
        node.style.color = line.color;
      }
      if (entry.fonts[i] !== line.font) {
        entry.fonts[i] = line.font;
        node.style.font = line.font;
      }
      if (node.style.display !== "block") node.style.display = "block";
    }
    if (entry.lastTransform !== transform) {
      entry.lastTransform = transform;
      entry.el.style.transform = transform;
    }
    entry.visible = true;
    if (entry.el.style.display !== "block") entry.el.style.display = "block";
  }

  interface Candidate {
    pointX: number;
    pointY: number;
    translate: string;
    boxX: number;
    boxY: number;
  }

  function makeCandidates(sx: number, sy: number, gap: number, w: number, h: number, center: boolean): Candidate[] {
    const list: Candidate[] = [];
    if (center) {
      list.push({
        pointX: sx,
        pointY: sy,
        translate: "translate(-50%,-50%)",
        boxX: sx - w / 2,
        boxY: sy - h / 2,
      });
    }
    list.push({
      pointX: sx,
      pointY: sy - gap,
      translate: "translate(-50%,-100%)",
      boxX: sx - w / 2,
      boxY: sy - gap - h,
    });
    list.push({
      pointX: sx + gap,
      pointY: sy,
      translate: "translate(0,-50%)",
      boxX: sx + gap,
      boxY: sy - h / 2,
    });
    list.push({
      pointX: sx - gap,
      pointY: sy,
      translate: "translate(-100%,-50%)",
      boxX: sx - gap - w,
      boxY: sy - h / 2,
    });
    list.push({
      pointX: sx,
      pointY: sy + gap,
      translate: "translate(-50%,0)",
      boxX: sx - w / 2,
      boxY: sy + gap,
    });
    list.push({
      pointX: sx + gap * 0.72,
      pointY: sy - gap * 0.72,
      translate: "translate(0,-100%)",
      boxX: sx + gap * 0.72,
      boxY: sy - gap * 0.72 - h,
    });
    list.push({
      pointX: sx - gap * 0.72,
      pointY: sy - gap * 0.72,
      translate: "translate(-100%,-100%)",
      boxX: sx - gap * 0.72 - w,
      boxY: sy - gap * 0.72 - h,
    });
    return list;
  }

  function placeLabel(
    key: string,
    sx: number,
    sy: number,
    lines: LabelLine[],
    anchorRadiusPx: number,
    frame: ViewerFrame,
    options?: { center?: boolean },
  ): void {
    if (!lines || lines.length === 0) return;
    let width = 0;
    for (const line of lines) width = Math.max(width, estimateWidth(line.text, line.font));
    width = Math.max(30, width + LABEL_PAD_X);
    const height = estimateHeight(lines);
    const gap = clamp(anchorRadiusPx + 8, 10, 140);
    const candidates = makeCandidates(sx, sy, gap, width, height, !!options?.center);
    // 星体聚集时的简单避让：基础候选位都被占用时，整体向下偏移 18px 的整数倍再试。
    const shifted: Candidate[] = [];
    for (let n = 1; n <= 3; n++) {
      const shift = n * 18;
      shifted.push({
        pointX: sx,
        pointY: sy - gap + shift,
        translate: "translate(-50%,-100%)",
        boxX: sx - width / 2,
        boxY: sy - gap + shift - height,
      });
      shifted.push({
        pointX: sx,
        pointY: sy + gap + shift,
        translate: "translate(-50%,0)",
        boxX: sx - width / 2,
        boxY: sy + gap + shift,
      });
      shifted.push({
        pointX: sx + gap,
        pointY: sy + shift,
        translate: "translate(0,-50%)",
        boxX: sx + gap,
        boxY: sy + shift - height / 2,
      });
    }
    const entry = ensureEntry(key);
    const allCandidates = candidates.concat(shifted);
    for (let i = 0; i < allCandidates.length; i++) {
      const c = allCandidates[i];
      if (
        c.boxX < MARGIN ||
        c.boxY < MARGIN ||
        c.boxX + width > frame.width - MARGIN ||
        c.boxY + height > frame.height - MARGIN
      ) {
        continue;
      }
      const rect: PlacedRect = { x: c.boxX, y: c.boxY, w: width, h: height };
      let hit = false;
      for (let p = 0; p < placed.length; p++) {
        if (overlaps(rect, placed[p])) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      placed.push(rect);
      used.add(key);
      const transform =
        "translate3d(" + c.pointX.toFixed(1) + "px," + c.pointY.toFixed(1) + "px,0) " + c.translate;
      writeEntry(entry, lines, transform);
      return;
    }
    hideEntry(entry);
  }

  function projectAnchor(
    anchor: BodyAnchor,
    frame: ViewerFrame,
  ): { x: number; y: number; radiusPx: number } | null {
    projectToScreen(frame.camera, anchor.pos, frame.width, frame.height, projection);
    if (!projection.visible) return null;
    const radiusPx = clamp(anchor.worldRadius * pixelsPerWorld(frame.camera, anchor.pos, frame.height), 1.5, 220);
    return { x: projection.x, y: projection.y, radiusPx };
  }

  function axisColor(label: string): string {
    if (label === "X") return rgba(PALETTE_3D.axisX, 0.8);
    if (label === "Y") return rgba(PALETTE_3D.axisY, 0.8);
    return rgba(PALETTE_3D.axisZ, 0.8);
  }

  return {
    root,
    sync(
      scene: RenderScene3D,
      frame: ViewerFrame,
      anchors: readonly BodyAnchor[],
      pairs: DistancePairView,
      axes: readonly AxisAnchor[],
      inclinationFor?: (bodyId: string) => number | null,
    ): void {
      used.clear();
      placed.length = 0;
      // 近景模式：信息由右侧近景卡承担，天体标签整体隐藏，避免遮挡表面细节。
      if (frame.nearBody) {
        if (rootVisible) {
          rootVisible = false;
          root.style.display = "none";
        }
        entries.forEach((entry) => hideEntry(entry));
        return;
      }
      if (!frame.settings.showLabels) {
        if (rootVisible) {
          rootVisible = false;
          root.style.display = "none";
        }
        entries.forEach((entry) => hideEntry(entry));
        return;
      }
      if (!rootVisible) {
        rootVisible = true;
        root.style.display = "block";
      }
      if (frame.width < 60 || frame.height < 60) {
        entries.forEach((entry) => hideEntry(entry));
        return;
      }

      // 1) 选中天体：优先显示，信息最完整。
      const selection = frame.selection;
      let selectedAnchor: BodyAnchor | null = null;
      if (selection) {
        for (let i = 0; i < anchors.length; i++) {
          if (anchors[i].id === selection) {
            selectedAnchor = anchors[i];
            break;
          }
        }
      }
      if (selectedAnchor) {
        const p = projectAnchor(selectedAnchor, frame);
        if (p) {
          const inclination =
            selection !== "planet" && inclinationFor ? inclinationFor(String(selection)) : null;
          const lines =
            selection === "planet" && scene.planet
              ? planetLabelLines(scene.planet, true, frame)
              : (() => {
                  for (let i = 0; i < scene.stars.length; i++) {
                    if (scene.stars[i].id === selection) {
                      return starLabelLines(scene.stars[i], true, frame, inclination);
                    }
                  }
                  return [];
                })();
          if (lines.length > 0) placeLabel("sel:" + String(selection), p.x, p.y, lines, p.radiusPx, frame);
        }
      }

      // 2) 其他天体标签：先投影并按屏幕 Y/X 排序，聚集时从下往上依次避让（向下偏移 18px）。
      const pending: PendingBodyLabel[] = [];
      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        if (selectedAnchor && anchor.id === selectedAnchor.id) continue;
        const p = projectAnchor(anchor, frame);
        if (!p) continue;
        if (anchor.id === "planet") {
          if (!scene.planet) continue;
          pending.push({
            key: "body:planet",
            x: p.x,
            y: p.y,
            radiusPx: p.radiusPx,
            lines: planetLabelLines(scene.planet, false, frame),
          });
          continue;
        }
        let star: SceneStar3D | null = null;
        for (let s = 0; s < scene.stars.length; s++) {
          if (scene.stars[s].id === anchor.id) {
            star = scene.stars[s];
            break;
          }
        }
        if (!star) continue;
        pending.push({
          key: "body:" + star.id,
          x: p.x,
          y: p.y,
          radiusPx: p.radiusPx,
          lines: starLabelLines(star, false, frame),
        });
      }
      pending.sort((a, b) => (Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x));
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        placeLabel(item.key, item.x, item.y, item.lines, item.radiusPx, frame);
      }

      // 3) 三维距离标注（仅选中时存在；仅 showLabels 时绘制）。
      if (pairs.count > 0 && selection) {
        for (let i = 0; i < pairs.count; i++) {
          const pair = pairs.items[i];
          if (!pair) continue;
          projectToScreen(frame.camera, pair.mid, frame.width, frame.height, projection);
          if (!projection.visible) continue;
          const lines: LabelLine[] = [
            { text: formatDistanceAU(pair.distanceAU), color: rgba(pair.color, 0.92), font: PULSE_FONT },
          ];
          if (frame.heightDataAvailable && pair.deltaHeightAU !== null) {
            lines.push({
              text: formatDeltaHeightAU(pair.deltaHeightAU),
              color: DETAIL_DIM,
              font: TINY_FONT,
            });
          }
          placeLabel("dist:" + i, projection.x, projection.y, lines, 4, frame);
        }
      }

      // 4) 轴向指示（showGrid 打开时）。
      if (frame.settings.showGrid && axes) {
        for (let i = 0; i < axes.length; i++) {
          const axis = axes[i];
          projectToScreen(frame.camera, axis.pos, frame.width, frame.height, projection);
          if (!projection.visible) continue;
          const lines: LabelLine[] = [
            { text: axis.label + " · AU", color: axisColor(axis.label), font: TINY_FONT },
          ];
          placeLabel("axis:" + axis.label, projection.x, projection.y, lines, 2, frame, { center: true });
        }
      }

      // 5) 事件脉冲标签（低优先级，避免遮挡距离读数）。
      const pulses = scene.pulses ?? [];
      for (let i = 0; i < pulses.length; i++) {
        const pulse = pulses[i];
        if (!pulse || typeof pulse.label !== "string" || pulse.label.length === 0) continue;
        projectToScreen(frame.camera, pulse.pos, frame.width, frame.height, projection);
        if (!projection.visible) continue;
        const severity = clamp(Number.isFinite(pulse.severity) ? pulse.severity : 0.5, 0, 1);
        const lines: LabelLine[] = [
          { text: pulse.label, color: rgba(severityColor(severity), 0.95), font: PULSE_FONT },
        ];
        placeLabel("pulse:" + pulse.id, projection.x, projection.y, lines, 10 + severity * 14, frame);
      }

      entries.forEach((entry, key) => {
        if (!used.has(key)) hideEntry(entry);
      });

      // 条目上限保护：超过上限时清理未使用的旧条目。
      if (entries.size > MAX_LABELS) {
        const stale: string[] = [];
        entries.forEach((entry, key) => {
          if (!used.has(key)) stale.push(key);
        });
        for (const key of stale) {
          const entry = entries.get(key);
          if (!entry) continue;
          entries.delete(key);
          try {
            root.removeChild(entry.el);
          } catch {
            /* ignore */
          }
        }
      }
    },
    dispose(): void {
      entries.clear();
      placed.length = 0;
      used.clear();
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
