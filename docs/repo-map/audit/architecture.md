## Audit: docs/ARCHITECTURE.md

**Verdict: UPDATE (minor-to-major).** The document is broadly accurate and clearly post-dates the dual-gateway / analytics-DLQ / locale-resolution work (those subsystems are present and correctly described at a high level). However, several hard numbers are stale or wrong (cron job count, model count, route count, service count, bcrypt rounds), the entire **Sales / Cuenta de Cobro (CC)** subsystem is missing, two reconciler jobs and three jobs are unlisted, the frontend `lib/api/*` module names are partly fictional, and §9.5 cites payment endpoint paths that do not exist. Fix the counts and the Sales gap and this doc is solid.

Verified against: `backend/src/server.ts`, `backend/src/lib/jwt.ts`, `backend/src/lib/password.ts`, `backend/prisma/schema.prisma`, `backend/src/routes/*.ts`, `backend/src/services/**`, `backend/src/jobs/*`, `frontend-next/src/lib/api/*`, `frontend-next/src/proxy.ts`, and repo-map parts 07, 25 + DEAD_CODE_FINDINGS.

---

### §2.1 Backend / §7.4 Password Security — bcrypt salt rounds
**Type: incorrect.** Doc states "bcrypt 6.0.0 — Password hashing (salt rounds = 10)" in the stack table and "bcrypt with salt rounds = 10" in §7.4. Real code: `backend/src/lib/password.ts` line 5 uses `const saltRounds = 12`.
**Fix:** Change both mentions from 10 to 12.

### §1.1 diagram + §4.2 + §4.5 — cron job count is wrong (10 vs 13)
**Type: incorrect.** Diagram says "Jobs 10", §4.2 step 8 says "Cron job startup (10 jobs)", and §4.5 lists 10 jobs. `server.ts` starts **13** jobs: smartSync, deadlineReminder, newMemberDigest, phaseSync, fixtureTracking, liveScores, fixtureVerification, trackStatusChecker, capiRetry, **paymentReconcile**, **mpPaymentReconcile**, **accountReceivableExpiry**, **welcomeEmailFallback**.
**Fix:** Update count to 13 and add rows to the §4.5 table for `paymentReconcileJob.ts` (Polar stale-payment reconciler), `mpPaymentReconcileJob.ts` (MP reconciler), `accountReceivableExpiryJob.ts` (CC expiry), `welcomeEmailFallbackJob.ts` (24h welcome-email fallback per ADR-063).

### §6.2 — model count is wrong (32 vs 35) and Sales models missing
**Type: incorrect + missing.** Doc claims "32 models" (diagram and §6.2). `schema.prisma` has **35** models. The doc's table omits the three Sales models: `Quote`, `AccountReceivable`, `DocumentCounter` (added in migration `20260522_add_sales_management`).
**Fix:** Bump count to 35 (also in the §1.1 diagram which says "32 models"). Add a **Sales** category row: `Quote`, `AccountReceivable`, `DocumentCounter`.

### Whole doc — Sales / Cuenta de Cobro subsystem entirely absent
**Type: missing.** A complete sales-document subsystem shipped (ADR-061): `backend/src/services/sales/{quoteService,accountReceivableService,documentCounterService}.ts`, routes `routes/adminSales.ts` (admin issuance, mounted under `/admin/sales/*`) and `routes/salesRedemption.ts` (customer redemption, mounted at `/sales/account-receivables`), PDF generation (`backend/src/pdf/{QuoteDocument,CcDocument,renderQuotePdf,renderCcPdf}.tsx`), the `accountReceivableExpiryJob`, frontend admin pages under `admin/ventas/cotizaciones` + `admin/ventas/cuentas-de-cobro`, and the CC-redemption checkout path in the pool wizard. None of this appears in the architecture doc.
**Fix:** Add a Sales/CC subsystem subsection (services, routes, PDF renderer, redemption→checkout atomic REDEEM flow) and mention it in §3.2, §4.4, §8.1.

### §1.1 diagram + §4.2 + §4.4 — route/service counts stale
**Type: incorrect.** Diagram says "Routes 28 / Services 24". Real: **30** mounted router files (`backend/src/routes/` minus `payments.test.ts`), and the `services/` tree includes more than 24 (adds `structuralAutoPublish.ts` and the three `sales/*` services, MP/Polar clients, etc.). §4.2 also says "Router mounting (28 route files)".
**Fix:** Either drop the hard counts (preferred — they drift) or update to 30 routes and recount services. Note `adminSales.ts` and `salesRedemption.ts` are the routers missing from §3.2's list.

### §3.2 Backend Directory Structure — stale/missing entries
**Type: obsolete + missing.** The listing predates several files: missing jobs `paymentReconcileJob.ts`, `mpPaymentReconcileJob.ts`, `accountReceivableExpiryJob.ts`, `welcomeEmailFallbackJob.ts`; missing routes `adminSales.ts`, `salesRedemption.ts`; missing services `structuralAutoPublish.ts` and the `sales/` subdir; missing `pdf/` directory entirely; the lib list ("34 utility modules") omits `activationUrl.ts`, `amountInWords.ts`, `saleTerms.ts`, `issuerInfo.ts`, `unsubscribe.ts`, `utm.ts`, `paymentEvents.ts`, `syntheticFixtureId.ts`. Also the comment "28 mounted route files" is wrong (30).
**Fix:** Refresh the tree or replace exhaustive file lists with "see repo-map" pointers to stop drift.

### §3.3 Frontend Directory Structure — wrong locations & missing pages
**Type: incorrect + missing.** Issues: (a) `activar-cuenta/` is correct but doc places `empresas/` and `pago/` as if both are top-level public — in reality `empresas/crear` and the whole `pago/` tree live under `[locale]/(authenticated)/`, while `empresas/page.tsx` is the only public enterprise page. (b) Missing real public routes: `como-se-juega/`, `invite/`, and the `mundial-2026/` SEO hub (`page`, `grupos`, `calendario`, `sedes`, `predicciones`, `reglas-quiniela`, `como-hacer-quiniela`). (c) Missing the `admin/ventas/*` and `admin/analytics-health/` pages. (d) `app/api/region/route.ts` (client-side region detection endpoint) not mentioned.
**Fix:** Correct the auth-group placement of `empresas/crear` and `pago`, add the missing SEO/sales/region routes.

### §3.3 + §5.5 — `lib/api/` module names are partly fictional
**Type: incorrect.** Doc lists modules `dashboard.ts`, `pool.ts`, `members.ts`, `structural.ts`, `profile.ts`. Real files (`frontend-next/src/lib/api/`): `client.ts`, `auth.ts`, `admin.ts`, `corporate.ts`, `payments.ts`, `groupStandings.ts`, `picks.ts`, `pools.ts`, `scoring.ts`, `user.ts`, `sales.ts`, `paymentAttemptEvent.ts`, `index.ts`. There is no `dashboard.ts`/`pool.ts`/`members.ts`/`structural.ts`/`profile.ts`; functions like `getMePools`/`joinPool` live in `pools.ts`/`user.ts`. Missing entirely: `sales.ts` and `paymentAttemptEvent.ts` (payment-attempt telemetry beacons, ADR-066).
**Fix:** Rewrite both module tables to the real filenames; add `sales` and `paymentAttemptEvent` (telemetry) rows.

### §9.5 Payment & Capacity Upgrade — wrong endpoint paths
**Type: incorrect.** The flow cites `GET /payments/country-detect`, `POST /payments/checkout/{polar|mercadopago}`, and `POST /payments/webhooks/{polar|mercadopago}`. Actual paths (`routes/payments.ts` + `server.ts`): `GET /payments/country`, `POST /payments/checkout` (Polar) and `POST /payments/mp-checkout` / `POST /payments/mp-process` (MP Brick), webhooks `POST /payments/webhook` (Polar, raw body) and `POST /payments/mp-webhook` (MP). The correct paths are already listed in §8.1 — §9.5 contradicts §8.1.
**Fix:** Align §9.5 paths with §8.1 (no `country-detect`, no `/checkout/{gateway}`, no `/webhooks/{gateway}` plural).

### §9.5 — `PaymentEvent` idempotency note slightly imprecise
**Type: incorrect (minor).** Doc says "INSERT PaymentEvent { polarEventId } (UNIQUE)". `schema.prisma` PaymentEvent uses a **partial** unique index `PaymentEvent_polarEventId_unique_when_set` (unique only when `polarEventId` is non-NULL), and `polarEventId` holds both Polar and MP composite ids; there is also a `source` discriminator (POLAR_WEBHOOK / MP_WEBHOOK / CLIENT / RECONCILER / SERVER).
**Fix:** Note the unique index is partial (non-NULL only) and shared across gateways; mention the `source` column. Optional but improves accuracy.

### §4.5 — `resultSyncJob` described as "Inactive / kept for backfill" — confirm dead
**Type: obsolete (verify).** Doc lists `resultSyncJob.ts` as an inactive legacy job. DEAD_CODE_FINDINGS B4 flags the whole file as dead (`runSyncJob()` unreachable, `scheduledTask` permanently null). It is not started in `server.ts` (correct — doc says "Inactive").
**Fix:** Keep but mark clearly as dead/legacy (candidate for removal), not merely "kept for backfill", to match the dead-code finding.

### §7.3 Corporate Activation — endpoint name drift
**Type: incorrect (minor).** Doc §7.3 says verification endpoint is `GET /auth/check-corporate-invite?token=xxx` and frontend route is `/activar-cuenta` — both correct. But §3.3 earlier comment and MEMORY reference an older `/activar` path; the shipped page is `app/[locale]/activar-cuenta/page.tsx`. Token size: doc says 32 bytes / 64 hex chars (`CRYPTO_BYTES.TOKEN`) — verify against `lib/constants.ts` (MEMORY notes 48 bytes historically; constants.ts is source of truth).
**Fix:** Confirm `CRYPTO_BYTES.TOKEN` value in `lib/constants.ts` and make §7.3 and §12.1 agree (§12.1 says "Token (32 bytes)").

### §10.1 — frontend start command
**Type: incorrect (minor).** Doc shows frontend start as `node .next/standalone/server.js` and `cd frontend-next && node .next/standalone/server.js`. The Next.js standalone server entrypoint is `node server.js` from the copied standalone root; verify against `frontend-next/railway.toml` (repo-map lists it) rather than asserting the `.next/standalone/` path, which can vary with monorepo output tracing.
**Fix:** Cross-check `frontend-next/railway.toml` start command and use the exact string.

### Cross-doc duplication
**Type: duplication.** §6.2 model list and §6.3 design principles overlap heavily with `docs/DATA_MODEL.md`; §8.1 endpoint list overlaps `docs/API_SPEC.md` (doc already says "Full reference lives in API_SPEC.md"). §9.6 analytics DLQ overlaps `docs/guides/ANALYTICS_PIPELINE.md` (already cross-referenced). Low harm since cross-refs exist, but the model/endpoint lists will drift; prefer pointers over duplicated inventories.
**Fix:** Trim the duplicated inventories to summaries + cross-references.

### Accurate sections (spot-checked OK)
- §1.x architecture style, monorepo layout, external integrations (Mercado Pago + Polar dual gateway, picks4all-scores primary + API-Football fallback, Resend, GA4+Meta CAPI w/ DLQ) — **ok**.
- §5.3 proxy.ts as sole locale authority (ADR-064), URL-prefix-first, www redirect, hreflang Link filtering — **ok**, matches `proxy.ts`.
- §7.1 JWT (HS256, 4h expiry, payload `{userId, platformRole}`) — **ok** (`jwt.ts`).
- §9.2 result publication source hierarchy (HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL) — **ok**.
- §9.6 analytics DLQ (FailedAnalyticsEvent, advisory lock, capiRetryJob) — **ok**; note the model is multi-provider (Meta CAPI + GA4 MP), job comment naming is `capi*` only (cosmetic, per DEAD_CODE E).
