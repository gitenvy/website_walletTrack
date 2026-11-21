@echo off
rem Start the Gotcha demo. Double-click this file, or run start-gotcha.bat from any folder.
rem Always serves THIS folder (the Gotcha app) on port 8001 (port 8000 is used by the team's other Wallet Tracker page).

cd /d "%~dp0"
set PORT=8001

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Port %PORT% is already in use. If Gotcha is already running, just open http://localhost:%PORT%
  echo Otherwise close the other program using port %PORT% and try again.
  start "" "http://localhost:%PORT%"
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install it from https://www.python.org/downloads/ and tick "Add python to PATH".
  pause
  exit /b 1
)

echo.
echo   Gotcha demo:  http://localhost:%PORT%
echo   App only:   http://localhost:%PORT%/app.html
echo   Press Ctrl+C in this window to stop.
echo.
start "" "http://localhost:%PORT%"
python -m http.server %PORT%
