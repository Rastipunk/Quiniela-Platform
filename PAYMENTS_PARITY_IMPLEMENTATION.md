# Payments Parity — Implementation Tracker

> Companion to `PAYMENTS_PARITY_AUDIT.md`. Per-commit checklist. Update the status emoji + SHA as each commit lands so the work survives context breaks.
>
> Every locked decision is in `PAYMENTS_PARITY_AUDIT.md` §3. Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: schema — add `PoolPayment.mpPaymentId` + compound index `[status, createdAtUtc]` + migration | 🟩 DONE | `9e85fa9` |
| 2 | Backend: extract `markPaymentCompleted` shared function (refactor — Polar handler calls it, behavior unchanged) | 🟩 DONE | `a062d1c` |
| 3 | Backend: MP sync path (`processMpPayment`) + MP IPN path (`handleMpWebhook`) refactored to call `markPaymentCompleted` — closes gaps 1, 2, 3, 5 | 🟩 DONE | `5881f9a` |
| 4 | Backend: IPN handler persists `mpPaymentId` on first delivery (defensive — reconciler needs it) | 🟩 DONE | `c15f843` |
| 5 | Backend: `mpPaymentReconcileJob` (advisory lock `82636506n`, 30-min cron, batch 50) — closes gap 4 | 🟩 DONE | `78efdd2` |
| 6 | Docs: ADR-065 + BUSINESS_RULES §18 + CLAUDE.md invariant 13 + MEMORY entry | 🟩 DONE | `166e447` |

Cycle is functionally complete after commit 5. Commit 6 is documentation hygiene.

---

## Pre-flight

- [x] Audit doc reviewed.
- [x] 4 architectural decisions confirmed via AskUserQuestion (idempotency pattern, reconciler auto-complete, backlog handling, cadence).
- [x] 7 stuck MP rows in prod measured + acceptance criteria defined.
- [x] Verified `getPayment(mpPaymentId)` already exported (`mercadopago/client.ts:171-175`).
- [ ] User says "go" for commit 1.

---

## 1 — Commit 1: schema + migration

**Goal**: persist the MP payment ID on the row + add the compound index the reconciler will use.

### 1.1 Files

- `backend/prisma/schema.prisma` — add `mpPaymentId String?` to `PoolPayment` + new compound index.
- `backend/prisma/migrations/<timestamp>_add_mp_payment_id_and_status_index/migration.sql` — hand-written SQL.

### 1.2 Schema diff

```diff
 model PoolPayment {
   id String @id @default(uuid())
   …
   polarCheckoutId String?  // Polar checkout ID; also used as MP idempotency reference (legacy)
+  // MP's real payment.id, persisted on first IPN delivery (commit 4).
+  // Needed by mpPaymentReconcileJob to call getPayment() and resolve
+  // stuck rows. NULL until IPN reports anything for the row.
+  mpPaymentId     String?
   mpPreferenceId  String?  // MP preference ID (set at INITIATED)
   …
   @@index([poolId])
   @@index([userId])
   @@index([status])
+  // Reconciler query: WHERE status IN (...) AND createdAtUtc < cutoff
+  // Covers both the existing Polar reconciler and the new MP one.
+  @@index([status, createdAtUtc])
 }
```

### 1.3 Migration SQL

```sql
-- backend/prisma/migrations/20260527_add_mp_payment_id_and_status_index/migration.sql

ALTER TABLE "PoolPayment"
  ADD COLUMN "mpPaymentId" TEXT;

CREATE INDEX "PoolPayment_status_createdAtUtc_idx"
  ON "PoolPayment"("status", "createdAtUtc");
```

Additive, zero data loss, zero behavioural change at this point.

### 1.4 Acceptance

- [ ] `npx prisma generate` regenerates client without error.
- [ ] `npx tsc --noEmit` in backend passes.
- [ ] After Railway deploy: `prisma migrate deploy` runs the migration cleanly.
- [ ] Prod check: `SELECT id, "mpPaymentId" FROM "PoolPayment" LIMIT 3;` shows the new NULL column.

### 1.5 Commit message template

```
feat(payments): PoolPayment.mpPaymentId + compound status index

Adds two additive schema changes preparing for the MP reconciler:

  - mpPaymentId TEXT NULL — populated by IPN handler on first
    delivery (commit 4). The reconciler reads it to call MP's
    getPayment() and resolve stuck rows.
  - Compound index on (status, createdAtUtc) — covers the
    reconciler's stale-row query for both Polar and MP variants.

Zero data loss; behavior unchanged at this stage.

See PAYMENTS_PARITY_AUDIT.md §3.5 and §3.6 for the locked decisions.
Tracks PAYMENTS_PARITY_IMPLEMENTATION.md commit 1.

Co-Authored-By: …
```

### 1.6 Status

🟩 DONE — SHA: `9e85fa9`

---

## 2 — Commit 2: extract `markPaymentCompleted` (refactor, behavior-preserving)

**Goal**: single function that owns "mark a PoolPayment as COMPLETED + run all side effects atomically." Polar's handler is the first caller. MP refactor happens in commit 3.

### 2.1 Files

- `backend/src/services/paymentService.ts` — extract function; refactor `handleOrderPaid` to call it.

### 2.2 Function shape

```ts
/**
 * Mark a PoolPayment as COMPLETED and run all the side effects in one
 * atomic block + post-tx fan-out. Single source of truth for payment
 * completion across all three callers (Polar webhook, MP sync, MP IPN,
 * MP reconciler). Fully idempotent — calling it twice for the same
 * payment is a no-op via the entry guard.
 *
 * See PAYMENTS_PARITY_AUDIT.md §3.1.
 */
interface MarkPaymentCompletedInput {
  paymentId: string;
  gatewayEventId: string;        // polarEventId for Polar; "mp-{id}-{status}" for MP
  source: PaymentEventSource;    // POLAR_WEBHOOK | MP_WEBHOOK | RECONCILER
  paidAtUtc: Date;
  // Gateway-specific identifiers stored on the row
  polarOrderId?: string;
  mpPaymentId?: string;
  // Payload to persist on PaymentEvent for forensic
  payloadJson: Prisma.InputJsonValue;
}

async function markPaymentCompleted(input: MarkPaymentCompletedInput): Promise<void>;
```

Internal flow (mirrors current `handleOrderPaid`'s tx + side effects):

1. Fetch PoolPayment by id (one query).
2. **Entry guard:** if `payment.status === "COMPLETED"`, return immediately.
3. Compute metaEventId (`crypto.randomUUID()` if not already on row).
4. `prisma.$transaction`:
   - `paymentEvent.create({ source, polarEventId: input.gatewayEventId, payloadJson })` — UNIQUE constraint handles dedup; catch P2002 → return early (race).
   - `poolPayment.update({ status: "COMPLETED", paidAtUtc, polarOrderId, mpPaymentId, metaEventId })` (only update fields when provided).
   - `pool.update({ maxParticipants: payment.toCapacity, poolFullNotifiedAt: null, capacityWarningNotifiedAt: null })`.
   - `accountReceivable.update({ status: "PAID", paidAtUtc })` if `payment.accountReceivableId`.
   - `auditEvent.create({ action: "PAYMENT_COMPLETED", source, dataJson })`.
5. Post-tx fire-and-forget:
   - `sendPaymentReceiptEmail` (with CC consecutive lookup if linked)
   - `sendCapiEvent` Purchase
   - `sendGa4Event` purchase
   - `sendAdminNotification` `payment_completed`

### 2.3 Polar refactor

`handleOrderPaid` becomes a thin parser:
- Validates the webhook payload
- Extracts gateway IDs, paid timestamp, payload JSON
- Calls `markPaymentCompleted` with `source: POLAR_WEBHOOK`

The body of `handleOrderPaid` shrinks from ~300 LOC to ~60 LOC.

### 2.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Existing Polar webhook tests (if any) pass unchanged.
- [ ] Manual: trigger a Polar test webhook → verify all current side effects still fire (PaymentEvent created, PoolPayment COMPLETED, Pool capacity expanded, receipt email sent, CAPI + GA4 + admin notification).
- [ ] The audit row's `action` is `PAYMENT_COMPLETED` (uniform), `source: POLAR_WEBHOOK` (preserved).

### 2.5 Status

🟩 DONE — SHA: `a062d1c`

---

## 3 — Commit 3: MP sync + IPN call `markPaymentCompleted`

**Goal**: close gaps 1, 2, 3, 5 in one refactor.

### 3.1 Files

- `backend/src/services/paymentService.ts` — refactor `processMpPayment` (sync) and `handleMpWebhook` (IPN) to call `markPaymentCompleted`.

### 3.2 processMpPayment refactor

Currently lines 1902-2076 do all the work inline. Replace the `approved`-path block with:

```ts
if (mpResult.status === "approved") {
  await markPaymentCompleted({
    paymentId: payment.id,
    gatewayEventId: `mp-${mpResult.id}-approved`, // matches IPN dedup key
    source: PAYMENT_EVENT_SOURCE.MP_SYNC, // new source enum value (or MP_WEBHOOK if we keep one)
    paidAtUtc: new Date(),
    mpPaymentId: String(mpResult.id),
    payloadJson: { ...mpResult, statusDetail: mpResult.statusDetail },
  });
}
```

The rest of the function (handling rejected/in_process/etc statuses) stays.

### 3.3 handleMpWebhook refactor

Lines 2141-2286 contain the IPN's `approved`-path inline. Replace with:

```ts
if (mpPayment.status === "approved") {
  await markPaymentCompleted({
    paymentId: ourPayment.id,
    gatewayEventId: `mp-${mpPaymentId}-${mpPayment.status}`,
    source: PAYMENT_EVENT_SOURCE.MP_WEBHOOK,
    paidAtUtc: ...,
    mpPaymentId: String(mpPaymentId),
    payloadJson: mpPayment,
  });
  return; // skip the existing inline block
}
```

The existing refund handling (line 2317+) stays unchanged.

### 3.4 New PaymentEventSource value

Add `MP_SYNC` to the enum in `lib/paymentEvents.ts` to distinguish synchronous Brick completions from async IPN completions. Reconciler completions use `RECONCILER` (already exists).

### 3.5 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Trigger a real MP test purchase via Brick → `approved` returned synchronously:
  - Receipt email arrives in test inbox ✓
  - PaymentEvent row exists with `source: MP_SYNC` ✓
  - Admin notification fires ✓
  - AuditEvent action is `PAYMENT_COMPLETED` (uniform) ✓
  - All inside the same transaction (verify atomicity by tailing logs during a forced rollback)
- [ ] When IPN arrives later for the same payment: `markPaymentCompleted` entry guard skips it (status already COMPLETED). No double-email, no double-audit, no double-CAPI event (UNIQUE polarEventId catches it).
- [ ] When IPN arrives FIRST and sync second (race scenario, hard to trigger): same outcome — first call wins.

### 3.6 Status

🟩 DONE — SHA: `5881f9a`

---

## 4 — Commit 4: IPN persists `mpPaymentId` defensively

**Goal**: every time the IPN fires for an MP payment (any status), update `PoolPayment.mpPaymentId` so the reconciler always has it for future queries.

### 4.1 Files

- `backend/src/services/paymentService.ts` — small addition at the top of `handleMpWebhook` (after we've resolved which PoolPayment row this MP payment belongs to).

### 4.2 Diff sketch

```ts
// Inside handleMpWebhook, after we find `ourPayment` via external_reference:
if (!ourPayment.mpPaymentId) {
  await prisma.poolPayment.update({
    where: { id: ourPayment.id },
    data: { mpPaymentId: String(mpPaymentId) },
  });
  // Refresh local reference so downstream logic sees the new value
  ourPayment = { ...ourPayment, mpPaymentId: String(mpPaymentId) };
}
```

This runs BEFORE the status check, so even `pending` IPN deliveries persist the ID. After commit 3, completion happens via `markPaymentCompleted` which also persists `mpPaymentId` — this commit is the "earlier opportunity" defense.

### 4.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Trigger a real MP test purchase → after the first IPN delivery (status=`pending`), DB shows `mpPaymentId` populated on the row.
- [ ] Existing rows in prod (the 7 stuck ones) — their `mpPaymentId` remains NULL until the reconciler queries them. If the reconciler can't infer the ID without it, it has to fall back to MP's `search by external_reference`. See commit 5.

### 4.4 Status

🟩 DONE — SHA: `c15f843`

---

## 5 — Commit 5: `mpPaymentReconcileJob`

**Goal**: hourly sweep that resolves stuck MP rows. Closes gap 4 (payment-loss risk).

### 5.1 Files

- `backend/src/services/paymentService.ts` — new export `findStaleMpPayments(batchSize)` + new export `reconcileStaleMpPayment(paymentId)`.
- `backend/src/services/mercadopago/client.ts` — if needed, new export `searchPaymentByExternalReference(externalRef)` to wrap MP's payments search API (used as fallback when `mpPaymentId` is NULL on legacy rows).
- `backend/src/jobs/mpPaymentReconcileJob.ts` — new cron job (~150 LOC, modeled on `paymentReconcileJob.ts`).
- `backend/src/server.ts` — register start/stop.

### 5.2 Reconciler logic per row

```ts
async function reconcileStaleMpPayment(paymentId: string): Promise<ReconcileResult> {
  const payment = await prisma.poolPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "COMPLETED") {
    return { paymentId, outcome: "NOOP", reason: "already_terminal_or_missing" };
  }

  // Resolve MP payment ID
  let mpPaymentId: string | null = payment.mpPaymentId;
  if (!mpPaymentId) {
    // Legacy row — fall back to search by external_reference
    // (= polarCheckoutId for MP rows, which carries "P4A-{poolId}-{ts}")
    const found = await searchPaymentByExternalReference(payment.polarCheckoutId!);
    if (!found) {
      await writeReconcilerEvent(payment.id, "MP_NOT_FOUND_BY_REF", { ref: payment.polarCheckoutId });
      return { paymentId, outcome: "NOOP", reason: "no_mp_payment_for_ref" };
    }
    mpPaymentId = String(found.id);
    // Persist it for next tick
    await prisma.poolPayment.update({
      where: { id: payment.id },
      data: { mpPaymentId },
    });
  }

  // Query MP
  let mpPayment;
  try {
    mpPayment = await getPayment(mpPaymentId);
  } catch (err) {
    await writeReconcilerEvent(payment.id, "MP_QUERY_FAILED", { error: ... });
    return { paymentId, outcome: "NOOP", reason: "mp_api_failed" };
  }

  // Map MP status → action
  switch (mpPayment.status) {
    case "approved":
      await markPaymentCompleted({
        paymentId: payment.id,
        gatewayEventId: `mp-${mpPaymentId}-reconciled`,
        source: PAYMENT_EVENT_SOURCE.RECONCILER,
        paidAtUtc: new Date(mpPayment.date_approved ?? Date.now()),
        mpPaymentId,
        payloadJson: mpPayment,
      });
      return { paymentId, outcome: "RESCUED", nextStatus: "COMPLETED" };

    case "rejected":
    case "cancelled":
      await prisma.$transaction(async (tx) => {
        await tx.poolPayment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        await tx.paymentEvent.create({
          data: {
            source: PAYMENT_EVENT_SOURCE.RECONCILER,
            poolPaymentId: payment.id,
            eventType: RECONCILER_EVENT_TYPE.FAILED,
            payloadJson: mpPayment as Prisma.InputJsonValue,
          },
        });
      });
      return { paymentId, outcome: "FAILED_FROM_GATEWAY", nextStatus: "FAILED" };

    default: // "pending", "in_process", etc — still in flight
      await writeReconcilerEvent(payment.id, "MP_STILL_IN_FLIGHT", { mpStatus: mpPayment.status });
      return { paymentId, outcome: "NOOP", reason: "mp_still_in_flight" };
  }
}
```

### 5.3 Job shape

Mirror `paymentReconcileJob.ts`:
- Cron `*/30 * * * *` (env `MP_RECONCILE_CRON`)
- Advisory lock `82636506n`
- Batch 50 (env `MP_RECONCILE_BATCH_SIZE`)
- Idle early-exit (skip the tick if no stale rows)
- Per-row try/catch so individual failures don't abort the batch

### 5.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Manual: `runMpReconcileOnce()` from a script picks up the 7 stuck rows.
- [ ] For each: audit row written with outcome (RESCUED / FAILED / NOOP).
- [ ] At least 1 of the 7 should resolve to RESCUED — meaning customer paid, IPN never landed, capacity expanded correctly now, receipt email finally sent.
- [ ] Multi-instance safety: launch two reconciler runs concurrently — advisory lock blocks the second, no duplicate work.
- [ ] Polar reconciler keeps working in parallel (different advisory lock key, different stale-row query).

### 5.5 Status

🟩 DONE — SHA: `78efdd2`

---

## 6 — Commit 6: docs

### 6.1 Files

- `docs/DECISION_LOG.md` — ADR-065.
- `docs/BUSINESS_RULES.md` — §18 "Payment completion + reconciliation".
- `CLAUDE.md` — §6 invariant 13.
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — index entry to new `project_payments_parity.md`.

### 6.2 ADR-065 outline

- **Context**: Santiago bug fix in ADR-064 surfaced. Owner asked for full parity audit. 5 gaps in MP found + 7 stuck rows in prod.
- **Decision**: shared `markPaymentCompleted` function, MP reconciler with auto-complete via the shared function, `mpPaymentId` column, compound index, audit action uniformed to `PAYMENT_COMPLETED`.
- **Consequences**: ✅ MP feature parity with Polar; ✅ stuck rows resolvable; ✅ single source of truth for completion; ⚠️ refactor touches sensitive code paths — verify acceptance criteria carefully.

### 6.3 CLAUDE.md invariant 13

> **13. Payment completion runs through `markPaymentCompleted`.** Any code path that needs to mark a PoolPayment as `COMPLETED` (webhook handlers, sync responses, reconcilers) MUST call `markPaymentCompleted` — never update `poolPayment.status = "COMPLETED"` directly. The function owns the atomic side effects (PaymentEvent, Pool capacity, AccountReceivable, audit) and the post-tx fan-out (receipt email, CAPI Purchase, GA4 purchase, admin notification). The entry guard makes it fully idempotent. Polar has its own reconciler (`paymentReconcileJob`); MP has `mpPaymentReconcileJob`. Both call `markPaymentCompleted` on RESCUED outcomes. See ADR-065.

### 6.4 Acceptance

- [ ] ADR-065 in DECISION_LOG.md.
- [ ] BUSINESS_RULES.md §18 added.
- [ ] CLAUDE.md invariant 13 added.
- [ ] MEMORY.md indexed + `project_payments_parity.md` file written.

### 6.5 Status

🟩 DONE — SHA: `166e447`

---

## Post-flight (after commit 5 lands)

Manual end-to-end verification against production:

- [ ] Wait one full cron tick (≤30 min after deploy of commit 5).
- [ ] Query: `SELECT id, status, "mpPaymentId" FROM "PoolPayment" WHERE id IN (<7 stuck ids>);`. Confirm each transitioned (most likely to COMPLETED if approved or FAILED if cancelled, a few may still be NOOP).
- [ ] `SELECT action, source, COUNT(*) FROM "AuditEvent" WHERE "createdAtUtc" > <deploy time> GROUP BY action, source;` — verify the reconciler wrote audit rows for each.
- [ ] Pick 1 RESCUED row and send the customer a courtesy email apologizing for the delay and confirming the pool was expanded (manual outreach).
- [ ] Do a fresh MP test purchase → confirm sync path now sends receipt email, writes PaymentEvent, fires admin notification.
- [ ] Tail prod logs for 24h — no new `[PaymentReconciler]` or `[MpReconciler]` errors.

---

## Rollback plan

- Revert 6 → docs lose references; harmless.
- Revert 5 → MP reconciler stops; stuck rows return to "no automated resolution" state, same as today. Existing handlers still work.
- Revert 4 → `mpPaymentId` stops getting populated by IPN. Reconciler falls back to search-by-external-reference. Slower but functional.
- Revert 3 → MP sync stops calling `markPaymentCompleted`. Reverts to current code (no email, no audit, no admin notification on sync). Polar still works.
- Revert 2 → Polar webhook reverts to inline implementation. No regression — that's what it was before.
- Revert 1 → `prisma migrate resolve --rolled-back` + `DROP COLUMN mpPaymentId` + `DROP INDEX`. Zero data loss (additive only).

Sequence if everything goes wrong: revert in reverse order (6 → 5 → 4 → 3 → 2 → 1). Each commit is independent enough to revert without cascade.

---

## Document version

- v1 — 2026-05-26 — locked alongside `PAYMENTS_PARITY_AUDIT.md` v2.
