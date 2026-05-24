import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { listUnits } from "./core/registry";
import { runFixture } from "./core/runner";
import { ensureUnitsRegistered } from "./specs";
import { ensureVerifiersRegistered } from "./verifiers";

/**
 * The CI path. Every unit × fixture is mounted in jsdom, every verifier is
 * run, and the resulting verdict is asserted against the fixture's
 * `expectedVerdict` (defaulting to PASS).
 *
 * Every unit MUST declare at least one probe fixture — no shipping happy paths
 * alone.
 */

beforeAll(() => {
  ensureVerifiersRegistered();
  ensureUnitsRegistered();
});

let container: HTMLElement | null = null;
afterEach(() => {
  container?.remove();
  container = null;
});

describe("verification matrix", () => {
  it("has at least one unit", () => {
    expect(listUnits().length).toBeGreaterThan(0);
  });

  for (const unit of listUnits()) {
    describe(unit.name, () => {
      it("declares at least one probe fixture", () => {
        const probes = unit.fixtures.filter((f) => f.probe === true);
        expect(
          probes.length,
          `unit ${unit.name} has 0 probe fixtures — probes are mandatory`,
        ).toBeGreaterThan(0);
      });

      for (const fixture of unit.fixtures) {
        it(`fixture: ${fixture.name}`, async () => {
          container = document.createElement("div");
          document.body.appendChild(container);
          const result = await runFixture(unit, fixture.name, container, { unmount: true });
          const expected = fixture.expectedVerdict ?? "PASS";
          expect(
            result.verdict,
            `${unit.name}/${fixture.name} verdict mismatch.\nchecks:\n${formatChecks(result.checks)}`,
          ).toBe(expected);
        });
      }
    });
  }
});

function formatChecks(checks: { verifier: string; name: string; status: string; message?: string }[]): string {
  return checks
    .map((c) => `  ${c.status.toUpperCase().padEnd(4)} [${c.verifier}] ${c.name}${c.message ? " — " + c.message : ""}`)
    .join("\n");
}

(() => {
  // Force registration at module load so describe() blocks above see units.
  ensureVerifiersRegistered();
  ensureUnitsRegistered();
})();
