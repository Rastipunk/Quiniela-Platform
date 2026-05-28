# Payments Parity — Polar vs Mercado Pago — Audit & Design

> Companion to `PAYMENTS_PARITY_IMPLEMENTATION.md`. This is the "why" doc — every decision below is locked **before** code lands. If we need to change something, edit here first.
>
> Owner triggered on 2026-05-26 after suspecting MP had gaps relative to Polar. Forensic mapping confirmed 5 real gaps in MP + 1 symmetric. Production DB shows 7 PoolPayment rows currently stuck in `PENDING` on the MP side (oldest: 23 days old, including 2 at $228.500 COP) — the new reconciler will process them on its first tick.

---

## 1. Problem statement

Both gateways share the same `PoolPayment` table, the same audit log (`PaymentEvent`), and the same downstream effects (Pool capacity expansion, CC redemption flip to PAID, GA4/CAPI fan-out, receipt email). But the operational behavior diverges in 5 dimensions, and the most severe is a **payment-loss risk**: MP rows in `PENDING` have no reconciler — if an IPN webhook fails to deliver, the row lives forever in limbo.

The asymmetry comes from MP having TWO success paths (synchronous via Brick + asynchronous via IPN) while Polar has only ONE (webhook). The current MP code assumes the IPN always arrives — but if it doesn't, the sync path doesn't compensate fully.

## 2. Verified current state

All claims below cite file:line. Verified by two Explore agent passes on 2026-05-26.

### 2.1 The 5 gaps in Mercado Pago

| # | Gap | Polar evidence | MP evidence |
|---|---|---|---|
| 1 | No receipt email on sync-path completion | `paymentService.ts:832` (webhook sends it) | `paymentService.ts:1902-2076` (sync path absent); `:2271` (IPN path sends it) |
| 2 | No PaymentEvent audit row on sync-path tx | `paymentService.ts:624` (in tx) | `paymentService.ts:1938-1964` (absent); `:2149` (IPN path has it) |
| 3 | No admin notification on completion | `paymentService.ts:722` (`payment_completed` category) | Both paths absent |
| 4 | No server-side MP reconciler — **payment-loss risk** | `paymentReconcileJob.ts` + `findStalePayments` at `paymentService.ts:1582-1614` | MP rows explicitly excluded at line 1608 (`mpPreferenceId: null` filter) |
| 5 | `MP_PAYMENT_COMPLETED` audit row written OUTSIDE tx | Polar's `PAYMENT_COMPLETED` at line 680 (inside tx) | MP's at line 1968 (after tx closes) |

### 2.2 The 1 symmetric gap (both gateways missing)

Neither path calls `checkAndNotifyCapacityThresholds` after expanding capacity. Both reset `Pool.poolFullNotifiedAt = null` so future joins re-arm the notification, but no proactive notification fires. Probably correctly absent (host triggered the payment, knows about it). Documented for completeness; not part of this cycle.

### 2.3 The MP SDK already has what we need

`backend/src/services/mercadopago/client.ts:171-175` — `getPayment(mpPaymentId)` is already exported. Wraps `Payment.get({ id })`. **The reconciler does not need any new MP client code.**

### 2.4 Current idempotency state (verbatim, file:line)

**IPN path entry guard**: `paymentService.ts:2127`:
```ts
if (!isRefundSignal && payment.status === "COMPLETED") return;
```
If sync already completed → IPN no-ops. **Good.**

**Sync path entry guard**: **NONE.** `paymentService.ts:1902-2076` has no equivalent check. **Bug latent today** (no double-email because sync doesn't send email at all; will matter when we add it).

**Refund path:** The IPN guard explicitly allows refund signals through even when status is `COMPLETED` (it checks `!isRefundSignal`). Good — refunds must process from any state.

### 2.5 Webhook signature validation

`backend/src/routes/payments.ts:289-348` — HMAC-SHA256 signature check + 5-minute drift window. **The reconciler bypasses this** because it queries MP's API directly with `MP_ACCESS_TOKEN` (our own credential). That's fine — we're authenticating ourselves to MP, not validating someone else's identity. Same trust model as the Polar reconciler.

### 2.6 Schema state

`PoolPayment` has `@@index([status])`, `@@index([poolId])`, `@@index([userId])` but **NO compound index on `(status, createdAtUtc)`** which is the reconciler's query pattern. The query works without the compound index — it scans `PENDING` rows then filters by date — but a compound index makes it O(log n) instead of O(n) within the bucket. With 359 users and ~7 stuck rows it doesn't matter today; with 10k it would.

### 2.7 Production state (snapshot 2026-05-26)

- 7 MP PoolPayment rows in `INITIATED` or `PENDING`
- Age distribution: 4 between 1–7 days, 3 between 7–30 days, 0 older
- Highest stuck amount: 2 rows at $228.500 COP (CC redemption payments)
- All have a valid `mpPreferenceId` and `polarCheckoutId` (used as MP idempotency reference `P4A-{poolId}-{ts}`)

These will be the reconciler's first batch.

## 3. Locked decisions

Confirmed via AskUserQuestion on 2026-05-26 after the forensic verification.

### §3.1 Shared completion logic — `markPaymentCompleted` function

Extract the "mark payment completed + run side effects atomically" logic into a single function that **all three callers** invoke:
- MP sync path (`processMpPayment` on `approved`)
- MP IPN path (`handleMpWebhook` on `approved`)
- MP reconciler (when MP confirms approved but our row is still PENDING)

The function:
- Accepts `paymentId` (our PoolPayment.id) + `confirmation` metadata (gateway event ID, mpPaymentId, status detail, paid timestamp).
- Internally checks `payment.status === "COMPLETED"` and returns early if already done (idempotent).
- Opens a single `prisma.$transaction` that does:
  - `paymentEvent.create()` with the gateway event ID (idempotent via UNIQUE on `polarEventId`)
  - `poolPayment.update()` → status COMPLETED, paidAtUtc, polarOrderId, metaEventId
  - `pool.update()` → maxParticipants, reset notification flags
  - `accountReceivable.update()` → status PAID (if linked CC)
  - `auditEvent.create()` → `PAYMENT_COMPLETED` (uniform action across gateways)
- After tx commits, fires:
  - `sendPaymentReceiptEmail` (with CC consecutive lookup)
  - `sendCapiEvent` Purchase
  - `sendGa4Event` purchase
  - `sendAdminNotification` `payment_completed` category

This single change closes gaps 1, 2, 3, and 5 simultaneously.

### §3.2 Reconciler auto-completes

When the MP reconciler queries `getPayment(mpPaymentId)` and MP returns `status: "approved"` but our PoolPayment is `PENDING`, the reconciler **calls `markPaymentCompleted`** — same code path as the live handlers. No more "human review required" hack à la Polar's RESCUED. The shared function makes auto-completion safe.

This works because:
- The function is fully idempotent (entry guard + UNIQUE PaymentEvent)
- All side effects (email, capacity, CAPI/GA4, admin notification) run uniformly
- The audit row carries `source: RECONCILER` instead of `MP_WEBHOOK` so we can distinguish recovery from real-time

### §3.3 Reconciler cadence and behavior

- Cron: `*/30 * * * *` (every 30 min, mirror of Polar) — env var `MP_RECONCILE_CRON`
- Batch size: 50 per tick — env var `MP_RECONCILE_BATCH_SIZE`
- Advisory lock key: `82636506n` (distinct from Polar's `82636503n`, CC expiry `82636504n`, welcome `82636505n`)
- Query: `WHERE status IN ("INITIATED", "PENDING") AND mpPreferenceId IS NOT NULL AND createdAtUtc < now - 30min`
- For each stuck row:
  - Resolve the actual MP payment ID. We don't store it on the row until completion. **Strategy:** use MP's "search by external_reference" via raw SDK if the wrapper doesn't expose it, OR persist `mpPaymentId` on the row when the IPN first reports anything for it (defensive add). Verified during commit 5 implementation.
  - Call `getPayment(mpPaymentId)`.
  - Map MP status → action:
    - `approved` → call `markPaymentCompleted` (auto-complete)
    - `rejected` / `cancelled` → mark `FAILED` + write `RECONCILER` audit
    - `pending` / `in_process` → NOOP (still in flight on MP's side)
    - SDK error → log + retry next tick

### §3.4 Backfill of the 7 stuck rows

No special handling. The reconciler's first tick (within 30 min of deploy) will process all 7 automatically based on their actual MP state. Expected outcomes (from 23-day-old → 1.8-day-old): some will resolve to `approved` (customer paid, IPN failed, we missed it — recover the receipt + capacity), some to `cancelled` or expired (customer abandoned — mark FAILED), some still in process (NOOP).

### §3.5 Schema additive change

Add `@@index([status, createdAtUtc])` to PoolPayment. Additive migration. Improves reconciler query at scale. Optional in the strict sense (works without it) but cheap and correct.

### §3.6 SerializedUser and `mpPaymentId` storage

Currently MP rows store the gateway reference in two places:
- `polarCheckoutId` → MP idempotency reference `P4A-{poolId}-{ts}` (set at INITIATED)
- (no field) → MP's real `payment.id` (only known on completion)

For the reconciler to call `getPayment(mpPaymentId)`, it needs the MP payment ID. There are two ways:

- **Option A:** Add `mpPaymentId String?` column to PoolPayment. Populate it on first IPN delivery or sync completion. The reconciler reads it. **Cleaner.**
- **Option B:** Use MP's `payments/search?external_reference={ourRef}` API. Doesn't need schema change but requires raw SDK access (the current wrapper has no `searchPayments`).

**Locked:** Option A. One migration, one new column, future-proof. The wrapper change to MP SDK in Option B is brittle and the field is genuinely useful info to have on the row for support queries anyway.

### §3.7 Out of scope

- ❌ Adding `checkAndNotifyCapacityThresholds` to payment success handlers (the symmetric gap — both paths absent). Documented in §2.2 as probably intentional.
- ❌ Refactoring Polar to use the same `markPaymentCompleted` function. Polar already works correctly; symmetrizing the refactor would be invasive without benefit. Future cleanup if we ever touch Polar again.
- ❌ MP webhook signature improvements. Current HMAC + 5-min drift is sufficient.
- ❌ Replacing `polarCheckoutId` column name (still doubles as MP idempotency reference). Renaming would force a big migration across the codebase for cosmetic value. Acceptable cross-gateway naming legacy.

## 4. Architecture sketch

### 4.1 New shape of `paymentService.ts` after this cycle

```
paymentService.ts
├── initiateCheckout (Polar)           — unchanged
├── initiateMpCheckout (MP)            — unchanged
├── handleOrderPaid (Polar webhook)    — refactored to call markPaymentCompleted
├── handleOrderRefunded (Polar)        — unchanged
├── processMpPayment (MP sync)         — refactored to call markPaymentCompleted
├── handleMpWebhook (MP IPN)           — refactored to call markPaymentCompleted
└── markPaymentCompleted (NEW)         — single source of truth for completion
     ├── entry guard: status === COMPLETED → return
     ├── prisma.$transaction:
     │   ├── PaymentEvent.create (UNIQUE polarEventId — idempotent)
     │   ├── PoolPayment.update → COMPLETED
     │   ├── Pool.update → maxParticipants, reset flags
     │   ├── AccountReceivable.update → PAID (if linked)
     │   └── AuditEvent.create → PAYMENT_COMPLETED
     └── post-tx side effects (all fireAndForget):
         ├── sendPaymentReceiptEmail (with CC consecutive lookup)
         ├── sendCapiEvent Purchase
         ├── sendGa4Event purchase
         └── sendAdminNotification (payment_completed)
```

### 4.2 New `mpPaymentReconcileJob` flow

```
runOnce (every 30 min, advisory lock 82636506n)
   │
   ▼
findStaleMpPayments()  — query PoolPayment WHERE
   status ∈ (INITIATED, PENDING)
   AND mpPreferenceId IS NOT NULL
   AND createdAtUtc < now - 30min
   ORDER BY createdAtUtc ASC
   LIMIT 50
   │
   ▼
for each row:
   ├── if mpPaymentId IS NULL (we never saw an IPN for it):
   │     → audit "RECONCILER_NOOP reason=no_mp_payment_id"
   │     → continue (waiting on IPN — nothing to query yet)
   │
   ├── else getPayment(mpPaymentId)
   │   ├── status="approved" → markPaymentCompleted(...)
   │   │                         + audit RECONCILER_RESOLVED
   │   ├── status="rejected"/"cancelled" → mark FAILED + audit
   │   ├── status="pending"/"in_process" → NOOP + audit
   │   └── SDK error → log + NOOP + audit RECONCILER_QUERY_FAILED
```

### 4.3 IPN handler stores `mpPaymentId` defensively

When the IPN webhook fires for the first time on a payment (even with `pending` status), we now `update mpPaymentId = paymentMpId` on the PoolPayment row. This guarantees the reconciler has the ID for subsequent queries.

## 5. Open questions

None at locking time. Confirmed via AskUserQuestion on 2026-05-26.

If anything new surfaces during implementation, log it here as `Q-N` with the resolution.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `markPaymentCompleted` refactor introduces a regression on Polar/MP live traffic | Refactor extracts existing logic verbatim — no behavior change. Type-check + manual smoke test before push. Atomic commits make revert trivial. |
| Reconciler loops forever calling MP API on a stuck row | Each tick is a fresh query; no per-row retry counter needed because each tick is bounded by `BATCH_SIZE=50`. If MP is down, all queries fail uniformly and the next tick retries. |
| Reconciler resolves a stuck row that was actually a duplicate payment intent | If MP returns "approved" for a payment that doesn't belong to this user/pool, the guard inside `markPaymentCompleted` (and the `external_reference` match check) prevents cross-contamination. Audit row records the resolution for forensic review. |
| `mpPaymentId` added but the IPN handler crashes before persisting it | Worst case: reconciler can't query → NOOP forever for that row. Same outcome as today. We don't make anything worse. |
| Race: sync completes and reconciler queries concurrently | `markPaymentCompleted`'s entry guard (`status === COMPLETED → return`) is the single arbiter. Whoever sets COMPLETED first wins; the other is a no-op. PaymentEvent UNIQUE on `polarEventId` catches gateway-event duplicates. |
| Existing audit action `MP_PAYMENT_COMPLETED` references in dashboards/analytics break when we switch to uniform `PAYMENT_COMPLETED` | We KEEP writing `MP_PAYMENT_COMPLETED` for one full release cycle (as deprecation legacy), THEN remove it. Or we don't — the analytics queries probably filter by `source` (POLAR_WEBHOOK vs MP_WEBHOOK vs RECONCILER) not by action name. **Decision in commit 1: just rename to `PAYMENT_COMPLETED` uniformly; verify no downstream consumer breaks via grep before the commit.** |
| 7 stuck rows in production resolve incorrectly on first tick | Each one writes an explicit audit row. We monitor the first batch closely (logs, manually). If something looks wrong, the rollback plan in commit 5 disables the job — the rows go back to their stuck state, no data corruption. |

## 7. Acceptance criteria

After all 6 commits land:

- [ ] `markPaymentCompleted` function exists in `paymentService.ts`, fully unit-testable.
- [ ] All 3 success paths (Polar webhook, MP sync, MP IPN) call it.
- [ ] Type-check + Next build pass on backend.
- [ ] MP sync path now sends receipt email when Brick returns `approved` (verified by triggering a real test purchase).
- [ ] MP sync path now writes PaymentEvent row inside its tx.
- [ ] MP completion writes `AuditEvent` row inside the same tx as PoolPayment.update.
- [ ] MP completion fires `sendAdminNotification` `payment_completed`.
- [ ] PoolPayment table has `mpPaymentId` column populated on first IPN delivery.
- [ ] PoolPayment table has `@@index([status, createdAtUtc])`.
- [ ] `mpPaymentReconcileJob` runs every 30 min and processes the 7 stuck rows on its first 1-2 ticks.
- [ ] For at least 1 of the 7, audit log shows `RECONCILER_RESOLVED` outcome.
- [ ] No regression on existing Polar flow (verified by tailing prod logs for `[PaymentReconciler]` warnings post-deploy).
- [ ] ADR-065 + BUSINESS_RULES.md §18 + CLAUDE.md invariant 13 + MEMORY entry land.

## 8. Document version

- v2 — 2026-05-26 — expanded from diagnostic-only (v1) into full audit + locked decisions. Production count of stuck rows folded in (§2.7).
- v1 — 2026-05-26 — initial forensic diagnosis (committed as `2fe59fc`).

---

**END OF DOCUMENT**
