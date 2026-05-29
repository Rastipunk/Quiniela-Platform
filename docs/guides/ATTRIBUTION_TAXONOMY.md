# Attribution Taxonomy

> Single source of truth for UTM values, campaign names, and event naming
> across Picks4All. Every outbound link, email CTA, and ad destination
> MUST use values from this document. Drift here is what makes GA4 reports
> unreadable six months later.

**Last updated:** 2026-05-04

---

## 1. UTM parameter conventions

All UTMs are generated via `backend/src/lib/utm.ts` (server) or
`frontend-next/src/lib/utm.ts` (client). Never hand-roll query strings.

### `utm_source` (required)

Identifies the **discrete origin** that produced the click. Lowercase,
snake_case, no spaces.

| Value            | When to use                                    |
|------------------|------------------------------------------------|
| `email`          | Any transactional or marketing email           |
| `whatsapp`       | WhatsApp share button                          |
| `facebook`       | Facebook share button                          |
| `twitter`        | X / Twitter share button                       |
| `clipboard`      | "Copy link" share action                       |
| `native_share`   | `navigator.share` Web Share API fallback       |
| `google_ads`     | Paid Google Ads (gclid must also be present)   |
| `meta_ads`       | Paid Meta Ads (fbclid must also be present)    |
| `tiktok_ads`     | Paid TikTok Ads                                |
| `organic_search` | Manual URL builder for SEO campaigns           |
| `newsletter`     | Recurring newsletter emails                    |

### `utm_medium` (required)

Identifies the **channel class**, not the platform.

| Value       | Meaning                           | Typical source pairs              |
|-------------|-----------------------------------|-----------------------------------|
| `email`     | Email delivery                    | `email`, `newsletter`             |
| `social`    | Organic social shares             | `whatsapp`, `facebook`, `twitter` |
| `cpc`       | Cost-per-click ads                | `google_ads`, `meta_ads`          |
| `referral`  | User-to-user invitation link      | `clipboard`, `native_share`       |
| `organic`   | SEO / blog / direct                | `organic_search`                  |

### `utm_campaign` (required)

Identifies the **business campaign**. Use lowercase snake_case. A new
campaign name must be declared here before being used in production.

#### Transactional email campaigns (automated)

These are the only campaign strings passed to `emailUtm(...)` in
`backend/src/lib/email.ts`. A transactional email appears here **only**
if it contains a UTM-tagged CTA — many notification emails (welcome,
deadline reminders, new-member digests, etc.) link out without UTM
tagging and therefore are not campaigns.

| Campaign                   | Triggered by                                 | Call site (`email.ts`) |
|----------------------------|----------------------------------------------|------------------------|
| `email_verification`       | Registration confirmation link               | `email_verification`   |
| `password_reset`           | Forgot-password reset link                   | `password_reset`       |
| `corporate_activation`     | Corporate-invite activation link             | `corporate_activation` |
| `result_override`          | Host result-override correction email        | `result_override`      |
| `group_standings_override` | Host group-standings override email          | `group_standings_override` |
| `knockout_winner_override` | Host knockout-winner override email          | `knockout_winner_override` |
| `pool_reverted_to_draft`   | Pool auto-reverted ACTIVE → DRAFT notice     | `pool_reverted_to_draft` |
| `prediction_update`        | AI prediction subscribers email (CTA + unsubscribe) | `prediction_update` |

The `prediction_update` email is the only transactional email with two
UTM-tagged links: the CTA (`utm_content=cta_button`, default) and the
unsubscribe link (`utm_content=unsubscribe`).

#### Share / referral campaigns

`frontend-next/src/lib/utm.ts` `getShareUtm(platform, context)` maps the
four `ShareContext` values to a campaign and copies the **raw context
string** into `utm_content`. Only `poolInvite` produces the `pool_invite`
campaign; the other three contexts collapse to `pool_share`.

| `ShareContext`    | Campaign      | `utm_content`     |
|-------------------|---------------|-------------------|
| `poolInvite`      | `pool_invite` | `poolInvite`      |
| `poolShare`       | `pool_share`  | `poolShare`       |
| `poolLeaderboard` | `pool_share`  | `poolLeaderboard` |
| `poolPredictions` | `pool_share`  | `poolPredictions` |

> **Known convention violation:** `getShareUtm` emits **camelCase**
> `utm_content` values (`poolInvite`, `poolShare`, `poolLeaderboard`,
> `poolPredictions`), which contradicts the lowercase snake_case rule for
> `utm_content` stated below. This is intentional drift left in place to
> avoid breaking existing share-link history in GA4; treat the share
> contexts as the documented exception, and keep all *email* `utm_content`
> values snake_case.

#### Marketing campaigns (ad buys)

Campaign names for ad buys live in the ads dashboard, but MUST follow
the pattern `{product}_{goal}_{geo}_{period}`:

- `mundial2026_signup_co_2026q2`
- `mundial2026_signup_intl_2026q2`
- `corporate_lead_intl_2026q2`

### `utm_content` (optional)

Identifies **which specific CTA or variant** inside the same campaign
produced the click. Lowercase, snake_case.

Standard values:

| Value                | Meaning                                      |
|----------------------|----------------------------------------------|
| `cta_button`         | Primary CTA button (default)                 |
| `secondary_cta`      | Alternative link in the same email           |
| `preheader`          | Text preview above email body                |
| `footer_link`        | Footer anchor (terms, privacy, preferences)  |
| `unsubscribe`        | Unsubscribe link in a subscription email     |
| `terms` / `privacy`  | Specific legal footer link                   |
| `preferences`        | Email preferences link                       |

### `utm_term` (optional)

Used only for paid search campaigns (`utm_medium=cpc`) to capture the
ad group or keyword. Leave empty elsewhere.

---

## 2. Event naming

GA4 custom events follow **snake_case** and are limited to 40 characters.
Every event must appear in this table. Adding a new event requires
updating this file in the same PR.

### Funnel events (canonical GA4 ecommerce)

| Event               | Dispatcher            | File reference                          |
|---------------------|-----------------------|-----------------------------------------|
| `view_item_list`    | Pricing page          | `frontend-next/src/app/[locale]/precios/PricingPageContent.tsx` |
| `view_item`         | Capacity selector     | `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx` |
| `begin_checkout`    | Wizard submit + capacity upgrade | `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx`, `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` |
| `add_payment_info`  | MP Brick submit       | `frontend-next/src/app/[locale]/pago/checkout/page.tsx` |
| `purchase`          | MP approval + success page | `frontend-next/src/app/[locale]/pago/checkout/page.tsx` (on MP approval), `frontend-next/src/app/[locale]/pago/exitoso/page.tsx` |
| `refund`            | Webhook only          | `frontend-next/src/lib/ecommerce.ts` (`trackRefund`) |

The canonical builders live in `frontend-next/src/lib/ecommerce.ts`
(`trackViewItemList`, `trackViewItem`, `trackBeginCheckout`,
`trackAddPaymentInfo`, `trackPurchase`, `trackRefund`). `purchase` is
fired twice on purpose — from the checkout page on MP Brick approval and
again from the success page — and deduplicated by `transaction_id`. The
`affiliation` parameter is exactly `"Mercado Pago Colombia"` (COP) or
`"Polar International"` (USD). Server-side conversions are emitted via GA4
Measurement Protocol (`backend/src/lib/ga4.ts`) and Meta CAPI
(`backend/src/lib/metaCapi.ts`), sharing the same `transaction_id`.

### Engagement events

| Event                              | Trigger                                   |
|------------------------------------|-------------------------------------------|
| `sign_up`                          | Registration success (email / Google)     |
| `login`                            | Login success                             |
| `consent_update`                   | Cookie-consent banner change              |
| `pool_created`                     | Pool creation success                     |
| `pool_viewed`                      | Pool detail page load (`first_time` flag) |
| `pool_joined`                      | Accept invite code                        |
| `pick_saved`                       | User saves a match prediction             |
| `invite_code_created`              | Host generates new invite link            |
| `share_pool`                       | Share-button click                        |
| `tab_changed`                      | Pool-page tab change                      |
| `wizard_step`                      | Pool creation wizard step transition      |
| `cta_clicked`                      | Landing page CTA                          |
| `begin_registration`               | Registration form opened (`AuthSlidePanel.tsx`) |
| `language_changed`                 | Locale switcher                           |
| `feedback_submitted`               | In-app feedback modal                     |
| `corporate_inquiry`                | Enterprise inquiry form (`EnterpriseLandingContent.tsx`) |
| `corporate_quote_opened`           | Corporate quote panel opened (`EnterpriseLandingContent.tsx`) |
| `corporate_quote_submitted`        | Corporate quote submitted (`CorporateQuotePanel.tsx`) |
| `payment_cancelled`                | Payment cancel page mount (`pago/cancelado/page.tsx`) |
| `error_displayed`                  | User-facing error surfaced                |
| `notification_subscription_toggled`| Any opt-in toggle (`type`, `enabled`)     |

`corporate_inquiry` is a GA4 **event** only. There is no transactional
email campaign of the same name — do not confuse it with §1.

### Reserved params (must keep their canonical names)

- `transaction_id` — GA4 deduplication key for purchase/refund
- `currency` — ISO 4217
- `value` — numeric major units (dollars for USD, pesos for COP)
- `items[]` — GA4 ecommerce array. See `frontend-next/src/lib/ecommerce.ts` for the canonical item shape.
- `first_time` — boolean, used on `pool_viewed` to split activation vs engagement

---

## 3. User properties

Set via `setUserProperties()` after login and after any mutation that
changes the user's segment. Names kept <= 24 chars and values <= 36 chars
(GA4 limits).

| Property               | Type             | Source                         |
|------------------------|------------------|--------------------------------|
| `tier`                 | `free` / `paid`  | `GET /me/aggregated`           |
| `is_corporate`         | boolean          | `GET /me/aggregated`           |
| `country`              | ISO 2 char       | `User.country`                 |
| `pool_count`           | number           | active memberships             |
| `paid_pool_count`      | number           | `PoolPayment.status=COMPLETED` |
| `account_age_days`     | number           | `createdAtUtc`                 |
| `platform_role`        | string           | `User.platformRole`            |
| `acquisition_source`   | string           | first-touch UTM                |
| `acquisition_campaign` | string           | first-touch UTM                |
| `is_verified_email`    | boolean          | `User.emailVerifiedAt`         |
| `signup_method`        | `email` / `google` | registration method          |
| `predictions_count`    | number           | saved picks across pools       |
| `last_active_at`       | ISO 8601 UTC     | most recent pick / session     |
| `pool_host_count`      | number           | pools where user is HOST        |

All eleven properties above are accepted by `setUserProperties()` in
`frontend-next/src/lib/analytics.ts`. The helper truncates string values
to 36 chars (GA4 value limit) and skips `undefined` / `null`. The "<= 24
char name" guidance is the GA4 platform rule; it is not enforced in code.

---

## 4. Server-side conventions

Server events share the `transaction_id` with the browser emission so
GA4 dedupes natively. For Meta CAPI, always supply `event_id` so the
Events Manager "deduplication" view collapses paired events.

When adding a new server-side conversion:

1. Choose a stable identifier for the "thing" being tracked (paymentId,
   eventId, subscriptionId). Persist it in the DB.
2. Emit the same identifier to **both** the browser (via API response)
   and the server-to-server call.
3. GA4 MP and Meta CAPI each have their own retry + DLQ handled by
   `backend/src/lib/ga4.ts` (`sendGa4Event`, `retryFailedGa4EventsBatch`)
   and `backend/src/lib/metaCapi.ts` (`sendCapiEvent`,
   `retryFailedCapiEventsBatch`, `buildUserData`). Both implement an
   in-process attempt that, on failure, persists to the `FailedCapiEvent`
   dead-letter queue with `MAX_DLQ_ATTEMPTS = 8` and the same backoff
   schedule `DLQ_BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440, 1440]`.
   The DLQ is drained by `capiRetryJob` (see `guides/ANALYTICS_PIPELINE.md`
   for the retry/advisory-lock detail).

`buildUserData()` SHA-256 hashes every PII field (email, phone, name)
before it reaches Meta — never pass raw PII to CAPI.

---

## 5. Payment-attempt telemetry

Distinct from the GA4/CAPI conversion pipeline, the platform records a
**payment-attempt lifecycle** channel that captures what happens inside
the gateway round-trip — information webhooks cannot supply (ADR-066).

`frontend-next/src/lib/api/paymentAttemptEvent.ts` emits seven
`ClientEventType` beacons to `POST /payments/attempts/:paymentId/event`:

| Event               | Fired when                                          |
|---------------------|-----------------------------------------------------|
| `REDIRECT_INITIATED`| Immediately before `window.location.href` to gateway |
| `REDIRECT_FAILED`   | Redirect assignment throws synchronously             |
| `USER_CANCELLED`    | `/pago/cancelado` mounts                             |
| `CLIENT_ERROR`      | Any catch block during the flow                      |
| `BRICK_LOADED`      | Mercado Pago Payment Brick finished mounting         |
| `BRICK_ERROR`       | MP Brick reported an error                           |
| `USER_CLOSED_TAB`   | `beforeunload` / `pagehide` during checkout          |

Beacons persist as `PaymentEvent` rows with `source=CLIENT` via
`recordClientEvent` in `backend/src/services/paymentService.ts`.
Unload-safe events (`USER_CLOSED_TAB`) use `navigator.sendBeacon` with a
`text/plain` Blob body — a CORS simple request that avoids the preflight
that would otherwise race the page teardown. All beacons are best-effort:
delivery failures are swallowed and never block the payment flow.

These event names are a **separate naming surface** from the GA4 event
taxonomy in §2 — they are never pushed to the GTM dataLayer and must not
be conflated with GA4 events.

---

## 6. Anti-patterns to avoid

- ❌ Hand-building UTM strings. Use `appendUtm()` + `emailUtm()`.
- ❌ Mixed case in UTM values. GA4 treats `Email` and `email` as different.
- ❌ Changing an existing campaign name to "fix" it. Pre-existing data
  references the old name — create a new campaign instead.
- ❌ Firing `purchase` twice for the same transaction from the same
  surface. Dedup by `transaction_id` is free; just don't spam.
- ❌ Storing PII unhashed on CAPI user_data. `buildUserData()` hashes
  every PII field — don't bypass it.
- ❌ Consent Mode `default` pushed AFTER the GTM loader. Must come
  first; see `frontend-next/src/lib/gtm.ts`.
