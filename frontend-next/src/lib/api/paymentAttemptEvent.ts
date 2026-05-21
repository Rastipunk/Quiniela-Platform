/**
 * Client-side beacons for the payment-attempt lifecycle (F-13).
 *
 * Lets the browser tell the backend what actually happened during the
 * redirect round-trip — something the backend cannot infer from
 * webhooks alone. The four event types persist as PaymentEvent rows
 * with `source=CLIENT`:
 *
 *   - REDIRECT_INITIATED — fired immediately before `window.location.href`
 *     assigns the gateway URL. Closes the gap between "we got a URL"
 *     and "the browser actually navigated".
 *   - REDIRECT_FAILED    — fired if the `window.location.href` assignment
 *     throws synchronously (rare: CSP, popup blocker, sandboxed iframe).
 *   - USER_CANCELLED     — fired by /pago/cancelado on mount.
 *   - CLIENT_ERROR       — fired from any catch block during the flow.
 *
 * All four are non-blocking: failures to deliver the beacon must not
 * affect the user-visible flow. We swallow errors silently — losing a
 * beacon is acceptable; failing the payment because we couldn't write
 * an audit row would be the worse outcome.
 *
 * See backend `recordClientEvent` in `services/paymentService.ts`.
 */

import { requestJson } from "./client";

export type ClientEventType =
  | "REDIRECT_INITIATED"
  | "REDIRECT_FAILED"
  | "USER_CANCELLED"
  | "CLIENT_ERROR";

export interface PaymentAttemptEventBody {
  eventType: ClientEventType;
  /** Optional structured detail — error message, attempted URL, browser
   *  metadata, anything the frontend wants persisted for forensics. */
  details?: Record<string, unknown>;
}

/**
 * Send a client beacon for a PoolPayment attempt. Best-effort — the
 * promise always resolves, never rejects. Caller should NOT await this
 * blocking-style (use fire-and-forget) so a slow backend doesn't stall
 * the redirect or the cancel-page render.
 */
export async function reportPaymentAttemptEvent(
  paymentId: string,
  body: PaymentAttemptEventBody,
): Promise<void> {
  if (!paymentId) return; // can't audit without an id; silently noop
  try {
    await requestJson(`/payments/attempts/${paymentId}/event`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    // Beacon failures are non-fatal. We do not log or surface them —
    // the user is in the middle of a payment flow and a noisy console
    // would confuse rather than help. Server-side logs of the missing
    // beacon would surface only if needed during a deeper audit.
  }
}
