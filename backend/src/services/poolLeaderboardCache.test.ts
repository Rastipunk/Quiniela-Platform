import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getOrComputeLeaderboard, invalidatePoolLeaderboard } from "./poolLeaderboardCache";

const TTL_ENV = "POOL_LEADERBOARD_CACHE_TTL_MS";

/** Unique pool id per test so the module-level cache never bleeds across cases. */
let counter = 0;
function poolId(): string {
  return `pool-${Date.now()}-${counter++}`;
}

describe("poolLeaderboardCache", () => {
  const original = process.env[TTL_ENV];

  beforeEach(() => {
    delete process.env[TTL_ENV]; // default 20s
  });
  afterEach(() => {
    if (original === undefined) delete process.env[TTL_ENV];
    else process.env[TTL_ENV] = original;
  });

  it("computes once then serves from cache for the same fingerprint", async () => {
    const id = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { value: 42 };
    };

    const a = await getOrComputeLeaderboard(id, "fp-1", compute);
    const b = await getOrComputeLeaderboard(id, "fp-1", compute);

    expect(a).toEqual({ value: 42 });
    expect(b).toBe(a); // same cached object reference
    expect(calls).toBe(1); // computed only once
  });

  it("recomputes when the fingerprint changes (a match input changed)", async () => {
    const id = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { calls };
    };

    await getOrComputeLeaderboard(id, "fp-1", compute);
    const second = await getOrComputeLeaderboard(id, "fp-2", compute); // changed

    expect(calls).toBe(2);
    expect(second).toEqual({ calls: 2 });
  });

  it("recomputes after explicit invalidation", async () => {
    const id = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { calls };
    };

    await getOrComputeLeaderboard(id, "fp-1", compute);
    invalidatePoolLeaderboard(id);
    await getOrComputeLeaderboard(id, "fp-1", compute);

    expect(calls).toBe(2);
  });

  it("coalesces concurrent misses for the same pool into one computation", async () => {
    const id = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { calls };
    };

    // Fire three at once before the first resolves.
    const [r1, r2, r3] = await Promise.all([
      getOrComputeLeaderboard(id, "fp-1", compute),
      getOrComputeLeaderboard(id, "fp-1", compute),
      getOrComputeLeaderboard(id, "fp-1", compute),
    ]);

    expect(calls).toBe(1); // single shared computation
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it("keeps pools independent", async () => {
    const a = poolId();
    const b = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { calls };
    };

    await getOrComputeLeaderboard(a, "fp", compute);
    await getOrComputeLeaderboard(b, "fp", compute);

    expect(calls).toBe(2); // two distinct pools → two computations
  });

  it("kill-switch (TTL=0) bypasses the cache and computes every time", async () => {
    process.env[TTL_ENV] = "0";
    const id = poolId();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { calls };
    };

    await getOrComputeLeaderboard(id, "fp-1", compute);
    await getOrComputeLeaderboard(id, "fp-1", compute);
    await getOrComputeLeaderboard(id, "fp-1", compute);

    expect(calls).toBe(3); // never cached
  });
});
