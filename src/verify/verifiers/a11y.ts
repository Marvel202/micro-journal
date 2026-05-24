import type { Check, Verifier } from "../core/types";

/**
 * Minimal accessibility verifier — catches the most common, most actionable
 * a11y mistakes without pulling in a full axe-core dependency:
 *
 *   - every <button> has an accessible name (text or aria-label)
 *   - every <input>/<textarea>/<select> is labeled (id+label, aria-label, or
 *     aria-labelledby)
 *   - every <img> has alt (which may be empty for decorative)
 */
export const a11yVerifier: Verifier = {
  name: "a11y",
  run: ({ root }) => {
    const checks: Check[] = [];

    const unnamedButtons = Array.from(root.querySelectorAll("button")).filter(
      (b) => !accessibleName(b),
    );
    checks.push({
      verifier: "a11y",
      name: "buttons-named",
      status: unnamedButtons.length === 0 ? "ok" : "fail",
      message: unnamedButtons.length
        ? `${unnamedButtons.length} button(s) without an accessible name.`
        : undefined,
      detail: unnamedButtons.map(snippet),
    });

    const inputs = Array.from(
      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select",
      ),
    ).filter((el) => el.type !== "hidden" && el.type !== "submit" && el.type !== "button");
    const unlabeled = inputs.filter((el) => !inputLabeled(el, root));
    checks.push({
      verifier: "a11y",
      name: "inputs-labeled",
      status: unlabeled.length === 0 ? "ok" : "fail",
      message: unlabeled.length
        ? `${unlabeled.length} input(s) without a label, aria-label, or aria-labelledby.`
        : undefined,
      detail: unlabeled.map(snippet),
    });

    const imgsNoAlt = Array.from(root.querySelectorAll("img")).filter(
      (img) => !img.hasAttribute("alt"),
    );
    checks.push({
      verifier: "a11y",
      name: "images-have-alt",
      status: imgsNoAlt.length === 0 ? "ok" : "fail",
      message: imgsNoAlt.length
        ? `${imgsNoAlt.length} image(s) missing alt attribute.`
        : undefined,
      detail: imgsNoAlt.map(snippet),
    });

    return checks;
  },
};

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const text = ids
      .map((id) => el.ownerDocument!.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  return (el.textContent ?? "").trim();
}

function inputLabeled(el: HTMLElement, root: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  if (el.getAttribute("aria-labelledby")) return true;
  const id = el.id;
  if (id && root.querySelector(`label[for="${cssEscape(id)}"]`)) return true;
  // implicit label: <label>...<input/>...</label>
  return el.closest("label") !== null;
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

function snippet(el: Element): string {
  return el.outerHTML.length > 120 ? el.outerHTML.slice(0, 117) + "..." : el.outerHTML;
}
