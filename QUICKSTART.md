# Dhruvil Studio - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### For Windows Users:

```bash
# 1. Run the automated setup
setup.bat

# 2. Start the development environment
start-dev.bat
```

### For Mac/Linux Users:

```bash
# 1. Make setup script executable
chmod +x setup.sh start-dev.sh

# 2. Run the automated setup
./setup.sh

# 3. Start the development environment
./start-dev.sh
```

---

## 📋 What You Need Before Starting

1. **Node.js** (v20+) - [Download](https://nodejs.org/)
2. **Docker Desktop** (Free) - [Download](https://www.docker.com/products/docker-desktop/)
3. **Supabase Account** (Free) - [Sign Up](https://supabase.com)

---

## 🔑 Required Credentials

### Supabase (Free Tier)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for FREE
3. Create a new project
4. Go to **Project Settings** → **API**
5. Copy:
   - **Project URL** → needed for `.env`
   - **anon/public key** → needed for `.env`

### Update .env File

Open `.env` and replace:
```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

With your actual values like:
```env
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Database Setup

After creating your Supabase project:

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **"New Query"**
3. Copy the contents of `supabase/setup.sql`
4. Paste and click **"Run"**

This will create all required tables, indexes, and security policies.

---

## 📁 Storage Setup

1. Go to **Storage** in Supabase Dashboard
2. Click **"New Bucket"**
3. Name it: `dhruvil-photos`
4. Make it **Public**
5. Click **"Create Bucket"**

---

## 🎯 Access the Application

After running `start-dev.bat` (Windows) or `start-dev.sh` (Mac/Linux):

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Root Admin**: http://localhost:5173
- **MinIO Console**: http://localhost:9001 (if using Docker)

---

## 👤 Demo Account

- **Email**: `demo@dhruvil.dev`
- **Password**: `dhruvil123456`

---

## 🛠️ Manual Setup (If Scripts Don't Work)

### Step 1: Install Dependencies

```bash
# Root directory
npm install

# Backend
cd apps/backend
npm install

# Frontend
cd ../frontend
npm install

# Return to root
cd ../..
```

### Step 2: Configure Environment

Edit `.env` file and add your Supabase credentials.

### Step 3: Start Docker Services

```bash
docker-compose up -d
```

### Step 4: Start Application (3 Terminals)

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

**Terminal 3 - Root Admin:**
```bash
cd ../..
npx vite --host 127.0.0.1
```

---

## 📚 Documentation

- **Full Setup Guide**: [FREE_TIER_SETUP.md](FREE_TIER_SETUP.md)
- **Database Schema**: [supabase/setup.sql](supabase/setup.sql)
- **Original README**: [README.md](README.md)

---

## 🔧 Troubleshooting

### Issue: Docker not found
**Solution**: Install Docker Desktop from https://www.docker.com/products/docker-desktop/

### Issue: Port already in use
**Solution**: Change ports in `.env` file or stop conflicting services

### Issue: Supabase connection error
**Solution**:
- Verify Supabase project is active (not paused)
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Ensure database tables are created (run `supabase/setup.sql`)

### Issue: Cannot upload photos
**Solution**:
- Ensure storage bucket `dhruvil-photos` exists in Supabase
- Check bucket is marked as public
- Verify RLS policies allow uploads

---

## 💡 Tips

1. **Development**: Use `start-dev.bat/sh` for faster hot-reload
2. **Full Stack**: Use `docker-compose up -d` for complete environment
3. **Database**: Use Supabase Dashboard for quick SQL queries
4. **Storage**: Use Supabase Storage (free) instead of MinIO for simplicity

---

## 🆘 Need Help?

1. Check [FREE_TIER_SETUP.md](FREE_TIER_SETUP.md) for detailed instructions
2. Review Docker logs: `docker-compose logs`
3. Check browser console for errors
4. Verify all environment variables in `.env`

---

## ✅ Free Tier Summary

All services used are **100% FREE**:

- **Supabase**: 500 MB database, 1 GB storage, 50K MAU
- **Docker**: Free for local development
- **Node.js**: Free
- **Vite/Next.js**: Free

No paid subscriptions required! 🎉

---

**Happy Coding! 🚀**
