-- CreateEnum
CREATE TYPE "MatchSyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_FINISH', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "MatchSyncState" (
    "id" TEXT NOT NULL,
    "tournamentInstanceId" TEXT NOT NULL,
    "internalMatchId" TEXT NOT NULL,
    "syncStatus" "MatchSyncStatus" NOT NULL DEFAULT 'PENDING',
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "firstCheckAtUtc" TIMESTAMP(3),
    "finishCheckAtUtc" TIMESTAMP(3),
    "lastCheckedAtUtc" TIMESTAMP(3),
    "completedAtUtc" TIMESTAMP(3),
    "lastApiStatus" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSyncState_syncStatus_idx" ON "MatchSyncState"("syncStatus");

-- CreateIndex
CREATE INDEX "MatchSyncState_firstCheckAtUtc_idx" ON "MatchSyncState"("firstCheckAtUtc");

-- CreateIndex
CREATE INDEX "MatchSyncState_finishCheckAtUtc_idx" ON "MatchSyncState"("finishCheckAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSyncState_tournamentInstanceId_internalMatchId_key" ON "MatchSyncState"("tournamentInstanceId", "internalMatchId");

-- AddForeignKey
ALTER TABLE "MatchSyncState" ADD CONSTRAINT "MatchSyncState_tournamentInstanceId_fkey" FOREIGN KEY ("tournamentInstanceId") REFERENCES "TournamentInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
