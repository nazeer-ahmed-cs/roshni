# Roshni — Crowd-sourced Load-shedding Tracker (Pakistan)

Built for **Chai aur Code #1** · theme: **Pakistan @79**.

Roshni lets anyone report when the power goes out or comes back in their area. No signup, no
schedules — just raw crowd-sourced reports so you can see what's actually happening around you.

## Stack

- **Next.js 14** (App Router, client components) + **TypeScript**
- **Tailwind CSS** — dark, high-contrast, mobile-first (people check this during outages)
- **Supabase** — Postgres + REST + RLS, no custom server

## Features

1. **Report** — pick city, choose your area from a searchable dropdown (canonical `areas` table),
   tap `⚡ Power Went Out` or `✅ Power Came Back`. Anonymous insert into `reports` with a stable
   `area_id`. Area nahi mila? Users can submit suggestions (approved before going live).
2. **Live feed** — recent reports across all areas, newest first, colored status, relative time,
   auto-refreshes every 30s.
3. **Check Area** — pick an area, get a "POWER ON / POWER OUT" banner plus a 24h timeline bar
   built from consecutive report timestamps (red = outage, green = power).
4. **Notify me when power's back** — on the Check Area tab, if an area is currently on outage, tap
   the button to get a one-shot Web Push notification the moment someone reports `power_back` for it.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # → http://localhost:3000
```

### Supabase setup (2 min)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor** → run everything in [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `reports`, `areas` and `area_suggestions` tables and enables anonymous
   `SELECT` + `INSERT` via RLS.
3. Copy your URL + anon key (Settings → API) into `.env.local`.

The app runs without Supabase configured too — it just shows a setup notice.

### Seed demo data

Seed the canonical area list and populate the `reports` table with believable 24h outage histories
for a few Sukkur/Karachi/Lahore areas so the Feed and Check Area tabs look alive:

```bash
npm run seed   # reads .env.local, upserts ~59 areas, inserts ~27 reports across 5 areas
```

The script writes the curated `areas` table, which the anonymous role can only read (RLS), so you
also need an admin key in `.env.local`: `SUPABASE_SECRET_KEY` (new format) or the legacy
`SUPABASE_SERVICE_ROLE_KEY` (Settings → API). It never ships to the browser.

`npm run seed` first upserts the starter `areas` list (by slug) from
`src/lib/areas-data.ts` — 5 cities × ~10-15 well-known localities with their DISCO — then creates
alternating `power_out`/`power_back` reports per area with the latest one only a few minutes old,
so "Check Area" shows an accurate current status and a real red/green timeline. Re-running it is
idempotent for areas; it appends more reports.

## Push notifications ("Notify me when power's back")

Requires a one-time Supabase CLI setup. The flow:

```
ReportForm (power_back insert)
  → pg_net trigger (schema.sql) → notify-power-back Edge Function
    → web-push to every browser subscribed to that area
    → deletes the subscriptions (one-shot)
```

1. **Generate VAPID keys** (do this once):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Copy the public key into `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the browser needs it
   for `PushManager.subscribe`). Keep the private key server-side only.

2. **Re-run [`supabase/schema.sql`](supabase/schema.sql)** — it now creates the `subscriptions`
   and `app_settings` tables plus the pg_net trigger. Then point the webhook URL at your project:
   ```sql
   update public.app_settings
   set value = 'https://<your-project-ref>.supabase.co/functions/v1/notify-power-back'
   where key = 'push_webhook_url';
   ```

3. **Deploy the Edge Function** and set its secrets. Link the CLI to your project first (this sets
   `project_id` in `supabase/config.toml`):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase functions deploy notify-power-back
   supabase secrets set \
     VAPID_PUBLIC_KEY=<your-vapid-public-key> \
     VAPID_PRIVATE_KEY=<your-vapid-private-key>
   ```
   Then give the function the webhook secret that the DB trigger sends. Read the generated value
   (SQL Editor) and set it on the function:
   ```sql
   select value from public.app_settings where key = 'push_webhook_secret';
   ```
   ```bash
   supabase secrets set WEBHOOK_SECRET=<value-from-above>
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform.

4. **Test**: check an area that shows POWER OUT → tap "🔔 Notify me when power's back" → allow
   notifications → submit a `power_back` report for that area (e.g. via `npm run seed` or the
   Report tab) → the notification should appear.

Notes:
- Notifications are **one-shot** — after a successful `power_back`, the function deletes the
  area's subscriptions. The localStorage flag is cleared the next time you view the area with
  power ON, so you can subscribe again on the next outage.
- The function is `verify_jwt = false` and accepts calls carrying either the webhook secret
  (DB trigger) or a valid `Bearer` service-role key (Dashboard Database Webhook), then ignores
  anything that isn't an INSERT on `reports` with `status = power_back`.
- No subscribers for an area → the function returns `{"notified": 0}` and does nothing.

## Architecture

```
src/
  app/
    layout.tsx        # metadata, dark theme shell
    page.tsx          # tab shell (Report | Feed | Check Area), sticky bottom nav
    globals.css
  components/
    ReportForm.tsx    # feature 1 — anonymous report insert (area dropdown + suggestion link)
    AreaSelect.tsx    # reusable searchable area dropdown (combobox)
    AreaSuggest.tsx   # "nayii area suggest karo" form → area_suggestions
    LiveFeed.tsx      # feature 2 — 30s polling feed
    AreaStatus.tsx    # feature 3+4 — current status, 24h timeline, push-notify button
    SupabaseNotice.tsx# helpful "not configured" state
  lib/
    supabase.ts       # singleton client + env check + Report/Area types
    areas-data.ts     # canonical starter areas (city × DISCO × locality) + slugify
    useAreas.ts       # hook — loads areas + cities from the areas table
    push.ts           # feature 4 — browser push subscribe (VAPID + subscriptions insert)
    time.ts           # relative time / formatting helpers
public/
  sw.js               # feature 4 — service worker: shows push + handles click
scripts/
  seed.ts             # npm run seed — upserts areas, inserts demo reports
supabase/
  schema.sql          # tables + RLS policies + indexes + notify trigger
  config.toml         # Edge Functions CLI config
  functions/
    notify-power-back/# feature 4 — sends the one-shot web push on power_back
```

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo at vercel.com → add the two `NEXT_PUBLIC_SUPABASE_*` env vars → Deploy.

## Out of scope (deliberately)

No auth, no maps, no prediction — anonymous reports + one-shot power-back push alerts, kept simple
for a 2-hour build.
