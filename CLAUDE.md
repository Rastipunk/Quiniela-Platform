# CLAUDE.md — Picks4All Development Standards

> **Last updated:** 2026-05-03
>
> This file defines the mandatory standards, principles, and constraints for ALL work in this repository. Every change — code, documentation, infrastructure — must comply with these rules.

---

## 1) Product Identity

**Picks4All** — Multi-tournament sports prediction platform (football only, for now).

- **Domain:** picks4all.com (frontend), api.picks4all.com (backend)
- **Locales:** ES (default, no prefix), EN (`/en/`), PT (`/pt/`) via next-intl v4
- **Branding:** Defined in `frontend-next/src/lib/brand.ts` and `backend/src/lib/brand.ts` — single source of truth for colors, gradients, name, domain
- **Hosting:** Railway (frontend + backend + PostgreSQL)

### User Roles

**Platform roles** (`PlatformRole` enum):

| Role | Description |
|------|-------------|
| **PLAYER** | Default. Standard user. |
| **HOST** | Reserved (currently equivalent to PLAYER at the platform level; pool-level HOST is set via `PoolMemberRole`). |
| **ADMIN** | Platform administrator. Manages templates, instances, platform settings, analytics dashboard. |

**Pool roles** (`PoolMemberRole` enum, scoped per pool):

| Role | Description |
|------|-------------|
| **PLAYER** | Joins pools, makes picks, views leaderboard. |
| **HOST** | Creates/manages pools, invites players, can override results (with justification + notification). |
| **CO_ADMIN** | Same as HOST except cannot delete pool or nominate other co-admins. |
| **CORPORATE_HOST** | HOST for corporate pools created via the enterprise flow. |

---

## 2) Mandatory Quality Standards

### These rules are NON-NEGOTIABLE. Every change must comply.

### Code Quality
- **Zero hardcoded values.** All configuration comes from environment variables, centralized constants (`lib/constants.ts`, `lib/brand.ts`, `lib/siteConfig.ts`), or the database. Static mappings (like flag URLs) are acceptable ONLY as fallbacks — the primary source must always be dynamic data from the API.
- **Zero magic numbers.** Every numeric literal in business logic must be a named constant with a comment explaining its purpose.
- **Zero duplicated logic.** If the same pattern appears twice, extract it to a shared utility, hook, or service.
- **Strict TypeScript.** No `any` types except at system boundaries (external API responses). Always narrow `unknown` before use.
- **Zod validation** on every API endpoint input. Never trust client data.
- **Audit trail** for every sensitive operation (result publish, member ban, pool delete, errata).

### Architecture
- **Backend:** Routes validate input → Services contain business logic → Libraries provide utilities. Business logic NEVER lives in route handlers.
- **Frontend:** Components render UI → Hooks manage state/effects → Lib provides utilities. Business logic NEVER lives in components.
- **Single source of truth.** Every piece of data lives in ONE place. If it's in the database, don't also hardcode it in the frontend.
- **Separation of concerns.** Each file has ONE responsibility. Components >500 lines must be split. Services >800 lines must be decomposed.

### Responsive / Mobile-First
- **Mobile is the primary viewport.** Every component, page, and layout MUST render correctly on 360px–430px screens. No horizontal scroll, no overflowing elements, no truncated content.
- **Test on mobile widths first** before verifying desktop. Use `useIsMobile()` hook for breakpoint-aware layout.
- **Never use `100vw`** for widths — it includes scrollbar and causes horizontal overflow on mobile. Use `100%` or explicit `max-width` instead.
- **All interactive elements** must meet minimum touch targets (`TOUCH_TARGET.minimum` = 44px).
- **`overflow-x: hidden`** is set globally on `html, body`. Individual components must not produce content wider than the viewport.

### Internationalization (i18n)
- **Every user-facing string** must use `t()` from next-intl. No hardcoded text in TSX components.
- **All three locales** (ES/EN/PT) must have complete translations. Never add a key to one locale without adding it to all three.
- **Dates and numbers** must respect the user's locale and timezone.

### SEO
- **Every public page** must have: metadata (title, description), canonical URL, Open Graph tags, JSON-LD structured data, and hreflang alternates.
- **All URLs** derive from `SITE_URL` in `lib/siteConfig.ts`, never hardcoded.
- **Sitemap and robots.txt** must be kept current with all public routes.

### Security
- **Never expose** stack traces, internal errors, or database details to clients.
- **Rate limiting** on all public and auth endpoints (configurable via env vars).
- **Input sanitization** for any user content rendered as HTML (use `escapeHtml` from `lib/htmlSafe.ts`). Email templates escape host/user-controlled values at render time, not at persistence — see ADR-047.
- **CORS** restricted to configured origins via `SITE_DOMAIN` env var.

### Payments & webhooks (ADR-046)
- **Webhook handlers are idempotent at `PaymentEvent.polarEventId` UNIQUE.** The slot is claimed INSIDE the same transaction as the `PoolPayment.update` + `Pool.update` so a tx failure rolls back atomically and the gateway's retry can re-process.
- **Webhooks return 5xx on processing errors**, not 200. Polar / Mercado Pago retry with exponential backoff. The signature-error path stays 401.
- **MP webhook drift validation** rejects webhooks with timestamps outside `MP_WEBHOOK_MAX_DRIFT_MS` (default 5 min).
- **MP eventId includes status** (`mp-{paymentId}-{status}`) so `pending → in_process → approved` transitions don't dedupe each other.
- **`amountUsd` is USD CENTS; `amountCop` is COP PESOS.** Reading the wrong field for the wrong currency context underreports revenue ~40× and breaks customer receipts. Always go through `mpPurchaseValue(payment)` for the COP value.

### Activation tokens (corporate)
- **Single-use:** `activate-corporate` atomically claims the invite (`updateMany WHERE status IN (PENDING, SENT, FAILED)`). Concurrent activations of the same token surface as `ALREADY_ACTIVATED`.
- **Magic-link session-mismatch defence:** if the request carries a cookie for a user whose email differs from `invite.email`, the endpoint refuses with `SESSION_MISMATCH` (409) without setting cookies — see ADR-048.
- **Resend rotates the token:** `POST /corporate/pools/:poolId/employees/:inviteId/resend` invalidates the previous token and resets the 30-day expiry — old emails forwarded after a resend become useless.

### Results System
- **Results are scraper-first.** In AUTO mode, picks4all-scores is the primary source. API-Football is fallback only (activates 30min after estimated FT if scraper hasn't reported).
- **Source hierarchy:** HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL. Higher sources are never overwritten by lower ones.
- **Scraper contract is v2 (ADR-068):** monotonic state machine (terminal `FT`/`AET`/`PEN`/`ABD` are final), per-match `timeline[]`, fail-closed auth. The `fulltime`/`extratime` fields are always `null` — **minute-90 score is derived from `timeline[]`** (`deriveNinetyMinuteScore`, the `ET` milestone). Penalties never count toward goals90.
- **Confirmation gate:** finalization to `API_CONFIRMED` requires ≥`SCORES_MIN_CONFIRMATIONS` (default 3) sources on the terminal milestone.
- **Grace period:** 5 minutes after FT before finalizing a result (configurable via `SCORES_GRACE_PERIOD_MS`).
- **Stale safety net:** matches not finalized >`SCORES_STALE_THRESHOLD_MS` (210min) after kickoff, and authoritative-but-undecidable knockouts, trigger a one-time admin alert — never fail silent.
- **Host can override** an existing result only with: mandatory reason, warning shown, and email notification sent to ALL pool members.
- **Legacy MANUAL mode** instances are exempt (backwards compatibility).

---

## 3) Documentation Structure

```
docs/
├── PRD.md                    # Product definition and scope
├── ARCHITECTURE.md           # Technical architecture and stack
├── DATA_MODEL.md             # Database schema (mirrors Prisma)
├── API_SPEC.md               # REST API contracts
├── BUSINESS_RULES.md         # Business rules and invariants
├── GLOSSARY.md               # Domain terminology
├── DECISION_LOG.md           # Architectural Decision Records
└── guides/
    ├── SETUP.md                # Local development setup
    ├── DEPLOYMENT.md           # Railway deployment and env vars
    ├── EMAIL_SYSTEM.md         # Email notification system
    ├── TOURNAMENT_SYSTEM.md    # Tournaments, phases, advancement, sync
    ├── SCORES_INTEGRATION.md   # picks4all-scores live scoring system
    ├── PREDICTION_UPDATES.md   # AI prediction update and subscriber notification process
    ├── GOOGLE_OAUTH.md         # Google OAuth configuration
    ├── ATTRIBUTION_TAXONOMY.md # UTM / event / user-property canonical taxonomy
    └── ANALYTICS_PIPELINE.md   # GA4 MP + Meta CAPI server-side pipeline (retry, DLQ, advisory lock)
CLAUDE.md                     # This file — development standards
TECH_DEBT.md                  # Known tech-debt items deferred to post-mundial
README.md                     # Repository entry point
CHANGELOG.md                  # Version history (Keep a Changelog format)
```

### Documentation Rules
- **Docs reflect the current state of the code.** No "planned features", no "to-do" sections, no history of changes.
- **If code and docs disagree → alert the user.** Never silently assume either is correct.
- **Every architectural decision** gets recorded in `DECISION_LOG.md` as an ADR.
- **Update docs in the same commit** as the code change, not in a separate pass.

---

## 4) Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router, standalone) | 16 |
| UI | React + TypeScript + CSS custom properties | 19 |
| i18n | next-intl | v4 |
| Backend | Express + TypeScript | 5 |
| ORM | Prisma | 6.19+ |
| Database | PostgreSQL (Railway managed) | 16 |
| Auth | JWT (4h) + Google Sign-In | — |
| Email | Resend | — |
| Payments (CO) | Mercado Pago (Payment Brick + webhooks) | SDK 2.12 |
| Payments (Intl) | Polar.sh | — |
| Sports Data | picks4all-scores (primary), API-Football (fallback) | — |
| Analytics | Google Analytics 4 + Google Tag Manager | — |
| Hosting | Railway (2 services + Postgres) | — |
| DNS | Cloudflare (+ Email Routing) | — |

---

## 5) Key File Locations

### Backend (`backend/src/`)
| Category | Files |
|----------|-------|
| Entry point | `server.ts` |
| Database | `db.ts`, `prisma/schema.prisma` |
| Auth | `lib/jwt.ts`, `lib/password.ts`, `lib/passwordRules.ts`, `lib/authCookies.ts`, `middleware/requireAuth.ts`, `middleware/requireAdmin.ts` |
| Roles & audit | `lib/roles.ts`, `lib/audit.ts` |
| Branding | `lib/brand.ts` |
| Constants | `lib/constants.ts` (time, pagination, sync, locales, user rules) |
| Shared schemas | `lib/schemas.ts` (Zod field schemas for reuse) |
| Email | `lib/email.ts`, `lib/emailTemplates.ts`, `lib/htmlSafe.ts` |
| Scoring | `lib/scoringAdvanced.ts`, `lib/pickPresets.ts`, `lib/scoringBreakdown.ts` |
| Pool capacity | `lib/poolCapacity.ts` |
| Server analytics | `lib/ga4.ts`, `lib/metaCapi.ts` |
| API-Football | `services/apiFootball/client.ts` (fallback only) |
| picks4all-scores | `services/scoresService/client.ts` (primary live scores) |
| Smart Sync | `services/smartSync/service.ts` (API-Football fallback) |
| Payments | `services/mercadopago/`, `services/polar/`, `services/paymentService.ts` |
| Pricing | `lib/pricing.ts` (USD + COP dynamic pricing with volume discounts) |
| Result publishing | `services/resultService.ts`, `services/resultSync/`, `services/advancementTrigger.ts` |
| Admin routes | `routes/admin.ts`, `routes/adminAnalyticsDashboard.ts`, `routes/adminInstances.ts`, `routes/adminTemplates.ts`, `routes/adminCorporate.ts`, `routes/adminSettings.ts`, `routes/adminSales.ts` |
| Sales | `routes/adminSales.ts` (quotes + cuentas de cobro), `routes/salesRedemption.ts` (public CC redemption), `services/sales/quoteService.ts`, `services/sales/accountReceivableService.ts`, `services/sales/documentCounterService.ts` |
| Activation links | `lib/activationUrl.ts` (locale-correct activation/welcome URLs) |
| Boot crons (started in `server.ts`) | `jobs/liveScoresJob.ts`, `jobs/smartSyncJob.ts`, `jobs/phaseSyncJob.ts`, `jobs/deadlineReminderJob.ts`, `jobs/fixtureTrackingJob.ts`, `jobs/fixtureVerificationJob.ts`, `jobs/newMemberDigestJob.ts`, `jobs/capiRetryJob.ts`, `jobs/trackStatusCheckerJob.ts`, `jobs/paymentReconcileJob.ts` (Polar reconciler), `jobs/mpPaymentReconcileJob.ts` (MP reconciler), `jobs/accountReceivableExpiryJob.ts` (sales CC expiry sweep), `jobs/welcomeEmailFallbackJob.ts` (24h welcome-email safety net) |
| Admin-triggered sync | `jobs/resultSyncJob.ts` (not a boot cron; invoked via `services/adminInstanceService.ts`) |

### Frontend (`frontend-next/src/`)
| Category | Files |
|----------|-------|
| Theme | `lib/theme.ts` (derives from `lib/brand.ts`) |
| Site config | `lib/siteConfig.ts` (SITE_URL, SITE_NAME, EMAIL_DOMAIN) |
| Branding | `lib/brand.ts` |
| Validation | `lib/validation.ts` (centralized form constraints) |
| API client | `lib/api/client.ts` |
| Payments API | `lib/api/payments.ts` (checkout, MP process, country detection) |
| Payment telemetry | `lib/api/paymentAttemptEvent.ts` (MP Brick lifecycle beacons via sendBeacon — ADR-066) |
| Pricing | `lib/pricing.ts` (COP + USD tiers, dynamic computation) |
| Analytics | `lib/analytics.ts` (trackEvent via GTM dataLayer) |
| i18n | `i18n/routing.ts`, `messages/{es,en,pt}/*.json` |
| Shared UI | `components/ui/ToggleSwitch.tsx`, `components/CookieConsent.tsx` |
| Pool page | `app/[locale]/(authenticated)/pools/[poolId]/page.tsx` |
| Pool wizard | `components/pool-wizard/PoolCreationWizard.tsx` (standard + corporate) |

---

## 6) Critical Invariants (NEVER break)

1. **Deadline enforcement:** User cannot edit picks if `isLocked=true` (kickoff - deadline minutes reached).
2. **Result versioning:** Every result change creates a new version. Corrections require `reason`. All versions are immutable.
3. **Pool rules immutability:** Scoring configuration cannot change while the pool has ACTIVE members other than HOST/CORPORATE_HOST. The host edits rules via the "Administrar reglas" panel in DRAFT state (canEditScoringConfig). When the last PLAYER/CO_ADMIN is removed (kick / ban / voluntary leave) the pool auto-reverts ACTIVE → DRAFT, all player predictions are deleted, but PoolMatchResults and overrides are preserved (revertPoolToDraft). Kick/ban require explicit confirmation (409 REVERT_PENDING_CONFIRMATION) before triggering the revert. See ADR-049.
4. **Leave pool:** Only PLAYER can leave (not HOST/CORPORATE_HOST). Status → LEFT, points preserved, read-only mode.
5. **Template immutability:** Published TournamentTemplateVersions are frozen snapshots.
6. **Pool independence:** Each pool has its own `fixtureSnapshot`. Advancing phases in one pool does not affect others.
7. **Scraper-first results:** In AUTO mode, picks4all-scores is the primary source (15s polling during matches). API-Football is fallback only (30min after estimated FT). Host can only override existing results.
8. **Estratega is fully automatic:** In SIMPLE preset pools, `autoPublishStructuralResults` derives `GroupStandingsResult` (FIFA tiebreakers) and `StructuralPhaseResult.matches[].winnerId` (penalty fallback) directly from scraper-confirmed `PoolMatchResult` data. Host never publishes manually — only overrides existing publications via the dedicated PUT endpoints (mandatory reason + email-everyone). See ADR-059.
9. **Sales documents are soft-revoke only:** Never `DELETE FROM Quote` or `DELETE FROM AccountReceivable`. Cancellation sets `status='CANCELLED'`; the consecutive number is preserved so the series shows no gaps. Pricing is **always** server-derived via `lib/pricing.ts`; admin cannot override the amount. CC redemption uses the atomic lock `tx.accountReceivable.updateMany WHERE status='PENDING'` inside the same tx as `PoolPayment.create` — drift between the CC snapshot and live `pricing.ts` blocks the redemption with `409 CONFLICT` + `cc_pricing_drift` admin alert. See ADR-061.
10. **Corporate invitation locale only governs the first email:** `Organization.invitationLocale` (NOT NULL, DEFAULT `'es'`) drives `sendCorporateActivationEmail` exclusively. Once the employee completes `LocalePreferenceModal` on first login, `User.locale` takes over for every downstream email. Never wire `Organization.invitationLocale` into reminders, results, or any other employee-targeted email — that's `User.locale`'s job. Read at send time (last-writer-wins). See ADR-062.
11. **Welcome email is deferred:** `sendWelcomeEmail` is NEVER called inline from signup or activation handlers. The single trigger surface is `POST /users/me/locale-preference` (happy path) + `welcomeEmailFallbackJob` (24h safety net). `User.welcomeEmailSentAt` is the idempotency key — set inside the same tx that flips `localePromptCompletedAt`. Activation URLs built via `lib/activationUrl.ts` so the email's link points to the locale-correct page (`/activar-cuenta` / `/en/activate-account` / `/pt/ativar-conta`). See ADR-063.
12. **Locale resolution is URL-prefix-first, then cookie, then Accept-Language, then default.** `next-intl` is configured with `localeDetection: false` AND `localeCookie: false` — it only consults URL prefix and `defaultLocale`. All other signals flow through `frontend-next/src/proxy.ts`. Backend `setAuthCookies` writes `NEXT_LOCALE` when `User.locale` is known (login, google, activate-corporate); `clearAuthCookies` clears it on logout. `POST /users/me/locale-preference` writes the cookie server-side as defensive backup for the client-side write. Never re-enable next-intl's auto-detection without removing the manual logic in `proxy.ts` first. See ADR-064.
13. **Payment completion runs through `markPaymentCompleted`.** Any code path that needs to mark a `PoolPayment` as `COMPLETED` (Polar webhook, MP sync, MP IPN, either reconciler) MUST call `paymentService.markPaymentCompleted` — never update `poolPayment.status = "COMPLETED"` directly. The function owns the atomic tx (PaymentEvent + PoolPayment + Pool + AccountReceivable + AuditEvent) and the post-tx fan-out (admin notification, CAPI Purchase, GA4 purchase, receipt email). The entry guard makes it fully idempotent. MP sync + IPN share the idempotency key `mp-{id}-approved`; the `source` enum (`POLAR_WEBHOOK` / `MP_SYNC` / `MP_WEBHOOK` / `RECONCILER`) records who claimed it. Polar has `paymentReconcileJob` (advisory lock `82636503n`); MP has `mpPaymentReconcileJob` (advisory lock `82636506n`); both can run concurrently. The MP reconciler auto-completes via the shared function on `approved`; the Polar reconciler flags for human review (intentional asymmetry). See ADR-065.
14. **Scraper scoring derives from `timeline[]`, never from `fulltime`/`extratime` (always `null`).** The minute-90 / end-of-regulation score comes from `deriveNinetyMinuteScore` (the `ET` milestone of the scores-service `timeline[]`); penalties (`penaltyHome/Away`) are separate and NEVER count toward goals90. Finalization requires ≥`SCORES_MIN_CONFIRMATIONS` (default 3) sources on the terminal milestone (`FT`/`AET`/`PEN`/`ABD`). Because the scraper never closes by time, two safety nets MUST stay wired: the stale detector (`staleDetector.ts`, >`SCORES_STALE_THRESHOLD_MS`/210min → one-time admin alert, idempotent via `MATCH_STALE_DETECTED` audit) and the undecidable-knockout alert (`structuralAutoPublish.ts`, `KNOCKOUT_WINNER_UNDECIDABLE`). Never reintroduce a code path that finalizes or scores a match silently when data is missing. See ADR-068.

---

## 7) Workflow Protocol

### Before writing ANY code:
1. **Read relevant docs** in `/docs/` to understand current state.
2. **Propose a plan** (3-7 bullets) and wait for user approval.
3. **Never assume** — if unclear, ask. Better to ask 5 questions than make 1 wrong assumption.

### While writing code:
4. **Test against production** when possible (via Railway CLI or production DB queries). Never say "it should work" — verify.
5. **Track progress** with the TodoWrite tool for multi-step tasks.
6. **Commit atomically** — each commit should compile and deploy independently.

### After writing code:
7. **Verify in production** that the change works (API call, DB query, or user confirmation).
8. **Update documentation** in the same session if any docs are affected.
9. **Configure env vars** in Railway if new ones were introduced.

---

## 8) Environment Variables

All configurable values are documented in `docs/guides/DEPLOYMENT.md`. Key categories:

- **SITE_DOMAIN, FRONTEND_URL** — Domain configuration
- **JWT_SECRET** — Auth signing key
- **RESEND_API_KEY, RESEND_FROM_EMAIL** — Email service
- **API_FOOTBALL_KEY** — Sports data
- **MP_ACCESS_TOKEN, MP_PUBLIC_KEY** — Mercado Pago (Colombia/COP payments)
- **MP_WEBHOOK_SECRET** — Mercado Pago webhook signature verification
- **POLAR_API_KEY, POLAR_WEBHOOK_SECRET** — Polar.sh (International/USD payments)
- **SCORES_SERVICE_URL, SCORES_SERVICE_API_KEY** — picks4all-scores live scoring
- **RATE_LIMIT_*_MAX** — Rate limiting thresholds
- **MATCH_SYNC_*_MIN** — Match sync timing
- **NEXT_PUBLIC_*** — Frontend-exposed config (pricing, domain, etc.)
- **BRAND_COLORS_JSON** — Runtime brand override (backend only)

---

## 9) Communication

- **Language:** Communicate with the user in Spanish. Write code, comments, and documentation in English.
- **Be direct.** Lead with the answer, not the reasoning.
- **Admit mistakes immediately.** Never defend a wrong approach.
- **Verify, don't assume.** "The database shows X" is better than "X should be there".
