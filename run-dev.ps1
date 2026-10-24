Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "              Starting My Query AI Platform             " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/2] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd services/api; python -m uvicorn app.main:app --reload --port 8000"

Write-Host "[2/2] Launching Next.js Web UI on http://localhost:3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps/web; npm run dev"

Write-Host ""
Write-Host "Both servers launched in dedicated terminal windows!" -ForegroundColor Yellow
Write-Host "Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "Swagger Doc: http://localhost:8000/docs" -ForegroundColor White
