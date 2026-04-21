# Analytics pipeline

This directory owns the server-side half of the tracking stack. Browser
events route through GTM → GA4 / Meta Pixel directly; the files here
handle the **server-emitted** equivalents, the failure queue, and the
compliance knobs.

## Files

| File                 | Role                                                              |
|----------------------|-------------------------------------------------------------------|
| `metaCapi.ts`        | Meta Conversions API client. Hashes PII, sends events, retries.   |
| `ga4.ts`             | Google Analytics 4 Measurement Protocol client. Same retry shape. |
| `../jobs/capiRetryJob.ts` | Cron worker that drains `FailedAnalyticsEvent` rows across sinks. |

Browser-side counterparts live in `frontend-next/src/lib/`:
`analytics.ts` (dataLayer + gtag), `metaPixel.ts` (fbq), `gtm.ts`
(head-inlined Consent Mode defaults).

## Event dedup

Every event that has BOTH a browser and a server emission carries an
`eventId` (Meta) or `transaction_id` (GA4) shared across channels.
Meta collapses by `event_id` + `event_name` + `event_time`; GA4
collapses by `transaction_id` (purchase / refund).

For payments this id is persisted on `PoolPayment.metaEventId` at
approval time so the browser `exitoso` page, the Polar webhook, and
the MP IPN all re-emit with the same id.

## Retry + DLQ

```
sendCapiEvent / sendGa4Event
      │
      ├─ attempt 0  (inline)                1s  +/- 25% jitter
      ├─ attempt 1  (inline)                2s  +/- 25% jitter
      ├─ attempt 2  (inline)                4s  +/- 25% jitter
      │      all failed?
      ▼
  FailedAnalyticsEvent row
      │
      └─ cron */5 min  →  Postgres advisory lock  →  batch of 20
                    │
                    ├─ attempt 1 →  retry at +1 min   (± 20% jitter)
                    ├─ attempt 2 →  retry at +5 min
                    ├─ attempt 3 →  retry at +15 min
                    ├─ attempt 4 →  retry at +1 h
                    ├─ attempt 5 →  retry at +4 h
                    ├─ attempt 6 →  retry at +12 h
                    └─ attempt 7-8 → retry at +24 h (max)
```

`isPermanentFailure(status)` drops events on 400 / 404 (payload
malformed, pixel id gone) and KEEPS them for 401 / 403 / 408 / 429
(auth rotation, rate limit, transient). Resolved rows are purged
after 30 days by the same cron job.

## Cluster safety

The DLQ worker acquires `pg_try_advisory_xact_lock(82636502)` before
draining. Multi-replica Railway deployments therefore serialise at
most one drainer per cron tick, avoiding double-sends.

## Compliance (Consent Mode v2 + LDU)

- GA4 MP always sends; GA4 property's own Consent Mode config respects
  signals independently.
- Meta CAPI sets `data_processing_options: ["LDU"]` for EEA + UK + CH
  (Switzerland aligned via revFADP). See `EEA_COUNTRY_CODES` in
  `metaCapi.ts`.
- PII is hashed SHA-256 before leaving the process. Phone digits only,
  DOB compacted to YYYYMMDD, gender mapped to `m/f/o`.

## Adding a new sink

1. Create `backend/src/lib/<sink>.ts` exposing `send<Sink>Event()` with
   the same retry-then-DLQ shape. Use a new `provider` value on
   `FailedAnalyticsEvent` rows.
2. Export `retryFailed<Sink>EventsBatch(batchSize)` that reads its
   own provider from `FailedAnalyticsEvent`.
3. Register it in `capiRetryJob.ts`'s `Promise.allSettled` block.

## Env vars

| Var                         | Effect when missing                                    |
|-----------------------------|--------------------------------------------------------|
| `GA4_MEASUREMENT_ID`        | `sendGa4Event` noops silently (startup logs a warning) |
| `GA4_API_SECRET`            | same                                                   |
| `GA4_DEBUG=1`               | Routes GA4 MP to `/debug/mp/collect` (no ingestion)    |
| `META_PIXEL_ID`             | `sendCapiEvent` noops silently                         |
| `META_CAPI_ACCESS_TOKEN`    | same                                                   |
| `META_TEST_EVENT_CODE`      | Events bypass Events Manager Test Events tab          |
| `ANALYTICS_RETRY_CRON`      | Defaults to `*/5 * * * *`                              |
| `ANALYTICS_RETRY_BATCH_SIZE`| Defaults to `20`                                       |
