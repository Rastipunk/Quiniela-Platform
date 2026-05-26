# Corporate Invitation Locale — Audit & Design

> Companion to `CORPORATE_LOCALE_IMPLEMENTATION.md`. This is the "why" doc — every decision below is locked **before** code lands. If we need to change something, edit here first.
>
> Triggered by Caterine Ochoa (Native Intelligence SAS) on 2026-05-26: her employees are English-speaking but invitation emails arrive with the Spanish snippet "Hey! Tu equipo en Native Intelligence SAS ya está armando su quiniela…" hardcoded.

---

## 1. Problem statement

When a corporate host invites employees to their pool (link / code / CSV import / individual add), the activation email goes to the employee with the body **always in Spanish**, regardless of the recipient's or organization's language. The host cannot choose the language at any point — in the creation wizard nor in the post-creation branding panel.

This blocks the platform from being usable for non-Spanish-speaking corporate clients, and Caterine's case is the first concrete report.

## 2. Verified current state

### 2.1 The email template already speaks three languages

`backend/src/lib/emailTemplates.ts:980-1050` — `getCorporateActivationTemplate(params)` accepts `params.locale` and contains complete `es | en | pt` blocks. Default locale: `"es"` (line 929 of `email.ts`).

**The bug is not in the template. The bug is that the locale never reaches it.**

### 2.2 Where the locale gets lost

| File | Line | Behaviour |
|---|---|---|
| `backend/src/services/corporateService.ts` | 638 (`sendInvitations`) | Iterates over `pendingInvites`, calls `sendCorporateActivationEmail(...)` **without `locale`** |
| `backend/src/lib/email.ts` | 914 (`sendCorporateActivationEmail`) | Reads `params.locale ?? DEFAULT_LOCALE`, which is `"es"` |

So 100% of activation emails today render the `es` branch of the template, even though the template fully supports the other two.

### 2.3 The Organization model has no locale field

`backend/prisma/schema.prisma` — `Organization` carries `name, contactEmail, contactPhone, logoUrl, logoBase64, website, welcomeMessage, invitationMessage, primaryColor, secondaryColor, employeeCount, notes, status, …` but **nothing locale-related**.

### 2.4 No UI surface to set the locale today

- `frontend-next/src/components/pool-wizard/steps/corporate/StepCompanyInfo.tsx` — collects logo, colors, welcomeMessage, invitationMessage, companyName. **No locale selector.**
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolBrandingTab.tsx` — same field set, editable post-creation. **No locale selector.**

### 2.5 The post-activation user-locale machinery is already complete

This is a load-bearing observation for the design (§4.2). Verified:

- `User.localePromptCompletedAt` exists. NULL until the user submits the locale-preference modal.
- `frontend-next/src/components/LocalePreferenceModal.tsx` (446 lines) — fully-localized blocking modal, mounted globally via `LocalePreferenceGate` (`AuthenticatedLayoutClient.tsx:29`).
- `POST /users/me/locale-preference` persists the choice → sets `User.locale` + flips `localePromptCompletedAt` to NOW.
- After completion, every downstream email reads `User.locale` (deadline reminders, results, etc.).

**Conclusion:** the corporate-invitation locale only needs to govern the *first* email — the one sent before any `User` row exists for the employee. The very first time the employee logs in (right after activating), the existing modal blocks the dashboard until they confirm/change the language preference. From that point onward, `User.locale` is authoritative for all communication. No changes required to that machinery.

## 3. Locked decisions

These are settled. If a new decision contradicts one of these, revisit this section and reason about the consequences explicitly before changing it.

### §3.1 Granularity — one locale per organization

- `Organization.invitationLocale String @default("es")`.
- One per org, **not** per invitation. No per-row override in the CSV import.
- Trade-off: clients with mixed-language teams (5 EN employees + 3 ES) have to pick one. We accept that — the post-activation modal lets each employee fix their personal locale immediately, so even the "wrong" group only sees one Spanish email before correcting course. The CSV-override path was rejected for v1 (extra column, doc work, edge cases) — revisit if real demand surfaces.

### §3.2 Scope — only the activation email is governed by this field

- `invitationLocale` controls `sendCorporateActivationEmail` only.
- All other corporate emails to the employee (`sendCorporateCheckinEmail`, deadline reminders, results, etc.) read `User.locale` once it exists.
- Inquiry confirmation (`sendCorporateInquiryConfirmationEmail`) is to the *prospect* before any org exists; it already reads locale from the inquiry payload, **untouched** by this work.

### §3.3 Naming — `invitationLocale` (verbatim)

- Schema column: `invitationLocale`.
- UI label (ES): "Idioma de las invitaciones".
- UI helper text: "El primer correo a tus empleados se envía en este idioma. Cuando activen su cuenta, pueden elegir su propio idioma para los correos siguientes."
- Why not `defaultLocale` / `communicationLocale`: those names invite future scope creep — someone six months from now would assume they govern reminders too, then file a "broken" bug when reminders use `User.locale` instead. The verbose name pre-empts that.

### §3.4 UI placement — inline in the existing forms

- **Wizard:** new field inside `StepCompanyInfo.tsx`, in the same logical block as welcome/invitation messages.
- **Post-creation:** new field inside `PoolBrandingTab.tsx`, same block.
- No new wizard step, no new panel section. The host already mentally lives in this surface when configuring how their company talks to employees.

### §3.5 Backfill — DEFAULT `"es"` + UI visibility

- Migration `ALTER TABLE "Organization" ADD COLUMN "invitationLocale" TEXT NOT NULL DEFAULT 'es'`.
- All existing pools keep behaving exactly as today (zero behavioural change for current users).
- The branding panel surfaces the current value prominently so existing hosts can change it the first time they open it.
- No proactive email blast to existing corporate hosts — out of scope, would be marketing noise for ~99% who don't need it.

### §3.6 Validation — Zod enum on every boundary

- Backend Zod: `z.enum(["es", "en", "pt"])` on both `POST /corporate/pools` and `PATCH /corporate/pools/:poolId/branding`.
- Frontend types: reuse `SaleLocale` (= `"es" | "en" | "pt"`) from `lib/api/sales.ts` to keep one canonical locale union across the codebase.
- Reject any other value with 400 — the dropdown only emits the three, so a non-match means a tampered request.

### §3.7 Audit logging

- Changing the field via the branding panel writes an audit row (same pattern as the other `Organization` fields). Reuse `writeAuditEvent` with action `CORPORATE_INVITATION_LOCALE_UPDATED` + `{ from, to }`.
- The initial value at wizard-creation time is captured by the existing `ORGANIZATION_CREATED` audit row (which already snapshots every field); no new audit type for that path.

### §3.8 No retroactive re-send

- Changing `invitationLocale` does NOT re-send invitations that already shipped. The host changing from ES → EN tomorrow only affects new invitations going forward. PENDING invites that already got an email keep the Spanish one in their inbox.
- If the host wants to "redo" the language for stuck invitations, they use the existing **resend** action (`POST /corporate/pools/:poolId/employees/:inviteId/resend`) which rotates the token and re-sends; the resend reads `org.invitationLocale` at send time so it will pick up the new value. Document this in BUSINESS_RULES.md.

### §3.9 Out of scope for v1

- ❌ Per-invitation locale override (CSV column or per-row picker).
- ❌ Locale-aware welcomeMessage / invitationMessage (those are free-text the host writes themselves; if they wrote them in Spanish but switch the org to EN, that's a host responsibility — we don't auto-translate).
- ❌ A separate "communication preferences" panel.
- ❌ Notifying existing corporate hosts proactively.

## 4. Architecture sketch

### 4.1 Data flow on a corporate invitation

```
Host opens PoolBrandingTab
       │
       │  picks "EN" in the new dropdown
       ▼
PATCH /corporate/pools/:poolId/branding { invitationLocale: "en" }
       │
       │  Zod validates, audit row written, Organization row updated
       ▼
Organization.invitationLocale = "en"   (now persisted)
       │
       │
       │  ─── days/weeks later ───
       │
       ▼
Host clicks "Invite employees" → uploads CSV
       │
       ▼
corporateService.sendInvitations(poolId)
       │  reads org.invitationLocale          ◄── this is the new plumbing
       │
       ▼
sendCorporateActivationEmail({ ..., locale: org.invitationLocale })
       │
       ▼
getCorporateActivationTemplate({ ..., locale: "en" })
       │
       ▼
"Hey! Your team at Native Intelligence SAS is putting together their pool…"
```

### 4.2 Handoff to User.locale at first login

Already-built machinery, kept exactly as-is — verified in §2.5. The point of this diagram is that the new `invitationLocale` does NOT propagate beyond the first email; subsequent emails are governed by `User.locale`, which the employee owns.

```
Employee receives EN invitation email
       │
       ▼
clicks /activar?token=…
       │
       ▼
sets password → POST /auth/activate-corporate → User row created
       │
       ▼
redirected to /dashboard
       │
       ▼
LocalePreferenceGate sees User.localePromptCompletedAt = NULL
       │
       ▼
LocalePreferenceModal renders (blocking, can't dismiss)
       │
       │  employee picks EN (or ES, or PT — their own preference)
       ▼
POST /users/me/locale-preference → User.locale = "en", localePromptCompletedAt = NOW
       │
       ▼
All subsequent emails to this user read User.locale
```

`Organization.invitationLocale` is no longer consulted for this employee after this point — the field's purpose ended with the first email.

## 5. Open questions

None at locking time. The four high-level decisions in §3.1 → §3.5 were confirmed with the issuer via the AskUserQuestion flow on 2026-05-26 before this audit was written. Naming and commit shape were similarly confirmed.

If something comes up during implementation, log it here with `Q-N` numbering + the resolution.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Host picks the wrong locale by accident (e.g. confused dropdown). | The post-activation `LocalePreferenceModal` lets each employee fix their personal language immediately. Worst case: one wrong-language email per employee. |
| `User.locale` is briefly NULL between activation and modal completion → emails sent during that window default to `"es"`. | Window is sub-minute (modal is blocking the dashboard). No corporate email today is sent in that window. Document the invariant: nothing schedules an email targeting a user whose `localePromptCompletedAt` is NULL. |
| Existing organizations all default to `"es"` and never get reminded the toggle exists. | Out of scope for v1 by design (§3.5). Optionally surface a small "🌐 Invitation language: ES — change" hint at the top of `PoolBrandingTab` so the field has high visibility on first visit. **DECISION**: include this hint, no marketing blast. |
| A host changes the field after CSV upload but BEFORE the job-driven invite emails actually leave. | `sendInvitations` reads `org.invitationLocale` at send-time, not at upload-time. Last-writer-wins is the correct semantic: the host's most recent intent is what ships. |

## 7. Acceptance criteria

After all five commits land:

- [ ] `Organization.invitationLocale` column exists in production, default `'es'`, no behaviour change for existing pools.
- [ ] The corporate wizard's "Company Info" step has a locale dropdown (ES / EN / PT), state plumbs through, and POST to `/corporate/pools` persists the choice.
- [ ] The `PoolBrandingTab` for an existing corporate pool exposes the same dropdown; PATCH `/corporate/pools/:poolId/branding` persists the new value + writes an audit row.
- [ ] Inviting an employee on a pool whose `invitationLocale = "en"` triggers an email whose body is the English template (verified by emitting a test invite in dev to a Resend inbox and checking the rendered HTML).
- [ ] Existing pools keep sending Spanish (verified for at least one pool whose `invitationLocale` defaulted to `"es"` by the migration).
- [ ] Type-check + build pass on both backend and frontend.
- [ ] `ADR-062` lands in DECISION_LOG.md, `BUSINESS_RULES.md` gets a "Corporate invitation locale" subsection, MEMORY.md updated.

## 8. Document version

- v1 — 2026-05-26 — initial draft. Audit + plan locked in the same hour after Caterine's report.
