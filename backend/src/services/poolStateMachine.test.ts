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
    },
    prediction: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../lib/audit", () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock("../lib/email", () => ({
  sendPoolCompletedEmail: vi.fn(),
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
  canJoinPool,
  canMakePicks,
  canPublishResults,
  canEditPoolSettings,
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
  it("transitions DRAFT → ACTIVE", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "DRAFT" });
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

  it("throws if pool is not COMPLETED", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ACTIVE" });

    await expect(transitionToArchived("pool-1", "user-1")).rejects.toThrow(
      "Pool must be COMPLETED to archive"
    );
  });

  it("throws if pool not found", async () => {
    (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(transitionToArchived("pool-x", "user-1")).rejects.toThrow("Pool not found");
  });
});
