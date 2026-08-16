-- Roshni schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Canonical list of localities. Reports link to this via area_id so data
-- aggregates on a stable key instead of fuzzy free-text.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  disco text not null,        -- e.g. 'K-Electric', 'HESCO', 'SEPCO'
  area_name text not null,
  slug text unique not null,  -- e.g. 'karachi-dha-phase-6'
  created_at timestamptz not null default now()
);

-- Anonymous area suggestions, approved/rejected manually before going live.
create table if not exists public.area_suggestions (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  disco text,
  area_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  area text not null,         -- legacy free-text, kept temporarily for migration/fallback
  city text not null,
  area_id uuid references public.areas (id) on delete set null,
  status text not null check (status in ('power_out', 'power_back')),
  created_at timestamptz not null default now()
);

-- Migration: add area_id to reports tables created before the areas feature.
-- Safe to run repeatedly (no-op once the column exists).
alter table public.reports add column if not exists
  area_id uuid references public.areas (id) on delete set null;

-- Everyone can read areas (needed for the searchable dropdowns)
alter table public.areas enable row level security;

drop policy if exists "areas_select_anon" on public.areas;
create policy "areas_select_anon" on public.areas
  for select to anon
  using (true);

-- Anonymous users can suggest new areas (approval happens out-of-band)
alter table public.area_suggestions enable row level security;

drop policy if exists "area_suggestions_insert_anon" on public.area_suggestions;
create policy "area_suggestions_insert_anon" on public.area_suggestions
  for insert to anon
  with check (true);

drop policy if exists "area_suggestions_select_anon" on public.area_suggestions;
create policy "area_suggestions_select_anon" on public.area_suggestions
  for select to anon
  using (true);

-- Everyone can read reports (needed for the live feed / area status)
alter table public.reports enable row level security;

drop policy if exists "reports_select_anon" on public.reports;
create policy "reports_select_anon" on public.reports
  for select to anon
  using (true);

-- Anonymous users can insert reports (no auth required)
drop policy if exists "reports_insert_anon" on public.reports;
create policy "reports_insert_anon" on public.reports
  for insert to anon
  with check (true);

-- Useful indexes for feed + area queries
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_area_city_idx on public.reports (area, city, created_at);
create index if not exists reports_area_id_idx on public.reports (area_id, created_at desc);

-- =====================================================================
-- Push notifications — "Notify me when power's back"
-- =====================================================================

-- One-shot subscriptions: an area + the browser's push subscription JSON.
-- Anonymous users may INSERT only (they never need to read/update/delete;
-- the Edge Function deletes rows once notifications are sent).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  push_subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_insert_anon" on public.subscriptions;
create policy "subscriptions_insert_anon" on public.subscriptions
  for insert to anon
  with check (true);

create index if not exists subscriptions_area_id_idx on public.subscriptions (area_id);

-- Local webhook settings used by the DB trigger to call the Edge Function.
-- No RLS policies => the anonymous role can't read/write these; the admin
-- (service/secret key) role can. The URL must point at YOUR project:
--   update public.app_settings
--   set value = 'https://<your-project-ref>.supabase.co/functions/v1/notify-power-back'
--   where key = 'push_webhook_url';
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
select 'push_webhook_secret', gen_random_uuid()::text
where not exists (select 1 from public.app_settings where key = 'push_webhook_secret');

insert into public.app_settings (key, value)
select 'push_webhook_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify-power-back'
where not exists (select 1 from public.app_settings where key = 'push_webhook_url');

-- Fire the Edge Function when a `power_back` report lands so it can notify
-- everyone subscribed to that area. Subscriptions are one-shot: the function
-- deletes them after notifying.
create extension if not exists pg_net;

create or replace function public.notify_power_back_webhook()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  if new.status <> 'power_back' or new.area_id is null then
    return new;
  end if;

  select value into webhook_url from public.app_settings where key = 'push_webhook_url';
  select value into webhook_secret from public.app_settings where key = 'push_webhook_secret';
  if webhook_url is null or webhook_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', jsonb_build_object(
        'id', new.id,
        'area', new.area,
        'city', new.city,
        'area_id', new.area_id,
        'status', new.status,
        'created_at', new.created_at
      )
    )
  );
  return new;
end;
$$;

drop trigger if exists reports_notify_power_back on public.reports;
create trigger reports_notify_power_back
after insert on public.reports
for each row execute function public.notify_power_back_webhook();

-- =====================================================================
-- Report flags — lightweight "this report may be wrong" signal
-- =====================================================================

-- Anonymous users may INSERT only; no client-side select for now. Admin review
-- (if added later) would use the service key / an RLS-restricted select policy.
-- Note: reports.id is bigint (identity), not uuid, so the FK is bigint.
create table if not exists public.report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id bigint references public.reports (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.report_flags enable row level security;

drop policy if exists "report_flags_insert_anon" on public.report_flags;
create policy "report_flags_insert_anon" on public.report_flags
  for insert to anon
  with check (true);

create index if not exists report_flags_report_id_idx on public.report_flags (report_id);

-- =====================================================================
-- Live nationwide counter — "X areas currently reporting outages"
-- =====================================================================

-- Latest status per area, then tally how many show power_out vs total distinct
-- areas with any reports. Called from the client via
--   select * from current_outage_counts();
-- Returns jsonb: { "areas_out": int, "areas_tracked": int }
create or replace function public.current_outage_counts()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'areas_out', count(*) filter (where latest.status = 'power_out'),
    'areas_tracked', count(latest.area_id)
  )
  from (
    select distinct on (area_id) area_id, status
    from public.reports
    where area_id is not null
    order by area_id, created_at desc
  ) latest;
$$;
