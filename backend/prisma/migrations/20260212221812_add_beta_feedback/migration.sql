-- CreateEnum
CREATE TYPE "BetaFeedbackType" AS ENUM ('BUG', 'SUGGESTION');

-- CreateTable
CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "type" "BetaFeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "imageBase64" TEXT,
    "wantsContact" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumber" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "currentUrl" TEXT,
    "userAgent" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetaFeedback_type_idx" ON "BetaFeedback"("type");

-- CreateIndex
CREATE INDEX "BetaFeedback_createdAtUtc_idx" ON "BetaFeedback"("createdAtUtc");
