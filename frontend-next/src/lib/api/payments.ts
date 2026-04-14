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
 * Create a Polar checkout session for a pool capacity upgrade.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckout(
  token: string,
  poolId: string,
  targetCapacity: number,
): Promise<CheckoutResponse> {
  return requestJson<CheckoutResponse>("/payments/checkout", {
    method: "POST",
    headers: { Cookie: `p4a_token=${token}` },
    body: JSON.stringify({ poolId, targetCapacity }),
  });
}

/**
 * Get the latest payment status for a pool.
 * Used for polling after checkout redirect.
 */
export async function getPaymentStatus(
  token: string,
  poolId: string,
): Promise<PaymentStatusResponse> {
  return requestJson<PaymentStatusResponse>(`/payments/pool/${poolId}/status`, {
    headers: { Cookie: `p4a_token=${token}` },
  });
}
