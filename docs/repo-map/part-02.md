## Batch 2

This batch covers the backend cron/background jobs (`backend/src/jobs/`) and a slice of the shared library layer (`backend/src/lib/`), including their colocated Vitest suites.

---

### backend/src/jobs/fixtureTrackingJob.ts

**Purpose:** Hourly node-cron job that tells the external `picks4all-scores` scraping service which upcoming fixtures to watch, so live scores are available the moment matches start.

**What it does:**
- **Configuration:** `FIXTURE_TRACKING_CRON` (default `0 * * * *`, hourly). `SCORES_TRACK_WINDOW_HOURS` (default 24) controls how far ahead to look. `isPlaceholderTeamId(id)` returns true for unresolved knockout placeholders (`W_`, `RU_`, `3rd_`) which the scraper cannot match.
- **Job state:** module-level `scheduledTask` and `isRunning` guard against overlap.
- **`runFixtureTracking()`** (core): (1) reads `PlatformSettings` singleton, bails if `scoresServiceEnabled` is false; (2) gets `getScoresServiceClient()`, bails if `isAvailable()` is false; (3) queries `TournamentInstance` rows that are `resultSourceMode=AUTO`, `syncEnabled`, `status=ACTIVE`, pulling `dataJson`, league/season IDs, and `matchMappings`; (4) builds a window from now-3h to now+`SCORES_TRACK_WINDOW_HOURS`, walks each instance's `dataJson.matches`, skips matches without kickoff, outside window, or with placeholder teams, and assembles `TrackFixture` payloads (resolving team API IDs from mapping with `dataJson` fallback); (5) dedups against `MatchSyncState` rows whose `trackedAtUtc` is already set; (6) POSTs the new fixtures via `client.trackFixtures()`; (7) reads back per-fixture `details`, marks `TRACKING`/`ALREADY_TRACKING` internal IDs as `trackedAtUtc=now` in `MatchSyncState`, and collects `REJECTED` ones; (8) emails the admin via `sendAdminNotification` for any rejections, and on any thrown error. Both notification calls are fire-and-forget with their own `.catch` logging so a broken email pipeline cannot mask job failures.
- **Public API:** `startFixtureTrackingJob()` schedules the cron and runs immediately on startup; `stopFixtureTrackingJob()` stops it; `triggerFixtureTracking()` runs a single pass on demand (admin panel).

**Exports:** `startFixtureTrackingJob`, `stopFixtureTrackingJob`, `triggerFixtureTracking`.

**Key dependencies:** `node-cron`, `prisma` (`../db`), `getScoresServiceClient`/`TrackFixture` (`../services/scoresService`), `sendAdminNotification` (`../lib/email`).

**Flags:** none.

---

### backend/src/jobs/fixtureVerificationJob.ts

**Purpose:** Daily (06:00 UTC) job that compares our stored kickoff times/venues against what picks4all-scores observes from live sources and alerts the admin on drift — it deliberately does NOT auto-update, because changing kickoffs would invalidate already-made picks.

**What it does:**
- **Configuration:** `FIXTURE_VERIFY_CRON` (default `0 6 * * *`); `DRIFT_THRESHOLD_MS` (default 30 min).
- **`DriftReport` interface:** describes a detected mismatch (fixtureId, teams, registered vs observed kickoff, drift minutes, venue).
- **`runFixtureVerification()`:** guarded by `isRunning`; checks the platform toggle and client availability; queries AUTO+syncEnabled+ACTIVE instances that have both `apiFootballLeagueId` and `apiFootballSeasonId`. For each instance it calls `client.getFixturesVerify({ league, season })`, maps our `dataJson` matches by mapping ID, and for each verified fixture computes `|observed - ours|`; anything over the threshold becomes a `DriftReport`. All drifts are compiled into an HTML table and emailed via `sendAdminNotification` (category `error`). Per-instance errors are caught and logged so one bad instance doesn't abort the run.
- **Public API:** `startFixtureVerificationJob()`, `stopFixtureVerificationJob()`, `triggerFixtureVerification()`. Note: unlike the tracking job, this one does NOT run immediately on startup.

**Exports:** `startFixtureVerificationJob`, `stopFixtureVerificationJob`, `triggerFixtureVerification`.

**Key dependencies:** `node-cron`, `prisma`, `getScoresServiceClient`, `sendAdminNotification`.

**Flags:** none.

---

### backend/src/jobs/liveScoresJob.ts

**Purpose:** The core real-time integration with picks4all-scores. A 15-second `setInterval` poll loop that fetches live scores and publishes `SCRAPER_PROVISIONAL` results into pools, then upgrades them to `API_CONFIRMED` once a grace period elapses.

**What it does:**
- **Configuration:** `SCORES_POLL_INTERVAL_MS` (15s), `SCORES_MIN_CONFIDENCE` (default `MEDIUM`). Active polling window: `WINDOW_PRE_MS` (max of `SCORES_WINDOW_PRE_HOURS`/`SCORES_WINDOW_PRE_MINUTES`, default 5 min — scraper only returns data for matches that have started, so pre-kickoff polling is wasteful) and `WINDOW_POST_MS` (`SCORES_WINDOW_POST_HOURS`, default 3h, to catch ET/penalties/late finishers). `CONFIDENCE_LEVELS` maps the confidence enum to a numeric hierarchy for thresholding.
- **`buildFixtureMap()`:** returns `Map<apiFootballFixtureId, FixtureMapEntry>` for all matches in AUTO/syncEnabled/ACTIVE instances whose kickoff falls inside the window and which belong to at least one ACTIVE pool. Each entry carries `internalMatchId`, `tournamentInstanceId`, `poolIds[]`, `kickoffUtc`.
- **`processLiveScore(entry, score)`:** the per-match state machine. Reads `MatchSyncState`, logs real-time kickoff drift > 30 min, then computes the new sync status using grace-period logic: when FT (`FINISHED_STATUSES`) is first seen it enters `AWAITING_FINISH` and sets `graceEndUtc = now + SCORES.GRACE_PERIOD_MS`; once grace expires it becomes `COMPLETED` and `shouldFinalize=true`; if the score changes during grace it resets `graceEndUtc` to null (match not actually over); otherwise `IN_PROGRESS`. It persists live data (`lastApiStatus`, `lastElapsed`, `lastExtra`, `lastLiveDataJson`, status, grace/completed timestamps) to `MatchSyncState`, then for each pool calls `finalizeResult` (when finalizing) or `publishScraperResult`.
- **`publishScraperResult(...)`:** skips when current version is already `API_CONFIRMED` or `HOST_OVERRIDE` (authoritative), and skips when an existing `SCRAPER_PROVISIONAL` has an identical score. For AET/PEN it records the 90-minute score in `homeGoals90`/`awayGoals90`. It builds an `externalDataJson` snapshot, then in a `$transaction` row-locks the `PoolMatchResult` header (`SELECT ... FOR UPDATE`), creates a new `PoolMatchResultVersion` (`source=SCRAPER_PROVISIONAL`, incremented `versionNumber`, `status=PUBLISHED`) and points `currentVersionId` at it. Emits a `RESULT_SYNCED_FROM_SCRAPER` audit event via `fireAndForget`. When the match is finished it fire-and-forgets `transitionToCompleted(poolId, null)` — the fix for AUTO pools previously stuck in ACTIVE forever once the scraper finalised the last match (idempotent).
- **`finalizeResult(...)`:** runs after the grace period; only acts when current source is `SCRAPER_PROVISIONAL`. In a transaction it clones the current version's scores into a new version with `source=API_CONFIRMED` (the authoritative result), writes a `RESULT_FINALIZED_BY_SCRAPER` audit event, then fire-and-forgets `autoPublishStructuralResults` (Estratega: derive GROUP_STANDINGS / KNOCKOUT_WINNER structural results, runs before advancement so the trigger sees fresh data), `checkAndTriggerAdvancement`, and a second idempotent `transitionToCompleted`.
- **`pollLiveScores()`:** the tick body — checks platform toggle + client, builds the fixture map (early-exits if empty), calls `client.getLiveScores()`, filters out scores below `MIN_CONFIDENCE`, and processes each matching fixture.
- **Public API:** `startLiveScoresJob()` (sets the interval with an `isRunning` re-entrancy guard), `stopLiveScoresJob()`, `triggerManualPoll()`.

**Exports:** `startLiveScoresJob`, `stopLiveScoresJob`, `triggerManualPoll`.

**Key dependencies:** `Prisma`, `prisma`, `getScoresServiceClient`/`LiveScore`, `writeAuditEvent` (`../lib/audit`), `fireAndForget` (`../lib/asyncHelpers`), `FINISHED_STATUSES` (`../services/apiFootball/types`), `SCORES` (`../lib/constants`), `checkAndTriggerAdvancement`, `transitionToCompleted` (`../services/poolStateMachine`), `autoPublishStructuralResults`.

**Flags:** none. (Uses `as any` casts on `syncStatus`/`LiveScore["confidence"]` — pragmatic, not dead code.)

---

### backend/src/jobs/mpPaymentReconcileJob.ts

**Purpose:** Mercado Pago payment reconciliation sweep — the MP mirror of the Polar `paymentReconcileJob`. Closes the MP success-path observability loop where an IPN lost during a deploy left `PoolPayment` rows stuck in PENDING forever.

**What it does:**
- **Configuration:** `MP_RECONCILE_CRON` (default `*/30 * * * *`), `MP_RECONCILE_BATCH_SIZE` (default 50, a flood guardrail). `ADVISORY_LOCK_KEY = 82636506n` — distinct from the Polar reconciler (82636503), CAPI retry (82636502), CC-expiry (82636504), and welcome fallback (82636505) so all jobs run concurrently across replicas without blocking.
- **`runWithClusterLock(action)`:** wraps work in a `$transaction` that takes `pg_try_advisory_xact_lock`; if another replica holds it, the tick is silently skipped. Lock auto-releases at transaction end.
- **`runOnce()`:** `isRunning`-guarded; finds stale MP payments via `findStaleMpPayments(batch)`, early-exits if none, then per row calls `reconcileStaleMpPayment(id)` (the service decides the transition, querying MP `getPayment` and a `searchPaymentByExternalReference` fallback for legacy rows with NULL `mpPaymentId`), tallying outcomes and logging non-NOOP transitions. Per-row errors are caught so one failure doesn't abort the tick.
- **Public API:** `startMpPaymentReconcileJob()`, `stopMpPaymentReconcileJob()`, and `runOnce` re-exported as `runMpReconcileOnce` for tests/backfills.

**Exports:** `startMpPaymentReconcileJob`, `stopMpPaymentReconcileJob`, `runMpReconcileOnce`.

**Key dependencies:** `node-cron`, `prisma`, `findStaleMpPayments`/`reconcileStaleMpPayment` (`../services/paymentService`).

**Flags:** none. (This is the Mercado Pago path that supersedes the now-deprecated Wompi gateway; it is current, live code.)

---

### backend/src/jobs/newMemberDigestJob.ts

**Purpose:** Daily host digest cron (default 18:00 UTC ≈ 1 PM Colombia) that fires two independent flows: "X people joined your pool" and "X people are waiting for your approval".

**What it does:**
- **Configuration:** `DAILY_DIGEST_CRON` falling back to the legacy `NEW_MEMBER_DIGEST_CRON` env var (kept "for one release") then `0 18 * * *`. Timing chosen so Colombian hosts get it in business hours and EU hosts before dinner.
- **`runDailyDigests()`:** `isRunning`-guarded; sequentially calls `processNewMemberDigest()` then `processPendingApprovalDigest()` (the latter has a 7-day-streak throttle in its service), logging pools processed / emails sent / skipped / failed for each.
- **Public API:** `startNewMemberDigestJob()`, `stopNewMemberDigestJob()`. There is no manual-trigger export.

**Exports:** `startNewMemberDigestJob`, `stopNewMemberDigestJob`.

**Key dependencies:** `node-cron`, `processNewMemberDigest`/`processPendingApprovalDigest` (`../services/newMemberDigestService`).

**Flags:** `NEW_MEMBER_DIGEST_CRON` is an explicitly-temporary legacy env alias — a planned cleanup item, not dead code yet.

---

### backend/src/jobs/paymentReconcileJob.ts

**Purpose:** Polar payment reconciliation sweep (feature F-14). Transitions stale `INITIATED`/`PENDING` `PoolPayment` rows by querying Polar for the true checkout state, closing the funnel-observability gap where abandoned checkouts lived forever.

**What it does:**
- **Configuration:** `RECONCILE_CRON` (default `*/30 * * * *`), `RECONCILE_BATCH_SIZE` (default 50). `ADVISORY_LOCK_KEY = 82636503n` (distinct from CAPI retry 82636502).
- **`runWithClusterLock(action)`:** identical advisory-lock pattern to the MP job (different key) — only one replica per tick runs the batch.
- **`runOnce()`:** `isRunning`-guarded; `findStalePayments(batch)` with early exit when empty; per row `reconcileStalePayment(id)` (one Polar HTTP call each) tallying outcomes and logging non-NOOP transitions; per-row errors caught so they don't abort the tick.
- **Public API:** `startPaymentReconcileJob()`, `stopPaymentReconcileJob()`, and `runOnce` re-exported as `runReconcileOnce`.

**Exports:** `startPaymentReconcileJob`, `stopPaymentReconcileJob`, `runReconcileOnce`.

**Key dependencies:** `node-cron`, `prisma`, `findStalePayments`/`reconcileStalePayment` (`../services/paymentService`).

**Flags:** none. (Nearly identical structure to `mpPaymentReconcileJob` — intentional Polar/MP parity, not accidental duplication.)

---

### backend/src/jobs/phaseSyncJob.ts

**Purpose:** Twice-daily (08:00 & 20:00 UTC) job that (1) retries `PendingPhaseSync` records — knockout phases whose next-round fixtures weren't yet available in API-Football (e.g. draw not made) — and (2) re-verifies upcoming fixtures for AUTO instances 1-3 days before kickoff.

**What it does:**
- **Configuration:** `PHASE_SYNC_CRON` (default `0 8,20 * * *`).
- **`runPhaseSyncCheck()`:** early-returns when `isApiFootballEnabled()` is false (knockout fixtures are resolved by `instanceAdvancement` with synthetic IDs in that mode). Otherwise: pulls `PendingPhaseSync` rows with `status=PENDING`, and per record calls `syncNextPhaseFromApi(instanceId, nextPhase)`. On success it marks the record `RESOLVED` (increment attempts, set resolved/lastAttempt timestamps) and emails the admin (`system_event`). On failure it increments attempts and, after ≥28 attempts (~14 days), marks it `FAILED` and emails an `error` notification requesting manual intervention; otherwise it just records the latest error message. The second half runs `smartSync.verifyUpcomingFixtures(instance.id)` for every AUTO/syncEnabled instance in ACTIVE/COMPLETED when SmartSync is available, to catch date/team changes before kickoff. Each half is wrapped in its own try/catch.
- **Public API:** `startPhaseSyncJob()`, `stopPhaseSyncJob()`, `triggerPhaseSyncCheck()`.

**Exports:** `startPhaseSyncJob`, `stopPhaseSyncJob`, `triggerPhaseSyncCheck`.

**Key dependencies:** `node-cron`, `prisma`, `syncNextPhaseFromApi` (`../services/adminInstanceService`), `sendAdminNotification`, `getSmartSyncService` (`../services/smartSync`), `isApiFootballEnabled` (`../services/apiFootball`).

**Flags:** none.

---

### backend/src/jobs/resultSyncJob.ts

**Purpose:** Legacy fallback result-sync from API-Football. Largely deprecated — SmartSync + liveScoresJob are now the primary sync mechanisms.

**What it does:**
- **Configuration:** `RESULT_SYNC_ACTIVE_CRON` (default `*/5 * * * *`), `RESULT_SYNC_ENABLED` (string `"true"` to enable).
- **State:** `isRunning`, `lastRunAt`, and `scheduledTask` (the latter is always null since the start/stop functions were removed — see below).
- **`runSyncJob()`** (module-private, no longer wired to a scheduler): guards on `isRunning` and `isApiFootballEnabled()`, then calls `getResultSyncService().syncAllAutoInstances()` and logs the summary counts/errors.
- **`getJobStatus()`:** the only export — returns `{ enabled, isRunning, lastRunAt, isScheduled }` for the admin UI.
- An explicit comment notes `startResultSyncJob`/`stopResultSyncJob`/`triggerManualSync` were removed as dead code.

**Exports:** `getJobStatus`.

**Key dependencies:** `node-cron` (imported but the scheduler is never used), `getResultSyncService` (`../services/resultSync`), `isApiFootballEnabled`.

**Flags:** DEAD/ORPHAN — `runSyncJob()` is now unreachable (no scheduler wires it; start/stop were deleted) and `scheduledTask` is permanently null, so `getJobStatus().isScheduled` is always false. The `cron` import and `ACTIVE_SYNC_CRON`/`scheduledTask` are effectively vestigial. The whole file is a documented legacy fallback retained only for its status getter.

---

### backend/src/jobs/smartSyncJob.ts

**Purpose:** Runs every minute but only makes API-Football calls for matches at strategic times (≈5 min after kickoff to confirm start, ≈110 min to check finish, then every 5 min for overdue matches) — the primary API-Football-based sync path.

**What it does:**
- **Configuration:** `SMART_SYNC_CRON` (default `* * * * *`). `SMART_SYNC_ENABLED` is true when either `SMART_SYNC_ENABLED` or `RESULT_SYNC_ENABLED` env equals `"true"`.
- **`runSmartSync()`:** `isRunning`-guarded, records `lastRunAt`; bails if `getSmartSyncService().isAvailable()` is false; queries AUTO/syncEnabled instances in ACTIVE/COMPLETED and per instance calls `smartSyncService.processMatchesNeedingSync(id)`, logging processed/completed/still-playing counts and any errors. Per-instance errors are caught.
- **Public API:** `startSmartSyncJob()` (no-ops with a log when disabled or API-Football off; otherwise schedules), `stopSmartSyncJob()`, `triggerManualSmartSync()`, `getSmartSyncJobStatus()`.

**Exports:** `startSmartSyncJob`, `stopSmartSyncJob`, `triggerManualSmartSync`, `getSmartSyncJobStatus`.

**Key dependencies:** `node-cron`, `getSmartSyncService` (`../services/smartSync`), `isApiFootballEnabled`, `prisma`.

**Flags:** none.

---

### backend/src/jobs/trackStatusCheckerJob.ts

**Purpose:** "Last line of defense" that runs every minute: for matches kicking off in the next ~5-10 minutes, verifies picks4all-scores has them tracked AND at least one source already reporting, re-sending track requests and alerting the admin otherwise.

**What it does:**
- **Configuration:** `TRACK_STATUS_CHECK_CRON` (default `* * * * *`), `TRACK_STATUS_CHECK_WINDOW_MIN` (default 10, ahead), `TRACK_STATUS_CHECK_WINDOW_BEFORE_MIN` (default 5, just-started buffer). `recentlyAlerted` is a process-lifetime `Set<number>` deduping admin alerts per fixture.
- **`runTrackStatusCheck()`:** `isRunning`-guarded; checks platform toggle + client; queries `MatchSyncState` rows whose `kickoffUtc` is in the window and `syncStatus` is `PENDING`/`IN_PROGRESS`, including the parent instance + its mappings. Builds a `fixtureId → {state, mapping}` map, calls `client.getTrackStatus(fixtureIds)`, and partitions into `tracked`, `trackedWithData` (sources>0), and `untracked`. Problem fixtures: all UNTRACKED, plus tracked-but-NO_SOURCES only when < 5 min from kickoff. UNTRACKED fixtures get a fresh `client.trackFixtures()` payload rebuilt from `dataJson`. New (non-deduped) problems trigger a `sendAdminNotification` (`error`) listing each fixture + issue.
- **Public API:** `startTrackStatusCheckerJob()`, `stopTrackStatusCheckerJob()`. No manual-trigger export.

**Exports:** `startTrackStatusCheckerJob`, `stopTrackStatusCheckerJob`.

**Key dependencies:** `node-cron`, `prisma`, `getScoresServiceClient`/`TrackFixture`, `sendAdminNotification`.

**Flags:** none.

---

### backend/src/jobs/welcomeEmailFallbackJob.ts

**Purpose:** Catches users who never reached `LocalePreferenceModal` completion (closed the tab, never returned) and ships their welcome email 24h after account creation — the safety net for the commit-3 welcome-email deferral.

**What it does:**
- **Configuration:** `WELCOME_FALLBACK_CRON` (default `15 * * * *`, at :15 past the hour to avoid piling on the hour mark), `WELCOME_FALLBACK_HOURS` (default 24, the locked decision), `WELCOME_FALLBACK_BATCH` (default 50). `ADVISORY_LOCK_KEY = 82636505n`.
- **`runWithClusterLock(action)`:** same advisory-lock-in-transaction pattern as the reconcilers.
- **`runOnce()`:** finds users with `welcomeEmailSentAt IS NULL` and `createdAtUtc < now-24h`, also pulling (at most one) corporate `poolMemberships` with an `organizationId` to read `organization.invitationLocale`. Locale resolution: corporate org locale wins, else `resolveUserLocale(user)`. Per user it calls `sendWelcomeEmail(...)` then sets `welcomeEmailSentAt=now` regardless of Resend's success flag (treated as a hint, not a guarantee; idempotent — once set, the row leaves the candidate set). On a thrown error it leaves the timestamp NULL so the next tick retries (no retry counter — v1 simplicity).
- **Public API:** `startWelcomeEmailFallbackJob()`, `stopWelcomeEmailFallbackJob()`, and `runOnce` re-exported as `runWelcomeFallbackOnce`.

**Exports:** `startWelcomeEmailFallbackJob`, `stopWelcomeEmailFallbackJob`, `runWelcomeFallbackOnce`.

**Key dependencies:** `node-cron`, `prisma`, `sendWelcomeEmail` (`../lib/email`), `resolveUserLocale` (`../lib/constants`).

**Flags:** none.

---

### backend/src/lib/activationUrl.ts

**Purpose:** Builds the corporate-account-activation page URL for a given locale, manually mirroring the frontend `routing.ts` pathname registry (there's no cross-boundary single source of truth).

**What it does:**
- Reads `FRONTEND_URL` (default `http://localhost:5173`).
- **`buildActivationUrl(locale, token)`:** maps `en → /en/activate-account`, `pt → /pt/ativar-conta`, `es → /activar-cuenta` (no prefix, per next-intl `localePrefix: "as-needed"`), then appends `?token=` URL-encoded. Created in response to the "Caterine Ochoa" bug where activation emails arrived in the right language but linked to the Spanish UI.

**Exports:** `buildActivationUrl`.

**Key dependencies:** none (pure string builder); env `FRONTEND_URL`.

**Flags:** Maintenance hazard (documented in-file): the path map must be kept in sync with `frontend-next/src/i18n/routing.ts` by hand. Not dead code.

---

### backend/src/lib/amountInWords.ts

**Purpose:** Server-side conversion of a numeric amount to uppercase words for sales documents (cuenta de cobro PDF), with locale-aware currency suffixes.

**What it does:**
- **`amountInWords({ amount, currency, locale })`:** validates `amount` is a non-negative integer (throws otherwise; cents unsupported in v1). For `es` it runs the `numero-a-letras` library, uppercases, strips the library's default `PESOS M.N.`/trailing-period suffix, and appends our own `currencyTail`. For `en`/`pt` (which the Spanish-only library doesn't cover) it falls back to `Intl.NumberFormat` (`pt-BR`/`en-US`) plus the suffix.
- **`currencyTail(locale, currency, singular)`:** COP → `PESO(S) M/CTE` (Colombian "moneda corriente"); USD → `DÓLAR(ES)` for es/pt, `DOLLAR(S)` for en.

**Exports:** `amountInWords`; type `AmountCurrency` (`"COP" | "USD"`).

**Key dependencies:** `numero-a-letras`, `SaleLocale` type (`./saleTerms`).

**Flags:** Documented v1 limitation — EN/PT use numeric-string + suffix rather than true word output; `to-words` flagged as a v2 candidate. Not dead code.

---

### backend/src/lib/apiResponse.ts

**Purpose:** Standardized Express response helpers enforcing a consistent JSON envelope across routes (the convention forbids raw `res.json()` in route handlers).

**What it does:**
- **Success:** `sendData(res, data, status=200)` (raw object for GET/data endpoints), `sendOk(res, extra?)` (`{ ok: true, ...extra }` for mutations), `sendCreated(res, data)` (201 with data).
- **Errors:** `sendError(res, status, error, extra?)` is the generic primitive returning `{ error, ...extra }`; named wrappers `sendBadRequest` (400), `sendUnauthorized` (401), `sendForbidden` (403), `sendNotFound` (404), `sendConflict` (409), `sendInternal` (500).

**Exports:** `sendData`, `sendOk`, `sendCreated`, `sendError`, `sendBadRequest`, `sendUnauthorized`, `sendForbidden`, `sendNotFound`, `sendConflict`, `sendInternal`.

**Key dependencies:** Express `Response` type only.

**Flags:** none.

---

### backend/src/lib/asyncHelpers.ts

**Purpose:** Tiny shared async utility for fire-and-forget side effects.

**What it does:** **`fireAndForget(label, promise)`** attaches a `.catch` that logs the error with the supplied label and returns void — used widely for audit events, emails, and notifications that must not block or fail the caller.

**Exports:** `fireAndForget`.

**Key dependencies:** none.

**Flags:** none.

---

### backend/src/lib/audit.ts

**Purpose:** Single helper for writing audit-trail records (`AuditEvent`) for traceability of critical events.

**What it does:** **`writeAuditEvent(params)`** creates an `AuditEvent` row from `{ actorUserId, action, entityType, entityId, poolId, dataJson, ip, userAgent }`, defaulting nullable fields to null and coercing `dataJson` to `Prisma.InputJsonValue` (or `Prisma.JsonNull` when undefined/null).

**Exports:** `writeAuditEvent`.

**Key dependencies:** `Prisma` (`@prisma/client`), `prisma` (`../db`).

**Flags:** none.

---

### backend/src/lib/authCookies.ts

**Purpose:** Centralizes all auth/session/locale cookie management (set, clear, read) with environment-aware attributes.

**What it does:**
- **Cookie names/constants:** `p4a_token` (httpOnly JWT), `p4a_logged_in` (non-httpOnly flag for client JS), `p4a_admin` (non-httpOnly admin hint enabling analytics debug; explicitly not a security boundary), `NEXT_LOCALE` (next-intl preference cookie, read by frontend `proxy.ts`). `MAX_AGE_MS` = 4h (matches JWT expiry); `NEXT_LOCALE_MAX_AGE_MS` = 1 year. `SUPPORTED_LOCALES = ["es","en","pt"]`.
- **`getCookieOptions(overrides?)`:** httpOnly+lax+4h, `secure`/`domain=.picks4all.com` (or `SITE_DOMAIN`) only in production.
- **`getLocaleCookieOptions()`:** like the above but `httpOnly: false` and 1-year max-age, matching the attributes the frontend `LanguageSelector`/`LocalePreferenceModal` write so reads/writes land on the same cookie row.
- **`setAuthCookies(res, jwt, opts?)`:** sets the JWT + logged-in flag, optionally the admin hint, and `NEXT_LOCALE` when `opts.locale` is a supported value (skipped for fresh signups whose locale isn't chosen yet).
- **`setLocaleCookie(res, locale)`:** sets only `NEXT_LOCALE` (validated) — for the locale-preference endpoint.
- **`clearAuthCookies(res)`:** clears all four cookies, including `NEXT_LOCALE`, so a new user on the same browser doesn't inherit the prior user's locale.
- **`getTokenFromCookies(cookies)`:** reads the JWT for `requireAuth`.

**Exports:** `setAuthCookies`, `setLocaleCookie`, `clearAuthCookies`, `getTokenFromCookies`.

**Key dependencies:** Express `Response`/`CookieOptions`; env `NODE_ENV`, `SITE_DOMAIN`.

**Flags:** none.

---

### backend/src/lib/brand.test.ts

**Purpose:** Vitest suite asserting the shape and validity of the backend `BRAND` constant.

**What it does:** Asserts `name === "Picks4All"`, `domain === "picks4all.com"` and matches a domain regex, that all color fields (`primary`, `primaryLight`, `primaryDark`, `secondary`, `accent`, `text`, `textMuted`, `background`, `card`) are valid 6-digit hex, that `gradient`/`gradientAlt` start with `linear-gradient(`, and that `BRAND` exposes the full expected key set.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./brand`.

**Flags:** none.

---

### backend/src/lib/brand.ts

**Purpose:** Single source of truth for backend branding (emails, notifications), mirroring `frontend-next/src/lib/brand.ts`.

**What it does:** Defines a `defaults` object (name, domain, primary/light/dark, secondary, accent, two gradients, text/textMuted, background, card). `loadBrand()` returns the defaults, or merges them with `BRAND_COLORS_JSON` env JSON for runtime override (warns and falls back on invalid JSON). Exports the resolved `BRAND` constant.

**Exports:** `BRAND` (const); `BrandColors` type is internal (not exported).

**Key dependencies:** env `BRAND_COLORS_JSON`.

**Flags:** Documented future intent ("when assets arrive, add logoUrl/iconUrl") — a TODO, not dead code.

---

### backend/src/lib/constants.test.ts

**Purpose:** Vitest suite for the shared `constants.ts` values.

**What it does:** Asserts `MS` time values and their internal consistency; `TOKEN_EXPIRY_MS` values (EMAIL_VERIFICATION=1d, PASSWORD_RESET=1h, CORPORATE_INVITE/POOL_INVITE_DEFAULT=30d, all positive); `CRYPTO_BYTES` (TOKEN=32, POOL_INVITE_CODE=6, USERNAME_SUFFIX=3, GENERATED_PASSWORD=12, all positive ints); `MATCH_SYNC` defaults (5/110 min) and computed ms getters; `SUPPORTED_LOCALES` (exactly es/en/pt), `DEFAULT_LOCALE` ("es", in the list); `USER_RULES` (cooldown 30d, MIN_AGE 13, MAX_AGE 120); `PAGINATION` (50/100); `RESERVED_USERNAMES` (includes admin/root/system/api/www/quiniela, all lowercase); `PLACEHOLDER_TEAM_PREFIXES` (t_TBD, W_, RU_, L_, 3rd_).

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./constants`.

**Flags:** none.

---

### backend/src/lib/constants.ts

**Purpose:** Central repository of shared backend constants and the canonical locale-resolution logic.

**What it does:**
- **`MS`:** SECOND/MINUTE/HOUR/DAY in ms.
- **`TOKEN_EXPIRY_MS`:** EMAIL_VERIFICATION (1d), PASSWORD_RESET (1h), CORPORATE_INVITE (30d), POOL_INVITE_DEFAULT (30d).
- **`CRYPTO_BYTES`:** TOKEN 32, POOL_INVITE_CODE 6, USERNAME_SUFFIX 3, GENERATED_PASSWORD 12.
- **`MATCH_SYNC`:** `FIRST_CHECK_MINUTES`/`FINISH_CHECK_MINUTES` (env `MATCH_SYNC_FIRST_CHECK_MIN`/`..._FINISH_CHECK_MIN`, default 5/110) plus computed `FIRST_CHECK_MS`/`FINISH_CHECK_MS` getters.
- **`SCORES`:** `GRACE_PERIOD_MS` (default 5 min, used by liveScoresJob), `FALLBACK_DELAY_MS` (default 30 min).
- **`ADVANCEMENT`:** `DELAY_MS` (default 10 min) — window before automatic bracket advancement.
- **`CAPACITY`:** `WARNING_THRESHOLD_PCT_DEFAULT` (env, clamped 1..99, default 95) and `BLOCKED_ATTEMPT_THROTTLE_MS` (default 24h) for full-pool join-attempt emails.
- **Locales:** `SUPPORTED_LOCALES`/`SupportedLocale` type, `DEFAULT_LOCALE` ("es"). Internal `COUNTRY_TO_LOCALE` map (LATAM/Spain/GQ → es, Brazil/Portugal/lusophone Africa → pt) and `ANGLOPHONE_COUNTRIES` set. `countryToLocale(code)` returns es for mapped/unknown, pt for lusophone, en only for explicit anglophone countries (never guesses EN from missing data — the fix for ~93% of automatic emails going out in English). `resolveUserLocale(user)` is the single source of truth: explicit `user.locale` wins, else `countryToLocale(user.country)`, else default.
- **`USER_RULES`:** USERNAME_CHANGE_COOLDOWN_DAYS 30, MIN_AGE 13, MAX_AGE 120.
- **`PAGINATION`:** DEFAULT_LIMIT 50, MAX_LIMIT 100.
- **`RESERVED_USERNAMES`:** admin/root/system/quiniela/api/www.
- **`PHASE_DISPLAY_NAMES`:** per-phase es/en/pt labels for email notifications.
- **`PLACEHOLDER_TEAM_PREFIXES`:** t_TBD, W_, RU_, L_, 3rd_ (block picks on unresolved teams).

**Exports:** `MS`, `TOKEN_EXPIRY_MS`, `CRYPTO_BYTES`, `MATCH_SYNC`, `SCORES`, `ADVANCEMENT`, `CAPACITY`, `SUPPORTED_LOCALES`, `SupportedLocale` (type), `DEFAULT_LOCALE`, `countryToLocale`, `resolveUserLocale`, `USER_RULES`, `PAGINATION`, `RESERVED_USERNAMES`, `PHASE_DISPLAY_NAMES`, `PLACEHOLDER_TEAM_PREFIXES`.

**Key dependencies:** env vars only.

**Flags:** none. (`PHASE_DISPLAY_NAMES` for round_of_32 maps pt to "Oitavas de Final" identical to round_of_16 — a likely translation copy error worth a glance, low confidence.)

---

### backend/src/lib/email.test.ts

**Purpose:** Vitest suite for the email gating logic (`isEmailEnabled`) in `./email`, with Prisma and Resend fully mocked.

**What it does:** Mocks `../db` (platformSettings + user) and the `resend` `Resend` class. Asserts:
- **Platform settings:** `isEmailEnabled(type)` returns enabled per the matching `PlatformSettings` toggle (welcome, poolInvitation, deadlineReminder, resultPublished, poolCompleted), with the `disabled at platform level` reason when off; creates default settings (`{ id: "singleton" }`) when none exist.
- **User preferences:** when a `userId` is passed, the master `emailNotificationsEnabled` toggle and per-type toggles gate sending (with reasons like `disabled all email notifications`, `disabled "poolInvitation"`); welcome ignores specific toggles (only the master matters); user-not-found yields disabled; both-allow yields enabled.
- **Priority:** platform disable short-circuits before user preferences are even queried (`prisma.user.findUnique` not called).
- **Coverage/defaults:** verifies the 5 `EmailType` values, that every type queries the singleton settings, that `deadlineReminder` is disabled by default, and all others enabled by default.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `prisma` (`../db`, mocked), `isEmailEnabled`/`EmailType` (`./email`), `resend` (mocked).

**Flags:** none.
