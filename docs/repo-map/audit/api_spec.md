## Audit: docs/API_SPEC.md

**Overall verdict:** UPDATE (severity: major). The doc is broadly well-structured and most endpoint tables are accurate, but several sections contradict the shipped code in load-bearing ways (payment request bodies, unsubscribe behavior, service-to-service auth, invite-preview response shape) and several real endpoints are missing entirely (corporate branding + bulk-resend, `/me` aggregated/prediction-subscription, pool invite DELETE, admin settings scores toggle, `/payments/mp-process` and attempt-telemetry beacon). Verified against `backend/src/server.ts`, `routes/payments.ts`, `routes/corporate.ts`, `routes/unsubscribe.ts`, `routes/admin.ts`, and repo-map parts 06–07.

---

### §5.27 Payments — checkout request body (INCORRECT)
The doc documents `POST /payments/checkout` body as `{ "poolId", "toCapacity": 100, "poolType": "personal" | "corporate" }` and says mp-checkout has "same shape". The real `checkoutSchema` in `backend/src/routes/payments.ts` is:
```
{ poolId: uuid, targetCapacity: int 2–10000, accountReceivableId?: uuid }
```
- Field is `targetCapacity`, NOT `toCapacity`.
- There is NO `poolType` field.
- There IS an optional `accountReceivableId` (cuenta-de-cobro redemption) that the doc omits entirely.

**Fix:** Replace the body with `{ "poolId": "uuid", "targetCapacity": 100, "accountReceivableId"?: "uuid" }` and document the CC-redemption path. Note `mp-checkout` uses the identical schema (this part is correct).

### §5.27 Payments — missing endpoints (MISSING)
The Payments table omits two shipped endpoints present in `paymentsRouter`:
- `POST /payments/mp-process` — server-side processing of an MP Brick payment (`mpProcessSchema`: `paymentId` uuid, `formData`, optional `metaCookies.fbc/fbp`).
- `POST /payments/attempts/:paymentId/event` — payment-attempt telemetry beacon (`navigator.sendBeacon`, `beaconBodyParser`, `clientEventSchema` over `CLIENT_EVENT_TYPES`, returns 202). This is the ADR-066 telemetry surface referenced in MEMORY.

**Fix:** Add both rows. `mp-process` is `Auth: Yes`; the attempt-event endpoint is `Auth: Yes` and accepts text/plain beacon bodies.

### §5.29 Unsubscribe — describes unshipped scoped-token design (OBSOLETE/INCORRECT)
The doc describes a tokenized, scope-aware unsubscribe (`POST /unsubscribe` body `{ token, scope: "all" | "deadlineReminders" | "poolInvitations" | ... }`, errors `INVALID_TOKEN`/`TOKEN_EXPIRED`/`UNKNOWN_SCOPE`, "Updates the corresponding `User.email*` flag"). The real `routes/unsubscribe.ts` does NOT implement scopes:
- Both GET and POST read `token` from the query string and only set `emailNotificationsEnabled: false` (all-or-nothing).
- POST is RFC 8058 one-click (`List-Unsubscribe=One-Click`), token in QUERY not body, no `scope`.
- Errors are `MISSING_TOKEN`, `INVALID_TOKEN`, `USER_NOT_FOUND` — there is no `TOKEN_EXPIRED` or `UNKNOWN_SCOPE`.
- GET redirects to `${FRONTEND_URL}/unsubscribed` (no confirmation-page render in the backend).

**Fix:** Rewrite §5.29 to match: token in query for both verbs, all-notifications-off only, RFC 8058 one-click POST, error codes `MISSING_TOKEN`/`INVALID_TOKEN`/`USER_NOT_FOUND`, GET → redirect to `/unsubscribed`. (Per MEMORY, scoped unsubscribe is still a *pending task* — `project_unsubscribe_link.md` — so document current behavior, not the aspiration.)

### §5.10c Service-to-Service Active Matches — wrong auth scheme (INCORRECT)
Doc says auth is `Authorization: Bearer ${SCORES_SERVICE_API_KEY}`. The real `/api/active-matches` in `server.ts` reads the key from `req.headers["x-api-key"]` OR `req.query.key` (NOT a Bearer header). Errors: `NOT_CONFIGURED` (no env key) and `INVALID_API_KEY`. The response also includes `internalMatchId`, `instanceId`, `instanceName`, `leagueId`, `season`, `windowStart`, `windowEnd`, `timestamp` — not just the 4 fields shown.

**Fix:** Change auth to "`x-api-key: <SCORES_SERVICE_API_KEY>` header (or `?key=`), NOT user JWT" and expand the response example.

### §5.10b Invite Preview — wrong response shape (INCORRECT)
Doc shows `{ valid, pool: { name, memberCount, maxParticipants, tournament }, host: { displayName }, expired }`. The real `/invite-preview/:code` in `server.ts` returns a flat object: `{ poolName, tournamentName, hostName, memberCount, status, valid, organization }`. There is no nested `pool`/`host`, no `maxParticipants`, no top-level `expired`; instead there is `status` and an `organization` block (corporate branding: name/logoBase64/primaryColor/secondaryColor/welcomeMessage, or null). `valid` accounts for expiry, maxUses, and ARCHIVED status.

**Fix:** Replace the response example with the real flat shape including `organization`.

### §5.19 Corporate — missing endpoints (MISSING)
The corporate table omits two shipped routes in `corporateRouter`:
- `PATCH /corporate/pools/:poolId/branding` — edit organization branding post-creation (logo/colors/welcome/invitation messages/`invitationLocale`); records `OrganizationBrandingAudit`.
- `POST /corporate/pools/:poolId/employees/:inviteId/...` — actually the missing one is `POST /corporate/pools/:poolId/employees/bulk-resend-expired` (reissue all expired invites; shares the per-host invite send rate limits).

**Fix:** Add both rows. Both are `Auth: Yes` (host-only). `bulk-resend-expired` is subject to `inviteSendLimiter` + `inviteSendDailyLimiter`.

### §5.19 Corporate — inquiry body is stale (INCORRECT/MISSING)
`POST /corporate/inquiry` body in the doc only shows the legacy `employeeCount` tier. The real `inquirySchema` keeps `employeeCount` for back-compat but adds the quote-panel fields: `country` (ISO alpha-2), `currency` ("COP"|"USD"), `poolsConfig` (number[]), `numberOfPools`, `slotsPerPool`. These drive the sales/quote funnel (ADR-061).

**Fix:** Document the quote-panel fields and mark `employeeCount` as legacy/back-compat.

### §5.19 Corporate — create-pool body missing branding fields (MISSING)
`POST /corporate/pools` body in the doc omits `primaryColor` and `secondaryColor` (hex) and `invitationLocale` ("es"|"en"|"pt", default "es"), all present in `createCorporatePoolSchema`. `invitationLocale` is governed by ADR-062 (first-email locale).

**Fix:** Add `primaryColor`, `secondaryColor`, `invitationLocale` to the body example.

### §5.4 Me (Account) — missing endpoints (MISSING)
The `/me` table lists only `GET /me/pools` and email-preferences. Real `meRouter` (repo-map part-06) also exposes:
- `GET /me/aggregated` — analytics-oriented user_properties / CAPI dimensions snapshot.
- `GET /me/prediction-subscription` and `PUT /me/prediction-subscription` — read/toggle `user.predictionUpdates`.

Also `GET /me/email-preferences` and `PUT` accept a 6th flag (`emailNewMemberDigest`) — the doc shows only 5 prefs.

**Fix:** Add the aggregated and prediction-subscription rows; add the digest preference flag to the email-preferences bodies.

### §5.10 Pool Invites — missing DELETE (soft-revoke) (MISSING)
The doc lists invite create / send-email / join but omits `GET /pools/:poolId/invites` (list) and `DELETE /pools/:poolId/invites/:inviteId` (soft-revoke by setting `expiresAtUtc = now()`, preserving `acceptedByUserId` for referral attribution). Both exist in `poolInvitesRouter` (repo-map part-06).

**Fix:** Add the GET (list) and DELETE (soft-revoke) rows; note the soft-revoke invariant.

### §5.23 Admin Settings — missing scores toggle (MISSING)
The admin-settings table omits `GET /admin/settings/scores` and `PUT /admin/settings/scores` (read/write `platformSettings.scoresServiceEnabled`), present in `adminSettingsRouter` (repo-map part-06).

**Fix:** Add both rows.

### §5.23 Admin Settings — test-email types incomplete (INCORRECT)
`POST /admin/settings/email/test` doc lists 5 `type` values. The real `testEmailSchema` has 7: adds `newMemberDigest` and `phaseCompletionSummary`.

**Fix:** Add the two missing type enum values.

### §2 Authentication / §5.2 Auth — register/google attribution fields (MISSING, minor)
`POST /auth/register` (and `/auth/google`) accept additional fields per `registerSchema`/`attributionSchema`: Meta `fbp`/`fbc` ids and a full UTM/click-id/landing `attribution` object (ADR analytics). The doc's register body omits these. `POST /auth/google` response also returns `metaEventId` alongside `user` (repo-map part-06), not just `{ user }`.

**Fix:** Note the optional attribution/fb fields on register/google, and add `metaEventId` to the google response.

### §1 General — FRONTEND_URL fallback note (minor / informational)
`routes/unsubscribe.ts` still falls back to `http://localhost:5173` for `FRONTEND_URL`. This is the old Vite port; in production `FRONTEND_URL` is always set so it is harmless, but the stray `5173` fallback is dead/legacy. Not a doc error per se — flag for the source cleanup pass, not API_SPEC.

### Sections verified accurate (OK)
- §3 Rate Limiting table matches `server.ts` mounts + `corporate.ts` per-route limiters.
- §5.2 Auth endpoint inventory (register/login/logout/forgot/reset/google/verify-email GET+POST/resend/check-corporate-invite/activate-corporate) matches `authRouter`.
- §5.20 Admin General (ping/stats/bootstrap-admin disabled/trigger-fixture-tracking/prediction-update/seed-wc2026/update-ucl-r16/audit r16/fix-r16-integrity) matches `routes/admin.ts` exactly.
- §5.28 Webhooks (Polar raw-body mount before json, MP IPN with drift, Resend) matches `server.ts` + `payments.ts`.
- §5.25/§5.26 Analytics probe + dashboard match `analyticsHealth.ts` / `adminAnalyticsDashboard.ts`.
- Dual-gateway payments, sales/CC redemption, MP reconcilers, analytics DLQ are present in the codebase and (mostly) acknowledged by the doc — good.
