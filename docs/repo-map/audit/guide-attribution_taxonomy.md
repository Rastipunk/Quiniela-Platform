## Audit: docs/guides/ATTRIBUTION_TAXONOMY.md

**Verdict: UPDATE (minor).** The doc's *architecture* is accurate — `appendUtm`/`emailUtm`/`getShareUtm` exist as described, the GA4 MP + CAPI DLQ (`backend/src/lib/ga4.ts`, `backend/src/lib/metaCapi.ts`) is real with exactly the retry/DLQ design claimed, `buildUserData()` hashing exists, and the Consent Mode v2 default-before-loader ordering in `frontend-next/src/lib/gtm.ts` is implemented exactly as documented. The drift is in the *taxonomy tables*: several listed events/campaigns do not exist in code, a few shipped events are missing, and the payment-attempt telemetry pipeline is entirely unmentioned.

---

### Section 1 — utm_campaign / Transactional email campaigns — INCORRECT + MISSING

The "Transactional email campaigns" table does not match the campaign strings actually passed to `emailUtm(...)` in `backend/src/lib/email.ts`. The only campaign values present in code are:

- `corporate_activation`
- `email_verification`
- `group_standings_override`
- `knockout_winner_override`
- `password_reset`
- `pool_reverted_to_draft`
- `prediction_update`
- `result_override`

Problems:
- **Listed but not used as a UTM campaign:** `welcome`, `password_changed`, `pool_invite` (transactional), `deadline_reminder`, `result_published`, `pool_completed`, `pool_full`, `new_member`, `new_member_digest`, `phase_completed`, `corporate_inquiry`, `payment_receipt`, `email_footer`. Either these emails contain no UTM-tagged CTA (so the row is aspirational, not real) or the names are invented. Mark them as planned/unimplemented or remove them.
- **Real campaigns missing from the doc:** `group_standings_override`, `knockout_winner_override`, `pool_reverted_to_draft`. These ship today and should be in the table.

**Fix:** Regenerate this table from the actual `emailUtm("…")` call sites in `email.ts`, and split "shipped" vs "reserved/planned" so the doc stops claiming to be the SOT while diverging from code.

### Section 1 — utm_content default — OK

`emailUtm(campaign, content = "cta_button")` confirms `cta_button` is the default content value (`backend/src/lib/utm.ts:26`). Accurate.

### Section 1 — Share / referral campaigns — INCORRECT (incomplete)

`frontend-next/src/lib/utm.ts` `getShareUtm()` maps `ShareContext` of `poolInvite | poolShare | poolLeaderboard | poolPredictions` to campaign `pool_invite` (only when `poolInvite`) else `pool_share`, with `utm_content` set to the raw context string (e.g. `poolLeaderboard`, `poolPredictions`). The doc only documents `pool_share` and `pool_invite` and omits the `poolLeaderboard` / `poolPredictions` content variants and the camelCase `utm_content` values actually emitted (which contradicts the "lowercase snake_case" content rule in §utm_content).

**Fix:** Document the four share contexts and note that `getShareUtm` emits camelCase `utm_content` (`poolInvite`, `poolShare`, `poolLeaderboard`, `poolPredictions`), which violates the snake_case convention stated elsewhere — reconcile one way or the other.

### Section 2 — Funnel events table — MOSTLY OK, two location errors

Verified against `frontend-next/src/lib/ecommerce.ts` and call sites:
- `view_item_list` → `precios/PricingPageContent.tsx`. Correct.
- `view_item` → `pool-wizard/steps/StepCapacity.tsx`. Correct.
- `begin_checkout` → doc says only `PoolCreationWizard.tsx` ("Wizard submit"). **Incomplete:** also fired from `pools/[poolId]/components/PoolCapacityTab.tsx` (capacity upgrade of an existing pool). Add that dispatcher.
- `add_payment_info` → `pago/checkout/page.tsx`. Correct (MP Brick submit).
- `purchase` → doc lists `pago/exitoso/page.tsx` + backend `paymentService.ts`. **Incomplete/imprecise:** the browser `trackPurchase` is fired from BOTH `pago/exitoso/page.tsx` AND `pago/checkout/page.tsx` (on MP approval). Backend emission is via GA4 MP (`ga4.ts`) / CAPI, not "paymentService.ts" directly. Affiliation values in code are exactly `"Mercado Pago Colombia"` / `"Polar International"` — worth citing.
- `refund` → ecommerce.ts `trackRefund` exists; "webhook only" is plausible. OK.

### Section 2 — Engagement events table — INCORRECT + MISSING

Cross-checked against every `trackEvent("…")` call in `frontend-next/src`:
- **`pricing_page_viewed` does not exist anywhere in code.** The "Deprecated — use view_item_list" row should be deleted, not retained.
- **`referral_conversion` does not exist anywhere in code.** Remove or mark as planned.
- **Real events missing from the doc:** `begin_registration` (`AuthSlidePanel.tsx`), `corporate_quote_submitted` (`CorporateQuotePanel.tsx`), `corporate_quote_opened` (`EnterpriseLandingContent.tsx`), `payment_cancelled` (`pago/cancelado/page.tsx`).
- `corporate_inquiry` is listed as both an engagement event AND (in §1) a transactional email campaign; the event exists (`EnterpriseLandingContent.tsx`) but the email campaign of that name does not — see Section 1 finding.
- Remaining listed events (`sign_up`, `login`, `consent_update`, `pool_created`, `pool_viewed`, `pool_joined`, `pick_saved`, `invite_code_created`, `share_pool`, `tab_changed`, `wizard_step`, `cta_clicked`, `language_changed`, `feedback_submitted`, `error_displayed`, `notification_subscription_toggled`) all verified present. OK.

**Fix:** Delete the two phantom events, add the four shipped ones, and disambiguate `corporate_inquiry` (event vs nonexistent campaign).

### Section 2 — Reserved params / first_time — OK

`pool_viewed` is fired from `pools/[poolId]/page.tsx`; `items[]` canonical shape lives in `ecommerce.ts` as documented. `transaction_id` dedup design matches `trackPurchase`. Accurate.

### Section 3 — User properties — MINOR (incomplete)

`setUserProperties` in `frontend-next/src/lib/analytics.ts` accepts the documented properties (`tier`, `is_corporate`, `country`, `pool_count`, `paid_pool_count`, `account_age_days`, `platform_role`, `acquisition_source`, `acquisition_campaign`) but ALSO supports several the doc omits: `is_verified_email`, `signup_method`, `predictions_count`, `last_active_at`, `pool_host_count`. The truncation is 36 chars (matches), but the doc's "<= 24 chars" name limit is the GA4 rule, not enforced in code — fine to keep as guidance. `/me/aggregated` endpoint exists (`backend/src/routes/me.ts`).

**Fix:** Add the five additional supported user properties to the table.

### Section 4 — Server-side conventions / DLQ — OK

Confirmed: `backend/src/lib/ga4.ts` (`sendGa4Event`, `retryFailedGa4EventsBatch`) and `backend/src/lib/metaCapi.ts` (`sendCapiEvent`, `retryFailedCapiEventsBatch`, `buildUserData`) each implement in-process retry → `FailedCapiEvent` DLQ with `MAX_DLQ_ATTEMPTS=8` and identical `DLQ_BACKOFF_MINUTES`. The `event_id`/`transaction_id` dedup claims hold. Accurate.

### Section 5 — Anti-patterns — OK

`appendUtm` + `emailUtm` exist; `buildUserData()` hashes PII; `gtm.ts` enforces consent-default-before-loader. All accurate.

### MISSING SUBSYSTEM — Payment-attempt telemetry (F-13)

The doc covers GA4/CAPI conversions but never mentions the **payment-attempt lifecycle telemetry** that is a distinct, shipped attribution/observability channel: `frontend-next/src/lib/api/paymentAttemptEvent.ts` emits seven `ClientEventType`s (`REDIRECT_INITIATED`, `REDIRECT_FAILED`, `USER_CANCELLED`, `CLIENT_ERROR`, `BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB`) to `POST /payments/attempts/:paymentId/event`, persisted as `PaymentEvent` rows with `source=CLIENT` (backend `recordClientEvent` in `paymentService.ts`), using `navigator.sendBeacon` with a `text/plain` body for unload-safe delivery. This is ADR-066 territory and belongs in this taxonomy doc (or at least a cross-reference) since it is a parallel event-naming surface.
