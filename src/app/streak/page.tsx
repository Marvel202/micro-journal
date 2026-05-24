"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { dayKey } from "../../lib/prompts";
import { listEntries, type Entry } from "../../lib/storage";
import { computeStreak, recentMonths, type DayCell, type MonthGrid } from "../../lib/streak";

export default function StreakPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [today, setToday] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setToday(dayKey(new Date()));
    (async () => {
      try {
        const all = await listEntries();
        setEntries(all);
      } catch (err) {
        console.error("Failed to load entries from IndexedDB:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const streak = useMemo(
    () => computeStreak(entries.map((e) => e.day), today),
    [entries, today],
  );

  const months = useMemo(
    () => recentMonths(entries.map((e) => ({ day: e.day, kind: e.kind })), today, 3),
    [entries, today],
  );

  const totals = useMemo(() => {
    const filled = entries.length;
    const missed = months.reduce((sum, m) => sum + (m.total - m.filled), 0);
    const longest = longestStreak(entries.map((e) => e.day));
    return { filled, missed, longest };
  }, [entries, months]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-10 pb-16 flex flex-col gap-6 min-h-screen">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="pol-hand pol-brand text-2xl text-ink no-underline">
          micro-journal
        </Link>
        <Link href="/" className="pol-chip">today</Link>
      </header>

      <section className="flex flex-col gap-1">
        <p className="pol-eyebrow">your year</p>
        <h1 className="pol-hand text-5xl text-ink leading-none">
          {streak}-day streak
          <span className="text-[color:var(--persimmon)]">.</span>
        </h1>
        <p className="pol-serif italic text-[color:var(--sage)] mt-1">
          {streak > 0
            ? "Don't break the chain."
            : entries.length === 0
              ? "Your first card starts the chain."
              : "Today's blank — write one and you're back."}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="entries" value={totals.filled} />
        <Stat label="streak" value={streak} accent />
        <Stat label="longest" value={totals.longest} />
      </section>

      {!loaded ? (
        <p className="pol-hand text-[color:var(--sage)] text-lg">loading…</p>
      ) : (
        <section className="flex flex-col gap-7">
          {months.map((m) => (
            <MonthBlock key={`${m.year}-${m.month}`} grid={m} />
          ))}
        </section>
      )}

      <Legend />

      <footer className="mt-auto pt-8 text-center pol-hand text-[color:var(--sage)] text-base">
        <span className="text-[color:var(--persimmon)]">●</span> each square is a day. each day is a card.
      </footer>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="pol-card pol-tilt-l py-3 px-2 text-center">
      <div className={`pol-hand text-3xl ${accent ? "text-[color:var(--persimmon)]" : "text-ink"}`}>
        {value}
      </div>
      <div className="pol-meta mt-1">{label}</div>
    </div>
  );
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function MonthBlock({ grid }: { grid: MonthGrid }) {
  return (
    <article className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h3 className="pol-hand text-2xl text-ink">
          {grid.monthLabel} <span className="pol-hand text-[color:var(--sage)] text-base">{grid.year}</span>
        </h3>
        <span className="pol-meta">{grid.filled} of {grid.total}</span>
      </header>
      <div className="grid grid-cols-7 gap-[5px]">
        {DOW.map((d, i) => (
          <div key={`dow-${i}`} className="pol-meta text-center pb-1">{d}</div>
        ))}
        {grid.cells.map((c, i) => (
          <Cell key={i} cell={c} />
        ))}
      </div>
    </article>
  );
}

function Cell({ cell }: { cell: DayCell }) {
  const base = "aspect-square rounded-[5px] relative grid place-items-center text-[10px] font-medium";
  if (cell.status === "blank") return <div className={`${base}`} />;
  if (cell.status === "future") {
    return <div className={`${base} text-[color:var(--sage)] opacity-50`}>{cell.dom}</div>;
  }
  if (cell.status === "missed") {
    return (
      <div className={`${base} bg-[rgba(214,184,158,0.28)] text-[color:var(--sage)]`}>
        {cell.dom}
      </div>
    );
  }
  if (cell.isToday) {
    return (
      <div className={`${base} ring-2 ring-[color:var(--persimmon)] bg-[color:var(--paper)] text-[color:var(--persimmon)] font-bold`}>
        {cell.dom}
      </div>
    );
  }
  if (cell.status === "photo") {
    return (
      <div className={`${base} bg-[color:var(--persimmon)] text-transparent`}>
        {cell.dom}
        <span className="absolute w-[6px] h-[6px] rounded-full bg-[color:var(--bone)]" />
      </div>
    );
  }
  return (
    <div className={`${base} bg-[color:var(--ink)] text-[color:var(--bone)]`}>{cell.dom}</div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-[color:var(--sage)] border-t border-[color:var(--sage-rule,_rgba(154,168,150,0.45))] pt-3">
      <Sw color="var(--ink)" label="sentence" />
      <Sw color="var(--persimmon)" label="photo (•)" />
      <Sw color="rgba(214,184,158,0.4)" label="missed" />
      <Sw color="transparent" label="today" ring />
    </div>
  );
}

function Sw({ color, label, ring = false }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded-[3px]"
        style={{ background: color, boxShadow: ring ? "inset 0 0 0 2px var(--persimmon)" : undefined }}
      />
      {label}
    </span>
  );
}

/** Longest historical run of consecutive days with an entry. */
function longestStreak(entryDays: string[]): number {
  if (entryDays.length === 0) return 0;
  const sorted = [...new Set(entryDays)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}
