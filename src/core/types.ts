import type { Vec2, Vec3 } from "./math";
import type { DifficultyKey } from "./constants";
export type { Vec2, Vec3, DifficultyKey };

/** ---------------------------------------------------------------- *
 *  PHYSICS DOMAIN  (true state - never rendered directly to player) *
 *  ---------------------------------------------------------------- */

export type StarId = "A" | "B" | "C";

export interface StarBody {
  id: StarId;
  name: string;
  /** Solar masses. */
  mass: number;
  /** AU. */
  radius: number;
  /** Solar luminosities. */
  luminosity: number;
  /** Effective surface temperature, K. */
  surfaceTempK: number;
  color: string;
  pos: Vec3;
  vel: Vec3;
  acc: Vec3;
  /** True trajectory history (diagnostics only; renderer must use observed data). */
  trail: Vec3[];
  lastTrailTime: number;
}

export interface PlanetBody {
  id: "P";
  name: string;
  /** Earth masses. */
  mass: number;
  /** Physical radius, km. */
  radiusKm: number;
  pos: Vec3;
  vel: Vec3;
  acc: Vec3;
  /** Bond albedo 0..1. */
  albedo: number;
  /** Greenhouse forcing, Kelvin added to equilibrium temperature. */
  greenhouseK: number;
  /** Thermal response time constant in years. */
  thermalTauYears: number;
  /** 0..1 water availability (ice + liquid + vapor as accessible resource). */
  water: number;
  /** 0..1 atmospheric column density factor (1 = Earth-like). */
  atmosphere: number;
  /** 0..1 biosphere health. */
  ecology: number;
  trail: Vec3[];
  lastTrailTime: number;
  alive: boolean;
}

export interface PhysicsDiagnostics {
  initialEnergy: number;
  totalEnergy: number;
  energyDrift: number;
  initialMomentum: Vec3;
  totalMomentum: Vec3;
  initialAngularMomentum: Vec3;
  totalAngularMomentum: Vec3;
  maxAcceleration: number;
  overflow: boolean;
  /** Integration steps executed. */
  steps: number;
  collisionCount: number;
}

export interface CollisionRecord {
  timeYears: number;
  between: [StarId, StarId];
  action: "merged" | "softened";
  separationAU: number;
}

export interface PhysicsState {
  stars: StarBody[];
  planet: PlanetBody;
  timeYears: number;
  dtYears: number;
  softening: number;
  diagnostics: PhysicsDiagnostics;
  collisions: CollisionRecord[];
  planetAlive: boolean;
  planetEjected: boolean;
}

/** ---------------------------------------------------------------- *
 *  ENVIRONMENT                                                      *
 *  ---------------------------------------------------------------- */

export type WeatherKind = "clear" | "cloudy" | "storm" | "ash" | "freezing" | "scorching";

export interface EnvironmentState {
  /** Total stellar flux at the planet, in Earth solar constants (S = 1). */
  stellarFlux: number;
  /** Instantaneous radiative equilibrium temperature, Celsius. */
  equilibriumTempC: number;
  /** Actual surface temperature with thermal inertia, Celsius. */
  surfaceTempC: number;
  greenhouseK: number;
  albedo: number;
  /** 0..1 habitability. */
  habitability: number;
  /** 0..1 ecological health. */
  ecology: number;
  water: number;
  atmosphere: number;
  weather: WeatherKind;
  /** Relative irradiance anomaly against the initial epoch. */
  fluxAnomaly: number;
  lastUpdateYear: number;
  /** Downsampled temperature history used by charts. */
  temperatureHistory: { year: number; tempC: number; flux: number }[];
  lastHistorySample: number;
}

/** ---------------------------------------------------------------- *
 *  OBSERVATION DOMAIN (player knowledge only)                       *
 *  ---------------------------------------------------------------- */

export type ObservationKind =
  | "star-position"
  | "star-distance"
  | "star-velocity"
  | "planet-survey"
  | "binary-relative"
  | "triple-joint"
  | "long-term"
  | "anomaly";

export const OBSERVATION_KIND_LABELS: Record<ObservationKind, string> = {
  "star-position": "单星定位",
  "star-distance": "恒星测距",
  "star-velocity": "速度测量",
  "planet-survey": "母星观测",
  "binary-relative": "双星相对观测",
  "triple-joint": "三星联合观测",
  "long-term": "长期连续观测",
  anomaly: "异常轨道分析",
};

export type StarTarget = StarId | "all" | "planet";

export interface KnownFlags {
  position: boolean;
  distance: boolean;
  velocity: boolean;
  mass: boolean;
  acceleration: boolean;
  orbit: boolean;
}

export interface StarEstimate {
  id: StarId;
  name: string;
  color: string;
  /** Player's current best estimate (AU, system frame). */
  pos: Vec3;
  vel: Vec3;
  mass: number;
  /** 1-sigma uncertainties in the same units as the quantity. */
  sigmaPos: number;
  sigmaVel: number;
  sigmaMass: number;
  /** Last time a measurement sample was folded in (years). */
  lastMeasuredYear: number;
  /** 0..1 confidence. */
  confidence: number;
  known: KnownFlags;
  /** Number of raw measurement samples collected. */
  sampleCount: number;
  /** Estimated distance from the system barycenter. */
  distanceFromBarycenter: number;
  /** Height above the reference X-Z plane (AU); player-observed vertical component. */
  height: number;
  /** Estimated orbital eccentricity vs. system barycenter when known. */
  eccentricity: number | null;
  /** Estimated orbital inclination relative to the X-Z reference plane (radians), when known. */
  inclinationRad: number | null;
  /** Estimated current speed. */
  speed: number;
}

export interface PlanetEstimate {
  pos: Vec3;
  vel: Vec3;
  distanceFromPrimary: number | null;
  /** Estimated surface temperature (Celsius). */
  tempC: number;
  sigmaPos: number;
  habitability: number;
  orbitRadius: number | null;
  eccentricity: number | null;
  inclinationRad: number | null;
  height: number;
  lastMeasuredYear: number;
  confidence: number;
  known: KnownFlags;
}

export interface StarMeasurement {
  starId: StarId;
  timeYears: number;
  pos: Vec3;
  posSigma: number;
  vel?: Vec3;
  velSigma?: number;
  mass?: number;
  massSigma?: number;
  distanceAU?: number;
  kind: ObservationKind;
}

export interface PlanetMeasurement {
  timeYears: number;
  pos: Vec3;
  posSigma: number;
  tempC?: number;
  tempSigma?: number;
  kind: ObservationKind;
}

export interface ObservationTask {
  id: string;
  kind: ObservationKind;
  target: StarTarget;
  startedYear: number;
  durationYears: number;
  elapsedYears: number;
  energyCost: number;
  turnsSpent: number;
  turnsRequired: number;
  completed: boolean;
  summary: string;
  /** Systematic error component drawn once per observation session (3D). */
  sessionBias: Vec3;
  /** How many raw measurement samples have been collected. */
  samplesCollected: number;
  /** Observation precision multiplier for this task kind. */
  sigmaMultiplier: number;
}

export interface ObservationRecord {
  id: number;
  year: number;
  kind: ObservationKind;
  target: StarTarget;
  dataGained: number;
  precisionGain: number;
  summary: string;
}

export interface Discovery {
  id: number;
  year: number;
  title: string;
  detail: string;
  category: "orbit" | "environment" | "anomaly" | "planet" | "system";
  /** Evidence string, e.g. "第3次联合观测数据". */
  evidence: string;
}

export interface PlayerModelStar {
  id: StarId;
  name: string;
  color: string;
  mass: number;
  pos: Vec3;
  vel: Vec3;
  known: KnownFlags;
}

export interface PlayerModel {
  stars: PlayerModelStar[];
  planet: { pos: Vec3; vel: Vec3; known: boolean } | null;
  createdYear: number;
  /** 0..1 overall model quality. */
  accuracy: number;
  horizonYears: number;
  valid: boolean;
  /** Human readable note on model fidelity. */
  note: string;
}

export interface PredictionStarSample {
  id: StarId;
  pos: Vec3;
  sigma: number;
}

export interface PredictionSample {
  t: number;
  stars: PredictionStarSample[];
  planet: { pos: Vec3; sigma: number } | null;
  /** Model agreement, 0..1; drops when ensemble members diverge. */
  agreement: number;
}

export interface PredictionBundle {
  createdYear: number;
  horizonYears: number;
  samples: PredictionSample[];
  diverged: boolean;
  /** Fraction of horizon after which the ensemble disagrees. */
  reliableFraction: number;
  note: string;
}

export interface ObservationState {
  /** 0..6 */
  level: number;
  equipmentLevel: number;
  stars: Record<StarId, StarEstimate>;
  planet: PlanetEstimate | null;
  history: ObservationRecord[];
  tasks: ObservationTask[];
  activeTask: ObservationTask | null;
  measurements: { stars: StarMeasurement[]; planet: PlanetMeasurement[] };
  discoveries: Discovery[];
  /** Accumulated science data points (separate from research points). */
  dataPoints: number;
  playerModel: PlayerModel | null;
  prediction: PredictionBundle | null;
  lastModelSyncYear: number;
  observedTrail: Partial<Record<StarId, Vec3[]>>;
  planetObservedTrail: Vec3[];
  nextRecordId: number;
  nextDiscoveryId: number;
  /** Observation efficiency multiplier from tech + weather. */
  efficiency: number;
  /** Set true when current model must be rebuilt after new data. */
  modelDirty: boolean;
  /** Deterministic noise seed base (seed + version) so measurements are reproducible. */
  seedBase: string;
  /** Simulated year of the last naked-eye / instrument calibration. */
  lastCalibrationYear: number;
}

/** ---------------------------------------------------------------- *
 *  CIVILIZATION                                                     *
 *  ---------------------------------------------------------------- */

export type ResourceId = "food" | "water" | "energy" | "minerals" | "metals" | "science";

export interface ResourceDef {
  id: ResourceId;
  name: string;
  short: string;
  unit: string;
  color: string;
  description: string;
}

export interface ResourceStock {
  amount: number;
  capacity: number;
}

export interface ResourceFlow {
  produced: number;
  consumed: number;
  net: number;
}

export interface StabilityFactors {
  food: number;
  water: number;
  housing: number;
  temperature: number;
  health: number;
  order: number;
}

export interface CivilizationState {
  population: number;
  housing: number;
  jobs: number;
  /** Workers actually available. */
  workforce: number;
  employment: number;
  unemploymentRate: number;
  growthPerYear: number;
  stability: number;
  stabilityFactors: StabilityFactors;
  resources: Record<ResourceId, ResourceStock>;
  flows: Record<ResourceId, ResourceFlow>;
  scienceRate: number;
  industryCapacity: number;
  industryUsed: number;
  era: number;
  turn: number;
  /** Starvation pressure accumulates when food is short. */
  starvation: number;
  /** Number of consecutive turns with critical conditions. */
  crisisStreak: number;
  alive: boolean;
  causeOfCollapse: string | null;
  colony: ColonyState | null;
  hasWon: boolean;
  defeatReason: string | null;
  populationHistory: { year: number; population: number; stability: number; tempC: number }[];
  unlockFlags: { colony: boolean; planetEngine: boolean; deepSpace: boolean };
}

export interface ColonyState {
  name: string;
  foundedYear: number;
  population: number;
  /** 0..1 how self sufficient the colony is. */
  selfSufficiency: number;
  /** 0..1 structural integrity. */
  integrity: number;
  level: number;
  lastReportYear: number;
}

/** ---------------------------------------------------------------- *
 *  BUILDINGS                                                        *
 *  ---------------------------------------------------------------- */

export type BuildingCategory = "basic" | "industry" | "science" | "advanced";

export interface BuildingEffects {
  production?: Partial<Record<ResourceId, number>>;
  capacity?: Partial<Record<ResourceId, number>>;
  housing?: number;
  research?: number;
  /** v1.6：全文明研究速度加性百分比（0.08 = +8%），科学院建筑群使用。 */
  researchSpeed?: number;
  /** Additive observation quality bonus (fraction). */
  observationBonus?: number;
  /** Reduces temperature stress by this many degrees equivalent. */
  thermalShielding?: number;
  industry?: number;
  stability?: number;
  /** 0..1 disaster damage reduction. */
  disasterResistance?: number;
  /** +turns of hazard warning lead time. */
  warningBonus?: number;
  colonyProgress?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  icon: string;
  cost: Partial<Record<ResourceId, number>>;
  buildTurns: number;
  maintenance: Partial<Record<ResourceId, number>>;
  workers: number;
  requiresTech: string[];
  requiresEra: number;
  effects: BuildingEffects;
  maxCount?: number;
  /** Observatory level provided by this building (unique). */
  observationLevel?: number;

  /* ---- 时代进化模型（阶段 12 新增）---- */
  /** 可建造时代 1..5（与 requiresEra 保持一致；缺失时回退 requiresEra）。 */
  era?: number;
  /** 该建筑在所属升级链中的层级 1..5（缺失时回退 era）。 */
  tier?: number;
  /** 升级链分组 id（如 "food"、"housing"），同级/跨级升级依据。 */
  upgradeGroup?: string;
  /** 可由本建筑升级到的下一级建筑 id；null/缺省表示链末端。 */
  upgradeTo?: string | null;
  /** 升级所需额外资源（在已有建筑基础上支付，不退还旧建筑）。 */
  upgradeCost?: Partial<Record<ResourceId, number>>;
  /** 升级工期（回合，受工业倍率影响）。 */
  upgradeTurns?: number;
  /** 旧时代建筑在新时代的产出折减（0..1，1=无折减；缺省 0.6）。 */
  outdatedMultiplier?: number;
}

export interface ConstructionJob {
  id: number;
  buildingId: string;
  turnsLeft: number;
  totalTurns: number;
  startedYear: number;
  invested: number;
  /** 若为升级工程：被升级的旧建筑 id；完工时旧建筑 -1、目标建筑 +1。 */
  upgradeFrom?: string | null;
  /** 升级工程支付的资源（取消时按比例返还）。 */
  upgradePaid?: Partial<Record<ResourceId, number>>;
}

export interface ConstructionJob {
  id: number;
  buildingId: string;
  turnsLeft: number;
  totalTurns: number;
  startedYear: number;
  invested: number;
}

export interface BuildingState {
  counts: Record<string, number>;
  queue: ConstructionJob[];
  nextJobId: number;
}

/* ------------------------------------------------------------------ *
 *  ERA PROGRESSION (阶段 12)                                          *
 * ------------------------------------------------------------------ */

export type EraRequirementKind =
  | "population"
  | "techsTotal"
  | "techsInEra"
  | "observatoryLevel"
  | "building";

export interface EraRequirementDef {
  id: string;
  label: string;
  kind: EraRequirementKind;
  target: number;
  /** techsInEra 时的参考时代（统计该时代科技数量）。 */
  era?: number;
  /** building 时的建筑 id。 */
  buildingId?: string;
  unit?: string;
}

export interface EraDef {
  era: number;
  name: string;
  subtitle: string;
  description: string;
  /** 本时代解锁内容的中文摘要（UI 用）。 */
  unlockSummary: string;
  /** 进入本时代所需条件（era 1 为空）。 */
  requirements: EraRequirementDef[];
}

/** ---------------------------------------------------------------- *
 *  TECHNOLOGY                                                       *
 *  ---------------------------------------------------------------- */

export type TechBranch =
  | "astronomy"
  | "energy"
  | "industry"
  | "biology"
  | "space"
  | "computing"
  | "society"
  | "military"
  | "social";

/**
 * v1.6 发展纲领：三大研究大类。
 * 玩家在 E3 起选择 1~2 个作为重点，已选大类研究速度 +10%，未选大类 -35%。
 */
export type ResearchCategory = "natural" | "engineering" | "social";

/**
 * v1.3 学说（流派）：每项科技属于一个学说。玩家可选择「研究重心」，
 * 重心学说获得研究速度/效果加成，跨学说组合带来协同或代价。
 */
export type TechSchool =
  | "observation"
  | "calculation"
  | "industrial"
  | "ecological"
  | "expansion"
  | "authority";

export interface TechEffects {
  productionMultiplier?: Partial<Record<ResourceId, number>>;
  researchMultiplier?: number;
  observationMultiplier?: number;
  agricultureMultiplier?: number;
  energyMultiplier?: number;
  industryMultiplier?: number;
  habitabilityBonus?: number;
  disasterResistance?: number;
  predictionMultiplier?: number;
  populationCapacityBonus?: number;
  allowColony?: boolean;
  allowPlanetEngine?: boolean;
  observationLevelUnlock?: number;
  /** v1.3 additions for the political / event layers. */
  stabilityBonus?: number;
  eventRiskMultiplier?: number;
  politicalCapital?: number;
  departmentBoost?: Partial<Record<DepartmentId, number>>;
  researchSpeed?: number;
}

export interface TechDef {
  id: string;
  name: string;
  branch: TechBranch;
  /** v1.3 学说流派（旧内容可缺省，technology 默认推断）。 */
  school?: TechSchool;
  tier: number;
  cost: number;
  description: string;
  /** 长文本：技术原理、社会影响、历史背景（v1.3）。 */
  descriptionLong?: string;
  /** 一句世界观引文（v1.3）。 */
  flavor?: string;
  effectSummary: string;
  /** 逐条可读效果说明（v1.3）。 */
  effectsDetail?: string[];
  requires: string[];
  /** 满足任意一个即可（与 requires 同时存在时取并集校验）。 */
  requiresAny?: string[];
  effects: TechEffects;
  /** 互斥教义组：同组只能选择一个。 */
  exclusiveGroup?: string;
  /** 解锁提示（建筑/能力/事件）。 */
  unlockNotes?: string;
}

export interface TechState {
  researched: string[];
  activeTech: string | null;
  /** Progress in research points toward active tech. */
  progress: number;
  totalScience: number;
  /** v1.3 研究重心；null 表示均衡。 */
  schoolFocus?: TechSchool | null;
  /** v1.3 已选择的教义：exclusiveGroup -> techId。 */
  doctrineChoices?: Record<string, string>;
  /** v1.3 各学说累计研究点数（用于精通等级）。 */
  schoolPoints?: Partial<Record<TechSchool, number>>;
  /* ---- v1.6 科研政策（全部随存档持久化）---- */
  /** 发展纲领：已选择的 1~2 个研究大类；null/缺省 = 未选择。 */
  developmentCategories?: ResearchCategory[] | null;
  /** 科研资源倾斜 0..100（%）。50 = 中性；0 约 -40% 研究速度，100 约 +35%。 */
  researchFunding?: number;
  /** 每项科研项目「注入资源加速」的使用次数（用于递增价格）。 */
  researchBoostCounts?: Record<string, number>;
  /** 最近一次加速所在回合（每回合限一次）。 */
  lastBoostTurn?: number;
}

/** ---------------------------------------------------------------- *
 *  HAZARDS & CRISES                                                 *
 *  ---------------------------------------------------------------- */

export type PhysicalHazardKind = "closeEncounter" | "radiationSurge" | "heatExtreme" | "coldExtreme" | "orbitDestabilization";

export type CrisisKind = "famine" | "waterShortage" | "energyCrisis" | "unrest" | "ecologicalCollapse" | "planetaryWinter";

export interface HazardEvent {
  id: number;
  kind: PhysicalHazardKind;
  title: string;
  description: string;
  severity: number;
  startYear: number;
  peakYear: number;
  endYear: number;
  /** True once the player has definitively observed the ongoing event. */
  detected: boolean;
  /** 0..1 confidence of the detection/warning. */
  confidence: number;
  /** Signatures used to derive this event (for science panel integrity). */
  evidence: Record<string, number>;
}

export interface HazardWarning {
  id: number;
  kind: PhysicalHazardKind;
  title: string;
  description: string;
  /** Years until predicted onset (>=0). */
  leadYears: number;
  confidence: number;
  severityEstimate: number;
  createdYear: number;
}

export interface CrisisEvent {
  id: number;
  kind: CrisisKind;
  title: string;
  description: string;
  severity: number;
  startYear: number;
  endYear: number;
  active: boolean;
  /** 0..1 how much damage was prevented by buildings/tech. */
  mitigated: number;
}

export interface HazardAccumulator {
  minPlanetStarDistance: number;
  maxStarStarProximity: number;
  maxFlux: number;
  minFlux: number;
  maxTempC: number;
  minTempC: number;
  maxAcceleration: number;
  maxHeightAU: number;
  /** Planet distance from the system barycenter at the start / end of the turn. */
  firstPlanetRadius: number;
  lastPlanetRadius: number;
  samples: number;
  collisionRecords: number;
}

export interface HazardState {
  activeHazards: HazardEvent[];
  history: HazardEvent[];
  warnings: HazardWarning[];
  crises: CrisisEvent[];
  nextId: number;
  lastCheckYear: number;
  /** Peak environment stress recently observed (for UI sparkline). */
  stress: number;
  historyStress: { year: number; stress: number }[];
  /** Per-turn extremes sampled from the true physics (reset each turn). */
  accumulator: HazardAccumulator;
}

/** ---------------------------------------------------------------- *
 *  POLITICS (v1.3)                                                   *
 *  ---------------------------------------------------------------- */

export type DepartmentId =
  | "administration"
  | "science"
  | "industry"
  | "agriculture"
  | "defense"
  | "observation";

export type FactionId =
  | "technocrats"
  | "militarists"
  | "agrarians"
  | "industrialists"
  | "scholars";

export interface FactionDef {
  id: FactionId;
  name: string;
  short: string;
  description: string;
  ideology: string;
  color: string;
  preferredDepartments: DepartmentId[];
}

export interface DepartmentDef {
  id: DepartmentId;
  name: string;
  short: string;
  icon: string;
  description: string;
  responsibilities: string[];
}

export interface MinisterTraitDef {
  id: string;
  name: string;
  description: string;
  tone: "good" | "bad" | "mixed";
}

export interface MinisterState {
  id: string;
  name: string;
  department: DepartmentId;
  /** 属于 1–2 个政治派系。 */
  factions: FactionId[];
  /** 1..10 业务能力：决定部门增益。 */
  competence: number;
  /** 0..100 忠诚：罢免时派系反弹。 */
  loyalty: number;
  /** 0..100 廉洁：低廉洁会触发丑闻事件。 */
  integrity: number;
  /** 0..100 野心：高野心会与其他部长冲突。 */
  ambition: number;
  age: number;
  traits: string[];
  portraitSeed: number;
  appointedYear: number;
}

export interface PoliticsLogEntry {
  id: number;
  year: number;
  turn: number;
  kind: "appoint" | "dismiss" | "mediate" | "faction" | "warning" | "event";
  message: string;
  severity: "info" | "success" | "warning" | "critical";
}

export interface PoliticsState {
  ministers: Record<DepartmentId, MinisterState | null>;
  /** 可任命候选人（每回合刷新部分）。 */
  candidates: MinisterState[];
  nextId: number;
  factions: Record<FactionId, { influence: number; satisfaction: number }>;
  /** 关系矩阵：键为 "idA|idB"（字典序），值 -100..100。 */
  relations: Record<string, number>;
  /** 政治资本。 */
  capital: number;
  /** 每回合政治资本收入。 */
  capitalRate: number;
  lastSummitTurn: number;
  history: PoliticsLogEntry[];
  nextHistoryId: number;
}

/** ---------------------------------------------------------------- *
 *  RANDOM EVENTS (v1.3)                                             *
 *  ---------------------------------------------------------------- */

export type EventCategory =
  | "environment"
  | "society"
  | "politics"
  | "science"
  | "industry"
  | "space"
  | "mystery"
  | "hazard";

export interface EventRequirement {
  minEra?: number;
  maxEra?: number;
  minStability?: number;
  maxStability?: number;
  minPopulation?: number;
  resources?: Partial<Record<ResourceId, number>>;
  techs?: string[];
  anyTechs?: string[];
  flags?: string[];
  notFlags?: string[];
  department?: { id: DepartmentId; minCompetence?: number };
}

export interface EventEffects {
  resources?: Partial<Record<ResourceId, number>>;
  stability?: number;
  population?: number;
  populationPct?: number;
  science?: number;
  capital?: number;
  flags?: string[];
  removeFlags?: string[];
  /** 传递给后续事件的权重修正：tag -> multiplier。 */
  influence?: Record<string, number>;
  hazardStress?: number;
  relation?: { a: DepartmentId; b: DepartmentId; delta: number };
}

export interface EventChoiceDef {
  id: string;
  label: string;
  description: string;
  risk?: string;
  requirements?: EventRequirement;
  effects: EventEffects;
  outcome: string;
}

export interface EventFollowUpDef {
  eventId: string;
  weight: number;
  delayTurns?: number;
  requirements?: EventRequirement;
}

export interface GameEventDef {
  id: string;
  title: string;
  subtitle?: string;
  category: EventCategory;
  /** 插图路径（public 下，相对路径）。 */
  illustration: string;
  short: string;
  body: string;
  longBody?: string;
  flavor?: string;
  eraMin: number;
  eraMax: number;
  weight: number;
  tags: string[];
  repeatable?: boolean;
  cooldownTurns?: number;
  requirements?: EventRequirement;
  choices: EventChoiceDef[];
  followUps?: EventFollowUpDef[];
}

export interface PendingEventState {
  defId: string;
  triggerTurn: number;
  triggerYear: number;
  context: string;
  dueTurn?: number;
}

export interface EventHistoryEntry {
  id: number;
  defId: string;
  title: string;
  category: EventCategory;
  turn: number;
  year: number;
  choiceId: string;
  choiceLabel: string;
  outcome: string;
  illustration: string;
  effectsSummary: string;
}

/** 事件选项的量化影响（选择前预估 / 结算后实际值共用）。 */
export type EventEffectKind =
  | "population"
  | "stability"
  | "capital"
  | "science"
  | "resource"
  | "hazard"
  | "relation"
  | "flag"
  | "influence";

export interface EventEffectForecast {
  /** 稳定唯一键（例如 population / resource:food）。 */
  key: string;
  label: string;
  kind: EventEffectKind;
  /** 数字类效果给出变化前 / 后与差值；旗帜、后续概率等无数字。 */
  before: number | null;
  after: number | null;
  delta: number | null;
  unit: string;
  tone: "gain" | "loss" | "neutral";
  /** 附加说明：百分比、标签名、后续事件倾向等。 */
  detail: string | null;
}

/** 玩家做出选择后，等待 30 秒再送达的结算数据。 */
export interface PendingEventOutcome {
  defId: string;
  title: string;
  category: EventCategory;
  choiceId: string;
  choiceLabel: string;
  outcome: string;
  turn: number;
  year: number;
  /** 达到 meta.elapsedRealSeconds 时生成报告。 */
  dueElapsedSeconds: number;
  summary: string;
  effects: EventEffectForecast[];
  followUpTitle: string | null;
}

export interface EventOutcomeReport extends PendingEventOutcome {
  id: number;
  resolvedElapsedSeconds: number;
}

export interface EventState {
  pending: PendingEventState[];
  history: EventHistoryEntry[];
  nextHistoryId: number;
  flags: string[];
  /** tag -> 权重修正（逐回合衰减，实现“上一回合事件影响下一回合概率”）。 */
  modifiers: Record<string, number>;
  /** eventId -> 冷却结束回合。 */
  cooldowns: Record<string, number>;
  lastEventIds: string[];
  seenCounts: Record<string, number>;
  triggeredTotal: number;
  nextRollTurn: number;
  /** 已选择、等待 30 秒送达的结算；存在时暂停抽取新事件。 */
  pendingOutcome?: PendingEventOutcome | null;
  /** 已到期待玩家查看的结算报告；查看后 acknowledgeEventOutcome 清空。 */
  outcomeReport?: EventOutcomeReport | null;
  nextOutcomeId?: number;
}

/** ---------------------------------------------------------------- *
 *  GAME                                                             *
 *  ---------------------------------------------------------------- */

export type GameMode = "story" | "normal" | "survival" | "sandbox";
export type GalaxyClass = "stable" | "chaotic" | "extreme" | "special";
export type GamePhase = "setup" | "running" | "paused" | "victory" | "defeat";

export interface GalaxyClassification {
  kind: GalaxyClass;
  name: string;
  description: string;
  /** Metrics from the pre-simulation screen. */
  survivalYears: number;
  chaosIndex: number;
  ejectionRisk: number;
  closeEncounterCount: number;
  metrics: Record<string, number>;
}

export interface GameMeta {
  seed: string;
  difficulty: DifficultyKey;
  mode: GameMode;
  createdAt: number;
  elapsedRealSeconds: number;
  galaxy: GalaxyClassification;
  startYear: number;
  calendarStartYear: number;
}

export interface LogEntry {
  id: number;
  year: number;
  turn: number;
  category: "system" | "physics" | "observation" | "civilization" | "hazard" | "tech" | "build" | "milestone" | "ending" | "politics" | "event";
  severity: "info" | "warning" | "critical" | "success";
  message: string;
}

export interface GameState {
  version: number;
  meta: GameMeta;
  physics: PhysicsState;
  environment: EnvironmentState;
  observation: ObservationState;
  civ: CivilizationState;
  buildings: BuildingState;
  tech: TechState;
  hazards: HazardState;
  /** v1.3 政治系统状态（部长/派系/关系/政治资本）。 */
  politics?: PoliticsState;
  /** v1.3 随机事件状态（待处理事件/历史/概率修正）。 */
  events?: EventState;
  log: LogEntry[];
  nextLogId: number;
  /** Simulated years advanced since start. */
  yearsElapsed: number;
  gameOver: boolean;
  victory: boolean;
  endingId: string | null;
  endingTitle: string | null;
  endingText: string | null;
  lastSavedAt: number | null;
}

export interface NewGameOptions {
  seed: string;
  difficulty: DifficultyKey;
  mode: GameMode;
}

export interface GalaxyPreviewStar {
  id: StarId;
  name: string;
  color: string;
  mass: number;
  radius: number;
  luminosity: number;
  pos: Vec3;
  vel: Vec3;
}

export interface GalaxyPreview {
  seed: string;
  difficulty: DifficultyKey;
  classification: GalaxyClassification;
  stars: GalaxyPreviewStar[];
  planet: {
    name: string;
    pos: Vec3;
    vel: Vec3;
    mass: number;
    radiusKm: number;
    albedo: number;
    greenhouseK: number;
    water: number;
    atmosphere: number;
    initialTempC: number;
    habitability: number;
    orbitRadius: number;
    inclinationDeg: number;
  };
  /** Sampled true trajectories over the screening window, for the preview animation. */
  trajectories: Partial<Record<StarId, Vec3[]>>;
  warnings: string[];
}
