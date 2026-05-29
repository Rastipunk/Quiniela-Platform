## Batch 6

This batch covers 18 Express route modules in `backend/src/routes/`. They share a consistent architecture: a thin HTTP layer that (1) validates input with Zod, (2) delegates business logic to a sibling service in `services/`, and (3) maps results/errors to standardized JSON responses via the `lib/apiResponse` helpers (`sendData`, `sendOk`, `sendCreated`, `sendBadRequest`, `sendUnauthorized`, `sendForbidden`, `sendNotFound`, `sendConflict`, `sendInternal`). Most routers repeat two private helpers — `auditCtx(req)` (extracts `{ ip, userAgent }` for `AuditContext`) and `handleServiceError(res, err)` (maps a thrown `ServiceError.statusHint` to the matching `send*` helper, re-throwing or logging unexpected errors).

---

### backend/src/routes/adminInstances.ts

**Purpose:** Admin-only HTTP layer for managing tournament *instances* (live runs of a published template) — lifecycle transitions, tournament advancement, result-source config, match-to-API mappings, and synchronization.

**What it does:**
- Creates `adminInstancesRouter` and applies `requireAuth, requireAdmin` to every route via `router.use`.
- Defines `auditCtx` and `handleServiceError`. Notably the error mapper handles 400/404/409/500 from a lookup table and falls through to `sendError(res, err.statusHint, err.code)` for custom codes (e.g. 503).
- **Zod schemas:** `createInstanceSchema` (optional `name`, optional `templateVersionId`), `advanceKnockoutSchema` (`currentPhaseId`/`nextPhaseId`), `advanceTwoLeggedSchema` (`currentRound`/`nextRound`/optional `poolId`), `resultSourceConfigSchema` (`resultSourceMode` MANUAL|AUTO, optional API-Football league/season ids, `syncEnabled`), `matchMappingSchema` (`internalMatchId` + `apiFootballFixtureId`), `bulkMappingsSchema` (array 1–200).
- **Lifecycle routes:** `POST /templates/:templateId/instances` (create → `createInstance`), `POST /instances/:instanceId/activate|complete|archive` (state transitions), `GET /instances` (list), `GET /instances/:instanceId` (detail).
- **Tournament advancement:** `POST /instances/:instanceId/advance-to-r32`, `.../advance-knockout`, `.../advance-two-legged`; `GET /instances/:instanceId/group-stage-status`; `POST /instances/:instanceId/update-r16-draw`.
- **Result source config:** `PUT /instances/:instanceId/result-source` → `configureResultSource`.
- **Match mappings:** `POST` (bulk create), `GET` (list), `DELETE /.../match-mappings/:mappingId`.
- **Sync:** `POST /instances/:instanceId/sync`, `GET /instances/:instanceId/sync-status`, `POST /sync/trigger-all` (global sync), `GET /sync/status` (global status).

**Exports:** `adminInstancesRouter` (named).

**Key dependencies:** `services/adminInstanceService` (all 18 imported functions), `middleware/requireAuth`/`requireAdmin`, `services/authService` (`ServiceError`, `AuditContext`), `lib/apiResponse`, `zod`.

**Flags:** none.

---

### backend/src/routes/adminSales.ts

**Purpose:** Admin-only Sales Management endpoints — issuing/listing quotes and accounts receivable ("cuentas de cobro"), rendering their PDFs, and status transitions. Implements the Quote + Cuenta de Cobro stack (ADR-061).

**What it does:**
- `adminSalesRouter` gated by `requireAuth, requireAdmin`.
- `handleServiceError` maps 400/401/403/404/409 (default `sendInternal`) and logs unexpected errors. `asRecord<T>` casts typed service results to `Record<string, unknown>` for the response helpers.
- **Zod schemas:** `LocaleEnum` (es/en/pt), `CurrencyEnum` (COP/USD). `TermEnum` is built dynamically from `SALE_TERMS` and then `.refine`d per-document against `isTermValidForLocale` (so e.g. "polla" can't pass for `locale:"en"`). `issueQuoteSchema` (client name/email, issue/validUntil dates, locale, term, participants, currency, optional tournament/investmentDescription/includeCoverPage/notes). `issueCcSchema` (adds clientNit/city, `concept`, `targetCapacity`, optional `poolType:"corporate"`, optional `linkedQuoteId`). `listFiltersSchema` (clientEmail/status/date range/page/limit). `quoteStatusUpdateSchema` (only CANCELLED). `ccStatusUpdateSchema` (CANCELLED|PAID).
- **Quote routes:** `POST /quotes` (`issueQuote`), `GET /quotes` (filtered list), `GET /quotes/:id`, `GET /quotes/:id/pdf` (streams `renderQuotePdf` buffer with Content-Disposition `<consecutive>.pdf`), `PATCH /quotes/:id/status` (v1 only supports CANCELLED → `cancelQuote`).
- **Account-receivable routes:** `POST /account-receivables` (`issueAccountReceivable`), `GET` list, `GET /:id`, `GET /:id/pdf` (`renderCcPdf`), `PATCH /:id/status` (CANCELLED → `cancelAccountReceivable`, PAID → `markAccountReceivablePaid`).

**Exports:** `adminSalesRouter` (named).

**Key dependencies:** `services/sales/quoteService`, `services/sales/accountReceivableService`, `lib/saleTerms` (`isTermValidForLocale`, `SALE_TERMS`, `SaleLocale`), `pdf/renderQuotePdf`, `pdf/renderCcPdf`, `services/authService` (`ServiceError`).

**Flags:** In `GET /quotes`/`GET /account-receivables` the `status` query value is cast straight to the union type without validating against the enum — the inline comment says non-matching values are "ignored" but no actual filter prevents a typo'd status from reaching the service. Low severity; behavior depends on the service.

---

### backend/src/routes/adminSettings.ts

**Purpose:** Admin-only platform configuration — global email-notification toggles, sending test emails, manually running deadline reminders, viewing reminder stats, and toggling the real-time scores service.

**What it does:**
- `router` gated by `requireAuth, requireAdmin`. Defines local `AuthenticatedRequest` interface.
- **`GET /email`** — reads (or lazily creates) the `platformSettings` singleton row (`id:"singleton"`), returns the four email-enabled flags plus `updatedBy` metadata (resolved from `updatedById`).
- **`PUT /email`** — validates `updateEmailSettingsSchema` (4 optional booleans), computes a per-field `changes` diff vs current settings, upserts the singleton, writes a `PLATFORM_EMAIL_SETTINGS_UPDATED` audit event, and returns the new settings + changes. No-op short-circuits when nothing changed.
- **`POST /email/test`** — validated by `testEmailSchema` (type enum of 7 email kinds + `to` email). Resolves locale (query override or `resolveUserLocale`), builds fully-populated fake data, and dispatches the matching `send*Email` from `lib/email` (welcome, poolInvitation, deadlineReminder, resultPublished, poolCompleted, newMemberDigest, phaseCompletionSummary). Writes a `TEST_EMAIL_SENT` audit event and reports success/skip/error.
- **`POST /email/reminders/run`** — `runRemindersSchema` (`hoursBeforeDeadline` 1–168 default 24, `dryRun` default false). Calls `processDeadlineReminders`, writes `DEADLINE_REMINDERS_EXECUTED` audit event with counts.
- **`GET /email/reminders/stats`** — `reminderStatsQuerySchema` (`poolId` uuid optional, `days` 1–365 default 7) → `getDeadlineReminderStats`.
- **`GET /scores`** / **`PUT /scores`** — read/write `platformSettings.scoresServiceEnabled`. PUT validates `enabled` is boolean, upserts, fires a `PLATFORM_SETTING_CHANGED` audit event via `fireAndForget`.

**Exports:** `adminSettingsRouter` (named, re-export of `router`).

**Key dependencies:** `db` (prisma), `lib/email` (7 senders), `lib/constants` (`resolveUserLocale`), `services/deadlineReminderService`, `lib/audit` (`writeAuditEvent`), `lib/asyncHelpers` (`fireAndForget`).

**Flags:** In `phaseCompletionSummary` the `phaseName` ternary yields the same Spanish "Fase de Grupos" for both `pt` and the default branch — a latent i18n gap, but it is test-only data. Otherwise clean.

---

### backend/src/routes/adminTemplates.ts

**Purpose:** Admin-only CRUD for tournament *templates* and their versioned `dataJson` payloads (create template, create/edit DRAFT versions, publish a version, list).

**What it does:**
- `adminTemplatesRouter` gated by `requireAuth, requireAdmin`.
- **Schemas:** `createTemplateSchema` (`key`/`name`/optional `description`), `createVersionSchema` (`dataJson: z.any()` — real shape validated separately).
- **`validateTemplateData(dataJson)`** — runs `templateDataSchema.safeParse` then `validateTemplateDataConsistency`; returns `{ok,data}` or `{ok:false,details}`.
- **`POST /templates`** — rejects duplicate `key` (409), creates a DRAFT `tournamentTemplate`, audits `TEMPLATE_CREATED`.
- **`POST /templates/:templateId/versions`** — validates dataJson, confirms template exists, computes next `versionNumber`, creates a DRAFT `tournamentTemplateVersion`, audits `TEMPLATE_VERSION_CREATED`.
- **`PUT /.../versions/:versionId`** — only DRAFT versions editable (409 otherwise), re-validates and updates `dataJson`, audits `TEMPLATE_VERSION_UPDATED`.
- **`POST /.../versions/:versionId/publish`** — only DRAFT publishable, re-validates, then in a `$transaction` sets the version to PUBLISHED with `publishedAtUtc` and updates the template to PUBLISHED with `currentPublishedVersionId`. Audits `TEMPLATE_VERSION_PUBLISHED`.
- **`GET /templates`** (with `currentPublishedVersion`) and **`GET /templates/:templateId/versions`**.

**Exports:** `adminTemplatesRouter` (named).

**Key dependencies:** `db` (prisma), `schemas/templateData` (`templateDataSchema`, `validateTemplateDataConsistency`), `lib/audit`, `@prisma/client` (`Prisma.InputJsonValue`).

**Flags:** none.

---

### backend/src/routes/analyticsHealth.ts

**Purpose:** Admin-only diagnostic endpoint that synthetically exercises the live analytics stack (GA4 Measurement Protocol, Meta CAPI, DLQ backlog, frontend HTML markers) to answer "is tracking wired correctly right now?"

**What it does:**
- Reads analytics env vars at module load (`GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`, `FRONTEND_URL`).
- **`envVarReport()`** — returns presence-only booleans (never values) for each backend var plus a note that `NEXT_PUBLIC_*` vars are build-time-only.
- **`probeGa4(userId)`** — derives a hashed `client_id` and POSTs an `analytics_health_probe` event to Google's `debug/mp/collect` validation endpoint; surfaces `validationMessages[]` as errors.
- **`probeMetaCapi(userId)`** — POSTs an `AnalyticsHealthProbe` event with hashed `external_id` and `test_event_code` (if set) to `graph.facebook.com/v21.0/{pixel}/events`; reports `events_received`/`fbtrace_id`/`messages`.
- **`probeDlqBacklog()`** — counts unresolved `failedAnalyticsEvent` rows, finds the oldest, groups unresolved by provider, counts resolved. Returns ok when zero, else error with breakdown.
- **`probeFrontendHtml()`** — fetches `FRONTEND_URL` HTML and regex-checks for GTM container id, GA4 id, FB pixel, Consent Mode v2 default, and `dataLayer` initialiser; reports missing markers.
- **`GET /probe`** (re-applies `requireAuth, requireAdmin`) — runs all four probes in parallel, computes an `overall` ok/error/degraded verdict, returns `{overall, timestamp, checks, envVars}`. Never throws.
- **`POST /probe/send-real-purchase`** — `sendRealSchema` requires `allowReal: literal(true)` + optional `transactionId`. Dynamically imports `lib/ga4` + `lib/metaCapi` and emits a REAL synthetic `purchase`/`Purchase` ($0.01) event, reporting per-sink "sent"/"skipped" so the UI can't claim a send when env vars are missing.

**Exports:** `analyticsHealthRouter` (named).

**Key dependencies:** `crypto`, `db` (prisma `failedAnalyticsEvent`), dynamic `lib/ga4` (`sendGa4Event`), `lib/metaCapi` (`sendCapiEvent`), global `fetch`.

**Flags:** In `probeDlqBacklog` the threshold expression `unresolved > 1_000 ? "error" : "error"` always yields `"error"` — a dead/no-op ternary with an inline comment acknowledging it ("keep error for now; could split to warn tier later"). Cosmetic/dead branch, low severity.

---

### backend/src/routes/auth.ts

**Purpose:** Thin HTTP layer for authentication — register, login, password reset, Google OAuth, email verification, corporate-invite activation, resend verification, logout. Sets/clears auth cookies and signs JWTs.

**What it does:**
- `authRouter` (no global middleware; auth applied per-route where needed).
- **Schemas:** `attributionSchema` (strict, all-optional UTM/click-id/landing fields capped at 200/500 chars), `registerSchema` (email/username/displayName/password with `isPasswordValid` refine, timezone, accept flags, fb ids, attribution), `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `googleAuthSchema`, `verifyEmailSchema`, `activateCorporateSchema`.
- **`POST /register`** — `registerUser` → sign JWT with `{userId, platformRole}` → `setAuthCookies` (isAdmin, locale) → 201.
- **`POST /login`** — `loginUser` → sign + cookies → 200.
- **`POST /forgot-password`** — calls `requestPasswordReset`; always returns 200 to prevent email enumeration (re-throws only non-ServiceErrors).
- **`POST /reset-password`** — `resetPassword`.
- **`POST /google`** — `authenticateWithGoogle` → cookies → returns `{user, metaEventId}`.
- **`GET /verify-email`** (legacy, token in query) and **`POST /verify-email`** (HI-02, token in body) — both call `verifyEmail`.
- **`GET /check-corporate-invite`** — `checkCorporateInvite(token)`.
- **`POST /activate-corporate`** — reads current session cookie (silently swallowing verify errors) to pass `currentUserId` so the service can detect a magic-link/session mismatch; calls `activateCorporateAccount`, sets cookies, returns 200 (`alreadyExisted`) or 201.
- **`POST /resend-verification`** (`requireAuth`) — `resendVerification`.
- **`POST /logout`** — `clearAuthCookies` → 200.

**Exports:** `authRouter` (named).

**Key dependencies:** `lib/jwt` (`signToken`/`verifyToken`), `lib/authCookies` (`setAuthCookies`/`clearAuthCookies`/`getTokenFromCookies`), `services/authService` (9 functions + `ServiceError`/`AuditContext`), `lib/passwordRules` (`isPasswordValid`).

**Flags:** none.

---

### backend/src/routes/catalog.ts

**Purpose:** Authenticated read-only catalog of ACTIVE tournament instances and their phases (used by pool-creation/discovery UI).

**What it does:**
- `catalogRouter` gated by `requireAuth`.
- **`GET /instances`** — lists ACTIVE `tournamentInstance` rows (newest first) with a selected subset of fields plus nested `template` info.
- **`GET /instances/:instanceId/phases`** — loads the instance's `dataJson`, runs `extractPhases`, and returns each phase as `{id, name, type, order}`; 404 if the instance is missing.

**Exports:** `catalogRouter` (named).

**Key dependencies:** `db` (prisma), `lib/fixture` (`extractPhases`), `middleware/requireAuth`.

**Flags:** none.

---

### backend/src/routes/corporate.ts

**Purpose:** Thin HTTP layer for the corporate self-service system — public inquiry form, authenticated corporate-pool creation, employee management (add/list/delete), invitation sending (single/bulk/resend-expired), branding edits, and a CSV template download.

**What it does:**
- `corporateRouter`; auth applied per-route (the inquiry endpoint is public).
- `auditCtx` / `handleServiceError` (note 401 maps to `sendBadRequest`).
- `envInt(key, fallback)` helper reads numeric env config. `inquiryLimiter` (express-rate-limit, default 5 per 15 min). `CORP_MIN_PARTICIPANTS`/`CORP_MAX_PARTICIPANTS` (default 1/10000) bound the pool-capacity schema.
- **Schemas:** `inquirySchema` (company/contact fields, legacy `employeeCount` tier enum kept for back-compat, plus new quote-panel fields `country`/`currency`/`poolsConfig`/`numberOfPools`/`slotsPerPool`/`message`, default `locale`). `createCorporatePoolSchema` (companyName, base64 logo validated via `validateBase64Image` ≤700KB, welcome/invitation messages, hex `primaryColor`/`secondaryColor`, `invitationLocale` default "es", tournamentInstanceId, pool name/description/timeZone/deadline/requireApproval, `pickTypesConfig` as preset string or full config, bounded `maxParticipants`, optional `emails`). `addEmployeesSchema` (1–500 emails). `updateBrandingSchema` (all fields nullable/optional; `invitationLocale` non-nullable enum).
- **`POST /inquiry`** (public, rate-limited) → `submitInquiry`.
- **`POST /pools`** (`requireAuth`) — splits out `pickTypesConfig`, calls `createCorporatePool` with `userId`.
- **`POST /pools/:poolId/employees`** → `addEmployees`.
- **`GET /pools/:poolId/employees`** — manually parses query: comma-split `status` filtered against the `DerivedInviteStatus` set (PENDING/SENT/ACTIVATED/FAILED/EXPIRED), `search`, `page`, `limit` → `listEmployees`.
- **`POST /pools/:poolId/employees/bulk-resend-expired`** (`inviteSendLimiter`, `inviteSendDailyLimiter`) → `bulkResendExpired`.
- **`POST /pools/:poolId/send-invitations`** (same two limiters) → `sendInvitations`.
- **`PATCH /pools/:poolId/branding`** → `updateBranding` (records `OrganizationBrandingAudit`).
- **`GET /csv-template`** — returns a UTF-8-BOM CSV (`email,nombre`) as an attachment for Excel compatibility.
- **`POST /pools/:poolId/employees/:inviteId/resend`** (same limiters) → `resendInvitation`.
- **`DELETE /pools/:poolId/employees/:inviteId`** → `deleteEmployee`.

**Exports:** `corporateRouter` (named).

**Key dependencies:** `services/corporateService` (8 imports incl. `DerivedInviteStatus`), `services/corporateBrandingService` (`updateBranding`), `middleware/rateLimit` (`inviteSendLimiter`, `inviteSendDailyLimiter`), `validation/pickConfig` (`PoolPickTypesConfigSchema`), `lib/validateBase64Image`, `lib/constants` (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`), `express-rate-limit`.

**Flags:** none.

---

### backend/src/routes/feedback.ts

**Purpose:** Beta feedback submission (auth-optional) plus an admin-only paginated feedback list.

**What it does:**
- `feedbackRouter`. `feedbackLimiter` = 5 submissions/min/IP.
- **`POST /`** (`optionalAuth`, rate-limited) — `submitFeedbackSchema` (type BUG|SUGGESTION, message 10–2000, optional base64 image ≤700KB, `wantsContact` + conditional contact fields, currentUrl). Resolves `userId`/`userEmail` from optional auth, creates a `betaFeedback` row (only persisting contact fields when `wantsContact`), and fires a fire-and-forget `sendAdminNotification` to the support inbox (HTML built with `escapeHtml`). Returns 201.
- **`GET /admin`** (`requireAuth, requireAdmin`) — `adminListQuerySchema` (type/wantsContact filters, coerced+clamped `page`/`limit` using `PAGINATION` constants). Builds a `where`, runs paginated `findMany` + `count`, returns feedbacks plus pagination metadata.

**Exports:** `feedbackRouter` (named).

**Key dependencies:** `db` (prisma `betaFeedback`), `middleware/requireAuth` (`requireAuth`, `optionalAuth`), `middleware/requireAdmin`, `lib/email` (`sendAdminNotification`, `escapeHtml`), `lib/constants` (`PAGINATION`), `express-rate-limit`.

**Flags:** none.

---

### backend/src/routes/groupStandings.ts

**Purpose:** Thin HTTP layer for group-standings predictions (player picks of the final 4-team group order), official host results, live-computed standings tables, and generation from match results.

**What it does:**
- `groupStandingsRouter` gated by `requireAuth`.
- `groupStandingsSchema` requires exactly 4 `teamIds` plus optional `reason` (errata justification).
- **Player picks:** `PUT /:poolId/group-standings/:phaseId/:groupId` (`upsertGroupStandingsPick`), `GET` single, `GET /:poolId/group-standings/:phaseId` (all picks for phase).
- **Host results:** `PUT /:poolId/group-standings-results/:phaseId/:groupId` — calls `publishGroupStandingsResult`; if it was an errata override (`isErrata` + reason + `previousTeamIds`), it loads the pool/instance, builds a team-id→name map from `extractTeams`, resolves the host name, fetches all ACTIVE members, and for each member with email notifications enabled fires `sendGroupStandingsOverrideNotification` (fire-and-forget) with previous/new standings, reason, host name, and per-user locale. `GET` single result and `GET /.../:phaseId` (all results).
- **Live stats:** `GET /:poolId/group-standings-stats/:phaseId/:groupId` → `getGroupStandingsStats` (classic table Pos/PJ/G/E/P/GF/GC/DG/Pts computed live, tolerant of partial data, includes published official order for diffing).
- **Generate:** `POST /:poolId/group-standings-generate/:phaseId/:groupId` → `generateGroupStandings` (computes positions from match results and persists `GroupStandingsResult`).
- **Match results:** `GET /:poolId/group-match-results/:groupId` → `getGroupMatchResults`.

**Exports:** `groupStandingsRouter` (named).

**Key dependencies:** `services/groupStandingsService` (9 functions), `db` (prisma), `lib/fixture` (`extractTeams`), `lib/constants` (`resolveUserLocale`), `lib/email` (`sendGroupStandingsOverrideNotification`), `lib/asyncHelpers` (`fireAndForget`), `services/authService` (`ServiceError`, `AuditContext`).

**Flags:** none.

---

### backend/src/routes/legal.ts

**Purpose:** Legal-document API — fetch active TOS/Privacy documents per locale, report current versions, check a user's consent status, and record consent acceptance. Supports document versioning and forced re-acceptance.

**What it does:**
- Exports the constant `CURRENT_LEGAL_VERSIONS` (`TERMS_OF_SERVICE` / `PRIVACY_POLICY`, both `"2026-01-25"`) — the authoritative "current version" strings updated when new versions publish.
- **`GET /documents/:type`** (public) — maps short aliases (`terms`/`privacy`) or full enum names to `LegalDocumentType`, finds the active `legalDocument` for `(type, locale)`, returns it or 404.
- **`GET /current-versions`** (public) — fetches active TOS + Privacy docs in parallel and returns version strings (falling back to the constants) plus the document summaries.
- **`GET /consent-status`** (`requireAuth`) — reads the user's accepted-terms/privacy versions/timestamps, age verification, and marketing consent; compares accepted versions to `CURRENT_LEGAL_VERSIONS`; returns a structured `consent` object plus `requiresUpdate`.
- **`POST /accept`** (`requireAuth`) — inline `acceptSchema` (optional accept flags). Builds an `updateData` patch: accepting terms/privacy stamps the current version + timestamp, age verification stamps `ageVerifiedAt`, marketing toggles `marketingConsent`/`marketingConsentAt`. Rejects if nothing is being accepted; updates the user and returns the new consent state.

**Exports:** `legalRouter` (named, re-export of `router`); `CURRENT_LEGAL_VERSIONS` (named const).

**Key dependencies:** `db` (prisma `legalDocument`, `user`), `@prisma/client` (`LegalDocumentType`, `PlatformRole`), `middleware/requireAuth`.

**Flags:** none.

---

### backend/src/routes/me.ts

**Purpose:** Authenticated "my account" endpoints — list the user's pools, an analytics-oriented aggregated snapshot, email-preference read/write, and prediction-update subscription toggle.

**What it does:**
- `meRouter` gated by `requireAuth`.
- **`GET /pools`** — lists `poolMember` rows where status ∈ ACTIVE/PENDING_APPROVAL/LEFT (newest first), with nested pool + tournamentInstance + template.key; maps to a flattened DTO including `scoringPresetKey` (default "CLASSIC") and `organizationId`.
- **`GET /aggregated`** — loads core user fields, then runs a 6-way parallel count batch (active pool count, corporate membership count, completed `poolPayment` count, predictions count, host-role pool count, last prediction). Derives `tier` (paid/free), `is_corporate`, `signup_method` (google iff `googleId && !passwordHash`), `account_age_days`, and returns GA4-shaped `user_properties`/CAPI dimensions.
- **`GET /email-preferences`** — reads user email prefs + platform settings in parallel; returns preferences, `platformEnabled` (which types admin allows), and Spanish human-readable descriptions. 404 if user missing.
- **`PUT /email-preferences`** — `updateEmailPreferencesSchema` (6 optional booleans incl. digest); rejects empty body; updates and returns the new prefs.
- **`GET /prediction-subscription`** / **`PUT /prediction-subscription`** — read/toggle `user.predictionUpdates`; PUT validates `enabled` boolean, updates, and fires a fire-and-forget audit event (`prediction_subscription_enabled`/`_disabled`).

**Exports:** `meRouter` (named).

**Key dependencies:** `db` (prisma), `lib/audit` (`writeAuditEvent`), `lib/asyncHelpers` (`fireAndForget`).

**Flags:** none.

---

### backend/src/routes/payments.test.ts

**Purpose:** Vitest unit tests for the two webhook factory handlers exported by `payments.ts` (`createWebhookHandler` for Polar, `createMpWebhookHandler` for Mercado Pago), focused on signature verification, drift/replay defence, and the retry-on-error contract.

**What it does:**
- Mocks `services/paymentService` (all handlers + `recordUnhandledPolarEvent` + `recordClientEvent`) and `standardwebhooks` (a `MockWebhook` that returns an `order.paid` payload for `"valid-sig"` and throws otherwise). Provides `mockReq`/`mockRes` helpers and `computeMpSignature` (recreates MP's HMAC manifest).
- **Polar suite:** 503 when `POLAR_WEBHOOK_SECRET` unset; 401 on invalid signature; 200 on valid signature; 500 (with `retryable:true`) when the inner handler throws — asserting the regression fix that errors must surface 5xx so Polar retries.
- **MP suite:** 401 when secret unset / x-signature missing / invalid signature; 200 for a valid HMAC (both ms and seconds timestamp formats); 401 for stale timestamps beyond the drift window (ms and seconds) — the capture-and-replay defence; 401 for a non-numeric timestamp; 500 (`retryable:true`) when the inner handler throws.

**Exports:** none (test file).

**Key dependencies:** `vitest`, `crypto`, `./payments` (re-imported per test to pick up env changes), mocked `services/paymentService` + `standardwebhooks`.

**Flags:** none.

---

### backend/src/routes/payments.ts

**Purpose:** HTTP layer for pool-capacity payments via Polar.sh (USD/international) and Mercado Pago (COP/Colombia) — checkout creation, MP Payment-Brick processing, country detection, client-side attempt telemetry beacons, payment status, and signature-verified webhook handlers for both processors.

**What it does:**
- **`extractMetaSignals(req)`** — pulls `_fbp`/`_fbc` cookies plus client IP (honouring `trust proxy`) and UA for Meta CAPI Advanced Matching on async webhook emissions.
- `paymentsRouter`. `checkoutSchema` (`poolId` uuid, `targetCapacity` 2–10000, optional `accountReceivableId` for CC redemption).
- **`POST /checkout`** (`requireAuth`) — guards on `isPolarConfigured`, calls `initiateCheckout` with locale + Meta signals.
- **`GET /country`** — detects country from `cf-ipcountry`/`x-vercel-ip-country`/`x-country` headers (default "US"); logs the detection.
- **`POST /mp-checkout`** (`requireAuth`) — guards on `isMercadoPagoConfigured`, calls `initiateMpCheckout`.
- **`POST /mp-process`** (`requireAuth`) — `mpProcessSchema` (`paymentId` uuid, permissive snake_case `formData` record, optional `metaCookies.fbc/fbp`). Resolves client IP/UA/country from headers and calls `processMpPayment`.
- **`POST /attempts/:paymentId/event`** (`requireAuth`, `beaconBodyParser`) — accepts `navigator.sendBeacon` text/plain bodies (no CORS preflight) alongside JSON; validates a 36-char uuid path param, JSON-parses text bodies, validates `clientEventSchema` (`eventType` from `CLIENT_EVENT_TYPES` + capped `details`), and calls `recordClientEvent` (ownership enforced in service). Returns 202; client events are intentionally non-deduplicated forensic rows.
- **`GET /pool/:poolId/status`** (`requireAuth`) — `getPaymentStatus`, defaulting to `{status:"NONE"}`.
- **`verifyMpSignature(req)`** — verifies MP `x-signature` (`ts`/`v1`) HMAC-SHA256 over the manifest `id:...;request-id:...;ts:...;`, with ms/s auto-detection, a configurable drift window (`MP_WEBHOOK_MAX_DRIFT_MS`, default 5 min) for replay protection, and a `crypto.timingSafeEqual` comparison. Rejects when no secret configured.
- **`createMpWebhookHandler()`** — verifies signature (401 on fail), dispatches `type==="payment"` to `handleMpWebhook(data.id)`, returns 200; on error returns **500** (`retryable:true`) so MP retries (idempotent via `PaymentEvent.polarEventId` UNIQUE).
- **`createWebhookHandler()`** — Polar webhook; returns a 503 stub if `POLAR_WEBHOOK_SECRET` unset, else builds a `standardwebhooks.Webhook` with the base64-encoded secret. Verifies the raw body, builds a `WebhookContext` from `webhook-id`/`webhook-timestamp`, logs delivery metadata, and routes: `order.paid` → `handleOrderPaid`, `order.refunded`/`order.canceled` → `handleOrderRefunded`, `checkout.updated` → `handleCheckoutUpdated`, anything else → `recordUnhandledPolarEvent` (audit-trail fallthrough). Returns 200; signature errors → 401, transient errors → 500 (`retryable:true`).

**Exports:** `paymentsRouter`, `createMpWebhookHandler`, `createWebhookHandler` (named).

**Key dependencies:** `services/paymentService` (8 imports + `WebhookContext`), `services/polar/client` (`isPolarConfigured`), `services/mercadopago/client` (`isMercadoPagoConfigured`), `lib/paymentEvents` (`CLIENT_EVENT_TYPES`), `standardwebhooks`, `crypto`, `express` (text body parser).

**Flags:** none. (Wompi — the deprecated/discarded predecessor to Mercado Pago — is correctly absent here.)

---

### backend/src/routes/pickPresets.ts

**Purpose:** Public-ish (no explicit auth on the router) read-only endpoints exposing pick-type configuration presets.

**What it does:**
- `pickPresetsRouter`.
- **`GET /`** — `getAllPresets()` mapped to `{key, name, description}` summaries.
- **`GET /:key`** — `getPresetByKey(key.toUpperCase())`, returns the full preset or 404.

**Exports:** `pickPresetsRouter` (named).

**Key dependencies:** `lib/pickPresets` (`getAllPresets`, `getPresetByKey`).

**Flags:** No auth middleware on this router (unlike sibling routers). Likely intentional since presets are static reference data, but worth noting it diverges from the auth-by-default pattern.

---

### backend/src/routes/picks.ts

**Purpose:** Thin HTTP layer for match predictions ("picks") — list pool matches, upsert a user's pick, view all picks for a match (post-deadline), and view own picks.

**What it does:**
- `picksRouter` gated by `requireAuth`.
- `pickSchema` is a discriminated union on `type`: `OUTCOME` (HOME/DRAW/AWAY), `SCORE` (`homeGoals`/`awayGoals` 0–99), `WINNER` (`winnerTeamId`). `upsertPickSchema` wraps it as `{pick}`.
- **`GET /:poolId/matches`** — `getPoolMatches` (instance match snapshot + per-pool computed deadline).
- **`PUT /:poolId/picks/:matchId`** — validates `upsertPickSchema`, calls `upsertPick` (enforces deadline in service).
- **`GET /:poolId/matches/:matchId/picks`** — `getMatchPicks` (all users' picks for a match, only after the match deadline — gated in service).
- **`GET /:poolId/picks`** — `getMyPicks`.

**Exports:** `picksRouter` (named).

**Key dependencies:** `services/pickService` (`getPoolMatches`, `upsertPick`, `getMatchPicks`, `getMyPicks`), `services/authService` (`ServiceError`, `AuditContext`).

**Flags:** none.

---

### backend/src/routes/poolAdmin.ts

**Purpose:** Thin HTTP layer for host/co-admin pool management — scoring overrides, phase advancement, settings/scoring-config edits, phase locks, archiving, and various scoring-breakdown read endpoints.

**What it does:**
- `poolAdminRouter`. (Authorization is enforced inside each service function via `req.auth!.userId`; this router does not itself call `requireAuth` — see Flags.)
- **Schemas:** `scoringOverrideSchema` (`scoringEnabled` + optional reason), `advancePhaseSchema` (`currentPhaseId` + optional `nextPhaseId`), `updatePoolSettingsSchema` (`autoAdvanceEnabled`/`requireApproval`/`extraTimePhases`), `lockPhaseSchema` (`phaseId`/`locked`), `updateScoringConfigSchema` (`pickTypesConfig` preset string or full config).
- **Mutations:** `PUT /:poolId/matches/:matchId/scoring-override` (`setScoringOverride`), `POST /:poolId/advance-phase` (`advancePhase`), `PATCH /:poolId/settings` (`updatePoolSettings`), `PATCH /:poolId/scoring-config` (`updatePoolScoringConfig` — DRAFT-only, 409 otherwise), `POST /:poolId/lock-phase` (`setPhaselock`), `POST /:poolId/archive` (`archivePool`).
- **Breakdowns:** `GET /:poolId/breakdown/match/:matchId`, `.../breakdown/phase/:phaseId`, `.../breakdown/group/:groupId`, `GET /:poolId/players/:userId/summary`, `GET /:poolId/notifications`.

**Exports:** `poolAdminRouter` (named).

**Key dependencies:** `services/poolAdminService` (11 functions), `validation/pickConfig` (`PoolPickTypesConfigSchema`), `services/authService` (`ServiceError`, `AuditContext`).

**Flags:** The router accesses `req.auth!.userId` in every handler but does not apply `requireAuth` at the router level (unlike most sibling routers). This implies the middleware is applied at the mount point in the parent router (e.g. `routes/index`/`pools.ts`); if it is not, these handlers would dereference an undefined `req.auth`. Worth verifying the mount applies auth.

---

### backend/src/routes/poolInvites.ts

**Purpose:** Pool invite-code lifecycle and join flow — create/list/soft-revoke invite codes (host only), send a code by email, and the public-ish `POST /pools/join` redemption with capacity/race/referral handling.

**What it does:**
- `poolInvitesRouter`. Host-only routes gate via `requirePoolAdmin(userId, poolId)`.
- `createInviteSchema` (`maxUses` 1–500, `expiresAtUtc`). `sendInviteEmailSchema` (`email`, `inviteCode`). `joinSchema` (`code` 6–64).
- **`POST /:poolId/invites`** — host check, validates pool exists + `canCreateInvites(status)`, generates a unique `makeInviteCode()` (retry on collision), creates a `poolInvite` (default 30-day expiry via `TOKEN_EXPIRY_MS.POOL_INVITE_DEFAULT`), audits `POOL_INVITE_CREATED` (capturing `organizationId` for funnel splitting).
- **`GET /:poolId/invites`** — host check, returns all invites (incl. expired/revoked for history) with derived `expired`/`exhausted` flags.
- **`DELETE /:poolId/invites/:inviteId`** — host check; **soft-revoke** by setting `expiresAtUtc = now()` (deliberately not hard-deleting to preserve `acceptedByUserId` referral attribution); audits `POOL_INVITE_REVOKED`.
- **`POST /:poolId/send-invite-email`** — host check, loads pool + inviter, validates the code belongs to the pool, resolves target user (for prefs + locale), sends `sendPoolInvitationEmail`; audits `POOL_INVITE_EMAIL_SENT` (records `skipped`).
- **`POST /join`** (`poolJoinLimiter`) — finds invite (with pool), checks `canJoinPool(status)`, expiry, and maxUses; computes `initialStatus` from `requireApproval`. In a `$transaction`: rejects BANNED members; for new members calls `ensurePoolCapacity` (row-lock) then creates a PLAYER membership (first-time referral); reactivates LEFT members; returns early for PENDING/already-active. Performs an **atomic conditional increment** (`updateMany` with `uses: {lt: maxUses}`) to prevent double-redeem races (throws `INVITE_EXHAUSTED` if it lost the race). Records first-redeemer (`acceptedByUserId`) and populates `User.referredByUserId` (skipping self-invites). Catch block maps `BANNED_FROM_POOL`→403, `INVITE_EXHAUSTED`/`POOL_FULL`→409 (POOL_FULL also fires a throttled `notifyHostOfBlockedAttempt`). On success, skips audit/analytics when `alreadyMember`; otherwise audits `JOIN_REQUEST_SUBMITTED` or `POOL_JOINED`, emits server-side `referral_conversion` GA4 + `Lead` CAPI events for referred ACTIVE joins, calls `transitionToActive` for direct joins, and always runs `checkAndNotifyCapacityThresholds`.

**Exports:** `poolInvitesRouter` (named).

**Key dependencies:** `db` (prisma), `lib/audit`, `lib/roles` (`requirePoolAdmin`), `lib/poolHelpers` (`makeInviteCode`), `services/poolStateMachine` (`transitionToActive`, `canJoinPool`, `canCreateInvites`), `lib/email` (`sendPoolInvitationEmail`), `lib/poolCapacity` (`ensurePoolCapacity`, `checkAndNotifyCapacityThresholds`, `notifyHostOfBlockedAttempt`), `lib/constants` (`TOKEN_EXPIRY_MS`, `resolveUserLocale`), `middleware/rateLimit` (`poolJoinLimiter`), `lib/ga4`, `lib/metaCapi`, `lib/asyncHelpers` (`fireAndForget`).

**Flags:** Like `poolAdmin.ts`, the host/invite routes read `req.auth!.userId` without a router-level `requireAuth` (only `POST /join` has a rate limiter, no auth middleware here either) — auth is presumably applied at the mount point. `POST /join` also references `req.auth!.userId` inside the transaction, so it relies on auth being applied upstream. Worth verifying the mount.
