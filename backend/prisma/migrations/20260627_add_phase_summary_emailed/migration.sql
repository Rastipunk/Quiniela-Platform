-- Phase-summary email idempotency per pool (ADR-084).
-- Array of phaseIds for which the phase-summary email was already broadcast on
-- release, so re-releasing the same phase does not re-send.
ALTER TABLE "Pool" ADD COLUMN "phaseSummaryEmailedPhases" JSONB NOT NULL DEFAULT '[]';
