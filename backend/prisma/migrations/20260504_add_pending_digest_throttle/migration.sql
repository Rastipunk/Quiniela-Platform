-- Pending-approval digest throttle. Two nullable columns on Pool so the
-- daily digest cron can decide whether to email or stay silent. See the
-- inline schema comment + ADR-058 for the algorithm.
ALTER TABLE "Pool"
  ADD COLUMN "pendingDigestPendingHash"   TEXT,
  ADD COLUMN "pendingDigestStreakStartAt" TIMESTAMP(3);
