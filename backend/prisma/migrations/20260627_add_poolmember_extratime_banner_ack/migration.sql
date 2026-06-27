-- Knockout extra-time host banner (v2): one-time per (host,pool) acknowledgement.
ALTER TABLE "PoolMember" ADD COLUMN "extraTimeBannerAckAt" TIMESTAMP(3);
