# Attribution Taxonomy

> Single source of truth for UTM values, campaign names, and event naming
> across Picks4All. Every outbound link, email CTA, and ad destination
> MUST use values from this document. Drift here is what makes GA4 reports
> unreadable six months later.

**Last updated:** 2026-04-21

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

| Campaign                  | Triggered by                                |
|---------------------------|---------------------------------------------|
| `welcome`                 | First login after signup                    |
| `email_verification`      | Registration confirmation                   |
| `password_reset`          | Forgot-password flow                        |
| `password_changed`        | Password reset completion                   |
| `pool_invite`             | Pool invitation email                       |
| `deadline_reminder`       | Kickoff deadline alerts                     |
| `result_published`        | Match result notifications                  |
| `result_override`         | Host-override correction emails             |
| `pool_completed`          | Pool final results email                    |
| `pool_full`               | "Pool is full" host notification            |
| `new_member`              | Host: new member notifications              |
| `new_member_digest`       | Host: daily new-member digest               |
| `phase_completed`         | Tournament phase closure email              |
| `corporate_activation`    | Corporate-invite activation link            |
| `corporate_inquiry`       | Enterprise lead acknowledgement             |
| `payment_receipt`         | Post-purchase receipt                       |
| `prediction_update`       | AI prediction subscribers email             |
| `email_footer`            | Links in the email footer (terms, privacy…) |

#### Share / referral campaigns

| Campaign       | Trigger                                      |
|----------------|----------------------------------------------|
| `pool_share`   | User shares an existing pool                 |
| `pool_invite`  | User copies the explicit invite link         |

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
| `begin_checkout`    | Wizard submit         | `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx` |
| `add_payment_info`  | MP Brick submit       | `frontend-next/src/app/[locale]/pago/checkout/page.tsx` |
| `purchase`          | MP approval + Polar   | `frontend-next/src/app/[locale]/pago/exitoso/page.tsx`, backend `paymentService.ts` |
| `refund`            | Webhook only          | `backend/src/services/paymentService.ts` |

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
| `pricing_page_viewed`              | Deprecated — use `view_item_list`         |
| `language_changed`                 | Locale switcher                           |
| `feedback_submitted`               | In-app feedback modal                     |
| `corporate_inquiry`                | Enterprise inquiry form                   |
| `error_displayed`                  | User-facing error surfaced                |
| `notification_subscription_toggled`| Any opt-in toggle (`type`, `enabled`)     |
| `referral_conversion`              | Join via invite of another user           |

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
   `backend/src/lib/ga4.ts` and `backend/src/lib/metaCapi.ts`.

---

## 5. Anti-patterns to avoid

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
