import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "./storage";

const localEntries: Entry[] = [];
const remoteEntries: Entry[] = [];
let token: string | null = null;

vi.mock("./storage", () => ({
  listEntries: vi.fn(async () => [...localEntries]),
  saveEntry: vi.fn(async (entry: Entry) => {
    const i = localEntries.findIndex((existing) => existing.day === entry.day);
    if (i >= 0) localEntries[i] = entry;
    else localEntries.push(entry);
  }),
}));

vi.mock("./gdrive", () => ({
  loadToken: vi.fn(() => token),
  downloadMissingEntries: vi.fn(async (_token: string, skipDays: Set<string>) => remoteEntries.filter((entry) => !skipDays.has(entry.day))),
  uploadEntry: vi.fn(async () => undefined),
}));

describe("syncEntriesWithDrive", () => {
  beforeEach(() => {
    localEntries.length = 0;
    remoteEntries.length = 0;
    token = null;
  });

  it("reports disconnected instead of pretending an empty local cache is authoritative", async () => {
    const { syncEntriesWithDrive } = await import("./journal-sync");

    const result = await syncEntriesWithDrive();

    expect(result.ok).toBe(false);
    expect(result.state.status).toBe("disconnected");
    expect(result.state.message).toMatch(/Reconnect to restore entries/);
  });

  it("pulls missing Drive entries before returning the merged local set", async () => {
    token = "token";
    localEntries.push({
      day: "2026-06-21",
      prompt: "p",
      kind: "text",
      text: "Local day.",
      createdAt: 1,
    });
    remoteEntries.push({
      day: "2026-06-20",
      prompt: "p",
      kind: "text",
      text: "Remote day.",
      createdAt: 1,
    });

    const { syncEntriesWithDrive } = await import("./journal-sync");
    const result = await syncEntriesWithDrive();

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe("synced");
    expect(result.entries.map((entry) => entry.day).sort()).toEqual(["2026-06-20", "2026-06-21"]);
  });
});
