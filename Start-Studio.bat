@echo off
REM OmniFlow Studio launcher (Windows) - double-click to run
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found. Install Node.js 18+ from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM find a free port starting at 4319
set PORT=4319
:tryport
node -e "require('net').createServer().once('error',function(){process.exit(1)}).once('listening',function(){this.close();process.exit(0)}).listen(%PORT%,'127.0.0.1')" >nul 2>nul
if errorlevel 1 (
  set /a PORT=%PORT%+1
  if %PORT% LSS 4400 goto tryport
)

echo.
echo   OmniFlow Studio  -^>  http://127.0.0.1:%PORT%
echo   Close this window (or press Ctrl+C) to stop.
echo.

node ./bin/of.mjs studio --port %PORT%
pause
