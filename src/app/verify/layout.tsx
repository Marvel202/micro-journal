"use client";

import { useEffect, useState } from "react";
import { ensureVerifiersRegistered } from "../../verify/verifiers";
import { ensureUnitsRegistered } from "../../verify/specs";
import { installVerifyHandle } from "../../verify/harness/handle";
import "../../verify/harness/verify.css";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureVerifiersRegistered();
    ensureUnitsRegistered();
    try {
      installVerifyHandle();
    } catch {
      // Handle is non-configurable after the first install; ignore re-install.
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="verify-root" style={{ padding: 24 }}>Loading verify harness…</div>;
  }

  return <div className="verify-root">{children}</div>;
}
