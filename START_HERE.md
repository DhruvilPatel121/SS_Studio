# 🚀 Dhruvil Studio - Start Here

## Quick Start Steps (Complete Setup)

### Step 1: Install Dependencies (if not done)
```powershell
cd F:\Client\SS_Studio
npm install
cd apps\backend
npm install
cd ../frontend
npm install
cd ../..
```

### Step 2: Set Up Supabase (FREE - Required)

1. **Create Account**: Go to https://supabase.com and sign up (FREE)
2. **Create Project**: Click "New Project", name it `dhruvil-studio`
3. **Get Credentials**:
   - Go to Settings → API
   - Copy **Project URL** and **anon/public key**
4. **Update .env File**:
   - Open `.env` in the root directory
   - Replace:
     ```
     VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
     VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
     ```
   - With your actual credentials

### Step 3: Set Up Database

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Copy contents of `supabase/setup.sql`
4. Paste and click **"Run"**

### Step 4: Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **"New Bucket"**
3. Name it: `dhruvil-photos`
4. Make it **Public**
5. Click **"Create Bucket"**

### Step 5: Start the Application

```powershell
cd F:\Client\SS_Studio
npm run dev
```

Access at: **http://localhost:5173**

---

## 📚 Documentation

- **LOCAL_SETUP_GUIDE.md** - Complete detailed setup guide
- **FREE_TIER_SETUP.md** - Free-tier configuration
- **COMPLETE_GUIDE.md** - Full project overview
- **QUICKSTART.md** - Quick reference

---

## ✅ What You Need

- Node.js v20+ (https://nodejs.org/)
- Supabase account (FREE - https://supabase.com/)
- PowerShell (built-in on Windows)

---

## 🎯 You're Ready!

After completing Steps 1-5, your app will be fully configured and running locally!

**To start in the future:**
```powershell
cd F:\Client\SS_Studio
npm run dev
```

Happy coding! 🚀
