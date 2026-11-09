@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ProxyIP Explorer - Build Portable EXE

where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 22.12 or newer was not found in PATH.
  goto FAILED
)

if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo [INFO] Dependencies are missing. Running the installer...
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-deps.ps1"
  if errorlevel 1 goto FAILED
)

where.exe npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm.cmd was not found in PATH.
  goto FAILED
)

echo [INFO] Building portable Windows EXE...
call npm.cmd run dist:portable
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [ERROR] Build failed with exit code %RC%.
  goto FAILED
)

echo.
echo [OK] Portable EXE is in the dist folder.
echo.
pause
exit /b 0

:FAILED
echo.
echo [ERROR] EXE packaging did not complete. Check the messages above.
echo.
pause
exit /b 1
