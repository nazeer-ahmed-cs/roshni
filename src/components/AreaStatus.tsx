"use client";

import { useCallback, useState } from "react";
import { getSupabase, isSupabaseConfigured, type Report, type ReportStatus } from "@/lib/supabase";
import { CITIES, SAMPLE_AREAS } from "@/lib/constants";
import { formatClock, formatDurationMinutes, timeAgo } from "@/lib/time";
import SupabaseNotice from "./SupabaseNotice";

const WINDOW_MS = 24 * 60 * 60 * 1000;

type Segment = { from: number; to: number; status: ReportStatus };

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "none" }
  | { status: "loaded"; current: ReportStatus; segments: Segment[]; outageMs: number; reports: Report[] };

export default function AreaStatus() {
  const [city, setCity] = useState("Sukkur");
  const [area, setArea] = useState("");
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  const areas = SAMPLE_AREAS[city] ?? [];

  const check = useCallback(async () => {
    const trimmed = area.trim();
    if (!trimmed) {
      setError("Pehle area likho (e.g. Military Road)");
      return;
    }
    setError(null);
    setResult({ status: "loading" });

    try {
      const fromIso = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data, error: err } = await getSupabase()
        .from("reports")
        .select("id, area, city, status, created_at")
        .eq("city", city)
        .eq("area", trimmed)
        .gte("created_at", fromIso)
        .order("created_at", { ascending: true })
        .limit(500);
      if (err) throw err;

      const reports = (data ?? []) as Report[];
      if (reports.length === 0) {
        setResult({ status: "none" });
        return;
      }

      const now = Date.now();
      const points = reports
        .map((r) => ({ t: new Date(r.created_at).getTime(), status: r.status }))
        .filter((p) => p.t >= now - WINDOW_MS)
        .sort((a, b) => a.t - b.t);

      const segments: Segment[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        segments.push({ from: points[i].t, to: points[i + 1].t, status: points[i].status });
      }
      if (points.length > 0) {
        segments.push({
          from: points[points.length - 1].t,
          to: now,
          status: points[points.length - 1].status,
        });
      }

      let outageMs = 0;
      for (const seg of segments) {
        if (seg.status === "power_out") outageMs += seg.to - seg.from;
      }

      setResult({
        status: "loaded",
        current: points[points.length - 1].status,
        segments,
        outageMs,
        reports,
      });
    } catch (e) {
      console.error(e);
      setError("Check nahi hua — network check karo");
      setResult({ status: "none" });
    }
  }, [area, city]);

  if (!isSupabaseConfigured) {
    return <SupabaseNotice />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
            City
          </label>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setResult({ status: "idle" });
            }}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-neutral-100 outline-none focus:border-green-500"
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="area-check" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Area
          </label>
          <input
            id="area-check"
            list="area-check-suggestions"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setResult({ status: "idle" });
            }}
            placeholder="e.g. Military Road"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-green-500"
          />
          <datalist id="area-check-suggestions">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
      </div>

      <button
        onClick={check}
        disabled={result.status === "loading"}
        className="w-full rounded-xl bg-neutral-100 py-3 font-bold text-neutral-900 transition active:scale-[.99] disabled:opacity-50"
      >
        {result.status === "loading" ? "Checking..." : "📍 Check karo"}
      </button>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result.status === "idle" && (
        <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
          <div className="text-3xl">📍</div>
          <p className="mt-2">Area type karo aur Check karo.</p>
          <p>Pichle 24 ghante ki reports se timeline banegi.</p>
        </div>
      )}

      {result.status === "loading" && (
        <p className="py-8 text-center text-sm text-neutral-500">Checking...</p>
      )}

      {result.status === "none" && (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
          Pichle 24 ghante me is area ka koi report nahi.{" "}
          <span className="text-neutral-600">Pehla report tum karo!</span>
        </p>
      )}

      {result.status === "loaded" && (
        <>
          <div
            className={`rounded-2xl p-4 text-center ${
              result.current === "power_out"
                ? "border border-red-500/50 bg-red-500/15"
                : "border border-green-500/50 bg-green-500/15"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Currently · {area} · {city}
            </p>
            <p
              className={`mt-1 text-2xl font-black ${
                result.current === "power_out" ? "text-red-400" : "text-green-400"
              }`}
            >
              {result.current === "power_out" ? "⚡ POWER OUT" : "💡 POWER ON"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Latest report {timeAgo(result.reports[result.reports.length - 1].created_at)}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>24h ago</span>
              <span className="font-semibold text-neutral-400">now</span>
            </div>
            <div className="mt-2 flex h-10 w-full overflow-hidden rounded-lg border border-neutral-800">
              {result.segments.map((seg, i) => {
                const widthPct = Math.max((seg.to - seg.from) / WINDOW_MS, 0.002) * 100;
                return (
                  <div
                    key={i}
                    title={`${formatClock(new Date(seg.from).toISOString())} – ${formatClock(
                      new Date(seg.to).toISOString()
                    )}`}
                    className={seg.status === "power_out" ? "bg-red-500" : "bg-green-500/70"}
                    style={{ width: `${widthPct}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="font-bold text-red-400">
                  {formatDurationMinutes(Math.round(result.outageMs / 60000))}
                </p>
                <p className="text-neutral-500">outage (reported)</p>
              </div>
              <div>
                <p className="font-bold text-neutral-200">{result.segments.length}</p>
                <p className="text-neutral-500">segments</p>
              </div>
              <div>
                <p className="font-bold text-neutral-200">{result.reports.length}</p>
                <p className="text-neutral-500">reports</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
              Bar built from consecutive crowd reports. Red = outage, green = power on. Only the
              last 24h is shown.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
