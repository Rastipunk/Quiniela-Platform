## Batch 12

### backend/src/services/sales/quoteService.ts

**Purpose:** Owns the lifecycle (issue, retrieve, list, cancel) of corporate Quote (cotización) rows. Pricing is always server-derived from `lib/pricing.ts` — admins never supply amounts — and issuer details are snapshotted at issue time for legal audit.

**What it does:**
- `derivePricing(participants, currency)` — internal helper that server-derives the total amount and per-person value. Throws `ServiceError("VALIDATION_ERROR", 400)` if `participants <= CORPORATE_FREE_LIMIT` (no point quoting a $0 invoice). For `COP` it calls `calculateUpgradePriceCop("corporate", CORPORATE_FREE_LIMIT, participants)`; for `USD` it calls `calculateUpgradePrice(...)` (dollars) then `usdToCents(...)`. Both paths reject non-positive results and compute `perPersonAmount` via rounding.
- `issueQuote(input)` — validates the localized legal `term` against `isTermValidForLocale(locale, term)`, derives pricing, snapshots the issuer (`snapshotIssuer()` cast to `Prisma.InputJsonValue`), computes `year` from `issueDate`, then in a single `prisma.$transaction` grabs the next consecutive document number via `nextConsecutive(tx, "QUOTE", year)` and creates the `Quote` row (client name/email lowercased+trimmed, currency, amounts, dates, cover page, notes, `createdByUserId`). Counter increment + INSERT share the transaction so a failed INSERT doesn't burn a consecutive number. Returns `{ id, consecutive, amountCop, amountUsdCents, perPersonAmount }`.
- `getQuote(id)` — `findUnique`, throws `NOT_FOUND` 404 if missing.
- `listQuotes(filters)` — paginated list (page clamped >= 0, limit clamped 1..100). Filters by `clientEmail` (contains, normalized), `status`, and `createdAtUtc` date range. Runs `count` + `findMany` (ordered `createdAtUtc desc`) in parallel. Returns `{ quotes, total, page, totalPages }`.
- `cancelQuote(id)` — sets status to `CANCELLED`; idempotent (returns early if already cancelled); throws `NOT_FOUND` if missing.

**Exports:** `SaleCurrency` ("COP"|"USD"), interfaces `IssueQuoteInput`, `IssueQuoteResult`, `ListQuotesFilters`, `ListQuotesResult`; functions `issueQuote`, `getQuote`, `listQuotes`, `cancelQuote`.

**Key dependencies:** `@prisma/client` types, `../../db` prisma, `ServiceError` from `../authService`, `../../lib/pricing` (`calculateUpgradePrice`, `calculateUpgradePriceCop`, `usdToCents`, `CORPORATE_FREE_LIMIT`), `snapshotIssuer` from `../../lib/issuerInfo`, `isTermValidForLocale`/`SaleLocale` from `../../lib/saleTerms`, `nextConsecutive` from `./documentCounterService`. Spec refs SALES_AUDIT.md §5.3/§9.1/§11.*. Relates to ADR-061 (sales management).

**Flags:** none.

### backend/src/services/scoresService/client.ts

**Purpose:** Typed HTTP client for the external `picks4all-scores` scraping microservice (Bearer-token REST), the primary source for live/finalized match results.

**What it does:**
- Env helpers `envStr`/`envInt`; lazy getters `SCORES_SERVICE_URL`, `SCORES_SERVICE_API_KEY`, `TIMEOUT_MS` (default 10000) read `process.env` at call time (so test/config changes apply without re-import).
- Declares response/request types: `LiveScore` (goals by phase incl. HT/FT/ET/PEN, status code, `confidence` VERY_HIGH..NONE, source agreement counts, optional `actualKickoffUtc`), `LiveScoresResponse`, `TrackFixture` (with optional `leagueId`/`season` for verify support), `TrackFixtureStatus`, `TrackFixtureDetail`, `TrackResponse`, `FixturesVerifyFixture`/`FixturesVerifyResponse` (kickoff-drift detection), `TrackStatusEntry`/`TrackStatusResponse`, internal `HealthResponse`.
- `ScoresServiceClient` class:
  - `isAvailable()` — true when URL and API key are both set.
  - `getLiveScores()` — `GET /api/v1/scores/live`.
  - `trackFixtures(fixtures)` — `POST /api/v1/track`.
  - `getFixturesVerify({league, season, since?, until?})` — `GET /api/v1/fixtures/verify` for the daily kickoff-drift job.
  - `getTrackStatus(fixtureIds)` — `GET /api/v1/track/status` (short-circuits to empty result on empty input).
  - `getHealth()` — `GET /health`.
  - Private `request<T>(method, path, body?)` — builds the URL, attaches Bearer auth + Accept JSON, uses an `AbortController` with the configured timeout, throws descriptive errors on non-OK status (truncated body) or timeout (AbortError), clears the timeout in `finally`.
- Singleton accessor `getScoresServiceClient()` (lazy `_instance`) and convenience `isScoresServiceConfigured()`.

**Exports:** `ScoresServiceClient`, `getScoresServiceClient`, `isScoresServiceConfigured`; types `LiveScore`, `LiveScoresResponse`, `TrackFixture`, `TrackFixtureStatus`, `TrackFixtureDetail`, `TrackResponse`, `FixturesVerifyFixture`, `FixturesVerifyResponse`, `TrackStatusEntry`, `TrackStatusResponse`.

**Key dependencies:** native `fetch`/`AbortController`; env vars `SCORES_SERVICE_URL`, `SCORES_SERVICE_API_KEY`, `SCORES_SERVICE_TIMEOUT_MS`.

**Flags:** none. (`HealthResponse` is internal-only; `getHealth` is exposed but consumer not verified within this batch.)

### backend/src/services/scoresService/index.ts

**Purpose:** Barrel re-export for the scores-service module.

**What it does:** Re-exports `ScoresServiceClient`, `getScoresServiceClient`, `isScoresServiceConfigured` and the type set (`LiveScore`, `LiveScoresResponse`, `TrackFixture`, `TrackResponse`, `TrackFixtureDetail`, `TrackFixtureStatus`, `FixturesVerifyResponse`, `FixturesVerifyFixture`, `TrackStatusResponse`, `TrackStatusEntry`) from `./client`.

**Exports:** see above.

**Key dependencies:** `./client`.

**Flags:** none.

### backend/src/services/smartSync/index.ts

**Purpose:** Barrel for the SmartSync module.

**What it does:** Re-exports `SmartSyncService`, `getSmartSyncService`, and type `SmartSyncResult` from `./service`.

**Exports:** `SmartSyncService`, `getSmartSyncService`, `SmartSyncResult`.

**Key dependencies:** `./service`.

**Flags:** none.

### backend/src/services/smartSync/service.ts

**Purpose:** Cost-optimized API-Football result synchronization. Acts as the FALLBACK source behind the scraper, polling each match only at the right times (after kickoff to confirm start, near estimated end to confirm finish) to keep API credit usage to ~2-4 calls per match.

**What it does:**
- Timing constants: `FIRST_CHECK_DELAY_MINUTES=5`, `FINISH_CHECK_DELAY_MINUTES=110`, `AWAITING_FINISH_POLL_MINUTES=5`, and `PENDING_BACKOFF_TIERS` (5min / 60min / 120min / 1440min escalating with wait time). `getPendingPollInterval(firstCheckAtUtc, now)` walks tiers in reverse to choose the current poll interval for a still-PENDING match.
- `SmartSyncService` class wrapping an `ApiFootballClient`:
  - `isAvailable()` — client present and API-Football enabled.
  - `initializeMatchSyncStates(instanceId)` — extracts matches from instance `dataJson`, upserts a `matchSyncState` per match with `kickoffUtc`, `firstCheckAtUtc`, `finishCheckAtUtc`; initial status `PENDING` if the match has an API mapping else `SKIPPED`. Preserves existing status on update.
  - `processMatchesNeedingSync(instanceId)` — the per-minute cron entry. Returns early unless `resultSourceMode === "AUTO"`. Selects PENDING candidates past `firstCheckAtUtc` and applies backoff filtering; selects IN_PROGRESS past `finishCheckAtUtc` and AWAITING_FINISH past the poll window. For each match: resolves the API mapping (marks SKIPPED if none); **scraper-first gate** — skips `COMPLETED` matches entirely, and skips any match before `estimatedEnd + SCORES.FALLBACK_DELAY_MS` so the scraper gets first crack. Then calls `checkMatch`, accumulates `SmartSyncResult` counters, records per-match errors, and updates `tournamentInstance.lastSyncAtUtc` if any processed.
  - `checkMatch(matchState, fixtureId, poolIds)` — fetches the fixture, records `lastCheckedAtUtc`/`lastApiStatus`, and drives the state machine: PENDING→(IN_PROGRESS or COMPLETED), IN_PROGRESS→(COMPLETED or AWAITING_FINISH), AWAITING_FINISH→COMPLETED. Uses `isFixtureInProgress`/`isFixtureFinished`. On finish, calls `publishResult`.
  - `publishResult(matchState, fixture, poolIds)` — parses the fixture; for each pool, skips if existing result is `API_CONFIRMED` or `HOST_OVERRIDE` (host is final); logs upgrade from `SCRAPER_PROVISIONAL`. Inside a transaction, locks the `PoolMatchResult` header `FOR UPDATE` (or creates it), creates a new `PoolMatchResultVersion` (status PUBLISHED, source `API_CONFIRMED`, storing 90' score separately for AET/PEN matches, penalties, external fixture id/json), and points `currentVersionId` at it. Writes a `RESULT_SYNCED_FROM_API` audit event per pool, then calls `checkAutoAdvance`.
  - `checkAutoAdvance(matchState, poolIds)` — for two-legged knockout matches (id prefix `r32|r16|qf|sf`), derives the round, looks up the next round via an advancement map, gathers all SCHEDULED match ids across both legs, validates per-pool via `validateCanAutoAdvance`, and once eligible calls `tryAdvancePhaseFromApi(instanceId, currentRound)` (instance-wide, so it breaks after the first triggering pool) and writes an `AUTO_PHASE_SYNC_TRIGGERED` audit. All failures are caught/logged so sync never breaks.
  - `getSyncStatus(instanceId)` — groupBy counts per `syncStatus`.
  - `getMatchesInProgress(instanceId)` — returns IN_PROGRESS/AWAITING_FINISH matches for UI.
  - `verifyUpcomingFixtures(instanceId)` — pre-kickoff verification (called every 12h from phaseSyncJob). For PENDING matches 1-3 days out, re-fetches from API-Football, detects date or team changes, updates instance `dataJson` + `matchSyncState` timing + every pool's `fixtureSnapshot`, and sends an admin email (`sendAdminNotification`, dynamically imported) listing the changes.
- Singleton `getSmartSyncService()`.

**Exports:** `SmartSyncService`, `getSmartSyncService`, interface `SmartSyncResult`.

**Key dependencies:** `../../db`, `MATCH_SYNC`/`SCORES` constants, `MatchSyncStatus` enum, `../apiFootball` (client + helpers + `parseFixtureResult`), `writeAuditEvent`, `extractMatches`, `validateCanAutoAdvance` from `../instanceAdvancement`, `tryAdvancePhaseFromApi` from `../adminInstanceService`, `sendAdminNotification` (dynamic import).

**Flags:** `publishResult`'s `fixture` parameter is typed `any` (loose). The `checkMatch` body uses `MatchSyncStatus` cast (`"COMPLETED" as MatchSyncStatus`) — minor. No dead code.

### backend/src/services/structuralAutoPublish.ts

**Purpose:** For Estratega (SIMPLE preset) pools, automatically derives and publishes structural results (group standings, knockout winners) from scraper/API-confirmed `PoolMatchResult` data, so hosts don't publish them manually.

**What it does:**
- Invoked from two hook points: `liveScoresJob.finalizeResult()` (after SCRAPER_PROVISIONAL→API_CONFIRMED upgrade) and `resultService.publishResult()` (after a HOST_OVERRIDE). Idempotent via upserts. Does NOT send emails or trigger auto-advance (that lives in `advancementTrigger`).
- `autoPublishStructuralResults(poolId, matchId)` — top-level entry. Loads pool config + fixture source (snapshot or instance `dataJson`), finds the match and its phase, checks the phase is structural (`requiresScore === false`) in `pickTypesConfig`, then dispatches to `autoPublishGroupStandings` (type `GROUP_STANDINGS` with a `groupId`) or `autoPublishKnockoutWinner` (type `KNOCKOUT_WINNER`). Wraps in try/catch and swallows errors so it never breaks the caller's transaction.
- `autoPublishGroupStandings(poolId, phaseId, groupId)` — gathers the group's matches and team ids, fetches their `PoolMatchResult`s; returns early if the group isn't fully finalized. Builds standings input (prefers `homeGoals90`/`awayGoals90` over raw goals), computes order via `calculateGroupStandings`, idempotently skips if the stored `teamIds` already match, then upserts `GroupStandingsResult` (increments `version` on update; attributes system-created rows to `pool.createdByUserId`). Fires a `GROUP_STANDINGS_AUTO_RECOMPUTED`/`..._PUBLISHED` audit via `fireAndForget`.
- `autoPublishKnockoutWinner(poolId, phaseId, matchId)` — derives the winner from the match's current version (regulation/ET goals, then penalties; returns early if tied with no penalties or tied penalties). Merges `{matchId, winnerId}` into `StructuralPhaseResult.resultJson.matches[]`, idempotently skipping if unchanged, upserts the row, and fires `KNOCKOUT_WINNER_AUTO_RECOMPUTED`/`..._PUBLISHED` audit.
- `arraysEqual(a, b)` — local order-sensitive equality helper.

**Exports:** `autoPublishStructuralResults` (the only export; the two helpers and `arraysEqual` are module-private).

**Key dependencies:** `@prisma/client` `Prisma`, `../db`, `writeAuditEvent`, `extractMatches`/`parseFixtureData` from `../lib/fixture`, `calculateGroupStandings` from `./tournamentAdvancement`, `fireAndForget` from `../lib/asyncHelpers`.

**Flags:** none. (Audit actor uses the string literal `"SYSTEM"` for `actorUserId` — intentional per comments.)

### backend/src/services/structuralScoring.ts

**Purpose:** Scoring algorithms for structural picks (Estratega / SIMPLE preset): group-standings ordering and knockout-winner selection, plus a detailed per-user breakdown for leaderboard/PlayerSummary UI.

**What it does:**
- `scoreGroupStandings(pick, result, config)` — awards points per team placed in its exact position, supporting both the new per-position format (`pointsPosition1..4`, default 10) and legacy `pointsPerExactPosition`. Adds a perfect-group bonus when enabled (`bonusPerfectGroupEnabled` or legacy positive `bonusPerfectGroup`) and all positions match.
- `scoreKnockoutWinner(pick, result, config)` — returns `pointsPerCorrectAdvance` when the predicted winner matches, else 0.
- `scoreStructuralPhase(pickData, resultData, phaseConfig)` — sums points across all groups (GROUP_STANDINGS) or all matches (KNOCKOUT_WINNER) using result-by-id maps.
- `scoreUserStructuralPicks(userStructuralPicks, structuralResults, poolConfig)` — aggregates a single user's total structural points across all phases by joining picks↔results↔config on `phaseId`.
- Detailed breakdown layer (types `StructuralPickInput`, `StructuralResultInput`, `StructuralGroupBreakdown`, `StructuralKnockoutBreakdown`, `StructuralPhaseAggregate`, `StructuralBreakdown`): `computeStructuralBreakdown(userPicks, results, poolConfig, knockoutMatchUniverse?, groupUniverse?)` walks each configured structural phase and emits one row per group/match (even unresolved ones — emitting `actualTeamIds: null` / `actualWinnerId: null` so the UI shows "Por jugar"). It computes `positionsCorrect`, `isPerfect`, per-phase and global aggregates, and deterministically sorts groups/matches alphabetically by id for stable leaderboard ordering. Side-effect-free and idempotent.
- `StructuralStatsSummary` + `summarizeStructural(b)` — strips the heavy per-row arrays, keeping aggregate counters + `winnersByPhase` for embedding in leaderboard rows.

**Exports:** functions `scoreGroupStandings`, `scoreKnockoutWinner`, `scoreStructuralPhase`, `scoreUserStructuralPicks`, `computeStructuralBreakdown`, `summarizeStructural`; types `StructuralPickInput`, `StructuralResultInput`, `StructuralGroupBreakdown`, `StructuralKnockoutBreakdown`, `StructuralPhaseAggregate`, `StructuralBreakdown`, `StructuralStatsSummary`.

**Key dependencies:** none (pure functions). The local `GroupStandingsConfig` type here is distinct from the one in `types/pickConfig.ts`.

**Flags:** Heavy use of `any` in the older aggregate functions (`scoreStructuralPhase`, `scoreUserStructuralPicks`, `poolConfig: any[]`). Two parallel config shapes for group standings (new per-position vs legacy) — intentional backward compat, not dead code.

### backend/src/services/tournamentAdvancement.ts

**Purpose:** Pure tournament-progression logic: FIFA WC2026 group standings + qualifier determination + placeholder resolution, and UEFA Champions League two-legged tie resolution.

**What it does:**
- Types `TeamStanding`, `GroupResults`, `ThirdPlaceTeam`.
- `computeHeadToHead(tiedTeamIds, allMatches)` — builds a mini-table (points/GD/GF) using only matches between the tied teams.
- `calculateGroupStandings(groupId, teamIds, results)` — accumulates W/D/L, goals, points; multi-pass sort: (1) general criteria points→GD→GF, (2) detect tied clusters and break with head-to-head (points→GD→GF), then fair-play, then drawing-of-lots fallback (returns 0). Assigns 1-based positions. Logs/skips matches with unknown teams.
- `rankThirdPlaceTeams(allThirds)` — ranks third-place teams across groups by points→GD→GF→fair play→alphabetical groupId, assigning `rankAcrossGroups`.
- `determineQualifiers(allGroupStandings)` — extracts winners + runners-up per group and the best 8 thirds (WC2026: 12+12+8=32).
- `resolvePlaceholders(matches, winners, runnersUp, bestThirds)` — replaces `W_<group>`, `RU_<group>`, `3rd_POOL_<rank>` placeholders with real team ids (leaves unresolved ones intact).
- Two-legged tie types `LegResult`, `TwoLeggedTieResult`. `determineTwoLeggedTieWinner(leg1, leg2, teamAId, teamBId, tieNumber)` — sums aggregate (no away-goals rule, UEFA 2021-22+); decides by aggregate, else by leg2 penalties; throws if aggregate tied with no penalties recorded or penalties tied (impossible states).
- `resolveKnockoutPlaceholders(matches, results)` — replaces `W_<matchId>` / `L_<matchId>` placeholders (mapping `W_`/`L_` → `m_` keys) with winners/losers of prior matches.

**Exports:** types `TeamStanding`, `LegResult`, `TwoLeggedTieResult`; functions `calculateGroupStandings`, `rankThirdPlaceTeams`, `determineQualifiers`, `resolvePlaceholders`, `determineTwoLeggedTieWinner`, `resolveKnockoutPlaceholders`. (`GroupResults`, `ThirdPlaceTeam`, `computeHeadToHead` are module-private.)

**Key dependencies:** none (pure logic).

**Flags:** none.

### backend/src/services/tournamentAdvancement.test.ts

**Purpose:** Vitest unit tests for `tournamentAdvancement.ts`.

**What it does:** Five describe blocks asserting:
- `calculateGroupStandings` — points for W/D/L, descending sort, GD and GF tiebreaks, 1-based positions, GD math, 0-0 draws, empty results, skipping unknown-team matches, played-count tracking.
- `rankThirdPlaceTeams` — points/GD/GF tiebreaks, alphabetical-groupId fallback, sequential `rankAcrossGroups`.
- `determineQualifiers` — winners/runners-up extraction, selecting best 8 thirds from 12 groups, fewer thirds when fewer groups.
- `resolvePlaceholders` — `W_`/`RU_`/`3rd_POOL_` resolution, leaving unmatched placeholders and normal ids unchanged.
- `determineTwoLeggedTieWinner` — aggregate wins (both teams), penalty decisions (home and away), throwing on tied-aggregate-no-penalties and on equal penalties, tieNumber pass-through, loser identification.
- `resolveKnockoutPlaceholders` — `W_`/`L_` resolution, unresolved placeholders kept, resolved ids unchanged.

**Exports:** none (test suite).

**Key dependencies:** `vitest`, `./tournamentAdvancement`.

**Flags:** none.

### backend/src/types/express.d.ts

**Purpose:** Ambient type augmentation adding the authenticated-user payload to Express requests.

**What it does:** Declares `Express.Request.auth?: { userId: string; platformRole: PlatformRole }` globally so route handlers can read `req.auth` after the auth middleware populates it.

**Exports:** none (ambient `.d.ts`; trailing `export {}` makes it a module).

**Key dependencies:** `PlatformRole` from `@prisma/client`.

**Flags:** none.

### backend/src/types/numero-a-letras.d.ts

**Purpose:** Type shim for the `numero-a-letras` npm package (used to spell out monetary amounts in Spanish on cuentas de cobro/quotes), which ships no `.d.ts`.

**What it does:** Declares module `"numero-a-letras"` exporting `NumerosALetras(amount: number, opts?: Record<string, unknown>): string`.

**Exports:** ambient module declaration only.

**Key dependencies:** none.

**Flags:** none.

### backend/src/types/pickConfig.ts

**Purpose:** TypeScript type definitions for the advanced pick-types configuration system (Sprint 2): match-based and structural pick configs per phase, presets, scoring context, and validation result shapes.

**What it does:**
- Match-based types: `MatchPickTypeKey` (EXACT_SCORE [legacy], GOAL_DIFFERENCE, PARTIAL_SCORE [legacy XOR], TOTAL_GOALS, MATCH_OUTCOME_90MIN, HOME_GOALS/AWAY_GOALS [cumulative]), `MatchPickType`, `AutoScalingConfig` (round-importance multipliers), `MatchPicksConfig`.
- Structural types: `StructuralPickType` (GROUP_STANDINGS, GLOBAL_QUALIFIERS, KNOCKOUT_WINNER), `GroupStandingsConfig`, `GlobalQualifiersConfig`, `KnockoutWinnerConfig`, union `StructuralPickConfig`, `StructuralPicksConfig`.
- `PhasePickConfig` — the central per-phase shape with the mutually-exclusive `requiresScore` branch (true→`matchPicks`, false→`structuralPicks`), optional `includeExtraTime`. `PoolPickTypesConfig = PhasePickConfig[]`.
- Presets: `PickConfigPresetKey` (BASIC/SIMPLE/CUMULATIVE/CUSTOM), `PickConfigPreset`.
- Scoring/validation result types: `ScoringContext`, `PickEvaluationResult`, `MatchScoringResult`, `ValidationResult`, `ValidationError`, `ValidationWarning`.

**Exports:** all the types above (type-only module).

**Key dependencies:** none.

**Flags:** Documents legacy pick types (EXACT_SCORE, PARTIAL_SCORE) and a `GLOBAL_QUALIFIERS` structural type — the latter has a Zod schema in the validator but no scoring implementation in `structuralScoring.ts` (`scoreStructuralPhase` only handles GROUP_STANDINGS and KNOCKOUT_WINNER), so GLOBAL_QUALIFIERS appears unimplemented/aspirational.

### backend/src/validation/pickConfig.test.ts

**Purpose:** Vitest unit tests for the Zod schemas and custom validators in `pickConfig.ts`.

**What it does:** Asserts schema acceptance/rejection for `MatchPickTypeKeySchema`, `MatchPickTypeSchema` (points 0..1000 int boundaries, optional config, required key), `AutoScalingConfigSchema` (basePhase non-empty, multiplier 1..10), `MatchPicksConfigSchema` (non-empty types), `StructuralPickTypeSchema`, `GroupStandingsConfigSchema`, `GlobalQualifiersConfigSchema` (totalQualifiers>=1, datetime format), `KnockoutWinnerConfigSchema`, `PhasePickConfigSchema`, `PickConfigPresetKeySchema`. For `validatePhasePickConfig`: the `requiresScore` exclusivity rules (missing/extra branch errors), "at least one type enabled", ZodError flattening, null input, and the soft point-balance warnings (EXACT<=GOAL_DIFF, GOAL_DIFF<=PARTIAL, undervalued EXACT, well-balanced=no warnings). For `validatePoolPickTypesConfig`: valid config, empty-phases error, duplicate phaseId error, `phases[i]` error prefixing, non-array input, independent multi-phase validation.

**Exports:** none (test suite).

**Key dependencies:** `vitest`, `./pickConfig`.

**Flags:** none.

### backend/src/validation/pickConfig.ts

**Purpose:** Zod schemas + custom validators for advanced pick-type configuration, enforcing the `requiresScore` mutual-exclusivity rule and emitting soft warnings on illogical point balances.

**What it does:**
- Schemas mirroring `types/pickConfig.ts`: `MatchPickTypeKeySchema`, `MatchPickTypeSchema` (points int 0..1000), `AutoScalingConfigSchema` (multipliers 1..10), `MatchPicksConfigSchema` (>=1 type), `StructuralPickTypeSchema`, `GroupStandingsConfigSchema`, `GlobalQualifiersConfigSchema` (datetime), `KnockoutWinnerConfigSchema`, union `StructuralPickConfigSchema`, `StructuralPicksConfigSchema`, `PhasePickConfigSchema`, `PoolPickTypesConfigSchema`, `PickConfigPresetKeySchema`.
- `validatePhasePickConfig(config)` — parses with `PhasePickConfigSchema`, then enforces: `requiresScore=true` needs `matchPicks` and forbids `structuralPicks` (and requires >=1 enabled type, plus calls `validateMatchPicksBalance` for warnings); `requiresScore=false` needs `structuralPicks` and forbids `matchPicks`. Returns `ValidationResult`; catches `ZodError` (flattening `issues` into `{field, message}`) and falls back to a generic error.
- `validateMatchPicksBalance(config)` — generates Spanish-language `ValidationWarning`s when point ordering is illogical (EXACT_SCORE <= GOAL_DIFFERENCE, GOAL_DIFFERENCE <= PARTIAL_SCORE, PARTIAL_SCORE <= TOTAL_GOALS) or when EXACT_SCORE is < 60% of the sum of GOAL_DIFFERENCE + PARTIAL_SCORE.
- `validatePoolPickTypesConfig(config)` — parses the array, errors on empty, validates each phase (prefixing `phases[i].` on field paths), aggregates warnings, and errors on duplicate `phaseId`s. Same ZodError/generic fallback handling.

**Exports:** all schema consts above; functions `validatePhasePickConfig`, `validatePoolPickTypesConfig` (and `validateMatchPicksBalance` is module-private).

**Key dependencies:** `zod`, types `ValidationResult`/`ValidationWarning` from `../types/pickConfig`.

**Flags:** `GlobalQualifiersConfigSchema` validates a structural type that has no scoring implementation (see pickConfig.ts note) — schema exists but the feature is not wired into the scoring engine.

### backend/tsconfig.json

**Purpose:** TypeScript compiler configuration for the Express backend.

**What it does:** CommonJS output to `./dist` from `./src`, target/lib ES2022, `jsx: react`, custom `typeRoots` including `./src/types` (so the ambient `.d.ts` shims resolve), node module resolution, `esModuleInterop`, `resolveJsonModule`. Emits source maps + declaration + declaration maps. Strict mode plus `noUncheckedIndexedAccess`, `isolatedModules`, `skipLibCheck`, `forceConsistentCasingInFileNames`. Includes `src/**/*`; excludes `node_modules`, `dist`, `src/scripts/**`, all `*.test.ts`, and `src/__tests__/**` (tests/integration excluded from the build).

**Exports:** n/a.

**Key dependencies:** n/a.

**Flags:** none.

### backend/vitest.config.ts

**Purpose:** Vitest config for backend unit tests.

**What it does:** Node environment, globals on, includes `src/**/*.test.ts`, excludes `src/__tests__/**` (those are integration). V8 coverage scoped narrowly to `src/lib/email.ts` and `src/services/deadlineReminderService.ts`. Injects mock env vars `RESEND_API_KEY=test_api_key` and `FRONTEND_URL=http://localhost:5173`.

**Exports:** default Vitest config.

**Key dependencies:** `vitest/config`.

**Flags:** Coverage include list is very narrow (only two files) — likely intentional rather than full-repo coverage.

### backend/vitest.integration.config.ts

**Purpose:** Vitest config for backend integration tests.

**What it does:** Includes only `src/__tests__/**/*.test.ts` with extended 15s test and hook timeouts.

**Exports:** default Vitest config.

**Key dependencies:** `vitest/config`.

**Flags:** none.

### frontend-next/.gitignore

**Purpose:** Git ignore rules for the Next.js frontend.

**What it does:** Ignores node_modules/PnP/Yarn metadata (with allow-list exceptions), `/coverage`, Next.js build artifacts (`/.next/`, `/out/`), `/build`, `.DS_Store`, `*.pem`, debug logs, all `.env*` files, `.vercel`, `*.tsbuildinfo`, and `next-env.d.ts`.

**Exports:** n/a.

**Key dependencies:** n/a.

**Flags:** none. (Mentions `.vercel`/Vercel despite Railway hosting — boilerplate from create-next-app, harmless.)

### frontend-next/.railwayignore

**Purpose:** Excludes paths from the Railway deploy upload for the frontend.

**What it does:** Ignores `nul`, `node_modules`, `.next`.

**Exports:** n/a.

**Key dependencies:** n/a.

**Flags:** `nul` entry suggests a stray Windows null-device artifact was once committed/created — minor cleanliness note, not functional dead code.

### frontend-next/e2e/analytics-tracking.spec.ts

**Purpose:** Playwright black-box smoke tests for the client-side analytics/tracking layer (GA4 dataLayer shapes, Consent Mode v2, attribution, identity, debug, purchase dedup).

**What it does:** Helpers `stubAnalyticsNetwork(page)` (aborts outbound Google/Meta requests so CI runs offline) and `getDataLayer(page)` (deep-copies `window.dataLayer`). Test groups assert:
- Consent Mode v2 bootstrap: default consent denied on first visit (gtag `('consent','default',…)` tuple with all four signals denied); accepting the banner emits a `('consent','update',…)` tuple granting `analytics_storage`.
- GA4 ecommerce: `/precios` fires `view_item_list` with `item_list_id: "pricing_page"` and canonical `items[]` (string item_id/name, numeric price, quantity 1, currency USD|COP).
- Attribution: UTM params captured first-touch into `sessionStorage["p4a_attribution"]`; later visits don't overwrite.
- Identity: `setAnalyticsUserId(null)` (from `@/lib/analytics`) pushes a null `user_id` on logout.
- Debug: `?gtm_debug=1` enables `[analytics]` console logging and persists `p4a_analytics_debug=1` in localStorage.
- Purchase dedup: `trackPurchase` (from `@/lib/ecommerce`) called twice with the same `transactionId` yields two `purchase` events with identical `transaction_id`, correct `item_id` (`pool_upgrade_personal_50`), `item_variant`, `value`, `currency` (COP / Mercado Pago example).
- Notification events: `notification_subscription_toggled` pushes a single unified event with `type`/`enabled`.

**Exports:** none (test suite).

**Key dependencies:** `@playwright/test`; app modules `@/lib/analytics`, `@/lib/ecommerce`.

**Flags:** none. (References Mercado Pago / COP — consistent with the current dual-gateway setup; no Wompi reference.)

### frontend-next/e2e/auth-flow.spec.ts

**Purpose:** Playwright end-to-end tests for authentication flows.

**What it does:** Asserts: login page renders email/password/submit and carries a `noindex` robots meta; API login with valid creds (`loginAsTestUser`) returns a token (>50 chars) and userId, invalid creds to `https://api.picks4all.com/auth/login` return >=400; AuthGuard redirects unauthenticated `/dashboard` and `/pools/join?code=...` visits to `/login` (preserving a `redirect` query param); authenticated users (`authenticatePage`) can reach `/dashboard` without being bounced to login.

**Exports:** none (test suite).

**Key dependencies:** `@playwright/test`, `./helpers/auth`.

**Flags:** Relies on hard-coded production API host `https://api.picks4all.com` in the invalid-credentials test (other helpers derive the host from `BASE_URL`) — minor inconsistency. `waitForTimeout` usage (2-3s) is a flaky-prone pattern but intentional for hydration.

### frontend-next/e2e/helpers/auth.ts

**Purpose:** Shared auth helpers for E2E tests (API login, page cookie injection, authenticated API requests).

**What it does:** Derives `API_URL` from `BASE_URL` (swapping `picks4all.com`→`api.picks4all.com`) or defaults to production. `loginAsTestUser()` requires `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` env vars, POSTs `/auth/login`, extracts the `p4a_token` from the `Set-Cookie` header (HTTP-only), and returns `{ token, userId }`. `authenticatePage(page, session)` injects `p4a_token` (httpOnly) and `p4a_logged_in=1` cookies scoped to the `BASE_URL` host. `apiRequest(method, path, token, body?)` makes an authenticated request sending both Cookie and Bearer auth, returning `{ status, data }`.

**Exports:** interface `AuthSession`; functions `loginAsTestUser`, `authenticatePage`, `apiRequest`.

**Key dependencies:** `@playwright/test` `request`; env vars `BASE_URL`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.

**Flags:** `page` and return types use `any`. `apiRequest` export consumer not verified within this batch (potentially unused by current specs).

### frontend-next/e2e/helpers/pages.ts

**Purpose:** Central page registry — single source of truth for every public/auth page, its per-locale paths, expected SEO metadata, required elements, and index/noindex status. Test suites iterate it so new pages are auto-covered.

**What it does:** Defines `PageDefinition` interface. `PUBLIC_PAGES` enumerates home, faq, how-it-works, what-is-quiniela, pricing, enterprise, terms, privacy, refunds; regional SEO pages (polla-futbolera, prode-deportivo, penca-futbol, porra-deportiva, football-pool); and the World Cup 2026 hub set (hub, groups, schedule, venues, howto, rules, predictions) — each with ES/EN/PT paths, `indexed: true`, title/description substrings, required selectors, and some `forbiddenText` lists. `AUTH_PAGES` holds the login page (`indexed: false`). `ALL_PAGES` concatenates both. `GLOBAL_FORBIDDEN_PATTERNS` lists regexes that must never appear on any page (leaked `NEXT_PUBLIC_` names, unhandled "Error: X", raw i18n keys like `pool.invite.*`, `common.nav.*`, `worldCup.*.*`).

**Exports:** interface `PageDefinition`; consts `PUBLIC_PAGES`, `AUTH_PAGES`, `ALL_PAGES`, `GLOBAL_FORBIDDEN_PATTERNS`.

**Key dependencies:** none.

**Flags:** `ALL_PAGES` and `GLOBAL_FORBIDDEN_PATTERNS` exports are not referenced by the two specs read in this batch (i18n.spec uses `PUBLIC_PAGES`) — likely consumed by other spec files outside this batch; not confirmed dead.

### frontend-next/e2e/i18n-completeness.spec.ts

**Purpose:** Node-only Playwright tests validating that ES/EN/PT message JSON files have identical structure and no empty values.

**What it does:** Reads `../src/messages/{es,en,pt}`. Helpers `getKeys` (recursive dot-notation leaf keys), `findEmptyValues`, `loadLocaleMessages` (loads each namespace JSON). Pre-loads all locale data at module eval. Tests: (1) all locales expose the same JSON file set; (2) cross-locale key parity for every ordered locale pair (with namespace-grouped diff reporting); (3) no empty-string leaf values per locale, excluding the allow-listed `dashboard.subtitle`; (4) per-namespace key parity (one granular test per file per locale pair); (5) informational key-count summary asserting all three locales have identical total key counts.

**Exports:** none (test suite).

**Key dependencies:** `@playwright/test`, Node `fs`/`path`.

**Flags:** none.

### frontend-next/e2e/i18n.spec.ts

**Purpose:** Playwright tests verifying the three locales render correctly in the browser.

**What it does:** Tests a representative subset of `PUBLIC_PAGES` (home, faq, how-it-works, pricing, wc2026-hub, wc2026-predictions). Asserts: each locale variant returns HTTP 200 with a visible `h1`; `<html lang>` equals es/en/pt on `/`, `/en`, `/pt`; home and WC2026 hub `h1` text differs between ES and EN; and no raw translation keys (regex `\b[a-z]+\.[a-z]+\.[a-zA-Z]+`) appear in ES page bodies after filtering legitimate patterns (picks4all, google.com, api., www., v0., schema.org).

**Exports:** none (test suite).

**Key dependencies:** `@playwright/test`, `./helpers/pages` (`PUBLIC_PAGES`).

**Flags:** none.
