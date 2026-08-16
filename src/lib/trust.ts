import type { SupabaseClient } from "@supabase/supabase-js";
import type { Report, ReportStatus } from "./supabase";

// Trust/agreement: when multiple people report the same status for the same
// area inside a short window, treat the signal as verified instead of as a
// single, equally-uncertain report.
export const AGREEMENT_WINDOW_MS = 30 * 60 * 1000;

export type Agreement = {
  verified: boolean;
  count: number; // reports matching the most recent status within the window
  total: number; // all reports within the window
  status: ReportStatus | null;
};

const NO_AGREEMENT: Agreement = { verified: false, count: 0, total: 0, status: null };

export function agreementKey(report: Pick<Report, "area_id" | "area" | "city">): string {
  return report.area_id ?? `legacy:${report.area}:${report.city}`;
}

// Given all reports for one area, look at the last 30 minutes and count how
// many share the status of the most recent report.
export function computeAgreement(reports: Report[], now = Date.now()): Agreement {
  const windowStart = now - AGREEMENT_WINDOW_MS;
  const inWindow = reports
    .map((r) => ({ t: new Date(r.created_at).getTime(), status: r.status }))
    .filter((p) => p.t >= windowStart && p.t <= now)
    .sort((a, b) => a.t - b.t);

  if (inWindow.length === 0) return NO_AGREEMENT;

  const latest = inWindow[inWindow.length - 1];
  const count = inWindow.filter((p) => p.status === latest.status).length;

  return { verified: count >= 2, count, total: inWindow.length, status: latest.status };
}

export function groupAgreementByArea(
  reports: Report[],
  now = Date.now()
): Map<string, Agreement> {
  const grouped = new Map<string, Report[]>();
  for (const r of reports) {
    const key = agreementKey(r);
    const list = grouped.get(key);
    if (list) list.push(r);
    else grouped.set(key, [r]);
  }
  const result = new Map<string, Agreement>();
  grouped.forEach((list, key) => result.set(key, computeAgreement(list, now)));
  return result;
}

// Fetch all reports in the agreement window in one query and group them per
// area, so the feed can show which entries are part of an agreeing cluster.
export async function fetchAgreementMap(
  supabase: SupabaseClient,
  now = Date.now()
): Promise<Map<string, Agreement>> {
  const since = new Date(now - AGREEMENT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("reports")
    .select("area, city, area_id, status, created_at")
    .gte("created_at", since)
    .limit(2000);
  if (error) throw error;
  return groupAgreementByArea((data ?? []) as Report[], now);
}

// Lightweight "this report may be wrong" signal. Insert-only; no client-side
// read of flags for now (per RLS).
export async function flagReport(supabase: SupabaseClient, reportId: number): Promise<void> {
  const { error } = await supabase.from("report_flags").insert({ report_id: reportId });
  if (error) throw error;
}
