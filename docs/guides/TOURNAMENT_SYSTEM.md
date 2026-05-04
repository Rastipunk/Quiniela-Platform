# Tournament System
# Picks4All

> **Last Updated:** 2026-05-04

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Template Data Schema](#2-template-data-schema)
3. [FIFA World Cup 2026 Structure](#3-fifa-world-cup-2026-structure)
4. [Phase Advancement](#4-phase-advancement)
5. [Placeholder System](#5-placeholder-system)
6. [Result Sync: Scraper-first + API-Football fallback](#6-result-sync-scraper-first--api-football-fallback)
7. [PendingPhaseSync: Knockout Fixture Discovery](#7-pendingphasesync-knockout-fixture-discovery)
8. [Result Publishing Flow](#8-result-publishing-flow)

---

## 1. Architecture Overview

### Entity Hierarchy

```
TournamentTemplate          (reusable definition, e.g., "FIFA World Cup")
  └── TournamentTemplateVersion   (immutable snapshot of tournament data)
        └── TournamentInstance         (playable instance, e.g., "World Cup 2026")
              └── Pool                      (user-created competition)
```

**Key principles:**

- **Templates** are reusable definitions with versioning. A template can have multiple versions.
- **Versions** contain the full tournament data (`dataJson`): teams, phases, matches. Once published, versions are immutable.
- **Instances** are created from a published version. The `dataJson` is copied at creation time and frozen. Changes to the template do not affect existing instances.
- **Pools** get their own copy of the fixture data in `fixtureSnapshot`. Phase advancement in one pool does not affect others.

### Result Source Modes

Each instance has a `resultSourceMode`:

| Mode | Description |
|------|-------------|
| `MANUAL` | Host enters results manually (legacy / amateur tournaments). |
| `AUTO` | Scraper-first pipeline (picks4all-scores primary, API-Football fallback ~30 min after estimated FT). The host can only override an existing result. |

AUTO mode instances require `apiFootballLeagueId` and `apiFootballSeasonId` to be set so the API-Football fallback can resolve fixtures.

---

## 2. Template Data Schema

Stored in `TournamentTemplateVersion.dataJson` and `TournamentInstance.dataJson`. Validated by Zod schema in `backend/src/schemas/templateData.ts`.

```typescript
{
  meta?: {
    name: string,              // "FIFA World Cup 2026"
    competition: string,       // "World Cup"
    seasonYear: number,        // 2026
    sport: "football"
  },

  teams: [
    {
      id: string,              // "mex", "usa", "t_TBD_R32_1"
      name: string,            // "Mexico"
      shortName?: string,      // "MEX"
      code?: string,           // "MEX" (ISO code)
      groupId?: string         // "A" (GROUP phase teams only)
    }
  ],

  phases: [
    {
      id: string,              // "group_stage", "round_of_32"
      name: string,            // "Group Stage"
      type: "GROUP" | "KNOCKOUT",
      order: number,           // Determines sequence (1, 2, 3...)
      config?: {
        groupsCount?: number,  // 12 (GROUP phases)
        teamsPerGroup?: number,// 4
        legs?: number          // 1 or 2 (KNOCKOUT phases)
      }
    }
  ],

  matches: [
    {
      id: string,              // "m_A_1_1", "m_R32_1"
      phaseId: string,         // References phases[].id
      kickoffUtc: string,      // ISO 8601
      homeTeamId: string,      // References teams[].id
      awayTeamId: string,
      matchNumber?: number,    // Display order
      roundLabel?: string,     // "Group A - Matchday 1"
      venue?: string,          // "Estadio Azteca"
      groupId?: string         // "A" (GROUP matches only)
    }
  ]
}
```

**Consistency validation rules:**

- No duplicate team, phase, or match IDs.
- No duplicate phase `order` values.
- All `match.phaseId` must reference an existing phase.
- All `match.homeTeamId` and `awayTeamId` must reference existing teams.
- `homeTeamId !== awayTeamId` (team cannot play itself).

---

## 3. FIFA World Cup 2026 Structure

### Overview

- **Total teams:** 48
- **Groups:** 12 (A through L), 4 teams per group
- **Total matches:** 104 (72 group + 16 R32 + 8 R16 + 4 QF + 2 SF + 2 Finals)
- **Format:** Group Stage -> Round of 32 -> Round of 16 -> Quarter-finals -> Semi-finals -> Finals

### Group Stage (72 matches)

- 12 groups, 4 teams each, round-robin (3 matches per team, 6 per group).
- From each group: 1st and 2nd advance (24 teams), plus best 8 third-place teams (8 teams) = 32 qualifiers.

**Third-place ranking criteria (FIFA official):**

1. Points (3W, 1D, 0L)
2. Goal difference
3. Goals scored
4. Fair play points (yellow/red cards)
5. Drawing of lots (manual intervention)

### Round of 32 (16 matches)

**Upper half (matches 1-8):**

| Match | Home | Away |
|-------|------|------|
| R32-1 | Winner A | 3rd from C/D/E/F |
| R32-2 | Winner C | 3rd from A/B/G/H |
| R32-3 | Winner E | 3rd from A/B/C/D |
| R32-4 | Winner G | 3rd from E/F/G/H |
| R32-5 | Winner B | 3rd from A/D/E/F |
| R32-6 | Winner D | 3rd from B/C/G/H |
| R32-7 | Winner F | 3rd from A/B/C/D |
| R32-8 | Winner H | 3rd from E/F/G/H |

**Lower half (matches 9-16):**

| Match | Home | Away |
|-------|------|------|
| R32-9 | Winner I | 3rd from J/K/L |
| R32-10 | Winner K | 3rd from I/J/K/L |
| R32-11 | Winner J | 3rd from I/K/L |
| R32-12 | Winner L | 3rd from I/J/K |
| R32-13 | Runner-up A | Runner-up B |
| R32-14 | Runner-up C | Runner-up D |
| R32-15 | Runner-up E | Runner-up F |
| R32-16 | Runner-up G | Runner-up H |

Third-place assignments depend on which groups produce the best thirds. FIFA assigns them to balance the bracket and avoid same-group rematches.

### Round of 16 (8 matches)

Winners from R32 paired sequentially:

| Match | Home | Away |
|-------|------|------|
| R16-1 | W(R32-1) | W(R32-2) |
| R16-2 | W(R32-3) | W(R32-4) |
| R16-3 | W(R32-5) | W(R32-6) |
| R16-4 | W(R32-7) | W(R32-8) |
| R16-5 | W(R32-9) | W(R32-10) |
| R16-6 | W(R32-11) | W(R32-12) |
| R16-7 | W(R32-13) | W(R32-14) |
| R16-8 | W(R32-15) | W(R32-16) |

### Quarter-finals (4 matches)

| Match | Home | Away |
|-------|------|------|
| QF-1 | W(R16-1) | W(R16-2) |
| QF-2 | W(R16-3) | W(R16-4) |
| QF-3 | W(R16-5) | W(R16-6) |
| QF-4 | W(R16-7) | W(R16-8) |

### Semi-finals (2 matches)

| Match | Home | Away |
|-------|------|------|
| SF-1 | W(QF-1) | W(QF-2) |
| SF-2 | W(QF-3) | W(QF-4) |

### Finals (2 matches)

| Match | Home | Away |
|-------|------|------|
| 3rd Place | L(SF-1) | L(SF-2) |
| Final | W(SF-1) | W(SF-2) |

### Match ID Format

| Phase | Format | Example |
|-------|--------|---------|
| Group Stage | `m_{group}_{round}_{match}` | `m_A_1_1` |
| Round of 32 | `m_R32_{n}` | `m_R32_1` through `m_R32_16` |
| Round of 16 | `m_R16_{n}` | `m_R16_1` through `m_R16_8` |
| Quarter-finals | `m_QF_{n}` | `m_QF_1` through `m_QF_4` |
| Semi-finals | `m_SF_{n}` | `m_SF_1`, `m_SF_2` |
| Finals | `m_3RD`, `m_FINAL` | - |

---

## 4. Phase Advancement

### Components

| File | Responsibility |
|------|----------------|
| `tournamentAdvancement.ts` | Pure calculation algorithms (no DB access) |
| `instanceAdvancement.ts` | Database integration layer |
| `adminInstances.ts` | API endpoints for manual advancement |

### Advancement Sequence

```
Group Stage (72 matches)
    │
    ▼  POST /admin/instances/:id/advance-to-r32
Round of 32 (16 matches)
    │
    ▼  POST /admin/instances/:id/advance-knockout
Round of 16 (8 matches)
    │
    ▼  POST /admin/instances/:id/advance-knockout
Quarter-finals (4 matches)
    │
    ▼  POST /admin/instances/:id/advance-knockout
Semi-finals (2 matches)
    │
    ▼  POST /admin/instances/:id/advance-knockout
Finals (2 matches)
```

### Group Stage -> Round of 32

1. `validateGroupStageComplete()` -- verifies all 72 group matches have results.
2. `calculateAllGroupStandings()` -- computes standings for all 12 groups using FIFA criteria.
3. `rankThirdPlaceTeams()` -- ranks all 12 third-place teams across groups, selects best 8.
4. `determineQualifiers()` -- produces the 32 qualified teams (12 winners + 12 runners-up + 8 thirds).
5. `resolvePlaceholders()` -- replaces placeholder team IDs in R32 matches with actual team IDs.
6. Updates `instance.dataJson` and all linked pool `fixtureSnapshot` records.

**Group standing criteria (FIFA):**

1. Points (3/1/0)
2. Goal difference
3. Goals scored
4. Fair play points (optional)
5. Drawing of lots (not implemented -- requires manual intervention)

### Knockout Phase Advancement

1. Verify all matches in the current phase have results (including penalty resolution for ties).
2. Determine winner of each match (regulation score, then penalties if tied).
3. Replace placeholder team IDs in the next phase's matches.
4. Update instance and pool fixture snapshots.

**Error conditions:**

- Phase incomplete: returns `ADVANCEMENT_FAILED` with list of missing results.
- Tied knockout match without penalties: returns `ADVANCEMENT_FAILED` requiring penalty data.

### Auto-Advance (Per-Pool)

Each pool has `autoAdvanceEnabled` (default `true`) and `lockedPhases` (default `[]`).

- After each result publication, the system checks if auto-advance should trigger.
- `validateCanAutoAdvance()` checks: feature enabled, phase not locked, all phase results present, no pending erratas.
- Block types: `ERRATA`, `COMPLEX_TIE`, `INCOMPLETE`, `DISABLED`.
- Auto-advance failure is logged but does NOT fail the result publication.

### Manual Advance (HOST Only)

- `POST /pools/:poolId/advance-phase` -- HOST triggers advancement for their pool.
- Validates phase completeness before proceeding.
- Useful when auto-advance is disabled or a phase was locked.

---

## 5. Placeholder System

Placeholders allow defining future matches before knowing the participating teams.

### Placeholder Formats

| Type | Format | Examples |
|------|--------|---------|
| Group winners | `W_{groupId}` | `W_A`, `W_B`, ..., `W_L` |
| Group runners-up | `RU_{groupId}` | `RU_A`, `RU_B`, ..., `RU_L` |
| Best third-place | `3rd_POOL_{n}` | `3rd_POOL_1` through `3rd_POOL_8` |
| Knockout winners | `W_{phase}_{n}` | `W_R32_1`, `W_R16_1`, `W_QF_1`, `W_SF_1` |
| Knockout losers | `L_{phase}_{n}` | `L_SF_1`, `L_SF_2` |
| TBD teams | `t_TBD*` | Generic unresolved teams |

### Resolution Flow

1. **Group stage completes** -> Group winners (`W_A`..`W_L`), runners-up (`RU_A`..`RU_L`), and ranked thirds (`3rd_POOL_1`..`3rd_POOL_8`) are resolved to actual team IDs.
2. **Each knockout round completes** -> Winners (`W_R32_1`, etc.) resolved to actual teams for the next round.
3. **Semi-finals complete** -> Winners AND losers resolved (losers needed for 3rd-place match).

### Pick Blocking

Picks are blocked on matches where either team has a placeholder prefix. The blocked prefixes are defined in `PLACEHOLDER_TEAM_PREFIXES`:

```typescript
["t_TBD", "W_", "RU_", "L_", "3rd_"]
```

Once placeholders are resolved (team IDs replaced with actual teams), picks become available for those matches.

---

## 6. Result Sync: Scraper-first + API-Football fallback

### Overview

AUTO-mode instances run two cooperating sync layers:

- **Layer 1 (primary): picks4all-scores.** `liveScoresJob` polls every 15 s during a match's live window. Publishes provisional scores as `SCRAPER_PROVISIONAL` and finalises as `API_CONFIRMED` after a 5-min grace period past full time. See `docs/guides/SCORES_INTEGRATION.md` and ADR-052.
- **Layer 2 (fallback): API-Football SmartSync.** `smartSyncJob` polls API-Football and only publishes results the scraper has not already produced. Activates ~30 min after estimated full time. The kill switch is `TournamentInstance.syncEnabled`.

The architecture below describes the API-Football fallback layer specifically; the scraper layer is documented in `SCORES_INTEGRATION.md`.

### Architecture (API-Football fallback)

```
Cron Job (every minute, gated by SMART_SYNC_ENABLED)
    │
    ▼
SmartSyncJob
    │  Finds AUTO instances with syncEnabled=true
    │
    ▼
SmartSyncService.processMatchesNeedingSync()
    │  Queries MatchSyncState for matches due for checking AND not yet
    │  finalised by the scraper (skips when current version is
    │  API_CONFIRMED or higher)
    │
    ▼
SmartSyncService.checkMatch()
    │  Calls API-Football for a single fixture
    │
    ▼
ApiFootballClient.getFixture(fixtureId)
    │  HTTP GET to v3.football.api-sports.io
    │
    ▼
SmartSyncService.publishResult()
    │  Creates PoolMatchResult + Version for ALL pools
    │  Source: API_CONFIRMED (upgrades any prior SCRAPER_PROVISIONAL)
    │  Triggers scoring, notifications, auto-advance
```

### Match Sync State Machine

```
PENDING ──> IN_PROGRESS ──> AWAITING_FINISH ──> COMPLETED
                                                  SKIPPED
```

| State | Entry Condition | API Call Trigger |
|-------|-----------------|------------------|
| `PENDING` | Match created with external mapping | `firstCheckAtUtc` reached (kickoff + 5 min) |
| `IN_PROGRESS` | API confirms match started | `finishCheckAtUtc` reached (kickoff + 110 min) |
| `AWAITING_FINISH` | Past estimated end, match not yet finished | Every 5 minutes |
| `COMPLETED` | API returns finished status (FT, AET, PEN) | Never again |
| `SKIPPED` | No external mapping exists | Never |

### Timing Windows

| Window | Duration | Purpose |
|--------|----------|---------|
| First check delay | Kickoff + 5 min | Verify match started (avoid checking before kickoff) |
| Finish check delay | Kickoff + 110 min | Estimated match end (45 + 15 HT + 45 + 5 added) |
| Awaiting finish poll | Every 5 min | Poll until result confirmed |

### PENDING Backoff Strategy

If a match does not start on time, backoff tiers reduce polling frequency:

| Time Since First Check | Poll Interval |
|------------------------|:-------------:|
| 0 - 30 min | 5 min |
| 30 min - 3 hours | 60 min |
| 3 - 10 hours | 120 min |
| 10+ hours | 24 hours |

**Efficiency:** 2-4 API calls per match (vs 20-30 with naive 5-min polling throughout).

### Match External Mapping

`MatchExternalMapping` links internal match IDs to API-Football fixture IDs:

- Unique: `(tournamentInstanceId, internalMatchId)`.
- Unique: `(tournamentInstanceId, apiFootballFixtureId)`.
- Optional verification fields: `apiFootballHomeTeamId`, `apiFootballAwayTeamId`.
- Matches without mappings are set to SKIPPED.

### Kill Switch

Set `syncEnabled = false` on the tournament instance to immediately stop all SmartSync polling. The cron job still runs but skips instances with sync disabled.

---

## 7. PendingPhaseSync: Knockout Fixture Discovery

### Problem

When a knockout phase completes, the next phase's fixtures may not be available in API-Football yet (e.g., the draw has not been made, or API-Football has not published the schedule).

### Solution

A `PendingPhaseSync` record is created with status `PENDING`. The phase sync job retries periodically.

### Phase Sync Job

- Schedule: every 12 hours (08:00 and 20:00 UTC, configurable via `PHASE_SYNC_CRON`).
- For each PENDING record:
  1. Calls `syncNextPhaseFromApi()` to check if fixtures are now available.
  2. If successful: marks as RESOLVED, updates instance data, initializes MatchSyncState records for new matches, sends admin notification.
  3. If unsuccessful: increments attempt counter.
  4. After 28 attempts (~14 days): marks as FAILED, sends admin alert for manual intervention.

### PendingPhaseSync Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting automatic resolution |
| `RESOLVED` | Successfully configured from API-Football |
| `FAILED` | Gave up after max attempts; requires manual setup |

---

## 8. Result Publishing Flow

### How a result reaches the database

A result lands in the DB through one of three writers:

1. **`liveScoresJob` (scraper)** — primary path. Publishes `SCRAPER_PROVISIONAL` during play, upgrades to `API_CONFIRMED` after the 5-min grace period. Detailed flow in `docs/guides/SCORES_INTEGRATION.md`.
2. **`smartSyncJob` (API-Football fallback)** — only fires when the scraper has not already produced an `API_CONFIRMED` (or higher) version, ~30 min after estimated full time.
3. **Host override** — `PUT /pools/:poolId/results/:matchId` with mandatory `reason`. Only allowed when a prior version already exists in AUTO mode; freely allowed in MANUAL mode. Always tagged `HOST_OVERRIDE`.

In every path the writer goes through the shared `resultService.publishResult()` helper, which:

1. Verifies the `source` is allowed to overwrite the current version (hierarchy below). On rejection it leaves the existing version intact and surfaces a typed error to the caller.
2. Parses the result fields:
   - `homeGoals`, `awayGoals` (full time)
   - `homeGoals90`, `awayGoals90` (regulation time, if extra time was played)
   - `homePenalties`, `awayPenalties` (if penalty shootout)
3. Creates a new `PoolMatchResultVersion` with monotonic `versionNumber` and the appropriate `source`. Updates `PoolMatchResult.currentVersionId`.
4. Writes for **every pool** linked to the instance — pools never get partial updates.
5. Post-publish triggers per pool: scoring recalc, email notifications (async), `advancementTrigger` check for the phase, pool-completion check.
6. Updates `MatchSyncState` to `COMPLETED` once the result is `API_CONFIRMED` or higher.

### Source hierarchy

Higher rows are never overwritten by lower ones. This is the contract every writer obeys.

| Source | Meaning | Overwritable by |
|--------|---------|------------------|
| `HOST_OVERRIDE` | Host correction (reason required, members emailed) | Nothing — terminal until another override is issued |
| `API_CONFIRMED` | Final result, from scraper-grace-period or API-Football fallback | Only `HOST_OVERRIDE` |
| `SCRAPER_PROVISIONAL` | Live in-play score from picks4all-scores | `API_CONFIRMED`, `HOST_OVERRIDE` |
| `HOST_PROVISIONAL` | Host entered in AUTO mode while waiting for sync | `SCRAPER_PROVISIONAL`, `API_CONFIRMED`, `HOST_OVERRIDE` |
| `HOST_MANUAL` | Host entered in MANUAL-mode instance | `HOST_OVERRIDE` (and other manual edits in MANUAL mode) |

### Concrete decisions

When the scraper finds a live score:
- No existing result → publishes as `SCRAPER_PROVISIONAL`.
- Existing `SCRAPER_PROVISIONAL` → replaces with new version (same source).
- Existing `HOST_PROVISIONAL` → upgrades.
- Existing `API_CONFIRMED` or `HOST_OVERRIDE` → skips.

When `smartSyncJob` finds a finished fixture:
- No existing result → publishes as `API_CONFIRMED`.
- Existing `SCRAPER_PROVISIONAL` or `HOST_PROVISIONAL` → upgrades to `API_CONFIRMED`.
- Existing `API_CONFIRMED` → skips (idempotent).
- Existing `HOST_OVERRIDE` → never overwrites.

### Host Override Flow

1. Host submits result correction on a match that has `API_CONFIRMED`.
2. System requires a mandatory `reason` (1-500 chars).
3. Frontend shows a warning explaining that overriding API data will notify all members.
4. New `PoolMatchResultVersion` created with source `HOST_OVERRIDE`.
5. Email notification sent to ALL active pool members informing them of the override and its reason.
6. SmartSync will not overwrite `HOST_OVERRIDE` results.
