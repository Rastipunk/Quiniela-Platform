-- PoolPayment.amountCop — actual pesos paid (MP) in whole units.
-- Nullable because non-MP payments (Polar/USD) don't have a meaningful
-- COP figure, and historical MP payments need a separate backfill step
-- that uses the pricing library (tier-dependent, not reconstructible
-- from amountUsd alone).

ALTER TABLE "PoolPayment" ADD COLUMN "amountCop" INTEGER;
