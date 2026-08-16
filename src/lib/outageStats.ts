import type { SupabaseClient } from "@supabase/supabase-js";

export type OutageStats = {
  areasOut: number;
  areasTracked: number;
};

// Calls the `current_outage_counts` Postgres function (see supabase/schema.sql),
// which returns each area's most recent report status and tallies how many
// currently show `power_out` vs total distinct areas with any reports.
export async function fetchOutageStats(supabase: SupabaseClient): Promise<OutageStats> {
  const { data, error } = await supabase.rpc("current_outage_counts");
  if (error) throw error;
  return {
    areasOut: data?.areas_out ?? 0,
    areasTracked: data?.areas_tracked ?? 0,
  };
}
