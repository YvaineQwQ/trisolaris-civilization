import { describe, it, expect } from "vitest";
import { makeObservation, runObservationTask } from "./fixtures";
import {
  computeClosestApproach, computePrediction, computePredictionGeometry,
  computeStarReliableYears, MAX_PREDICTION_HORIZON, PREDICTION_SAMPLE_COUNT,
} from "../../src/observation/prediction";
import { markModelDirty, predictionViewData, refreshPrediction } from "../../src/observation/observation";
import { OBSERVATORY_LEVELS } from "../../src/core/constants";
import type { StarId } from "../../src/core/types";

const STAR_IDS: StarId[] = ["A", "B", "C"];

function level4WithModel(seed: string) {
  const f = makeObservation(seed, 4);
  runObservationTask(f, { kind: "triple-joint", target: "all" });
  runObservationTask(f, { kind: "triple-joint", target: "all" });
  return f;
}

describe("预测集成（三维蒙特卡洛）", () => {
  it("预测窗口按等级与科技倍率缩放，样本结构完整", () => {
    const f = level4WithModel("PRED-STRUCT");
    const now = f.physics.timeYears;
    const level = 4;
    const tech = 0.25;
    const expectedHorizon = Math.min(
      MAX_PREDICTION_HORIZON,
      OBSERVATORY_LEVELS[level].predictionHorizon * (1 + tech),
    );
    const bundle = computePrediction(f.obs, level, tech, now);
    expect(bundle).not.toBeNull();
    expect(bundle!.createdYear).toBeCloseTo(now, 6);
    expect(bundle!.horizonYears).toBeCloseTo(expectedHorizon, 6);
    expect(bundle!.samples.length).toBe(PREDICTION_SAMPLE_COUNT);
    expect(bundle!.samples[0].t).toBeCloseTo(0, 6);
    expect(bundle!.samples[bundle!.samples.length - 1].t).toBeCloseTo(expectedHorizon, 3);
    for (const sample of bundle!.samples) {
      expect(sample.stars.length).toBe(3);
      for (const id of STAR_IDS) expect(sample.stars.some((s) => s.id === id)).toBe(true);
      for (const star of sample.stars) {
        expect(Number.isFinite(star.pos.x)).toBe(true);
        expect(Number.isFinite(star.pos.y)).toBe(true);
        expect(Number.isFinite(star.pos.z)).toBe(true);
        expect(star.sigma).toBeGreaterThanOrEqual(0);
      }
      expect(sample.agreement).toBeGreaterThanOrEqual(0);
      expect(sample.agreement).toBeLessThanOrEqual(1);
      if (sample.planet) expect(sample.planet.sigma).toBeGreaterThanOrEqual(0);
    }
    // 模型包含母星状态 -> 预测样本也应包含母星
    expect(bundle!.samples.some((s) => s.planet !== null)).toBe(true);
    // 说明文字是中文且提到混沌/不确定度
    expect(bundle!.note).toContain("混沌");
    expect(bundle!.note.length).toBeGreaterThan(10);

    // 低等级窗口更短；L6 窗口更长
    const bundle3 = computePrediction(f.obs, 3, tech, now);
    const bundle6 = computePrediction(f.obs, 6, tech, now);
    expect(bundle3!.horizonYears).toBeLessThan(bundle!.horizonYears);
    expect(bundle6!.horizonYears).toBeGreaterThan(bundle!.horizonYears);
    expect(bundle6!.horizonYears).toBeCloseTo(
      Math.min(MAX_PREDICTION_HORIZON, OBSERVATORY_LEVELS[6].predictionHorizon * (1 + tech)),
      6,
    );
  });

  it("不确定度随预测时间增长，reliableFraction / diverged 自洽", () => {
    const f = level4WithModel("PRED-GROW");
    const bundle = computePrediction(f.obs, 5, 0.1, f.physics.timeYears)!;
    const firstSigma = Math.max(...bundle.samples[0].stars.map((s) => s.sigma));
    const lastSigma = Math.max(...bundle.samples[bundle.samples.length - 1].stars.map((s) => s.sigma));
    expect(lastSigma).toBeGreaterThan(firstSigma * 1.5);
    // 至少存在某个采样点离散度超过起点
    const midSigma = Math.max(...bundle.samples[Math.floor(bundle.samples.length / 2)].stars.map((s) => s.sigma));
    expect(midSigma).toBeGreaterThanOrEqual(firstSigma);

    expect(bundle.reliableFraction).toBeGreaterThanOrEqual(0);
    expect(bundle.reliableFraction).toBeLessThanOrEqual(1);
    expect(bundle.diverged).toBe(bundle.reliableFraction < 0.5);
    // 在该混沌夹具中预测必然在窗口内发散
    expect(bundle.diverged).toBe(true);

    const reliableByStar = computeStarReliableYears(bundle);
    for (const id of STAR_IDS) {
      expect(reliableByStar[id]).toBeGreaterThanOrEqual(0);
      expect(reliableByStar[id]!).toBeLessThanOrEqual(bundle.horizonYears + 1e-6);
    }
  });

  it("确定性：同一状态/同一时刻重复计算得到一致结果", () => {
    const f = level4WithModel("PRED-DET");
    const now = f.physics.timeYears;
    const a = computePrediction(f.obs, 4, 0.2, now)!;
    const b = computePrediction(f.obs, 4, 0.2, now)!;
    expect(a.horizonYears).toBe(b.horizonYears);
    expect(a.reliableFraction).toBeCloseTo(b.reliableFraction, 10);
    expect(a.samples.length).toBe(b.samples.length);
    for (let i = 0; i < a.samples.length; i++) {
      for (let s = 0; s < 3; s++) {
        expect(a.samples[i].stars[s].pos.x).toBeCloseTo(b.samples[i].stars[s].pos.x, 10);
        expect(a.samples[i].stars[s].sigma).toBeCloseTo(b.samples[i].stars[s].sigma, 10);
      }
    }
  });

  it("最近接近与三维几何信息可用于 UI / 3D 视图与灾害预警", () => {
    const f = level4WithModel("PRED-GEO");
    const bundle = computePrediction(f.obs, 4, 0, f.physics.timeYears)!;
    const approach = computeClosestApproach(bundle);
    expect(approach.horizonYears).toBe(bundle.horizonYears);
    expect(approach.stars.length).toBe(3);
    for (const star of approach.stars) {
      expect(Number.isFinite(star.toBarycenterAU)).toBe(true);
      expect(star.toBarycenterAU).toBeGreaterThanOrEqual(0);
      expect(star.toBarycenterYear).toBeGreaterThanOrEqual(bundle.createdYear - 1e-6);
      expect(star.toBarycenterYear).toBeLessThanOrEqual(bundle.createdYear + bundle.horizonYears + 1e-6);
    }
    expect(approach.planet).not.toBeNull();
    expect(approach.planet!.toNearestStarAU).toBeGreaterThanOrEqual(0);
    expect(STAR_IDS).toContain(approach.planet!.nearestStar);

    const geo = computePredictionGeometry(bundle);
    expect(geo.stars.length).toBe(3);
    expect(geo.horizonYears).toBe(bundle.horizonYears);
    expect(geo.diverged).toBe(bundle.diverged);
    expect(geo.reliableYears).toBeCloseTo(bundle.reliableFraction * bundle.horizonYears, 6);
    for (const star of geo.stars) {
      expect(star.reliableYears).toBeGreaterThanOrEqual(0);
      expect(star.reliableYears).toBeLessThanOrEqual(bundle.horizonYears + 1e-6);
      expect(Number.isFinite(star.heightNowAU)).toBe(true);
      expect(star.maxHeightAU).toBeGreaterThanOrEqual(star.minHeightAU);
      if (star.inclinationRad !== null) {
        expect(star.inclinationRad).toBeGreaterThanOrEqual(0);
        expect(star.inclinationRad).toBeLessThanOrEqual(Math.PI / 2);
      }
    }
    expect(geo.planet).not.toBeNull();
    expect(geo.planet!.maxHeightAU).toBeGreaterThanOrEqual(geo.planet!.minHeightAU);
    // 无预测时返回安全默认值
    expect(computeClosestApproach(null).stars).toEqual([]);
    expect(computePredictionGeometry(null).stars).toEqual([]);
  });

  it("refreshPrediction 缓存预测并产生混沌敏感性发现；模型失效后不可预测", () => {
    const f = level4WithModel("PRED-CACHE");
    const ctx = { ...f.ctx, level: 4, techPredictionMultiplier: 0.15, time: f.physics.timeYears };
    const bundle = refreshPrediction(f.obs, ctx);
    expect(bundle).not.toBeNull();
    expect(f.obs.prediction).toBe(bundle);
    expect(f.obs.discoveries.some((d) => d.title === "混沌敏感性确认")).toBe(true);
    const view = predictionViewData(f.obs);
    expect(view.available).toBe(true);
    expect(view.horizonYears).toBeCloseTo(bundle!.horizonYears, 6);
    expect(view.stars.length).toBe(3);
    for (const star of view.stars) {
      expect(star.reliableYears).toBeGreaterThanOrEqual(0);
      expect(star.endpoint).not.toBeNull();
      expect(Number.isFinite(star.endpoint!.x)).toBe(true);
      expect(Number.isFinite(star.endpoint!.y)).toBe(true);
    }
    expect(view.planet).not.toBeNull();

    // 模型失效后预测不可用
    markModelDirty(f.obs);
    expect(refreshPrediction(f.obs, ctx)).toBeNull();
    expect(f.obs.prediction).toBeNull();
    const unavailable = predictionViewData(f.obs);
    expect(unavailable.available).toBe(false);
    expect(unavailable.reason).toContain("模型");

    // 没有模型（低等级）时也为 null
    const low = makeObservation("PRED-LOW", 1);
    expect(computePrediction(low.obs, 1, 0, low.physics.timeYears)).toBeNull();
  });

  it("性能：单次预测集成（含母星）在交互可接受时间内完成", () => {
    const f = level4WithModel("PRED-PERF");
    const now = f.physics.timeYears;
    computePrediction(f.obs, 4, 0.2, now); // 预热 JIT
    const t0 = performance.now();
    const bundle = computePrediction(f.obs, 4, 0.2, now);
    const elapsed = performance.now() - t0;
    expect(bundle).not.toBeNull();
    // 目标 <50ms；测试环境较慢，用例放宽到 500ms 防止 CI 抖动
    expect(elapsed).toBeLessThan(500);
    const t1 = performance.now();
    computePrediction(f.obs, 6, 0.2, now);
    const elapsed6 = performance.now() - t1;
    expect(elapsed6).toBeLessThan(500);
  });
});
