-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "scoringPresetKey" TEXT NOT NULL DEFAULT 'CLASSIC',
ALTER COLUMN "deadlineMinutesBeforeKickoff" SET DEFAULT 10;
