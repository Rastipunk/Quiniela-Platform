-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "lockedPhases" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "PoolMatchResultVersion" ADD COLUMN     "awayPenalties" INTEGER,
ADD COLUMN     "homePenalties" INTEGER;
