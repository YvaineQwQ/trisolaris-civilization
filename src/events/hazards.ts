/**
 * Physics-driven hazards, warnings and civilization crises.
 *
 * Hazards are NEVER rolled from a random table: they are derived from the true
 * stellar geometry, irradiation, temperature and orbital state accumulated
 * during the turn. The player only sees hazards they can observe, plus hazards
 * whose effects are directly felt (heat, cold, radiation). Advance warnings come
 * from the player's own observation model and prediction ensemble, so a
 * low-level observatory simply cannot see a dangerous approach coming.
 */
import { clamp, clamp01 } from "../core/math";
import type {
  CivilizationState, CrisisEvent, CrisisKind, EnvironmentState, HazardEvent, HazardState,
  HazardWarning, LogEntry, PhysicalHazardKind, PhysicsState, PredictionBundle, StarId,
} from "../core/types";

export interface HazardLog {
  category: "hazard";
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface CrisisModifiers {
  foodMultiplier: number;
  energyDemandMultiplier: number;
  stabilityPenalty: number;
  disasterDamage: number;
}

const EMPTY_ACCUMULATOR = (): HazardState["accumulator"] => ({
  minPlanetStarDistance: Infinity,
  maxStarStarProximity: Infinity,
  maxFlux: 0,
  minFlux: Infinity,
  maxTempC: -Infinity,
  minTempC: Infinity,
  maxAcceleration: 0,
  maxHeightAU: 0,
  firstPlanetRadius: -1,
  lastPlanetRadius: -1,
  samples: 0,
  collisionRecords: 0,
});

export function createHazardState(): HazardState {
  return {
    activeHazards: [],
    history: [],
    warnings: [],
    crises: [],
    nextId: 1,
    lastCheckYear: 0,
    stress: 0,
    historyStress: [],
    accumulator: EMPTY_ACCUMULATOR(),
  };
}

function planetRadiusFromBarycenter(physics: PhysicsState): number {
  let m = 0, x = 0, y = 0, z = 0;
  for (const s of physics.stars) {
    m += s.mass;
    x += s.mass * s.pos.x;
    y += s.mass * s.pos.y;
    z += s.mass * s.pos.z;
  }
  if (m <= 0) return Math.hypot(physics.planet.pos.x, physics.planet.pos.y, physics.planet.pos.z);
  return Math.hypot(physics.planet.pos.x - x / m, physics.planet.pos.y - y / m, physics.planet.pos.z - z / m);
}

/** Called once per physics step: cheap accumulation of the turn's true extremes. */
export function accumulateHazardTick(hazard: HazardState, physics: PhysicsState, env: EnvironmentState): void {
  const acc = hazard.accumulator;
  acc.samples += 1;
  if (acc.firstPlanetRadius < 0) acc.firstPlanetRadius = planetRadiusFromBarycenter(physics);
  acc.lastPlanetRadius = planetRadiusFromBarycenter(physics);
  for (const s of physics.stars) {
    const d = Math.hypot(physics.planet.pos.x - s.pos.x, physics.planet.pos.y - s.pos.y, physics.planet.pos.z - s.pos.z);
    if (d < acc.minPlanetStarDistance) acc.minPlanetStarDistance = d;
  }
  for (let i = 0; i < physics.stars.length; i++) {
    for (let j = i + 1; j < physics.stars.length; j++) {
      const a = physics.stars[i];
      const b = physics.stars[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      if (d < acc.maxStarStarProximity) acc.maxStarStarProximity = d;
    }
  }
  acc.maxFlux = Math.max(acc.maxFlux, env.stellarFlux);
  acc.minFlux = Math.min(acc.minFlux, env.stellarFlux);
  acc.maxTempC = Math.max(acc.maxTempC, env.surfaceTempC);
  acc.minTempC = Math.min(acc.minTempC, env.surfaceTempC);
  acc.maxAcceleration = Math.max(acc.maxAcceleration, physics.diagnostics.maxAcceleration);
  acc.maxHeightAU = Math.max(acc.maxHeightAU, Math.abs(physics.planet.pos.y));
  acc.collisionRecords = physics.diagnostics.collisionCount;
}

export interface HazardTurnContext {
  year: number;
  turn: number;
  observationLevel: number;
  observationConfidence: number;
  /** Extra warning lead time (years) granted by radar arrays / tech. */
  warningBonusYears: number;
  disasterResistance: number;
  techDetectionMultiplier: number;
  prediction: PredictionBundle | null;
  playerModelAccuracy: number;
  /** Luminosities inferred from observed masses (L ~ M^3.45); missing = unknown. */
  starLuminosities: Partial<Record<StarId, number>>;
  /** Difficulty hazard multiplier (easy 0.75 ... nightmare 1.7). */
  hazardMultiplier: number;
}

export interface HazardTurnResult {
  logs: HazardLog[];
  crisis: CrisisModifiers;
  /** Fraction of population lost to the turn's physical disasters (0..1). */
  damageFraction: number;
  newWarnings: HazardWarning[];
}

function pushHazard(
  hazard: HazardState,
  kind: PhysicalHazardKind,
  title: string,
  description: string,
  severity: number,
  range: { startYear: number; peakYear: number; endYear: number },
  detected: boolean,
  confidence: number,
  evidence: Record<string, number>,
): void {
  const existing = hazard.activeHazards.find((h) => h.kind === kind);
  if (existing) {
    existing.severity = Math.max(existing.severity, severity);
    existing.endYear = Math.max(existing.endYear, range.endYear);
    existing.peakYear = range.peakYear;
    existing.detected = existing.detected || detected;
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.evidence = evidence;
    return;
  }
  const event: HazardEvent = {
    id: hazard.nextId++,
    kind, title, description,
    severity: clamp01(severity),
    startYear: range.startYear,
    peakYear: range.peakYear,
    endYear: range.endYear,
    detected,
    confidence: clamp01(confidence),
    evidence,
  };
  hazard.activeHazards.push(event);
}

function expireHazards(hazard: HazardState, year: number): void {
  const still: HazardEvent[] = [];
  for (const h of hazard.activeHazards) {
    if (year > h.endYear) {
      hazard.history.push(h);
      if (hazard.history.length > 80) hazard.history.shift();
    } else {
      still.push(h);
    }
  }
  hazard.activeHazards = still;
}

/** Resolve the turn's hazards from accumulated true extremes + player prediction. */
export function resolveHazardTurn(hazard: HazardState, physics: PhysicsState, env: EnvironmentState, ctx: HazardTurnContext): HazardTurnResult {
  const logs: HazardLog[] = [];
  const acc = hazard.accumulator;
  const year = ctx.year;
  expireHazards(hazard, year);
  const level = ctx.observationLevel;
  const obsConf = clamp01(ctx.observationConfidence);
  const detectBoost = clamp(ctx.techDetectionMultiplier, 0.5, 2);
  const duration = 1.5;

  // --- direct physical hazards from real geometry / climate ---
  const contactThreshold = 1.1;
  if (Number.isFinite(acc.minPlanetStarDistance) && acc.minPlanetStarDistance < contactThreshold) {
    const d = acc.minPlanetStarDistance;
    const severity = clamp01((contactThreshold - d) / contactThreshold);
    const detected = level >= 1 && obsConf > 0.12;
    pushHazard(hazard, "closeEncounter", "恒星近距离接近",
      `一颗恒星从距母星 ${d.toFixed(3)} AU 处掠过，引力与辐射环境急剧变化。`,
      severity, { startYear: year, peakYear: year + 0.5, endYear: year + duration },
      detected, clamp01(obsConf * detectBoost), { minDistanceAU: d });
    if (detected && severity > 0.25) logs.push({ category: "hazard", severity: "warning", message: `恒星近距离接近：最近距离 ${d.toFixed(3)} AU` });
  }
  if (acc.maxFlux > 2.2) {
    const severity = clamp01((acc.maxFlux - 2.2) / 5);
    pushHazard(hazard, "radiationSurge", "恒星辐射风暴",
      `母星接收到的辐照峰值达到历史常态的 ${(acc.maxFlux / Math.max(0.2, env.stellarFlux)).toFixed(1)} 倍，地表辐射与热负荷骤增。`,
      severity, { startYear: year, peakYear: year, endYear: year + duration },
      true, clamp01(0.55 + obsConf * 0.4), { peakFlux: acc.maxFlux });
    logs.push({ category: "hazard", severity: severity > 0.6 ? "critical" : "warning", message: `辐射风暴：峰值辐照 ${acc.maxFlux.toFixed(2)} S` });
  }
  if (acc.maxTempC > 52) {
    const severity = clamp01((acc.maxTempC - 52) / 40);
    pushHazard(hazard, "heatExtreme", "极端高温",
      `母星表面温度升至 ${acc.maxTempC.toFixed(1)}°C，农业与能源系统承受极端压力。`,
      severity, { startYear: year, peakYear: year, endYear: year + duration },
      true, 0.95, { peakTempC: acc.maxTempC });
    logs.push({ category: "hazard", severity: severity > 0.5 ? "critical" : "warning", message: `极端高温：${acc.maxTempC.toFixed(1)}°C` });
  }
  if (acc.minTempC < -30) {
    const severity = clamp01((-30 - acc.minTempC) / 45);
    pushHazard(hazard, "coldExtreme", "极端严寒",
      `母星表面温度降至 ${acc.minTempC.toFixed(1)}°C，作物枯萎、能源需求激增。`,
      severity, { startYear: year, peakYear: year, endYear: year + duration },
      true, 0.95, { minTempC: acc.minTempC });
    logs.push({ category: "hazard", severity: severity > 0.5 ? "critical" : "warning", message: `极端严寒：${acc.minTempC.toFixed(1)}°C` });
  }
  const orbitChange = acc.firstPlanetRadius > 0
    ? Math.abs(acc.lastPlanetRadius - acc.firstPlanetRadius) / acc.firstPlanetRadius
    : 0;
  if (orbitChange > 0.55) {
    const severity = clamp01((orbitChange - 0.55) / 1.2);
    const detected = level >= 3 && obsConf > 0.25;
    pushHazard(hazard, "orbitDestabilization", "轨道扰动",
      `母星轨道半径在一个回合内变化了 ${(orbitChange * 100).toFixed(1)}%，三体引力扰动正在改变文明的季节与气候。`,
      severity, { startYear: year, peakYear: year + 0.5, endYear: year + 1.5 },
      detected, clamp01(obsConf * detectBoost), { orbitChange });
    if (detected) logs.push({ category: "hazard", severity: "warning", message: `轨道扰动：轨道半径变化 ${(orbitChange * 100).toFixed(1)}%` });
  }

  // --- warnings derived from the PLAYER's prediction (knowledge-limited) ---
  const newWarnings: HazardWarning[] = [];
  const prediction = ctx.prediction;
  if (prediction && prediction.samples.length > 1) {
    const accuracy = clamp01(ctx.playerModelAccuracy);
    const baseConf = clamp01((0.28 + level * 0.09) * (0.4 + 0.6 * accuracy) * prediction.reliableFraction * detectBoost);
    let bestClose: { lead: number; distance: number } | null = null;
    let maxPredFlux = 0;
    let maxPredFluxLead = 0;
    let minPredFlux = Infinity;
    let minPredFluxLead = 0;
    for (const sample of prediction.samples) {
      const lead = Math.max(0, sample.t + prediction.createdYear - year);
      if (!sample.planet) continue;
      for (const s of sample.stars) {
        const d = Math.hypot(sample.planet.pos.x - s.pos.x, sample.planet.pos.y - s.pos.y, sample.planet.pos.z - s.pos.z);
        if (d < 1.3 && (!bestClose || d < bestClose.distance)) bestClose = { lead, distance: d };
      }
      // Irradiance forecast requires the player to know stellar masses.
      let flux = 0;
      let known = true;
      for (const s of sample.stars) {
        const luminosity = ctx.starLuminosities[s.id];
        if (luminosity === undefined) { known = false; break; }
        const d = Math.max(0.05, Math.hypot(sample.planet.pos.x - s.pos.x, sample.planet.pos.y - s.pos.y, sample.planet.pos.z - s.pos.z));
        flux += luminosity / (d * d);
      }
      if (!known) continue;
      if (flux > maxPredFlux) { maxPredFlux = flux; maxPredFluxLead = lead; }
      if (flux < minPredFlux) { minPredFlux = flux; minPredFluxLead = lead; }
    }
    if (bestClose && baseConf > 0.18) {
      const lead = bestClose.lead + ctx.warningBonusYears;
      newWarnings.push({
        id: hazard.nextId++, kind: "closeEncounter",
        title: "预警：恒星近距离接近",
        description: `模型推演显示，约 ${lead.toFixed(1)} 年后一颗恒星将接近母星（预计最近 ${bestClose.distance.toFixed(2)} AU）。预测存在不确定性。`,
        leadYears: bestClose.lead, confidence: baseConf,
        severityEstimate: clamp01((1.3 - bestClose.distance) / 1.3),
        createdYear: year,
      });
    }
    if (maxPredFlux > 2.4 && baseConf > 0.2) {
      newWarnings.push({
        id: hazard.nextId++, kind: "radiationSurge",
        title: "预警：辐射峰值",
        description: `模型推演显示，约 ${maxPredFluxLead.toFixed(1)} 年后辐照可能显著升高（${maxPredFlux.toFixed(2)} S）。`,
        leadYears: maxPredFluxLead, confidence: baseConf * 0.9,
        severityEstimate: clamp01((maxPredFlux - 2.4) / 6),
        createdYear: year,
      });
    }
    if (minPredFlux < 0.16 && baseConf > 0.2 && Number.isFinite(minPredFlux)) {
      newWarnings.push({
        id: hazard.nextId++, kind: "coldExtreme",
        title: "预警：长期低温",
        description: `模型推演显示，约 ${minPredFluxLead.toFixed(1)} 年后母星辐照可能跌至 ${minPredFlux.toFixed(2)} S，气温将长期下降。`,
        leadYears: minPredFluxLead, confidence: baseConf * 0.85,
        severityEstimate: clamp01((0.16 - minPredFlux) / 0.16),
        createdYear: year,
      });
    }
  }
  // Merge warnings: keep the newest set per kind, keep up to 6 total.
  for (const warning of newWarnings) {
    hazard.warnings = hazard.warnings.filter((w) => w.kind !== warning.kind);
    hazard.warnings.push(warning);
    logs.push({ category: "hazard", severity: "warning", message: warning.title + " - " + warning.description });
  }
  hazard.warnings = hazard.warnings
    .filter((w) => year - w.createdYear <= 12)
    .sort((a, b) => a.leadYears - b.leadYears)
    .slice(0, 6);

  // --- aggregate modifiers and direct damage ---
  const severityOf = (kind: PhysicalHazardKind): number => {
    const h = hazard.activeHazards.find((x) => x.kind === kind);
    return h ? h.severity : 0;
  };
  const thermalSeverity = Math.max(severityOf("heatExtreme"), severityOf("coldExtreme"));
  const radiation = severityOf("radiationSurge");
  const close = severityOf("closeEncounter");
  const orbit = severityOf("orbitDestabilization");
  const totalSeverity = thermalSeverity * 1.0 + radiation * 1.2 + close * 1.1 + orbit * 0.8;
  const resistance = clamp01(ctx.disasterResistance);
  const hazardMultiplier = Number.isFinite(ctx.hazardMultiplier) ? clamp(ctx.hazardMultiplier, 0.3, 3) : 1;
  const damageFraction = clamp01(0.010 * totalSeverity * hazardMultiplier * (1 - 0.75 * resistance));
  const crisis: CrisisModifiers = {
    foodMultiplier: clamp(1 - (0.42 * thermalSeverity + 0.18 * radiation + 0.1 * orbit) * hazardMultiplier, 0.15, 1),
    energyDemandMultiplier: clamp(1 + (0.7 * thermalSeverity + 0.25 * radiation + 0.1 * orbit) * hazardMultiplier, 1, 3),
    stabilityPenalty: 4 * totalSeverity * hazardMultiplier,
    disasterDamage: 0,
  };
  hazard.stress = clamp01(totalSeverity / 2.4);
  hazard.historyStress.push({ year, stress: hazard.stress });
  if (hazard.historyStress.length > 160) hazard.historyStress.shift();
  hazard.lastCheckYear = year;
  hazard.accumulator = EMPTY_ACCUMULATOR();
  return { logs, crisis, damageFraction, newWarnings };
}

export interface CrisisContext {
  civ: CivilizationState;
  env: EnvironmentState;
  year: number;
  hazard: HazardState;
}

const CRISIS_TITLES: Record<CrisisKind, string> = {
  famine: "饥荒",
  waterShortage: "水资源危机",
  energyCrisis: "能源危机",
  unrest: "社会动荡",
  ecologicalCollapse: "生态崩溃",
  planetaryWinter: "行星寒冬",
};

/** Detect / update civilization crises from real resource and environment state. */
export function updateCrises(ctx: CrisisContext): HazardLog[] {
  const { civ, env, year, hazard } = ctx;
  const logs: HazardLog[] = [];
  const active = new Map<CrisisKind, { severity: number; reason: string }>();

  const foodNet = civ.flows.food?.net ?? 0;
  const waterNet = civ.flows.water?.net ?? 0;
  const energyNet = civ.flows.energy?.net ?? 0;
  if (civ.starvation > 25 || (foodNet < -0.5 && civ.resources.food.amount < civ.population * 0.4)) {
    active.set("famine", { severity: clamp01(civ.starvation / 100 + (foodNet < 0 ? 0.25 : 0)), reason: "粮食产出低于消耗，储备持续下降" });
  }
  if (waterNet < -0.2 && civ.resources.water.amount < civ.population * 0.4) {
    active.set("waterShortage", { severity: clamp01(0.35 + Math.abs(waterNet) * 0.02), reason: "可用水资源低于文明需求" });
  }
  if (energyNet < 0 && civ.resources.energy.amount < 40) {
    active.set("energyCrisis", { severity: clamp01(0.3 + Math.abs(energyNet) * 0.02), reason: "能源库存不足，生产与供暖受限" });
  }
  if (civ.stability < 35) {
    active.set("unrest", { severity: clamp01((35 - civ.stability) / 35), reason: "稳定度跌破警戒线，社会秩序承压" });
  }
  if (env.ecology < 0.28) {
    active.set("ecologicalCollapse", { severity: clamp01((0.28 - env.ecology) / 0.28), reason: "生物圈健康持续恶化" });
  }
  if (env.surfaceTempC < -25) {
    active.set("planetaryWinter", { severity: clamp01((-25 - env.surfaceTempC) / 45), reason: "母星进入长期低温状态" });
  }

  for (const crisis of hazard.crises) {
    if (!active.has(crisis.kind)) {
      crisis.active = false;
      crisis.endYear = year;
    }
  }
  for (const [kind, info] of active) {
    const existing = hazard.crises.find((c) => c.kind === kind && c.active);
    if (existing) {
      existing.severity = Math.max(existing.severity, info.severity);
      existing.description = info.reason;
    } else {
      hazard.crises.push({
        id: hazard.nextId++,
        kind,
        title: CRISIS_TITLES[kind],
        description: info.reason,
        severity: info.severity,
        startYear: year,
        endYear: year,
        active: true,
        mitigated: 0,
      });
      logs.push({ category: "hazard", severity: "warning", message: `危机爆发：${CRISIS_TITLES[kind]} — ${info.reason}` });
    }
  }
  if (hazard.crises.length > 40) hazard.crises = hazard.crises.slice(-40);
  return logs;
}

/** Extra stability / production penalty contributed by active crises. */
export function crisisPenalty(hazard: HazardState): { stabilityPenalty: number; foodMultiplier: number; energyDemandMultiplier: number } {
  let stabilityPenalty = 0;
  let foodMultiplier = 1;
  let energyDemandMultiplier = 1;
  for (const c of hazard.crises) {
    if (!c.active) continue;
    stabilityPenalty += 4 + c.severity * 12;
    if (c.kind === "famine" || c.kind === "ecologicalCollapse" || c.kind === "planetaryWinter") {
      foodMultiplier *= clamp(1 - c.severity * 0.3, 0.35, 1);
    }
    if (c.kind === "energyCrisis" || c.kind === "planetaryWinter") {
      energyDemandMultiplier *= clamp(1 + c.severity * 0.25, 1, 1.7);
    }
  }
  return { stabilityPenalty, foodMultiplier, energyDemandMultiplier };
}

export function hazardRiskLevel(hazard: HazardState): "calm" | "watch" | "alert" | "critical" {
  const severity = hazard.activeHazards.reduce((m, h) => Math.max(m, h.severity), 0);
  if (severity > 0.7 || hazard.stress > 0.7) return "critical";
  if (severity > 0.4 || hazard.stress > 0.4 || hazard.warnings.some((w) => w.confidence > 0.5)) return "alert";
  if (severity > 0.12 || hazard.warnings.length > 0) return "watch";
  return "calm";
}

/** Convert the hazard log to game log entries (keeps hazards decoupled from the logger). */
export function hazardLogsToEntries(logs: HazardLog[], year: number, turn: number, nextId: number): LogEntry[] {
  return logs.map((l, i) => ({
    id: nextId + i,
    year,
    turn,
    category: l.category,
    severity: l.severity,
    message: l.message,
  }));
}

export function detectionsFromHazards(hazard: HazardState): HazardEvent[] {
  return hazard.activeHazards.filter((h) => h.detected);
}

export function starNameForId(id: StarId): string {
  return { A: "赤曜", B: "青曜", C: "幽曜" }[id];
}

export type { CrisisEvent };
