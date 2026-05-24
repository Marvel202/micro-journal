import { registerVerifier } from "../core/registry";
import { schemaVerifier } from "./schema";
import { invariantsVerifier } from "./invariants";
import { domContractVerifier } from "./dom-contract";
import { a11yVerifier } from "./a11y";

let registered = false;

/**
 * Idempotently register every built-in verifier. Called from app entry, from
 * the matrix test, and from the harness — wherever the registry needs to be
 * primed before runFixture() is called.
 */
export function ensureVerifiersRegistered(): void {
  if (registered) return;
  registerVerifier(schemaVerifier);
  registerVerifier(invariantsVerifier);
  registerVerifier(domContractVerifier);
  registerVerifier(a11yVerifier);
  registered = true;
}
