-- Mercado Pago preference ID for idempotent re-entry to initiateMpCheckout.
-- Without this, a double-click on "Pagar" creates two PoolPayment + two MP
-- preferences for the same poolId/targetCapacity, racing the customer into
-- paying both. By persisting the preferenceId we can detect a PENDING payment
-- and return the existing preference (mirrors Polar's polarCheckoutId reuse).
-- Nullable + additive: pre-existing rows stay valid (Polar payments never
-- populate this column anyway).
ALTER TABLE "PoolPayment"
  ADD COLUMN "mpPreferenceId" TEXT;
