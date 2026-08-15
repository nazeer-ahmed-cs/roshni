import type { Report } from "./supabase";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type TimeBucket = {
  bucket: TimeOfDay;
  label: string;
  avgDurationMinutes: number;
  sampleSize: number;
};

export type OutagePair = { outTime: number; backTime: number };

export type Prediction = {
  hasEnoughData: boolean;
  avgDurationMinutes?: number;
  sampleSize: number;
  byTimeOfDay?: TimeBucket[];
};

export type OngoingOutage = {
  outTime: number;
  elapsedMinutes: number;
};

const MIN_PAIRS = 3;
const MIN_PAIRS_PER_BUCKET = 2;

const BUCKET_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning 6–12",
  afternoon: "Afternoon 12–18",
  evening: "Evening 18–24",
  night: "Night 0–6",
};

const BUCKET_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function avgMinutes(pairs: OutagePair[]): number {
  const totalMs = pairs.reduce((sum, p) => sum + (p.backTime - p.outTime), 0);
  return totalMs / pairs.length / 60000;
}

export function bucketForHour(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "night";
}

// Pair consecutive power_out → power_back reports into completed outage
// durations. Anything without a matching pair is ignored here: an "out" with
// no following "back" yet is the current ongoing outage (tracked separately by
// findOngoingOutage), and a stray "back" with no prior "out" is dropped.
export function computeOutagePairs(reports: Report[]): OutagePair[] {
  const sorted = [...reports].sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
  const pairs: OutagePair[] = [];
  let openOut: number | null = null;

  for (const r of sorted) {
    const t = toMs(r.created_at);
    if (r.status === "power_out") {
      openOut = t;
    } else if (openOut !== null) {
      pairs.push({ outTime: openOut, backTime: t });
      openOut = null;
    }
  }

  return pairs;
}

// If the latest report for the area is a power_out, treat it as the current
// ongoing outage and return how long it has already been running.
export function findOngoingOutage(reports: Report[]): OngoingOutage | null {
  const sorted = [...reports].sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
  const last = sorted[sorted.length - 1];
  if (!last || last.status !== "power_out") return null;
  const outTime = toMs(last.created_at);
  return { outTime, elapsedMinutes: Math.max(0, (Date.now() - outTime) / 60000) };
}

export function predictOutageDuration(reports: Report[]): Prediction {
  const pairs = computeOutagePairs(reports);
  const sampleSize = pairs.length;

  if (sampleSize < MIN_PAIRS) {
    return { hasEnoughData: false, sampleSize };
  }

  const byBucket = new Map<TimeOfDay, OutagePair[]>();
  for (const pair of pairs) {
    const bucket = bucketForHour(new Date(pair.outTime).getHours());
    const list = byBucket.get(bucket) ?? [];
    list.push(pair);
    byBucket.set(bucket, list);
  }

  const byTimeOfDay: TimeBucket[] = [];
  for (const bucket of BUCKET_ORDER) {
    const bucketPairs = byBucket.get(bucket) ?? [];
    if (bucketPairs.length >= MIN_PAIRS_PER_BUCKET) {
      byTimeOfDay.push({
        bucket,
        label: BUCKET_LABELS[bucket],
        avgDurationMinutes: Math.round(avgMinutes(bucketPairs)),
        sampleSize: bucketPairs.length,
      });
    }
  }

  return {
    hasEnoughData: true,
    avgDurationMinutes: Math.round(avgMinutes(pairs)),
    sampleSize,
    byTimeOfDay: byTimeOfDay.length > 0 ? byTimeOfDay : undefined,
  };
}
