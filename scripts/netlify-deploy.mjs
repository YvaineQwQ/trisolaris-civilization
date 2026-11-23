import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9371);
const zipPath = resolve(process.argv[2] || "release/TRISOLARIS-v1.7-web.zip");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(path, init) { const r = await fetch("http://127.0.0.1:" + PORT + path, init); return r.json(); }
function connect(url) {
  return new Promise((ok, bad) => {
    const ws = new WebSocket(url);
    const st = { id: 0, p: new Map(), h: new Map() };
    ws.onopen = () => ok({ ws, send, on });
    ws.onerror = () => bad(new Error("ws"));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && st.p.has(m.id)) { const p = st.p.get(m.id); st.p.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
      const hs = st.h.get(m.method); if (hs) hs.forEach((f) => f(m.params));
    };
    function send(method, params) { const id = ++st.id; return new Promise((res, rej) => { st.p.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
    function on(method, fn) { if (!st.h.has(method)) st.h.set(method, []); st.h.get(method).push(fn); }
  });
}
await mkdir("artifacts", { recursive: true });
const prof = join(tmpdir(), "nf-drop-" + Date.now());
const edge = spawn(EDGE, ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=" + PORT, "--user-data-dir=" + prof, "--window-size=1600,900", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const out = { ok: false, url: null, page: null, error: null };
try {
  let list = null;
  for (let i = 0; i < 80; i++) { await sleep(250); try { list = await j("/json/list"); if (list && list.length) break; } catch (e) {} }
  if (!list || !list.length) throw new Error("no target");
  const page = list.find((t) => t.type === "page") || list[0];
  const c = await connect(page.webSocketDebuggerUrl);
  await c.send("Runtime.enable"); await c.send("DOM.enable"); await c.send("Page.enable");
  await c.send("Page.navigate", { url: "https://app.netlify.com/drop" });
  await sleep(7000);
  let info = await c.send("Runtime.evaluate", { expression: "({href:location.href, inputs:[...document.querySelectorAll('input[type=file]')].map(e=>({accept:e.accept,dir:e.webkitdirectory})), text:(document.body.innerText||'').slice(0,500)})", returnByValue: true });
  out.page = info.result.value;
  if (!out.page.inputs || !out.page.inputs.length) {
    await c.send("Runtime.evaluate", { expression: "(()=>{const n=[...document.querySelectorAll('button,a')].find(e=>/choose a file/i.test(e.textContent||'')); if(n)n.click(); return !!n;})()", returnByValue: true });
    await sleep(1500);
  }
  const doc = await c.send("DOM.getDocument", { depth: 2 });
  const q = await c.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
  if (!q || !q.nodeId) throw new Error("no file input");
  await c.send("DOM.setFileInputFiles", { files: [zipPath], nodeId: q.nodeId });
  for (let i = 0; i < 100; i++) {
    await sleep(2500);
    const r = await c.send("Runtime.evaluate", { expression: "({href:location.href,text:(document.body.innerText||''),links:[...document.querySelectorAll('a')].map(a=>a.href).filter(h=>h.indexOf('netlify.app')>=0)})", returnByValue: true });
    const v = r.result.value || {};
    out.href = v.href;
    const m = (v.text || "").match(/https:\/\/[a-z0-9-]+\.netlify\.app/);
    const link = (v.links || [])[0];
    out.body = (v.text || "").slice(0, 1200);
    if (m || link) { out.ok = true; out.url = m ? m[0] : link; break; }
  }
  c.ws.close();
} catch (e) { out.error = String(e); }
finally { edge.kill(); await sleep(300); }
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
