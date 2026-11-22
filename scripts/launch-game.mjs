#!/usr/bin/env node
/**
 * 双击启动游戏：用纯 Node 静态服务器托管 dist/，无需 Vite，也不会因 HMR/端口 5173
 * 失效而打不开。端口被占用时会自动改用 8081/8082；检测到 8080 已在运行则直接开浏览器。
 *
 * 用法：node scripts/launch-game.mjs
 * 环境变量：PORT（默认 8080）、NO_OPEN=1（不自动开浏览器，供 QA 使用）
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(HERE, "dist");
const NO_OPEN = process.env.NO_OPEN === "1";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4",
};

function openBrowser(url) {
  if (NO_OPEN) return;
  try {
    const child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    console.log("请手动打开浏览器访问:", url);
  }
}

function lanIps() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === "IPv4" && !item.internal) out.push(item.address);
    }
  }
  return out;
}

async function alreadyServing(port) {
  try {
    const res = await fetch("http://127.0.0.1:" + port + "/", { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes("三体纪元") || text.includes("TRISOLARIS");
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.log("[启动] 未找到 dist/index.html，先构建一次 …");
    const build = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { cwd: HERE, stdio: "inherit" });
    if (build.status !== 0 || !existsSync(join(DIST, "index.html"))) {
      console.error("[启动失败] 构建失败。请确认已安装依赖（npm install）或改用在线的 Netlify 版本。");
      process.exit(1);
    }
  }

  const preferred = Number(process.env.PORT || 8080);
  for (let port = preferred; port <= preferred + 2; port++) {
    if (await alreadyServing(port)) {
      const url = "http://127.0.0.1:" + port + "/";
      console.log("[启动] 游戏服务已在运行:", url);
      openBrowser(url);
      return;
    }
    const rootDir = DIST;
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        let filePath = normalize(join(rootDir, urlPath));
        if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end("Forbidden"); return; }
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(rootDir, "index.html");
        const stat = statSync(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
          "Content-Length": stat.size,
          "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
        });
        createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500); res.end("Internal Server Error");
      }
    });
    const ok = await new Promise((resolveOk) => {
      server.once("error", (err) => {
        if (err && err.code === "EADDRINUSE") resolveOk(false);
        else { console.error("[启动失败]", err); resolveOk(false); }
      });
      server.listen(port, "0.0.0.0", () => resolveOk(true));
    });
    if (!ok) continue;
    console.log("");
    console.log("  三体纪元 · TRISOLARIS: CIVILIZATION");
    console.log("  本机游玩:  http://127.0.0.1:" + port + "/");
    for (const ip of lanIps()) console.log("  同 WiFi:   http://" + ip + ":" + port + "/");
    console.log("");
    console.log("  保持本窗口打开；关闭窗口或按 Ctrl+C 停止游戏服务器。");
    openBrowser("http://127.0.0.1:" + port + "/");
    process.on("SIGINT", () => { server.close(); process.exit(0); });
    return;
  }
  console.error("[启动失败] 端口 8080–8082 都被占用，请关闭其他程序后重试。");
  process.exit(1);
}
main();
