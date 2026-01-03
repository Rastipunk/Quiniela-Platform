-- CreateEnum
CREATE TYPE "ResultVersionStatus" AS ENUM ('PUBLISHED');

-- CreateTable
CREATE TABLE "PoolMatchResult" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMatchResultVersion" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ResultVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolMatchResultVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolMatchResult_currentVersionId_key" ON "PoolMatchResult"("currentVersionId");

-- CreateIndex
CREATE INDEX "PoolMatchResult_poolId_idx" ON "PoolMatchResult"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMatchResult_poolId_matchId_key" ON "PoolMatchResult"("poolId", "matchId");

-- CreateIndex
CREATE INDEX "PoolMatchResultVersion_resultId_idx" ON "PoolMatchResultVersion"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMatchResultVersion_resultId_versionNumber_key" ON "PoolMatchResultVersion"("resultId", "versionNumber");

-- AddForeignKey
ALTER TABLE "PoolMatchResult" ADD CONSTRAINT "PoolMatchResult_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMatchResult" ADD CONSTRAINT "PoolMatchResult_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "PoolMatchResultVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMatchResultVersion" ADD CONSTRAINT "PoolMatchResultVersion_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "PoolMatchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMatchResultVersion" ADD CONSTRAINT "PoolMatchResultVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
