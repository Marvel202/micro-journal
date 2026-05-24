"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dayKey, promptForDate } from "../lib/prompts";
import { getEntry, listEntries, type Entry } from "../lib/storage";
import { computeStreak } from "../lib/streak";
import Composer from "../components/Composer";
import EntryCard from "../components/EntryCard";
import dynamic from "next/dynamic";

// Client-only (uses localStorage + GIS script)
const DriveSyncButton = dynamic(() => import("../components/DriveSyncButton"), {
  ssr: false,
});

export default function Home() {
  const [today, setToday] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [todays, setTodays] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const now = new Date();
    const k = dayKey(now);
    setToday(k);
    setPrompt(promptForDate(now));
    (async () => {
      try {
        const e = await getEntry(k);
        setTodays(e ?? null);
        const all = await listEntries();
        setHistory(all);
      } catch (err) {
        console.error("Failed to load entries from IndexedDB:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const streak = computeStreak(history.map((e) => e.day), today);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-10 pb-16 flex flex-col gap-7 min-h-screen">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="pol-hand pol-brand text-2xl text-ink no-underline">
          micro-journal
        </Link>
        <nav className="flex items-baseline gap-2">
          <Link href="/streak" className="pol-chip">
            🔥 {streak}-day
          </Link>
          <DriveSyncButton />
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="pol-chip"
          >
            {showHistory ? "today" : `stack · ${history.length}`}
          </button>
        </nav>
      </header>

      {!loaded ? (
        <p className="pol-hand text-[color:var(--sage)] text-lg">loading…</p>
      ) : showHistory ? (
        <HistoryStack entries={history} />
      ) : (
        <section className="flex flex-col gap-6">
          <p className="pol-meta text-center">{formatHeader(today)}</p>

          {todays ? (
            <div className="flex flex-col gap-3">
              <EntryCard entry={todays} big stamped tilt="left" />
            </div>
          ) : (
            <Composer
              day={today}
              prompt={prompt}
              onSaved={(e) => {
                setTodays(e);
                setHistory((h) => [e, ...h.filter((x) => x.day !== e.day)]);
              }}
            />
          )}
        </section>
      )}

      <footer className="mt-auto pt-8 text-center pol-hand text-[color:var(--sage)] text-base">
        {"● one sentence or one photo. that’s the day."}
      </footer>
    </main>
  );
}

function HistoryStack({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="pol-hand text-3xl text-ink">the stack <span className="pol-hand text-[color:var(--sage)] text-base">— empty</span></h2>
        <p className="pol-serif italic text-[color:var(--sage)]">No cards yet. Write your first one today.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-7">
      <h2 className="pol-hand text-3xl text-ink">
        the stack <span className="pol-hand text-[color:var(--sage)] text-base">— {entries.length} day{entries.length === 1 ? "" : "s"}</span>
      </h2>
      <div className="flex flex-col gap-7">
        {entries.map((e, i) => (
          <EntryCard
            key={e.day}
            entry={e}
            tilt={i % 2 === 0 ? "left" : "right"}
          />
        ))}
      </div>
    </section>
  );
}

function formatHeader(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).replace(",", " ·");
}
