@echo off
title My Query AI Launcher
echo ========================================================
echo               Starting My Query AI Platform
echo ========================================================
echo.
echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "My Query AI API" cmd /k "cd services\api && python -m uvicorn app.main:app --reload --port 8000"

echo [2/2] Launching Next.js Web UI on http://localhost:3000 ...
start "My Query AI Web" cmd /k "cd apps\web && npm run dev"

echo.
echo ========================================================
echo Both servers are starting!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ========================================================
pause
