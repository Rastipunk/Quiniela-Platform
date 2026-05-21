/**
 * Payment event taxonomy.
 *
 * Single source of truth for `PaymentEvent.source` and the `eventType`
 * tokens we emit. Strings live here so a typo is a TypeScript error
 * rather than a silent fall-through that pollutes the audit log.
 *
 * See:
 *   - `prisma/schema.prisma` (PaymentEvent model docstring) for the
 *     persistence contract.
 *   - `POLAR_AUDIT.md` §3 F-3, F-13, F-17, F-19 for the rationale.
 *   - `docs/DECISION_LOG.md` ADR-060 for the observability backbone.
 */

// ── Source discriminator ───────────────────────────────────────────────

/**
 * Origin of a PaymentEvent row. Persisted as TEXT (not a Postgres enum)
 * so adding a new source is an additive change at the application layer
 * — no migration required. Every code path that writes a PaymentEvent
 * MUST pass exactly one of these values.
 */
export const PAYMENT_EVENT_SOURCE = {
  /** Received from Polar's signed webhook delivery. */
  POLAR_WEBHOOK: "POLAR_WEBHOOK",
  /** Received from Mercado Pago IPN. */
  MP_WEBHOOK: "MP_WEBHOOK",
  /** Beacon from the browser (redirect lifecycle, user cancel, errors). */
  CLIENT: "CLIENT",
  /** Written by the periodic reconciliation job. */
  RECONCILER: "RECONCILER",
  /** Internal state transition that isn't tied to a webhook. */
  SERVER: "SERVER",
} as const;

export type PaymentEventSource =
  (typeof PAYMENT_EVENT_SOURCE)[keyof typeof PAYMENT_EVENT_SOURCE];

// ── Client beacon eventType taxonomy ───────────────────────────────────

/**
 * Events the browser can POST to /payments/attempts/:paymentId/event.
 *
 * Lifecycle:
 *   1. Frontend gets the checkout URL from /payments/checkout.
 *   2. Just before `window.location.href = url`, emit REDIRECT_INITIATED.
 *   3. If the redirect throws (CSP, popup blocker, etc.), emit
 *      REDIRECT_FAILED inside the catch.
 *   4. If the user lands on /pago/cancelado, that page emits
 *      USER_CANCELLED before showing the cancel UI.
 *   5. Any other client-side fetch error during the flow emits
 *      CLIENT_ERROR with the message.
 *
 * Without these breadcrumbs we cannot distinguish "user gave up on
 * Polar's page" from "our redirect never executed" from "the user closed
 * the tab during the round-trip". See POLAR_AUDIT.md G-1, G-2, G-3.
 */
export const CLIENT_EVENT_TYPE = {
  REDIRECT_INITIATED: "REDIRECT_INITIATED",
  REDIRECT_FAILED: "REDIRECT_FAILED",
  USER_CANCELLED: "USER_CANCELLED",
  CLIENT_ERROR: "CLIENT_ERROR",
} as const;

export type ClientEventType =
  (typeof CLIENT_EVENT_TYPE)[keyof typeof CLIENT_EVENT_TYPE];

export const CLIENT_EVENT_TYPES: readonly ClientEventType[] = Object.values(
  CLIENT_EVENT_TYPE,
);

// ── Reconciler eventType taxonomy ──────────────────────────────────────

/**
 * Events produced by the periodic reconciliation job. Each one records
 * a decision the reconciler made based on querying Polar/MP and the
 * local PoolPayment state.
 */
export const RECONCILER_EVENT_TYPE = {
  /** PoolPayment was in PENDING/INITIATED past the abandon threshold
   *  and the gateway had no signal we'd missed. Marked ABANDONED. */
  ABANDONED: "RECONCILER_ABANDONED",
  /** Gateway told us the checkout expired. Marked EXPIRED. */
  EXPIRED: "RECONCILER_EXPIRED",
  /** Gateway told us the payment actually succeeded but we never got
   *  the webhook. Replayed the success path. */
  RESCUED: "RECONCILER_RESCUED",
  /** Reconciler ran on the row and decided to leave it alone (e.g.
   *  the row was already COMPLETED). Logged for audit completeness. */
  NOOP: "RECONCILER_NOOP",
} as const;

// ── Server-issued eventType (state transitions) ────────────────────────

export const SERVER_EVENT_TYPE = {
  /** A PoolPayment row transitioned from one PaymentStatus to another
   *  outside of a webhook (e.g. INITIATED→PENDING after a successful
   *  Polar create call). Body carries `{ from, to, reason }`. */
  STATUS_TRANSITION: "STATUS_TRANSITION",
} as const;
