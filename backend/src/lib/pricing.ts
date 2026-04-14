/**
 * Pricing Library (Backend)
 *
 * Server-side pricing calculations for pool capacity upgrades.
 * Prices are in USD. The client NEVER sends the price — it's always
 * computed here from the target capacity.
 *
 * Pricing model:
 * - Personal: free up to 20, then $7.99/block of 50, declining by $0.40
 *   every 2 blocks, minimum $4.99/block
 * - Corporate: $49.99 base for 100, then same block pricing as personal
 */

export type PoolType = "personal" | "corporate";

// ── Configuration (env-overridable) ────────────────────────────

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const envFloat = (key: string, fallback: number): number =>
  parseFloat(process.env[key] || String(fallback));

/** Free participant limits */
export const PERSONAL_FREE_LIMIT = envInt("PERSONAL_FREE_LIMIT", 20);
export const CORPORATE_FREE_LIMIT = envInt("CORPORATE_FREE_LIMIT", 100);

/** Block size for capacity increments */
export const INCREMENT = 50;

/** Base price per 50-player block (USD) */
export const BASE_PRICE_USD = envFloat("BASE_PRICE_USD", 7.99);

/** Discount applied every 2 blocks */
const PAIR_DISCOUNT = 0.40;

/** Minimum price per block (USD) */
const MIN_PRICE_USD = envFloat("MIN_PRICE_USD", 4.99);

/** Corporate base price for 100 players (USD) */
export const CORPORATE_BASE_PRICE_USD = envFloat("CORPORATE_BASE_PRICE_USD", 49.99);

// ── Price calculation ──────────────────────────────────────────

/** Round to 2 decimal places */
function roundPrice(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Get the price per 50-player block at a given step (0-indexed) */
function getPriceAtStep(step: number): number {
  const pairIndex = Math.floor(step / 2);
  const price = roundPrice(BASE_PRICE_USD - pairIndex * PAIR_DISCOUNT);
  return Math.max(price, MIN_PRICE_USD);
}

/** Calculate cumulative price for a personal pool at a given capacity */
function personalCumulativePrice(capacity: number): number {
  if (capacity <= PERSONAL_FREE_LIMIT) return 0;

  // Round up to nearest INCREMENT
  const target = Math.ceil(capacity / INCREMENT) * INCREMENT;
  const blocks = (target - PERSONAL_FREE_LIMIT) / INCREMENT;

  let total = 0;
  for (let step = 0; step < blocks; step++) {
    total = roundPrice(total + getPriceAtStep(step));
  }
  return total;
}

/** Calculate cumulative price for a corporate pool at a given capacity */
function corporateCumulativePrice(capacity: number): number {
  // Corporate free limit (100 players) is genuinely free
  if (capacity <= CORPORATE_FREE_LIMIT) return 0;

  // Any expansion beyond free limit incurs the base price + block increments
  // Round up to nearest INCREMENT
  const target = Math.ceil(capacity / INCREMENT) * INCREMENT;
  const extraBlocks = (target - CORPORATE_FREE_LIMIT) / INCREMENT;

  let total = CORPORATE_BASE_PRICE_USD;
  for (let step = 0; step < extraBlocks; step++) {
    total = roundPrice(total + getPriceAtStep(step));
  }
  return total;
}

// ── Public API ─────────────────────────────────────────────────

/** Check if a capacity is within the free limit for a pool type */
export function isWithinFreeLimit(type: PoolType, capacity: number): boolean {
  const limit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
  return capacity <= limit;
}

/** Get the free limit for a pool type */
export function getFreeLimit(type: PoolType): number {
  return type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
}

/**
 * Calculate the total price in USD for a given capacity.
 * Returns 0 for free-tier capacities.
 */
export function calculateTotalPrice(type: PoolType, capacity: number): number {
  if (type === "personal") return personalCumulativePrice(capacity);
  return corporateCumulativePrice(capacity);
}

/**
 * Calculate the upgrade price from one capacity to another (USD).
 * This is the incremental cost, not the total cost.
 */
export function calculateUpgradePrice(
  type: PoolType,
  fromCapacity: number,
  toCapacity: number,
): number {
  if (toCapacity <= fromCapacity) return 0;
  const fromPrice = calculateTotalPrice(type, fromCapacity);
  const toPrice = calculateTotalPrice(type, toCapacity);
  return roundPrice(toPrice - fromPrice);
}

/**
 * Convert USD amount to cents (for Polar API).
 * Example: 7.99 → 799
 */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

// ═══════════════════════════════════════════════════════════════
// COP PRICING (for Wompi / Colombia)
// Fixed table with clean rounded numbers — NOT converted from USD
// ═══════════════════════════════════════════════════════════════

const PERSONAL_COP_PRICES: Record<number, number> = {
  20:    0,
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

const CORPORATE_COP_PRICES: Record<number, number> = {
  100:   200000,
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

/** Get COP price from the fixed table. Rounds up to nearest tier. */
function getCopPrice(type: PoolType, capacity: number): number {
  const table = type === "personal" ? PERSONAL_COP_PRICES : CORPORATE_COP_PRICES;
  const target = Math.ceil(capacity / INCREMENT) * INCREMENT;
  const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;

  // If within free limit
  if (capacity <= freeLimit) return type === "corporate" ? CORPORATE_COP_PRICES[100]! : 0;

  return table[target] ?? table[Math.max(...Object.keys(table).map(Number).filter(k => k <= target))] ?? 0;
}

/**
 * Calculate the upgrade price in COP from one capacity to another.
 * Uses the fixed COP table — NOT converted from USD.
 */
export function calculateUpgradePriceCop(
  type: PoolType,
  fromCapacity: number,
  toCapacity: number,
): number {
  if (toCapacity <= fromCapacity) return 0;
  const fromPrice = getCopPrice(type, fromCapacity);
  const toPrice = getCopPrice(type, toCapacity);
  return toPrice - fromPrice;
}

/**
 * Check if a capacity requires payment and return the amount.
 */
export function validateCapacityRequiresPayment(
  type: PoolType,
  fromCapacity: number,
  toCapacity: number,
): { required: boolean; amountUsd: number; amountCents: number } {
  const amountUsd = calculateUpgradePrice(type, fromCapacity, toCapacity);
  return {
    required: amountUsd > 0,
    amountUsd,
    amountCents: usdToCents(amountUsd),
  };
}
