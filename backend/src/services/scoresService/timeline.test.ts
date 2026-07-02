import { describe, it, expect } from "vitest";
import { deriveNinetyMinuteScore } from "./timeline";
import type { TimelineEvent } from "./client";

// Helper to build a timeline milestone with sensible defaults.
const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  status: "1H",
  at: "2026-05-30T16:00:00.000Z",
  homeGoals: 0,
  awayGoals: 0,
  penaltyHome: null,
  penaltyAway: null,
  minute: null,
  confirmedBy: ["src-a", "src-b", "src-c"],
  ...over,
});

describe("deriveNinetyMinuteScore", () => {
  describe("matches that never went to extra time", () => {
    it("returns null/null for a finished 90' match (FT)", () => {
      const timeline = [
        ev({ status: "1H", homeGoals: 0, awayGoals: 0, minute: 1 }),
        ev({ status: "HT", homeGoals: 1, awayGoals: 0, minute: 45 }),
        ev({ status: "2H", homeGoals: 1, awayGoals: 0, minute: 46 }),
        ev({ status: "FT", homeGoals: 2, awayGoals: 1, minute: 90 }),
      ];
      expect(deriveNinetyMinuteScore(timeline, "FT")).toEqual({
        homeGoals90: null,
        awayGoals90: null,
      });
    });

    it("returns null/null for an in-progress 90' match", () => {
      expect(deriveNinetyMinuteScore([ev({ status: "2H" })], "2H")).toEqual({
        homeGoals90: null,
        awayGoals90: null,
      });
    });

    it("returns null/null when there is no timeline at all", () => {
      expect(deriveNinetyMinuteScore(undefined, "FT")).toEqual({
        homeGoals90: null,
        awayGoals90: null,
      });
    });
  });

  describe("matches that went to extra time / penalties", () => {
    // The 30-may final scenario: 1-1 at 90', stays 1-1 through ET, decided
    // 4-3 on penalties. goals90 must be 1-1 (penalties never affect goals90).
    it("derives 90' score from the ET milestone for a PEN match", () => {
      const timeline = [
        ev({ status: "1H", homeGoals: 0, awayGoals: 0, minute: 1 }),
        ev({ status: "HT", homeGoals: 1, awayGoals: 0, minute: 45 }),
        ev({ status: "2H", homeGoals: 1, awayGoals: 0, minute: 46 }),
        ev({ status: "ET", homeGoals: 1, awayGoals: 1, minute: 91 }),
        ev({
          status: "PEN",
          homeGoals: 1,
          awayGoals: 1,
          penaltyHome: 4,
          penaltyAway: 3,
          minute: 120,
        }),
      ];
      expect(deriveNinetyMinuteScore(timeline, "PEN")).toEqual({
        homeGoals90: 1,
        awayGoals90: 1,
      });
    });

    it("derives 90' score from the ET milestone for an AET match", () => {
      const timeline = [
        ev({ status: "2H", homeGoals: 1, awayGoals: 1, minute: 46 }),
        ev({ status: "ET", homeGoals: 1, awayGoals: 1, minute: 91 }),
        ev({ status: "AET", homeGoals: 2, awayGoals: 1, minute: 120 }),
      ];
      expect(deriveNinetyMinuteScore(timeline, "AET")).toEqual({
        homeGoals90: 1,
        awayGoals90: 1,
      });
    });

    it("treats live extra time (ET status) as having a 90' score", () => {
      const timeline = [ev({ status: "ET", homeGoals: 2, awayGoals: 2, minute: 95 })];
      expect(deriveNinetyMinuteScore(timeline, "ET")).toEqual({
        homeGoals90: 2,
        awayGoals90: 2,
      });
    });

    // NOTE (ADR-086): terminalConfirmationCount tests removed with the
    // function itself — finalization now trusts consensus confidence via
    // finalizationGate.ts (see finalizationGate.test.ts).

    it("falls back to null/null when ET was reached but the ET milestone is missing", () => {
      // Incomplete feed: terminal says PEN but no ET milestone exists. We do
      // not invent a 90' score — scoring falls back to match-level goals.
      const timeline = [
        ev({ status: "2H", homeGoals: 1, awayGoals: 1, minute: 46 }),
        ev({
          status: "PEN",
          homeGoals: 1,
          awayGoals: 1,
          penaltyHome: 5,
          penaltyAway: 4,
          minute: 120,
        }),
      ];
      expect(deriveNinetyMinuteScore(timeline, "PEN")).toEqual({
        homeGoals90: null,
        awayGoals90: null,
      });
    });
  });
});
