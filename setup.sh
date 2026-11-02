#!/bin/bash

# ============================================
# DHDRVIL STUDIO - AUTOMATED SETUP SCRIPT
# ============================================
# This script helps you set up the project quickly
# ============================================

set -e  # Exit on error

echo "=========================================="
echo "  Dhruvil Studio - Setup Script"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js v20 or higher from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not found. Please install npm (comes with Node.js)"
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker installed: $DOCKER_VERSION"
else
    print_warning "Docker not found. Docker is required for running services."
    print_warning "Please install Docker Desktop from https://www.docker.com/products/docker-desktop/"
    echo ""
    read -p "Continue without Docker? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "  Installing Dependencies"
echo "=========================================="
echo ""

# Install root dependencies
echo "Installing root dependencies..."
npm install
print_success "Root dependencies installed"

# Install backend dependencies
echo "Installing backend dependencies..."
cd apps/backend
npm install
print_success "Backend dependencies installed"

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install
print_success "Frontend dependencies installed"

# Return to root
cd ../..

echo ""
echo "=========================================="
echo "  Environment Configuration"
echo "=========================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    print_warning ".env file already exists"
    read -p "Do you want to overwrite it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm .env
        print_success "Existing .env file removed"
    else
        print_warning "Keeping existing .env file"
    fi
fi

# Check if .env needs to be created
if [ ! -f .env ]; then
    print_warning ".env file not found"
    echo ""
    echo "You need to set up Supabase to continue:"
    echo "1. Go to https://supabase.com"
    echo "2. Sign up for a FREE account"
    echo "3. Create a new project"
    echo "4. Go to Project Settings → API"
    echo "5. Copy your Project URL and anon/public key"
    echo ""
    read -p "Have you set up Supabase? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your Supabase Project URL: " SUPABASE_URL
        read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY

        # Update .env file
        sed -i "s|VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE|VITE_SUPABASE_URL=$SUPABASE_URL|" .env
        sed -i "s|VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE|VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" .env

        print_success ".env file updated with Supabase credentials"
    else
        print_warning "Skipping .env configuration. You'll need to update it manually."
    fi
fi

echo ""
echo "=========================================="
echo "  Database Setup"
echo "=========================================="
echo ""

print_warning "You need to set up your Supabase database."
echo ""
echo "Steps:"
echo "1. Go to your Supabase project dashboard"
echo "2. Click 'SQL Editor' in the left sidebar"
echo "3. Click 'New Query'"
echo "4. Copy and paste the contents of: supabase/setup.sql"
echo "5. Click 'Run' to execute"
echo ""
read -p "Have you set up the database? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Skipping database setup. You'll need to do this manually."
fi

echo ""
echo "=========================================="
echo "  Storage Setup"
echo "=========================================="
echo ""

print_warning "You need to create a storage bucket in Supabase."
echo ""
echo "Steps:"
echo "1. Go to Storage in your Supabase dashboard"
echo "2. Click 'New Bucket'"
echo "3. Name it: dhruvil-photos"
echo "4. Make it public"
echo "5. Click 'Create Bucket'"
echo ""
read -p "Have you created the storage bucket? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Skipping storage setup. You'll need to do this manually."
fi

echo ""
echo "=========================================="
echo "  Starting Services"
echo "=========================================="
echo ""

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Starting Docker services..."
    docker-compose up -d
    print_success "Docker services started"

    echo ""
    echo "Waiting for services to be healthy..."
    sleep 10

    echo ""
    docker-compose ps
else
    print_warning "Docker not available. You'll need to start services manually."
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
print_success "Installation complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the application:"
echo ""
echo "   Option A - Using Docker (Full Stack):"
echo "   docker-compose up -d"
echo ""
echo "   Option B - Manual Development (3 terminals):"
echo "   Terminal 1: cd apps/backend && npm run dev"
echo "   Terminal 2: cd apps/frontend && npm run dev"
echo "   Terminal 3: npx vite --host 127.0.0.1"
echo ""
echo "2. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:4000"
echo "   Root Admin: http://localhost:5173"
echo ""
echo "3. Create your account:"
echo "   Email: demo@dhruvil.dev"
echo "   Password: dhruvil123456"
echo ""
echo "For detailed instructions, see: FREE_TIER_SETUP.md"
echo ""
