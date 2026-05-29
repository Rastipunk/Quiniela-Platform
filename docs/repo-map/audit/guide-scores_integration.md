## Audit: docs/guides/SCORES_INTEGRATION.md

**Overall verdict: keep (minor fixes).** This guide is one of the most accurate docs in the repo. Every architectural claim, env var, default, source-priority value, state name, and file path was verified against the shipped code and matches. Two small issues only: one spurious/misleading "Key Files" entry, and an omitted `SKIPPED` state in the state-machine table.

### Verified accurate (no change needed)
- **Architecture / Data Flow**: `fixtureTrackingJob` (hourly node-cron, `POST /api/v1/track`, dedup via `trackedAtUtc`, admin email on failure via `sendAdminNotification`) — confirmed in `backend/src/jobs/fixtureTrackingJob.ts`.
- **Live polling**: `liveScoresJob` via `setInterval(POLL_INTERVAL_MS)`, window `0h pre + 5min buffer / 3h post`, `GET /api/v1/scores/live`, MEDIUM min confidence, publishes `SCRAPER_PROVISIONAL`, skips when `API_CONFIRMED`/`HOST_OVERRIDE` exist — confirmed in `backend/src/jobs/liveScoresJob.ts`.
- **Grace period (5 min) + `finalizeResult` → API_CONFIRMED**: confirmed; `SCORES.GRACE_PERIOD_MS` default `5 * 60_000` in `backend/src/lib/constants.ts`. Score-change-resets-grace logic confirmed (`newGraceEndUtc = null`).
- **SmartSync fallback gate**: `if (matchState.syncStatus === "COMPLETED") continue;` and `now < estimatedEnd + SCORES.FALLBACK_DELAY_MS` (kickoff + 110min + 30min) — confirmed in `backend/src/services/smartSync/service.ts`. `SCORES.FALLBACK_DELAY_MS` default `30 * 60_000`.
- **Source hierarchy**: all five `ResultSource` enum values (`HOST_OVERRIDE`, `API_CONFIRMED`, `SCRAPER_PROVISIONAL`, `HOST_PROVISIONAL`, `HOST_MANUAL`) exist exactly as listed — `backend/prisma/schema.prisma:284-289`.
- **Environment Variables table**: every variable name and default matches the code (`scoresService/client.ts`, `liveScoresJob.ts`, `fixtureTrackingJob.ts`, `constants.ts`). `SCORES_SERVICE_TIMEOUT_MS=10000`, `SCORES_POLL_INTERVAL_MS=15000`, `SCORES_WINDOW_PRE_HOURS=0`, `SCORES_WINDOW_PRE_MINUTES=5`, `SCORES_WINDOW_POST_HOURS=3`, `SCORES_TRACK_WINDOW_HOURS=24`, `FIXTURE_TRACKING_CRON=0 * * * *` — all confirmed.
- **Admin controls**: `PlatformSettings.scoresServiceEnabled` checked at top of both jobs; per-instance `syncEnabled` + `resultSourceMode: AUTO` — confirmed.
- **Frontend integration**: `poolOverviewService.ts` returns `elapsed`, `matchStatus`, `isLive` per match (`isLive = ["IN_PROGRESS","AWAITING_FINISH"].includes(syncStatus)`); `useLiveRefresh` polls every 15s when any match `isLive`; `MatchCard.tsx` renders the live state from `m.isLive`/`m.elapsed` — confirmed.

### Finding 1 — Key Files table: spurious `analytics.ts` entry
- **Section:** Key Files
- **Type:** incorrect
- **Detail:** The table lists `frontend-next/src/lib/analytics.ts | Event tracking utility`. This file has nothing to do with scores integration — no scores/live-refresh code imports it, and the doc never references analytics anywhere else. It appears to be a copy/paste leftover.
- **Fix:** Remove the `analytics.ts` row. Optionally replace it with files that ARE load-bearing for this subsystem but are missing from the table, e.g. `backend/src/services/scoresService/client.ts` is listed but the actual published-result plumbing also lives in `backend/src/services/poolStateMachine.ts` (`transitionToCompleted`), `backend/src/services/advancementTrigger.ts` (`checkAndTriggerAdvancement`), and `backend/src/services/structuralAutoPublish.ts` (`autoPublishStructuralResults`) — all invoked from `liveScoresJob.finalizeResult`.

### Finding 2 — State machine omits the SKIPPED state
- **Section:** MatchSyncState Machine
- **Type:** missing
- **Detail:** `MatchSyncStatus` includes a `SKIPPED` state (used by SmartSync when a match has no API-Football mapping — `service.ts` sets `syncStatus: "SKIPPED"`, and `getSyncStatus` counts it). The doc's table lists only PENDING / IN_PROGRESS / AWAITING_FINISH / COMPLETED.
- **Fix:** Add a SKIPPED row: "No API-Football mapping (unmappable match) — never polled." Note this state is set by SmartSync, not the scraper path.

### Finding 3 — finalizeResult side effects not documented
- **Section:** Match End: Grace Period (step 3) / Source Hierarchy
- **Type:** missing
- **Detail:** When `finalizeResult` upgrades to `API_CONFIRMED`, it also fires (fire-and-forget) `autoPublishStructuralResults` (derives FIFA group table / knockout winner for Estratega pools), `checkAndTriggerAdvancement` (10-min advancement window), and `transitionToCompleted` (moves AUTO-mode pools from ACTIVE→COMPLETED once the last match finalizes). `publishScraperResult` also calls `transitionToCompleted` on every finished publish. The doc presents finalization as purely a version upgrade and omits these downstream effects, which are a material part of the integration's behavior.
- **Fix:** Add a sentence to step 3 noting that finalization (and finished provisional publishes) trigger structural auto-publish, phase-advancement checks, and pool-completion transition — all idempotent and fire-and-forget.
