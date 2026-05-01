import { describe, it, expect, vi, beforeEach } from "vitest";

// Module mocks must be declared BEFORE importing the unit under test.
// vi.mock is hoisted automatically.
vi.mock("../db", () => ({
  prisma: {
    pool: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    poolMember: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("./email", () => ({
  sendPoolFullNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendCapacityWarningEmail: vi.fn().mockResolvedValue({ success: true }),
  sendBlockedJoinAttemptEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("./audit", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./asyncHelpers", () => ({
  // Capture the promise so we can inspect what was scheduled. Swallow
  // rejections to mimic production fire-and-forget semantics in tests.
  fireAndForget: vi.fn((_label: string, promise: Promise<unknown>) => {
    void promise.catch(() => {});
  }),
}));

import { prisma } from "../db";
import { sendPoolFullNotificationEmail, sendCapacityWarningEmail } from "./email";
import { writeAuditEvent } from "./audit";
import { fireAndForget } from "./asyncHelpers";
import { checkAndNotifyCapacityThresholds } from "./poolCapacity";

const HOST_USER = {
  email: "host@example.com",
  displayName: "Hostina",
  country: "CO",
};

interface SetupArgs {
  pool: {
    id: string;
    name: string;
    maxParticipants: number | null;
    capacityWarningThresholdPct?: number | null;
    capacityWarningNotifiedAt?: Date | null;
    poolFullNotifiedAt?: Date | null;
  } | null;
  memberCount: number;
  host?: { user: typeof HOST_USER } | null;
  claimResult?: number;
}

function setupMocks(args: SetupArgs) {
  // Use mockResolvedValue (not Once) — clearAllMocks doesn't drain the
  // mockResolvedValueOnce queue, so a leftover from an early-returning prior
  // test would contaminate the next one.
  vi.clearAllMocks();
  (prisma.pool.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
    args.pool === null
      ? null
      : {
          id: args.pool.id,
          name: args.pool.name,
          maxParticipants: args.pool.maxParticipants,
          capacityWarningThresholdPct: args.pool.capacityWarningThresholdPct ?? null,
          capacityWarningNotifiedAt: args.pool.capacityWarningNotifiedAt ?? null,
          poolFullNotifiedAt: args.pool.poolFullNotifiedAt ?? null,
        },
  );
  (prisma.poolMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(args.memberCount);
  (prisma.poolMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
    args.host === undefined ? { user: HOST_USER } : args.host,
  );
  (prisma.pool.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: args.claimResult ?? 1,
  });
}

const FULL_POOL = {
  id: "p-full",
  name: "Mundial 2026",
  maxParticipants: 100,
};

describe("checkAndNotifyCapacityThresholds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'none' when count is below the warning threshold", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 50 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("none");
    expect(result.emailSent).toBe(false);
    expect(prisma.pool.updateMany).not.toHaveBeenCalled();
    expect(sendCapacityWarningEmail).not.toHaveBeenCalled();
    expect(sendPoolFullNotificationEmail).not.toHaveBeenCalled();
  });

  it("returns 'warning' and dispatches the warning email at threshold (95% of 100)", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 95 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full", actorUserId: "u-1" });
    expect(result.state).toBe("warning");
    expect(result.emailSent).toBe(true);
    expect(sendCapacityWarningEmail).toHaveBeenCalledTimes(1);
    expect(sendCapacityWarningEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: HOST_USER.email,
        currentMembers: 95,
        maxParticipants: 100,
        locale: "es", // CO → es
      }),
    );
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CAPACITY_WARNING_NOTIFIED", actorUserId: "u-1" }),
    );
  });

  it("returns 'full' and dispatches the pool-full email at capacity", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 100 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("full");
    expect(result.emailSent).toBe(true);
    expect(sendPoolFullNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendCapacityWarningEmail).not.toHaveBeenCalled();
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "POOL_FULL_NOTIFIED" }),
    );
  });

  it("returns 'full' even when count exceeds max (defensive)", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 105 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("full");
    expect(result.emailSent).toBe(true);
  });

  it("does not re-fire the warning when capacityWarningNotifiedAt is already set", async () => {
    setupMocks({
      pool: { ...FULL_POOL, capacityWarningNotifiedAt: new Date("2026-01-01") },
      memberCount: 95,
    });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("warning");
    expect(result.emailSent).toBe(false);
    expect(sendCapacityWarningEmail).not.toHaveBeenCalled();
    expect(prisma.pool.updateMany).not.toHaveBeenCalled();
  });

  it("does not re-fire the full email when poolFullNotifiedAt is already set", async () => {
    setupMocks({
      pool: { ...FULL_POOL, poolFullNotifiedAt: new Date("2026-01-01") },
      memberCount: 100,
    });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("full");
    expect(result.emailSent).toBe(false);
    expect(sendPoolFullNotificationEmail).not.toHaveBeenCalled();
    expect(prisma.pool.updateMany).not.toHaveBeenCalled();
  });

  it("returns 'none' when pool is not found", async () => {
    setupMocks({ pool: null, memberCount: 0 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "missing" });
    expect(result.state).toBe("none");
    expect(prisma.poolMember.count).not.toHaveBeenCalled();
  });

  it("returns 'none' when maxParticipants is null (legacy unlimited pool)", async () => {
    setupMocks({ pool: { ...FULL_POOL, maxParticipants: null }, memberCount: 999 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("none");
    expect(prisma.poolMember.count).not.toHaveBeenCalled();
  });

  it("uses per-pool capacityWarningThresholdPct when provided (90% of 100 → warning at 90)", async () => {
    setupMocks({
      pool: { ...FULL_POOL, capacityWarningThresholdPct: 90 },
      memberCount: 90,
    });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("warning");
    expect(result.emailSent).toBe(true);
  });

  it("falls back to global default (95) when per-pool threshold is null", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 94 }); // below 95 default
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("none");
  });

  it("when pool reaches full, atomically covers the warning flag too (prevents stale warning email)", async () => {
    // Pool was never warned, then jumps straight to full from a burst of joins.
    setupMocks({
      pool: { ...FULL_POOL, capacityWarningNotifiedAt: null, poolFullNotifiedAt: null },
      memberCount: 100,
    });
    await checkAndNotifyCapacityThresholds({ poolId: "p-full" });

    // The first updateMany call should set BOTH flags in the same write.
    expect(prisma.pool.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-full", poolFullNotifiedAt: null },
        data: expect.objectContaining({
          poolFullNotifiedAt: expect.any(Date),
          capacityWarningNotifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("when full but warning was already sent, does NOT re-set the warning flag", async () => {
    setupMocks({
      pool: { ...FULL_POOL, capacityWarningNotifiedAt: new Date("2026-01-01") },
      memberCount: 100,
    });
    await checkAndNotifyCapacityThresholds({ poolId: "p-full" });

    const updateCall = (prisma.pool.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall).toBeDefined();
    expect(updateCall.data).not.toHaveProperty("capacityWarningNotifiedAt");
  });

  it("warning claim guards against pool becoming full mid-flight (poolFullNotifiedAt: null in WHERE)", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 95 });
    await checkAndNotifyCapacityThresholds({ poolId: "p-full" });

    // The warning updateMany must include `poolFullNotifiedAt: null` to avoid
    // racing with a concurrent full-fire in the same window.
    expect(prisma.pool.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "p-full",
          capacityWarningNotifiedAt: null,
          poolFullNotifiedAt: null,
        },
      }),
    );
  });

  it("when atomic claim returns count=0 (lost the race), no email is sent", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 95, claimResult: 0 });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("warning");
    expect(result.emailSent).toBe(false);
    expect(sendCapacityWarningEmail).not.toHaveBeenCalled();
    expect(fireAndForget).not.toHaveBeenCalledWith(
      "capacity:warning",
      expect.anything(),
    );
  });

  it("when host has no email, audit still fires but emailSent is false", async () => {
    setupMocks({ pool: FULL_POOL, memberCount: 95, host: null });
    const result = await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(result.state).toBe("warning");
    expect(result.emailSent).toBe(false);
    expect(sendCapacityWarningEmail).not.toHaveBeenCalled();
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CAPACITY_WARNING_NOTIFIED" }),
    );
  });

  it("maps host country to locale (BR → pt)", async () => {
    setupMocks({
      pool: FULL_POOL,
      memberCount: 95,
      host: { user: { ...HOST_USER, country: "BR" } },
    });
    await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(sendCapacityWarningEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "pt" }),
    );
  });

  it("uses 'Host' as default displayName when user has none", async () => {
    setupMocks({
      pool: FULL_POOL,
      memberCount: 100,
      host: { user: { ...HOST_USER, displayName: "" } },
    });
    await checkAndNotifyCapacityThresholds({ poolId: "p-full" });
    expect(sendPoolFullNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ hostName: "Host" }),
    );
  });
});
