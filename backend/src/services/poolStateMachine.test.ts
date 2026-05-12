import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../db", () => ({
  prisma: {
    pool: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    poolMatchResult: {
      findMany: vi.fn(),
    },
    poolMember: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    prediction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    structuralPrediction: {
      deleteMany: vi.fn(),
    },
    groupStandingsPrediction: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock("../lib/email", () => ({
  sendPoolCompletedEmail: vi.fn(),
  sendPoolRevertedToDraftEmail: vi.fn(),
  batchSendEmails: vi.fn(),
}));

vi.mock("../lib/asyncHelpers", () => ({
  fireAndForget: vi.fn((_name: string, p: Promise<unknown>) => p),
}));

vi.mock("../lib/constants", () => ({
  countryToLocale: vi.fn(() => "es"),
  resolveUserLocale: vi.fn(() => "es"),
}));

vi.mock("../lib/fixture", () => ({
  extractMatches: vi.fn(),
  typed: vi.fn((x: unknown) => x),
}));

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { extractMatches } from "../lib/fixture";
import {
  transitionToActive,
  transitionToCompleted,
  transitionToArchived,
  revertPoolToDraft,
  wouldCauseRevert,
  canJoinPool,
  canMakePicks,
  canPublishResults,
  canEditPoolSettings,
  canEditScoringConfig,
  canCreateInvites,
} from "./poolStateMachine";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Pure validation functions ─────────────────────────────────

describe("canJoinPool", () => {
  it("allows joining DRAFT pools", () => {
    expect(canJoinPool("DRAFT")).toBe(true);
  });
  it("allows joining ACTIVE pools", () => {
    expect(canJoinPool("ACTIVE")).toBe(true);
  });
  it("blocks joining COMPLETED pools", () => {
    expect(canJoinPool("COMPLETED")).toBe(false);
  });
  it("blocks joining ARCHIVED pools", () => {
    expect(canJoinPool("ARCHIVED")).toBe(false);
  });
});

describe("canMakePicks", () => {
  it("allows picks in ACTIVE pools", () => {
    expect(canMakePicks("ACTIVE")).toBe(true);
  });
  it("blocks picks in DRAFT pools", () => {
    expect(canMakePicks("DRAFT")).toBe(false);
  });
  it("blocks picks in COMPLETED pools", () => {
    expect(canMakePicks("COMPLETED")).toBe(false);
  });
});

describe("canPublishResults", () => {
  it("allows results in ACTIVE pools", () => {
    expect(canPublishResults("ACTIVE")).toBe(true);
  });
  it("allows results in COMPLETED pools (erratas)", () => {
    expect(canPublishResults("COMPLETED")).toBe(true);
  });
  it("blocks results in DRAFT pools", () => {
    expect(canPublishResults("DRAFT")).toBe(false);
  });
  it("blocks results in ARCHIVED pools", () => {
    expect(canPublishResults("ARCHIVED")).toBe(false);
  });
});

describe("canEditPoolSettings", () => {
  it("allows editing in DRAFT pools", () => {
    expect(canEditPoolSettings("DRAFT")).toBe(true);
  });
  it("blocks editing in ACTIVE pools", () => {
    expect(canEditPoolSettings("ACTIVE")).toBe(false);
  });
});

describe("canCreateInvites", () => {
  it("allows invites in DRAFT pools", () => {
    expect(canCreateInvites("DRAFT")).toBe(true);
  });
  it("allows invites in ACTIVE pools", () => {
    expect(canCreateInvites("ACTIVE")).toBe(true);
  });
  it("blocks invites in COMPLETED pools", () => {
    expect(canCreateInvites("COMPLETED")).toBe(false);
  });
});

// ─── transitionToActive ────────────────────────────────────────

describe("transitionToActive", () => {
  it("transitions DRAFT → ACTIVE when an ACTIVE non-host exists", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "DRAFT" });
    (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (writeAuditEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await transitionToActive("pool-1", "user-1");

    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "ACTIVE" },
    });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POOL_STATUS_CHANGED",
        dataJson: expect.objectContaining({ from: "DRAFT", to: "ACTIVE" }),
      })
    );
  });

  it("does NOT transition when DRAFT pool has zero ACTIVE PLAYER/CO_ADMIN", async () => {
    // Regression: host clicking their own invite link, or corporate
    // re-activation by an existing member, should not flip DRAFT→ACTIVE.
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "DRAFT" });
    (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await transitionToActive("pool-1", "user-1");

    expect(prisma.pool.update).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it("does nothing if pool is already ACTIVE", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });

    await transitionToActive("pool-1", "user-1");

    expect(prisma.pool.update).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it("throws if pool not found", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(transitionToActive("pool-x", "user-1")).rejects.toThrow("Pool not found");
  });
});

// ─── transitionToCompleted ─────────────────────────────────────

describe("transitionToCompleted", () => {
  it("transitions ACTIVE → COMPLETED when all matches have results", async () => {
    const matches = [{ id: "m1" }, { id: "m2" }];
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      tournamentInstance: { dataJson: {} },
    });
    (extractMatches as ReturnType<typeof vi.fn>).mockReturnValue(matches);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { matchId: "m1" },
      { matchId: "m2" },
    ]);
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (writeAuditEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    // Mock for the async email block
    (prisma.poolMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.prediction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await transitionToCompleted("pool-1", "user-1");

    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "COMPLETED" },
    });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dataJson: expect.objectContaining({ from: "ACTIVE", to: "COMPLETED" }),
      })
    );
  });

  it("does nothing if not all matches have results", async () => {
    const matches = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      tournamentInstance: { dataJson: {} },
    });
    (extractMatches as ReturnType<typeof vi.fn>).mockReturnValue(matches);
    (prisma.poolMatchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { matchId: "m1" },
    ]);

    await transitionToCompleted("pool-1");

    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("does nothing if pool is not ACTIVE", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "COMPLETED",
      tournamentInstance: { dataJson: {} },
    });

    await transitionToCompleted("pool-1");

    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("throws if pool not found", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(transitionToCompleted("pool-x")).rejects.toThrow("Pool not found");
  });
});

// ─── transitionToArchived ──────────────────────────────────────

describe("transitionToArchived", () => {
  it("transitions COMPLETED → ARCHIVED", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "COMPLETED" });
    (prisma.pool.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (writeAuditEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await transitionToArchived("pool-1", "user-1");

    expect(prisma.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "ARCHIVED" },
    });
  });

  it("throws if pool is already ARCHIVED", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ARCHIVED" });

    await expect(transitionToArchived("pool-1", "user-1")).rejects.toThrow(
      "Pool is already archived"
    );
  });

  it("throws if pool not found", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(transitionToArchived("pool-x", "user-1")).rejects.toThrow("Pool not found");
  });
});

// ─── canEditScoringConfig ──────────────────────────────────────

describe("canEditScoringConfig", () => {
  it("allows scoring edits only in DRAFT", () => {
    expect(canEditScoringConfig("DRAFT")).toBe(true);
    expect(canEditScoringConfig("ACTIVE")).toBe(false);
    expect(canEditScoringConfig("COMPLETED")).toBe(false);
    expect(canEditScoringConfig("ARCHIVED")).toBe(false);
  });
});

// ─── wouldCauseRevert ──────────────────────────────────────────

describe("wouldCauseRevert", () => {
  it("returns false when pool is not ACTIVE", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "DRAFT" });
    const result = await wouldCauseRevert("pool-1", "member-1");
    expect(result).toBe(false);
    expect(prisma.poolMember.count).not.toHaveBeenCalled();
  });

  it("returns false when other PLAYER/CO_ADMIN remain", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });
    (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    expect(await wouldCauseRevert("pool-1", "member-x")).toBe(false);
  });

  it("returns true when removing the last PLAYER/CO_ADMIN", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });
    (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    expect(await wouldCauseRevert("pool-1", "member-x")).toBe(true);
  });

  it("excludes the target member from the count", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });
    (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    await wouldCauseRevert("pool-1", "member-being-kicked");
    expect(prisma.poolMember.count).toHaveBeenCalledWith({
      where: {
        poolId: "pool-1",
        status: "ACTIVE",
        role: { in: ["PLAYER", "CO_ADMIN"] },
        NOT: { id: "member-being-kicked" },
      },
    });
  });
});

// ─── revertPoolToDraft ─────────────────────────────────────────

describe("revertPoolToDraft", () => {
  it("is a no-op when pool is not ACTIVE", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "DRAFT",
      name: "Test",
      createdByUser: null,
    });
    await revertPoolToDraft("pool-1", "user-1", "reason");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.pool.update).not.toHaveBeenCalled();
  });

  it("deletes player predictions and transitions ACTIVE → DRAFT", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pool-1",
      status: "ACTIVE",
      name: "Test Pool",
      createdByUser: { id: "host-1", email: "host@example.com", displayName: "Host", country: "CO" },
    });

    // Mock the transaction to invoke the callback with a fake tx client
    // that mirrors the calls we want to verify.
    const txMock = {
      prediction: { deleteMany: vi.fn().mockResolvedValue({ count: 12 }) },
      structuralPrediction: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      groupStandingsPrediction: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
      pool: { update: vi.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: typeof txMock) => Promise<void>) => { await cb(txMock); }
    );
    (writeAuditEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await revertPoolToDraft("pool-1", "user-1", "last member left");

    expect(txMock.prediction.deleteMany).toHaveBeenCalledWith({ where: { poolId: "pool-1" } });
    expect(txMock.structuralPrediction.deleteMany).toHaveBeenCalledWith({ where: { poolId: "pool-1" } });
    expect(txMock.groupStandingsPrediction.deleteMany).toHaveBeenCalledWith({ where: { poolId: "pool-1" } });
    expect(txMock.pool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: { status: "DRAFT" },
    });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POOL_STATUS_CHANGED",
        dataJson: expect.objectContaining({
          from: "ACTIVE",
          to: "DRAFT",
          reason: "last member left",
          deletedPredictions: 12,
          deletedStructural: 3,
          deletedGroupStandings: 5,
        }),
      })
    );
  });

  it("throws when pool not found", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(revertPoolToDraft("pool-x", "u", "r")).rejects.toThrow("Pool not found");
  });
});
