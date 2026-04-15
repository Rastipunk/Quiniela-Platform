// Pricing utility for pool capacity tiers
//
// Currency: Colombian Pesos (COP)
// All prices are rounded to the nearest thousand pesos for clean display.
//
// The tier table is hardcoded (instead of computed) so that the rounded
// values are deterministic and visually clean ($28.000, $56.000, etc.).
// If you need to update prices, edit PERSONAL_TIER_PRICES and CORPORATE_TIER_PRICES
// or override via env vars (NEXT_PUBLIC_*).

export type PoolType = "personal" | "corporate";

export type PricingTier = {
  maxParticipants: number;
  pricePerIncrement: number; // price for this 50-player block (COP)
  totalPrice: number; // cumulative price to reach this tier (COP)
  savingsPercent: number; // % saved vs base price for this increment
  isFree: boolean;
};

// ─── Configuration ──────────────────────────────────────────
const envInt = (key: string, fallback: number) => parseInt(process.env[key] || String(fallback), 10);

export const PERSONAL_FREE_LIMIT = envInt("NEXT_PUBLIC_PERSONAL_FREE_LIMIT", 20);
export const CORPORATE_FREE_LIMIT = envInt("NEXT_PUBLIC_CORPORATE_FREE_LIMIT", 2);
export const INCREMENT = 50;

// ─── COP Pricing (dynamic computation) ─────────────────────
// Same discount structure as USD: base price per block, discount every 2 blocks.
export const BASE_PRICE = envInt("NEXT_PUBLIC_BASE_PRICE_COP", 28500);
const PAIR_DISCOUNT_COP = 1500;
const MIN_PRICE_COP = envInt("NEXT_PUBLIC_MIN_PRICE_COP", 18000);
export const CORPORATE_BASE_PRICE = envInt("NEXT_PUBLIC_CORPORATE_BASE_PRICE_COP", 200000);

/** Get COP price per 50-player block at a given step (0-indexed) */
function getCopPriceAtStep(step: number): number {
  const pairIndex = Math.floor(step / 2);
  return Math.max(BASE_PRICE - pairIndex * PAIR_DISCOUNT_COP, MIN_PRICE_COP);
}

/** Cumulative COP price for a personal pool. Personal: 20(free)→50→100→150... */
function personalCumulativeCop(capacity: number): number {
  if (capacity <= PERSONAL_FREE_LIMIT) return 0;
  const target = Math.max(Math.ceil(capacity / INCREMENT) * INCREMENT, INCREMENT);
  const blocks = target / INCREMENT; // 50→1, 100→2, 150→3
  let total = 0;
  for (let step = 0; step < blocks; step++) total += getCopPriceAtStep(step);
  return total;
}

/** Cumulative COP price for a corporate pool. Corporate: 2(free)→100($200k)→150→200... */
function corporateCumulativeCop(capacity: number): number {
  if (capacity <= CORPORATE_FREE_LIMIT) return 0;
  if (capacity <= 100) return CORPORATE_BASE_PRICE;
  const target = Math.ceil(capacity / INCREMENT) * INCREMENT;
  const extraBlocks = (target - 100) / INCREMENT;
  let total = CORPORATE_BASE_PRICE;
  for (let step = 0; step < extraBlocks; step++) total += getCopPriceAtStep(step);
  return total;
}

// ─── Currency formatting ────────────────────────────────────
/**
 * Format a COP amount with Spanish (Colombia) thousands separator.
 * Example: 28000 → "$28.000"
 */
export function formatCOP(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("es-CO");
}

/**
 * Format with currency code suffix (for legal/explicit contexts).
 * Example: 28000 → "$28.000 COP"
 */
export function formatCOPWithCode(amount: number): string {
  return formatCOP(amount) + " COP";
}

// ─── Tier builders ──────────────────────────────────────────

function makeTier(cap: number, totalPrice: number, blockPrice: number, isFree: boolean): PricingTier {
  const savingsPercent = isFree || blockPrice === 0
    ? 0
    : Math.max(0, Math.round(((BASE_PRICE - blockPrice) / BASE_PRICE) * 100));
  return { maxParticipants: cap, pricePerIncrement: blockPrice, totalPrice, savingsPercent, isFree };
}

export function getPersonalTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  // Free tier
  tiers.push(makeTier(PERSONAL_FREE_LIMIT, 0, 0, true));

  // Paid tiers: 50, 100, 150, 200, ...
  let total = 0;
  let step = 0;
  for (let cap = INCREMENT; cap <= upTo; cap += INCREMENT) {
    const bp = getCopPriceAtStep(step);
    total += bp;
    tiers.push(makeTier(cap, total, bp, false));
    step++;
  }
  return tiers;
}

export function getCorporateTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  // Free trial tier
  tiers.push(makeTier(CORPORATE_FREE_LIMIT, 0, 0, true));

  // First paid tier: 100 players at base price
  if (upTo >= 100) {
    tiers.push(makeTier(100, CORPORATE_BASE_PRICE, CORPORATE_BASE_PRICE, false));
  }

  // Additional tiers: 150, 200, 250, ...
  let total = CORPORATE_BASE_PRICE;
  let step = 0;
  for (let cap = 150; cap <= upTo; cap += INCREMENT) {
    const bp = getCopPriceAtStep(step);
    total += bp;
    tiers.push(makeTier(cap, total, bp, false));
    step++;
  }
  return tiers;
}

// Calculate tier for a custom player count (rounds up to nearest 50)
export function getTierForCustomCount(
  type: PoolType,
  playerCount: number,
): PricingTier {
  const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
  if (playerCount <= freeLimit) {
    return makeTier(freeLimit, 0, 0, true);
  }

  const target = Math.ceil(playerCount / INCREMENT) * INCREMENT;
  const calc = type === "personal" ? personalCumulativeCop : corporateCumulativeCop;
  const totalPrice = calc(target);
  const prevPrice = calc(target - INCREMENT);
  const blockPrice = totalPrice - prevPrice;
  return makeTier(target, totalPrice, blockPrice, false);
}

// How much savings vs full base price
export function getFullPriceSavings(tier: PricingTier, type: PoolType): {
  savedAmount: number;
  savedPercent: number;
  fullPrice: number;
} {
  if (tier.isFree || tier.totalPrice === 0) {
    return { savedAmount: 0, savedPercent: 0, fullPrice: 0 };
  }

  if (type === "corporate") {
    // Corporate base is fixed — savings only on increments beyond 100
    const extraPlayers = tier.maxParticipants - 100;
    if (extraPlayers <= 0) {
      return { savedAmount: 0, savedPercent: 0, fullPrice: CORPORATE_BASE_PRICE };
    }
    const incrementCount = extraPlayers / INCREMENT;
    const fullExtraPrice = incrementCount * BASE_PRICE;
    const actualExtraPrice = tier.totalPrice - CORPORATE_BASE_PRICE;
    const saved = fullExtraPrice - actualExtraPrice;
    return {
      savedAmount: Math.max(0, saved),
      savedPercent:
        fullExtraPrice > 0 ? Math.round((saved / fullExtraPrice) * 100) : 0,
      fullPrice: CORPORATE_BASE_PRICE + fullExtraPrice,
    };
  }

  // Personal: count increments from 50 onward
  const incrementCount = tier.maxParticipants / INCREMENT;
  const fullPrice = incrementCount * BASE_PRICE;
  const saved = fullPrice - tier.totalPrice;
  return {
    savedAmount: Math.max(0, saved),
    savedPercent: fullPrice > 0 ? Math.round((saved / fullPrice) * 100) : 0,
    fullPrice,
  };
}

// Upgrade price from one capacity to another (COP)
export function getUpgradePrice(
  type: PoolType,
  fromCapacity: number,
  toCapacity: number,
): number {
  if (toCapacity <= fromCapacity) return 0;
  const fromTier = getTierForCustomCount(type, fromCapacity);
  const toTier = getTierForCustomCount(type, toCapacity);
  return toTier.totalPrice - fromTier.totalPrice;
}

// ═══════════════════════════════════════════════════════════════
// USD PRICING (for International / Polar payments)
// Computed from base price with volume discounts — mirrors backend logic.
// ═══════════════════════════════════════════════════════════════

export type Currency = "COP" | "USD";

const BASE_PRICE_USD = 7.99;
const PAIR_DISCOUNT_USD = 0.40;
const MIN_PRICE_USD = 4.99;
const CORPORATE_BASE_PRICE_USD = 49.99;

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function getUsdPriceAtStep(step: number): number {
  const pairIndex = Math.floor(step / 2);
  const price = roundUsd(BASE_PRICE_USD - pairIndex * PAIR_DISCOUNT_USD);
  return Math.max(price, MIN_PRICE_USD);
}

/** Format a USD amount. Example: 7.99 → "$7.99 USD" */
export function formatUSD(amount: number): string {
  return "$" + roundUsd(amount).toFixed(2) + " USD";
}

/** Format price in the given currency */
export function formatPrice(amount: number, currency: Currency): string {
  return currency === "COP" ? formatCOP(amount) : formatUSD(amount);
}

export function getPersonalTiersUsd(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  // Free tier
  tiers.push({ maxParticipants: PERSONAL_FREE_LIMIT, pricePerIncrement: 0, totalPrice: 0, savingsPercent: 0, isFree: true });

  // Paid tiers: 50, 100, 150, 200... (first block covers 20→50)
  let total = 0;
  let step = 0;
  for (let cap = INCREMENT; cap <= upTo; cap += INCREMENT) {
    const blockPrice = getUsdPriceAtStep(step);
    total = roundUsd(total + blockPrice);
    const savings = Math.round(((BASE_PRICE_USD - blockPrice) / BASE_PRICE_USD) * 100);
    tiers.push({
      maxParticipants: cap,
      pricePerIncrement: blockPrice,
      totalPrice: total,
      savingsPercent: Math.max(0, savings),
      isFree: false,
    });
    step++;
  }
  return tiers;
}

export function getCorporateTiersUsd(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  // Free trial tier (host only)
  tiers.push({
    maxParticipants: CORPORATE_FREE_LIMIT,
    pricePerIncrement: 0,
    totalPrice: 0,
    savingsPercent: 0,
    isFree: true,
  });

  // First paid tier: 100 players
  tiers.push({
    maxParticipants: 100,
    pricePerIncrement: CORPORATE_BASE_PRICE_USD,
    totalPrice: CORPORATE_BASE_PRICE_USD,
    savingsPercent: 0,
    isFree: false,
  });

  let total = CORPORATE_BASE_PRICE_USD;
  let step = 0;
  for (let cap = 150; cap <= upTo; cap += INCREMENT) {
    const blockPrice = getUsdPriceAtStep(step);
    total = roundUsd(total + blockPrice);
    const savings = Math.round(((BASE_PRICE_USD - blockPrice) / BASE_PRICE_USD) * 100);
    tiers.push({
      maxParticipants: cap,
      pricePerIncrement: blockPrice,
      totalPrice: total,
      savingsPercent: Math.max(0, savings),
      isFree: false,
    });
    step++;
  }
  return tiers;
}

/** Get tier for custom count in USD */
export function getTierForCustomCountUsd(type: PoolType, playerCount: number): PricingTier {
  const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
  if (playerCount <= freeLimit) {
    return type === "personal"
      ? getPersonalTiersUsd(PERSONAL_FREE_LIMIT)[0]!
      : getCorporateTiersUsd(CORPORATE_FREE_LIMIT)[0]!;
  }
  const target = Math.ceil(playerCount / INCREMENT) * INCREMENT;
  const tiers = type === "personal" ? getPersonalTiersUsd(target) : getCorporateTiersUsd(target);
  return tiers[tiers.length - 1]!;
}

/** Upgrade price in USD */
export function getUpgradePriceUsd(type: PoolType, fromCapacity: number, toCapacity: number): number {
  if (toCapacity <= fromCapacity) return 0;
  const fromTier = getTierForCustomCountUsd(type, fromCapacity);
  const toTier = getTierForCustomCountUsd(type, toCapacity);
  return roundUsd(toTier.totalPrice - fromTier.totalPrice);
}
