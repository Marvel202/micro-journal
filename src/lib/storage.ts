export type Entry = {
  day: string;
  prompt: string;
  kind: "text" | "photo";
  text?: string;
  photo?: Blob;
  /** Optional handwritten caption on a photo entry (≤80 chars). */
  caption?: string;
  createdAt: number;
};

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

export async function saveEntry(entry: Entry): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getEntry(day: string): Promise<Entry | undefined> {
  const db = await openDB();
  const result = await new Promise<Entry | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(day);
    req.onsuccess = () => resolve(req.result as Entry | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function listEntries(): Promise<Entry[]> {
  const db = await openDB();
  const result = await new Promise<Entry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Entry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result.sort((a, b) => (a.day < b.day ? 1 : -1));
}
