/**
 * 政治系统 v3 · 独立种子随机源与人物生成。
 *
 * 为什么不用 core/rng：政治模块的随机流与星系生成 / 观测噪声完全解耦，
 * 这样调整政治参数不会反过来改变同一存档的星系；同时本模块只依赖自身种子，
 * 单测可以只 import 政治模块验证复现性。
 *
 * 关键约束：PoliticsState 不保存随机数状态（类型由 lead 冻结），因此回合内随机
 * 由 rngForState(state, salt, turn) 从「当前状态的确定性摘要」派生：
 *  - 同一 seed + 同一操作序列 => 完全相同的随机序列（可复现、可存档）；
 *  - 读档后继续推进与未读档完全一致（状态即随机种子，不依赖隐藏内存）。
 */
import type {
  DepartmentId,
  FactionId,
  MinisterState,
  PoliticsState,
} from "../core/types";
import { clamp } from "../core/math";
import {
  FACTION_AFFINITY,
  FACTION_DEFS,
  FACTION_ORDER,
  MINISTER_TRAIT_IDS,
  MINISTER_TRAIT_MAP,
  MINISTER_GIVEN_NAMES,
  MINISTER_SURNAMES,
  POLITICS_CONFIG,
  type MinisterTraitEx,
} from "./definitions";

/* ------------------------------------------------------------------ *
 *  1. 哈希与随机数发生器
 * ------------------------------------------------------------------ */

/** 任意字符串 / 数值 -> 32 位无符号种子（FNV-1a + 末轮混淆）。 */
export function hashSeed(input: string | number): number {
  const text = typeof input === "number" ? "n:" + (Number.isFinite(input) ? Math.floor(input) : 0) : "s:" + input;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 政治模块专用 Mulberry32；与 core/rng 的 Rng 实例互不影响。 */
export class PoliticsRng {
  private s: number;

  constructor(seed: string | number = "politics") {
    const h = hashSeed(seed);
    this.s = h === 0 ? 0x9e3779b9 : h;
  }

  /** 均匀 [0, 1)。 */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** 闭区间整数。 */
  int(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    if (hi <= lo) return lo;
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < clamp(probability, 0, 1);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("PoliticsRng.pick: 空列表");
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** 从文案池中取一条（空池返回空串，不抛错）。 */
  flavor(pool: readonly string[]): string {
    return pool.length === 0 ? "" : this.pick(pool);
  }

  get state(): number {
    return this.s >>> 0;
  }
}

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

/**
 * 由当前状态派生一回合的随机源。
 * 摘要包含回合数、资本、id 计数器、历史长度、在任部长与关系总量，
 * 因此读档后继续推进与未读档完全一致，无需在 PoliticsState 里存 RNG 状态。
 */
export function rngForState(state: PoliticsState, salt: string, turn: number): PoliticsRng {
  const ministries = state.ministers as Record<string, MinisterState | null | undefined>;
  const ids: string[] = [];
  let relationSum = 0;
  let relationCount = 0;
  for (const key of Object.keys(state.relations)) {
    relationCount++;
    relationSum += finiteInt(state.relations[key], 0);
  }
  for (const key of Object.keys(ministries)) {
    const m = ministries[key];
    if (m) ids.push(m.id + ":" + finiteInt(m.competence) + ":" + finiteInt(m.loyalty));
    else ids.push(key + ":empty");
  }
  ids.sort();
  const parts: string[] = [
    "politics-v3",
    salt,
    "turn=" + finiteInt(turn),
    "capital=" + Math.round((Number.isFinite(state.capital) ? state.capital : 0) * 10),
    "rate=" + Math.round((Number.isFinite(state.capitalRate) ? state.capitalRate : 0) * 10),
    "nextId=" + finiteInt(state.nextId),
    "nextHistoryId=" + finiteInt(state.nextHistoryId),
    "summit=" + finiteInt(state.lastSummitTurn, -999),
    "candidates=" + state.candidates.length,
    "history=" + state.history.length,
    "relations=" + relationCount + "/" + relationSum,
    "ministers=" + ids.join(","),
  ];
  return new PoliticsRng(hashSeed(parts.join("|")));
}

/* ------------------------------------------------------------------ *
 *  2. 随机工具
 * ------------------------------------------------------------------ */

/** 用于「三均匀平均」的钟形分布，让能力值不至于全挤在两端。 */
function bellInt(rng: PoliticsRng, min: number, max: number): number {
  const t = (rng.next() + rng.next() + rng.next()) / 3;
  return clamp(Math.round(min + t * (max - min)), min, max);
}

export function rollMediateGain(rng: PoliticsRng): number {
  return rng.int(POLITICS_CONFIG.mediateGainMin, POLITICS_CONFIG.mediateGainMax);
}

export function rollSummitSatisfaction(rng: PoliticsRng): number {
  return rng.int(POLITICS_CONFIG.summitSatisfactionMin, POLITICS_CONFIG.summitSatisfactionMax);
}

export function rollCapitalLoss(rng: PoliticsRng): number {
  return rng.int(3, 6);
}

/** 从姓名池取一个未被占用的姓名（768 种组合，正常规模下不会耗尽）。 */
function pickUniqueName(rng: PoliticsRng, usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 256; attempt++) {
    const name = rng.pick(MINISTER_SURNAMES) + rng.pick(MINISTER_GIVEN_NAMES);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  let serial = 2;
  let name = "";
  do {
    name = rng.pick(MINISTER_SURNAMES) + rng.pick(MINISTER_GIVEN_NAMES) + "·" + serial;
    serial++;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

/** 派系组合：首位倾向本部门「偏好派系」，约四成人物身兼第二派系。 */
export function rollFactions(rng: PoliticsRng, department: DepartmentId): FactionId[] {
  const preferred = FACTION_ORDER.filter(
    (id) => FACTION_DEFS[id].preferredDepartments.indexOf(department) >= 0,
  );
  const first = preferred.length > 0 && rng.bool(0.55) ? rng.pick(preferred) : rng.pick(FACTION_ORDER);
  const factions: FactionId[] = [first];
  if (rng.bool(0.45)) {
    const others = FACTION_ORDER.filter((id) => id !== first);
    if (others.length > 0) factions.push(rng.pick(others));
  }
  return factions;
}

/** 从 16 个特质中抽 2 个互不相同的特质。 */
export function rollTraits(rng: PoliticsRng): string[] {
  const picked = rng.shuffle(MINISTER_TRAIT_IDS.slice()).slice(0, POLITICS_CONFIG.maxMinisterTraits);
  return picked;
}

function traitList(ids: readonly string[]): MinisterTraitEx[] {
  const out: MinisterTraitEx[] = [];
  for (const id of ids) {
    const def = MINISTER_TRAIT_MAP[id];
    if (def) out.push(def);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  3. 人物生成
 * ------------------------------------------------------------------ */

export interface MinisterGenResult {
  minister: MinisterState;
  nextId: number;
}

/**
 * 生成一名部长 / 候选人。id 由调用方递增提供；姓名写入 usedNames 避免重名。
 * 属性先按分布生成，再叠加两个特质的修正，最后 clamp 到合法区间。
 */
export function generateMinister(
  rng: PoliticsRng,
  id: number,
  department: DepartmentId,
  usedNames: Set<string>,
): MinisterState {
  const factions = rollFactions(rng, department);
  const traits = rollTraits(rng);
  const effects = traitList(traits).map((t) => t.effect);

  let competence = bellInt(rng, POLITICS_CONFIG.competenceMin, POLITICS_CONFIG.competenceMax);
  let loyalty = rng.int(35, 92);
  let integrity = rng.int(25, 92);
  let ambition = rng.int(20, 90);
  const age = rng.int(POLITICS_CONFIG.ageMin, POLITICS_CONFIG.ageMax);

  for (const effect of effects) {
    competence += effect.competence ?? 0;
    loyalty += effect.loyalty ?? 0;
    integrity += effect.integrity ?? 0;
    ambition += effect.ambition ?? 0;
  }

  return {
    id: "m-" + id,
    name: pickUniqueName(rng, usedNames),
    department,
    factions,
    competence: clamp(Math.round(competence), POLITICS_CONFIG.competenceMin, POLITICS_CONFIG.competenceMax),
    loyalty: clamp(Math.round(loyalty), POLITICS_CONFIG.loyaltyMin, POLITICS_CONFIG.loyaltyMax),
    integrity: clamp(Math.round(integrity), POLITICS_CONFIG.integrityMin, POLITICS_CONFIG.integrityMax),
    ambition: clamp(Math.round(ambition), POLITICS_CONFIG.ambitionMin, POLITICS_CONFIG.ambitionMax),
    age,
    traits,
    portraitSeed: rng.int(1, 2147483646),
    appointedYear: 0,
  };
}

/* ------------------------------------------------------------------ *
 *  4. 关系初值与自然目标
 * ------------------------------------------------------------------ */

/** 两名部长之间的派系亲疏均值（-10..10 量级）。 */
export function crossFactionAffinity(a: MinisterState, b: MinisterState): number {
  let sum = 0;
  let pairs = 0;
  for (const fa of a.factions) {
    for (const fb of b.factions) {
      const row = FACTION_AFFINITY[fa];
      if (row) {
        sum += row[fb] ?? 0;
        pairs++;
      }
    }
  }
  return pairs > 0 ? sum / pairs : 0;
}

/** 共享派系数（0..2）。 */
export function sharedFactionCount(a: MinisterState, b: MinisterState): number {
  let n = 0;
  for (const f of a.factions) if (b.factions.indexOf(f) >= 0) n++;
  return n;
}

/**
 * 关系的自然目标值：由派系亲疏、共享派系、性格（野心/廉洁/忠诚）决定。
 * 每回合关系向该目标缓慢回归，因此极端值会自然衰减，而结构性同盟/对立长期存在。
 */
export function naturalRelationTarget(a: MinisterState, b: MinisterState): number {
  const affinity = crossFactionAffinity(a, b) * 0.8;
  const shared = sharedFactionCount(a, b) * 6;
  let target = affinity + shared;
  if (a.ambition > 65 && b.ambition > 65) target -= 8;
  if (Math.abs(a.integrity - b.integrity) > 50) target -= 5;
  if (a.loyalty > 70 && b.loyalty > 70) target += 4;
  for (const t of traitList(a.traits)) target += (t.effect.network ?? 0) * 4;
  for (const t of traitList(b.traits)) target += (t.effect.network ?? 0) * 4;
  return clamp(Math.round(target), POLITICS_CONFIG.relationMin, POLITICS_CONFIG.relationMax);
}

/** 初始关系：自然目标 + 少量种子扰动，再 clamp 到 -100..100。 */
export function rollInitialRelation(rng: PoliticsRng, a: MinisterState, b: MinisterState): number {
  const jitter = rng.int(-14, 14);
  return clamp(naturalRelationTarget(a, b) + jitter, POLITICS_CONFIG.relationMin, POLITICS_CONFIG.relationMax);
}
