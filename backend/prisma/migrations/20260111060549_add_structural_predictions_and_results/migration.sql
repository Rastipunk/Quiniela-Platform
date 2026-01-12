-- CreateTable
CREATE TABLE "StructuralPrediction" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "pickJson" JSONB NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructuralPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuralPhaseResult" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "publishedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructuralPhaseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructuralPrediction_userId_idx" ON "StructuralPrediction"("userId");

-- CreateIndex
CREATE INDEX "StructuralPrediction_poolId_idx" ON "StructuralPrediction"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "StructuralPrediction_poolId_userId_phaseId_key" ON "StructuralPrediction"("poolId", "userId", "phaseId");

-- CreateIndex
CREATE INDEX "StructuralPhaseResult_poolId_idx" ON "StructuralPhaseResult"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "StructuralPhaseResult_poolId_phaseId_key" ON "StructuralPhaseResult"("poolId", "phaseId");

-- AddForeignKey
ALTER TABLE "StructuralPrediction" ADD CONSTRAINT "StructuralPrediction_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuralPrediction" ADD CONSTRAINT "StructuralPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuralPhaseResult" ADD CONSTRAINT "StructuralPhaseResult_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuralPhaseResult" ADD CONSTRAINT "StructuralPhaseResult_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
