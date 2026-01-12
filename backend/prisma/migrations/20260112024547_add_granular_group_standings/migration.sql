-- CreateTable
CREATE TABLE "GroupStandingsPrediction" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teamIds" TEXT[],
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupStandingsPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStandingsResult" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teamIds" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "publishedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupStandingsResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupStandingsPrediction_poolId_idx" ON "GroupStandingsPrediction"("poolId");

-- CreateIndex
CREATE INDEX "GroupStandingsPrediction_userId_idx" ON "GroupStandingsPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStandingsPrediction_poolId_userId_phaseId_groupId_key" ON "GroupStandingsPrediction"("poolId", "userId", "phaseId", "groupId");

-- CreateIndex
CREATE INDEX "GroupStandingsResult_poolId_idx" ON "GroupStandingsResult"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStandingsResult_poolId_phaseId_groupId_key" ON "GroupStandingsResult"("poolId", "phaseId", "groupId");

-- AddForeignKey
ALTER TABLE "GroupStandingsPrediction" ADD CONSTRAINT "GroupStandingsPrediction_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingsPrediction" ADD CONSTRAINT "GroupStandingsPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingsResult" ADD CONSTRAINT "GroupStandingsResult_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingsResult" ADD CONSTRAINT "GroupStandingsResult_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
