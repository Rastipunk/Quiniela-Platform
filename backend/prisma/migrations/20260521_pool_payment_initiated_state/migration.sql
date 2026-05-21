-- Make PoolPayment.polarCheckoutId nullable so a row can be persisted in
-- the new INITIATED state BEFORE we call Polar. Replaces the UNIQUE
-- constraint with a partial unique index — same pattern we applied to
-- PaymentEvent.polarEventId in 20260519.
--
-- See POLAR_AUDIT.md F-4 and ADR-060.
--
-- Additive-only at the data layer:
--   - Existing 13 PoolPayment rows all have polarCheckoutId set; they
--     remain valid (the new column type is the strict superset).
--   - The new partial unique index enforces the original uniqueness
--     guarantee only when the value is present, leaving INITIATED rows
--     (polarCheckoutId NULL) free to coexist.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Drop the old UNIQUE index.
-- ─────────────────────────────────────────────────────────────────────────
-- Verified against production: PoolPayment_polarCheckoutId_key is a plain
-- UNIQUE INDEX (not backed by a table constraint), same as
-- PaymentEvent_polarEventId_key was. DROP INDEX is therefore the correct
-- operation here; DROP CONSTRAINT would error with 42704 (which is
-- exactly what happened on the first attempt — fix per second run).
DROP INDEX "PoolPayment_polarCheckoutId_key";

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Relax the NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "PoolPayment" ALTER COLUMN "polarCheckoutId" DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Replace with a partial unique index.
-- ─────────────────────────────────────────────────────────────────────────
-- Guarantees: at most one PoolPayment per polarCheckoutId WHEN the value
-- is non-NULL. INITIATED rows (NULL) are unconstrained. Webhook lookups
-- by polarCheckoutId still hit the index.
CREATE UNIQUE INDEX "PoolPayment_polarCheckoutId_unique_when_set"
  ON "PoolPayment"("polarCheckoutId")
  WHERE "polarCheckoutId" IS NOT NULL;
