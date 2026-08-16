"use client";

import { useState } from "react";
import ReportForm from "@/components/ReportForm";
import LiveFeed from "@/components/LiveFeed";
import AreaStatus from "@/components/AreaStatus";
import OutageStatsBanner from "@/components/OutageStatsBanner";

type TabId = "report" | "feed" | "area";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "report", label: "Report", icon: "⚡" },
  { id: "feed", label: "Feed", icon: "🕑" },
  { id: "area", label: "Check Area", icon: "📍" },
];

export default function Home() {
  const [tab, setTab] = useState<TabId>("report");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-amber-500/25 bg-neutral-950/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-black tracking-tight text-neutral-50">
          Roshni{" "}
          <span className="text-amber-400 [text-shadow:0_0_16px_rgba(245,158,11,0.6)]">.</span>
        </h1>
        <p className="text-xs text-neutral-500">
          Crowd-sourced load-shedding tracker · Pakistan
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-5 pb-28">
        <OutageStatsBanner />
        <div className="mt-4">
          {tab === "report" && <ReportForm />}
          {tab === "feed" && <LiveFeed />}
          {tab === "area" && <AreaStatus />}
        </div>
      </main>

      {/* Sticky bottom nav */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-neutral-800 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-3">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  active
                    ? "bg-amber-500/10 text-amber-400 [text-shadow:0_0_12px_rgba(245,158,11,0.45)]"
                    : "text-neutral-500"
                }`}
              >
                <span className={`text-lg leading-none ${active ? "scale-110" : "opacity-80"}`}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
