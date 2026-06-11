-- "Capricho San" (ADR-075): per-pool gifted feature. Host-togglable random
-- score assignment for players who miss the pick deadline. Availability is
-- gated by the CAPRICHO_SAN_POOL_IDS env allowlist; these columns only store
-- the host's choice. Additive + defaults => zero impact on existing rows.
ALTER TABLE "Pool" ADD COLUMN "caprichoSanEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pool" ADD COLUMN "caprichoSanMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pool" ADD COLUMN "caprichoSanMax" INTEGER NOT NULL DEFAULT 4;
