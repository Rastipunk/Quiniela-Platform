## Batch 15

This batch covers public marketing/SEO pages, auth pages (forgot-password, login), the invite landing, the World Cup 2026 content cluster, the locale-segment layout, and the locale-scoped error boundary — all under `frontend-next/src/app/[locale]/`.

---

### frontend-next/src/app/[locale]/como-se-juega/HowToPlayContent.tsx

**Purpose:** Client component rendering the interactive "how to play" explainer for the public `/como-se-juega` (`/how-to-play`, `/como-jogar`) page. It walks a visitor through the 6 product concepts (prediction, live results, scoring systems, leaderboard, all-matches coverage, winners) using fully mocked/illustrative UI cards rather than live data.

**What it does:**
- Declares layout primitives: `SECTION_MAX_WIDTH = 720`, and helper components `Section` (padded section with optional `bg`, centered max-width container), `SectionTitle` (h2), `SectionDesc` (muted paragraph).
- `MockPredictionCard({ t })` — illustrative match-prediction card (Barcelona 2-1 PSG, UEFA Champions League) showing a deadline badge, score inputs, a "saved" confirmation banner, and an explanatory note. All copy via `t("prediction.*")`.
- `MockLiveMatch({ t })` — illustrative live-score card with pulsing LIVE badge (inline `@keyframes pulse`), current minute, score 2-1, halftime line, and goal minutes. Copy via `t("liveResults.*")`.
- `MockScoringSystems({ t })` — stateful tabbed widget. Type `ScoringSystem = "predictor" | "basic" | "strategist"`. Builds a `systems` array from `t("scoring.systems.*")` (name/tagline/description, optional badge on predictor), renders pill tabs with `useState(active)`, shows the active system's tagline+description, then conditionally renders one of `PredictorMock`/`BasicMock`/`StrategistMock`, plus a custom-rules note (`t("scoring.customNote")`).
  - `PredictorMock({ t })` — internal `Row` type and a nested `ScoreCard` component; renders two cards (an exact-hit 2-1 vs 2-1 with per-component points summing to 43, and a partial-miss 2-1 vs 3-1) showing a points breakdown (match outcome, home/away goals, goal difference, exact score) using `t("scoring.*")`.
  - `BasicMock({ t })` — hit case (+20 exact) vs miss case (0 pts) cards, illustrating all-or-nothing exact-score scoring.
  - `StrategistMock({ t })` — bracket/structural scoring example with three rows (group, R16, QF) each awarding points (15/10/10 → total 35) with emoji icons injected via `dangerouslySetInnerHTML`.
- `MockLeaderboard({ t })` — stateful phase-filtered leaderboard. Type `LeaderboardPhase = "all" | "groups" | "r16" | "quarters" | "semis" | "final"`. Holds a hardcoded `dataByPhase` record of 5 mock players per phase (positions, points, played, exact, trend, medal emoji, a highlighted "you" row). Renders scrollable phase tabs, a CSS-grid table (`gridCols`/`gridGap` constants), medal/trend icons via `dangerouslySetInnerHTML`, and a help note.
- `MockPhaseTimeline({ t })` — vertical timeline of the 5 tournament phases (group 48 → R16 16 → QF 8 → SF 4 → final 1) with numbered nodes and a "predict all" footer; copy via `t("allMatches.*")`.
- `MockWinnersPodium({ t })` — 1st/2nd/3rd podium with medal emojis and mock names (Carlos M., Ana R., Pedro L.); copy via `t("winners.*")`.
- `HowToPlayContent()` (the exported component) — uses `useTranslations("howToPlay")` and `useIsMobile()`; lays out the hero, the six explainer sections (alternating backgrounds), and a closing CTA section with a `RegisterButton` styled as a white button on the brand gradient.

**Exports:** Named `HowToPlayContent` (React component). All mock sub-components are module-private.

**Key dependencies:** `next-intl` (`useTranslations`), `@/lib/theme` (`colors`, `radii`), `@/lib/brand` (`BRAND`), `@/components/RegisterButton`, `@/hooks/useIsMobile`.

**Flags:** All player/score data is illustrative mock data inlined in the component — this is intentional (a marketing explainer, not live data), so it does not violate the no-hardcode rule. Emoji rendered through `dangerouslySetInnerHTML` with HTML entities is a stylistic choice but the content is static/trusted. None actionable.

---

### frontend-next/src/app/[locale]/como-se-juega/page.tsx

**Purpose:** Server route + metadata for the public "how to play" page; wraps the client `HowToPlayContent` in the public chrome and breadcrumbs.

**What it does:**
- `generateMetadata({ params })` — awaits `locale`, calls `setRequestLocale`, loads `seo` namespace, and returns `buildPageMetadata` with locale-specific paths (`es:/como-se-juega`, `en:/how-to-play`, `pt:/como-jogar`).
- `HowToPlayPage({ params })` (default) — sets request locale, loads `howToPlay` namespace for the page title, computes `localePath` (empty for ES) and `pagePath` per locale, builds a 2-item breadcrumb (Picks4All home → page title), and renders `<PublicPageWrapper>` containing `<Breadcrumbs>` + `<HowToPlayContent>`.

**Exports:** Default `HowToPlayPage`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/PublicPageWrapper`, `@/components/Breadcrumbs`, `@/lib/siteConfig` (`SITE_URL`), `@/lib/seo` (`buildPageMetadata`), local `HowToPlayContent`.

**Flags:** Imports `getLocale` from `next-intl/server` but never uses it (locale comes from `params`). Minor dead import.

---

### frontend-next/src/app/[locale]/empresas/page.tsx

**Purpose:** Server route + metadata for the public corporate/enterprise landing page (`/empresas`, `/for-companies`, `/para-empresas`).

**What it does:**
- `generateMetadata()` — resolves locale via `getLocale()`, loads `enterprise.meta` namespace, returns `buildPageMetadata` with locale-specific paths.
- `EnterprisePage()` (default, synchronous) — builds an `enterpriseJsonLd` schema (`@graph` with an `Organization` node and a `Service` node describing "Picks4All Corporate Pools", worldwide, corporate entertainment), then renders `<PublicPageWrapper>` containing `<JsonLd data={enterpriseJsonLd}>` and `<EnterpriseLandingContent>`.

**Exports:** Default `EnterprisePage`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server` (`getLocale`, `getTranslations`), `@/components/PublicPageWrapper`, `@/components/EnterpriseLandingContent`, `@/components/JsonLd`, `@/lib/siteConfig` (`SITE_URL`), `@/lib/seo`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/error.tsx

**Purpose:** Locale-segment error boundary — the client component Next.js renders when a route under `[locale]` throws during render.

**What it does:** `GlobalError({ reset })` (default, "use client") uses `useTranslations("error")` and renders a centered, full-viewport error screen: `BrandLogo`, an `h1` title, a message paragraph, and two actions — a "retry" button calling the injected `reset()` (brand-gradient styled) and a plain anchor `href="/"` to go home. Despite the `error` prop being typed (`Error & { digest? }`), it is intentionally not displayed (no stack/internal details to the user).

**Exports:** Default `GlobalError` (React error-boundary component).

**Key dependencies:** `next-intl` (`useTranslations`), `@/components/BrandLogo`, `@/lib/theme` (`colors.brandGradient`).

**Flags:** Function named `GlobalError` but it is a per-segment `error.tsx` (a true Next.js `global-error.tsx` must render its own `<html>/<body>`; this one does not, and lives under `[locale]`). The `error` prop is declared but unused. Uses `minHeight: "100vh"` which CLAUDE.md tolerates for full-screen states (the 100vw rule is the strict one). Naming is slightly misleading but functionally a normal segment error boundary; no real dead code.

---

### frontend-next/src/app/[locale]/faq/page.tsx

**Purpose:** Server-rendered FAQ page with regional pool-term interpolation, FAQPage JSON-LD, and a contact/CTA section.

**What it does:**
- `generateMetadata({ params })` — `seo.faq` title/description, path `/faq` (same across locales).
- Declares `FAQItem` / `FAQMessages` TypeScript interfaces describing the structured `faq.json` shape (hero, contact, cta, breadcrumbs, categories[], items[]).
- `interpolate(text, params)` — replaces ICU-style `{key}` placeholders with values from a params record (used for pool-term substitution).
- Module constants `EMAIL_DOMAIN` (from `NEXT_PUBLIC_EMAIL_DOMAIN`, default `picks4all.com`) and `SUPPORT_EMAIL` = `soporte@<domain>` — a comment documents that the canonical support mailbox is the Spanish `soporte@` for all locales (EN `support@` / PT `suporte@` are Cloudflare aliases).
- `FAQPage({ params })` (default) — sets request locale; **dynamically imports** `@/messages/${locale}/faq.json` (a comment warns these files are NOT registered in `i18n/request.ts` and must not be deleted — commit `27db35b` regression). Computes pool-term params via `getPoolTermParams(locale, DEFAULT_REGION)` (uses the default region intentionally so the page is statically cacheable and indexable — a comment explains this avoids `Cache-Control: no-store`). Interpolates the placeholders into hero subtitle, cta title/description, and every item question/answer. Builds `faqJsonLd` (`FAQPage` schema with Question/Answer entities). Renders `<Breadcrumbs>`, `<JsonLd>`, then `<PublicPageWrapper>` containing a dark hero, the client `<FAQAccordion faqData={items}>`, a contact section with a `mailto:` button, and a brand-gradient CTA with a `RegisterButton`.

**Exports:** Default `FAQPage`; named async `generateMetadata`; interfaces `FAQItem`/`FAQMessages` are module-local (not exported).

**Key dependencies:** `next-intl/server`, `@/components/PublicPageWrapper`, `@/components/JsonLd`, `@/components/FAQAccordion`, `@/components/Breadcrumbs`, `@/components/RegisterButton`, `@/lib/theme`, `@/lib/poolTerms` (`DEFAULT_REGION`, `getPoolTermParams`), `@/lib/siteConfig`, `@/lib/seo`. Dynamic import of locale `faq.json`.

**Flags:** Imports `getLocale` but never uses it. The dynamic-import-of-JSON pattern is deliberately preserved (documented regression guard).

---

### frontend-next/src/app/[locale]/football-pool/page.tsx

**Purpose:** EN-only SEO article page for the "football pool" keyword, reusing the shared `RegionalArticlePage` renderer.

**What it does:**
- Module constants `PUBLISHED_AT` (2026-02-13) and `MODIFIED_AT` (2026-02-22).
- `generateMetadata({ params })` — guards `if (locale !== "en") notFound()`; returns `buildPageMetadata` with `type: "article"` and `article` published/modified times, path `/football-pool`.
- `relatedLinks` — array of related internal SEO links (que-es-una-quiniela, como-funciona, faq, polla-futbolera, prode-deportivo, penca-futbol, porra-deportiva), each `{ key, href }`.
- `FootballPoolPage({ params })` (default) — again guards EN-only via `notFound()`. Loads `footballPool` namespace, builds `articleJsonLd` (`Article` schema with headline/description, author+publisher Organization=Picks4All, `mainEntityOfPage`). Renders `<Breadcrumbs>` (home → page), `<JsonLd>`, and `<RegionalArticlePage namespace="footballPool" relatedLinks={relatedLinks}>`.

**Exports:** Default `FootballPoolPage`; named async `generateMetadata`.

**Key dependencies:** `next/navigation` (`notFound`), `next-intl/server`, `@/components/Breadcrumbs`, `@/components/JsonLd`, `@/components/RegionalArticlePage`, `@/lib/siteConfig`, `@/lib/seo`.

**Flags:** Imports `getLocale` (unused). Inconsistency: `articleJsonLd` hardcodes `datePublished/dateModified` as `"2026-02-22"` while the `<head>` metadata uses the `PUBLISHED_AT`/`MODIFIED_AT` constants (2026-02-13 / 2026-02-22) — the published date in the JSON-LD does not match the metadata's published time. Minor data-drift, low severity.

---

### frontend-next/src/app/[locale]/forgot-password/ForgotPasswordContent.tsx

**Purpose:** Client component implementing the password-reset request flow.

**What it does:** `ForgotPasswordContent()` (default) uses `useTranslations("auth")` and local state (`email`, `loading`, `result`). A discriminated union type `ForgotPasswordResult` covers `idle | success | google_account | error`.
- `onSubmit(e)` — trims/lowercases the email, validates non-empty (throws localized `emailRequired`), calls `forgotPassword(em)` from the API client, and sets `success`. On error it inspects `err.payload.error`: `GOOGLE_ACCOUNT` → renders the Google-account state; anything else → `error` with message.
- Renders three distinct UIs based on `result.type`:
  - `success` — envelope card with title/message/expiry note and a "back home" `Link`.
  - `google_account` — inline Google logo SVG plus title/description/instructions explaining the account uses Google sign-in, with a "go to login" `Link`.
  - default (idle/error) — the email form (`autoFocus`, required email input), submit button (text toggles `sending`/`sendLink`), a "back to login" `Link`, and an inline error alert when `result.type === "error"`.

**Exports:** Default `ForgotPasswordContent`.

**Key dependencies:** `next-intl` (`useTranslations`), `@/lib/api` (`forgotPassword`), `@/i18n/navigation` (locale-aware `Link`).

**Flags:** Uses `err: any` and `err?.payload?.error` at the API boundary (acceptable per the strict-TS boundary exception). Comments are in Spanish (allowed for inline notes; CLAUDE prefers English but this is non-blocking). None actionable.

---

### frontend-next/src/app/[locale]/forgot-password/page.tsx

**Purpose:** Server route + metadata wrapper for the forgot-password page.

**What it does:** `generateMetadata()` returns `seo.forgotPassword` title/description with `robots: { index: false, follow: false }` (noindex). `ForgotPasswordPage()` (default) simply renders `<ForgotPasswordContent />`.

**Exports:** Default `ForgotPasswordPage`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server` (`getTranslations`), local `ForgotPasswordContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/invite/layout.tsx

**Purpose:** Layout for the `/invite` segment whose only job is to mark the route `noindex, nofollow`.

**What it does:** Exports static `metadata` with `robots: { index: false, follow: false }`; `InviteLayout({ children })` returns `children` unchanged.

**Exports:** Default `InviteLayout`; named `metadata`.

**Key dependencies:** `next` (`Metadata` type).

**Flags:** none.

---

### frontend-next/src/app/[locale]/invite/page.tsx

**Purpose:** Public invite landing page — given an invite `?code=`, it previews a pool (name, tournament, host, member count) and offers join/login CTAs, with corporate-pool branding (logo, brand colors, welcome message) when the pool belongs to an Organization.

**What it does:**
- Module constant `API_URL` from `NEXT_PUBLIC_API_URL`.
- `InvitePreview` interface — preview shape including an optional `organization` block (`name`, `logoBase64`, `primaryColor`, `secondaryColor`, `welcomeMessage`); a comment notes it is null for personal pools.
- `resolveBrandColors(primary, secondary)` — returns the org's colors with `isCustom: true` when both are set, otherwise falls back to platform defaults (`#4f46e5` / `#8b5cf6`).
- `InviteContent()` — reads `code` from `useSearchParams()`, uses `useTranslations("pool")`. Detects login via `getToken()`, builds `joinUrl=/pools/join?code=...` and `loginUrl=/login?redirect=<joinUrl>`. On mount, if no code → error; else `fetch(${API_URL}/invite-preview/<code>)`, sets preview if `poolName` present else error. Renders: a loading spinner, an invalid/expired error card, or the populated invite card. For corporate pools (`organization` present) it renders a colored top band with the company logo (or initial-letter fallback) and a `poweredBy` attribution footer; for personal pools it shows a Picks4All eyebrow. Shows the optional `welcomeMessage` (rendered as-is — comment cites ADR-047: escaped at persistence). The pool card shows name, tournament, member count, and an "active" indicator. CTAs: if `preview.valid` and logged in → "join now" anchor (`joinUrl`); if valid and logged out → "create account to join" + "already have account" anchors (`loginUrl`); if invalid → expired message. CTA gradient swaps to the org's custom gradient when applicable.
- `InvitePage()` (default) — wraps `InviteContent` in `<Suspense>` (required because of `useSearchParams`) with a spinner fallback.

**Exports:** Default `InvitePage`.

**Key dependencies:** `react` (Suspense/hooks), `next/navigation` (`useSearchParams`), `next-intl`, `@/i18n/navigation` (`Link`), `@/lib/auth` (`getToken`), `@/lib/theme`, `@/lib/brand`. Backend endpoint `GET /invite-preview/:code`.

**Flags:** `loginUrl` points to `/login`, but `login/page.tsx` is a deprecated redirect to `/` (see below) — the `?redirect=` param is preserved through that redirect, so the flow still works, but the link could target `/` directly. Uses raw `fetch` with `.then` rather than the shared API client (minor inconsistency). None blocking.

---

### frontend-next/src/app/[locale]/layout.tsx

**Purpose:** The locale-segment root layout — renders `<html>/<body>`, wires next-intl provider, GTM/consent scripts, global analytics components, the pool-term context, site-wide JSON-LD (Organization/WebSite/SiteNavigation), and per-locale SEO metadata.

**What it does:**
- `viewport` — `colorScheme: "light"`, `themeColor: "#f4f5f7"` (light-only enforced).
- `generateStaticParams()` — pre-renders all `routing.locales`.
- `OG_LOCALES` map (es→es_LA, en→en_US, pt→pt_BR).
- `getNavItems(locale)` — returns the main nav array (name+url) per locale, surfaced as `SiteNavigationElement` schema; a comment requires keeping it in sync with the visible navbar/footer.
- `generateMetadata({ params })` — builds title (with `template: "%s | <SITE_NAME>"`), description, OpenGraph, Twitter card, `metadataBase`, hreflang `alternates` (es/en/pt/x-default), Google + Facebook domain verification, color-scheme hints, and optional Bing verification from `NEXT_PUBLIC_BING_VERIFICATION`. For ES during the `WORLD_CUP_FOCUS` window it swaps to World-Cup-specific title/description; EN/PT keep evergreen copy.
- `LocaleLayout({ children, params })` (default) — validates the locale with `hasLocale` (else `notFound()`), `setRequestLocale`, loads messages and `jsonLd` namespace. Sets `region = DEFAULT_REGION` (comment explains regional wording is resolved client-side by `PoolTermProvider` to keep the layout statically cacheable / indexable — references the Search Console indexing problem). Renders `<html lang>` + `<head>` with preconnect/dns-prefetch hints and, when `isGtmEnabled()`, inlined GTM consent-defaults + loader scripts (intentionally inlined, not `next/script`, so Consent Mode v2 defaults populate before gtm.js). `<body>` includes the GTM `<noscript>` iframe, a skip-to-content link, and `NextIntlClientProvider` → `PoolTermProvider` → site-wide `JsonLd` (`@graph` of Organization, WebSite, and a SiteNavigationElement per nav item) → `children` → `CookieConsent`, `MetaPixelPageView`, `AttributionCapture`, `AuthAnalyticsSync`. Loads Google Identity Services via `next/script strategy="afterInteractive"`.

**Exports:** Default `LocaleLayout`; named `viewport`, `generateStaticParams`, `generateMetadata`.

**Key dependencies:** `next-intl` + `next-intl/server`, `next/navigation`, `next/script`, `@/i18n/routing`, `@/components/JsonLd`, `@/components/CookieConsent`, `@/components/AuthAnalyticsSync`, `@/components/MetaPixelPageView`, `@/components/AttributionCapture`, `@/contexts/PoolTermContext`, `@/lib/poolTerms`, `@/lib/siteConfig`, `@/lib/seo`, `@/lib/gtm`, `../globals.css`.

**Flags:** Google site-verification token and Facebook domain-verification token are hardcoded inline rather than env-driven (the Bing one is env-driven) — a minor deviation from the zero-hardcoded-config standard, but these are non-secret public verification tags. None blocking.

---

### frontend-next/src/app/[locale]/login/LoginContent.tsx

**Purpose:** Full login/register client component — email/password auth, registration with consent checkboxes, and Google Sign-In (including a new-user consent modal). NOTE: this component is currently NOT rendered by any route (see flags).

**What it does:** `LoginContent()` (default) uses `useTranslations("auth")`, `useLocale`, `useIsMobile`, `useRouter`/`useSearchParams` (reads `?redirect=`), and `consumeSessionExpiredFlag()` to show a session-expired alert.
- Declares a global `Window.google` type for Google Identity Services.
- State: mode (`login`/`register`), email/emailConfirm/username/displayName/password, four consent booleans (terms/privacy/age/marketing), Google-consent-modal state + pending credential, error/loading, and `googleLoadFailed`.
- `onLoggedIn()` — redirects to `redirectTo` via `window.location.href` (arbitrary path) or `router.push("/dashboard")`.
- `handleGoogleCallback(response)` — captures timezone, calls `loginWithGoogle(credential, timezone)`; on `requiresConsent`/`CONSENT_REQUIRED`/`AGE_VERIFICATION_REQUIRED` it stashes the credential and opens the consent modal; otherwise sets token and proceeds.
- `handleGoogleConsentSubmit()` — validates the three mandatory consents, re-calls `loginWithGoogle` with a `RegisterConsentOptions` payload, sets token, proceeds.
- Two `useEffect`s: one initializes/renders the Google button with retry polling (up to ~10s, sets `googleLoadFailed` after 100 attempts; re-runs on `mode` change to flip signin/signup button text and locale); another resets consent checkboxes when switching to login mode.
- `onSubmit(e)` — for register: validates email match, username (≥3, lowercased), display name, password (≥8), and the three mandatory consents, captures timezone, calls `register(...)`; for login calls `login(...)`. Maps `GOOGLE_ACCOUNT_NO_PASSWORD` to a friendly message. Sets token and proceeds on success.
- Defines responsive style objects (container/input/button/tab/checkbox) using `useIsMobile()` + `TOUCH_TARGET` + `mobileInteractiveStyles`.
- `ConsentCheckboxes({ inModal })` — reusable block of 4 consent checkboxes (terms+link, privacy+link, age, marketing) with required-field legend; rendered both inline in register mode and inside the Google consent modal.
- Renders: page title/subtitle, session-expired alert, login/register tab buttons, the form (email; in register mode: confirm-email with live mismatch hint, username with pattern/min/max, display name; password with hint; forgot-password link in login mode; consent block in register mode; submit), the Google Sign-In divider + button container (+ `googleLoadFailed` fallback message), a legal disclaimer footer with terms/privacy links, and the Google consent modal (overlay + dialog with cancel/confirm, confirm disabled until the 3 mandatory consents are checked).

**Exports:** Default `LoginContent`.

**Key dependencies:** `@/lib/api` (`login`, `register`, `loginWithGoogle`, `RegisterConsentOptions`), `@/lib/auth` (`setToken`, `consumeSessionExpiredFlag`), `next-intl`, `@/i18n/navigation` (`Link`, `useRouter`), `next/navigation` (`useSearchParams`), `@/hooks/useIsMobile`, `@/lib/theme`, Google Identity Services (`window.google`).

**Flags:** **Likely dead code.** A repo grep shows `LoginContent` is referenced only by its own file; `login/page.tsx` (below) `redirect()`s to `/` and never renders it. Authentication is handled by the `AuthSlidePanel` on the landing page (per the page.tsx comment). This entire ~744-line component appears orphaned/superseded — strong candidate for removal. Also uses `config: any` and `err: any` (boundary-acceptable).

---

### frontend-next/src/app/[locale]/login/page.tsx

**Purpose:** Deprecated `/login` route — now just a server redirect to the landing page, preserving the `?redirect=` param.

**What it does:** Static `metadata` marks it `noindex, nofollow`. `LoginPage({ searchParams })` (default, async) awaits `searchParams`, extracts a string `redirect`, and `redirect()`s to `/?redirect=<encoded>` (or `/` if absent). A docblock states auth is handled by `AuthSlidePanel` on the landing page.

**Exports:** Default `LoginPage`; named `metadata`.

**Key dependencies:** `next/navigation` (`redirect`), `next` (`Metadata`).

**Flags:** Confirms `LoginContent.tsx` in the same folder is orphaned — this route renders nothing and never imports it. The sibling component is dead code.

---

### frontend-next/src/app/[locale]/mundial-2026/calendario/page.tsx

**Purpose:** Server-rendered World Cup 2026 full match schedule page (group stage by group/matchday + knockout rounds + key dates), with SportsEvent JSON-LD.

**What it does:**
- `generateMetadata({ params })` — `seo.worldCupSchedule` title/description, locale paths (es/calendario, en/schedule, pt/calendario).
- Data: `GroupMatch` interface and `GROUP_MATCHES` — a hardcoded array of all 72 group-stage matches (groups A–L, 6 each) with group/matchday/date/time/home/away/venue and home/away flag ISO codes. `KnockoutRound` interface and `KNOCKOUT_ROUNDS` — the 6 knockout rounds (R32 16, R16 8, QF 4, SF 2, third-place 1, final 1) keyed to translation strings.
- Helpers: `formatDate(dateStr, locale)` (UTC parse → localized short month label, ES/EN/PT month arrays), `flagUrl(code)` (`flagcdn.com/24x18/<code>.png`), `groupMatchesByGroup(matches)` (bucket by group).
- `PHASES` — tab anchors (group → `#groups`, all knockout phases → `#knockout`).
- `CalendarioPage({ params })` (default) — sets locale, loads `worldCup.schedule` namespace, computes locale paths and World Cup parent paths, groups matches. Renders `<Breadcrumbs>` (home → World Cup → schedule), `<JsonLd>` (`SportsEvent` FIFA World Cup 2026, 2026-06-11 to 2026-07-19, multi-venue USA/Mexico/Canada, organizer FIFA), and `<PublicPageWrapper>` with: a dark hero; a sticky phase-filter nav of anchor pills; the group-stage section iterating sorted groups → matchdays 1–3 → match rows (date/time, home team+flag, VS, away flag+team, venue); the knockout section iterating `KNOCKOUT_ROUNDS` with a running `knockoutMatchNum` counter starting at 73 generating TBD-vs-TBD match cards (special final-venue note for the final); a key-dates list (group→final, final bolded); and a brand-gradient CTA with `RegisterButton`.

**Exports:** Default `CalendarioPage`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/PublicPageWrapper`, `@/components/JsonLd`, `@/components/Breadcrumbs`, `@/components/RegisterButton`, `@/lib/theme`, `@/lib/siteConfig`, `@/lib/seo`. External `flagcdn.com` images.

**Flags:** Imports `getLocale` (unused). The entire 72-match fixture list, venues, and dates are hardcoded static content — acceptable here as SEO marketing content (not the live tournament data that drives pools), consistent with the static-mapping-as-fallback exception. Some venues are `"TBD"`. None blocking.

---

### frontend-next/src/app/[locale]/mundial-2026/como-hacer-quiniela/page.tsx

**Purpose:** Server-rendered World Cup 2026 long-form SEO article on how to create a pool, with HowTo JSON-LD.

**What it does:**
- Module constants `PUBLISHED_AT` (2026-04-04) / `MODIFIED_AT` (2026-04-16).
- `generateMetadata({ params })` — `seo.worldCupHowTo` title/description, locale paths (es/como-hacer-quiniela, en/how-to-create-pool, pt/como-criar-bolao), `type: "article"` with published/modified times.
- `HowToMessages` interface — full typed shape of the `worldCup.json` → `howTo` block (breadcrumbs, hero, intro, process steps, during, scoring systems basic/cumulative/advanced/custom, tips, cta, jsonLd steps/tool).
- `ComoHacerQuinielaPage({ params })` (default) — sets locale, **dynamically imports** `@/messages/${locale}/worldCup.json` and pulls `.howTo`. Computes locale + parent World Cup paths. Renders `<Breadcrumbs>`, `<JsonLd>` (`HowTo` schema built from `msg.jsonLd.steps` → `HowToStep`s + `HowToTool`), and `<PublicPageWrapper>` with narrative sections: hero, intro (2 paragraphs), the process (4 steps with colored left-border accents), during-the-tournament (3 paragraphs), scoring systems (4 distinctly-styled cards: basic/cumulative/advanced/custom), tips (4 paragraphs), and an understated brand-gradient CTA with `RegisterButton`.

**Exports:** Default `ComoHacerQuinielaPage`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/PublicPageWrapper`, `@/components/JsonLd`, `@/components/Breadcrumbs`, `@/components/RegisterButton`, `@/lib/theme`, `@/lib/siteConfig`, `@/lib/seo`. Dynamic import of locale `worldCup.json`.

**Flags:** Imports `getLocale` (unused).

---

### frontend-next/src/app/[locale]/mundial-2026/grupos/page.tsx

**Purpose:** Server-rendered World Cup 2026 groups page — 12 group cards (teams + flags + mini round-robin schedule), an advancement-rules explainer, and a CTA; with ItemList JSON-LD.

**What it does:**
- Static data: `GROUPS` (record A–L → 4 team names each, accentless ASCII names) and `TEAM_FLAGS` (team name → ISO flag code).
- `getGroupMatches(teams)` — returns the standard FIFA 4-team round-robin (6 matches across 3 matchdays).
- `generateMetadata({ params })` — `seo.worldCupGroups` title/description, locale paths (es/grupos, en/groups, pt/grupos).
- `GruposMundial2026Page({ params })` (default) — sets locale, loads `worldCup` namespace, computes locale-aware World Cup slug (`mundial-2026`/`world-cup-2026`/`copa-do-mundo-2026`) and groups slug (`groups` for EN else `grupos`). Renders `<Breadcrumbs>` (home → World Cup → groups), `<JsonLd>` (`ItemList`, 12 items, one ListItem per group with comma-joined team names), and `<PublicPageWrapper>` with: a brand-gradient hero; a responsive grid of 12 group cards (each with a gradient header, team list with `flagcdn.com/w40` flags, and a mini match schedule per matchday using `flagcdn.com/w20` flags with VS separators); an advancement-rules section (win=3 / draw=1 / loss=0 colored badges + tiebreaker note); and a brand-gradient CTA with `RegisterButton`.

**Exports:** Default `GruposMundial2026Page`; named async `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/PublicPageWrapper`, `@/components/JsonLd`, `@/components/Breadcrumbs`, `@/components/RegisterButton`, `@/lib/theme`, `@/lib/siteConfig`, `@/lib/seo`, `@/lib/brand`. External `flagcdn.com` images.

**Flags:** Imports `getLocale` (unused) and `BRAND` from `@/lib/brand` (imported but not referenced in the file). Static groups/flags data is acceptable SEO content. The round-robin in `getGroupMatches` is generic (teams[0]vteams[2], etc.) and does not match the real fixtures in `calendario/page.tsx` — these two pages maintain independent, slightly divergent schedule representations (potential duplication/drift between the two World Cup pages). Low severity.
