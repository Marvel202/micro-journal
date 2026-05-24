import { z } from "zod";
import { act } from "react";
import Composer from "../../components/Composer";
import type { Entry } from "../../lib/storage";
import { findUnit, readAttr, readNum } from "../core/contract";
import type { VerifiableUnit } from "../core/types";

type ComposerProps = {
  day: string;
  prompt: string;
  onSaved: (entry: Entry) => void;
};

const propsSchema: z.ZodType<ComposerProps> = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"),
  prompt: z.string().min(1),
  onSaved: z.function().args(z.any()).returns(z.void()),
}) as z.ZodType<ComposerProps>;

export const composerUnit: VerifiableUnit<ComposerProps> = {
  name: "Composer",
  description:
    "Today's entry composer — picks mode (text|photo), validates the sentence rule, exposes draft state.",
  component: Composer,
  propsSchema,
  invariants: [
    {
      name: "choose-mode-is-empty",
      check: (root) => {
        const el = findUnit(root, "Composer");
        if (!el) return "Composer root not found";
        if (readAttr(el, "mode") !== "choose") return true;
        const len = readNum(el, "text-length");
        const hasPhoto = readAttr(el, "has-photo");
        if (len !== 0) return `mode=choose but text-length=${len}`;
        if (hasPhoto !== "false") return `mode=choose but has-photo=${hasPhoto}`;
        return true;
      },
    },
    {
      name: "text-bounded-by-240",
      check: (root) => {
        const el = findUnit(root, "Composer");
        if (!el) return "Composer root not found";
        const len = readNum(el, "text-length");
        if (len === null) return "missing text-length";
        return len <= 240 ? true : `text-length=${len} exceeds 240`;
      },
    },
    {
      name: "valid-implies-no-error",
      check: (root) => {
        const el = findUnit(root, "Composer");
        if (!el) return "Composer root not found";
        if (readAttr(el, "text-valid") !== "true") return true;
        return readAttr(el, "has-error") === "false"
          ? true
          : "text-valid=true but has-error=true";
      },
    },
    {
      name: "day-is-iso-date",
      check: (root) => {
        const el = findUnit(root, "Composer");
        if (!el) return "Composer root not found";
        const day = readAttr(el, "day") ?? "";
        return /^\d{4}-\d{2}-\d{2}$/.test(day)
          ? true
          : `day="${day}" is not YYYY-MM-DD`;
      },
    },
  ],
  fixtures: [
    {
      name: "initial-choose",
      description: "Freshly mounted — composer starts in choose mode.",
      props: { day: "2026-05-24", prompt: "What surprised you today?", onSaved: () => {} },
    },
    {
      name: "switch-to-text",
      description: "Clicking 'Write one sentence' moves into text mode.",
      props: { day: "2026-05-24", prompt: "Describe a sound you heard today.", onSaved: () => {} },
      act: async (root) => {
        await clickPickText(root);
        const el = findUnit(root, "Composer")!;
        if (readAttr(el, "mode") !== "text") {
          throw new Error(`expected mode=text, got mode=${readAttr(el, "mode")}`);
        }
      },
    },
    {
      name: "type-valid-sentence",
      description: "Type a well-formed sentence; text-valid flips to true.",
      props: { day: "2026-05-24", prompt: "What did the light do today?", onSaved: () => {} },
      act: async (root) => {
        await clickPickText(root);
        await typeInto(root, "Today the light came in sideways.");
        const el = findUnit(root, "Composer")!;
        if (readAttr(el, "text-valid") !== "true") {
          throw new Error(`expected text-valid=true, got ${readAttr(el, "text-valid")}`);
        }
      },
    },
    {
      name: "whitespace-only",
      description:
        "PROBE: empty/whitespace input must NOT validate as a sentence.",
      probe: true,
      props: { day: "2026-05-24", prompt: "What made you pause?", onSaved: () => {} },
      act: async (root) => {
        await clickPickText(root);
        await typeInto(root, "   \t   ");
        const el = findUnit(root, "Composer")!;
        if (readAttr(el, "text-valid") !== "false") {
          throw new Error(`whitespace validated as a sentence: text-valid=${readAttr(el, "text-valid")}`);
        }
      },
    },
    {
      name: "multi-terminator",
      description:
        "PROBE: two terminators must NOT validate — one-sentence rule.",
      probe: true,
      props: { day: "2026-05-24", prompt: "What did you avoid?", onSaved: () => {} },
      act: async (root) => {
        await clickPickText(root);
        await typeInto(root, "Today. Was fine.");
        const el = findUnit(root, "Composer")!;
        if (readAttr(el, "text-valid") !== "false") {
          throw new Error(
            `two terminators validated: text-valid=${readAttr(el, "text-valid")}`,
          );
        }
      },
    },
    {
      name: "terminator-not-at-end",
      description:
        "PROBE: terminator in the middle must NOT validate.",
      probe: true,
      props: { day: "2026-05-24", prompt: "What were you wrong about?", onSaved: () => {} },
      act: async (root) => {
        await clickPickText(root);
        await typeInto(root, "Today. is fine");
        const el = findUnit(root, "Composer")!;
        if (readAttr(el, "text-valid") !== "false") {
          throw new Error(
            `mid-sentence terminator validated: text-valid=${readAttr(el, "text-valid")}`,
          );
        }
      },
    },
  ],
};

// Each mutation runs in its own act() so React commits the DOM change before
// the next step reads it. Sibling click()/dispatchEvent() in one batch leaves
// queries looking at the pre-update tree.
async function clickPickText(root: HTMLElement): Promise<void> {
  const btn = root.querySelector<HTMLButtonElement>('button[data-testid="composer-pick-text"]');
  if (!btn) throw new Error("pick-text button missing");
  await act(async () => { btn.click(); });
}

async function typeInto(root: HTMLElement, value: string): Promise<void> {
  const ta = root.querySelector<HTMLTextAreaElement>('textarea[data-testid="composer-text"]');
  if (!ta) throw new Error("composer textarea missing");
  const proto = Object.getPrototypeOf(ta);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setter?.call(ta, value);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
