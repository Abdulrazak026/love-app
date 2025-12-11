@echo off
REM Launch the project on port 2000 and open in Chrome

cd /d "%~dp0"

REM Start the dev server on port 2000 in a new window
echo Starting Vite dev server on port 2000...
start "Vite Dev Server" cmd /k "npm run dev -- --port 2000"

REM Wait for server to start
timeout /t 4 /nobreak

REM Open in Chrome
echo Opening Chrome...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:2000 2>nul
if errorlevel 1 start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" http://localhost:2000 2>nul

echo.
echo Project launched on http://localhost:2000
pause
