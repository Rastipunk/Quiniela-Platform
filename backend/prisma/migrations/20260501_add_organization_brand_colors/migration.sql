-- Custom branding colors for corporate organizations.
-- When NULL, the pool splash, header, and invitation email fall back
-- to the Picks4All default gradient. Stored as #RRGGBB hex strings.
ALTER TABLE "Organization"
  ADD COLUMN "primaryColor" TEXT,
  ADD COLUMN "secondaryColor" TEXT;
