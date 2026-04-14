/**
 * Payment API Client
 *
 * Frontend functions for pool capacity checkout and status polling.
 */

import { requestJson } from "./client";

export interface CheckoutResponse {
  checkoutUrl: string;
  paymentId: string;
  amountUsd: number;
}

export interface PaymentStatusResponse {
  status: "NONE" | "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  fromCapacity?: number;
  toCapacity?: number;
  amountUsd?: number;
  paidAtUtc?: string | null;
}

/** Cache the country result so we don't call the API on every checkout */
let _cachedCountry: string | null = null;

/**
 * Detect user's country for gateway routing.
 * Uses ipapi.co (free, no API key, CORS-enabled).
 * Returns "CO" for Colombia, "US" for US, etc.
 */
export async function getPaymentCountry(): Promise<string> {
  if (_cachedCountry) return _cachedCountry;

  try {
    const res = await fetch("https://ipapi.co/country_code/", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const code = (await res.text()).trim();
      if (/^[A-Z]{2}$/.test(code)) {
        _cachedCountry = code;
        return code;
      }
    }
  } catch { /* fallback below */ }

  return "US";
}

/**
 * Create a Polar checkout session for a pool capacity upgrade.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckout(
  poolId: string,
  targetCapacity: number,
): Promise<CheckoutResponse> {
  return requestJson<CheckoutResponse>("/payments/checkout", {
    method: "POST",
    body: JSON.stringify({ poolId, targetCapacity }),
  });
}

/**
 * Create a Wompi checkout session (Colombia/COP).
 * Returns widget initialization data.
 */
export async function createWompiCheckout(
  poolId: string,
  targetCapacity: number,
): Promise<WompiCheckoutResponse> {
  return requestJson<WompiCheckoutResponse>("/payments/wompi-checkout", {
    method: "POST",
    body: JSON.stringify({ poolId, targetCapacity }),
  });
}

export interface WompiCheckoutResponse {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  integritySignature: string;
  redirectUrl: string;
  paymentId: string;
}

/**
 * Get the latest payment status for a pool.
 * Used for polling after checkout redirect.
 */
export async function getPaymentStatus(
  poolId: string,
): Promise<PaymentStatusResponse> {
  return requestJson<PaymentStatusResponse>(`/payments/pool/${poolId}/status`);
}
