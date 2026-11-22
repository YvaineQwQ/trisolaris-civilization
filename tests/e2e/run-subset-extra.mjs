// Extra focused re-checks that failed in the main suite due to a lost page state (cascade).
// node tests/e2e/run-subset-extra.mjs --url http://127.0.0.1:5199/
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BrowserSession, waitForServer, sleep } from "./lib/cdp.mjs";
const BASE = ((process.argv.indexOf("--url") >= 0 ? process.argv[process.argv.indexOf("--url") + 1] : "http://127.0.0.1:5199/").replace(/\/$/, "")) + "/";
const OUT = "artifacts/e2e";
const results = [];
let passed = 0, failed = 0;
const assert = (c, m) => { if (!c) throw new Error(m); };
async function check(id, title, fn) {
  const rec = { id, title, ok: false, ms: 0, error: null, detail: null };
  const t0 = Date.now();
  try { rec.detail = await fn(); rec.ok = true; passed += 1; console.log("PASS  " + id + "  " + title); }
  catch (e) { rec.error = e && e.message ? e.message : String(e); failed += 1; console.log("FAIL  " + id + "  " + title + " :: " + rec.error); }
  rec.ms = Date.now() - t0;
  results.push(rec);
}
const fp = (s) => s.value("__QA.fp()");
await waitForServer(BASE);
const s = await BrowserSession.launch({ outDir: OUT, prefix: "extra", port: 9345 });
try {
  await s.navigate(BASE + "?autostart=1&seed=QA-EXTRA&difficulty=easy&mode=normal");
  await s.waitFor("!!document.querySelector('.tri-game') && !!__QA.game()", { timeoutMs: 30000, label: "game" });
  await sleep(700);

  await check("C07b", "creating two games with the same seed yields identical physics/civilization state", async () => {
    const a = await s.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 120000 });
    const b = await s.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 120000 });
    assert(a && b, "newGame returned null");
    const strip = (f) => JSON.stringify({ stars: f.stars, planet: f.planet, population: f.population, resources: f.resources, seed: f.seed, obsLevel: f.obsLevel });
    assert(strip(a) === strip(b), "same seed produced a different state");
    return { seed: a.seed, population: a.population };
  });

  await check("C06b", "creating a game with a different seed yields a different galaxy", async () => {
    const a = await s.value("__QA.newGame('QA-E2E-DET')", { awaitPromise: true, timeout: 120000 });
    const c = await s.value("__QA.newGame('QA-E2E-DET-OTHER')", { awaitPromise: true, timeout: 120000 });
    assert(JSON.stringify(a.stars) !== JSON.stringify(c.stars), "different seeds produced identical physics");
    return { seedA: a.seed, seedB: c.seed };
  });

  await check("X02", "rapid repeated clicking of speed/dock/view controls does not break the UI", async () => {
    const before = await fp(s);
    await s.value("(() => { const sp = Array.from(document.querySelectorAll('.tri-speed-btn')); for (let i = 0; i < 40; i += 1) { sp[i % sp.length].click(); } const docks = Array.from(document.querySelectorAll('[data-dock]')); for (let i = 0; i < 10; i += 1) { docks[i % docks.length].click(); } return true; })()");
    await sleep(700);
    await s.pressKey("Escape");
    await sleep(400);
    for (let i = 0; i < 2; i += 1) {
      await s.clickText("3D", { selector: ".tri-viewmode-btn" });
      await sleep(500);
      await s.clickText("2D", { selector: ".tri-viewmode-btn" });
      await sleep(400);
    }
    await sleep(600);
    const after = await fp(s);
    assert(after && Number.isFinite(after.years), "state corrupted after rapid clicking");
    assert(after.seed === before.seed, "seed changed after rapid clicking");
    const errs = await s.value("__QA.errors()");
    assert(errs.length === 0, "page errors: " + JSON.stringify(errs));
    const c = await s.value("__QA.chrome()");
    assert(c.hud === 1 && c.dock === 1, "chrome lost: " + JSON.stringify(c));
    await s.shot("rapid-clicks");
    return { years: after.years, errors: errs.length };
  });

  await check("G03", "corrupt save text import is rejected safely (Game API path)", async () => {
    const before = await fp(s);
    const r = await s.value("__QA.importText('{ definitely not a trisolari save')", { awaitPromise: true });
    assert(r && r.ok === false, "corrupt save text accepted: " + JSON.stringify(r));
    const after = await fp(s);
    assert(after.years === before.years && after.seed === before.seed, "state changed after corrupt import");
    assert((await s.value("__QA.errors()")).length === 0, "page errors after corrupt import");
    return { ok: r.ok };
  });

  await check("H01", "no uncaught exceptions / QA errors in this focused session", async () => {
    const errs = await s.value("__QA.errors()");
    assert(errs.length === 0, "qa errors: " + JSON.stringify(errs));
    assert(s.exceptions.length === 0, "exceptions: " + JSON.stringify(s.exceptions.slice(0, 2)));
    return { exceptions: 0, qaErrors: 0 };
  });
} finally {
  const browserHealth = s.errorsSummary();
  await s.close();
  await mkdir(OUT, { recursive: true });
  const report = { suite: "extra focused re-checks", url: BASE, results, summary: { total: results.length, passed, failed }, browserHealth };
  await writeFile(join(OUT, "subset-extra-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log("extra checks: " + results.length + " | passed: " + passed + " | failed: " + failed);
  process.exit(failed > 0 ? 1 : 0);
}
