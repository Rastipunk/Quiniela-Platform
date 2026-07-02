import { describe, it, expect } from "vitest";
import { outcomeSide, deriveMajorityOutcome, type FinalResultRow } from "./knockoutOutcome";
import { findDependentPhaseIds } from "../services/progressiveKnockout";

const row = (over: Partial<FinalResultRow>): FinalResultRow => ({
  source: "API_CONFIRMED",
  homeGoals: 0,
  awayGoals: 0,
  homePenalties: null,
  awayPenalties: null,
  ...over,
});

describe("outcomeSide", () => {
  it("regulation/ET winner by goals", () => {
    expect(outcomeSide(row({ homeGoals: 2, awayGoals: 1 }))).toBe("HOME");
    expect(outcomeSide(row({ homeGoals: 0, awayGoals: 1 }))).toBe("AWAY");
  });
  it("tie resolved by penalties (Alemania–Paraguay 1-1 pens 3-4)", () => {
    expect(outcomeSide(row({ homeGoals: 1, awayGoals: 1, homePenalties: 3, awayPenalties: 4 }))).toBe("AWAY");
  });
  it("tie without penalties (or tied pens) is undecidable", () => {
    expect(outcomeSide(row({ homeGoals: 1, awayGoals: 1 }))).toBeNull();
    expect(outcomeSide(row({ homeGoals: 1, awayGoals: 1, homePenalties: 4, awayPenalties: 4 }))).toBeNull();
  });
});

describe("deriveMajorityOutcome", () => {
  it("unanimous FINAL results decide", () => {
    const rows = Array.from({ length: 465 }, () => row({ homeGoals: 2, awayGoals: 1 }));
    expect(deriveMajorityOutcome(rows)).toBe("HOME");
  });

  // Prod case: 464 pools 2-1 Brasil (API_CONFIRMED) + one test pool the host
  // overrode to 2-2 pens 6-5. Majority must not be steered by the override.
  it("one eccentric HOST_OVERRIDE cannot steer the instance bracket", () => {
    const rows = [
      ...Array.from({ length: 464 }, () => row({ homeGoals: 2, awayGoals: 1 })),
      row({ source: "HOST_OVERRIDE", homeGoals: 2, awayGoals: 2, homePenalties: 6, awayPenalties: 5 }),
    ];
    expect(deriveMajorityOutcome(rows)).toBe("HOME");
  });

  it("provisional rows never vote", () => {
    const rows = [
      row({ source: "SCRAPER_PROVISIONAL", homeGoals: 5, awayGoals: 0 }),
      row({ source: "API_CONFIRMED", homeGoals: 0, awayGoals: 1 }),
    ];
    expect(deriveMajorityOutcome(rows)).toBe("AWAY");
  });

  it("no FINAL rows, or a dead heat, returns null (never guesses)", () => {
    expect(deriveMajorityOutcome([row({ source: "SCRAPER_PROVISIONAL", homeGoals: 1, awayGoals: 0 })])).toBeNull();
    expect(
      deriveMajorityOutcome([
        row({ homeGoals: 1, awayGoals: 0 }),
        row({ homeGoals: 0, awayGoals: 1 }),
      ]),
    ).toBeNull();
  });
});

describe("findDependentPhaseIds", () => {
  const wcMatches = [
    { id: "m_R32_1", phaseId: "round_of_32", homeTeamId: "t_B1", awayTeamId: "t_A3" },
    { id: "m_R16_2", phaseId: "round_of_16", homeTeamId: "W_R32_1", awayTeamId: "W_R32_3" },
    { id: "m_SF_1", phaseId: "semi_finals", homeTeamId: "W_QF_1", awayTeamId: "W_QF_2" },
    { id: "m_3RD", phaseId: "finals", homeTeamId: "L_SF_1", awayTeamId: "L_SF_2" },
    { id: "m_FINAL", phaseId: "finals", homeTeamId: "W_SF_1", awayTeamId: "W_SF_2" },
  ];

  it("an R32 match feeds round_of_16", () => {
    expect(findDependentPhaseIds(wcMatches, "m_R32_1")).toEqual(["round_of_16"]);
  });

  it("a semifinal feeds finals via BOTH winner (m_FINAL) and loser (m_3RD)", () => {
    expect(findDependentPhaseIds(wcMatches, "m_SF_1")).toEqual(["finals"]);
  });

  it("the final feeds nothing", () => {
    expect(findDependentPhaseIds(wcMatches, "m_FINAL")).toEqual([]);
  });

  it("already-resolved dependents no longer reference the feeder", () => {
    const resolved = wcMatches.map((m) =>
      m.id === "m_R16_2" ? { ...m, homeTeamId: "t_B1", awayTeamId: "t_F1" } : m,
    );
    expect(findDependentPhaseIds(resolved, "m_R32_1")).toEqual([]);
  });
});
