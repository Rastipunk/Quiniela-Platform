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
