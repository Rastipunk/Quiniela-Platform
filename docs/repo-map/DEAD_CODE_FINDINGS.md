# Dead Code & Junk Findings (Phase 2)

> Consolidated from the 25-agent repo map (2026-05-28). ~95 flags,
> categorized by **what to do**, not just by file. Confidence is the
> mapping agent's; anything marked "verify repo-wide" must be grep-checked
> for consumers before deletion.
>
> **Nothing here has been deleted yet.** Deletion happens in Phase 4 after
> owner approval, on a branch, with type-check + build gating.

---

## A. SECURITY (not junk — risk; act regardless of cleanup decision)

| # | File | Issue | Confidence | Status |
|---|---|---|---|---|
| A1 | `.claude/settings.local.json` | Production `DATABASE_URL` (with password) + 2 JWT bearer tokens committed inside permission rules | high | **Mitigated** (untracked + gitignored 2026-05-28). **Owner must rotate** the Postgres password + `JWT_SECRET` — secret is in git history. |
| A2 | `backend/src/lib/emailTemplates.ts` | `getCorporateInquiryConfirmationTemplate` EN/PT greeting interpolates **raw `contactName`** on a PUBLIC endpoint (ES branch escapes via `safeContactName`) | high | **Fix** — stored-XSS vector. |
| A3 | `backend/src/lib/emailTemplates.ts` | `getPhaseCompletionSummaryTemplate` Top-10 rows interpolate **raw `entry.name`** despite a comment claiming escaping | high | **Fix** — XSS via player display names. |
| A4 | `backend/src/lib/email.ts` | `sendResultOverrideNotification` / `sendGroupStandingsOverrideNotification` / `sendKnockoutWinnerOverrideNotification` interpolate host-controlled fields (`reason`, results, team names) without `escapeHtml` | medium | **Fix** — inline-HTML senders bypass the escaping used in `emailTemplates.ts`. |
| A5 | `backend/src/lib/emailTemplates.xss.test.ts` | Test fixtures are stale (wrong shapes: `type:'REMOVED'`, `top10:[{displayName}]`, `paidAt:new Date()`) so they **cannot catch** the A3 gap | high | **Fix** — realign tests with current interfaces; they should fail on A2/A3 until fixed. |
| A6 | `frontend-next/src/components/AdminEmailSettingsContent.tsx` | Sets a `Cookie: p4a_token=…` request header in `fetch` — browsers forbid scripts setting `Cookie`, so it's silently dropped (auth actually rides `credentials:'include'`) | medium | **Remove** the dead header. Ineffective, misleading. |

> A1 is the headline. A2–A5 are a coherent XSS cluster in the email layer
> that the project's own ADR-047 hardening was supposed to cover — worth a
> dedicated fix cycle.

---

## B. SAFE TO DELETE — dead code, high confidence, locally verifiable

Unused imports / locals / tautological branches. Removing these cannot
change behavior; a type-check + build pass is sufficient proof.

### B1. Tautological / no-op branches (both sides identical)
- `backend/src/routes/analyticsHealth.ts` — `status = unresolved > 1000 ? "error" : "error"` (comment admits it).
- `frontend-next/src/app/[locale]/verify-email/VerifyEmailContent.tsx` — `if (result.verified)` and its `else` both set `"success"`; final else unreachable.
- `frontend-next/src/components/LandingContent.tsx` — `background: active ? "var(--surface)" : "var(--surface)"`.
- `frontend-next/src/components/scoring-editor/ScoringEditor.tsx` — `display: isCustom || showAdvanced ? "block" : "block"` (line ~1886).
- `frontend-next/src/app/[locale]/mundial-2026/reglas-quiniela/page.tsx` — `isLast`/`isFinal` are identical duplicate booleans.
- `frontend-next/src/app/sitemap.ts` — `recentlyUpdated` and `stable` both hold the same date.

### B2. Unused imports
- `backend/src/lib/scoringBreakdown.ts` — `MatchPickType` (high).
- `backend/src/lib/scoringAdvanced.ts` — `MatchPickTypeKey` (low).
- `backend/src/services/adminService.ts` — `AuditContext` from `./authService` (medium).
- `frontend-next/src/app/[locale]/mundial-2026/grupos/page.tsx` — `BRAND` (high).
- `frontend-next/src/components/PoolMatchesTab.tsx` — `ShareButtons` (medium).
- `AdminSettingsToggles.tsx`, `PhaseStatusPanel.tsx` — `shadows` from theme (medium).
- **`getLocale` from `next-intl/server` imported-but-unused in ~12 public pages**: `que-es-una-quiniela`, `reembolsos`, `terminos`, `faq`, `como-se-juega`, `football-pool`, `precios`, `privacidad`, `penca-futbol`, `polla-futbolera`, `porra-deportiva`, `prode-deportivo`, `mundial-2026/{page,predicciones,sedes,como-hacer-quiniela,calendario}`, `reglas-quiniela` (also unused `getTranslations`). High confidence, repeated pattern.

### B3. Unused locals / props / params (computed then voided)
- `frontend-next/.../PickComponents.tsx` — `_pickType`, `_canEdit` (void'd placeholders).
- `frontend-next/.../CreateJoinPanel.tsx` — `buttonStyle` prop never destructured.
- `frontend-next/src/components/KnockoutMatchCard.tsx` — `kickoffUtc` prop (`void _kickoffUtc`).
- `frontend-next/src/components/scoring-editor/ScoringEditor.tsx` — `maxPoints` local (line ~929).
- `AdminCcDetailContent.tsx`, `AdminQuoteDetailContent.tsx` — `const router = useRouter()` never used (high).
- `backend/src/services/poolAdminService.ts` — `setPhaselock()` unused `_ctx` (audit rows lose ip/UA — also a small correctness gap).
- `frontend-next/.../MatchCard.tsx` — `onToggleScoring` prop whose only consumer is a fully commented-out block.
- `frontend-next/.../PoolInviteCodeManager.tsx` — `organizationName` prop (`_organizationName`, "reserved for future").
- `frontend-next/.../StepSummary.tsx` — `SummarySection` `multiline` prop never read.
- `frontend-next/src/lib/api/{admin,auth,sales,user,corporate}.ts`, `lib/auth.ts` — `token`/`_token` params never used (cookie auth). **High volume but intentional signature convention** — see note below.

> **`token`-param convention:** the `api/*` modules take a `token` arg they
> never use because auth is cookie-based via `requestJson`. This is a
> deliberate (if stale) signature convention, not an accident. Removing it
> touches many call sites. Treat as a **separate refactor**, not Phase-4 junk
> removal — low value, broad blast radius.

### B4. Orphaned files / components (no importer found — verify repo-wide first, then delete)
- `frontend-next/src/app/[locale]/login/LoginContent.tsx` (~744 lines) — `login/page.tsx` redirects to `/` and never imports it; auth is handled by `AuthSlidePanel`. **Strongest single deletion candidate.** (high)
- `frontend-next/src/components/groupStandings/MatchInputForm.tsx` — legacy manual score-entry UI, superseded by scraper-first autoPublish (CLAUDE invariant 8); no importer. (high)
- `frontend-next/src/components/pool-wizard/steps/StepAdvancedRules.tsx` — no `ADVANCED_RULES` case in the wizard; context treats it as removed. (high)
- `frontend-next/src/components/PhaseConfigStep.tsx` — legacy pre-wizard pick-config flow, superseded by StepScoring/ScoringEditor. (medium)
- `frontend-next/src/components/PoolConfigWizard.tsx` — older modal wizard; CLAUDE.md names `PoolCreationWizard.tsx` as canonical. (low — verify)
- `backend/src/jobs/resultSyncJob.ts` — whole file is a documented legacy fallback; `runSyncJob()` unreachable, `scheduledTask` permanently null. (high — keep only if `getJobStatus()` is still consumed)

### B5. Vestigial leftovers
- `frontend-next/.gitignore` — `.vercel`/Vercel ignores (project is on Railway).
- `frontend-next/.railwayignore` — `nul` entry (stray Windows null-device artifact).
- `backend/.gitignore` — exception for `jest.config.js` (project uses Vitest).
- `PoolWizardProgressBar.tsx` — `STEP_ICONS['ADVANCED_RULES']` (step no longer exists).
- `WhatsNewModal.tsx` — legacy `quiniela.*` localStorage keys vs newer `p4a_*`.

---

## C. VERIFY REPO-WIDE — exports flagged "no consumer in batch"

Each agent only saw its own batch, so these may have consumers elsewhere.
Grep the whole repo before treating as dead.

- `backend/src/lib/email.ts` — `getUserLocale` export.
- `backend/src/services/advancementTrigger.ts` — `cancelPendingAdvancement` export.
- `backend/src/services/polar/client.ts` — `getOrder` export (paymentService uses `getCheckoutSession`).
- `backend/src/lib/pricing.ts` — `validateCapacityRequiresPayment` export (USD-only).
- `frontend-next/e2e/helpers/auth.ts` — `apiRequest`; `e2e/helpers/pages.ts` — `ALL_PAGES`, `GLOBAL_FORBIDDEN_PATTERNS`.
- `frontend-next/.../poolHelpers.ts` — `fmtUtc`, `getMatchLabel`.
- `frontend-next/.../poolTypes.ts` — `PoolTabBaseProps`, `PhaseData`.
- `frontend-next/src/components/CorporateQuotePanel.tsx` — passthrough re-export of `COUNTRY_CODES`/`isValidCountryCode`.
- `frontend-next/src/components/BrandLogo.tsx` — legacy alias for `BrandIsotipo`.
- `frontend-next/src/proxy.ts` — `pathStartsWithLocale()` helper (active code uses `extractUrlLocalePrefix`).
- `frontend-next/src/components/groupStandings/types.ts` — `TeamStanding`.

---

## D. TECH DEBT / CORRECTNESS — do NOT delete, fix or track

These are not junk; deleting them removes behavior. They are bugs, drift,
or duplication to address deliberately.

### D1. Scoring / pricing correctness
- `backend/src/lib/pickPresets.ts` — `KNOCKOUT_POINTS[phase.id]` and `DEFAULT_MULTIPLIERS` are keyed by **static WC phase IDs**; non-WC instances (e.g. UCL `r32_leg1`) silently fall back to flat points / no auto-scaling. **Real scoring bug for non-WC tournaments.** (medium)
- `backend/src/lib/pricing.ts` — personal **COP** block count includes the free 20-player block; **USD** excludes it → USD/COP curves diverge for the same capacity. (medium)
- `backend/src/services/resultService.ts` `getLeaderboard()` and `poolStateMachine.ts` `transitionToCompleted()` email — both recompute ranks with **hardcoded 3/2 (or 3/5) scoring**, ignoring the pool's preset/pickTypesConfig/structural points → emailed/legacy ranks can diverge from the real leaderboard. (medium)
- `backend/src/services/poolAdminService.ts` — `getPlayerSummary` duplicates scoring loop from `poolOverviewService`/`resultService`; phase-order chain hardcoded in 2 places. High drift risk. (medium)

### D2. Payment / analytics correctness
- `backend/src/services/paymentService.ts` — `reconcileStalePayment` Polar **`failed`** branch writes `PaymentEvent.eventType = RECONCILER_EXPIRED` (copy-paste slip; mislabels failure as expiry in audit). (medium)
- `frontend-next/src/app/[locale]/pago/exitoso/page.tsx` — `trackPurchase` uses `amountUsd` for COP transactions (CLAUDE.md: COP must use `mpPurchaseValue`); verify `getPaymentStatus` normalizes first. (low)
- `backend/src/services/resultSync/service.ts` — `processFixtureForPool` can return `CONFIRMED` but `syncInstance` never counts it. (medium)

### D3. Unimplemented / aspirational feature
- `backend/src/types/pickConfig.ts` + `validation/pickConfig.ts` — `GLOBAL_QUALIFIERS` structural type has a Zod schema but **no scoring path** in `structuralScoring.ts` (only GROUP_STANDINGS + KNOCKOUT_WINNER). Decide: implement or remove the type + schema. (medium)

### D4. i18n / hardcoded-string violations (project rule breaches)
- Hardcoded Spanish in: `dashboard/page.tsx` (`confirm()`), `pago/checkout/page.tsx` (error strings), `ScoringEditor.tsx` (`Cambiar`, `Resultado:`…), `FAQAccordion.tsx` (`Todos`), `PoolInviteCodeManager.tsx` (`Clipboard`), `employeeTemplate.ts` / `exportLeaderboard.ts` (Excel labels ES-only), `timezones.ts` (ES labels), `ScoringBreakdownModal.tsx` (matches Spanish `"No aplica"` substring — locale-fragile).
- `next-intl` `defaultMessage` used as a fake fallback (it isn't, per project rule) in `AccountReceivableRedemptionBox.tsx`, `RegisterButton.tsx` — verify keys exist in all 3 locales.
- `backend/src/lib/constants.ts` — `PHASE_DISPLAY_NAMES.round_of_32.pt` duplicates `round_of_16.pt` (`Oitavas de Final`) — wrong PT label.
- `mundial-2026/sedes/page.tsx` — path maps indexed without `|| .es` fallback (undefined URL for unexpected locale).

### D5. Duplication (dedupe candidates)
- **Regional SEO pages** `penca-futbol` / `polla-futbolera` / `porra-deportiva` / `prode-deportivo` are near-identical boilerplate differing only in namespace/slug/SEO keys → extract a shared `RegionalArticlePage` (one already exists — verify why these don't use it). (high)
- Legal pages `terminos`/`reembolsos` Content components are structurally identical → shared `LegalMarkdownPage`. (high)
- Sales admin components (`AdminQuotesListContent`/`AdminCcsListContent` + the two `*DetailContent`) duplicate `formatCurrency`/`StatusBadge`/`statusMeta`/`KV`/table scaffolding → shared sales-table utilities. (medium)
- `authAnalytics.ts` — `setUserProperties({…13 fields})` duplicated in two functions. (medium)
- `employeeTemplate.ts` / `exportLeaderboard.ts` — `fetchLogoAsBase64`/`hexToArgb`/`COLORS` excel scaffold duplicated. (medium)
- `groupStandingsService.ts` — auto-advance-to-R32 block duplicated in 2 functions (comment acknowledges). (low)
- WC2026 schedule represented twice: `calendario/page.tsx` (real `GROUP_MATCHES`) vs `grupos/page.tsx` (generic round-robin generator) — divergent. (medium)
- `ScoringOverrideModalData` type defined identically in `ScoringOverrideModal.tsx` and `poolTypes.ts`. (low)
- `PasswordStrengthIndicator.tsx` duplicates backend `passwordRules.ts` thresholds. (low)
- Cross-boundary: `InvitationEmailPreview.tsx` `PREVIEW_STRINGS` manually mirrors backend `getCorporateActivationTemplate` copy (drift hazard). (medium)

### D6. Latent concurrency / auth hazards (verify, likely fine)
- `adminAnalyticsDashboard.ts` — module-level `errors` array reset with `.length=0` inside a builder; concurrent rebuilds could bleed entries. (low)
- `poolAdmin.ts` / `poolInvites.ts` / `pickPresets.ts` routers deref `req.auth!.userId` without router-level `requireAuth` — relies on mount applying it; **verify the mount** in `server.ts`. (low)

---

## E. SPENT ONE-TIME SCRIPTS / STALE DATA (archive candidates)

Operational scripts tied to past events or specific tournaments. Not
wired into runtime; safe to move to an `archive/` or delete after the
tournament ends.

- `backend/src/services/adminService.ts` — `updateUclR16`/`auditR16LatePicks`/`fixR16Integrity` + UCL-2025 hardcoded maps (one-off ops, UCL-specific).
- `backend/src/services/adminInstanceService.ts` — `updateR16Draw` (R16-specific predecessor of generalized `syncNextPhaseFromApi`).
- `backend/src/scripts/updateUclR16Draw.ts` — targets Feb 27 2026 draw (past; no-op now).
- `backend/src/scripts/migrateExtraTimeConfig.ts` — spent one-time migration (GROUP-shaped only).
- `backend/src/scripts/initSmartSyncStates.ts` — default id `wc2022-autotest-instance` (stale; active is WC2026).
- `backend/src/scripts/seedAdmin.ts` — hardcoded `admin@example.com/Admin123!`, overlaps env-driven `seedTestAccounts.ts`.
- `backend/src/scripts/ucl_2025_fixtures.json` — point-in-time generated dump (also the one partially-read file).
- **Migration cleanup:** `backend/package.json` `start` permanently runs `prisma migrate resolve --rolled-back 20260131120000_seed_legal_documents || true`. The seed migration `20260131120000_seed_legal_documents` is effectively dead (rolled back on every boot). The boot workaround should be removed and the migration state cleaned. (high — but migrations are immutable history; handle carefully.)
- `backend/prisma/migrations/20260512_add_user_locale_preference` is fully reverted by the next migration `20260512_user_locale_nullable` — superseded design, kept only as immutable history (do NOT delete a migration).
- Comment debt: `adminService.ts:633` "Steps 3-6 omitted for brevity" is false (they're implemented below); `metaCapi.ts` comments name a non-existent `FailedCapiEvent` model (actual: `failedAnalyticsEvent`); `capiRetryJob.ts` named `capi*` but is now multi-provider (`[AnalyticsRetryJob]`).

---

## Suggested Phase-4 execution order (for owner approval)

1. **Security first** (A2–A6) — fix the XSS cluster + remove dead cookie header. Separate from cleanup.
2. **Safe deletions** (B1, B2, B3-minus-token-convention, B5) — gated by `tsc --noEmit` + build. Zero behavior change.
3. **Orphan files** (B4) — grep repo-wide to confirm zero importers, then delete. `LoginContent.tsx` is the big win.
4. **Generated-artifact hygiene** — already untracked playwright-report/test-results; commit that.
5. **Defer to dedicated cycles** (do NOT bundle into a cleanup PR): D1–D6 correctness/debt, D5 dedupes, the `token`-param refactor, the migration boot-workaround removal.

Everything in B and the deletions in E should land on a branch with a
green type-check + build before any merge.
