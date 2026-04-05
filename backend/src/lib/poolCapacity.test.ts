import { describe, it, expect, vi } from "vitest";
import { ensurePoolCapacity } from "./poolCapacity";

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
