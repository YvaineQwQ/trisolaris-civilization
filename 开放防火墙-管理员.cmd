@echo off
chcp 65001 >nul
net session >nul 2>nul
if errorlevel 1 (
  echo 请右键本文件，选择“以管理员身份运行”。
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="TRISOLARIS-8080" >nul 2>nul
netsh advfirewall firewall add rule name="TRISOLARIS-8080" dir=in action=allow protocol=TCP localport=8080 profile=private,domain
echo 已放行 8080 端口（仅专用网络/域网络）。
echo 现在可以双击“局域网分享.cmd”，把打印的 http://192.168.x.x:8080/ 发给朋友。
pause