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

import { API_BASE, requestJson } from "./client";

export type ClientEventType =
  | "REDIRECT_INITIATED"
  | "REDIRECT_FAILED"
  | "USER_CANCELLED"
  | "CLIENT_ERROR"
  | "BRICK_LOADED"
  | "BRICK_ERROR"
  | "USER_CLOSED_TAB";

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

/**
 * Send a client beacon synchronously via navigator.sendBeacon — the
 * only transport guaranteed to flush after page unload. Use this from
 * `beforeunload` / `pagehide` handlers where a normal `fetch()` would
 * be cancelled by the browser as the page tears down.
 *
 * For normal in-flow telemetry (REDIRECT_INITIATED, BRICK_LOADED,
 * USER_CANCELLED on a button click, etc.) keep using
 * `reportPaymentAttemptEvent` — it can await the response and surface
 * errors during development.
 *
 * Content-Type is forced to `text/plain` (a Blob with that MIME) so
 * the request is a CORS "simple request" — no preflight that would
 * race the unload. The backend route at
 * `POST /payments/attempts/:paymentId/event` has a `text/plain` body
 * parser specifically for this (see commit e705992).
 *
 * Returns true if the browser queued the beacon, false otherwise
 * (no navigator, no sendBeacon, oversized payload, or
 * browser shutting down). All failures are silent — losing one
 * beacon is acceptable; throwing during unload is not.
 */
export function reportPaymentAttemptEventBeacon(
  paymentId: string,
  body: PaymentAttemptEventBody,
): boolean {
  if (!paymentId) return false;
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }
  const url = `${API_BASE}/payments/attempts/${paymentId}/event`;
  let blob: Blob;
  try {
    blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
  } catch {
    return false;
  }
  try {
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}
