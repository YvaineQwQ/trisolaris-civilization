// Headless-Edge CDP driver for the TRISOLARIS acceptance suite.
// Dependency-free: uses Node's built-in fetch + WebSocket. Windows/Edge by default;
// EDGE_PATH and --port can point at any Chromium build.
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const DEFAULT_EDGE = process.env.EDGE_PATH
  || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const EDGE_ARGS = [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-extensions",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
];

const HELPERS_URL = new URL("./qa-helpers.js", import.meta.url);

function connect(wsUrl) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(wsUrl);
    const state = { id: 0, pending: new Map(), handlers: new Map(), closed: false };
    ws.onopen = () => resolvePromise({ ws, send, on, isClosed: () => state.closed });
    ws.onerror = (e) => reject(new Error("CDP websocket error: " + (e && e.message ? e.message : String(e))));
    ws.onclose = () => {
      state.closed = true;
      for (const p of state.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("CDP websocket closed"));
      }
      state.pending.clear();
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && state.pending.has(msg.id)) {
        const p = state.pending.get(msg.id);
        state.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error("CDP error: " + JSON.stringify(msg.error)));
        else p.resolve(msg.result);
        return;
      }
      const list = state.handlers.get(msg.method);
      if (list) {
        for (const fn of list) {
          try { fn(msg.params); } catch { /* listener errors are non-fatal */ }
        }
      }
    };
    function send(method, params, timeoutMs) {
      if (state.closed) return Promise.reject(new Error("CDP session closed"));
      const ttl = timeoutMs == null ? 60000 : timeoutMs;
      const id = ++state.id;
      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          state.pending.delete(id);
          rej(new Error("CDP timeout: " + method));
        }, ttl);
        state.pending.set(id, { resolve: res, reject: rej, timer });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
    function on(method, fn) {
      if (!state.handlers.has(method)) state.handlers.set(method, []);
      state.handlers.get(method).push(fn);
    }
  });
}

export class BrowserSession {
  constructor(opts) {
    this.opts = opts;
    this.outDir = opts.outDir;
    this.prefix = opts.prefix || "qa";
    this.console = [];
    this.exceptions = [];
    this.logEntries = [];
    this.failedRequests = [];
    this.screenshots = [];
  }

  static async launch(options) {
    const o = options || {};
    const opts = {
      edge: o.edge || DEFAULT_EDGE,
      port: o.port || 9341,
      width: o.width || 1600,
      height: o.height || 900,
      outDir: o.outDir || "artifacts/e2e",
      prefix: o.prefix || "qa",
      downloadDir: o.downloadDir || null,
    };
    const session = new BrowserSession(opts);
    await mkdir(resolve(opts.outDir), { recursive: true });
    if (opts.downloadDir) await mkdir(resolve(opts.downloadDir), { recursive: true });
    const userDataDir = join(tmpdir(), "trisolaris-e2e-" + Date.now() + "-" + Math.floor(Math.random() * 1e6));
    await mkdir(userDataDir, { recursive: true });
    session.userDataDir = userDataDir;
    session.browser = spawn(opts.edge, EDGE_ARGS.concat([
      "--remote-debugging-port=" + opts.port,
      "--user-data-dir=" + userDataDir,
      "--window-size=" + opts.width + "," + opts.height,
      "about:blank",
    ]), { stdio: "ignore", windowsHide: true });
    session.browser.on("error", (e) => session.console.push({ type: "qa", text: "browser spawn error " + e.message }));

    let targets = null;
    let lastErr = "";
    for (let i = 0; i < 100; i += 1) {
      await sleep(200);
      try {
        const res = await fetch("http://127.0.0.1:" + opts.port + "/json/list", { signal: AbortSignal.timeout(1000) });
        targets = await res.json();
        if (targets && targets.length) break;
      } catch (e) {
        lastErr = String(e && e.message ? e.message : e);
      }
    }
    if (!targets || !targets.length) {
      await session.close();
      throw new Error("CDP target not available on port " + opts.port + " (" + lastErr + "). Is another Edge QA run using this port?");
    }
    const page = targets.find((t) => t.type === "page") || targets[0];
    const conn = await connect(page.webSocketDebuggerUrl);
    session.conn = conn;
    session.send = conn.send;
    session.on = conn.on;

    session.on("Runtime.consoleAPICalled", (p) => {
      const text = p.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(" ");
      session.console.push({ type: p.type, text });
      if (session.console.length > 800) session.console.splice(0, session.console.length - 800);
    });
    session.on("Runtime.exceptionThrown", (p) => {
      session.exceptions.push({
        text: p.exceptionDetails && p.exceptionDetails.text,
        description: p.exceptionDetails && p.exceptionDetails.exception && p.exceptionDetails.exception.description,
        url: p.exceptionDetails && p.exceptionDetails.url,
        line: p.exceptionDetails && p.exceptionDetails.lineNumber,
      });
    });
    session.on("Log.entryAdded", (p) => {
      if (p.entry && (p.entry.level === "error" || p.entry.level === "warning")) {
        session.logEntries.push({ level: p.entry.level, text: p.entry.text, url: p.entry.url });
      }
    });
    session.on("Network.loadingFailed", (p) => {
      if (p.type !== "Other" && p.type !== "Ping") session.failedRequests.push({ error: p.errorText, type: p.type });
    });
    session.on("Page.javascriptDialogOpening", () => {
      session.dialogs = (session.dialogs || 0) + 1;
    });

    await session.send("Runtime.enable");
    await session.send("Log.enable");
    await session.send("Page.enable");
    await session.send("Network.enable");
    await session.send("DOM.enable");
    const helpersSource = await readFile(HELPERS_URL, "utf8");
    await session.send("Page.addScriptToEvaluateOnNewDocument", { source: helpersSource });
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: opts.width, height: opts.height, deviceScaleFactor: 1, mobile: false,
    });
    if (opts.downloadDir) {
      try {
        await session.send("Browser.setDownloadBehavior", {
          behavior: "allow", downloadPath: resolve(opts.downloadDir), eventsEnabled: true,
        });
      } catch (e) {
        session.console.push({ type: "qa", text: "download behavior not set: " + e.message });
      }
    }
    return session;
  }

  async eval(expression, options) {
    const o = options || {};
    let res;
    try {
      res = await this.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: o.awaitPromise === true,
        userGesture: true,
      }, o.timeout == null ? 30000 : o.timeout);
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
    if (res.exceptionDetails) {
      return {
        ok: false,
        error: (res.exceptionDetails.exception && res.exceptionDetails.exception.description)
          || res.exceptionDetails.text || "page exception",
      };
    }
    return { ok: true, value: res.result ? res.result.value : undefined };
  }

  async value(expression, options) {
    const r = await this.eval(expression, options);
    if (!r.ok) throw new Error("page eval failed: " + r.error + " :: " + expression.slice(0, 200));
    return r.value;
  }

  async waitFor(expression, options) {
    const o = options || {};
    const timeoutMs = o.timeoutMs == null ? 15000 : o.timeoutMs;
    const intervalMs = o.intervalMs == null ? 120 : o.intervalMs;
    const label = o.label || expression;
    const start = Date.now();
    let lastError = null;
    let lastValue;
    while (Date.now() - start < timeoutMs) {
      const r = await this.eval(expression);
      if (r.ok) {
        lastValue = r.value;
        if (r.value) return r.value;
      } else {
        lastError = r.error;
      }
      await sleep(intervalMs);
    }
    const detail = lastError ? " last error: " + lastError : " last value: " + JSON.stringify(lastValue).slice(0, 200);
    throw new Error("waitFor timeout (" + label + ")" + detail);
  }

  async navigate(url) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const loaded = new Promise((res) => {
          const handler = () => res();
          this.on("Page.loadEventFired", handler);
          setTimeout(res, 45000);
        });
        await this.send("Page.navigate", { url }, 60000);
        await loaded;
        await this.waitFor("!!window.__TRISOLARIS__ && !!window.__TRISOLARIS__.app", { timeoutMs: 45000, label: "app bootstrap" });
        await sleep(350);
        return this;
      } catch (e) {
        lastError = e;
        await sleep(1500);
      }
    }
    throw new Error("navigation failed: " + url + " :: " + (lastError && lastError.message ? lastError.message : String(lastError)));
  }

  async reload() {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const loaded = new Promise((res) => {
          const handler = () => res();
          this.on("Page.loadEventFired", handler);
          setTimeout(res, 45000);
        });
        await this.send("Page.reload", { ignoreCache: false }, 60000);
        await loaded;
        await this.waitFor("!!window.__TRISOLARIS__ && !!window.__TRISOLARIS__.app", { timeoutMs: 45000, label: "app bootstrap after reload" });
        await sleep(450);
        return;
      } catch (e) {
        lastError = e;
        await sleep(1500);
      }
    }
    throw new Error("reload failed :: " + (lastError && lastError.message ? lastError.message : String(lastError)));
  }

  async shot(name) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 82, captureBeyondViewport: false }, 60000);
        const file = resolve(this.outDir, this.prefix + "-" + name + ".jpg");
        await writeFile(file, Buffer.from(res.data, "base64"));
        this.screenshots.push(file);
        return file;
      } catch (e) {
        lastError = e;
        await sleep(500 * attempt);
      }
    }
    throw new Error("screenshot failed (" + name + "): " + (lastError && lastError.message ? lastError.message : String(lastError)));
  }

  async click(selector) {
    const r = await this.value("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return { ok: false, reason: 'missing' }; if (el.disabled) return { ok: false, reason: 'disabled' }; el.click(); return { ok: true, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 60) }; })()");
    if (!r.ok) throw new Error("click " + selector + " failed: " + r.reason);
    return r;
  }

  async clickIfPresent(selector) {
    return this.value("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el || el.disabled) return false; el.click(); return true; })()");
  }

  async clickText(text, options) {
    const o = options || {};
    const scope = o.scope || null;
    const selector = o.selector || "button";
    const rootExpr = scope ? "document.querySelector(" + JSON.stringify(scope) + ")" : "document";
    const r = await this.value("(() => { const root = " + rootExpr + "; if (!root) return { ok: false, reason: 'scope-missing' }; const nodes = Array.from(root.querySelectorAll(" + JSON.stringify(selector) + ")); const el = nodes.find((n) => !n.disabled && (n.textContent || '').trim().includes(" + JSON.stringify(text) + ")); if (!el) return { ok: false, reason: 'text-missing' }; el.click(); return { ok: true, text: (el.textContent || '').trim().slice(0, 80) }; })()");
    if (!r.ok) throw new Error("clickText '" + text + "' failed: " + r.reason);
    return r;
  }

  async clickFirstEnabled(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const r = await this.value("(() => { const sels = " + JSON.stringify(list) + "; for (const sel of sels) { const nodes = Array.from(document.querySelectorAll(sel)); for (const el of nodes) { if (el.disabled) continue; el.click(); return { ok: true, selector: sel, text: (el.textContent || '').trim().slice(0, 80) }; } } return { ok: false }; })()");
    if (!r.ok) throw new Error("clickFirstEnabled failed: " + JSON.stringify(list));
    return r;
  }

  async setInput(selector, value) {
    const r = await this.value("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return { ok: false, reason: 'missing' }; const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value').set; setter.call(el, " + JSON.stringify(value) + "); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true, value: el.value }; })()");
    if (!r.ok) throw new Error("setInput " + selector + " failed: " + r.reason);
    return r;
  }

  async pressKey(key, options) {
    const o = options || {};
    const c = o.code || (key === "Escape" ? "Escape" : key === "Enter" ? "Enter" : key === " " ? "Space" : "Key" + key.toUpperCase());
    const vk = o.keyCode || (key === "Escape" ? 27 : key === "Enter" ? 13 : key === " " ? 32 : key.toUpperCase().charCodeAt(0));
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: c, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: c, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }

  async drag(selector, dx, dy, options) {
    const o = options || {};
    const steps = o.steps == null ? 10 : o.steps;
    const yOffset = o.yOffset == null ? 0 : o.yOffset;
    const rect = await this.value("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()");
    if (!rect || rect.w < 2 || rect.h < 2) throw new Error("drag target not visible: " + selector);
    const x = Math.round(rect.x + rect.w / 2);
    const y = Math.round(rect.y + rect.h / 2 + yOffset);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= steps; i += 1) {
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Math.round(x + (dx * i) / steps),
        y: Math.round(y + (dy * i) / steps),
        button: "left",
        buttons: 1,
      });
      await sleep(12);
    }
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button: "left", buttons: 0, clickCount: 1 });
    await sleep(150);
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(450);
  }

  async setFileInput(selector, files) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const doc = await this.send("DOM.getDocument", { depth: -1, pierce: true }, 45000);
        const found = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector }, 45000);
        if (!found || !found.nodeId) throw new Error("file input not found: " + selector);
        await this.send("DOM.setFileInputFiles", { nodeId: found.nodeId, files: files.map((f) => resolve(f)) }, 45000);
        await sleep(450);
        return;
      } catch (e) {
        lastError = e;
        await sleep(1200);
      }
    }
    throw new Error("setFileInput failed (" + selector + "): " + (lastError && lastError.message ? lastError.message : String(lastError)));
  }

  async waitForDownload(needle, options) {
    const o = options || {};
    const timeoutMs = o.timeoutMs == null ? 20000 : o.timeoutMs;
    const since = o.since == null ? 0 : o.since;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const names = await readdir(resolve(this.opts.downloadDir)).catch(() => []);
      for (const name of names) {
        if (!name.includes(needle)) continue;
        const full = join(resolve(this.opts.downloadDir), name);
        const info = await stat(full).catch(() => null);
        if (info && info.size > 0 && info.mtimeMs >= since - 2000) return { path: full, size: info.size, name };
      }
      await sleep(250);
    }
    throw new Error("download not found: " + needle + " in " + this.opts.downloadDir);
  }

  errorsSummary() {
    return {
      consoleErrors: this.console.filter((c) => c.type === "error").map((c) => c.text),
      logErrors: this.logEntries.filter((e) => e.level === "error").map((e) => e.text),
      exceptions: this.exceptions,
      failedRequests: this.failedRequests,
    };
  }

  async close() {
    try { if (this.conn && this.conn.ws) this.conn.ws.close(); } catch { /* ignore */ }
    try {
      if (this.browser && this.browser.pid) {
        execFileSync("taskkill", ["/pid", String(this.browser.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      }
    } catch { /* already gone */ }
    try { this.browser.kill(); } catch { /* ignore */ }
    await sleep(250);
  }
}

export async function waitForServer(url, options) {
  const o = options || {};
  const timeoutMs = o.timeoutMs == null ? 40000 : o.timeoutMs;
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
      last = "HTTP " + res.status;
    } catch (e) {
      last = String(e && e.message ? e.message : e);
    }
    await sleep(500);
  }
  throw new Error("dev server not reachable at " + url + " (" + last + "). Start it with: npx vite --host 127.0.0.1 --port 5199");
}
