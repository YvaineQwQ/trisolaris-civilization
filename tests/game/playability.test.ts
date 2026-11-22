import { describe, expect, it } from "vitest";
import { createGameState } from "../../src/game/state";
import { Game } from "../../src/game/game";
import { setSaveStorage, MemorySaveStorage } from "../../src/save/storage";
import { acknowledgeEventOutcome, updateEventOutcome } from "../../src/events";

function makeGame(seed: string, difficulty: "easy" | "normal" | "hard") {
  setSaveStorage(new MemorySaveStorage());
  const state = createGameState({ seed, difficulty, mode: "normal" });
  return new Game(state, { onReturnToMenu: () => {}, autosaveIntervalSeconds: 0 });
}

function resolvePendingEvent(game: Game): void {
  const active = game.view().events?.active;
  if (!active) return;
  const choice = active.choices.find((c) => c.available) ?? active.choices[0];
  if (choice) {
    game.actions.resolveEvent(choice.id);
    const events = game.state.events;
    if (events?.pendingOutcome) {
      updateEventOutcome(events, events.pendingOutcome.dueElapsedSeconds + 0.001);
      acknowledgeEventOutcome(events);
    }
  }
}

function play(game: Game, years: number, dt = 0.04): void {
  game.setSpeedIndex(7); // 32x
  const target = game.state.yearsElapsed + years;
  let guard = 0;
  while (game.state.yearsElapsed < target && guard < 4000 && !game.state.gameOver) {
    game.update(dt);
    resolvePendingEvent(game);
    guard += 1;
  }
}

describe("long-run playability (civilization must not instantly collapse)", () => {
  it("easy systems mostly survive 50 idle years with sane climate", () => {
    const seeds = ["PLAY-EASY-1", "PLAY-EASY-2", "PLAY-EASY-4", "PLAY-EASY-5"];
    let survived = 0;
    for (const seed of seeds) {
      const game = makeGame(seed, "easy");
      const initialTemp = game.state.environment.surfaceTempC;
      expect(initialTemp).toBeGreaterThan(-15);
      expect(initialTemp).toBeLessThan(45);
      play(game, 50);
      const s = game.state;
      expect(Number.isFinite(s.environment.surfaceTempC)).toBe(true);
      expect(Number.isFinite(s.civ.stability)).toBe(true);
      expect(s.hazards.historyStress.length).toBeGreaterThan(0);
      if (!s.gameOver && s.civ.population > 200) survived += 1;
    }
    expect(survived).toBeGreaterThanOrEqual(3);
  }, 180000);

  it("normal system survives 30 simulated years without numeric breakage", () => {
    const game = makeGame("PLAY-NORMAL-1", "normal");
    play(game, 30);
    const s = game.state;
    expect(s.gameOver).toBe(false);
    expect(s.civ.population).toBeGreaterThan(200);
    expect(Number.isFinite(s.environment.surfaceTempC)).toBe(true);
    expect(Number.isFinite(s.civ.stability)).toBe(true);
    expect(Number.isFinite(s.civ.population)).toBe(true);
  }, 120000);

  it("builds an observatory and completes observation tasks in the primitive era", () => {
    const game = makeGame("PLAY-OBS-1", "easy");
    game.startBuilding("observatory");
    game.setSpeedIndex(7);
    let guard = 0;
    while (game.state.observation.level < 1 && guard < 400) { game.update(0.04); resolvePendingEvent(game); guard += 1; }
    expect(game.state.observation.level).toBeGreaterThanOrEqual(1);
    game.startObservation("star-position", "A");
    guard = 0;
    while (game.state.observation.activeTask && guard < 400) {
      game.update(0.04);
      resolvePendingEvent(game);
      guard += 1;
    }
    expect(game.state.observation.history.length).toBeGreaterThan(0);
    expect(game.state.observation.stars.A.known.position).toBe(true);
    expect(game.view().observation.stars[0].confidence).toBeGreaterThan(0);
  }, 60000);
});
