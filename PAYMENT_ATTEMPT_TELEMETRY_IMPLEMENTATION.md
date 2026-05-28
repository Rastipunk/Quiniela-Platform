# Payment-attempt telemetry — Implementation Tracker

> Companion to `PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md`. Per-commit checklist.
> Update the status emoji + SHA as each commit lands so the work
> survives context breaks.
>
> Every locked decision is in `PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md` §3.
> Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: extend `CLIENT_EVENT_TYPE` enum + route accepts `text/plain` body | 🟩 DONE | `e705992` |
| 2 | Frontend: `sendBeacon` transport helper | 🟩 DONE | `c6b6064` |
| 3 | Frontend: MP Brick emits `BRICK_LOADED` / `BRICK_ERROR` from `onReady` / `onError` | 🟩 DONE | `b8da1fa` |
| 4 | Frontend: MP Brick emits `USER_CLOSED_TAB` via `beforeunload` + visible Cancel button → `USER_CANCELLED` | 🟩 DONE | `f7cafac` |
| 5 | Docs: ADR-066 + BUSINESS_RULES §19 + MEMORY entry | 🟧 IN PROGRESS | — |

Cycle is functionally complete after commit 4. Commit 5 is documentation hygiene.

---

## Pre-flight

- [x] Audit doc reviewed (line-by-line code verification, no assumptions).
- [x] 3 architectural decisions confirmed via AskUserQuestion (taxonomy, cancel button, beforeunload scope).
- [x] Confirmed `PaymentEvent.eventType` is TEXT — no migration needed.
- [x] Confirmed `recordClientEvent` ownership check rejects cross-user writes.
- [ ] User says "Go" for commit 1.

---

## 1 — Commit 1: backend enum + text/plain body parser

**Goal:** make the backend accept the three new client event types and tolerate `sendBeacon`'s `text/plain` content type.

### 1.1 Files

- `backend/src/lib/paymentEvents.ts` — add `BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB` to the `CLIENT_EVENT_TYPE` const. Docstring updates explaining when each fires.
- `backend/src/routes/payments.ts` — small change to the `/attempts/:paymentId/event` handler: if `req.is('text/plain')` is true, parse `req.body` (a string) as JSON before validating. Otherwise the existing JSON parsing path runs unchanged.

### 1.2 Enum diff (illustrative)

```ts
export const CLIENT_EVENT_TYPE = {
  REDIRECT_INITIATED: "REDIRECT_INITIATED",
  REDIRECT_FAILED: "REDIRECT_FAILED",
  USER_CANCELLED: "USER_CANCELLED",
  CLIENT_ERROR: "CLIENT_ERROR",
  // New (cycle 2):
  /** MP Brick `onReady` callback fired → form is rendered and
   *  interactive. Absence implies the SDK failed to load. */
  BRICK_LOADED: "BRICK_LOADED",
  /** MP Brick `onError` callback fired. `details` carries the
   *  MP-supplied error + stage (init / render / submit). */
  BRICK_ERROR: "BRICK_ERROR",
  /** Browser `beforeunload` fired while the Brick was mid-flow.
   *  `details` carries brickStatus + msOnPage + hadBrickLoaded so
   *  forensics can distinguish "left after 2s" from "stayed 5min". */
  USER_CLOSED_TAB: "USER_CLOSED_TAB",
} as const;
```

### 1.3 Route diff (illustrative)

```ts
paymentsRouter.post(
  "/attempts/:paymentId/event",
  requireAuth,
  // Allow sendBeacon's text/plain payload by parsing the raw string as
  // JSON here. Express body-parser handles application/json natively.
  express.text({ type: "text/plain", limit: "8kb" }),
  async (req, res) => {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return sendBadRequest(res, "INVALID_JSON_BODY"); }
    }
    // ... existing zod validation + recordClientEvent call ...
  },
);
```

### 1.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Existing JSON-body call sites still work (the 5 emit sites in `PoolCapacityTab.tsx` + `PoolCreationWizard.tsx` + `pago/cancelado/page.tsx`).
- [ ] New event types pass Zod validation (smoke test by curl-ing the route with a valid auth cookie and `{"eventType":"BRICK_LOADED","details":{}}`).
- [ ] `text/plain` request with JSON-as-string body succeeds (curl with `-H 'Content-Type: text/plain'`).

### 1.5 Commit message template

```
feat(payments): extend CLIENT_EVENT_TYPE + accept text/plain beacons

Adds three new client beacon types for MP Brick lifecycle telemetry
and teaches POST /payments/attempts/:paymentId/event to accept
text/plain bodies (needed by navigator.sendBeacon).

  - BRICK_LOADED — MP Brick onReady, confirms form rendered
  - BRICK_ERROR  — MP Brick onError, captures SDK failures
  - USER_CLOSED_TAB — beforeunload while Brick was mid-flow

PaymentEvent.eventType is TEXT in the schema so adding enum values is
an additive backend-only change with no migration.

The text/plain parser is mounted only on this route (8kb cap) and the
handler JSON.parses the string before the existing Zod schema runs.
Required because navigator.sendBeacon cannot set Content-Type:
application/json without triggering a CORS preflight that aborts
during page unload.

Tracks PAYMENT_ATTEMPT_TELEMETRY_IMPLEMENTATION.md commit 1.
Closes audit §3.1 (taxonomy) and §3.5 (transport).

Co-Authored-By: …
```

### 1.6 Status

🟩 DONE — SHA: `e705992`

---

## 2 — Commit 2: `sendBeacon` transport helper

**Goal:** new client function that posts via `navigator.sendBeacon`, callable from `beforeunload` handlers without losing the request on page unload.

### 2.1 Files

- `frontend-next/src/lib/api/paymentAttemptEvent.ts` — add `reportPaymentAttemptEventBeacon` next to the existing `reportPaymentAttemptEvent`.

### 2.2 Function shape

```ts
/**
 * Send a client beacon synchronously via navigator.sendBeacon — the
 * only transport guaranteed to flush after page unload. Use this from
 * `beforeunload` / `pagehide` handlers; for normal flow use
 * `reportPaymentAttemptEvent` (fetch-based, can await).
 *
 * Content-Type is `text/plain` so the request escapes the CORS
 * preflight that would otherwise abort during unload. The backend
 * route handles the parse (see commit 1).
 *
 * Returns true if the browser queued the beacon, false if it refused
 * (e.g. payload too large, browser shutting down). Failures are
 * silent — losing one beacon is acceptable; blocking unload is not.
 */
export function reportPaymentAttemptEventBeacon(
  paymentId: string,
  body: PaymentAttemptEventBody,
): boolean {
  if (!paymentId || typeof navigator === "undefined" || !navigator.sendBeacon) {
    return false;
  }
  const url = `${API_BASE_URL}/payments/attempts/${paymentId}/event`;
  // text/plain — see fn docstring for why.
  const blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
  try {
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}
```

### 2.3 Acceptance

- [ ] `npx tsc --noEmit` in `frontend-next` passes.
- [ ] Unit-testable via dev console: `reportPaymentAttemptEventBeacon('<pid>', { eventType: 'USER_CLOSED_TAB', details: {} })` returns `true` and the backend audit log shows the row.
- [ ] No regression in the existing fetch-based function.

### 2.4 Status

🟩 DONE — SHA: `c6b6064`

---

## 3 — Commit 3: `BRICK_LOADED` + `BRICK_ERROR` from MP Brick

**Goal:** wire the existing `onReady` / `onError` callbacks in `/pago/checkout` to emit forensic beacons.

### 3.1 Files

- `frontend-next/src/app/[locale]/pago/checkout/page.tsx` — import `reportPaymentAttemptEvent`, emit from the two callbacks.

### 3.2 Emit sites

```ts
callbacks: {
  onReady: () => {
    setStatus("ready");
    void reportPaymentAttemptEvent(paymentId, {
      eventType: "BRICK_LOADED",
      details: { gateway: "MP" },
    });
  },

  onSubmit: async ({ selectedPaymentMethod, formData }) => {
    /* unchanged */
  },

  onError: (error: unknown) => {
    console.error("[PaymentBrick] Error:", error);
    setStatus("error");
    const detail = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error);
    setErrorMsg(`Error al cargar el formulario de pago: ${detail}`);
    void reportPaymentAttemptEvent(paymentId, {
      eventType: "BRICK_ERROR",
      details: {
        error: detail,
        stage: brickReadyRef.current ? "render" : "init",
        brickStatus: status,
      },
    });
  },
},
```

A small `useRef<boolean>(false)` (`brickReadyRef`) flips to `true` in `onReady` so `onError` can distinguish init-time vs post-render errors.

The outer `try { await brickController.create(...) } catch (err) { ... }` also emits `BRICK_ERROR` with `stage: "init"` so SDK-script-load failures are captured (today they only `console.error`).

### 3.3 Acceptance

- [ ] `npx tsc --noEmit` in `frontend-next` passes.
- [ ] Manual: visit `/pago/checkout?...` with valid params → DevTools Network shows `POST /payments/attempts/.../event` with `eventType: "BRICK_LOADED"` within 5s of page load.
- [ ] Manual: block `sdk.mercadopago.com` via DevTools → `BRICK_ERROR` row written with `stage: "init"`.
- [ ] Existing onSubmit / processMpPayment flow unaffected.

### 3.4 Status

🟩 DONE — SHA: `b8da1fa`

---

## 4 — Commit 4: `USER_CLOSED_TAB` + Cancel button → `USER_CANCELLED`

**Goal:** capture the two remaining exit signals — tab close and deliberate cancel.

### 4.1 Files

- `frontend-next/src/app/[locale]/pago/checkout/page.tsx` — add `beforeunload` listener, add visible Cancel button.

### 4.2 `beforeunload` listener

```ts
useEffect(() => {
  const mountedAt = Date.now();
  const handler = () => {
    // Skip if the user already left via a terminal state. We don't
    // want USER_CLOSED_TAB on the success-redirect tick.
    if (status === "success") return;
    // Also skip during the brief programmatic navigation right after
    // a successful submit (we set a sentinel before router.push).
    if (suppressUnloadRef.current) return;
    reportPaymentAttemptEventBeacon(paymentId, {
      eventType: "USER_CLOSED_TAB",
      details: {
        brickStatus: status,
        msOnPage: Date.now() - mountedAt,
        hadBrickLoaded: brickReadyRef.current,
        gateway: "MP",
      },
    });
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [paymentId, status]);
```

A `suppressUnloadRef` is flipped to `true` immediately before `router.push(...)` in the success / cancel-button paths so we don't beacon `USER_CLOSED_TAB` on those legitimate navigations.

### 4.3 Cancel button

Render only while `status ∈ { loading, ready }`. Hidden during `processing` (don't let the user cancel mid-submit) and during terminal states.

```tsx
{(status === "loading" || status === "ready") && (
  <button
    type="button"
    onClick={() => {
      void reportPaymentAttemptEvent(paymentId, {
        eventType: "USER_CANCELLED",
        details: {
          source: "pago_checkout_cancel_button",
          brickStatus: status,
        },
      });
      suppressUnloadRef.current = true;
      router.push(poolId ? `/pools/${poolId}` : "/dashboard");
    }}
    style={{ /* secondary-button styling */ }}
  >
    {t("checkout.cancel")}
  </button>
)}
```

Translation key `payment.checkout.cancel` added to all three locale files (`es`, `en`, `pt`) — recall feedback `feedback_nextintl_no_fallback.md`.

### 4.4 i18n keys (all three locales)

| Key | ES | EN | PT |
|---|---|---|---|
| `payment.checkout.cancel` | "Cancelar y volver al pool" | "Cancel and go back" | "Cancelar e voltar" |

### 4.5 Acceptance

- [ ] `npx tsc --noEmit` in `frontend-next` passes.
- [ ] Manual A (close tab): open `/pago/checkout?...`, wait for `BRICK_LOADED`, close the tab. After ~1s the audit log shows a `USER_CLOSED_TAB` row with `msOnPage` ≈ time elapsed and `hadBrickLoaded: true`.
- [ ] Manual B (cancel button): open `/pago/checkout?...`, click "Cancelar y volver al pool". Audit log shows `USER_CANCELLED` row with `source: "pago_checkout_cancel_button"`. NO `USER_CLOSED_TAB` row from the navigation.
- [ ] Manual C (successful submit): pay with a test card. Audit log shows `BRICK_LOADED` + `MP_SYNC PAYMENT_COMPLETED` + NO `USER_CLOSED_TAB` from the post-success router.push.
- [ ] Manual D (i18n): switch to EN locale, button text is "Cancel and go back". Same for PT.

### 4.6 Status

🟩 DONE — SHA: `f7cafac`

---

## 5 — Commit 5: docs

### 5.1 Files

- `docs/DECISION_LOG.md` — ADR-066.
- `docs/BUSINESS_RULES.md` — §19 "Payment-attempt telemetry".
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — index entry to new `project_payment_attempt_telemetry.md`.
- New memory file: `project_payment_attempt_telemetry.md`.

### 5.2 ADR-066 outline

- **Context:** Owner asked on 2026-05-28 "cuando un usuario da click en pagar, saber si solo cerró la ventana, o hizo click en volver, o qué pasó". Forensic audit of two failed attempts by juank earlier that day showed PoolPayment in PENDING with `mpPaymentId=NULL` and only `REDIRECT_INITIATED` in PaymentEvent — backend had no idea what happened next.
- **Decision:** three new CLIENT_EVENT_TYPE values (`BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB`), `navigator.sendBeacon` for `beforeunload`, visible Cancel button on `/pago/checkout` that emits `USER_CANCELLED`.
- **Consequences:** ✅ For MP attempts we can now distinguish 5 states (loaded vs not, submitted vs not, cancelled vs closed-tab vs errored); ⚠️ no equivalent richness for Polar (out-of-domain limits); ⚠️ Brick failures during `init` vs `render` are heuristically tagged via a ref — accurate but not bulletproof if `onError` semantics change.

### 5.3 BUSINESS_RULES.md §19 outline

- §19.1: full taxonomy table of `CLIENT_EVENT_TYPE` with emit site and meaning.
- §19.2: lifecycle states the backend can reconstruct from PaymentEvent rows.
- §19.3: transport choice (`sendBeacon` for unload-safe events, `fetch` for normal flow).
- §19.4: forensic query examples (`SELECT eventType FROM PaymentEvent WHERE poolPaymentId = … ORDER BY createdAtUtc`).

### 5.4 Acceptance

- [ ] ADR-066 in DECISION_LOG.md.
- [ ] BUSINESS_RULES.md §19 added.
- [ ] MEMORY.md indexed + `project_payment_attempt_telemetry.md` written.

### 5.5 Status

🟥 PENDING — SHA: —

---

## Post-flight (after commit 4 lands)

Manual end-to-end verification against production:

- [ ] Owner does 1 fresh test attempt on MP, lets the Brick load, then closes the tab without submitting.
- [ ] Query: `SELECT "eventType", "payloadJson", "createdAtUtc" FROM "PaymentEvent" WHERE "poolPaymentId" = '<test row>' ORDER BY "createdAtUtc";` — should show `REDIRECT_INITIATED` → `BRICK_LOADED` → `USER_CLOSED_TAB`.
- [ ] Owner does 1 fresh test attempt, clicks the Cancel button. Sequence should be `REDIRECT_INITIATED` → `BRICK_LOADED` → `USER_CANCELLED` (source=`pago_checkout_cancel_button`).
- [ ] Owner does 1 successful test payment. Sequence: `REDIRECT_INITIATED` → `BRICK_LOADED` → `MP_SYNC PAYMENT_COMPLETED`. NO `USER_CLOSED_TAB` from the post-success router.push.
- [ ] Block `sdk.mercadopago.com` via DevTools → `BRICK_ERROR` row with `stage: "init"`.

---

## Rollback plan

- Revert 5 → docs lose references; harmless.
- Revert 4 → no `USER_CLOSED_TAB`, no Cancel button. Pre-cycle telemetry parity.
- Revert 3 → no `BRICK_LOADED` / `BRICK_ERROR`. Pre-cycle telemetry parity.
- Revert 2 → `sendBeacon` helper goes away. Commit 4 reverts depended on it, so revert 2 must follow revert 4.
- Revert 1 → enum values gone, route stops accepting `text/plain`. Commits 2–4 already reverted by this point, so no callers remain.

Sequence if everything goes wrong: revert in reverse order (5 → 4 → 3 → 2 → 1). Each commit is independent enough to revert without cascade.

---

## Document version

- v1 — 2026-05-28 — locked alongside `PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md` v1.
