# ============================================
# DHDRVIL STUDIO - QUICK START (PowerShell)
# ============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Dhruvil Studio - Quick Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Please update .env with your Supabase credentials first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "1. Go to https://supabase.com and sign up (FREE)" -ForegroundColor White
    Write-Host "2. Create a new project" -ForegroundColor White
    Write-Host "3. Go to Project Settings -> API" -ForegroundColor White
    Write-Host "4. Copy Project URL and anon/public key" -ForegroundColor White
    Write-Host "5. Update .env file with these values" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path node_modules)) {
    Write-Host "[WARNING] Root dependencies not found. Installing..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path apps\backend\node_modules)) {
    Write-Host "[WARNING] Backend dependencies not found. Installing..." -ForegroundColor Yellow
    cd apps\backend
    npm install
    cd ..\..
}

if (-not (Test-Path apps\frontend\node_modules)) {
    Write-Host "[WARNING] Frontend dependencies not found. Installing..." -ForegroundColor Yellow
    cd apps\frontend
    npm install
    cd ..\..
}

Write-Host ""
Write-Host "Starting development environment..." -ForegroundColor Green
Write-Host ""

# Check if Docker is available
$dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCheck) {
    Write-Host "Starting Docker services (PostgreSQL, Redis, MinIO)..." -ForegroundColor Yellow
    docker-compose up -d

    Write-Host ""
    Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    Write-Host ""
    Write-Host "Docker services status:" -ForegroundColor Cyan
    docker-compose ps
    Write-Host ""
} else {
    Write-Host "[WARNING] Docker not found. Skipping database services." -ForegroundColor Yellow
    Write-Host "Please ensure PostgreSQL, Redis, and MinIO are running manually." -ForegroundColor White
    Write-Host ""
}

Write-Host "Starting application services..." -ForegroundColor Green
Write-Host ""
Write-Host "Opening 3 terminal windows for:" -ForegroundColor Cyan
Write-Host "  1. Backend (Port 4000)" -ForegroundColor White
Write-Host "  2. Frontend (Port 3000)" -ForegroundColor White
Write-Host "  3. Root Admin (Port 5173)" -ForegroundColor White
Write-Host ""

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\apps\backend'; npm run dev"

# Wait a moment
Start-Sleep -Seconds 3

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\apps\frontend'; npm run dev"

# Wait a moment
Start-Sleep -Seconds 3

# Start Root Admin
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npx vite --host 127.0.0.1"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:4000" -ForegroundColor White
Write-Host "  Root Admin:   http://localhost:5173" -ForegroundColor White
Write-Host "  MinIO Console: http://localhost:9001 (if Docker is running)" -ForegroundColor White
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor Cyan
Write-Host "  Email:    demo@dhruvil.dev" -ForegroundColor White
Write-Host "  Password: dhruvil123456" -ForegroundColor White
Write-Host ""
Write-Host "Close the PowerShell windows to stop services." -ForegroundColor Yellow
Write-Host ""
