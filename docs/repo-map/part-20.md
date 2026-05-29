## Batch 20

This batch covers 14 frontend React components (`frontend-next/src/components/`): the Estratega knockout pick card, the marketing landing page (client + SSR fallback), the language selector, the first-login locale-preference gate/modal, the Meta Pixel page-view tracker, the mobile leaderboard, the global NavBar, the 404 page, two notification primitives (badge + banner), pagination controls, and the password-strength indicator.

### frontend-next/src/components/KnockoutMatchCard.tsx

**Purpose:** Renders a single knockout (eliminatoria) match card in "Estratega" pools. Players pick who advances; hosts can override the official winner. The component never lets a host enter a score — official winners are scraper-derived.

**What it does:**
- Header comment documents the source-of-truth pipeline: `liveScoresJob` writes `PoolMatchResult` (goals + penalties), backend `autoPublishStructuralResults` derives the winner (penalty fallback) and merges `{matchId, winnerId}` into `StructuralPhaseResult.matches[]`. The only host action is "Sobrescribir ganador" (override), available only when a winner is already published and the phase isn't locked; the override requires a reason and emails every member.
- `KnockoutMatchCard` component takes `poolId/phaseId/matchId`, `homeTeam/awayTeam`, `kickoffUtc` (currently unused — `void _kickoffUtc`), `token`, `isHost`, `isLocked`, optional `existingResult` (score + penalties from `PoolMatchResult.currentVersion`), `publishedWinnerId`, `existingPick`, and `onResultSaved/onPickSaved` callbacks.
- State split into: player-pick state (`selectedWinner`, `pickSaved`, `savingPick`), host-override state (`isOverriding`, `overrideWinnerId`, `overrideReason`, `savingOverride`), and UI state (`error`, `successMessage`). A `successTimerRef` auto-clears success toasts; cleaned up on unmount.
- `useEffect`s resync local state when `existingPick` / `publishedWinnerId` props change.
- Derived values: `publishedTeam` (resolves the published winner id to a team object), `wentToPenalties` (true when goals tied and both penalty fields present).
- `handleSavePick`: validates a winner is chosen, calls `upsertStructuralPick(token, poolId, phaseId, { matches: [{matchId, winnerId}] })`, marks saved, shows a 2s success toast, fires `onPickSaved`.
- `handleEnterOverride` / `handleCancelOverride`: open/close the override editor, resetting `overrideWinnerId` to the published winner and clearing the reason.
- `handleSaveOverride`: validates winner + non-empty reason, calls `publishKnockoutMatchWinner(token, poolId, phaseId, matchId, { winnerId, reason })`, shows a 3s success toast, fires `onResultSaved`. Defensive error handling: if the API returns `REASON_REQUIRED_FOR_OVERRIDE` (constant defined locally) it surfaces the reason-required message.
- Render: two-column grid (single column on mobile). LEFT = player prediction with two `TeamPickButton`s plus Save/Edit buttons (hidden when locked). RIGHT = "Resultado oficial" with three states — (1) the host override editor (amber-styled, shows an extra red warning when `isLocked` because overriding a locked/advanced phase re-runs `autoPublishStructuralResults`), (2) the published result (score, optional penalty line, winner badge, and an override button for the host that stays available even when locked), or (3) a "pending scraper result" placeholder. Error/success banners render at the bottom.
- `TeamPickButton` sub-component: a selectable team button using `getTeamName(team, tTeams)`, with a check icon and an "advances" badge when selected.

**Exports:** `KnockoutMatchCard` (named). `TeamPickButton` is module-private.

**Key dependencies:** `@/lib/theme` (colors), `next-intl` (`useTranslations` for `pool` + `teams`), `../lib/api` (`upsertStructuralPick`, `publishKnockoutMatchWinner`), `../lib/apiError` (`isApiError`), `../hooks/useIsMobile` (`useIsMobile`, `TOUCH_TARGET`, `mobileInteractiveStyles`), and `getTeamName` from the pool page `poolHelpers`.

**Flags:** `kickoffUtc` prop is accepted but explicitly discarded (`void _kickoffUtc`) — dead/reserved prop. Otherwise clean.

### frontend-next/src/components/LandingContent.tsx

**Purpose:** The interactive (client) marketing landing page rendered at the site root, World-Cup-2026 themed with a live countdown, pricing cards, tournament catalog, and CTAs that open the in-page auth panel.

**What it does:**
- `LandingContent` client component. Reads `landing` translations, current `locale`, and `WORLD_CUP_FOCUS` from `siteConfig` — `useWorldCupCopy = WORLD_CUP_FOCUS && locale === "es"` toggles World-Cup-specific copy/links. Uses `useIsMobile`, `useAuthPanel` (openAuthPanel), `usePoolTerm` (regional pool-term params for i18n interpolation), and `useSearchParams`.
- Countdown: `WORLD_CUP_KICKOFF` constant (2026-06-11T18:00:00Z); `calcTimeLeft` computes days/hours/minutes/seconds; a 1s `setInterval` updates `timeLeft`; `countdownReady` gates rendering "--" until the client computes the real value (avoids hydration mismatch).
- `getPaymentCountry()` effect sets `isColombia` to switch COP/USD pricing badges.
- Redirect effect: if `?redirect=` is present (arriving from `/login`), auto-opens the login auth panel with that redirect target.
- Sections rendered: (1) Hero — title/subtitle/CTAs (register button fires `trackEvent("cta_clicked")` + `trackMetaEvent("Lead")` then `openAuthPanel("register")`; secondary link goes to `/mundial-2026` or `/como-funciona`), plus a World Cup trophy image with glow and gold-gradient label and the live countdown grid. (2) "What is Picks4All?" SEO section with rich-text paragraphs and a prominent "how to play" CTA to `/como-se-juega`. (3) Features grid of 8 `FeatureCard`s. (4) "How it works" with three `StepCard`s and a link to `/como-funciona`. (5) Pricing — three cards (Personal Free, Personal Pro, Corporate) using `FeatureCheck` rows; the Corporate card has a floating trial sticker and links to `/empresas`; a "see all plans" link to `/precios`. (6) Tournaments — maps `TOURNAMENT_CATALOG` into `TournamentCard`s (active vs coming-soon). (7) Final CTA banner with a register button.
- Sub-components: `FeatureCard` (icon/title/description), `StepCard` (numbered circle), `FeatureCheck` (checkmark + label, optional highlight), `TournamentCard` (emoji, name, description, coming-soon badge, register CTA when active).

**Exports:** `LandingContent` (named). Sub-components are module-private.

**Key dependencies:** `next/navigation`, `next-intl`, `next/image`, `@/i18n/navigation` (Link), `useIsMobile`, `AuthPanelContext`, `PoolTermContext`, `tournamentCatalog`, `theme`, `brand`, `analytics` (`trackEvent`), `metaPixel` (`trackMetaEvent`), `api/payments` (`getPaymentCountry`), `siteConfig` (`WORLD_CUP_FOCUS`).

**Flags:** `TournamentCard` has a no-op ternary `background: active ? "var(--surface)" : "var(--surface)"` (both branches identical) — minor dead styling. Otherwise clean.

### frontend-next/src/components/LandingContentSSR.tsx

**Purpose:** Server-rendered, SEO-critical fallback for the landing page. Renders all headings/copy/cards server-side (via `getTranslations`) so crawlers and no-JS visitors see content before the client `LandingContent` hydrates and replaces it.

**What it does:**
- Async server component `LandingContentSSR({ locale })`. Uses `getTranslations("landing")` from `next-intl/server`. `useWorldCupCopy` mirrors the client logic. Pool-term placeholders are computed with `getPoolTermParams(locale, DEFAULT_REGION)` since crawlers have no IP geolocation.
- Renders the same section structure as the client version but desktop-only styling, no `isMobile` branches, no client hooks, no live timer. The countdown renders static "--" placeholders so crawlers still index the Días/Horas/Minutos/Segundos labels.
- CTAs render as `Link href="/login"` anchors (the client version swaps these for the in-page auth panel on hydration) so no-JS visitors still have working links.
- Sections: Hero, What-is, Features (mapped from an inline 8-item array), How-it-works (3 inline steps), Pricing (three `PricingCard`s — note the Corporate card is hardcoded to `priceCop` and the Personal Pro badge to `badgeCop`, see Flags), Tournaments (mapped from `TOURNAMENT_CATALOG`), Final CTA (link to `/login`).
- `PricingCard` sub-component: presentational card with title, optional badge, optional price, subtitle, and a feature `<ul>` of checkmarks; `highlight` styles the border.

**Exports:** `LandingContentSSR` (named, async). `PricingCard` is module-private.

**Key dependencies:** `next-intl/server` (`getTranslations`), `@/i18n/navigation`, `tournamentCatalog`, `poolTerms` (`DEFAULT_REGION`, `getPoolTermParams`), `theme`, `brand`, `siteConfig`.

**Flags:** Because this is server-rendered with no IP geo, the SSR pricing always shows COP variants (`pricing.personalPro.badgeCop`, `pricing.corporate.priceCop`) regardless of locale/region — intentional for the static skeleton but worth noting it can briefly show COP to international users before hydration. Not dead code.

### frontend-next/src/components/LanguageSelector.tsx

**Purpose:** Dropdown language switcher (ES/EN/PT) with inline SVG flags, usable in dark (navbar) or light contexts. Performs a full-navigation locale switch that works on any route including dynamic ones.

**What it does:**
- Inline SVG flag components `FlagSpain`, `FlagUSA`, `FlagBrazil`. `localeConfig` array maps each `Locale` to its flag renderer and short label.
- `LanguageSelector({ variant })`: reads current locale, manages `open` (dropdown) and `isPending` state, and closes on outside-click via a `mousedown` listener bound only while open.
- `switchLocale(next)`: no-ops if same locale; fires `trackEvent("language_changed", {from, to})`. Strips the existing locale prefix from `window.location.pathname`, translates localized pathnames via `routing.pathnames` (e.g. `/terminos` → `/terms`), builds the new path (default `es` gets no prefix per `localePrefix: "as-needed"`), writes the `NEXT_LOCALE` cookie so middleware won't redirect back, then does a full `window.location.href` navigation (preserving query string) through the middleware for proper i18n setup.
- Render: a trigger button showing the current flag + label + a rotating caret, and an accessible `listbox` dropdown (`role="option"`, `aria-selected`) with hover styling and a check mark on the active locale. Inline `@keyframes fadeInDown` animation.

**Exports:** `LanguageSelector` (named).

**Key dependencies:** `next-intl` (`useLocale`, `useTranslations("language")`), `@/i18n/routing` (`routing`, `Locale`), `@/lib/theme`, `@/lib/analytics` (`trackEvent`).

**Flags:** none.

### frontend-next/src/components/LocalePreferenceGate.tsx

**Purpose:** Cheap wrapper mounted in the authenticated layout that conditionally renders `LocalePreferenceModal` when the logged-in user has not yet completed the first-login language prompt.

**What it does:**
- On mount, reads the auth token (`getToken`); if absent, no-ops. Otherwise fetches `getUserProfile(token)` once; if `user.needsLocalePrompt` is true it captures `user.country` and flips `needsPrompt` so the modal renders. Failures (network/expired token) are silently swallowed so a transient hiccup never blocks the app. Uses a `cancelled` flag for cleanup.
- Renders `null` when no prompt is needed; otherwise renders `<LocalePreferenceModal initialCountry={...} />`.

**Exports:** `LocalePreferenceGate` (named).

**Key dependencies:** `../lib/api/user` (`getUserProfile`), `../lib/auth` (`getToken`), `./LocalePreferenceModal`.

**Flags:** none.

### frontend-next/src/components/LocalePreferenceModal.tsx

**Purpose:** Blocking, non-dismissible first-login modal that captures the user's preferred communication language (drives `User.locale` for emails + UI locale). Optional country and "my language isn't listed" demand-capture inputs.

**What it does:**
- Type `SupportedLocale = "es"|"en"|"pt"`. `LOCALE_OPTIONS` array (value/native name/flag emoji). `COPY` object holds all labels in all three locales simultaneously (the user can't read the URL-detected locale yet). `Trilingual` sub-component stacks the three language lines for a given copy slot.
- `LocalePreferenceModal({ initialCountry, onComplete })`: state for `locale` (default `es`), `country`, the "other language" accordion (`showOther`, `otherSearch`, `requestedLocale`), `submitting`, `error`, and `detected`.
- Effects: best-effort `detectCountry()` to prefill the country when `initialCountry` wasn't passed; an Escape-key blocker (capture phase) — deliberately does NOT block the back button (would be hostile; the modal re-appears next load because `needsLocalePrompt` stays true server-side).
- `filteredLanguages` memo filters the `LANGUAGES` data set by code/es/en/pt name against `otherSearch`.
- `handleSubmit`: calls `setLocalePreference({ locale, country, requestedLocale })`. If `onComplete` is provided, delegates to it; otherwise the default behaviour mirrors `LanguageSelector.switchLocale` — sets the `NEXT_LOCALE` cookie and full-navigates to the chosen-locale URL prefix. Errors are surfaced and re-enable the form.
- Render: full-screen fixed overlay (zIndex 999999) with a centered form — brand isotipo, trilingual title/subtitle, language radio group, optional country `<select>` (marks the detected country with a check), a dashed "other language" accordion with search + select, an error box, and the submit button (no close/escape/click-outside path).

**Exports:** `LocalePreferenceModal` (named). `Trilingual` is module-private.

**Key dependencies:** `../lib/api/user` (`setLocalePreference`, `detectCountry`), `../data/languages` (`LANGUAGES`, `COUNTRIES`), `../hooks/useIsMobile`, `@/lib/theme`.

**Flags:** Relates to ADR-063 (welcome email deferred to this modal's completion). Uses a raw `<img>` for the brand isotipo instead of `next/image` (minor). Otherwise clean.

### frontend-next/src/components/MetaPixelPageView.tsx

**Purpose:** Client component that fires a Meta Pixel `PageView` event on client-side route changes (App Router doesn't re-fire the initial pixel load on SPA navigations), gated on cookie consent.

**What it does:**
- Tracks `pathname` via `usePathname` and a `prev` ref. On change (and only when the pathname actually differs from the previous), checks `localStorage[p4a_cookie_consent] === "granted"` and, if so, calls `trackMetaEvent("PageView")`. Renders `null`.

**Exports:** `MetaPixelPageView` (named).

**Key dependencies:** `next/navigation` (`usePathname`), `@/lib/metaPixel` (`trackMetaEvent`). Couples to the `p4a_cookie_consent` localStorage key written by the cookie-consent banner.

**Flags:** none.

### frontend-next/src/components/MobileLeaderboard.tsx

**Purpose:** Mobile-optimized leaderboard (card-per-player) for pool standings, supporting structural (Estratega) stats and per-phase point breakdowns, with an optional pinned current-user row.

**What it does:**
- Types: `LeaderboardStructuralStats` (positions correct/total, perfect groups, winners-by-phase), `LeaderboardRow` (user, role, status, points, rank, pointsByPhase, structuralStats), and `PhaseType` (`STRUCTURAL_GROUP | STRUCTURAL_KNOCKOUT | SCORE`).
- `MobileLeaderboard` props: `rows`, `phases`, `onPlayerClick(userId, displayName, initialPhase?)`, `formatPhaseName/formatPhaseFullName` formatters, optional `pinnedRow`/`pinnedLabel`, `phaseTypeByPhaseId` map, and `hasAnyStructural` flag. `leaderPoints` = top row's points (for gap math).
- Pinned row: a highlighted gradient card rendered at top when the current user is off-page, showing rank/name/label/points and gap to leader.
- Main list: each row is a clickable/keyboard-accessible card. Top-3 get medal emoji + gradient backgrounds and colored borders. Displays an optional structural-summary line (`leaderboard.structuralSummary`), role badges (HOST 👑, CO_ADMIN ⭐), a "retired" badge for `memberStatus === "LEFT"`, the points number, and the gap-to-leader / "leader" label.
- Phase breakdown: a horizontally scrollable strip of phase chips. Each chip shows phase name + points; for structural phases it appends a counter — `${perfectGroups}★` for STRUCTURAL_GROUP, `${correct}/${total}` for STRUCTURAL_KNOCKOUT (from `winnersByPhase`). Chips are clickable (with `stopPropagation`) to drill into that phase when `showChip` (has points or structural counter present); disabled/dimmed otherwise.
- Empty state and a scroll hint ("← ... →") when more than 3 phases.

**Exports:** `MobileLeaderboard` (named).

**Key dependencies:** `@/lib/theme`, `next-intl` (`useTranslations("pool")`), `../hooks/useIsMobile` (`mobileInteractiveStyles`).

**Flags:** Comment references "Sprint 3" (historical, harmless). Otherwise clean.

### frontend-next/src/components/NavBar.tsx

**Purpose:** Global top navigation bar. Desktop = horizontal nav + user dropdown; mobile (below 1024px / `tabletLg`) = hamburger + slide-in drawer. Loads the user profile, auto-updates timezone, integrates pool-section nav, language selector, feedback modal, admin links, and logout.

**What it does:**
- Constants: `NAVBAR_HEIGHT_MOBILE = 64`, `SCROLL_HIDE_THRESHOLD_PX = 80`, `SCROLL_DELTA_THRESHOLD_PX = 6` (scroll-jitter smoothing).
- State: `showUserMenu`, `showMobileMenu`, `showFeedback`, `profile`, `navHidden`, `lastScrollYRef`. `poolNav` from `usePoolNavSnapshot()` (pool-page sections).
- Effects: load profile on mount; close mobile menu when leaving mobile; scroll-direction-aware auto-hide on mobile (uses `requestAnimationFrame` throttling — hides on scroll-down past threshold, shows on scroll-up, always visible near top); publishes the rendered navbar height as the `--p4a-navbar-h` CSS variable so sticky chrome (e.g. PoolSectionHeader) can stack correctly (0 on desktop or when hidden).
- `loadProfile`: reads token, uses a 5-minute sessionStorage cache (`p4a_profile_cache`), falls back to `getUserProfile`, and triggers `autoUpdateTimezone` when the profile has no timezone.
- `autoUpdateTimezone`: resolves the browser timezone via `Intl.DateTimeFormat`, dynamically imports + calls `updateUserProfile`, then re-fetches the profile.
- `handleLogout`: clears analytics identity (`setAnalyticsUserId(null)`), revokes Meta Pixel consent, fires `apiLogout()` (server cookie clear), clears the token + profile cache, and routes to `/`.
- Render: dark (`#1a1a1a`) nav with left slot (mobile hamburger animated to an X + brand isotipo/logotipo linking home). Desktop nav: links to `/dashboard` (myPools), `/faq`, `/mundial-2026` (worldCup), `/empresas` (enterprises), the `LanguageSelector`, and a user dropdown (profile info; admin-only links to email settings, feedback, analytics, and sales/`/admin/ventas/cotizaciones`; help/report; logout). Mobile: avatar button + a fixed slide-in drawer (rendered as a sibling of `<nav>` so the nav's hide-transform doesn't break the drawer's fixed positioning) containing user info, pool-section nav (`PoolNavItems` when on a pool page), the same global links, admin links, language selector, help/report, and logout. Inline `@keyframes fadeIn`/`slideInLeft`. Renders `FeedbackModal` (type `"BUG"`) when `showFeedback`.

**Exports:** `NavBar` (named).

**Key dependencies:** `next-intl`, `@/i18n/navigation` (Link, useRouter), `@/lib/auth` (token), `@/lib/api` (profile, logout, updateUserProfile), `@/lib/analytics`, `@/lib/metaPixel`, `useIsMobile` (`BREAKPOINTS`, `TOUCH_TARGET`, `mobileInteractiveStyles`), `BrandLogo` (`BrandIsotipo`/`BrandLogotipo`), `LanguageSelector`, `FeedbackModal`, `pool/PoolNav` (`PoolNavItems`, `usePoolNavSnapshot`), `@/lib/theme`.

**Flags:** none.

### frontend-next/src/components/NotFoundContent.tsx

**Purpose:** The 404 page body — brand logo, large "404", localized messages, and links back to home and FAQ.

**What it does:** `NotFoundContent` client component reads `notFound` translations and pool-term params (for `subMessage` interpolation), renders a centered full-height layout with `BrandLogo`, an h1 "404", message + sub-message, and two `Link` buttons (`/` home gradient button, `/faq` outlined button).

**Exports:** `NotFoundContent` (named).

**Key dependencies:** `next-intl`, `@/i18n/navigation`, `@/components/BrandLogo`, `@/lib/theme`, `PoolTermContext` (`usePoolTerm`).

**Flags:** Uses `minHeight: "100vh"` (acceptable for height, not width). Otherwise clean.

### frontend-next/src/components/NotificationBadge.tsx

**Purpose:** Small numeric notification badge (capped at "99+"), plus a wrapper that positions a floating badge over arbitrary children.

**What it does:**
- `NotificationBadge({ count, pulse, size, variant })`: returns `null` when `count === 0`. `size` (`small`/`medium`) controls dimensions/font. `variant` toggles `floating` (absolute, pokes out top-right — parent must be relative without overflow:hidden) vs `inline` (static flex item for clipped containers like rounded sidebars). Brand-colored pill with accessible `role="status"` label, optional `pulse` animation, capped display at "99+".
- `BadgeWrapper({ children, badge })`: wraps children in a relative inline-flex span and renders a floating `NotificationBadge` when `badge.count > 0`.

**Exports:** `NotificationBadge`, `BadgeWrapper` (both named).

**Key dependencies:** `@/lib/theme`.

**Flags:** Comment references "Sprint 3" (historical). The `pulse` animation depends on a `@keyframes pulse` defined elsewhere (global). Otherwise clean.

### frontend-next/src/components/NotificationBanner.tsx

**Purpose:** Light blue informational banner listing pending-action items (icon + message) inside a tab.

**What it does:** `NotificationBanner({ items })` returns `null` when empty; otherwise renders a blue-bordered box with one icon+message row per item (keyed by index).

**Exports:** `NotificationBanner` (named).

**Key dependencies:** none (pure styling; receives already-translated messages from the caller).

**Flags:** none.

### frontend-next/src/components/PaginationControls.tsx

**Purpose:** Reusable prev/next pagination control with a "page X of Y" label, hidden when there's only one page.

**What it does:** `PaginationControls({ page, totalPages, onPrev, onNext, isMobile })` returns `null` when `totalPages <= 1`. `btnStyle(disabled)` builds the button styling (mobile gets a touch-target min-height). Renders a centered prev button (disabled at `page === 0`), the localized `pagination.page` label (1-indexed), and a next button (disabled at `page >= totalPages - 1`). Page is 0-indexed in props.

**Exports:** `PaginationControls` (named).

**Key dependencies:** `next-intl` (`useTranslations("pool")`), `@/lib/theme`, `useIsMobile` (`TOUCH_TARGET`, `mobileInteractiveStyles`).

**Flags:** none.

### frontend-next/src/components/PasswordStrengthIndicator.tsx

**Purpose:** Inline checklist of password rules (min 8 chars, an uppercase letter, a number) shown live as the user types in signup/reset forms.

**What it does:** `PasswordStrengthIndicator({ password })` (default export) reads `auth` translations, computes three rules (`length >= 8`, `/[A-Z]/`, `/[0-9]/`), and returns `null` when the password is empty. Renders one row per rule with a ✓/✗ glyph and a success/muted color.

**Exports:** default export `PasswordStrengthIndicator`.

**Key dependencies:** `next-intl` (`useTranslations("auth")`).

**Flags:** The rule thresholds (8, uppercase, number) are hardcoded here and may need to stay in sync with the backend `passwordRules.ts` — potential duplicated validation logic, but acceptable as a client-side UX hint. Default export is inconsistent with the named-export convention of the rest of the batch (minor).
