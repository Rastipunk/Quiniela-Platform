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
export const CORPORATE_FREE_LIMIT = envInt("NEXT_PUBLIC_CORPORATE_FREE_LIMIT", 100);
export const INCREMENT = 50;

// Base price per 50-player increment in COP (used as reference for savings %)
export const BASE_PRICE = envInt("NEXT_PUBLIC_BASE_PRICE_COP", 28000);

// Corporate base: 100 players included
export const CORPORATE_BASE_PRICE = envInt("NEXT_PUBLIC_CORPORATE_BASE_PRICE_COP", 200000);

// ─── Tier tables (cumulative prices in COP, rounded to thousand) ───
//
// Personal tiers: starts free at 20, then cumulative price for each 50-block
// Pattern: discount applied in pairs of 50 (every 100 added players, price per block drops)
const PERSONAL_TIER_PRICES: Record<number, number> = {
  20:    0,        // FREE
  50:    28000,
  100:   56000,
  150:   82000,
  200:   109000,
  250:   133000,
  300:   158000,
  350:   181000,
  400:   204000,
  450:   226000,
  500:   248000,
  550:   268000,
  600:   288000,
  650:   306000,
  700:   324000,
  750:   341000,
  800:   358000,
  850:   374000,
  900:   390000,
  950:   406000,
  1000:  422000,
};

// Corporate tiers: 100 players included in base price, then incremental
const CORPORATE_TIER_PRICES: Record<number, number> = {
  100:   200000,   // base
  150:   226000,
  200:   253000,
  250:   277000,
  300:   302000,
  350:   325000,
  400:   349000,
  450:   370000,
  500:   392000,
  550:   412000,
  600:   432000,
  650:   450000,
  700:   468000,
  750:   485000,
  800:   502000,
  850:   518000,
  900:   534000,
  950:   550000,
  1000:  566000,
};

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
function buildTier(
  maxParticipants: number,
  totalPrice: number,
  prevTotal: number,
  isFree = false
): PricingTier {
  const pricePerIncrement = isFree ? 0 : totalPrice - prevTotal;
  // Compare against base price to compute savings %
  const savingsPercent =
    isFree || pricePerIncrement === 0
      ? 0
      : Math.round(((BASE_PRICE - pricePerIncrement) / BASE_PRICE) * 100);
  return {
    maxParticipants,
    pricePerIncrement,
    totalPrice,
    savingsPercent: Math.max(0, savingsPercent),
    isFree,
  };
}

export function getPersonalTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  let prevTotal = 0;

  const sortedKeys = Object.keys(PERSONAL_TIER_PRICES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const cap of sortedKeys) {
    if (cap > upTo) break;
    const total = PERSONAL_TIER_PRICES[cap]!;
    const isFree = cap === PERSONAL_FREE_LIMIT;
    tiers.push(buildTier(cap, total, prevTotal, isFree));
    prevTotal = total;
  }

  return tiers;
}

export function getCorporateTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];
  let prevTotal = 0;
  let isFirst = true;

  const sortedKeys = Object.keys(CORPORATE_TIER_PRICES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const cap of sortedKeys) {
    if (cap > upTo) break;
    const total = CORPORATE_TIER_PRICES[cap]!;
    if (isFirst) {
      // The base 100-tier is paid but shown without an "increment"
      tiers.push({
        maxParticipants: cap,
        pricePerIncrement: total,
        totalPrice: total,
        savingsPercent: 0,
        isFree: false,
      });
      isFirst = false;
    } else {
      tiers.push(buildTier(cap, total, prevTotal, false));
    }
    prevTotal = total;
  }

  return tiers;
}

// Calculate tier for a custom player count (rounds up to nearest 50)
export function getTierForCustomCount(
  type: PoolType,
  playerCount: number,
): PricingTier {
  const freeLimit =
    type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;

  if (playerCount <= freeLimit) {
    return type === "personal"
      ? getPersonalTiers(PERSONAL_FREE_LIMIT)[0]!
      : getCorporateTiers(CORPORATE_FREE_LIMIT)[0]!;
  }

  // Round up to nearest 50
  const target = Math.ceil(playerCount / INCREMENT) * INCREMENT;
  const tiers =
    type === "personal"
      ? getPersonalTiers(target)
      : getCorporateTiers(target);
  return tiers[tiers.length - 1]!;
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
    const extraPlayers = tier.maxParticipants - CORPORATE_FREE_LIMIT;
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
  const incrementCount = (tier.maxParticipants - PERSONAL_FREE_LIMIT) / INCREMENT;
  const fullPrice = incrementCount * BASE_PRICE;
  const saved = fullPrice - tier.totalPrice;
  return {
    savedAmount: Math.max(0, saved),
    savedPercent: fullPrice > 0 ? Math.round((saved / fullPrice) * 100) : 0,
    fullPrice,
  };
}

// Upgrade price from one capacity to another
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
