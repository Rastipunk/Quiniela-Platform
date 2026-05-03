import { describe, it, expect } from "vitest";
import {
  calculateUpgradePrice,
  calculateUpgradePriceCop,
  calculateTotalPrice,
  usdToCents,
  getFreeLimit,
  isWithinFreeLimit,
  PERSONAL_FREE_LIMIT,
} from "./pricing";

describe("pricing — free tier", () => {
  it("personal pool <= 20 participants is free", () => {
    expect(calculateTotalPrice("personal", 20)).toBe(0);
    expect(calculateTotalPrice("personal", 10)).toBe(0);
    expect(calculateTotalPrice("personal", 1)).toBe(0);
  });

  it("corporate pool <= free limit is free", () => {
    const limit = getFreeLimit("corporate");
    expect(calculateTotalPrice("corporate", limit)).toBe(0);
  });

  it("isWithinFreeLimit works for both pool types", () => {
    expect(isWithinFreeLimit("personal", 20)).toBe(true);
    expect(isWithinFreeLimit("personal", 21)).toBe(false);
  });
});

describe("pricing — USD calculations", () => {
  it("personal pool of 50 costs one block", () => {
    const price = calculateTotalPrice("personal", 50);
    expect(price).toBeGreaterThan(0);
    expect(price).toBe(7.99);
  });

  it("personal pool of 100 costs two blocks with volume discount", () => {
    const price = calculateTotalPrice("personal", 100);
    expect(price).toBeGreaterThan(calculateTotalPrice("personal", 50));
  });

  it("upgrade price equals difference between total prices", () => {
    const from50 = calculateTotalPrice("personal", 50);
    const to100 = calculateTotalPrice("personal", 100);
    const upgrade = calculateUpgradePrice("personal", 50, 100);
    expect(upgrade).toBeCloseTo(to100 - from50, 2);
  });

  it("downgrade (to <= from) returns 0, not negative", () => {
    expect(calculateUpgradePrice("personal", 50, 20)).toBe(0);
    expect(calculateUpgradePrice("personal", 100, 100)).toBe(0);
  });

  it("usdToCents converts correctly", () => {
    expect(usdToCents(7.99)).toBe(799);
    expect(usdToCents(0)).toBe(0);
    expect(usdToCents(49.99)).toBe(4999);
  });
});

describe("pricing — USD corporate (regression: BE-vs-FE parity)", () => {
  // These values must match the tiers shown by frontend-next/src/lib/pricing.ts
  // getCorporateTiersUsd / getTierForCustomCountUsd. A divergence between
  // the two sides means the customer sees one price in the UI and gets
  // charged a different one at Polar checkout — that's the bug we're locking in.

  it("corporate exactly at free limit (2) is free", () => {
    expect(calculateTotalPrice("corporate", 2)).toBe(0);
  });

  it("corporate at first paid tier (100) is exactly the base price", () => {
    // FE: getCorporateTiersUsd → tier @ 100 = $49.99 (CORPORATE_BASE_PRICE_USD)
    expect(calculateTotalPrice("corporate", 100)).toBe(49.99);
  });

  it("corporate between free limit and 100 still pays only base", () => {
    // The wizard rounds custom counts UP to the nearest tier, so anyone
    // picking 3..100 lands on the 100 tier ($49.99). BE must agree.
    expect(calculateTotalPrice("corporate", 50)).toBe(49.99);
    expect(calculateTotalPrice("corporate", 73)).toBe(49.99);
    expect(calculateTotalPrice("corporate", 99)).toBe(49.99);
  });

  it("corporate at 150 is base + one extra block", () => {
    // FE: $49.99 + $7.99 = $57.98
    expect(calculateTotalPrice("corporate", 150)).toBe(57.98);
  });

  it("corporate at 200 is base + two extra blocks", () => {
    // FE: $49.99 + $7.99 + $7.99 = $65.97
    expect(calculateTotalPrice("corporate", 200)).toBe(65.97);
  });

  it("corporate at 300 is base + four extra blocks (with volume discount kicking in at step 2)", () => {
    // step 0,1: $7.99 each; step 2,3: $7.99 - $0.40 = $7.59 each
    // $49.99 + $7.99 + $7.99 + $7.59 + $7.59 = $81.15
    expect(calculateTotalPrice("corporate", 300)).toBe(81.15);
  });

  it("corporate upgrade from free (2) to 100 is exactly base price", () => {
    // The most common corporate flow: pool created at free (2) → upgrade to 100
    expect(calculateUpgradePrice("corporate", 2, 100)).toBe(49.99);
  });

  it("corporate upgrade from 100 to 150 is exactly one extra block", () => {
    expect(calculateUpgradePrice("corporate", 100, 150)).toBe(7.99);
  });

  it("corporate upgrade rounds capacity UP to the nearest 50", () => {
    // A custom 73 charges the same as 100; a custom 101 charges the same as 150.
    expect(calculateTotalPrice("corporate", 101)).toBe(57.98);
    expect(calculateTotalPrice("corporate", 149)).toBe(57.98);
  });
});

describe("pricing — COP calculations", () => {
  it("personal COP upgrade from free to 50 is base price", () => {
    const price = calculateUpgradePriceCop("personal", PERSONAL_FREE_LIMIT, 50);
    expect(price).toBeGreaterThan(0);
  });

  it("COP downgrade returns 0", () => {
    expect(calculateUpgradePriceCop("personal", 50, 20)).toBe(0);
  });

  it("COP price increases with capacity", () => {
    const to50 = calculateUpgradePriceCop("personal", 20, 50);
    const to100 = calculateUpgradePriceCop("personal", 20, 100);
    expect(to100).toBeGreaterThan(to50);
  });
});
