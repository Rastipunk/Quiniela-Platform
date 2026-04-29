-- Quote-specific fields for the /empresas "Solicitar cotización" panel.
-- All nullable so legacy inquiries (which only had companyName, contactName,
-- contactEmail, employeeCount tier) keep working without backfill.
--
-- - country:       ISO 3166-1 alpha-2 (e.g. "CO", "AR", "MX")
-- - currency:      "COP" or "USD" — the currency the requester wants quoted
-- - numberOfPools: how many pools they need
-- - slotsPerPool:  capacity per pool

ALTER TABLE "OrganizationInquiry"
  ADD COLUMN "country" TEXT,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "numberOfPools" INTEGER,
  ADD COLUMN "slotsPerPool" INTEGER;
