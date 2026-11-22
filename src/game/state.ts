/**
 * Game state assembly: one place that combines the physically generated galaxy,
 * the civilization, the observation system and the hazard system.
 */
import { CALENDAR_START_YEAR, DIFFICULTIES, SAVE_VERSION } from "../core/constants";
import type { GameState, LogEntry, NewGameOptions } from "../core/types";
import { generateGalaxy } from "../generation/galaxy";
import { createCivilizationState } from "../civilization/state";
import { createInitialBuildingState } from "../buildings/system";
import { createTechState, getTechMultipliers } from "../technology/system";
import { createHazardState } from "../events/hazards";
import { createEventState } from "../events/system";
import { createPoliticsState } from "../politics/system";
import { createObservationState, performNakedEyeCalibration } from "../observation/observation";
import type { ObservationContext } from "../observation/observation";

/** Build the observation context passed into every observation-system call. */
export function observationContextFor(state: GameState): ObservationContext {
  const mult = getTechMultipliers(state.tech);
  return {
    level: state.observation.level,
    difficultyNoise: DIFFICULTIES[state.meta.difficulty].observationNoise,
    techObservationMultiplier: Math.max(0, mult.observation - 1),
    techPredictionMultiplier: Math.max(0, mult.prediction - 1),
    efficiency: state.observation.efficiency,
    weather: state.environment.weather,
    time: state.yearsElapsed,
    turn: state.civ.turn,
  };
}

export function createGameState(opts: NewGameOptions): GameState {
  const { seed, difficulty, mode } = opts;
  const galaxy = generateGalaxy(seed, difficulty, mode);
  const physics = galaxy.physics;
  const environment = galaxy.environment;

  const civ = createCivilizationState({
    difficulty,
    mode,
    seed,
    startYear: 0,
    startTempC: environment.surfaceTempC,
  });
  const buildings = createInitialBuildingState();
  const tech = createTechState();
  const politics = createPoliticsState(seed);
  const events = createEventState(seed + "|events");

  // The civilization starts with a basic observatory (level 1) already built.
  const observation = createObservationState(seed + "|obs", 0);
  // Primitive start: no observatory yet. Building the 观星台 (observatory)
  // syncs level 1 in Game.syncObservatoryBuilding().
  observation.level = 0;
  observation.equipmentLevel = 0;
  observation.efficiency = 1;
  const initialCtx: ObservationContext = {
    level: observation.level,
    difficultyNoise: DIFFICULTIES[difficulty].observationNoise,
    techObservationMultiplier: 0,
    techPredictionMultiplier: 0,
    efficiency: 1,
    weather: environment.weather,
    time: 0,
    turn: 0,
  };
  performNakedEyeCalibration(observation, physics, environment, initialCtx);

  const logs: LogEntry[] = [];
  let logId = 1;
  const addLog = (
    category: LogEntry["category"],
    severity: LogEntry["severity"],
    message: string,
  ): void => {
    logs.push({ id: logId++, year: 0, turn: 0, category, severity, message });
  };

  addLog("system", "info", `纪元启动。种子 ${seed}（${DIFFICULTIES[difficulty].name} / ${modeName(mode)}）。`);
  addLog("physics", "info", `星系预演分类：${galaxy.classification.name}。混沌指数 ${galaxy.classification.chaosIndex.toFixed(2)}，母星轨道风险 ${(galaxy.classification.ejectionRisk * 100).toFixed(0)}%。`);
  addLog("physics", "info", "三体引力模拟已启动：三颗恒星为完整相互 N-body，母星为受引力作用的测试粒子；物理步长固定 1/1600 年，与渲染帧率无关。");
  addLog("observation", "info", "部落以肉眼仰望三颗太阳：方位、颜色与升落周期被口耳相传。建造观星台后才能进行系统性天文观测。");
  addLog("politics", "info", "六部临时联合政府成立：行政、科研、工业、农业、防务、观测各有一名部长，派系暗流已开始涌动。");
  addLog("civilization", "success", `文明起步：人口 ${Math.round(civ.population)}，农业区与居住区开始运转。观测、建设、研究，然后活过下一次乱纪元。`);
  if (galaxy.preview.warnings.length > 0) {
    for (const warning of galaxy.preview.warnings.slice(0, 2)) {
      addLog("hazard", "warning", warning);
    }
  }

  const meta: GameState["meta"] = {
    seed,
    difficulty,
    mode,
    createdAt: Date.now(),
    elapsedRealSeconds: 0,
    galaxy: galaxy.classification,
    startYear: 0,
    calendarStartYear: CALENDAR_START_YEAR,
  };

  return {
    version: SAVE_VERSION,
    meta,
    physics,
    environment,
    observation,
    civ,
    buildings,
    tech,
    hazards: createHazardState(),
    politics,
    events,
    log: logs,
    nextLogId: logId,
    yearsElapsed: 0,
    gameOver: false,
    victory: false,
    endingId: null,
    endingTitle: null,
    endingText: null,
    lastSavedAt: null,
  };
}

function modeName(mode: NewGameOptions["mode"]): string {
  switch (mode) {
    case "story": return "剧情模式";
    case "survival": return "生存模式";
    case "sandbox": return "沙盒模式";
    default: return "标准模式";
  }
}

/** Fast validation used by the save importer. */
export function isPlayableState(state: GameState): boolean {
  return Boolean(state && state.physics && state.observation && state.civ && state.meta && state.environment);
}
