## Batch 14

This batch covers the pool-detail tab subcomponents (`pools/[poolId]/components/`), the pool detail page and its loading skeleton, the invite-code join landing, the user profile editor, the corporate account-activation page, and the public "how it works" SEO page.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolBrandingTab.tsx

**Purpose:** Post-creation branding editor for corporate pools. Lets a host edit logo, brand colors, welcome message, invitation message, and invitation locale after the pool exists, mirroring the wizard's `StepCompanyInfo` but without the (locked) company name and with a save/discard footer instead of next-step navigation.

**What it does:**
- Constants: `MAX_LOGO_SIZE` (500 KB; backend caps raw at 700 KB), `ALLOWED_LOGO_TYPES` (png/jpeg/gif/webp — SVG deliberately excluded for email-client compatibility), and `LOGO_ACCEPT_ATTR` (joined for the file input `accept`).
- `PoolBrandingTab({ poolId, overview, onSaved })`: main client component.
  - Reads `org = overview.pool.organization`. Computes `initial` values memoized off `org` (logoBase64, primaryColor, secondaryColor, welcomeMessage, invitationMessage, invitationLocale defaulting to `"es"`). Empty string is the "unset" sentinel.
  - Holds each field in local state plus `logoError`, `busy`, and a `statusMessage` discriminated union (success/error).
  - Early return: if `!org`, renders an info note (`pool.branding.futureOnlyNote`) — guards against a hand-crafted `?tab=personalizacion` URL on a non-corporate pool.
  - `hasChanges`: dirty check comparing all six fields against `initial`.
  - `handleLogoChange`: validates size and MIME type, sets a localized error and clears the input on failure, otherwise reads the file as a base64 data URL via `FileReader`.
  - `removeLogo`, `discard` (resets every field + status to `initial`), `resetColors` (clears both colors).
  - `save()`: builds a diff payload (`undefined` = leave untouched, empty string → `null` = clear; `invitationLocale` is never null) and calls `updatePoolBranding(token, poolId, payload)`; on success calls `onSaved()` (the page's `load`) and sets a success status, on failure an error status.
  - `resolveBrandColors` + `hasGoodContrastAgainstWhite` drive a contrast warning; `previewName` falls back to "Acme Corp".
  - Renders five `WizardSubStep` blocks: (1) logo upload/preview/remove, (2) brand colors via two `ColorField`s + reset link + live `HeaderPreview` + contrast warning, (3) welcome message textarea (1000-char counter) + `WelcomeSplashPreview`, (4) invitation message textarea + `InvitationEmailPreview` + a "future only" note, (5) invitation locale via `BrandingInvitationLocalePicker`.
  - Sticky save/discard footer that shows the status message and disables both buttons when `!hasChanges || busy`.
- `BrandingInvitationLocalePicker`: a segmented three-button picker for es/en/pt using `LOCALE_OPTIONS` (with short-code pills "ES"/"EN"/"PT" instead of flag emoji, which render poorly on Windows Segoe UI Emoji).

**Exports:** Named `PoolBrandingTab`.

**Key dependencies:** `@/lib/api` (`updatePoolBranding`, `UpdatePoolBrandingInput`, `PoolOverview`), `@/lib/brandColors`, `@/lib/auth` (`getToken`), `@/lib/theme`, `@/hooks/useIsMobile`, wizard primitives `WizardSubStep`/`ColorField`, and the three `branding-previews/` components shared with the wizard.

**Flags:** none. (Heavy use of `defaultMessage` is contrary to the repo's "next-intl defaultMessage is not a fallback" rule, but keys appear paired with translations elsewhere; noted as a stylistic risk, not dead code.)

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx

**Purpose:** Dedicated capacity tab extracted verbatim from the former admin tab, surfacing the current fill ratio and the "expand capacity → checkout" flow. Pure UI relocation; backend/pricing/checkout untouched.

**What it does:**
- `PoolCapacityTab({ poolId, overview })`: if `overview.pool.maxParticipants` is unset, renders a "capacity not configured" note. Otherwise computes `max`, `current` (`counts.membersActive`), and `fillRatio`, renders a capacity card with a progress bar (turns red above 80% fill), and embeds `ExpandCapacitySection` with `poolType` derived from whether `organizationId` is set.
- `ExpandCapacitySection({ poolId, poolType, currentCapacity })`: owns the upgrade flow.
  - State: `selectedCapacity`, `busy`, `country` (default "US"), `errorMsg` (F-1: surfaces failures explicitly instead of a silent console error), and `ccApplied` (a `RedemptionSummary | null` for cuenta-de-cobro redemption, only enabled when `poolType === "corporate"`).
  - On mount fetches `getPaymentCountry()`; when a CC is applied it forces `selectedCapacity` to the CC's `targetCapacity`.
  - `handleExpand()`: re-fetches country; for `CO` creates a Mercado Pago checkout (`createMpCheckout`), fires `trackBeginCheckout` + `trackMetaEvent("InitiateCheckout")` in COP, beacons `REDIRECT_INITIATED`/`REDIRECT_FAILED` via `reportPaymentAttemptEvent`, then navigates to `/pago/checkout?...` (locale-prefixed). For all other countries it creates a Polar checkout (`createCheckout`) in USD with the same analytics + beacon plumbing, then redirects to `result.checkoutUrl`. Catches and surfaces errors into `errorMsg`.
  - Renders the optional `AccountReceivableRedemptionBox` (corporate only), a `CapacitySelector` in `mode="expansion"` (read-only when a CC is applied), an error box, and the expand button. The button label computes the upgrade price as the tier-price delta (`getTierForCustomCountUsd`/`getTierForCustomCount` per currency) via `formatPrice`.

**Exports:** Named `PoolCapacityTab`.

**Key dependencies:** `@/lib/api/payments` (`createCheckout`, `createMpCheckout`, `getPaymentCountry`), `@/lib/api/paymentAttemptEvent`, `@/lib/ecommerce`, `@/lib/metaPixel`, `@/lib/pricing`, `@/components/CapacitySelector`, `@/components/AccountReceivableRedemptionBox`, `@/lib/api` types. Implements payment routing per the dual-gateway architecture (Polar USD / Mercado Pago COP).

**Flags:** none. (Comments reference fix IDs F-1/F-13/F-16 and Commit 3/5; informational, not dead code.)

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolHelpers.ts

**Purpose:** Shared pure/i18n helper functions for the pool zone — date formatting, phase/team/tournament name resolution from the trilingual catalogs, status badges, and placeholder-team handling.

**What it does:**
- `fmtUtc(iso, userTimezone, locale="es")`: wraps `formatMatchDateTime`; locale arg is required to avoid Spanish month abbreviations leaking to EN/PT users (I18N_AUDIT F-2).
- `norm(s)`: lowercase + trim, null-safe.
- `formatPhaseName` / `formatPhaseFullName`: dynamic `t("phases.{id}")` / `t("phasesLong.{id}")` lookups with try/catch fallbacks (replace underscores; short variant slices to 6 chars).
- `getMatchLabel(match, t)`: builds a locale-aware match label — group-stage matches parse the matchday from the `_MD{n}_` matchId pattern and use `matchCard.groupMatchLabel`; knockout phases use `phasesLong.{phaseId}`; fallback chain to `roundLabel`/`matchCard.matchLabel` (I18N_AUDIT F-1).
- `getPoolStatusBadge(status, t)`: returns `{ label, color, emoji }` for DRAFT/ACTIVE/COMPLETED/ARCHIVED/unknown.
- `getTeamName(team, t)`: resolves a FIFA-code team name from `teams.{code}` catalog (guards against next-intl returning the key itself), falling back to `team.name` then `team.id` (I18N_AUDIT F-5).
- `getTournamentName(templateKey, fallbackName, t)`: resolves from `tournaments.{templateKey}` catalog, falling back to the stored instance name then empty string (I18N_AUDIT F-7).
- `isPlaceholder(teamId)`: true for `t_TBD`, or ids prefixed `W_`/`RU_`/`L_`/`3rd_`.
- `getPlaceholderName(teamId, t)`: maps placeholder ids to localized "winner of…/runner-up/loser/best third" labels via `placeholders.*` keys.

**Exports:** Named functions `fmtUtc`, `norm`, `formatPhaseName`, `formatPhaseFullName`, `getMatchLabel`, `getPoolStatusBadge`, `getTeamName`, `getTournamentName`, `isPlaceholder`, `getPlaceholderName`.

**Key dependencies:** `next-intl` (`useTranslations` type only), `@/lib/timezone` (`formatMatchDateTime`).

**Flags:** `fmtUtc` and `getMatchLabel` are exported but not consumed by any file in this batch — likely used by sibling tab files (`MatchCard.tsx`) outside this batch; low-confidence orphan risk only.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolLeaderboardTab.tsx

**Purpose:** The Leaderboard tab — renders the standings table (desktop) or `MobileLeaderboard` (mobile), with per-phase score/structural counters, search, pagination, Excel export, share buttons, and a player-summary modal.

**What it does:**
- `PoolLeaderboardTab({ overview, poolId, isMobile, playerSummaryModal, setPlayerSummaryModal })`.
- Derives `allRows`, `myUserId`/`myRow`/`myRank`, `leaderPoints`, and `phases`.
- `phaseTypeByPhaseId` (memo): builds a `Map<phaseId, "STRUCTURAL_GROUP" | "STRUCTURAL_KNOCKOUT" | "SCORE">` from `pool.pickTypesConfig`, so MIXED pools render the correct per-column counter. `hasAnyStructural` is derived from it.
- `isHostOrAdmin`: role in HOST/CO_ADMIN/CORPORATE_HOST.
- Search (`filtered`) + pagination (`PAGE_SIZE=20`, `safePage`, `paged`); pins the current user's row when off-page and not searching (`showPinnedRow`).
- `handleExport`: dynamically imports `@/lib/exportLeaderboard` and calls `exportLeaderboardExcel`.
- `renderRow(r, isPinned)`: a desktop `<tr>` with medal emoji for top 3, row-background tinting by rank/me/pinned, clickable name cell opening the player-summary modal, role/LEFT badges, total points cell, one cell per phase (showing points plus a structural counter like `2★` or `3/16` with tooltips), and a "diff to leader" cell.
- Render: header (title, host-only Excel export button, `ShareButtons`), conditional search box (only when rows > PAGE_SIZE), then either `MobileLeaderboard` + `PaginationControls` (mobile) or the full desktop table + empty-state + pagination.
- Player Summary Modal: a fixed overlay rendering `PlayerSummary` for the selected user (tournamentKey falls back to `wc_2026_sandbox`).

**Exports:** Named `PoolLeaderboardTab`.

**Key dependencies:** `@/components/MobileLeaderboard`, `@/components/PlayerSummary`, `@/components/ShareButtons`, `@/components/PaginationControls`, `@/lib/exportLeaderboard` (dynamic), local `poolTypes`/`poolHelpers`, `@/hooks/useIsMobile` (`TOUCH_TARGET`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolMatchesTab.tsx

**Purpose:** The Partidos (matches) tab — phase navigation, notification/pending banners, filters, the structural-picks manager (for SIMPLE structural phases), grouped collapsible match cards, and the scoring-override + match-picks modals.

**What it does:**
- `PoolMatchesTab(props)`: receives a large prop bag (poolId, token, overview, isMobile, busy/error setters, timezone, reload, notifications, phase/filter state, `savePick`/`saveResult`, etc.) destructured at the top.
- Local state: `matchPicksModal` (modal data) and scoring-override modal state (`scoringOverrideModal`, `scoringOverrideReason`, `scoringOverrideBusy`).
- `loadMatchPicks(matchId, matchTitle)`: fetches `getMatchPicks` into the modal with loading/error handling.
- `toggleScoringOverride()`: calls `setScoringOverride` with the inverted enabled flag + optional reason, closes the modal, and reloads.
- Render blocks: (1) phase segmented control with per-phase match count and a 🔒 lock indicator for PENDING phases; (2) a `NotificationBanner` built from urgent deadlines (grouped per phase) and pending-results (host/co-admin only); (3) a pending-phase warning banner; (4) collapsible filters (search + onlyOpen + noPick + noResult — the noResult filter only for users with `canManageResults`), hidden when structural picks are required; (5) `StructuralPicksManager` for SIMPLE structural phases, wired to tournament data, host flag, lock state, match results, reload, and breakdown modal; (6) match list grouped via `groupOrder`/`matchesByGroup`, each group as a collapsible `<details>` card (or flat when there are no groups) rendering `MatchCard` per match with pick/result/breakdown/picks/scoring callbacks; (7) the `ScoringOverrideModal`; (8) the `MatchPicksModal`.

**Exports:** Named `PoolMatchesTab`.

**Key dependencies:** `@/components/StructuralPicksManager`, `@/components/NotificationBanner`, `@/components/ShareButtons` (imported, see flag), `@/lib/api` (`getMatchPicks`, `setScoringOverride`), types from `@/lib/poolTypes`, and sibling files `./MatchCard`, `./MatchPicksModal`, `./ScoringOverrideModal`, plus local `poolHelpers`.

**Flags:** `ShareButtons` is imported but never used in the rendered output (line 12) — dead import (low/medium confidence). Note: the file imports `MatchPicksModalData` and `ScoringOverrideModalData` from sibling modules `./MatchPicksModal` and `./ScoringOverrideModal`, duplicating type names that also live in `./poolTypes` (mild type duplication).

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolNavDrawer.tsx

**Purpose:** Persistent left sidebar for the pool detail page, shown only on viewports ≥ 1024px (tabletLg); below that the mobile drawer in the global NavBar renders the same items.

**What it does:** `PoolNavDrawer({ showHostItems, showBrandingTab, tabBadges, hasUrgent })` returns `null` when `useIsMobile({ breakpoint: BREAKPOINTS.tabletLg })` is true; otherwise renders a sticky `<aside>` (width 248px) wrapping `PoolNavItems` with the passed props.

**Exports:** Named `PoolNavDrawer`; re-exports the `PoolNavTab` type.

**Key dependencies:** `@/hooks/useIsMobile` (`BREAKPOINTS`), `@/lib/theme`, `@/components/pool/PoolNav` (`PoolNavItems`, `PoolNavTab`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx

**Purpose:** The Jugadores (players) tab — host-only management of pending join requests, corporate employee invitations, shareable invite codes, and the paginated member roster + expulsion modal.

**What it does:** `PoolPlayersTab({...})` renders inside a card: (1) `PendingJoinRequests` when the viewer `canManageResults`; (2) `CorporateEmployeeManager` (Excel invite flow) when the pool is corporate (`organizationId` set); (3) `PoolInviteCodeManager` (shareable link) for corporate pools when the viewer `canInvite`, passing the organization name; (4) `MemberManagement` (paginated + search) for all viewers, wired to open the expulsion modal; (5) the `ExpulsionModal` when `expulsionModalData` is set. Holds only `expulsionModalData` locally; everything else is lifted from the page.

**Exports:** Named `PoolPlayersTab`.

**Key dependencies:** sibling admin components `./admin/MemberManagement`, `./admin/ExpulsionModal`, `./admin/PendingJoinRequests`; `@/components/CorporateEmployeeManager`, `@/components/PoolInviteCodeManager`; local `poolTypes` (`ExpulsionModalData`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolRulesTab.tsx

**Purpose:** The Reglas (rules) tab — displays the pool's scoring/pick/deadline/tournament rules. Uses the richer `PickRulesDisplay` when `pickTypesConfig` exists, otherwise falls back to a legacy hand-rendered rules layout.

**What it does:** `PoolRulesTab({ overview, allowScorePick })`. If `pool.pickTypesConfig` is set, renders `<PickRulesDisplay>` (config + deadline minutes + timezone). Otherwise renders four cards using `usePoolTerm()` params for interpolation: (1) Scoring System — preset name/description and exact-score vs outcome-only point values from `leaderboard.scoring`; (2) Pick Rules — score vs outcome method badge from `allowScorePick`; (3) Deadline Policy — `deadlineMinutesBeforeKickoff` with a timezone-aware important note; (4) Tournament Info — localized tournament name via `getTournamentName`, active member count, visibility (private/public) badge, and optional description. Uses `t.rich` for bolded segments.

**Exports:** Named `PoolRulesTab`.

**Key dependencies:** `@/components/PickRulesDisplay`, `@/contexts/PoolTermContext` (`usePoolTerm`), `@/types/pickConfig`, `@/lib/api`, local `poolHelpers` (`getTournamentName`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolSectionHeader.tsx

**Purpose:** Sticky full-width section title band rendered just below the navbar, showing the icon + label of the currently active pool tab (read from the `?tab=` search param).

**What it does:** `PoolSectionHeader()` reads `tab` from `useSearchParams`, validates it against `VALID_TABS` (a `ReadonlySet<PoolNavTab>` of the eight tabs), defaulting to `"partidos"`. Resolves `{ icon, labelKey }` via `getPoolNavMeta(activeTab)` and renders a sticky `<h1>` band. Sticks to `var(--p4a-navbar-h, 0px)` (so it tracks the auto-hiding mobile navbar) at `zIndex.base` (below the navbar drawer so the drawer covers it when open), on a soft-brand `#eee9fa` surface.

**Exports:** Named `PoolSectionHeader`.

**Key dependencies:** `next-intl`, `next/navigation` (`useSearchParams`), `@/hooks/useIsMobile`, `@/lib/theme`, `@/components/pool/PoolNav` (`getPoolNavMeta`, `PoolNavTab`).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/poolTypes.ts

**Purpose:** Shared TypeScript types for the pool tab components — the base prop bag and modal-data shapes.

**What it does:** Declares interfaces: `PoolTabBaseProps` (the common prop set passed from `PoolPage` to tabs: ids, token, overview, mobile flag, busy/error state setters, timezone, reload, refetchNotifications, friendlyError), `PhaseData`, `ExpulsionModalData` (`{ memberId, memberName, type: "KICK" | "BAN" }`), `BreakdownModalData`, `PlayerSummaryModalData`, `MatchPicksModalData`, and `ScoringOverrideModalData`.

**Exports:** Types `PoolTabBaseProps`, `PhaseData`, `ExpulsionModalData`, `BreakdownModalData`, `PlayerSummaryModalData`, `MatchPicksModalData`, `ScoringOverrideModalData`.

**Key dependencies:** `@/lib/api` (`PoolOverview`, `MatchPicksResponse`), `@/types/pickConfig`.

**Flags:** `PoolTabBaseProps` and `PhaseData` are declared here but the tab files in this batch each redeclare their own prop interfaces rather than importing `PoolTabBaseProps`; `MatchPicksModalData`/`ScoringOverrideModalData` are also duplicated in their respective modal files. Low/medium confidence: `PoolTabBaseProps` and `PhaseData` may have no live consumer (duplicated logic / orphan type risk).

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/ResultComponents.tsx

**Purpose:** Match-result rendering and editing components used inside match cards — a read/edit container, a styled score display with live-ticker and penalties, and a host result editor.

**What it does:**
- `ResultSection(props)`: container with read/edit modes. Shows an "awaiting result" pending state when no result; when a result exists shows `ResultDisplay` plus a host-only "Correct result" button (only when not live) that toggles edit mode; in edit mode shows an override warning banner plus `ResultEditor` with `requireReason`.
- `ResultDisplay(props)`: renders the score with team flags (`getTeamFlag`, fallback ⚽), a live ticker (elapsed minute / "45+3" / HT label with pulsing dot + animated indeterminate progress bar) while the match is in play, a penalties block (winner highlighted) when penalties exist, an "official result" line with version suffix when `version > 1`, and a correction-reason note if present. Team names via `getTeamName`.
- `ResultEditor(props)`: home/away goal number inputs with team logos/names; detects knockout phases (`phaseId` not containing "group") and, on a draw, shows a required penalties section; an optional correction-reason input (required when `requireReason`); save (publishes result or correction, passing penalties when applicable) and cancel buttons; an inline "reason required" warning. Mobile-aware sizing via `TOUCH_TARGET`/`mobileInteractiveStyles`.

**Exports:** Named `ResultSection`. (`ResultDisplay` and `ResultEditor` are module-private.)

**Key dependencies:** `@/data/teamFlags` (`getTeamFlag`), `@/hooks/useIsMobile` (`TOUCH_TARGET`, `mobileInteractiveStyles`), local `poolHelpers` (`getTeamName`), `@/lib/theme`.

**Flags:** none. (Props are typed `any` for `result`/`homeTeam`/`awayTeam` — loose typing, not dead code.)

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/ScoringOverrideModal.tsx

**Purpose:** Confirmation modal for enabling/disabling per-match scoring, with an optional reason field when disabling.

**What it does:** `ScoringOverrideModal({ data, reason, onReasonChange, onConfirm, onClose, busy })` renders a centered overlay (click-outside closes) showing the match title, an enable/disable confirmation message, a reason text input (max 500 chars) shown only when currently enabled (i.e. disabling), and cancel/confirm buttons. The confirm button is colored by direction (warning when disabling, success when enabling) and disabled while `busy`.

**Exports:** Named `ScoringOverrideModal` and interface `ScoringOverrideModalData` (`{ matchId, matchTitle, currentEnabled }`).

**Key dependencies:** `next-intl`, `@/lib/theme`.

**Flags:** `ScoringOverrideModalData` is exported here and also defined identically in `poolTypes.ts` — duplicated type definition (low confidence).

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/loading.tsx

**Purpose:** Streaming SSR skeleton for the pool detail route, shown immediately during navigation while async data resolves.

**What it does:** Default export `PoolLoading()` renders an accessible (`role="status"`, `aria-busy`, off-screen "Loading pool…" text) column of four shimmering `SkeletonBlock`s of varying heights. `SkeletonBlock({ height })` is a div with a moving linear-gradient background animated by the `p4a-skeleton-shimmer` keyframes (defined globally elsewhere).

**Exports:** Default `PoolLoading`.

**Key dependencies:** none (inline styles only; relies on a global keyframe).

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx

**Purpose:** The pool detail page — the central client component orchestrating data loading, URL-driven tab/phase/group state, live refresh, corporate splash/branding chrome, the capacity-full popup, and dispatch to all tab components.

**What it does:**
- Dynamically imports heavy tabs (`PoolAdminTab`, `PoolMatchesTab`, `PoolLeaderboardTab`, `PoolRulesTab`) for code-splitting (HI-06); imports `PoolPlayersTab`, `PoolCapacityTab`, `PoolBrandingTab` statically.
- `VALID_TABS`/`PoolTab`: the eight valid tab ids.
- `PoolPage()`:
  - Reads `poolId` from route params, token from `getToken`, computes `isMobile` and `isCompact` (≤1024px hides the in-page "back to dashboard" link since the hamburger drawer exposes "Mis Pools").
  - URL-driven state (HI-05): `activeTab`, `activePhase`, `selectedGroup` from search params; `setActiveTab`/`setActivePhase`/`setSelectedGroup` use `router.replace` with `{ scroll: false }` (changing phase resets group). `setActiveTab` fires `trackEvent("tab_changed")`.
  - `friendlyError(e)`: maps API error codes/statuses to localized messages (PENDING_APPROVAL, POOL_DRAFT, FORBIDDEN/403, 404, 401, generic) and fires `error_displayed` analytics.
  - Core state: `overview`, `error`, `busyKey`, `userTimezone`; UI state: `showSplash`, `showCapacityPopup`, `pendingMembers`, modal data, `uclBannerDismissed` (localStorage-backed), match filters, `inviteCode`.
  - Notifications via `usePoolNotifications` (60s polling); `tabBadges`/`hasUrgent` derived. `usePublishPoolNav` publishes nav state (host items + corporate-only branding tab) to the layout store for the mobile drawer.
  - `load()`: fetches `getPoolOverview`, detects first-time visit per (user,pool) in localStorage and fires `pool_viewed` (with `first_time`) + Meta `ViewContent`; triggers the corporate splash once per session; shows the capacity-full popup for hosts at capacity (unless dismissed in localStorage); fetches the user profile for timezone; loads pending members when host.
  - `loadPendingMembers()`, mount effect calling `load()`.
  - `useLiveRefresh(overview.matches, liveRefetch)`: silent 15s polling while any match is live.
  - Computed memos: `phases` (sorted), auto-select first phase, `getPhaseStatus` (PENDING/ACTIVE/COMPLETED based on placeholders + results), `nextPhaseMap`, `hasPhaseAdvanced`, `allowScorePick`, `activePhaseConfig`, `requiresStructuralPicks`, `activePhaseData`, `nextOpenGroup`, `filteredMatches` (phase + filters + search), `matchesByGroup`, `groupOrder` (A–L priority then others then SIN_GRUPO), `phaseMatchResults` map.
  - Actions: `onCreateInvite` (creates + clipboard-copies an invite code, fires analytics), `savePick` (validates SCORE numerics, calls `upsertPick`, fires analytics, reloads, refetches notifications), `saveResult` (dynamic-imports `upsertResult`), `toggleScoringOverride` (dynamic-imports `setScoringOverride`).
  - Render: `PoolSectionHeader` (once loaded); back-to-dashboard link (desktop); error/pending-approval states; loading text; capacity-full popup (routes to capacidad tab); corporate splash screen (brand-color-aware gradient, logo or initial, welcome message, play button persisting a sessionStorage flag); UCL incident banner; corporate vs standard pool header (corporate header tints with brand colors + status badge; standard header has integrated invite button + status badge); subtitle line with tournament name/member count/role; invite-code display with share buttons; LEFT-member banner; and the sidebar + `<main>` that conditionally renders each tab component based on `activeTab` and permissions; plus the `ScoringBreakdownModal`.

**Exports:** Default `PoolPage`.

**Key dependencies:** `@/lib/api` (overview/pick/result/profile/invite/members), `@/lib/poolTypes`, `@/lib/auth`, `@/hooks/useIsMobile`/`usePoolNotifications`/`useLiveRefresh`, `@/lib/analytics`/`metaPixel`, `@/lib/brandColors`, `@/components/ScoringBreakdownModal`/`PlayerSummary`/`ShareButtons`, `@/components/pool/PoolNav` (`usePublishPoolNav`), and all sibling tab components.

**Flags:** `setSelectedGroup`/`selectedGroup` are threaded into `PoolMatchesTab` but the matches tab in this batch no longer uses a group selector ("Group selector removed" comment), so this state may be vestigial (low confidence). `toggleScoringOverride` defined on the page is not passed to any child (the matches tab implements its own override toggle) — likely dead (medium confidence).

---

### frontend-next/src/app/[locale]/(authenticated)/pools/join/page.tsx

**Purpose:** Invite-code join landing — reads `?code=`, calls the join API, and redirects into the joined pool (or shows an error).

**What it does:**
- `JoinPoolInner()`: reads `code` from search params; on mount, redirects to `/dashboard` if no code, or to `/login?redirect=...` if not authenticated. Otherwise calls `joinPool(token, code)`; on success stores `poolId`, sets status `success`, fires `pool_joined` + Meta `PoolJoined`, and redirects to `/pools/{poolId}` after 1.5s. On error, distinguishes `POOL_FULL` (`ApiError`) with a dedicated localized message from generic errors. Uses a `cancelled` flag to avoid setting state after unmount. Renders joining/success/error states with a back-to-dashboard link in the error state.
- `JoinPoolPage()`: default export wrapping `JoinPoolInner` in `<Suspense>` (required because it reads search params).

**Exports:** Default `JoinPoolPage`.

**Key dependencies:** `next/navigation`, `next-intl`, `@/lib/auth` (`getToken`), `@/lib/api/pools` (`joinPool`), `@/lib/apiError` (`ApiError`), `@/lib/theme`, `@/lib/analytics`, `@/lib/metaPixel`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/(authenticated)/profile/page.tsx

**Purpose:** The user profile editor — loads and updates the authenticated user's profile (display name, username with cooldown, name, DOB, gender, country, timezone, bio) plus email verification banner and email preferences.

**What it does:** `ProfilePage()` loads the profile via `getUserProfile`, populates a `formData` state object, and computes a username-change cooldown warning (30-day rule from `lastUsernameChangeAt`). `handleSubmit` builds an `UpdateProfileInput` payload (empty strings → `undefined`/`null`), calls `updateUserProfile`, shows a success message auto-cleared after 3s (timer ref cleaned up on unmount), and refreshes the cooldown warning. Renders an `EmailVerificationBanner`, an info block (email with verified/Google/pending badge + locale-formatted created date), error/success banners, and a form with: displayName (required, max 100), username (required, 3–20, `^[a-zA-Z0-9_]+$`), first/last name, date of birth (max today) + gender select, country select (16 Americas/Europe options), timezone select (grouped Americas/Europe/North America), bio (max 200 with char counter), and cancel/save buttons. Renders `EmailPreferencesSection` outside the form.

**Exports:** Default `ProfilePage`.

**Key dependencies:** `@/lib/api` (`getUserProfile`, `updateUserProfile`, types), `@/lib/auth` (`getToken`), `@/components/EmailPreferencesSection`, `@/components/EmailVerificationBanner`, `next-intl` (`useTranslations`, `useLocale`), `@/lib/theme`.

**Flags:** none.

---

### frontend-next/src/app/[locale]/activar-cuenta/page.tsx

**Purpose:** Public route for corporate employee account activation (token-based), rendering the activation UI inside the public page chrome.

**What it does:** `generateMetadata()` builds title/description from `activation.meta` and sets `robots: { index: false, follow: false }` (noindex/nofollow). Default `ActivationPage()` renders `ActivationContent` inside `PublicPageWrapper` and a `<Suspense>` boundary (since the content reads the activation token from search params).

**Exports:** Default `ActivationPage`; async `generateMetadata`.

**Key dependencies:** `next-intl/server` (`getTranslations`), `@/components/PublicPageWrapper`, `@/components/ActivationContent`.

**Flags:** none. (Route is `activar-cuenta`; note MEMORY references an `/activar` activation page — the actual content component is `ActivationContent`, consistent.)

---

### frontend-next/src/app/[locale]/como-funciona/page.tsx

**Purpose:** Public, SSR, SEO-optimized "How it works" page (es `/como-funciona`, en `/how-it-works`, pt `/como-funciona`) with host/player step sections, a scoring table, JSON-LD HowTo structured data, and breadcrumbs.

**What it does:**
- `generateMetadata({ params })`: sets request locale, builds metadata via `buildPageMetadata` with per-locale paths.
- `interpolate(text, params)`: replaces `{key}` placeholders with values (used for pool-term region substitution).
- `StepItem({ number, title, description })`: a numbered step row.
- `ComoFuncionaPage({ params })` (async server component): sets request locale; loads `messages/{locale}/howItWorks.json` via dynamic import (deliberately not registered in `i18n/request.ts` — comment warns not to delete these files, ref commit 27db35b); computes pool-term params with `DEFAULT_REGION` (SSR uses canonical region so the page stays static/cacheable; the visitor's real region is applied client-side post-hydration). Interpolates pool-term placeholders into hero/jsonLd/host/player/scoring/cta strings. Renders `Breadcrumbs`, a `JsonLd` HowTo block, then the page inside `PublicPageWrapper`: hero, "For Hosts" steps, "For Players" steps (with a CTA link to `/como-se-juega`), a scoring system table, and a final CTA section with `RegisterButton`.

**Exports:** Default `ComoFuncionaPage`; async `generateMetadata`. Module-private: `interpolate`, `StepItem`, and types `StepData`/`HowItWorksMessages`.

**Key dependencies:** `next-intl/server`, `@/i18n/navigation` (`Link`), `@/components/PublicPageWrapper`/`JsonLd`/`Breadcrumbs`/`RegisterButton`, `@/lib/poolTerms`, `@/lib/siteConfig` (`SITE_URL`), `@/lib/seo` (`buildPageMetadata`), `@/lib/theme`, dynamic `@/messages/{locale}/howItWorks.json`.

**Flags:** none. (`howToPlayCta` has a hardcoded Spanish fallback "¿Cómo se juega?" — minor, not dead code.)
