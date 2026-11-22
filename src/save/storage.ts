/**
 * Persistence layer: IndexedDB in the browser, in-memory fallback elsewhere
 * (e.g. unit tests / jsdom), plus import/export helpers.
 */
import { SAVE_DB_NAME, SAVE_STORE, SAVE_VERSION } from "../core/constants";
import type { GameState } from "../core/types";
import type { SaveSlotMeta } from "../game/viewTypes";
import { parseGameFile, saveMetaFromState, serializeGame } from "./serializer";

export interface SaveRecord {
  id: string;
  meta: SaveSlotMeta;
  savedAt: number;
  state: GameState;
}

export interface SaveStorage {
  list(): Promise<SaveSlotMeta[]>;
  read(id: string): Promise<SaveRecord | null>;
  write(record: SaveRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

/** In-memory storage: works in Node tests and as a last-resort fallback. */
export class MemorySaveStorage implements SaveStorage {
  private map = new Map<string, SaveRecord>();

  async list(): Promise<SaveSlotMeta[]> {
    return [...this.map.values()].map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async read(id: string): Promise<SaveRecord | null> {
    return this.map.get(id) ?? null;
  }
  async write(record: SaveRecord): Promise<void> {
    this.map.set(record.id, record);
  }
  async remove(id: string): Promise<void> {
    this.map.delete(id);
  }
}

/** IndexedDB storage used by the real game. */
export class IndexedDbSaveStorage implements SaveStorage {
  constructor(private dbName = SAVE_DB_NAME, private storeName = SAVE_STORE) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB 打开失败"));
    });
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const req = run(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB 操作失败"));
      tx.oncomplete = () => db.close();
    });
  }

  async list(): Promise<SaveSlotMeta[]> {
    const rows = await this.tx<SaveRecord[]>("readonly", (s) => s.getAll() as IDBRequest<SaveRecord[]>);
    return rows.map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async read(id: string): Promise<SaveRecord | null> {
    const row = await this.tx<SaveRecord | undefined>("readonly", (s) => s.get(id) as IDBRequest<SaveRecord | undefined>);
    return row ?? null;
  }
  async write(record: SaveRecord): Promise<void> {
    await this.tx("readwrite", (s) => s.put(record) as IDBRequest<IDBValidKey>);
  }
  async remove(id: string): Promise<void> {
    await this.tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  }
}

let cached: SaveStorage | null = null;

export function getSaveStorage(): SaveStorage {
  if (cached) return cached;
  if (typeof indexedDB !== "undefined") {
    try {
      cached = new IndexedDbSaveStorage();
      return cached;
    } catch {
      // fall through
    }
  }
  cached = new MemorySaveStorage();
  return cached;
}

/** Used by tests to isolate storage. */
export function setSaveStorage(storage: SaveStorage | null): void {
  cached = storage;
}

export const AUTO_SLOT = "auto";
export const QUICK_SLOT = "quick";
export const MANUAL_SLOTS = ["slot-1", "slot-2", "slot-3", "slot-4", "slot-5", "slot-6"] as const;

export async function persistGame(state: GameState, slotId: string, name?: string): Promise<SaveSlotMeta> {
  const storage = getSaveStorage();
  const existing = await storage.read(slotId);
  const auto = slotId === AUTO_SLOT || existing?.meta.auto === true;
  const meta = saveMetaFromState(state, slotId, name ?? existing?.meta.name ?? defaultSlotName(slotId), auto);
  await storage.write({ id: slotId, meta, savedAt: meta.savedAt, state: cloneState(state) });
  return meta;
}

function cloneState(state: GameState): GameState {
  // Structured clone where available (keeps IndexedDB records independent of
  // further simulation changes); JSON fallback otherwise.
  try {
    return structuredClone(state);
  } catch {
    return JSON.parse(JSON.stringify(state)) as GameState;
  }
}

export function defaultSlotName(slotId: string): string {
  if (slotId === AUTO_SLOT) return "自动存档";
  if (slotId === QUICK_SLOT) return "快速存档";
  const index = MANUAL_SLOTS.indexOf(slotId as (typeof MANUAL_SLOTS)[number]);
  return index >= 0 ? `存档 ${index + 1}` : slotId;
}

export async function loadGameFromSlot(slotId: string): Promise<GameState | null> {
  const record = await getSaveStorage().read(slotId);
  if (!record) return null;
  const { ok, state } = parseGameFile(JSON.stringify({ format: "trisolaris-save", version: record.meta.version ?? SAVE_VERSION, state: record.state }));
  return ok && state ? state : null;
}

export async function deleteSaveSlot(slotId: string): Promise<void> {
  await getSaveStorage().remove(slotId);
}

export async function listSaveSlots(): Promise<SaveSlotMeta[]> {
  return getSaveStorage().list();
}

/** Download a save as a JSON file. */
export function exportSaveToFile(state: GameState, filename?: string): void {
  const text = serializeGame(state);
  const name = filename ?? `trisolaris-${state.meta.seed}-${Math.round(state.meta.calendarStartYear + state.yearsElapsed)}.json`;
  if (typeof document === "undefined") {
    throw new Error("当前环境不支持文件下载");
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function readSaveFile(file: File): Promise<{ ok: boolean; state?: GameState; error?: string }> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "无法读取文件" };
  }
  const result = parseGameFile(text);
  return result.ok ? { ok: true, state: result.state } : { ok: false, error: result.error };
}
