import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("counts today when today has an entry", () => {
    expect(computeStreak(["2026-06-20", "2026-06-21", "2026-06-22"], "2026-06-22")).toBe(3);
  });

  it("does not punish the user mid-day when today is blank but yesterday exists", () => {
    expect(computeStreak(["2026-06-20", "2026-06-21"], "2026-06-22")).toBe(2);
  });

  it("breaks the streak when yesterday is missing", () => {
    expect(computeStreak(["2026-06-20"], "2026-06-22")).toBe(0);
  });
});
