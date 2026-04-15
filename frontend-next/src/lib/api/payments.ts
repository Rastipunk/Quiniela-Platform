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
 * Prepare Mercado Pago Payment Brick checkout data (Colombia/COP).
 */
export async function createMpCheckout(
  poolId: string,
  targetCapacity: number,
): Promise<MpCheckoutResponse> {
  return requestJson<MpCheckoutResponse>("/payments/mp-checkout", {
    method: "POST",
    body: JSON.stringify({ poolId, targetCapacity }),
  });
}

export interface MpCheckoutResponse {
  publicKey: string;
  paymentId: string;
  amountCop: number;
  reference: string;
  poolId: string;
  preferenceId: string;
}

/**
 * Process payment from Payment Brick data.
 * Sends the Brick's native formData directly — the backend enriches
 * it with server-side values and forwards to the MP Payment API.
 */
export async function processMpPayment(
  paymentId: string,
  formData: Record<string, unknown>,
): Promise<{ status: string; mpPaymentId: number }> {
  return requestJson<{ status: string; mpPaymentId: number }>("/payments/mp-process", {
    method: "POST",
    body: JSON.stringify({ paymentId, formData }),
  });
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
