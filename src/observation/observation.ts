/**
 * 观测系统编排器（游戏循环唯一入口）。
 *
 * 调用节奏（详见 docs/OBSERVATION_API.md）：
 *  - 每物理步：sampleTick()（有观测任务时采集测量） + syncObservation()（玩家模型推演）
 *  - 每文明回合：finishTurns()（任务进度 / 估计重建 / 科学发现）
 *  - 按钮：startObservation() / refreshPrediction()
 *
 * 数据隔离：本文件只在调用 measurements.ts 时间接读取真实物理状态（生成测量）；
 * 估计、模型、预测、发现只消费观测数据。所有状态保存在 ObservationState 内，可存档。
 */
import {
  MAX_TRAIL_RENDER_POINTS, OBSERVATORY_LEVELS, STAR_BASE_NAMES, STAR_COLORS, TRAIL_INTERVAL, TURN_YEARS,
} from "../core/constants";
import { clamp, clamp01, projectXZ, v3 } from "../core/math";
import type { Vec3 } from "../core/math";
import { Rng } from "../core/rng";
import { OBSERVATION_KIND_LABELS } from "../core/types";
import type {
  Discovery, EnvironmentState, ObservationKind, ObservationRecord, ObservationState, ObservationTask,
  PhysicsState, PlanetEstimate, PlanetMeasurement, PlayerModel, PredictionBundle, StarEstimate, StarId,
  StarMeasurement, StarTarget, WeatherKind,
} from "../core/types";
import type { ObservationTaskView, PredictionView } from "../game/viewTypes";
import { addDiscovery, detectDiscoveries, recordChaosSensitivity } from "./discovery";
import { computePlanetEstimate, recomputeEstimates } from "./estimator";
import {
  appendMeasurementTrails, appendObservedTrail, buildPlayerModel, computeResiduals, propagateModel,
} from "./model";
import { computeClosestApproach, computePrediction, computeStarReliableYears } from "./prediction";
import {
  sampleNakedEyeMeasurements, samplePlanetMeasurement, sampleStarMeasurements, noiseModel,
  type MeasurementContext, type SessionParams,
} from "./measurements";
import { getCapabilities, levelInfo, taskMeta, type TaskMeta } from "./observatory";

/** 观测任务内的采样间隔（模拟年）：一个文明回合（0.5 年）采样 10 批。 */
export const SAMPLE_INTERVAL_YEARS = 0.05;
/** 保存的恒星测量上限（防止存档无限膨胀）。 */
export const MAX_STAR_MEASUREMENTS = 480;
/** 保存的母星测量上限。 */
export const MAX_PLANET_MEASUREMENTS = 240;
/** 观测历史记录上限。 */
export const MAX_OBSERVATION_HISTORY = 120;
/** 观测任务历史上限。 */
export const MAX_TASK_HISTORY = 40;

const STAR_IDS: StarId[] = ["A", "B", "C"];

export interface ObservationContext {
  level: number;
  difficultyNoise: number;
  techObservationMultiplier: number;
  techPredictionMultiplier: number;
  efficiency: number;
  weather: WeatherKind;
  time: number;
  turn: number;
}

function clampLevel(level: number): number {
  return clamp(Math.round(Number.isFinite(level) ? level : 0), 0, 6);
}

function emptyEstimate(id: StarId): StarEstimate {
  return {
    id,
    name: STAR_BASE_NAMES[id] ?? id,
    color: STAR_COLORS[id] ?? "#ffffff",
    pos: v3(0, 0, 0),
    vel: v3(0, 0, 0),
    mass: 1,
    sigmaPos: 1,
    sigmaVel: 9,
    sigmaMass: 0.95,
    lastMeasuredYear: 0,
    confidence: 0.05,
    known: {
      position: false, distance: false, velocity: false, mass: false, acceleration: false, orbit: false,
    },
    sampleCount: 0,
    distanceFromBarycenter: 0,
    height: 0,
    eccentricity: null,
    inclinationRad: null,
    speed: 0,
  };
}

/** 新游戏的观测状态：只有三颗恒星的名字与颜色（肉眼可见），没有任何测量数据。 */
export function createObservationState(seedBase: string, now: number): ObservationState {
  return {
    level: 0,
    equipmentLevel: 0,
    stars: {
      A: emptyEstimate("A"),
      B: emptyEstimate("B"),
      C: emptyEstimate("C"),
    },
    planet: null,
    history: [],
    tasks: [],
    activeTask: null,
    measurements: { stars: [], planet: [] },
    discoveries: [],
    dataPoints: 0,
    playerModel: null,
    prediction: null,
    lastModelSyncYear: now,
    observedTrail: { A: [], B: [], C: [] },
    planetObservedTrail: [],
    nextRecordId: 1,
    nextDiscoveryId: 1,
    seedBase,
    lastCalibrationYear: 0,
    efficiency: 1,
    modelDirty: true,
  };
}

function addHistory(
  obs: ObservationState,
  entry: Omit<ObservationRecord, "id">,
): ObservationRecord {
  const record: ObservationRecord = { id: obs.nextRecordId++, ...entry };
  obs.history.push(record);
  if (obs.history.length > MAX_OBSERVATION_HISTORY) {
    obs.history.splice(0, obs.history.length - MAX_OBSERVATION_HISTORY);
  }
  return record;
}

function meanSigmaPos(stars: Record<StarId, StarEstimate>): number {
  let sum = 0;
  for (const id of STAR_IDS) sum += Math.max(0, stars[id]?.sigmaPos ?? 0);
  return sum / STAR_IDS.length;
}

export function targetLabel(target: StarTarget): string {
  if (target === "all") return "三颗恒星";
  if (target === "planet") return "母星";
  return (STAR_BASE_NAMES[target] ?? target) + " 星";
}

/** 某任务实际观测的恒星集合（母星观测不含恒星）。 */
export function starTargetsForTask(kind: ObservationKind, target: StarTarget): StarId[] {
  const meta = taskMeta(kind);
  if (meta.targetMode === "planet") return [];
  if (meta.targetMode === "all") return [...STAR_IDS];
  if (target === "A" || target === "B" || target === "C") return [target];
  return [...STAR_IDS];
}

/**
 * 开局肉眼校准：三颗恒星只有粗略位置（sigma 约 0.25~0.6 AU，随距离增大），
 * 没有速度 / 质量；母星只有一个粗略位置点。写入 measurements 与 observedTrail 起点，
 * confidence ~0.1。重复调用是幂等的（已有测量时直接返回）。
 */
export function performNakedEyeCalibration(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState,
  ctx: ObservationContext,
): void {
  const now = physics.timeYears;
  obs.level = clampLevel(ctx.level);
  obs.efficiency = clamp(ctx.efficiency ?? 1, 0.05, 4);
  if (obs.measurements.stars.length > 0) return;

  const result = sampleNakedEyeMeasurements(physics, obs.seedBase, now);
  const tempSigma = 22;
  const tempRng = new Rng(obs.seedBase + "|naked-temp|" + now.toFixed(3));
  result.planet.tempC = (env ? env.surfaceTempC : 0) + tempRng.normal(0, tempSigma);
  result.planet.tempSigma = tempSigma;

  obs.measurements.stars.push(...result.stars);
  obs.measurements.planet.push(result.planet);

  for (const m of result.stars) {
    const est = obs.stars[m.starId];
    if (!est) continue;
    est.pos = { ...m.pos };
    est.vel = v3(0, 0, 0);
    est.sigmaPos = m.posSigma;
    est.sigmaVel = 9;
    est.sigmaMass = 0.95;
    est.lastMeasuredYear = now;
    est.confidence = 0.1;
    est.known.position = true;
    est.sampleCount += 1;
    est.height = m.pos.y;
    est.distanceFromBarycenter = Math.hypot(m.pos.x, m.pos.y, m.pos.z);
    est.speed = 0;
    est.eccentricity = null;
    est.inclinationRad = null;
  }

  obs.planet = computePlanetEstimate(
    obs.measurements.planet,
    null,
    0,
    result.planet.tempC,
    tempSigma,
    env ? env.habitability : 0.5,
    false,
    now,
    obs.stars,
  );

  appendMeasurementTrails(obs, result.stars, result.planet);
  obs.lastCalibrationYear = now;
  obs.dataPoints += 2;
  obs.modelDirty = true;
  addHistory(obs, {
    year: now,
    kind: "star-position",
    target: "all",
    dataGained: 2,
    precisionGain: 0,
    summary: "肉眼校准：以肉眼记录三颗恒星的粗略方位与母星位置，没有速度与质量信息。",
  });
}

export interface ObservationCheck {
  ok: boolean;
  reason: string | null;
  energyCost: number;
  turnsRequired: number;
  meta: TaskMeta;
}

/** 检查任务能否开始（等级 / 已有任务 / 能源）。 */
export function canStartObservation(
  obs: ObservationState,
  level: number,
  energyAvailable: number,
  kind: ObservationKind = "star-position",
): ObservationCheck {
  const lv = clampLevel(level);
  const info = levelInfo(lv);
  const meta = taskMeta(kind);
  const energyCost = Math.round(info.energyCost * meta.energyMultiplier);
  const turnsRequired = info.taskTurns + meta.extraTurns;
  if (lv < meta.minLevel) {
    return { ok: false, reason: "需要天文台等级 " + meta.minLevel + "（当前 " + lv + "）", energyCost, turnsRequired, meta };
  }
  if (obs.activeTask && !obs.activeTask.completed) {
    return { ok: false, reason: "已有观测任务进行中：" + taskMeta(obs.activeTask.kind).label, energyCost, turnsRequired, meta };
  }
  if (!Number.isFinite(energyAvailable) || energyAvailable < energyCost) {
    return { ok: false, reason: "能源不足：需要 " + energyCost + "，当前 " + Math.floor(Math.max(0, energyAvailable)) + "", energyCost, turnsRequired, meta };
  }
  return { ok: true, reason: null, energyCost, turnsRequired, meta };
}

export interface StartObservationResult {
  ok: boolean;
  reason?: string;
  task?: ObservationTask;
}

/**
 * 开始一个观测任务。
 * 只校验能源并返回 energyCost；真正扣除能源由游戏循环负责。
 * sessionBias 由确定性 Rng(seedBase + taskId) 生成，保证同存档回放一致。
 */
export function startObservation(
  obs: ObservationState,
  physics: PhysicsState,
  level: number,
  kind: ObservationKind,
  target: StarTarget,
  now: number,
  energyAvailable: number,
): StartObservationResult {
  const lv = clampLevel(level);
  obs.level = lv;
  const meta = taskMeta(kind);
  if (meta.targetMode === "star" && target !== "A" && target !== "B" && target !== "C") {
    return { ok: false, reason: "该任务需要指定一颗恒星（A / B / C）作为观测目标" };
  }
  const check = canStartObservation(obs, lv, energyAvailable, kind);
  if (!check.ok) return { ok: false, reason: check.reason ?? "无法开始观测任务" };
  const info = levelInfo(lv);
  const taskId = obs.seedBase + "|task|" + (obs.tasks.length + 1) + "|" + kind + "|" + Math.round(now * 1000);
  const rng = new Rng(taskId + "|session-bias");
  const task: ObservationTask = {
    id: taskId,
    kind,
    target,
    startedYear: now,
    durationYears: check.turnsRequired * TURN_YEARS,
    elapsedYears: 0,
    energyCost: check.energyCost,
    turnsSpent: 0,
    turnsRequired: check.turnsRequired,
    completed: false,
    summary: meta.description,
    sessionBias: { x: rng.normal(0, 1), y: rng.normal(0, 1), z: rng.normal(0, 1) },
    samplesCollected: 0,
    sigmaMultiplier: meta.sigmaMultiplier,
  };
  obs.tasks.push(task);
  if (obs.tasks.length > MAX_TASK_HISTORY) obs.tasks.splice(0, obs.tasks.length - MAX_TASK_HISTORY);
  obs.activeTask = task;
  obs.prediction = null;
  return { ok: true, task };
}

/** 取消当前观测任务（能源退还由调用方决定）。返回被取消的任务。 */
export function cancelObservation(obs: ObservationState): ObservationTask | null {
  const task = obs.activeTask;
  if (!task) return null;
  obs.activeTask = null;
  return task;
}

function measureContext(ctx: ObservationContext, env: EnvironmentState | null, level: number): MeasurementContext {
  return {
    difficultyNoise: Number.isFinite(ctx.difficultyNoise) ? ctx.difficultyNoise : 1,
    weather: (env?.weather ?? ctx.weather ?? "clear") as WeatherKind,
    efficiency: clamp(Number.isFinite(ctx.efficiency) ? ctx.efficiency : 1, 0.2, 2),
    techObservationMultiplier: Number.isFinite(ctx.techObservationMultiplier) ? ctx.techObservationMultiplier : 0,
    level,
  };
}

/** 采集一批任务测量（内部函数，sampleTick 调用）。 */
function collectTaskSamples(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState | null,
  ctx: ObservationContext,
  task: ObservationTask,
  sampleTime: number,
  level: number,
): void {
  const meta = taskMeta(task.kind);
  const targets = starTargetsForTask(task.kind, task.target);
  const mc = measureContext(ctx, env, level);
  const session: SessionParams = {
    id: obs.seedBase + "|session|" + task.id,
    kind: task.kind,
    targets,
    sessionBias: task.sessionBias,
    sampleIndex: task.samplesCollected,
    sigmaMultiplier: task.sigmaMultiplier,
  };
  const starMs = targets.length > 0 ? sampleStarMeasurements(physics, mc, session, sampleTime) : [];
  let planetM: PlanetMeasurement | null = null;
  const planetTask = meta.targetMode === "planet" || meta.targetMode === "all" || task.target === "planet" || task.target === "all";
  if (planetTask) {
    planetM = samplePlanetMeasurement(physics, mc, session, sampleTime);
    const noise = noiseModel(level, mc);
    const tempRng = new Rng(obs.seedBase + "|temp|" + task.id + "|" + task.samplesCollected);
    planetM.tempC = (env ? env.surfaceTempC : 0) + tempRng.normal(0, Math.max(0.5, noise.tempSigma));
    planetM.tempSigma = Math.max(0.5, noise.tempSigma);
  }
  obs.measurements.stars.push(...starMs);
  if (obs.measurements.stars.length > MAX_STAR_MEASUREMENTS) {
    obs.measurements.stars.splice(0, obs.measurements.stars.length - MAX_STAR_MEASUREMENTS);
  }
  if (planetM) {
    obs.measurements.planet.push(planetM);
    if (obs.measurements.planet.length > MAX_PLANET_MEASUREMENTS) {
      obs.measurements.planet.splice(0, obs.measurements.planet.length - MAX_PLANET_MEASUREMENTS);
    }
  }
  appendMeasurementTrails(obs, starMs, planetM);
  task.samplesCollected += 1;
}

/**
 * 玩家模型的同步（内部函数）。
 * - 等级 <3：没有速度/质量，无法建模。
 * - 模型不存在：尝试重建。
 * - modelDirty：等待新的观测数据重拟合（避免用同一批旧数据反复"重建"出同一个坏模型）。
 * - 否则按 TRAIL_INTERVAL 推进模型，并用模型更新玩家"当前天空"估计与观测轨迹。
 */
function syncPlayerModel(obs: ObservationState, physics: PhysicsState, level: number, now: number): void {
  if (level < 3) {
    obs.playerModel = null;
    obs.modelDirty = true;
    obs.lastModelSyncYear = now;
    return;
  }
  if (!obs.playerModel) {
    const built = buildPlayerModel(obs, level, now);
    obs.playerModel = built;
    obs.modelDirty = built === null;
    obs.lastModelSyncYear = now;
    if (built) appendObservedTrail(obs, built);
    return;
  }
  if (obs.modelDirty || !obs.playerModel.valid) return;
  const delta = now - obs.lastModelSyncYear;
  if (!(delta >= TRAIL_INTERVAL)) return;
  propagateModel(obs.playerModel, delta);
  obs.lastModelSyncYear = now;
  if (!obs.playerModel.valid) {
    obs.modelDirty = true;
    return;
  }
  // 玩家"当前天空"：模型推演位置（不读取真实状态）。
  for (const ms of obs.playerModel.stars) {
    const est = obs.stars[ms.id];
    if (!est) continue;
    est.pos = { ...ms.pos };
    est.vel = { ...ms.vel };
    est.height = ms.pos.y;
    est.speed = Math.hypot(ms.vel.x, ms.vel.y, ms.vel.z);
  }
  if (obs.playerModel.planet && obs.playerModel.planet.known && obs.planet) {
    obs.planet.pos = { ...obs.playerModel.planet.pos };
    obs.planet.vel = { ...obs.playerModel.planet.vel };
    obs.planet.height = obs.playerModel.planet.pos.y;
  }
  appendObservedTrail(obs, obs.playerModel);
}

/**
 * 每个物理步调用一次：若存在观测任务，按 0.05 模拟年一批采集测量，写入 measurements /
 * observedTrail，并推进玩家模型。
 */
export function sampleTick(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState,
  dtYears: number,
  ctx: ObservationContext,
): void {
  const now = physics.timeYears;
  const level = clampLevel(ctx.level ?? obs.level);
  obs.level = level;
  obs.efficiency = clamp(Number.isFinite(ctx.efficiency) ? ctx.efficiency : obs.efficiency, 0.05, 4);
  const task = obs.activeTask;
  if (task && !task.completed) {
    const dt = Number.isFinite(dtYears) ? Math.max(0, dtYears) : 0;
    task.elapsedYears = Math.min(task.durationYears, task.elapsedYears + dt);
    const wanted = Math.min(
      Math.floor(task.durationYears / SAMPLE_INTERVAL_YEARS + 1e-9),
      Math.floor(task.elapsedYears / SAMPLE_INTERVAL_YEARS + 1e-9),
    );
    let guard = 0;
    while (task.samplesCollected < wanted && guard < 64) {
      const sampleTime = task.startedYear + (task.samplesCollected + 1) * SAMPLE_INTERVAL_YEARS;
      collectTaskSamples(obs, physics, env, ctx, task, sampleTime, level);
      guard += 1;
    }
  }
  syncPlayerModel(obs, physics, level, now);
}

export type ObservationLogCategory = "observation" | "milestone";
export interface ObservationLogEntry {
  category: ObservationLogCategory;
  severity: "info" | "success" | "warning";
  message: string;
}

export interface FinishTurnsResult {
  completed: boolean;
  logs: ObservationLogEntry[];
  discovery: string | null;
}

/** 任务完成：重建估计 / 母星估计 / 玩家模型，写观测记录并检测科学发现。 */
function completeTask(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState | null,
  level: number,
  ctx: ObservationContext,
  logs: ObservationLogEntry[],
): { discovery: string | null } {
  const now = physics.timeYears;
  const task = obs.activeTask;
  if (!task) return { discovery: null };
  const meta = taskMeta(task.kind);
  const beforeSigma = meanSigmaPos(obs.stars);

  const names = {} as Record<StarId, string>;
  const colors = {} as Record<StarId, string>;
  for (const id of STAR_IDS) {
    names[id] = obs.stars[id]?.name ?? STAR_BASE_NAMES[id] ?? id;
    colors[id] = obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff";
  }
  obs.stars = recomputeEstimates({
    level,
    stars: obs.measurements.stars,
    planet: obs.measurements.planet,
    starIds: STAR_IDS,
    starNames: names,
    starColors: colors,
    previous: obs.stars,
    seedBase: obs.seedBase,
    time: now,
  });

  const noise = noiseModel(level, measureContext(ctx, env, level));
  const measuredTemp = env ? env.surfaceTempC : (obs.planet?.tempC ?? 0);
  obs.planet = computePlanetEstimate(
    obs.measurements.planet,
    obs.planet,
    level,
    measuredTemp,
    noise.tempSigma,
    env ? env.habitability : (obs.planet?.habitability ?? 0.5),
    level >= 4,
    now,
    obs.stars,
  );

  const afterSigma = meanSigmaPos(obs.stars);
  const dataGained = Math.max(1, Math.round(levelInfo(level).dataRate * meta.dataMultiplier));
  obs.dataPoints += dataGained;
  const precisionGain = beforeSigma > 1e-6 ? clamp01(1 - afterSigma / beforeSigma) : 0;
  addHistory(obs, {
    year: now,
    kind: task.kind,
    target: task.target,
    dataGained,
    precisionGain,
    summary: meta.label + "（" + targetLabel(task.target) + "）：位置精度约 ±" + afterSigma.toFixed(4) + " AU。",
  });

  task.completed = true;
  obs.activeTask = null;
  obs.modelDirty = true;
  obs.prediction = null;
  obs.playerModel = buildPlayerModel(obs, level, now);
  obs.modelDirty = obs.playerModel === null;
  obs.lastModelSyncYear = now;

  logs.push({
    category: "observation",
    severity: "success",
    message: "观测任务完成：" + meta.label + "（" + targetLabel(task.target) + "）。数据点 +" + dataGained +
      "（累计 " + obs.dataPoints + "），当前平均位置精度 ±" + afterSigma.toFixed(4) + " AU，模型" +
      (obs.playerModel ? "已更新（置信度 " + Math.round(obs.playerModel.accuracy * 100) + "%）" : "尚不可用（缺少速度/质量信息）"),
  });

  let discoveryTitle: string | null = null;
  const newDiscoveries: Discovery[] = detectDiscoveries(obs, level, now);
  for (const d of newDiscoveries) {
    logs.push({
      category: "milestone",
      severity: "success",
      message: "科学发现《" + d.title + "》：" + d.detail + " 证据：" + d.evidence,
    });
    if (!discoveryTitle) discoveryTitle = d.title;
  }
  return { discovery: discoveryTitle };
}

/**
 * 每个文明回合调用一次（回合结算时）：推进任务回合数，达 required 时完成任务
 * （重建估计 + 写记录 + 科学发现），并做模型残差判定。返回日志与首条新发现标题。
 */
export function finishTurns(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState,
  turnsElapsed: number,
  ctx: ObservationContext,
): FinishTurnsResult {
  const logs: ObservationLogEntry[] = [];
  const now = physics.timeYears;
  const level = clampLevel(ctx.level ?? obs.level);
  obs.level = level;
  obs.efficiency = clamp(Number.isFinite(ctx.efficiency) ? ctx.efficiency : obs.efficiency, 0.05, 4);
  let discoveryTitle: string | null = null;

  // 1) 先做旧模型的残差判定（新的实测数据 vs 旧模型预测）。
  const residual = computeResiduals(obs, physics);
  if (residual.triggered && residual.discovery) {
    logs.push({
      category: "milestone",
      severity: "warning",
      message: "预测模型失效：" + residual.note + "旧的动力学模型已被新观测推翻，需要重新完成观测以重建模型。",
    });
    discoveryTitle = residual.discovery.title;
  }

  // 2) 任务进度。
  const task = obs.activeTask;
  let completed = false;
  if (task && !task.completed) {
    const turns = Number.isFinite(turnsElapsed) ? Math.max(0, turnsElapsed) : 0;
    task.turnsSpent += turns;
    task.elapsedYears = Math.max(task.elapsedYears, Math.min(task.durationYears, task.turnsSpent * TURN_YEARS));
    if (task.samplesCollected === 0) {
      // 调用方没有按步调用 sampleTick 时的兜底：至少采集一批测量，避免空任务。
      collectTaskSamples(obs, physics, env, ctx, task, now, level);
    }
    if (task.turnsSpent + 1e-9 >= task.turnsRequired) {
      completed = true;
      const result = completeTask(obs, physics, env, level, ctx, logs);
      if (result.discovery && !discoveryTitle) discoveryTitle = result.discovery;
    }
  }
  // 3) 未完成任务：同步模型到当前时间。
  if (!completed) syncPlayerModel(obs, physics, level, now);
  return { completed, logs, discovery: discoveryTitle };
}

/**
 * 无观测任务时也要推进玩家模型与观测轨迹（模型是玩家自己的推演，不消耗能源）。
 * level >=3 且模型有效时同时更新玩家"当前天空"。
 */
export function syncObservation(
  obs: ObservationState,
  physics: PhysicsState,
  env: EnvironmentState,
  dtYears: number,
  ctx: ObservationContext,
): void {
  void dtYears;
  void env;
  const level = clampLevel(ctx.level ?? obs.level);
  obs.level = level;
  obs.efficiency = clamp(Number.isFinite(ctx.efficiency) ? ctx.efficiency : obs.efficiency, 0.05, 4);
  syncPlayerModel(obs, physics, level, physics.timeYears);
}

/** 重新计算预测集成（按钮 / 回合调用）。结果缓存在 obs.prediction。 */
export function refreshPrediction(obs: ObservationState, ctx: ObservationContext): PredictionBundle | null {
  const level = clampLevel(ctx.level ?? obs.level);
  obs.level = level;
  obs.efficiency = clamp(Number.isFinite(ctx.efficiency) ? ctx.efficiency : obs.efficiency, 0.05, 4);
  if (!obs.playerModel || !obs.playerModel.valid || obs.modelDirty) {
    obs.prediction = null;
    return null;
  }
  const bundle = computePrediction(obs, level, Number.isFinite(ctx.techPredictionMultiplier) ? ctx.techPredictionMultiplier : 0, ctx.time);
  obs.prediction = bundle;
  if (bundle && bundle.diverged) {
    const last = bundle.samples[bundle.samples.length - 1];
    recordChaosSensitivity(obs, ctx.time, bundle.reliableFraction, last?.agreement ?? 0, bundle.horizonYears);
  }
  return bundle;
}

/** 标记模型需要重建（例如升级天文台或手动要求）。 */
export function markModelDirty(obs: ObservationState): void {
  obs.modelDirty = true;
  if (obs.playerModel) obs.playerModel.valid = false;
  obs.prediction = null;
}

/** 清空预测缓存。 */
export function resetPrediction(obs: ObservationState): void {
  obs.prediction = null;
}

/** 观测面板的摘要文本（中文），供日志 / HUD 使用。 */
export function buildObservationLogSummary(obs: ObservationState): { headline: string; lines: string[] } {
  const levelName = levelInfo(obs.level).name;
  const knownStars = STAR_IDS.filter((id) => obs.stars[id]?.known.position).length;
  const velocityStars = STAR_IDS.filter((id) => obs.stars[id]?.known.velocity).length;
  const lines: string[] = [];
  lines.push("观测等级：" + levelName + "（Lv." + obs.level + "），累计数据点 " + Math.round(obs.dataPoints) + "。");
  lines.push("已定位 " + knownStars + "/3 颗恒星，已测得速度 " + velocityStars + "/3 颗。");
  if (obs.planet) {
    lines.push("母星估计：距最近恒星 " + (obs.planet.distanceFromPrimary ?? 0).toFixed(2) + " AU，温度 " +
      obs.planet.tempC.toFixed(1) + " °C，高度 " + obs.planet.height.toFixed(3) + " AU。");
  } else {
    lines.push("母星尚未观测。");
  }
  if (obs.playerModel && obs.playerModel.valid) {
    lines.push("玩家模型：置信度 " + Math.round(obs.playerModel.accuracy * 100) + "%，外推窗口约 " +
      obs.playerModel.horizonYears + " 年。");
  } else if (obs.modelDirty) {
    lines.push("玩家模型：需要新的观测数据重建。");
  } else {
    lines.push("玩家模型：不可用（需要 Lv.3 以上的速度测量）。");
  }
  if (obs.activeTask) {
    lines.push("进行中：" + taskMeta(obs.activeTask.kind).label + "（" + targetLabel(obs.activeTask.target) +
      "）回合 " + obs.activeTask.turnsSpent + "/" + obs.activeTask.turnsRequired + "。");
  }
  if (obs.discoveries.length > 0) {
    lines.push("科学发现：" + obs.discoveries.length + " 项，最新《" + obs.discoveries[obs.discoveries.length - 1].title + "》。");
  }
  return { headline: levelName + " · 数据点 " + Math.round(obs.dataPoints) + " · 发现 " + obs.discoveries.length, lines };
}

/** 当前观测任务的 ViewModel 片段（便于 lead 组装 ViewModel）。 */
export function observationTaskViewData(obs: ObservationState): ObservationTaskView | null {
  const task = obs.activeTask;
  if (!task) return null;
  const meta = taskMeta(task.kind);
  return {
    id: task.id,
    kind: task.kind,
    kindLabel: OBSERVATION_KIND_LABELS[task.kind] ?? meta.label,
    targetLabel: targetLabel(task.target),
    turnsElapsed: Math.min(task.turnsSpent, task.turnsRequired),
    turnsRequired: task.turnsRequired,
    progress: clamp01(task.turnsSpent / Math.max(1, task.turnsRequired)),
    energyCost: task.energyCost,
    summary: task.summary,
  };
}

/** 预测面板的 ViewModel 片段（便于 lead 组装 ViewModel）。 */
export function predictionViewData(obs: ObservationState): PredictionView {
  const bundle = obs.prediction;
  const model = obs.playerModel;
  if (!bundle) {
    const available = Boolean(model && model.valid && !obs.modelDirty);
    return {
      available: false,
      reason: available
        ? "尚未计算预测，请点击「刷新预测」"
        : obs.modelDirty
          ? "玩家模型已失效，需要重新观测建立模型"
          : "需要 Lv.3 以上的观测数据建立三体模型",
      createdYear: null,
      horizonYears: null,
      reliableYears: null,
      note: model?.note ?? null,
      agreement: null,
      diverged: false,
      stars: [],
      planet: null,
    };
  }
  const reliableByStar = computeStarReliableYears(bundle);
  const approach = computeClosestApproach(bundle);
  const stars = bundle.samples[0]?.stars.map((s) => {
    const modelStar = model?.stars.find((m) => m.id === s.id);
    const endpoint = bundle.samples[bundle.samples.length - 1]?.stars.find((x) => x.id === s.id);
    const close = approach.stars.find((c) => c.id === s.id);
    return {
      id: s.id,
      name: modelStar?.name ?? STAR_BASE_NAMES[s.id] ?? s.id,
      color: modelStar?.color ?? STAR_COLORS[s.id] ?? "#ffffff",
      reliableYears: reliableByStar[s.id] ?? bundle.horizonYears,
      endpoint: endpoint ? projectXZ(endpoint.pos) : null,
      closestApproachAU: close && Number.isFinite(close.toBarycenterAU) ? close.toBarycenterAU : null,
      closestApproachYear: close && Number.isFinite(close.toBarycenterYear) ? close.toBarycenterYear : null,
    };
  }) ?? [];
  const lastSample = bundle.samples[bundle.samples.length - 1];
  return {
    available: true,
    reason: null,
    createdYear: bundle.createdYear,
    horizonYears: bundle.horizonYears,
    reliableYears: bundle.reliableFraction * bundle.horizonYears,
    note: bundle.note,
    agreement: lastSample?.agreement ?? null,
    diverged: bundle.diverged,
    stars,
    planet: bundle.samples.some((s) => s.planet)
      ? {
          reliableYears: bundle.reliableFraction * bundle.horizonYears,
          closestApproachAU: approach.planet && Number.isFinite(approach.planet.toNearestStarAU) ? approach.planet.toNearestStarAU : null,
          closestApproachYear: approach.planet ? approach.planet.year : null,
        }
      : null,
  };
}

/** 当前"玩家天空"的恒星位置（来自玩家模型；没有模型时返回空数组）。 */
export function currentSkyPositions(obs: ObservationState): { id: StarId; pos: Vec3 }[] {
  if (!obs.playerModel || !obs.playerModel.valid) return [];
  return obs.playerModel.stars.map((s) => ({ id: s.id, pos: { ...s.pos } }));
}

export { OBSERVATORY_LEVELS, getCapabilities, levelInfo, taskMeta, TRAIL_INTERVAL, MAX_TRAIL_RENDER_POINTS };
