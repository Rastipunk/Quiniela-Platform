-- Two additive changes preparing for the MP reconciler (commit 5).
-- Zero data loss, zero behavioural change at this migration point.
--
-- 1) PoolPayment.mpPaymentId — populated by the IPN handler on first
--    delivery (commit 4). The MP reconciler reads it to call
--    getPayment(mpPaymentId) and resolve stuck rows. Legacy rows
--    (existing before this column landed) keep NULL until the
--    reconciler resolves them via payments/search by external_reference.
--
-- 2) Compound index on (status, createdAtUtc) — covers both reconcilers'
--    stale-row queries (Polar's findStalePayments + the new MP one).
--    The existing single-column index on status alone forces a sequential
--    scan within the bucket to filter by createdAtUtc; this fixes that.
--
-- See PAYMENTS_PARITY_AUDIT.md §3.5 and §3.6.

ALTER TABLE "PoolPayment"
  ADD COLUMN "mpPaymentId" TEXT;

CREATE INDEX "PoolPayment_status_createdAtUtc_idx"
  ON "PoolPayment"("status", "createdAtUtc");
