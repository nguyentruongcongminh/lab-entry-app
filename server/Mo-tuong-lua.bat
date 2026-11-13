@echo off
rem  Mo cong 8787 (TCP, chieu vao) trong Tuong lua Windows cho LabEntry. Can quyen quan tri.
setlocal
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="LabEntry LAN" >nul 2>nul
netsh advfirewall firewall add rule name="LabEntry LAN" dir=in action=allow protocol=TCP localport=8787 profile=any
if errorlevel 1 (
  echo Khong mo duoc cong 8787. Hay nho nguoi phu trach mang mo cong TCP 8787 cho may nay.
) else (
  echo Da mo cong 8787 cho LabEntry. Cac may khac trong mang co the ket noi.
)
timeout /t 4 >nul
