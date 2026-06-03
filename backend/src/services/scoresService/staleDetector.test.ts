import { describe, it, expect } from "vitest";
import { isMatchStale } from "./staleDetector";

describe("isMatchStale", () => {
  const kickoff = new Date("2026-05-30T16:00:00.000Z");
  const threshold = 210 * 60_000; // 210 min

  it("is not stale right at kickoff", () => {
    expect(isMatchStale(kickoff, kickoff, threshold)).toBe(false);
  });

  it("is not stale during a normal match (120 min in)", () => {
    const now = new Date(kickoff.getTime() + 120 * 60_000);
    expect(isMatchStale(kickoff, now, threshold)).toBe(false);
  });

  it("is not stale exactly at the threshold (boundary is exclusive)", () => {
    const now = new Date(kickoff.getTime() + threshold);
    expect(isMatchStale(kickoff, now, threshold)).toBe(false);
  });

  it("is stale once past the threshold", () => {
    const now = new Date(kickoff.getTime() + threshold + 60_000);
    expect(isMatchStale(kickoff, now, threshold)).toBe(true);
  });

  it("the 30-may final scenario (stuck hours later) is stale", () => {
    // Kickoff 16:00, still unfinalized by ~19:45 → stale.
    const now = new Date("2026-05-30T19:45:00.000Z");
    expect(isMatchStale(kickoff, now, threshold)).toBe(true);
  });
});
