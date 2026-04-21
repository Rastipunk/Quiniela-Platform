-- AlterTable: store Meta event_id for browser↔CAPI deduplication
ALTER TABLE "PoolPayment" ADD COLUMN "metaEventId" TEXT;

-- CreateTable: dead-letter queue for failed Meta CAPI events
CREATE TABLE "FailedCapiEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedCapiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedCapiEvent_nextRetryAt_resolvedAt_idx" ON "FailedCapiEvent"("nextRetryAt", "resolvedAt");

-- CreateIndex
CREATE INDEX "FailedCapiEvent_eventId_idx" ON "FailedCapiEvent"("eventId");
