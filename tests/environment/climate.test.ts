import { describe, expect, it } from "vitest";
import { computeStellarFlux, equilibriumTemperatureC, createEnvironmentState, updateEnvironment, habitabilityScore } from "../../src/environment/climate";
import { createPhysicsState, advancePhysics } from "../../src/physics/nbody";
import { v3 } from "../../src/core/math";

function system(planetPos = v3(1, 0, 0)) {
  return createPhysicsState(
    [
      { id: "A", name: "A", mass: 1, radius: 0.0046, luminosity: 1, surfaceTempK: 5772, color: "#f00", pos: v3(0, 0, 0), vel: v3(0, 0, 0) },
      { id: "B", name: "B", mass: 0.8, radius: 0.004, luminosity: 0.5, surfaceTempK: 5200, color: "#0ff", pos: v3(30, 4, 0), vel: v3(0, 0, 0) },
      { id: "C", name: "C", mass: 0.6, radius: 0.0035, luminosity: 0.2, surfaceTempK: 4500, color: "#a0f", pos: v3(40, 10, 12), vel: v3(0, 0, 0) },
    ],
    { name: "P", mass: 1, radiusKm: 6371, pos: planetPos, vel: v3(0, 0, 0), albedo: 0.3, greenhouseK: 33, thermalTauYears: 0.2, water: 0.8, atmosphere: 1, ecology: 0.7 },
  );
}

describe("climate system in 3D", () => {
  it("computes inverse-square flux from all stars using 3D distances", () => {
    const s = system(v3(1, 0, 0));
    const flux = computeStellarFlux(s.planet.pos, s.stars);
    expect(flux.total).toBeGreaterThan(0.9);
    expect(flux.total).toBeLessThan(1.1);
    expect(flux.byStar.A).toBeCloseTo(1, 3);
  });

  it("height above the reference plane changes irradiation", () => {
    const low = system(v3(1, 0, 0));
    const high = system(v3(1, 2, 0));
    const fLow = computeStellarFlux(low.planet.pos, low.stars).total;
    const fHigh = computeStellarFlux(high.planet.pos, high.stars).total;
    expect(fHigh).toBeLessThan(fLow);
  });

  it("responds to stellar motion through the real physics loop", () => {
    const s = system(v3(3, 0, 0));
    const env = createEnvironmentState(s);
    const t0 = env.surfaceTempC;
    s.planet.pos = v3(0.9, 0, 0);
    updateEnvironment(env, s, 0.05);
    expect(env.surfaceTempC).toBeGreaterThan(t0);
    expect(env.stellarFlux).toBeGreaterThan(1);
  });

  it("has thermal inertia: surface temperature does not jump instantly", () => {
    const s = system(v3(1, 0, 0));
    const env = createEnvironmentState(s);
    s.planet.pos = v3(0.4, 0, 0);
    updateEnvironment(env, s, 0.001);
    expect(Math.abs(env.equilibriumTempC - env.surfaceTempC)).toBeGreaterThan(1);
    expect(Math.abs(env.surfaceTempC - 14)).toBeLessThan(40);
  });

  it("reduces habitability under extreme temperatures", () => {
    const good = habitabilityScore(16, 0.8, 1, 1, 0.8);
    const hot = habitabilityScore(140, 0.8, 1, 6, 0.8);
    const cold = habitabilityScore(-90, 0.8, 1, 0.05, 0.8);
    expect(good).toBeGreaterThan(0.5);
    expect(hot).toBeLessThan(good);
    expect(cold).toBeLessThan(good);
  });

  it("keeps environment finite during a long simulated run", () => {
    const s = system(v3(3.2, 0.4, 0));
    const env = createEnvironmentState(s);
    for (let i = 0; i < 400; i++) {
      advancePhysics(s, 0.25);
      updateEnvironment(env, s, 0.25);
    }
    expect(Number.isFinite(env.surfaceTempC)).toBe(true);
    expect(env.habitability).toBeGreaterThanOrEqual(0);
    expect(env.habitability).toBeLessThanOrEqual(1);
  });
});
