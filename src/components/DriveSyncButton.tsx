"use client";

import { useEffect, useState } from "react";
import { loadToken, saveToken } from "../lib/gdrive";
import type { SyncState } from "../lib/journal-sync";

/**
 * Lightweight Google Drive sync button.
 *
 * Uses Google Identity Services (GIS) directly — no @react-oauth/google.
 * The parent owns sync so every page uses one canonical restore/push path.
 */

type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
};

type TokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
};

type TokenClient = {
  requestAccessToken: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

type Props = {
  syncState?: SyncState;
  onSyncRequested?: () => Promise<void> | void;
};

export default function DriveSyncButton({ syncState, onSyncRequested }: Props) {
  const [connected, setConnected] = useState(() => Boolean(loadToken()));
  const [gisReady, setGisReady] = useState(() => Boolean(
    typeof window !== "undefined" && window.google?.accounts?.oauth2,
  ));
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (gisReady || window.google?.accounts?.oauth2) return;

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    script.onerror = () => console.error("Failed to load Google Identity Services");
    document.body.appendChild(script);
  }, [gisReady]);

  const syncing = syncState?.status === "syncing";
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const requestParentSync = async () => {
    await onSyncRequested?.();
    setConnected(Boolean(loadToken()));
  };

  const handleConnect = () => {
    if (!clientId) {
      alert("Google Drive sync is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      alert("Google sign-in is still loading. Please try again in a moment.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.access_token) {
          saveToken(response.access_token, Number(response.expires_in) || 3600);
          setConnected(true);
          setWorking(false);
          void requestParentSync();
        } else if (response.error) {
          console.error("[gdrive] Google returned error in token response:", response.error, response);
          alert(`Google authorization failed: ${response.error}`);
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
        title={syncState?.message ?? "Google Drive sync active — click to sync now"}
        onClick={() => {
          const token = loadToken();
          if (!token) {
            setConnected(false);
            return;
          }
          void requestParentSync();
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
      title={syncState?.message ?? "Connect Google Drive to sync entries across devices"}
      onClick={handleConnect}
      disabled={working || syncing}
    >
      {working ? "☁︎ connecting…" : "☁︎ backup"}
    </button>
  );
}
