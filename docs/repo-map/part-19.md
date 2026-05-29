## Batch 19

This batch covers corporate/enterprise UI surfaces (employee invite manager, quote request panel, enterprise landing), profile/notification UI (email preferences, email-verification banner), shared chrome (footer, feedback modal, FAQ accordion), the Estratega "GROUP_STANDINGS" component family, and the SEO `JsonLd` helper. All files are client components except `types.ts` (pure types), the `GroupStandingsCard.tsx` barrel re-export, and `JsonLd.tsx` (a server-compatible render-only component).

---

### frontend-next/src/components/CorporateEmployeeManager.tsx

**Purpose:** Host-facing admin panel (rendered inside a corporate pool's admin tab) for building an employee invitation list and sending/resending/deleting token-based corporate activation invites.

**What it does:**
- Module constants: `SEARCH_DEBOUNCE_MS` (300ms, matched to `MemberManagement`), `RESEND_RECENT_WINDOW_MS` (24h — controls whether a resend prompts for confirmation), `PAGE_LIMIT` (25), and `FILTER_OPTIONS` (the 5 `DerivedInviteStatus` filter chips: PENDING/SENT/ACTIVATED/EXPIRED/FAILED with their i18n label keys).
- `CorporateEmployeeManager({ poolId, token, isMobile, maxParticipants, currentMembers })` — single component. Pulls translations from `pool.admin.employees`, the i18n pool-term params from `usePoolTerm()`, and a `useRouter()` for the capacity-tab deep link.
- **List state:** `data` (paged `CorporateEmployeesResponse`), `listLoading`, `search` + `debouncedSearch`, multi-select `statusFilter`, `page`.
- **Add/send state:** `emailsText` textarea buffer, `busy` (string key marking the in-flight action), `message` (inline status bar), `downloadingTemplate`, `uploadingExcel`, and an `excelFileRef` for the hidden file input.
- Two `useEffect`s implement debounced search and a page reset when filters/search change. `fetchPage` (useCallback) calls `getCorporateEmployees` with search/status/page/limit; on error it surfaces a message but retains the prior page.
- `validEmails` (useMemo) splits the textarea on `\n,;`, lowercases, dedupes via `Set`, and validates each against an email regex.
- **Action handlers:** `handleAdd` (addCorporateEmployees → reports added/skipped), `handleSendInvitations` (sendCorporateInvitations → reports sent/failed), `handleDelete` (deleteCorporateEmployee), `handleResend` (resendCorporateInvitation; confirms first only when the invite is SENT and was created within the 24h recent window — see CLAUDE invariant: resend rotates the token), `handleBulkResendExpired` (confirms, then bulkResendExpiredInvitations, appending a "has more" note when the batch was capped), `handleDownloadTemplate` and `handleExcelUpload` (both dynamically `import("@/lib/employeeTemplate")` to lazy-load XLSX parsing/template code), and `toggleStatusFilter`.
- **Style maps:** `statusColors` and `statusLabels` keyed by `DerivedInviteStatus`; `filterCounts` (useMemo) derives per-status counts from `data.summary`.
- **Render:** purple gradient container with a building emoji title. Sections include: a capacity progress badge (only when `maxParticipants`/`currentMembers` known — colour shifts to warning at >=95% and error at full, with a deep link to `?tab=capacidad`), an activated-count progress strip, **Step 1** (numbered "add to list" card with textarea + Excel upload + template download buttons, explicitly stating adding does NOT send), an inline message bar, a capacity-overflow warning when pending+sent invites exceed remaining slots, **Step 2** (always-rendered state machine: amber "waiting" + big send button when pending>0, muted hint when list empty, green "all sent" confirmation otherwise), a search box, filter chips with counts, a bulk-resend-expired CTA, the paged invite list (each row: email/name, token-expiry/expired note, status badge, resend/retry button for SENT/FAILED/EXPIRED, delete button for non-activated), `PaginationControls`, and loading states.

**Exports:** `CorporateEmployeeManager` (named).

**Key dependencies:** `@/i18n/navigation` router; `@/lib/theme`; `@/lib/api` (getCorporateEmployees, addCorporateEmployees, sendCorporateInvitations, deleteCorporateEmployee, resendCorporateInvitation, bulkResendExpiredInvitations + types CorporateInvite/CorporateEmployeesResponse/DerivedInviteStatus); `@/components/PaginationControls`; `@/hooks/useIsMobile` (TOUCH_TARGET, mobileInteractiveStyles); `usePoolTerm`; lazy `@/lib/employeeTemplate` (downloadEmployeeTemplate, parseEmployeeExcel).

**Flags:** none. The `e: any` catch typing is a deliberate system-boundary error narrowing.

---

### frontend-next/src/components/CorporateQuotePanel.tsx

**Purpose:** Slide-in right-side panel (public, on `/empresas`) where a company requests a formal quote ("cuenta de cobro" precursor) — collects company/contact details, country, currency, and a per-pool slot configuration, then POSTs a corporate inquiry.

**What it does:**
- `CorporateQuotePanel({ isOpen, onClose })`. `Status` type = idle|loading|success|error. `COUNTRY_DATALIST_ID` ties the country input to a `<datalist>`. `MAX_POOLS = 50`.
- **State:** company/contact name/email/phone, `countryInput`, `currency` (COP|USD), `poolCount` (string) and `poolSlots` (string[] — one slot value per pool), `showCountTooltip`, `message`, `errors` map, `status`, `submitError`. `sortedCountries` (useMemo) from `getCountriesSorted(locale)`.
- **Effects:** geo pre-selects currency via `getPaymentCountry()` (CO→COP else USD) when opened; ESC-to-close listener; body-scroll lock while open; full form reset when the panel closes.
- `validate()` — trims fields, enforces `LIMITS` constraints (companyName, contactName, contactEmail regex, contactPhone, inquiryMessage), resolves the country via `resolveCountryCode`, and validates each pool slot row against `LIMITS.slotsPerPool` (errors keyed `poolSlots.${i}` for per-row highlighting). Returns `{ ok, countryCode, parsedPools }`.
- `handleSubmit` — validates, calls `submitCorporateInquiry` with the normalized payload (`poolsConfig: parsedPools`, lowercased email, locale), fires `trackEvent("corporate_quote_submitted", …)` with country/currency/pool-count/total-slots, then flips to success or surfaces the error.
- `updatePoolSlots` (immutable per-row edit, clears that row's error), `handlePoolCountChange` (live-resizes the `poolSlots` array as the count input changes, tolerating transient empty/invalid input and pruning stale per-row errors), `handlePoolCountBlur` (snaps the visible count back to the array length).
- **Render:** returns null when closed; otherwise an overlay + dialog (`role="dialog"`, `aria-modal`). Sticky header with title/subtitle and close button. Success state shows a checkmark confirmation. Form state renders the country `<datalist>`, company/contact/email/phone inputs, country autocomplete (validates on blur), a pool-count number input with an info tooltip, one slot `<input>` per pool (labelled "Pool N" when >1), currency radio buttons (COP/USD), an optional message textarea, a submit-error banner, and the gradient submit button. All inputs use shared `inputStyle`/`labelStyle`/`errorTextStyle` and meet `TOUCH_TARGET.minimum`.

**Exports:** `CorporateQuotePanel` (named); also re-exports `COUNTRY_CODES` and `isValidCountryCode` from `@/lib/countries`.

**Key dependencies:** `next-intl` (useLocale/useTranslations, namespace `enterprise.quotePanel`); `@/hooks/useIsMobile`; `@/lib/theme`; `@/lib/validation` (LIMITS); `@/lib/countries`; `@/lib/api/corporate` (submitCorporateInquiry); `@/lib/api/payments` (getPaymentCountry); `@/lib/analytics` (trackEvent).

**Flags:** The trailing `export { COUNTRY_CODES, isValidCountryCode }` ("so consumers can introspect if needed") has no importer anywhere in the repo — the only consumer of this module imports just `CorporateQuotePanel`. Both symbols are still importable directly from `@/lib/countries`, so this passthrough re-export is effectively dead. Low severity.

---

### frontend-next/src/components/EmailPreferencesSection.tsx

**Purpose:** Profile-page section letting a user toggle their email-notification preferences, hiding categories that the platform admin has globally disabled.

**What it does:**
- Locally redeclares `UserEmailPreferences` (six boolean toggles: master `emailNotificationsEnabled`, `emailPoolInvitations`, `emailDeadlineReminders`, `emailResultNotifications`, `emailPoolCompletions`, `emailNewMemberDigest`) and `PlatformEnabled` (the three admin-gateable channels) — the comment notes the local type avoids "Vite type-export issues". `PreferenceItem` describes each rendered row (key, optional `platformKey`, label, description, `isMaster`).
- `EmailPreferencesSection()` builds `preferenceItems` from translations (`profile` namespace, with `poolParams` interpolation from `usePoolTerm`).
- **State:** `preferences`, `platformEnabled`, `loading`, `saving`, `error`, `success`, plus a `successTimerRef` cleared on unmount.
- `fetchPreferences` (useCallback) loads via `getUserEmailPreferences(token)` and stores both `preferences` and the optional `platformEnabled`.
- `handleToggle(key)` performs an optimistic flip, calls `updateUserEmailPreferences`, fires the unified `trackEvent("notification_subscription_toggled", { type, enabled })`, shows a 2s success message, and reverts on error.
- **Render:** loading/error/empty fallbacks; the master toggle row always visible; `visibleItems` filters out child rows whose `platformKey` is disabled in `platformEnabled`; child rows are dimmed/disabled when the master toggle is off; a `ToggleSwitch` per row; and an info note (`hasDisabledByAdmin`) when any platform channel is off.

**Exports:** `EmailPreferencesSection` (named).

**Key dependencies:** `@/lib/theme`; `@/lib/auth` (getToken); `@/lib/analytics`; `@/lib/api` (getUserEmailPreferences, updateUserEmailPreferences); `next-intl`; `usePoolTerm`; `@/components/ui/ToggleSwitch`.

**Flags:** The locally-duplicated `UserEmailPreferences`/`PlatformEnabled` types duplicate shapes that also live in `@/lib/api` (the comment justifies it as a Vite workaround). Minor duplication, intentional. `fetchPreferences` useCallback omits `t` from its dependency array (eslint-quietened implicitly) — harmless. Otherwise none.

---

### frontend-next/src/components/EmailVerificationBanner.tsx

**Purpose:** Amber banner prompting an unverified, non-Google user to resend their verification email.

**What it does:**
- `EmailVerificationBanner({ emailVerified, isGoogleAccount, email })`. Returns `null` immediately when the email is already verified or the account is Google (Google accounts are pre-verified).
- State: `sending`, `sent`, `error`. `handleResend` reads the token, calls `resendVerificationEmail(token)`, and flips `sent` true (hiding the button) or surfaces an error.
- Renders a warning-icon banner with title/message (interpolating `email`), a success box when sent, an error box, and the resend button (hidden after success).

**Exports:** `EmailVerificationBanner` (named).

**Key dependencies:** `@/lib/theme`; `@/lib/api` (resendVerificationEmail); `@/lib/auth` (getToken); `next-intl` (`auth` namespace).

**Flags:** The error fallback string `"Error al enviar el email de verificación"` is a hardcoded Spanish literal rather than a `t()` key — only shown when the API throws without a message, but it is a minor i18n gap. Low severity.

---

### frontend-next/src/components/EnterpriseLandingContent.tsx

**Purpose:** The public `/empresas` ("Picks4All for Business") marketing landing page content — hero, benefits, how-it-works, pricing, quote CTA, and final CTA — wiring CTAs to either the corporate-pool wizard or the auth panel and opening the quote panel.

**What it does:**
- `EnterpriseLandingContent()` reads `enterprise` translations, `useRouter` (next/navigation), `useIsMobile`, `useAuth` (isAuthenticated), `useAuthPanel` (openAuthPanel), and `usePoolTerm`.
- State: `quoteOpen`, `quoteCardHovered`.
- `handleCta` fires `trackEvent("corporate_inquiry")` + `trackMetaEvent("SubmitApplication")`, then routes authenticated users to `/empresas/crear` or opens the register auth panel with that redirect target.
- `handleQuoteOpen` fires `trackEvent("corporate_quote_opened")` and opens the quote panel.
- `benefits` (4 icon/title/desc cards) and `steps` (3 numbered how-it-works items) arrays built from translations.
- **Render sections:** dark-gradient hero (badge, title/subtitle, primary CTA button, secondary anchor to `#how-it-works`, and a React-state-hovered "request a quote" card — comment explains styled-jsx was avoided because a global `button` background rule raced during hydration); benefits grid; how-it-works numbered list; a pricing card highlighting the free tier + trial badge with feature bullets (`unlimited`/`logo`/`csv`/`support`); a quote section reiterating the CTA; a final dark-gradient CTA; and the `CorporateQuotePanel` mounted with `isOpen`/`onClose`.

**Exports:** `EnterpriseLandingContent` (named).

**Key dependencies:** `@/lib/theme`; `next-intl`; `next/navigation` router; `@/hooks/useIsMobile`; `@/hooks/useAuth`; `@/contexts/AuthPanelContext`; `usePoolTerm`; `@/lib/analytics` + `@/lib/metaPixel`; `@/components/CorporateQuotePanel`.

**Flags:** none.

---

### frontend-next/src/components/FAQAccordion.tsx

**Purpose:** Client-side FAQ widget with category filter chips and accordion expand/collapse, fed pre-translated FAQ items by its parent page.

**What it does:**
- `FAQItem` ({question, answer, category}) and `FAQAccordionProps` ({faqData}).
- `FAQAccordion({ faqData })` keeps `openIndex` and `selectedCategory` (default `"Todos"`). `categories` is `"Todos"` plus the distinct categories. `filteredFAQ` filters by category.
- Renders a centred row of category filter buttons (active one uses `colors.brandGradient`; clicking resets `openIndex`), then the FAQ list — each item is a card with a question button (`aria-expanded`, rotating chevron) that toggles its answer panel by its `globalIndex` (looked up via `faqData.indexOf` so filtering keeps stable indices). Keys use `category-question.slice(0,40)`.

**Exports:** `FAQAccordion` (named).

**Key dependencies:** `@/lib/theme` (colors).

**Flags:** The sentinel category label `"Todos"` is a hardcoded Spanish string used both as the literal default state and in comparisons — it is not localized (EN/PT users see "Todos"). This violates the i18n standard. Medium confidence as a deliberate-but-unlocalized choice; flagged as a real i18n gap.

---

### frontend-next/src/components/FeedbackModal.tsx

**Purpose:** Modal letting users submit a BUG or SUGGESTION with an optional screenshot and optional contact details.

**What it does:**
- `FeedbackModal({ type: initialType = "BUG", onClose })`.
- State: `type` (BUG|SUGGESTION), `message`, `imageBase64` + `imagePreview`, `wantsContact` + `contactName` + `phoneNumber`, `status` (idle|loading|success|error), `errorMsg`, and `fileInputRef`.
- `resetForm`/`handleClose` clear all fields. `title`/`placeholder` switch on type.
- `handleImageChange` rejects files >500KB, otherwise reads the file as a data URL into preview and strips the base64 prefix for upload.
- `handleSubmit` enforces a >=10-char message, calls `submitFeedback(type, message, imageBase64?, wantsContact, contactName?, phoneNumber?)`, then fires `trackEvent("feedback_submitted")` + `trackMetaCustomEvent("FeedbackSubmitted")` and flips to success.
- **Render:** full-screen overlay (click-outside closes) with a centred card. Success view shows a bug/bulb emoji and a close button. Form view: a type toggle (BUG/SUGGESTION), the message textarea with a `length/2000` counter, a hidden file input with a styled trigger + image preview (with a remove "X" button), a "contact me" checkbox revealing name/phone inputs, an error box, and Cancel/Send actions (Send disabled until >=10 chars; coloured red for BUG, green for SUGGESTION).

**Exports:** `FeedbackModal` (named).

**Key dependencies:** `@/lib/theme`; `next-intl` (`feedback` namespace); `@/hooks/useIsMobile`; `@/lib/api` (submitFeedback); `@/lib/analytics`; `@/lib/metaPixel`.

**Flags:** The `500_000` byte image limit and `2000` character counter are inline magic numbers (the 2000 counter text is partly hardcoded `/2000`). Minor — would ideally come from `LIMITS`. The `<img>` `alt="Preview"` is a hardcoded non-localized string. Low severity.

---

### frontend-next/src/components/Footer.tsx

**Purpose:** Global site footer — brand/disclaimer, legal links, an "Explore" link cluster (including the single-locale regional SEO pages), contact email, and the pool-terminology region selector.

**What it does:**
- `REGION_OPTIONS` maps each `PoolRegion` (quiniela/polla/prode/penca/porra) to a flag emoji + label for the region `<select>`.
- `Footer()` reads `footer` translations, `usePoolTerm` (params/region/setRegion), and computes `currentYear`.
- **Render:** brand block (`BrandIsotipo` + name + interpolated tagline/disclaimer); a legal column (`/terminos`, `/privacidad`, `/precios`, `/reembolsos`, plus a "manage cookies" button calling `openCookieConsent` — comment cites GDPR/CCPA revocation parity); an "Explore" column mixing next-intl `Link` (locale-aware: world-cup, how-it-works, faq, what-is-quiniela, enterprises) with plain `next/link` `NextLink` for the single-locale canonical regional pages (`/polla-futbolera`, `/prode-deportivo`, `/penca-futbol`, `/porra-deportiva`, `/en/football-pool`) — a detailed comment explains why plain Link avoids the `/es/...` 307-redirect/canonical problem; a contact column with a `mailto:` to the localized support email and the region selector wired to `setRegion`; and a copyright bar with the current year.

**Exports:** `Footer` (named).

**Key dependencies:** `next-intl` (`footer` namespace); `@/i18n/navigation` Link + plain `next/link`; `./BrandLogo` (BrandIsotipo); `./CookieConsent` (openCookieConsent); `usePoolTerm`; `@/lib/poolTerms` (PoolRegion type).

**Flags:** none — the mixed `Link`/`NextLink` usage is intentional and documented.

---

### frontend-next/src/components/groupStandings/BreakdownModal.tsx

**Purpose:** Read-only modal showing how a player's group-standings prediction scored against the official table for one group (Estratega mode).

**What it does:**
- `BreakdownModal({ groupName, breakdownData, loadingBreakdown, isMobile, onClose, t })`.
- Overlay (bottom-sheet on mobile, centred on desktop; click-outside closes) with a gradient header (title + close button) and a scrollable body.
- Body states: loading text; otherwise, when `breakdownData` exists — a summary card whose gradient colour reflects perfect/partial/zero score (`totalPointsEarned`/`totalPointsMax`), a config-info strip (`pointsPerExactPosition` and optional `bonusPerfectGroup`), a "no prediction" empty state when `!hasPick`, and (when `hasPick && hasResult`) a list of position rows — each showing position, team name, a "your position" note when the predicted slot differs, a check/cross matched indicator, and `+pointsEarned`. A trailing perfect-group bonus row appears when `bonusPerfectGroup.enabled`, styled by `achieved`.

**Exports:** `BreakdownModal` (named).

**Key dependencies:** `@/lib/theme` (colors); `../../lib/api` (GroupSingleBreakdown type); `../../hooks/useIsMobile` (TOUCH_TARGET, mobileInteractiveStyles).

**Flags:** `t: any` prop typing — translations are passed down from the parent rather than re-resolved with `useTranslations` here. Acceptable boundary `any`, but slightly looser than the rest of the family. None blocking.

---

### frontend-next/src/components/groupStandings/ClassicStandingsTable.tsx

**Purpose:** Renders a classic FIFA-style group standings table (Pos/Team/PJ/G/E/P/GF/GC/DG/Pts), supporting partial/complete states and host-override row ordering.

**What it does:**
- `ClassicStandingsTableProps`: `teams`, `standings` (TeamStandingRow[]), `completedMatches`, `totalMatches`, optional `publishedOrder`/`publishedReason` (host override), `isMobile`.
- `ClassicStandingsTable` builds `teamMap` and `standingsByTeamId` (useMemo). It computes the `naturalOrder` (by `position`) and detects `overrideActive` when a `publishedOrder` of equal length diverges from natural order; `rowOrder` follows the override when active.
- `isPartial`/`isEmpty` derive from match counts. A status banner shows pending/partial/complete text and, when overridden, an amber "★ overridden" badge (with the host's reason as a `title` tooltip).
- The table renders horizontally-scrollable on mobile (`minWidth` 380); each row highlights the top two positions (qualification zone) in green and renders all stats columns, formatting goal difference via `formatGoalDifference` (prefixes `+` for positives).
- Local helpers `Th` (uppercase header cell with optional width/title) and `Td` (body cell, optional tabular-nums mono) and `formatGoalDifference`.

**Exports:** `ClassicStandingsTable` (named) and `ClassicStandingsTableProps` (type).

**Key dependencies:** `next-intl` (`pool` namespace); `@/lib/theme`; `./types` (Team); `../../lib/api` (TeamStandingRow).

**Flags:** none.

---

### frontend-next/src/components/groupStandings/GroupStandingsCard.tsx

**Purpose:** The full Estratega GROUP_STANDINGS card for one group — a player drags teams to predict final order, sees the scraper-published official table, and (host only) can override the published order with a mandatory reason. This is the real implementation behind the top-level barrel.

**What it does:**
- Large header comment documents the source-of-truth pipeline (liveScoresJob → autoPublishStructuralResults upserts `GroupStandingsResult`; host never publishes manually, only overrides) — consistent with CLAUDE invariant 8.
- `GroupStandingsCardProps`: poolId, phaseId, groupId, groupName, teams, matches, token, isHost, isLocked.
- **State:** player pick (`playerPick`, `playerPickSaved`, `isEditingPick`, `savingPick`); `stats` (`GroupStandingsStats` from backend with live + published data); host override (`isOverriding`, `overrideOrder`, `overrideReason`, `savingOverride`); UI (`loading`, `error`, `successMessage` with a cleared `successTimerRef`); breakdown modal (`showBreakdown`, `breakdownData`, `loadingBreakdown`).
- `loadData` (on poolId/phaseId/groupId change) loads the player's existing pick (or seeds the editable list with the team order) and the live `getGroupStandingsStats`.
- `handleSavePlayerPick` (saveGroupStandingsPick), `handleEnterOverride`/`handleCancelOverride` (seed/reset override from `publishedTeamIds`), `handleSaveOverride` (requires a reason, calls `publishGroupStandingsResult`, then refreshes stats), and `handleShowBreakdown` (getGroupBreakdown).
- **Render:** loading fallback; otherwise a two-column grid. Left = player prediction: editable `DraggableTeamList` + save button, or a saved-state green banner + `StaticTeamList` + edit button (both gated by `!isLocked`). Right = the official side: when overriding, an amber drag-and-drop panel with a post-advance warning (when `isLocked`), reason input, warning text, and cancel/save buttons; otherwise the `ClassicStandingsTable` (passing publishedOrder/publishedReason) plus a host-only "override" button shown when an official table exists (comment notes override stays available even post-advance). A breakdown button (when published), error/success message strips, and the `BreakdownModal` round out the card.
- Re-exports the `Team`/`Match`/`TeamStanding` types from `./types`.

**Exports:** `GroupStandingsCard` (named); re-exported types `Team`, `Match`, `TeamStanding`.

**Key dependencies:** `next-intl` (`pool`); `@/lib/theme`; `../../lib/api` (saveGroupStandingsPick, getGroupStandingsPick, getGroupStandingsStats, publishGroupStandingsResult, getGroupBreakdown + types GroupSingleBreakdown/GroupStandingsStats); `../../hooks/useIsMobile`; `./types`; `./BreakdownModal`; `./TeamListComponents` (StaticTeamList, DraggableTeamList); `./ClassicStandingsTable`.

**Flags:** The `matches` prop is declared in `GroupStandingsCardProps` and the `Match` type is imported/re-exported, but `matches` is NOT destructured or used inside the component body (the official table comes from `stats`, not the matches prop). Likely a leftover from the pre-scraper manual-input iteration. Medium confidence — an unused-prop/dead parameter.

---

### frontend-next/src/components/groupStandings/MatchInputForm.tsx

**Purpose:** A manual per-match score-entry form (home/away goals with save buttons) plus a "generate standings" action — the legacy host-driven way to populate a group table before the scraper-first pipeline.

**What it does:**
- `MatchInputFormProps`: matches, teamMap, `matchResults` map (homeGoals/awayGoals/saved/existsInDb per match), `savingMatch`, `allMatchesSaved`, `generatingStandings`, `savedMatchCount`, and callbacks `onSaveMatchResult`/`onUpdateMatchResult`/`onGenerateStandings`, plus `isMobile`, `t`.
- `MatchInputForm` renders a saved/total counter, then one row per match (home code, two number inputs separated by a dash, away code, and a save button that shows `...`/`✓`/`OK` by state; save disabled until both goals entered). When `allMatchesSaved`, shows a "generate standings" button.

**Exports:** `MatchInputForm` (named).

**Key dependencies:** `@/lib/theme`; `./types` (Match, Team); `../../hooks/useIsMobile`.

**Flags:** Dead code — `MatchInputForm` is defined but imported by no file in the repo (confirmed via search). It is the manual-entry UI superseded by the scraper-first `autoPublishStructuralResults` pipeline that `GroupStandingsCard` now relies on (per CLAUDE invariant 8). High confidence orphan/dead component.

---

### frontend-next/src/components/groupStandings/TeamListComponents.tsx

**Purpose:** Shared team-ordering list widgets used by the Estratega card: a read-only medal list and a drag-and-drop reorderable list (with mobile-tuned dnd-kit sensors).

**What it does:**
- `MEDALS` constant (🥇🥈🥉 + empty for 4th).
- `StaticTeamList({ teams, orderedTeamIds, isMobile })` — read-only rows showing medal + rank number + localized team name (`getTeamName`).
- `DraggableTeamList({ teams, orderedTeamIds, onOrderChange, disabled, isMobile })` — wraps dnd-kit `DndContext`/`SortableContext`. Configures three sensors (PointerSensor with 5px distance, TouchSensor with 200ms press-and-hold — comment explains mobile reorder was broken without it, KeyboardSensor for a11y). `handleDragEnd` computes the new order via `arrayMove` and calls `onOrderChange` synchronously (comment explains a prior `setTimeout(...,0)` caused a visible snap-back). Adds a right-side scroll gutter on mobile so the page can still scroll past the touch-blocking rows.
- `SortableTeamItem` — the per-row sortable using `useSortable` with a snappier 160ms transition, `CSS.Translate` (avoids scale snap), `touchAction: none` while draggable, medal/rank/name, and a `⋮⋮` drag-handle affordance (bigger on mobile).

**Exports:** `MEDALS`, `StaticTeamList`, `DraggableTeamList` (named). `SortableTeamItem` is module-private.

**Key dependencies:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; `@/lib/theme`; `./types` (Team); `../../hooks/useIsMobile`; `next-intl` (`teams`); `getTeamName` from the pool page's `poolHelpers`.

**Flags:** `StaticTeamList` declares an `isOfficial?` prop in its signature that is never read in the body. Minor unused-prop. Low severity.

---

### frontend-next/src/components/groupStandings/types.ts

**Purpose:** Shared local TypeScript types for the groupStandings component family.

**What it does:** Declares `Team` ({id, name, code?, flag?}), `Match` ({id, homeTeamId, awayTeamId, kickoffUtc}), and `TeamStanding` ({teamId, position, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points}).

**Exports:** types `Team`, `Match`, `TeamStanding`.

**Key dependencies:** none.

**Flags:** `TeamStanding` appears to be unused by the current component code (`ClassicStandingsTable` uses `TeamStandingRow` from `@/lib/api`, not this local `TeamStanding`); it is only re-exported through `GroupStandingsCard`. Possible stale type left from the manual-entry era. Low/medium confidence.

---

### frontend-next/src/components/GroupStandingsCard.tsx

**Purpose:** Thin barrel/compatibility re-export so importers can use `@/components/GroupStandingsCard` while the real implementation lives in the `groupStandings/` subfolder.

**What it does:** Re-exports `GroupStandingsCard` from `./groupStandings/GroupStandingsCard`.

**Exports:** `GroupStandingsCard` (named, re-exported).

**Key dependencies:** `./groupStandings/GroupStandingsCard`.

**Flags:** none (pure barrel).

---

### frontend-next/src/components/JsonLd.tsx

**Purpose:** Renders a JSON-LD structured-data `<script>` as raw HTML so Next.js does not duplicate it in the RSC payload (per the project's documented JSON-LD pattern).

**What it does:** `JsonLd({ data })` returns a `hidden` `<div>` whose `dangerouslySetInnerHTML` contains a `<script type="application/ld+json">` with `JSON.stringify(data)` and `<` escaped to `<` to prevent script-injection/early-tag-close. Because the inner script is a string (not a React element), it is not serialized into the RSC payload.

**Exports:** `JsonLd` (named); `JsonLdProps` interface is local (not exported).

**Key dependencies:** none.

**Flags:** `data: Record<string, any>` is an acceptable boundary `any` for arbitrary schema.org payloads. None.
