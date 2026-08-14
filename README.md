# Roshni — Crowd-sourced Load-shedding Tracker (Pakistan)

Built for **Chai aur Code #1** · theme: **Pakistan @79**.

Roshni lets anyone report when the power goes out or comes back in their area. No signup, no
schedules — just raw crowd-sourced reports so you can see what's actually happening around you.

## Stack

- **Next.js 14** (App Router, client components) + **TypeScript**
- **Tailwind CSS** — dark, high-contrast, mobile-first (people check this during outages)
- **Supabase** — Postgres + REST + RLS, no custom server

## Features

1. **Report** — pick city, type area (Sukkur localities pre-loaded as suggestions), tap
   `⚡ Power Went Out` or `✅ Power Came Back`. Anonymous insert into `reports`.
2. **Live feed** — recent reports across all areas, newest first, colored status, relative time,
   auto-refreshes every 30s.
3. **Check Area** — pick an area, get a "POWER ON / POWER OUT" banner plus a 24h timeline bar
   built from consecutive report timestamps (red = outage, green = power).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # → http://localhost:3000
```

### Supabase setup (2 min)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor** → run everything in [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `reports` table and enables anonymous `SELECT` + `INSERT` via RLS.
3. Copy your URL + anon key (Settings → API) into `.env.local`.

The app runs without Supabase configured too — it just shows a setup notice.

### Seed demo data

Before a demo, populate the `reports` table with believable 24h outage histories for a few
Sukkur/Karachi/Lahore areas so the Feed and Check Area tabs look alive:

```bash
npm run seed   # reads .env.local, inserts ~27 reports across 5 areas
```

The seed creates alternating `power_out`/`power_back` reports per area with the latest one only a
few minutes old, so "Check Area" shows an accurate current status and a real red/green timeline.
Re-running it appends more reports.

## Architecture

```
src/
  app/
    layout.tsx        # metadata, dark theme shell
    page.tsx          # tab shell (Report | Feed | Check Area), sticky bottom nav
    globals.css
  components/
    ReportForm.tsx    # feature 1 — anonymous report insert
    LiveFeed.tsx      # feature 2 — 30s polling feed
    AreaStatus.tsx    # feature 3 — current status + 24h timeline
    SupabaseNotice.tsx# helpful "not configured" state
  lib/
    supabase.ts       # singleton client + env check + Report types
    constants.ts      # cities + seeded Sukkur areas
    time.ts           # relative time / formatting helpers
scripts/
  seed.ts             # npm run seed — inserts demo reports
supabase/
  schema.sql          # table + RLS policies + indexes
```

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo at vercel.com → add the two `NEXT_PUBLIC_SUPABASE_*` env vars → Deploy.

## Out of scope (deliberately)

No auth, no push notifications, no maps, no prediction — just anonymous reports, kept simple for a
2-hour build.
