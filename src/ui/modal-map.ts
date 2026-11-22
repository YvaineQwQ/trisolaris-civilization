/** Galaxy map modal: observed positions projected on the X-Z plane. */
import type { ViewModel } from "../game/viewTypes";
import type { GameShell, ModalInstance } from "./types";
import { append, clear, el } from "./dom";
import { icon } from "./icons";
import { coordText, projectXZ, readPlanetCoords, readStarCoords } from "./coords";
import { au, pct } from "./format";
import { section } from "./widgets";

const MAP_W = 640;
const MAP_H = 360;
const NS = "http://www.w3.org/2000/svg";

interface MapPoint {
  kind: "star" | "planet";
  name: string;
  color: string;
  x: number;
  z: number;
  sigma: number | null;
  confidence: number;
  coords: { x: number | null; y: number | null; z: number | null };
  distance: number | null;
}

export function buildMapModal(shell: GameShell, _close: () => void): ModalInstance {
  const root = el("div", { cls: "tri-map-modal" });

  const mapSection = section("星系相对位置", { icon: "map", hint: "X-Z 俯视投影" });
  const stage = el("div", { cls: "tri-map-stage" });
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + MAP_W + " " + MAP_H);
  svg.setAttribute("class", "tri-map-svg");
  stage.appendChild(svg);
  const stageEmpty = el("div", { cls: "tri-map-empty tri-hidden" });
  stageEmpty.appendChild(icon("eye", 18));
  stageEmpty.appendChild(el("span", { text: "尚未获得恒星位置观测，无法绘制星系地图" }));
  stage.appendChild(stageEmpty);
  const legend = el("div", { cls: "tri-map-legend" });
  append(
    legend,
    legendItem("#ff6b4a", "恒星（已测位置）"),
    legendItem("#6fdcff", "母星"),
    legendItem("#b48cff", "位置不确定范围"),
    legendItem("#3fd0ff", "参考网格"),
  );
  mapSection.body.append(stage, legend);
  root.appendChild(mapSection.el);

  const coordSection = section("坐标读数", { icon: "target", hint: "X 水平 / Y 高度 / Z 深度（AU）" });
  const table = el("div", { cls: "tri-map-table" });
  coordSection.body.appendChild(table);
  root.appendChild(coordSection.el);

  const actions = el("div", { cls: "tri-map-actions" });
  const resetBtn = el("button", { cls: "tri-btn tri-btn-ghost tri-btn-sm", attrs: { type: "button" } });
  resetBtn.appendChild(icon("reset", 14));
  resetBtn.appendChild(el("span", { cls: "tri-btn-label", text: "复位 2D 视图" }));
  resetBtn.addEventListener("click", () => shell.renderer()?.resetView());
  const hint = el("span", { cls: "tri-hint", text: "地图只使用玩家已观测的位置数据；未观测天体不会出现在图上。" });
  append(actions, resetBtn, hint);
  root.appendChild(actions);

  let view: ViewModel | null = shell.view();
  if (view) render(view);

  function render(next: ViewModel): void {
    view = next;
    clear(svg);
    clear(table);
    const observation = next.observation;
    const points: MapPoint[] = [];
    for (const star of observation.stars) {
      if (!star.known.position) continue;
      const coords = readStarCoords(star);
      const flat = projectXZ(coords);
      if (!flat) continue;
      points.push({
        kind: "star",
        name: star.name + " (" + star.id + ")",
        color: star.color || "#ff6b4a",
        x: flat.x,
        z: flat.z,
        sigma: star.sigmaPos,
        confidence: star.confidence,
        coords,
        distance: star.distance,
      });
    }
    if (observation.planet) {
      const coords = readPlanetCoords(observation.planet);
      const flat = projectXZ(coords);
      if (flat) {
        points.push({
          kind: "planet",
          name: "母星",
          color: "#6fdcff",
          x: flat.x,
          z: flat.z,
          sigma: observation.planet.sigmaPos,
          confidence: observation.planet.confidence,
          coords,
          distance: observation.planet.distanceFromPrimary,
        });
      }
    }
    stageEmpty.classList.toggle("tri-hidden", points.length > 0);
    if (points.length === 0) return;

    let maxRadius = 0.5;
    for (const point of points) maxRadius = Math.max(maxRadius, Math.hypot(point.x, point.z));
    const half = Math.min(MAP_W, MAP_H) / 2 - 34;
    const scale = half / maxRadius;
    const cx = MAP_W / 2;
    const cy = MAP_H / 2;
    const toPx = (x: number, z: number): [number, number] => [cx + x * scale, cy + z * scale];

    for (let i = 1; i <= 4; i += 1) {
      const circle = svgNode("circle", {
        cx: cx,
        cy: cy,
        r: (half * i) / 4,
        class: "tri-map-ring",
      });
      svg.appendChild(circle);
    }
    svg.appendChild(svgNode("line", { x1: 20, y1: cy, x2: MAP_W - 20, y2: cy, class: "tri-map-axis", "data-axis": "x" }));
    svg.appendChild(svgNode("line", { x1: cx, y1: 14, x2: cx, y2: MAP_H - 14, class: "tri-map-axis", "data-axis": "z" }));
    svg.appendChild(textEl(cx + 6, 20, "Z+", "tri-map-axis-label"));
    svg.appendChild(textEl(MAP_W - 26, cy - 6, "X+", "tri-map-axis-label"));

    for (const point of points) {
      const [px, py] = toPx(point.x, point.z);
      if (point.sigma != null && point.sigma > 0.01) {
        svg.appendChild(
          svgNode("circle", {
            cx: px,
            cy: py,
            r: Math.max(6, point.sigma * scale),
            class: "tri-map-sigma",
            stroke: point.color,
          }),
        );
      }
      svg.appendChild(
        svgNode("circle", {
          cx: px,
          cy: py,
          r: point.kind === "planet" ? 10 : 13,
          fill: point.color,
          opacity: 0.16,
        }),
      );
      svg.appendChild(
        svgNode("circle", {
          cx: px,
          cy: py,
          r: point.kind === "planet" ? 3.4 : 5,
          fill: point.color,
        }),
      );
      const label = textEl(px + 9, py - 7, point.name, "tri-map-label");
      label.setAttribute("fill", point.color);
      svg.appendChild(label);
      svg.appendChild(
        textEl(
          px + 9,
          py + 7,
          "X " + coordText(point.coords.x) + " · Y " + coordText(point.coords.y) + " · Z " + coordText(point.coords.z),
          "tri-map-sublabel",
        ),
      );
    }
    svg.appendChild(textEl(14, MAP_H - 12, "比例尺：1 格 ≈ " + (maxRadius / 4).toFixed(2) + " AU", "tri-map-scale"));

    for (const point of points) {
      const row = el("div", { cls: "tri-map-table-row", attrs: { "data-kind": point.kind } });
      const name = el("span", { cls: "tri-map-table-name" });
      const dotEl = el("i", { cls: "tri-dot" });
      dotEl.style.background = point.color;
      name.append(dotEl, el("span", { text: point.name }));
      row.appendChild(name);
      append(
        row,
        mapCell("X 水平", coordText(point.coords.x)),
        mapCell("Y 高度", coordText(point.coords.y)),
        mapCell("Z 深度", coordText(point.coords.z)),
        mapCell("置信度", pct(point.confidence, 0)),
        mapCell(point.kind === "planet" ? "距主星" : "距质心", point.distance == null ? "— 未观测" : au(point.distance)),
      );
      table.appendChild(row);
    }
  }

  return {
    el: root,
    update: render,
    destroy() {
      /* listeners live on the subtree */
    },
  };

  function mapCell(label: string, value: string): HTMLElement {
    const cell = el("div", { cls: "tri-map-table-cell" });
    cell.appendChild(el("span", { cls: "tri-map-cell-label", text: label }));
    cell.appendChild(el("span", { cls: "tri-map-cell-value", text: value }));
    return cell;
  }

  function legendItem(color: string, label: string): HTMLElement {
    const item = el("span", { cls: "tri-legend-item" });
    const swatch = el("i", { cls: "tri-legend-swatch tri-legend-dot" });
    swatch.style.background = color;
    item.append(swatch, el("span", { text: label }));
    return item;
  }
}

function svgNode(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node as SVGElement;
}

function textEl(x: number, y: number, content: string, cls: string): SVGTextElement {
  const node = document.createElementNS(NS, "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("class", cls);
  node.textContent = content;
  return node;
}
