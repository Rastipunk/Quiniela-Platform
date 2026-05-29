## Audit: docs/guides/ANALYTICS_PIPELINE.md

**Overall verdict: KEEP (minor) — the doc is an unusually accurate, code-faithful description of the analytics pipeline. Every structural claim verified against source. Only two small omissions and one cosmetic nit; no obsolete or incorrect content.**

Verified against:
- `backend/src/lib/ga4.ts`
- `backend/src/lib/metaCapi.ts`
- `backend/src/jobs/capiRetryJob.ts`
- `backend/prisma/schema.prisma` (`FailedAnalyticsEvent` model @ L1417, `PoolPayment.metaEventId` @ L1293)
- `backend/src/services/paymentService.ts` (markPaymentCompleted, MP/Polar emission)
- `backend/src/routes/analyticsHealth.ts`

### Confirmed accurate (no change needed)
- File table (`metaCapi.ts`, `ga4.ts`, `../jobs/capiRetryJob.ts`) is correct. The cron job file is literally named `capiRetryJob.ts` even though it now drains both sinks (its internal logger tag is `[AnalyticsRetryJob]`).
- In-process retry shape: `MAX_IN_PROCESS_RETRIES = 3`, `IN_PROCESS_BACKOFF_MS = [1000, 2000, 4000]`, ±25% jitter — matches both `ga4.ts` and `metaCapi.ts` exactly.
- DLQ backoff `DLQ_BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440, 1440]` with `MAX_DLQ_ATTEMPTS = 8` and ±20% jitter — matches the doc's "attempt 1→8" ladder exactly (1m / 5m / 15m / 1h / 4h / 12h / 24h / 24h).
- `isPermanentFailure(status)`: drops on generic 4xx (incl. 400/404), KEEPS 401/403/408/429 — matches both clients verbatim.
- Advisory lock: `pg_try_advisory_xact_lock(82636502)` (`ADVISORY_LOCK_KEY = 82636502n`) inside a `$transaction` — exactly as the "Cluster safety" section states.
- 30-day purge of resolved rows (`DLQ_RETENTION_DAYS = 30`, `purgeOldResolvedRows`) runs in the same cron — correct.
- LDU/`data_processing_options: ["LDU"]` for `EEA_COUNTRY_CODES` (includes GB and CH) — correct; code also sets `data_processing_options_country/state = 0`.
- PII hashing: SHA-256, phone digits-only (`normalisePhone`), DOB→YYYYMMDD (`normaliseDob`), gender→m/f (`normaliseGender`, note: maps to m/f only, not "o") — substantially correct.
- Event dedup: `PoolPayment.metaEventId` persisted at completion (`markPaymentCompleted` in paymentService.ts ~L638/663), reused by the MP path (re-read at L2356-2365 for the Brick browser response) and the Polar/MP refund paths — matches "browser exitoso page, Polar webhook, MP IPN re-emit with the same id."
- Env-var table matches: GA4 noops without `GA4_MEASUREMENT_ID`/`GA4_API_SECRET`; CAPI noops without `META_PIXEL_ID`/`META_CAPI_ACCESS_TOKEN`; `ANALYTICS_RETRY_CRON` defaults to `*/5 * * * *`; `ANALYTICS_RETRY_BATCH_SIZE` defaults to 20.

### Findings

#### 1. Missing — admin analytics health probe endpoint
- Type: missing
- The doc never mentions `backend/src/routes/analyticsHealth.ts`, which exposes `GET /admin/analytics/probe` (admin-only). It fires synthetic events at each sink against the real APIs (GA4 `debug/mp/collect` validation endpoint, Meta `/events` with `test_event_code`) and reports presence (not values) of every analytics env var. There is also a frontend surface (`frontend-next/src/components/AnalyticsHealthContent.tsx`, page at `admin/analytics-health/page.tsx`). This is the operational "is tracking wired correctly right now?" tool for this exact pipeline and belongs in the guide.
- Fix: add a short "Health probe" section pointing to `analyticsHealth.ts` / `GET /admin/analytics/probe` and the admin page, noting GA4 hits the validation-only endpoint and Meta hits Test Events.

#### 2. Missing — legacy env-var fallbacks for cron/batch size
- Type: missing
- `capiRetryJob.ts` reads `process.env.ANALYTICS_RETRY_CRON || process.env.CAPI_RETRY_CRON` and `ANALYTICS_RETRY_BATCH_SIZE || CAPI_RETRY_BATCH_SIZE`. The doc lists only the `ANALYTICS_*` names, omitting the `CAPI_*` legacy aliases that are still honored.
- Fix: note in the env-var table that `CAPI_RETRY_CRON` / `CAPI_RETRY_BATCH_SIZE` are accepted as legacy fallbacks.

#### 3. Cosmetic — GA4 debug endpoint path leading slash
- Type: incorrect (cosmetic)
- The env table says `GA4_DEBUG=1` "Routes GA4 MP to `/debug/mp/collect`". In `ga4.ts` the path is built as `debug/mp/collect` (no leading slash) appended to `https://www.google-analytics.com/`. Functionally identical; only the literal string differs.
- Fix: drop the leading slash for exactness, or leave as-is (negligible).

### Notes (not findings)
- Code comments in `metaCapi.ts` still reference a `FailedCapiEvent` table in prose (header comment L4-6), but the actual Prisma model and all `prisma.failedAnalyticsEvent.*` calls use `FailedAnalyticsEvent`. The DOC correctly says `FailedAnalyticsEvent`, so this is a source-comment nit, not a doc defect.
- The doc's gender mapping mentions "m/f/o" but the code (`normaliseGender`) only emits m/f (returns undefined otherwise). Minor over-statement, not worth a fix.
