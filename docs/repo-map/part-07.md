## Batch 7

### backend/src/routes/poolMembers.ts

**Purpose:** Thin HTTP layer for pool membership management (list, approve/reject join requests, kick, leave, ban, promote/demote). All business logic is delegated to `services/poolMemberService.ts`.

**What it does:**
- `poolMembersRouter` (an Express `Router`) is exported and intended to be mounted under `/pools` (which it is, by `pools.ts`).
- **Helpers:**
  - `auditCtx(req)` builds an `AuditContext` (`{ ip, userAgent }`) from the request for audit logging in the service layer.
  - `handleServiceError(res, err)` maps a thrown `ServiceError` (from `authService`) to an HTTP response by switching on `err.statusHint` (400/403/404/409/500 → `sendBadRequest`/`sendForbidden`/`sendNotFound`/`sendConflict`/`sendInternal`), defaulting to `sendInternal`. Non-`ServiceError` errors are re-thrown to the global handler.
- **Zod schemas:** `rejectMemberSchema` (optional `reason`), `kickMemberSchema` (optional `reason` + `confirmRevert` boolean), `banMemberSchema` (required `reason`, optional `deletePicks`, `confirmRevert`), `promoteMemberSchema` (`memberId` UUID — defined but the promote/demote routes read `memberId` from the path, see Flags). The `confirmRevert` flag implements a two-phase confirmation: the backend returns `409 REVERT_PENDING_CONFIRMATION` when kicking/banning the last non-host member would revert the pool from ACTIVE→DRAFT; the client retries with `confirmRevert: true`.
- **Routes** (all rely on `req.auth!.userId`, so auth middleware is applied upstream):
  - `GET /:poolId/members` → `listMembers` (members only).
  - `GET /:poolId/pending-members` → `listPendingMembers` (HOST/CO_ADMIN).
  - `POST /:poolId/members/:memberId/approve` → `approveMember`.
  - `POST /:poolId/members/:memberId/reject` → `rejectMember` (validates body).
  - `POST /:poolId/members/:memberId/kick` → `kickMember` (validates body, passes `confirmRevert`).
  - `POST /:poolId/leave` → `leaveMember` (self-service player leave).
  - `POST /:poolId/members/:memberId/ban` → `banMember`.
  - `POST /:poolId/members/:memberId/promote` → `promoteMember` (HOST only).
  - `POST /:poolId/members/:memberId/demote` → `demoteMember` (HOST only).

**Exports:** `poolMembersRouter`.

**Key dependencies:** `services/poolMemberService` (all logic), `ServiceError`/`AuditContext` from `services/authService`, `lib/apiResponse` senders, `zod`.

**Flags:** `promoteMemberSchema` is declared but never used — the promote route takes `memberId` from `req.params`, not the body. Low-confidence dead code.

---

### backend/src/routes/poolOverview.ts

**Purpose:** Thin HTTP layer exposing the consolidated pool overview screen payload. Logic lives in `services/poolOverviewService.ts`.

**What it does:**
- Exports `poolOverviewRouter`.
- `handleServiceError` — same `ServiceError`→HTTP mapping pattern as `poolMembers.ts` (here including a `401 → sendBadRequest` entry).
- `GET /:poolId/overview` — reads the `leaderboardVerbose` query param (truthy when `"1"`/`"true"`), calls `getPoolOverview(userId, poolId, leaderboardVerbose)`, and returns the data via `sendData`.

**Exports:** `poolOverviewRouter`.

**Key dependencies:** `services/poolOverviewService.getPoolOverview`, `ServiceError`, `lib/apiResponse`.

**Flags:** none.

---

### backend/src/routes/pools.ts

**Purpose:** Top-level `/pools` router. Composes all pool-related sub-routers, applies `requireAuth`, and implements pool creation (`POST /`) and pool detail (`GET /:poolId`) directly.

**What it does:**
- Exports `poolsRouter`, applies `requireAuth` globally, then mounts nine sub-routers at `/`: `poolOverviewRouter`, `poolMembersRouter`, `poolInvitesRouter`, `poolAdminRouter`, `picksRouter`, `structuralPicksRouter`, `resultsRouter`, `structuralResultsRouter`, `groupStandingsRouter`.
- `poolCreationLimiter` — `express-rate-limit` allowing max 10 pool creations/hour (responds `TOO_MANY_POOLS`).
- `createPoolSchema` (Zod) — validates `tournamentInstanceId`, `name` (3-120), optional `description`, `timeZone` (IANA), `deadlineMinutesBeforeKickoff` (0-1440), `scoringPresetKey` (`CLASSIC`/`OUTCOME_ONLY`/`EXACT_HEAVY`), `requireApproval`, `maxParticipants` (20-10000), and `pickTypesConfig` as either a preset key (`BASIC`/`SIMPLE`/`CUMULATIVE`) or a custom `PoolPickTypesConfigSchema`.
- **`POST /`** (pool creation):
  - Validates body; validates timezone via `isValidTimezone`.
  - Loads the `TournamentInstance`; rejects if not found or `ARCHIVED`.
  - Processes `pickTypesConfig`: if a preset key string, extracts real phases via `extractPhases(instance.dataJson)` and builds a dynamic config via `generateDynamicPresetConfig`, falling back to a hardcoded preset via `getPresetByKey`; if a custom object, validates with `validatePoolPickTypesConfig` (errors block; warnings are logged to audit as `POOL_CONFIG_WARNINGS` but allowed).
  - In a transaction, creates the `Pool` (visibility PRIVATE, default timeZone UTC, default deadline 10 min, default preset CLASSIC, `maxParticipants` capped at `PERSONAL_FREE_LIMIT`, copies `instance.dataJson` into `fixtureSnapshot`) and creates the creator as a `PoolMember` with role HOST / status ACTIVE.
  - Computes whether payment is required (requested capacity above the free limit) and the upgrade price via `calculateUpgradePrice("personal", ...)`.
  - Writes a `POOL_CREATED` audit event; returns the pool plus `paymentRequired`/`requestedCapacity`/`upgradePriceUsd` when applicable.
- **`GET /:poolId`** (pool detail): requires the caller to be an ACTIVE member (else 403). Loads the pool with its `tournamentInstance`, counts active members, and returns a shaped payload: `pool` fields, `myMembership`, `counts.membersActive`, `tournamentInstance` summary, and `permissions` (`canManageResults`/`canInvite` derived from `isPoolAdmin(role)`).

**Exports:** `poolsRouter`.

**Key dependencies:** `prisma`, `requireAuth`, `lib/audit`, `lib/roles`, `validation/pickConfig`, `lib/pickPresets`, `lib/fixture`, `lib/apiResponse`, `lib/timezone`, `lib/pricing`, plus the nine sub-routers.

**Flags:** `maxParticipants` is always clamped to `PERSONAL_FREE_LIMIT` at creation, so the larger capacity is only signalled back via `paymentRequired` for a later upgrade — intentional but worth noting (the requested value is not stored).

---

### backend/src/routes/resendWebhook.ts

**Purpose:** Receives Resend email webhooks (bounces/complaints) and records suppressed addresses so the platform stops emailing them.

**What it does:**
- Exports `resendWebhookRouter`. Reads `RESEND_WEBHOOK_SECRET` from env.
- `verifySignature(payload, signature)` — computes an HMAC-SHA256 (base64) of the raw payload using the secret and `timingSafeEqual`-compares it to the provided signature; returns false on missing secret/signature or length mismatch.
- `POST /` — reconstructs the raw body, reads the `svix-signature` header, and (when a secret is configured) rejects with `401 INVALID_SIGNATURE` on verification failure. Parses the event; for `email.bounced` / `email.complained`, normalizes each recipient address (trim + lowercase) and upserts an `EmailSuppression` row with the reason, Resend `email_id`, and raw event data. Returns `{ received: true }`; logs and returns `500 PROCESSING_ERROR` on parse/processing error.

**Exports:** `resendWebhookRouter`.

**Key dependencies:** `prisma` (`emailSuppression` model), `crypto`, `lib/logger`.

**Flags:** Signature verification uses a raw HMAC over the body, but the header read is Svix's `svix-signature` (which normally carries a versioned, prefixed format) — the verification only works if Resend/Svix sends a plain base64 HMAC. Possible mismatch with Svix's actual signature scheme; medium-confidence concern, not strictly dead code.

---

### backend/src/routes/results.ts

**Purpose:** Thin HTTP layer for publishing per-match results and reading the pool leaderboard. Core logic in `services/resultService.ts`.

**What it does:**
- Exports `resultsRouter`, applies `requireAuth`.
- Helpers: `auditCtx` and `handleServiceError` (same pattern as siblings, full 400/401/403/404/409/500 mapping).
- `resultPublishLimiter` — max 10 result updates/minute (`TOO_MANY_RESULT_UPDATES`).
- `upsertResultSchema` (Zod) — `homeGoals`/`awayGoals` (0-99), optional 90-minute scores `homeGoals90`/`awayGoals90` (for extra-time matches), optional `homePenalties`/`awayPenalties`, optional `reason` (required only when overriding an existing result).
- **`PUT /:poolId/results/:matchId`** (HOST/CO_ADMIN/CORPORATE_HOST):
  - Validates body, calls `publishResult(...)` which returns `{ saved, pool, match, source }`.
  - If `source === "HOST_OVERRIDE"` and a reason was given: builds a match description from `extractTeams`, fetches the previous result from `poolMatchResultVersion` history (the second-most-recent version), resolves the host's display name, and fires (via `fireAndForget`) `sendResultOverrideNotification` to every ACTIVE member who has `emailNotificationsEnabled`, localized per `resolveUserLocale`.
  - Otherwise (normal publish via sync or manual): calls `sendResultNotifications(...)` with the pool/match scoring context.
  - Always fires `handleAutoAdvance(...)` (fire-and-forget bracket advancement).
  - Returns the saved result.
- **`GET /:poolId/leaderboard`** — reads `verbose` query flag, calls `getLeaderboard(poolId, userId, verbose)`.

**Exports:** `resultsRouter`.

**Key dependencies:** `services/resultService` (`publishResult`, `sendResultNotifications`, `handleAutoAdvance`, `getLeaderboard`), `lib/email.sendResultOverrideNotification`, `lib/asyncHelpers.fireAndForget`, `lib/constants.resolveUserLocale`, `lib/fixture.extractTeams`, `ServiceError`. Uses a dynamic `import("../db")` for the override-history queries.

**Flags:** none.

---

### backend/src/routes/salesRedemption.ts

**Purpose:** Customer-facing endpoint that resolves a "cuenta de cobro" (account receivable) redemption code into a summary the checkout wizard can preview. Authenticated but not admin-gated.

**What it does:**
- Exports `salesRedemptionRouter`, applies `requireAuth`.
- `redeemSchema` — `redemptionCode` string 8-12 chars (lookup normalizes to 8 digits).
- **`POST /redeem`** — looks up the CC via `findByRedemptionCode`. Returns `404` if not found; returns specific `409` conflicts for `PAID` (ALREADY_PAID), `REDEEMED` (ALREADY_REDEEMED), `CANCELLED`, and `EXPIRED`/past-`validUntil`. For a `PENDING` CC, returns the summary the wizard needs: id, consecutive, targetCapacity, currency, amountCop, amountUsdCents, poolType, clientLegalName, validUntil. This is a pure lookup; the atomic REDEEMED lock happens later in `paymentService.initiateCheckout`.

**Exports:** `salesRedemptionRouter`.

**Key dependencies:** `requireAuth`, `services/sales/accountReceivableService.findByRedemptionCode`, `lib/apiResponse`.

**Flags:** Uses `console.error` for the catch-all instead of the project `logger` — minor inconsistency.

---

### backend/src/routes/structuralPicks.ts

**Purpose:** Endpoints for a member's structural predictions (group standings ordering and knockout-winner picks) per phase, with per-match deadline locking and merge semantics.

**What it does:**
- Exports `structuralPicksRouter`, applies `requireAuth`.
- **Schemas:** `groupStandingsPickSchema` (`groupId` + exactly 4 `teamIds` in order), `knockoutWinnerPickSchema` (`matchId` + `winnerId`), wrapped into `groupStandingsPhasePickSchema` (`{ groups }`) and `knockoutPhasePickSchema` (`{ matches }`), unioned as `structuralPickPayloadSchema`.
- Helper `requireActivePoolMember(userId, poolId)` returns whether the user is an ACTIVE member.
- **`PUT /:poolId/structural-picks/:phaseId`** — validates body, verifies membership, loads pool+instance. Rejects if pool status disallows picks (`canMakePicks`) or instance is ARCHIVED. Reads phases from `pool.fixtureSnapshot ?? tournamentInstance.dataJson` (CLAUDE.md invariant 6) and 404s if the phase is missing. Rejects with `409 PHASE_LOCKED` if the phase is in `pool.lockedPhases`. For knockout (`matches`) payloads, applies a **per-match deadline filter**: each incoming pick is dropped if its match's `kickoffUtc - deadlineMinutesBeforeKickoff` has passed or the matchId is unknown; if every submitted match is locked, returns `409 DEADLINE_PASSED` with `lockedMatchIds`. Then it **merges** valid incoming knockout picks with the existing `StructuralPrediction.pickJson` (preserving already-saved locked matches via a Map). Upserts the `StructuralPrediction` (unique on `poolId_userId_phaseId`), writes a `STRUCTURAL_PREDICTION_UPSERTED` audit event, and returns the prediction.
- **`GET /:poolId/structural-picks/:phaseId`** — returns the user's pick for one phase (`{ pick: null }` if none).
- **`GET /:poolId/structural-picks`** — returns all of the user's structural picks in the pool.

**Exports:** `structuralPicksRouter`.

**Key dependencies:** `prisma`, `requireAuth`, `lib/audit`, `services/poolStateMachine.canMakePicks`, `lib/fixture` (`extractMatches`, `extractPhases`, `typed`, `StructuralPickJson`), `lib/apiResponse`.

**Flags:** none.

---

### backend/src/routes/structuralResults.ts

**Purpose:** HOST/CO_ADMIN endpoints to publish official structural results per phase (group standings + knockout winners), with single-match override notifications and automatic bracket advancement.

**What it does:**
- Exports `structuralResultsRouter`, applies `requireAuth`.
- **Schemas:** mirror `structuralPicks.ts` (group standings with 4 teamIds, knockout winners), plus `knockoutMatchWinnerSchema` (`winnerId` + optional `reason`).
- **`PUT /:poolId/structural-results/:phaseId`** — requires pool admin (`requirePoolAdmin`); validates pool status (`canPublishResults`) and non-archived instance; validates the phase exists (from `tournamentInstance.dataJson`); upserts `StructuralPhaseResult` (unique on `poolId_phaseId`) with the full `resultJson`, recording publisher and `publishedAtUtc`; audits `STRUCTURAL_RESULT_PUBLISHED`.
- **`PUT /:poolId/structural-results/:phaseId/match/:matchId`** — single knockout-winner publish/override. Validates admin/status/instance; resolves phase+match from `pool.fixtureSnapshot ?? dataJson`; rejects if `winnerId` isn't one of the two teams. Reads existing `resultJson.matches`, detects override (existing entry with a different winner) and requires a non-empty `reason` for overrides (`400 REASON_REQUIRED_FOR_OVERRIDE`). Merges the winner into `matches[]`, upserts the result, and audits `KNOCKOUT_WINNER_OVERRIDDEN` or `KNOCKOUT_WINNER_PUBLISHED`. On override, fires (`fireAndForget`) `sendKnockoutWinnerOverrideNotification` to every ACTIVE member with `emailNotificationsEnabled` (localized). Then performs a best-effort **auto-advance**: when all phase matches now have winners, calls `validateCanAutoAdvance` and, if allowed, finds the next non-GROUP phase by order and calls `advanceKnockoutPhase`, auditing `TOURNAMENT_AUTO_ADVANCED_KNOCKOUT`. Returns `{ result, isOverride, autoAdvance }`. Auto-advance failures are caught and logged (don't roll back the publish).
- **`GET /:poolId/structural-results/:phaseId`** and **`GET /:poolId/structural-results`** — any ACTIVE member can read one phase result or all phase results (each includes the `createdBy` user summary).

**Exports:** `structuralResultsRouter`.

**Key dependencies:** `prisma`, `requireAuth`, `lib/audit`, `services/poolStateMachine.canPublishResults`, `lib/roles.requirePoolAdmin`, `lib/fixture` (`extractPhases`, `extractMatches`, `extractTeams`), `lib/apiResponse`, `lib/asyncHelpers.fireAndForget`, `lib/email.sendKnockoutWinnerOverrideNotification`, `lib/constants.resolveUserLocale`, `services/instanceAdvancement` (`validateCanAutoAdvance`, `advanceKnockoutPhase`).

**Flags:** none.

---

### backend/src/routes/unsubscribe.ts

**Purpose:** Public (no-auth) email unsubscribe endpoints — both browser GET and RFC 8058 one-click POST.

**What it does:**
- Exports `unsubscribeRouter`.
- **`GET /?token=xxx`** — verifies the token via `verifyUnsubscribeToken`; on success, sets the user's `emailNotificationsEnabled = false` and redirects to `${FRONTEND_URL}/unsubscribed`. Returns `MISSING_TOKEN`/`INVALID_TOKEN`/`USER_NOT_FOUND` errors otherwise.
- **`POST /?token=xxx`** — one-click unsubscribe (List-Unsubscribe-Post); same token verification and update, returns `{ unsubscribed: true }` JSON.

**Exports:** `unsubscribeRouter`.

**Key dependencies:** `prisma`, `lib/unsubscribe.verifyUnsubscribeToken`, `lib/apiResponse`.

**Flags:** `FRONTEND_URL` falls back to `http://localhost:5173` (a Vite default port), whereas the rest of the app is Next.js on port 3000 — a stale default left over from the old frontend.

---

### backend/src/routes/userProfile.ts

**Purpose:** Authenticated `/users` profile endpoints: read/update profile, set the first-login locale preference (with deferred verification/welcome emails), and detect country.

**What it does:**
- Exports `userProfileRouter`, applies `requireAuth`.
- `updateProfileSchema` (Zod) — validates `displayName`, `username` (alphanumeric+underscore, 3-20), `firstName`/`lastName`, `dateOfBirth` (ISO), `gender` enum, `bio`, `country` (ISO alpha-2), `timezone`.
- **`GET /me/profile`** — returns the full user profile, including `isGoogleAccount` (derived from `googleId`), `locale`, `requestedLocale`, and `needsLocalePrompt` (true while `localePromptCompletedAt` is null — gates the first-login language modal).
- **`POST /me/locale-preference`** — validated by `localePreferenceSchema` (`locale` required from `SUPPORTED_LOCALES`, optional `country` 2-letter, optional `requestedLocale` ISO 639-1/3 up to 8 chars). Snapshots the pre-update user, then updates `locale`, normalized `country`/`requestedLocale`, sets `localePromptCompletedAt = now`, and sets `welcomeEmailSentAt = now` only if it was null (to prevent the fallback job from double-sending). Fires an audit event. Then, as deferred side-effects: sends the verification email (only on first-time completion when email unverified and a token exists) and the welcome email (only when not previously welcomed) — both in the just-chosen locale. Also writes the `NEXT_LOCALE` cookie server-side via `setLocaleCookie` as a defensive fallback. Returns `{ locale }`.
- **`GET /me/detect-country`** — reads the Cloudflare `cf-ipcountry` header, returns it if it matches `^[A-Z]{2}$`, else null (used to pre-fill the modal's country dropdown).
- **`PATCH /me/profile`** — validates payload; enforces username uniqueness and a 30-day change cooldown (`USER_RULES.USERNAME_CHANGE_COOLDOWN_DAYS`, returns `USERNAME_CHANGE_TOO_SOON` with `daysRemaining`); enforces age min/max (`USER_RULES.MIN_AGE`/`MAX_AGE` → `AGE_TOO_YOUNG`/`AGE_INVALID`); builds an incremental update object; on username change updates `lastUsernameChangeAt` and audits `USERNAME_CHANGED`; updates the user and audits `PROFILE_UPDATED` with the changed field list.

**Exports:** `userProfileRouter`.

**Key dependencies:** `prisma`, `requireAuth`, `lib/audit`, `lib/apiResponse`, `lib/constants` (`USER_RULES`, `SUPPORTED_LOCALES`, `SupportedLocale`), `lib/email` (`sendVerificationEmail`, `sendWelcomeEmail`), `lib/authCookies.setLocaleCookie`, `lib/asyncHelpers.fireAndForget`. Implements the ADR-063 welcome-email handoff.

**Flags:** none.

---

### backend/src/schemas/templateData.ts

**Purpose:** Zod schemas + a cross-reference validator for tournament template data (teams, phases, matches) used by seed/admin tooling.

**What it does:**
- `templateTeamSchema` — `id`, `name`, optional `shortName`/`code`/`groupId`/`apiFootballId`.
- `templatePhaseSchema` — `id`, `name`, `type` (`GROUP`|`KNOCKOUT`), `order` (1-99), optional `config` (`groupsCount`/`teamsPerGroup`/`legs`).
- `templateMatchSchema` — `id`, `phaseId`, `kickoffUtc` (ISO), `homeTeamId`/`awayTeamId`, optional `matchNumber`/`roundLabel`/`venue`/`groupId`.
- `templateDataSchema` — optional `meta` (name/competition/seasonYear/sport literal "football"), required `teams`/`phases`/`matches` arrays, optional `note`; `.passthrough()` keeps unknown keys.
- `validateTemplateDataConsistency(data)` — returns `TemplateDataIssue[]`: checks duplicate team ids, duplicate phase ids and orders, duplicate match ids; verifies each match's `phaseId` exists; verifies home/away team ids exist (skipping placeholder ids that start with `W_`, `RU_`, `L_`, `3rd_`); and flags matches where home == away.

**Exports:** `templateTeamSchema`, `templatePhaseSchema`, `templateMatchSchema`, `templateDataSchema`, type `TemplateData`, type `TemplateDataIssue`, `validateTemplateDataConsistency`.

**Key dependencies:** `zod`.

**Flags:** none. (Note the consistency validator's placeholder convention is the WC-2026 style `W_`/`RU_`/etc., not the UCL `t_TBD` style.)

---

### backend/src/scripts/fetchUclData.ts

**Purpose:** One-off diagnostic/data-gathering script that fetches all UCL 2025-26 fixtures from API-Football and dumps them to `ucl_2025_fixtures.json` for analysis and seed authoring.

**What it does:** `main()` creates an `ApiFootballClient`, fetches fixtures for `league: 2, season: 2025`, groups them by round and prints a status-count summary, focuses on "Round of 32" (grouping legs into ties by sorted team-id key, printing leg1/leg2 details), and prints any already-populated future rounds (R16/QF/SF/Final). Finally it writes a JSON file containing `fetchedAt`, `totalFixtures`, and the mapped `roundOf32` fixtures (ids, dates, status, teams, goals, score) to `__dirname/ucl_2025_fixtures.json`. Exits 0/1 on success/error.

**Exports:** none (executable script).

**Key dependencies:** `dotenv/config`, `services/apiFootball/client.ApiFootballClient`, `fs`, `path`.

**Flags:** Developer tooling — not part of the runtime server. Console-driven, expected to be run manually.

---

### backend/src/scripts/initSmartSyncStates.ts

**Purpose:** CLI utility to (re)initialize Smart Sync match states for a tournament instance and print current sync status.

**What it does:** `initSmartSyncStates()` reads an instance id from `process.argv[2]` (default `"wc2022-autotest-instance"`), loads the instance with its `matchMappings` (exits if missing), prints its name/`resultSourceMode`/mapping count, calls `smartSync.initializeMatchSyncStates(instanceId)`, prints how many states were created plus the status breakdown (`pending`/`inProgress`/`awaitingFinish`/`completed`/`skipped`) from `getSyncStatus`, then lists up to 5 upcoming PENDING checks (internalMatchId, kickoff time, first-check time). Disconnects Prisma.

**Exports:** none (executable script).

**Key dependencies:** `prisma`, `services/smartSync.getSmartSyncService`.

**Flags:** Default instance id `"wc2022-autotest-instance"` is a stale test fixture id; low impact since it's overridable by argv.

---

### backend/src/scripts/migrateExtraTimeConfig.ts

**Purpose:** Data migration that sets `includeExtraTime=true` on `pickTypesConfig` phase entries for phases that already have published results (since historical results stored ET-inclusive totals and can't be retroactively split).

**What it does:** `main()` loads all pools with a non-null `pickTypesConfig`; for each, gathers that pool's `PoolMatchResult` rows, skipping pools with no results. It builds the set of matchIds that have a `currentVersionId`, reloads the pool's fixture data (`fixtureSnapshot ?? tournamentInstance.dataJson`), builds a matchId→phaseId map by walking `phases[].groups[].matches[]`, and computes the set of phases that have at least one result. It then maps over the phase config array, setting `includeExtraTime: true` for any phase with results that didn't already have it; if changed, persists the updated `pickTypesConfig` and logs the affected phases. Prints a count of updated pools.

**Exports:** none (executable migration script).

**Key dependencies:** `@prisma/client.PrismaClient` (instantiates its own client), `dotenv/config`.

**Flags:** The matchId→phaseId mapping walks `phase.groups[].matches[]`, a GROUP-style fixture shape; knockout-only fixtures (e.g., the UCL seed which has flat phase matches, not nested groups) would produce an empty map and silently skip. Likely a one-time migration already run; medium-confidence stale-after-use.

---

### backend/src/scripts/seedAdmin.ts

**Purpose:** Idempotent dev seed that ensures a platform ADMIN user exists.

**What it does:** `main()` targets `admin@example.com` / username `platform_admin` / password `Admin123!`. If the user exists, it updates `platformRole=ADMIN`, `status=ACTIVE`, `displayName`. Otherwise it hashes the password (`hashPassword`) and creates the admin user. Logs the resulting credentials.

**Exports:** none (executable script).

**Key dependencies:** `prisma`, `lib/password.hashPassword`, `dotenv/config`.

**Flags:** Hardcoded default admin credentials — fine for local dev, must never be run against production. Overlaps with `seedTestAccounts.ts` (which creates an env-driven admin).

---

### backend/src/scripts/seedLegalDocuments.ts

**Purpose:** Seeds initial legal documents (Terms of Service, Privacy Policy) into the `LegalDocument` table from markdown files in `src/data/legal/`.

**What it does:** Declares `DOCUMENTS_TO_SEED` (two Spanish docs, version `2026-01-25`, with filenames in `LEGAL_DOCS_DIR`). `main()` iterates each: verifies the markdown file exists, reads its content, and checks for an existing row by the `type_version_locale` unique key. If found, updates its title/content/changeSummary and re-activates it (sets `publishedAt`/`effectiveAt`). If new, deactivates all prior active docs of the same type+locale (`updateMany isActive:false`), then creates the new active document. Finally prints a summary of all legal docs and their active/inactive status.

**Exports:** none (executable script).

**Key dependencies:** `@prisma/client` (`PrismaClient`, `LegalDocumentType`), `fs`, `path`.

**Flags:** Only seeds `es` locale documents; EN/PT legal docs are not covered here (may be handled elsewhere). Not dead code.

---

### backend/src/scripts/seedTestAccounts.ts

**Purpose:** Idempotent seed of QA test accounts (admin/host/player) driven entirely by `TEST_*` env vars.

**What it does:** `upsertUser(...)` hashes the password and upserts a user by email (resetting password/displayName/role/status on re-run). `main()` reads `TEST_ADMIN_EMAIL/PASSWORD`, `TEST_HOST_EMAIL/PASSWORD`, `TEST_PLAYER_EMAIL/PASSWORD`; throws if any are missing. Creates a `qa_admin` (platformRole ADMIN), `qa_host` (platformRole PLAYER — the real HOST role is per-pool via `PoolMember.role`), and `qa_player` (PLAYER). Logs the created accounts.

**Exports:** none (executable script).

**Key dependencies:** `prisma`, `lib/password.hashPassword`, `dotenv/config`.

**Flags:** none.

---

### backend/src/scripts/seedUcl2025.ts

**Purpose:** Seeds the UEFA Champions League 2025-26 knockout tournament (template + version + AUTO instance + fixture mappings + sync states), modeling all rounds as two-legged except the single-match Final.

**What it does:**
- Defines IDs (`ucl-2025-template`/`-version`/`-instance`), team datasets (`R32_TEAMS` — 16 dieciseisavos teams; `TOP8_TEAMS` — 8 seeded teams; `TBD_TEAM` placeholder), and a `LOGO(id)` helper for API-Football logo URLs. `ALL_TEAMS` combines them.
- `R32_TIES` — 8 ties with real API-Football fixture IDs and kickoffs for both legs. `R16_TIES` — 8 ties (post-draw teams, kickoffs, no fixture IDs yet).
- `buildTemplateData()` — builds 9 phases (`KNOCKOUT_LEG` legs r32/r16/qf/sf plus `KNOCKOUT_FINAL`), generates match objects for R32 (real, SCHEDULED), R16 (real teams, SCHEDULED), and QF/SF/Final (PLACEHOLDER with `t_TBD`), assigns sequential `matchNumber`, sorts by kickoff, and attaches an `advancement` rules block (AGGREGATE per round, SINGLE_MATCH final, seeded teams list) plus `meta` (KNOCKOUT_TWO_LEGGED, Budapest final venue).
- `seedUcl2025()` — upserts the `TournamentTemplate`, upserts a PUBLISHED `TournamentTemplateVersion` (and points `currentPublishedVersionId` at it), upserts an ACTIVE `TournamentInstance` in `resultSourceMode: AUTO` (apiFootballLeagueId 2, season 2025, syncEnabled). It deletes+recreates `MatchExternalMapping` rows for R32/R16 ties that have fixture IDs, deletes+recreates `MatchSyncState` rows (PENDING, with `firstCheckAtUtc`/`finishCheckAtUtc` from `MATCH_SYNC` offsets) for all SCHEDULED matches, and prints a detailed structure/schedule summary.

**Exports:** none (executable seed).

**Key dependencies:** `prisma`, `lib/constants.MATCH_SYNC`, `dotenv/config`.

**Flags:** none. (Phase `type` values `KNOCKOUT_LEG`/`KNOCKOUT_FINAL` differ from the `templateData.ts` schema's `GROUP|KNOCKOUT` enum — this seed bypasses `templateDataSchema` validation, unlike `seedWc2026Sandbox.ts`.)

---

### backend/src/scripts/seedWc2026Sandbox.ts

**Purpose:** Seeds the FIFA World Cup 2026 sandbox tournament — full 12-group stage with real API-Football fixtures plus placeholder knockout bracket — as a PUBLISHED template/version and an AUTO-sync ACTIVE instance.

**What it does:**
- `WC2026_GROUPS` — all 48 teams across groups A-L with names/codes/API-Football ids. `GROUP_FIXTURES` — 72 official group-stage fixtures per group as `[fixtureId, kickoffUtc, homeApiId, awayApiId, venue]` rows.
- `buildWc2026SandboxData()` — builds internal teams (`t_{group}{n}`) with an `apiIdToTeamId` reverse map; builds 6 phases (group_stage GROUP + round_of_32/round_of_16/quarter_finals/semi_finals/finals KNOCKOUT). Group matches are derived from `GROUP_FIXTURES` (computing matchday, normalizing kickoff to ISO, building `fixtureMapping[]`), throwing if an API team id can't be mapped. Knockout stages are placeholders following the official FIFA bracket: R32 (16 matchups #73-88 using `W_`/`RU_`/`3rd_POOL_n` placeholder ids), R16 (#89-96 with `W_R32_n`), QF (#97-100), SF (#101-102), plus the 3rd-place (`L_SF_n`) and Final (`W_SF_n`) matches (#103-104), with synthetic incrementing kickoff times. Returns `{ data, fixtureMapping }`.
- `main()` — builds the data, validates it against `templateDataSchema.parse` + `validateTemplateDataConsistency` (throws on issues). Upserts the template by `key: "wc_2026_sandbox"`, creates the next PUBLISHED version, points `currentPublishedVersionId` at it. Finds-or-creates a single ACTIVE instance named "WC 2026 (Sandbox Instance)" configured for AUTO sync (league 1, season 2026). Deletes+recreates `MatchExternalMapping` rows (re-deriving home/away API ids from `GROUP_FIXTURES`) and `MatchSyncState` rows (PENDING, with `MATCH_SYNC` check offsets) for the group-stage fixtures. Logs final ids.

**Exports:** none (executable seed).

**Key dependencies:** `prisma`, `lib/constants.MATCH_SYNC`, `schemas/templateData` (`templateDataSchema`, `validateTemplateDataConsistency`), `dotenv/config`.

**Flags:** none.

---

### backend/src/scripts/ucl_2025_fixtures.json

**Purpose:** Static data dump produced by `fetchUclData.ts` — a snapshot of UCL 2025-26 fixtures from API-Football, used as a reference when authoring/updating the UCL seed.

**What it does:** A 613-line JSON object with top-level `fetchedAt` (2026-02-27), `totalFixtures` (268), and a `roundOf32` array. Each Round-of-32 entry carries `fixtureId`, `date`, `status` (e.g. "FT"), `round`, `homeTeam`/`awayTeam` (`id`/`name`/`logo`), `goals`, and a nested `score` (halftime/fulltime/extratime/penalty). It is a flat, non-executable data file.

**Exports:** n/a (data file).

**Key dependencies:** Generated by `fetchUclData.ts`; consumed manually by humans / `seedUcl2025.ts` authoring.

**Flags:** Generated artifact checked into the repo; a snapshot, so it will drift from live API data. Low-confidence "could be regenerated rather than committed."

---

### backend/src/scripts/updateUclR16Draw.ts

**Purpose:** One-time update script run after the UCL R16 draw (Feb 27, 2026): fetches R16 fixtures from API-Football and rewrites the placeholder R16 matches across the instance, the template version, and every existing pool's fixture snapshot, then creates the R16 mappings and sync states.

**What it does:**
- `API_TO_INTERNAL` — map from API-Football team ids to the seed's internal `t_*` ids (R32 + seeded teams).
- `fetchR16Fixtures()` — fetches league 2/season 2025 fixtures, filters to "Round of 16" (asserts exactly 16), groups legs into ties by sorted team-id key (asserts exactly 8), sorts each tie's legs by date, maps to internal team ids (throws on unknown ids), and returns `R16TieData[]` (teamA = leg1 home, teamB = leg1 away, with fixture ids + kickoffs).
- `updateMatchesWithR16Data(data, r16Ties)` — pure transform that, for each PLACEHOLDER match whose `phaseId` starts with `r16_`, finds the matching tie by `tieNumber` and rewrites home/away team ids (leg1: A vs B; leg2: B vs A), kickoff, label, and flips status to SCHEDULED. Non-R16/non-placeholder matches are untouched.
- `main()` — fetches R16 ties (prints them), loads the instance, short-circuits if no placeholders remain, updates `TournamentInstance.dataJson`, updates `TournamentTemplateVersion.dataJson`, upserts R16 `MatchExternalMapping` rows (leg1/leg2), upserts R16 `MatchSyncState` rows (PENDING, with `MATCH_SYNC` offsets), and updates every pool's `fixtureSnapshot` for the instance (only placeholders, preserving R32 data/results). Prints a summary and verifies the SCHEDULED/PLACEHOLDER counts, warning if any R16 match is still a placeholder.

**Exports:** none (executable script).

**Key dependencies:** `prisma`, `services/apiFootball/client.ApiFootballClient`, `lib/constants.MATCH_SYNC`, `dotenv/config`.

**Flags:** A single-use operational script (the draw it targets is already past). Now effectively idempotent/no-op since R16 is already SCHEDULED; low-confidence "spent" script.

---

### backend/src/server.ts

**Purpose:** Express application entrypoint — env validation, middleware, CORS, route composition, two service endpoints, the global error handler, cron-job lifecycle, and graceful shutdown.

**What it does:**
- Loads `dotenv/config` and runs `validateEnv()` before anything else.
- Creates the Express `app`, sets `trust proxy = 1` (Railway), and configures CORS with an allowlist derived from `SITE_DOMAIN` (apex + www) plus `CORS_EXTRA_ORIGINS` and `http://localhost:3000` in non-production; allows credentials and no-origin requests, rejects others with a CORS error. Applies `helmet()` and `cookieParser()`.
- **Polar webhook** (`POST /payments/webhook`) is mounted with `express.raw(...)` **before** `express.json()` so the raw body is available for signature verification; then `express.json({ limit: "1mb" })` and the global `apiLimiter` are applied.
- `GET /health` returns `BUILD_VERSION` ("v1.0.0"), `COMMIT_SHA` (from `RAILWAY_GIT_COMMIT_SHA`), and a timestamp.
- `GET /invite-preview/:code` — public invite preview: loads a `PoolInvite` with pool/tournament/active-member-count/host (HOST or CORPORATE_HOST) and the pool's `organization` branding; computes expiry and max-uses; returns pool name, tournament name, host name, member count, status, a `valid` flag, and the organization branding (logo/colors/welcomeMessage) or null for personal pools.
- `GET /api/active-matches` — service-to-service endpoint for the picks4all-scores scraper, authenticated by `SCORES_SERVICE_API_KEY` (via `x-api-key` header or `key` query). Loads all AUTO+syncEnabled+ACTIVE instances with their match mappings and returns the fixtures whose kickoff falls in a window of [now-3h, now+24h], each with fixtureId/internalMatchId/instance/team names/kickoff/league/season.
- **Auth rate limiters** applied to specific `/auth/*` paths (login, register, forgot/reset-password, resend-verification, check-corporate-invite, activate-corporate).
- **Route composition:** mounts `/auth`, `/admin`, `/pools`, `/me`, `/users`, `/catalog`, `/pick-presets`, `/legal`, `/feedback` (with its own 2mb json), `/corporate`, `/sales/account-receivables` (salesRedemption), `/unsubscribe`, `/webhooks/resend`, `/payments` (paymentsRouter), and `POST /payments/mp-webhook` (Mercado Pago webhook handler).
- **Global error handler** — maps CORS errors to 403, logs others and returns 500 (message hidden in production).
- **Process-level handlers** for `unhandledRejection` (log) and `uncaughtException` (log + delayed `process.exit(1)`).
- **Startup** — listens on `PORT` (default 3000), logs, and starts 13 cron jobs: smart sync, deadline reminder, new-member digest, phase sync, fixture tracking, live scores, fixture verification, track-status checker, CAPI retry, Polar payment reconcile, MP payment reconcile, account-receivable expiry, and welcome-email fallback.
- **Graceful shutdown** (`gracefulShutdown`) on SIGTERM/SIGINT — closes the HTTP server, stops all cron jobs, disconnects Prisma, and force-exits after a 10s timeout.

**Exports:** none (entrypoint; creates and listens on `app`).

**Key dependencies:** `express`, `cors`, `helmet`, `cookie-parser`; all route routers; `lib/apiResponse`, `lib/logger`, `lib/env`; `middleware/rateLimit`; all 13 `jobs/*` start/stop functions; `routes/payments` (`createWebhookHandler`, `paymentsRouter`, `createMpWebhookHandler`); `db.prisma`.

**Flags:** Dual payment gateway is live (Polar webhook + Mercado Pago `mp-webhook`); no Wompi reference here (Wompi already removed). `stopLiveScoresJob` is called in shutdown but `startLiveScoresJob` is among the started jobs — consistent. None of note.
