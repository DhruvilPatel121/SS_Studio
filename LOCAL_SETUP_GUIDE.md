# Dhruvil Studio - Complete Local Setup Guide

## 🎯 Goal: Get the app working 100% locally

This guide will take you through every step needed to configure the project so it works on your local machine.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Node.js v20+** installed
  - Check: `node -v` (should be v20.x.x or higher)
  - Download: https://nodejs.org/

- [ ] **npm v10+** installed
  - Check: `npm -v` (should be 10.x.x or higher)
  - Comes with Node.js

- [ ] **PowerShell** (you're using Windows, so this is built-in)

---

## 🚀 STEP 1: Install All Dependencies

### Run these commands in PowerShell:

```powershell
cd F:\Client\SS_Studio

# Install root dependencies
npm install

# Install backend dependencies
cd apps\backend
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Return to root
cd ../..
```

**Verify:** Check that `node_modules` folders exist in:
- `F:\Client\SS_Studio\node_modules`
- `F:\Client\SS_Studio\apps\backend\node_modules`
- `F:\Client\SS_Studio\apps\frontend\node_modules`

---

## 🔑 STEP 2: Set Up Supabase (FREE - Required for Auth & Database)

### 2.1 Create Supabase Account

1. Go to https://supabase.com
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up using:
   - Email: your email
   - Password: create a password
4. Verify your email (check your inbox)

### 2.2 Create a New Project

1. After logging in, click **"New Project"**
2. Fill in the form:
   - **Name**: `dhruvil-studio`
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Select **Free** (default)
3. Click **"Create new project"**
4. Wait 2-3 minutes for the project to be created

### 2.3 Get Your Credentials

1. Once the project is ready, you'll see the dashboard
2. Click on **Settings** (left sidebar, gear icon)
3. Click on **API** (in the Settings menu)
4. You'll see two important values:

   **Project URL**: Copy this (looks like `https://abc123xyz.supabase.co`)

   **anon/public key**: Copy this (long string starting with `eyJhbGci...`)

5. **Keep these values handy** - you'll need them in the next step

---

## ⚙️ STEP 3: Configure Environment Variables

### 3.1 Open the .env File

The `.env` file is in your project root: `F:\Client\SS_Studio\.env`

Open it in your editor (or use PowerShell):

```powershell
notepad .env
```

### 3.2 Update Supabase Credentials

Find these two lines in the `.env` file:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
```

Replace them with your actual Supabase credentials:

```env
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example:**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInR5cGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9...
```

### 3.3 Save the .env File

Save and close the file.

---

## 🗄️ STEP 4: Set Up Database Schema

### 4.1 Open Supabase SQL Editor

1. Go back to your Supabase project dashboard
2. Click on **SQL Editor** (left sidebar, looks like a terminal icon)
3. Click **"New Query"** button

### 4.2 Copy Database Schema

Open this file in your project:
`F:\Client\SS_Studio\supabase\setup.sql`

Copy the entire content of this file (all 396 lines).

### 4.3 Paste and Run

1. Paste the SQL into the Supabase SQL Editor
2. Click the **"Run"** button (or press `Ctrl+Enter`)
3. Wait for it to complete (should take a few seconds)
4. You should see "Success" message

**What this does:**
- Creates all required tables (profiles, events, photos, groups, etc.)
- Sets up indexes for performance
- Configures Row Level Security (RLS) policies
- Creates triggers for automatic timestamps

---

## 📁 STEP 5: Create Storage Bucket

### 5.1 Open Storage Section

1. In Supabase dashboard, click on **Storage** (left sidebar, folder icon)
2. You'll see the Storage management page

### 5.2 Create New Bucket

1. Click the **"New Bucket"** button (top right)
2. Fill in the form:
   - **Name**: `dhruvil-photos` (must be exactly this, lowercase, hyphen)
   - **Public Bucket**: ✅ Check this box (make it public)
3. Click **"Create Bucket"**

### 5.3 Verify Bucket Created

You should see `dhruvil-photos` listed in your buckets.

---

## 🧪 STEP 6: Test the Application

### 6.1 Start the Development Server

```powershell
cd F:\Client\SS_Studio
npm run dev
```

You should see:
```
VITE v8.3.5  ready in XXX ms

➜  Local:   http://127.0.0.1:5173/
➜  press h + enter to show help
```

### 6.2 Access the Application

Open your browser and go to: **http://localhost:5173**

You should see:
- The Dhruvil Studio landing page
- Hero section with "Dhruvil Studio" branding
- Feature highlights
- Setup instructions in a yellow notice box

### 6.3 Test Navigation

Click through the pages:
- **Home** (/) - Landing page
- **About** (/about) - About page
- **Contact** (/contact) - Contact page
- **Login** (/login) - Login page (will show Supabase required notice)

---

## 🔐 STEP 7: Test Authentication (Optional but Recommended)

### 7.1 Enable Email Confirmations (Optional)

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Find **Email Confirmation**
3. Uncheck **"Enable email confirmations"** (for easier testing)
4. Click **Save**

### 7.2 Test Sign Up

1. Go to http://localhost:5173/register
2. Fill in the form:
   - **Name**: Your name
   - **Email**: Your email
   - **Password**: Create a password
   - **Studio Name**: "Test Studio"
3. Click **"Sign Up"**

### 7.3 Verify User Created

1. Go to Supabase dashboard → **Authentication** → **Users**
2. You should see your new user listed
3. Go to **Database** → **Table Editor** → **profiles**
4. You should see your profile created automatically

### 7.4 Test Login

1. Go to http://localhost:5173/login
2. Enter your email and password
3. Click **"Login"**
4. You should be redirected to the dashboard

---

## 🎨 STEP 8: Customize Your Branding (Optional)

### 8.1 Update App Name in .env

Open `.env` and update:

```env
NEXT_PUBLIC_APP_NAME=Dhruvil Studio
NEXT_PUBLIC_BRAND_COLOR=6366f1
```

You can change the brand color to any hex color code.

### 8.2 Restart the Server

Stop the server (Ctrl+C) and restart:

```powershell
npm run dev
```

---

## 🐛 Troubleshooting

### Issue: "Supabase URL or Anon Key is missing"

**Solution**: Make sure you updated the `.env` file with your actual Supabase credentials.

### Issue: "Failed to resolve import"

**Solution**: This should be fixed now. If you still see it, run:
```powershell
powershell -ExecutionPolicy Bypass -File fix-imports.ps1
```

### Issue: "Database connection error"

**Solution**:
1. Verify Supabase project is active (not paused)
2. Check that you ran the SQL from `supabase/setup.sql`
3. Verify your credentials in `.env` are correct

### Issue: "Cannot upload photos"

**Solution**:
1. Ensure storage bucket `dhruvil-photos` exists
2. Check that the bucket is marked as public
3. Verify RLS policies allow uploads (included in setup.sql)

### Issue: Port already in use

**Solution**:
```powershell
# Find what's using port 5173
netstat -ano | findstr :5173

# Kill the process (replace <PID> with actual PID)
taskkill /PID <PID> /F
```

### Issue: "npm install fails"

**Solution**:
```powershell
# Clear cache and retry
npm cache clean --force
npm install
```

---

## ✅ Verification Checklist

Before declaring success, verify:

- [ ] Node.js and npm are installed
- [ ] All dependencies installed (root, backend, frontend)
- [ ] Supabase account created
- [ ] Supabase project created
- [ ] `.env` file updated with Supabase URL and Anon Key
- [ ] Database schema run in Supabase SQL Editor
- [ ] Storage bucket `dhruvil-photos` created and public
- [ ] Development server starts without errors
- [ ] Can access http://localhost:5173
- [ ] Landing page loads correctly
- [ ] Navigation works (Home, About, Contact, Login)
- [ ] Can sign up for an account
- [ ] Can login with the account

---

## 📊 What You Have Now

After completing these steps, you have:

✅ **Fully configured local development environment**
✅ **Supabase backend** (database, auth, storage)
✅ **Root admin panel** running at http://localhost:5173
✅ **Ability to**:
   - Create user accounts
   - Login/logout
   - Navigate the application
   - Store data in Supabase
   - Upload files to Supabase Storage

---

## 🚀 Next Steps (Optional)

### Option A: Start All Three Applications

If you want to run the full stack (backend + frontend + admin):

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

### Option B: Use Docker (Complete Environment)

If you have Docker Desktop installed:

```powershell
cd F:\Client\SS_Studio
docker-compose up -d
```

This starts PostgreSQL, Redis, MinIO, and all applications.

---

## 📚 Quick Reference

### Start the App:
```powershell
cd F:\Client\SS_Studio
npm run dev
```

### Access Points:
- Root Admin: http://localhost:5173
- Frontend: http://localhost:3000 (if started)
- Backend API: http://localhost:4000 (if started)

### Supabase Dashboard:
- Go to https://supabase.com
- Click on your project

### Demo Credentials (if you want to use these):
- Email: `demo@dhruvil.dev`
- Password: `dhruvil123456`

---

## 🎉 You're Done!

Your Dhruvil Studio application is now fully configured and running locally!

**To start development in the future:**
```powershell
cd F:\Client\SS_Studio
npm run dev
```

That's it! Happy coding! 🚀
