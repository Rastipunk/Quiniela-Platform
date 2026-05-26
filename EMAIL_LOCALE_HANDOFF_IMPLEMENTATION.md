# Email locale handoff — Implementation Tracker

> Companion to `EMAIL_LOCALE_HANDOFF_AUDIT.md`. This is the per-commit checklist. Update the status emoji + SHA as each commit lands so the work survives context breaks.
>
> Every locked decision is in `EMAIL_LOCALE_HANDOFF_AUDIT.md` §3. Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: schema + migration (`User.welcomeEmailSentAt DateTime?`) | 🟩 DONE | `7e06ece` |
| 2 | Backend: `buildActivationUrl(locale, token)` helper + wire into corporate-activation email | 🟩 DONE | `4d3b22d` |
| 3 | Backend: defer welcome — remove inline `sendWelcomeEmail` from all three `authService.ts` sites + dispatch from `POST /users/me/locale-preference` | 🟩 DONE | `ab32312` |
| 4 | Backend: `welcomeEmailFallbackJob` (hourly, 24h threshold, advisory lock `82636505n`) | 🟩 DONE | `6402eb9` |
| 5 | Docs: ADR-063 + BUSINESS_RULES §16 + CLAUDE.md invariant 11 + MEMORY entry | 🟩 DONE | (this commit) |

After commit 3 the feature is functionally complete for the happy path. Commit 4 is the safety net for users who never close the modal. Commit 5 is documentation hygiene.

---

## Pre-flight (do before commit 1)

- [x] Audit doc reviewed.
- [x] All locked decisions in §3 confirmed via AskUserQuestion (timing, fallback locale, activation URL, scope, background jobs out-of-scope, commit count).
- [ ] User says "go" for commit 1.

---

## 1 — Commit 1: Schema + migration

**Goal**: a single nullable column on `User` that marks whether the welcome has been sent. Default NULL = "pending or not yet eligible".

### 1.1 Files

- `backend/prisma/schema.prisma` — add one field to the `User` model.
- `backend/prisma/migrations/<timestamp>_add_user_welcome_email_sent_at/migration.sql` — hand-written SQL.

### 1.2 Schema diff

```diff
 model User {
   id                String   @id @default(uuid())
   email             String   @unique
   …
+
+  // Set when the welcome email actually ships. Two trigger paths:
+  //  (a) POST /users/me/locale-preference fires it after the user
+  //      picks their locale in LocalePreferenceModal (happy path).
+  //  (b) welcomeEmailFallbackJob fires it 24h after user creation
+  //      if (a) never happened. See EMAIL_LOCALE_HANDOFF_AUDIT.md §3.
+  welcomeEmailSentAt DateTime?
   …
 }
```

### 1.3 Migration SQL (exact)

```sql
-- backend/prisma/migrations/20260526_add_user_welcome_email_sent_at/migration.sql

ALTER TABLE "User"
  ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);
```

No index for v1. The fallback job's query (`WHERE welcomeEmailSentAt IS NULL AND createdAtUtc < cutoff`) scans `User` once per hour; at our user volume (~40 users today, ~thousands at scale) a sequential scan is fine. Revisit when the table grows past 100k rows.

### 1.4 Acceptance

- [ ] `npx prisma generate` regenerates the client without errors.
- [ ] `npx tsc --noEmit` in backend passes.
- [ ] Local sanity: `SELECT id, "welcomeEmailSentAt" FROM "User" LIMIT 5;` returns the new column with NULL for every row.
- [ ] After deploy: Railway logs show `prisma migrate deploy` applied the migration cleanly.

### 1.5 Commit message template

```
feat(welcome): User.welcomeEmailSentAt — schema + migration

Adds a single nullable DateTime column tracking whether the welcome
email has shipped. NULL = pending or not yet eligible. Populated by
two trigger paths landing in commit 3 and commit 4.

See EMAIL_LOCALE_HANDOFF_AUDIT.md §3 for the locked decisions.
Tracks EMAIL_LOCALE_HANDOFF_IMPLEMENTATION.md commit 1.

Co-Authored-By: …
```

### 1.6 Status

🟥 PENDING — SHA: —

---

## 2 — Commit 2: Localized activation URL

**Goal**: the link inside the corporate-activation email points to the locale-correct activation page.

### 2.1 Files

- `backend/src/lib/activationUrl.ts` (new, ~25 LOC) — `buildActivationUrl(locale, token)`.
- `backend/src/lib/email.ts:930` — replace the hardcoded `/activar-cuenta` with a call to the helper.

### 2.2 Helper shape

```ts
// backend/src/lib/activationUrl.ts

/**
 * Build the corporate-activation page URL for the given locale.
 *
 * Must mirror `frontend-next/src/i18n/routing.ts:86-90` (the
 * pathnames registry). When that file's "/activar-cuenta" entry
 * changes, change this helper too — there's no single source of
 * truth across the backend/frontend boundary today.
 */
export function buildActivationUrl(
  locale: "es" | "en" | "pt",
  token: string,
): string {
  const path =
    locale === "en" ? "/en/activate-account"
    : locale === "pt" ? "/pt/ativar-conta"
    : "/activar-cuenta";  // es default — no prefix
  return `${FRONTEND_URL}${path}?token=${encodeURIComponent(token)}`;
}
```

(`encodeURIComponent` is paranoia — activation tokens are hex strings so they should never need it, but defending against a future token format change is cheap.)

### 2.3 Email.ts diff

```diff
- const activationUrl = appendUtm(
-   `${FRONTEND_URL}/activar-cuenta?token=${params.activationToken}`,
-   emailUtm("corporate_activation"),
- );
+ const activationUrl = appendUtm(
+   buildActivationUrl(locale, params.activationToken),
+   emailUtm("corporate_activation"),
+ );
```

`locale` is already resolved on line 929 (`const locale = params.locale || DEFAULT_LOCALE;`) — no additional plumbing needed.

### 2.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Manual: send a test invite with `org.invitationLocale = "en"` to a Resend-monitored inbox. Inspect the link — should be `${FRONTEND_URL}/en/activate-account?token=…`.
- [ ] Same with `pt` → `${FRONTEND_URL}/pt/ativar-conta?token=…`.
- [ ] Same with `es` (or default) → `${FRONTEND_URL}/activar-cuenta?token=…`.
- [ ] Click each link → lands on the activation form in the matching locale (page already trilingual).

### 2.5 Status

🟥 PENDING — SHA: —

---

## 3 — Commit 3: Defer welcome to modal completion

**Goal**: welcome dispatch removed from `authService.ts` (three call sites). New dispatch point inside `POST /users/me/locale-preference`, gated by `User.welcomeEmailSentAt IS NULL`.

### 3.1 Files

- `backend/src/services/authService.ts` — remove the three `fireAndForget("welcome email", …)` calls at lines 483, 545, 792.
- `backend/src/routes/userProfile.ts` (or wherever `POST /users/me/locale-preference` lives — verified in audit §2 as `userProfile.ts:115` per the Explore agent) — extend the handler to dispatch welcome inside the existing transaction.
- `backend/src/services/userProfileService.ts` (if the service is separate) — add the welcome-dispatch logic.

### 3.2 authService.ts diff (three identical removals)

```diff
- fireAndForget("welcome email", sendWelcomeEmail({
-   to: newUser.email, userId: newUser.id, displayName: newUser.displayName,
- }));
+ // Welcome email is now dispatched from POST /users/me/locale-preference
+ // (or the 24h fallback job) so it always ships in the user's chosen
+ // locale. See EMAIL_LOCALE_HANDOFF_AUDIT.md §3.1.
```

### 3.3 locale-preference endpoint diff

Inside the existing transaction that updates `User.locale` + `User.localePromptCompletedAt`:

```diff
- await tx.user.update({
+ const updated = await tx.user.update({
    where: { id: userId },
    data: {
      locale: parsed.data.locale,
      country: parsed.data.country ?? null,
      requestedLocale: parsed.data.requestedLocale ?? null,
      localePromptCompletedAt: new Date(),
+     // Set welcomeEmailSentAt INSIDE this tx if it's still NULL.
+     // The actual sendWelcomeEmail call happens AFTER commit so a
+     // Resend outage doesn't roll back the user's locale choice.
+     welcomeEmailSentAt:
+       existing.welcomeEmailSentAt === null ? new Date() : undefined,
    },
+   select: { ... existing fields, plus welcomeEmailSentAt },
  });
```

Then after the `prisma.$transaction` callback returns successfully:

```ts
// fireAndForget so a Resend failure doesn't block the modal close.
// If sendWelcomeEmail throws, welcomeEmailSentAt is already set, so
// the 24h fallback won't retry. That's acceptable — the user has
// completed the modal, they've seen the dashboard; a missing welcome
// is recoverable via support, not via reopening the modal.
//
// If we wanted "retry on failure" we'd flip welcomeEmailSentAt back
// to NULL in the catch. v1 chooses simplicity.
if (existing.welcomeEmailSentAt === null) {
  fireAndForget("welcome email", sendWelcomeEmail({
    to: updated.email,
    userId: updated.id,
    displayName: updated.displayName,
    locale: parsed.data.locale,
  }));
}
```

`existing` is the user row fetched BEFORE the tx (to read the prior `welcomeEmailSentAt` value). The pattern matches the existing `localePromptCompletedAt` guard the endpoint already does.

### 3.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Unit test or manual: activate a corporate user, watch Resend dashboard — NO welcome email sent at activation time.
- [ ] Open dashboard, complete the modal in EN → welcome email arrives in English seconds later.
- [ ] DB check: `SELECT id, "welcomeEmailSentAt" FROM "User" WHERE id = '<that-user-id>'` shows a timestamp, not NULL.
- [ ] Repeat the modal completion (impossible in real UI, but force the endpoint manually): the welcome does NOT fire a second time.
- [ ] Same for Google signup: a freshly Google-registered user gets no welcome at registration; gets it at modal close.

### 3.5 Status

🟥 PENDING — SHA: —

---

## 4 — Commit 4: Fallback job

**Goal**: users who never complete the modal (closed the tab, etc.) still receive a welcome after 24h with a best-effort locale.

### 4.1 Files

- `backend/src/jobs/welcomeEmailFallbackJob.ts` (new, ~120 LOC, modeled on `accountReceivableExpiryJob.ts`).
- `backend/src/server.ts` — register start/stop hooks.

### 4.2 Job shape

```ts
// Pattern lifted from accountReceivableExpiryJob.ts (advisory lock,
// batch cap, idle early-exit).

const FALLBACK_CRON   = process.env.WELCOME_FALLBACK_CRON   || "15 * * * *";
const FALLBACK_HOURS  = Number(process.env.WELCOME_FALLBACK_HOURS  || "24");
const BATCH_SIZE      = Number(process.env.WELCOME_FALLBACK_BATCH  || "50");
const ADVISORY_LOCK_KEY = 82636505n;  // distinct from CC expiry (504n)

async function runOnce(): Promise<void> {
  await runWithClusterLock(async () => {
    const cutoff = new Date(Date.now() - FALLBACK_HOURS * 3600_000);

    const candidates = await prisma.user.findMany({
      where: {
        welcomeEmailSentAt: null,
        createdAtUtc: { lt: cutoff },
      },
      include: {
        // Pull the user's first corporate pool membership so we can
        // read the org's invitationLocale as the preferred locale
        // for the fallback welcome.
        poolMembers: {
          where: { role: "CORPORATE_HOST" }, // and PLAYER for activated employees
          take: 1,
          include: { pool: { include: { organization: { select: { invitationLocale: true } } } } },
        },
      },
      take: BATCH_SIZE,
    });

    for (const user of candidates) {
      // Resolve locale:
      const orgLocale = user.poolMembers[0]?.pool.organization?.invitationLocale;
      const locale = orgLocale ?? resolveUserLocale(user);

      try {
        const result = await sendWelcomeEmail({
          to: user.email,
          userId: user.id,
          displayName: user.displayName,
          locale,
        });
        // Mark sent regardless of result.success — Resend's
        // success flag is a delivery hint, not a delivery guarantee.
        // If we discover real failures we can flip to retry-on-error
        // later (would need to track a retry count to avoid loops).
        await prisma.user.update({
          where: { id: user.id },
          data: { welcomeEmailSentAt: new Date() },
        });
      } catch (err) {
        // Log and continue — next tick will retry.
        console.error(`[WelcomeFallback] User ${user.id}: ${err}`);
      }
    }
  });
}
```

Key details:
- Cron offset (`:15`) so this doesn't pile on the hour mark with other jobs.
- Membership query includes role filter for corporate detection. Standard pools (no organization) just fall through to `resolveUserLocale(user)`.
- Idempotency via `welcomeEmailSentAt`: once set, the row won't be picked up again. No retry counter needed.

### 4.3 Server registration

```diff
 import {
   startAccountReceivableExpiryJob,
   stopAccountReceivableExpiryJob,
 } from "./jobs/accountReceivableExpiryJob";
+ import {
+   startWelcomeEmailFallbackJob,
+   stopWelcomeEmailFallbackJob,
+ } from "./jobs/welcomeEmailFallbackJob";

 const server = app.listen(PORT, () => {
   …
   startAccountReceivableExpiryJob();
+  startWelcomeEmailFallbackJob();
 });

 // graceful shutdown
   stopAccountReceivableExpiryJob();
+  stopWelcomeEmailFallbackJob();
```

### 4.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Manually backdate a test user: `UPDATE "User" SET "createdAtUtc" = NOW() - INTERVAL '25 hours', "welcomeEmailSentAt" = NULL WHERE id = '<test-user>'`.
- [ ] Run `runWelcomeFallbackOnce()` (the exported test hook). Verify: Resend inbox receives the welcome in the resolved locale.
- [ ] DB: `welcomeEmailSentAt` for that user is now NOW().
- [ ] Run again: same user is NOT in the batch (filter excludes non-null).
- [ ] Production logs free of new errors for 24h after deploy.

### 4.5 Status

🟥 PENDING — SHA: —

---

## 5 — Commit 5: Docs

**Goal**: codify the welcome handoff so future work doesn't reintroduce the bug.

### 5.1 Files

- `docs/DECISION_LOG.md` — new entry **ADR-063: Welcome email locale handoff**.
- `docs/BUSINESS_RULES.md` — new §16 "Welcome email handoff".
- `CLAUDE.md` — §6 invariant 11: welcome is fired ONLY from `POST /users/me/locale-preference` or the fallback job. Never inline at signup/activation.
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — index entry pointing to a new `project_welcome_email_handoff.md` memory file.

### 5.2 ADR-063 outline

- **Context**: ADR-062 fixed the invitation email's locale but left the welcome email + the activation page locale-blind. User asked to defer welcome to the modal.
- **Decision**: welcome is fired exclusively from `POST /users/me/locale-preference` (or the 24h fallback). `User.welcomeEmailSentAt` is the single source of truth for "has this user been welcomed".
- **Consequences**: ✅ welcome always in user's chosen locale; ✅ no more "ships in Spanish then user picks English" awkward path; ⚠️ welcome arrives slightly later in the user journey (after dashboard load); ⚠️ users who never reach the dashboard get their welcome on the +24h fallback tick.

### 5.3 Acceptance

- [ ] ADR-063 written.
- [ ] BUSINESS_RULES.md §16 added.
- [ ] CLAUDE.md invariant 11 added.
- [ ] MEMORY.md indexed; `project_welcome_email_handoff.md` file written.

### 5.4 Status

🟥 PENDING — SHA: —

---

## Post-flight (after commit 4 lands)

Manual end-to-end verification against production:

- [ ] Corporate path: create a test corporate pool with `invitationLocale = "en"`, invite a Resend inbox, open the email — link should be `/en/activate-account?token=…`.
- [ ] Click the link → activation page renders in English.
- [ ] Fill the form, submit. NO welcome email arrives at this point.
- [ ] Lands on dashboard; LocalePreferenceModal blocks; pick EN → welcome email arrives in English seconds later. DB shows `welcomeEmailSentAt = NOW()`.
- [ ] Repeat the flow with PT and ES.
- [ ] Signup path: register a brand-new email/password user. NO welcome at signup. Verify email. STILL no welcome (we removed line 545). Log in → modal → pick ES → welcome arrives.
- [ ] Google signup path: same.
- [ ] Fallback scenario: backdate a test user's `createdAtUtc` to 25h ago and clear `welcomeEmailSentAt`. Trigger the job manually (or wait for the next :15 tick). Verify welcome arrives + row updated.

---

## Rollback plan

- Revert 5 → docs lose references; harmless.
- Revert 4 → fallback job stops; users who skip the modal don't get welcome. Live users unaffected (they go through the modal path).
- Revert 3 → welcome reverts to inline dispatch at the three authService sites. Locale plumbing for those was still broken in the v1 form pre-revert; technically a minor regression but not catastrophic (welcome ships in Spanish, same as today before this cycle started).
- Revert 2 → activation URL reverts to hardcoded `/activar-cuenta`. Non-Spanish users land in Spanish UI. Same as today.
- Revert 1 → `prisma migrate resolve --rolled-back` or down-migration `ALTER TABLE "User" DROP COLUMN "welcomeEmailSentAt"`. Zero data loss — the column is purely additive.

No customer-data destruction at any rollback step.

---

## Document version

- v1 — 2026-05-26 — initial draft, locked alongside EMAIL_LOCALE_HANDOFF_AUDIT.md v1.
