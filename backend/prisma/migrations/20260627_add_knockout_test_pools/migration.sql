-- Canary "test release" per knockout phase (ADR-084).
-- Map phaseId → [poolId, ...]: a non-globally-released phase is still open for
-- predictions in these specific pools, so the admin can release to one pool,
-- verify end-to-end, then release to everyone.
ALTER TABLE "TournamentInstance" ADD COLUMN "knockoutPhaseTestPools" JSONB NOT NULL DEFAULT '{}';
