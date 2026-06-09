import { describe, it, expect } from "vitest";
import { rankLeaderboardRows, type RankableRow } from "./leaderboardRanking";

// Helper: build a row with sensible defaults.
const row = (
  id: string,
  points: number,
  perfectCount = 0,
  partialCount = 0,
  joinedAtUtc: string = "2026-06-01T00:00:00.000Z",
): RankableRow & { id: string } => ({ id, points, perfectCount, partialCount, joinedAtUtc });

describe("rankLeaderboardRows", () => {
  it("E1 — distinct points: sequential ranks 1,2,3", () => {
    const r = rankLeaderboardRows([row("a", 30), row("b", 20), row("c", 10)]);
    expect(r.map((x) => [x.row.id, x.rank, x.tiedGroupSize])).toEqual([
      ["a", 1, 1],
      ["b", 2, 1],
      ["c", 3, 1],
    ]);
  });

  it("E2 — equal points broken by perfectCount", () => {
    const r = rankLeaderboardRows([
      row("a", 20, 2),
      row("b", 20, 5),
      row("c", 10, 9),
    ]);
    expect(r.map((x) => x.row.id)).toEqual(["b", "a", "c"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.every((x) => x.tiedGroupSize === 1)).toBe(true);
  });

  it("E3 — equal points & perfect, broken by partialCount", () => {
    const r = rankLeaderboardRows([
      row("a", 20, 3, 1),
      row("b", 20, 3, 4),
    ]);
    expect(r.map((x) => x.row.id)).toEqual(["b", "a"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2]);
  });

  it("E4 — full tie shares the position (1-2-2-4)", () => {
    const r = rankLeaderboardRows([
      row("a", 20, 3, 2, "2026-06-01T00:00:00.000Z"),
      row("b", 20, 3, 2, "2026-06-02T00:00:00.000Z"),
      row("c", 15, 1, 0),
    ]);
    // a and b tie for 1st (both rank 1, group size 2); c is 3rd, not 2nd.
    const byId = Object.fromEntries(r.map((x) => [x.row.id, x]));
    expect(byId.a.rank).toBe(1);
    expect(byId.b.rank).toBe(1);
    expect(byId.a.tiedGroupSize).toBe(2);
    expect(byId.b.tiedGroupSize).toBe(2);
    expect(byId.c.rank).toBe(3);
    expect(byId.c.tiedGroupSize).toBe(1);
    // Within the tie, earlier join comes first for stable display.
    expect(r.findIndex((x) => x.row.id === "a")).toBeLessThan(
      r.findIndex((x) => x.row.id === "b"),
    );
  });

  it("E4b — three-way tie then next jumps to 4th", () => {
    const r = rankLeaderboardRows([
      row("a", 10, 1, 1),
      row("b", 10, 1, 1),
      row("c", 10, 1, 1),
      row("d", 5, 0, 0),
    ]);
    const byId = Object.fromEntries(r.map((x) => [x.row.id, x]));
    expect([byId.a.rank, byId.b.rank, byId.c.rank]).toEqual([1, 1, 1]);
    expect(byId.d.rank).toBe(4);
  });

  it("does not mutate the input array", () => {
    const input = [row("a", 10), row("b", 20)];
    const snapshot = input.map((x) => x.id);
    rankLeaderboardRows(input);
    expect(input.map((x) => x.id)).toEqual(snapshot);
  });

  it("handles empty input", () => {
    expect(rankLeaderboardRows([])).toEqual([]);
  });
});
