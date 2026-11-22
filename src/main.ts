/**
 * TRISOLARIS: CIVILIZATION — application entry point.
 *
 * Implements AppController (game lifecycle + save slots) and mounts the UI.
 * The simulation itself lives in src/game; this file only wires the pieces.
 */
import "./ui/styles.css";
import { mountApp } from "./ui/app";
import { getStartupHandle, replayStartup, runStartup } from "./startup";
import { Game } from "./game/game";
import { createGameState } from "./game/state";
import { generateGalaxy } from "./generation/galaxy";
import { randomSeed } from "./core/rng";
import { DIFFICULTIES } from "./core/constants";
import type { DifficultyKey, GameMode, GalaxyPreview, NewGameOptions } from "./core/types";
import type { AppController, GameApi, SaveSlotMeta } from "./game/viewTypes";
import {
  deleteSaveSlot, exportSaveToFile, listSaveSlots, loadGameFromSlot, readSaveFile,
} from "./save/storage";

const VALID_DIFFICULTIES: DifficultyKey[] = ["easy", "normal", "hard", "nightmare"];
const VALID_MODES: GameMode[] = ["story", "normal", "survival", "sandbox"];

class TrisolarisApp implements AppController {
  autostart = false;
  private game: Game | null = null;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.autostart = params.get("autostart") === "1";
    if (this.autostart) {
      try {
        const seedParam = params.get("seed");
        const difficultyParam = params.get("difficulty");
        const modeParam = params.get("mode");
        const difficulty: DifficultyKey = VALID_DIFFICULTIES.includes(difficultyParam as DifficultyKey)
          ? (difficultyParam as DifficultyKey) : "normal";
        const mode: GameMode = VALID_MODES.includes(modeParam as GameMode)
          ? (modeParam as GameMode) : "normal";
        const seed = seedParam && seedParam.trim() ? seedParam.trim() : "QA-AUTOSTART-" + randomSeed();
        const state = createGameState({ seed, difficulty, mode });
        this.game = new Game(state, this.makeHost(), { startPaused: false });
        console.info("[trisolaris] autostart game created", seed, difficulty, mode);
      } catch (error) {
        console.error("[trisolaris] autostart failed", error);
      }
    }
  }

  private makeHost() {
    return {
      onReturnToMenu: () => {
        // The UI switches screens; the game stays in memory so "继续游戏" works.
      },
      autosaveIntervalSeconds: 60,
    };
  }

  randomSeed(): string {
    return randomSeed();
  }

  async previewGalaxy(seed: string, difficulty: DifficultyKey, mode: GameMode): Promise<GalaxyPreview> {
    const trimmed = seed.trim() || randomSeed();
    return generateGalaxy(trimmed, difficulty, mode).preview;
  }

  async createNewGame(opts: NewGameOptions): Promise<void> {
    const difficulty = VALID_DIFFICULTIES.includes(opts.difficulty) ? opts.difficulty : "normal";
    const mode = VALID_MODES.includes(opts.mode) ? opts.mode : "normal";
    const seed = (opts.seed ?? "").trim() || randomSeed();
    const state = createGameState({ seed, difficulty, mode });
    this.game = new Game(state, this.makeHost(), { startPaused: false });
  }

  async listSaves(): Promise<SaveSlotMeta[]> {
    try {
      return await listSaveSlots();
    } catch (error) {
      console.warn("[trisolaris] listSaves failed", error);
      return [];
    }
  }

  async loadSave(id: string): Promise<boolean> {
    try {
      const state = await loadGameFromSlot(id);
      if (!state) return false;
      this.game = new Game(state, this.makeHost());
      return true;
    } catch (error) {
      console.warn("[trisolaris] loadSave failed", error);
      return false;
    }
  }

  async deleteSave(id: string): Promise<void> {
    await deleteSaveSlot(id);
  }

  async exportSaveFile(id: string): Promise<void> {
    const state = await loadGameFromSlot(id);
    if (!state) throw new Error("存档不存在或已损坏");
    exportSaveToFile(state);
  }

  async importSaveFile(file: File): Promise<boolean> {
    const result = await readSaveFile(file);
    if (!result.ok || !result.state) {
      console.warn("[trisolaris] import failed", result.error);
      return false;
    }
    this.game = new Game(result.state, this.makeHost());
    return true;
  }

  activeGame(): GameApi | null {
    return this.game;
  }

  hasActiveGame(): boolean {
    return this.game !== null;
  }

  returnToMenu(): void {
    // Keep the in-memory game; the UI owns screen routing.
  }
}

const app = new TrisolarisApp();
mountApp(app);

declare global {
  interface Window {
    __TRISOLARIS__?: {
      app: TrisolarisApp;
      difficultyList: string[];
      /** v1.4: replay the interactive startup PV (also used by QA). */
      replayStartup: (opts?: { speed?: number; sound?: boolean | "auto" }) => Promise<"completed" | "skipped">;
      /** v1.4: inspect the currently playing startup sequence (null when idle). */
      startupHandle: () => ReturnType<typeof getStartupHandle>;
    };
  }
}

window.__TRISOLARIS__ = {
  app,
  difficultyList: Object.keys(DIFFICULTIES),
  replayStartup: (opts) => replayStartup({ force: true, ...opts }),
  startupHandle: () => getStartupHandle(),
};
console.info("[trisolaris] UI mounted", window.location.href);

// v1.4 interactive startup PV. Plain page loads play it once per session;
// autostart/QA links skip it unless ?startup=1 is explicit.
const bootParams = new URLSearchParams(window.location.search);
const bootAutostart = bootParams.get("autostart") === "1";
const skipStartup = bootParams.get("skipstartup") === "1"
  || (bootAutostart && bootParams.get("startup") !== "1");
if (!skipStartup) {
  void runStartup()
    .then((result) => {
      console.info("[trisolaris] startup", result);
    })
    .catch((error) => {
      console.warn("[trisolaris] startup failed", error);
    });
} else {
  console.info("[trisolaris] startup skipped by URL");
}
