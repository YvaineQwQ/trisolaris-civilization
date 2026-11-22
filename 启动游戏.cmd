@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。
  echo 请安装 Node 20+：https://nodejs.org/
  echo 或使用 release\TRISOLARIS-v1.4-web.zip 在线托管版。
  pause
  exit /b 1
)
echo ============================================
echo  三体纪元 · TRISOLARIS: CIVILIZATION
echo  游戏会在浏览器中自动打开；保持本窗口不要关闭。
echo ============================================
node scripts\launch-game.mjs
pause