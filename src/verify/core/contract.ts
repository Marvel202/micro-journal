/**
 * Helpers for producing and reading the `data-verify-*` DOM contract.
 *
 * The DOM is the machine-readable surface. Components MUST emit a
 * `data-verify-unit` attribute that names them (matching their registered
 * VerifiableUnit.name). Additional state is exposed via `data-verify-<key>`.
 *
 * Numbers/booleans are stringified; nulls/undefineds are dropped so the
 * absence of an attribute always means "not asserted".
 */

export type Primitive = string | number | boolean | null | undefined;

/**
 * Build an attribute spread for a verifiable surface.
 *
 *   <section {...verifyAttrs("TodoApp", { total, done, active, filter })}>
 */
export function verifyAttrs(
  unit: string,
  state: Record<string, Primitive> = {},
): Record<string, string> {
  const out: Record<string, string> = { "data-verify-unit": unit };
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === undefined) continue;
    out[`data-verify-${kebab(k)}`] = String(v);
  }
  return out;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).replace(/^-/, "");
}

/** Find the unit root for a given unit name within a container. */
export function findUnit(root: HTMLElement, unitName: string): HTMLElement | null {
  if (root.dataset.verifyUnit === unitName) return root;
  return root.querySelector<HTMLElement>(`[data-verify-unit="${unitName}"]`);
}

/** Read a single `data-verify-<key>` attribute as a string. */
export function readAttr(el: HTMLElement, key: string): string | null {
  return el.getAttribute(`data-verify-${kebab(key)}`);
}

/** Read a `data-verify-<key>` attribute as a number; null if absent or NaN. */
export function readNum(el: HTMLElement, key: string): number | null {
  const v = readAttr(el, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** All declared data-verify-* keys on an element (minus `unit`). */
export function listAttrs(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-verify-") && attr.name !== "data-verify-unit") {
      out[attr.name.slice("data-verify-".length)] = attr.value;
    }
  }
  return out;
}
