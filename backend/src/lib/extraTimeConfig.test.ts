import { describe, it, expect } from "vitest";
import {
  getKnockoutScorePhases,
  isKnockoutScorePool,
  computeExtraTimeWindow,
} from "./extraTimeConfig";
import type { FixturePhase, FixtureMatch } from "./fixture";
import type { PhasePickConfig } from "../types/pickConfig";

const phase = (id: string, type: string, order: number): FixturePhase =>
  ({ id, name: id, type, order } as FixturePhase);

const match = (id: string, phaseId: string, kickoffUtc: string): FixtureMatch =>
  ({ id, phaseId, kickoffUtc } as unknown as FixtureMatch);

const scorePhase = (phaseId: string, includeExtraTime?: boolean): PhasePickConfig => ({
  phaseId,
  phaseName: phaseId,
  requiresScore: true,
  includeExtraTime,
  matchPicks: { types: [{ key: "EXACT_SCORE", enabled: true, points: 10 }] },
});

const structuralPhase = (phaseId: string): PhasePickConfig => ({
  phaseId,
  phaseName: phaseId,
  requiresScore: false,
  structuralPicks: { type: "KNOCKOUT_WINNER", config: { pointsPerCorrectAdvance: 5 } },
});

const PHASES = [
  phase("group_stage", "GROUP", 1),
  phase("round_of_16", "KNOCKOUT", 2),
  phase("finals", "KNOCKOUT", 3),
];

describe("getKnockoutScorePhases", () => {
  it("returns knockout phases that grade scorelines, in fixture order, with ET resolved", () => {
    const cfg = [scorePhase("group_stage"), scorePhase("finals", true), scorePhase("round_of_16")];
    const out = getKnockoutScorePhases(PHASES, cfg);
    expect(out.map((p) => p.phaseId)).toEqual(["round_of_16", "finals"]); // group excluded, ordered
    expect(out.find((p) => p.phaseId === "finals")!.includeExtraTime).toBe(true);
    expect(out.find((p) => p.phaseId === "round_of_16")!.includeExtraTime).toBe(false);
  });

  it("excludes structural (estratega) knockout phases", () => {
    const cfg = [scorePhase("group_stage"), structuralPhase("round_of_16"), structuralPhase("finals")];
    expect(getKnockoutScorePhases(PHASES, cfg)).toHaveLength(0);
    expect(isKnockoutScorePool(PHASES, cfg)).toBe(false);
  });

  it("excludes a knockout phase that only grades the 90' winner (no scoreline)", () => {
    const cfg: PhasePickConfig[] = [{
      phaseId: "finals", phaseName: "finals", requiresScore: true,
      matchPicks: { types: [{ key: "MATCH_OUTCOME_90MIN", enabled: true, points: 3 }] },
    }];
    expect(getKnockoutScorePhases(PHASES, cfg)).toHaveLength(0);
  });

  it("returns empty for null/empty config (fail-closed)", () => {
    expect(getKnockoutScorePhases(PHASES, null)).toHaveLength(0);
    expect(getKnockoutScorePhases(PHASES, [])).toHaveLength(0);
  });
});

describe("computeExtraTimeWindow", () => {
  const matches = [
    match("g1", "group_stage", "2026-06-20T18:00:00Z"),
    match("g2", "group_stage", "2026-06-21T18:00:00Z"), // last group
    match("k1", "round_of_16", "2026-06-24T18:00:00Z"), // first knockout
  ];
  const now = new Date("2026-06-22T00:00:00Z").getTime(); // after group stage, before knockout

  it("is OPEN while a group match is not finalized and knockouts haven't started", () => {
    const w = computeExtraTimeWindow({ phases: PHASES, matches, finalizedMatchIds: new Set(["g1"]), now });
    expect(w).toEqual({ open: true, reason: "OPEN" });
  });

  it("CLOSES once every group match is finalized", () => {
    const w = computeExtraTimeWindow({ phases: PHASES, matches, finalizedMatchIds: new Set(["g1", "g2"]), now });
    expect(w).toEqual({ open: false, reason: "GROUP_STAGE_FINALIZED" });
  });

  it("CLOSES (backstop) once a knockout match has kicked off, even if a group result is stuck", () => {
    const afterKo = new Date("2026-06-24T19:00:00Z").getTime();
    const w = computeExtraTimeWindow({ phases: PHASES, matches, finalizedMatchIds: new Set(["g1"]), now: afterKo });
    expect(w).toEqual({ open: false, reason: "KNOCKOUT_STARTED" });
  });

  it("returns NO_GROUP_MATCHES when the pool has no group-stage matches", () => {
    const w = computeExtraTimeWindow({ phases: PHASES, matches: [match("k1", "round_of_16", "2026-06-24T18:00:00Z")], finalizedMatchIds: new Set(), now });
    expect(w).toEqual({ open: false, reason: "NO_GROUP_MATCHES" });
  });
});
