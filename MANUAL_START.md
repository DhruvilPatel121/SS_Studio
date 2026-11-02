# Dhruvil Studio - Manual Start Commands

## Option 1: Start Root Admin Only (Simplest)

If you just want to run the main admin panel (the Vite app in the root):

```powershell
cd F:\Client\SS_Studio
npx vite --host 127.0.0.1
```

Access at: http://localhost:5173

---

## Option 2: Start Frontend Only (Next.js App)

If you just want to run the Next.js frontend:

```powershell
cd F:\Client\SS_Studio\apps\frontend
npm run dev
```

Access at: http://localhost:3000

---

## Option 3: Start Backend Only

If you just want to run the backend API:

```powershell
cd F:\Client\SS_Studio\apps\backend
npm run dev
```

Access at: http://localhost:4000

---

## Option 4: Start All Three (Using tmux/terminal multiplexer)

If you have a terminal multiplexer like tmux or Windows Terminal, you can split your terminal and run each service in a separate pane.

---

## Option 5: Start One at a Time (Recommended for Testing)

**Step 1: Start Backend**
```powershell
cd F:\Client\SS_Studio\apps\backend
npm run dev
```
Keep this window open.

**Step 2: Open new PowerShell window, start Frontend**
```powershell
cd F:\Client\SS_Studio\apps\frontend
npm run dev
```
Keep this window open.

**Step 3: Open new PowerShell window, start Admin**
```powershell
cd F:\Client\SS_Studio
npx vite --host 127.0.0.1
```
Keep this window open.

---

## Which one should you start?

Since you haven't set up Supabase yet, I recommend:

**Start with the Root Admin (Option 1)** - This is the main Vite application in the root directory. It might work without Supabase if it has a demo mode or local fallback.

```powershell
cd F:\Client\SS_Studio
npx vite --host 127.0.0.1
```

If it requires Supabase, you'll see an error in the browser console telling you what's missing.

---

## To Stop Services

Just press `Ctrl+C` in the terminal where the service is running.
