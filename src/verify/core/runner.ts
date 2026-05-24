import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { createElement } from "react";
import type {
  Check,
  Fixture,
  FixtureResult,
  Verdict,
  VerifiableUnit,
} from "./types";
import { listVerifiers } from "./registry";

/**
 * Mount a unit + fixture into the given container, run its act() step, then
 * dispatch every registered verifier. Returns the structured result.
 *
 * The container is left mounted on success so callers can inspect the DOM;
 * pass `unmount: true` to clean up afterwards.
 */
export async function runFixture<P>(
  unit: VerifiableUnit<P>,
  fixtureName: string,
  container: HTMLElement,
  options: { unmount?: boolean } = {},
): Promise<FixtureResult> {
  const fixture = unit.fixtures.find((f) => f.name === fixtureName);
  if (!fixture) {
    return {
      unit: unit.name,
      fixture: fixtureName,
      verdict: "BLOCKED",
      checks: [
        {
          verifier: "runner",
          name: "fixture-exists",
          status: "fail",
          message: `No fixture named "${fixtureName}" on unit ${unit.name}.`,
        },
      ],
      expectedVerdictMet: false,
      durationMs: 0,
    };
  }

  const t0 = performance.now();
  let root: Root | undefined;
  const checks: Check[] = [];

  try {
    const node = createElement(unit.component as any, fixture.props as any);
    const wrapped = unit.wrap ? unit.wrap(node) : node;
    await act(async () => {
      root = createRoot(container);
      root.render(wrapped);
    });

    if (fixture.act) {
      try {
        await act(async () => {
          await fixture.act!(container);
        });
      } catch (err) {
        checks.push({
          verifier: "runner",
          name: "fixture-act",
          status: "fail",
          message: `act() step threw: ${describeErr(err)}`,
        });
      }
    }

    for (const verifier of listVerifiers()) {
      try {
        const results = await verifier.run({ unit, fixture: fixture as Fixture<unknown>, root: container });
        checks.push(...results);
      } catch (err) {
        checks.push({
          verifier: verifier.name,
          name: "verifier-threw",
          status: "fail",
          message: describeErr(err),
        });
      }
    }
  } catch (err) {
    checks.push({
      verifier: "runner",
      name: "mount",
      status: "fail",
      message: `Mount failed: ${describeErr(err)}`,
    });
  } finally {
    if (options.unmount && root) {
      await act(async () => { root!.unmount(); });
    }
  }

  const verdict = toVerdict(checks, fixture.probe === true);
  const expectedVerdictMet = fixture.expectedVerdict
    ? fixture.expectedVerdict === verdict
    : true;

  return {
    unit: unit.name,
    fixture: fixture.name,
    verdict,
    checks,
    expectedVerdictMet,
    durationMs: Math.round(performance.now() - t0),
  };
}

function toVerdict(checks: Check[], probe: boolean): Verdict {
  const hasFail = checks.some((c) => c.status === "fail");
  if (probe) {
    // A probe fixture: surfacing a fail is what the probe is *for*.
    // We return FAIL so the verdict accurately reports what happened;
    // expectedVerdictMet on the FixtureResult tells the harness whether
    // that's the desired outcome.
    return hasFail ? "FAIL" : "PASS";
  }
  return hasFail ? "FAIL" : "PASS";
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
