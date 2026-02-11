/**
 * Tests for scoringBreakdown.ts
 * Covers: Breakdown generation for CUMULATIVE, LEGACY, GROUP_STANDINGS, KNOCKOUT_WINNER
 * Ensures the UI breakdown display shows correct data
 */
import { describe, it, expect } from "vitest";
import {
  generateMatchPickBreakdown,
  generateGroupStandingsBreakdown,
  generateKnockoutWinnerBreakdown,
} from "./scoringBreakdown";
import { scoreMatchPick } from "./scoringAdvanced";
import type { PhasePickConfig } from "../types/pickConfig";

// ==================== HELPERS ====================

function makeCumulativeConfig(isKnockout = false): PhasePickConfig {
  return {
    phaseId: isKnockout ? "r32_leg1" : "group_stage",
    phaseName: isKnockout ? "Dieciseisavos Ida" : "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: isKnockout ? 2 : 1 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: isKnockout ? 10 : 5 },
        { key: "HOME_GOALS", enabled: true, points: isKnockout ? 4 : 2 },
        { key: "AWAY_GOALS", enabled: true, points: isKnockout ? 4 : 2 },
      ],
    },
  };
}

function makeLegacyConfig(): PhasePickConfig {
  return {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 10 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 5 },
        { key: "PARTIAL_SCORE", enabled: true, points: 3 },
        { key: "TOTAL_GOALS", enabled: true, points: 2 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 4 },
      ],
    },
  };
}

function makeGroupStandingsConfig(): PhasePickConfig {
  return {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: false,
    structuralPicks: {
      type: "GROUP_STANDINGS" as any,
      config: {
        pointsPosition1: 10,
        pointsPosition2: 8,
        pointsPosition3: 6,
        pointsPosition4: 4,
        bonusPerfectGroupEnabled: true,
        bonusPerfectGroup: 20,
      },
    },
  };
}

function makeKnockoutWinnerConfig(): PhasePickConfig {
  return {
    phaseId: "round_of_16",
    phaseName: "Octavos de Final",
    requiresScore: false,
    structuralPicks: {
      type: "KNOCKOUT_WINNER" as any,
      config: {
        pointsPerCorrectAdvance: 15,
      },
    },
  };
}

// ==================== MATCH PICK BREAKDOWN - CUMULATIVE ====================

describe("generateMatchPickBreakdown - CUMULATIVE", () => {
  it("returns NO_PICK when pick is null", () => {
    const config = makeCumulativeConfig();
    const result = generateMatchPickBreakdown(null, { homeGoals: 2, awayGoals: 1 }, config, "m1");
    expect(result.type).toBe("NO_PICK");
    expect(result.totalPointsEarned).toBe(0);
    expect(result.totalPointsMax).toBe(10);
  });

  it("returns pending when result is null", () => {
    const config = makeCumulativeConfig();
    const result = generateMatchPickBreakdown({ homeGoals: 2, awayGoals: 1 }, null, config, "m1");
    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      expect(result.hasPick).toBe(true);
      expect(result.hasResult).toBe(false);
      expect(result.totalPointsEarned).toBe(0);
      expect(result.summary).toBe("Pendiente de resultado");
    }
  });

  it("breakdown for exact score shows ALL 4 rules matched", () => {
    const config = makeCumulativeConfig();
    const result = generateMatchPickBreakdown(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      expect(result.totalPointsEarned).toBe(10);
      expect(result.totalPointsMax).toBe(10);
      expect(result.rules).toHaveLength(4);
      expect(result.rules.every((r) => r.matched)).toBe(true);
      expect(result.summary).toBe("10 / 10 pts");
    }
  });

  it("breakdown for knockout exact score shows 20 pts max", () => {
    const config = makeCumulativeConfig(true);
    const result = generateMatchPickBreakdown(
      { homeGoals: 3, awayGoals: 0 },
      { homeGoals: 3, awayGoals: 0 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      expect(result.totalPointsEarned).toBe(20);
      expect(result.totalPointsMax).toBe(20);
    }
  });

  it("breakdown for partial match shows individual rule results", () => {
    const config = makeCumulativeConfig();
    // Pick: 2-1 (HOME, diff +1)
    // Result: 3-1 (HOME, diff +2)
    const result = generateMatchPickBreakdown(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 1 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      // outcome: HOME=HOME ✓ (5pts)
      // home: 2≠3 ✗
      // away: 1=1 ✓ (2pts)
      // diff: +1≠+2 ✗
      expect(result.totalPointsEarned).toBe(7);

      const outcomeRule = result.rules.find((r) => r.ruleKey === "MATCH_OUTCOME_90MIN");
      expect(outcomeRule!.matched).toBe(true);
      expect(outcomeRule!.pointsEarned).toBe(5);

      const homeRule = result.rules.find((r) => r.ruleKey === "HOME_GOALS");
      expect(homeRule!.matched).toBe(false);
      expect(homeRule!.pointsEarned).toBe(0);

      const awayRule = result.rules.find((r) => r.ruleKey === "AWAY_GOALS");
      expect(awayRule!.matched).toBe(true);
      expect(awayRule!.pointsEarned).toBe(2);

      const diffRule = result.rules.find((r) => r.ruleKey === "GOAL_DIFFERENCE");
      expect(diffRule!.matched).toBe(false);
    }
  });

  it("breakdown for zero points shows all rules as unmatched", () => {
    const config = makeCumulativeConfig();
    const result = generateMatchPickBreakdown(
      { homeGoals: 1, awayGoals: 0 },
      { homeGoals: 0, awayGoals: 3 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      expect(result.totalPointsEarned).toBe(0);
      expect(result.rules.every((r) => !r.matched)).toBe(true);
    }
  });
});

// ==================== MATCH PICK BREAKDOWN - LEGACY ====================

describe("generateMatchPickBreakdown - LEGACY", () => {
  it("exact score terminates and shows other rules as N/A", () => {
    const config = makeLegacyConfig();
    const result = generateMatchPickBreakdown(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      expect(result.totalPointsEarned).toBe(10);
      expect(result.rules[0].ruleKey).toBe("EXACT_SCORE");
      expect(result.rules[0].matched).toBe(true);

      // Other rules should have pointsMax=0 (N/A)
      const otherRules = result.rules.filter((r) => r.ruleKey !== "EXACT_SCORE");
      for (const rule of otherRules) {
        expect(rule.pointsMax).toBe(0);
        expect(rule.details).toContain("No aplica");
      }
    }
  });

  it("missed exact score cascades to other rules", () => {
    const config = makeLegacyConfig();
    // Pick: 2-0 (HOME, diff +2, total 2)
    // Result: 3-1 (HOME, diff +2, total 4)
    const result = generateMatchPickBreakdown(
      { homeGoals: 2, awayGoals: 0 },
      { homeGoals: 3, awayGoals: 1 },
      config,
      "m1"
    );

    expect(result.type).toBe("MATCH");
    if (result.type === "MATCH") {
      // EXACT: miss, DIFF: +2=+2 (5), PARTIAL: neither XOR (0), TOTAL: 2≠4 (0), OUTCOME: HOME=HOME (4)
      expect(result.totalPointsEarned).toBe(9);
    }
  });

  it("maxPoints is the highest single type (EXACT_SCORE=10)", () => {
    const config = makeLegacyConfig();
    const result = generateMatchPickBreakdown(null, { homeGoals: 1, awayGoals: 0 }, config, "m1");
    expect(result.totalPointsMax).toBe(10);
  });
});

// ==================== GROUP STANDINGS BREAKDOWN ====================

describe("generateGroupStandingsBreakdown", () => {
  const groupsInfo = [
    { id: "A", name: "Group A", teamCount: 4 },
    { id: "B", name: "Group B", teamCount: 4 },
  ];

  const teamsMap = new Map([
    ["t1", { id: "t1", name: "Team 1" }],
    ["t2", { id: "t2", name: "Team 2" }],
    ["t3", { id: "t3", name: "Team 3" }],
    ["t4", { id: "t4", name: "Team 4" }],
    ["t5", { id: "t5", name: "Team 5" }],
    ["t6", { id: "t6", name: "Team 6" }],
    ["t7", { id: "t7", name: "Team 7" }],
    ["t8", { id: "t8", name: "Team 8" }],
  ]);

  it("returns NO_PICK when pickData is null", () => {
    const config = makeGroupStandingsConfig();
    const result = generateGroupStandingsBreakdown(null, null, config, groupsInfo, teamsMap);
    expect(result.type).toBe("NO_PICK");
    expect(result.totalPointsEarned).toBe(0);
  });

  it("perfect groups give full points + bonus", () => {
    const config = makeGroupStandingsConfig();
    const pickData = {
      groups: [
        { groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] },
        { groupId: "B", teamIds: ["t5", "t6", "t7", "t8"] },
      ],
    };
    const resultData = {
      groups: [
        { groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] },
        { groupId: "B", teamIds: ["t5", "t6", "t7", "t8"] },
      ],
    };

    const result = generateGroupStandingsBreakdown(pickData, resultData, config, groupsInfo, teamsMap);
    expect(result.type).toBe("GROUP_STANDINGS");
    if (result.type === "GROUP_STANDINGS") {
      // Per group: 10+8+6+4 = 28 positions + 20 bonus = 48
      // 2 groups: 48 * 2 = 96
      expect(result.totalPointsEarned).toBe(96);
      expect(result.groups[0].bonusPerfectGroup.achieved).toBe(true);
      expect(result.groups[1].bonusPerfectGroup.achieved).toBe(true);
    }
  });

  it("partial correct positions give proportional points without bonus", () => {
    const config = makeGroupStandingsConfig();
    const pickData = {
      groups: [
        { groupId: "A", teamIds: ["t1", "t3", "t2", "t4"] }, // 1st and 4th correct
      ],
    };
    const resultData = {
      groups: [
        { groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] },
      ],
    };

    const result = generateGroupStandingsBreakdown(pickData, resultData, config, groupsInfo, teamsMap);
    if (result.type === "GROUP_STANDINGS") {
      const groupA = result.groups.find((g) => g.groupId === "A")!;
      // Position 1: t1 correct (10pts)
      // Position 2: t2 predicted at 3rd → wrong (0pts)
      // Position 3: t3 predicted at 2nd → wrong (0pts)
      // Position 4: t4 correct (4pts)
      expect(groupA.totalPointsEarned).toBe(14);
      expect(groupA.bonusPerfectGroup.achieved).toBe(false);
    }
  });

  it("no bonus when group is not perfect", () => {
    const config = makeGroupStandingsConfig();
    const pickData = {
      groups: [{ groupId: "A", teamIds: ["t1", "t3", "t2", "t4"] }],
    };
    const resultData = {
      groups: [{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
    };

    const result = generateGroupStandingsBreakdown(pickData, resultData, config, groupsInfo, teamsMap);
    if (result.type === "GROUP_STANDINGS") {
      expect(result.groups[0].bonusPerfectGroup.achieved).toBe(false);
      expect(result.groups[0].bonusPerfectGroup.pointsEarned).toBe(0);
    }
  });
});

// ==================== KNOCKOUT WINNER BREAKDOWN ====================

describe("generateKnockoutWinnerBreakdown", () => {
  const matchesInfo = [
    { id: "m1", homeTeamId: "t1", awayTeamId: "t2" },
    { id: "m2", homeTeamId: "t3", awayTeamId: "t4" },
    { id: "m3", homeTeamId: "t5", awayTeamId: "t6" },
    { id: "m4", homeTeamId: "t7", awayTeamId: "t8" },
  ];

  const teamsMap = new Map([
    ["t1", { id: "t1", name: "Arsenal" }],
    ["t2", { id: "t2", name: "Bayern" }],
    ["t3", { id: "t3", name: "Liverpool" }],
    ["t4", { id: "t4", name: "Barcelona" }],
    ["t5", { id: "t5", name: "Chelsea" }],
    ["t6", { id: "t6", name: "PSG" }],
    ["t7", { id: "t7", name: "Man City" }],
    ["t8", { id: "t8", name: "Real Madrid" }],
  ]);

  it("returns NO_PICK when pickData is null", () => {
    const config = makeKnockoutWinnerConfig();
    const result = generateKnockoutWinnerBreakdown(null, null, config, matchesInfo, teamsMap);
    expect(result.type).toBe("NO_PICK");
    expect(result.totalPointsMax).toBe(60); // 4 matches × 15
  });

  it("all correct predictions give max points", () => {
    const config = makeKnockoutWinnerConfig();
    const pickData = {
      matches: [
        { matchId: "m1", winnerId: "t1" },
        { matchId: "m2", winnerId: "t3" },
        { matchId: "m3", winnerId: "t5" },
        { matchId: "m4", winnerId: "t8" },
      ],
    };
    const resultData = {
      matches: [
        { matchId: "m1", winnerId: "t1" },
        { matchId: "m2", winnerId: "t3" },
        { matchId: "m3", winnerId: "t5" },
        { matchId: "m4", winnerId: "t8" },
      ],
    };

    const result = generateKnockoutWinnerBreakdown(pickData, resultData, config, matchesInfo, teamsMap);
    if (result.type === "KNOCKOUT_WINNER") {
      expect(result.totalPointsEarned).toBe(60);
      expect(result.matches.every((m) => m.matched)).toBe(true);
    }
  });

  it("partial correct predictions give proportional points", () => {
    const config = makeKnockoutWinnerConfig();
    const pickData = {
      matches: [
        { matchId: "m1", winnerId: "t1" },
        { matchId: "m2", winnerId: "t4" }, // wrong
        { matchId: "m3", winnerId: "t5" },
        { matchId: "m4", winnerId: "t7" }, // wrong
      ],
    };
    const resultData = {
      matches: [
        { matchId: "m1", winnerId: "t1" },
        { matchId: "m2", winnerId: "t3" },
        { matchId: "m3", winnerId: "t5" },
        { matchId: "m4", winnerId: "t8" },
      ],
    };

    const result = generateKnockoutWinnerBreakdown(pickData, resultData, config, matchesInfo, teamsMap);
    if (result.type === "KNOCKOUT_WINNER") {
      expect(result.totalPointsEarned).toBe(30); // 2 × 15
      expect(result.matches.filter((m) => m.matched)).toHaveLength(2);
    }
  });

  it("pending results show 0 earned but correct max", () => {
    const config = makeKnockoutWinnerConfig();
    const pickData = {
      matches: [
        { matchId: "m1", winnerId: "t1" },
        { matchId: "m2", winnerId: "t3" },
      ],
    };

    // No result data yet
    const result = generateKnockoutWinnerBreakdown(pickData, null, config, matchesInfo, teamsMap);
    if (result.type === "KNOCKOUT_WINNER") {
      expect(result.totalPointsEarned).toBe(0);
      expect(result.hasResult).toBe(false);
      expect(result.summary).toContain("Pendiente");
    }
  });
});

// ==================== CONSISTENCY BETWEEN scoringAdvanced AND scoringBreakdown ====================

describe("Scoring consistency between scoringAdvanced and scoringBreakdown", () => {

  const testCases = [
    { pick: { homeGoals: 2, awayGoals: 1 }, result: { homeGoals: 2, awayGoals: 1 }, label: "exact score" },
    { pick: { homeGoals: 3, awayGoals: 1 }, result: { homeGoals: 2, awayGoals: 0 }, label: "outcome+diff match" },
    { pick: { homeGoals: 1, awayGoals: 0 }, result: { homeGoals: 0, awayGoals: 3 }, label: "total miss" },
    { pick: { homeGoals: 0, awayGoals: 0 }, result: { homeGoals: 0, awayGoals: 0 }, label: "0-0 exact" },
    { pick: { homeGoals: 1, awayGoals: 1 }, result: { homeGoals: 2, awayGoals: 2 }, label: "draw correct" },
    { pick: { homeGoals: 2, awayGoals: 1 }, result: { homeGoals: 3, awayGoals: 1 }, label: "away only match" },
  ];

  for (const tc of testCases) {
    it(`CUMULATIVE groups: scoringAdvanced and breakdown agree for "${tc.label}"`, () => {
      const config = makeCumulativeConfig(false);

      const scoring = scoreMatchPick(tc.pick, tc.result, config);
      const breakdown = generateMatchPickBreakdown(tc.pick, tc.result, config, "test");

      if (breakdown.type === "MATCH") {
        expect(breakdown.totalPointsEarned).toBe(scoring.totalPoints);
      }
    });

    it(`CUMULATIVE knockout: scoringAdvanced and breakdown agree for "${tc.label}"`, () => {
      const config = makeCumulativeConfig(true);

      const scoring = scoreMatchPick(tc.pick, tc.result, config);
      const breakdown = generateMatchPickBreakdown(tc.pick, tc.result, config, "test");

      if (breakdown.type === "MATCH") {
        expect(breakdown.totalPointsEarned).toBe(scoring.totalPoints);
      }
    });
  }

  for (const tc of testCases) {
    it(`LEGACY: scoringAdvanced and breakdown agree for "${tc.label}"`, () => {
      const config = makeLegacyConfig();

      const scoring = scoreMatchPick(tc.pick, tc.result, config);
      const breakdown = generateMatchPickBreakdown(tc.pick, tc.result, config, "test");

      if (breakdown.type === "MATCH") {
        expect(breakdown.totalPointsEarned).toBe(scoring.totalPoints);
      }
    });
  }
});

// ==================== REAL-WORLD UCL SCENARIOS ====================

describe("Real-world UCL 2025-26 scenarios", () => {
  it("Olympiacos 2-1 Leverkusen (R32 Leg1) with CUMULATIVE scoring", () => {
    const config = makeCumulativeConfig(true); // knockout = 20 max

    // User predicts 1-0, result is 2-1
    const result = generateMatchPickBreakdown(
      { homeGoals: 1, awayGoals: 0 },
      { homeGoals: 2, awayGoals: 1 },
      config,
      "r32_1_leg1"
    );

    if (result.type === "MATCH") {
      // Outcome: HOME=HOME ✓ (10)
      // Home: 1≠2 ✗
      // Away: 0≠1 ✗
      // Diff: +1=+1 ✓ (2)
      expect(result.totalPointsEarned).toBe(12);
    }
  });

  it("Barcelona 0-0 Man City (R32 Leg2) with CUMULATIVE scoring", () => {
    const config = makeCumulativeConfig(true);

    // User predicts 1-1, result is 0-0
    const result = generateMatchPickBreakdown(
      { homeGoals: 1, awayGoals: 1 },
      { homeGoals: 0, awayGoals: 0 },
      config,
      "r32_5_leg2"
    );

    if (result.type === "MATCH") {
      // Outcome: DRAW=DRAW ✓ (10)
      // Home: 1≠0 ✗
      // Away: 1≠0 ✗
      // Diff: 0=0 ✓ (2)
      expect(result.totalPointsEarned).toBe(12);
    }
  });

  it("Liverpool 3-0 Tottenham (R32 Leg1) perfect prediction", () => {
    const config = makeCumulativeConfig(true);

    const result = generateMatchPickBreakdown(
      { homeGoals: 3, awayGoals: 0 },
      { homeGoals: 3, awayGoals: 0 },
      config,
      "r32_2_leg1"
    );

    if (result.type === "MATCH") {
      expect(result.totalPointsEarned).toBe(20);
      expect(result.rules.every((r) => r.matched)).toBe(true);
    }
  });
});
