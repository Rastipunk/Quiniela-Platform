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
  1050:  438000,
  1100:  454000,
  1150:  470000,
  1200:  486000,
  1250:  502000,
  1300:  518000,
  1350:  534000,
  1400:  550000,
  1450:  566000,
  1500:  582000,
};

// Corporate tiers: 100 players included in base price, then incremental
const CORPORATE_TIER_PRICES: Record<number, number> = {
  2:     0,        // Free trial (host + 1 guest)
  100:   200000,   // First paid tier
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
  1050:  582000,
  1100:  598000,
  1150:  614000,
  1200:  630000,
  1250:  646000,
  1300:  662000,
  1350:  678000,
  1400:  694000,
  1450:  710000,
  1500:  726000,
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

  const sortedKeys = Object.keys(CORPORATE_TIER_PRICES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const cap of sortedKeys) {
    if (cap > upTo) break;
    const total = CORPORATE_TIER_PRICES[cap]!;
    const isFree = cap <= CORPORATE_FREE_LIMIT;
    if (isFree) {
      // Free trial tier (host only)
      tiers.push({
        maxParticipants: cap,
        pricePerIncrement: 0,
        totalPrice: 0,
        savingsPercent: 0,
        isFree: true,
      });
    } else {
      // Paid tiers
      tiers.push({
        maxParticipants: cap,
        pricePerIncrement: prevTotal === 0 ? total : total - prevTotal,
        totalPrice: total,
        savingsPercent: prevTotal > 0
          ? Math.max(0, Math.round(((BASE_PRICE - (total - prevTotal)) / BASE_PRICE) * 100))
          : 0,
        isFree: false,
      });
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

  let total = 0;
  let step = 0;
  for (let cap = PERSONAL_FREE_LIMIT + INCREMENT; cap <= upTo; cap += INCREMENT) {
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
