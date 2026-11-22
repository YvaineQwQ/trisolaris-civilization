/**
 * Game orchestrator: fixed-step physics loop + turn-based civilization economy,
 * observation, hazards, victory/defeat and the action API used by the UI.
 *
 * The UI can only reach the game through GameApi (view/scene/scene3d/actions).
 * All simulation state lives in GameState and is fully serializable.
 */
import {
  BASE_YEARS_PER_SECOND, DIFFICULTIES, ERA_MAX, MAX_LOG_ENTRIES, TIME_SPEEDS, TURN_YEARS,
} from "../core/constants";
import { GameLog } from "../core/logger";
import type {
  DepartmentId, GameState, LogEntry, ObservationKind, ResearchCategory, ResourceId, StarId, StarTarget,
  TechSchool,
} from "../core/types";
import { stepPhysics } from "../physics/nbody";
import { updateEnvironment } from "../environment/climate";
import {
  accumulateHazardTick, crisisPenalty, resolveHazardTurn, updateCrises,
} from "../events/hazards";
import {
  cancelObservation, finishTurns, markModelDirty, performNakedEyeCalibration,
  refreshPrediction as refreshObservationPrediction, sampleTick, startObservation,
  syncObservation,
} from "../observation/observation";
import type { ObservationContext } from "../observation/observation";
import { buildTaskOptions, checkUpgrade } from "../observation/observatory";
import { observationContextFor } from "./state";
import {
  applyEraAdvance, buildingEra, canAdvanceEra, eraStatus, getEraDef, migrateLegacyEra, resourceUnlocked,
} from "../civilization/eras";
import { canAfford, spendResources } from "../civilization/state";
import {
  advanceConstruction, aggregateBuildingEffects, checkBuild, constructionSpeed,
  getBuildingCount, startConstruction, startUpgrade, totalMaintenance, totalWorkers,
} from "../buildings/system";
import { BUILDING_DEFS, getBuildingDef } from "../buildings/definitions";
import {
  activeResearchInfo, advanceResearch, aggregateTechEffects, applyResearchBoost, canResearch,
  fundingModifiers, getTechMultipliers, isLegacyTechState, normalizeTechState, researchBoostQuote,
  setDevelopmentCategories, setResearchFunding, setSchoolFocus, startResearch, techDisplayName,
} from "../technology/system";
import { chooseDoctrine as chooseTechDoctrine } from "../technology/system";
import {
  assembleTurnContext, checkDefeat, colonyReport, eraInfo, foundColony,
  planetEngineReady, resolveTurn,
} from "../economy/economy";
import { deleteSaveSlot, exportSaveToFile, listSaveSlots, loadGameFromSlot, persistGame } from "../save/storage";
import { parseGameFile } from "../save/serializer";
import {
  acknowledgeEventOutcome, getActiveEvent, maybeTriggerEvent, resolveEventChoice, updateEventOutcome,
} from "../events";
import {
  appointMinister as appointPoliticsMinister,
  dismissMinister as dismissPoliticsMinister,
  holdSummit as holdPoliticsSummit,
  mediateMinisters as mediatePoliticsMinisters,
  politicsTurn,
} from "../politics";
import type {
  GameActions, GameApi, RenderScene, RenderScene3D, SaveResult, SaveSlotMeta,
  ViewModel, ViewSettings,
} from "./viewTypes";
import { buildViewModel } from "./view";
import { buildRenderScene, buildRenderScene3D } from "./scene";

export interface GameHost {
  /** Called when the player returns to the main menu. */
  onReturnToMenu(): void;
  /** Autosave throttle in real seconds (0 disables). */
  autosaveIntervalSeconds?: number;
}

const DEFAULT_SETTINGS: ViewSettings = {
  showTrails: true,
  showPrediction: true,
  showGrid: true,
  showLabels: true,
  showUncertainty: true,
};

const AUTOSAVE_SLOT = "auto";
const AUTOSAVE_TURN_INTERVAL = 40;

/**
 * Physics work budget per animation frame. Keeps the game responsive even at
 * 32x time compression; leftover simulated time is carried to the next frame.
 */
const MAX_STEPS_PER_FRAME = 1400;

export class Game implements GameApi, GameActions {
  state: GameState;
  log: GameLog;
  readonly settings: ViewSettings;
  selection: StarId | "planet" | null = null;
  private paused = true;
  private speedIndex = 2;
  private yearDebt = 0;
  private obsCtx = observationContextForSafeFallback();
  private lastPredictionYear = -100;
  private lastAutosaveTurn = 0;
  private lastAutosaveReal = 0;
  private startedAt = Date.now();
  private readonly host: GameHost;
  private saveBusy = false;
  /** performance.now() of the last simulation tick (driven by scene()/view() polling). */
  private lastTickAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  private realtimePaused = false;

  constructor(state: GameState, host: GameHost, options?: { startPaused?: boolean }) {
    this.state = state;
    this.host = host;
    this.settings = { ...DEFAULT_SETTINGS };
    this.log = new GameLog(MAX_LOG_ENTRIES);
    this.log.restore(state.log, state.nextLogId);
    this.obsCtx = observationContextFor(state);
    // Fresh games start running so the sky is alive; loaded saves resume paused.
    this.paused = options?.startPaused ?? true;
    this.lastAutosaveReal = Date.now();
  }

  /* ------------------------------------------------------------------ *
   *  SIMULATION LOOP                                                    *
   * ------------------------------------------------------------------ */

  /** Advance the simulation by real elapsed seconds (called from RAF). */
  update(realDtSeconds: number): void {
    this.lastTickAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.state.gameOver) return;
    const dtReal = Math.min(0.06, Math.max(0, realDtSeconds));
    this.state.meta.elapsedRealSeconds += dtReal;
    // 30 秒延迟结算：即使暂停也按真实时间推进，保证报告准时送达。
    const report = updateEventOutcome(this.state.events, this.state.meta.elapsedRealSeconds);
    if (report) {
      this.addLog(
        "event",
        report.effects.some((effect) => effect.tone === "loss") ? "warning" : "success",
        "事件结算报告送达：《" + report.title + "》· " + report.summary,
      );
    }
    if (this.paused) return;
    const speed = TIME_SPEEDS[this.speedIndex] ?? 0;
    if (speed <= 0) return;
    this.yearDebt += dtReal * BASE_YEARS_PER_SECOND * speed;
    const dt = this.state.physics.dtYears;
    let steps = 0;
    while (this.yearDebt >= dt && steps < MAX_STEPS_PER_FRAME) {
      this.stepOnce(dt);
      this.yearDebt -= dt;
      steps += 1;
      if (this.state.gameOver) break;
    }
    if (this.yearDebt > dt * MAX_STEPS_PER_FRAME * 2) this.yearDebt = 0;
  }

  private stepOnce(dt: number): void {
    const s = this.state;
    this.obsCtx.level = s.observation.level;
    this.obsCtx.weather = s.environment.weather;
    this.obsCtx.time = s.physics.timeYears;
    this.obsCtx.turn = s.civ.turn;
    stepPhysics(s.physics);
    updateEnvironment(s.environment, s.physics, dt);
    accumulateHazardTick(s.hazards, s.physics, s.environment);
    sampleTick(s.observation, s.physics, s.environment, dt, this.obsCtx);
    syncObservation(s.observation, s.physics, s.environment, dt, this.obsCtx);
    s.yearsElapsed = s.physics.timeYears;
    // Turn boundaries are tracked by the civilization's resolved-turn counter
    // (civ.turn), not by floor(): a 1e-12 floating residue must not create or
    // swallow a turn. The epsilon corresponds to ~30 ms of simulated time.
    const dueTurns = Math.floor((s.yearsElapsed + 1e-9) / TURN_YEARS);
    let guard = 0;
    while (s.civ.turn < dueTurns && guard < 8) {
      guard += 1;
      this.resolveTurn();
      if (s.gameOver) return;
    }
  }

  /* ------------------------------------------------------------------ *
   *  TURN RESOLUTION                                                    *
   * ------------------------------------------------------------------ */

  private resolveTurn(): void {
    const s = this.state;
    if (s.gameOver) return;
    const year = s.meta.calendarStartYear + s.yearsElapsed;
    const turn = s.civ.turn + 1;
    if (s.events && Array.isArray(s.events.pending) && s.events.pending.length > 0) {
      this.paused = true;
      return;
    }
    this.obsCtx = observationContextFor(s);

    // 0) Politics turn (v1.3): cabinet efficiency / faction mood / capital income.
    const politicsEffects = s.politics
      ? politicsTurn(
        s.politics,
        { stability: s.civ.stability, population: s.civ.population, era: s.civ.era },
        year,
        turn,
      )
      : null;
    if (politicsEffects) {
      for (const item of politicsEffects.logs) this.log.add("politics", item.severity, item.message, year, turn);
      this.obsCtx = {
        ...this.obsCtx,
        efficiency: this.obsCtx.efficiency * politicsEffects.observationMultiplier,
      };
    }

    // 1) Research: spend stockpiled science into the active project.
    // v1.6: 科研资源倾斜调整科研点产出与非科研产出；科学院建筑群提供全文明研究速度。
    const buildingEffects = aggregateBuildingEffects(s.buildings, BUILDING_DEFS, s.civ.era);
    const techMult = getTechMultipliers(s.tech);
    const funding = fundingModifiers(s.tech);
    techMult.research *= funding.scienceProduction;
    for (const id of Object.keys(techMult.production) as ResourceId[]) {
      if (id === "science") continue;
      techMult.production[id] *= funding.otherProduction;
    }
    if (politicsEffects) {
      techMult.research *= politicsEffects.researchMultiplier;
      techMult.industry *= politicsEffects.industryMultiplier;
      techMult.agriculture *= politicsEffects.agricultureMultiplier;
    }
    const academyResearchSpeed = 1 + (buildingEffects.researchSpeed ?? 0);
    let researchSpent = 0;
    let researchCompleted: string | null = null;
    if (s.tech.activeTech) {
      const budget = s.civ.resources.science.amount;
      if (budget > 0) {
        const result = advanceResearch(s.tech, budget, academyResearchSpeed);
        researchSpent = result.spent;
        researchCompleted = result.completedId;
      }
    }

    // 2) Construction progress (industry accelerated).
    const buildSpeed = constructionSpeed(s.civ, techMult.industry);
    const construction = advanceConstruction(s.buildings, s.civ, 1, buildSpeed);
    const completedDefs = construction.completedIds;

    // 3) Observation task progress / estimates / discoveries.
    const observation = finishTurns(s.observation, s.physics, s.environment, 1, this.obsCtx);
    for (const entry of observation.logs) {
      this.log.add(entry.category, entry.severity, entry.message, year, turn);
    }

    // 4) Building & technology aggregate effects (buildingEffects computed before research).
    if (politicsEffects && buildingEffects.production) {
      buildingEffects.production.food = (buildingEffects.production.food ?? 0) * politicsEffects.agricultureMultiplier;
    }
    const techEffects = aggregateTechEffects(s.tech);
    void academyResearchSpeed;
    const maintenance = totalMaintenance(s.buildings);
    const workerJobs = totalWorkers(s.buildings);

    // 5) Physical hazards from this turn's real extremes + player prediction.
    const confidenceValues = (["A", "B", "C"] as StarId[])
      .map((id) => s.observation.stars[id]?.confidence ?? 0)
      .filter((c) => c > 0);
    const observationConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : 0;
    const luminosities: Partial<Record<StarId, number>> = {};
    for (const id of ["A", "B", "C"] as StarId[]) {
      const est = s.observation.stars[id];
      if (est?.known.mass && est.mass > 0.05) luminosities[id] = Math.pow(est.mass, 3.45);
    }
    const hazardResult = resolveHazardTurn(s.hazards, s.physics, s.environment, {
      year: s.yearsElapsed,
      turn,
      observationLevel: s.observation.level,
      observationConfidence,
      warningBonusYears: buildingEffects.warningBonus ?? 0,
      disasterResistance: (buildingEffects.disasterResistance ?? 0)
        + (techEffects.disasterResistance ?? 0)
        + Math.max(0, (politicsEffects?.defenseMultiplier ?? 1) - 1) * 0.3,
      techDetectionMultiplier: 1,
      prediction: s.observation.prediction,
      playerModelAccuracy: s.observation.playerModel?.accuracy ?? 0,
      starLuminosities: luminosities,
      hazardMultiplier: DIFFICULTIES[s.meta.difficulty]?.hazardMultiplier ?? 1,
    });
    for (const entry of hazardResult.logs) {
      this.log.add(entry.category, entry.severity, entry.message, year, turn);
    }

    // 6) Direct physical disaster damage (already reduced by preparedness).
    if (hazardResult.damageFraction > 0.0005) {
      const before = s.civ.population;
      s.civ.population = Math.max(0, s.civ.population * (1 - hazardResult.damageFraction));
      for (const id of Object.keys(s.civ.resources) as (keyof typeof s.civ.resources)[]) {
        const stock = s.civ.resources[id];
        stock.amount = Math.max(0, stock.amount * (1 - hazardResult.damageFraction * 0.3));
      }
      s.civ.crisisStreak += 1;
      const lost = Math.round(before - s.civ.population);
      if (lost > 0) {
        this.log.add("hazard", "critical", `灾害造成人口损失 ${lost} 人（防护已生效）。`, year, turn);
      }
    }

    // 7) Civilization economy turn.
    const penalties = crisisPenalty(s.hazards);
    const defeatBefore = checkDefeat(s.civ, s.environment);
    const hasPlanetEngine = planetEngineReady(s.civ, s.buildings, s.tech);
    const turnCtx = assembleTurnContext({
      civ: s.civ,
      env: s.environment,
      physics: s.physics,
      buildingEffects,
      techEffects,
      techMultipliers: techMult,
      crisis: {
        foodMultiplier: hazardResult.crisis.foodMultiplier * penalties.foodMultiplier,
        energyDemandMultiplier: hazardResult.crisis.energyDemandMultiplier * penalties.energyDemandMultiplier,
        stabilityPenalty: hazardResult.crisis.stabilityPenalty + penalties.stabilityPenalty
          - (politicsEffects?.stabilityDelta ?? 0)
          - (techEffects.stabilityBonus ?? 0),
        disasterDamage: 0,
      },
      mode: s.meta.mode,
      difficulty: s.meta.difficulty,
      year,
      years: TURN_YEARS,
      turn,
      maintenance,
      observatoryLevel: s.observation.level,
      researchedCount: s.tech.researched.length,
      buildingsCompleted: completedDefs,
      researchCompleted,
      workerJobs,
      researchSpent,
      constructionCount: s.buildings.queue.length,
      hasPlanetEngine,
      era: s.civ.era,
    });
    const report = resolveTurn(s.civ, turnCtx);
    for (const entry of report.logs) {
      this.log.add(entry.category, entry.severity, entry.message, year, s.civ.turn);
    }

    // 7.5) Technology passive political capital.
    if (s.politics && techEffects.politicalCapital) {
      s.politics.capital = Math.max(0, Math.min(200, s.politics.capital + techEffects.politicalCapital));
    }

    // 8) Colony growth.
    if (s.civ.colony) {
      const colony = colonyReport(s.civ, s.environment, TURN_YEARS);
      for (const entry of colony.logs) {
        this.log.add(entry.category, entry.severity, entry.message, year, s.civ.turn);
      }
    }

    // 9) Crises from real resource / environment state.
    const crisisLogs = updateCrises({ civ: s.civ, env: s.environment, year: s.yearsElapsed, hazard: s.hazards });
    for (const entry of crisisLogs) {
      this.log.add(entry.category, entry.severity, entry.message, year, turn);
    }

    // 9.5) 时代进化：建筑/科技/人口条件满足时进入下一时代。
    this.syncObservatoryBuilding(year, s.civ.turn);
    this.maybeAdvanceEra(year, s.civ.turn);
    this.lockUnavailableResources();

    // 10) Keep the player's forecast fresh (throttled for performance).
    if (s.observation.level >= 3 && s.observation.playerModel?.valid && s.yearsElapsed - this.lastPredictionYear >= 2) {
      this.lastPredictionYear = s.yearsElapsed;
      refreshObservationPrediction(s.observation, this.obsCtx);
    }

    // 11) Victory / defeat.
    const defeat = checkDefeat(s.civ, s.environment);
    const modeAllowsDefeat = s.meta.mode !== "sandbox";
    if (modeAllowsDefeat && (defeat.defeated || !s.physics.planetAlive || s.physics.planetEjected)) {
      const reason = defeat.reason
        ?? (!s.physics.planetAlive ? "母星在恒星的引力漩涡中湮灭" : "母星被抛离了星系，文明失去了家园");
      this.finishGame(false, "文明终结", reason, defeat.defeated ? "collapse" : "planet-lost");
      return;
    }
    if (report.victory && report.victoryReason) {
      this.finishGame(true, "文明的选择", report.victoryReason, "victory");
      return;
    }
    if (s.meta.mode === "survival" && s.yearsElapsed >= 160 && s.civ.alive) {
      this.finishGame(true, "存续者", "文明在混乱的三体星系中存续了 160 年。观测、预测与储备让火种没有熄灭。", "survive");
      return;
    }
    if (report.collapsed && report.collapseReason) {
      this.finishGame(false, "文明终结", report.collapseReason, "collapse");
      return;
    }

    // 11.5) Random event roll (v1.3). When an event fires the simulation pauses
    // until the player chooses; all effects are applied inside the events system.
    if (s.events) {
      const pending = maybeTriggerEvent(s.events, {
        civ: s.civ,
        tech: s.tech,
        politics: s.politics ?? null,
        hazards: s.hazards,
        era: s.civ.era,
        turn,
        year,
        difficulty: s.meta.difficulty,
        randomSeed: s.meta.seed,
      });
      if (pending) {
        const def = getActiveEvent(s.events);
        this.addLog(
          "event",
          "warning",
          `随机事件触发：《${def?.title ?? pending.defId}》——模拟已暂停，等待你的抉择。`,
        );
        this.paused = true;
      }
    }

    // 12) Periodic autosave (throttled by turn count and real time).
    const nowReal = Date.now();
    if (
      this.host.autosaveIntervalSeconds !== 0
      && s.civ.turn - this.lastAutosaveTurn >= AUTOSAVE_TURN_INTERVAL
      && nowReal - this.lastAutosaveReal > 45000
    ) {
      this.lastAutosaveTurn = s.civ.turn;
      this.lastAutosaveReal = nowReal;
      void this.persist(AUTOSAVE_SLOT, "自动存档", true);
    }
    void defeatBefore;
  }

  /** 建成观星台后同步观测等级到 Lv.1（之后通过天文台面板升级）。 */
  private syncObservatoryBuilding(year: number, turn: number): void {
    const s = this.state;
    const built = getBuildingCount(s.buildings, "observatory");
    if (built >= 1 && s.observation.level < 1) {
      s.observation.level = 1;
      s.observation.equipmentLevel = 1;
      this.log.add("observation", "success", "观星台落成：文明第一次拥有系统性的天文观测能力。", year, turn);
      this.state.log = this.log.all();
      this.state.nextLogId = this.log.lastId;
    }
  }

  /** 满足条件时自动推进时代；可一次跨多个时代（条件早已满足时）。 */
  private maybeAdvanceEra(year: number, turn: number): void {
    const s = this.state;
    let guard = 0;
    while (s.civ.era < ERA_MAX && guard < ERA_MAX) {
      guard += 1;
      if (!canAdvanceEra(s.civ, s.tech, s.buildings, s.observation.level)) break;
      const newEra = applyEraAdvance(s.civ);
      if (newEra == null) break;
      const def = getEraDef(newEra);
      this.log.add(
        "milestone",
        "success",
        `文明进入第 ${newEra} 时代「${def.name}」（${def.subtitle}）：${def.unlockSummary}`,
        year,
        turn,
      );
      this.state.log = this.log.all();
      this.state.nextLogId = this.log.lastId;
    }
    this.obsCtx = observationContextFor(s);
  }

  /** 未解锁资源强制归零（旧时代不可能有电力/金属库存）。 */
  private lockUnavailableResources(): void {
    const s = this.state;
    for (const id of Object.keys(s.civ.resources) as ResourceId[]) {
      if (resourceUnlocked(s.civ.era, id)) continue;
      const stock = s.civ.resources[id];
      stock.amount = 0;
      const flow = s.civ.flows[id];
      if (flow) {
        flow.produced = 0;
        flow.consumed = 0;
        flow.net = 0;
      }
    }
  }

  private finishGame(victory: boolean, title: string, text: string, endingId: string): void {
    const s = this.state;
    if (s.gameOver) return;
    s.gameOver = true;
    s.victory = victory;
    s.endingId = endingId;
    s.endingTitle = title;
    s.endingText = text;
    this.paused = true;
    const year = s.meta.calendarStartYear + s.yearsElapsed;
    this.log.add("ending", victory ? "success" : "critical", `【${title}】${text}`, year, s.civ.turn);
    this.state.log = this.log.all();
    this.state.nextLogId = this.log.lastId;
  }

  /* ------------------------------------------------------------------ *
   *  VIEW / SCENE                                                       *
   * ------------------------------------------------------------------ */

  /**
   * The frozen GameApi contract has no explicit update() call, so the game
   * advances its simulation clock from the same polling calls the UI/renderer
   * already make (scene() every animation frame, view() every HUD refresh).
   * The simulated time advanced is derived from real elapsed time, never from
   * frame rate; if the tab is throttled the clock simply advances slower in
   * wall-clock terms while physics stays fixed-step.
   */
  private tickClock(): void {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    let dt = (now - this.lastTickAt) / 1000;
    this.lastTickAt = now;
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (dt > 0.5) dt = 0.5;
    this.update(dt);
  }

  view(): ViewModel {
    this.tickClock();
    return buildViewModel(this);
  }

  scene(): RenderScene {
    this.tickClock();
    return buildRenderScene(this.state, this.settings, this.selection);
  }

  scene3d(): RenderScene3D {
    this.tickClock();
    return buildRenderScene3D(this.state, this.settings, this.selection);
  }

  /* ------------------------------------------------------------------ *
   *  ACTIONS                                                            *
   * ------------------------------------------------------------------ */

  get actions(): GameActions {
    return this;
  }

  get pausedState(): boolean {
    return this.paused;
  }

  get speedIndexState(): number {
    return this.speedIndex;
  }

  togglePause(): void {
    if (this.state.gameOver) return;
    this.paused = !this.paused;
    this.yearDebt = 0;
  }

  setSpeedIndex(index: number): void {
    if (this.state.gameOver) return;
    const clamped = Math.max(0, Math.min(TIME_SPEEDS.length - 1, Math.round(index)));
    this.speedIndex = clamped;
    if (TIME_SPEEDS[clamped] === 0) this.paused = true;
    else this.paused = false;
  }

  advanceTurn(): void {
    if (this.state.gameOver) return;
    const s = this.state;
    if (!this.paused) this.paused = true;
    const dt = s.physics.dtYears;
    // Exactly one turn of simulated time: from the current resolved turn to the
    // next boundary. This is independent of floating-point residue.
    const targetYear = (s.civ.turn + 1) * TURN_YEARS;
    const turnBefore = s.civ.turn;
    let steps = 0;
    while (targetYear - s.yearsElapsed > 1e-9 && steps < 4000) {
      this.stepOnce(dt);
      steps += 1;
      if (s.gameOver) return;
    }
    if (s.gameOver) return;
    // The boundary handler normally resolves the turn; guarantee it does.
    if (s.civ.turn === turnBefore) this.resolveTurn();
    this.yearDebt = 0;
  }

  select(id: StarId | "planet" | null): void {
    this.selection = id;
  }

  startBuilding(buildingId: string): void {
    const s = this.state;
    if (s.gameOver) return;
    const def = getBuildingDef(buildingId);
    if (!def) {
      this.addLog("build", "warning", "未知的建筑类型：" + buildingId);
      return;
    }
    const check = checkBuild(buildingId, s.civ, s.buildings, s.tech, aggregateTechEffects(s.tech), s.meta.mode);
    if (!check.ok) {
      this.addLog("build", "warning", "无法建造 " + def.name + "：" + (check.reason ?? "条件不满足"));
      return;
    }
    const result = startConstruction(s.buildings, s.civ, def, s.yearsElapsed);
    if (!result.ok) {
      this.addLog("build", "warning", "建造失败：" + (result.reason ?? "未知原因"));
      return;
    }
    this.addLog("build", "info", `开始建造 ${def.name}（${def.buildTurns} 回合）。`);
  }

  upgradeBuilding(buildingId: string): void {
    const s = this.state;
    if (s.gameOver) return;
    const def = getBuildingDef(buildingId);
    if (!def || !def.upgradeTo) {
      this.addLog("build", "warning", "该建筑已是当前升级链末端。");
      return;
    }
    const target = getBuildingDef(def.upgradeTo);
    if (!target) {
      this.addLog("build", "warning", "升级目标定义缺失：" + def.upgradeTo);
      return;
    }
    const targetEra = buildingEra(target);
    if (s.civ.era < targetEra) {
      this.addLog("build", "warning", `升级 ${def.name} → ${target.name} 需要第 ${targetEra} 时代。`);
      return;
    }
    const missingTech = target.requiresTech.filter((techId) => !s.tech.researched.includes(techId));
    if (missingTech.length > 0) {
      this.addLog(
        "build",
        "warning",
        `升级 ${def.name} → ${target.name} 需要科技：${missingTech.map((techId) => techDisplayName(techId)).join("、")}。`,
      );
      return;
    }
    const result = startUpgrade(s.buildings, s.civ, def, target, s.yearsElapsed);
    if (!result.ok) {
      this.addLog("build", "warning", "升级失败：" + (result.reason ?? "条件不满足"));
      return;
    }
    this.addLog("build", "info", `开始升级 ${def.name} → ${target.name}（${target.upgradeTurns ?? target.buildTurns} 回合）。`);
  }

  cancelConstruction(jobId: number): void {
    const s = this.state;
    const index = s.buildings.queue.findIndex((job) => job.id === jobId);
    if (index < 0) return;
    const job = s.buildings.queue[index];
    const def = getBuildingDef(job.buildingId);
    s.buildings.queue.splice(index, 1);
    if (def) {
      // Upgrade jobs refund the upgrade payment; new builds refund half of cost.
      const paid: Partial<Record<string, number>> = job.upgradeFrom ? job.upgradePaid ?? {} : {};
      const baseCost: Partial<Record<string, number>> = job.upgradeFrom ? {} : def.cost;
      for (const id of Object.keys(baseCost) as (keyof typeof def.cost)[]) {
        const amount = (baseCost[id] ?? 0) * 0.5;
        const stock = s.civ.resources[id as keyof typeof s.civ.resources];
        if (stock) stock.amount = Math.min(stock.capacity, stock.amount + amount);
      }
      for (const id of Object.keys(paid)) {
        const stock = s.civ.resources[id as keyof typeof s.civ.resources];
        if (stock) stock.amount = Math.min(stock.capacity, stock.amount + (paid[id] ?? 0) * 0.5);
      }
      this.addLog("build", "info", `取消 ${job.upgradeFrom ? "升级" : "建造"} ${def.name}，返还 50% 资源。`);
    }
  }

  startResearch(techId: string): void {
    const s = this.state;
    if (s.gameOver) return;
    const check = canResearch(techId, s.tech, s.civ.era);
    if (!check.ok) {
      this.addLog("tech", "warning", "无法研究：" + (check.reason ?? "条件不满足"));
      return;
    }
    const result = startResearch(s.tech, techId);
    if (!result.ok) {
      this.addLog("tech", "warning", "研究启动失败：" + (result.reason ?? "未知原因"));
      return;
    }
    const name = s.tech.activeTech ? activeResearchInfo(s.tech)?.name ?? techId : techId;
    if (result.notice) this.addLog("tech", "warning", result.notice);
    this.addLog("tech", "info", `科研方向已确定：${name}。`);
  }

  /** v1.3 研究重心（学派流派），影响研究速度与效果。 */
  chooseSchoolFocus(school: TechSchool | null): void {
    const s = this.state;
    if (s.gameOver) return;
    const result = setSchoolFocus(s.tech, school);
    if (!result.ok) {
      this.addLog("tech", "warning", "无法调整研究重心：" + (result.reason ?? "条件不满足"));
      return;
    }
    this.addLog("tech", "info", school ? "研究重心转向学派：「" + school + "」，同派研究加速、跨派减速。" : "研究重心恢复均衡发展。");
  }

  /** v1.3 互斥教义选择：同组只能选择一项。 */
  chooseDoctrine(techId: string): void {
    const s = this.state;
    if (s.gameOver) return;
    const result = chooseTechDoctrine(s.tech, techId, s.civ.era);
    if (!result.ok) {
      this.addLog("tech", "warning", "无法选择教义：" + (result.reason ?? "条件不满足"));
      return;
    }
    this.addLog("tech", "success", "教义确立：" + techDisplayName(techId) + "。同组其他路线已被历史排除。");
  }

  /** v1.6 发展纲领：E3 起选择 1~2 个研究大类作为重点。 */
  chooseDevelopmentCategories(categories: ResearchCategory[]): void {
    const s = this.state;
    if (s.gameOver) return;
    const result = setDevelopmentCategories(s.tech, categories, s.civ.era);
    if (!result.ok) {
      this.addLog("tech", "warning", "无法确定发展纲领：" + (result.reason ?? "条件不满足"));
      return;
    }
    const names = (result.categories ?? []).map((id) => (id === "natural" ? "自然科学" : id === "engineering" ? "工程应用" : "社会科学"));
    this.addLog(
      "tech",
      "success",
      `发展纲领确立：${names.join(" + ")}。已选大类研究速度 +10%，未选大类 -35%。`,
    );
  }

  /** v1.6 科研资源倾斜：0~100%，越高研究越快，但非科研资源产出下降。 */
  setResearchFunding(percent: number): void {
    const s = this.state;
    if (s.gameOver) return;
    const result = setResearchFunding(s.tech, percent);
    if (!result.ok) {
      this.addLog("tech", "warning", "无法调整科研资源倾斜：" + (result.reason ?? "条件不满足"));
      return;
    }
    const funding = fundingModifiers(s.tech);
    this.addLog(
      "tech",
      "info",
      `科研资源倾斜调整为 ${Math.round(result.percent)}%：研究速度 ×${funding.researchSpeed.toFixed(2)}，非科研产出 ×${funding.otherProduction.toFixed(2)}。`,
    );
  }

  /** v1.6 注入资源加速：消耗矿物/金属/能源，立即为当前项目增加进度（每回合限一次）。 */
  boostResearch(): void {
    const s = this.state;
    if (s.gameOver) return;
    const quote = researchBoostQuote(s.tech, s.civ.era, s.civ.turn);
    if (!quote.ok) {
      this.addLog("tech", "warning", "无法注入资源加速：" + (quote.reason ?? "条件不满足"));
      return;
    }
    const cost = quote.cost;
    if (!canAfford(s.civ, cost).ok) {
      this.addLog("tech", "warning", "注入资源不足：需要矿物/金属/能源，资源库存不足。");
      return;
    }
    spendResources(s.civ, cost);
    const result = applyResearchBoost(s.tech, quote.gain, s.civ.turn);
    const costText = Object.entries(cost)
      .map(([id, value]) => `${("minerals" === id ? "矿物" : "metals" === id ? "金属" : "能源")} ${value}`)
      .join("、");
    this.addLog(
      "tech",
      result.completedId ? "success" : "info",
      `注入资源加速：消耗 ${costText}，项目「${quote.techName}」进度 +${Math.round(result.gain * 10) / 10}（${Math.round(quote.progressRatio * 100)}% 剩余进度）。`,
    );
    if (result.completedId) {
      this.addLog("tech", "success", "研究完成：" + techDisplayName(result.completedId));
    }
  }

  /** v1.3 政治：任命候选人。 */
  appointMinister(candidateId: string): void {
    const s = this.state;
    if (s.gameOver || !s.politics) return;
    const result = appointPoliticsMinister(s.politics, candidateId, this.yearNumber(), s.civ.turn);
    this.applyPoliticsResult(result);
  }

  /** v1.3 政治：罢免部长（产生即时稳定度冲击）。 */
  dismissMinister(departmentId: DepartmentId): void {
    const s = this.state;
    if (s.gameOver || !s.politics) return;
    const result = dismissPoliticsMinister(s.politics, departmentId, this.yearNumber(), s.civ.turn);
    this.applyPoliticsResult(result);
    if (result.ok && result.stabilityImpact) {
      s.civ.stability = Math.max(0, Math.min(100, s.civ.stability + result.stabilityImpact));
      this.addLog("politics", "critical", "罢免引发政局震荡：稳定度 " + result.stabilityImpact.toFixed(1) + "。");
    }
  }

  /** v1.3 政治：调解两位部长关系。 */
  mediateMinisters(a: DepartmentId, b: DepartmentId): void {
    const s = this.state;
    if (s.gameOver || !s.politics) return;
    const result = mediatePoliticsMinisters(s.politics, a, b, s.civ.turn);
    this.applyPoliticsResult(result);
  }

  /** v1.3 政治：召开峰会，提升全体派系满意度。 */
  holdSummit(): void {
    const s = this.state;
    if (s.gameOver || !s.politics) return;
    const result = holdPoliticsSummit(s.politics, s.civ.turn);
    this.applyPoliticsResult(result);
  }

  /** v1.3 随机事件：应用玩家选择。 */
  resolveEvent(choiceId: string): void {
    const s = this.state;
    if (!s.events || !Array.isArray(s.events.pending) || s.events.pending.length === 0) return;
    const year = this.yearNumber();
    const result = resolveEventChoice(s.events, choiceId, {
      civ: s.civ,
      tech: s.tech,
      politics: s.politics ?? null,
      hazards: s.hazards,
      era: s.civ.era,
      turn: s.civ.turn,
      year,
      difficulty: s.meta.difficulty,
      randomSeed: s.meta.seed,
      elapsedRealSeconds: s.meta.elapsedRealSeconds,
    });
    if (!result.ok) {
      this.addLog("event", "warning", "无法处理事件：" + (result.reason ?? "条件不足"));
      return;
    }
    for (const entry of result.logs) {
      this.log.add("event", entry.severity, entry.message, year, s.civ.turn);
    }
    this.addLog("event", "info", "事件结果：" + result.effectsSummary);
    this.addLog("event", "info", "量化结算将在 " + 30 + " 秒后送达；期间模拟继续运行。");
    this.paused = false;
  }

  acknowledgeEventOutcome(): void {
    if (acknowledgeEventOutcome(this.state.events)) {
      this.addLog("event", "info", "已确认事件结算报告。");
    }
  }

  private yearNumber(): number {
    return this.state.meta.calendarStartYear + this.state.yearsElapsed;
  }

  private applyPoliticsResult(result: { ok: boolean; reason: string | null; logs: Array<{ severity: "info" | "success" | "warning" | "critical"; message: string }> }): void {
    if (!result.ok) {
      this.addLog("politics", "warning", "政治动作失败：" + (result.reason ?? "条件不满足"));
      return;
    }
    for (const entry of result.logs) {
      this.addLog("politics", entry.severity, entry.message);
    }
  }

  cancelResearch(): void {
    if (this.state.tech.activeTech) {
      this.state.tech.activeTech = null;
      this.state.tech.progress = 0;
      this.addLog("tech", "info", "已中止当前研究，未消耗的科研点保留在库存中。");
    }
  }

  startObservation(kind: ObservationKind, target: StarTarget): void {
    const s = this.state;
    if (s.gameOver) return;
    // Before electricity (era 1-2) observation is paid in food/labour supply.
    const currency: ResourceId = s.civ.era >= 3 ? "energy" : "food";
    const available = s.civ.resources[currency].amount;
    const result = startObservation(
      s.observation, s.physics, s.observation.level, kind, target, s.yearsElapsed, available,
    );
    if (!result.ok || !result.task) {
      this.addLog("observation", "warning", "观测任务无法开始：" + (result.reason ?? "未知原因"));
      return;
    }
    s.civ.resources[currency].amount = Math.max(0, s.civ.resources[currency].amount - result.task.energyCost);
    this.addLog(
      "observation",
      "info",
      `观测任务开始：${result.task.summary}，预计 ${result.task.turnsRequired} 回合、消耗 ${result.task.energyCost} ${currency === "energy" ? "能源" : "食物"}。`,
    );
  }

  cancelObservation(): void {
    const task = cancelObservation(this.state.observation);
    if (task) this.addLog("observation", "info", "观测任务已取消，设备转入待机。");
  }

  upgradeObservatory(): void {
    const s = this.state;
    if (s.gameOver) return;
    if (s.observation.level <= 0) {
      this.addLog("observation", "info", "观测等级 Lv.1 需要通过建造「观星台」获得；先在建造面板完成观星台。");
      return;
    }
    const check = checkUpgrade(s.observation.level, s.tech.researched, s.civ.resources as never);
    if (!check.canUpgrade || !check.next) {
      this.addLog("observation", "warning", "无法升级天文台：" + (check.blockedReason ?? "条件不满足"));
      return;
    }
    const next = check.next;
    if (next.requiresEra && s.civ.era < next.requiresEra) {
      this.addLog("observation", "warning", `无法升级天文台：需要第 ${next.requiresEra} 时代（当前第 ${s.civ.era} 时代）。`);
      return;
    }
    const costs = next.upgradeCost;
    s.civ.resources.minerals.amount -= costs.minerals;
    s.civ.resources.metals.amount -= costs.metals;
    s.civ.resources.energy.amount -= costs.energy;
    s.civ.resources.science.amount -= next.upgradeScience;
    s.observation.level = next.level;
    s.observation.equipmentLevel = next.level;
    s.observation.efficiency = 1 + (next.level - 1) * 0.08;
    markModelDirty(s.observation);
    this.obsCtx = observationContextFor(s);
    this.addLog("observation", "success", `天文台升级为「${next.name}」（Lv.${next.level}）：${next.capabilities.join("、")}。`);
  }

  refreshPrediction(): void {
    const s = this.state;
    this.obsCtx = observationContextFor(s);
    if (s.observation.level < 3) {
      this.addLog("observation", "info", "需要 3 级天文台才能建立三体动力学预测模型。");
      return;
    }
    const bundle = refreshObservationPrediction(s.observation, this.obsCtx);
    if (!bundle) {
      this.addLog("observation", "warning", "尚无可用的动力学模型：先完成足够的三星联合观测，获取位置与速度。");
      return;
    }
    this.lastPredictionYear = s.yearsElapsed;
    this.addLog(
      "observation",
      "success",
      `预测已更新：窗口 ${bundle.horizonYears.toFixed(0)} 年，可靠区间约 ${(bundle.reliableFraction * bundle.horizonYears).toFixed(0)} 年。${bundle.diverged ? "集合已明显发散，混沌正在吞没确定性。" : ""}`,
    );
  }

  foundColony(): void {
    const s = this.state;
    if (s.gameOver) return;
    // v1.6: 星际殖民不得早于 E5（信息与早期航天）。
    if (s.civ.era < 5) {
      this.addLog("civilization", "warning", "星际殖民需要进入第 5 时代（信息与早期航天）。");
      return;
    }
    const result = foundColony(s.civ, s.tech, s.civ.resources, s.yearsElapsed);
    if (!result.ok) {
      this.addLog("civilization", "warning", "无法建立殖民地：" + (result.reason ?? "条件不满足"));
      return;
    }
    this.addLog("milestone", "success", `星际殖民地「${result.colony?.name}」建立。文明第一次在另一颗星球上点亮灯火。`);
  }

  buildPlanetEngine(): void {
    const s = this.state;
    if (s.gameOver) return;
    if (s.civ.era < 6) {
      this.addLog("civilization", "warning", "行星发动机需要进入第 6 时代（星际文明）。");
      return;
    }
    if (!planetEngineReady(s.civ, s.buildings, s.tech)) {
      this.addLog("civilization", "warning", "行星发动机尚未具备启动条件：需要第 6 时代、相应科技与已建成的发动机。");
      return;
    }
    this.finishGame(true, "流浪行星", "行星发动机点火，母星带着整个文明驶离三星的引力轨道。", "planet-engine");
  }

  toggleSetting(key: keyof ViewSettings): void {
    this.settings[key] = !this.settings[key];
  }

  /* ------------------------------------------------------------------ *
   *  SAVE / LOAD                                                        *
   * ------------------------------------------------------------------ */

  private addLog(category: LogEntry["category"], severity: LogEntry["severity"], message: string): void {
    const s = this.state;
    const entry = this.log.add(category, severity, message, s.meta.calendarStartYear + s.yearsElapsed, s.civ.turn);
    s.log = this.log.all();
    s.nextLogId = this.log.lastId;
    void entry;
  }

  private async persist(slotId: string, name: string, auto: boolean): Promise<SaveResult> {
    if (this.saveBusy) return { ok: false, error: "存档正在进行中" };
    this.saveBusy = true;
    try {
      this.syncLogToState();
      const meta = await persistGame(this.state, slotId, name);
      this.state.lastSavedAt = meta.savedAt;
      if (!auto) {
        this.addLog("system", "success", `游戏已保存至「${meta.name}」。`);
      }
      return { ok: true, id: slotId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addLog("system", "warning", "存档失败：" + message);
      return { ok: false, error: message };
    } finally {
      this.saveBusy = false;
    }
  }

  private syncLogToState(): void {
    this.state.log = this.log.all();
    this.state.nextLogId = this.log.lastId;
  }

  async saveGame(slotId: string, name?: string): Promise<SaveResult> {
    return this.persist(slotId, name ?? slotId, false);
  }

  async loadGame(slotId: string): Promise<boolean> {
    const state = await loadGameFromSlot(slotId);
    if (!state) {
      this.addLog("system", "warning", "读取存档失败：存档不存在或已损坏。");
      return false;
    }
    this.replaceState(state);
    this.addLog("system", "success", "存档已载入。模拟将在暂停状态下恢复。");
    return true;
  }

  async listSaves(): Promise<SaveSlotMeta[]> {
    return listSaveSlots();
  }

  async deleteSave(slotId: string): Promise<void> {
    await deleteSaveSlot(slotId);
  }

  async exportSave(): Promise<void> {
    this.syncLogToState();
    exportSaveToFile(this.state);
  }

  async importSaveText(text: string): Promise<boolean> {
    const result = parseGameFile(text);
    if (!result.ok || !result.state) {
      this.addLog("system", "warning", "导入存档失败：" + (result.error ?? "格式错误"));
      return false;
    }
    this.replaceState(result.state);
    this.addLog("system", "success", "外部存档已导入。");
    return true;
  }

  returnToMenu(): void {
    this.syncLogToState();
    this.paused = true;
    this.host.onReturnToMenu();
  }

  /** Replace the whole simulation state (load / import). */
  replaceState(state: GameState): void {
    // v1.6 存档兼容：旧档（缺少 v1.6 科研政策字段）按原 era 值迁移到六时代坐标系；
    // 旧 E3 保留为 E3（蒸汽），旧 E4 → E5，旧 E5 → E6，科技 id 全部保留。
    if (isLegacyTechState(state.tech)) {
      state.civ.era = migrateLegacyEra(state.civ.era);
    }
    normalizeTechState(state.tech);
    this.state = state;
    this.log.clear();
    this.log.restore(state.log, state.nextLogId);
    this.yearDebt = 0;
    this.paused = true;
    this.selection = null;
    this.obsCtx = observationContextFor(state);
    this.lastPredictionYear = -100;
    this.lastAutosaveTurn = state.civ.turn;
    this.lastAutosaveReal = Date.now();
    this.startedAt = Date.now();
  }

  /** Force a fresh naked-eye calibration (used after loading a legacy save). */
  recalibrate(): void {
    this.obsCtx = observationContextFor(this.state);
    performNakedEyeCalibration(this.state.observation, this.state.physics, this.state.environment, this.obsCtx);
  }

  /* ------------------------------------------------------------------ *
   *  MISC ACCESSORS USED BY THE VIEW LAYER                              *
   * ------------------------------------------------------------------ */

  get pausedValue(): boolean { return this.paused; }
  get speedValue(): number { return TIME_SPEEDS[this.speedIndex] ?? 0; }
  get modeInfo() { return { paused: this.paused, speedIndex: this.speedIndex }; }
  get taskOptions() { return buildTaskOptions({ level: this.state.observation.level, energy: this.state.civ.resources.energy.amount, taskActive: Boolean(this.state.observation.activeTask) }); }
  get era() { return eraStatus(this.state.civ, this.state.tech, this.state.buildings, this.state.observation.level); }
  get uptimeSeconds() { return (Date.now() - this.startedAt) / 1000; }
}

function observationContextForSafeFallback(): ObservationContext {
  return {
    level: 0, difficultyNoise: 1, techObservationMultiplier: 0, techPredictionMultiplier: 0,
    efficiency: 1, weather: "clear", time: 0, turn: 0,
  };
}

export { buildViewModel };
