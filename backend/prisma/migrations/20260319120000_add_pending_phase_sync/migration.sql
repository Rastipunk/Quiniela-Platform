-- CreateEnum
CREATE TYPE "PhaseSyncStatus" AS ENUM ('PENDING', 'RESOLVED', 'FAILED');

-- CreateTable
CREATE TABLE "PendingPhaseSync" (
    "id" TEXT NOT NULL,
    "tournamentInstanceId" TEXT NOT NULL,
    "completedPhase" TEXT NOT NULL,
    "nextPhase" TEXT NOT NULL,
    "apiRoundName" TEXT NOT NULL,
    "status" "PhaseSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAtUtc" TIMESTAMP(3),
    "resolvedAtUtc" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingPhaseSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingPhaseSync_status_idx" ON "PendingPhaseSync"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingPhaseSync_tournamentInstanceId_nextPhase_key" ON "PendingPhaseSync"("tournamentInstanceId", "nextPhase");

-- AddForeignKey
ALTER TABLE "PendingPhaseSync" ADD CONSTRAINT "PendingPhaseSync_tournamentInstanceId_fkey" FOREIGN KEY ("tournamentInstanceId") REFERENCES "TournamentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
