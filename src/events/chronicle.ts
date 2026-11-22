/**
 * 文明编年史 v1.6（EVENTS_V6）.
 *
 * 从 GameState / EventsView 派生「可读的文明史」条目：事件触发、抉择、后果、
 * 居民死亡、人口骤降、灾害、建筑毁坏、时代推进、科技突破。
 *
 * 约束：
 *  - 只读取真实存在的数据（日志 / 事件历史 / 人口历史 / 灾害历史），不编造条目；
 *  - 纯函数、无 DOM 依赖，UI（chronicle-panel.ts）只负责渲染；
 *  - 事件结果同时写入「事件」和「伤亡」两类条目：事件条目不复制日志里没有的数字。
 */
import { getEventDef } from "./definitions";

/** 编年史条目类别。 */
export type ChronicleKind = "event" | "death" | "major" | "disaster" | "science";
/** 左侧色条 / 视觉语气（与 chronicle-panel 的 data-tone 对应）。 */
export type ChronicleTone = "major" | "death" | "normal" | "science";
export type ChronicleImportance = 1 | 2 | 3 | 4 | 5;

export const CHRONICLE_KIND_LABELS: Record<ChronicleKind, string> = {
  event: "事件",
  death: "伤亡",
  major: "重大",
  disaster: "灾害",
  science: "科学",
};

/** 一条编年史记录。 */
export interface ChronicleEntry {
  /** 稳定 id（source 前缀 + 原始 id），UI keyed list 使用。 */
  id: string;
  /** 星历年（与游戏内日志/事件年份同一口径）。 */
  year: number;
  /** 回合。 */
  turn: number;
  kind: ChronicleKind;
  title: string;
  detail: string;
  tone: ChronicleTone;
  /** 图标名（ui/icons.ts 的键），UI 漏图标时安全回退。 */
  icon: string;
  /** 1–5，5 最重要；「仅看重大事件」据此过滤。 */
  importance: ChronicleImportance;
  /** 来源 id（log:12 / event:3 / hazard:7 / population:2192 …）。 */
  sourceId: string;
}

/** 过滤条件（按年 / 类型 / 仅重大 / 文本）。 */
export interface ChronicleFilter {
  /** 只保留该星历年（四舍五入到整数年）。 */
  year?: number | null;
  /** 只保留这些类别。 */
  kinds?: ReadonlyArray<ChronicleKind> | null;
  /** 仅看重大事件（importance >= 4 或 kind = major）。 */
  majorOnly?: boolean;
  /** 重要性下限 1–5。 */
  minImportance?: number;
  /** 标题/摘要关键字（大小写不敏感）。 */
  query?: string | null;
  /** 最多返回条数。 */
  limit?: number | null;
}

/** 面板顶部筛选预设。 */
export type ChronicleFilterPreset = "all" | "major" | "casualty";
export const CHRONICLE_FILTER_PRESETS: Record<ChronicleFilterPreset, ChronicleFilter> = {
  all: {},
  major: { majorOnly: true },
  casualty: { kinds: ["death"] },
};

/* ------------------------------------------------------------------ *
 *  结构输入（与 core/types.GameState / game/viewTypes.ViewModel 兼容） *
 * ------------------------------------------------------------------ */

export interface ChronicleEventHistoryLike {
  id: number;
  defId?: string | null;
  title: string;
  category: string;
  turn: number;
  year: number;
  choiceLabel?: string | null;
  outcome?: string | null;
  /** 仅 GameState 事件历史携带；EventsView 历史没有该字段。 */
  effectsSummary?: string | null;
}

export interface ChronicleLogLike {
  id: number;
  year: number;
  turn: number;
  category: string;
  severity: string;
  message: string;
}

export interface ChronicleHazardLike {
  id: number;
  title: string;
  description?: string | null;
  severity?: number | null;
  startYear?: number | null;
  peakYear?: number | null;
  endYear?: number | null;
  detected?: boolean;
}

export interface ChronicleCrisisLike {
  id: number;
  title: string;
  description?: string | null;
  severity?: number | null;
  startYear?: number | null;
  endYear?: number | null;
  active?: boolean;
}

/** deriveChronicle 的结构化输入；GameState 可直接赋值（多余字段忽略）。 */
export interface ChronicleSource {
  meta?: { calendarStartYear?: number | null; elapsedRealSeconds?: number | null } | null;
  yearsElapsed?: number | null;
  civ?: {
    population?: number | null;
    stability?: number | null;
    era?: number | null;
    turn?: number | null;
    alive?: boolean;
    populationHistory?: ReadonlyArray<{ year: number; population: number; stability?: number; tempC?: number }>;
  } | null;
  events?: {
    pending?: ReadonlyArray<{ defId: string; triggerTurn?: number; triggerYear?: number; context?: string | null }>;
    history?: ReadonlyArray<ChronicleEventHistoryLike>;
    triggeredTotal?: number;
  } | null;
  hazards?: {
    activeHazards?: ReadonlyArray<ChronicleHazardLike>;
    history?: ReadonlyArray<ChronicleHazardLike>;
    crises?: ReadonlyArray<ChronicleCrisisLike>;
    stress?: number | null;
  } | null;
  log?: ReadonlyArray<ChronicleLogLike>;
}

/** 与 ViewModel 结构兼容的最小视图（chronicle-panel 直接传 view）。 */
export interface ChronicleViewLike {
  meta: {
    turn: number;
    year?: number;
    calendarYear?: number;
    era?: number;
    victory?: boolean;
    gameOver?: boolean;
  };
  civ: {
    population: { total: number };
    stability: { value: number };
    era: { value: number };
  };
  events?: {
    active?: {
      defId: string;
      title: string;
      category: string;
      triggerYear: number;
      context: string;
      short?: string;
    } | null;
    history?: ReadonlyArray<ChronicleEventHistoryLike>;
    totalTriggered?: number;
  } | null;
  hazards?: {
    hazards?: ReadonlyArray<ChronicleHazardLike>;
    crises?: ReadonlyArray<ChronicleCrisisLike>;
  } | null;
  log?: ReadonlyArray<ChronicleLogLike>;
}

/* ------------------------------------------------------------------ *
 *  文本识别
 * ------------------------------------------------------------------ */

const DEATH_WORDS = /死去|死亡|冻死|饿死|遇难|丧生|牺牲|伤亡|死伤|人口损失|人口骤减|灭绝/;
const NEGATED_DEATH = /没有(人|再)?.{0,8}(饿死|冻死|死去|死亡)/;
const DESTRUCTION_WORDS = /毁坏|损毁|坍塌|倒塌|被毁|摧毁|冲毁|烧毁|焚毁/;
const ERA_ADVANCE = /文明进入第\s*(\d+)\s*时代(?:「([^」]*)」)?/;
const TECH_BREAK = /科技突破[：:]\s*「([^」]*)」/;
const POPULATION_LOSS = /人口\s*([+\-\u2212]?\d+(?:\.\d+)?)/;
const HAZARD_SHOCK = /人口损失\s*(\d+(?:\.\d+)?)\s*%/;

/** 判断文本是否真的在描述死亡（排除「没有人饿死」这类否定句）。 */
export function mentionsDeath(text: string | null | undefined): boolean {
  if (!text) return false;
  if (!DEATH_WORDS.test(text)) return false;
  const cleaned = text.replace(NEGATED_DEATH, "");
  return DEATH_WORDS.test(cleaned);
}

function finite(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fmtNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (abs >= 1e4) return (value / 1e3).toFixed(1) + "k";
  if (abs >= 100) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

function truncate(text: string, max = 42): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join("") + "…";
}

function clampImportance(value: number): ChronicleImportance {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as ChronicleImportance;
}

function turnOfYear(year: number, turnHint?: number | null): number {
  if (turnHint != null && Number.isFinite(turnHint)) return Math.max(0, Math.floor(turnHint));
  /* 1 回合 = 0.5 模拟年；仅用于人口历史等没有 turn 字段的来源。 */
  return Math.max(0, Math.round(finite(year) / 0.5));
}

function kindTone(kind: ChronicleKind, importance: number): ChronicleTone {
  if (kind === "death") return "death";
  if (kind === "science") return "science";
  if (kind === "major") return "major";
  if (kind === "disaster") return importance >= 4 ? "major" : "normal";
  return "normal";
}

function eventKindOf(category: string): ChronicleKind {
  if (category === "hazard") return "disaster";
  if (category === "science") return "science";
  return "event";
}

/* ------------------------------------------------------------------ *
 *  派生
 * ------------------------------------------------------------------ */

/** 派生编年史条目（最新在前）。传 null/空对象返回空数组，不编造数据。 */
export function deriveChronicle(source: ChronicleSource | null | undefined): ChronicleEntry[] {
  const entries: ChronicleEntry[] = [];
  if (!source || typeof source !== "object") return entries;
  const calendarStart = finite(source.meta?.calendarStartYear, 0);
  const currentYear = calendarStart + Math.max(0, finite(source.yearsElapsed, 0));
  const currentTurn = Math.max(0, finite(source.civ?.turn, Math.round(finite(source.yearsElapsed, 0) / 0.5)));
  /** 灾害系统的年份是「已模拟年数」，日志/事件是星历绝对年；统一到星历年。 */
  const hazardYear = (relative: number | null | undefined): number => {
    const raw = finite(relative, finite(source.yearsElapsed, 0));
    return calendarStart > 0 ? calendarStart + raw : raw;
  };

  const activeDef = source.events?.pending?.[0] ? getEventDef(source.events.pending[0].defId) : null;
  if (source.events?.pending?.[0]) {
    const pending = source.events.pending[0];
    const title = activeDef?.title ?? pending.defId;
    entries.push({
      id: "event-trigger:" + pending.defId,
      year: finite(pending.triggerYear, currentYear),
      turn: Math.max(0, finite(pending.triggerTurn, currentTurn)),
      kind: "event",
      title: "事件触发 · " + title,
      detail: truncate((pending.context ? pending.context + " · " : "") + (activeDef?.short ?? "等待你的抉择。"), 88),
      tone: "normal",
      icon: "book",
      importance: 3,
      sourceId: "pending:" + pending.defId,
    });
  }

  /* 1) 已结算的随机事件：触发 + 抉择 + 后果 */
  for (const history of source.events?.history ?? []) {
    if (!history || typeof history.title !== "string") continue;
    const def = history.defId ? getEventDef(history.defId) : null;
    const category = String(history.category ?? def?.category ?? "society");
    const kind = eventKindOf(category);
    const summary = typeof history.effectsSummary === "string" ? history.effectsSummary : "";
    const bigLoss = /人口\s*[\u2212-]\d|食物\s*[\u2212-]\d{3}/.test(summary);
    const importance = clampImportance(2 + (kind === "disaster" ? 1 : 0) + (kind === "science" ? 1 : 0) + (bigLoss ? 1 : 0));
    const pieces: string[] = [];
    if (history.choiceLabel) pieces.push("抉择：「" + history.choiceLabel + "」");
    if (history.outcome) pieces.push(truncate(history.outcome, 60));
    if (summary) pieces.push("结果：" + truncate(summary, 70));
    entries.push({
      id: "event:" + history.id,
      year: finite(history.year, currentYear),
      turn: Math.max(0, finite(history.turn, currentTurn)),
      kind,
      title: history.title,
      detail: pieces.join(" · ") || "事件已写入文明史。",
      tone: kindTone(kind, importance),
      icon: kind === "science" ? "flask" : kind === "disaster" ? "alert" : "book",
      importance,
      sourceId: "event:" + history.id,
    });

    /* 事件造成的人口损失 → 独立伤亡条目（真实数字来自 effectsSummary） */
    const match = summary.match(POPULATION_LOSS);
    const popDelta = match ? Number(match[1].replace("\u2212", "-")) : Number.NaN;
    if (Number.isFinite(popDelta) && popDelta < 0) {
      const lost = Math.abs(popDelta);
      const deathImportance = clampImportance(3 + (lost >= 100 ? 1 : 0) + (summary.includes("人口 " + Math.round(popDelta)) ? 0 : 0));
      entries.push({
        id: "event-death:" + history.id,
        year: finite(history.year, currentYear),
        turn: Math.max(0, finite(history.turn, currentTurn)),
        kind: "death",
        title: "事件伤亡 · " + history.title,
        detail: (history.choiceLabel ? "「" + history.choiceLabel + "」造成" : "造成") + "人口损失约 " + fmtNumber(lost) + " 人。",
        tone: "death",
        icon: "people",
        importance: deathImportance,
        sourceId: "event:" + history.id,
      });
    }
  }

  /* 2) 灾害历史与危机（年份是相对年，统一到星历年） */
  for (const hazard of source.hazards?.history ?? []) {
    if (!hazard || typeof hazard.title !== "string") continue;
    const severity = finite(hazard.severity, 0);
    const year = hazardYear(hazard.endYear ?? hazard.peakYear ?? hazard.startYear);
    const importance = clampImportance(2 + severity * 3 + (severity >= 0.6 ? 1 : 0));
    entries.push({
      id: "hazard:" + hazard.id,
      year,
      turn: turnOfYear(year),
      kind: "disaster",
      title: hazard.title,
      detail: truncate(hazard.description ?? "物理灾害已被观测记录。", 90),
      tone: kindTone("disaster", importance),
      icon: "alert",
      importance,
      sourceId: "hazard:" + hazard.id,
    });
  }
  for (const hazard of source.hazards?.activeHazards ?? []) {
    if (!hazard || typeof hazard.title !== "string") continue;
    const severity = finite(hazard.severity, 0);
    const year = hazardYear(hazard.peakYear ?? hazard.startYear);
    entries.push({
      id: "hazard-active:" + hazard.id,
      year,
      turn: turnOfYear(year),
      kind: "disaster",
      title: hazard.title + "（持续中）",
      detail: truncate(hazard.description ?? "灾害仍在影响母星环境。", 90),
      tone: "major",
      icon: "alert",
      importance: clampImportance(3 + severity * 2),
      sourceId: "hazard:" + hazard.id,
    });
  }
  for (const crisis of source.hazards?.crises ?? []) {
    if (!crisis || typeof crisis.title !== "string") continue;
    const severity = finite(crisis.severity, 0);
    const year = hazardYear(crisis.endYear ?? crisis.startYear);
    const active = crisis.active === true;
    const importance = clampImportance(active ? 4 : 3 + severity);
    entries.push({
      id: "crisis:" + crisis.id,
      year,
      turn: turnOfYear(year),
      kind: "disaster",
      title: crisis.title + (active ? "（危机持续）" : "（危机结束）"),
      detail: truncate(crisis.description ?? "文明遭遇资源/环境危机。", 90),
      tone: active || importance >= 4 ? "major" : "normal",
      icon: "alert",
      importance,
      sourceId: "crisis:" + crisis.id,
    });
  }

  /* 3) 日志：时代推进 / 建筑毁坏 / 死亡与人口损失 / 科技突破 / 结局 */
  const hazardTitles = new Set((source.hazards?.history ?? []).map((item) => (item?.title ?? "").trim()));
  for (const log of source.log ?? []) {
    if (!log || typeof log.message !== "string") continue;
    const category = String(log.category ?? "");
    const message = log.message;
    const year = finite(log.year, currentYear);
    const turn = Math.max(0, finite(log.turn, turnOfYear(year)));
    if (category === "event") continue; /* 事件由 history 统一生成，避免重复 */

    const eraMatch = message.match(ERA_ADVANCE);
    if (category === "milestone" && eraMatch) {
      const era = Number(eraMatch[1]);
      const name = eraMatch[2] ?? "";
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "major",
        title: "时代推进 · 第 " + era + " 时代" + (name ? "「" + name + "」" : ""),
        detail: truncate(message, 96),
        tone: "major", icon: "star", importance: 5,
        sourceId: "log:" + log.id,
      });
      continue;
    }

    if (category === "milestone" || category === "ending") {
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "major",
        title: category === "ending" ? "文明结局" : truncate(message, 26),
        detail: truncate(message, 100),
        tone: "major", icon: category === "ending" ? "star" : "log",
        importance: category === "ending" ? 5 : 4,
        sourceId: "log:" + log.id,
      });
      continue;
    }

    if (DESTRUCTION_WORDS.test(message) && category !== "hazard") {
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "major",
        title: "工程与城邦损毁",
        detail: truncate(message, 100),
        tone: "major", icon: "build", importance: 4,
        sourceId: "log:" + log.id,
      });
      continue;
    }

    const shock = message.match(HAZARD_SHOCK);
    if (mentionsDeath(message) || shock) {
      const pct = shock ? Number(shock[1]) : 0;
      const lostMatch = message.match(POPULATION_LOSS);
      const lost = lostMatch ? Math.abs(Number(lostMatch[1].replace("\u2212", "-"))) : 0;
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "death",
        title: shock ? "灾害冲击 · 人口损失 " + fmtNumber(pct) + "%" : "居民死亡",
        detail: truncate(message, 100),
        tone: "death", icon: "people",
        importance: clampImportance(3 + (pct >= 8 ? 1 : 0) + (lost >= 200 ? 1 : 0)),
        sourceId: "log:" + log.id,
      });
      continue;
    }

    const techMatch = message.match(TECH_BREAK);
    if (category === "tech" && techMatch) {
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "science",
        title: "科技突破 · " + (techMatch[1] || "未知项目"),
        detail: truncate(message, 96),
        tone: "science", icon: "flask", importance: 3,
        sourceId: "log:" + log.id,
      });
      continue;
    }

    /* 灾害日志：只有 critical 且未被灾害历史覆盖时才单独成条，避免重复。 */
    if (category === "hazard" && log.severity === "critical") {
      const covered = Array.from(hazardTitles).some((title) => title.length > 1 && message.includes(title));
      if (!covered) {
        entries.push({
          id: "log:" + log.id,
          year, turn,
          kind: "disaster",
          title: "灾害记录",
          detail: truncate(message, 100),
          tone: "major", icon: "alert", importance: 4,
          sourceId: "log:" + log.id,
        });
      }
      continue;
    }

    if (category === "civilization" && /人口.*(减少|下降|骤降|损失)/.test(message)) {
      entries.push({
        id: "log:" + log.id,
        year, turn,
        kind: "death",
        title: "人口下降",
        detail: truncate(message, 100),
        tone: "death", icon: "people", importance: 3,
        sourceId: "log:" + log.id,
      });
    }
  }

  /* 4) 人口历史：连续样本下跌 ≥ 2% 记为人口骤降（只使用真实采样） */
  const populationHistory = source.civ?.populationHistory ?? [];
  for (let i = 1; i < populationHistory.length; i++) {
    const prev = populationHistory[i - 1];
    const cur = populationHistory[i];
    if (!prev || !cur) continue;
    const before = finite(prev.population, 0);
    const after = finite(cur.population, 0);
    if (before <= 0 || after >= before) continue;
    const drop = (before - after) / before;
    if (drop < 0.02) continue;
    const year = finite(cur.year, currentYear);
    const importance = clampImportance(drop >= 0.18 ? 5 : drop >= 0.1 ? 4 : drop >= 0.05 ? 4 : 3);
    entries.push({
      id: "population:" + Math.round(year * 100) / 100,
      year,
      turn: turnOfYear(year),
      kind: "death",
      title: drop >= 0.15 ? "人口崩溃" : drop >= 0.06 ? "人口骤降" : "人口下降",
      detail: "人口 " + fmtNumber(before) + " → " + fmtNumber(after)
        + "（减少 " + fmtNumber(before - after) + "，-" + Math.round(drop * 1000) / 10 + "%）",
      tone: "death",
      icon: "people",
      importance,
      sourceId: "population:" + Math.round(year * 100) / 100,
    });
  }

  /* 去重（同一 id 保留重要性更高者）并排序：最新在前，其次按重要性。 */
  const byId = new Map<string, ChronicleEntry>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing || entry.importance > existing.importance) byId.set(entry.id, entry);
  }
  const sorted = Array.from(byId.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    if (b.turn !== a.turn) return b.turn - a.turn;
    if (b.importance !== a.importance) return b.importance - a.importance;
    return a.id.localeCompare(b.id);
  });
  return sorted.slice(0, MAX_CHRONICLE_ENTRIES);
}

export const MAX_CHRONICLE_ENTRIES = 160;

/** 从 ViewModel 结构派生（chronicle-panel 直接调用）。 */
export function deriveChronicleFromView(view: ChronicleViewLike | null | undefined): ChronicleEntry[] {
  if (!view || !view.meta || !view.civ) return [];
  const calendarStart = finite(view.meta.calendarYear, 0) - finite(view.meta.year, 0);
  const active = view.events?.active ?? null;
  const source: ChronicleSource = {
    meta: { calendarStartYear: calendarStart > 0 ? calendarStart : 0 },
    yearsElapsed: finite(view.meta.year, 0),
    civ: {
      population: finite(view.civ.population?.total, 0),
      stability: finite(view.civ.stability?.value, 0),
      era: finite(view.civ.era?.value, 0),
      turn: finite(view.meta.turn, 0),
    },
    events: {
      pending: active
        ? [{ defId: active.defId, triggerTurn: view.meta.turn, triggerYear: active.triggerYear, context: active.context }]
        : [],
      history: view.events?.history ?? [],
      triggeredTotal: view.events?.totalTriggered,
    },
    hazards: view.hazards
      ? { activeHazards: view.hazards.hazards ?? [], crises: view.hazards.crises ?? [] }
      : null,
    log: view.log ?? [],
  };
  return deriveChronicle(source);
}

/** 过滤（保持输入顺序）。 */
export function filterChronicle(
  entries: ReadonlyArray<ChronicleEntry>,
  filter: ChronicleFilter = {},
): ChronicleEntry[] {
  let out = entries.slice();
  if (filter.year != null && Number.isFinite(filter.year)) {
    const year = Math.round(filter.year);
    out = out.filter((entry) => Math.round(entry.year) === year);
  }
  if (filter.kinds && filter.kinds.length > 0) {
    const allowed = new Set(filter.kinds);
    out = out.filter((entry) => allowed.has(entry.kind));
  }
  if (filter.majorOnly) out = out.filter((entry) => entry.importance >= 4 || entry.kind === "major");
  if (filter.minImportance != null && Number.isFinite(filter.minImportance)) {
    out = out.filter((entry) => entry.importance >= filter.minImportance!);
  }
  const query = (filter.query ?? "").trim().toLowerCase();
  if (query) {
    out = out.filter((entry) => (entry.title + " " + entry.detail).toLowerCase().includes(query));
  }
  if (filter.limit != null && Number.isFinite(filter.limit) && filter.limit >= 0) {
    out = out.slice(0, Math.floor(filter.limit));
  }
  return out;
}

/** 各类型计数（面板筛选角标 / 测试用）。 */
export function chronicleKindCounts(entries: ReadonlyArray<ChronicleEntry>): Record<ChronicleKind, number> {
  const counts: Record<ChronicleKind, number> = { event: 0, death: 0, major: 0, disaster: 0, science: 0 };
  for (const entry of entries) counts[entry.kind] += 1;
  return counts;
}

/** 出现过的星历年（降序）。 */
export function chronicleYears(entries: ReadonlyArray<ChronicleEntry>): number[] {
  const years = new Set<number>();
  for (const entry of entries) years.add(Math.round(entry.year));
  return Array.from(years).sort((a, b) => b - a);
}

/** 轻量签名：panel 用它判断是否需要重绘（避免每帧重建 DOM）。 */
export function chronicleSignature(entries: ReadonlyArray<ChronicleEntry>): string {
  return entries.map((entry) => entry.id + "@" + entry.importance).join("|");
}