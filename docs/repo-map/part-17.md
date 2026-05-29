## Batch 17

### frontend-next/src/app/[locale]/que-es-una-quiniela/page.tsx

**Purpose:** Server-rendered SEO content article ("What is a quiniela / pool / penca") localized per-locale, with rich structured data, intended as a public organic-traffic landing page.

**What it does:**
- `generateMetadata({ params })` — awaits the `locale` param, calls `setRequestLocale`, loads the `seo` namespace, and returns metadata via `buildPageMetadata` with localized title/description, per-locale `path` map (`/que-es-una-quiniela`, `/what-is-a-pool`, `/o-que-e-uma-penca`), `type: "article"`, and article publish/modify times (`PUBLISHED_AT = 2026-02-13`, `MODIFIED_AT = 2026-02-22`).
- Declares local TypeScript interfaces (`CountryRow`, `RegionalSection`, `RelatedLink`, `WhatIsQuinielaMessages`) describing the shape of the article's localized content JSON, which includes hero, intro, origins, regional sections, a country/term table, digital-evolution, why-popular, related links, CTA, and JSON-LD copy.
- `articleStyle` — shared inline style objects for body paragraphs and pull-quotes (uses `colors.brandLight`).
- Default export `QueEsUnaQuinielaPage` (async server component):
  - Loads the article content via **dynamic import** of `@/messages/${locale}/whatIsQuiniela.json` (NOT registered in `i18n/request.ts`). An inline comment warns these files must not be deleted (regression commit `27db35b`).
  - Computes `pageUrl` from `SITE_URL` + locale prefix + localized path.
  - Builds two JSON-LD blobs: a `DefinedTermSet` (one `DefinedTerm` per country-table row, using a templated description) and an `Article` (headline/description/inLanguage, hardcoded `datePublished: 2026-02-12` / `dateModified: 2026-02-13`, author/publisher = Picks4All org, image = `/opengraph-image`, `mainEntityOfPage` = pageUrl).
  - Renders `Breadcrumbs`, two `JsonLd` blocks, then a long article inside `PublicPageWrapper`: dark gradient hero, intro paragraphs (rendered via `dangerouslySetInnerHTML`), origins, regional deep-dive sections, a styled country/term/origin `<table>`, a digital-evolution + why-popular section, a 2-column grid of related regional `Link`s, and a brand-gradient CTA with `RegisterButton`.

**Exports:** `generateMetadata` (async), default `QueEsUnaQuinielaPage` component.

**Key dependencies:** `next-intl/server` (`getTranslations`, `setRequestLocale`; `getLocale` imported but unused), `@/i18n/navigation` `Link`, `PublicPageWrapper`, `JsonLd`, `Breadcrumbs`, `RegisterButton`, `SITE_URL`, `buildPageMetadata` (`@/lib/seo`), `colors` (`@/lib/theme`), dynamic-imported `whatIsQuiniela.json` messages.

**Flags:** `getLocale` is imported but never used. The JSON-LD `Article` dates (2026-02-12 / 02-13) are hardcoded and diverge from the metadata constants (`PUBLISHED_AT`/`MODIFIED_AT`) — minor duplication/inconsistency. Body text rendered with `dangerouslySetInnerHTML` from translation JSON (trusted source, but worth noting).

---

### frontend-next/src/app/[locale]/reembolsos/page.tsx

**Purpose:** Server route for the public refund-policy legal page; supplies SEO metadata + breadcrumbs, delegating the body to a client component.

**What it does:**
- `generateMetadata` — sets request locale, loads `seo` namespace, returns `buildPageMetadata` with `refunds.title`/`refunds.description` and per-locale `path` (`/reembolsos`, `/refunds`, `/reembolsos`).
- Default `ReembolsosPage` — sets locale, loads `legal` namespace, builds breadcrumb URLs from `SITE_URL` + locale prefix + localized path map, renders `Breadcrumbs` (home + refunds) then `<ReembolsosContent />`.

**Exports:** `generateMetadata`, default `ReembolsosPage`.

**Key dependencies:** `next-intl/server`, `./ReembolsosContent`, `Breadcrumbs`, `SITE_URL`, `buildPageMetadata`.

**Flags:** `getLocale` imported but unused.

---

### frontend-next/src/app/[locale]/reembolsos/ReembolsosContent.tsx

**Purpose:** Client component rendering the refund policy body from a single Markdown translation string.

**What it does:** `ReembolsosContent` reads `legal.refundsContent` via `useTranslations`, renders a back-to-home `Link`, then an `<article>` whose inner HTML comes from `parseMarkdown(content)` injected via `dangerouslySetInnerHTML`. A scoped `<style>` block styles the rendered Markdown (headings, paragraphs, lists, hr, links, tables) using theme CSS vars. Wrapped in `PublicPageWrapper`.

**Exports:** named `ReembolsosContent`.

**Key dependencies:** `next-intl` `useTranslations`, `@/i18n/navigation` `Link`, `PublicPageWrapper`, `parseMarkdown` (`@/lib/parseMarkdown`).

**Flags:** Style block + structure is byte-for-byte identical to `TerminosContent.tsx` (duplicated logic — candidate for a shared `LegalMarkdownPage` component).

---

### frontend-next/src/app/[locale]/reset-password/page.tsx

**Purpose:** Server route for the password-reset page; sets noindex metadata and renders the client component.

**What it does:** `generateMetadata` loads the `seo` namespace and returns `resetPassword.title`/`description` with `robots: { index: false, follow: false }`. Default `ResetPasswordPage` renders `<ResetPasswordContent />`.

**Exports:** `generateMetadata`, default `ResetPasswordPage`.

**Key dependencies:** `next-intl/server` `getTranslations`, `./ResetPasswordContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/reset-password/ResetPasswordContent.tsx

**Purpose:** Client component implementing the token-based password reset form, accessible regardless of auth state (with a warning + logout flow for active sessions).

**What it does:**
- Default `ResetPasswordContent` wraps `ResetPasswordInner` in `<Suspense>` (required because the inner component uses `useSearchParams`).
- `ResetPasswordInner`:
  - Reads `token` from query params; `hasActiveSession = !!getToken()`.
  - On mount, if no token, sets an "invalid token" error.
  - `onSubmit` — validates token presence, password rules (≥8 chars, one uppercase, one digit), and confirm-match; calls `resetPassword(token, newPassword)`. On success, if the user had an active session it calls `apiLogout()` + `clearToken()` (force re-auth) and sets `success`. Maps backend `INVALID_TOKEN` payload code to a "token expired" message.
  - `handleLogoutAndContinue` — logs out, clears token, reloads the page so `hasActiveSession` re-derives.
  - Renders three states: **success** (✅ card + login link), **invalid/missing token** (⚠️ card with request-new + back-home), and the **form** (with an active-session warning banner offering "go to dashboard" vs "logout first", new/confirm password inputs, `PasswordStrengthIndicator`, submit button, inline mismatch + error display).

**Exports:** default `ResetPasswordContent`.

**Key dependencies:** `next-intl`, `@/lib/api` (`resetPassword`, `logout as apiLogout`), `@/i18n/navigation` `Link`, `next/navigation` (`useRouter`, `useSearchParams`), `@/lib/auth` (`getToken`, `clearToken`), `PasswordStrengthIndicator`, `colors` (`@/lib/theme`).

**Flags:** Uses `any` in the catch clause (`err: any`). Password validation regex is duplicated inline here and in `ActivationContent.tsx` (≥8 / uppercase / digit) rather than centralized in `lib/validation.ts`.

---

### frontend-next/src/app/[locale]/terminos/page.tsx

**Purpose:** Server route for the public Terms of Service legal page (SEO metadata + breadcrumbs).

**What it does:** Mirrors `reembolsos/page.tsx`: `generateMetadata` returns `terms.title`/`description` with per-locale paths (`/terminos`, `/terms`, `/termos`); default `TerminosPage` loads `legal` namespace, builds breadcrumbs (home + terms), and renders `<TerminosContent />`.

**Exports:** `generateMetadata`, default `TerminosPage`.

**Key dependencies:** `next-intl/server`, `./TerminosContent`, `Breadcrumbs`, `SITE_URL`, `buildPageMetadata`.

**Flags:** `getLocale` imported but unused (same pattern as the refunds/what-is pages).

---

### frontend-next/src/app/[locale]/terminos/TerminosContent.tsx

**Purpose:** Client component rendering the Terms of Service body from a single Markdown translation string.

**What it does:** `TerminosContent` reads `legal.termsContent`, renders back-to-home `Link` + an `<article>` with `parseMarkdown` output injected via `dangerouslySetInnerHTML`, plus a scoped `<style>` block. Identical structure to `ReembolsosContent`.

**Exports:** named `TerminosContent`.

**Key dependencies:** `next-intl`, `@/i18n/navigation` `Link`, `PublicPageWrapper`, `parseMarkdown`.

**Flags:** Duplicated logic — identical to `ReembolsosContent.tsx` apart from the translation key (`termsContent` vs `refundsContent`). Should be extracted to a shared component.

---

### frontend-next/src/app/[locale]/verify-email/page.tsx

**Purpose:** Server route for the email-verification page; noindex metadata + client component.

**What it does:** `generateMetadata` returns `verifyEmail.title`/`description` with `robots: { index: false, follow: false }`. Default `VerifyEmailPage` renders `<VerifyEmailContent />`.

**Exports:** `generateMetadata`, default `VerifyEmailPage`.

**Key dependencies:** `next-intl/server`, `./VerifyEmailContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/verify-email/VerifyEmailContent.tsx

**Purpose:** Client component that consumes the email-verification token, calls the backend, and shows verifying/success/already-verified/error states with auto-redirect to the dashboard.

**What it does:**
- Default `VerifyEmailContent` wraps `VerifyEmailInner` in `<Suspense>` (for `useSearchParams`).
- `VerifyEmailInner`:
  - `verify` (useCallback) — if no `token`, sets error; otherwise strips `?token=` from the URL via `window.history.replaceState` (security note **HI-02**, prevent token leaking into logs/history), then calls `verifyEmail(token)`. Maps `result.alreadyVerified` → `already_verified`, else → `success` (also the fallback). Catches errors → `error` state with message.
  - One effect runs `verify` on mount; a second effect auto-redirects to `/dashboard` after 5s when status is `success` or `already_verified`.
  - Defines inline style objects and renders four UI states (loading spinner via inline SVG + keyframes, success ✓, already-verified ✅, error ❌ with login + dashboard buttons).

**Exports:** default `VerifyEmailContent`.

**Key dependencies:** `next-intl`, `next/navigation` (`useSearchParams`, `useRouter`), `@/i18n/navigation` `Link`, `verifyEmail` (`@/lib/api`), `colors` (`@/lib/theme`).

**Flags:** `err: any` in catch. The branch `result.verified ? success : success` is dead — both arms return `"success"`, so the final `else` is unreachable/redundant (low-severity dead branch).

---

### frontend-next/src/app/api/region/route.ts

**Purpose:** A small JSON API route returning the visitor's preferred regional pool term ("quiniela"/"polla"/"prode"/"penca"/"porra") inferred from Cloudflare's `CF-IPCountry` header, intentionally kept off the SSR render path to preserve static, cacheable HTML for SEO.

**What it does:** `export const dynamic = "force-dynamic"`. `GET()` reads `headers()`, takes `cf-ipcountry`, computes `region` via `regionFromCountryCode(country)` (falling back to `DEFAULT_REGION` when the header is absent — dev / non-Cloudflare proxies), and returns `NextResponse.json({ region, country })` with `Cache-Control: no-store, max-age=0`. The file's lengthy comment explains the SEO rationale (avoiding `Cache-Control: private, no-store` on Server Components that read headers/cookies, which caused "Crawled - currently not indexed" issues) and the client-side once-per-device localStorage caching strategy.

**Exports:** `dynamic` const, `GET` handler.

**Key dependencies:** `next/headers`, `next/server` `NextResponse`, `@/lib/poolTerms` (`DEFAULT_REGION`, `regionFromCountryCode`, `PoolRegion` type).

**Flags:** none.

---

### frontend-next/src/app/layout.tsx

**Purpose:** Minimal Next.js App Router root layout that simply passes children through; the real `<html>`/`<body>` layout lives in `[locale]/layout.tsx`.

**What it does:** Default `RootLayout({ children })` returns `children` unchanged.

**Exports:** default `RootLayout`.

**Key dependencies:** none.

**Flags:** none.

---

### frontend-next/src/app/manifest.ts

**Purpose:** Generates the PWA web app manifest with locale-aware name/description, detected from the `Accept-Language` header.

**What it does:**
- `STRINGS` — per-locale (es/en/pt) manifest copy: name, short name, description, and BCP-47 `lang` (`es-LA`/`en-US`/`pt-BR`).
- `detectLocale(acceptLanguage)` — parses the header, returns first matching tag among pt/en/es, defaulting to `es`.
- Default async `manifest()` — reads headers, picks locale strings, returns a `MetadataRoute.Manifest`: name/short_name/description/lang, `start_url: "/"`, `display: standalone`, background+theme color `#f4f5f7`, categories (sports/entertainment/games/productivity), and three icons (`/icon.svg` any, `/pwa-icon-192.png`, `/pwa-icon-512.png`).

**Exports:** default `manifest`.

**Key dependencies:** `next` `MetadataRoute`, `next/headers`.

**Flags:** Manifest copy is hardcoded here rather than sourced from i18n message JSON (acceptable for a build-time manifest, but it duplicates branding strings outside the central i18n system).

---

### frontend-next/src/app/opengraph-image.tsx

**Purpose:** Dynamically generated default Open Graph image (1200×630 PNG) for social-share previews, rendered via `next/og` `ImageResponse`.

**What it does:** Exports `alt`, `size` (1200×630), `contentType` (`image/png`). Default `Image()` reads `public/brand/isotipo-degradado-500.png` from disk (`readFileSync`), base64-encodes it, and renders a JSX layout: brand gradient background, isotipo + `BRAND.name` heading, the tagline "Quinielas Deportivas Gratis con Amigos", a row of regional terms (Quiniela · Polla · Prode · Penca · Porra), and a bottom badge "100% Gratis · Sin Apuestas · Puro Entretenimiento".

**Exports:** `alt`, `size`, `contentType`, default `Image`.

**Key dependencies:** `next/og` `ImageResponse`, `@/lib/brand` `BRAND`, Node `fs`/`path`.

**Flags:** Tagline and badge text are hardcoded Spanish strings (not localized) — by design for a single canonical OG image, but worth noting against the i18n standard.

---

### frontend-next/src/app/robots.ts

**Purpose:** Generates `robots.txt` allowing crawl of public pages while disallowing authenticated/private route prefixes, and pointing to the sitemap.

**What it does:** Default `robots()` returns rules for `userAgent: "*"`, `allow: "/"`, and `disallow` of `/dashboard/`, `/pools/`, `/admin/`, `/profile/`, `/pago/`, `/invite`. Includes a detailed comment explaining the deliberate decision NOT to disallow auth pages (login/forgot-password) in robots.txt — they ship meta `noindex,nofollow`, which Google can only honor if crawling is allowed. Sitemap URL is `${SITE_URL}/sitemap.xml`.

**Exports:** default `robots`.

**Key dependencies:** `next` `MetadataRoute`, `SITE_URL` (`@/lib/siteConfig`).

**Flags:** none.

---

### frontend-next/src/app/sitemap.ts

**Purpose:** Generates the XML sitemap with all public routes across the three locales, including localized path alternates and per-entry OG images.

**What it does:**
- Local type `SitemapEntry` extends the Next sitemap entry with a non-standard `images?: string[]` field.
- Default `sitemap()`:
  - Defines build-time `lastModified` dates: `recentlyUpdated`/`stable` = `2026-05-08` (bumped after SEO recovery work), `legal` = `2026-02-22`.
  - Helpers: `allLocales(es, en, pt)` builds the `alternates.languages` map (es no prefix, en `/en`, pt `/pt`); `samePath(path)` reuses it; `withImage(entry)` attaches the default `/opengraph-image` to every entry.
  - Returns the full entry list: landing, faq, como-funciona, que-es-una-quiniela, terminos, privacidad, precios, reembolsos, como-se-juega, empresas; a World-Cup-2026 content hub (mundial-2026 + grupos/calendario/sedes/como-hacer-quiniela/reglas-quiniela/predicciones); and single-locale regional SEO pages (`/polla-futbolera`, `/prode-deportivo`, `/porra-deportiva`, `/penca-futbol`, and `/en/football-pool`) with no cross-locale alternates.

**Exports:** default `sitemap`.

**Key dependencies:** `next` `MetadataRoute`, `SITE_URL`.

**Flags:** `recentlyUpdated` and `stable` hold the identical date (`2026-05-08`) — two named constants with the same value; harmless but mild redundancy. Route list is maintained manually and must be kept in sync with actual `[locale]` routes.

---

### frontend-next/src/components/AccountReceivableRedemptionBox.tsx

**Purpose:** Checkout-flow widget letting a customer apply a pre-paid "cuenta de cobro" (account receivable / CC) 8-digit code to lock pool capacity; parent owns the applied state.

**What it does:**
- Props: `onRedeem(summary)`, `onClear()`, `applied` (current `RedemptionSummary | null`, parent is source of truth), `isMobile`.
- Helpers: `normaliseCode` strips non-digits and caps at 8; `formatDisplay` inserts a hyphen after 4 digits (`XXXX-XXXX`); `formatRedeemedAmount` formats COP (`amountCop`) or USD (`amountUsdCents / 100`) via `formatPrice`.
- Three render states:
  - **Applied** — green card showing the consecutive number, target capacity ("cupos"), formatted amount, and a "Quitar" (remove) button that calls `onClear` and resets local state.
  - **Collapsed CTA** — dashed box ("¿Tienes una cuenta de cobro?") with an "Aplicar código" button toggling `expanded`.
  - **Expanded form** — monospace `XXXX-XXXX` input + Apply button (disabled until 8 digits). `handleApply` validates 8-digit length and a present auth token (`getToken`), calls `redeemAccountReceivable(token, code)`, and on success calls `onRedeem(accountReceivable)`. Maps backend error codes (`NOT_FOUND`, `ALREADY_PAID`, `ALREADY_REDEEMED`, `CANCELLED`, `EXPIRED`) to localized messages; includes a hint about where to find the code in the PDF and a Cancel link.
- All strings via `useTranslations("accountReceivableRedemption")` with `defaultMessage` fallbacks.

**Exports:** default `AccountReceivableRedemptionBox`.

**Key dependencies:** `next-intl`, `@/lib/api` (`redeemAccountReceivable`, `RedemptionSummary` type), `getToken` (`@/lib/auth`), `formatPrice` (`@/lib/pricing`), theme tokens, `ApiError` (`@/lib/apiError`).

**Flags:** Uses `t(key, { defaultMessage })`, which per the project's memory rule (`feedback_nextintl_no_fallback`) is NOT a real fallback in next-intl v4 — if these keys are missing from the `accountReceivableRedemption` namespace in es/en/pt JSON, the literal keys will render. Worth verifying the keys exist. The `input` `maxLength={9}` allows the hyphen plus 8 digits (intentional).

---

### frontend-next/src/components/ActivationContent.tsx

**Purpose:** Client component for the corporate employee activation page (`/activar`), handling token validation, new-user registration, existing-user join, and session-mismatch resolution for the magic-link flow.

**What it does:**
- `formatActivationError(err)` — extracts a human-readable message from an `ApiError`, pulling Zod `details.fieldErrors`/`formErrors`, a service `reason`, and a nested `message` to enrich the bare error code.
- `ActivationContent`:
  - Captures the activation `token` from query params **once** into state (`tokenParam`) because the security URL-strip desyncs `useSearchParams` on later renders (commented HI-02 rationale).
  - State: check status (`loading`/`new_user`/`existing_user`/`error`), invite email/pool/company names, new-user form fields (displayName, username, password, confirm, three consent checkboxes), submit `status`, error message, resolved `poolId`, and a `sessionMismatch` panel state.
  - On mount: if no token → error; otherwise strips `?token=` via `replaceState` and calls `checkCorporateInvite(token)` to populate email/pool/company and set `new_user` vs `existing_user`. Maps `INVALID_TOKEN`/`TOKEN_EXPIRED`/`ALREADY_ACTIVATED` payload codes to localized messages.
  - `canSubmit` — validates displayName ≥2, username ≥3, password ≥8 + uppercase + digit, password match, all three consents, and token present.
  - `handleSubmit` (new user) — calls `activateCorporateAccount({ activationToken, displayName, username, password, acceptTerms/Privacy/Age })`, stores the returned token via `setToken`, sets pool/company, → success. Maps error codes.
  - `handleExistingUserJoin` — calls `activateCorporateAccount({ activationToken })` only; on `SESSION_MISMATCH` it captures `currentUserEmail`/`inviteEmail` into the mismatch panel; handles `POOL_FULL`/`ALREADY_ACTIVATED`.
  - `handleSessionMismatchLogout` — logs out, clears token, then retries `handleExistingUserJoin` with no cookie.
  - Renders: loading spinner, error state, success state (🎉 + welcome + "Ir al pool" using `usePoolTerm` params), session-mismatch panel (🔁), existing-user join UI (👋), and the full new-user registration form (with `PasswordStrengthIndicator` and consent checkboxes). Uses `useTranslations("activation")`.

**Exports:** named `ActivationContent`.

**Key dependencies:** `next-intl`, `next/navigation`, `@/i18n/navigation` `Link`, `@/lib/api` (`activateCorporateAccount`, `checkCorporateInvite`), `@/lib/api/auth` `logout`, `@/lib/auth` (`setToken`, `clearToken`), `usePoolTerm` (`@/contexts/PoolTermContext`), `colors`, `PasswordStrengthIndicator`. Aligns with CLAUDE invariants on single-use activation tokens, `SESSION_MISMATCH` (409), and `ALREADY_ACTIVATED`.

**Flags:** Multiple `err: any` catches. Password rule regex duplicated (same as `ResetPasswordContent.tsx`). `Link` is imported but the success/error/mismatch paths use `router.push` / buttons — `Link` may be unused in the rendered output (low-confidence; not all branches reviewed exhaustively for `<Link>` usage).

---

### frontend-next/src/components/AdminAnalyticsContent.tsx

**Purpose:** Comprehensive admin growth/health analytics dashboard (client component) backed by `GET /admin/analytics/dashboard`, with auto-refresh polling, manual refresh, and recharts visualizations across ~14 sections.

**What it does:**
- **Config/constants:** `REFRESH_INTERVALS_MS` (10s/30s/1min/5min/Off), `DEFAULT_REFRESH_INDEX = 1` (30s), `PALETTE` (chart colors from theme), `STATUS_COLORS` (pool-status pie colors).
- **Format helpers:** `fmtInt` (es-CO), `fmtPct`, `fmtUsd` (cents→$), `fmtCop`, `fmtRelativeTime` (Spanish "hace Xs/m/h/d").
- **Layout primitives:** `SectionHeader`, `Card` (responsive, optional grid span), `KpiCard` (value + hint + accent strip + week-over-week delta chip colored by sign, with USD/COP/int delta formatting).
- **Main `AdminAnalyticsContent`:**
  - Uses `useIsMobile`; state for data/loading/error/accessDenied/refreshIndex/lastFetchAt/forcedRefreshing; `fetchSeqRef` for a stale-fetch guard.
  - `fetchDashboard(force)` — calls `getAdminAnalyticsDashboard(force)`, drops out-of-order responses via the seq guard, handles `403` → access-denied, other errors → error message.
  - Effects: initial fetch; interval-based auto-refresh keyed on `refreshIndex`; a 5s tick to keep "hace Xs" fresh.
  - Renders access-denied (🔒), loading, and error states; otherwise a column of sections: `DashboardHeader`, `SectionErrorsBanner` (partial-failure list), sticky `SectionNav` chips, and the section components below, plus a footer showing snapshot age, cache TTL, and cache hit/miss.
- **Section sub-components:**
  - `SectionNav` — sticky TOC chip nav (`SECTION_NAV` array) with hover styling.
  - `SectionErrorsBanner` — collapsible list of per-section backend errors.
  - `DashboardHeader` — title, generated/loaded relative times, refresh-interval segmented control, and a force-refresh button.
  - `TopLineSection` — grid of `KpiCard`s for total/verified users, 7d/30d active, total/active/completed pools, personal/corporate pools, organizations + pending inquiries, activated invites + rate, revenue USD, revenue COP, total picks (match/group-standings/structural breakdown), pending-approval members; computes week-over-week deltas from `topLineWeekAgo` (null for non-snapshotted point-in-time fields).
  - `Section` — generic anchored section wrapper with scroll-margin offset for the sticky nav.
  - `SignupsChart` (LineChart: total/verified/google/referred), `PoolsChart` (stacked AreaChart personal vs corporate).
  - `EngagementSection` — DAU AreaChart, picks-by-week stacked BarChart (match/group-standings/structural), and an activation funnel (signups → joined pool → made pick) with progress bars and conversion rates.
  - `GeographySection` — horizontal BarChart of users by country with pct tooltip.
  - `PoolHealthSection` — status pie, size-distribution bar, alerts (`HealthRow`: zombie pools, no-member pools, stale drafts >30d, full pools), and a per-tournament table.
  - `CorporateSection` — funnel (`FunnelRow`: inquiries → responded → orgs → corporate pools → invites sent → activated → expired/failed), top-organizations table, recent-inquiries table with response-lag.
  - `RevenueSection` — weekly USD + COP bar charts, checkout-conversion funnel (started/completed/failed/stale-abandoned + avg payment USD/COP + avg time-to-payment), and a provider×tier breakdown table (`polar`→USD, else→COP via `revenueLocalUnits`).
  - `AcquisitionSection` — top UTM source×medium table, organic referrers table, and a per-channel funnel with color-coded pick-rate.
  - `CohortActivationSection` — table of joined/picked-within-14d rates per signup-week cohort, with "en curso" for open windows and color-coded percentages.
  - `EngagementSignalsSection` — top players (30d), top hosts, and per-tournament engagement tables (empty-state guarded).
  - `CommunicationsSection` — locale-prompt modal completion rate + daily completions bar, email-suppressions-by-week bar (with spike warning), and feedback-by-week stacked bar (bug/feature/other).
  - `CohortSection` — W1/W2/W4 retention table per cohort, "en curso" for unclosed windows.
  - `LocaleDistributionSection` — language distribution bars (es/en/pt/pending) + modal completion-rate card.
  - `OperationalSection` — email suppressions, failed analytics events (DLQ), audit events last 24h, and a recent-feedback table.
  - `Table` — generic responsive table accepting `React.ReactNode[][]` rows, with empty-state and "—" null-cell fallback.

**Exports:** default `AdminAnalyticsContent`.

**Key dependencies:** `recharts` (Line/Area/Bar/Pie charts), `@/i18n/navigation` `Link`, `@/lib/api` (`getAdminAnalyticsDashboard`, `AnalyticsDashboardResponse` type), `useIsMobile`, theme tokens. Backend is admin-gated (403 handling).

**Flags:** All UI strings are hardcoded Spanish (not via `useTranslations`) — this is an admin-only internal dashboard, so it intentionally departs from the i18n standard, but worth noting. `err: any` used in `fetchDashboard`. Heavy single-file component (2061 lines) — exceeds the 500-line component guideline in CLAUDE.md (could be split), though it is cohesively structured into sub-components.

---

### frontend-next/src/components/AdminCcCreateContent.tsx

**Purpose:** Admin form to create a new pre-paid "cuenta de cobro" (account receivable), optionally pre-filled from an existing quote, with live server-derived price preview and localized PDF concept text.

**What it does:**
- Constants/helpers: `DEFAULT_VALIDITY_DAYS = 30`; `today()`/`plusDays()` (UTC date math, ISO `YYYY-MM-DD`); `defaultConcept(locale, term, capacity)` builds the PDF concept line in es/en/pt.
- `AdminCcCreateContent`:
  - Reads `?fromQuoteId` from query params; manages a large form state: client legal name/NIT/email/city, issue + valid-until dates (defaulting to today + 30d), locale, "pool" term, target capacity (default 50), currency (COP default), concept, tournament, internal notes, and linked-quote id/consecutive. `conceptIsAuto` tracks whether the concept template should auto-update.
  - **Prefill effect** — when `fromQuoteId` is set, calls `getQuote(token, fromQuoteId)` and copies client/locale/term/participants/currency/tournament + linked quote id/consecutive, regenerating the concept. Sets `prefillError` on failure (with a cancellation guard).
  - `livePreview` (useMemo) — null if capacity ≤ `CORPORATE_FREE_LIMIT`; otherwise computes the upgrade price via `getUpgradePrice("corporate", FREE_LIMIT, capacity)` (COP) or `getUpgradePriceUsd(...)` (USD) and formats it. Pricing is always server/lib-derived (per ADR-061 — admin cannot override the amount).
  - **Sync effect** — keeps `concept` in sync with locale/term/capacity while `conceptIsAuto`.
  - `changeLocale(next)` — sets locale and resets the term to `DEFAULT_TERM_FOR_LOCALE[next]`.
  - `handleSubmit` — blocks if capacity ≤ free limit, requires an auth token, then calls `createAccountReceivable(token, {...})` (poolType `"corporate"`, trimmed/normalized fields, `linkedQuoteId`) and on success navigates to the CC detail route. Errors surface inline.
  - Renders `AdminSalesHeader` (active `ccs`), a back link, an optional "pre-filled from quote" banner, prefill error, and the form built from local `Section`/`Field` primitives: Cliente, Fechas, Localización (locale pills + term `<select>` from `SALE_TERMS[locale]`), Inversión (capacity number input min `FREE_LIMIT+1`, currency pills, the green `livePreview` total box, concept textarea with auto-generated hint, tournament input), and Notas. Cancel + submit buttons.
- Style helpers at file end: `inputStyle`, `hintStyle`, `previewBoxStyle`, `pillStyle(active)`, `primaryBtnStyle(disabled)`, `secondaryBtnStyle(disabled)`, plus `Section` and `Field` layout components.

**Exports:** default `AdminCcCreateContent`.

**Key dependencies:** `next/navigation` `useSearchParams`, `@/i18n/navigation` (`Link`, `useRouter`), `getToken` (`@/lib/auth`), `@/lib/api` (`createAccountReceivable`, `getQuote`, `SaleCurrency`/`SaleLocale` types), `@/lib/saleTerms` (`SALE_TERMS`, `DEFAULT_TERM_FOR_LOCALE`), `@/lib/pricing` (`CORPORATE_FREE_LIMIT`, `formatPrice`, `getUpgradePrice`, `getUpgradePriceUsd`), `useIsMobile`, theme tokens, `AdminSalesHeader`.

**Flags:** All UI strings hardcoded Spanish (admin-internal tool, intentional). `targetCapacity` default `50` is a magic number (not a named constant). Aligns with the sales soft-revoke / server-derived-pricing invariants (ADR-061).
