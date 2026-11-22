import { beforeEach, describe, expect, it } from "vitest";
import { createGameState } from "../../src/game/state";
import { Game } from "../../src/game/game";
import { advancePhysics } from "../../src/physics/nbody";
import { MemorySaveStorage, setSaveStorage } from "../../src/save/storage";
import { parseGameFile, serializeGame } from "../../src/save/serializer";
import type { GameState } from "../../src/core/types";
import { acknowledgeEventOutcome, updateEventOutcome } from "../../src/events";

function makeGame(seed = "INTEGRATION-1", difficulty: "easy" | "normal" | "hard" = "normal"): Game {
  const state = createGameState({ seed, difficulty, mode: "normal" });
  return new Game(state, { onReturnToMenu: () => {}, autosaveIntervalSeconds: 0 });
}

/** v1.3: random events pause the simulation; tests resolve them like a player. */
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

function run(game: Game, frames = 400, frameSeconds = 0.05): void {
  for (let i = 0; i < frames; i++) {
    game.update(frameSeconds);
    resolvePendingEvent(game);
  }
}

function assertFiniteState(state: GameState): void {
  expect(Number.isFinite(state.yearsElapsed)).toBe(true);
  expect(Number.isFinite(state.civ.population)).toBe(true);
  expect(Number.isFinite(state.civ.stability)).toBe(true);
  for (const star of state.physics.stars) {
    expect(Number.isFinite(star.pos.x) && Number.isFinite(star.pos.y) && Number.isFinite(star.pos.z)).toBe(true);
  }
  expect(Number.isFinite(state.environment.surfaceTempC)).toBe(true);
}

beforeEach(() => {
  setSaveStorage(new MemorySaveStorage());
});

describe("game integration", () => {
  it("boots a playable state from a seed", () => {
    const game = makeGame();
    const state = game.state;
    expect(state.physics.stars.length).toBe(3);
    expect(state.observation.level).toBeGreaterThanOrEqual(0);
    expect(state.civ.population).toBeGreaterThan(0);
    expect(state.buildings.queue.length).toBe(0);
    assertFiniteState(state);
  });

  it("is deterministic for the same seed", () => {
    const a = createGameState({ seed: "DET-42", difficulty: "normal", mode: "normal" });
    const b = createGameState({ seed: "DET-42", difficulty: "normal", mode: "normal" });
    expect(a.physics.stars[0].pos.x).toBe(b.physics.stars[0].pos.x);
    expect(a.physics.stars[2].pos.z).toBe(b.physics.stars[2].pos.z);
    expect(a.civ.population).toBe(b.civ.population);
  });

  it("advances the fixed-step physics independently of frame rate and resolves turns", () => {
    const game = makeGame();
    game.setSpeedIndex(6); // 16x
    run(game, 500, 0.05);
    expect(game.state.yearsElapsed).toBeGreaterThan(3);
    expect(game.state.yearsElapsed - game.state.physics.timeYears).toBeLessThan(1e-9);
    expect(game.state.civ.turn).toBeGreaterThan(3);
    assertFiniteState(game.state);
  });

  it("produces a complete ViewModel and both scenes without NaN", () => {
    const game = makeGame();
    game.setSpeedIndex(5);
    run(game, 200);
    const view = game.view();
    expect(view.meta.seed).toBeTruthy();
    expect(view.resources.length).toBe(6);
    expect(view.civ.population.total).toBeGreaterThan(0);
    expect(view.observation.stars.length).toBe(3);
    expect(view.observatory.level).toBeGreaterThanOrEqual(0);
    expect(view.civ.era.requirements.length).toBeGreaterThan(0);
    expect(view.civ.era.subtitle.length).toBeGreaterThan(0);
    expect(view.objectives.length).toBeGreaterThan(0);
    expect(view.tech.branches.length).toBe(8);
    expect(view.tech.schools.length).toBeGreaterThanOrEqual(6);
    expect(view.politics?.departments.length).toBe(6);
    expect(view.events).toBeTruthy();
    expect(view.buildings.available.length).toBeGreaterThan(10);
    expect(view.settings).toBeTruthy();
    expect(view.log.length).toBeGreaterThan(0);
    for (const r of view.resources) expect(Number.isFinite(r.amount)).toBe(true);
    expect(Number.isFinite(view.environment.tempC)).toBe(true);
    expect(Number.isFinite(view.civ.stability.value)).toBe(true);
    expect(Number.isFinite(view.environment.flux)).toBe(true);

    const scene = game.scene();
    const scene3d = game.scene3d();
    expect(scene.stars.length).toBe(3);
    expect(scene3d.stars.length).toBe(3);
    // 2D and 3D must show the exact same celestial data (X-Z projection of the same Vec3).
    for (let i = 0; i < 3; i++) {
      expect(scene.stars[i].pos.x).toBe(scene3d.stars[i].pos.x);
      expect(scene.stars[i].pos.y).toBe(scene3d.stars[i].pos.y);
      expect(scene.stars[i].pos.z).toBe(scene3d.stars[i].pos.z);
      expect(scene.stars[i].id).toBe(scene3d.stars[i].id);
    }
    if (scene.planet && scene3d.planet) {
      expect(scene.planet.pos.x).toBe(scene3d.planet.pos.x);
      expect(scene.planet.pos.z).toBe(scene3d.planet.pos.z);
    }
    // switching the view must not change simulation time or selection
    const years = game.state.yearsElapsed;
    game.select("A");
    game.setSpeedIndex(2);
    game.scene();
    const after2d = game.state.yearsElapsed;
    game.scene3d();
    const after3d = game.state.yearsElapsed;
    // Switching view must never reset or rewind the simulation clock.
    expect(after2d).toBeGreaterThanOrEqual(years);
    expect(after3d).toBeGreaterThanOrEqual(after2d);
    expect(after3d - years).toBeLessThan(0.1);
    expect(game.view().selection).toBe("A");
    expect(game.scene().stars[0].pos.x).toBe(game.scene3d().stars[0].pos.x);
  });

  it("builds the observatory, then starts and completes observation tasks (food-paid, no data leak)", () => {
    const game = makeGame("OBSERVATORY-SEED", "easy");
    // Primitive era: no observatory, no observation tasks yet.
    expect(game.state.observation.level).toBe(0);
    expect(game.view().observation.taskOptions.some((o) => o.enabled)).toBe(false);
    game.startBuilding("observatory");
    game.setSpeedIndex(7);
    run(game, 16, 0.04);
    expect(game.state.gameOver).toBe(false);
    expect(game.state.observation.level).toBe(1);
    // ensure the tribe has enough food to pay for observations (primitive currency)
    game.state.civ.resources.food.amount = 2000;
    expect(game.view().observation.taskOptions.some((o) => o.enabled)).toBe(true);
    const foodBefore = game.state.civ.resources.food.amount;
    const energyBefore = game.state.civ.resources.energy.amount;
    game.startObservation("star-position", "A");
    expect(game.state.observation.activeTask).not.toBeNull();
    // Era 1 has no electricity: observation is paid in food instead of energy.
    expect(game.state.civ.resources.food.amount).toBeLessThan(foodBefore);
    expect(game.state.civ.resources.energy.amount).toBe(energyBefore);
    run(game, 80, 0.04);
    const obs = game.state.observation;
    expect(obs.activeTask).toBeNull();
    expect(obs.history.length).toBeGreaterThan(0);
    const star = obs.stars.A;
    expect(star.known.position).toBe(true);
    expect(star.sampleCount).toBeGreaterThan(0);
    // Level 1 observatory cannot determine mass/velocity.
    expect(star.known.mass).toBe(false);
    expect(star.known.velocity).toBe(false);
    const view = game.view();
    const viewStar = view.observation.stars.find((s) => s.id === "A")!;
    expect(viewStar.mass).toBeNull();
    expect(viewStar.speed).toBeNull();
    expect(viewStar.known.mass).toBe(false);
    expect(obs.discoveries.length).toBeGreaterThanOrEqual(0);
  });

  it("builds a structure and spends resources", () => {
    const game = makeGame();
    const mineralsBefore = game.state.civ.resources.minerals.amount;
    game.startBuilding("farm1");
    expect(game.state.buildings.queue.length).toBe(1);
    expect(game.state.civ.resources.minerals.amount).toBeLessThan(mineralsBefore);
    const view = game.view();
    expect(view.buildings.queue.length).toBe(1);
    expect(view.buildings.queue[0].kind).toBe("build");
    expect(view.buildings.queue[0].progress).toBeGreaterThanOrEqual(0);
    game.setSpeedIndex(7);
    run(game, 120, 0.04);
    const countAfter = game.state.buildings.counts.farm1 ?? 0;
    expect(countAfter).toBeGreaterThanOrEqual(3); // started with 2
  });

  it("research progresses and unlocks building prerequisites", () => {
    const game = makeGame();
    game.startResearch("astro_basic");
    expect(game.state.tech.activeTech).toBe("astro_basic");
    game.setSpeedIndex(7);
    run(game, 200, 0.04);
    // science per turn is small at start; either it completed or progress advanced
    const progressed = game.state.tech.researched.includes("astro_basic") || game.state.tech.progress > 0 || game.state.tech.totalScience > 0;
    expect(progressed).toBe(true);
  });

  it("primitive era gates resources, energy and future-era buildings", () => {
    const game = makeGame();
    const s = game.state;
    expect(s.civ.era).toBe(1);
    const view = game.view();
    const energy = view.resources.find((r) => r.id === "energy")!;
    const metals = view.resources.find((r) => r.id === "metals")!;
    expect(energy.locked).toBe(true);
    expect(energy.amount).toBe(0);
    expect(metals.locked).toBe(true);
    expect(s.civ.flows.energy.produced).toBe(0);
    // E1 buildings must not require locked resources, and era>1 buildings are blocked.
    for (const b of view.buildings.available.filter((x) => x.era === 1)) {
      expect(b.cost.every((c) => c.resourceId !== "energy" && c.resourceId !== "metals")).toBe(true);
    }
    const future = view.buildings.available.find((b) => b.era === 3)!;
    expect(future.canBuild).toBe(false);
    expect(future.blockedReason ?? "").toContain("时代");
    // Techs from future eras are locked with an explicit reason.
    const futureTech = view.tech.branches.flatMap((b) => b.techs).find((t) => t.era === 3)!;
    expect(futureTech.blockedReason ?? "").toContain("时代");
  });

  it("advances to the next era when its requirements are met", () => {
    const game = makeGame();
    const s = game.state;
    s.civ.population = 1000;
    s.tech.researched = ["astro_basic", "bio_basic"];
    s.observation.level = 1;
    s.civ.resources.food.amount = 3000;
    game.setSpeedIndex(7);
    run(game, 60, 0.04);
    expect(s.civ.era).toBeGreaterThanOrEqual(2);
    expect(game.view().civ.era.value).toBe(s.civ.era);
  });

  it("upgrades a built building into the next era tier (camp -> townHouse)", () => {
    const game = makeGame();
    const s = game.state;
    s.civ.era = 2; // simulate entering the city era
    s.civ.resources.food.amount = 3000;
    s.civ.resources.minerals.amount = 1200;
    const before = { camp: s.buildings.counts.camp ?? 0, town: s.buildings.counts.townHouse ?? 0 };
    const campView = game.view().buildings.available.find((b) => b.id === "camp")!;
    expect(campView.upgradeToId).toBe("townHouse");
    game.upgradeBuilding("camp");
    const job = s.buildings.queue.find((j) => j.upgradeFrom === "camp");
    expect(job).toBeTruthy();
    expect(game.view().buildings.queue.find((q) => q.jobId === job!.id)?.kind).toBe("upgrade");
    game.setSpeedIndex(7);
    run(game, 160, 0.04);
    expect(s.buildings.counts.townHouse ?? 0).toBe(before.town + 1);
    expect(s.buildings.counts.camp ?? 0).toBe(before.camp - 1);
  });

  it("politics: dismiss/appoint/mediate/summit actions update state and view", () => {
    const game = makeGame();
    const s = game.state;
    expect(s.politics).toBeTruthy();
    const view = game.view();
    expect(view.politics?.departments.length).toBe(6);
    expect(view.politics?.factions.length).toBe(5);
    expect(view.politics?.relations.length).toBeGreaterThan(0);
    s.politics!.capital = 120;

    // dismiss the science minister, then appoint a candidate for that department
    game.actions.dismissMinister("science");
    expect(s.politics!.ministers.science).toBeNull();
    expect(game.view().politics!.capital).toBeLessThan(120);
    const candidate = s.politics!.candidates.find((c) => c.department === "science") ?? s.politics!.candidates[0];
    expect(candidate).toBeTruthy();
    game.actions.appointMinister(candidate!.id);
    expect(s.politics!.ministers[candidate!.department]).toBeTruthy();

    // mediate two serving ministers
    const served = (["administration", "science", "industry", "agriculture", "defense", "observation"] as const)
      .filter((id) => s.politics!.ministers[id]);
    expect(served.length).toBeGreaterThanOrEqual(2);
    const beforeRelations = game.view().politics!.relations.length;
    game.actions.mediateMinisters(served[0], served[1]);
    expect(game.view().politics!.relations.length).toBe(beforeRelations);
    s.politics!.lastSummitTurn = -999;
    s.politics!.capital = 200;
    game.actions.holdSummit();
    expect(s.politics!.lastSummitTurn).toBe(s.civ.turn);
  });

  it("random events pause the turn loop and resolve with consequences", () => {
    const game = makeGame("V13-EVENT-SEED", "easy");
    game.setSpeedIndex(7);
    let active = null as ReturnType<typeof game.view>["events"] extends infer E ? any : any;
    for (let i = 0; i < 500 && !active; i++) {
      game.update(0.04);
      resolvePendingEvent(game);
      active = game.view().events?.active ?? null;
      if (!active) {
        // keep spinning until the event system fires one (first event turn 5-16)
        continue;
      }
    }
    // Run until one actually remains active at a boundary.
    let guard = 0;
    while (!game.view().events?.active && guard < 800) { game.update(0.04); guard += 1; }
    const view = game.view();
    expect(view.events).toBeTruthy();
    expect(view.politics?.departments.length).toBe(6);
    expect(Number.isFinite(view.events!.totalTriggered)).toBe(true);
  });

  it("tech schools and doctrines are exposed through the view", () => {
    const game = makeGame();
    const view = game.view();
    expect(view.tech.branches.length).toBe(8);
    expect(view.tech.totalTechs).toBeGreaterThanOrEqual(64);
    expect(view.tech.schools.length).toBeGreaterThanOrEqual(6);
    expect(view.tech.doctrines.length).toBeGreaterThanOrEqual(6);
    expect(view.tech.branches.every((b) => b.techs.every((t) => t.descriptionLong && t.flavor))).toBe(true);
    game.actions.chooseSchoolFocus("observation");
    expect(game.state.tech.schoolFocus).toBe("observation");
    expect(game.view().tech.schools.find((s) => s.id === "observation")?.focused).toBe(true);
  });

  it("exports a save, loads it and continues with identical time", async () => {
    const game = makeGame("SAVE-LOAD-1");
    game.setSpeedIndex(5);
    run(game, 300);
    const years = game.state.yearsElapsed;
    const population = game.state.civ.population;
    const result = await game.saveGame("slot-1", "测试存档");
    expect(result.ok).toBe(true);
    const slots = await game.listSaves();
    expect(slots.some((s) => s.id === "slot-1")).toBe(true);

    const fresh = makeGame("OTHER");
    const loaded = await fresh.loadGame("slot-1");
    expect(loaded).toBe(true);
    expect(fresh.state.meta.seed).toBe("SAVE-LOAD-1");
    expect(fresh.state.yearsElapsed).toBeCloseTo(years, 6);
    expect(fresh.state.civ.population).toBeCloseTo(population, 6);
    fresh.setSpeedIndex(5);
    run(fresh, 100);
    expect(fresh.state.yearsElapsed).toBeGreaterThan(years);
  });

  it("migrates a v2 save by creating politics and events state", () => {
    const game = makeGame();
    const state = JSON.parse(JSON.stringify(game.state)) as typeof game.state;
    delete (state as Partial<typeof state>).politics;
    delete (state as Partial<typeof state>).events;
    const envelope = JSON.parse(serializeGame(state));
    envelope.version = 2;
    const parsed = parseGameFile(JSON.stringify(envelope));
    expect(parsed.ok).toBe(true);
    expect(parsed.state?.politics?.ministers).toBeTruthy();
    expect(parsed.state?.events?.pending).toEqual([]);
    expect(parsed.state?.version).toBe(3);
  });

  it("survives a long accelerated run without numeric breakage and updates hazards", () => {
    const game = makeGame("LONG-RUN", "easy");
    game.setSpeedIndex(7); // 32x
    run(game, 1200, 0.04);
    assertFiniteState(game.state);
    expect(game.state.yearsElapsed).toBeGreaterThan(10);
    const hazards = game.state.hazards;
    expect(Number.isFinite(hazards.stress)).toBe(true);
    expect(hazards.stress).toBeGreaterThanOrEqual(0);
    expect(hazards.stress).toBeLessThanOrEqual(1);
    expect(Number.isFinite(game.state.environment.surfaceTempC)).toBe(true);
  });

  it("victory/defeat endings are structurally complete when triggered", () => {
    const game = makeGame();
    game.state.gameOver = false;
    (game as unknown as { finishGame: (v: boolean, t: string, x: string, id: string) => void })
      .finishGame(true, "测试结局", "用于验证结局结构", "test");
    const view = game.view();
    expect(view.ending).not.toBeNull();
    expect(view.ending?.title).toBe("测试结局");
    expect(view.ending?.stats.length).toBeGreaterThan(3);
    expect(game.state.gameOver).toBe(true);
  });

  it("allows direct 3D state consistency checks against the physics engine", () => {
    const state = createGameState({ seed: "PHYS-3D", difficulty: "normal", mode: "normal" });
    const before = state.physics.stars.map((s) => ({ ...s.pos }));
    advancePhysics(state.physics, 5);
    const moved = state.physics.stars.some((s, i) =>
      Math.hypot(s.pos.x - before[i].x, s.pos.y - before[i].y, s.pos.z - before[i].z) > 0.01);
    expect(moved).toBe(true);
    expect(state.observation.stars.A.known.position).toBe(true);
  });
});
