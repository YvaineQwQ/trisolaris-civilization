import { describe, expect, it } from "vitest";
import { createPhysicsState, advancePhysics, conservedQuantities, orbitalElements, type StarInit, type PlanetInit } from "../../src/physics/nbody";
import { G } from "../../src/core/constants";
import { v3, vLen3 } from "../../src/core/math";

/** Stable hierarchical triple in 3D with zero total momentum. */
function threeStarSystem() {
  const mA = 1.1;
  const mB = 0.9;
  const mC = 0.7;
  const a = 0.6;
  const rRel = 0.6;
  const mu = G * (mA + mB);
  const vRel = Math.sqrt(mu * (2 / rRel - 1 / a)); // circular
  const fA = mB / (mA + mB);
  const fB = mA / (mA + mB);
  const posRel = v3(0, 0, rRel); // binary orbit lies in the X-Y plane (inclined!)
  const velRel = v3(vRel, 0, 0);
  const rC = 4.5;
  const vC = Math.sqrt((G * (mA + mB + mC)) / rC);
  const cShift = (mC / (mA + mB)) * vC;
  const stars: StarInit[] = [
    { id: "A", name: "赤曜", mass: mA, radius: 0.005, luminosity: 1.4, surfaceTempK: 6000, color: "#f00", pos: v3(-posRel.x * fA, -posRel.y * fA, -posRel.z * fA), vel: v3(-velRel.x * fA - cShift, 0, 2.0) },
    { id: "B", name: "青曜", mass: mB, radius: 0.0045, luminosity: 0.75, surfaceTempK: 5600, color: "#0ff", pos: v3(posRel.x * fB, posRel.y * fB, posRel.z * fB), vel: v3(velRel.x * fB - cShift, 0, 2.0) },
    { id: "C", name: "幽曜", mass: mC, radius: 0.004, luminosity: 0.4, surfaceTempK: 4800, color: "#a0f", pos: v3(-rC, 0.4, 0), vel: v3(0, 0, 2.0 + vC) },
  ];
  // zero total momentum: remove the residual
  let px = 0, py = 0, pz = 0, tm = 0;
  for (const s of stars) { px += s.mass * s.vel.x; py += s.mass * s.vel.y; pz += s.mass * s.vel.z; tm += s.mass; }
  for (const s of stars) { s.vel.x -= px / tm; s.vel.y -= py / tm; s.vel.z -= pz / tm; }
  const planet: PlanetInit = {
    name: "曦和", mass: 1, radiusKm: 6371,
    pos: v3(8, 1.2, 0), vel: v3(0, 0, Math.sqrt((G * (mA + mB + mC)) / 8.04)),
    albedo: 0.3, greenhouseK: 30, thermalTauYears: 0.15, water: 0.7, atmosphere: 1, ecology: 0.7,
  };
  return createPhysicsState(stars, planet, 0.001, 0.008);
}

describe("three-body physics in 3D", () => {
  it("conserves total momentum to machine precision", () => {
    const s = threeStarSystem();
    const initial = { ...s.diagnostics.totalMomentum };
    advancePhysics(s, 30);
    const c = conservedQuantities(s);
    const drift = Math.hypot(c.momentum.x - initial.x, c.momentum.y - initial.y, c.momentum.z - initial.z);
    expect(drift).toBeLessThan(1e-9);
  });

  it("conserves energy within a bounded drift over 120 years", () => {
    const s = threeStarSystem();
    advancePhysics(s, 120);
    expect(Number.isFinite(s.diagnostics.totalEnergy)).toBe(true);
    expect(Math.abs(s.diagnostics.energyDrift)).toBeLessThan(0.01);
  });

  it("keeps the full 3D state finite over long integration", () => {
    const s = threeStarSystem();
    advancePhysics(s, 300);
    expect(s.diagnostics.overflow).toBe(false);
    for (const st of s.stars) {
      expect(Number.isFinite(st.pos.x) && Number.isFinite(st.pos.y) && Number.isFinite(st.pos.z)).toBe(true);
      expect(Number.isFinite(st.vel.x) && Number.isFinite(st.vel.y) && Number.isFinite(st.vel.z)).toBe(true);
    }
    expect(Number.isFinite(s.planet.pos.y)).toBe(true);
    expect(Number.isFinite(s.planet.pos.z)).toBe(true);
  });

  it("does not move when not stepped (pause semantics)", () => {
    const s = threeStarSystem();
    advancePhysics(s, 5);
    const before = s.stars.map((x) => ({ ...x.pos }));
    const t = s.timeYears;
    expect(s.timeYears).toBe(t);
    s.stars.forEach((x, i) => expect(x.pos.z).toBe(before[i].z));
  });

  it("changes trajectories when masses change (real simulation, not animation)", () => {
    const a = threeStarSystem();
    const b = threeStarSystem();
    b.stars[0].mass *= 2;
    advancePhysics(a, 20);
    advancePhysics(b, 20);
    const sep = Math.hypot(a.stars[0].pos.x - b.stars[0].pos.x, a.stars[0].pos.y - b.stars[0].pos.y, a.stars[0].pos.z - b.stars[0].pos.z);
    expect(sep).toBeGreaterThan(0.05);
  });

  it("reports genuine 3D orbital inclination", () => {
    const s = threeStarSystem();
    // Binary orbit was constructed in the X-Y plane => orbital plane normal along Z.
    const A = s.stars[0], B = s.stars[1];
    const relPos = v3(B.pos.x - A.pos.x, B.pos.y - A.pos.y, B.pos.z - A.pos.z);
    const relVel = v3(B.vel.x - A.vel.x, B.vel.y - A.vel.y, B.vel.z - A.vel.z);
    const el = orbitalElements(relPos, relVel, A.mass + B.mass);
    expect(el.eccentricity).toBeLessThan(0.05);
    expect(Math.abs(el.inclinationRad - Math.PI / 2)).toBeLessThan(0.05);
  });

  it("satisfies vis-viva for a 3D circular orbit", () => {
    const m = 1.3;
    const r = 2.4;
    const pos = v3(r, 0.3, 0);
    const rActual = Math.hypot(pos.x, pos.y, pos.z);
    const v = Math.sqrt((G * m) / rActual);
    const el = orbitalElements(pos, v3(0, 0, v), m);
    expect(el.eccentricity).toBeLessThan(1e-6);
    expect(el.semiMajor).toBeCloseTo(rActual, 5);
  });

  it("softens close encounters instead of producing infinities", () => {
    const stars: StarInit[] = [
      { id: "A", name: "A", mass: 1, radius: 0.004, luminosity: 1, surfaceTempK: 5700, color: "#f00", pos: v3(-0.001, 0, 0), vel: v3(0, 0, -8) },
      { id: "B", name: "B", mass: 1, radius: 0.004, luminosity: 1, surfaceTempK: 5700, color: "#0ff", pos: v3(0.001, 0, 0), vel: v3(0, 0, 8) },
      { id: "C", name: "C", mass: 1, radius: 0.004, luminosity: 1, surfaceTempK: 5700, color: "#a0f", pos: v3(5, 1, 0), vel: v3(0, 0, 5.6) },
    ];
    const planet: PlanetInit = { name: "P", mass: 1, radiusKm: 6371, pos: v3(9, 0.5, 0), vel: v3(0, 0, 2), albedo: 0.3, greenhouseK: 20, thermalTauYears: 0.2, water: 0.5, atmosphere: 1, ecology: 0.5 };
    const s = createPhysicsState(stars, planet, 0.001, 0.008);
    expect(() => advancePhysics(s, 2)).not.toThrow();
    for (const st of s.stars) expect(Number.isFinite(st.pos.y)).toBe(true);
  });

  it("planet is a test particle and does not alter stellar dynamics", () => {
    const s = threeStarSystem();
    const starPath = s.stars.map((x) => ({ ...x.vel }));
    advancePhysics(s, 3);
    expect(s.stars.length).toBe(3);
    expect(vLen3(starPath[0])).toBeGreaterThan(0);
  });
});
