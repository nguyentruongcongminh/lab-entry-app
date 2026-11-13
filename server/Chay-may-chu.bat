@echo off
rem ============================================================
rem  LabEntry - MAY CHU LAN. Bam dup file nay de chay.
rem  Lan dau chay Windows se hoi quyen quan tri de mo cong 8787
rem  trong Tuong lua - bam "Yes / Co" mot lan la xong.
rem ============================================================
setlocal
chcp 65001 >nul
title LabEntry - May chu LAN (DUNG DONG cua so nay)
cd /d "%~dp0"

rem --- tim server.js (ban dong goi: ngay canh file nay hoac trong thu muc server)
set "SRV=%~dp0server\server.js"
if not exist "%SRV%" set "SRV=%~dp0server.js"
if not exist "%SRV%" (
  echo Khong thay file server.js. Hay giai nen DU thu muc LabEntry-LAN roi chay lai.
  pause
  exit /b 1
)

rem --- tim node.exe: uu tien ban di kem (thu muc node), sau do Node.js da cai tren may
set "NODE_EXE="
if exist "%~dp0node\node.exe" set "NODE_EXE=%~dp0node\node.exe"
if not defined NODE_EXE (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)
if not defined NODE_EXE (
  echo.
  echo CHUA CO Node.js tren may nay.
  echo   Cach 1: chep file node.exe vao thu muc "node" canh file nay.
  echo   Cach 2: cai Node.js ban LTS tu https://nodejs.org roi chay lai.
  echo.
  pause
  exit /b 1
)

rem --- mo cong 8787 trong Tuong lua Windows (chi lam 1 lan)
netsh advfirewall firewall show rule name="LabEntry LAN" >nul 2>nul
if errorlevel 1 (
  echo Lan dau chay: can mo cong 8787 trong Tuong lua Windows de cac may khac ket noi duoc.
  echo Hay bam "Yes / Co" khi Windows hoi quyen quan tri.
  powershell -NoProfile -Command "Start-Process -FilePath '%~dp0Mo-tuong-lua.bat' -Verb RunAs -Wait"
)

:chay
"%NODE_EXE%" "%SRV%"
echo.
echo ------------------------------------------------------------
echo  May chu da dung. Neu ban chua chu y dong, bam phim bat ky
echo  de chay lai ngay. (Du lieu van an toan trong thu muc data.)
echo ------------------------------------------------------------
pause >nul
goto chay
