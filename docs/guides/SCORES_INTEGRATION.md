# Scores Integration — picks4all-scores

> Live scoring system for real-time match updates.

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

### 3. Match End: Grace Period (5 minutes)
- When scraper reports FT/AET/PEN:
  - Sets `graceEndUtc = now + 5min`, `syncStatus = AWAITING_FINISH`
  - Continues polling during grace period
  - If score changes during grace → resets grace timer
  - After grace expires with stable score → `finalizeResult()`:
    - Creates new `PoolMatchResultVersion` with `source: API_CONFIRMED`
    - Sets `syncStatus = COMPLETED`, stops polling this match

### 4. Fallback: API-Football (30 min after estimated FT)
- SmartSync checks if scraper already finalized each match
- Skips if `syncStatus === COMPLETED` (scraper handled it)
- Only calls API-Football if `now > kickoffUtc + 110min + 30min` and no result exists
- Publishes as `API_CONFIRMED` if scraper failed

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
| `backend/src/services/scoresService/client.ts` | HTTP client for picks4all-scores |
| `backend/src/jobs/liveScoresJob.ts` | Live polling + grace period + finalization |
| `backend/src/jobs/fixtureTrackingJob.ts` | Hourly fixture registration |
| `backend/src/services/smartSync/service.ts` | API-Football fallback (gated) |
| `backend/src/services/poolOverviewService.ts` | Returns live data to frontend |
| `frontend-next/src/hooks/useLiveRefresh.ts` | Auto-refresh when matches are live |
| `frontend-next/src/lib/analytics.ts` | Event tracking utility |
