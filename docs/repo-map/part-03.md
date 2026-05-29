## Batch 3

This batch covers the backend `src/lib` modules responsible for transactional/notification email sending and templating, environment validation, fixture (tournament data) typing, server-side analytics (GA4 Measurement Protocol), Google OAuth verification, HTML escaping, sales-document issuer identity, and JWT signing/verification — plus their associated test suites.

---

### backend/src/lib/email.ts

**Purpose:** The single email-sending facade for the backend. Wraps the Resend SDK with retry, suppression-list checking, locale-aware subject lines, unsubscribe headers, and category-routed internal team notifications, and exposes one `send*` function per email type.

**What it does:**

- **Setup & client.** Re-exports `escapeHtml` from `./htmlSafe` (so legacy callers importing it from here keep working). Reads `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_NAME` (default "Picks4All"), `SITE_DOMAIN`, `FRONTEND_URL` from env; warns loudly if API key / from-email are missing. Constructs a `Resend` client (or `null`). `DEFAULT_REPLY_TO` is `soporte@<EMAIL_DOMAIN|SITE_DOMAIN>` — a deliberate switch away from a `noreply@` FROM for deliverability. `getReadyClient()` returns `{ client, from: "${APP_NAME} <${FROM_EMAIL}>" }` or `null`.
- **`resilientSend(ready, payload)`** — central send primitive. Checks each recipient against the suppression list (unless `skipSuppressionCheck`), injects the default Reply-To unless the caller opts out via `skipDefaultReplyTo` or supplies its own `replyTo`, then sends through `withRetry` (3 attempts, exponential backoff). Returns Resend-shaped `{ data, error }`.
- **Locale + unsubscribe helpers.** `getUserLocale(userId?)` resolves a user's locale via `resolveUserLocale`. `isSuppressed(email)` checks the `emailSuppression` table. `getUnsubscribeHeaders(userId)` builds RFC `List-Unsubscribe` / `List-Unsubscribe-Post` one-click headers pointing at the backend `/unsubscribe?token=` endpoint using `generateUnsubscribeToken`.
- **Retry & batch.** `withRetry(label, fn)` retries 3× with 500ms·2^n backoff. `batchSendEmails(items, sendFn)` (exported) sends in batches of 10 with a 1s inter-batch delay using `Promise.allSettled`, returning `{ sent, failed, failures }` where each failure pairs the item with its rejection reason.
- **Preference gating.** `EmailType` union (`welcome | deadlineReminder | resultPublished | poolCompleted`). `EMAIL_CONFIG_MAP` maps each type to its `PlatformSettings` field and per-`User` field. `isEmailEnabled(type, userId?)` (exported) checks platform-level toggle (creating the `singleton` `PlatformSettings` row if absent), then the user's master toggle and type-specific toggle (welcome only honours the master toggle). Returns `{ enabled, reason? }`.
- **Transactional senders (always sent, no pref check):** `sendPasswordResetEmail`, `sendVerificationEmail`. Both build locale subjects, append UTM to the URL, and call the matching template.
- **Preference-gated senders:** `sendWelcomeEmail` (gated by `welcome`), `sendDeadlineReminderEmail`, `sendResultPublishedEmail`, `sendPoolCompletedEmail` — each calls `isEmailEnabled`, returns `{ skipped: true }` when disabled, otherwise renders its template, attaches unsubscribe headers, and sends. `sendPoolInvitationEmail` checks only user-level prefs (`emailNotificationsEnabled` + `emailPoolInvitations`).
- **`getPlatformEmailSettings()`** — returns the current platform email toggles, creating the singleton if missing.
- **Corporate emails:** `sendCorporateInquiryConfirmationEmail` (transactional confirmation to lead contact); `sendCorporateCheckinEmail` (proactive outreach — always FROM/Reply-To `empresas@picks4all.com`, the single canonical enterprise mailbox); `sendCorporateActivationEmail` (employee invite — parses a base64 logo data-URI into a CID inline attachment so Gmail renders it, builds a locale-correct activation URL via `buildActivationUrl`, passes optional org branding colors + invitation message).
- **Internal team notifications.** `AdminCategory` union (`feedback`, `corporate_inquiry`, `corporate_pool_created`, `payment_completed`, `payment_reconciler_rescued`, `cc_pricing_drift`, `system_event`, `error`). `CATEGORY_ROUTING` maps each category to target inbox(es) (`admin|support|enterprise|sales`), an emoji and a label. `NOTIFICATION_INBOX_ENV` resolves inbox names to env addresses, each falling back to `ADMIN_NOTIFICATION_EMAIL`. `resolveInboxAddresses()` dedupes. `sendAdminNotification({subject, body, category})` (exported) sends to the resolved inboxes with a category-styled subject and body, FROM "`<APP_NAME> Notify`", and `skipDefaultReplyTo: true`.
- **Host/operational notifications:** `sendPoolFullNotificationEmail`, `sendCapacityWarningEmail`, `sendBlockedJoinAttemptEmail`, `sendNewMemberNotificationEmail`, `sendNewMemberDigestEmail`, `sendPendingApprovalDigestEmail` (digest reusing `emailNewMemberDigest` opt-out), `sendPoolRevertedToDraftEmail`, `sendPhaseCompletionSummaryEmail` (master-toggle only).
- **Override notifications (inline HTML, not template files):** `sendResultOverrideNotification`, `sendGroupStandingsOverrideNotification`, `sendKnockoutWinnerOverrideNotification` — each builds locale subject/heading/message/reason maps and inline HTML showing before/after + mandatory reason, attaches unsubscribe headers.
- **Other:** `sendPredictionUpdateEmail` (World Cup 2026 AI prediction updates, own opt-out), `sendPaymentReceiptEmail` (Reply-To `ventas@`; formats `paidAt` per locale; optional `accountReceivableNumber` for cuenta-de-cobro receipts), `sendPasswordChangedEmail`, `sendMemberRemovedEmail` (kicked/banned).

**Exports:** `escapeHtml` (re-export); types `EmailType`, `EmailResult`, `AdminCategory`; functions `getUserLocale`, `batchSendEmails`, `isEmailEnabled`, `getPlatformEmailSettings`, `sendAdminNotification`, and ~22 `send*Email`/`send*Notification` functions listed above.

**Key dependencies:** `resend` SDK; `../db` (prisma); `./constants` (locales + `resolveUserLocale`); `./brand`; `./unsubscribe`; `./utm`; `./activationUrl`; all `get*Template` factories + param types from `./emailTemplates`.

**Flags:** The inline override-notification HTML interpolates `params.reason`, `params.previousResult`, `params.newResult`, `params.previousWinnerName`/`newWinnerName`, and `renderList` team names WITHOUT `escapeHtml`, unlike the template module which escapes host-controlled inputs — a potential stored-XSS inconsistency for host-controlled reason/result/team-name fields. `getUserLocale` is exported but its in-repo consumers are not visible in this batch (verify). Otherwise clean.

---

### backend/src/lib/emailTemplates.ts

**Purpose:** Houses every HTML email template as a pure render function returning a fully-formed responsive HTML string. Provides a shared wrapper, reusable component helpers, ES/EN/PT i18n per template, and consistent XSS escaping of host/user-controlled inputs.

**What it does:**

- **Brand config.** Imports `BRAND` (aliased `B`) and re-exposes a local `BRAND` object mapping brand tokens (colors, gradients, `baseUrl` from `FRONTEND_URL`, `supportEmail`). Derives canonical Spanish-only mailbox constants `SUPPORT_EMAIL` (`soporte@`), `PRIVACY_EMAIL` (`privacidad@`), `ENTERPRISE_EMAIL` (`empresas@`) from `EMAIL_DOMAIN`. `getSupportEmail(_locale)` ignores locale and always returns `SUPPORT_EMAIL`.
- **`getEmailWrapper(content, preheader?, locale)`** — the standard outer HTML shell: DOCTYPE, MSO conditional styles, responsive `@media` block, hidden preheader span, brand isotipo+logotipo header, content slot, and an i18n footer (tagline + Terms/Privacy/Email-preferences links, UTM-tagged, locale-prefixed path).
- **Reusable components:** `getButton(text, url, primary)`, `getHeading`, `getParagraph`, `getHighlightBox`, `getStatBox(label, value, emoji?)`.
- **Templates** (each exports a `*EmailParams` interface and a `get*Template` function; almost all escape host/user inputs via `escapeHtml` and append UTM to CTA URLs):
  - `getPasswordResetTemplate` (1-hour expiry messaging).
  - `getVerificationTemplate` (escapes `displayName`; 24-hour expiry).
  - `getWelcomeTemplate` (feature bullet list + dashboard CTA).
  - `getPoolInvitationTemplate` (join URL from invite code; escapes inviter/pool/description).
  - `getDeadlineReminderTemplate` (pluralised match count, deadline highlight, opt-out note).
  - `getResultPublishedTemplate` (points + rank stat boxes; escapes match/result).
  - `getPoolCompletedTemplate` (rank-based congrats message + emoji, three stat boxes, secondary explore CTA).
  - `getCorporateCheckinTemplate` (reply-to-us outreach; hardcoded `empresas@picks4all.com`).
  - `getCorporateInquiryConfirmationTemplate` (PUBLIC-endpoint XSS hardening on contactName/companyName; ES/EN footer note that EN/PT greetings unescaped `contactName` — see Flags).
  - `getCorporateActivationTemplate` — the most elaborate: custom standalone HTML (its own DOCTYPE, not `getEmailWrapper`) with a branded hero. `HEX_RE`/`isHex()` validate per-org colors; `resolveCorporateGradients()` returns Picks4All default indigo/violet gradients or org-custom ones. Renders CID logo or a letter-initial fallback, optional `invitationMessage` block (left RAW because it is pre-escaped at persistence time per the comment), pool name, big CTA.
  - `getPredictionUpdateTemplate` — returns `{ subject, html }`; builds a changes table; includes an unsubscribe link.
  - `getPaymentReceiptTemplate` — transaction detail table; optional `accountReceivableNumber` row (escaped).
  - `getPoolFullTemplate`, `getCapacityWarningTemplate`, `getBlockedJoinAttemptTemplate` (escapes attacker-controlled `attemptedEmail`).
  - `getNewMemberTemplate`, `getNewMemberDigestTemplate` (escapes per-member names), `getPasswordChangedTemplate`, `getMemberRemovedTemplate` (kicked/banned variants), `getPendingApprovalDigestTemplate` (warning-styled list + "turn off mandatory approval" disclaimer link), `getPhaseCompletionSummaryTemplate` (Top-10 table, highlights the current user's row).

**Exports:** `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `ENTERPRISE_EMAIL`, `getSupportEmail`, `getEmailWrapper`, all `get*Template` functions, all `*EmailParams`/`*Params` interfaces, and a re-export of `BRAND`.

**Flags:**
- In `getCorporateInquiryConfirmationTemplate`, the EN and PT greeting lines interpolate raw `contactName` (`Hi ${contactName}` / `Olá ${contactName}`) instead of `safeContactName`, while ES uses the escaped version — an XSS escaping gap on a PUBLIC endpoint, contradicting the file's own security comment.
- In `getPhaseCompletionSummaryTemplate`, the Top-10 `entry.name` is interpolated unescaped into the table rows (and `isUser` compares the raw `displayName`), despite the comment claiming top10 entries are escaped — XSS gap for host/player-controlled display names.
- `getSupportEmail`'s `_locale` parameter is dead (always ignored).

---

### backend/src/lib/emailTemplates.xss.test.ts

**Purpose:** Vitest suite asserting that every host/user-controlled variable across the email templates is HTML-escaped so raw XSS payloads never survive into rendered output.

**What it does:** Defines two payloads (`<script>...` and `<img onerror>`), a helper `expectNoRawXss(name, html, payloads)` that fails if any raw payload string appears in the HTML, and one `it` per template (inquiry confirmation, corporate activation across all 3 locales, pool full, capacity warning, blocked join, new member, pool invitation, deadline reminder, result published, pool completed, member removed, new member digest, phase completion summary, verification, welcome, password changed, payment receipt). The inquiry-confirmation case additionally asserts the output contains `&lt;script&gt;`.

**Exports:** none (test module).

**Key dependencies:** `vitest`; the template factories from `./emailTemplates`.

**Flags:** Several test invocations use param shapes that do not match the current template interfaces: `getMemberRemovedTemplate` is passed `type: "REMOVED"` (the type only accepts `"kicked" | "banned"`); `getPhaseCompletionSummaryTemplate` is passed `top10: [{ displayName, points }]` while the interface expects `{ rank, name, points }`; `getPaymentReceiptTemplate` is passed `paidAt: new Date()` and a stray `userId` while the interface expects `paidAt: string` and no `userId`. These tests are stale relative to the templates and likely only pass because the assertions check for absence of raw payloads rather than correct rendering — notably they would NOT catch the unescaped Top-10 `entry.name` gap because the test supplies the wrong field name (`displayName`), so the value never reaches the unescaped `entry.name` path. Worth re-aligning.

---

### backend/src/lib/env.ts

**Purpose:** Fail-fast environment validation at server startup plus non-fatal analytics-config warnings.

**What it does:** Defines a Zod `envSchema` requiring `DATABASE_URL` and `JWT_SECRET` (min 16 chars), with optional/defaulted `PORT` (3000), `NODE_ENV` (enum, default development), `FRONTEND_URL`, and optional `RESEND_*`, the four notification-inbox env vars, `GOOGLE_CLIENT_ID`, `API_FOOTBALL_*`, and `RAILWAY_GIT_COMMIT_SHA`. `validateEnv()` `safeParse`s `process.env`, prints a formatted error block and `process.exit(1)` on failure, otherwise runs `warnMissingAnalyticsVars()` and returns the parsed `Env`. `warnMissingAnalyticsVars()` checks `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE` and prints one warning block describing the degraded behaviour for each missing var (plus a reminder that frontend `NEXT_PUBLIC_*` vars are build-time on the frontend service).

**Exports:** type `Env`; function `validateEnv`.

**Key dependencies:** `zod`.

**Flags:** none.

---

### backend/src/lib/fixture.test.ts

**Purpose:** Vitest suite for the fixture parsing/extraction utilities.

**What it does:** Defines a representative `FixtureData` sample. Tests `parseFixtureData` (valid object, null/undefined/string/number inputs → empty arrays, non-array teams/phases/matches → empty arrays, undefined meta/note handling, preservation of optional UCL fields `tieNumber`/`leg`); `extractMatches`/`extractTeams`/`extractPhases` (happy path + empty/null inputs); and `typed<T>` (casts unknown, returns the same reference without cloning).

**Exports:** none (test module).

**Key dependencies:** `vitest`; `./fixture`.

**Flags:** none.

---

### backend/src/lib/fixture.ts

**Purpose:** Centralized read-side typing and safe extractors for the opaque Prisma `Json` fixture/tournament data, eliminating `as any` casts at call sites.

**What it does:** Declares interfaces `FixtureTeam`, `FixturePhase` (with UCL extensions `twoLegged`/`legNumber`/`config`), `FixtureMatch` (with UCL extensions `label`/`tieNumber`/`leg`/`status`), `FixtureMeta`, and the umbrella `FixtureData`. `parseFixtureData(dataJson)` defensively coerces an unknown into `FixtureData`, returning `{ teams:[], phases:[], matches:[] }` for non-objects and guarding each array field with `Array.isArray`. `extractMatches`/`extractTeams`/`extractPhases` are thin wrappers over it. Also declares JSON-field shapes `PickJson`, `ResultJson`, `StructuralPickJson` used elsewhere, and a `typed<T>(json)` cast helper. Notes that the canonical write-side Zod validation lives in `schemas/templateData.ts`.

**Exports:** interfaces `FixtureTeam`, `FixturePhase`, `FixtureMatch`, `FixtureMeta`, `FixtureData`, `PickJson`, `ResultJson`, `StructuralPickJson`; functions `parseFixtureData`, `extractMatches`, `extractTeams`, `extractPhases`, `typed`.

**Key dependencies:** none (pure types/utilities).

**Flags:** none.

---

### backend/src/lib/ga4.ts

**Purpose:** Server-side GA4 Measurement Protocol sink — a failsafe for conversion/purchase events that must reach GA4 even when the browser never fires them, with retry and a DB-backed dead-letter queue.

**What it does:** Reads `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, and `GA4_DEBUG` (selects the `debug/mp/collect` endpoint). Defines retry tuning constants (3 in-process retries with `[1s,2s,4s]` backoff; DLQ up to 8 attempts with escalating minute backoffs). Types `Ga4Event` and `Ga4SendParams`. Helpers: `dedupeKey` (prefers `transaction_id`, else random UUID); `buildClientId` (deterministic pseudo-cid from a SHA-256 of userId, mimicking GA4's `xxx.yyy` format); `postToGa4` (POST with an 8s `AbortController` timeout); `sleep`; `buildBody` (assembles `client_id`, sanitized events, optional `user_id`/`user_properties`/`ip_override`/`user_agent`); `sanitizeParams` (drops null/undefined and nested objects except `items` arrays, per GA4 MP constraints); `isPermanentFailure` (treats 4xx as permanent EXCEPT 401/403/408/429 so a secret rotation doesn't drop events); `nextRetryAt` (DLQ backoff with ±20% jitter).
- `sendGa4Event(params)` (exported) — noops without config; retries in-process, returns early on permanent failure, and on final failure persists a row to `failedAnalyticsEvent` (provider `GA4_MP`) for the cron worker. Always resolves, never throws.
- `retryFailedGa4EventsBatch(batchSize=20)` (exported) — drains due, unresolved, under-max-attempts `GA4_MP` DLQ rows; on success marks resolved, on failure increments `attemptCount` and reschedules (or resolves on permanent error). Returns `{ processed, resolved }`.

**Exports:** interfaces `Ga4Event`, `Ga4SendParams`; functions `sendGa4Event`, `retryFailedGa4EventsBatch`.

**Key dependencies:** `crypto`; `../db` (prisma `failedAnalyticsEvent`); Google Analytics MP HTTP endpoint; mirrors the Meta CAPI client's structure.

**Flags:** none. (Comments reference a sibling CAPI client `retryFailedCapiEventsBatch` not in this batch.)

---

### backend/src/lib/googleAuth.ts

**Purpose:** Verifies Google Sign-In ID tokens and extracts a normalized user profile.

**What it does:** Reads `GOOGLE_CLIENT_ID`, warns if unset, and lazily constructs an `OAuth2Client` (or `null`). `verifyGoogleToken(token)` returns `null` if unconfigured; otherwise calls `client.verifyIdToken` with the client ID as audience, extracts `{ googleId, email, emailVerified, name, picture }` from the payload, and returns `null` (with a logged error) when the payload is missing or the email is absent/unverified. Catches and logs verification errors, returning `null`.

**Exports:** interface `GoogleUser`; function `verifyGoogleToken`.

**Key dependencies:** `google-auth-library` (`OAuth2Client`).

**Flags:** none.

---

### backend/src/lib/htmlSafe.ts

**Purpose:** Cycle-free home for the `escapeHtml` helper, broken out so `lib/email.ts` and `lib/emailTemplates.ts` don't form a circular import.

**What it does:** `escapeHtml(str)` replaces the five HTML-significant characters (`&` first to avoid double-escaping, then `<`, `>`, `"`, `'` → `&#39;`).

**Exports:** function `escapeHtml`.

**Key dependencies:** none.

**Flags:** none.

---

### backend/src/lib/issuerInfo.ts

**Purpose:** Version-controlled legal/personal issuer identity that appears on every Cotización and Cuenta de Cobro, with a snapshot helper for the per-document audit trail.

**What it does:** Defines the `IssuerInfo` interface (legal name, document type/number, address, city, country, phone, email, bank block, tax regime). Exports the concrete `ISSUER_INFO` constant (Juan Camilo Chacón Alvarado, CC, Bancolombia savings account, régimen simplificado — deliberately NOT in env vars so changes are reviewed). `snapshotIssuer()` returns a deep-cloned plain JSON copy for storage in the `issuerSnapshotJson` column at issue time; the PDF renderer is documented to read from that snapshot, never directly from `ISSUER_INFO`.

**Exports:** interface `IssuerInfo`; constant `ISSUER_INFO`; function `snapshotIssuer`.

**Key dependencies:** none. Referenced policy: SALES_AUDIT.md §8 / §11.4.

**Flags:** none. (Contains real personal PII — bank account, cédula — committed by design per the file's own note; flagged here only for awareness, not as dead code.)

---

### backend/src/lib/jwt.test.ts

**Purpose:** Vitest suite for the JWT sign/verify helpers.

**What it does:** Stubs `JWT_SECRET` in `beforeEach` and unstubs in `afterEach`. Tests `signToken` (3-part JWT format, payload round-trips `userId`/`platformRole`, throws "JWT_SECRET is missing" when secret empty) and `verifyToken` (decodes a valid token, throws on a tampered token, throws on a malformed `not.a.jwt`, throws on missing secret).

**Exports:** none (test module).

**Key dependencies:** `vitest`; `./jwt`.

**Flags:** none.

---

### backend/src/lib/jwt.ts

**Purpose:** Issue and verify the application's auth JWTs.

**What it does:** Defines `AuthTokenPayload` (`userId`, `platformRole: PlatformRole`). `signToken(payload)` reads `JWT_SECRET` (throws if missing) and signs with HS256 and a 4-hour expiry. `verifyToken(token)` reads `JWT_SECRET` (throws if missing) and verifies with HS256, returning the payload cast to `AuthTokenPayload` (throws on invalid/expired tokens).

**Exports:** type `AuthTokenPayload`; functions `signToken`, `verifyToken`.

**Key dependencies:** `jsonwebtoken`; `PlatformRole` from `@prisma/client`.

**Flags:** none.
