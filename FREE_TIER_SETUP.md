# Dhruvil Studio - Free Tier Setup Guide

## 🎯 Overview

This guide will help you set up **Dhruvil Studio** using 100% free-tier services. No paid subscriptions required!

### Free Services Used:
- **Supabase** (Free Tier): Authentication, Database, and File Storage
- **Docker** (Free): Local development with PostgreSQL, Redis, MinIO
- **GitHub** (Free): Code hosting (optional)

---

## 📋 Prerequisites

### Required Software:
1. **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
2. **npm** (v10 or higher) - Comes with Node.js
3. **Docker Desktop** (Free) - [Download](https://www.docker.com/products/docker-desktop/)
4. **Git** (optional) - [Download](https://git-scm.com/)

### Verify Installations:
```bash
node -v    # Should be v20.x.x or higher
npm -v     # Should be 10.x.x or higher
docker --version
docker-compose --version
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies

You already ran `npm install` at the root. Now install dependencies for sub-apps:

```bash
# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ../..
```

### Step 2: Get Supabase Credentials (Free)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a **FREE** account
3. Click **"New Project"**
4. Fill in:
   - **Name**: `dhruvil-studio`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
5. Wait for project to be created (2-3 minutes)
6. Go to **Project Settings** → **API**
7. Copy these values:
   - **Project URL** → paste in `.env` as `VITE_SUPABASE_URL`
   - **anon/public key** → paste in `.env` as `VITE_SUPABASE_ANON_KEY`

### Step 3: Update .env File

The `.env` file has already been created for you. You just need to update the Supabase credentials:

```bash
# Open .env file in your editor
# Replace these two lines with your actual Supabase credentials:
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

**Example:**
```env
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Start Docker Services

```bash
# Start all services (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Check if services are running
docker-compose ps
```

You should see all services as "Up" or "healthy".

### Step 5: Start the Application

Choose **ONE** of the following methods:

#### Method A: Using Docker (Recommended - Full Stack)
```bash
# This will start frontend, backend, and AI service
docker-compose up -d

# View logs
docker-compose logs -f
```

Access at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **MinIO Console**: http://localhost:9001

#### Method B: Manual Development (Recommended for Development)

Open **3 separate terminals**:

**Terminal 1 - Backend:**
```bash
cd apps/backend
npm run db:generate
npm run db:migrate:dev
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/frontend
npm run dev
```

**Terminal 3 - Root Admin Panel:**
```bash
cd ../..
npx vite --host 127.0.0.1
```

Access at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000
- **Root Admin**: http://localhost:5173

---

## 🔧 Supabase Database Setup

### Option 1: Use Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Paste the following SQL:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  studio_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'ADMIN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  status TEXT DEFAULT 'ACTIVE',
  cover_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_groups_event_id ON groups(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your needs)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (user_id = auth.uid());
```

5. Click **"Run"** to execute

### Option 2: Use Supabase CLI (Advanced)

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

---

## 🎨 Configure Supabase Storage

1. Go to Supabase Dashboard → **Storage**
2. Click **"New Bucket"**
3. Name it: `dhruvil-photos`
4. Make it **Public** (for easy access)
5. Click **"Create Bucket"**

---

## 👤 Create Your First Account

1. Open http://localhost:3000
2. Click **"Sign Up"**
3. Enter your details:
   - **Name**: Your name
   - **Email**: Your email
   - **Password**: Create a strong password
   - **Studio Name**: "Dhruvil Studio" (or your studio name)
4. Click **"Create Account"**
5. Check your email for verification link (if enabled)

**Demo Credentials** (also work):
- Email: `demo@dhruvil.dev`
- Password: `dhruvil123456`

---

## 🛠️ Troubleshooting

### Issue: "Supabase URL or Anon Key is missing"
**Solution**: Make sure you updated the `.env` file with your actual Supabase credentials.

### Issue: Docker containers won't start
**Solution**:
```bash
# Check Docker Desktop is running
# Restart Docker
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs
```

### Issue: Port already in use
**Solution**: Change the port in `.env` or stop the conflicting service:
```bash
# On Windows (PowerShell)
netstat -ano | findstr :3000
# Kill the process using the port
taskkill /PID <PID> /F
```

### Issue: Database connection error
**Solution**:
1. Verify Supabase project is active (not paused)
2. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
3. Try restarting the backend service

### Issue: Cannot upload photos
**Solution**:
1. Ensure Supabase Storage bucket `dhruvil-photos` exists
2. Check bucket is marked as public
3. Verify your RLS policies allow uploads

---

## 📊 Free Tier Limits (Supabase)

As of 2024, Supabase Free Tier includes:
- **Database**: 500 MB
- **File Storage**: 1 GB
- **Bandwidth**: 2 GB/month
- **Auth**: 50,000 MAU (Monthly Active Users)
- **Edge Functions**: 500,000 invocations/month

This is sufficient for:
- Development and testing
- Small personal projects
- MVPs and prototypes
- Up to ~1000 users with moderate usage

---

## 🚀 Production Deployment (Free Options)

When ready to go production, you can use:

### Option 1: Vercel (Free for Next.js)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd apps/frontend
vercel

# Deploy backend (if needed)
cd ../backend
vercel
```

### Option 2: Netlify (Free)
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Option 3: Railway (Free tier available)
- Connect your GitHub repository
- Railway will auto-detect and deploy
- Free tier: $5 credit/month

---

## 📝 Environment Variables Reference

All variables are in `.env` file. Here's what each does:

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | ✅ Yes |
| `POSTGRES_USER` | Local DB username | For Docker |
| `POSTGRES_PASSWORD` | Local DB password | For Docker |
| `POSTGRES_DB` | Local DB name | For Docker |
| `REDIS_PASSWORD` | Redis password | For Docker |
| `MINIO_ACCESS_KEY` | MinIO access key | For Docker |
| `MINIO_SECRET_KEY` | MinIO secret key | For Docker |
| `JWT_SECRET` | Backend JWT secret | For production |
| `SESSION_SECRET` | Backend session secret | For production |
| `NEXT_PUBLIC_API_URL` | Backend API URL | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | ✅ Yes |

---

## 🔒 Security Notes

⚠️ **IMPORTANT**:
1. Never commit `.env` file to Git (it's already in `.gitignore`)
2. Change default secrets before production
3. Use strong passwords for Supabase
4. Enable Row Level Security (RLS) on all tables
5. Regularly backup your Supabase database

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com)
- [Vite Documentation](https://vitejs.dev)

---

## 💡 Tips

1. **Development**: Use manual method (3 terminals) for faster hot-reload
2. **Testing**: Use Docker method for full integration testing
3. **Database**: Use Supabase Dashboard for quick SQL queries
4. **Storage**: Use Supabase Storage instead of MinIO for simplicity
5. **Debugging**: Check browser console and Docker logs for errors

---

## ✅ Checklist

Before starting, ensure you have:
- [ ] Node.js v20+ installed
- [ ] Docker Desktop installed and running
- [ ] Supabase account created
- [ ] Supabase project created
- [ ] `.env` file updated with Supabase credentials
- [ ] Dependencies installed (`npm install` in all directories)
- [ ] Docker services started (`docker-compose up -d`)
- [ ] Database tables created in Supabase
- [ ] Storage bucket created in Supabase

---

## 🆘 Need Help?

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Docker logs: `docker-compose logs`
3. Check browser console for errors
4. Verify all environment variables are set correctly
5. Ensure Supabase project is active (not paused)

---

**Happy Coding! 🎉**
