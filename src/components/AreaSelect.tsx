"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Area } from "@/lib/supabase";

type Props = {
  areas: Area[];
  value: Area | null;
  onChange: (area: Area | null) => void;
  id?: string;
  placeholder?: string;
};

export default function AreaSelect({ areas, value, onChange, id, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter(
      (a) =>
        a.area_name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.disco.toLowerCase().includes(q)
    );
  }, [areas, query]);

  const listboxId = id ? `${id}-listbox` : "area-select-listbox";

  useEffect(() => setHighlight(0), [query, areas]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function select(a: Area) {
    onChange(a);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        select(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        value={open ? query : value?.area_name ?? ""}
        onChange={(e) => {
          onChange(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery(value?.area_name ?? "");
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 pr-10 text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-green-500"
      />

      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
            setOpen(true);
            inputRef.current?.focus();
          }}
          aria-label="Clear area"
          className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          ✕
        </button>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl shadow-black/40">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">
              Koi area nahi mila —{" "}
              <span className="text-neutral-400">suggest karo below</span>
            </p>
          ) : (
            <ul id={listboxId} role="listbox">
              {filtered.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => select(a)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${
                      i === highlight ? "bg-neutral-800 text-neutral-50" : "text-neutral-200"
                    }`}
                  >
                    <span className="truncate font-semibold">{a.area_name}</span>
                    <span className="flex-none rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                      {a.disco}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
