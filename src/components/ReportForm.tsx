"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured, type Area, type ReportStatus } from "@/lib/supabase";
import { useAreas } from "@/lib/useAreas";
import AreaSelect from "./AreaSelect";
import AreaSuggest from "./AreaSuggest";
import SupabaseNotice from "./SupabaseNotice";

export default function ReportForm() {
  const { areas, cities, loading, error: areasError, reload } = useAreas();
  const [city, setCity] = useState("");
  const [area, setArea] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState<ReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    area: string;
    city: string;
    status: ReportStatus;
  } | null>(null);

  useEffect(() => {
    if (!city && cities.length > 0) setCity(cities[0]);
  }, [cities, city]);

  const cityAreas = useMemo(
    () => areas.filter((a) => a.city === city).sort((a, b) => a.area_name.localeCompare(b.area_name)),
    [areas, city]
  );

  function reset() {
    setConfirmed(null);
    setError(null);
  }

  async function submit(status: ReportStatus) {
    if (!area) {
      setError("Pehle apna area choose karo (e.g. Military Road)");
      return;
    }
    setError(null);
    setSubmitting(status);

    try {
      await getSupabase()
        .from("reports")
        .insert({ area_id: area.id, area: area.area_name, city, status })
        .select()
        .single();
      setConfirmed({ area: area.area_name, city, status });
    } catch (e) {
      console.error(e);
      setError("Submit fail hua — network check karo aur dobara try karo");
    } finally {
      setSubmitting(null);
    }
  }

  if (confirmed) {
    return (
      <div className="animate-[fadeIn_.2s_ease-out]">
        <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-6 text-center">
          <div className="text-4xl">{confirmed.status === "power_out" ? "⚡" : "✅"}</div>
          <h2 className="mt-3 text-xl font-bold text-green-300">
            {confirmed.status === "power_out" ? "Report submit ho gaya" : "Wapis aa gaya, great!"}
          </h2>
          <p className="mt-2 text-sm text-neutral-300">
            <span className="font-semibold text-neutral-100">{confirmed.area}</span>,{" "}
            {confirmed.city} — {confirmed.status === "power_out" ? "power out" : "power back"}
          </p>
        </div>
        <button
          onClick={reset}
          className="mt-4 w-full rounded-xl border border-neutral-700 bg-neutral-900 py-3 font-semibold text-neutral-200 active:scale-[.99]"
        >
          Report another change
        </button>
      </div>
    );
  }

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

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
          City
        </label>
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setArea(null);
          }}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100 outline-none focus:border-amber-400"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="area" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Area / Mohalla
        </label>
        <AreaSelect
          id="area"
          areas={cityAreas}
          value={area}
          onChange={setArea}
          placeholder={cityAreas.length ? "Search area..." : "Is city me abhi koi area nahi"}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowSuggest((s) => !s)}
        className="w-full rounded-lg border border-dashed border-neutral-700 py-2 text-xs font-semibold text-neutral-400 hover:border-neutral-600 hover:text-neutral-300"
      >
        {showSuggest ? "Close" : "➕ Apna area nahi mila? Suggest karo"}
      </button>

      {showSuggest && <AreaSuggest cities={cities} />}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={() => submit("power_out")}
          disabled={submitting !== null || !area}
          className="w-full rounded-2xl bg-red-500 py-5 text-lg font-bold text-white shadow-lg shadow-red-500/40 transition hover:brightness-110 active:scale-[.98] active:brightness-95 disabled:opacity-50"
        >
          {submitting === "power_out" ? (
            "Submitting..."
          ) : (
            <>
              <span className="text-xl leading-none align-[-2px]">⚡</span> Power Went Out
            </>
          )}
        </button>
        <button
          onClick={() => submit("power_back")}
          disabled={submitting !== null || !area}
          className="w-full rounded-2xl bg-green-600 py-5 text-lg font-bold text-white shadow-lg shadow-green-500/40 transition hover:brightness-110 active:scale-[.98] active:brightness-95 disabled:opacity-50"
        >
          {submitting === "power_back" ? (
            "Submitting..."
          ) : (
            <>
              <span className="text-xl leading-none align-[-2px]">✅</span> Power Came Back
            </>
          )}
        </button>
      </div>

      <p className="text-center text-xs text-neutral-500">
        No signup needed. Reports are anonymous and visible to everyone.
      </p>
    </div>
  );
}
