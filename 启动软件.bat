@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ProxyIP Explorer

where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 22.12 or newer was not found in PATH.
  echo Install Node.js, reopen this window, and try again.
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

echo [INFO] Starting ProxyIP Explorer...
call npm.cmd start
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [ERROR] The application exited with code %RC%.
  goto FAILED
)
exit /b 0

:FAILED
echo.
echo [ERROR] Startup did not complete. Check the messages above and install-dependencies.log.
echo.
pause
exit /b 1
