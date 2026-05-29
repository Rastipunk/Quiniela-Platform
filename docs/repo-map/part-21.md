## Batch 21

This batch covers two legacy phase-configuration / rules-display / player-summary components and the entire `pool-wizard` family (the modern multi-step pool creation flow for both standard and corporate pools, plus its context, navigation chrome, and individual step components).

---

### frontend-next/src/components/PhaseConfigStep.tsx

**Purpose:** Step 2 of an older "Advanced Pick Types" configuration flow (Sprint 2). Lets a host, phase-by-phase, decide whether a phase requires score predictions (match picks) or structural picks (group standings / knockout winner), and tune the points for each.

**What it does:**
- `PhaseConfigStep` (exported) — main component. Receives `phases: PhasePickConfig[]`, a `phaseTypes` Map (phaseId → `"GROUP" | "KNOCKOUT"`), `onPhasesChange`, `onNext`, and `isMobile`. Holds `currentPhaseIndex` local state to walk through phases one at a time. Renders a sticky progress header (`formatPhaseFullName` + `index/length` + a brand progress bar), a "fundamental decision" pair of `DecisionCard`s (with scores vs without scores), and then either `MatchPicksConfiguration` or `StructuralPicksConfiguration`, plus Previous/Next navigation.
  - `handleRequiresScoreChange(requiresScore)` — when toggling to scores it seeds `matchPicks.types` via `getDefaultMatchPickTypes()`; when toggling off it builds a `structuralPickConfig` whose shape depends on `currentPhaseType`: `GROUP_STANDINGS` (pointsPosition1-4 = 10, bonusPerfectGroupEnabled=true, bonusPerfectGroup=20) for GROUP phases, or `KNOCKOUT_WINNER` (pointsPerCorrectAdvance=15) otherwise.
  - `handleMatchPickTypeChange(typeKey, enabled, points?)` — finds the type in `matchPicks.types` and immutably updates its `enabled`/`points`.
  - `handleStructuralConfigChange(newConfig)` — merges a partial config object into `structuralPicks.config`.
  - `handleNext`/`handlePrevious` — advance/retreat through phases; on the last phase `handleNext` calls `onNext()`.
- `DecisionCard` — clickable selectable card (border/background change on selection, hover highlight) used for the score-vs-no-score choice.
- `MatchPicksConfiguration` — renders one `PickTypeCard` per enabled-able pick type, filtering out `MATCH_OUTCOME_90MIN`. Uses a `tpDynamic` cast to build computed translation keys (`pickTypeExtended.<key>.title/description/shortDesc/example`).
- `StructuralPicksConfiguration` — for GROUP phases renders four numeric position-point inputs (🥇🥈🥉4️⃣), a "perfect group" bonus toggle + amount, and a dynamic example total; for knockout phases renders a single `pointsPerCorrectAdvance` input plus an example. Uses `tp.rich` for the bonus example.
- `PickTypeCard` — per-pick-type card with checkbox, points number input, and (mobile) an expandable example toggle. Has a distinct compact mobile layout and a richer desktop layout.
- `getDefaultMatchPickTypes()` — returns the default 5 types: EXACT_SCORE (enabled, 20), GOAL_DIFFERENCE (10), PARTIAL_SCORE (8), TOTAL_GOALS (5), MATCH_OUTCOME_90MIN (0).

**Exports:** `PhaseConfigStep` (named).

**Key dependencies:** `@/lib/theme` (`colors`), `next-intl` `useTranslations("pool")`, types from `../types/pickConfig` (`PhasePickConfig`, `MatchPickType`, `MatchPickTypeKey`), `formatPhaseFullName` from the pool page `poolHelpers`.

**Flags:** Appears to be part of the **older, pre-wizard pick-config flow** — superseded by the `pool-wizard` `StepScoring` + `ScoringEditor` path documented below. `StructuralPicksConfiguration` is typed with `structuralPicks: any` (boundary `any`). No importer was confirmed within this batch; likely a legacy/standalone wizard step. Medium-confidence dead/legacy candidate.

---

### frontend-next/src/components/PickRulesDisplay.tsx

**Purpose:** Read-only display of a pool's configured scoring rules (per phase) shown on the Pool page — the player-facing "how points are earned" rules panel.

**What it does:**
- `PickRulesDisplay` (exported) — takes `pickTypesConfig: PoolPickTypesConfig`, `poolDeadlineMinutes`, `poolTimeZone`. Guards that the config is an array (else shows `configNoRules`). Renders a gradient header, then one card per phase:
  - **Score phases** (`requiresScore && matchPicks`): a "match scores" badge, then for each enabled type a row showing points + translated `pickTypeNames.<key>` and `pickTypeDescriptions.<key>`, plus a deadline/timezone warning box.
  - **Structural phases** (`structuralPicks`): a "no scores" badge then a type-specific block:
    - `GROUP_STANDINGS` — supports both new format (`pointsPosition1-4`) and legacy (`pointsPerExactPosition`), bonus-perfect-group (new + legacy), and global-qualifiers extra.
    - `GLOBAL_QUALIFIERS` — total qualifiers + points per exact position + a lock-date warning (`new Date(lockDateTime).toLocaleString()`).
    - `KNOCKOUT_WINNER` — points per correct advance + a note.
  - A general-notes footer that switches between a "cumulative system" callout and a "non-cumulative" note depending on `isCumulativeScoringFromConfig`, plus a deadline note.
- `StructuralConfig` interface — local typed view of the structural config blob (lockDateTime, pointsPosition1-4, pointsPerExactPosition, bonus fields, global-qualifier fields, pointsPerCorrectAdvance, index signature).
- `isCumulativeScoring(types)` — true if any enabled type key is `HOME_GOALS` or `AWAY_GOALS`.
- `isCumulativeScoringFromConfig(config)` — true if any score phase uses cumulative scoring.

**Exports:** `PickRulesDisplay` (named).

**Key dependencies:** `next-intl`, `@/lib/theme`, type `PoolPickTypesConfig` from `../types/pickConfig`, `formatPhaseFullName`.

**Flags:** Carries explicit legacy-format support (`pointsPerExactPosition`, `GLOBAL_QUALIFIERS`) for backwards compatibility with old pool configs. The `bonusPerfectGroupEnabled ?? bonusPerfectGroup` guard is awkward but intentional dual-format handling. None critical.

---

### frontend-next/src/components/PlayerSummary.tsx

**Purpose:** Detailed per-player points breakdown shown in a modal — header stats, four summary cards, and per-phase accordions (score phases as pick/result grids, structural phases delegated to `PlayerSummaryStructural`). Renders MIXED pools in fixture order.

**What it does:**
- `PlayerSummary` (exported) — main component. Props: `poolId`, `userId`, `tournamentKey` (default `"wc_2026_sandbox"`), `initialPhase`, `onClose`. Fetches data via `getPlayerSummary(token, poolId, userId)` in an effect; renders loading/error/empty states. Computes:
  - `totalScored` / `totalMaxPoints` — aggregates over score phases only (backend strips structural phases from `data.phases`).
  - `showStructuralCards` — true when `structuralStats.totalGroups > 0`; controls whether cards 3 & 4 show "positions correct" / "perfect groups" vs "scored matches" / "effectiveness %".
  - `phaseItems` — a unified, `phaseOrder`-sorted list interleaving SCORE phases (from `data.phases`) and STRUCTURAL phases (from `structuralBreakdown.phases`) so MIXED pools render in tournament sequence.
  - Renders player header (rank medal emoji, name/role/total), four stat cards, an "only deadline passed" note when viewing another player, then maps `phaseItems` to either `PhaseSection` (score) or `StructuralPhaseSection` (structural), and an optional close button (mobile touch sizing).
- `BreakdownPopover` — click-outside-dismissable popover listing matched breakdown rows (colored dot per type, translated label via `typeTranslationKeys`, `+points`).
- `MatchRow` — single fixture row using `display:contents` to share the parent grid; columns: home team (`TeamFlag`), "vs", away team, my pick, official result, points/status. Points cell opens `BreakdownPopover` when SCORED with hits.
- `PhaseSection` — collapsible score-phase accordion; header shows phase name, scored/total, total points, success-rate %. Expanded body is a 6-column grid (scrollable on mobile) with a header row and `MatchRow`s.
- Module constants: `GRID_TEMPLATE` / `GRID_TEMPLATE_MOBILE`, `typeTranslationKeys` (pick-type → i18n key), `typeColors`, `statusColors`, `statusTranslationKeys`.

**Exports:** `PlayerSummary` (named).

**Key dependencies:** `getPlayerSummary` + types from `../lib/api`, `getToken` from `../lib/auth`, `TeamFlag`, `useIsMobile`/`TOUCH_TARGET`/`mobileInteractiveStyles`, `@/lib/theme`, `StructuralPhaseSection` from `./PlayerSummaryStructural`, `formatPhaseFullName`.

**Flags:** none.

---

### frontend-next/src/components/PlayerSummaryStructural.tsx

**Purpose:** Estratega/structural-specific blocks for the PlayerSummary modal — replaces score-based Pick/Result columns (meaningless in SIMPLE-preset pools) with group-order comparisons and knockout-winner comparisons where only team ORDER and WINNER matter.

**What it does:**
- `StructuralPhaseSection` (exported) — collapsible phase block. Builds a `subtitle` from counters (group: positions correct/total + perfect groups/total; knockout: winners correct/total), filters `groups`/`knockoutMatches` by `phaseId`, and renders either `GroupOrderComparison`s or `KnockoutMatchComparison`s (or an `EmptyMsg`). Header matches `PhaseSection`'s look (expand caret, name, subtitle, points).
- `GroupOrderComparison` — side-by-side table for one group: Pos / your prediction / actual / ✓✗, with a "perfect group" amber badge, points, positions-hit counter. Hides the prediction column and shows a "prediction hidden" state when `isPredictionVisible` is false (opponent before deadline). Uses `TeamFlag` per cell.
- `KnockoutMatchComparison` — one card per match: HOME vs AWAY matchup, your pick winner badge, actual winner badge, and a result label (`✓ +points` / `✗ 0` / no-pick / hidden / upcoming).
- `HeaderCell`, `Cell`, `EmptyMsg` — small presentational helpers.
- Color constants: `OK_GREEN`, `MISS_RED`, `PERFECT_AMBER`.

**Exports:** `StructuralPhaseSection` (named). The comparison sub-components are module-private.

**Key dependencies:** `next-intl` (`pool.playerSummaryView`), `@/lib/theme`, `TeamFlag`, `TOUCH_TARGET`/`mobileInteractiveStyles`, types `StructuralGroupDetail`/`StructuralKnockoutDetail` from `../lib/api/scoring`.

**Flags:** none.

---

### frontend-next/src/components/pool-wizard/ColorField.tsx

**Purpose:** Single-color picker field (clickable swatch + `react-colorful` popover + synced hex text input) used for corporate brand color selection. Empty value means "no override / use platform default".

**What it does:**
- `ColorField` (exported) — props `label`, `value`, `onChange`, `fallback`, `ariaLabel`. Local state `open` (popover) and `hexDraft` (text input). Effects keep the draft synced with parent `value` and close the popover on outside `mousedown`/`touchstart`. `handleHexInput` normalizes raw input (prepends `#`, validates via `isValidHex`, commits lowercased; empty string commits `""`). Swatch shows the picked color or the fallback at 55% opacity (the "default" state). Renders the swatch button, the hex `<input>` (snaps back to committed value on blur if invalid), and the `HexColorPicker` popover.

**Exports:** `ColorField` (named).

**Key dependencies:** `react-colorful` (`HexColorPicker`), `@/lib/theme`, `isValidHex` from `@/lib/brandColors`.

**Flags:** none.

---

### frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx

**Purpose:** The top-level multi-step pool creation wizard (default export), supporting both `standard` and `corporate` modes. Wires the wizard context, renders the current step (code-split), and owns the submit → create-pool → optional-payment-checkout flow.

**What it does:**
- Lazy-imports the six step components (`StepCompanyInfo`, `StepTournament`, `StepNameDetails`, `StepScoring`, `StepCapacity`, `StepSummary`) with `React.lazy` + `Suspense` (`StepLoader` fallback).
- `WizardInner` — consumes `useWizard()`; holds `submitBusy`. `handleSubmit(capacityOverride?)`:
  - Corporate mode → `createCorporatePool` with company/branding fields + pool config; standard mode → `createPool`. Extracts `poolId`.
  - Clears the draft, fires analytics: `trackEvent("pool_created")`, `trackMetaCustomEvent("PoolCreated")`, fire-and-forget `refreshUserProperties()`.
  - **Payment gate:** if `effectiveCapacity > freeLimit` (free limit = `CORPORATE_FREE_LIMIT` or `PERSONAL_FREE_LIMIT`), detects country via `getPaymentCountry()`; Colombia → `createMpCheckout` (Mercado Pago Brick) building a `/pago/checkout` URL with publicKey/amount/paymentId/reference/preferenceId/capacities; rest of world → `createCheckout` (Polar) redirect. Fires `trackBeginCheckout` + Meta `InitiateCheckout`, beacons `REDIRECT_INITIATED`/`REDIRECT_FAILED` via `reportPaymentAttemptEvent` (telemetry F-13), then `window.location.href` redirect. Checkout failures dispatch a styled error banner (the pool is already created, capped at the free tier until webhook confirms).
  - Non-paid → `router.push('/pools/${poolId}')`.
  - Top-level catch parses `ApiError.payload.details.fieldErrors/formErrors` (Zod `.flatten()`) into a human-readable banner message.
  - Renders: back-to-dashboard link, `PoolWizardProgressBar`, dismissible error alert banner, the `Suspense`-wrapped current step, and a sticky `PoolWizardNavButtons` footer (hidden on the CAPACITY step which renders its own CTA). Corporate mode uses a "Crear Pool Corporativo" submit label.
- `PoolCreationWizard` (default export) — resolves `mode` by priority: explicit `mode` prop → `?mode=corporate` search param → `"standard"`; wraps `WizardInner` in `PoolWizardProvider`.

**Exports:** default `PoolCreationWizard`.

**Key dependencies:** `PoolWizardContext` (`PoolWizardProvider`, `useWizard`, `clearWizardDraft`), `PoolWizardProgressBar`, `PoolWizardNavButtons`, API: `createPool`, `createCorporatePool`, `createCheckout`/`createMpCheckout`/`getPaymentCountry`, `reportPaymentAttemptEvent`; analytics: `trackEvent`, `refreshUserProperties`, `trackMetaCustomEvent`/`trackMetaEvent`, `trackBeginCheckout`; `PERSONAL_FREE_LIMIT`/`CORPORATE_FREE_LIMIT` from `@/lib/pricing`; `useAuth`, `useIsMobile`, `next-intl`.

**Flags:** Uses `t(key, { defaultMessage })` extensively — per project memory (`feedback_nextintl_no_fallback`), next-intl v4 `defaultMessage` is NOT a fallback and renders the literal key if the key is missing; these keys must exist in the message JSON. Worth verifying `poolWizard.nav.errorTitle`, `nav.dismissError`, `backToDashboard`, `checkoutFailedFallback`, `errorCreatingPool` exist in es/en/pt. Otherwise clean.

---

### frontend-next/src/components/pool-wizard/PoolWizardContext.tsx

**Purpose:** React context + reducer for the pool wizard: holds all wizard state, validates each step, persists a draft to localStorage, and exposes navigation helpers.

**What it does:**
- `getInitialState(mode)` — builds the initial `WizardState`. First step is `TOURNAMENT` (standard) or `COMPANY_INFO` (corporate); defaults include `invitationLocale: "es"`, auto-detected `timeZone` (falls back to `America/Bogota` on server), `deadlineMinutesBeforeKickoff: RECOMMENDED_DEADLINE`, and `maxParticipants` = `DEFAULT_MAX_PARTICIPANTS_STANDARD`/`_CORPORATE`.
- `wizardReducer(state, action)` — handles `GO_TO_STEP` (clears error), `SET_FIELD`, `SET_TOURNAMENT` (resets phases + scoring on tournament change), `SET_PHASES`, `SET_SCORING`, `UPDATE_SCORING_CONFIG`, `RESTORE` (merges a saved draft; if the restored `currentStep` is no longer valid for the mode — e.g. removed `ADVANCED_RULES` — it falls back to `SCORING`), and `RESET`.
- `validateStep(state)` — per-step gating: COMPANY_INFO (companyName ≥ 2), TOURNAMENT (instanceId set + phasesLoaded), NAME_DETAILS (poolName ≥ 3), SCORING (scoringStyle set + config non-empty), CAPACITY (maxParticipants ≥ 2), SUMMARY (always true).
- **localStorage persistence:** `STORAGE_KEY = "p4a_pool_wizard_draft"`; `saveDraft` (strips error/busy), `loadDraft`, and a module-level `_draftCleared` flag + exported `clearWizardDraft()` (removes the draft and suppresses the next auto-save/restore — used after successful pool creation).
- `PoolWizardProvider` — initializes the reducer, computes `steps` (CORPORATE_STEPS / STANDARD_STEPS), `currentStepIndex`, `canGoNext`, first/last flags. Effects auto-save the draft on changes (only once meaningful data exists) and restore a matching-mode draft on mount. `goNext`/`goBack`/`goToStep` callbacks (goToStep only allows jumping back to ≤ current). Provides the full `WizardContextValue`.
- `useWizard()` — context hook that throws if used outside the provider.

**Exports:** `PoolWizardProvider`, `useWizard`, `clearWizardDraft` (named).

**Key dependencies:** types + constants from `../../types/poolWizard` (`WizardState`, `WizardAction`, `WizardStep`, `WizardMode`, `STANDARD_STEPS`, `CORPORATE_STEPS`, `RECOMMENDED_DEADLINE`, `DEFAULT_MAX_PARTICIPANTS_*`).

**Flags:** `RESET` action is implemented but no consumer was observed within this batch (likely used elsewhere). The `RESTORE` fallback explicitly references the now-removed `ADVANCED_RULES` step, confirming `StepAdvancedRules` is no longer part of the active step sequence (see below). Low-confidence dead-action flag on `RESET`.

---

### frontend-next/src/components/pool-wizard/PoolWizardNavButtons.tsx

**Purpose:** Back / Next / Submit footer button row for the wizard, driven by context.

**What it does:**
- `PoolWizardNavButtons` — props `onSubmit?`, `submitLabel?`, `submitBusy?`. Reads `canGoNext`, `goNext`, `goBack`, `isFirstStep`, `isLastStep`, `state` from `useWizard()`. Renders a Back button (hidden on first step, replaced by a spacer `<div/>`), and on the last step (when `onSubmit` is provided) a Submit button (disabled while busy or invalid, shows "Creando..." when busy); otherwise a Next button that fires `trackEvent("wizard_step", { step_name, mode })` then `goNext()`. Mobile uses larger touch padding and flexes buttons full width.

**Exports:** `PoolWizardNavButtons` (named).

**Key dependencies:** `useWizard`, `next-intl`, `@/lib/theme`, `useIsMobile`, `trackEvent`.

**Flags:** Uses `t(key, { defaultMessage })` (same next-intl caveat as above). None otherwise.

---

### frontend-next/src/components/pool-wizard/PoolWizardProgressBar.tsx

**Purpose:** Horizontal step indicator (dots + connector lines + labels) for the wizard; completed steps are clickable to jump back.

**What it does:**
- `STEP_ICONS` — maps every `WizardStep` (including `ADVANCED_RULES`) to an emoji.
- `PoolWizardProgressBar` — reads `steps`, `currentStepIndex`, `goToStep`. For each step renders a circular dot (brand when current, success when completed showing ✓, muted otherwise) as a button that is clickable only for completed steps (`i < currentStepIndex`), an `t("steps.<step>")` label (desktop only), and a connector line whose color reflects completion. Mobile shrinks dot/label sizes.

**Exports:** `PoolWizardProgressBar` (named).

**Key dependencies:** `useWizard`, `next-intl`, `@/lib/theme`, `useIsMobile`, `WizardStep` type.

**Flags:** `STEP_ICONS` still includes an `ADVANCED_RULES` entry even though that step is no longer in the active step arrays — harmless leftover. Low confidence.

---

### frontend-next/src/components/pool-wizard/PoolWizardStepContainer.tsx

**Purpose:** Presentational shell for every wizard step — centered header (icon/title/subtitle) plus a white rounded content card.

**What it does:**
- `PoolWizardStepContainer` — props `title`, `subtitle?`, `icon?`, `children`. Renders a max-width 720 centered column with a centered header (optional 36px emoji, h2 title, optional subtitle) and a bordered white rounded card wrapping `children`. Mobile reduces paddings/font sizes.

**Exports:** `PoolWizardStepContainer` (named).

**Key dependencies:** `@/lib/theme`, `useIsMobile`.

**Flags:** none.

---

### frontend-next/src/components/pool-wizard/steps/corporate/StepCompanyInfo.tsx

**Purpose:** Corporate-only first wizard step — collects company name, logo, brand colors, welcome message, invitation message, and invitation locale, with live previews of the header / welcome splash / invitation email.

**What it does:**
- `StepCompanyInfo` (exported) — six numbered `WizardSubStep`s:
  1. **Company name** — text input (≤100 chars, required, min 2 with inline error).
  2. **Logo upload** — `handleLogoChange` validates size (≤500KB `MAX_LOGO_SIZE`) and MIME against `ALLOWED_LOGO_TYPES` (PNG/JPEG/GIF/WebP — SVG intentionally excluded because email clients strip it and it can carry scripts; kept in sync with the backend Zod regex). Reads the file as a base64 data URL into `state.logoBase64`. `removeLogo` clears it. Shows a preview thumbnail or a dashed upload dropzone.
  3. **Brand colors** — `BrandColorsSection` with two `ColorField`s (primary/secondary), a "reset to default" button, a live `HeaderPreview`, and a contrast warning (`hasGoodContrastAgainstWhite`) shown only when custom colors are chosen.
  4. **Welcome message** — textarea (≤500, char counter) + live `WelcomeSplashPreview`.
  5. **Invitation message** — textarea (≤500, char counter) + live `InvitationEmailPreview` (locale-aware).
  6. **Invitation locale** — `InvitationLocalePicker` (es/en/pt) governing only the first invitation email (ADR-062).
- `InvitationLocalePicker` — three pill buttons using native language names + a short-code pill (deliberately NOT emoji flags, which render as letter codes on Windows). `LOCALE_OPTIONS` defines es/en/pt.
- `BrandColorsSection` — resolves colors via `resolveBrandColors`, computes `showContrastWarning`/`hasOverride`, renders the two color fields, reset button, header preview, and warning.

**Exports:** `StepCompanyInfo` (named). Module constants `MAX_LOGO_SIZE`, `ALLOWED_LOGO_TYPES`, `LOGO_ACCEPT_ATTR` are private.

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `WizardSubStep`, `ColorField`, branding previews (`HeaderPreview`, `WelcomeSplashPreview`, `InvitationEmailPreview`), `@/lib/brandColors` (`PICKS4ALL_DEFAULT_PRIMARY/SECONDARY`, `hasGoodContrastAgainstWhite`, `resolveBrandColors`), `@/lib/theme`, `useIsMobile`.

**Flags:** Uses `t(key, { defaultMessage })` heavily (next-intl caveat — keys must exist in es/en/pt). Otherwise clean and well-aligned with corporate-locale invariant (ADR-062).

---

### frontend-next/src/components/pool-wizard/steps/StepAdvancedRules.tsx

**Purpose:** Optional "advanced rules" step — per-knockout-phase toggle for including extra-time goals in scoring.

**What it does:**
- `StepAdvancedRules` (exported) — computes `knockoutPhases` (config phases whose `phaseId` is not `group_stage` and doesn't include `"group"`). `toggleExtraTime(phaseId)` flips `includeExtraTime` on the matching phase via `UPDATE_SCORING_CONFIG`. Renders (only if there are knockout phases) an explanatory two-box panel (off=recommended vs on) and a `ToggleSwitch` per knockout phase (with a "Recomendado" badge when off), plus a closing info note.

**Exports:** `StepAdvancedRules` (named).

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `WizardSubStep`, `ToggleSwitch`, `formatPhaseFullName`, `next-intl`, `@/lib/theme`, `useIsMobile`.

**Flags:** **Likely dead/orphaned step.** `PoolCreationWizard.renderStep()` has no `ADVANCED_RULES` case, the lazy step imports omit it, and `PoolWizardContext.RESTORE` explicitly treats `ADVANCED_RULES` as a removed step (falls back to `SCORING`). The component is not referenced by the active wizard flow. Medium-to-high confidence dead code (the extra-time toggle now lives inside the `ScoringEditor`).

---

### frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx

**Purpose:** Capacity-selection step — pick participant capacity, optionally redeem a corporate "cuenta de cobro" (CC / AccountReceivable), and trigger pool creation / payment. Renders its own sticky CTA (the wizard hides the shared nav on this step).

**What it does:**
- `StepCapacity` (exported) — props `onSubmit(capacityOverride?)`, `submitBusy`. Detects payment country on mount → sets `currency` (`COP`/`USD`). Computes `poolType`, `freeLimit`, `isPaidTier`.
  - **CC redemption (corporate only):** `ccEnabled = mode==="corporate"`. Builds `ccApplied: RedemptionSummary | null` from wizard state. `applyRedemption(summary)` writes all `accountReceivable*` fields + locks `maxParticipants` to the CC's `targetCapacity` and the preview currency to the CC's currency; `clearRedemption` resets them. `ccAmountFormatted()` formats COP pesos or USD (cents/100) via `formatPrice`.
  - **GA4 view_item:** an effect emits `trackViewItem` once per `(poolType, capacity, currency)` tuple when a paid tier is selected (deduped via `lastViewItemKey` ref), computing price via `getUpgradePriceUsd`/`getUpgradePrice`.
  - Renders `AccountReceivableRedemptionBox` (corporate), then either a locked "pre-paid capacity" green panel (when a CC is applied) or a `CapacitySelector` (mode="creation").
  - **Sticky CTA footer:** Back button + primary submit. Submit label varies: "Creando..." (busy) / "Pagar con cuenta de cobro (amount)" (CC) / "Proceder al pago" (paid tier) / "Crear Pool" (free). A secondary "continue free" affordance appears when a paid tier is selected without a CC — for corporate it's a prominent green box explaining payment is required before sending invites; for personal it's an underlined link. `handleContinueFree` sets capacity to `freeLimit` and calls `onSubmit(freeLimit)` (override passed because React state won't update before `onSubmit` reads it).

**Exports:** `StepCapacity` (named).

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `CapacitySelector`, `AccountReceivableRedemptionBox`, `RedemptionSummary` type, `@/lib/pricing` (`PERSONAL_FREE_LIMIT`, `CORPORATE_FREE_LIMIT`, `formatPrice`, `getUpgradePrice`, `getUpgradePriceUsd`, `Currency`), `getPaymentCountry`, `trackViewItem`, `@/lib/theme`, `useIsMobile`.

**Flags:** Uses `t(key, { defaultMessage })` (next-intl caveat). CC redemption is corporate-only by design (ADR-061). None critical.

---

### frontend-next/src/components/pool-wizard/steps/StepNameDetails.tsx

**Purpose:** Pool identity + timing step — name, description, deadline (presets + custom unit selector), timezone, and require-approval toggle.

**What it does:**
- `StepNameDetails` (exported) — `setField` helper dispatches `SET_FIELD`. Auto-detects timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (memoized; server fallback `America/Bogota`). Inline validation: `poolNameError` (min 3 chars), `descriptionOver` (>500). Five `WizardSubStep`s:
  1. **Pool name** — input (≤60, required, focus/blur border styling, error text).
  2. **Description** — textarea (≤500, char counter, over-limit error styling).
  3. **Deadline** — preset pills from `DEADLINE_PRESETS` (at start / 10 min [recommended] / 1 hr / 1 day) plus a custom number input + unit `<select>` (min/hr/day). The number + unit derive the stored minutes by detecting the largest clean unit (1440-day, 60-hour, else minute) and clamp to 10080 (one week).
  4. **Timezone** — `<select>` over `COMMON_TIMEZONES`, injecting the detected zone as an extra option if not in the list, with detected-suffix/arrow labels.
  5. **Require approval** — `ToggleSwitch`.
- Shared `inputBaseStyle` / `errorTextStyle`.

**Exports:** `StepNameDetails` (named).

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `WizardSubStep`, `ToggleSwitch`, `COMMON_TIMEZONES` from `@/lib/timezones`, `next-intl`, `@/lib/theme`.

**Flags:** `setField` casts `field as any` (acknowledged boundary cast for the generic dispatch). The deadline unit derivation logic is duplicated three times inline (in the input value getter, the input onChange, and the select onChange) — minor duplication candidate. The recommended preset is 10 min, but `RECOMMENDED_DEADLINE` (the context default) should be cross-checked for consistency. Low confidence.

---

### frontend-next/src/components/pool-wizard/steps/StepScoring.tsx

**Purpose:** Thin wrapper mounting the reusable `ScoringEditor` inside the wizard; all scoring/preset/multiplier logic lives in `components/scoring-editor`.

**What it does:**
- `StepScoring` (exported, also default export) — reads `state`/`dispatch`. `isPicker` = no scoring style yet; `activePreset` looked up from `PRESETS`. Renders `PoolWizardStepContainer` with picker vs configure titles/subtitle and the preset icon (or a fallback 🎲), wrapping `ScoringEditor`. Bridges wizard state to the editor: `scoringStyle`, `scoringConfig`, `instancePhases`, and callbacks `onSetScoring(style, config)` → `SET_SCORING` (casts `style as ScoringStyle` because the editor may pass `null` on reset) and `onUpdateScoringConfig(config)` → `UPDATE_SCORING_CONFIG`.

**Exports:** `StepScoring` (named) and default.

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `ScoringEditor` + `PRESETS` from `@/components/scoring-editor`, `ScoringStyle` type, `next-intl`.

**Flags:** Comment notes the `style as ScoringStyle` cast bridges a type mismatch where the editor passes `null` on "Cambiar". None critical.

---

### frontend-next/src/components/pool-wizard/steps/StepSummary.tsx

**Purpose:** Final review step — read-only summary of every prior choice with per-section "Edit" jump-back buttons.

**What it does:**
- `StepSummary` (exported) — `isCorporate` flag drives extra sections. Derives display data: `uniqueTypes` (distinct enabled match-pick type keys across phases), `hasAutoScaling` (any phase with `matchPicks.autoScaling.enabled`), `extraTimePhases` (phases with `includeExtraTime`, named via `formatPhaseFullName`).
  - `SummarySection` (inner component) — label/value row with an "Edit" button that calls `goToStep(step)`.
  - Renders an error banner (if `state.error`), then sections: Company (corporate only), Tournament, Pool name + description, Scoring (preset name via dynamic key `scoring.presets.<style>.name`, count of pick types, scaling-enabled note, extra-time phases), Deadline, Welcome message (corporate, truncated to 120 chars), and a closing info note.

**Exports:** `StepSummary` (named).

**Key dependencies:** `useWizard`, `PoolWizardStepContainer`, `WizardStep` type, `formatPhaseFullName`, `next-intl`, `@/lib/theme`, `useIsMobile`.

**Flags:** `tDyn` cast (`t as unknown as (key:string)=>string`) for the dynamic preset-name key. `SummarySection` declares a `multiline?` prop that is passed by several callers but never used inside the component — minor dead prop. Low confidence.

---

### frontend-next/src/components/pool-wizard/steps/StepTournament.tsx

**Purpose:** Tournament-selection step — renders the static tournament catalog as a grid, matches each entry to a backend instance, and on selection loads that instance's phases into wizard state.

**What it does:**
- `StepTournament` (exported) — fetches backend instances via `listInstances(token)` on mount (with a `cancelled` guard + loading/error states). 
  - `getInstanceForEntry(entry)` / `resolveInstance(entry)` — match a `TOURNAMENT_CATALOG` entry to a `CatalogInstance`: tries `template.key`, then `templateKey`, then a broad name/id partial match. Only active entries with a `templateKey` resolve.
  - `handleSelect(entry, instance)` — dispatches `SET_TOURNAMENT`, then loads `getInstancePhases(token, instance.id)` and dispatches `SET_PHASES` (sets `loadingPhases`, handles `phasesLoadError`).
  - Renders a responsive grid of catalog cards: emoji + i18n name (`tournaments.<i18nKey>`), a "Coming Soon" badge for inactive entries, a small spinner on the selected card while phases load, and a checkmark SVG when selected. Cards are disabled when inactive or no instance resolves.
- Spinner CSS: injects a `@keyframes p4a-spin` style tag once into `document.head`; `spinnerStyle`/`spinnerSmallStyle` apply it.

**Exports:** `StepTournament` (named).

**Key dependencies:** `useAuth`, `useWizard`, `PoolWizardStepContainer`, `TOURNAMENT_CATALOG`/`TournamentEntry` from `@/lib/tournamentCatalog`, `listInstances`/`getInstancePhases`/`CatalogInstance` from `@/lib/api/pools`, `next-intl`, `@/lib/theme`, `useIsMobile`.

**Flags:** Uses `(inst as any).template?.key` / `(inst as any).templateKey` casts because `CatalogInstance`'s type doesn't statically expose those fields — boundary `any` plus a sign the instance matching relies on fields not in the declared type. The triple-fallback matching heuristic is fragile but intentional. Low-to-medium confidence.

---
