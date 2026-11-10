@echo off
REM Windows: double-click to open the Awards Video app.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo Install the LTS version from https://nodejs.org, then double-click this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing ^(this takes a minute or two^)...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
call npm start
pause
