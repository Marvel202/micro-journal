/**
 * Google Drive API integration — lightweight, no extra React libraries.
 *
 * Uses Google Identity Services (GIS) Token Client directly from the browser.
 * Scope: drive.file — the app can only access files/folders it creates.
 */

import type { Entry } from "./storage";
import {
  hydratePersistedEntry,
  parsePersistedEntry,
  serializeEntry,
  type PersistedEntry,
} from "./entry-schema";

const FOLDER_NAME = "micro-journal";
const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_JSON = "application/json";
const MIME_JPEG = "image/jpeg";

const TOKEN_KEY = "gdrive-access-token";
const TOKEN_EXPIRY_KEY = "gdrive-token-expiry";

// In-memory cache so we don't query Drive on every save.
let cachedFolderId: string | null = null;

// ── Token management (used by DriveSyncButton) ───────────────────────────────

export function saveToken(accessToken: string, expiresIn: number): void {
  const safeExpiresIn = Math.max(Number(expiresIn) || 3600, 300); // minimum 5 minutes
  const expiryTimestamp = Date.now() + safeExpiresIn * 1000;

  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTimestamp));

  console.log("[gdrive] Token saved. Will expire in ~", safeExpiresIn, "seconds");
}

export function loadToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || "0");
  const remainingMs = expiry - Date.now();

  if (!token) return null;

  if (Date.now() >= expiry - 60_000) {
    console.log("[gdrive] Token expired or about to expire. Remaining ms:", remainingMs);
    clearToken();
    return null;
  }

  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  cachedFolderId = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Download entries from Drive that are missing locally.
 * skipDays — days already in local IndexedDB (won't be re-downloaded).
 * Returns validated Entry objects ready to be saved to IndexedDB.
 */
export async function downloadMissingEntries(
  token: string,
  skipDays: Set<string> = new Set(),
): Promise<Entry[]> {
  console.log("[gdrive] Pulling from Drive, skipping", skipDays.size, "local entries");
  const folderId = await ensureFolder(token);

  const q = `'${folderId}' in parents and name contains '.json' and trashed=false`;
  const listRes = await gdriveGet(
    token,
    `files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1000`,
  );
  const { files: jsonFiles = [] } = (await listRes.json()) as {
    files?: { id: string; name: string }[];
  };

  const toFetch = jsonFiles.filter((f) => {
    const day = f.name.replace(/\.json$/i, "");
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && !skipDays.has(day);
  });

  async function fetchEntry(file: { id: string; name: string }): Promise<Entry | null> {
    try {
      const jsonRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!jsonRes.ok) return null;

      const persisted = parsePersistedEntry(await jsonRes.json()) as PersistedEntry;

      if (persisted.kind === "text") {
        return hydratePersistedEntry(persisted);
      }

      const jpgName = file.name.replace(/\.json$/i, ".jpg");
      const jpgQ = `name='${escapeDriveString(jpgName)}' and '${folderId}' in parents and trashed=false`;
      const jpgList = await gdriveGet(
        token,
        `files?q=${encodeURIComponent(jpgQ)}&fields=files(id)&pageSize=1`,
      );
      const { files: jpgFiles = [] } = (await jpgList.json()) as {
        files?: { id: string }[];
      };
      if (jpgFiles.length === 0) {
        console.warn("[gdrive] Skipping photo entry with missing image file", persisted.day);
        return null;
      }

      const photoRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${jpgFiles[0].id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!photoRes.ok) return null;

      return hydratePersistedEntry(persisted, await photoRes.blob());
    } catch (err) {
      console.error("[gdrive] Failed to download entry", file.name, err);
      return null;
    }
  }

  const CONCURRENCY = 5;
  const results: Entry[] = [];

  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map(fetchEntry));
    for (const entry of settled) {
      if (entry) results.push(entry);
    }
  }

  console.log("[gdrive] Pull complete:", results.length, "new entries");
  return results;
}

/**
 * Upload one journal entry to Drive (best-effort at the caller level).
 * Creates the micro-journal folder on first use.
 */
export async function uploadEntry(token: string, entry: Entry): Promise<void> {
  const folderId = await ensureFolder(token);
  const json = JSON.stringify(serializeEntry(entry), null, 2);

  await upsertFile(token, `${entry.day}.json`, MIME_JSON, new Blob([json], { type: MIME_JSON }), folderId);

  if (entry.kind === "photo") {
    await upsertFile(token, `${entry.day}.jpg`, MIME_JPEG, entry.photo, folderId);
  }
}

// ── Internal Drive helpers ───────────────────────────────────────────────────

async function ensureFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const q = `name='${escapeDriveString(FOLDER_NAME)}' and mimeType='${MIME_FOLDER}' and trashed=false`;
  const res = await gdriveGet(token, `files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  const { files = [] } = (await res.json()) as { files?: { id: string }[] };

  if (files.length > 0) {
    cachedFolderId = files[0].id;
    return cachedFolderId;
  }

  const created = await gdrivePost(token, "files", {
    name: FOLDER_NAME,
    mimeType: MIME_FOLDER,
  });
  const folder = (await created.json()) as { id: string };
  cachedFolderId = folder.id;
  return cachedFolderId;
}

async function upsertFile(
  token: string,
  name: string,
  mimeType: string,
  content: Blob,
  parentId: string,
): Promise<void> {
  const q = `name='${escapeDriveString(name)}' and '${parentId}' in parents and trashed=false`;
  const res = await gdriveGet(token, `files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  const { files = [] } = (await res.json()) as { files?: { id: string }[] };

  const metadata = files.length > 0
    ? { name }
    : { name, mimeType, parents: [parentId] };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", content);

  const url = files.length > 0
    ? `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const method = files.length > 0 ? "PATCH" : "POST";

  const uploadRes = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    console.error("[gdrive] Upload failed", uploadRes.status, text, { name, parentId });
    throw new Error(`Drive upload ${uploadRes.status}: ${text}`);
  }
}

async function gdriveGet(token: string, path: string): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[gdrive] GET failed", res.status, text, path);
    throw new Error(`Drive GET ${res.status}: ${text}`);
  }
  return res;
}

async function gdrivePost(token: string, path: string, body: object): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[gdrive] POST failed", res.status, text, path);
    throw new Error(`Drive POST ${res.status}: ${text}`);
  }
  return res;
}

function escapeDriveString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
