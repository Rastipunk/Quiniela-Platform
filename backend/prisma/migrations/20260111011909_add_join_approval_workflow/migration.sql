-- AlterEnum
ALTER TYPE "PoolMemberStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "requireApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PoolMember" ADD COLUMN     "approvedAtUtc" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "PoolMember_status_idx" ON "PoolMember"("status");
