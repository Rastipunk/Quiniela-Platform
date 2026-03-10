// Pricing utility for pool capacity tiers
// Pattern: pairs of 50-player increments at the same price, dropping $0.40 per pair
// Minimum price per 50: $3.99

export type PoolType = "personal" | "corporate";

export type PricingTier = {
  maxParticipants: number;
  pricePerIncrement: number; // price for this 50-player block
  totalPrice: number; // cumulative price to reach this tier
  savingsPercent: number; // % saved vs base price ($6.99) for this increment
  isFree: boolean;
};

const PERSONAL_FREE_LIMIT = 20;
const CORPORATE_FREE_LIMIT = 100;
const INCREMENT = 50;
const BASE_PRICE = 6.99;
const PAIR_DISCOUNT = 0.4;
const MIN_PRICE = 3.99;
const CORPORATE_BASE_PRICE = 49.99;

function roundPrice(n: number): number {
  return Math.round(n * 100) / 100;
}

// Returns the price per 50-player increment at a given step (0-indexed from the first paid tier)
function getPriceAtStep(step: number): number {
  // Steps 0,1 = $6.99 (pair 1)
  // Steps 2,3 = $6.59 (pair 2)
  // Steps 4,5 = $6.19 (pair 3)
  // etc.
  const pairIndex = Math.floor(step / 2);
  const price = roundPrice(BASE_PRICE - pairIndex * PAIR_DISCOUNT);
  return Math.max(price, MIN_PRICE);
}

export function getPersonalTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];

  // Free tier
  tiers.push({
    maxParticipants: PERSONAL_FREE_LIMIT,
    pricePerIncrement: 0,
    totalPrice: 0,
    savingsPercent: 0,
    isFree: true,
  });

  let cumulative = 0;
  let step = 0;
  for (let players = 50; players <= upTo; players += INCREMENT) {
    const price = getPriceAtStep(step);
    cumulative = roundPrice(cumulative + price);
    const savings =
      step >= 2 ? roundPrice(((BASE_PRICE - price) / BASE_PRICE) * 100) : 0;
    tiers.push({
      maxParticipants: players,
      pricePerIncrement: price,
      totalPrice: cumulative,
      savingsPercent: Math.round(savings),
      isFree: false,
    });
    step++;
  }

  return tiers;
}

export function getCorporateTiers(upTo = 300): PricingTier[] {
  const tiers: PricingTier[] = [];

  // Corporate base: 100 players included in $49.99
  tiers.push({
    maxParticipants: CORPORATE_FREE_LIMIT,
    pricePerIncrement: CORPORATE_BASE_PRICE,
    totalPrice: CORPORATE_BASE_PRICE,
    savingsPercent: 0,
    isFree: false, // corporate base is paid but shown as default
  });

  // Beyond 100, use personal pricing starting from step 2 (100→150 is same as personal step 2)
  let cumulative = CORPORATE_BASE_PRICE;
  let step = 2; // personal steps 0,1 cover 50,100 — corporate starts at step 2
  for (let players = 150; players <= upTo; players += INCREMENT) {
    const price = getPriceAtStep(step);
    cumulative = roundPrice(cumulative + price);
    const savings =
      step >= 2 ? roundPrice(((BASE_PRICE - price) / BASE_PRICE) * 100) : 0;
    tiers.push({
      maxParticipants: players,
      pricePerIncrement: price,
      totalPrice: cumulative,
      savingsPercent: Math.round(savings),
      isFree: false,
    });
    step++;
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

// How much savings vs if everything were at base price ($6.99/50)
export function getFullPriceSavings(tier: PricingTier, type: PoolType): {
  savedAmount: number;
  savedPercent: number;
  fullPrice: number;
} {
  if (tier.isFree || tier.totalPrice === 0) {
    return { savedAmount: 0, savedPercent: 0, fullPrice: 0 };
  }

  const freeLimit =
    type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;

  if (type === "corporate") {
    // Corporate base is fixed $49.99 — savings only on increments beyond 100
    const extraPlayers = tier.maxParticipants - CORPORATE_FREE_LIMIT;
    if (extraPlayers <= 0) {
      return { savedAmount: 0, savedPercent: 0, fullPrice: CORPORATE_BASE_PRICE };
    }
    const incrementCount = extraPlayers / INCREMENT;
    const fullExtraPrice = roundPrice(incrementCount * BASE_PRICE);
    const actualExtraPrice = roundPrice(tier.totalPrice - CORPORATE_BASE_PRICE);
    const saved = roundPrice(fullExtraPrice - actualExtraPrice);
    return {
      savedAmount: Math.max(0, saved),
      savedPercent:
        fullExtraPrice > 0 ? Math.round((saved / fullExtraPrice) * 100) : 0,
      fullPrice: roundPrice(CORPORATE_BASE_PRICE + fullExtraPrice),
    };
  }

  // Personal: count increments from 50 onward
  const incrementCount = (tier.maxParticipants - PERSONAL_FREE_LIMIT) / INCREMENT;
  const fullPrice = roundPrice(incrementCount * BASE_PRICE);
  const saved = roundPrice(fullPrice - tier.totalPrice);
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
  return roundPrice(toTier.totalPrice - fromTier.totalPrice);
}

export {
  PERSONAL_FREE_LIMIT,
  CORPORATE_FREE_LIMIT,
  CORPORATE_BASE_PRICE,
  BASE_PRICE,
  INCREMENT,
};
