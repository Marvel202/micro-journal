import type { Check, Verifier } from "../core/types";
import { findUnit, listAttrs } from "../core/contract";

/**
 * DOM contract verifier — checks that:
 *   1. The unit emits a `data-verify-unit="<name>"` root.
 *   2. The root carries at least one `data-verify-<key>` state attribute
 *      (otherwise the unit is silent — it isn't really declaring a contract).
 *
 * This is the floor below all other verification: if the unit never
 * self-identifies, no agent can find it.
 */
export const domContractVerifier: Verifier = {
  name: "dom-contract",
  run: ({ unit, root }) => {
    const el = findUnit(root, unit.name);
    if (!el) {
      const found: Check = {
        verifier: "dom-contract",
        name: "unit-root-present",
        status: "fail",
        message: `Expected a [data-verify-unit="${unit.name}"] root, found none in mounted output.`,
      };
      return [found];
    }
    const out: Check[] = [
      { verifier: "dom-contract", name: "unit-root-present", status: "ok" },
    ];

    const attrs = listAttrs(el);
    const keys = Object.keys(attrs);
    if (keys.length === 0) {
      out.push({
        verifier: "dom-contract",
        name: "state-attrs-present",
        status: "warn",
        message: "Unit root has no data-verify-* state attributes. Consider exposing observable state.",
      });
    } else {
      out.push({
        verifier: "dom-contract",
        name: "state-attrs-present",
        status: "ok",
        detail: attrs,
      });
    }
    return out;
  },
};
