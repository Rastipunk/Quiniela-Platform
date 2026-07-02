import { describe, it, expect } from "vitest";
import {
  decideFinalization,
  isFinalizedButFeedLive,
  detectIncoherences,
} from "./finalizationGate";

// Thresholds under test (defaults): MIN_ELAPSED_FOR_TERMINAL=80,
// SLOW_PATH_AFTER_MS=150min. Tests exercise the decision table around them.

describe("decideFinalization", () => {
  it("FAST: legit FT with HIGH confidence and plausible minute", () => {
    expect(
      decideFinalization({ status: "FT", elapsed: 90, minutesSinceKickoff: 115, confidence: "HIGH" }),
    ).toBe("FAST");
    expect(
      decideFinalization({ status: "AET", elapsed: 120, minutesSinceKickoff: 150, confidence: "VERY_HIGH" }),
    ).toBe("FAST");
  });

  // Regression — Inglaterra–Congo 2026-07-01: FT at minute 47 must never
  // finalize regardless of confidence (the frozen consensus payload said
  // VERY_HIGH because 5/6 sources agreed on the *score*).
  it("WAIT: terminal at an implausible minute, any confidence", () => {
    expect(
      decideFinalization({ status: "FT", elapsed: 47, minutesSinceKickoff: 69, confidence: "VERY_HIGH" }),
    ).toBe("WAIT");
    // Argentina–Argelia 2026-06-17: FT at minute 17.
    expect(
      decideFinalization({ status: "FT", elapsed: 17, minutesSinceKickoff: 20, confidence: "HIGH" }),
    ).toBe("WAIT");
  });

  it("WAIT: plausible minute but weak confidence and not late enough for SLOW", () => {
    expect(
      decideFinalization({ status: "FT", elapsed: 92, minutesSinceKickoff: 110, confidence: "MEDIUM" }),
    ).toBe("WAIT");
    expect(
      decideFinalization({ status: "FT", elapsed: 92, minutesSinceKickoff: 110, confidence: "LOW" }),
    ).toBe("WAIT");
  });

  it("SLOW: MEDIUM confidence finalizes only once long past kickoff (anti-deadlock)", () => {
    expect(
      decideFinalization({ status: "FT", elapsed: 92, minutesSinceKickoff: 155, confidence: "MEDIUM" }),
    ).toBe("SLOW");
    // LOW never finalizes, even late — stale detector owns that case.
    expect(
      decideFinalization({ status: "FT", elapsed: 92, minutesSinceKickoff: 200, confidence: "LOW" }),
    ).toBe("WAIT");
  });

  it("ABD is exempt from the minute floor (legitimate early abandonment)", () => {
    expect(
      decideFinalization({ status: "ABD", elapsed: 23, minutesSinceKickoff: 30, confidence: "HIGH" }),
    ).toBe("FAST");
  });

  it("falls back to wall-clock when the feed has no elapsed", () => {
    expect(
      decideFinalization({ status: "FT", elapsed: null, minutesSinceKickoff: 60, confidence: "HIGH" }),
    ).toBe("WAIT");
    expect(
      decideFinalization({ status: "FT", elapsed: null, minutesSinceKickoff: 115, confidence: "HIGH" }),
    ).toBe("FAST");
  });
});

describe("isFinalizedButFeedLive (R11)", () => {
  it("fires when COMPLETED but the feed says the match is live", () => {
    expect(isFinalizedButFeedLive("COMPLETED", "2H")).toBe(true);
    expect(isFinalizedButFeedLive("COMPLETED", "ET")).toBe(true);
    expect(isFinalizedButFeedLive("COMPLETED", "P")).toBe(true);
  });

  it("stays quiet for terminal feeds, NS re-registrations and live matches", () => {
    expect(isFinalizedButFeedLive("COMPLETED", "FT")).toBe(false);
    expect(isFinalizedButFeedLive("COMPLETED", "NS")).toBe(false);
    expect(isFinalizedButFeedLive("IN_PROGRESS", "2H")).toBe(false);
    expect(isFinalizedButFeedLive(null, "2H")).toBe(false);
    expect(isFinalizedButFeedLive(undefined, "1H")).toBe(false);
  });
});

describe("detectIncoherences (R2–R6 class)", () => {
  const g90none = { homeGoals90: null, awayGoals90: null };

  it("flags a score regression vs the previous payload", () => {
    expect(
      detectIncoherences({
        prev: { homeGoals: 2, awayGoals: 1 },
        score: { homeGoals: 1, awayGoals: 1, penaltyHome: null, penaltyAway: null },
        goals90: g90none,
      }),
    ).toEqual(["SCORE_REGRESSION"]);
  });

  it("flags penalties on a non-tied scoreline", () => {
    expect(
      detectIncoherences({
        prev: null,
        score: { homeGoals: 2, awayGoals: 1, penaltyHome: 4, penaltyAway: 3 },
        goals90: g90none,
      }),
    ).toEqual(["PENALTIES_ON_NON_TIED"]);
  });

  it("flags goals90 above the full score", () => {
    expect(
      detectIncoherences({
        prev: null,
        score: { homeGoals: 1, awayGoals: 1, penaltyHome: null, penaltyAway: null },
        goals90: { homeGoals90: 2, awayGoals90: 1 },
      }),
    ).toEqual(["GOALS90_EXCEEDS_FULL"]);
  });

  it("clean payloads report nothing", () => {
    expect(
      detectIncoherences({
        prev: { homeGoals: 1, awayGoals: 1 },
        score: { homeGoals: 2, awayGoals: 1, penaltyHome: null, penaltyAway: null },
        goals90: g90none,
      }),
    ).toEqual([]);
    // Legit AET: full 3-2 with goals90 2-2 (Bélgica–Senegal 2026-07-01).
    expect(
      detectIncoherences({
        prev: { homeGoals: 2, awayGoals: 2 },
        score: { homeGoals: 3, awayGoals: 2, penaltyHome: null, penaltyAway: null },
        goals90: { homeGoals90: 2, awayGoals90: 2 },
      }),
    ).toEqual([]);
    // Legit PEN: tied 1-1 with pens 3-4 (Alemania–Paraguay 2026-06-29).
    expect(
      detectIncoherences({
        prev: { homeGoals: 1, awayGoals: 1 },
        score: { homeGoals: 1, awayGoals: 1, penaltyHome: 3, penaltyAway: 4 },
        goals90: { homeGoals90: 1, awayGoals90: 1 },
      }),
    ).toEqual([]);
  });
});
