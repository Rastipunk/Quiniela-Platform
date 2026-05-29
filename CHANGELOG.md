# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [Unreleased]

### Sales (cuenta de cobro), locale resolution, payment observability + parity

Work shipped between 2026-05-12 and 2026-05-27 (migrations `20260512_*` through `20260527_*`). The code-level version is unchanged (`backend/package.json` and `frontend-next/package.json` remain `1.0.0`, `BUILD_VERSION` remains `v1.0.0`); these changes land under `[Unreleased]` until the next version bump.

#### Added — Sales management (Quote + Cuenta de Cobro)
- **Quote / AccountReceivable / DocumentCounter models** (`schema.prisma`, migration `20260522_add_sales_management`). Server-derived sales documents: a quote (cotización) and a cuenta de cobro (CC) with consecutive numbering per series via `DocumentCounter`.
- **Sales services** — `services/sales/quoteService.ts`, `services/sales/accountReceivableService.ts`, `services/sales/documentCounterService.ts`. Pricing is **always** derived server-side via `lib/pricing.ts`; admins cannot override the amount.
- **Sales routes** — `routes/adminSales.ts` (admin quote + CC management) and `routes/salesRedemption.ts` (public CC code redemption at checkout). This brings the backend router count to 30 modules.
- **PDF generation** — `pdf/QuoteDocument.tsx`, `pdf/CcDocument.tsx`.
- **Admin sales UI** under `/admin/ventas/...`.
- **Soft-revoke invariant** — quotes and cuentas de cobro are never hard-deleted; cancellation sets `status='CANCELLED'` so the consecutive series shows no gaps. CC redemption uses an atomic `updateMany WHERE status='PENDING'` lock inside the same transaction as `PoolPayment.create`; pricing drift between the CC snapshot and live `lib/pricing.ts` blocks redemption with `409 CONFLICT` + a `cc_pricing_drift` admin alert. See ADR-061.
- **CC expiry sweep** — `jobs/accountReceivableExpiryJob.ts` (advisory lock `82636504`) marks stale PENDING cuentas as expired.

#### Added — Locale resolution + locale preference
- **`User.locale`** (`String?`, ISO 639-1) — explicit per-user locale choice (migrations `20260512_add_user_locale_preference`, `20260512_user_locale_nullable`).
- **`POST /users/me/locale-preference`** writes `User.locale`, the `NEXT_LOCALE` cookie (defensive backup for the client-side write), and is the single happy-path trigger for the deferred welcome email.
- **Locale-resolution architecture** — `next-intl` runs in URL-prefix-only mode (`localeCookie: false` + `localeDetection: false` in `i18n/routing.ts`); `frontend-next/src/proxy.ts` is the sole authority for cookie / `Accept-Language` / default fallback. Frontend `LocalePreferenceGate` / `LocalePreferenceModal` capture the first-login choice. See ADR-064.

#### Added — Corporate invitation locale
- **`Organization.invitationLocale`** (`String NOT NULL DEFAULT 'es'`, migration `20260526_add_organization_invitation_locale`) governs the corporate-activation email **only**; once the employee completes the locale modal, `User.locale` takes over for every downstream email. See ADR-062.

#### Added — Deferred welcome-email handoff
- **`User.welcomeEmailSentAt`** (`DateTime?`, migration `20260526_add_user_welcome_email_sent_at`) is the idempotency key for the welcome email, which is no longer sent inline from signup/activation. It fires from `POST /users/me/locale-preference` (happy path) or `jobs/welcomeEmailFallbackJob.ts` (24h safety net, advisory lock `82636505`). Locale-correct activation/welcome links are built via `lib/activationUrl.ts`. See ADR-063.

#### Added — Payment observability (lifecycle + telemetry)
- **`PaymentStatus.INITIATED` and `PaymentStatus.ABANDONED`** states (migrations `20260519_extend_payment_observability`, `20260521_pool_payment_initiated_state`). `INITIATED` marks a row written before the gateway call (so a gateway-side failure leaves a trail); `ABANDONED` marks a stale PENDING/INITIATED swept by the reconciler. `PoolPayment.polarCheckoutId` is now nullable with a partial unique index (`UNIQUE WHERE polarCheckoutId IS NOT NULL`).
- **`PaymentEvent` extended** beyond Polar webhooks to cover MP webhooks, client-side beacons (`REDIRECT_INITIATED` / `REDIRECT_FAILED` / `USER_CANCELLED` / `CLIENT_ERROR`), reconciler-issued transitions, and server transitions, via the TEXT `source` discriminator (`POLAR_WEBHOOK` / `MP_WEBHOOK` / `CLIENT` / `RECONCILER` / `SERVER`). `polarEventId` is now a partial unique index (unique only when non-NULL).
- **Payment-attempt telemetry** — frontend `lib/api/paymentAttemptEvent.ts` emits MP Brick lifecycle beacons (`REDIRECT_INITIATED` / `USER_CANCELLED` / `CLIENT_ERROR`) via `navigator.sendBeacon`. See ADR-066.

#### Added — Mercado Pago payment reconciler + completion parity
- **`PoolPayment.mpPaymentId`** (migration `20260527_add_mp_payment_id_and_status_index`) stores MP's real `payment.id`, set defensively on the first IPN delivery so the reconciler can resolve stuck rows. Adds the compound index `(status, createdAtUtc)` shared by both reconcilers' stale-row queries.
- **`jobs/mpPaymentReconcileJob.ts`** (advisory lock `82636506`) — MP reconciler; auto-completes `approved` payments via the shared `markPaymentCompleted` function. Runs concurrently with the Polar reconciler `jobs/paymentReconcileJob.ts` (advisory lock `82636503`), which flags for human review instead (intentional asymmetry).
- **`markPaymentCompleted` single-entry rule** — every path that marks a `PoolPayment` `COMPLETED` (Polar webhook, MP sync, MP IPN, either reconciler) routes through `paymentService.markPaymentCompleted`, which owns the atomic transaction (PaymentEvent + PoolPayment + Pool + AccountReceivable + AuditEvent) and the post-tx fan-out (admin notification, CAPI Purchase, GA4 purchase, receipt email). MP sync and IPN share the idempotency key `mp-{id}-approved`. See ADR-065.

---

## [1.0.0] — 2026-05-04

### Production release

The platform reaches **1.0** — production-stable, feature-complete for the 2026 World Cup launch, and aligned with the source-of-truth documentation. No new product features ship in this entry; the bump synchronises versioning across the codebase, the `/health` endpoint, and the changelog after a multi-week documentation audit.

#### Versioning sync
- `backend/package.json` and `frontend-next/package.json` bumped from `0.6.0` to `1.0.0`. Subsequent releases will land here as `[1.x.y]` per Keep a Changelog.
- `BUILD_VERSION` in `backend/src/server.ts` updated to `v1.0.0`. `/health` now reports the canonical version (was stuck at `v0.6.0` despite ten releases of cumulative changes since March).
- Documentation examples (API_SPEC, BUSINESS_RULES, DEPLOYMENT, SETUP) updated to show `v1.0.0` in `/health` snippets.

#### Documentation alignment (no code changes)
The 7-phase documentation revision that landed across `3e0bc4c → 08f2cca` is now part of 1.0:
- CLAUDE.md, README.md, PRD.md aligned with scraper-first results, dual-gateway payments, and current admin tooling.
- ARCHITECTURE.md and DATA_MODEL.md espejan el schema (32 modelos, 57+ migraciones), incluyendo `EmailSuppression`, `OrganizationBrandingAudit`, `FailedAnalyticsEvent`.
- API_SPEC.md cubre los 28 routers reales (Payments, Webhooks, Unsubscribe, Analytics Dashboard documented por primera vez).
- BUSINESS_RULES.md regla #6 corregida a "Scraper-First Results".
- DECISION_LOG.md +6 ADRs nuevos (052 scraper-first, 053 Mercado Pago, 054 DLQ, 055 EmailSuppression, 056 OrganizationBrandingAudit, 057 admin dashboard) y 3 marcados Superseded (031, 036, 043).
- GLOSSARY.md unificado contra `pickPresets.ts`, sin referencias a `PoolMemberRequest` (no existe), `SUSPENDED` (no existe), o `/docs/sot/` (no existe).
- Las 6 guías de sistemas (EMAIL, SCORES, TOURNAMENT, ATTRIBUTION, ANALYTICS, PREDICTION_UPDATES) reflejan scraper-first y los flujos nuevos.

#### Removed (TECH_DEBT cleanup)
- "package.json version vs CHANGELOG" item retirado — resuelto por este bump.

---

## [0.11.0] — 2026-05-03

### Deep audit — corporate flow hardening + payments correctness

A multi-day audit of the corporate pool flow surfaced 22 critical issues. This release closes 18 of them across pricing correctness, webhook reliability, race conditions, security hardening, and UX. Six PRs deployed to main. The remaining 4 (one schema migration on FK `onDelete`, captcha on public inquiry, two minor race fixes) are tracked for the next sprint.

See `docs/DECISION_LOG.md` ADR-045 through ADR-051 for the rationale behind each design decision.

#### Fixed — Pricing & money
- **Corporate USD pricing divergence (`pricing.ts`).** The BE charged 32% over the price the wizard showed for the 100-employee tier ($65.97 vs $49.99) because `corporateCumulativePrice` counted blocks from `CORPORATE_FREE_LIMIT` (2) instead of from the first paid tier (100). Aligned the USD function with the COP version which already had the correct logic. Same gap closed at 150, 200, 300, etc.
- **Mercado Pago receipt amount (`paymentService.ts`).** The receipt email displayed `$6.597 COP` to a customer who had paid `$260.000 COP` because the formatter read the USD-cents column (`amountUsd`) and labelled it as pesos. Now uses `amountCop` via the `mpPurchaseValue()` helper. Same fix applied to refund analytics (GA4 `refund` value, Meta CAPI `Refund`) and to `getPaymentStatus` consumed by the success page.
- **MP `unit_price` in `additional_info`.** Was sent as USD cents; changed to COP pesos so the metadata matches the actual charge (avoids tripping MP's antifraud).

#### Fixed — Webhook reliability
- **5xx-on-error contract.** Polar and MP webhook routes returned `200` even when the inner handler threw, with the explicit comment "to prevent retries on our errors." That swallowed transient failures (DB outage, network) and lost pagos. Now: signature failures return 401, everything else returns 500 + `retryable: true`, the gateway retries with exponential backoff. Idempotency via `PaymentEvent.polarEventId` UNIQUE makes retries safe.
- **MP webhook timestamp drift validation.** The HMAC verification used the timestamp in the signature but never compared it to `Date.now()`. Replay window was infinite. Now rejects anything outside `MP_WEBHOOK_MAX_DRIFT_MS` (default 5 min, env). Auto-detects seconds vs ms units (MP's docs example shows seconds; ms is forward-compat).
- **MP eventId now includes status (`mp-{paymentId}-{status}`).** The previous key (`mp-{paymentId}` only) deduped ALL webhooks after the first, so a payment that arrived as `pending` first never saw its later `approved` webhook processed — pool stuck in PENDING. Each transition now gets its own slot; genuine same-status retries still dedupe.
- **`PaymentEvent.create` moved INSIDE the transaction** in all three webhook handlers (Polar `order.paid`, Polar `order.refunded`, MP IPN per status branch). Previously the slot persisted even when the rest of the tx failed, blocking retries. Now rolls back atomically.
- **`PAYMENT_NOT_FOUND_RETRYABLE` instead of silent return** when the webhook arrives before the `PoolPayment` row is committed (50–200ms race). The throw triggers the gateway's retry; the row exists on the second attempt.

#### Fixed — Race conditions
- **`initiateMpCheckout` is now idempotent.** Mirrors Polar's existing pattern: re-entry (host double-click, page reload mid-flow) returns the EXISTING `PoolPayment` and reuses the MP preference. Required adding `PoolPayment.mpPreferenceId String?` (additive migration `20260503_add_mp_preference_id`).
- **`sendInvitations` atomic per-invite claim.** Bulk send used to fetch all PENDING invites and loop sequentially, so two concurrent host clicks doubled the email volume per employee. Now claims each row inside the loop with `updateMany WHERE id=X AND status=PENDING SET status=SENT`; the second concurrent call sees `count=0` per row and skips silently.
- **`metaEventId` generated up-front and persisted in the same tx** as `status: COMPLETED` (was a separate update afterwards). Prevents Pixel ↔ CAPI dedup from breaking when the second update fails.

#### Fixed — Security
- **HTML escape across all 17 email templates.** Host-controlled values (`companyName`, `poolName`, `displayName`, etc.) and attacker-controlled values (`attemptedEmail`, `contactName`) now pass through `escapeHtml()` before HTML interpolation. Closed the XSS-via-public-inquiry vector and the host-injected-HTML vector for activation emails. Full coverage verified by `emailTemplates.xss.test.ts` (renders every template with `<script>...</script>` payloads). New helper module `backend/src/lib/htmlSafe.ts`.
- **Magic-link session-mismatch defence.** `POST /auth/activate-corporate` now refuses with `409 SESSION_MISMATCH` when the request carries an auth cookie for a different user than the invite's recipient. Frontend renders a "you're signed in as X — sign out and continue" panel. Email comparison is case-insensitive; null/expired/invalid cookies are treated as anonymous.
- **Per-IP rate limits on the public corporate-invite endpoints.** `GET /auth/check-corporate-invite` (env `RATE_LIMIT_INVITE_CHECK_*`, default 20/min) blocks token-list enumeration. `POST /auth/activate-corporate` (env `RATE_LIMIT_INVITE_ACTIVATE_*`, default 10/15min) defends against token brute-force.

#### Fixed — UX
- **Wizard alerts on checkout creation failure.** When `createCheckout` / `createMpCheckout` rejected, the wizard used to silently redirect to the pool, leaving the host on a 2-cap pool thinking the price they saw had been applied. Now shows an alert before redirecting so the host knows to retry expansion from the admin tab. New i18n key `poolWizard.checkoutFailedFallback` in ES/EN/PT.

#### Changed — Corporate flow simplification
- **Wizard no longer has an "invite employees" step.** `StepEmployeeInvites` and `state.employeeEmails` removed. Pool is created with only the host as `CORPORATE_HOST`. ALL employee invitations now happen post-creation from the pool admin tab via `CorporateEmployeeManager`. Single source of truth, simpler funnel. Backend `createCorporatePool` still accepts an optional `emails` array for back-compat.
- **Per-user rate limit replaces per-IP catch-all on `/corporate/pools/*`.** The old `corporateInviteLimiter` (5/hour per IP) blocked hosts from navigating their own pool because GETs shared the bucket with POSTs. Replaced by `inviteSendLimiter` (200/hour per host) + `inviteSendDailyLimiter` (1000/day per host) applied only to the actual send endpoint. `RATE_LIMIT_CORP_INVITE_*` env vars no longer read.

#### Added — Corporate features
- **Per-employee resend invitation** (`POST /corporate/pools/:poolId/employees/:inviteId/resend`). Rotates the activation token (old one invalidated — defends against forwarded leaked emails) and resets the 30-day expiry. Refused for `ACTIVATED` invites. Reuses the same per-user rate limits as bulk send (shared budget). UI in `CorporateEmployeeManager` shows "Reenviar" on `SENT` rows and "Reintentar" on `FAILED` rows.
- **Capacity-threshold notifications.** Single function `checkAndNotifyCapacityThresholds()` runs after every pool join and dispatches at most one of: `CAPACITY_WARNING` email at the configurable threshold (env `CAPACITY_WARNING_THRESHOLD_PCT`, default 95%, overridable per pool), `POOL_FULL` email at 100%. Both deduped; flags re-armed when capacity expands.
- **Blocked-attempt notification.** When a join is rejected with `POOL_FULL`, the host receives `BLOCKED_JOIN_ATTEMPT` email. Throttled per pool by `Pool.lastBlockedAttemptNotifiedAt` (env `BLOCKED_ATTEMPT_THROTTLE_HOURS`, default 24h).
- **Capacity badge in `CorporateEmployeeManager`.** Always-visible card showing `X / Y employees (NN%)` with a thin progress bar; three visual states (normal <95%, warning 95–99%, full =100%) and an "Expand capacity" CTA on warning/full.
- **Friendlier `POOL_FULL` activation message** in `ActivationContent`. Confirms the host was notified and offers a path forward (contact the host directly).
- **Activation token preservation across renders fix.** The HI-02 URL strip (`window.history.replaceState` removing `?token=...`) was racing the `useSearchParams` re-read, leaving `tokenParam=""` for the existing-user "Unirme al pool" handler. Captured the token via `useState` lazy initializer at first mount; survives the URL strip.

#### Schema (additive migrations)
- `Pool.poolFullNotifiedAt`, `Pool.capacityWarningNotifiedAt`, `Pool.capacityWarningThresholdPct`, `Pool.lastBlockedAttemptNotifiedAt` (migrations `20260502_add_capacity_warning_fields`, `20260502_add_blocked_attempt_notify`).
- `PoolPayment.mpPreferenceId` (`20260503_add_mp_preference_id`).
- All nullable; no backfill required.

#### Removed
- `RATE_LIMIT_CORP_INVITE_MAX` and `RATE_LIMIT_CORP_INVITE_WINDOW_MS` env vars (replaced by `RATE_LIMIT_INVITE_SEND_*`, `RATE_LIMIT_INVITE_CHECK_*`, `RATE_LIMIT_INVITE_ACTIVATE_*`).
- `frontend-next/src/components/pool-wizard/steps/corporate/StepEmployeeInvites.tsx` and the `state.employeeEmails` wizard state field.
- The `RECOMMENDED_MAX_PARTICIPANTS_*` constant name (renamed to `DEFAULT_MAX_PARTICIPANTS_*` to reflect the actual semantics — it's the wizard's pre-selected default, not a recommended upgrade).

#### Tests
30+ new unit tests across pricing parity, webhook retry semantics, race-condition claims, XSS escape coverage, `SESSION_MISMATCH` handling, rate-limit configuration, MP idempotency, and resend token rotation. Total backend suite: 600+ passing (12 pre-existing failures in unrelated `pickPresets` and email-toggle tests; tracked in `TECH_DEBT.md`).

---

## [0.10.0] — 2026-04-22

### Analytics stack restored + deep-audit hardening

Two weeks of work to first restore GA4 measurement (silent outage since
2026-04-10 caused by a misconfigured GTM consent check) and then
harden the rest of the stack against future regressions.

#### Added — Analytics observability
- **`GET /admin/analytics/probe`** + **`POST /admin/analytics/probe/send-real-purchase`** — admin-only diagnostic endpoints that hit GA4 `/debug/mp/collect` and Meta Graph `/events` directly and report structured results. Dashboard at `/admin/analytics-health`.
- **Startup warnings** for every missing analytics env var so Railway logs make gaps obvious.
- **Admin-gated debug mode** — `?gtm_debug=1` now requires the `p4a_admin` non-httpOnly cookie set by `setAuthCookies({ isAdmin: true })`.
- **Client-side Consent Mode panel** in the health dashboard — reads `window.dataLayer` live so operators see `analytics_storage` / `ad_storage` state and dataLayer event counts without GTM Preview.
- **Referral graph** — `User.referredByUserId` self-FK + `PoolInvite.acceptedByUserId`. Fires GA4 `referral_conversion` + Meta `Lead` with `referrer_user_id` when a user joins via another user's invite.

#### Added — Server-side sinks
- **GA4 Measurement Protocol client** (`backend/src/lib/ga4.ts`) with retry + DLQ mirroring the Meta CAPI client.
- **Unified DLQ** — `FailedAnalyticsEvent` table with `provider` discriminator replaces the old CAPI-only queue.
- **Postgres advisory lock on the drainer** — `pg_try_advisory_xact_lock(82636502)` so multi-replica Railway deploys never double-send.
- **8s timeout + AbortController** on every fetch to Graph API / google-analytics.com.
- **±25% / ±20% jitter** on all retry backoffs to break up thundering-herd retries after an outage window.
- **Per-failure logging** in `batchSendEmails` (new `failures` array in the return shape) so bad-DKIM cohorts don't hide behind a success count.

#### Added — Event coverage
- `email_verification_sent` + `email_verification_completed` (activation funnel).
- `payment_failed` on all three failure surfaces (Polar webhook `expired`/`failed`, MP sync `rejected`, MP IPN `rejected`/`cancelled`) with `reason` / `payment_method` / `affiliation`.
- `begin_registration` on the AuthSlidePanel register tab.
- `pool_left` in `poolMemberService.voluntaryLeavePool`.
- `login` (GA4) + `Login` (Meta CAPI) for Google OAuth returning-user branch — new-user branch already emitted `sign_up` / `CompleteRegistration`.
- **Five new GA4 user_properties** on `/me/aggregated`: `is_verified_email`, `signup_method`, `predictions_count`, `last_active_at`, `pool_host_count`.

#### Added — Meta Advanced Matching
- `PoolPayment.metaFbp` / `metaFbc` / `clientIpAddress` / `clientUserAgent` captured at checkout creation so async webhook flows (Polar `order.paid`, MP IPN) can enrich the CAPI Purchase with the same signals the synchronous flow already had. Expected EMQ score lift: +2-3 points.
- Switzerland (`CH`) added to `EEA_COUNTRY_CODES` — revFADP aligns with GDPR.

#### Added — Cookie UX
- Redesigned consent banner — card popover bottom-left (bottom-sheet mobile), benefit-led headline, brand-gradient primary CTA, muted text-link secondary. GDPR-compliant (both options 44px tap target) without symmetric visual weight.
- **"Gestionar cookies"** footer link (ES/EN/PT) re-opens the banner via a new `p4a:consent:reopen` custom event. Satisfies GDPR Art. 7(3) / CCPA easy-revocation requirement.
- Consent defaults hydrated from localStorage + `p4a_logged_in` cookie at document parse time so returning-granted users skip the denied → cookieless ping window on first load.
- Cross-tab logout flush via `p4a_auth_logout_tick` localStorage broadcast + new `AuthAnalyticsSync` component — sibling tabs revoke Meta Pixel and clear GA4 user_id automatically.

#### Added — Schema
- `PoolPayment.amountCop` — real COP pesos paid (MP) stored explicitly. Used by `mpPurchaseValue()` for GA4/Meta `value` so Colombian revenue stops being under-reported ~40× (the old path used USD cents mis-labelled as pesos).
- `FailedAnalyticsEvent` table — see §3.30 of `docs/DATA_MODEL.md`.

#### Added — Docs
- [`docs/guides/ANALYTICS_PIPELINE.md`](docs/guides/ANALYTICS_PIPELINE.md) — end-to-end diagram of the retry ladder, advisory lock, env vars.
- [`docs/guides/ATTRIBUTION_TAXONOMY.md`](docs/guides/ATTRIBUTION_TAXONOMY.md) — canonical UTM values, event catalogue, user_properties table, reserved param names.
- `backend/src/routes/analyticsHealth.ts` + `frontend-next/src/components/AnalyticsHealthContent.tsx`.
- `TECH_DEBT.md` — refactor items deferred to post-mundial.

#### Fixed — Consent Mode v2
- `updateConsent("granted")` now also emits `gtag("set", "ads_data_redaction", false)`. Without this, GA4 kept redacting `gclid` / user-agent on ad pings forever after accept, silently breaking Google Ads attribution.
- GTM container V4 — removed the "Comprobaciones de consentimiento adicionales: analytics_storage" hard-block on both tags that was discarding every cookieless ping since 2026-04-10. Consent-Mode-v2 integrated signals continue to gate correctly.

#### Fixed — Business logic
- **Pick deadline comparison is `>=`** in both server-side reject (`upsertPick`) and display-side `isLocked`. Kept in sync so the UI locking and the save endpoint agree at the edge millisecond.
- **Pool completion** now filters `currentVersionId: { not: null }` — a result row with no published version no longer flips the pool to COMPLETED with a half-scored leaderboard.
- **LEFT members regain read-only access** — `requirePoolMemberReadAccess` added, used by `getPoolMatches` / `getMatchPicks` / `getMyPicks`. Writes still gate on ACTIVE via `requireActivePoolMember`.
- **MP webhook HMAC** compared with `crypto.timingSafeEqual` instead of `===`.

#### Fixed — Error handling
- `poolAdminService` scoring loop no longer swallows `scoreMatchPick` errors silently — logs `poolId` / `userId` / `matchId` and keeps looping.
- Three `.catch(() => {})` in `fixtureTrackingJob` / `fixtureVerificationJob` notification paths now log the error instead of dropping it.
- `401`/`403`/`408`/`429` on CAPI + GA4 reclassified as transient. Rotating `META_CAPI_ACCESS_TOKEN` or `GA4_API_SECRET` no longer drops queued DLQ events during the rotation window.

#### Fixed — Validation
- Three admin list routes (`feedback`, `adminCorporate`, `adminSettings` reminder stats) migrated from `parseInt || default` to `z.coerce.number().int().min().max()` so invalid inputs return 400 instead of silently clamping.

#### Changed — Data model
- `User` gains first-touch attribution fields + referral FK (see `docs/DATA_MODEL.md` §3.1).
- `PoolInvite` gains `acceptedByUserId` / `acceptedAtUtc` (first-redeemer headline).
- `PoolPayment` gains `amountCop`, `metaFbp`, `metaFbc`, `clientIpAddress`, `clientUserAgent`.

#### Migrations applied
- `20260421_add_referral_graph`
- `20260421_refactor_dlq_and_ga4_mp`
- `20260421_add_pool_payment_amount_cop`
- `20260421_add_payment_meta_cookies`

---

## [0.9.0] — 2026-04-16

### Mercado Pago Integration, Pricing Overhaul, UX Improvements

#### Added
- **Mercado Pago Payment Brick** — Embedded checkout for Colombia (COP). Supports credit/debit cards, PSE, Efecty, Nequi, prepaid cards, and Mercado Pago wallet
- **MP webhook handler** — IPN notifications with HMAC-SHA256 signature verification (`MP_WEBHOOK_SECRET`)
- **MP preference creation** — Backend creates Mercado Pago preferences for Payment Brick initialization
- **Dynamic COP pricing** — Replaced hardcoded pricing table with dynamic computation: $28,500/block base, $1,500 discount every 2 blocks, $18,000 minimum
- **USD pricing in frontend** — Added USD tier tables mirroring backend logic for international users
- **Currency detection** — Automatic COP/USD display based on user country (ipapi.co + Cloudflare headers)
- **"How to Play" page** — `/como-se-juega` with visual CSS mocks: prediction card, live match, 3 scoring system tabs (Predictor/Basic/Strategist), leaderboard with phase filters, tournament timeline, winners podium
- **Pool type selection modal** — Dashboard "Create Pool" now shows Personal vs Corporate selection dialog
- **Pool full UX** — Specific error messages for users trying to join full pools (join page + corporate activation)
- **Corporate invite capacity warnings** — Banner in wizard and admin panel when invites exceed remaining capacity
- **Specific MP rejection messages** — Insufficient funds, bad CVV, expired card, etc. with i18n support (ES/EN/PT)
- **Custom capacity input** — "Select X players" button replaces "Coming Soon" overlay for custom player counts

#### Changed
- **Wizard step order** — Summary before Capacity. Capacity is now the last step with cart-style CTA ("Proceder al pago" / "Crear Pool")
- **Corporate free tier** — Changed from 100 players to 2 (host + 1 guest) for free trial
- **Corporate pricing card** — Green sticker "Prueba gratis todas las funcionalidades" floating above card
- **Personal Pro card** — Dynamic pricing badge ($28,500 COP / $7.99 USD based on country), added CTA button
- **Discount labels** — Changed from exact block discount to "Up to -X%" for transparency
- **Capacity validation** — Backend accepts min 1 for corporate pools (was min 100)

#### Removed
- **All "Coming Soon" overlays** — Pricing page and landing page paid tiers are now active
- **All "Beta" labels** — Header banner, enterprise page, pool messages
- **Wompi dead code** — Unused payment service client removed
- **Hardcoded COP pricing tables** — Replaced by dynamic computation

#### Fixed
- **Zod v4 compatibility** — `z.record()` requires 2 args in Zod v4
- **Payment Brick initialization** — Added required `customization.paymentMethods` configuration
- **Free tier redirect bug** — `handleContinueFree` now passes `capacityOverride` parameter to avoid stale React state
- **"un pool" → "una pool"** — Fixed gender inconsistency in Spanish how-it-works page

---

## [0.8.0] — 2026-04-10

### Production Readiness, Analytics, Scores Rework, Code Quality

#### Added
- **Google Tag Manager (GTM)** — `GTM-TJ86QBFG` replaces direct GA4 script. Manages GA4 + future pixels from GTM console
- **18 custom analytics events** — sign_up, login, pool_created, pool_joined, pick_saved, invite_code_created, wizard_step, cta_clicked, feedback_submitted, share_pool, pricing_page_viewed, language_changed, corporate_inquiry, error_displayed, pool_viewed, tab_changed, page_view, consent_update
- **4 GA4 conversions** — sign_up, pool_created, pool_joined, corporate_inquiry marked as key events
- **Cookie consent banner** — GDPR-compliant with GTM Consent Mode v2, auto-accept for authenticated users, DNT respect, i18n ES/EN/PT
- **User ID tracking** — Cross-device dedup via `setAnalyticsUserId()` on login/register
- **`useLiveRefresh` hook** — Auto-polls pool overview every 15s when any match is live
- **`ToggleSwitch` component** — Shared UI component replacing 16+ ad-hoc toggle implementations
- **`CookieConsent` component** — Global consent banner with accept/reject
- **`analytics.ts` utility** — Centralized `trackEvent()` via GTM dataLayer
- **Friendly pending approval page** — Amber card with guidance instead of red error
- **Friendly POOL_DRAFT error** — Clear message about needing players before picks
- **Scores integration doc** — `docs/guides/SCORES_INTEGRATION.md`

#### Changed
- **Scores: scraper-first architecture** — picks4all-scores is now primary source. API-Football is fallback only (activates 30min after estimated FT)
- **Scores: polling window** — Only polls AFTER kickoff (was 12h before). 5min buffer for early starts
- **Scores: 5-minute grace period** after FT before finalizing result as API_CONFIRMED
- **Scores: fixture tracking** — 24h lookahead (was 12h), deduplication via `trackedAtUtc`, admin email on failure
- **Corporate wizard unified** — `/empresas/crear` now uses `PoolCreationWizard` with `mode="corporate"`, sharing the same scoring UI as personal
- **Wizard nav buttons** — Sticky at bottom (always visible without scrolling)
- **Google Sign-In** — Moved above the form in auth panel (was buried below)
- **Landing grids** — CSS-only responsive (no JS/SSR mismatch), 1 column on mobile
- **Pricing** — Migrated from USD to COP at TRM 4000, tiers extended to 1500
- **Instance name** — "WC 2026 (Sandbox Instance)" → "World Cup 2026"
- **Privacy Policy** — Updated Section 11 (Cookies) to document GA4, GTM, consent banner
- **`colors.blue`** in theme.ts now points to brand primary (was Bootstrap #007bff)

#### Fixed
- **762 hardcoded hex colors** replaced with theme tokens across 51+ files
- **Horizontal overflow on mobile** — `overflow-x: hidden` on html/body
- **BetaFeedbackBar removed** — Replaced with discrete "Help & reports" in NavBar dropdown
- **Mundial data cleaned** — Removed test results, reset MatchSyncState to PENDING
- **Wizard summary i18n bug** — `pickTypes` count was showing raw translation key
- **RegisterButton** — Hardcoded Spanish label/aria replaced with i18n (ES/EN/PT)
- **NotificationBadge** — Added `role="status"` + `aria-label` for accessibility
- **Backend: `pickPresets.ts`** — `res.json()` → `sendData()` for consistent API response
- **Backend: `adminCorporate.ts`** — Added Zod validation for query params
- **Backend: `corporate.ts`** — Extracted env vars to module-level constants
- **Backend: `results.ts`** — Replaced `console.error` with `fireAndForget` pattern

#### Removed
- `BetaFeedbackBar.tsx` — Replaced by NavBar dropdown item
- `components/corporate/` directory (8 files) — Replaced by unified pool wizard
- `components/CorporatePoolCreation.tsx` barrel — No longer needed
- Dead code: `sendGone()`, `sendTooMany()` from apiResponse.ts
- Dead code: `startResultSyncJob()`, `stopResultSyncJob()`, `triggerManualSync()` from resultSyncJob.ts
- 4 accidental `desktop.ini` files from git

---

## [0.7.0] — 2026-04-04

### WC 2026 Instance, Branding System, Hardcode Elimination, API-First Results (2026-04-03 — 2026-04-04)

#### Added
- **API-first results** — Host can no longer publish results manually. Results come from SmartSync. Host can override existing results with mandatory reason + email notification to all members
- **Result override notification email** — `sendResultOverrideNotification()` sends to ALL active members with match description, previous/new result, reason, and pool link (ES/EN/PT)
- **"In play" badge** — Shown on match cards when `MatchSyncState.syncStatus === IN_PROGRESS`
- **Centralized branding** — `lib/brand.ts` in both frontend and backend. All colors, gradients, name, domain derive from single source. Backend supports runtime override via `BRAND_COLORS_JSON` env var
- **Centralized configuration** — `lib/siteConfig.ts` (SITE_URL, SITE_NAME), `lib/validation.ts` (form constraints), `lib/timezones.ts`, `lib/schemas.ts` (Zod field schemas)
- **`muteReminders` field** on Pool model — replaces hardcoded pool ID exclusion list
- **`apiFootballId`** on `templateTeamSchema` for direct team-to-API mapping
- **MATCH_SYNC constants** — Configurable sync windows via env vars
- **SUPPORTED_LOCALES / DEFAULT_LOCALE** in `constants.ts`
- **USER_RULES, PAGINATION, RESERVED_USERNAMES** constants centralized
- **Phase display names** moved to i18n (ES/EN/PT) from hardcoded Spanish
- **Deadline preset labels** internationalized via `t()` keys

#### Changed
- **WC 2026 seed completely rebuilt** — 48 confirmed teams (all playoffs resolved), 72 real fixtures from API-Football, official FIFA R32 bracket, real venues/kickoff times, MatchExternalMapping + MatchSyncState created
- **Domain picks4all.com extracted** from 52+ frontend files to `SITE_URL` env var
- **CORS and cookies** use `SITE_DOMAIN` env var instead of hardcoded domain
- **Rate limits** (6 limiters) now configurable via env vars
- **Email addresses** derive from `EMAIL_DOMAIN` env var
- **Pricing constants** configurable via `NEXT_PUBLIC_*` env vars
- **Team names in MatchCard** use `team.name` from API as primary source, static mapping as fallback only
- **Pending result UI** redesigned with gradient card, icon, and descriptive text
- **Override button** styled as warning (red) with email notification banner
- **ResultService** refactored: `getReadyClient()` pattern for email, strict null checks
- **CI workflow disabled** temporarily (Railway handles build validation)

#### Fixed
- **Chile replaced by Egypt** in WC 2026 Group G (Chile eliminated in CONMEBOL qualifying)
- **R32 bracket corrected** to match official FIFA structure (was using simplified sequential bracket)
- **R16/QF/SF connections** follow FIFA bracket paths (non-sequential)
- **Duplicate "escalar puntos"** removed from wizard advanced rules (already in StepScoring)
- **Double arrow** in wizard back button
- **Capacity value** translation parameter mismatch (`{count}` vs `{max}`)
- **Wizard draft** not clearing after pool creation (race condition with auto-save)
- **FROM_EMAIL** no longer falls back to Resend test domain
- **Brand gradient** deduplicated from ~30 inline occurrences to `colors.brandGradient`

#### Removed
- Hardcoded pool ID exclusion list from `deadlineReminderService.ts`
- Hardcoded `railway.app` URL from API client fallback and CSP
- `PHASE_DISPLAY_NAMES` hardcoded Spanish object (replaced by i18n)
- `STEP_LABELS` hardcoded Spanish object (replaced by i18n)

---

### Security & Infrastructure Audit (2026-03-18)

#### Security
- **Rotated RESEND_API_KEY** — old key invalidated, new key verified in production
- **Added unhandled rejection/exception handlers** in `server.ts` — prevents silent crashes
- **HTML sanitizer** (`sanitize.ts`) — protects `dangerouslySetInnerHTML` in SEO pages
- **Dependabot** configured for backend, frontend, and GitHub Actions (weekly scans)

#### Added
- **Error boundaries** — `error.tsx` for public and authenticated routes (i18n: ES/EN/PT)
- **CI/CD pipeline** — GitHub Actions (`ci.yml`): backend type-check + tests, frontend lint + build
- **Structured logger** (`logger.ts`) — JSON output in production, human-readable in dev
- **API request timeout** — 30s AbortController in frontend `requestJson()`
- **Skip-to-content link** — keyboard accessibility in root layout
- **Focus indicators** — `:focus-visible` styles (WCAG 2.1 AA) in `globals.css`

#### Changed
- **AuthSlidePanel** — added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **NavBar** — profile data cached in sessionStorage (5 min TTL), cleared on logout
- **API type safety** — replaced `any` types in `picks.ts`, `corporate.ts`, `pickConfig.ts`
- **RegionalArticlePage** — all `dangerouslySetInnerHTML` calls wrapped with `sanitizeHtml()`
- **server.ts** — migrated console.log/error to structured `logger` module

---

## [0.6.0] - 2026-03-01

### Corporate Self-Service MVP + Leave Pool + Pricing

#### Added
- **Corporate Self-Service System**
  - Organization model with inquiry → approval → pool creation flow
  - Corporate pool creation wizard (6-step guided flow at `/empresas/crear`)
  - Enterprise landing page (`/empresas`) with feature showcase
  - Employee management: CSV upload, individual invites, bulk operations
  - Token-based employee activation flow (`/activar`) with 30-day expiry
  - `CORPORATE_HOST` role with dedicated permissions
  - Corporate invitation emails + inquiry confirmation emails
  - Admin corporate management endpoints

- **Leave Pool Feature**
  - `POST /pools/:poolId/leave` — players voluntarily leave pools
  - Hosts/Corporate hosts cannot leave their own pools
  - LEFT members keep points, appear as "Retirado" in leaderboard
  - LEFT members get read-only access (can view but not make picks)
  - Dashboard tabs: "En curso" (active) and "Finalizadas" (finished)
  - Confirmation modal with irreversibility warning
  - Badge "Retirado" on leaderboard (desktop + mobile)

- **Pricing Section**
  - `/precios` page with feature comparison
  - Pricing cards on landing page
  - Free tier (up to 20 participants) + paid tiers

- **Locale-Aware Emails**
  - Footer, FAQ links, legal links change based on user locale
  - Admin notification system (`sendAdminNotification`)
  - Corporate activation + inquiry confirmation templates

#### Changed
- Dashboard pool cards show pool status badges (DRAFT, ACTIVE, COMPLETED, ARCHIVED)
- `GET /me/pools` now includes LEFT members (for Finalizadas tab)
- `GET /pools/:poolId/overview` includes LEFT members in leaderboard with `memberStatus`
- NavBar includes "Empresas" link for corporate access
- Pool page back link changed from "Dashboard" to "← Mis Pools" with styled pill

#### Technical
- New models: Organization, OrganizationInquiry, CorporateInvite
- New routes: `corporate.ts`, `adminCorporate.ts`
- New components: CorporatePoolCreation, EnterpriseLandingContent, ActivationContent
- AuthPanelContext extended with `redirectTo` parameter

---

## [0.5.0] - 2026-02-22

### Internationalization (i18n) + SEO Enhancements + Repo Cleanup

#### Added
- **i18n with next-intl v4** — Full support for Spanish, English, and Portuguese
  - `localePrefix: 'as-needed'` — Spanish has no URL prefix, EN/PT use `/en/`, `/pt/`
  - Translation files in `messages/{es,en,pt}/` (common, landing, auth, dashboard, pool, faq, seo, jsonLd)
  - Heavy SEO content as JSX components in `content/{es,en,pt}/`
  - Locale-aware `Link`, `useRouter`, `usePathname` via `@/i18n/navigation`
  - `LanguageSelector` component with country flags (ES/EN/PT)
  - Cookie `NEXT_LOCALE` persists language choice

- **Localized SEO**
  - `hreflang` alternates on all pages (es, en, pt, x-default)
  - Localized `sitemap.xml` with alternates per locale (36 entries)
  - JSON-LD `inLanguage` field uses current locale
  - `generateMetadata` with translated titles/descriptions on all pages
  - Auth pages (login, forgot-password, reset-password, verify-email) now have proper metadata

- **Regional Pages (EN/PT)**
  - `/en/football-pool` — English regional page
  - `/pt/penca-futbol` — Portuguese regional page (Penca de Futebol)

- **Legal Pages (EN/PT)**
  - Terms of Service and Privacy Policy translated to English and Portuguese

- **Footer Redesign**
  - Merged "Resources" + "By Country" sections into single "Explore" section
  - All 8 links visible: How it works, FAQ, Quiniela, Polla, Prode, Penca, Porra, Football Pool
  - Regional labels translated per locale with country context

- **Landing Page JSON-LD**
  - Made locale-aware: `inLanguage`, `description`, `featureList`, `ctaName` all from translations

#### Changed
- Middleware renamed from `middleware.ts` to `proxy.ts` (composes www redirect + next-intl)
- All pages moved under `app/[locale]/` segment
- All internal links use `@/i18n/navigation` Link (locale-aware)

#### Removed (Repo Cleanup)
- **`frontend/`** — Old Vite/React SPA (64 files, fully replaced by `frontend-next/`)
- **`backend/dev/`** — 31 dev dump files (JSON responses, expired tokens, demo scripts)
- **`backend/tmp/`** — 3 temp test files
- **39 one-time scripts** from `backend/src/scripts/` (check*, fix*, migrate*, test*, seed*AutoTest, etc.)
- **`docs/TODO_NEXT_SESSION.md`** — Contained exposed API key + obsolete TODOs
- **`docs/sprints/`** — 3 historical sprint reports (no longer relevant)
- **`docs/guides/TESTING_GUIDE_SPRINT2.md`** — Contained test passwords
- **`docs/guides/TEST_ACCOUNTS.md`** — Duplicate test account info
- **14 root-level artifacts** — Empty files (`√`, `7.2.0`, `curl`, `npx`, `nul`), Windows path dumps, temp docs (`FIXES_SUMMARY.md`, `QUE_DEBERIA_VER.md`, `TEST_ACCOUNTS.txt`, `repo_tree.txt`, `frontend_tree.txt`)

#### Updated Documentation
- `CLAUDE.md` — Updated stack to Next.js, frontend-next paths, current priorities
- `ARCHITECTURE.md` — Full rewrite reflecting Next.js, i18n, Railway deployment
- `API_SPEC.md` — Added 15+ missing endpoints
- `PRD.md` — Updated version, branding, completed features
- `CURRENT_STATE.md` — Updated to v0.5.0
- `.gitignore` — Added Next.js, Windows artifact patterns

---

## [0.4.0] - 2026-02-13

### Next.js Migration + SEO + Google Analytics (ADR-033)

#### Added
- **Next.js App Router Frontend** (`/frontend-next`)
  - Full SSR for all public pages (landing, FAQ, how-it-works, legal, regional)
  - Metadata API with type-safe title, description, OG tags per page
  - JSON-LD structured data: Organization, FAQPage, DefinedTermSet, WebApplication
  - Dynamic `sitemap.xml` and `robots.txt`
  - Dynamic branded favicon (`icon.tsx` — purple gradient P)
  - Dynamic OG image (`opengraph-image.tsx` — 1200x630)

- **Regional SEO Pages** (5 new pages targeting Spanish-speaking countries)
  - `/que-es-una-quiniela` — Glossary with all regional terms
  - `/polla-futbolera` — Colombia, Chile, Venezuela
  - `/prode-deportivo` — Argentina
  - `/penca-futbol` — Uruguay
  - `/porra-deportiva` — Spain
  - Spanish URLs: `/como-funciona`, `/terminos`, `/privacidad`

- **Google Analytics (GA4)** — Measurement ID `G-8JG2YTDLPH`
- **Google Search Console** — Verified, sitemap submitted, pages indexed
- **www → non-www redirect** — 301 via Next.js middleware
- **Accessibility improvements** — `aria-current="page"` on nav, `aria-label` on CTA

- **Authenticated Pages Migrated**
  - Login/Register with Google OAuth consent flow
  - Forgot Password, Reset Password, Verify Email
  - Dashboard with PoolConfigWizard + PhaseConfigStep
  - Pool page with all 16 sub-components (TeamFlag, GroupStandingsCard, KnockoutMatchCard, etc.)
  - Profile with EmailPreferences + EmailVerificationBanner
  - Admin pages (Email Settings, Feedback Viewer)
  - Authenticated layout with AuthGuard + NavBar + Footer

#### Fixed
- **Google Sign-In on Safari** — Disabled FedCM (`use_fedcm_for_prompt: false`), changed script to `beforeInteractive`, increased retry timeout to 10s
- **www redirect port 8080 bug** — Middleware was including Railway internal port in redirect URL
- **Backend Railway build** — Added `NPM_CONFIG_PRODUCTION=false` so devDependencies install during build

#### Changed
- **Tab title** — Shows "Picks4All" first instead of "Quinielas Deportivas..."
- **Modern browsers only** — browserslist targets Chrome 87+, Firefox 78+, Safari 14+, Edge 88+ (eliminates ~13KB legacy polyfills)

#### Technical
- PageSpeed Insights: Performance 93, Accessibility 95, Best Practices 96, SEO 100
- Railway service: Frontend-Next (ad6cc321-0e26-454b-8253-a2b67f49a050)
- Domain: picks4all.com (switched from old Vite SPA)
- ADR-033 documented in DECISION_LOG.md

---

## [0.3.5] - 2026-02-10

### Code Review + Documentation Update + Deployment Fixes

#### Added
- **Comprehensive Code Review**
  - 24 hallazgos backend (4 CRITICAL, 6 HIGH, 8 MEDIUM, 6 LOW)
  - 30 hallazgos frontend (7 CRITICAL, 7 HIGH, 8 MEDIUM, 8 LOW)
  - Auditoría de docs vs código con gaps identificados
  - Prioridad de fixes documentada en CURRENT_STATE.md

#### Fixed
- **Railway Backend Build Errors**
  - TypeScript union type error in `pickPresets.ts` (PhasePickConfig annotation)
  - Optional chaining for `sorted[idx + 1]?.id` in `pools.ts`
  - NIXPACKS_NODE_VERSION bumped to 22 in `backend/railway.toml`

- **Railway Frontend Build Errors**
  - Unused `setVerbose` variable in `PoolPage.tsx` (replaced with constant)
  - NIXPACKS_NODE_VERSION bumped to 22.13 in `frontend/railway.toml` (vite 7 requires >=22.12)

- **Pool Creation Validation**
  - Added `HOME_GOALS` and `AWAY_GOALS` to `MatchPickTypeKeySchema` Zod enum
  - Fixes VALIDATION_ERROR when creating pools with CUMULATIVE preset

#### Changed
- **Documentation Updated**
  - CURRENT_STATE.md fully rewritten to v0.3.5 (was stuck at v0.3.2)
  - CHANGELOG.md updated with v0.3.4 and v0.3.5 entries
  - Smart Sync system documented in CURRENT_STATE.md
  - UCL 2025-26 instance documented
  - Code review findings documented with severity, file references, and fix priorities

#### Technical
- Commits: `0dbffe7`, `9df2a68`, `ac348ed`
- Railway CLI installed and project linked
- All env vars configured on Railway production

---

## [0.3.4] - 2026-02-04

### Automatic Results System (Smart Sync) + UCL 2025-26

#### Added
- **Automatic Results via API-Football (ADR-031)**
  - Hybrid result system: MANUAL mode (Host enters) and AUTO mode (API-Football)
  - `ResultSourceMode` enum: MANUAL | AUTO (per TournamentInstance)
  - `ResultSource` tracking: HOST_MANUAL, HOST_PROVISIONAL, API_CONFIRMED, HOST_OVERRIDE
  - Decision matrix for result priority and overrides
  - Host can enter PROVISIONAL results while waiting for API
  - HOST_OVERRIDE (with mandatory reason) takes final precedence over API

- **Smart Sync - Optimized API Polling (ADR-032)**
  - Per-match state machine: PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
  - 85-90% reduction in API calls vs naive polling (2-4 per match vs 20-30)
  - First check: kickoff + 5 min (confirm match started)
  - Finish check: kickoff + 110 min (covers 95% without extra time)
  - Awaiting finish poll: every 5 min until FT/AET/PEN status
  - Cron job runs every minute, evaluates which matches need checking
  - Kill switch (`syncEnabled`) for emergencies

- **UCL 2025-26 Tournament Instance**
  - Template `ucl-2025` with 9 phases
  - 45 matches: Dieciseisavos (×2 legs), R16 (×2), QF (×2), SF (×2), Final
  - 16 matches scheduled (Dieciseisavos de Final)
  - 29 placeholder matches for later rounds
  - 16 API-Football fixture mappings
  - Seeded in production with sync states initialized

- **API-Football Integration**
  - HTTP client with rate limiting (10 req/min)
  - Fixture status handling: FT, AET, PEN
  - Match external mapping (internal ID ↔ API-Football fixture ID)
  - Result sync logs for audit trail

- **Admin Sync Endpoints**
  - `POST /admin/instances/:id/enable-auto-results` - Enable AUTO mode
  - `POST /admin/instances/:id/trigger-sync` - Manual sync trigger
  - `GET /admin/instances/:id/sync-status` - Sync job status

- **Production Configuration**
  - API-Football environment variables set on Railway
  - Smart Sync enabled in production
  - UCL 2025-26 instance seeded in production DB

#### Technical
- New models: MatchExternalMapping, ResultSyncLog, MatchSyncState
- New enums: ResultSourceMode, ResultSource, MatchSyncStatus, SyncStatus
- New services: smartSync/, apiFootball/, resultSync/
- New jobs: smartSyncJob.ts, resultSyncJob.ts
- New scripts: initSmartSyncStates.ts, seedUcl2025.ts
- ADR-031 and ADR-032 documented in DECISION_LOG.md

---

## [0.3.3] - 2026-02-01

### Rebranding to Picks4All + Public Website + Slide-in Auth Panel

#### Added
- **Rebranding to Picks4All**
  - Updated Footer component with new branding
  - Updated NavBar component logo to "🏆 Picks4All"
  - Updated contact email to soporte@picks4all.com
  - Updated copyright notice

- **Public Website Pages**
  - **LandingPage** (`/`) - Hero section, features grid (4 cards), how-it-works preview, tournament showcase (World Cup 2026), final CTA
  - **HowItWorksPage** (`/how-it-works`) - Detailed 5-step guides for both Hosts and Players, scoring system table example, CTAs
  - **FAQPage** (`/faq`) - 17 FAQ items with accordion UI, category filtering (General, Para Hosts, Para Jugadores, Cuenta), contact section

- **Public Navigation System**
  - **PublicNavbar** - Navigation for non-authenticated users with links: Inicio, Cómo Funciona, FAQ
  - **PublicLayout** - Wrapper component using PublicNavbar + Footer
  - Mobile-responsive hamburger menu with slide-in animation
  - Separate navigation experience for public vs authenticated users

- **Slide-in Auth Panel** (ADR-030)
  - **AuthSlidePanel** - Elegant slide-in panel from right side
  - Full login/register functionality without page navigation
  - Google Sign-in integration with consent flow for new users
  - Desktop: 420px wide panel, Mobile: full-screen
  - Features: tabs (Entrar/Crear cuenta), form validation, consent checkboxes, error handling
  - Accessibility: Escape key closes, backdrop click closes, focus management
  - "Abrir en página completa" link for password manager compatibility
  - Smooth CSS animations (slideInRight, fadeIn)

#### Changed
- **Routing Architecture**
  - Landing page shown at `/` for non-authenticated users
  - Authenticated users go directly to Dashboard
  - Public pages (`/how-it-works`, `/faq`) accessible regardless of auth state
  - `/login` page still available for full-page login experience

- **Legal Documents**
  - Rebranded Terms of Service from "Quiniela Platform" to "Picks4All"
  - Rebranded Privacy Policy from "Quiniela Platform" to "Picks4All"
  - Fixed database migration for legal document seeding

#### Technical
- New components: `AuthSlidePanel.tsx`, `PublicNavbar.tsx`, `PublicLayout.tsx`
- New pages: `LandingPage.tsx`, `HowItWorksPage.tsx`, `FAQPage.tsx`
- App.tsx routing refactored for public/private page separation
- `AUTH_INDEPENDENT_ROUTES` expanded to include `/how-it-works`, `/faq`, `/login`
- All public pages use `useIsMobile()` hook for responsive design

#### Git Tags
- `v0.3.3-pre-landing` - Before public pages implementation
- `v0.3.4-public-pages` - After public pages, before slide-in panel

---

## [0.3.2] - 2026-01-26

### Sistema de Notificaciones por Email + Railway Production Fix

#### Added
- **Email Notification System (ADR-029)**
  - Emails transaccionales via Resend
  - Welcome email para nuevos usuarios
  - Email verification flow con token seguro
  - Pool invitation emails
  - Deadline reminder service (configurable por admin)
  - Result published notifications
  - Pool completed notifications

- **Admin Email Settings Panel**
  - Toggle por tipo de email en `/admin/settings/email`
  - Solo accesible para ADMIN
  - Audit log de cambios

- **User Email Preferences**
  - Master toggle para desactivar todos los emails
  - Preferencias granulares por tipo de notificación
  - Sección en perfil de usuario

- **Email Verification**
  - Verificación de email para cuentas email/password
  - Token con expiración de 24 horas
  - Reenvío de email de verificación
  - Cuentas Google marcadas como verificadas automáticamente

- **Legal Documents Infrastructure**
  - Modelo `LegalDocument` para términos y privacidad
  - Versionado de documentos legales
  - Consent tracking con timestamps

#### Fixed
- **Railway Production Deployment**
  - Agregado `trust proxy` para rate limiting detrás de reverse proxy
  - Configurado `releaseCommand` para migraciones automáticas
  - Solucionado schema drift con migración de email verification fields
  - Health endpoint con información de versión y commit

#### Changed
- Registro ahora requiere aceptar términos, privacidad y confirmación de edad
- Google OAuth incluye consent flow para usuarios nuevos
- 401 responses incluyen `reason` field para mejor debugging

#### Technical
- 27 migraciones de base de datos (3 nuevas)
- `backend/railway.toml` configurado para deployments automáticos
- Nuevo servicio: `deadlineReminderService.ts`
- 44 tests para sistema de email
- Rate limiting específico para auth endpoints

---

## [0.3.1] - 2026-01-18

### Sprint 3 (Continued) - Mobile UX Optimizations + Light Theme Enforcement

#### Added
- **Pool Config Wizard Mobile Optimizations**
  - Hook `useIsMobile()` para detección responsive (breakpoint 640px)
  - Prop `isMobile` propagado a todos los componentes hijos
  - `PoolConfigWizard`: Bottom sheet modal en móvil, padding compacto
  - `PresetSelectionStep`: Cards horizontales compactas, descripciones cortas
  - `PhaseConfigStep`: Navegación con botones flex, textos abreviados
  - `DecisionCard`: Layout horizontal, padding reducido
  - `PickTypeCard`: Ejemplos colapsables, descripciones resumidas
  - `StructuralPicksConfiguration`: Inputs más pequeños, spacing reducido
  - `SummaryStep`: Tipografía escalada, padding adaptativo

- **Light Theme Enforcement (sistema operativo independiente)**
  - Meta tags HTML: `color-scheme`, `theme-color`, `supported-color-schemes`
  - Meta tag iOS: `apple-mobile-web-app-status-bar-style`
  - CSS override agresivo en `@media (prefers-color-scheme: dark)`
  - Selector `*` forzando `color-scheme: light only !important`
  - Override explícito para inputs, buttons, links, cards
  - Inline styles en `<html>` y `<body>` como fallback

#### Fixed
- **CUMULATIVE preset key mismatch** - Cambiado de `key: "CUSTOM"` a `key: "CUMULATIVE"` en pickPresets.ts
- Botones del wizard ocupaban espacio excesivo en móvil

#### Technical
- Nuevo hook: `frontend/src/hooks/useIsMobile.ts`
- Export adicional: `mobileInteractiveStyles` para estilos interactivos
- CSS mobile-first con breakpoint 640px
- Patrón de bottom sheet modal para diálogos móviles

---

## [0.3.0] - 2026-01-18

### Sprint 3 - Notificaciones Internas + Mobile UX + Rate Limiting

#### Added
- **Sistema de Notificaciones Internas (Badges)**
  - Endpoint `GET /pools/:poolId/notifications` para contadores
  - Componente `NotificationBadge` con colores y animación pulse
  - Hook `usePoolNotifications` con polling cada 60s
  - Badges en tabs de PoolPage:
    - 🔴 Rojo en Partidos: picks pendientes + deadlines urgentes
    - 🟠 Naranja en Admin: solicitudes pendientes + fases listas

- **Rate Limiting (ADR-028)**
  - Middleware `express-rate-limit` configurado
  - API general: 100 req/min por IP
  - Auth (login/register): 10 intentos/15min
  - Password reset: 5 solicitudes/hora
  - Headers estándar `RateLimit-*`

- **Mobile UX Improvements**
  - Tabs scrollables horizontalmente
  - Touch targets mínimo 44px
  - Scroll suave en iOS (WebkitOverflowScrolling)
  - Scrollbar oculto en tabs

#### Fixed
- Contraste de color mejorado en sección "Notas importantes" de PickRulesDisplay

#### Technical
- Nuevo directorio `frontend/src/hooks/`
- Animación CSS `@keyframes pulse` para badges urgentes
- Refetch de notificaciones tras acciones (pick, resultado, aprobación)

---

## [0.2.1] - 2026-01-18

### Sprint 2 (Completion) - Cumulative Scoring System

#### Added
- **Cumulative Scoring System** (ADR-027)
  - Nuevo modo de puntuación donde los puntos ACUMULAN por cada criterio
  - 4 criterios evaluados: Resultado, Goles Local, Goles Visitante, Diferencia
  - Grupos: máx 10 pts (5+2+2+1 por partido)
  - Knockouts: máx 20 pts (10+4+4+2 por partido)
  - Detección automática via `isCumulativeScoring()`

- **4 Presets de Scoring**
  - CUMULATIVE (Recomendado): Puntos acumulativos por criterio
  - BASIC: Solo marcador exacto o resultado
  - ADVANCED: Todos los criterios con puntos altos
  - SIMPLE: Configuración automática por fase

- **Player Summary Component**
  - Nueva pestaña "Mi Resumen" en PoolPage
  - Breakdown de puntos por partido y fase
  - Visualización de cada criterio acertado

- **Pick Visibility Post-Deadline**
  - Picks de otros jugadores visibles después del deadline
  - Leaderboard con detalle de picks por jugador

#### Changed
- PoolConfigWizard muestra ACUMULATIVO como preset recomendado
- PickRulesDisplay detecta modo cumulative vs legacy automáticamente
- scoringAdvanced.ts refactorizado para soportar ambos modos

#### Technical
- Nuevos tipos: HOME_GOALS, AWAY_GOALS en MatchPickTypeKey
- pickPresets.ts con configuración completa de 4 presets
- scoringBreakdown.ts genera maxPoints correcto por modo

---

## [0.2.0] - 2026-01-12

### Sprint 2 - Advanced Features

#### Added
- **Advanced Pick Types System**
  - GROUP_STANDINGS: Predecir posiciones de grupos
  - KNOCKOUT_WINNER: Predecir quién avanza en eliminatorias
  - SIMPLE preset con configuración automática por fase
  - Configuración personalizada (CUSTOM preset) con wizard
  - Scoring diferenciado por tipo de pick

- **Pool State Machine**
  - Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
  - Transiciones automáticas basadas en eventos
  - Validaciones por estado (joins, picks, results)

- **Co-Admin System**
  - Rol CO_ADMIN con permisos delegados
  - Endpoints: promote, demote
  - Auditoría completa de acciones

- **Join Approval Workflow**
  - Pool puede requerir aprobación para unirse
  - Endpoints: approve, reject pending members
  - Estado PENDING para solicitudes

- **User Profile**
  - Página de perfil con estadísticas
  - Configuración de timezone por usuario
  - Edición de displayName

- **Fixture Snapshot System**
  - Pool mantiene copia independiente del fixture
  - Equipos resueltos tras avance de fase
  - Integridad de datos por pool

#### Changed
- Login soporta Google OAuth
- Registro incluye username único
- Password recovery via email (Resend)

#### Technical
- 13 migraciones de base de datos
- Nuevo sistema de scoring estructural
- Validación de picks por fase y tipo

---

## [0.1.0] - 2026-01-04

### Sprint 1 - MVP Core

#### Added
- **Sistema de Username** (ADR-024)
  - Campo único e inmutable
  - Validación: 3-20 chars, alphanumeric
  - Reserved words bloqueadas

- **Google OAuth** (ADR-026)
  - Login/Register con Google
  - Integración con google-auth-library

- **Password Recovery** (ADR-025)
  - Forgot password flow
  - Email con Resend
  - Tokens de reset seguros

- **Tournament Advancement System** (ADR-019 a 023)
  - Auto-avance de grupos a eliminatorias
  - Validación de fase completa
  - Resolución de equipos por posición

#### Core Features
- Registro/Login (email/password)
- Dashboard con pools del usuario
- Crear pool con código de invitación
- Unirse a pool por código
- Ver partidos por grupo/fase
- Guardar/modificar picks antes de deadline
- Publicar resultados (HOST)
- Leaderboard con scoring configurable
- Hardening: token expirado → logout

---

## [0.0.1] - 2026-01-02

### Initial Setup
- Monorepo structure (backend + frontend)
- PostgreSQL + Prisma ORM
- Express + TypeScript backend
- React + Vite frontend
- JWT authentication
- Source of Truth documentation in /docs/sot/
