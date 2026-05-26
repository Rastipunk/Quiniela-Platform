-- Track whether the welcome email has shipped for each user.
-- NULL = pending (not yet sent) or not yet eligible (newly created).
-- A non-null timestamp marks the moment the welcome was dispatched
-- either by POST /users/me/locale-preference (happy path) or by the
-- welcomeEmailFallbackJob (24h safety net).
--
-- Additive only, zero behavioural change for existing users — every
-- existing User row gets NULL, which the new dispatch logic treats
-- as "already settled, do not retry" via the fallback job's join
-- with createdAtUtc (existing rows are all older than 24h, so they
-- would qualify; the fallback job's first run could re-welcome
-- everyone. Backfill below prevents that).
--
-- See EMAIL_LOCALE_HANDOFF_AUDIT.md §3.

ALTER TABLE "User"
  ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);

-- Backfill: every user that already exists is presumed to have
-- received their welcome (or chosen not to). Mark them all as
-- "sent" with their creation timestamp so the fallback job ignores
-- them on its first tick. Without this backfill the first job run
-- would attempt to re-welcome the entire existing user base.
UPDATE "User"
  SET "welcomeEmailSentAt" = "createdAtUtc"
  WHERE "welcomeEmailSentAt" IS NULL;
