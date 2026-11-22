/** Center overlay: reticle frame, legend, view-mode / zoom controls and selection card. */
import type { RenderScene, ViewModel } from "../game/viewTypes";
import type { GameShell } from "./types";
import { append, clear, el, on, setClass, setText } from "./dom";
import { icon } from "./icons";
import { au, clamp01, num, pct, temp } from "./format";
import { bearingRing, curvedScale } from "./curves";
import type { BearingRingHandle, BearingRingMarker, CurvedScaleHandle } from "./curves";

export interface CenterOverlayHandle {
  el: HTMLElement;
  update(view: ViewModel, scene: RenderScene | null): void;
  destroy(): void;
}

export function createCenterOverlay(shell: GameShell): CenterOverlayHandle {
  const root = el("div", { cls: "tri-center" });
  const subscriptions: (() => void)[] = [];

  /* reticle + corner frame (decorative, pointer-events: none) ------------- */
  const reticle = el("div", { cls: "tri-center-reticle", attrs: { "aria-hidden": "true" } });
  reticle.appendChild(el("span", { cls: "tri-reticle-ring tri-reticle-ring-1" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-ring tri-reticle-ring-2" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-ring tri-reticle-ring-3" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-tick tri-reticle-tick-n" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-tick tri-reticle-tick-e" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-tick tri-reticle-tick-s" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-tick tri-reticle-tick-w" }));
  reticle.appendChild(el("span", { cls: "tri-reticle-cross" }));
  const frame = el("div", { cls: "tri-center-frame", attrs: { "aria-hidden": "true" } });
  append(
    frame,
    el("span", { cls: "tri-frame-corner is-tl" }),
    el("span", { cls: "tri-frame-corner is-tr" }),
    el("span", { cls: "tri-frame-corner is-bl" }),
    el("span", { cls: "tri-frame-corner is-br" }),
  );

  /* v1.4：视口外圈方位刻度弧 + 内圈观测置信弧（同心结构，数据绑定方位/置信度） */
  const bearingLayer = el("div", { cls: "tri-curve-bearings", attrs: { "aria-hidden": "true" } });
  const bearings: BearingRingHandle = bearingRing({ className: "tri-curve-bearing-svg" });
  bearingLayer.appendChild(bearings.el);
  const bearingReadout = el("div", { cls: "tri-bearing-readout", text: "方位刻度 · 待观测" });

  /* printed plate caption + field scale (dark plate over the observation image) */
  const plate = el("div", { cls: "tri-obs-plate" });
  const plateKicker = el("span", { cls: "tri-obs-plate-kicker", text: "// OPTICAL PLATE 01 · TRISOLARIS SYSTEM" });
  const plateMode = el("span", { cls: "tri-obs-plate-mode", text: "LIVE · 2D" });
  append(plate, plateKicker, plateMode);
  const scale = el("div", { cls: "tri-obs-scale" });
  const scaleText = el("span", { cls: "tri-obs-scale-text", text: "视场 — AU" });
  /* v1.4：直线比例尺 → 曲线刻度尺（刻度 = 天文台等级，末端标尺仍显示 AU 视场） */
  const scaleCurve: CurvedScaleHandle = curvedScale({ width: 132, height: 22, ticks: 10, className: "tri-obs-scale-arc" });
  const scaleMeta = el("span", { cls: "tri-obs-scale-meta", text: "天文台 —" });
  append(scale, scaleCurve.el, scaleText, scaleMeta);

  /* legend ------------------------------------------------------------- */
  const legend = el("div", { cls: "tri-legend" });
  const legendHead = el("div", { cls: "tri-legend-head" });
  legendHead.appendChild(icon("eye", 14));
  legendHead.appendChild(el("span", { text: "观测图例" }));
  legendHead.appendChild(el("span", { cls: "tri-legend-head-line" }));
  legend.appendChild(legendHead);
  const trailItem = legendItem("solid", "#37e5ff", "实线 · 已观测轨迹");
  const predictionItem = legendItem("dashed", "#ffc857", "虚线 · 预测轨迹");
  const uncertaintyItem = legendItem("band", "#b48cff", "半透明带 · 不确定范围");
  const starItem = legendItem("dot", "#ff6b4a", "亮点 · 恒星");
  const planetItem = legendItem("dot", "#6fdcff", "蓝点 · 母星");
  append(legend, trailItem, predictionItem, uncertaintyItem, starItem, planetItem);
  const legend3dNote = el("div", {
    cls: "tri-legend-note tri-hidden",
    text: "3D 视图：Y 轴为真实高度坐标；与 2D 视图共享同一物理状态",
  });
  legend.appendChild(legend3dNote);
  const legendFoot = el("div", { cls: "tri-legend-foot", text: "点击天体可选中 · 滚轮缩放 · 拖动平移" });
  legend.appendChild(legendFoot);

  /* view mode + zoom --------------------------------------------------- */
  const viewModeSwitch = el("div", { cls: "tri-viewmode", attrs: { role: "group", "aria-label": "视图模式" } });
  const mode2d = modeButton("2D", "2D 星系视图 · X-Z 俯视投影");
  const mode3d = modeButton("3D", "3D 空间视图 · 观察高度 Y 分布");
  append(viewModeSwitch, mode2d, mode3d);
  const zoom = el("div", { cls: "tri-zoom" });
  const zoomIn = iconBtn("zoomIn", "放大");
  const zoomOut = iconBtn("zoomOut", "缩小");
  const reset = iconBtn("reset", "复位视角");
  append(zoom, zoomIn, zoomOut, reset);
  const controls3d = el("div", { cls: "tri-3d-controls tri-hidden" });
  const presetTop = presetButton("俯视", "top");
  const presetSide = presetButton("侧视", "side");
  const presetFree = presetButton("自由", "free");
  const reset3d = presetButton("复位", "reset");
  append(controls3d, presetTop, presetSide, presetFree, reset3d);
  /* v1.4：移动端图例折叠开关（桌面通过 CSS 隐藏） */
  const legendToggle = el("button", {
    cls: "tri-btn tri-btn-icon tri-legend-toggle",
    attrs: { type: "button", title: "显示/隐藏观测图例", "aria-label": "显示/隐藏观测图例" },
  });
  legendToggle.appendChild(icon("eye", 16));
  const rightStack = el("div", { cls: "tri-center-right" });
  append(rightStack, legendToggle, viewModeSwitch, zoom, controls3d);

  /* status + warning --------------------------------------------------- */
  const bottom = el("div", { cls: "tri-center-bottom" });
  const warning = el("div", { cls: "tri-obs-warning tri-hidden" });
  warning.appendChild(icon("alert", 15));
  const warningText = el("span", { text: "" });
  warning.appendChild(warningText);
  const status = el("div", { cls: "tri-scene-status" });
  status.appendChild(icon("target", 14));
  const statusText = el("span", { text: "—" });
  status.appendChild(statusText);
  append(bottom, warning, status);

  /* selection data card (corner-cut, bottom-left) ---------------------- */
  const selection = el("div", { cls: "tri-selection-card tri-hidden" });
  const selHead = el("div", { cls: "tri-selection-head" });
  const selKicker = el("span", { cls: "tri-selection-kicker", text: "SELECTED" });
  const selName = el("span", { cls: "tri-selection-name", text: "—" });
  const selClose = el("button", { cls: "tri-selection-close", attrs: { type: "button", title: "取消选择" } });
  selClose.appendChild(icon("close", 12));
  append(selHead, selKicker, selName, selClose);
  const selGrid = el("div", { cls: "tri-selection-grid" });
  const selFields: { label: string; value: HTMLElement }[] = [];
  for (const label of ["置信度", "距离", "速度", "高度 Y"]) {
    const cell = el("div", { cls: "tri-selection-cell" });
    cell.appendChild(el("span", { cls: "tri-selection-label", text: label }));
    const value = el("span", { cls: "tri-selection-value", text: "—" });
    cell.appendChild(value);
    selGrid.appendChild(cell);
    selFields.push({ label, value });
  }
  append(selection, selHead, selGrid);
  const selHint = el("div", { cls: "tri-selection-hint", text: "按 F 聚焦 · 点击空白处取消" });
  selection.appendChild(selHint);
  selClose.addEventListener("click", () => shell.api()?.actions.select(null));

  append(root, reticle, frame, bearingLayer, plate, scale, legend, rightStack, selection, bottom, bearingReadout);

  subscriptions.push(on(zoomIn, "click", () => shell.renderer()?.zoomBy(1.25)));
  subscriptions.push(on(zoomOut, "click", () => shell.renderer()?.zoomBy(0.8)));
  subscriptions.push(on(reset, "click", () => shell.renderer()?.resetView()));
  subscriptions.push(on(mode2d, "click", () => shell.setViewMode("2d")));
  subscriptions.push(on(mode3d, "click", () => shell.setViewMode("3d")));
  subscriptions.push(on(presetTop, "click", () => shell.renderer3d()?.setViewPreset("top")));
  subscriptions.push(on(presetSide, "click", () => shell.renderer3d()?.setViewPreset("side")));
  subscriptions.push(on(presetFree, "click", () => shell.renderer3d()?.setViewPreset("free")));
  subscriptions.push(on(reset3d, "click", () => shell.renderer3d()?.resetView()));
  subscriptions.push(
    on(legendToggle, "click", () => {
      const open = root.classList.toggle("is-legend-open");
      legendToggle.classList.toggle("is-active", open);
      legendToggle.setAttribute("aria-pressed", open ? "true" : "false");
    }),
  );
  /* v1.4：容器尺寸变化（移动端旋转 / 抽屉打开）时重建同心刻度弧 */
  let bearingObserver: ResizeObserver | null = null;
  const syncBearing = (): void => {
    const width = bearingLayer.clientWidth;
    const height = bearingLayer.clientHeight;
    if (width > 0 && height > 0) bearings.resize(width, height);
  };
  if (typeof ResizeObserver !== "undefined") {
    bearingObserver = new ResizeObserver(() => syncBearing());
    bearingObserver.observe(bearingLayer);
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", syncBearing);
    subscriptions.push(() => window.removeEventListener("resize", syncBearing));
  }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(syncBearing);
  else setTimeout(syncBearing, 0);

  return {
    el: root,
    update(view, scene) {
      const settings = view.settings;
      const mode = shell.viewMode();
      const is3d = mode === "3d";
      const busy = shell.viewModeBusy();
      setClass(mode2d, "is-active", !is3d);
      setClass(mode3d, "is-active", is3d);
      mode2d.disabled = busy;
      mode3d.disabled = busy;
      setText(mode3d, busy ? "3D…" : "3D");
      setText(mode2d, busy ? "2D…" : "2D");
      setClass(legend, "is-3d", is3d);
      setText(plateMode, busy ? "LOADING" : is3d ? "LIVE · 3D" : "LIVE · 2D");
      if (scene && Number.isFinite(scene.recommendedRadiusAU)) {
        setText(scaleText, "视场半径约 " + num(scene.recommendedRadiusAU, 1) + " AU");
      } else {
        setText(scaleText, "视场半径随观测数据更新");
      }
      /* 曲线视场刻度：刻度 = 天文台等级进度（Lv0–Lv5），与直线比例尺互补 */
      const obsLevel = view.observatory.level;
      const obsMax = Math.max(1, view.observatory.maxLevel);
      scaleCurve.update(clamp01(obsLevel / obsMax), { label: "天文台等级进度 " + obsLevel + "/" + obsMax });
      setText(scaleMeta, "天文台 Lv." + obsLevel + " · 能力 " + view.observatory.capabilities.length + " 项");
      setClass(zoom, "tri-hidden", is3d);
      setClass(controls3d, "tri-hidden", !is3d);
      setClass(root, "is-3d", is3d);
      legend3dNote.classList.toggle("tri-hidden", !is3d);
      setText(
        legendFoot,
        is3d
          ? "拖动旋转 · 滚轮缩放 · 点击天体选中 · 使用俯视/侧视/自由预设"
          : "点击天体可选中 · 滚轮缩放 · 拖动平移",
      );
      setClass(trailItem, "is-off", !settings.showTrails);
      setClass(predictionItem, "is-off", !settings.showPrediction);
      setClass(uncertaintyItem, "is-off", !settings.showUncertainty);
      setClass(starItem, "is-off", !settings.showLabels);
      setClass(planetItem, "is-off", !settings.showLabels);

      const level = view.observatory.level;
      const capabilities = view.observatory.capabilities.length;
      if (level <= 1) {
        warning.classList.remove("tri-hidden");
        warning.dataset.severity = level === 0 ? "danger" : "warn";
        warningText.textContent =
          level === 0
            ? "无观测设施：无法执行系统性天文观测，右侧「观测」页任务不可用。先建造观测站。"
            : "低等级天文台：观测精度有限，无法测定速度与轨道，预测可靠年限很短。考虑升级天文台。";
      } else {
        warning.classList.add("tri-hidden");
      }
      setText(
        statusText,
        (scene?.statusLabel ?? "观测通道待命") +
          " · 天文台 Lv." + level +
          " · 能力 " + capabilities + " 项 · 数据点 " + (view.observation.dataPoints ?? 0),
      );

      updateBearing(view);
      updateSelection(view);
    },
    destroy() {
      bearingObserver?.disconnect();
      bearings.destroy();
      for (const off of subscriptions.splice(0)) off();
    },
  };

  /**
   * 外圈刻度弧数据：
   *  - 方位角按「系统质心（世界原点）→ 天体」在 X-Z 平面的夹角计算（北=+Z，东=+X），
   *    与 2D 渲染器的 X/Z 投影同向；相机平移后刻度代表的是系统绝对方位；
   *  - 未测定位置的天体只保留刻度，不画标记；
   *  - 内圈置信弧 = 三颗恒星的平均观测置信度（未定位按 0 计）。
   */
  function updateBearing(view: ViewModel): void {
    const markers: BearingRingMarker[] = [];
    const bodies = view.observation.stars.length + (view.observation.planet ? 1 : 0);
    let knownCount = 0;
    let confidenceSum = 0;
    for (const star of view.observation.stars) {
      if (star.known.position) knownCount += 1;
      confidenceSum += star.known.position ? star.confidence : 0;
      const bearing = bearingOf(star.pos);
      if (bearing == null) continue;
      markers.push({ bearing, label: star.id, known: star.known.position, selected: view.selection === star.id });
    }
    const planet = view.observation.planet;
    if (planet) {
      const bearing = bearingOf(planet.pos);
      if (bearing != null) {
        markers.push({ bearing, label: "母", known: planet.known.distance, selected: view.selection === "planet" });
      }
    }
    const confidence = view.observation.stars.length > 0 ? confidenceSum / view.observation.stars.length : 0;
    bearings.update(markers, {
      confidence,
      caption: "OBS CONF " + pct(confidence, 0) + " · 数据点 " + view.observation.dataPoints,
    });
    const parts: string[] = [];
    for (const marker of markers) {
      parts.push(marker.label + " " + String(Math.round(((marker.bearing % 360) + 360) % 360)).padStart(3, "0") + "°");
    }
    setText(
      bearingReadout,
      "方位刻度 · 已定位 " + knownCount + "/" + Math.max(1, bodies) + (parts.length > 0 ? " · " + parts.join(" / ") : " · 尚无位置数据"),
    );
  }

  function updateSelection(view: ViewModel): void {
    const selected = view.selection;
    if (selected == null) {
      selection.classList.add("tri-hidden");
      return;
    }
    selection.classList.remove("tri-hidden");
    if (selected === "planet") {
      const planet = view.observation.planet;
      setText(selKicker, "PLANET / 母星");
      setText(selName, "母星");
      const fields = selFields;
      setText(fields[0].value, planet ? pct(planet.confidence, 0) : "— 未观测");
      setText(fields[1].value, planet?.distanceFromPrimary == null ? "— 未观测" : au(planet.distanceFromPrimary));
      setText(fields[2].value, planet?.tempC == null ? "— 未观测" : temp(planet.tempC));
      setText(fields[3].value, planet ? num(planet.height, 3) + " AU" : "— 未观测");
      fields[0].value.dataset.tone = planet && planet.confidence > 0.6 ? "ok" : "warn";
      return;
    }
    const star = view.observation.stars.find((candidate) => candidate.id === selected);
    setText(selKicker, "STAR / 恒星 " + selected);
    setText(selName, star ? star.name : String(selected));
    const fields = selFields;
    setText(fields[0].value, star ? pct(star.confidence, 0) : "— 未观测");
    setText(fields[1].value, !star || star.distance == null ? "— 未观测" : au(star.distance));
    setText(fields[2].value, !star || star.speed == null ? "— 未观测" : num(star.speed, 2) + " AU/年");
    setText(fields[3].value, !star || !star.known.position ? "— 未观测" : num(star.height, 3) + " AU");
    fields[0].value.dataset.tone = star && star.confidence > 0.6 ? "ok" : "warn";
  }

  function iconBtn(iconName: string, title: string): HTMLButtonElement {
    const node = el("button", { cls: "tri-btn tri-btn-icon tri-zoom-btn", attrs: { type: "button", title, "aria-label": title } });
    node.appendChild(icon(iconName, 16));
    return node;
  }

  function modeButton(label: string, title: string): HTMLButtonElement {
    return el("button", { cls: "tri-viewmode-btn", text: label, attrs: { type: "button", title, "aria-label": title } });
  }

  function presetButton(label: string, preset: "top" | "side" | "free" | "reset"): HTMLButtonElement {
    const title =
      preset === "reset"
        ? "复位 3D 视角"
        : "3D 视角预设：" + (preset === "top" ? "俯视（X-Z 平面）" : preset === "side" ? "侧视（观察 Y 高度）" : "自由视角");
    return el("button", {
      cls: "tri-3d-btn",
      text: label,
      attrs: { type: "button", title, "aria-label": title, "data-preset": preset },
    });
  }

  function legendItem(kind: "solid" | "dashed" | "band" | "dot", color: string, label: string): HTMLElement {
    const node = el("div", { cls: "tri-legend-item" });
    const swatch = el("i", { cls: "tri-legend-swatch tri-legend-" + kind });
    if (kind === "band") {
      swatch.style.background = color;
      swatch.style.opacity = "0.28";
    } else {
      swatch.style.background = color;
    }
    node.appendChild(swatch);
    node.appendChild(el("span", { text: label }));
    return node;
  }
}

/** 系统质心方位角（0°=+Z 北，90°=+X 东，与 2D 投影一致）。 */
function bearingOf(pos: { x: number; z?: number } | null | undefined): number | null {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z ?? 0)) return null;
  return (Math.atan2(pos.x, pos.z ?? 0) * 180) / Math.PI;
}
