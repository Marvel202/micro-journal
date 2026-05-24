import { dayKey } from "./prompts";

/**
 * Streak = consecutive days, counting back from `today`, that have an entry.
 *
 * If today has no entry, the streak is whatever ran up to yesterday (we don't
 * punish you mid-day for not having posted yet). Once *yesterday* is missed,
 * the streak is 0.
 */
export function computeStreak(entryDays: Iterable<string>, today: string): number {
  const set = new Set(entryDays);
  if (!today) return 0;

  // Start from today if today has an entry, otherwise from yesterday.
  let cursor = set.has(today) ? today : prevDay(today);
  // If yesterday is also missing, the streak is broken.
  if (!set.has(cursor)) return 0;

  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = prevDay(cursor);
  }
  return count;
}

export type CellStatus = "text" | "photo" | "missed" | "future" | "blank";

export type DayCell = {
  /** "YYYY-MM-DD" or null for leading blanks before day 1 */
  day: string | null;
  /** day-of-month (1-31), null for blanks */
  dom: number | null;
  status: CellStatus;
  isToday: boolean;
};

export type MonthGrid = {
  /** Year (e.g. 2026). */
  year: number;
  /** Month (1-12). */
  month: number;
  /** "May" etc. */
  monthLabel: string;
  /** Filled / total in this month, ignoring blanks and future. */
  filled: number;
  total: number;
  cells: DayCell[];
};

/**
 * Build a 7-column month grid. The first row is padded with blanks so that
 * day 1 sits under its weekday column (Sunday-first).
 */
export function buildMonthGrid(
  year: number,
  month1to12: number,
  entriesByDay: Map<string, "text" | "photo">,
  today: string,
): MonthGrid {
  const firstDow = new Date(year, month1to12 - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  const todayDate = today ? parseISO(today) : null;
  const cells: DayCell[] = [];

  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: null, dom: null, status: "blank", isToday: false });
  }

  let filled = 0;
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, month1to12, d);
    const kind = entriesByDay.get(iso);
    const cellDate = new Date(year, month1to12 - 1, d);
    const isToday = todayDate
      ? cellDate.getFullYear() === todayDate.getFullYear() &&
        cellDate.getMonth() === todayDate.getMonth() &&
        cellDate.getDate() === todayDate.getDate()
      : false;
    const isFuture = todayDate ? cellDate > todayDate : false;
    let status: CellStatus;
    if (kind === "text") status = "text";
    else if (kind === "photo") status = "photo";
    else if (isFuture) status = "future";
    else status = "missed";

    if (status !== "future") {
      total += 1;
      if (status === "text" || status === "photo") filled += 1;
    }
    cells.push({ day: iso, dom: d, status, isToday });
  }

  return {
    year,
    month: month1to12,
    monthLabel: new Date(year, month1to12 - 1, 1).toLocaleString(undefined, { month: "long" }),
    filled,
    total,
    cells,
  };
}

/** Most-recent `n` months (descending: current first). */
export function recentMonths(
  entries: Array<{ day: string; kind: "text" | "photo" }>,
  today: string,
  n: number,
): MonthGrid[] {
  const map = new Map<string, "text" | "photo">();
  for (const e of entries) map.set(e.day, e.kind);
  const ref = today ? parseISO(today) : new Date();
  const months: MonthGrid[] = [];
  for (let i = 0; i < n; i++) {
    const y = ref.getFullYear();
    const m = ref.getMonth() - i;
    const adjY = y + Math.floor(m / 12);
    const adjM = ((m % 12) + 12) % 12;
    months.push(buildMonthGrid(adjY, adjM + 1, map, today || dayKey(new Date())));
  }
  return months;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function prevDay(iso: string): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
