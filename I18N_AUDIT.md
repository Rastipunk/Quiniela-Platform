# Pool Authenticated Zone — i18n Audit & Diagnostic

> **Status:** in progress
> **Started:** 2026-05-21
> **Trigger:** user observed (locale=`en`, screenshot in chat) that the pool page leaked Spanish strings — tournament instance name `[TEST] Estratega Simulation WC2026`, team names (`México`, `Sudáfrica`, `Corea del Sur`, `República Checa`), phase labels (`Grupo A - Jornada 1`), `6 partidos`, and date format `11 jun 2026, 14:00`.
>
> **Goal:** Map every line of code (and every DB column) that renders user-visible text in the authenticated pool experience, document where each fails i18n, and produce a numbered list of bugs/gaps. Resolve them one at a time after the audit.
>
> **Scope (approved):** Entire authenticated pool zone — `matches`, `leaderboard`, `my-summary`, `rules`, `admin` (capacity, players, rules edit). Tournament/template/team/phase data is shared across these views so we audit the data layer once and the rendering layers per-tab.
>
> **Method:** No assumptions. Every claim in this document is backed by a file path + line number, or a verified DB query. Inferred behavior is tagged `[INFERRED — verify]`.

---

## 0 — Scope

User-visible text on the pool authenticated zone comes from four origins:

1. **i18n message catalogs** — `frontend-next/src/messages/{es,en,pt}/*.json`. Resolved via `useTranslations()` + `t()`. Locale-aware by design.
2. **DB data** — `TournamentInstance.dataJson`, `Team.name`, `Phase.name`, etc. Single-string columns today (no per-locale variants). These render verbatim regardless of UI locale.
3. **Computed strings** — date/time formatters (`Intl.DateTimeFormat`, `toLocaleDateString`), numbers, plural strings. Locale-aware if the caller passes the right locale; not otherwise.
4. **Hardcoded strings in TSX** — strings that should be `t()` but aren't. Always leak the developer's original-language wording.

The bug pattern is: (2) and (4) leak Spanish into a non-Spanish UI; (3) leaks Spanish if the locale isn't threaded through. (1) by definition cannot leak — if it's `t()`'d, it translates.

---

## 0.5 — Resolved during the parallel WC2026 instance investigation

The original screenshot showed `[TEST] Estratega Simulation WC2026` as the pool subtitle. That string was traced to `TournamentInstance.name` on instance B (testing artefact), not to an i18n bug. Resolved in the WC2026 migration (2026-05-22, see `WC2026_MIGRATION_PLAN.md`). 63 pools migrated to the production instance whose `name` = "World Cup 2026". Out of scope for the rest of this i18n audit, but referenced here so the original report has a status entry.

Note on i18n debt the subtitle still carries: even after the migration, `TournamentInstance.name` is a **single-locale string** ("World Cup 2026" is identical in EN; in PT it should be "Copa do Mundo 2026"; in ES "Copa Mundial 2026" is more idiomatic than the English form). Tournament/instance/template name i18n is `F-name-locale` in §3.

---

## 1 — File inventory

> Method: grep for the strings in the screenshot ("Grupo A", "Jornada 1", "partidos"), grep for `useTranslations`, grep for `fixtureSnapshot.*phases`, grep for the team name strings. List every artifact that contributed text to the screenshot.

### Database — single-string columns whose values reach the UI verbatim

| Table | Column | Current shape | i18n status |
|---|---|---|---|
| `TournamentInstance` | `name` | `String` | single-locale (today "World Cup 2026") |
| `TournamentTemplate` | `name`, `description` | `String?` | single-locale |
| `TournamentInstance.dataJson` | `meta.name`, `meta.competition` | nested string | single-locale, copied from template |
| `TournamentInstance.dataJson` | `phases[].name` | per-phase string | single-locale (today: "Fase de Grupos", "Dieciseisavos de Final", ...) |
| `TournamentInstance.dataJson` | `teams[].name` | per-team string | single-locale (today: "México", "Sudáfrica", "Corea del Sur", ...) |
| `TournamentInstance.dataJson` | `matches[].roundLabel` | per-match string | single-locale (today: "Grupo A - Jornada 1", "R32 - 2A vs 2B", ...) |
| `TournamentInstance.dataJson` | `matches[].venue` | per-match string | single-locale (e.g. "Estadio Azteca", "SoFi Stadium" — proper nouns mostly i18n-safe) |
| `TournamentInstance.dataJson` | `groups[]` | group identifiers (`A`, `B`, `C`, ...) | locale-safe (letters/numbers) |
| `Pool` | `name`, `description` | `String` / `String?` | user-authored; out of scope for i18n |
| `Team` (if used directly) | `name`, `displayName` | TBD | TBD (need to verify if `Team` table actually carries names) |

### Backend — routes / services that serve pool data

| File | Role |
|---|---|
| `backend/src/routes/pools.ts` | `GET /pools/:id/overview` and its sub-routes. Returns pool + tournamentInstance + fixtureSnapshot blob. |
| `backend/src/routes/catalog.ts` | `GET /catalog/instances` — list of available tournaments. |
| `backend/src/routes/leaderboard.ts` | leaderboard snapshot. |
| `backend/src/routes/picks.ts` | match-pick CRUD. |
| `backend/src/routes/structuralPicks.ts` | knockout-winner picks (Estratega). |
| `backend/src/routes/groupStandings.ts` | group-standings predictions (Estratega). |
| `backend/src/routes/playerSummary.ts` | "My Summary" tab data. |
| `backend/src/services/poolOverviewService.ts` | builds the pool-overview payload. |
| `backend/src/services/playerSummaryService.ts` | builds the my-summary payload. |
| `backend/src/lib/fixture.ts` | `extractPhases`, `extractMatches` — single source of how `dataJson` is unpacked. |
| `backend/src/lib/constants.ts` | `PHASE_LABELS_BY_KEY` — locale dictionary for canonical phase identifiers (`group_stage`, `round_of_32`, etc.). |

### Frontend — authenticated pool pages

| File | Role |
|---|---|
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx` | Pool page shell — title, subtitle, status badge, tab navigation. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx` | Matches tab with phase filters + group headers ("Group A", "6 partidos"). |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolLeaderboardTab.tsx` | Leaderboard tab. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MyPredictionsTab.tsx` (or similar) | "My Summary" / "My Picks" tab. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolRulesTab.tsx` | Rules tab. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolAdminTab.tsx` | Admin tab container. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` | Capacity expansion (already audited in POLAR_AUDIT.md). |

### Frontend — match / standings / pick components

| File | Role |
|---|---|
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx` | Single match card: header (Grupo A - Jornada 1), kickoff date, pick form, result. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PickSection.tsx` | Pick form within MatchCard. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/ResultSection.tsx` | Result section within MatchCard. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts` | `formatPhaseName`, `formatPhaseFullName`, `isPlaceholder`, `getPlaceholderName` — central locale-aware formatters for phase + team-placeholder labels. |
| `frontend-next/src/components/PlayerSummary.tsx` | "My Summary" component reused outside `[poolId]`. |
| `frontend-next/src/components/groupStandings/ClassicStandingsTable.tsx` | Classic FIFA-style group table (Pos / Equipo / PJ / G / E / P / GF / GC / DG / Pts). |
| `frontend-next/src/components/groupStandings/GroupStandingsCard.tsx` | Wrapper that renders ClassicStandingsTable for each group. |
| `frontend-next/src/components/StructuralPicksManager.tsx` | Drag-and-drop group ordering / knockout winner UI for Estratega. |
| `frontend-next/src/components/KnockoutMatchCard.tsx` | Knockout-stage match card (Estratega read-only view). |
| `frontend-next/src/lib/teamFlags.ts` (or similar) | If present: static map of country → country-code-for-flag — needs investigation. |

### Frontend — utility libs

| File | Role |
|---|---|
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts` | `fmtUtc(iso, userTimezone)` — UTC date → display string. The `11 jun 2026, 14:00` in the screenshot comes from here. |
| `frontend-next/src/data/teamFlags.ts` | Static map team-code → `{ country (in Spanish only), iso2, flagUrl }`. Used as fallback when `match.homeTeam.name` is missing. **Locked to Spanish.** |

### i18n message catalogs already in use on the pool zone

| File | Coverage |
|---|---|
| `frontend-next/src/messages/{es,en,pt}/pool.json` | The main catalog: page titles, tab labels, button text, empty states. |
| `frontend-next/src/messages/{es,en,pt}/common.json` | Shared strings (loading, error, retry, save, cancel). |
| `frontend-next/src/messages/{es,en,pt}/leaderboard.json` (if present) | Leaderboard-specific strings. |
| `frontend-next/src/messages/{es,en,pt}/poolWizard.json` | Wizard strings — out of scope for this audit (covered in POLAR_AUDIT migration of strings done 2026-05-12). |

---

## 2 — Line-by-line review

### 2.1 — `TournamentInstance.dataJson` shape (production data)

Audited with `_audit-instance-a-strings.ts`. Single-locale strings (always Spanish today):

- `dataJson.meta.name` = `"FIFA World Cup 2026"` (English-coincidental — works fine for `en`, suboptimal for `pt`).
- `dataJson.meta.competition` = `"FIFA World Cup"`.
- `dataJson.phases[].name` — 6 strings: `"Fase de Grupos"`, `"Dieciseisavos de Final"`, `"Octavos de Final"`, `"Cuartos de Final"`, `"Semifinales"`, `"Final"`.
- `dataJson.teams[].name` — 48 strings: `"México"`, `"Corea del Sur"`, `"Sudáfrica"`, ... `"Senegal"`.
- `dataJson.matches[].roundLabel` — 68 distinct strings; pattern `"Grupo {X} - Jornada {N}"` for group stage, `"R32 - 2A vs 2B"` for knockouts.
- `dataJson.matches[].venue` — 16 distinct venue names (proper nouns, mostly safe; `"Estadio Azteca"` is the same in every locale).

### 2.2 — `frontend-next/src/lib/timezone.ts`

```ts
// line 12
export function formatMatchDateTime(
  utcDate: string,
  userTimezone: string | null,
  locale: string = "es",
): string {
```

The function accepts a `locale` parameter (default `"es"`). It's locale-correct in principle.

### 2.3 — `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts`

```ts
// line 4
export function fmtUtc(iso: string, userTimezone: string | null = null) {
  return formatMatchDateTime(iso, userTimezone);   // ← passes 2 args, default "es" kicks in
}
```

**[OBS]** `fmtUtc` does NOT forward the user's locale. Every call site (MatchCard at line 210, deadline at line 213) hits the `"es"` default. This is the source of `11 jun 2026, 14:00` in the EN screenshot. → becomes **F-date-locale**.

`formatPhaseName(phaseId, t)` (line 12) and `formatPhaseFullName(phaseId, t)` (line 19) DO use `t()` with `phases.{phaseId}` / `phasesLong.{phaseId}` keys, and the catalog HAS those keys in all 3 locales (verified). When the code uses these helpers, output is correct. Issue is callers that bypass them.

### 2.4 — `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx`

- **Line 363:** `{g === "SIN_GRUPO" ? t("filters.others") : t("filters.group", { name: g })}` — group label is i18n-correct. ✅
- **Line 364:** `<span ...>{matchesByGroup[g]?.length ?? 0} partidos</span>` — `partidos` hardcoded in Spanish. → becomes **F-partidos-hardcoded**.

### 2.5 — `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx`

```ts
// line 210
{m.label ?? m.roundLabel ?? t("matchCard.matchLabel", { id: m.matchNumber ?? m.id })}
  • {t("matchCard.kickoff")}: {fmtUtc(m.kickoffUtc, userTimezone)}
```

- `m.label` is usually undefined.
- `m.roundLabel` comes from `dataJson.matches[].roundLabel` — Spanish: `"Grupo A - Jornada 1"`. **Wins the `??` chain.** The i18n fallback never runs. → becomes **F-roundlabel-spanish**.
- The kickoff date suffers from F-date-locale.

### 2.6 — `frontend-next/src/components/groupStandings/ClassicStandingsTable.tsx`

Fully i18n: every header (`colTeam`, `colPlayed`, `colWon`...) uses `t()` with `pool.groupStandings.*` keys, all 3 locales populated. ✅

### 2.7 — `frontend-next/src/data/teamFlags.ts`

```ts
"A1": { country: "México", iso2: "mx", flagUrl: "..." },
```

Static fallback dictionary. The `country` field is single-locale (Spanish only). Used as fallback when `match.homeTeam.name` is missing — but in practice, `match.homeTeam.name` comes from `dataJson.teams[].name` which is also Spanish, so the fallback rarely matters in isolation. → contributes to **F-team-names**.

### 2.8 — Other components scanned

- `MatchCard.tsx:293,296,322`: comments in Spanish (not user-visible). OK.
- `PoolBrandingTab.tsx:256,363,436,448,497`: hardcoded Spanish in `defaultMessage` fallbacks — works if the EN/PT keys exist in the catalog; need a separate i18n verification (out of immediate scope unless screenshot showed it).
- `KnockoutMatchCard.tsx`, `StructuralPicksManager.tsx`, `PoolLeaderboardTab.tsx`, `PoolPlayersTab.tsx`, `PoolRulesTab.tsx`: scanned with the `[áéíóúñ¿¡]` grep, no user-visible Spanish strings found outside `t()`. ✅

---

---

## 3 — Findings (bugs, gaps, risks)

> *Numbered for resolution tracking. Severity ranks user-visible impact.*
>
> **Status legend:**
> - `🟥 PENDING` — not started.
> - `🟧 IN PROGRESS` — partially implemented; not yet user-visible.
> - `🟩 FIXED` — code merged + deployed; problem no longer reproducible.
> - `⚪ DEFERRED` — intentionally out of scope for this cycle.

### F-1: Match `roundLabel` from `dataJson` overrides the i18n fallback in MatchCard
- **Status:** 🟩 FIXED in `<PENDING-SHA>` (2026-05-22) — added `getMatchLabel(match, t)` helper in `poolHelpers.ts` that builds the label client-side from i18n keys (group → `matchCard.groupMatchLabel { group, matchday }` parsed from the matchId regex `_MD(\d+)_`; knockout → existing `phasesLong.{phaseId}` which is already trilingual). Added `matchCard.groupMatchLabel` key in ES/EN/PT catalogs. `MatchCard.tsx:214` now calls `getMatchLabel(m, t)` instead of the `??` chain. The dataJson `roundLabel` is retained for backend filters and `page.tsx` search via `norm()`, but is no longer the user-visible source.
- **Severity:** **HIGH** — most visible bug; appears on every match card in EN and PT pools.
- **Where:** `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx:214`
- **Behavior:** `m.label ?? m.roundLabel ?? t("matchCard.matchLabel", ...)` — `m.roundLabel` is set from `dataJson.matches[].roundLabel` (Spanish-only: `"Grupo A - Jornada 1"`, `"R32 - 2A vs 2B"`) so the i18n fallback never fires.
- **Fix proposal:** stop using `m.roundLabel` as the primary label. Build the label client-side from i18n keys: for group matches use `t("matchCard.groupMatchLabel", { group, matchday })`; for knockouts use `t("matchCard.knockoutLabel", { phaseKey, slot })`. The dataJson `roundLabel` becomes purely an internal hint (kept for backend filters at `page.tsx:334`, which uses it via `norm()` for search).

### F-2: `fmtUtc` ignores user locale → dates always render in Spanish format
- **Status:** 🟩 FIXED in `5ed5b06` (2026-05-22) — `fmtUtc` accepts an optional `locale` parameter; both call sites in `MatchCard.tsx` and `admin/PendingJoinRequests.tsx` now read `useLocale()` and pass it. EN renders "Jun 11, 2026, 2:00 PM", PT renders "11 de jun. de 2026, 14:00", ES unchanged.
- **Severity:** **HIGH** — every kickoff time and deadline on every match card; affects all 3 locales (EN/PT users see `11 jun 2026`).
- **Where:** `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts:4` calls `formatMatchDateTime(iso, userTimezone)` without the third `locale` arg.
- **Fix proposal:** make `fmtUtc` accept the current locale and forward it. Either pass it through every call site, or capture it via `useLocale()` and pass via a wrapping component / context. Smallest change: have `fmtUtc` be a hook (`useFmtUtc()`) that reads `useLocale()` and returns the formatter.

### F-3: `"partidos"` hardcoded in PoolMatchesTab group summary
- **Status:** 🟩 FIXED in `86ef4b0` (2026-05-22) — replaced literal with `t("filters.matchesCount", { count: n })`. New i18n key added in all 3 locales with ICU plural form (1 partido/match/jogo vs N partidos/matches/jogos).
- **Severity:** medium — visible on every group accordion header.
- **Where:** `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx:364`
- **Behavior:** `<span>{n} partidos</span>` — Spanish literal.
- **Fix proposal:** `<span>{t("filters.matchesCount", { count: n })}</span>` with new i18n key in all 3 locales: ES `"{count, plural, one {# partido} other {# partidos}}"`, EN `"{count, plural, one {# match} other {# matches}}"`, PT `"{count, plural, one {# jogo} other {# jogos}}"`.

### F-4: `TournamentInstance.dataJson.phases[].name` is single-locale → fed verbatim by some callers
- **Status:** 🟥 PENDING
- **Severity:** medium — surfaces wherever a caller uses `phase.name` directly instead of `formatPhaseFullName(phase.id, t)`.
- **Where (verified):** 
  - `frontend-next/src/app/[locale]/como-se-juega/HowToPlayContent.tsx:622,635` — but that's a static landing-style page; may already be locale-rooted.
  - `frontend-next/src/components/PoolConfigWizard.tsx:63,132,151` — uses `phase.name` to build `pickTypesConfig.phaseName`, which is then **persisted in the Pool row**. Every existing pool has Spanish `phaseName` strings baked into `pickTypesConfig`. Cleaning this requires both a code fix AND a backfill of existing rows.
- **Fix proposal:** every component that needs to *display* a phase name calls `formatPhaseFullName(phase.id, t)` (already exists, already has i18n keys in all 3 catalogs). For `pickTypesConfig.phaseName` stored in BD: either (a) backfill the column with canonical phase IDs and let the frontend translate on render, or (b) drop the persisted `phaseName` entirely since `phaseId` alone is enough.

### F-5: `TournamentInstance.dataJson.teams[].name` is single-locale (48 country names in Spanish)
- **Status:** 🟥 PENDING
- **Severity:** medium-high — most match cards show country names; EN/PT users see "México", "Sudáfrica", "Corea del Sur", "República Checa", "Bélgica", etc.
- **Where:** `dataJson.teams[].name` lives in the instance and is copied to every pool's `fixtureSnapshot`. The frontend reads `match.homeTeam.name` and `match.awayTeam.name` and renders directly.
- **Fix proposal:** add a per-locale name dictionary. Options:
  - **(A)** add a `teamI18n` JSON column to `TournamentInstance.dataJson.teams[]` with shape `{ es, en, pt }` per team; frontend reads the right slot.
  - **(B)** keep current `teams[].name` as the "canonical" key and add a frontend dictionary `messages/{locale}/teams.json` keyed by team id (`t_A1` etc.). Frontend resolves the display name at render time.
- **(B)** is preferred — additive, no migration, decouples display from data shape.

### F-6: `frontend-next/src/data/teamFlags.ts` has `country` only in Spanish
- **Status:** 🟥 PENDING (lower priority than F-5; same outcome — country name in Spanish)
- **Severity:** low — this is a fallback dictionary only.
- **Where:** `frontend-next/src/data/teamFlags.ts`
- **Fix proposal:** restructure to `country: { es, en, pt }`. Or merge into the new `messages/{locale}/teams.json` from F-5.

### F-7: `TournamentInstance.name`, `template.name`, `dataJson.meta.name` are single-locale
- **Status:** 🟥 PENDING (low priority since current strings happen to be English-coincidental)
- **Severity:** low — `"World Cup 2026"`, `"UEFA Champions League 2025-26"` work as proper nouns in EN; suboptimal in PT (`"Copa do Mundo 2026"`).
- **Fix proposal:** add a `displayNameI18n` Json column to TournamentTemplate (and propagate to the instance via dataJson clone). Frontend uses it with locale fallback to `name`. Defer until F-1..F-6 are done; the current strings don't grossly mislead the user.

### F-8: `dataJson.matches[].venue` — proper nouns mostly safe
- **Status:** ⚪ DEFERRED
- Some venues are in Spanish (`"Estadio Azteca"`, `"Estadio BBVA"`), most are English (`"SoFi Stadium"`, `"NRG Stadium"`). For now this is acceptable — venues are proper nouns and users likely recognise both forms. Revisit if user feedback indicates otherwise.

### F-9: `PoolBrandingTab.tsx` Spanish strings inside `defaultMessage` fallbacks
- **Status:** ⚪ DEFERRED — out of immediate scope.
- **Severity:** to verify — if the EN/PT keys exist in catalog, `defaultMessage` is dead weight that doesn't render. If not, EN/PT users see Spanish.
- **Where:** lines 256, 363, 436, 448, 497.

---

---

## 4 — Resolution plan

> *Built only after sections 1-3 are complete and approved.*

<!-- pending -->
