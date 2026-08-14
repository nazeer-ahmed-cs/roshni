"use client";

import { useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { CITIES, SAMPLE_AREAS } from "@/lib/constants";
import SupabaseNotice from "./SupabaseNotice";

type ReportStatus = "power_out" | "power_back";

export default function ReportForm() {
  const [city, setCity] = useState("Sukkur");
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState<ReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    area: string;
    city: string;
    status: ReportStatus;
  } | null>(null);

  const areas = SAMPLE_AREAS[city] ?? [];

  function reset() {
    setConfirmed(null);
    setError(null);
  }

  async function submit(status: ReportStatus) {
    const trimmed = area.trim();
    if (!trimmed) {
      setError("Pehle apna area likho (e.g. Military Road)");
      return;
    }
    setError(null);
    setSubmitting(status);

    try {
      await getSupabase()
        .from("reports")
        .insert({ area: trimmed, city, status })
        .select()
        .single();
      setConfirmed({ area: trimmed, city, status });
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
            {confirmed.city} —{" "}
            {confirmed.status === "power_out" ? "power out" : "power back"}
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

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
          City
        </label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100 outline-none focus:border-green-500"
        >
          {CITIES.map((c) => (
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
        <input
          id="area"
          list="area-suggestions"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder={areas.length ? "e.g. " + areas[0] : "Type any area name"}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-green-500"
        />
        <datalist id="area-suggestions">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={() => submit("power_out")}
          disabled={submitting !== null}
          className="w-full rounded-2xl bg-red-600 py-5 text-lg font-bold text-white shadow-lg shadow-red-950/50 transition active:scale-[.98] disabled:opacity-50"
        >
          {submitting === "power_out" ? "Submitting..." : "⚡ Power Went Out"}
        </button>
        <button
          onClick={() => submit("power_back")}
          disabled={submitting !== null}
          className="w-full rounded-2xl bg-green-600 py-5 text-lg font-bold text-white shadow-lg shadow-green-950/50 transition active:scale-[.98] disabled:opacity-50"
        >
          {submitting === "power_back" ? "Submitting..." : "✅ Power Came Back"}
        </button>
      </div>

      <p className="text-center text-xs text-neutral-500">
        No signup needed. Reports are anonymous and visible to everyone.
      </p>
    </div>
  );
}
