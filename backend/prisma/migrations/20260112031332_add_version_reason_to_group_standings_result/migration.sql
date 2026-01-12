-- AlterTable
ALTER TABLE "GroupStandingsResult" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
