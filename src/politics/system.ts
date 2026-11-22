/**
 * 政治系统 v3 · 状态机 / 动作 / 回合结算 / 查询（供 view 与 lead 集成）
 *
 * 对外契约（docs/EXPANSION_V3.md §3 与 docs/POLITICS.md）：
 *  - createPoliticsState(seed)                    初始化 6 部门 / 6 部长 / 5 派系 / 关系网 / 资本 / 历史
 *  - appointMinister(state, candidateId, year, turn)
 *  - dismissMinister(state, departmentId, year, turn)   额外返回 stabilityImpact（-4..-8）
 *  - mediateMinisters(state, a, b, turn)
 *  - holdSummit(state, turn)
 *  - politicsTurn(state, civ, year, turn)        返回 PoliticsTurnEffects
 *  - politicsStabilityImpact(state)              每回合稳定度修正（-3..3）
 *  - departmentModifiers(state)                  六部门效率 / 乘数 / 修正明细
 *  - ministerSummary(m)                          一句话人物画像
 *
 * 设计边界：
 *  - 本模块不修改 CivilizationState；politicsTurn 只读取 civ.stability，
 *    稳定度 / 生产乘数由 lead 注入 crisis.stabilityPenalty 与 buildingEffects。
 *  - 所有写入 state 的数值都经过 clamp 且保证 Number.isFinite；
 *    NaN / Infinity / 非法 id / 空部长都不会传播到状态里。
 *  - 所有随机都来自 random.ts 的 seeded RNG（不使用 Math.random）。
 */
import type {
  DepartmentId,
  FactionId,
  MinisterState,
  PoliticsLogEntry,
  PoliticsState,
} from "../core/types";
import { clamp } from "../core/math";
import {
  DEPARTMENT_DEFS,
  DEPARTMENT_LIST,
  DEPARTMENT_ORDER,
  FACTION_DEFS,
  FACTION_INFLUENCE_BASE,
  FACTION_LIST,
  FACTION_ORDER,
  MINISTER_TRAIT_MAP,
  POLITICS_CONFIG,
  POLITICS_FLAVOR,
  departmentName,
  factionName,
  factionSatisfactionLabel,
  factionShort,
  fillTemplate,
  isDepartmentId,
  isFactionId,
  relationLabel,
  type PoliticsLogKind,
  type PoliticsLogSeverity,
  type RelationLabel,
  type TraitEffect,
} from "./definitions";
import {
  PoliticsRng,
  crossFactionAffinity,
  generateMinister,
  naturalRelationTarget,
  rngForState,
  rollCapitalLoss,
  rollInitialRelation,
  rollMediateGain,
  rollSummitSatisfaction,
  sharedFactionCount,
} from "./random";

/* ------------------------------------------------------------------ *
 *  1. 对外类型
 * ------------------------------------------------------------------ */

/** politicsTurn 读取的文明上下文（CivilizationState 结构兼容，避免运行时耦合）。 */
export interface PoliticsCivilContext {
  stability?: number;
  population?: number;
  era?: number;
}

export interface PoliticsLogInput {
  kind: PoliticsLogKind;
  message: string;
  severity: PoliticsLogSeverity;
}

export interface PoliticsActionResult {
  ok: boolean;
  reason: string | null;
  logs: PoliticsLogEntry[];
}

export interface PoliticsDismissResult extends PoliticsActionResult {
  /** 罢免的即时稳定度冲击（-4..-8，0 表示动作失败）。由 lead 直接注入 civ.stability。 */
  stabilityImpact: number;
}

/** 每回合政治结算产物：lead 直接消费这些乘数（1 = 无修正）。 */
export interface PoliticsTurnEffects {
  stabilityDelta: number;
  researchMultiplier: number;
  industryMultiplier: number;
  agricultureMultiplier: number;
  observationMultiplier: number;
  defenseMultiplier: number;
  capitalGain: number;
  logs: PoliticsLogInput[];
}

/** 部门修正明细（字段与 viewTypes.ts 的 DepartmentPoliticalView.modifiers 一一对应）。 */
export interface DepartmentModifierEntry {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  detail: string;
}

export interface DepartmentPoliticsDetail {
  id: DepartmentId;
  name: string;
  short: string;
  icon: string;
  description: string;
  ministerId: string | null;
  ministerName: string | null;
  /** 部门效率 0.7..1.3（空缺 = 0.7）。 */
  efficiency: number;
  efficiencyLabel: string;
  warning: string | null;
  modifiers: DepartmentModifierEntry[];
}

export interface PoliticsModifiers {
  departments: DepartmentPoliticsDetail[];
  stabilityDelta: number;
  stabilityImpactLabel: string;
  capitalRate: number;
  researchMultiplier: number;
  industryMultiplier: number;
  agricultureMultiplier: number;
  observationMultiplier: number;
  defenseMultiplier: number;
}

export interface PoliticsSummary {
  text: string;
  tone: "stable" | "tense" | "fragile" | "crisis";
}

export interface PoliticsActionAvailability {
  appointCost: number;
  dismissCost: number;
  mediateCost: number;
  summitCost: number;
  canSummit: boolean;
  cooldownTurns: number;
}

/* ------------------------------------------------------------------ *
 *  2. 数值安全工具（策略：入口 sanitize + 出口 clamp，NaN 永不出模块）
 * ------------------------------------------------------------------ */

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampFinite(value: unknown, min: number, max: number, fallback = 0): number {
  return clamp(safeNumber(value, fallback), min, max);
}

function clampInt(value: unknown, min: number, max: number, fallback = 0): number {
  return Math.round(clampFinite(value, min, max, fallback));
}

function roundTo(value: number, digits: number): number {
  const v = safeNumber(value);
  const f = Math.pow(10, digits);
  const out = Math.round(v * f) / f;
  return Number.isFinite(out) ? out : 0;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += safeNumber(v);
  return sum / values.length;
}

function normalizeYear(year: unknown): number {
  return clampInt(year, -1000000, 1000000, 0);
}

function normalizeTurn(turn: unknown): number {
  return clampInt(turn, -1000000, 1000000, 0);
}

function fmtSignedPercent(value: number, digits = 0): string {
  const pct = (safeNumber(value) * 100).toFixed(digits);
  return (safeNumber(value) > 0 ? "+" : "") + pct + "%";
}

function fmtSigned(value: number, digits = 1): string {
  const v = roundTo(value, digits);
  return (v > 0 ? "+" : "") + v.toFixed(digits);
}

const LOG_KINDS: readonly string[] = ["appoint", "dismiss", "mediate", "faction", "warning", "event"];
const LOG_SEVERITIES: readonly string[] = ["info", "success", "warning", "critical"];

function asLogKind(value: unknown): PoliticsLogKind {
  return typeof value === "string" && LOG_KINDS.indexOf(value) >= 0 ? (value as PoliticsLogKind) : "faction";
}

function asLogSeverity(value: unknown): PoliticsLogSeverity {
  return typeof value === "string" && LOG_SEVERITIES.indexOf(value) >= 0
    ? (value as PoliticsLogSeverity)
    : "info";
}

/* ------------------------------------------------------------------ *
 *  3. 状态清洗（读档 / 旧数据 / 事件系统直接改值之后都能安全继续）
 * ------------------------------------------------------------------ */

function sanitizeMinister(raw: unknown, department: DepartmentId): MinisterState | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<MinisterState>;
  const factions: FactionId[] = [];
  if (Array.isArray(m.factions)) {
    for (const f of m.factions) {
      if (isFactionId(f) && factions.indexOf(f) < 0 && factions.length < 2) factions.push(f);
    }
  }
  if (factions.length === 0) factions.push(FACTION_ORDER[0]);
  const traits: string[] = [];
  if (Array.isArray(m.traits)) {
    for (const t of m.traits) {
      if (typeof t === "string" && MINISTER_TRAIT_MAP[t] && traits.indexOf(t) < 0 && traits.length < 2) {
        traits.push(t);
      }
    }
  }
  return {
    id: typeof m.id === "string" && m.id.length > 0 ? m.id : "m-0",
    name: typeof m.name === "string" && m.name.trim().length > 0 ? m.name : "未署名委员",
    department,
    factions,
    competence: clampInt(m.competence, POLITICS_CONFIG.competenceMin, POLITICS_CONFIG.competenceMax, 5),
    loyalty: clampInt(m.loyalty, POLITICS_CONFIG.loyaltyMin, POLITICS_CONFIG.loyaltyMax, 50),
    integrity: clampInt(m.integrity, POLITICS_CONFIG.integrityMin, POLITICS_CONFIG.integrityMax, 50),
    ambition: clampInt(m.ambition, POLITICS_CONFIG.ambitionMin, POLITICS_CONFIG.ambitionMax, 50),
    age: clampInt(m.age, POLITICS_CONFIG.ageMin, POLITICS_CONFIG.ageMax, 48),
    traits,
    portraitSeed: clampInt(m.portraitSeed, 1, 2147483646, 1),
    appointedYear: normalizeYear(m.appointedYear),
  };
}

/**
 * 把任意（可能来自旧存档 / 事件系统 / 测试手工构造的）政治状态修正为合法状态。
 * 幂等：重复调用不会改变结果；所有字段 clamp 且有限。
 */
export function sanitizePoliticsState(state: PoliticsState): PoliticsState {
  if (!state || typeof state !== "object") {
    return createPoliticsState("SANITIZE-FALLBACK");
  }

  const rawMinisters = (state.ministers || {}) as Record<string, unknown>;
  const ministers = {} as Record<DepartmentId, MinisterState | null>;
  for (const dept of DEPARTMENT_ORDER) {
    const m = sanitizeMinister(rawMinisters[dept], dept);
    ministers[dept] = m;
  }
  state.ministers = ministers;

  const rawCandidates = Array.isArray(state.candidates) ? state.candidates : [];
  const seenIds = new Set<string>();
  const candidates: MinisterState[] = [];
  for (const raw of rawCandidates) {
    const dept = (raw as Partial<MinisterState> | null)?.department;
    if (!isDepartmentId(dept)) continue;
    const m = sanitizeMinister(raw, dept);
    if (!m || seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    m.appointedYear = 0;
    candidates.push(m);
  }
  // 候选人与在任部长 id 冲突时丢弃
  for (const dept of DEPARTMENT_ORDER) {
    const serving = ministers[dept];
    if (serving) {
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (candidates[i].id === serving.id) candidates.splice(i, 1);
      }
    }
  }
  state.candidates = candidates.slice(0, POLITICS_CONFIG.candidatePoolMax);

  const rawFactions = (state.factions || {}) as Record<string, unknown>;
  const factions = {} as Record<FactionId, { influence: number; satisfaction: number }>;
  for (const id of FACTION_ORDER) {
    const raw = rawFactions[id] as { influence?: unknown; satisfaction?: unknown } | undefined;
    const baseInfluence = FACTION_INFLUENCE_BASE[id];
    factions[id] = {
      influence: clampFinite(raw?.influence, 0, 100, baseInfluence),
      satisfaction: clampFinite(raw?.satisfaction, 0, 100, 55),
    };
  }
  state.factions = factions;

  const rawRelations = (state.relations || {}) as Record<string, unknown>;
  const relations: Record<string, number> = {};
  for (const key of Object.keys(rawRelations)) {
    if (typeof key !== "string" || key.indexOf("|") <= 0 || key.indexOf("|") !== key.lastIndexOf("|")) continue;
    relations[key] = Math.round(clampFinite(rawRelations[key], POLITICS_CONFIG.relationMin, POLITICS_CONFIG.relationMax, 0));
  }
  state.relations = relations;

  state.capital = clampFinite(state.capital, POLITICS_CONFIG.capitalMin, POLITICS_CONFIG.capitalMax, 24);
  state.capitalRate = clampFinite(
    state.capitalRate,
    POLITICS_CONFIG.capitalRateMin,
    POLITICS_CONFIG.capitalRateMax,
    3,
  );
  state.lastSummitTurn = normalizeTurn(state.lastSummitTurn);
  state.nextId = Math.max(1, clampInt(state.nextId, 1, Number.MAX_SAFE_INTEGER, 1));
  state.nextHistoryId = Math.max(1, clampInt(state.nextHistoryId, 1, Number.MAX_SAFE_INTEGER, 1));

  const rawHistory = Array.isArray(state.history) ? state.history : [];
  const history: PoliticsLogEntry[] = [];
  for (const raw of rawHistory) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Partial<PoliticsLogEntry>;
    history.push({
      id: Math.max(1, clampInt(entry.id, 1, Number.MAX_SAFE_INTEGER, history.length + 1)),
      year: normalizeYear(entry.year),
      turn: normalizeTurn(entry.turn),
      kind: asLogKind(entry.kind),
      message: typeof entry.message === "string" ? entry.message : "",
      severity: asLogSeverity(entry.severity),
    });
  }
  state.history = history.slice(Math.max(0, history.length - POLITICS_CONFIG.historyLimit));

  ensureRelations(state);
  renormalizeInfluence(state);
  return state;
}

/* ------------------------------------------------------------------ *
 *  4. 历史日志
 * ------------------------------------------------------------------ */

/** 追加一条政治日志（自动分配 id、维护历史上限），返回写入的条目。 */
export function pushPoliticsLog(
  state: PoliticsState,
  input: PoliticsLogInput,
  year = 0,
  turn = 0,
): PoliticsLogEntry {
  if (!state.history) state.history = [];
  const entry: PoliticsLogEntry = {
    id: Math.max(1, clampInt(state.nextHistoryId, 1, Number.MAX_SAFE_INTEGER, 1)),
    year: normalizeYear(year),
    turn: normalizeTurn(turn),
    kind: asLogKind(input.kind),
    message: typeof input.message === "string" ? input.message : "",
    severity: asLogSeverity(input.severity),
  };
  state.nextHistoryId = entry.id + 1;
  state.history.push(entry);
  if (state.history.length > POLITICS_CONFIG.historyLimit) {
    state.history.splice(0, state.history.length - POLITICS_CONFIG.historyLimit);
  }
  return entry;
}

/** 批量写入并返回本轮新增的日志输入（供 PoliticsTurnEffects.logs）。 */
function pushLogs(
  state: PoliticsState,
  inputs: readonly PoliticsLogInput[],
  year: number,
  turn: number,
): PoliticsLogEntry[] {
  const out: PoliticsLogEntry[] = [];
  for (const input of inputs) out.push(pushPoliticsLog(state, input, year, turn));
  return out;
}

/* ------------------------------------------------------------------ *
 *  5. 关系矩阵
 * ------------------------------------------------------------------ */

/** 关系键：两个部长 id 按字典序拼接（与 core/types.ts 的冻结约定一致）。 */
export function relationKey(aId: string, bId: string): string {
  return aId < bId ? aId + "|" + bId : bId + "|" + aId;
}

/** 读取两名部长关系（-100..100）；缺省 0。 */
export function getRelation(state: PoliticsState, aId: string, bId: string): number {
  if (aId === bId) return 100;
  return Math.round(clampFinite(state.relations[relationKey(aId, bId)], -100, 100, 0));
}

/** relationsBetween 的别名：两名部长之间的关系值。 */
export function relationsBetween(state: PoliticsState, aId: string, bId: string): number {
  return getRelation(state, aId, bId);
}

function setRelation(state: PoliticsState, aId: string, bId: string, score: unknown): number {
  if (aId === bId) return 100;
  const value = Math.round(clampFinite(score, POLITICS_CONFIG.relationMin, POLITICS_CONFIG.relationMax, 0));
  state.relations[relationKey(aId, bId)] = value;
  return value;
}

/** 按增量调整关系并 clamp（供事件系统 / lead 使用），返回新关系值。 */
export function shiftRelation(state: PoliticsState, aId: string, bId: string, delta: number): number {
  return setRelation(state, aId, bId, getRelation(state, aId, bId) + safeNumber(delta));
}

/** 按部门调整关系（部长空缺时静默忽略），返回新关系值。 */
export function shiftDepartmentRelation(
  state: PoliticsState,
  a: DepartmentId,
  b: DepartmentId,
  delta: number,
): number {
  const ma = state.ministers[a];
  const mb = state.ministers[b];
  if (!ma || !mb || ma.id === mb.id) return 0;
  return shiftRelation(state, ma.id, mb.id, delta);
}

/** 两名部长关系的中文标签与色调（五档）。 */
export function relationInfo(score: number): RelationLabel {
  return relationLabel(score);
}

/** 两个部门部长之间的关系（任一方空缺返回 0）。 */
export function departmentRelation(state: PoliticsState, a: DepartmentId, b: DepartmentId): number {
  const ma = state.ministers[a];
  const mb = state.ministers[b];
  if (!ma || !mb || ma.id === mb.id) return 0;
  return getRelation(state, ma.id, mb.id);
}

/** 两个部门部长的关系 + 标签（供 view 组装 MinisterRelationView）。 */
export function departmentRelationInfo(
  state: PoliticsState,
  a: DepartmentId,
  b: DepartmentId,
): { score: number; label: string; tone: RelationLabel["tone"] } {
  const score = departmentRelation(state, a, b);
  const info = relationLabel(score);
  return { score, label: info.label, tone: info.tone };
}

/** 补齐所有在任部长两两之间的关系（缺失记 0），并清掉已卸任部长留下的旧键。 */
export function ensureRelations(state: PoliticsState): void {
  const serving = servingMinisters(state);
  const servingIds = new Set<string>();
  for (const m of serving) servingIds.add(m.id);
  for (const key of Object.keys(state.relations)) {
    const parts = key.split("|");
    if (parts.length !== 2 || !servingIds.has(parts[0]) || !servingIds.has(parts[1])) {
      delete state.relations[key];
    }
  }
  for (let i = 0; i < serving.length; i++) {
    for (let j = i + 1; j < serving.length; j++) {
      const key = relationKey(serving[i].id, serving[j].id);
      if (!(key in state.relations)) state.relations[key] = 0;
    }
  }
}

/* ------------------------------------------------------------------ *
 *  6. 派系
 * ------------------------------------------------------------------ */

function renormalizeInfluence(state: PoliticsState): void {
  let sum = 0;
  for (const id of FACTION_ORDER) sum += clampFinite(state.factions[id]?.influence, 0, 100, 20);
  if (sum <= 0) {
    const equal = 100 / FACTION_ORDER.length;
    for (const id of FACTION_ORDER) state.factions[id].influence = roundTo(equal, 1);
    return;
  }
  let roundedSum = 0;
  for (const id of FACTION_ORDER) {
    const scaled = clampFinite((clampFinite(state.factions[id].influence, 0, 100, 20) / sum) * 100, 0, 100, 20);
    const value = roundTo(scaled, 1);
    state.factions[id].influence = value;
    roundedSum += value;
  }
  // 舍入误差补到影响力最大的一派，保证五派影响力合计恒为 100。
  const diff = roundTo(100 - roundedSum, 1);
  if (diff !== 0) {
    let target: FactionId = FACTION_ORDER[0];
    for (const id of FACTION_ORDER) {
      if (state.factions[id].influence > state.factions[target].influence) target = id;
    }
    state.factions[target].influence = clampFinite(state.factions[target].influence + diff, 0, 100, 20);
  }
}

function adjustInfluence(state: PoliticsState, faction: FactionId, delta: number): void {
  if (!state.factions[faction]) return;
  state.factions[faction].influence = clampFinite(
    state.factions[faction].influence + safeNumber(delta),
    0,
    100,
    20,
  );
  renormalizeInfluence(state);
}

/** 调整派系满意度（clamp 0..100），返回新值。供事件系统 / lead 调用。 */
export function adjustFactionSatisfaction(state: PoliticsState, faction: FactionId, delta: number): number {
  if (!state.factions[faction]) return 0;
  state.factions[faction].satisfaction = clampFinite(
    state.factions[faction].satisfaction + safeNumber(delta),
    0,
    100,
    55,
  );
  return state.factions[faction].satisfaction;
}

/** 派系影响力（0..100）。 */
export function factionInfluence(state: PoliticsState, faction: FactionId): number {
  return clampFinite(state.factions[faction]?.influence, 0, 100, 0);
}

/** 派系满意度（0..100）。 */
export function factionSatisfaction(state: PoliticsState, faction: FactionId): number {
  return clampFinite(state.factions[faction]?.satisfaction, 0, 100, 0);
}

/** 某派系在任部长列表。 */
export function factionMembers(state: PoliticsState, faction: FactionId): MinisterState[] {
  return servingMinisters(state).filter((m) => factionsOf(m).indexOf(faction) >= 0);
}

/** 派系满意度每回合的目标值（影响力 + 席位 + 部长忠诚 + 偏好部门空缺）。 */
function factionSatisfactionTarget(state: PoliticsState, faction: FactionId): number {
  const influence = factionInfluence(state, faction);
  const members = factionMembers(state, faction);
  let target = 50 + (influence - 20) * 0.5 + members.length * 5;
  if (members.length > 0) target += (mean(members.map((m) => m.loyalty)) - 50) * 0.2;
  for (const m of members) {
    for (const traitId of m.traits) {
      const def = MINISTER_TRAIT_MAP[traitId];
      if (def) target += def.effect.factionSatisfaction ?? 0;
    }
  }
  for (const dept of FACTION_DEFS[faction].preferredDepartments) {
    if (!state.ministers[dept]) target -= 4;
  }
  return clamp(target, 0, 100);
}

/* ------------------------------------------------------------------ *
 *  7. 候选人池
 * ------------------------------------------------------------------ */

/** 在任部长（按部门顺序）。 */
export function servingMinisters(state: PoliticsState): MinisterState[] {
  const out: MinisterState[] = [];
  for (const dept of DEPARTMENT_ORDER) {
    const m = state.ministers[dept];
    if (m) out.push(m);
  }
  return out;
}

/** 空缺部门列表。 */
export function vacantDepartments(state: PoliticsState): DepartmentId[] {
  const out: DepartmentId[] = [];
  for (const dept of DEPARTMENT_ORDER) if (!state.ministers[dept]) out.push(dept);
  return out;
}

/** 某部门在任部长（空缺 null）。 */
export function ministerByDepartment(state: PoliticsState, department: DepartmentId): MinisterState | null {
  if (!isDepartmentId(department)) return null;
  return state.ministers[department] ?? null;
}

function collectUsedNames(state: PoliticsState): Set<string> {
  const used = new Set<string>();
  for (const m of servingMinisters(state)) used.add(m.name);
  for (const c of state.candidates) used.add(c.name);
  return used;
}

function candidatePriority(state: PoliticsState, candidate: MinisterState): number {
  const vacant = !state.ministers[candidate.department];
  return (vacant ? 100 : 0) + candidate.competence;
}

function trimCandidates(state: PoliticsState): void {
  if (state.candidates.length <= POLITICS_CONFIG.candidatePoolMax) return;
  const sorted = state.candidates.slice().sort((a, b) => {
    const diff = candidatePriority(state, b) - candidatePriority(state, a);
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  state.candidates = sorted.slice(0, POLITICS_CONFIG.candidatePoolMax);
}

/** 生成一名新候选人（受 pool 上限保护；非法部门返回 null）。 */
export function generateCandidate(
  state: PoliticsState,
  rng: PoliticsRng,
  department: DepartmentId,
): MinisterState | null {
  if (!isDepartmentId(department)) return null;
  if (state.candidates.length >= POLITICS_CONFIG.candidatePoolMax) return null;
  const id = Math.max(1, clampInt(state.nextId, 1, Number.MAX_SAFE_INTEGER, 1));
  state.nextId = id + 1;
  return generateMinister(rng, id, department, collectUsedNames(state));
}

function randomCandidateDepartment(state: PoliticsState, rng: PoliticsRng): DepartmentId {
  const vacant = vacantDepartments(state);
  if (vacant.length > 0 && rng.bool(0.65)) return rng.pick(vacant);
  return rng.pick(DEPARTMENT_ORDER);
}

/**
 * 保证每个空缺部门至少有一名可任命候选人（不足时补员并裁剪到上限）。
 * 返回是否新增了候选人。
 */
export function ensureCandidateCoverage(state: PoliticsState, rng: PoliticsRng): boolean {
  let changed = false;
  for (const dept of DEPARTMENT_ORDER) {
    if (state.ministers[dept]) continue;
    if (state.candidates.some((c) => c.department === dept)) continue;
    let candidate = generateCandidate(state, rng, dept);
    if (!candidate && state.candidates.length >= POLITICS_CONFIG.candidatePoolMax) {
      // 池满时先淘汰一名「部门已满」的低能力候选，再为空缺部门补位，避免空缺无人可任。
      const removable = state.candidates
        .filter((c) => state.ministers[c.department] != null)
        .sort((a, b) => a.competence - b.competence || (a.id < b.id ? -1 : 1));
      const victim = removable[0];
      if (victim) {
        const index = state.candidates.indexOf(victim);
        if (index >= 0) state.candidates.splice(index, 1);
        candidate = generateCandidate(state, rng, dept);
      }
    }
    if (candidate) {
      state.candidates.push(candidate);
      changed = true;
    }
  }
  trimCandidates(state);
  return changed;
}

/**
 * 每 3 回合刷新候选人：淘汰少量「部门已满」的候选，补入新面孔，
 * 并保证空缺部门始终有候选人可任命。返回本轮新增的候选人。
 */
export function refreshCandidates(state: PoliticsState, year: number, turn: number): MinisterState[] {
  const rng = rngForState(state, "candidates", turn);
  const removable = state.candidates
    .filter((c) => state.ministers[c.department] != null)
    .sort((a, b) => a.competence - b.competence || (a.id < b.id ? -1 : 1));
  const dropCount = Math.min(2, removable.length);
  for (let i = 0; i < dropCount; i++) {
    const index = state.candidates.indexOf(removable[i]);
    if (index >= 0) state.candidates.splice(index, 1);
  }

  const added: MinisterState[] = [];
  let guard = 0;
  while (state.candidates.length < POLITICS_CONFIG.candidatePoolTarget && guard < 8) {
    guard++;
    const dept = randomCandidateDepartment(state, rng);
    const candidate = generateCandidate(state, rng, dept);
    if (!candidate) break;
    state.candidates.push(candidate);
    added.push(candidate);
  }
  ensureCandidateCoverage(state, rng);
  trimCandidates(state);
  return added;
}

/* ------------------------------------------------------------------ *
 *  8. 创建初始状态
 * ------------------------------------------------------------------ */

/** 初始政治状态：6 名部长、5 名候选人、五派影响力合计 100、关系网、资本 20..30。 */
export function createPoliticsState(seed: string | number = "TRISOLARIS-2187"): PoliticsState {
  const rng = new PoliticsRng(seed);
  const usedNames = new Set<string>();
  let nextId = 1;

  const ministers = {} as Record<DepartmentId, MinisterState | null>;
  for (const dept of DEPARTMENT_ORDER) {
    const minister = generateMinister(rng, nextId, dept, usedNames);
    nextId++;
    minister.appointedYear = 0;
    ministers[dept] = minister;
  }

  const factions = {} as Record<FactionId, { influence: number; satisfaction: number }>;
  let weightSum = 0;
  const weights: Record<FactionId, number> = {} as Record<FactionId, number>;
  for (const id of FACTION_ORDER) {
    const weight = Math.max(4, FACTION_INFLUENCE_BASE[id] + rng.float(-3.5, 3.5));
    weights[id] = weight;
    weightSum += weight;
  }
  for (const id of FACTION_ORDER) {
    factions[id] = {
      influence: roundTo((weights[id] / weightSum) * 100, 1),
      satisfaction: clampInt(55 + rng.float(-7, 8), 0, 100, 55),
    };
  }

  const relations: Record<string, number> = {};
  for (let i = 0; i < DEPARTMENT_ORDER.length; i++) {
    for (let j = i + 1; j < DEPARTMENT_ORDER.length; j++) {
      const a = ministers[DEPARTMENT_ORDER[i]];
      const b = ministers[DEPARTMENT_ORDER[j]];
      if (!a || !b) continue;
      relations[relationKey(a.id, b.id)] = rollInitialRelation(rng, a, b);
    }
  }

  const candidates: MinisterState[] = [];
  for (let i = 0; i < POLITICS_CONFIG.initialCandidateCount; i++) {
    const dept = rng.pick(DEPARTMENT_ORDER);
    const candidate = generateMinister(rng, nextId, dept, usedNames);
    nextId++;
    candidate.appointedYear = 0;
    candidates.push(candidate);
  }

  const state: PoliticsState = {
    ministers,
    candidates,
    nextId,
    factions,
    relations,
    capital: clampInt(rng.int(POLITICS_CONFIG.startingCapitalMin, POLITICS_CONFIG.startingCapitalMax), 0, 200, 24),
    capitalRate: 3,
    lastSummitTurn: -999,
    history: [],
    nextHistoryId: 1,
  };

  renormalizeInfluence(state);
  sanitizePoliticsState(state);

  for (const message of POLITICS_FLAVOR.opening) {
    pushPoliticsLog(state, { kind: "faction", message, severity: "info" }, 0, 0);
  }
  state.capitalRate = computeCapitalRate(state);
  return state;
}

/* ------------------------------------------------------------------ *
 *  9. 部长特质 / 部门效率
 * ------------------------------------------------------------------ */

function safeTraits(minister: MinisterState): string[] {
  if (!Array.isArray(minister.traits)) return [];
  const out: string[] = [];
  for (const id of minister.traits) {
    if (typeof id === "string" && MINISTER_TRAIT_MAP[id] && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

function factionsOf(minister: MinisterState): FactionId[] {
  if (!Array.isArray(minister.factions)) return [];
  const out: FactionId[] = [];
  for (const id of minister.factions) {
    if (isFactionId(id) && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

function traitEffectsOf(minister: MinisterState): TraitEffect[] {
  const out: TraitEffect[] = [];
  for (const id of safeTraits(minister)) {
    const def = MINISTER_TRAIT_MAP[id];
    if (def) out.push(def.effect);
  }
  return out;
}

function traitSum(minister: MinisterState, key: keyof TraitEffect): number {
  let sum = 0;
  for (const effect of traitEffectsOf(minister)) sum += effect[key] ?? 0;
  return sum;
}

/** 有效能力：基础能力 + 特质修正，clamp 1..10。 */
export function effectiveCompetence(minister: MinisterState): number {
  return clampInt(
    clampFinite(minister.competence, 1, 10, 5) + traitSum(minister, "competence"),
    POLITICS_CONFIG.competenceMin,
    POLITICS_CONFIG.competenceMax,
    5,
  );
}

function departmentTraitKey(department: DepartmentId): keyof TraitEffect | null {
  switch (department) {
    case "science":
      return "research";
    case "industry":
      return "industry";
    case "agriculture":
      return "agriculture";
    case "defense":
      return "defense";
    case "observation":
      return "observation";
    default:
      return null;
  }
}

/** 单对关系的协同 / 敌对系数：友好每对 +2%..5%，敌对 -2%..5%。 */
function relationPerformanceFactor(score: number): number {
  const s = safeNumber(score);
  if (s >= POLITICS_CONFIG.friendlyRelation) {
    const t = clamp((s - 25) / 75, 0, 1);
    return 0.02 + t * 0.03;
  }
  if (s <= POLITICS_CONFIG.hostileRelation) {
    const t = clamp((-s - 25) / 75, 0, 1);
    return -(0.02 + t * 0.03);
  }
  return 0;
}

function networkBonus(state: PoliticsState, minister: MinisterState): number {
  let sum = 0;
  for (const other of servingMinisters(state)) {
    if (other.id === minister.id) continue;
    sum += relationPerformanceFactor(getRelation(state, minister.id, other.id));
  }
  return roundTo(clamp(sum, -0.08, 0.08), 4);
}

function factionSupportBonus(state: PoliticsState, minister: MinisterState, department: DepartmentId): number {
  let preferred = 0;
  let bestSatisfaction = 0;
  for (const id of factionsOf(minister)) {
    const def = FACTION_DEFS[id];
    if (!def) continue;
    if (def.preferredDepartments.indexOf(department) >= 0) preferred++;
    bestSatisfaction = Math.max(bestSatisfaction, factionSatisfaction(state, id));
  }
  let bonus = Math.min(0.04, preferred * 0.02);
  if (bestSatisfaction >= POLITICS_CONFIG.highSatisfaction) bonus += 0.02;
  else if (bestSatisfaction < POLITICS_CONFIG.lowSatisfaction) bonus -= 0.03;
  return roundTo(bonus, 4);
}

function departmentTraitBonus(minister: MinisterState, department: DepartmentId): number {
  const key = departmentTraitKey(department);
  if (!key) return 0;
  return roundTo(clamp(traitSum(minister, key), -0.08, 0.08), 4);
}

interface EfficiencyBreakdown {
  department: DepartmentId;
  minister: MinisterState | null;
  competence: number;
  base: number;
  network: number;
  factionSupport: number;
  traitBonus: number;
  efficiency: number;
}

function computeEfficiency(state: PoliticsState, department: DepartmentId): EfficiencyBreakdown {
  const minister = state.ministers[department] ?? null;
  if (!minister) {
    return {
      department,
      minister: null,
      competence: 0,
      base: POLITICS_CONFIG.efficiencyMin,
      network: 0,
      factionSupport: 0,
      traitBonus: 0,
      efficiency: POLITICS_CONFIG.efficiencyMin,
    };
  }
  const competence = effectiveCompetence(minister);
  const base = 0.7 + 0.06 * competence;
  const network = networkBonus(state, minister);
  const factionSupport = factionSupportBonus(state, minister, department);
  const traitBonus = departmentTraitBonus(minister, department);
  const efficiency = roundTo(
    clamp(
      base + network + factionSupport + traitBonus,
      POLITICS_CONFIG.efficiencyMin,
      POLITICS_CONFIG.efficiencyMax,
    ),
    3,
  );
  return { department, minister, competence, base, network, factionSupport, traitBonus, efficiency };
}

/** 单部门效率（0.7..1.3；空缺固定 0.7）。供 view / lead 直接读取。 */
export function departmentEfficiency(state: PoliticsState, department: DepartmentId): number {
  if (!isDepartmentId(department)) return POLITICS_CONFIG.efficiencyMin;
  return computeEfficiency(state, department).efficiency;
}

/** 部门效率的中文评价。 */
export function efficiencyLabel(efficiency: number, hasMinister = true): string {
  if (!hasMinister) return "空缺";
  const eff = clampFinite(efficiency, 0.7, 1.3, 0.7);
  if (eff >= 1.2) return "卓越";
  if (eff >= 1.08) return "高效";
  if (eff >= 0.96) return "正常";
  if (eff >= 0.86) return "迟滞";
  return "低效";
}

function traitsNames(minister: MinisterState): string {
  const names: string[] = [];
  for (const id of safeTraits(minister)) {
    const def = MINISTER_TRAIT_MAP[id];
    if (def) names.push(def.name);
  }
  return names.length > 0 ? names.join("、") : "无显著特质";
}

function traitsTone(minister: MinisterState): "good" | "bad" | "neutral" {
  let good = 0;
  let bad = 0;
  for (const id of safeTraits(minister)) {
    const def = MINISTER_TRAIT_MAP[id];
    if (!def) continue;
    if (def.tone === "good") good++;
    else if (def.tone === "bad") bad++;
  }
  if (good > bad) return "good";
  if (bad > good) return "bad";
  return "neutral";
}

/* ------------------------------------------------------------------ *
 *  10. 稳定度 / 政治资本
 * ------------------------------------------------------------------ */

/** 未经 clamp 的稳定度原始修正（内部使用；对外一律走 politicsStabilityImpact）。 */
function computeRawStabilityDelta(state: PoliticsState): number {
  const serving = servingMinisters(state);
  if (serving.length === 0) return POLITICS_CONFIG.stabilityTurnMin;

  const satisfactions = FACTION_ORDER.map((id) => factionSatisfaction(state, id));
  const avgSatisfaction = mean(satisfactions);
  let delta = ((avgSatisfaction - 50) / 50) * 1.6;

  const admin = state.ministers.administration ?? null;
  if (admin) {
    delta += (effectiveCompetence(admin) - 5.5) * 0.06;
    delta += (clampFinite(admin.integrity, 0, 100, 50) - 50) * 0.004;
  }

  let traitStability = 0;
  for (const minister of serving) traitStability += traitSum(minister, "stability");
  delta += clamp(traitStability, -1, 1);

  let network = 0;
  for (let i = 0; i < serving.length; i++) {
    for (let j = i + 1; j < serving.length; j++) {
      const score = getRelation(state, serving[i].id, serving[j].id);
      if (score >= POLITICS_CONFIG.friendlyRelation) network += 0.15;
      else if (score <= POLITICS_CONFIG.hostileRelation) network -= 0.35;
    }
  }
  delta += clamp(network, -1, 1);

  const vacant = vacantDepartments(state).length;
  delta += Math.max(-2, vacant * -0.35);

  let maxInfluence = 0;
  for (const id of FACTION_ORDER) maxInfluence = Math.max(maxInfluence, factionInfluence(state, id));
  if (maxInfluence > 55) delta -= 0.6;
  else if (maxInfluence > POLITICS_CONFIG.influenceWarningThreshold) delta -= 0.3;

  let lowSatisfactionCount = 0;
  for (const value of satisfactions) if (value < POLITICS_CONFIG.lowSatisfaction) lowSatisfactionCount++;
  delta -= Math.min(0.75, lowSatisfactionCount * 0.25);

  return delta;
}

/**
 * 政治系统每回合对全局稳定度的修正（-3..3，正数 = 提升稳定度）。
 * lead 把它取负注入 crisis.stabilityPenalty（该字段为正 = 惩罚）。
 */
export function politicsStabilityImpact(state: PoliticsState): number {
  return roundTo(clamp(computeRawStabilityDelta(state), POLITICS_CONFIG.stabilityTurnMin, POLITICS_CONFIG.stabilityTurnMax), 2);
}

/** 稳定度修正的中文评价（供 view 的 stabilityImpactLabel）。 */
export function politicsStabilityImpactLabel(value: number): string {
  const v = safeNumber(value);
  if (v >= 1.2) return "政治稳固，民心可用";
  if (v >= 0.4) return "政局平稳";
  if (v > -0.4) return "暗流涌动";
  if (v > -1.2) return "派系倾轧，政令不畅";
  return "联合政府濒临瓦解";
}

/** 每回合政治资本收入基准（不含文明稳定度；clamp 2..6）。 */
export function computeCapitalRate(state: PoliticsState): number {
  const admin = state.ministers.administration ?? null;
  const competence = admin ? effectiveCompetence(admin) : 3;
  let traitCapital = 0;
  for (const minister of servingMinisters(state)) {
    traitCapital += traitSum(minister, "capitalRate");
  }
  const avgSatisfaction = mean(FACTION_ORDER.map((id) => factionSatisfaction(state, id)));
  const raw = 2 + competence * 0.22 + (avgSatisfaction - 50) * 0.02 + traitCapital;
  return roundTo(clamp(raw, POLITICS_CONFIG.capitalRateMin, POLITICS_CONFIG.capitalRateMax), 1);
}

/** 回合内资本收入：在基准上叠加文明稳定度影响。 */
function capitalRateForTurn(state: PoliticsState, civStability: number): number {
  const base = computeCapitalRate(state);
  const stability = clampFinite(civStability, 0, 100, 50);
  return roundTo(
    clamp(base + (stability - 50) * 0.015, POLITICS_CONFIG.capitalRateMin, POLITICS_CONFIG.capitalRateMax),
    1,
  );
}

/** 增减政治资本（clamp 0..200），返回实际变化量。供事件系统 / lead 使用。 */
export function changeCapital(state: PoliticsState, delta: number): number {
  const before = clampFinite(state.capital, POLITICS_CONFIG.capitalMin, POLITICS_CONFIG.capitalMax, 24);
  state.capital = clampFinite(
    before + safeNumber(delta),
    POLITICS_CONFIG.capitalMin,
    POLITICS_CONFIG.capitalMax,
    24,
  );
  return roundTo(state.capital - before, 1);
}

/* ------------------------------------------------------------------ *
 *  11. 部门修正（view / lead 的统一数据源）
 * ------------------------------------------------------------------ */

function departmentWarning(
  state: PoliticsState,
  department: DepartmentId,
  breakdown: EfficiencyBreakdown,
): string | null {
  const minister = breakdown.minister;
  if (!minister) {
    return "部门空缺：无人主政，效率降至 0.70。可任命一名候选人补位。";
  }
  if (breakdown.efficiency < 0.88) {
    return "部长能力不足或人脉恶劣，部门运转迟滞；可考虑调解关系或换人。";
  }
  if (minister.ambition >= 80 && minister.integrity <= 35) {
    return "该部长野心与贪腐风险偏高，恐生丑闻；建议尽早罢免。";
  }
  if (minister.loyalty < 35) {
    return "部长忠诚度偏低，可能在关键时刻抗命。";
  }
  if (vacantDepartments(state).length >= 3) {
    return "多个部门长期空缺，内阁已无法形成完整议程。";
  }
  return null;
}

function departmentModifierEntries(
  state: PoliticsState,
  breakdown: EfficiencyBreakdown,
  stabilityImpact: number,
): DepartmentModifierEntry[] {
  const entries: DepartmentModifierEntry[] = [];
  const minister = breakdown.minister;
  if (!minister) {
    entries.push({
      label: "部门空缺",
      value: "效率 0.70",
      tone: "bad",
      detail: "无人主政，部门只维持最低限度的文档流转；所有相关产出下降。",
    });
  } else {
    const factionNames = factionsOf(minister).map((id) => factionShort(id)).join("、");
    entries.push({
      label: "在任部长",
      value: minister.name,
      tone: "neutral",
      detail:
        factionNames +
        "出身；能力 " +
        breakdown.competence +
        "/10，忠诚 " +
        minister.loyalty +
        "，廉洁 " +
        minister.integrity +
        "，野心 " +
        minister.ambition +
        "。",
    });
    entries.push({
      label: "关系协同",
      value: fmtSignedPercent(breakdown.network),
      tone: breakdown.network > 0.004 ? "good" : breakdown.network < -0.004 ? "bad" : "neutral",
      detail: "与同僚的友好关系每对 +2%..5%，敌对关系每对 -2%..5%；部门合计上限 ±8%。",
    });
    entries.push({
      label: "派系支持",
      value: fmtSignedPercent(breakdown.factionSupport),
      tone: breakdown.factionSupport > 0.004 ? "good" : breakdown.factionSupport < -0.004 ? "bad" : "neutral",
      detail: "部长所属派系若以此部门为优先领域获得 +2%；派系满意度高于 65 再 +2%，低于 30 则 -3%。",
    });
    entries.push({
      label: "行事特质",
      value: traitsNames(minister),
      tone: traitsTone(minister),
      detail: "特质会持续影响部门效率、政治资本与丑闻风险。",
    });
  }
  if (breakdown.department === "administration") {
    entries.push({
      label: "稳定度修正",
      value: fmtSigned(stabilityImpact, 2),
      tone: stabilityImpact > 0.05 ? "good" : stabilityImpact < -0.05 ? "bad" : "neutral",
      detail: "行政总署的能力与廉洁决定内阁对全局稳定度的每回合修正（上限 ±3）。",
    });
  }
  return entries;
}

/**
 * 六部门修正的统一出口：部门效率（0.7..1.3）、稳定度修正、资本收入、五项生产乘数。
 * 与 viewTypes.ts 的 PoliticsView 字段一一对应，lead 可直接映射。
 */
export function departmentModifiers(state: PoliticsState): PoliticsModifiers {
  const stabilityDelta = politicsStabilityImpact(state);
  const departments: DepartmentPoliticsDetail[] = [];
  for (const id of DEPARTMENT_ORDER) {
    const def = DEPARTMENT_DEFS[id];
    const breakdown = computeEfficiency(state, id);
    const minister = breakdown.minister;
    departments.push({
      id,
      name: def.name,
      short: def.short,
      icon: def.icon,
      description: def.description,
      ministerId: minister ? minister.id : null,
      ministerName: minister ? minister.name : null,
      efficiency: breakdown.efficiency,
      efficiencyLabel: efficiencyLabel(breakdown.efficiency, minister != null),
      warning: departmentWarning(state, id, breakdown),
      modifiers: departmentModifierEntries(state, breakdown, stabilityDelta),
    });
  }
  return {
    departments,
    stabilityDelta,
    stabilityImpactLabel: politicsStabilityImpactLabel(stabilityDelta),
    capitalRate: computeCapitalRate(state),
    researchMultiplier: computeEfficiency(state, "science").efficiency,
    industryMultiplier: computeEfficiency(state, "industry").efficiency,
    agricultureMultiplier: computeEfficiency(state, "agriculture").efficiency,
    observationMultiplier: computeEfficiency(state, "observation").efficiency,
    defenseMultiplier: computeEfficiency(state, "defense").efficiency,
  };
}

/* ------------------------------------------------------------------ *
 *  12. 人物画像 / 局势摘要（供 view 组装 PoliticsView）
 * ------------------------------------------------------------------ */

function competencePhrase(competence: number): string {
  if (competence >= 8) return "能力出众";
  if (competence >= 6) return "干练可靠";
  if (competence >= 4) return "能力平平";
  return "难堪重任";
}

function loyaltyPhrase(loyalty: number): string {
  if (loyalty >= 75) return "对联合政府忠心耿耿";
  if (loyalty >= 55) return "尚算可靠";
  if (loyalty >= 35) return "立场摇摆";
  return "早有异心";
}

function integrityPhrase(integrity: number): string {
  if (integrity >= 80) return "为人清正";
  if (integrity >= 55) return "风评尚可";
  if (integrity >= 35) return "偶有物议";
  return "贪墨之名在外";
}

function ambitionPhrase(ambition: number): string {
  if (ambition >= 80) return "野心灼人";
  if (ambition >= 60) return "颇有抱负";
  if (ambition >= 40) return "进退有度";
  return "淡泊自守";
}

/** 一句话中文人物画像（供 MinisterView.summary）。非法字段也能安全降级。 */
export function ministerSummary(minister: MinisterState): string {
  if (!minister || typeof minister !== "object") return "档案缺失的部长，履历已无从查证。";
  const dept = departmentName(minister.department);
  const factionIds = factionsOf(minister);
  const factions = factionIds.length > 0 ? factionIds.map((id) => factionName(id)).join("、") : "无派系";
  const competence = clampInt(minister.competence, 1, 10, 5);
  const loyalty = clampInt(minister.loyalty, 0, 100, 50);
  const integrity = clampInt(minister.integrity, 0, 100, 50);
  const ambition = clampInt(minister.ambition, 0, 100, 50);
  const age = clampInt(minister.age, 31, 68, 48);
  const name = typeof minister.name === "string" && minister.name.length > 0 ? minister.name : "某位委员";
  return (
    name +
    "，" +
    dept +
    "部长，" +
    factions +
    "出身，年 " +
    age +
    " 岁。" +
    competencePhrase(competence) +
    "，" +
    loyaltyPhrase(loyalty) +
    "；" +
    integrityPhrase(integrity) +
    "，" +
    ambitionPhrase(ambition) +
    "。行事作风：" +
    traitsNames(minister) +
    "。"
  );
}

/** 高层局势摘要与色调（供 PoliticsView.summary / tone）。 */
export function politicsSummary(state: PoliticsState): PoliticsSummary {
  const stability = politicsStabilityImpact(state);
  const satisfactions = FACTION_ORDER.map((id) => factionSatisfaction(state, id));
  const avgSatisfaction = mean(satisfactions);
  const serving = servingMinisters(state).length;
  let tone: PoliticsSummary["tone"];
  if (stability >= 0.8 && avgSatisfaction >= 55 && serving >= 5) tone = "stable";
  else if (stability >= -0.3) tone = "tense";
  else if (stability >= -1.6) tone = "fragile";
  else tone = "crisis";

  let text = "";
  if (tone === "stable") {
    text = "内阁运转平稳，六部公文按序流转；议会只在预算数字上争执。";
  } else if (tone === "tense") {
    text = "议事厅里礼貌而尖锐：红笔划过的条款越来越多，妥协越来越少。";
  } else if (tone === "fragile") {
    text = "联合政府摇摇欲坠：派系在走廊里交换名单，部长的辞呈压在抽屉最上层。";
  } else {
    text = "政令已难出总署：有人把家人送往地下城，也有人开始清点仓库里的军械。";
  }

  let topFaction: FactionId = FACTION_ORDER[0];
  for (const id of FACTION_ORDER) {
    if (factionInfluence(state, id) > factionInfluence(state, topFaction)) topFaction = id;
  }
  const topInfluence = factionInfluence(state, topFaction);
  if (topInfluence > POLITICS_CONFIG.influenceWarningThreshold) {
    text +=
      factionName(topFaction) + "的影响力已达 " + topInfluence.toFixed(0) + "，越过制衡线。";
  }
  if (serving < DEPARTMENT_ORDER.length) {
    text += "目前有 " + (DEPARTMENT_ORDER.length - serving) + " 个部门空缺。";
  }
  return { text, tone };
}

/* ------------------------------------------------------------------ *
 *  13. 动作可用性（UI 按钮态 / lead 预算判断用）
 * ------------------------------------------------------------------ */

const MAX_CAPITAL = POLITICS_CONFIG.capitalMax;

function actionFailure(reason: string): PoliticsActionResult {
  return { ok: false, reason, logs: [] };
}

function currentCapital(state: PoliticsState): number {
  return clampFinite(state.capital, POLITICS_CONFIG.capitalMin, MAX_CAPITAL, 24);
}

function capitalRequirement(state: PoliticsState, cost: number, actionLabel: string): string | null {
  const capital = currentCapital(state);
  if (capital >= cost) return null;
  return "政治资本不足：" + actionLabel + "需要 " + cost + " 点，当前 " + Math.floor(capital) + " 点。";
}

/** 任命检查：候选人存在 / 部门空缺 / 资本足够。 */
export function canAppoint(state: PoliticsState, candidateId: string): { ok: boolean; reason: string | null } {
  if (typeof candidateId !== "string" || candidateId.length === 0) {
    return { ok: false, reason: "候选人编号无效。" };
  }
  const candidate = state.candidates.find((c) => c && c.id === candidateId);
  if (!candidate) return { ok: false, reason: "候选人不存在或已离开名册。" };
  if (!isDepartmentId(candidate.department)) {
    return { ok: false, reason: "候选人的部门归属无效。" };
  }
  if (state.ministers[candidate.department]) {
    return { ok: false, reason: "该部门已有在任部长，需先罢免才能改任。" };
  }
  const lack = capitalRequirement(state, POLITICS_CONFIG.appointCost, "任命");
  if (lack) return { ok: false, reason: lack };
  return { ok: true, reason: null };
}

/** 罢免检查：部门合法 / 有在任部长 / 资本足够。 */
export function canDismiss(state: PoliticsState, departmentId: DepartmentId): { ok: boolean; reason: string | null } {
  if (!isDepartmentId(departmentId)) return { ok: false, reason: "未知部门，无法执行罢免。" };
  if (!state.ministers[departmentId]) return { ok: false, reason: "该部门没有在任部长。" };
  const lack = capitalRequirement(state, POLITICS_CONFIG.dismissCost, "罢免");
  if (lack) return { ok: false, reason: lack };
  return { ok: true, reason: null };
}

/** 调解检查：两个不同部门 / 均有部长 / 资本足够。 */
export function canMediate(
  state: PoliticsState,
  a: DepartmentId,
  b: DepartmentId,
): { ok: boolean; reason: string | null } {
  if (!isDepartmentId(a) || !isDepartmentId(b)) return { ok: false, reason: "未知部门。" };
  if (a === b) return { ok: false, reason: "不能调解同一个部门。" };
  if (!state.ministers[a] || !state.ministers[b]) return { ok: false, reason: "调解需要两位在任部长。" };
  const lack = capitalRequirement(state, POLITICS_CONFIG.mediateCost, "调解");
  if (lack) return { ok: false, reason: lack };
  return { ok: true, reason: null };
}

/** 峰会检查：资本足够 + 冷却结束。 */
export function canHoldSummit(state: PoliticsState, turn: number): { ok: boolean; reason: string | null } {
  const lack = capitalRequirement(state, POLITICS_CONFIG.summitCost, "峰会");
  if (lack) return { ok: false, reason: lack };
  const t = normalizeTurn(turn);
  const last = normalizeTurn(state.lastSummitTurn);
  if (last > -900) {
    const remaining = POLITICS_CONFIG.summitCooldownTurns - (t - last);
    if (remaining > 0 && t >= last) {
      return { ok: false, reason: "距上次峰会尚不足 " + remaining + " 回合，各派需要时间消化公报。" };
    }
  }
  return { ok: true, reason: null };
}

/** PoliticsView.actions 的数据块。 */
export function politicsActionAvailability(state: PoliticsState, turn: number): PoliticsActionAvailability {
  const t = normalizeTurn(turn);
  const summit = canHoldSummit(state, t);
  const last = normalizeTurn(state.lastSummitTurn);
  const elapsed = last <= -900 ? POLITICS_CONFIG.summitCooldownTurns : Math.max(0, t - last);
  return {
    appointCost: POLITICS_CONFIG.appointCost,
    dismissCost: POLITICS_CONFIG.dismissCost,
    mediateCost: POLITICS_CONFIG.mediateCost,
    summitCost: POLITICS_CONFIG.summitCost,
    canSummit: summit.ok,
    cooldownTurns: Math.max(0, POLITICS_CONFIG.summitCooldownTurns - elapsed),
  };
}

/* ------------------------------------------------------------------ *
 *  14. 任免 / 调解 / 峰会
 * ------------------------------------------------------------------ */

function mainFactionName(minister: MinisterState): string {
  const ids = factionsOf(minister);
  return ids.length > 0 ? factionName(ids[0]) : "无派系";
}

/** 任命候选人到其所属部门：扣资本、就位、初始化关系、派系反响、写日志。 */
export function appointMinister(
  state: PoliticsState,
  candidateId: string,
  year: number,
  turn: number,
): PoliticsActionResult {
  sanitizePoliticsState(state);
  const check = canAppoint(state, candidateId);
  if (!check.ok) return actionFailure(check.reason ?? "任命条件不满足。");
  const index = state.candidates.findIndex((c) => c.id === candidateId);
  if (index < 0) return actionFailure("候选人不存在或已离开名册。");
  const candidate = state.candidates[index];
  const y = normalizeYear(year);
  const t = normalizeTurn(turn);

  state.capital = clampFinite(currentCapital(state) - POLITICS_CONFIG.appointCost, 0, MAX_CAPITAL, 0);
  state.candidates.splice(index, 1);
  const minister: MinisterState = { ...candidate, appointedYear: y };
  state.ministers[candidate.department] = minister;

  const rng = rngForState(state, "appoint:" + minister.id, t);
  for (const other of servingMinisters(state)) {
    if (other.id === minister.id) continue;
    setRelation(state, minister.id, other.id, rollInitialRelation(rng, minister, other));
  }
  for (const faction of factionsOf(minister)) {
    adjustFactionSatisfaction(state, faction, 4);
    adjustInfluence(state, faction, 3);
  }

  const message = fillTemplate(rng.flavor(POLITICS_FLAVOR.appoint), {
    name: minister.name,
    department: departmentName(candidate.department),
    faction: factionsOf(minister).map((id) => factionName(id)).join("、"),
  });
  const log = pushPoliticsLog(
    state,
    { kind: "appoint", message, severity: "success" },
    y,
    t,
  );
  ensureCandidateCoverage(state, rngForState(state, "coverage", t));
  return { ok: true, reason: null, logs: [log] };
}

/** 罢免部长：扣资本、清出关系、派系反弹、返回即时稳定度冲击（-4..-8）。 */
export function dismissMinister(
  state: PoliticsState,
  departmentId: DepartmentId,
  year: number,
  turn: number,
): PoliticsDismissResult {
  sanitizePoliticsState(state);
  const fail = (reason: string): PoliticsDismissResult => ({
    ok: false,
    reason,
    logs: [],
    stabilityImpact: 0,
  });
  if (!isDepartmentId(departmentId)) return fail("未知部门，无法执行罢免。");
  const minister = state.ministers[departmentId];
  if (!minister) return fail("该部门没有在任部长。");
  const lack = capitalRequirement(state, POLITICS_CONFIG.dismissCost, "罢免");
  if (lack) return fail(lack);
  const y = normalizeYear(year);
  const t = normalizeTurn(turn);

  state.capital = clampFinite(currentCapital(state) - POLITICS_CONFIG.dismissCost, 0, MAX_CAPITAL, 0);
  state.ministers[departmentId] = null;
  for (const key of Object.keys(state.relations)) {
    const parts = key.split("|");
    if (parts.indexOf(minister.id) >= 0) delete state.relations[key];
  }

  const rng = rngForState(state, "dismiss:" + minister.id, t);
  const dismissedFactions = factionsOf(minister);
  for (const faction of dismissedFactions) {
    adjustFactionSatisfaction(state, faction, -12);
    adjustInfluence(state, faction, -2);
  }
  for (const faction of FACTION_ORDER) {
    if (dismissedFactions.indexOf(faction) >= 0) continue;
    adjustFactionSatisfaction(state, faction, 2);
  }

  const loyalty = clampFinite(minister.loyalty, 0, 100, 50);
  // 忠诚越高，罢免引发的反弹越大：冲击 -4..-8。
  const impactMagnitude = 4 + (loyalty / 100) * 4;
  const stabilityImpact = roundTo(
    clamp(-impactMagnitude, POLITICS_CONFIG.dismissalStabilityMin, POLITICS_CONFIG.dismissalStabilityMax),
    1,
  );

  const message = fillTemplate(rng.flavor(POLITICS_FLAVOR.dismiss), {
    name: minister.name,
    department: departmentName(departmentId),
    faction: mainFactionName(minister),
  });
  const log = pushPoliticsLog(
    state,
    {
      kind: "dismiss",
      message: message + "（即时稳定度 " + stabilityImpact.toFixed(1) + "）",
      severity: "critical",
    },
    y,
    t,
  );
  ensureRelations(state);
  ensureCandidateCoverage(state, rngForState(state, "coverage", t));
  return { ok: true, reason: null, logs: [log], stabilityImpact };
}

/** 调解两位部长：消耗资本，关系 +8..15，双方派系满意度各 +1。 */
export function mediateMinisters(
  state: PoliticsState,
  a: DepartmentId,
  b: DepartmentId,
  turn: number,
): PoliticsActionResult {
  sanitizePoliticsState(state);
  const check = canMediate(state, a, b);
  if (!check.ok) return actionFailure(check.reason ?? "调解条件不满足。");
  const ministerA = state.ministers[a];
  const ministerB = state.ministers[b];
  if (!ministerA || !ministerB) return actionFailure("调解需要两位在任部长。");
  const t = normalizeTurn(turn);
  state.capital = clampFinite(currentCapital(state) - POLITICS_CONFIG.mediateCost, 0, MAX_CAPITAL, 0);

  const rng = rngForState(state, "mediate:" + ministerA.id + ":" + ministerB.id, t);
  const gain = rollMediateGain(rng);
  const before = getRelation(state, ministerA.id, ministerB.id);
  const after = setRelation(state, ministerA.id, ministerB.id, before + gain);
  for (const faction of factionsOf(ministerA)) adjustFactionSatisfaction(state, faction, 1);
  for (const faction of factionsOf(ministerB)) adjustFactionSatisfaction(state, faction, 1);

  const label = relationLabel(after).label;
  const y = lastHistoryYear(state);
  const message =
    fillTemplate(rng.flavor(POLITICS_FLAVOR.mediate), { a: ministerA.name, b: ministerB.name }) +
    "（关系 " + before + " → " + after + "，" + label + "）";
  const log = pushPoliticsLog(state, { kind: "mediate", message, severity: "success" }, y, t);
  return { ok: true, reason: null, logs: [log] };
}

/** 召开政治峰会：消耗资本，全体派系满意度 +8..12，全部关系 +2，进入冷却。 */
export function holdSummit(state: PoliticsState, turn: number): PoliticsActionResult {
  sanitizePoliticsState(state);
  const t = normalizeTurn(turn);
  const check = canHoldSummit(state, t);
  if (!check.ok) return actionFailure(check.reason ?? "峰会条件不满足。");
  state.capital = clampFinite(currentCapital(state) - POLITICS_CONFIG.summitCost, 0, MAX_CAPITAL, 0);
  state.lastSummitTurn = t;

  const rng = rngForState(state, "summit:" + t, t);
  const gain = rollSummitSatisfaction(rng);
  for (const faction of FACTION_ORDER) {
    adjustFactionSatisfaction(state, faction, gain + rng.int(-1, 1));
  }
  const serving = servingMinisters(state);
  for (let i = 0; i < serving.length; i++) {
    for (let j = i + 1; j < serving.length; j++) {
      shiftRelation(state, serving[i].id, serving[j].id, 2);
    }
  }

  const y = lastHistoryYear(state);
  const message =
    rng.flavor(POLITICS_FLAVOR.summit) +
    "（各派满意度 +" + gain + " 左右，政治资本 -" + POLITICS_CONFIG.summitCost + "）";
  const log = pushPoliticsLog(state, { kind: "faction", message, severity: "success" }, y, t);
  return { ok: true, reason: null, logs: [log] };
}

/* ------------------------------------------------------------------ *
 *  15. 丑闻 / 野心事件（低廉洁 + 高野心）
 * ------------------------------------------------------------------ */

/** 单名部长的丑闻概率（0..0.30）。廉洁越低、野心越高、贪墨特质越多，概率越高。 */
export function scandalChance(minister: MinisterState): number {
  if (!minister || typeof minister !== "object") return 0;
  const integrity = clampFinite(minister.integrity, 0, 100, 50);
  const ambition = clampFinite(minister.ambition, 0, 100, 50);
  let traitRisk = 0;
  for (const id of safeTraits(minister)) {
    const def = MINISTER_TRAIT_MAP[id];
    if (def) traitRisk += def.effect.scandalRisk ?? 0;
  }
  const lowIntegrity = clamp((70 - integrity) / 70, 0, 1);
  const highAmbition = clamp((ambition - 50) / 50, 0, 1);
  const base = 0.002 + lowIntegrity * 0.08 + highAmbition * 0.04;
  return roundTo(clamp(base + traitRisk, 0, 0.3), 4);
}

/** 单名部长的野心事件概率（0..0.2）：仅野心 >= 65，且敌对关系越多越高。 */
export function ambitionChance(state: PoliticsState, minister: MinisterState): number {
  if (!minister || typeof minister !== "object") return 0;
  const ambition = clampFinite(minister.ambition, 0, 100, 50);
  if (ambition < 65) return 0;
  let rivals = 0;
  for (const other of servingMinisters(state)) {
    if (other.id === minister.id) continue;
    if (getRelation(state, minister.id, other.id) <= -35) rivals++;
  }
  const base = ((ambition - 65) / 35) * 0.06 + rivals * 0.02;
  return roundTo(clamp(base, 0, 0.2), 4);
}

interface IncidentResult {
  log: PoliticsLogInput;
  stabilityPenalty: number;
  capitalLoss: number;
}

function rollIncident(state: PoliticsState, rng: PoliticsRng, turn: number): IncidentResult | null {
  const serving = servingMinisters(state);
  if (serving.length === 0) return null;

  // 丑闻优先：按部门顺序检查（确定性，便于复现）。
  for (const minister of serving) {
    const chance = scandalChance(minister);
    if (chance <= 0 || !rng.bool(chance)) continue;
    const integrity = clampFinite(minister.integrity, 0, 100, 50);
    const ambition = clampFinite(minister.ambition, 0, 100, 50);
    const penalty = roundTo(clamp(1.6 + ((100 - integrity) / 100) * 1.6 + (ambition / 100) * 0.6, 1.5, 3.5), 2);
    const loss = rollCapitalLoss(rng);
    minister.integrity = clampInt(integrity - 2, 0, 100, 0);
    minister.loyalty = clampInt(minister.loyalty - 3, 0, 100, 0);
    for (const faction of factionsOf(minister)) adjustFactionSatisfaction(state, faction, -5);
    const message =
      fillTemplate(rng.flavor(POLITICS_FLAVOR.scandal), {
        name: minister.name,
        department: departmentName(minister.department),
      }) +
      "（稳定度 " + (-penalty).toFixed(2) + "，政治资本 -" + loss + "）";
    return {
      log: { kind: "event", message, severity: "critical" },
      stabilityPenalty: -penalty,
      capitalLoss: loss,
    };
  }

  // 野心事件：无丑闻时检查。
  for (const minister of serving) {
    const chance = ambitionChance(state, minister);
    if (chance <= 0 || !rng.bool(chance)) continue;
    const ambition = clampFinite(minister.ambition, 0, 100, 50);
    const penalty = roundTo(clamp(0.8 + ((ambition - 60) / 40) * 1.2, 1, 2.2), 2);
    const ministerFactions = factionsOf(minister);
    for (const faction of ministerFactions) adjustInfluence(state, faction, 2);
    let rival: MinisterState | null = null;
    let worst = 0;
    for (const other of serving) {
      if (other.id === minister.id) continue;
      const score = getRelation(state, minister.id, other.id);
      if (score <= -35 && (rival === null || score < worst)) {
        rival = other;
        worst = score;
      }
    }
    if (rival) {
      shiftRelation(state, minister.id, rival.id, -8);
      for (const faction of factionsOf(rival)) adjustFactionSatisfaction(state, faction, -2);
    }
    for (const faction of FACTION_ORDER) {
      if (ministerFactions.indexOf(faction) >= 0) continue;
      adjustFactionSatisfaction(state, faction, -2);
    }
    const message =
      fillTemplate(rng.flavor(POLITICS_FLAVOR.ambition), {
        name: minister.name,
        department: departmentName(minister.department),
        faction: mainFactionName(minister),
      }) +
      "（稳定度 -" + penalty.toFixed(2) + "，该派影响力上升）";
    return {
      log: { kind: "event", message, severity: "warning" },
      stabilityPenalty: -penalty,
      capitalLoss: 0,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  16. 回合结算
 * ------------------------------------------------------------------ */

function lastHistoryYear(state: PoliticsState): number {
  if (Array.isArray(state.history) && state.history.length > 0) {
    return normalizeYear(state.history[state.history.length - 1].year);
  }
  return 0;
}

/** 关系自然漂移：向「派系亲疏 + 性格」决定的目标值回归，极端数值因此缓慢衰减。 */
function updateRelations(state: PoliticsState): void {
  const serving = servingMinisters(state);
  for (let i = 0; i < serving.length; i++) {
    for (let j = i + 1; j < serving.length; j++) {
      const a = serving[i];
      const b = serving[j];
      const current = getRelation(state, a.id, b.id);
      const target = naturalRelationTarget(a, b);
      const pull =
        (target - current) * POLITICS_CONFIG.relationDriftRate - current * POLITICS_CONFIG.relationZeroPull;
      setRelation(state, a.id, b.id, Math.round(current + pull));
    }
  }
}

function updateFactions(state: PoliticsState, turn: number): PoliticsLogInput[] {
  // 影响力向平衡目标（20）缓慢漂移，再归一化到合计 100。
  for (const id of FACTION_ORDER) {
    const current = factionInfluence(state, id);
    state.factions[id].influence = clampFinite(
      current + (POLITICS_CONFIG.influenceBalanceTarget - current) * POLITICS_CONFIG.influenceTurnDrift,
      0,
      100,
      POLITICS_CONFIG.influenceBalanceTarget,
    );
  }
  renormalizeInfluence(state);

  // 满意度向结构目标漂移（席位 / 影响力 / 部长忠诚 / 偏好部门空缺）。
  for (const id of FACTION_ORDER) {
    const current = factionSatisfaction(state, id);
    const target = factionSatisfactionTarget(state, id);
    state.factions[id].satisfaction = clampFinite(
      current + (target - current) * POLITICS_CONFIG.satisfactionDriftRate,
      0,
      100,
      current,
    );
  }

  const warnings: PoliticsLogInput[] = [];
  const turnValue = normalizeTurn(turn);
  if (turnValue % 4 === 0) {
    const cycle = Math.floor(Math.abs(turnValue) / 4);
    for (const id of FACTION_ORDER) {
      const satisfaction = factionSatisfaction(state, id);
      if (satisfaction < POLITICS_CONFIG.lowSatisfaction) {
        const template = POLITICS_FLAVOR.factionWarning[cycle % POLITICS_FLAVOR.factionWarning.length];
        warnings.push({
          kind: "warning",
          message: fillTemplate(template, { faction: factionName(id) }),
          severity: "warning",
        });
      }
    }
    for (const id of FACTION_ORDER) {
      const influence = factionInfluence(state, id);
      if (influence > POLITICS_CONFIG.influenceWarningThreshold) {
        const template = POLITICS_FLAVOR.influenceWarning[cycle % POLITICS_FLAVOR.influenceWarning.length];
        warnings.push({
          kind: "warning",
          message: fillTemplate(template, {
            faction: factionName(id),
            value: influence.toFixed(0),
          }),
          severity: "warning",
        });
      }
    }
  }
  return warnings;
}

/**
 * 每回合政治结算（由 lead 在回合推进时调用一次）：
 *  1. 每 3 回合刷新候选人，并始终保证空缺部门有可任命人选；
 *  2. 关系自然漂移、派系满意度 / 影响力回归；
 *  3. 计算确定性稳定度修正（-3..3）；
 *  4. 触发至多 1 起丑闻 / 野心事件（额外惩罚合计上限 5，稳定度总修正下限 -6）；
 *  5. 发放政治资本（2..6，受行政部长能力与文明稳定度影响）；
 *  6. 返回五项生产乘数（0.7..1.3）与日志。
 */
export function politicsTurn(
  state: PoliticsState,
  civ: PoliticsCivilContext | null | undefined,
  year: number,
  turn: number,
): PoliticsTurnEffects {
  sanitizePoliticsState(state);
  const y = normalizeYear(year);
  const t = normalizeTurn(turn);
  const logs: PoliticsLogInput[] = [];
  const civStability = clampFinite(civ ? civ.stability : 50, 0, 100, 50);

  // 1. 候选人刷新 / 空缺覆盖
  if (t > 0 && t % POLITICS_CONFIG.candidateRefreshInterval === 0) {
    const added = refreshCandidates(state, y, t);
    if (added.length > 0) {
      const poolIndex =
        Math.floor(t / POLITICS_CONFIG.candidateRefreshInterval) % POLITICS_FLAVOR.candidateRefresh.length;
      logs.push({
        kind: "faction",
        message: POLITICS_FLAVOR.candidateRefresh[poolIndex] + "（新增候选人 " + added.length + " 名）",
        severity: "info",
      });
    }
  } else {
    ensureCandidateCoverage(state, rngForState(state, "coverage", t));
  }

  // 2. 关系与派系
  updateRelations(state);
  const factionWarnings = updateFactions(state, t);
  for (const warning of factionWarnings) logs.push(warning);

  // 3. 确定性稳定度修正
  const baseStability = roundTo(
    clamp(
      computeRawStabilityDelta(state),
      POLITICS_CONFIG.stabilityTurnMin,
      POLITICS_CONFIG.stabilityTurnMax,
    ),
    2,
  );

  // 4. 丑闻 / 野心事件（每回合至多一起）
  let incidentPenalty = 0;
  const incident = rollIncident(state, rngForState(state, "incident", t), t);
  if (incident) {
    incidentPenalty = clamp(
      incident.stabilityPenalty,
      -POLITICS_CONFIG.scandalStabilityCap,
      0,
    );
    const loss = clamp(incident.capitalLoss, 0, 100);
    if (loss > 0) changeCapital(state, -loss);
    logs.push(incident.log);
  }

  // 5. 政治资本收入
  const rate = capitalRateForTurn(state, civStability);
  state.capitalRate = rate;
  const gain = changeCapital(state, rate);

  // 6. 汇总（无事件时严格 ±3；事件时下限放宽到 -6，避免死亡螺旋）
  const lowerBound = incident ? -6 : POLITICS_CONFIG.stabilityTurnMin;
  const stabilityDelta = roundTo(
    clamp(baseStability + incidentPenalty, lowerBound, POLITICS_CONFIG.stabilityTurnMax),
    2,
  );

  for (const input of logs) pushPoliticsLog(state, input, y, t);
  const detail = departmentModifiers(state);
  return {
    stabilityDelta,
    researchMultiplier: detail.researchMultiplier,
    industryMultiplier: detail.industryMultiplier,
    agricultureMultiplier: detail.agricultureMultiplier,
    observationMultiplier: detail.observationMultiplier,
    defenseMultiplier: detail.defenseMultiplier,
    capitalGain: roundTo(gain, 1),
    logs,
  };
}


