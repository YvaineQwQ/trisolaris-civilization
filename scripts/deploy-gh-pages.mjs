import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error("no token"); process.exit(1); }
const owner = "YvaineQwQ", repo = "trisolaris-civilization";
const apiBase = "https://api.github.com";
const headers = { Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "trisolaris-pages" };
async function api(path, options = {}) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(apiBase + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (res.ok) return data;
    if ((res.status === 403 || res.status === 429) && i < 5) { await new Promise((r) => setTimeout(r, 4000 * (i + 1))); continue; }
    throw new Error(res.status + " " + path + " :: " + JSON.stringify(data).slice(0, 300));
  }
}
async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out); else out.push(p);
  }
  return out;
}
const files = (await walk("dist")).sort();
console.log("files", files.length);
const tree = new Array(files.length);
let done = 0, cursor = 0;
async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= files.length) return;
    const buf = await readFile(files[i]);
    const blob = await api("/repos/" + owner + "/" + repo + "/git/blobs", { method: "POST", body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }) });
    tree[i] = { path: relative("dist", files[i]).replaceAll("\\", "/"), mode: "100644", type: "blob", sha: blob.sha };
    done++;
    if (done % 20 === 0) console.log("blob", done);
  }
}
await Promise.all(Array.from({ length: 2 }, () => worker()));
const treeRes = await api("/repos/" + owner + "/" + repo + "/git/trees", { method: "POST", body: JSON.stringify({ tree }) });
let parent = null;
try { const ref = await api("/repos/" + owner + "/" + repo + "/git/ref/heads/gh-pages"); parent = ref.object.sha; } catch {}
const commit = await api("/repos/" + owner + "/" + repo + "/git/commits", { method: "POST", body: JSON.stringify({ message: "TRISOLARIS v1.7.0 static site", tree: treeRes.sha, parents: parent ? [parent] : [] }) });
try { await api("/repos/" + owner + "/" + repo + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/gh-pages", sha: commit.sha }) }); }
catch (e) { await api("/repos/" + owner + "/" + repo + "/git/refs/heads/gh-pages", { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) }); }
try { await api("/repos/" + owner + "/" + repo + "/pages", { method: "POST", body: JSON.stringify({ source: { branch: "gh-pages", path: "/" } }) }); }
catch (e) { try { await api("/repos/" + owner + "/" + repo + "/pages", { method: "PUT", body: JSON.stringify({ source: { branch: "gh-pages", path: "/" } }) }); } catch (e2) { console.log("pages enable failed", String(e2).slice(0,200)); } }
console.log("pages:", "https://" + owner.toLowerCase() + ".github.io/" + repo + "/");
