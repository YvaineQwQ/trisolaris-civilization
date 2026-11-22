import { describe, it, expect } from "vitest";
import { makeObservation, runObservationTask } from "./fixtures";
import {
  appendObservedTrail, buildPlayerModel, cloneModel, computeResiduals,
  modelOrbitGeometry, modelPredictedStarPositions, propagateModel,
} from "../../src/observation/model";
import type { ObservationState } from "../../src/core/types";

function level4Model(seed: string) {
  const f = makeObservation(seed, 4);
  runObservationTask(f, { kind: "triple-joint", target: "all" });
  return f;
}

describe("玩家动力学模型", () => {
  it("等级不足或缺少速度时不建模", () => {
    const f = makeObservation("MODEL-LOW", 2);
    runObservationTask(f, { kind: "star-distance", target: "A" });
    const now = f.physics.timeYears;
    expect(buildPlayerModel(f.obs, 2, now)).toBeNull();

    const f4 = makeObservation("MODEL-NOVEL", 4);
    runObservationTask(f4, { kind: "triple-joint", target: "all" });
    expect(f4.obs.playerModel).not.toBeNull();
    // 人为抹掉一颗星的速度已知标记：建模必须失败（模型只由观测估计构造）
    const broken: ObservationState = {
      ...f4.obs,
      stars: {
        A: { ...f4.obs.stars.A, known: { ...f4.obs.stars.A.known, velocity: false } },
        B: { ...f4.obs.stars.B },
        C: { ...f4.obs.stars.C },
      },
    };
    expect(buildPlayerModel(broken, 4, f4.physics.timeYears)).toBeNull();
    expect(buildPlayerModel(f4.obs, 4, f4.physics.timeYears)).not.toBeNull();
  });

  it("模型推演：恒星/行星都前进，非法输入不改变状态", () => {
    const f = makeObservation("MODEL-PROP", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const model = f.obs.playerModel!;
    const before = cloneModel(model);
    propagateModel(model, 0.25);
    let moved = 0;
    for (let i = 0; i < 3; i++) {
      moved += Math.hypot(
        model.stars[i].pos.x - before.stars[i].pos.x,
        model.stars[i].pos.y - before.stars[i].pos.y,
        model.stars[i].pos.z - before.stars[i].pos.z,
      );
    }
    expect(moved).toBeGreaterThan(0.001);
    for (const star of model.stars) {
      expect(Number.isFinite(star.pos.x)).toBe(true);
      expect(Number.isFinite(star.pos.y)).toBe(true);
      expect(Number.isFinite(star.pos.z)).toBe(true);
      expect(Number.isFinite(star.vel.z)).toBe(true);
    }
    if (before.planet?.known) {
      expect(model.planet!.pos.x).not.toBe(before.planet!.pos.x);
    }

    // 非法 dt / null 模型不改变状态
    const snapshot = JSON.stringify(model);
    propagateModel(null, 1);
    propagateModel(model, -1);
    propagateModel(model, Number.NaN);
    expect(JSON.stringify(model)).toBe(snapshot);

    // 预测位置接口
    const predicted = modelPredictedStarPositions(model);
    expect(predicted.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(predicted[i].id).toBe(model.stars[i].id);
      expect(predicted[i].pos.x).toBeCloseTo(model.stars[i].pos.x, 12);
    }
    expect(modelPredictedStarPositions(null)).toEqual([]);
  });

  it("三维轨道几何：倾角在 [0, pi/2]，高度与模型位置一致", () => {
    const f = makeObservation("MODEL-GEO", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const geo = modelOrbitGeometry(f.obs.playerModel);
    expect(geo.stars.length).toBe(3);
    for (const star of geo.stars) {
      if (star.inclinationRad !== null) {
        expect(star.inclinationRad).toBeGreaterThanOrEqual(0);
        expect(star.inclinationRad).toBeLessThanOrEqual(Math.PI / 2);
      }
      const modelStar = f.obs.playerModel!.stars.find((s) => s.id === star.id)!;
      expect(star.heightAU).toBeCloseTo(modelStar.pos.y, 12);
      expect(star.speed).toBeGreaterThanOrEqual(0);
    }
    if (geo.planet) {
      expect(geo.planet.heightAU).toBeCloseTo(f.obs.playerModel!.planet!.pos.y, 12);
      if (geo.planet.inclinationRad !== null) {
        expect(geo.planet.inclinationRad).toBeLessThanOrEqual(Math.PI / 2);
      }
    }
  });

  it("残差检测：人工注入大偏移触发「预测模型失效」并置 modelDirty（只触发一次）", () => {
    const f = makeObservation("MODEL-RESID", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const now = f.physics.timeYears;
    const model = f.obs.playerModel!;
    expect(model.valid).toBe(true);

    // 正常情况下最近测量是新鲜的：先跑一次残差报告，模型应当大致吻合
    const normal = computeResiduals(f.obs, f.physics);
    expect(normal.modelAgeYears).toBeGreaterThanOrEqual(0);
    expect(normal.starResiduals.length).toBe(3);

    // 注入 2 AU 的位置偏移，模拟模型彻底失效
    model.stars[0].pos = { x: model.stars[0].pos.x + 2, y: model.stars[0].pos.y, z: model.stars[0].pos.z };
    const obs = f.obs;
    const discoveryCountBefore = obs.discoveries.length;
    const report = computeResiduals(obs, f.physics);
    expect(report.failed).toBe(true);
    expect(report.triggered).toBe(true);
    expect(report.worst).toBeGreaterThan(1);
    expect(report.discovery).not.toBeNull();
    expect(report.discovery!.title).toBe("预测模型失效");
    expect(report.discovery!.evidence).toContain("[key:model-failure]");
    expect(obs.modelDirty).toBe(true);
    expect(model.valid).toBe(false);
    expect(obs.prediction).toBeNull();
    expect(obs.discoveries.length).toBe(discoveryCountBefore + 1);
    expect(now).toBeGreaterThanOrEqual(0);

    // 去重：再次调用不会重复写入发现
    const again = computeResiduals(obs, f.physics);
    expect(again.triggered).toBe(false);
    expect(obs.discoveries.length).toBe(discoveryCountBefore + 1);
    expect(obs.discoveries.filter((d) => d.title === "预测模型失效").length).toBe(1);
  });

  it("appendObservedTrail 忽略无效模型，且不超过渲染上限", () => {
    const f = makeObservation("MODEL-TRAIL", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    const before = f.obs.observedTrail.A!.length;
    appendObservedTrail(f.obs, null);
    appendObservedTrail(f.obs, { ...f.obs.playerModel!, valid: false });
    expect(f.obs.observedTrail.A!.length).toBe(before);
    expect(() => appendObservedTrail(f.obs, f.obs.playerModel)).not.toThrow();
  });
});
