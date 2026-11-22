/** New game setup: seed, difficulty, mode, live galaxy preview and start. */
import { DIFFICULTIES } from "../core/constants";
import type { DifficultyKey } from "../core/types";
import type { AppController } from "../game/viewTypes";
import type { ScreenHandle, UiContext } from "./types";
import { GAME_MODE_INFO } from "./types";
import { append, clear, debounce, el, on, q, qa, rafLoop, setText } from "./dom";
import { icon } from "./icons";
import { createStarfield } from "./starfield";
import { meterBar, statTile } from "./charts";
import { au, int, num, pct, temp } from "./format";
import type { MeterHandle, StatTileHandle } from "./charts";
import { eraRail } from "./era-ui";

type GalaxyPreview = Awaited<ReturnType<AppController["previewGalaxy"]>>;
type NewGameOptions = Parameters<AppController["createNewGame"]>[0];
type GameMode = NewGameOptions["mode"];

const SEED_MAX_LENGTH = 64;

export function createNewGameScreen(ctx: UiContext): ScreenHandle {
  const root = el("div", { cls: "tri-screen tri-newgame" });
  root.appendChild(el("div", { cls: "tri-menu-fallback tri-newgame-fallback" }));
  const starCanvas = el("canvas", { cls: "tri-newgame-stars", attrs: { "aria-hidden": "true" } });
  root.appendChild(starCanvas);
  root.appendChild(el("div", { cls: "tri-vignette" }));
  root.appendChild(el("div", { cls: "tri-scanlines", attrs: { "aria-hidden": "true" } }));
  const frame = el("div", { cls: "tri-newgame-frame", attrs: { "aria-hidden": "true" } });
  append(
    frame,
    el("span", { cls: "tri-frame-corner is-tl" }),
    el("span", { cls: "tri-frame-corner is-tr" }),
    el("span", { cls: "tri-frame-corner is-bl" }),
    el("span", { cls: "tri-frame-corner is-br" }),
  );
  root.appendChild(frame);

  let preview: GalaxyPreview | null = null;
  let previewState: "idle" | "loading" | "ready" | "error" = "idle";
  let previewError = "";
  let requestToken = 0;
  let starting = false;
  let destroyed = false;

  /* ------------------------------- header ------------------------------ */
  const inner = el("div", { cls: "tri-newgame-inner" });
  const head = el("header", { cls: "tri-newgame-head" });
  const backBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button" } });
  backBtn.appendChild(icon("chevronLeft", 16));
  backBtn.appendChild(el("span", { cls: "tri-btn-label", text: "返回主菜单" }));
  const heading = el("div", { cls: "tri-newgame-heading" });
  heading.appendChild(el("span", { cls: "tri-kicker", text: "NEW CYCLE INITIALIZATION" }));
  heading.appendChild(el("h1", { text: "新纪元初始化" }));
  heading.appendChild(el("p", { cls: "tri-newgame-sub", text: "输入种子，选择文明将要面对的宇宙参数。预览由物理核心实时筛选生成。" }));
  const steps = el("div", { cls: "tri-newgame-steps" });
  append(steps, stepChip("01", "星系种子"), stepChip("02", "难度"), stepChip("03", "模式"));
  append(head, backBtn, heading, steps);

  /* -------------------------------- form ------------------------------- */
  const form = el("section", { cls: "tri-newgame-form" });

  const seedBlock = el("div", { cls: "tri-block" });
  const seedHead = el("div", { cls: "tri-block-head" });
  seedHead.appendChild(el("h2", { text: "星系种子" }));
  seedHead.appendChild(el("span", { cls: "tri-hint", text: "决定三颗恒星的质量、初始轨道与混沌程度" }));
  const seedRow = el("div", { cls: "tri-seed-row" });
  const seedInput = el("input", {
    cls: "tri-input",
    attrs: {
      type: "text",
      maxlength: String(SEED_MAX_LENGTH),
      placeholder: "例如：trisolaris-2187",
      spellcheck: "false",
      autocomplete: "off",
      "aria-label": "星系种子",
    },
  });
  seedInput.value = ctx.state.newSeed;
  const randBtn = el("button", { cls: "tri-btn tri-btn-ghost", attrs: { type: "button", title: "生成随机种子" } });
  randBtn.appendChild(icon("dice", 16));
  randBtn.appendChild(el("span", { cls: "tri-btn-label", text: "随机" }));
  append(seedRow, seedInput, randBtn);
  const seedMeta = el("div", { cls: "tri-seed-meta" });
  append(seedBlock, seedHead, seedRow, seedMeta);

  const difficultyBlock = el("div", { cls: "tri-block" });
  const diffHead = el("div", { cls: "tri-block-head" });
  diffHead.appendChild(el("h2", { text: "难度" }));
  diffHead.appendChild(el("span", { cls: "tri-hint", text: "影响星系稳定性筛选、灾害强度与起始补给" }));
  const diffGrid = el("div", { cls: "tri-choice-grid tri-choice-grid-4" });
  const diffCards = new Map<DifficultyKey, HTMLButtonElement>();
  for (const key of Object.keys(DIFFICULTIES) as DifficultyKey[]) {
    const preset = DIFFICULTIES[key];
    const card = el("button", { cls: "tri-choice-card", attrs: { type: "button", "aria-pressed": "false", "data-difficulty": key } });
    const top = el("div", { cls: "tri-choice-top" });
    top.appendChild(el("span", { cls: "tri-choice-name", text: preset.name }));
    top.appendChild(el("span", { cls: "tri-choice-key", text: key.toUpperCase() }));
    card.appendChild(top);
    card.appendChild(el("p", { cls: "tri-choice-desc", text: preset.description }));
    const stats = el("div", { cls: "tri-choice-stats" });
    append(
      stats,
      el("span", { text: "稳定窗口 ≥ " + int(preset.minSurvivalYears) + " 年" }),
      el("span", { text: "灾害 ×" + preset.hazardMultiplier.toFixed(2) }),
      el("span", { text: "食物 " + int(preset.startingFood) }),
      el("span", { text: "能源 " + int(preset.startingEnergy) }),
    );
    card.appendChild(stats);
    card.addEventListener("click", () => selectDifficulty(key));
    diffCards.set(key, card);
    diffGrid.appendChild(card);
  }
  append(difficultyBlock, diffHead, diffGrid);

  const modeBlock = el("div", { cls: "tri-block" });
  const modeHead = el("div", { cls: "tri-block-head" });
  modeHead.appendChild(el("h2", { text: "模式" }));
  modeHead.appendChild(el("span", { cls: "tri-hint", text: "剧情节奏与失败条件的组合" }));
  const modeGrid = el("div", { cls: "tri-choice-grid tri-choice-grid-4" });
  const modeCards = new Map<GameMode, HTMLButtonElement>();
  for (const mode of Object.keys(GAME_MODE_INFO) as GameMode[]) {
    const info = GAME_MODE_INFO[mode];
    const card = el("button", { cls: "tri-choice-card tri-choice-card-mode", attrs: { type: "button", "aria-pressed": "false", "data-mode": mode } });
    const top = el("div", { cls: "tri-choice-top" });
    top.appendChild(icon(info.icon, 16));
    top.appendChild(el("span", { cls: "tri-choice-name", text: info.name }));
    card.appendChild(top);
    card.appendChild(el("p", { cls: "tri-choice-desc", text: info.description }));
    card.addEventListener("click", () => selectMode(mode));
    modeCards.set(mode, card);
    modeGrid.appendChild(card);
  }
  append(modeBlock, modeHead, modeGrid);
  append(form, seedBlock, difficultyBlock, modeBlock);

  /* ------------------------------ preview ------------------------------ */
  const previewCol = el("section", { cls: "tri-newgame-preview" });
  const previewHead = el("div", { cls: "tri-preview-head" });
  previewHead.appendChild(el("h2", { text: "星系预览" }));
  const previewStatus = el("span", { cls: "tri-preview-status", text: "等待参数…" });
  previewHead.appendChild(previewStatus);
  const stage = el("div", { cls: "tri-preview-stage" });
  const previewCanvas = el("canvas", { cls: "tri-preview-canvas", attrs: { "aria-label": "星系预览画布" } });
  const stageOverlay = el("div", { cls: "tri-preview-overlay" });
  const overlayText = el("div", { cls: "tri-preview-overlay-text", text: "正在生成星系预览…" });
  stageOverlay.appendChild(overlayText);
  stage.appendChild(previewCanvas);
  stage.appendChild(stageOverlay);
  const stageLegend = el("div", { cls: "tri-preview-legend" });
  append(
    stageLegend,
    legendItem("#3fd0ff", "恒星轨迹"),
    legendItem("#ffc857", "行星"),
    legendItem("#4ef2b0", "可居住带"),
  );
  stage.appendChild(stageLegend);

  const classification = el("div", { cls: "tri-preview-classification" });
  const classHead = el("div", { cls: "tri-class-head" });
  const classIconWrap = el("div", { cls: "tri-class-icon" });
  classIconWrap.appendChild(icon("galaxy", 22));
  const classText = el("div", { cls: "tri-class-text" });
  const kindName = el("div", { cls: "tri-class-name", text: "分类评估中" });
  const kindDesc = el("div", { cls: "tri-class-desc", text: "正在根据候选星系指标生成分类…" });
  append(classText, kindName, kindDesc);
  append(classHead, classIconWrap, classText);
  const metricsGrid = el("div", { cls: "tri-class-metrics" });
  const survivalTile = statTile("可存活窗口", "—", "年");
  const chaosTile = statTile("混沌指数", "—", "相对值");
  const ejectionTile = statTile("抛射风险", "—", "归一化");
  const encounterTile = statTile("近距离交会", "—", "次");
  append(metricsGrid, survivalTile.el, chaosTile.el, ejectionTile.el, encounterTile.el);
  const warnList = el("div", { cls: "tri-class-warnings" });
  append(classification, classHead, metricsGrid, warnList);

  const planetCard = el("div", { cls: "tri-preview-planet" });
  const planetHead = el("div", { cls: "tri-preview-planet-head" });
  planetHead.appendChild(icon("planet", 18));
  const planetName = el("span", { cls: "tri-preview-planet-name", text: "母星 —" });
  const planetOrbit = el("span", { cls: "tri-chip", text: "轨道 —" });
  append(planetHead, planetName, planetOrbit);
  const planetStats = el("div", { cls: "tri-preview-planet-stats" });
  const tempTile = statTile("基准温度", "—", "");
  const habitabilityMeter = meterBar("accent");
  const habitabilityRow = el("div", { cls: "tri-preview-meter-row" });
  habitabilityRow.appendChild(el("span", { cls: "tri-meter-label", text: "宜居度" }));
  habitabilityRow.appendChild(habitabilityMeter.el);
  const habitabilityValue = el("span", { cls: "tri-meter-value", text: "—" });
  habitabilityRow.appendChild(habitabilityValue);
  const waterMeter = meterHandleRow("水储量");
  const atmoMeter = meterHandleRow("大气密度");
  append(planetStats, tempTile.el);
  append(planetCard, planetHead, planetStats, habitabilityRow, waterMeter.row, atmoMeter.row);

  const startingEra = el("section", { cls: "tri-starting-era" });
  const startingEraHead = el("div", { cls: "tri-starting-era-head" });
  startingEraHead.appendChild(icon("calendar", 15));
  startingEraHead.appendChild(el("h3", { text: "文明起点 · 原始时代" }));
  startingEraHead.appendChild(el("span", { cls: "tri-starting-era-kicker", text: "FROM E1 // STARGAZERS" }));
  const startingEraDesc = el("p", {
    cls: "tri-starting-era-desc",
    text: "文明从原始部落起步：没有金属、没有电力。先让族人学会耕种与计数，建起观星台，在三个太阳的节律里读出第一条规律，再一步步走进农业城邦、工业、信息与星际时代。",
  });
  const startingEraRail = eraRail({ compact: true, className: "tri-starting-era-rail" });
  startingEraRail.update(1, 0);
  append(startingEra, startingEraHead, startingEraDesc, startingEraRail.el);

  const cta = el("div", { cls: "tri-preview-cta" });
  const startBtn = el("button", { cls: "tri-btn tri-btn-primary tri-btn-lg", attrs: { type: "button", "data-action": "start-game" } });
  startBtn.appendChild(icon("play", 18));
  const startLabel = el("span", { cls: "tri-btn-label", text: "开始新纪元" });
  startBtn.appendChild(startLabel);
  const ctaHint = el("div", { cls: "tri-hint tri-cta-hint", text: "开始后可随时通过底部「存档」面板保存进度。按 Enter 直接开始。" });
  append(cta, startBtn, ctaHint);

  append(previewCol, previewHead, stage, classification, startingEra, planetCard, cta);
  const bodyRow = el("div", { cls: "tri-newgame-body" });
  append(bodyRow, form, previewCol);
  append(inner, head, bodyRow);
  root.appendChild(inner);

  /* ----------------------------- lifecycle ----------------------------- */
  const starfield = createStarfield(starCanvas, { density: 130, seed: 424242, constellationLines: false });
  const subscriptions: (() => void)[] = [];
  subscriptions.push(on(backBtn, "click", () => ctx.setScreen("menu")));
  subscriptions.push(on(randBtn, "click", randomizeSeed));
  subscriptions.push(on(seedInput, "input", () => schedulePreview()));
  subscriptions.push(
    on(seedInput, "keydown", (ev) => {
      const key = (ev as KeyboardEvent).key;
      if (key === "Enter") {
        ev.preventDefault();
        void startNewGame();
      }
    }),
  );
  subscriptions.push(on(startBtn, "click", () => void startNewGame()));

  const schedulePreview = debounce(() => void refreshPreview(), 260);
  const stopPreviewLoop = rafLoop(drawPreviewFrame);

  selectDifficulty(ctx.state.difficulty);
  selectMode(ctx.state.mode);
  updateSeedMeta();
  void refreshPreview();

  const screen: ScreenHandle = {
    el: root,
    destroy() {
      destroyed = true;
      schedulePreview.cancel();
      stopPreviewLoop();
      starfield.destroy();
      for (const off of subscriptions.splice(0)) off();
    },
    onKey(ev) {
      if (ev.key === "Escape") {
        ctx.setScreen("menu");
        return true;
      }
      return false;
    },
  };
  return screen;

  /* ------------------------------- helpers ----------------------------- */
  function stepChip(number: string, label: string): HTMLElement {
    const node = el("span", { cls: "tri-step" });
    node.appendChild(el("b", { text: number }));
    node.appendChild(el("span", { text: label }));
    return node;
  }

  function legendItem(color: string, label: string): HTMLElement {
    const node = el("span", { cls: "tri-legend-item" });
    const line = el("i", { cls: "tri-legend-line" });
    line.style.background = color;
    node.appendChild(line);
    node.appendChild(el("span", { text: label }));
    return node;
  }

  function meterHandleRow(label: string): { row: HTMLElement; meter: MeterHandle; value: HTMLElement } {
    const row = el("div", { cls: "tri-preview-meter-row" });
    row.appendChild(el("span", { cls: "tri-meter-label", text: label }));
    const meter = meterBar("accent");
    row.appendChild(meter.el);
    const value = el("span", { cls: "tri-meter-value", text: "—" });
    row.appendChild(value);
    return { row, meter, value };
  }

  function currentSeed(): string {
    return seedInput.value.trim().slice(0, SEED_MAX_LENGTH);
  }

  function updateSeedMeta(): void {
    const preset = DIFFICULTIES[ctx.state.difficulty];
    clear(seedMeta);
    append(
      seedMeta,
      el("span", { text: "物理预筛选：接受可存活 ≥ " + int(preset.minSurvivalYears) + " 年的候选系统" }),
      el("span", { text: "抛射半径上限 " + preset.maxEjectionRadius.toFixed(1) + " AU" }),
      el("span", { text: "观测噪声 ×" + preset.observationNoise.toFixed(2) }),
      el("span", { text: "候选预算 " + int(preset.candidateBudget) + " 个" }),
    );
  }

  function randomizeSeed(): void {
    seedInput.value = ctx.host.randomSeed();
    ctx.state.newSeed = currentSeed();
    updateSeedMeta();
    schedulePreview.cancel();
    void refreshPreview();
  }

  function selectDifficulty(key: DifficultyKey): void {
    ctx.state.difficulty = key;
    for (const [cardKey, card] of diffCards) {
      const active = cardKey === key;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
    }
    updateSeedMeta();
    schedulePreview();
  }

  function selectMode(mode: GameMode): void {
    ctx.state.mode = mode;
    for (const [cardKey, card] of modeCards) {
      const active = cardKey === mode;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
    }
    schedulePreview();
  }

  async function refreshPreview(): Promise<void> {
    const seed = currentSeed();
    if (!seed) {
      preview = null;
      setPreviewState("error", "请输入星系种子");
      return;
    }
    const token = ++requestToken;
    setPreviewState("loading");
    try {
      const result = await ctx.host.previewGalaxy(seed, ctx.state.difficulty, ctx.state.mode);
      if (destroyed || token !== requestToken) return;
      preview = result;
      renderPreview(result, seed);
      setPreviewState("ready");
    } catch (error) {
      if (destroyed || token !== requestToken) return;
      preview = null;
      setPreviewState("error", messageOf(error));
    }
  }

  function setPreviewState(state: typeof previewState, message?: string): void {
    previewState = state;
    previewError = state === "error" ? message ?? "预览生成失败" : "";
    if (state === "loading") {
      setText(previewStatus, "正在生成…");
      previewStatus.dataset.tone = "warn";
      overlayText.textContent = "正在调用物理核心筛选候选星系…";
      stageOverlay.className = "tri-preview-overlay is-visible";
    } else if (state === "error") {
      setText(previewStatus, "预览不可用");
      previewStatus.dataset.tone = "danger";
      overlayText.textContent = previewError;
      stageOverlay.className = "tri-preview-overlay is-visible is-error";
    } else if (state === "ready") {
      setText(previewStatus, "预览就绪");
      previewStatus.dataset.tone = "ok";
      stageOverlay.className = "tri-preview-overlay";
    } else {
      setText(previewStatus, "等待参数…");
      previewStatus.dataset.tone = "";
      stageOverlay.className = "tri-preview-overlay is-visible";
    }
    updateStartState();
  }

  function updateStartState(): void {
    if (starting) {
      startBtn.disabled = true;
      setText(startLabel, "正在生成星系…");
      return;
    }
    if (previewState === "loading") {
      startBtn.disabled = true;
      startBtn.title = "正在生成星系预览，请稍候";
      setText(startLabel, "预览生成中…");
      return;
    }
    if (previewState === "error" || !preview) {
      startBtn.disabled = true;
      startBtn.title = previewError || "预览尚未就绪";
      setText(startLabel, "开始新纪元");
      return;
    }
    startBtn.disabled = false;
    startBtn.title = "使用当前种子与参数开始游戏";
    setText(startLabel, "开始新纪元 · " + preview.classification.name);
  }

  function renderPreview(result: GalaxyPreview, seed: string): void {
    const classificationData = result.classification;
    setText(kindName, classificationData.name + "星系");
    setText(kindDesc, classificationData.description);
    kindName.dataset.kind = classificationData.kind;
    survivalTile.set("可存活窗口", int(classificationData.survivalYears), "模拟年");
    chaosTile.set("混沌指数", classificationData.chaosIndex.toFixed(2), "0 稳定 — 1 混沌");
    ejectionTile.set("抛射风险", pct(classificationData.ejectionRisk, 1), "归一化");
    encounterTile.set("近距离交会", int(classificationData.closeEncounterCount), "次 / 筛选窗口");
    clear(warnList);
    if (result.warnings.length === 0) {
      warnList.appendChild(el("div", { cls: "tri-class-warning is-ok" }));
      warnList.firstElementChild?.appendChild(icon("check", 14));
      warnList.firstElementChild?.appendChild(el("span", { text: "预筛选未发现明显风险，但混沌系统从不承诺未来。" }));
    } else {
      for (const warning of result.warnings.slice(0, 4)) {
        const row = el("div", { cls: "tri-class-warning" });
        row.appendChild(icon("alert", 14));
        row.appendChild(el("span", { text: warning }));
        warnList.appendChild(row);
      }
    }
    const planet = result.planet;
    setText(planetName, "母星 " + planet.name);
    setText(planetOrbit, "轨道 " + au(planet.orbitRadius));
    tempTile.set("基准温度", temp(planet.initialTempC), "初始平衡态");
    habitabilityMeter.update(planet.habitability, { tone: planet.habitability > 0.55 ? "ok" : planet.habitability > 0.3 ? "warn" : "danger" });
    setText(habitabilityValue, pct(planet.habitability, 0));
    waterMeter.meter.update(planet.water, { tone: planet.water > 0.4 ? "accent" : "warn" });
    setText(waterMeter.value, pct(planet.water, 0));
    atmoMeter.meter.update(Math.min(1, planet.atmosphere), { tone: "accent" });
    setText(atmoMeter.value, pct(Math.min(1, planet.atmosphere), 0));
    seedMeta.dataset.seed = seed;
    updateStartState();
  }

  async function startNewGame(): Promise<void> {
    if (starting) return;
    if (!preview || previewState !== "ready") {
      if (previewState === "error") setText(ctaHint, previewError);
      return;
    }
    const seed = currentSeed();
    if (!seed) {
      setText(ctaHint, "请输入有效种子");
      seedInput.focus();
      return;
    }
    starting = true;
    updateStartState();
    setText(ctaHint, "正在生成星系并初始化文明，这可能需要几秒…");
    const options: NewGameOptions = { seed, difficulty: ctx.state.difficulty, mode: ctx.state.mode };
    try {
      await ctx.host.createNewGame(options);
      if (destroyed) return;
      ctx.notify("新纪元已开始 · 种子 " + seed, "ok");
      ctx.setScreen("game");
    } catch (error) {
      starting = false;
      updateStartState();
      setText(ctaHint, "初始化失败：" + messageOf(error));
      ctx.showError("新纪元初始化失败：" + messageOf(error));
    }
  }

  /* --------------------------- preview canvas -------------------------- */
  function drawPreviewFrame(now: number): void {
    let ctx2d: CanvasRenderingContext2D | null = null;
    try {
      ctx2d = previewCanvas.getContext("2d");
    } catch {
      ctx2d = null;
    }
    if (!ctx2d) return;
    const rect = previewCanvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || 640));
    const cssH = Math.max(1, Math.round(rect.height || 380));
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    if (previewCanvas.width !== Math.round(cssW * dpr) || previewCanvas.height !== Math.round(cssH * dpr)) {
      previewCanvas.width = Math.round(cssW * dpr);
      previewCanvas.height = Math.round(cssH * dpr);
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, cssW, cssH);
    const cx = cssW / 2;
    const cy = cssH / 2;
    const t = now / 1000;

    // Polar reference grid.
    ctx2d.save();
    ctx2d.strokeStyle = "rgba(80, 150, 210, 0.16)";
    ctx2d.lineWidth = 0.7;
    const baseR = Math.min(cssW, cssH) * 0.46;
    for (let i = 1; i <= 4; i += 1) {
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, (baseR * i) / 4, 0, Math.PI * 2);
      ctx2d.stroke();
    }
    ctx2d.beginPath();
    ctx2d.moveTo(cx - baseR, cy);
    ctx2d.lineTo(cx + baseR, cy);
    ctx2d.moveTo(cx, cy - baseR);
    ctx2d.lineTo(cx, cy + baseR);
    ctx2d.globalAlpha = 0.5;
    ctx2d.stroke();
    ctx2d.restore();

    if (!preview) {
      // Ambient dust while waiting for the physics screen.
      const rand = pseudoRandom(Math.floor(t * 0.6));
      for (let i = 0; i < 60; i += 1) {
        const x = rand() * cssW;
        const y = rand() * cssH;
        const alpha = 0.06 + rand() * 0.2;
        ctx2d.fillStyle = "rgba(150, 210, 255, " + alpha.toFixed(3) + ")";
        ctx2d.fillRect(x, y, 1, 1);
      }
      return;
    }

    const planet = preview.planet;
    // The primary view is the X-Z top-down projection of the 3D system.
    let extent = 0.5;
    for (const star of preview.stars) {
      extent = Math.max(extent, Math.hypot(star.pos.x, star.pos.z), Math.hypot(star.vel.x, star.vel.y, star.vel.z) * 0.02);
    }
    extent = Math.max(extent, Math.hypot(planet.pos.x, planet.pos.z));
    const scale = (Math.min(cssW, cssH) * 0.42) / extent;
    const rotation = t * 0.045;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const project = (x: number, z: number): [number, number] => [cx + (x * cos - z * sin) * scale, cy + (x * sin + z * cos) * scale];

    // True trajectories with a flowing highlight dot.
    for (const star of preview.stars) {
      const trail = preview.trajectories[star.id] ?? [];
      if (trail.length > 1) {
        ctx2d.strokeStyle = withAlpha(star.color, 0.34);
        ctx2d.lineWidth = 1.1;
        ctx2d.beginPath();
        for (let i = 0; i < trail.length; i += 1) {
          const point = project(trail[i].x, trail[i].z);
          if (i === 0) ctx2d.moveTo(point[0], point[1]);
          else ctx2d.lineTo(point[0], point[1]);
        }
        ctx2d.stroke();
        const flow = (t * 0.08 + preview.stars.indexOf(star) * 0.27) % 1;
        const index = Math.min(trail.length - 1, Math.floor(flow * (trail.length - 1)));
        const point = project(trail[index].x, trail[index].z);
        ctx2d.fillStyle = star.color;
        ctx2d.beginPath();
        ctx2d.arc(point[0], point[1], 2.6, 0, Math.PI * 2);
        ctx2d.fill();
      }
    }

    // Planet.
    const planetPoint = project(planet.pos.x, planet.pos.z);
    const planetGlow = ctx2d.createRadialGradient(planetPoint[0], planetPoint[1], 0, planetPoint[0], planetPoint[1], 16);
    planetGlow.addColorStop(0, "rgba(120, 220, 255, 0.95)");
    planetGlow.addColorStop(0.45, "rgba(70, 160, 255, 0.4)");
    planetGlow.addColorStop(1, "rgba(70, 160, 255, 0)");
    ctx2d.fillStyle = planetGlow;
    ctx2d.beginPath();
    ctx2d.arc(planetPoint[0], planetPoint[1], 16, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.fillStyle = "#bfe9ff";
    ctx2d.beginPath();
    ctx2d.arc(planetPoint[0], planetPoint[1], 3.4, 0, Math.PI * 2);
    ctx2d.fill();

    // Stars with bloom and labels.
    for (const star of preview.stars) {
      const point = project(star.pos.x, star.pos.z);
      const glowR = Math.max(14, 18 + Math.log10(Math.max(1, star.luminosity)) * 6);
      const glow = ctx2d.createRadialGradient(point[0], point[1], 0, point[0], point[1], glowR);
      glow.addColorStop(0, withAlpha(star.color, 0.95));
      glow.addColorStop(0.3, withAlpha(star.color, 0.45));
      glow.addColorStop(1, withAlpha(star.color, 0));
      ctx2d.fillStyle = glow;
      ctx2d.beginPath();
      ctx2d.arc(point[0], point[1], glowR, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = "#ffffff";
      ctx2d.beginPath();
      ctx2d.arc(point[0], point[1], 2.6, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = withAlpha(star.color, 0.95);
      ctx2d.font = "11px ui-monospace, monospace";
      ctx2d.fillText(star.name, point[0] + 9, point[1] - 7);
      ctx2d.fillStyle = "rgba(170, 205, 230, 0.6)";
      ctx2d.font = "9px ui-monospace, monospace";
      ctx2d.fillText(star.mass.toFixed(2) + " M☉", point[0] + 9, point[1] + 7);
      ctx2d.fillStyle = "rgba(130, 175, 205, 0.5)";
      ctx2d.fillText("高度 Y " + (star.pos.y >= 0 ? "+" : "") + star.pos.y.toFixed(2) + " AU", point[0] + 9, point[1] + 18);
    }

    // Time label.
    ctx2d.fillStyle = "rgba(140, 190, 225, 0.55)";
    ctx2d.font = "10px ui-monospace, monospace";
    ctx2d.fillText(
      "X-Z 俯视投影 · SCREENING " + Math.round(preview.classification.survivalYears) + " YR · " + preview.classification.kind.toUpperCase(),
      12,
      cssH - 12,
    );
  }

  function pseudoRandom(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Parse "#rrggbb" into an rgba() string. */
function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "rgba(140, 200, 255, " + alpha + ")";
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}
