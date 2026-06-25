# Persistent Sessions ("Mantener sesión iniciada") — Plan (ADR-081)

**Goal.** Stop logging users out every 4h. Add an opt-in, per-device persistent
session with **silent refresh**, an **active-sessions panel** in the profile
(below "Notificaciones por e-mail"), per-device revoke, "log out everywhere
else", and **immediate revocation** (a revoked device is rejected on its very
next request, not after its access token lapses).

**Owner decisions (confirmed 2026-06-25):**
- Panel lives in the profile, directly **below `EmailPreferencesSection`**.
- **Immediate** revocation (sessionId embedded in the access JWT; `requireAuth`
  validates the session).
- Clean, no-assumptions implementation; **the UX of users who don't opt in must
  not change**, and **no one is logged out by the deploy**.

---

## 1. Current state (verified in code, no assumptions)

| Piece | File | Behaviour |
|------|------|-----------|
| Access token | `backend/src/lib/jwt.ts:15` | JWT HS256, **fixed `expiresIn: "4h"`**. Payload `{userId, platformRole}`. |
| Cookies | `backend/src/lib/authCookies.ts` | `p4a_token` (httpOnly, **maxAge 4h**), `p4a_logged_in` (non-httpOnly UI hint, 4h), `p4a_admin`, `NEXT_LOCALE`. `secure` in prod, `sameSite=lax`, `domain=.picks4all.com`, `path=/`. |
| Verify | `backend/src/middleware/requireAuth.ts` | Reads cookie → Bearer fallback → `verifyToken` → `user.findUnique` → `status==='ACTIVE'` → `req.auth={userId,platformRole}`. 401 reasons incl. `TOKEN_EXPIRED`. **Does NOT consult any session store.** |
| Issuance | `backend/src/routes/auth.ts` | **4 sites**: register (148), login (165), google (208), activate-corporate (284). Each `signToken` + `setAuthCookies({isAdmin, locale})`. `loginSchema={email,password}`. |
| Logout | `backend/src/routes/auth.ts:307` | `clearAuthCookies(res)` only — **no server-side revocation**. |
| FE token | `frontend-next/src/lib/auth.ts` | `getToken()` returns the `p4a_logged_in` hint (real JWT is httpOnly, JS can't read it). cross-tab logout broadcast; `markSessionExpired`. |
| FE client | `frontend-next/src/lib/api/client.ts` | `requestJson`, `credentials:"include"`, on **401** → `clearToken()` + `markSessionExpired()`. |
| FE login API | `frontend-next/src/lib/api/auth.ts:19` | `login(email,password)` → `POST /auth/login`. |
| Profile panel slot | `frontend-next/src/app/[locale]/(authenticated)/profile/page.tsx:612` | `<EmailPreferencesSection />` is the **last block** before `</div>` → new panel goes right after. |
| User model | `backend/prisma/schema.prisma:28` | `model User` — add `sessions Session[]` relation. |

**Root cause:** JWT + cookies hard-expire at 4h with **no refresh, no
remember-me, no session store**. Anyone returning >4h later re-logs in.

---

## 2. Target design

**Every login creates a `Session` row and embeds its `sessionId` in the access
JWT.** This is what makes revocation immediate and powers the panel.

- **Access token:** JWT, stays **4h**, now `{userId, platformRole, sessionId}`.
- **Persistent (opt-in "remember me"):** `Session.expiresAtUtc = +SESSION_PERSISTENT_DAYS` (default 90), a **refresh cookie** (`p4a_refresh`, httpOnly, `path=/auth/refresh`, long maxAge) holds an opaque token stored **hashed** in `Session.refreshTokenHash`. `p4a_logged_in` gets the long maxAge too (so the UI hint survives across days).
- **Non-persistent (opt-out):** `Session.expiresAtUtc = +4h`, **no** refresh cookie, `p4a_logged_in` 4h → behaves exactly like today (logs out at 4h).
- **Silent refresh:** `POST /auth/refresh` validates the refresh cookie → finds the Session (not revoked/expired) → user ACTIVE → issues a new access JWT (same `sessionId`) + **rotates** the refresh token (new hash, sliding `expiresAt`). The frontend calls it transparently on a 401-expired and retries the original request.
- **Immediate revocation:** `requireAuth`, when the JWT carries `sessionId`, loads the Session **with** the user in **one** query and rejects if the session is missing/revoked/expired. Revoking a device (panel, logout, or "log out others") therefore blocks its next request — no ≤4h window.

### Session model (Prisma — additive)
```prisma
model Session {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String?   @unique   // sha256 of the opaque refresh token; null for non-persistent
  persistent       Boolean   @default(false)
  userAgent        String?               // device label for the panel (best-effort)
  ipAddress        String?
  createdAtUtc     DateTime  @default(now())
  lastUsedAtUtc    DateTime  @default(now())
  expiresAtUtc     DateTime
  revokedAtUtc     DateTime?
  @@index([userId])
}
```
`User` gains `sessions Session[]`.

### requireAuth (combined single query, backward-compatible)
- `payload.sessionId` present → `session.findUnique({where:{id}, include:{user:true}})`; reject if `!session || revokedAtUtc || expiresAtUtc<now`; `user=session.user`; set `req.auth.sessionId`. Touch `lastUsedAtUtc` (throttled / fire-and-forget).
- `payload.sessionId` absent (legacy token issued before deploy) → today's `user.findUnique` path. **This is the no-logout-on-deploy guarantee** — old 4h tokens keep working until they expire, then re-login mints session-backed tokens.

### Endpoints
- `POST /auth/refresh` — rotate + new access token. 401 on any failure.
- `GET /auth/sessions` — list the user's live sessions (id, parsed device, ip, createdAt, lastUsedAt, `current` = matches `req.auth.sessionId`).
- `DELETE /auth/sessions/:id` — revoke one (must belong to caller).
- `POST /auth/sessions/revoke-others` — revoke all of the caller's sessions **except** the current device ("cerrar sesión en los demás dispositivos").
- `POST /auth/logout` — now also revokes the **current** Session + clears the refresh cookie.

---

## 3. UX-safety guarantees (must all hold)
1. **Deploy logs out no one:** legacy tokens (no `sessionId`) validate via the user path until their 4h expiry. ✅
2. **Opt-out = unchanged:** no "remember me" → 4h access token, no refresh, logs out at 4h, exactly like today. ✅
3. **Silent refresh:** opted-in users never see a re-login while the refresh token is valid — the 401 is caught and retried once. ✅
4. **No perf regression:** `requireAuth` already did 1 query (user); the session path is **1 query** (`include: user`), legacy path unchanged. ✅
5. **Security:** access token short (4h); refresh token opaque, hashed at rest, httpOnly, path-scoped, rotated each use; revocation immediate; `user.status` re-checked every request (already true).

---

## 4. Phased implementation (track here — check off as we go)

### Phase 1 — Schema + migration ✅ (2026-06-25)
- [x] Add `Session` model + `User.sessions` relation to `schema.prisma`.
- [x] Create migration `20260625_add_session` (additive; DDL verified vs `prisma migrate diff`).
- [x] `prisma generate`; `tsc` clean (backend).

### Phase 2 — Backend core ✅ (tsc clean)
- [x] `lib/jwt.ts`: `AuthTokenPayload.sessionId?`.
- [x] `lib/authCookies.ts`: `p4a_refresh` set/clear/get (path `/auth/refresh`); `persistent` → long maxAge on `p4a_token`+`p4a_logged_in`; clears refresh on logout.
- [x] `services/sessionService.ts` (NEW): create/rotate(atomic+sliding)/revoke/revokeOthers/list/touch; refresh token generate + sha256.
- [x] `lib/constants.ts`: `SESSION` (PERSISTENT_DAYS 90, ACCESS_TTL_HOURS 4).

### Phase 3 — requireAuth ✅ (tsc clean)
- [x] `resolveAuthenticatedUser`: sessionId → session+user in ONE query, reject revoked/expired (immediate); legacy fallback; `req.auth.sessionId`; throttled `touchSession`. `optionalAuth` mirrors.

### Phase 4 — Auth routes ✅ (tsc clean; jwt+authService.security tests green)
- [x] `establishSession(res, user, {persistent, ctx})` at all 4 issuance sites.
- [x] `loginSchema.rememberMe` (default true); register/google/activate persistent true.
- [x] `POST /auth/refresh` (rotate + reissue), `GET /auth/sessions`, `POST /auth/sessions/revoke-others`, `DELETE /auth/sessions/:id`.
- [x] `logout` (optionalAuth) revokes current session + clears refresh cookie.

### Phase 5 — Frontend API ✅ (tsc clean)
- [x] `lib/api/auth.ts`: `login(email,password,rememberMe=true)`; `getSessions/revokeSession/revokeOtherSessions` + `ActiveSession` type.
- [x] `lib/api/client.ts`: 401 → shared single `/auth/refresh` → retry once; auth-flow paths excluded (no loops); refresh failure → existing clearToken+markSessionExpired.

### Phase 6 — Frontend UI ✅ (tsc clean, JSON valid)
- [x] "Mantener sesión abierta en este dispositivo" checkbox in `AuthSlidePanel` (login mode, default checked).
- [x] `SessionsPanel` rendered in `profile/page.tsx` after `<EmailPreferencesSection />`: device list (UA-parsed), "este dispositivo", per-device revoke, "cerrar sesión en los demás dispositivos".
- [x] i18n `auth.json` (`rememberMe`) + `profile.json` (`sessions.*`) ES/EN/PT.

### Phase 7 — Tests + docs ✅
- [x] Unit: `sessionService` crypto (generate/​hash) + `jwt` green; full backend suite = no NEW failures (same 19 pre-existing).
- [x] ADR-081 in CHANGELOG.
- [ ] Manual E2E in prod (Phase 8): remember-me → silent refresh; panel revoke → immediate kick; opt-out → 4h unchanged.

### Phase 8 — Deploy (pending owner go)
- [ ] Commit + push (auth change for everyone + DB migration → explicit go).
- [ ] Migration runs on deploy; `SESSION_PERSISTENT_DAYS` default 90 (no env needed).
- [ ] Verify `/health` SHA; prod smoke-test: login w/ checkbox, panel renders, revoke works.

---

## 5. Edge cases & risks
- **Refresh reuse / theft:** rotation invalidates the old refresh; presenting an already-rotated token → treat as compromised → revoke the session (hardening; v1 at least rejects it).
- **Concurrent refreshes (two tabs):** rotation must be atomic (`updateMany WHERE refreshTokenHash=old` → exactly one wins); the loser retries with the new cookie or re-logs in. Document the small race.
- **Logout cross-tab:** existing `p4a_auth_logout_tick` broadcast still fires; server-side revocation is the new authority.
- **Clock skew / expiry:** compare against server `now`; refresh sliding window capped at `PERSISTENT_DAYS` from creation (no infinite extension) — decision: sliding but absolute-cap.
- **Banned/deleted user:** `user.status` re-checked each request (already) → immediate lockout regardless of session.

## 6. Files
Backend: `prisma/schema.prisma`, `prisma/migrations/*`, `lib/jwt.ts`,
`lib/authCookies.ts`, `lib/constants.ts`, `middleware/requireAuth.ts`,
`services/sessionService.ts` (NEW), `routes/auth.ts`.
Frontend: `lib/api/auth.ts`, `lib/api/client.ts`, login form component,
`components/SessionsPanel.tsx` (NEW), `app/[locale]/(authenticated)/profile/page.tsx`,
`messages/{es,en,pt}/profile.json` (+ login namespace).

> ADR note: unarchive took ADR-080; this is **ADR-081**. The parked scraper-guards
> branch (currently labelled 078) will be renumbered to 082 when deployed.
</content>
