# Email locale handoff — Audit & Design

> Companion to `EMAIL_LOCALE_HANDOFF_IMPLEMENTATION.md`. This is the "why" doc — every decision below is locked **before** code lands. If we need to change something, edit here first.
>
> Triggered by user on 2026-05-26 (after ADR-062 corporate-invitation-locale shipped): the welcome email and the activation page were left out of the previous cycle. This doc closes the loop end-to-end.

---

## 1. Problem statement

After we shipped `Organization.invitationLocale` (ADR-062), the corporate **activation email** correctly arrives in the host's chosen language. But the moment the employee clicks the link, the experience falls back to Spanish:

1. The activation URL hardcodes the Spanish path `/activar-cuenta` so non-Spanish users land in Spanish UI even though the email was in their language.
2. The **welcome email** that fires moments later ignores locale entirely and arrives in Spanish 100% of the time.

For a non-Spanish-speaking employee:
- Inbox A: corporate-activation email in their language ✓
- Click link: lands in Spanish-language activation page ❌
- Activates → Inbox B: welcome email in Spanish ❌
- Dashboard: `LocalePreferenceModal` blocks, picks their locale ✓
- All emails after the modal: correctly localized via `User.locale` ✓

The two bugs are pure plumbing failures. The templates have ES/EN/PT branches already. The locale never reaches them.

The user's additional ask: **welcome email should ONLY ever ship AFTER the LocalePreferenceModal has been completed**. Today it fires before the modal can run, so the platform defaults to Spanish regardless of what the user is about to pick.

## 2. Verified current state

All claims below are file:line citations from `main` at 2026-05-26 — no assumptions.

### 2.1 Welcome email — three call sites, two of them broken

| Call site | File:line | Locale passed |
|---|---|---|
| Google signup / OAuth register | `authService.ts:483` | **NONE** → falls back to `DEFAULT_LOCALE = "es"` |
| Email-verification handler | `authService.ts:545` | `resolveUserLocale(user)` ✓ |
| Corporate activation | `authService.ts:792` | **NONE** → falls back to `DEFAULT_LOCALE = "es"` |

`sendWelcomeEmail` itself (`email.ts:460`) reads `params.locale ?? DEFAULT_LOCALE`. The function is innocent — the bug is the callers.

The middle row (`authService.ts:545`) only fires when the user verifies their email after a traditional email/password signup. Google sign-ups skip that path. Corporate activations skip that path too (they don't go through email verification at all — `authService.ts:745` sets `emailVerified = true` directly when the activation token is consumed).

### 2.2 Activation URL is locale-blind

`email.ts:930`:

```ts
const activationUrl = appendUtm(
  `${FRONTEND_URL}/activar-cuenta?token=${params.activationToken}`,
  emailUtm("corporate_activation"),
);
```

Hardcoded Spanish path. The frontend already has localized variants registered in `frontend-next/src/i18n/routing.ts:86-90`:

```ts
"/activar-cuenta": {
  es: "/activar-cuenta",
  en: "/activate-account",
  pt: "/ativar-conta",
},
```

The activation page (`frontend-next/src/app/[locale]/activar-cuenta/page.tsx`) reads the `activation.*` namespace which has full ES/EN/PT translations. So the page IS bilingual — the only thing missing is the link from the email pointing to the locale-correct variant.

### 2.3 Pre-modal window — emails that fire before the user picks a locale

Corporate activation flow (`POST /auth/activate-corporate`):

1. Token validated → `User.create` → JWT issued (`authService.ts:620-794`).
2. `fireAndForget("audit:corporate-activation", …)` ← writes audit row, no email.
3. `fireAndForget("welcome email", sendWelcomeEmail({…}))` ← **HERE the welcome ships, locale-less, before any user touches the UI**.
4. Response sent; client redirects to dashboard.
5. `LocalePreferenceGate` mounts, modal blocks the screen.
6. User picks locale → `User.locale` populated.

Between step 3 and step 6, the welcome is already in the inbox (in Spanish).

Background jobs (`deadlineReminderJob`, `newMemberDigestJob`) do NOT filter by `localePromptCompletedAt`, so theoretically a recently-activated user could receive a reminder before completing the modal. **Out of scope** for this cycle by user decision — locking it out of long-running notifications would be more harmful than the occasional locale mismatch.

### 2.4 What works correctly today

- `LocalePreferenceModal` machinery (`LocalePreferenceGate.tsx`, `POST /users/me/locale-preference`, `User.localePromptCompletedAt`).
- The `getWelcomeTemplate` template has full ES/EN/PT blocks (mirroring the corporate activation template pattern).
- All downstream emails (deadline reminders, results, payment receipts) correctly read `User.locale` once it's set.

## 3. Locked decisions

These are settled per the AskUserQuestion exchange on 2026-05-26.

### §3.1 Welcome email is deferred to LocalePreferenceModal completion

- Add `User.welcomeEmailSentAt DateTime?` (nullable). Default `null` at user creation.
- All three current `sendWelcomeEmail` call sites in `authService.ts` (lines 483, 545, 792) are **removed**.
- `POST /users/me/locale-preference` is the new single trigger point: when the user submits the modal, if `welcomeEmailSentAt IS NULL`, the endpoint fires the welcome email with the just-chosen `User.locale` and atomically flips `welcomeEmailSentAt = NOW()` inside the same transaction that sets `User.locale` and `localePromptCompletedAt`.
- The welcome thus always ships in the locale the user explicitly selected. No more "defaults to Spanish because we didn't know any better".

### §3.1.1 Backfill at migration time

The migration that adds `User.welcomeEmailSentAt` also runs an `UPDATE` that sets the column to `createdAtUtc` for every pre-existing user. Without this, the fallback job's first tick would treat every legacy user as "never welcomed in 24h" and attempt to re-send. Existing users have already passed through the prior welcome flow (or chose not to), so we mark them all as settled at migration time and only let the new behaviour apply to users created after.

### §3.2 Fallback job for users who never complete the modal

- New job `welcomeEmailFallbackJob` (hourly cron, advisory-lock-guarded, batch capped) finds `User WHERE welcomeEmailSentAt IS NULL AND createdAtUtc < now() - 24h`.
- For each, resolves locale as follows:
  - If user is a corporate-activated employee (joined a pool whose organization has `invitationLocale`): use that org's `invitationLocale`.
  - Otherwise (signup path): use `resolveUserLocale(user)` — the existing helper that reads `User.country` and ultimately the platform default.
- Ships the welcome and sets `welcomeEmailSentAt = NOW()`.
- No retries beyond that — if Resend fails, the row stays `null` and the next tick retries.
- Distinct advisory lock key (next available after `82636504n` for CC expiry → `82636505n`).

### §3.3 Activation URL is locale-aware

- New helper `buildActivationUrl(locale, token)` in `backend/src/lib/activationUrl.ts` that returns:
  - `${FRONTEND_URL}/activar-cuenta?token=…` for `es`
  - `${FRONTEND_URL}/en/activate-account?token=…` for `en`
  - `${FRONTEND_URL}/pt/ativar-conta?token=…` for `pt`
- `email.ts:930` rewritten to call the helper with the `locale` that the corporate-activation template already receives.
- Mirror of the routing.ts pathnames — comment in the helper explicitly links to `frontend-next/src/i18n/routing.ts:86-90` so a future routing change won't silently drift.

### §3.4 Scope: both corporate and signup paths

The welcome-deferral applies to ALL three current call sites uniformly. Google signup, email-verify, corporate activation — all three lose their `sendWelcomeEmail` inline call and rely on the modal trigger.

This means: a user who signs up traditionally with email/password, never verifies their email, but logs in anyway (they can — `requireAuth` doesn't check `emailVerified`), gets the welcome at the modal. Pre-cycle, they got it when they verified email. Net change: welcome arrives slightly earlier in the flow for that path, in their chosen locale. Improvement.

### §3.5 Background jobs are NOT touched

Filtering deadline reminders / new-member digest by `localePromptCompletedAt IS NOT NULL` would punish users who haven't completed the modal (e.g., closed the tab) by silencing legitimate notifications. The locale mismatch risk for those edge cases is acceptable; the alternative (silence) is worse.

If a real-world case emerges where a user complains "I got a reminder in the wrong language", we revisit. Not now.

### §3.6 Out of scope for this cycle

- ❌ Activation page contents are already trilingual — no change needed.
- ❌ Background-job locale filtering (per §3.5).
- ❌ The "welcome email" template itself — the ES/EN/PT branches already exist (`getWelcomeTemplate`), we're only fixing plumbing.
- ❌ Email verification flow — out of scope here. We're not redesigning when verification fires, only removing the welcome dispatch from that path.
- ❌ Inquiry-confirmation emails — already correct (`sendCorporateInquiryConfirmationEmail` reads locale from the inquiry payload).

## 4. Architecture sketch

### 4.1 New welcome timing — corporate path

```
Employee receives activation email in org.invitationLocale  (ADR-062 ✓)
       │
       ▼
clicks link → buildActivationUrl(locale, token)          (NEW — §3.3)
       │
       ▼
lands on /en/activate-account (matches email language)   (NEW — §3.3)
       │
       │  fills form, submits
       ▼
POST /auth/activate-corporate
  ├── creates User (welcomeEmailSentAt = NULL)            (NEW — §3.1)
  ├── writes audit row
  └── ❌ NO welcome email fired here                       (NEW — §3.1)
       │
       ▼
redirected to dashboard
       │
       ▼
LocalePreferenceGate detects localePromptCompletedAt = NULL
       │
       ▼
LocalePreferenceModal blocks dashboard
       │
       │  user picks locale
       ▼
POST /users/me/locale-preference
  ├── sets User.locale = "en"
  ├── sets localePromptCompletedAt = NOW
  ├── if welcomeEmailSentAt IS NULL:
  │     ├── fires sendWelcomeEmail(locale: "en")          (NEW — §3.1)
  │     └── sets welcomeEmailSentAt = NOW
  └── all in one transaction
```

### 4.2 New welcome timing — signup path (Google, email/password)

Same as above. The `LocalePreferenceModal` is the universal entrypoint for the welcome dispatch.

### 4.3 Fallback for users who never complete the modal

```
welcomeEmailFallbackJob runs hourly (advisory lock 82636505n)
       │
       ▼
SELECT * FROM User
WHERE welcomeEmailSentAt IS NULL
  AND createdAtUtc < now() - 24h
       │
       │  for each user (batch capped at 50):
       ▼
resolve locale:
  - corporate path:  read org.invitationLocale via pool membership
  - signup path:     resolveUserLocale(user)
       │
       ▼
sendWelcomeEmail(locale: resolved) + set welcomeEmailSentAt = NOW()
```

## 5. Open questions

None at locking time. Five high-level decisions confirmed via AskUserQuestion on 2026-05-26 before this audit was drafted.

If something comes up during implementation, log it here with Q-N numbering + resolution.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| User signs up, never opens the dashboard, never gets welcome | 24h fallback job (§3.2) catches them and ships with best-effort locale. |
| LocalePreferenceModal submission fails partway (network error between User update and welcome send) | Both updates are in the same `prisma.$transaction`. Welcome dispatch is `fireAndForget` AFTER the tx commits — if it fails, `welcomeEmailSentAt` is still null and the 24h job retries. |
| User completes the modal multiple times (theoretically impossible — the modal sets `localePromptCompletedAt` to NOW, so the gate stops showing it) | The endpoint checks `welcomeEmailSentAt IS NULL` before dispatching. If the user somehow re-enters and the flag is already set, no duplicate welcome. |
| The 24h fallback ships a welcome to a user who eventually does open the dashboard at hour 25 | Once `welcomeEmailSentAt` is set by the fallback, the modal endpoint sees it non-null and skips the re-send. No duplicate. |
| Resend API outage during modal submission | Welcome is `fireAndForget` — modal succeeds even if Resend is down. The 24h fallback re-tries (since `welcomeEmailSentAt` only gets set on send-success). |
| The corporate-path locale lookup in the fallback job (read org.invitationLocale) fails because the user has been ejected from the pool | `resolveUserLocale(user)` fallback chain catches it. |

## 7. Acceptance criteria

After all five commits land:

- [ ] `User.welcomeEmailSentAt` column exists in production, default `NULL`, zero data loss.
- [ ] Corporate activation `POST /auth/activate-corporate` no longer fires welcome inline. Verified by tailing logs during an activation.
- [ ] Google signup / email signup paths no longer fire welcome inline.
- [ ] `POST /users/me/locale-preference` fires welcome inside the same transaction, with the just-chosen `User.locale`. Verified by a Resend inbox test against EN, ES, PT.
- [ ] `welcomeEmailFallbackJob` registered in `server.ts`, runs hourly, idempotent via the `welcomeEmailSentAt` flag.
- [ ] The activation email link points to `/en/activate-account` when `locale = "en"`, etc. — verified by sending a test invite with each locale and inspecting the link in the inbox.
- [ ] No regression on inquiry-confirmation emails, check-in emails, or any background-job email.
- [ ] Type-check + build pass on both backend and frontend.
- [ ] ADR-063 lands in DECISION_LOG.md, BUSINESS_RULES.md gets a "Welcome email handoff" subsection, MEMORY.md updated.

## 8. Document version

- v1 — 2026-05-26 — initial draft. Audit + plan locked in the same session as the user's question.
