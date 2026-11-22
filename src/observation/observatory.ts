/**
 * Observatory capabilities and observation task catalogue.
 * Capability is a product of: observatory level, telescope equipment, and the
 * civilization's astronomy technology (handled by the caller via tech multiplier).
 */
import { OBSERVATORY_LEVELS, OBSERVATORY_LEVELS as LEVELS } from "../core/constants";
import type { ObservationKind, ResourceId } from "../core/types";
import type { ObservationTaskOptionView } from "../game/viewTypes";

export interface Capabilities {
  level: number;
  position: boolean;
  distance: boolean;
  velocity: boolean;
  mass: boolean;
  acceleration: boolean;
  orbit: boolean;
  predictionHorizon: number;
  positionSigma: number;
  velocitySigma: number;
  massSigma: number;
  dataRate: number;
  capabilities: string[];
}

export function levelInfo(level: number) {
  const clamped = Math.max(0, Math.min(6, Math.round(level)));
  return LEVELS[clamped];
}

export function getCapabilities(level: number): Capabilities {
  const info = levelInfo(level);
  return {
    level: info.level,
    position: info.level >= 1,
    distance: info.level >= 2,
    velocity: info.level >= 3,
    mass: info.level >= 3,
    acceleration: info.level >= 4,
    orbit: info.level >= 4,
    predictionHorizon: info.predictionHorizon,
    positionSigma: info.positionSigma,
    velocitySigma: info.velocitySigma,
    massSigma: info.massSigma,
    dataRate: info.dataRate,
    capabilities: info.capabilities,
  };
}

/** Starting level for a fresh civilization (naked-eye observations exist, no facility). */
export const NAKED_EYE_LEVEL = 0;

export interface TaskMeta {
  kind: ObservationKind;
  label: string;
  description: string;
  targetMode: "star" | "all" | "planet";
  minLevel: number;
  sigmaMultiplier: number;
  extraTurns: number;
  energyMultiplier: number;
  dataMultiplier: number;
  reach: string;
}

export const TASK_CATALOG: TaskMeta[] = [
  {
    kind: "star-position", label: "单星定位", targetMode: "star", minLevel: 1,
    description: "对单颗恒星进行连续方位测量，绘制其在天球上的视运动，得到位置与粗速度。",
    sigmaMultiplier: 1.0, extraTurns: 0, energyMultiplier: 1, dataMultiplier: 1,
    reach: "位置 / 粗糙运动方向",
  },
  {
    kind: "star-distance", label: "恒星测距", targetMode: "star", minLevel: 2,
    description: "利用视差与光谱测距估算恒星到观测者的距离，校准绝对坐标尺度。",
    sigmaMultiplier: 0.85, extraTurns: 0, energyMultiplier: 1.05, dataMultiplier: 1.15,
    reach: "距离 / 绝对位置尺度",
  },
  {
    kind: "star-velocity", label: "速度测量", targetMode: "star", minLevel: 3,
    description: "多普勒频移与长时间基线联合测量，得到恒星的相对速度矢量。",
    sigmaMultiplier: 0.75, extraTurns: 0, energyMultiplier: 1.15, dataMultiplier: 1.3,
    reach: "速度矢量 / 质量初估",
  },
  {
    kind: "planet-survey", label: "母星观测", targetMode: "planet", minLevel: 1,
    description: "观测文明母星的位置、反射光谱与热辐射，监测其气候状态。",
    sigmaMultiplier: 1.0, extraTurns: 0, energyMultiplier: 0.9, dataMultiplier: 1.0,
    reach: "母星位置 / 温度 / 轨道",
  },
  {
    kind: "binary-relative", label: "双星相对观测", targetMode: "all", minLevel: 2,
    description: "测量两颗恒星之间的相对位置与相对速度，抑制共同系统误差。",
    sigmaMultiplier: 0.8, extraTurns: 0, energyMultiplier: 1.2, dataMultiplier: 1.25,
    reach: "相对轨道 / 引力扰动",
  },
  {
    kind: "triple-joint", label: "三星联合观测", targetMode: "all", minLevel: 3,
    description: "同步观测三颗恒星，解算完整的三体构型与瞬时加速度。",
    sigmaMultiplier: 0.65, extraTurns: 1, energyMultiplier: 1.6, dataMultiplier: 1.9,
    reach: "三体构型 / 加速度 / 中期预测建模",
  },
  {
    kind: "long-term", label: "长期连续观测", targetMode: "star", minLevel: 3,
    description: "跨越多个观测周期的持续监测，压低随机噪声，建立长期轨道基线。",
    sigmaMultiplier: 0.55, extraTurns: 1, energyMultiplier: 1.45, dataMultiplier: 2.1,
    reach: "高精度轨道 / 长期趋势",
  },
  {
    kind: "anomaly", label: "异常轨道分析", targetMode: "star", minLevel: 4,
    description: "针对可疑轨道偏移的高精度跟踪观测，用于验证异常与混沌敏感性。",
    sigmaMultiplier: 0.45, extraTurns: 1, energyMultiplier: 1.9, dataMultiplier: 2.4,
    reach: "异常确认 / 混沌敏感性",
  },
];

export function taskOptionsForLevel(level: number): TaskMeta[] {
  return TASK_CATALOG.filter((t) => level >= t.minLevel);
}

export function taskMeta(kind: ObservationKind): TaskMeta {
  return TASK_CATALOG.find((t) => t.kind === kind) ?? TASK_CATALOG[0];
}

/** UI-friendly observation task options with dynamic reasons. */
export interface TaskOptionContext {
  level: number;
  energy: number;
  taskActive: boolean;
}
export function buildTaskOptions(ctx: TaskOptionContext): ObservationTaskOptionView[] {
  const out: ObservationTaskOptionView[] = [];
  for (const meta of TASK_CATALOG) {
    const info = levelInfo(ctx.level);
    const enabledByLevel = ctx.level >= meta.minLevel;
    const energyCost = Math.round(info.energyCost * meta.energyMultiplier);
    const turns = info.taskTurns + meta.extraTurns;
    let reason: string | null = null;
    if (!enabledByLevel) reason = "需要天文台等级 " + meta.minLevel;
    else if (ctx.taskActive) reason = "已有观测任务进行中";
    else if (ctx.energy < energyCost) reason = "能源不足";
    out.push({
      kind: meta.kind, label: meta.label, description: meta.description,
      targetMode: meta.targetMode,
      energyCost, turnsRequired: turns,
      enabled: reason === null,
      reason,
    });
  }
  return out;
}

export interface UpgradeCheck {
  canUpgrade: boolean;
  blockedReason: string | null;
  next: ReturnType<typeof levelInfo> | null;
}

export function checkUpgrade(level: number, researchedTechs: string[], resources: Record<ResourceId, { amount: number }>): UpgradeCheck {
  const nextLevel = Math.min(6, level + 1);
  if (level >= 6) return { canUpgrade: false, blockedReason: "已达最高观测等级", next: null };
  const next = levelInfo(nextLevel);
  if (next.requiresTech && !researchedTechs.includes(next.requiresTech)) {
    return { canUpgrade: false, blockedReason: "需要科技：" + next.requiresTech, next };
  }
  const cost = next.upgradeCost;
  if (resources.minerals.amount < cost.minerals) return { canUpgrade: false, blockedReason: "矿物不足", next };
  if (resources.metals.amount < cost.metals) return { canUpgrade: false, blockedReason: "金属不足", next };
  if (resources.energy.amount < cost.energy) return { canUpgrade: false, blockedReason: "能源不足", next };
  if (resources.science.amount < next.upgradeScience) return { canUpgrade: false, blockedReason: "科研点不足", next };
  return { canUpgrade: true, blockedReason: null, next };
}

export function maxLevel(): number {
  return OBSERVATORY_LEVELS.length - 1;
}
