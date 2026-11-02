# ============================================
# DHDRVIL STUDIO - START IN SINGLE TERMINAL
# ============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Dhruvil Studio - Single Terminal Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Please update .env with your Supabase credentials first." -ForegroundColor Yellow
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
Write-Host "Starting services in background..." -ForegroundColor Green
Write-Host ""

# Start Backend in background
Write-Host "[1/3] Starting Backend (Port 4000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $args[0]
    npm run dev
} -ArgumentList "$PWD\apps\backend"

# Wait a moment
Start-Sleep -Seconds 3

# Start Frontend in background
Write-Host "[2/3] Starting Frontend (Port 3000)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $args[0]
    npm run dev
} -ArgumentList "$PWD\apps\frontend"

# Wait a moment
Start-Sleep -Seconds 3

# Start Root Admin in background
Write-Host "[3/3] Starting Root Admin (Port 5173)..." -ForegroundColor Yellow
$adminJob = Start-Job -ScriptBlock {
    Set-Location $args[0]
    npx vite --host 127.0.0.1
} -ArgumentList "$PWD"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  All Services Started!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:4000" -ForegroundColor White
Write-Host "  Root Admin:   http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor Cyan
Write-Host "  Email:    demo@dhruvil.dev" -ForegroundColor White
Write-Host "  Password: dhruvil123456" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Keep script running and show job status
try {
    while ($true) {
        Clear-Host
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "  Dhruvil Studio - Running" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Services Status:" -ForegroundColor Cyan
        Write-Host ""

        # Check Backend
        if ($backendJob.State -eq "Running") {
            Write-Host "  [✓] Backend (Port 4000) - Running" -ForegroundColor Green
        } else {
            Write-Host "  [✗] Backend (Port 4000) - Stopped" -ForegroundColor Red
        }

        # Check Frontend
        if ($frontendJob.State -eq "Running") {
            Write-Host "  [✓] Frontend (Port 3000) - Running" -ForegroundColor Green
        } else {
            Write-Host "  [✗] Frontend (Port 3000) - Stopped" -ForegroundColor Red
        }

        # Check Admin
        if ($adminJob.State -eq "Running") {
            Write-Host "  [✓] Root Admin (Port 5173) - Running" -ForegroundColor Green
        } else {
            Write-Host "  [✗] Root Admin (Port 5173) - Stopped" -ForegroundColor Red
        }

        Write-Host ""
        Write-Host "Access:" -ForegroundColor Cyan
        Write-Host "  Frontend:     http://localhost:3000" -ForegroundColor White
        Write-Host "  Backend:      http://localhost:4000" -ForegroundColor White
        Write-Host "  Root Admin:   http://localhost:5173" -ForegroundColor White
        Write-Host ""
        Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
        Write-Host ""

        # Show recent output from jobs
        Write-Host "--- Recent Backend Output ---" -ForegroundColor Gray
        Receive-Job $backendJob -ErrorAction SilentlyContinue | Select-Object -Last 5
        Write-Host ""

        Start-Sleep -Seconds 5
    }
} finally {
    # Stop all jobs when script is interrupted
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Stop-Job $adminJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $adminJob -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
