## Audit: docs/PRD.md

**Overall verdict:** UPDATE (severity: minor). The PRD is broadly accurate and current (post-2026-05-03 codebase). It correctly reflects the dual-gateway payment system (Mercado Pago + Polar, no Wompi/Lemon Squeezy residue), corporate self-service, BASIC/CUMULATIVE/SIMPLE/CUSTOM presets, the 5-value `ResultSource` hierarchy, pricing curves (USD + COP), and the `PoolMemberStatus` enum. The main defects are: one fully obsolete auth-storage claim (localStorage vs httpOnly cookies), and several shipped subsystems the PRD omits (sales/cuenta-de-cobro documents, payment reconcilers, payment-attempt telemetry, analytics DLQ/retry, the proxy-based locale resolution). Most of section-by-section content can be kept as-is.

---

### §4.2 Session Management — OBSOLETE
**What's wrong:** PRD states "Token stored in `localStorage` on frontend" and "Auto-logout on 401 response". The codebase has migrated to **httpOnly cookies**. `backend/src/lib/authCookies.ts:55 setAuthCookies()` sets an httpOnly JWT cookie (`COOKIE_NAME`) plus a non-httpOnly `LOGGED_IN_COOKIE` flag (and an `ADMIN_HINT_COOKIE`). On the frontend, `frontend-next/src/lib/auth.ts` no longer stores the JWT: `getToken()` reads the `LOGGED_IN_COOKIE` flag and actively *clears* legacy localStorage keys (`quiniela.token`, `token`); `setToken()` is a no-op that only cleans legacy keys and notifies listeners (the server already set the cookie via `Set-Cookie`).
**Fix:** Rewrite to: "JWT issued as an httpOnly cookie (HMAC-SHA256, 4h expiry). A non-httpOnly `logged_in` flag cookie lets client JS detect session state; an `admin_hint` cookie flags admins. Legacy localStorage tokens are cleared on load (migration complete)." Keep the 4h expiry and no-refresh-token points (confirmed `jwt.ts:15` `expiresIn: "4h"`, `algorithm: "HS256"`).

### §2.2 / §12-13 — MISSING: Sales documents (Quote + Cuenta de Cobro) subsystem
**What's wrong:** The PRD never mentions the sales-management feature, which is fully shipped (ADR-061). Backend: `backend/src/routes/adminSales.ts` (quotes + accounts-receivable issue/list/PDF/status), `backend/src/routes/salesRedemption.ts`, `backend/src/services/sales/quoteService.ts`, `accountReceivableService.ts`, `documentCounterService.ts`, PDF renderers in `backend/src/pdf/` (`QuoteDocument.tsx`, `CcDocument.tsx`, `renderQuotePdf.tsx`, `renderCcPdf.tsx`). Frontend: `/admin/ventas/cotizaciones` and `/admin/ventas/cuentas-de-cobro` pages + `AdminQuote*`/`AdminCc*` components, `AccountReceivableRedemptionBox.tsx`, `CorporateQuotePanel.tsx`. A cuenta-de-cobro carries an 8-digit redemption code that is redeemed atomically inside `paymentService.initiateCheckout` (pre-paid corporate flow).
**Fix:** Add a "Sales Management" capability (corporate quotes + cuentas de cobro with consecutive numbering, PDF generation, redemption-code prepayment, pricing-drift safeguard) to §2.2, and reference it in §9 (Corporate) and §13 (Pricing — "or pre-paid via cuenta de cobro").

### §7 / §13 — MISSING: Payment reconcilers and payment-attempt telemetry
**What's wrong:** PRD §13 describes checkout + IPN webhooks but omits the dual stale-payment reconcilers and the client-side telemetry. Real code in `backend/src/services/paymentService.ts`: `reconcileStalePayment`/`findStalePayments` (Polar, `paymentReconcileJob.ts`) and `reconcileStaleMpPayment`/`findStaleMpPayments` (MP, `mpPaymentReconcileJob.ts`), plus `markPaymentCompleted` as the single completion path for all four callers (ADR-065 parity). Client telemetry: `recordClientEvent` + `frontend-next/src/lib/api/paymentAttemptEvent.ts` (REDIRECT_INITIATED / USER_CANCELLED / CLIENT_ERROR beacons, ADR-066).
**Fix:** In §13 add a "Reliability" note: stale-payment reconciler jobs for both gateways + browser payment-attempt telemetry (sendBeacon), and that completion is idempotent via `PaymentEvent` unique index.

### §2.2 #13 / §12 — MISSING: Analytics DLQ + CAPI retry queue detail
**What's wrong:** §2.2 item 13 mentions "GA4 + Meta CAPI (with retry queue)" but the PRD never names the dead-letter queue / failed-events infrastructure or the `capiRetryJob`. Real: `backend/src/jobs/capiRetryJob.ts`, `FailedEvent` DLQ table (migration `20260421_refactor_dlq_and_ga4_mp`, `20260421_add_capi_dedup_and_failed_events`), `analyticsHealth.ts` route + `/admin/analytics-health` page + `AnalyticsHealthContent.tsx`.
**Fix:** Mention the analytics DLQ / `capiRetryJob` and the `/admin/analytics-health` dashboard under §2.2/§12 admin tooling.

### §10 Internationalization — MISSING: locale resolution architecture
**What's wrong:** §10 documents the locale URL patterns but not the resolution authority. Per ADR-064, `frontend-next/src/proxy.ts` is the sole locale authority (next-intl in URL-prefix-only mode); it also filters the `Link:` hreflang header for single-locale regional pages. Also missing: `User.locale` preference + `LocalePreferenceModal`/`LocalePreferenceGate`, and `Organization.invitationLocale` governing the first corporate email (ADR-062).
**Fix:** Add a short "Locale resolution" note to §10 citing `proxy.ts` as the authority, the `NEXT_LOCALE` cookie handoff, and `User.locale` / `Organization.invitationLocale`.

### §6.2 Auto-scaling multipliers — INCORRECT (phase naming)
**What's wrong:** The multiplier table lists "Round of 16" as the first knockout phase. The live tournaments use a **Round of 32** as the first knockout phase (WC2026 48-team format; advancement code references `round_of_32→round_of_16→…→finals`, see `poolAdminService.advancePhase` / `resultService` phase chains). The table omits Round of 32 entirely.
**Fix:** Either generalize the table (note multipliers are per-phase and configurable, not a fixed list) or insert Round of 32 and align with the actual phase order. Verify exact multiplier values against `pickPresets.ts` knockout `mult` values before publishing — the doc's specific 1.5/2.0/2.5/3.0 figures were not confirmed against code.

### §9.1 Activation — OK (minor naming note)
**What's wrong:** Nothing incorrect. PRD §9.1 step 6 correctly uses `/activar-cuenta?token=xxx` (matches `frontend-next/src/i18n/routing.ts` and `backend/src/lib/activationUrl.ts`: es `/activar-cuenta`, en `/en/activate-account`, pt `/pt/ativar-conta`). Note this differs from the older MEMORY.md mention of `/activar` — the PRD is the accurate one. Token length confirmed: `CRYPTO_BYTES.TOKEN = 32` bytes → 64 hex chars (PRD's "32-byte / 64-char hex" is correct), 30-day expiry confirmed.
**Fix:** None. Optionally mention the activation URL is locale-aware (`buildActivationUrl`) and that the welcome email is deferred to LocalePreferenceModal close / 24h fallback (ADR-063).

### §5.3 Invite System / §5.4 Member Management — OK
**What's wrong:** Nothing. 12-char hex confirmed (`CRYPTO_BYTES.POOL_INVITE_CODE = 6` bytes → 12 hex). `PoolMemberStatus` enum (`PENDING_APPROVAL`, `ACTIVE`, `LEFT`, `BANNED`) matches `schema.prisma:363`; the PRD's explicit "no SUSPENDED state" caveat is correct (SUSPENDED in schema belongs to the Organization status enum, not pool members).
**Fix:** None.

### §13 Pricing — OK
**What's wrong:** Nothing. Confirmed in `backend/src/lib/pricing.ts`: USD base $7.99/block, −$0.40 every 2 blocks, min $4.99; COP base $28,500, −$1,500, min $18,000; corporate base $49.99 USD / $200,000 COP for 100; free limits 20 (personal) / 2 (corporate). Mercado Pago/Polar routing and no Wompi residue — correct.
**Fix:** None.

### §7.1 Results — OK (verify grace-period constant)
**What's wrong:** Source hierarchy `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL` matches the 5-value `ResultSource` enum (`schema.prisma:284`). Deadline reminder window of 48h confirmed (`deadlineReminderService.ts:62` `DEADLINE_REMINDER_HOURS_BEFORE` default 48). The "5-minute grace via `SCORES_GRACE_PERIOD_MS`" claim was not byte-verified against `constants.ts`.
**Fix:** Confirm the grace-period env var name/default against `backend/src/lib/constants.ts` (`SCORES` block) before relying on it; otherwise OK.
