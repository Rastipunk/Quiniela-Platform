# Production Deployment
# Picks4All

> **Last Updated:** 2026-04-04

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

**Build configuration (`railway.toml`, backend only):**

```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install && npm run build"

[deploy]
startCommand = "cd backend && npm run start"
```

The backend `npm run start` command runs Prisma migrations automatically before starting the server:

```
prisma migrate resolve --rolled-back <migration> || true && prisma migrate deploy && node dist/server.js
```

The frontend service is configured in Railway's dashboard (no `railway.toml`). It uses Next.js standalone output mode.

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

#### Domain and CORS

| Variable | Description | Default |
|----------|-------------|---------|
| `SITE_DOMAIN` | Primary domain (used for CORS origins) | `picks4all.com` |
| `CORS_EXTRA_ORIGINS` | Comma-separated additional CORS origins | - |

#### Email (Resend)

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key | `re_xxx` |
| `RESEND_FROM_EMAIL` | Sender email address | `Picks4All <noreply@picks4all.com>` |
| `ADMIN_NOTIFICATION_EMAIL` | Admin alert recipient | `admin@picks4all.com` |

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
| `RATE_LIMIT_CORP_INVITE_MAX` | Max corporate invite requests | `5` |
| `RATE_LIMIT_CORP_INVITE_WINDOW_MS` | Corp invite window in ms | `3600000` (1 hour) |

#### Branding (Optional)

| Variable | Description |
|----------|-------------|
| `BRAND_COLORS_JSON` | JSON override for brand colors (e.g., `{"primary":"#ff0000"}`) |

#### Scores Service (picks4all-scores)

| Variable | Description | Default |
|----------|-------------|---------|
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
| `FIXTURE_TRACKING_CRON` | Fixture registration cron schedule | `0 * * * *` |

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
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID | `GTM-TJ86QBFG` |
| `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` | Frontend auto-refresh for live matches | `15000` |
| `NEXT_PUBLIC_EMAIL_DOMAIN` | Email domain for display | `picks4all.com` |
| `NEXT_PUBLIC_DEFAULT_DEADLINE` | Default deadline minutes | `10` |
| `NEXT_PUBLIC_PERSONAL_FREE_LIMIT` | Free tier participant limit (personal) | `20` |
| `NEXT_PUBLIC_CORPORATE_FREE_LIMIT` | Free tier participant limit (corporate) | `100` |
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
{ "version": "v0.6.0", "commit": "abc1234", "timestamp": "..." }
```

---

## 5. Running Seeds Against Production

Use `railway run` to execute scripts with production environment variables:

```bash
# From the backend/ directory
cd backend

railway run npm run seed:admin
railway run npm run seed:legal
railway run npm run seed:wc2026-sandbox
railway run npm run seed:ucl2025
railway run npm run init:smart-sync
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

Three background jobs run automatically:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Smart Sync | Every minute | Polls API-Football for match results |
| Phase Sync | Every 12 hours (08:00/20:00 UTC) | Retries pending phase configurations |
| Deadline Reminders | Daily (12:00 UTC) | Sends pick reminders for upcoming matches |

All jobs log their activity to stdout (visible in Railway logs).

### Railway Dashboard

- **Metrics:** CPU, memory, network usage per service.
- **Logs:** Real-time and historical logs for each service.
- **Variables:** Environment variable management per service.
- **Deployments:** Build history, rollback to previous deploys.

### Key Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[SmartSyncJob]` | Smart Sync execution |
| `[PhaseSyncJob]` | Phase sync retry attempts |
| `[DeadlineReminderJob]` | Deadline reminder processing |
| `Server running on port` | Backend startup |
| `Environment validation failed` | Missing required env var |

### Admin Notifications

The system sends admin notification emails (to `ADMIN_NOTIFICATION_EMAIL`) for:

- New corporate inquiries.
- Phase sync resolutions and failures.
- New user feedback submissions.

---

## 8. Rollback

Railway supports instant rollback to any previous deployment via the dashboard. Click the deployment in the history and select "Rollback".

For database rollbacks, Prisma migrations must be rolled back manually:

```bash
cd backend
railway run npx prisma migrate resolve --rolled-back <migration_name>
```
