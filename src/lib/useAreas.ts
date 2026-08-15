"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured, type Area } from "@/lib/supabase";

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await getSupabase()
        .from("areas")
        .select("id, city, disco, area_name, slug")
        .order("city", { ascending: true })
        .order("area_name", { ascending: true });
      if (err) throw err;
      setAreas((data ?? []) as Area[]);
    } catch (e) {
      console.error(e);
      setError("Areas load nahi hue — network check karo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(areas.map((a) => a.city))).sort(),
    [areas]
  );

  return { areas, cities, loading, error, reload: load };
}
