/**
 * v1.4「曲线美」组件层 —— 同心圆 / 圆弧 / 刻度弧 / 曲线分隔线。
 *
 * 设计约束（见 docs/UI_PRINT_V15.md）：
 *  - 沿用 v1.3 白纸墨字 + 单一信号黄；弧线本身只允许墨色与灰阶，
 *    黄色只保留给「当前值 / 选定目标 / 阈值」这类需要立刻被看见的标记；
 *  - 每一条弧都必须绑定真实数据（时代进度、住房比、稳定度、资源储备比、
 *    恒星方位角与观测置信度、页签位置…），不做纯装饰弧的堆叠；
 *  - 动效 0.2–0.3s：只做 stroke-dashoffset / opacity / transform 过渡，
 *    不弹跳、不持续漂浮；prefers-reduced-motion 下由 CSS 关闭。
 */
import { el } from "./dom";
import { clamp01 } from "./format";

const SVG_NS = "http://www.w3.org/2000/svg";
const RAD = Math.PI / 180;

export type CurveTone = "accent" | "ok" | "warn" | "danger" | "muted" | "violet" | "amber";

/** 创建 SVG 节点（供同层曲线组件与观测视口自定义刻度复用）。 */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node as unknown as SVGElementTagNameMap[K];
}

/** 12 点钟方向为 0°、顺时针为正的极坐标（SVG 屏幕坐标）。 */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  return {
    x: cx + radius * Math.sin(angleDeg * RAD),
    y: cy - radius * Math.cos(angleDeg * RAD),
  };
}

/** 生成圆弧 path（角度按 polarPoint 约定，顺时针为正）。 */
export function arcPath(cx: number, cy: number, radius: number, startDeg: number, sweepDeg: number): string {
  const start = polarPoint(cx, cy, radius, startDeg);
  const end = polarPoint(cx, cy, radius, startDeg + sweepDeg);
  const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweep = sweepDeg >= 0 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${large} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

/** 弧长（用于 stroke-dasharray 进度）。 */
export function arcLength(radius: number, sweepDeg: number): number {
  return Math.abs(sweepDeg) * RAD * radius;
}

function toneAttr(tone: CurveTone | undefined): string {
  return tone ?? "accent";
}

/* ------------------------------------------------------------------ *
 * 1. 圆弧仪表（时代进度 / 人口 / 稳定度）                            *
 * ------------------------------------------------------------------ */

export interface ArcGaugeOptions {
  className?: string;
  /** 弧的张角，默认 270°（下方开口，像仪表盘）。 */
  sweep?: number;
  /** 起始角（12 点顺时针），默认 -sweep/2。 */
  start?: number;
  /** 刻度数量；默认 10（每 10% 一格）。 */
  ticks?: number;
  stroke?: number;
  /** 屏幕阅读用的说明，参与 aria-label。 */
  label?: string;
}

export interface ArcGaugeUpdate {
  /** 圆心大号读数（数字/百分比）。 */
  text?: string;
  /** 圆心下方小字说明（英文结构层）。 */
  caption?: string;
  tone?: CurveTone;
  /** 阈值/目标标记位置（0..1），null 表示隐藏。 */
  marker?: number | null;
}

export interface ArcGaugeHandle {
  el: SVGSVGElement;
  update(fraction: number, update?: ArcGaugeUpdate): void;
}

export function arcGauge(options: ArcGaugeOptions = {}): ArcGaugeHandle {
  const sweep = options.sweep ?? 270;
  const start = options.start ?? -sweep / 2;
  const tickCount = Math.max(0, Math.floor(options.ticks ?? 10));
  const stroke = options.stroke ?? 5.5;
  const radius = 39;
  const root = svgEl("svg", {
    viewBox: "0 0 100 100",
    class: "tri-curve-arc" + (options.className ? " " + options.className : ""),
    role: "img",
  });
  root.dataset.tone = "accent";
  if (options.label) root.setAttribute("aria-label", options.label);

  const tickGroup = svgEl("g", { class: "tri-curve-arc-ticks", "aria-hidden": "true" });
  for (let i = 0; i <= tickCount; i += 1) {
    const angle = start + (tickCount === 0 ? 0 : (sweep * i) / tickCount);
    const major = i === 0 || i === tickCount || i % 5 === 0;
    const inner = polarPoint(50, 50, major ? 44.5 : 46, angle);
    const outer = polarPoint(50, 50, 49, angle);
    tickGroup.appendChild(
      svgEl("line", {
        x1: inner.x.toFixed(2),
        y1: inner.y.toFixed(2),
        x2: outer.x.toFixed(2),
        y2: outer.y.toFixed(2),
        class: "tri-curve-arc-tick",
        "data-major": major ? "true" : "false",
      }),
    );
  }

  const pathD = arcPath(50, 50, radius, start, sweep);
  const length = arcLength(radius, sweep);
  const track = svgEl("path", {
    d: pathD,
    class: "tri-curve-arc-track",
    "stroke-width": stroke,
    fill: "none",
  });
  const fill = svgEl("path", {
    d: pathD,
    class: "tri-curve-arc-fill",
    "stroke-width": stroke,
    fill: "none",
    "stroke-dasharray": length.toFixed(3),
    "stroke-dashoffset": length.toFixed(3),
  });
  const marker = svgEl("line", {
    class: "tri-curve-arc-marker",
    visibility: "hidden",
  });
  const value = svgEl("text", {
    x: 50,
    y: 47,
    class: "tri-curve-arc-value",
    "text-anchor": "middle",
    "dominant-baseline": "central",
  });
  const caption = svgEl("text", {
    x: 50,
    y: 62,
    class: "tri-curve-arc-caption",
    "text-anchor": "middle",
  });

  root.append(tickGroup, track, fill, marker, value, caption);

  const handle: ArcGaugeHandle = {
    el: root,
    update(fraction, update) {
      const clamped = clamp01(fraction);
      fill.setAttribute("stroke-dashoffset", (length * (1 - clamped)).toFixed(3));
      if (update?.tone) root.dataset.tone = toneAttr(update.tone);
      if (update?.text != null) value.textContent = update.text;
      if (update?.caption != null) caption.textContent = update.caption;
      if (update?.marker == null) {
        marker.setAttribute("visibility", "hidden");
      } else {
        const angle = start + sweep * clamp01(update.marker);
        const a = polarPoint(50, 50, radius - stroke / 2 - 1.5, angle);
        const b = polarPoint(50, 50, radius + stroke / 2 + 1.5, angle);
        marker.setAttribute("x1", a.x.toFixed(2));
        marker.setAttribute("y1", a.y.toFixed(2));
        marker.setAttribute("x2", b.x.toFixed(2));
        marker.setAttribute("y2", b.y.toFixed(2));
        marker.setAttribute("visibility", "visible");
      }
    },
  };
  handle.update(0);
  return handle;
}

/* ------------------------------------------------------------------ *
 * 2. 曲线刻度尺（分节标题 / 曲线分隔线 / 视场比例尺）                *
 * ------------------------------------------------------------------ */

export interface CurvedScaleOptions {
  width?: number;
  height?: number;
  ticks?: number;
  /** 弧度深度系数，1 = 浅弧，2 = 半圆。 */
  curve?: number;
  className?: string;
}

export interface CurvedScaleHandle {
  el: SVGSVGElement;
  /** fraction 同时控制刻度高亮与端点标记（用于页签位置 / 进度）。 */
  update(fraction: number, options?: { tone?: CurveTone; label?: string }): void;
}

export function curvedScale(options: CurvedScaleOptions = {}): CurvedScaleHandle {
  const width = options.width ?? 96;
  const height = options.height ?? 18;
  const tickCount = Math.max(2, Math.floor(options.ticks ?? 8));
  const curvature = options.curve ?? 1.25;
  const pad = 3;
  const root = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "tri-curve-scale" + (options.className ? " " + options.className : ""),
    "aria-hidden": "true",
    preserveAspectRatio: "none",
  });
  const p0 = { x: pad, y: height - pad };
  const p2 = { x: width - pad, y: height - pad };
  const control = { x: width / 2, y: pad - (height - 2 * pad) * curvature };
  const pointAt = (t: number): { x: number; y: number } => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * control.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * control.y + t * t * p2.y,
    };
  };
  root.appendChild(
    svgEl("path", {
      d: `M ${p0.x} ${p0.y} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${p2.x} ${p2.y}`,
      class: "tri-curve-scale-line",
      fill: "none",
    }),
  );
  const tickGroup = svgEl("g", { class: "tri-curve-scale-ticks" });
  for (let i = 0; i <= tickCount; i += 1) {
    const point = pointAt(i / tickCount);
    const major = i === 0 || i === tickCount;
    tickGroup.appendChild(
      svgEl("line", {
        x1: point.x.toFixed(2),
        y1: (point.y - (major ? 3 : 1.8)).toFixed(2),
        x2: point.x.toFixed(2),
        y2: (point.y + 1).toFixed(2),
        class: "tri-curve-scale-tick",
        "data-major": major ? "true" : "false",
      }),
    );
  }
  const marker = svgEl("circle", { r: 2, class: "tri-curve-scale-marker" });
  root.append(tickGroup, marker);

  const handle: CurvedScaleHandle = {
    el: root,
    update(fraction, update) {
      const point = pointAt(clamp01(fraction));
      marker.setAttribute("cx", point.x.toFixed(2));
      marker.setAttribute("cy", point.y.toFixed(2));
      root.dataset.tone = toneAttr(update?.tone);
      if (update?.label) root.setAttribute("aria-label", update.label);
    },
  };
  handle.update(0);
  return handle;
}

/* ------------------------------------------------------------------ *
 * 3. 卡片角细弧 + 切线（比例读数：置信度 / 储备比 / 风险）           *
 * ------------------------------------------------------------------ */

export interface CornerArcHandle {
  el: HTMLElement;
  update(fraction: number, tone?: CurveTone): void;
}

/**
 * 卡片右上角的 1/4 细弧：弧长按真实比例填充，末端带一段切线。
 * 弧本身只有 26px，黄色仅用于危险/关键态，所以总面积占比极低。
 */
export function cornerArc(fraction = 0, tone: CurveTone = "accent"): CornerArcHandle {
  const wrap = el("span", { cls: "tri-corner-arc", attrs: { "aria-hidden": "true" } });
  const svgRoot = svgEl("svg", { viewBox: "0 0 30 30", class: "tri-corner-arc-svg" });
  // 右上角四分之一弧（圆心在画布外侧，弧向卡片内部展开）。
  const pathD = "M 27 2 A 24 24 0 0 0 2 27";
  const track = svgEl("path", { d: pathD, class: "tri-corner-arc-track", fill: "none", pathLength: 100 });
  const fill = svgEl("path", {
    d: pathD,
    class: "tri-corner-arc-fill",
    fill: "none",
    pathLength: 100,
    "stroke-dasharray": "0 100",
  });
  const tangent = svgEl("line", { x1: 2, y1: 27, x2: 0, y2: 29, class: "tri-corner-arc-tangent" });
  svgRoot.append(track, fill, tangent);
  wrap.appendChild(svgRoot);
  wrap.dataset.tone = tone;
  const handle: CornerArcHandle = {
    el: wrap,
    update(next, nextTone) {
      const clamped = clamp01(next);
      fill.setAttribute("stroke-dasharray", `${(clamped * 100).toFixed(1)} 100`);
      wrap.dataset.tone = toneAttr(nextTone ?? tone);
    },
  };
  handle.update(fraction, tone);
  return handle;
}

/* ------------------------------------------------------------------ *
 * 4. 环形资源摘要（同心三弧，分别对应 食物 / 能源 / 科研）          *
 * ------------------------------------------------------------------ */

export interface ReserveRingItem {
  id: string;
  short: string;
  label: string;
  fraction: number;
  tone?: CurveTone;
  locked?: boolean;
}

export interface ReserveRingUpdate {
  centerText?: string;
  caption?: string;
}

export interface ReserveRingHandle {
  el: SVGSVGElement;
  update(items: ReserveRingItem[], update?: ReserveRingUpdate): void;
}

/** 三条同心 270° 弧：外=食物，中=能源，内=科研；虚线纹理区分层级。 */
export function reserveRing(options: { className?: string } = {}): ReserveRingHandle {
  const root = svgEl("svg", {
    viewBox: "0 0 100 100",
    class: "tri-curve-reserve" + (options.className ? " " + options.className : ""),
    role: "img",
  });
  const start = -135;
  const sweep = 270;
  const rings = [
    { radius: 40, stroke: 4.4, dash: "" },
    { radius: 30, stroke: 3.4, dash: "3 2" },
    { radius: 20.5, stroke: 2.6, dash: "1.5 2" },
  ];
  const groups = rings.map((spec) => {
    const group = svgEl("g", { class: "tri-curve-reserve-ring" });
    const pathD = arcPath(50, 50, spec.radius, start, sweep);
    const length = arcLength(spec.radius, sweep);
    const track = svgEl("path", {
      d: pathD,
      class: "tri-curve-reserve-track",
      "stroke-width": spec.stroke,
      fill: "none",
      ...(spec.dash ? { "stroke-dasharray": spec.dash } : {}),
    });
    const fill = svgEl("path", {
      d: pathD,
      class: "tri-curve-reserve-fill",
      "stroke-width": spec.stroke,
      fill: "none",
      ...(spec.dash ? { "stroke-dasharray": spec.dash } : {}),
    });
    // 用 pathLength 归一化，进度与弧长无关（虚线纹理也能正确走 dashoffset）。
    track.setAttribute("pathLength", "100");
    fill.setAttribute("pathLength", "100");
    fill.setAttribute("stroke-dashoffset", "100");
    group.append(track, fill);
    root.appendChild(group);
    return { group, fill, length };
  });
  const centerText = svgEl("text", {
    x: 50,
    y: 50,
    class: "tri-curve-reserve-center",
    "text-anchor": "middle",
    "dominant-baseline": "central",
  });
  const caption = svgEl("text", {
    x: 50,
    y: 62,
    class: "tri-curve-reserve-caption",
    "text-anchor": "middle",
  });
  root.append(centerText, caption);

  const handle: ReserveRingHandle = {
    el: root,
    update(items, update) {
      for (let i = 0; i < groups.length; i += 1) {
        const entry = groups[i];
        const item = items[i];
        const fraction = item ? clamp01(item.locked ? 0 : item.fraction) : 0;
        entry.fill.setAttribute("stroke-dashoffset", (100 - fraction * 100).toFixed(2));
        entry.group.dataset.tone = toneAttr(item?.tone);
        entry.group.classList.toggle("is-locked", item?.locked === true);
        entry.group.dataset.ring = item?.id ?? String(i);
      }
      if (update?.centerText != null) centerText.textContent = update.centerText;
      if (update?.caption != null) caption.textContent = update.caption;
    },
  };
  handle.update([], { centerText: "—", caption: "RESERVE" });
  return handle;
}

/* ------------------------------------------------------------------ *
 * 5. 视口外圈方位刻度弧（同心弧 + 刻度，观测视口专用）               *
 * ------------------------------------------------------------------ */

export interface BearingRingMarker {
  /** 方位角：0°=北(+Z)，顺时针递增。 */
  bearing: number;
  label: string;
  known: boolean;
  selected?: boolean;
}

export interface BearingRingOptions {
  className?: string;
  /** 内圈观测置信弧相对外圈半径的收缩量（px）。 */
  inset?: number;
}

export interface BearingRingUpdate {
  /** 内圈置信弧比例（0..1）。 */
  confidence?: number;
  /** 内圈说明，例如「观测置信 32% · 数据点 12」。 */
  caption?: string;
}

export interface BearingRingHandle {
  el: SVGSVGElement;
  /** 容器尺寸变化时重建同心几何。 */
  resize(width: number, height: number): void;
  update(markers: BearingRingMarker[], update?: BearingRingUpdate): void;
  destroy(): void;
}

/**
 * 观测视口外圈方位刻度弧（同心结构）：
 *  - 外圈：每 5° 一根细刻度，30° 一根长刻度，四正向标 N/E/S/W；
 *    三颗恒星与母星按「系统质心方位角」打出标记（未定位的只留空刻度）；
 *  - 内圈：270° 观测置信弧，弧长 = 三星平均置信度，同时显示数据点总数；
 *  - 选中目标用信号黄长刻度 + 外圈标签强调（唯一黄色，面积很小）。
 */
export function bearingRing(options: BearingRingOptions = {}): BearingRingHandle {
  const root = svgEl("svg", {
    class: "tri-curve-bearing" + (options.className ? " " + options.className : ""),
    "aria-hidden": "true",
  });
  const inset = options.inset ?? 26;
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let radius = 0;
  let lastMarkers: BearingRingMarker[] = [];
  let lastConfidence = 0;
  let lastCaption = "";

  const geoGroup = svgEl("g", { class: "tri-curve-bearing-geo" });
  const confTrack = svgEl("path", { class: "tri-curve-bearing-conftrack", fill: "none" });
  const confFill = svgEl("path", { class: "tri-curve-bearing-conffill", fill: "none" });
  const confCaption = svgEl("text", {
    class: "tri-curve-bearing-confcap",
    "text-anchor": "middle",
    "dominant-baseline": "central",
  });
  const confGroup = svgEl("g", { class: "tri-curve-bearing-conf" });
  confGroup.append(confTrack, confFill, confCaption);
  const markerGroup = svgEl("g", { class: "tri-curve-bearing-markers" });
  root.append(geoGroup, confGroup, markerGroup);

  /** 外圈几何只在尺寸变化时重建。 */
  const renderGeometry = (): void => {
    while (geoGroup.firstChild) geoGroup.removeChild(geoGroup.firstChild);
    if (width < 40 || height < 40 || radius < 20) return;
    geoGroup.appendChild(svgEl("circle", { cx, cy, r: radius, class: "tri-curve-bearing-ring", fill: "none" }));
    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 30 === 0;
      const cardinal = deg % 90 === 0;
      const inner = polarPoint(cx, cy, radius + (major ? 3 : 1), deg);
      const outer = polarPoint(cx, cy, radius + (cardinal ? 10 : major ? 7 : 3.5), deg);
      geoGroup.appendChild(
        svgEl("line", {
          x1: inner.x.toFixed(2),
          y1: inner.y.toFixed(2),
          x2: outer.x.toFixed(2),
          y2: outer.y.toFixed(2),
          class: "tri-curve-bearing-tick",
          "data-major": major ? "true" : "false",
          "data-cardinal": cardinal ? "true" : "false",
        }),
      );
      if (cardinal) {
        const labelPoint = polarPoint(cx, cy, radius + 19, deg);
        const label = svgEl("text", {
          x: labelPoint.x.toFixed(2),
          y: labelPoint.y.toFixed(2),
          class: "tri-curve-bearing-label",
          "text-anchor": "middle",
          "dominant-baseline": "central",
        });
        label.textContent = deg === 0 ? "N 000" : deg === 90 ? "E 090" : deg === 180 ? "S 180" : "W 270";
        geoGroup.appendChild(label);
      }
    }
    // 内圈 270° 置信弧几何（下方开口）
    const innerRadius = Math.max(16, radius - inset);
    const confPath = arcPath(cx, cy, innerRadius, -135, 270);
    const confLength = arcLength(innerRadius, 270);
    confTrack.setAttribute("d", confPath);
    confFill.setAttribute("d", confPath);
    confFill.setAttribute("stroke-dasharray", confLength.toFixed(2));
    confCaption.setAttribute("x", cx.toFixed(2));
    confCaption.setAttribute("y", (cy + innerRadius + 16).toFixed(2));
    applyConfidence();
  };

  const renderMarkers = (): void => {
    while (markerGroup.firstChild) markerGroup.removeChild(markerGroup.firstChild);
    if (width < 40 || height < 40) return;
    for (const marker of lastMarkers) {
      const bearing = ((marker.bearing % 360) + 360) % 360;
      const point = polarPoint(cx, cy, radius, bearing);
      const outer = polarPoint(cx, cy, radius + (marker.selected ? 15 : 9), bearing);
      const line = svgEl("line", {
        x1: point.x.toFixed(2),
        y1: point.y.toFixed(2),
        x2: outer.x.toFixed(2),
        y2: outer.y.toFixed(2),
        class: "tri-curve-bearing-marker",
      });
      line.dataset.known = marker.known ? "true" : "false";
      line.dataset.selected = marker.selected === true ? "true" : "false";
      markerGroup.appendChild(line);
      const labelPoint = polarPoint(cx, cy, radius + (marker.selected ? 24 : 17), bearing);
      const label = svgEl("text", {
        x: labelPoint.x.toFixed(2),
        y: labelPoint.y.toFixed(2),
        class: "tri-curve-bearing-markerlabel",
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      label.dataset.selected = marker.selected === true ? "true" : "false";
      label.dataset.known = marker.known ? "true" : "false";
      label.textContent = marker.label;
      markerGroup.append(line, label);
    }
  };

  const applyConfidence = (): void => {
    if (width < 40 || height < 40) return;
    const innerRadius = Math.max(16, radius - inset);
    const confLength = arcLength(innerRadius, 270);
    confFill.setAttribute("stroke-dashoffset", (confLength * (1 - Math.max(0, Math.min(1, lastConfidence)))).toFixed(2));
    if (lastCaption) confCaption.textContent = lastCaption;
  };

  const handle: BearingRingHandle = {
    el: root,
    resize(nextWidth, nextHeight) {
      width = Math.max(0, nextWidth);
      height = Math.max(0, nextHeight);
      cx = width / 2;
      cy = height / 2;
      radius = Math.max(0, Math.min(width, height) * 0.46);
      root.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
      root.setAttribute("width", String(Math.max(1, width)));
      root.setAttribute("height", String(Math.max(1, height)));
      renderGeometry();
      renderMarkers();
    },
    update(markers, update) {
      lastMarkers = markers;
      if (update?.confidence != null) lastConfidence = update.confidence;
      if (update?.caption != null) lastCaption = update.caption;
      renderMarkers();
      applyConfidence();
    },
    destroy() {
      root.remove();
    },
  };
  return handle;
}
