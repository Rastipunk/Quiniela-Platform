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
export const CORPORATE_FREE_LIMIT = envInt("CORPORATE_FREE_LIMIT", 2);

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
// COP PRICING (for Mercado Pago / Colombia)
// Dynamic computation with progressive volume discounts.
// Same structure as USD: base price per block, discount every 2 blocks.
// ═══════════════════════════════════════════════════════════════

const BASE_PRICE_COP = envInt("BASE_PRICE_COP", 28500);
const PAIR_DISCOUNT_COP = 1500;
const MIN_PRICE_COP = envInt("MIN_PRICE_COP", 18000);
const CORPORATE_BASE_PRICE_COP = envInt("CORPORATE_BASE_PRICE_COP", 200000);

/** Get the COP price per 50-player block at a given step (0-indexed) */
function getCopPriceAtStep(step: number): number {
  const pairIndex = Math.floor(step / 2);
  const price = BASE_PRICE_COP - pairIndex * PAIR_DISCOUNT_COP;
  return Math.max(price, MIN_PRICE_COP);
}

/** Calculate cumulative COP price for a personal pool */
function personalCumulativePriceCop(capacity: number): number {
  if (capacity <= PERSONAL_FREE_LIMIT) return 0;

  // Personal tiers: 20→50 (first block), then +50 each
  // First block covers 20→50 (30 players) at base price
  const target = Math.max(Math.ceil(capacity / INCREMENT) * INCREMENT, INCREMENT);
  // Number of blocks: 50 is step 0, 100 is step 1, 150 is step 2, etc.
  const blocks = target / INCREMENT; // e.g. 50→1, 100→2, 150→3

  let total = 0;
  for (let step = 0; step < blocks; step++) {
    total += getCopPriceAtStep(step);
  }
  return total;
}

/** Calculate cumulative COP price for a corporate pool */
function corporateCumulativePriceCop(capacity: number): number {
  if (capacity <= CORPORATE_FREE_LIMIT) return 0;

  // Corporate: base price for 100 players, then +50 blocks from 150
  if (capacity <= 100) return CORPORATE_BASE_PRICE_COP;

  const target = Math.ceil(capacity / INCREMENT) * INCREMENT;
  const extraBlocks = (target - 100) / INCREMENT; // blocks beyond 100

  let total = CORPORATE_BASE_PRICE_COP;
  for (let step = 0; step < extraBlocks; step++) {
    total += getCopPriceAtStep(step);
  }
  return total;
}

/**
 * Calculate the upgrade price in COP from one capacity to another.
 * Uses dynamic computation — works for any capacity.
 */
export function calculateUpgradePriceCop(
  type: PoolType,
  fromCapacity: number,
  toCapacity: number,
): number {
  if (toCapacity <= fromCapacity) return 0;
  const calc = type === "personal" ? personalCumulativePriceCop : corporateCumulativePriceCop;
  return calc(toCapacity) - calc(fromCapacity);
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
