-- Payment models for Polar.sh integration (pool capacity upgrades)

-- Payment status enum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- Pool payment records (one per checkout attempt)
CREATE TABLE "PoolPayment" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "polarCheckoutId" TEXT NOT NULL,
    "polarOrderId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountUsd" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "fromCapacity" INTEGER NOT NULL,
    "toCapacity" INTEGER NOT NULL,
    "poolType" TEXT NOT NULL,
    "paidAtUtc" TIMESTAMP(3),
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolPayment_pkey" PRIMARY KEY ("id")
);

-- Immutable webhook event audit log
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "polarEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "processedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraints for idempotency
CREATE UNIQUE INDEX "PoolPayment_polarCheckoutId_key" ON "PoolPayment"("polarCheckoutId");
CREATE UNIQUE INDEX "PoolPayment_polarOrderId_key" ON "PoolPayment"("polarOrderId");
CREATE UNIQUE INDEX "PaymentEvent_polarEventId_key" ON "PaymentEvent"("polarEventId");

-- Performance indexes
CREATE INDEX "PoolPayment_poolId_idx" ON "PoolPayment"("poolId");
CREATE INDEX "PoolPayment_userId_idx" ON "PoolPayment"("userId");
CREATE INDEX "PoolPayment_status_idx" ON "PoolPayment"("status");
CREATE INDEX "PaymentEvent_polarEventId_idx" ON "PaymentEvent"("polarEventId");

-- Foreign keys
ALTER TABLE "PoolPayment" ADD CONSTRAINT "PoolPayment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolPayment" ADD CONSTRAINT "PoolPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
