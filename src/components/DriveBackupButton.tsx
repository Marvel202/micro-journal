"use client";

import { useEffect, useState } from "react";
import {
  getBackupFolder,
  pickBackupFolder,
  clearBackupFolder,
  isSupported,
} from "../lib/fs-backup";

/**
 * Rendered client-only (imported with ssr:false in page.tsx).
 * Safe to call isSupported() here — window is always defined.
 */
export default function DriveBackupButton() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isSupported()) {
      getBackupFolder().then((dir) => setActive(!!dir));
    }
  }, []);

  if (!isSupported()) return null;

  return (
    <button
      className="pol-chip"
      title={active ? "Google Drive backup active — click to disconnect" : "Connect Google Drive backup"}
      onClick={async () => {
        if (active) {
          if (confirm("Disconnect Google Drive backup?")) {
            await clearBackupFolder();
            setActive(false);
          }
        } else {
          const dir = await pickBackupFolder();
          setActive(!!dir);
        }
      }}
    >
      {active ? "☁︎ synced" : "☁︎ backup"}
    </button>
  );
}
