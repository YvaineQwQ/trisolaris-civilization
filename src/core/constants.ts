/**
 * Physical & game constants.
 * Unit system: astronomical units (AU), solar masses (Msun), years (yr).
 * With these units Newton's constant is G = 4 * PI^2.
 */
export const G = 4 * Math.PI * Math.PI;

export const AU_KM = 149_597_870.7;
export const SOLAR_RADIUS_AU = 0.00465047;
export const SOLAR_LUMINOSITY = 1;
/** Earth mass expressed in solar masses (planet masses in the game are Earth masses). */
export const EARTH_MASS_SOLAR = 3.0034896e-6;
export const EARTH_EQ_TEMP_K = 255;
export const KELVIN_OFFSET = 273.15;

/** Fixed physics integration step (years). 1/1600 yr ~= 5.5 hours. */
export const PHYSICS_DT = 1 / 1600;
/** Gravitational softening length in AU (required physical approximation for close encounters). */
export const SOFTENING = 0.008;
/** Maximum acceleration cap to guard against numerical overflow (AU/yr^2). */
export const MAX_ACCEL = 1e6;
/** Maximum simulation time step allowed per physics sub-step when speed is very high. */
export const MAX_STEPS_PER_FRAME = 4000;

/** One civilization turn covers this many simulated years. */
export const TURN_YEARS = 0.5;
/** Base simulation speed: simulated years per real second at 1x. */
export const BASE_YEARS_PER_SECOND = 0.25;
export const TIME_SPEEDS = [0, 0.5, 1, 2, 4, 8, 16, 32] as const;

/** Trail sample interval, in years of simulated time. */
export const TRAIL_INTERVAL = 0.02;
export const MAX_TRAIL_POINTS = 1800;

/** Simulation "current year" label base (fictional calendar). */
export const CALENDAR_START_YEAR = 2187;

export const STAR_COLORS: Record<string, string> = {
  A: "#ff6b4a",
  B: "#5ad2ff",
  C: "#b48cff",
};

export const STAR_BASE_NAMES: Record<string, string> = {
  A: "赤曜",
  B: "青曜",
  C: "幽曜",
};

export const STAR_BASE_COLOR_NAMES: Record<string, string> = {
  A: "赤橙",
  B: "青蓝",
  C: "幽紫",
};

export type DifficultyKey = "easy" | "normal" | "hard" | "nightmare";

export interface DifficultyPreset {
  key: DifficultyKey;
  name: string;
  description: string;
  /** Physically pre-screened stability requirement, lower = more dangerous accepted systems. */
  minSurvivalYears: number;
  /** Planet must stay inside this radial band during screening. */
  maxEjectionRadius: number;
  /** Temperature comfort window is enforced less tightly on harder difficulties. */
  temperatureTolerance: number;
  startingFood: number;
  startingEnergy: number;
  startingScience: number;
  populationGrowth: number;
  observationNoise: number;
  hazardMultiplier: number;
  /** Number of candidate systems screened before accepting one. */
  candidateBudget: number;
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultyPreset> = {
  easy: {
    key: "easy", name: "稳步发展", description: "较为稳定的星系，环境温和，适合熟悉机制。",
    minSurvivalYears: 140, maxEjectionRadius: 9, temperatureTolerance: 1.6,
    startingFood: 1000, startingEnergy: 0, startingScience: 20, populationGrowth: 1.25,
    observationNoise: 0.8, hazardMultiplier: 0.75, candidateBudget: 300,
  },
  normal: {
    key: "normal", name: "标准纪元", description: "真实的混沌三体星系，文明需要观测与适应。",
    minSurvivalYears: 95, maxEjectionRadius: 10, temperatureTolerance: 1.0,
    startingFood: 900, startingEnergy: 0, startingScience: 10, populationGrowth: 1.0,
    observationNoise: 1.0, hazardMultiplier: 1.0, candidateBudget: 220,
  },
  hard: {
    key: "hard", name: "混沌纪元", description: "更猛烈的引力扰动与更短的稳定窗口。",
    minSurvivalYears: 60, maxEjectionRadius: 12, temperatureTolerance: 0.82,
    startingFood: 800, startingEnergy: 0, startingScience: 5, populationGrowth: 0.85,
    observationNoise: 1.2, hazardMultiplier: 1.3, candidateBudget: 260,
  },
  nightmare: {
    key: "nightmare", name: "末日乱纪元", description: "极端星系。生存本身就是奇迹。",
    minSurvivalYears: 25, maxEjectionRadius: 16, temperatureTolerance: 0.62,
    startingFood: 700, startingEnergy: 0, startingScience: 0, populationGrowth: 0.7,
    observationNoise: 1.45, hazardMultiplier: 1.7, candidateBudget: 300,
  },
};

export interface ObservatoryLevelInfo {
  level: number;
  name: string;
  description: string;
  /** Position measurement sigma in AU at 1 AU distance, before equipment multipliers. */
  // massSigma is a FRACTION of true mass (1-sigma).
  positionSigma: number;
  velocitySigma: number;
  massSigma: number;
  /** Max prediction horizon in years the model can meaningfully support. */
  predictionHorizon: number;
  /** Science data per turn produced passively. */
  dataRate: number;
  /** Energy per observation task. */
  energyCost: number;
  /** Turns required per observation task. */
  taskTurns: number;
  capabilities: string[];
  /** Research points needed to upgrade to this level (for level 2+) */
  upgradeScience: number;
  /** Minimum civilization era required for this observatory level. */
  requiresEra: number;
  /** Resource costs for upgrade. */
  upgradeCost: { minerals: number; metals: number; energy: number };
  requiresTech: string | null;
}

export const OBSERVATORY_LEVELS: ObservatoryLevelInfo[] = [
  {
    level: 0, name: "无观测设施", description: "文明只能以肉眼仰望星空，无法进行系统性天文观测。",
    positionSigma: 0.6, velocitySigma: 9, massSigma: 0.95, predictionHorizon: 0,
    dataRate: 0, energyCost: 0, taskTurns: 0, capabilities: [],
    upgradeScience: 0, requiresEra: 0, upgradeCost: { minerals: 0, metals: 0, energy: 0 }, requiresTech: null,
  },
  {
    level: 1, name: "基础观测站", description: "记录恒星的方位、颜色与亮度，觉察它们在天空中的缓慢移动。",
    positionSigma: 0.09, velocitySigma: 3.2, massSigma: 0.85, predictionHorizon: 1.2,
    dataRate: 4, energyCost: 40, taskTurns: 1,
    capabilities: ["恒星方位测量", "颜色与亮度识别", "简单运动方向记录"],
    upgradeScience: 90, requiresEra: 1, upgradeCost: { minerals: 220, metals: 40, energy: 120 }, requiresTech: "astro_basic",
  },
  {
    level: 2, name: "专业天文台", description: "精密测角与测距，能够估算恒星的距离和角速度。",
    positionSigma: 0.028, velocitySigma: 1.2, massSigma: 0.55, predictionHorizon: 3.5,
    dataRate: 9, energyCost: 70, taskTurns: 1,
    capabilities: ["高精度方位测量", "恒星距离估算", "角速度记录"],
    upgradeScience: 260, requiresEra: 2, upgradeCost: { minerals: 520, metals: 140, energy: 0 }, requiresTech: "astro_distance",
  },
  {
    level: 3, name: "高级天文观测中心", description: "测得恒星速度与质量，可计算母星的近似轨道并进行短期预测。",
    positionSigma: 0.009, velocitySigma: 0.36, massSigma: 0.30, predictionHorizon: 9,
    dataRate: 18, energyCost: 110, taskTurns: 2,
    capabilities: ["恒星速度估算", "恒星质量初步估算", "母星近似轨道", "短期轨道预测"],
    upgradeScience: 620, requiresEra: 3, upgradeCost: { minerals: 1200, metals: 420, energy: 800 }, requiresTech: "astro_orbit",
  },
  {
    level: 4, name: "轨道动力学研究所", description: "建立三体动力学模型，估算偏心率与引力扰动，进行中期预测。",
    positionSigma: 0.0032, velocitySigma: 0.12, massSigma: 0.14, predictionHorizon: 24,
    dataRate: 34, energyCost: 170, taskTurns: 2,
    capabilities: ["三体动力学建模", "轨道偏心率估算", "引力扰动计算", "中期轨道预测"],
    upgradeScience: 1400, requiresEra: 4, upgradeCost: { minerals: 2600, metals: 1100, energy: 1900 }, requiresTech: "astro_threebody",
  },
  {
    level: 5, name: "行星科学与深空观测中心", description: "分析复杂轨道，预测环境趋势与灾害概率，进行长期模型分析。",
    positionSigma: 0.0013, velocitySigma: 0.045, massSigma: 0.05, predictionHorizon: 55,
    dataRate: 62, energyCost: 260, taskTurns: 3,
    capabilities: ["复杂轨道分析", "环境变化趋势预测", "灾害概率计算", "长期模型分析"],
    upgradeScience: 3200, requiresEra: 5, upgradeCost: { minerals: 5800, metals: 2600, energy: 4600 }, requiresTech: "astro_chaos",
  },
  {
    level: 6, name: "超级天文观测网络", description: "多波段、多模型交叉验证，逼近混沌系统的可见极限，但永远无法取得无限期的确定未来。",
    positionSigma: 0.00042, velocitySigma: 0.014, massSigma: 0.012, predictionHorizon: 110,
    dataRate: 120, energyCost: 380, taskTurns: 3,
    capabilities: ["多波段观测", "多模型交叉验证", "高精度轨道估算", "混沌敏感性分析", "长期趋势预测"],
    upgradeScience: 7200, requiresEra: 5, upgradeCost: { minerals: 12000, metals: 6000, energy: 10000 }, requiresTech: "astro_supernet",
  },
];

/** Observability confidence thresholds and display helpers. */
export const CONFIDENCE_LABELS: { min: number; label: string; tone: string }[] = [
  { min: 0.85, label: "可靠", tone: "good" },
  { min: 0.6, label: "较可信", tone: "ok" },
  { min: 0.35, label: "低置信", tone: "warn" },
  { min: 0, label: "极不确定", tone: "bad" },
];

/**
 * 时代进化系统（阶段 12）：文明从原始部落一步步走向星际文明。
 * 每个时代解锁不同的资源、建筑与科技；旧时代建筑需要逐级升级。
 */
export const ERA_MAX = 5;

/** 资源解锁时代：food/water/minerals/science 自原始时代可用；金属在城邦时代；能源（电力）在工业时代。 */
export const RESOURCE_UNLOCK_ERA: Record<string, number> = {
  food: 1,
  water: 1,
  minerals: 1,
  science: 1,
  metals: 2,
  energy: 3,
};

export const ERAS: import("./types").EraDef[] = [
  {
    era: 1,
    name: "仰望星空",
    subtitle: "原始部落",
    description: "一小群人在三颗太阳下学会用火、耕种与计数。他们还没有金属与电力，只有观星台和代代相传的星象记忆。",
    unlockSummary: "食物 / 水 / 矿物 / 知识；原始农田、聚落营地、水井、采石场、长者议事棚、观星台。",
    requirements: [],
  },
  {
    era: 2,
    name: "文明曙光",
    subtitle: "农业城邦",
    description: "灌溉、文字与青铜让部落变成城邦。人们筑起水渠与城墙，开始怀疑那三颗星并不遵循简单的规律。",
    unlockSummary: "解锁金属（矿场含初级冶炼）；灌溉农田、城邦住宅、水渠、矿场、学园、集市。",
    requirements: [
      { id: "pop", label: "人口达到 900", kind: "population", target: 900, unit: "人" },
      { id: "techs", label: "累计研究 2 项科技", kind: "techsTotal", target: 2, unit: "项" },
      { id: "obs", label: "建成观星台（观测 Lv.1）", kind: "observatoryLevel", target: 1, unit: "级" },
    ],
  },
  {
    era: 3,
    name: "混沌时代",
    subtitle: "蒸汽与电气",
    description: "蒸汽机与电网点燃工业的火焰，望远镜与机械计算机第一次把天空变成可测量的对象——而混沌也开始回应文明的窥探。",
    unlockSummary: "解锁能源（电力）；机械化农场、水处理厂、燃煤电站、钢铁厂、机械厂、科学院、地下避难所。",
    requirements: [
      { id: "pop", label: "人口达到 1800", kind: "population", target: 1800, unit: "人" },
      { id: "techs", label: "累计研究 6 项科技", kind: "techsTotal", target: 6, unit: "项" },
      { id: "techs2", label: "完成 2 项城邦时代科技", kind: "techsInEra", target: 2, era: 2, unit: "项" },
      { id: "obs", label: "专业天文台（观测 Lv.2）", kind: "observatoryLevel", target: 2, unit: "级" },
    ],
  },
  {
    era: 4,
    name: "预测未来",
    subtitle: "信息与航天",
    description: "计算机、核能与人造卫星让文明第一次看见未来几十年。超算中心与轨道研究所在混沌中寻找可以依靠的确定性。",
    unlockSummary: "高级住区、垂直农场、循环水厂、核电站、自动化矿山、超算中心、气候调节设施、卫星站。",
    requirements: [
      { id: "pop", label: "人口达到 3200", kind: "population", target: 3200, unit: "人" },
      { id: "techs", label: "累计研究 11 项科技", kind: "techsTotal", target: 11, unit: "项" },
      { id: "techs3", label: "完成 2 项工业时代科技", kind: "techsInEra", target: 2, era: 3, unit: "项" },
      { id: "obs", label: "高级观测中心（观测 Lv.3）", kind: "observatoryLevel", target: 3, unit: "级" },
    ],
  },
  {
    era: 5,
    name: "文明的选择",
    subtitle: "星际文明",
    description: "聚变、纳米制造与星际航行把选择摆在文明面前：守护母星、建造行星发动机，或把火种撒向另一颗恒星。",
    unlockSummary: "生态穹顶、人造生物圈、聚变反应堆、纳米工厂、量子实验室、太空港、星际殖民基地、行星发动机、深空雷达。",
    requirements: [
      { id: "pop", label: "人口达到 5200", kind: "population", target: 5200, unit: "人" },
      { id: "techs", label: "累计研究 17 项科技", kind: "techsTotal", target: 17, unit: "项" },
      { id: "techs4", label: "完成 2 项信息时代科技", kind: "techsInEra", target: 2, era: 4, unit: "项" },
      { id: "obs", label: "轨道动力学研究所（观测 Lv.4）", kind: "observatoryLevel", target: 4, unit: "级" },
    ],
  },
] as const;

export const SAVE_DB_NAME = "trisolaris-db";
export const SAVE_STORE = "saves";
export const SAVE_VERSION = 3;
export const MAX_LOG_ENTRIES = 500;
export const MAX_TRAIL_RENDER_POINTS = 900;
