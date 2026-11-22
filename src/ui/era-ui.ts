/**
 * Era / progression UI primitives for the V2 geometric HUD.
 *
 * Pure presentation helpers shared by the HUD, the left panel, the build /
 * research modals, the setup screen and the manual. They only consume the
 * frozen era fields of the ViewModel plus the public ERAS constant table; no
 * simulation module is imported and every field access is undefined-safe so a
 * partially migrated backend can never blank the interface.
 */
import { ERAS } from "../core/constants";
import type { EraRequirementView, QueueView } from "../game/viewTypes";
import { append, clear, el, setClass, setText } from "./dom";
import { icon } from "./icons";
import { clamp01, int, num, pct } from "./format";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface EraInfo {
  era: number;
  name: string;
  subtitle: string;
}

const FALLBACK_ERAS: EraInfo[] = [
  { era: 1, name: "原始时代", subtitle: "部落" },
  { era: 2, name: "农业时代", subtitle: "城邦" },
  { era: 3, name: "工业时代", subtitle: "蒸汽与电气" },
  { era: 4, name: "信息时代", subtitle: "航天" },
  { era: 5, name: "星际时代", subtitle: "抉择" },
];

function rawEras(): EraInfo[] {
  const list = Array.isArray(ERAS) ? ERAS : [];
  const out: EraInfo[] = [];
  for (let i = 0; i < 5; i += 1) {
    const source = list[i] as { era?: number; name?: string; subtitle?: string } | undefined;
    const fallback = FALLBACK_ERAS[i];
    out.push({
      era: typeof source?.era === "number" ? source.era : fallback.era,
      name: source?.name || fallback.name,
      subtitle: source?.subtitle || fallback.subtitle,
    });
  }
  return out;
}

export const ERA_INFOS: EraInfo[] = rawEras();
export const ERA_COUNT = ERA_INFOS.length;

export function clampEra(era: number | null | undefined): number {
  if (typeof era !== "number" || !Number.isFinite(era)) return 1;
  return Math.min(ERA_COUNT, Math.max(1, Math.round(era)));
}

export function eraInfo(era: number | null | undefined): EraInfo {
  return ERA_INFOS[clampEra(era) - 1];
}

export function nextEraInfo(era: number | null | undefined): EraInfo | null {
  const current = clampEra(era);
  return current >= ERA_COUNT ? null : ERA_INFOS[current];
}

export function eraCode(era: number | null | undefined): string {
  return "E" + clampEra(era);
}

export function eraLabel(era: number | null | undefined): string {
  const info = eraInfo(era);
  return eraCode(era) + " " + info.name;
}

/* ------------------------------------------------------------------ *
 *  Era emblem: concentric rings + E1..E5 tick arc                    *
 * ------------------------------------------------------------------ */

export interface EraEmblemHandle {
  el: SVGSVGElement;
  update(era: number, progress?: number): void;
}

/** Small SVG emblem: two concentric rings, five era ticks and the E-number. */
export function eraEmblem(size = 30, className = ""): EraEmblemHandle {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("class", "tri-era-emblem" + (className ? " " + className : ""));
  svg.setAttribute("aria-hidden", "true");

  const ringOuter = document.createElementNS(SVG_NS, "circle");
  ringOuter.setAttribute("cx", "32");
  ringOuter.setAttribute("cy", "32");
  ringOuter.setAttribute("r", "28");
  ringOuter.setAttribute("class", "tri-era-emblem-outer");
  const ringInner = document.createElementNS(SVG_NS, "circle");
  ringInner.setAttribute("cx", "32");
  ringInner.setAttribute("cy", "32");
  ringInner.setAttribute("r", "21");
  ringInner.setAttribute("class", "tri-era-emblem-inner");
  svg.append(ringOuter, ringInner);

  const ticks: SVGCircleElement[] = [];
  for (let i = 0; i < ERA_COUNT; i += 1) {
    const angle = (-90 + (360 / ERA_COUNT) * i) * (Math.PI / 180);
    const tick = document.createElementNS(SVG_NS, "circle");
    tick.setAttribute("cx", (32 + Math.cos(angle) * 24.5).toFixed(2));
    tick.setAttribute("cy", (32 + Math.sin(angle) * 24.5).toFixed(2));
    tick.setAttribute("r", "2.1");
    tick.setAttribute("class", "tri-era-emblem-tick");
    ticks.push(tick);
    svg.appendChild(tick);
  }

  const progress = document.createElementNS(SVG_NS, "circle");
  progress.setAttribute("cx", "32");
  progress.setAttribute("cy", "32");
  progress.setAttribute("r", "16");
  progress.setAttribute("class", "tri-era-emblem-progress");
  progress.setAttribute("stroke-dasharray", (2 * Math.PI * 16).toFixed(2));
  progress.setAttribute("stroke-dashoffset", String(2 * Math.PI * 16));
  progress.setAttribute("transform", "rotate(-90 32 32)");
  svg.appendChild(progress);

  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("x", "32");
  label.setAttribute("y", "32");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "central");
  label.setAttribute("class", "tri-era-emblem-label");
  label.textContent = "E1";
  svg.appendChild(label);

  const circumference = 2 * Math.PI * 16;
  return {
    el: svg,
    update(era, ratio) {
      const current = clampEra(era);
      label.textContent = "E" + current;
      svg.dataset.era = String(current);
      for (let i = 0; i < ticks.length; i += 1) {
        ticks[i].setAttribute("class", "tri-era-emblem-tick" + (i + 1 < current ? " is-past" : i + 1 === current ? " is-current" : ""));
      }
      const value = typeof ratio === "number" && Number.isFinite(ratio) ? clamp01(ratio) : 0;
      progress.setAttribute("stroke-dashoffset", (circumference * (1 - value)).toFixed(2));
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Era rail: five-node timeline                                       *
 * ------------------------------------------------------------------ */

export interface EraRailOptions {
  /** Only show E1..E5 codes, no era names (for the HUD / narrow panels). */
  compact?: boolean;
  className?: string;
  /** Render as a vertical rail (left panel) instead of a compact horizontal strip. */
  vertical?: boolean;
}

export interface EraRailHandle {
  el: HTMLElement;
  update(current: number, progress?: number): void;
}

/** Five-node era timeline with past / current / future states. */
export function eraRail(options: EraRailOptions = {}): EraRailHandle {
  const root = el("div", {
    cls:
      "tri-era-rail" +
      (options.vertical ? " is-vertical" : "") +
      (options.compact ? " is-compact" : "") +
      (options.className ? " " + options.className : ""),
    attrs: { role: "list", "aria-label": "时代时间线" },
  });
  const nodes: { node: HTMLElement; dot: HTMLElement; name: HTMLElement; sub: HTMLElement }[] = [];
  for (const info of ERA_INFOS) {
    const node = el("div", { cls: "tri-era-node", attrs: { role: "listitem", "data-era": String(info.era) } });
    const dot = el("span", { cls: "tri-era-node-dot" });
    dot.appendChild(el("b", { text: "E" + info.era }));
    const text = el("div", { cls: "tri-era-node-text" });
    const name = el("span", { cls: "tri-era-node-name", text: info.name });
    const sub = el("span", { cls: "tri-era-node-sub", text: info.subtitle });
    append(text, name, sub);
    node.append(dot, text);
    root.appendChild(node);
    nodes.push({ node, dot, name, sub });
  }
  const handle: EraRailHandle = {
    el: root,
    update(current, progress) {
      const active = clampEra(current);
      for (const entry of nodes) {
        const era = Number(entry.node.dataset.era);
        setClass(entry.node, "is-past", era < active);
        setClass(entry.node, "is-current", era === active);
      }
      const currentEntry = nodes[active - 1];
      if (currentEntry && typeof progress === "number" && Number.isFinite(progress)) {
        currentEntry.node.style.setProperty("--era-progress", (clamp01(progress) * 100).toFixed(1) + "%");
      }
    },
  };
  return handle;
}

/* ------------------------------------------------------------------ *
 *  Next-era requirement checklist                                     *
 * ------------------------------------------------------------------ */

export interface RequirementListHandle {
  el: HTMLElement;
  update(requirements: EraRequirementView[] | null | undefined, nextEraName: string | null | undefined): void;
}

function requirementRatio(req: EraRequirementView): number {
  const target = Number(req.target);
  const current = Number(req.current);
  if (!Number.isFinite(target) || target <= 0) return req.met ? 1 : 0;
  if (!Number.isFinite(current)) return 0;
  return clamp01(current / target);
}

/** Checklist for entering the next era: check marks, values and progress bars. */
export function requirementList(): RequirementListHandle {
  const root = el("div", { cls: "tri-req-list" });
  const head = el("div", { cls: "tri-req-head" });
  const headTitle = el("span", { cls: "tri-req-title", text: "时代门槛" });
  const headMeta = el("span", { cls: "tri-req-meta", text: "—" });
  append(head, headTitle, headMeta);
  root.appendChild(head);
  const list = el("div", { cls: "tri-req-items" });
  root.appendChild(list);
  const empty = el("div", { cls: "tri-req-empty", text: "已达最终时代 · 文明走向星际" });
  root.appendChild(empty);

  const rows = new Map<string, { row: HTMLElement; check: HTMLElement; label: HTMLElement; value: HTMLElement; fill: HTMLElement }>();

  function createRow(id: string): void {
    const row = el("div", { cls: "tri-req-row", attrs: { "data-req": id } });
    const check = el("span", { cls: "tri-req-check" });
    const body = el("div", { cls: "tri-req-body" });
    const top = el("div", { cls: "tri-req-row-top" });
    const label = el("span", { cls: "tri-req-label", text: "—" });
    const value = el("span", { cls: "tri-req-value", text: "—" });
    append(top, label, value);
    const bar = el("div", { cls: "tri-req-bar" });
    const fill = el("span", { cls: "tri-req-bar-fill" });
    bar.appendChild(fill);
    append(body, top, bar);
    append(row, check, body);
    list.appendChild(row);
    rows.set(id, { row, check, label, value, fill });
  }

  return {
    el: root,
    update(requirements, nextEraName) {
      const items = Array.isArray(requirements) ? requirements.filter((item) => item && typeof item.id === "string") : [];
      const hasNext = typeof nextEraName === "string" && nextEraName.length > 0;
      setText(headTitle, hasNext ? "进入 " + nextEraName : "时代门槛");
      empty.classList.toggle("tri-hidden", items.length > 0 || hasNext);
      list.classList.toggle("tri-hidden", items.length === 0 && !hasNext);
      if (!hasNext && items.length === 0) {
        setText(headMeta, "最终时代");
        for (const entry of rows.values()) entry.row.remove();
        rows.clear();
        return;
      }
      const seen = new Set<string>();
      let metCount = 0;
      for (const item of items) {
        seen.add(item.id);
        if (!rows.has(item.id)) createRow(item.id);
        const entry = rows.get(item.id);
        if (!entry) continue;
        const ratio = requirementRatio(item);
        const met = item.met === true || ratio >= 1;
        if (met) metCount += 1;
        setText(entry.label, item.label ?? item.id);
        setText(entry.value, num(item.current) + " / " + num(item.target) + (item.unit ? " " + item.unit : ""));
        entry.fill.style.width = (ratio * 100).toFixed(1) + "%";
        entry.row.dataset.met = met ? "true" : "false";
        setClass(entry.row, "is-met", met);
        clear(entry.check);
        entry.check.appendChild(icon(met ? "check" : "lock", 11));
      }
      for (const [id, entry] of Array.from(rows.entries())) {
        if (seen.has(id)) continue;
        entry.row.remove();
        rows.delete(id);
      }
      const total = items.length;
      setText(headMeta, total > 0 ? metCount + " / " + total + " 达标 · " + pct(total > 0 ? metCount / total : 1, 0) : "—");
      empty.classList.toggle("tri-hidden", !(total === 0 && !hasNext));
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Construction queue: new build vs upgrade                           *
 * ------------------------------------------------------------------ */

export interface QueueKindInfo {
  kind: "build" | "upgrade";
  label: string;
  detail: string;
}

/**
 * The frozen QueueView contract has no explicit job kind. We accept optional
 * additive fields if the backend provides them (`kind`, `upgradeFrom`,
 * `upgradeFromName`) and otherwise fall back to a conservative name check, so
 * the visual distinction is correct as soon as the field lands.
 */
export function queueKindInfo(job: Partial<QueueView> & { kind?: string; upgradeFrom?: string | null; upgradeFromName?: string | null }): QueueKindInfo {
  const declared = (job as { kind?: string }).kind;
  const upgradeFrom = (job as { upgradeFrom?: unknown }).upgradeFrom;
  const name = typeof job.name === "string" ? job.name : "";
  const isUpgrade =
    declared === "upgrade" ||
    (typeof upgradeFrom === "string" && upgradeFrom.length > 0) ||
    /^升级|升级$|→/.test(name) ||
    name.includes("升级") ||
    name.includes("→");
  if (isUpgrade) {
    const fromName = (job as { upgradeFromName?: string | null }).upgradeFromName;
    return {
      kind: "upgrade",
      label: "升级",
      detail: typeof fromName === "string" && fromName.length > 0 ? "由 " + fromName + " 升级" : "旧时代建筑升级",
    };
  }
  return { kind: "build", label: "新建", detail: "新增建筑" };
}

/* ------------------------------------------------------------------ *
 *  Small tags                                                         *
 * ------------------------------------------------------------------ */

/** Era tag pill (E1..E5), tone classes drive the colour. */
export function eraTag(era: number | null | undefined, extraClass = ""): HTMLElement {
  const current = clampEra(era);
  const node = el("span", {
    cls: "tri-era-tag" + (extraClass ? " " + extraClass : ""),
    text: "E" + current,
    attrs: { title: eraLabel(current) },
  });
  node.dataset.era = String(current);
  return node;
}

/** Tier ticks: filled = reached tier. */
export function tierTicks(tier: number | null | undefined, max = 3): HTMLElement {
  const value = typeof tier === "number" && Number.isFinite(tier) ? Math.max(0, Math.round(tier)) : 0;
  const node = el("span", { cls: "tri-tier-ticks", attrs: { title: "层级 T" + value } });
  for (let i = 1; i <= max; i += 1) {
    const tick = el("i", { cls: "tri-tier-tick" + (i <= value ? " is-on" : "") });
    node.appendChild(tick);
  }
  return node;
}

/** "旧时代 · 产出衰减" badge used by built / outdated building cards. */
export function outdatedBadge(era: number | null | undefined): HTMLElement {
  const node = el("span", { cls: "tri-outdated-badge" });
  node.appendChild(icon("alert", 11));
  node.appendChild(el("span", { text: "旧时代 · 产出衰减" }));
  node.title = "该建筑属于 " + eraCode(era) + "，产出按时代差距折减；升级到当代层级可恢复。";
  return node;
}

/** Locked overlay content: "E3 解锁". */
export function lockHint(era: number | null | undefined): HTMLElement {
  const node = el("span", { cls: "tri-lock-hint" });
  node.appendChild(icon("lock", 12));
  node.appendChild(el("span", { text: eraCode(era) + " 解锁" }));
  return node;
}

/** Resource icon name for the observation currency. */
export function currencyIcon(kind: "food" | "energy" | string): string {
  return kind === "energy" ? "bolt" : "wheat";
}

/** Progress ring used by era / research / observatory headers. */
export function eraRingPercent(ratio: number | null | undefined): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return "—";
  return int(clamp01(ratio) * 100) + "%";
}
