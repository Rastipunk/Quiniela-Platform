-- Add live tracking fields to MatchSyncState (picks4all-scores integration)
ALTER TABLE "MatchSyncState" ADD COLUMN "trackedAtUtc" TIMESTAMP(3);
ALTER TABLE "MatchSyncState" ADD COLUMN "graceEndUtc" TIMESTAMP(3);
ALTER TABLE "MatchSyncState" ADD COLUMN "lastElapsed" INTEGER;
ALTER TABLE "MatchSyncState" ADD COLUMN "lastLiveDataJson" JSONB;
