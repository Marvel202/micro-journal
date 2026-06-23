import { z } from "zod";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD");
const createdAtSchema = z.number().int().nonnegative();

export const persistedTextEntrySchema = z.object({
  day: daySchema,
  prompt: z.string().min(1),
  kind: z.literal("text"),
  text: z.string().trim().min(1).max(240),
  createdAt: createdAtSchema,
});

export const persistedPhotoEntrySchema = z.object({
  day: daySchema,
  prompt: z.string().min(1),
  kind: z.literal("photo"),
  caption: z.string().trim().max(80).optional(),
  createdAt: createdAtSchema,
});

export const persistedEntrySchema = z.discriminatedUnion("kind", [
  persistedTextEntrySchema,
  persistedPhotoEntrySchema,
]);

export type PersistedEntry = z.infer<typeof persistedEntrySchema>;
export type TextEntry = z.infer<typeof persistedTextEntrySchema> & { photo?: never; caption?: never };
export type PhotoEntry = z.infer<typeof persistedPhotoEntrySchema> & { photo: Blob; text?: never };
export type Entry = TextEntry | PhotoEntry;

export function parsePersistedEntry(input: unknown): PersistedEntry {
  return persistedEntrySchema.parse(input);
}

export function serializeEntry(entry: Entry): PersistedEntry {
  if (entry.kind === "text") {
    return persistedTextEntrySchema.parse({
      day: entry.day,
      prompt: entry.prompt,
      kind: entry.kind,
      text: entry.text,
      createdAt: entry.createdAt,
    });
  }

  return persistedPhotoEntrySchema.parse({
    day: entry.day,
    prompt: entry.prompt,
    kind: entry.kind,
    caption: entry.caption,
    createdAt: entry.createdAt,
  });
}

export function validateEntryForStorage(entry: Entry): Entry {
  const persisted = parsePersistedEntry(serializeEntry(entry));

  if (persisted.kind === "text") {
    return persisted;
  }

  if (!isBlob(entry.photo)) {
    throw new Error(`Photo entry ${entry.day} is missing a valid photo Blob.`);
  }

  return { ...persisted, photo: entry.photo };
}

export function hydratePersistedEntry(persisted: PersistedEntry, photo?: Blob): Entry {
  if (persisted.kind === "text") return persisted;
  if (!isBlob(photo)) {
    throw new Error(`Photo entry ${persisted.day} is missing its photo file.`);
  }
  return { ...persisted, photo };
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}
