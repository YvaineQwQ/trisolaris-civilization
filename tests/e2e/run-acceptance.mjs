#!/usr/bin/env node
/**
 * TRISOLARIS: CIVILIZATION - repeatable browser acceptance suite (headless Edge / CDP).
 *
 *   node tests/e2e/run-acceptance.mjs [--url http://127.0.0.1:5199/] [--out artifacts/e2e]
 *                                     [--port 9343] [--prefix qa] [--edge C:\path\msedge.exe]
 *
 * Requirements: a running Vite dev server (the suite imports /src/physics/nbody.ts and
 * /src/render3d/math-3d.ts inside the page to prove the physics engine drives motion).
 * Produces artifacts/e2e/<prefix>-*.png screenshots + artifacts/e2e/acceptance-report.json.
 * Exit code: 0 = every check passed, 1 = at least one failure (see report).
 */
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BrowserSession, waitForServer, sleep } from "./lib/cdp.mjs";

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const BASE = arg("url", "http://127.0.0.1:5199/");
const OUT = arg("out", "artifacts/e2e");
const PORT = Number(arg("port", "9343"));
const PREFIX = arg("prefix", "qa");
const EDGE = arg("edge", undefined);
const DOWNLOADS = OUT + "/downloads";
const FIXTURES = OUT + "/fixtures";

const report = {
  suite: "TRISOLARIS: CIVILIZATION - browser acceptance suite",
  startedAt: new Date().toISOString(),
  url: BASE,
  outDir: OUT,
  environment: {},
  results: [],
  metrics: {},
  defects: [],
  notes: [],
  screenshots: [],
  browserHealth: null,
};
let passed = 0;
let failed = 0;
let skipped = 0;
let session = null;

function log(msg) { console.log(msg); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertFinite(value, label) { assert(typeof value === "number" && Number.isFinite(value), label + " is not a finite number: " + value); }
function approx(actual, expected, tol, label) {
  assertFinite(actual, label);
  assert(Math.abs(actual - expected) <= tol, label + ": expected " + expected + " +/- " + tol + ", got " + actual);
}
function includesText(haystack, needle, label) {
  assert(typeof haystack === "string" && haystack.indexOf(needle) >= 0, label + ": missing text '" + needle + "' in " + JSON.stringify(String(haystack).slice(0, 240)));
}
function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }
function avg(list) { if (!list.length) return 0; return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }

async function check(id, title, fn, opts) {
  const o = opts || {};
  const started = Date.now();
  const rec = { id: id, title: title, ok: false, ms: 0, detail: null, error: null, knownDefect: o.defect || null };
  try {
    rec.detail = await fn();
    rec.ok = true;
    passed += 1;
    log("PASS  " + id + "  " + title);
  } catch (error) {
    rec.error = error && error.message ? error.message : String(error);
    failed += 1;
    if (o.defect) report.defects.push({ id: id, defectId: o.defect, title: title, error: rec.error });
    log("FAIL  " + id + "  " + title + "  ::  " + rec.error);
  }
  rec.ms = Date.now() - started;
  report.results.push(rec);
  return rec;
}
function skipCheck(id, title, reason) {
  skipped += 1;
  report.results.push({ id: id, title: title, ok: false, skipped: true, reason: reason, ms: 0 });
  log("SKIP  " + id + "  " + title + "  (" + reason + ")");
}

const fp = function () { return session.value("__QA.fp()"); };
const viewSnap = function () { return session.value("__QA.viewSnap()"); };
const obsSnap = function () { return session.value("__QA.obsSnap()"); };
const truthError = function () { return session.value("__QA.truthError()"); };
const uncSnap = function () { return session.value("__QA.uncertaintySnap()"); };
const chrome = function () { return session.value("__QA.chrome()"); };
const layoutSnap = function () { return session.value("__QA.layout()"); };
const qaErrors = function () { return session.value("__QA.errors()"); };

async function pauseGame() {
  const f = await fp();
  if (!f.paused) { await session.click(".tri-hud-pause"); await sleep(350); }
  return fp();
}
async function resumeGame() {
  const f = await fp();
  if (f.paused) { await session.click(".tri-hud-pause"); await sleep(350); }
  return fp();
}
async function setSpeed(index) {
  await session.click('.tri-speed-btn[data-speed="' + index + '"]');
  await sleep(250);
  return fp();
}
async function waitDownloadedJson(predicate) {
  for (let i = 0; i < 120; i += 1) {
    const names = await readdir(DOWNLOADS).catch(function () { return []; });
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      if (predicate && !predicate(name)) continue;
      const full = join(DOWNLOADS, name);
      const text = await readFile(full, "utf8").catch(function () { return ""; });
      if (text.length > 1000) return { path: full, name: name, text: text };
    }
    await sleep(250);
  }
  throw new Error("exported JSON download did not complete in " + DOWNLOADS);
}
async function openDock(kind) {
  await session.click('[data-dock="' + kind + '"]');
  await sleep(450);
  const c = await chrome();
  assert(c.modalOpen, "modal did not open for dock " + kind);
}
async function closeModal() {
  await session.clickIfPresent(".tri-modal-close");
  await sleep(300);
}
async function saveShot(name) {
  const file = await session.shot(name);
  return file;
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                              */
/* ------------------------------------------------------------------ */
async function main() {
  await waitForServer(BASE.replace(/\/$/, "") + "/", { timeoutMs: 40000 });
  await rm(DOWNLOADS, { recursive: true, force: true }).catch(function () { /* ignore */ });
  await rm(FIXTURES, { recursive: true, force: true }).catch(function () { /* ignore */ });
  await mkdir(DOWNLOADS, { recursive: true });
  await mkdir(FIXTURES, { recursive: true });
  await writeFile(join(FIXTURES, "corrupt.json"), "{ this is definitely not a TRISOLARIS save", "utf8");
  await writeFile(join(FIXTURES, "empty.json"), "", "utf8");

  session = await BrowserSession.launch({
    outDir: OUT,
    prefix: PREFIX,
    port: PORT,
    downloadDir: DOWNLOADS,
    edge: EDGE,
  });
  report.environment = {
    node: process.version,
    platform: process.platform,
    url: BASE,
    userAgent: await session.value("navigator.userAgent"),
    viewport: { width: 1600, height: 900 },
    screen: await session.value("({ w: screen.width, h: screen.height, dpr: window.devicePixelRatio })"),
    startedAt: report.startedAt,
    devServerImports: "page-side dynamic import of /src/physics/nbody.ts + /src/render3d/math-3d.ts (dev server only)",
  };

  /* ---------------- Phase 1: menu / no-save state ---------------- */
  await session.navigate(BASE);
  await sleep(1000);

  await check("S01", "main menu renders with all navigation buttons", async function () {
    const c = await chrome();
    assert(c.screen && c.screen.indexOf("tri-menu") >= 0, "menu screen not mounted: " + c.screen);
    const buttons = await session.value("Array.from(document.querySelectorAll('.tri-menu-nav button')).map(function (n) { return (n.textContent || '').trim(); })");
    for (const label of ["开始新纪元", "继续游戏", "读取存档", "游戏说明", "制作说明"]) {
      assert(buttons.some(function (b) { return b.indexOf(label) >= 0; }), "menu button missing: " + label);
    }
    assert(c.errorStrip == null, "error strip visible on fresh menu: " + c.errorStrip);
    await saveShot("01-menu");
    return { buttons: buttons };
  });

  await check("S02", "no save/no game: 继续游戏 is disabled with a clear reason", async function () {
    const state = await session.value("(() => { const b = Array.from(document.querySelectorAll('button')).find(function (n) { return (n.textContent || '').includes('继续游戏'); }); return b ? { disabled: b.disabled, title: b.title } : null; })()");
    assert(state, "continue button not found");
    assert(state.disabled === true, "continue button should be disabled without saves, got disabled=" + state.disabled);
    assert((state.title || "").length > 0, "continue button has no explanatory title");
    includesText(state.title, "没有可继续", "continue disabled reason");
    return state;
  });

  await check("S03", "读取存档 with no saves opens an empty save browser", async function () {
    await session.clickText("读取存档");
    await session.waitFor("!!document.querySelector('.tri-menu-overlay')", { label: "save browser overlay" });
    await sleep(500);
    const text = await session.value("(document.querySelector('.tri-menu-overlay') || document.body).innerText");
    includesText(text, "暂无存档", "empty save browser");
    await saveShot("02-save-browser-empty");
    await session.pressKey("Escape");
    await sleep(300);
    assert(!(await session.value("!!document.querySelector('.tri-menu-overlay')")), "save browser did not close on Escape");
    return { textHadEmptyState: true };
  });

  await check("S04", "开始新纪元 leads to the new-game setup screen (preview) ", async function () {
    await session.clickText("开始新纪元");
    await session.waitFor("!!document.querySelector('.tri-newgame')", { label: "newgame screen" });
    await sleep(500);
    const c = await session.value("({ seedInput: !!document.querySelector('input[aria-label=\"星系种子\"]'), diffCards: document.querySelectorAll('[data-difficulty]').length, modeCards: document.querySelectorAll('[data-mode]').length, startBtn: !!document.querySelector('[data-action=\"start-game\"]'), previewCanvas: (function () { const el = document.querySelector('.tri-preview-canvas'); return el ? { w: el.width, h: el.height } : null; })() })");
    assert(c.seedInput, "seed input missing");
    assert(c.diffCards === 4, "expected 4 difficulty cards, got " + c.diffCards);
    assert(c.modeCards === 4, "expected 4 mode cards, got " + c.modeCards);
    assert(c.startBtn, "start button missing");
    assert(c.previewCanvas && c.previewCanvas.w > 0, "preview canvas not sized");
    await saveShot("03-newgame");
    return c;
  });

  /* ---------------- Phase 2: new game -> game screen ---------------- */
  const NEW_SEED = "QA-E2E-2026";
  await check("N01", "galaxy preview renders for a fixed seed and enables 开始新纪元", async function () {
    await session.setInput('input[aria-label="星系种子"]', NEW_SEED);
    await sleep(500);
    await session.waitFor("(() => { const b = document.querySelector('[data-action=\"start-game\"]'); return b && !b.disabled; })()", { timeoutMs: 25000, label: "preview ready" });
    const status = await session.value("({ status: __QA.text('.tri-preview-status'), classification: __QA.text('.tri-class-name'), planet: __QA.text('.tri-preview-planet-name'), start: __QA.text('[data-action=\"start-game\"]') })");
    assert(status.status && status.status.indexOf("就绪") >= 0, "preview status not ready: " + status.status);
    assert(status.classification && status.classification.length > 1, "classification not rendered");
    assert(status.planet && status.planet.length > 1, "planet preview not rendered");
    await saveShot("04-preview-ready");
    return status;
  });

  await check("N02", "start new game -> full game screen mounted (HUD/panels/dock/2D canvas)", async function () {
    await session.click('[data-action="start-game"]');
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "game screen" });
    await sleep(900);
    const c = await chrome();
    assert(c.hud === 1 && c.dock === 1 && c.left === 1 && c.right === 1, "game chrome incomplete: " + JSON.stringify(c));
    assert(c.dockItems.length === 8, "expected 8 dock items, got " + c.dockItems.length);
    assert(c.leftTabs.length === 4 && c.rightTabs.length === 6, "tab counts wrong");
    assert(c.viewmodeButtons === 2 && c.speedButtons === 7, "view mode/speed controls wrong");
    const f = await fp();
    assert(f.seed === NEW_SEED, "seed mismatch: " + f.seed);
    assert(f.mode === "normal" && f.difficulty === "normal", "difficulty/mode mismatch");
    const canvas = await session.value("__QA.canvasInfo('#scene-canvas')");
    assert(canvas.exists && canvas.width > 0, "2D canvas not mounted: " + JSON.stringify(canvas));
    await saveShot("05-game-2d");
    return { chrome: c, fp: { seed: f.seed, years: f.years, pop: f.population } };
  });

  await check("N03", "simulation clock is running after start (1x default)", async function () {
    const f0 = await fp();
    assert(f0.paused === false, "fresh game should start unpaused");
    await sleep(700);
    const f1 = await fp();
    assert(f1.years > f0.years, "simulation time did not advance");
    assert(f1.speed === 1, "default speed should be 1x, got " + f1.speed);
    return { years: [f0.years, f1.years], speed: f1.speed };
  });

  await check("N04", "pause stops simulation time and shows the pause overlay", async function () {
    await pauseGame();
    const f0 = await fp();
    const overlay = await session.value("__QA.chrome().pauseOverlay");
    assert(f0.paused === true, "game not paused");
    assert(overlay === true, "pause overlay not visible");
    await sleep(1200);
    const f1 = await fp();
    assert(f1.years === f0.years, "time advanced while paused: " + f0.years + " -> " + f1.years);
    assert(f1.population === f0.population, "population changed while paused");
    await saveShot("06-paused");
    return { years: f0.years, overlay: overlay };
  });

  await check("N05", "1x speed control resumes the clock at ~0.25 sim-years/second", async function () {
    await setSpeed(2);
    const f0 = await fp();
    assert(f0.paused === false && f0.speed === 1, "1x did not resume: " + JSON.stringify({ paused: f0.paused, speed: f0.speed }));
    await sleep(900);
    const f1 = await fp();
    const delta = f1.years - f0.years;
    assert(delta > 0.005, "simulation barely advanced at 1x: " + delta);
    assert(delta < 0.7, "1x advanced implausibly fast: " + delta);
    report.metrics["speed1xYearsPerSecond"] = +(delta / 0.9).toFixed(3);
    return { deltaYears: +delta.toFixed(4), yearsPerSecond: report.metrics["speed1xYearsPerSecond"] };
  });

  await check("N06", "16x speed control accelerates simulation ~16x faster than 1x", async function () {
    await setSpeed(6);
    const f0 = await fp();
    assert(f0.speed === 16, "speed should be 16x, got " + f0.speed);
    await sleep(1000);
    const f1 = await fp();
    const delta = f1.years - f0.years;
    assert(delta > 0.2, "16x did not advance at all in 1s: " + delta + " years");
    assert(delta < 6.0, "16x advanced implausibly fast: " + delta);
    report.metrics["speed16xYearsPerSecond"] = +(delta / 1.0).toFixed(3);
    return { deltaYears: +delta.toFixed(4), yearsPerSecond: report.metrics["speed16xYearsPerSecond"] };
  });

  await check("N07", "结束回合 advances exactly one turn and simulation time", async function () {
    await pauseGame();
    const before = await fp();
    await session.click('button[title="结束当前回合（单步推进）"]');
    await sleep(400);
    const after = await fp();
    const turnDelta = after.turn - before.turn;
    const yearDelta = after.years - before.years;
    assert(yearDelta > 0, "end-turn did not advance simulation time (yearsDelta=" + yearDelta + ")");
    assert(turnDelta === 1, "first end-turn click should resolve exactly 1 turn, got " + turnDelta);
    return { yearsDelta: +yearDelta.toFixed(6), turnDelta: turnDelta, years: +after.years.toFixed(6), turn: after.turn };
  }, { defect: null });

  await check("N08", "repeated 结束回合 clicks never resolve turns without advancing time", async function () {
    const rows = [];
    for (let i = 0; i < 4; i += 1) {
      const before = await fp();
      await session.click('button[title="结束当前回合（单步推进）"]');
      await sleep(250);
      const after = await fp();
      rows.push({ click: i + 1, yearsDelta: +(after.years - before.years).toFixed(9), turnDelta: after.turn - before.turn, turn: after.turn, year: +after.years.toFixed(6) });
    }
    const violating = rows.filter(function (r) { return r.yearsDelta === 0 && r.turnDelta > 0; });
    assert(violating.length === 0, "free turn resolution without time advance on " + violating.length + "/" + rows.length + " clicks: " + JSON.stringify(rows));
    return { rows: rows };
  }, { defect: "BUG-1 结束回合在回合边界处可无限结算回合而不推进模拟时间" });

  /* ---------------- Phase 3: build / research / observation / observatory ---------------- */
  await check("A01", "建造 dock opens the build modal with unlocked building cards", async function () {
    await openDock("build");
    await session.waitFor("!!document.querySelector('.tri-modal-build')", { label: "build modal" });
    await sleep(400);
    const stats = await session.value("({ cards: __QA.count('[data-building]'), enabled: __QA.count('[data-action=\"start-building\"]:not([disabled])'), categories: __QA.count('[data-build-filter]') })");
    assert(stats.cards >= 10, "expected >=10 building cards, got " + stats.cards);
    assert(stats.enabled >= 1, "no affordable building to construct");
    await saveShot("07-build-modal");
    return stats;
  });

  await check("A02", "building a structure through the UI deducts resources and queues it", async function () {
    const before = await fp();
    const picked = await session.clickFirstEnabled(['[data-action="start-building"]:not([disabled])']);
    await sleep(500);
    const after = await fp();
    assert(after.queue.length >= 1, "build queue is empty after clicking 建造");
    assert(after.buildings && typeof after.buildings === "object", "building counts missing");
    const spent = Object.keys(before.resources).some(function (k) { return after.resources[k] < before.resources[k] - 0.01; });
    assert(spent, "no resources were spent by construction");
    return { picked: picked.text, queue: after.queue, before: before.resources, after: after.resources };
  });

  await check("A03", "construction progresses when time advances", async function () {
    const before = await fp();
    await setSpeed(6);
    await sleep(2600);
    await pauseGame();
    const after = await fp();
    const builtBefore = Object.keys(before.buildings).reduce(function (s, k) { return s + before.buildings[k]; }, 0);
    const builtAfter = Object.keys(after.buildings).reduce(function (s, k) { return s + after.buildings[k]; }, 0);
    const progressed = after.queue.length < before.queue.length || builtAfter > builtBefore ||
      (before.queue.length > 0 && after.queue.length > 0 && after.queue[0].turnsLeft < before.queue[0].turnsLeft);
    assert(progressed, "construction made no progress: " + JSON.stringify({ beforeQueue: before.queue, afterQueue: after.queue, builtBefore: builtBefore, builtAfter: builtAfter }));
    await closeModal();
    return { builtBefore: builtBefore, builtAfter: builtAfter, queueAfter: after.queue.length };
  });

  await check("A04", "科研 dock opens the tech tree and starts research via UI", async function () {
    await openDock("research");
    await session.waitFor("!!document.querySelector('.tri-modal-research')", { label: "research modal" });
    await sleep(600);
    const stats = await session.value("({ techs: __QA.count('[data-tech]'), enabled: __QA.count('[data-action=\"start-research\"][data-available=\"true\"]:not([disabled])'), branches: __QA.count('[data-branch]') })");
    assert(stats.techs >= 20, "expected >=20 tech nodes, got " + stats.techs);
    assert(stats.enabled >= 1, "no researchable tech available");
    const btn = await session.value("(() => { const b = document.querySelector('[data-action=\"start-research\"][data-available=\"true\"]:not([disabled])'); return b ? b.dataset.techId : null; })()");
    assert(btn, "could not read techId of the research button");
    await session.clickFirstEnabled(['[data-action="start-research"][data-available="true"]:not([disabled])']);
    await sleep(600);
    const tech = await session.value("__QA.state().tech");
    const started = tech.activeTech === btn || tech.researched.indexOf(btn) >= 0;
    assert(started, "research did not start via UI (techId=" + btn + ", activeTech=" + tech.activeTech + ")");
    await saveShot("08-research");
    await closeModal();
    return { techId: btn, activeTech: tech.activeTech, branches: stats.branches };
  });

  await check("A05", "research accumulates science when turns resolve", async function () {
    const before = await session.value("({ tech: __QA.state().tech, science: __QA.state().civ.resources.science.amount })");
    await setSpeed(6);
    await sleep(1800);
    await pauseGame();
    const after = await session.value("({ tech: __QA.state().tech, science: __QA.state().civ.resources.science.amount })");
    const progressed = after.tech.researched.length > before.tech.researched.length || after.tech.progress > before.tech.progress || after.tech.activeTech !== before.tech.activeTech;
    assert(progressed, "research made no progress: " + JSON.stringify({ before: before.tech, after: after.tech }));
    return { before: before.tech, after: after.tech };
  });

  /* L1 knowledge boundary + stale-estimate uncertainty (lead fix verification) */
  let lowLevel3d = null;
  await check("A06", "观测 tab starts an observation task via UI (energy spent)", async function () {
    await session.click('[data-tab-right="observation"]');
    await sleep(700);
    const options = await session.value("__QA.view().observation.taskOptions");
    assert(options.length >= 1, "no observation options offered");
    const energyBefore = (await fp()).resources.energy;
    await session.clickFirstEnabled(['[data-kind] [data-action="start-observation"]:not([disabled])']);
    await sleep(600);
    const o = await obsSnap();
    assert(o.activeTask, "observation task did not start");
    const energyAfter = (await fp()).resources.energy;
    assert(energyAfter < energyBefore, "observation did not consume energy (" + energyBefore + " -> " + energyAfter + ")");
    await saveShot("09-observation");
    return { activeTask: o.activeTask, energyBefore: energyBefore, energyAfter: energyAfter };
  });

  await check("A07", "observation completes and only position is known at Lv.1 (no velocity/mass leak)", async function () {
    await setSpeed(6);
    await sleep(2000);
    await pauseGame();
    const o = await obsSnap();
    assert(o.activeTask == null, "observation task still active after turns");
    assert(o.historyCount > 0, "no observation history produced");
    assert(o.measurementCount > 0, "no measurements recorded");
    const stars = ["A", "B", "C"].map(function (id) { return o.stars[id]; });
    stars.forEach(function (st) {
      assert(st.known.position === true, "position should be known at Lv.1");
      assert(st.known.velocity === false, "velocity must be unknown at Lv.1 (knowledge leak)");
      assert(st.known.mass === false, "mass must be unknown at Lv.1 (knowledge leak)");
      assertFinite(st.sigmaPos, "sigmaPos");
      assert(st.sigmaPos > 0, "sigmaPos should be positive at Lv.1");
    });
    const v = await viewSnap();
    v.observation.stars.forEach(function (st) {
      assert(st.speed === null && st.mass === null, "view leaks velocity/mass at Lv.1: " + st.id);
    });
    lowLevel3d = {
      uncertainty: await uncSnap(),
      truth: await truthError(),
      view: v,
    };
    await saveShot("10-l1-knowledge-boundary");
    return { history: o.historyCount, measurements: o.measurementCount, sigmaPos: stars.map(function (s) { return +s.sigmaPos.toFixed(4); }) };
  });

  await check("A08", "displayed position uncertainty grows with time when no velocity model exists (lead fix)", async function () {
    const before = await uncSnap();
    const viewBefore = await viewSnap();
    await setSpeed(6);
    await sleep(2600);
    await pauseGame();
    const after = await uncSnap();
    const viewAfter = await viewSnap();
    const truthAfter = await truthError();
    const sigmaBefore = before.stars2d.map(function (s) { return s.sigmaAU; });
    const sigmaAfter = after.stars2d.map(function (s) { return s.sigmaAU; });
    const grew = sigmaAfter.some(function (s, i) { return s > sigmaBefore[i] + 1e-6; });
    const viewSigmaAfter = viewAfter.observation.stars.map(function (s) { return s.sigmaPos; });
    const viewSigmaBefore = viewBefore.observation.stars.map(function (s) { return s.sigmaPos; });
    const viewGrew = viewSigmaAfter.some(function (s, i) { return s > viewSigmaBefore[i] + 1e-6; });
    const displayedRatio = ["A", "B", "C"].map(function (id) {
      const sigmaDisplayed = after.stars2d.filter(function (s) { return s.id === id; })[0].sigmaAU;
      return truthAfter.stars[id].posError / Math.max(1e-9, sigmaDisplayed);
    });
    const worst = Math.max.apply(null, displayedRatio);
    assert(grew || viewGrew, "displayed uncertainty did not grow while the game only had stale Lv.1 measurements: before=" + JSON.stringify(sigmaBefore) + " after=" + JSON.stringify(sigmaAfter) + " viewBefore=" + JSON.stringify(viewSigmaBefore) + " viewAfter=" + JSON.stringify(viewSigmaAfter));
    assert(worst < 4, "actual drift exceeded the DISPLAYED uncertainty by >4x (posError/displayedSigma=" + JSON.stringify(displayedRatio) + ")");
    report.metrics.l1Uncertainty = { sceneSigmaBefore: sigmaBefore, sceneSigmaAfter: sigmaAfter, viewSigmaBefore: viewSigmaBefore, viewSigmaAfter: viewSigmaAfter, posErrorOverDisplayedSigma: displayedRatio };
    await saveShot("11-l1-uncertainty-growth");
    return report.metrics.l1Uncertainty;
  });

  await check("A09", "observatory upgrade is blocked with a reason when prerequisites are missing", async function () {
    const before = await fp();
    const btn = await session.value("(() => { const b = document.querySelector('[data-action=\"upgrade-observatory\"]'); return b ? { disabled: b.disabled, title: b.title, text: (b.textContent || '').trim() } : null; })()");
    assert(btn, "upgrade button not found in observation panel");
    assert(btn.disabled === true, "upgrade should be blocked without prerequisite tech/resources");
    assert((btn.title || "").length > 0, "blocked upgrade button lacks an explanation");
    await session.clickIfPresent('[data-action="upgrade-observatory"]');
    await sleep(400);
    const after = await fp();
    assert(after.obsLevel === before.obsLevel, "blocked upgrade changed observatory level");
    return btn;
  });

  let upgradeInfo = null;
  await check("A10", "observatory upgrades Lv.1 -> Lv.3 through the UI (fixture-injected prerequisites)", async function () {
    await session.value("__QA.inject({ resources: { minerals: 60000, metals: 30000, energy: 30000, science: 30000 }, tech: ['astro_distance', 'astro_orbit'] })");
    await sleep(500);
    const before = await fp();
    const levels = [];
    for (let i = 0; i < 2; i += 1) {
      await session.click('[data-action="upgrade-observatory"]');
      await sleep(550);
      const f = await fp();
      levels.push(f.obsLevel);
    }
    const after = await fp();
    assert(after.obsLevel === 3, "expected observatory level 3, got " + after.obsLevel + " (levels=" + JSON.stringify(levels) + ")");
    assert(after.resources.minerals < before.resources.minerals, "upgrade did not consume minerals");
    assert(after.resources.science < before.resources.science, "upgrade did not consume science");
    upgradeInfo = { before: before.obsLevel, after: after.obsLevel, levels: levels, resources: after.resources };
    await saveShot("12-observatory-l3");
    return upgradeInfo;
  });

  await check("A11", "Lv.3 observations build a player model with a prediction envelope", async function () {
    await session.click('[data-tab-right="observation"]');
    await sleep(500);
    await setSpeed(6);
    let started = 0;
    for (let i = 0; i < 6; i += 1) {
      const clicked = await session.value("(() => { const cards = Array.from(document.querySelectorAll('[data-kind]')); const card = cards.find(function (c) { return c.dataset.kind === 'triple-joint'; }) || cards.find(function (c) { return c.dataset.kind === 'star-velocity'; }); if (!card) return 'no-card'; const b = card.querySelector('[data-action=\"start-observation\"]'); if (!b || b.disabled) return 'disabled'; b.click(); return card.dataset.kind; })()");
      if (clicked === "triple-joint" || clicked === "star-velocity") started += 1;
      await sleep(1500);
      if (started >= 6) break;
    }
    await pauseGame();
    const o = await obsSnap();
    const v = await viewSnap();
    const u = await uncSnap();
    assert(o.measurementCount > 0, "no measurements after Lv.3 observations");
    const sigmaL3 = ["A", "B", "C"].map(function (id) { return o.stars[id].sigmaPos; });
    const sigmaL1 = lowLevel3d ? lowLevel3d.view.observation.stars.map(function (s) { return s.sigmaPos; }) : null;
    report.metrics.observatory = {
      level: o.level,
      dataPoints: o.dataPoints,
      measurements: o.measurementCount,
      model: o.model,
      sigmaL3: sigmaL3,
      sigmaL1: sigmaL1,
      observedTrails2d: u.observedTrails2d,
      predictedTrails2d: u.predictedTrails2d,
      uncertaintyRings: u.rings2d,
    };
    if (sigmaL1) {
      assert(avg(sigmaL3) < avg(sigmaL1), "Lv.3 measurement sigma did not improve over Lv.1: L1=" + JSON.stringify(sigmaL1) + " L3=" + JSON.stringify(sigmaL3));
    }
    assert(o.model || v.observation.hasModel, "no player model after Lv.3 observations");
    assert(o.model && o.model.valid !== false, "player model is invalid after Lv.3 observations: " + JSON.stringify(o.model));
    await saveShot("13-l3-model");
    return report.metrics.observatory;
  });

  await check("A12", "prediction refresh produces a finite, uncertainty-bounded forecast (uncertainty grows with horizon)", async function () {
    await session.click('[data-tab-right="prediction"]');
    await sleep(700);
    const btn = await session.value("(() => { const b = document.querySelector('[data-action=\"refresh-prediction\"]'); return b ? { disabled: b.disabled, title: b.title } : null; })()");
    assert(btn && btn.disabled === false, "refresh-prediction button unavailable: " + JSON.stringify(btn));
    await session.click('[data-action="refresh-prediction"]');
    await sleep(2000);
    const v = await viewSnap();
    const p = v.prediction;
    assert(p.available === true, "prediction unavailable after refresh: " + p.reason);
    assertFinite(p.horizonYears, "prediction horizon");
    assert(p.horizonYears > 0, "prediction horizon not positive");
    assert(p.reliableYears <= p.horizonYears + 1e-6, "reliable years exceed the horizon");
    assert(p.stars.length === 3, "prediction should cover 3 stars, got " + p.stars.length);
    const bundle = await session.value("(() => { const g = __QA.game(); const pb = g.state.observation.prediction; return pb ? { horizon: pb.horizonYears, reliableFraction: pb.reliableFraction, diverged: pb.diverged, samples: pb.samples.length } : null; })()");
    assert(bundle && bundle.samples > 0, "prediction bundle has no ensemble samples");
    const u = await uncSnap();
    report.metrics.prediction = { view: { horizonYears: p.horizonYears, reliableYears: p.reliableYears, diverged: p.diverged, createdYear: p.createdYear }, bundle: bundle, observedTrails: u.observedTrails2d, predictedTrails: u.predictedTrails2d };
    await saveShot("14-prediction");
    return report.metrics.prediction;
  });

  await check("A13", "observatory dock opens the observatory panel showing the level ladder", async function () {
    await openDock("observatory");
    await session.waitFor("!!document.querySelector('.tri-modal-observatory')", { label: "observatory modal" });
    await sleep(500);
    const info = await session.value("({ steps: __QA.count('.tri-obs-step'), current: __QA.count('.tri-obs-step.is-current'), text: __QA.text('.tri-modal-observatory') })");
    assert(info.steps >= 4, "observatory ladder not rendered");
    assert(info.current >= 1, "no current-level marker in observatory ladder");
    await saveShot("15-observatory-modal");
    await closeModal();
    return { steps: info.steps, current: info.current };
  });

  /* ---------------- Phase 4: 10 forced acceptance criteria ---------------- */
  await check("C01", "2D scene and 3D scene share exactly the same celestial coordinates", async function () {
    await pauseGame();
    await session.value("__QA.game().actions.select('A')");
    await sleep(300);
    const cmp = await session.value("__QA.sceneCompare()");
    assert(cmp.starCount2d === 3 && cmp.starCount3d === 3, "expected 3 stars in both scenes");
    assert(cmp.maxStarDiff === 0, "2D/3D star positions differ by " + cmp.maxStarDiff);
    assert(cmp.planetDiff === 0, "2D/3D planet positions differ by " + cmp.planetDiff);
    assert(cmp.stars.every(function (s) { return s.sameId; }), "star ids differ between scenes");
    assert(cmp.seed2d === cmp.seed3d, "scene seeds differ");
    assert(cmp.selection2d === cmp.selection3d, "selection differs between scenes");
    report.metrics.sceneCompare = cmp;
    return { maxStarDiff: cmp.maxStarDiff, planetDiff: cmp.planetDiff, time2d: cmp.time2d, time3d: cmp.time3d };
  });

  let switchBase = null;
  await check("C02", "switching 2D -> 3D does not reset time, seed, population or selection", async function () {
    const before = await fp();
    switchBase = before;
    await session.clickText("3D", { selector: ".tri-viewmode-btn" });
    await session.waitFor("!!document.querySelector('.tri-scene3d-host:not(.tri-hidden) canvas')", { timeoutMs: 30000, label: "3D canvas" });
    await sleep(1500);
    const after = await fp();
    assert(after.years === before.years, "simulation time changed on 2D->3D switch: " + before.years + " -> " + after.years);
    assert(after.seed === before.seed, "seed changed on switch");
    assert(after.population === before.population, "population changed on switch");
    assert(after.selection === before.selection, "selection changed on switch (" + before.selection + " -> " + after.selection + ")");
    assert(JSON.stringify(after.stars) === JSON.stringify(before.stars), "physics state changed on switch");
    const activeMode = await session.value("__QA.layout().viewMode");
    assert(activeMode === "3D", "3D mode button not active, got " + activeMode);
    await saveShot("16-3d-view");
    return { years: after.years, selection: after.selection, mode: activeMode };
  });

  await check("C03", "3D auxiliary view mounts a real WebGL canvas", async function () {
    const canvas = await session.value("__QA.canvasInfo('.tri-scene3d-host canvas')");
    assert(canvas.exists, "3D canvas not found");
    assert(canvas.width > 100 && canvas.height > 100, "3D canvas has no drawing buffer: " + JSON.stringify(canvas));
    assert(canvas.webgl2 === true || canvas.webgl === true, "3D canvas has no WebGL context: " + JSON.stringify(canvas));
    const unc = await uncSnap();
    assert(unc.clouds3d.length >= 1, "3D view shows no uncertainty clouds at Lv.3");
    report.metrics.canvas3d = canvas;
    return canvas;
  });

  await check("C04", "rotating the 3D camera does not change the physics state", async function () {
    const before = await fp();
    await session.drag(".tri-scene3d-host canvas", 190, 70);
    await sleep(600);
    const after = await fp();
    assert(after.years === before.years, "camera rotation changed simulation time");
    assert(JSON.stringify(after.stars) === JSON.stringify(before.stars), "camera rotation changed star positions");
    assert(after.population === before.population, "camera rotation changed population");
    assert(after.selection === before.selection, "camera rotation changed selection");
    await saveShot("17-3d-rotated");
    const presets = await session.value("Array.from(document.querySelectorAll('.tri-3d-btn')).map(function (n) { return n.textContent.trim(); })");
    for (const label of ["俯视", "侧视", "自由", "复位"]) {
      assert(presets.indexOf(label) >= 0, "3D preset button missing: " + label);
      await session.clickText(label, { selector: ".tri-3d-btn" });
      await sleep(250);
    }
    const errs = await qaErrors();
    assert(errs.length === 0, "page errors while operating 3D presets: " + JSON.stringify(errs));
    return { years: after.years, presets: presets };
  });

  await check("C05", "switching 3D -> 2D keeps the same state and restores the 2D canvas", async function () {
    await session.clickText("2D", { selector: ".tri-viewmode-btn" });
    await sleep(800);
    const after = await fp();
    assert(after.years === switchBase.years, "simulation time changed on 3D->2D switch");
    assert(after.seed === switchBase.seed, "seed changed on switch back to 2D");
    assert(after.population === switchBase.population, "population changed on switch back to 2D");
    assert(after.selection === switchBase.selection, "selection changed on switch back to 2D");
    const activeMode = await session.value("__QA.layout().viewMode");
    assert(activeMode === "2D", "2D mode button not active after switch back, got " + activeMode);
    const host = await session.value("(() => { const h = document.querySelector('.tri-scene3d-host'); return h ? { hidden: h.classList.contains('tri-hidden'), canvases: h.querySelectorAll('canvas').length } : null; })()");
    assert(host && host.hidden === true, "3D host not hidden after switching to 2D: " + JSON.stringify(host));
    await saveShot("18-back-2d");
    return { years: after.years, mode: activeMode, host: host };
  });

  await check("C06", "different seeds generate different galaxies (preview path used by the UI)", async function () {
    const a = await session.value("__QA.preview('QA-E2E-SEED-A')", { awaitPromise: true, timeout: 60000 });
    const b = await session.value("__QA.preview('QA-E2E-SEED-B')", { awaitPromise: true, timeout: 60000 });
    assert(a && b, "preview returned null");
    assert(a.stars.length === 3 && b.stars.length === 3, "preview star count wrong");
    assert(JSON.stringify(a.stars) !== JSON.stringify(b.stars), "different seeds produced identical star systems");
    report.metrics.seedA = { classification: a.classification, stars: a.stars };
    report.metrics.seedB = { classification: b.classification, stars: b.stars };
    return { aClass: a.classification.name, bClass: b.classification.name, different: true };
  });

  await check("C07", "same seed reproduces the identical galaxy (deterministic generation)", async function () {
    const a = await session.value("__QA.preview('QA-E2E-REPRO')", { awaitPromise: true, timeout: 60000 });
    const b = await session.value("__QA.preview('QA-E2E-REPRO')", { awaitPromise: true, timeout: 60000 });
    assert(JSON.stringify(a) === JSON.stringify(b), "same seed produced different galaxy previews");
    return { classification: a.classification.name, planets: a.planet ? a.planet.name : null };
  });

  await check("C08", "3D inclination/height influences the projection and height cues", async function () {
    const f = await fp();
    const ys = f.stars.map(function (s) { return s.pos[1]; });
    const ySpread = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    const view = await viewSnap();
    const heights = view.observation.stars.map(function (s) { return s.height; });
    assert(ySpread > 0.05, "system is nearly coplanar; height cue cannot be verified (y spread=" + ySpread + ")");
    assert(view.observation.stars.some(function (s) { return typeof s.height === "number" && Math.abs(s.height) > 0.01; }), "no star has a non-zero observed height cue");
    const maxHeightDelta = Math.max.apply(null, heights) - Math.min.apply(null, heights);
    assert(maxHeightDelta > 0.01, "observed heights are identical across stars: " + JSON.stringify(heights));
    const scene = await session.value("__QA.scene3d()");
    const yFromScene = scene.stars.map(function (s) { return s.pos.y; });
    const ySpreadScene = Math.max.apply(null, yFromScene) - Math.min.apply(null, yFromScene);
    assert(ySpreadScene > 0.05, "3D scene lost the genuine vertical spread");
    const plane = await session.value("(async () => { try { const m = await import('/src/render3d/math-3d.ts'); const sc = __QA.scene3d(); const t = (sc.observedTrails || []).filter(function (x) { return x.points && x.points.length >= 3; })[0]; if (!t) return { available: false }; const fit = m.fitOrbitPlane(t.points); return { available: true, fit: fit }; } catch (e) { return { available: false, error: String(e) }; } })()", { awaitPromise: true, timeout: 30000 });
    let inclination = null;
    if (plane && plane.available && plane.fit) {
      const normal = plane.fit.normal || plane.fit.basisY || null;
      if (normal && typeof normal.y === "number") inclination = Math.asin(Math.min(1, Math.abs(normal.y)));
      report.metrics.orbitPlaneFit = plane.fit;
    }
    report.metrics.inclination = { truthYSpread: ySpread, observedHeightDelta: maxHeightDelta, sceneYSpread: ySpreadScene, fittedInclinationRad: inclination };
    return report.metrics.inclination;
  });

  await check("C09", "motion is driven by the fixed-step physics engine (replayed k steps match exactly)", async function () {
    await pauseGame();
    const s0 = await session.value("__QA.physFull()");
    const t0 = s0.timeYears;
    await setSpeed(6);
    await sleep(650);
    await pauseGame();
    const s1 = await session.value("__QA.physFull()");
    const t1 = s1.timeYears;
    const dt = s0.dtYears;
    assert(dt > 0, "physics dt missing");
    const k = Math.round((t1 - t0) / dt);
    assert(k >= 2, "too few physics steps between samples (k=" + k + ")");
    approx(t1 - t0, k * dt, Math.max(1e-9, k * dt * 1e-9), "elapsed time is not an exact multiple of physics dt");
    const replay = await session.value("__QA.replay(" + k + ", " + JSON.stringify(s0) + ")", { awaitPromise: true, timeout: 180000 });
    assert(replay.maxPosDiff < 1e-8, "replayed k steps diverge from live state (pos diff " + replay.maxPosDiff + ")");
    assert(replay.maxVelDiff < 1e-8, "replayed k steps diverge from live state (vel diff " + replay.maxVelDiff + ")");
    const moved = s0.stars.some(function (st, i) {
      const a = st.pos;
      const b = s1.stars[i].pos;
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)) > 1e-4;
    });
    assert(moved, "star positions did not change between frames");
    report.metrics.physicsReplay = { k: k, dt: dt, posDiff: replay.maxPosDiff, velDiff: replay.maxVelDiff, replayMs: replay.replayMs, moved: moved };
    return report.metrics.physicsReplay;
  });

  function dist(a, b) { return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)); }

  await check("C10", "unobserved celestial data is not leaked into the 3D scene", async function () {
    assert(lowLevel3d, "Lv.1 3D snapshot was not captured earlier");
    const u = lowLevel3d.uncertainty;
    const t = lowLevel3d.truth;
    assert(u.stars3d.length === 3, "3D scene should only know 3 stars, got " + u.stars3d.length);
    u.stars3d.forEach(function (st) {
      assert(st.known === true || st.known === false, "known flag missing in 3D scene");
      assert(st.mass === null, "3D scene leaks mass for unobserved star " + st.id + " (mass=" + st.mass + ")");
    });
    assert(u.heightDataAvailable === false, "3D view claims height data at Lv.1: " + u.heightDataAvailable);
    assert(u.predictedTrails3d === 0, "3D view shows predicted trails without a model");
    assert(u.clouds3d.length >= 1, "3D view shows no uncertainty spheres at Lv.1");
    const starA = t.stars.A;
    const sceneA = u.stars3d.filter(function (x) { return x.id === "A"; })[0];
    assert(sceneA, "3D scene missing star A");
    assert(starA.known.velocity === false && starA.known.mass === false, "low-level truth flags leaked");
    assert(starA.posError > 0.02, "3D scene seems to use the true physics position instead of the Lv.1 estimate (error=" + starA.posError + ")");
    report.metrics.lowLevel3d = { heightDataAvailable: u.heightDataAvailable, clouds: u.clouds3d, stars3d: u.stars3d, predictedTrails3d: u.predictedTrails3d };
    return report.metrics.lowLevel3d;
  });

  /* ---------------- Phase 5: save / reload / load ---------------- */
  let savedExpected = null;
  await check("F01", "UI save writes a slot and lists it (IndexedDB)", async function () {
    await pauseGame();
    savedExpected = await fp();
    await openDock("saves");
    await session.waitFor("!!document.querySelector('.tri-modal-saves')", { label: "saves modal" });
    await sleep(700);
    await session.clickText("保存当前进度", { scope: ".tri-modal-saves" });
    await sleep(1800);
    const rows = await session.value("Array.from(document.querySelectorAll('.tri-modal-saves [data-slot]')).map(function (n) { return n.dataset.slot; })");
    const slots = await session.value("__QA.listSaves()", { awaitPromise: true });
    const mine = slots.filter(function (s) { return s.seed === NEW_SEED && !s.auto; });
    assert(mine.length >= 1, "saved slot not found in IndexedDB list: " + JSON.stringify(slots.map(function (s) { return { id: s.id, seed: s.seed, auto: s.auto }; })));
    assert(rows.length >= 1, "save modal did not render any slot rows");
    report.metrics.savedSlot = { id: mine[0].id, year: mine[0].year, turn: mine[0].turn, population: mine[0].population, savedCount: slots.length };
    await saveShot("20-saves");
    await closeModal();
    return report.metrics.savedSlot;
  });

  await check("F02", "page reload preserves IndexedDB saves; load restores time/turn/population exactly", async function () {
    assert(savedExpected, "no saved snapshot to compare against");
    await session.reload();
    await session.waitFor("!!document.querySelector('.tri-menu')", { timeoutMs: 25000, label: "menu after reload" });
    await sleep(1400);
    const dbs = await session.value("(async () => { if (!indexedDB.databases) return null; const list = await indexedDB.databases(); return list.map(function (d) { return d.name; }); })()", { awaitPromise: true });
    assert(dbs && dbs.indexOf("trisolaris-db") >= 0, "IndexedDB database 'trisolaris-db' not present after reload: " + JSON.stringify(dbs));
    await session.clickText("读取存档");
    await session.waitFor("!!document.querySelector('.tri-menu-overlay')", { label: "save browser" });
    await sleep(1200);
    const rows = await session.value("Array.from(document.querySelectorAll('.tri-menu-overlay .tri-save-row')).length");
    assert(rows >= 1, "reloaded page shows no save slots");
    const loaded = await session.value("(async () => { const rows = Array.from(document.querySelectorAll('.tri-menu-overlay .tri-save-row')); const row = rows.find(function (r) { return (r.textContent || '').includes(" + JSON.stringify(NEW_SEED) + "); }); if (!row) return { ok: false, reason: 'row-missing' }; const b = Array.from(row.querySelectorAll('button')).find(function (n) { return (n.textContent || '').includes('读取'); }); if (!b) return { ok: false, reason: 'button-missing' }; b.click(); return { ok: true }; })()", { awaitPromise: true });
    assert(loaded.ok, "could not click load on the saved row: " + JSON.stringify(loaded));
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "game after load" });
    await sleep(900);
    const after = await fp();
    assert(after.seed === NEW_SEED, "loaded seed mismatch: " + after.seed);
    approx(after.years, savedExpected.years, 1e-6, "loaded simulation time");
    assert(after.turn === savedExpected.turn, "loaded turn mismatch: " + after.turn + " vs " + savedExpected.turn);
    approx(after.population, savedExpected.population, 1e-6, "loaded population");
    assert(after.paused === true, "saves should resume paused");
    report.metrics.loadedState = { seed: after.seed, years: after.years, turn: after.turn, population: after.population };
    await saveShot("21-loaded-after-reload");
    return report.metrics.loadedState;
  });

  /* ---------------- Phase 6: export / import ---------------- */
  let exported = null;
  await check("G01", "导出当前存档 downloads a valid, complete save file", async function () {
    await openDock("saves");
    await session.waitFor("!!document.querySelector('.tri-modal-saves')", { label: "saves modal" });
    await sleep(700);
    await session.clickText("导出当前存档", { scope: ".tri-modal-saves" });
    const dl = await waitDownloadedJson();
    const parsed = JSON.parse(dl.text);
    assert(parsed.format === "trisolaris-save", "wrong save format: " + parsed.format);
    assert(parsed.version === 1, "wrong save version: " + parsed.version);
    assert(parsed.state && parsed.state.meta && parsed.state.meta.seed === NEW_SEED, "exported seed mismatch");
    const current = await fp();
    approx(parsed.state.yearsElapsed, current.years, 1e-6, "exported simulation time");
    assert(parsed.state.civ && typeof parsed.state.civ.population === "number", "exported civilization state missing");
    exported = { path: dl.path, name: dl.name, bytes: dl.text.length, seed: parsed.state.meta.seed, years: parsed.state.yearsElapsed, text: dl.text };
    report.metrics.exported = { path: dl.path, name: dl.name, bytes: dl.text.length, seed: exported.seed, years: exported.years };
    return report.metrics.exported;
  });

  await check("G02", "in-game saves modal imports a JSON file selected through the UI", async function () {
    assert(exported, "no exported file available");
    const before = await fp();
    const hasInput = await session.value("!!document.querySelector('.tri-modal-saves input[type=file]')");
    assert(hasInput, "in-game save modal has no file input");
    await session.setFileInput('.tri-modal-saves input[type=file]', [exported.path]);
    await sleep(1800);
    const after = await fp();
    const info = await session.value("__QA.text('.tri-saves-info')");
    const changed = after.years !== before.years || after.seed !== before.seed;
    assert(changed, "selecting a save file in the in-game 存档 panel did nothing (no change in time/seed); info=" + JSON.stringify(info));
    return { info: info, changed: changed };
  }, { defect: "BUG-2 游戏内「导入存档文件」不会处理所选文件（缺少 change 监听，点击时立即读取空 input）" });

  await check("G03", "corrupt save text import is rejected safely (Game API path)", async function () {
    const before = await fp();
    const result = await session.value("__QA.importText('{ \"format\": \"trisolaris-save\", \"version\": 1, \"state\": { broken }')", { awaitPromise: true });
    assert(result && result.ok === false, "corrupt save text was accepted: " + JSON.stringify(result));
    const after = await fp();
    assert(after.years === before.years && after.seed === before.seed, "corrupt import changed the game state");
    const errs = await qaErrors();
    assert(errs.length === 0, "page errors after corrupt import: " + JSON.stringify(errs));
    await closeModal();
    return { ok: result.ok, stateUnchanged: true };
  });

  await check("G04", "corrupt import through the menu save browser is rejected with a message", async function () {
    await session.reload();
    await session.waitFor("!!document.querySelector('.tri-menu')", { timeoutMs: 25000, label: "menu" });
    await sleep(1200);
    await session.clickText("读取存档");
    await session.waitFor("!!document.querySelector('.tri-menu-overlay')", { label: "save browser" });
    await sleep(900);
    await session.setFileInput(".tri-menu-overlay input[type=file]", [FIXTURES + "/corrupt.json"]);
    await sleep(1300);
    const info = await session.value("__QA.text('.tri-save-info')");
    includesText(info, "导入失败", "corrupt import rejected");
    const hasGame = await session.value("!!__QA.game()");
    assert(hasGame === false, "corrupt import created a game instance");
    const rows = await session.value("Array.from(document.querySelectorAll('.tri-menu-overlay .tri-save-row')).length");
    assert(rows >= 1, "valid save slots disappeared after a failed import");
    const errs = await qaErrors();
    assert(errs.length === 0, "page errors after corrupt menu import: " + JSON.stringify(errs));
    return { info: info, hasGame: hasGame, saveRows: rows };
  });

  await check("G05", "valid save import through the menu save browser loads the game (recovery path)", async function () {
    assert(exported, "no exported file available");
    await session.setFileInput(".tri-menu-overlay input[type=file]", [exported.path]);
    await sleep(1800);
    const info = await session.value("__QA.text('.tri-save-info')");
    includesText(info, "导入成功", "valid import message");
    const imported = await session.value("(() => { const g = __QA.game(); return g ? { seed: g.state.meta.seed, years: g.state.yearsElapsed } : null; })()");
    assert(imported, "valid import did not create a game");
    assert(imported.seed === NEW_SEED, "imported game has wrong seed: " + imported.seed);
    const continueBtn = await session.value("(() => { const b = Array.from(document.querySelectorAll('button')).find(function (n) { return (n.textContent || '').includes('继续游戏'); }); return b ? { disabled: b.disabled, title: b.title } : null; })()");
    assert(continueBtn && continueBtn.disabled === false, "继续游戏 still disabled after successful import");
    await session.pressKey("Escape");
    await sleep(400);
    await session.clickText("继续游戏");
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "game after import+continue" });
    await sleep(800);
    const f = await fp();
    assert(f.seed === NEW_SEED, "game after import has wrong seed: " + f.seed);
    report.metrics.importedGame = { seed: f.seed, years: f.years, info: info };
    await saveShot("22-imported-game");
    return report.metrics.importedGame;
  });

  /* ---------------- Phase 7: layout / window sizes ---------------- */
  async function layoutCheck(width, height, shotName) {
    await session.setViewport(width, height);
    await sleep(700);
    const l = await layoutSnap();
    assert(l.innerWidth === width && l.innerHeight === height, "viewport override failed: " + JSON.stringify({ w: l.innerWidth, h: l.innerHeight }));
    assert(l.overflowX === false, "horizontal overflow at " + width + "x" + height + ": scrollWidth " + l.scrollWidth + " > innerWidth " + l.innerWidth);
    assert(l.hudInside, "HUD exceeds the viewport at " + width + "x" + height + ": " + JSON.stringify(l.hud));
    assert(l.dockInside, "dock exceeds the viewport at " + width + "x" + height + ": " + JSON.stringify(l.dock));
    if (l.left) assert(l.left.x >= -2, "left panel starts outside the viewport at " + width + "x" + height);
    if (l.right) assert(l.right.right <= width + 2, "right panel overflows the viewport at " + width + "x" + height);
    assert(l.canvas && l.canvas.w > 0 && l.canvas.h > 0, "scene canvas has no size at " + width + "x" + height);
    await saveShot(shotName);
    return { width: width, height: height, overflowX: l.overflowX, overflowY: l.overflowY, hud: l.hud, dock: l.dock, left: l.left, right: l.right, scrollWidth: l.scrollWidth };
  }

  await check("L01", "1600x900 layout: no overflow, all chrome inside the viewport", async function () {
    const r = await layoutCheck(1600, 900, "23-layout-1600x900");
    report.metrics.layout1600 = r;
    return r;
  });

  await check("L02", "1280x720 layout: no overflow, all chrome inside the viewport", async function () {
    const r = await layoutCheck(1280, 720, "24-layout-1280x720");
    report.metrics.layout1280 = r;
    return r;
  });

  await check("L03", "low-end 1024x600 window: no overflow and the HUD/dock remain usable", async function () {
    const r = await layoutCheck(1024, 600, "25-layout-1024x600");
    const c = await chrome();
    assert(c.hud === 1 && c.dock === 1 && c.left === 1 && c.right === 1, "chrome missing at low-end size");
    report.metrics.layout1024 = r;
    return r;
  });

  await session.setViewport(1600, 900);
  await sleep(600);

  /* ---------------- Phase 8: edge cases ---------------- */
  await check("X01", "paused game does not advance during a long idle window (post-load)", async function () {
    await pauseGame();
    const a = await fp();
    await sleep(1400);
    const b = await fp();
    assert(a.years === b.years && a.population === b.population, "state advanced while paused: " + JSON.stringify({ a: a.years, b: b.years, pa: a.population, pb: b.population }));
    return { years: a.years };
  });

  await check("X02", "rapid repeated clicking of speed/dock/view controls does not break the UI", async function () {
    const before = await fp();
    await session.value("(() => { const sp = Array.from(document.querySelectorAll('.tri-speed-btn')); for (let i = 0; i < 40; i += 1) { sp[i % sp.length].click(); } const docks = Array.from(document.querySelectorAll('[data-dock]')); for (let i = 0; i < 10; i += 1) { docks[i % docks.length].click(); } return true; })()");
    await sleep(700);
    await session.pressKey("Escape");
    await sleep(500);
    for (let i = 0; i < 2; i += 1) {
      await session.clickText("3D", { selector: ".tri-viewmode-btn" });
      await sleep(500);
      await session.clickText("2D", { selector: ".tri-viewmode-btn" });
      await sleep(400);
    }
    await sleep(700);
    const after = await fp();
    assert(after && Number.isFinite(after.years), "game state corrupted after rapid clicking");
    assert(after.seed === before.seed, "seed changed after rapid clicking");
    const errs = await qaErrors();
    assert(errs.length === 0, "page errors after rapid clicking: " + JSON.stringify(errs));
    const c = await chrome();
    assert(c.hud === 1 && c.dock === 1, "UI chrome lost after rapid clicking: " + JSON.stringify(c));
    await saveShot("26-rapid-clicks");
    return { years: after.years, errors: errs.length };
  });

  await check("X03", "autostart URL parameters boot straight into the game with the requested seed/difficulty/mode", async function () {
    await session.navigate(BASE.replace(/\/$/, "") + "/?autostart=1&seed=QA-E2E-AUTO&difficulty=hard&mode=survival");
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "autostart game" });
    await sleep(700);
    const f = await fp();
    assert(f.seed === "QA-E2E-AUTO", "autostart seed mismatch: " + f.seed);
    assert(f.difficulty === "hard", "autostart difficulty mismatch: " + f.difficulty);
    assert(f.mode === "survival", "autostart mode mismatch: " + f.mode);
    await saveShot("27-autostart");
    return { seed: f.seed, difficulty: f.difficulty, mode: f.mode };
  });

  /* ---------------- Phase 9: determinism via real game creation ---------------- */
  await check("C07b", "creating two games with the same seed yields identical physics/civilization state", async function () {
    const a = await session.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 90000 });
    const b = await session.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 90000 });
    assert(a && b, "newGame returned null");
    const strip = function (f) { return JSON.stringify({ stars: f.stars, planet: f.planet, population: f.population, resources: f.resources, seed: f.seed, obsLevel: f.obsLevel }); };
    assert(strip(a) === strip(b), "same seed produced different initial state");
    return { seed: a.seed, population: a.population, obsLevel: a.obsLevel };
  });

  await check("C06b", "creating a game with a different seed yields a different galaxy", async function () {
    const a = await session.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 90000 });
    const c = await session.value("__QA.newGame('QA-E2E-DET-OTHER')", { awaitPromise: true, timeout: 90000 });
    assert(JSON.stringify(a.stars) !== JSON.stringify(c.stars), "different seeds produced identical physics state");
    return { seedA: a.seed, seedB: c.seed };
  });

  /* ---------------- Phase 10: performance ---------------- */
  await check("P00", "headless rAF baseline on the main menu (software-renderer calibration)", async function () {
    await session.navigate(BASE);
    await session.waitFor("!!document.querySelector('.tri-menu')", { timeoutMs: 25000, label: "menu for perf baseline" });
    await sleep(900);
    const baseline = await session.value("__QA.rafPerf(3000)", { awaitPromise: true, timeout: 30000 });
    assert(baseline.frames > 0, "no animation frames on the menu");
    assert(baseline.fps > 0, "menu rAF fps <= 0");
    report.metrics.rafBaselineMenu = baseline;
    return baseline;
  });

  await check("P01", "2D view: >=5s frame-rate / simulation-throughput benchmark", async function () {
    await session.navigate(BASE.replace(/\/$/, "") + "/?autostart=1&seed=QA-E2E-PERF&difficulty=easy&mode=normal");
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "perf game" });
    await sleep(800);
    await setSpeed(6);
    await sleep(400);
    const perf = await session.value("__QA.perf(5000)", { awaitPromise: true, timeout: 40000 });
    assert(perf.frames > 0, "no animation frames counted");
    assert(perf.fps > 0, "measured fps <= 0");
    assert(perf.yearsPerSecond > 0.01, "simulation did not advance during the benchmark");
    report.metrics.perf2d = perf;
    await saveShot("28-perf-2d");
    return perf;
  });

  await check("P02", "3D view: >=5s frame-rate / simulation-throughput benchmark", async function () {
    await session.clickText("3D", { selector: ".tri-viewmode-btn" });
    await session.waitFor("!!document.querySelector('.tri-scene3d-host:not(.tri-hidden) canvas')", { timeoutMs: 30000, label: "3D canvas for perf" });
    await sleep(2000);
    const perf = await session.value("__QA.perf(5000)", { awaitPromise: true, timeout: 40000 });
    assert(perf.frames > 0 && perf.fps > 0, "no frames in 3D benchmark");
    assert(perf.yearsPerSecond > 0.01, "simulation did not advance during the 3D benchmark");
    const canvas = await session.value("__QA.canvasInfo('.tri-scene3d-host canvas')");
    assert(canvas.exists && (canvas.webgl2 === true || canvas.webgl === true), "3D canvas not WebGL during benchmark");
    report.metrics.perf3d = perf;
    await saveShot("29-perf-3d");
    return perf;
  });

  /* Long-run numerical stability (deterministic, independent of headless FPS) */
  await check("C11", "60-year accelerated simulation keeps energy/momentum stable and state finite", async function () {
    await session.navigate(BASE.replace(/\/$/, "") + "/?autostart=1&seed=QA-E2E-LONGRUN&difficulty=easy&mode=normal");
    await session.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "long-run game" });
    await sleep(800);
    const q0 = await session.value("__QA.conserved()", { awaitPromise: true });
    const run = await session.value("__QA.longRun(60, 0.05)", { awaitPromise: true, timeout: 240000 });
    const q1 = await session.value("__QA.conserved()", { awaitPromise: true });
    const f = await fp();
    assert(!run.gameOver, "game ended during the long run: " + run.endingTitle);
    assert(run.yearsDelta >= 59.999, "long run did not reach 60 simulated years: " + run.yearsDelta);
    const energyRel = Math.abs(q1.energy - q0.energy) / Math.max(1e-12, Math.abs(q0.energy));
    const momentumDrift = Math.sqrt(Math.pow(q1.momentum[0] - q0.momentum[0], 2) + Math.pow(q1.momentum[1] - q0.momentum[1], 2) + Math.pow(q1.momentum[2] - q0.momentum[2], 2));
    assertFinite(q0.energy, "initial energy");
    assertFinite(q1.energy, "final energy");
    assert(Number.isFinite(f.population) && f.population >= 0, "population became non-finite/negative");
    assert(f.stars.every(function (st) { return st.pos.every(function (x) { return Number.isFinite(x); }); }), "star position became non-finite");
    assert(!run.diagnostics.overflow, "physics overflow flag set");
    assert(energyRel < 0.01, "relative energy drift too large: " + energyRel);
    assert(momentumDrift < 1e-6, "momentum drift too large: " + momentumDrift);
    report.metrics.longRun = {
      yearsDelta: run.yearsDelta,
      updates: run.updates,
      wallMs: run.wallMs,
      simYearsPerWallSecond: run.simYearsPerWallSecond,
      energyRel: energyRel,
      momentumDrift: momentumDrift,
      energyDriftDiag: run.diagnostics.energyDrift,
      overflow: run.diagnostics.overflow,
      population: f.population,
    };
    await saveShot("19-long-run");
    return report.metrics.longRun;
  });

  /* ---------------- Health summary ---------------- */
  report.browserHealth = session.errorsSummary();
  report.browserHealth.qaErrors = await qaErrors();
  report.browserHealth.dialogs = session.dialogs || 0;
  const allowText = function (text) {
    return text.indexOf("favicon.ico") >= 0
      || text.indexOf("THREE.WebGLRenderer") >= 0
      || text.indexOf("Failed to load resource") >= 0;
  };
  const badConsole = report.browserHealth.consoleErrors.filter(function (text) { return !allowText(text); });
  const badLogs = report.browserHealth.logErrors.filter(function (entry) {
    return !allowText((entry.text || "") + " " + (entry.url || ""));
  });
  const badRequests = report.browserHealth.failedRequests.filter(function (r) {
    return !((r.error || "") === "net::ERR_ABORTED" || (r.error || "").indexOf("favicon.ico") >= 0);
  });
  const threeContextErrors = report.browserHealth.consoleErrors.filter(function (text) { return text.indexOf("THREE.WebGLRenderer") >= 0; });
  if (threeContextErrors.length > 0) {
    report.defects.push({
      id: "H01-3D-console",
      defectId: "BUG-3 (Minor) 3D 渲染器初始化时打印 WebGL context console.error，但 3D 画面随后正常挂载",
      title: "THREE.WebGLRenderer console error during 3D init",
      error: threeContextErrors.join(" | "),
    });
    report.notes.push("BUG-3: 3D 初始化时出现 " + threeContextErrors.length + " 条 THREE WebGL context console.error；WebGL2 canvas 仍然成功挂载并渲染（见 C03/P02 与截图），判断为上下文探测/重试产生的噪音，建议 3D 渲染器首次建树时消除或降级为 warn。");
  }
  report.notes.push("网络：favicon.ico 404 与一次 Image net::ERR_ABORTED（切换界面时中断的装饰图请求）为已知非功能性问题，已加入允许列表。");
  report.browserHealth.unexpectedConsoleErrors = badConsole;
  report.browserHealth.unexpectedLogErrors = badLogs;
  report.browserHealth.unexpectedFailedRequests = badRequests;

  await check("H01", "no uncaught page exceptions or QA-detected runtime errors during the whole suite", async function () {
    assert(report.browserHealth.exceptions.length === 0, "uncaught exceptions: " + JSON.stringify(report.browserHealth.exceptions.slice(0, 3)));
    assert(report.browserHealth.qaErrors.length === 0, "QA runtime errors: " + JSON.stringify(report.browserHealth.qaErrors.slice(0, 5)));
    assert(badConsole.length === 0, "unexpected console errors: " + JSON.stringify(badConsole.slice(0, 5)));
    assert(badLogs.length === 0, "unexpected log errors: " + JSON.stringify(badLogs.slice(0, 5)));
    assert(badRequests.length === 0, "unexpected failed requests: " + JSON.stringify(badRequests.slice(0, 5)));
    assert(report.browserHealth.dialogs === 0, "unexpected native dialogs opened");
    return { exceptions: 0, qaErrors: 0, consoleErrorsAllowlisted: report.browserHealth.consoleErrors.length };
  });

  report.screenshots = session.screenshots.slice();
}

/* ------------------------------------------------------------------ */
try {
  await main();
} catch (error) {
  report.fatal = error && error.stack ? error.stack : String(error);
  failed += 1;
  console.error("SUITE FATAL", report.fatal);
} finally {
  if (session) {
    try { report.browserHealth = report.browserHealth || session.errorsSummary(); } catch (error) { /* ignore */ }
    try { await session.close(); } catch (error) { /* ignore */ }
  }
  report.finishedAt = new Date().toISOString();
  report.summary = {
    total: report.results.length,
    passed: passed,
    failed: failed,
    skipped: skipped,
    defects: report.defects.length,
    durationSeconds: +(((Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000).toFixed(1)),
  };
  await mkdir(OUT, { recursive: true });
  const file = join(OUT, "acceptance-report.json");
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log("");
  console.log("========== ACCEPTANCE SUMMARY ==========");
  console.log("checks: " + report.summary.total + " | passed: " + passed + " | failed: " + failed + " | skipped: " + skipped);
  console.log("duration: " + report.summary.durationSeconds + "s | report: " + file);
  if (report.defects.length > 0) {
    console.log("defects found:");
    for (const d of report.defects) console.log("  - [" + d.defectId + "] " + d.id + " " + d.title);
  }
  if (report.fatal) console.log("FATAL: " + report.fatal.split("\n")[0]);
  process.exit(failed > 0 || report.fatal ? 1 : 0);
}
