/** Reusable panel building blocks (section headers, key/value rows, chips). */
import { append, el, setClass, setText } from "./dom";
import { icon } from "./icons";
import { curvedScale } from "./curves";
import type { CurveTone, CurvedScaleHandle } from "./curves";

export interface SectionHandle {
  el: HTMLElement;
  body: HTMLElement;
  head: HTMLElement;
  /** v1.4：弧形分节标题的刻度弧（无弧时为 null）。 */
  arc: CurvedScaleHandle | null;
  setArc(fraction: number, tone?: CurveTone): void;
}

export interface SectionOptions {
  icon?: string;
  aside?: Node;
  cls?: string;
  hint?: string;
  /** v1.4：在标题右侧挂一条曲线刻度尺，刻度位置绑定该分节的数据比例。 */
  arc?: boolean | number;
}

/** A titled panel section with a scrollable body. */
export function section(title: string, options: SectionOptions = {}): SectionHandle {
  const root = el("section", { cls: "tri-section" + (options.cls ? " " + options.cls : "") });
  const head = el("header", { cls: "tri-section-head" });
  if (options.icon) head.appendChild(icon(options.icon, 15));
  head.appendChild(el("h3", { cls: "tri-section-title", text: title }));
  if (options.hint) head.appendChild(el("span", { cls: "tri-section-hint", text: options.hint }));
  if (options.aside) head.appendChild(options.aside);
  /* v1.4 弧形分节标题：右端一条浅弧刻度尺，标记位置 = 本节数据比例。 */
  let arc: CurvedScaleHandle | null = null;
  if (options.arc !== undefined && options.arc !== false) {
    head.classList.add("has-arc");
    arc = curvedScale({ width: 62, height: 16, ticks: 8, className: "tri-section-arc" });
    const arcWrap = el("span", { cls: "tri-section-arcwrap", attrs: { "aria-hidden": "true" } });
    arcWrap.appendChild(arc.el);
    head.appendChild(arcWrap);
    if (typeof options.arc === "number") arc.update(options.arc, { label: title + " 比例" });
  }
  const body = el("div", { cls: "tri-section-body" });
  root.appendChild(head);
  root.appendChild(body);
  return {
    el: root,
    body,
    head,
    arc,
    setArc(fraction, tone) {
      arc?.update(fraction, { tone });
    },
  };
}

export interface KvHandle {
  el: HTMLElement;
  labelNode: HTMLElement;
  valueNode: HTMLElement;
  set(value: string, tone?: string): void;
}

/** Label / value row used in dense readouts. */
export function kv(label: string, value = "—"): KvHandle {
  const root = el("div", { cls: "tri-kv" });
  const labelNode = el("span", { cls: "tri-kv-key", text: label });
  root.appendChild(labelNode);
  const valueNode = el("span", { cls: "tri-kv-value", text: value });
  root.appendChild(valueNode);
  return {
    el: root,
    labelNode,
    valueNode,
    set(next, tone) {
      setText(valueNode, next);
      setClass(valueNode, "tri-tone-danger", tone === "danger");
      setClass(valueNode, "tri-tone-warn", tone === "warn");
      setClass(valueNode, "tri-tone-ok", tone === "ok");
      setClass(valueNode, "tri-muted", tone === "muted");
    },
  };
}

export function divider(cls = ""): HTMLElement {
  return el("div", { cls: "tri-divider" + (cls ? " " + cls : "") });
}

export function emptyBox(text: string): HTMLElement {
  const node = el("div", { cls: "tri-empty" });
  node.appendChild(icon("info", 15));
  node.appendChild(el("span", { text }));
  return node;
}

/** Known/unknown flag pill; never shows a fabricated value. */
export function knowledgeFlag(known: boolean, label: string): HTMLElement {
  const node = el("span", {
    cls: "tri-flag " + (known ? "is-known" : "is-unknown"),
    text: (known ? "✓ " : "— ") + label,
    attrs: { title: known ? label + "：已观测" : label + "：未观测" },
  });
  return node;
}

export function dot(color: string, size = 8): HTMLElement {
  const node = el("i", { cls: "tri-dot" });
  node.style.width = size + "px";
  node.style.height = size + "px";
  node.style.background = color;
  node.style.boxShadow = "0 0 6px " + color;
  return node;
}

export function chip(text: string, tone?: string): HTMLElement {
  const node = el("span", { cls: "tri-chip" + (tone ? " tri-chip-" + tone : ""), text });
  return node;
}

export function resourceIconName(id: string): string {
  switch (id) {
    case "food":
      return "wheat";
    case "water":
      return "water";
    case "energy":
      return "bolt";
    case "minerals":
      return "mineral";
    case "metals":
      return "metal";
    case "science":
      return "flask";
    default:
      return "dot";
  }
}

export function statBig(label: string, value: string, sub = ""): { el: HTMLElement; set(value: string, sub?: string): void } {
  const root = el("div", { cls: "tri-bigstat" });
  root.appendChild(el("span", { cls: "tri-bigstat-label", text: label }));
  const valueNode = el("span", { cls: "tri-bigstat-value", text: value });
  const subNode = el("span", { cls: "tri-bigstat-sub", text: sub });
  append(root, valueNode, subNode);
  return {
    el: root,
    set(nextValue, nextSub) {
      setText(valueNode, nextValue);
      if (nextSub != null) setText(subNode, nextSub);
    },
  };
}
