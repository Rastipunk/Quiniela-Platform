import { describe, it, expect } from "vitest";
import {
  outcomeFromScore,
  makeInviteCode,
  buildPhaseTakesMatchPicks,
  buildGroupLockTimes,
  partitionGroupPicksByLock,
  mergeGroupPicks,
} from "./poolHelpers";

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

  // ── buildGroupLockTimes ───────────────────────────────────

  describe("buildGroupLockTimes", () => {
    const DEADLINE_MINUTES = 10;
    const T0 = Date.parse("2026-06-11T18:00:00.000Z");
    const iso = (offsetMin: number) => new Date(T0 + offsetMin * 60_000).toISOString();

    it("locks a group at its EARLIEST kickoff minus the deadline buffer", () => {
      const locks = buildGroupLockTimes(
        [
          { groupId: "A", kickoffUtc: iso(120) },
          { groupId: "A", kickoffUtc: iso(0) },
          { groupId: "A", kickoffUtc: iso(240) },
        ],
        DEADLINE_MINUTES,
      );
      expect(locks.get("A")).toEqual({
        lockTimeMs: T0 - DEADLINE_MINUTES * 60_000,
        firstKickoffUtc: iso(0),
      });
    });

    it("computes independent locks per group", () => {
      const locks = buildGroupLockTimes(
        [
          { groupId: "A", kickoffUtc: iso(0) },
          { groupId: "B", kickoffUtc: iso(60) },
        ],
        DEADLINE_MINUTES,
      );
      expect(locks.get("A")!.lockTimeMs).toBeLessThan(locks.get("B")!.lockTimeMs);
      expect(locks.size).toBe(2);
    });

    it("ignores matches without groupId (knockout matches)", () => {
      const locks = buildGroupLockTimes(
        [{ groupId: undefined, kickoffUtc: iso(0) }],
        DEADLINE_MINUTES,
      );
      expect(locks.size).toBe(0);
    });

    it("never locks a group whose kickoffs are unparseable (fail-open)", () => {
      const locks = buildGroupLockTimes(
        [{ groupId: "A", kickoffUtc: undefined as unknown as string }],
        DEADLINE_MINUTES,
      );
      expect(locks.get("A")).toEqual({
        lockTimeMs: Number.POSITIVE_INFINITY,
        firstKickoffUtc: null,
      });
      expect(Date.now() >= locks.get("A")!.lockTimeMs).toBe(false);
    });

    it("uses only parseable kickoffs when the group mixes valid and invalid dates", () => {
      const locks = buildGroupLockTimes(
        [
          { groupId: "A", kickoffUtc: "not-a-date" },
          { groupId: "A", kickoffUtc: iso(0) },
        ],
        DEADLINE_MINUTES,
      );
      expect(locks.get("A")!.lockTimeMs).toBe(T0 - DEADLINE_MINUTES * 60_000);
    });
  });

  // ── partitionGroupPicksByLock ─────────────────────────────

  describe("partitionGroupPicksByLock", () => {
    const NOW = Date.parse("2026-06-11T18:00:00.000Z");
    const open = { lockTimeMs: NOW + 60_000, firstKickoffUtc: "x" };
    const locked = { lockTimeMs: NOW - 60_000, firstKickoffUtc: "y" };

    it("keeps picks for open groups and drops locked ones", () => {
      const lockTimes = new Map([
        ["A", open],
        ["B", locked],
      ]);
      const { valid, lockedGroupIds } = partitionGroupPicksByLock(
        [
          { groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] },
          { groupId: "B", teamIds: ["t5", "t6", "t7", "t8"] },
        ],
        lockTimes,
        NOW,
      );
      expect(valid).toEqual([{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }]);
      expect(lockedGroupIds).toEqual(["B"]);
    });

    it("locks exactly AT the lock instant (now >= lockTime)", () => {
      const lockTimes = new Map([["A", { lockTimeMs: NOW, firstKickoffUtc: "x" }]]);
      const { valid, lockedGroupIds } = partitionGroupPicksByLock(
        [{ groupId: "A", teamIds: [] }],
        lockTimes,
        NOW,
      );
      expect(valid).toEqual([]);
      expect(lockedGroupIds).toEqual(["A"]);
    });

    it("drops picks for groups unknown to the fixture", () => {
      const { valid, lockedGroupIds } = partitionGroupPicksByLock(
        [{ groupId: "Z", teamIds: [] }],
        new Map(),
        NOW,
      );
      expect(valid).toEqual([]);
      expect(lockedGroupIds).toEqual(["Z"]);
    });

    it("returns everything valid when all groups are open", () => {
      const lockTimes = new Map([
        ["A", open],
        ["B", open],
      ]);
      const { valid, lockedGroupIds } = partitionGroupPicksByLock(
        [
          { groupId: "A", teamIds: ["t1"] },
          { groupId: "B", teamIds: ["t2"] },
        ],
        lockTimes,
        NOW,
      );
      expect(valid).toHaveLength(2);
      expect(lockedGroupIds).toEqual([]);
    });
  });

  // ── mergeGroupPicks ───────────────────────────────────────

  describe("mergeGroupPicks", () => {
    it("preserves existing picks for groups absent from the incoming set", () => {
      const merged = mergeGroupPicks(
        [{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
        [{ groupId: "B", teamIds: ["t5", "t6", "t7", "t8"] }],
      );
      expect(merged).toContainEqual({ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] });
      expect(merged).toContainEqual({ groupId: "B", teamIds: ["t5", "t6", "t7", "t8"] });
      expect(merged).toHaveLength(2);
    });

    it("overwrites an existing group with the incoming pick", () => {
      const merged = mergeGroupPicks(
        [{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
        [{ groupId: "A", teamIds: ["t4", "t3", "t2", "t1"] }],
      );
      expect(merged).toEqual([{ groupId: "A", teamIds: ["t4", "t3", "t2", "t1"] }]);
    });

    it("handles undefined existing picks (first save)", () => {
      const merged = mergeGroupPicks(undefined, [{ groupId: "A", teamIds: ["t1"] }]);
      expect(merged).toEqual([{ groupId: "A", teamIds: ["t1"] }]);
    });

    it("cannot erase a locked group's pick via empty incoming set", () => {
      const merged = mergeGroupPicks(
        [{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
        [],
      );
      expect(merged).toEqual([{ groupId: "A", teamIds: ["t1", "t2", "t3", "t4"] }]);
    });
  });
});
