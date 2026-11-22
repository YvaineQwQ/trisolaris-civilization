/**
 * Procedural 3D galaxy generation.
 *
 * Every seed deterministically produces one triple-star system plus a
 * habitable-zone civilization planet in real 3D space: the inner binary, the
 * outer companion and the planet orbit have independent, randomly inclined
 * orbital planes (no flattened universe).
 *
 * Candidate systems are NOT accepted because they look nice: each is integrated
 * forward with the same leapfrog physics, and only systems where the planet
 * survives, stays in a workable irradiation band and is not ejected are
 * accepted. The classification (stable / chaotic / extreme / special) is derived
 * from those pre-simulation metrics, never from a random label.
 */
import { DIFFICULTIES, G, SOLAR_RADIUS_AU, STAR_BASE_NAMES, STAR_COLORS } from "../core/constants";
import type { DifficultyKey, GalaxyClassification, GalaxyClass, GalaxyPreview, StarId, Vec3 } from "../core/types";
import { clamp, clamp01, orbitPlaneToWorld, rad, v3 } from "../core/math";
import { Rng } from "../core/rng";
import { conservedQuantities, createPhysicsState, stepPhysics, type PlanetInit, type StarInit } from "../physics/nbody";
import { computeStellarFlux, createEnvironmentState, equilibriumTemperatureC } from "../environment/climate";
import type { EnvironmentState, PhysicsState } from "../core/types";

const PLANET_NAME = "曦和";

export interface GeneratedGalaxy {
  seed: string;
  difficulty: DifficultyKey;
  physics: PhysicsState;
  environment: EnvironmentState;
  classification: GalaxyClassification;
  preview: GalaxyPreview;
  planetInit: PlanetInit;
  starInits: StarInit[];
}

interface Candidate {
  stars: StarInit[];
  planet: PlanetInit;
}

interface ScreenMetrics {
  initialTempC: number;
  initialFlux: number;
  minTempC: number;
  maxTempC: number;
  comfortableFraction: number;
  ok: boolean;
  reason: string;
  failedYear: number | null;
  meanFlux: number;
  minFlux: number;
  maxFlux: number;
  minStarDistance: number;
  maxPlanetRadius: number;
  minPlanetRadius: number;
  closeEncounters: number;
  starCloseEncounters: number;
  fluxStddev: number;
  orbitRadiusStddev: number;
  meanInclinationDeg: number;
  maxHeightAU: number;
  energyNegative: boolean;
  chaosIndex: number;
  ejectionRisk: number;
  survivalYears: number;
}

function starFromMass(id: StarId, mass: number): StarInit {
  return {
    id,
    name: STAR_BASE_NAMES[id],
    mass,
    radius: SOLAR_RADIUS_AU * Math.pow(mass, 0.8),
    luminosity: Math.pow(mass, 3.45),
    surfaceTempK: 5772 * Math.pow(mass, 0.55),
    color: STAR_COLORS[id],
    pos: v3(0, 0, 0),
    vel: v3(0, 0, 0),
  };
}

/** Build a hierarchical triple in 3D: inclined inner binary AB + inclined outer C + inclined planet. */
function buildCandidate(rng: Rng, difficulty: DifficultyKey): Candidate {
  const danger = difficulty === "nightmare" ? 1.6 : difficulty === "hard" ? 1.3 : difficulty === "normal" ? 1 : 0.8;

  const mA = rng.float(0.72, 1.38) * (1 + (danger - 1) * 0.05);
  const mB = rng.float(0.35, 1.0);
  const mC = rng.float(0.30, 0.92);
  const starA = starFromMass("A", mA);
  const starB = starFromMass("B", mB);
  const starC = starFromMass("C", mC);

  // --- inner binary AB, genuinely inclined orbital plane ---
  const aAB = rng.float(0.16, 0.55) * (difficulty === "easy" ? 1.1 : 1);
  const eAB = clamp(rng.float(0, 0.62) * (0.7 + danger * 0.25), 0, 0.78);
  const incAB = rad(rng.float(0, 62) * (difficulty === "easy" ? 0.8 : 1));
  const nodeAB = rng.float(0, Math.PI * 2);
  const muAB = G * (mA + mB);
  const rRel = rng.float(aAB * (1 - eAB), aAB * (1 + eAB));
  const hAB = Math.sqrt(muAB * aAB * (1 - eAB * eAB));
  const vt = hAB / rRel;
  const v2rel = muAB * (2 / rRel - 1 / aAB);
  const vr = Math.sqrt(Math.max(0, v2rel - vt * vt)) * (rng.bool() ? 1 : -1);
  const phaseAB = rng.float(0, Math.PI * 2);
  const cAB = Math.cos(phaseAB);
  const sAB = Math.sin(phaseAB);
  const posRel = orbitPlaneToWorld(rRel * cAB, rRel * sAB, incAB, nodeAB);
  const velRel = orbitPlaneToWorld(vr * cAB - vt * sAB, vr * sAB + vt * cAB, incAB, nodeAB);
  const fA = mB / (mA + mB);
  const fB = mA / (mA + mB);
  starA.pos = { x: -posRel.x * fA, y: -posRel.y * fA, z: -posRel.z * fA };
  starB.pos = { x: posRel.x * fB, y: posRel.y * fB, z: posRel.z * fB };
  starA.vel = { x: -velRel.x * fA, y: -velRel.y * fA, z: -velRel.z * fA };
  starB.vel = { x: velRel.x * fB, y: velRel.y * fB, z: velRel.z * fB };

  // --- outer star C around the AB barycenter, its own inclined plane ---
  const rC = rng.float(4.0, 9.0) * (difficulty === "easy" ? 1.12 : difficulty === "hard" ? 0.8 : difficulty === "nightmare" ? 0.65 : 1);
  const eC = clamp(rng.float(0, 0.4) * (0.8 + danger * 0.2), 0, 0.55);
  const incC = rad(rng.float(0, 78));
  const nodeC = rng.float(0, Math.PI * 2);
  const muC = G * (mA + mB + mC);
  const aC = rC / (1 - eC);
  const hC = Math.sqrt(muC * aC * (1 - eC * eC));
  const vtC = hC / rC;
  const vrC = Math.sqrt(Math.max(0, muC * (2 / rC - 1 / aC) - vtC * vtC)) * (rng.bool() ? 1 : -1);
  const progradeC = rng.bool() ? 1 : -1;
  const phaseC = rng.float(0, Math.PI * 2);
  const cC = Math.cos(phaseC);
  const sC = Math.sin(phaseC);
  starC.pos = orbitPlaneToWorld(rC * cC, rC * sC, incC, nodeC);
  starC.vel = orbitPlaneToWorld(vrC * cC - vtC * sC * progradeC, vrC * sC + vtC * cC * progradeC, incC, nodeC);
  const abMass = mA + mB;
  const shiftX = -(mC * starC.vel.x) / (abMass + mC);
  const shiftY = -(mC * starC.vel.y) / (abMass + mC);
  const shiftZ = -(mC * starC.vel.z) / (abMass + mC);
  starA.vel.x += shiftX; starA.vel.y += shiftY; starA.vel.z += shiftZ;
  starB.vel.x += shiftX; starB.vel.y += shiftY; starB.vel.z += shiftZ;

  // --- planet in the habitable zone, on its own inclined plane ---
  const incP = rad(rng.float(0, 45) * (difficulty === "easy" ? 0.8 : 1));
  const nodeP = rng.float(0, Math.PI * 2);
  const rPMin = Math.max(1.0, aAB * 3.2);
  const rPMax = Math.max(rPMin + 0.4, rC * 0.72);
  let rP = clamp(rC * rng.float(0.34, 0.5), rPMin, rPMax);
  const targetFlux = rng.float(0.8, 1.3);
  for (let iter = 0; iter < 6; iter++) {
    const pPos = orbitPlaneToWorld(rP, 0, incP, nodeP);
    const flux = computeStellarFlux(pPos, [starA, starB, starC]).total;
    if (flux > 0.001) rP = clamp(rP * Math.sqrt(flux / targetFlux), rPMin, rPMax);
  }
  const progradeP = rng.bool() ? 1 : -1;
  const planetVelMag = Math.sqrt((G * (mA + mB + mC)) / rP) * rng.float(0.84, 1.1);
  const phaseP = rng.float(0, Math.PI * 2);
  const cP = Math.cos(phaseP);
  const sP = Math.sin(phaseP);
  const planetPos = orbitPlaneToWorld(rP * cP, rP * sP, incP, nodeP);
  const planetVel = orbitPlaneToWorld(-planetVelMag * sP * progradeP, planetVelMag * cP * progradeP, incP, nodeP);
  // Target a habitable starting climate instead of letting random greenhouse
  // values produce 100°C worlds: solve the greenhouse forcing for the flux at
  // the final orbit. The climate still evolves physically afterwards.
  const finalPos = orbitPlaneToWorld(rP * cP, rP * sP, incP, nodeP);
  const finalFlux = computeStellarFlux(finalPos, [starA, starB, starC]).total;
  const albedo = rng.float(0.24, 0.38);
  const targetTempC = rng.float(6, 24);
  const teqK = 255 * Math.pow(Math.max(1e-6, ((1 - albedo) / 0.7) * Math.max(1e-6, finalFlux)), 0.25);
  const greenhouseK = clamp(targetTempC + 273.15 - teqK, 3, 72);
  const planet: PlanetInit = {
    name: PLANET_NAME,
    mass: rng.float(0.45, 1.55),
    radiusKm: rng.float(0.82, 1.28) * 6371,
    pos: { x: planetPos.x + rng.float(-0.06, 0.06), y: planetPos.y + rng.float(-0.06, 0.06), z: planetPos.z + rng.float(-0.06, 0.06) },
    vel: { x: planetVel.x + rng.normal(0, 0.004), y: planetVel.y + rng.normal(0, 0.004), z: planetVel.z + rng.normal(0, 0.004) },
    albedo,
    greenhouseK,
    thermalTauYears: rng.float(0.08, 0.3),
    water: rng.float(0.45, 0.9),
    atmosphere: rng.float(0.62, 1.15),
    ecology: rng.float(0.5, 0.78),
  };

  // Recenter to the total barycenter and zero total momentum in 3D.
  const bodies = [
    { m: mA, p: starA.pos, v: starA.vel },
    { m: mB, p: starB.pos, v: starB.vel },
    { m: mC, p: starC.pos, v: starC.vel },
    { m: planet.mass * 3.0034896e-6, p: planet.pos, v: planet.vel },
  ];
  const totalMass = bodies.reduce((s, b) => s + b.m, 0);
  const cx = bodies.reduce((s, b) => s + b.m * b.p.x, 0) / totalMass;
  const cy = bodies.reduce((s, b) => s + b.m * b.p.y, 0) / totalMass;
  const cz = bodies.reduce((s, b) => s + b.m * b.p.z, 0) / totalMass;
  const pxc = bodies.reduce((s, b) => s + b.m * b.v.x, 0) / totalMass;
  const pyc = bodies.reduce((s, b) => s + b.m * b.v.y, 0) / totalMass;
  const pzc = bodies.reduce((s, b) => s + b.m * b.v.z, 0) / totalMass;
  for (const b of bodies) {
    b.p.x -= cx; b.p.y -= cy; b.p.z -= cz;
    b.v.x -= pxc; b.v.y -= pyc; b.v.z -= pzc;
  }
  for (const st of [starA, starB, starC]) {
    st.vel.x += rng.normal(0, 0.005) * (0.6 + danger * 0.4);
    st.vel.y += rng.normal(0, 0.005) * (0.6 + danger * 0.4);
    st.vel.z += rng.normal(0, 0.005) * (0.6 + danger * 0.4);
  }
  return { stars: [starA, starB, starC], planet };
}

/** Fast 3D screening integrator (same KDK math, flat typed arrays, no bookkeeping). */
function screenCandidate(cand: Candidate, preset: (typeof DIFFICULTIES)[DifficultyKey], years: number, dt: number): ScreenMetrics {
  const n = 3;
  const mass = new Float64Array(n);
  const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
  const vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
  const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n);
  const eps2 = 0.008 * 0.008;
  for (let i = 0; i < n; i++) {
    mass[i] = cand.stars[i].mass;
    px[i] = cand.stars[i].pos.x; py[i] = cand.stars[i].pos.y; pz[i] = cand.stars[i].pos.z;
    vx[i] = cand.stars[i].vel.x; vy[i] = cand.stars[i].vel.y; vz[i] = cand.stars[i].vel.z;
  }
  let ppx = cand.planet.pos.x, ppy = cand.planet.pos.y, ppz = cand.planet.pos.z;
  let pvx = cand.planet.vel.x, pvy = cand.planet.vel.y, pvz = cand.planet.vel.z;

  const accel = () => {
    ax.fill(0); ay.fill(0); az.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
        const d2 = dx * dx + dy * dy + dz * dz + eps2;
        const invd3 = 1 / (d2 * Math.sqrt(d2));
        const fi = G * mass[j] * invd3;
        const fj = G * mass[i] * invd3;
        ax[i] += dx * fi; ay[i] += dy * fi; az[i] += dz * fi;
        ax[j] -= dx * fj; ay[j] -= dy * fj; az[j] -= dz * fj;
      }
    }
  };
  let pax = 0, pay = 0, paz = 0;
  const planetAccel = () => {
    pax = 0; pay = 0; paz = 0;
    for (let i = 0; i < n; i++) {
      const dx = px[i] - ppx, dy = py[i] - ppy, dz = pz[i] - ppz;
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      const invd3 = 1 / (d2 * Math.sqrt(d2));
      pax += G * mass[i] * dx * invd3;
      pay += G * mass[i] * dy * invd3;
      paz += G * mass[i] * dz * invd3;
    }
  };
  accel();
  planetAccel();

  let sumFlux = 0, sumFlux2 = 0, samples = 0;
  let minFlux = Infinity, maxFlux = 0;
  let minStarDistance = Infinity;
  let maxPlanetRadius = 0, minPlanetRadius = Infinity;
  let closeEncounters = 0, starCloseEncounters = 0;
  let wasClose = false;
  let sumR = 0, sumR2 = 0, samplesR = 0;
  let maxHeight = 0;
  let minTempC = Infinity;
  let maxTempC = -Infinity;
  let comfortableSamples = 0;
  let tempSamples = 0;
  let failedYear: number | null = null;
  let reason = "";
  const steps = Math.max(1, Math.ceil(years / dt));
  const sampleEvery = Math.max(1, Math.floor(0.1 / dt));
  const planetMassSolar = cand.planet.mass * 3.0034896e-6;
  const initialFlux = computeStellarFlux(cand.planet.pos, cand.stars).total;
  const initialTempC = equilibriumTemperatureC(initialFlux, cand.planet.albedo, cand.planet.greenhouseK);

  let energy = 0;
  for (let i = 0; i < n; i++) energy += 0.5 * mass[i] * (vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
  energy += 0.5 * planetMassSolar * (pvx * pvx + pvy * pvy + pvz * pvz);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
      energy -= (G * mass[i] * mass[j]) / Math.sqrt(dx * dx + dy * dy + dz * dz + eps2);
    }
  }
  const energyNegative = energy < 0;

  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < n; k++) {
      vx[k] += 0.5 * ax[k] * dt; vy[k] += 0.5 * ay[k] * dt; vz[k] += 0.5 * az[k] * dt;
      px[k] += vx[k] * dt; py[k] += vy[k] * dt; pz[k] += vz[k] * dt;
    }
    pvx += 0.5 * pax * dt; pvy += 0.5 * pay * dt; pvz += 0.5 * paz * dt;
    ppx += pvx * dt; ppy += pvy * dt; ppz += pvz * dt;
    accel();
    planetAccel();
    for (let k = 0; k < n; k++) {
      vx[k] += 0.5 * ax[k] * dt; vy[k] += 0.5 * ay[k] * dt; vz[k] += 0.5 * az[k] * dt;
    }
    pvx += 0.5 * pax * dt; pvy += 0.5 * pay * dt; pvz += 0.5 * paz * dt;
    const t = (i + 1) * dt;
    if (!Number.isFinite(ppx) || !Number.isFinite(ppy) || !Number.isFinite(ppz)) { failedYear = t; reason = "numerical-overflow"; break; }
    if (i % sampleEvery !== 0) continue;
    let nearest = Infinity;
    for (let k = 0; k < n; k++) {
      const d = Math.hypot(ppx - px[k], ppy - py[k], ppz - pz[k]);
      if (d < nearest) nearest = d;
    }
    if (nearest < 0.008 * 2.5) { failedYear = t; reason = "planet-incinerated"; break; }
    let bx = 0, by = 0, bz = 0, tm = 0;
    for (let k = 0; k < n; k++) { bx += mass[k] * px[k]; by += mass[k] * py[k]; bz += mass[k] * pz[k]; tm += mass[k]; }
    bx /= tm; by /= tm; bz /= tm;
    const rPlanet = Math.hypot(ppx - bx, ppy - by, ppz - bz);
    if (rPlanet > 60) { failedYear = t; reason = "planet-ejected"; break; }
    maxHeight = Math.max(maxHeight, Math.abs(ppy - by));
    let flux = 0;
    for (let k = 0; k < n; k++) {
      const d = Math.max(0.01, Math.hypot(ppx - px[k], ppy - py[k], ppz - pz[k]));
      flux += cand.stars[k].luminosity / (d * d);
    }
    sumFlux += flux; sumFlux2 += flux * flux; samples++;
    minFlux = Math.min(minFlux, flux); maxFlux = Math.max(maxFlux, flux);
    {
      const tempC = equilibriumTemperatureC(flux, cand.planet.albedo, cand.planet.greenhouseK);
      minTempC = Math.min(minTempC, tempC);
      maxTempC = Math.max(maxTempC, tempC);
      tempSamples += 1;
      if (tempC >= -10 && tempC <= 45) comfortableSamples += 1;
    }
    minStarDistance = Math.min(minStarDistance, nearest);
    maxPlanetRadius = Math.max(maxPlanetRadius, rPlanet);
    minPlanetRadius = Math.min(minPlanetRadius, rPlanet);
    sumR += rPlanet; sumR2 += rPlanet * rPlanet; samplesR++;
    if (nearest < 0.32 && !wasClose) closeEncounters++;
    wasClose = nearest < 0.32;
    for (let si = 0; si < n; si++) {
      for (let sj = si + 1; sj < n; sj++) {
        if (Math.hypot(px[si] - px[sj], py[si] - py[sj], pz[si] - pz[sj]) < 0.22) starCloseEncounters++;
      }
    }
    if (flux > 12 && preset.temperatureTolerance <= 1.0) { failedYear = t; reason = "flash-irradiation"; break; }
    // Early rejection: hopeless irradiation or orbit already lost.
    if (samples === 22) {
      const earlyMean = sumFlux / samples;
      if (earlyMean < 0.28 / preset.temperatureTolerance || earlyMean > 4.5 * preset.temperatureTolerance) {
        failedYear = t; reason = "irradiation-out-of-band"; break;
      }
    }
    if (maxPlanetRadius > preset.maxEjectionRadius * 1.4) { failedYear = t; reason = "orbit-unstable-early"; break; }
    if (samples === 30 && comfortableSamples / samples < 0.22) {
      failedYear = t; reason = "climate-hostile-early"; break;
    }
  }

  const meanFlux = samples > 0 ? sumFlux / samples : 1;
  const fluxStddev = samples > 1 ? Math.sqrt(Math.max(0, sumFlux2 / samples - meanFlux * meanFlux)) : 0;
  const meanR = samplesR > 0 ? sumR / samplesR : 0;
  const rStd = samplesR > 1 ? Math.sqrt(Math.max(0, sumR2 / samplesR - meanR * meanR)) : 0;
  const orbitRadiusStddev = meanR > 0 ? rStd / meanR : 0;
  // Climate habitability screening: the planet must not freeze or bake during
  // the pre-simulation window; difficulty decides how much range is tolerated.
  const tempLimits = {
    easy: { min: -36, max: 62, frac: 0.55 },
    normal: { min: -48, max: 78, frac: 0.44 },
    hard: { min: -62, max: 92, frac: 0.34 },
    nightmare: { min: -82, max: 112, frac: 0.24 },
  } as const;
  const tempLimit = tempLimits[preset.key] ?? tempLimits.normal;
  const comfortableFraction = tempSamples > 0 ? comfortableSamples / tempSamples : 0;
  const climateOk = Number.isFinite(minTempC) && Number.isFinite(maxTempC)
    && minTempC > tempLimit.min && maxTempC < tempLimit.max && comfortableFraction >= tempLimit.frac;
  const tol = preset.temperatureTolerance;
  const survivable =
    failedYear === null &&
    energyNegative &&
    initialTempC >= -12 && initialTempC <= 44 &&
    climateOk &&
    meanFlux >= 0.5 / tol && meanFlux <= 2.6 * tol &&
    minFlux > 0.015 &&
    maxFlux < 6.5 * tol &&
    minStarDistance > 0.055 &&
    minPlanetRadius > 0.4 &&
    maxPlanetRadius < preset.maxEjectionRadius;
  if (failedYear === null && !survivable) {
    reason = !energyNegative ? "unbound-system"
      : meanFlux < 0.5 / tol ? "too-cold"
      : meanFlux > 2.6 * tol ? "too-hot"
      : minStarDistance <= 0.055 ? "planet-star-collision-risk"
      : maxPlanetRadius >= preset.maxEjectionRadius ? "unstable-orbit"
      : !climateOk ? "climate-out-of-band"
      : "unacceptable-environment";
  }
  // Chaos proxy from the pre-simulation: relative orbital-radius variance,
  // relative irradiation variance, and close-encounter frequency.
  const chaosIndex =
    clamp01(orbitRadiusStddev / 0.5) * 0.9 +
    clamp01(fluxStddev / Math.max(0.25, meanFlux)) * 0.7 +
    closeEncounters * 0.08 +
    starCloseEncounters * 0.015;
  const ejectionRisk = clamp01(maxPlanetRadius / Math.max(1e-3, preset.maxEjectionRadius + 2) * 0.6 + (failedYear ? 0.35 : 0) + chaosIndex * 0.1);
  return {
    ok: survivable, reason,
    initialTempC, initialFlux,
    minTempC, maxTempC, comfortableFraction,
    failedYear,
    meanFlux, minFlux, maxFlux, minStarDistance,
    maxPlanetRadius, minPlanetRadius,
    closeEncounters, starCloseEncounters, fluxStddev, orbitRadiusStddev,
    meanInclinationDeg: 0,
    maxHeightAU: maxHeight,
    energyNegative,
    chaosIndex: clamp(chaosIndex, 0, 3),
    ejectionRisk,
    survivalYears: failedYear ?? years,
  };
}

function classify(metrics: ScreenMetrics, rng: Rng, cand: Candidate): GalaxyClassification {
  const masses = cand.stars.map((s) => s.mass);
  const massSpread = Math.max(...masses) - Math.min(...masses);
  const symmetric = massSpread < 0.12;
  const tightBinary = Math.hypot(cand.stars[0].pos.x - cand.stars[1].pos.x, cand.stars[0].pos.y - cand.stars[1].pos.y, cand.stars[0].pos.z - cand.stars[1].pos.z) < 0.45;
  const specialRoll = rng.next() < 0.05;
  let kind: GalaxyClass;
  if (specialRoll && (symmetric || tightBinary) && metrics.chaosIndex < 1.25) kind = "special";
  else if (metrics.chaosIndex < 0.62 && metrics.closeEncounters <= 1 && metrics.ejectionRisk < 0.55) kind = "stable";
  else if (metrics.chaosIndex < 1.05 && metrics.ejectionRisk < 0.78) kind = "chaotic";
  else kind = "extreme";

  const names: Record<GalaxyClass, string> = {
    stable: "相对稳定型", chaotic: "高度混沌型", extreme: "极端危险型", special: "特殊星系型",
  };
  const descriptions: Record<GalaxyClass, string> = {
    stable: "三颗恒星在预演窗口内保持了相对克制的引力舞蹈，母星轨道温和。文明获得了宝贵的窗口期，但混沌从未远离。",
    chaotic: "恒星的轨迹彼此纠缠，母星的轨道在扰动中持续摆动。文明必须在动荡中学习生存。",
    extreme: "引力剧变、辐射风暴与轨道失稳接踵而至，母星几乎没有安宁可言。任何长期预测都极其困难。",
    special: "三颗恒星的质量或构型呈现出罕见特征，引力场敏感而复杂。这里的物理法则不会温柔，却格外值得研究。",
  };
  return {
    kind, name: names[kind], description: descriptions[kind],
    survivalYears: metrics.survivalYears,
    chaosIndex: metrics.chaosIndex,
    ejectionRisk: metrics.ejectionRisk,
    closeEncounterCount: metrics.closeEncounters,
    metrics: {
      meanFlux: metrics.meanFlux, minFlux: metrics.minFlux, maxFlux: metrics.maxFlux,
      fluxStddev: metrics.fluxStddev, orbitRadiusStddev: metrics.orbitRadiusStddev,
      minStarDistance: metrics.minStarDistance,
      closeEncounters: metrics.closeEncounters, starCloseEncounters: metrics.starCloseEncounters,
      maxHeightAU: metrics.maxHeightAU,
      initialTempC: metrics.initialTempC,
      initialFlux: metrics.initialFlux,
      energyNegative: metrics.energyNegative ? 1 : 0, massSpread,
    },
  };
}

function samplePreviewTrajectories(stars: StarInit[], planet: PlanetInit, years = 45) {
  const physics = createPhysicsState(stars, planet, 0.02, 0.008);
  const trajectories: Partial<Record<StarId, Vec3[]>> = { A: [], B: [], C: [] };
  const steps = Math.ceil(years / 0.02);
  for (let i = 0; i < steps; i++) {
    stepPhysics(physics);
    if (i % 5 === 0) {
      for (const s of physics.stars) {
        trajectories[s.id]!.push({ x: s.pos.x, y: s.pos.y, z: s.pos.z });
      }
    }
  }
  return { trajectories };
}

/** Fine-step validation: make sure a coarse-screen survivor also survives the real integrator. */
function fineValidate(cand: Candidate, preset: (typeof DIFFICULTIES)[DifficultyKey], years: number): { ok: boolean; metrics: ScreenMetrics } {
  const m = screenCandidate(cand, preset, Math.min(years, 70), 0.01);
  const ok = m.failedYear === null && m.minStarDistance > 0.05 && m.maxPlanetRadius < preset.maxEjectionRadius && m.energyNegative
    && m.initialTempC >= -12 && m.initialTempC <= 44 && m.comfortableFraction >= 0.4;
  return { ok, metrics: m };
}

/** Generate a complete, physically screened 3D galaxy. Deterministic per seed. */
export function generateGalaxy(seed: string, difficulty: DifficultyKey, mode: "story" | "normal" | "survival" | "sandbox" = "normal"): GeneratedGalaxy {
  const preset = DIFFICULTIES[difficulty];
  const screenYears = Math.max(preset.minSurvivalYears * 1.35, 60);
  const maxAttempts = Math.min(preset.candidateBudget, 260);
  let best: { cand: Candidate; metrics: ScreenMetrics; score: number } | null = null;
  let accepted: { cand: Candidate; metrics: ScreenMetrics } | null = null;
  const rejectionCounts: Record<string, number> = {};
  let screened = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = new Rng(seed + "|" + difficulty + "|" + mode + "|" + attempt);
    const cand = buildCandidate(rng, difficulty);
    const metrics = screenCandidate(cand, preset, screenYears, 0.02);
    screened++;
    if (!metrics.ok) rejectionCounts[metrics.reason || "unknown"] = (rejectionCounts[metrics.reason || "unknown"] ?? 0) + 1;
    const score = clamp01(metrics.survivalYears / screenYears) * 2
      - metrics.ejectionRisk * 0.4
      - metrics.chaosIndex * 0.05
      + metrics.comfortableFraction * 0.7
      + (metrics.ok ? 0.5 : 0);
    if (!best || score > best.score) best = { cand, metrics, score };
    if (metrics.ok) {
      const fine = fineValidate(cand, preset, screenYears);
      if (fine.ok) {
        if (!accepted || score > best.score * 0.98) accepted = { cand, metrics: fine.metrics };
        if (difficulty === "easy" || attempt > maxAttempts * 0.55) break;
      } else {
        rejectionCounts["fine-validation"] = (rejectionCounts["fine-validation"] ?? 0) + 1;
      }
    }
  }
  let choice: { cand: Candidate; metrics: ScreenMetrics };
  if (accepted) choice = accepted;
  else {
    // No fully accepted system: fall back to the best survivor (flagged in metrics).
    const fb = best!;
    choice = { cand: fb.cand, metrics: fb.metrics };
  }
  const classification = classify(choice.metrics, new Rng(seed + "|cls"), choice.cand);
  classification.metrics.screenedCandidates = screened;
  classification.metrics.fullyScreened = accepted ? 1 : 0;
  classification.metrics.comfortableFraction = choice.metrics.comfortableFraction;
  classification.metrics.initialTempC = choice.metrics.initialTempC;
  for (const [reason, count] of Object.entries(rejectionCounts)) {
    classification.metrics["rejected_" + reason] = count;
  }
  const physics = createPhysicsState(choice.cand.stars, choice.cand.planet);
  const environment = createEnvironmentState(physics);
  const { trajectories } = samplePreviewTrajectories(choice.cand.stars, choice.cand.planet);
  const planetRel = choice.cand.planet.pos;
  const orbitRadius = Math.hypot(planetRel.x, planetRel.y, planetRel.z);
  const incDeg = Math.acos(Math.max(-1, Math.min(1, planetRel.y / Math.max(orbitRadius, 1e-9)))) * 180 / Math.PI;
  const preview: GalaxyPreview = {
    seed,
    difficulty,
    classification,
    stars: choice.cand.stars.map((s) => ({
      id: s.id, name: s.name, color: s.color, mass: s.mass, radius: s.radius,
      luminosity: s.luminosity, pos: { ...s.pos }, vel: { ...s.vel },
    })),
    planet: {
      name: choice.cand.planet.name,
      pos: { ...choice.cand.planet.pos },
      vel: { ...choice.cand.planet.vel },
      mass: choice.cand.planet.mass,
      radiusKm: choice.cand.planet.radiusKm,
      albedo: choice.cand.planet.albedo,
      greenhouseK: choice.cand.planet.greenhouseK,
      water: choice.cand.planet.water,
      atmosphere: choice.cand.planet.atmosphere,
      initialTempC: environment.surfaceTempC,
      habitability: environment.habitability,
      orbitRadius,
      inclinationDeg: incDeg,
    },
    trajectories,
    warnings: buildWarnings(classification, choice.metrics),
  };
  return { seed, difficulty, physics, environment, classification, preview, planetInit: choice.cand.planet, starInits: choice.cand.stars };
}

function buildWarnings(cls: GalaxyClassification, m: ScreenMetrics): string[] {
  const out: string[] = [];
  if (cls.kind === "extreme") out.push("预演显示：母星轨道在数十年内将经历剧烈扰动，长期生存极为艰难。");
  if (cls.kind === "chaotic") out.push("预演显示：引力扰动频繁，气候可能出现剧烈波动。");
  if (m.closeEncounters >= 2) out.push("观测到恒星近距离掠过母星轨道区域，辐射风暴风险较高。");
  if (m.starCloseEncounters >= 4) out.push("三颗恒星之间存在周期性接近，混沌程度显著。");
  if (m.meanFlux < 0.7) out.push("母星平均辐照偏弱，初始温度偏低，农业需要额外能源。");
  if (m.meanFlux > 1.6) out.push("母星平均辐照偏强，初始温度偏高，需防范高温与干旱。");
  if (!cls.metrics.fullyScreened) out.push("警告：该星系未通过完整的细化预演筛选，生存窗口可能短于预期。");
  return out;
}
