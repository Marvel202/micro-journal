import {
  validateEntryForStorage,
  type Entry,
} from "./entry-schema";

export type { Entry } from "./entry-schema";

const DB_NAME = "micro-journal";
const STORE = "entries";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "day" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Create a user-authored entry. This enforces the product invariant that a day
 * is locked once saved: attempting to write the same day twice rejects.
 */
export async function createEntry(entry: Entry): Promise<void> {
  const valid = validateEntryForStorage(entry);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(valid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Upsert an entry from a trusted sync/import path. UI creation should use
 * createEntry() so the one-entry-per-day lock cannot be bypassed accidentally.
 */
export async function saveEntry(entry: Entry): Promise<void> {
  const valid = validateEntryForStorage(entry);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(valid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getEntry(day: string): Promise<Entry | undefined> {
  const db = await openDB();
  try {
    const result = await new Promise<Entry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(day);
      req.onsuccess = () => resolve(req.result as Entry | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!result) return undefined;
    try {
      return validateEntryForStorage(result);
    } catch (err) {
      console.warn("[storage] Ignoring invalid entry", day, err);
      return undefined;
    }
  } finally {
    db.close();
  }
}

export async function listEntries(): Promise<Entry[]> {
  const db = await openDB();
  try {
    const result = await new Promise<Entry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as Entry[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    return result
      .flatMap((entry) => {
        try {
          return [validateEntryForStorage(entry)];
        } catch (err) {
          console.warn("[storage] Ignoring invalid entry", entry?.day, err);
          return [];
        }
      })
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  } finally {
    db.close();
  }
}
