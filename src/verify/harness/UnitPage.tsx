"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getUnit } from "../core/registry";
import { runFixture } from "../core/runner";
import type { FixtureResult } from "../core/types";
import { setCurrentMount } from "./handle";
import { ResultRow } from "./Report";

/**
 * Isolated render target — mounts ONE unit × fixture in a known state with no
 * app shell. Deep-linkable. Pass `?chrome=0` to hide harness chrome.
 */
export function UnitPage() {
  const params = useParams<{ unit: string; fixture: string }>();
  const searchParams = useSearchParams();
  const unitName = params?.unit ?? "";
  const fixtureName = params?.fixture ?? "";
  const showChrome = searchParams.get("chrome") !== "0";
  const containerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<FixtureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unit = getUnit(unitName);

  useEffect(() => {
    document.title = `Verify · ${unitName}/${fixtureName}`;
    if (!unit) {
      setError(`Unknown unit "${unitName}".`);
      return;
    }
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    let cancelled = false;
    (async () => {
      try {
        const r = await runFixture(unit, fixtureName, container, { unmount: false });
        if (cancelled) return;
        setResult(r);
        setCurrentMount(unitName, fixtureName, r);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => { cancelled = true; };
  }, [unit, unitName, fixtureName]);

  if (!unit) {
    return (
      <div className="unit-page-error">
        <p>{error}</p>
        <Link href="/verify">← back to dashboard</Link>
      </div>
    );
  }

  const fixture = unit.fixtures.find((f) => f.name === fixtureName);

  return (
    <div className={`unit-page ${showChrome ? "" : "no-chrome"}`}>
      {showChrome && (
        <header className="unit-page-head">
          <div>
            <Link href="/verify">← dashboard</Link>
            <h1>
              <code>{unitName}</code> / <code>{fixtureName}</code>
              {fixture?.probe && <span className="probe-tag">probe</span>}
            </h1>
            {fixture?.description && <p className="unit-desc">{fixture.description}</p>}
          </div>
          <div className="unit-page-meta">
            <a href={`?chrome=0`}>chrome=0</a>
          </div>
        </header>
      )}

      <section className="unit-mount" aria-label="mounted unit">
        <div ref={containerRef} data-mount-root />
      </section>

      {showChrome && result && (
        <section className="unit-page-result">
          <ResultRow result={result} />
        </section>
      )}
      {showChrome && error && (
        <p className="unit-page-error">{error}</p>
      )}
    </div>
  );
}
