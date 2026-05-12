-- Follow-up to 20260512_add_user_locale_preference.
--
-- Make User.locale nullable. The rationale changed mid-design: an
-- explicit "no value yet" state lets `resolveUserLocale` distinguish
-- "user has not chosen" from "user chose Spanish". The previous
-- non-null + default('es') made every pre-existing user indistinguishable
-- from someone who explicitly picked Spanish — which would have silenced
-- the country-based signal we want for anglophone users until the
-- mandatory modal captures their choice.
--
-- Semantics from now on:
--   locale = NULL  → fall back to countryToLocale(country); default is ES
--   locale = 'es'  → user explicitly picked Spanish in the modal
--   locale = 'en'  → user explicitly picked English in the modal
--   locale = 'pt'  → user explicitly picked Portuguese in the modal
--
-- The prior backfill (BR/PT/AO/MZ/CV → 'pt') is also reverted: those
-- users never explicitly chose Portuguese; the country-based resolver
-- will still give them PT once the helper runs. Keeping the value would
-- have impersonated an explicit choice.

ALTER TABLE "User" ALTER COLUMN "locale" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "locale" DROP NOT NULL;
UPDATE "User" SET "locale" = NULL;
