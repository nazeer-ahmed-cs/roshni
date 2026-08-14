-- Roshni schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  area text not null,
  city text not null,
  status text not null check (status in ('power_out', 'power_back')),
  created_at timestamptz not null default now()
);

-- Everyone can read reports (needed for the live feed / area status)
alter table public.reports enable row level security;

create policy "reports_select_anon" on public.reports
  for select to anon
  using (true);

-- Anonymous users can insert reports (no auth required)
create policy "reports_insert_anon" on public.reports
  for insert to anon
  with check (true);

-- Useful indexes for feed + area queries
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_area_city_idx on public.reports (area, city, created_at);
