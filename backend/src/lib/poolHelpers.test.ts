import { describe, it, expect } from "vitest";
import { outcomeFromScore, makeInviteCode, buildPhaseTakesMatchPicks } from "./poolHelpers";

describe("poolHelpers", () => {
  // ── outcomeFromScore ──────────────────────────────────────

  describe("outcomeFromScore", () => {
    it("returns HOME when home scores more", () => {
      expect(outcomeFromScore(3, 1)).toBe("HOME");
    });

    it("returns AWAY when away scores more", () => {
      expect(outcomeFromScore(0, 2)).toBe("AWAY");
    });

    it("returns DRAW when scores are equal", () => {
      expect(outcomeFromScore(1, 1)).toBe("DRAW");
    });

    it("returns DRAW for 0-0", () => {
      expect(outcomeFromScore(0, 0)).toBe("DRAW");
    });

    it("returns HOME for 1-0", () => {
      expect(outcomeFromScore(1, 0)).toBe("HOME");
    });

    it("returns AWAY for 0-1", () => {
      expect(outcomeFromScore(0, 1)).toBe("AWAY");
    });

    it("handles high scores correctly", () => {
      expect(outcomeFromScore(7, 1)).toBe("HOME");
      expect(outcomeFromScore(2, 9)).toBe("AWAY");
      expect(outcomeFromScore(5, 5)).toBe("DRAW");
    });
  });

  // ── makeInviteCode ────────────────────────────────────────

  describe("makeInviteCode", () => {
    it("returns a hex string", () => {
      const code = makeInviteCode();
      expect(code).toMatch(/^[0-9a-f]+$/);
    });

    it("returns a string of 12 characters (6 bytes = 12 hex chars)", () => {
      const code = makeInviteCode();
      expect(code).toHaveLength(12);
    });

    it("generates different codes on successive calls", () => {
      const codes = new Set(Array.from({ length: 20 }, () => makeInviteCode()));
      expect(codes.size).toBe(20);
    });

    it("returns a string type", () => {
      expect(typeof makeInviteCode()).toBe("string");
    });
  });

  // ── buildPhaseTakesMatchPicks ─────────────────────────────

  describe("buildPhaseTakesMatchPicks", () => {
    // Mirrors the shapes produced by lib/pickPresets.ts
    const scorePhase = (phaseId: string) => ({
      phaseId,
      phaseName: phaseId,
      requiresScore: true,
      matchPicks: {
        types: [{ key: "EXACT_SCORE" as const, enabled: true, points: 20 }],
      },
    });
    const structuralPhase = (phaseId: string) => ({
      phaseId,
      phaseName: phaseId,
      requiresScore: false,
      structuralPicks: {
        type: "GROUP_STANDINGS" as const,
        config: { pointsPerExactPosition: 10 },
      },
    });

    it("counts every phase when pool has no pickTypesConfig (legacy)", () => {
      expect(buildPhaseTakesMatchPicks(null)("group_stage")).toBe(true);
      expect(buildPhaseTakesMatchPicks(undefined)("group_stage")).toBe(true);
      expect(buildPhaseTakesMatchPicks([])("group_stage")).toBe(true);
    });

    it("counts every phase when config JSON is malformed (not an array)", () => {
      expect(buildPhaseTakesMatchPicks({ foo: "bar" })("group_stage")).toBe(true);
      expect(buildPhaseTakesMatchPicks("SIMPLE")("group_stage")).toBe(true);
    });

    it("excludes structural phases (SIMPLE / Estratega pools)", () => {
      const predicate = buildPhaseTakesMatchPicks([
        structuralPhase("group_stage"),
        structuralPhase("round_of_32"),
      ]);
      expect(predicate("group_stage")).toBe(false);
      expect(predicate("round_of_32")).toBe(false);
    });

    it("includes match-based phases (BASIC / CUMULATIVE pools)", () => {
      const predicate = buildPhaseTakesMatchPicks([
        scorePhase("group_stage"),
        scorePhase("finals"),
      ]);
      expect(predicate("group_stage")).toBe(true);
      expect(predicate("finals")).toBe(true);
    });

    it("distinguishes phases within a mixed config", () => {
      const predicate = buildPhaseTakesMatchPicks([
        scorePhase("group_stage"),
        structuralPhase("round_of_16"),
      ]);
      expect(predicate("group_stage")).toBe(true);
      expect(predicate("round_of_16")).toBe(false);
    });

    it("excludes phases absent from a non-empty config (no picks possible)", () => {
      const predicate = buildPhaseTakesMatchPicks([scorePhase("group_stage")]);
      expect(predicate("finals")).toBe(false);
    });

    it("counts matches without phaseId when config exists (cannot classify — preserve legacy)", () => {
      const predicate = buildPhaseTakesMatchPicks([structuralPhase("group_stage")]);
      expect(predicate(undefined)).toBe(true);
    });

    it("excludes a phase whose matchPicks exist but requiresScore is false", () => {
      const predicate = buildPhaseTakesMatchPicks([
        {
          phaseId: "group_stage",
          phaseName: "Fase de Grupos",
          requiresScore: false,
          matchPicks: {
            types: [{ key: "EXACT_SCORE" as const, enabled: true, points: 20 }],
          },
        },
      ]);
      expect(predicate("group_stage")).toBe(false);
    });
  });
});
