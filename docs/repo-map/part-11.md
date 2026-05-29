## Batch 11

This batch covers pool-administration / membership / overview service modules, the pool state machine (plus its unit tests), the result publishing service, the API-Football result-sync subsystem, and two sales (cuenta de cobro / document numbering) services. All `*Service.ts` modules follow the project's "pure business logic" convention: no Express imports, plain data in/out, `ServiceError` for typed failures, and fire-and-forget side effects (audit/email/analytics).

### backend/src/services/poolAdminService.ts

**Purpose:** Pure business logic for host/co-admin pool administration: scoring overrides, manual phase advancement, settings/rules edits, phase locking, archiving, per-match/per-phase/per-group scoring breakdowns, a full player summary, and a notifications digest.

**What it does:**
- **`setScoringOverride(userId, poolId, matchId, scoringEnabled, reason, ctx)`** — requires pool admin. When `scoringEnabled` is true, deletes any `PoolMatchOverride` for the match; otherwise upserts an override row (`scoringEnabled: false` + reason + actor). Writes a `MATCH_SCORING_ENABLED`/`MATCH_SCORING_DISABLED` audit event.
- **`advancePhase(userId, poolId, currentPhaseId, nextPhaseId, ctx)`** — owner-only. For `group_stage`, validates completeness via `validateGroupStageComplete` then calls `advanceToRoundOf32`; for knockout phases derives the next phase from the instance's ordered phases (`extractPhases`), falling back to a hardcoded `round_of_32→round_of_16→…→finals` map, then calls `advanceKnockoutPhase`. Writes `TOURNAMENT_MANUAL_ADVANCED_TO_R32` / `TOURNAMENT_MANUAL_ADVANCED_KNOCKOUT` audit events. Returns a Spanish success message + result data.
- **`updatePoolSettings(userId, poolId, changes, ctx)`** — owner-only. Updates `autoAdvanceEnabled` / `requireApproval`. For `extraTimePhases`, recomputes each phase's `includeExtraTime` flag in `pickTypesConfig` but only toggles a phase if: no legacy-format results exist (homeGoals90 null while homeGoals set), not all phase matches already have results, and the phase's earliest deadline is ≥48h away — a guard preventing extra-time rule changes that would retroactively rescore played/imminent matches. Writes `POOL_SETTINGS_UPDATED`.
- **`updatePoolScoringConfig(userId, poolId, pickTypesConfig, ctx)`** — pool-admin only; guarded by `canEditScoringConfig` (DRAFT only, else 409). Accepts either a preset key string (expanded via `generateDynamicPresetConfig` against the instance's real phases, falling back to `getPresetByKey`) or a full `PoolPickTypesConfig` array (validated via `validatePoolPickTypesConfig`). Persists and writes `POOL_RULES_CHANGED` with both old and new config for dispute reconstruction.
- **`setPhaselock(userId, poolId, phaseId, locked, _ctx)`** — owner-only. Adds/removes `phaseId` from the pool's `lockedPhases` JSON array. Writes `PHASE_LOCKED`/`PHASE_UNLOCKED`. (Note: `_ctx` is accepted but unused.)
- **`archivePool(userId, poolId)`** — owner-only. Delegates to `transitionToArchived`, mapping its thrown errors ("Pool not found" → 404, "Pool must be COMPLETED to archive" → 409).
- **`getMatchPickBreakdown(userId, poolId, matchId)`** — member-only. Loads the fixture snapshot, finds the match + its phase config (must be a score phase), the user's `Prediction`, and the `PoolMatchResult.currentVersion`, then builds a breakdown via `generateMatchPickBreakdown`. Returns breakdown + enriched match teams.
- **`getPhaseBreakdown(userId, poolId, phaseId)`** — member-only. For a structural phase, branches on `structuralPicks.type`: `GROUP_STANDINGS` (assembles `groupsInfo` from fixture `groups`, else from team `groupId`, else from match `groupId`, then `generateGroupStandingsBreakdown`) or `KNOCKOUT_WINNER` (derives each match winner from results incl. penalties, then `generateKnockoutWinnerBreakdown`).
- **`getGroupBreakdown(userId, poolId, groupId)`** — member-only. Finds the GROUP_STANDINGS phase config, loads the user's `GroupStandingsPrediction` and latest `GroupStandingsResult`, and computes per-position points (`pointsPerExactPosition`) plus a perfect-group bonus, returning a `GROUP_SINGLE` breakdown with hasPick/hasResult flags and short-circuit empty states.
- **`getPlayerSummary(requestingUserId, poolId, targetUserId)`** — the largest function. Validates both memberships. Builds match-pick `phases[]` for the target user (scoring each match via advanced `scoreMatchPick` or legacy `getScoringPreset`+`outcomeFromScore`, honoring `includeExtraTime` and scoring overrides; hides not-yet-locked matches for opponents). Skips structural phases from `phases[]`. Computes `presetMode` (STRUCTURAL/SCORE/MIXED) and the structural universe (group/knockout). Loads every member's structural picks + pool structural results once, ranks ALL members by matchPoints + structuralPoints (via `computeStructuralBreakdown`), and builds the target's detailed structural breakdown with deadline-based prediction visibility (opponents' picks hidden before the group's earliest kickoff deadline / the match's own kickoff deadline). Returns player rank/points/structuralStats, `isViewingSelf`, `presetMode`, `phases`, and `structuralBreakdown`.
- **`getPoolNotifications(userId, poolId)`** — member-only. Computes the requesting user's urgent pending picks (matches with deadline <24h away, not yet picked, excluding placeholder-team matches like `W_`/`RU_`/`L_`/`3rd_`). For hosts/co-admins additionally counts `pendingJoins` (PENDING_APPROVAL members), `pendingResults` (kicked-off matches without results), and `phasesReadyToAdvance` (fully-resulted phases whose unlocked next phase still has placeholder teams). Returns the digest with `updatedAt`.

**Exports:** `setScoringOverride`, `advancePhase`, `updatePoolSettings`, `updatePoolScoringConfig`, `setPhaselock`, `archivePool`, `getMatchPickBreakdown`, `getPhaseBreakdown`, `getGroupBreakdown`, `getPlayerSummary`, `getPoolNotifications` (all named async functions).

**Key dependencies:** `prisma`, `writeAuditEvent`, `getScoringPreset`, role helpers (`requirePoolAdmin`/`isPoolOwner`/`isPoolAdmin`), `instanceAdvancement` (`advanceToRoundOf32`/`advanceKnockoutPhase`/`validateGroupStageComplete`), `poolStateMachine` (`transitionToArchived`/`canEditScoringConfig`), pick-preset helpers, `scoringAdvanced.scoreMatchPick`, `scoringBreakdown.*`, `structuralScoring` (`computeStructuralBreakdown`/`summarizeStructural`), `poolHelpers.outcomeFromScore`, `fixture` helpers, `fireAndForget`, and `ServiceError`/`AuditContext` from `authService`.

**Flags:** `setPhaselock` declares `_ctx` but never uses it (no audit IP/UA captured for lock events). The legacy-vs-advanced scoring blocks are duplicated across `getPlayerSummary`, `poolOverviewService`, and `resultService` — substantial duplicated scoring logic that risks drift. The `phaseOrderFallback`/`nextPhaseMap` hardcoded phase chains are repeated here and in `resultService`/`getPoolNotifications`. Otherwise functional.

### backend/src/services/poolMemberService.ts

**Purpose:** Pure business logic for pool membership lifecycle: listing, approving/rejecting join requests, kicking, voluntary leaving, banning, and promote/demote between PLAYER and CO_ADMIN.

**What it does:**
- **Types block:** defines `MemberEntry`/`ListMembersResult`, `PendingMemberEntry`/`ListPendingMembersResult`, and input/result types for approve/reject/kick/leave/ban/promote/demote. `KickMemberInput` and `BanMemberInput` carry a `confirmRevert?` flag (set by the client after acknowledging the REVERT_PENDING_CONFIRMATION warning).
- **`listMembers(userId, poolId)`** — any ACTIVE member; returns all members (any status) with display name/role/status/joinedAt.
- **`listPendingMembers(actorUserId, poolId)`** — admin-only; returns PENDING_APPROVAL members with username/email/requestedAt.
- **`approveMember(data, ctx)`** — admin-only; flips a PENDING_APPROVAL member to ACTIVE (records approver + timestamp), audits `JOIN_REQUEST_APPROVED`, then calls `transitionToActive` (DRAFT→ACTIVE if first active player).
- **`rejectMember(data, ctx)`** — admin-only; deletes the pending row (user may re-request), audits `JOIN_REQUEST_REJECTED`.
- **`kickMember(data, ctx)`** — admin-only. Validates target is ACTIVE, not self, not the pool creator. Calls `wouldCauseRevert`; if true and `!confirmRevert`, throws REVERT_PENDING_CONFIRMATION (409). Sets member LEFT, audits `MEMBER_KICKED`, sends a "kicked" removal email (locale-resolved), and — if the kick empties the pool of non-host members — calls `revertPoolToDraft` AFTER persisting the kick.
- **`leaveMember(data, ctx)`** — voluntary; rejects non-leavable roles (`NON_LEAVABLE_ROLES`, i.e. hosts). Does NOT require confirmation. Sets LEFT, audits `MEMBER_LEFT`, fires a GA4 `pool_left` churn event, and triggers `revertPoolToDraft` if it was the last non-host member.
- **`banMember(data, ctx)`** — admin-only; same self/creator/active and revert-confirmation guards as kick. In a `$transaction`, optionally `deleteMany` predictions then sets the member BANNED (permanent: `banExpiresAt: null`). Audits `MEMBER_BANNED`, sends a "banned" removal email, and reverts the pool if needed. Returns a message + optional `picksDeleted` count.
- **`promoteMember(data, ctx)`** — owner-only; promotes an ACTIVE PLAYER to CO_ADMIN (errors: MEMBER_NOT_ACTIVE, INVALID_ROLE), audits `MEMBER_PROMOTED_TO_CO_ADMIN`.
- **`demoteMember(data, ctx)`** — owner-only; demotes an ACTIVE CO_ADMIN to PLAYER, audits `MEMBER_DEMOTED_FROM_CO_ADMIN`.

**Exports:** all the listed types + `listMembers`, `listPendingMembers`, `approveMember`, `rejectMember`, `kickMember`, `leaveMember`, `banMember`, `promoteMember`, `demoteMember`.

**Key dependencies:** `prisma`, `writeAuditEvent`, role helpers (`requirePoolAdmin`/`isPoolOwner`/`NON_LEAVABLE_ROLES`), `poolStateMachine` (`transitionToActive`/`revertPoolToDraft`/`wouldCauseRevert`), `fireAndForget`, `sendMemberRemovedEmail`, `resolveUserLocale`, `sendGa4Event`, `ServiceError`/`AuditContext`.

**Flags:** none.

### backend/src/services/poolOverviewService.ts

**Purpose:** Builds the single large payload backing the pool overview page — pool/instance metadata, organization branding, per-match cards (with live-sync data), and the full leaderboard (match + structural scoring).

**What it does:** `getPoolOverview(userId, poolId, leaderboardVerbose)`:
- **Permission:** requires ACTIVE or LEFT membership (LEFT = read-only); if only PENDING_APPROVAL, throws `PENDING_APPROVAL` (403) with the pool name for a friendly waiting screen.
- **Loads** pool + tournament instance (+ template key) + organization branding (logo, welcome/invitation messages, colors, invitation locale), the scoring preset, and active member count.
- **Snapshot:** uses `fixtureSnapshot ?? tournamentInstance.dataJson`; extracts matches/teams. In parallel fetches the user's predictions, results (currentVersion), match overrides, and `matchSyncState` rows (live status/elapsed/extra/lastApiStatus).
- **Match cards:** per match emits deadline (`kickoffUtc - deadlineMinutesBeforeKickoff`), `isLocked`, teams, my pick, result, scoring override state, sync status, result source, and live fields (`elapsed`/`extra`/`matchStatus`/`isLive` from IN_PROGRESS/AWAITING_FINISH).
- **Leaderboard:** loads all members (ACTIVE+LEFT) and all predictions; indexes by user→match. Loads structural picks/results, merging `GroupStandingsPrediction`/`Result` into the structural shape and converting knockout match results into `KNOCKOUT_WINNER` structural results. Defines an inner `scorePick` (legacy outcome/score scoring). Computes `presetMode` and the group/knockout structural universe. For each member, scores matches (advanced `scoreMatchPick` when the phase `requiresScore`+`matchPicks`, else legacy `scorePick`, honoring `includeExtraTime`/overrides), then adds structural points per phase via `computeStructuralBreakdown`+`summarizeStructural`; collects `scoringErrors`. Sorts by total points then joinedAt.
- **Response:** `nowUtc`, full `pool` (incl. organization sub-object), `myMembership`, `counts`, `tournamentInstance` (with snapshot dataJson), `permissions` (canManageResults/canInvite = isPoolAdmin), `matches`, and `leaderboard` (scoring config, preset, phases, presetMode, ranked rows; emails only included for admins, verbose breakdown optional).

**Exports:** `getPoolOverview`.

**Key dependencies:** `prisma`, `getScoringPreset`, `isPoolAdmin`, fixture helpers, `scoreMatchPick`, `structuralScoring`, `outcomeFromScore`, `PhasePickConfig`, `ServiceError`.

**Flags:** Legacy/advanced scoring logic is duplicated with `poolAdminService.getPlayerSummary` and `resultService` (drift risk). Otherwise functional.

### backend/src/services/poolStateMachine.test.ts

**Purpose:** Vitest unit suite for the pool state machine, mocking `prisma`, audit, email, async helpers, constants, and fixture helpers.

**What it does:** Asserts the pure guard functions (`canJoinPool`, `canMakePicks`, `canPublishResults` incl. COMPLETED for erratas, `canEditPoolSettings`, `canEditScoringConfig` DRAFT-only, `canCreateInvites`). Tests `transitionToActive` (DRAFT→ACTIVE only when an ACTIVE non-host exists; no-op when zero active non-hosts — the regression for a host clicking their own invite; no-op when already ACTIVE; throws if not found). Tests `transitionToCompleted` (ACTIVE→COMPLETED only when all matches have results; no-op otherwise / not ACTIVE; throws if not found). Tests `transitionToArchived` (COMPLETED→ARCHIVED; throws if already ARCHIVED or not found). Tests `wouldCauseRevert` (false when not ACTIVE or other PLAYER/CO_ADMIN remain; true when removing the last; verifies the count query excludes the target member). Tests `revertPoolToDraft` (no-op when not ACTIVE; deletes Prediction/StructuralPrediction/GroupStandingsPrediction and flips ACTIVE→DRAFT inside a transaction with audit deleted* counts; throws when not found).

**Exports:** none (test file).

**Key dependencies:** `vitest`, mocked `../db`, `../lib/audit`, `../lib/email`, `../lib/asyncHelpers`, `../lib/constants`, `../lib/fixture`; imports the SUT from `./poolStateMachine`.

**Flags:** none.

### backend/src/services/poolStateMachine.ts

**Purpose:** Authoritative pool lifecycle state machine (DRAFT → ACTIVE → COMPLETED → ARCHIVED, plus ACTIVE → DRAFT revert) with transition functions, the revert primitive, and per-status capability guards.

**What it does:**
- **`ROLES_THAT_KEEP_POOL_ACTIVE = ["PLAYER","CO_ADMIN"]`** — roles whose ACTIVE membership keeps the pool in play; HOST/CORPORATE_HOST excluded.
- **`transitionToActive(poolId, actorUserId)`** — DRAFT→ACTIVE only when ≥1 ACTIVE PLAYER/CO_ADMIN exists (guard fixing the "stuck DRAFT" incident where optimistic callers flipped state without a real player). Idempotent; audits `POOL_STATUS_CHANGED`.
- **`transitionToCompleted(poolId, actorUserId?)`** — ACTIVE→COMPLETED only when every match has a PUBLISHED result (`currentVersionId not null`, to avoid counting headers with reverted versions). Audits, then in a fire-and-forget IIFE computes a hardcoded leaderboard (3 pts outcome, 5 pts exact) and exact-score counts, and batch-sends `sendPoolCompletedEmail` to all members with final rank, logging per-failure diagnostics.
- **`transitionToArchived(poolId, actorUserId)`** — allowed from DRAFT/ACTIVE/COMPLETED (else throws "Pool is already archived"). DRAFT pools are deleted entirely (cascade delete of poolPayment/poolInvite/corporateInvite/auditEvent/poolMember/pool, audited as DRAFT→DELETED); ACTIVE/COMPLETED are set ARCHIVED.
- **`revertPoolToDraft(poolId, actorUserId, reason, options)`** — idempotent (only ACTIVE reverts). In a transaction deletes Prediction/StructuralPrediction/GroupStandingsPrediction (preserving results/overrides) and sets DRAFT; audits with deleted counts; emails the host (`sendPoolRevertedToDraftEmail`) unless `options.sendNotification === false` (orphan-rescue migration path).
- **`wouldCauseRevert(poolId, excludingMemberId)`** — true if pool is ACTIVE and removing that member leaves zero ACTIVE PLAYER/CO_ADMIN.
- **Pure guards:** `canJoinPool` (DRAFT/ACTIVE), `canMakePicks` (ACTIVE), `canPublishResults` (ACTIVE/COMPLETED — COMPLETED for erratas), `canEditPoolSettings` (DRAFT), `canEditScoringConfig` (DRAFT), `canCreateInvites` (DRAFT/ACTIVE).

**Exports:** type `PoolStatus`; `transitionToActive`, `transitionToCompleted`, `transitionToArchived`, `revertPoolToDraft`, `wouldCauseRevert`, `canJoinPool`, `canMakePicks`, `canPublishResults`, `canEditPoolSettings`, `canEditScoringConfig`, `canCreateInvites`.

**Key dependencies:** `prisma`, `writeAuditEvent`, email senders (`sendPoolCompletedEmail`/`sendPoolRevertedToDraftEmail`/`batchSendEmails`), `resolveUserLocale`, fixture helpers, `fireAndForget`, Prisma `PoolMemberRole`.

**Flags:** `transitionToCompleted`'s completion-email block uses its own hardcoded scoring (3/5 points) instead of the pool's scoring preset / `pickTypesConfig`, so the rank/points emailed on completion can diverge from the actual leaderboard (especially for Estratega/structural pools, where structural points are entirely ignored). Comment references a "post-mundial TECH_DEBT backlog" retry TODO.

### backend/src/services/resultService.ts

**Purpose:** Pure business logic for publishing match results (with versioning + source semantics), sending result-published notification emails, triggering auto-advance/completion, and computing a standalone leaderboard.

**What it does:**
- **Types:** `PublishResultInput` (goals incl. 90' and penalties + reason), `SendResultNotificationsInput`, `HandleAutoAdvanceInput`.
- **`publishResult(data, ctx)`** — pool-admin only; guarded by `canPublishResults`; rejects ARCHIVED instances. Looks up the match in the snapshot. In a `$transaction` with `SELECT … FOR UPDATE` row lock on the existing `PoolMatchResult` header, computes the next version number and resolves the `ResultSource`: MANUAL instances allow direct publish (`HOST_MANUAL`/`HOST_OVERRIDE`); AUTO instances only allow override of an existing result (else `RESULT_NOT_YET_AVAILABLE` 403), and override always requires a reason (`REASON_REQUIRED_FOR_OVERRIDE` 400). Creates a PUBLISHED `PoolMatchResultVersion` and points `currentVersionId` at it. Audits `RESULT_PUBLISHED`, then fire-and-forget lazy-imports `structuralAutoPublish.autoPublishStructuralResults` and `advancementTrigger.checkAndTriggerAdvancement`. Returns `{ saved, pool, match, source }`.
- **`sendResultNotifications(data)`** — recomputes the full pool ranking using advanced (`scoreMatchPick`, honoring `includeExtraTime`/90') or legacy (`getScoringPreset`+`outcomeFromScore`) scoring per phase config, computes each member's points earned on this specific match, and batch-sends `sendResultPublishedEmail` with rank/total participants. Catches and logs email errors.
- **`handleAutoAdvance(data, ctx)`** — finds the published match's phase; calls `validateCanAutoAdvance`; if allowed, advances `group_stage` via `advanceToRoundOf32` or knockout phases via `advanceKnockoutPhase` using a hardcoded `phaseOrder` map. Audits the advance, then calls `transitionToCompleted`. All failures are caught/logged so they never fail the original request.
- **`getLeaderboard(poolId, userId, verbose)`** — ACTIVE-member only. Loads matches/teams/results/members/predictions and computes a leaderboard with inner `scorePickDetailed` using HARDCODED 3-pt outcome / 2-pt exact scoring (independent of the pool's preset/config). Returns ranked rows (sorted points desc, joinedAt asc) with optional verbose breakdown and a fixed `scoring: { outcomePoints: 3, exactScoreBonus: 2 }`.

**Exports:** `PublishResultInput`, `SendResultNotificationsInput`, `HandleAutoAdvanceInput` types; `publishResult`, `sendResultNotifications`, `handleAutoAdvance`, `getLeaderboard`.

**Key dependencies:** `prisma`, `writeAuditEvent`, email senders, `resolveUserLocale`, `getScoringPreset`, `scoreMatchPick`, `instanceAdvancement` (`validateCanAutoAdvance`/`advanceToRoundOf32`/`advanceKnockoutPhase`), `poolStateMachine` (`transitionToCompleted`/`canPublishResults`), Prisma `ResultSource`/`ResultSourceMode`, `requirePoolAdmin`, fixture helpers, `outcomeFromScore`, `fireAndForget`, `ServiceError`/`AuditContext`.

**Flags:** `getLeaderboard` uses hardcoded 3/2 scoring and ignores `pickTypesConfig` and structural picks entirely — it appears to be an older/MVP leaderboard parallel to `poolOverviewService`'s richer one; likely superseded/dead or only used by a legacy route (worth confirming whether any route still calls it). Scoring helper logic is duplicated across this file, `poolOverviewService`, and `poolAdminService` (drift risk). Hardcoded knockout `phaseOrder` chains are duplicated with `poolAdminService`.

### backend/src/services/resultSync/index.ts

**Purpose:** Barrel/entry for the result-sync subsystem.

**What it does:** Re-exports everything from `./service`.

**Exports:** `export * from "./service"` (re-exports the sync types, `ResultSyncService` class, and `getResultSyncService`).

**Key dependencies:** `./service`.

**Flags:** none.

### backend/src/services/resultSync/service.ts

**Purpose:** Synchronizes match results from API-Football for tournament instances in AUTO result-source mode, acting as a scraper-fallback layer with versioned, source-aware result writes.

**What it does:**
- **Types:** `SyncSummary`, `InstanceSyncResult`, `MatchSyncResult` (status CREATED/UPDATED/CONFIRMED/SKIPPED/ERROR), `SyncError`.
- **`ResultSyncService` class:**
  - Constructor obtains an `ApiFootballClient` via `getApiFootballClient()`.
  - **`isAvailable()`** — client present + `isApiFootballEnabled()`.
  - **`syncAllAutoInstances()`** — returns a no-client error summary if unavailable; otherwise finds all AUTO instances with `syncEnabled`, status ACTIVE/COMPLETED, and API league/season IDs set; syncs each via `syncInstance`, aggregating fixtures checked/updated and errors.
  - **`syncInstance(instanceId)`** — validates AUTO mode/sync enabled/API config; creates a RUNNING `ResultSyncLog`. Builds a kickoff map from `dataJson.matches`, filters to mappings whose kickoff has passed (or no kickoff defined), then drops matches already `API_CONFIRMED`. Applies a **scraper-first gate**: skips matches whose `MatchSyncState.syncStatus === "COMPLETED"` (scraper finalized) and only includes others once past the fallback window (`kickoffUtc + MATCH_SYNC.FINISH_CHECK_MS + SCORES.FALLBACK_DELAY_MS`); matches with no sync state are passed straight to API-Football. Fetches fixtures by ID, processes only finished fixtures (`isFixtureFinished`), and runs `processFixtureForPool` for every pool on the instance. Updates `lastSyncAtUtc`, finalizes the log as COMPLETED/PARTIAL/FAILED with API response time, and returns the result.
  - **`processFixtureForPool(poolId, matchId, fixture)`** — parses the fixture (`parseFixtureResult`); skips if not finished. Skips when an existing result is `HOST_OVERRIDE` (host wins) or an `API_CONFIRMED` with identical score. Decides status: CREATED (no result), CONFIRMED/UPDATED (when overwriting a `HOST_PROVISIONAL` matching/not-matching score), else UPDATED. In a transaction, creates a new PUBLISHED `PoolMatchResultVersion` with `source: API_CONFIRMED`, penalties, `externalFixtureId`, `externalDataJson`, `createdByUserId: null`, and repoints `currentVersionId`. Writes a `RESULT_SYNCED_FROM_API` audit event (system actor). Returns the `MatchSyncResult` with previous/new scores.
  - **`completeSyncLog(...)`** — updates the `ResultSyncLog` with counts, serialized errors, API response time, and rate-limit remaining.
- **Singleton:** module-level `serviceInstance` + `getResultSyncService()` lazy accessor.

**Exports:** types `SyncSummary`/`InstanceSyncResult`/`MatchSyncResult`/`SyncError`; class `ResultSyncService`; `getResultSyncService()`.

**Key dependencies:** `prisma`, `writeAuditEvent`, constants (`MATCH_SYNC`, `SCORES`), `../apiFootball` (`ApiFootballClient`/`getApiFootballClient`/`isApiFootballEnabled`/`ApiFootballFixture`/`parseFixtureResult`/`isFixtureFinished`), Prisma `ResultSource`/`SyncStatus`.

**Flags:** `externalDataJson: fixture as any` uses an `any` cast. `MatchSyncResult.status === "CONFIRMED"` is computed but treated as neither updated nor skipped in `syncInstance`'s counters (it falls through without incrementing fixturesUpdated/fixturesSkipped) — a minor counting gap, not dead code. Otherwise functional.

### backend/src/services/sales/accountReceivableService.ts

**Purpose:** Lifecycle service for the "cuenta de cobro" (AccountReceivable / CC) sales document — issue, retrieve, list, cancel, mark-paid, and the atomic redeem/release primitives consumed by the payment checkout and reconciler.

**What it does:**
- **Constants:** 8-digit numeric redemption code range (`CODE_MIN`/`CODE_MAX_EXCLUSIVE`) with `CODE_MAX_RETRIES`.
- **`IssueAccountReceivableInput` / `IssueAccountReceivableResult`** interfaces (client info, dates, locale/term, concept, pricing source `targetCapacity`+`currency`, optional `linkedQuoteId`, `createdByUserId`).
- **`derivePricing(targetCapacity, currency)`** — rejects capacities within the free tier (`CORPORATE_FREE_LIMIT`); computes amount via `calculateUpgradePriceCop` (COP) or `calculateUpgradePrice`+`usdToCents` (USD); returns one populated amount field.
- **`generateRedemptionCode(tx)`** — generates a crypto-random 8-digit code, retrying on collision (checks `accountReceivable.redemptionCode` uniqueness) up to 5 times.
- **`issueAccountReceivable(input)`** — validates the term/locale pairing (`isTermValidForLocale`), verifies `linkedQuoteId` exists, derives pricing, snapshots the issuer (`snapshotIssuer`), computes amount-in-words (`amountInWords`), then in a transaction reserves a consecutive (`nextConsecutive("ACCOUNT_RECEIVABLE", year)`), generates a redemption code, and creates the `AccountReceivable` row (defaults `poolType: "corporate"`, normalizes contact email to lowercase). Returns id/consecutive/code/amounts/words.
- **`getAccountReceivable(id)`** — fetch or 404.
- **`findByRedemptionCode(code)`** — normalizes to digits, requires exactly 8, returns the row or null (accepts raw or "XXXX-XXXX").
- **`listAccountReceivables(filters)`** — paginated/filtered list (by client email contains, status, created date range); returns items/total/page/totalPages.
- **`cancelAccountReceivable(id)`** — sets CANCELLED (idempotent if already cancelled).
- **`markAccountReceivablePaid(id)`** — atomic `updateMany` PENDING/REDEEMED → PAID (sets paidAtUtc); CONFLICT 409 if not in a payable state. For manual/wire reconciliation.
- **`tryLockAccountReceivable(tx, ccId, redeemedByUserId)`** — atomic PENDING → REDEEMED `updateMany`; returns `{locked:true}` or `{locked:false, reason:"ALREADY_REDEEMED"}` when count=0. Called inside the checkout transaction (race-safe).
- **`releaseAccountReceivable(tx, ccId)`** — inverse: REDEEMED → PENDING (clears redeemer + poolPaymentId); PAID rows untouched. Used by the reconciler on payment expiry.

**Exports:** types `IssueAccountReceivableInput`/`IssueAccountReceivableResult`/`ListAccountReceivablesFilters`/`ListAccountReceivablesResult`; functions `issueAccountReceivable`, `getAccountReceivable`, `findByRedemptionCode`, `listAccountReceivables`, `cancelAccountReceivable`, `markAccountReceivablePaid`, `tryLockAccountReceivable`, `releaseAccountReceivable`.

**Key dependencies:** `node:crypto`, Prisma types, `prisma`, `ServiceError`, `lib/pricing` (`calculateUpgradePrice`/`calculateUpgradePriceCop`/`usdToCents`/`CORPORATE_FREE_LIMIT`), `lib/issuerInfo.snapshotIssuer`, `lib/saleTerms` (`isTermValidForLocale`/`SaleLocale`), `lib/amountInWords`, `./documentCounterService.nextConsecutive`, `SaleCurrency` from `./quoteService`.

**Flags:** Doc comments reference "commit 6 / commit 8" of the sales rollout — historical references, not code issues. This is the active sales gateway (per memory, Wompi is deprecated/replaced by Mercado Pago); nothing here is dead. None.

### backend/src/services/sales/documentCounterService.ts

**Purpose:** Race-safe atomic consecutive-number generator for sales documents (quotes and cuentas de cobro), one counter row per (kind, year).

**What it does:**
- **`CounterKind = "QUOTE" | "ACCOUNT_RECEIVABLE"`** and `PREFIX` map (`COT` / `CC`), `PADDING = 4`.
- **`NextConsecutiveResult`** interface (`number`, `consecutive`, `year`).
- **`nextConsecutive(tx, kind, year)`** — must run inside a transaction. Executes a raw Postgres `INSERT … ON CONFLICT ("kind","year") DO UPDATE SET lastNumber = lastNumber + 1 … RETURNING lastNumber` against `DocumentCounter`, casting `kind` to the `DocumentKind` enum. Postgres serializes concurrent writers on the (kind, year) PK so parallel callers get sequential numbers without app-level locks. Formats the result as `{PREFIX}-{year}-{0001}` and returns `{number, consecutive, year}`. Throws if the upsert returns no usable row.

**Exports:** type `CounterKind`, interface `NextConsecutiveResult`, function `nextConsecutive`.

**Key dependencies:** Prisma `Prisma.TransactionClient`; relies on the `DocumentCounter` table and `DocumentKind` enum in the schema.

**Flags:** none.
