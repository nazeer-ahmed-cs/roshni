/**
 * Roshni seed script.
 *
 * Usage:  npm run seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / anon-or-publishable key from .env.local, plus an
 * admin SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) used to seed the
 * canonical `areas` table (the anon role can only read it via RLS).
 * 1. Upserts the canonical `areas` list (by slug) from src/lib/areas-data.ts.
 * 2. Inserts believable 24h outage histories for a handful of those areas so the
 *    Feed and "Check Area" timeline render real bands instead of empty screens.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AREAS_SEED, slugify, discoForCity } from "../src/lib/areas-data";
import type { ReportStatus } from "../src/lib/supabase";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

type Event = { hoursAgo: number; status: ReportStatus };
type AreaSeed = { slug: string; events: Event[] };

const SEED_AREAS: AreaSeed[] = [
  {
    slug: "sukkur-military-road",
    events: [
      { hoursAgo: 22, status: "power_out" },
      { hoursAgo: 20, status: "power_back" },
      { hoursAgo: 11, status: "power_out" },
      { hoursAgo: 9, status: "power_back" },
      { hoursAgo: 2.2, status: "power_out" },
      { hoursAgo: 0.08, status: "power_back" }, // ~5 min ago → currently ON
    ],
  },
  {
    slug: "sukkur-barrage-colony",
    events: [
      { hoursAgo: 21, status: "power_out" },
      { hoursAgo: 19.5, status: "power_back" },
      { hoursAgo: 10, status: "power_out" },
      { hoursAgo: 8.5, status: "power_back" },
      { hoursAgo: 0.15, status: "power_out" }, // ~9 min ago → currently OFF
    ],
  },
  {
    slug: "karachi-gulshan-e-iqbal",
    events: [
      { hoursAgo: 18, status: "power_out" },
      { hoursAgo: 16, status: "power_back" },
      { hoursAgo: 7, status: "power_out" },
      { hoursAgo: 5.5, status: "power_back" },
      { hoursAgo: 3, status: "power_out" },
      { hoursAgo: 0.05, status: "power_back" }, // ~3 min ago → currently ON
    ],
  },
  {
    slug: "karachi-dha-phase-6",
    events: [
      { hoursAgo: 16, status: "power_out" },
      { hoursAgo: 14, status: "power_back" },
      { hoursAgo: 5, status: "power_out" },
      { hoursAgo: 3.5, status: "power_back" },
      { hoursAgo: 0.08, status: "power_out" }, // ~5 min ago → currently OFF
    ],
  },
  {
    slug: "lahore-model-town",
    events: [
      { hoursAgo: 19, status: "power_out" },
      { hoursAgo: 17.5, status: "power_back" },
      { hoursAgo: 8, status: "power_out" },
      { hoursAgo: 6, status: "power_back" },
      { hoursAgo: 0.08, status: "power_out" }, // ~5 min ago → currently OFF
    ],
  },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";
  const adminKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey) {
    console.error(
      "\n❌ Supabase not configured.\n" +
        "  Create .env.local from .env.example with your project's URL + anon/publishable key first.\n"
    );
    process.exit(1);
  }
  if (!adminKey) {
    console.error(
      "\n❌ Admin key missing.\n" +
        "  The anon/publishable role can't write the curated `areas` table.\n" +
        "  Add SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) to .env.local.\n"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Ensure canonical areas exist (idempotent upsert by slug).
  const areaRows = AREAS_SEED.map((a) => ({
    city: a.city,
    disco: discoForCity(a.city),
    area_name: a.area_name,
    slug: slugify(a.city + " " + a.area_name),
  }));
  const { error: areasError } = await supabase.from("areas").upsert(areaRows, {
    onConflict: "slug",
    ignoreDuplicates: true,
  });
  if (areasError) {
    console.error("\n❌ Area upsert failed:", areasError.message);
    process.exit(1);
  }

  const { data: areaData, error: fetchError } = await supabase
    .from("areas")
    .select("id, city, area_name, slug");
  if (fetchError) {
    console.error("\n❌ Area fetch failed:", fetchError.message);
    process.exit(1);
  }
  const bySlug = new Map((areaData ?? []).map((a) => [a.slug, a]));

  // 2) Insert believable reports linked to those areas.
  const now = Date.now();
  const rows: {
    area: string;
    city: string;
    area_id: string;
    status: ReportStatus;
    created_at: string;
  }[] = [];

  for (const seed of SEED_AREAS) {
    const area = bySlug.get(seed.slug);
    if (!area) {
      console.warn(`  ⚠️ Skipping unknown area slug: ${seed.slug}`);
      continue;
    }
    for (const ev of seed.events) {
      rows.push({
        area: area.area_name,
        city: area.city,
        area_id: area.id,
        status: ev.status,
        created_at: new Date(now - ev.hoursAgo * 3_600_000).toISOString(),
      });
    }
  }

  const { data, error } = await supabase
    .from("reports")
    .insert(rows)
    .select("id, area, city, status, created_at");

  if (error) {
    console.error("\n❌ Insert failed:", error.message);
    console.error("  Check RLS policies — run supabase/schema.sql in the SQL editor.\n");
    process.exit(1);
  }

  console.log("\n✅ Seeded " + (data?.length ?? 0) + " reports:\n");
  const byArea = new Map<string, { city: string; count: number; last: ReportStatus }>();
  for (const seed of SEED_AREAS) {
    const area = bySlug.get(seed.slug);
    if (area) byArea.set(area.area_name, { city: area.city, count: 0, last: "power_back" });
  }
  for (const row of rows) {
    const rec = byArea.get(row.area)!;
    rec.count += 1;
    rec.last = row.status;
  }
  for (const [areaName, rec] of Array.from(byArea.entries())) {
    const status = rec.last === "power_out" ? "⚡ OUT now" : "💡 ON now";
    console.log(
      `  ${rec.city.padEnd(9)} ${areaName.padEnd(18)} ${String(rec.count).padEnd(3)} reports   ${status}`
    );
  }
  console.log("\nOpen the app → Check Area tab and search an area to see the 24h timeline.\n");
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
