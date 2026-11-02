#!/bin/bash

# ============================================
# DHDRVIL STUDIO - QUICK START (Linux/Mac)
# ============================================
# This script starts all services for development
# ============================================

echo "=========================================="
echo "  Dhruvil Studio - Quick Start"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "[ERROR] .env file not found!"
    echo "Please run setup.sh first to configure the project."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d node_modules ]; then
    echo "[WARNING] Root dependencies not found. Installing..."
    npm install
fi

if [ ! -d apps/backend/node_modules ]; then
    echo "[WARNING] Backend dependencies not found. Installing..."
    cd apps/backend && npm install && cd ../..
fi

if [ ! -d apps/frontend/node_modules ]; then
    echo "[WARNING] Frontend dependencies not found. Installing..."
    cd apps/frontend && npm install && cd ../..
fi

echo ""
echo "Starting development environment..."
echo ""

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Starting Docker services (PostgreSQL, Redis, MinIO)..."
    docker-compose up -d

    echo ""
    echo "Waiting for services to be ready..."
    sleep 5

    echo ""
    echo "Docker services status:"
    docker-compose ps
    echo ""
else
    echo "[WARNING] Docker not found. Skipping database services."
    echo "Please ensure PostgreSQL, Redis, and MinIO are running manually."
    echo ""
fi

echo "Starting application services..."
echo ""
echo "Opening 3 terminal windows for:"
echo "  1. Backend (Port 4000)"
echo "  2. Frontend (Port 3000)"
echo "  3. Root Admin (Port 5173)"
echo ""

# Detect OS and open terminals accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/apps/backend && npm run dev"'
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/apps/frontend && npm run dev"'
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && npx vite --host 127.0.0.1"'
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try different terminal emulators
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd $(pwd)/apps/backend && npm run dev; exec bash"
        gnome-terminal -- bash -c "cd $(pwd)/apps/frontend && npm run dev; exec bash"
        gnome-terminal -- bash -c "cd $(pwd) && npx vite --host 127.0.0.1; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd $(pwd)/apps/backend && npm run dev" &
        xterm -e "cd $(pwd)/apps/frontend && npm run dev" &
        xterm -e "cd $(pwd) && npx vite --host 127.0.0.1" &
    else
        echo "[WARNING] Could not detect terminal emulator."
        echo "Please manually run these commands in 3 separate terminals:"
        echo "  Terminal 1: cd apps/backend && npm run dev"
        echo "  Terminal 2: cd apps/frontend && npm run dev"
        echo "  Terminal 3: npx vite --host 127.0.0.1"
    fi
fi

echo ""
echo "=========================================="
echo "  Services Started!"
echo "=========================================="
echo ""
echo "Access points:"
echo "  Frontend:     http://localhost:3000"
echo "  Backend API:  http://localhost:4000"
echo "  Root Admin:   http://localhost:5173"
echo "  MinIO Console: http://localhost:9001 (if Docker is running)"
echo ""
echo "Demo credentials:"
echo "  Email:    demo@dhruvil.dev"
echo "  Password: dhruvil123456"
echo ""
echo "Press Ctrl+C in each terminal to stop services."
echo "Or run: docker-compose down (to stop Docker services)"
echo ""
