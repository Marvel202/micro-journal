"use client";

import { useCallback, useEffect, useState } from "react";
import { dayKey, promptForDate } from "../lib/prompts";
import { getEntry, listEntries, type Entry } from "../lib/storage";
import { syncEntriesWithDrive, type SyncState } from "../lib/journal-sync";

const initialSyncState: SyncState = { status: "idle" };

type DaySnapshot = {
  today: string;
  prompt: string;
};

export type JournalEntriesState = {
  today: string;
  prompt: string;
  todays: Entry | null;
  entries: Entry[];
  loaded: boolean;
  syncing: boolean;
  syncState: SyncState;
  refreshLocal: () => Promise<Entry[]>;
  syncWithDrive: () => Promise<void>;
};

export function useJournalEntries(): JournalEntriesState {
  const [today, setToday] = useState("");
  const [prompt, setPrompt] = useState("");
  const [todays, setTodays] = useState<Entry | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);

  const applyLocalSnapshot = useCallback(async (): Promise<Entry[]> => {
    const snapshot = currentDaySnapshot();
    const [entry, all] = await Promise.all([
      getEntry(snapshot.today),
      listEntries(),
    ]);

    setToday(snapshot.today);
    setPrompt(snapshot.prompt);
    setTodays(entry ?? null);
    setEntries(all);
    setLoaded(true);
    return all;
  }, []);

  const syncWithDrive = useCallback(async () => {
    setSyncState({ status: "syncing", message: "Checking Drive for previous entries…" });
    const result = await syncEntriesWithDrive();
    setSyncState(result.state);
    await applyLocalSnapshot();
  }, [applyLocalSnapshot]);

  useEffect(() => {
    let cancelled = false;

    async function loadAndSync() {
      try {
        await applyLocalSnapshot();
        if (!cancelled) await syncWithDrive();
      } catch (err) {
        console.error("[journal] Failed to load entries", err);
        if (!cancelled) {
          setLoaded(true);
          setSyncState({
            status: "error",
            message: "Could not load entries on this device.",
          });
        }
      }
    }

    void loadAndSync();

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadAndSync();
    };
    const onFocus = () => void loadAndSync();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [applyLocalSnapshot, syncWithDrive]);

  return {
    today,
    prompt,
    todays,
    entries,
    loaded,
    syncing: syncState.status === "syncing",
    syncState,
    refreshLocal: applyLocalSnapshot,
    syncWithDrive,
  };
}

function currentDaySnapshot(date = new Date()): DaySnapshot {
  return {
    today: dayKey(date),
    prompt: promptForDate(date),
  };
}
