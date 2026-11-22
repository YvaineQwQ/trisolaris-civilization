/**
 * Save serialization with an explicit schema version.
 * GameState is plain JSON data (no functions/classes), so serialization is a
 * versioned envelope with structural validation on import.
 */
import { SAVE_VERSION } from "../core/constants";
import type { GameState, NewGameOptions } from "../core/types";
import { createEventState } from "../events/system";
import { createPoliticsState } from "../politics/system";
import type { SaveSlotMeta } from "../game/viewTypes";

export interface SaveFileEnvelope {
  format: "trisolaris-save";
  version: number;
  savedAt: number;
  state: GameState;
}

export function serializeGame(state: GameState): string {
  const envelope: SaveFileEnvelope = {
    format: "trisolaris-save",
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state,
  };
  return JSON.stringify(envelope);
}

export interface ParseResult {
  ok: boolean;
  state?: GameState;
  error?: string;
}

/** Validate the minimum shape required to safely resume a game. */
export function validateGameState(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "存档内容不是对象" };
  const s = raw as Partial<GameState>;
  if (!s.meta || typeof s.meta !== "object") return { ok: false, error: "存档缺少 meta" };
  if (!s.physics || !Array.isArray(s.physics.stars) || s.physics.stars.length !== 3) return { ok: false, error: "存档恒星数据损坏" };
  if (!s.physics.planet) return { ok: false, error: "存档缺少母星数据" };
  if (!s.environment) return { ok: false, error: "存档缺少环境数据" };
  if (!s.observation || !s.observation.stars) return { ok: false, error: "存档缺少观测数据" };
  if (!s.civ || !s.civ.resources) return { ok: false, error: "存档缺少文明数据" };
  if (!s.buildings || !s.tech) return { ok: false, error: "存档缺少建筑或科技数据" };
  if (!s.hazards) return { ok: false, error: "存档缺少灾害数据" };
  if (typeof s.yearsElapsed !== "number") return { ok: false, error: "存档缺少游戏时间" };
  return { ok: true, state: raw as GameState };
}

export function parseGameFile(text: string): ParseResult & { savedAt?: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是有效的 JSON 文件" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "存档格式错误" };
  const envelope = parsed as Partial<SaveFileEnvelope>;
  if (envelope.format !== "trisolaris-save" || !envelope.state) {
    // Allow importing a bare GameState for resilience.
    const direct = validateGameState(parsed);
    if (direct.ok) return direct;
    return { ok: false, error: "不是《三体纪元》存档文件" };
  }
  if (envelope.version !== SAVE_VERSION) {
    // v1.3: migrate a v2 save by creating the new politics/events state from
    // the same seed (content-facing systems are deterministic on seed).
    if (envelope.version === 2) {
      const migrated = validateGameState(envelope.state);
      if (!migrated.ok || !migrated.state) return migrated;
      const state = migrated.state;
      const seed = String(state.meta?.seed ?? "TRISOLARIS-2187");
      state.politics = state.politics ?? createPoliticsState(seed);
      state.events = state.events ?? createEventState(seed + "|events");
      state.version = SAVE_VERSION;
      return { ok: true, state, savedAt: envelope.savedAt };
    }
    return { ok: false, error: `存档版本不兼容（文件 v${envelope.version}，游戏 v${SAVE_VERSION}）` };
  }
  const result = validateGameState(envelope.state);
  return { ...result, savedAt: envelope.savedAt };
}

export function saveMetaFromState(state: GameState, id: string, name: string, auto = false): SaveSlotMeta {
  return {
    id,
    name,
    seed: state.meta.seed,
    difficulty: state.meta.difficulty,
    mode: state.meta.mode,
    year: state.meta.calendarStartYear + state.yearsElapsed,
    turn: state.civ.turn,
    population: state.civ.population,
    savedAt: Date.now(),
    version: SAVE_VERSION,
    auto,
    era: state.civ.era,
  };
}

export function stateStats(state: GameState): { label: string; value: string }[] {
  return [
    { label: "种子", value: state.meta.seed },
    { label: "文明时代", value: "第 " + state.civ.era + " 时代" },
    { label: "人口", value: Math.round(state.civ.population).toLocaleString("zh-CN") },
    { label: "观测等级", value: "Lv." + state.observation.level },
    { label: "已研究科技", value: state.tech.researched.length + " 项" },
    { label: "模拟年数", value: state.yearsElapsed.toFixed(1) + " 年" },
  ];
}

export function newGameOptionsFromState(state: GameState): NewGameOptions {
  return { seed: state.meta.seed, difficulty: state.meta.difficulty, mode: state.meta.mode };
}
