-- One-time ack of the "you can now edit the prediction deadline" host banner (ADR-085).
ALTER TABLE "PoolMember" ADD COLUMN "deadlineConfigBannerAckAt" TIMESTAMP(3);
