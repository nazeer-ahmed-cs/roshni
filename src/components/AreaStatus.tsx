"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSupabase,
  isSupabaseConfigured,
  type Area,
  type Report,
  type ReportStatus,
} from "@/lib/supabase";
import { useAreas } from "@/lib/useAreas";
import AreaSelect from "./AreaSelect";
import { formatClock, formatDurationMinutes, timeAgo } from "@/lib/time";
import { clearStoredSubscription, getStoredSubscription, subscribeToPush } from "@/lib/push";
import { findOngoingOutage, predictOutageDuration, type Prediction } from "@/lib/predictions";
import { computeAgreement } from "@/lib/trust";
import SupabaseNotice from "./SupabaseNotice";

const WINDOW_MS = 24 * 60 * 60 * 1000;

type Segment = { from: number; to: number; status: ReportStatus };

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "none"; prediction: Prediction }
  | {
      status: "loaded";
      current: ReportStatus;
      segments: Segment[];
      outageMs: number;
      reports: Report[];
      windowReports: number;
      prediction: Prediction;
    };

type Notify =
  | { status: "idle" }
  | { status: "subscribing" }
  | { status: "subscribed" }
  | { status: "denied"; message?: string }
  | { status: "error"; message?: string };

export default function AreaStatus() {
  const { areas, cities, loading, error: areasError, reload } = useAreas();
  const [city, setCity] = useState("");
  const [area, setArea] = useState<Area | null>(null);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState<Notify>({ status: "idle" });

  const agreement = useMemo(() => {
    if (result.status !== "loaded") return null;
    return computeAgreement(result.reports);
  }, [result]);

  useEffect(() => {
    if (!city && cities.length > 0) setCity(cities[0]);
  }, [cities, city]);

  const cityAreas = useMemo(
    () => areas.filter((a) => a.city === city).sort((a, b) => a.area_name.localeCompare(b.area_name)),
    [areas, city]
  );

  const check = useCallback(async () => {
    if (!area) {
      setError("Pehle area choose karo (e.g. Military Road)");
      return;
    }
    setError(null);
    setResult({ status: "loading" });

    try {
      const { data, error: err } = await getSupabase()
        .from("reports")
        .select("id, area, city, area_id, status, created_at")
        .eq("area_id", area.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (err) throw err;

      const reports = (data ?? []) as Report[];
      const prediction = predictOutageDuration(reports);
      if (reports.length === 0) {
        setResult({ status: "empty" });
        return;
      }

      const now = Date.now();
      const points = reports
        .map((r) => ({ t: new Date(r.created_at).getTime(), status: r.status }))
        .filter((p) => p.t >= now - WINDOW_MS)
        .sort((a, b) => a.t - b.t);

      if (points.length === 0) {
        setResult({ status: "none", prediction });
        return;
      }

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
        windowReports: points.length,
        prediction,
      });
    } catch (e) {
      console.error(e);
      setError("Check nahi hua — network check karo");
      setResult({ status: "idle" });
    }
  }, [area]);

  useEffect(() => {
    if (result.status === "loaded" && area) {
      if (result.current === "power_back") {
        clearStoredSubscription(area.id);
        setNotify({ status: "idle" });
      } else {
        setNotify({ status: getStoredSubscription(area.id) ? "subscribed" : "idle" });
      }
    }
  }, [result, area]);

  const handleNotify = useCallback(async () => {
    if (!area) return;
    setNotify({ status: "subscribing" });
    const res = await subscribeToPush(area.id);
    if (res.ok) {
      setNotify({ status: "subscribed" });
    } else if (res.reason === "denied") {
      setNotify({ status: "denied", message: res.message });
    } else {
      setNotify({ status: "error", message: res.message });
    }
  }, [area]);

  if (!isSupabaseConfigured) {
    return <SupabaseNotice />;
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-neutral-500">Loading areas...</p>;
  }

  return (
    <div className="space-y-4">
      {areasError && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {areasError}{" "}
          <button onClick={reload} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
            City
          </label>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setArea(null);
              setResult({ status: "idle" });
            }}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-neutral-100 outline-none focus:border-green-500"
          >
            {cities.map((c) => (
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
          <AreaSelect
            id="area-check"
            areas={cityAreas}
            value={area}
            onChange={(a) => {
              setArea(a);
              setResult({ status: "idle" });
            }}
            placeholder="Search area..."
          />
        </div>
      </div>

      <button
        onClick={check}
        disabled={result.status === "loading" || !area}
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
          <p className="mt-2">Area choose karo aur Check karo.</p>
          <p>Pichle 24 ghante ki reports se timeline banegi.</p>
        </div>
      )}

      {result.status === "loading" && (
        <p className="py-8 text-center text-sm text-neutral-500">Checking...</p>
      )}

      {result.status === "empty" && (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
          No history yet for this area.
        </p>
      )}

      {result.status === "none" && (
        <>
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
            Pichle 24 ghante me is area ka koi report nahi.{" "}
            <span className="text-neutral-600">Pehla report tum karo!</span>
          </p>
          <PredictionCard prediction={result.prediction} />
        </>
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
              Currently · {area?.area_name} · {city}
            </p>
            <p
              className={`mt-1 text-2xl font-black ${
                result.current === "power_out" ? "text-red-400" : "text-green-400"
              }`}
            >
              {result.current === "power_out" ? "⚡ POWER OUT" : "💡 POWER ON"}
            </p>
            {agreement?.verified && agreement.status === result.current && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-bold text-green-300">
                ✓ Verified · {agreement.count} reports agree
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              Latest report {timeAgo(result.reports[result.reports.length - 1].created_at)}
            </p>
          </div>

          {result.current === "power_out" && (
            <div className="space-y-2">
              <button
                onClick={handleNotify}
                disabled={notify.status === "subscribed" || notify.status === "subscribing"}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-3 font-semibold text-neutral-100 transition active:scale-[.99] disabled:opacity-60"
              >
                {notify.status === "subscribed"
                  ? "🔔 We'll notify you"
                  : notify.status === "subscribing"
                  ? "Subscribing..."
                  : "🔔 Notify me when power's back"}
              </button>
              {(notify.status === "denied" || notify.status === "error") && (
                <p className="text-center text-xs text-neutral-500">{notify.message}</p>
              )}
            </div>
          )}

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
                <p className="font-bold text-neutral-200">{result.windowReports}</p>
                <p className="text-neutral-500">reports · 24h</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
              Bar built from consecutive crowd reports. Red = outage, green = power on. Only the
              last 24h is shown.
            </p>
          </div>

          <PredictionCard
            prediction={result.prediction}
            areaName={area?.area_name}
            current={result.current}
            reports={result.reports}
          />
        </>
      )}
    </div>
  );
}

function formatCount(n: number): string {
  return `${n} report${n === 1 ? "" : "s"}`;
}

function notEnoughDataMessage(sampleSize: number): string {
  if (sampleSize === 0) return "Not enough data yet — no completed outages so far.";
  return `Not enough data yet — ${formatCount(sampleSize)} so far.`;
}

type PredictionCardProps = {
  prediction: Prediction;
  areaName?: string;
  current?: ReportStatus;
  reports?: Report[];
};

function PredictionCard({ prediction, areaName, current, reports = [] }: PredictionCardProps) {
  const ongoing = current === "power_out" ? findOngoingOutage(reports) : null;
  const remainingMinutes =
    ongoing && prediction.hasEnoughData && prediction.avgDurationMinutes != null
      ? Math.round(prediction.avgDurationMinutes - ongoing.elapsedMinutes)
      : null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          Outage prediction
        </p>
        {areaName && <span className="text-xs text-neutral-600">{areaName}</span>}
      </div>

      {prediction.sampleSize === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">{notEnoughDataMessage(0)}</p>
      ) : !prediction.hasEnoughData ? (
        <p className="mt-2 text-sm text-neutral-400">{notEnoughDataMessage(prediction.sampleSize)}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-200">
            Outages here usually last{" "}
            <span className="font-bold text-neutral-100">
              ~{formatDurationMinutes(prediction.avgDurationMinutes ?? 0)}
            </span>{" "}
            <span className="text-neutral-500">(based on {formatCount(prediction.sampleSize)})</span>
          </p>

          {remainingMinutes != null && ongoing && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                ⏳ Estimate
              </p>
              <p className="text-sm text-amber-200">
                {remainingMinutes > 0
                  ? `Power likely back in ~${formatDurationMinutes(remainingMinutes)}`
                  : "Should be back around now"}
                <span className="text-amber-400/70">
                  {" "}
                  (typical {formatDurationMinutes(prediction.avgDurationMinutes ?? 0)},{" "}
                  {formatDurationMinutes(Math.round(ongoing.elapsedMinutes))} in so far)
                </span>
              </p>
              <p className="mt-1 text-[11px] text-amber-400/60">
                Estimate only — not a guarantee.
              </p>
            </div>
          )}

          {prediction.byTimeOfDay && prediction.byTimeOfDay.length > 0 && (
            <div className="mt-3 border-t border-neutral-800 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                By time of day
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {prediction.byTimeOfDay.map((b) => (
                  <div key={b.bucket} className="flex items-baseline justify-between">
                    <span className="text-neutral-500">{b.label}</span>
                    <span className="text-neutral-200">
                      ~{formatDurationMinutes(b.avgDurationMinutes)}{" "}
                      <span className="text-neutral-600">({b.sampleSize})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
