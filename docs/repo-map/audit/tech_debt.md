## Audit: TECH_DEBT.md

**Verdict: UPDATE (minor-to-major).** The doc is structurally sound and most of its deferred-work items still map to real code (no `/metrics` endpoint, no `web_vitals` event, `helmet()` uses defaults, CSP keeps `unsafe-inline` for the `gtm.ts` consent script, `jobLogger.ts`/`dateUtils.ts`/`useAutoHideToast` still don't exist, `mpPurchaseValue` fallback is real, the Ronda-4 audit follow-ups and the MP-PENDING reconciliation SQL all line up). However, the headline "Large file splits" table is badly drifted, two factual counts are wrong, and at least one cleanup recommendation is questionable. Fix the table + numbers; the rest is largely OK.

Verified against: `frontend-next/src/components/pool-wizard/steps/StepScoring.tsx`, `frontend-next/src/components/scoring-editor/ScoringEditor.tsx`, `backend/src/lib/{emailTemplates,email}.ts`, `backend/src/services/{paymentService,poolAdminService,adminInstanceService}.ts`, `backend/src/jobs/*`, `backend/src/lib/scoringAdvanced.ts`, `backend/src/types/pickConfig.ts`, `frontend-next/next.config.ts`, `frontend-next/src/lib/gtm.ts`, repo-map parts 02/03/04/10/11/21/23 and `DEAD_CODE_FINDINGS.md`.

---

### 1. Large file splits — `StepScoring.tsx` row is OBSOLETE
**Type: incorrect / obsolete.** The table claims `frontend-next/src/components/pool-wizard/steps/StepScoring.tsx` is `~2,070` LOC and suggests splitting it into `PresetSelector`, `CriterionEditor`, `ScoringPreview`, etc. That split **already happened.** `StepScoring.tsx` is now a **55-line thin wrapper** that mounts `ScoringEditor` and adapts wizard state/dispatch (its own header comment says "All scoring logic, presets, multipliers, example calculator, etc. live in components/scoring-editor"). The real large file is `frontend-next/src/components/scoring-editor/ScoringEditor.tsx` at **2,265 LOC**, which the table does not mention at all.
**Fix:** delete the `StepScoring.tsx` row; replace with `ScoringEditor.tsx` (~2,265 LOC) and update the suggested split to target it (`PresetSelector`, `CriterionEditor`, `ScoringPreview` already correctly describe its internals).

### 2. Large file splits — every LOC figure is understated
**Type: incorrect.** Actual line counts are materially higher than the table:
- `backend/src/lib/emailTemplates.ts`: doc ~1,700 → actual **2,169**
- `backend/src/lib/email.ts`: doc ~1,470 → actual **2,162**
- `backend/src/services/paymentService.ts`: doc ~1,230 → actual **2,606**
- `backend/src/services/poolAdminService.ts`: doc ~1,120 → actual **1,509**
- `backend/src/services/adminInstanceService.ts`: doc ~1,130 → actual **1,132** (this one is fine)
**Fix:** refresh the LOC column. `paymentService.ts` more than doubled — the dual-gateway + reconciler + telemetry work landed there; the suggested `paymentService.{polar,mp,shared}.ts` split is still the right idea.

### 3. Structured logging — console count is stale
**Type: incorrect.** Doc says "91 `console.log` / `console.error` calls across the codebase." A repo-wide count of `console.(log|error|warn)` across `backend/src` + `frontend-next/src` returns **530**. The recommendation (pino/winston, correlation IDs) is still valid; only the number is wrong (off by ~6x).
**Fix:** update to ~530 (or re-count at edit time). Note `backend/src/lib/logger.ts` already exists (repo-map part-04) — the refactor should adopt/extend it rather than introduce a new logger.

### 4. Security hardening — advisory-lock claim is outdated
**Type: incorrect (improved beyond doc).** The CSP/`unsafe-inline`, per-user rate-limit, helmet-non-defaults (`backend/src/server.ts:73` is bare `helmet()`), and email-template-XSS items are all still accurate. But the bullet claims `pg_try_advisory_xact_lock` is in place "via `capiRetryJob`" only. The advisory-lock pattern is now in **five** jobs: `capiRetryJob.ts`, `accountReceivableExpiryJob.ts`, `mpPaymentReconcileJob.ts`, `paymentReconcileJob.ts`, `welcomeEmailFallbackJob.ts`. The four crons the item still wants locked (deadlineReminder, newMemberDigest, phaseSync, smartSync) remain unlocked, so the action item is valid — but "the pattern is already in place via capiRetryJob" understates how broadly it's deployed.
**Fix:** reword to "already in place across 5 payment/lifecycle jobs (capiRetry, accountReceivableExpiry, mpPaymentReconcile, paymentReconcile, welcomeEmailFallback)".

Also note: the XSS-audit bullet is now corroborated by concrete open findings (`DEAD_CODE_FINDINGS.md` A2/A3: raw `contactName` in `getCorporateInquiryConfirmationTemplate` EN/PT, raw `entry.name` in `getPhaseCompletionSummaryTemplate`). Per this doc's own preamble ("bugs/security holes are fixed immediately, never deferred"), those are arguably mis-filed as deferrable — consider cross-referencing them as active, not belt-and-suspenders.

### 5. DB cleanups — "Deprecate legacy scoring types (EXACT_SCORE, PARTIAL_SCORE)" is questionable
**Type: incorrect / risky recommendation.** The doc suggests removing the `EXACT_SCORE` / `PARTIAL_SCORE` branch in `scoringAdvanced.ts` and the type union if no pool uses them. But these are **not dead legacy types** — they are active scoring keys in the current cumulative engine. `backend/src/lib/scoringAdvanced.ts` evaluates `EXACT_SCORE` as an additive bonus in cumulative mode (lines ~130-152) and as the terminating type in legacy mode (lines ~167-189); `backend/src/validation/pickConfig.ts` actively validates and warns on `EXACT_SCORE` point values (lines ~190-229). The union comment marks `EXACT_SCORE` `[LEGACY]` only in the sense of "terminates evaluation in legacy mode," not "removable."
**Fix:** either drop this item or rescope it to "remove only the legacy *terminating-evaluation* code path once no pool runs in non-cumulative mode" — and make clear `EXACT_SCORE`/`PARTIAL_SCORE` themselves are live and must stay.

### 6. DB cleanups — seed-script retirement list is accurate
**Type: ok.** `backend/src/scripts/fetchUclData.ts`, `initSmartSyncStates.ts`, `updateUclR16Draw.ts` all still exist and `DEAD_CODE_FINDINGS.md` section E independently flags them (plus `migrateExtraTimeConfig.ts`, `seedAdmin.ts`, `ucl_2025_fixtures.json`) as spent one-time scripts. Optionally expand this item to reference the broader E-list.

### 7. Minor duplication / observability / analytics maturity / Ronda-4 follow-ups / MP reconciliation SQL / pre-existing test failures
**Type: ok.** Spot-checks pass: `jobLogger.ts`, `dateUtils.ts`, `useAutoHideToast` do not exist; the `10000` ceiling is hardcoded in `routes/pools.ts`, `payments.ts`, `corporate.ts` (and `constants.ts` has no `MAX_PARTICIPANTS`); `/metrics`/Prometheus endpoint absent; `web_vitals` GA4 event absent; `mpPurchaseValue` fallback is real (`paymentService.ts:167`); `/admin/analytics-health` route exists (`routes/analyticsHealth.ts`). The Ronda-4 audit items, the orphan-PENDING MP reconciliation SQL, and the 13-failing-test note are plausible and consistent with the codebase state; not independently re-run here but no contradicting evidence found.

**Minor nit (duplication table):** the `liveScoresJob.ts` / `resultSyncJob.ts` console-prefix dedup is now low-value because `resultSyncJob.ts` is a documented legacy fallback whose `scheduledTask` stays null and `runSyncJob()` is effectively unreachable (`DEAD_CODE_FINDINGS.md` B4 / part-02). Consolidating logging there is moot if the file is slated for removal.
