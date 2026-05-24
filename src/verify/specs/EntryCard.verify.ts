import { z } from "zod";
import EntryCard from "../../components/EntryCard";
import type { Entry } from "../../lib/storage";
import { findUnit, readAttr, readNum } from "../core/contract";
import type { VerifiableUnit } from "../core/types";

type EntryCardProps = { entry: Entry; big?: boolean };

const entrySchema: z.ZodType<Entry> = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prompt: z.string().min(1),
  kind: z.enum(["text", "photo"]),
  text: z.string().optional(),
  photo: z.any().optional(),
  createdAt: z.number().int().nonnegative(),
}) as z.ZodType<Entry>;

const propsSchema: z.ZodType<EntryCardProps> = z.object({
  entry: entrySchema,
  big: z.boolean().optional(),
});

export const entryCardUnit: VerifiableUnit<EntryCardProps> = {
  name: "EntryCard",
  description: "Locked, read-only render of a saved Entry (text or photo).",
  component: EntryCard,
  propsSchema,
  invariants: [
    {
      name: "kind-matches-payload",
      check: (root) => {
        const el = findUnit(root, "EntryCard");
        if (!el) return "EntryCard root not found";
        const kind = readAttr(el, "kind");
        const textLen = readNum(el, "text-length") ?? 0;
        if (kind === "text" && textLen === 0) {
          return "kind=text but text-length=0 (empty entry rendered)";
        }
        if (kind === "photo" && textLen !== 0) {
          return `kind=photo but text-length=${textLen} (text leaked into photo card)`;
        }
        return true;
      },
    },
    {
      name: "day-is-iso-date",
      check: (root) => {
        const el = findUnit(root, "EntryCard");
        if (!el) return "EntryCard root not found";
        const day = readAttr(el, "day") ?? "";
        return /^\d{4}-\d{2}-\d{2}$/.test(day)
          ? true
          : `day="${day}" is not YYYY-MM-DD`;
      },
    },
  ],
  fixtures: [
    {
      name: "text-entry",
      description: "A normal one-sentence text entry.",
      props: {
        entry: {
          day: "2026-05-24",
          prompt: "What surprised you today?",
          kind: "text",
          text: "A heron landed on the railing.",
          createdAt: 1716508800000,
        },
      },
    },
    {
      name: "text-entry-big",
      description: "Same payload but rendered in big mode (today's entry).",
      props: {
        entry: {
          day: "2026-05-24",
          prompt: "What did the light do today?",
          kind: "text",
          text: "The afternoon turned the kitchen amber.",
          createdAt: 1716508800000,
        },
        big: true,
      },
    },
    {
      name: "photo-entry",
      description: "Photo entry — uses a tiny in-memory Blob.",
      props: {
        entry: {
          day: "2026-05-23",
          prompt: "What color defined today?",
          kind: "photo",
          photo: new Blob(["jpegbytes"], { type: "image/jpeg" }),
          createdAt: 1716422400000,
        },
      },
    },
    {
      name: "empty-text",
      description:
        "PROBE: kind=text with empty text. The kind-matches-payload invariant must catch it.",
      probe: true,
      expectedVerdict: "FAIL",
      props: {
        entry: {
          day: "2026-05-22",
          prompt: "What did you let go of?",
          kind: "text",
          text: "",
          createdAt: 1716336000000,
        },
      },
    },
  ],
};
