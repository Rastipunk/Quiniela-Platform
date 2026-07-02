# Scores Integration — picks4all-scores

> Live scoring system for real-time match updates.
>
> **Last Updated:** 2026-06-02 — scraper-first decision in ADR-052; the
> v2 contract (monotonic state machine, `timeline[]`, fail-closed auth,
> timeline-derived scoring, stale detection) in ADR-068.

## Contract v2 (ADR-068)

The scores service guarantees a **monotonic** match state machine: a match
never regresses to an earlier state, and a terminal state
(`FT`/`AET`/`PEN`/`ABD`) is final. Consequences for this integration:

- **`fulltime*` / `halftime*` / `extratime*` are always `null`.** The
  minute-90 / end-of-regulation score is derived from the `timeline[]`
  (see [§Minute-90 derivation](#minute-90-derivation)).
- **`timeline[]`** is an append-only list of confirmed milestones
  (`1H`/`HT`/`2H`/`ET`/`BT`/`P`/`PEN`/`FT`/`AET`/`ABD`), each with a
  `confirmedBy[]` source list. It is the source of truth for period scores
  and the confirmation gate.
- **The scraper never closes a match by time** (by design) — closing by
  age is our responsibility (fallback + stale detector below).
- **Penalties** are separate (`penaltyHome`/`penaltyAway`); terminal
  status `PEN`, live `P`. Penalties NEVER count toward goals90.
- **Auth is fail-closed:** the client raises `ScoresServiceError` with
  `isUnavailable` (503), `isAuthError` (401/403), `isRateLimited` (429,
  honouring `Retry-After`).
- **Source counts are dynamic** (`sourcesAgreeing`/`sourcesTotal`,
  `confirmedBy[]`) — never hardcoded.

## Architecture

picks4all-scores is an independent scraping service that monitors football matches from multiple sources with cross-validation. Picks4All consumes it as the **primary** scoring source.

```
picks4all-scores service (Railway)
    ↓ HTTP API
Picks4All Backend
    ├── fixtureTrackingJob (hourly) → registers fixtures for tracking
    ├── liveScoresJob (every 15s) → polls live scores during matches
    └── smartSyncJob (fallback) → API-Football if scraper fails
```

## Data Flow

### 1. Pre-Match: Fixture Registration (24h before)
- `fixtureTrackingJob` runs hourly via node-cron
- Queries all ACTIVE instances with `resultSourceMode: AUTO` and `syncEnabled: true`
- Sends fixtures with kickoff in next 24h to `POST /api/v1/track`
- Deduplicates: skips fixtures already tracked (`trackedAtUtc` is set)
- On failure: sends admin email via `sendAdminNotification()`

### 2. During Match: Live Polling (every 15s)
- `liveScoresJob` runs via setInterval (15,000ms)
- Only polls matches whose kickoff has ALREADY passed (window: 0h pre + 5min buffer, 3h post)
- Fetches `GET /api/v1/scores/live` from scraper service
- Filters by confidence (minimum: MEDIUM by default)
- For each match with sufficient confidence:
  - Updates `MatchSyncState`: status, lastApiStatus, lastElapsed, lastLiveDataJson
  - Publishes `SCRAPER_PROVISIONAL` result to all pools via `PoolMatchResultVersion`
  - Skips if `API_CONFIRMED` or `HOST_OVERRIDE` already exists

### 3. Match End: Finalization Gate (ADR-086) + Grace Period (5 minutes)
- When scraper reports a terminal status (`FT`/`AET`/`PEN`/`ABD`):
  - **Finalization gate** (`finalizationGate.ts`): the backend trusts the
    scraper's consensus `confidence` — it never counts sources (that is the
    scraper terminal gate's job). FAST path = minute plausible
    (≥ `SCORES_MIN_ELAPSED_FOR_TERMINAL`, ABD exempt) + confidence
    HIGH/VERY_HIGH. SLOW path (anti-deadlock) = plausible + confidence
    MEDIUM + ≥ `SCORES_SLOW_PATH_AFTER_MS` since kickoff → finalizes with a
    one-time R9 admin alert. Anything else stays `AWAITING_FINISH` (the
    stale + feed-silent detectors are the backstops — there is NO
    API-Football fallback).
  - Once confirmed: sets `graceEndUtc = now + 5min`, `syncStatus = AWAITING_FINISH`
  - Continues polling during grace period
  - If score changes during grace → resets grace timer
  - After grace expires with stable score → `finalizeResult()`:
    - Creates new `PoolMatchResultVersion` with `source: API_CONFIRMED`
    - Sets `syncStatus = COMPLETED`, stops polling this match
    - Fires (fire-and-forget, all idempotent) `autoPublishStructuralResults()` (derives the FIFA group table / knockout winner for Estratega pools), `checkAndTriggerAdvancement()` (opens the 10-min phase-advancement window), and `transitionToCompleted()` (moves AUTO-mode pools ACTIVE→COMPLETED once the last match finalizes)
- Every finished provisional publish (`publishScraperResult` with FT) also calls `transitionToCompleted()` — the same idempotent pool-completion check, so completion is not lost if the finalization path is missed

### 4. Fallback: API-Football (30 min after estimated FT)
- SmartSync checks if scraper already finalized each match
- Skips if `syncStatus === COMPLETED` (scraper handled it)
- Only calls API-Football if `now > kickoffUtc + 110min + 30min` and no result exists
- Publishes as `API_CONFIRMED` if scraper failed

### Minute-90 derivation

Because `fulltime*`/`extratime*` are always `null`, `homeGoals90`/`awayGoals90`
are derived from `timeline[]` by `deriveNinetyMinuteScore()`
(`scoresService/timeline.ts`):

- The score at the **`ET` milestone** = the regulation score with which the
  match entered extra time = the minute-90 score. A 1-1 that goes to
  penalties has `ET` = 1-1, so `goals90 = 1-1` while `penalties = 4-3`.
- If the match never went to extra time, there is no separate 90' score —
  `homeGoals90/awayGoals90` are `null` and `homeGoals/awayGoals` already
  represent regulation. Phases with `includeExtraTime=false` then score off
  `goals90 ?? homeGoals`.
- If ET was reached but the `ET` milestone is missing (incomplete feed),
  `goals90` stays `null` rather than inventing a value.

This matters only for **single matches that go to extra time** (the final,
any one-leg knockout). Two-leg ties (r32–sf) are 90' only, so `goals90=null`
is harmless there.

### Stale detection (safety net)

Since the scraper never closes by time, `staleDetector.ts` scans (throttled,
every `SCORES_STALE_SCAN_INTERVAL_MS`, default 5 min) for AUTO-mode matches
whose `MatchSyncState` is still not `COMPLETED` more than
`SCORES_STALE_THRESHOLD_MS` (default 210 min) after kickoff. Each such match
triggers a **one-time** admin alert (idempotent via a `MATCH_STALE_DETECTED`
audit event). It runs even when the scraper is unavailable. This is the
safety net that the 30-may final lacked (the result sat `SCRAPER_PROVISIONAL`
forever with nobody alerted — see `SCORING_RESULTS_AUDIT.md`).

A companion safeguard in `structuralAutoPublish.ts` alerts (once) when a
knockout match has an **authoritative** result but no derivable winner — a
draw with no penalties, or penalties tied — so the host can override instead
of the bracket waiting forever.

## Source Hierarchy

```
HOST_OVERRIDE        → Highest priority, never overwritten
API_CONFIRMED        → Official/finalized result
SCRAPER_PROVISIONAL  → Live score during match, upgradeable
HOST_PROVISIONAL     → Host entered in AUTO mode, replaceable
HOST_MANUAL          → Host entered in MANUAL mode, replaceable
```

## MatchSyncState Machine

```
PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
                ↑ (score changes during grace reset to IN_PROGRESS)
```

| State | Meaning | Polling |
|---|---|---|
| PENDING | Before kickoff, fixture registered | No |
| IN_PROGRESS | Match started, live data flowing | Every 15s |
| AWAITING_FINISH | FT detected, grace period | Every 15s |
| COMPLETED | Result finalized | Stopped |
| SKIPPED | No API-Football mapping (unmappable match) or MANUAL mode | Never polled |

`SKIPPED` is set by SmartSync (not the scraper path) when a match has no API-Football mapping or the instance is in MANUAL mode.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SCORES_SERVICE_URL` | (required) | Base URL of picks4all-scores service |
| `SCORES_SERVICE_API_KEY` | (required) | Bearer token for authentication |
| `SCORES_SERVICE_TIMEOUT_MS` | 10000 | HTTP request timeout |
| `SCORES_POLL_INTERVAL_MS` | 15000 | Live scores polling interval |
| `SCORES_MIN_CONFIDENCE` | MEDIUM | Minimum confidence to publish |
| `SCORES_WINDOW_PRE_HOURS` | 0 | Hours before kickoff to start polling |
| `SCORES_WINDOW_PRE_MINUTES` | 5 | Minutes buffer for early kickoffs |
| `SCORES_WINDOW_POST_HOURS` | 3 | Hours after kickoff to keep polling |
| `SCORES_TRACK_WINDOW_HOURS` | 24 | Hours ahead to register fixtures |
| `SCORES_GRACE_PERIOD_MS` | 300000 | Grace period after FT (5 min) |
| `SCORES_FALLBACK_DELAY_MS` | 1800000 | Delay before API-Football fallback (30 min) |
| `SCORES_SLOW_PATH_AFTER_MS` | 9000000 | SLOW path: MEDIUM confidence may finalize this long after kickoff (150 min) |
| `SCORES_FEED_SILENT_AFTER_KICKOFF_MS` | 900000 | R14 feed-silent alert: min after kickoff (15 min) |
| `SCORES_FEED_SILENT_STALE_MS` | 600000 | R14: staleness of lastCheckedAtUtc to count as silent (10 min) |
| `SCORES_STALE_THRESHOLD_MS` | 12600000 | Age after kickoff a non-finalized match is "stale" (210 min) |
| `SCORES_STALE_SCAN_INTERVAL_MS` | 300000 | Stale-detector scan cadence (5 min) |
| `FIXTURE_TRACKING_CRON` | `0 * * * *` | Fixture registration cron schedule |

## Admin Controls

- `PlatformSettings.scoresServiceEnabled` — Global toggle (DB, not env var). If false, both liveScoresJob and fixtureTrackingJob skip execution.
- Per-instance: `syncEnabled` + `resultSourceMode: AUTO` must both be true.

## Frontend Integration

- `useLiveRefresh` hook auto-polls pool overview every 15s when any match has `isLive: true`
- MatchCard shows "🔴 En juego 45'" with elapsed minute from scraper
- No "Provisional" label — during match it's "En juego", after finalization it's the published result
- Pool overview API returns `elapsed`, `matchStatus`, and `isLive` per match

## Key Files

| File | Purpose |
|---|---|
| `backend/src/services/scoresService/client.ts` | HTTP client for picks4all-scores (+ `ScoresServiceError`, `timeline[]`) |
| `backend/src/services/scoresService/timeline.ts` | Derive minute-90 score + count terminal confirmations from `timeline[]` |
| `backend/src/services/scoresService/staleDetector.ts` | Stale-match scan + one-time admin alert |
| `backend/src/jobs/liveScoresJob.ts` | Live polling + confirmation gate + grace period + finalization |
| `backend/src/jobs/fixtureTrackingJob.ts` | Hourly fixture registration |
| `backend/src/services/smartSync/service.ts` | API-Football fallback (gated) |
| `backend/src/services/poolOverviewService.ts` | Returns live data to frontend |
| `backend/src/services/structuralAutoPublish.ts` | Derives Estratega group tables / knockout winners on finalization (`autoPublishStructuralResults`) |
| `backend/src/services/advancementTrigger.ts` | Phase-advancement check on finalization (`checkAndTriggerAdvancement`) |
| `backend/src/services/poolStateMachine.ts` | Moves AUTO-mode pools ACTIVE→COMPLETED (`transitionToCompleted`) |
| `frontend-next/src/hooks/useLiveRefresh.ts` | Auto-refresh when matches are live |
