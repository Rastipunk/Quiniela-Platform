## Batch 13

This batch covers the Picks4All Next.js frontend's Playwright E2E suite, build/lint/deploy config, the authenticated-route shell (layout, error, loading), the admin "ventas" (sales) and analytics/feedback/email page wrappers, the dashboard and its modal components, the corporate/personal pool creation page wrappers, and the pool detail page's match-card / pick / admin sub-components.

---

### frontend-next/e2e/invite-flow.spec.ts

**Purpose:** End-to-end test of the invitation/join landing flow across public and authenticated states.

**What it does:** Three `describe` blocks.
- `Invite landing page`: asserts `/invite` returns HTTP 200 without auth; that `/invite` with no `code` does not crash (body has content); and that `/invite?code=INVALIDCODE999` shows a localized "not found / invalid" error after a 3s wait (checks ES/EN/PT substrings).
- `Join redirect flow`: clears cookies, hits `/pools/join?code=TESTCODE`, and asserts the `AuthGuard` redirects to `/login` carrying `redirect` and `code` params.
- `Authenticated pool page`: logs in via `loginAsTestUser`/`authenticatePage` helpers, fetches the user's pools with `apiRequest("GET", "/me/pools")`, skips if none, otherwise navigates to the first pool and asserts the page renders content.

**Exports:** none (Playwright spec).

**Key dependencies:** `@playwright/test`; `./helpers/auth` (`loginAsTestUser`, `authenticatePage`, `apiRequest`).

**Flags:** none.

---

### frontend-next/e2e/navigation.spec.ts

**Purpose:** Verifies that navbar, footer, World Cup hub pills, and internal links on key public pages resolve to HTTP 200 (no broken links).

**What it does:**
- `Public NavBar`: collects `nav a[href]`, skips anchors/external/authenticated routes, asserts each remaining link returns 200.
- `Footer`: same for `footer a[href]`, also skipping `mailto:`.
- `World Cup Hub navigation pills`: on `/mundial-2026`, collects `nav a[href*='mundial-2026']`, expects >=6 unique, asserts each returns 200.
- `Internal links on key pages`: iterates a list (`/`, `/mundial-2026`, `/faq`, `/como-funciona`), collects all internal `a[href^='/']`, deduplicates, skips authenticated routes, and asserts none are broken.

**Exports:** none.

**Key dependencies:** `@playwright/test`.

**Flags:** none.

---

### frontend-next/e2e/pool-lifecycle.spec.ts

**Purpose:** API-level read tests of the pool lifecycle against the production backend, avoiding destructive mutations.

**What it does:** Hard-codes `API = "https://api.picks4all.com"`. Blocks:
- `API health`: `/health` returns 200 with `version` and `commit`.
- `User pools`: `GET /me` (tolerates 200/401/404; if 200 validates email/displayName) and `GET /me/pools` (200, array).
- `Catalog`: `GET /catalog/instances` returns instances, and "WC 2026" must be `ACTIVE`.
- `Invite preview (public)`: invalid code → 404; single-char → 404 or 400.
- `Pick presets`: `GET /pick-presets` returns an array.
- `Legal documents`: `GET /legal/current` returns 200 or 404.

**Exports:** none.

**Key dependencies:** `@playwright/test`; `./helpers/auth` (`loginAsTestUser`, `apiRequest`).

**Flags:** none (production API URL is intentional per the file's design note).

---

### frontend-next/e2e/prediction-subscription.spec.ts

**Purpose:** Tests the AI-predictor subscription UI on the predictions page and its backend toggle endpoints.

**What it does:**
- `Prediction subscribe UI`: on `/mundial-2026/predicciones`, asserts a visible `#subscribe` section, a button inside it, and an `a[href='#subscribe']` pitch link in the hero.
- `Prediction subscribe API`: `GET /me/prediction-subscription` returns `{enabled: boolean}`; `PUT` toggles the value and asserts the response reflects the flip, then restores the original state.

**Exports:** none.

**Key dependencies:** `@playwright/test`; `./helpers/auth`.

**Flags:** none.

---

### frontend-next/e2e/public-pages.spec.ts

**Purpose:** Data-driven sweep over every registered public page asserting load, heading hierarchy, console cleanliness, and absence of forbidden/placeholder text.

**What it does:** Iterates `PUBLIC_PAGES` from `./helpers/pages`. Per page asserts: HTTP 200 on the ES path; a visible non-empty `<h1>`; no critical console errors (filters hydration/Warning/favicon noise); no per-page `forbiddenText`; presence of per-page `requiredElements`; and no `GLOBAL_FORBIDDEN_PATTERNS` (skipping bare `null`/`undefined` words and code/technical contexts).

**Exports:** none.

**Key dependencies:** `@playwright/test`; `./helpers/pages` (`PUBLIC_PAGES`, `GLOBAL_FORBIDDEN_PATTERNS`).

**Flags:** none.

---

### frontend-next/e2e/responsive.spec.ts

**Purpose:** Mobile-viewport smoke tests (runs only in the `mobile-chrome` Pixel 5 project).

**What it does:** Blocks: key pages (`/`, `/mundial-2026`, `/faq`, `/precios`, `/login`) load with 200 and a visible `<h1>`; a navigation/hamburger check that asserts `nav` is visible; touch-target check that the first 10 buttons are >=32px tall; and horizontal-overflow checks comparing `document.body.scrollWidth` to `window.innerWidth` (+5px slack) on home and the WC2026 hub.

**Exports:** none.

**Key dependencies:** `@playwright/test`.

**Flags:** none.

---

### frontend-next/e2e/seo-metadata.spec.ts

**Purpose:** Verifies SEO tags on every public page and `noindex` on auth pages.

**What it does:** Helpers `getMeta`/`getOgMeta` read meta content. For each `PUBLIC_PAGES` entry asserts: `<title>` contains `titleContains`; meta description present and >50 chars; canonical URL containing `picks4all.com`; an `og:title`; at least 2 `hreflang` alternates; and that any `robots` meta does not contain `noindex`. For each `AUTH_PAGES` entry asserts the `robots` meta contains `noindex`.

**Exports:** none.

**Key dependencies:** `@playwright/test`; `./helpers/pages` (`PUBLIC_PAGES`, `AUTH_PAGES`).

**Flags:** none.

---

### frontend-next/e2e/visual-regression.spec.ts

**Purpose:** Screenshot baseline/diff tests for a fixed list of public pages (desktop-chrome only).

**What it does:** `VISUAL_PAGES` lists 9 page/path/waitFor triples (home, faq, pricing, wc2026 hub/predictions/groups, login, enterprise, invite-invalid). For each: navigate, wait for the `waitFor` selector + `networkidle` + 1s settle, then `toHaveScreenshot` full-page with `maxDiffPixelRatio 0.05` and disabled animations.

**Exports:** none.

**Key dependencies:** `@playwright/test`.

**Flags:** none.

---

### frontend-next/e2e/world-cup.spec.ts

**Purpose:** Asserts the Mundial 2026 content hub and its sub-pages are complete and correct.

**What it does:**
- `WC2026 Hub`: 12 `Grupo A–L` headings; no "TBD"; >=6 nav pills; a Crear/Create CTA; and `SportsEvent` JSON-LD present.
- `WC2026 Groups`: `/mundial-2026/grupos` shows >=48 `flagcdn.com` flag images with valid src; no "TBD".
- `WC2026 Schedule`: `/mundial-2026/calendario` has an `<h1>`, mentions "104" matches, and includes "Grupo A" and "Grupo L".
- `WC2026 Venues`: `/mundial-2026/sedes` mentions MetLife/Azteca and the 3 host countries (Estados Unidos, México, Canadá).
- `WC2026 Predictions`: shows champion "Argentina", visible `#subscribe` and `#methodology` sections, and `#champion`/`#methodology` anchor links in the hero.

**Exports:** none.

**Key dependencies:** `@playwright/test`.

**Flags:** Tests assert hard-coded content ("Argentina" champion, "104" matches) — brittle if the predictions/data change, but intentional content-validation.

---

### frontend-next/eslint.config.mjs

**Purpose:** ESLint flat-config for the Next.js frontend.

**What it does:** Composes `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, then re-applies the default `globalIgnores` (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`) using `defineConfig`/`globalIgnores` from `eslint/config`.

**Exports:** default — the flat ESLint config array.

**Key dependencies:** `eslint/config`, `eslint-config-next`.

**Flags:** none.

---

### frontend-next/next.config.ts

**Purpose:** Next.js build/runtime configuration including Content-Security-Policy, security headers, image domains, Turbopack polyfill workaround, and next-intl integration.

**What it does:** Builds `cspDirectives` allowing self plus Google (GA4/GIS), Facebook, and Mercado Pago/`mlstatic` origins across script/style/img/font/connect/frame sources; `connect-src` reads `NEXT_PUBLIC_API_URL` (default `https://api.picks4all.com`); `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. `securityHeaders` adds the CSP plus HSTS (2-year preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, and a restrictive Permissions-Policy; a comment notes COOP is deliberately omitted so Google Identity Services popups can `postMessage`. The config sets `output: "standalone"` (Railway), serves the headers on all routes, whitelists remote image hosts `media.api-sports.io` and `flagcdn.com`, aliases away Next's legacy `polyfill-module` to `./src/lib/empty-polyfill.js` (Turbopack workaround pending vercel/next.js#88551), and enables `experimental.inlineCss`. Wrapped with `withNextIntl("./src/i18n/request.ts")`.

**Exports:** default — the next-intl-wrapped `NextConfig`.

**Key dependencies:** `next`, `next-intl/plugin`, `src/lib/empty-polyfill.js`, env `NEXT_PUBLIC_API_URL`.

**Flags:** Turbopack polyfill alias is a documented temporary workaround tied to an upstream PR.

---

### frontend-next/package.json

**Purpose:** Frontend package manifest (name `picks4all-frontend`, v1.0.0).

**What it does:** Scripts: `dev`/`build`/`start` (Next), `lint` (eslint). Runtime deps include Next 16.1.6, React 19.2.3, `next-intl` 4, `@dnd-kit/*` (drag-and-drop), `@mercadopago/sdk-js`, `recharts` (charts), `react-colorful` (color picker), `exceljs` (spreadsheet export). Dev deps include Playwright, `eslint-config-next`, TypeScript, `dotenv`, and for video/visual testing `@ffmpeg-installer/ffmpeg` and `ghost-cursor`. A `browserslist` targets modern Chrome/Firefox/Safari/Edge.

**Exports:** n/a (manifest).

**Key dependencies:** as listed.

**Flags:** No Polar SDK dependency listed (Polar likely server-side / hosted-checkout). `ghost-cursor` and `@ffmpeg-installer/ffmpeg` are dev-only and not referenced by the spec files in this batch (likely used by other automation/scripts).

---

### frontend-next/playwright.config.ts

**Purpose:** Playwright E2E configuration.

**What it does:** Loads `.env.local` via dotenv. `testDir: ./e2e`, fully parallel, CI-aware `forbidOnly`/`retries: 2`/`workers: 1`, 30s timeout, HTML+list reporters. `use.baseURL` defaults to `https://picks4all.com` (override via `BASE_URL`), `locale: "es"`, trace on first retry, screenshot on failure. Screenshot diff defaults at 0.05 ratio with disabled animations. Two projects: `desktop-chrome` (ignores `responsive.spec.ts`) and `mobile-chrome` (Pixel 5; matches `responsive.spec.ts`, ignores `visual-regression.spec.ts`). A header comment documents the e2e directory layout.

**Exports:** default — the Playwright config.

**Key dependencies:** `@playwright/test`, `dotenv`, `path`.

**Flags:** none.

---

### frontend-next/railway.toml

**Purpose:** Railway deploy config for the Next.js standalone frontend.

**What it does:** `[build]` uses nixpacks; buildCommand runs `npm install && npm run build`, copies `.next/static` and `public/` (with brand assets) into `.next/standalone`, and prints a brand-asset count. `[deploy]` starts `node .next/standalone/server.js`, health-checks `/` with a 120s timeout. `[build.env]` sets `NODE_ENV=production` and `NIXPACKS_NODE_VERSION=22`.

**Exports:** n/a.

**Key dependencies:** Railway/nixpacks, Node 22, Next standalone output.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/analytics-health/page.tsx

**Purpose:** Route wrapper for the admin analytics-health dashboard.

**What it does:** `generateMetadata` returns title "Analytics Health — Picks4All" with `robots: {index:false, follow:false}`. Default export renders the client component `AnalyticsHealthContent`.

**Exports:** default `AnalyticsHealthPage`, `generateMetadata`.

**Key dependencies:** `@/components/AnalyticsHealthContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/analytics/page.tsx

**Purpose:** Route wrapper for the admin analytics dashboard.

**What it does:** noindex metadata (title "Analítica — Picks4All Admin"); renders `AdminAnalyticsContent`.

**Exports:** default `AdminAnalyticsPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminAnalyticsContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/feedback/page.tsx

**Purpose:** Route wrapper for the admin feedback inbox.

**What it does:** noindex metadata (title "Admin — Picks4All"); renders `AdminFeedbackContent`.

**Exports:** default `AdminFeedbackPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminFeedbackContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/settings/email/page.tsx

**Purpose:** Route wrapper for the admin email-settings page.

**What it does:** noindex metadata (title "Admin — Picks4All"); renders `AdminEmailSettingsContent`.

**Exports:** default `AdminEmailSettingsPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminEmailSettingsContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/[id]/page.tsx

**Purpose:** Route wrapper for a single quote (cotización) detail in the sales-management admin.

**What it does:** noindex metadata (title "Cotización — Picks4All"); awaits `params` to read the `id`, then renders `AdminQuoteDetailContent` with `quoteId={id}`.

**Exports:** default async `AdminQuoteDetailPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminQuoteDetailContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/nueva/page.tsx

**Purpose:** Route wrapper for creating a new quote.

**What it does:** noindex metadata (title "Nueva cotización — Picks4All"); renders `AdminQuoteCreateContent`.

**Exports:** default `AdminQuoteCreatePage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminQuoteCreateContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/page.tsx

**Purpose:** Route wrapper for the quotes list.

**What it does:** noindex metadata (title "Cotizaciones — Picks4All"); renders `AdminQuotesListContent`.

**Exports:** default `AdminQuotesPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminQuotesListContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/[id]/page.tsx

**Purpose:** Route wrapper for a single "cuenta de cobro" (invoice/billing note) detail.

**What it does:** noindex metadata (title "Cuenta de cobro — Picks4All"); awaits `params` for `id`, renders `AdminCcDetailContent` with `ccId={id}`.

**Exports:** default async `AdminCcDetailPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminCcDetailContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/nueva/page.tsx

**Purpose:** Route wrapper for creating a new cuenta de cobro.

**What it does:** noindex metadata (title "Nueva cuenta de cobro — Picks4All"); renders `AdminCcCreateContent` inside a `<Suspense>` boundary. A comment explains the Suspense wrap is required because the content reads `?fromQuoteId=` via `useSearchParams` (Next 16 build rule) — this links the cuenta-de-cobro creation to an originating quote.

**Exports:** default `AdminCcCreatePage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminCcCreateContent`, React `Suspense`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/page.tsx

**Purpose:** Route wrapper for the cuentas-de-cobro list.

**What it does:** noindex metadata (title "Cuentas de cobro — Picks4All"); renders `AdminCcsListContent`.

**Exports:** default `AdminCcsPage`, `generateMetadata`.

**Key dependencies:** `@/components/AdminCcsListContent`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/AuthenticatedLayoutClient.tsx

**Purpose:** Client shell wrapping all authenticated routes with auth-guarding, chrome (navbar/footer), and first-login modals.

**What it does:** Renders `AuthGuard` → `PoolNavRootProvider` (lets the pool detail page publish section state up to the mobile navbar drawer) → a flex column with `NavBar`, `WhatsNewModal`, `<main id="main-content">{children}</main>`, and `Footer`; plus `LocalePreferenceGate` (the first-login locale-preference modal that mounts to nothing unless `needsLocalePrompt`).

**Exports:** named `AuthenticatedLayoutClient`.

**Key dependencies:** `@/components/AuthGuard`, `NavBar`, `Footer`, `WhatsNewModal`, `@/components/pool/PoolNav` (`PoolNavRootProvider`), `LocalePreferenceGate`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/crear-pool/page.tsx

**Purpose:** Server page for the personal pool-creation wizard.

**What it does:** `generateMetadata` reads the `poolWizard` namespace for title/subtitle and sets noindex. Default export renders `PoolCreationWizard` (default/personal mode).

**Exports:** default `CrearPoolPage`, `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/pool-wizard/PoolCreationWizard`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/dashboard/components/CreateJoinPanel.tsx

**Purpose:** The dashboard's CREATE/JOIN modal — a full-screen overlay that hosts either the two-step pool-creation form (basics → capacity) or the join-by-code form.

**What it does:** `CreateJoinPanel` is a large presentational component driven entirely by props (lifted state from `DashboardPage`). Lazy-loads `PoolConfigWizard` via `next/dynamic`. Renders a responsive modal (bottom-sheet on mobile) with a header whose title depends on `panel`/`createStep`.
- CREATE step 1: a 2-column tournament picker built from `TOURNAMENT_CATALOG`, matching each catalog entry to an available `CatalogInstance` by `template.key` (grays out/locks unavailable tournaments with a "coming soon" badge); pool name, description, deadline-minutes (0–1440), timezone inputs; a require-approval checkbox; a gradient "scoring configuration" card with a button that opens the embedded `PoolConfigWizard`, plus a "config ready (N phases)" confirmation chip; a "next step" button calling `goToCapacityStep`.
- CREATE step 2: a step indicator and `CapacitySelector` (personal/creation mode) bound to `maxParticipants`, with back/create buttons (create calls `onCreate`, disabled while `busy`).
- CREATE wizard: when `showWizard` and `instanceId`/`token` present, renders `PoolConfigWizard`, wiring `onComplete` to store `pickTypesConfig` and `onCancel` to close.
- JOIN: an invite-code input and a join button calling `onJoin`.
All styling uses the `@/lib/theme` tokens and mobile touch-target/tap-highlight helpers; placeholders come from `usePoolTerm` params.

**Exports:** named `CreateJoinPanel`, interface `CreateJoinPanelProps`.

**Key dependencies:** `next/dynamic`, `@/lib/api` (`CatalogInstance`), `@/hooks/useIsMobile`, `@/contexts/PoolTermContext`, `@/components/CapacitySelector`, `@/components/PoolConfigWizard`, `@/lib/tournamentCatalog`, `@/lib/theme`.

**Flags:** `buttonStyle` is declared in `CreateJoinPanelProps` and passed by the parent but is destructured-out / not used in the body (the prop is accepted but ignored). The `t`/`tc`/`pickTypesConfig` props are typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/dashboard/components/LeavePoolModal.tsx

**Purpose:** Confirmation modal for a player leaving a pool.

**What it does:** `LeavePoolModal` renders a centered overlay (clicking the backdrop cancels unless `busy`) showing a title, the pool name, a warning box, and Cancel / Confirm buttons. Confirm calls `onConfirm`; both disabled while `busy`, with the confirm label switching to a "leaving…" state.

**Exports:** named `LeavePoolModal`, interface `LeavePoolModalProps`.

**Key dependencies:** `@/hooks/useIsMobile`, `@/lib/api` (`MePoolRow`), `@/lib/theme`.

**Flags:** `t` prop typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/dashboard/components/PoolCard.tsx

**Purpose:** Renders one pool row on the dashboard with badges, metadata, and contextual actions (open / leave / archive-or-delete).

**What it does:** `PoolCard` displays the pool name plus a stack of badges: role pill (CORPORATE_HOST shown as "HOST"), an organization/enterprise badge when `pool.organizationId` is set, a PENDING_APPROVAL pill, a LEFT/"retired" pill, and a pool-status pill from `getPoolStatusBadge`. Meta line shows timezone and deadline minutes; an optional tournament line resolves the display name via `getTournamentName`. Actions column: for PENDING_APPROVAL shows a "waiting approval" note, otherwise an "Open pool" `Link` to `/pools/[poolId]`. A Leave button appears only for ACTIVE non-host players on non-completed/non-archived pools (calls `onLeave`). An Archive button appears for hosts on non-archived pools (calls `onArchive`), labeled "delete" when the pool is DRAFT and "archive" otherwise.

**Exports:** named `PoolCard`, interface `PoolCardProps`.

**Key dependencies:** `@/i18n/navigation` (`Link`), `@/hooks/useIsMobile`, `@/lib/api` (`MePoolRow`), `@/lib/theme` (`pillBadgeStyle`), `poolHelpers.getTournamentName`, `useTranslations("tournaments")`.

**Flags:** `t`/`te` props typed `any`. Uses `??` on `t(...)` calls (`t("deletePool") ?? "Eliminar"`) which never falls back because next-intl returns the key string when missing (per project rule that defaultMessage/`??` is not a real fallback).

---

### frontend-next/src/app/[locale]/(authenticated)/dashboard/page.tsx

**Purpose:** The authenticated dashboard — lists the user's pools across Active/Finished/Archived tabs and orchestrates pool create/join/leave/archive plus the pool-type chooser modal.

**What it does:** Client component `DashboardPage`. `detectTz()` resolves the browser timezone (default America/Bogota). `getPoolStatusBadge` maps DRAFT/ACTIVE/COMPLETED/ARCHIVED to color/emoji and a localized label. Reads the token once via `getToken()`. State holds rows, catalog instances, error, the active tab (synced to the `?tab=` query param via `setActiveTab`/`router.replace`), the leave modal, the create/join panel mode, the wizard/step flags, and the full create form (instance, name, desc, deadline, timezone, requireApproval, maxParticipants, pickTypesConfig) and join code. `activePools`/`finishedPools`/`archivedPools` memoize the row partitions.
- `loadAll` fetches `getMePools` + `listCatalogInstances` in parallel and seeds a default instance.
- `validateCreate`/`goToCapacityStep` gate step 2 (require instance, name >=3 chars, a scoring config).
- `onCreate` calls `createPool` then resets the panel and navigates to the new pool.
- `onJoin` calls `joinPool`; if the result is PENDING_APPROVAL it alerts and stays, otherwise navigates to the joined pool.
- `onLeavePool`/`onArchivePool` call `leavePool`/`archivePool` (archive uses a hard-coded Spanish `confirm()` differing for DRAFT-delete vs archive) and reload.
Renders the header with Create / Join / (desktop) Logout buttons, an error banner, a loading state, the three-tab bar with counts, a grid of `PoolCard`s (empty states per tab), the `LeavePoolModal`, the `CreateJoinPanel` (passing all lifted state), and a `showPoolTypeModal` chooser routing to `/crear-pool` (personal) or `/empresas/crear` (corporate). Logout calls `apiLogout()` + `clearToken()` and redirects to the locale home.

**Exports:** default `DashboardPage`.

**Key dependencies:** `@/lib/api` (`createPool`, `getMePools`, `joinPool`, `leavePool`, `archivePool`, `listCatalogInstances`, `logout`, types), `@/lib/auth` (`getToken`/`clearToken`), `@/types/pickConfig`, `@/hooks/useIsMobile`, `@/lib/theme`, sibling `PoolCard`/`LeavePoolModal`/`CreateJoinPanel`.

**Flags:** `onArchivePool`'s confirm dialog and the pool-type-modal logic use hard-coded Spanish strings instead of i18n keys (violates the project's i18n rule); the rest of the page is translated. Several `t(...) ?? "fallback"` usages won't actually fall back (next-intl returns the key). `buttonStyle` is defined and passed to `CreateJoinPanel` but unused there.

---

### frontend-next/src/app/[locale]/(authenticated)/empresas/crear/page.tsx

**Purpose:** Server page for the corporate pool-creation wizard.

**What it does:** `generateMetadata` reads `enterprise.create.meta.title`, sets noindex, and declares localized `alternates.languages` for the route across ES (`/empresas/crear`), EN (`/en/for-companies/create`), PT (`/pt/para-empresas/criar`). Default export renders `PoolCreationWizard` with `mode="corporate"`.

**Exports:** default `CorporateCreatePage`, `generateMetadata`.

**Key dependencies:** `next-intl/server`, `@/components/pool-wizard/PoolCreationWizard`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/error.tsx

**Purpose:** Error boundary UI for the authenticated route segment.

**What it does:** Client component `AuthenticatedError` receiving the standard `{error, reset}` props (error unused). Renders a centered branded error screen (`BrandLogo`, translated title/message from the `error` namespace), a "retry" button calling `reset`, and a plain `<a href="/">` "go home" link.

**Exports:** default `AuthenticatedError`.

**Key dependencies:** `next-intl` (`useTranslations`), `@/components/BrandLogo`, `@/lib/theme`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/layout.tsx

**Purpose:** Server layout for the authenticated segment — forces dynamic rendering and noindex, then delegates to the client shell.

**What it does:** Exports `metadata` with `robots: {index:false, follow:false}`, and `export const dynamic = "force-dynamic"` (extensively commented: needed because making the public `[locale]` layout statically renderable caused Next to try prerendering this tree, which fails on client-only hooks like `useSearchParams`/localStorage tokens). Default `AuthenticatedLayout` renders `AuthenticatedLayoutClient` with children.

**Exports:** default `AuthenticatedLayout`, `metadata`, `dynamic`.

**Key dependencies:** `./AuthenticatedLayoutClient`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/loading.tsx

**Purpose:** Streaming-SSR skeleton shown during navigation to authenticated segments.

**What it does:** `AuthenticatedLoading` renders an accessible (`role=status`, `aria-busy`, off-screen "Loading…" text) two-block shimmer skeleton animated via the `p4a-skeleton-shimmer` keyframes.

**Exports:** default `AuthenticatedLoading`.

**Key dependencies:** none (inline styles; relies on a global `p4a-skeleton-shimmer` animation).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/AdminSettingsToggles.tsx

**Purpose:** Host admin panel of pool-level setting toggles: auto-advance, require-approval, and per-phase extra-time inclusion.

**What it does:** `AdminSettingsToggles` renders three sections.
- Auto-advance: a `ToggleSwitch` that PATCHes `updatePoolSettings({autoAdvanceEnabled})` (busy-keyed on `auto-advance-toggle`, reloads, surfaces `friendlyError`).
- Require-approval: same pattern for `requireApproval` (busy-key `require-approval-toggle`).
- Extra-time: only rendered when `pickTypesConfig` has phases with `requiresScore`. For each scoring phase it computes a lock state: locked if any match has a result (with distinct reasons for fully-completed vs old-results), or if the first match deadline (kickoff minus `deadlineMinutesBeforeKickoff`) is within 48h. The per-phase `ToggleSwitch` adds/removes the phase from `extraTimePhases` and PATCHes via `updatePoolSettings` (busy-key `et-<phaseId>`).

**Exports:** named `AdminSettingsToggles`, interface `AdminSettingsTogglesProps`.

**Key dependencies:** `@/lib/api` (`updatePoolSettings`, `PoolOverview`), sibling `poolTypes.PhaseData`, `poolHelpers.formatPhaseFullName`, `@/components/ui/ToggleSwitch`, `@/lib/theme`.

**Flags:** `friendlyError` typed `(e:any)`; leftover `console.error('[TOGGLE]...')` debug log in the auto-advance handler. Imports `shadows` from theme but does not use it.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ExpulsionModal.tsx

**Purpose:** Modal for kicking (temporary, rejoinable) or banning (permanent) a pool member, with the revert-confirmation flow.

**What it does:** `ExpulsionModal` branches on `data.type`.
- KICK: warning box and an optional reason textarea; submit calls `kickMember`. If the backend returns 409 with `REVERT_PENDING_CONFIRMATION` (this removal would empty the pool of non-host members and trigger ACTIVE→DRAFT revert + deletion of player predictions), it shows a `window.confirm` and retries with the `confirmRevert: true` flag; success alerts and closes.
- BAN: a stronger warning with bulleted consequences, a required reason, and a "delete picks" checkbox; submit calls `banMember` with the same 409-revert retry handling.
Both branches busy-key on `kick:<id>`/`ban:<id>` and surface `friendlyError`.

**Exports:** named `ExpulsionModal`, interface `ExpulsionModalProps`. Module-local const `REVERT_PENDING_CODE`.

**Key dependencies:** `@/lib/api` (`kickMember`, `banMember`), `@/lib/apiError` (`isApiError`), sibling `poolTypes.ExpulsionModalData`, `@/lib/theme`.

**Flags:** none (the revert flow is documented and intentional).

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ManageRulesPanel.tsx

**Purpose:** Host-only panel to view and (in DRAFT only) edit a pool's scoring rules, embedding the standalone `ScoringEditor`.

**What it does:** `detectPresetKey` heuristically infers the wizard preset (SIMPLE/CUMULATIVE/BASIC/CUSTOM) from `pickTypesConfig` so the editor opens on the likely starting view. `ManageRulesPanel` returns null unless `permissions.canManageResults`. It computes `isDraft`, the current config, and the detected preset (memoized). State holds `isEditing`, draft style/config, and `saving`; a `useEffect` re-seeds the draft from server state whenever the modal opens. Renders a current-preset summary card (icon/name/phase count from `PRESETS`). In DRAFT it shows a hint and an "edit" button opening the modal; in other states it shows a locked banner explaining that removing all non-host members reverts to DRAFT to unlock editing. The editor modal hosts `ScoringEditor` (wired to draft state) with sticky Cancel/Save buttons; `handleSave` confirms, calls `updatePoolScoringConfig`, reloads, closes, and alerts.

**Exports:** named `ManageRulesPanel`, interface `ManageRulesPanelProps`.

**Key dependencies:** `@/lib/api` (`updatePoolScoringConfig`, `PoolOverview`), `@/types/pickConfig`, `@/types/poolWizard`, `@/components/scoring-editor/ScoringEditor`, `@/components/scoring-editor/presets` (`PRESETS`), `@/lib/theme`, `@/hooks/useIsMobile`.

**Flags:** Calls hooks (`useMemo`, `useState`, `useEffect`) after an early `return null` guard — a conditional-hooks pattern that violates the Rules of Hooks (works because the guard depends on a stable prop, but is fragile). Imports `colors` but it is used; `shadows` imported and used in modal.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/MemberManagement.tsx

**Purpose:** Host admin member roster with search, pagination, role promote/demote, and kick/ban entry points.

**What it does:** `MemberManagement` returns null unless `canManageResults`. Uses leaderboard rows as the member source, filters by a search box (display name/email), paginates at `PAGE_SIZE = 20` via `PaginationControls`. Each member card shows display name, email, role pills (HOST/CO-ADMIN/PLAYER), a LEFT/"retired" badge, and points. For non-hosts it renders action buttons: promote PLAYER→CO_ADMIN (`promoteMemberToCoAdmin`, confirm + busy-key `promote:<id>`), demote CO_ADMIN→PLAYER (`demoteMemberFromCoAdmin`, busy-key `demote:<id>`), and Kick/Ban buttons that open the expulsion modal via `setExpulsionModalData`.

**Exports:** named `MemberManagement`, interface `MemberManagementProps`.

**Key dependencies:** `@/lib/api` (`promoteMemberToCoAdmin`, `demoteMemberFromCoAdmin`, `PoolOverview`), sibling `poolTypes.ExpulsionModalData`, `@/lib/theme`, `@/hooks/useIsMobile`, `@/components/PaginationControls`.

**Flags:** Conditional-hooks pattern (the `return null` guard precedes `useMemo`); members typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/PendingJoinRequests.tsx

**Purpose:** Host panel listing pending join requests with approve/reject actions.

**What it does:** `PendingJoinRequests` returns null when there are no `pendingMembers`. Renders a warning-styled card listing each pending member (display name, @username, email, requested-at via `fmtUtc`). Approve calls `approveMember` (confirm, busy-key `approve-<id>`, then `loadPendingMembers`+`reload`+`refetchNotifications`); Reject prompts for an optional reason and calls `rejectMember` (busy-key `reject-<id>`, then `loadPendingMembers`+`refetchNotifications`).

**Exports:** named `PendingJoinRequests`, interface `PendingJoinRequestsProps`.

**Key dependencies:** `@/lib/api` (`approveMember`, `rejectMember`), `poolHelpers.fmtUtc`, `@/lib/theme`, `useLocale`.

**Flags:** `pendingMembers`/members typed `any[]`.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/PhaseStatusPanel.tsx

**Purpose:** Host panel showing per-phase status (pending/active/completed) with progress bars, manual advance, and lock/unlock controls.

**What it does:** `PhaseStatusPanel` maps each phase to its match completion progress and a status-color palette (icon/colors). For COMPLETED phases not yet advanced (and with a `nextPhaseMap` target) it shows an "advance" button calling `manualAdvancePhase` (busy-key `advance:<id>`); already-advanced phases show an "already advanced" chip. A lock/unlock button is always available (deliberately not gated to COMPLETED — comment explains locking must work before a phase finishes), calling `lockPhase(token, poolId, phaseId, !currentlyLocked)` (busy-key `lock:<id>`), reading current lock state from `overview.pool.lockedPhases`.

**Exports:** named `PhaseStatusPanel`, interface `PhaseStatusPanelProps`.

**Key dependencies:** `@/lib/api` (`manualAdvancePhase`, `lockPhase`, `PoolOverview`), `poolTypes.PhaseData`, `poolHelpers.formatPhaseFullName`, `@/lib/theme` (`badgeStyle`).

**Flags:** Imports `shadows` from theme but does not use it; phase/match items typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchCard.tsx

**Purpose:** Renders a single match within the pool detail picks view — team flags/placeholders, live/lock/scoring badges, kickoff/deadline times, and the player pick + host result sections.

**What it does:** `MatchCard` resolves placeholder detection (`isPlaceholder`) for home/away, localized team names (`getTeamName`), and a `matchTitle`. The header renders flags via `getTeamFlag` (falling back to a ⚽ box) or italicized placeholder names with a 🔒 icon, plus status badges: locked/open, a "scoring disabled" warning, and a live/halftime/final indicator with a status-dependent palette and pulsing dot (computed from `matchStatus`/`matchSyncStatus`). Below: match label + localized kickoff/deadline times (`fmtUtc` with the user locale to fix the I18N_AUDIT issue of Spanish-only dates), an optional "scoring disabled by host" banner with reason. If any team is a placeholder it shows a pending message; otherwise it renders `PickSection` (player's pick; locked when match locked or membership LEFT) and `ResultSection` (host result entry, supporting penalties). For locked non-placeholder matches it shows action buttons: "view breakdown" (only when a result exists and the phase `requiresScore`) calling `onViewBreakdown`, and "view other picks" calling `onViewMatchPicks`.

**Exports:** named `MatchCard`.

**Key dependencies:** `@/data/teamFlags` (`getTeamFlag`), `@/hooks/useIsMobile`, `@/lib/poolTypes` (`PoolOverview`, `PoolMatchCard`), sibling `poolHelpers` and `PickComponents`/`ResultComponents`, `@/lib/theme`, `useLocale`.

**Flags:** The host "toggle scoring for this match" button (and thus the entire purpose of the `onToggleScoring` prop) is commented out "disabled by product decision (kept commented for future reactivation)". As a result `onToggleScoring` is a required prop with no live consumer — confidence high that it is currently dead. Several props/locals typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/MatchPicksModal.tsx

**Purpose:** Read-only modal showing all members' picks for one match (after the deadline unlocks them).

**What it does:** `MatchPicksModal` renders an overlay with a sticky header (title + match title, close button) and a body handling loading, error, not-yet-unlocked, empty, and populated states. For each pick row it shows the member name (current user highlighted with a "you" badge) and the pick value: SCORE shows "home - away", OUTCOME shows a localized HOME/DRAW/AWAY label, unknown types fall back to `JSON.stringify`, and missing picks show a "no pick" label.

**Exports:** named `MatchPicksModal`, interface `MatchPicksModalData`.

**Key dependencies:** `@/lib/theme`, `@/lib/api` (`MatchPicksResponse`), `useTranslations("pool")`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PickComponents.tsx

**Purpose:** The player pick UI primitives — display + edit of a SCORE or OUTCOME prediction, with read/edit-mode switching.

**What it does:** Three components.
- `PickSection`: container managing `editMode`; shows a locked/no-pick note, a read-only `PickDisplay` (with a "modify" button when unlocked), or a `PickEditor` when editing or no pick exists. Saving exits edit mode.
- `PickDisplay`: renders a SCORE pick (flags + big score, ⚽ fallback) or an OUTCOME pick (team flags via `TeamFlag` + a localized 🏠/🤝/🚪 outcome label), falling back to a JSON `<pre>` for unknown types.
- `PickEditor`: for score pools shows two numeric inputs flanked by stacked team flag+name columns; for outcome pools shows a `<select>` of HOME/DRAW/AWAY. `handleSave` emits `{type:"SCORE", homeGoals, awayGoals}` or `{type:"OUTCOME", outcome}`. Save/Cancel buttons with mobile touch targets.

**Exports:** named `PickSection` (plus internal `PickDisplay`/`PickEditor`).

**Key dependencies:** `@/components/TeamFlag`, `@/data/teamFlags` (`getTeamFlag`), `@/hooks/useIsMobile`, `@/lib/theme`, `poolHelpers.getTeamName`.

**Flags:** `PickSection` contains two no-op locals explicitly voided as "reserved for future": `_pickType` (`void _pickType; // Reserved for future pick type display`) and `_canEdit` (`void _canEdit;`) — dead/placeholder code retained intentionally. Pick props typed `any`.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolAdminTab.tsx

**Purpose:** The pool detail page's "Admin" tab — composes the host admin sub-panels and the archive/instructions sections.

**What it does:** `PoolAdminTab` renders the admin title, a `NotificationBanner` (only for phase-ready-to-advance signals; comment notes pending-approval was moved to the Players tab), then in order: `AdminSettingsToggles`, `ManageRulesPanel`, `PhaseStatusPanel`. For COMPLETED pools it shows an "archive pool" section whose button calls `archivePool` (confirm, busy-key `archive`, reload, alert). Finally an info box with six host tips.

**Exports:** named `PoolAdminTab`.

**Key dependencies:** `@/lib/api` (`archivePool`), `@/components/NotificationBanner`, sibling `poolTypes` (`PoolTabBaseProps`, `PhaseData`), and the three admin sub-panels.

**Flags:** `notifications`/`friendlyError` and several props typed `any`. `MemberManagement`, `PendingJoinRequests`, and `ExpulsionModal` are NOT mounted here (they live in the Players tab per the comment) — so within this file they have no consumer, but they are consumed elsewhere in the pool detail page.
