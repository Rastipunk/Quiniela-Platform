-- Public "Evolución" share link: short per-pool code (generated on demand).
ALTER TABLE "Pool" ADD COLUMN "shareCode" TEXT;
CREATE UNIQUE INDEX "Pool_shareCode_key" ON "Pool"("shareCode");
