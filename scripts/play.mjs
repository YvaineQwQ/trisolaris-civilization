#!/usr/bin/env node
/**
 * 一键启动《三体纪元》：
 *  - 若 5173 已有服务则直接打开浏览器；
 *  - 否则启动 Vite dev server，等待就绪后用默认浏览器打开带 autostart 的地址。
 * 机器重启后开发服务器进程会消失（这是“网址打不开”的根因），用本脚本即可恢复。
 */
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = 5173;
const URL = "http://127.0.0.1:5173/?autostart=1&seed=DEMO-TRISOLAR&difficulty=easy&mode=normal";

function probe() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function waitReady(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

if (await probe()) {
  console.log("[trisolaris] 开发服务器已在运行，直接打开:", URL);
  openBrowser(URL);
  process.exit(0);
}

console.log("[trisolaris] 未检测到游戏服务，启动 Vite dev server ...");
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: false,
});

const ready = await waitReady(30000);
if (!ready) {
  console.error("[trisolaris] 服务启动失败，请检查 Node 是否安装、端口 5173 是否被占用。");
  process.exit(1);
}
console.log("[trisolaris] 就绪:", URL);
openBrowser(URL);
// 保持进程存活；关闭窗口/ Ctrl+C 即可停止
process.on("SIGINT", () => { child.kill(); process.exit(0); });
