-- CreateEnum
CREATE TYPE "PlatformHealthSeverity" AS ENUM ('WARN', 'CRITICAL');

-- CreateTable
CREATE TABLE "PlatformHealthAlert" (
    "id" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "severity" "PlatformHealthSeverity" NOT NULL,
    "observedValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "details" TEXT,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformHealthAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformHealthAlert_alertKey_severity_resolvedAt_key"
    ON "PlatformHealthAlert"("alertKey", "severity", "resolvedAt");

-- CreateIndex
CREATE INDEX "PlatformHealthAlert_alertKey_idx" ON "PlatformHealthAlert"("alertKey");

-- CreateIndex
CREATE INDEX "PlatformHealthAlert_resolvedAt_idx" ON "PlatformHealthAlert"("resolvedAt");
