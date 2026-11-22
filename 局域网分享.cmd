@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  三体纪元 · 局域网分享
echo  启动后把窗口中“同 WiFi”的链接发给朋友。
echo  首次被防火墙拦截：右键“开放防火墙-管理员.cmd”以管理员运行一次。
echo ============================================
where node >nul 2>nul
if errorlevel 1 ( echo 未检测到 Node.js，请安装 Node 20+ 或使用在线托管版。 & pause & exit /b 1 )
node scripts\launch-game.mjs
pause