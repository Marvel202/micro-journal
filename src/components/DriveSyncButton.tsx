"use client";

import { useEffect, useState } from "react";
import { loadToken, saveToken, uploadEntry as driveUpload } from "../lib/gdrive";
import { listEntries } from "../lib/storage";

/**
 * Lightweight Google Drive sync button.
 *
 * Uses Google Identity Services (GIS) directly — no @react-oauth/google.
 * Loads the GIS script on demand and uses initTokenClient (Token flow).
 *
 * Scope: drive.file (only files this app creates).
 * Stores short-lived access token in localStorage.
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

export default function DriveSyncButton() {
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

  /** Upload every IndexedDB entry to Drive (upsert — safe to re-run). */
  async function syncAll(token: string): Promise<void> {
    setSyncing(true);
    try {
      const entries = await listEntries();
      for (const entry of entries) {
        await driveUpload(token, entry);
      }
      console.log("[gdrive] Bulk sync complete:", entries.length, "entries");
    } catch (err) {
      console.error("[gdrive] Bulk sync error:", err);
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
          // Immediately upload all existing local entries so Drive is populated right away.
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
        title="Google Drive backup active — click to sync all entries now"
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
      title="Connect Google Drive to back up entries (photos + text)"
      onClick={handleConnect}
      disabled={working}
    >
      {working ? "☁︎ connecting…" : "☁︎ backup"}
    </button>
  );
}
