# Technical Debt — Post-Mundial Backlog

> **Last Updated:** 2026-05-04
>
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
| `frontend-next/src/components/scoring-editor/ScoringEditor.tsx` | ~2,265 | `PresetSelector`, `CriterionEditor`, `ScoringPreview`, shared hook for preset state |
| `backend/src/lib/emailTemplates.ts` | ~2,169 | One file per template family under `lib/emailTemplates/`, keep the barrel export |
| `backend/src/lib/email.ts` | ~2,162 | Extract `EmailQueue`, `EmailRetry`, `EmailBatch` into their own modules |
| `backend/src/services/paymentService.ts` | ~2,606 | Split into `paymentService.polar.ts`, `paymentService.mp.ts`, `paymentService.shared.ts` (more than doubled after the dual-gateway + reconciler + telemetry work landed here) |
| `backend/src/services/poolAdminService.ts` | ~1,509 | Pull scoring recomputation + phase locking into their own services |
| `backend/src/services/adminInstanceService.ts` | ~1,132 | Separate template-vs-instance lifecycle |

The wizard's `StepScoring.tsx` has already been reduced to a ~55-line thin
wrapper that mounts `ScoringEditor` and adapts wizard state/dispatch — all
scoring logic, presets, multipliers and the example calculator now live in
`components/scoring-editor/`, so the remaining split work targets
`ScoringEditor.tsx` itself.

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
| `liveScoresJob.ts` / `resultSyncJob.ts` | ~15 LOC of `[JobName] ... ` console prefix boilerplate; would collapse into a `lib/jobLogger.ts`. Low value now: `resultSyncJob.ts` is a documented legacy fallback (its `scheduledTask` stays null and `runSyncJob()` is effectively unreachable — `DEAD_CODE_FINDINGS.md` B4) and is itself slated for removal, so consolidating its logging is moot. |
| `lib/fixture.ts` / `lib/serializers.ts` | Date formatting helpers duplicated; consolidate into `lib/dateUtils.ts`. |
| `services/scoresService/client.ts` / `services/apiFootball/client.ts` | HTTP request builders 80% identical; base client lib with hook for per-provider auth headers. |
| `10000` player ceiling | Hardcoded in `routes/pools.ts`, `payments.ts`, `corporate.ts`. Centralise under `lib/constants.ts` as `POOL.MAX_PARTICIPANTS`. |
| `setTimeout(x, 3000)` toast hide | Repeated in `AdminEmailSettingsContent`, `StructuralPicksManager`, `profile/page.tsx`. Extract a `useAutoHideToast` hook. |

---

## 📝 Structured logging

~530 `console.log` / `console.error` / `console.warn` calls across
`backend/src` + `frontend-next/src`. `backend/src/lib/logger.ts` already
exists; the refactor should adopt and extend it (pino or winston) rather
than introduce a new logger. A structured logger would give:

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
- **Email-template XSS audit**: verify every user-provided field (displayName, pool name, organisation name) passes through `escapeHtml()` before interpolation. Most paths compute a `safe*` value, but two open gaps interpolate raw user/host input and should be fixed now rather than deferred (they are active findings, not belt-and-suspenders): `getCorporateInquiryConfirmationTemplate` uses raw `${contactName}` in its EN/PT greetings (`emailTemplates.ts:898,908`) while the ES branch and the body use `safeContactName`; and `getPhaseCompletionSummaryTemplate` renders raw `${entry.name}` in the Top-10 leaderboard rows (`emailTemplates.ts:2134`) despite the in-code comment claiming entries are escaped.
- **Cluster-wide lock on non-analytics crons** (deadlineReminder, newMemberDigest, phaseSync, smartSync). Today we run single-replica so no conflict exists; the moment we scale to 2+ replicas the `isRunning` in-memory flag is insufficient. The `pg_try_advisory_xact_lock` pattern is already in place across five payment/lifecycle jobs (`capiRetryJob`, `accountReceivableExpiryJob`, `mpPaymentReconcileJob`, `paymentReconcileJob`, `welcomeEmailFallbackJob`); these four crons remain unlocked.

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

- **`PoolPayment.amountCop` backfill for pre-migration rows**: the current code falls back to `calculateUpgradePriceCop()` (via the `mpPurchaseValue()` helper) so GA4/Meta and the success page show correct values, but a one-shot UPDATE that fills the column from the pricing library would let us drop the fallback path entirely. Low priority; the fallback is correct.
- **Retire only the legacy *terminating-evaluation* code path in `scoringAdvanced.ts`** once no pool runs in non-cumulative mode. Note `EXACT_SCORE` and `PARTIAL_SCORE` are NOT removable legacy types — they are live scoring keys: the cumulative engine evaluates `EXACT_SCORE` and `PARTIAL_SCORE` as additive bonuses (`scoringAdvanced.ts` ~lines 130-152), and `validation/pickConfig.ts` actively validates and warns on their point values (~lines 190-229). The only deferrable cleanup is the legacy-mode branch where `EXACT_SCORE` *terminates* evaluation (~lines 167-189); the keys themselves must stay.
- **Retire the spent one-time seed scripts** (`scripts/fetchUclData.ts`, `scripts/initSmartSyncStates.ts`, `scripts/updateUclR16Draw.ts`, plus `scripts/migrateExtraTimeConfig.ts`, `scripts/seedAdmin.ts` and the `scripts/ucl_2025_fixtures.json` fixture — the full `DEAD_CODE_FINDINGS.md` section E list) — archive into `docs/seed-history/` and remove from `backend/src/scripts/`.

---

## 🔐 Audit follow-ups (Ronda 4 grupos C + D — pending)

Five criticals from the May 2026 deep audit that were deferred to a separate session because of risk profile or migration complexity. None are exploitable today on real prod traffic but each is on the backlog.

- **`#13` Foreign-key `onDelete` policies missing on Pool / CorporateInvite / Organization / PoolMember relations.** Currently every relation defaults to `NoAction`, so deleting an Organization with active pools fails with an opaque error and GDPR right-to-erasure on a User leaves orphaned `acceptedByUserId` / `bannedByUserId` / `approvedByUserId` IDs pointing at nothing. Fix is a single Prisma migration with one `Cascade` / `SetNull` per relation; the analysis to pick the right action per relation is what's deferred.
- **`#16` Public `/corporate/inquiry` endpoint has no captcha and no audit event.** Today's `RATE_LIMIT_CORP_INQUIRY` (5 / 15 min per IP) is loose enough that an attacker with a few IPs can flood the admin inbox. Add Cloudflare Turnstile or hCaptcha + emit `CORPORATE_INQUIRY_SUBMITTED` audit with IP/UA so we can investigate after the fact.
- **`#19` `addEmployees` race condition: P2002 not caught.** Two concurrent `addEmployees` requests for overlapping emails throw the unique-constraint error to the user instead of skipping silently. Fix is one `try/catch` for `P2002` + `createMany skipDuplicates`.
- **`#20` `requireCorporateHost` doesn't filter `status: "ACTIVE"`.** A `CORPORATE_HOST` row with `status=BANNED/LEFT` could still operate the pool. Edge case (we don't currently expose a way to ban the host) but defence-in-depth.
- **`#21` Capacity check sits outside the tx in `activateCorporateAccount`.** `pool.findUnique` reads `maxParticipants` before opening the tx; in a 10ms window a concurrent expansion or join can move the goalpost. Wrapping the check inside the tx closes it.

**Plan:** one PR per item, smallest first (`#19` → `#20` → `#21`), then `#16` (requires Cloudflare Turnstile setup), then `#13` (the migration; needs the most analysis).

---

## 🧯 Reconciliation script for orphan PENDING `PoolPayment` rows

The pre-Ronda-2 MP-eventId bug (now ADR-046 in `DECISION_LOG.md`) could leave MP payments stuck in `PENDING` even after the customer paid — the IPN was deduped silently because the eventId lacked the status. The fix is in place going forward, but rows BEFORE the 2026-05-03 deploy may be in this state and need a one-shot reconciliation:

```sql
SELECT id, "polarCheckoutId", "fromCapacity", "toCapacity", "createdAtUtc"
FROM "PoolPayment"
WHERE status = 'PENDING'
  AND currency = 'cop'
  AND "createdAtUtc" < '2026-05-03'::date
ORDER BY "createdAtUtc" DESC;
```

For each candidate: query MP's `/v1/payments/<id>` API with the row's `polarOrderId` (or via `external_reference` if `polarOrderId` is null), and if MP says `approved`, run the `handleMpWebhook` claim + expand flow manually with admin auth. Tracked here so it doesn't get lost; not blocking any current user.

---

## ⚠️ Pre-existing test failures (not from this audit)

As of **2026-05-28** the backend suite reports **22 failing tests / 617 passing (639 total across 29 test files)**. This was verified to be **independent of the 2026-05-28 dead-code pruning** (`refactor: remove safe dead code`, commit `00b458e`): the suite reports the identical 22 failures with and without that change (measured via `git stash`). The failures are stale specs that drifted as code shipped without test updates — they cluster in five files:

- `services/paymentService.test.ts` — `handleMpWebhook` specs mock the Prisma transaction (`tx`) without an `auditEvent` delegate, so they throw `Cannot read properties of undefined (reading 'create')` at `paymentService.ts:688`. The `tx.auditEvent.create` call was added when `markPaymentCompleted` moved the audit row inside the tx (ADR-065); the mocks were never updated.
- `lib/serializers.test.ts` — `serializeUser` now returns 7 fields (added `locale`); the fixture omits `locale` and asserts `toHaveLength(6)` / a 6-key `toEqual`.
- `lib/email.test.ts` — `isEmailEnabled` expectations against `PlatformSettings` defaults that drifted (deadline reminder default flipped, master toggle interaction).
- `lib/pickPresets.test.ts` — `generateDynamicPresetConfig` for CUMULATIVE / BASIC presets; expected point values diverged from the engine after the cumulative-system rewrite (related to the `KNOCKOUT_POINTS`/`DEFAULT_MULTIPLIERS` keyed-by-static-WC-phase-id issue in `DEAD_CODE_FINDINGS.md` §D1).
- `services/groupStandingsService.test.ts` — `upsertGroupStandingsPick` happy path; mock setup hasn't kept up with the deadline + lockedPhases enforcement added in the Wave 2 fixes.

None are introduced by recent doc or pruning work; they were failing before and continue to fail. **Action:** a dedicated cycle to bring the suite green — these stale tests currently provide no regression protection. See `docs/repo-map/DEAD_CODE_FINDINGS.md` §A5 (XSS-test desync) and §D for the underlying drift.

---

## 🤖 Observability

- Prometheus counters exposed on a `/metrics` endpoint: `events_sent_total{provider,event}`, `events_failed_total{provider,event}`, `dlq_size_gauge{provider}`, `payment_status_total{status}`.
- Alerting: DLQ backlog > 100 for > 1h, or oldest unresolved event > 6h old. Today the `/admin/analytics-health` endpoint surfaces both numbers but nobody is polling it on a schedule.
- Per-sink daily summary email to admin at UTC midnight.

---

## 🎯 `resolvePlaceholders` best-thirds allocation (ADR-084)

`tournamentAdvancement.resolvePlaceholders` assigns the 8 qualifying
third-place teams to R32 slots **by rank** (`3rd_POOL_n → bestThirds[n-1]`).
The FIFA 48-team format instead assigns thirds to slots via a fixed
**group-combination table** (which 8 of the 12 groups' thirds qualify →
which slot each goes to). So the *automatic* R32 best-thirds matchups are
wrong (2026-06-28: produced "Colombia vs Iran" instead of "Colombia vs
Ghana"). `determineQualifiers` is correct (it picks the right 8 thirds);
only the slot allocation is wrong, and it only affects R32 (R16+ use
winner-based `W_<matchId>` placeholders).

**Not a correctness risk anymore** — the admin reviews/edits the bracket in
the Gestor de Fases, and a release is now the single source of truth
(writes the reviewed bracket to `instance.dataJson` + every pool, and
auto-advance is guarded from overwriting a released phase — ADR-084). So
the bug only affects the auto DRAFT the admin reviews.

**Fix:** implement the official FIFA "third-placed teams allocation" table
(C(12,8)=495 combinations, or the published lookup) so the auto draft is
already correct and needs no manual override. Verify against a known real
bracket before shipping.

---

**Review cadence:** re-evaluate this list in the first retro after the
World Cup final (2026-07-19). Items that are still irrelevant then can
be deleted; items that have become urgent can be promoted to active
sprints.
