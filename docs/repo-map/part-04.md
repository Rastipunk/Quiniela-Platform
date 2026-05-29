## Batch 4

This batch covers `backend/src/lib/` utility modules (12 source files) and their accompanying Vitest suites (10 test files): logging, Meta Conversion API client, password hashing/rules, payment-event taxonomy, pick presets, pool capacity/notifications, pool helpers, dual-currency pricing, role RBAC, sales terms, shared Zod field schemas, and the advanced scoring engine + breakdown tests.

### backend/src/lib/logger.ts

**Purpose:** Structured application logger — emits JSON in production and human-readable lines in development — as a drop-in replacement for `console.*`.

**What it does:**
- Defines a `LogLevel` union (`debug | info | warn | error`) and a `LEVEL_PRIORITY` map (debug=0 … error=3).
- `isProd` is derived from `NODE_ENV === "production"`; `minLevel` is `info` in prod, `debug` otherwise.
- `shouldLog(level)` gates output by comparing priority against `minLevel`.
- `formatDev(level, message, data)` builds a `[LEVEL] message {json}` string; `formatProd(...)` builds a single-line JSON object `{ level, msg, ts (ISO), ...data }`.
- `log(level, message, data)` picks the formatter by environment and routes to `console.error` (error), `console.warn` (warn), or `console.log` (otherwise).
- Exports a `logger` object whose `debug/info/warn/error` methods each call `log` with the matching level.

**Exports:** `logger` (object with `debug`, `info`, `warn`, `error` methods).

**Key dependencies:** none beyond `process.env.NODE_ENV` and `console`.

**Flags:** none.

### backend/src/lib/metaCapi.ts

**Purpose:** Server-side Meta Conversion API (CAPI) client. Hashes PII, posts conversion events to the Meta Graph API, and on failure persists events to a dead-letter queue (`failedAnalyticsEvent`) for a background worker to retry. Designed so analytics failures never break the originating business transaction.

**What it does:**
- Reads `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE` from env; pins Graph API `v21.0`.
- `EEA_COUNTRY_CODES` is a `Set` of EEA+UK+Switzerland ISO codes used to apply Meta's Limited Data Use (LDU / GDPR) flag.
- Retry config constants: in-process retries (`MAX_IN_PROCESS_RETRIES = 3`, backoff `[1s, 2s, 4s]`) and DLQ retries (`MAX_DLQ_ATTEMPTS = 8`, backoff in minutes `[1,5,15,60,240,720,1440,1440]`).
- `sha256(value)` lowercases/trims and SHA-256-hexes a value (Meta's required PII normalization).
- Interfaces `CapiUserData` (email, name, dob, gender, phone, IP, UA, fbc, fbp, externalId, country) and `CapiEventParams` (eventName, eventId for dedupe, eventSourceUrl, userData, customData).
- `normaliseGender` (→ "m"/"f"), `normaliseDob` (→ YYYYMMDD, validated 8 digits), `normalisePhone` (digits only, ≥7) normalize before hashing.
- `buildUserData(data)` produces Meta's short-key user_data object (`em, fn, ln, db, ge, ph, client_ip_address, client_user_agent, fbc, fbp, external_id, country`), hashing the PII fields. `fbc`/`fbp` are passed through only if they match `FBC_RE`/`FBP_RE` (validated via `isValidFbc`/`isValidFbp`) to avoid poisoning browser↔server dedup.
- `buildEventBody(params)` strips undefined user_data keys, assembles the `event_name/event_time/action_source=website/user_data` event, attaches `event_id`, `event_source_url`, `custom_data` when present, and adds `data_processing_options: ["LDU"]` (+country/state 0) for EEA/UK countries. Returns `{ data: [eventData] }`.
- `isPermanentFailure(status)` classifies HTTP failures: 401/403/408/429 are transient (retryable); other 4xx are permanent; 5xx/network are not 4xx and handled by the generic retry path.
- `postToMeta(body)` POSTs to the Graph events endpoint with `access_token` (+`test_event_code` when set) under an 8s `AbortController` timeout (`HTTP_TIMEOUT_MS`).
- `sleep(ms)` is a promise-based delay.
- `sendCapiEvent(params)` — main entry. No-ops if pixel/token missing. Ensures a stable `eventId` (generates a UUID if absent). Loops up to `MAX_IN_PROCESS_RETRIES+1` attempts; returns on `res.ok`, records-and-drops on permanent failure, otherwise retries with jittered backoff (±25%). On final exhaustion, persists a `failedAnalyticsEvent` DLQ row (`provider: "META_CAPI"`, payloadJson, lastError truncated to 2000 chars, `nextRetryAt(1)`); logs but tolerates DB-write failure. Always resolves.
- `nextRetryAt(attempts)` computes the next DLQ retry time from `DLQ_BACKOFF_MINUTES` with ±20% jitter to avoid a thundering herd.
- `retryFailedCapiEventsBatch(batchSize = 20)` — cron-driven DLQ drainer. Selects due unresolved META_CAPI rows under the attempt cap, re-posts each, marks resolved on success, and on failure increments `attemptCount`, records the error, and either resolves (permanent 4xx, preserving the error) or schedules `nextRetryAt`. Returns `{ processed, resolved }`.

**Exports:** `CapiUserData`, `CapiEventParams` (interfaces); `sendCapiEvent`, `retryFailedCapiEventsBatch` (functions).

**Key dependencies:** `crypto`, `prisma` (`failedAnalyticsEvent` model), global `fetch`, Meta Graph API.

**Flags:** Top docstring/comments reference a `FailedCapiEvent` model name, but the code uses `prisma.failedAnalyticsEvent` (generalized DLQ table keyed by `provider`) — comment is stale relative to the actual model name. No dead code.

### backend/src/lib/password.test.ts

**Purpose:** Vitest suite for `password.ts`.

**What it does:** Asserts `hashPassword` returns a bcrypt hash matching `/^\$2[aby]\$/` and that two hashes of the same input differ (unique salt). Asserts `verifyPassword` returns `true` for a correct password and `false` for a wrong one.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./password`.

**Flags:** none.

### backend/src/lib/password.ts

**Purpose:** Bcrypt password hashing/verification helpers.

**What it does:**
- `hashPassword(plainPassword)` hashes with bcrypt at 12 salt rounds.
- `verifyPassword(plainPassword, passwordHash)` compares a plaintext password against a stored hash.

**Exports:** `hashPassword`, `verifyPassword`.

**Key dependencies:** `bcrypt`.

**Flags:** none.

### backend/src/lib/passwordRules.ts

**Purpose:** Declarative password-strength rules shared so the frontend strength meter and backend validation stay aligned.

**What it does:**
- `PASSWORD_RULES` constant: `minLength: 8`, `requireUppercase: true`, `requireNumber: true`.
- Type `PasswordCheck` (`minLength`, `hasUppercase`, `hasNumber` booleans).
- `checkPasswordRules(password)` returns which individual rules pass (length ≥8, has `[A-Z]`, has `[0-9]`).
- `isPasswordValid(password)` returns true when all three checks pass.

**Exports:** `PASSWORD_RULES`, `PasswordCheck` (type), `checkPasswordRules`, `isPasswordValid`.

**Key dependencies:** none.

**Flags:** none. (Note: `schemas.ts` `passwordField` only enforces length 8–128, not uppercase/number — these stricter rules are a separate concern checked elsewhere.)

### backend/src/lib/paymentEvents.ts

**Purpose:** Single source of truth for the `PaymentEvent` observability taxonomy — the `source` discriminator and the `eventType` token vocabularies — so typos become TypeScript errors instead of silent audit-log pollution.

**What it does:**
- `PAYMENT_EVENT_SOURCE` const object enumerating event origins: `POLAR_WEBHOOK`, `MP_WEBHOOK`, `MP_SYNC` (Brick synchronous path), `CLIENT` (browser beacon), `RECONCILER` (periodic job), `SERVER` (internal transition). Persisted as TEXT (not a PG enum) so new sources are additive. Exposes `PaymentEventSource` value-union type.
- `CLIENT_EVENT_TYPE` const object — browser-posted lifecycle beacons: `REDIRECT_INITIATED`, `REDIRECT_FAILED`, `USER_CANCELLED`, `CLIENT_ERROR`, plus MP-Brick-specific `BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB`. The docstring documents the full checkout lifecycle and which beacon fires at each step (including `navigator.sendBeacon` for unload). Exposes `ClientEventType` (value-union type) and `CLIENT_EVENT_TYPES` (`Object.values` array, used for runtime validation).
- `RECONCILER_EVENT_TYPE` const object — decisions the reconciler records: `ABANDONED`, `EXPIRED`, `FAILED`, `RESCUED`, `NOOP` (each prefixed `RECONCILER_`).
- `SERVER_EVENT_TYPE` const object — currently only `STATUS_TRANSITION` (carries `{ from, to, reason }`).

**Exports:** `PAYMENT_EVENT_SOURCE`, `PaymentEventSource` (type), `CLIENT_EVENT_TYPE`, `ClientEventType` (type), `CLIENT_EVENT_TYPES`, `RECONCILER_EVENT_TYPE`, `SERVER_EVENT_TYPE`.

**Key dependencies:** none (pure constants). Referenced by Polar/MP webhook handlers, the reconciler, and the payment-attempt telemetry route per the docstrings (ADR-060, ADR-066).

**Flags:** none. (Documents Mercado Pago as the active COP gateway; consistent with Wompi being deprecated.)

### backend/src/lib/pickPresets.test.ts

**Purpose:** Vitest suite for `pickPresets.ts`, including a regression test for the phase-ID-mismatch bug that motivated dynamic preset generation.

**What it does:**
- Defines realistic `UCL_PHASES` (9 knockout legs/final) and `WC_PHASES` (group + knockout) fixtures.
- Validates static preset structure: BASIC (all `requiresScore=true`, only `EXACT_SCORE` enabled, points increase per phase); CUMULATIVE (all `requiresScore=true`, `EXACT_SCORE` disabled, HOME/AWAY/OUTCOME/DIFF enabled, group sums to 10, knockouts sum to 20); SIMPLE (all `requiresScore=false`, group uses `GROUP_STANDINGS`, knockouts use `KNOCKOUT_WINNER`).
- `getAllPresets` returns all 3; `getPresetByKey` finds each and returns null for unknown.
- `generateDynamicPresetConfig`: asserts CUMULATIVE/BASIC/SIMPLE configs are produced against real UCL and WC phase IDs (not hardcoded WC IDs), correct point sums per phase type, correct structural types, preserved phase names, null for unknown key, and empty array for empty phases.
- Regression block asserts dynamic config phase IDs exactly match the instance data, and that the hardcoded preset IDs do NOT match UCL (proving why dynamic generation is needed).

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./pickPresets`.

**Flags:** none.

### backend/src/lib/pickPresets.ts

**Purpose:** Predefined pick-configuration presets (BÁSICO, SIMPLE, ACUMULATIVO) plus a dynamic generator that maps a preset onto a tournament instance's real phases.

**What it does:**
- `DEFAULT_MULTIPLIERS` — per-phase auto-scaling multipliers (group 1.0 … finals 4.0).
- `KNOCKOUT_POINTS` — progressive per-phase advance points for SIMPLE knockouts (round_of_32=15 … finals=40).
- `makeBasicTypes(points)` — match-pick type list with only `EXACT_SCORE` enabled.
- `makeCumulativeTypes(mult)` — type list with OUTCOME(10×), HOME(4×), AWAY(4×), DIFF(2×) enabled and EXACT/PARTIAL/TOTAL disabled, rounded.
- `BASIC_CONFIG`/`BASIC_PRESET` — exact-score only, base 20 in groups with auto-scaling enabled, higher fixed points per later phase.
- `SIMPLE_CONFIG`/`SIMPLE_PRESET` — no scores; group stage `GROUP_STANDINGS` (10 pts/position, +20 perfect-group bonus), knockouts `KNOCKOUT_WINNER` with progressive points.
- `CUMULATIVE_CONFIG`/`CUMULATIVE_PRESET` — accumulative scoring with auto-scaling, base 20 in groups.
- `getAllPresets()` returns `[CUMULATIVE, BASIC, SIMPLE]`; `getPresetByKey(key)` finds by key or null.
- `generateDynamicPresetConfig(presetKey, instancePhases)` — maps the chosen preset onto the actual instance phases by ID/name. For CUMULATIVE and BASIC it emits per-phase match-pick configs with auto-scaling using `instancePhases[0].id` (or `"group_stage"` fallback) as `basePhase`. For SIMPLE it emits `GROUP_STANDINGS` for `type === "GROUP"` phases and `KNOCKOUT_WINNER` (points from `KNOCKOUT_POINTS[phase.id]` else 15) otherwise. Returns null for unknown preset keys.

**Exports:** `BASIC_PRESET`, `SIMPLE_PRESET`, `CUMULATIVE_PRESET`, `getAllPresets`, `getPresetByKey`, `generateDynamicPresetConfig`.

**Key dependencies:** type imports `PhasePickConfig`, `PickConfigPreset`, `PoolPickTypesConfig` from `../types/pickConfig`.

**Flags:**
- `generateDynamicPresetConfig` SIMPLE branch keys `KNOCKOUT_POINTS` by `phase.id`, but `KNOCKOUT_POINTS` keys are the static WC IDs (`round_of_32`, etc.). For real instances with different IDs (e.g. UCL `r32_leg1`), every knockout phase falls back to the constant 15 — the per-round point progression is silently lost. The test "UCL phases (all knockout) → all KNOCKOUT_WINNER" only checks the type, not the points, so this is uncaught. Medium-confidence latent bug / dead lookup.
- For CUMULATIVE/BASIC dynamic generation, `DEFAULT_MULTIPLIERS` is keyed by static WC phase IDs too; `applyAutoScaling` would not find a multiplier for non-WC instance phase IDs and would fall back to base points (auto-scaling effectively a no-op for non-WC tournaments). Same root cause as above.

### backend/src/lib/poolCapacity.notify.test.ts

**Purpose:** Vitest suite for the threshold-notification side of `poolCapacity.ts` (`checkAndNotifyCapacityThresholds`, `notifyHostOfBlockedAttempt`), with `../db`, `./email`, `./audit`, and `./asyncHelpers` mocked.

**What it does:**
- `setupMocks`/`setupBlockedAttemptMocks` stub `prisma.pool.findUnique/updateMany` and `prisma.poolMember.count/findFirst`, plus the host record.
- For `checkAndNotifyCapacityThresholds`: asserts `none` below threshold, `warning` at the computed warning threshold (firing `sendCapacityWarningEmail` + `CAPACITY_WARNING_NOTIFIED` audit), `full` at/over capacity (firing `sendPoolFullNotificationEmail` + `POOL_FULL_NOTIFIED`), dedup via `capacityWarningNotifiedAt`/`poolFullNotifiedAt`, `none` for missing pool or null `maxParticipants`, per-pool `capacityWarningThresholdPct` honoring and fallback to default 95, the atomic claim setting both flags when jumping straight to full, not re-setting the warning flag when already warned, the `poolFullNotifiedAt: null` guard in the warning WHERE, no email when the atomic claim returns count 0, audit-still-fires when host has no email, locale mapping (CO→es, BR→pt), and default `displayName` "Host".
- For `notifyHostOfBlockedAttempt`: asserts email+audit when the throttle window is open, audit-regardless when throttled (claim count 0), no audit when the pool is missing, no email for null `maxParticipants`, the `OR: [null, { lt: cutoff }]` throttle WHERE, and audit-still-fires when host has no email.

**Exports:** none (test file).

**Key dependencies:** `vitest`, mocked `../db`/`./email`/`./audit`/`./asyncHelpers`, `./poolCapacity`.

**Flags:** none.

### backend/src/lib/poolCapacity.test.ts

**Purpose:** Vitest suite for the transactional guard `ensurePoolCapacity` and the pure `computeWarningThreshold`.

**What it does:**
- `makeMockTx(memberCount)` builds a mock transaction client with `$queryRaw` and `poolMember.count`.
- `ensurePoolCapacity` tests: resolves under capacity, throws `POOL_FULL` at/over capacity, resolves immediately (no DB call) for null or 0 `maxParticipants`, acquires the `SELECT ... FOR UPDATE` lock (1 `$queryRaw` call), counts only `ACTIVE`+`PENDING_APPROVAL` members, and the exact at-capacity boundary throws while one-below resolves.
- `computeWarningThreshold` tests: standard sizes (100/95→95, 20/95→19, 10/95→9), small-pool "reserve ≥1 slot" edges (3→2, 2→1, 1→0), varying percentages (90/99/80), clamping out-of-range pct into 1..99, and degenerate `maxParticipants` (0 or negative → 0).

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./poolCapacity`.

**Flags:** none.

### backend/src/lib/poolCapacity.ts

**Purpose:** Pool-capacity enforcement (transactional join guard) plus host threshold/blocked-attempt email notifications with concurrency-safe one-shot dispatch.

**What it does:**
- `computeWarningThreshold(maxParticipants, thresholdPct)` — returns the member count at which the "near full" warning fires. Clamps pct to 1..99, reserves a margin of `max(1, floor(max*(100-pct)/100))` slots, returns `max - margin` (≥0). Guarantees the warning fires at least one slot before the cap even for tiny pools.
- `ensurePoolCapacity(tx, poolId, maxParticipants)` — MUST run inside a Prisma interactive transaction. No-ops for falsy `maxParticipants`. Acquires a row-level lock via `SELECT id FROM "Pool" ... FOR UPDATE` to serialize concurrent joins, counts `ACTIVE`+`PENDING_APPROVAL` members, and throws `Error("POOL_FULL")` at/over capacity.
- Types `CapacityThresholdState` (`none|warning|full`) and `CapacityNotifyResult` (`{ state, emailSent }`).
- `checkAndNotifyCapacityThresholds({ poolId, actorUserId? })` — runs OUTSIDE the join transaction. Reads pool capacity/flags, counts members, computes the warning threshold (per-pool `capacityWarningThresholdPct` else `CAPACITY.WARNING_THRESHOLD_PCT_DEFAULT`). Full takes precedence: at/over capacity it delegates to `tryClaimAndNotifyFull`; otherwise at/over warning it delegates to `tryClaimAndNotifyWarning`. Returns `{ state: "none" }` for missing/unlimited pools or below-threshold counts. Already-notified flags short-circuit to `emailSent: false`.
- `tryClaimAndNotifyFull(...)` — atomic `updateMany WHERE poolFullNotifiedAt IS NULL` claim (count 0 means lost race → no email); when the warning was unsent it also sets `capacityWarningNotifiedAt` in the same write to prevent a stale post-fill warning. On winning, fires `sendPoolFullNotificationEmail` and `POOL_FULL_NOTIFIED` audit via `fireAndForget`.
- `tryClaimAndNotifyWarning(...)` — atomic `updateMany WHERE capacityWarningNotifiedAt IS NULL AND poolFullNotifiedAt IS NULL` claim; on winning fires `sendCapacityWarningEmail` and `CAPACITY_WARNING_NOTIFIED` audit.
- `notifyHostOfBlockedAttempt({ poolId, attemptedEmail, attemptedUserId? })` — audits every blocked attempt unconditionally, then throttles the email per pool via `Pool.lastBlockedAttemptNotifiedAt` using an atomic `updateMany` with `OR: [{ ...: null }, { ...: { lt: cutoff } }]` (cutoff = now − `CAPACITY.BLOCKED_ATTEMPT_THROTTLE_MS`). On winning the window it fires `sendBlockedJoinAttemptEmail`. Returns `{ emailSent }`.
- `findHostForNotification(poolId)` — finds the first member whose role is in `HOST_NOTIFICATION_ROLES`, returns `{ email, displayName (default "Host"), locale }` (locale via `resolveUserLocale` on the user's country).

**Exports:** `computeWarningThreshold`, `ensurePoolCapacity`, `CapacityThresholdState` (type), `CapacityNotifyResult` (interface), `checkAndNotifyCapacityThresholds`, `notifyHostOfBlockedAttempt`.

**Key dependencies:** `prisma`, `fireAndForget` (`./asyncHelpers`), `writeAuditEvent` (`./audit`), `sendBlockedJoinAttemptEmail`/`sendCapacityWarningEmail`/`sendPoolFullNotificationEmail` (`./email`), `CAPACITY`/`resolveUserLocale` (`./constants`), `HOST_NOTIFICATION_ROLES` (`./roles`).

**Flags:** none.

### backend/src/lib/poolHelpers.test.ts

**Purpose:** Vitest suite for `poolHelpers.ts`.

**What it does:** Tests `outcomeFromScore` (HOME/AWAY/DRAW across various scores including 0-0 and high scores). Tests `makeInviteCode` returns a 12-char lowercase hex string, generates 20 distinct codes, and is a string.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./poolHelpers`.

**Flags:** none.

### backend/src/lib/poolHelpers.ts

**Purpose:** Small pool-related pure helpers.

**What it does:**
- `outcomeFromScore(homeGoals, awayGoals)` returns `"HOME" | "DRAW" | "AWAY"` from a score.
- `makeInviteCode()` returns a hex invite code from `crypto.randomBytes(CRYPTO_BYTES.POOL_INVITE_CODE)` (6 bytes → 12 hex chars).

**Exports:** `outcomeFromScore`, `makeInviteCode`.

**Key dependencies:** `crypto`, `CRYPTO_BYTES` (`./constants`).

**Flags:** none.

### backend/src/lib/pricing.test.ts

**Purpose:** Vitest suite for `pricing.ts`, including a regression block locking backend USD corporate pricing to the frontend tier table (BE-vs-FE parity).

**What it does:**
- Free-tier: personal ≤20 and corporate ≤free-limit are free; `isWithinFreeLimit` boundaries.
- USD: personal-50 = $7.99, personal-100 > personal-50, `calculateUpgradePrice` equals the total difference, downgrades return 0, `usdToCents` conversions.
- USD corporate parity: free at limit 2, $49.99 at the first paid tier (100), still $49.99 for 3..99 (rounded up), $57.98 at 150, $65.97 at 200, $81.15 at 300 (volume discount from step 2), upgrade-from-free-to-100 = $49.99, upgrade 100→150 = $7.99, and round-up-to-nearest-50 behavior (101/149 → 150 tier).
- COP: personal upgrade free→50 > 0, COP downgrade returns 0, COP price increases with capacity.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./pricing`.

**Flags:** none.

### backend/src/lib/pricing.ts

**Purpose:** Server-side pricing for pool-capacity upgrades in USD (Polar) and COP (Mercado Pago). The client never sends a price — it is always computed here from the target capacity.

**What it does:**
- `PoolType` = `"personal" | "corporate"`. `envInt`/`envFloat` helpers read env-overridable config.
- Config constants: `PERSONAL_FREE_LIMIT` (20), `CORPORATE_FREE_LIMIT` (2), `INCREMENT` (50), `BASE_PRICE_USD` (7.99), `PAIR_DISCOUNT` (0.40), `MIN_PRICE_USD` (4.99), `CORPORATE_BASE_PRICE_USD` (49.99).
- `roundPrice(n)` rounds to 2 decimals. `getPriceAtStep(step)` computes the per-block USD price declining $0.40 every 2 blocks, floored at `MIN_PRICE_USD`.
- `personalCumulativePrice(capacity)` — 0 if ≤ free limit; rounds capacity up to nearest INCREMENT, sums per-block prices for `(target - PERSONAL_FREE_LIMIT)/INCREMENT` blocks.
- `corporateCumulativePrice(capacity)` — 0 if ≤ corporate free limit; flat `CORPORATE_BASE_PRICE_USD` up to 100; beyond 100, base + per-block prices for `(target-100)/INCREMENT` extra blocks. Comment notes this mirrors the COP version to avoid a 32% BE/FE divergence.
- Public USD API: `isWithinFreeLimit(type, capacity)`, `getFreeLimit(type)`, `calculateTotalPrice(type, capacity)`, `calculateUpgradePrice(type, from, to)` (incremental, 0 for non-upgrades), `usdToCents(usd)`.
- COP section: constants `BASE_PRICE_COP` (28500), `PAIR_DISCOUNT_COP` (1500), `MIN_PRICE_COP` (18000), `CORPORATE_BASE_PRICE_COP` (200000); `getCopPriceAtStep(step)` mirrors the USD discount curve. `personalCumulativePriceCop` and `corporateCumulativePriceCop` compute cumulative COP totals. `calculateUpgradePriceCop(type, from, to)` returns the incremental COP cost (0 for non-upgrades).
- `validateCapacityRequiresPayment(type, from, to)` returns `{ required, amountUsd, amountCents }`.

**Exports:** `PoolType` (type); constants `PERSONAL_FREE_LIMIT`, `CORPORATE_FREE_LIMIT`, `INCREMENT`, `BASE_PRICE_USD`, `CORPORATE_BASE_PRICE_USD`; functions `isWithinFreeLimit`, `getFreeLimit`, `calculateTotalPrice`, `calculateUpgradePrice`, `usdToCents`, `calculateUpgradePriceCop`, `validateCapacityRequiresPayment`.

**Flags:**
- `personalCumulativePriceCop` computes `blocks = target / INCREMENT` (e.g. 50→1, 100→2), which counts the free-tier 20-player block, whereas the USD `personalCumulativePrice` uses `(target - PERSONAL_FREE_LIMIT)/INCREMENT`. The two personal curves use a different number of blocks for the same capacity — a possible BE-internal USD/COP divergence. Medium confidence; not directly asserted by the COP tests (which only check directionality, not exact COP amounts).
- `validateCapacityRequiresPayment` returns USD-only amounts (no COP path) and is the kind of helper that may have limited consumers; not verified within this batch.

### backend/src/lib/roles.ts

**Purpose:** Single source of truth for pool role-based access control — role groups, pure predicates, and DB-backed authorization checks.

**What it does:**
- Role groups: `POOL_ADMIN_ROLES` (`HOST`, `CO_ADMIN`, `CORPORATE_HOST`), `POOL_OWNER_ROLES` (`HOST`, `CORPORATE_HOST`), with `NON_LEAVABLE_ROLES` and `HOST_NOTIFICATION_ROLES` both aliased to `POOL_OWNER_ROLES`.
- Pure predicates: `isPoolAdmin(role)`, `isPoolOwner(role)`.
- DB-backed checks: `requirePoolAdmin(userId, poolId)` and `requirePoolOwner(userId, poolId)` each query `prisma.poolMember.findFirst` for an `ACTIVE` membership with a role in the relevant group and return a boolean.

**Exports:** `POOL_ADMIN_ROLES`, `POOL_OWNER_ROLES`, `NON_LEAVABLE_ROLES`, `HOST_NOTIFICATION_ROLES`, `isPoolAdmin`, `isPoolOwner`, `requirePoolAdmin`, `requirePoolOwner`.

**Key dependencies:** `PoolMemberRole` enum (`@prisma/client`), `prisma`.

**Flags:** none.

### backend/src/lib/saleTerms.ts

**Purpose:** Locale-keyed dictionary of sales-document terms (the noun substituted into the `{term}` placeholder of Quote/AccountReceivable PDF copy), plus validation/default helpers.

**What it does:**
- `SaleLocale` = `"es" | "en" | "pt"`.
- `SALE_TERMS` maps each locale to its allowed term list (es: polla/penca/prode/quiniela/porra/pool; en: pool/prediction game/sports pool; pt: bolão/palpites/pool).
- `isTermValidForLocale(locale, term)` checks membership (used in Zod refinements at the route layer).
- `DEFAULT_TERM_FOR_LOCALE` gives the default selection per locale (es→polla, en→pool, pt→bolão).

**Exports:** `SaleLocale` (type), `SALE_TERMS`, `isTermValidForLocale`, `DEFAULT_TERM_FOR_LOCALE`.

**Key dependencies:** none. Coupled with `backend/src/pdf/i18n.ts` per the docstring (SALES_AUDIT §11.19).

**Flags:** none.

### backend/src/lib/schemas.test.ts

**Purpose:** Vitest suite for the shared Zod field schemas in `schemas.ts`.

**What it does:** Exhaustively tests min/max boundaries and rejection cases for each field: `usernameField` (3–20, alphanumeric+underscore only), `passwordField` (8–128, any chars), `emailField` (valid email, ≤255, subdomains), `displayNameField` (1–50), `poolNameField` (3–120), `poolDescriptionField` (≤500, optional/empty), `companyNameField` (2–200), `welcomeMessageField` and `invitationMessageField` (≤1000, optional), `templateNameField` (3–120).

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./schemas`.

**Flags:** none.

### backend/src/lib/schemas.ts

**Purpose:** Shared Zod field schemas — single source of truth for validation constraints reused by route-level schemas to prevent drift.

**What it does:** Exports individual Zod field definitions:
- User: `usernameField` (string 3–20, regex `^[a-zA-Z0-9_]+$`), `passwordField` (string 8–128), `emailField` (email ≤255), `displayNameField` (string 1–50).
- Pool: `poolNameField` (string 3–120), `poolDescriptionField` (string ≤500, optional).
- Organization/corporate: `companyNameField` (string 2–200), `welcomeMessageField` (string ≤1000, optional), `invitationMessageField` (string ≤1000, optional).
- Template/instance: `templateNameField` (string 3–120).

**Exports:** `usernameField`, `passwordField`, `emailField`, `displayNameField`, `poolNameField`, `poolDescriptionField`, `companyNameField`, `welcomeMessageField`, `invitationMessageField`, `templateNameField`.

**Key dependencies:** `zod`.

**Flags:** none.

### backend/src/lib/scoringAdvanced.test.ts

**Purpose:** Vitest suite for the scoring engine in `scoringAdvanced.ts` covering cumulative and legacy scoring, auto-scaling, and max-points calculations.

**What it does:**
- Helper builders for cumulative group (5+2+2+1=10) and knockout (10+4+4+2=20) configs, legacy basic (EXACT_SCORE only), and legacy multi-type configs.
- CUMULATIVE: asserts max points on exact match (groups 10, knockout 20, 0-0), partial scenarios (outcome+diff, outcome+away, single home/away, zero, draws), TOTAL_GOALS inclusion when enabled, and a regression block proving EXACT_SCORE and PARTIAL_SCORE are now additive (not silently dropped) and that EXACT_SCORE does not short-circuit in cumulative mode.
- LEGACY: BASIC exact-match full points and 0 on miss, scaled points per phase, EXACT_SCORE termination (no cascade), cascade to DIFF/PARTIAL/TOTAL/OUTCOME when exact misses, PARTIAL_SCORE XOR behavior.
- Edge cases: throws when `requiresScore=false`, high-scoring matches, 0-0 in legacy.
- Auto-scaling: base phase returns base, R16 1.5×, QF 2×, Final 3×, unknown phase/disabled returns base, rounds to integer (7×1.5→11).
- `calculateMaxPointsForPhase` (cumulative sum vs legacy max), `calculateMaxPointsForPool` (UCL 900-point total), `getPhaseConfig`, `isMatchBasedScoring`/`isStructuralScoring`.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./scoringAdvanced`, type `PhasePickConfig`/`MatchPicksConfig` from `../types/pickConfig`.

**Flags:** none.

### backend/src/lib/scoringAdvanced.ts

**Purpose:** Advanced pick-scoring engine. Evaluates a user's match prediction against the official result under either a cumulative (sum each matched criterion) or legacy (EXACT_SCORE short-circuits) system, plus auto-scaling and theoretical max-points calculators.

**What it does:**
- Local types `MatchScore`/`MatchPick` (`{ homeGoals, awayGoals }`).
- `isCumulativeScoring(enabledTypes)` — returns true if `HOME_GOALS` or `AWAY_GOALS` is enabled (the signal to use cumulative mode).
- `scoreMatchPick(pick, result, config)` — throws if `requiresScore=false`/no `matchPicks`. Filters enabled types, then:
  - Cumulative branch: independently evaluates and sums `MATCH_OUTCOME_90MIN`, `HOME_GOALS`, `AWAY_GOALS`, `GOAL_DIFFERENCE`, `TOTAL_GOALS`, and (additively, without short-circuit) `EXACT_SCORE` and `PARTIAL_SCORE`, recording a `PickEvaluationResult` per evaluated type.
  - Legacy branch: `EXACT_SCORE` matched → records it and returns immediately (terminates); otherwise cascades through `GOAL_DIFFERENCE`, `PARTIAL_SCORE`, `TOTAL_GOALS`, `MATCH_OUTCOME_90MIN`.
  - Returns `{ matchId: "", totalPoints, evaluations }` (matchId filled by caller).
- Per-type evaluators: `evaluateExactScore` (both goals equal), `evaluateGoalDifference` (equal goal diff), `evaluatePartialScore` (XOR — exactly one side matches), `evaluateTotalGoals` (equal total), `evaluateMatchOutcome` (same HOME/DRAW/AWAY result).
- Auto-scaling: `applyAutoScaling(basePoints, phaseId, config)` multiplies by `config.autoScaling.multipliers[phaseId]` (rounded) when enabled, else returns base. `applyAutoScalingToConfig(config, phaseId)` returns the config with all match-pick type points scaled.
- Max points: `calculateMaxPointsForPhase(config, matchCount, phaseId?)` — 0 for structural phases; applies auto-scaling; for cumulative sums all enabled type points, for legacy takes the max single type; multiplies by `matchCount`. `calculateMaxPointsForPool(phases, matchCountByPhase)` sums across phases.
- Helpers: `getPhaseConfig(phases, phaseId)`, `isMatchBasedScoring(config)`, `isStructuralScoring(config)`.

**Exports:** `scoreMatchPick`, `applyAutoScaling`, `applyAutoScalingToConfig`, `calculateMaxPointsForPhase`, `calculateMaxPointsForPool`, `getPhaseConfig`, `isMatchBasedScoring`, `isStructuralScoring`.

**Key dependencies:** type imports `PhasePickConfig`, `MatchPicksConfig`, `MatchPickTypeKey`, `PickEvaluationResult`, `MatchScoringResult` from `../types/pickConfig`.

**Flags:** Imported type `MatchPickTypeKey` does not appear to be referenced in the module body (likely unused import). Low confidence / minor.

### backend/src/lib/scoringBreakdown.test.ts

**Purpose:** Vitest suite for `scoringBreakdown.ts` (the file generating UI-facing per-rule breakdowns), including consistency checks against `scoringAdvanced.ts` and real-world UCL scenarios. (Note: the implementation `scoringBreakdown.ts` is not part of this batch's file list — this is its test suite.)

**What it does:**
- Helpers build cumulative (group/knockout), legacy multi-type, `GROUP_STANDINGS`, and `KNOCKOUT_WINNER` configs.
- `generateMatchPickBreakdown` (CUMULATIVE): NO_PICK when pick is null (still reports `totalPointsMax`), pending when result null, exact-score shows all 4 rules matched and `"10 / 10 pts"` summary, knockout 20-max, partial-match per-rule results, and all-unmatched for zero points.
- `generateMatchPickBreakdown` (LEGACY): EXACT_SCORE termination marks other rules `pointsMax=0` with `"No aplica"` detail, missed exact cascades, and `totalPointsMax` is the highest single type.
- `generateGroupStandingsBreakdown`: NO_PICK on null, perfect groups award positions + perfect-group bonus (48/group, 96 total), partial positions give proportional points without bonus, and no bonus when imperfect.
- `generateKnockoutWinnerBreakdown`: NO_PICK reports max (4×15=60), all-correct gives max, partial gives proportional, pending shows 0 earned with a "Pendiente" summary.
- Consistency block: parametrized cases assert `generateMatchPickBreakdown(...).totalPointsEarned` equals `scoreMatchPick(...).totalPoints` for cumulative groups, cumulative knockout, and legacy configs.
- Real-world UCL block: three concrete match scenarios validating cumulative totals.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `./scoringBreakdown`, `./scoringAdvanced` (`scoreMatchPick`), type `PhasePickConfig`.

**Flags:** none. (The `makeGroupStandingsConfig` fixture uses `pointsPosition1..4` keys, which differ from the preset's `pointsPerExactPosition` shape — the breakdown implementation evidently accepts per-position keys; worth noting as a config-shape divergence between presets and breakdown, but it lives in files outside this batch.)
