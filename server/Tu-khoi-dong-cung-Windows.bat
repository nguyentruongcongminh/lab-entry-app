@echo off
rem  Bat / tat "May chu LabEntry tu chay khi bat may" (dat bieu tuong trong thu muc Startup cua Windows).
setlocal
chcp 65001 >nul
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LabEntry May chu.lnk"
set "TARGET=%~dp0Chay-may-chu.bat"
echo.
echo  [1] BAT  - May chu tu chay (thu nho) moi khi bat may tinh nay
echo  [2] TAT  - Bo tu chay
echo.
choice /c 12 /n /m "Chon 1 hoac 2: "
if errorlevel 2 goto tat
:bat
powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut($env:LNK); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.WindowStyle=7; $s.Save()"
echo Da bat tu chay cung Windows.
goto xong
:tat
del "%LNK%" >nul 2>nul
echo Da tat tu chay cung Windows.
:xong
timeout /t 4 >nul
