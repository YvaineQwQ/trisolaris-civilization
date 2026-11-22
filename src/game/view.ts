/**
 * ViewModel assembly. This is the ONLY data path from simulation to UI.
 * It deliberately exposes observed estimates instead of true physics values
 * wherever the player has not measured them.
 */
import { CONFIDENCE_LABELS, DIFFICULTIES, ERA_MAX, OBSERVATORY_LEVELS, RESOURCE_UNLOCK_ERA, TURN_YEARS } from "../core/constants";
import type {
  GameState, LogEntry, ResourceId, StarId, WeatherKind,
} from "../core/types";
import { clamp, clamp01 } from "../core/math";
import { BASE_HOUSING } from "../civilization/state";
import {
  RESOURCE_DEFS, RESOURCE_IDS, computeCapacity, isResourceCritical, resourceName,
  BASE_RESOURCE_CAPACITY,
} from "../civilization/resources";
import { STABILITY_FACTOR_LABELS, stabilityDisplay } from "../civilization/stability";
import { BUILDING_DEFS, BUILDING_CATEGORY_NAMES, buildingMaxCount, getBuildingDef } from "../buildings/definitions";
import {
  aggregateBuildingEffects, checkBuild, getBuildingCount, totalHousing, totalMaintenance,
  totalWorkers, describeEffects,
} from "../buildings/system";
import {
  TECH_BRANCHES, TECH_BRANCH_ORDER, TECH_SCHOOLS, TECH_SCHOOL_ORDER, techsByBranch,
} from "../technology/tree";
import {
  activeResearchInfo, aggregateTechEffects, canResearch, derivedSchoolPoints, doctrineGroups,
  getTechMultipliers, schoolMastery, techDisplayName,
} from "../technology/system";
import { buildTaskOptions, levelInfo, maxLevel } from "../observation/observatory";
import {
  observationTaskViewData, predictionViewData, targetLabel,
} from "../observation/observation";
import { buildingEra, eraStatus, resourceUnlocked } from "../civilization/eras";
import { hazardRiskLevel } from "../events/hazards";
import { STAR_BASE_NAMES, STAR_COLORS } from "../core/constants";
import type { Game } from "./game";
import { politicsView } from "./politics-view";
import { eventsView } from "./events-view";
import type {
  AlertView, BuildingView, BuildingsView, BuiltBuildingView, CivView, DiscoveryView, EnvironmentView,
  FlowCostView, HazardView, HazardsView, ObjectiveView, ObservationView,
  ObservationTaskOptionView, ObservatoryView, ObservedPlanetView, ObservedStarView, QueueView,
  ResourceView, StabilityFactorView, TechBranchView, TechTreeView, TechView, ViewModel, WarningView,
  CrisisView, DoctrineGroupView, TechSchoolView,
} from "./viewTypes";

const MODE_NAMES: Record<string, string> = {
  story: "剧情模式", normal: "标准模式", survival: "生存模式", sandbox: "沙盒模式",
};

const HAZARD_KIND_LABELS: Record<string, string> = {
  closeEncounter: "恒星接近",
  radiationSurge: "辐射风暴",
  heatExtreme: "极端高温",
  coldExtreme: "极端严寒",
  orbitDestabilization: "轨道扰动",
};

const CRISIS_KIND_TITLES: Record<string, string> = {
  famine: "饥荒",
  waterShortage: "水资源危机",
  energyCrisis: "能源危机",
  unrest: "社会动荡",
  ecologicalCollapse: "生态崩溃",
  planetaryWinter: "行星寒冬",
};

const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: "晴朗", cloudy: "多云", storm: "风暴", ash: "灰霾", freezing: "冰封", scorching: "灼热",
};

const MODE_HINTS: Record<string, string> = {
  story: "剧情模式：沿着文明的五个时代推进，体验观测、预测与抉择。",
  normal: "标准模式：混沌按真实物理演化，建设、观测、预测并活下去。",
  survival: "生存模式：存续 160 年即为胜利，资源与环境惩罚更严苛。",
  sandbox: "沙盒模式：不会因文明崩溃失败，可自由测试建筑与科技路线。",
};

function confidenceMeta(value: number): { label: string; tone: "good" | "ok" | "warn" | "bad" } {
  const found = CONFIDENCE_LABELS.find((c) => value >= c.min) ?? CONFIDENCE_LABELS[CONFIDENCE_LABELS.length - 1];
  return { label: found.label, tone: found.tone as "good" | "ok" | "warn" | "bad" };
}

function flowCosts(costs: Partial<Record<ResourceId, number>>, civ: GameState["civ"]): FlowCostView[] {
  const out: FlowCostView[] = [];
  for (const id of RESOURCE_IDS) {
    const amount = costs[id] ?? 0;
    if (amount <= 0) continue;
    const have = civ.resources[id]?.amount ?? 0;
    out.push({ resourceId: id, name: resourceName(id), amount, affordable: have >= amount, have });
  }
  return out;
}

function resourceViews(state: GameState): ResourceView[] {
  const bfx = aggregateBuildingEffects(state.buildings, BUILDING_DEFS, state.civ.era);
  return RESOURCE_IDS.map((id) => {
    const def = RESOURCE_DEFS[id];
    const stock = state.civ.resources[id];
    const flow = state.civ.flows[id] ?? { produced: 0, consumed: 0, net: 0 };
    const unlockEra = RESOURCE_UNLOCK_ERA[id] ?? 1;
    const locked = !resourceUnlocked(state.civ.era, id);
    const capacity = Math.max(1, BASE_RESOURCE_CAPACITY[id] + (bfx.capacity?.[id] ?? 0));
    return {
      id,
      name: def.name,
      short: def.short,
      unit: def.unit,
      color: def.color,
      amount: locked ? 0 : stock?.amount ?? 0,
      capacity: locked ? 0 : stock?.capacity ?? capacity,
      produced: locked ? 0 : flow.produced,
      consumed: locked ? 0 : flow.consumed,
      net: locked ? 0 : flow.net,
      ratio: locked ? 0 : clamp01((stock?.amount ?? 0) / Math.max(1, stock?.capacity ?? capacity)),
      critical: locked ? false : stock ? isResourceCritical(stock) : true,
      description: def.description,
      locked,
      unlockEra,
    };
  });
}

function stabilityFactorViews(state: GameState): StabilityFactorView[] {
  return (Object.keys(state.civ.stabilityFactors) as (keyof typeof state.civ.stabilityFactors)[]).map((key) => ({
    key,
    label: STABILITY_FACTOR_LABELS[key] ?? key,
    value: clamp(state.civ.stabilityFactors[key] ?? 0, 0, 100),
  }));
}

function civView(state: GameState, game: Game): CivView {
  const civ = state.civ;
  const bfx = aggregateBuildingEffects(state.buildings, BUILDING_DEFS, state.civ.era);
  const housingCapacity = (BASE_HOUSING + (bfx.housing ?? 0)) * getTechMultipliers(state.tech).populationCapacity;
  const workforce = civ.workforce;
  const jobs = Math.max(0, totalWorkers(state.buildings));
  const employed = Math.min(workforce, jobs);
  const research = activeResearchInfo(state.tech);
  const era = eraStatus(civ, state.tech, state.buildings, state.observation.level);
  const stability = stabilityDisplay(civ.stability);
  return {
    population: {
      total: Math.round(civ.population),
      housing: Math.round(Math.max(civ.housing, housingCapacity)),
      growthPerYear: civ.growthPerYear,
      workforce: Math.round(workforce),
      jobs: Math.round(jobs),
      employed: Math.round(employed),
      unemploymentRate: civ.unemploymentRate,
      housingRatio: housingCapacity / Math.max(1, civ.population),
    },
    stability: {
      value: civ.stability,
      label: stability.label,
      tone: stability.tone,
      factors: stabilityFactorViews(state),
    },
    science: {
      rate: civ.scienceRate > 0 ? civ.scienceRate : state.civ.flows.science?.produced ?? 0,
      activeTechId: state.tech.activeTech,
      activeTechName: research?.name ?? (state.tech.activeTech ? techDisplayName(state.tech.activeTech) : null),
      progress: research?.progress ?? 0,
      cost: research?.cost ?? 0,
      percent: research?.percent ?? 0,
      etaTurns: research && civ.scienceRate > 0 ? Math.ceil(research.remaining / Math.max(1e-6, civ.scienceRate)) : null,
    },
    industry: {
      capacity: civ.industryCapacity,
      used: civ.industryUsed,
      free: Math.max(0, civ.industryCapacity - civ.industryUsed),
      queueTurns: state.buildings.queue.reduce((m, job) => Math.max(m, Math.ceil(job.turnsLeft)), 0),
    },
    era: {
      value: era.era,
      name: era.def.name,
      subtitle: era.def.subtitle,
      description: era.def.description,
      progress: era.progress,
      nextThreshold: era.next ? era.next.name : "已达最终时代",
      nextEraName: era.next ? era.next.name : null,
      nextEraSubtitle: era.next ? era.next.subtitle : null,
      requirements: era.requirements.map((r) => ({
        id: r.id,
        label: r.label,
        current: r.current,
        target: r.target,
        unit: r.unit ?? "",
        met: r.met,
      })),
      canAdvance: era.canAdvance,
      unlockSummary: era.unlockSummary,
    },
    colony: civ.colony
      ? {
          exists: true,
          name: civ.colony.name,
          population: Math.round(civ.colony.population),
          selfSufficiency: civ.colony.selfSufficiency,
          integrity: civ.colony.integrity,
          level: civ.colony.level,
        }
      : null,
    unlocks: { ...civ.unlockFlags },
  };
}

function buildingViews(state: GameState): BuildingsView {
  const techEffects = aggregateTechEffects(state.tech);
  const built: BuiltBuildingView[] = [];
  for (const def of BUILDING_DEFS) {
    const count = getBuildingCount(state.buildings, def.id);
    if (count <= 0) continue;
    built.push({ id: def.id, name: def.name, icon: def.icon, count, description: def.description });
  }
  let upgradableCount = 0;
  const available: BuildingView[] = BUILDING_DEFS.map((def) => {
    const check = checkBuild(def.id, state.civ, state.buildings, state.tech, techEffects, state.meta.mode);
    const maxCount = buildingMaxCount(def.id);
    const era = buildingEra(def);
    const targetDef = def.upgradeTo ? BUILDING_DEFS.find((d) => d.id === def.upgradeTo) ?? null : null;
    const targetEra = targetDef ? buildingEra(targetDef) : era;
    const upgradeCosts = targetDef ? flowCosts(targetDef.upgradeCost ?? {}, state.civ) : [];
    let upgradeBlockedReason: string | null = null;
    if ((state.buildings.counts[def.id] ?? 0) <= 0) upgradeBlockedReason = "尚未建造";
    else if (!targetDef) upgradeBlockedReason = "已是本升级链末端";
    else if (state.civ.era < targetEra) upgradeBlockedReason = "需要第 " + targetEra + " 时代";
    else if (upgradeCosts.some((c) => !c.affordable)) upgradeBlockedReason = "升级资源不足";
    const canUpgrade = upgradeBlockedReason === null;
    if (canUpgrade) upgradableCount += 1;
    return {
      id: def.id,
      name: def.name,
      category: def.category,
      categoryName: BUILDING_CATEGORY_NAMES[def.category] ?? def.category,
      description: def.description,
      icon: def.icon,
      cost: flowCosts(def.cost, state.civ),
      buildTurns: def.buildTurns,
      maintenance: flowCosts(def.maintenance, state.civ),
      workers: def.workers,
      effects: describeEffects(def),
      canBuild: check.ok,
      blockedReason: check.reason,
      count: getBuildingCount(state.buildings, def.id),
      maxCount,
      era,
      tier: def.tier ?? era,
      upgradeToId: def.upgradeTo ?? null,
      upgradeToName: targetDef?.name ?? null,
      upgradeCost: upgradeCosts,
      upgradeTurns: targetDef?.upgradeTurns ?? targetDef?.buildTurns ?? def.buildTurns,
      canUpgrade,
      upgradeBlockedReason,
      outdated: getBuildingCount(state.buildings, def.id) > 0 && era < state.civ.era,
    };
  });
  const queue: QueueView[] = state.buildings.queue.map((job) => {
    const def = getBuildingDef(job.buildingId);
    const fromDef = job.upgradeFrom ? getBuildingDef(job.upgradeFrom) : null;
    return {
      jobId: job.id,
      buildingId: job.buildingId,
      name: def?.name ?? job.buildingId,
      icon: def?.icon ?? "build",
      turnsLeft: Math.max(0, Math.ceil(job.turnsLeft)),
      totalTurns: job.totalTurns,
      progress: clamp01(1 - job.turnsLeft / Math.max(1e-6, job.totalTurns)),
      kind: job.upgradeFrom ? "upgrade" : "build",
      upgradeFromId: job.upgradeFrom ?? null,
      upgradeFromName: fromDef?.name ?? null,
    };
  });
  return {
    built,
    available,
    queue,
    totalMaintenance: flowCosts(totalMaintenance(state.buildings), state.civ),
    currentEra: state.civ.era,
    upgradableCount,
  };
}

function techTreeView(state: GameState): TechTreeView {
  const branches: TechBranchView[] = TECH_BRANCH_ORDER.map((branch) => {
    const meta = TECH_BRANCHES[branch];
    const techs: TechView[] = techsByBranch(branch).map((tech) => {
      const researched = state.tech.researched.includes(tech.id);
      const check = researched ? { ok: false, reason: "已研究" } : canResearch(tech.id, state.tech, state.civ.era);
      const chosenInGroup = tech.exclusiveGroup
        ? state.tech.doctrineChoices?.[tech.exclusiveGroup] ?? null
        : null;
      const exclusiveChosen = Boolean(tech.exclusiveGroup && chosenInGroup === tech.id);
      const exclusiveBlockedBy = tech.exclusiveGroup && chosenInGroup && chosenInGroup !== tech.id
        ? techDisplayName(chosenInGroup)
        : null;
      return {
        id: tech.id,
        name: tech.name,
        branch: tech.branch,
        branchName: meta?.name ?? tech.branch,
        tier: tech.tier,
        cost: tech.cost,
        description: tech.description,
        descriptionLong: tech.descriptionLong,
        flavor: tech.flavor,
        effectSummary: tech.effectSummary,
        effectsDetail: tech.effectsDetail,
        requires: tech.requires,
        requiresNames: tech.requires.map((id) => techDisplayName(id)),
        researched,
        available: !researched && check.ok && !exclusiveBlockedBy,
        blockedReason: researched ? null : exclusiveBlockedBy ? "已选择其他教义：" + exclusiveBlockedBy : check.reason,
        isActive: state.tech.activeTech === tech.id,
        era: tech.tier,
        school: tech.school,
        schoolName: tech.school ? TECH_SCHOOLS[tech.school]?.name ?? tech.school : undefined,
        exclusiveGroup: tech.exclusiveGroup,
        exclusiveChosen,
        exclusiveBlockedBy,
      };
    });
    return {
      id: branch,
      name: meta?.name ?? branch,
      icon: meta?.icon ?? "tech",
      description: meta?.description ?? "",
      color: meta?.color ?? "#8ab4ff",
      researchedCount: techs.filter((t) => t.researched).length,
      total: techs.length,
      techs,
    };
  });
  const allTechs = branches.flatMap((b) => b.techs);
  const schools: TechSchoolView[] = TECH_SCHOOL_ORDER.map((id) => {
    const meta = TECH_SCHOOLS[id];
    const techs = allTechs.filter((tech) => tech.school === id);
    return {
      id,
      name: meta?.name ?? id,
      short: meta?.short ?? id,
      description: meta?.description ?? "",
      color: meta?.color ?? "#8ab4ff",
      researchedCount: techs.filter((t) => t.researched).length,
      total: techs.length,
      points: Math.round(derivedSchoolPoints(state.tech, id)),
      mastery: Math.round(schoolMastery(state.tech, id) * 100) / 100,
      focused: state.tech.schoolFocus === id,
    };
  });
  const doctrines: DoctrineGroupView[] = doctrineGroups(state.tech).map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    chosenTechId: group.chosenTechId,
    options: group.options.map((option) => ({
      techId: option.techId,
      name: option.name,
      description: option.description,
      chosen: option.chosen,
      researched: option.researched,
    })),
  }));
  return {
    branches,
    schools,
    schoolFocus: state.tech.schoolFocus ?? null,
    doctrines,
    researchedTotal: allTechs.filter((t) => t.researched).length,
    totalTechs: allTechs.length,
    activeTechId: state.tech.activeTech,
  };
}

function observatoryView(state: GameState): ObservatoryView {
  const info = levelInfo(state.observation.level);
  const next = state.observation.level >= maxLevel() ? null : OBSERVATORY_LEVELS[state.observation.level + 1];
  let nextView: ObservatoryView["next"] = null;
  if (next) {
    const upgradeCosts = {
      minerals: next.upgradeCost.minerals,
      metals: next.upgradeCost.metals,
      energy: next.upgradeCost.energy,
      science: next.upgradeScience,
    } as Partial<Record<ResourceId, number>>;
    const check = checkUpgradeSafe(state, next.level);
    nextView = state.observation.level <= 0 ? null : {
      level: next.level,
      name: next.name,
      description: next.description,
      capabilities: next.capabilities,
      upgradeScience: next.upgradeScience,
      cost: flowCosts(upgradeCosts, state.civ),
      requiresTech: next.requiresTech,
      requiresTechName: next.requiresTech ? techDisplayName(next.requiresTech) : null,
      canUpgrade: state.observation.level > 0 && check.ok,
      blockedReason: state.observation.level <= 0
        ? "先在建造面板建成观星台（获得 Lv.1）"
        : check.reason,
      requiresEra: next.requiresEra,
      eraOk: state.civ.era >= next.requiresEra,
    };
  }
  return {
    era: state.civ.era,
    level: state.observation.level,
    maxLevel: maxLevel(),
    name: info.name,
    description: info.description,
    capabilities: info.capabilities,
    equipmentName: `观测设备 Lv.${state.observation.equipmentLevel}`,
    dataPoints: state.observation.dataPoints,
    efficiency: state.observation.efficiency,
    next: nextView,
  };
}

function checkUpgradeSafe(state: GameState, nextLevel: number): { ok: boolean; reason: string | null } {
  const next = OBSERVATORY_LEVELS[nextLevel];
  if (!next) return { ok: false, reason: "已达最高观测等级" };
  if (next.requiresTech && !state.tech.researched.includes(next.requiresTech)) {
    return { ok: false, reason: "需要科技：" + techDisplayName(next.requiresTech) };
  }
  if (state.civ.resources.minerals.amount < next.upgradeCost.minerals) return { ok: false, reason: "矿物不足" };
  if (state.civ.resources.metals.amount < next.upgradeCost.metals) return { ok: false, reason: "金属不足" };
  if (state.civ.resources.energy.amount < next.upgradeCost.energy) return { ok: false, reason: "能源不足" };
  if (state.civ.resources.science.amount < next.upgradeScience) return { ok: false, reason: "科研点不足" };
  return { ok: true, reason: null };
}

const UNKNOWN_MOTION_AU_PER_YEAR = 2.2;
const MAX_DISPLAY_SIGMA_AU = 8;

/** Positional uncertainty for display: grows while motion is unknown. */
function displaySigma(state: GameState, id: StarId): number | null {
  const est = state.observation.stars[id];
  if (!est?.known.position) return null;
  const base = est.sigmaPos;
  const age = Math.max(0, state.observation.lastModelSyncYear - est.lastMeasuredYear);
  if (est.known.velocity && state.observation.playerModel?.valid) {
    return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * Math.max(0.05, est.sigmaVel) * 2);
  }
  return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * UNKNOWN_MOTION_AU_PER_YEAR);
}

function displayPlanetSigma(state: GameState): number | null {
  const planet = state.observation.planet;
  if (!planet) return null;
  const base = planet.sigmaPos ?? 0.2;
  if (state.observation.playerModel?.valid) return base;
  const age = Math.max(0, state.observation.lastModelSyncYear - planet.lastMeasuredYear);
  return Math.min(MAX_DISPLAY_SIGMA_AU, base + age * 1.1);
}

function observedStarViews(state: GameState): ObservedStarView[] {
  const ids: StarId[] = ["A", "B", "C"];
  const planet = state.observation.planet;
  return ids.map((id) => {
    const est = state.observation.stars[id];
    const conf = confidenceMeta(est?.confidence ?? 0);
    const relation = planet && est
      ? Math.hypot(est.pos.x - planet.pos.x, est.pos.y - planet.pos.y, est.pos.z - planet.pos.z)
      : null;
    return {
      id,
      name: est?.name ?? STAR_BASE_NAMES[id] ?? id,
      color: est?.color ?? STAR_COLORS[id] ?? "#ffffff",
      known: { ...(est?.known ?? { position: false, distance: false, velocity: false, mass: false, acceleration: false, orbit: false }) },
      pos: { ...(est?.pos ?? { x: 0, y: 0, z: 0 }) },
      height: est?.height ?? 0,
      inclination: est?.known.orbit ? (est?.inclinationRad ?? null) : null,
      distance: est?.known.distance ? Math.hypot(est.pos.x, est.pos.y, est.pos.z) : null,
      speed: est?.known.velocity ? est.speed : null,
      mass: est?.known.mass ? est.mass : null,
      sigmaPos: displaySigma(state, id),
      sigmaVel: est?.known.velocity ? est.sigmaVel : null,
      sigmaMass: est?.known.mass ? est.sigmaMass : null,
      confidence: est?.confidence ?? 0,
      confidenceLabel: conf.label,
      confidenceTone: conf.tone,
      lastMeasuredYear: est?.lastMeasuredYear ?? 0,
      sampleCount: est?.sampleCount ?? 0,
      eccentricity: est?.known.orbit ? est.eccentricity : null,
      relationToPlanetAU: relation,
    };
  });
}

function observedPlanetView(state: GameState): ObservedPlanetView | null {
  const planet = state.observation.planet;
  if (!planet) return null;
  return {
    pos: { ...planet.pos },
    height: planet.height,
    inclination: planet.known.orbit ? planet.inclinationRad : null,
    distanceFromPrimary: planet.distanceFromPrimary,
    tempC: planet.tempC,
    sigmaPos: displayPlanetSigma(state),
    habitability: planet.habitability,
    orbitRadius: planet.orbitRadius,
    eccentricity: planet.eccentricity,
    confidence: planet.confidence,
    lastMeasuredYear: planet.lastMeasuredYear,
    known: {
      distance: planet.known.distance,
      temperature: planet.tempC !== null && planet.tempC !== undefined,
      orbit: planet.known.orbit,
    },
  };
}

function observationView(state: GameState): ObservationView {
  const obs = state.observation;
  const costResource: "food" | "energy" = state.civ.era >= 3 ? "energy" : "food";
  const options: ObservationTaskOptionView[] = buildTaskOptions({
    level: obs.level,
    energy: state.civ.resources[costResource].amount,
    taskActive: Boolean(obs.activeTask),
  }).map((option) => ({
    ...option,
    costResource,
    costLabel: (costResource === "energy" ? "能源" : "食物") + " " + option.energyCost,
  }));
  const discoveries: DiscoveryView[] = obs.discoveries.map((d) => ({
    id: d.id, year: d.year, title: d.title, detail: d.detail, category: d.category, evidence: d.evidence,
  }));
  const lastYear = obs.history.length > 0 ? obs.history[obs.history.length - 1].year : obs.lastCalibrationYear;
  return {
    stars: observedStarViews(state),
    planet: observedPlanetView(state),
    activeTask: observationTaskViewData(obs),
    taskOptions: options,
    discoveries,
    lastObservationYear: lastYear,
    dataPoints: obs.dataPoints,
    hasModel: Boolean(obs.playerModel && obs.playerModel.valid),
    modelAccuracy: obs.playerModel?.accuracy ?? null,
    modelHorizon: obs.playerModel?.horizonYears ?? null,
    modelNote: obs.playerModel?.note ?? null,
    observedTrailAvailable: Object.values(obs.observedTrail).some((trail) => (trail?.length ?? 0) > 1),
  };
}

function environmentView(state: GameState): EnvironmentView {
  const env = state.environment;
  const history = env.temperatureHistory.slice(-160);
  const trend = history.length > 8
    ? env.surfaceTempC - history[history.length - 9].tempC
    : 0;
  return {
    tempC: env.surfaceTempC,
    equilibriumTempC: env.equilibriumTempC,
    flux: env.stellarFlux,
    fluxAnomaly: env.fluxAnomaly,
    habitability: env.habitability,
    ecology: env.ecology,
    water: env.water,
    atmosphere: env.atmosphere,
    weather: env.weather,
    weatherLabel: WEATHER_LABELS[env.weather] ?? env.weather,
    greenhouseK: env.greenhouseK,
    albedo: env.albedo,
    history,
    populationHistory: state.civ.populationHistory.slice(-160),
    tempTrend: trend,
    stressLabel: env.surfaceTempC > 55 ? "灼热" : env.surfaceTempC > 35 ? "偏热" : env.surfaceTempC < -20 ? "严寒" : env.surfaceTempC < 5 ? "偏冷" : "温和",
  };
}

function hazardsView(state: GameState): HazardsView {
  const h = state.hazards;
  const hazards: HazardView[] = h.activeHazards.filter((item) => item.detected).map((item) => ({
    id: item.id,
    kind: item.kind,
    kindLabel: HAZARD_KIND_LABELS[item.kind] ?? item.kind,
    title: item.title,
    description: item.description,
    severity: item.severity,
    severityLabel: item.severity > 0.7 ? "致命" : item.severity > 0.45 ? "严重" : item.severity > 0.2 ? "中等" : "轻微",
    startYear: item.startYear,
    peakYear: item.peakYear,
    endYear: item.endYear,
    detected: item.detected,
    confidence: item.confidence,
  }));
  const warnings: WarningView[] = h.warnings.map((w) => ({
    id: w.id,
    kind: w.kind,
    title: w.title,
    description: w.description,
    leadYears: w.leadYears,
    confidence: w.confidence,
    severityEstimate: w.severityEstimate,
    createdYear: w.createdYear,
  }));
  const crises: CrisisView[] = h.crises.filter((c) => c.active).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title || CRISIS_KIND_TITLES[c.kind] || c.kind,
    description: c.description,
    severity: c.severity,
    active: c.active,
    mitigated: c.mitigated,
    startYear: c.startYear,
  }));
  const risk = hazardRiskLevel(h);
  const riskLabels = { calm: "平静", watch: "关注", alert: "警戒", critical: "危急" };
  return {
    hazards,
    warnings,
    crises,
    stress: h.stress,
    historyStress: h.historyStress.slice(-80),
    riskLevel: risk,
    riskLabel: riskLabels[risk],
  };
}

function objectives(state: GameState): ObjectiveView[] {
  const years = state.yearsElapsed;
  const population = state.civ.population;
  const hasColony = Boolean(state.civ.colony);
  const out: ObjectiveView[] = [];
  const push = (id: string, title: string, detail: string, progress: number, target: number): void => {
    out.push({ id, title, detail, progress: Math.min(progress, target), target, complete: progress >= target });
  };
  if (state.meta.mode === "survival") {
    push("survive-50", "存续 50 年", "让文明活过最初的半个世纪", Math.min(50, years), 50);
    push("survive-100", "存续 100 年", "在混沌中维持文明的火种", Math.min(100, years), 100);
    push("survive-160", "存续 160 年", "达到生存模式的胜利条件", Math.min(160, years), 160);
  } else if (state.meta.mode === "sandbox") {
    push("sandbox-build", "自由建设", "建造任意 6 座建筑", Object.values(state.buildings.counts).reduce((a, b) => a + b, 0), 6);
    push("sandbox-research", "自由研究", "完成 5 项科技", state.tech.researched.length, 5);
  } else {
    push("obs-2", "升级专业天文台", "将天文台升级至 Lv.2", state.observation.level, 2);
    push("obs-4", "轨道动力学研究所", "将天文台升级至 Lv.4", state.observation.level, 4);
    push("era-3", "进入混沌时代", "时代推进至第 3 时代", state.civ.era, 3);
    push("pop-2000", "人口达到 2000", "让文明拥有足够的人口基础", Math.round(population), 2000);
    push("colony", "建立星际殖民地", "在另一颗星球点亮文明的灯火", hasColony ? 1 : 0, 1);
    if (state.meta.mode === "story") {
      push("era-5", "抵达文明的选择", "时代推进至第 5 时代", state.civ.era, 5);
    }
  }
  return out;
}

function alerts(state: GameState, hazards: HazardsView): AlertView[] {
  const out: AlertView[] = [];
  const civ = state.civ;
  const energyUnlocked = resourceUnlocked(civ.era, "energy") && state.civ.era >= 3;
  if (civ.resources.food.amount < civ.population * 0.3) {
    out.push({ id: "food", severity: "critical", title: "粮食储备告急", detail: "食物不足以支撑文明度过后半个回合。" });
  }
  if (energyUnlocked && civ.resources.energy.amount < 30) {
    out.push({ id: "energy", severity: "warning", title: "能源储备偏低", detail: "观测任务与建造将受到限制。" });
  }
  if (civ.stability < 35) {
    out.push({ id: "stability", severity: "critical", title: "社会稳定度危险", detail: "稳定度低于 35，社会动荡正在酝酿。" });
  }
  for (const hazard of hazards.hazards.slice(0, 2)) {
    if (hazard.severity > 0.45) {
      out.push({ id: "hazard-" + hazard.id, severity: "critical", title: hazard.title, detail: hazard.description });
    }
  }
  for (const warning of hazards.warnings.slice(0, 1)) {
    if (warning.confidence > 0.4) {
      out.push({ id: "warn-" + warning.id, severity: "warning", title: warning.title, detail: warning.description });
    }
  }
  if (state.observation.activeTask === null && state.observation.level < 3) {
    out.push({ id: "obs", severity: "info", title: "观测能力有限", detail: "继续观测并升级天文台，才能看见恒星的完整运动。" });
  }
  return out.slice(0, 5);
}

function endingView(state: GameState): ViewModel["ending"] {
  if (!state.gameOver) return null;
  return {
    victory: state.victory,
    title: state.endingTitle ?? (state.victory ? "文明延续" : "文明终结"),
    text: state.endingText ?? "",
    stats: [
      { label: "种子", value: state.meta.seed },
      { label: "存续时间", value: state.yearsElapsed.toFixed(1) + " 年" },
      { label: "时代", value: "第 " + state.civ.era + " 时代" },
      { label: "最终人口", value: Math.round(state.civ.population).toLocaleString("zh-CN") },
      { label: "观测等级", value: "Lv." + state.observation.level },
      { label: "科技", value: state.tech.researched.length + " 项" },
      { label: "殖民地", value: state.civ.colony ? state.civ.colony.name + " Lv." + state.civ.colony.level : "无" },
    ],
  };
}

export function buildViewModel(game: Game): ViewModel {
  const state = game.state;
  const era = eraStatus(state.civ, state.tech, state.buildings, state.observation.level);
  const hazards = hazardsView(state);
  const difficulty = DIFFICULTIES[state.meta.difficulty];
  const year = state.meta.calendarStartYear + state.yearsElapsed;
  return {
    meta: {
      seed: state.meta.seed,
      difficultyKey: state.meta.difficulty,
      difficultyName: difficulty?.name ?? state.meta.difficulty,
      mode: state.meta.mode,
      modeName: MODE_NAMES[state.meta.mode] ?? state.meta.mode,
      galaxyClassName: state.meta.galaxy?.name ?? "未知星系",
      galaxyClass: state.meta.galaxy?.kind ?? "unknown",
      year: state.yearsElapsed,
      calendarYear: year,
      turn: state.civ.turn,
      era: era.def.era,
      eraName: era.def.name,
      eraSubtitle: era.def.subtitle,
      eraDescription: era.def.description,
      paused: game.pausedValue,
      speedIndex: game.speedIndexState,
      speedValue: game.speedValue,
      running: !game.pausedValue && !state.gameOver,
      victory: state.victory,
      gameOver: state.gameOver,
      endingTitle: state.endingTitle,
      defeatReason: state.civ.defeatReason,
      modeHint: MODE_HINTS[state.meta.mode] ?? "",
    },
    resources: resourceViews(state),
    civ: civView(state, game),
    buildings: buildingViews(state),
    tech: techTreeView(state),
    observatory: observatoryView(state),
    observation: observationView(state),
    environment: environmentView(state),
    hazards,
    politics: politicsView(state.politics, state.civ.turn),
    events: eventsView(state),
    prediction: predictionViewData(state.observation),
    objectives: objectives(state),
    alerts: alerts(state, hazards),
    log: game.log.all().slice(-140).reverse(),
    selection: game.selection,
    settings: { ...game.settings },
    saving: null,
    ending: endingView(state),
  };
}
