"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { discoForCity } from "@/lib/areas-data";

export default function AreaSuggest({ cities }: { cities: string[] }) {
  const [city, setCity] = useState(cities[0] ?? "");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pehle area ka naam likho");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await getSupabase().from("area_suggestions").insert({
        city,
        disco: discoForCity(city),
        area_name: trimmed,
        status: "pending",
      });
      setDone(true);
    } catch (e) {
      console.error(e);
      setError("Suggest nahi hua — network check karo");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
        Shukriya! Suggestion review ke liye bhej di gayi hai. Approved hone ke baad area dropdown me
        aa jayega.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Nayi area suggest karo
      </p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-green-500"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Area ka naam"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-green-500"
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 text-sm font-semibold text-neutral-200 active:scale-[.99] disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Send suggestion"}
      </button>
    </div>
  );
}
