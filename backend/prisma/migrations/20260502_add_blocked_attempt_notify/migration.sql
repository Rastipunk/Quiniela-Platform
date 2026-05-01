-- Throttle the "blocked join attempt" email to the host so a burst of failed
-- joins (bots, link-sharing storms) doesn't spam the inbox. Caller compares
-- this timestamp against now() - throttle window before sending.
ALTER TABLE "Pool"
  ADD COLUMN "lastBlockedAttemptNotifiedAt" TIMESTAMP(3);
