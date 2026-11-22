#!/usr/bin/env node
// Focused re-check of the acceptance items that failed only because of the
// unstable main-suite browser session (CDP cascade timeouts / stale screen).
// Run after the full suite: node tests/e2e/run-subset.mjs --url http://127.0.0.1:5199/
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BrowserSession, waitForServer, sleep } from "./lib/cdp.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg("url", "http://127.0.0.1:5199/").replace(/\/$/, "") + "/";
const OUT = arg("out", "artifacts/e2e");
const DL = OUT + "/downloads";
const FIX = OUT + "/fixtures";
const results = [];
const layoutMetrics = {};
let passed = 0, failed = 0;
let session = null;
const notes = [];

const assert = (c, m) => { if (!c) throw new Error(m); };
const finite = (v, l) => assert(typeof v === "number" && Number.isFinite(v), l + " not finite: " + v);
async function check(id, title, fn) {
  const t0 = Date.now();
  const rec = { id, title, ok: false, ms: 0, error: null, detail: null };
  try { rec.detail = await fn(); rec.ok = true; passed += 1; console.log("PASS  " + id + "  " + title); }
  catch (e) { rec.error = e && e.message ? e.message : String(e); failed += 1; console.log("FAIL  " + id + "  " + title + " :: " + rec.error); }
  rec.ms = Date.now() - t0;
  results.push(rec);
}
const fp = () => session.value("__QA.fp()");
const layout = () => session.value("__QA.layout()");
const chrome = () => session.value("__QA.chrome()");
const qaErrors = () => session.value("__QA.errors()");
async function shot(n) { try { return await session.shot(n); } catch (e) { notes.push("screenshot " + n + " failed: " + (e && e.message ? e.message : e)); return null; } }

async function openMenu(restart) {
  if (restart) await session.reload(); else await session.navigate(BASE);
  await session.waitFor("!!document.querySelector('.tri-menu')", { timeoutMs: 30000, label: "menu" });
  await sleep(1000);
}

await waitForServer(BASE);
await mkdir(DL, { recursive: true });
await mkdir(FIX, { recursive: true });
await writeFile(join(FIX, "corrupt.json"), "{ this is definitely not a TRISOLARIS save", "utf8");
session = await BrowserSession.launch({ outDir: OUT, prefix: "subset", port: 9344, downloadDir: DL });
const health = [];
try {
  await session.navigate(BASE + "?autostart=1&seed=QA-SUBSET&difficulty=easy&mode=normal");
  await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "autostart game" });
  await sleep(800);

  await check("X03", "autostart URL parameters boot straight into the game with requested seed/difficulty/mode", async () => {
    const f = await fp();
    assert(f.seed === "QA-SUBSET", "seed mismatch");
    assert(f.difficulty === "easy", "difficulty mismatch");
    assert(f.mode === "normal", "mode mismatch");
    return { seed: f.seed, difficulty: f.difficulty, mode: f.mode };
  });

  let exportedPath = null;
  let exportedSeed = null;
  {
    const names = (await readdir(DL).catch(() => [])).filter((n) => n.endsWith(".json"));
    if (names.length === 0) throw new Error("no previously exported save in " + DL + " (run the full suite first)");
    const parsed = JSON.parse(await readFile(join(DL, names[0]), "utf8"));
    exportedPath = join(DL, names[0]);
    exportedSeed = parsed.state.meta.seed;
    notes.push("reused exported save " + names[0] + " (seed " + exportedSeed + ") from the full suite run");
  }

  await session.navigate(BASE + "?autostart=1&seed=QA-SUBSET-LONG&difficulty=easy&mode=sandbox");
  await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "sandbox game for long run" });
  await sleep(700);
  await check("C11", "60-year accelerated simulation keeps energy/momentum stable and state finite", async () => {
    const q0 = await session.value("__QA.conserved()", { awaitPromise: true });
    const run = await session.value("__QA.longRun(60, 0.05)", { awaitPromise: true, timeout: 240000 });
    const q1 = await session.value("__QA.conserved()", { awaitPromise: true });
    const f = await fp();
    assert(!run.gameOver, "game ended during long run: " + run.endingTitle);
    assert(run.yearsDelta >= 59.999, "did not reach 60 sim years: " + run.yearsDelta);
    const energyRel = Math.abs(q1.energy - q0.energy) / Math.max(1e-12, Math.abs(q0.energy));
    const momentumDrift = Math.sqrt(Math.pow(q1.momentum[0] - q0.momentum[0], 2) + Math.pow(q1.momentum[1] - q0.momentum[1], 2) + Math.pow(q1.momentum[2] - q0.momentum[2], 2));
    finite(q0.energy, "initial energy"); finite(q1.energy, "final energy");
    assert(Number.isFinite(f.population) && f.population >= 0, "population non-finite/negative");
    assert(f.stars.every((st) => st.pos.every((x) => Number.isFinite(x))), "star position non-finite");
    assert(!run.diagnostics.overflow, "physics overflow");
    assert(energyRel < 0.01, "energy drift too large: " + energyRel);
    assert(momentumDrift < 1e-6, "momentum drift too large: " + momentumDrift);
    const out = { yearsDelta: run.yearsDelta, updates: run.updates, wallMs: run.wallMs, simYearsPerWallSecond: run.simYearsPerWallSecond, energyRel, momentumDrift, energyDriftDiag: run.diagnostics.energyDrift, overflow: run.diagnostics.overflow, population: f.population };
    await shot("long-run");
    return out;
  });

  // Layout checks on a guaranteed game screen (previous failures were caused by a lost page state).
  const layoutMetrics = {};
  for (const [w, h, id] of [[1600, 900, "L01"], [1280, 720, "L02"], [1024, 600, "L03"]]) {
    await check(id, w + "x" + h + " layout: no overflow, all chrome inside the viewport", async () => {
      const c = await chrome();
      assert(c.screen && c.screen.indexOf("tri-game") >= 0, "not on the game screen: " + c.screen);
      assert(c.hud === 1 && c.dock === 1 && c.left === 1 && c.right === 1, "chrome missing: " + JSON.stringify(c));
      await session.setViewport(w, h);
      await sleep(800);
      const l = await layout();
      assert(l && l.hud && l.dock, "layout snapshot incomplete: " + JSON.stringify(l));
      assert(l.innerWidth === w && l.innerHeight === h, "viewport override failed: " + JSON.stringify({ w: l.innerWidth, h: l.innerHeight }));
      assert(l.overflowX === false, "horizontal overflow: scrollWidth " + l.scrollWidth + " > " + l.innerWidth);
      assert(l.hudInside, "HUD outside viewport: " + JSON.stringify(l.hud));
      assert(l.dockInside, "dock outside viewport: " + JSON.stringify(l.dock));
      assert(l.leftInside, "left panel outside viewport: " + JSON.stringify(l.left));
      assert(l.rightInside, "right panel outside viewport: " + JSON.stringify(l.right));
      await shot("layout-" + w + "x" + h);
      const m = { width: w, height: h, overflowX: l.overflowX, overflowY: l.overflowY, hud: l.hud, dock: l.dock, left: l.left, right: l.right };
      layoutMetrics[w + "x" + h] = m;
      return m;
    });
  }
  await session.setViewport(1600, 900);
  await sleep(500);

  // Paused semantics (X01) on the same verified game screen.
  await check("X01", "paused game does not advance during a long idle window", async () => {
    const f0 = await fp();
    if (!f0.paused) { await session.click(".tri-hud-pause"); await sleep(400); }
    const a = await fp();
    await sleep(1400);
    const b = await fp();
    assert(a.years === b.years && a.population === b.population, "state advanced while paused");
    return { years: a.years };
  });

  // Menu save-browser import: corrupt rejected, valid accepted, 继续游戏 loads it.
  await openMenu(false);
  await check("G04", "corrupt import through the menu save browser is rejected with a message", async () => {
    await session.clickText("读取存档");
    await session.waitFor("!!document.querySelector('.tri-menu-overlay')", { label: "save browser" });
    await sleep(900);
    await session.setFileInput(".tri-menu-overlay input[type=file]", [join(FIX, "corrupt.json")]);
    await sleep(1400);
    const info = await session.value("__QA.text('.tri-save-info')");
    assert(info && info.indexOf("导入失败") >= 0, "missing failure message: " + JSON.stringify(info));
    assert((await session.value("!!__QA.game()")) === false, "corrupt import created a game");
    assert((await qaErrors()).length === 0, "page errors after corrupt import");
    return { info };
  });

  await check("G05", "valid save import through the menu save browser loads the game (recovery path)", async () => {
    assert(exportedPath, "no exported save to import");
    await session.setFileInput(".tri-menu-overlay input[type=file]", [exportedPath]);
    await sleep(2000);
    const info = await session.value("__QA.text('.tri-save-info')");
    assert(info && info.indexOf("导入成功") >= 0, "missing success message: " + JSON.stringify(info));
    const imported = await session.value("(() => { const g = __QA.game(); return g ? { seed: g.state.meta.seed, years: g.state.yearsElapsed } : null; })()");
    assert(imported && imported.seed === exportedSeed, "import did not create the expected game: " + JSON.stringify({ imported: imported, expected: exportedSeed }));
    await session.pressKey("Escape");
    await sleep(400);
    await session.clickText("继续游戏");
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "game after import" });
    await sleep(800);
    const f = await fp();
    assert(f.seed === exportedSeed, "wrong seed after continue: " + f.seed);
    await shot("imported-game");
    return { info, seed: f.seed, years: f.years };
  });

  // H01 health re-check with the inline favicon; WebGL console noise is known-non-blocking.
  await check("H01", "no uncaught page exceptions or QA runtime errors; favicon 404 gone", async () => {
    const errs = await qaErrors();
    assert(errs.length === 0, "QA runtime errors: " + JSON.stringify(errs));
    assert(session.exceptions.length === 0, "uncaught exceptions: " + JSON.stringify(session.exceptions.slice(0, 2)));
    const favicon404 = session.logEntries.filter((e) => (e.text || "").indexOf("favicon.ico") >= 0 || ((e.text || "").indexOf("404") >= 0 && (e.url || "").indexOf("favicon") >= 0));
    assert(favicon404.length === 0, "favicon 404 still present: " + JSON.stringify(favicon404));
    return { exceptions: 0, qaErrors: 0, threeContextConsoleErrors: session.console.filter((c) => c.type === "error" && c.text.indexOf("THREE.WebGLRenderer") >= 0).length };
  });

  health.push({ exceptions: session.exceptions.length, consoleErrors: session.console.filter((c) => c.type === "error").length, logErrors: session.logEntries.filter((e) => e.level === "error").length });
} catch (e) {
  console.log("SUBSET FATAL", e && e.stack ? e.stack : String(e));
  failed += 1;
} finally {
  const browserHealth = session ? session.errorsSummary() : {};
  if (session) await session.close();
  const report = { suite: "focused acceptance re-check", startedAt: new Date().toISOString(), url: BASE, results, summary: { total: results.length, passed, failed }, layoutMetrics, browserHealth, notes };
  await mkdir(OUT, { recursive: true });
  const file = join(resolve(OUT), "subset-report.json");
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log("subset checks: " + results.length + " | passed: " + passed + " | failed: " + failed);
  console.log("report: " + file);
  process.exit(failed > 0 ? 1 : 0);
}
