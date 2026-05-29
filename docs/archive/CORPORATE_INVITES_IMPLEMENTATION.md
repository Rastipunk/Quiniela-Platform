# Corporate Pool Code/Link Invites — Implementation Tracker

> **Companion doc to** `CORPORATE_INVITES_AUDIT.md` (the audit). This file is the **step-by-step checklist** used during execution. Update the status emoji + SHA as each step lands so the work survives context breaks.
>
> **Locked decisions** (from audit §6):
> 1. New module lives in **Jugadores tab**, between `CorporateEmployeeManager` (top) and `MemberManagement` (bottom).
> 2. **Disclaimer is mandatory** inside the new section. See §3 for the canonical text.
> 3. **Soft-revoke** = `expiresAtUtc = now()`. Preserves `acceptedByUserId` denormalization.
> 4. **Recommendation about `requireApproval`** is folded into the disclaimer copy, not a separate nudge.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Trilingual guarantee (applies to every commit that touches UI)

Every commit that touches user-facing text MUST satisfy:

1. **All three locales (`es`, `en`, `pt`) have the same key set.** Any key added to one is added to the other two in the same commit. No `defaultMessage` fallbacks.
2. **No hardcoded user-facing strings in TSX.** Every visible string goes through `t()` from `next-intl`.
3. **Manual check before push**: open the changed page on `?` (ES default), `/en/...`, `/pt/...` — confirm rendering looks correct on each. If the page is gated (logged-in), use the test corporate pool created for this work.
4. **Date formatting respects locale**: `expiresSummary` uses `Intl.DateTimeFormat(locale)` or the existing `formatMatchDateTime(iso, tz, locale)` helper (already trilingual after F-2).
5. **Plural-aware where applicable**: `usesLabel` and `expiresCustomHint` use ICU plurals so "1 hora" vs "2 horas" / "1 hour" vs "2 hours" / "1 hora" vs "2 horas" all render correctly.

These checks are repeated in §8 (pre-flight) and §9 (post-flight) so they fire twice — once before the work starts on each commit and once after it deploys.

---

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Backend: fix `/invite-preview` defects + expose `organization` | 🟩 DONE | `824b646` |
| 2 | Backend: list + revoke endpoints for `PoolInvite` + audit payload | 🟩 DONE | `d7adbca` |
| 3 | Frontend: branded `/invite?code=…` landing for corporate pools | 🟩 DONE | `34e8eae` |
| 4 | Frontend: `PoolInviteCodeManager` component + mount + i18n | 🟩 DONE | `b64f06d` |
| 5 | Doc: ADR + MEMORY update | 🟥 PENDING | — |

After commit 4 the feature is live for the user. Commit 5 is documentation hygiene.

---

## 1 — Disclaimer copy (canonical text, all 3 locales)

This is the user-visible warning shown above the "Generar enlace" button in `PoolInviteCodeManager`. Wording matters — the user explicitly asked for the disclaimer. Drafted now so the i18n step is mechanical.

### ES (default)

> **Importante antes de generar un enlace**
>
> - Cualquier persona con el enlace puede unirse — incluyendo gente fuera de tu empresa si lo reenvían.
> - Cada persona que se una **ocupa un cupo** de la capacidad de la pool (`{current}/{max}`).
> - Recomendado: en **Administración** activa "Aprobación manual" para revisar quién se une antes de aceptar.
> - Puedes revocar el enlace cuando quieras, pero los que ya entraron se quedan (usa Expulsar si necesitas removerlos).
> - **Recomendamos invitar por correo** (arriba): es un método más controlado, donde cada invitación queda atada a una persona específica.

### EN

> **Before you generate a link**
>
> - Anyone with the link can join — including people outside your company if it gets forwarded.
> - Every joiner **takes a slot** from the pool's capacity (`{current}/{max}`).
> - Recommended: in **Administración** enable "Manual approval" so you review each joiner before accepting.
> - You can revoke the link anytime, but already-joined members stay (use Expulsar to remove them).
> - **We recommend email invites** (above): a more controlled method where each invitation is bound to a specific person.

### PT

> **Antes de gerar um link**
>
> - Qualquer pessoa com o link pode entrar — incluindo gente fora da sua empresa se for encaminhado.
> - Cada pessoa que entra **ocupa uma vaga** da capacidade da pool (`{current}/{max}`).
> - Recomendado: em **Administração** ative "Aprovação manual" para revisar quem entra antes de aceitar.
> - Você pode revogar o link a qualquer momento, mas quem já entrou permanece (use Expulsar se precisar removê-los).
> - **Recomendamos convidar por e-mail** (acima): um método mais controlado, onde cada convite fica vinculado a uma pessoa específica.

---

## 2 — i18n key inventory

All keys under `pool.admin.codeInvites.*` so they sit alongside `pool.admin.employees.*`. Drop-in to all three locale files.

```
pool.admin.codeInvites.title             "Invitar con enlace compartible" / "Share an invite link" / "Convidar com link compartilhável"
pool.admin.codeInvites.subtitle          "Genera un enlace para que los miembros se unan sin tener que escribir cada correo." / etc.

pool.admin.codeInvites.disclaimerTitle   "Importante antes de generar un enlace" / "Before you generate a link" / "Antes de gerar um link"
pool.admin.codeInvites.disclaimerBullet1 (anyone w/ link)
pool.admin.codeInvites.disclaimerBullet2 (capacity counter, {current}/{max})
pool.admin.codeInvites.disclaimerBullet3 (recommended: manual approval, links to Admin)
pool.admin.codeInvites.disclaimerBullet4 (revoke does not remove joined)
pool.admin.codeInvites.disclaimerBullet5 (email flow remains the controlled alternative)

pool.admin.codeInvites.generateButton    "Generar enlace nuevo"
pool.admin.codeInvites.generating        "Generando..."
pool.admin.codeInvites.formMaxUses           "Cupos disponibles del enlace"
pool.admin.codeInvites.formMaxUsesHint       "Por defecto: cupos libres en la pool ({remaining})"

pool.admin.codeInvites.formExpires            "¿Cuánto tiempo será válido el enlace?"
pool.admin.codeInvites.formExpiresHint        "Después de este tiempo el enlace deja de funcionar. Los miembros ya unidos se mantienen."
pool.admin.codeInvites.expiresPreset1h        "1 hora"
pool.admin.codeInvites.expiresPreset6h        "6 horas"
pool.admin.codeInvites.expiresPreset24h       "24 horas"
pool.admin.codeInvites.expiresPreset7d        "1 semana"
pool.admin.codeInvites.expiresPreset30d       "30 días"
pool.admin.codeInvites.expiresCustom          "Personalizado"
pool.admin.codeInvites.expiresCustomDaysLabel "Días"
pool.admin.codeInvites.expiresCustomHoursLabel "Horas"
pool.admin.codeInvites.expiresCustomHint      "Mínimo 1 hora, máximo 365 días."
pool.admin.codeInvites.expiresCustomErrorMin  "Debe ser al menos 1 hora"
pool.admin.codeInvites.expiresCustomErrorMax  "Máximo 365 días"
pool.admin.codeInvites.expiresCustomErrorNaN  "Días y horas deben ser números enteros"
pool.admin.codeInvites.expiresSummary         "Expira el {date}" / "Expires {date}" / "Expira em {date}"

pool.admin.codeInvites.formSubmit            "Crear enlace"
pool.admin.codeInvites.formCancel            "Cancelar"

pool.admin.codeInvites.activeListTitle   "Enlaces activos"
pool.admin.codeInvites.empty             "Aún no has creado ningún enlace."
pool.admin.codeInvites.usesLabel         "{uses} de {max} usos" / "{uses} of {max} uses" / "{uses} de {max} usos"
pool.admin.codeInvites.usesUnlimited     "{uses} usos (sin límite)" / "{uses} uses (no limit)" / "{uses} usos (sem limite)"
pool.admin.codeInvites.expiresLabel      "Expira {date}"
pool.admin.codeInvites.expiredLabel      "Expirado"
pool.admin.codeInvites.copyButton        "Copiar enlace"
pool.admin.codeInvites.copied            "Copiado ✓"
pool.admin.codeInvites.shareButton       "Compartir"
pool.admin.codeInvites.revokeButton      "Revocar"
pool.admin.codeInvites.revokeConfirm     "¿Seguro que quieres revocar este enlace? No se podrá usar más, pero los miembros ya unidos se quedan."
pool.admin.codeInvites.revokeSuccess     "Enlace revocado"

pool.admin.codeInvites.adminLinkLabel    "Ir a Administración" (anchor inside disclaimer bullet 3)
```

---

## 3 — Step-by-step: Commit 1 — Backend `/invite-preview` fixes

**Goal**: `/invite-preview/:code` returns the org branding payload + correct host name for corporate pools.

### 3.1 Files

- [backend/src/server.ts](backend/src/server.ts) — modify the `/invite-preview/:code` handler in place (~25 LOC change).

### 3.2 Changes

In the `prisma.poolInvite.findUnique` select tree:

```diff
  members: {
-   where: { role: "HOST" },
+   where: { role: { in: ["HOST", "CORPORATE_HOST"] } },
    take: 1,
    select: {
      user: { select: { displayName: true } },
    },
  },
+ organization: {
+   select: {
+     id: true,
+     name: true,
+     logoBase64: true,
+     primaryColor: true,
+     secondaryColor: true,
+     welcomeMessage: true,
+   },
+ },
```

Note: `organization` is a relation on `Pool`, so the `select` lives one level up inside `pool: { select: { …, organization: {…} } }`.

In the response payload:

```diff
  return sendOk(res, {
    poolName: invite.pool.name,
    tournamentName: invite.pool.tournamentInstance?.name || null,
    hostName: invite.pool.members[0]?.user?.displayName || null,
    memberCount: invite.pool._count.members,
    status: invite.pool.status,
    valid: !expired && !maxUsesReached && invite.pool.status !== "ARCHIVED",
+   organization: invite.pool.organization
+     ? {
+         name: invite.pool.organization.name,
+         logoBase64: invite.pool.organization.logoBase64 ?? null,
+         primaryColor: invite.pool.organization.primaryColor ?? null,
+         secondaryColor: invite.pool.organization.secondaryColor ?? null,
+         welcomeMessage: invite.pool.organization.welcomeMessage ?? null,
+       }
+     : null,
  });
```

### 3.3 Acceptance

- [ ] `npx tsc --noEmit` in backend passes.
- [ ] Test against production: pick an existing PoolInvite code for a corporate pool (the `Turcia - Romania` row's `ebecfee65a0a` was the only one found in audit; revive by generating a fresh one for a test corporate pool first). `curl https://api.picks4all.com/invite-preview/<code>` returns `organization: { name, logoBase64, ... }` and `hostName` populated.
- [ ] Same `curl` on a personal pool's code returns `organization: null` and `hostName` intact.

### 3.4 Commit message template

```
fix(invites): include organization branding + CORPORATE_HOST in /invite-preview

Two defects on /invite-preview/:code (the public preview endpoint
the share-link landing fetches) prevented corporate pools from
ever rendering branded:

1. `members.where: { role: "HOST" }` ignored CORPORATE_HOST, so
   corporate pools always returned `hostName: null` and the
   landing showed "te invita alguien".
2. The pool.organization relation was not in the select tree, so
   the response carried no logo/colors/welcomeMessage and the
   landing page had nothing to render.

Now: role filter includes both HOST + CORPORATE_HOST; response
adds an `organization` object (null on personal pools).

Frontend changes in a follow-up commit consume the new payload.

Co-Authored-By: …
```

### 3.5 Status

🟩 DONE — SHA: `824b646` (pushed 2026-05-22)

---

## 4 — Step-by-step: Commit 2 — Backend list + revoke endpoints

**Goal**: host can list existing PoolInvite codes for their pool and revoke any of them; audit payload includes `organizationId`.

### 4.1 Files

- [backend/src/routes/poolInvites.ts](backend/src/routes/poolInvites.ts) — add 2 endpoints + extend 1 audit payload.

### 4.2 Changes

**Add `GET /pools/:poolId/invites`** after the existing `POST /pools/:poolId/invites`:

```ts
// GET /pools/:poolId/invites  (host-only)
poolInvitesRouter.get("/:poolId/invites", async (req, res) => {
  const { poolId } = req.params;
  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return sendForbidden(res, "FORBIDDEN");

  const now = Date.now();
  const rows = await prisma.poolInvite.findMany({
    where: { poolId },
    orderBy: { createdAtUtc: "desc" },
    select: {
      id: true, code: true, maxUses: true, uses: true,
      expiresAtUtc: true, createdAtUtc: true, acceptedByUserId: true,
    },
  });

  const invites = rows.map((r) => ({
    ...r,
    expired: !!(r.expiresAtUtc && r.expiresAtUtc.getTime() < now),
    exhausted: r.maxUses != null && r.uses >= r.maxUses,
  }));

  return sendOk(res, { invites });
});
```

**Add `DELETE /pools/:poolId/invites/:inviteId`**:

```ts
// DELETE /pools/:poolId/invites/:inviteId  (host-only, soft-revoke)
poolInvitesRouter.delete("/:poolId/invites/:inviteId", async (req, res) => {
  const { poolId, inviteId } = req.params;
  const isHostOrCoAdmin = await requirePoolAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) return sendForbidden(res, "FORBIDDEN");

  const invite = await prisma.poolInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.poolId !== poolId) {
    return sendNotFound(res, "NOT_FOUND");
  }

  // Soft-revoke: backdate `expiresAtUtc` so the row + denormalised
  // acceptedByUserId stay queryable, but `/pools/join` rejects with
  // CONFLICT ("Invite expired") on any future redemption attempt.
  const updated = await prisma.poolInvite.update({
    where: { id: inviteId },
    data: { expiresAtUtc: new Date() },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_INVITE_REVOKED",
    entityType: "PoolInvite",
    entityId: invite.id,
    dataJson: { poolId, code: invite.code },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return sendOk(res, { id: updated.id, expiresAtUtc: updated.expiresAtUtc });
});
```

**Extend `POOL_INVITE_CREATED` audit payload** at [poolInvites.ts:73](backend/src/routes/poolInvites.ts#L73):

```diff
  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_INVITE_CREATED",
    entityType: "PoolInvite",
    entityId: invite.id,
-   dataJson: { poolId, code },
+   dataJson: { poolId, code, organizationId: pool.organizationId ?? null },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });
```

### 4.3 Acceptance

- [ ] `npx tsc --noEmit` in backend passes.
- [ ] `curl -X GET … /pools/<poolId>/invites` (with auth) returns array with `expired` + `exhausted` derived flags.
- [ ] `curl -X DELETE … /pools/<poolId>/invites/<inviteId>` returns 200; subsequent `POST /pools/join` with that code returns 409 `CONFLICT { message: "Invite expired" }`.
- [ ] AuditEvent row `POOL_INVITE_REVOKED` written.
- [ ] AuditEvent row for a freshly created invite in a corporate pool has `organizationId` populated.
- [ ] Non-admin user gets 403 on both endpoints.

### 4.4 Commit message template

```
feat(invites): list + revoke endpoints for PoolInvite + organizationId in audit

Adds the two missing host endpoints:

  GET    /pools/:poolId/invites           list codes (with derived
                                           expired/exhausted flags)
  DELETE /pools/:poolId/invites/:inviteId  soft-revoke (sets
                                           expiresAtUtc = now())

Soft-revoke is preferred over hard-delete to preserve
acceptedByUserId denormalisation for already-redeemed codes.
Re-redemption attempts return 409 via the existing
"Invite expired" branch in POST /pools/join.

Also: POOL_INVITE_CREATED audit payload now carries
organizationId so the funnel can split corporate vs personal.

Frontend consumption lands in the next two commits.

Co-Authored-By: …
```

### 4.5 Status

🟩 DONE — SHA: `d7adbca` (pushed 2026-05-22)
**Prod verification (commit 1)**: `curl https://api.picks4all.com/invite-preview/ebecfee65a0a` → `hostName: "John"` (was null pre-fix) and `organization: { name: "FEG", logoBase64: null, primaryColor: null, secondaryColor: null, welcomeMessage: null }` (was absent pre-fix). FEG has no branding configured yet but the shape is correct.

---

## 5 — Step-by-step: Commit 3 — Branded `/invite?code=…` landing

**Goal**: when the previewed pool has `organization`, the public landing page renders the company's logo + colors + welcome message instead of generic Picks4All branding.

### 5.1 Files

- [frontend-next/src/app/[locale]/invite/page.tsx](frontend-next/src/app/[locale]/invite/page.tsx) — extend `InvitePreview` interface + branch render.
- New i18n keys (added to all three locales' `pool.json`):
  - `inviteLanding.companyInvite` ES: "{company} te invita a participar" / EN: "{company} invites you to join" / PT: "{company} te convida para participar"
  - `inviteLanding.poweredBy` ES: "Vía Picks4All" / EN: "Powered by Picks4All" / PT: "Via Picks4All"

### 5.2 Changes

```diff
  interface InvitePreview {
    poolName: string;
    tournamentName: string | null;
    hostName: string | null;
    memberCount: number;
    status: string;
    valid: boolean;
+   organization: {
+     name: string;
+     logoBase64: string | null;
+     primaryColor: string | null;
+     secondaryColor: string | null;
+     welcomeMessage: string | null;
+   } | null;
  }
```

In the success render block:

- When `preview.organization` is non-null, render a corporate variant of the card:
  - Top band: linear-gradient using `primaryColor → secondaryColor` (fallback to `colors.brandGradient` if either is null).
  - Below the band: the org logo (img with `src={preview.organization.logoBase64}`) or a letter-initial fallback.
  - Headline: `t("inviteLanding.companyInvite", { company: preview.organization.name })`.
  - Pool name card: same shape as today, but tinted with `primaryColor + "15"` (~10% alpha) instead of `colors.bgLight`.
  - Welcome message: if present, render in a quoted block (`<p style={{ fontStyle: "italic" }}>"{welcomeMessage}"</p>`) below the pool card.
  - Footer: small "Vía Picks4All" line so the platform brand is acknowledged without competing visually.
- When `preview.organization` is null, render exactly today's behavior (no regression on personal pools).

Use `resolveBrandColors(primaryColor, secondaryColor)` if that helper already exists in the codebase (verify in [frontend-next/src/lib/brand.ts](frontend-next/src/lib/brand.ts)); otherwise inline the fallback.

### 5.3 Acceptance

- [ ] `npx tsc --noEmit` in frontend passes.
- [ ] In incognito, open `/invite?code=<personal-pool-code>` → looks identical to before this commit.
- [ ] In incognito, open `/invite?code=<corporate-pool-code>` (after commit 1 + a freshly-generated corporate code) → company logo + brand colors + welcome message visible, plus "Vía Picks4All" footer.
- [ ] Mobile-width (360-430px) check: layout doesn't overflow, logo scales down sensibly.
- [ ] **Trilingual check** on the corporate landing:
  - ES → `inviteLanding.companyInvite` shows "{company} te invita a participar"
  - EN → "{company} invites you to join"
  - PT → "{company} te convida para participar"
  - The `inviteLanding.poweredBy` footer in each locale ("Vía Picks4All" / "Powered by Picks4All" / "Via Picks4All")
- [ ] **Trilingual check** on the personal-pool path: no regression, same strings as today.

### 5.4 Commit message template

```
feat(invite-landing): render organization branding for corporate pools

When the previewed pool has an Organization (corporate pool), the
public landing page now renders:
  - The org's logo (or letter-initial fallback)
  - A brand-color gradient banner (primaryColor → secondaryColor,
    falling back to Picks4All default if not configured)
  - The org's welcome message in a quoted block
  - "Vía Picks4All" footer

Personal pools render unchanged.

Depends on commit <SHA-of-commit-1> which extends /invite-preview
to expose `organization` in its response.

Co-Authored-By: …
```

### 5.5 Status

🟩 DONE — SHA: `34e8eae` (pushed 2026-05-22)

---

## 6 — Step-by-step: Commit 4 — `PoolInviteCodeManager` + mount + i18n

**Goal**: corporate hosts see a new "Invitar con enlace compartible" section between the email panel and the player roster, with disclaimer + list + create + revoke + share.

### 6.1 Files

- New: `frontend-next/src/components/PoolInviteCodeManager.tsx` (~180 LOC — extra ~40 LOC over the original estimate to accommodate the preset+custom expiry input).
- Modify: [frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx) — mount the new component between `CorporateEmployeeManager` and `MemberManagement`.
- Modify: `frontend-next/src/lib/api/pools.ts` (or new `lib/api/poolInvites.ts`) — typed wrappers `getPoolInvites(token, poolId)` and `deletePoolInvite(token, poolId, inviteId)`.
- Modify: `frontend-next/src/messages/{es,en,pt}/pool.json` — add the keys listed in §2.

### 6.2 PoolInviteCodeManager shape

```tsx
"use client";

// ── Module-level constants (no magic numbers — per CLAUDE.md §2) ──
const EXPIRY_PRESETS_HOURS = [1, 6, 24, 168, 720] as const;
// 1h, 6h, 24h, 7d (168h), 30d (720h). Default selection = 720h (30d)
// matches the existing PoolInvite default in TOKEN_EXPIRY_MS.
const EXPIRY_DEFAULT_HOURS = 720;
const HOURS_PER_DAY = 24;
const EXPIRY_CUSTOM_MIN_HOURS = 1;
const EXPIRY_CUSTOM_MAX_DAYS = 365;
const EXPIRY_CUSTOM_MAX_HOURS = EXPIRY_CUSTOM_MAX_DAYS * HOURS_PER_DAY; // 8760 = 1 year
// Hard cap. A typo (eg. accidentally typing two digits in days) cannot
// create a code with a multi-year horizon.

// Props (declared inline):
//   poolId, token, isMobile, maxParticipants, currentMembers, organizationName

// State:
//   - invites: PoolInviteRow[]              (loaded on mount + after each mutation)
//   - showForm: boolean
//   - formMaxUses: number                    (default = max(1, maxParticipants - currentMembers))
//   - formExpiryMode: "preset" | "custom"    (default "preset")
//   - formExpiryPresetHours: number          (default 720; one of EXPIRY_PRESETS_HOURS)
//   - formExpiryCustomDays: number           (default 30; only used when mode="custom")
//   - formExpiryCustomHours: number          (default 0; only used when mode="custom")
//   - formExpiryError: string | null         (validation error key for the custom block)
//   - busy: string | null
//   - copiedCode: string | null              (transient — clears after 2s)

// ── Derived helpers ──
// effectiveHours():
//   - if mode === "preset": formExpiryPresetHours
//   - else: formExpiryCustomDays * HOURS_PER_DAY + formExpiryCustomHours
//
// validateCustom(): returns null on success, otherwise an i18n key:
//   - "expiresCustomErrorNaN"  if days/hours are not non-negative integers
//   - "expiresCustomErrorMin"  if effectiveHours < EXPIRY_CUSTOM_MIN_HOURS
//   - "expiresCustomErrorMax"  if effectiveHours > EXPIRY_CUSTOM_MAX_HOURS
//
// computeExpiresAtUtc():
//   new Date(Date.now() + effectiveHours() * 3_600_000).toISOString()
//
// previewSummary():
//   t("expiresSummary", { date: formatDate(computeExpiresAtUtc(), locale, tz) })

// Layout (top to bottom):
//   1. Section title + subtitle
//   2. Disclaimer panel (always visible) — 5 bullets from §3, with the
//      "Administración" bullet wrapping a Link to `?tab=admin`
//   3. List of existing codes (empty state if none)
//      Each row: code monospace + uses + expiry + Copiar + Compartir + Revocar
//   4. "Generar enlace nuevo" button → opens inline form
//      Form:
//        - maxUses (numeric input, label + hint)
//        - Expiry block:
//            label: t("formExpires")
//            preset chips row: [1 hora] [6 horas] [24 horas] [1 semana] [30 días] [Personalizado]
//            if "Personalizado" selected → two numeric inputs side-by-side:
//                  [Días] [____]   [Horas] [____]
//                + range hint t("expiresCustomHint")
//                + validation error slot
//            live summary below the chips: t("expiresSummary", { date }) — recomputed
//              every render so the host sees the exact resulting expiry
//        - hint paragraph: t("formExpiresHint")
//        - [Crear enlace] [Cancelar]

// On submit:
//   1. If mode === "custom": run validateCustom(). On error set
//      formExpiryError to the i18n key and abort.
//   2. POST /pools/:poolId/invites { maxUses, expiresAtUtc: computeExpiresAtUtc() }
//   3. On success: refresh list, close form, reset state (preset mode, 720h default).
// On revoke: confirm dialog → DELETE /pools/:poolId/invites/:id → refresh list.
// On copy: navigator.clipboard.writeText(`${origin}/invite?code=${code}`) +
//          setCopiedCode(code) + setTimeout(() => setCopiedCode(null), 2000).
// On share: reuse <ShareButtons context="poolInvite" url=... data={…} />.
```

**Why preset chips instead of a calendar picker**: the host's use case is "envío al grupo de WhatsApp y quiero que expire en 2 horas", not "expire exactly on 15 de julio a las 3pm". A calendar picker forces mental arithmetic; chips read the room. "Personalizado" is the escape hatch.

**Why TWO inputs (days + hours) for the custom mode, not a single hours input**: a single "horas" field forces the host to do math for anything beyond a day or two ("96 horas" → wait, is that 4 days?). Days+hours mirrors how humans actually think about windows ("4 días y 0 horas" is read at a glance). The component still serializes to a single hours number for `effectiveHours` and the cap check.

**Why hard-cap 365 days (8760 hours)**: a single-digit typo in days ("3650" instead of "365") would otherwise create a 10-year code that practically never expires. Capping at 1 year covers every realistic team-onboarding horizon and keeps the legal range narrow enough that a typo can't blow past it without the user noticing.

**Why default days=30, hours=0 when entering custom mode**: matches the "30 días" preset, so flipping into custom and back is a no-op. Avoids the surprise of zero-initializing to "0 días 0 horas" and then seeing the "Debe ser al menos 1 hora" error before the host has touched anything.

Use the existing visual language from `CorporateEmployeeManager`: purple-tinted container (`#ede9fe → #e0e7ff` gradient bg, `#a78bfa` border), section heading style, etc. — so it visually belongs alongside the email panel.

### 6.3 PoolPlayersTab mount change

```diff
  return (
    <div style={…}>
      {overview.permissions.canManageResults && (
        <PendingJoinRequests … />
      )}

      {isCorporate && (
        <CorporateEmployeeManager
          poolId={poolId} token={token} isMobile={isMobile}
          maxParticipants={overview.pool.maxParticipants ?? undefined}
          currentMembers={overview.counts.membersActive}
        />
      )}

+     {isCorporate && (
+       <PoolInviteCodeManager
+         poolId={poolId}
+         token={token}
+         isMobile={isMobile}
+         maxParticipants={overview.pool.maxParticipants ?? undefined}
+         currentMembers={overview.counts.membersActive}
+         organizationName={overview.pool.organization?.name ?? ""}
+       />
+     )}

      <MemberManagement … />
      …
```

### 6.4 Acceptance

- [ ] `npx tsc --noEmit` in frontend passes.
- [ ] On a test corporate pool's Jugadores tab as CORPORATE_HOST: see the new section between Gestión de Empleados and Gestión de Jugadores.
- [ ] Disclaimer visible with 5 bullets and `{current}/{max}` interpolation working.
- [ ] "Generar enlace nuevo" → form opens with defaults pre-filled → submit → new code appears in list.
- [ ] "Copiar enlace" → URL on clipboard (verify), button shows "Copiado ✓" for 2s.
- [ ] "Revocar" → confirm dialog → row disappears (or shows "Expirado") → backend has `POOL_INVITE_REVOKED` audit row.
- [ ] Test in incognito: redeem the freshly-created code with a different account → joiner appears in `MemberManagement` below.
- [ ] In a personal pool: section does NOT appear (mount is gated by `isCorporate`).
- [ ] **Trilingual check** (per the guarantee at the top of this doc):
  - ES (default, no prefix): disclaimer reads "ocupa un cupo", last bullet "Recomendamos invitar por correo"; preset chips render "1 hora / 6 horas / 24 horas / 1 semana / 30 días / Personalizado"; custom mode shows "Días" + "Horas" inputs.
  - EN (`/en/`): same flow translated; date in `expiresSummary` formats `en-US` style.
  - PT (`/pt/`): same flow translated; date in `expiresSummary` formats `pt-BR` style.
  - Switch locale via the language picker → no Spanish text leaks into EN/PT renders, no missing-translation `keyName` fallbacks visible.
- [ ] Mobile width (360-430px): no horizontal scroll, buttons are tap-target ≥44px, preset chips wrap onto two rows on narrow screens without clipping.

### 6.5 Commit message template

```
feat(corporate): code/link invites in the Jugadores tab

Corporate hosts can now share an invite link in addition to the
existing email-bound invite path. The new PoolInviteCodeManager
component lives in the Jugadores tab between the email panel and
the player roster, and exposes:

  - Disclaimer (5 bullets) calling out the trade-off vs. email
    invites (link forwarding, capacity impact, manual-approval
    recommendation, revocation semantics)
  - List of active codes with copy / share / revoke per row
  - Inline form to generate a new code with sensible defaults
    (maxUses = remaining capacity, expiry = +30d)

The component is gated by isCorporate; personal pools are
unchanged. Uses the existing POST /pools/:poolId/invites and the
new GET/DELETE endpoints from <commit-2-SHA>.

Co-Authored-By: …
```

### 6.6 Status

🟩 DONE — SHA: `b64f06d` (pushed 2026-05-22)
**Paridad i18n verificada**: `node -e "JSON.parse(...).admin.codeInvites"` en ES/EN/PT → 46 keys idénticas en las 3 catalogs. Sin `defaultMessage` fallbacks.

---

## 7 — Step-by-step: Commit 5 — Docs

**Goal**: codify the work in the canonical doc set + memory so future-Claude and future-human can navigate it.

### 7.1 Files

- New: `docs/DECISION_LOG.md` entry **ADR-061: Corporate Pool Code/Link Invites**.
- Modify: `docs/BUSINESS_RULES.md` — corporate-invite section gains a "code/link" subsection summarising the disclaimer-backed safety model.
- Modify: `CLAUDE.md` §6 (Critical Invariants) — add: "Corporate code-invite revocation is soft (`expiresAtUtc = now()`); never hard-delete `PoolInvite` rows."
- Modify: `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — under Corporate System, append a one-line entry pointing to the audit + implementation docs.

### 7.2 Acceptance

- [ ] ADR-061 written with: context, decision, consequences, links to commits 1-4.
- [ ] BUSINESS_RULES.md mentions both invite paths (email-bound + link) with the disclaimer's safety model.
- [ ] CLAUDE.md invariant added.
- [ ] MEMORY.md entry added.

### 7.3 Status

🟥 PENDING — SHA: —

---

## 8 — Pre-flight checklist before commit 1

- [x] Audit doc reviewed by user (`CORPORATE_INVITES_AUDIT.md`).
- [x] Plan §6 decisions locked (location, disclaimer, soft-revoke, hint).
- [x] Implementation doc created (this file).
- [ ] User confirms disclaimer copy (§3 in this doc).
- [ ] User confirms i18n key naming (§2 in this doc).
- [ ] User says "go" to commit 1.

---

## 9 — Post-flight verification (after commit 4 lands)

Run against production:

- [ ] Pick a real corporate pool (one of the 18 in audit §5). Confirm Jugadores tab now shows the new section.
- [ ] Generate a code → open the share URL in incognito → company branding visible.
- [ ] Redeem with a fresh test account → joiner appears in MemberManagement.
- [ ] Revoke the code → re-attempt redemption → 409 CONFLICT.
- [ ] Email-invite flow still works end-to-end on the same pool (no regression).
- [ ] `POOL_INVITE_CREATED` audit row has `organizationId`.
- [ ] Production logs free of new errors for 24h after deploy.
- [ ] **Final trilingual sweep**: log into the test corporate pool in `es`, `en`, and `pt` (via the language picker). For each: open Jugadores tab, generate a code, copy link, open it in incognito on the same locale, verify the disclaimer + chips + custom days/hours inputs + landing all render natively without language leakage.

---

## 10 — Rollback plan

Each commit compiles + deploys independently. Rollback by reverting commits in reverse order:

- Revert commit 4 → corporate hosts lose the new UI, backend endpoints remain (harmless).
- Revert commit 3 → corporate landing reverts to generic Picks4All branding.
- Revert commit 2 → `GET/DELETE /pools/:poolId/invites` endpoints disappear (the new UI in commit 4 would fail, but commit 4 is already reverted by this point).
- Revert commit 1 → `/invite-preview` returns the pre-change payload; corporate landing is no longer branded (the frontend in commit 3 handles `organization: null` as the personal case, so this is graceful).

No DB state to roll back. No env vars to unset.
