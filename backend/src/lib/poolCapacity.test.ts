import { describe, it, expect, vi } from "vitest";
import { ensurePoolCapacity, computeWarningThreshold } from "./poolCapacity";

// Build a mock Prisma transaction client
function makeMockTx(memberCount: number) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    poolMember: {
      count: vi.fn().mockResolvedValue(memberCount),
    },
  } as any;
}

describe("ensurePoolCapacity", () => {
  it("resolves when pool is under capacity", async () => {
    const tx = makeMockTx(5);
    await expect(ensurePoolCapacity(tx, "pool-1", 10)).resolves.toBeUndefined();
  });

  it("throws POOL_FULL when pool is at capacity", async () => {
    const tx = makeMockTx(10);
    await expect(ensurePoolCapacity(tx, "pool-1", 10)).rejects.toThrow("POOL_FULL");
  });

  it("throws POOL_FULL when pool is over capacity", async () => {
    const tx = makeMockTx(15);
    await expect(ensurePoolCapacity(tx, "pool-1", 10)).rejects.toThrow("POOL_FULL");
  });

  it("resolves immediately when maxParticipants is null (unlimited)", async () => {
    const tx = makeMockTx(999);
    await expect(ensurePoolCapacity(tx, "pool-1", null)).resolves.toBeUndefined();
    // Should not even query the database
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.poolMember.count).not.toHaveBeenCalled();
  });

  it("resolves immediately when maxParticipants is 0 (falsy)", async () => {
    const tx = makeMockTx(5);
    await expect(ensurePoolCapacity(tx, "pool-1", 0)).resolves.toBeUndefined();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("acquires a row-level lock via SELECT FOR UPDATE", async () => {
    const tx = makeMockTx(3);
    await ensurePoolCapacity(tx, "pool-1", 10);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("counts only ACTIVE and PENDING_APPROVAL members", async () => {
    const tx = makeMockTx(2);
    await ensurePoolCapacity(tx, "pool-1", 10);
    expect(tx.poolMember.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poolId: "pool-1",
          status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
        }),
      }),
    );
  });

  it("resolves when member count is one below capacity", async () => {
    const tx = makeMockTx(9);
    await expect(ensurePoolCapacity(tx, "pool-1", 10)).resolves.toBeUndefined();
  });

  it("throws when member count equals maxParticipants exactly", async () => {
    const tx = makeMockTx(20);
    await expect(ensurePoolCapacity(tx, "pool-1", 20)).rejects.toThrow("POOL_FULL");
  });
});

describe("computeWarningThreshold", () => {
  // Standard sizes — naive `floor(max*pct/100)` would also work here.
  it("fires at 95 for max=100 / pct=95", () => {
    expect(computeWarningThreshold(100, 95)).toBe(95);
  });
  it("fires at 19 for max=20 / pct=95", () => {
    expect(computeWarningThreshold(20, 95)).toBe(19);
  });
  it("fires at 9 for max=10 / pct=95", () => {
    expect(computeWarningThreshold(10, 95)).toBe(9);
  });

  // Small-pool edge cases — the "reserve at least one slot" rule kicks in.
  it("fires at 2 for max=3 / pct=95 (reserves 1 slot, not 0)", () => {
    expect(computeWarningThreshold(3, 95)).toBe(2);
  });
  it("fires at 1 for max=2 / pct=95", () => {
    expect(computeWarningThreshold(2, 95)).toBe(1);
  });
  it("fires at 0 for max=1 / pct=95 (warning fires on first member)", () => {
    expect(computeWarningThreshold(1, 95)).toBe(0);
  });

  // Different threshold percentages.
  it("fires at 90 for max=100 / pct=90", () => {
    expect(computeWarningThreshold(100, 90)).toBe(90);
  });
  it("fires at 99 for max=100 / pct=99", () => {
    expect(computeWarningThreshold(100, 99)).toBe(99);
  });
  it("fires at 80 for max=100 / pct=80", () => {
    expect(computeWarningThreshold(100, 80)).toBe(80);
  });

  // Clamping — out-of-range thresholds are coerced into 1..99.
  it("clamps pct=0 to pct=1 (margin 99% of max)", () => {
    // max=100, clamped pct=1, margin = max(1, floor(100*99/100)) = 99 → threshold=1
    expect(computeWarningThreshold(100, 0)).toBe(1);
  });
  it("clamps pct=100 to pct=99 (margin 1% of max, floor → still 1)", () => {
    expect(computeWarningThreshold(100, 100)).toBe(99);
  });
  it("clamps negative pct to pct=1", () => {
    expect(computeWarningThreshold(100, -50)).toBe(1);
  });

  // Degenerate inputs.
  it("returns 0 when maxParticipants is 0", () => {
    expect(computeWarningThreshold(0, 95)).toBe(0);
  });
  it("returns 0 when maxParticipants is negative", () => {
    expect(computeWarningThreshold(-5, 95)).toBe(0);
  });
});
