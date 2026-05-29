# Picks4All — Repo Map (canonical)

> Generated 2026-05-28. Every source file in the repo was read in full by a 25-agent workflow (526 files / ~120,566 lines). This index points to the per-batch detail files; binary assets and i18n are in `00-assets-and-i18n.md`.

**Coverage:** 526/526 source files read in full. 1 file partially read: `backend/src/scripts/ucl_2025_fixtures.json` (613-line homogeneous generated fixture dump — structure verified, repeated entries not enumerated). See `../../REPO_AUDIT_TRACKER.md` coverage ledger.

## How this map is organized

- **`00-assets-and-i18n.md`** — 48 binaries + 75 i18n message files (inventory).
- **`part-NN.md`** — detailed per-file map: purpose, what each section does, exports, dependencies, flags.
- **`DEAD_CODE_FINDINGS.md`** — consolidated dead-code / junk / tech-debt findings (Phase 2).

## Batch index

| Part | Area | Files | Lines |
|---|---|---|---|
| [part-01](part-01.md) | .claude/settings.json | 88 | 5326 |
| [part-02](part-02.md) | Backend jobs + lib (A) | 22 | 3493 |
| [part-03](part-03.md) | Backend lib: email/templates/jwt/ga4 | 12 | 5446 |
| [part-04](part-04.md) | Backend lib: capi/pricing/scoring/schemas | 22 | 4672 |
| [part-05](part-05.md) | Backend lib (B) + middleware + pdf + admin routes | 26 | 5309 |
| [part-06](part-06.md) | Backend routes (A): admin/auth/corporate/pools | 18 | 5471 |
| [part-07](part-07.md) | Backend routes (B) + scripts + server.ts | 22 | 5479 |
| [part-08](part-08.md) | Backend services (A): admin/apiFootball/auth | 11 | 4794 |
| [part-09](part-09.md) | Backend services (B): corporate/standings/MP | 8 | 4695 |
| [part-10](part-10.md) | Backend services (C): payments/picks/polar | 5 | 4293 |
| [part-11](part-11.md) | Backend services (D): pool admin/state/results/sales | 10 | 5445 |
| [part-12](part-12.md) | Backend services (E) + types/validation + frontend e2e (A) | 25 | 5421 |
| [part-13](part-13.md) | Frontend e2e (B) + admin/dashboard/pool pages (A) | 44 | 5093 |
| [part-14](part-14.md) | Frontend pool tabs + activar/como-funciona | 18 | 5428 |
| [part-15](part-15.md) | Frontend public pages (A): SEO/login/WC2026 | 16 | 4699 |
| [part-16](part-16.md) | Frontend WC2026 + pago + regional SEO pages | 18 | 5083 |
| [part-17](part-17.md) | Frontend legal/verify + app metadata + components (A) | 19 | 5397 |
| [part-18](part-18.md) | Frontend components (B): admin sales/auth | 17 | 4766 |
| [part-19](part-19.md) | Frontend components (C): corporate/groupStandings | 16 | 4982 |
| [part-20](part-20.md) | Frontend components (D): landing/nav/locale | 14 | 4771 |
| [part-21](part-21.md) | Frontend components (E): pool-wizard steps | 17 | 5401 |
| [part-22](part-22.md) | Frontend components (F): wizard/branding/public | 13 | 3475 |
| [part-23](part-23.md) | Frontend components (G): scoring/contexts/hooks/i18n | 19 | 5473 |
| [part-24](part-24.md) | Frontend lib: api clients + utils | 40 | 5498 |
| [part-25](part-25.md) | Frontend proxy/types + infra config | 6 | 656 |

## Full file → batch lookup

<details><summary>All 526 files (click to expand)</summary>

**part-01:**
- `.claude/settings.json`
- `.claude/settings.local.json`
- `.github/dependabot.yml`
- `.gitignore`
- `backend/.env.example`
- `backend/.gitignore`
- `backend/package.json`
- `backend/prisma/migrations/20251228053519_init_m0_users_audit/migration.sql`
- `backend/prisma/migrations/20251229012150_m1_templates/migration.sql`
- `backend/prisma/migrations/20251229023309_m2_tournament_instances/migration.sql`
- `backend/prisma/migrations/20251229031315_m3_pools/migration.sql`
- `backend/prisma/migrations/20251229033447_m4_predictions/migration.sql`
- `backend/prisma/migrations/20251229035728_m5_results_leaderboard/migration.sql`
- `backend/prisma/migrations/20251229161106_pool_preset_and_deadline10/migration.sql`
- `backend/prisma/migrations/20260104023052_add_auto_advance_enabled_to_pool/migration.sql`
- `backend/prisma/migrations/20260104144925_add_username_nullable/migration.sql`
- `backend/prisma/migrations/20260104152912_add_google_oauth/migration.sql`
- `backend/prisma/migrations/20260104161019_add_penalties_and_locked_phases/migration.sql`
- `backend/prisma/migrations/20260105233315_add_pool_status/migration.sql`
- `backend/prisma/migrations/20260106001028_add_co_admin_role/migration.sql`
- `backend/prisma/migrations/20260111011909_add_join_approval_workflow/migration.sql`
- `backend/prisma/migrations/20260111021111_add_pool_fixture_snapshot/migration.sql`
- `backend/prisma/migrations/20260111022640_add_ban_fields_to_pool_member/migration.sql`
- `backend/prisma/migrations/20260111030521_add_user_profile_fields/migration.sql`
- `backend/prisma/migrations/20260111033030_add_user_timezone/migration.sql`
- `backend/prisma/migrations/20260111043847_add_pick_types_config/migration.sql`
- `backend/prisma/migrations/20260111060549_add_structural_predictions_and_results/migration.sql`
- `backend/prisma/migrations/20260112024547_add_granular_group_standings/migration.sql`
- `backend/prisma/migrations/20260112031332_add_version_reason_to_group_standings_result/migration.sql`
- `backend/prisma/migrations/20260126005503_add_legal_consent_and_documents/migration.sql`
- `backend/prisma/migrations/20260126013030_add_email_settings/migration.sql`
- `backend/prisma/migrations/20260126040000_add_email_verification_fields/migration.sql`
- `backend/prisma/migrations/20260126050000_promote_juan_to_admin/migration.sql`
- `backend/prisma/migrations/20260131120000_seed_legal_documents/migration.sql`
- `backend/prisma/migrations/20260205023730_add_auto_results_support/migration.sql`
- `backend/prisma/migrations/20260205035607_add_smart_sync_state/migration.sql`
- `backend/prisma/migrations/20260212221812_add_beta_feedback/migration.sql`
- `backend/prisma/migrations/20260212224550_add_contact_name_to_feedback/migration.sql`
- `backend/prisma/migrations/20260226120000_add_regulation_scores/migration.sql`
- `backend/prisma/migrations/20260312120000_add_compound_indexes_performance/migration.sql`
- `backend/prisma/migrations/20260319120000_add_pending_phase_sync/migration.sql`
- `backend/prisma/migrations/20260404120000_add_mute_reminders_to_pool/migration.sql`
- `backend/prisma/migrations/20260404140000_add_prediction_updates/migration.sql`
- `backend/prisma/migrations/20260406200000_add_scraper_provisional_and_scores_toggle/migration.sql`
- `backend/prisma/migrations/20260410_add_live_tracking_fields/migration.sql`
- `backend/prisma/migrations/20260411_add_last_extra_to_match_sync_state/migration.sql`
- `backend/prisma/migrations/20260413_add_payment_models/migration.sql`
- `backend/prisma/migrations/20260419_add_email_new_member_digest/migration.sql`
- `backend/prisma/migrations/20260419_add_email_suppression_and_pool_full_dedup/migration.sql`
- `backend/prisma/migrations/20260421_add_capi_dedup_and_failed_events/migration.sql`
- `backend/prisma/migrations/20260421_add_payment_meta_cookies/migration.sql`
- `backend/prisma/migrations/20260421_add_pool_payment_amount_cop/migration.sql`
- `backend/prisma/migrations/20260421_add_referral_graph/migration.sql`
- `backend/prisma/migrations/20260421_add_user_attribution_fields/migration.sql`
- `backend/prisma/migrations/20260421_refactor_dlq_and_ga4_mp/migration.sql`
- `backend/prisma/migrations/20260429_add_pools_config_json_to_inquiry/migration.sql`
- `backend/prisma/migrations/20260429_extend_organization_inquiry_quote_fields/migration.sql`
- `backend/prisma/migrations/20260501_add_organization_brand_colors/migration.sql`
- `backend/prisma/migrations/20260502_add_blocked_attempt_notify/migration.sql`
- `backend/prisma/migrations/20260502_add_capacity_warning_fields/migration.sql`
- `backend/prisma/migrations/20260503_add_corporate_invite_compound_index/migration.sql`
- `backend/prisma/migrations/20260503_add_mp_preference_id/migration.sql`
- `backend/prisma/migrations/20260503_add_org_branding_audit/migration.sql`
- `backend/prisma/migrations/20260504_add_pending_digest_throttle/migration.sql`
- `backend/prisma/migrations/20260512_add_user_locale_preference/migration.sql`
- `backend/prisma/migrations/20260512_user_locale_nullable/migration.sql`
- `backend/prisma/migrations/20260519_extend_payment_observability/migration.sql`
- `backend/prisma/migrations/20260521_pool_payment_initiated_state/migration.sql`
- `backend/prisma/migrations/20260522_add_sales_management/migration.sql`
- `backend/prisma/migrations/20260526_add_organization_invitation_locale/migration.sql`
- `backend/prisma/migrations/20260526_add_user_welcome_email_sent_at/migration.sql`
- `backend/prisma/migrations/20260527_add_mp_payment_id_and_status_index/migration.sql`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/schema.prisma`
- `backend/railway.toml`
- `backend/scripts/_test-cc-render.ts`
- `backend/scripts/_test-quote-render.ts`
- `backend/src/__tests__/api-helpers.ts`
- `backend/src/__tests__/auth.integration.test.ts`
- `backend/src/__tests__/catalog.integration.test.ts`
- `backend/src/__tests__/corporate.integration.test.ts`
- `backend/src/__tests__/features.integration.test.ts`
- `backend/src/__tests__/pools.integration.test.ts`
- `backend/src/__tests__/user.integration.test.ts`
- `backend/src/db.ts`
- `backend/src/jobs/accountReceivableExpiryJob.ts`
- `backend/src/jobs/capiRetryJob.ts`
- `backend/src/jobs/deadlineReminderJob.ts`

**part-02:**
- `backend/src/jobs/fixtureTrackingJob.ts`
- `backend/src/jobs/fixtureVerificationJob.ts`
- `backend/src/jobs/liveScoresJob.ts`
- `backend/src/jobs/mpPaymentReconcileJob.ts`
- `backend/src/jobs/newMemberDigestJob.ts`
- `backend/src/jobs/paymentReconcileJob.ts`
- `backend/src/jobs/phaseSyncJob.ts`
- `backend/src/jobs/resultSyncJob.ts`
- `backend/src/jobs/smartSyncJob.ts`
- `backend/src/jobs/trackStatusCheckerJob.ts`
- `backend/src/jobs/welcomeEmailFallbackJob.ts`
- `backend/src/lib/activationUrl.ts`
- `backend/src/lib/amountInWords.ts`
- `backend/src/lib/apiResponse.ts`
- `backend/src/lib/asyncHelpers.ts`
- `backend/src/lib/audit.ts`
- `backend/src/lib/authCookies.ts`
- `backend/src/lib/brand.test.ts`
- `backend/src/lib/brand.ts`
- `backend/src/lib/constants.test.ts`
- `backend/src/lib/constants.ts`
- `backend/src/lib/email.test.ts`

**part-03:**
- `backend/src/lib/email.ts`
- `backend/src/lib/emailTemplates.ts`
- `backend/src/lib/emailTemplates.xss.test.ts`
- `backend/src/lib/env.ts`
- `backend/src/lib/fixture.test.ts`
- `backend/src/lib/fixture.ts`
- `backend/src/lib/ga4.ts`
- `backend/src/lib/googleAuth.ts`
- `backend/src/lib/htmlSafe.ts`
- `backend/src/lib/issuerInfo.ts`
- `backend/src/lib/jwt.test.ts`
- `backend/src/lib/jwt.ts`

**part-04:**
- `backend/src/lib/logger.ts`
- `backend/src/lib/metaCapi.ts`
- `backend/src/lib/password.test.ts`
- `backend/src/lib/password.ts`
- `backend/src/lib/passwordRules.ts`
- `backend/src/lib/paymentEvents.ts`
- `backend/src/lib/pickPresets.test.ts`
- `backend/src/lib/pickPresets.ts`
- `backend/src/lib/poolCapacity.notify.test.ts`
- `backend/src/lib/poolCapacity.test.ts`
- `backend/src/lib/poolCapacity.ts`
- `backend/src/lib/poolHelpers.test.ts`
- `backend/src/lib/poolHelpers.ts`
- `backend/src/lib/pricing.test.ts`
- `backend/src/lib/pricing.ts`
- `backend/src/lib/roles.ts`
- `backend/src/lib/saleTerms.ts`
- `backend/src/lib/schemas.test.ts`
- `backend/src/lib/schemas.ts`
- `backend/src/lib/scoringAdvanced.test.ts`
- `backend/src/lib/scoringAdvanced.ts`
- `backend/src/lib/scoringBreakdown.test.ts`

**part-05:**
- `backend/src/lib/scoringBreakdown.ts`
- `backend/src/lib/scoringPresets.ts`
- `backend/src/lib/serializers.test.ts`
- `backend/src/lib/serializers.ts`
- `backend/src/lib/syntheticFixtureId.ts`
- `backend/src/lib/timezone.ts`
- `backend/src/lib/unsubscribe.ts`
- `backend/src/lib/username.test.ts`
- `backend/src/lib/username.ts`
- `backend/src/lib/utm.ts`
- `backend/src/lib/validateBase64Image.ts`
- `backend/src/middleware/rateLimit.test.ts`
- `backend/src/middleware/rateLimit.ts`
- `backend/src/middleware/requireAdmin.ts`
- `backend/src/middleware/requireAuth.ts`
- `backend/src/pdf/CcDocument.tsx`
- `backend/src/pdf/i18n.ts`
- `backend/src/pdf/pdfAssets.ts`
- `backend/src/pdf/pdfBrand.ts`
- `backend/src/pdf/pdfFont.ts`
- `backend/src/pdf/QuoteDocument.tsx`
- `backend/src/pdf/renderCcPdf.tsx`
- `backend/src/pdf/renderQuotePdf.tsx`
- `backend/src/routes/admin.ts`
- `backend/src/routes/adminAnalyticsDashboard.ts`
- `backend/src/routes/adminCorporate.ts`

**part-06:**
- `backend/src/routes/adminInstances.ts`
- `backend/src/routes/adminSales.ts`
- `backend/src/routes/adminSettings.ts`
- `backend/src/routes/adminTemplates.ts`
- `backend/src/routes/analyticsHealth.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/catalog.ts`
- `backend/src/routes/corporate.ts`
- `backend/src/routes/feedback.ts`
- `backend/src/routes/groupStandings.ts`
- `backend/src/routes/legal.ts`
- `backend/src/routes/me.ts`
- `backend/src/routes/payments.test.ts`
- `backend/src/routes/payments.ts`
- `backend/src/routes/pickPresets.ts`
- `backend/src/routes/picks.ts`
- `backend/src/routes/poolAdmin.ts`
- `backend/src/routes/poolInvites.ts`

**part-07:**
- `backend/src/routes/poolMembers.ts`
- `backend/src/routes/poolOverview.ts`
- `backend/src/routes/pools.ts`
- `backend/src/routes/resendWebhook.ts`
- `backend/src/routes/results.ts`
- `backend/src/routes/salesRedemption.ts`
- `backend/src/routes/structuralPicks.ts`
- `backend/src/routes/structuralResults.ts`
- `backend/src/routes/unsubscribe.ts`
- `backend/src/routes/userProfile.ts`
- `backend/src/schemas/templateData.ts`
- `backend/src/scripts/fetchUclData.ts`
- `backend/src/scripts/initSmartSyncStates.ts`
- `backend/src/scripts/migrateExtraTimeConfig.ts`
- `backend/src/scripts/seedAdmin.ts`
- `backend/src/scripts/seedLegalDocuments.ts`
- `backend/src/scripts/seedTestAccounts.ts`
- `backend/src/scripts/seedUcl2025.ts`
- `backend/src/scripts/seedWc2026Sandbox.ts`
- `backend/src/scripts/ucl_2025_fixtures.json`
- `backend/src/scripts/updateUclR16Draw.ts`
- `backend/src/server.ts`

**part-08:**
- `backend/src/services/adminInstanceService.ts`
- `backend/src/services/adminService.ts`
- `backend/src/services/advancementTrigger.ts`
- `backend/src/services/apiFootball/client.ts`
- `backend/src/services/apiFootball/index.ts`
- `backend/src/services/apiFootball/types.ts`
- `backend/src/services/authService.activateCorporate.test.ts`
- `backend/src/services/authService.security.test.ts`
- `backend/src/services/authService.ts`
- `backend/src/services/corporateBrandingService.ts`
- `backend/src/services/corporateService.test.ts`

**part-09:**
- `backend/src/services/corporateService.ts`
- `backend/src/services/deadlineReminderService.test.ts`
- `backend/src/services/deadlineReminderService.ts`
- `backend/src/services/groupStandingsService.test.ts`
- `backend/src/services/groupStandingsService.ts`
- `backend/src/services/instanceAdvancement.ts`
- `backend/src/services/mercadopago/client.ts`
- `backend/src/services/newMemberDigestService.ts`

**part-10:**
- `backend/src/services/paymentService.test.ts`
- `backend/src/services/paymentService.ts`
- `backend/src/services/pickService.ts`
- `backend/src/services/polar/client.ts`
- `backend/src/services/poolAdminService.scoringConfig.test.ts`

**part-11:**
- `backend/src/services/poolAdminService.ts`
- `backend/src/services/poolMemberService.ts`
- `backend/src/services/poolOverviewService.ts`
- `backend/src/services/poolStateMachine.test.ts`
- `backend/src/services/poolStateMachine.ts`
- `backend/src/services/resultService.ts`
- `backend/src/services/resultSync/index.ts`
- `backend/src/services/resultSync/service.ts`
- `backend/src/services/sales/accountReceivableService.ts`
- `backend/src/services/sales/documentCounterService.ts`

**part-12:**
- `backend/src/services/sales/quoteService.ts`
- `backend/src/services/scoresService/client.ts`
- `backend/src/services/scoresService/index.ts`
- `backend/src/services/smartSync/index.ts`
- `backend/src/services/smartSync/service.ts`
- `backend/src/services/structuralAutoPublish.ts`
- `backend/src/services/structuralScoring.ts`
- `backend/src/services/tournamentAdvancement.test.ts`
- `backend/src/services/tournamentAdvancement.ts`
- `backend/src/types/express.d.ts`
- `backend/src/types/numero-a-letras.d.ts`
- `backend/src/types/pickConfig.ts`
- `backend/src/validation/pickConfig.test.ts`
- `backend/src/validation/pickConfig.ts`
- `backend/tsconfig.json`
- `backend/vitest.config.ts`
- `backend/vitest.integration.config.ts`
- `frontend-next/.gitignore`
- `frontend-next/.railwayignore`
- `frontend-next/e2e/analytics-tracking.spec.ts`
- `frontend-next/e2e/auth-flow.spec.ts`
- `frontend-next/e2e/helpers/auth.ts`
- `frontend-next/e2e/helpers/pages.ts`
- `frontend-next/e2e/i18n-completeness.spec.ts`
- `frontend-next/e2e/i18n.spec.ts`

**part-13:**
- `frontend-next/e2e/invite-flow.spec.ts`
- `frontend-next/e2e/navigation.spec.ts`
- `frontend-next/e2e/pool-lifecycle.spec.ts`
- `frontend-next/e2e/prediction-subscription.spec.ts`
- `frontend-next/e2e/public-pages.spec.ts`
- `frontend-next/e2e/responsive.spec.ts`
- `frontend-next/e2e/seo-metadata.spec.ts`
- `frontend-next/e2e/visual-regression.spec.ts`
- `frontend-next/e2e/world-cup.spec.ts`
- `frontend-next/eslint.config.mjs`
- `frontend-next/next.config.ts`
- `frontend-next/package.json`
- `frontend-next/playwright.config.ts`
- `frontend-next/railway.toml`
- `frontend-next/src/app/[locale]/(authenticated)/admin/analytics-health/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/analytics/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/feedback/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/settings/email/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/[id]/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/nueva/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/[id]/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/nueva/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/AuthenticatedLayoutClient.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/crear-pool/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/dashboard/components/CreateJoinPanel.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/dashboard/components/LeavePoolModal.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/dashboard/components/PoolCard.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/dashboard/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/empresas/crear/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/error.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/layout.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/loading.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/AdminSettingsToggles.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ExpulsionModal.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ManageRulesPanel.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/MemberManagement.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/PendingJoinRequests.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/PhaseStatusPanel.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchPicksModal.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PickComponents.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolAdminTab.tsx`

**part-14:**
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolBrandingTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolLeaderboardTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolNavDrawer.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolRulesTab.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolSectionHeader.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolTypes.ts`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/ResultComponents.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/ScoringOverrideModal.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/loading.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/pools/join/page.tsx`
- `frontend-next/src/app/[locale]/(authenticated)/profile/page.tsx`
- `frontend-next/src/app/[locale]/activar-cuenta/page.tsx`
- `frontend-next/src/app/[locale]/como-funciona/page.tsx`

**part-15:**
- `frontend-next/src/app/[locale]/como-se-juega/HowToPlayContent.tsx`
- `frontend-next/src/app/[locale]/como-se-juega/page.tsx`
- `frontend-next/src/app/[locale]/empresas/page.tsx`
- `frontend-next/src/app/[locale]/error.tsx`
- `frontend-next/src/app/[locale]/faq/page.tsx`
- `frontend-next/src/app/[locale]/football-pool/page.tsx`
- `frontend-next/src/app/[locale]/forgot-password/ForgotPasswordContent.tsx`
- `frontend-next/src/app/[locale]/forgot-password/page.tsx`
- `frontend-next/src/app/[locale]/invite/layout.tsx`
- `frontend-next/src/app/[locale]/invite/page.tsx`
- `frontend-next/src/app/[locale]/layout.tsx`
- `frontend-next/src/app/[locale]/login/LoginContent.tsx`
- `frontend-next/src/app/[locale]/login/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/calendario/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/como-hacer-quiniela/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/grupos/page.tsx`

**part-16:**
- `frontend-next/src/app/[locale]/mundial-2026/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/predicciones/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/reglas-quiniela/page.tsx`
- `frontend-next/src/app/[locale]/mundial-2026/sedes/page.tsx`
- `frontend-next/src/app/[locale]/not-found.tsx`
- `frontend-next/src/app/[locale]/page.tsx`
- `frontend-next/src/app/[locale]/pago/cancelado/page.tsx`
- `frontend-next/src/app/[locale]/pago/checkout/page.tsx`
- `frontend-next/src/app/[locale]/pago/exitoso/page.tsx`
- `frontend-next/src/app/[locale]/pago/layout.tsx`
- `frontend-next/src/app/[locale]/penca-futbol/page.tsx`
- `frontend-next/src/app/[locale]/polla-futbolera/page.tsx`
- `frontend-next/src/app/[locale]/porra-deportiva/page.tsx`
- `frontend-next/src/app/[locale]/precios/page.tsx`
- `frontend-next/src/app/[locale]/precios/PricingPageContent.tsx`
- `frontend-next/src/app/[locale]/privacidad/page.tsx`
- `frontend-next/src/app/[locale]/privacidad/PrivacidadContent.tsx`
- `frontend-next/src/app/[locale]/prode-deportivo/page.tsx`

**part-17:**
- `frontend-next/src/app/[locale]/que-es-una-quiniela/page.tsx`
- `frontend-next/src/app/[locale]/reembolsos/page.tsx`
- `frontend-next/src/app/[locale]/reembolsos/ReembolsosContent.tsx`
- `frontend-next/src/app/[locale]/reset-password/page.tsx`
- `frontend-next/src/app/[locale]/reset-password/ResetPasswordContent.tsx`
- `frontend-next/src/app/[locale]/terminos/page.tsx`
- `frontend-next/src/app/[locale]/terminos/TerminosContent.tsx`
- `frontend-next/src/app/[locale]/verify-email/page.tsx`
- `frontend-next/src/app/[locale]/verify-email/VerifyEmailContent.tsx`
- `frontend-next/src/app/api/region/route.ts`
- `frontend-next/src/app/layout.tsx`
- `frontend-next/src/app/manifest.ts`
- `frontend-next/src/app/opengraph-image.tsx`
- `frontend-next/src/app/robots.ts`
- `frontend-next/src/app/sitemap.ts`
- `frontend-next/src/components/AccountReceivableRedemptionBox.tsx`
- `frontend-next/src/components/ActivationContent.tsx`
- `frontend-next/src/components/AdminAnalyticsContent.tsx`
- `frontend-next/src/components/AdminCcCreateContent.tsx`

**part-18:**
- `frontend-next/src/components/AdminCcDetailContent.tsx`
- `frontend-next/src/components/AdminCcsListContent.tsx`
- `frontend-next/src/components/AdminEmailSettingsContent.tsx`
- `frontend-next/src/components/AdminFeedbackContent.tsx`
- `frontend-next/src/components/AdminQuoteCreateContent.tsx`
- `frontend-next/src/components/AdminQuoteDetailContent.tsx`
- `frontend-next/src/components/AdminQuotesListContent.tsx`
- `frontend-next/src/components/AdminSalesHeader.tsx`
- `frontend-next/src/components/AnalyticsHealthContent.tsx`
- `frontend-next/src/components/AttributionCapture.tsx`
- `frontend-next/src/components/AuthAnalyticsSync.tsx`
- `frontend-next/src/components/AuthGuard.tsx`
- `frontend-next/src/components/AuthSlidePanel.tsx`
- `frontend-next/src/components/BrandLogo.tsx`
- `frontend-next/src/components/Breadcrumbs.tsx`
- `frontend-next/src/components/CapacitySelector.tsx`
- `frontend-next/src/components/CookieConsent.tsx`

**part-19:**
- `frontend-next/src/components/CorporateEmployeeManager.tsx`
- `frontend-next/src/components/CorporateQuotePanel.tsx`
- `frontend-next/src/components/EmailPreferencesSection.tsx`
- `frontend-next/src/components/EmailVerificationBanner.tsx`
- `frontend-next/src/components/EnterpriseLandingContent.tsx`
- `frontend-next/src/components/FAQAccordion.tsx`
- `frontend-next/src/components/FeedbackModal.tsx`
- `frontend-next/src/components/Footer.tsx`
- `frontend-next/src/components/groupStandings/BreakdownModal.tsx`
- `frontend-next/src/components/groupStandings/ClassicStandingsTable.tsx`
- `frontend-next/src/components/groupStandings/GroupStandingsCard.tsx`
- `frontend-next/src/components/groupStandings/MatchInputForm.tsx`
- `frontend-next/src/components/groupStandings/TeamListComponents.tsx`
- `frontend-next/src/components/groupStandings/types.ts`
- `frontend-next/src/components/GroupStandingsCard.tsx`
- `frontend-next/src/components/JsonLd.tsx`

**part-20:**
- `frontend-next/src/components/KnockoutMatchCard.tsx`
- `frontend-next/src/components/LandingContent.tsx`
- `frontend-next/src/components/LandingContentSSR.tsx`
- `frontend-next/src/components/LanguageSelector.tsx`
- `frontend-next/src/components/LocalePreferenceGate.tsx`
- `frontend-next/src/components/LocalePreferenceModal.tsx`
- `frontend-next/src/components/MetaPixelPageView.tsx`
- `frontend-next/src/components/MobileLeaderboard.tsx`
- `frontend-next/src/components/NavBar.tsx`
- `frontend-next/src/components/NotFoundContent.tsx`
- `frontend-next/src/components/NotificationBadge.tsx`
- `frontend-next/src/components/NotificationBanner.tsx`
- `frontend-next/src/components/PaginationControls.tsx`
- `frontend-next/src/components/PasswordStrengthIndicator.tsx`

**part-21:**
- `frontend-next/src/components/PhaseConfigStep.tsx`
- `frontend-next/src/components/PickRulesDisplay.tsx`
- `frontend-next/src/components/PlayerSummary.tsx`
- `frontend-next/src/components/PlayerSummaryStructural.tsx`
- `frontend-next/src/components/pool-wizard/ColorField.tsx`
- `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx`
- `frontend-next/src/components/pool-wizard/PoolWizardContext.tsx`
- `frontend-next/src/components/pool-wizard/PoolWizardNavButtons.tsx`
- `frontend-next/src/components/pool-wizard/PoolWizardProgressBar.tsx`
- `frontend-next/src/components/pool-wizard/PoolWizardStepContainer.tsx`
- `frontend-next/src/components/pool-wizard/steps/corporate/StepCompanyInfo.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepAdvancedRules.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepNameDetails.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepScoring.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepSummary.tsx`
- `frontend-next/src/components/pool-wizard/steps/StepTournament.tsx`

**part-22:**
- `frontend-next/src/components/pool-wizard/WizardSubStep.tsx`
- `frontend-next/src/components/pool/branding-previews/HeaderPreview.tsx`
- `frontend-next/src/components/pool/branding-previews/InvitationEmailPreview.tsx`
- `frontend-next/src/components/pool/branding-previews/WelcomeSplashPreview.tsx`
- `frontend-next/src/components/pool/PoolNav.tsx`
- `frontend-next/src/components/PoolConfigWizard.tsx`
- `frontend-next/src/components/PoolInviteCodeManager.tsx`
- `frontend-next/src/components/PredictionSubscribeButton.tsx`
- `frontend-next/src/components/PublicNavbar.tsx`
- `frontend-next/src/components/PublicPageWrapper.tsx`
- `frontend-next/src/components/RegionalArticlePage.tsx`
- `frontend-next/src/components/RegisterButton.tsx`
- `frontend-next/src/components/scoring-editor/presets.ts`

**part-23:**
- `frontend-next/src/components/scoring-editor/ScoringEditor.tsx`
- `frontend-next/src/components/ScoringBreakdownModal.tsx`
- `frontend-next/src/components/ShareButtons.tsx`
- `frontend-next/src/components/StructuralPicksManager.tsx`
- `frontend-next/src/components/TeamFlag.tsx`
- `frontend-next/src/components/ui/ToggleSwitch.tsx`
- `frontend-next/src/components/WhatsNewModal.tsx`
- `frontend-next/src/contexts/AuthPanelContext.tsx`
- `frontend-next/src/contexts/PoolTermContext.tsx`
- `frontend-next/src/data/languages.ts`
- `frontend-next/src/data/teamFlags.ts`
- `frontend-next/src/hooks/useAuth.ts`
- `frontend-next/src/hooks/useIsMobile.ts`
- `frontend-next/src/hooks/useLiveRefresh.ts`
- `frontend-next/src/hooks/usePoolNotifications.ts`
- `frontend-next/src/i18n/navigation.ts`
- `frontend-next/src/i18n/request.ts`
- `frontend-next/src/i18n/routing.ts`
- `frontend-next/src/lib/analytics.ts`

**part-24:**
- `frontend-next/src/lib/api/admin.ts`
- `frontend-next/src/lib/api/auth.ts`
- `frontend-next/src/lib/api/client.ts`
- `frontend-next/src/lib/api/corporate.ts`
- `frontend-next/src/lib/api/groupStandings.ts`
- `frontend-next/src/lib/api/index.ts`
- `frontend-next/src/lib/api/paymentAttemptEvent.ts`
- `frontend-next/src/lib/api/payments.ts`
- `frontend-next/src/lib/api/picks.ts`
- `frontend-next/src/lib/api/pools.ts`
- `frontend-next/src/lib/api/sales.ts`
- `frontend-next/src/lib/api/scoring.ts`
- `frontend-next/src/lib/api/user.ts`
- `frontend-next/src/lib/apiError.ts`
- `frontend-next/src/lib/attribution.ts`
- `frontend-next/src/lib/auth.ts`
- `frontend-next/src/lib/authAnalytics.ts`
- `frontend-next/src/lib/brand.ts`
- `frontend-next/src/lib/brandColors.ts`
- `frontend-next/src/lib/countries.ts`
- `frontend-next/src/lib/ecommerce.ts`
- `frontend-next/src/lib/employeeTemplate.ts`
- `frontend-next/src/lib/empty-polyfill.js`
- `frontend-next/src/lib/exportLeaderboard.ts`
- `frontend-next/src/lib/gtm.ts`
- `frontend-next/src/lib/metaPixel.ts`
- `frontend-next/src/lib/parseMarkdown.ts`
- `frontend-next/src/lib/poolTerms.ts`
- `frontend-next/src/lib/poolTypes.ts`
- `frontend-next/src/lib/pricing.ts`
- `frontend-next/src/lib/saleTerms.ts`
- `frontend-next/src/lib/sanitize.ts`
- `frontend-next/src/lib/seo.ts`
- `frontend-next/src/lib/siteConfig.ts`
- `frontend-next/src/lib/theme.ts`
- `frontend-next/src/lib/timezone.ts`
- `frontend-next/src/lib/timezones.ts`
- `frontend-next/src/lib/tournamentCatalog.ts`
- `frontend-next/src/lib/utm.ts`
- `frontend-next/src/lib/validation.ts`

**part-25:**
- `frontend-next/src/proxy.ts`
- `frontend-next/src/types/pickConfig.ts`
- `frontend-next/src/types/poolWizard.ts`
- `frontend-next/tsconfig.json`
- `infra/docker-compose.yml`
- `railway.toml`

</details>
