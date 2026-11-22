import { describe, expect, it } from "vitest";
import { generateGalaxy } from "../../src/generation/galaxy";
import { advancePhysics, createPhysicsState } from "../../src/physics/nbody";

function fingerprint(g: ReturnType<typeof generateGalaxy>): string {
  return g.starInits
    .map((s) => [s.mass.toFixed(6), s.pos.x.toFixed(6), s.pos.y.toFixed(6), s.pos.z.toFixed(6), s.vel.x.toFixed(6), s.vel.y.toFixed(6), s.vel.z.toFixed(6)].join(","))
    .join("|") + "||" + g.planetInit.pos.x.toFixed(6) + "," + g.planetInit.pos.y.toFixed(6) + "," + g.planetInit.pos.z.toFixed(6) + "," + g.planetInit.name;
}

describe("random 3D galaxy generation", () => {
  it("is deterministic for the same seed", () => {
    const a = generateGalaxy("TRISOLAR-82", "normal");
    const b = generateGalaxy("TRISOLAR-82", "normal");
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(a.classification.kind).toBe(b.classification.kind);
  });

  it("produces different systems for different seeds", () => {
    const a = generateGalaxy("SEED-ALPHA", "normal");
    const b = generateGalaxy("SEED-BETA", "normal");
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it("generates genuinely 3D systems (not a flat plane)", () => {
    const g = generateGalaxy("3D-CHECK", "normal");
    const ys = g.preview.stars.map((s) => s.pos.y);
    const maxY = Math.max(...ys.map(Math.abs));
    const zs = g.preview.stars.map((s) => s.pos.z);
    const maxZ = Math.max(...zs.map(Math.abs));
    expect(maxY).toBeGreaterThan(0.05);
    expect(maxZ).toBeGreaterThan(0.2);
    expect(g.preview.planet.inclinationDeg).toBeGreaterThanOrEqual(0);
  });

  it("screened systems survive the real integrator", () => {
    const g = generateGalaxy("SCREEN-CHECK", "normal");
    const p = createPhysicsState(g.starInits, g.planetInit);
    advancePhysics(p, 50);
    expect(p.diagnostics.overflow).toBe(false);
    expect(p.planetAlive).toBe(true);
    expect(p.planetEjected).toBe(false);
    expect(Number.isFinite(p.planet.pos.z)).toBe(true);
  });

  it("classifies from physical metrics, not a random label", () => {
    const g = generateGalaxy("CLASSIFY-1", "hard");
    expect(["stable", "chaotic", "extreme", "special"]).toContain(g.classification.kind);
    expect(g.classification.metrics.meanFlux).toBeGreaterThan(0);
    expect(g.classification.chaosIndex).toBeGreaterThanOrEqual(0);
    expect(g.classification.metrics.screenedCandidates).toBeGreaterThan(0);
  });

  it("preview contains 3D trajectories and a habitable planet", () => {
    const g = generateGalaxy("PREVIEW-9", "easy");
    expect(g.preview.trajectories.A!.length).toBeGreaterThan(10);
    expect(g.preview.trajectories.B!.some((p) => Math.abs(p.y) > 0 || Math.abs(p.z) > 0)).toBe(true);
    expect(g.preview.planet.habitability).toBeGreaterThan(0);
    expect(g.preview.seed).toBe("PREVIEW-9");
  });

  it("generation is fast enough for an interactive start screen", () => {
    const t0 = Date.now();
    generateGalaxy("PERF-1", "normal");
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
