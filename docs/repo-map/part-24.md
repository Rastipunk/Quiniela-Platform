## Batch 24

This batch covers the frontend's `lib/` layer: the entire API-client family (`lib/api/*`), error handling, marketing attribution/analytics glue, branding, pricing, sales terminology, SEO/site config, theme tokens, timezone/country/tournament catalogs, and form-validation constants. These are the shared utilities that pages, hooks, and components import; almost no React/JSX lives here.

---

### frontend-next/src/lib/api/admin.ts

**Purpose:** Typed API wrappers for the platform-admin surface — email settings, beta feedback management, and the analytics dashboard.

**What it does:**
- `getAdminEmailSettings(token)` / `updateAdminEmailSettings(token, settings)` — GET/PUT `/admin/settings/email`. The four toggles (`emailWelcomeEnabled`, `emailDeadlineReminderEnabled`, `emailResultPublishedEnabled`, `emailPoolCompletedEnabled`) are typed as `PlatformEmailSettings`; the update response echoes the new settings plus a `changes` diff map (`{ from, to }` per field).
- `getAdminFeedback(token, params?)` — GET `/feedback/admin` with optional `type`, `wantsContact`, `page`, `limit` query params, returning paginated `BetaFeedbackItem[]`.
- `submitFeedback(type, message, imageBase64?, wantsContact?, contactName?, phoneNumber?)` — POST `/feedback`. Reads the auth token via `getToken()` only to detect browser context, and injects `window.location.href` as `currentUrl`. This is the public submit path (not admin).
- `getAdminAnalyticsDashboard(forceRefresh=false)` — GET `/admin/analytics/dashboard`, optionally with `?refresh=true`. Returns the large `AnalyticsDashboardResponse` aggregate.
- Defines an extensive set of analytics types: `AnalyticsTopLineKPIs` (users, pools, picks, revenue in USD cents and COP pesos, corporate invites, etc.), `AnalyticsTopLineWeekAgo` (week-over-week comparison subset), `AnalyticsLocaleRow`, and `AnalyticsDashboardResponse` which holds dozens of nested report sections: locale distribution, weekly signups/pools/picks/revenue, DAU, country breakdown, pool status/tournament/size distributions, acquisition + cohort funnels, organic referrals, corporate funnel, pool health (zombie pools, empty drafts), cohort retention, engagement signals (top players/hosts/tournament engagement), communications health, payment breakdown (by provider/tier/status, conversion rate), operational health, and a per-section `errors` array.

**Exports:** Types `PlatformEmailSettings`, `AdminEmailSettingsResponse`, `BetaFeedbackItem`, `AdminFeedbackResponse`, `AnalyticsTopLineKPIs`, `AnalyticsTopLineWeekAgo`, `AnalyticsLocaleRow`, `AnalyticsDashboardResponse`; functions `getAdminEmailSettings`, `updateAdminEmailSettings`, `getAdminFeedback`, `submitFeedback`, `getAdminAnalyticsDashboard`.

**Key dependencies:** `requestJson` from `./client`, `getToken` from `../auth`.

**Flags:** The `token` parameter on `getAdminEmailSettings`, `updateAdminEmailSettings`, and `getAdminFeedback` is unused — auth is cookie-based via `requestJson`. The param is kept for signature consistency with other API modules (same convention noted explicitly in `sales.ts`). Minor dead parameter, not harmful.

---

### frontend-next/src/lib/api/auth.ts

**Purpose:** Auth API wrappers — login, register, Google OAuth, password recovery, email verification, logout.

**What it does:**
- `login(email, password)` — POST `/auth/login`.
- `register(...)` — POST `/auth/register`. Pulls Meta cookies via `getMetaCookies()` and marketing attribution via `getAttributionPayload()`, sends consent flags (`acceptTerms/Privacy/Age/Marketing`), `fbClickId`/`fbBrowserId`, and the `attribution` object. On success (token present) it calls `clearAttribution()` so a later re-login from the same browser doesn't re-send first-touch attribution.
- `forgotPassword(email)` / `resetPassword(token, newPassword)` — POST `/auth/forgot-password` and `/auth/reset-password`.
- `loginWithGoogle(idToken, timezone?, consent?)` — POST `/auth/google`, same Meta + attribution enrichment as register, clears attribution on success.
- `verifyEmail(verificationToken)` — POST `/auth/verify-email`.
- `logout()` — POST `/auth/logout`.
- `resendVerificationEmail(token)` — POST `/auth/resend-verification` (token param unused; auth is cookie-based).

**Exports:** Types `LoginResponse`, `RegisterConsentOptions`, `VerifyEmailResponse`; functions `login`, `register`, `forgotPassword`, `resetPassword`, `loginWithGoogle`, `verifyEmail`, `logout`, `resendVerificationEmail`.

**Key dependencies:** `requestJson` from `./client`, `getMetaCookies` from `@/lib/metaPixel`, `getAttributionPayload`/`clearAttribution` from `@/lib/attribution`.

**Flags:** `resendVerificationEmail(token)` accepts a `token` it never uses. Harmless signature artifact.

---

### frontend-next/src/lib/api/client.ts

**Purpose:** The shared low-level HTTP client used by every other API module.

**What it does:**
- `getApiBase()` resolves the API origin: prefers `NEXT_PUBLIC_API_URL`, falls back to `http://localhost:3000` for local dev. Exported as `API_BASE`.
- `requestJson<T>(path, init)` — the core fetch wrapper: sets `Accept: application/json`, auto-sets `Content-Type: application/json` when a body is present, enforces a 30s timeout via `AbortController` (skipped if the caller passes its own `signal`), and always uses `credentials: "include"` so the httpOnly auth cookie travels. It parses the response body as JSON (falling back to raw text), and on non-2xx throws an `ApiError` carrying status, an `error`/code field, a human message, and the raw payload. A timeout surfaces as `ApiError(0, "TIMEOUT", ...)`. On a 401 in the browser, if a logged-in token hint existed it calls `clearToken()` and `markSessionExpired()` to drive the UI to re-auth.

**Exports:** `API_BASE`, `requestJson`.

**Key dependencies:** `clearToken`, `getToken`, `markSessionExpired` from `../auth`; `ApiError` from `../apiError`.

**Flags:** none.

---

### frontend-next/src/lib/api/corporate.ts

**Purpose:** Corporate-pool API: pool creation, employee/invite management, branding edits, account activation, and the public corporate inquiry (quote) submission.

**What it does:**
- `createCorporatePool(token, input)` — POST `/corporate/pools`. `CreateCorporatePoolInput` includes company branding (logo, welcome/invitation messages, primary/secondary hex colors), `invitationLocale`, pool config (tournament instance, name, timezone, deadline, approval, pick types, max participants) and an initial `emails[]` list.
- `getCorporateEmployees(token, poolId, params)` — GET `/corporate/pools/:poolId/employees` with search/status/page/limit query building. Returns `CorporateEmployeesResponse` with derived per-invite status (`PENDING|SENT|ACTIVATED|FAILED|EXPIRED`, where EXPIRED is computed server-side) plus a summary tally and pagination.
- `bulkResendExpiredInvitations(token, poolId)` — POST `.../employees/bulk-resend-expired`, returns attempted/sent/failed/hasMore.
- `addCorporateEmployees(token, poolId, emails)` — POST `.../employees`.
- `sendCorporateInvitations(token, poolId)` — POST `.../send-invitations`.
- `deleteCorporateEmployee(token, poolId, inviteId)` — DELETE.
- `resendCorporateInvitation(token, poolId, inviteId)` — POST `.../resend` (rotates token per the CLAUDE invariant on resend).
- `updatePoolBranding(token, poolId, input)` — PATCH `.../branding`; supports null-to-clear / omit-to-keep semantics for logo, colors, messages, and `invitationLocale`. Returns `fieldsChanged[]` and the resulting branding snapshot.
- `checkCorporateInvite(token)` — GET `/auth/check-corporate-invite?token=...` (returns email, alreadyExists, pool/company name).
- `activateCorporateAccount(input)` — POST `/auth/activate-corporate` (single-use activation per CLAUDE invariant).
- `submitCorporateInquiry(input)` — POST `/corporate/inquiry`. `SubmitCorporateInquiryInput` carries company/contact, ISO country, currency (COP|USD), a `poolsConfig: number[]` (per-pool slot counts the backend derives `numberOfPools`/`slotsPerPool` from), message, and locale.

**Exports:** Types `CreateCorporatePoolInput`, `CreateCorporatePoolResponse`, `DerivedInviteStatus`, `CorporateInvite`, `CorporateEmployeesResponse`, `ListCorporateEmployeesParams`, `ActivateCorporateInput`, `ActivateCorporateResponse`, `CheckCorporateInviteResponse`, `BulkResendExpiredResponse`, `UpdatePoolBrandingInput`, `UpdatePoolBrandingResponse`, `SubmitCorporateInquiryInput`, `SubmitCorporateInquiryResponse`; corresponding functions above.

**Key dependencies:** `requestJson` from `./client`. Aligns with CLAUDE invariants 10 (`invitationLocale` governs first email only) and the corporate activation/resend rules.

**Flags:** `token` params on most functions are unused (cookie auth). Consistent with module convention.

---

### frontend-next/src/lib/api/groupStandings.ts

**Purpose:** API for Estratega group-standings predictions and host-published results.

**What it does:**
- `saveGroupStandingsPick` / `getGroupStandingsPick` — PUT/GET `/pools/:poolId/group-standings/:phaseId/:groupId` (player's ordered `teamIds`).
- `publishGroupStandingsResult` / `getGroupStandingsResult` — PUT/GET `/pools/:poolId/group-standings-results/:phaseId/:groupId` (host override with optional `reason`).
- `generateGroupStandings` — POST `.../group-standings-generate/...` (auto-derive standings from match results).
- `getGroupMatchResults(token, poolId, groupId)` — GET `.../group-match-results/:groupId` (match list + completed/total counts).
- `getGroupStandingsStats(token, poolId, phaseId, groupId)` — GET `.../group-standings-stats/...`. Returns `GroupStandingsStats` (live `TeamStandingRow[]` with FIFA-style Pos/PJ/G/E/P/GF/GC/DG/Pts, plus published team IDs/version/reason for divergence detection in the ClassicStandingsTable).

**Exports:** Types `TeamStandingRow`, `GroupStandingsStats`; functions `saveGroupStandingsPick`, `getGroupStandingsPick`, `publishGroupStandingsResult`, `getGroupStandingsResult`, `generateGroupStandings`, `getGroupMatchResults`, `getGroupStandingsStats`.

**Key dependencies:** `requestJson` from `./client`.

**Flags:** Heavy use of `any` for prediction/result/standings payloads (boundary types, allowed by CLAUDE rules but loose).

---

### frontend-next/src/lib/api/index.ts

**Purpose:** Barrel re-export so consumers can `import { ... } from "@/lib/api"`.

**What it does:** Re-exports `API_BASE` from `./client` and `export *` from auth, user, pools, picks, groupStandings, scoring, corporate, admin, and sales.

**Exports:** Everything from the listed sibling modules.

**Key dependencies:** All sibling `api/*` modules.

**Flags:** Notably does NOT re-export `payments.ts` or `paymentAttemptEvent.ts` (those are imported directly by their consumers). Minor inconsistency, not a bug.

---

### frontend-next/src/lib/api/paymentAttemptEvent.ts

**Purpose:** Client-side telemetry beacons for the payment-attempt lifecycle (feature F-13, ADR-066), persisting `PaymentEvent` rows with `source=CLIENT`.

**What it does:**
- Defines `ClientEventType`: `REDIRECT_INITIATED`, `REDIRECT_FAILED`, `USER_CANCELLED`, `CLIENT_ERROR`, `BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB`, and `PaymentAttemptEventBody { eventType, details? }`.
- `reportPaymentAttemptEvent(paymentId, body)` — best-effort POST to `/payments/attempts/:paymentId/event`. No-ops without a `paymentId`; swallows all errors silently so a failed beacon never disrupts the payment flow.
- `reportPaymentAttemptEventBeacon(paymentId, body)` — uses `navigator.sendBeacon` with a `text/plain` Blob (a CORS "simple request" to avoid a preflight that would race page unload). Used from `beforeunload`/`pagehide`. Returns true if the browser queued the beacon; all failure modes return false silently.

**Exports:** Type `ClientEventType`, interface `PaymentAttemptEventBody`; functions `reportPaymentAttemptEvent`, `reportPaymentAttemptEventBeacon`.

**Key dependencies:** `API_BASE`, `requestJson` from `./client`. Pairs with backend `recordClientEvent` in `services/paymentService.ts`.

**Flags:** none.

---

### frontend-next/src/lib/api/payments.ts

**Purpose:** Payment API client — Polar/MP checkout creation, MP Brick processing, country detection for gateway routing, and status polling.

**What it does:**
- `getPaymentCountry()` — calls `ipapi.co/country_code/` (3s timeout, no key) to detect the user's country for gateway routing; caches the result in module-level `_cachedCountry`; defaults to `"US"` on failure.
- `createCheckout(poolId, targetCapacity, accountReceivableId?)` — POST `/payments/checkout` (Polar). Optional `accountReceivableId` ties the payment to a cuenta de cobro that the backend atomically locks (per ADR-061 / SALES_AUDIT).
- `createMpCheckout(...)` — POST `/payments/mp-checkout` (Mercado Pago / Colombia), returns `MpCheckoutResponse` (publicKey, paymentId, amountCop, reference, preferenceId).
- `processMpPayment(paymentId, formData, metaCookies?)` — POST `/payments/mp-process`, forwarding the Brick's native formData plus optional Meta `fbc/fbp` cookies for CAPI dedup.
- `getPaymentStatus(poolId)` — GET `/payments/pool/:poolId/status`, returns `PaymentStatusResponse` (status, capacity range, amount, currency, poolType, gateway `transactionId`, `metaEventId`, `paidAtUtc`).

**Exports:** Interfaces `CheckoutResponse`, `PaymentStatusResponse`, `MpCheckoutResponse`, `MpProcessMetaCookies`; functions `getPaymentCountry`, `createCheckout`, `createMpCheckout`, `processMpPayment`, `getPaymentStatus`.

**Key dependencies:** `requestJson` from `./client`; external `ipapi.co`.

**Flags:** none (Wompi correctly absent — MP is the COP gateway).

---

### frontend-next/src/lib/api/picks.ts

**Purpose:** Match-pick, structural-pick, and result API wrappers, including the Estratega knockout-winner publish path.

**What it does:**
- `upsertPick` / `upsertResult` — PUT match pick / match result for `/pools/:poolId/picks/:matchId` and `/results/:matchId`. `MatchResultBody` supports regulation-time (`homeGoals90`/`awayGoals90`), penalties, and an override `reason`.
- `getMatchPicks` — GET `/pools/:poolId/matches/:matchId/picks` (reveals other players' picks once unlocked).
- `upsertStructuralPick` / `getStructuralPick` / `listStructuralPicks` — Estratega phase predictions.
- `publishStructuralResult` / `getStructuralResult` / `listStructuralResults` — host structural results.
- `publishKnockoutMatchWinner(token, poolId, phaseId, matchId, { winnerId, reason? })` — PUT a single knockout winner; if the server returns `400 REASON_REQUIRED_FOR_OVERRIDE` the caller must collect a reason and retry (override triggers email-everyone). Returns `{ result, isOverride, autoAdvance }`.

**Exports:** Types `MatchPickBody`, `MatchResultBody`, `UpsertResponse`, `StructuralRecord`, `MatchPicksResponse`; the functions above.

**Key dependencies:** `requestJson` from `./client`; `StructuralPickData` type from `@/types/pickConfig`.

**Flags:** none.

---

### frontend-next/src/lib/api/pools.ts

**Purpose:** Pool CRUD, joining, overview, invites, member management, host/admin actions, and notifications.

**What it does:**
- Dashboard/catalog: `getMePools` (GET `/me/pools`), `listInstances`/`listCatalogInstances` (GET `/catalog/instances`), `getInstancePhases`.
- Pool CRUD: `createPool` (POST `/pools`), `joinPool` (POST `/pools/join` by code), `getPoolOverview` (GET `/pools/:id/overview` with `leaderboardVerbose` toggle), `archivePool`.
- Invites: `createInvite` (optional maxUses/expiresAt), `getPoolInvites`, `deletePoolInvite`, `sendPoolInviteEmail`.
- `leavePool` (PLAYER only per invariant 4), `getPoolNotifications` (pending picks, urgent deadlines, pending joins/results, phases ready to advance).
- Host actions: `updatePoolSettings` (autoAdvance/requireApproval/extraTimePhases), `manualAdvancePhase`, `lockPhase`, `updatePoolScoringConfig` (PATCH `/scoring-config` — "Administrar reglas", DRAFT-only per invariant 3).
- Member management: `promoteMemberToCoAdmin`, `demoteMemberFromCoAdmin`, `getPendingMembers`, `approveMember`, `rejectMember`, `kickMember`, `banMember` (last two accept `confirmRevert` to acknowledge the 409 `REVERT_PENDING_CONFIRMATION` auto-revert-to-DRAFT path per invariant 3), `setScoringOverride`.

**Exports:** Types `ScoringPresetKey`, `CatalogInstance`, `MePoolRow`, `InstancePhase`, `CreatePoolInput`, `PoolNotifications`, `PoolInviteRow`; re-exports `PoolOverview` type from `../poolTypes`; all the functions above.

**Key dependencies:** `requestJson` from `./client`; `PoolOverview` from `../poolTypes`.

**Flags:** Pervasive `any` return types and `[key: string]: any` index signatures (loose boundary typing). Not dead code.

---

### frontend-next/src/lib/api/sales.ts

**Purpose:** Sales API — admin issuance of Quotes and Cuentas de Cobro (AccountReceivable) plus customer-facing redemption (ADR-061).

**What it does:**
- Shared enums/types: `SaleLocale`, `SaleCurrency`, `QuoteStatus`, `AccountReceivableStatus`, `IssuerSnapshot`.
- Quotes: `createQuote` (POST `/admin/sales/quotes`), `listQuotes` (with filters → query string), `getQuote`, `cancelQuote` (PATCH status → CANCELLED — soft revoke per invariant 9, never delete). `quotePdfUrl(id)` builds the absolute PDF URL (`${API_BASE}/admin/sales/quotes/:id/pdf`) for `<a download>`/`window.open` with cookie credentials.
- Account receivables: `createAccountReceivable`, `listAccountReceivables`, `getAccountReceivable`, `cancelAccountReceivable` (PATCH → CANCELLED), `markAccountReceivablePaid` (PATCH → PAID), `accountReceivablePdfUrl(id)`.
- Customer redemption: `redeemAccountReceivable(_token, redemptionCode)` — POST `/sales/account-receivables/redeem`, returns the narrower `RedemptionSummary` (capacity, currency, amounts, poolType, validUntil) used by the wizard to lock capacity and show the applied banner.

**Exports:** Types/interfaces `SaleLocale`, `SaleCurrency`, `QuoteStatus`, `AccountReceivableStatus`, `IssuerSnapshot`, `QuoteRow`, `CreateQuoteInput`, `CreateQuoteResponse`, `ListQuotesFilters`, `ListQuotesResponse`, `AccountReceivableRow`, `CreateAccountReceivableInput`, `CreateAccountReceivableResponse`, `ListAccountReceivablesFilters`, `ListAccountReceivablesResponse`, `RedemptionSummary`; all functions above plus the two PDF-URL helpers.

**Key dependencies:** `API_BASE`, `requestJson` from `./client`.

**Flags:** All functions take a leading `_token` param that is intentionally unused (documented in the header). Convention artifact, not dead code.

---

### frontend-next/src/lib/api/scoring.ts

**Purpose:** Scoring API — per-match/phase/group breakdowns and the player-summary aggregate, with detailed typing for both score-based and structural (Estratega) scoring.

**What it does:**
- Breakdown type hierarchy: `RuleEvaluation`, `MatchPickBreakdown`, `GroupEvaluation`, `GroupStandingsBreakdown`, `KnockoutMatchEvaluation`, `KnockoutWinnerBreakdown`, `NoPickBreakdown`, union `ScoringBreakdown`, and `GroupSingleBreakdown`.
- `getMatchBreakdown` (GET `/pools/:id/breakdown/match/:matchId` — returns breakdown + match meta), `getPhaseBreakdown`, `getGroupBreakdown`.
- Player summary types: `PlayerSummaryMatch`, `PlayerSummaryPhase`, structural types `StructuralStatsSummary`, `StructuralGroupDetail` (with `isPredictionVisible` gating), `StructuralKnockoutDetail`, `StructuralPhaseAggregate`, `StructuralBreakdownDetail`, `PresetMode`, and the combined `PlayerSummaryResponse`.
- `getPlayerSummary(token, poolId, userId)` — GET `/pools/:id/players/:userId/summary`.

**Exports:** All the breakdown/summary types listed and functions `getMatchBreakdown`, `getPhaseBreakdown`, `getGroupBreakdown`, `getPlayerSummary`.

**Key dependencies:** `requestJson` from `./client`.

**Flags:** none.

---

### frontend-next/src/lib/api/user.ts

**Purpose:** User API — profile read/update, GA4-aggregated snapshot, first-login locale preference, country detection, and email notification preferences.

**What it does:**
- `getUserProfile` / `updateUserProfile` — GET/PATCH `/users/me/profile`. `UserProfile` includes profile fields plus `locale`, `requestedLocale`, and `needsLocalePrompt` (drives the first-login LocalePreferenceModal).
- `getUserAggregated()` — GET `/me/aggregated`, returns `UserAggregatedSnapshot` (pool counts, tier, is_corporate, country, account age, acquisition source/campaign, verification, signup method, predictions count, last active, host count) used to populate GA4 user_properties.
- Locale preference: `setLocalePreference(input)` — POST `/users/me/locale-preference` (the single trigger surface for the deferred welcome email per invariant 11); `detectCountry()` — GET `/users/me/detect-country` (best-effort from CF-IPCountry, swallows errors → `{ country: null }`).
- Email prefs: `getUserEmailPreferences` (GET `/me/email-preferences`, includes `platformEnabled` overrides + descriptions) and `updateUserEmailPreferences` (PUT).

**Exports:** Types `UserProfile`, `UpdateProfileInput`, `UserAggregatedSnapshot`, `LocalePreferenceInput`, `UserEmailPreferences`, `PlatformEmailEnabled`, `UserEmailPreferencesResponse`; functions `getUserProfile`, `getUserAggregated`, `updateUserProfile`, `setLocalePreference`, `detectCountry`, `getUserEmailPreferences`, `updateUserEmailPreferences`.

**Key dependencies:** `requestJson` from `./client`.

**Flags:** `token` params unused (cookie auth). Convention.

---

### frontend-next/src/lib/apiError.ts

**Purpose:** Typed error class and helpers for structured API error handling.

**What it does:**
- `ApiError` extends `Error` with readonly `status`, `code`, and `payload`, plus convenience getters `isUnauthorized` (401), `isForbidden` (403), `isNotFound` (404), `isNetworkError` (status 0).
- `getErrorMessage(error: unknown)` — extracts a user-facing message from `ApiError`/`Error`/string, with a generic fallback.
- `isApiError(error)` — type guard.

**Exports:** `ApiError`, `getErrorMessage`, `isApiError`.

**Key dependencies:** none.

**Flags:** none.

---

### frontend-next/src/lib/attribution.ts

**Purpose:** First-touch marketing attribution capture, persisted in `sessionStorage` and sent on signup.

**What it does:**
- Captures canonical UTM keys (`utm_source/medium/campaign/content/term`) and click IDs (`gclid`, `gbraid`, `wbraid`, `fbclid`) from the landing URL.
- `captureAttribution()` — parses current URL + referrer, merges with stored data under first-touch-wins semantics (existing channel signal is never overwritten); seeds bare landing context (path + referrer + timestamp) when nothing is present; truncates values to 200 chars; strips the `utm_` prefix for a flat stored shape.
- `getAttribution()` — read-only snapshot.
- `clearAttribution()` — removes the stored key (called after successful signup).
- `getAttributionPayload()` — shapes the stored data into the flat `Record<string,string>` the backend signup endpoint accepts, returning `undefined` if empty. All storage access is wrapped in try/catch for private-mode safety.

**Exports:** Types `UtmKey`, `ClickIdKey`, `AttributionData`; functions `captureAttribution`, `getAttribution`, `clearAttribution`, `getAttributionPayload`.

**Key dependencies:** `sessionStorage`, `window` (guards for SSR).

**Flags:** none.

---

### frontend-next/src/lib/auth.ts

**Purpose:** Client-side auth-state management built around httpOnly cookies (the real JWT is not JS-accessible).

**What it does:**
- Constants: `LOGGED_IN_COOKIE = "p4a_logged_in"` (non-httpOnly UI hint), `AUTH_LOGOUT_BROADCAST_KEY = "p4a_auth_logout_tick"` (cross-tab logout signalling via localStorage `storage` events), legacy localStorage token keys for migration cleanup.
- `getToken()` — returns the `p4a_logged_in` cookie value ("1" or null) as a logged-in hint, cleaning up legacy localStorage tokens on first access.
- `setToken()` — clears legacy keys + session-expired flag and notifies listeners (server already set the httpOnly cookie).
- `clearToken()` — clears legacy keys and writes a monotonic timestamp to the broadcast key so sibling tabs react, then notifies listeners.
- `markSessionExpired()` / `consumeSessionExpiredFlag()` — set/read-and-clear a localStorage flag used to show a "session expired" message after a 401.
- `onAuthChange(handler)` — subscribe to the custom `quiniela:auth` window event; returns an unsubscribe.

**Exports:** `AUTH_LOGOUT_BROADCAST_KEY`, `getToken`, `setToken`, `clearToken`, `markSessionExpired`, `consumeSessionExpiredFlag`, `onAuthChange`.

**Key dependencies:** Browser cookie/localStorage APIs; the `p4a_logged_in` cookie set by the backend.

**Flags:** `setToken` takes an unused `_token` param (legacy signature). Harmless.

---

### frontend-next/src/lib/authAnalytics.ts

**Purpose:** Centralizes the analytics binding done after any successful auth so GA4 and Meta get consistent identity/properties across all auth paths.

**What it does:**
- `bindAuthenticatedUserForAnalytics(user)` — sets GA4 user_id (`setAnalyticsUserId`), sets Meta Advanced Matching data (`setMetaUserData`, hashed downstream), then best-effort fetches `getUserAggregated()` and applies GA4 `user_properties` (tier, is_corporate, country, pool counts, account age, role, acquisition, verification, signup method, predictions, last active, host count). Snapshot-fetch failures are swallowed so analytics never blocks auth.
- `refreshUserProperties()` — re-fetches the aggregated snapshot and re-applies the same user_properties; called after segment-changing mutations (pool created, payment completed).

**Exports:** `bindAuthenticatedUserForAnalytics`, `refreshUserProperties`.

**Key dependencies:** `setAnalyticsUserId`/`setUserProperties` from `./analytics`, `setMetaUserData` from `./metaPixel`, `getUserAggregated` from `./api/user`.

**Flags:** The two functions duplicate the identical `setUserProperties({...13 fields})` block. Minor duplication that could be extracted to a private helper. Low priority.

---

### frontend-next/src/lib/brand.ts

**Purpose:** Single source of truth for frontend brand identity (colors, gradients, name, domain), mirroring `backend/src/lib/brand.ts`.

**What it does:** Exports the frozen `BRAND` object: `name` "Picks4All", `domain` "picks4all.com", primary/light/dark colors, secondary, accent, two gradients, and text/background/card colors.

**Exports:** `BRAND` (const).

**Key dependencies:** none.

**Flags:** Comment notes future logo/icon assets are not yet present. Not dead code.

---

### frontend-next/src/lib/brandColors.ts

**Purpose:** Helpers for resolving optional per-organization brand colors with sensible fallbacks, plus color math (HSL conversion, lighten/darken, WCAG contrast) for corporate splash/header/email rendering.

**What it does:**
- `PICKS4ALL_DEFAULT_PRIMARY`/`SECONDARY` constants and `isValidHex()` (`#RRGGBB` guard).
- `resolveBrandColors(primary, secondary)` — returns `{ primary, secondary, isCustom }`. If both valid → custom pair; if only primary → derives secondary by darkening 25% in HSL; if only secondary → lightens 25% for primary; else Picks4All defaults (`isCustom: false`).
- Private color math: `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `luminance`.
- `darken(hex, amount)` / `lighten(hex, amount)` — adjust HSL lightness.
- `contrastRatio(a, b)` — WCAG ratio (1..21).
- `hasGoodContrastAgainstWhite(primary, secondary)` — true when both clear the 3.0 large-text AA bar against white.
- `buildSplashGradient(primary, secondary)` — `linear-gradient(160deg, ...)`.

**Exports:** `PICKS4ALL_DEFAULT_PRIMARY`, `PICKS4ALL_DEFAULT_SECONDARY`, `isValidHex`, `resolveBrandColors`, `darken`, `lighten`, `contrastRatio`, `hasGoodContrastAgainstWhite`, `buildSplashGradient`.

**Key dependencies:** none.

**Flags:** none.

---

### frontend-next/src/lib/countries.ts

**Purpose:** ISO 3166-1 alpha-2 country list and locale-aware name resolution for the corporate quote form.

**What it does:**
- `COUNTRY_CODES` — hardcoded readonly list of alpha-2 codes (UN states + common dependent territories), with a `Set` for O(1) lookup.
- `getCountryName(code, locale)` — resolves localized name via cached `Intl.DisplayNames` (per-locale cache map); falls back to the code.
- `isValidCountryCode(code)` — set membership.
- `getCountriesSorted(locale)` — display-name-sorted list (locale `Intl.Collator`, code as stable tiebreak) for a `<datalist>`.
- `resolveCountryCode(input, locale)` — accepts an alpha-2 code or a typed (locale-aware, case-insensitive) country name and returns the ISO code or null.

**Exports:** Type `SupportedLocale`; `COUNTRY_CODES`; functions `getCountryName`, `isValidCountryCode`, `getCountriesSorted`, `resolveCountryCode`.

**Key dependencies:** `Intl.DisplayNames`, `Intl.Collator`.

**Flags:** none (static list is acceptable per CLAUDE — names are resolved dynamically via Intl, only codes are static).

---

### frontend-next/src/lib/ecommerce.ts

**Purpose:** Canonical GA4 Enhanced Ecommerce event-payload builder — single source for all revenue events so currency/value/transaction_id/items stay consistent.

**What it does:**
- `buildUpgradeItem(upgrade)` — builds a stable `GA4Item` for a pool-capacity upgrade (`item_id = pool_upgrade_{poolType}_{toCapacity}`, category `pool_capacity`, variant = poolType, rounded price).
- `roundMoney(amount)` — 2-decimal rounding (USD) / integer (COP) so GA4 reports don't drift.
- Funnel trackers (all push via `trackEvent`): `trackViewItemList`, `trackViewItem`, `trackBeginCheckout`, `trackAddPaymentInfo`, `trackPurchase` (dedup-safe via `transaction_id`, `affiliation` is "Mercado Pago Colombia" | "Polar International"), `trackRefund`.

**Exports:** Types `PoolType`, `Currency`, `PoolUpgradeItem`, `GA4Item`, `ViewItemListParams`, `AddPaymentInfoParams`, `PurchaseParams`, `RefundParams`; functions `buildUpgradeItem`, `trackViewItemList`, `trackViewItem`, `trackBeginCheckout`, `trackAddPaymentInfo`, `trackPurchase`, `trackRefund`.

**Key dependencies:** `trackEvent` from `./analytics`.

**Flags:** none.

---

### frontend-next/src/lib/employeeTemplate.ts

**Purpose:** Generates a branded `.xlsx` employee-invite template for corporate hosts and parses uploaded Excel files to extract emails.

**What it does:**
- `hexToArgb` + `COLORS` palette derived from `BRAND`.
- `fetchLogoAsBase64()` — fetches `/brand/logotipo-degradado-120.png` and base64-encodes it (returns null on failure).
- `downloadEmployeeTemplate(companyName?)` — builds an ExcelJS workbook with logo, title, instructions, a tips box, a frozen branded header row ("Email", "Nombre (opcional)") at row 7, ~50 pre-styled empty data rows, column widths, then triggers a browser download named `Plantilla_Empleados_{safeName}.xlsx`.
- `parseEmployeeExcel(file)` — loads the workbook, reads column A from row 8 (or row 2 for plain files), extracts text from plain strings / hyperlink objects / rich-text, skips footer/branding/long cells, validates against an email regex, dedupes (lowercased), and returns `{ emails, errors }` (Spanish error strings).

**Exports:** `downloadEmployeeTemplate`, `parseEmployeeExcel`.

**Key dependencies:** `exceljs`, `BRAND` from `@/lib/brand`, browser File/Blob/FileReader APIs.

**Flags:** UI strings are hardcoded Spanish only (not localized via next-intl) — the template content and parse errors are ES-only. Worth noting against the i18n standard, though this is a generated artifact rather than rendered TSX.

---

### frontend-next/src/lib/empty-polyfill.js

**Purpose:** An intentionally empty module that replaces Next.js's built-in polyfill module (modern target browsers natively support the previously-polyfilled APIs).

**What it does:** Nothing — comment-only file referencing vercel/next.js#86785.

**Exports:** none.

**Key dependencies:** none (wired in via Next/webpack config elsewhere).

**Flags:** Deliberately empty by design — not dead code.

---

### frontend-next/src/lib/exportLeaderboard.ts

**Purpose:** Generates a branded `.xlsx` export of the pool leaderboard with per-phase point breakdowns, medals, and brand styling.

**What it does:**
- Brand `COLORS` palette + `MEDALS` array; standalone Spanish `PHASE_LABELS` map and `phaseLabel()` fallback (no i18n dependency).
- `fetchLogoAsBase64()` — same logo-fetch helper as employeeTemplate.
- `exportLeaderboardExcel(overview, phaseNameFormatter?)` — builds the workbook: logo row, title (pool name), subtitle (tournament + export date), scoring-info row, header (`# | Jugador | Total | ...phases | Dif`), per-row data with gold/silver/bronze + zebra backgrounds, highlighted Total column, muted "-" for zero-point phase cells, a footer (`picks4all.com · N jugadores · M partidos`), column widths, then triggers download `Posiciones_{safeName}_{date}.xlsx`. Accepts an optional `phaseNameFormatter` so the caller can pass localized phase names.

**Exports:** `exportLeaderboardExcel`.

**Key dependencies:** `exceljs`, `PoolOverview` from `@/lib/poolTypes`, `BRAND`.

**Flags:** Built-in Spanish labels/date/footer are hardcoded; localization only happens if the caller passes `phaseNameFormatter`. Duplicates the logo-fetch + hexToArgb + COLORS scaffolding from `employeeTemplate.ts` (candidate for a shared excel-branding helper). Low-priority duplication.

---

### frontend-next/src/lib/gtm.ts

**Purpose:** Server-only Google Tag Manager bootstrap — produces raw inline `<script>` strings injected into `<head>` by the root layout, with Consent Mode v2 defaults ordered before the GTM loader.

**What it does:**
- `GTM_ID` from `NEXT_PUBLIC_GTM_ID`; `isGtmEnabled()`.
- `buildConsentDefaults()` — emits an inline script that initializes `dataLayer`/`gtag`, then hydrates the default consent state at document-parse time from `localStorage.p4a_cookie_consent` (explicit prior choice) and the `p4a_logged_in` cookie (authenticated users implicitly granted). Sets Consent Mode v2 signals to the resolved state with `wait_for_update: 500ms`, enables `url_passthrough`, and sets `ads_data_redaction` only when denied. Detailed rationale: avoids cookieless first-ping that never surfaces in GA4 Realtime/DebugView.
- `buildGtmLoader(id)` — the official GTM loader snippet parameterized with the container ID.
- `getGtmNoScriptSrc()` — `<noscript>` iframe URL.
- `getConsentDefaultsScript()` / `getGtmLoaderScript()` — public accessors for the two script strings.

**Exports:** `GTM_ID`, `isGtmEnabled`, `getGtmNoScriptSrc`, `getConsentDefaultsScript`, `getGtmLoaderScript`.

**Key dependencies:** `CONSENT_SIGNALS` from `./analytics`.

**Flags:** none.

---

### frontend-next/src/lib/metaPixel.ts

**Purpose:** Consent-gated Meta (Facebook/Instagram) Pixel integration with Advanced Matching and CAPI deduplication support.

**What it does:**
- `PIXEL_ID` from `NEXT_PUBLIC_META_PIXEL_ID`; `USER_DATA_KEY` localStorage key for hashed user data. All functions no-op when the pixel ID is unset.
- `initMetaPixel()` — creates the official `fbq` stub (queues calls), inits the pixel (with stored hashed user data if present), grants consent, and async-loads `fbevents.js`. Idempotent via module `initialized` flag (reset on script error).
- `revokeMetaPixelConsent()` — fires `fbq('consent','revoke')` (Meta ignores Google Consent Mode) and clears stored user data so logout/reject on a shared device doesn't leak PII.
- `generateEventId()` — UUID (or timestamp+random fallback) for browser/CAPI dedup.
- `trackMetaEvent(event, params?, eventId?)` — standard events with optional `eventID` for dedup; `trackMetaCustomEvent(event, params?)` — custom events.
- `sha256(value)` — SHA-256 hex hash (lowercased/trimmed) via Web Crypto.
- `setMetaUserData(data)` — hashes email/first/last/externalId, lowercases country, normalizes gender (m/f), strips dashes from DOB; persists to localStorage and assigns directly into the live pixel's `userData` (avoiding a duplicate-init warning).
- `getMetaCookies()` — reads `_fbc`/`_fbp` cookies to pass to the backend for CAPI.

**Exports:** `initMetaPixel`, `revokeMetaPixelConsent`, `generateEventId`, `trackMetaEvent`, `trackMetaCustomEvent`, `setMetaUserData`, `getMetaCookies` (plus a global `Window.fbq`/`_fbq` declaration).

**Key dependencies:** Meta `fbevents.js` CDN, Web Crypto, browser cookies/localStorage.

**Flags:** none.

---

### frontend-next/src/lib/parseMarkdown.ts

**Purpose:** Minimal markdown-to-HTML converter for legal documents.

**What it does:** `parseMarkdown(md)` HTML-escapes the input, then converts headers (h1-h3), bold, italic, links (URL-validated to http/https/mailto with quote-encoding to prevent attribute injection, falling back to plain text on invalid URLs), horizontal rules, paragraph breaks, and basic pipe-tables. Cleans up empty/wrapping paragraphs around headers/hr/tables.

**Exports:** `parseMarkdown`.

**Key dependencies:** none.

**Flags:** Output is meant for `dangerouslySetInnerHTML`; safety relies on the upfront escape + URL validation. The table parser is intentionally basic (every row → `<td>`, header separators dropped). Acceptable for trusted legal copy.

---

### frontend-next/src/lib/poolTerms.ts

**Purpose:** Regional pool-terminology system — maps a user's country to the locally-preferred word for "pool" (quiniela/polla/prode/penca/porra) with full Spanish grammatical variants for natural copy.

**What it does:**
- `POOL_REGIONS` / `PoolRegion` type / `DEFAULT_REGION = "quiniela"`.
- `COUNTRY_TO_REGION` map (CO/CL/VE/PE → polla, AR → prode, UY → penca, ES → porra, MX/EC + everything else → quiniela) with `regionFromCountryCode()`.
- `PoolTermsES` interface (~16 grammatical fields: term, plural, article, indefinite, demonstrative, adjective, full name, and capitalized/plural variants) and the `ES_TERMS` dictionary per region; `getPoolTermsES(region)`.
- `PoolTermsSimple` for EN (`pool`) and PT (`bolão`) with `getPoolTermsEN`/`getPoolTermsPT`.
- `getPoolTermParams(locale, region)` — flat record ready to spread into next-intl `t(key, params)` (ES gives all variants; EN/PT give 4 keys).
- `POOL_REGION_COOKIE = "pool-region"` and `isValidRegion(value)` guard.

**Exports:** `POOL_REGIONS`, type `PoolRegion`, `DEFAULT_REGION`, `regionFromCountryCode`, type `PoolTermsES`, `getPoolTermsES`, type `PoolTermsSimple`, `getPoolTermsEN`, `getPoolTermsPT`, `getPoolTermParams`, `POOL_REGION_COOKIE`, `isValidRegion`.

**Key dependencies:** none.

**Flags:** none.

---

### frontend-next/src/lib/poolTypes.ts

**Purpose:** Typed interfaces for the `GET /pools/:poolId/overview` response — replaces `PoolOverview = any` and eliminates `as any` casts across pool-page components.

**What it does:** Defines the full nested shape: `PoolOrganization`, `PoolInfo` (with `pickTypesConfig: PhasePickConfigItem[]`, `lockedPhases`, `organization`), `PoolMembership`, `PoolCounts`, `PoolTournamentInstance` + fixture sub-types (`PoolFixtureData/Team/Phase/Match`), `PoolPermissions`, `PoolTeamRef`, `PoolMatchPick`, `PoolMatchResult` (regulation + penalties + version), `PoolMatchCard` (with live picks4all-scores fields: `elapsed`, `extra`, `matchStatus`, `isLive`), `ScoringConfig`, `ScoringPreset`, `LeaderboardStructuralStats`, `LeaderboardRow` (match vs structural points split), `PoolPresetMode` (`STRUCTURAL|SCORE|MIXED`), `PoolLeaderboard`, `PhasePickConfigItem`, and the top-level `PoolOverview`.

**Exports:** All the interfaces/types above (notably `PoolOverview`, `PoolOrganization`, `PoolMatchCard`, `LeaderboardRow`, `PoolPresetMode`).

**Key dependencies:** none (pure type module).

**Flags:** none.

---

### frontend-next/src/lib/pricing.ts

**Purpose:** Pool-capacity pricing — COP and USD tier tables with volume discounts; mirrors backend pricing logic. (CLAUDE invariant 9 requires pricing be server-derived for sales; this client copy is for display/wizard estimates.)

**What it does:**
- Config via `envInt` env helpers: `PERSONAL_FREE_LIMIT` (20), `CORPORATE_FREE_LIMIT` (2), `INCREMENT` (50). COP constants: `BASE_PRICE` (28500), `PAIR_DISCOUNT_COP` (1500), `MIN_PRICE_COP` (18000), `CORPORATE_BASE_PRICE` (200000).
- COP computation: `getCopPriceAtStep(step)` (discount every 2 blocks, floored at min), `personalCumulativeCop`, `corporateCumulativeCop`.
- Formatting: `formatCOP`, `formatCOPWithCode`, `formatUSD`, `formatPrice(amount, currency)`.
- Tier builders: `makeTier`, `getPersonalTiers`, `getCorporateTiers`, `getTierForCustomCount`, `getFullPriceSavings`, `getUpgradePrice` (COP).
- USD section: `BASE_PRICE_USD` (7.99), `PAIR_DISCOUNT_USD` (0.40), `MIN_PRICE_USD` (4.99), `CORPORATE_BASE_PRICE_USD` (49.99), `roundUsd`, `getUsdPriceAtStep`, `getPersonalTiersUsd`, `getCorporateTiersUsd`, `getTierForCustomCountUsd`, `getUpgradePriceUsd`.

**Exports:** Types `PoolType`, `PricingTier`, `Currency`; constants `PERSONAL_FREE_LIMIT`, `CORPORATE_FREE_LIMIT`, `INCREMENT`, `BASE_PRICE`, `CORPORATE_BASE_PRICE`; functions `formatCOP`, `formatCOPWithCode`, `getPersonalTiers`, `getCorporateTiers`, `getTierForCustomCount`, `getFullPriceSavings`, `getUpgradePrice`, `formatUSD`, `formatPrice`, `getPersonalTiersUsd`, `getCorporateTiersUsd`, `getTierForCustomCountUsd`, `getUpgradePriceUsd`.

**Key dependencies:** `process.env.NEXT_PUBLIC_*` overrides.

**Flags:** The USD discount/base constants (`BASE_PRICE_USD`, etc.) are hardcoded literals (not env-driven like the COP side) — a mild inconsistency with the COP path's env overrides and the "zero hardcoded values" standard. This client table also duplicates backend `lib/pricing.ts` by design (must stay in sync manually). Not dead code.

---

### frontend-next/src/lib/saleTerms.ts

**Purpose:** Locale-keyed dictionary of allowed sales-document "term" words; mirrors `backend/src/lib/saleTerms.ts`.

**What it does:** `SALE_TERMS` maps each `SaleLocale` to its allowed term list (es: polla/penca/prode/quiniela/porra/pool; en: pool/prediction game/sports pool; pt: bolão/palpites/pool). `isTermValidForLocale(locale, term)` validates a chosen term; `DEFAULT_TERM_FOR_LOCALE` gives the default per locale.

**Exports:** `SALE_TERMS`, `isTermValidForLocale`, `DEFAULT_TERM_FOR_LOCALE`.

**Key dependencies:** `SaleLocale` type from `@/lib/api`.

**Flags:** Manually kept in sync with the backend copy (documented). Acceptable.

---

### frontend-next/src/lib/sanitize.ts

**Purpose:** Lightweight HTML sanitizer for translated/interpolated content rendered as HTML.

**What it does:** `sanitizeHtml(html)` keeps only an allowlist of inline tags (`a`, `b`, `strong`, `i`, `em`, `br`, `span`, `u`, `p`) and strips everything else. For `<a>` tags it preserves only an `href` matching `http(s)://` or `mailto:` and always adds `rel="noopener noreferrer"`.

**Exports:** `sanitizeHtml`.

**Key dependencies:** none.

**Flags:** Regex-based sanitizer — adequate for the constrained, trusted translation-content use case it documents, but not a general-purpose DOM sanitizer.

---

### frontend-next/src/lib/seo.ts

**Purpose:** Centralized page-level SEO metadata builder, addressing Next.js's shallow `metadata` merge (a page's `openGraph` would otherwise wholesale-replace the layout's).

**What it does:**
- `OG_LOCALES` map (es→es_LA, en→en_US, pt→pt_BR), `DEFAULT_OG_IMAGE` (`/opengraph-image`, 1200x630).
- `buildLocaleUrl(locale, path)` — fully-qualified URL with the locale-prefix convention (ES has no prefix).
- `buildPageMetadata(opts)` — accepts title/description, a single path or per-locale path map, optional `availableLocales` (for regional ES-only pages), OG type (website/article) + article fields, image overrides, and `extra` metadata. Builds canonical URL, hreflang `languages` map, an `x-default` (ES when supported, else first available locale), Open Graph and Twitter card objects, and `alternates`. The `extra` object is spread last so callers can override (e.g. custom robots/keywords).

**Exports:** Type `LocaleCode`; `DEFAULT_OG_IMAGE`; interfaces `OgImage`, `BuildPageMetadataOptions`; functions `buildLocaleUrl`, `buildPageMetadata`.

**Key dependencies:** `Metadata` type from `next`, `SITE_URL`/`SITE_NAME` from `./siteConfig`.

**Flags:** none.

---

### frontend-next/src/lib/siteConfig.ts

**Purpose:** Centralized runtime site configuration derived from brand defaults.

**What it does:** Exports `SITE_URL` (from `NEXT_PUBLIC_SITE_URL` or `https://{BRAND.domain}`), `SITE_NAME` (BRAND.name), `EMAIL_DOMAIN` (from `NEXT_PUBLIC_EMAIL_DOMAIN` or BRAND.domain), and `WORLD_CUP_FOCUS` — a temporary marketing flag (true unless `NEXT_PUBLIC_WORLD_CUP_FOCUS=false`) that pivots ES copy to "polla mundialista" messaging for the WC 2026 cycle.

**Exports:** `SITE_URL`, `SITE_NAME`, `EMAIL_DOMAIN`, `WORLD_CUP_FOCUS`.

**Key dependencies:** `BRAND` from `./brand`.

**Flags:** `WORLD_CUP_FOCUS` is an intentionally temporary flag to disable after the tournament (documented), not dead code.

---

### frontend-next/src/lib/theme.ts

**Purpose:** Design-token single source of truth — colors, spacing, radii, z-index scale, shadows, font sizes/weights, and reusable inline-style patterns.

**What it does:**
- `colors` — brand colors (from `BRAND`), text scale, CSS-variable-aware semantic tokens (`var(--text)` etc.), backgrounds, borders, a full status palette (success/warning/error/info each with bg/border variants), action-blue aligned to brand, purple (corporate), disabled, overlays, and shadow rgba tokens.
- Scales: `spacing`, `radii` (including `pill` and `circle`), `zIndex` (base→expulsion 9999), `shadows`, `fontSize`, `fontWeight`.
- Reusable `React.CSSProperties` patterns: `modalOverlayStyle`, `modalOverlayDarkStyle`, `modalCardStyle`, `adminSectionStyle`, `adminHeadingStyle`; style factory functions `toggleTrackStyle(isOn, isBusy)`, `toggleThumbStyle(isOn)`, `badgeStyle(...)`, `pillBadgeStyle(...)`.

**Exports:** `colors`, `spacing`, `radii`, `zIndex`, `shadows`, `fontSize`, `fontWeight`, `modalOverlayStyle`, `modalOverlayDarkStyle`, `modalCardStyle`, `adminSectionStyle`, `adminHeadingStyle`, `toggleTrackStyle`, `toggleThumbStyle`, `badgeStyle`, `pillBadgeStyle`.

**Key dependencies:** `BRAND` from `./brand`; React type for CSSProperties.

**Flags:** none.

---

### frontend-next/src/lib/timezone.ts

**Purpose:** Date/time formatting helper that renders UTC timestamps in the user's timezone and locale.

**What it does:** `LOCALE_MAP` (es→es-ES, en→en-US, pt→pt-BR). `formatMatchDateTime(utcDate, userTimezone, locale="es")` — parses the UTC string (returns the original string if invalid), falls back to the runtime-resolved timezone when none is given, and formats via `Intl.DateTimeFormat` (2-digit day, short month, numeric year, 24h time).

**Exports:** `formatMatchDateTime`.

**Key dependencies:** `Intl.DateTimeFormat`.

**Flags:** none.

---

### frontend-next/src/lib/timezones.ts

**Purpose:** Static list of common timezones for the pool-configuration dropdown.

**What it does:** Exports `COMMON_TIMEZONES` — a readonly array of `{ value, label }` IANA timezones ordered LATAM → North America → Europe, with Spanish labels and UTC offsets.

**Exports:** `COMMON_TIMEZONES`.

**Key dependencies:** none.

**Flags:** Labels are Spanish-only (`Colombia (UTC-5)` etc.) — not localized for EN/PT. Minor i18n gap in a dropdown list. The static timezone list is acceptable (allowed fallback data).

---

### frontend-next/src/lib/tournamentCatalog.ts

**Purpose:** Maps tournament template keys to display metadata (emoji icons, i18n keys, active flag) for the landing page and pool-creation flow.

**What it does:** `TournamentEntry` type and `TOURNAMENT_CATALOG` array. Active entries (`wc2026` → `wc_2026_sandbox`, `ucl2025` → `ucl-2025`) link to real DB instances via `templateKey`; the rest (Copa América 2028, Euro 2028, Nations League, Libertadores, Sudamericana, Premier League) are display-only "coming soon" entries with `active: false`.

**Exports:** Type `TournamentEntry`, const `TOURNAMENT_CATALOG`.

**Key dependencies:** none (i18n keys consumed by `tournaments.items.<key>` translations elsewhere).

**Flags:** Static catalog including a "wc_2026_sandbox" template key — per CLAUDE this static mapping should be a fallback to dynamic catalog instances; the comment confirms active entries match against catalog instances. Worth verifying the consumer treats DB data as primary. Not dead code.

---

### frontend-next/src/lib/utm.ts

**Purpose:** Appends UTM parameters to outbound/share URLs for source attribution.

**What it does:** `appendUtm(url, params)` — appends URL-encoded `utm_source/medium/campaign` (and optional `content/term`), choosing `?`/`&` appropriately. `getShareUtm(platform, context)` — builds the `UtmParams` for a social share, mapping context to `pool_invite`/`pool_share` campaigns. Types `SharePlatform` (whatsapp/facebook/twitter/clipboard) and `ShareContext`.

**Exports:** `appendUtm`, types `SharePlatform`, `ShareContext`, `getShareUtm`.

**Key dependencies:** none.

**Flags:** none.

---

### frontend-next/src/lib/validation.ts

**Purpose:** Centralized client-side form-input constraints that should mirror the backend Zod schemas.

**What it does:** Exports `LIMITS` — a frozen object grouping constraints for user profile (username min/max + pattern, displayName, names, bio, password), pool (name, description, deadlineMinutes up to 7 days), corporate (companyName, welcome/invitation messages, contact fields, inquiry message, `emailsArrayMax`, and quote-panel `numberOfPools`/`slotsPerPool` that must mirror the backend inquiry schema), match (`goals` 0-99), scoring (`pointsPerRule`), and upload (`logoMaxBytes` 500 KB).

**Exports:** `LIMITS`.

**Key dependencies:** none.

**Flags:** Must stay in sync with backend Zod schemas manually (documented). Not dead code.
