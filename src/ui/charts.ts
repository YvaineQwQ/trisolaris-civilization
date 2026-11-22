/**
 * Dependency-free data visualisation primitives (SVG + CSS meters).
 * Every chart is built once and patched in place; panels keep their scroll
 * position and hover state while numbers stream in.
 */
import { el, setAttr, setStyle, setText } from "./dom";
import { clamp01, num } from "./format";

const SVG_NS = "http://www.w3.org/2000/svg";

export type MeterTone = "accent" | "ok" | "warn" | "danger" | "muted" | "violet" | "amber";

export function toneForConfidence(tone: "good" | "ok" | "warn" | "bad"): MeterTone {
  switch (tone) {
    case "good":
      return "ok";
    case "ok":
      return "accent";
    case "warn":
      return "warn";
    default:
      return "danger";
  }
}

export function toneForRatio(ratio: number): MeterTone {
  if (ratio < 0.15) return "danger";
  if (ratio < 0.35) return "warn";
  if (ratio < 0.6) return "accent";
  return "ok";
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node as unknown as SVGElementTagNameMap[K];
}

function axisText(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e4) return num(value / 1e4, 1) + "万";
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/* ------------------------------------------------------------------ *
 *  Sparkline                                                         *
 * ------------------------------------------------------------------ */

export interface SparkOptions {
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  zeroLine?: boolean;
  min?: number;
  max?: number;
  strokeWidth?: number;
  className?: string;
}

export interface SparkHandle {
  el: SVGElement;
  update(values: number[], options?: { min?: number; max?: number; color?: string }): void;
}

export function sparkline(options: SparkOptions = {}): SparkHandle {
  const width = options.width ?? 220;
  const height = options.height ?? 44;
  const root = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    class: "tri-spark" + (options.className ? " " + options.className : ""),
  });
  const zero = svgEl("line", { x1: 0, y1: height / 2, x2: width, y2: height / 2, class: "tri-spark-zero" });
  if (!options.zeroLine) zero.setAttribute("visibility", "hidden");
  const area = svgEl("polygon", { points: "", class: "tri-spark-area" });
  if (!options.fill) area.setAttribute("visibility", "hidden");
  const line = svgEl("polyline", { points: "", class: "tri-spark-line" });
  line.style.strokeWidth = String(options.strokeWidth ?? 1.6);
  if (options.color) line.style.stroke = options.color;
  const dot = svgEl("circle", { r: 2.2, cx: 0, cy: 0, class: "tri-spark-dot" });
  if (options.color) dot.style.fill = options.color;
  root.appendChild(zero);
  root.appendChild(area);
  root.appendChild(line);
  root.appendChild(dot);

  const handle: SparkHandle = {
    el: root,
    update(values, updateOptions) {
      const points = values.filter((value) => Number.isFinite(value));
      const minOverride = updateOptions?.min ?? options.min;
      const maxOverride = updateOptions?.max ?? options.max;
      if (updateOptions?.color) {
        line.style.stroke = updateOptions.color;
        dot.style.fill = updateOptions.color;
      }
      if (points.length < 2) {
        line.setAttribute("visibility", "hidden");
        area.setAttribute("visibility", "hidden");
        dot.setAttribute("visibility", "hidden");
        return;
      }
      line.removeAttribute("visibility");
      if (options.fill) area.removeAttribute("visibility");
      dot.removeAttribute("visibility");
      let min = minOverride ?? Math.min(...points);
      let max = maxOverride ?? Math.max(...points);
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        min = 0;
        max = 1;
      }
      if (max - min < 1e-9) {
        min -= 1;
        max += 1;
      } else if (minOverride == null && maxOverride == null) {
        const pad = (max - min) * 0.12;
        min -= pad;
        max += pad;
      }
      const span = max - min;
      const stepX = width / (points.length - 1);
      const coords: string[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const x = (i * stepX).toFixed(2);
        const y = (((max - points[i]) / span) * height).toFixed(2);
        coords.push(x + "," + y);
      }
      const linePoints = coords.join(" ");
      line.setAttribute("points", linePoints);
      area.setAttribute("points", "0," + height + " " + linePoints + " " + width + "," + height);
      const last = coords[coords.length - 1].split(",");
      dot.setAttribute("cx", last[0]);
      dot.setAttribute("cy", last[1]);
      if (options.zeroLine && min < 0 && max > 0) {
        zero.removeAttribute("visibility");
        zero.setAttribute("y1", String(((max / span) * height).toFixed(2)));
        zero.setAttribute("y2", String(((max / span) * height).toFixed(2)));
      } else {
        zero.setAttribute("visibility", "hidden");
      }
    },
  };
  handle.update([]);
  return handle;
}

/* ------------------------------------------------------------------ *
 *  Multi-series line chart                                           *
 * ------------------------------------------------------------------ */

export interface LineSeriesSpec {
  color: string;
  fill?: boolean;
  width?: number;
  dashed?: boolean;
}

export interface LineChartOptions {
  width?: number;
  height?: number;
  series: LineSeriesSpec[];
  className?: string;
  showXAxis?: boolean;
}

export interface LineChartHandle {
  el: SVGElement;
  update(values: number[][], range?: { yMin?: number; yMax?: number; xLabels?: [string, string] }): void;
}

export function lineChart(options: LineChartOptions): LineChartHandle {
  const width = options.width ?? 320;
  const height = options.height ?? 132;
  const pad = { top: 10, right: 8, bottom: options.showXAxis === false ? 8 : 18, left: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const root = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "tri-linechart" + (options.className ? " " + options.className : ""),
  });

  const gridGroup = svgEl("g", { class: "tri-chart-grid" });
  const yLabels: SVGTextElement[] = [];
  for (let i = 0; i <= 3; i += 1) {
    const y = pad.top + (innerH * i) / 3;
    gridGroup.appendChild(svgEl("line", { x1: pad.left, y1: y, x2: width - pad.right, y2: y }));
    const label = svgEl("text", {
      x: pad.left - 6,
      y: y + 3,
      "text-anchor": "end",
      class: "tri-chart-label",
    });
    yLabels.push(label);
    gridGroup.appendChild(label);
  }
  const xLabelLeft = svgEl("text", { x: pad.left, y: height - 4, class: "tri-chart-label" });
  const xLabelRight = svgEl("text", { x: width - pad.right, y: height - 4, "text-anchor": "end", class: "tri-chart-label" });
  gridGroup.appendChild(xLabelLeft);
  gridGroup.appendChild(xLabelRight);
  root.appendChild(gridGroup);

  const lines: { poly: SVGPolylineElement; area: SVGPolygonElement | null; spec: LineSeriesSpec }[] = [];
  for (const spec of options.series) {
    let area: SVGPolygonElement | null = null;
    if (spec.fill) {
      area = svgEl("polygon", { points: "", class: "tri-chart-area" });
      area.style.fill = spec.color;
      root.appendChild(area);
    }
    const poly = svgEl("polyline", { points: "", class: "tri-chart-line" });
    poly.style.stroke = spec.color;
    if (spec.width) poly.style.strokeWidth = String(spec.width);
    if (spec.dashed) poly.style.strokeDasharray = "4 3";
    root.appendChild(poly);
    lines.push({ poly, area, spec });
  }

  const handle: LineChartHandle = {
    el: root,
    update(values, range) {
      const series = values.map((list) => list.filter((value) => Number.isFinite(value)));
      let min = range?.yMin;
      let max = range?.yMax;
      if (min == null || max == null) {
        const all = series.flat();
        if (all.length > 0) {
          min = min ?? Math.min(...all);
          max = max ?? Math.max(...all);
        } else {
          min = min ?? 0;
          max = max ?? 1;
        }
        const padY = (max - min) * 0.08 || 1;
        min -= padY;
        max += padY;
      }
      if (max - min < 1e-9) {
        min -= 1;
        max += 1;
      }
      const span = max - min;
      const toY = (value: number): number => pad.top + ((max - value) / span) * innerH;
      for (let i = 0; i < yLabels.length; i += 1) {
        const value = max - (span * i) / (yLabels.length - 1);
        setText(yLabels[i], axisText(value));
      }
      if (range?.xLabels) {
        setText(xLabelLeft, range.xLabels[0]);
        setText(xLabelRight, range.xLabels[1]);
      }
      const maxLen = Math.max(1, ...series.map((list) => list.length));
      for (let s = 0; s < lines.length; s += 1) {
        const list = series[s] ?? [];
        const entry = lines[s];
        if (list.length < 2) {
          entry.poly.setAttribute("visibility", "hidden");
          if (entry.area) entry.area.setAttribute("visibility", "hidden");
          continue;
        }
        entry.poly.removeAttribute("visibility");
        if (entry.area) entry.area.removeAttribute("visibility");
        const points: string[] = [];
        for (let i = 0; i < list.length; i += 1) {
          const x = pad.left + (maxLen === 1 ? 0 : (i / (maxLen - 1)) * innerW);
          points.push(x.toFixed(2) + "," + toY(list[i]).toFixed(2));
        }
        entry.poly.setAttribute("points", points.join(" "));
        if (entry.area) {
          entry.area.setAttribute("points", `${pad.left},${pad.top + innerH} ${points.join(" ")} ${pad.left + innerW},${pad.top + innerH}`);
        }
      }
    },
  };
  return handle;
}

/* ------------------------------------------------------------------ *
 *  Ring gauge                                                        *
 * ------------------------------------------------------------------ */

export interface RingOptions {
  size?: number;
  stroke?: number;
  label?: string;
  tone?: MeterTone;
  className?: string;
}

export interface RingHandle {
  el: SVGElement;
  update(fraction: number, text?: string, tone?: MeterTone): void;
}

export function ringGauge(options: RingOptions = {}): RingHandle {
  const size = options.size ?? 84;
  const stroke = options.stroke ?? 7;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const root = svgEl("svg", {
    viewBox: "0 0 100 100",
    width: size,
    height: size,
    class: "tri-ring" + (options.className ? " " + options.className : ""),
  });
  root.dataset.tone = options.tone ?? "accent";
  const track = svgEl("circle", {
    cx: 50,
    cy: 50,
    r: radius,
    class: "tri-ring-track",
    "stroke-width": stroke,
    fill: "none",
  });
  const fill = svgEl("circle", {
    cx: 50,
    cy: 50,
    r: radius,
    class: "tri-ring-fill",
    "stroke-width": stroke,
    fill: "none",
    "stroke-dasharray": circumference.toFixed(2),
    "stroke-dashoffset": circumference.toFixed(2),
    transform: "rotate(-90 50 50)",
    "stroke-linecap": "round",
  });
  const value = svgEl("text", {
    x: 50,
    y: 50,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    class: "tri-ring-value",
  });
  const label = svgEl("text", {
    x: 50,
    y: 68,
    "text-anchor": "middle",
    class: "tri-ring-label",
  });
  setText(value, "—");
  if (options.label) setText(label, options.label);
  root.appendChild(track);
  root.appendChild(fill);
  root.appendChild(value);
  root.appendChild(label);

  const handle: RingHandle = {
    el: root,
    update(fraction, text, tone) {
      const clamped = clamp01(fraction);
      fill.setAttribute("stroke-dashoffset", (circumference * (1 - clamped)).toFixed(2));
      root.dataset.tone = tone ?? options.tone ?? "accent";
      if (text != null) setText(value, text);
    },
  };
  return handle;
}

/* ------------------------------------------------------------------ *
 *  CSS meters                                                        *
 * ------------------------------------------------------------------ */

export interface MeterHandle {
  el: HTMLElement;
  update(ratio: number, options?: { text?: string; tone?: MeterTone; marker?: number }): void;
}

export function meterBar(tone: MeterTone = "accent", showText = false): MeterHandle {
  const root = el("div", { cls: "tri-meter" });
  root.dataset.tone = tone;
  const fill = el("div", { cls: "tri-meter-fill" });
  const marker = el("div", { cls: "tri-meter-marker" });
  marker.style.display = "none";
  const text = el("span", { cls: "tri-meter-text" + (showText ? "" : " tri-hidden") });
  root.appendChild(fill);
  root.appendChild(marker);
  root.appendChild(text);
  const handle: MeterHandle = {
    el: root,
    update(ratio, options) {
      const clamped = clamp01(ratio);
      setStyle(fill, "width", (clamped * 100).toFixed(1) + "%");
      root.dataset.tone = options?.tone ?? tone;
      if (showText && options?.text != null) setText(text, options.text);
      if (options?.marker != null && Number.isFinite(options.marker)) {
        marker.style.display = "";
        setStyle(marker, "left", (clamp01(options.marker) * 100).toFixed(1) + "%");
      } else {
        marker.style.display = "none";
      }
    },
  };
  handle.update(0);
  return handle;
}

export interface MeterRowHandle {
  el: HTMLElement;
  update(ratio: number, valueText?: string, tone?: MeterTone): void;
  setLabel(label: string): void;
}

/** A label + bar + value row, the workhorse of every readout panel. */
export function meterRow(label: string, options?: { tone?: MeterTone; value?: string }): MeterRowHandle {
  const root = el("div", { cls: "tri-meter-row" });
  const labelNode = el("span", { cls: "tri-meter-label", text: label });
  const meter = meterBar(options?.tone ?? "accent");
  const valueNode = el("span", { cls: "tri-meter-value", text: options?.value ?? "—" });
  root.appendChild(labelNode);
  root.appendChild(meter.el);
  root.appendChild(valueNode);
  return {
    el: root,
    update(ratio, valueText, tone) {
      meter.update(ratio, { tone: tone ?? options?.tone ?? "accent" });
      if (valueText != null) setText(valueNode, valueText);
    },
    setLabel(next) {
      setText(labelNode, next);
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Stat tile                                                         *
 * ------------------------------------------------------------------ */

export interface StatTileHandle {
  el: HTMLElement;
  set(label: string, value: string, sub?: string, tone?: MeterTone): void;
}

export function statTile(label = "", value = "—", sub = ""): StatTileHandle {
  const root = el("div", { cls: "tri-stat" });
  const labelNode = el("span", { cls: "tri-stat-label", text: label });
  const valueNode = el("span", { cls: "tri-stat-value", text: value });
  const subNode = el("span", { cls: "tri-stat-sub", text: sub });
  root.appendChild(labelNode);
  root.appendChild(valueNode);
  root.appendChild(subNode);
  return {
    el: root,
    set(nextLabel, nextValue, nextSub, tone) {
      if (nextLabel) setText(labelNode, nextLabel);
      setText(valueNode, nextValue);
      setText(subNode, nextSub ?? "");
      if (tone) root.dataset.tone = tone;
    },
  };
}

/** Simple horizontal segmented bar (used for stability factors and costs). */
export function segmentedBar(segments: { value: number; tone: MeterTone }[]): HTMLElement {
  const root = el("div", { cls: "tri-segbar" });
  for (const segment of segments) {
    const child = el("span", { cls: "tri-segbar-cell" });
    child.dataset.tone = segment.tone;
    setStyle(child, "flex", String(Math.max(0.0001, segment.value)));
    root.appendChild(child);
  }
  return root;
}

/** Update a set of stat children without rebuilding. */
export function setTone(node: HTMLElement, tone: MeterTone): void {
  setAttr(node, "data-tone", tone);
}
