/**
 * Polar.sh API Client
 *
 * Thin wrapper around the @polar-sh/sdk for creating checkout sessions
 * and querying order status. All payment business logic lives in
 * paymentService.ts — this file is only the API communication layer.
 */

import { Polar } from "@polar-sh/sdk";

// ── Configuration ──────────────────────────────────────────────

const POLAR_API_KEY = (): string => process.env.POLAR_API_KEY || "";
const POLAR_PRODUCT_ID = (): string => process.env.POLAR_PRODUCT_ID || "";

let _client: Polar | null = null;

function getClient(): Polar {
  if (!_client) {
    const key = POLAR_API_KEY();
    if (!key) throw new Error("POLAR_API_KEY not configured");
    _client = new Polar({ accessToken: key });
  }
  return _client;
}

/** Check if Polar is configured (API key + product ID present) */
export function isPolarConfigured(): boolean {
  return !!POLAR_API_KEY() && !!POLAR_PRODUCT_ID();
}

// ── Types ──────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  /** Amount in USD cents (e.g. 799 = $7.99) */
  amountCents: number;
  /** Customer email (pre-fills checkout form) */
  customerEmail: string;
  /** URL to redirect after successful payment */
  successUrl: string;
  /** URL for the back/cancel button */
  cancelUrl: string;
  /** Locale for checkout page (e.g. "es", "en", "pt") */
  locale?: string;
  /** Metadata passed through to the order (for webhook processing) */
  metadata: {
    poolId: string;
    userId: string;
    fromCapacity: number;
    toCapacity: number;
    poolType: "personal" | "corporate";
  };
}

export interface CheckoutResult {
  checkoutId: string;
  checkoutUrl: string;
}

// ── API Methods ────────────────────────────────────────────────

/**
 * Create a checkout session on Polar with an ad-hoc price.
 * Returns the checkout ID and URL for redirecting the user.
 */
export async function createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
  const client = getClient();
  const productId = POLAR_PRODUCT_ID();
  if (!productId) throw new Error("POLAR_PRODUCT_ID not configured");

  console.log(`[Polar] Creating checkout: product=${productId}, amount=${params.amountCents} cents, metadata=${JSON.stringify(params.metadata)}`);

  const checkout = await client.checkouts.create({
    products: [productId],
    prices: {
      [productId]: [
        {
          amountType: "fixed" as const,
          priceAmount: params.amountCents,
          priceCurrency: "usd",
        },
      ],
    },
    customerEmail: params.customerEmail,
    successUrl: params.successUrl,
    // Polar's SDK calls this `returnUrl` ("when set, a back button will be
    // shown in the checkout to return to this URL") — semantically the
    // cancel/back URL. Without it, users who back out of Polar's page
    // land on polar.sh's default, not picks4all.com/pago/cancelado, and
    // we lose the cancel-tracking signal entirely (F-2).
    returnUrl: params.cancelUrl,
    metadata: params.metadata as unknown as Record<string, string>,
    ...(params.locale ? { locale: params.locale } : {}),
  });

  console.log(`[Polar] Checkout created: id=${checkout.id}, amount=${checkout.amount}, url=${checkout.url?.slice(0, 50)}...`);

  if (!checkout.url) {
    throw new Error("Polar checkout created but no URL returned");
  }

  return {
    checkoutId: checkout.id,
    checkoutUrl: checkout.url,
  };
}

/**
 * Get a checkout session by ID (for status polling).
 */
export async function getCheckoutSession(checkoutId: string) {
  const client = getClient();
  return client.checkouts.get({ id: checkoutId });
}

/**
 * Get an order by ID (for verification after webhook).
 */
export async function getOrder(orderId: string) {
  const client = getClient();
  return client.orders.get({ id: orderId });
}
