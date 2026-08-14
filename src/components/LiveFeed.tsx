"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, isSupabaseConfigured, type Report } from "@/lib/supabase";
import { timeAgo, formatClock } from "@/lib/time";
import SupabaseNotice from "./SupabaseNotice";

const REFRESH_MS = 30_000;

export default function LiveFeed() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await getSupabase()
        .from("reports")
        .select("id, area, city, status, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (err) throw err;
      setReports((data ?? []) as Report[]);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError("Feed load nahi hua — network check karo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (!isSupabaseConfigured) {
    return <SupabaseNotice />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Live reports
        </h2>
        <button
          onClick={load}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 active:scale-[.97]"
        >
          Refresh
        </button>
      </div>

      {lastUpdated && (
        <p className="mb-2 text-xs text-neutral-500">
          Auto-refreshes every 30s · updated {timeAgo(lastUpdated.toISOString())}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && <p className="py-8 text-center text-sm text-neutral-500">Loading...</p>}

      {!loading && reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
          <div className="text-3xl">🕑</div>
          <p className="mt-2">Koi report nahi abhi.</p>
          <p>Pehla report kar ke duniya ko batao!</p>
        </div>
      )}

      <ul className="space-y-2">
        {reports.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
          >
            <span
              className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg ${
                r.status === "power_out"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-green-500/15 text-green-400"
              }`}
            >
              {r.status === "power_out" ? "⚡" : "✅"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-100">
                {r.area} <span className="font-normal text-neutral-500">· {r.city}</span>
              </p>
              <p className="text-xs text-neutral-500">
                {formatClock(r.created_at)} · {timeAgo(r.created_at)}
              </p>
            </div>
            <span
              className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                r.status === "power_out"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-green-500/15 text-green-400"
              }`}
            >
              {r.status === "power_out" ? "OUT" : "BACK"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
