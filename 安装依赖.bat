@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ProxyIP Explorer - Dependency Installer

if not exist "%~dp0scripts\install-deps.ps1" (
  echo [ERROR] Installer script is missing: scripts\install-deps.ps1
  goto FAILED
)

where.exe powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Windows PowerShell was not found.
  goto FAILED
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-deps.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" goto FAILED

echo.
echo [OK] Dependencies are installed. Start the app with the launcher script.
echo.
pause
exit /b 0

:FAILED
echo.
echo [ERROR] Dependency installation did not finish successfully.
echo Check install-dependencies.log in this folder for details.
echo.
pause
exit /b 1
