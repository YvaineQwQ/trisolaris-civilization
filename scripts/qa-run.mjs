// Scenario-driven headless browser QA for TRISOLARIS.
// usage: node scripts/qa-run.mjs <url> <prefix> <scenario.json> [outDir]
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9333);
const url = process.argv[2];
const prefix = process.argv[3] || "qa";
const scenarioPath = process.argv[4];
const outDir = process.argv[5] || "artifacts";
const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path, init) {
  const res = await fetch("http://127.0.0.1:" + PORT + path, init);
  return res.json();
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const state = { id: 0, pending: new Map(), handlers: new Map() };
    ws.onopen = () => resolve({ ws, send, on });
    ws.onerror = (e) => reject(new Error("ws error " + (e?.message || "")));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && state.pending.has(msg.id)) {
        const p = state.pending.get(msg.id);
        state.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        return;
      }
      const hs = state.handlers.get(msg.method);
      if (hs) for (const fn of hs) fn(msg.params);
    };
    function send(method, params = {}) {
      const id = ++state.id;
      return new Promise((res, rej) => {
        state.pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    function on(method, fn) {
      if (!state.handlers.has(method)) state.handlers.set(method, []);
      state.handlers.get(method).push(fn);
    }
  });
}

const userDataDir = join(tmpdir(), "trisolaris-qa-" + Date.now());
await mkdir(userDataDir, { recursive: true });
await mkdir(outDir, { recursive: true });
const HEADED = process.env.QA_HEADED === "1";
const launchArgs = HEADED
  ? [
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + userDataDir,
    "--no-first-run", "--no-default-browser-check", "--window-size=1600,900",
    "--window-position=40,40", "about:blank",
  ]
  : [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + userDataDir,
    "--window-size=1600,900", "--hide-scrollbars", "about:blank",
  ];
if (HEADED) console.warn("[qa] headed mode: real GPU Edge window will open");
const browser = spawn(EDGE, launchArgs, { stdio: "ignore" });

const report = { url, scenario: scenarioPath, steps: [], console: [], exceptions: [], logEntries: [], failedRequests: [], final: null, screenshots: [] };
let wsRef = null;
try {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try { targets = await json("/json/list"); if (targets?.length) break; } catch {}
  }
  if (!targets?.length) throw new Error("no CDP target");
  const page = targets.find((t) => t.type === "page") || targets[0];
  const conn = await connect(page.webSocketDebuggerUrl);
  const { send, on, ws } = conn;
  wsRef = ws;
  on("Runtime.consoleAPICalled", (p) => report.console.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description ?? a.type).join(" ") }));
  on("Runtime.exceptionThrown", (p) => report.exceptions.push({ text: p.exceptionDetails?.text, description: p.exceptionDetails?.exception?.description, url: p.exceptionDetails?.url, line: p.exceptionDetails?.lineNumber }));
  on("Log.entryAdded", (p) => { if (p.entry && p.entry.level !== "verbose") report.logEntries.push({ level: p.entry.level, text: p.entry.text, url: p.entry.url }); });
  on("Network.loadingFailed", (p) => { if (p.type !== "Other") report.failedRequests.push({ error: p.errorText, type: p.type }); });
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__QA_ERRORS__ = []; window.addEventListener('error', e => window.__QA_ERRORS__.push('error: ' + e.message)); window.addEventListener('unhandledrejection', e => window.__QA_ERRORS__.push('rejection: ' + (e.reason && e.reason.message || e.reason)));" });
  await send("Page.navigate", { url });
  await sleep(2500);

  const evalExpr = async (expr, awaitPromise = false) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) return { error: r.exceptionDetails.text, description: r.exceptionDetails.exception?.description };
    return r.result?.value;
  };
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    const file = join(outDir, prefix + "-" + name + ".png");
    await writeFile(file, Buffer.from(s.data, "base64"));
    report.screenshots.push(file);
    return file;
  };

  for (const step of scenario.steps) {
    const rec = { ...step, ok: true };
    try {
      if (step.wait) await sleep(step.wait);
      if (step.eval) rec.result = await evalExpr(step.eval, step.awaitPromise === true);
      if (step.click) {
        rec.result = await evalExpr(`(() => { const el = document.querySelector(${JSON.stringify(step.click)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`);
        if (rec.result === "missing") rec.ok = false;
      }
      if (step.mouseBody) {
        const projection = await evalExpr(
          "(async()=>{ const url = (performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/src/render3d/index.ts'))) || '/src/render3d/index.ts'; try { const m = await import(url); const d = m.getRenderer3DDebug(); const p = d ? d.project(" + JSON.stringify(step.mouseBody) + ") : null; return p ? {x:p.x,y:p.y,visible:p.visible} : null; } catch(e) { return {error:String(e)}; } })()",
          true,
        );
        rec.result = projection;
        if (!projection || projection.visible === false || projection.error) {
          rec.ok = false;
          rec.error = "body projection unavailable";
        } else {
          const x = Math.round(projection.x);
          const y = Math.round(projection.y);
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
          await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
          await sleep(60);
          await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
          rec.result = { ...projection, clicked: true };
        }
      }
      if (step.clickText) {
        rec.result = await evalExpr(`(() => {
          const scope = ${JSON.stringify(step.scope || "document")};
          const rootEl = scope === "document" ? document : document.querySelector(scope);
          if (!rootEl) return 'scope-missing';
          const nodes = [...rootEl.querySelectorAll('button, [role="tab"], .tri-dock-btn')];
          const el = nodes.find(n => (n.textContent || '').trim().includes(${JSON.stringify(step.clickText)}));
          if (!el) return 'text-missing';
          el.click(); return 'clicked:' + (el.textContent || '').trim().slice(0, 40);
        })()`);
        if (typeof rec.result === "string" && rec.result.startsWith("text-missing")) rec.ok = false;
      }
      if (step.viewport) {
        await send("Emulation.setDeviceMetricsOverride", { width: step.viewport[0], height: step.viewport[1], deviceScaleFactor: 1, mobile: false });
        rec.result = "viewport:" + step.viewport.join("x");
        await sleep(600);
      }
      if (step.reload) {
        await send("Page.navigate", { url });
        await sleep(step.reload);
        rec.result = "reloaded";
      }
      if (step.key) {
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: step.key, code: step.key === "Escape" ? "Escape" : step.key, windowsVirtualKeyCode: step.key === "Escape" ? 27 : 32 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: step.key, code: step.key, windowsVirtualKeyCode: step.key === "Escape" ? 27 : 32 });
        rec.result = "key:" + step.key;
      }
      if (step.shot) rec.shotFile = await shot(step.shot);
      if (step.waitAfter) await sleep(step.waitAfter);
    } catch (err) {
      rec.ok = false;
      rec.error = String(err);
    }
    report.steps.push(rec);
  }

  report.final = await evalExpr(`(() => {
    const app = window.__TRISOLARIS__?.app;
    const api = app?.activeGame?.();
    let view = null;
    try { view = api ? api.view() : null; } catch (e) { view = { error: String(e) }; }
    const canvas = document.getElementById("scene-canvas");
    const host3d = document.querySelector(".tri-scene3d-host");
    return {
      hasGame: Boolean(api),
      screen: (document.querySelector(".tri-screen") || {}).className || null,
      pauseVisible: Boolean(document.querySelector(".tri-pause-overlay:not(.tri-hidden)")),
      modal: (document.querySelector(".tri-modal, .tri-modal-layer") || {}).className || null,
      bodyTextLength: (document.body.innerText || "").length,
      canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
      host3d: host3d ? { hidden: host3d.classList.contains("tri-hidden"), children: host3d.children.length } : null,
      view: view ? {
        seed: view.meta.seed, year: view.meta.year, turn: view.meta.turn, era: view.meta.era,
        paused: view.meta.paused, speed: view.meta.speedValue, running: view.meta.running,
        population: view.civ.population.total, stability: view.civ.stability.value,
        observatory: view.observatory.level, resources: view.resources.map(r => [r.id, Math.round(r.amount), Math.round(r.net)]),
        activeTech: view.civ.science.activeTechName, researchPercent: view.civ.science.percent,
        activeTask: view.observation.activeTask ? view.observation.activeTask.kindLabel + ":" + view.observation.activeTask.progress : null,
        discoveries: view.observation.discoveries.length,
        hazards: view.hazards.hazards.map(h => h.title), warnings: view.hazards.warnings.length,
        crises: view.hazards.crises.map(c => c.title),
        predictionAvailable: view.prediction.available,
        queue: view.buildings.queue.length, builtCount: view.buildings.built.length,
        alerts: view.alerts.map(a => a.title),
        ending: view.ending ? view.ending.title : null,
        logCount: view.log.length, selection: view.selection,
      } : null,
    };
  })()`);
  await shot("final");
} catch (err) {
  report.fatal = String(err);
} finally {
  try { wsRef?.close(); } catch {}
  browser.kill();
  await sleep(300);
}
console.log(JSON.stringify(report, null, 2));
process.exit(0);
