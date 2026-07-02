# Production Deployment
# Picks4All

> **Last Updated:** 2026-05-04

---

## 1. Railway Architecture

The platform runs on Railway with three services:

```
┌─────────────────────┐     ┌─────────────────────┐
│  Frontend-Next      │     │  Backend             │
│  (Next.js 16)       │     │  (Express 5)         │
│  picks4all.com      │     │  api.picks4all.com   │
│  Port: 3000         │     │  Port: 3000          │
│  standalone output   │     │  Nixpacks builder    │
└─────────┬───────────┘     └─────────┬────────────┘
          │                           │
          │       ┌───────────────────┘
          │       │
          ▼       ▼
┌─────────────────────────────┐
│  PostgreSQL 16              │
│  Railway managed            │
│  Internal networking        │
└─────────────────────────────┘
```

**Build configuration:**

There are two backend-relevant `railway.toml` files; which one Railway honors depends on the service's configured root directory.

Root `railway.toml` (used when the backend service builds from the monorepo root):

```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install && npm run build"

[deploy]
startCommand = "cd backend && npm run start"
```

`backend/railway.toml` (used when the backend service root is `backend/`):

```toml
[build]
builder = "nixpacks"

[build.nixpacks]
installCmd = "npm ci --include=dev"

[build.env]
NIXPACKS_NODE_VERSION = "22"
NPM_CONFIG_PRODUCTION = "false"

[deploy]
releaseCommand = "npx prisma migrate deploy"
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

The backend `npm run start` command runs Prisma migrations automatically before starting the server. It begins with a one-off rollback guard for the `20260131120000_seed_legal_documents` migration:

```
npx prisma migrate resolve --rolled-back 20260131120000_seed_legal_documents || true && prisma migrate deploy && node dist/server.js
```

The frontend service is configured via `frontend-next/railway.toml`. It uses Next.js standalone output mode; the build step copies static and public assets into the standalone bundle, and the deploy step launches the standalone server:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build && cp -r .next/static .next/standalone/.next/static && rm -rf .next/standalone/public && cp -r public .next/standalone/public"

[deploy]
startCommand = "node .next/standalone/server.js"
healthcheckPath = "/"
healthcheckTimeout = 120

[build.env]
NODE_ENV = "production"
NIXPACKS_NODE_VERSION = "22"
```

---

## 2. Environment Variables

### 2.1 Backend Service

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Railway internal) | `postgresql://postgres:xxx@...` |
| `JWT_SECRET` | Secret key for JWT signing (min 16 chars) | Long random string |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `FRONTEND_URL` | Frontend URL for CORS and email links | `https://picks4all.com` |

#### Admin read-only query endpoint (optional — see ADR-070)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_READONLY_URL` | Connection string for the `picks4all_readonly` SELECT-only role. Enables `POST /admin/query`. Unset → endpoint returns 503. | `postgresql://picks4all_readonly:xxx@postgres.railway.internal:5432/railway` |
| `ADMIN_QUERY_TOKEN` | Bearer token for `POST /admin/query` (`X-Admin-Query-Token`). Generate with `openssl rand -hex 32`. | Long random string |
| `ADMIN_QUERY_MAX_ROWS` | Max rows returned per query (default 1000) | `1000` |

> Role setup is a one-time manual step in the Railway console — see `docs/guides/ADMIN_QUERY_ENDPOINT.md`. The role password must never be committed.

#### Domain and CORS

| Variable | Description | Default |
|----------|-------------|---------|
| `SITE_DOMAIN` | Primary domain (used for CORS origins) | `picks4all.com` |
| `CORS_EXTRA_ORIGINS` | Comma-separated additional CORS origins | - |

#### Email (Resend)

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key | `re_xxx` |
| `RESEND_FROM_EMAIL` | Sender address for user-facing transactional emails. Use a real, monitored mailbox — `noreply@`-style addresses are flagged by Resend Insights and penalised by Gmail/Outlook for trust. The default Reply-To is `soporte@<EMAIL_DOMAIN>` for support-bound mail; `sendPaymentReceiptEmail` overrides to `ventas@`, corporate-checkin to `empresas@`. | `hola@picks4all.com` |
| `ADMIN_NOTIFICATION_EMAIL` | Inbox for `error` + `system_event` notifications + fallback if any category-specific var below is unset | `admin@picks4all.com` |
| `SUPPORT_NOTIFICATION_EMAIL` | Inbox for `feedback` notifications (beta feedback / bug reports) | `soporte@picks4all.com` |
| `ENTERPRISE_NOTIFICATION_EMAIL` | Inbox for `corporate_inquiry` + `corporate_pool_created` | `empresas@picks4all.com` |
| `SALES_NOTIFICATION_EMAIL` | Inbox for `payment_completed` (also copied to admin) | `ventas@picks4all.com` |

#### Google OAuth

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client ID |

#### API-Football (Sports Data)

| Variable | Description | Default |
|----------|-------------|---------|
| `API_FOOTBALL_KEY` | API key from api-sports.io | - |
| `API_FOOTBALL_ENABLED` | Enable API-Football client | `false` |

#### Smart Sync

| Variable | Description | Default |
|----------|-------------|---------|
| `SMART_SYNC_ENABLED` | Enable the Smart Sync cron job | `false` |
| `SMART_SYNC_CRON` | Cron expression for sync frequency | `* * * * *` (every min) |
| `RESULT_SYNC_ENABLED` | Legacy alias for `SMART_SYNC_ENABLED` | `false` |

#### Phase Sync

| Variable | Description | Default |
|----------|-------------|---------|
| `PHASE_SYNC_CRON` | Cron expression for phase sync job | `0 8,20 * * *` (08:00/20:00 UTC) |

#### Deadline Reminders

| Variable | Description | Default |
|----------|-------------|---------|
| `DEADLINE_REMINDER_CRON` | Cron expression for reminder job | `0 12 * * *` (12:00 UTC) |

#### Match Sync Timing

| Variable | Description | Default |
|----------|-------------|---------|
| `MATCH_SYNC_FIRST_CHECK_MIN` | Minutes after kickoff for first API check | `5` |
| `MATCH_SYNC_FINISH_CHECK_MIN` | Minutes after kickoff for finish check | `110` |

#### Rate Limiting

All rate limit values are configurable via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_API_MAX` | Max requests per window (general) | `100` |
| `RATE_LIMIT_API_WINDOW_MS` | Window in ms (general) | `60000` (1 min) |
| `RATE_LIMIT_AUTH_MAX` | Max auth attempts per window | `10` |
| `RATE_LIMIT_AUTH_WINDOW_MS` | Auth window in ms | `900000` (15 min) |
| `RATE_LIMIT_RESET_MAX` | Max password reset requests | `5` |
| `RATE_LIMIT_RESET_WINDOW_MS` | Reset window in ms | `3600000` (1 hour) |
| `RATE_LIMIT_VERIFY_MAX` | Max verification resend requests | `3` |
| `RATE_LIMIT_VERIFY_WINDOW_MS` | Verify window in ms | `3600000` (1 hour) |
| `RATE_LIMIT_INVITE_SEND_MAX` | Per-host hourly cap on corporate invitation sends — covers both bulk `/send-invitations` and individual `/resend` (shared budget). | `200` |
| `RATE_LIMIT_INVITE_SEND_WINDOW_MS` | Invite send window in ms | `3600000` (1 hour) |
| `RATE_LIMIT_INVITE_SEND_DAILY_MAX` | Per-host daily ceiling on corporate invitation sends. Defends against compromised host accounts. | `1000` |
| `RATE_LIMIT_INVITE_SEND_DAILY_WINDOW_MS` | Daily ceiling window in ms | `86400000` (24 hours) |
| `RATE_LIMIT_INVITE_CHECK_MAX` | Per-IP throttle on `GET /auth/check-corporate-invite` (blocks token enumeration). | `20` |
| `RATE_LIMIT_INVITE_CHECK_WINDOW_MS` | Invite-check window in ms | `60000` (1 min) |
| `RATE_LIMIT_INVITE_ACTIVATE_MAX` | Per-IP throttle on `POST /auth/activate-corporate` (blocks token brute-force). | `10` |
| `RATE_LIMIT_INVITE_ACTIVATE_WINDOW_MS` | Activate window in ms | `900000` (15 min) |
| `MP_WEBHOOK_MAX_DRIFT_MS` | Max acceptable timestamp drift on MP webhook HMAC signatures (replay defence). Auto-detects seconds vs ms units. | `300000` (5 min) |
| `CAPACITY_WARNING_THRESHOLD_PCT` | Default percentage of `maxParticipants` at which the host receives the "near full" email. Clamped to 1–99. Overridable per pool via `Pool.capacityWarningThresholdPct`. | `95` |
| `BLOCKED_ATTEMPT_THROTTLE_HOURS` | Throttle window (hours) for the "someone tried to join a full pool" email. One email per pool per window even under flood. | `24` |

#### Branding (Optional)

| Variable | Description |
|----------|-------------|
| `BRAND_COLORS_JSON` | JSON override for brand colors (e.g., `{"primary":"#ff0000"}`) |

#### Feature Flags (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `PREDICTION_STATUS_HOST_ALLOWLIST` | Gradual rollout for the per-match prediction-status feature (ADR-077). `""`/unset → off everywhere; `*` → on for all pools; comma-separated emails → on only for pools whose creator's email is listed. | `""` (off) |

#### Performance — Caching (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_DASHBOARD_CACHE_TTL_MS` | Max age of the persisted admin analytics snapshot before the UI marks it stale (ADR-078). | `300000` (5 min) |
| `POOL_LEADERBOARD_CACHE_TTL_MS` | Max-age safety net for the per-pool overview leaderboard cache (ADR-079). Invalidation is primarily by data fingerprint; this only bounds the rare uncaptured change. **Set to `0` to disable the cache entirely (recompute every request, pre-ADR-079 behaviour) — instant kill-switch.** | `20000` (20 s) |
| `POOL_LEADERBOARD_CACHE_MAX` | Hard cap on the number of pools held in the overview leaderboard cache (memory bound). | `1000` |

#### Payments — Mercado Pago (Colombia / COP)

| Variable | Description | Default |
|----------|-------------|---------|
| `MP_ACCESS_TOKEN` | Mercado Pago access token (production) | (required) |
| `MP_PUBLIC_KEY` | Mercado Pago public key for Payment Brick | (required) |
| `MP_WEBHOOK_SECRET` | Secret for HMAC-SHA256 webhook signature verification | (optional, skips verification if unset) |

#### Payments — Polar.sh (International / USD)

| Variable | Description | Default |
|----------|-------------|---------|
| `POLAR_API_KEY` | Polar API key for checkout creation | (required) |
| `POLAR_WEBHOOK_SECRET` | Secret for Polar webhook signature verification | (required) |

#### Pricing

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_PRICE_COP` | COP price per 50-player block | `28500` |
| `MIN_PRICE_COP` | Minimum COP price per block (volume floor) | `18000` |
| `BASE_PRICE_USD` | USD price per 50-player block | `7.99` |
| `MIN_PRICE_USD` | Minimum USD price per block (volume floor) | `4.99` |
| `CORPORATE_BASE_PRICE_COP` | COP base price for 100 corporate players | `200000` |
| `CORPORATE_BASE_PRICE_USD` | USD base price for 100 corporate players | `49.99` |
| `PERSONAL_FREE_LIMIT` | Max free personal pool capacity | `20` |
| `CORPORATE_FREE_LIMIT` | Max free corporate pool capacity (trial) | `2` |

#### Scores Service

| `SCORES_SERVICE_URL` | Base URL of scraping service | (required for AUTO) |
| `SCORES_SERVICE_API_KEY` | Bearer token for auth | (required for AUTO) |
| `SCORES_SERVICE_TIMEOUT_MS` | HTTP request timeout | `10000` |
| `SCORES_POLL_INTERVAL_MS` | Live scores polling interval | `15000` |
| `SCORES_MIN_CONFIDENCE` | Minimum confidence to publish | `MEDIUM` |
| `SCORES_WINDOW_PRE_HOURS` | Hours before kickoff to poll | `0` |
| `SCORES_WINDOW_PRE_MINUTES` | Minutes buffer for early kickoffs | `5` |
| `SCORES_WINDOW_POST_HOURS` | Hours after kickoff to keep polling | `3` |
| `SCORES_TRACK_WINDOW_HOURS` | Hours ahead to register fixtures | `24` |
| `SCORES_GRACE_PERIOD_MS` | Grace period after FT before finalizing | `300000` |
| `SCORES_FALLBACK_DELAY_MS` | Delay before API-Football fallback | `1800000` |
| `SCORES_SLOW_PATH_AFTER_MS` | Gate SLOW path: MEDIUM-confidence terminal may finalize this long after kickoff (+R9 alert) | `9000000` (150 min) |
| `SCORES_FEED_SILENT_AFTER_KICKOFF_MS` | R14: alert if a tracked match has no feed this long after kickoff | `900000` (15 min) |
| `SCORES_FEED_SILENT_STALE_MS` | R14: how stale lastCheckedAtUtc must be to count as silent | `600000` (10 min) |
| `SCORES_STALE_THRESHOLD_MS` | Age after kickoff a non-finalized match is "stale" (admin alert) | `12600000` |
| `SCORES_STALE_SCAN_INTERVAL_MS` | Stale-detector scan cadence | `300000` |
| `FIXTURE_TRACKING_CRON` | Fixture registration cron schedule | `0 * * * *` |

#### Analytics — Google Analytics 4 Measurement Protocol (server-side)

Server-side GA4 is the failsafe for conversion events that MUST reach
GA4 even if the browser never fires (ad-blocker, tab closed mid-redirect,
webhook-only async flows). When missing, `sendGa4Event` silently
no-ops and startup logs a warning.

| Variable | Description | Default |
|----------|-------------|---------|
| `GA4_MEASUREMENT_ID` | GA4 Measurement ID (`G-XXXXXXXXXX`). Admin → Data Streams → Web. | (required for server-side GA4) |
| `GA4_API_SECRET` | Measurement Protocol API secret. Admin → Data Streams → Web → Measurement Protocol API secrets → Create. | (required for server-side GA4) |
| `GA4_DEBUG` | Set to `1` to route events to `/debug/mp/collect` (validation endpoint that does NOT ingest). | (unset = production endpoint) |

#### Analytics — Meta Conversions API

Server-side Meta CAPI for browser↔server deduplication. All PII is hashed
SHA-256 before leaving the process. When missing, `sendCapiEvent` silently
no-ops.

| Variable | Description | Default |
|----------|-------------|---------|
| `META_PIXEL_ID` | Meta Pixel / Dataset ID (same one used on the browser Pixel). | (required for server-side Meta) |
| `META_CAPI_ACCESS_TOKEN` | Conversions API access token. Events Manager → Settings → Conversions API → Generate Access Token. | (required for server-side Meta) |
| `META_TEST_EVENT_CODE` | Test event code (`TEST12345` shape). When set, events land in Events Manager → Test Events instead of production reports. | (unset = production data) |

#### Analytics — DLQ worker

`capiRetryJob` drains failed server-side events across every provider
via a Postgres advisory lock (multi-instance safe). See
`docs/guides/ANALYTICS_PIPELINE.md` for the full retry ladder.

| Variable | Description | Default |
|----------|-------------|---------|
| `ANALYTICS_RETRY_CRON` | Cron schedule for the drain job. | `*/5 * * * *` |
| `ANALYTICS_RETRY_BATCH_SIZE` | Rows drained per sink per tick. | `20` |

#### Payment Reconcilers / Sweeps

Background sweeps that close the payment and sales-document observability loops. Each is multi-instance safe via a distinct Postgres advisory lock. See Section 7 (Cron Jobs).

| Variable | Description | Default |
|----------|-------------|---------|
| `RECONCILE_CRON` | Cron schedule for the Polar stale-payment reconciler. | `*/30 * * * *` |
| `MP_RECONCILE_CRON` | Cron schedule for the Mercado Pago reconciler. | `*/30 * * * *` |
| `MP_RECONCILE_BATCH_SIZE` | Stale MP rows queried per tick. | `50` |
| `CC_EXPIRY_CRON` | Cron schedule for the AccountReceivable (cuenta de cobro) expiry sweep. | `5 * * * *` |
| `CC_EXPIRY_BATCH_SIZE` | PENDING AccountReceivable rows expired per tick. | `100` |
| `WELCOME_FALLBACK_CRON` | Cron schedule for the deferred welcome-email safety net. | `15 * * * *` |
| `WELCOME_FALLBACK_HOURS` | Account age (hours) after which the fallback ships the welcome email. | `24` |

#### Railway-Injected

| Variable | Description |
|----------|-------------|
| `RAILWAY_GIT_COMMIT_SHA` | Commit SHA (auto-injected by Railway) |

#### Test Accounts (Seed Scripts Only)

| Variable | Description |
|----------|-------------|
| `TEST_ADMIN_EMAIL` | Admin seed email |
| `TEST_ADMIN_PASSWORD` | Admin seed password |
| `TEST_HOST_EMAIL` | Host seed email |
| `TEST_HOST_PASSWORD` | Host seed password |
| `TEST_PLAYER_EMAIL` | Player seed email |
| `TEST_PLAYER_PASSWORD` | Player seed password |

### 2.2 Frontend Service

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.picks4all.com` |
| `NEXT_PUBLIC_SITE_URL` | Frontend URL | `https://picks4all.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID. Required for ANY browser tracking (GA4 tag, consent mode). | `GTM-TJ86QBFG` |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel / Dataset ID. Must match `META_PIXEL_ID` on the backend so browser↔server deduplication works. | `1234567890` |
| `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` | Frontend auto-refresh for live matches | `15000` |
| `NEXT_PUBLIC_EMAIL_DOMAIN` | Email domain for display | `picks4all.com` |
| `NEXT_PUBLIC_DEFAULT_DEADLINE` | Default deadline minutes | `10` |
| `NEXT_PUBLIC_PERSONAL_FREE_LIMIT` | Free tier participant limit (personal) | `20` |
| `NEXT_PUBLIC_CORPORATE_FREE_LIMIT` | Free tier participant limit (corporate). MUST match the backend `CORPORATE_FREE_LIMIT` (env, default `2`). The wizard's CapacitySelector uses this as the "free trial" tier label. | `2` |
| `NEXT_PUBLIC_BASE_PRICE_COP` | Base price per 50-player block (COP) | `28000` |
| `NEXT_PUBLIC_CORPORATE_BASE_PRICE_COP` | Base price for corporate pools (COP) | `200000` |

---

## 3. Cloudflare DNS Configuration

Both domains use Cloudflare DNS with CNAME records pointing to Railway:

| Record | Type | Name | Target | Proxy |
|--------|------|------|--------|:-----:|
| Frontend | CNAME | `picks4all.com` | Railway CNAME target | Yes |
| Frontend www | CNAME | `www` | Railway CNAME target | Yes |
| Backend API | CNAME | `api` | Railway CNAME target | Yes |

**Email routing:** Cloudflare Email Routing handles incoming email addresses (16+ addresses + catch-all) forwarding to the team. SPF record includes `send.resend.com` for outbound transactional email.

**SSL:** Cloudflare provides edge SSL. Railway provides origin SSL. Full (strict) mode enabled.

---

## 4. Deploy Process

### Standard Deploy (Git Push)

Both services auto-deploy on push to `main`:

```bash
git push origin main
```

Railway watches the repository and triggers builds automatically. The backend builds via the `railway.toml` config; the frontend builds via Railway's Nixpacks auto-detection of Next.js.

### Monitor Deployment

Use the Railway dashboard or CLI:

```bash
railway logs          # View real-time logs
railway status        # Service status
```

### Verify Deployment

```bash
curl https://api.picks4all.com/health
```

Expected:

```json
{ "ok": true, "version": "v1.0.0", "commit": "abc1234", "timestamp": "..." }
```

---

## 5. Running Seeds Against Production

Use `railway run` to execute scripts with production environment variables:

```bash
# From the backend/ directory
cd backend

railway run npm run seed:admin
railway run npm run seed:test-accounts
railway run npm run seed:legal
railway run npm run seed:wc2026-sandbox
railway run npm run seed:ucl2025
railway run npm run init:smart-sync
```

Maintenance / data scripts (run as needed, not part of routine deploys):

```bash
railway run npm run script:fetch-ucl          # Fetch UCL fixture data
railway run npm run script:update-ucl-draw    # Update UCL round-of-16 draw
railway run npm run script:migrate-extra-time # Backfill extra-time config
```

**Warning:** Seed scripts are idempotent but should be used carefully in production. Always verify the seed script's behavior before running.

---

## 6. Running Prisma Commands Against Production

```bash
cd backend
railway run npx prisma studio     # Opens DB GUI (connects to prod)
railway run npx prisma migrate deploy  # Apply pending migrations
```

---

## 7. Monitoring

### Health Endpoint

`GET /health` returns version, commit SHA, and timestamp. No authentication required. Excluded from rate limiting.

### Cron Jobs

Thirteen background jobs run automatically (all started in `server.ts`, configured via env-var cron expressions):

| Job | Default schedule | Purpose |
|-----|------------------|---------|
| Live Scores (`liveScoresJob`) | 15 s during match windows | **Primary** results channel — polls picks4all-scores. Gated by `PlatformSettings.scoresServiceEnabled`. |
| Smart Sync (`smartSyncJob`) | `SMART_SYNC_CRON` (default `* * * * *`) | API-Football fallback — only publishes results the scraper hasn't already reported. |
| Phase Sync (`phaseSyncJob`) | `PHASE_SYNC_CRON` (default `0 8,20 * * *`) | Drains the `PendingPhaseSync` queue. |
| Deadline Reminders (`deadlineReminderJob`) | `DEADLINE_REMINDER_CRON` (default `0 12 * * *`) | Sends 48h pre-kickoff reminders (excludes muted pools). |
| Fixture Tracking (`fixtureTrackingJob`) | `FIXTURE_TRACKING_CRON` (default `0 * * * *`) | Registers upcoming fixtures with picks4all-scores. |
| Fixture Verification (`fixtureVerificationJob`) | `FIXTURE_VERIFY_CRON` (default `0 6 * * *`) | Re-verifies external mappings stay aligned. |
| New-Member Digest (`newMemberDigestJob`) | `NEW_MEMBER_DIGEST_CRON` (default `0 13 * * *`) | Daily host digest of new joiners. |
| CAPI Retry (`capiRetryJob`) | `ANALYTICS_RETRY_CRON` (default `*/5 * * * *`) | Drains the `FailedAnalyticsEvent` DLQ. Postgres advisory lock (`82636502`) makes multi-replica deploys safe. |
| Track Status (`trackStatusCheckerJob`) | `TRACK_STATUS_CHECK_CRON` (default `* * * * *`) | External status monitoring. |
| Polar Reconciler (`paymentReconcileJob`) | `RECONCILE_CRON` (default `*/30 * * * *`) | Sweeps INITIATED/PENDING `PoolPayment` rows past the grace period, queries Polar for canonical state, and flags stuck rows for review. Advisory lock `82636503`. |
| MP Reconciler (`mpPaymentReconcileJob`) | `MP_RECONCILE_CRON` (default `*/30 * * * *`) | Mercado Pago equivalent — sweeps stale MP rows (batch `MP_RECONCILE_BATCH_SIZE`, default 50) and auto-completes `approved` payments via `markPaymentCompleted`. Advisory lock `82636506`. |
| AccountReceivable Expiry (`accountReceivableExpiryJob`) | `CC_EXPIRY_CRON` (default `5 * * * *`) | Flips PENDING `AccountReceivable` (cuenta de cobro) rows past `validUntil` to EXPIRED (batch `CC_EXPIRY_BATCH_SIZE`, default 100). Advisory lock `82636504`. |
| Welcome Email Fallback (`welcomeEmailFallbackJob`) | `WELCOME_FALLBACK_CRON` (default `15 * * * *`) | Ships the welcome email `WELCOME_FALLBACK_HOURS` (default 24) after signup for users who never completed the `LocalePreferenceModal` handoff. Advisory lock `82636505`. |

`resultSyncJob.ts` is **not** a scheduled job — its `start`/`stop`/`triggerManual` exports were removed as dead code. Only `getJobStatus()` survives, consumed by the admin instance UI. SmartSync + Live Scores are the active sync mechanisms.

All jobs log their activity to stdout (visible in Railway logs).

### Railway Dashboard

- **Metrics:** CPU, memory, network usage per service.
- **Logs:** Real-time and historical logs for each service.
- **Variables:** Environment variable management per service.
- **Deployments:** Build history, rollback to previous deploys.

### Key Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[LiveScoresJob]` | picks4all-scores polling tick |
| `[SmartSyncJob]` | API-Football fallback execution |
| `[PhaseSyncJob]` | Phase sync retry attempts |
| `[DeadlineReminderJob]` | Deadline reminder processing |
| `[NewMemberDigestJob]` | Daily new-member digest send |
| `[FixtureTrackingJob]` / `[FixtureVerifyJob]` | Fixture registration / verification |
| `[CapiRetryJob]` | DLQ drainer tick |
| `[TrackStatusCheck]` | External status monitor |
| `Server running on port` | Backend startup |
| `Environment validation failed` | Missing required env var |

### Internal Notifications

The system routes operator-facing notifications to one of four mailboxes
based on a category, so each concern lands in a dedicated Gmail label:

| Category | Default inbox | Triggered by |
|----------|---------------|--------------|
| `feedback` | `SUPPORT_NOTIFICATION_EMAIL` | New beta feedback / bug report submitted by a user |
| `corporate_inquiry` | `ENTERPRISE_NOTIFICATION_EMAIL` | Lead-form submission on `/empresas` |
| `corporate_pool_created` | `ENTERPRISE_NOTIFICATION_EMAIL` | A corporate pool is created via the wizard |
| `payment_completed` | `SALES_NOTIFICATION_EMAIL` + `ADMIN_NOTIFICATION_EMAIL` | A payment is confirmed (Polar / Mercado Pago) |
| `system_event` | `ADMIN_NOTIFICATION_EMAIL` | Phase advanced, fixtures updated, sync resolved |
| `error` | `ADMIN_NOTIFICATION_EMAIL` | Phase sync failed, fixture tracking job failed, etc. |

Any unset category-specific env var falls back to `ADMIN_NOTIFICATION_EMAIL`,
so an unconfigured environment never silently drops notifications.

---

## 8. Rollback

Railway supports instant rollback to any previous deployment via the dashboard. Click the deployment in the history and select "Rollback".

For database rollbacks, Prisma migrations must be rolled back manually:

```bash
cd backend
railway run npx prisma migrate resolve --rolled-back <migration_name>
```
