/**
 * 时代进化系统（阶段 12）。
 *
 * 文明从原始部落（E1）走向星际文明（E5）。每个时代解锁新的资源、建筑与科技，
 * 旧时代建筑通过「升级」进入下一时代层级；时代推进由明确的文明条件驱动，
 * 不再只由天文台等级或科技总数单一计分。
 */
import { ERAS, ERA_MAX, RESOURCE_UNLOCK_ERA } from "../core/constants";
import type {
  BuildingDef, BuildingState, CivilizationState, EraDef, EraRequirementDef, EraRequirementKind,
  ResourceId, TechState,
} from "../core/types";
import { clamp01 } from "../core/math";
import { getTechDef } from "../technology/tree";

export interface EraRequirementStatus extends EraRequirementDef {
  current: number;
  met: boolean;
}

export interface EraStatus {
  era: number;
  def: EraDef;
  next: EraDef | null;
  requirements: EraRequirementStatus[];
  canAdvance: boolean;
  progress: number;
  unlockSummary: string;
}

export function getEraDef(era: number): EraDef {
  const index = Math.max(0, Math.min(ERAS.length - 1, Math.round(era) - 1));
  return ERAS[index];
}

export function currentEraDef(civ: CivilizationState): EraDef {
  return getEraDef(civ.era);
}

/** 统计已完成科技中属于指定时代的数量（科技 tier 即时代）。 */
export function techsInEra(techState: TechState, era: number): number {
  let count = 0;
  for (const id of techState.researched) {
    const def = getTechDef(id);
    if (def && def.tier === era) count += 1;
  }
  return count;
}

export function currentRequirementValue(
  kind: EraRequirementKind,
  req: EraRequirementDef,
  civ: CivilizationState,
  techState: TechState,
  buildingState: BuildingState,
  observatoryLevel: number,
): number {
  switch (kind) {
    case "population":
      return Math.floor(civ.population);
    case "techsTotal":
      return techState.researched.length;
    case "techsInEra":
      return techsInEra(techState, req.era ?? 1);
    case "observatoryLevel":
      return observatoryLevel;
    case "building":
      return req.buildingId ? (buildingState.counts[req.buildingId] ?? 0) : 0;
    default:
      return 0;
  }
}

export function evaluateRequirements(
  targetEra: number,
  civ: CivilizationState,
  techState: TechState,
  buildingState: BuildingState,
  observatoryLevel: number,
): EraRequirementStatus[] {
  const def = getEraDef(targetEra);
  return def.requirements.map((req) => {
    const current = currentRequirementValue(req.kind, req, civ, techState, buildingState, observatoryLevel);
    return { ...req, unit: req.unit ?? "", current, met: current >= req.target };
  });
}

export function canAdvanceEra(
  civ: CivilizationState,
  techState: TechState,
  buildingState: BuildingState,
  observatoryLevel: number,
): boolean {
  if (civ.era >= ERA_MAX) return false;
  const statuses = evaluateRequirements(civ.era + 1, civ, techState, buildingState, observatoryLevel);
  return statuses.every((s) => s.met);
}

export function eraStatus(
  civ: CivilizationState,
  techState: TechState,
  buildingState: BuildingState,
  observatoryLevel: number,
): EraStatus {
  const def = getEraDef(civ.era);
  const next = civ.era < ERA_MAX ? getEraDef(civ.era + 1) : null;
  const requirements = next
    ? evaluateRequirements(next.era, civ, techState, buildingState, observatoryLevel)
    : [];
  const ratios = requirements.map((r) => (r.target > 0 ? clamp01(r.current / r.target) : 1));
  const progress = ratios.length === 0 ? 1 : ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return {
    era: civ.era,
    def,
    next,
    requirements,
    canAdvance: requirements.length > 0 && requirements.every((r) => r.met),
    progress,
    unlockSummary: def.unlockSummary,
  };
}

/** 应用时代推进（返回新进入的时代，未推进返回 null）。 */
export function applyEraAdvance(civ: CivilizationState): number | null {
  if (civ.era >= ERA_MAX) return null;
  civ.era += 1;
  return civ.era;
}

/** 资源是否已被当前时代解锁。 */
export function resourceUnlocked(era: number, id: ResourceId): boolean {
  return era >= (RESOURCE_UNLOCK_ERA[id] ?? 1);
}

/** 建筑在本时代是否可建（定义 era 或 requiresEra 决定）。 */
export function buildingEra(def: BuildingDef): number {
  return def.era ?? def.requiresEra ?? 1;
}

export function isBuildingAvailableInEra(era: number, def: BuildingDef): boolean {
  return buildingEra(def) <= era;
}

/** 旧时代建筑产出折减（高一个时代 0.8，两个及以上 0.6）。 */
export function outdatedMultiplier(era: number, def: BuildingDef): number {
  const gap = era - buildingEra(def);
  if (gap <= 0) return 1;
  if (gap === 1) return def.outdatedMultiplier != null ? Math.max(def.outdatedMultiplier, 0.8) : 0.8;
  return def.outdatedMultiplier ?? 0.6;
}
