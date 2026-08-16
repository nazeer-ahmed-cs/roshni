"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchOutageStats, type OutageStats } from "@/lib/outageStats";

const REFRESH_MS = 30_000;

export default function OutageStatsBanner() {
  const [stats, setStats] = useState<OutageStats | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(true);
      return;
    }
    try {
      setStats(await fetchOutageStats(getSupabase()));
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  if (!isSupabaseConfigured) return null;

  if (!stats && !error) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-center text-xs text-neutral-500">
        Loading live stats...
      </p>
    );
  }

  if (error || !stats) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-center text-xs text-neutral-600">
        Live stats unavailable
      </p>
    );
  }

  if (stats.areasTracked === 0) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-center text-xs text-neutral-400">
        Be the first to report your area&apos;s status
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-center text-xs text-neutral-300">
      <span className="font-bold text-amber-400">⚡ {stats.areasOut} areas</span> currently
      reporting outages · {stats.areasTracked} total areas tracked
    </p>
  );
}
