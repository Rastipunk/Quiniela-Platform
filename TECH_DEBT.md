# Technical Debt — Post-Mundial Backlog

> **Purpose:** items the deep-audit (2026-04-22) flagged as refactor-class
> improvements that are **not shipping before the 2026 World Cup**. They
> are tracked here so (a) nobody rediscovers them in six months, and
> (b) the team can pick them up in order once the traffic pressure drops.
>
> **Not in scope for this file:** bugs, security holes, or data-integrity
> risks — those are fixed immediately, never deferred. Everything below
> is known-safe production code that we want to improve later.

---

## 🏗️ Large file splits (CLAUDE.md §2 compliance)

CLAUDE.md caps components at 500 lines and services at 800. The following
exceed that limit because they accreted responsibilities over sprints.
Splitting requires careful test coverage we don't have time for right now.

| File | LOC | Suggested split |
|------|-----|-----------------|
| `frontend-next/src/components/pool-wizard/steps/StepScoring.tsx` | ~2,070 | `PresetSelector`, `CriterionEditor`, `ScoringPreview`, shared hook for preset state |
| `backend/src/lib/emailTemplates.ts` | ~1,700 | One file per template family under `lib/emailTemplates/`, keep the barrel export |
| `backend/src/lib/email.ts` | ~1,470 | Extract `EmailQueue`, `EmailRetry`, `EmailBatch` into their own modules |
| `backend/src/services/paymentService.ts` | ~1,230 | Split into `paymentService.polar.ts`, `paymentService.mp.ts`, `paymentService.shared.ts` |
| `backend/src/services/poolAdminService.ts` | ~1,120 | Pull scoring recomputation + phase locking into their own services |
| `backend/src/services/adminInstanceService.ts` | ~1,130 | Separate template-vs-instance lifecycle |

**Why this is deferred:** each split touches ~20 import sites and needs
a regression pass the current sprint cannot absorb.

---

## 🧪 Testing gaps

| Gap | Why it matters |
|-----|----------------|
| Zero unit tests in `frontend-next/src/` | Any UI regression in the pool-creation wizard or payment flow lands on production without a net. |
| No E2E golden-path (signup → pool create → pick → pay) | The highest-value funnel has no automated check. Playwright coverage today is analytics-only. |
| `paymentService` has no unit tests | Refund + IPN flows are the most failure-prone code and carry revenue impact. |
| `scoringAdvanced.ts` has tests but only happy paths | Edge cases (extra time, penalty shootouts, phase multipliers) not covered. |

**Plan:** after the mundial, establish Vitest for the frontend, move the
existing Playwright spec into a `@critical` tag, and add one spec per
payment gateway with a recorded HAR for the webhook.

---

## 🧹 Minor duplication

| Where | Detail |
|-------|--------|
| `liveScoresJob.ts` / `resultSyncJob.ts` | ~15 LOC of `[JobName] ... ` console prefix boilerplate; would collapse into a `lib/jobLogger.ts`. |
| `lib/fixture.ts` / `lib/serializers.ts` | Date formatting helpers duplicated; consolidate into `lib/dateUtils.ts`. |
| `services/scoresService/client.ts` / `services/apiFootball/client.ts` | HTTP request builders 80% identical; base client lib with hook for per-provider auth headers. |
| `10000` player ceiling | Hardcoded in `routes/pools.ts`, `payments.ts`, `corporate.ts`. Centralise under `lib/constants.ts` as `POOL.MAX_PARTICIPANTS`. |
| `setTimeout(x, 3000)` toast hide | Repeated in `AdminEmailSettingsContent`, `StructuralPicksManager`, `profile/page.tsx`. Extract a `useAutoHideToast` hook. |

---

## 📝 Structured logging

91 `console.log` / `console.error` calls across the codebase. A
structured logger (pino or winston) would give:

- Request-scoped correlation IDs (attach to every log line in a request).
- Level-based filtering without grepping strings.
- JSON output usable by Railway / a future Datadog or Grafana.
- Integration with the existing `writeAuditEvent` so ops dashboards
  surface both operational and audit events consistently.

**Effort:** half-day refactor; risk is low because all existing call
sites are already in side-effect paths.

---

## 🛡️ Security hardening (defence-in-depth, no exploit today)

All items below are belt-and-suspenders. The audit confirmed **zero
exploitable vulnerabilities** on the current codebase — these are
upgrades, not patches.

- **Strip `'unsafe-inline'` from the CSP** (`frontend-next/next.config.ts:9`). Use script nonces issued per request. The inline consent-default script in `lib/gtm.ts` is the only reason `unsafe-inline` is on; migrating it to a nonce-tagged `next/script` with `strategy="beforeInteractive"` closes the gap without affecting order of execution.
- **Rate limit per-user (not just per-IP)** for authenticated endpoints. NAT / corporate proxies share IPs and can exhaust limits for unrelated users.
- **Helmet non-defaults**: `helmet({ frameguard: { action: "deny" }, referrerPolicy: { policy: "strict-origin-when-cross-origin" } })`.
- **Email-template XSS audit**: verify every user-provided field (displayName, pool name, organisation name) passes through `escapeHtml()` before interpolation. Sampled paths are clean; a full pass would catch any regression.
- **Cluster-wide lock on non-analytics crons** (deadlineReminder, newMemberDigest, phaseSync, smartSync). Today we run single-replica so no conflict exists; the moment we scale to 2+ replicas the `isRunning` in-memory flag is insufficient. The pattern is already in place via `pg_try_advisory_xact_lock` in `capiRetryJob`.

---

## 🚀 Analytics / advertising maturity

Deferred, but worth picking up once ad spend makes them worth the setup:

- **Google Ads conversion tag + Enhanced Conversions**: needed before the first paid Google Ads campaign so conversions attribute correctly. 30 min of GTM config.
- **Server-side GTM (sGTM via Stape or self-hosted)**: preserves first-party cookies through Safari ITP 7-day expiry. Worth it if Safari traffic is >20% or when buying Meta Ads for remarketing cohorts.
- **BigQuery export**: 1 click in GA4 Admin, zero code. Raw event export keeps history beyond GA4's 14-month retention and enables cohort LTV queries.
- **Web Vitals → GA4 (`web_vitals` event)**: correlates Core Web Vitals with conversion rate.
- **A/B testing framework** (GrowthBook or Optimizely) integrated with GA4 audiences for stat-significant experiments.

---

## 🗃️ Database / schema cleanups

- **`PoolPayment.amountCop` backfill for pre-migration rows**: current code falls back to `calculateUpgradePriceCop()` from the pricing library so GA4/Meta values are correct, but `getPaymentStatus` still reports `amountUsd / 100` for legacy rows. A one-shot backfill would let us drop the fallback.
- **Deprecate legacy scoring types (`EXACT_SCORE`, `PARTIAL_SCORE`)**: verify via `SELECT COUNT(*) FROM Pool WHERE pickConfig::text LIKE '%EXACT_SCORE%'`. If zero, remove the branch in `scoringAdvanced.ts` + type union.
- **Retire the three one-time seed scripts** (`scripts/fetchUclData.ts`, `scripts/initSmartSyncStates.ts`, `scripts/updateUclR16Draw.ts`) — archive into `docs/seed-history/` and remove from `backend/src/scripts/`.

---

## 🤖 Observability

- Prometheus counters exposed on a `/metrics` endpoint: `events_sent_total{provider,event}`, `events_failed_total{provider,event}`, `dlq_size_gauge{provider}`, `payment_status_total{status}`.
- Alerting: DLQ backlog > 100 for > 1h, or oldest unresolved event > 6h old. Today the `/admin/analytics-health` endpoint surfaces both numbers but nobody is polling it on a schedule.
- Per-sink daily summary email to admin at UTC midnight.

---

**Review cadence:** re-evaluate this list in the first retro after the
World Cup final (2026-07-19). Items that are still irrelevant then can
be deleted; items that have become urgent can be promoted to active
sprints.
