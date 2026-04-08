@echo off
REM GPU Deals Scanner — runs daily via Windows Task Scheduler
REM Starts the dev server, runs a scan, then stops.

cd /d "x:\Private\gpu-deals"

REM Start dev server in background
start /B cmd /c "npm run dev > nul 2>&1"

REM Wait for server to be ready
timeout /t 10 /nobreak > nul

REM Run the scan
curl -s "http://localhost:3000/api/cron?secret=5e5bb2280447206b40975f812d9e121e6bff6d8a175bb4d0a5ab053d9c12818b"

REM Wait for scan to complete
timeout /t 5 /nobreak > nul

REM Kill the dev server
taskkill /F /IM node.exe > nul 2>&1

echo.
echo Scan complete.
