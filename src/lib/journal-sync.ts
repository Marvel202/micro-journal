import { downloadMissingEntries, loadToken, uploadEntry } from "./gdrive";
import { listEntries, saveEntry, type Entry } from "./storage";

export type SyncStatus = "idle" | "syncing" | "synced" | "disconnected" | "error";

export type SyncState = {
  status: SyncStatus;
  message?: string;
  lastSyncedAt?: number;
  pulled?: number;
  pushed?: number;
};

export type SyncResult =
  | { ok: true; state: SyncState; entries: Entry[] }
  | { ok: false; state: SyncState; entries: Entry[] };

/**
 * Bidirectional Google Drive sync. Local IndexedDB remains the offline cache,
 * but this function is the single path for restoring missing records and then
 * pushing the merged local set back to Drive.
 */
export async function syncEntriesWithDrive(): Promise<SyncResult> {
  const token = loadToken();
  const before = await listEntries();

  if (!token) {
    return {
      ok: false,
      entries: before,
      state: {
        status: "disconnected",
        message: before.length > 0
          ? "Drive is disconnected. This device is showing local entries only."
          : "Drive is disconnected. Reconnect to restore entries and your streak on this device.",
      },
    };
  }

  try {
    const localDays = new Set(before.map((entry) => entry.day));
    const newFromDrive = await downloadMissingEntries(token, localDays);
    for (const entry of newFromDrive) {
      await saveEntry(entry);
    }

    const merged = await listEntries();
    for (const entry of merged) {
      await uploadEntry(token, entry);
    }

    return {
      ok: true,
      entries: merged,
      state: {
        status: "synced",
        message: newFromDrive.length > 0
          ? `Restored ${newFromDrive.length} entr${newFromDrive.length === 1 ? "y" : "ies"} from Drive.`
          : "Synced with Drive.",
        lastSyncedAt: Date.now(),
        pulled: newFromDrive.length,
        pushed: merged.length,
      },
    };
  } catch (err) {
    console.error("[journal-sync] Drive sync failed", err);
    return {
      ok: false,
      entries: await listEntries(),
      state: {
        status: "error",
        message: "Drive sync failed. This device may be missing entries until you reconnect or try again.",
      },
    };
  }
}
