/**
 * Three-body gravitational integrator in 3D (velocity Verlet / leapfrog KDK).
 *
 * COORDINATES: X = horizontal, Y = vertical (height), Z = depth. Orbits are NOT
 * forced into a single plane; inclinations are real physical inclinations.
 *
 * MODEL: the three stars are a full mutual N-body system. The civilization
 * planet is treated as a massless test particle: it feels the stars but does not
 * back-react on them (documented simplification; M_planet / M_star < 1e-5).
 * PlanetBody.mass is stored in EARTH MASSES for display; dynamical bookkeeping
 * converts it to solar masses.
 *
 * UNITS: AU, solar masses, years  =>  G = 4*pi^2.
 *
 * NUMERICS: fixed-step kick-drift-kick leapfrog with Plummer softening.
 * Softening is an explicit physical approximation: unresolved close encounters /
 * potential stellar collisions are replaced by a smooth potential of scale
 * SOFTENING, keeping the integration stable. Encounters are recorded as events.
 */
import {
  G, MAX_TRAIL_POINTS, PHYSICS_DT, SOFTENING, SOLAR_RADIUS_AU, TRAIL_INTERVAL,
} from "../core/constants";
import { v3, vLen3 } from "../core/math";
import type { Vec3 } from "../core/math";
import type {
  CollisionRecord, PhysicsDiagnostics, PhysicsState, PlanetBody, StarBody, StarId,
} from "../core/types";

export interface SimpleBody {
  mass: number;
  pos: Vec3;
  vel: Vec3;
}

export interface StarInit {
  id: StarId;
  name: string;
  mass: number;
  radius: number;
  luminosity: number;
  surfaceTempK: number;
  color: string;
  pos: Vec3;
  vel: Vec3;
}

export interface PlanetInit {
  name: string;
  /** Earth masses (display unit). */
  mass: number;
  radiusKm: number;
  pos: Vec3;
  vel: Vec3;
  albedo: number;
  greenhouseK: number;
  thermalTauYears: number;
  water: number;
  atmosphere: number;
  ecology: number;
}

function accumulateStarAccelerations(stars: StarBody[], softening: number): void {
  for (const s of stars) {
    s.acc.x = 0;
    s.acc.y = 0;
    s.acc.z = 0;
  }
  const eps2 = softening * softening;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[j].pos.x - stars[i].pos.x;
      const dy = stars[j].pos.y - stars[i].pos.y;
      const dz = stars[j].pos.z - stars[i].pos.z;
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      const invd3 = 1 / (d2 * Math.sqrt(d2));
      const fi = G * stars[j].mass * invd3;
      const fj = G * stars[i].mass * invd3;
      stars[i].acc.x += dx * fi;
      stars[i].acc.y += dy * fi;
      stars[i].acc.z += dz * fi;
      stars[j].acc.x -= dx * fj;
      stars[j].acc.y -= dy * fj;
      stars[j].acc.z -= dz * fj;
    }
  }
}

export function starAccelerations(stars: StarBody[], softening = SOFTENING): Vec3[] {
  const out = stars.map(() => v3(0, 0, 0));
  const eps2 = softening * softening;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[j].pos.x - stars[i].pos.x;
      const dy = stars[j].pos.y - stars[i].pos.y;
      const dz = stars[j].pos.z - stars[i].pos.z;
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      const invd3 = 1 / (d2 * Math.sqrt(d2));
      const fi = G * stars[j].mass * invd3;
      const fj = G * stars[i].mass * invd3;
      out[i].x += dx * fi; out[i].y += dy * fi; out[i].z += dz * fi;
      out[j].x -= dx * fj; out[j].y -= dy * fj; out[j].z -= dz * fj;
    }
  }
  return out;
}

/** Acceleration on a test particle from massive bodies (3D). */
export function testParticleAcceleration(
  pos: Vec3,
  bodies: { mass: number; pos: Vec3 }[],
  softening = SOFTENING,
): Vec3 {
  let ax = 0;
  let ay = 0;
  let az = 0;
  const eps2 = softening * softening;
  for (const b of bodies) {
    const dx = b.pos.x - pos.x;
    const dy = b.pos.y - pos.y;
    const dz = b.pos.z - pos.z;
    const d2 = dx * dx + dy * dy + dz * dz + eps2;
    const invd3 = 1 / (d2 * Math.sqrt(d2));
    ax += G * b.mass * dx * invd3;
    ay += G * b.mass * dy * invd3;
    az += G * b.mass * dz * invd3;
  }
  return { x: ax, y: ay, z: az };
}

export interface SystemConserved {
  energy: number;
  momentum: Vec3;
  angularMomentum: Vec3;
}

/**
 * Conservation diagnostics for the DYNAMICAL system: the three stars.
 * The planet is a test particle and does not back-react, so its momentum and
 * orbital energy are not part of the conserved quantities (documented model
 * limitation). Star-only drift is the meaningful numerical-error metric.
 */
export function conservedQuantities(state: PhysicsState): SystemConserved {
  const { stars } = state;
  let energy = 0;
  const eps2 = state.softening * state.softening;
  let px = 0, py = 0, pz = 0;
  let lx = 0, ly = 0, lz = 0;
  for (const s of stars) {
    energy += 0.5 * s.mass * (s.vel.x * s.vel.x + s.vel.y * s.vel.y + s.vel.z * s.vel.z);
    px += s.mass * s.vel.x; py += s.mass * s.vel.y; pz += s.mass * s.vel.z;
    lx += s.mass * (s.pos.y * s.vel.z - s.pos.z * s.vel.y);
    ly += s.mass * (s.pos.z * s.vel.x - s.pos.x * s.vel.z);
    lz += s.mass * (s.pos.x * s.vel.y - s.pos.y * s.vel.x);
  }
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[j].pos.x - stars[i].pos.x;
      const dy = stars[j].pos.y - stars[i].pos.y;
      const dz = stars[j].pos.z - stars[i].pos.z;
      energy -= (G * stars[i].mass * stars[j].mass) / Math.sqrt(dx * dx + dy * dy + dz * dz + eps2);
    }
  }
  return { energy, momentum: v3(px, py, pz), angularMomentum: v3(lx, ly, lz) };
}

export function refreshDiagnostics(state: PhysicsState): void {
  const c = conservedQuantities(state);
  const d = state.diagnostics;
  d.totalEnergy = c.energy;
  d.totalMomentum = c.momentum;
  d.totalAngularMomentum = c.angularMomentum;
  d.energyDrift = d.initialEnergy !== 0 ? (c.energy - d.initialEnergy) / Math.abs(d.initialEnergy) : 0;
  let maxAcc = 0;
  for (const s of state.stars) maxAcc = Math.max(maxAcc, vLen3(s.acc));
  maxAcc = Math.max(maxAcc, vLen3(state.planet.acc));
  d.maxAcceleration = maxAcc;
}

export function createPhysicsState(
  starInits: StarInit[],
  planetInit: PlanetInit,
  dtYears = PHYSICS_DT,
  softening = SOFTENING,
): PhysicsState {
  const stars: StarBody[] = starInits.map((s) => ({
    id: s.id,
    name: s.name,
    mass: s.mass,
    radius: s.radius > 0 ? s.radius : SOLAR_RADIUS_AU * Math.pow(s.mass, 0.8),
    luminosity: s.luminosity,
    surfaceTempK: s.surfaceTempK,
    color: s.color,
    pos: { ...s.pos },
    vel: { ...s.vel },
    acc: v3(0, 0, 0),
    trail: [{ ...s.pos }],
    lastTrailTime: 0,
  }));
  const planet: PlanetBody = {
    id: "P",
    name: planetInit.name,
    mass: planetInit.mass,
    radiusKm: planetInit.radiusKm,
    pos: { ...planetInit.pos },
    vel: { ...planetInit.vel },
    acc: v3(0, 0, 0),
    albedo: planetInit.albedo,
    greenhouseK: planetInit.greenhouseK,
    thermalTauYears: planetInit.thermalTauYears,
    water: planetInit.water,
    atmosphere: planetInit.atmosphere,
    ecology: planetInit.ecology,
    trail: [{ ...planetInit.pos }],
    lastTrailTime: 0,
    alive: true,
  };
  const state: PhysicsState = {
    stars,
    planet,
    timeYears: 0,
    dtYears,
    softening,
    diagnostics: {
      initialEnergy: 0, totalEnergy: 0, energyDrift: 0,
      initialMomentum: v3(0, 0, 0), totalMomentum: v3(0, 0, 0),
      initialAngularMomentum: v3(0, 0, 0), totalAngularMomentum: v3(0, 0, 0),
      maxAcceleration: 0, overflow: false, steps: 0, collisionCount: 0,
    },
    collisions: [],
    planetAlive: true,
    planetEjected: false,
  };
  accumulateStarAccelerations(stars, softening);
  planet.acc = testParticleAcceleration(planet.pos, stars, softening);
  const c = conservedQuantities(state);
  state.diagnostics.initialEnergy = c.energy;
  state.diagnostics.totalEnergy = c.energy;
  state.diagnostics.initialMomentum = { ...c.momentum };
  state.diagnostics.totalMomentum = { ...c.momentum };
  state.diagnostics.initialAngularMomentum = { ...c.angularMomentum };
  state.diagnostics.totalAngularMomentum = { ...c.angularMomentum };
  refreshDiagnostics(state);
  return state;
}

function recordTrails(state: PhysicsState): void {
  const t = state.timeYears;
  for (const body of state.stars) {
    if (t - body.lastTrailTime < TRAIL_INTERVAL) continue;
    body.trail.push({ x: body.pos.x, y: body.pos.y, z: body.pos.z });
    body.lastTrailTime = t;
    if (body.trail.length > MAX_TRAIL_POINTS) body.trail.splice(0, body.trail.length - MAX_TRAIL_POINTS);
  }
  const p = state.planet;
  if (t - p.lastTrailTime >= TRAIL_INTERVAL) {
    p.trail.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z });
    p.lastTrailTime = t;
    if (p.trail.length > MAX_TRAIL_POINTS) p.trail.splice(0, p.trail.length - MAX_TRAIL_POINTS);
  }
}

function checkCollisions(state: PhysicsState): void {
  const { stars } = state;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      const contact = a.radius + b.radius;
      if (d < contact) {
        const last = state.collisions[state.collisions.length - 1];
        if (!last || state.timeYears - last.timeYears > 0.5) {
          state.collisions.push({ timeYears: state.timeYears, between: [a.id, b.id], action: "softened", separationAU: d });
          state.diagnostics.collisionCount += 1;
          if (state.collisions.length > 40) state.collisions.shift();
        }
      }
    }
  }
}

function checkPlanetFate(state: PhysicsState): void {
  const p = state.planet;
  if (!state.planetAlive) return;
  for (const s of state.stars) {
    const d = Math.hypot(p.pos.x - s.pos.x, p.pos.y - s.pos.y, p.pos.z - s.pos.z);
    if (d < Math.max(s.radius * 2.2, state.softening)) {
      state.planetAlive = false;
      p.alive = false;
      return;
    }
  }
  if (Math.hypot(p.pos.x, p.pos.y, p.pos.z) > 60) state.planetEjected = true;
  if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z)) {
    state.planetAlive = false;
    p.alive = false;
    state.diagnostics.overflow = true;
  }
}

/**
 * Adaptive sub-stepping safety net.
 *
 * The game runs at a fixed 1/1600 yr step, but a close stellar encounter can
 * make a body travel a significant fraction of the encounter distance within a
 * single step, which would break leapfrog stability. When the predicted
 * per-step displacement becomes large compared with the current separation, the
 * step is subdivided within the same fixed step budget (same simulated time,
 * same physics), preserving determinism and the fixed game clock while keeping
 * close encounters integrable.
 */
function adaptiveSubsteps(state: PhysicsState): number {
  const dt = state.dtYears;
  let sub = 1;
  const consider = (d: number, vrel: number): void => {
    const distance = Math.max(d, 0.006);
    const ratio = (vrel * dt) / distance;
    if (ratio > 0.03) sub = Math.max(sub, Math.min(48, Math.ceil(ratio / 0.03)));
  };
  const stars = state.stars;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      const vrel = Math.hypot(a.vel.x - b.vel.x, a.vel.y - b.vel.y, a.vel.z - b.vel.z);
      consider(d, vrel);
    }
    const p = state.planet;
    if (state.planetAlive) {
      const d = Math.hypot(p.pos.x - stars[i].pos.x, p.pos.y - stars[i].pos.y, p.pos.z - stars[i].pos.z);
      const vrel = Math.hypot(p.vel.x - stars[i].vel.x, p.vel.y - stars[i].vel.y, p.vel.z - stars[i].vel.z);
      consider(d, vrel);
    }
  }
  return sub;
}

/** One leapfrog KDK sub-step (advances the clock). */
function substep(state: PhysicsState, dt: number): void {
  const { stars, planet, softening } = state;
  if (!state.planetAlive) {
    stepStarsOnly(stars, dt, softening);
    state.timeYears += dt;
    return;
  }
  for (const s of stars) {
    s.vel.x += 0.5 * s.acc.x * dt;
    s.vel.y += 0.5 * s.acc.y * dt;
    s.vel.z += 0.5 * s.acc.z * dt;
  }
  planet.vel.x += 0.5 * planet.acc.x * dt;
  planet.vel.y += 0.5 * planet.acc.y * dt;
  planet.vel.z += 0.5 * planet.acc.z * dt;
  for (const s of stars) {
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.pos.z += s.vel.z * dt;
  }
  planet.pos.x += planet.vel.x * dt;
  planet.pos.y += planet.vel.y * dt;
  planet.pos.z += planet.vel.z * dt;
  accumulateStarAccelerations(stars, softening);
  planet.acc = testParticleAcceleration(planet.pos, stars, softening);
  for (const s of stars) {
    s.vel.x += 0.5 * s.acc.x * dt;
    s.vel.y += 0.5 * s.acc.y * dt;
    s.vel.z += 0.5 * s.acc.z * dt;
  }
  planet.vel.x += 0.5 * planet.acc.x * dt;
  planet.vel.y += 0.5 * planet.acc.y * dt;
  planet.vel.z += 0.5 * planet.acc.z * dt;
  state.timeYears += dt;
}

function anyNonFinite(state: PhysicsState): boolean {
  for (const s of state.stars) {
    if (!Number.isFinite(s.pos.x) || !Number.isFinite(s.pos.y) || !Number.isFinite(s.pos.z)) return true;
    if (!Number.isFinite(s.vel.x) || !Number.isFinite(s.vel.y) || !Number.isFinite(s.vel.z)) return true;
  }
  const p = state.planet;
  return !Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z);
}

/** Advance the simulation by exactly one fixed clock step (with adaptive sub-stepping). */
export function stepPhysics(state: PhysicsState): void {
  const dt = state.dtYears;
  const sub = adaptiveSubsteps(state);
  const subDt = dt / sub;
  for (let i = 0; i < sub; i++) {
    substep(state, subDt);
    if (anyNonFinite(state)) {
      state.diagnostics.overflow = true;
      state.planetAlive = false;
      state.planet.alive = false;
      state.diagnostics.steps += sub - i;
      return;
    }
  }
  state.diagnostics.steps += sub;
  if (state.diagnostics.steps % 50 === 0) refreshDiagnostics(state);
  if (!state.planetAlive) return;
  recordTrails(state);
  checkCollisions(state);
  checkPlanetFate(state);
}

function stepStarsOnly(stars: StarBody[], dt: number, softening: number): void {
  for (const s of stars) {
    s.vel.x += 0.5 * s.acc.x * dt;
    s.vel.y += 0.5 * s.acc.y * dt;
    s.vel.z += 0.5 * s.acc.z * dt;
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.pos.z += s.vel.z * dt;
  }
  accumulateStarAccelerations(stars, softening);
  for (const s of stars) {
    s.vel.x += 0.5 * s.acc.x * dt;
    s.vel.y += 0.5 * s.acc.y * dt;
    s.vel.z += 0.5 * s.acc.z * dt;
  }
}

export function advancePhysics(state: PhysicsState, years: number, maxSteps = 400000): number {
  const steps = Math.min(Math.ceil(years / state.dtYears), maxSteps);
  for (let i = 0; i < steps; i++) stepPhysics(state);
  refreshDiagnostics(state);
  return steps;
}

export function barycenter(state: PhysicsState): Vec3 {
  let m = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const s of state.stars) {
    m += s.mass;
    x += s.mass * s.pos.x;
    y += s.mass * s.pos.y;
    z += s.mass * s.pos.z;
  }
  return m > 0 ? { x: x / m, y: y / m, z: z / m } : v3(0, 0, 0);
}

export function starDistance(state: PhysicsState, a: StarId, b: StarId): number {
  const sa = state.stars.find((s) => s.id === a);
  const sb = state.stars.find((s) => s.id === b);
  if (!sa || !sb) return NaN;
  return Math.hypot(sa.pos.x - sb.pos.x, sa.pos.y - sb.pos.y, sa.pos.z - sb.pos.z);
}

export function planetDistanceToStar(state: PhysicsState, id: StarId): number {
  const s = state.stars.find((x) => x.id === id);
  if (!s) return NaN;
  return Math.hypot(state.planet.pos.x - s.pos.x, state.planet.pos.y - s.pos.y, state.planet.pos.z - s.pos.z);
}

export function nearestStar(state: PhysicsState): { id: StarId; distance: number } {
  let best: { id: StarId; distance: number } = { id: "A", distance: Infinity };
  for (const s of state.stars) {
    const d = Math.hypot(state.planet.pos.x - s.pos.x, state.planet.pos.y - s.pos.y, state.planet.pos.z - s.pos.z);
    if (d < best.distance) best = { id: s.id, distance: d };
  }
  return best;
}

/** Propagate massive bodies only in 3D (player's model / prediction ensemble). */
export function stepSimpleBodies(bodies: SimpleBody[], dt: number, softening = SOFTENING): void {
  const n = bodies.length;
  const eps2 = softening * softening;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const az = new Float64Array(n);
  const accel = () => {
    ax.fill(0); ay.fill(0); az.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = bodies[j].pos.x - bodies[i].pos.x;
        const dy = bodies[j].pos.y - bodies[i].pos.y;
        const dz = bodies[j].pos.z - bodies[i].pos.z;
        const d2 = dx * dx + dy * dy + dz * dz + eps2;
        const invd3 = 1 / (d2 * Math.sqrt(d2));
        const fi = G * bodies[j].mass * invd3;
        const fj = G * bodies[i].mass * invd3;
        ax[i] += dx * fi; ay[i] += dy * fi; az[i] += dz * fi;
        ax[j] -= dx * fj; ay[j] -= dy * fj; az[j] -= dz * fj;
      }
    }
  };
  accel();
  for (let i = 0; i < n; i++) {
    bodies[i].vel.x += 0.5 * ax[i] * dt;
    bodies[i].vel.y += 0.5 * ay[i] * dt;
    bodies[i].vel.z += 0.5 * az[i] * dt;
    bodies[i].pos.x += bodies[i].vel.x * dt;
    bodies[i].pos.y += bodies[i].vel.y * dt;
    bodies[i].pos.z += bodies[i].vel.z * dt;
  }
  accel();
  for (let i = 0; i < n; i++) {
    bodies[i].vel.x += 0.5 * ax[i] * dt;
    bodies[i].vel.y += 0.5 * ay[i] * dt;
    bodies[i].vel.z += 0.5 * az[i] * dt;
  }
}

/** Orbital elements of a body relative to a primary mass (2-body approximation, 3D). */
export function orbitalElements(
  relPos: Vec3, relVel: Vec3, primaryMass: number,
): { semiMajor: number; eccentricity: number; periodYears: number; inclinationRad: number } {
  const r = vLen3(relPos);
  const v2mag = relVel.x * relVel.x + relVel.y * relVel.y + relVel.z * relVel.z;
  const mu = G * primaryMass;
  const energy = v2mag / 2 - mu / r;
  const hx = relPos.y * relVel.z - relPos.z * relVel.y;
  const hy = relPos.z * relVel.x - relPos.x * relVel.z;
  const hz = relPos.x * relVel.y - relPos.y * relVel.x;
  const h = Math.hypot(hx, hy, hz);
  const e2 = 1 + (2 * energy * h * h) / (mu * mu);
  const a = energy < 0 ? -mu / (2 * energy) : Infinity;
  const period = Number.isFinite(a) ? Math.sqrt((4 * Math.PI * Math.PI * a * a * a) / mu) : Infinity;
  const inclinationRad = Math.acos(Math.max(-1, Math.min(1, hz / Math.max(h, 1e-12))));
  return { semiMajor: a, eccentricity: Math.sqrt(Math.max(0, e2)), periodYears: period, inclinationRad };
}
