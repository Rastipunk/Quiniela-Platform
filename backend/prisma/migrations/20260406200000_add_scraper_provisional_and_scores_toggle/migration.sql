-- AlterEnum
ALTER TYPE "ResultSource" ADD VALUE 'SCRAPER_PROVISIONAL';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "scoresServiceEnabled" BOOLEAN NOT NULL DEFAULT false;
