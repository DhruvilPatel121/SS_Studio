# Dhruvil Studio - Setup Verification Script

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Dhruvil Studio - Setup Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# Check 1: Node.js
Write-Host "[1/8] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if ($nodeVersion) {
    $majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
    if ($majorVersion -ge 20) {
        Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Node.js version too old: $nodeVersion (needs v20+)" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  ✗ Node.js not found" -ForegroundColor Red
    $errors++
}

# Check 2: npm
Write-Host "[2/8] Checking npm..." -ForegroundColor Yellow
$npmVersion = npm -v 2>$null
if ($npmVersion) {
    $majorVersion = [int]($npmVersion.Split('.')[0])
    if ($majorVersion -ge 10) {
        Write-Host "  ✓ npm installed: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "  ✗ npm version too old: $npmVersion (needs v10+)" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  ✗ npm not found" -ForegroundColor Red
    $errors++
}

# Check 3: Root dependencies
Write-Host "[3/8] Checking root dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ✓ Root dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Root dependencies not installed" -ForegroundColor Red
    Write-Host "    Run: npm install" -ForegroundColor Gray
    $errors++
}

# Check 4: Backend dependencies
Write-Host "[4/8] Checking backend dependencies..." -ForegroundColor Yellow
if (Test-Path "apps\backend\node_modules") {
    Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend dependencies not installed" -ForegroundColor Red
    Write-Host "    Run: cd apps\backend and npm install" -ForegroundColor Gray
    $errors++
}

# Check 5: Frontend dependencies
Write-Host "[5/8] Checking frontend dependencies..." -ForegroundColor Yellow
if (Test-Path "apps\frontend\node_modules") {
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend dependencies not installed" -ForegroundColor Red
    Write-Host "    Run: cd apps\frontend and npm install" -ForegroundColor Gray
    $errors++
}

# Check 6: .env file
Write-Host "[6/8] Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env"
    $hasUrl = $envContent -match "YOUR_SUPABASE"
    if ($hasUrl) {
        Write-Host "  ⚠ Supabase credentials not configured" -ForegroundColor Yellow
        Write-Host "    Update .env with your Supabase URL and Anon Key" -ForegroundColor Gray
        $warnings++
    } else {
        Write-Host "  ✓ Supabase credentials appear to be configured" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ .env file not found" -ForegroundColor Red
    $errors++
}

# Check 7: Supabase setup.sql
Write-Host "[7/8] Checking Supabase setup.sql..." -ForegroundColor Yellow
if (Test-Path "supabase\setup.sql") {
    Write-Host "  ✓ supabase/setup.sql exists" -ForegroundColor Green
    Write-Host "    ⚠ Remember to run this in Supabase SQL Editor" -ForegroundColor Yellow
    $warnings++
} else {
    Write-Host "  ✗ supabase/setup.sql not found" -ForegroundColor Red
    $errors++
}

# Check 8: Layout files
Write-Host "[8/8] Checking layout files..." -ForegroundColor Yellow
$layoutDir = "src\components\layouts"
if (Test-Path "$layoutDir\DashboardLayout.tsx") {
    Write-Host "  ✓ Layout files exist" -ForegroundColor Green
} else {
    Write-Host "  ✗ Layout files missing" -ForegroundColor Red
    $errors++
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Verification Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✓ All checks passed! You're ready to start." -ForegroundColor Green
    Write-Host ""
    Write-Host "Run: npm run dev" -ForegroundColor Cyan
} elseif ($errors -eq 0) {
    Write-Host "⚠ $warnings warning(s) found. Review above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can still run: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "✗ $errors error(s) found. Please fix them before starting." -ForegroundColor Red
    Write-Host ""
    Write-Host "See LOCAL_SETUP_GUIDE.md for detailed instructions" -ForegroundColor Cyan
}

Write-Host ""
