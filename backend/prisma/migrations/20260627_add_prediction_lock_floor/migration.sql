-- Anti-cheat ratchet for host-reduced prediction deadlines (ADR-085).
-- Kickoff high-water mark: any match kicking off at/before this stays locked even
-- if a reduced deadline would otherwise reopen it (its predictions are already
-- visible). NULL = the deadline was never reduced.
ALTER TABLE "Pool" ADD COLUMN "predictionLockFloorUtc" TIMESTAMP(3);
