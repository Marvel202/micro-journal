"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listUnits } from "../core/registry";
import { runFixture } from "../core/runner";
import type { FixtureResult } from "../core/types";
import { ResultRow, VerdictBadge } from "./Report";

export function Dashboard() {
  const units = listUnits();
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "fail" | "probe">("all");

  useEffect(() => {
    document.title = "Verify · Dashboard";
  }, []);

  async function runAll() {
    setRunning(true);
    setResults([]);
    const out: FixtureResult[] = [];
    for (const unit of units) {
      for (const fix of unit.fixtures) {
        const container = document.createElement("div");
        container.style.display = "none";
        document.body.appendChild(container);
        try {
          const r = await runFixture(unit, fix.name, container, { unmount: true });
          out.push(r);
          setResults([...out]);
        } finally {
          container.remove();
        }
      }
    }
    setRunning(false);
  }

  const filtered = results.filter((r) => {
    if (filter === "fail") return r.verdict === "FAIL" || !r.expectedVerdictMet;
    if (filter === "probe") {
      const unit = units.find((u) => u.name === r.unit);
      return unit?.fixtures.find((f) => f.name === r.fixture)?.probe === true;
    }
    return true;
  });

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.verdict === "PASS").length,
    fail: results.filter((r) => r.verdict === "FAIL").length,
    blocked: results.filter((r) => r.verdict === "BLOCKED").length,
    mismatch: results.filter((r) => !r.expectedVerdictMet).length,
  };

  return (
    <div className="dashboard">
      <header className="dashboard-head">
        <div>
          <h1>Verification Dashboard</h1>
          <p className="dashboard-sub">
            {units.length} units · {units.reduce((n, u) => n + u.fixtures.length, 0)} fixtures · 4 verifiers
          </p>
        </div>
        <div className="dashboard-actions">
          <Link href="/">← back to app</Link>
          <button type="button" onClick={runAll} disabled={running} className="run-all">
            {running ? "Running…" : "Run all"}
          </button>
        </div>
      </header>

      {results.length > 0 && (
        <div className="dashboard-summary">
          <span><strong>{summary.pass}</strong> pass</span>
          <span><strong>{summary.fail}</strong> fail</span>
          <span><strong>{summary.blocked}</strong> blocked</span>
          <span><strong>{summary.mismatch}</strong> verdict mismatches</span>
          <span className="filter-toggle">
            view:
            {(["all", "fail", "probe"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={filter === opt}
                className={filter === opt ? "is-on" : ""}
                onClick={() => setFilter(opt)}
              >{opt}</button>
            ))}
          </span>
        </div>
      )}

      <section className="dashboard-grid">
        {units.map((u) => (
          <article key={u.name} className="unit-card">
            <header>
              <h2>{u.name}</h2>
              {u.description && <p className="unit-desc">{u.description}</p>}
              <p className="unit-invariants">invariants: {u.invariants.map((i) => i.name).join(", ") || "—"}</p>
            </header>
            <ul className="fixture-list">
              {u.fixtures.map((f) => {
                const r = results.find((x) => x.unit === u.name && x.fixture === f.name);
                return (
                  <li key={f.name} className="fixture-row">
                    <Link href={`/verify/${u.name}/${f.name}`} className="fixture-link">
                      {f.name}
                    </Link>
                    {f.probe && <span className="probe-tag" title={f.description}>probe</span>}
                    {f.expectedVerdict && (
                      <span className="expected-tag">expect {f.expectedVerdict}</span>
                    )}
                    {r ? (
                      <VerdictBadge verdict={r.verdict} expected={r.expectedVerdictMet} />
                    ) : (
                      <span className="verdict verdict-pending">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>

      {filtered.length > 0 && (
        <section className="dashboard-results">
          <h2>Detail</h2>
          {filtered.map((r) => (
            <ResultRow key={`${r.unit}/${r.fixture}`} result={r} />
          ))}
        </section>
      )}

      <footer className="dashboard-foot">
        <code>window.__verify</code> exposes the same data. Try:
        <pre>{`__verify.manifest()
await __verify.runAll()`}</pre>
      </footer>
    </div>
  );
}
