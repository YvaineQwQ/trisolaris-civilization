/**
 * FROZEN CONTRACTS between the simulation core and the presentation layer.
 *
 *  - `ViewModel`  : everything the UI is allowed to know. Built from OBSERVED data only.
 *  - `RenderScene`: everything the canvas renderer is allowed to draw. Observed data only.
 *  - `GameActions`/`GameApi`: the only way the UI may mutate the game.
 *  - `AppController`: menu / save / new-game host implemented by main.ts.
 *
 * The UI and renderer must never import physics/game modules directly.
 */
import type { Vec2, Vec3 } from "../core/math";
import type {
  DepartmentId, DifficultyKey, EventCategory, FactionId, GalaxyPreview, GameMode,
  LogEntry, NewGameOptions, ObservationKind, PoliticsLogEntry, StarId, StarTarget,
  TechSchool, WeatherKind,
} from "../core/types";

export interface ViewSettings {
  showTrails: boolean;
  showPrediction: boolean;
  showGrid: boolean;
  showLabels: boolean;
  showUncertainty: boolean;
}

export interface ViewMeta {
  seed: string;
  difficultyKey: DifficultyKey;
  difficultyName: string;
  mode: GameMode;
  modeName: string;
  galaxyClassName: string;
  galaxyClass: string;
  year: number;
  calendarYear: number;
  turn: number;
  era: number;
  eraName: string;
  eraSubtitle: string;
  eraDescription: string;
  paused: boolean;
  speedIndex: number;
  speedValue: number;
  running: boolean;
  victory: boolean;
  gameOver: boolean;
  endingTitle: string | null;
  defeatReason: string | null;
  modeHint: string;
}

export interface ResourceView {
  id: string;
  name: string;
  short: string;
  unit: string;
  color: string;
  amount: number;
  capacity: number;
  produced: number;
  consumed: number;
  net: number;
  ratio: number;
  critical: boolean;
  description: string;
  /** True while the civilization era has not unlocked this resource. */
  locked: boolean;
  /** Era at which this resource becomes available. */
  unlockEra: number;
}

export interface EraRequirementView {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  met: boolean;
}

export interface ObjectiveView {
  id: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  complete: boolean;
}

export interface AlertView {
  id: string;
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  detail: string;
}

export interface StabilityFactorView {
  key: string;
  label: string;
  value: number;
}

export interface CivView {
  population: {
    total: number;
    housing: number;
    growthPerYear: number;
    workforce: number;
    jobs: number;
    employed: number;
    unemploymentRate: number;
    housingRatio: number;
  };
  stability: {
    value: number;
    label: string;
    tone: "good" | "ok" | "warn" | "bad";
    factors: StabilityFactorView[];
  };
  science: {
    rate: number;
    activeTechId: string | null;
    activeTechName: string | null;
    progress: number;
    cost: number;
    percent: number;
    etaTurns: number | null;
  };
  industry: { capacity: number; used: number; free: number; queueTurns: number };
  era: {
    value: number;
    name: string;
    subtitle: string;
    description: string;
    progress: number;
    nextThreshold: string;
    nextEraName: string | null;
    nextEraSubtitle: string | null;
    /** Requirements for entering the next era (empty at era 5). */
    requirements: EraRequirementView[];
    canAdvance: boolean;
    unlockSummary: string;
  };
  colony: {
    exists: boolean;
    name: string;
    population: number;
    selfSufficiency: number;
    integrity: number;
    level: number;
  } | null;
  unlocks: { colony: boolean; planetEngine: boolean; deepSpace: boolean };
}

export interface FlowCostView {
  resourceId: string;
  name: string;
  amount: number;
  affordable: boolean;
  have: number;
}

export interface BuildingView {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  description: string;
  icon: string;
  cost: FlowCostView[];
  buildTurns: number;
  maintenance: FlowCostView[];
  workers: number;
  effects: string[];
  canBuild: boolean;
  blockedReason: string | null;
  count: number;
  maxCount: number | null;
  /** Era-gated progression data. */
  era: number;
  tier: number;
  upgradeToId: string | null;
  upgradeToName: string | null;
  upgradeCost: FlowCostView[];
  upgradeTurns: number;
  canUpgrade: boolean;
  upgradeBlockedReason: string | null;
  /** Built building is from an older era and is producing below its potential. */
  outdated: boolean;
}

export interface QueueView {
  jobId: number;
  buildingId: string;
  name: string;
  icon: string;
  turnsLeft: number;
  totalTurns: number;
  progress: number;
  /** Additive (阶段 12): distinguishes new construction from an era upgrade. */
  kind?: "build" | "upgrade";
  /** When kind="upgrade": the lower-tier building being upgraded. */
  upgradeFromId?: string | null;
  upgradeFromName?: string | null;
}

export interface BuiltBuildingView {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

export interface BuildingsView {
  built: BuiltBuildingView[];
  available: BuildingView[];
  queue: QueueView[];
  totalMaintenance: FlowCostView[];
  currentEra: number;
  /** Number of built buildings that can be upgraded right now. */
  upgradableCount: number;
}

export interface TechView {
  id: string;
  name: string;
  branch: string;
  branchName: string;
  tier: number;
  cost: number;
  description: string;
  /** v1.3：长文本原理/影响说明。 */
  descriptionLong?: string;
  /** v1.3：世界观引文。 */
  flavor?: string;
  effectSummary: string;
  /** v1.3：逐条效果说明。 */
  effectsDetail?: string[];
  requires: string[];
  requiresNames: string[];
  researched: boolean;
  available: boolean;
  blockedReason: string | null;
  isActive: boolean;
  /** Era at which this technology unlocks. */
  era: number;
  /** v1.3 学说与教义。 */
  school?: TechSchool;
  schoolName?: string;
  exclusiveGroup?: string;
  exclusiveChosen?: boolean;
  exclusiveBlockedBy?: string | null;
}

export interface TechSchoolView {
  id: TechSchool;
  name: string;
  short: string;
  description: string;
  color: string;
  /** 已研究该学说科技数 / 总数。 */
  researchedCount: number;
  total: number;
  points: number;
  mastery: number;
  focused: boolean;
}

export interface DoctrineOptionView {
  techId: string;
  name: string;
  description: string;
  chosen: boolean;
  researched: boolean;
}

export interface DoctrineGroupView {
  id: string;
  title: string;
  description: string;
  chosenTechId: string | null;
  options: DoctrineOptionView[];
}

export interface TechBranchView {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  researchedCount: number;
  total: number;
  techs: TechView[];
}

export interface TechTreeView {
  branches: TechBranchView[];
  schools: TechSchoolView[];
  schoolFocus: TechSchool | null;
  doctrines: DoctrineGroupView[];
  researchedTotal: number;
  totalTechs: number;
  /** Active research count/slots (v1.3 keeps one active project but exposes queue depth). */
  activeTechId: string | null;
}

export interface ObservatoryView {
  level: number;
  maxLevel: number;
  name: string;
  description: string;
  capabilities: string[];
  equipmentName: string;
  dataPoints: number;
  efficiency: number;
  next: {
    level: number;
    name: string;
    description: string;
    capabilities: string[];
    upgradeScience: number;
    cost: FlowCostView[];
    requiresTech: string | null;
    requiresTechName: string | null;
    canUpgrade: boolean;
    blockedReason: string | null;
    requiresEra: number;
    eraOk: boolean;
  } | null;
  /** Current civilization era, for gating hints. */
  era: number;
}

export interface ObservedStarView {
  id: StarId;
  name: string;
  color: string;
  known: { position: boolean; distance: boolean; velocity: boolean; mass: boolean; acceleration: boolean; orbit: boolean };
  pos: Vec3;
  /** Height above the X-Z reference plane (AU). */
  height: number;
  /** Orbital inclination estimate relative to the X-Z plane, radians (null if unknown). */
  inclination: number | null;
  distance: number | null;
  speed: number | null;
  mass: number | null;
  sigmaPos: number | null;
  sigmaVel: number | null;
  sigmaMass: number | null;
  confidence: number;
  confidenceLabel: string;
  confidenceTone: "good" | "ok" | "warn" | "bad";
  lastMeasuredYear: number;
  sampleCount: number;
  eccentricity: number | null;
  relationToPlanetAU: number | null;
}

export interface ObservedPlanetView {
  pos: Vec3;
  height: number;
  inclination: number | null;
  distanceFromPrimary: number | null;
  tempC: number | null;
  sigmaPos: number | null;
  habitability: number | null;
  orbitRadius: number | null;
  eccentricity: number | null;
  confidence: number;
  lastMeasuredYear: number;
  known: { distance: boolean; temperature: boolean; orbit: boolean };
}

export interface ObservationTaskView {
  id: string;
  kind: ObservationKind;
  kindLabel: string;
  targetLabel: string;
  turnsElapsed: number;
  turnsRequired: number;
  progress: number;
  energyCost: number;
  summary: string;
}

export interface ObservationTaskOptionView {
  kind: ObservationKind;
  label: string;
  description: string;
  targetMode: "star" | "all" | "planet";
  energyCost: number;
  turnsRequired: number;
  enabled: boolean;
  reason: string | null;
  /** Era-dependent currency: food before electricity (era<3), energy afterwards. */
  costResource?: "food" | "energy";
  costLabel?: string;
}

export interface DiscoveryView {
  id: number;
  year: number;
  title: string;
  detail: string;
  category: string;
  evidence: string;
}

export interface ObservationView {
  stars: ObservedStarView[];
  planet: ObservedPlanetView | null;
  activeTask: ObservationTaskView | null;
  taskOptions: ObservationTaskOptionView[];
  discoveries: DiscoveryView[];
  lastObservationYear: number | null;
  dataPoints: number;
  hasModel: boolean;
  modelAccuracy: number | null;
  modelHorizon: number | null;
  modelNote: string | null;
  observedTrailAvailable: boolean;
}

export interface EnvironmentView {
  tempC: number;
  equilibriumTempC: number;
  flux: number;
  fluxAnomaly: number;
  habitability: number;
  ecology: number;
  water: number;
  atmosphere: number;
  weather: WeatherKind;
  weatherLabel: string;
  greenhouseK: number;
  albedo: number;
  history: { year: number; tempC: number; flux: number }[];
  populationHistory: { year: number; population: number; stability: number; tempC: number }[];
  tempTrend: number;
  stressLabel: string;
}

export interface HazardView {
  id: number;
  kind: string;
  kindLabel: string;
  title: string;
  description: string;
  severity: number;
  severityLabel: string;
  startYear: number;
  peakYear: number;
  endYear: number;
  daysUntil?: number;
  detected: boolean;
  confidence: number;
}

export interface WarningView {
  id: number;
  kind: string;
  title: string;
  description: string;
  leadYears: number;
  confidence: number;
  severityEstimate: number;
  createdYear: number;
}

export interface CrisisView {
  id: number;
  kind: string;
  title: string;
  description: string;
  severity: number;
  active: boolean;
  mitigated: number;
  startYear: number;
}

export interface HazardsView {
  hazards: HazardView[];
  warnings: WarningView[];
  crises: CrisisView[];
  stress: number;
  historyStress: { year: number; stress: number }[];
  riskLevel: "calm" | "watch" | "alert" | "critical";
  riskLabel: string;
}

export interface PredictionStarView {
  id: StarId;
  name: string;
  color: string;
  reliableYears: number;
  endpoint: Vec2 | null;
  closestApproachAU: number | null;
  closestApproachYear: number | null;
}

export interface PredictionView {
  available: boolean;
  reason: string | null;
  createdYear: number | null;
  horizonYears: number | null;
  reliableYears: number | null;
  note: string | null;
  agreement: number | null;
  diverged: boolean;
  stars: PredictionStarView[];
  planet: { reliableYears: number; closestApproachAU: number | null; closestApproachYear: number | null } | null;
}

export interface EndpointView {
  app: string;
  universe: string;
  // ...
}

export interface MinisterTraitView {
  id: string;
  name: string;
  description: string;
  tone: "good" | "bad" | "mixed";
}

export interface MinisterView {
  id: string;
  name: string;
  department: DepartmentId;
  departmentName: string;
  factions: { id: FactionId; name: string; color: string }[];
  competence: number;
  loyalty: number;
  integrity: number;
  ambition: number;
  age: number;
  traits: MinisterTraitView[];
  portraitSeed: number;
  /** 一句话人物画像（由属性和特质生成）。 */
  summary: string;
  appointedYear: number;
}

export interface DepartmentPoliticalView {
  id: DepartmentId;
  name: string;
  short: string;
  icon: string;
  description: string;
  minister: MinisterView | null;
  /** 部门增益/减益列表（来自部长能力、派系、关系）。 */
  modifiers: { label: string; value: string; tone: "good" | "bad" | "neutral"; detail: string }[];
  /** 0.7..1.3 的部门效率修正。 */
  efficiency: number;
  efficiencyLabel: string;
  /** 空缺/低效警告。 */
  warning: string | null;
}

export interface FactionView {
  id: FactionId;
  name: string;
  short: string;
  description: string;
  ideology: string;
  color: string;
  /** 0..100 影响力。 */
  influence: number;
  /** 0..100 满意度。 */
  satisfaction: number;
  satisfactionLabel: string;
  satisfactionTone: "good" | "ok" | "warn" | "bad";
  ministers: string[];
}

export interface MinisterRelationView {
  a: DepartmentId;
  b: DepartmentId;
  aName: string;
  bName: string;
  score: number;
  label: string;
  tone: "intimate" | "friendly" | "neutral" | "cold" | "hostile";
}

export interface PoliticsView {
  capital: number;
  capitalRate: number;
  departments: DepartmentPoliticalView[];
  factions: FactionView[];
  relations: MinisterRelationView[];
  candidates: MinisterView[];
  /** 政治对稳定度的每回合修正。 */
  stabilityImpact: number;
  stabilityImpactLabel: string;
  actions: {
    appointCost: number;
    dismissCost: number;
    mediateCost: number;
    summitCost: number;
    canSummit: boolean;
    cooldownTurns: number;
  };
  lastSummitTurn: number;
  history: PoliticsLogEntry[];
  /** 高层摘要，例如“联合政府摇摇欲坠”。 */
  summary: string;
  tone: "stable" | "tense" | "fragile" | "crisis";
}

export interface EventChoiceView {
  id: string;
  label: string;
  description: string;
  risk: string | null;
  available: boolean;
  unavailableReason: string | null;
  /** 预估效果关键词（不泄露隐藏数值）。 */
  preview: string[];
}

export interface ActiveEventView {
  defId: string;
  title: string;
  subtitle: string | null;
  category: EventCategory;
  categoryName: string;
  illustration: string;
  short: string;
  body: string;
  longBody: string | null;
  flavor: string | null;
  choices: EventChoiceView[];
  triggerYear: number;
  context: string;
}

export interface EventHistoryView {
  id: number;
  defId: string;
  title: string;
  category: EventCategory;
  turn: number;
  year: number;
  choiceLabel: string;
  outcome: string;
  illustration: string;
}

export interface EventsView {
  active: ActiveEventView | null;
  pendingCount: number;
  history: EventHistoryView[];
  /** 当前生效的事件链/概率修正，供玩家理解“上一回合的影响”。 */
  modifiers: { label: string; multiplier: number; tone: "up" | "down" }[];
  totalTriggered: number;
  lastEventTitle: string | null;
}

export interface ViewModel {
  meta: ViewMeta;
  resources: ResourceView[];
  civ: CivView;
  buildings: BuildingsView;
  tech: TechTreeView;
  observatory: ObservatoryView;
  observation: ObservationView;
  environment: EnvironmentView;
  hazards: HazardsView;
  prediction: PredictionView;
  /** v1.3 政治与事件面板。 */
  politics?: PoliticsView;
  events?: EventsView;
  objectives: ObjectiveView[];
  alerts: AlertView[];
  log: LogEntry[];
  selection: StarId | "planet" | null;
  settings: ViewSettings;
  saving: { slots: SaveSlotMeta[]; busy: boolean } | null;
  ending: { victory: boolean; title: string; text: string; stats: { label: string; value: string }[] } | null;
}

export interface SaveSlotMeta {
  id: string;
  name: string;
  seed: string;
  difficulty: string;
  mode: string;
  year: number;
  turn: number;
  population: number;
  savedAt: number;
  version: number;
  auto: boolean;
  era: number;
}

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface GameActions {
  togglePause(): void;
  setSpeedIndex(index: number): void;
  advanceTurn(): void;
  select(id: StarId | "planet" | null): void;
  startBuilding(buildingId: string): void;
  /** Upgrade one built building into its next-era tier (costs difference + turns). */
  upgradeBuilding(buildingId: string): void;
  cancelConstruction(jobId: number): void;
  startResearch(techId: string): void;
  cancelResearch(): void;
  /** v1.3：选择研究重心（学说流派）。 */
  chooseSchoolFocus(school: TechSchool | null): void;
  /** v1.3：在互斥教义组中选择一项科技。 */
  chooseDoctrine(techId: string): void;
  /** v1.3：任命候选人到其部门。 */
  appointMinister(candidateId: string): void;
  /** v1.3：罢免部门部长。 */
  dismissMinister(departmentId: DepartmentId): void;
  /** v1.3：调解两位部长关系，消耗政治资本。 */
  mediateMinisters(a: DepartmentId, b: DepartmentId): void;
  /** v1.3：举行政治峰会，短期提升派系满意度。 */
  holdSummit(): void;
  /** v1.3：处理当前随机事件。 */
  resolveEvent(choiceId: string): void;
  startObservation(kind: ObservationKind, target: StarTarget): void;
  cancelObservation(): void;
  upgradeObservatory(): void;
  refreshPrediction(): void;
  foundColony(): void;
  buildPlanetEngine(): void;
  toggleSetting(key: keyof ViewSettings): void;
  saveGame(slotId: string, name?: string): Promise<SaveResult>;
  loadGame(slotId: string): Promise<boolean>;
  listSaves(): Promise<SaveSlotMeta[]>;
  deleteSave(slotId: string): Promise<void>;
  exportSave(): Promise<void>;
  importSaveText(text: string): Promise<boolean>;
  returnToMenu(): void;
}

export interface GameApi {
  view(): ViewModel;
  /** 2D primary view scene (X-Z projection of the same 3D system). */
  scene(): RenderScene;
  /** 3D auxiliary view scene (same celestial data, full spatial structure). */
  scene3d(): RenderScene3D;
  actions: GameActions;
}

/* ------------------------------------------------------------------ *
 *  RENDER CONTRACTS                                                   *
 * ------------------------------------------------------------------ */

export interface SceneStar {
  id: StarId;
  name: string;
  color: string;
  /** Full 3D position. 2D primary view projects onto X-Z; Y is rendered as a height cue. */
  pos: Vec3;
  /** Estimated physical radius in AU (for scale-accurate glow sizing). */
  radiusAU: number;
  /** Estimated mass (Msun) when known, else null. */
  mass: number | null;
  /** Estimated surface temperature K when known. */
  tempK: number | null;
  /** 1-sigma positional uncertainty in AU. */
  sigmaAU: number;
  confidence: number;
  known: boolean;
  selected: boolean;
}

export interface ScenePlanet {
  pos: Vec3;
  radiusKm: number;
  tempC: number | null;
  habitability: number | null;
  sigmaAU: number;
  selected: boolean;
}

export interface ScenePolyline {
  id: string;
  points: Vec3[];
  color: string;
  dashed: boolean;
  alpha: number;
  width: number;
}

export interface SceneUncertainty {
  id: string;
  ring: Vec3[];
  color: string;
  alpha: number;
}

export interface ScenePulse {
  id: string;
  pos: Vec3;
  severity: number;
  color: string;
  label: string;
}

export interface RenderScene {
  seed: string;
  timeYears: number;
  calendarYear: number;
  observatoryLevel: number;
  stars: SceneStar[];
  planet: ScenePlanet | null;
  observedTrails: ScenePolyline[];
  predictedTrails: ScenePolyline[];
  uncertaintyRings: SceneUncertainty[];
  predictedPlanetTrail: ScenePolyline | null;
  planetUncertainty: SceneUncertainty | null;
  pulses: ScenePulse[];
  selection: StarId | "planet" | null;
  recommendedRadiusAU: number;
  settings: ViewSettings;
  paused: boolean;
  hasColony: boolean;
  statusLabel: string;
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  seed: string;
  onPick?: (id: StarId | "planet" | null) => void;
}

export interface SceneRenderer {
  resize(): void;
  frame(scene: RenderScene, dtSeconds: number): void;
  destroy(): void;
  /** Programmatic zoom helpers used by UI buttons. */
  zoomBy(factor: number): void;
  resetView(): void;
}

/* ------------------------------------------------------------------ *
 *  3D AUXILIARY VIEW CONTRACTS (Three.js)                             *
 * ------------------------------------------------------------------ */

export interface SceneStar3D {
  id: StarId;
  name: string;
  color: string;
  pos: Vec3;
  radiusAU: number;
  mass: number | null;
  tempK: number | null;
  sigmaAU: number;
  confidence: number;
  known: boolean;
  selected: boolean;
}

export interface ScenePlanet3D {
  pos: Vec3;
  radiusKm: number;
  tempC: number | null;
  habitability: number | null;
  sigmaAU: number;
  selected: boolean;
}

export interface SceneTrail3D {
  id: string;
  points: Vec3[];
  color: string;
  dashed: boolean;
  alpha: number;
  width: number;
}

export interface SceneCloud3D {
  id: string;
  center: Vec3;
  radiusAU: number;
  color: string;
  alpha: number;
}

export interface ScenePulse3D {
  id: string;
  pos: Vec3;
  severity: number;
  color: string;
  label: string;
}

export interface RenderScene3D {
  seed: string;
  timeYears: number;
  calendarYear: number;
  observatoryLevel: number;
  stars: SceneStar3D[];
  planet: ScenePlanet3D | null;
  observedTrails: SceneTrail3D[];
  predictedTrails: SceneTrail3D[];
  uncertaintyClouds: SceneCloud3D[];
  predictedPlanetTrail: SceneTrail3D | null;
  planetUncertainty: SceneCloud3D | null;
  pulses: ScenePulse3D[];
  selection: StarId | "planet" | null;
  recommendedRadiusAU: number;
  settings: ViewSettings;
  paused: boolean;
  hasColony: boolean;
  statusLabel: string;
  /** True when the player has enough 3D observational knowledge to display height/inclination data. */
  heightDataAvailable: boolean;
}

export interface Renderer3DOptions {
  container: HTMLElement;
  seed: string;
  onPick?: (id: StarId | "planet" | null) => void;
}

export interface SceneRenderer3D {
  resize(): void;
  frame(scene: RenderScene3D, dtSeconds: number): void;
  destroy(): void;
  resetView(): void;
  setViewPreset(preset: "top" | "side" | "free"): void;
}

/* ------------------------------------------------------------------ *
 *  APP CONTROLLER (menus, save slots, game lifecycle)                 *
 * ------------------------------------------------------------------ */

export interface AppController {
  randomSeed(): string;
  previewGalaxy(seed: string, difficulty: DifficultyKey, mode: GameMode): Promise<GalaxyPreview>;
  createNewGame(opts: NewGameOptions): Promise<void>;
  listSaves(): Promise<SaveSlotMeta[]>;
  loadSave(id: string): Promise<boolean>;
  deleteSave(id: string): Promise<void>;
  exportSaveFile(id: string): Promise<void>;
  importSaveFile(file: File): Promise<boolean>;
  activeGame(): GameApi | null;
  hasActiveGame(): boolean;
  returnToMenu(): void;
  /** True when the current page was opened with ?autostart=1 (used by QA). */
  autostart: boolean;
}
