#!/usr/bin/env node
/**
 * 用 GitHub REST API 上传源码（api.github.com 可直连；无需 git push）。
 * 用法：GITHUB_TOKEN=github_pat_xxx node scripts/upload-to-github.mjs [仓库名] [public|private]
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) { console.error("缺少 GITHUB_TOKEN"); process.exit(1); }
const repoName = process.argv[2] || "trisolaris-civilization";
const visibility = process.argv[3] === "private" ? true : false;
const API = "https://api.github.com";
const headers = {
  Authorization: "Bearer " + TOKEN,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "TRISOLARIS-uploader",
};
async function api(path, options = {}) {
  const res = await fetch(API + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(res.status + " " + path + " :: " + JSON.stringify(data).slice(0, 500));
  return data;
}
async function walk(dir, base = dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}
const me = await api("/user");
const owner = me.login;
console.log("登录用户:", owner);
let repo;
try { repo = await api("/repos/" + owner + "/" + repoName); console.log("仓库已存在:", repo.html_url); }
catch (e) {
  if (!String(e).includes(" 404 ")) throw e;
  repo = await api("/user/repos", { method: "POST", body: JSON.stringify({ name: repoName, description: "三体纪元 TRISOLARIS: CIVILIZATION — 硬科幻三体文明策略游戏", private: visibility, auto_init: false }) });
  console.log("已创建仓库:", repo.html_url);
}
// GitHub 的 Git Data API 在完全空的仓库上不能直接建 blob（409），
// 先用 Contents API 提交一个 README，把仓库初始化出 main 分支。
try {
  await api("/repos/" + owner + "/" + repoName + "/contents/README.md");
} catch (e) {
  if (String(e).includes(" 404 ")) {
    await api("/repos/" + owner + "/" + repoName + "/contents/README.md", {
      method: "PUT",
      body: JSON.stringify({
        message: "chore: initialize repository",
        content: Buffer.from("# TRISOLARIS: CIVILIZATION\n\n三体纪元 · 硬科幻三体文明策略游戏\n").toString("base64"),
      }),
    });
    console.log("已初始化空仓库");
  } else throw e;
}
let parentSha = null;
try { const ref = await api("/repos/" + owner + "/" + repoName + "/git/ref/heads/main"); parentSha = ref.object.sha; } catch {}
const sourceRoot = join(process.cwd(), "release", "TRISOLARIS-v1.6-source");
const files = (await walk(sourceRoot)).sort();
console.log("文件数:", files.length);
const tree = new Array(files.length);
let done = 0;
let cursor = 0;
const CONCURRENCY = 8;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= files.length) return;
    const file = files[index];
    const buf = await readFile(file);
    const rel = relative(sourceRoot, file).replaceAll("\\", "/");
    const blob = await api("/repos/" + owner + "/" + repoName + "/git/blobs", { method: "POST", body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }) });
    tree[index] = { path: rel, mode: "100644", type: "blob", sha: blob.sha };
    done++;
    if (done % 20 === 0 || done === files.length) console.log("上传", done + "/" + files.length);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
const treeRes = await api("/repos/" + owner + "/" + repoName + "/git/trees", { method: "POST", body: JSON.stringify({ tree }) });
const commit = await api("/repos/" + owner + "/" + repoName + "/git/commits", { method: "POST", body: JSON.stringify({ message: "TRISOLARIS v1.6.0 — 科技树192项 / 六时代 / 事件区间 / 编年史 / 新徽章 / 设计系统", tree: treeRes.sha, parents: parentSha ? [parentSha] : [] }) });
try { await api("/repos/" + owner + "/" + repoName + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }) }); }
catch (e) { if (!String(e).includes(" 422 ")) throw e; await api("/repos/" + owner + "/" + repoName + "/git/refs/heads/main", { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) }); }
await api("/repos/" + owner + "/" + repoName, { method: "PATCH", body: JSON.stringify({ default_branch: "main" }) });
try {
  await api("/repos/" + owner + "/" + repoName + "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/tags/v1.6.0", sha: commit.sha }) });
  console.log("标签: v1.6.0");
} catch (e) {
  console.log("标签已存在或创建失败（可忽略）:", String(e).slice(0, 160));
}
console.log("完成:", "https://github.com/" + owner + "/" + repoName);
