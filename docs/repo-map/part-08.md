## Batch 8

### backend/src/services/adminInstanceService.ts

**Purpose:** Pure business-logic layer (no Express) for managing tournament *instances* — lifecycle state, result-source configuration, external fixture mappings, API-Football sync, and knockout-phase advancement/draw population. Receives plain data + an `AuditContext`, returns plain data or throws `ServiceError`.

**What it does:**
- **`ensureTransition(from, to)`** — internal whitelist of allowed `TournamentInstanceStatus` transitions: `DRAFT → ACTIVE|ARCHIVED`, `ACTIVE → COMPLETED`, `COMPLETED → ARCHIVED`, `ARCHIVED → ∅`.
- **`createInstance(userId, templateId, name?, templateVersionId?, ctx)`** — loads the template (with `currentPublishedVersion`); resolves a source version (explicit `templateVersionId` or the template's published version), requiring it to belong to the template and be `PUBLISHED`; creates a `TournamentInstance` in `DRAFT` copying `version.dataJson`. Fires `TOURNAMENT_INSTANCE_CREATED` audit.
- **`transitionInstance(...)`** (private) + the three public wrappers **`activateInstance`**, **`completeInstance`**, **`archiveInstance`** — guard via `ensureTransition`, update status, audit (`TOURNAMENT_INSTANCE_ACTIVATED/COMPLETED/ARCHIVED`).
- **`listInstances()`** / **`getInstance(instanceId)`** — read helpers (404 on miss).
- **Advancement wrappers** delegating to `instanceAdvancement`: **`advanceInstanceToR32`** (calls `advanceToRoundOf32`, audits standings/winners/runnersUp/bestThirds counts), **`advanceInstanceKnockout`** (`advanceKnockoutPhase` between two phase IDs), **`advanceInstanceTwoLegged`** (resolves pool IDs — one explicit or all pools on the instance — loops `advanceTwoLeggedPhase` per pool, audits winners-per-pool). **`getGroupStageStatus`** returns `validateGroupStageComplete` results (complete flag + missing matches).
- **`configureResultSource(...)`** — sets `resultSourceMode` MANUAL/AUTO; for AUTO requires `apiFootballLeagueId`+`apiFootballSeasonId`; clears those fields for MANUAL; defaults `syncEnabled` to true under AUTO. Audits `INSTANCE_RESULT_SOURCE_CONFIGURED`.
- **Match mappings:** **`createMatchMappings`** (AUTO-only; `$transaction` of `matchExternalMapping.upsert` keyed on `tournamentInstanceId_internalMatchId`), **`listMatchMappings`**, **`deleteMatchMapping`** (scoped lookup then delete; audited).
- **Sync:** **`syncInstance`** (AUTO-only; checks `getResultSyncService().isAvailable()` else 503; runs `syncService.syncInstance`; audits `MANUAL_SYNC_TRIGGERED`), **`getSyncStatus`** (recent 20 `resultSyncLog`, mapping count, `getJobStatus()`), **`triggerGlobalSync`** (`syncAllAutoInstances`, audits `GLOBAL_SYNC_TRIGGERED`), **`getGlobalSyncStatus`** (counts of AUTO / enabled-AUTO instances + 10 recent logs).
- **`updateR16Draw(userId, instanceId, ctx)`** — dynamically imports `ApiFootballClient`, fetches "Round of 16" fixtures, groups them into ties by team-pair key, sorts legs by date, maps API team IDs → internal team IDs via `dataJson.teams[].apiFootballId`. Requires exactly 16 fixtures. Rewrites `r16_leg1`/`r16_leg2` matches in instance `dataJson` (teams, kickoff, label, status SCHEDULED), persists to instance + template version, upserts `matchExternalMapping` and `matchSyncState` (using `MATCH_SYNC.FIRST_CHECK_MS`/`FINISH_CHECK_MS`) per leg, and patches each pool's `fixtureSnapshot` (only PLACEHOLDER matches). Returns a summary + verbose `logs[]`. Audits `UPDATE_R16_DRAW`.
- **`PHASE_TO_API_ROUND`** map (r32/r16/qf/sf/final → API round names) and **`ADVANCEMENT_MAP`** (r32→r16→qf→sf→final).
- **`syncNextPhaseFromApi(instanceId, nextPhase, options?)`** — generalization of `updateR16Draw` for any knockout phase. Loads instance, builds API→internal team map, fetches fixtures for the target round (catches API errors, returns `success:false` rather than throwing), validates all team mappings exist. For the **final** (single match) it sets the lone `final` match; for **two-legged** rounds it groups ties and rewrites `${nextPhase}_leg1/leg2` matches. Upserts mappings + sync states (final gets a 140-minute finish window for extra time), persists instance `dataJson` + template version, and copies resolved data into every pool's `fixtureSnapshot`. Audits `PHASE_SYNCED_FROM_API`. Returns `{ success, summary?, logs }`.
- **`tryAdvancePhaseFromApi(instanceId, completedPhase)`** — called when a phase completes. Looks up next phase via `ADVANCEMENT_MAP`; calls `syncNextPhaseFromApi`. On success, upserts a `PendingPhaseSync` row as `RESOLVED` and sends an admin notification; on failure (fixtures not yet published), upserts a `PENDING` `PendingPhaseSync` (incrementing `attempts`, storing `errorMessage`) for the 12h retry job and notifies admin. Both notifications are best-effort (swallowed).

**Exports:** `createInstance`, `activateInstance`, `completeInstance`, `archiveInstance`, `listInstances`, `getInstance`, `advanceInstanceToR32`, `advanceInstanceKnockout`, `advanceInstanceTwoLegged`, `getGroupStageStatus`, `configureResultSource`, `createMatchMappings`, `listMatchMappings`, `deleteMatchMapping`, `syncInstance`, `getSyncStatus`, `triggerGlobalSync`, `getGlobalSyncStatus`, `updateR16Draw`, `syncNextPhaseFromApi`, `tryAdvancePhaseFromApi`.

**Key dependencies:** `@prisma/client` enums (`ResultSourceMode`, `TournamentInstanceStatus`), `../db`, `../lib/constants` (`MATCH_SYNC`), `../lib/audit` (`writeAuditEvent`), `./instanceAdvancement` (`advanceToRoundOf32`, `advanceKnockoutPhase`, `advanceTwoLeggedPhase`, `validateGroupStageComplete`), `./resultSync` (`getResultSyncService`), `../jobs/resultSyncJob` (`getJobStatus`), `../lib/asyncHelpers` (`fireAndForget`), `./authService` (`ServiceError`, `AuditContext`), dynamic imports of `../services/apiFootball/client` and `../lib/email`.

**Flags:** `updateR16Draw` is an older, R16-specific version that `syncNextPhaseFromApi` generalizes; they share substantial duplicated tie-grouping/persistence logic. `updateR16Draw` requires exactly 16 fixtures (UCL-bracket-shaped, hardcoded league `2`/season `2025` defaults) and looks like a one-off operational tool retained for that specific tournament. Otherwise clean.

### backend/src/services/adminService.ts

**Purpose:** Pure business logic for platform-admin operations: dashboard stats, sandbox/seed data builders, and a set of one-off UCL Champions League data-fix/audit routines.

**What it does:**
- **`getPlatformStats()`** — parallel queries: total users, test users (`email contains example.com`), users-per-month (`$queryRaw` grouping real users by `YYYY-MM`), total pools, total `betaFeedback`. Returns shaped `{ users: {total,test,real,byMonth}, pools, feedback }` with bigints coerced to `Number`.
- **`seedWc2026()`** — idempotently seeds the "WC 2026 (Sandbox Instance)". Builds raw data via `buildWc2026SandboxData`, validates with `templateDataSchema.parse` + `validateTemplateDataConsistency`, upserts a `tournamentTemplate` (key `wc_2026_sandbox`), creates the next `tournamentTemplateVersion` (PUBLISHED), sets `currentPublishedVersionId`, and creates an ACTIVE `tournamentInstance`. Returns IDs.
- **UCL constants:** hardcoded `UCL_INSTANCE_ID = "ucl-2025-instance"`, `UCL_VERSION_ID = "ucl-2025-version"`, and `API_TO_INTERNAL` (24 API-Football team IDs → internal `t_XXX` codes).
- **`updateMatchesWithR16Data(...)`** (private) — maps PLACEHOLDER `r16_leg1/leg2` matches to scheduled matches using the supplied ties.
- **`updateUclR16()`** — fetches all league-2 season-2025 fixtures, filters Round of 16, requires 16 fixtures and 8 ties. Two branches: (a) if matches are still PLACEHOLDER, applies `updateMatchesWithR16Data` to instance + version + pools and creates mappings/sync states; (b) if already SCHEDULED, re-derives ties from a hardcoded `SEED_R16_TEAMS` map, extracts tie numbers from match IDs, rewrites teams/kickoffs, clears stale R16 mappings, recreates mappings + sync states, and re-snapshots pools. Returns logs + stats.
- **R16 late-picks audit:** hardcoded `R16_LEG1_KICKOFFS` + `R16_LEG1_LABELS` per leg-1 match. **`auditR16LatePicks()`** loads UCL pools and all leg-1 predictions, computes each pool's deadline (`kickoff − deadlineMinutesBeforeKickoff`, default 10), flags predictions whose `updatedAtUtc` is after the deadline, and returns per-pool + global summaries plus the full violations list (minutes after deadline/kickoff, pick JSON, user info).
- **`fixR16Integrity(dryRun)`** — forensic reconciliation. Builds `INTERNAL_TO_API` (inverse map), fetches R16 fixtures, matches each `SEED_R16` tie to its two fixtures (by team pair), validates, and builds `correctMappings` with fixture status/goals. Compares against current `matchExternalMapping`, instance `dataJson` kickoffs/teams, and published `poolMatchResult`s — flagging mappings to fix, kickoff/team fixes, results from wrong fixtures or not-yet-finished matches to delete, and missing results to create. When `dryRun=false` it applies all of that: rebuilds mappings, updates instance matches, upserts `matchSyncState` (COMPLETED for finished fixtures), deletes bad result versions + headers, and creates missing `poolMatchResult`/`poolMatchResultVersion` rows (using dynamically imported `parseFixtureResult`, handling AET/PEN via `homeGoals90`/`awayGoals90`/penalties). Returns dryRun flag, counts summary, correctMappings, and the detailed fix lists + logs.
- **WC2026 data builder:** `WC2026_TEAMS_BY_GROUP` (12 groups A–L of 4 teams, Spanish names, some TBD playoff slots). **`buildWc2026SandboxData()`** generates teams (`t_<group><n>`), the 6 phases (group + R32/R16/QF/SF/finals), group-stage matches via a fixed 6-pairing schedule starting 2026-06-11 (2h spacing), then knockout matches using the official FIFA WC2026 bracket placeholders (`RU_*`, `W_*`, `3rd_POOL_*`, `W_R32_*`, etc.), plus third-place and final matches. Returns `{ meta, teams, phases, matches }`.

**Exports:** `getPlatformStats`, `seedWc2026`, `updateUclR16`, `auditR16LatePicks`, `fixR16Integrity`. (Internal: `updateMatchesWithR16Data`, `buildWc2026SandboxData`, several `const` maps/interfaces.)

**Key dependencies:** `@prisma/client` (`Prisma`), `../db`, `../lib/constants` (`MATCH_SYNC`), `../schemas/templateData` (`templateDataSchema`, `validateTemplateDataConsistency`), `../services/apiFootball/client` (`ApiFootballClient`), `../lib/asyncHelpers`, `./authService` (`ServiceError`, `AuditContext`), dynamic import `../services/apiFootball` (`parseFixtureResult`).

**Flags:** `updateUclR16`, `auditR16LatePicks`, and `fixR16Integrity` are all hardcoded to the single `ucl-2025-instance` with frozen seed brackets, kickoff times, and team-ID maps — clearly one-off operational/admin scripts tied to the UCL 2025-26 tournament, not general platform logic (likely candidates for archival once that tournament ends). A comment at line 633 ("Step 3-6 omitted for brevity ... preserved in the route file") is stale/misleading since steps 3–6 are in fact fully implemented below it. `AuditContext` is imported but never used in this file.

### backend/src/services/advancementTrigger.ts

**Purpose:** Watches for knockout-phase completion per pool and schedules automatic bracket advancement (group_stage → R32 → R16 → QF → SF → Final) after a configurable grace delay, giving hosts/admins a correction window. Idempotent.

**What it does:**
- Module-level **`pendingTimers`** map (`${poolId}:${phaseId}` → `NodeJS.Timeout`) and **`NEXT_PHASE_MAP`** (phase → next phase, `final → null`).
- **`checkAndTriggerAdvancement(poolId, matchId, actorUserId?)`** — loads the pool + `fixtureSnapshot`, finds the completed match's phase, computes the next phase (returns early if final/unknown). Skips if any phase match still has placeholder teams. Fetches `poolMatchResult`s and confirms all phase matches have a current version with source in `{API_CONFIRMED, HOST_OVERRIDE, HOST_MANUAL}`. Skips if the next phase already has fully-resolved (non-placeholder) teams. Otherwise schedules a `setTimeout` of `ADVANCEMENT.DELAY_MS` (default 10 min) that calls `executeAdvancement`, keyed in `pendingTimers` (re-entry keeps the existing timer). Returns `{ scheduled, phase?, nextPhase? }`. Wrapped in try/catch returning `{ scheduled:false }` on error.
- **`executeAdvancement(...)`** (private) — re-verifies the phase is still complete (in case a HOST_OVERRIDE changed things during the delay) then runs `advanceToRoundOf32` (for group_stage) or `advanceKnockoutPhase` (otherwise). Writes a `PHASE_AUTO_ADVANCED` audit, sends an admin notification, fires per-member phase-completion summary emails, and cascades by re-calling `checkAndTriggerAdvancement` on a next-phase match (handles a rare already-complete next phase). On failure, logs and sends an `error`-category admin notification requesting manual intervention.
- **`cancelPendingAdvancement(poolId, phaseId)`** — clears and removes a pending timer; returns whether one existed.
- **`sendPhaseCompletionNotifications(poolId, completedPhaseId, poolName)`** (private) — loads ACTIVE members, all predictions, and pool results; builds a result-by-matchId map; recomputes per-user points (OUTCOME = 3 for correct result; SCORE = 3 for correct outcome, 5 for exact score — duplicates poolStateMachine scoring); ranks members (points desc, joinedAt asc tiebreak), builds top-10, resolves each member's locale via `resolveUserLocale`, localizes the phase name via `PHASE_DISPLAY_NAMES`, and `batchSendEmails` a `sendPhaseCompletionSummaryEmail` to every member with their rank/points/totals.
- **`PLACEHOLDER_PREFIXES`** + **`isPlaceholder(teamId)`** — detects unresolved team slots (`t_TBD`, `W_`, `L_`, `RU_`, `3rd_POOL_`).

**Exports:** `checkAndTriggerAdvancement`, `cancelPendingAdvancement`. (Internal: `executeAdvancement`, `sendPhaseCompletionNotifications`, `isPlaceholder`.)

**Key dependencies:** `../db`, `../lib/constants` (`ADVANCEMENT`, `PHASE_DISPLAY_NAMES`, `resolveUserLocale`), `./instanceAdvancement` (`advanceToRoundOf32`, `advanceKnockoutPhase`), `../lib/audit`, `../lib/email` (`sendAdminNotification`, `sendPhaseCompletionSummaryEmail`, `batchSendEmails`), `../lib/fixture` (`typed`, `PickJson`).

**Flags:** The scoring computation duplicates the canonical logic in poolStateMachine (acknowledged in a comment) — a known maintenance hazard if scoring rules change. `pendingTimers` lives in process memory, so scheduled advancements are lost on restart (acceptable given the re-trigger paths, but worth noting). `isPlaceholder` has a redundant condition (`teamId === "t_TBD"` is already covered by the `t_TBD` prefix). `cancelPendingAdvancement` has no obvious caller within this batch.

### backend/src/services/apiFootball/client.ts

**Purpose:** HTTP client for the API-Football (api-sports.io v3) REST API, with built-in per-minute rate limiting and typed error handling.

**What it does:**
- **`getConfig()`** — reads `API_FOOTBALL_KEY` (required, throws if missing), `API_FOOTBALL_BASE_URL` (default `https://v3.football.api-sports.io`), and `API_FOOTBALL_RATE_LIMIT` (default 10/min).
- **`RateLimiter`** — sliding 60s window of request timestamps; `waitIfNeeded()` evicts stale timestamps and, if at the cap, sleeps until the oldest timestamp exits the window (+100ms buffer); `getRemaining()` reports headroom.
- **`ApiFootballClient`** — constructs config + limiter. Private **`request<T>(endpoint, params)`** awaits the limiter, builds the URL with query params, fetches with the `x-apisports-key` header, throws `ApiFootballError` on non-2xx or on API-level `errors`, logs results/timing/remaining quota. Public methods: **`getStatus()`**, **`getLeagues(params)`**, **`getFixtures(params)`** (rich filter set: id/ids/league/season/team/date/from/to/round/status/timezone), **`getFixture(id)`** (single), **`getFixturesByIds(ids)`** (loops one-by-one for free-tier compatibility, swallowing per-fixture errors), **`getFinishedFixtures(leagueId, season)`** (status `FT-AET-PEN`), **`getLiveFixtures(leagueId)`** (in-progress statuses), **`getTodayFinishedFixtures(leagueId, season)`**, and **`getRateLimitRemaining()`**.
- **`ApiFootballError`** — `Error` subclass carrying `statusCode` and `endpoint`.
- Singleton: module-level `clientInstance`; **`getApiFootballClient()`** returns a lazily-created client only when `API_FOOTBALL_ENABLED === 'true'` (else `null`); **`isApiFootballEnabled()`** boolean.

**Exports:** `ApiFootballClient`, `ApiFootballError`, `getApiFootballClient`, `isApiFootballEnabled`.

**Key dependencies:** `./types` (response/fixture/league/status types), global `fetch`, environment variables.

**Flags:** none.

### backend/src/services/apiFootball/index.ts

**Purpose:** Barrel/entry point for the API-Football service module.

**What it does:** Re-exports everything from `./types` and `./client`.

**Exports:** all of `./types` and `./client` (e.g. `ApiFootballClient`, `parseFixtureResult`, status constants, type definitions).

**Key dependencies:** `./types`, `./client`.

**Flags:** none.

### backend/src/services/apiFootball/types.ts

**Purpose:** TypeScript type definitions and small helper functions for API-Football v3 responses, plus an application-specific parsed-result shape.

**What it does:**
- **`ApiFootballResponse<T>`** — generic envelope (`get`, `parameters`, `errors`, `results`, `paging`, `response`).
- **`ApiFootballFixture`** / **`ApiFootballTeam`** — full fixture shape (fixture meta/status/venue, league with `round`, teams, goals, and `score` broken into halftime/fulltime/extratime/penalty).
- **`FixtureStatusShort`** — union of all status codes (not-started, in-play, finished, cancelled/stopped) with documentation comments.
- Status constant arrays: **`FINISHED_STATUSES`** (`FT/AET/PEN`), **`IN_PROGRESS_STATUSES`**, **`NOT_STARTED_STATUSES`**, **`CANCELLED_STATUSES`**.
- **`ApiFootballLeague`** / **`ApiFootballSeason`** — league + season coverage metadata.
- **`ApiFootballStatus`** — account/subscription/requests usage.
- **`ParsedFixtureResult`** — simplified internal result shape (goals, fulltime/halftime/extratime/penalty splits, team IDs, kickoff, round).
- Helpers: **`isFixtureFinished(status)`**, **`isFixtureInProgress(status)`**, and **`parseFixtureResult(fixture)`** — returns `null` for unfinished matches with null goals, otherwise maps a raw fixture to `ParsedFixtureResult` (defaulting null goals to 0).

**Exports:** types `ApiFootballResponse`, `ApiFootballFixture`, `ApiFootballTeam`, `FixtureStatusShort`, `ApiFootballLeague`, `ApiFootballSeason`, `ApiFootballStatus`, `ParsedFixtureResult`; constants `FINISHED_STATUSES`, `IN_PROGRESS_STATUSES`, `NOT_STARTED_STATUSES`, `CANCELLED_STATUSES`; functions `isFixtureFinished`, `isFixtureInProgress`, `parseFixtureResult`.

**Key dependencies:** none (pure types + helpers).

**Flags:** none.

### backend/src/services/authService.activateCorporate.test.ts

**Purpose:** Vitest unit suite focused on the SESSION_MISMATCH defence inside `activateCorporateAccount`.

**What it does:** Mocks `../db` prisma (user, corporateInvite, poolMember, pool, `$transaction`), audit, email, asyncHelpers, `poolStateMachine.transitionToActive`, `poolCapacity` helpers, googleAuth, metaCapi, ga4. `$transaction` is a passthrough so inner writes hit the mock. Fixtures: `VALID_INVITE` (PENDING, valid expiry, pool with org). Tests assert:
- Throws `SESSION_MISMATCH` (statusHint 409, with `currentUserEmail`/`inviteEmail` extra) when a logged-in user's email differs from the invite email.
- Case-insensitive email match (`Bob@Empresa.com` vs `bob@empresa.com`) does **not** trigger SESSION_MISMATCH (via a happy-path setup that proves the error wasn't thrown).
- A null `currentUserId` (anonymous) skips the check entirely.
- A stale cookie pointing at a deleted user (currentUser lookup returns null) skips the check and proceeds.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `../db`, the SUT `./authService` (`activateCorporateAccount`, `ServiceError`).

**Flags:** none.

### backend/src/services/authService.security.test.ts

**Purpose:** Vitest unit suite for security properties of `requestPasswordReset` (the forgot-password flow).

**What it does:** Mocks prisma (`user.findUnique/update`), audit, `sendPasswordResetEmail`, asyncHelpers. Asserts: non-existent email returns `{ sent: false }` (no enumeration), Google-only account returns `{ sent: false, isGoogleOnly: true }` without calling `user.update`, a normal user with a password returns `{ sent: true }`, a SUSPENDED user returns `{ sent: false }` with no update, and email input is normalized/trimmed to lowercase before lookup.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `../db`, SUT `./authService` (`requestPasswordReset`).

**Flags:** none.

### backend/src/services/authService.ts

**Purpose:** Pure business-logic layer for all authentication flows — register, login, password reset, Google OAuth, email verification, and corporate-invite activation. No Express. Also defines the shared `ServiceError` class and `AuditContext` type used across the service layer.

**What it does:**
- **`AuditContext`** type and **`ServiceError`** class (`code`, `statusHint`, optional `extra`) — re-used throughout the codebase. Re-exports `SerializedUser`.
- **`generateUniqueUsername(email)`** (private) — derives a sanitized base from the email local part, appends numeric suffixes until unique, capped at 20 chars.
- **Register:** `AttributionInput` (first-touch marketing fields), `RegisterInput`, `RegisterResult`. **`registerUser(data, ctx)`** — validates consent (terms/privacy/age) and username, checks email/username uniqueness, hashes password, creates a PLAYER user with email-verification token + legal versions + write-once attribution fields, fires `USER_REGISTERED` audit. Notably it **defers** the verification email (sent later by the locale-preference modal handler) but still fires GA4 `email_verification_sent` + Meta CAPI `CompleteRegistration` + GA4 `sign_up` telemetry. Returns `emailVerificationSent: true` (conceptually).
- **`buildAttributionCustomData(attribution?)`** (private) — projects attribution into Meta `custom_data` (utm_* + gclid/fbclid), `undefined` when empty.
- **Login:** **`loginUser(email, password, ctx)`** — normalizes email, rejects non-ACTIVE (`UNAUTHENTICATED`), rejects Google-only accounts (`GOOGLE_ACCOUNT_NO_PASSWORD`), verifies password, audits `USER_LOGGED_IN`, returns serialized user.
- **Forgot password:** **`requestPasswordReset(email, ctx)`** — returns `{sent:false}` for unknown/non-ACTIVE (no enumeration), `{sent:false,isGoogleOnly:true}` for Google-only; otherwise sets reset token, sends locale-aware reset email, audits `PASSWORD_RESET_REQUESTED`.
- **Reset:** **`resetPassword(token, newPassword, ctx)`** — finds user by valid non-expired token (ACTIVE), updates hash, clears token, audits `PASSWORD_RESET_COMPLETED`, fires a password-changed email.
- **Google OAuth:** **`authenticateWithGoogle(data, ctx)`** — verifies Google ID token, finds user by email or googleId. Existing user: rejects non-ACTIVE, links googleId if missing, audits + fires CAPI `Login`/GA4 `login` telemetry, returns `isNewUser:false`. New user: requires consent, generates username, creates verified PLAYER (`emailVerified:true`, empty passwordHash) with attribution, audits `REGISTER_GOOGLE`, defers welcome email, fires CAPI `CompleteRegistration` + GA4 `sign_up`. Returns `isNewUser:true` + metaEventId.
- **Verify email:** **`verifyEmail(token, ctx)`** — finds user by valid token, returns `alreadyVerified` if already done, else marks verified, audits `EMAIL_VERIFIED`, fires GA4 `email_verification_completed`.
- **Corporate invite check:** **`checkCorporateInvite(activationToken)`** — validates token (INVALID_TOKEN / TOKEN_EXPIRED / ALREADY_ACTIVATED), returns invite email, whether a user already exists, pool name, and company name.
- **Corporate activation:** `CorporateActivationInput` (token + optional new-user fields + `currentUserId`), `CorporateActivationResult`. **`activateCorporateAccount(data, ctx)`** — validates the invite; enforces the **SESSION_MISMATCH** defence (if a logged-in user's email differs from the invite's, refuse with 409). Existing-user path: in a transaction, atomically claims the invite (`updateMany` PENDING/SENT → ACTIVATED, count must be 1 else ALREADY_ACTIVATED), creates a `poolMember` if absent (after `ensurePoolCapacity`, surfacing POOL_FULL + host notification), then `transitionToActive` + `checkAndNotifyCapacityThresholds`. New-user path: requires displayName/username/password + consent, validates/normalizes username, checks uniqueness, hashes password, and in a transaction claims the invite, creates a verified PLAYER, ensures capacity + creates membership, links `activatedUserId`; then transitions pool + capacity checks, audits `CORPORATE_ACCOUNT_ACTIVATED`, defers welcome email. Returns user + pool/company context.
- **Resend verification:** **`resendVerification(userId, ctx)`** — 404 if user missing, `ALREADY_VERIFIED` if verified; otherwise rotates the verification token, sends a locale-aware verification email (throws `EMAIL_SEND_FAILED` on failure), audits `VERIFICATION_EMAIL_RESENT`.

**Exports:** `AuditContext`, `ServiceError`, `SerializedUser` (re-export), `AttributionInput`, `RegisterInput`, `RegisterResult`, `registerUser`, `LoginResult`, `loginUser`, `ForgotPasswordResult`, `requestPasswordReset`, `resetPassword`, `GoogleAuthInput`, `GoogleAuthResult`, `authenticateWithGoogle`, `VerifyEmailResult`, `verifyEmail`, `CorporateInviteInfo`, `checkCorporateInvite`, `CorporateActivationInput`, `CorporateActivationResult`, `activateCorporateAccount`, `resendVerification`.

**Key dependencies:** `crypto`, `../db`, `../lib/password`, `../lib/audit`, `../lib/username`, `../lib/email`, `../lib/googleAuth`, `./poolStateMachine` (`transitionToActive`), `../lib/poolCapacity`, `../routes/legal` (`CURRENT_LEGAL_VERSIONS`), `../lib/constants`, `../lib/serializers`, `../lib/asyncHelpers`, `../lib/metaCapi`, `../lib/ga4`.

**Flags:** `ServiceError` and `AuditContext` are defined here and imported by most other services (a deliberate central definition, not dead code). Welcome-email deferral is intentional and documented (ADR-063 in MEMORY). None problematic.

### backend/src/services/corporateBrandingService.ts

**Purpose:** Host-driven editing of an organization's branding (logo, colors, welcome/invitation messages, invitation locale) *after* pool creation, with a forensic audit row per change.

**What it does:**
- Types: `UpdateBrandingInput` (userId, poolId, payload with tri-state `string | null | undefined` semantics: undefined = unchanged, null = clear, string = set; `invitationLocale` is a non-nullable es/en/pt enum), `BrandingFields`, `UpdateBrandingResult`.
- `BRANDING_FIELD_KEYS` — the six tracked fields.
- **`updateBranding(input, auditCtx)`** — authorizes the caller: must be a `poolMember` with role `CORPORATE_HOST`, `HOST`, or `CO_ADMIN` (else `FORBIDDEN`/HOST_ONLY). Loads the pool, requires it to exist (`NOT_FOUND`) and belong to an organization (`CONFLICT`/NOT_A_CORPORATE_POOL). In a single transaction it reads the org's current branding, diffs each present payload field (normalizing `""` → null), builds `updateData` + before/after snapshots + `fieldsChanged`. If nothing changed it returns the current branding with no audit row. Otherwise it updates the organization and writes an `organizationBrandingAudit` row (fieldsChanged, before/after JSON, ip, userAgent) in the same transaction. Returns `{ organizationId, fieldsChanged, branding }`.

**Exports:** `updateBranding`, plus types `UpdateBrandingInput`, `BrandingFields`, `UpdateBrandingResult`.

**Key dependencies:** `../db`, `./authService` (`ServiceError`, `AuditContext`), Prisma models `poolMember`, `pool`, `organization`, `organizationBrandingAudit`.

**Flags:** Comment notes HOST role is included "for forward compatibility ... (today: never)" — intentional dead branch. Otherwise clean.

### backend/src/services/corporateService.test.ts

**Purpose:** Vitest suite for `corporateService`'s invitation flows — `sendInvitations` (batch) and `resendInvitation` (single), focused on race-safety, atomic claiming, and token rotation.

**What it does:** Mocks prisma (pool, poolMember, corporateInvite), `sendCorporateActivationEmail`, audit, asyncHelpers. Provides `POOL_RECORD`, `HOST_MEMBERSHIP`, and an `inviteFixture` helper.
- **`sendInvitations`** tests: sends one email per invite when each atomic claim wins (`updateMany count=1`, PENDING→SENT) → `{sent:2,failed:0}`; skips every invite when a concurrent caller already claimed them (count=0) — proving no double emails on double-click → `{sent:0,failed:0}`; reverts the claim to FAILED when the email provider returns `success:false`; reverts to FAILED when the email send *throws*; and a mixed scenario where one invite wins its claim and sends while another loses (one email, to the winner).
- **`resendInvitation`** tests: rotates the activation token (asserts the new token is truthy, distinct from the old, has an expiry Date, and is the token actually emailed) → `{status:"SENT"}`; rejects FORBIDDEN when caller isn't the corporate host; rejects NOT_FOUND when the invite belongs to a different pool; rejects ALREADY_ACTIVATED when status is ACTIVATED; rejects ALREADY_ACTIVATED when the atomic claim loses the race (count=0, no email/no further writes); and marks the invite FAILED when the provider rejects the send (token rotation already committed so the host can retry).

**Exports:** none (test file).

**Key dependencies:** `vitest`, `../db`, SUT `./corporateService` (`sendInvitations`, `resendInvitation`), `./authService` (`ServiceError`), mocked `../lib/email` (`sendCorporateActivationEmail`).

**Flags:** none.
