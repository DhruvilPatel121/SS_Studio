# Dhruvil Studio - Complete Setup & Start Guide

## 📁 Project Structure Overview

```
F:\Client\SS_Studio/
├── apps/
│   ├── backend/          # Fastify API with Prisma ORM
│   │   ├── src/          # Backend source code
│   │   ├── prisma/       # Database schema
│   │   └── package.json  # Backend dependencies
│   └── frontend/         # Next.js frontend application
│       ├── src/          # Frontend source code
│       └── package.json  # Frontend dependencies
├── services/
│   └── ai-service/       # AI service for face recognition
├── src/                  # Root React Admin Panel (Vite)
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── contexts/        # React contexts
│   ├── services/        # API services
│   └── routes.tsx       # Route configuration
├── supabase/
│   ├── config.toml      # Supabase configuration
│   └── setup.sql        # Database schema
├── docker-compose.yml   # Docker services (PostgreSQL, Redis, MinIO)
├── package.json         # Root dependencies (Admin Panel)
├── vite.config.ts       # Vite configuration
└── .env                 # Environment variables
```

---

## 🎯 Three Applications in This Project

### 1. **Root Admin Panel** (Vite + React)
- **Location**: Root directory
- **Purpose**: Main admin interface
- **Port**: 5173
- **Start**: `npm run dev` (from root)

### 2. **Frontend** (Next.js)
- **Location**: `apps/frontend/`
- **Purpose**: User-facing web application
- **Port**: 3000
- **Start**: `cd apps/frontend && npm run dev`

### 3. **Backend** (Fastify + Prisma)
- **Location**: `apps/backend/`
- **Purpose**: API server
- **Port**: 4000
- **Start**: `cd apps/backend && npm run dev`

---

## 🚀 Quick Start (Choose One Method)

### Method A: Start Root Admin Panel Only (Simplest)

**Best for**: Quick development of the admin panel

```powershell
cd F:\Client\SS_Studio
npm run dev
```

Access at: **http://localhost:5173**

---

### Method B: Start All Three Apps (Manual - 3 Terminals)

**Best for**: Full-stack development

**Terminal 1 - Backend:**
```powershell
cd F:\Client\SS_Studio\apps\backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd F:\Client\SS_Studio\apps\frontend
npm run dev
```

**Terminal 3 - Root Admin:**
```powershell
cd F:\Client\SS_Studio
npm run dev
```

Access points:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Root Admin: http://localhost:5173

---

### Method C: Using Docker (Full Stack with Database)

**Best for**: Complete environment with database

```powershell
cd F:\Client\SS_Studio
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (port 9000/9001)
- Backend (port 4000)
- Frontend (port 3000)
- Root Admin (port 5173)

Access points:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Root Admin: http://localhost:5173
- MinIO Console: http://localhost:9001

Stop services:
```powershell
docker-compose down
```

---

## 📋 Available NPM Scripts

### Root (Admin Panel)
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run linting
```

### Backend (`apps/backend/`)
```bash
npm run dev                # Start development server
npm run build              # Build TypeScript
npm run start              # Start production server
npm run db:migrate         # Run database migrations
npm run db:migrate:dev     # Run dev migrations
npm run db:generate        # Generate Prisma client
npm run db:seed            # Seed database
npm run db:reset           # Reset database
npm run test               # Run tests
```

### Frontend (`apps/frontend/`)
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run linting
```

---

## 🔑 Prerequisites

### Required Software:

1. **Node.js** (v20 or higher)
   - Download: https://nodejs.org/
   - Check: `node -v`

2. **npm** (v10 or higher)
   - Comes with Node.js
   - Check: `npm -v`

3. **Docker Desktop** (Optional, for full stack)
   - Download: https://www.docker.com/products/docker-desktop/
   - Check: `docker --version`

4. **Supabase Account** (FREE, for database/auth)
   - Sign up: https://supabase.com

---

## ⚙️ Environment Configuration

### Step 1: Create/Update .env File

The `.env` file should be in the root directory. You need to configure Supabase credentials.

**Get Supabase Credentials:**
1. Go to https://supabase.com
2. Sign up for FREE
3. Create a new project
4. Go to **Project Settings** → **API**
5. Copy:
   - **Project URL**
   - **anon/public key**

**Update .env file:**
```env
# Supabase Credentials (REQUIRED)
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

# Database (for Docker/manual setup)
POSTGRES_USER=dhruvil
POSTGRES_PASSWORD=dhruvil_secret_password
POSTGRES_DB=dhruvil_db

# Redis (for Docker/manual setup)
REDIS_PASSWORD=dhruvil_redis_secret

# MinIO Storage (for Docker/manual setup)
MINIO_ACCESS_KEY=dhruvil_minio
MINIO_SECRET_KEY=dhruvil_minio_secret_key
MINIO_BUCKET=dhruvil-photos

# Backend Configuration
DATABASE_URL=postgresql://dhruvil:dhruvil_secret_password@localhost:5432/dhruvil_db
REDIS_URL=redis://:dhruvil_redis_secret@localhost:6379
JWT_SECRET=dhruvil_jwt_secret_change_in_production
SESSION_SECRET=dhruvil_session_secret_change_in_production
AI_SERVICE_URL=http://localhost:8000
APP_URL=http://localhost:3000
PORT=4000

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Dhruvil Studio
NEXT_PUBLIC_BRAND_COLOR=6366f1

# Demo Account
DEMO_EMAIL=demo@dhruvil.dev
DEMO_PASSWORD=dhruvil123456

# Sentry (Optional - for error tracking)
VITE_SENTRY_DSN=
```

---

## 🗄️ Database Setup

### Option 1: Using Supabase (Recommended - FREE)

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create a new project
   - Wait for it to be ready (2-3 minutes)

2. **Run Database Schema**
   - Go to Supabase Dashboard → **SQL Editor**
   - Click **"New Query"**
   - Copy contents of `supabase/setup.sql`
   - Paste and click **"Run"**

3. **Create Storage Bucket**
   - Go to **Storage** in Supabase Dashboard
   - Click **"New Bucket"**
   - Name it: `dhruvil-photos`
   - Make it **Public**
   - Click **"Create Bucket"**

### Option 2: Using Docker (Local)

```powershell
docker-compose up -d postgres redis minio
```

Then run migrations:
```powershell
cd apps/backend
npm run db:generate
npm run db:migrate:dev
```

---

## 📦 Installing Dependencies

### Install All Dependencies:

```powershell
# Root (Admin Panel)
cd F:\Client\SS_Studio
npm install

# Backend
cd apps\backend
npm install

# Frontend
cd apps\frontend
npm install
```

### If Already Installed:
Check if `node_modules` exists in each directory. If yes, you're good to go!

---

## 🎯 Complete Start Sequence

### Scenario 1: Development with Supabase (No Docker)

```powershell
# 1. Ensure dependencies are installed
cd F:\Client\SS_Studio
npm install
cd apps\backend && npm install
cd ../frontend && npm install
cd ../..

# 2. Configure .env with Supabase credentials
# (Edit .env file and add your Supabase URL and Anon Key)

# 3. Set up Supabase database
# (Run supabase/setup.sql in Supabase Dashboard SQL Editor)

# 4. Create storage bucket in Supabase
# (Create 'dhruvil-photos' bucket in Supabase Storage)

# 5. Start all services (3 terminals)
# Terminal 1:
cd apps\backend
npm run dev

# Terminal 2:
cd apps\frontend
npm run dev

# Terminal 3:
cd ..
npm run dev
```

### Scenario 2: Development with Docker (Full Stack)

```powershell
# 1. Ensure dependencies are installed
cd F:\Client\SS_Studio
npm install
cd apps\backend && npm install
cd ../frontend && npm install
cd ../..

# 2. Configure .env file
# (Edit with your credentials)

# 3. Start Docker services
docker-compose up -d

# 4. Wait for services to be healthy
docker-compose ps

# 5. View logs
docker-compose logs -f

# 6. Access applications
# Frontend: http://localhost:3000
# Backend: http://localhost:4000
# Root Admin: http://localhost:5173
```

### Scenario 3: Quick Test (Root Admin Only)

```powershell
cd F:\Client\SS_Studio
npm run dev
```

Access at: http://localhost:5173

---

## 🔍 Troubleshooting

### Issue: "Cannot find module"
**Solution**: Run `npm install` in the affected directory

### Issue: "Port already in use"
**Solution**:
- Change port in `.env` file
- Or stop the conflicting service:
  ```powershell
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

### Issue: "Supabase connection error"
**Solution**:
- Verify Supabase project is active (not paused)
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Ensure database tables are created (run `supabase/setup.sql`)

### Issue: "Docker not found"
**Solution**: Install Docker Desktop from https://www.docker.com/products/docker-desktop/

### Issue: Frontend npm install fails
**Solution**:
```powershell
cd apps\frontend
rm -rf node_modules package-lock.json
npm install --force
```

---

## 📊 Access Points Summary

| Application | Port | URL | Purpose |
|-------------|------|-----|---------|
| Root Admin (Vite) | 5173 | http://localhost:5173 | Admin Panel |
| Frontend (Next.js) | 3000 | http://localhost:3000 | User App |
| Backend API | 4000 | http://localhost:4000 | API Server |
| PostgreSQL | 5432 | localhost:5432 | Database |
| Redis | 6379 | localhost:6379 | Cache |
| MinIO API | 9000 | http://localhost:9000 | Storage |
| MinIO Console | 9001 | http://localhost:9001 | Storage UI |

---

## 👤 Demo Credentials

- **Email**: `demo@dhruvil.dev`
- **Password**: `dhruvil123456`

---

## 📚 Documentation Files

- **FREE_TIER_SETUP.md** - Detailed free-tier setup with Supabase
- **QUICKSTART.md** - 5-minute quick start guide
- **SETUP_SUMMARY.md** - Complete setup summary
- **NEXT_STEPS.md** - Immediate action items
- **MANUAL_START.md** - Manual start commands
- **README.md** - Original project documentation

---

## 🎨 Tech Stack

### Root Admin Panel
- Vite
- React 18
- TypeScript
- React Router
- TanStack Query
- Supabase
- Tailwind CSS
- Radix UI

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Radix UI

### Backend
- Fastify
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- MinIO

---

## 💡 Tips

1. **Start Simple**: Begin with just the root admin panel (`npm run dev`)
2. **Use Supabase**: It's free and easier than setting up local databases
3. **Check Logs**: Always check browser console and terminal logs for errors
4. **Environment Variables**: Never commit `.env` file (it's in `.gitignore`)
5. **Hot Reload**: All apps support hot reload during development

---

## ✅ Pre-Start Checklist

Before starting the application:

- [ ] Node.js v20+ installed
- [ ] npm v10+ installed
- [ ] Dependencies installed in all directories
- [ ] `.env` file configured with Supabase credentials
- [ ] Supabase project created
- [ ] Database schema run (`supabase/setup.sql`)
- [ ] Storage bucket created (`dhruvil-photos`)
- [ ] Docker Desktop installed (if using Docker)

---

## 🆘 Getting Help

1. Check the documentation files in the root directory
2. Review terminal logs for errors
3. Check browser console for errors
4. Verify environment variables in `.env`
5. Ensure Supabase project is active

---

## 🎉 You're Ready!

Choose your start method and begin development:

**Quick Start (Root Admin Only):**
```powershell
cd F:\Client\SS_Studio
npm run dev
```

**Full Stack (3 Terminals):**
```powershell
# Terminal 1
cd apps\backend && npm run dev

# Terminal 2
cd apps\frontend && npm run dev

# Terminal 3
cd .. && npm run dev
```

**Docker (Complete Environment):**
```powershell
docker-compose up -d
```

Happy Coding! 🚀
