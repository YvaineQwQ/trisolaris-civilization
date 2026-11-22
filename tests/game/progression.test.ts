import { describe, expect, it } from "vitest";
import { createGameState } from "../../src/game/state";
import { Game } from "../../src/game/game";
import { setSaveStorage, MemorySaveStorage } from "../../src/save/storage";
import type { ObservationKind } from "../../src/core/types";

setSaveStorage(new MemorySaveStorage());

const OBS_PRIORITY: ObservationKind[] = [
  "anomaly", "long-term", "triple-joint", "binary-relative",
  "star-velocity", "star-distance", "star-position",
];
const RESEARCH_PRIORITY = [
  "astro_basic", "bio_basic", "industry_basic", "energy_basic", "space_basic",
  "astro_distance", "industry_alloys", "energy_wind", "bio_medicine",
  "astro_orbit", "industry_automation", "energy_grid", "bio_ecology",
  "astro_threebody", "industry_megastructure", "energy_nuclear", "bio_genetic",
  "astro_chaos", "astro_supernet", "industry_quantum", "energy_zero",
  "bio_biosphere", "space_orbital", "space_colony", "space_deep", "space_engine",
];

/**
 * A simple but plausible civilization policy for the primitive-to-interstellar
 * era system: feed/house the tribe first, build the star-watching platform,
 * research era by era, keep observing and upgrade buildings when the next era
 * unlocks them. Exercises only real Game actions.
 */
function autoPlay(game: Game, targetYears: number): void {
  game.setSpeedIndex(7); // 32x
  let lastTurn = -1;
  let starCursor = 0;
  const starIds: ("A" | "B" | "C")[] = ["A", "B", "C"];
  let guard = 0;
  while (!game.state.gameOver && game.state.yearsElapsed < targetYears && guard < 30000) {
    game.update(0.04);
    guard += 1;
    const pendingView = game.view().events?.active;
    if (pendingView) {
      const choice = pendingView.choices.find((c) => c.available) ?? pendingView.choices[0];
      if (choice) game.actions.resolveEvent(choice.id);
      continue;
    }
    const s = game.state;
    if (s.civ.turn === lastTurn) continue;
    lastTurn = s.civ.turn;
    const view = game.view();
    const countOf = (id: string): number => view.buildings.available.find((b) => b.id === id)?.count ?? 0;
    const canBuild = (id: string): boolean => Boolean(view.buildings.available.find((b) => b.id === id)?.canBuild);
    const food = s.civ.resources.food.amount;
    const water = s.civ.resources.water.amount;
    const minerals = s.civ.resources.minerals.amount;
    const housing = view.civ.population.housingRatio;
    const foodNet = view.resources.find((r) => r.id === "food")?.net ?? 0;
    const waterNet = view.resources.find((r) => r.id === "water")?.net ?? 0;

    // 1) research: era-appropriate priority chain, else anything available.
    if (!s.tech.activeTech) {
      const next = RESEARCH_PRIORITY.find((id) => {
        const tech = view.tech.branches.flatMap((b) => b.techs).find((t) => t.id === id);
        return tech?.available === true;
      });
      if (next) game.startResearch(next);
      else {
        const available = view.tech.branches.flatMap((b) => b.techs).find((t) => t.available);
        if (available) game.startResearch(available.id);
      }
    }

    // 2) observatory upgrades as soon as era + tech allow.
    if (view.observatory.next?.canUpgrade) game.upgradeObservatory();

    // 3) observation (currency is food at era 1-2, energy from era 3).
    if (s.observation.level >= 1 && !s.observation.activeTask) {
      const currencyOk = s.civ.era >= 3 ? s.civ.resources.energy.amount > 120 : food > 180;
      if (currencyOk) {
        const options = view.observation.taskOptions.filter((o) => o.enabled);
        for (const kind of OBS_PRIORITY) {
          const option = options.find((o) => o.kind === kind);
          if (!option) continue;
          const target = option.targetMode === "all" ? "all"
            : option.targetMode === "planet" ? "planet"
            : starIds[starCursor++ % starIds.length];
          game.startObservation(option.kind, target);
          break;
        }
      }
    }

    // 4) upgrade built buildings when the next era unlocks a better tier.
    if (s.buildings.queue.length < 2) {
      const upgrade = view.buildings.available.find((b) => b.canUpgrade && b.upgradeToId);
      if (upgrade) {
        game.upgradeBuilding(upgrade.id);
        continue;
      }
    }

    // 5) construction priority: survival first, then observatory, research, industry.
    if (s.buildings.queue.length < 2) {
      const order: string[] = [];
      if (foodNet < 90 || food < 950) order.push("farm1");
      if (waterNet < 40 || water < 420) order.push("well1");
      if (housing < 1.25) order.push("camp");
      if (countOf("observatory") < 1 && minerals >= 110) order.push("observatory");
      if (countOf("elderHall") < 2 && minerals >= 150) order.push("elderHall");
      if (countOf("quarry1") < 3) order.push("quarry1");
      if (!view.civ.era.canAdvance) {
        if (countOf("farm1") < 6) order.push("farm1");
        if (countOf("camp") < 5) order.push("camp");
      }
      if (s.civ.era >= 2) {
        if (countOf("irrigatedFarm") < 4) order.push("irrigatedFarm");
        if (countOf("townHouse") < 5) order.push("townHouse");
        if (countOf("aqueduct") < 3) order.push("aqueduct");
        if (countOf("mine") < 2) order.push("mine");
        if (countOf("academy") < 1) order.push("academy");
      }
      if (s.civ.era >= 3) {
        if (countOf("mechanizedFarm") < 5) order.push("mechanizedFarm");
        if (countOf("housingDistrict") < 4) order.push("housingDistrict");
        if (countOf("coalPlant") < 2) order.push("coalPlant");
        if (countOf("steelMill") < 1) order.push("steelMill");
        if (countOf("scienceAcademy") < 2) order.push("scienceAcademy");
        if (countOf("bunker") < 1) order.push("bunker");
      }
      for (const id of order) {
        if (canBuild(id)) { game.startBuilding(id); break; }
      }
    }
  }
}

function makeGame(seed: string, difficulty: "easy" | "normal") {
  return new Game(createGameState({ seed, difficulty, mode: "normal" }), {
    onReturnToMenu: () => {},
    autosaveIntervalSeconds: 0,
  });
}

describe("progression (auto-player scenario, era system)", () => {
  it("survives and advances from the primitive era into the city era", () => {
    const game = makeGame("PROGRESS-ERA-1", "easy");
    autoPlay(game, 120);
    const s = game.state;
    if (s.gameOver) {
      console.log("AUTO-PLAYER FAILED:", {
        year: s.yearsElapsed, title: s.endingTitle, text: s.endingText,
        pop: Math.round(s.civ.population), era: s.civ.era,
        food: Math.round(s.civ.resources.food.amount), water: Math.round(s.civ.resources.water.amount),
        tech: s.tech.researched, obs: s.observation.level, buildings: s.buildings.counts,
      });
    }
    expect(s.gameOver).toBe(false);
    expect(s.yearsElapsed).toBeGreaterThan(100);
    expect(s.civ.era).toBeGreaterThanOrEqual(2);
    expect(s.civ.population).toBeGreaterThan(400);
    expect(s.tech.researched.length).toBeGreaterThanOrEqual(3);
    expect(s.observation.level).toBeGreaterThanOrEqual(1);
    expect(s.observation.history.length).toBeGreaterThan(0);
    expect(s.buildings.counts.observatory ?? 0).toBeGreaterThanOrEqual(1);
  }, 240000);

  it("produces observation trails and era-aware building views", () => {
    const game = makeGame("PROGRESS-ERA-2", "easy");
    autoPlay(game, 40);
    const s = game.state;
    const view = game.view();
    const scene = game.scene();
    expect(s.observation.dataPoints).toBeGreaterThan(2);
    expect(view.buildings.currentEra).toBe(s.civ.era);
    expect(view.buildings.available.length).toBeGreaterThan(20);
    // locked resources must be hidden from effective amounts before their era
    const metals = view.resources.find((r) => r.id === "metals")!;
    const energy = view.resources.find((r) => r.id === "energy")!;
    if (s.civ.era < 2) { expect(metals.locked).toBe(true); }
    if (s.civ.era < 3) { expect(energy.locked).toBe(true); expect(energy.amount).toBe(0); }
    expect(scene.stars.length).toBe(3);
  }, 180000);

  it("view and scene assembly stay cheap enough for 60fps", () => {
    const game = makeGame("PROGRESS-PERF", "normal");
    autoPlay(game, 8);
    const t0 = performance.now();
    const N = 100;
    for (let i = 0; i < N; i++) game.scene();
    const sceneMs = (performance.now() - t0) / N;
    const t1 = performance.now();
    for (let i = 0; i < N; i++) game.view();
    const viewMs = (performance.now() - t1) / N;
    expect(sceneMs).toBeLessThan(15);
    expect(viewMs).toBeLessThan(20);
  }, 120000);
});
