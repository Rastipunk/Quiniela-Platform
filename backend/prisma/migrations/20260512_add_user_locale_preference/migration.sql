-- Per-user communication locale + first-login prompt tracking.
--
-- `locale` defaults to "es" (the platform's default locale per CLAUDE.md)
-- so every existing row gets populated immediately. The previous behaviour
-- — deriving locale from countryToLocale(country) at email-send time,
-- which returned "en" for any null/unmapped country — sent ~93% of
-- transactional emails in English even though our user base is ~95%
-- Spanish-speaking. The explicit column lets us:
--   1. ship a sane default ("es") regardless of country data,
--   2. capture the user's explicit choice via the first-login modal
--      (gated by `localePromptCompletedAt`),
--   3. record interest in unsupported locales (`requestedLocale`,
--      analytics-only, never used for render).
--
-- A backfill step in the same deploy promotes the 22 users with an
-- explicit country to their derived locale (CO/AR/MX/ES/VE/CR → es,
-- BR/PT → pt, others → keep the default "es"). The remaining 303 users
-- with null country stay at "es" — the same value they'd see if they
-- accept the default in the upcoming modal.

ALTER TABLE "User"
  ADD COLUMN "locale"                  VARCHAR(2)   NOT NULL DEFAULT 'es',
  ADD COLUMN "requestedLocale"         VARCHAR(8),
  ADD COLUMN "localePromptCompletedAt" TIMESTAMP(3);

-- Backfill: align locale with the country we already have for the 22
-- users with a non-null country. Anyone with no country, or a country
-- whose locale resolves to the existing default, keeps the "es" default
-- the ADD COLUMN gave them.
UPDATE "User"
   SET "locale" = 'pt'
 WHERE country IN ('BR', 'PT', 'AO', 'MZ', 'CV');

-- Index on the "needs prompt" gate. Frequently checked in /users/me/profile
-- and on app load, and almost always evaluates to false once users complete
-- the modal — partial index keeps the index lean.
CREATE INDEX "User_localePromptCompletedAt_null_idx"
  ON "User" ("localePromptCompletedAt")
  WHERE "localePromptCompletedAt" IS NULL;
