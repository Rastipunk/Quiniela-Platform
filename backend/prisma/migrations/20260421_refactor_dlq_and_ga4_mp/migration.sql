-- Rename the CAPI-specific DLQ into a generic analytics DLQ that also
-- hosts GA4 Measurement Protocol failures. Adds a `provider` column to
-- discriminate sinks. Safe to run online: the new column defaults to
-- "META_CAPI" so existing rows keep their original semantics.

ALTER TABLE "FailedCapiEvent" RENAME TO "FailedAnalyticsEvent";

ALTER TABLE "FailedAnalyticsEvent"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'META_CAPI';

-- Old composite index on (nextRetryAt, resolvedAt) is superseded by a
-- three-column version that keeps lookups efficient per provider.
DROP INDEX IF EXISTS "FailedCapiEvent_nextRetryAt_resolvedAt_idx";
CREATE INDEX "FailedAnalyticsEvent_provider_nextRetryAt_resolvedAt_idx"
  ON "FailedAnalyticsEvent" ("provider", "nextRetryAt", "resolvedAt");

-- Single-column secondary index stays the same but with the new name.
DROP INDEX IF EXISTS "FailedCapiEvent_eventId_idx";
CREATE INDEX "FailedAnalyticsEvent_eventId_idx"
  ON "FailedAnalyticsEvent" ("eventId");

-- Rename primary-key constraint so Prisma picks it up when generating
-- the client without treating the table as untracked.
ALTER TABLE "FailedAnalyticsEvent"
  RENAME CONSTRAINT "FailedCapiEvent_pkey" TO "FailedAnalyticsEvent_pkey";
