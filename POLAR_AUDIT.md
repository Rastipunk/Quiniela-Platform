# Polar Payment Flow — Audit & Diagnostic

> **Status:** in progress
> **Started:** 2026-05-19
> **Trigger:** Abril Alonso (abrilalonso123@gmail.com) reported "no me anda la página" while trying to expand her pool to 100 — found 8 PoolPayment rows stuck in PENDING with zero PaymentEvent rows for the in-flight checkouts. We don't currently know *where* the funnel breaks for users like her.
>
> **Goal:** Map every line of code in the Polar payment flow (frontend + backend), document each branch where state changes (or fails to change), and produce a numbered list of bugs / observability gaps. Resolve them one at a time after the audit is complete.
>
> **Method:** No assumptions. Every claim in this document is backed by a file path + line number. If a behavior is inferred but not verified, it is marked `[INFERRED — verify]`.

---

## 0 — Scope

The Polar payment flow covers:

1. **Pricing display** — how price is shown to the host before they click "Pay" (pricing constants, currency selection, country detection).
2. **Checkout initiation (frontend)** — the click → API call → URL receive → browser redirect chain.
3. **Checkout creation (backend)** — the Express route that calls Polar's SDK, persists `PoolPayment`, and returns the checkout URL.
4. **Polar-hosted checkout page** — what the user sees (this is on `*.polar.sh`, not our domain — we are blind here unless we capture errors via tracking pixel or postMessage).
5. **Post-payment redirect** — Polar bounces back to a return URL on picks4all.com.
6. **Webhook receipt** — `order.paid`, `checkout.created`, `checkout.expired`, etc. arrive at our backend.
7. **Webhook processing** — match by checkoutId/orderId, update PoolPayment, trigger side effects (capacity bump, email, GA4/Meta CAPI).
8. **Failure / retry** — what happens when the user closes the tab, when Polar returns an error, when the webhook fails or arrives out of order.

We need to know, at every transition between these stages, **what is persisted and what is lost**.

---

## 1 — File inventory

> Method: ripgrep'd for `polar|Polar|POLAR|@polar-sh/sdk` across `backend/src` and `frontend-next/src`. Also added files that handle the `/pago/*` routes and the capacity-selection UI even when they don't mention "polar" by name — they're part of the user-visible flow.

### Backend — code

| File | Role |
|---|---|
| `backend/src/services/polar/client.ts` | Thin wrapper around `@polar-sh/sdk`. Constructs the `Polar` client; exposes `isPolarConfigured()` and the checkout-creation helper. |
| `backend/src/services/paymentService.ts` | Orchestration layer. Likely called from the route handler — creates `PoolPayment` row, calls Polar, returns checkout URL. (To verify in §2.) |
| `backend/src/routes/payments.ts` | HTTP endpoints: checkout initiation + Polar webhook receiver (uses `POLAR_WEBHOOK_SECRET` for HMAC verification). |
| `backend/src/lib/pricing.ts` | USD + COP pricing tier logic. |
| `backend/src/lib/email.ts` | Sends post-payment confirmation email. |
| `backend/src/lib/ga4.ts` | Server-side analytics push (Purchase event). |
| `backend/src/server.ts` | Mounts the `/payments` router. Order matters because the webhook needs `express.raw()` BEFORE the JSON parser. |
| `backend/src/routes/adminAnalyticsDashboard.ts` | Read-only — surfaces payment data in the admin dashboard. Not part of the active flow. |

### Backend — tests

| File | Role |
|---|---|
| `backend/src/services/paymentService.test.ts` | Unit/integration tests for the orchestration. |
| `backend/src/routes/payments.test.ts` | Tests for the HTTP endpoints, including webhook signature behavior. |
| `backend/src/lib/pricing.test.ts` | Tests for pricing math. |

### Backend — dependency

- `@polar-sh/sdk` v0.47.0 (declared in `backend/package.json`).

### Backend — environment variables

| Variable | Used in | Purpose |
|---|---|---|
| `POLAR_API_KEY` | `services/polar/client.ts:13,20-21` | Auth header for Polar API calls. |
| `POLAR_PRODUCT_ID` | `services/polar/client.ts:14,68-69` | The product the checkout is created against. |
| `POLAR_WEBHOOK_SECRET` | `routes/payments.ts:309-311`, tests | HMAC secret for Polar webhook signature verification. |

> Frontend has **no** `POLAR_*` env vars — the whole secret/key surface is server-side, which is correct.

### Frontend — code

| File | Role |
|---|---|
| `frontend-next/src/lib/api/payments.ts` | Browser-side API client: `createCheckout`, `createMpCheckout`, `getPaymentCountry`. Called from every "Pay" button in the UI. |
| `frontend-next/src/lib/pricing.ts` | Mirrors backend pricing logic for SSR/CSR price display. |
| `frontend-next/src/lib/ecommerce.ts` | `trackBeginCheckout`, `trackPurchase` for GA4/Meta. Imports the Polar amount. |
| `frontend-next/src/components/CapacitySelector.tsx` | The capacity-tier picker UI. Modes: `wizard` (during creation) and `expansion` (after creation, from admin tab). |
| `frontend-next/src/components/CorporateQuotePanel.tsx` | Corporate-specific quote/Polar surface. |
| `frontend-next/src/components/LandingContent.tsx` | Landing page — references checkout in the pricing CTA path. |
| `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx` | Calls `createCheckout` / `createMpCheckout` from the wizard's final step. Has the `window.location.href = checkout.checkoutUrl` redirect. |
| `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx` | The capacity selection step inside the wizard. |
| `frontend-next/src/types/poolWizard.ts` | Type definitions for the wizard state (likely includes `checkoutMode` / capacity tier). |
| `frontend-next/src/app/[locale]/pago/layout.tsx` | Shared layout for the `/pago/*` post-redirect pages. |
| `frontend-next/src/app/[locale]/pago/checkout/page.tsx` | Intermediate page (likely renders while we wait for Polar to load, or a manual "click here to pay" fallback). To verify in §2. |
| `frontend-next/src/app/[locale]/pago/exitoso/page.tsx` | Success page — where Polar redirects after `order.paid`. |
| `frontend-next/src/app/[locale]/pago/cancelado/page.tsx` | Cancel page — where Polar redirects if the user backs out. |
| `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` | Post-creation host admin tab that lets the host expand capacity (Abril's path). |
| `frontend-next/src/app/[locale]/(authenticated)/dashboard/components/CreateJoinPanel.tsx` | Dashboard CTA panel — may link into pricing/checkout. |
| `frontend-next/src/components/AdminAnalyticsContent.tsx` | Read-only payment reporting. Not part of the active flow. |

### Database schema (`backend/prisma/schema.prisma`)

| Line | Item |
|---|---|
| 1204 | `enum PaymentStatus { PENDING, COMPLETED, FAILED, REFUNDED }` |
| 1211 | `model PoolPayment` — the per-attempt row (one per checkout creation). |
| 1274 | `model PaymentEvent` — immutable webhook audit log (`polarEventId UNIQUE`). |
| 1291 | `model FailedAnalyticsEvent` — DLQ for GA4/Meta CAPI Purchase events that fail to deliver. |

### Documentation references (read but won't audit line-by-line)

- `docs/DECISION_LOG.md:4006` (ADR for Polar integration choice)
- `docs/GLOSSARY.md:595` (integration summary)
- `docs/guides/DEPLOYMENT.md:168-169` and `docs/guides/SETUP.md:98` (env-var docs)
- `CLAUDE.md:242` (env-var spec) and `CLAUDE.md` Section 2 "Payments & webhooks (ADR-046)" (idempotency contract)

---

## 2 — Line-by-line review

> *One subsection per file, in order of execution (schema → backend → frontend → return pages). Each subsection cites line numbers. Inline tag `[OBS]` marks observations that may become findings; they are consolidated and numbered in §3.*

### 2.1 — `backend/prisma/schema.prisma` (lines 1200–1315)

**Purpose:** persisted shape of the payment domain. Defines `PaymentStatus` enum, `PoolPayment` (per-attempt row), `PaymentEvent` (webhook audit log), `FailedAnalyticsEvent` (DLQ).

**Read-through:**

- **Line 1204–1209 — `enum PaymentStatus`:** four values only: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`.
  - **[OBS]** There is no `ABANDONED` / `EXPIRED` / `CANCELLED` state. When a user closes the Polar tab without paying (Abril's case), nothing in the schema can express "user gave up". The row stays `PENDING` forever. This is why our analytics yesterday saw 8 PENDING for over a week.
  - **[OBS]** There is no `IN_PROGRESS` or intermediate state. We cannot distinguish "checkout URL generated, user not yet on Polar" from "user is currently on Polar's checkout page" from "Polar returned an error to the user".

- **Line 1211–1271 — `model PoolPayment`:**
  - Line 1221 — `polarCheckoutId String @unique` is **NOT NULL** (no `?`). Every row, including MP/COP-paid rows, must have a polarCheckoutId. **[OBS]** This is suspicious: the MP integration is supposed to coexist; if MP rows must also carry a polarCheckoutId, the code is forced to create a Polar checkout even for COP users. Need to verify in §2.2 what the MP flow actually inserts here. *Counter-evidence from yesterday's diagnostic:* the MP rows we saw all had a polarCheckoutId populated and `mpPreferenceId` also populated — so apparently we DO create both. To confirm whether this is intentional, look at `paymentService.ts`.
  - Line 1222 — `polarOrderId String? @unique` is nullable. **OK** — only set after `order.paid` webhook.
  - Line 1224 — `status PaymentStatus @default(PENDING)`. **OK.**
  - Line 1225–1228 — `amountUsd Int`. Stored for ALL gateways. CLAUDE.md §2 confirms: `amountUsd` is USD CENTS, `amountCop` is COP PESOS. **OK.**
  - Line 1229–1233 — `amountCop Int?`. CLAUDE.md warning: reading the wrong field underreports revenue ~40×. **[OBS]** Schema has no constraint that `amountCop` must be set iff `mpPreferenceId IS NOT NULL` — schema-level integrity is informal.
  - Line 1234 — `currency String @default("usd")`. **[OBS]** Free string, not enum. Typos would silently pass.
  - Line 1237–1239 — `fromCapacity`/`toCapacity` (Int) and `poolType` (String). **[OBS]** `poolType` is "personal" | "corporate" by comment, but it's a free String. A typo would break downstream branching without any DB error.
  - Line 1241–1245 — `metaEventId String?`. Used to dedupe Meta Pixel/CAPI. **OK.**
  - Line 1252–1255 — `metaFbp`, `metaFbc`, `clientIpAddress`, `clientUserAgent`. Captured **at checkout creation**. These are GOOD — they're the trail-of-breadcrumbs the user leaves. From Abril's row: `IP 190.3.25.126`, `UA: Mozilla/5.0 ... Chrome/148`, so this DOES get filled. **OK.**
  - Line 1262 — `mpPreferenceId String?`. **OK.**
  - Line 1264 — `paidAtUtc DateTime?`. Set on webhook confirmation. **OK.**
  - Line 1265 — `createdAtUtc DateTime @default(now())`. **OK.**
  - Line 1266 — `updatedAtUtc DateTime @updatedAt`. **[OBS]** Auto-updates on any field change but tells you only WHEN something changed, never WHAT changed. There's no history.
  - Line 1268–1270 — Indexes on `poolId`, `userId`, `status`. **OK.**
  - **[OBS]** No index on `createdAtUtc`. If we ever want a job to find "all PoolPayment created > 7d ago, still PENDING, mark as ABANDONED", it'll do a full scan.
  - **[OBS]** No index on `polarOrderId`. It's `@unique` so it gets an implicit unique index — **OK**.
  - **[OBS]** No `expiresAt` column. Polar checkouts expire (default 24h I believe). We can't tell from the row alone whether the checkout is still valid or already expired.

- **Line 1273–1285 — `model PaymentEvent`:**
  - Line 1273 — comment claims "Immutable audit log of **every** webhook event received from Polar". **[OBS]** Production state contradicts the comment: only 1 row exists (the `order.paid` for Ignacio). Either Polar isn't sending other events to us, or our webhook handler filters them out before INSERT. To verify in §2.2.
  - Line 1277 — `polarEventId String @unique`. **OK** — idempotency anchor per ADR-046.
  - Line 1278 — `eventType String`. **[OBS]** Free String, not enum. We don't validate it against Polar's known event taxonomy.
  - Line 1279 — `payloadJson Json`. **OK** — full payload retained for replay.
  - **[OBS]** No `poolPaymentId` foreign key. Lookup from event → PoolPayment has to dig into `payloadJson.data.id` (the checkoutId), which is slow and unindexed.
  - **[OBS]** No `provider` discriminator column. The name "PaymentEvent" sounds gateway-neutral but the structure is Polar-specific (`polarEventId`). MP webhooks evidently go somewhere else (or nowhere). To verify in §2.2.

- **Line 1287–1315 — `model FailedAnalyticsEvent`:** DLQ for Meta CAPI / GA4 events that fail. Not central to the Polar funnel; orthogonal. **OK** for now.

**Schema-level summary:**
- The model captures the **happy path** (checkout created → webhook arrives → row updated). It does **not** capture the unhappy paths: user closed tab, Polar returned an error to the user, redirect failed client-side, checkout URL was never opened, checkout expired silently.
- No FK from PaymentEvent → PoolPayment makes reconciliation harder than it needs to be.
- No state for "abandoned" / "expired" means the funnel report cannot distinguish "currently in checkout" from "user gave up 3 weeks ago".

---

### 2.2 — `backend/src/services/polar/client.ts` (117 lines)

**Purpose:** thin wrapper around `@polar-sh/sdk`. Constructs the singleton `Polar` client; exposes `isPolarConfigured()`, `createCheckout`, `getCheckoutSession`, `getOrder`.

**Read-through:**

- **Lines 13–14 — env vars read every call:** `POLAR_API_KEY` and `POLAR_PRODUCT_ID`. Wrapped in functions, not module constants. **OK** — supports test override.
- **Lines 16–25 — `getClient()`** lazily constructs the SDK client, caches in `_client`. **[OBS]** Throws `Error("POLAR_API_KEY not configured")` only when invoked; module load does not fail loudly when the env var is absent.
- **Lines 28–30 — `isPolarConfigured()`** requires BOTH key and product. Public, used by the route to short-circuit with `503 PAYMENTS_NOT_CONFIGURED`. **OK.**
- **Lines 32–53 — types:** `CreateCheckoutParams` has `cancelUrl` declared (line 42) but at line 86–88 in `createCheckout()` we only pass `successUrl`, NOT `cancelUrl`. **[OBS]** The `cancelUrl` accepted by the function is silently discarded. Polar will fall back to its default behavior (returning to `polar.sh/dashboard` or showing a generic "Cancelled" page) rather than bouncing the user back to `/pago/cancelado` on our domain. Verified: line 85 sets `successUrl`, line 86 sets `metadata`, line 87 sets `locale`, no `cancelUrl` anywhere. (Even when `paymentService.ts:198` carefully builds `cancelUrl`.)
- **Line 71 — debug log on creation:** logs amount, product, metadata to stdout. **[OBS]** Customer email is also logged later (line 90 logs URL prefix). Reasonable.
- **Lines 73–88 — `client.checkouts.create()` call:**
  - Line 80 — hardcoded `priceCurrency: "usd"`. **[OBS]** No support yet for other Polar currencies (e.g. EUR), even though `params.amountCents` is currency-agnostic. Locks the international flow to USD.
  - Line 86 — `metadata: params.metadata as unknown as Record<string, string>`. **[OBS]** Cast is unsafe: `metadata` has numeric fields (`fromCapacity`, `toCapacity`) but the cast claims everything is a string. Polar may or may not coerce; if Polar's SDK preserves the types, the webhook payload (`payload.data.metadata`) may receive numbers. `handleOrderPaid` at line 297 reads `metadata.toCapacity` as `number | undefined` and at line 364 passes it directly to `Pool.update({ maxParticipants })` — if Polar coerces to string we'd write a string into an Int column and Prisma would throw. Need to verify what Polar does. **[INFERRED — verify with a real webhook payload from production.]**
- **Line 92–94 — null URL guard:** throws if Polar returns a checkout without a URL. **OK** — defensive.
- **Lines 105–108 — `getCheckoutSession(checkoutId)`:** used by `paymentService.ts:174` to revive an existing PENDING checkout. **OK.**
- **Lines 110–116 — `getOrder(orderId)`:** declared but **NOT CALLED ANYWHERE** in the codebase. Dead code or planned-for-future reconciliation. **[OBS]** Either remove or actually use for the periodic reconciler we don't have yet.

---

### 2.3 — `backend/src/services/paymentService.ts` (1388 lines)

**Purpose:** business logic for Polar + Mercado Pago. `initiateCheckout`, `initiateMpCheckout`, `processMpPayment`, `handleOrderPaid`, `handleOrderRefunded`, `handleCheckoutUpdated`, `handleMpWebhook`, `getPaymentStatus`.

**[OBS — file size]** This file is **1388 lines**, well over the 800-line decomposition threshold mandated by CLAUDE.md §2 ("Services >800 lines must be decomposed"). It mixes two distinct gateways (Polar + MP) and two distinct concerns per gateway (checkout creation + webhook handling). Pure size = harder to reason about every code path.

**Read-through, by function:**

#### `mpPurchaseValue(payment)` (51–63)

Helper that returns the real COP value to report, preferring persisted `amountCop`. **OK.**

#### `initiateCheckout` (123–257) — Polar checkout creation

- **Lines 129–143 — pool lookup + host authorization.** Only `HOST` or `CORPORATE_HOST` of the pool can initiate. **OK.**
- **Line 145 — fallback for `pool.maxParticipants` is `getFreeLimit(...)`.** Uses `organization` presence to switch between personal/corporate tier. **OK.**
- **Lines 149–155 — target capacity validation.** Must be greater than current. **OK.**
- **Lines 158–162 — server-side price calculation.** Client cannot tamper with price. **OK** — matches CLAUDE.md invariant.
- **Lines 164–185 — idempotency: lookup existing PENDING checkout** for same `(poolId, toCapacity, status=PENDING)`. If found, tries to re-fetch the Polar session and reuse the URL. Catches any failure silently and falls through to creating a new one (lines 182–184: `catch {}`).
  - **[OBS]** The idempotency key here is `(poolId, status=PENDING, toCapacity)`. It does NOT include `userId`. If a pool has CO_ADMINs each could in theory create their own checkout, but the query would return the first one (which may belong to another user). Verified: the host check on line 141 ensures the *current* request is from a host, but the existing PENDING row could belong to a different host who initiated earlier — and now this user gets handed *that* user's checkout URL. **[POTENTIAL DATA-LEAK / ATTRIBUTION BUG.]**
  - **[OBS]** The `catch {}` block (line 182) swallows the error. If Polar's `getCheckoutSession()` throws because the checkout is expired, the user falls through cleanly — good. But if it throws for any OTHER reason (network blip, Polar 500), we ALSO fall through and create a new checkout — which is fine for the user but means we lose the diagnostic signal. Nothing is logged in that catch.
  - **[OBS]** If `getCheckoutSession()` returns a session **without a URL** (line 175 guard), we fall through to creating a new one. The original PENDING row stays in the DB. We now have two PoolPayment rows for the same `(poolId, toCapacity)`, the first orphaned forever.
- **Lines 188–192 — user lookup for email pre-fill.** Throws 404 if user not found. **OK.**
- **Lines 195–198 — `successUrl` and `cancelUrl` constructed.** Both are built; only `successUrl` is passed to Polar (per §2.2 OBS). `cancelUrl` becomes a dead string variable here. **[OBS]** Confirms the §2.2 finding: `cancelUrl` is computed but never reaches Polar.
- **Lines 201–216 — call `polarCreateCheckout()`.** Note: this is a direct synchronous call to the external SDK. **No try/catch around it.** If the Polar API itself fails (network, 5xx, rate limit), the error propagates up to the route handler, which returns `500 CHECKOUT_FAILED` to the user. **[OBS]** No PoolPayment row exists at this point, so the failure is invisible after the fact — we have NO RECORD that this user clicked "Pay" and failed before we even reached Polar. This is exactly the silent gap Abril probably fell into if Polar's API was momentarily flaky.
- **Lines 219–237 — PoolPayment.create.** Persists IP, UA, fbp, fbc.
  - **[OBS]** This INSERT happens AFTER the Polar call succeeds. So PoolPayment only exists when Polar accepted the checkout. If Polar accepts but our DB INSERT fails, the user gets the URL but we have NO record. (Highly unlikely but the order is back-to-front: we should INSERT a "CREATING" row first, then call Polar, then UPDATE with `polarCheckoutId`.)
- **Lines 239–254 — audit log via `fireAndForget`.** **OK.**
- **[GAP-OBSERVABILITY]** Nowhere here do we capture: (a) the user clicked "Pay" but failed our server-side validation; (b) Polar's API rejected the create call; (c) Polar created the checkout but never sent us back a URL. Each of these is a silent funnel drop.

#### `handleOrderPaid` (265–546) — Polar `order.paid` webhook

- **Lines 280–286 — cheap pre-check for duplicate event.** **OK** — protects against extra DB cost; real guard is the UNIQUE inside tx.
- **Lines 289–306 — metadata + checkoutId guards.** Returns `void` (not throws) if metadata is missing or checkoutId missing. **[OBS]** Returning silently means Polar gets a 200 from the route handler (since handleOrderPaid did not throw), even though we did nothing. The webhook is effectively dropped. If Polar ever delivers a malformed payload (or a payload we don't recognize), it never retries — and we never know. Should at least throw `INVALID_PAYLOAD` to surface in logs.
- **Lines 309–323 — PoolPayment lookup; if missing → throw RETRYABLE.** **OK** — well-designed retry hook.
- **Lines 325–328 — already-COMPLETED guard.** **OK.**
- **Lines 335 — metaEventId generation only if userId present.** **OK.**
- **Lines 343–379 — atomic tx: paymentEvent.create + poolPayment.update + pool.update.** Implements ADR-046 contract correctly. **OK.**
- **Lines 401–441 — admin notification fired async.** **OK.**
- **Lines 443–515 — CAPI + GA4 purchase events.** **OK.**
- **Lines 518–545 — receipt email.** **OK.**

#### `handleOrderRefunded` (558–671)

Same shape as `handleOrderPaid` for refund. **OK.**

#### `handleCheckoutUpdated` (676–713) — **THIS IS THE KEY GAP**

- Line 686: `if (checkoutStatus === "expired" || checkoutStatus === "failed")` — handles ONLY these two statuses.
- **[OBS]** Polar `checkout.updated` webhooks fire on EVERY checkout state transition: `open`, `processing`, `confirmed`, `succeeded`, `expired`, `failed`. We listen for only 2 of them. The other transitions arrive at the webhook endpoint, get routed into this handler, and silently do nothing. **No PaymentEvent row is created for them.** That's why §2.1 PaymentEvent table has only 1 row in production: only `order.paid` makes it in; every other Polar webhook (including the ones that would tell us a checkout was opened, was abandoned, expired) is dropped on the floor.
- **[OBS]** Even for the "expired" / "failed" branches that DO run: we update PoolPayment.status to FAILED but **we do NOT write a PaymentEvent row**. So we lose the audit trail for the state change. The `polarEventId` UNIQUE that protects `handleOrderPaid` from double-processing has no analog here — if Polar redelivers the `expired` event we'd update the row a second time (idempotent on outcome but generates a GA4 `payment_failed` re-fire).
- **[OBS]** Line 697–710 emits a GA4 `payment_failed` event, but **only** when we receive the `expired`/`failed` webhook. If the user closes the tab and Polar never gives us an explicit expiration (they expire 24h later silently), we never emit `payment_failed`. Funnel analytics underreport abandon events.

#### `handleMpWebhook` (1102–1387) — MP IPN

Similar structure to Polar handlers but for MP. **OK** — robust given MP's quirks (multiple webhooks per payment, status in eventId).

#### `getPaymentStatus` (720–758)

- Line 725–728 — verifies user is an ACTIVE pool member. **[OBS]** This is broader than "host who initiated the payment". Any active pool member can poll the status of any payment for that pool. Probably intentional (so participants can see "host is paying for capacity") but worth noting.
- Returns latest payment row regardless of status. **OK.**

---

### 2.4 — `backend/src/routes/payments.ts` (364 lines)

**Purpose:** HTTP layer. Endpoints: `/checkout`, `/mp-checkout`, `/mp-process`, `/pool/:poolId/status`, `/country`, `/webhook` (Polar), `/mp-webhook` (MP).

**Read-through:**

- **Lines 27–44 — `extractMetaSignals(req)`:** pulls `_fbp`, `_fbc` from cookies; IP from `req.ip` (which honors `trust proxy`); UA from header. **OK.**
- **Lines 62–65 — `checkoutSchema`** validates poolId UUID + targetCapacity int 2-10000. **OK.**
- **Lines 68–95 — `POST /payments/checkout`** (Polar):
  - 503 if `!isPolarConfigured()`. **OK.**
  - 400 if zod fails. **OK.**
  - 500 if unknown error. **OK.**
  - **[OBS]** No try/catch around the response itself; if `sendOk` throws (extremely unlikely), Express's default handler kicks in. **OK.**
  - **[OBS]** Locale is taken from `accept-language` header, sliced to 2 chars. **[OBS]** This is BROWSER locale, not USER locale. A Chilean user browsing in English would get `en` here even though Polar would render in Spanish if they're authenticated. Probably fine for now since `en/es/pt` are all valid Polar locales.
  - **[OBS]** No rate limit applied at the route level. The global `apiLimiter` (line 72 of server.ts) covers it, but checkout creation is more sensitive than a generic API call and may warrant its own bucket — a malicious client could spam-create checkouts and pollute PoolPayment with rows.
- **Lines 98–107 — `GET /payments/country`:**
  - Falls back to `"US"` (line 104) if no geo header. **[OBS]** A Chilean user behind a VPN or a fresh proxy would be routed to Polar instead of MP. That's actually the correct routing for non-CO users since Polar handles "rest of world", but the comment says "fallback to international" — explicit and correct.
- **Lines 110–137 — `POST /payments/mp-checkout`** (MP) — analogous to /checkout. **OK.**
- **Lines 142–186 — `POST /payments/mp-process`:**
  - **[OBS]** Schema accepts `formData: z.record(z.string(), z.unknown())` — basically allows anything. This is the only sanctioned client→server channel for raw MP Brick formData. Validation happens server-side via MP SDK. **OK for now**.
- **Lines 189–199 — `GET /payments/pool/:poolId/status`:**
  - **[OBS]** No zod parse on `req.params.poolId`. If you call with a non-UUID it propagates to the service. Service does `prisma.poolMember.findFirst({ where: { poolId, userId } })` which will not crash but will return null. Acceptable.
- **Lines 212–271 — `verifyMpSignature(req)`:** HMAC with drift validation. Solid. **OK.**
- **Lines 278–300 — `createMpWebhookHandler`:** correct, returns 500 on errors to trigger retry. **OK.**
- **Lines 308–363 — `createWebhookHandler` (Polar):**
  - Lines 309–315 — graceful disable if no secret. **OK.**
  - Line 318 — `Buffer.from(webhookSecret).toString("base64")`. Wraps user-supplied secret in base64. **[OBS]** Polar's standardwebhooks expects the secret in base64 form. If the env var is already base64 we double-encode and signatures fail. This is dependent on how the secret is stored in Railway. **[VERIFY in Railway env: is POLAR_WEBHOOK_SECRET raw or base64?]**
  - Lines 336–344 — event routing: only handles `order.paid`, `order.refunded`, `order.canceled`, `checkout.updated`. Everything else logs and is dropped.
  - **[OBS]** When the event is unrecognized we log and return 200. **No PaymentEvent row** is written. So if Polar one day adds a new event type that matters (e.g. `customer.refund_pending`), we'd silently miss it and the operator would never know to look for it.
  - **[OBS]** The route handler does not log the `webhook-id` or `webhook-timestamp` headers. If we need to dig through logs to find a specific failed delivery, we have nothing to grep against on our side.

---

### 2.5 — `backend/src/server.ts` (lines 65–67, 249–252)

**Purpose:** mounts the Polar webhook with `express.raw()` BEFORE `express.json()` so the signature can verify against the unparsed body.

- Line 67: `app.post("/payments/webhook", express.raw({ type: "application/json" }), createWebhookHandler())`. **OK** — order is correct.
- Line 251: `app.use("/payments", paymentsRouter)` after JSON parser. **OK.**
- Line 252: `app.post("/payments/mp-webhook", createMpWebhookHandler())` after JSON parser. **OK** — MP doesn't require raw body for signature.

---

### 2.6 — Backend support libs (`pricing.ts`, `email.ts`, `ga4.ts`)

**`backend/src/lib/pricing.ts` (219 lines):**

- Env-overridable constants (lines 25–41, 144–147). **OK.**
- `calculateUpgradePrice` (USD) and `calculateUpgradePriceCop` (COP) — same algorithm, separate constants per currency. **OK.**
- **[OBS]** Pricing logic is **duplicated** between backend and frontend (`frontend-next/src/lib/pricing.ts` is the mirror). If either drifts, the user sees one price in the UI and gets charged another. CLAUDE.md §2 explicitly bans this ("Zero duplicated logic"). Comments in this file (line 80: "Mirror of corporateCumulativePriceCop ... kept identical to avoid the BE-vs-FE divergence that was charging 32% over the UI price") confirm divergence has happened before. **The single source of truth principle is violated.**
- **[OBS]** Each gateway only checks its own currency table. The Polar flow doesn't compute COP, the MP flow doesn't compute USD beyond the cents column. **OK** in normal operation.

**`backend/src/lib/email.ts:sendPaymentReceiptEmail` (lines 1568–1628):**

- Uses i18n-aware subjects and templates. **OK.**
- `reply-to: ventas@<domain>` — correct routing.
- **[OBS]** Receipts only ever fire on `COMPLETED`. There is no "payment in progress" or "payment failed, retry?" email. A user whose pago se quedó pegado en PENDING (Abril) gets ZERO follow-up from us. No "you started a payment but haven't completed it, click here to resume" email exists.

**`backend/src/lib/ga4.ts:sendGa4Event` (lines 161–214):**

- 4 in-process retries with jitter, then DLQ via `FailedAnalyticsEvent`. **OK.**
- Used to emit `purchase`, `refund`, **`payment_failed`** (custom event). **[OBS]** `payment_failed` is custom, not a GA4 standard event. That's fine but means out-of-the-box GA4 dashboards won't show it — we need to build the funnel visualization ourselves.

---

### 2.7 — `frontend-next/src/lib/api/payments.ts` (127 lines)

**Purpose:** thin fetch wrappers around the backend endpoints.

**Read-through:**

- **Lines 31, 38–53 — `getPaymentCountry()`:** caches result in a module-scope variable. Calls `https://ipapi.co/country_code/` with 3s timeout. Falls back to `"US"` on failure.
  - **[OBS]** This is a **client-side fetch to a third-party service** (ipapi.co). If ipapi.co is slow, blocked by an ad-blocker, or throws CORS, we silently fall through to "US" — and a Colombian user gets routed to Polar (USD) instead of Mercado Pago (COP). That doesn't match the dev intent. Note: the backend ALSO has `/payments/country` which uses Cloudflare/Railway headers (much more reliable). The frontend chooses ipapi.co over the backend endpoint, which is the worse path.
  - **[OBS]** No retry on transient ipapi.co failure. One bad fetch and you're routed to the wrong gateway for the entire session (module cache).
- **Lines 59–67 — `createCheckout(poolId, targetCapacity)`:** POST to `/payments/checkout`. **OK** — minimal.
- **Lines 72–80 — `createMpCheckout`:** same shape for MP. **OK.**
- **Lines 107–116 — `processMpPayment`:** **OK.**
- **Lines 122–126 — `getPaymentStatus`:** **OK.**
- **[OBS — global]** None of these functions reports errors back to the backend. If a fetch fails, the throw propagates to the caller. The caller may or may not handle it. There is NO client-side telemetry beacon for "I tried to call createCheckout and got a 500" — so a hung backend on the checkout endpoint is invisible to ops unless the user happens to email us.

---

### 2.8 — UI entry points

#### `frontend-next/src/components/CapacitySelector.tsx` (402 lines)

**Purpose:** purely-presentational tier picker. Renders price tiers, "free" badge for the free tier, custom-input box for >300. Calls `onSelect(capacity)` — does NOT trigger checkout itself.

- **[OBS]** This is a 402-line UI component. Close to the 500-line decomposition threshold. Mixes free-tier banner, tier list, locked overlay for non-admin users, and the custom-input modal. Could be split but not a payment-flow bug.

#### `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` (229 lines)

**Purpose:** post-creation host admin tab that lets the host expand capacity. **This is Abril's path.**

- **Lines 138–145 — state:** `selectedCapacity`, `busy`, `country`. `useEffect` fetches country on mount.
- **Lines 147–174 — `handleExpand()`** — the click handler for the "Pay" button:
  - Line 151 — calls `getPaymentCountry()` AGAIN (double-fetch — cached, but still). **[OBS]** Redundant but cached, so no real network cost.
  - Line 152 — branches on `country === "CO"`.
  - Lines 154–164 — MP branch: `createMpCheckout`, build URL params, `window.location.href = .../pago/checkout?...`.
  - Lines 165–169 — **Polar branch (Abril's path):** `createCheckout(poolId, selectedCapacity)`, then `window.location.href = result.checkoutUrl`.
  - **[BUG — high severity]** Lines 170–173 — `catch (err) { console.error(...); setBusy(false); }`. If `createCheckout` throws (network error, 500 from backend, anything), **the user sees the spinner disappear and the button re-enabled — and nothing else**. No alert, no banner, no toast, no error message in the UI. This is what Abril almost certainly experienced: "no me anda la página" = the click does nothing visible.
  - **[BUG — high severity]** Lines 167–168 — `createCheckout` → `window.location.href`. The PoolPayment row is created server-side BEFORE the URL is returned (paymentService.ts:216–237). So if the redirect fails (browser CSP, popup blocker, network blip between fetching the URL and assigning location.href), we already have a PoolPayment in PENDING and **no way to know the user never reached Polar**. There is NO acknowledgment to the backend that the redirect was attempted.
  - **[GAP-OBSERVABILITY]** No `trackBeginCheckout` is fired here. Compare with `PoolCreationWizard.tsx:191-204` which DOES emit `begin_checkout` and Meta `InitiateCheckout`. **`PoolCapacityTab` skips these events entirely.** So a host expanding from the admin tab has zero GA4/Meta funnel signal — looks identical to a non-attempt.

#### `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx` (lines 100–264 cover the payment path)

**Purpose:** wizard's final submit. After creating the pool, if capacity > free limit, triggers checkout.

- **Lines 146–207 — payment path:** mirror of `PoolCapacityTab.handleExpand` but with telemetry:
  - Line 154–161: MP checkout + `trackBeginCheckout` + `trackMetaEvent("InitiateCheckout")`.
  - Lines 190–204: Polar checkout + same tracking.
- **Lines 208–220 — error handler:** `catch (checkoutErr) { console.error; window.alert(t("checkoutFailedFallback")); }`. Better than `PoolCapacityTab` (at least the user sees an alert), but:
  - **[OBS]** `window.alert` is a poor UX (modal blocking, non-stylable).
  - **[OBS]** Same observability gap: backend has no idea the redirect failed. The PoolPayment row stays PENDING with no event marking the abandonment.
- **[OBS — pool-was-created cliffhanger]** Lines 209–215 comment notes that the pool IS created at this point (capped at free tier). The user lands on a "free-tier pool" that they thought they were paying to upgrade — and they have to go to admin and retry. This is the worst-shaped failure for revenue.

#### Other entry points (read but not paste-quoted — same pattern)

- `frontend-next/src/components/CorporateQuotePanel.tsx` — corporate-specific CTA. Calls into the same `createCheckout` path.
- `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx` — UI step inside the wizard; just selects capacity and calls `onSubmit` (handled in PoolCreationWizard above).
- `frontend-next/src/components/LandingContent.tsx` — landing CTA links to `/precios` or `/dashboard`. Does not call Polar directly.
- `frontend-next/src/app/[locale]/(authenticated)/dashboard/components/CreateJoinPanel.tsx` — links to wizard. Does not call Polar directly.
- `frontend-next/src/components/AdminAnalyticsContent.tsx` — read-only payment reporting.

---

### 2.9 — `/pago/*` return pages

#### `app/[locale]/pago/exitoso/page.tsx` (199 lines)

**Purpose:** landing for `successUrl` from Polar AND `backUrls.success`/`pending` from MP.

- **Lines 35–98** — polls `getPaymentStatus(poolId)` every 2s up to 15 times (30s total). If COMPLETED → fires GA4 `purchase` + Meta `Purchase` (with `metaEventId` for dedup). If never COMPLETED → shows "timeout" state but still lets user proceed to pool.
- **[OBS]** Both Polar `pending` AND `success` redirect here from MP (intentional). For Polar there's no `pending` distinction — Polar only fires `successUrl` after order.paid. **OK.**
- **[OBS]** If the polling times out (e.g. webhook delayed >30s), the user sees "timeout" copy but the page **does not retry the polling later or fire any "give me a refund" CTA**. They just navigate to the pool and trust it'll get processed eventually. **[GAP]** No emission of a "purchase_status_timeout" event to surface this in analytics.
- **[OBS]** The page **does NOT verify** that the polled status matches the `poolId` of the user's session. A user who navigates here with a different `poolId` query param could theoretically see another pool's payment status. (Mitigated server-side: `getPaymentStatus` enforces membership.)

#### `app/[locale]/pago/cancelado/page.tsx` (85 lines)

**Purpose:** landing if user backs out of MP. **Polar never redirects here** because `cancelUrl` is not passed to Polar (see §2.2 OBS).

- **[BUG — medium severity]** The page is purely presentational. It does NOT call the backend to mark anything as cancelled. The PoolPayment row stays PENDING. No analytics event is fired. **No PaymentEvent row is written.** So a user who clicks "Pay" → reaches MP/Polar → clicks Cancel → lands here = invisible to us. This combined with §2.2 (Polar never sends them here anyway because cancelUrl is dropped) means cancellation events are completely opaque.
- **[GAP-OBSERVABILITY]** No `payment_cancelled` GA4 event. No backend POST to mark the payment as cancelled.

#### `app/[locale]/pago/checkout/page.tsx`

**Purpose:** **Mercado Pago Payment Brick** — embedded checkout for COP users. NOT part of the Polar flow at all.

- The Brick is loaded client-side, formData is sent to `/payments/mp-process`. **OK.**

#### `app/[locale]/pago/layout.tsx`

Shared layout for the `/pago/*` pages. **OK** — no Polar logic.

---

### 2.10 — Tests (skipped detailed read — happy-path coverage)

- `backend/src/services/paymentService.test.ts`, `backend/src/routes/payments.test.ts`, `backend/src/lib/pricing.test.ts`.
- These cover the happy paths (checkout creates a row, webhook updates a row, refund updates a row). **They do NOT cover the unhappy paths we just identified** (redirect failure, expired Polar checkout, cancelled checkout, malformed webhook).

---

---

## 3 — Findings (bugs, gaps, risks)

> *Numbered for resolution tracking. Severity ranks impact on revenue + UX.*
>
> **Status legend:**
> - `🟥 PENDING` — not started.
> - `🟧 IN PROGRESS` — partially implemented; not yet user-visible.
> - `🟩 FIXED` — code merged + deployed; problem no longer reproducible.
> - `⚪ DEFERRED` — intentionally out of scope for this cycle.
>
> Every status transition records the commit SHA + date so this doc stays a single source of truth on what is/isn't actually solved.

### F-1: Silent checkout failure in `PoolCapacityTab.handleExpand`
- **Status:** 🟥 PENDING — to be fixed in Commit 5
- **Severity:** critical
- **Where:** `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx:170–173`
- **Behavior:** If `createCheckout` throws (backend 500, network blip, ad-blocker, CSP), the catch only runs `console.error(...); setBusy(false)`. The user sees the spinner disappear and the button re-enabled with **no message, alert, banner, or toast**.
- **Impact:** This is what Abril almost certainly hit — "no me anda la página". The host clicks Pay, nothing visible happens, they try again, same thing, they give up. Revenue lost, customer support burden created.
- **Fix:** Surface the error with a styled inline banner (not `window.alert`). Capture the error message + the request payload, send a `client_error` beacon to the backend so we can audit failures. Add retry CTA.

### F-2: `cancelUrl` is computed but never passed to Polar
- **Status:** 🟩 FIXED in `412bb2b` (2026-05-21) — `polar/client.ts` now passes `params.cancelUrl` as Polar's `returnUrl` field. SDK field name verified directly against `@polar-sh/sdk` v0.47 type definitions, no assumption.
- **Severity:** medium
- **Where:** `backend/src/services/paymentService.ts:198` builds the cancel URL; `backend/src/services/polar/client.ts:84–88` only passes `successUrl` and `metadata` to `client.checkouts.create()` — `cancelUrl` is dropped.
- **Behavior:** When a user backs out of Polar's checkout page, they don't bounce back to `picks4all.com/pago/cancelado` — they land on Polar's default cancellation page (or are stuck on a "Cancelled" state on polar.sh). Polar's `checkout.updated` webhook may or may not fire on user-initiated cancellation.
- **Impact:** We lose attribution of cancellations + the user lands somewhere off-brand and may never return.
- **Fix:** Pass `cancelUrl` into Polar's checkout create call. Verify Polar's SDK supports it (`@polar-sh/sdk` v0.47 docs).

### F-3: Polar `checkout.updated` webhook only acts on `expired`/`failed`
- **Status:** 🟩 FIXED in `f3c1e24` (2026-05-21) — `handleCheckoutUpdated` rewritten to persist EVERY delivery as a PaymentEvent audit row, maps Polar terminal statuses (expired/canceled/failed) to the new enum values, leaves non-terminal (open/processing/confirmed) as audit-only.
- **Severity:** high
- **Where:** `backend/src/services/paymentService.ts:676–713` (`handleCheckoutUpdated`)
- **Behavior:** Polar emits `checkout.updated` on every state transition (`open` → `processing` → `confirmed` → `succeeded` → `expired` → `failed`). Our handler only branches on `expired` and `failed`. **Every other transition is silently dropped — no `PaymentEvent` row written, no log entry beyond `console.log("Unhandled webhook event")` at the route level.**
- **Impact:** This is why production has only 1 PaymentEvent row (the single `order.paid` for Ignacio). We cannot reconstruct the funnel because we never persist intermediate states. Abandons that DO get a webhook from Polar still vanish from our DB.
- **Fix:** Write a `PaymentEvent` row for **every** webhook received, regardless of whether we have business logic for it. Add explicit branches for `confirmed` (user submitted payment, waiting for processor) and `succeeded` (intermediate before `order.paid`). The audit-log promise in the schema comment (`"every webhook event received from Polar"`) should be honored.

### F-4: No row exists to record "user clicked Pay" before backend call
- **Status:** 🟩 FIXED in `412bb2b` (2026-05-21) — both `initiateCheckout` (Polar) and `initiateMpCheckout` (MP) now INSERT the PoolPayment row in `INITIATED` state BEFORE calling the gateway. Gateway success transitions to PENDING via atomic `$transaction` with a SERVER `STATUS_TRANSITION` audit event; gateway failure transitions to FAILED with the same audit pattern. Migration `20260521_pool_payment_initiated_state` made `polarCheckoutId` nullable to support this. Regression tests cover happy + failure paths.
- **Severity:** high
- **Where:** `backend/src/services/paymentService.ts:201–237` — `createCheckout` is called BEFORE `prisma.poolPayment.create()`; the row only exists once Polar accepts.
- **Behavior:** If Polar's API returns an error (rate limit, 500, network blip), we never persist an attempt. The user gets a 500 from our route handler. We have NO RECORD that they tried.
- **Impact:** A flaky Polar API causes silent revenue loss. Cannot distinguish "user never clicked Pay" from "user clicked Pay but our integration crashed".
- **Fix:** INSERT a `PoolPayment` row in status `INITIATED` (new enum value) **before** calling Polar. If Polar succeeds, UPDATE to PENDING + populate `polarCheckoutId`. If Polar fails, UPDATE to FAILED with the error. Alternative: keep a separate `CheckoutAttempt` audit table to avoid widening `PaymentStatus`.

### F-5: Idempotency lookup ignores user identity — possible cross-user URL leak
- **Status:** 🟩 FIXED in `412bb2b` (2026-05-21) — both `initiateCheckout` and `initiateMpCheckout` now include `userId` in the idempotency `findFirst` WHERE clause. Cross-user URL reuse impossible. Regression test "idempotency lookup scopes by userId (F-5 fix)" pins the behavior.
- **Severity:** medium (security/attribution)
- **Where:** `backend/src/services/paymentService.ts:165–168` — `prisma.poolPayment.findFirst({ where: { poolId, status: "PENDING", toCapacity } })` — no `userId` in the where clause.
- **Behavior:** If two hosts of the same pool (e.g. HOST + CO_ADMIN) both initiate a checkout for the same target capacity, the second caller receives a Polar URL **created by and pre-filled with the email of the first caller**. The receipt + Meta event_id would then attribute to the wrong user.
- **Impact:** Wrong customer email on Polar checkout page (confusing UX). Wrong receipt sent. Wrong attribution in CAPI/GA4.
- **Fix:** Add `userId` to the idempotency lookup. Two PENDING rows for the same pool+capacity but different users is a valid state.

### F-6: `getPaymentCountry()` relies on third-party ipapi.co with weak fallback
- **Status:** ⚪ DEFERRED — addressed separately outside this audit cycle (per user's prioritization)
- **Severity:** medium
- **Where:** `frontend-next/src/lib/api/payments.ts:38–53`
- **Behavior:** Fetches `https://ipapi.co/country_code/` with 3s timeout. Any failure (timeout, CORS, ad-blocker, ipapi rate limit, network blip) falls through to `"US"`. The backend already has `GET /payments/country` that uses Cloudflare/Railway headers — strictly more reliable — but the frontend doesn't use it.
- **Impact:** A Colombian user with a moment of bad luck (or an ad-blocker that targets ipapi.co) gets routed to Polar (USD) instead of Mercado Pago (COP). They see ~40× the price they expected, or fail to complete because USD checkout doesn't accept their card.
- **Fix:** Call the backend `/payments/country` first (uses CF-IPCountry header, can't be ad-blocked). Use ipapi.co only as a fallback.

### F-7: `_cachedCountry` is module-scoped and never invalidated
- **Status:** ⚪ DEFERRED — cosmetic, out of cycle
- **Severity:** low
- **Where:** `frontend-next/src/lib/api/payments.ts:31`
- **Behavior:** First call to `getPaymentCountry()` caches result for the lifetime of the page. If the user uses a VPN/connects from a different location mid-session, they're stuck with the first detection. A user who initially failed detection (got `"US"`) cannot recover without a full page reload.
- **Impact:** Edge case; not Abril's case.
- **Fix:** Either drop the cache (one extra fetch per checkout is fine) or store the timestamp and refresh after N minutes.

### F-8: `polarCheckoutId` is NOT NULL but MP rows reuse it for `reference`
- **Status:** ⚪ DEFERRED — schema rename has wide blast radius, out of cycle
- **Severity:** low (schema smell)
- **Where:** `backend/prisma/schema.prisma:1221` declares `polarCheckoutId String @unique` (no `?`); `backend/src/services/paymentService.ts:861` populates it with `reference = "P4A-{poolIdPrefix}-{timestamp}"` for MP payments.
- **Behavior:** MP rows have a synthetic value in `polarCheckoutId` that looks like a Polar ID but is actually an MP `external_reference`. Reading the schema you'd assume MP rows have a real Polar checkout ID. Code comments don't explicitly call this out.
- **Impact:** Future maintainer (or future-me) will write a query like `WHERE polarCheckoutId LIKE 'co_%'` to filter Polar rows and silently include or exclude MP rows wrongly.
- **Fix:** Rename `polarCheckoutId` → `gatewayReference` (or add a sibling `gateway` enum column), or keep both `polarCheckoutId` and a new `mpReference` with both nullable.

### F-9: `Polar.metadata` cast is unsafe
- **Status:** ⚪ DEFERRED — read-only verification on real webhook payload pending (done as part of Commit 2's webhook persistence)
- **Severity:** low to medium (depends on Polar SDK behavior)
- **Where:** `backend/src/services/polar/client.ts:86` — `metadata: params.metadata as unknown as Record<string, string>`. Inner type has `fromCapacity: number` and `toCapacity: number`.
- **Behavior:** Cast lies about the shape. If Polar's SDK serializes the metadata as-is into a JSON column, numbers come back as numbers in webhooks (fine). If Polar's SDK coerces to strings during the wire format (less common but possible), webhook `payload.data.metadata.toCapacity` is a string — and `paymentService.ts:364` writes that string into `Pool.update({ maxParticipants })`, where Prisma will throw a runtime type error.
- **Impact:** Need to verify with a real production webhook payload. **[ACTION: capture one webhook for inspection.]**
- **Fix:** Either widen the type to `Record<string, unknown>` and pass real types through, or stringify on the way in and parse on the way out.

### F-10: `getOrder()` is dead code
- **Status:** ⚪ DEFERRED — re-evaluate after Commit 4 (reconciler may want it)
- **Severity:** low
- **Where:** `backend/src/services/polar/client.ts:110–116`
- **Behavior:** Function declared but never called anywhere.
- **Fix:** Either remove or actually wire it into the reconciliation we don't yet have.

### F-11: 1388-line `paymentService.ts` violates CLAUDE.md §2 ("Services >800 lines must be decomposed")
- **Status:** ⚪ DEFERRED — cosmetic, defer until after critical findings
- **Severity:** low (process/maintainability), but indirectly hurts every other finding because the file is hard to reason about
- **Where:** entire `backend/src/services/paymentService.ts`
- **Behavior:** Mixes Polar + Mercado Pago + their respective checkout creation, webhook handling, refund, status query.
- **Fix:** Split into `paymentService/index.ts` (public), `paymentService/polar.ts`, `paymentService/mercadopago.ts`, `paymentService/analytics.ts`. Defer until after critical findings are resolved.

### F-12: Pricing logic duplicated between backend and frontend
- **Status:** ⚪ DEFERRED — post-mundial
- **Severity:** medium (CLAUDE.md §2 violates, has caused user-visible bugs before per inline comment)
- **Where:** `backend/src/lib/pricing.ts` mirrors `frontend-next/src/lib/pricing.ts`. Comment in backend line 80 acknowledges: *"Mirror of corporateCumulativePriceCop — kept identical to avoid the BE-vs-FE divergence that was charging 32% over the UI price."*
- **Impact:** Already broke once with a 32% mismatch. Will break again.
- **Fix:** Either (a) frontend fetches pricing from backend (extra hop, but single source of truth), or (b) extract a shared TypeScript package + monorepo workspace. Defer to post-mundial.

### F-13: No backend route to report "client side payment error"
- **Status:** 🟧 IN PROGRESS — backend endpoint `POST /payments/attempts/:paymentId/event` shipped in `f3c1e24` (2026-05-21) with `recordClientEvent` service helper enforcing ownership; frontend beacons (REDIRECT_INITIATED, USER_CANCELLED, CLIENT_ERROR) come in Commits 5 + 6.
- **Severity:** high (observability)
- **Where:** missing endpoint. There's no POST `/payments/client-event` (or similar) that the frontend can hit when something fails *after* the backend created the checkout but before the user reached Polar.
- **Impact:** All client-side failures (redirect blocked, page unload, network drop after PoolPayment INSERT) are invisible to us.
- **Fix:** Add `POST /payments/attempts/:paymentId/event` with body `{ type: "REDIRECT_INITIATED" | "REDIRECT_FAILED" | "CLIENT_ERROR" | "USER_CANCELLED", error?: string }`. Persist these as `PaymentEvent` rows or a new `PoolPaymentAttemptEvent` table. Frontend fires it from every catch block AND fires a `REDIRECT_INITIATED` immediately before `window.location.href = ...`.

### F-14: No background reconciliation job
- **Status:** 🟩 FIXED in `b6fbad8` (2026-05-21) — new `paymentReconcileJob` runs every 30 min (configurable via `RECONCILE_CRON`), early-exits on idle, uses Postgres advisory lock for multi-instance safety. `reconcileStalePayment` maps Polar's checkout state to one of 5 outcomes (RESCUED, EXPIRED, FAILED_FROM_GATEWAY, ABANDONED_GATEWAY_404, ABANDONED_LOCAL_TIMEOUT) with a RECONCILER audit row each. RESCUED triggers admin notification (manual review) — does not auto-complete to avoid replaying CAPI/GA4/email side effects unsafely.
- **Severity:** medium
- **Where:** no `backend/src/jobs/paymentReconcileJob.ts` exists.
- **Behavior:** PoolPayment rows that go PENDING and never receive a webhook stay PENDING forever (Abril's 7-day-old row is proof). We never query Polar after the fact to ask "what's the status of this checkout?"
- **Impact:** Stuck rows accumulate. Funnel analytics overstate "in-progress" by including all 8 of our current PENDING (which are really "abandoned").
- **Fix:** Hourly cron: for every PoolPayment in PENDING > 1 hour old, call `getCheckoutSession(polarCheckoutId)`. If Polar says expired/failed → mark FAILED. If Polar says succeeded → process as if webhook arrived (the webhook handler is already idempotent). If Polar says still open and >24h old → mark as `EXPIRED`/`ABANDONED` ourselves.

### F-15: `PaymentStatus` enum lacks `ABANDONED` / `EXPIRED` / `CANCELLED`
- **Status:** 🟩 FIXED in `cc9c315` (2026-05-21) — migration `20260519_extend_payment_observability` adds `INITIATED`, `ABANDONED`, `EXPIRED`, `CANCELLED` to the enum and is applied + verified in production. Producers in subsequent commits.
- **Severity:** medium
- **Where:** `backend/prisma/schema.prisma:1204–1209`
- **Behavior:** A user closes tab without paying = stays PENDING forever. Polar checkout expires (24h) = no automatic transition.
- **Impact:** Funnel reports cannot distinguish "currently buying" from "gave up two months ago".
- **Fix:** Add `ABANDONED` (we decided to give up on it) and optionally `EXPIRED` (Polar told us it's dead) to the enum. Migration. The reconciliation job in F-14 is the writer.

### F-16: `PoolCapacityTab` does not emit GA4 funnel events
- **Status:** 🟥 PENDING — to be fixed in Commit 6
- **Severity:** medium (analytics)
- **Where:** `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx:147–174` does NOT call `trackBeginCheckout` or `trackMetaEvent("InitiateCheckout")`. The wizard `PoolCreationWizard.tsx:155-204` DOES.
- **Impact:** GA4 funnel undercounts checkouts initiated from the admin tab. We don't know how many existing hosts try to expand vs how many give up at the wizard step.
- **Fix:** Mirror the wizard's tracking calls in PoolCapacityTab.handleExpand.

### F-17: `pago/cancelado` is a static page — no signal sent to backend
- **Status:** 🟧 IN PROGRESS — backend endpoint (F-13) ships in Commit 2; cancelado page wired in Commit 6
- **Severity:** medium
- **Where:** `frontend-next/src/app/[locale]/pago/cancelado/page.tsx`
- **Behavior:** Page shows "you cancelled" copy. No fetch, no analytics, no backend POST. Combined with F-2 (Polar doesn't redirect here anyway), this page receives only MP cancels and even then does nothing.
- **Fix:** Fire `POST /payments/attempts/:paymentId/event` with type=`USER_CANCELLED`. Emit GA4 `payment_cancelled`. Show a one-click "retry" CTA back to the capacity tab.

### F-18: Webhook handler returns 200 on unrecognized event type
- **Status:** 🟩 FIXED in `f3c1e24` (2026-05-21) — `recordUnhandledPolarEvent` writes an audit row for any webhook type the dedicated handlers don't recognize. Returns 200 (no retry) but leaves a forensic trail.
- **Severity:** low
- **Where:** `backend/src/routes/payments.ts:336–344` — unknown event types are logged with `console.log` and the route returns 200.
- **Impact:** If Polar adds a new event type that should matter (e.g. `customer.refund_pending`), we silently miss it and Polar marks the delivery as successful.
- **Fix:** Persist `PaymentEvent` rows for ALL recognized & unrecognized events (F-3 covers this) so we have a record. Continue returning 200 so Polar doesn't retry, but operator can grep the table for unknown event types and triage.

### F-19: Webhook `webhook-id` / `webhook-timestamp` headers not logged
- **Status:** 🟩 FIXED in `f3c1e24` (2026-05-21) — route handler parses both headers into a `WebhookContext` threaded through every handler; every PaymentEvent row written from a webhook now records the headers; route also logs them on receipt.
- **Severity:** low
- **Where:** `backend/src/routes/payments.ts:321–344` does not log the Polar webhook delivery ID.
- **Impact:** If you need to ask Polar "did you send me event X at time Y?" you cannot correlate to their internal logs.
- **Fix:** `console.log` the `webhook-id` and `webhook-timestamp` headers on every receipt, and store them in `PaymentEvent` if F-3 widens the table.

### F-20: `Buffer.from(webhookSecret).toString("base64")` may double-encode
- **Status:** ⚪ DEFERRED — production has 3 PaymentEvent rows from real Polar webhooks, so signature verification IS working with current env-var format. Documenting the contract is enough; no code change needed.
- **Severity:** unknown (security/config)
- **Where:** `backend/src/routes/payments.ts:318`
- **Behavior:** Wraps `POLAR_WEBHOOK_SECRET` env var in base64. If the env var is *already* stored base64 in Railway, we double-encode and the signature library won't verify.
- **Impact:** If misconfigured, EVERY webhook returns 401 and Polar would retry forever. The fact that production has 1 PaymentEvent row (Ignacio's `order.paid`) is evidence this DOES work. **VERIFY in Railway env that POLAR_WEBHOOK_SECRET is stored raw, not pre-base64.**
- **Fix:** None if it works; document the expected format in the env doc.

---

## 4 — Observability gaps

> *Things we cannot answer today because we never persist the data. These are not "bugs" — the code does what was designed — but the design is blind.*

### G-1: "Did the user actually reach Polar's checkout page?"
- **What we have:** `PoolPayment.createdAtUtc` (when we sent them a URL).
- **What we don't have:** any confirmation that the redirect actually executed, that Polar's page rendered, that the user saw the form.
- **Closes:** F-13 + F-3 (`checkout.created` webhook from Polar, if we persist it).

### G-2: "Why did the user not complete? Cancelled? Card declined? Tab closed?"
- **What we have:** an unwritten PENDING row for each of the 8 abandons.
- **What we don't have:** the user's last action — cancel button, card rejection from Polar (which would fire `checkout.updated` status=`failed`), or tab-close (browser-only signal).
- **Closes:** F-3 + F-17 + F-13.

### G-3: "How many people see the price and bounce immediately?"
- **What we have:** `view_item` GA4 events from CapacitySelector? **[need to verify in lib/ecommerce + StepCapacity]**. Probably nothing.
- **What we don't have:** funnel from "view tier" → "click pay" → "reach Polar" → "complete".
- **Closes:** F-16 + a `view_item` event when the selector renders.

### G-4: "Which gateway path does each user actually take?"
- **What we have:** `polarCheckoutId` populated for both Polar and MP (F-8 problem); `mpPreferenceId` non-null for MP.
- **What we don't have:** a clean `gateway = "POLAR" | "MP"` column to filter on.
- **Closes:** F-8.

### G-5: "Is the country detection right? Are we routing some COPs to Polar by mistake?"
- **What we have:** the `cositasvariasv999` case (Colombia, but Polar with COP amount) flagged in yesterday's analysis.
- **What we don't have:** a log of "country detected = X, gateway chosen = Y" at the moment of initiation.
- **Closes:** persist `clientIpAddress` (already done) + add a `detectedCountry` column on PoolPayment. F-6 also helps.

### G-6: "Are Polar's webhooks actually arriving? Are some being dropped at the edge?"
- **What we have:** 1 PaymentEvent row.
- **What we don't have:** access logs for `POST /payments/webhook` to confirm Polar tried to deliver other events. Railway logs are ephemeral and not indexed for grep.
- **Closes:** F-3 (write a PaymentEvent for every received webhook) + log `webhook-id` (F-19).

### G-7: "What's the actual conversion rate from 'see price' to 'pay'?"
- **What we have:** 9 attempts / 1 completion = 11% checkout→pay.
- **What we don't have:** how many users SAW the tier list and did NOT click. CapacitySelector renders are invisible to us.
- **Closes:** `view_item_list` GA4 event when CapacitySelector renders with a non-free tier visible.

---

## 5 — Resolution plan

> *Built only after sections 1-4 are approved. Each finding becomes a task with its own commit. No code changes happen before this section is approved.*

**Suggested resolution order (open to feedback):**

1. **F-1** — silent failure in PoolCapacityTab (immediate UX win for the 8 affected hosts; we can email them after deploying).
2. **F-13 + F-3 + F-17** — observability backbone: PoolPaymentAttemptEvent table (or PaymentEvent expansion) + client beacons + write every Polar webhook we receive.
3. **F-2** — pass cancelUrl to Polar.
4. **F-14 + F-15** — reconciliation job + ABANDONED/EXPIRED enum states.
5. **F-4** — INITIATED status pre-Polar.
6. **F-5** — fix idempotency lookup to include userId.
7. **F-6** — use backend country endpoint, ipapi.co as fallback.
8. **F-16** — emit funnel events from PoolCapacityTab.
9. **F-19 + F-18** — webhook logging, persist unknown events.
10. **F-9 + F-20** — verify metadata cast + webhook secret encoding (read-only checks).
11. **F-10** — remove or use `getOrder`.
12. **F-7** — drop cache or add timestamp.
13. **F-8** — schema rename (large blast radius — last).
14. **F-11** — paymentService.ts decomposition (cosmetic; defer).
15. **F-12** — pricing dedup (defer to post-mundial).

---

## 4 — Observability gaps

> *Things we cannot answer today because we never persist the data. Separate from bugs because the code is not "broken" — it just leaves us blind.*

<!-- pending -->

---

## 5 — Resolution plan

> *Built only after sections 1-4 are complete. Each finding becomes a task with its own commit. No code changes happen before this section is approved.*

<!-- pending -->
