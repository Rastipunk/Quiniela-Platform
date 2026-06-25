import { describe, it, expect } from "vitest";
import {
  buildEvolutionSeries,
  curateEvolutionForViewer,
  type EvolutionSeries,
} from "./poolEvolution";
import type { FixtureMatch, FixtureTeam } from "../lib/fixture";

const team = (id: string, code: string): FixtureTeam => ({ id, code });
const match = (
  id: string,
  phaseId: string,
  kickoffUtc: string,
  homeTeamId: string,
  awayTeamId: string,
): FixtureMatch => ({ id, phaseId, kickoffUtc, homeTeamId, awayTeamId });

const teamById = new Map<string, FixtureTeam>([
  ["A", team("A", "AAA")],
  ["B", team("B", "BBB")],
  ["C", team("C", "CCC")],
  ["D", team("D", "DDD")],
]);

// m1 & m2 simultaneous (12:00); m3 later (next day); m4 not finalized;
// m5 earliest (09:00) but scoring-disabled. Passed scrambled on purpose.
const matches: FixtureMatch[] = [
  match("m3", "group_stage", "2026-06-02T15:00:00Z", "A", "C"),
  match("m1", "group_stage", "2026-06-01T12:00:00Z", "A", "B"),
  match("m5", "group_stage", "2026-06-01T09:00:00Z", "A", "D"),
  match("m4", "round_of_32", "2026-06-05T18:00:00Z", "B", "D"),
  match("m2", "group_stage", "2026-06-01T12:00:00Z", "C", "D"),
];

const baseArgs = {
  matches,
  teamById,
  finalizedMatchIds: new Set(["m1", "m2", "m3", "m5"]), // m4 unfinished
  scoringDisabledMatchIds: new Set(["m5"]), // host disabled scoring
  members: [
    { userId: "p1", displayName: "Ana" },
    { userId: "p2", displayName: "Beto" },
    { userId: "p3", displayName: "Caro" },
  ],
  pointsByUserMatch: new Map<string, Map<string, number>>([
    ["p1", new Map([["m1", 10], ["m2", 4], ["m3", 20]])],
    ["p2", new Map([["m3", 10]])], // didn't pick m1/m2 → 0 there
    // p3 has no entry at all → flat 0 line
  ]),
  hasStructuralPhases: false,
};

describe("buildEvolutionSeries", () => {
  it("orders by kickoff, collapses simultaneous matches, excludes unfinished + disabled", () => {
    const s = buildEvolutionSeries(baseArgs);

    // m5 (disabled) and m4 (unfinished) excluded → 2 steps.
    expect(s.steps.map((st) => st.index)).toEqual([0, 1]);
    // Step 0 = the two 12:00 matches, ids sorted; step 1 = m3 next day.
    expect(s.steps[0]!.matchIds).toEqual(["m1", "m2"]);
    expect(s.steps[0]!.kickoffUtc).toBe("2026-06-01T12:00:00Z");
    expect(s.steps[0]!.phaseId).toBe("group_stage");
    expect(s.steps[1]!.matchIds).toEqual(["m3"]);
  });

  it("labels steps with team codes (+N for simultaneous)", () => {
    const s = buildEvolutionSeries(baseArgs);
    expect(s.steps[0]!.label).toBe("AAA vs BBB +1");
    expect(s.steps[1]!.label).toBe("AAA vs CCC");
  });

  it("accumulates points per player; missing picks add 0 but keep the point", () => {
    const s = buildEvolutionSeries(baseArgs);
    const byUser = Object.fromEntries(s.players.map((p) => [p.userId, p.cumulative]));
    expect(byUser["p1"]).toEqual([14, 34]); // (10+4), +20
    expect(byUser["p2"]).toEqual([0, 10]); // 0 at step0, +10 at step1
    expect(byUser["p3"]).toEqual([0, 0]); // never scored, still spans X
    // Final cumulative must equal the sum of the player's recorded match points.
    expect(byUser["p1"]!.at(-1)).toBe(34);
  });

  it("passes through granularity + structural flag", () => {
    const s = buildEvolutionSeries({ ...baseArgs, hasStructuralPhases: true });
    expect(s.granularity).toBe("match");
    expect(s.hasStructuralPhases).toBe(true);
  });

  it("returns empty steps when no match is finalized", () => {
    const s = buildEvolutionSeries({ ...baseArgs, finalizedMatchIds: new Set() });
    expect(s.steps).toEqual([]);
    expect(s.players.every((p) => p.cumulative.length === 0)).toBe(true);
  });

  it("computes the pack band (min/max/median per step over all players)", () => {
    const s = buildEvolutionSeries(baseArgs);
    expect(s.band).toEqual([
      { index: 0, min: 0, max: 14, median: 0 }, // step0 cumulative [0, 0, 14]
      { index: 1, min: 0, max: 34, median: 10 }, // step1 cumulative [0, 10, 34]
    ]);
  });
});

describe("curateEvolutionForViewer", () => {
  it("small pool: draws everyone, no band, tags viewer + rank", () => {
    const series = buildEvolutionSeries(baseArgs);
    const c = curateEvolutionForViewer({
      series,
      rankByUserId: new Map([["p1", 2], ["p2", 1], ["p3", 3]]),
      viewerUserId: "p1",
    });
    expect(c.curated).toBe(false);
    expect(c.band).toBeNull();
    expect(c.totalPlayers).toBe(3);
    expect(c.players.map((p) => p.userId).sort()).toEqual(["p1", "p2", "p3"]);
    const p1 = c.players.find((p) => p.userId === "p1")!;
    expect(p1.isViewer).toBe(true);
    expect(p1.rank).toBe(2);
  });

  it("big pool: keeps viewer + top-K + ±neighbours + band, ordered by rank", () => {
    const N = 20;
    const players = Array.from({ length: N }, (_, i) => ({
      userId: `u${i + 1}`,
      displayName: `U${i + 1}`,
      cumulative: [N - i],
    }));
    const series: EvolutionSeries = {
      granularity: "match",
      hasStructuralPhases: false,
      steps: [{ index: 0, phaseId: "group_stage", kickoffUtc: "2026-06-01T12:00:00Z", matchIds: ["m1"], label: "x" }],
      players,
      band: [{ index: 0, min: 1, max: 20, median: 10 }],
    };
    const rankByUserId = new Map(players.map((p, i) => [p.userId, i + 1])); // u1→1 … u20→20
    const c = curateEvolutionForViewer({ series, rankByUserId, viewerUserId: "u10" });

    expect(c.curated).toBe(true);
    expect(c.band).not.toBeNull();
    expect(c.totalPlayers).toBe(20);
    // top5 (u1–u5) + viewer u10 + neighbours rank 7–13 (u7–u13); u6 excluded (|6-10|>3).
    expect(c.players.map((p) => p.userId)).toEqual(
      ["u1", "u2", "u3", "u4", "u5", "u7", "u8", "u9", "u10", "u11", "u12", "u13"],
    );
    expect(c.players.find((p) => p.userId === "u10")!.isViewer).toBe(true);
    expect(c.players.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13]);
  });
});
