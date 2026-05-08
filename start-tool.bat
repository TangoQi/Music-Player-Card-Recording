@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js or add it to PATH.
  pause
  exit /b 1
)

echo.
echo Starting Couple Avatar Factory...
echo.
start "Couple Avatar Factory Server" cmd /k "cd /d %~dp0 && node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8787"
echo Opened http://localhost:8787
echo Paste your OpenAI API key in the web page.
echo Keep the server window open while generating images.
timeout /t 3 /nobreak >nul
