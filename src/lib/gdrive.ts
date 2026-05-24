/**
 * Google Drive API integration — lightweight, no extra React libraries.
 *
 * Uses Google Identity Services (GIS) Token Client directly from the browser.
 * Scope: drive.file — the app can only access files/folders it creates.
 *
 * Target folder layout:
 *   My Drive/
 *     micro-journal/
 *       2026-05-24.json
 *       2026-05-24.jpg   (if photo entry)
 */

import type { Entry } from "./storage";

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

  if (!token) {
    console.log("[gdrive] No token in localStorage");
    return null;
  }

  if (Date.now() >= expiry - 60_000) {
    console.log("[gdrive] Token expired or about to expire. Remaining ms:", remainingMs);
    clearToken();
    return null;
  }

  console.log("[gdrive] Valid token found, seconds remaining:", Math.round(remainingMs / 1000));
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  cachedFolderId = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload one journal entry to Drive (best-effort).
 * Creates the micro-journal folder on first use.
 */
export async function uploadEntry(token: string, entry: Entry): Promise<void> {
  console.log("[gdrive] Starting upload for", entry.day);
  const folderId = await ensureFolder(token);

  // JSON metadata (no Blob inside)
  const json = JSON.stringify(
    {
      day: entry.day,
      prompt: entry.prompt,
      kind: entry.kind,
      text: entry.text,
      caption: entry.caption,
      createdAt: entry.createdAt,
    },
    null,
    2,
  );

  await upsertFile(token, `${entry.day}.json`, MIME_JSON, new Blob([json], { type: MIME_JSON }), folderId);

  if (entry.photo) {
    await upsertFile(token, `${entry.day}.jpg`, MIME_JPEG, entry.photo, folderId);
  }
}

// ── Internal Drive helpers ───────────────────────────────────────────────────

async function ensureFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const q = `name='${FOLDER_NAME}' and mimeType='${MIME_FOLDER}' and trashed=false`;
  const res = await gdriveGet(token, `files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const { files } = (await res.json()) as { files: { id: string }[] };

  if (files.length > 0) {
    console.log("[gdrive] Found existing micro-journal folder", files[0].id);
    cachedFolderId = files[0].id;
    return cachedFolderId;
  }

  // Create folder
  const created = await gdrivePost(token, "files", {
    name: FOLDER_NAME,
    mimeType: MIME_FOLDER,
  });
  const folder = (await created.json()) as { id: string };
  console.log("[gdrive] Created new micro-journal folder", folder.id);
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
  const q = `name='${name}' and '${parentId}' in parents and trashed=false`;
  const res = await gdriveGet(token, `files?q=${encodeURIComponent(q)}&fields=files(id)`);
  const { files } = (await res.json()) as { files: { id: string }[] };

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

  console.log("[gdrive] Successfully uploaded", name);
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
