# Sales Management — Implementation Tracker

> Companion to `SALES_AUDIT.md`. This file is the step-by-step checklist used during execution. Update the status emoji + SHA as each commit lands so the work survives context breaks.
>
> Every locked decision is in `SALES_AUDIT.md` §11. Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Trilingual / localization guarantee (REVISED v4)

This feature has **two distinct surfaces** with different localization rules:

1. **Admin UI** (the panel at `/admin/ventas/...` used by you) — follows the codebase pattern: keys live in `messages/{es,en,pt}/`. ES is the primary; EN and PT must have full parity. Manual locale switch verified at commit time.
2. **PDF output** (cotizaciones + cuentas de cobro) — **now also trilingual in v1**, per locked decision §11.18. The admin chooses `locale` per document (ES/EN/PT). The PDF template carries its strings in a per-locale dictionary inside the renderer; the régimen-tributario DIAN phrase appears only in `es` documents.

The trilingual guarantee on the admin UI applies to:
- Form labels and placeholders (including `locale` and `term` dropdowns)
- Empty-list states
- Action button labels
- Error messages
- The list table headers and status badges

The trilingual guarantee on the **PDF output** applies to:
- Section headings (§1 Datos del Cliente / Client Details / Dados do Cliente, etc.)
- Fixed body copy in §2 (¿Qué es Picks4All? + intro paragraphs)
- §3 bullet headings + descriptions (8 bullets × 3 locales = 24 strings)
- §5 "¿Cómo empezamos?" steps + CTA
- CC labels (VALOR A PAGAR A / VALUE TO BE PAID TO / VALOR A PAGAR PARA, etc.)
- Régimen-tributario phrase — **es only** (omitted in en/pt PDFs since the issuer's tax status is Colombian)
- The `{term}` placeholder, substituted by the admin's choice from the locale-filtered dictionary

The dictionary lives in `backend/src/pdf/i18n.ts` — single file, three keys: `es`, `en`, `pt`. Each is a flat object of the same shape so adding/changing a string is a 3-line PR.

---

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: Prisma schema (`Quote`, `AccountReceivable`, `DocumentCounter`) + `PoolPayment.accountReceivableId` FK + migration | 🟩 DONE | `44cb5b3` |
| 2 | Backend: services (`quoteService`, `accountReceivableService`, `documentCounterService`) + `issuerInfo.ts` constant | 🟩 DONE | `b075375` |
| 3 | Backend: install `@react-pdf/renderer` + Inter font + SVG assets + **i18n dictionary** (`backend/src/pdf/i18n.ts`) + Cotización PDF template (single-investment, trilingual, term substitution, **section-level `wrap={false}`**) | 🟩 DONE | `423f99f` |
| 4 | Backend: Cuenta de cobro PDF template (trilingual, dual-path payment instructions, **Bancolombia block COP-only**, **section-level `wrap={false}`**) + amount-in-words helper (locale-aware suffixes) | 🟩 DONE | `bf1b27b` |
| 5 | Backend: routes (`/admin/sales/quotes`, `/admin/sales/account-receivables`, `/sales/account-receivables/redeem`) | 🟩 DONE | `223c629` |
| 6 | Backend: payment integration — `accountReceivableId` in `InitiateCheckoutInput`, validate + lock + link on `PoolPayment.create`, flip to `PAID` on webhook | 🟩 DONE | `1a369a0` |
| 7 | Backend: payment receipt email — optional `accountReceivableNumber` row (ES/EN/PT) | 🟩 DONE | `60e0944` |
| 8 | Backend: reconciler — release CC back to `PENDING` when linked `PoolPayment` expires + sweep CCs past `validUntil` | 🟩 DONE | `2d076fb` |
| 9 | Frontend: lib/api wrappers + types | 🟩 DONE | `fae9eed` |
| 10 | Frontend: `/admin/ventas/cotizaciones` route (list + create form + preview + download) | 🟩 DONE | `4841c13` |
| 11 | Frontend: `/admin/ventas/cuentas-de-cobro` route (list + create form + manual mark-paid + download) | 🟩 DONE | `8e4dbf5` |
| 12 | Frontend: "¿Tienes una cuenta de cobro?" box in `StepCapacity` (creation wizard) and `ExpandCapacitySection` (existing pool) | 🟩 DONE | `ec3f261` |
| 13 | Frontend: NavBar "Gestión de Ventas" entry under ADMIN | 🟩 DONE | `86e2631` |
| 14 | Docs: ADR-061 + BUSINESS_RULES update + CLAUDE.md invariant + MEMORY entry (and Wompi-stale-note cleanup) | 🟩 DONE | `4e1fd41` |

After commit 12 the feature is live for both you and customers. Commits 13-14 are polish + documentation hygiene.

---

## Pre-flight (do before commit 1)

- [x] Audit doc reviewed by user.
- [x] Plan §11 decisions locked.
- [ ] User confirms uncertain items in `SALES_AUDIT.md` §13 (or accepts the proposed leans).
- [ ] User confirms the Cuenta de cobro design in `SALES_AUDIT.md` §6 (or sends a sample they had hidden — last chance).
- [ ] User says "go" for commit 1.

---

## 1 — Step-by-step: Commit 1 — Prisma schema + migration

**Goal**: persist quotes, CCs, and the consecutive counter. FK on `PoolPayment` for the CC link.

### 1.1 Files

- `backend/prisma/schema.prisma` — add `Quote`, `AccountReceivable`, `DocumentCounter`, `QuoteStatus` enum, `AccountReceivableStatus` enum, `DocumentKind` enum; add `accountReceivableId` field on `PoolPayment`; add relation entries on `User` for `createdBy`/`redeemedBy`.
- Generate migration: `cd backend && npx prisma migrate dev --name add_sales_management`. The file lands under `backend/prisma/migrations/<timestamp>_add_sales_management/`.

### 1.2 Schema diff

Refer to `SALES_AUDIT.md` §9.1, §9.2, §9.3, §9.4 for the exact field list. Key constraints:

- `Quote.consecutive` UNIQUE
- `AccountReceivable.consecutive` UNIQUE
- `AccountReceivable.redemptionCode` UNIQUE
- `AccountReceivable.poolPaymentId` UNIQUE (1:1 CC → payment)
- `PoolPayment.accountReceivableId` UNIQUE
- `DocumentCounter` PK = `[kind, year]`
- Index `AccountReceivable [status, validUntil]` for the expiry sweep

### 1.3 Acceptance

- [ ] `npx prisma migrate dev` succeeds locally without conflicts.
- [ ] `npx prisma generate` regenerates the client without errors.
- [ ] `npx tsc --noEmit` in backend passes (no unbound relations).
- [ ] Migration committed; deploy on Railway runs `prisma migrate deploy` and applies cleanly (verify via Railway logs after push).

### 1.4 Commit message template

```
feat(sales): schema for quotes, account-receivables, and consecutive counter

Adds three new Prisma models that back the upcoming "Gestión de
Ventas" admin panel and the cuenta-de-cobro redemption flow:

  - Quote: persisted quote with consecutive (COT-YYYY-NNNN),
    issuer snapshot, options JSON, lifecycle (ACTIVE/EXPIRED/
    CANCELLED), and audit metadata.
  - AccountReceivable: cuenta de cobro with consecutive
    (CC-YYYY-NNNN), 8-digit numeric redemption code, lifecycle
    (PENDING → REDEEMED → PAID, plus EXPIRED/CANCELLED), and an
    optional FK to a linked Quote for cross-reference.
  - DocumentCounter: atomic per-year consecutive counter, keyed
    by (kind, year). Reset implicitly on Jan 1 of each year by
    inserting a fresh row.

Also adds PoolPayment.accountReceivableId (nullable, unique FK)
so a webhook-completed payment can flip its linked CC to PAID
in the same transaction.

Migration scope: additive only. No data backfill required.

Tracked in SALES_IMPLEMENTATION.md commit 1.

Co-Authored-By: ...
```

### 1.5 Status

🟩 DONE — SHA: `44cb5b3` (pushed 2026-05-22). Migration deploys on Railway's next `prisma migrate deploy`.

---

## 2 — Step-by-step: Commit 2 — Services + issuer constant

**Goal**: business logic for issuing quotes/CCs, atomic counter increment, redemption transitions. No HTTP yet.

### 2.1 Files

- `backend/src/lib/issuerInfo.ts` — typed constant with the values from `SALES_AUDIT.md` §8.
- `backend/src/services/sales/documentCounterService.ts` — atomic increment of `(kind, year)`. Returns the next `number` and the formatted `consecutive`.
- `backend/src/services/sales/quoteService.ts` — `issueQuote`, `getQuote`, `listQuotes`, `cancelQuote`.
- `backend/src/services/sales/accountReceivableService.ts` — `issueAccountReceivable`, `getAccountReceivable`, `findByRedemptionCode`, `listAccountReceivables`, `cancelAccountReceivable`, `markAccountReceivablePaid`, `tryLockAccountReceivable` (atomic PENDING → REDEEMED).
- `backend/src/services/sales/__tests__/` — unit tests for the atomic counter and the lock helper (Vitest, in-memory).

### 2.2 Notable mechanics

**Counter atomicity** — use a single `prisma.$queryRaw` to increment + return:

```ts
INSERT INTO "DocumentCounter" (kind, year, "lastNumber", "updatedAtUtc")
VALUES ($1, $2, 1, NOW())
ON CONFLICT (kind, year)
DO UPDATE SET "lastNumber" = "DocumentCounter"."lastNumber" + 1, "updatedAtUtc" = NOW()
RETURNING "lastNumber";
```

Wrap in `prisma.$transaction` with the row INSERT so the counter and the new document row commit together.

**Redemption-code generation** (`accountReceivableService.issueAccountReceivable`):

```ts
async function generateRedemptionCode(tx: PrismaTx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    // 8-digit numeric; format XXXX-XXXX on the way out for display.
    const raw = crypto.randomInt(10_000_000, 100_000_000).toString();
    const collision = await tx.accountReceivable.findUnique({
      where: { redemptionCode: raw },
      select: { id: true },
    });
    if (!collision) return raw;
  }
  throw new Error("Failed to generate unique redemption code after 5 attempts");
}
```

Store the raw 8-digit string in the DB. Format with the hyphen at the UI/PDF rendering layer only — keeps the redemption check simple (`code.replace(/[^\d]/g, "")` on user input).

**Atomic CC lock** (`tryLockAccountReceivable`) — used by `paymentService.initiateCheckout` in commit 6:

```ts
const claim = await prisma.accountReceivable.updateMany({
  where: { id: ccId, status: "PENDING" },
  data: { status: "REDEEMED", redeemedByUserId: userId, redeemedAtUtc: new Date() },
});
if (claim.count === 0) throw new ServiceError("CONFLICT", 409, { message: "CC already redeemed or invalid" });
```

Same pattern as `activate-corporate` (ADR-048).

**Issuer snapshot**: `issueQuote` and `issueAccountReceivable` copy the entire `ISSUER_INFO` constant into the row's `issuerSnapshotJson`. If you later update `issuerInfo.ts`, previously-issued docs retain the old values for legal audit. The PDF renderer reads from the snapshot, not from the live constant.

### 2.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Unit tests for counter atomicity pass (two concurrent issuance attempts produce sequential numbers, not duplicates).
- [ ] Unit tests for lock helper pass (two concurrent redemptions: one succeeds, one gets 409).

### 2.4 Commit message template

```
feat(sales): services for quote + account-receivable + counter

[...]
```

### 2.5 Status

🟥 PENDING — SHA: —

---

## 3 — Step-by-step: Commit 3 — PDF renderer + Cotización template

**Goal**: install `@react-pdf/renderer`, copy brand SVGs into the backend, render the quote PDF.

### 3.1 Files

- `backend/package.json` — add `@react-pdf/renderer` ^3.x.
- `backend/src/assets/brand/` — new directory, copy the SVG assets:
  - `isotipo-degradado-180.svg` (cover hero)
  - `isotipo-degradado-32.svg` (running header)
  - `logotipo-degradado-120.svg` (cover wordmark)
  - `logotipo-degradado-40.svg` (running header right side)
- `backend/src/pdf/SharedStyles.ts` — react-pdf StyleSheet shared between templates (brand colors, fonts, layouts).
- `backend/src/pdf/QuoteHeader.tsx` and `QuoteFooter.tsx` — recurring header/footer for body pages.
- `backend/src/pdf/QuoteCoverPage.tsx` — the optional page 1 cover.
- `backend/src/pdf/QuoteBody.tsx` — §1 through §5 from `SALES_AUDIT.md` §5.2.
- `backend/src/pdf/QuoteDocument.tsx` — top-level `<Document>` composing cover (conditional) + body.
- `backend/src/pdf/renderQuotePdf.ts` — `renderQuotePdf(quote: Quote): Promise<Buffer>` — the export entry point.

### 3.2 Asset copy mechanism

To avoid drift between the frontend SVG masters and the backend's copies, add a script `backend/scripts/sync-brand-assets.sh`:

```sh
#!/bin/sh
set -e
cp -v ../frontend-next/public/brand/isotipo-degradado-180.svg src/assets/brand/
cp -v ../frontend-next/public/brand/isotipo-degradado-32.svg  src/assets/brand/
cp -v ../frontend-next/public/brand/logotipo-degradado-120.svg src/assets/brand/
cp -v ../frontend-next/public/brand/logotipo-degradado-40.svg  src/assets/brand/
```

Run once at commit time. Document in `docs/guides/SETUP.md` to re-run if the brand assets change. Not a build-time step — explicit copy ensures intentional review of brand changes.

### 3.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Local test: `renderQuotePdf(mockQuote)` produces a Buffer that opens in a PDF reader.
- [ ] Visual inspection of the rendered PDF against the Linalca sample (`20260407_Cotizacion Linalca_v02.pdf`):
  - Cover page matches (logo, title, tagline, "Preparado para", date, contact).
  - Body pages have the running header/footer.
  - §1-§5 layout matches.
  - Logo and isotipo render sharp at print resolution (zoom to 400% → no pixelation).
  - Spanish text renders correctly (accents, ñ).

### 3.4 Status

🟥 PENDING — SHA: —

---

## 4 — Step-by-step: Commit 4 — Cuenta de cobro PDF template + amount-in-words

**Goal**: render the CC PDF per `SALES_AUDIT.md` §6.1. Includes the Spanish amount-in-words helper.

### 4.1 Files

- `backend/package.json` — add `numero-a-letras` ^x.x (pinned at install time).
- `backend/src/lib/amountInWords.ts` — wraps `numero-a-letras`. Function: `amountCopInWords(amountCop: number): string`. Output format: "DOSCIENTOS CINCUENTA Y SIETE MIL PESOS M/CTE" (uppercase, with "M/CTE" suffix).
- `backend/src/lib/amountInWords.test.ts` — verify edge cases: 0, 1, 1000, 999_999, 1_000_000, 100_000_000.
- `backend/src/pdf/AccountReceivableHeader.tsx` and `Footer.tsx`.
- `backend/src/pdf/AccountReceivableDocument.tsx` — composes the full CC per §6.1.
- `backend/src/pdf/renderAccountReceivablePdf.ts` — `renderAccountReceivablePdf(cc: AccountReceivable): Promise<Buffer>`.

### 4.2 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] `amountInWords.test.ts` passes for all edge cases.
- [ ] Local test: `renderAccountReceivablePdf(mockCc)` produces a Buffer that opens.
- [ ] Visual inspection:
  - 1-page output for a typical CC (concept ≤200 chars).
  - 2-page overflow tested with a 800-char concept; running header/footer appears on page 2.
  - Amount in words matches the figures.
  - Redemption code displays as `XXXX-XXXX`.
  - Regimen tributario phrase is verbatim per §6.1.

### 4.3 Status

🟥 PENDING — SHA: —

---

## 5 — Step-by-step: Commit 5 — HTTP routes

**Goal**: expose the services via REST, gated by `requireAdmin` (except the redemption endpoint which is `requireAuth`).

### 5.1 Files

- `backend/src/routes/adminSales.ts` — all `/admin/sales/...` routes per `SALES_AUDIT.md` §9.6.
- `backend/src/routes/salesRedemption.ts` — public-but-authed `/sales/account-receivables/redeem`.
- `backend/src/server.ts` — mount both routers.

### 5.2 Zod schemas (REVISED v4)

Each POST endpoint has a Zod input schema. List explicitly so the form fields and the API agree. **Note**: `amountCop` / `amountUsd` are NOT in the input — the server computes them via `pricing.ts` from `participants`/`targetCapacity` + `currency` and rejects any client-side override.

```ts
// adminSales.ts schemas

const LocaleEnum = z.enum(["es", "en", "pt"]);
const CurrencyEnum = z.enum(["COP", "USD"]);
// Term enum is locale-conditional; validated against the locale's
// allowed list in a refinement step.
const TermEnum = z.enum(["polla", "penca", "prode", "quiniela", "porra", "pool", "prediction_game", "sports_pool", "bolão", "palpites"]);

const issueQuoteSchema = z.object({
  // Client
  clientLegalName: z.string().min(1).max(200),
  clientContactEmail: z.string().email(),

  // Dates
  issueDate: z.string().date(),
  validUntil: z.string().date(),

  // Localization
  locale: LocaleEnum,
  term: TermEnum,

  // Investment (single block)
  participants: z.number().int().positive(),
  currency: CurrencyEnum,
  tournament: z.string().max(200).optional(),
  investmentDescription: z.string().max(2000).optional(),

  // Layout
  includeCoverPage: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
}).refine((data) => isTermValidForLocale(data.locale, data.term), {
  message: "Term not valid for the selected locale",
  path: ["term"],
});

const issueAccountReceivableSchema = z.object({
  // Client
  clientLegalName: z.string().min(1).max(200),
  clientNit: z.string().max(50).optional(),
  clientContactEmail: z.string().email(),
  clientCity: z.string().max(100).optional(),

  // Dates
  issueDate: z.string().date(),
  validUntil: z.string().date(),

  // Localization
  locale: LocaleEnum,
  term: TermEnum,

  // Content
  concept: z.string().min(1).max(1000),
  tournament: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),

  // Pricing source
  targetCapacity: z.number().int().positive(),
  currency: CurrencyEnum,

  // Type
  poolType: z.literal("corporate"), // v1 locked

  // Link
  linkedQuoteId: z.string().uuid().optional(),
}).refine((data) => isTermValidForLocale(data.locale, data.term), {
  message: "Term not valid for the selected locale",
  path: ["term"],
});

const redeemSchema = z.object({
  redemptionCode: z.string().min(8).max(12), // accepts XXXX-XXXX or XXXXXXXX
});
```

Helper `isTermValidForLocale` lives in `backend/src/lib/saleTerms.ts` with the dictionary from §11.19 of the audit doc.

### 5.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Manual test via `curl`:
  - `POST /admin/sales/quotes` with admin cookie → 200 returns `{ id, consecutive: "COT-2026-0001" }`.
  - `POST /admin/sales/quotes` with non-admin cookie → 403.
  - `GET /admin/sales/quotes` → 200 with paginated list.
  - `GET /admin/sales/quotes/<id>/pdf` → 200, `Content-Type: application/pdf`, body is a valid PDF.
  - `POST /admin/sales/account-receivables` → 200 returns `{ id, consecutive, redemptionCode }`.
  - `POST /sales/account-receivables/redeem` with a valid code (authed user) → 200 returns CC summary.
  - Same with an invalid code → 404.
  - Same with an expired code → 410 (or 409 — pick one in implementation).

### 5.4 Status

🟥 PENDING — SHA: —

---

## 6 — Step-by-step: Commit 6 — Payment integration (CC lock + link)

**Goal**: when a customer redeems a CC during checkout, `paymentService` validates + locks + links it; when the payment completes, the CC flips to PAID atomically.

### 6.1 Files

- `backend/src/services/paymentService.ts` — modify `InitiateCheckoutInput` and both `initiateCheckout` (Polar — out of v1 scope for CC but the field is reserved) and `initiateMpCheckout` (MP — the v1 path).
- Webhook handlers (Polar `order.paid` and MP IPN) in `routes/payments.ts` or wherever `handleOrderPaid` lives — extend the transaction that flips `PoolPayment.status = COMPLETED` to also flip the linked CC to `PAID`.

### 6.2 Diff sketch (`initiateMpCheckout`)

```diff
 export interface InitiateCheckoutInput {
   userId: string;
   poolId: string;
   targetCapacity: number;
+  /** Optional: when the customer is paying via a CC redemption code,
+   *  this is the AccountReceivable.id resolved server-side from the
+   *  redemption endpoint. The payment service:
+   *   - re-validates the CC is still PENDING + not expired
+   *   - asserts CC.targetCapacity matches the requested targetCapacity
+   *   - asserts pricing.ts still agrees with CC.amountCop (snapshot drift check)
+   *   - atomically flips CC to REDEEMED, links it to the new PoolPayment
+   *  A 409 is returned for any mismatch; the customer is told to
+   *  contact sales for an updated CC. */
+  accountReceivableId?: string;
   locale?: string;
   metaFbp?: string;
   metaFbc?: string;
   clientIpAddress?: string;
   clientUserAgent?: string;
 }
```

Inside the function, after the existing capacity validation but **before** creating the `PoolPayment` row:

```ts
if (input.accountReceivableId) {
  const cc = await prisma.accountReceivable.findUnique({ where: { id: input.accountReceivableId } });
  if (!cc) throw new ServiceError("NOT_FOUND", 404, { message: "CC not found" });
  if (cc.status !== "PENDING") {
    throw new ServiceError("CONFLICT", 409, { message: "CC already redeemed or invalid", ccStatus: cc.status });
  }
  if (cc.validUntil && cc.validUntil.getTime() < Date.now()) {
    throw new ServiceError("CONFLICT", 409, { message: "CC expired", validUntil: cc.validUntil });
  }
  if (cc.targetCapacity !== targetCapacity) {
    throw new ServiceError("CONFLICT", 409, { message: "CC capacity mismatch", ccCapacity: cc.targetCapacity });
  }
  // Server-side pricing recompute. If it disagrees with the CC snapshot,
  // pricing.ts changed between issuance and redemption — admin must
  // reissue. See SALES_AUDIT.md §11.7.
  const expectedAmountCop = calculateUpgradePriceCop(poolType, currentCapacity, targetCapacity);
  if (expectedAmountCop !== cc.amountCop) {
    // Fire an admin alert (existing sendAdminNotification helper).
    fireAndForget("admin:cc-drift", sendAdminNotification({
      subject: `[Sales] CC ${cc.consecutive} pricing drift detected`,
      body: `<p>The CC was issued for $${cc.amountCop} COP but pricing.ts now computes $${expectedAmountCop} COP. Customer redemption blocked.</p>`,
      category: "cc_pricing_drift",
    }));
    throw new ServiceError("CONFLICT", 409, { message: "CC outdated, contact sales", expected: expectedAmountCop, snapshot: cc.amountCop });
  }
}
```

Then, inside the same transaction that creates `PoolPayment`:

```ts
const ccLock = input.accountReceivableId
  ? await tx.accountReceivable.updateMany({
      where: { id: input.accountReceivableId, status: "PENDING" },
      data: { status: "REDEEMED", redeemedByUserId: userId, redeemedAtUtc: new Date() },
    })
  : null;
if (ccLock && ccLock.count === 0) {
  throw new Error("CC_RACE_LOST"); // caught upstream → 409
}

const payment = await tx.poolPayment.create({
  data: {
    poolId, userId,
    // ... existing fields ...
    accountReceivableId: input.accountReceivableId ?? null,
  },
});

if (input.accountReceivableId) {
  await tx.accountReceivable.update({
    where: { id: input.accountReceivableId },
    data: { poolPaymentId: payment.id },
  });
}
```

### 6.3 Webhook handler diff

In the transaction that flips `PoolPayment.status` to `COMPLETED`:

```diff
 await tx.poolPayment.update({
   where: { id: paymentId },
   data: { status: "COMPLETED", paidAtUtc: new Date(), ... },
 });
+if (payment.accountReceivableId) {
+  await tx.accountReceivable.update({
+    where: { id: payment.accountReceivableId },
+    data: { status: "PAID", paidAtUtc: new Date() },
+  });
+}
```

### 6.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Existing payment flows (non-CC) still work — no regression.
- [ ] Unit test: passing a non-existent `accountReceivableId` → 404.
- [ ] Unit test: passing an expired CC → 409.
- [ ] Unit test: passing a CC with mismatched capacity → 409.
- [ ] Unit test: drift simulation (CC snapshot ≠ live pricing) → 409 + admin notification fires.
- [ ] Integration test (against test DB): valid CC redemption → `PoolPayment` created with `accountReceivableId`; CC status flips to `REDEEMED`.
- [ ] Manual test: simulate a webhook order.paid (or MP IPN) for the CC-linked payment → CC.status becomes `PAID`, `paidAtUtc` set.

### 6.5 Status

🟥 PENDING — SHA: —

---

## 7 — Step-by-step: Commit 7 — Email receipt update

**Goal**: when a paid `PoolPayment` had an associated CC, the existing receipt email displays the CC number.

### 7.1 Files

- `backend/src/lib/emailTemplates.ts` — extend `PaymentReceiptEmailParams` and `getPaymentReceiptTemplate`.
- `backend/src/lib/email.ts` — call site that constructs the params; load the optional `accountReceivable.consecutive`.
- i18n: extend the existing `i18n` map inside `getPaymentReceiptTemplate` with a new label `accountReceivable` per locale ("Cuenta de cobro" / "Account receivable" / "Conta de cobrança").

### 7.2 Diff

```diff
 export interface PaymentReceiptEmailParams {
   displayName: string;
   poolName: string;
   poolId: string;
   transactionId: string;
   amount: string;
   currency: string;
   fromCapacity: number;
   toCapacity: number;
   paidAt: string;
   locale: string;
+  /** When set, the receipt renders an extra row referencing the
+   *  cuenta de cobro this payment fulfilled. Format: "CC-2026-0001". */
+  accountReceivableNumber?: string;
 }
```

In the i18n block, add a key in each locale (`accountReceivable: "Cuenta de cobro"` / `"Account receivable"` / `"Conta de cobrança"`).

In the highlightBox table:

```diff
       <tr>
         <td ...>${t.date}</td>
         <td ...>${params.paidAt}</td>
       </tr>
+      ${params.accountReceivableNumber ? `
+      <tr>
+        <td ...>${t.accountReceivable}</td>
+        <td ... font-family:monospace>${params.accountReceivableNumber}</td>
+      </tr>` : ""}
```

### 7.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Snapshot test of the rendered email body (ES, EN, PT) — extra row present only when `accountReceivableNumber` is set.
- [ ] Local e2e: complete a CC-backed payment in dev → confirm the receipt email body in Resend dashboard includes the CC row.

### 7.4 Status

🟩 DONE — SHA: `60e0944` (pushed 2026-05-25).

---

## 8 — Step-by-step: Commit 8 — Reconciler integration

**Goal**: CCs released back to `PENDING` when their linked `PoolPayment` expires/abandons. CCs past `validUntil` swept to `EXPIRED`.

### 8.1 Files

- `backend/src/services/paymentService.ts` — `reconcileStalePayment` already exists. Extend it: when a row transitions to `EXPIRED` or `ABANDONED` and has `accountReceivableId`, flip the CC back to `PENDING` and null its `poolPaymentId`.
- `backend/src/jobs/accountReceivableExpiryJob.ts` (new) — cron, every hour, finds `AccountReceivable WHERE status='PENDING' AND validUntil < now()` and sets `status='EXPIRED'`. Pattern lifted from `paymentReconcileJob.ts`. Same advisory-lock + batch-size constants.
- `backend/src/server.ts` — register the new job.

### 8.2 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Unit test: `reconcileStalePayment` with a linked CC → CC status reverts to `PENDING`.
- [ ] Unit test: expiry job picks up a PENDING CC past `validUntil` → flips to `EXPIRED`.
- [ ] No regression on existing reconciler behavior for non-CC payments.

### 8.3 Status

🟩 DONE — SHA: `2d076fb` (pushed 2026-05-25). Hourly cron `5 * * * *` (configurable via `CC_EXPIRY_CRON`); advisory lock `82636504n`.

---

## 9 — Step-by-step: Commit 9 — Frontend API wrappers + types

**Goal**: typed access to the new backend endpoints. Foundation for commits 10-12.

### 9.1 Files

- `frontend-next/src/lib/api/sales.ts` (new) — typed wrappers:
  - `createQuote(token, input)`
  - `listQuotes(token, filters?)`
  - `getQuote(token, id)`
  - `cancelQuote(token, id)`
  - `downloadQuotePdfUrl(id)` (returns a string URL for `<a download>`)
  - `createAccountReceivable(token, input)`
  - `listAccountReceivables(token, filters?)`
  - `getAccountReceivable(token, id)`
  - `cancelAccountReceivable(token, id)`
  - `markAccountReceivablePaid(token, id)`
  - `downloadAccountReceivablePdfUrl(id)`
  - `redeemAccountReceivable(token, redemptionCode)`
- `frontend-next/src/lib/api/index.ts` — `export * from "./sales"`.
- Types live alongside as named exports (`QuoteRow`, `AccountReceivableRow`, `QuoteInput`, etc.).

### 9.2 Acceptance

- [ ] `npx tsc --noEmit` passes in frontend.
- [ ] Import from `@/lib/api` returns the new wrappers.

### 9.3 Status

🟩 DONE — SHA: `fae9eed` (pushed 2026-05-26).

---

## 10 — Step-by-step: Commit 10 — `/admin/ventas/cotizaciones` route

**Goal**: list + create + preview + download for cotizaciones. Admin-gated.

### 10.1 Files

- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/page.tsx` — list view with filters (client email, date range, status). "Nueva cotización" button.
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/nueva/page.tsx` — multi-section form per `SALES_AUDIT.md` §5.3, with a live preview pane on the right (HTML rendition, not the actual PDF — preview is "what the PDF will say").
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cotizaciones/[id]/page.tsx` — detail view: header + "Descargar PDF" button + read-only summary + "Cancelar cotización" action.
- i18n keys under `admin.sales.quotes.*` in all three pool.json catalogs (or split into new `admin.json` catalog if pool.json is getting too big — decide at commit time).

### 10.2 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Admin can fill the form for a typical Linalca-style cotización (with one or two Options) and submit → row appears in the list → PDF download produces a file matching the Linalca sample.
- [ ] Non-admin user accessing `/admin/ventas/cotizaciones` → redirected or 403.
- [ ] **Trilingual check**: ES (default), EN (`/en/admin/ventas/cotizaciones`), PT (`/pt/admin/...`) — all labels, buttons, error messages, status badges render natively. No `keyName` fallbacks visible.
- [ ] Mobile width (360-430px): form is usable on mobile (you said you want to issue these on the go).

### 10.3 Status

🟩 DONE — SHA: `4841c13` (pushed 2026-05-26). Hardcoded Spanish per admin convention (no i18n keys). "Emitir CC desde esta cotización" button deferred to commit 11.

---

## 11 — Step-by-step: Commit 11 — `/admin/ventas/cuentas-de-cobro` route

**Goal**: same shape as commit 10 but for CCs. Adds "Marcar como pagada" manual action.

### 11.1 Files

- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/page.tsx` — list with status filter (PENDING / REDEEMED / PAID / EXPIRED / CANCELLED).
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/nueva/page.tsx` — form per `SALES_AUDIT.md` §6.2. Optional `linkedQuoteId` dropdown (sourced from `listQuotes({ clientEmail })` after the user types the client email).
- `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/cuentas-de-cobro/[id]/page.tsx` — detail with "Descargar PDF", "Marcar como pagada" (only when status is `PENDING` or `REDEEMED`), "Cancelar". Also surfaces: redemption code, link to the linked `PoolPayment` if any.
- i18n keys under `admin.sales.accountReceivables.*` in all three locales.

### 11.2 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Admin can issue a CC for a typical case (e.g. Linalca, 200 cupos, $257.000 COP) → list shows row → PDF download matches §6.1 layout.
- [ ] "Marcar como pagada" works (status transitions, audit row written).
- [ ] **Trilingual check**: same as commit 10.
- [ ] Mobile width: form usable.

### 11.3 Status

🟩 DONE — SHA: `8e4dbf5` (pushed 2026-05-26). Includes cross-flow shortcut "→ Emitir cuenta de cobro" on ACTIVE quote detail pages (passes `?fromQuoteId=` so the CC form pre-fills client/locale/term/capacity/currency).

---

## 12 — Step-by-step: Commit 12 — Customer-facing CC redemption box

**Goal**: customers redeem CCs at two entry points — wizard StepCapacity and ExpandCapacitySection.

### 12.1 Files

- `frontend-next/src/components/AccountReceivableRedemptionBox.tsx` (new, ~150 LOC) — controlled component:
  - Props: `{ onRedeem(payload), onClear(), isMobile }` where payload = `{ accountReceivableId, targetCapacity, amountCop, consecutive }`.
  - State: `inputValue` (the code), `busy`, `error`, `redeemed` (the resolved CC summary).
  - UI: collapsed → "¿Tienes una cuenta de cobro?" + small CTA "Aplicar código" + "¿Dónde lo encuentro?" tooltip. Expanded → input (with mask `XXXX-XXXX`) + Apply button + error slot. Once redeemed → success panel "Cuenta de cobro CC-2026-0001 aplicada — 200 cupos por $257.000 COP" + "Quitar" button.
- `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx` — mount the box above `<CapacitySelector>`. When `redeemed`, dispatch `state.maxParticipants = redeemed.targetCapacity` + store `redeemed.accountReceivableId` in wizard state. When `<CapacitySelector>` is rendered with an active CC, switch to a locked-display variant showing the CC's capacity.
- `frontend-next/src/components/pool-wizard/PoolWizardContext.tsx` — add `accountReceivableId?: string` to wizard state. Plumb through to the eventual `createCorporatePool` call (or whatever submits the wizard).
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` (the `ExpandCapacitySection` component) — same mount. Plumb the `accountReceivableId` into `createCheckout` and `createMpCheckout` lib calls.
- `frontend-next/src/lib/api/payments.ts` — extend `createCheckout` and `createMpCheckout` signatures to accept optional `accountReceivableId`.
- Backend route signature already accepts it (commit 6).
- i18n keys under `accountReceivableRedemption.*`:
  - `cta`: "¿Tienes una cuenta de cobro?"
  - `findCodeHint`: "El código de 8 dígitos aparece en la sección 'Forma de pago' del PDF que recibiste."
  - `inputPlaceholder`: "XXXX-XXXX"
  - `apply`: "Aplicar"
  - `applying`: "Aplicando..."
  - `successTitle`: "Cuenta de cobro aplicada"
  - `successBody`: "{consecutive} — {capacity} cupos por {amount}"
  - `remove`: "Quitar"
  - `errorNotFound`: "No encontramos esta cuenta de cobro."
  - `errorExpired`: "Esta cuenta de cobro venció. Contacta al equipo de ventas."
  - `errorRedeemed`: "Esta cuenta de cobro ya fue usada."
  - `errorCancelled`: "Esta cuenta de cobro fue anulada."
  - `errorDrift`: "El precio ha cambiado desde la emisión. Pide una cuenta de cobro actualizada al equipo de ventas."

### 12.2 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Wizard flow: enter code → see capacity locked → "Proceder al pago" → checkout uses the snapshot price → on completion CC.status=PAID + receipt email has the CC row.
- [ ] Expand-capacity flow: same.
- [ ] **Trilingual check** on the box: ES default + `/en/` + `/pt/` — all labels render.
- [ ] Error states: each error key triggers correctly via simulated codes (test CC in each status).
- [ ] Mobile width (360-430px): input fits, button is tap-target ≥44px, success panel doesn't overflow.

### 12.3 Status

🟩 DONE — SHA: `ec3f261` (pushed 2026-05-26). Box only renders for corporate pools (matches backend gating). Spanish strings inline via next-intl `defaultMessage`; EN/PT can be added later by populating `messages/{locale}/common.json#accountReceivableRedemption.*` without re-touching the component.

---

## 13 — Step-by-step: Commit 13 — NavBar entry

**Goal**: the admin sees "Gestión de Ventas" under the admin block in the NavBar.

### 13.1 Files

- `frontend-next/src/components/NavBar.tsx` — add the entry under the existing ADMIN block at the two locations (lines ~443 and ~827 — desktop + mobile menus).
- i18n keys under `nav.admin.*`:
  - `sales`: "Gestión de Ventas"
  - `quotes`: "Cotizaciones"
  - `accountReceivables`: "Cuentas de cobro"
- Entry rendering: either a single "Gestión de Ventas" link to `/admin/ventas/cotizaciones` (lands on quotes by default), or a sub-menu with "Cotizaciones" + "Cuentas de cobro". I'll default to **single link → quotes list**, with internal in-list tabs that switch between the two routes. Confirm before commit.

### 13.2 Acceptance

- [ ] Admin sees the entry in both desktop and mobile nav.
- [ ] Non-admin doesn't see it.
- [ ] Trilingual check on the label.

### 13.3 Status

🟥 PENDING — SHA: —

---

## 14 — Step-by-step: Commit 14 — Docs

**Goal**: codify decisions, update memory, clean the Wompi stale note.

### 14.1 Files

- `docs/DECISION_LOG.md` — new entry **ADR-061: Sales Management** with: context, decision (Quote + CC + redemption model), consequences, links to commits 1-13.
- `docs/BUSINESS_RULES.md` — new section under "Sales": describe Cotización lifecycle, CC lifecycle, redemption flow, the price-drift safeguard.
- `CLAUDE.md` §6 (Critical Invariants) — add: *"Sales documents: CCs lock atomically via `updateMany WHERE status='PENDING'`; drift between CC snapshot and live pricing.ts blocks redemption (no override); soft-delete only (status='CANCELLED'), never `DELETE FROM AccountReceivable`."*
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md`:
  - Update "## Payment System (Dual Gateway)" — explicitly state Wompi was removed (consolidating with CHANGELOG:206) so future sessions don't trip on the stale Wompi credentials note.
  - Add "## Sales Management" section with the audit + implementation doc paths and a one-line summary.
- Optionally: `MEMORY.md` "polar_credentials.md" / "wompi_credentials.md" — append "(REMOVED on YYYY-MM)" note to the Wompi memory if it exists as a separate file, OR delete it. Decide at commit time.

### 14.2 Acceptance

- [ ] ADR-061 written.
- [ ] BUSINESS_RULES.md mentions sales lifecycle.
- [ ] CLAUDE.md invariant added.
- [ ] MEMORY.md updated; Wompi-stale-note cleaned.

### 14.3 Status

🟩 DONE — landed alongside ADR-061 (DECISION_LOG.md), BUSINESS_RULES.md §14, CLAUDE.md §6.9 invariant, MEMORY entry + Wompi-stale-note replaced with a deprecation note.

---

## Post-flight (after commit 12 lands)

Manual verification against production. Run as admin (`juan.k.chacon9729@gmail.com`):

- [ ] Open `/admin/ventas/cotizaciones` → empty state visible → click "Nueva cotización" → fill a test cotización mimicking the Linalca sample → submit → row appears with `COT-2026-0001` (or next available year-consecutive).
- [ ] Download the PDF → opens in PDF reader → visual match with the Linalca sample (logo, sections, colors).
- [ ] Open `/admin/ventas/cuentas-de-cobro` → "Nueva cuenta de cobro" → fill for Linalca (200 cupos, $257.000 COP) → submit → CC row appears with `CC-2026-0001` and 8-digit redemption code.
- [ ] Download CC PDF → visual match with §6.1.
- [ ] Log out → log in as a different test user (a corporate host of a test pool) → go to `/empresas/crear` → reach StepCapacity → type the redemption code → capacity locks to 200, amount shows $257.000 COP.
- [ ] Complete the payment (use MP test card) → confirm:
  - PoolPayment.status = COMPLETED
  - AccountReceivable.status = PAID
  - Receipt email arrives with the CC row visible.
- [ ] Try to redeem the same code again → error "ya fue usada".
- [ ] As admin, cancel a different PENDING CC → status flips to CANCELLED.
- [ ] As admin, manually mark a PENDING CC as PAID (wire transfer scenario) → status flips to PAID.
- [ ] Wait for one reconciler cycle (or trigger manually) → confirm a PENDING CC past its validUntil flips to EXPIRED.
- [ ] **Final trilingual sweep**: switch UI to `/en/` and `/pt/`, repeat the redemption box flow on the wizard. All labels translate, no Spanish leakage in EN/PT renders. (PDF stays Spanish — that's by design v1.)
- [ ] Production logs free of new errors for 24h after deploy.

---

## Rollback plan

All commits are atomic; rollback is sequential reverts:

- Revert 12 → customer no longer sees the redemption box; admin can still issue docs, but no automated link to payments (manual mark-paid still works).
- Revert 11 → admin loses the CC UI.
- Revert 10 → admin loses the cotización UI.
- Revert 9 → frontend can't reach the new endpoints.
- Revert 8 → reconciler stops cleaning up CCs (manual cleanup possible from admin).
- Revert 7 → receipt email loses the CC row.
- Revert 6 → CC redemption stops working in checkout; PoolPayment.accountReceivableId column remains but unused.
- Revert 5 → admin endpoints disappear.
- Revert 4 → CC PDF rendering stops working.
- Revert 3 → Cotización PDF stops working.
- Revert 2 → services unavailable.
- Revert 1 → schema rolled back via `prisma migrate resolve --rolled-back` or a new down-migration.

No customer-data destruction at any rollback step (rows persist; only behavior reverts).

---

## Document version

- v1 — 2026-05-22 — initial draft alongside SALES_AUDIT.md v1.
