import type { ComponentType, ReactElement } from "react";
import type { ZodType } from "zod";

export type Verdict = "PASS" | "FAIL" | "BLOCKED" | "SKIP";
export type CheckStatus = "ok" | "fail" | "warn" | "probe";

export type Check = {
  verifier: string;
  name: string;
  status: CheckStatus;
  message?: string;
  detail?: unknown;
};

export type Fixture<P> = {
  name: string;
  description?: string;
  props: P;
  probe?: boolean;
  expectedVerdict?: Verdict;
  act?: (root: HTMLElement) => Promise<void> | void;
};

export type Invariant = {
  name: string;
  check: (root: HTMLElement) => true | string;
};

export type VerifiableUnit<P = unknown> = {
  name: string;
  description?: string;
  component: ComponentType<P>;
  propsSchema: ZodType<P>;
  fixtures: Fixture<P>[];
  invariants: Invariant[];
  /** Optional wrapper for fixtures that need provider/router context. */
  wrap?: (node: ReactElement) => ReactElement;
};

export type Verifier = {
  name: string;
  run: (ctx: VerifierContext) => Check[] | Promise<Check[]>;
};

export type VerifierContext = {
  unit: VerifiableUnit<any>;
  fixture: Fixture<any>;
  root: HTMLElement;
};

export type FixtureResult = {
  unit: string;
  fixture: string;
  verdict: Verdict;
  checks: Check[];
  /** Whether the produced verdict matched the fixture's expected verdict (if any). */
  expectedVerdictMet: boolean;
  durationMs: number;
};
