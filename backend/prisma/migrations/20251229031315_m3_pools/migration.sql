-- CreateEnum
CREATE TYPE "PoolVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PoolMemberRole" AS ENUM ('HOST', 'PLAYER');

-- CreateEnum
CREATE TYPE "PoolMemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'BANNED');

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "tournamentInstanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "PoolVisibility" NOT NULL DEFAULT 'PRIVATE',
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "deadlineMinutesBeforeKickoff" INTEGER NOT NULL DEFAULT 15,
    "createdByUserId" TEXT NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMember" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PoolMemberRole" NOT NULL DEFAULT 'PLAYER',
    "status" "PoolMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAtUtc" TIMESTAMP(3),

    CONSTRAINT "PoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolInvite" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAtUtc" TIMESTAMP(3),
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pool_tournamentInstanceId_idx" ON "Pool"("tournamentInstanceId");

-- CreateIndex
CREATE INDEX "Pool_createdByUserId_idx" ON "Pool"("createdByUserId");

-- CreateIndex
CREATE INDEX "PoolMember_userId_idx" ON "PoolMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMember_poolId_userId_key" ON "PoolMember"("poolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolInvite_code_key" ON "PoolInvite"("code");

-- CreateIndex
CREATE INDEX "PoolInvite_poolId_idx" ON "PoolInvite"("poolId");

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_tournamentInstanceId_fkey" FOREIGN KEY ("tournamentInstanceId") REFERENCES "TournamentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolInvite" ADD CONSTRAINT "PoolInvite_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolInvite" ADD CONSTRAINT "PoolInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
