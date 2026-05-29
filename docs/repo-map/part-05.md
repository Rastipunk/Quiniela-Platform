## Batch 5

### backend/src/lib/scoringBreakdown.ts

**Purpose:** Generates detailed, human-readable scoring breakdowns for each pick (match, group standings, knockout), explaining which scoring rules were evaluated, which matched, and points earned vs. theoretical maximum. Powers the platform's scoring transparency/audit feature (Sprint 2).

**What it does:**
- Defines the type vocabulary for breakdowns: `RuleEvaluation` (a single rule with `matched`, `pointsEarned`, `pointsMax`, `details`), `MatchPickBreakdown`, `GroupEvaluation` + `GroupStandingsBreakdown`, `KnockoutMatchEvaluation` + `KnockoutWinnerBreakdown`, `NoPickBreakdown`, and the discriminated union `ScoringBreakdown`.
- `MATCH_PICK_TYPE_NAMES`: maps `MatchPickTypeKey` enum keys (EXACT_SCORE, GOAL_DIFFERENCE, PARTIAL_SCORE, TOTAL_GOALS, MATCH_OUTCOME_90MIN, HOME_GOALS, AWAY_GOALS) to Spanish display names.
- `isCumulativeScoring(enabledTypes)`: detects the newer additive system by checking for HOME_GOALS / AWAY_GOALS keys.
- `generateMatchPickBreakdown(pick, result, phaseConfig, matchId)`: throws if the phase isn't a score phase. Computes max points two ways: **cumulative** (sum of all enabled type points) when HOME_GOALS/AWAY_GOALS present, else **legacy** (max single type). Handles three cases: no pick (NO_PICK), pick-but-no-result (all rules pending), and pick+result. In cumulative mode it evaluates MATCH_OUTCOME_90MIN, HOME_GOALS, AWAY_GOALS, GOAL_DIFFERENCE, TOTAL_GOALS independently and sums matched points. In legacy mode it evaluates EXACT_SCORE first — if matched, awards the exact points and marks all other rules N/A (pointsMax 0, "No aplica") and returns early; otherwise evaluates GOAL_DIFFERENCE, PARTIAL_SCORE (XOR — exactly one of home/away matches), TOTAL_GOALS, and MATCH_OUTCOME_90MIN, summing each match.
- `GroupStandingsConfigBreakdown` type + helpers `getPointsForPosition` (supports per-position pointsPosition1-4 new format or legacy `pointsPerExactPosition`), `getMaxPositionPointsForGroup`, `isBonusEnabled`.
- `generateGroupStandingsBreakdown(...)`: throws unless phase is GROUP_STANDINGS. Computes theoretical max (per-position points + perfect-group bonus per group), normalizes config for the response, handles no-pick / no-result / full cases. For each group it walks the result team order, compares to the predicted index, awards per-position points, tracks `perfectGroup`, and adds the bonus if every position matched and bonus is enabled. Resolves team names via `teamsMap`.
- `generateKnockoutWinnerBreakdown(...)`: throws unless phase is KNOCKOUT_WINNER. Max = matches × `pointsPerCorrectAdvance`. Builds pick/result maps keyed by matchId, evaluates each match's predicted vs actual winner, awards points on match, and attaches winner display names only when defined (to respect `exactOptionalPropertyTypes`).

**Exports:** Types `RuleEvaluation`, `MatchPickBreakdown`, `GroupEvaluation`, `GroupStandingsBreakdown`, `KnockoutMatchEvaluation`, `KnockoutWinnerBreakdown`, `NoPickBreakdown`, `ScoringBreakdown`; functions `generateMatchPickBreakdown`, `generateGroupStandingsBreakdown`, `generateKnockoutWinnerBreakdown`.

**Key dependencies:** Types from `../types/pickConfig` (PhasePickConfig, MatchPickTypeKey, MatchPickType).

**Flags:** `MatchPickType` is imported but never referenced (unused import). The duplicated MATCH_OUTCOME_90MIN / GOAL_DIFFERENCE / TOTAL_GOALS evaluation blocks across cumulative and legacy branches are intentional but heavily duplicated logic.

### backend/src/lib/scoringPresets.ts

**Purpose:** Defines a small catalog of preset scoring schemes (Clásico, Solo ganador/empate, Marcador pesado) used when configuring pools.

**What it does:** Declares `ScoringPresetKey` union and `ScoringPreset` shape (outcomePoints, exactScoreBonus, allowScorePick). `SCORING_PRESETS` is a record of three presets: CLASSIC (3 outcome + 2 exact bonus), OUTCOME_ONLY (3 outcome, no exact, scorePick disabled), EXACT_HEAVY (2 outcome + 3 exact bonus). `getScoringPreset(key)` returns the preset for a key, defaulting to CLASSIC for null/undefined/unknown keys.

**Exports:** `ScoringPresetKey`, `ScoringPreset` types; `SCORING_PRESETS` const; `getScoringPreset` function.

**Key dependencies:** None.

**Flags:** none.

### backend/src/lib/serializers.test.ts

**Purpose:** Vitest suite for `serializeUser`.

**What it does:** Asserts that `serializeUser` returns only the safe fields (id, email, username, displayName, platformRole, status), strips sensitive fields (passwordHash, emailVerificationToken, createdAt), and returns exactly 6 keys.

**Exports:** none (test file).

**Key dependencies:** vitest, `./serializers`.

**Flags:** The "returns exactly 6 keys" test and the fixture omit the `locale` field that `serializeUser` actually returns (the real serializer emits 7 keys including `locale`). The test's `fullUser` fixture has no `locale`, so `serializeUser` returns `locale: undefined`; `toEqual` with 6 explicit keys and `toHaveLength(6)` would mismatch the current 7-field implementation — the test appears stale relative to serializers.ts (the locale field was added later). Worth flagging as a likely failing/out-of-date test.

### backend/src/lib/serializers.ts

**Purpose:** Centralized entity serializers controlling which fields are safe to expose in API responses, preventing accidental leakage of sensitive fields.

**What it does:** Defines `SerializedUser` (id, email, username, displayName, platformRole, status, locale). `serializeUser(u)` maps a User-like record to that safe shape including `locale` (used by auth handlers to sync the NEXT_LOCALE cookie via setAuthCookies).

**Exports:** `SerializedUser` type; `serializeUser` function.

**Key dependencies:** `PlatformRole` type from `@prisma/client`.

**Flags:** Only a User serializer exists despite the file's framing as a general serializer module; no other entity serializers present. (See serializers.test.ts flag re: the locale field drift.)

### backend/src/lib/syntheticFixtureId.ts

**Purpose:** Deterministically generate synthetic fixture IDs for matches not sourced from API-Football (e.g., manually advanced knockout rounds), avoiding collision with real API-Football IDs.

**What it does:** `generateSyntheticFixtureId(instanceId, internalMatchId)` hashes `"{instanceId}:{internalMatchId}"` via a private `djb2` string hash and maps it into the 900000–999999 range (`900000 + abs(hash) % 99999`). Deterministic so re-running advancement is idempotent. `djb2` is the classic h=5381, `((h<<5)+h)+charCode`, forced to int32.

**Exports:** `generateSyntheticFixtureId` function.

**Key dependencies:** None.

**Flags:** `% 99999` yields range 900000–999998 (top value 999999 unreachable) — harmless off-by-one in the documented range. Otherwise none.

### backend/src/lib/timezone.ts

**Purpose:** Validate that a string is a valid IANA timezone.

**What it does:** `isValidTimezone(tz)` constructs `Intl.DateTimeFormat(undefined, { timeZone: tz })` inside a try/catch, returning true if no throw, false otherwise.

**Exports:** `isValidTimezone` function.

**Key dependencies:** None (uses built-in Intl).

**Flags:** none.

### backend/src/lib/unsubscribe.ts

**Purpose:** Generate and verify tamper-proof, tokenized unsubscribe links for notification emails (the pending unsubscribe-link feature in MEMORY).

**What it does:** Uses an HMAC-SHA256 secret from `JWT_SECRET` (falls back to "fallback-dev-secret"). `generateUnsubscribeToken(userId)` produces `base64url(userId:hmac(userId))`. `verifyUnsubscribeToken(token)` decodes, splits at the last colon, recomputes the HMAC, compares via `crypto.timingSafeEqual`, and returns the userId or null. `buildUnsubscribeUrl(userId, frontendUrl)` returns `{frontendUrl}/unsubscribe?token=...`.

**Exports:** `generateUnsubscribeToken`, `verifyUnsubscribeToken`, `buildUnsubscribeUrl`.

**Key dependencies:** node `crypto`, `process.env.JWT_SECRET`.

**Flags:** `crypto.timingSafeEqual` throws if the two buffers differ in length (e.g., a malformed/truncated signature); it's wrapped in try/catch so it safely returns null, but this means a length-mismatch hits the catch rather than the explicit comparison. Minor.

### backend/src/lib/username.test.ts

**Purpose:** Vitest suite for `validateUsername` and `normalizeUsername`.

**What it does:** Validates acceptance of simple/numeric/hyphen/underscore usernames, 3-char min and 20-char max boundaries; rejection of too-short/empty/too-long, spaces, special chars (@, !, .), leading/trailing hyphen or underscore, and reserved words (admin, root, system, quiniela, api, www) case-insensitively (error contains "reservado"). Confirms trimming and lowercasing before validation. For `normalizeUsername`, asserts trim+lowercase behavior.

**Exports:** none (test file).

**Key dependencies:** vitest, `./username`.

**Flags:** none.

### backend/src/lib/username.ts

**Purpose:** Username validation and normalization utilities.

**What it does:** `validateUsername(username)` trims+lowercases, then enforces: length 3–20, pattern `^[a-z0-9_-]+$`, no leading/trailing `-` or `_`, and not in `RESERVED_USERNAMES`; returns `{ valid, error? }` with Spanish error messages. `normalizeUsername(username)` returns `username.trim().toLowerCase()`.

**Exports:** `validateUsername`, `normalizeUsername`.

**Key dependencies:** `RESERVED_USERNAMES` from `./constants`.

**Flags:** none.

### backend/src/lib/utm.ts

**Purpose:** Append UTM tracking parameters to URLs embedded in transactional/marketing emails.

**What it does:** `appendUtm(url, params)` chooses `?` or `&` separator, URL-encodes and appends utm_source/medium/campaign (and optional utm_content). `emailUtm(campaign, content="cta_button")` is a convenience factory returning `{ source: "email", medium: "email", campaign, content }`.

**Exports:** `appendUtm`, `emailUtm`.

**Key dependencies:** None.

**Flags:** `UtmParams` interface is internal (not exported) — fine. none.

### backend/src/lib/validateBase64Image.ts

**Purpose:** Validate that a base64 string is a real image by inspecting its leading magic bytes.

**What it does:** `ALLOWED_PREFIXES` maps base64 magic-byte prefixes to MIME types (PNG `iVBOR`, JPEG `/9j/`, GIF `R0lGOD`, WebP `UklGR`). `validateBase64Image(input)` strips a `data:...,` URI prefix if present, then returns the matching MIME type or null.

**Exports:** `validateBase64Image`.

**Key dependencies:** None.

**Flags:** none.

### backend/src/middleware/rateLimit.test.ts

**Purpose:** Vitest suite verifying that all exported rate limiters are defined Express middleware and that per-user keying works.

**What it does:** Confirms each limiter (apiLimiter, authLimiter, poolJoinLimiter, passwordResetLimiter, verificationResendLimiter, inviteSendLimiter, inviteSendDailyLimiter, corporateInviteCheckLimiter, corporateActivateLimiter) is a defined function. Checks apiLimiter has ≥3 args (Express signature) as a proxy for the health-check skip. The per-user keying test drives `inviteSendLimiter` directly with a fake req/res, calling twice for userA and once for userB, then asserts userA's RateLimit-Remaining decrements between calls and userB's first hit equals userA's first (separate buckets).

**Exports:** none (test file).

**Key dependencies:** vitest, `./rateLimit`.

**Flags:** none.

### backend/src/middleware/rateLimit.ts

**Purpose:** Centralized express-rate-limit limiter definitions, all overridable via env vars.

**What it does:** `envInt(key, fallback)` parses an int env override; MINUTE/HOUR constants. Limiters: `apiLimiter` (100/min per IP, skips `/health`), `authLimiter` (10/15min), `passwordResetLimiter` (5/hr), `verificationResendLimiter` (3/hr), `poolJoinLimiter` (10/15min), `corporateInviteCheckLimiter` (20/min — protects the unauthenticated invite-check endpoint from token enumeration), `corporateActivateLimiter` (10/15min — protects activation against leaked-token brute force), `inviteSendLimiter` (200/hr keyed per-user via `req.auth.userId`, falling back to IPv6-normalized IP via `ipKeyGenerator`), and `inviteSendDailyLimiter` (1000/day, same keying — guards against compromised host accounts). All use standardHeaders, no legacyHeaders, JSON error codes.

**Exports:** `apiLimiter`, `authLimiter`, `passwordResetLimiter`, `verificationResendLimiter`, `poolJoinLimiter`, `corporateInviteCheckLimiter`, `corporateActivateLimiter`, `inviteSendLimiter`, `inviteSendDailyLimiter`.

**Key dependencies:** `express-rate-limit` (rateLimit, ipKeyGenerator).

**Flags:** none.

### backend/src/middleware/requireAdmin.ts

**Purpose:** RBAC middleware requiring the authenticated user to be an ADMIN.

**What it does:** `requireAdmin(req, res, next)` returns 401 (UNAUTHENTICATED) if `req.auth` missing, 403 (FORBIDDEN) if `platformRole !== "ADMIN"`, else calls `next()`. Must run after `requireAuth`.

**Exports:** `requireAdmin`.

**Key dependencies:** `sendUnauthorized`, `sendForbidden` from `../lib/apiResponse`.

**Flags:** none.

### backend/src/middleware/requireAuth.ts

**Purpose:** Authentication middleware: validates the JWT (cookie-first, header fallback) and that the user exists and is ACTIVE; plus an optional-auth variant.

**What it does:** `extractBearerToken(req)` pulls a Bearer token from the Authorization header. `requireAuth` reads the token from httpOnly cookies (`getTokenFromCookies`) or the header, returns 401 with a specific `reason` (NO_AUTH_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, USER_NOT_FOUND, USER_NOT_ACTIVE, INTERNAL_ERROR) at each failure point, verifies via `verifyToken`, loads the user from Prisma, and on success sets `req.auth = { userId, platformRole }`. `optionalAuth` does the same but never fails: if no/invalid token it proceeds anonymously, only setting `req.auth` when the user is ACTIVE.

**Exports:** `requireAuth`, `optionalAuth`.

**Key dependencies:** `verifyToken` (`../lib/jwt`), `prisma` (`../db`), `getTokenFromCookies` (`../lib/authCookies`), `sendUnauthorized` (`../lib/apiResponse`).

**Flags:** none.

### backend/src/pdf/CcDocument.tsx

**Purpose:** React-PDF template for the Cuenta de Cobro (Account Receivable) document, rendered from an `AccountReceivable` Prisma row plus an issuer snapshot.

**What it does:** Defines a `cc` StyleSheet (LETTER page, Inter font, fixed top header with isotipo + title + consecutive number, city/date line, bordered info blocks, amount-highlight box, payment options, dual-path redemption box, validity, régimen box, signature, fixed footer). Helpers: `formatLongDate` (locale-aware long date), `formatMoneyCop`, `formatMoneyUsd` (cents→dollars), `formatRedemptionCode` (8 digits → `XXXX-XXXX`), `formatDocumentNumber` (Colombian thousands separators), `formatAccountNumber` (`1865-1313-496` grouping). The `CcDocument({ cc: row })` component resolves locale (defaults "es"), pulls the trilingual `dict` from `PDF_DICT`, casts `issuerSnapshotJson` to `IssuerInfo`, and computes the amount text by currency. It renders the header, city/date, "Valor a pagar a" (issuer legal name/doc/address/phone/email), "Por concepto de" (concept), the amount highlight (words + figures), payment methods (Bancolombia transfer block **only when COP** per §11.22, then the online-payment block with the dual-path "new pool vs existing pool" guidance and the redemption code), client data block, validity line, the DIAN régimen tributario phrase **only when locale === "es"** (§11.18), the signature, and a fixed footer with page number.

**Exports:** `CcDocument` (named).

**Key dependencies:** `@react-pdf/renderer`, `AccountReceivable` (`@prisma/client`), `PDF_BRAND` (`./pdfBrand`), `brandAsset` (`./pdfAssets`), `PDF_DICT` (`./i18n`), `SaleLocale` (`../lib/saleTerms`), `IssuerInfo` (`../lib/issuerInfo`).

**Flags:** Footer contact email and "© 2026" are hardcoded literals rather than dictionary entries. none otherwise.

### backend/src/pdf/i18n.ts

**Purpose:** Trilingual (es/en/pt) dictionary of all fixed PDF body copy for Quotes and Accounts Receivable, with `{placeholder}` substitution.

**What it does:** Declares the `PdfDict` interface (document titles, cover/header labels, Quote sections §1–§5 including a `quoteSec3Bullets` array of [heading, body] tuples and `quoteSec5Steps`, CTA copy, CC block labels and function-valued entries like `ccCityDate(city,date)` and `ccValidity(date)`, and a footer `pageLabel`). `ES_BULLETS`, `EN_BULLETS`, `PT_BULLETS` are the 8 corporate-plan feature bullets per language. `PDF_DICT` is a `Record<SaleLocale, PdfDict>` populated for es/en/pt with all copy; `{term}` placeholders are deliberately written to avoid gendered adjective coupling. The Colombian DIAN `ccRegimen` phrase is present only for es; en/pt set it to `""` (never rendered). `substitute(template, values)` replaces `{name}` placeholders, leaving unknown keys intact.

**Exports:** `PdfDict` interface; `PDF_DICT` record; `substitute` function.

**Key dependencies:** `SaleLocale` type from `../lib/saleTerms`.

**Flags:** none (the empty `ccRegimen` for en/pt is intentional per §11.18, documented in-file).

### backend/src/pdf/pdfAssets.ts

**Purpose:** Cache and load brand image assets (as Buffers) and resolve font file paths for @react-pdf/renderer.

**What it does:** Resolves `ASSETS_ROOT` (`../assets/brand`) and `FONTS_ROOT` (`../assets/fonts`) relative to `__dirname`. A module-level `cache` Map holds loaded Buffers. `load(filename, root)` reads-and-caches a file synchronously. `brandAsset(filename)` returns the cached image Buffer (react-pdf's Image accepts Buffers, avoiding the path/URL resolution issues documented in SALES_AUDIT §11.12). `fontAsset(filename)` returns the absolute path string under the fonts root.

**Exports:** `brandAsset`, `fontAsset`.

**Key dependencies:** node `fs`, `path`.

**Flags:** none.

### backend/src/pdf/pdfBrand.ts

**Purpose:** Brand color palette constants for PDF rendering, mirroring the frontend brand tokens.

**What it does:** Exports `PDF_BRAND` — a frozen object of hex colors (primary/secondary/accent indigo-purple family, the `green` accent #7AC943 from the logo, text/muted/border/background subtints, white, and total-row colors for tables).

**Exports:** `PDF_BRAND` const.

**Key dependencies:** None.

**Flags:** Intentionally duplicated from `frontend-next/src/lib/brand.ts` (documented; kept in sync by review). Some tokens (e.g., `primaryLight`, `primaryDark`, `bgGreenSubtle`) may be unused by the current templates — minor.

### backend/src/pdf/pdfFont.ts

**Purpose:** Idempotent registration of the Inter typeface (and a hyphenation override) for @react-pdf/renderer.

**What it does:** A module `registered` guard ensures `ensureInterRegistered()` only registers once. It registers Inter with Regular/SemiBold/Bold and an Italic face via `fontAsset` paths, then `Font.registerHyphenationCallback((word) => [word])` to disable react-pdf's default mid-word hyphenation.

**Exports:** `ensureInterRegistered`.

**Key dependencies:** `Font` from `@react-pdf/renderer`, `fontAsset` (`./pdfAssets`).

**Flags:** none.

### backend/src/pdf/QuoteDocument.tsx

**Purpose:** React-PDF template for the Cotización (Quote) document, trilingual, single-investment layout per §11.14.

**What it does:** Defines `shared`, `cover`, and `body` StyleSheets. Atoms: `RunningHeader` (fixed isotipo + logotipo header) and `RunningFooter({pageLabel})` (fixed footer with contact + page number). Money/date helpers mirror CcDocument (`formatMoneyCop`, `formatMoneyUsd`, `formatDate` short numeric). `QuoteDocument({ quote })` resolves locale + dict + term, formats issue date and amount/per-person text by currency. Renders: an optional **cover page** (gated by `quote.includeCoverPage`) with isotipo, logo, green rule, title, tagline, "prepared for" client + date, and contact; **body page 1** with §1 Datos del Cliente (3-row table), §2 ¿Qué es Picks4All? (two paragraphs, `{term}` substituted), §3 feature bullets (mapped from `dict.quoteSec3Bullets`, each `wrap={false}`); **body page 2** with §4 Inversión (intro + optional tournament suffix, optional `investmentDescription`, a single-row price table showing total label/amount/per-person) + disclaimer, and §5 ¿Cómo empezamos? (numbered steps with alternating backgrounds) plus a CTA box. Every section uses `wrap={false}` per §11.23.

**Exports:** `QuoteDocument` (named).

**Key dependencies:** `@react-pdf/renderer`, `Quote` (`@prisma/client`), `PDF_BRAND`, `brandAsset`, `PDF_DICT` + `substitute` (`./i18n`), `SaleLocale` (`../lib/saleTerms`).

**Flags:** Footer contact email + "© 2026" hardcoded (same as CcDocument). none otherwise.

### backend/src/pdf/renderCcPdf.tsx

**Purpose:** Entry point to render an `AccountReceivable` row to a PDF Buffer.

**What it does:** `renderCcPdf(cc)` calls `ensureInterRegistered()` then `renderToBuffer(<CcDocument cc={cc} />)`, returning the Buffer.

**Exports:** `renderCcPdf` (async).

**Key dependencies:** `@react-pdf/renderer` (renderToBuffer), `AccountReceivable` (`@prisma/client`), `ensureInterRegistered` (`./pdfFont`), `CcDocument` (`./CcDocument`).

**Flags:** none.

### backend/src/pdf/renderQuotePdf.tsx

**Purpose:** Entry point to render a `Quote` row to a PDF Buffer.

**What it does:** `renderQuotePdf(quote)` registers the Inter font then returns `renderToBuffer(<QuoteDocument quote={quote} />)`. JSDoc shows the intended route-handler streaming usage.

**Exports:** `renderQuotePdf` (async).

**Key dependencies:** `@react-pdf/renderer`, `Quote` (`@prisma/client`), `ensureInterRegistered`, `QuoteDocument`.

**Flags:** none.

### backend/src/routes/admin.ts

**Purpose:** Top-level admin router — a thin HTTP layer that mounts all admin sub-routers and exposes a handful of direct admin endpoints (stats, jobs, seeding, R16 maintenance, prediction-update mass email).

**What it does:**
- Creates `adminRouter` and mounts sub-routers: `adminTemplatesRouter` and `adminInstancesRouter` at `/`, `adminSettingsRouter` at `/settings`, `adminCorporateRouter` at `/corporate`, both `analyticsHealthRouter` and `adminAnalyticsDashboardRouter` at `/analytics`, and `adminSalesRouter` at `/sales`.
- Helpers: `auditCtx(req)` builds an `AuditContext` (ip + user-agent); `handleServiceError(res, err)` maps `ServiceError.statusHint` (400/401/403/404/409/500) to the corresponding `send*` helper and re-throws unexpected errors.
- `fixR16IntegritySchema`: zod for the `dryRun` query enum.
- Routes (all `requireAuth` + `requireAdmin`): `GET /ping` (RBAC smoke test), `GET /stats` (→ `getPlatformStats`), `POST /bootstrap-admin` (disabled — returns 404), `POST /jobs/trigger-fixture-tracking` (dynamically imports and fire-and-forgets `triggerFixtureTracking`, writes an audit event), `POST /seed-wc2026` (→ `seedWc2026`), `POST /update-ucl-r16` (→ `updateUclR16`), `GET /audit/r16-late-picks` (→ `auditR16LatePicks`), `POST /fix-r16-integrity` (defaults dryRun true → `fixR16Integrity`).
- Prediction-update mass send: `predictionUpdateSchema` (1–50 change objects). `POST /prediction-update` queries ACTIVE users with `predictionUpdates` + `emailNotificationsEnabled`, writes an audit event, then fire-and-forgets sending `sendPredictionUpdateEmail` in batches of `PREDICTION_EMAIL_BATCH_SIZE` (10) with a 1s delay between batches via `Promise.allSettled`, logging sent/failed counts, and returns immediately with `emailsQueued`.

**Exports:** `adminRouter`.

**Key dependencies:** express, zod, `requireAuth`/`requireAdmin`, `apiResponse` send helpers, `ServiceError`/`AuditContext` (`../services/authService`), `adminService` functions, `prisma`, `sendPredictionUpdateEmail`, `writeAuditEvent`, `fireAndForget`, `resolveUserLocale`, and the seven admin sub-routers.

**Flags:** `auditCtx` is defined but never used in this file (dead helper). The `import type { AuditContext }` exists only to type that unused helper. Minor dead code.

### backend/src/routes/adminAnalyticsDashboard.ts

**Purpose:** Single admin-only platform analytics dashboard endpoint that assembles a large growth/health payload from many fault-isolated query bundles, with a 60-second in-memory cache.

**What it does:**
- Module state: `CACHE_TTL_MS = 60_000` and a `cache` holder. A large set of `interface` definitions describes the full `DashboardPayload` and all sub-shapes (TopLineKPIs, TopLineWeekAgo, Weekly* series, DailyActive, CountryRow, TournamentRow, ActivationFunnel, CorporateFunnel, AcquisitionRow/Funnel, CohortActivation/CohortRow, TopReferrer/Inquiry/Org rows, PoolHealth, PaymentBreakdown, OperationalHealth, EngagementSignals + Top players/hosts/tournament rows, CommunicationsHealth).
- `errors` is a module-level array; `safeRun(section, fallback, fn)` runs each section, logs + records any error into `errors`, and returns the fallback on failure so one broken section doesn't sink the dashboard. `isoDate(d)` formats YYYY-MM-DD. A set of `DEFAULT_*` constants supply fallbacks.
- `buildDashboardData()` resets `errors`, computes 7/14/30/90-day boundaries, and runs each section under `safeRun`:
  - **topLine**: parallel counts (users/verified/google/marketing/prediction subscribers, pool status groupBy, corporate pool count, organizations, pending inquiries, invite status groupBy, the three pick-table counts, pending-approval members) plus raw SQL UNION queries for distinct active users 7d/30d across all three pick tables, and payment sum aggregates (USD/COP). Derives totals, invite activation rate, and `totalPicks` (sum of three pick tables).
  - **topLineWeekAgo**: mirrors top-line metrics with the clock rolled back 7 days (cumulative/windowed only) for inline week-over-week deltas.
  - **localeDistribution**: SQL group-by `locale` (null → "pending"), with percentages — also surfaces locale-modal completion.
  - Time series (last ~90d): **signupsByWeek**, **poolsByWeek** (personal vs corporate), **picksByWeek** (full-outer-joined across the three pick tables), **revenueByWeek**, **dailyActiveUsers** (unified pick tables, last 30d).
  - Geo/tournaments: **usersByCountry** (top 20 + pct), **poolsByStatus** (Prisma groupBy), **poolsByTournament** (SQL join with avg active members), **poolSizeDistribution** (CASE buckets).
  - **funnel**: lifetime activation funnel (signups → joinedPool → madePick across all three pick tables) with rates.
  - **corporateFunnel**: inquiries/responses, active orgs, corporate pools, invites by status, sent-not-expired vs expired counts, response/activation rates.
  - **acquisitionFunnel**: top 10 source/medium combos cross-referenced with joins + picks → per-channel pickRate.
  - **cohortActivation**: last 8 weekly cohorts, % joined/picked within 14 days of signup, with `inProgress` flag for cohorts <14d old.
  - **topAcquisition**: top 10 source/medium counts.
  - **organicReferrals**: total referred count + top 10 referrers via self-join.
  - **recentInquiries**: latest 15 org inquiries + computed response lag hours.
  - **topOrganizations**: top 15 orgs by pool count with invite totals/activations.
  - **poolHealth**: zombiePools (ACTIVE with no picks in any table), poolsWithNoMembers (ACTIVE with no non-host active members), emptyDraftsOlderThan30Days, fullPools (members ≥ maxParticipants).
  - **cohortRetention**: last 8 cohorts' W1/W2/W4 retention across unified pick tables, with per-bucket `inProgress` flags.
  - **paymentBreakdown**: status groupBy, by-provider (Polar vs Mercado Pago vs unknown, by currency, with revenue), by-tier (from/to capacity), avg USD/COP, byStatus, staleAbandonedCount (PENDING >24h), avgTimeToPaymentMinutes.
  - **operationalHealth**: email suppressions, failed analytics events, last 10 feedback, audit events in last 24h.
  - **communicationsHealth**: daily LOCALE_PREFERENCE_SET audit completions (30d), modal completion rate, weekly email suppressions (90d), weekly feedback pivoted into bug/feature/other.
  - **engagementSignals**: top 10 players by picks (30d), top 10 hosts by total active members, per-tournament engagement (pools/members/picks/unique pickers).
- Returns the assembled payload with `generatedAtUtc`, `cacheTtlSeconds`, and a copy of `errors`.
- Route: `GET /dashboard` (`requireAuth` + `requireAdmin`) — serves the cached payload if fresh and `?refresh=true` is absent, otherwise rebuilds, caches, and returns `{ ...data, cached }`. On total failure returns 500 with the error message.

**Exports:** `adminAnalyticsDashboardRouter`.

**Key dependencies:** express, `requireAuth`/`requireAdmin`, `sendData`/`sendInternal`, `prisma` (heavy use of `$queryRaw` and groupBy/aggregate). Notable that it queries Polar + Mercado Pago payment columns (`polarOrderId`, `mpPreferenceId`) — Wompi is absent, consistent with its deprecation.

**Flags:** The `errors` array is **module-level (shared across requests)**: `buildDashboardData` resets it with `errors.length = 0` at the start, but because dashboard builds run sequentially behind the cache this is usually fine — still a latent concurrency hazard if two uncached rebuilds overlap (errors could bleed between requests). The `CommunicationsHealth` JSDoc block above `TopPlayerRow` is mis-positioned (a doc comment for communications sits over the engagement types). The `cacheTtlSeconds` is derived but the only consumer is the frontend. No Wompi references (good — confirms deprecation).

### backend/src/routes/adminCorporate.ts

**Purpose:** Admin-only CRUD for the corporate sales pipeline: organization inquiries, organizations, corporate pools, and bulk user creation.

**What it does:**
- All routes guarded by `requireAuth` + `requireAdmin` at the router level.
- **Inquiries**: `inquiryQuerySchema` (zod-coerced `responded`/page/limit clamped to PAGINATION limits). `GET /inquiries` lists paginated inquiries (optional responded filter) including org id/name. `PATCH /inquiries/:id` marks an inquiry responded (sets `respondedAt`), 404 if missing, and writes a `CORPORATE_INQUIRY_RESPONDED` audit event.
- **Organizations**: `createOrgSchema` / `updateOrgSchema` (zod). `POST /organizations` creates an Organization (status ONBOARDING), optionally links a supplied `inquiryId` (best-effort), and audits `CORPORATE_ORGANIZATION_CREATED`. `GET /organizations` lists paginated orgs (optional status filter) with `_count` of pools/inquiries. `PATCH /organizations/:id` updates an org (404 if missing) and audits `CORPORATE_ORGANIZATION_UPDATED`.
- **Corporate pools**: `createPoolSchema` (name, description, tournamentInstanceId UUID, logoUrl). `POST /organizations/:orgId/pools` verifies org + tournament instance exist, creates a `Pool` (status ACTIVE, copying the instance's `dataJson` into `fixtureSnapshot`, falling back to org logo), adds the admin as a HOST `PoolMember`, and audits `CORPORATE_POOL_CREATED`.
- **Bulk users**: `bulkCreateUsersSchema` (1–500 emails, optional poolId). `POST /bulk-create-users` validates an optional pool, finds existing users by email, then for each new email creates a User with a random username suffix (`CRYPTO_BYTES.USERNAME_SUFFIX`), derived displayName, random password (`CRYPTO_BYTES.GENERATED_PASSWORD`, bcrypt-hashed), `emailVerified: true`, and fires off a welcome email. If a poolId is given, it adds all (new + existing) non-member users as ACTIVE PLAYER `PoolMember`s via `createMany`. Audits `CORPORATE_BULK_USERS_CREATED` and returns created/existing/addedToPool + a summary.

**Exports:** `adminCorporateRouter`.

**Key dependencies:** express, `Prisma`/`prisma`, zod, node `crypto`, `PAGINATION`/`CRYPTO_BYTES` constants, `requireAuth`/`requireAdmin`, `writeAuditEvent`, `hashPassword`, `sendWelcomeEmail`, apiResponse send helpers.

**Flags:** `GET /organizations` parses page/limit manually with `parseInt || default` instead of the zod-coerce pattern used by `GET /inquiries` (inconsistent, and the in-file comment on `inquiryQuerySchema` explicitly warns against this pattern) and uses `where: any`. The status filter allows `"INQUIRY"` though `createOrgSchema` never creates one (orgs start at ONBOARDING) — harmless. Otherwise functional; none critical.
