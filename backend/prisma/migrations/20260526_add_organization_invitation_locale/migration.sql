-- Add the per-organization "first email" locale.
-- Governs ONLY the corporate activation email. Once the employee
-- activates the account and completes LocalePreferenceModal, User.locale
-- takes over for every downstream email. See CORPORATE_LOCALE_AUDIT.md §3.2.
--
-- Additive only, zero data loss, zero behavioural change for existing
-- pools (the DEFAULT 'es' replicates today's hardcoded fallback).

ALTER TABLE "Organization"
  ADD COLUMN "invitationLocale" TEXT NOT NULL DEFAULT 'es';
