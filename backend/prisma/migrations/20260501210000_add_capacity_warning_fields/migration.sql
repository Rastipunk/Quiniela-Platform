-- Capacity warning fields for Pool.
-- - capacityWarningNotifiedAt: when the "near-full" email was last sent to the host.
--   Cleared (set NULL) on capacity expansion so the alert can re-fire.
-- - capacityWarningThresholdPct: per-pool override of the warning threshold (1..99).
--   NULL means "use the global default from env CAPACITY_WARNING_THRESHOLD_PCT".
-- Both columns are nullable; existing rows get NULL and behave as if no warning has been sent yet,
-- which is the correct fail-safe state — the next join that crosses the threshold will trigger one.
ALTER TABLE "Pool"
  ADD COLUMN "capacityWarningNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "capacityWarningThresholdPct" INTEGER;
