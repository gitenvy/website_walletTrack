@echo off
rem Start the Tali demo. Double-click this file, or run start-tali.bat from any folder.
rem Always serves THIS folder (the Tali app), on port 8000, or 8001 if 8000 is already in use.

cd /d "%~dp0"

set PORT=8000
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 (
  echo Port 8000 is already used by another program, so Tali will use port 8001.
  set PORT=8001
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install it from https://www.python.org/downloads/ and tick "Add python to PATH".
  pause
  exit /b 1
)

echo.
echo   Tali demo:  http://localhost:%PORT%
echo   App only:   http://localhost:%PORT%/app.html
echo   Press Ctrl+C in this window to stop.
echo.
start "" "http://localhost:%PORT%"
python -m http.server %PORT%
