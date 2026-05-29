## Audit: docs/guides/TOURNAMENT_SYSTEM.md

**Overall verdict: KEEP (minor).** This guide is in excellent shape and matches the shipped code closely. It was clearly updated for the scraper-first + API-Football fallback era (Last Updated 2026-05-04) and correctly reflects the dual-layer sync architecture (liveScoresJob scraper primary + smartSyncJob API-Football fallback), the full 5-value `ResultSource` hierarchy, the placeholder system, phase advancement endpoints, and the PendingPhaseSync job. Verified against `backend/prisma/schema.prisma`, `backend/src/schemas/templateData.ts`, `backend/src/services/resultService.ts`, `backend/src/services/smartSync/service.ts`, `backend/src/jobs/liveScoresJob.ts`, `backend/src/jobs/phaseSyncJob.ts`, `backend/src/services/instanceAdvancement.ts`, `backend/src/services/tournamentAdvancement.ts`, `backend/src/routes/adminInstances.ts`, `backend/src/routes/poolAdmin.ts`, `backend/src/routes/results.ts`, `backend/src/lib/constants.ts`, and `backend/src/scripts/seedWc2026Sandbox.ts`.

Findings below are all minor; no obsolete or materially incorrect content was found.

---

### §1 Architecture Overview — OK
Entity hierarchy (Template → Version → Instance → Pool), immutability semantics, per-pool `fixtureSnapshot`, and the `MANUAL`/`AUTO` `resultSourceMode` modes all match `schema.prisma` (`enum ResultSourceMode { MANUAL AUTO }`) and the AUTO-mode `apiFootballLeagueId`/`apiFootballSeasonId` requirement enforced by the sync jobs. Accurate.

### §2 Template Data Schema — OK, one minor omission
The documented `dataJson` shape matches `backend/src/schemas/templateData.ts` (`templateTeamSchema`, `templatePhaseSchema`, `templateMatchSchema`, `templateDataSchema`) and the consistency rules match `validateTemplateDataConsistency()`.
- **Type: missing (minor).** The schema also defines `team.apiFootballId` (`z.number().int().positive().optional()`) used to resolve API-Football team IDs, and a top-level `note` field. The doc's team object omits `apiFootballId`. Fix: add `apiFootballId?: number` to the team example and mention the optional `note`.
- Note: the doc's placeholder validation note is consistent — the schema's `isPlaceholder()` checks `W_`, `RU_`, `L_`, `3rd_` prefixes (not `t_TBD`, which is treated as a normal team id at schema-validation time but still blocks picks via `PLACEHOLDER_TEAM_PREFIXES`).

### §3 FIFA World Cup 2026 Structure — OK
48 teams / 12 groups / 104 matches and the match-ID formats (`m_A_1_1`, `m_R32_1`, `m_QF_1`, `m_3RD`, `m_FINAL`) match `seedWc2026Sandbox.ts` (verified `m_R32_${i+1}` with `phaseId: "round_of_32"`). Accurate.

### §4 Phase Advancement — OK
- Endpoints verified: `POST /admin/instances/:instanceId/advance-to-r32` and `POST /admin/instances/:instanceId/advance-knockout` exist in `adminInstances.ts` (line 190, 200); `POST /pools/:poolId/advance-phase` (HOST) exists in `poolAdmin.ts` (line 118). Accurate.
- The pure-vs-DB split (`tournamentAdvancement.ts` pure, `instanceAdvancement.ts` DB) matches the repo map.
- `autoAdvanceEnabled` default `true` and `lockedPhases` default `[]` confirmed in `schema.prisma:396,400`.
- Block types `ERRATA | COMPLEX_TIE | INCOMPLETE | DISABLED` confirmed as the `blockType` union in `instanceAdvancement.ts:23`. (Note: `COMPLEX_TIE` is declared in the type but not currently emitted by any `validateCanAutoAdvance` branch — emitted types are INCOMPLETE/DISABLED/ERRATA. Low-confidence, not worth a doc change.)
- **Type: missing (minor).** Auto-advance is not immediate: `advancementTrigger` honors `ADVANCEMENT.DELAY_MS` (default 10 min, env-configurable, defined in `lib/constants.ts`) as a window before the bracket advances. The doc's Auto-Advance section implies it fires synchronously "after each result publication". Fix: mention the ~10-minute delay window.
- **Type: incorrect (minor).** `adminInstances.ts` also exposes `POST /admin/instances/:instanceId/advance-two-legged` (line 219) for UEFA-style two-legged tie resolution (`determineTwoLeggedTieWinner` in `tournamentAdvancement.ts`). The doc's advancement-endpoints list omits it. This is a WC2026-centric doc, but since `tournamentAdvancement.ts` ships UCL two-legged logic, a one-line note would close the gap.

### §5 Placeholder System — OK
`PLACEHOLDER_TEAM_PREFIXES = ["t_TBD", "W_", "RU_", "L_", "3rd_"]` confirmed verbatim in `lib/constants.ts` and `constants.test.ts`. Placeholder formats (`W_A`, `RU_A`, `3rd_POOL_n`, `W_R32_n`, `L_SF_n`) match `resolvePlaceholders` / `resolveKnockoutPlaceholders` in `tournamentAdvancement.ts`. Accurate.

### §6 Result Sync: Scraper-first + API-Football fallback — OK
- Layer 1 (liveScoresJob, 15s poll, `SCRAPER_PROVISIONAL` → `API_CONFIRMED` after grace period) matches `jobs/liveScoresJob.ts`. The 5-min grace = `SCORES.GRACE_PERIOD_MS` (default 5 min) confirmed in `lib/constants.ts`.
- Layer 2 (smartSyncJob, gated by `SMART_SYNC_ENABLED`, ~30 min after estimated FT) matches `jobs/smartSyncJob.ts` + `smartSync/service.ts`; the 30-min gate = `SCORES.FALLBACK_DELAY_MS` (default 30 min). Accurate.
- State machine `PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED / SKIPPED` matches `enum MatchSyncStatus` (`schema.prisma:980`). Timing windows (kickoff+5, kickoff+110, every 5 min) match `MATCH_SYNC` constants and `smartSync/service.ts` (`FIRST_CHECK_DELAY_MINUTES=5`, `FINISH_CHECK_DELAY_MINUTES=110`, `AWAITING_FINISH_POLL_MINUTES=5`). PENDING backoff tiers (5/60/120/1440 min) match `PENDING_BACKOFF_TIERS`. Accurate.
- `MatchExternalMapping` unique constraints `(instanceId, internalMatchId)` and `(instanceId, apiFootballFixtureId)` plus optional `apiFootballHomeTeamId`/`apiFootballAwayTeamId` confirmed (`schema.prisma:887`). Kill switch `syncEnabled` accurate.

### §7 PendingPhaseSync — OK
Twice-daily schedule (`0 8,20 * * *`, `PHASE_SYNC_CRON`), `syncNextPhaseFromApi()` retry, RESOLVED on success, FAILED after 28 attempts (~14 days) all confirmed in `jobs/phaseSyncJob.ts`. Status values `PENDING | RESOLVED | FAILED` match `enum PhaseSyncStatus` (`schema.prisma:1017`). Accurate. (The model also runs `smartSync.verifyUpcomingFixtures()` for pre-kickoff drift detection in the same job — out of scope for this section, not a defect.)

### §8 Result Publishing Flow — OK
- Three writers (liveScoresJob, smartSyncJob, host override) confirmed.
- Host override endpoint `PUT /pools/:poolId/results/:matchId` confirmed in `results.ts:83` (HOST/CO_ADMIN/CORPORATE_HOST). Mandatory `reason` enforced in `resultService.publishResult()` (`REASON_REQUIRED_FOR_OVERRIDE`). AUTO-mode requires a prior version (`RESULT_NOT_YET_AVAILABLE`), MANUAL allows direct publish — both match `resultService.ts:129-148`.
- **Type: incorrect (minor).** The source-hierarchy table claims `HOST_MANUAL` is "Overwritable by `HOST_OVERRIDE` (and other manual edits in MANUAL mode)". In `resultService.ts`, MANUAL-mode re-publish always becomes `HOST_OVERRIDE` once a version exists (`source = last ? "HOST_OVERRIDE" : "HOST_MANUAL"`), so subsequent MANUAL edits are tagged `HOST_OVERRIDE`, never `HOST_MANUAL` again. The wording "other manual edits in MANUAL mode" is slightly misleading. Fix: clarify that the first MANUAL publish is `HOST_MANUAL` and every subsequent edit (MANUAL mode) is `HOST_OVERRIDE`.
- All 5 `ResultSource` enum values (`HOST_MANUAL`, `HOST_PROVISIONAL`, `API_CONFIRMED`, `HOST_OVERRIDE`, `SCRAPER_PROVISIONAL`) exist in `schema.prisma:284`. The scraper/smartSync overwrite decision tables match `liveScoresJob.publishScraperResult` and `smartSync.publishResult` (skip on `API_CONFIRMED`/`HOST_OVERRIDE`, upgrade from `HOST_PROVISIONAL`/`SCRAPER_PROVISIONAL`). Accurate.

### Cross-doc duplication — acceptable
The scraper-layer details overlap with `docs/guides/SCORES_INTEGRATION.md`, but the doc explicitly delegates Layer-1 detail to that file ("documented in SCORES_INTEGRATION.md") and only summarizes here. No contradictory duplication found.
