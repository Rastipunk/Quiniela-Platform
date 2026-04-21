-- Referral graph: user-to-user attribution and per-invite redemption.

-- User.referredByUserId — who brought this user to the platform. Self-FK.
ALTER TABLE "User" ADD COLUMN "referredByUserId" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_referredByUserId_fkey"
  FOREIGN KEY ("referredByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_referredByUserId_idx" ON "User" ("referredByUserId");

-- PoolInvite: record the FIRST redeemer of a code plus the moment. Kept
-- nullable because single-use invites may be unused; multi-use invites
-- keep the very first joiner as the headline referrer and downstream
-- analytics can enumerate the full list via audit events.
ALTER TABLE "PoolInvite"
  ADD COLUMN "acceptedByUserId" TEXT,
  ADD COLUMN "acceptedAtUtc"    TIMESTAMP(3);

CREATE INDEX "PoolInvite_acceptedByUserId_idx"
  ON "PoolInvite" ("acceptedByUserId");
