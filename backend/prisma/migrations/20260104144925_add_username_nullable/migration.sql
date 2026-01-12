-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT,
ADD COLUMN "resetToken" TEXT,
ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");
