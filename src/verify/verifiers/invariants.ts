import type { Verifier } from "../core/types";

/**
 * Invariants verifier — runs each predicate declared by the unit. Predicates
 * return `true` for pass; any returned string is the failure message.
 */
export const invariantsVerifier: Verifier = {
  name: "invariants",
  run: ({ unit, root }) => {
    return unit.invariants.map((inv) => {
      let result: true | string;
      try {
        result = inv.check(root);
      } catch (err) {
        return {
          verifier: "invariants",
          name: inv.name,
          status: "fail" as const,
          message: `invariant threw: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      if (result === true) {
        return { verifier: "invariants", name: inv.name, status: "ok" as const };
      }
      return {
        verifier: "invariants",
        name: inv.name,
        status: "fail" as const,
        message: result,
      };
    });
  },
};
