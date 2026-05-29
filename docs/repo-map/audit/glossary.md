## Audit: docs/GLOSSARY.md

**Overall verdict: KEEP (minor fixes).** Severity: **minor**.

This glossary was clearly refreshed for the current production code. It correctly documents
the dual-gateway payment system (Polar + Mercado Pago), the scraper-first AUTO-mode results
pipeline (picks4all-scores primary, API-Football fallback), `EmailSuppression`, the analytics
DLQ (`FailedAnalyticsEvent` / `capiRetryJob`), Meta CAPI / GA4 MP, the locale resolution model,
the corporate flow, ban vs kick semantics, and the `PoolMember.status` join/approval workflow.
Verified against `backend/prisma/schema.prisma`, `lib/jwt.ts`, `lib/constants.ts`,
`lib/pickPresets.ts`, `lib/scoringPresets.ts`, `types/pickConfig.ts`, `routes/payments.ts`,
`routes/picks.ts`, `services/pickService.ts`, `server.ts`, `routes/corporate.ts`,
`routes/results.ts`, `routes/poolInvites.ts`, `routes/poolMembers.ts`.

The remaining problems are concentrated in **Predictions & Scoring**, where the doc mixes the
legacy single-key scoring system with the advanced per-phase pick-types system and uses an
obsolete config shape / pick-type name in two examples — the very name the doc elsewhere flags
as never having existed.

---

### Finding 1 — "Pick Rules" uses a config shape and a pick type that do not exist (incorrect / obsolete)

Section: **Predictions & Scoring → Pick Rules** (lines ~504-523).

The doc presents pool scoring config as:
```json
{ "activePickTypes": ["EXACT_SCORE", "MATCH_OUTCOME"], "pointsMap": { ... } }
```
Neither `activePickTypes` nor `pointsMap` exists anywhere in the codebase. The real shape
(`backend/src/types/pickConfig.ts`, stored in `Pool.pickTypesConfig`) is a `PoolPickTypesConfig`
= array of `PhasePickConfig`, each with `requiresScore` plus either `matchPicks.types[]`
(`{ key, enabled, points }`) or `structuralPicks`. Worse, the example uses `MATCH_OUTCOME` —
a type the same glossary's Pick Type section (line 461) explicitly says "never existed in the
engine." The real key is `MATCH_OUTCOME_90MIN`.

Fix: Replace the `activePickTypes`/`pointsMap` JSON with a real `PhasePickConfig` snippet (e.g.
a `group_stage` phase with `matchPicks.types` enabling `MATCH_OUTCOME_90MIN` and `EXACT_SCORE`),
and reference `Pool.pickTypesConfig` + `types/pickConfig.ts`. Remove every `MATCH_OUTCOME`
occurrence.

---

### Finding 2 — "Scoring Preset" table conflates two systems and omits the legacy keys (incorrect / missing)

Section: **Predictions & Scoring → Scoring Preset** (lines ~487-501).

The table lists presets as **CUMULATIVE / BASIC / SIMPLE / CUSTOM** and describes them as the
scoring system. In reality there are TWO independent systems:
- Legacy single-key system in `lib/scoringPresets.ts`: keys **CLASSIC** (default), **OUTCOME_ONLY**,
  **EXACT_HEAVY**. This is what `Pool.scoringPresetKey` stores (schema default `"CLASSIC"`).
- Advanced per-phase pick-types system in `lib/pickPresets.ts`: `getAllPresets()` returns only
  **CUMULATIVE, BASIC, SIMPLE** (no CUSTOM config object). `CUSTOM` exists only as a member of the
  `PickConfigPresetKey` type union (host-defined config), not as a shipped preset.

The doc's descriptions are also wrong: BASIC is described as "Outcome points + exact score bonus"
but the real BASIC preset is exact-score-only with auto-scaling (20→80 pts); SIMPLE is described
as "Outcome-only scoring" but the real SIMPLE preset is structural (GROUP_STANDINGS +
KNOCKOUT_WINNER, no scores at all).

Fix: Split into two subsections. (a) Legacy scoring presets: CLASSIC / OUTCOME_ONLY / EXACT_HEAVY
with their `outcomePoints` / `exactScoreBonus` values from `scoringPresets.ts`, noting
`Pool.scoringPresetKey` defaults to `CLASSIC`. (b) Advanced pick-type presets: CUMULATIVE / BASIC /
SIMPLE with the real descriptions from `pickPresets.ts`; note CUSTOM is a host-defined config, not
a packaged preset.

---

### Finding 3 — "Exact Score" validation uses wrong field names (incorrect, low impact)

Section: **Predictions & Scoring → Exact Score** (lines ~527-535) and **Outcome** (lines ~476-481).

The validation snippet uses `pick.homeGoals === result.homeGoals`. Predictions are stored in a
single flexible `Prediction.pickJson` JSON column (schema line 572); there are no top-level
`homeGoals`/`awayGoals` scalar fields on the prediction. The `Outcome` calc snippet is fine
conceptually. The "3pts (outcome) + 2pts (bonus)" example matches the legacy CLASSIC preset only.

Fix: Phrase the comparison in terms of `pickJson` (e.g. `pick.home`/`pick.away` parsed from
`pickJson` vs the published result's `homeGoals`/`awayGoals` on `PoolMatchResultVersion`), and
note the 3+2 example is specific to the CLASSIC legacy preset.

---

### Finding 4 — Verified-accurate sections (ok)

The following were checked and match the code exactly — no change needed:
- **Pick Type** table: all 7 keys (`EXACT_SCORE`, `GOAL_DIFFERENCE`, `MATCH_OUTCOME_90MIN`,
  `HOME_GOALS`, `AWAY_GOALS`, `PARTIAL_SCORE`, `TOTAL_GOALS`) match `MatchPickTypeKey` and
  `pickPresets.ts`. The "MATCH_OUTCOME / BOTH_TEAMS_SCORE / WINNING_MARGIN never existed" note is
  correct.
- **JWT**: 4h expiry (`jwt.ts` `expiresIn: "4h"`), HS256, payload `{ userId, platformRole }` —
  all correct.
- **Invite Code**: `crypto.randomBytes(6)` → 12 hex chars; `CRYPTO_BYTES.POOL_INVITE_CODE = 6`
  confirmed.
- **Activation Token**: `CRYPTO_BYTES.TOKEN = 32` → 64-char hex; 30-day expiry
  (`TOKEN_EXPIRY_MS.CORPORATE_INVITE = 30 * MS.DAY`); resend at
  `POST /corporate/pools/:poolId/employees/:inviteId/resend`; link path `/activar-cuenta?token=...`
  (matches `app/[locale]/activar-cuenta/page.tsx` — note the user-memory's `/activar` is the
  stale value; the glossary is right).
- **Deadline**: default 10 min (schema `deadlineMinutesBeforeKickoff @default(10)`, range 0-1440);
  `409 DEADLINE_PASSED` confirmed in `pickService.ts`.
- **Ban / Kick**: `403 BANNED_FROM_POOL` (`poolInvites.ts`), kick endpoint
  `POST /pools/:poolId/members/:memberId/kick` (`poolMembers.ts`), `banExpiresAt` always-null /
  permanent — all correct.
- **Join Approval**: "no separate PoolMemberRequest table; uses PoolMember.status" — correct.
- **Leaderboard verbose**: `GET /pools/:poolId/leaderboard?verbose=1` confirmed (`results.ts:191`,
  `verbose === "1" || "true"`).
- **Payment webhooks**: `POST /payments/webhook` (raw body before JSON parser),
  `POST /payments/mp-webhook`, `POST /webhooks/resend` — all confirmed in `server.ts`.
- **picks4all-scores / API-Football / Smart Sync / Scraper-First**: `ResultSource` hierarchy
  (`HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL`),
  `scoresServiceEnabled` toggle, `MatchSyncStatus` state machine, 5-min grace / 30-min fallback
  (`SCORES.GRACE_PERIOD_MS` / `FALLBACK_DELAY_MS`) — all match `constants.ts` + schema.
- **EmailSuppression / DLQ / GA4 MP / Meta CAPI / Mercado Pago / Polar / CF-IPCountry** — all
  consistent with schema models and route mounts.

---

### Note — Header inconsistency (minor)

The "Table of Contents" (line 12-21) does not list the "Domain-Specific Slang" section that
actually exists at line 1041. Add it for completeness. Also "Last Updated: 2026-05-03" predates
some content it correctly describes; bump to current.
