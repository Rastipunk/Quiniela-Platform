-- Add isTest flag to TournamentInstance so test instances can be excluded
-- from the public catalog (GET /catalog/instances) even when ACTIVE.
-- Additive, safe: defaults to false for all existing rows.
ALTER TABLE "TournamentInstance" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
