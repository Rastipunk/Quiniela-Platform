import { describe, it, expect } from "vitest";
import { computeLastStep } from "./poolMatchDelta";
import type { FixtureMatch, FixtureTeam } from "../lib/fixture";

const team = (id: string, code: string): FixtureTeam => ({ id, code });
const match = (id: string, kickoffUtc: string, home: string, away: string): FixtureMatch => ({
  id,
  phaseId: "group_stage",
  kickoffUtc,
  homeTeamId: home,
  awayTeamId: away,
});

const teamById = new Map<string, FixtureTeam>([
  ["A", team("A", "AAA")],
  ["B", team("B", "BBB")],
  ["C", team("C", "CCC")],
  ["D", team("D", "DDD")],
]);

const matches: FixtureMatch[] = [
  match("m1", "2026-06-01T12:00:00Z", "A", "B"),
  match("m2", "2026-06-03T18:00:00Z", "C", "D"), // latest
  match("m3", "2026-06-03T18:00:00Z", "A", "C"), // latest (simultaneous)
  match("m4", "2026-06-05T21:00:00Z", "B", "D"), // not finalized
];

describe("computeLastStep", () => {
  it("picks the most recent finalized kickoff, grouping simultaneous matches", () => {
    const s = computeLastStep({
      matches,
      teamById,
      finalizedMatchIds: new Set(["m1", "m2", "m3"]), // m4 unfinished
      scoringDisabledMatchIds: new Set(),
    });
    expect(s).not.toBeNull();
    expect(new Set(s!.matchIds)).toEqual(new Set(["m2", "m3"]));
    expect(s!.label).toContain("CCC vs DDD");
    expect(s!.label).toContain("AAA vs CCC");
  });

  it("excludes scoring-disabled matches when choosing the latest", () => {
    const s = computeLastStep({
      matches,
      teamById,
      finalizedMatchIds: new Set(["m1", "m2", "m3"]),
      scoringDisabledMatchIds: new Set(["m2", "m3"]), // both latest disabled
    });
    expect(s!.matchIds).toEqual(["m1"]);
    expect(s!.label).toBe("AAA vs BBB");
  });

  it("returns null when nothing is finalized", () => {
    expect(
      computeLastStep({
        matches,
        teamById,
        finalizedMatchIds: new Set(),
        scoringDisabledMatchIds: new Set(),
      }),
    ).toBeNull();
  });
});
