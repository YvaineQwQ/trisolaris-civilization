// Node-side performance benchmark for the TRISOLARIS simulation / render-data layer.
// Run with:  npx vite-node tests/e2e/node-bench.ts
// Outputs:   artifacts/e2e/node-bench.json (+ console table)
import { mkdir, writeFile } from "node:fs/promises";
import { createGameState } from "../../src/game/state";
import { Game } from "../../src/game/game";
import { setSaveStorage, MemorySaveStorage } from "../../src/save/storage";

const ITER = { update: 300, view: 200, scene: 200, scene3d: 200, state: 3 };
const OUT = "artifacts/e2e";

function stats(samples: number[]) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    n: sorted.length,
    avgMs: +(sum / sorted.length).toFixed(4),
    p50Ms: +pick(0.5).toFixed(4),
    p95Ms: +pick(0.95).toFixed(4),
    maxMs: +sorted[sorted.length - 1].toFixed(4),
  };
}

async function main() {
  setSaveStorage(new MemorySaveStorage());
  const report: Record<string, any> = { node: process.version, platform: process.platform, iter: ITER };

  const createSamples: number[] = [];
  for (let i = 0; i < ITER.state; i += 1) {
    const t0 = performance.now();
    createGameState({ seed: "BENCH-" + i, difficulty: "normal", mode: "normal" });
    createSamples.push(performance.now() - t0);
  }
  report.createGameState = { ...stats(createSamples), samplesMs: createSamples.map((x) => +x.toFixed(2)) };

  const state = createGameState({ seed: "BENCH-GAME", difficulty: "normal", mode: "normal" });
  const game = new Game(state, { onReturnToMenu: () => {}, autosaveIntervalSeconds: 0 }, { startPaused: false });
  game.setSpeedIndex(6);
  for (let i = 0; i < 120; i += 1) game.update(1 / 60);

  const updateSamples: number[] = [];
  for (let i = 0; i < ITER.update; i += 1) {
    const t0 = performance.now();
    game.update(1 / 60);
    updateSamples.push(performance.now() - t0);
  }
  report.update = { ...stats(updateSamples), speed: game.speedValue, simulatedYears: +game.state.yearsElapsed.toFixed(2) };

  const viewSamples: number[] = [];
  for (let i = 0; i < ITER.view; i += 1) {
    const t0 = performance.now();
    game.view();
    viewSamples.push(performance.now() - t0);
  }
  report.view = { ...stats(viewSamples), logEntries: game.state.log.length };

  const sceneSamples: number[] = [];
  for (let i = 0; i < ITER.scene; i += 1) {
    const t0 = performance.now();
    game.scene();
    sceneSamples.push(performance.now() - t0);
  }
  report.scene = stats(sceneSamples);

  const scene3dSamples: number[] = [];
  for (let i = 0; i < ITER.scene3d; i += 1) {
    const t0 = performance.now();
    game.scene3d();
    scene3dSamples.push(performance.now() - t0);
  }
  report.scene3d = stats(scene3dSamples);

  report.frameBudget = {
    scene2dPlusPhysicsMs: +(report.scene.avgMs + report.update.avgMs).toFixed(4),
    scene3dPlusPhysicsMs: +(report.scene3d.avgMs + report.update.avgMs).toFixed(4),
    viewAmortized10HzMs: +(report.view.avgMs / 10).toFixed(4),
    note: "scene() runs every animation frame and calls tickClock(); view() is polled at 10 Hz; both were measured in Node with the real production code.",
  };

  await mkdir(OUT, { recursive: true });
  const file = OUT + "/node-bench.json";
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log("\nwrote " + file);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
