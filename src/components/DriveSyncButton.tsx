"use client";

import { useEffect, useState } from "react";
import {
  loadToken,
  saveToken,
  uploadEntry as driveUpload,
  downloadMissingEntries,
} from "../lib/gdrive";
import { listEntries, saveEntry } from "../lib/storage";

/**
 * Lightweight Google Drive sync button.
 *
 * Uses Google Identity Services (GIS) directly — no @react-oauth/google.
 * Loads the GIS script on demand and uses initTokenClient (Token flow).
 *
 * Scope: drive.file (only files this app creates).
 * Stores short-lived access token in localStorage.
 *
 * Sync is bidirectional:
 *   1. Pull entries from Drive that are missing locally → save to IndexedDB
 *   2. Push all local entries to Drive (upsert)
 *   3. Call onRefreshNeeded so the parent re-reads IndexedDB and updates UI
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

type Props = {
  /** Called after a successful sync so the parent can reload entries from IndexedDB. */
  onRefreshNeeded?: () => void;
};

export default function DriveSyncButton({ onRefreshNeeded }: Props) {
  const [connected, setConnected] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load GIS script once when component mounts
  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      setGisReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    script.onerror = () => console.error("Failed to load Google Identity Services");
    document.body.appendChild(script);
  }, []);

  // Check existing token on mount
  useEffect(() => {
    setConnected(!!loadToken());
  }, []);

  /**
   * Bidirectional sync:
   *   1. Pull entries from Drive missing locally → write to IndexedDB
   *   2. Push all local entries to Drive
   *   3. Notify parent to refresh its entries state
   */
  async function syncAll(token: string): Promise<void> {
    setSyncing(true);
    try {
      // 1. Pull — fetch Drive entries not yet in local IndexedDB
      const localEntries = await listEntries();
      const localDays = new Set(localEntries.map((e) => e.day));
      const newFromDrive = await downloadMissingEntries(token, localDays);
      for (const entry of newFromDrive) {
        await saveEntry(entry);
      }

      // 2. Push — upload everything local to Drive (upsert)
      const allEntries = await listEntries(); // re-read after merge
      for (const entry of allEntries) {
        await driveUpload(token, entry);
      }

      console.log(
        "[gdrive] Sync complete — pulled:",
        newFromDrive.length,
        "pushed:",
        allEntries.length,
      );

      // 3. Tell the parent to reload its entries state
      onRefreshNeeded?.();
    } catch (err) {
      console.error("[gdrive] Sync error:", err);
    } finally {
      setSyncing(false);
    }
  }

  const handleConnect = () => {
    if (!window.google?.accounts?.oauth2) {
      alert("Google sign-in is still loading. Please try again in a moment.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response: any) => {
        console.log("[gdrive] GIS token callback response:", response);

        if (response.access_token) {
          const expiresIn = Number(response.expires_in) || 3600;
          console.log("[gdrive] Saving token, expiresIn (seconds):", expiresIn);
          saveToken(response.access_token, expiresIn);
          setConnected(true);
          setWorking(false);
          // Bidirectional sync immediately after connecting
          syncAll(response.access_token).catch(console.error);
        } else if (response.error) {
          console.error("[gdrive] Google returned error in token response:", response.error, response);
          alert(`Google authorization failed: ${response.error}\n\nCheck browser console for details.`);
          setWorking(false);
        } else {
          console.error("[gdrive] No access_token in GIS response:", response);
          setWorking(false);
        }
      },
    });

    setWorking(true);
    client.requestAccessToken();
  };

  if (!gisReady) {
    return (
      <button type="button" className="pol-chip" disabled>
        ☁︎ …
      </button>
    );
  }

  if (connected) {
    return (
      <button
        type="button"
        className="pol-chip"
        title="Google Drive sync active — click to sync now"
        onClick={() => {
          const t = loadToken();
          if (t) syncAll(t);
        }}
        disabled={syncing}
      >
        {syncing ? "☁︎ syncing…" : "☁︎ synced"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="pol-chip"
      title="Connect Google Drive to sync entries across devices"
      onClick={handleConnect}
      disabled={working}
    >
      {working ? "☁︎ connecting…" : "☁︎ backup"}
    </button>
  );
}
