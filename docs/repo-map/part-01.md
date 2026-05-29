## Batch 1

This batch covers repo/build configuration, the full Prisma migration history, the consolidated `schema.prisma`, the Railway deploy config, two manual PDF smoke-test scripts, the shared Prisma client, three cron jobs, and the backend integration test suite (which runs against the live production API).

---

### .claude/settings.json

**Purpose:** Project-scoped Claude Code permission configuration committed to the repo.

**What it does:** Defines a `permissions` object with three lists. `allow` whitelists `Read`, `Edit`, `Glob`, `Grep`, and a set of read-only Bash commands (`git status`, `git diff`, `git log`, `npm`, `node`, `npx`). `ask` requires confirmation for `docker`, `git commit`, `git push`, and file-deletion commands (`rm`, `del`, `rmdir`). `deny` is empty.

**Exports:** n/a (config).

**Key dependencies:** Consumed by the Claude Code harness.

**Flags:** none.

---

### .claude/settings.local.json

**Purpose:** Developer-local (un-shared) permission allowlist that has accumulated over many sessions.

**What it does:** A large `permissions.allow` list of specific Bash invocations and `WebFetch` domains accreted during development — git operations, Railway CLI commands, `psql`, `python`, file-move loops, winget installs of GitHub CLI, and many `WebFetch(domain:...)` entries for sports-data and payment-provider research.

**Exports:** n/a (config).

**Key dependencies:** Claude Code harness.

**Flags:** Contains hard-coded secrets that should not be in version control: a production `DATABASE_URL` (line 71) with the Postgres password, and two long-lived JWT bearer tokens embedded as `allow` entries (lines 47, 62). These are credential leaks even if expired. `WebFetch` allowances for `docs.lemonsqueezy.com`/`www.lemonsqueezy.com` reference Lemon Squeezy, a rejected/abandoned payment processor (replaced by Polar + Mercado Pago). This file is `.local.json` and normally git-ignored.

---

### .github/dependabot.yml

**Purpose:** Dependabot configuration for automated dependency PRs.

**What it does:** Schema version 2. Three weekly update streams: npm in `/backend` (labels `dependencies`, `backend`, max 5 PRs, Monday), npm in `/frontend-next` (labels `dependencies`, `frontend`, max 5, Monday), and `github-actions` in `/` (labels `dependencies`, `ci`, max 3).

**Exports:** n/a.

**Key dependencies:** GitHub Dependabot.

**Flags:** none.

---

### .gitignore

**Purpose:** Root-level git ignore rules for the monorepo.

**What it does:** Ignores `node_modules`, npm/yarn debug logs, all `.env*.local` variants and `.env`, build outputs (`dist/`, `build/`, `*.tsbuildinfo`), IDE folders, OS cruft, logs, SQLite/DB files, coverage, temp `*_temp/` Prisma migration dirs, temp files, Next.js artifacts (`.next/`, `.vercel/`), and Windows-specific artifacts (`[Cc]:Users*`, a stray `√`, `desktop.ini`). Explicitly ignores `backend/scripts/growth-snapshot/` with a comment noting it contains user emails and payment amounts.

**Exports:** n/a.

**Key dependencies:** git.

**Flags:** none.

---

### backend/.env.example

**Purpose:** Template documenting the backend's environment variables.

**What it does:** Lists `DATABASE_URL`, `JWT_SECRET`, `PORT`/`FRONTEND_URL`, optional Google OAuth (`GOOGLE_CLIENT_ID`), Resend email (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`), API-Football integration toggles (`API_FOOTBALL_KEY`, `API_FOOTBALL_ENABLED`), Smart Sync toggles (`SMART_SYNC_ENABLED`, `RESULT_SYNC_ENABLED`), and seed-script test account credentials (admin/host/player email + password).

**Exports:** n/a.

**Key dependencies:** Documents config consumed throughout `backend/src`.

**Flags:** This template predates the current payment stack — it lists no Polar, Mercado Pago, Meta CAPI, or GA4 variables despite those being live features. Stale relative to the current `schema.prisma`/jobs.

---

### backend/.gitignore

**Purpose:** Backend-specific git ignore rules.

**What it does:** Ignores `node_modules`, `.env`, the generated Prisma client (`/src/generated/prisma`), and all compiled TypeScript output (`*.d.ts`, `*.js`, `*.js.map` and map variants) — with exceptions to keep `jest.config.js`, `*.test.js`, and hand-written `src/types/*.d.ts`. Also ignores temp files, `nul`, and `_test-*.pdf` (the smoke-test PDF outputs).

**Exports:** n/a.

**Key dependencies:** git.

**Flags:** Mentions `jest.config.js` although the project uses Vitest (per package.json). Minor stale exception, harmless.

---

### backend/package.json

**Purpose:** Backend package manifest, scripts, and dependency pins.

**What it does:** Name `picks4all-backend` v1.0.0, CommonJS, Node >=22. Scripts: `dev` (ts-node-dev), `build` (prisma generate + tsc + copies `src/assets` to `dist/assets`), `start` (rolls back the seed-legal migration via `prisma migrate resolve --rolled-back`, then `migrate deploy`, then runs `dist/server.js`), several `seed:*` scripts (admin, test accounts, WC2026 sandbox, legal, UCL2025), `init:smart-sync`, `script:*` one-offs (fetch UCL, update R16 draw, migrate extra-time config), and Vitest test scripts (`test`, `test:watch`, `test:coverage`, `test:integration` with a separate config). Dependencies include `@polar-sh/sdk`, `@prisma/client`, `@react-pdf/renderer`, `bcrypt`, `cookie-parser`, `cors`, `express` 5, `express-rate-limit`, `google-auth-library`, `helmet`, `jsonwebtoken`, `mercadopago`, `node-cron`, `numero-a-letras`, `resend`, `standardwebhooks`, `zod` 4. Dev deps: `prisma`, `ts-node-dev`, `vitest`.

**Exports:** n/a.

**Key dependencies:** Polar SDK, Mercado Pago SDK, Prisma, React-PDF (for quote/CC rendering), Resend, standardwebhooks (Polar webhook verification), numero-a-letras (amount-in-words for cuentas de cobro).

**Flags:** The `start` script hard-codes a one-off rollback of migration `20260131120000_seed_legal_documents` on every boot (`|| true`) — a permanent workaround for a failed/poisoned migration that should eventually be cleaned up. No `wompi`/`lemonsqueezy` deps present, consistent with their deprecation.

---

### backend/prisma/migrations/20251228053519_init_m0_users_audit/migration.sql

**Purpose:** Initial schema — users and audit log.

**What it does:** Creates enums `PlatformRole` (ADMIN/HOST/PLAYER) and `UserStatus` (ACTIVE/DISABLED). Creates `User` (id, email, displayName, passwordHash, platformRole default PLAYER, status default ACTIVE, created/updated timestamps) and `AuditEvent` (actorUserId, action, entityType/Id, poolId, dataJson, ip, userAgent). Adds a unique index on `User.email`.

**Exports/schema delta:** Tables `User`, `AuditEvent`; enums `PlatformRole`, `UserStatus`; unique index `User_email_key`.

**Flags:** none.

---

### backend/prisma/migrations/20251229012150_m1_templates/migration.sql

**Purpose:** Tournament template + versioning model.

**What it does:** Enums `TemplateStatus` and `TemplateVersionStatus` (DRAFT/PUBLISHED/DEPRECATED each). Tables `TournamentTemplate` (key unique, name, status, `currentPublishedVersionId`) and `TournamentTemplateVersion` (templateId, versionNumber, status, `dataJson`, publishedAt). Unique indexes on template key, current published version, and (templateId, versionNumber). FKs link version→template and the current-version pointer.

**Schema delta:** Tables + 2 enums + the noted indexes/FKs.

**Flags:** none.

---

### backend/prisma/migrations/20251229023309_m2_tournament_instances/migration.sql

**Purpose:** Concrete tournament instances created from template versions.

**What it does:** Enum `TournamentInstanceStatus` (DRAFT/ACTIVE/COMPLETED/ARCHIVED). Table `TournamentInstance` (templateId, templateVersionId, name, status, frozen `dataJson` snapshot). Indexes on templateId/templateVersionId; FKs to template and template version.

**Schema delta:** Table `TournamentInstance` + enum + indexes/FKs.

**Flags:** none.

---

### backend/prisma/migrations/20251229031315_m3_pools/migration.sql

**Purpose:** Pools, memberships, and invite codes.

**What it does:** Enums `PoolVisibility` (PRIVATE/PUBLIC), `PoolMemberRole` (HOST/PLAYER), `PoolMemberStatus` (ACTIVE/LEFT/BANNED). Tables `Pool` (tournamentInstanceId, name, visibility, timeZone, `deadlineMinutesBeforeKickoff` default 15, createdByUserId), `PoolMember` (poolId, userId, role, status, joined/left timestamps; unique on poolId+userId), `PoolInvite` (poolId, unique code, maxUses, uses, expiry). FKs and supporting indexes.

**Schema delta:** Tables `Pool`, `PoolMember`, `PoolInvite` + 3 enums.

**Flags:** none.

---

### backend/prisma/migrations/20251229033447_m4_predictions/migration.sql

**Purpose:** Per-match predictions.

**What it does:** Table `Prediction` (poolId, userId, matchId, `pickJson`); unique on (poolId, userId, matchId); indexes on userId and poolId; FKs to Pool and User.

**Schema delta:** Table `Prediction`.

**Flags:** none.

---

### backend/prisma/migrations/20251229035728_m5_results_leaderboard/migration.sql

**Purpose:** Versioned official match results (errata trail).

**What it does:** Enum `ResultVersionStatus` (PUBLISHED). Table `PoolMatchResult` (poolId, matchId, pointer `currentVersionId`) and `PoolMatchResultVersion` (resultId, versionNumber, status, homeGoals, awayGoals, optional reason, createdByUserId, publishedAt). Unique indexes (poolId+matchId), (resultId+versionNumber); FK wiring including the current-version pointer.

**Schema delta:** Tables `PoolMatchResult`, `PoolMatchResultVersion` + enum.

**Flags:** none.

---

### backend/prisma/migrations/20251229161106_pool_preset_and_deadline10/migration.sql

**Purpose:** Add scoring preset + tighten default deadline.

**What it does:** Adds `Pool.scoringPresetKey` (default 'CLASSIC') and changes `deadlineMinutesBeforeKickoff` default from 15 → 10.

**Schema delta:** `Pool.scoringPresetKey` column; altered default.

**Flags:** none.

---

### backend/prisma/migrations/20260104023052_add_auto_advance_enabled_to_pool/migration.sql

**Purpose:** Pool auto-advance toggle.

**What it does:** Adds `Pool.autoAdvanceEnabled` boolean default true.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260104144925_add_username_nullable/migration.sql

**Purpose:** Add username + password-reset token fields.

**What it does:** Adds nullable `User.username`, `User.resetToken`, `User.resetTokenExpiresAt`. Unique index on username, plus indexes on username and resetToken.

**Schema delta:** 3 columns + indexes (username added nullable here, made required in a later migration).

**Flags:** none.

---

### backend/prisma/migrations/20260104152912_add_google_oauth/migration.sql

**Purpose:** Google OAuth identity.

**What it does:** Adds nullable `User.googleId`; unique + plain indexes on it.

**Schema delta:** one column + indexes.

**Flags:** none.

---

### backend/prisma/migrations/20260104161019_add_penalties_and_locked_phases/migration.sql

**Purpose:** Knockout penalties + host phase locking.

**What it does:** Adds `Pool.lockedPhases` JSONB default `[]`; adds `PoolMatchResultVersion.homePenalties`/`awayPenalties` (nullable).

**Schema delta:** 3 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260105233315_add_pool_status/migration.sql

**Purpose:** Pool lifecycle status + make username required.

**What it does:** Creates enum `PoolStatus` (DRAFT/ACTIVE/COMPLETED/ARCHIVED); adds `Pool.status` default DRAFT; sets `User.username` NOT NULL (warns it fails on existing NULLs).

**Schema delta:** enum `PoolStatus`, `Pool.status` column, username NOT NULL.

**Flags:** none.

---

### backend/prisma/migrations/20260106001028_add_co_admin_role/migration.sql

**Purpose:** Add CO_ADMIN member role.

**What it does:** `ALTER TYPE PoolMemberRole ADD VALUE 'CO_ADMIN'`.

**Schema delta:** enum value.

**Flags:** none.

---

### backend/prisma/migrations/20260111011909_add_join_approval_workflow/migration.sql

**Purpose:** Join-approval workflow.

**What it does:** Adds enum value `PENDING_APPROVAL` to `PoolMemberStatus`; `Pool.requireApproval` boolean default false; `PoolMember.approvedAtUtc`, `approvedByUserId`, `rejectionReason`; index on `PoolMember.status`.

**Schema delta:** enum value, 1 Pool column, 3 PoolMember columns, index.

**Flags:** none.

---

### backend/prisma/migrations/20260111021111_add_pool_fixture_snapshot/migration.sql

**Purpose:** Per-pool independent fixture snapshot.

**What it does:** Adds `Pool.fixtureSnapshot` JSONB (nullable) — lets each pool advance phases independently of the shared TournamentInstance.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260111022640_add_ban_fields_to_pool_member/migration.sql

**Purpose:** Member ban/expulsion metadata.

**What it does:** Adds `PoolMember.banExpiresAt`, `banReason`, `bannedAt`, `bannedByUserId` (all nullable).

**Schema delta:** 4 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260111030521_add_user_profile_fields/migration.sql

**Purpose:** Extended user profile.

**What it does:** Enum `Gender` (MALE/FEMALE/OTHER/PREFER_NOT_TO_SAY). Adds `User.bio` (VarChar 200), `country` (VarChar 2), `dateOfBirth`, `firstName`, `gender`, `lastName`, `lastUsernameChangeAt`.

**Schema delta:** enum + 7 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260111033030_add_user_timezone/migration.sql

**Purpose:** User IANA timezone.

**What it does:** Adds nullable `User.timezone`.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260111043847_add_pick_types_config/migration.sql

**Purpose:** Advanced per-phase pick configuration.

**What it does:** Adds nullable `Pool.pickTypesConfig` JSONB.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260111060549_add_structural_predictions_and_results/migration.sql

**Purpose:** Phase-level (structural) predictions + results.

**What it does:** Tables `StructuralPrediction` (poolId, userId, phaseId, `pickJson`; unique poolId+userId+phaseId) and `StructuralPhaseResult` (poolId, phaseId, `resultJson`, createdByUserId; unique poolId+phaseId). Indexes + FKs.

**Schema delta:** 2 tables.

**Flags:** none.

---

### backend/prisma/migrations/20260112024547_add_granular_group_standings/migration.sql

**Purpose:** Granular per-group standings predictions/results.

**What it does:** Tables `GroupStandingsPrediction` (poolId, userId, phaseId, groupId, `teamIds` text[]) and `GroupStandingsResult` (poolId, phaseId, groupId, teamIds[], createdByUserId). Unique constraints per (pool,user,phase,group) and (pool,phase,group). Indexes + FKs.

**Schema delta:** 2 tables.

**Flags:** none.

---

### backend/prisma/migrations/20260112031332_add_version_reason_to_group_standings_result/migration.sql

**Purpose:** Errata support for group standings.

**What it does:** Adds `GroupStandingsResult.reason` (nullable) and `version` int default 1.

**Schema delta:** 2 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260126005503_add_legal_consent_and_documents/migration.sql

**Purpose:** Legal consent tracking + versioned legal docs.

**What it does:** Enum `LegalDocumentType` (TERMS_OF_SERVICE/PRIVACY_POLICY). Adds consent columns to `User` (acceptedPrivacy/Terms At+Version, ageVerifiedAt, marketingConsent + At). Table `LegalDocument` (type, version, title, content, changeSummary, locale default 'es', isActive, publishedAt, effectiveAt). Index on (type,locale,isActive); unique (type,version,locale).

**Schema delta:** enum + 7 User columns + `LegalDocument` table.

**Flags:** none.

---

### backend/prisma/migrations/20260126013030_add_email_settings/migration.sql

**Purpose:** Per-user email prefs + platform-wide email settings singleton.

**What it does:** Adds boolean prefs to `User` (emailDeadlineReminders, emailNotificationsEnabled, emailPoolCompletions, emailPoolInvitations, emailResultNotifications, all default true). Creates singleton `PlatformSettings` (id default 'singleton', per-type email enable toggles, updatedAt, updatedById).

**Schema delta:** 5 User columns + `PlatformSettings` table.

**Flags:** none.

---

### backend/prisma/migrations/20260126040000_add_email_verification_fields/migration.sql

**Purpose:** Email verification (idempotent).

**What it does:** Uses a `DO $$` block to conditionally add `User.emailVerified` (default false), `emailVerificationToken`, `emailVerificationTokenExpiresAt` only if missing; creates a unique index `IF NOT EXISTS` on the token.

**Schema delta:** up to 3 columns + unique index.

**Flags:** none (defensive idempotent style).

---

### backend/prisma/migrations/20260126050000_promote_juan_to_admin/migration.sql

**Purpose:** Promote the platform owner to ADMIN.

**What it does:** `UPDATE User SET platformRole='ADMIN' WHERE email='juan.k.chacon9729@gmail.com'`.

**Schema delta:** data-only (no DDL).

**Flags:** Hard-codes a specific personal email as the platform owner. Intentional bootstrap.

---

### backend/prisma/migrations/20260131120000_seed_legal_documents/migration.sql

**Purpose:** Seed initial Spanish Terms of Service + Privacy Policy.

**What it does:** Deactivates any existing ES TOS/Privacy docs, then inserts two `LegalDocument` rows (version `2026-01-25`) with full markdown content (TOS and Privacy Policy in Spanish), `isActive=true`, `ON CONFLICT DO NOTHING`.

**Schema delta:** data-only seed.

**Flags:** This is the migration the `package.json` `start` script proactively rolls back on each boot (`prisma migrate resolve --rolled-back 20260131120000_seed_legal_documents`), indicating it was poisoned/failed in production and is permanently neutralized. Effectively dead as a migration step.

---

### backend/prisma/migrations/20260205023730_add_auto_results_support/migration.sql

**Purpose:** Auto-results (API-Football) infrastructure.

**What it does:** Enums `ResultSourceMode` (MANUAL/AUTO), `ResultSource` (HOST_MANUAL/HOST_PROVISIONAL/API_CONFIRMED/HOST_OVERRIDE), `SyncStatus` (RUNNING/COMPLETED/FAILED/PARTIAL). Drops then re-adds `PoolMatchResultVersion.createdByUserId` FK as ON DELETE SET NULL and makes the column nullable; adds `source` (default HOST_MANUAL), `externalDataJson`, `externalFixtureId`. Changes `PlatformSettings.emailDeadlineReminderEnabled` default to false. Adds API-Football config columns to `TournamentInstance` (apiFootballLeagueId/SeasonId, lastSyncAtUtc, resultSourceMode default MANUAL, syncEnabled default true). New tables: `DeadlineReminderLog`, `MatchExternalMapping`, `ResultSyncLog`, with their indexes/unique constraints/FKs. Adds index on `User.emailVerificationToken`.

**Schema delta:** 3 enums, multiple altered columns, 3 new tables.

**Flags:** none.

---

### backend/prisma/migrations/20260205035607_add_smart_sync_state/migration.sql

**Purpose:** Smart-polling per-match sync state machine.

**What it does:** Enum `MatchSyncStatus` (PENDING/IN_PROGRESS/AWAITING_FINISH/COMPLETED/SKIPPED). Table `MatchSyncState` (tournamentInstanceId, internalMatchId, syncStatus, kickoffUtc, first/finish/lastChecked/completed timestamps, lastApiStatus). Indexes on status/firstCheck/finishCheck; unique (tournamentInstanceId, internalMatchId); FK cascade-delete to TournamentInstance.

**Schema delta:** enum + `MatchSyncState` table.

**Flags:** none.

---

### backend/prisma/migrations/20260212221812_add_beta_feedback/migration.sql

**Purpose:** Beta feedback capture.

**What it does:** Enum `BetaFeedbackType` (BUG/SUGGESTION). Table `BetaFeedback` (type, message, imageBase64, wantsContact, phoneNumber, userId, userEmail, currentUrl, userAgent, createdAtUtc). Indexes on type and createdAtUtc.

**Schema delta:** enum + table.

**Flags:** none.

---

### backend/prisma/migrations/20260212224550_add_contact_name_to_feedback/migration.sql

**Purpose:** Add contact name to feedback.

**What it does:** Adds nullable `BetaFeedback.contactName`.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260226120000_add_regulation_scores/migration.sql

**Purpose:** Track 90-minute (regulation) score separately from final.

**What it does:** Adds `PoolMatchResultVersion.homeGoals90`/`awayGoals90` (nullable).

**Schema delta:** 2 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260312120000_add_compound_indexes_performance/migration.sql

**Purpose:** Performance indexes.

**What it does:** Adds compound indexes `PoolMember(poolId, status)` and `Prediction(poolId, matchId)`.

**Schema delta:** 2 indexes.

**Flags:** none.

---

### backend/prisma/migrations/20260319120000_add_pending_phase_sync/migration.sql

**Purpose:** Deferred next-phase fixture sync queue.

**What it does:** Enum `PhaseSyncStatus` (PENDING/RESOLVED/FAILED). Table `PendingPhaseSync` (tournamentInstanceId, completedPhase, nextPhase, apiRoundName, status, attempts, lastAttempt/resolved timestamps, errorMessage). Index on status; unique (tournamentInstanceId, nextPhase); FK to TournamentInstance.

**Schema delta:** enum + table.

**Flags:** none.

---

### backend/prisma/migrations/20260404120000_add_mute_reminders_to_pool/migration.sql

**Purpose:** Per-pool reminder mute + backfill exclusions.

**What it does:** Adds `Pool.muteReminders` boolean default false; sets it true for three hard-coded historical pool IDs (the excluded pools noted in project memory: AON Champions, Tamayos, Prueba champions).

**Schema delta:** one column + data backfill.

**Flags:** Hard-codes three pool UUIDs — intentional one-time backfill.

---

### backend/prisma/migrations/20260404140000_add_prediction_updates/migration.sql

**Purpose:** AI prediction-update subscription flag.

**What it does:** Adds `User.predictionUpdates` boolean default false.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260406200000_add_scraper_provisional_and_scores_toggle/migration.sql

**Purpose:** Live-scores scraper integration.

**What it does:** Adds enum value `SCRAPER_PROVISIONAL` to `ResultSource`; adds `PlatformSettings.scoresServiceEnabled` boolean default false (toggle for the picks4all-scores live service).

**Schema delta:** enum value + 1 column.

**Flags:** none.

---

### backend/prisma/migrations/20260410_add_live_tracking_fields/migration.sql

**Purpose:** Live ticker tracking fields.

**What it does:** Adds `MatchSyncState.trackedAtUtc`, `graceEndUtc`, `lastElapsed` (int), `lastLiveDataJson` (JSONB).

**Schema delta:** 4 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260411_add_last_extra_to_match_sync_state/migration.sql

**Purpose:** Added-time minutes for live display.

**What it does:** Adds `MatchSyncState.lastExtra` (int) to render "45+3"/"90+5".

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260413_add_payment_models/migration.sql

**Purpose:** Initial Polar.sh payment models.

**What it does:** Enum `PaymentStatus` (PENDING/COMPLETED/FAILED/REFUNDED). Table `PoolPayment` (poolId, userId, polarCheckoutId NOT NULL+unique, polarOrderId unique, status, amountUsd, currency default 'usd', from/toCapacity, poolType, paidAtUtc). Table `PaymentEvent` (polarEventId unique, eventType, payloadJson, processedAt) — immutable webhook audit. Unique + performance indexes; FKs from PoolPayment to Pool/User.

**Schema delta:** enum + 2 tables. (Both later substantially altered for observability + MP support.)

**Flags:** none. (Polar-only at this point; MP support added later — Wompi never appears, confirming it was discarded before any payment migration.)

---

### backend/prisma/migrations/20260419_add_email_new_member_digest/migration.sql

**Purpose:** New-member digest preference.

**What it does:** Adds `User.emailNewMemberDigest` boolean default true.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260419_add_email_suppression_and_pool_full_dedup/migration.sql

**Purpose:** Email bounce/complaint suppression + pool-full dedup.

**What it does:** Adds `Pool.poolFullNotifiedAt` (nullable). Creates `EmailSuppression` (email, reason, resendId, eventData JSON, createdAt) with unique + plain index on email.

**Schema delta:** 1 column + `EmailSuppression` table.

**Flags:** none.

---

### backend/prisma/migrations/20260421_add_capi_dedup_and_failed_events/migration.sql

**Purpose:** Meta CAPI dedup + dead-letter queue.

**What it does:** Adds `PoolPayment.metaEventId` (for browser↔server Pixel dedup). Creates `FailedCapiEvent` (eventName, eventId, payloadJson, attemptCount, lastError, lastAttemptAt, nextRetryAt, resolvedAt). Indexes on (nextRetryAt,resolvedAt) and eventId.

**Schema delta:** 1 column + `FailedCapiEvent` table.

**Flags:** `FailedCapiEvent` is later renamed to `FailedAnalyticsEvent` (see 20260421_refactor_dlq_and_ga4_mp).

---

### backend/prisma/migrations/20260421_add_payment_meta_cookies/migration.sql

**Purpose:** Persist Meta Advanced Matching signals for async webhook path.

**What it does:** Adds `PoolPayment.metaFbp`, `metaFbc`, `clientIpAddress`, `clientUserAgent` so webhook-driven Purchase events keep high EMQ.

**Schema delta:** 4 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260421_add_pool_payment_amount_cop/migration.sql

**Purpose:** Real COP amount for MP payments.

**What it does:** Adds nullable `PoolPayment.amountCop` (whole pesos). Comment notes non-MP payments leave it null and historical MP rows need separate backfill.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260421_add_referral_graph/migration.sql

**Purpose:** User-to-user referral attribution.

**What it does:** Adds self-FK `User.referredByUserId` (ON DELETE SET NULL) + index. Adds `PoolInvite.acceptedByUserId` + `acceptedAtUtc` (first redeemer) + index.

**Schema delta:** 1 User column + 2 PoolInvite columns + indexes/FK.

**Flags:** none.

---

### backend/prisma/migrations/20260421_add_user_attribution_fields/migration.sql

**Purpose:** First-touch marketing attribution.

**What it does:** Adds to `User`: acquisitionSource/Medium/Campaign/Content/Term, landingPath, referrerUrl, gclid, gbraid, wbraid, fbclid (all nullable).

**Schema delta:** 11 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260421_refactor_dlq_and_ga4_mp/migration.sql

**Purpose:** Generalize the CAPI DLQ into a multi-provider analytics DLQ.

**What it does:** Renames table `FailedCapiEvent` → `FailedAnalyticsEvent`; adds `provider` TEXT default 'META_CAPI'; replaces the (nextRetryAt,resolvedAt) index with a (provider,nextRetryAt,resolvedAt) version; renames the eventId index and the PK constraint to match.

**Schema delta:** table rename + 1 column + index swap + PK rename.

**Flags:** none.

---

### backend/prisma/migrations/20260429_add_pools_config_json_to_inquiry/migration.sql

**Purpose:** Per-pool slot config on corporate inquiries.

**What it does:** Adds `OrganizationInquiry.poolsConfigJson` (TEXT, JSON array of slot counts). Comment: scalar `slotsPerPool` is kept populated only when all entries are equal.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260429_extend_organization_inquiry_quote_fields/migration.sql

**Purpose:** Quote-panel fields on inquiries.

**What it does:** Adds nullable `OrganizationInquiry.country`, `currency`, `numberOfPools`, `slotsPerPool`.

**Schema delta:** 4 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260501_add_organization_brand_colors/migration.sql

**Purpose:** Corporate brand colors.

**What it does:** Adds `Organization.primaryColor`, `secondaryColor` (#RRGGBB, nullable; null = default Picks4All gradient).

**Schema delta:** 2 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260502_add_blocked_attempt_notify/migration.sql

**Purpose:** Throttle blocked-join-attempt host emails.

**What it does:** Adds `Pool.lastBlockedAttemptNotifiedAt` (nullable).

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260502_add_capacity_warning_fields/migration.sql

**Purpose:** Near-full capacity warning.

**What it does:** Adds `Pool.capacityWarningNotifiedAt` and `capacityWarningThresholdPct` (1..99 override; null = global env default).

**Schema delta:** 2 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260503_add_corporate_invite_compound_index/migration.sql

**Purpose:** Index for paginated employee listing.

**What it does:** Creates compound index `CorporateInvite(poolId, status, createdAtUtc)`.

**Schema delta:** one index.

**Flags:** none.

---

### backend/prisma/migrations/20260503_add_mp_preference_id/migration.sql

**Purpose:** MP preference idempotency.

**What it does:** Adds nullable `PoolPayment.mpPreferenceId` so re-entry to `initiateMpCheckout` returns the existing preference instead of creating a duplicate (mirrors Polar's polarCheckoutId reuse).

**Schema delta:** one column.

**Flags:** none. (Mercado Pago is the live COP gateway; Wompi was discarded.)

---

### backend/prisma/migrations/20260503_add_org_branding_audit/migration.sql

**Purpose:** Branding-change audit trail.

**What it does:** Creates `OrganizationBrandingAudit` (organizationId, userId, changedAt, fieldsChanged text[], beforeJson, afterJson, ipAddress, userAgent). Indexes on (organizationId,changedAt) and (userId,changedAt); FKs to Organization and User.

**Schema delta:** table.

**Flags:** none.

---

### backend/prisma/migrations/20260504_add_pending_digest_throttle/migration.sql

**Purpose:** Pending-approval daily digest throttle (ADR-058).

**What it does:** Adds `Pool.pendingDigestPendingHash` (TEXT) and `pendingDigestStreakStartAt` (timestamp).

**Schema delta:** 2 columns.

**Flags:** none.

---

### backend/prisma/migrations/20260512_add_user_locale_preference/migration.sql

**Purpose:** Per-user communication locale (first version).

**What it does:** Adds `User.locale` VARCHAR(2) NOT NULL default 'es', `requestedLocale` VARCHAR(8), `localePromptCompletedAt`. Backfills locale='pt' for BR/PT/AO/MZ/CV. Creates a partial index on localePromptCompletedAt WHERE NULL.

**Schema delta:** 3 columns + index + backfill.

**Flags:** Both the NOT NULL/default and the PT backfill are reverted by the very next migration — see below. Superseded design.

---

### backend/prisma/migrations/20260512_user_locale_nullable/migration.sql

**Purpose:** Reverse the prior locale design to make NULL meaningful.

**What it does:** Drops the default and NOT NULL on `User.locale`, then sets every row's locale to NULL — so NULL distinguishes "not chosen yet" (fall back to country-based resolution) from an explicit choice. Reverts the prior PT backfill.

**Schema delta:** column nullability change + data reset.

**Flags:** Directly undoes the prior migration's intent; the two form an intentional design correction within the same day.

---

### backend/prisma/migrations/20260519_extend_payment_observability/migration.sql

**Purpose:** Full payment-funnel observability (ADR-060).

**What it does:** Additive-only. Adds `PaymentStatus` values INITIATED/ABANDONED/EXPIRED/CANCELLED (IF NOT EXISTS). Adds `PaymentEvent.source` (TEXT default 'POLAR_WEBHOOK'), nullable `poolPaymentId` FK (ON DELETE SET NULL) + index, `webhookId`, `webhookTimestamp`. Makes `polarEventId` nullable, drops the old unique index, and adds a partial unique index (unique when set). Adds composite index on (source,eventType).

**Schema delta:** 4 enum values + 4 PaymentEvent columns + nullability change + index changes.

**Flags:** none (heavily documented, zero-downtime intent).

---

### backend/prisma/migrations/20260521_pool_payment_initiated_state/migration.sql

**Purpose:** Allow PoolPayment rows in INITIATED state before calling the gateway.

**What it does:** Drops the unique index on `PoolPayment.polarCheckoutId`, makes the column nullable, and replaces it with a partial unique index (unique WHERE polarCheckoutId IS NOT NULL).

**Schema delta:** nullability + index swap.

**Flags:** none.

---

### backend/prisma/migrations/20260522_add_sales_management/migration.sql

**Purpose:** Sales-management schema — quotes and cuentas de cobro (ADR-061).

**What it does:** Enums `QuoteStatus`, `AccountReceivableStatus`, `DocumentKind`. Table `Quote` (consecutive unique, year/number, client snapshot, issuerSnapshotJson, locale, term, participants, currency, amountCop/amountUsdCents, perPersonAmount, tournament, dates, includeCoverPage, notes, status, createdByUserId). Table `AccountReceivable` (consecutive unique, redemptionCode unique, client snapshot incl. NIT/city, issuer snapshot, locale/term, concept, currency + amounts + amountInWords, targetCapacity, poolType, dates, lifecycle status, redeemed/paid metadata, linkedQuoteId, poolPaymentId unique). Table `DocumentCounter` (composite PK kind+year, lastNumber). Adds nullable `PoolPayment.accountReceivableId` (unique 1:1 FK, ON DELETE SET NULL). All FKs + indexes (incl. the (status,validUntil) sweep index used by the expiry job).

**Schema delta:** 3 enums + 3 tables + 1 PoolPayment column.

**Flags:** none.

---

### backend/prisma/migrations/20260526_add_organization_invitation_locale/migration.sql

**Purpose:** Per-org first-email locale (ADR-062).

**What it does:** Adds `Organization.invitationLocale` TEXT NOT NULL default 'es' — governs only the corporate activation email; User.locale takes over after activation.

**Schema delta:** one column.

**Flags:** none.

---

### backend/prisma/migrations/20260526_add_user_welcome_email_sent_at/migration.sql

**Purpose:** Welcome-email handoff tracking (ADR-063).

**What it does:** Adds `User.welcomeEmailSentAt` (nullable), then backfills every existing user with their `createdAtUtc` so the 24h fallback job doesn't re-welcome the existing base on first run.

**Schema delta:** one column + backfill.

**Flags:** none.

---

### backend/prisma/migrations/20260527_add_mp_payment_id_and_status_index/migration.sql

**Purpose:** MP reconciler support (ADR-065 parity cycle, commit 5).

**What it does:** Adds nullable `PoolPayment.mpPaymentId` (MP's real payment.id, set on first IPN). Adds compound index `PoolPayment(status, createdAtUtc)` to back both Polar and MP reconcilers' stale-row queries.

**Schema delta:** one column + one index.

**Flags:** none.

---

### backend/prisma/migrations/migration_lock.toml

**Purpose:** Prisma migration provider lock.

**What it does:** Pins provider = "postgresql".

**Exports:** n/a.

**Flags:** none.

---

### backend/prisma/schema.prisma

**Purpose:** Single source of truth for the entire database schema and the generated Prisma client. Consolidates every migration above.

**What it does:** Declares the `postgresql` datasource and `prisma-client-js` generator, then defines all enums and models. Highlights:

- **Enums:** `PlatformRole`, `UserStatus`, `Gender`, `TemplateStatus`, `TemplateVersionStatus`, `TournamentInstanceStatus`, `ResultSourceMode`, `ResultSource` (incl. SCRAPER_PROVISIONAL), `SyncStatus`, `PoolVisibility`, `PoolStatus`, `PoolMemberRole` (HOST/CO_ADMIN/PLAYER/CORPORATE_HOST), `PoolMemberStatus`, `ResultVersionStatus`, `MatchSyncStatus`, `PhaseSyncStatus`, `BetaFeedbackType`, `OrganizationStatus`, `CorporateInviteStatus`, `LegalDocumentType`, `PaymentStatus` (8-state lifecycle), `QuoteStatus`, `AccountReceivableStatus`, `DocumentKind`.
- **User:** identity, profile, reset/verification tokens, Google OAuth, legal consent, granular email prefs, communication locale (nullable; explicit choice vs country fallback), `welcomeEmailSentAt`, first-touch marketing attribution, self-referential referral graph (`referredByUser`/`referrals`), and all back-relations (pools, memberships, predictions, results, payments, branding audit, quotes, account receivables created/redeemed).
- **AuditEvent:** generic action log.
- **Tournament domain:** `TournamentTemplate`, `TournamentTemplateVersion` (current-published pointer), `TournamentInstance` (frozen dataJson snapshot + API-Football config + sync relations).
- **Pool domain:** `Pool` (rich config: visibility, status, deadline, maxParticipants, scoring preset, autoAdvance, lockedPhases, requireApproval, muteReminders, pickTypesConfig, fixtureSnapshot, organization link, logoUrl, capacity-warning + blocked-attempt + pending-digest throttle fields), `PoolMember` (roles, ban/approval fields), `PoolInvite` (referral fields), `Prediction`, `StructuralPrediction`, `PoolMatchResult` + `PoolMatchResultVersion` (errata trail, penalties, regulation score, result source), `PoolMatchOverride` (per-match scoring exclusion), `StructuralPhaseResult`, `GroupStandingsPrediction`/`GroupStandingsResult`.
- **Email/system:** `EmailSuppression`, `LegalDocument`, `PlatformSettings` (singleton with email toggles + scoresServiceEnabled), `DeadlineReminderLog`.
- **Auto-results:** `MatchExternalMapping`, `ResultSyncLog`, `MatchSyncState` (live-tracking fields), `PendingPhaseSync`.
- **Feedback:** `BetaFeedback`.
- **Corporate:** `Organization` (branding, invitationLocale, welcome/invitation messages), `OrganizationBrandingAudit`, `OrganizationInquiry` (quote fields + poolsConfigJson), `CorporateInvite` (activation token, compound index).
- **Payments:** `PoolPayment` (Polar + MP identifiers, USD/COP amounts, capacity delta, Meta matching signals, accountReceivable 1:1 link), `PaymentEvent` (multi-source audit log), `FailedAnalyticsEvent` (multi-provider DLQ).
- **Sales:** `Quote`, `AccountReceivable`, `DocumentCounter` (composite-PK atomic numbering).

**Exports:** The generated Prisma client types/models.

**Key dependencies:** `DATABASE_URL`. Heavily annotated with ADR references (ADR-046, 058, 060, 061, 062, 063, 065) and audit-doc pointers.

**Flags:** Inline comments reference Mercado Pago as the live COP gateway with no mention of Wompi, consistent with Wompi's deprecation. The Polar/MP dual-gateway and the legacy 3-row backfill notes are present but documented, not dead.

---

### backend/railway.toml

**Purpose:** Railway build/deploy configuration for the backend service.

**What it does:** Build via nixpacks (latest), `installCmd = npm ci --include=dev`, forces Node 22 and `NPM_CONFIG_PRODUCTION=false` so devDeps (types, tsc) are available at build. Deploy: `releaseCommand = npx prisma migrate deploy` (runs before the new release goes live), `startCommand = npm run start`, health check at `/health` (30s timeout), restart ON_FAILURE up to 3 retries.

**Exports:** n/a.

**Key dependencies:** Railway, Nixpacks, Prisma.

**Flags:** none. (Comments are in Spanish.)

---

### backend/scripts/_test-cc-render.ts

**Purpose:** Manual smoke test for the production cuenta-de-cobro (CC) PDF renderer.

**What it does:** `makeMock()` builds a complete `AccountReceivable` object (using `snapshotIssuer()` for the issuer block). `main()` renders a COP variant (Linalca, with Bancolombia data) and a USD variant (Acme Corp, no Bancolombia, English/`pool` term) via `renderCcPdf`, writing `_test-cc-cop.pdf` and `_test-cc-usd.pdf` to disk and logging byte sizes.

**Exports:** none (CLI script; `main()` invoked directly).

**Key dependencies:** `../src/pdf/renderCcPdf`, `../src/lib/issuerInfo` (`snapshotIssuer`), `@prisma/client` types, node fs/path. Run via `npx tsx`.

**Flags:** Not part of CI (`_`-prefixed, by-hand only); outputs match the `.gitignore` `_test-*.pdf` rule. Not dead code — it's a deliberate dev tool.

---

### backend/scripts/_test-quote-render.ts

**Purpose:** Manual smoke test for the production Quote PDF renderer.

**What it does:** Builds an in-memory `Quote` mock and calls `renderQuotePdf`, writing `_test-quote-render.pdf` and logging the byte size.

**Exports:** none (CLI script).

**Key dependencies:** `../src/pdf/renderQuotePdf`, `@prisma/client` types, node fs/path. Run via `npx tsx`.

**Flags:** `issuerSnapshotJson` is mocked as `{}` (unlike the CC script which uses the real `snapshotIssuer()`), so it doesn't exercise the issuer block. Dev tool, not CI. Not dead.

---

### backend/src/db.ts

**Purpose:** Shared singleton Prisma client.

**What it does:** Instantiates and exports `prisma = new PrismaClient(...)`, logging `["warn","error"]` in development and `["error"]` otherwise.

**Exports:** `prisma`.

**Key dependencies:** `@prisma/client`. Imported across services/routes/jobs.

**Flags:** none. (No explicit graceful-shutdown/`$disconnect`, but standard for a long-lived server.)

---

### backend/src/jobs/accountReceivableExpiryJob.ts

**Purpose:** Cron job that expires stale PENDING cuentas de cobro.

**What it does:** Sweeps `AccountReceivable` rows with status PENDING and `validUntil < startOfTodayUtc()` and flips them to EXPIRED. Config via env (`CC_EXPIRY_CRON` default hourly `5 * * * *`, `CC_EXPIRY_BATCH_SIZE` default 100). Uses a Postgres advisory lock (`pg_try_advisory_xact_lock(82636504)`) inside a transaction (`runWithClusterLock`) for multi-replica safety. `runOnce` selects up to BATCH_SIZE stale rows then `updateMany` scoped to those ids AND status=PENDING (so a concurrent manual mark-paid is not clobbered). Guarded by `isRunning` against overlap. `startAccountReceivableExpiryJob`/`stopAccountReceivableExpiryJob` manage the schedule.

**Exports:** `startAccountReceivableExpiryJob`, `stopAccountReceivableExpiryJob`, and `runOnce` re-exported as `runCcExpirySweepOnce`.

**Key dependencies:** `node-cron`, `../db`. Spec: SALES_AUDIT.md §6/§11, SALES_IMPLEMENTATION.md commit 8.

**Flags:** none. Advisory-lock key 82636504 is documented as distinct from the other two jobs (82636502/82636503).

---

### backend/src/jobs/capiRetryJob.ts

**Purpose:** Cron job that drains the analytics dead-letter queue (Meta CAPI + GA4 Measurement Protocol).

**What it does:** Every 5 min by default (env `ANALYTICS_RETRY_CRON`/legacy `CAPI_RETRY_CRON`; batch size env-configurable). Advisory-lock guarded (`pg_try_advisory_xact_lock(82636502)`). `runOnce` first opportunistically purges resolved/expired `FailedAnalyticsEvent` rows older than 30 days (`purgeOldResolvedRows`), then runs both sinks in parallel via `Promise.allSettled([retryFailedCapiEventsBatch, retryFailedGa4EventsBatch])`, logging per-sink processed/resolved counts and any rejection. Overlap-guarded with `isRunning`. `start`/`stop` manage the schedule.

**Exports:** `startCapiRetryJob`, `stopCapiRetryJob`.

**Key dependencies:** `node-cron`, `../db`, `../lib/metaCapi` (`retryFailedCapiEventsBatch`), `../lib/ga4` (`retryFailedGa4EventsBatch`).

**Flags:** Function names still say "capi" (`startCapiRetryJob`) though the job is now multi-provider (logs as `[AnalyticsRetryJob]`). Cosmetic naming lag, not dead code.

---

### backend/src/jobs/deadlineReminderJob.ts

**Purpose:** Daily cron that sends pick-deadline reminder emails.

**What it does:** Schedules `processDeadlineReminders(48, false)` at `DEADLINE_REMINDER_CRON` (default `0 12 * * *` = 7 AM Colombia / 12:00 UTC) — i.e. a 48-hour lookahead window, non-dry-run. Tracks `isRunning`/`lastRunAt`, logs sent/skipped/failed counts (or the skip reasons). `start`/`stop` manage the schedule.

**Exports:** `startDeadlineReminderJob`, `stopDeadlineReminderJob`.

**Key dependencies:** `node-cron`, `../services/deadlineReminderService` (`processDeadlineReminders`).

**Flags:** none. (`lastRunAt` is set but not exported/read elsewhere in this file — likely surfaced via an admin/health endpoint, otherwise minor.)

---

### backend/src/__tests__/api-helpers.ts

**Purpose:** Shared helpers for the integration test suite that hits the LIVE production API.

**What it does:** `API` base URL from `API_BASE_URL` (default `https://api.picks4all.com`). `api<T>()` performs a fetch with JSON body/cookie support, `redirect: "manual"`, parses JSON (null-safe), and extracts Set-Cookie pairs into a map. `loginTestUser()` POSTs `/auth/login` with the e2e test credentials (env `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, defaulting to `e2e-test@picks4all.com`), extracts the `p4a_token` cookie, and returns a cookie string (`p4a_token=...; p4a_logged_in=1`) plus userId.

**Exports:** `ApiResponse<T>` interface, `api()`, `loginTestUser()`.

**Key dependencies:** vitest (consumers), global `fetch`.

**Flags:** Tests run against PRODUCTION (`api.picks4all.com`) with a real account — by design but noteworthy operationally. The cookie-parsing splits Set-Cookie on `,` which can mis-handle multi-cookie headers, but suffices for the single-token case.

---

### backend/src/__tests__/auth.integration.test.ts

**Purpose:** Integration tests for auth + health + password-reset/verify/corporate-invite error paths.

**What it does:** Asserts: `POST /auth/login` returns 200 + user + `p4a_token` cookie for valid creds, the user object shape, 401 for wrong password / non-existent email, 400 for missing/invalid fields and empty body; `GET /health` returns version/commit/timestamp in semver/ISO form; `POST /auth/forgot-password` returns 200 regardless of email existence (no enumeration leak) and 400 for bad/missing email; `POST /auth/logout` 200; `loginTestUser()` produces a valid cookie+userId; `POST /auth/reset-password` 400 on missing token/password and rejects invalid tokens (400/401/404); `GET /auth/verify-email` and `GET /auth/check-corporate-invite` reject missing/invalid tokens.

**Exports:** n/a (test file).

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** none.

---

### backend/src/__tests__/catalog.integration.test.ts

**Purpose:** Integration tests for catalog, pick-presets, and invite-preview.

**What it does:** `GET /catalog/instances` (auth) returns an ACTIVE-instances array with id/name/status/template(key,name) and 401 without auth; `GET /catalog/instances/:id/phases` returns phases for a valid instance and 404 for a bad id; `GET /pick-presets` lists presets containing keys BASIC/CUMULATIVE/SIMPLE each with key/name/description; `GET /pick-presets/:key` returns BASIC config, 404 for unknown, and is case-insensitive; `GET /invite-preview/:code` returns 404 for invalid codes without auth.

**Exports:** n/a.

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** none.

---

### backend/src/__tests__/corporate.integration.test.ts

**Purpose:** Integration tests for corporate inquiry/activation validation and admin-route authorization.

**What it does:** `POST /corporate/inquiry` returns 400 + `VALIDATION_ERROR` for empty body, bad email, short company/contact names, and an invalid `employeeCount` enum (never creates real inquiries); `POST /auth/activate-corporate` 400 on missing token and 4xx on an invalid token; admin routes (`/admin/settings/email`, `/admin/prediction-update`, `/admin/templates`, `/admin/instances`) return 403 for the PLAYER test user and 401 without auth.

**Exports:** n/a.

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** none.

---

### backend/src/__tests__/features.integration.test.ts

**Purpose:** Cross-feature integration tests (health, invite-preview, pick-presets, profile, auth validation).

**What it does:** `GET /health` returns `ok:true`, semver version, responds <2s; `GET /invite-preview/:code` returns 404 + `NOT_FOUND` without requiring auth; pick-presets list/detail shape + 404; `GET /users/me/profile` returns the profile (incl. nullable firstName/lastName/country) and 401 without auth; `PATCH /users/me/profile` 400 on bad/short username and 401 without auth; auth validation for `/auth/login`, `/auth/register` (400 for missing fields / weak password), `/auth/forgot-password` (400 missing email), `/auth/logout` (200 + `ok:true`).

**Exports:** n/a.

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** Overlaps substantially with auth.integration and catalog.integration (health, pick-presets, login validation are asserted in multiple files) — duplicated coverage, not harmful.

---

### backend/src/__tests__/pools.integration.test.ts

**Purpose:** Integration tests for pool endpoints + legal docs + feedback validation.

**What it does:** `POST /pools/join` 404 on bad invite code, 400 on missing code, 401 without auth; `GET /me/pools` returns membership array with shape {poolId, role, status, pool{id,name,status}} and 401 without auth; `POST /pools` 400 on empty body / short name and 401 without auth; `GET /catalog/instances` list shape + 401; `GET /legal/documents/:type` returns <500 for terms/privacy and 400 + `INVALID_TYPE` for a bogus type; `POST /feedback` 400 + `VALIDATION_ERROR` on missing fields / too-short message / invalid type enum.

**Exports:** n/a.

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** none.

---

### backend/src/__tests__/user.integration.test.ts

**Purpose:** Integration tests for user/me endpoints including reversible toggles.

**What it does:** `GET /users/me/profile` returns the expected fields (id matches login userId, email, platformRole, status, createdAtUtc, nullable profile fields), 401 without/with-invalid cookie; `GET /me/pools` shape + 401; `GET /me/email-preferences` returns boolean prefs, `platformEnabled` flags, and `descriptions`; `PUT /me/prediction-subscription` toggles on/off (reversible), 400 on missing/non-boolean `enabled`, 401 without auth; `GET /me/prediction-subscription` returns the boolean status + 401.

**Exports:** n/a.

**Key dependencies:** vitest, `./api-helpers`.

**Flags:** The prediction-subscription on/off tests mutate the live e2e account's state (reversible by design, but real writes to production).
