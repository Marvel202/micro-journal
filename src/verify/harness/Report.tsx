import type { Check, FixtureResult, Verdict } from "../core/types";

const ICON: Record<Check["status"], string> = {
  ok: "✅",
  fail: "❌",
  warn: "⚠️",
  probe: "🔍",
};

const VERDICT_CLASS: Record<Verdict, string> = {
  PASS: "verdict-pass",
  FAIL: "verdict-fail",
  BLOCKED: "verdict-blocked",
  SKIP: "verdict-skip",
};

export function VerdictBadge({ verdict, expected }: { verdict: Verdict; expected?: boolean }) {
  return (
    <span className={`verdict ${VERDICT_CLASS[verdict]}`}>
      {verdict}
      {expected === false && <span className="verdict-mismatch" title="Verdict did not match fixture's expectedVerdict"> ⚡</span>}
    </span>
  );
}

export function ChecksList({ checks }: { checks: Check[] }) {
  if (!checks.length) return <p className="checks-empty">no checks emitted.</p>;
  return (
    <ul className="checks">
      {checks.map((c, i) => (
        <li key={i} className={`check check-${c.status}`}>
          <span className="check-icon" aria-hidden="true">{ICON[c.status]}</span>
          <code className="check-verifier">{c.verifier}</code>
          <span className="check-name">{c.name}</span>
          {c.message && <span className="check-message">— {c.message}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ResultRow({ result }: { result: FixtureResult }) {
  return (
    <div className="result-row">
      <div className="result-head">
        <strong>{result.unit}</strong>
        <span className="result-fixture">/ {result.fixture}</span>
        <VerdictBadge verdict={result.verdict} expected={result.expectedVerdictMet} />
        <span className="result-duration">{result.durationMs} ms</span>
      </div>
      <ChecksList checks={result.checks} />
    </div>
  );
}
