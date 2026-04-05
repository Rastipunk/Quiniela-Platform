import { describe, it, expect } from "vitest";
import {
  MatchPickTypeKeySchema,
  MatchPickTypeSchema,
  AutoScalingConfigSchema,
  MatchPicksConfigSchema,
  StructuralPickTypeSchema,
  GroupStandingsConfigSchema,
  GlobalQualifiersConfigSchema,
  KnockoutWinnerConfigSchema,
  PhasePickConfigSchema,
  PoolPickTypesConfigSchema,
  PickConfigPresetKeySchema,
  validatePhasePickConfig,
  validatePoolPickTypesConfig,
} from "./pickConfig";

// ─── MatchPickTypeKeySchema ──────────────────────────────────

describe("MatchPickTypeKeySchema", () => {
  it("accepts all valid pick type keys", () => {
    const keys = [
      "EXACT_SCORE", "GOAL_DIFFERENCE", "PARTIAL_SCORE",
      "TOTAL_GOALS", "MATCH_OUTCOME_90MIN", "HOME_GOALS", "AWAY_GOALS",
    ];
    for (const key of keys) {
      expect(MatchPickTypeKeySchema.parse(key)).toBe(key);
    }
  });

  it("rejects invalid pick type key", () => {
    expect(() => MatchPickTypeKeySchema.parse("INVALID_KEY")).toThrow();
  });
});

// ─── MatchPickTypeSchema ─────────────────────────────────────

describe("MatchPickTypeSchema", () => {
  it("accepts valid match pick type", () => {
    const input = { key: "EXACT_SCORE", enabled: true, points: 10 };
    expect(MatchPickTypeSchema.parse(input)).toMatchObject(input);
  });

  it("rejects negative points", () => {
    expect(() =>
      MatchPickTypeSchema.parse({ key: "EXACT_SCORE", enabled: true, points: -1 }),
    ).toThrow();
  });

  it("rejects points over 1000", () => {
    expect(() =>
      MatchPickTypeSchema.parse({ key: "EXACT_SCORE", enabled: true, points: 1001 }),
    ).toThrow();
  });

  it("rejects non-integer points", () => {
    expect(() =>
      MatchPickTypeSchema.parse({ key: "EXACT_SCORE", enabled: true, points: 5.5 }),
    ).toThrow();
  });

  it("accepts points at boundary 0", () => {
    const result = MatchPickTypeSchema.parse({ key: "EXACT_SCORE", enabled: false, points: 0 });
    expect(result.points).toBe(0);
  });

  it("accepts points at boundary 1000", () => {
    const result = MatchPickTypeSchema.parse({ key: "EXACT_SCORE", enabled: true, points: 1000 });
    expect(result.points).toBe(1000);
  });

  it("allows optional config", () => {
    const result = MatchPickTypeSchema.parse({
      key: "EXACT_SCORE", enabled: true, points: 10, config: { bonus: true },
    });
    expect(result.config).toEqual({ bonus: true });
  });

  it("rejects missing key", () => {
    expect(() =>
      MatchPickTypeSchema.parse({ enabled: true, points: 10 }),
    ).toThrow();
  });
});

// ─── AutoScalingConfigSchema ─────────────────────────────────

describe("AutoScalingConfigSchema", () => {
  it("accepts valid auto-scaling config", () => {
    const input = {
      enabled: true,
      basePhase: "group_stage",
      multipliers: { round_of_16: 1.5, quarterfinals: 2 },
    };
    expect(AutoScalingConfigSchema.parse(input)).toMatchObject(input);
  });

  it("rejects empty basePhase", () => {
    expect(() =>
      AutoScalingConfigSchema.parse({ enabled: true, basePhase: "", multipliers: {} }),
    ).toThrow();
  });

  it("rejects multiplier below 1", () => {
    expect(() =>
      AutoScalingConfigSchema.parse({
        enabled: true, basePhase: "gs", multipliers: { r16: 0.5 },
      }),
    ).toThrow();
  });

  it("rejects multiplier above 10", () => {
    expect(() =>
      AutoScalingConfigSchema.parse({
        enabled: true, basePhase: "gs", multipliers: { r16: 11 },
      }),
    ).toThrow();
  });
});

// ─── MatchPicksConfigSchema ──────────────────────────────────

describe("MatchPicksConfigSchema", () => {
  it("accepts valid config with one type", () => {
    const input = {
      types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }],
    };
    expect(MatchPicksConfigSchema.parse(input)).toMatchObject(input);
  });

  it("rejects empty types array", () => {
    expect(() => MatchPicksConfigSchema.parse({ types: [] })).toThrow();
  });
});

// ─── StructuralPickTypeSchema ────────────────────────────────

describe("StructuralPickTypeSchema", () => {
  it("accepts GROUP_STANDINGS", () => {
    expect(StructuralPickTypeSchema.parse("GROUP_STANDINGS")).toBe("GROUP_STANDINGS");
  });

  it("accepts GLOBAL_QUALIFIERS", () => {
    expect(StructuralPickTypeSchema.parse("GLOBAL_QUALIFIERS")).toBe("GLOBAL_QUALIFIERS");
  });

  it("accepts KNOCKOUT_WINNER", () => {
    expect(StructuralPickTypeSchema.parse("KNOCKOUT_WINNER")).toBe("KNOCKOUT_WINNER");
  });

  it("rejects unknown structural type", () => {
    expect(() => StructuralPickTypeSchema.parse("UNKNOWN")).toThrow();
  });
});

// ─── GroupStandingsConfigSchema ──────────────────────────────

describe("GroupStandingsConfigSchema", () => {
  it("accepts valid config", () => {
    const input = { pointsPerExactPosition: 5, bonusPerfectGroup: 10 };
    expect(GroupStandingsConfigSchema.parse(input)).toMatchObject(input);
  });

  it("rejects negative pointsPerExactPosition", () => {
    expect(() =>
      GroupStandingsConfigSchema.parse({ pointsPerExactPosition: -1 }),
    ).toThrow();
  });
});

// ─── GlobalQualifiersConfigSchema ────────────────────────────

describe("GlobalQualifiersConfigSchema", () => {
  it("accepts valid config", () => {
    const input = {
      totalQualifiers: 32,
      pointsPerExactPosition: 2,
      lockDateTime: "2026-06-01T00:00:00Z",
    };
    expect(GlobalQualifiersConfigSchema.parse(input)).toMatchObject(input);
  });

  it("rejects totalQualifiers below 1", () => {
    expect(() =>
      GlobalQualifiersConfigSchema.parse({
        totalQualifiers: 0, pointsPerExactPosition: 2, lockDateTime: "2026-06-01T00:00:00Z",
      }),
    ).toThrow();
  });

  it("rejects invalid datetime format", () => {
    expect(() =>
      GlobalQualifiersConfigSchema.parse({
        totalQualifiers: 32, pointsPerExactPosition: 2, lockDateTime: "not-a-date",
      }),
    ).toThrow();
  });
});

// ─── KnockoutWinnerConfigSchema ──────────────────────────────

describe("KnockoutWinnerConfigSchema", () => {
  it("accepts valid config", () => {
    expect(
      KnockoutWinnerConfigSchema.parse({ pointsPerCorrectAdvance: 15 }),
    ).toMatchObject({ pointsPerCorrectAdvance: 15 });
  });

  it("rejects negative points", () => {
    expect(() =>
      KnockoutWinnerConfigSchema.parse({ pointsPerCorrectAdvance: -5 }),
    ).toThrow();
  });
});

// ─── PhasePickConfigSchema ───────────────────────────────────

describe("PhasePickConfigSchema", () => {
  it("accepts score-based phase config", () => {
    const input = {
      phaseId: "group_stage",
      phaseName: "Fase de Grupos",
      requiresScore: true,
      matchPicks: {
        types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }],
      },
    };
    expect(PhasePickConfigSchema.parse(input)).toMatchObject(input);
  });

  it("accepts structural phase config", () => {
    const input = {
      phaseId: "groups",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: {
        type: "GROUP_STANDINGS",
        config: { pointsPerExactPosition: 5 },
      },
    };
    expect(PhasePickConfigSchema.parse(input)).toMatchObject(input);
  });

  it("rejects empty phaseId", () => {
    expect(() =>
      PhasePickConfigSchema.parse({
        phaseId: "", phaseName: "Grupos", requiresScore: false,
      }),
    ).toThrow();
  });

  it("rejects empty phaseName", () => {
    expect(() =>
      PhasePickConfigSchema.parse({
        phaseId: "gs", phaseName: "", requiresScore: false,
      }),
    ).toThrow();
  });
});

// ─── PickConfigPresetKeySchema ───────────────────────────────

describe("PickConfigPresetKeySchema", () => {
  it("accepts all preset keys", () => {
    for (const key of ["BASIC", "SIMPLE", "CUMULATIVE", "CUSTOM"]) {
      expect(PickConfigPresetKeySchema.parse(key)).toBe(key);
    }
  });

  it("rejects invalid preset key", () => {
    expect(() => PickConfigPresetKeySchema.parse("ADVANCED")).toThrow();
  });
});

// ─── validatePhasePickConfig ─────────────────────────────────

describe("validatePhasePickConfig", () => {
  it("validates a correct score-based config", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates a correct structural config", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: {
        type: "GROUP_STANDINGS",
        config: { pointsPerExactPosition: 5 },
      },
    });
    expect(result.valid).toBe(true);
  });

  it("errors when requiresScore=true but no matchPicks", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "matchPicks")).toBe(true);
  });

  it("errors when requiresScore=true and structuralPicks present", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
      structuralPicks: { type: "GROUP_STANDINGS", config: { pointsPerExactPosition: 5 } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "structuralPicks")).toBe(true);
  });

  it("errors when requiresScore=false but no structuralPicks", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "structuralPicks")).toBe(true);
  });

  it("errors when requiresScore=false and matchPicks present", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: false,
      structuralPicks: { type: "GROUP_STANDINGS", config: { pointsPerExactPosition: 5 } },
      matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "matchPicks")).toBe(true);
  });

  it("errors when no pick types are enabled", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [{ key: "EXACT_SCORE", enabled: false, points: 10 }],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "matchPicks.types")).toBe(true);
  });

  it("returns ZodError fields for completely invalid input", () => {
    const result = validatePhasePickConfig({ invalid: true });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns generic error for unexpected exceptions", () => {
    // null is not an object, ZodError won't even parse it as schema
    const result = validatePhasePickConfig(null);
    expect(result.valid).toBe(false);
  });

  it("warns when EXACT_SCORE points <= GOAL_DIFFERENCE points", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE", enabled: true, points: 5 },
          { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        ],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].field).toBe("matchPicks.types");
  });

  it("warns when GOAL_DIFFERENCE points <= PARTIAL_SCORE points", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE", enabled: true, points: 20 },
          { key: "GOAL_DIFFERENCE", enabled: true, points: 3 },
          { key: "PARTIAL_SCORE", enabled: true, points: 5 },
        ],
      },
    });
    expect(result.warnings.some((w) => w.message.includes("Diferencia de goles"))).toBe(true);
  });

  it("warns when EXACT_SCORE is undervalued relative to sum of others", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE", enabled: true, points: 3 },
          { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
          { key: "PARTIAL_SCORE", enabled: true, points: 10 },
        ],
      },
    });
    expect(result.warnings.some((w) => w.message.includes("subvalorado"))).toBe(true);
  });

  it("no warnings for well-balanced points", () => {
    const result = validatePhasePickConfig({
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: {
        types: [
          { key: "EXACT_SCORE", enabled: true, points: 20 },
          { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
          { key: "PARTIAL_SCORE", enabled: true, points: 5 },
          { key: "TOTAL_GOALS", enabled: true, points: 3 },
        ],
      },
    });
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── validatePoolPickTypesConfig ─────────────────────────────

describe("validatePoolPickTypesConfig", () => {
  it("validates a valid pool config", () => {
    const result = validatePoolPickTypesConfig([
      {
        phaseId: "gs",
        phaseName: "Grupos",
        requiresScore: true,
        matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
      },
    ]);
    expect(result.valid).toBe(true);
  });

  it("errors on empty phases array", () => {
    const result = validatePoolPickTypesConfig([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "phases")).toBe(true);
  });

  it("errors on duplicate phase IDs", () => {
    const phase = {
      phaseId: "gs",
      phaseName: "Grupos",
      requiresScore: true,
      matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
    };
    const result = validatePoolPickTypesConfig([phase, phase]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("duplicados"))).toBe(true);
  });

  it("prefixes errors with phase index", () => {
    const result = validatePoolPickTypesConfig([
      {
        phaseId: "gs",
        phaseName: "Grupos",
        requiresScore: true,
        // missing matchPicks
      },
    ]);
    expect(result.errors.some((e) => e.field.startsWith("phases[0]"))).toBe(true);
  });

  it("returns ZodError for completely invalid input", () => {
    const result = validatePoolPickTypesConfig("not-an-array");
    expect(result.valid).toBe(false);
  });

  it("validates multiple phases independently", () => {
    const result = validatePoolPickTypesConfig([
      {
        phaseId: "gs",
        phaseName: "Grupos",
        requiresScore: false,
        structuralPicks: { type: "GROUP_STANDINGS", config: { pointsPerExactPosition: 5 } },
      },
      {
        phaseId: "r16",
        phaseName: "Octavos",
        requiresScore: true,
        matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
