import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../db";

// ── Mocks ──────────────────────────────────────────────────────

vi.mock("../../db", () => ({
  prisma: {
    accountReceivable: { findUnique: vi.fn(), update: vi.fn() },
    pool: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    poolPayment: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { applyPaidAccountReceivableToPool, searchPoolsForCcApply } from "./accountReceivableService";
import { ServiceError } from "../authService";

const ADMIN = "admin-1";
const POOL_ID = "pool-1";

function ccFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "cc-1",
    consecutive: "CC-2026-0002",
    status: "PAID",
    poolPaymentId: null,
    targetCapacity: 150,
    currency: "COP",
    amountCop: 228500,
    amountUsdCents: null,
    clientContactEmail: "client@native.io",
    paidAtUtc: new Date("2026-06-02T01:00:00Z"),
    ...overrides,
  };
}

function poolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: POOL_ID,
    maxParticipants: 2,
    organizationId: "org-1",
    members: [{ userId: "host-1", role: "CORPORATE_HOST" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction runs the callback with the same mocked prisma as `tx`.
  (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(prisma));
  (prisma.poolPayment.create as any).mockResolvedValue({ id: "pp-1" });
  (prisma.pool.update as any).mockResolvedValue({});
  (prisma.accountReceivable.update as any).mockResolvedValue({});
  (prisma.auditEvent.create as any).mockResolvedValue({});
});

describe("applyPaidAccountReceivableToPool", () => {
  it("rejects a CC already applied (anti-double)", async () => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture({ poolPaymentId: "pp-old" }));
    await expect(
      applyPaidAccountReceivableToPool({ ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN }),
    ).rejects.toMatchObject({ code: "ALREADY_APPLIED" });
    expect(prisma.poolPayment.create).not.toHaveBeenCalled();
  });

  it.each(["CANCELLED", "EXPIRED", "REDEEMED"])("rejects status %s", async (status) => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture({ status }));
    await expect(
      applyPaidAccountReceivableToPool({ ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN }),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(prisma.poolPayment.create).not.toHaveBeenCalled();
  });

  it("rejects when pool capacity already >= targetCapacity (nothing to apply)", async () => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture({ targetCapacity: 150 }));
    (prisma.pool.findUnique as any).mockResolvedValue(poolFixture({ maxParticipants: 150 }));
    await expect(
      applyPaidAccountReceivableToPool({ ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.poolPayment.create).not.toHaveBeenCalled();
  });

  it("rejects when the pool has no active host", async () => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture());
    (prisma.pool.findUnique as any).mockResolvedValue(poolFixture({ members: [] }));
    await expect(
      applyPaidAccountReceivableToPool({ ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("applies: creates COMPLETED payment, expands pool, links CC", async () => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture());
    (prisma.pool.findUnique as any).mockResolvedValue(poolFixture());

    const result = await applyPaidAccountReceivableToPool({
      ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN,
    });

    // PoolPayment COMPLETED, attributed to the host, 2 -> 150, linked to CC.
    expect(prisma.poolPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poolId: POOL_ID, userId: "host-1", status: "COMPLETED",
          fromCapacity: 2, toCapacity: 150, accountReceivableId: "cc-1",
          currency: "cop", amountCop: 228500,
        }),
      }),
    );
    // Pool expanded.
    expect(prisma.pool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: POOL_ID },
        data: expect.objectContaining({ maxParticipants: 150 }),
      }),
    );
    // CC linked (single-apply lock) — among the update calls, one sets poolPaymentId.
    const linked = (prisma.accountReceivable.update as any).mock.calls.some(
      (c: any[]) => c[0]?.data?.poolPaymentId === "pp-1",
    );
    expect(linked).toBe(true);
    expect(prisma.auditEvent.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      poolPaymentId: "pp-1", fromCapacity: 2, toCapacity: 150,
      clientContactEmail: "client@native.io",
    });
  });

  it("marks a PENDING CC as PAID in the same operation", async () => {
    (prisma.accountReceivable.findUnique as any).mockResolvedValue(ccFixture({ status: "PENDING", paidAtUtc: null }));
    (prisma.pool.findUnique as any).mockResolvedValue(poolFixture());

    await applyPaidAccountReceivableToPool({ ccId: "cc-1", poolId: POOL_ID, adminUserId: ADMIN });

    // One of the CC updates flips status to PAID.
    const paid = (prisma.accountReceivable.update as any).mock.calls.some(
      (c: any[]) => c[0]?.data?.status === "PAID",
    );
    expect(paid).toBe(true);
  });
});

describe("searchPoolsForCcApply", () => {
  it("returns [] for queries shorter than 2 chars without hitting the DB", async () => {
    const out = await searchPoolsForCcApply("a");
    expect(out).toEqual([]);
    expect(prisma.pool.findMany).not.toHaveBeenCalled();
  });

  it("maps the corporate host email into hostEmail", async () => {
    (prisma.pool.findMany as any).mockResolvedValue([
      {
        id: "pool-1", name: "Native World Cup 2026", status: "ACTIVE",
        maxParticipants: 2, organizationId: "org-1",
        members: [{ role: "CORPORATE_HOST", user: { email: "caterine@yahoo.com" } }],
      },
    ]);
    const out = await searchPoolsForCcApply("native");
    expect(prisma.pool.findMany).toHaveBeenCalled();
    expect(out).toEqual([
      expect.objectContaining({ id: "pool-1", name: "Native World Cup 2026", hostEmail: "caterine@yahoo.com" }),
    ]);
  });
});
