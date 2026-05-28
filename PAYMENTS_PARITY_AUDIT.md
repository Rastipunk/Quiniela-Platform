# Payments Parity — Polar vs Mercado Pago — Audit

> Diagnostic document. NO implementation yet — this is the "what's missing" map. Every claim is a file:line citation, zero assumptions.
>
> Owner asked on 2026-05-26 for a forensic comparison after suspecting MP has gaps vs Polar. Investigation confirmed: **5 real gaps in MP**, 1 symmetric gap in both. This doc inventories them so the team can decide priority and scope a remediation cycle.

---

## 1. Methodology

- Investigated 10 dimensions of the payment flow on both gateways.
- Every claim cites file:line in `backend/src/services/paymentService.ts` or related files.
- "GAP" means a feature exists on Polar but not on MP (or vice versa).
- "SYMMETRIC" means both gateways implement the feature equivalently.
- "ABSENT ON BOTH" is flagged separately — not gaps between the two, but possible improvements.

The full evidence table is in §10 below.

## 2. Architecture context

Both gateways share the same `PoolPayment` table, the same audit log (`PaymentEvent`), and the same downstream effects (Pool.maxParticipants update, CC redemption flip, GA4/CAPI fan-out, receipt email). The split is at the routing layer:

- **Colombia (CF-IPCountry=CO)** → Mercado Pago (COP)
- **Rest of world** → Polar.sh (USD)

Each gateway has its own webhook handler, its own initiation function, and its own reconciler — or in MP's case, **no reconciler at all** (§7).

The fundamental asymmetry that drives several gaps: **Polar always confirms via webhook (single path); MP has TWO success paths — synchronous via the Payment Brick + asynchronous via IPN webhook.** When the synchronous path succeeds first (the common case), it should do everything the Polar webhook does. Today it doesn't.

## 3. The 5 gaps in Mercado Pago (with verified evidence)

### Gap 1: 🔴 No receipt email on MP synchronous-path completion

When `POST /payments/mp-process` returns `approved` from the Payment Brick, the handler updates `PoolPayment.status = COMPLETED` and expands the pool, but **does NOT call `sendPaymentReceiptEmail`**.

- **Polar:** `paymentService.ts:832` — `sendPaymentReceiptEmail` fired inside `handleOrderPaid` via `fireAndForget`.
- **MP sync (Brick):** `paymentService.ts:1902-2076` — Receipt email **absent**. No call to `sendPaymentReceiptEmail` in this function.
- **MP async (IPN webhook):** `paymentService.ts:2271` — Receipt email IS sent here.

**Real-world impact:** If MP's IPN is delayed or never arrives (network issue, MP queue lag), the customer never receives a receipt. They paid, the pool expanded, but their inbox is empty. The only fallback is the IPN webhook eventually retrying.

**Note:** The user has reported that "the email arrives correctly" in their tests. That's because in practice MP fires the IPN within ~seconds of the sync confirmation, so the receipt does land. But the code logic is technically vulnerable — if IPN never arrives, no email.

---

### Gap 2: 🔴 No PaymentEvent audit row on MP synchronous-path completion

Polar atomically creates a `PaymentEvent` row inside the same transaction that marks the payment COMPLETED. This is the "every gateway event is auditable" invariant from ADR-046/ADR-060.

- **Polar:** `paymentService.ts:624` — `tx.paymentEvent.create({ source: POLAR_WEBHOOK, polarEventId, ... })` inside the `prisma.$transaction` block.
- **MP sync (Brick):** `paymentService.ts:1938-1964` — Transaction updates `PoolPayment`, `Pool`, `AccountReceivable` (if linked), but **does NOT create a PaymentEvent row.**
- **MP async (IPN webhook):** `paymentService.ts:2149` — Creates PaymentEvent inside tx with `polarEventId = mp-{paymentId}-{status}` — parity with Polar.

**Real-world impact:** If only the sync path runs and the IPN never fires, the funnel-observability invariant from ADR-060 is broken for that payment. The audit log shows the row was COMPLETED but doesn't show the gateway event that confirmed it. Forensic analysis after-the-fact is harder.

---

### Gap 3: 🔴 No admin notification on MP payment completion

Polar's success handler sends an admin email letting the business team know a payment landed. MP's success paths (both sync and IPN) don't.

- **Polar:** `paymentService.ts:722` — `sendAdminNotification({ category: "payment_completed", ... })` inside `handleOrderPaid`.
- **MP sync:** `paymentService.ts:1902-2076` — No `sendAdminNotification` call.
- **MP async (IPN):** `paymentService.ts:2082-2389` — No `sendAdminNotification` call.

**Real-world impact:** Colombia-based payments don't trigger the same operational alert as international ones. If the team relies on these emails to track revenue events or spot anomalies, they see only half the picture.

---

### Gap 4: 🔴 No server-side reconciliation for stuck MP payments

`paymentReconcileJob` sweeps stale PoolPayments in `INITIATED` or `PENDING` and queries the gateway for their current state. **MP rows are explicitly excluded from this sweep.**

- **The exclusion:** `paymentService.ts:1602-1614` (`findStalePayments` function) — the query has `mpPreferenceId: null` filter at line 1608. Only Polar rows match.
- **The rationale (verbatim from code comment line 1592-1597):**
  > "MP rows reuse the polarCheckoutId column to store an MP idempotency reference like P4A-{poolId}-{ts}, which is not a UUID and crashes the Polar SDK with uuid_parsing on every tick. MP rows live their own reconciliation cycle via IPN retries; if/when we need a server-side MP reconciler it gets its own query + handler."
- **MP reconciler search:** Zero hits in `backend/src/jobs/`. No `mpReconcileJob.ts` exists.

**Real-world impact:** If an MP IPN webhook is never delivered for a real payment (network partition, signature mismatch, account misconfiguration), the `PoolPayment` row stays `PENDING` **forever**. There's no scheduled job that checks "did this payment actually complete on MP's side?" The customer sees their card charged, the pool didn't expand, and the row sits in limbo.

This is the **most critical gap** — it's a payment-loss risk, not just a UX/observability problem.

---

### Gap 5: 🟡 Audit `MP_PAYMENT_COMPLETED` is written OUTSIDE the transaction (race risk)

Polar's `PAYMENT_COMPLETED` audit row is written inside the same `prisma.$transaction` as the PoolPayment/Pool updates. If anything throws, the whole thing rolls back.

- **Polar:** `paymentService.ts:680` — `tx.auditEvent.create({ action: "PAYMENT_COMPLETED", ... })` inside the transaction.
- **MP sync:** `paymentService.ts:1968-1976` — `writeAuditEvent({ action: "MP_PAYMENT_COMPLETED", ... })` called **AFTER** the transaction (lines 1938-1964) closes. If the audit write fails (DB connection blip, write timeout), the PoolPayment is COMPLETED but the audit row is missing.
- **MP async (IPN):** Similar pattern — audit not inside the tx.

**Real-world impact:** Small but real window where audit log is inconsistent with PoolPayment state. Probability of hitting it is low (audit write is fast and against same DB) but it violates the "atomic state + audit" pattern Polar follows.

---

### Gap 6 (informational, not a gap per se): 🟢 Cancel signal asymmetry

Polar redirects the user to `/pago/cancelado` on explicit cancellation (`window.location.href = checkoutUrl` → user clicks cancel → Polar redirects back). MP's Brick form is on-page, so there's no equivalent "cancel" URL flow.

- **Polar:** `paymentService.ts:1003` (`handleCheckoutUpdated`) — can transition to FAILED if Polar emits `checkout.updated` with `status=canceled`.
- **MP:** `paymentService.ts:2287` (`handleMpWebhook`) — only marks FAILED on IPN status `rejected` / `cancelled`, no user-initiated "I changed my mind" signal.

Not a real gap — different gateway architectures. Documented for completeness.

## 4. The 1 gap that's symmetric (missing on BOTH)

### Capacity threshold re-notification on capacity-expansion

`checkAndNotifyCapacityThresholds` at `backend/src/lib/poolCapacity.ts:82-138` sends "pool 95% full" and "pool 100% full" emails to the host. It's called from `backend/src/routes/poolInvites.ts` on every new member join, but **neither Polar nor MP success handlers call it** after expanding capacity.

- **Polar:** `paymentService.ts:535-849` — no call to `checkAndNotifyCapacityThresholds`.
- **MP:** `paymentService.ts:1902-2076` + `:2082-2389` — no call.

Both reset the `Pool.poolFullNotifiedAt = null` and `Pool.capacityWarningNotifiedAt = null` flags so future joins re-arm the notifications, but no proactive notification fires about the expansion itself.

**Real-world impact:** Low. The host already knows they expanded capacity (they triggered the payment). Re-notifying them feels redundant. **Probably correctly absent.** Mention only in case it becomes a real ask.

## 5. Symmetric features (working correctly on both)

For completeness, here's what's parity-confirmed between Polar and MP:

| Dimension | Polar evidence | MP evidence |
|---|---|---|
| Checkout initiation: status flow INITIATED → PENDING | `paymentService.ts:371, 483` | `paymentService.ts:1741, 1839` |
| Validations (role, capacity, CC redemption) | `paymentService.ts:245-280` | `paymentService.ts:1634-1700` |
| Pre-redirect telemetry beacons (REDIRECT_INITIATED) | `PoolCapacityTab.tsx:239` | `PoolCapacityTab.tsx:208` |
| CC redemption flip to PAID on success | `paymentService.ts:658` | `paymentService.ts:1959, 2171` |
| GA4 `purchase` event | `paymentService.ts:786` | `paymentService.ts:2024, 2223` |
| Meta CAPI `Purchase` event | `paymentService.ts:754` | `paymentService.ts:1995, 2197` |
| Refund webhook handler | `paymentService.ts:861-982` | `paymentService.ts:2317-2388` |
| Idempotency via `polarEventId` UNIQUE | `paymentService.ts:624` (`polarEventId`) | `paymentService.ts:2149` (`polarEventId = mp-{id}-{status}`) |

## 6. Suggested remediation (priorities)

Not an implementation plan yet — this is a sketch for the owner to weigh.

### Priority 1 (payment-loss risk): MP reconciler

Build `mpPaymentReconcileJob` mirroring the Polar reconciler. Query `PoolPayment WHERE status IN (INITIATED, PENDING) AND mpPreferenceId IS NOT NULL AND createdAtUtc < cutoff`. For each, call MP's `/v1/payments/search` to find the payment by `external_reference = poolPayment.id`, then transition the row based on MP's authoritative state. ~150 LOC + advisory lock + tests. **Single biggest improvement.**

### Priority 2 (sync-path parity): MP sync-path runs the same atomic block as IPN

Refactor `processMpPayment` so the synchronous-approved path executes the same code block that `handleMpWebhook` runs on `approved`. Specifically:
- Create PaymentEvent inside the tx (close Gap 2)
- Send receipt email after tx (close Gap 1)
- Send admin notification after tx (close Gap 3)
- Move the audit write INSIDE the tx (close Gap 5)

Important wrinkle: when the IPN webhook arrives later for the same payment, idempotency must skip the duplicate work. The MP idempotency key includes status (`mp-{paymentId}-approved`), so the UNIQUE PaymentEvent insert will fail on the IPN side and the catch block will skip cleanly — already verified in current code. So this refactor is safe.

### Priority 3 (operational visibility): MP admin notifications

Cheap independent fix: add `sendAdminNotification({ category: "payment_completed", ... })` to both MP paths. Mirror the Polar call at line 722. ~5 LOC per path.

### Priority 4: nothing else

Gap 6 is an architectural difference between gateways, not a fixable bug. Symmetric-gap is probably intentional.

## 7. What the user has seen vs reality

The owner noted that "the email arrives correctly" when testing the MP local flow. That's because:
- MP's IPN webhook fires within ~seconds of the sync response on the staging/test environment
- The IPN path DOES send the receipt email (`paymentService.ts:2271`)
- So in practice the email arrives, just not via the sync path

But **the sync path is technically vulnerable.** Under any IPN delivery failure scenario (which can happen on rare network/queue issues), the customer wouldn't receive a receipt at all. The "fix" is making both paths self-sufficient.

## 8. Document version

- v1 — 2026-05-26 — initial diagnosis after Explore agent forensic mapping. 5 real gaps + 1 symmetric. Awaiting owner decision on remediation scope.

## 9. Next steps (owner to decide)

1. Approve scope: which of priorities 1-3 do we implement, in what order?
2. For Priority 1 (MP reconciler): worth its own audit + implementation cycle (mirroring the SALES / EMAIL_LOCALE / LOCALE_RESOLUTION pattern), because it adds infrastructure (new job, advisory lock key, MP `/v1/payments/search` integration).
3. For Priorities 2-3: could be one combined commit, low risk, fully additive.

## 10. Verified-evidence table

| Dimension | Polar file:line | MP file:line | Status |
|---|---|---|---|
| Checkout initiation | `paymentService.ts:245` | `paymentService.ts:1634` | Symmetric |
| Pre-redirect beacons | `PoolCapacityTab.tsx:239` | `PoolCapacityTab.tsx:208` | Symmetric |
| Success tx: PaymentEvent.create | `paymentService.ts:624` | `paymentService.ts:2149` (IPN only) | **Gap 2** |
| Success: PoolPayment.update | `paymentService.ts:635` | `paymentService.ts:1939, 2150` | Symmetric |
| Success: Pool.update (capacity) | `paymentService.ts:644` | `paymentService.ts:1947, 2159` | Symmetric |
| Success: AccountReceivable PAID | `paymentService.ts:658` | `paymentService.ts:1959, 2171` | Symmetric |
| Success: receipt email | `paymentService.ts:832` | `paymentService.ts:2271` (IPN only) | **Gap 1** |
| Success: CAPI Purchase | `paymentService.ts:754` | `paymentService.ts:1995, 2197` | Symmetric |
| Success: GA4 purchase | `paymentService.ts:786` | `paymentService.ts:2024, 2223` | Symmetric |
| Success: audit completed | `paymentService.ts:680` (in tx) | `paymentService.ts:1970` (post-tx) | **Gap 5** |
| Success: admin notification | `paymentService.ts:722` | None | **Gap 3** |
| Refund handler | `paymentService.ts:861` | `paymentService.ts:2317` | Symmetric |
| Cancel signal | `paymentService.ts:1003` | `paymentService.ts:2287` | Different by design |
| Stale-row reconciliation | `paymentReconcileJob.ts` | None | **Gap 4** |
| Receipt locale source | `resolveUserLocale(user)` | `resolveUserLocale(user)` | Symmetric |
| Idempotency key | `polarEventId` UNIQUE | `mp-{id}-{status}` UNIQUE | Symmetric |

---

**END OF DOCUMENT**
