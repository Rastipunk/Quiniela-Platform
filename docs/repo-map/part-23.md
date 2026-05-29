## Batch 23

### frontend-next/src/components/scoring-editor/ScoringEditor.tsx

**Purpose:** Container-agnostic scoring-configuration editor reused by the pool-creation wizard (`StepScoring` wrapper) and the host "Administrar reglas" panel on DRAFT pools. It lets a host pick a scoring preset and then fine-tune per-phase point values, criteria, multipliers, and extra-time rules.

**What it does:**
- **`CRITERION_META`** — a numbers-only table of recommended points per `MatchPickTypeKey` for group vs knockout phases (`recGroup` / `recKnockout`). Display copy lives in `poolWizard.json`; this table never holds Spanish labels so EN/PT UIs stay clean.
- **`generatePresetConfig(presetKey, phases)`** — builds a `PoolPickTypesConfig` for each of the four preset keys:
  - `CUMULATIVE`: every phase score-based with MATCH_OUTCOME_90MIN(10), HOME_GOALS(4), AWAY_GOALS(4), GOAL_DIFFERENCE(2).
  - `CUSTOM`: same plus a disabled TOTAL_GOALS row to expose more toggles.
  - `BASIC`: single EXACT_SCORE(20) criterion.
  - `SIMPLE` (default branch): structural picks — GROUP phases get `GROUP_STANDINGS` (pointsPerExactPosition 10, bonusPerfectGroup 20, includeGlobalQualifiers false); knockout phases get `KNOCKOUT_WINNER` with `pointsPerCorrectAdvance` from a `knockoutPointsMap` (R32 15 → Final 40).
- **`calculateScore(realHome, realAway, predHome, predAway, enabledTypes)`** — pure helper that returns `CalcResult[]`; evaluates each enabled criterion (outcome via `Math.sign`, exact score, total goals, partial score, goal difference, etc.) and returns hit/points. Drives the interactive example calculator.
- **`PresetCard`** — clickable preset card with hover state, "Recommended" badge, icon, i18n name/tagline/description/example resolved via a `tDyn` cast (next-intl runtime-keyed lookup).
- **`PhaseSection`** — collapsible per-phase editor. Shows a scaling-locked banner when `scalingEnabled`; for CUSTOM offers a "Marcadores (score)" vs "Posiciones (structural)" toggle that rewrites the phase between `matchPicks` and `structuralPicks` (stripping `includeExtraTime` when switching to structural). Renders criteria rows (toggle + points input + "Sugerido" badge) and structural-pick rows. Point inputs become read-only when scaling is on. Handlers: `handleToggleCriterion`, `handlePointsChange`, `handleStructuralChange`.
- **`StructuralInput`** — labeled number-input row for structural-pick fields with a clickable "Sugerido (X)" restore badge (hidden when scaling on).
- **`ExampleCalculator`** — interactive "what would I score" widget: editable real/predicted score inputs, per-phase selector, runs `calculateScore`, renders per-criterion hit/miss rows and a total. (`maxPoints` is computed but unused.)
- **`ScoreInput`** — small numeric input (0–20) with brand accent variant.
- **`PresetSummary`** — read-only summary for non-CUSTOM presets: a criteria-by-phase points table for score-based presets, a SIMPLE description block, a progressive-points (multiplier) status line, an extra-time status line, and an inline `ExampleCalculator`.
- **`ExtraTimeSection`** — per-knockout-phase extra-time toggles (using `ToggleSwitch`); collapsible summary for presets, always-expanded for CUSTOM. `toggleExtraTime` flips `includeExtraTime` on a phase.
- **`ScoringEditor` (main export)** — state: `openPhases`, `showAdvanced`, `scalingEnabled` (default true), `phaseMultipliers`, `basePoints`. `DEFAULT_MULTIPLIERS` maps phase ids (many aliases) to the Predictor's ×1→×4 progression; `getDefaultMultiplier` resolves a phaseId via substring match. `SIMPLE_BASE_*` constants are the Estratega base values for structural scaling.
  - `applyScaling(multipliers, base)` — rescales every phase: score-based phases scale each `matchPicks` criterion off `base`; SIMPLE phases scale `GROUP_STANDINGS` / `KNOCKOUT_WINNER` config off the SIMPLE_BASE constants. Calls `onUpdateScoringConfig`.
  - `handleToggleScaling` — captures base points / default multipliers and applies, or resets to base on disable.
  - `handleMultiplierChange`, `handleSelectPreset` (generates + scales a fresh config then calls `onSetScoring`), `handleChangePreset` (clears to preset picker), `handleUpdatePhase`, `togglePhase`.
  - **View 1 (no `scoringStyle`):** renders preset picker (`PresetCard` list + tip).
  - **View 2 (preset chosen):** active-preset header with "Cambiar" button; `PresetSummary` for non-custom; an advanced-options block containing the progressive-points scaling toggle with per-phase steppers (− / ×N / +) and a "restore recommended" button, the global extra-time toggle (only when a knockout phase is score-based; hidden for SIMPLE), and the per-phase `PhaseSection` list; a CUSTOM-only `ExampleCalculator`; and a SIMPLE Estratega-mode info card.

**Exports:** named `ScoringEditor` + `ScoringEditorProps` interface; default export `ScoringEditor`.

**Key dependencies:** `next-intl` (`poolWizard`, `pool` namespaces), `useIsMobile`, `@/lib/theme` tokens, `@/types/pickConfig`, `@/types/poolWizard`, `ToggleSwitch`, `./presets` (`PRESETS`, `PresetInfo`), `formatPhaseFullName` from pool `poolHelpers`.

**Flags:** Several hardcoded UI literals slip past i18n — the "Cambiar" button label (line 1865), "Resultado:" / "Prediccion:" / "Total" labels in `ExampleCalculator`, and the Spanish `title` in `StructuralInput` ("Restaurar al valor sugerido"). The `maxPoints` computation in `ExampleCalculator` is dead (computed, never read). The advanced-options wrapper `display: isCustom || showAdvanced ? "block" : "block"` is a tautology (always "block"). Otherwise consistent.

### frontend-next/src/components/ScoringBreakdownModal.tsx

**Purpose:** Modal that fetches and renders a per-match or per-phase scoring breakdown (Sprint 2 Scoring Breakdown System), explaining exactly how a member's points were computed.

**What it does:**
- **`ScoringBreakdownModal`** — overlay modal. On open, an effect fetches the breakdown via `getMatchBreakdown(token, poolId, matchId)` or `getPhaseBreakdown(token, poolId, phaseId)` depending on which prop is set; stores `breakdown` and (for matches) `matchInfo` (home/away teams). Handles loading, unauthorized (no token), and error states. Backdrop click and X button call `onClose`.
- **`renderBreakdown(breakdown, matchInfo)`** — switch on `breakdown.type` → dispatches to `NoPickBreakdownView`, `MatchBreakdownView`, `GroupStandingsBreakdownView`, `KnockoutWinnerBreakdownView`, or `UnsupportedBreakdownView`.
- **`NoPickBreakdownView`** — "no pick" state with reason and the max points that were forfeited.
- **`MatchBreakdownView`** — summary card (earned/max with green/amber/grey gradient), side-by-side prediction vs official result, and a list of `RuleEvaluationRow`s.
- **`RuleEvaluationRow`** — per-rule line with ✅/—/❌ icon (detects "No aplica" / not-applicable rules), rule name, details, and earned points.
- **`GroupStandingsBreakdownView`** — summary card, config line (points per exact position + perfect-group bonus), and a `GroupEvaluationCard` per group.
- **`GroupEvaluationCard`** — per-group card highlighting a perfect group; renders each predicted position with matched/missed markers and the perfect-group bonus result.
- **`KnockoutWinnerBreakdownView`** — summary card, config line (points per correct advance), and a `KnockoutMatchRow` per match.
- **`KnockoutMatchRow`** — per-match line with ✅/⏳/❌ icon, predicted winner, actual winner, and earned points.

**Exports:** named `ScoringBreakdownModal`.

**Key dependencies:** `next-intl` (`pool` namespace, `scoringBreakdown.*` keys), `@/lib/theme` colors, `../lib/api` (`getMatchBreakdown`, `getPhaseBreakdown` + breakdown TS types), `getToken` from `../lib/auth`.

**Flags:** `err: any` catch typing and several hardcoded inline hex colors (gradients `#28a745`/`#20c997`, border `#dee2e6`, `#004085`, `#495057`, `#f5c6cb`) sit outside the theme tokens. `RuleEvaluationRow` detects not-applicable rules by matching the Spanish substring "No aplica" in `rule.details` — locale-fragile if details are ever translated. Not dead code.

### frontend-next/src/components/ShareButtons.tsx

**Purpose:** Reusable social-share button row (WhatsApp, Facebook, X, copy-link, plus native share on mobile) with context-aware pre-filled messages and UTM tagging.

**What it does:**
- Inline SVG icon constants: `WHATSAPP_ICON`, `FACEBOOK_ICON`, `TWITTER_ICON`, `COPY_ICON`, `CHECK_ICON`.
- **`getChannels(t)`** — returns `ChannelConfig[]` for whatsapp/facebook/twitter, each with a `buildUrl(text, url)` producing the standard web-intent share URL.
- **`ShareButtons`** — main component. Derives a UTM `campaign` (`pool_invite` vs `pool_share`) from `context`; `tagUrl(source)` appends UTM params via `appendUtm`. `shareText()` builds the localized message per `ShareContext` (`poolInvite`, `predictions`, `worldCupHub`, `leaderboard`, `generic`) using the `data` props.
  - `handleNativeShare` — uses `navigator.share`, then fires `trackEvent("share_pool", …)` and `trackMetaCustomEvent("SharePool", …)`.
  - `handleCopy` — copies text+URL via `navigator.clipboard` (with a `document.execCommand("copy")` textarea fallback), shows a 2.5s "copied" state, fires the same analytics events.
  - Renders the native-share button only when `navigator.share` exists, the three channel `<a>` links, and the copy button. Size/labels/layout configurable via props (`row`/`column`, `showLabels`, `sm`/`md`).

**Exports:** named `ShareButtons`, type `ShareContext`, interface `ShareButtonsProps`.

**Key dependencies:** `@/lib/theme`, `@/lib/analytics` (`trackEvent`), `@/lib/metaPixel` (`trackMetaCustomEvent`), `@/lib/utm` (`appendUtm`), `next-intl` (`share` namespace).

**Flags:** `handleNativeShare` / `handleCopy` `useCallback` dependency arrays omit `context` even though `trackEvent` reads it — a stale-closure lint smell, harmless in practice. None dead.

### frontend-next/src/components/StructuralPicksManager.tsx

**Purpose:** Top-level manager for the SIMPLE-preset "Estratega" structural picks (group standings ordering + knockout winners) for a single phase, used by both players (making picks) and hosts (overriding published winners) — Sprint 2 Advanced Pick Types System.

**What it does:**
- **`StructuralPicksManager`** — loads pick/result data on mount via an effect:
  - KNOCKOUT: fetches the user's pick (`getStructuralPick`) and the published winners (`getStructuralResult`) in parallel; `publishedWinners` map is populated from `result.resultJson.matches[]` (source of truth for "who advances", produced by the scraper-driven `autoPublishStructuralResults`).
  - GROUP: hosts load the official result if present (`getStructuralResult`); otherwise the user's pick is loaded.
  - `loadPickData_internal` parses pick data into `groupPicks` (Map groupId→teamIds) or `knockoutPicks` (Map matchId→winnerId).
- **`_handleSave`** (prefixed unused) — preserved batch-save path: builds a GROUP/KNOCKOUT payload, validates non-empty, then `publishStructuralResult` (host) or `upsertStructuralPick` (player), with a 3s success message timer. Explicitly retained "for future batch-save" and `void`-referenced.
- Renders: gradient header (group vs knockout copy, host vs player), success message, then either a grid of `GroupStandingsCard`s (per extracted group) or `KnockoutMatchCard`s (per extracted match). The knockout card receives `publishedWinnerId`, `existingResult`, `existingPick`; its `onResultSaved` refetches the structural result to refresh `publishedWinners` and calls `onDataChanged`. A locked-phase info block (with an optional "view breakdown" button) and a knockout progress counter are shown conditionally.
- **`extractGroups(tournamentData, _phaseId)`** — groups teams and matches by `team.groupId` / `match.groupId` (WC2026 sandbox stores groups on teams, not phases), returns alphabetically sorted `Group[]`.
- **`extractMatches(tournamentData, phaseId)`** — filters template matches by `phaseId`, resolving home/away team objects (TBD fallback).

**Exports:** named `StructuralPicksManager`.

**Key dependencies:** `next-intl` (`pool` namespace, `structuralManager.*`), `@/lib/theme`, sibling `GroupStandingsCard` / `KnockoutMatchCard`, `../lib/api` (`upsertStructuralPick`, `getStructuralPick`, `publishStructuralResult`, `getStructuralResult`), `../types/pickConfig`.

**Flags:** Substantial intentional dead/preserved code: `_handleSave`, `_saving`/`_setSaving`, `_phaseName`, `_phaseConfig`, `_onShowBreakdown` are all `void`-referenced and unused in the active path (saving is delegated to the child cards). `tournamentData: any` and several `any` casts are system-boundary typing. Inline hex colors (`#f8fafc`, `#64748b`, `#f5c6cb`, `#b3d9ff`, `#004085`, `#c3e6cb`) bypass theme tokens. The success messages prepend a hardcoded "✅". Worth noting for cleanup but deliberately preserved.

### frontend-next/src/components/TeamFlag.tsx

**Purpose:** Renders a team's flag/crest image plus optional localized name, resolving flag data from the static `teamFlags` catalog with i18n team-name override.

**What it does:** **`TeamFlag`** strips the `t_` prefix from `teamId`, looks up `getTeamFlag(teamCode, tournamentKey)`. Resolves the display name through the `teams` i18n namespace keyed by FIFA 3-letter `flag.code` (I18N_AUDIT F-6), falling back to the Spanish `flag.country` (locale-independent for UCL clubs) or `getCountryName`. Falls back to a ⚽ emoji when no flag URL. Renders a lazy-loaded `<img>` (sized via `sizeMap` sm/md/lg) and optional name span, honoring `layout` (horizontal/vertical), `reverseOrder`, `wrapName`, and `nameAlign`.

**Exports:** named `TeamFlag`, type `TeamFlagProps`.

**Key dependencies:** `next-intl` (`teams`), `../data/teamFlags` (`getTeamFlag`, `getCountryName`).

**Flags:** none.

### frontend-next/src/components/ui/ToggleSwitch.tsx

**Purpose:** Shared, accessible toggle-switch primitive used across the app for consistent on/off controls.

**What it does:** **`ToggleSwitch`** renders a `role="switch"` button with `aria-checked`, fixed track/thumb dimensions (default 48×28 / small 40×22) so it never collapses on wrapping mobile layouts, a sliding thumb, disabled state, and configurable `activeColor` (default brand). Module constants `TRACK_W`, `TRACK_H`, `THUMB_SIZE`, `THUMB_OFFSET`.

**Exports:** named `ToggleSwitch`.

**Key dependencies:** `@/lib/theme` (`colors`, `radii`).

**Flags:** none.

### frontend-next/src/components/WhatsNewModal.tsx

**Purpose:** One-time "what's new" announcement modal (version `2026-02-27`) shown to logged-in users until dismissed.

**What it does:** **`WhatsNewModal`** checks `localStorage` for an auth token (`quiniela.token`) and the last-seen version (`quiniela.whatsNewVersion`); shows the modal only if logged in and the version differs. `handleDismiss` persists the current version and hides. Body renders three highlight cards (UCL R16 draw, 90-min-vs-ET per phase using `poolParams` from `usePoolTerm`, deadline/kickoff info) and a dismiss button. Localized via the `whatsNew` namespace; responsive via `useIsMobile`.

**Exports:** named `WhatsNewModal`.

**Key dependencies:** `@/lib/theme`, `next-intl` (`whatsNew`), `useIsMobile`, `usePoolTerm`.

**Flags:** Storage keys still use the legacy `quiniela.*` prefix (vs the newer `p4a_*` convention elsewhere) — token key here must match wherever auth is persisted. Hardcoded inline hex colors for the highlight cards. The version string is hardcoded (expected for this component pattern). Not dead.

### frontend-next/src/contexts/AuthPanelContext.tsx

**Purpose:** Lightweight React context exposing a function to open the auth (login/register) panel from anywhere, with an optional post-auth redirect.

**What it does:** Defines `AuthPanelContextType` with `openAuthPanel(mode?, redirectTo?)`; creates the context with a no-op default; exports the `useAuthPanel()` consumer hook. The actual provider lives elsewhere (the corporate flow uses the `redirectTo` parameter per project memory).

**Exports:** `AuthPanelContext`, `useAuthPanel`.

**Key dependencies:** React only.

**Flags:** none.

### frontend-next/src/contexts/PoolTermContext.tsx

**Purpose:** Provides region-aware pool terminology ("quiniela"/"polla"/"prode"/"penca"/"porra") so UI copy adapts to the visitor's region, sourced client-side from localStorage to keep public pages publicly cacheable.

**What it does:**
- localStorage keys `p4a_pool_region` / `p4a_pool_region_ts` with a 1-year TTL. `readStoredRegion` validates and TTL-checks; `writeStoredRegion` persists with timestamp; both guard against SSR/private-mode failures.
- **`migrateLegacyCookie`** — one-shot migration copying the legacy `POOL_REGION_COOKIE` value to localStorage and clearing the cookie.
- **`PoolTermProvider`** — holds the active `region` (starts at SSR-safe `initialRegion`). A hydration effect resolves the real region exactly once: localStorage → legacy cookie → `fetch("/api/region")` (CF-IPCountry-based, populates localStorage), failing silently to the default. Memoizes `terms` (`getPoolTermsES`) and `params` (`getPoolTermParams`); `setRegion` updates localStorage + state (no reload — the whole tree subscribes).
- **`usePoolTerm`** — consumer hook with a safe out-of-provider fallback (default region terms/params).

**Exports:** `PoolTermProvider`, `usePoolTerm`, `PoolTermContextValue` (interface, internal).

**Key dependencies:** `@/lib/poolTerms` (region types, defaults, cookie name, `getPoolTermsES`, `getPoolTermParams`, `isValidRegion`).

**Flags:** none — the cookie→localStorage migration is intentional and documented (cache-control rationale).

### frontend-next/src/data/languages.ts

**Purpose:** Static reference data for the first-login locale-preference modal: a full ISO 639-1 language list (for "which language would you prefer" demand signaling) and a curated country list.

**What it does:** Exports `LANGUAGES` (~98 entries, each with an ISO code and ES/EN/PT names, alphabetically by Spanish name) and `COUNTRIES` (~66 curated markets — LATAM, Iberia, lusophone Africa, anglophone allow-list, major European markets — each with ISO2 code and ES/EN/PT names). The language list is purely a preference signal; only ES/EN/PT are actual UI/email locales.

**Exports:** types `LanguageOption`, `CountryOption`; constants `LANGUAGES`, `COUNTRIES`.

**Key dependencies:** none (pure data).

**Flags:** none.

### frontend-next/src/data/teamFlags.ts

**Purpose:** Static fallback mapping of team codes to flag/crest image URLs and FIFA codes, for the WC 2026 sandbox tournament and the UCL 2025-26 instance.

**What it does:**
- **`WC2026_FLAGS`** — all 48 WC2026 teams keyed by group-position code (`A1`…`L4`), each with Spanish `country`, FIFA 3-letter `code`, `iso2`, and a `flagcdn.com` URL.
- **`CLUB_LOGO(id)`** helper + **`UCL_2025_FLAGS`** — UEFA Champions League clubs keyed by abbreviation, using `media.api-sports.io` team logos (no `code`, since club names are locale-independent), plus a `TBD` placeholder.
- **`getTeamFlag(teamCode, tournamentKey)`** — returns the flag entry for `wc_2026_sandbox` or `ucl-2025`, else null.
- **`getCountryName(teamId, tournamentKey)`** — strips `t_`, looks up the flag, returns its `country` or the raw teamId.

**Exports:** types `TeamFlagData`, `TeamFlagMapping`; constants `WC2026_FLAGS`, `UCL_2025_FLAGS`; functions `getTeamFlag`, `getCountryName`.

**Flags:** Per CLAUDE standards this static mapping is acceptable only as a fallback (the primary source must be dynamic API/DB data) — by design here. Tournament keys (`wc_2026_sandbox`, `ucl-2025`) and the flagcdn/api-sports URL bases are hardcoded; acceptable for a static fallback table. Not dead.

### frontend-next/src/hooks/useAuth.ts

**Purpose:** Client hook exposing the current auth token and authentication state, kept in sync with login/logout events.

**What it does:** **`useAuth`** initializes `token` from `getToken()`, flips `isLoading` off after the first check, and subscribes to `onAuthChange` to refresh the token on login/logout (returning the unsubscribe). Returns `{ token, isLoading, isAuthenticated: !!token }`.

**Exports:** named `useAuth`.

**Key dependencies:** `../lib/auth` (`getToken`, `onAuthChange`).

**Flags:** none.

### frontend-next/src/hooks/useIsMobile.ts

**Purpose:** SSR-safe viewport breakpoint hook (mobile-first) plus shared breakpoint/touch-target constants and interactive-style presets.

**What it does:** Exports `BREAKPOINTS` (mobile 640, tablet 768, tabletLg 1024, desktop 1280) and `TOUCH_TARGET` (minimum 44, comfortable 48). **`useIsMobile(options)`** initializes from `window.innerWidth` (or `defaultValue` on the server) and subscribes to a `matchMedia(max-width: breakpoint-1)` listener. Also exports `mobileInteractiveStyles` (touch target sizes, tap-highlight reset, touch feedback transition).

**Exports:** `BREAKPOINTS`, `TOUCH_TARGET`, `useIsMobile`, `mobileInteractiveStyles`.

**Key dependencies:** React only.

**Flags:** none.

### frontend-next/src/hooks/useLiveRefresh.ts

**Purpose:** Auto-refresh hook that polls a refetch callback while any match is live.

**What it does:** `POLL_INTERVAL_MS` from `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` (default 15s) via the `envInt` helper. **`useLiveRefresh(matches, refetch)`** stores the latest `refetch` in a ref, computes `hasLive` from `matches.some(m => m.isLive)`, and sets a `setInterval` (cleared on unmount or when no match is live) calling the ref'd refetch.

**Exports:** named `useLiveRefresh`.

**Key dependencies:** React only; env var `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS`.

**Flags:** none.

### frontend-next/src/hooks/usePoolNotifications.ts

**Purpose:** Hook that fetches a pool's notification counts with polling, plus helpers to derive per-tab badges and urgent-deadline state.

**What it does:** **`usePoolNotifications(poolId, options)`** — default 60s polling, `enabled` flag. Keeps `poolId` in a ref for the manual `refetch`. An effect does an initial inline fetch and sets up the polling interval with a `cancelled` guard; both use `getPoolNotifications(token, poolId)` and require a token. Returns `{ notifications, isLoading, error, refetch }`.
- **`calculateTabBadges(notifications)`** — maps notification fields to per-tab badge counts: `partidos` = pendingPicks (+ pendingResults if host/co-admin); `jugadores` = pendingJoins (moved here from Admin); `admin` = phasesReadyToAdvance length; leaderboard/reglas/resumen = 0.
- **`hasUrgentDeadlines(notifications)`** — true when `urgentDeadlines` is non-empty (<24h).

**Exports:** `usePoolNotifications`, `calculateTabBadges`, `hasUrgentDeadlines`.

**Key dependencies:** `../lib/api` (`getPoolNotifications`, `PoolNotifications` type), `../lib/auth` (`getToken`).

**Flags:** `err: any` catch typing; error fallback strings are hardcoded Spanish ("Error obteniendo notificaciones") rather than i18n — minor, as they are console/state fallbacks. Not dead.

### frontend-next/src/i18n/navigation.ts

**Purpose:** Locale-aware navigation primitives bound to the app's routing config.

**What it does:** Calls `createNavigation(routing)` and re-exports `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`.

**Exports:** `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`.

**Key dependencies:** `next-intl/navigation`, `./routing`.

**Flags:** none.

### frontend-next/src/i18n/request.ts

**Purpose:** next-intl server request config — resolves the active locale and lazily loads/merges all message namespaces for that locale.

**What it does:** `getRequestConfig` reads `requestLocale`, validates it against `routing.locales` (falling back to `defaultLocale`), then dynamically imports ~22 per-locale JSON files in parallel (common, auth, dashboard, profile, pool, legal, penca, polla, prode, porra, footballPool, seo, pricing, pricingPage, poolWizard, worldCup, share, cookieConsent, payment, howToPlay, teams, tournaments), each with a `.catch(() => ({}))` guard. Returns `{ locale, messages }` where `common` is spread at the top level and the rest are namespaced.

**Exports:** default `getRequestConfig` handler.

**Key dependencies:** `next-intl/server`, `next-intl` (`hasLocale`), `./routing`, the `../messages/{locale}/*.json` files.

**Flags:** none — the per-import `.catch` is intentional resilience.

### frontend-next/src/i18n/routing.ts

**Purpose:** Central next-intl routing definition: supported locales, prefix strategy, disabled auto-detection, and the full localized pathname map.

**What it does:** `defineRouting` with locales `["es","en","pt"]`, defaultLocale `es`, `localePrefix: "as-needed"`. Critically sets `localeCookie: false` and `localeDetection: false` so next-intl consults only the URL prefix + defaultLocale; all other locale signals flow through `proxy.ts` (ADR-064, invariant 12) and the cookie is written by `LanguageSelector`/`LocalePreferenceModal`/backend `authCookies`. Defines the `pathnames` map: shared paths, localized public/legal/pricing paths, single-locale regional SEO pages (each scoped to ONE locale to avoid bad hreflang clusters and 404 alternates), corporate (`/empresas`…), activation, the World Cup 2026 hub subtree, payment pages, the pool-creation wizard, and app/admin routes (including the sales `cotizaciones` / `cuentas-de-cobro` admin pages). Exports `Locale` and `Pathnames` types.

**Exports:** `routing`, types `Locale`, `Pathnames`.

**Key dependencies:** `next-intl/routing`.

**Flags:** none — extensive in-file comments justify the cookie/detection and single-locale-pathname decisions.

### frontend-next/src/lib/analytics.ts

**Purpose:** Centralized GTM/GA4 client analytics layer — all tracking funnels through `window.dataLayer`, with Consent Mode v2 handling, an admin-gated debug mode, and dataLayer trimming.

**What it does:**
- Augments `Window` with an optional `dataLayer`. Debug mode (`isDebugEnabled`) is gated on `?gtm_debug=1` plus the backend-set non-httpOnly `p4a_admin` cookie (or a previously-set `p4a_analytics_debug` localStorage flag); `debugLog` collapses payloads to console when enabled.
- `CONSENT_SIGNALS` lists the five Consent Mode v2 signals the UI controls.
- `trimDataLayer` caps the dataLayer at `DATALAYER_MAX` (500), dropping oldest entries.
- **`gtag(...args)`** — pushes a command tuple (the only form that actually updates Consent Mode), with trim + debug log.
- **`trackEvent(event, params)`** — pushes a custom `{ event, ...params }` object.
- **`trackPageView(path, title)`** — virtual page_view for client navigation where the URL doesn't change.
- **`setAnalyticsUserId(userId|null)`** — binds/clears the GA4 `user_id` (dataLayer push + `gtag('set')`).
- **`setUserProperties(props)`** — sanitizes/truncates (36-char strings) the `AnalyticsUserProperties` snapshot (tier, country, pool counts, signup_method, last_active_at, etc.) and applies via dataLayer push + `gtag('set','user_properties')`.
- **`updateConsent(consent)`** — emits `gtag('consent','update', …)` for all signals, flips `ads_data_redaction` (false on granted to keep gclid attribution), keeps `url_passthrough` true, and fires a `consent_update` event.

**Exports:** types `ConsentValue`, `AnalyticsUserProperties`; constant `CONSENT_SIGNALS`; functions `gtag`, `trackEvent`, `trackPageView`, `setAnalyticsUserId`, `setUserProperties`, `updateConsent`.

**Key dependencies:** browser globals only (`window.dataLayer`, `document.cookie`, `localStorage`); GTM loaded from the root layout.

**Flags:** none — server no-ops and consent handling are deliberate.
