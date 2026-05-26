# Corporate Invitation Locale — Implementation Tracker

> Companion to `CORPORATE_LOCALE_AUDIT.md`. This is the per-commit checklist. Update the status emoji + SHA as each commit lands so the work survives context breaks.
>
> Every locked decision is in `CORPORATE_LOCALE_AUDIT.md` §3. Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: schema + migration (`Organization.invitationLocale` String DEFAULT `'es'`) | 🟩 DONE | `6708ab3` |
| 2 | Frontend: `StepCompanyInfo` locale picker + wizard state + corporate-create POST plumb | 🟩 DONE | `a6bcbf3` |
| 3 | Frontend + Backend: `PoolBrandingTab` locale picker + `PATCH /corporate/pools/:poolId/branding` accepts the field | 🟩 DONE | `582cce3` |
| 4 | Backend: `corporateService.sendInvitations` reads `org.invitationLocale` → passes to `sendCorporateActivationEmail` | 🟩 DONE | `23a83bc` |
| 5 | Docs: ADR-062 + BUSINESS_RULES update + MEMORY entry | 🟩 DONE | (this commit) |

After commit 4 the feature is functional. Commit 5 is documentation hygiene.

---

## Pre-flight (do before commit 1)

- [x] Audit doc reviewed.
- [x] All locked decisions in §3 confirmed via AskUserQuestion (granularity, scope, naming, UI placement, backfill, commit count).
- [ ] User says "go" for commit 1.

---

## 1 — Commit 1: Backend schema + migration

**Goal**: persist the per-org invitation locale. Additive migration; zero behavioural change.

### 1.1 Files

- `backend/prisma/schema.prisma` — add one line to the `Organization` model.
- `backend/prisma/migrations/<timestamp>_add_organization_invitation_locale/migration.sql` — hand-written SQL (mirrors the convention used in previous migrations, not `prisma migrate dev`).

### 1.2 Schema diff

```diff
 model Organization {
   id                  String   @id @default(uuid())
   name                String
   contactEmail        String
   …
+
+  // First-contact email locale. Governs ONLY the corporate-activation
+  // email (the one sent before any User row exists for the employee).
+  // Once the employee activates, the LocalePreferenceModal lets them
+  // pick their personal locale; from that point on, User.locale is
+  // authoritative. See CORPORATE_LOCALE_AUDIT.md §3.2.
+  invitationLocale    String   @default("es")
+
   createdAtUtc        DateTime @default(now())
   updatedAtUtc        DateTime @updatedAt
 }
```

### 1.3 Migration SQL (exact)

```sql
-- 20260527_add_organization_invitation_locale/migration.sql
ALTER TABLE "Organization"
  ADD COLUMN "invitationLocale" TEXT NOT NULL DEFAULT 'es';
```

No index needed — the column is queried only by `findUnique` on `id` (already PK-indexed) and the value is read once per `sendInvitations` call.

### 1.4 Acceptance

- [ ] `npx prisma generate` regenerates the client without errors.
- [ ] `npx tsc --noEmit` in backend passes.
- [ ] Local test against the dev DB: `SELECT id, name, "invitationLocale" FROM "Organization" LIMIT 5;` returns the new column with `'es'` for every row.
- [ ] After deploy: Railway logs show `prisma migrate deploy` ran the migration cleanly; production DB shows the column.

### 1.5 Commit message template

```
feat(corporate): Organization.invitationLocale — schema + migration

Adds a single string column to the Organization model that governs
the first-contact email language for corporate invitations. Default
"es" so existing pools behave exactly as today.

See CORPORATE_LOCALE_AUDIT.md §3.1, §3.5 for the locked decisions.
Tracked in CORPORATE_LOCALE_IMPLEMENTATION.md commit 1.

Co-Authored-By: …
```

### 1.6 Status

🟩 DONE

---

## 2 — Commit 2: Wizard locale picker + state + create-pool plumb

**Goal**: the host picks the locale in `StepCompanyInfo`; the choice persists on pool creation.

### 2.1 Files

- `frontend-next/src/types/poolWizard.ts` — add `invitationLocale?: "es" | "en" | "pt"` to `WizardState` (default `"es"`).
- `frontend-next/src/components/pool-wizard/PoolWizardContext.tsx` — populate the default in `getInitialState`.
- `frontend-next/src/components/pool-wizard/steps/corporate/StepCompanyInfo.tsx` — add the locale picker.
- `frontend-next/src/lib/api/corporate.ts` — extend the `createCorporatePool` body type with `invitationLocale`.
- `backend/src/routes/corporate.ts` — the create-pool endpoint's Zod schema accepts `invitationLocale: z.enum(["es","en","pt"]).default("es")`. Pass it through to `corporateService.createCorporatePoolWithOrganization` (or whatever creates the Organization row).
- `backend/src/services/corporateService.ts` — `createCorporatePoolWithOrganization` writes `invitationLocale` to the new Organization row.

### 2.2 UI sketch (StepCompanyInfo)

```
┌──────────────────────────────────────────────────────────┐
│  Información de tu empresa                              │
├──────────────────────────────────────────────────────────┤
│  Nombre comercial:        [______________________]      │
│  Logo:                    [drag-and-drop or pick]       │
│  Color primario:          [#xxxxxx ▣]                   │
│  Color secundario:        [#xxxxxx ▣]                   │
│  Mensaje de bienvenida:   [textarea]                    │
│  Mensaje de invitación:   [textarea]                    │
│                                                          │
│  ─────────  Comunicación  ─────────                     │
│  Idioma de las invitaciones:                            │
│   ◉ Español   ○ English   ○ Português                   │
│                                                          │
│  El primer correo a tus empleados se envía en este      │
│  idioma. Cuando activen su cuenta, pueden elegir su     │
│  propio idioma para los correos siguientes.             │
└──────────────────────────────────────────────────────────┘
```

Component: three pill-buttons (same pattern as the locale picker in `AdminQuoteCreateContent`). Active pill = brand color background.

### 2.3 Acceptance

- [ ] `npx tsc --noEmit` passes (frontend + backend).
- [ ] `npx next build` succeeds.
- [ ] Manual: create a corporate pool via the wizard with `locale = "en"` selected → DB shows `Organization.invitationLocale = 'en'` for the new row.
- [ ] Default path: don't touch the dropdown → DB shows `'es'`.

### 2.4 Status

🟩 DONE

---

## 3 — Commit 3: Branding panel + PATCH endpoint

**Goal**: post-creation, the host can change the locale from the branding tab. Updates emit an audit event.

### 3.1 Files

- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolBrandingTab.tsx` — add the same picker; surface the **current** value prominently per §6 risk-mitigation note.
- `frontend-next/src/lib/api/corporate.ts` — extend the PATCH-branding body type.
- `backend/src/routes/corporate.ts` — `PATCH /corporate/pools/:poolId/branding` Zod schema accepts optional `invitationLocale: z.enum(["es","en","pt"]).optional()`.
- `backend/src/services/corporateService.ts` — `updateOrganizationBranding` writes the new value if provided, writes an audit row `CORPORATE_INVITATION_LOCALE_UPDATED` with `{ from, to }` when the value actually changes.

### 3.2 UI sketch (PoolBrandingTab)

Above the existing color/logo block, a small status hint that **always** renders, even before the host expands the section:

```
🌐 Idioma de las invitaciones: ES — Cambiar
```

Clicking "Cambiar" scrolls/focuses the picker inside the form. Same component as the wizard step, identical UX.

### 3.3 Audit shape

```ts
await writeAuditEvent({
  action: "CORPORATE_INVITATION_LOCALE_UPDATED",
  organizationId,
  userId,
  metadata: { from: oldLocale, to: newLocale },
});
```

### 3.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Manual: open the branding tab of an existing pool (locale defaulted to "es") → status hint renders "🌐 Idioma de las invitaciones: ES — Cambiar".
- [ ] Manual: switch to "en" → save → reload → status hint shows "EN".
- [ ] DB: `SELECT * FROM "AuditEvent" WHERE action = 'CORPORATE_INVITATION_LOCALE_UPDATED'` returns the row with `from: 'es', to: 'en'`.
- [ ] Switching to the same value (e.g. ES → ES) does NOT write an audit row (no-op detection).

### 3.5 Status

🟩 DONE

---

## 4 — Commit 4: Plumb locale into the activation email

**Goal**: `sendCorporateActivationEmail` actually receives the org's locale. This is the commit that fixes Caterine's reported bug.

### 4.1 Files

- `backend/src/services/corporateService.ts` — `sendInvitations` (line 638) currently does `await sendCorporateActivationEmail({ … })` with no `locale`. Read the org's `invitationLocale` once (already in scope or one query away) and pass it.

### 4.2 Diff sketch

```diff
 async function sendInvitations(poolId: string) {
-  const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: { organization: true } });
+  const pool = await prisma.pool.findUnique({
+    where: { id: poolId },
+    include: { organization: true },
+  });
   if (!pool?.organization) throw …;
+
+  const invitationLocale = pool.organization.invitationLocale;
+
   …
   for (const invite of pendingInvites) {
     await sendCorporateActivationEmail({
       to: invite.email,
       activationUrl,
       …,
+      locale: invitationLocale,
     });
   }
 }
```

(If `pool.organization` is already fetched in scope, this is just one new line for the destructure + one new line in the call.)

### 4.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] **Production verification** — create a test pool with `invitationLocale = "en"`, invite a Resend-monitored test inbox, open the email, confirm the body renders the English template (specifically the "Hey! Your team at … is putting together their pool…" snippet, not the Spanish one).
- [ ] Existing pools (`invitationLocale = "es"` by migration default) keep sending Spanish — verified by inviting to a test inbox from an existing org.
- [ ] No regression on `sendCorporateInquiryConfirmationEmail` or `sendCorporateCheckinEmail` — they keep reading their own locale sources (verified by reading the call sites; they don't touch this code path).

### 4.4 Status

🟩 DONE

---

## 5 — Commit 5: Docs

**Goal**: codify the feature so future work doesn't have to rediscover the locked decisions.

### 5.1 Files

- `docs/DECISION_LOG.md` — new entry **ADR-062: Corporate invitation locale**.
- `docs/BUSINESS_RULES.md` — new subsection under §6 (Corporate) titled "Invitation locale", documenting:
  - Field semantics (first-touch only).
  - Handoff to `User.locale` via `LocalePreferenceModal`.
  - Resend behaviour (re-reads field at send time).
  - No retroactive re-send.
- `CLAUDE.md` — small addition to the "Corporate" section noting `Organization.invitationLocale` controls activation-email language only.
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — add a one-line index entry pointing to a new `project_corporate_locale.md` memory file with the feature summary.

### 5.2 ADR-062 outline

- **Context**: Caterine Ochoa report, 2026-05-26. Native Intelligence SAS has English-speaking employees, activation emails arrive hardcoded ES.
- **Decision**: per-org `invitationLocale` governing the *first* email only; downstream emails read `User.locale` (already-built machinery).
- **Consequences**: ✅ unblocks non-Spanish corporate clients; ⚠️ host with mixed-language team picks one default + relies on each employee's personal modal completion to right-size their experience; ⚠️ resend re-reads field at send time (last-writer-wins).
- **Related code**: pointers to the 4 commits + the audit/implementation docs.

### 5.3 Acceptance

- [ ] ADR-062 written.
- [ ] BUSINESS_RULES.md subsection added.
- [ ] CLAUDE.md cross-reference added.
- [ ] MEMORY.md indexed; the underlying `project_corporate_locale.md` file written.

### 5.4 Status

🟩 DONE

---

## Post-flight (after commit 4 lands)

Manual end-to-end verification against production:

- [ ] Open `/admin/ventas` or the corporate dashboard — pick a real (test) pool → branding tab → switch to EN → save.
- [ ] Add an employee via the manual-invite form → confirm the email at the recipient inbox renders English.
- [ ] Activate the employee → confirm the `LocalePreferenceModal` blocks the dashboard → pick PT → confirm the next email this user receives (e.g. a deadline reminder if any pool match is close) is in PT.
- [ ] As host, change `invitationLocale` to PT → invite another employee → confirm PT body.
- [ ] Try the resend action on a stuck invite — confirm the resend reads the current `invitationLocale`, not the value at original-send time.
- [ ] Verify DB: `SELECT id, name, "invitationLocale" FROM "Organization" ORDER BY "createdAtUtc" DESC LIMIT 10;` matches the UI for every row.
- [ ] Production logs free of new errors for 24h after deploy.

---

## Rollback plan

Each commit is atomic; rollback is sequential reverts:

- Revert 5 → docs lose the references; harmless.
- Revert 4 → activation emails revert to ES default. The field still exists in DB, just isn't read. Existing pools keep working.
- Revert 3 → host can't change the value post-creation but the field still persists from creation time.
- Revert 2 → wizard always creates orgs with the default `'es'`. The field still works DB-side.
- Revert 1 → `prisma migrate resolve --rolled-back …` or a down-migration `ALTER TABLE "Organization" DROP COLUMN "invitationLocale"`. Zero data loss (the column is purely additive).

No customer-data destruction at any rollback step.

---

## Document version

- v1 — 2026-05-26 — initial draft, locked alongside CORPORATE_LOCALE_AUDIT.md v1.
