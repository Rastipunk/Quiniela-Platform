# Payment-attempt telemetry — Forensic audit

> Companion document to `PAYMENT_ATTEMPT_TELEMETRY_IMPLEMENTATION.md`.
>
> Goal of this cycle (from the owner, 2026-05-28): "Cuando un usuario da
> click en pagar, saber si solo cerró la ventana y no lo hizo, o hizo
> click en volver, o qué pasó."
>
> Everything in this document is verified against the code on
> `origin/main @ bc5ccbd`. No assumptions.

---

## 1. Current capture — what we see today

### 1.1 Backend infrastructure

| Element | Location | Notes |
|---|---|---|
| Route | `backend/src/routes/payments.ts:222-260` | `POST /payments/attempts/:paymentId/event`, `requireAuth` middleware, 202 response |
| Path validation | `payments.ts:230` | UUID regex on `:paymentId` before touching DB |
| Body validation | `payments.ts:212-220` | Zod `.enum(CLIENT_EVENT_TYPES)` + free-form `details: z.record(z.string(), z.unknown()).optional()` |
| Service | `paymentService.ts:1282-1308` (`recordClientEvent`) | Ownership check (rejects 403 if `payment.userId !== input.userId`); writes `PaymentEvent` with `source=CLIENT`, `polarEventId=null`, `eventType`, `payloadJson` |
| Enum source | `lib/paymentEvents.ts:62-74` | `CLIENT_EVENT_TYPE` const + derived `CLIENT_EVENT_TYPES: readonly ClientEventType[]` |
| DB column | `PaymentEvent.eventType` is `TEXT` in `prisma/schema.prisma` | Additive change: new enum values do NOT require migration |
| Idempotency | None (intentional) | Each client beacon is a forensic row; reloads write duplicates by design |
| Rate limiting | None specific to this route | Inherits global rate-limit middleware |

### 1.2 Current `CLIENT_EVENT_TYPE` taxonomy

Defined in `backend/src/lib/paymentEvents.ts:62-67`:

| eventType | Documented purpose | Where emitted today |
|---|---|---|
| `REDIRECT_INITIATED` | Browser about to assign `window.location.href = url` | `PoolCapacityTab.tsx:208,239` (MP + Polar); `PoolCreationWizard.tsx:191,222` (MP + Polar) |
| `REDIRECT_FAILED` | The `window.location.href` assignment threw synchronously | `PoolCapacityTab.tsx:215,246`; `PoolCreationWizard.tsx:198,229` (catch blocks) |
| `USER_CANCELLED` | User landed on `/pago/cancelado` (Polar return path) | `app/[locale]/pago/cancelado/page.tsx:30-34` |
| `CLIENT_ERROR` | Generic catch-block fallback | Not actually emitted anywhere — the docstring lists it but `grep -r "CLIENT_ERROR"` returns 0 emit sites in `frontend-next/` |

### 1.3 Flow per gateway

**Polar (international, redirect to polar.sh):**

1. User clicks "Pagar" in `PoolCapacityTab` → backend `/payments/checkout` returns `{ paymentId, checkoutUrl }`.
2. Frontend emits `REDIRECT_INITIATED` (beacon) with `{ gateway: "POLAR", url }`.
3. Frontend `window.location.href = result.checkoutUrl` — browser navigates to polar.sh.
4. On polar.sh, the user does one of:
   - **Pays successfully**: Polar fires `order.paid` webhook → backend `handleOrderPaid` → `markPaymentCompleted`. Polar redirects browser to `successUrl` (`/pago/exitoso?...&paymentId=...`).
   - **Clicks cancel / closes Polar's checkout**: Polar redirects browser to `cancelUrl` (`/pago/cancelado?...&paymentId=...`). Our `pago/cancelado/page.tsx` emits `USER_CANCELLED` on mount. ✅ Captured.
   - **Closes the tab without clicking anything**: no signal. Polar webhook fires `checkout.updated` with `status: open` periodically, then nothing. The Polar reconciler (`paymentReconcileJob`) eventually flags it (status=open past 24h → `ABANDONED_LOCAL_TIMEOUT`).
   - **Lets the checkout expire**: same as tab-close from our perspective.

**Mercado Pago (Colombia, embedded Brick at `/pago/checkout`):**

1. User clicks "Pagar" in `PoolCapacityTab` → backend `/payments/mp-checkout` returns `{ paymentId, preferenceId, publicKey, amountCop }`.
2. Frontend emits `REDIRECT_INITIATED` (beacon) with `{ gateway: "MP", url: "/pago/checkout?..." }`.
3. Frontend `window.location.href = url` — browser navigates to OUR `/pago/checkout` page (same origin).
4. `/pago/checkout/page.tsx` loads the MP SDK and instantiates the Payment Brick:
   - `onReady` callback fires → sets local React state `status = "ready"`. **No beacon.**
   - `onSubmit` callback fires → calls `processMpPayment(paymentId, formData, metaCookies)` → backend handles approved/rejected/pending.
   - `onError` callback fires → sets local state, shows error. **No beacon.** Only `console.error`.
5. After the Brick is mounted, the user can:
   - **Fill the form and submit** — `onSubmit` path. If approved, `markPaymentCompleted` runs. If rejected, status → `FAILED` + GA4 event (no beacon).
   - **Get a client-side validation error inside the Brick** (CVV, expired card) — Brick keeps the form open, `onSubmit` never fires. **Invisible to backend.**
   - **Close the tab / hit back** — no listener. **Invisible to backend.**
   - **Wait until the SDK fails to load** — `onError` runs but only sets local state. **Invisible to backend.**

---

## 2. Gap inventory

Five gaps, ranked by forensic impact.

### G-1. MP Brick load success / failure invisible

**Evidence:** `app/[locale]/pago/checkout/page.tsx:129-130` shows `onReady` only writes to React state. Line 205-215 shows `onError` only writes state + `console.error`. No `reportPaymentAttemptEvent` import in the file.

**Impact:** We cannot distinguish "user reached `/pago/checkout` and the Brick rendered" from "the SDK failed to load due to network / MP outage / CSP" or "the SDK loaded but errored on init". For tonight's 2 failed attempts by juank, we don't know whether he even saw the form.

**Concrete forensic loss:** When `mpPaymentId IS NULL`, all the following are indistinguishable today:
- User never clicked anything after landing on the page.
- Brick failed to render.
- Brick rendered, user closed tab.
- Brick rendered, user clicked back.
- Brick rendered, user typed invalid card, Brick blocked submit.

### G-2. MP Brick tab-close invisible

**Evidence:** `pago/checkout/page.tsx` has no `beforeunload` / `pagehide` / `unload` listener (grep for these returns 0 hits in the file). The cleanup `useEffect` (line 227-231) only calls `brickController.unmount()` — does not beacon.

**Impact:** The owner's exact use case: "saber si solo cerró la ventana y no lo hizo."

### G-3. MP Brick has no visible cancel exit

**Evidence:** `pago/checkout/page.tsx` only renders the Brick container, status states, and an error banner. There is no "Cancelar" / "Volver al pool" button after the Brick loads. The user can only leave via the browser's back button, closing the tab, or via the error/success state's automatic redirect.

**Impact:** Even if we add `beforeunload` (G-2), we can't tell "deliberately cancelled" from "tab close" — both surface as the same `beforeunload`. The Polar flow has a separate `/pago/cancelado` redirect that gives us the deliberate-cancel signal; the MP Brick has no equivalent.

### G-4. `CLIENT_ERROR` enum value is documented but unused

**Evidence:** `grep -r "CLIENT_ERROR" frontend-next/src/` returns zero matches. `lib/paymentEvents.ts:66` defines it; nothing emits it.

**Impact:** A documented escape hatch that was never wired. Today every client-side error in the payment flow (Brick load failure, fetch rejected, etc.) is invisible to the backend.

### G-5. `REDIRECT_FAILED` only catches synchronous `window.location.href` throws

**Evidence:** `PoolCapacityTab.tsx:213-220`:
```ts
try {
  window.location.href = url;
} catch (redirectErr) {
  void reportPaymentAttemptEvent(...);
  throw redirectErr;
}
```

**Impact:** `window.location.href = ...` is asynchronous from the user's POV: the assignment returns immediately, navigation happens microseconds later. If the navigation is aborted (CSP block silently, popup blocker on iframed contexts, network race) without throwing, we miss it. **Out of scope** for this cycle — the user's question is about MP Brick, not pre-redirect failures, and tonight's 2 attempts confirm the redirect itself worked (both PoolPayment rows show `REDIRECT_INITIATED` followed by the user reaching `/pago/checkout`'s lifecycle).

---

## 3. Locked decisions

Confirmed via AskUserQuestion on 2026-05-28.

### 3.1 Event taxonomy — new specific types

Add three new `CLIENT_EVENT_TYPE` values:

| New value | Emit site | Purpose |
|---|---|---|
| `BRICK_LOADED` | MP `/pago/checkout` `onReady` callback | Confirms Brick rendered. Absence ⇒ SDK failed somewhere upstream. |
| `BRICK_ERROR` | MP `/pago/checkout` `onError` callback | SDK-level error with full MP error detail in `details`. |
| `USER_CLOSED_TAB` | MP `/pago/checkout` `beforeunload` listener | Tab closed / page navigated away while the Brick was mid-flow (status ∈ `loading`, `ready`, `processing`). |

`USER_CANCELLED` (existing) is reused — emitted from a new Cancel button in `/pago/checkout` (see §3.2) and from the existing `/pago/cancelado` Polar path.

`CLIENT_ERROR` (existing) is kept as the catch-all for ad-hoc fetch errors during the flow. We do NOT wire new emit sites in this cycle — its current zero-usage is acceptable; new sites would belong to a separate observability cycle.

### 3.2 Cancel button in `/pago/checkout`

Add a visible "Cancelar / Volver al pool" button while `status ∈ { loading, ready }`. Clicking it:

1. Emits `USER_CANCELLED` with `details: { source: "pago_checkout_cancel_button", brickStatus: status }`.
2. Navigates to `/pools/{poolId}` (or `/dashboard` if poolId is missing — same fallback the cancel page uses).

Hidden while `status === "processing"` (don't let the user cancel mid-submit; the result is already in flight).

### 3.3 `beforeunload` scope

Only on `/pago/checkout` (MP Brick). NOT on the pool-capacity-tab pre-Polar-redirect window:

- Time between `REDIRECT_INITIATED` and `window.location.href` actually navigating is microseconds. `beforeunload` would fire on every redirect AND every legitimate navigation, generating noise without signal.
- Polar has `/pago/cancelado` already for deliberate cancellations.
- The reconciler covers tab-close on Polar's side (24h ABANDONED path).

### 3.4 Transport — `navigator.sendBeacon` for `USER_CLOSED_TAB`

The `beforeunload` listener cannot await a `fetch()` Promise — modern browsers cancel in-flight fetches when the page unloads, so the `POST` would be lost. The fix is `navigator.sendBeacon(url, body)` which the browser guarantees to flush even after unload.

`reportPaymentAttemptEvent` today uses `requestJson` (a `fetch` wrapper). We need either:

- (a) A new `reportPaymentAttemptEventBeacon` that uses `sendBeacon` directly. Cleaner separation, no risk of regressing the existing call sites.
- (b) A flag on the existing function to switch transports. More compact but more coupling.

**Locked choice:** (a) — separate function. The `sendBeacon` API has a different shape (no credentials cookies by default — needs `keepalive` fetch fallback for older browsers, but `sendBeacon` is supported in every browser we target), and mixing the two transports in one function would hide that operational difference. The new function lives next to `reportPaymentAttemptEvent` in `frontend-next/src/lib/api/paymentAttemptEvent.ts`.

### 3.5 Authentication for the beacon

The current `POST /payments/attempts/:paymentId/event` requires `requireAuth` (JWT cookie). `sendBeacon` sends cookies by default in same-origin contexts (Picks4All is same-origin: `picks4all.com` → `api.picks4all.com` via CORS with `credentials: include`). **Cross-origin caveat:** `sendBeacon` may not honour CORS preflight for `Content-Type: application/json`. The beacon must use `Content-Type: text/plain` (a Blob with that MIME) and the backend must accept it. Express `body-parser` is configured for JSON only by default — we need to either:

- (a) Add a `text/plain` body parser for this one route. Smaller surface change.
- (b) Use `application/x-www-form-urlencoded` (sendBeacon-friendly, no preflight). Already parsed by Express but loses JSON structure.
- (c) Hybrid: parse `text/plain` body as JSON manually inside the route.

**Locked choice:** (c) — the route reads `req.body` (or `req` raw stream when type is `text/plain`) and `JSON.parse` inside the handler. The Zod schema then runs on the parsed object. Surgical: one line of "if content-type is text/plain, treat the raw body as JSON".

### 3.6 What `USER_CLOSED_TAB` carries in `details`

Beacon payload should give the backend enough to distinguish "left immediately" from "left after several seconds":

```json
{
  "brickStatus": "ready" | "loading" | "processing",
  "msOnPage": <number of ms since /pago/checkout mounted>,
  "hadBrickLoaded": <bool — did onReady fire before unload>,
  "gateway": "MP"
}
```

### 3.7 `BRICK_ERROR` details

```json
{
  "error": <error message — typed string if Error, JSON of object otherwise>,
  "stage": "init" | "render" | "submit",
  "brickStatus": <state at time of error>
}
```

`stage` distinguishes the load-time error (SDK fetch / instantiation failed) from a per-render error (Brick mounted but something went wrong mid-form).

---

## 4. Out of scope (explicit)

- **G-5** (silent redirect aborts) — needs page-visibility polling on the source tab, broader scope than the owner's question.
- **Polar-side telemetry** (what the user did on polar.sh) — we cannot instrument Polar's hosted checkout. Their `/pago/cancelado` redirect is the only signal we get; that already works.
- **Admin email on abandoned high-value attempts** — owner explicitly limited tonight's scope to "qué pasó". Email triggers belong to a follow-up cycle.
- **Wizard flow (`PoolCreationWizard.tsx`)** — same MP Brick gaps apply if the wizard also uses `/pago/checkout`. Need to verify in implementation whether the wizard takes users through `/pago/checkout` or a separate Brick mount; if separate, this cycle covers the standalone page and a follow-up covers the wizard.
- **Backfill of past abandonments** — the 7 ABANDONED rows from this morning's reconciler tick stay as-is. New telemetry only fires from now forward.

---

## 5. Acceptance criteria for the cycle

After all commits land in production, for ONE fresh test attempt the owner does on MP:

1. ✅ A `BRICK_LOADED` row exists on the PoolPayment within 5s of the page rendering.
2. ✅ If owner closes the tab without submitting: a `USER_CLOSED_TAB` row exists with `brickStatus`, `msOnPage`, `hadBrickLoaded` populated.
3. ✅ If owner clicks the new Cancel button: a `USER_CANCELLED` row exists with `source: "pago_checkout_cancel_button"` and the next pageview is `/pools/{poolId}`.
4. ✅ If MP's SDK is blocked (test via DevTools → block `sdk.mercadopago.com`): a `BRICK_ERROR` row exists with `stage: "init"`.
5. ✅ The reconciler's `ABANDONED` outcome for the row still works the same (no regression on the cycle-1 plumbing).

For the negative cases:

1. ❌ NO regression in the existing `REDIRECT_INITIATED` / `REDIRECT_FAILED` / `USER_CANCELLED` (Polar) emit sites.
2. ❌ NO new admin emails (out of scope).
3. ❌ NO impact on `markPaymentCompleted` or the reconciler logic.

---

## 6. Document version

- v1 — 2026-05-28 — locked alongside `PAYMENT_ATTEMPT_TELEMETRY_IMPLEMENTATION.md`.
