-- Persist Meta Advanced Matching signals at checkout creation so the
-- async webhook path (Polar + MP IPN) can emit Purchase events with
-- the same EMQ quality as the synchronous path.
ALTER TABLE "PoolPayment"
  ADD COLUMN "metaFbp"         TEXT,
  ADD COLUMN "metaFbc"         TEXT,
  ADD COLUMN "clientIpAddress" TEXT,
  ADD COLUMN "clientUserAgent" TEXT;
