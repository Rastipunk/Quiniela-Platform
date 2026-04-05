import { describe, it, expect } from "vitest";
import {
  parseFixtureData,
  extractMatches,
  extractTeams,
  extractPhases,
  typed,
} from "./fixture";
import type { FixtureData, PickJson } from "./fixture";

const sampleData: FixtureData = {
  meta: { name: "Test Cup", competition: "UEFA", seasonYear: 2026, sport: "football" },
  teams: [
    { id: "t1", name: "Team A", shortName: "TA", code: "TA" },
    { id: "t2", name: "Team B", shortName: "TB", code: "TB" },
  ],
  phases: [
    { id: "p1", name: "Group Stage", type: "GROUP", order: 1 },
    { id: "p2", name: "Final", type: "KNOCKOUT_FINAL", order: 2 },
  ],
  matches: [
    {
      id: "m1",
      phaseId: "p1",
      kickoffUtc: "2026-06-01T18:00:00Z",
      homeTeamId: "t1",
      awayTeamId: "t2",
      matchNumber: 1,
    },
  ],
  advancement: { some: "config" },
  note: "Test note",
};

describe("fixture utilities", () => {
  // ── parseFixtureData ──────────────────────────────────────

  describe("parseFixtureData", () => {
    it("parses a valid fixture data object", () => {
      const result = parseFixtureData(sampleData);
      expect(result.teams).toHaveLength(2);
      expect(result.phases).toHaveLength(2);
      expect(result.matches).toHaveLength(1);
      expect(result.meta?.name).toBe("Test Cup");
      expect(result.note).toBe("Test note");
      expect(result.advancement).toEqual({ some: "config" });
    });

    it("returns empty arrays for null input", () => {
      const result = parseFixtureData(null);
      expect(result.teams).toEqual([]);
      expect(result.phases).toEqual([]);
      expect(result.matches).toEqual([]);
    });

    it("returns empty arrays for undefined input", () => {
      const result = parseFixtureData(undefined);
      expect(result.teams).toEqual([]);
      expect(result.phases).toEqual([]);
      expect(result.matches).toEqual([]);
    });

    it("returns empty arrays for non-object input (string)", () => {
      const result = parseFixtureData("not an object");
      expect(result.teams).toEqual([]);
    });

    it("returns empty arrays for non-object input (number)", () => {
      const result = parseFixtureData(42);
      expect(result.matches).toEqual([]);
    });

    it("returns empty arrays when teams/phases/matches are not arrays", () => {
      const result = parseFixtureData({ teams: "bad", phases: 123, matches: null });
      expect(result.teams).toEqual([]);
      expect(result.phases).toEqual([]);
      expect(result.matches).toEqual([]);
    });

    it("returns undefined meta when meta is missing", () => {
      const result = parseFixtureData({ teams: [], phases: [], matches: [] });
      expect(result.meta).toBeUndefined();
    });

    it("returns undefined note when note is not a string", () => {
      const result = parseFixtureData({ teams: [], phases: [], matches: [], note: 123 });
      expect(result.note).toBeUndefined();
    });

    it("preserves optional UCL fields on matches", () => {
      const data = {
        matches: [
          { id: "m1", phaseId: "p1", kickoffUtc: "2026-01-01T00:00:00Z", homeTeamId: "t1", awayTeamId: "t2", tieNumber: 5, leg: 2 },
        ],
        teams: [],
        phases: [],
      };
      const result = parseFixtureData(data);
      expect(result.matches[0].tieNumber).toBe(5);
      expect(result.matches[0].leg).toBe(2);
    });
  });

  // ── extractMatches ────────────────────────────────────────

  describe("extractMatches", () => {
    it("extracts matches from valid data", () => {
      const matches = extractMatches(sampleData);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe("m1");
    });

    it("returns empty array for null", () => {
      expect(extractMatches(null)).toEqual([]);
    });

    it("returns empty array for empty object", () => {
      expect(extractMatches({})).toEqual([]);
    });
  });

  // ── extractTeams ──────────────────────────────────────────

  describe("extractTeams", () => {
    it("extracts teams from valid data", () => {
      const teams = extractTeams(sampleData);
      expect(teams).toHaveLength(2);
      expect(teams[0].name).toBe("Team A");
    });

    it("returns empty array for undefined", () => {
      expect(extractTeams(undefined)).toEqual([]);
    });
  });

  // ── extractPhases ─────────────────────────────────────────

  describe("extractPhases", () => {
    it("extracts phases from valid data", () => {
      const phases = extractPhases(sampleData);
      expect(phases).toHaveLength(2);
      expect(phases[0].type).toBe("GROUP");
    });

    it("returns empty array for null", () => {
      expect(extractPhases(null)).toEqual([]);
    });
  });

  // ── typed ─────────────────────────────────────────────────

  describe("typed", () => {
    it("casts unknown to the given type", () => {
      const raw: unknown = { type: "SCORE", homeGoals: 2, awayGoals: 1 };
      const pick = typed<PickJson>(raw);
      expect(pick.type).toBe("SCORE");
      expect(pick.homeGoals).toBe(2);
    });

    it("returns the same reference (no cloning)", () => {
      const raw = { a: 1 };
      const result = typed<{ a: number }>(raw);
      expect(result).toBe(raw);
    });
  });
});
