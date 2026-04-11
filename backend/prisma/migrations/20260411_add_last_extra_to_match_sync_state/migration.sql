-- Add added-time minutes to MatchSyncState so the live ticker can display "45+3" / "90+5"
ALTER TABLE "MatchSyncState" ADD COLUMN "lastExtra" INTEGER;
