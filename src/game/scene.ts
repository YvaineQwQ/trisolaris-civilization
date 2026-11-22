/**
 * Scene assembly for the 2D primary view (X-Z projection) and the 3D
 * auxiliary view. Both are built from the SAME observation data — never from
 * the true physics state. The 2D renderer receives full 3D positions and
 * projects them itself, preserving height information as visual cues.
 */
import { MAX_TRAIL_RENDER_POINTS, OBSERVATORY_LEVELS, SOLAR_RADIUS_AU, STAR_BASE_NAMES, STAR_COLORS } from "../core/constants";
import { clamp, projectXZ } from "../core/math";
import type { Vec3 } from "../core/math";
import type { GameState, ObservationState, StarId } from "../core/types";
import type {
  RenderScene, RenderScene3D, SceneCloud3D, ScenePlanet, ScenePlanet3D, ScenePolyline,
  ScenePulse, ScenePulse3D, SceneStar, SceneStar3D, SceneTrail3D, SceneUncertainty, ViewSettings,
} from "./viewTypes";

type Selection = StarId | "planet" | null;

const STAR_IDS: StarId[] = ["A", "B", "C"];

function displayStarPos(obs: ObservationState, id: StarId): Vec3 {
  const model = obs.playerModel;
  if (model && model.valid) {
    const star = model.stars.find((s) => s.id === id);
    if (star) return star.pos;
  }
  return obs.stars[id]?.pos ?? { x: 0, y: 0, z: 0 };
}

function displayPlanetPos(obs: ObservationState): Vec3 | null {
  const model = obs.playerModel;
  if (model && model.valid && model.planet && model.planet.known) return model.planet.pos;
  return obs.planet ? obs.planet.pos : null;
}

function estimateRadiusAU(obs: ObservationState, id: StarId): number {
  const est = obs.stars[id];
  if (est?.known.mass && est.mass > 0.05) {
    return SOLAR_RADIUS_AU * Math.pow(est.mass, 0.8);
  }
  return 0.0046;
}

function estimateTempK(obs: ObservationState, id: StarId): number | null {
  const est = obs.stars[id];
  if (est?.known.mass && est.mass > 0.05) return 5772 * Math.pow(est.mass, 0.55);
  return null;
}

/** A circle of 3D points around a center, drawn in the X-Z plane (primary view). */
function uncertaintyRing(center: Vec3, radius: number, segments = 40): Vec3[] {
  const ring: Vec3[] = [];
  const r = Math.max(1e-4, radius);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    ring.push({ x: center.x + Math.cos(angle) * r, y: center.y, z: center.z + Math.sin(angle) * r });
  }
  return ring;
}

/** A 3D sphere point set is not needed for Three.js; clouds use center+radius. */

function trimTrail<T extends Vec3>(trail: T[] | undefined): T[] {
  if (!trail || trail.length < 2) return [];
  if (trail.length <= MAX_TRAIL_RENDER_POINTS) return trail;
  return trail.slice(trail.length - MAX_TRAIL_RENDER_POINTS);
}

function observedTrailPoints(obs: ObservationState, id: StarId): Vec3[] {
  return trimTrail(obs.observedTrail[id]);
}

function starConfidence(obs: ObservationState, id: StarId): number {
  return obs.stars[id]?.confidence ?? 0;
}

function starKnown(obs: ObservationState, id: StarId): boolean {
  return Boolean(obs.stars[id]?.known.position);
}

/**
 * Displayed position uncertainty.
 *
 * A raw measurement sigma only describes the instant of measurement. Without a
 * velocity model (observatory Lv.1-2) the star keeps moving unknown, so the
 * honest uncertainty grows with the age of the last measurement. Once a valid
 * dynamics model exists the track is propagated and the uncertainty stops
 * inflating.
 */
const UNKNOWN_MOTION_AU_PER_YEAR = 2.2;
const MAX_DISPLAY_SIGMA_AU = 8;
/** Visual cap for uncertainty geometry (labels still show the honest value). */
const VISUAL_SIGMA_CAP_AU = 1.2;

function starSigma(obs: ObservationState, id: StarId): number {
  const est = obs.stars[id];
  if (!est) return 1;
  const base = est.sigmaPos;
  const age = Math.max(0, obs.lastModelSyncYear - est.lastMeasuredYear);
  if (est.known.velocity && obs.playerModel && obs.playerModel.valid) {
    // With a dynamics model the track is propagated; residual error grows with
    // the model's own velocity uncertainty instead of the full stellar speed.
    return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * Math.max(0.05, est.sigmaVel) * 2);
  }
  return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * UNKNOWN_MOTION_AU_PER_YEAR);
}

function planetSigma(obs: ObservationState): number {
  const est = obs.planet;
  if (!est) return 0.2;
  const base = est.sigmaPos ?? 0.2;
  if (obs.playerModel && obs.playerModel.valid) return base;
  const age = Math.max(0, obs.lastModelSyncYear - est.lastMeasuredYear);
  return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * 1.1);
}

function predictedStarTrail(obs: ObservationState, id: StarId): Vec3[] {
  const bundle = obs.prediction;
  if (!bundle) return [];
  const points: Vec3[] = [];
  for (const sample of bundle.samples) {
    const star = sample.stars.find((s) => s.id === id);
    if (star) points.push({ ...star.pos });
  }
  return points;
}

function predictedPlanetTrail(obs: ObservationState): Vec3[] {
  const bundle = obs.prediction;
  if (!bundle) return [];
  const points: Vec3[] = [];
  for (const sample of bundle.samples) {
    if (sample.planet) points.push({ ...sample.planet.pos });
  }
  return points;
}

function activePulses(state: GameState, planetPos: Vec3 | null): ScenePulse[] {
  if (!planetPos) return [];
  const pulses: ScenePulse[] = [];
  for (const hazard of state.hazards.activeHazards) {
    if (!hazard.detected || hazard.severity < 0.3) continue;
    const color = hazard.kind === "heatExtreme" || hazard.kind === "radiationSurge"
      ? "#ff6b4a"
      : hazard.kind === "coldExtreme" ? "#7fd7ff" : "#ffc857";
    pulses.push({
      id: "hazard-" + hazard.id,
      pos: planetPos,
      severity: hazard.severity,
      color,
      label: hazard.title,
    });
  }
  return pulses;
}

function recommendedRadius(state: GameState): number {
  const obs = state.observation;
  let maxR = 1;
  for (const id of STAR_IDS) {
    const p = displayStarPos(obs, id);
    maxR = Math.max(maxR, Math.hypot(p.x, p.y, p.z));
  }
  const planet = displayPlanetPos(obs);
  if (planet) maxR = Math.max(maxR, Math.hypot(planet.x, planet.y, planet.z));
  return clamp(maxR * 1.55, 0.8, 30);
}

function statusLabel(state: GameState): string {
  const obs = state.observation;
  const info = OBSERVATORY_LEVELS[obs.level];
  const known = STAR_IDS.filter((id) => starKnown(obs, id)).length;
  const sigma = Math.max(...STAR_IDS.map((id) => starSigma(obs, id)));
  const parts = [
    `观测 ${info?.name ?? "Lv." + obs.level}`,
    `已定位 ${known}/3`,
    `典型精度 ±${sigma.toFixed(3)} AU`,
  ];
  if (obs.activeTask) parts.push("观测中");
  if (state.hazards.activeHazards.some((h) => h.detected && h.severity > 0.4)) parts.push("灾害警报");
  return parts.join(" · ");
}

function pulses3D(state: GameState, planetPos: Vec3 | null): ScenePulse3D[] {
  return activePulses(state, planetPos).map((p) => ({
    id: p.id, pos: p.pos, severity: p.severity, color: p.color, label: p.label,
  }));
}

export function buildRenderScene(state: GameState, settings: ViewSettings, selection: Selection): RenderScene {
  const obs = state.observation;
  const stars: SceneStar[] = STAR_IDS.map((id) => {
    const pos = displayStarPos(obs, id);
    return {
      id,
      name: obs.stars[id]?.name ?? STAR_BASE_NAMES[id] ?? id,
      color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
      pos: { ...pos },
      radiusAU: estimateRadiusAU(obs, id),
      mass: obs.stars[id]?.known.mass ? obs.stars[id].mass : null,
      tempK: estimateTempK(obs, id),
      sigmaAU: starKnown(obs, id) ? starSigma(obs, id) : 0,
      confidence: starConfidence(obs, id),
      known: starKnown(obs, id),
      selected: selection === id,
    };
  });

  const planetPos = displayPlanetPos(obs);
  const planetEstimate = obs.planet;
  const planet: ScenePlanet | null = planetPos && planetEstimate
    ? {
        pos: { ...planetPos },
        radiusKm: state.physics.planet.radiusKm,
        tempC: planetEstimate.tempC,
        habitability: planetEstimate.habitability,
        sigmaAU: planetSigma(obs),
        selected: selection === "planet",
      }
    : null;

  const observedTrails: ScenePolyline[] = [];
  for (const id of STAR_IDS) {
    const points = observedTrailPoints(obs, id);
    if (points.length > 1) {
      observedTrails.push({
        id: "obs-" + id,
        points,
        color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
        dashed: false,
        alpha: 0.85,
        width: 1.6,
      });
    }
  }
  if (obs.planetObservedTrail.length > 1) {
    observedTrails.push({
      id: "obs-planet",
      points: trimTrail(obs.planetObservedTrail),
      color: "#7fe0b0",
      dashed: false,
      alpha: 0.7,
      width: 1.2,
    });
  }

  const predictedTrails: ScenePolyline[] = [];
  if (settings.showPrediction) {
    for (const id of STAR_IDS) {
      const points = predictedStarTrail(obs, id);
      if (points.length > 1) {
        predictedTrails.push({
          id: "pred-" + id,
          points,
          color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
          dashed: true,
          alpha: 0.5,
          width: 1.2,
        });
      }
    }
  }

  const uncertaintyRings: SceneUncertainty[] = [];
  if (settings.showUncertainty) {
    for (const id of STAR_IDS) {
      if (!starKnown(obs, id)) continue;
      const pos = displayStarPos(obs, id);
      const sigma = Math.max(starSigma(obs, id), 1e-3);
      uncertaintyRings.push({
        id: "sigma-" + id,
        ring: uncertaintyRing(pos, Math.min(VISUAL_SIGMA_CAP_AU, sigma) * 2),
        color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
        alpha: 0.32,
      });
    }
    if (planetPos) {
      uncertaintyRings.push({
        id: "sigma-planet",
        ring: uncertaintyRing(planetPos, Math.min(VISUAL_SIGMA_CAP_AU, Math.max(planetSigma(obs), 1e-3)) * 2),
        color: "#7fe0b0",
        alpha: 0.3,
      });
    }
    const bundle = obs.prediction;
    if (bundle && settings.showPrediction) {
      const sampleCount = bundle.samples.length;
      const indices = [Math.floor(sampleCount * 0.33), Math.floor(sampleCount * 0.66), sampleCount - 1];
      for (const index of indices) {
        const sample = bundle.samples[index];
        if (!sample) continue;
        for (const star of sample.stars) {
          uncertaintyRings.push({
            id: `pred-sigma-${star.id}-${index}`,
            ring: uncertaintyRing(star.pos, Math.max(star.sigma * 1.6, 0.02), 28),
            color: obs.stars[star.id]?.color ?? STAR_COLORS[star.id] ?? "#ffffff",
            alpha: 0.12,
          });
        }
      }
    }
  }

  const predictedPlanet: ScenePolyline | null = settings.showPrediction && predictedPlanetTrail(obs).length > 1
    ? {
        id: "pred-planet",
        points: predictedPlanetTrail(obs),
        color: "#7fe0b0",
        dashed: true,
        alpha: 0.55,
        width: 1.3,
      }
    : null;

  const planetUncertainty: SceneUncertainty | null = settings.showUncertainty && planetPos && planetEstimate
    ? {
        id: "planet-uncertainty",
        ring: uncertaintyRing(planetPos, Math.max(planetSigma(obs) * 2.5, 0.02)),
        color: "#7fe0b0",
        alpha: 0.2,
      }
    : null;

  return {
    seed: state.meta.seed,
    timeYears: state.yearsElapsed,
    calendarYear: state.meta.calendarStartYear + state.yearsElapsed,
    observatoryLevel: obs.level,
    stars,
    planet,
    observedTrails,
    predictedTrails,
    uncertaintyRings,
    predictedPlanetTrail: predictedPlanet,
    planetUncertainty,
    pulses: activePulses(state, planetPos),
    selection,
    recommendedRadiusAU: recommendedRadius(state),
    settings,
    paused: false,
    hasColony: Boolean(state.civ.colony),
    statusLabel: statusLabel(state),
  };
}

export function buildRenderScene3D(state: GameState, settings: ViewSettings, selection: Selection): RenderScene3D {
  const obs = state.observation;
  const stars: SceneStar3D[] = STAR_IDS.map((id) => {
    const pos = displayStarPos(obs, id);
    return {
      id,
      name: obs.stars[id]?.name ?? STAR_BASE_NAMES[id] ?? id,
      color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
      pos: { ...pos },
      radiusAU: estimateRadiusAU(obs, id),
      mass: obs.stars[id]?.known.mass ? obs.stars[id].mass : null,
      tempK: estimateTempK(obs, id),
      sigmaAU: starKnown(obs, id) ? starSigma(obs, id) : 0,
      confidence: starConfidence(obs, id),
      known: starKnown(obs, id),
      selected: selection === id,
    };
  });

  const planetPos = displayPlanetPos(obs);
  const planetEstimate = obs.planet;
  const planet: ScenePlanet3D | null = planetPos && planetEstimate
    ? {
        pos: { ...planetPos },
        radiusKm: state.physics.planet.radiusKm,
        tempC: planetEstimate.tempC,
        habitability: planetEstimate.habitability,
        sigmaAU: planetSigma(obs),
        selected: selection === "planet",
      }
    : null;

  const observedTrails: SceneTrail3D[] = [];
  for (const id of STAR_IDS) {
    const points = observedTrailPoints(obs, id);
    if (points.length > 1) {
      observedTrails.push({
        id: "obs-" + id, points, color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
        dashed: false, alpha: 0.85, width: 1.4,
      });
    }
  }
  if (obs.planetObservedTrail.length > 1) {
    observedTrails.push({
      id: "obs-planet", points: trimTrail(obs.planetObservedTrail), color: "#7fe0b0", dashed: false, alpha: 0.7, width: 1.1,
    });
  }

  const predictedTrails: SceneTrail3D[] = [];
  if (settings.showPrediction) {
    for (const id of STAR_IDS) {
      const points = predictedStarTrail(obs, id);
      if (points.length > 1) {
        predictedTrails.push({
          id: "pred-" + id, points, color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
          dashed: true, alpha: 0.42, width: 1,
        });
      }
    }
  }

  const uncertaintyClouds: SceneCloud3D[] = [];
  if (settings.showUncertainty) {
    for (const id of STAR_IDS) {
      if (!starKnown(obs, id)) continue;
      const sigma = Math.min(VISUAL_SIGMA_CAP_AU, starSigma(obs, id));
      uncertaintyClouds.push({
        id: "sigma-" + id,
        center: displayStarPos(obs, id),
        radiusAU: Math.max(Math.min(VISUAL_SIGMA_CAP_AU, sigma) * 0.85, 0.01),
        color: obs.stars[id]?.color ?? STAR_COLORS[id] ?? "#ffffff",
        alpha: Math.max(0.035, 0.11 - Math.min(0.06, sigma * 0.01)),
      });
    }
    if (planetPos) {
      uncertaintyClouds.push({
        id: "sigma-planet", center: planetPos,
        radiusAU: Math.max(Math.min(VISUAL_SIGMA_CAP_AU, planetSigma(obs)), 1e-3) * 0.85,
        color: "#7fe0b0", alpha: 0.12,
      });
    }
    const bundle = obs.prediction;
    if (bundle && settings.showPrediction) {
      const last = bundle.samples[bundle.samples.length - 1];
      if (last) {
        for (const star of last.stars) {
          uncertaintyClouds.push({
            id: "pred-cloud-" + star.id, center: star.pos, radiusAU: Math.max(star.sigma * 1.8, 0.02),
            color: obs.stars[star.id]?.color ?? STAR_COLORS[star.id] ?? "#ffffff", alpha: 0.09,
          });
        }
      }
    }
  }

  const predictedPlanet: SceneTrail3D | null = settings.showPrediction && predictedPlanetTrail(obs).length > 1
    ? { id: "pred-planet", points: predictedPlanetTrail(obs), color: "#7fe0b0", dashed: true, alpha: 0.5, width: 1.1 }
    : null;

  const planetUncertainty: SceneCloud3D | null = settings.showUncertainty && planetPos && planetEstimate
    ? {
        id: "planet-uncertainty", center: planetPos, radiusAU: Math.max(planetSigma(obs) * 2.5, 0.02),
        color: "#7fe0b0", alpha: 0.16,
      }
    : null;

  return {
    seed: state.meta.seed,
    timeYears: state.yearsElapsed,
    calendarYear: state.meta.calendarStartYear + state.yearsElapsed,
    observatoryLevel: obs.level,
    stars,
    planet,
    observedTrails,
    predictedTrails,
    uncertaintyClouds,
    predictedPlanetTrail: predictedPlanet,
    planetUncertainty,
    pulses: pulses3D(state, planetPos),
    selection,
    recommendedRadiusAU: recommendedRadius(state),
    settings,
    paused: false,
    hasColony: Boolean(state.civ.colony),
    statusLabel: statusLabel(state),
    heightDataAvailable: obs.level >= 3,
  };
}

export { projectXZ };
