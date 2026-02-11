/**
 * Tests for pickPresets.ts
 * Covers: All 3 presets, dynamic generation with real tournament phases, phase ID matching
 */
import { describe, it, expect } from "vitest";
import {
  BASIC_PRESET,
  SIMPLE_PRESET,
  CUMULATIVE_PRESET,
  getAllPresets,
  getPresetByKey,
  generateDynamicPresetConfig,
} from "./pickPresets";

// ==================== UCL 2025-26 PHASES (real data) ====================

const UCL_PHASES = [
  { id: "r32_leg1", name: "Dieciseisavos de Final - Ida", type: "KNOCKOUT_LEG" },
  { id: "r32_leg2", name: "Dieciseisavos de Final - Vuelta", type: "KNOCKOUT_LEG" },
  { id: "r16_leg1", name: "Octavos de Final - Ida", type: "KNOCKOUT_LEG" },
  { id: "r16_leg2", name: "Octavos de Final - Vuelta", type: "KNOCKOUT_LEG" },
  { id: "qf_leg1", name: "Cuartos de Final - Ida", type: "KNOCKOUT_LEG" },
  { id: "qf_leg2", name: "Cuartos de Final - Vuelta", type: "KNOCKOUT_LEG" },
  { id: "sf_leg1", name: "Semifinales - Ida", type: "KNOCKOUT_LEG" },
  { id: "sf_leg2", name: "Semifinales - Vuelta", type: "KNOCKOUT_LEG" },
  { id: "final", name: "Final", type: "KNOCKOUT_SINGLE" },
];

const WC_PHASES = [
  { id: "group_stage", name: "Fase de Grupos", type: "GROUP" },
  { id: "round_of_32", name: "Dieciseisavos", type: "KNOCKOUT" },
  { id: "round_of_16", name: "Octavos", type: "KNOCKOUT" },
  { id: "quarter_finals", name: "Cuartos", type: "KNOCKOUT" },
  { id: "semi_finals", name: "Semifinales", type: "KNOCKOUT" },
  { id: "final", name: "Final", type: "KNOCKOUT" },
];

// ==================== PRESET STRUCTURE VALIDATION ====================

describe("Preset structure validation", () => {
  describe("BASIC preset", () => {
    it("has correct key and metadata", () => {
      expect(BASIC_PRESET.key).toBe("BASIC");
      expect(BASIC_PRESET.name).toBeTruthy();
      expect(BASIC_PRESET.description).toBeTruthy();
    });

    it("all phases have requiresScore=true", () => {
      for (const phase of BASIC_PRESET.config) {
        expect(phase.requiresScore).toBe(true);
      }
    });

    it("only EXACT_SCORE is enabled", () => {
      for (const phase of BASIC_PRESET.config) {
        const enabled = phase.matchPicks!.types.filter((t) => t.enabled);
        expect(enabled).toHaveLength(1);
        expect(enabled[0].key).toBe("EXACT_SCORE");
      }
    });

    it("points increase across phases", () => {
      const points = BASIC_PRESET.config.map(
        (p) => p.matchPicks!.types.find((t) => t.key === "EXACT_SCORE")!.points
      );
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeGreaterThan(points[i - 1]);
      }
    });
  });

  describe("CUMULATIVE preset", () => {
    it("has correct key and metadata", () => {
      expect(CUMULATIVE_PRESET.key).toBe("CUMULATIVE");
      expect(CUMULATIVE_PRESET.name).toBeTruthy();
    });

    it("all phases have requiresScore=true", () => {
      for (const phase of CUMULATIVE_PRESET.config) {
        expect(phase.requiresScore).toBe(true);
      }
    });

    it("EXACT_SCORE is disabled in all phases", () => {
      for (const phase of CUMULATIVE_PRESET.config) {
        const exactScore = phase.matchPicks!.types.find((t) => t.key === "EXACT_SCORE");
        expect(exactScore!.enabled).toBe(false);
      }
    });

    it("HOME_GOALS, AWAY_GOALS, MATCH_OUTCOME_90MIN, GOAL_DIFFERENCE are enabled", () => {
      for (const phase of CUMULATIVE_PRESET.config) {
        const enabledKeys = phase.matchPicks!.types.filter((t) => t.enabled).map((t) => t.key);
        expect(enabledKeys).toContain("HOME_GOALS");
        expect(enabledKeys).toContain("AWAY_GOALS");
        expect(enabledKeys).toContain("MATCH_OUTCOME_90MIN");
        expect(enabledKeys).toContain("GOAL_DIFFERENCE");
      }
    });

    it("group phase sums to 10 (5+2+2+1)", () => {
      const groupPhase = CUMULATIVE_PRESET.config.find((p) => p.phaseId === "group_stage");
      if (groupPhase) {
        const sum = groupPhase.matchPicks!.types.filter((t) => t.enabled).reduce((s, t) => s + t.points, 0);
        expect(sum).toBe(10);
      }
    });

    it("knockout phases sum to 20 (10+4+4+2)", () => {
      const knockoutPhases = CUMULATIVE_PRESET.config.filter((p) => p.phaseId !== "group_stage");
      for (const phase of knockoutPhases) {
        const sum = phase.matchPicks!.types.filter((t) => t.enabled).reduce((s, t) => s + t.points, 0);
        expect(sum).toBe(20);
      }
    });
  });

  describe("SIMPLE preset", () => {
    it("has correct key and metadata", () => {
      expect(SIMPLE_PRESET.key).toBe("SIMPLE");
    });

    it("all phases have requiresScore=false", () => {
      for (const phase of SIMPLE_PRESET.config) {
        expect(phase.requiresScore).toBe(false);
      }
    });

    it("group phase uses GROUP_STANDINGS type", () => {
      const groupPhase = SIMPLE_PRESET.config.find((p) => p.phaseId === "group_stage");
      expect(groupPhase).toBeTruthy();
      expect(groupPhase!.structuralPicks!.type).toBe("GROUP_STANDINGS");
    });

    it("knockout phases use KNOCKOUT_WINNER type", () => {
      const knockoutPhases = SIMPLE_PRESET.config.filter((p) => p.phaseId !== "group_stage");
      for (const phase of knockoutPhases) {
        expect(phase.structuralPicks!.type).toBe("KNOCKOUT_WINNER");
      }
    });
  });
});

// ==================== getAllPresets / getPresetByKey ====================

describe("getAllPresets", () => {
  it("returns all 3 presets", () => {
    const presets = getAllPresets();
    expect(presets).toHaveLength(3);
    expect(presets.map((p) => p.key).sort()).toEqual(["BASIC", "CUMULATIVE", "SIMPLE"]);
  });
});

describe("getPresetByKey", () => {
  it("finds CUMULATIVE", () => {
    expect(getPresetByKey("CUMULATIVE")).toBeTruthy();
    expect(getPresetByKey("CUMULATIVE")!.key).toBe("CUMULATIVE");
  });

  it("finds BASIC", () => {
    expect(getPresetByKey("BASIC")!.key).toBe("BASIC");
  });

  it("finds SIMPLE", () => {
    expect(getPresetByKey("SIMPLE")!.key).toBe("SIMPLE");
  });

  it("returns null for unknown key", () => {
    expect(getPresetByKey("NONEXISTENT")).toBeNull();
  });
});

// ==================== DYNAMIC GENERATION (the critical fix) ====================

describe("generateDynamicPresetConfig", () => {
  describe("CUMULATIVE preset with UCL phases", () => {
    it("generates config for all 9 UCL phases", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES);
      expect(config).not.toBeNull();
      expect(config).toHaveLength(9);
    });

    it("uses real UCL phase IDs (not hardcoded WC IDs)", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
      const phaseIds = config.map((p) => p.phaseId);
      expect(phaseIds).toContain("r32_leg1");
      expect(phaseIds).toContain("r32_leg2");
      expect(phaseIds).toContain("r16_leg1");
      expect(phaseIds).toContain("final");
      // Should NOT contain hardcoded WC IDs
      expect(phaseIds).not.toContain("group_stage");
      expect(phaseIds).not.toContain("round_of_32");
      expect(phaseIds).not.toContain("round_of_16");
    });

    it("all UCL phases are knockout (type ≠ GROUP) → use knockout points", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
      for (const phase of config) {
        const enabled = phase.matchPicks!.types.filter((t) => t.enabled);
        const sum = enabled.reduce((s, t) => s + t.points, 0);
        expect(sum).toBe(20); // knockout: 10+4+4+2
      }
    });

    it("preserves correct phase names from instance data", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
      expect(config[0].phaseName).toBe("Dieciseisavos de Final - Ida");
      expect(config[8].phaseName).toBe("Final");
    });

    it("all phases have requiresScore=true", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
      for (const phase of config) {
        expect(phase.requiresScore).toBe(true);
      }
    });

    it("EXACT_SCORE is disabled in all phases", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
      for (const phase of config) {
        const exact = phase.matchPicks!.types.find((t) => t.key === "EXACT_SCORE");
        expect(exact!.enabled).toBe(false);
      }
    });
  });

  describe("CUMULATIVE preset with WC phases (mixed GROUP + KNOCKOUT)", () => {
    it("generates config for all 6 WC phases", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", WC_PHASES);
      expect(config).not.toBeNull();
      expect(config).toHaveLength(6);
    });

    it("GROUP phase gets group-level points (10 max)", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", WC_PHASES)!;
      const groupPhase = config.find((p) => p.phaseId === "group_stage")!;
      const enabled = groupPhase.matchPicks!.types.filter((t) => t.enabled);
      const sum = enabled.reduce((s, t) => s + t.points, 0);
      expect(sum).toBe(10); // 5+2+2+1
    });

    it("KNOCKOUT phases get knockout-level points (20 max)", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", WC_PHASES)!;
      const knockoutPhases = config.filter((p) => p.phaseId !== "group_stage");
      for (const phase of knockoutPhases) {
        const enabled = phase.matchPicks!.types.filter((t) => t.enabled);
        const sum = enabled.reduce((s, t) => s + t.points, 0);
        expect(sum).toBe(20);
      }
    });
  });

  describe("BASIC preset dynamic generation", () => {
    it("generates config with increasing points per phase", () => {
      const config = generateDynamicPresetConfig("BASIC", UCL_PHASES)!;
      expect(config).toHaveLength(9);

      const points = config.map((p) => p.matchPicks!.types.find((t) => t.key === "EXACT_SCORE")!.points);
      // Points should increase: 20, 30, 40, 50, 60, 70, 80, 90, 100
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeGreaterThan(points[i - 1]);
      }
    });

    it("only EXACT_SCORE is enabled", () => {
      const config = generateDynamicPresetConfig("BASIC", UCL_PHASES)!;
      for (const phase of config) {
        const enabled = phase.matchPicks!.types.filter((t) => t.enabled);
        expect(enabled).toHaveLength(1);
        expect(enabled[0].key).toBe("EXACT_SCORE");
      }
    });
  });

  describe("SIMPLE preset dynamic generation", () => {
    it("generates config for WC phases with correct structural types", () => {
      const config = generateDynamicPresetConfig("SIMPLE", WC_PHASES)!;
      expect(config).toHaveLength(6);

      // Group phase → GROUP_STANDINGS
      const groupPhase = config.find((p) => p.phaseId === "group_stage")!;
      expect(groupPhase.requiresScore).toBe(false);
      expect(groupPhase.structuralPicks!.type).toBe("GROUP_STANDINGS");

      // Knockout phases → KNOCKOUT_WINNER
      const knockoutPhases = config.filter((p) => p.phaseId !== "group_stage");
      for (const phase of knockoutPhases) {
        expect(phase.requiresScore).toBe(false);
        expect(phase.structuralPicks!.type).toBe("KNOCKOUT_WINNER");
      }
    });

    it("UCL phases (all knockout) → all KNOCKOUT_WINNER", () => {
      const config = generateDynamicPresetConfig("SIMPLE", UCL_PHASES)!;
      for (const phase of config) {
        expect(phase.structuralPicks!.type).toBe("KNOCKOUT_WINNER");
      }
    });
  });

  describe("Error handling", () => {
    it("returns null for unknown preset key", () => {
      expect(generateDynamicPresetConfig("UNKNOWN", UCL_PHASES)).toBeNull();
    });

    it("returns empty array for empty phases", () => {
      const config = generateDynamicPresetConfig("CUMULATIVE", []);
      expect(config).toEqual([]);
    });
  });
});

// ==================== PHASE ID MATCHING (the bug that was fixed) ====================

describe("Phase ID matching - critical regression test", () => {
  it("dynamic CUMULATIVE config phase IDs match the instance data exactly", () => {
    const config = generateDynamicPresetConfig("CUMULATIVE", UCL_PHASES)!;
    const configPhaseIds = new Set(config.map((p) => p.phaseId));
    const instancePhaseIds = new Set(UCL_PHASES.map((p) => p.id));

    // Every config phase ID must exist in instance data
    for (const id of configPhaseIds) {
      expect(instancePhaseIds.has(id)).toBe(true);
    }

    // Every instance phase ID must exist in config
    for (const id of instancePhaseIds) {
      expect(configPhaseIds.has(id)).toBe(true);
    }
  });

  it("hardcoded CUMULATIVE preset phase IDs do NOT match UCL (showing why dynamic is needed)", () => {
    const hardcodedPhaseIds = new Set(CUMULATIVE_PRESET.config.map((p) => p.phaseId));
    const uclPhaseIds = new Set(UCL_PHASES.map((p) => p.id));

    // There should be zero overlap (hardcoded uses WC IDs, UCL uses different IDs)
    const overlap = [...hardcodedPhaseIds].filter((id) => uclPhaseIds.has(id));
    // Only "final" might overlap
    expect(overlap.length).toBeLessThanOrEqual(1);
  });
});
