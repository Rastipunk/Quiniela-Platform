-- AlterTable
ALTER TABLE "PoolMember" ADD COLUMN     "banExpiresAt" TIMESTAMP(3),
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedByUserId" TEXT;
