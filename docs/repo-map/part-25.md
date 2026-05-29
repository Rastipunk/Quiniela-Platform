## Batch 25

### frontend-next/src/proxy.ts

**Purpose:** Next.js middleware (named `proxy`) that is the SOLE locale-resolution authority for the frontend, plus a `www`→non-`www` redirect and an SEO hreflang `Link:` header sanitizer for single-locale regional pages. Implements ADR-064 (locale resolution is URL-prefix-first, then cookie, then Accept-Language, then default) and CLAUDE invariant 12.

**What it does:**

- **Module init / `handleI18nRouting`:** wraps next-intl's `createMiddleware(routing)` (from `./i18n/routing`). next-intl is configured with `localeDetection:false`, so it only consults URL prefix + `defaultLocale`; all other locale signals are resolved manually here.

- **Single-locale path index (`buildSingleLocaleIndex`, `SINGLE_LOCALE_PATH_INDEX`):** built once at module load by scanning `routing.pathnames`. For any pathname entry declared as a per-locale object (`Record<string,string>`) that covers FEWER than all locales (regional SEO landing pages like `{ es: "/polla-futbolera" }`), it records a `SingleLocaleEntry { allowedLocales:Set, primaryLocalePath }`. The `primaryLocalePath` is the first locale's full URL (prefixed with `/<locale>` unless it's the default locale). Every full per-locale path maps to the shared entry. Plain-string pathname entries (uniform across locales) are skipped.

- **`filterHreflangLinkHeader(linkHeader, entry, origin)`:** splits the comma-separated `Link:` header into parts; for each `rel="alternate"; hreflang="..."` part it (a) rewrites the `x-default` alternate to point at `entry.primaryLocalePath` (so x-default doesn't 404), (b) keeps alternates whose lang is in `entry.allowedLocales`, and (c) drops alternates for locales the page doesn't serve. Returns the rejoined header. This keeps the HTTP `Link:` header in sync with the HTML `<head>` hreflang (which Next's metadata API already handles), preventing Search Console "broken hreflang cluster" reports.

- **Cookie-redirect scope (`COOKIE_REDIRECT_PREFIXES`, `pathMatchesCookieRedirect`):** an allowlist of unprefixed path prefixes where a `NEXT_LOCALE` cookie may override URL-based locale: `/dashboard`, `/profile`, `/pools`, `/admin`, `/pago`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`. These all have a UNIFORM path across locales (so prepending a locale prefix always resolves). Translated routes (e.g. `/crear-pool` ↔ `/create-pool`) are deliberately excluded because next-intl can't serve `/en/crear-pool`.

- **Path helpers:** `pathStartsWithLocale` (path begins with a known locale prefix); `extractUrlLocalePrefix` (returns the leading locale or null); `stripLocalePrefix` (removes a leading `/en`,`/pt` etc. so it can be matched against the unprefixed `COOKIE_REDIRECT_PREFIXES`).

- **`detectLocaleFromAcceptLanguage(header)`:** manual Accept-Language parser replacing next-intl's disabled auto-detection. Splits the header (`"en-US,en;q=0.9,es;q=0.8"`) into priority-ordered candidates, reduces each to its primary subtag (`en-US`→`en`), and returns the first that's in `routing.locales`, else null.

- **`proxy(request)` — the exported middleware:**
  1. **www redirect (Step 1):** if `host` starts with `www.`, 301-redirect to the non-www host preserving path + query.
  2. **Locale resolution (Step 1b):** reads `path`, `urlLocale` (from URL), and the validated `NEXT_LOCALE` cookie (`cookieLocale`). Computes `unprefixedPath` and `inScope` (whether the path is in `COOKIE_REDIRECT_PREFIXES`). Only READS cookies (never sets), preserving SEO cacheability. When `inScope`: **Step A** — if a cookie locale exists it wins; computes the desired URL locale (null for default ES, else the locale) and 307-redirects when URL disagrees. **Step B** — no cookie and no URL prefix → run `detectLocaleFromAcceptLanguage`; if a non-default locale is detected, 307-redirect to `/<locale><path>`. **Step C** — cookie absent but URL has a prefix → respect URL, fall through.
  3. **i18n routing (Step 2):** delegates to `handleI18nRouting(request)`. A long comment documents that pool-region detection USED to live here (setting a `pool-region` cookie from Cloudflare `CF-IPCountry`) but was removed because the resulting `Set-Cookie` forced `Cache-Control: private,no-store` and harmed indexing; region detection now happens client-side via `PoolTermProvider` → `/api/region` + localStorage.
  4. **Link header filter (Step 3):** for 2xx responses with a `link` header whose pathname is in `SINGLE_LOCALE_PATH_INDEX`, rewrites/deletes the header via `filterHreflangLinkHeader`.

- **`config.matcher`:** matches all paths except `_next/static`, `_next/image`, `favicon.ico`, `icon`, `opengraph-image`, `apple-icon`, `pwa-icon-192/512`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, and any path containing a dot (static files).

**Exports:** `proxy` (middleware function) and `config` (matcher config object).

**Key dependencies:** `next-intl/middleware` (`createMiddleware`), `next/server` (`NextResponse`, `NextRequest`), `./i18n/routing` (`routing`: locales, defaultLocale, pathnames). References docs `LOCALE_RESOLUTION_AUDIT.md §3.1`.

**Flags:** `pathStartsWithLocale` is defined but appears unused within this file (the logic uses `extractUrlLocalePrefix` instead) — possible dead helper (low confidence; may be referenced elsewhere, though as a non-exported function that's unlikely). Otherwise clean and well-documented.

### frontend-next/src/types/pickConfig.ts

**Purpose:** TypeScript type definitions for the advanced pick-types / scoring configuration system (Sprint 2) on the frontend — match-based picks, structural picks, phase configuration, presets, wizard state, and pick/result data shapes.

**What it does:** Pure type module (no runtime code). Logical groups:

- **Match-based pick types:** `MatchPickTypeKey` union (`EXACT_SCORE`, `GOAL_DIFFERENCE`, `PARTIAL_SCORE`, `TOTAL_GOALS`, `MATCH_OUTCOME_90MIN`, `HOME_GOALS`, `AWAY_GOALS`); `MatchPickType` (key, enabled, points, optional config); `AutoScalingConfig` (enabled, basePhase, per-phase `multipliers` map); `MatchPicksConfig` (list of types + optional autoScaling).

- **Structural pick types:** `StructuralPickType` union (`GROUP_STANDINGS`, `GLOBAL_QUALIFIERS`, `KNOCKOUT_WINNER`); `GroupStandingsConfig` (legacy `pointsPerExactPosition`, new per-position points 1–4, perfect-group bonus + flag, optional global-qualifier inclusion/points); `GlobalQualifiersConfig` (totalQualifiers, pointsPerExactPosition, lockDateTime); `KnockoutWinnerConfig` (pointsPerCorrectAdvance); `StructuralPickConfig` union; `StructuralPicksConfig` (type + config).

- **Phase configuration:** `PhasePickConfig` (phaseId, phaseName, requiresScore, optional includeExtraTime, structuralPicks, matchPicks); `PoolPickTypesConfig` = `PhasePickConfig[]`.

- **Presets:** `PickConfigPresetKey` union (`BASIC`, `SIMPLE`, `CUMULATIVE`, `CUSTOM`); `PickConfigPreset` (key, name, description, config).

- **Wizard state (legacy/local):** `WizardStep` (`PRESET_SELECTION` | `PHASE_CONFIG` | `SUMMARY`); `WizardState` (currentStep, selectedPreset, configuration, currentPhaseIndex).

- **Structural pick/result data:** `GroupStandingsPickData` (groupId + ordered teamIds 1°–4°); `KnockoutWinnerPickData` (matchId, winnerId); `GroupStandingsPhasePickData` (groups[]); `KnockoutPhasePickData` (matches[]); `StructuralPickData` union; `GroupStandingsResultData`/`KnockoutWinnerResultData` aliases (host-published results share the pick shapes).

**Exports:** All the above types/unions (all named, no default).

**Key dependencies:** None (self-contained type declarations). Consumed by `poolWizard.ts` (imports `PoolPickTypesConfig`, `PickConfigPresetKey`) and pick-config UI/scoring components.

**Flags:** This file defines a `WizardStep`/`WizardState` pair that is superseded by the richer `WizardStep`/`WizardState` in `poolWizard.ts` (different step enums). The pickConfig versions look like legacy wizard state from the earlier Sprint-2 pick-config wizard; medium confidence they are partly stale/dead now that `poolWizard.ts` drives the unified wizard. `GroupStandingsConfig` keeps a clearly-labelled "Legacy format" field (`pointsPerExactPosition`) alongside the new per-position fields — intentional backwards-compat, not dead.

### frontend-next/src/types/poolWizard.ts

**Purpose:** Defines the unified state shape, step list, actions, and defaults for the pool-creation wizard shared by the standard and corporate flows (`PoolCreationWizard`).

**What it does:** Mostly type declarations plus a few runtime constants:

- **Mode & steps:** `WizardMode` (`standard` | `corporate`); `WizardStep` union (`COMPANY_INFO` corporate-only, `TOURNAMENT`, `NAME_DETAILS`, `SCORING`, `ADVANCED_RULES`, `CAPACITY`, `SUMMARY`). `STANDARD_STEPS` = `[TOURNAMENT, NAME_DETAILS, SCORING, SUMMARY, CAPACITY]`; `CORPORATE_STEPS` = same with `COMPANY_INFO` prepended. A comment documents that the corporate flow no longer has an "invite employees" wizard step — pools are created with only the host as `CORPORATE_HOST`, and employees are invited afterward via `CorporateEmployeeManager` (single source of truth, simpler funnel).

- **`ScoringStyle`** = alias of `PickConfigPresetKey`.

- **`InstancePhase`** interface (id, name, type, optional twoLegged, legNumber) — phase data from the API.

- **`WizardState`** interface — the full reducer state: mode + currentStep; **company info** (companyName, logoBase64, welcomeMessage, invitationMessage, primaryColor/secondaryColor where empty = Picks4All default, and `invitationLocale: "es"|"en"|"pt"` governing only the first activation email per ADR-062); **tournament** (instanceId, instanceName, instancePhases, phasesLoaded); **name & details** (poolName, poolDescription, deadlineMinutesBeforeKickoff, timeZone, requireApproval); **scoring** (scoringStyle, scoringConfig: `PoolPickTypesConfig`); advanced rules stored within scoringConfig; **capacity** (maxParticipants); optional **CC redemption** fields applied at the Capacity step (`accountReceivableId`, `accountReceivableConsec`, `accountReceivableTargetCapacity`, `accountReceivableCurrency`, `accountReceivableAmountCop`, `accountReceivableAmountUsdCents`) which lock capacity to the cuenta-de-cobro's targetCapacity and carry the AR id into checkout for atomic REDEEM (SALES_AUDIT.md §9.7, ADR-061); **UI state** (error, busy).

- **`WizardAction`** union — reducer actions: `GO_TO_STEP`, `SET_FIELD` (generic field/value), `SET_TOURNAMENT`, `SET_PHASES`, `SET_SCORING` (style+config), `UPDATE_SCORING_CONFIG`, `RESTORE` (partial state), `RESET`.

- **Runtime defaults:** `RECOMMENDED_DEADLINE` = `NEXT_PUBLIC_DEFAULT_DEADLINE` env (default 10); `DEFAULT_MAX_PARTICIPANTS_STANDARD` = `NEXT_PUBLIC_PERSONAL_FREE_LIMIT` (default 20); `DEFAULT_MAX_PARTICIPANTS_CORPORATE` = `NEXT_PUBLIC_CORPORATE_FREE_LIMIT` (default 2). A comment stresses these match the FREE_LIMIT tiers (pools are always created at free capacity; paid upgrades apply post-checkout via webhook) and the dev fallbacks mirror backend `lib/pricing.ts`.

**Exports:** Types `WizardMode`, `WizardStep`, `ScoringStyle`, `InstancePhase`, `WizardState`, `WizardAction`; runtime constants `STANDARD_STEPS`, `CORPORATE_STEPS`, `RECOMMENDED_DEADLINE`, `DEFAULT_MAX_PARTICIPANTS_STANDARD`, `DEFAULT_MAX_PARTICIPANTS_CORPORATE`.

**Key dependencies:** imports `PoolPickTypesConfig`, `PickConfigPresetKey` from `./pickConfig`. Phase display names live in i18n (`messages/{locale}/poolWizard.json` → `phases`). Referenced env vars and backend `lib/pricing.ts` for parity.

**Flags:** `ADVANCED_RULES` appears in the `WizardStep` union but is NOT present in either `STANDARD_STEPS` or `CORPORATE_STEPS`, and the state comment notes advanced rules are stored within `scoringConfig` — so the `ADVANCED_RULES` step value looks unused/vestigial (medium confidence). Otherwise clean.

### frontend-next/tsconfig.json

**Purpose:** TypeScript compiler configuration for the Next.js 16 frontend.

**What it does:** Sets `compilerOptions`: `target: ES2018`; libs `dom`/`dom.iterable`/`esnext`; `allowJs`, `skipLibCheck`, `strict` (strict mode on, per the strict-TS standard), `noEmit` (Next handles emit), `esModuleInterop`, `module: esnext`, `moduleResolution: bundler`, `resolveJsonModule`, `isolatedModules`, `jsx: react-jsx`, `incremental`. Loads the `next` TS plugin. Defines path alias `@/*` → `./src/*`. `include` covers `next-env.d.ts`, all `.ts`/`.tsx`/`.mts`, and the generated `.next/types/**` and `.next/dev/types/**`; `exclude` is `node_modules`.

**Exports:** N/A (config file).

**Key dependencies:** Next.js TS plugin; the `@/*` alias must agree with the runtime resolution used across the frontend.

**Flags:** none.

### infra/docker-compose.yml

**Purpose:** Local development Postgres container definition (local DB only; production Postgres is Railway-managed).

**What it does:** Defines one `db` service using `postgres:16` (container `quiniela_postgres`) with env `POSTGRES_USER=quiniela`, `POSTGRES_PASSWORD=quiniela_pass`, `POSTGRES_DB=quiniela_db`, publishes port `5432:5432`, and persists data in the named volume `quiniela_pgdata` mounted at `/var/lib/postgresql/data`. Declares the `quiniela_pgdata` volume.

**Exports:** N/A.

**Key dependencies:** Docker / Docker Compose; `postgres:16` image (matches the production PostgreSQL 16).

**Flags:** Uses hardcoded dev credentials (`quiniela`/`quiniela_pass`) — acceptable for a local-only dev compose, not a secret. No backend/frontend services are defined here (local DB only). Naming still uses the legacy "quiniela" prefix rather than the current Picks4All branding — cosmetic, harmless. No `version:` key (modern Compose spec). none of concern.

### railway.toml

**Purpose:** Railway deployment configuration for the BACKEND service (build + start commands).

**What it does:** `[build]` uses the `nixpacks` builder with `buildCommand = "cd backend && npm install && npm run build"`. `[deploy]` sets `startCommand = "cd backend && npm run start"`. Targets the `backend/` workspace of the monorepo.

**Exports:** N/A.

**Key dependencies:** Railway + nixpacks; the `backend/` package.json `build`/`start` scripts.

**Flags:** This file only configures the backend; the frontend service must be configured separately in Railway (e.g. its own service settings / a different config) — not a defect, just noting the scope. none.
