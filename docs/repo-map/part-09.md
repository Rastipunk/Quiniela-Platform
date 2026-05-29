## Batch 9

### backend/src/services/corporateService.ts

**Purpose:** Pure business-logic layer for the corporate self-service flow (no Express coupling): submitting enterprise inquiries, creating corporate pools, and managing employee invitations. Receives plain data, returns plain data or throws `ServiceError`; side effects (email, audit) are fire-and-forget.

**What it does:**
- `requireCorporateHost(userId, poolId)` — Authorization guard. Looks up the `PoolMember` by composite key and returns `true` only if the member's role is `CORPORATE_HOST`. Used at the top of every mutating function.
- **Types block** — Declares input/output shapes for all service functions: `SubmitInquiryInput/Result`, `CreateCorporatePoolInput/Result`, `AddEmployeesInput/Result`, `ListEmployeesInput/Result`, `SendInvitationsInput/Result`, `DeleteEmployeeInput`. Notably `DerivedInviteStatus` (`PENDING | SENT | ACTIVATED | FAILED | EXPIRED`) where `EXPIRED` is documented as a *derived* state computed on read (DB stores only `SENT`; an invite is shown as expired when status=SENT, token window lapsed, and never activated). `ListEmployeesResult` includes pagination echo + a per-pool summary with counts.
- `submitInquiry(data)` — Persists an `OrganizationInquiry`. When `poolsConfig` (array of slot counts per pool) is provided it is treated as source of truth: derives `numberOfPools` from its length, sets the legacy scalar `slotsPerPool` only when all pools are equal-sized, and stores the raw array as `poolsConfigJson`. Builds an HTML `quoteSummary` breakdown and fires two fire-and-forget emails: `sendAdminNotification` (category `corporate_inquiry`, all fields HTML-escaped via `escapeHtml`) and `sendCorporateInquiryConfirmationEmail` to the contact. Returns inquiry id + Spanish success message.
- `createCorporatePool(data, ctx)` — Validates timezone (`isValidTimezone`), verifies the `TournamentInstance` exists and is not ARCHIVED. Resolves `pickTypesConfig`: if a string preset key, tries `generateDynamicPresetConfig` against the instance's extracted phases, falling back to `getPresetByKey`; if an object, validates via `validatePoolPickTypesConfig`. Loads creator email/displayName. Inside a `$transaction`, creates `Organization` (ACTIVE, with HTML-escaped welcome/invitation messages, branding colors, `invitationLocale` default "es"), the `Pool` (PRIVATE, DRAFT, `scoringPresetKey: "CLASSIC"`, fixtureSnapshot from instance.dataJson, linked to org), a `PoolMember` with role `CORPORATE_HOST`, and one `CorporateInvite` per unique lowercased email with a fresh hex token + 30-day expiry. **Security gate:** `maxParticipants` is hard-capped at `CORPORATE_FREE_LIMIT` regardless of requested value — paid tiers are only raised later by `paymentService.handleOrderPaid`. After the transaction, fires admin notification (`corporate_pool_created`) and audit event `CORPORATE_POOL_CREATED`.
- `addEmployees(data)` — Host-guarded. Dedupes lowercased emails, finds already-existing invites for the pool, and creates `CorporateInvite` (status PENDING, fresh token + 30-day expiry) only for new emails. Returns `{ added, skipped, total }`.
- `listEmployees(input)` — Host-guarded. Paginated list (default limit 25, max 100). `buildStatusConditions` translates the multi-select status filter into a Prisma WHERE that combines native enum values with the derived EXPIRED branch (status=SENT, token expired, not activated). Runs four queries in parallel: `groupBy` status counts (whole pool), an expired count, the filtered total, and the page rows. Summary counts always reflect the whole pool; `sent` excludes the expired tail. Each returned row's status is recomputed to `EXPIRED` where applicable. Returns invites + summary + pagination metadata.
- `buildStatusConditions(filter, now)` — Helper producing the Prisma WHERE clause from the filter array, handling the SENT+EXPIRED interplay (both selected → all SENT; only SENT → not-yet-expired; only EXPIRED → expired branch).
- `sendInvitations(data, ctx)` — Host-guarded. Loads pool + org branding (reads `invitationLocale` at send time, last-writer-wins). For each PENDING invite, does an **atomic claim** via `updateMany WHERE status=PENDING` → SENT (so concurrent calls each send exactly once), then calls `sendCorporateActivationEmail`. On email failure reverts the row to FAILED. Fires `CORPORATE_INVITATIONS_SENT` audit. Returns `{ sent, failed }`.
- `deleteEmployee(data)` — Host-guarded. Validates the invite belongs to the pool; refuses (409 ALREADY_ACTIVATED) if already activated; otherwise hard-deletes the `CorporateInvite`.
- `resendInvitation(data)` — Host-guarded single-invite resend. Refuses if ACTIVATED. Rotates to a fresh token + 30-day expiry via an optimistic `updateMany` (status in PENDING/SENT/FAILED), invalidating the old token; sends the branded activation email (locale read at send time), and sets final status SENT/FAILED. Fires `CORPORATE_INVITATION_RESENT` audit.
- `bulkResendExpired(data)` — Host-guarded batch resend to all expired invites (status=SENT, token expired, not activated), oldest first, capped at `MAX_BULK_RESEND` (100) with a `+1` over-fetch to compute `hasMore`. Per invite: same defensive token rotation + send + status update as `resendInvitation`. Fires `CORPORATE_BULK_RESEND_EXPIRED` audit. Returns `{ attempted, sent, failed, hasMore }`.

**Exports:** Functions `requireCorporateHost`, `submitInquiry`, `createCorporatePool`, `addEmployees`, `listEmployees`, `sendInvitations`, `deleteEmployee`, `resendInvitation`, `bulkResendExpired`; types `SubmitInquiryInput/Result`, `CreateCorporatePoolInput/Result`, `AddEmployeesInput/Result`, `DerivedInviteStatus`, `ListEmployeesInput/Result`, `SendInvitationsInput/Result`, `DeleteEmployeeInput`, `ResendInvitationInput/Result`, `BulkResendExpiredInput/Result`.

**Key dependencies:** `prisma`, `crypto`, `Prisma` (types), `writeAuditEvent` (lib/audit), email helpers `sendAdminNotification`/`sendCorporateInquiryConfirmationEmail`/`sendCorporateActivationEmail`/`escapeHtml`, `getPresetByKey`/`generateDynamicPresetConfig` (lib/pickPresets), `validatePoolPickTypesConfig` (validation/pickConfig), `extractPhases` (lib/fixture), `transitionToActive` (poolStateMachine), `TOKEN_EXPIRY_MS`/`CRYPTO_BYTES` (lib/constants), `fireAndForget` (lib/asyncHelpers), `isValidTimezone` (lib/timezone), `ServiceError`/`AuditContext` (authService), `CORPORATE_FREE_LIMIT` (lib/pricing).

**Flags:** `transitionToActive` is imported but never called in this file — the corporate-pool-stays-DRAFT issue noted in project memory remains; this is an unused import / dead import (medium confidence). Otherwise clean.

### backend/src/services/deadlineReminderService.test.ts

**Purpose:** Vitest suite for the deadline-reminder service, asserting platform-gating, pool/member filtering, dedupe via reminder logs, dry-run behaviour, email send outcomes, and stats aggregation.

**What it does:** Mocks `../db` (prisma `platformSettings`, `pool`, `deadlineReminderLog`, `user`) and `../lib/email` (`isEmailEnabled`, `sendDeadlineReminderEmail`). A `createMockPool` helper builds an ACTIVE pool with one opted-in member and one match 12h out, overridable. Suites:
- **Platform Settings Check:** stops (success=false, error pushed) when `isEmailEnabled` returns disabled and never queries pools; proceeds when enabled.
- **Pool Processing:** zero counts on no pools; verifies the query filters `status: "ACTIVE", muteReminders: false`; skips users already in `deadlineReminderLog`; skips users with `emailNotificationsEnabled:false` or `emailDeadlineReminders:false`; skips users who already predicted the match.
- **Dry Run Mode:** with `(24, true)` no email is sent and no log is created.
- **Email Sending:** on success increments `emailsSent`/`usersNotified` and creates a log with the expected payload (to/userId/displayName/poolName/matchesCount/poolId); on failure increments `emailsFailed` and writes a log with `success:false` + error; on `skipped:true` increments `emailsSkipped`.
- **Hours Before Deadline Parameter:** default vs custom (48) both invoke `pool.findMany`.
- **getDeadlineReminderStats:** asserts result shape (`totalSent/totalFailed/byPool/recentLogs`), poolId filtering, and that the days parameter is honored.
- **Integration Scenarios:** multi-user pool where a user with an existing pick is excluded (only 1 email); correct `matchesCount: 2` when two matches lack predictions.

**Exports:** none (test module).

**Key dependencies:** vitest, mocked `../db` and `../lib/email`; imports `processDeadlineReminders` and `getDeadlineReminderStats` from `./deadlineReminderService`.

**Flags:** Test mocks reference legacy `kickoffTime` field (the service prefers `kickoffUtc` per `getKickoff`); the mock match data uses `kickoffTime` only, which still works via the fallback but does not exercise the primary `kickoffUtc` path. Minor coverage gap, not dead code. Otherwise clean.

### backend/src/services/deadlineReminderService.ts

**Purpose:** Sends deadline reminder emails to pool members who have upcoming matches without predictions, run manually by admin or by cron.

**What it does:**
- Types: `DeadlineReminderResult` (aggregate counts + `details: ReminderDetail[]`), `ReminderDetail` (per-user outcome), `MatchWithDeadline` (supports both new `kickoffUtc`/`homeTeamId` and legacy `kickoffTime`/`homeTeam` fields), `TournamentData`.
- Config: `DEFAULT_HOURS_BEFORE_DEADLINE` from env `DEADLINE_REMINDER_HOURS_BEFORE` (default 48).
- Helpers: `getTeamName` (resolve id→shortName/name), `getKickoff` (prefers `kickoffUtc`, falls back to `kickoffTime`), `getMatchLabel` (label → team names → id), `getMatchDeadline` (kickoff minus `deadlineMinutesBeforeKickoff` minutes), `formatDeadlineTime` (locale-aware via BCP-47 mapping pt→pt-BR / es→es-MX / else en-US, with timezone, falling back without timezone on error).
- `processDeadlineReminders(hoursBeforeDeadline?, dryRun?)` — Gates on `isEmailEnabled("deadlineReminder")`. Computes the reminder window `[now, now + hours]`. Fetches all ACTIVE, non-muted pools with their ACTIVE members (+ user notification prefs incl. `country`), predictions, and tournamentInstance.dataJson. Per pool: reads fixture from `fixtureSnapshot` first (fallback to instance dataJson), filters matches whose deadline falls inside the window. Per active member: skips if notifications/deadline-reminders disabled; computes matches without a prediction; queries `deadlineReminderLog` to skip already-reminded matches; computes the nearest deadline; resolves the user's locale (`resolveUserLocale`); in dry-run records skipped; otherwise calls `sendDeadlineReminderEmail` and on success writes one `deadlineReminderLog` row per reminded match (success=true), on failure writes failure logs, catching thrown errors into `result.errors`. Logs a summary and returns the aggregate result.
- `getDeadlineReminderStats(poolId?, days=7)` — Counts successful and failed logs since `now - days`, fetches the 50 most recent logs, groups counts by pool, resolves pool names, returns `{ totalSent, totalFailed, byPool, recentLogs }`.

**Exports:** `processDeadlineReminders`, `getDeadlineReminderStats`, and the `DeadlineReminderResult` interface.

**Key dependencies:** `prisma`, `sendDeadlineReminderEmail`/`isEmailEnabled` (lib/email), `resolveUserLocale` (lib/constants).

**Flags:** none. (The `kickoffTime` vs `kickoffUtc` field mismatch noted in project memory is handled here by `getKickoff` preferring `kickoffUtc`.)

### backend/src/services/groupStandingsService.test.ts

**Purpose:** Vitest suite covering group-standings picks (player), result publication (host), reads, and live group match results.

**What it does:** Mocks `../db` (poolMember, pool, groupStandingsPrediction, groupStandingsResult, poolMatchResult), `../lib/audit`, `./poolStateMachine` (`canMakePicks`), `./instanceAdvancement` (`advanceToRoundOf32`, `validateCanAutoAdvance`), `../lib/roles` (`requirePoolAdmin`), `../lib/fixture` (`parseFixtureData`), and `../lib/asyncHelpers` (`fireAndForget` no-op). Suites:
- **upsertGroupStandingsPick:** creates a prediction for an active member when the pool/instance allow picks; FORBIDDEN for non-members; NOT_FOUND for missing pool; CONFLICT when pool status disallows picks; CONFLICT when instance is ARCHIVED.
- **getGroupStandingsPick:** returns prediction for member, null when none, FORBIDDEN for non-members.
- **getGroupStandingsPicksByPhase:** returns all phase predictions; FORBIDDEN for non-members.
- **publishGroupStandingsResult:** creates a new result; FORBIDDEN for non-admins; NOT_FOUND for missing pool; requires a reason on errata (existing result) else VALIDATION_ERROR; allows errata with a reason (version increments to 2).
- **getGroupStandingsResult / getGroupStandingsResultsByPhase:** member reads; FORBIDDEN for non-members.
- **getGroupMatchResults:** returns only group-A matches with completed/total counts (filters out other groups); FORBIDDEN for non-members; NOT_FOUND for missing pool.

**Exports:** none (test module).

**Key dependencies:** vitest; the mocked modules above; imports the seven public functions from `./groupStandingsService`.

**Flags:** none.

### backend/src/services/groupStandingsService.ts

**Purpose:** Pure business logic for group-standings predictions and official results, including FIFA-criteria table computation and triggering automatic Round-of-32 advancement.

**What it does:**
- `requireActivePoolMember(userId, poolId)` — guard returning whether an ACTIVE PoolMember exists.
- `upsertGroupStandingsPick(...)` — Member-guarded. Loads pool+instance; rejects if `canMakePicks(status)` is false (CONFLICT), instance ARCHIVED (CONFLICT), phase in `lockedPhases` (PHASE_LOCKED), group missing (NOT_FOUND), or the group's earliest kickoff minus `deadlineMinutesBeforeKickoff` has passed (DEADLINE_PASSED). Upserts the `GroupStandingsPrediction` on `(poolId,userId,phaseId,groupId)`. Fires `GROUP_STANDINGS_PREDICTION_UPSERTED` audit.
- `getGroupStandingsPick` / `getGroupStandingsPicksByPhase` — Member-guarded reads of one or all predictions.
- `publishGroupStandingsResult(...)` — Admin-guarded (`requirePoolAdmin`). Detects errata (existing result) and requires a `reason` (else VALIDATION_ERROR). Upserts `GroupStandingsResult` with version increment on errata. Fires `GROUP_STANDINGS_RESULT_PUBLISHED`/`..._ERRATA` audit. Then **auto-advance check**: re-reads pool+instance, parses fixture, collects all groupIds in the phase, and if every group has a published result, validates via `validateCanAutoAdvance` and calls `advanceToRoundOf32`, firing `TOURNAMENT_AUTO_ADVANCED_TO_R32`. Auto-advance errors are swallowed (best-effort). Returns result, isErrata flag, previous teamIds, and autoAdvance summary.
- `getGroupStandingsResult` / `getGroupStandingsResultsByPhase` — Member-guarded reads.
- `generateGroupStandings(...)` — Admin-guarded. Parses fixture, requires every group match to have a `PoolMatchResult.currentVersion` (else INCOMPLETE). Computes standings (played/won/drawn/lost/GF/GA/GD/points) and sorts by FIFA criteria (points, goal difference, goals for). Upserts the ordered `GroupStandingsResult` (version increment if existing, reason "Regenerado desde resultados de partidos"). Fires `GROUP_STANDINGS_GENERATED` audit, then the same auto-advance-to-R32 check as above. Returns result, standings array, and autoAdvance.
- `getGroupStandingsStats(...)` — Member-guarded, read-only, tolerates partial data. Parses fixture, computes standings live from `PoolMatchResult.currentVersion` (preferring `homeGoals90`/`awayGoals90` over `homeGoals`/`awayGoals`) via a lazy-imported `calculateGroupStandings` from `./tournamentAdvancement`; synthesizes zeroed rows in fixture order when no matches are finalised. Also returns the officially-published team order + publish metadata so the UI can distinguish computed vs published.
- `getGroupMatchResults(...)` — Member-guarded. Returns the group's matches, a results map keyed by matchId (`homeGoals`/`awayGoals` from currentVersion), and completed/total counts.

**Exports:** `upsertGroupStandingsPick`, `getGroupStandingsPick`, `getGroupStandingsPicksByPhase`, `publishGroupStandingsResult`, `getGroupStandingsResult`, `getGroupStandingsResultsByPhase`, `generateGroupStandings`, `getGroupStandingsStats`, `getGroupMatchResults`.

**Key dependencies:** `prisma`, `writeAuditEvent`, `canMakePicks` (poolStateMachine), `advanceToRoundOf32`/`validateCanAutoAdvance` (instanceAdvancement), `requirePoolAdmin` (lib/roles), `extractMatches`/`parseFixtureData` (lib/fixture), `fireAndForget`, `ServiceError`/`AuditContext` (authService), and a lazy import of `calculateGroupStandings` from `./tournamentAdvancement`.

**Flags:** Auto-advance logic is duplicated between `publishGroupStandingsResult` and `generateGroupStandings` (acknowledged in code comments as deliberate replication for the Estratega publish path). Not dead code, but a maintenance-duplication note (low confidence).

### backend/src/services/instanceAdvancement.ts

**Purpose:** Integration layer bridging the pure `tournamentAdvancement.ts` algorithms with the database — completing group stages, computing standings, resolving knockout placeholders, advancing phases, and gating automatic advancement. Persists changes to the pool's `fixtureSnapshot` (not the shared instance) so pools advance independently.

**What it does:**
- Types: `AutoAdvanceValidationResult`, `TemplateData` (meta/teams/phases/matches/advancement), `MatchResult`.
- `validateGroupStageComplete(instanceId, poolId?)` — Reads fixture from pool snapshot or instance dataJson; collects `group_stage` matches. Detects "structural-grupos" (Estratega) mode via the pool's `pickTypesConfig` (`requiresScore===false` && `structuralPicks.type==="GROUP_STANDINGS"`): completeness = every group has a `GroupStandingsResult`. Score-based path: every group match needs a `PoolMatchResult.currentVersion`. Returns `{ isComplete, missingMatches }`.
- `calculateAllGroupStandings(instanceId, poolId?)` — Returns `Map<groupId, TeamStanding[]>`. In structural mode reads `GroupStandingsResult.teamIds` and synthesizes position-only standings (stats zeroed; documented limitation for best-thirds). Score-based path computes per-group standings from `PoolMatchResult` via `calculateGroupStandings`, throwing if any group match lacks a result.
- `persistResolvedKnockoutFixtures(instanceId, data, updatedMatches, resolvedMatches)` — Idempotently upserts a `MatchExternalMapping` per resolved match with a synthetic fixtureId (`generateSyntheticFixtureId`, range 900000+) and the teams' apiFootballIds, then mirrors the updated matches into `instance.dataJson` so `fixtureTrackingJob` sees real team names instead of placeholders.
- `advanceToRoundOf32(instanceId, poolId?)` — Validates group stage complete, computes all standings, determines qualifiers (`determineQualifiers` → winners/runnersUp/bestThirds), resolves R32 placeholders (`resolvePlaceholders`), writes updated matches to `pool.fixtureSnapshot`, and registers fixtures via `persistResolvedKnockoutFixtures`. Returns standings + qualifiers + resolvedMatches.
- `advanceKnockoutPhase(instanceId, currentPhaseId, nextPhaseId, poolId?)` — Requires poolId. Determines winners from either `StructuralPhaseResult.resultJson.matches[]` (KNOCKOUT_WINNER structural mode) or `PoolMatchResult` goals + penalties (score-based, with full validation that ties have decisive penalties). Builds `knockoutResults` (matchId→winner/loser), resolves next-phase placeholders (`resolveKnockoutPlaceholders`), persists to fixtureSnapshot, and registers fixtures.
- `advanceTwoLeggedPhase(instanceId, currentRound, nextRound, poolId)` — For two-legged formats (UCL, Libertadores). Derives `{round}_leg1`/`_leg2` phase ids, requires equal match counts and all results present, groups by `tieNumber`, computes aggregate winners via `determineTwoLeggedTieWinner`, then resolves the next round (single-match final vs two-legged ties, sequential winner→bracket mapping with `t_TBD` handling). Persists ONLY to `pool.fixtureSnapshot`. Returns winners + resolvedMatches.
- `validateCanAutoAdvance(instanceId, phaseId, poolId)` — Gates auto-advance: blocks if pool not found, `autoAdvanceEnabled` false (DISABLED), instance/phase missing or empty (INCOMPLETE), phase incomplete per the phase's scoring mode (GROUP_STANDINGS → all groups published; KNOCKOUT_WINNER → all winners published; score-based → all PoolMatchResults), or recent erratas (currentVersion.versionNumber > 1 within 24h, ERRATA). Returns `{ canAdvance, reason?, blockType?, details? }`.

**Exports:** `validateGroupStageComplete`, `calculateAllGroupStandings`, `advanceToRoundOf32`, `advanceKnockoutPhase`, `advanceTwoLeggedPhase`, `validateCanAutoAdvance`. (`persistResolvedKnockoutFixtures` is module-private.)

**Key dependencies:** `Prisma`, `prisma`, `generateSyntheticFixtureId` (lib/syntheticFixtureId), and from `./tournamentAdvancement`: `calculateGroupStandings`, `determineQualifiers`, `resolvePlaceholders`, `resolveKnockoutPlaceholders`, `determineTwoLeggedTieWinner`, plus types `TeamStanding`/`TwoLeggedTieResult`.

**Flags:** `MatchResult` type is declared but never referenced within the file (medium confidence dead type). The two-legged next-round winner-to-bracket mapping carries inline comments admitting heuristic/sequential pairing ("Por ahora, usamos orden secuencial") — a known simplification, not dead code. Otherwise clean.

### backend/src/services/mercadopago/client.ts

**Purpose:** Thin wrapper around the official `mercadopago` SDK for Colombia (COP) payments via Checkout Bricks, plus a Checkout Pro preference fallback and reconciliation search.

**What it does:**
- Config: lazy env readers `MP_ACCESS_TOKEN()`/`MP_PUBLIC_KEY()`; memoized `getClient()` builds a `MercadoPagoConfig` (throws if token missing). `isMercadoPagoConfigured()` returns whether both token and public key are set. `getMpPublicKey()` returns the public key for frontend Brick init.
- `createPreference(params)` — Builds a Checkout Pro `Preference` with a single `pool-capacity-upgrade` item in COP, external_reference, notification_url, back_urls, and `auto_return: "approved"`. Returns `{ preferenceId, initPoint, sandboxInitPoint }`.
- `processPayment(params)` — Creates a payment from camelCase params (legacy mapping), translating to the SDK's snake_case body (token, payment_method_id, issuer_id, transaction_amount, installments default 1, payer email/identification, external_reference, description). Returns `{ id, status, statusDetail, externalReference }`.
- `processPaymentDirect(formData)` — Passes the Brick's native snake_case formData straight to `payment.create` with no mapping. Returns the same shape.
- `getPayment(paymentId)` — Fetches a payment by id (webhook verification).
- `searchPaymentByExternalReference(externalReference)` — Searches MP for the most recent payment (sort date_created desc, limit 1) matching an external reference; used by the MP reconciler as a fallback for legacy `PoolPayment` rows with NULL `mpPaymentId`. Returns `{ id, status, date_approved }` or null.

**Exports:** `isMercadoPagoConfigured`, `getMpPublicKey`, `createPreference`, `processPayment`, `processPaymentDirect`, `getPayment`, `searchPaymentByExternalReference`; interfaces `CreatePreferenceParams`, `ProcessPaymentParams`.

**Key dependencies:** `mercadopago` SDK (`MercadoPagoConfig`, `Payment`, `Preference`); env vars `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`.

**Flags:** `processPayment` (camelCase mapping) is self-described as "legacy" and overlaps with `processPaymentDirect` (native formData) — potential duplicate path; verify whether the camelCase variant still has a caller (low/medium confidence). Mercado Pago is the active COP gateway that replaced the discarded Wompi. Otherwise clean.

### backend/src/services/newMemberDigestService.ts

**Purpose:** Two daily digest flows for pool hosts, sharing one cron tick: a 24h "new active member" summary and an accumulated "pending approval" summary with a 7-day streak throttle.

**What it does:**
- Constants: `ELIGIBLE_POOL_STATUSES = ["DRAFT","ACTIVE"]` (COMPLETED/ARCHIVED never receive digests), `PENDING_STREAK_MAX_DAYS = 7`. Interface `DigestResult` (poolsProcessed/emailsSent/emailsSkipped/emailsFailed).
- `processNewMemberDigest()` — Finds PLAYER PoolMembers that went ACTIVE in the last 24h, groups joiner display names by pool. For each pool (skipping non-eligible statuses) finds active HOST/CORPORATE_HOST members; per host honoring `emailNotificationsEnabled` + `emailNewMemberDigest`, counts current active members and sends `sendNewMemberDigestEmail` (with `resolveUserLocale`). Tallies sent/skipped/failed.
- `hashPendingSet(memberIds)` — SHA-1 fingerprint of the sorted pending-member-id set (order-insensitive).
- `streakDaysBetween(start, now)` — whole-day difference.
- `processPendingApprovalDigest()` — Loads all PENDING_APPROVAL PLAYER members, groups by pool. Per eligible pool, computes the current set hash and compares to stored `pendingDigestPendingHash`. **Throttle gate:** if the set changed → send and reset `streakStartAt` to now; if identical → send only while within 7 days of the streak start, else stay silent (without touching throttle fields, so the silence window stays anchored). When sending, emails active HOST/CORPORATE_HOST members (reusing the `emailNewMemberDigest` opt-out) via `sendPendingApprovalDigestEmail`. If at least one delivery was attempted, persists `pendingDigestPendingHash` + `pendingDigestStreakStartAt`. Tallies counts.

**Exports:** `processNewMemberDigest`, `processPendingApprovalDigest`; interface `DigestResult`.

**Key dependencies:** `crypto`, `prisma`, `sendNewMemberDigestEmail`/`sendPendingApprovalDigestEmail` (lib/email), `resolveUserLocale` (lib/constants). Relies on Pool throttle columns `pendingDigestPendingHash` and `pendingDigestStreakStartAt`, and user prefs `emailNotificationsEnabled`/`emailNewMemberDigest`.

**Flags:** none.
