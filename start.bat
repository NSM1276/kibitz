@echo off
rem Starts the trainer locally and opens it in the browser. Close this window to stop.
cd /d "%~dp0"
rem If the server already runs, just open the browser.
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8765/ -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://127.0.0.1:8765/
  exit /b
)
start "" http://127.0.0.1:8765/
echo Your Move laeuft. Dieses Fenster offen lassen. Zum Beenden schliessen.
python serve.py 8765
if errorlevel 1 (
  echo Fehler beim Start. Taste druecken...
  pause >nul
)
