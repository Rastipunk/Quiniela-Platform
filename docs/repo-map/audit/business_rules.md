## Audit: docs/BUSINESS_RULES.md

**Overall verdict: KEEP (minor fixes).** Severity: minor.

This document (v1.0.0, 2026-05-04, 1353 lines) is the most accurate doc in the
set. It was clearly authored alongside the same audit cycle that shipped the
late features it describes (ADR-061 sales, ADR-062 corporate locale, ADR-063
welcome handoff, ADR-064 locale resolution, ADR-065 payment parity, ADR-066
payment-attempt telemetry). Spot-checks against the real code confirmed:

- `ResultSource` enum (schema.prisma:284) = `HOST_MANUAL | HOST_PROVISIONAL | API_CONFIRMED | HOST_OVERRIDE | SCRAPER_PROVISIONAL` — matches §5.2 exactly.
- `CorporateInviteStatus` (schema.prisma:1188) = `PENDING | SENT | ACTIVATED | FAILED` — matches §8.3.
- `PoolMemberStatus` (schema.prisma:363) includes `PENDING_APPROVAL` — matches §7.5.
- `MatchSyncStatus` (schema.prisma:980) = `PENDING/IN_PROGRESS/AWAITING_FINISH/COMPLETED/SKIPPED` — matches §10.1.
- `PAYMENT_EVENT_SOURCE` (lib/paymentEvents.ts:23) includes `MP_SYNC`, `RECONCILER`, `POLAR_WEBHOOK` — matches §18.1.
- Reconciler advisory locks: `paymentReconcileJob`=82636503, `mpPaymentReconcileJob`=82636506, `accountReceivableExpiryJob`=82636504 — matches §18.5 and §14.4.
- `RESERVED_USERNAMES` (constants.ts:159) = admin/root/system/quiniela/api/www — matches §2.1.
- Corporate capacity gate: `corporateService.ts:355` caps `maxParticipants` at `CORPORATE_FREE_LIMIT` via `Math.min` — matches §8.2 verbatim.
- No Wompi / Lemon Squeezy references anywhere in the doc (clean; dual-gateway Polar + Mercado Pago is correctly documented in §8.2 and §18).

### Finding 1 — §2.6 Rate Limiting: limiter symbol names are wrong for two entries
- Type: incorrect
- The table names `poolCreateLimiter` and `corporateInquiryLimiter`. The real code defines these inline in route files under different identifiers:
  - `backend/src/routes/pools.ts:42` declares `poolCreationLimiter` (not `poolCreateLimiter`).
  - `backend/src/routes/corporate.ts:66` declares `inquiryLimiter` (not `corporateInquiryLimiter`).
  Their limits (10/hour pool create, 5/15min inquiry) are correct; only the symbol names drift. `resultPublishLimiter` (10/min, results.ts:57) and `feedbackLimiter` (5/min, feedback.ts:14) names DO match.
- Fix: rename the two table rows to `poolCreationLimiter` and `inquiryLimiter`, or drop the symbol-name column and keep only the scope/limit description.

### Finding 2 — §2.6 Rate Limiting: `poolJoinLimiter` is missing from the table
- Type: missing
- `rateLimit.ts:51` defines `poolJoinLimiter` (default 10 req / 15 min per IP, env `RATE_LIMIT_POOL_JOIN_*`, error `TOO_MANY_JOIN_ATTEMPTS`) and it guards `POST /pools/join`. The §2.6 table lists every other limiter but omits this one.
- Fix: add a row: `poolJoinLimiter | POST /pools/join | 10 req | 15 min`.

### Finding 3 — §18 cross-reference: schema comment uses a different constant name (informational, not a doc error)
- Type: ok
- §18 correctly references `PAYMENT_EVENT_SOURCE` (the real export in `lib/paymentEvents.ts:23`). Note that the Prisma schema's own comment on `PaymentEvent.source` (schema.prisma:1353) instead says "EVENT_SOURCES (backend/src/lib/paymentEventSources.ts)", which is the stale reference. The BUSINESS_RULES doc is the correct one here — flag the schema comment, not this doc.

### Sections verified accurate (no action)
- §3 Pool lifecycle, §3.4 join/capacity-threshold flow (`checkAndNotifyCapacityThresholds`, `sendBlockedJoinAttemptEmail`), §3.5 invite-code generator/validator asymmetry.
- §5 result rules, source hierarchy, scraper-first enforcement, version immutability.
- §6 scoring (legacy presets + advanced `scoringAdvanced.ts` cumulative/legacy modes).
- §8 corporate (inquiry, creation transaction, activation, SESSION_MISMATCH defence, invite lifecycle, per-host send limits).
- §10 SmartSync state machine, polling/backoff, PendingPhaseSync.
- §11 data-integrity invariants.
- §12 referral graph, §13 consent mode, §14 sales (Quote/AccountReceivable, pricing drift guard, redemption lock, soft-revoke, trilingual PDFs), §15 corporate invitation locale, §16 welcome-email handoff, §17 locale resolution, §18 payment completion/reconciliation, §19 payment-attempt telemetry — all consistent with the shipped ADR-061..066 implementation.
