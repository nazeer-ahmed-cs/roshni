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
