/**
 * Roshni seed script.
 *
 * Usage:  npm run seed
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
 * and inserts believable 24h outage histories for a handful of demo areas so the
 * Feed and "Check Area" timeline render real bands instead of empty screens.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
type AreaSeed = { area: string; city: string; events: Event[] };

const SEED_AREAS: AreaSeed[] = [
  {
    area: "Military Road",
    city: "Sukkur",
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
    area: "Barrage Colony",
    city: "Sukkur",
    events: [
      { hoursAgo: 21, status: "power_out" },
      { hoursAgo: 19.5, status: "power_back" },
      { hoursAgo: 10, status: "power_out" },
      { hoursAgo: 8.5, status: "power_back" },
      { hoursAgo: 0.15, status: "power_out" }, // ~9 min ago → currently OFF
    ],
  },
  {
    area: "Gulshan-e-Iqbal",
    city: "Karachi",
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
    area: "DHA Phase 6",
    city: "Karachi",
    events: [
      { hoursAgo: 16, status: "power_out" },
      { hoursAgo: 14, status: "power_back" },
      { hoursAgo: 5, status: "power_out" },
      { hoursAgo: 3.5, status: "power_back" },
      { hoursAgo: 0.08, status: "power_out" }, // ~5 min ago → currently OFF
    ],
  },
  {
    area: "Model Town",
    city: "Lahore",
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
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    console.error(
      "\n❌ Supabase not configured.\n" +
        "  Create .env.local from .env.example with your project's URL + anon/publishable key first.\n"
    );
    process.exit(1);
  }

  const { getSupabase } = await import("../src/lib/supabase");
  const supabase = getSupabase();
  const now = Date.now();

  const rows: { area: string; city: string; status: ReportStatus; created_at: string }[] = [];

  for (const seed of SEED_AREAS) {
    for (const ev of seed.events) {
      rows.push({
        area: seed.area,
        city: seed.city,
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
  for (const seed of SEED_AREAS) byArea.set(seed.area, { city: seed.city, count: 0, last: "power_back" });
  for (const row of rows) {
    const rec = byArea.get(row.area)!;
    rec.count += 1;
    rec.last = row.status;
  }
  for (const seed of SEED_AREAS) {
    const rec = byArea.get(seed.area)!;
    const status = rec.last === "power_out" ? "⚡ OUT now" : "💡 ON now";
    console.log(`  ${rec.city.padEnd(9)} ${seed.area.padEnd(18)} ${String(rec.count).padEnd(3)} reports   ${status}`);
  }
  console.log("\nOpen the app → Check Area tab and search an area to see the 24h timeline.\n");
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
