"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, isSupabaseConfigured, type Report } from "@/lib/supabase";
import { timeAgo, formatClock } from "@/lib/time";
import {
  agreementKey,
  fetchAgreementMap,
  flagReport,
  type Agreement,
} from "@/lib/trust";
import SupabaseNotice from "./SupabaseNotice";

const REFRESH_MS = 30_000;

export default function LiveFeed() {
  const [reports, setReports] = useState<Report[]>([]);
  const [agreements, setAgreements] = useState<Map<string, Agreement>>(new Map());
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  const [flagError, setFlagError] = useState<string | null>(null);
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
      const [feedResult, agreementMap] = await Promise.all([
        getSupabase()
          .from("reports")
          .select("id, area, city, area_id, status, created_at")
          .order("created_at", { ascending: false })
          .limit(60),
        fetchAgreementMap(getSupabase()),
      ]);
      if (feedResult.error) throw feedResult.error;
      setReports((feedResult.data ?? []) as Report[]);
      setAgreements(agreementMap);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError("Feed load nahi hua — network check karo");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFlag = useCallback(
    async (reportId: number) => {
      if (flaggedIds.has(reportId)) return;
      setFlagError(null);
      try {
        await flagReport(getSupabase(), reportId);
        setFlaggedIds((prev) => new Set(prev).add(reportId));
      } catch (e) {
        console.error(e);
        setFlagError("Flag save nahi hua — network check karo");
      }
    },
    [flaggedIds]
  );

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

      {flagError && (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {flagError}
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
        {reports.map((r) => {
          const agreement = agreements.get(agreementKey(r));
          const verified =
            agreement?.verified === true && agreement.status === r.status;
          const flagged = flaggedIds.has(r.id);
          return (
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
                  {verified && (
                    <span
                      title="Multiple people reported the same status recently"
                      className="ml-1 text-green-400"
                    >
                      ✓
                    </span>
                  )}
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
              <button
                onClick={() => handleFlag(r.id)}
                disabled={flagged}
                title={flagged ? "Flagged as possibly wrong" : "Flag as possibly wrong"}
                aria-label="Flag report as possibly wrong"
                className={`flex-none text-lg leading-none transition ${
                  flagged ? "text-amber-400" : "text-neutral-600 hover:text-neutral-300"
                }`}
              >
                ⚑
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
