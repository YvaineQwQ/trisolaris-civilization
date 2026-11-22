/**
 * Planetary energy balance and climate.
 *
 * Irradiance from all three stars: S = sum(L_i / d_i^2) in Earth solar constants.
 * Radiative equilibrium: T_eq = 255 K * ((1-A)/(1-0.3) * S)^(1/4)
 * Surface temperature relaxes toward T_eq + greenhouse with a thermal time
 * constant (ocean/atmosphere heat capacity), so temperature never jumps
 * instantaneously when stellar geometry changes.
 */
import { clamp, clamp01 } from "../core/math";
import type { EnvironmentState, PhysicsState, StarId, WeatherKind } from "../core/types";
import type { Vec3 } from "../core/math";

export interface FluxBreakdown {
  total: number;
  byStar: Record<StarId, number>;
  distances: Record<StarId, number>;
  dominant: StarId;
}

export function computeStellarFlux(planetPos: Vec3, stars: { id: StarId; pos: Vec3; luminosity: number }[]): FluxBreakdown {
  const byStar = { A: 0, B: 0, C: 0 } as Record<StarId, number>;
  const distances = { A: 0, B: 0, C: 0 } as Record<StarId, number>;
  let total = 0;
  let dominant: StarId = "A";
  let max = -1;
  for (const s of stars) {
    const dx = planetPos.x - s.pos.x;
    const dy = planetPos.y - s.pos.y;
    const dz = planetPos.z - s.pos.z;
    const d = Math.max(1e-4, Math.hypot(dx, dy, dz));
    const flux = s.luminosity / (d * d);
    byStar[s.id] = flux;
    distances[s.id] = d;
    total += flux;
    if (flux > max) {
      max = flux;
      dominant = s.id;
    }
  }
  return { total, byStar, distances, dominant };
}

/** Stefan-Boltzmann equilibrium temperature in Celsius (climate baseline). */
export function equilibriumTemperatureC(flux: number, albedo: number, greenhouseK: number): number {
  const absorbed = clamp((1 - albedo) / 0.7, 1e-6, 10) * Math.max(flux, 1e-9);
  const teqK = 255 * Math.pow(absorbed, 0.25);
  return teqK + greenhouseK - 273.15;
}

export function habitabilityScore(tempC: number, water: number, atmosphere: number, flux: number, ecology: number): number {
  // Temperature comfort window, wide but with sharp falloff.
  const tScore =
    tempC < -60 ? 0.02 :
    tempC < -20 ? clamp01((tempC + 60) / 40) * 0.55 :
    tempC < 5 ? 0.55 + clamp01((tempC + 20) / 25) * 0.4 :
    tempC <= 30 ? 1 :
    tempC <= 50 ? 1 - clamp01((tempC - 30) / 20) * 0.35 :
    tempC <= 90 ? 0.65 - clamp01((tempC - 50) / 40) * 0.6 :
    clamp01(0.08 - (tempC - 90) / 200);
  const wScore = clamp01(water / 0.55);
  const aScore = clamp01((atmosphere - 0.15) / 0.55);
  const eScore = clamp01(ecology);
  const fluxSanity = flux < 0.02 ? 0.15 : flux > 8 ? 0.2 : 1;
  const raw = tScore * 0.4 + wScore * 0.2 + aScore * 0.15 + eScore * 0.25;
  return clamp01(raw * fluxSanity);
}

export function weatherState(tempC: number, flux: number, prevTempC: number, fluxAnomaly: number): WeatherKind {
  const dt = tempC - prevTempC;
  if (flux > 5.5) return "scorching";
  if (tempC > 58) return "scorching";
  if (flux < 0.12 || tempC < -38) return "freezing";
  if (flux > 2.6 && tempC > 45) return "ash";
  if (Math.abs(dt) > 1.2 || flux > 2.2) return "storm";
  if (fluxAnomaly > 1.3 || flux > 1.8) return "cloudy";
  return "clear";
}

export interface EnvironmentInit {
  flux: number;
  albedo: number;
  greenhouseK: number;
  tempC: number;
  water: number;
  atmosphere: number;
  ecology: number;
  habitability: number;
}

export function createEnvironmentState(physics: PhysicsState): EnvironmentState {
  const flux = computeStellarFlux(physics.planet.pos, physics.stars);
  const albedo = physics.planet.albedo;
  const greenhouse = physics.planet.greenhouseK;
  const eq = equilibriumTemperatureC(flux.total, albedo, greenhouse);
  const initialTemp = eq;
  const habitability = habitabilityScore(initialTemp, physics.planet.water, physics.planet.atmosphere, flux.total, physics.planet.ecology);
  return {
    stellarFlux: flux.total,
    equilibriumTempC: eq,
    surfaceTempC: initialTemp,
    greenhouseK: greenhouse,
    albedo,
    habitability,
    ecology: physics.planet.ecology,
    water: physics.planet.water,
    atmosphere: physics.planet.atmosphere,
    weather: weatherState(initialTemp, flux.total, initialTemp, 0),
    fluxAnomaly: 0,
    lastUpdateYear: physics.timeYears,
    temperatureHistory: [{ year: physics.timeYears, tempC: initialTemp, flux: flux.total }],
    lastHistorySample: physics.timeYears,
  };
}

/**
 * Integrate the climate forward by dtYears. Called from the physics loop so
 * climate always follows the true stellar geometry.
 */
export function updateEnvironment(env: EnvironmentState, physics: PhysicsState, dtYears: number): void {
  const planet = physics.planet;
  const prevTemp = env.surfaceTempC;
  const computed = computeStellarFlux(planet.pos, physics.stars);
  // Numerical safety: a damaged state must never poison the climate system.
  const fluxTotal = Number.isFinite(computed.total) ? Math.min(computed.total, 1e6) : 1e6;
  const flux = { ...computed, total: fluxTotal };
  const eqRaw = equilibriumTemperatureC(flux.total, planet.albedo, planet.greenhouseK);
  const eq = Number.isFinite(eqRaw) ? Math.max(-273.15, Math.min(4000, eqRaw)) : 4000;
  const tau = Math.max(0.02, planet.thermalTauYears);
  const decay = 1 - Math.exp(-dtYears / tau);
  const nextTempRaw = env.surfaceTempC + (eq - env.surfaceTempC) * decay;
  const nextTemp = Number.isFinite(nextTempRaw) ? Math.max(-273.15, Math.min(4000, nextTempRaw)) : env.surfaceTempC;

  // Accessible water: phase-dependent (ice locks water away; extreme heat boils it).
  let accessFactor = 1;
  if (nextTemp < -10) accessFactor = clamp01(1 - (-10 - nextTemp) / 55) * 0.75 + 0.15;
  if (nextTemp > 60) accessFactor = clamp01(1 - (nextTemp - 60) / 120) * 0.7 + 0.1;
  const targetWater = clamp01(planet.water * accessFactor);
  const waterDecay = 1 - Math.exp(-dtYears / 0.6);

  // Atmosphere slowly erodes when irradiation is extreme.
  const erosive = Math.max(0, flux.total - 3.5) * 0.0015 * dtYears + Math.max(0, nextTemp - 120) * 0.00002 * dtYears;
  planet.atmosphere = clamp(planet.atmosphere - erosive, 0.05, 1.6);
  planet.water = clamp(planet.water - erosive * 0.5, 0.02, 1);

  // Biosphere responds slowly to habitability.
  const hab = habitabilityScore(nextTemp, env.water, planet.atmosphere, flux.total, env.ecology);
  const targetEcology = clamp01(hab * 1.05 - Math.max(0, Math.abs(nextTemp - 16) - 45) * 0.006);
  const ecoDecay = 1 - Math.exp(-dtYears / 1.6);
  const nextEcology = clamp01(env.ecology + (targetEcology - env.ecology) * ecoDecay);
  planet.ecology = nextEcology;

  env.surfaceTempC = nextTemp;
  env.equilibriumTempC = eq;
  env.stellarFlux = flux.total;
  env.fluxAnomaly = env.temperatureHistory.length > 0 ? flux.total / Math.max(1e-6, env.temperatureHistory[0].flux) : 0;
  env.greenhouseK = planet.greenhouseK;
  env.albedo = planet.albedo;
  env.water = env.water + (targetWater - env.water) * waterDecay;
  env.atmosphere = planet.atmosphere;
  env.ecology = nextEcology;
  env.habitability = hab;
  env.weather = weatherState(nextTemp, flux.total, prevTemp, env.fluxAnomaly);
  env.lastUpdateYear = physics.timeYears;

  if (physics.timeYears - env.lastHistorySample >= 0.1) {
    env.lastHistorySample = physics.timeYears;
    env.temperatureHistory.push({ year: physics.timeYears, tempC: nextTemp, flux: flux.total });
    if (env.temperatureHistory.length > 900) env.temperatureHistory.splice(0, env.temperatureHistory.length - 900);
  }
}
