## Audit: CLAUDE.md

**Verdict:** keep / minor-update — The doc is a standards + invariants charter, not an API/data reference, and it is remarkably current (dated 2026-05-03, immediately before the v1.0.0 tag). All the hard, falsifiable claims I spot-checked against source hold: dual-gateway payments (Polar + Mercado Pago, Wompi gone), `markPaymentCompleted` single-entry rule (invariant 13), sales soft-revoke + `lib/pricing.ts` server-derived pricing (invariant 9), corporate `invitationLocale` first-email-only rule (invariant 10), deferred welcome email via `POST /users/me/locale-preference` (invariant 11), and the next-intl `localeCookie:false` + `localeDetection:false` locale-resolution architecture (invariant 12). JWT `expiresIn: "4h"` matches `lib/jwt.ts`. The only real defects are in the **Section 5 "Key File Locations" Jobs and Admin-routes inventories**, which predate four shipped jobs and one route file and still list one job that is no longer a boot-time cron.

---

### Finding 1 — Section 5 (Backend → Jobs): incomplete jobs list
**Type:** missing / incorrect

The `Jobs` row lists: `liveScoresJob, smartSyncJob, resultSyncJob, phaseSyncJob, deadlineReminderJob, fixtureTrackingJob, fixtureVerificationJob, newMemberDigestJob, capiRetryJob, trackStatusCheckerJob`.

Real `server.ts` boot wiring (lines 24-42) starts these crons that the doc does NOT mention:
- `paymentReconcileJob` (`startPaymentReconcileJob`) — Polar reconciler, advisory lock `82636503n` (the doc's own invariant 13 references it!).
- `mpPaymentReconcileJob` (`startMpPaymentReconcileJob`) — MP reconciler, advisory lock `82636506n` (also named in invariant 13).
- `accountReceivableExpiryJob` (`startAccountReceivableExpiryJob`) — sales CC expiry sweep (advisory lock `82636504`).
- `welcomeEmailFallbackJob` (`startWelcomeEmailFallbackJob`) — 24h welcome-email safety net (advisory lock `82636505`; this is the fallback named in invariant 11).

So the file references all four of these jobs by behavior in Section 6 invariants but omits them from the Section 5 file inventory.

**Fix:** Add `paymentReconcileJob.ts`, `mpPaymentReconcileJob.ts`, `accountReceivableExpiryJob.ts`, and `welcomeEmailFallbackJob.ts` to the Jobs row.

---

### Finding 2 — Section 5 (Backend → Jobs): `resultSyncJob` is not a boot cron
**Type:** incorrect (minor)

`resultSyncJob.ts` is listed alongside the cron jobs, but `server.ts` does not import or start it (no `startResultSyncJob`). It is only referenced from `services/adminInstanceService.ts` (manual/admin-triggered sync), unlike the other entries in this row which are all `start*Job()` crons launched at boot.

**Fix:** Either drop `resultSyncJob` from the cron list or annotate it as admin-triggered (not a scheduled cron), so the list cleanly reflects what runs on startup.

---

### Finding 3 — Section 5 (Backend → Admin routes): `adminSales.ts` omitted
**Type:** missing (minor)

The Admin-routes row lists `admin.ts, adminAnalyticsDashboard.ts, adminInstances.ts, adminTemplates.ts, adminCorporate.ts, adminSettings.ts` but not `routes/adminSales.ts`, which backs the Quote + Cuenta-de-Cobro sales stack that the doc treats as a first-class subsystem in invariant 9. (`salesRedemption.ts` is the public-facing redemption route and is also unlisted, though that one is arguably non-admin.)

**Fix:** Add `adminSales.ts` to the Admin routes list. Optionally note `routes/salesRedemption.ts` under a payments/sales row.

---

### Finding 4 — Section 5 minor inventory gaps (optional)
**Type:** missing (cosmetic)

A few shipped pieces tied to invariants are not surfaced in Section 5, though Section 6 covers them behaviorally: `lib/activationUrl.ts` (invariant 11 locale-correct activation links), `services/sales/*` (quoteService / accountReceivableService / documentCounterService — invariant 9), and the payment-attempt telemetry client `frontend-next/src/lib/api/paymentAttemptEvent.ts` (MP Brick lifecycle beacons, ADR-066). These are "nice to list" but not contradictions.

**Fix:** Optionally add an Sales/Payments services line and `lib/activationUrl.ts`. Low priority — Section 5 is explicitly a "key" (not exhaustive) inventory.

---

### Sections verified accurate (no action)
- **Section 1 (Product Identity / Roles):** `PlatformRole` (PLAYER/HOST/ADMIN) and `PoolMemberRole` (PLAYER/HOST/CO_ADMIN/CORPORATE_HOST) match `schema.prisma` enums.
- **Section 2 Payments & webhooks (ADR-046):** `PaymentEvent.polarEventId` idempotency, 5xx-on-error, MP drift (`MP_WEBHOOK_MAX_DRIFT_MS`), `mp-{paymentId}-{status}` eventId, `amountUsd` cents vs `amountCop` pesos / `mpPurchaseValue` — all consistent with the payments subsystem (part-02/part-10).
- **Section 2 Activation tokens / Results system:** single-use `updateMany` claim, `SESSION_MISMATCH` 409, resend token rotation, scraper-first source hierarchy, grace period — consistent with corporate + liveScores subsystems.
- **Section 4 Tech Stack:** Next.js 16 / React 19 / Express 5 / Prisma 6.19+ / next-intl v4 / Resend / MP SDK 2.12 / Polar — matches package manifests and the map.
- **Section 6 invariants 9-13:** sales soft-revoke, corporate invitation locale, deferred welcome email (`POST /users/me/locale-preference` confirmed in `routes/userProfile.ts:116`, mounted at `/users`), URL-prefix-first locale resolution (`i18n/routing.ts` `localeCookie:false` + `localeDetection:false`, `proxy.ts` authority), and `markPaymentCompleted` single-entry rule with both reconciler advisory-lock keys — all confirmed against source.
- **Section 3 Documentation Structure:** the listed `docs/` tree (incl. `guides/ANALYTICS_PIPELINE.md`, `ATTRIBUTION_TAXONOMY.md`, `PREDICTION_UPDATES.md`) matches the repo's doc layout.
