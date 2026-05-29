## Audit: docs/guides/DEPLOYMENT.md

**Overall verdict: update (minor)** — The doc is broadly accurate and current (dual-gateway payments, sales/CC, analytics DLQ, locale system are all reflected in env vars). The main gaps are in the cron-job inventory: the doc says "Ten background jobs" and lists 10, but `server.ts` actually starts **thirteen** jobs. Four shipped jobs (and their env vars) are entirely missing, the health-response example drops the `{ ok: true }` wrapper, and there is an undocumented second `railway.toml`.

---

### Finding 1 — Section 7 "Cron Jobs": missing four jobs ("Ten" is wrong)
**Type: missing / incorrect**

`backend/src/server.ts` (lines 326-338) calls thirteen `start*Job()` functions:
`startSmartSyncJob`, `startDeadlineReminderJob`, `startNewMemberDigestJob`, `startPhaseSyncJob`, `startFixtureTrackingJob`, `startLiveScoresJob`, `startFixtureVerificationJob`, `startTrackStatusCheckerJob`, `startCapiRetryJob`, **`startPaymentReconcileJob`**, **`startMpPaymentReconcileJob`**, **`startAccountReceivableExpiryJob`**, **`startWelcomeEmailFallbackJob`**.

The doc's heading says "Ten background jobs" and its table lists 10 rows (one of which, `resultSyncJob`, is *not* started — see Finding 2). The following four real jobs are completely absent from both the table and the Key Log Patterns table:

- **`paymentReconcileJob`** (`backend/src/jobs/paymentReconcileJob.ts`) — Polar stale-payment reconciler. Default cron `*/30 * * * *` via `RECONCILE_CRON`. Advisory lock 82636503.
- **`mpPaymentReconcileJob`** (`backend/src/jobs/mpPaymentReconcileJob.ts`) — Mercado Pago reconciler. Default `*/30 * * * *` via `MP_RECONCILE_CRON`; batch `MP_RECONCILE_BATCH_SIZE` (default 50). Log prefix `[MpReconciler]`.
- **`accountReceivableExpiryJob`** (`backend/src/jobs/accountReceivableExpiryJob.ts`) — flips PENDING AccountReceivable rows to EXPIRED. Default `5 * * * *` via `CC_EXPIRY_CRON`; batch `CC_EXPIRY_BATCH_SIZE` (default 100). Advisory lock 82636504.
- **`welcomeEmailFallbackJob`** (`backend/src/jobs/welcomeEmailFallbackJob.ts`) — ships welcome email 24h after signup for users who never hit LocalePreferenceModal. Default `15 * * * *` via `WELCOME_FALLBACK_CRON`; threshold `WELCOME_FALLBACK_HOURS` (default 24). Advisory lock 82636505.

**Fix:** Change heading to "Thirteen background jobs". Add the four jobs to the cron table and add their env vars to Section 2.1 (a new "Payment reconcilers / sweeps" group: `RECONCILE_CRON`, `MP_RECONCILE_CRON`, `MP_RECONCILE_BATCH_SIZE`, `CC_EXPIRY_CRON`, `CC_EXPIRY_BATCH_SIZE`, `WELCOME_FALLBACK_CRON`, `WELCOME_FALLBACK_HOURS`).

---

### Finding 2 — Section 7 cron table: `resultSyncJob` row is misleading
**Type: incorrect**

The table lists "Result Sync legacy (`resultSyncJob`) | inactive | Kept for backfill." But `backend/src/jobs/resultSyncJob.ts:81` notes that `startResultSyncJob/stopResultSyncJob/triggerManualSync were removed`; the file now only exports `getJobStatus` (imported by `adminInstanceService.ts`). It is never started in `server.ts`, so it is not a "background job" at all — it is a residual status helper.

**Fix:** Remove the `resultSyncJob` row from the cron-jobs table (it is not a scheduled job), or move it to a footnote clarifying that only `getJobStatus` survives and nothing is scheduled.

---

### Finding 3 — Section 4 "Verify Deployment": wrong /health response shape
**Type: incorrect**

The doc shows the `/health` response as `{ "version": "v1.0.0", "commit": "abc1234", "timestamp": "..." }`. In `server.ts:89-95` the handler calls `sendOk(res, { version, commit, timestamp })`, and `sendOk` (in `backend/src/lib/apiResponse.ts:28-33`) wraps payloads as `{ ok: true, ...extra }`.

**Fix:** Update the expected JSON to `{ "ok": true, "version": "v1.0.0", "commit": "abc1234", "timestamp": "..." }`.

---

### Finding 4 — Section 1: undocumented second `railway.toml` (backend/railway.toml)
**Type: missing / incorrect**

The doc shows only the root `railway.toml` and states "(backend only)". There are actually two backend-relevant configs:
- Root `railway.toml` — matches the doc verbatim (`buildCommand = "cd backend && npm install && npm run build"`, `startCommand = "cd backend && npm run start"`).
- `backend/railway.toml` — different: `builder = nixpacks` with `installCmd = "npm ci --include=dev"`, `NIXPACKS_NODE_VERSION = "22"`, `releaseCommand = "npx prisma migrate deploy"`, `startCommand = "npm run start"`, `healthcheckPath = "/health"`, `healthcheckTimeout = 30`, `restartPolicyType = "ON_FAILURE"`, `restartPolicyMaxRetries = 3`. There is also `frontend-next/railway.toml` with its own build/start (`node .next/standalone/server.js`, `healthcheckPath = "/"`, timeout 120).

The doc's claim "The frontend service is configured in Railway's dashboard (no `railway.toml`)" is **false** — `frontend-next/railway.toml` exists and defines the standalone build/start and a `/` healthcheck.

**Fix:** Document both backend configs (which one Railway honors depends on the service root directory) and replace the "frontend has no railway.toml" sentence with the actual `frontend-next/railway.toml` contents (notably the `cp -r .next/static` / public-copy build command and `node .next/standalone/server.js` start). Also document the healthcheck/restart-policy settings that the doc currently omits.

---

### Finding 5 — Section 5 "Running Seeds": seed list incomplete
**Type: missing**

`backend/package.json` defines `seed:test-accounts` (`seedTestAccounts.ts`) and helper scripts `script:fetch-ucl`, `script:update-ucl-draw`, `script:migrate-extra-time`, none of which the doc lists.

**Fix:** Add `railway run npm run seed:test-accounts` to the seed list and (optionally) mention the `script:*` maintenance commands.

---

### Finding 6 — Section 2.1 start-command narrative: migration name now hardcoded
**Type: incorrect (minor)**

The doc generalizes the start command as `prisma migrate resolve --rolled-back <migration> || true && ...`. The real `npm run start` (package.json:9) hardcodes the migration: `npx prisma migrate resolve --rolled-back 20260131120000_seed_legal_documents || true && prisma migrate deploy && node dist/server.js`.

**Fix:** Show the literal command with the actual migration id so readers understand it is a one-off rollback guard for `20260131120000_seed_legal_documents`, not a generic placeholder.

---

### Finding 7 — FRONTEND_URL default (informational)
**Type: ok / minor**

`backend/src/lib/env.ts:15` defaults `FRONTEND_URL` to `http://localhost:5173` (a legacy Vite-era dev port; the current frontend dev server is Next on 3000). This default never applies in production (Railway sets it explicitly) so it is not a doc error, but if the doc ever documents defaults, note the stale `5173` value in `env.ts` itself is worth cleaning up in code rather than docs.

**Fix:** No doc change required. Flag `env.ts` default `5173` → `3000` as a code-cleanup item.

---

### Confirmed accurate (no change needed)
- Section 2.1 env-var tables for Email routing (4 mailboxes), Mercado Pago, Polar, Pricing, Scores Service, GA4, Meta CAPI, and Analytics DLQ all match `env.ts` warnings and the codebase. The dual-gateway payment system and the CAPI DLQ (`capiRetryJob`) are correctly documented.
- Section 7 internal-notification routing table matches the four-mailbox model.
- `MP_WEBHOOK_MAX_DRIFT_MS`, capacity-warning and blocked-attempt throttle vars are present and correctly described.
