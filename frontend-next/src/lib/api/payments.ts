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

/**
 * Detect user's country from Cloudflare geolocation.
 * Returns "CO" for Colombia, "US" for US, etc.
 */
export async function getPaymentCountry(): Promise<string> {
  try {
    const res = await requestJson<{ country: string }>("/payments/country");
    return res.country;
  } catch {
    return "US"; // fallback to international
  }
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
