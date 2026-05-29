## Batch 18

This batch covers 17 frontend components under `frontend-next/src/components/`: the admin sales document UI (quotes + cuentas de cobro), admin email/scores settings, beta feedback admin viewer, analytics health dashboard, attribution/auth analytics plumbing, the auth guard + slide-in auth panel, brand logo helpers, breadcrumb JSON-LD, the pricing capacity selector, and the cookie-consent banner.

---

### frontend-next/src/components/AdminCcDetailContent.tsx

**Purpose:** Admin detail view for a single "cuenta de cobro" (AccountReceivable — the pre-paid invoice document in the sales/ADR-061 flow), with actions to mark it paid or cancel it and to download its PDF.

**What it does:**
- Client component `AdminCcDetailContent({ ccId })`. On mount, an effect calls `getAccountReceivable(token, ccId)` (token from `getToken()`), with a `cancelled` flag guarding against unmounted-state updates. Distinguishes HTTP 403 → `accessDenied` screen, 404 → "no encontrada", other → generic error.
- `handleMarkPaid()`: shows a `window.confirm` warning (only for out-of-platform payments), calls `markAccountReceivablePaid`, then refetches to pick up `paidAtUtc`/`updatedAtUtc`. `handleCancel()`: confirms, calls `cancelAccountReceivable`, and optimistically sets local status to `CANCELLED` (soft-revoke — consistent with the never-delete sales invariant). Both gate on an `action` state ("paying"/"cancelling") to disable buttons.
- Render: `AdminSalesHeader` with `active="ccs"`, a back link to the listing, the consecutive number + status pill, a highlighted redemption-code block (formatted XXXX-XXXX via `formatRedemptionCode`), a "Descargar PDF" anchor (`accountReceivablePdfUrl(cc.id)`, opens in a new tab), and conditional Mark-paid / Cancel buttons (enabled only when status is `PENDING` or `REDEEMED`).
- Detail sections rendered via local helpers `DetailSection` (titled card) and `KV` (label/value grid, optional `multiline`/`valueWeight`): Cliente, Cobro (capacity, currency, total via `formatAmount`, amount in words, concept, tournament), Documento (locale, term, issue/valid dates, linked quote id), optional Notas internas, and Trazabilidad (created/redeemed/paid timestamps in `es-CO`, associated poolPaymentId).
- `formatAmount(cc)` selects COP (`amountCop`) or USD (`amountUsdCents / 100`) and formats via `formatPrice`. `statusMeta` maps each `AccountReceivableStatus` to badge colors + Spanish label.

**Exports:** default `AdminCcDetailContent`. Local-only helpers `DetailSection`, `KV`, `formatAmount`, `formatRedemptionCode`, `statusMeta`.

**Key dependencies:** `@/i18n/navigation` (`Link`, `useRouter`), `@/lib/auth` (`getToken`), `@/lib/api` (account-receivable CRUD + types), `@/lib/pricing` (`formatPrice`), `@/hooks/useIsMobile`, `@/lib/theme`, sibling `AdminSalesHeader`.

**Flags:** `useRouter` is imported and destructured but never used (dead import/variable). The currency-amount and `statusMeta` logic is duplicated near-verbatim in `AdminCcsListContent.tsx` (and the quote variants) — candidate for extraction.

---

### frontend-next/src/components/AdminCcsListContent.tsx

**Purpose:** Admin paginated/filterable list of cuentas de cobro, with a button to create a new one.

**What it does:**
- Client component `AdminCcsListContent()`. State: `data` (`ListAccountReceivablesResponse`), loading/error/`accessDenied`, plus filters `clientEmail`, `statusFilter`, and `page`. An effect re-fetches via `listAccountReceivables(token, { clientEmail, status, page, limit: PAGE_LIMIT })` whenever filters/page change (PAGE_LIMIT = 25), with cancelled-flag guard and 403 → access-denied handling.
- Render: `AdminSalesHeader active="ccs"`, a filter row (email text input, status `<select>` with all five statuses, and a "+ Nueva cuenta de cobro" button routing to `/admin/ventas/cuentas-de-cobro/nueva`). Both filter changes reset page to 0.
- Empty state when no items. Mobile renders a stacked list of `Link` cards (consecutive, status badge, legal name, email, capacity, formatted total); desktop renders a clickable `<table>` whose rows `router.push` to the detail route `[id]`.
- Pagination footer when `totalPages > 1` (Anterior/Siguiente, page indicator).
- Local helpers: `formatCurrency` (COP/USD selection), `StatusBadge` (pill component), and style constants `thStyle`, `tdStyle`, `paginationBtn`.

**Exports:** default `AdminCcsListContent`.

**Key dependencies:** `@/i18n/navigation`, `@/lib/auth`, `@/lib/api` (`listAccountReceivables` + types), `@/lib/pricing`, `@/hooks/useIsMobile`, `@/lib/theme`, `AdminSalesHeader`.

**Flags:** `formatCurrency` and `StatusBadge` duplicate the equivalents in `AdminCcDetailContent` and the quote list/detail components. Otherwise clean.

---

### frontend-next/src/components/AdminEmailSettingsContent.tsx

**Purpose:** Admin settings page combining three concerns: platform-wide email notification toggles, the live-scores service on/off switch, and a manual fixture-tracking job trigger.

**What it does:**
- Locally redeclares `PlatformEmailSettings` (the four boolean toggles: welcome, deadline reminder, result published, pool completed) with a comment that it's done to avoid a Vite type-export bug. `EMAIL_TOGGLES` is a static array of `{ key, label, description }` describing each toggle in Spanish.
- `AdminEmailSettingsContent()`: state for `settings`, loading/saving/error/success, a `successTimerRef` (cleared on unmount), `metadata` (`updatedAt` + `updatedBy`), `accessDenied`, plus scores state (`scoresEnabled`, `scoresLoading`, `scoresSaving`) and `trackingTriggering`.
- `fetchSettings` (useCallback) calls `getAdminEmailSettings(token)`; on 401 redirects to `/` (token already cleared by api layer), 403 → access denied, else error. The mount effect calls it and separately `fetch`es `/admin/settings/scores` (passing the token via a `Cookie: p4a_token=...` header + `credentials: "include"`) to seed `scoresEnabled`.
- `handleScoresToggle`: optimistic flip, `PUT /admin/settings/scores`, reconciles with server response, transient success message; reverts on failure.
- `handleTriggerTracking`: `POST /admin/jobs/trigger-fixture-tracking`, shows success/error; disabled unless scores are enabled.
- `handleToggle(key)`: optimistic update of one email toggle, `updateAdminEmailSettings(token, { [key]: newValue })`, transient success, then refetch to refresh `metadata`; reverts on error.
- Render: loading and access-denied early returns; otherwise a back-to-dashboard affordance, header, error/success alerts, the email-toggles card (custom CSS switch built from a hidden checkbox + sliding knob) with last-updated metadata, the scores-service card (toggle + "ACTIVO" badge + manual trigger button), and an informational card noting Password Reset is always on and linking to the Resend dashboard. Styles are inline objects; colors come from `@/lib/theme`'s `colors`.

**Exports:** default `AdminEmailSettingsContent`.

**Key dependencies:** `next/navigation` `useRouter`, `@/lib/auth` `getToken`, `@/lib/api` (`getAdminEmailSettings`, `updateAdminEmailSettings`), `@/lib/theme` `colors`, and raw `fetch` against `NEXT_PUBLIC_API_URL` for scores/jobs endpoints.

**Flags:** Uses `any` in catch clauses (`err: any`) — acceptable at the API boundary but not strictly narrowed. The scores/job calls bypass the typed `@/lib/api` client and hand-roll `fetch` with a `Cookie` header (sending the JWT via a `Cookie:` request header from the browser is unusual; browsers normally don't let JS set `Cookie`, so this header is likely ignored and auth actually rides on `credentials: "include"`). No hard dead code.

---

### frontend-next/src/components/AdminFeedbackContent.tsx

**Purpose:** Admin viewer for beta feedback submissions (bugs/suggestions), with filtering, pagination, JSON export, expandable cards, and screenshot preview.

**What it does:**
- `AdminFeedbackContent()`: state for `data` (`AdminFeedbackResponse`), loading/error/`accessDenied`, filters (`filterType` BUG/SUGGESTION, `filterContact` wantsContact), `page`, `expandedId`, and `imageModal`. `fetchData` calls `getAdminFeedback(token, { type, wantsContact, page, limit: 25 })`; effect re-runs on filter/page change. 403 → access-denied screen.
- `handleDownload`: serializes `data.feedbacks` to a JSON blob and triggers a client download named `feedback-YYYY-MM-DD.json`.
- Render: header with total count and a back link to `/admin/settings/email`, a filter row (two selects) + Download JSON button, error/loading/empty states, a list of `FeedbackCard`s, pagination, and a full-screen image modal (renders base64 PNG, click to dismiss).
- `FeedbackCard`: collapsible card with a colored left border (red for BUG, green for suggestion), a type badge, message preview, indicators for attached image (📷) / wants-contact (📞), localized date (`es-CO`), and an expand chevron. Expanded view shows the full message, the screenshot (click opens modal via `onImageClick`), and a metadata grid via `MetaField` (user email/id, current URL, contact name+phone when wantsContact, truncated user agent).
- `MetaField`: small label/value block with optional `highlight` styling. `paginationBtn` is a shared style object.

**Exports:** default `AdminFeedbackContent`. Local `FeedbackCard`, `MetaField`.

**Key dependencies:** `@/i18n/navigation` `Link`, `@/lib/auth`, `@/lib/api` (`getAdminFeedback` + `BetaFeedbackItem`/`AdminFeedbackResponse` types), `@/hooks/useIsMobile`, `@/lib/theme` `colors`.

**Flags:** `err: any` in catch. Renders user-supplied `item.message`/`currentUrl`/`userAgent` as text (React-escaped, so safe) and base64 images inline. The "← Panel Admin" link points at `/admin/settings/email` as the de-facto admin hub. No dead code.

---

### frontend-next/src/components/AdminQuoteCreateContent.tsx

**Purpose:** Admin form to create a sales Quote (cotización), with a live price preview mirroring backend pricing.

**What it does:**
- `AdminQuoteCreateContent()`: a controlled form with state for client legal name/email, issue/valid dates (defaulting issue to today and valid to +`DEFAULT_VALIDITY_DAYS`=30 via `today()`/`plusDays()` UTC helpers), `locale`, `term`, `participants` (default 50), `currency` (default COP), tournament, investment description, `includeCoverPage` (default true), notes, plus submitting/error.
- `livePreview` (useMemo): when `participants > CORPORATE_FREE_LIMIT`, computes the upgrade amount via `getUpgradePrice("corporate", CORPORATE_FREE_LIMIT, participants)` (COP) or `getUpgradePriceUsd(...)` (USD) and formats it — deliberately mirrors the server's pricing so admins can't be surprised; returns null inside the free tier.
- `changeLocale(next)` resets `term` to `DEFAULT_TERM_FOR_LOCALE[next]` so the submitted term is always valid for the locale.
- `handleSubmit`: blocks if participants ≤ free limit (nothing to quote), requires a token, then calls `createQuote(token, {...})` (trimming/normalizing email, dropping empty optionals to `undefined`) and routes to the new quote's detail page `/admin/ventas/cotizaciones/[id]`.
- Render: `AdminSalesHeader active="quotes"`, back link, and the form grouped into `Section`s — Cliente, Fechas, Localización (locale pill buttons + term `<select>` seeded from `SALE_TERMS[locale]`, with a hint about the `{term}` placeholder), Inversión (participants number with `min = CORPORATE_FREE_LIMIT + 1`, currency pills, the green live-total preview box, optional tournament + investment description), and Presentación (cover-page checkbox, internal notes). Cancel/submit buttons.
- Style helpers: `inputStyle`, `hintStyle`, `previewBoxStyle`, `checkboxRowStyle`, and functions `pillStyle`, `primaryBtnStyle`, `secondaryBtnStyle`, plus layout helpers `Section` and `Field`.

**Exports:** default `AdminQuoteCreateContent`.

**Key dependencies:** `@/i18n/navigation`, `@/lib/auth`, `@/lib/api` (`createQuote`, `SaleCurrency`, `SaleLocale`), `@/lib/saleTerms` (`SALE_TERMS`, `DEFAULT_TERM_FOR_LOCALE`), `@/lib/pricing` (`CORPORATE_FREE_LIMIT`, `formatPrice`, `getUpgradePrice`, `getUpgradePriceUsd`), `@/hooks/useIsMobile`, `@/lib/theme`, `AdminSalesHeader`.

**Flags:** none — pricing is client-previewed only; the server remains the source of truth per ADR-061.

---

### frontend-next/src/components/AdminQuoteDetailContent.tsx

**Purpose:** Admin detail view for a single Quote, with PDF download, "emit cuenta de cobro" conversion link, and cancel action.

**What it does:**
- `AdminQuoteDetailContent({ quoteId })`: mount effect loads `getQuote(token, quoteId)` (cancelled-flag guard; 403 → access denied, 404 → not found). `handleCancel` confirms, calls `cancelQuote`, and optimistically sets local status to `CANCELLED` (soft-revoke).
- Render: `AdminSalesHeader active="quotes"`, back link, consecutive + status pill (`statusMeta` maps ACTIVE/EXPIRED/CANCELLED), an actions row with a PDF download anchor (`quotePdfUrl(quote.id)`) and — only when status is ACTIVE — a "→ Emitir cuenta de cobro" `Link` carrying `query: { fromQuoteId }` into the CC-create route plus a "Cancelar cotización" button.
- Detail sections via local `DetailSection`/`KV`: Cliente, Inversión (participants, currency, total via `formatAmount`, optional tournament + description), Documento (locale, term, cover-page yes/no, issue/valid dates), optional Notas internas, and a created-at footer (`es-CO`).
- `formatAmount` and `statusMeta` mirror the CC component's equivalents.

**Exports:** default `AdminQuoteDetailContent`. Local `DetailSection`, `KV`, `formatAmount`, `statusMeta`.

**Key dependencies:** `@/i18n/navigation`, `@/lib/auth`, `@/lib/api` (`getQuote`, `cancelQuote`, `quotePdfUrl`, `QuoteRow`, `QuoteStatus`), `@/lib/pricing`, `@/hooks/useIsMobile`, `@/lib/theme`, `AdminSalesHeader`.

**Flags:** `useRouter` is imported and destructured but unused (dead variable). `DetailSection`/`KV`/`formatAmount`/`statusMeta` duplicate the CC-detail variants.

---

### frontend-next/src/components/AdminQuotesListContent.tsx

**Purpose:** Admin paginated/filterable list of Quotes with a create button.

**What it does:**
- `AdminQuotesListContent()`: mirrors `AdminCcsListContent` structure. State: `data` (`ListQuotesResponse`), loading/error/access-denied, filters `clientEmail`/`statusFilter`/`page`. Effect refetches `listQuotes(token, {...})` (PAGE_LIMIT 25) on filter/page change.
- Render: `AdminSalesHeader active="quotes"`, filter row (email input, status select ACTIVE/EXPIRED/CANCELLED, "+ Nueva cotización" → `/admin/ventas/cotizaciones/nueva`), empty state, mobile card list / desktop clickable table (rows → `[id]` detail), pagination footer.
- Local `formatCurrency`, `StatusBadge`, `thStyle`/`tdStyle`/`paginationBtn`.

**Exports:** default `AdminQuotesListContent`.

**Key dependencies:** `@/i18n/navigation`, `@/lib/auth`, `@/lib/api` (`listQuotes` + types), `@/lib/pricing`, `@/hooks/useIsMobile`, `@/lib/theme`, `AdminSalesHeader`.

**Flags:** Near-duplicate of `AdminCcsListContent` (formatCurrency, StatusBadge, table/card scaffolding, pagination). One error box uses hardcoded `#fee2e2`/`#991b1b` instead of the `var(--danger-*)` tokens the CC list uses — minor inconsistency.

---

### frontend-next/src/components/AdminSalesHeader.tsx

**Purpose:** Shared header/tab bar for the admin sales section, linking between Cotizaciones and Cuentas de cobro.

**What it does:** `AdminSalesHeader({ active, isMobile })` renders a "← Panel Admin" link (to `/admin/settings/email`), the "Gestión de Ventas" title, and two tab `Link`s — Cotizaciones (`/admin/ventas/cotizaciones`) and Cuentas de cobro (`/admin/ventas/cuentas-de-cobro`) — where the `active` one gets a brand-colored bottom border. `tabStyle(isActive)` produces the per-tab style; the tab strip is horizontally scrollable.

**Exports:** default `AdminSalesHeader`. Props type `{ active: "quotes" | "ccs"; isMobile: boolean }`.

**Key dependencies:** `@/i18n/navigation` `Link`, `@/lib/theme`.

**Flags:** none.

---

### frontend-next/src/components/AnalyticsHealthContent.tsx

**Purpose:** Admin-only analytics health dashboard. Runs a server probe of GA4 / Meta CAPI / DLQ / frontend HTML, inspects this browser's GTM/Consent-Mode state client-side, and can emit a real $0.01 probe purchase to verify end-to-end delivery.

**What it does:**
- Types: `CheckResult` (status `ok|error|not_configured` + message + details), `ProbeResponse` (overall verdict, timestamp, `checks` for ga4/metaCapi/dlqBacklog/frontendHtml, and `envVars`), and `ClientGtmStatus`.
- `useClientGtmStatus()`: a hook with a 1.5s polling interval that inspects the live DOM/window — finds the `gtm-loader` script tag, extracts the `GTM-…` id, checks `window.dataLayer` exists/length, checks `window.google_tag_manager` is populated (proves `gtm.js` actually ran past CSP/ad-block), and walks the dataLayer to surface the latest Consent Mode `analytics_storage`/`ad_storage` values and count `event`/`config` pushes.
- `STATUS_COLORS`/`STATUS_LABELS`, `StatusBadge`, `CheckCard` (title + badge + message + collapsible JSON `details`).
- `AnalyticsHealthContent()`: `runProbe` (useCallback) `GET /admin/analytics/probe` with `Authorization: Bearer <token>`, storing the flattened response. `sendRealPurchase` POSTs `/admin/analytics/probe/send-real-purchase` with `{ allowReal: true, transactionId: probe_<ts> }` and reports the transaction id to check in GA4 Realtime / Meta Test Events. Renders: re-run + send-purchase buttons, status messages, the client-side GTM grid (green/red per signal, with hints like "denied — GA4 NO recibe hits"), server-side check cards, and a backend env-var presence grid (`set`/`MISSING`).

**Exports:** default `AnalyticsHealthContent`.

**Key dependencies:** `@/lib/auth` `getToken`, `@/lib/brand` `BRAND`, raw `fetch` against `NEXT_PUBLIC_API_URL`, and the live `window.dataLayer`/`google_tag_manager` globals.

**Flags:** none — diagnostic tooling; the "real purchase" button is intentionally a manual operator action behind admin auth.

---

### frontend-next/src/components/AttributionCapture.tsx

**Purpose:** Fire-and-forget attribution capture, mounted from the root layout, that records first-touch UTM/click-id/referrer data for the signup flow.

**What it does:** `AttributionCapture()` runs `captureAttribution()` once on mount via `useEffect` and renders `null`. First-touch semantics and sessionStorage persistence live inside `@/lib/attribution`.

**Exports:** named `AttributionCapture`.

**Key dependencies:** `@/lib/attribution` `captureAttribution`.

**Flags:** none.

---

### frontend-next/src/components/AuthAnalyticsSync.tsx

**Purpose:** Cross-tab analytics identity flush — when the user logs out in one tab, unbind the analytics user id and revoke Meta Pixel consent in all other tabs to prevent cross-user attribution on shared devices.

**What it does:** `AuthAnalyticsSync()` attaches a `storage` event listener; when the changed key equals `AUTH_LOGOUT_BROADCAST_KEY` (written by `clearToken()` since cookies don't emit storage events), it calls `setAnalyticsUserId(null)` and `revokeMetaPixelConsent()`. Cleans up the listener on unmount. Renders `null`.

**Exports:** named `AuthAnalyticsSync` (returns `null`).

**Key dependencies:** `@/lib/auth` (`AUTH_LOGOUT_BROADCAST_KEY`), `@/lib/analytics` (`setAnalyticsUserId`), `@/lib/metaPixel` (`revokeMetaPixelConsent`).

**Flags:** none.

---

### frontend-next/src/components/AuthGuard.tsx

**Purpose:** Client-side route guard that redirects unauthenticated users to login (preserving the intended destination) and shows a loading state while auth resolves.

**What it does:** `AuthGuard({ children })` uses `useAuth()` for `isAuthenticated`/`isLoading`. An effect, once loading is done and the user is unauthenticated, `router.replace`s to `/login?redirect=<current path + query>` (URL-encoded, built from `usePathname()` + `useSearchParams()`). While loading it renders a full-height centered loading message (`t("loading")` from the `nav` namespace); if still unauthenticated it renders `null`; otherwise renders `children`.

**Exports:** named `AuthGuard`.

**Key dependencies:** `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`), `next-intl` `useTranslations`, sibling `../hooks/useAuth`.

**Flags:** Uses `next/navigation` directly (not the locale-aware `@/i18n/navigation`), so the `/login` redirect is built without a locale prefix — relies on `proxy.ts`/next-intl middleware to attach the locale.

---

### frontend-next/src/components/AuthSlidePanel.tsx

**Purpose:** Slide-in authentication panel (login/register tabs) with Google Sign-In, email/password flows, GDPR consent checkboxes, password-strength feedback, and analytics/Meta event tracking.

**What it does:**
- `AuthSlidePanel({ isOpen, onClose, onLoggedIn, initialMode })`. Augments the global `Window` type with the Google Identity Services `google.accounts.id` API.
- Mode state (`login`/`register`) syncs to `initialMode` when opened. A `beginRegistrationFiredRef` ensures the `begin_registration` analytics event fires only once per panel-open when the register form first appears (not on tab toggles). Effects: Escape-to-close (suppressed while the Google consent modal is open), body-scroll lock while open, and a full field reset when the panel closes.
- Google flow: an effect (re-running on `isOpen`/`mode`) polls up to 100×100ms for `window.google`, then `initialize`s with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `renderButton` into a ref; sets `googleLoadFailed` if it never loads. `handleGoogleCallback` calls `loginWithGoogle(credential, timezone)`, sets the token, accepts analytics consent, binds the analytics user, fires `login`/Meta events, and `onLoggedIn`. If the backend signals `requiresConsent`/`CONSENT_REQUIRED`/`AGE_VERIFICATION_REQUIRED`, it stashes the credential and opens the consent modal. `handleGoogleConsentSubmit` re-validates terms/privacy/age, re-calls `loginWithGoogle` with a `RegisterConsentOptions` payload, and fires `sign_up` + Meta `CompleteRegistration`.
- Email flow `onSubmit`: validates (email present, password present; in register mode: email confirmation match, username ≥3 chars, display name required, password ≥8 with uppercase+digit, and terms/privacy/age accepted). Calls `register(...)` or `login(...)`, sets token, `acceptAnalyticsConsent()`, binds analytics user, fires the appropriate `sign_up`/`login` + Meta events. Maps `GOOGLE_ACCOUNT_NO_PASSWORD` to a "use Google" message.
- UI: backdrop + right-side slide panel (full width on mobile), header with title + close button, login/register tab buttons, the Google button + load-failure notice + divider, the email/password form (with confirm-email field, username with `pattern`, display name, password with `PasswordStrengthIndicator` in register mode, forgot-password link in login mode), the `ConsentCheckboxes` sub-component (terms/privacy/age required + optional marketing, used both inline and `inModal`), submit button, error box, a link to the full `/login` page, and a footer with terms/privacy links. A separate Google consent modal repeats the checkboxes and gates submit on the three required boxes.

**Exports:** named `AuthSlidePanel`. Props interface `AuthSlidePanelProps`.

**Key dependencies:** `next-intl` (`useTranslations`, `useLocale`), `@/lib/api` (`login`, `register`, `loginWithGoogle`, `RegisterConsentOptions`), `@/lib/analytics` `trackEvent`, `@/lib/metaPixel` `trackMetaEvent`, `@/lib/authAnalytics` `bindAuthenticatedUserForAnalytics`, `@/components/CookieConsent` `acceptAnalyticsConsent`, `@/lib/auth` `setToken`, `@/i18n/navigation` `Link`, `@/hooks/useIsMobile` (`TOUCH_TARGET`, `mobileInteractiveStyles`), `@/lib/theme`, sibling `PasswordStrengthIndicator`.

**Flags:** Heavy use of `any` (Google SDK `config`/`response`, catch clauses) — partly justified at the external-SDK boundary but the catch handlers are not narrowed. Client-side password validation is intentionally duplicated against the server but uses inline literals (8/uppercase/digit) rather than `@/lib/validation` constants. The forgot-password `Link` points at `/forgot-password` while the full-page link points at `/login` — both fixed routes.

---

### frontend-next/src/components/BrandLogo.tsx

**Purpose:** Brand image components that render the official Picks4All isotipo (square "P") and logotipo (horizontal wordmark) from `/public/brand/`.

**What it does:**
- `BrandIsotipo({ size=32, variant="degradado", className, borderRadius, priority=false })`: picks the best raster size (32/180/320/500) for the requested pixel size, uses `.png` for the gradient variant and `.svg` otherwise, builds the `/brand/isotipo-<variant>-<fileSize>.<ext>` src, and renders a `next/image` with a default ~22% rounded radius. Variants: `degradado`, `transparente-blanca`, `transparente-degradado`.
- `BrandLogotipo({ height=40, variant="blanco", className, priority=false })`: picks a source size (40/80/120), builds `/brand/logotipo-<variant>-<fileSize>.svg`, and approximates width as 3.2× height so `next/image` reserves space (avoids CLS). Variants `blanco` (dark bg) / `degradado` (light bg).
- `BrandLogo({ size=28, priority=false })`: legacy alias rendering the gradient `BrandIsotipo`, kept for backward compatibility.

**Exports:** named `BrandIsotipo`, `BrandLogotipo`, `BrandLogo`.

**Key dependencies:** `next/image`; static assets under `/public/brand/`.

**Flags:** `BrandLogo` is explicitly a legacy backward-compat alias — keep until callers migrate to `BrandIsotipo`.

---

### frontend-next/src/components/Breadcrumbs.tsx

**Purpose:** Emit a schema.org `BreadcrumbList` JSON-LD block for SEO.

**What it does:** `Breadcrumbs({ items })` maps `{ name, url }[]` into ordered `ListItem` entries (1-based `position`) and renders them through the `JsonLd` component. No visible UI.

**Exports:** named `Breadcrumbs`. Interface `BreadcrumbItem` is local.

**Key dependencies:** sibling `./JsonLd`.

**Flags:** none.

---

### frontend-next/src/components/CapacitySelector.tsx

**Purpose:** Reusable pricing/capacity picker for the pool-creation and expansion flows — renders tiered pricing (personal vs corporate, COP/USD), a custom-count input for >300, and gates paid tiers behind admin permission.

**What it does:**
- `CapacitySelector({ type, selectedCapacity, onSelect, currentCapacity, mode, allowPaidTiers=true, currency="COP" })`.
- `tiers` (useMemo): selects the right tier generator (`getPersonalTiers(Usd)` / `getCorporateTiers(Usd)`), generating up to 300 (or, in expansion mode, `max(300, currentCapacity+250)`). In expansion mode it filters to tiers larger than `currentCapacity` and subtracts the current tier's price (via `getTierForCustomCount(Usd)`) so prices shown are the incremental upgrade cost.
- Custom-count handling: parses `customInput`; `customTier` (useMemo) returns the sentinel `"FREE_COVERS"` (≤ free limit), `"IN_LIST"` (≤300, already shown), or a computed `PricingTier` (via `getTierForCustomCount(Usd)`) for >300.
- Render: localized title/description (`pricing` namespace); a green info banner that differs for personal-free vs corporate-trial creation; the tier list where each tier is a clickable/keyboard-accessible `role="button"` row with a radio indicator, "up to N" label, savings badge, and price (or FREE / corporate-free-trial pill). Paid tiers are locked when `!allowPaidTiers` (overlay with a lock + "Coming Soon"); unlocked paid tiers show a "paid tier" hint. The custom-input card shows context-sensitive feedback for the three `customTier` outcomes, including a result card with offered capacity, price, savings, an explanatory reason (rounded up by `INCREMENT`), and a select button.

**Exports:** default `CapacitySelector`. Props type `CapacitySelectorProps`.

**Key dependencies:** `next-intl` `useTranslations`, `@/lib/pricing` (tier generators, `getTierForCustomCount(Usd)`, `formatPrice`, `PERSONAL_FREE_LIMIT`, `CORPORATE_FREE_LIMIT`, `INCREMENT`, types), `@/lib/theme` `colors`.

**Flags:** A few hardcoded hex colors and the literal `300`/`50` thresholds and the magic `currentCapacity + 250` expansion ceiling appear inline rather than as named constants (mild deviation from the no-magic-numbers standard). The string sentinels `"FREE_COVERS"`/`"IN_LIST"` mixed with `PricingTier` objects require the `as PricingTier` casts seen in the JSX. Otherwise consistent with the dynamic-pricing source of truth.

---

### frontend-next/src/components/CookieConsent.tsx

**Purpose:** GDPR cookie-consent banner that drives Google Consent Mode v2 and Meta Pixel initialization, with cross-tab sync, DNT handling, authenticated auto-accept, and a re-open hook for the footer.

**What it does:**
- Module-level: `CONSENT_KEY = "p4a_cookie_consent"`, custom DOM event `p4a:consent:reopen`, and `openCookieConsent()` (dispatches that event so any surface — e.g. the Footer — can re-open the banner, satisfying GDPR's revocability requirement).
- Helpers: `getStoredConsent()`/`persistConsent()` (localStorage, try/catch for private mode), `applyConsent(consent)` (calls `updateConsent` for Consent Mode v2; on `granted` initializes the Meta Pixel and fires `PageView`, on denied calls `revokeMetaPixelConsent` since Meta doesn't honor Consent Mode), and exported `acceptAnalyticsConsent()` (auto-grants for authenticated users, since registration ToS disclose analytics).
- `CookieConsent()` component: a `visible` state. One effect wires cross-tab sync (a `storage` listener re-applies a remote consent change and hides the banner) and the `reopen` listener (clears stored consent + shows banner). A second mount effect decides initial visibility: re-apply a stored choice if present; else auto-grant if a session token exists; else honor `navigator.doNotTrack === "1"` by persisting denied; else show the banner (default state stays the inline-script's `denied`). `handleAccept`/`handleReject` persist + apply + hide.
- UI: a bottom-anchored card (full-width bottom sheet on mobile) with a benefit headline, the legal message + privacy `Link`, a prominent brand-gradient Accept button, and a muted underlined Reject link. Inline comments document the deliberate (non-dark-pattern) visual hierarchy. All strings from the `cookieConsent` i18n namespace.

**Exports:** named `CookieConsent`, `openCookieConsent`, `acceptAnalyticsConsent`. Type `ConsentState` is local.

**Key dependencies:** `next-intl` `useTranslations`, `@/i18n/navigation` `Link`, `@/lib/theme`, `@/hooks/useIsMobile`, `@/lib/auth` `getToken`, `@/lib/metaPixel` (`initMetaPixel`, `trackMetaEvent`, `revokeMetaPixelConsent`), `@/lib/analytics` (`updateConsent`, `ConsentValue`).

**Flags:** none — clean; pairs with `AuthSlidePanel` (which calls `acceptAnalyticsConsent`) and `AuthAnalyticsSync` (logout flush).
