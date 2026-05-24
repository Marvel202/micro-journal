/**
 * File System Access API — mirrors every saved entry into a user-picked folder.
 *
 * Intended target: Google Drive for Desktop → My Drive → micro-journal/
 *
 * The folder handle is persisted in a small IndexedDB so the app never asks
 * again after the first pick.
 *
 * File layout:
 *   <folder>/
 *     2026-05-24.json      ← entry metadata + text (no Blob)
 *     2026-05-24.jpg       ← photo (if photo entry)
 *
 * Browser support: Chrome 86+, Edge 86+. Safari 15.2+ has partial support.
 */

import type { Entry } from "./storage";

const DB_NAME = "micro-journal-meta";
const STORE   = "handles";
const KEY     = "backup-folder";

// ── Public API ────────────────────────────────────────────────────────────────

/** Open the folder picker and persist the chosen handle. */
export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isSupported()) {
    alert("Your browser doesn't support the File System Access API.\nUse Chrome or Edge.");
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
    await storeHandle(handle);
    return handle;
  } catch {
    // User cancelled the picker — not an error.
    return null;
  }
}

/** Return the persisted handle (re-requesting permission if needed), or null. */
export async function getBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isSupported()) return null;
  const handle = await loadHandle();
  if (!handle) return null;

  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") return handle;

  const req = await handle.requestPermission({ mode: "readwrite" });
  return req === "granted" ? handle : null;
}

/** Clear the stored folder handle (user wants to disconnect). */
export async function clearBackupFolder(): Promise<void> {
  const db = await openMetaDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => res();
    tx.onerror   = () => rej(tx.error);
  });
}

/**
 * Write one entry's files to the backup folder.
 * Safe to call on every save — overwrites the same file if called again.
 */
export async function backupEntry(
  dir: FileSystemDirectoryHandle,
  entry: Entry,
): Promise<void> {
  // JSON sidecar (text + metadata, no Blob)
  const record: Omit<Entry, "photo"> & { photo?: undefined } = {
    day:       entry.day,
    prompt:    entry.prompt,
    kind:      entry.kind,
    text:      entry.text,
    caption:   entry.caption,
    createdAt: entry.createdAt,
  };
  await writeFile(dir, `${entry.day}.json`, JSON.stringify(record, null, 2));

  // Photo file
  if (entry.photo) {
    await writeFile(dir, `${entry.day}.jpg`, entry.photo);
  }
}

/** Returns true if the browser exposes showDirectoryPicker. */
export function isSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ── Internals ─────────────────────────────────────────────────────────────────

async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string | Blob,
): Promise<void> {
  const fh     = await dir.getFileHandle(name, { create: true });
  const writer = await fh.createWritable();
  await writer.write(content);
  await writer.close();
}

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openMetaDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => res();
    tx.onerror   = () => rej(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openMetaDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => res((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror   = () => rej(req.error);
  });
}

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ── TypeScript shims ──────────────────────────────────────────────────────────
// The File System Access API surface is not fully typed in every TS version.

type PermissionState = "granted" | "denied" | "prompt";

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    queryPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  }
}
