"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { computeStreak } from "../lib/streak";
import { useJournalEntries } from "../hooks/useJournalEntries";
import type { SyncState } from "../lib/journal-sync";
import type { Entry } from "../lib/storage";
import Composer from "../components/Composer";
import EntryCard from "../components/EntryCard";

// Client-only (uses localStorage + GIS script)
const DriveSyncButton = dynamic(() => import("../components/DriveSyncButton"), {
  ssr: false,
});

export default function Home() {
  const [showHistory, setShowHistory] = useState(false);
  const journal = useJournalEntries();

  const streak = useMemo(
    () => computeStreak(journal.entries.map((entry) => entry.day), journal.today),
    [journal.entries, journal.today],
  );

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
          <DriveSyncButton syncState={journal.syncState} onSyncRequested={journal.syncWithDrive} />
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="pol-chip"
          >
            {showHistory ? "today" : `stack · ${journal.entries.length}`}
          </button>
        </nav>
      </header>

      <SyncNotice syncState={journal.syncState} onSync={journal.syncWithDrive} />

      {!journal.loaded ? (
        <p className="pol-hand text-[color:var(--sage)] text-lg">loading…</p>
      ) : showHistory ? (
        <HistoryStack entries={journal.entries} />
      ) : (
        <section className="flex flex-col gap-6">
          <p className="pol-meta text-center">{formatHeader(journal.today)}</p>

          {journal.todays ? (
            <div className="flex flex-col gap-3">
              <EntryCard entry={journal.todays} big stamped tilt="left" />
            </div>
          ) : (
            <Composer
              day={journal.today}
              prompt={journal.prompt}
              onSaved={() => {
                void journal.refreshLocal();
                void journal.syncWithDrive();
              }}
            />
          )}
        </section>
      )}

      <footer className="mt-auto pt-8 text-center pol-hand text-[color:var(--sage)] text-base">
        {"● one sentence or one photo. that's the day."}
      </footer>
    </main>
  );
}

function SyncNotice({ syncState, onSync }: { syncState: SyncState; onSync: () => Promise<void> }) {
  if (syncState.status === "idle" || syncState.status === "synced" || syncState.status === "syncing") {
    return null;
  }

  return (
    <section className="pol-card p-3 text-sm text-ink flex items-center justify-between gap-3">
      <p className="pol-serif text-[color:var(--sage)] leading-snug">
        {syncState.message}
      </p>
      <button type="button" className="pol-chip shrink-0" onClick={() => void onSync()}>
        retry
      </button>
    </section>
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
        {entries.map((entry, i) => (
          <EntryCard
            key={entry.day}
            entry={entry}
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
