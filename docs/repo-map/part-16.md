## Batch 16

This batch covers the World Cup 2026 SEO hub and its sub-pages, the localized 404 page, the home landing page, the three payment return pages (+ their shared layout), the four regional-term SEO article pages (penca/polla/porra/prode), the pricing page (+ its client content), and the privacy page (+ its client content). All are routes under `frontend-next/src/app/[locale]/`.

Cross-cutting conventions used by nearly every file in this batch:
- Server pages are `async` and receive `params: Promise<{ locale: string }>` (Next.js 16 async params). Each calls `setRequestLocale(locale)` before reading translations.
- Metadata is produced via `generateMetadata` → `buildPageMetadata` from `@/lib/seo`, which centralizes title/description/canonical/OG/hreflang. URLs derive from `SITE_URL` (`@/lib/siteConfig`).
- Localized slugs are mapped per-locale (ES default has no prefix; EN `/en/`, PT `/pt/`).
- `Breadcrumbs` and `JsonLd` components emit structured data; `PublicPageWrapper` wraps the public chrome (navbar/footer).
- `getLocale` is imported in many files but unused (see Flags).

---

### frontend-next/src/app/[locale]/mundial-2026/page.tsx

**Purpose:** The World Cup 2026 SEO hub landing page — the top of the `/mundial-2026` (ES) / `/world-cup-2026` (EN) / `/copa-do-mundo-2026` (PT) cluster. Markets pool creation around the tournament and links out to the cluster's sub-pages.

**What it does:**
- **Static data:** `GROUPS` (Record A–L → array of 4 team names in Spanish) and `GROUP_FLAGS` (A–L → array of 4 ISO flag codes for flagcdn.com), positionally aligned with `GROUPS`.
- **`generateMetadata`:** reads the `seo` namespace, builds metadata with per-locale path map for the hub.
- **`SubPage` interface + `getSubPages(locale)`:** returns 6 sub-page link descriptors (groups, calendar, venues, guide, rules, predictions), computing the locale-correct prefix and per-locale slug segments (e.g. `groups`/`grupos`, `pool-rules`/`reglas-quiniela`/`regras-bolao`). Each carries `titleKey`, `descKey`, `href`, and an emoji `icon`.
- **`Mundial2026Page` (default export):** reads `worldCup` namespace; builds `faqItems` (5 Q/A pairs from `hub.faq.*`). Renders:
  - `Breadcrumbs` (home → world cup).
  - Two `JsonLd` blocks: a `@graph` with a `SportsEvent` (FIFA World Cup 2026, dates 2026-06-11 → 2026-07-19, three host-country `Place`s, FIFA organizer, and a `competitor` list flattened from all `GROUPS` teams) plus a `WebPage`; and a separate `FAQPage` built from `faqItems`.
  - Hero section (brand gradient) with title/subtitle, 4 stat cards (teams/matches/venues/countries), a `RegisterButton`, and a horizontally-scrollable nav of sub-page pills.
  - Groups overview grid (12 group cards, each listing 4 teams with flagcdn `<img>` flags using `GROUP_FLAGS[letter]?.[i] ?? "xx"`), plus a "view all groups" deep link.
  - "How it works" 4-step section (hardcoded emoji array, steps from `hub.howItWorks.step{n}*`).
  - Features grid (free/auto/custom/multi, each with emoji + `hub.features.*`).
  - Sub-pages navigation grid (cards built from `getSubPages`).
  - FAQ accordion (`<details>/<summary>` per `faqItems`).
  - Share section (`ShareButtons` context `worldCupHub`) and a bottom CTA section with `RegisterButton`.

**Exports:** `generateMetadata` (async), default `Mundial2026Page` component.

**Key dependencies:** `next-intl/server` (`getTranslations`, `setRequestLocale`), `PublicPageWrapper`, `JsonLd`, `Breadcrumbs`, `RegisterButton`, `ShareButtons`, `colors` (`@/lib/theme`), `SITE_URL` (`@/lib/siteConfig`), `buildPageMetadata` (`@/lib/seo`), `BRAND` (`@/lib/brand`). External: flagcdn.com images.

**Flags:** `getLocale` imported but unused. Team/flag/group data is hardcoded inline (acceptable as static SEO content per repo conventions, but note it is not driven from the DB). The flag fallback `"xx"` yields a broken flag image if data drifts.

---

### frontend-next/src/app/[locale]/mundial-2026/predicciones/page.tsx

**Purpose:** AI-prediction article page for the World Cup (full bracket prediction from groups to champion), with a subscribe-to-updates CTA. SEO `article` type.

**What it does:**
- **Static data:** `GroupPrediction` interface; `GROUP_PREDICTIONS` (A–L, each predicted finishing order with aligned flag codes). `POSITION_COLORS` (gold/silver/bronze/grey by place). `KnockoutMatch` interface and hardcoded bracket arrays `R32_MATCHES` (16), `R16_MATCHES` (8), `QF_MATCHES` (4), `SF_MATCHES` (2), and `FINAL_MATCH` — each with teamA/teamB, flags, and predicted `winner`. Final prediction: Argentina champion over Brazil.
- **`PUBLISHED_AT`/`MODIFIED_AT`** constants feed article timestamps.
- **`generateMetadata`:** `seo.worldCupPredictions.*`, `type: "article"` with publish/modified times.
- **Helper components:**
  - `TeamRow`: a list row with a colored position badge, flag, team name, and a "Q" (qualified) tag for positions 0–1.
  - `KnockoutMatchCard`: a two-team card highlighting the predicted winner with a "W" marker.
- **`PredictionsPage` (default):** reads `worldCup` namespace; builds path maps for the page and the parent hub; builds `bestThirds` (8 teams from `predictions.bestThirds.team{n}` + hardcoded flags). Renders:
  - `Breadcrumbs` (home → world cup → predictions); `JsonLd` `Article` (note: `dateModified` hardcoded to `2026-04-04`, diverging from the `MODIFIED_AT` used in metadata — see Flags).
  - Hero with badge, title/subtitle, anchor buttons (`#champion`, `#methodology`), and an in-hero subscribe pitch linking to `#subscribe`.
  - Champion reveal section: the final matchup card and the Argentina champion card (with inline `ShareButtons` context `predictions`).
  - Subscribe section (`#subscribe`) rendering `PredictionSubscribeButton`.
  - Knockout bracket section rendering `KnockoutMatchCard` grids for R32/R16/QF/SF.
  - Group-stage predictions grid (12 cards: gradient header, `TeamRow` list translating team names via `predictions.groups.teams.{letter}{i+1}`, plus a per-group analysis snippet `predictions.groups.analysis{letter}`).
  - Best third-place teams chip list.
  - Detailed analysis (4 paragraphs), methodology section (`#methodology`, 6 factor cards rankings/history/form/squad/home/h2h + an AI note), final CTA with `RegisterButton`, and a disclaimer.

**Exports:** `generateMetadata`, default `PredictionsPage`.

**Key dependencies:** same SEO/UI set as the hub, plus `PredictionSubscribeButton` (`@/components/PredictionSubscribeButton`). External: flagcdn.com.

**Flags:** `getLocale` imported but unused. The `JsonLd` `datePublished`/`dateModified` are hardcoded `2026-04-04` while `generateMetadata` uses `MODIFIED_AT = 2026-04-16` — inconsistent modified date between page JSON-LD and head metadata. All prediction data is hardcoded static content.

---

### frontend-next/src/app/[locale]/mundial-2026/reglas-quiniela/page.tsx

**Purpose:** Explains the World Cup pool scoring rules (exact score, winner, goal difference, phase multipliers, deadlines, results, leaderboard). SEO `article` type.

**What it does:**
- **`generateMetadata`:** `seo.worldCupRules.*`, per-locale paths, `type: "article"` with timestamps.
- **`RulesMessages` interface:** a typed shape for the `rules` object inside the `worldCup.json` message file (breadcrumbs, hero, whatIs, scoring with 4 buckets, multipliers with a 7-field table, deadlines, results, leaderboard, cta, jsonLd).
- **`ReglasQuinielaPage` (default):** loads messages NOT via `getTranslations` but by dynamic `import("@/messages/${locale}/worldCup.json")` and taking `.default.rules`, typed as `RulesMessages`. Builds page/hub path maps and `multiplierRows` (6 rows: groups, R32, quarters, semis, third-place, final, each with phase label + multiplier). Renders:
  - `Breadcrumbs` and an `Article` `JsonLd`.
  - Dark-gradient hero; "what is a quiniela" section; a deliberately asymmetric Scoring section (exact = boxed "3 pts" highlight; winner = brand left-border; goal difference = amber left-border; miss = dimmed); a phase-multipliers `<table>` (final row visually emphasized) with an example note; deadlines, results, and leaderboard prose sections; and a closing CTA with `RegisterButton`.

**Exports:** `generateMetadata`, default `ReglasQuinielaPage`. (`RulesMessages` is a local interface, not exported.)

**Key dependencies:** dynamic JSON import of `@/messages/{locale}/worldCup.json`, `colors` (`@/lib/theme`), SEO/UI components.

**Flags:** `getLocale` and `getTranslations` are imported but unused (this page reads messages via dynamic import instead). The dynamic-import-of-messages pattern diverges from the `getTranslations` pattern every other page in this batch uses — a duplication/inconsistency worth noting. `isLast` and `isFinal` in the multiplier table are computed identically (both `i === length-1`) — redundant duplicate variables.

---

### frontend-next/src/app/[locale]/mundial-2026/sedes/page.tsx

**Purpose:** Lists the 16 World Cup 2026 venues (stadiums) grouped by host country, with capacities and notable facts. SEO page.

**What it does:**
- **`generateMetadata`:** `seo.worldCupVenues.*`, per-locale paths.
- **Static data:** `Venue` interface; `VENUES` array of 16 stadiums (11 USA, 3 México, 2 Canadá) with name/city/country/capacity/note. `COUNTRY_FLAGS`, `COUNTRY_TRANSLATE_KEY`, `COUNTRY_ORDER` maps; helpers `flagUrl(code)` (flagcdn 32x24) and `formatCapacity(num)` (`toLocaleString("en-US")`).
- **`SedesPage` (default):** reads `worldCup.venues` namespace; builds page/hub path maps; groups `VENUES` into `venuesByCountry`; builds `venueJsonLd` (`Place` entries with locality + ISO country + `maximumAttendeeCapacity`). Renders:
  - `Breadcrumbs` and an `ItemList` `JsonLd` of all venues.
  - Dark hero; a "venue map" country-overview grid (flag + country name + per-country count from `venueMap.{usa|mexico|canada}Count`); a venues-by-country section iterating `COUNTRY_ORDER` (country header with stadium count, then a grid of venue cards showing name/city/capacity and an optional "notable" note); a facts section (6 fixed fact keys, final-venue row bolded); and a CTA with `RegisterButton`.

**Exports:** `generateMetadata`, default `SedesPage`.

**Key dependencies:** SEO/UI components, `colors`, `SITE_URL`. External: flagcdn.com.

**Flags:** `getLocale` imported but unused. `worldCupPaths[locale]`/`paths[locale]` are indexed without the `|| paths.es` fallback used elsewhere — a non-es/en/pt locale would yield `undefined` in the breadcrumb URL (low risk since locales are constrained upstream). Venue data is hardcoded static content with Spanish-only `note` strings (the notes are not translated for EN/PT).

---

### frontend-next/src/app/[locale]/not-found.tsx

**Purpose:** The localized 404 page for the `[locale]` segment.

**What it does:** Exports a static `metadata` with `title: "404"` and `robots: { index: false, follow: false }`. The default `NotFound` component simply renders `<NotFoundContent />` (the actual 404 UI lives in that component).

**Exports:** `metadata`, default `NotFound`.

**Key dependencies:** `NotFoundContent` (`@/components/NotFoundContent`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/page.tsx

**Purpose:** The home/landing page. Switches messaging to a World Cup focus when configured. Renders the interactive landing inside a Suspense boundary so the route stays statically prerenderable and indexable.

**What it does:**
- **`generateMetadata`:** computes `useWorldCup = WORLD_CUP_FOCUS && locale === "es"`; picks `home.titleWorldCup`/`home.descriptionWorldCup` vs the default keys; path `""` (root). Passes `extra.title.absolute` so the home title is not suffixed with the brand template.
- **`LandingPage` (default):** recomputes `useWorldCup`; builds a 6-item `featureList` (loop over `featureList`/`featureListWorldCup` indices 0–5), plus `appDescription` and `ctaName` (World Cup variants when applicable). Renders:
  - A `WebApplication` `JsonLd` (name Picks4All, SportsApplication/Game, `inLanguage`, OG image, free `Offer` priced 0 COP, publisher org, `featureList`, and a `ViewAction` potentialAction).
  - `PublicPageWrapper` wrapping a `<Suspense>` whose `fallback` is `<LandingContentSSR locale={locale} />` (full server-rendered SEO content) and whose child is the client `<LandingContent />`. The lengthy comment documents that the Suspense boundary is required because `LandingContent` uses `useSearchParams()` (ref/utm params); without it the home page emitted `Cache-Control: no-store` and stayed un-indexed.

**Exports:** `generateMetadata`, default `LandingPage`.

**Key dependencies:** `LandingContent` + `LandingContentSSR` (`@/components`), `SITE_URL` + `WORLD_CUP_FOCUS` (`@/lib/siteConfig`), `buildPageMetadata`, `JsonLd`, `PublicPageWrapper`.

**Flags:** none. (Offer currency hardcoded COP in JSON-LD, but this is structured-data boilerplate for a free tier.)

---

### frontend-next/src/app/[locale]/pago/cancelado/page.tsx

**Purpose:** Payment-cancelled return page (client). Confirms cancellation to the user and reports the cancellation to the backend audit trail + analytics.

**What it does:** Client component. Reads `poolId` and `paymentId` from `useSearchParams`. On mount (guarded by `reportedRef` to avoid React strict-mode double-fire):
- If `paymentId` present, calls `reportPaymentAttemptEvent(paymentId, { eventType: "USER_CANCELLED", details: { poolId, source: "pago_cancelado_page" } })` (closes the cancellation branch of the payment-attempt audit — ties to ADR-066 / F-17 / G-2 per comments).
- Always fires GA4 `trackEvent("payment_cancelled", …)` (custom event distinct from `payment_failed` and abandonment).
Renders a centered card: an X-circle SVG, `payment.cancel.title`/`subtitle`, a brand-gradient "go to pool" button (only when `poolId` present) routing to `/pools/{poolId}`, and a "continue free" button routing to `/dashboard`.

**Exports:** default `PaymentCancelledPage`.

**Key dependencies:** `reportPaymentAttemptEvent` (`@/lib/api/paymentAttemptEvent`), `trackEvent` (`@/lib/analytics`), `colors`/`radii`/`fontWeight` (`@/lib/theme`), `BRAND`, next-intl `payment` namespace, next/navigation router.

**Flags:** none.

---

### frontend-next/src/app/[locale]/pago/checkout/page.tsx

**Purpose:** Mercado Pago Payment Brick checkout page (client). Embeds the MP Brick in-page (user never leaves), submits to the backend, and emits a full payment-attempt telemetry lifecycle (ADR-066).

**What it does:** Client component.
- **Status detail mapping:** `STATUS_DETAIL_KEY` maps MP `status_detail` codes to i18n keys; `getRejectionMessage(t, statusDetail)` resolves a localized rejection message (falling back to `rejected.generic`).
- **Refs/state:** `status` state machine (`loading|ready|processing|success|error`), `errorMsg`, `brickControllerRef`, `brickInitialized`, `brickReadyRef` (set on MP `onReady`, used to classify errors as `init` vs `render`), `suppressUnloadRef` (set before deliberate navigations to suppress the `beforeunload` beacon), `mountedAtRef` (for `msOnPage`).
- **Query params:** publicKey, amount, paymentId, preferenceId, poolId, fromCapacity, toCapacity, poolType (normalized to `corporate`|`personal`). `upgrade` (`PoolUpgradeItem`) memoized so all GA4 ecommerce events share identical `items[]`/`value`.
- **Brick init effect:** validates required params (publicKey/amount/preferenceId, else error state); dynamically imports `@mercadopago/sdk-js`, instantiates `MercadoPago(publicKey, { locale: "es-CO" })`, creates a `payment` Brick in `#mp-brick-container` with all payment methods enabled. Callbacks:
  - `onReady`: sets `ready`, flips `brickReadyRef`, fires `BRICK_LOADED` attempt event.
  - `onSubmit`: short-circuits wallet/credits methods; fires GA4 `trackAddPaymentInfo` + Meta `AddPaymentInfo`; sets `processing`; collects Meta cookies (`getMetaCookies`); calls `processMpPayment(paymentId, formData, metaCookies)`. On `approved` → GA4 `trackPurchase` + Meta `Purchase` (with `metaEventId` for dedupe), set `success`, suppress unload, redirect to `/pools/{poolId}` after 2s. On `rejected` → error with localized message. On pending/in_process (async PSE/Nequi) → success state then redirect to `/pago/exitoso?poolId=…` (where polling confirms). `.catch` sets error and rethrows so the Brick shows its error state.
  - `onError`: sets error, builds a detail string, fires `BRICK_ERROR` with `stage: render|init` (based on `brickReadyRef`).
  - Outer `try/catch`: SDK load/instantiation failure sets error and fires `BRICK_ERROR` with `stage: "init"`, `phase: "sdk_load_or_instantiation"`.
  - Cleanup unmounts the Brick controller.
- **`USER_CLOSED_TAB` effect:** adds a `beforeunload` listener that (unless `suppressUnloadRef` or `status==="success"` or no paymentId) fires `reportPaymentAttemptEventBeacon` (via `navigator.sendBeacon`, since fetch doesn't survive unload) with brickStatus, msOnPage, hadBrickLoaded.
- **`handleRetry`:** unmounts/clears the Brick, resets `brickInitialized`, clears error, returns to `loading` (re-triggers init).
- **Render:** header (upgrade title + COP price via `formatCOP`); a card with loading spinner, the `#mp-brick-container`, processing spinner, success checkmark, and error state with a retry button; plus a cancel/back link (only in `loading|ready`) that fires `USER_CANCELLED`, suppresses unload, and routes to `/pools/{poolId}` or `/dashboard`. Inline `@keyframes spin`.

**Exports:** default `MpCheckoutPage`.

**Key dependencies:** `@mercadopago/sdk-js` (dynamic import), `processMpPayment` (`@/lib/api/payments`), `reportPaymentAttemptEvent` + `reportPaymentAttemptEventBeacon` (`@/lib/api/paymentAttemptEvent`), `formatCOP` (`@/lib/pricing`), `trackMetaEvent`/`getMetaCookies` (`@/lib/metaPixel`), `trackAddPaymentInfo`/`trackPurchase` + `PoolUpgradeItem`/`PoolType` (`@/lib/ecommerce`), theme/brand.

**Flags:** Two `eslint-disable @typescript-eslint/no-explicit-any` (the MP SDK is untyped at the `window.MercadoPago` boundary — acceptable per the "any at boundaries" rule). Two hardcoded Spanish error strings in the param-validation/SDK-failure paths (`"Configuración de pagos incompleta…"`, `"Monto inválido."`, `"No se pudo cargar el formulario…"`) are NOT localized via `t()` — inconsistent with i18n rules. MP locale is hardcoded `es-CO` regardless of UI locale (intentional, since this gateway is Colombia-only).

---

### frontend-next/src/app/[locale]/pago/exitoso/page.tsx

**Purpose:** Payment-success return page (client). Polls the backend for COMPLETED status (covers async gateways like Polar/PSE/Nequi), then fires the conversion analytics and confirms to the user.

**What it does:** Client component.
- Constants: `MAX_POLLS = 15`, `POLL_INTERVAL_MS = 2000` (≈30s total).
- Reads `poolId`; state `status` (`polling|confirmed|timeout`) and `capacity`. `purchaseReported` ref guards against duplicate `purchase` pushes (the MP Brick page already fires `purchase` for sync approvals; this page re-fires only for async gateways).
- **Polling effect:** every 2s calls `getPaymentStatus(poolId)`. On `COMPLETED`: sets `confirmed`, stores `toCapacity`. If not already reported and all fields present (transactionId, fromCapacity, toCapacity, amountUsd, currency, poolType), fires GA4 `trackPurchase` (affiliation chosen by currency: USD→"Polar International", else "Mercado Pago Colombia") + Meta `Purchase` (with `metaEventId` for dedupe), then `refreshUserProperties()` (so the bumped `paid_pool_count` is reflected). Clears the interval. After `MAX_POLLS`, sets `timeout`. Errors are swallowed.
- **Render:** polling spinner (`success.processing`); confirmed state (green checkmark, `success.title`, `success.confirmed` with capacity, go-to-pool button); timeout state (hourglass, `success.timeout`, go-to-pool button). Inline `@keyframes spin`.

**Exports:** default `PaymentSuccessPage`.

**Key dependencies:** `getPaymentStatus` (`@/lib/api/payments`), `trackPurchase` (`@/lib/ecommerce`), `trackMetaEvent` (`@/lib/metaPixel`), `refreshUserProperties` (`@/lib/authAnalytics`), theme/brand, next-intl `payment`.

**Flags:** `trackPurchase` receives `price: result.amountUsd` even when `currency` is COP — per CLAUDE.md the `amountUsd` field is USD cents and the COP value should come from `mpPurchaseValue`; here the upgrade `price` carries `amountUsd` regardless of currency, which (for COP transactions) may report the wrong value to analytics. Worth verifying against the backend `getPaymentStatus` contract (the field may already be currency-normalized server-side; flagged medium-confidence).

---

### frontend-next/src/app/[locale]/pago/layout.tsx

**Purpose:** Layout for the `/pago/*` payment return routes. Marks them noindex and force-dynamic.

**What it does:** Exports static `metadata` with `robots: { index: false, follow: false }` and `export const dynamic = "force-dynamic"`. The comment explains these pages read query params via `useSearchParams()` in client components, aren't SEO targets, and must be dynamic to avoid the `[locale]` layout trying to statically prerender them (which surfaced "useSearchParams should be wrapped in suspense" errors). The component just returns `children`.

**Exports:** `metadata`, `dynamic`, default `PaymentLayout`.

**Key dependencies:** `next` Metadata type only.

**Flags:** none.

---

### frontend-next/src/app/[locale]/penca-futbol/page.tsx

**Purpose:** Spanish-only regional-term SEO article for "penca de fútbol" (Uruguay/regional synonym for a football pool).

**What it does:**
- `generateMetadata`: ES-only — calls `notFound()` if `locale !== "es"`; builds metadata from `seo.pencaFutbol.*` with `path: { es: "/penca-futbol" }`, `availableLocales: ["es"]`, article type + timestamps.
- `relatedLinks`: 8 internal cross-links (world cup, quiniela, how-it-works, faq, polla, prode, porra, and the EN football-pool page).
- `PencaFutbolPage` (default): ES-only guard; reads `penca` namespace; builds an `Article` JSON-LD (headline/subtitle, publish/modified dates, OG image, org author/publisher with logo, `mainEntityOfPage`); renders `Breadcrumbs`, `JsonLd`, and `<RegionalArticlePage namespace="penca" relatedLinks={relatedLinks} />` (the shared regional-article body component).

**Exports:** `generateMetadata`, default `PencaFutbolPage`.

**Key dependencies:** `RegionalArticlePage` (`@/components/RegionalArticlePage`), `Breadcrumbs`, `JsonLd`, `SITE_URL`, `buildPageMetadata`.

**Flags:** `getLocale` imported but unused.

---

### frontend-next/src/app/[locale]/polla-futbolera/page.tsx

**Purpose:** Spanish-only regional-term SEO article for "polla futbolera" (Colombian synonym for a football pool).

**What it does:** Structurally identical to `penca-futbol/page.tsx`. ES-only `notFound()` guard in both `generateMetadata` and the page. Metadata from `seo.pollaFutbolera.*`, path `/polla-futbolera`. `relatedLinks` (8: world cup, quiniela, how-it-works, faq, prode, penca, porra, EN football-pool). Page reads the `polla` namespace, emits an `Article` JSON-LD, `Breadcrumbs`, and `<RegionalArticlePage namespace="polla" …/>`.

**Exports:** `generateMetadata`, default `PollaFutboleraPage`.

**Key dependencies:** same as penca.

**Flags:** `getLocale` imported but unused. The four regional pages (penca/polla/porra/prode) are near-identical boilerplate differing only in namespace, slug, SEO keys, and `relatedLinks` ordering — strong duplication candidate (could be a single parameterized factory), though each must remain a distinct route file for App Router.

---

### frontend-next/src/app/[locale]/porra-deportiva/page.tsx

**Purpose:** Spanish-only regional-term SEO article for "porra deportiva" (Spain synonym for a sports pool).

**What it does:** Same template as penca/polla. Metadata from `seo.porraDeportiva.*`, path `/porra-deportiva`, ES-only. `relatedLinks` (8). Page reads `porra` namespace; `Article` JSON-LD; `Breadcrumbs`; `<RegionalArticlePage namespace="porra" …/>`.

**Exports:** `generateMetadata`, default `PorraDeportivaPage`.

**Key dependencies:** same as penca.

**Flags:** `getLocale` imported but unused; duplication with the other regional pages (see polla entry).

---

### frontend-next/src/app/[locale]/precios/page.tsx

**Purpose:** Server entry for the pricing page (`/precios` / `/pricing` / `/precos`). Provides metadata, breadcrumbs, JSON-LD, and delegates the body to the client `PricingPageContent`.

**What it does:**
- `generateMetadata`: `seo.pricing.*`, per-locale path map.
- `PreciosPage` (default): reads `legal` namespace for breadcrumb labels; builds the per-locale breadcrumb path; defines a `WebApplication` JSON-LD with a free `Offer` (price 0 COP, "Free for pools up to 20 participants"). Renders `Breadcrumbs`, `JsonLd`, and `<PricingPageContent />`.

**Exports:** `generateMetadata`, default `PreciosPage`.

**Key dependencies:** `./PricingPageContent`, `Breadcrumbs`, `JsonLd`, `SITE_URL`, `buildPageMetadata`.

**Flags:** `getLocale` imported but unused.

---

### frontend-next/src/app/[locale]/precios/PricingPageContent.tsx

**Purpose:** Client body of the pricing page — renders personal and corporate pool capacity tiers with COP prices, included features, savings/free badges, and fires the pricing-catalog ecommerce analytics.

**What it does:** Client component.
- `FeatureCheck({ label, highlight })`: a checkmark + label row (highlighted variant for corporate-only features).
- `PricingPageContent` (named export): uses `pricingPage` (`t`) and `landing` (`f`) namespaces. Computes `personalTiers = getPersonalTiers(300)` and `corporateTiers = getCorporateTiers(300)` from `@/lib/pricing`.
  - **Analytics effect:** builds GA4 `view_item_list` items by mapping non-free personal tiers (from `PERSONAL_FREE_LIMIT` → `tier.maxParticipants`, COP) and non-base corporate tiers (from `CORPORATE_FREE_LIMIT`) via `buildUpgradeItem`, then `trackViewItemList({ listId: "pricing_page", … })` and Meta `ViewContent`.
  - `baseFeatures` (7, from `landing.pricing.features.*`) and `corporateExtraFeatures` (5, from `landing.pricing.corporateFeatures.*`).
  - **Render:** back-to-home `Link`, title/subtitle; Personal section (green features panel + tier rows with free/savings badges, `formatCOP` prices, "free forever" note for the free tier); Corporate section (indigo features panel including the highlighted corporate extras + tier rows; the base tier shows `CORPORATE_BASE_PRICE` struck-through next to `$0` with a "trial" badge and `trialDesc`); a CTA box linking to `/login`; and a refund-policy link to `/reembolsos`.

**Exports:** named `PricingPageContent`.

**Key dependencies:** `@/lib/pricing` (`getPersonalTiers`, `getCorporateTiers`, `formatCOP`, `CORPORATE_FREE_LIMIT`, `CORPORATE_BASE_PRICE`, `PERSONAL_FREE_LIMIT`), `@/lib/ecommerce` (`trackViewItemList`, `buildUpgradeItem`), `trackMetaEvent` (`@/lib/metaPixel`), `Link` (`@/i18n/navigation`), `PublicPageWrapper`, `colors`.

**Flags:** `getPersonalTiers(300)`/`getCorporateTiers(300)` use a magic literal `300` (presumably a sample/base participant count) with no named constant or comment — minor magic-number smell. Prices are COP-only on this page (no USD/locale-aware currency switch), so EN/PT visitors still see COP — possibly intentional but worth noting.

---

### frontend-next/src/app/[locale]/privacidad/page.tsx

**Purpose:** Server entry for the privacy policy page (`/privacidad` / `/privacy` / `/privacidade`). Metadata + breadcrumbs, delegates body to client `PrivacidadContent`.

**What it does:** `generateMetadata` from `seo.privacy.*` with per-locale paths. `PrivacidadPage` (default): reads `legal` namespace for breadcrumb labels, builds the per-locale breadcrumb path, renders `Breadcrumbs` and `<PrivacidadContent />`. No JSON-LD (legal page).

**Exports:** `generateMetadata`, default `PrivacidadPage`.

**Key dependencies:** `./PrivacidadContent`, `Breadcrumbs`, `SITE_URL`, `buildPageMetadata`.

**Flags:** `getLocale` imported but unused.

---

### frontend-next/src/app/[locale]/privacidad/PrivacidadContent.tsx

**Purpose:** Client body of the privacy page — renders the localized privacy policy markdown (`legal.privacyContent`) as styled HTML.

**What it does:** Client component using the `legal` namespace. Reads the full policy text from `t("privacyContent")`, passes it through `parseMarkdown` (`@/lib/parseMarkdown`), and injects the result via `dangerouslySetInnerHTML` inside an `<article>` card. Includes a back-to-home `Link` and a large inline `<style>` block scoping typography for the article's headings, paragraphs, lists, tables, links, `hr`, and `strong` (theming via CSS custom properties like `var(--text)`, `var(--surface-2)`).

**Exports:** named `PrivacidadContent`.

**Key dependencies:** `parseMarkdown` (`@/lib/parseMarkdown`), `Link` (`@/i18n/navigation`), `PublicPageWrapper`, next-intl `legal`.

**Flags:** Uses `dangerouslySetInnerHTML` on translation-sourced markdown — safe insofar as the content is first-party (translation files), and parsing goes through the project's `parseMarkdown`; not user input. One hardcoded color `#2563eb` for article links (rest use CSS vars) — minor inconsistency.

---

### frontend-next/src/app/[locale]/prode-deportivo/page.tsx

**Purpose:** Spanish-only regional-term SEO article for "prode deportivo" (Argentina synonym for a sports prediction pool).

**What it does:** Same template as penca/polla/porra. Metadata from `seo.prodeDeportivo.*`, path `/prode-deportivo`, ES-only with `notFound()` guards in both functions. `relatedLinks` (8: world cup, quiniela, how-it-works, faq, polla, penca, porra, EN football-pool). Page reads `prode` namespace; emits `Article` JSON-LD; `Breadcrumbs`; `<RegionalArticlePage namespace="prode" …/>`.

**Exports:** `generateMetadata`, default `ProdeDeportivoPage`.

**Key dependencies:** same as the other regional pages.

**Flags:** `getLocale` imported but unused; duplication with the other three regional pages (see polla entry).
