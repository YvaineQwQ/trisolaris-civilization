// Headless Edge QA driver over the Chrome DevTools Protocol.
// Usage: node scripts/qa-browser.mjs <url> <outPrefix> [--clicks "selector;selector"]
// Captures console errors, page exceptions, network failures, DOM snapshot,
// optional screenshots and returns a compact JSON report.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9333);
const url = process.argv[2] || "http://127.0.0.1:5173/";
const prefix = process.argv[3] || "qa";
const outDir = process.argv[4] || "artifacts";
const clicks = (() => {
  const i = process.argv.indexOf("--clicks");
  return i >= 0 ? process.argv[i + 1].split(";").filter(Boolean) : [];
})();
const waitMs = Number(process.env.QA_WAIT_MS || 6500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path, init) {
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
        const { resolve: res, reject: rej } = state.pending.get(msg.id);
        state.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
        return;
      }
      const list = state.handlers.get(msg.method);
      if (list) for (const fn of list) fn(msg.params);
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
const browser = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + userDataDir,
  "--window-size=1600,900", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

const report = { url, console: [], exceptions: [], logEntries: [], failedRequests: [], screenshots: [], dom: null, eval: null };
try {
  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      targets = await fetchJson("/json/list");
      if (targets && targets.length) break;
    } catch {}
  }
  if (!targets || !targets.length) throw new Error("CDP target not available");
  const page = targets.find((t) => t.type === "page") || targets[0];
  const { send, on, ws } = await connect(page.webSocketDebuggerUrl);
  on("Runtime.consoleAPICalled", (p) => {
    report.console.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description ?? a.type).join(" ") });
  });
  on("Runtime.exceptionThrown", (p) => {
    report.exceptions.push({ text: p.exceptionDetails?.text, line: p.exceptionDetails?.lineNumber, url: p.exceptionDetails?.url, description: p.exceptionDetails?.exception?.description });
  });
  on("Log.entryAdded", (p) => {
    if (p.entry && (p.entry.level === "error" || p.entry.level === "warning")) {
      report.logEntries.push({ level: p.entry.level, text: p.entry.text, url: p.entry.url });
    }
  });
  on("Network.loadingFailed", (p) => report.failedRequests.push({ error: p.errorText, type: p.type }));
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(waitMs);
  for (const sel of clicks) {
    const r = await send("Runtime.evaluate", { expression: `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`, returnByValue: true, awaitPromise: true });
    report.console.push({ type: "qa-click", text: sel + " => " + JSON.stringify(r.result?.value) });
    await sleep(900);
  }
  const evalRes = await send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.getElementById("ui-root");
      const game = window.__TRISOLARIS__?.app?.activeGame?.();
      const view = (() => { try { return game ? game.view() : null; } catch (e) { return { error: String(e) }; } })();
      return {
        title: document.title,
        uiRootChildren: root ? root.children.length : -1,
        bodyText: (document.body.innerText || "").slice(0, 1200),
        canvas: (() => { const c = document.getElementById("scene-canvas"); return c ? { w: c.width, h: c.height, visibility: c.style.visibility } : null; })(),
        hasGame: Boolean(game),
        view: view ? {
          seed: view.meta?.seed, turn: view.meta?.turn, era: view.meta?.era,
          population: view.civ?.population?.total,
          observatory: view.observatory?.level,
          resources: view.resources?.length,
          logLength: view.log?.length,
          selection: view.selection,
        } : null,
        consoles: [],
        canvasDataUrl: (() => {
          try {
            const c = document.getElementById("scene-canvas");
            if (!c) return null;
            return c.toDataURL ? c.toDataURL("image/png").slice(0, 64) : null;
          } catch (e) { return "error:" + String(e); }
        })(),
      };
    })()`,
    returnByValue: true, awaitPromise: true,
  });
  report.eval = evalRes.result?.value ?? null;
  const domRes = await send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true });
  const html = domRes.result?.value ?? "";
  await writeFile(join(outDir, prefix + "-dom.html"), html, "utf8");
  report.dom = { length: html.length, hasUiRoot: html.includes("ui-root") };
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(outDir, prefix + ".png");
  await writeFile(file, Buffer.from(shot.data, "base64"));
  report.screenshots.push(file);
  ws.close();
} catch (err) {
  report.fatal = String(err);
} finally {
  browser.kill();
  await sleep(300);
}
console.log(JSON.stringify(report, null, 2));
process.exit(0);
