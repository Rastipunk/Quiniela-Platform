-- CreateEnum
CREATE TYPE "ResultSourceMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('HOST_MANUAL', 'HOST_PROVISIONAL', 'API_CONFIRMED', 'HOST_OVERRIDE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- DropForeignKey
ALTER TABLE "PoolMatchResultVersion" DROP CONSTRAINT "PoolMatchResultVersion_createdByUserId_fkey";

-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "emailDeadlineReminderEnabled" SET DEFAULT false;

-- AlterTable
ALTER TABLE "PoolMatchResultVersion" ADD COLUMN     "externalDataJson" JSONB,
ADD COLUMN     "externalFixtureId" INTEGER,
ADD COLUMN     "source" "ResultSource" NOT NULL DEFAULT 'HOST_MANUAL',
ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TournamentInstance" ADD COLUMN     "apiFootballLeagueId" INTEGER,
ADD COLUMN     "apiFootballSeasonId" INTEGER,
ADD COLUMN     "lastSyncAtUtc" TIMESTAMP(3),
ADD COLUMN     "resultSourceMode" "ResultSourceMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DeadlineReminderLog" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToEmail" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "hoursBeforeDeadline" INTEGER NOT NULL,

    CONSTRAINT "DeadlineReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchExternalMapping" (
    "id" TEXT NOT NULL,
    "tournamentInstanceId" TEXT NOT NULL,
    "internalMatchId" TEXT NOT NULL,
    "apiFootballFixtureId" INTEGER NOT NULL,
    "apiFootballHomeTeamId" INTEGER,
    "apiFootballAwayTeamId" INTEGER,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchExternalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultSyncLog" (
    "id" TEXT NOT NULL,
    "tournamentInstanceId" TEXT NOT NULL,
    "startedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAtUtc" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "fixturesChecked" INTEGER NOT NULL DEFAULT 0,
    "fixturesUpdated" INTEGER NOT NULL DEFAULT 0,
    "fixturesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "apiResponseTimeMs" INTEGER,
    "apiRateLimitRemaining" INTEGER,

    CONSTRAINT "ResultSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeadlineReminderLog_poolId_idx" ON "DeadlineReminderLog"("poolId");

-- CreateIndex
CREATE INDEX "DeadlineReminderLog_userId_idx" ON "DeadlineReminderLog"("userId");

-- CreateIndex
CREATE INDEX "DeadlineReminderLog_sentAt_idx" ON "DeadlineReminderLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminderLog_poolId_userId_matchId_key" ON "DeadlineReminderLog"("poolId", "userId", "matchId");

-- CreateIndex
CREATE INDEX "MatchExternalMapping_apiFootballFixtureId_idx" ON "MatchExternalMapping"("apiFootballFixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchExternalMapping_tournamentInstanceId_internalMatchId_key" ON "MatchExternalMapping"("tournamentInstanceId", "internalMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchExternalMapping_tournamentInstanceId_apiFootballFixtur_key" ON "MatchExternalMapping"("tournamentInstanceId", "apiFootballFixtureId");

-- CreateIndex
CREATE INDEX "ResultSyncLog_tournamentInstanceId_idx" ON "ResultSyncLog"("tournamentInstanceId");

-- CreateIndex
CREATE INDEX "ResultSyncLog_status_idx" ON "ResultSyncLog"("status");

-- CreateIndex
CREATE INDEX "ResultSyncLog_startedAtUtc_idx" ON "ResultSyncLog"("startedAtUtc");

-- CreateIndex
CREATE INDEX "PoolMatchResultVersion_source_idx" ON "PoolMatchResultVersion"("source");

-- CreateIndex
CREATE INDEX "TournamentInstance_resultSourceMode_idx" ON "TournamentInstance"("resultSourceMode");

-- CreateIndex
CREATE INDEX "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");

-- AddForeignKey
ALTER TABLE "PoolMatchResultVersion" ADD CONSTRAINT "PoolMatchResultVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchExternalMapping" ADD CONSTRAINT "MatchExternalMapping_tournamentInstanceId_fkey" FOREIGN KEY ("tournamentInstanceId") REFERENCES "TournamentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSyncLog" ADD CONSTRAINT "ResultSyncLog_tournamentInstanceId_fkey" FOREIGN KEY ("tournamentInstanceId") REFERENCES "TournamentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
