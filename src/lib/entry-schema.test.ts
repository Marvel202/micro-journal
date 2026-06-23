import { describe, expect, it } from "vitest";
import {
  hydratePersistedEntry,
  parsePersistedEntry,
  serializeEntry,
  validateEntryForStorage,
  type Entry,
} from "./entry-schema";

describe("entry schema", () => {
  it("serializes text entries without photo/caption leakage", () => {
    const entry: Entry = {
      day: "2026-06-22",
      prompt: "What surprised you today?",
      kind: "text",
      text: "A tiny bird waited by the door.",
      createdAt: 1,
    };

    expect(serializeEntry(entry)).toEqual(entry);
  });

  it("requires a photo Blob for photo storage", () => {
    expect(() => validateEntryForStorage({
      day: "2026-06-22",
      prompt: "What did the light do today?",
      kind: "photo",
      caption: "gold window",
      createdAt: 1,
    } as unknown as Entry)).toThrow(/missing a valid photo Blob/);
  });

  it("rejects malformed Drive JSON", () => {
    expect(() => parsePersistedEntry({
      day: "not-a-day",
      prompt: "x",
      kind: "text",
      text: "ok.",
      createdAt: 1,
    })).toThrow();
  });

  it("hydrates a persisted photo only when the jpg exists", () => {
    const persisted = parsePersistedEntry({
      day: "2026-06-22",
      prompt: "What color defined today?",
      kind: "photo",
      createdAt: 1,
    });

    expect(() => hydratePersistedEntry(persisted)).toThrow(/missing its photo file/);
    expect(hydratePersistedEntry(persisted, new Blob(["jpg"], { type: "image/jpeg" }))).toMatchObject({
      day: "2026-06-22",
      kind: "photo",
    });
  });
});
