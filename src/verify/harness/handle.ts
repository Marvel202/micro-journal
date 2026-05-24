import { getUnit, listUnits } from "../core/registry";
import { runFixture } from "../core/runner";
import type { FixtureResult } from "../core/types";

/**
 * The `window.__verify` agent handle. Same code path as the dashboard and the
 * CI matrix — agent and human read identical structured data.
 */
export type VerifyHandle = {
  readonly version: 1;
  manifest(): Manifest;
  current(): CurrentMount | null;
  runOne(unit: string, fixture: string): Promise<FixtureResult>;
  runAll(): Promise<FixtureResult[]>;
};

export type Manifest = {
  version: 1;
  units: Array<{
    name: string;
    description?: string;
    fixtures: Array<{ name: string; probe: boolean; expectedVerdict?: string; description?: string }>;
    invariants: string[];
  }>;
  verifiers: string[];
};

type CurrentMount = {
  unit: string;
  fixture: string;
  verdict: FixtureResult["verdict"];
  checks: FixtureResult["checks"];
};

let currentMount: { unit: string; fixture: string; result: FixtureResult } | null = null;

/** Called by UnitPage after a successful run so __verify.current() can read it. */
export function setCurrentMount(unit: string, fixture: string, result: FixtureResult): void {
  currentMount = { unit, fixture, result };
}

export function installVerifyHandle(): void {
  if (typeof window === "undefined") return;
  const handle: VerifyHandle = {
    version: 1,
    manifest() {
      return {
        version: 1,
        verifiers: ["schema", "invariants", "dom-contract", "a11y"],
        units: listUnits().map((u) => ({
          name: u.name,
          description: u.description,
          invariants: u.invariants.map((i) => i.name),
          fixtures: u.fixtures.map((f) => ({
            name: f.name,
            probe: f.probe === true,
            expectedVerdict: f.expectedVerdict,
            description: f.description,
          })),
        })),
      };
    },
    current() {
      if (!currentMount) return null;
      const { unit, fixture, result } = currentMount;
      return { unit, fixture, verdict: result.verdict, checks: result.checks };
    },
    async runOne(unitName, fixtureName) {
      const unit = getUnit(unitName);
      if (!unit) {
        throw new Error(`Unknown unit: ${unitName}`);
      }
      const container = document.createElement("div");
      document.body.appendChild(container);
      try {
        return await runFixture(unit, fixtureName, container, { unmount: true });
      } finally {
        container.remove();
      }
    },
    async runAll() {
      const results: FixtureResult[] = [];
      for (const unit of listUnits()) {
        for (const fix of unit.fixtures) {
          const container = document.createElement("div");
          document.body.appendChild(container);
          try {
            results.push(await runFixture(unit, fix.name, container, { unmount: true }));
          } finally {
            container.remove();
          }
        }
      }
      return results;
    },
  };
  Object.defineProperty(window, "__verify", { value: handle, writable: false, configurable: false });
}

declare global {
  interface Window {
    __verify: VerifyHandle;
  }
}
