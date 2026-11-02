@echo off
REM ============================================
REM DHDRVIL STUDIO - QUICK START (Windows)
REM ============================================
REM This script starts all services for development
REM ============================================

echo ==========================================
echo   Dhruvil Studio - Quick Start
echo ==========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please run setup.bat first to configure the project.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist node_modules (
    echo [WARNING] Root dependencies not found. Installing...
    call npm install
)

if not exist apps\backend\node_modules (
    echo [WARNING] Backend dependencies not found. Installing...
    cd apps\backend
    call npm install
    cd ..\..
)

if not exist apps\frontend\node_modules (
    echo [WARNING] Frontend dependencies not found. Installing...
    cd apps\frontend
    call npm install
    cd ..\..
)

echo.
echo Starting development environment...
echo.

REM Check if Docker is available
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting Docker services (PostgreSQL, Redis, MinIO)...
    docker-compose up -d

    echo.
    echo Waiting for services to be ready...
    timeout /t 5 /nobreak >nul

    echo.
    echo Docker services status:
    docker-compose ps
    echo.
) else (
    echo [WARNING] Docker not found. Skipping database services.
    echo Please ensure PostgreSQL, Redis, and MinIO are running manually.
    echo.
)

echo Starting application services...
echo.
echo Opening 3 terminal windows for:
echo   1. Backend (Port 4000)
echo   2. Frontend (Port 3000)
echo   3. Root Admin (Port 5173)
echo.

REM Start Backend
start "Dhruvil Backend" cmd /k "cd /d %CD%\apps\backend && npm run dev"

REM Wait a moment
timeout /t 3 /nobreak >nul

REM Start Frontend
start "Dhruvil Frontend" cmd /k "cd /d %CD%\apps\frontend && npm run dev"

REM Wait a moment
timeout /t 3 /nobreak >nul

REM Start Root Admin
start "Dhruvil Admin" cmd /k "cd /d %CD% && npx vite --host 127.0.0.1"

echo.
echo ==========================================
echo   Services Started!
echo ==========================================
echo.
echo Access points:
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:4000
echo   Root Admin:   http://localhost:5173
echo   MinIO Console: http://localhost:9001 (if Docker is running)
echo.
echo Demo credentials:
echo   Email:    demo@dhruvil.dev
echo   Password: dhruvil123456
echo.
echo Press any key to stop all services...
pause >nul

REM Stop services
echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq Dhruvil Backend*" /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dhruvil Frontend*" /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dhruvil Admin*" /T >nul 2>&1

REM Stop Docker services
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Stopping Docker services...
    docker-compose down
)

echo.
echo All services stopped.
pause
