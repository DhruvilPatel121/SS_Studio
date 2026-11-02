@echo off
REM ============================================
REM DHDRVIL STUDIO - AUTOMATED SETUP SCRIPT (Windows)
REM ============================================
REM This script helps you set up the project quickly on Windows
REM ============================================

echo ==========================================
echo   Dhruvil Studio - Setup Script (Windows)
echo ==========================================
echo.

REM Check Node.js
echo Checking prerequisites...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [OK] Node.js installed: %NODE_VERSION%
) else (
    echo [ERROR] Node.js not found. Please install Node.js v20 or higher from https://nodejs.org/
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo [OK] npm installed: %NPM_VERSION%
) else (
    echo [ERROR] npm not found. Please install npm (comes with Node.js)
    pause
    exit /b 1
)

REM Check Docker
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo [OK] Docker installed: %DOCKER_VERSION%
) else (
    echo [WARNING] Docker not found. Docker is required for running services.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    echo.
    set /p CONTINUE="Continue without Docker? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        pause
        exit /b 1
    )
)

echo.
echo ==========================================
echo   Installing Dependencies
echo ==========================================
echo.

REM Install root dependencies
echo Installing root dependencies...
call npm install
if %ERRORLEVEL% EQU 0 (
    echo [OK] Root dependencies installed
) else (
    echo [ERROR] Failed to install root dependencies
    pause
    exit /b 1
)

REM Install backend dependencies
echo Installing backend dependencies...
cd apps\backend
call npm install
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend dependencies installed
) else (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

REM Install frontend dependencies
echo Installing frontend dependencies...
cd ..\frontend
call npm install
if %ERRORLEVEL% EQU 0 (
    echo [OK] Frontend dependencies installed
) else (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

REM Return to root
cd ..\..

echo.
echo ==========================================
echo   Environment Configuration
echo ==========================================
echo.

REM Check if .env exists
if exist .env (
    echo [WARNING] .env file already exists
    set /p OVERWRITE="Do you want to overwrite it? (y/n): "
    if /i "%OVERWRITE%"=="y" (
        del .env
        echo [OK] Existing .env file removed
    ) else (
        echo [WARNING] Keeping existing .env file
    )
)

REM Check if .env needs to be created
if not exist .env (
    echo [WARNING] .env file not found
    echo.
    echo You need to set up Supabase to continue:
    echo 1. Go to https://supabase.com
    echo 2. Sign up for a FREE account
    echo 3. Create a new project
    echo 4. Go to Project Settings -^> API
    echo 5. Copy your Project URL and anon/public key
    echo.
    set /p SUPABASE_READY="Have you set up Supabase? (y/n): "
    if /i "%SUPABASE_READY%"=="y" (
        set /p SUPABASE_URL="Enter your Supabase Project URL: "
        set /p SUPABASE_ANON_KEY="Enter your Supabase Anon Key: "

        REM Update .env file (using PowerShell for replacement)
        powershell -Command "(Get-Content .env) -replace 'VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE', 'VITE_SUPABASE_URL=%SUPABASE_URL%' | Set-Content .env"
        powershell -Command "(Get-Content .env) -replace 'VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE', 'VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%' | Set-Content .env"

        echo [OK] .env file updated with Supabase credentials
    ) else (
        echo [WARNING] Skipping .env configuration. You'll need to update it manually.
    )
)

echo.
echo ==========================================
echo   Database Setup
echo ==========================================
echo.

echo [WARNING] You need to set up your Supabase database.
echo.
echo Steps:
echo 1. Go to your Supabase project dashboard
echo 2. Click 'SQL Editor' in the left sidebar
echo 3. Click 'New Query'
echo 4. Copy and paste the contents of: supabase\setup.sql
echo 5. Click 'Run' to execute
echo.
set /p DB_READY="Have you set up the database? (y/n): "
if /i not "%DB_READY%"=="y" (
    echo [WARNING] Skipping database setup. You'll need to do this manually.
)

echo.
echo ==========================================
echo   Storage Setup
echo ==========================================
echo.

echo [WARNING] You need to create a storage bucket in Supabase.
echo.
echo Steps:
echo 1. Go to Storage in your Supabase dashboard
echo 2. Click 'New Bucket'
echo 3. Name it: dhruvil-photos
echo 4. Make it public
echo 5. Click 'Create Bucket'
echo.
set /p STORAGE_READY="Have you created the storage bucket? (y/n): "
if /i not "%STORAGE_READY%"=="y" (
    echo [WARNING] Skipping storage setup. You'll need to do this manually.
)

echo.
echo ==========================================
echo   Starting Services
echo ==========================================
echo.

REM Check if Docker is available
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting Docker services...
    docker-compose up -d
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Docker services started
    ) else (
        echo [ERROR] Failed to start Docker services
    )

    echo.
    echo Waiting for services to be healthy...
    timeout /t 10 /nobreak >nul

    echo.
    docker-compose ps
) else (
    echo [WARNING] Docker not available. You'll need to start services manually.
)

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo [OK] Installation complete!
echo.
echo Next steps:
echo.
echo 1. Start the application:
echo.
echo    Option A - Using Docker (Full Stack):
echo    docker-compose up -d
echo.
echo    Option B - Manual Development (3 terminals):
echo    Terminal 1: cd apps\backend ^&^& npm run dev
echo    Terminal 2: cd apps\frontend ^&^& npm run dev
echo    Terminal 3: npx vite --host 127.0.0.1
echo.
echo 2. Access the application:
echo    Frontend: http://localhost:3000
echo    Backend: http://localhost:4000
echo    Root Admin: http://localhost:5173
echo.
echo 3. Create your account:
echo    Email: demo@dhruvil.dev
echo    Password: dhruvil123456
echo.
echo For detailed instructions, see: FREE_TIER_SETUP.md
echo.
pause
