-- AlterTable: first-touch marketing attribution on User
ALTER TABLE "User"
  ADD COLUMN "acquisitionSource"   TEXT,
  ADD COLUMN "acquisitionMedium"   TEXT,
  ADD COLUMN "acquisitionCampaign" TEXT,
  ADD COLUMN "acquisitionContent"  TEXT,
  ADD COLUMN "acquisitionTerm"     TEXT,
  ADD COLUMN "landingPath"         TEXT,
  ADD COLUMN "referrerUrl"         TEXT,
  ADD COLUMN "gclid"               TEXT,
  ADD COLUMN "gbraid"              TEXT,
  ADD COLUMN "wbraid"              TEXT,
  ADD COLUMN "fbclid"              TEXT;
