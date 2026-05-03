-- Audit trail for host-driven branding edits on a corporate
-- Organization. Each row captures who changed what and when, plus
-- before/after JSON snapshots scoped to only the fields that
-- actually changed in the update. Compliance + forensic use.

CREATE TABLE "OrganizationBrandingAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fieldsChanged" TEXT[],
  "beforeJson" JSONB NOT NULL,
  "afterJson" JSONB NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,

  CONSTRAINT "OrganizationBrandingAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationBrandingAudit_organizationId_changedAt_idx"
  ON "OrganizationBrandingAudit" ("organizationId", "changedAt");

CREATE INDEX "OrganizationBrandingAudit_userId_changedAt_idx"
  ON "OrganizationBrandingAudit" ("userId", "changedAt");

ALTER TABLE "OrganizationBrandingAudit"
  ADD CONSTRAINT "OrganizationBrandingAudit_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationBrandingAudit"
  ADD CONSTRAINT "OrganizationBrandingAudit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
