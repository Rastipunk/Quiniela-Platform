## Batch 22

### frontend-next/src/components/pool-wizard/WizardSubStep.tsx

**Purpose:** A reusable presentational section block for pool-wizard steps, used to break a single wizard step into clearly numbered sub-stages (e.g. name → logo → colors → message) so the flow reads like a checklist instead of a flat wall of labels.

**What it does:**
- Defines a `Props` interface: `number` (badge index), `title`, optional `subtitle`, `isFirst` (skip top divider/padding for the first sub-step in a step), `requiredMark` (renders a red asterisk after the title), `optionalLabel` (renders a small muted "optional" pill next to the title), and `children`.
- `WizardSubStep` component: calls `useIsMobile()` and computes `badgeSize` (28 on mobile, 32 desktop) and a `contentIndent` (`badgeSize + spacing.md`) so the subtitle and body align with the title text, not the badge.
- Renders a `<section>` with conditional top padding/border/margin (only when not `isFirst`, using `colors.borderLight` and responsive spacing tokens).
- A `<header>` with a brand-gradient circular badge (`colors.brandGradient`, white text) showing `number`, followed by an `<h3>` title. The title row optionally appends a red `*` (when `requiredMark`) and a lowercase pill (when `optionalLabel`).
- An optional subtitle `<p>` indented to `contentIndent`, then a `<div>` wrapping `children`.

**Exports:** Named export `WizardSubStep` (React component). No default export.

**Key dependencies:** `@/lib/theme` (colors, spacing, fontSize, fontWeight, radii), `@/hooks/useIsMobile`.

**Flags:** none.

---

### frontend-next/src/components/pool/branding-previews/HeaderPreview.tsx

**Purpose:** A live miniature mock of the corporate pool header band shown to a host while editing branding, mirroring the production header (`headerBg`/`headerBorderBottom`/`headerLogoBg`) rendered in `pools/[poolId]/page.tsx` so the preview matches the real surface 1:1.

**What it does:**
- `Props`: `primary`, `secondary` (brand colors), `companyName`, `logoBase64`, `poolNameSample`, `byCompanyLabel` (translated "by {company}" line), `badgeLabel` (small uppercase tag).
- `HeaderPreview` component: resolves brand colors via `resolveBrandColors(primary || null, secondary || null)`; derives `previewName` (trimmed company name or fallback "Acme Corp").
- Renders an `aria-hidden` band with a 135deg gradient built from the resolved primary/secondary at `33` (20%) alpha and a 3px bottom border in the resolved primary.
- Left: if `logoBase64` is present, renders an `<img>`; otherwise renders a gradient placeholder square showing the company's first initial.
- Center: pool name (ellipsis-truncated) plus the `byCompanyLabel` line colored in resolved primary.
- Right: the uppercase `badgeLabel` tag.
- Pure presentational — all labels passed in by parent so it can live outside the i18n provider tree.

**Exports:** Named export `HeaderPreview`.

**Key dependencies:** `@/lib/theme`, `@/lib/brandColors` (`resolveBrandColors`).

**Flags:** none.

---

### frontend-next/src/components/pool/branding-previews/InvitationEmailPreview.tsx

**Purpose:** A compact mock of the corporate invitation email body, mirroring the backend `getCorporateActivationTemplate` (in `backend/src/lib/emailTemplates.ts`) so the host sees in the wizard/branding panel what their team will actually receive.

**What it does:**
- Declares `Props`: `primary`, `secondary`, `companyName`, `logoBase64`, `invitationMessage`, `previewLabel`, and `previewLocale` (`"es" | "en" | "pt"`, defaulting to "es" per the comment). The locale here is the host's `Organization.invitationLocale` (what the EMPLOYEE receives), NOT the UI locale.
- `LocaleStrings` interface and `PREVIEW_STRINGS` dictionary: hardcoded per-locale strings (`subjectLine`, `greeting`, `bodyAfterCompany`, `ctaLabel`) for es/en/pt. A prominent comment warns these must be kept in sync manually with the backend template — there is no shared source of truth across the backend/frontend boundary.
- `InvitationEmailPreview` component: picks `t = PREVIEW_STRINGS[previewLocale]`; resolves brand colors; computes `heroGradient` and `ctaGradient` (custom gradients when `brand.isCustom`, otherwise indigo/violet defaults); `previewName` fallback "Acme Corp"; `showsMessage` flag based on trimmed `invitationMessage`.
- Renders an uppercase `previewLabel`, then an `aria-hidden` email card: a hero (gradient bg, logo or initial placeholder, company name, `subjectLine`), and a body (greeting, `<strong>company</strong>` + `bodyAfterCompany`, a violet quote box showing the custom invitation message or a fallback, attributed to the company, and a gradient CTA pill with `ctaLabel`).

**Exports:** Named export `InvitationEmailPreview`.

**Key dependencies:** `@/lib/theme`, `@/lib/brandColors` (`resolveBrandColors`).

**Flags:** The `PREVIEW_STRINGS` dictionary is a deliberate cross-boundary duplication of the backend email copy; the in-file comment flags this as a known sync hazard (no shared source of truth). Medium-confidence maintenance risk, not dead code.

---

### frontend-next/src/components/pool/branding-previews/WelcomeSplashPreview.tsx

**Purpose:** A compact mock of the corporate welcome splash shown on `pools/[poolId]/page.tsx` when an employee first opens the pool; updates live as the host edits brand colors/message/logo.

**What it does:**
- `Props`: `primary`, `secondary`, `companyName`, `logoBase64`, `welcomeMessage`, `welcomePlaceholder` (italic placeholder when message empty), `previewLabel`, `badgeLabel`, `ctaLabel`.
- `WelcomeSplashPreview` component: resolves brand colors; computes `splashBg` (custom 160deg gradient when `brand.isCustom`, else a deep-indigo default gradient — comment notes it keeps the user's colors verbatim to match the picker, relying on the contrast warning elsewhere); `previewName` fallback; `messageBody` = welcomeMessage or placeholder.
- Renders an uppercase `previewLabel`, then an `aria-hidden` dark splash card: logo or initial placeholder, company name, a translucent pill `badgeLabel`, a quote box with the welcome message (dimmed when using placeholder), and a light gradient CTA pill whose text color is `darken(brand.primary, 0.2)`.

**Exports:** Named export `WelcomeSplashPreview`.

**Key dependencies:** `@/lib/theme`, `@/lib/brandColors` (`resolveBrandColors`, `darken`).

**Flags:** none.

---

### frontend-next/src/components/pool/PoolNav.tsx

**Purpose:** The single source of truth for the pool's section navigation. Provides the tab list, the navigation renderer used by both the desktop sidebar and the global navbar's mobile drawer, and a layout-level context store that lets the navbar (which lives above the pool page in the tree) render the pool's own sections.

**What it does:**
- **Types & item config:** Exports `PoolNavTab` union (`partidos`, `leaderboard`, `resumen`, `reglas`, `jugadores`, `capacidad`, `personalizacion`, `admin`). `VALID_TABS` set for URL validation. `NavItem` interface (key/icon/labelKey). Three item arrays: `PLAYER_ITEMS` (matches, leaderboard, summary, rules), `HOST_ITEMS` (players, capacity, admin), and the standalone `BRANDING_ITEM` (`personalizacion`, corporate-only). `ALL_ITEMS` combines all.
- `getPoolNavMeta(tab)`: returns `{ icon, labelKey }` for a tab (falls back to first item) — shared so drawer/sidebar/section header stay in sync.
- `insertBeforeAdmin(items, newItem)`: inserts an item right before the `admin` entry (defensively appends if `admin` is absent) so Personalización sits next to capacity.
- **Cross-tree state:** `PoolNavSnapshot` interface (`showHostItems`, `showBrandingTab` [corporate-only gate], `tabBadges`, `hasUrgent`). `PoolNavStore` + `PoolNavContext`. `PoolNavRootProvider` holds snapshot state in the layout. `usePoolNavSnapshot()` reads it (null outside pools). `usePublishPoolNav(snapshot)`: the pool page publishes its snapshot; uses a ref + a stringified `signature` in the effect deps (deliberately NOT the snapshot object or `ctx`) — a documented fix because including `ctx` created a feedback loop that froze all click handlers in production; clears the snapshot on unmount.
- **Shared renderer `PoolNavItems`:** Props include `showHostItems`, `showBrandingTab`, `tabBadges`, `hasUrgent`, optional `onAfterSelect` (e.g. close drawer), and a `variant` (`light`/`dark`, dark for the navbar drawer). Reads the active tab from the `?tab=` search param (validated against `VALID_TABS`, defaulting to `partidos`). `handleSelect` fires `trackEvent("tab_changed")`, mutates the `tab` query param via relative `router.replace` (deletes the param for `partidos` to keep the canonical URL clean) preserving path + locale prefix, then calls `onAfterSelect`. Computes variant-aware colors. `renderItem` renders each tab button with active accent/border, icon, label, and a `NotificationBadge` (pulsing for `partidos` when `hasUrgent`). `renderGroupLabel` renders uppercase group headers. The `<nav>` renders the player group always, and the host group (with branding inserted via `insertBeforeAdmin` when `showBrandingTab`) only when `showHostItems`.

**Exports:** `PoolNavTab` (type), `getPoolNavMeta`, `PoolNavSnapshot` (interface), `PoolNavRootProvider`, `usePoolNavSnapshot`, `usePublishPoolNav`, `PoolNavItems`.

**Key dependencies:** next-intl (`useTranslations` on `pool` namespace), `next/navigation` (`useRouter`, `useSearchParams`), `@/hooks/useIsMobile` (TOUCH_TARGET, mobileInteractiveStyles), `@/lib/theme`, `@/components/NotificationBadge`, `@/lib/analytics` (trackEvent).

**Flags:** none. (The feedback-loop guard in `usePublishPoolNav` is intentional and documented.)

---

### frontend-next/src/components/PoolConfigWizard.tsx

**Purpose:** A modal wizard for configuring a pool's pick-types/scoring before creation. Lets the host pick a scoring preset (CUMULATIVE/BASIC/SIMPLE) or build a CUSTOM per-phase configuration, then emits the resolved config to the parent.

**What it does:**
- Header comments mark it as part of "Sprint 2 — Advanced Pick Types System" and "Sprint 3 — Mobile UX Improvements".
- `PoolConfigWizard` main component (props: `instanceId`, `token`, `onComplete`, `onCancel`): manages `wizardState` (`currentStep`: PRESET_SELECTION/PHASE_CONFIG/SUMMARY, `selectedPreset`, `configuration`, `currentPhaseIndex`), plus `instancePhases`, `loading`, `error`.
  - On mount, `loadPhases()` calls `getInstancePhases(token, instanceId)` to fetch the instance's real phases.
  - `handlePresetSelected(preset)`: for CUSTOM, generates a default per-phase config (EXACT_SCORE enabled at 20 pts, others disabled) and goes to PHASE_CONFIG; for any preset, jumps straight to SUMMARY.
  - `handleBack()`: navigates back through the steps depending on whether CUSTOM was chosen.
  - `handleComplete()`: for CUSTOM emits `wizardState.configuration`; for presets emits the full resolved config from `getPresetConfig(...)` — explicitly NOT just the preset key (the comment notes a bare key would resolve to hardcoded phaseIds on the backend).
  - `getPresetConfig(presetKey)`: builds a `PhasePickConfig[]` from the real instance phases per preset: CUMULATIVE (cumulative scoring with GOAL_DIFFERENCE, MATCH_OUTCOME_90MIN, HOME_GOALS, AWAY_GOALS enabled, knockout phases worth more), BASIC (EXACT_SCORE only, points grow `20 + index*10` per phase), SIMPLE (no scores — structural GROUP_STANDINGS with per-position points + perfect-group bonus, or KNOCKOUT_WINNER with pointsPerCorrectAdvance).
  - Renders loading and error overlays, then a fixed-position modal (bottom-sheet on mobile) with a fixed header (step subtitles), scrollable body switching between `PresetSelectionStep`, `PhaseConfigStep` (imported), and `SummaryStep`, and a fixed footer with cancel/back/confirm buttons.
- `PresetSelectionStep`: renders four preset cards (CUMULATIVE marked recommended) via `PresetCard`, with emoji map and i18n titles/descriptions (short vs full per mobile).
- `PresetCard`: clickable/keyboard-accessible card with hover effects and a "recommended" ribbon.
- `SummaryStep`: shows a summary header, the chosen config (`PresetSummary` or `CustomConfigSummary`), a player-facing `RulesPreview`, and an "important" confirmation note. (`onComplete` is destructured but voided here — the footer's confirm button drives completion.)
- `PresetSummary`: shows the preset badge + localized description.
- `CustomConfigSummary`: lists each configured phase with its enabled pick types and points (uses `formatPhaseFullName` and dynamic `pool` namespace keys).
- `RulesPreview`: renders the per-phase scoring rules as the players will see them.

**Exports:** Named export `PoolConfigWizard`. (Step/summary components are module-private.)

**Key dependencies:** next-intl (`dashboard` + `pool` namespaces), `./PhaseConfigStep`, `../lib/api` (`getInstancePhases`, `InstancePhase`), `../hooks/useIsMobile`, `poolHelpers.formatPhaseFullName`, `../types/pickConfig` types, `@/lib/theme`.

**Flags:** Hardcoded scoring point values in `getPresetConfig` (20, 10, 15, etc.) are inline magic numbers without named constants — mild tension with CLAUDE.md §2 "zero magic numbers", though they are preset defaults. Note this is the older modal `PoolConfigWizard`; the canonical creation flow per CLAUDE.md is `components/pool-wizard/PoolCreationWizard.tsx`, so this component may be a legacy/secondary surface — verify consumers before assuming it is live.

---

### frontend-next/src/components/PoolInviteCodeManager.tsx

**Purpose:** Host-side UI for generating and managing shareable invite codes/links, surfaced inside the Jugadores tab of corporate pools. Wraps the pool-agnostic `POST /pools/:poolId/invites` endpoint.

**What it does:**
- **Module constants (per CLAUDE.md "no magic numbers"):** `EXPIRY_PRESETS_HOURS` (1, 6, 24, 168, 720), `EXPIRY_DEFAULT_HOURS` (720), `HOURS_PER_DAY`, `MS_PER_HOUR`, `COPIED_FLASH_MS` (2000), and custom-expiry bounds (`EXPIRY_CUSTOM_MIN_HOURS` 1, `EXPIRY_CUSTOM_MAX_DAYS` 365 → `EXPIRY_CUSTOM_MAX_HOURS`).
- Types `ExpiryMode` (`preset`/`custom`) and `CustomErrorKey`.
- `PoolInviteCodeManager` (props: `poolId`, `token`, `isMobile`, `maxParticipants`, `currentMembers`, `organizationName`): `organizationName` is voided/reserved for a future header.
  - State: invite list + loading/error; form state (`showForm`, `formMaxUses`, `expiryMode`, `presetHours`, `customDays`, `customHours`, `customError`); transient UI (`busy`, `copiedId`, `actionError`).
  - `remainingSlots` memo: `max(1, maxParticipants - currentMembers)` (defaults to 1 when capacity is unlimited).
  - Effect keeps `formMaxUses` synced to `remainingSlots` while the form is closed.
  - `reload()`: fetches invites via `getPoolInvites`.
  - `effectiveHours` memo + `computeExpiresAtUtc()` (now + hours → ISO) + `previewExpiresAt` (formatted via `formatMatchDateTime`).
  - `validateCustom()`: enforces integer/non-negative inputs and min/max hour bounds, returning a `CustomErrorKey`.
  - `handleCreate()`: validates custom mode, calls `createInvite(token, poolId, { maxUses, expiresAtUtc })`, resets form, reloads.
  - `handleRevoke(invite)`: confirm dialog, `deletePoolInvite`, reload.
  - `shareUrlFor(code)`: builds `${origin}/invite?code=...`.
  - `handleCopy(invite)`: writes share URL to clipboard with a 2s "copied" flash.
  - Renders: a purple-gradient container with title/subtitle; a warning disclaimer block (5 bullets, including a `disclaimerBullet2` showing `current/max` capacity and a `disclaimerBullet3` linking to the admin tab); an inline error bar; the active-codes list (each row shows the code, expired/exhausted badges, uses + expiry, and Copy/Share/Revoke actions, with `ShareButtons` context `poolInvite`); a "Generate" button that toggles an inline form with maxUses input, expiry preset chips + a custom days/hours mode, a live expiry preview, and submit/cancel buttons.

**Exports:** Named export `PoolInviteCodeManager`.

**Key dependencies:** next-intl (`pool.admin.codeInvites` namespace, `useLocale`), `@/i18n/navigation` (`Link`), `@/lib/api` (`createInvite`, `getPoolInvites`, `deletePoolInvite`, `PoolInviteRow`), `@/components/ShareButtons`, `@/lib/theme`, `@/lib/timezone` (`formatMatchDateTime`). References specs `CORPORATE_INVITES_AUDIT.md` and `CORPORATE_INVITES_IMPLEMENTATION.md`.

**Flags:** `_organizationName` prop is accepted and intentionally voided ("reserved for future header with company name") — a currently-unused prop. The clipboard failure path sets `actionError("Clipboard")` with a raw literal string instead of a translated key (minor i18n gap). `EXPIRY_CUSTOM_MIN_HOURS` is declared but its only use is inside `validateCustom`; fine.

---

### frontend-next/src/components/PredictionSubscribeButton.tsx

**Purpose:** A CTA card/button to subscribe or unsubscribe from AI prediction-update notifications (World Cup context). Opens login for anonymous users; toggles the subscription in one click for logged-in users.

**What it does:**
- Reads `API_URL` from `NEXT_PUBLIC_API_URL`.
- `PredictionSubscribeButton`: state for `isLoggedIn`, `isSubscribed`, `loading`, `toggling`, `justSubscribed`.
  - On mount: reads the JWT via `getToken()`; if none, stops loading (anonymous). Otherwise sets logged-in and fetches `GET /me` to read `predictionUpdates` and seed `isSubscribed`.
  - `handleToggle()`: if no token, redirects to a locale-aware `/login?redirect=<currentPath>` (prefixes `/en` or `/pt`; comment notes a prior bug sent EN/PT users to the Spanish login). If logged in, `PUT /me/prediction-subscription` with `{ enabled: !isSubscribed }`; on success updates state, fires `trackEvent("notification_subscription_toggled", ...)`, and ONLY on opt-in fires `trackMetaCustomEvent("PredictionSubscribed", ...)` and a 4s `justSubscribed` confirmation flag. Failures fail silently.
  - Renders `null` while `loading`. Otherwise a bordered card (border color shifts to success green when subscribed), an emoji, localized title/description (active vs inactive variants), the toggle button (label varies: unsubscribe / activate / createAccount), a transient "confirmed" message, and an "account required" note for anonymous users.

**Exports:** Named export `PredictionSubscribeButton`.

**Key dependencies:** next-intl (`worldCup` namespace, `useLocale`), `@/lib/auth` (`getToken`), `@/lib/analytics` (`trackEvent`), `@/lib/metaPixel` (`trackMetaCustomEvent`), `@/lib/theme`, `@/lib/brand` (`BRAND`). Hits backend `/me` and `/me/prediction-subscription`.

**Flags:** Uses raw `fetch` against `NEXT_PUBLIC_API_URL` and a comment-labeled "Lead"-style Meta event rather than the centralized `lib/api/client.ts`; minor deviation from the API-client convention but functional.

---

### frontend-next/src/components/PublicNavbar.tsx

**Purpose:** The top navigation bar for unauthenticated/public pages, with a desktop link row plus a mobile hamburger drawer, language selector, and a login CTA.

**What it does:**
- `PublicNavbar` (prop: optional `onOpenAuth` callback): `useIsMobile()` and a `showMobileMenu` state.
- `navLinks` array: Home, World Cup (`/mundial-2026`), How it works (`/como-funciona`), Pricing (`/precios`), FAQ, "What is a quiniela" (`/que-es-una-quiniela`), Enterprises (`/empresas`) — all labels via the `nav` i18n namespace.
- `isActive(path)` compares against the current `usePathname()` (from `@/i18n/navigation`, locale-aware).
- Renders a dark `<nav>` with the brand logo (`BrandIsotipo` + `BrandLogotipo`) linking home.
- Desktop (`!isMobile`): the link row with active-state styling, the `LanguageSelector`, and a white "login" button calling `onOpenAuth`.
- Mobile: a compact login button plus an animated hamburger button (bars morph into an X via transforms).
- Mobile menu overlay: a dimmed backdrop and a right-side slide-in drawer with a header (title + close button), the nav links (active-state border/background, closing the drawer on click), an embedded `LanguageSelector`, and a full-width login button.

**Exports:** Named export `PublicNavbar`.

**Key dependencies:** next-intl (`nav` namespace), `@/i18n/navigation` (`Link`, `usePathname`), `@/hooks/useIsMobile` (TOUCH_TARGET, mobileInteractiveStyles), `./BrandLogo` (`BrandIsotipo`, `BrandLogotipo`), `./LanguageSelector`. Relies on `fadeIn`/`slideInRight` CSS animations defined globally.

**Flags:** none.

---

### frontend-next/src/components/PublicPageWrapper.tsx

**Purpose:** A layout wrapper for public/marketing pages that chooses the correct navbar based on auth state, renders a footer, and provides the auth slide-panel via context so any descendant can trigger login/register.

**What it does:**
- `PublicPageWrapper` (prop: `children`): uses `useAuth()` for `isAuthenticated`/`isLoading`; local state `showAuthPanel`, `authPanelMode` (`login`/`register`), `authRedirectTo`.
- `openAuthPanel(mode = "login", redirectTo?)`: if already authenticated, pushes to `redirectTo || "/dashboard"`; otherwise sets the mode/redirect and opens the panel.
- `handleLoggedIn()`: closes the panel and navigates to the stored redirect (or `/dashboard`), clearing the redirect.
- Provides `AuthPanelContext` with `{ openAuthPanel }`. Renders a full-height flex column: while `isLoading` a thin dark placeholder bar (avoids navbar flash), then `NavBar` (authenticated) or `PublicNavbar` (anonymous, wired to open the login panel), `<main>` with children, `Footer`, and — only for anonymous users — the `AuthSlidePanel`.

**Exports:** Named export `PublicPageWrapper`.

**Key dependencies:** `next/navigation` (`useRouter`), `../hooks/useAuth`, `./PublicNavbar`, `./NavBar`, `./Footer`, `./AuthSlidePanel`, `../contexts/AuthPanelContext`.

**Flags:** none.

---

### frontend-next/src/components/RegionalArticlePage.tsx

**Purpose:** A reusable, fully-translated SEO landing/article template for the single-locale regional pages (e.g. `/polla-futbolera`, `/prode-deportivo`, `/en/football-pool`). Renders hero, structured article sections, related links, and a registration CTA from a given i18n namespace.

**What it does:**
- `articleStyle` constant: shared inline styles for body paragraphs and pull quotes.
- `RegionalArticlePageProps`: `namespace` (i18n namespace driving all copy) and `relatedLinks` (array of `{ key, href }`).
- `RegionalArticlePage`: `useTranslations(namespace)`, then renders inside `PublicPageWrapper`:
  - Hero section (dark gradient): `heroLabel`, `heroTitle` (h1), `heroSubtitle`.
  - Article body: Section 1 (title + four paragraphs), Section 2 "How it works" (title, intro, three numbered step cards using `step{n}Title`/`step{n}Desc`, outro), Section 3 "Why Picks4All" (title + three paragraphs), a pull quote, and two closing paragraphs. Most paragraphs render translated HTML via `dangerouslySetInnerHTML={{ __html: sanitizeHtml(t(...)) }}`.
  - Related links block: renders each related link with a plain `next/link` (`NextLink`) — a deliberate choice (documented in the top comment) so the canonical hrefs are emitted verbatim rather than being auto-prefixed by next-intl's locale-aware Link, which would 404 or pointlessly redirect on these single-locale pages.
  - CTA section (brand gradient): `ctaTitle`, `ctaSubtitle`, `ctaHint`, and a `RegisterButton`.

**Exports:** Named export `RegionalArticlePage`.

**Key dependencies:** next-intl (`useTranslations`), `next/link` (`NextLink`, intentionally not the i18n Link), `@/components/PublicPageWrapper`, `@/components/RegisterButton`, `@/lib/sanitize` (`sanitizeHtml`), `@/lib/theme`.

**Flags:** none. (The use of `next/link` instead of the i18n-aware `Link` is intentional and documented.)

---

### frontend-next/src/components/RegisterButton.tsx

**Purpose:** A small reusable "create free account" CTA button that opens the register-mode auth panel and tracks the click.

**What it does:**
- `RegisterButtonProps`: optional `label` and `style` overrides.
- `RegisterButton`: uses `useAuthPanel()` to get `openAuthPanel`. On click, fires `trackEvent("cta_clicked", { cta_text: "register", page: "content" })` and calls `openAuthPanel("register")`. Renders a white button (purple text) with brand styling; aria-label and default label come from the `common` namespace (`nav.registerAriaLabel`, `nav.registerCta`), each with a `defaultMessage`.

**Exports:** Named export `RegisterButton`.

**Key dependencies:** next-intl (`common` namespace), `../contexts/AuthPanelContext` (`useAuthPanel`), `@/lib/theme`, `@/lib/analytics` (`trackEvent`).

**Flags:** Uses `t("...", { defaultMessage })` for `nav.registerAriaLabel` and `nav.registerCta`. Per project memory (`feedback_nextintl_no_fallback.md`), next-intl's `defaultMessage` is NOT a fallback — if these keys are missing from the es/en/pt `common` JSON, the literal key string renders instead. Worth verifying those keys exist in all three locales. Medium confidence i18n risk.

---

### frontend-next/src/components/scoring-editor/presets.ts

**Purpose:** The visual catalog (icon + colors) for the ScoringEditor preset picker, kept in its own module so consumers (e.g. StepScoring's wizard wrapper) can grab icon/colors for headers without importing the full editor tree.

**What it does:**
- `PresetInfo` type: `key` (`PickConfigPresetKey`), `icon` (emoji), optional `recommended`, `color`, `bgColor`, `borderColor`.
- `PRESETS` array of four entries: CUMULATIVE (trophy emoji, recommended, brand color), BASIC (target emoji, success-alt green), SIMPLE (brain emoji, amber `#d97706`), CUSTOM (gear emoji, purple).
- The header comment explicitly notes that user-facing text (name/tagline/description/example) is NOT stored here — it lives in `messages/{es,en,pt}/poolWizard.json` under `scoring.presets.{KEY}.*` and is resolved via `useTranslations()`. Storing copy in this file previously caused a "Spanish strings leak into EN/PT" bug.

**Exports:** `PresetInfo` (type) and `PRESETS` (constant array).

**Key dependencies:** `@/lib/theme` (`colors`), `@/types/pickConfig` (`PickConfigPresetKey`).

**Flags:** none.
