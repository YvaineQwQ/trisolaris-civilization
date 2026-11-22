/**
 * 政治域统一出口。
 *
 * 供 lead（game.ts / view.ts / save）消费的稳定 API：
 *  - 状态：createPoliticsState / sanitizePoliticsState
 *  - 动作：appointMinister / dismissMinister / mediateMinisters / holdSummit
 *  - 可用性：canAppoint / canDismiss / canMediate / canHoldSummit / politicsActionAvailability
 *  - 回合：politicsTurn / politicsStabilityImpact / politicsStabilityImpactLabel
 *  - 展示：departmentModifiers / ministerSummary / politicsSummary / relationInfo
 *  - 集成钩子（事件系统）：changeCapital / shiftRelation / shiftDepartmentRelation / adjustFactionSatisfaction
 */
export * from "./definitions";
export * from "./random";
export * from "./system";
