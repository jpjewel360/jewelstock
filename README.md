# Scan Gem Flow — Jewellery Inventory System

A full-stack jewellery stock management app with QR code scanning, inventory tracking, sales recording, and audit sessions.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Render (Static Site)

---

## Step 1 — Run Supabase Migrations

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your project → **SQL Editor** → **New query**
3. Paste the contents of `supabase/migrations/20260429075944_initial_schema.sql` → **Run**
4. Create another new query → paste `supabase/migrations/20260429080012_functions_triggers.sql` → **Run**

---

## Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/scan-gem-flow.git
git push -u origin main
```

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → **New → Static Site**
2. Connect your GitHub repo (`scan-gem-flow`)
3. Set:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
4. Under **Environment** tab, add these two variables:
   - `VITE_SUPABASE_URL` = `https://azrpldopnskcaoupaker.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full key)
5. Click **Create Static Site**

Your app will be live at `https://scan-gem-flow.onrender.com`

---

## Step 4 — First Login

1. Go to your live URL
2. Click **Sign Up** and create your account
3. Because you're the **first user**, you automatically get the **admin** role
4. Go to **Admin** → add your jewellery categories (e.g. "Ring 92%", prefix "RNG")
5. Start adding inventory items!

---

## Features

| Feature | Description |
|---|---|
| Dashboard | Live stats: total stock, available, sold, monthly revenue |
| Inventory | Add items with auto serial numbers, view stock, download QR codes |
| Sales | Record sales, track buyer info, see history |
| Scan | Camera QR scanner or manual serial lookup |
| Audit | Start/end stock audit sessions, scan items to verify |
| Admin | Manage jewellery categories and user roles |

## Serial Number Format

Serials are auto-generated as `PREFIX-XXXX` — e.g. `RNG-0001`, `RNG-0002`.
The prefix is set when you create a category in Admin.

## User Roles

- **Admin (first user):** Full access including category management, user management, delete
- **Staff (all others):** Can add inventory, record sales, run audits
