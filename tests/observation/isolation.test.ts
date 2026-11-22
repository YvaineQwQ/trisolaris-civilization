import { describe, it, expect } from "vitest";
import {
  advancePhysicsYears, makeCtx, makeObservation, makeTestSystem, runObservationTask, trueStateErrors,
} from "./fixtures";
import { createObservationState } from "../../src/observation/observation";
import { recomputeEstimates } from "../../src/observation/estimator";
import { sampleStarMeasurements, type MeasurementContext } from "../../src/observation/measurements";
import { cloneModel, propagateModel } from "../../src/observation/model";
import type { StarId, StarMeasurement } from "../../src/core/types";

const STAR_IDS: StarId[] = ["A", "B", "C"];

describe("观测数据隔离与等级误差", () => {
  it("开局肉眼观测只有粗略位置：无速度/质量，误差与 sigma 同量级", () => {
    const f = makeObservation("ISO-NAKED", 1);
    const { obs } = f;
    expect(obs.measurements.stars.length).toBe(3);
    expect(obs.measurements.planet.length).toBe(1);

    for (const m of obs.measurements.stars) {
      // 肉眼 sigma 随距离增大，约 0.25 ~ 0.6 AU
      expect(m.posSigma).toBeGreaterThanOrEqual(0.24);
      expect(m.posSigma).toBeLessThanOrEqual(0.61);
      expect(m.vel).toBeUndefined();
      expect(m.mass).toBeUndefined();
    }
    expect(obs.measurements.planet[0].posSigma).toBeLessThan(0.15);

    for (const id of STAR_IDS) {
      const est = obs.stars[id];
      expect(est.known.position).toBe(true);
      expect(est.known.velocity).toBe(false);
      expect(est.known.mass).toBe(false);
      expect(est.speed).toBe(0);
      expect(est.confidence).toBeLessThan(0.2);
      expect(est.height).toBeCloseTo(est.pos.y, 12);
    }
    // 低等级不建立动力学模型
    expect(obs.playerModel).toBeNull();
    expect(obs.modelDirty).toBe(true);

    // 观测轨迹起点 = 实际测量点
    for (const id of STAR_IDS) expect(obs.observedTrail[id]?.length).toBe(1);
    expect(obs.planetObservedTrail.length).toBe(1);
    expect(obs.planet?.tempC).toBeTypeOf("number");

    // 估计不等于真值（这是观测，不是全知），且误差与测量精度同量级
    const errors = trueStateErrors(f);
    for (const id of STAR_IDS) {
      expect(errors.starPosError[id]).toBeGreaterThan(0.01);
      expect(errors.starPosError[id]).toBeLessThan(4 * obs.stars[id].sigmaPos + 0.1);
    }
  });

  it("同一段真实轨迹：等级越高位置/速度误差越小（测量噪声 + 估计器）", () => {
    const system = makeTestSystem();
    const obsL1 = createObservationState("ISO-SCALE-L1", 0);
    const obsL4 = createObservationState("ISO-SCALE-L4", 0);
    const mcL1: MeasurementContext = { level: 1, difficultyNoise: 1, weather: "clear", efficiency: 1, techObservationMultiplier: 0 };
    const mcL4: MeasurementContext = { level: 4, difficultyNoise: 1, weather: "clear", efficiency: 1, techObservationMultiplier: 0 };
    const samplesL1: StarMeasurement[] = [];
    const samplesL4: StarMeasurement[] = [];
    const bias = { x: 0.4, y: -0.5, z: 0.3 };
    for (let k = 0; k < 40; k++) {
      advancePhysicsYears(system, 0.05);
      const t = system.physics.timeYears;
      const base = {
        kind: "star-position" as const,
        targets: STAR_IDS,
        sessionBias: bias,
        sampleIndex: k,
        sigmaMultiplier: 1,
      };
      samplesL1.push(...sampleStarMeasurements(system.physics, mcL1, { id: "iso-scale-l1", ...base }, t));
      samplesL4.push(...sampleStarMeasurements(system.physics, mcL4, { id: "iso-scale-l4", ...base }, t));
    }
    const now = system.physics.timeYears;
    const names = { A: obsL1.stars.A.name, B: obsL1.stars.B.name, C: obsL1.stars.C.name } as Record<StarId, string>;
    const colors = { A: obsL1.stars.A.color, B: obsL1.stars.B.color, C: obsL1.stars.C.color } as Record<StarId, string>;
    const estL1 = recomputeEstimates({
      level: 1, stars: samplesL1, planet: null, starIds: STAR_IDS,
      starNames: names, starColors: colors, previous: obsL1.stars, seedBase: "iso-scale-l1", time: now,
    });
    const estL4 = recomputeEstimates({
      level: 4, stars: samplesL4, planet: null, starIds: STAR_IDS,
      starNames: names, starColors: colors, previous: obsL4.stars, seedBase: "iso-scale-l4", time: now,
    });

    // 低等级没有速度/质量，高等级具备
    expect(estL1.A.known.velocity).toBe(false);
    expect(estL1.A.known.mass).toBe(false);
    expect(estL1.A.speed).toBe(0);
    expect(estL4.A.known.velocity).toBe(true);
    expect(estL4.A.known.mass).toBe(true);
    expect(estL4.A.speed).toBeGreaterThan(0);

    const truePos = (id: StarId) => {
      const star = system.physics.stars.find((s) => s.id === id)!;
      return star.pos;
    };
    const trueVel = (id: StarId) => system.physics.stars.find((s) => s.id === id)!.vel;
    let errL1 = 0, errL4 = 0, velErrL4 = 0, velErrL1 = 0;
    for (const id of STAR_IDS) {
      const t = truePos(id);
      errL1 += Math.hypot(estL1[id].pos.x - t.x, estL1[id].pos.y - t.y, estL1[id].pos.z - t.z);
      errL4 += Math.hypot(estL4[id].pos.x - t.x, estL4[id].pos.y - t.y, estL4[id].pos.z - t.z);
      const v = trueVel(id);
      velErrL1 += Math.hypot(estL1[id].vel.x - v.x, estL1[id].vel.y - v.y, estL1[id].vel.z - v.z);
      velErrL4 += Math.hypot(estL4[id].vel.x - v.x, estL4[id].vel.y - v.y, estL4[id].vel.z - v.z);
    }
    errL1 /= 3; errL4 /= 3; velErrL1 /= 3; velErrL4 /= 3;
    const meanSigma = (est: typeof estL1) => (est.A.sigmaPos + est.B.sigmaPos + est.C.sigmaPos) / 3;

    expect(meanSigma(estL4)).toBeLessThan(meanSigma(estL1) / 5);
    expect(errL4).toBeLessThan(errL1 / 5);
    expect(velErrL4).toBeLessThan(velErrL1); // 低等级速度估计为 0，误差 = 真实速度
    // 高等级误差与报告的 sigma 同量级（不能既精确又声称不确定）
    expect(errL4).toBeLessThan(6 * meanSigma(estL4));
    expect(errL4).toBeGreaterThan(0.01 * meanSigma(estL4));
    // 速度误差与 sigmaVel 同量级
    const meanSigmaVel = (estL4.A.sigmaVel + estL4.B.sigmaVel + estL4.C.sigmaVel) / 3;
    expect(velErrL4).toBeLessThan(8 * meanSigmaVel + 0.05);
  });

  it("玩家模型只由观测估计驱动：篡改真实物理不影响模型推演", () => {
    const f = makeObservation("ISO-MODEL", 4);
    runObservationTask(f, { kind: "triple-joint", target: "all" });
    expect(f.obs.playerModel).not.toBeNull();
    const model = f.obs.playerModel!;
    expect(model.valid).toBe(true);

    // 模型位置与真实状态不同（隔离：模型不是真实状态）
    let differsFromTruth = 0;
    for (const star of f.physics.stars) {
      const m = model.stars.find((s) => s.id === star.id)!;
      differsFromTruth += Math.hypot(m.pos.x - star.pos.x, m.pos.y - star.pos.y, m.pos.z - star.pos.z);
    }
    expect(differsFromTruth).toBeGreaterThan(0);

    // 用克隆预算出"干净的推演结果"，然后篡改真实物理，模型推演必须不受影响
    const expected = cloneModel(model);
    propagateModel(expected, 0.4);
    for (const star of f.physics.stars) {
      star.pos.x += 7.5;
      star.pos.y -= 3.25;
      star.pos.z += 11;
    }
    propagateModel(model, 0.4);
    for (let i = 0; i < 3; i++) {
      expect(model.stars[i].pos.x).toBeCloseTo(expected.stars[i].pos.x, 8);
      expect(model.stars[i].pos.y).toBeCloseTo(expected.stars[i].pos.y, 8);
      expect(model.stars[i].pos.z).toBeCloseTo(expected.stars[i].pos.z, 8);
    }
  });
});