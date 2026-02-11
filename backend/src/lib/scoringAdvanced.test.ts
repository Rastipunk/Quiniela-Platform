/**
 * Tests for scoringAdvanced.ts
 * Covers: CUMULATIVE scoring, LEGACY scoring, auto-scaling, pointsMax calculations
 */
import { describe, it, expect } from "vitest";
import {
  scoreMatchPick,
  applyAutoScaling,
  applyAutoScalingToConfig,
  calculateMaxPointsForPhase,
  calculateMaxPointsForPool,
  getPhaseConfig,
  isMatchBasedScoring,
  isStructuralScoring,
} from "./scoringAdvanced";
import type { PhasePickConfig, MatchPicksConfig } from "../types/pickConfig";

// ==================== HELPERS ====================

/** Creates a CUMULATIVE phase config (groups: 5+2+2+1 = 10 max) */
function makeCumulativeGroupConfig(overrides?: Partial<PhasePickConfig>): PhasePickConfig {
  return {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 1 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 5 },
        { key: "HOME_GOALS", enabled: true, points: 2 },
        { key: "AWAY_GOALS", enabled: true, points: 2 },
      ],
    },
    ...overrides,
  };
}

/** Creates a CUMULATIVE knockout config (10+4+4+2 = 20 max) */
function makeCumulativeKnockoutConfig(overrides?: Partial<PhasePickConfig>): PhasePickConfig {
  return {
    phaseId: "r32_leg1",
    phaseName: "Dieciseisavos Ida",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 0 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
        { key: "HOME_GOALS", enabled: true, points: 4 },
        { key: "AWAY_GOALS", enabled: true, points: 4 },
      ],
    },
    ...overrides,
  };
}

/** Creates a LEGACY (BASIC) config with EXACT_SCORE only */
function makeLegacyBasicConfig(points = 20, overrides?: Partial<PhasePickConfig>): PhasePickConfig {
  return {
    phaseId: "group_stage",
    phaseName: "Fase de Grupos",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points },
        { key: "GOAL_DIFFERENCE", enabled: false, points: 0 },
        { key: "PARTIAL_SCORE", enabled: false, points: 0 },
        { key: "TOTAL_GOALS", enabled: false, points: 0 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
    },
    ...overrides,
  };
}

/** Creates a LEGACY config with multiple types (EXACT_SCORE + GOAL_DIFFERENCE + MATCH_OUTCOME) */
function makeLegacyMultiConfig(): PhasePickConfig {
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

// ==================== CUMULATIVE SCORING ====================

describe("scoreMatchPick - CUMULATIVE system", () => {
  describe("Exact score (all 4 criteria match)", () => {
    it("gives max points (10) in groups for exact match", () => {
      const config = makeCumulativeGroupConfig();
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        config
      );
      // outcome(5) + home(2) + away(2) + diff(1) = 10
      expect(result.totalPoints).toBe(10);
      expect(result.evaluations).toHaveLength(4);
      expect(result.evaluations.every((e) => e.matched)).toBe(true);
    });

    it("gives max points (20) in knockout for exact match", () => {
      const config = makeCumulativeKnockoutConfig();
      const result = scoreMatchPick(
        { homeGoals: 3, awayGoals: 0 },
        { homeGoals: 3, awayGoals: 0 },
        config
      );
      // outcome(10) + home(4) + away(4) + diff(2) = 20
      expect(result.totalPoints).toBe(20);
      expect(result.evaluations).toHaveLength(4);
      expect(result.evaluations.every((e) => e.matched)).toBe(true);
    });

    it("gives max points for 0-0 draw", () => {
      const config = makeCumulativeGroupConfig();
      const result = scoreMatchPick(
        { homeGoals: 0, awayGoals: 0 },
        { homeGoals: 0, awayGoals: 0 },
        config
      );
      expect(result.totalPoints).toBe(10);
    });
  });

  describe("Partial matches (some criteria)", () => {
    it("gives outcome + diff for correct winner but wrong goals", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 3-1 (HOME wins, diff +2)
      // Result: 2-0 (HOME wins, diff +2)
      const result = scoreMatchPick(
        { homeGoals: 3, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 0 },
        config
      );
      // outcome(5) + diff(1) = 6 (home/away wrong)
      expect(result.totalPoints).toBe(6);
      const matched = result.evaluations.filter((e) => e.matched);
      expect(matched).toHaveLength(2);
      expect(matched.map((e) => e.matchPickType).sort()).toEqual(["GOAL_DIFFERENCE", "MATCH_OUTCOME_90MIN"]);
    });

    it("gives only outcome for correct winner but wrong diff", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 1-0 (HOME wins, diff +1)
      // Result: 3-0 (HOME wins, diff +3)
      const result = scoreMatchPick(
        { homeGoals: 1, awayGoals: 0 },
        { homeGoals: 3, awayGoals: 0 },
        config
      );
      // outcome(5) + away(2) = 7 (away=0 matches)
      expect(result.totalPoints).toBe(7);
    });

    it("gives only home goals for only home correct", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 2-1 (HOME wins)
      // Result: 2-3 (AWAY wins)
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 3 },
        config
      );
      // Only home(2) matches
      expect(result.totalPoints).toBe(2);
    });

    it("gives only away goals for only away correct", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 0-2 (AWAY wins)
      // Result: 3-2 (HOME wins)
      const result = scoreMatchPick(
        { homeGoals: 0, awayGoals: 2 },
        { homeGoals: 3, awayGoals: 2 },
        config
      );
      // Only away(2) matches
      expect(result.totalPoints).toBe(2);
    });

    it("gives 0 points when nothing matches", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 1-0 (HOME wins, diff +1)
      // Result: 0-3 (AWAY wins, diff -3)
      const result = scoreMatchPick(
        { homeGoals: 1, awayGoals: 0 },
        { homeGoals: 0, awayGoals: 3 },
        config
      );
      expect(result.totalPoints).toBe(0);
      expect(result.evaluations.every((e) => !e.matched)).toBe(true);
    });
  });

  describe("Draw scenarios", () => {
    it("gives outcome + diff for correct draw but wrong goals", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 1-1 (DRAW, diff 0)
      // Result: 2-2 (DRAW, diff 0)
      const result = scoreMatchPick(
        { homeGoals: 1, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 2 },
        config
      );
      // outcome(5) + diff(1) = 6
      expect(result.totalPoints).toBe(6);
    });

    it("gives 0 for predicted draw but actual win", () => {
      const config = makeCumulativeGroupConfig();
      // Pick: 1-1 (DRAW)
      // Result: 2-1 (HOME)
      const result = scoreMatchPick(
        { homeGoals: 1, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        config
      );
      // away(2) matches (both = 1)
      expect(result.totalPoints).toBe(2);
    });
  });

  describe("CUMULATIVE with TOTAL_GOALS enabled", () => {
    it("includes TOTAL_GOALS in sum when enabled", () => {
      const config: PhasePickConfig = {
        phaseId: "custom",
        phaseName: "Custom",
        requiresScore: true,
        matchPicks: {
          types: [
            { key: "EXACT_SCORE", enabled: false, points: 0 },
            { key: "GOAL_DIFFERENCE", enabled: true, points: 1 },
            { key: "PARTIAL_SCORE", enabled: false, points: 0 },
            { key: "TOTAL_GOALS", enabled: true, points: 3 },
            { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 5 },
            { key: "HOME_GOALS", enabled: true, points: 2 },
            { key: "AWAY_GOALS", enabled: true, points: 2 },
          ],
        },
      };

      // Pick: 2-1 (3 total), Result: 3-0 (3 total)
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 3, awayGoals: 0 },
        config
      );
      // outcome(5, HOME=HOME) + total_goals(3, 3=3) = 8
      expect(result.totalPoints).toBe(8);
    });
  });
});

// ==================== LEGACY SCORING ====================

describe("scoreMatchPick - LEGACY system", () => {
  describe("BASIC preset (EXACT_SCORE only)", () => {
    it("gives full points for exact match", () => {
      const config = makeLegacyBasicConfig(20);
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        config
      );
      expect(result.totalPoints).toBe(20);
      expect(result.evaluations).toHaveLength(1);
      expect(result.evaluations[0].matched).toBe(true);
    });

    it("gives 0 for wrong score", () => {
      const config = makeLegacyBasicConfig(20);
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 1, awayGoals: 0 },
        config
      );
      expect(result.totalPoints).toBe(0);
    });

    it("gives scaled points per phase (groups=20, R16=30, QF=40, SF=50, F=60)", () => {
      const points = [20, 30, 40, 50, 60];
      points.forEach((pts) => {
        const config = makeLegacyBasicConfig(pts);
        const result = scoreMatchPick(
          { homeGoals: 1, awayGoals: 0 },
          { homeGoals: 1, awayGoals: 0 },
          config
        );
        expect(result.totalPoints).toBe(pts);
      });
    });
  });

  describe("Multi-type LEGACY (EXACT_SCORE terminates)", () => {
    it("gives only EXACT_SCORE points when exact match (no cascade)", () => {
      const config = makeLegacyMultiConfig();
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        config
      );
      // EXACT_SCORE terminates: only 10 pts, not 10+5+3+2+4
      expect(result.totalPoints).toBe(10);
      expect(result.evaluations[0].matchPickType).toBe("EXACT_SCORE");
      expect(result.evaluations[0].matched).toBe(true);
    });

    it("cascades to other rules when exact score misses", () => {
      const config = makeLegacyMultiConfig();
      // Pick: 2-0 (HOME, diff +2, total 2)
      // Result: 3-1 (HOME, diff +2, total 4)
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 0 },
        { homeGoals: 3, awayGoals: 1 },
        config
      );
      // EXACT_SCORE: miss
      // GOAL_DIFFERENCE: +2 = +2 → match (5 pts)
      // PARTIAL_SCORE: home miss, away miss → no XOR → 0
      // TOTAL_GOALS: 2 ≠ 4 → 0
      // MATCH_OUTCOME_90MIN: HOME = HOME → match (4 pts)
      expect(result.totalPoints).toBe(9);
    });

    it("gives PARTIAL_SCORE when exactly one goal matches", () => {
      const config = makeLegacyMultiConfig();
      // Pick: 2-1 (HOME, diff +1, total 3)
      // Result: 2-3 (AWAY, diff -1, total 5)
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 3 },
        config
      );
      // EXACT_SCORE: miss
      // GOAL_DIFFERENCE: +1 ≠ -1 → 0
      // PARTIAL_SCORE: home=2 matches, away doesn't → XOR → 3 pts
      // TOTAL_GOALS: 3 ≠ 5 → 0
      // MATCH_OUTCOME_90MIN: HOME ≠ AWAY → 0
      expect(result.totalPoints).toBe(3);
    });

    it("does NOT give PARTIAL_SCORE when both goals match (that's EXACT)", () => {
      const config = makeLegacyMultiConfig();
      // Pick: 2-1, Result: 2-1 → EXACT_SCORE takes over
      const result = scoreMatchPick(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        config
      );
      expect(result.totalPoints).toBe(10); // Only EXACT_SCORE
    });
  });
});

// ==================== EDGE CASES ====================

describe("scoreMatchPick - Edge cases", () => {
  it("throws when config has requiresScore=false", () => {
    const config: PhasePickConfig = {
      phaseId: "group",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: { type: "GROUP_STANDINGS" as any, config: {} },
    };
    expect(() =>
      scoreMatchPick({ homeGoals: 1, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, config)
    ).toThrow();
  });

  it("handles high-scoring matches correctly", () => {
    const config = makeCumulativeGroupConfig();
    const result = scoreMatchPick(
      { homeGoals: 7, awayGoals: 1 },
      { homeGoals: 7, awayGoals: 1 },
      config
    );
    expect(result.totalPoints).toBe(10);
  });

  it("handles 0-0 in legacy BASIC preset", () => {
    const config = makeLegacyBasicConfig(20);
    const result = scoreMatchPick(
      { homeGoals: 0, awayGoals: 0 },
      { homeGoals: 0, awayGoals: 0 },
      config
    );
    expect(result.totalPoints).toBe(20);
  });
});

// ==================== AUTO-SCALING ====================

describe("Auto-scaling", () => {
  const configWithScaling: MatchPicksConfig = {
    types: [{ key: "EXACT_SCORE", enabled: true, points: 20 }],
    autoScaling: {
      enabled: true,
      basePhase: "group_stage",
      multipliers: {
        group_stage: 1.0,
        round_of_16: 1.5,
        quarter_finals: 2.0,
        semi_finals: 2.5,
        final: 3.0,
      },
    },
  };

  it("returns base points for base phase", () => {
    expect(applyAutoScaling(20, "group_stage", configWithScaling)).toBe(20);
  });

  it("multiplies correctly for R16 (1.5x)", () => {
    expect(applyAutoScaling(20, "round_of_16", configWithScaling)).toBe(30);
  });

  it("multiplies correctly for QF (2x)", () => {
    expect(applyAutoScaling(20, "quarter_finals", configWithScaling)).toBe(40);
  });

  it("multiplies correctly for Final (3x)", () => {
    expect(applyAutoScaling(20, "final", configWithScaling)).toBe(60);
  });

  it("returns base points when phase not in multipliers", () => {
    expect(applyAutoScaling(20, "unknown_phase", configWithScaling)).toBe(20);
  });

  it("returns base points when auto-scaling disabled", () => {
    const noScaling: MatchPicksConfig = {
      types: [{ key: "EXACT_SCORE", enabled: true, points: 20 }],
    };
    expect(applyAutoScaling(20, "final", noScaling)).toBe(20);
  });

  it("rounds to integer after scaling", () => {
    // 7 * 1.5 = 10.5 → 11
    expect(applyAutoScaling(7, "round_of_16", configWithScaling)).toBe(11);
  });
});

// ==================== POINTS MAX CALCULATION ====================

describe("calculateMaxPointsForPhase", () => {
  it("sums all enabled types for CUMULATIVE (groups: 5+2+2+1=10)", () => {
    const config = makeCumulativeGroupConfig();
    expect(calculateMaxPointsForPhase(config, 8)).toBe(80); // 10 * 8 matches
  });

  it("sums all enabled types for CUMULATIVE (knockout: 10+4+4+2=20)", () => {
    const config = makeCumulativeKnockoutConfig();
    expect(calculateMaxPointsForPhase(config, 4)).toBe(80); // 20 * 4 matches
  });

  it("uses max single type for LEGACY (only EXACT_SCORE=20)", () => {
    const config = makeLegacyBasicConfig(20);
    expect(calculateMaxPointsForPhase(config, 8)).toBe(160); // 20 * 8
  });

  it("uses max type for LEGACY multi-type", () => {
    const config = makeLegacyMultiConfig();
    // EXACT_SCORE=10 is the max among enabled types
    expect(calculateMaxPointsForPhase(config, 6)).toBe(60); // 10 * 6
  });

  it("returns 0 for structural phase", () => {
    const config: PhasePickConfig = {
      phaseId: "group",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: { type: "GROUP_STANDINGS" as any, config: {} },
    };
    expect(calculateMaxPointsForPhase(config, 10)).toBe(0);
  });
});

describe("calculateMaxPointsForPool", () => {
  it("sums across all phases correctly for UCL CUMULATIVE", () => {
    const phases: PhasePickConfig[] = [
      makeCumulativeKnockoutConfig({ phaseId: "r32_leg1", phaseName: "R32 Ida" }),
      makeCumulativeKnockoutConfig({ phaseId: "r32_leg2", phaseName: "R32 Vta" }),
      makeCumulativeKnockoutConfig({ phaseId: "r16_leg1", phaseName: "R16 Ida" }),
      makeCumulativeKnockoutConfig({ phaseId: "r16_leg2", phaseName: "R16 Vta" }),
      makeCumulativeKnockoutConfig({ phaseId: "qf_leg1", phaseName: "QF Ida" }),
      makeCumulativeKnockoutConfig({ phaseId: "qf_leg2", phaseName: "QF Vta" }),
      makeCumulativeKnockoutConfig({ phaseId: "sf_leg1", phaseName: "SF Ida" }),
      makeCumulativeKnockoutConfig({ phaseId: "sf_leg2", phaseName: "SF Vta" }),
      makeCumulativeKnockoutConfig({ phaseId: "final", phaseName: "Final" }),
    ];

    const matchCounts = new Map<string, number>([
      ["r32_leg1", 8], ["r32_leg2", 8],
      ["r16_leg1", 8], ["r16_leg2", 8],
      ["qf_leg1", 4], ["qf_leg2", 4],
      ["sf_leg1", 2], ["sf_leg2", 2],
      ["final", 1],
    ]);

    // 20 pts/match × (8+8+8+8+4+4+2+2+1) = 20 × 45 = 900
    expect(calculateMaxPointsForPool(phases, matchCounts)).toBe(900);
  });
});

// ==================== HELPER FUNCTIONS ====================

describe("getPhaseConfig", () => {
  const phases = [
    makeCumulativeGroupConfig(),
    makeCumulativeKnockoutConfig({ phaseId: "r32_leg1" }),
  ];

  it("finds existing phase", () => {
    expect(getPhaseConfig(phases, "group_stage")).toBeTruthy();
    expect(getPhaseConfig(phases, "group_stage")!.phaseId).toBe("group_stage");
  });

  it("returns null for non-existing phase", () => {
    expect(getPhaseConfig(phases, "nonexistent")).toBeNull();
  });
});

describe("isMatchBasedScoring / isStructuralScoring", () => {
  it("identifies match-based correctly", () => {
    expect(isMatchBasedScoring(makeCumulativeGroupConfig())).toBe(true);
    expect(isMatchBasedScoring(makeLegacyBasicConfig())).toBe(true);
  });

  it("identifies structural correctly", () => {
    const structural: PhasePickConfig = {
      phaseId: "group",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: { type: "GROUP_STANDINGS" as any, config: {} },
    };
    expect(isStructuralScoring(structural)).toBe(true);
    expect(isMatchBasedScoring(structural)).toBe(false);
  });
});
