import { describe, it, expect } from "vitest";
import {
  advanceObservationTurn, makeObservation, runObservationTask, runIdleTurns,
} from "./fixtures";
import {
  buildObservationLogSummary, canStartObservation, cancelObservation, createObservationState,
  markModelDirty, observationTaskViewData, performNakedEyeCalibration, predictionViewData,
  refreshPrediction, resetPrediction, startObservation,
} from "../../src/observation/observation";
import { appendObservedTrail } from "../../src/observation/model";
import { levelInfo } from "../../src/observation/observatory";
import { MAX_TRAIL_RENDER_POINTS } from "../../src/core/constants";
import type { StarId } from "../../src/core/types";

const STAR_IDS: StarId[] = ["A", "B", "C"];

describe("观测编排器：等级能力、任务进度、轨迹与发现", () => {
  it("低等级任务：只有位置，没有速度/质量，轨迹只有测量点", () => {
    const f = makeObservation("OBS-L1", 1);
    const result = runObservationTask(f, { kind: "star-position", target: "A" });
    expect(result.start.ok).toBe(true);
    const task = result.start.task!;
    expect(task.completed).toBe(true);
    expect(task.turnsRequired).toBe(1);
    expect(task.energyCost).toBe(levelInfo(1).energyCost);

    // 每 0.05 年一批：肉眼 1 批 + 任务 10 批
    const aMeasurements = f.obs.measurements.stars.filter((m) => m.starId === "A");
    expect(aMeasurements.length).toBe(11);
    expect(aMeasurements.every((m) => m.vel === undefined && m.mass === undefined)).toBe(true);

    expect(f.obs.stars.A.known.position).toBe(true);
    expect(f.obs.stars.A.known.velocity).toBe(false);
    expect(f.obs.stars.A.known.mass).toBe(false);
    expect(f.obs.playerModel).toBeNull();
    expect(f.obs.modelDirty).toBe(true);
    // level < 3：观测轨迹只包含实际测量点
    expect(f.obs.observedTrail.A?.length).toBe(11);
    expect(f.obs.observedTrail.A?.every((p) => Number.isFinite(p.z))).toBe(true);

    // 记录与数据点
    expect(f.obs.history.length).toBe(2); // 肉眼校准 + 完成任务
    expect(f.obs.history[1].dataGained).toBeGreaterThan(0);
    expect(f.obs.dataPoints).toBeGreaterThan(0);
    expect(result.logs.some((l) => l.category === "observation" && l.severity === "success")).toBe(true);
    // 低等级不会产生模型类发现
    expect(f.obs.playerModel).toBeNull();
    expect(f.obs.planet?.known.velocity).toBe(false);
  });

  it("升级到 L4 后具备速度/质量/轨道能力，并建立三维玩家模型", () => {
    const f = makeObservation("OBS-L4", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const second = runObservationTask(f, { kind: "triple-joint", target: "all" });
    expect(second.start.ok).toBe(true);

    for (const id of STAR_IDS) {
      const est = f.obs.stars[id];
      expect(est.known.position).toBe(true);
      expect(est.known.velocity).toBe(true);
      expect(est.known.mass).toBe(true);
      expect(est.known.acceleration).toBe(true);
      expect(est.known.orbit).toBe(true);
      expect(est.sampleCount).toBeGreaterThan(20);
      // 三维高度与倾角
      expect(est.height).toBeCloseTo(est.pos.y, 12);
      expect(est.inclinationRad).not.toBeNull();
      expect(est.inclinationRad!).toBeGreaterThanOrEqual(0);
      expect(est.inclinationRad!).toBeLessThanOrEqual(Math.PI / 2);
      expect(est.speed).toBeGreaterThan(0);
    }
    // 测量中带有三维速度/质量
    const sample = f.obs.measurements.stars[f.obs.measurements.stars.length - 1];
    expect(sample.vel).toBeDefined();
    expect(sample.velSigma).toBeGreaterThan(0);
    expect(sample.mass).toBeDefined();

    const model = f.obs.playerModel;
    expect(model).not.toBeNull();
    expect(model!.valid).toBe(true);
    expect(model!.stars.length).toBe(3);
    expect(model!.accuracy).toBeGreaterThan(0.5);
    expect(model!.accuracy).toBeLessThanOrEqual(1);
    expect(model!.horizonYears).toBe(levelInfo(4).predictionHorizon);
    expect(model!.note).toContain("三维");
    expect(model!.planet).not.toBeNull();
    expect(model!.planet!.known).toBe(true);

    expect(f.obs.planet?.known.position).toBe(true);
    expect(f.obs.planet?.known.velocity).toBe(true);
    expect(f.obs.planet?.height).toBeCloseTo(f.obs.planet!.pos.y, 12);
    expect(f.obs.planet?.inclinationRad).not.toBeNull();

    // 有模型后观测轨迹包含模型推演点（数量大于纯测量点）
    const measuredA = f.obs.measurements.stars.filter((m) => m.starId === "A").length;
    expect(f.obs.observedTrail.A!.length).toBeGreaterThan(measuredA);
    expect(f.obs.observedTrail.A!.every((p) => Number.isFinite(p.z))).toBe(true);

    // 历史与数据点
    expect(f.obs.history.length).toBe(3);
    expect(f.obs.dataPoints).toBeGreaterThan(50);
  });

  it("finishTurns 逐回合推进任务进度，完成时返回日志与记录", () => {
    const f = makeObservation("OBS-PROGRESS", 4);
    const started = startObservation(f.obs, f.physics, 4, "triple-joint", "all", f.physics.timeYears, 100000);
    expect(started.ok).toBe(true);
    expect(f.obs.activeTask).not.toBeNull();
    // L4 三星联合观测需要 2 + 1 = 3 个回合
    expect(started.task!.turnsRequired).toBe(3);

    const turn1 = advanceObservationTurn(f);
    expect(turn1.completed).toBe(false);
    expect(f.obs.activeTask?.turnsSpent).toBe(1);
    expect(f.obs.activeTask?.completed).toBe(false);
    expect(f.obs.activeTask?.samplesCollected).toBe(10);

    const turn2 = advanceObservationTurn(f);
    expect(turn2.completed).toBe(false);
    expect(f.obs.activeTask?.turnsSpent).toBe(2);

    const turn3 = advanceObservationTurn(f);
    expect(turn3.completed).toBe(true);
    expect(f.obs.activeTask).toBeNull();
    expect(turn3.logs.length).toBeGreaterThan(0);
    expect(f.obs.tasks.length).toBe(1);
    expect(f.obs.tasks[0].completed).toBe(true);
    expect(f.obs.playerModel).not.toBeNull();
  });

  it("观测轨迹长度上限与三维点格式", () => {
    const f = makeObservation("OBS-TRAIL", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const model = f.obs.playerModel;
    expect(model).not.toBeNull();
    for (let i = 0; i < 1000; i++) appendObservedTrail(f.obs, model!);
    for (const id of STAR_IDS) {
      expect(f.obs.observedTrail[id]!.length).toBeLessThanOrEqual(MAX_TRAIL_RENDER_POINTS);
      const p = f.obs.observedTrail[id]![0];
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
    expect(f.obs.planetObservedTrail.length).toBeLessThanOrEqual(MAX_TRAIL_RENDER_POINTS);
  });

  it("科学发现：有证据、去重、年份有序", () => {
    const f = makeObservation("OBS-DISC", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    runIdleTurns(f, 1);

    const discoveries = f.obs.discoveries;
    expect(discoveries.length).toBeGreaterThan(0);
    expect(discoveries.length).toBeLessThanOrEqual(40);
    const titles = new Set<string>();
    let lastId = 0;
    for (const d of discoveries) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.evidence.length).toBeGreaterThan(0);
      expect(d.evidence).toContain("[key:");
      expect(d.year).toBeGreaterThanOrEqual(0);
      expect(["orbit", "environment", "anomaly", "planet", "system"]).toContain(d.category);
      expect(titles.has(d.title)).toBe(false);
      titles.add(d.title);
      expect(d.id).toBeGreaterThan(lastId);
      lastId = d.id;
    }
    // 三维倾斜轨道结构在 L4 应当被发现（夹具中恒星轨道倾角 25°/35°/18°）
    expect(titles.has("倾斜轨道结构")).toBe(true);

    // 继续观测不会重复写入同名发现
    const before = discoveries.length;
    runObservationTask(f, { kind: "anomaly", target: "A" });
    const afterTitles = f.obs.discoveries.map((d) => d.title);
    expect(new Set(afterTitles).size).toBe(afterTitles.length);
    expect(f.obs.discoveries.length).toBeGreaterThanOrEqual(before);
  });

  it("startObservation / canStartObservation / cancelObservation 的校验逻辑", () => {
    const f = makeObservation("OBS-API", 2);
    const obs = f.obs;

    // 等级不足
    const lowLevel = canStartObservation(obs, 0, 100000, "star-position");
    expect(lowLevel.ok).toBe(false);
    expect(lowLevel.reason).toContain("等级");

    // 能源不足
    const noEnergy = canStartObservation(obs, 2, 0, "star-position");
    expect(noEnergy.ok).toBe(false);
    expect(noEnergy.reason).toContain("能源");

    // 单星任务必须指定恒星
    const badTarget = startObservation(obs, f.physics, 2, "star-position", "all", 0, 100000);
    expect(badTarget.ok).toBe(false);
    expect(badTarget.reason).toContain("恒星");

    // 正常开始
    const started = startObservation(obs, f.physics, 2, "binary-relative", "all", 0, 100000);
    expect(started.ok).toBe(true);
    expect(obs.activeTask).not.toBeNull();
    expect(started.task!.target).toBe("all");
    expect(started.task!.sessionBias).toBeDefined();
    expect(Number.isFinite(started.task!.sessionBias.z)).toBe(true);

    // 已有任务时不能再开始
    const busy = canStartObservation(obs, 2, 100000, "star-position");
    expect(busy.ok).toBe(false);
    expect(busy.reason).toContain("进行中");

    // 任务视图
    const view = observationTaskViewData(obs);
    expect(view).not.toBeNull();
    expect(view!.kindLabel).toBe("双星相对观测");
    expect(view!.targetLabel).toBe("三颗恒星");
    expect(view!.turnsRequired).toBeGreaterThan(0);
    expect(view!.progress).toBe(0);

    // 取消
    const cancelled = cancelObservation(obs);
    expect(cancelled).not.toBeNull();
    expect(obs.activeTask).toBeNull();
    expect(observationTaskViewData(obs)).toBeNull();

    // 摘要文本
    const summary = buildObservationLogSummary(obs);
    expect(summary.lines.length).toBeGreaterThan(2);
    expect(summary.headline.length).toBeGreaterThan(0);

    // 低等级没有预测
    expect(refreshPrediction(obs, { ...f.ctx, level: 2 })).toBeNull();
    expect(predictionViewData(obs).available).toBe(false);
    markModelDirty(obs);
    expect(obs.modelDirty).toBe(true);
    resetPrediction(obs);
    expect(obs.prediction).toBeNull();
  });

  it("createObservationState 是纯状态工厂，重复肉眼校准幂等", () => {
    const obs = createObservationState("OBS-FACTORY", 0);
    expect(obs.level).toBe(0);
    expect(obs.stars.A.known.position).toBe(false);
    expect(obs.tasks.length).toBe(0);
    expect(obs.discoveries.length).toBe(0);
    expect(obs.playerModel).toBeNull();
    expect(obs.observedTrail.A?.length).toBe(0);

    const f = makeObservation("OBS-IDEMPOTENT", 1);
    const before = f.obs.measurements.stars.length;
    const beforeTrail = f.obs.observedTrail.A!.length;
    performNakedEyeCalibration(f.obs, f.physics, f.env, f.ctx);
    performNakedEyeCalibration(f.obs, f.physics, f.env, f.ctx);
    expect(f.obs.measurements.stars.length).toBe(before);
    expect(f.obs.observedTrail.A!.length).toBe(beforeTrail);
  });
});
