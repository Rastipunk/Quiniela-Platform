-- Knockout phase release (admin-gated, ADR-084).
ALTER TABLE "TournamentInstance" ADD COLUMN "knockoutReleaseGateEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TournamentInstance" ADD COLUMN "releasedKnockoutPhases" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TournamentInstance" ADD COLUMN "knockoutBracketOverrides" JSONB NOT NULL DEFAULT '{}';
