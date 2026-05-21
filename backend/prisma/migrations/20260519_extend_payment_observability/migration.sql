-- Extend the payment domain to support full funnel observability.
-- See POLAR_AUDIT.md F-3, F-4, F-13, F-15, F-17, F-19 and ADR-060.
--
-- This migration is INTENTIONALLY ADDITIVE-ONLY at the data layer:
--   - No existing column is renamed.
--   - No existing column is dropped.
--   - Existing rows in PaymentEvent are valid after the migration
--     (polarEventId stays populated; new columns get defaults).
--   - PaymentStatus existing values remain valid; new values are
--     appended.
-- Therefore the migration is safe to apply on a populated production
-- database with zero downtime.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. PaymentStatus: add the new lifecycle states.
-- ─────────────────────────────────────────────────────────────────────────
-- PG 12+ supports ALTER TYPE ... ADD VALUE inside a transaction provided
-- the new value is NOT referenced later in the same transaction. We do
-- not reference these values anywhere else in this file (the application
-- code is what consumes them), so this is safe under Prisma's default
-- BEGIN/COMMIT wrap. Railway runs PG 16.
--
-- IF NOT EXISTS makes the migration idempotent — re-running on a database
-- where a previous attempt already added (some of) the values is a no-op
-- instead of a failure.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'INITIATED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. PaymentEvent: source column.
-- ─────────────────────────────────────────────────────────────────────────
-- Discriminates the origin of the event. Persisted as TEXT (not a Postgres
-- enum) so adding a new source is an additive change in application code,
-- not a schema migration. Default 'POLAR_WEBHOOK' is correct for the 3
-- pre-migration rows: they are all Polar `order.paid` webhook deliveries.
-- NOT NULL because every new row must declare its source explicitly.
ALTER TABLE "PaymentEvent"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'POLAR_WEBHOOK';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. PaymentEvent: poolPaymentId FK to PoolPayment.
-- ─────────────────────────────────────────────────────────────────────────
-- Nullable for two reasons:
--   (a) The 3 legacy rows do not have it set; backfilling them is a
--       separate concern and can be done lazily by looking up
--       payload.data.checkout_id → PoolPayment.polarCheckoutId.
--   (b) Future ad-hoc reconciler events may touch the whole table rather
--       than a specific payment.
-- ON DELETE SET NULL preserves the audit log if a PoolPayment is ever
-- hard-deleted (currently no code path does that, but defensive).
-- ON UPDATE CASCADE follows Prisma's default to keep the FK in sync if
-- the PoolPayment.id is ever re-assigned (also not done today).
ALTER TABLE "PaymentEvent"
  ADD COLUMN "poolPaymentId" TEXT;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_poolPaymentId_fkey"
  FOREIGN KEY ("poolPaymentId") REFERENCES "PoolPayment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentEvent_poolPaymentId_idx"
  ON "PaymentEvent"("poolPaymentId");

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PaymentEvent: webhook delivery metadata (F-19).
-- ─────────────────────────────────────────────────────────────────────────
-- Polar (and standardwebhooks-compatible providers) send `webhook-id` and
-- `webhook-timestamp` headers with every delivery. Persisting them lets us
-- correlate our PaymentEvent log with Polar's dashboard delivery log when
-- diagnosing missing or duplicate webhooks.
-- Both nullable: only webhook-origin rows have them.
ALTER TABLE "PaymentEvent"
  ADD COLUMN "webhookId" TEXT;

ALTER TABLE "PaymentEvent"
  ADD COLUMN "webhookTimestamp" TIMESTAMP(3);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. PaymentEvent: polarEventId becomes nullable + partial UNIQUE.
-- ─────────────────────────────────────────────────────────────────────────
-- Client-side beacons, reconciler-issued rows, and server-side transitions
-- have no gateway event ID — their identity is the row's own UUID. We
-- still need the ADR-046 idempotency contract for webhook rows: at most
-- one PaymentEvent per (polarEventId) when polarEventId is set.
-- Postgres partial unique index expresses exactly that.
--
-- Order of operations:
--   a) Drop the old UNIQUE index `PaymentEvent_polarEventId_key`.
--   b) Drop the NOT NULL constraint on the column.
--   c) Create the partial unique index that replaces the old one.
-- The non-unique `PaymentEvent_polarEventId_idx` index already exists
-- and remains untouched — it's still useful for lookups by event ID.
ALTER TABLE "PaymentEvent" ALTER COLUMN "polarEventId" DROP NOT NULL;

DROP INDEX "PaymentEvent_polarEventId_key";

CREATE UNIQUE INDEX "PaymentEvent_polarEventId_unique_when_set"
  ON "PaymentEvent"("polarEventId")
  WHERE "polarEventId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. PaymentEvent: composite index for funnel queries.
-- ─────────────────────────────────────────────────────────────────────────
-- Reconciliation, analytics, and admin dashboards filter by (source,
-- eventType) frequently. The composite index covers those plans without
-- forcing a Seq Scan as the table grows.
CREATE INDEX "PaymentEvent_source_eventType_idx"
  ON "PaymentEvent"("source", "eventType");
