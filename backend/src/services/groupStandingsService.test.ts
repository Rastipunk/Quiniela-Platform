import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../db", () => ({
  prisma: {
    poolMember: { findFirst: vi.fn() },
    pool: { findUnique: vi.fn() },
    groupStandingsPrediction: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    groupStandingsResult: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    poolMatchResult: { findMany: vi.fn() },
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock("./poolStateMachine", () => ({
  canMakePicks: vi.fn(),
}));

vi.mock("./instanceAdvancement", () => ({
  advanceToRoundOf32: vi.fn(),
  validateCanAutoAdvance: vi.fn(),
}));

vi.mock("../lib/roles", () => ({
  requirePoolAdmin: vi.fn(),
}));

vi.mock("../lib/fixture", () => ({
  parseFixtureData: vi.fn(),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn((_label: string, _promise: Promise<any>) => {}),
}));

import { prisma } from "../db";
import { canMakePicks } from "./poolStateMachine";
import { requirePoolAdmin } from "../lib/roles";
import { parseFixtureData } from "../lib/fixture";
import { validateCanAutoAdvance } from "./instanceAdvancement";
import {
  upsertGroupStandingsPick,
  getGroupStandingsPick,
  getGroupStandingsPicksByPhase,
  publishGroupStandingsResult,
  getGroupStandingsResult,
  getGroupStandingsResultsByPhase,
  getGroupMatchResults,
} from "./groupStandingsService";

const ctx = { ip: "127.0.0.1", userAgent: "test" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── upsertGroupStandingsPick ─────────────────────────────────

describe("upsertGroupStandingsPick", () => {
  it("creates a prediction when user is active member and pool allows picks", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({
      id: "pool1",
      status: "ACTIVE",
      tournamentInstance: { status: "ACTIVE" },
    } as any);
    vi.mocked(canMakePicks).mockReturnValue(true);
    vi.mocked(prisma.groupStandingsPrediction.upsert).mockResolvedValue({
      id: "pred1",
      poolId: "pool1",
      userId: "user1",
      phaseId: "gs",
      groupId: "A",
      teamIds: ["t1", "t2", "t3", "t4"],
    } as any);

    const result = await upsertGroupStandingsPick("user1", "pool1", "gs", "A", ["t1", "t2", "t3", "t4"], ctx);

    expect(result.id).toBe("pred1");
    expect(prisma.groupStandingsPrediction.upsert).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN when user is not a pool member", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue(null);

    await expect(
      upsertGroupStandingsPick("user1", "pool1", "gs", "A", ["t1"], ctx),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("throws NOT_FOUND when pool does not exist", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue(null);

    await expect(
      upsertGroupStandingsPick("user1", "pool1", "gs", "A", ["t1"], ctx),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("throws CONFLICT when pool status disallows picks", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({
      id: "pool1",
      status: "COMPLETED",
      tournamentInstance: { status: "ACTIVE" },
    } as any);
    vi.mocked(canMakePicks).mockReturnValue(false);

    await expect(
      upsertGroupStandingsPick("user1", "pool1", "gs", "A", ["t1"], ctx),
    ).rejects.toThrow("CONFLICT");
  });

  it("throws CONFLICT when tournament instance is ARCHIVED", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({
      id: "pool1",
      status: "ACTIVE",
      tournamentInstance: { status: "ARCHIVED" },
    } as any);
    vi.mocked(canMakePicks).mockReturnValue(true);

    await expect(
      upsertGroupStandingsPick("user1", "pool1", "gs", "A", ["t1"], ctx),
    ).rejects.toThrow("CONFLICT");
  });
});

// ─── getGroupStandingsPick ────────────────────────────────────

describe("getGroupStandingsPick", () => {
  it("returns prediction for member", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.groupStandingsPrediction.findUnique).mockResolvedValue({
      id: "pred1",
      teamIds: ["t1", "t2"],
    } as any);

    const { prediction } = await getGroupStandingsPick("user1", "pool1", "gs", "A");

    expect(prediction?.id).toBe("pred1");
  });

  it("returns null prediction when none exists", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.groupStandingsPrediction.findUnique).mockResolvedValue(null);

    const { prediction } = await getGroupStandingsPick("user1", "pool1", "gs", "A");

    expect(prediction).toBeNull();
  });

  it("throws FORBIDDEN for non-members", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue(null);

    await expect(
      getGroupStandingsPick("user1", "pool1", "gs", "A"),
    ).rejects.toThrow("FORBIDDEN");
  });
});

// ─── getGroupStandingsPicksByPhase ────────────────────────────

describe("getGroupStandingsPicksByPhase", () => {
  it("returns all predictions for a phase", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.groupStandingsPrediction.findMany).mockResolvedValue([
      { id: "p1", groupId: "A" },
      { id: "p2", groupId: "B" },
    ] as any);

    const { predictions } = await getGroupStandingsPicksByPhase("user1", "pool1", "gs");

    expect(predictions).toHaveLength(2);
  });

  it("throws FORBIDDEN for non-members", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue(null);

    await expect(
      getGroupStandingsPicksByPhase("user1", "pool1", "gs"),
    ).rejects.toThrow("FORBIDDEN");
  });
});

// ─── publishGroupStandingsResult ──────────────────────────────

describe("publishGroupStandingsResult", () => {
  it("creates a new result when none exists", async () => {
    vi.mocked(requirePoolAdmin).mockResolvedValue(true);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({ id: "pool1" } as any);
    vi.mocked(prisma.groupStandingsResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.groupStandingsResult.upsert).mockResolvedValue({
      id: "res1",
      version: 1,
      teamIds: ["t1", "t2", "t3", "t4"],
    } as any);

    const result = await publishGroupStandingsResult(
      "host1", "pool1", "gs", "A", ["t1", "t2", "t3", "t4"], undefined, ctx,
    );

    expect(result.id).toBe("res1");
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    vi.mocked(requirePoolAdmin).mockResolvedValue(false);

    await expect(
      publishGroupStandingsResult("user1", "pool1", "gs", "A", ["t1"], undefined, ctx),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("throws NOT_FOUND when pool does not exist", async () => {
    vi.mocked(requirePoolAdmin).mockResolvedValue(true);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue(null);

    await expect(
      publishGroupStandingsResult("host1", "pool1", "gs", "A", ["t1"], undefined, ctx),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("requires reason for errata (existing result)", async () => {
    vi.mocked(requirePoolAdmin).mockResolvedValue(true);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({ id: "pool1" } as any);
    vi.mocked(prisma.groupStandingsResult.findUnique).mockResolvedValue({ id: "res1" } as any);

    await expect(
      publishGroupStandingsResult("host1", "pool1", "gs", "A", ["t1"], undefined, ctx),
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("allows errata with a reason", async () => {
    vi.mocked(requirePoolAdmin).mockResolvedValue(true);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({ id: "pool1" } as any);
    vi.mocked(prisma.groupStandingsResult.findUnique).mockResolvedValue({ id: "res1" } as any);
    vi.mocked(prisma.groupStandingsResult.upsert).mockResolvedValue({
      id: "res1",
      version: 2,
    } as any);

    const result = await publishGroupStandingsResult(
      "host1", "pool1", "gs", "A", ["t1"], "Corrección de posiciones", ctx,
    );

    expect(result.version).toBe(2);
  });
});

// ─── getGroupStandingsResult ──────────────────────────────────

describe("getGroupStandingsResult", () => {
  it("returns result for a member", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.groupStandingsResult.findUnique).mockResolvedValue({
      id: "res1",
    } as any);

    const { result } = await getGroupStandingsResult("user1", "pool1", "gs", "A");

    expect(result?.id).toBe("res1");
  });

  it("throws FORBIDDEN for non-members", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue(null);

    await expect(
      getGroupStandingsResult("user1", "pool1", "gs", "A"),
    ).rejects.toThrow("FORBIDDEN");
  });
});

// ─── getGroupStandingsResultsByPhase ──────────────────────────

describe("getGroupStandingsResultsByPhase", () => {
  it("returns all results for a phase", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.groupStandingsResult.findMany).mockResolvedValue([
      { id: "r1" },
      { id: "r2" },
    ] as any);

    const { results } = await getGroupStandingsResultsByPhase("user1", "pool1", "gs");

    expect(results).toHaveLength(2);
  });
});

// ─── getGroupMatchResults ─────────────────────────────────────

describe("getGroupMatchResults", () => {
  it("returns match results and counts for a group", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue({
      id: "pool1",
      fixtureSnapshot: null,
      tournamentInstance: { dataJson: {} },
    } as any);
    vi.mocked(parseFixtureData).mockReturnValue({
      matches: [
        { id: "m1", groupId: "A", homeTeamId: "t1", awayTeamId: "t2" },
        { id: "m2", groupId: "A", homeTeamId: "t3", awayTeamId: "t4" },
        { id: "m3", groupId: "B", homeTeamId: "t5", awayTeamId: "t6" },
      ],
      teams: [],
    } as any);
    vi.mocked(prisma.poolMatchResult.findMany).mockResolvedValue([
      { matchId: "m1", currentVersion: { homeGoals: 2, awayGoals: 1 } },
    ] as any);

    const result = await getGroupMatchResults("user1", "pool1", "A");

    expect(result.matches).toHaveLength(2); // only group A matches
    expect(result.completedCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("throws FORBIDDEN for non-members", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue(null);

    await expect(
      getGroupMatchResults("user1", "pool1", "A"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("throws NOT_FOUND when pool does not exist", async () => {
    vi.mocked(prisma.poolMember.findFirst).mockResolvedValue({ id: "pm1" } as any);
    vi.mocked(prisma.pool.findUnique).mockResolvedValue(null);

    await expect(
      getGroupMatchResults("user1", "pool1", "A"),
    ).rejects.toThrow("NOT_FOUND");
  });
});
