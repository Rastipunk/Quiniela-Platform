# Corporate Pool Invitations — Code-Verified Audit & Plan

> **Status:** awaiting plan approval
> **Last updated:** 2026-05-22 (rewrite — first version contained an unverified claim)
> **Trigger:** the second real corporate purchase asked to enable code/link invites alongside the per-email flow.
> **Method:** every claim cites file:line, verified by reading source. The production-DB findings are at the end (§5).
>
> ## Correction from earlier doc
>
> The earlier version of this audit claimed: *"The '+ Invitar más' button on the pool page already appears for corporate hosts today — they just haven't been pointed at it."* That is **false**. I verified the page source: the button is inside `{!overview.pool.organization && (...)}` at [page.tsx:684](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L684), so it is **explicitly hidden** for any pool tied to an Organization. The screenshot the user shared confirms this — the corporate pool header has no invite affordance.

---

## 1 — Frontend reality on a corporate pool page

### 1.1 Two parallel headers in `page.tsx`

`page.tsx` renders one of two headers depending on `overview.pool.organization`:

| Block | Lines | Renders when | Has "+ Invitar más" button? |
|---|---|---|---|
| Corporate header (org logo + brand band + pool name) | [642-680](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L642) | `overview.pool.organization` is truthy | **No** |
| Standard header (pool name + invite button) | [684-726](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L684) | `!overview.pool.organization` | **Yes**, gated by `permissions.canInvite` |

The "Invite code + ShareButtons" display block at [page.tsx:733](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L733) is shared (`{inviteCode && overview.permissions.canInvite && ...}`), but because the corporate header never calls `onCreateInvite()`, the `inviteCode` state is always null on a corporate pool and the block never appears.

### 1.2 Sidebar items (PoolNav.tsx) — same for both

[PoolNav.tsx:60-80](frontend-next/src/components/pool/PoolNav.tsx#L60):

```ts
const PLAYER_ITEMS = [partidos, leaderboard, resumen, reglas];
const HOST_ITEMS   = [jugadores, capacidad, admin];
const BRANDING_ITEM = { key: "personalizacion", ... };
```

`HOST_ITEMS` renders identically for personal HOST / personal CO_ADMIN / corporate CORPORATE_HOST. Only `BRANDING_ITEM` ("Personalización") is corporate-only via `showBrandingTab` ([PoolNav.tsx:120-124](frontend-next/src/components/pool/PoolNav.tsx#L120)). So the "Jugadores" sidebar entry is already there for corporate hosts.

### 1.3 What the "Jugadores" tab renders today

[PoolPlayersTab.tsx:44-84](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx#L44):

```tsx
const isCorporate = !!overview.pool.organizationId;

return (
  <div>
    {canManageResults && <PendingJoinRequests … />}
    {isCorporate && <CorporateEmployeeManager … />}
    <MemberManagement … />
    {expulsionModalData && <ExpulsionModal … />}
  </div>
);
```

`CorporateEmployeeManager` (891 LOC at [components/CorporateEmployeeManager.tsx](frontend-next/src/components/CorporateEmployeeManager.tsx)) is the entire email-invite UI — Step 1 "Agregar a la lista" (paste/CSV/Excel), Step 2 "Enviar", paginated list with resend/delete, expiry filter, etc. It has **zero** UI for invite codes / share links.

### 1.4 `/invite?code=…` landing page

[app/[locale]/invite/page.tsx](frontend-next/src/app/[locale]/invite/page.tsx) renders the public preview. It calls `/invite-preview/:code`, displays pool name + tournament + host name + member count, then a CTA "Unirme ahora" (logged-in) or "Iniciar sesión" (logged-out). Branding is always Picks4All default (`BRAND.primary`, `colors.brandGradient`) — no organization branding even when the underlying pool is corporate.

---

## 2 — Backend reality

### 2.1 Permissions

[backend/src/lib/roles.ts:9-13](backend/src/lib/roles.ts#L9):

```ts
export const POOL_ADMIN_ROLES = [HOST, CO_ADMIN, CORPORATE_HOST];
export function isPoolAdmin(role) { return POOL_ADMIN_ROLES.includes(role); }
```

[poolOverviewService.ts:588](backend/src/services/poolOverviewService.ts#L588): `canInvite: isPoolAdmin(myMembership.role)` — `true` for CORPORATE_HOST.

### 2.2 `POST /pools/:poolId/invites` — code creation

[poolInvites.ts:29-79](backend/src/routes/poolInvites.ts#L29). Auth check is `requirePoolAdmin` only. **No organization branch**. Body: `{ maxUses?: 1-500, expiresAtUtc?: ISO }`. Generates 12-hex code via `crypto.randomBytes(6).toString("hex")`, default expiry 30 days. Writes `POOL_INVITE_CREATED` audit. → Returns the invite.

A corporate host calling this endpoint today (e.g. via curl or via the page-level button if it were rendered) **gets a code created successfully**. Verified in §5.

### 2.3 `POST /pools/join` — code redemption

[poolInvites.ts:160-405](backend/src/routes/poolInvites.ts#L160). No organization branch anywhere. Sequence:

1. Rate limit (10/15min/IP) via `poolJoinLimiter`.
2. Code lookup → exists, not expired, `uses < maxUses`.
3. `canJoinPool(pool.status)` — DRAFT or ACTIVE accept joins.
4. BANNED guard.
5. `ensurePoolCapacity(tx, poolId, max)` — `SELECT ... FOR UPDATE` on Pool row.
6. Initial status: `pool.requireApproval ? PENDING_APPROVAL : ACTIVE`.
7. Create PoolMember with `role: "PLAYER"`. Atomic increment `uses` (conditional WHERE).
8. Audit `JOIN_REQUEST_SUBMITTED` or `POOL_JOINED`.
9. If ACTIVE and pool was DRAFT → `transitionToActive()`.
10. Capacity-threshold notification.

A user redeeming a code on a corporate pool joins as a regular `PLAYER` member. There is no link to any `CorporateInvite` row.

### 2.4 `GET /invite-preview/:code` (public)

[server.ts:88-138](backend/src/server.ts#L88). Returns `{ poolName, tournamentName, hostName, memberCount, status, valid }`.

**Two real defects found while reading this**:

- **Defect A**: the `members` sub-query uses `where: { role: "HOST" }` at [server.ts:109](backend/src/server.ts#L109). `CORPORATE_HOST` is not matched, so `hostName` is always `null` for corporate pools.
- **Defect B**: response does not include the Organization at all (logo, colors, welcome message). The landing page therefore can't render corporate branding even if it wanted to.

### 2.5 Endpoints that DO NOT exist

Confirmed by grep (`poolInvitesRouter.(get|delete|put|patch)` in poolInvites.ts):

- **No** `GET /pools/:poolId/invites` (list existing codes for a pool)
- **No** `DELETE /pools/:poolId/invites/:id` (revoke a code)
- **No** code expiry/revocation flow at all — once issued, a code lives until `expiresAtUtc` or `maxUses`.

### 2.6 `overview.pool.organization` is already on the wire

[poolOverviewService.ts:557-567](backend/src/services/poolOverviewService.ts#L557) serializes `organization` with `{ id, name, logoBase64, welcomeMessage, invitationMessage, primaryColor, secondaryColor }`. So the frontend pool page already has everything it needs to render branded UI; it just doesn't.

---

## 3 — Personal code/link system (control)

Same model `PoolInvite` ([schema.prisma:512-539](backend/prisma/schema.prisma#L512)) — used identically by both personal and corporate. Differences in surfacing only:

| | Personal pool | Corporate pool |
|---|---|---|
| Backend `POST /pools/:poolId/invites` | accessible | accessible |
| Backend `POST /pools/join` | works | works (verified in prod, see §5) |
| Frontend invite button on pool page header | rendered ([page.tsx:702](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L702)) | **hidden** by `{!overview.pool.organization}` guard ([page.tsx:684](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L684)) |
| Frontend display of code + ShareButtons | renders after click ([page.tsx:733](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx#L733)) | dead code path — `inviteCode` state never populated |
| Jugadores tab | renders `MemberManagement` only | renders `CorporateEmployeeManager` + `MemberManagement` |
| `/invite?code=…` landing | Picks4All branding | also Picks4All branding (Defect B) |
| Hostname shown on preview | filled from HOST | always null (Defect A) |

---

## 4 — Production-DB findings

Script: `_audit-corporate-invites.ts`. Date: 2026-05-22.

- **18 corporate pools exist** (I had previously assumed 2). Most DRAFT, four ACTIVE. Max capacity ranges 1–100.
- **One corporate pool already has a PoolInvite code**: `Turcia - Romania` (org FEG) has a single expired code `ebecfee65a0a` (expired 2026-04-25). Someone created a code for a corporate pool — most likely via the API directly, since the UI doesn't expose it. **The path works end-to-end at the backend level.**
- **`requireApproval` is mixed** across corporate pools: 10 have it `false`, 8 have it `true`. There is no business rule forcing one or the other for corporate pools.
- **Two ACTIVE corporate pools have corporate email-invite activity**:
  - `Polla Sofychu` (Sofychu Talent): 2 members, 1 ACTIVATED email invite, max=2 (full).
  - `Quiniela Ariza mundial 2026` (Ariza): 3 members, 2 ACTIVATED + 3 SENT email invites, max=2 (over-cap — pre-existing data anomaly, unrelated to this work).
  - `APL Guatemala` (APL Logistics): 2 members, 1 ACTIVATED email invite, max=2.
- **One DRAFT corporate pool has 10 SENT email invites**: `Quiniela Acme - Mundial 2026` (Acme Corporation), max=100. This is presumably the "second real corporate purchase" the user mentioned, or close to it.

---

## 5 — Plan

### 5.1 Goal

Corporate hosts can issue + share a code/link from the corporate pool UI, the recipient sees a properly-branded landing page, and existing email-invite flow stays untouched.

### 5.2 Concrete change list

Each item gives file path + estimated LOC. No "options A/B" — straight implementation.

**Backend (3 files, ~80 LOC):**

1. [server.ts:88-138](backend/src/server.ts#L88) — `/invite-preview/:code`:
   - Fix Defect A: `members.where: { role: { in: ["HOST", "CORPORATE_HOST"] } }`.
   - Fix Defect B: include `pool.organization: { select: { name, logoBase64, primaryColor, secondaryColor, welcomeMessage } }`. Add `organization` field to the response when set, otherwise null.
   - ~15 LOC.

2. [poolInvites.ts](backend/src/routes/poolInvites.ts) — add two endpoints:
   - `GET /pools/:poolId/invites` (host-only) — list existing PoolInvite codes for the pool with derived `expired` and `exhausted` flags. ~30 LOC.
   - `DELETE /pools/:poolId/invites/:inviteId` (host-only) — soft-revoke by setting `expiresAtUtc = now()` (avoids destroying audit trail and avoids the `acceptedByUserId` FK headache). Writes `POOL_INVITE_REVOKED` audit. ~25 LOC.

3. [poolInvites.ts](backend/src/routes/poolInvites.ts) — `POOL_INVITE_CREATED` audit payload at [line 73](backend/src/routes/poolInvites.ts#L73) — extend `dataJson` to include `organizationId` when present. ~3 LOC.

4. New frontend lib `lib/api/poolInvites.ts` (or extend `lib/api/pools.ts`) — typed wrappers for `getPoolInvites`, `deletePoolInvite`. ~20 LOC.

**Frontend (3 files, ~180 LOC + i18n):**

5. New component `components/PoolInviteCodeManager.tsx` (~140 LOC). Mounted from `PoolPlayersTab.tsx` for corporate pools, **between** `CorporateEmployeeManager` (above) and `MemberManagement` (below). Shows:
   - "Invitar con enlace compartible" title.
   - **Disclaimer panel** (4-bullet warning, see §6 #2) — always visible, not collapsible.
   - List of active codes (uses/max, expiry, copy-link button, revoke button).
   - "Generar enlace nuevo" button → opens a small form with `maxUses` (default = `pool.maxParticipants - currentMembers`), `expiresAtUtc` (default +30d). POSTs to existing `POST /pools/:poolId/invites`.
   - On code creation, renders `<ShareButtons>` with the WhatsApp/X/copy options that already exist.

6. [PoolPlayersTab.tsx](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolPlayersTab.tsx) — mount `<PoolInviteCodeManager />` for corporate pools, between `<CorporateEmployeeManager />` and `<MemberManagement />`. ~10 LOC.

7. [app/[locale]/invite/page.tsx](frontend-next/src/app/[locale]/invite/page.tsx) — when `preview.organization` is non-null:
   - Replace the `BRAND.primary` band with the organization's gradient (`primaryColor → secondaryColor` with fallback to brand default).
   - Show the organization's logo above the pool name.
   - Render `welcomeMessage` (already HTML-escaped at persistence per ADR-047) when present.
   - ~50 LOC.

8. i18n keys in `messages/{es,en,pt}/pool.json` for the new strings (PoolInviteCodeManager title/subtitle/labels, revoke confirmation, etc.). ~30 keys × 3 locales.

**Out of scope (intentional):**

- No change to `Pool.requireApproval`. The corporate host decides per-pool via the existing pool admin UI; we don't override their choice.
- No new audit event types — extend existing payloads only.
- No mobile-specific share-sheet work — `ShareButtons` already handles WhatsApp/X/clipboard.
- No code rotation on revoke — once revoked, a code stays expired; the host generates a fresh one if needed.
- No backend rate-limit change.
- No SSO / domain enforcement.

### 5.3 Risk + mitigation

| Risk | Mitigation |
|---|---|
| Link leaks beyond the company | Host can set `maxUses = remaining slots` + short expiry; can revoke any time; can keep `requireApproval=true` to gate each joiner |
| Code-joined members confused with email-invited employees | They appear in `MemberManagement` (the existing roster) with `role: PLAYER`. Email invitees appear in `CorporateEmployeeManager` (the existing employees panel). The two panels are stacked in the same tab, both visible at once — no merging needed in v1 |
| `/invite-preview` `hostName` was always null for corporate (Defect A) | Fixed in change #1 |
| Capacity race | Already covered by `ensurePoolCapacity` `SELECT ... FOR UPDATE` |
| Revocation breaks history of past joiners | Soft-revoke (set `expiresAtUtc = now()`) preserves the `PoolInvite` row + its `acceptedByUserId` link; no FK cascades |

### 5.4 Estimated total

- ~80 LOC backend (3 endpoints touched, 1 audit field, no schema change, no migration)
- ~240 LOC frontend (1 new ~180 LOC component with preset+custom expiry input, ~10 LOC mount, ~50 LOC branded landing)
- ~40 i18n keys × 3 locales (extra ~10 keys for the expiry preset chips + custom-hours validation)
- 0 DB migrations
- 0 environment variable changes

Implementation as 4 atomic commits (each compiles + deploys):

1. Backend: fix `/invite-preview` Defects A + B (`hostName` null + organization).
2. Backend: add `GET /pools/:poolId/invites` + `DELETE /pools/:poolId/invites/:id` + audit payload extension.
3. Frontend: branded `/invite?code=…` landing page.
4. Frontend: `PoolInviteCodeManager` component + mount in `PoolPlayersTab` + i18n.

### 5.5 Verification checklist

- [ ] In a fresh-tab incognito, open `/invite?code=<corporate-pool-code>` → see company logo + brand colors, real host name (not "alguien").
- [ ] As CORPORATE_HOST on a corporate pool, navigate to Jugadores → see "Invitar con enlace" section.
- [ ] Generate a new code, copy link, paste in incognito, redeem with a fresh account → joiner appears in `MemberManagement` (and lands in `PENDING_APPROVAL` if the pool had `requireApproval=true`).
- [ ] Revoke a code → subsequent `POST /pools/join` returns 409 CONFLICT "Invite expired".
- [ ] The existing email-invite path (CorporateEmployeeManager) still works end-to-end with no regression.
- [ ] All three locales: ES/EN/PT keys present, no missing-translation fallbacks visible.

---

## 6 — Decisions locked

Resolved 2026-05-22 in chat:

1. **Location**: inside the Jugadores tab. Specifically **between** `CorporateEmployeeManager` (top) and `MemberManagement` (bottom), separating the two member-acquisition paths with the new "Invitar con enlace" section in the middle. The Jugadores tab thus reads top-down as: (i) Empleados por correo, (ii) Enlace compartible, (iii) Roster de jugadores.
2. **Disclaimer is mandatory inside the code-invite section.** The host needs to see, before generating any link, that:
   - Anyone with the link can join — including non-employees if forwarded.
   - Every joiner **takes a slot** from the pool's capacity (`maxParticipants`).
   - Recommended: enable `requireApproval` in Administración so each joiner needs explicit host approval.
   - The link can be revoked; already-joined members stay (use Expulsar to remove them).
   - **Email invites (above) are the recommended method** — more controlled, each invitation bound to a specific person.
   - Code lifetime is **host-chosen in hours** via preset chips (1h / 6h / 24h / 1 week / 30 days) + a "Personalizado" numeric input (1–8760 hours / 1 year). Not a calendar picker — the use cases are time-windowed shares (WhatsApp group blast, town-hall announcement, etc.).
3. **Soft-revoke** (`expiresAtUtc = now()`) for revocation — preserves `acceptedByUserId` denormalization.
4. **Hint about `requireApproval`** is rendered as part of the disclaimer (point 2 above), not a separate nudge.

The actionable step-by-step is tracked in `CORPORATE_INVITES_IMPLEMENTATION.md`.
