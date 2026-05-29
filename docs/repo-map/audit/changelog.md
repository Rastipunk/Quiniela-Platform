## Audit: CHANGELOG.md

**Overall verdict: UPDATE (minor).** CHANGELOG.md is an append-only historical document and its existing entries are accurate against the shipped code — spot-checks of the most-recent and money-sensitive claims (`mpPurchaseValue()`, `corporateCumulativePrice` vs `corporateCumulativePriceCop`, `PoolPayment.amountCop`, `PoolPayment.mpPreferenceId`, `FailedAnalyticsEvent`, `EmailSuppression`, `BUILD_VERSION = "v1.0.0"`, `package.json` version `1.0.0`) all verify. The single material defect is that the log **stops at `[1.0.0] — 2026-05-04` and omits roughly three weeks of substantial shipped systems** (12 migrations dated 2026-05-12 → 2026-05-27, ADR-061 through ADR-066 per project memory). For a Keep-a-Changelog document the gap is a real omission, not a contradiction. Two minor internal-count notes below.

Ground truth: `backend/prisma/schema.prisma` (35 `model` declarations today), `backend/src/server.ts:86`, `backend/package.json`, migrations folder, repo-map part-11 (sales services), part-10 (payments), part-02 (reconcile + welcome jobs), part-18 (admin sales UI).

---

### Finding 1 — Head of log is stale: missing all post-1.0.0 releases
- **Section:** Top of file (latest entry is `[1.0.0] — 2026-05-04`)
- **Type:** missing
- **What's wrong:** Twelve migrations landed after the 1.0.0 date and none are recorded in the changelog. They correspond to whole subsystems documented elsewhere (project memory ADR-061…ADR-066) but invisible here:
  - `20260512_add_user_locale_preference` / `20260512_user_locale_nullable` — User.locale + locale-resolution architecture (proxy.ts as sole locale authority, ADR-064). Frontend `LocalePreferenceGate`/`LocalePreferenceModal`.
  - `20260519_extend_payment_observability` + `20260521_pool_payment_initiated_state` — new `PoolPaymentStatus.INITIATED` / `ABANDONED` states (schema.prisma:1234-1243), payment-attempt telemetry table with client beacons `REDIRECT_INITIATED`/`USER_CANCELLED`/`CLIENT_ERROR` (schema.prisma:1347-1386, ADR-066), frontend `lib/api/paymentAttemptEvent.ts`.
  - `20260522_add_sales_management` — Quote / AccountReceivable / DocumentCounter models (schema.prisma:1456/1525/1616), `saleTerms.ts`, `services/sales/*`, `routes/adminSales.ts` + `salesRedemption.ts`, PDF generation (`pdf/QuoteDocument.tsx`, `pdf/CcDocument.tsx`), full admin UI under `/admin/ventas/...` (ADR-061).
  - `20260526_add_organization_invitation_locale` — Organization.invitationLocale (ADR-062).
  - `20260526_add_user_welcome_email_sent_at` — deferred welcome-email handoff + `welcomeEmailFallbackJob.ts` (ADR-063).
  - `20260527_add_mp_payment_id_and_status_index` — `PoolPayment.mpPaymentId` (schema.prisma:1318) + `mpPaymentReconcileJob.ts` (MP reconciler, ADR-065 payments parity).
- **Fix:** Add one or more new entries above `[1.0.0]` (e.g. `[1.1.0] — 2026-05-2x`) covering: Sales/Quote+Cuenta-de-Cobro stack, locale-preference + locale-resolution rework, payment INITIATED/ABANDONED lifecycle + payment-attempt telemetry, MP payment reconciler + `markPaymentCompleted` parity, corporate invitation locale, and deferred welcome-email handoff. Bump versions accordingly.

### Finding 2 — Wompi mention is correct as history but worth a cross-reference
- **Section:** `[0.9.0]` → Removed → "Wompi dead code — Unused payment service client removed"
- **Type:** ok (no change needed to this line)
- **What's wrong:** Nothing — this is accurate as a historical removal and matches project memory ("Wompi was discarded"). Flagged only to confirm there is no surviving Wompi code in the tree (verified: no Wompi client in `backend/src/services/`). Leave as-is.

### Finding 3 — Internal "32 modelos" figure in the 1.0.0 doc-alignment note
- **Section:** `[1.0.0]` → "Documentation alignment" → "ARCHITECTURE.md and DATA_MODEL.md espejan el schema (32 modelos, 57+ migraciones)"
- **Type:** ok-as-history / informational
- **What's wrong:** The schema today has **35** `model` declarations and 70 migration folders, because the sales/locale/payment-observability work (Finding 1) added models after 1.0.0. The "32 models / 57 migrations" snapshot was accurate for the 2026-05-04 release and, being a changelog, should NOT be edited to today's numbers. No fix to this line; the correct remedy is adding the new entries (Finding 1) whose own counts reflect the additions.

### Finding 4 — Mixed Spanish/English in the 1.0.0 entry (style, not correctness)
- **Section:** `[1.0.0]` → "Documentation alignment", "Removed (TECH_DEBT cleanup)"
- **Type:** ok (cosmetic)
- **What's wrong:** The 1.0.0 entry switches to Spanish mid-document ("espejan el schema", "cubre los 28 routers reales", "marcados Superseded") while the rest of the file is English. Not a code mismatch. Note: it says "28 routers"; the repo has 30 router modules in `backend/src/routes/` today (two — `adminSales.ts`, `salesRedemption.ts` — were added post-1.0.0). Again accurate for its date; no edit needed, the new entry should mention the two added routers.

---

**Net:** existing entries are trustworthy history; the document only needs forward additions for the May 12–27 work. No obsolete/incorrect claims to delete.
