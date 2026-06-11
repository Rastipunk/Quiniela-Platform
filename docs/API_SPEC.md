# API Specification — Picks4All Platform

> **Last updated:** 2026-05-28
>
> This document describes every REST endpoint exposed by the Express backend at `api.picks4all.com`.

---

## Table of Contents

1. [General](#1-general)
2. [Authentication](#2-authentication)
3. [Rate Limiting](#3-rate-limiting)
4. [Error Format](#4-error-format)
5. [Endpoints](#5-endpoints)
   - [Health](#51-health)
   - [Auth](#52-auth)
   - [User Profile](#53-user-profile)
   - [Me (Account)](#54-me-account)
   - [Catalog](#55-catalog)
   - [Pick Presets](#56-pick-presets)
   - [Pools](#57-pools)
   - [Pool Overview](#58-pool-overview)
   - [Pool Members](#59-pool-members)
   - [Pool Invites](#510-pool-invites)
   - [Pool Admin](#511-pool-admin)
   - [Picks](#512-picks)
   - [Structural Picks](#513-structural-picks)
   - [Group Standings](#514-group-standings)
   - [Results](#515-results)
   - [Structural Results](#516-structural-results)
   - [Legal](#517-legal)
   - [Feedback](#518-feedback)
   - [Corporate](#519-corporate)
   - [Admin — General](#520-admin--general)
   - [Admin — Templates](#521-admin--templates)
   - [Admin — Instances](#522-admin--instances)
   - [Admin — Settings](#523-admin--settings)
   - [Admin — Corporate](#524-admin--corporate)
   - [Admin — Analytics Health](#525-admin--analytics-health)
   - [Admin — Analytics Dashboard](#526-admin--analytics-dashboard)
   - [Payments](#527-payments)
   - [Webhooks](#528-webhooks)
   - [Unsubscribe](#529-unsubscribe)

---

## 1. General

| Property | Value |
|----------|-------|
| Base URL | `https://api.picks4all.com` |
| Protocol | HTTPS only (Railway TLS) |
| Content-Type | `application/json` (request and response) |
| Body size limit | 1 MB (2 MB for `/feedback`) |
| CORS origins | `picks4all.com`, `www.picks4all.com`, plus `CORS_EXTRA_ORIGINS` env var |

---

## 2. Authentication

Authentication uses **JWT Bearer tokens** (4-hour expiry). The token can be transported either as an `Authorization: Bearer <token>` header or as an `httpOnly` cookie set by the backend on login. `requireAuth` reads the cookie first and falls back to the header.

On successful login/register the backend sets:

| Cookie | HttpOnly | Purpose |
|--------|:--------:|---------|
| `p4a_token` | yes | The JWT itself. `sameSite=lax`, `Secure` in production. |
| `p4a_logged_in` | no | UI hint flag readable from JS so the SPA knows a session exists without parsing the JWT. |
| `p4a_admin` | no | Set only when `platformRole === "ADMIN"`. UI hint to show admin entry points. |

On logout all three cookies are cleared.

**JWT payload:**
```json
{ "userId": "uuid", "platformRole": "ADMIN" | "HOST" | "PLAYER" }
```

Endpoints marked **Auth: Yes** require a valid JWT. Endpoints marked **Auth: Admin** require `platformRole === "ADMIN"`.

---

## 3. Rate Limiting

All rate limits are configurable via environment variables.

| Limiter | Scope | Window | Max Requests | Env Vars |
|---------|-------|--------|--------------|----------|
| Global API | All endpoints (except /health) | 1 min | 100 | `RATE_LIMIT_API_WINDOW_MS`, `RATE_LIMIT_API_MAX` |
| Auth (login/register) | `/auth/login`, `/auth/register` | 15 min | 10 | `RATE_LIMIT_AUTH_WINDOW_MS`, `RATE_LIMIT_AUTH_MAX` |
| Password reset | `/auth/forgot-password`, `/auth/reset-password` | 1 hour | 5 | `RATE_LIMIT_RESET_WINDOW_MS`, `RATE_LIMIT_RESET_MAX` |
| Verification resend | `/auth/resend-verification` | 1 hour | 3 | `RATE_LIMIT_VERIFY_WINDOW_MS`, `RATE_LIMIT_VERIFY_MAX` |
| Invitation send (per user) | `POST /corporate/pools/:poolId/send-invitations`, `POST /corporate/pools/:poolId/employees/:inviteId/resend` | 1 hour | 200 | `RATE_LIMIT_INVITE_SEND_WINDOW_MS`, `RATE_LIMIT_INVITE_SEND_MAX` |
| Invitation send daily ceiling (per user) | same as above | 24 hours | 1000 | `RATE_LIMIT_INVITE_SEND_DAILY_WINDOW_MS`, `RATE_LIMIT_INVITE_SEND_DAILY_MAX` |
| Corporate invite check (per IP) | `GET /auth/check-corporate-invite` | 1 min | 20 | `RATE_LIMIT_INVITE_CHECK_WINDOW_MS`, `RATE_LIMIT_INVITE_CHECK_MAX` |
| Corporate activation (per IP) | `POST /auth/activate-corporate` | 15 min | 10 | `RATE_LIMIT_INVITE_ACTIVATE_WINDOW_MS`, `RATE_LIMIT_INVITE_ACTIVATE_MAX` |
| Corporate inquiry | `/corporate/inquiry` | 15 min | 5 | `RATE_LIMIT_CORP_INQUIRY_WINDOW_MS`, `RATE_LIMIT_CORP_INQUIRY_MAX` |
| Pool creation | `POST /pools` | 1 hour | 10 | (hardcoded) |
| Result publish | `PUT /pools/:poolId/results/:matchId` | 1 min | 10 | (hardcoded) |
| Feedback | `POST /feedback` | 1 min | 5 | (hardcoded) |

When rate-limited, the response is `429 Too Many Requests` with body `{ "error": "<LIMITER_CODE>" }`.

---

## 4. Error Format

All error responses use a consistent JSON shape:

```json
{
  "error": "ERROR_CODE",
  "reason": "Human-readable explanation (optional)",
  "details": { ... }
}
```

Common error codes:

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `VALIDATION_ERROR` | Zod schema validation failed (includes `details`) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | State conflict (e.g., duplicate, wrong status) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error (no details exposed) |

Domain-specific error codes:

| HTTP | Code | Where | Description |
|------|------|-------|-------------|
| 409 | `POOL_FULL` | `POST /pools/join`, `POST /auth/activate-corporate` | Pool reached `maxParticipants`. Host receives a throttled `BLOCKED_JOIN_ATTEMPT` email. |
| 409 | `ALREADY_ACTIVATED` | `POST /auth/activate-corporate`, `POST /corporate/pools/:poolId/employees/:inviteId/resend` | Invite was already activated by the same email; no further activation/resend possible. |
| 409 | `SESSION_MISMATCH` | `POST /auth/activate-corporate` | A different user is already authenticated in the browser session than the one targeted by the invite. Body includes `currentUserEmail` and `inviteEmail` so the frontend can offer a "log out and continue" UI. |
| 400 | `INVALID_TOKEN` / `TOKEN_EXPIRED` | `POST /auth/activate-corporate`, `GET /auth/check-corporate-invite` | Activation token unknown or past its 30-day expiry. |
| 429 | `TOO_MANY_INVITE_CHECKS` | `GET /auth/check-corporate-invite` | Per-IP throttle on the public invite-check endpoint (env `RATE_LIMIT_INVITE_CHECK_MAX`, default 20/min). |
| 429 | `TOO_MANY_ACTIVATION_ATTEMPTS` | `POST /auth/activate-corporate` | Per-IP throttle on activation (env `RATE_LIMIT_INVITE_ACTIVATE_MAX`, default 10/15min). |
| 429 | `TOO_MANY_INVITE_REQUESTS_PER_HOUR` / `DAILY_INVITE_LIMIT_EXCEEDED` | `POST /corporate/pools/:poolId/send-invitations`, `POST /corporate/pools/:poolId/employees/:inviteId/resend` | Per-user throttle on invitation sends (200/hour / 1000/day defaults). |
| 500 | `PAYMENT_NOT_FOUND_RETRYABLE` | Webhook handlers (Polar `order.paid` / `order.refunded`, MP IPN) | The webhook arrived before the corresponding `PoolPayment` row was committed (50–200ms race). The 5xx response triggers the gateway's retry — the row will exist on retry. Internal-only; never surfaced to API clients. |

---

## 5. Endpoints

### 5.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

**Response:**
```json
{ "version": "v1.0.0", "commit": "abc1234", "timestamp": "2026-05-04T12:00:00.000Z" }
```

---

### 5.2 Auth

All endpoints under `/auth`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register with email/password |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/logout` | No | Clear auth cookies |
| POST | `/auth/forgot-password` | No | Request password reset email |
| POST | `/auth/reset-password` | No | Reset password with token |
| POST | `/auth/google` | No | Authenticate/register with Google ID token |
| GET | `/auth/verify-email` | No | Verify email (legacy, token in query) |
| POST | `/auth/verify-email` | No | Verify email (token in body) |
| POST | `/auth/resend-verification` | Yes | Resend verification email |
| GET | `/auth/check-corporate-invite` | No | Check corporate invite token validity |
| POST | `/auth/activate-corporate` | No | Activate corporate account from invite |

#### POST /auth/register

**Body:**
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "displayName": "John Doe",
  "password": "SecureP4ss",
  "timezone": "America/Bogota",
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false,
  "fbClickId": "fb.1...",
  "fbBrowserId": "fb.1...",
  "attribution": { "source": "google", "medium": "cpc", "campaign": "wc2026", "gclid": "...", "fbclid": "...", "landingPath": "/", "referrerUrl": "..." }
}
```

**Validation:** email (valid email), username (3-20 chars), displayName (2-50 chars), password (8-200 chars, 1 uppercase + 1 number), acceptTerms/acceptPrivacy/acceptAge (required true). `fbClickId`/`fbBrowserId` (Meta Advanced Matching ids) and the `attribution` object (UTM source/medium/campaign/content/term, click ids `gclid`/`gbraid`/`wbraid`/`fbclid`, `landingPath`, `referrerUrl`) are all optional analytics fields.

**Response (201):** `{ "user": { id, email, username, displayName, platformRole } }`

**Errors:** `EMAIL_TAKEN`, `USERNAME_TAKEN`, `LEGAL_CONSENT_REQUIRED`

#### POST /auth/login

**Body:** `{ "email": "...", "password": "..." }`

**Response (200):** `{ "user": { id, email, username, displayName, platformRole } }`

**Errors:** `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`

#### POST /auth/forgot-password

**Body:** `{ "email": "..." }`

**Response:** Always 200 (prevents email enumeration).

#### POST /auth/reset-password

**Body:** `{ "token": "...", "newPassword": "..." }`

**Errors:** `INVALID_TOKEN`, `TOKEN_EXPIRED`

#### POST /auth/google

**Body:**
```json
{
  "idToken": "google-jwt...",
  "timezone": "America/Mexico_City",
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false,
  "fbClickId": "fb.1...",
  "fbBrowserId": "fb.1...",
  "attribution": { "source": "google", "medium": "cpc", "campaign": "wc2026" }
}
```

consent fields are only required if this is a new user registration. The optional `fbClickId`/`fbBrowserId` and `attribution` object accepted on register are also accepted here.

**Response (200):** `{ "user": { id, email, username, displayName, platformRole }, "metaEventId": "..." }`

**Errors:** `GOOGLE_TOKEN_INVALID`, `EMAIL_TAKEN` (if email exists with different auth method), `LEGAL_CONSENT_REQUIRED`

#### POST /auth/verify-email

**Body:** `{ "token": "..." }`

**Errors:** `TOKEN_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `ALREADY_VERIFIED`

#### GET /auth/check-corporate-invite

**Query:** `?token=<activationToken>`

**Response (200):** `{ "valid": true, "invite": { email, poolName, companyName, expiresAt } }`

**Errors:** `MISSING_TOKEN`, `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_ALREADY_ACTIVATED`

#### POST /auth/activate-corporate

**Body:**
```json
{
  "activationToken": "...",
  "displayName": "Maria Garcia",
  "username": "maria_g",
  "password": "SecureP4ss",
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true
}
```

If the email matches an existing user, they are joined to the pool directly (password/username/displayName optional). If new, all fields are required.

**Response (200 or 201):** `{ "user": { ... }, "poolId": "...", "alreadyExisted": boolean }`

**Errors:** `INVALID_TOKEN`, `TOKEN_EXPIRED`, `ALREADY_ACTIVATED`, `VALIDATION_ERROR` (with `details.fieldErrors` per Zod), `CONSENT_REQUIRED`, `USERNAME_TAKEN`, `POOL_FULL` (409 — pool reached capacity; the host receives a throttled `BLOCKED_JOIN_ATTEMPT` email), `SESSION_MISMATCH` (409 — see below).

**Session-mismatch defence:** if the request arrives with a valid auth cookie for a user whose email differs from `invite.email`, the endpoint returns `409 SESSION_MISMATCH` WITHOUT setting cookies and WITHOUT joining the pool. The response body includes:

```json
{
  "error": "SESSION_MISMATCH",
  "currentUserEmail": "alice@empresa.com",
  "inviteEmail": "bob@empresa.com"
}
```

The frontend uses this to render a "you're signed in as X, this invite is for Y — log out and continue" panel. Comparison is case-insensitive. A null/expired/invalid cookie is treated as anonymous (no mismatch) and activation proceeds normally.

**Rate limit:** 10 attempts / 15 min per IP (env `RATE_LIMIT_INVITE_ACTIVATE_*`).

#### POST /auth/resend-verification

**Auth:** Yes

**Response:** 200 OK

**Errors:** `ALREADY_VERIFIED`, `RESEND_TOO_SOON`

---

### 5.3 User Profile

All endpoints under `/users`. Auth required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me/profile` | Yes | Get current user's full profile |
| PATCH | `/users/me/profile` | Yes | Update profile fields |

#### GET /users/me/profile

**Response:**
```json
{
  "user": {
    "id", "email", "emailVerified", "username", "displayName",
    "platformRole", "status", "firstName", "lastName", "dateOfBirth",
    "gender", "bio", "country", "timezone", "lastUsernameChangeAt",
    "createdAtUtc", "updatedAtUtc", "isGoogleAccount"
  }
}
```

#### PATCH /users/me/profile

**Body (all optional):**
```json
{
  "displayName": "New Name",
  "username": "new_username",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-05-15T00:00:00.000Z",
  "gender": "MALE",
  "bio": "Short bio",
  "country": "CO",
  "timezone": "America/Bogota"
}
```

**Username change:** limited to once every 30 days. Returns `USERNAME_CHANGE_TOO_SOON` with `daysRemaining` if attempted too soon.

**Age validation:** minimum 13 years. Returns `AGE_TOO_YOUNG`.

**Errors:** `USERNAME_TAKEN`, `USERNAME_CHANGE_TOO_SOON`, `AGE_TOO_YOUNG`, `AGE_INVALID`

---

### 5.4 Me (Account)

All endpoints under `/me`. Auth required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me/pools` | Yes | List pools where user is a member |
| GET | `/me/aggregated` | Yes | Analytics-oriented snapshot (GA4 `user_properties` / CAPI dimensions) |
| GET | `/me/email-preferences` | Yes | Get email notification preferences |
| PUT | `/me/email-preferences` | Yes | Update email notification preferences |
| GET | `/me/prediction-subscription` | Yes | Read AI prediction-update subscription status |
| PUT | `/me/prediction-subscription` | Yes | Toggle AI prediction-update subscription |

#### GET /me/pools

Returns pools where user has status ACTIVE, PENDING_APPROVAL, or LEFT.

**Response:**
```json
{
  "pools": [{
    "poolId", "role", "status", "joinedAtUtc", "leftAtUtc",
    "pool": { "id", "name", "description", "visibility", "status", "timeZone", ... },
    "tournamentInstance": { "id", "name", "status", "templateId", ... }
  }]
}
```

#### GET /me/aggregated

Returns derived, analytics-oriented dimensions the client cannot compute cheaply (pool counts, paid/free tier, corporate membership, signup method). Read once per session login to populate GA4 `user_properties` and Meta CAPI user-level fields.

**Response:**
```json
{
  "pool_count": 3,
  "paid_pool_count": 1,
  "tier": "free" | "paid",
  "is_corporate": false,
  "country": "CO",
  "platform_role": "PLAYER" | "HOST" | "ADMIN",
  "account_age_days": 42,
  "acquisition_source": "google",
  "acquisition_campaign": "wc2026",
  "is_verified_email": true,
  "signup_method": "email" | "google",
  "predictions_count": 18,
  "last_active_at": "2026-05-20T12:00:00.000Z",
  "pool_host_count": 1
}
```

#### GET /me/email-preferences

**Response:**
```json
{
  "preferences": {
    "emailNotificationsEnabled": true,
    "emailPoolInvitations": true,
    "emailDeadlineReminders": true,
    "emailResultNotifications": true,
    "emailPoolCompletions": true,
    "emailNewMemberDigest": true,
    "predictionUpdates": true
  },
  "platformEnabled": {
    "emailDeadlineReminders": false,
    "emailResultNotifications": true,
    "emailPoolCompletions": true
  },
  "descriptions": { ... }
}
```

#### PUT /me/email-preferences

**Body (all optional, at least one required):**
```json
{
  "emailNotificationsEnabled": false,
  "emailPoolInvitations": true,
  "emailDeadlineReminders": false,
  "emailResultNotifications": true,
  "emailPoolCompletions": true,
  "emailNewMemberDigest": false
}
```

#### GET /me/prediction-subscription

Reads `user.predictionUpdates` (AI Mundial 2026 prediction-update emails).

**Response:** `{ "enabled": true }`

#### PUT /me/prediction-subscription

**Body:** `{ "enabled": false }`

**Response:** `{ "enabled": false }`

---

### 5.5 Catalog

All endpoints under `/catalog`. Auth required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/instances` | Yes | List active tournament instances |
| GET | `/catalog/instances/:instanceId/phases` | Yes | Get phases for an instance |

#### GET /catalog/instances

Returns all instances with status `ACTIVE`.

**Response:**
```json
{
  "instances": [{
    "id", "name", "status", "templateId", "templateVersionId",
    "createdAtUtc", "updatedAtUtc",
    "template": { "id", "key", "name", "status", "currentPublishedVersionId" }
  }]
}
```

#### GET /catalog/instances/:instanceId/phases

**Response:**
```json
{ "phases": [{ "id", "name", "type", "order" }] }
```

---

### 5.6 Pick Presets

All endpoints under `/pick-presets`. No auth required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pick-presets` | No | List all available presets |
| GET | `/pick-presets/:key` | No | Get a specific preset with full config |

#### GET /pick-presets

**Response:**
```json
{ "presets": [{ "key": "BASIC", "name": "...", "description": "..." }] }
```

---

### 5.7 Pools

All endpoints under `/pools`. Auth required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/pools` | Yes | Create a new pool |
| GET | `/pools/:poolId` | Yes | Get pool detail (member only) |

#### POST /pools

**Body:**
```json
{
  "tournamentInstanceId": "uuid",
  "name": "My Pool",
  "description": "Optional description",
  "timeZone": "America/Bogota",
  "deadlineMinutesBeforeKickoff": 10,
  "scoringPresetKey": "CLASSIC",
  "requireApproval": false,
  "maxParticipants": 20,
  "pickTypesConfig": "BASIC"
}
```

`pickTypesConfig` accepts either a preset key (`"BASIC"`, `"SIMPLE"`, `"CUMULATIVE"`) or a full custom configuration object.

**Response (201):** Pool object.

**Errors:** `VALIDATION_ERROR`, `NOT_FOUND` (instance), `CONFLICT` (archived instance), `INVALID_TIMEZONE`

#### GET /pools/:poolId

Requires ACTIVE membership.

**Response:**
```json
{
  "pool": { ... },
  "myMembership": { "role", "status", "joinedAtUtc" },
  "counts": { "membersActive" },
  "tournamentInstance": { "id", "name", "status", ... },
  "permissions": { "canManageResults", "canInvite" }
}
```

---

### 5.8 Pool Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pools/:poolId/overview` | Yes | Comprehensive pool overview (fixture, leaderboard, picks) |

**Query:** `?leaderboardVerbose=1` for detailed scoring breakdown.

---

### 5.9 Pool Members

All require auth. Member actions require pool membership; admin actions require HOST or CO_ADMIN role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pools/:poolId/members` | Yes | List active members |
| GET | `/pools/:poolId/pending-members` | Yes (admin) | List pending approval requests |
| POST | `/pools/:poolId/members/:memberId/approve` | Yes (admin) | Approve pending member |
| POST | `/pools/:poolId/members/:memberId/reject` | Yes (admin) | Reject pending member |
| POST | `/pools/:poolId/members/:memberId/kick` | Yes (admin) | Kick a member |
| POST | `/pools/:poolId/members/:memberId/ban` | Yes (admin) | Ban a member |
| POST | `/pools/:poolId/members/:memberId/promote` | Yes (HOST only) | Promote PLAYER to CO_ADMIN |
| POST | `/pools/:poolId/members/:memberId/demote` | Yes (HOST only) | Demote CO_ADMIN to PLAYER |
| POST | `/pools/:poolId/leave` | Yes | Leave pool (PLAYER only) |

#### POST /pools/:poolId/members/:memberId/reject

**Body (optional):** `{ "reason": "..." }`

#### POST /pools/:poolId/members/:memberId/kick

**Body (optional):** `{ "reason": "..." }`

#### POST /pools/:poolId/members/:memberId/ban

**Body:** `{ "reason": "Required reason", "deletePicks": false }`

---

### 5.10 Pool Invites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/pools/:poolId/invites` | Yes (admin) | Create invite code |
| GET | `/pools/:poolId/invites` | Yes (admin) | List invite codes (includes expired/revoked for history) |
| DELETE | `/pools/:poolId/invites/:inviteId` | Yes (admin) | Soft-revoke an invite code |
| POST | `/pools/:poolId/send-invite-email` | Yes (admin) | Send invitation email to specific address |
| POST | `/pools/join` | Yes | Join pool with invite code |

#### POST /pools/:poolId/invites

**Body (optional):**
```json
{ "maxUses": 50, "expiresAtUtc": "2026-05-01T00:00:00.000Z" }
```

**Response (201):** `{ "id", "poolId", "code", "maxUses", "uses", "expiresAtUtc" }`

#### POST /pools/:poolId/send-invite-email

**Body:** `{ "email": "someone@example.com", "inviteCode": "ABC123" }`

Respects user email preferences. Returns `skipped: true` if user disabled notifications.

#### POST /pools/join

**Body:** `{ "code": "ABC123" }`

**Response:** `{ "poolId": "...", "status": "ACTIVE" | "PENDING_APPROVAL", "message": "..." }`

**Errors:** `NOT_FOUND`, `CONFLICT` (expired, maxUses reached, pool not accepting), `BANNED_FROM_POOL`, `POOL_FULL`

---

### 5.10b Invite Preview (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/invite-preview/:code` | No | Preview pool info before joining |

**Response (200):** flat object. `valid` is `false` once the invite is expired, has reached `maxUses`, or the pool is `ARCHIVED`. `organization` carries corporate branding when the pool belongs to one, otherwise `null`.
```json
{
  "poolName": "Pool Name",
  "tournamentName": "World Cup 2026",
  "hostName": "HostName",
  "memberCount": 5,
  "status": "ACTIVE",
  "valid": true,
  "organization": {
    "name": "Acme Corp",
    "logoBase64": "data:image/png;base64,...",
    "primaryColor": "#4F46E5",
    "secondaryColor": "#8F0E70",
    "welcomeMessage": "Welcome to our corporate pool!"
  }
}
```

**Errors:** `NOT_FOUND` (invalid code)

---

### 5.10c Service-to-Service: Active Matches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/active-matches` | API Key | Returns active matches for picks4all-scores service |

**Auth:** `x-api-key: <SCORES_SERVICE_API_KEY>` header (or `?key=` query param) — NOT user JWT. Returns `404 NOT_CONFIGURED` if `SCORES_SERVICE_API_KEY` is unset, `403 INVALID_API_KEY` if the key does not match.

Matches are AUTO-mode, sync-enabled, ACTIVE instances whose kickoff falls in the window from 3 hours ago to 24 hours ahead.

**Response (200):**
```json
{
  "matches": [
    {
      "fixtureId": 1234567,
      "internalMatchId": "gs_a_m1",
      "instanceId": "uuid",
      "instanceName": "FIFA World Cup 2026",
      "homeTeamName": "Mexico",
      "awayTeamName": "South Africa",
      "kickoffUtc": "2026-06-11T19:00:00Z",
      "leagueId": 1,
      "season": 2026
    }
  ],
  "windowStart": "2026-06-11T16:00:00.000Z",
  "windowEnd": "2026-06-12T19:00:00.000Z",
  "timestamp": "2026-06-11T19:00:00.000Z"
}
```

---

### 5.11 Pool Admin

All require HOST or CO_ADMIN role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/pools/:poolId/matches/:matchId/scoring-override` | Yes (admin) | Toggle scoring for a match |
| POST | `/pools/:poolId/advance-phase` | Yes (admin) | Advance tournament phase |
| PATCH | `/pools/:poolId/settings` | Yes (admin) | Update pool settings |
| POST | `/pools/:poolId/lock-phase` | Yes (admin) | Lock/unlock a phase |
| POST | `/pools/:poolId/archive` | Yes (HOST) | Archive the pool |
| GET | `/pools/:poolId/breakdown/match/:matchId` | Yes (admin) | Match pick breakdown |
| GET | `/pools/:poolId/breakdown/phase/:phaseId` | Yes (admin) | Phase scoring breakdown |
| GET | `/pools/:poolId/breakdown/group/:groupId` | Yes (admin) | Group standings breakdown |
| GET | `/pools/:poolId/players/:userId/summary` | Yes (admin) | Player scoring summary |
| GET | `/pools/:poolId/notifications` | Yes (admin) | Pool notification history |

#### PUT /pools/:poolId/matches/:matchId/scoring-override

**Body:** `{ "scoringEnabled": false, "reason": "Match cancelled" }`

#### POST /pools/:poolId/advance-phase

**Body:** `{ "currentPhaseId": "group_a", "nextPhaseId": "r32" }`

#### PATCH /pools/:poolId/settings

**Body (all optional):**
```json
{
  "autoAdvanceEnabled": true,
  "requireApproval": false,
  "extraTimePhases": ["qf", "sf", "final"]
}
```

#### POST /pools/:poolId/lock-phase

**Body:** `{ "phaseId": "r16", "locked": true }`

---

### 5.12 Picks

All require auth and pool membership.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/pools/:poolId/matches` | Yes | Get pool matches with deadline info |
| PUT | `/pools/:poolId/picks/:matchId` | Yes | Create/update pick for a match |
| GET | `/pools/:poolId/matches/:matchId/picks` | Yes | Get all picks for a match (after deadline) |
| GET | `/pools/:poolId/picks` | Yes | Get all my picks in the pool |

#### PUT /pools/:poolId/picks/:matchId

**Body:**
```json
{ "pick": { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 } }
```

or

```json
{ "pick": { "type": "OUTCOME", "outcome": "HOME" } }
```

or

```json
{ "pick": { "type": "WINNER", "winnerTeamId": "t_BRA" } }
```

**Errors:** `FORBIDDEN` (not member), `MATCH_LOCKED` (deadline passed), `MATCH_NOT_FOUND`, `PICK_TYPE_NOT_ALLOWED`

#### GET /pools/:poolId/matches/:matchId/picks

Only returns picks after the match deadline has passed. Before deadline, returns `MATCH_NOT_LOCKED`.

---

### 5.13 Structural Picks

Phase-level picks (knockout winners, group standings). All require auth and pool membership.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/pools/:poolId/structural-picks/:phaseId` | Yes | Upsert structural pick for a phase |
| GET | `/pools/:poolId/structural-picks/:phaseId` | Yes | Get my structural pick for a phase |
| GET | `/pools/:poolId/structural-picks` | Yes | Get all my structural picks |

#### PUT /pools/:poolId/structural-picks/:phaseId

**Body (group standings format):**
```json
{ "groups": [{ "groupId": "A", "teamIds": ["t1", "t2", "t3", "t4"] }] }
```

**Body (knockout format):**
```json
{ "matches": [{ "matchId": "m1", "winnerId": "t_BRA" }] }
```

Both formats support incremental merge: new picks are merged with existing ones, not replaced entirely. Picks for already-locked units are preserved verbatim.

**Deadline enforcement (per unit, ADR-070):**

- **Knockout matches** lock individually at `kickoffUtc - deadlineMinutesBeforeKickoff`. Locked or unknown matchIds in the payload are dropped; the rest are saved.
- **Groups** lock when the group's **earliest** match reaches the pool's deadline window — same rule as `PUT /group-standings/:phaseId/:groupId`. Locked or unknown groupIds in the payload are dropped; the rest are saved.
- If every submitted unit is locked → `409 DEADLINE_PASSED` with `lockedMatchIds` / `lockedGroupIds`.

---

### 5.14 Group Standings

Granular group-by-group standings picks and results. All require auth and pool membership.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/pools/:poolId/group-standings/:phaseId/:groupId` | Yes | Save/update group standings pick |
| GET | `/pools/:poolId/group-standings/:phaseId/:groupId` | Yes | Get my pick for a specific group |
| GET | `/pools/:poolId/group-standings/:phaseId` | Yes | Get all my group picks for a phase |
| PUT | `/pools/:poolId/group-standings-results/:phaseId/:groupId` | Yes (admin) | Publish official group standings result |
| GET | `/pools/:poolId/group-standings-results/:phaseId/:groupId` | Yes | Get official result for a group |
| GET | `/pools/:poolId/group-standings-results/:phaseId` | Yes | Get all official results for a phase |
| POST | `/pools/:poolId/group-standings-generate/:phaseId/:groupId` | Yes (admin) | Auto-generate standings from match results |
| GET | `/pools/:poolId/group-match-results/:groupId` | Yes | Get match results for a group |

#### PUT /pools/:poolId/group-standings/:phaseId/:groupId

**Body:** `{ "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"] }`

teamIds must be exactly 4 elements.

#### PUT /pools/:poolId/group-standings-results/:phaseId/:groupId

**Body:** `{ "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"], "reason": "Errata: tiebreaker corrected" }`

`reason` is required if this is an update to an existing result (version > 1).

---

### 5.15 Results

Match result publishing and leaderboard. All require auth.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/pools/:poolId/results/:matchId` | Yes (admin) | Publish or override a match result |
| GET | `/pools/:poolId/leaderboard` | Yes | Get pool leaderboard |

#### PUT /pools/:poolId/results/:matchId

**Body:**
```json
{
  "homeGoals": 2,
  "awayGoals": 1,
  "homeGoals90": 1,
  "awayGoals90": 1,
  "homePenalties": 4,
  "awayPenalties": 3,
  "reason": "API error corrected"
}
```

- `homeGoals90`/`awayGoals90` are optional (only if match went to extra time).
- `homePenalties`/`awayPenalties` are optional (only for knockout matches that went to penalties).
- `reason` is required when overriding an existing result.

**AUTO mode behavior:** In instances with `resultSourceMode = AUTO`, this endpoint **REJECTS** if no prior result exists (returns `409 CONFLICT`). The host can only override existing results (source becomes `HOST_OVERRIDE`). First results must come from the API-Football sync system.

**On override (HOST_OVERRIDE):** All active pool members receive an email notification with the previous result, new result, and the reason.

**On normal publish:** Triggers result notification emails and auto-advance logic.

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (no prior result in AUTO mode), `VALIDATION_ERROR`

#### GET /pools/:poolId/leaderboard

**Query:** `?verbose=1` for detailed per-match scoring breakdown.

**Response:**
```json
{
  "leaderboard": [{
    "userId", "username", "displayName", "totalPoints",
    "rank", "matchesScored", "exactScores", "correctOutcomes"
  }]
}
```

---

### 5.16 Structural Results

Phase-level official results. All require auth.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/pools/:poolId/structural-results/:phaseId` | Yes (admin) | Publish structural phase result |
| GET | `/pools/:poolId/structural-results/:phaseId` | Yes | Get structural result for a phase |
| GET | `/pools/:poolId/structural-results` | Yes | Get all structural results for the pool |

#### PUT /pools/:poolId/structural-results/:phaseId

Same body format as structural picks:

```json
{ "groups": [{ "groupId": "A", "teamIds": ["t1", "t2", "t3", "t4"] }] }
```

or

```json
{ "matches": [{ "matchId": "m1", "winnerId": "t_BRA" }] }
```

---

### 5.17 Legal

Endpoints under `/legal`. Most are public; consent endpoints require auth.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/legal/documents/:type` | No | Get active legal document |
| GET | `/legal/current-versions` | No | Get current version numbers |
| GET | `/legal/consent-status` | Yes | Check user's consent status |
| POST | `/legal/accept` | Yes | Accept legal documents |

#### GET /legal/documents/:type

**Path params:** `type` = `terms`, `privacy`, `TERMS_OF_SERVICE`, or `PRIVACY_POLICY`

**Query:** `?locale=en` (default: `es`)

**Response:**
```json
{
  "document": {
    "id", "type", "version", "title", "content", "locale", "publishedAt", "effectiveAt"
  }
}
```

#### GET /legal/current-versions

**Query:** `?locale=en`

**Response:**
```json
{
  "versions": { "termsOfService": "2026-01-25", "privacyPolicy": "2026-01-25" },
  "documents": { "termsOfService": { ... }, "privacyPolicy": { ... } }
}
```

#### GET /legal/consent-status

**Response:**
```json
{
  "consent": {
    "termsOfService": { "accepted", "version", "acceptedAt", "isUpToDate", "currentVersion" },
    "privacyPolicy": { "accepted", "version", "acceptedAt", "isUpToDate", "currentVersion" },
    "ageVerified": true,
    "marketingConsent": false
  },
  "requiresUpdate": false
}
```

#### POST /legal/accept

**Body (at least one required):**
```json
{
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false
}
```

---

### 5.18 Feedback

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/feedback` | Optional | Submit feedback (bug or suggestion) |
| GET | `/feedback/admin` | Admin | List all feedback entries |

#### POST /feedback

Auth is optional. If authenticated, the user ID and email are attached.

**Body:**
```json
{
  "type": "BUG",
  "message": "The leaderboard does not update after results...",
  "imageBase64": "data:image/png;base64,...",
  "wantsContact": true,
  "contactName": "Juan",
  "phoneNumber": "+573001234567",
  "currentUrl": "/pools/abc123"
}
```

**Limits:** message 10-2000 chars, imageBase64 max ~500KB.

**Response (201):** `{ "ok": true, "message": "...", "id": "uuid" }`

Sends an admin email notification on submission.

#### GET /feedback/admin

**Query:** `?type=BUG&wantsContact=true&page=1&limit=50`

**Response:** Paginated list with `feedbacks[]` and `pagination { page, limit, total, totalPages }`.

---

### 5.19 Corporate

Endpoints under `/corporate`. Mix of public and authenticated.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/corporate/inquiry` | No | Submit corporate inquiry |
| POST | `/corporate/pools` | Yes | Create corporate pool (self-service) |
| POST | `/corporate/pools/:poolId/employees` | Yes | Add employees to corporate pool |
| GET | `/corporate/pools/:poolId/employees` | Yes | List employees/invites |
| POST | `/corporate/pools/:poolId/send-invitations` | Yes | Send invitation emails to all pending employees |
| POST | `/corporate/pools/:poolId/employees/:inviteId/resend` | Yes | Re-send a single activation email; rotates the activation token |
| POST | `/corporate/pools/:poolId/employees/bulk-resend-expired` | Yes | Reissue activation emails for every expired invite in the pool |
| DELETE | `/corporate/pools/:poolId/employees/:inviteId` | Yes | Remove pending employee |
| PATCH | `/corporate/pools/:poolId/branding` | Yes | Edit organization branding after creation |
| GET | `/corporate/csv-template` | No | Download CSV template for employee upload |

#### POST /corporate/inquiry

**Body:**
```json
{
  "companyName": "Acme Corp",
  "contactName": "Maria Garcia",
  "contactEmail": "maria@acme.com",
  "contactPhone": "+573001234567",
  "country": "CO",
  "currency": "COP",
  "poolsConfig": [50, 50, 100],
  "numberOfPools": 3,
  "slotsPerPool": 100,
  "employeeCount": "51-200",
  "message": "We want to create a pool for our company...",
  "locale": "es"
}
```

The quote-panel fields (`country` ISO 3166-1 alpha-2, `currency` `"COP"`/`"USD"`, `poolsConfig` array of per-pool slot counts, `numberOfPools`, `slotsPerPool`) drive the sales/quote funnel (ADR-061). When `poolsConfig` is present the service derives `numberOfPools`/`slotsPerPool` from the array. `employeeCount` (`"1-50"`/`"51-200"`/`"201-500"`/`"500+"`) is the legacy tiered selector, kept only for back-compat.

#### POST /corporate/pools

**Body:**
```json
{
  "companyName": "Acme Corp",
  "logoBase64": "data:image/png;base64,...",
  "welcomeMessage": "Welcome to our corporate pool!",
  "invitationMessage": "You've been invited to our company pool!",
  "primaryColor": "#4F46E5",
  "secondaryColor": "#8F0E70",
  "invitationLocale": "es",
  "tournamentInstanceId": "uuid",
  "poolName": "Acme WC 2026",
  "poolDescription": "...",
  "timeZone": "America/Bogota",
  "deadlineMinutesBeforeKickoff": 10,
  "requireApproval": false,
  "pickTypesConfig": "BASIC",
  "maxParticipants": 200,
  "emails": ["emp1@acme.com", "emp2@acme.com"]
}
```

`primaryColor`/`secondaryColor` are optional hex colors (`#RRGGBB`). `invitationLocale` (`"es"` | `"en"` | `"pt"`, default `"es"`) sets the first-touch email locale on the Organization (ADR-062 — governs only the activation email; `User.locale` takes over post-activation).

Creates Organization + Pool + PoolMember(CORPORATE_HOST) (+ CorporateInvites if `emails` was provided) in a transaction.

`emails` is **optional** and accepted only for back-compat with older clients. The current corporate wizard (post-audit) does NOT pre-load invitees; the flow is: create pool → host enters the pool's admin tab → adds emails via `POST /pools/:poolId/employees` → sends invitations via `POST /pools/:poolId/send-invitations`. Single source of truth for invite management.

**Capacity gate:** the request's `maxParticipants` is treated as INTENT only. The pool is created at `CORPORATE_FREE_LIMIT` (env, default 2) regardless of input. If the wizard requested a paid tier, it immediately initiates Polar/MP checkout; on confirmed payment, `paymentService.handleOrderPaid` raises `Pool.maxParticipants` to the requested value via `PoolPayment.toCapacity`. Without this cap, a malicious caller could POST a large `maxParticipants` and create a high-capacity pool without paying.

#### POST /corporate/pools/:poolId/employees

**Body:** `{ "emails": ["emp3@acme.com", "emp4@acme.com"] }`

#### POST /corporate/pools/:poolId/send-invitations

Sends activation emails to all `CorporateInvite` rows in `PENDING` status for the given pool.

**Body:** none.

**Response:** `{ "sent": <number>, "failed": <number> }`

**Side effects:**
- Each successful send moves the invite from `PENDING` to `SENT`.
- Failures move it to `FAILED`. The activation token remains valid; another `send-invitations` call retries.
- Audit event `CORPORATE_INVITATIONS_SENT` recorded with `{ sent, failed, total }`.

**Errors:** `FORBIDDEN` (caller is not the pool's `CORPORATE_HOST`), `NOT_FOUND` (pool), `TOO_MANY_INVITE_REQUESTS_PER_HOUR`, `DAILY_INVITE_LIMIT_EXCEEDED`.

**Rate limits:** see §3 — both apply at this endpoint, keyed by `req.auth.userId`.

#### POST /corporate/pools/:poolId/employees/:inviteId/resend

Re-sends the activation email for a single corporate invite. Use case: the original email was lost (spam folder, accidentally deleted, employee mistyped at activation, etc.).

**Body:** none.

**Response:** `{ "email": "<invitee>", "status": "SENT" | "FAILED" }`

**Side effects:**
- Atomically rotates the invite's `activationToken` to a fresh random value AND resets `activationTokenExpiresAt` to now + 30 days. The previous token is invalidated; a forwarded copy of the OLD email becomes useless after a resend.
- The rotation runs inside `updateMany WHERE status IN (PENDING, SENT, FAILED)` so a concurrent activation race losing the claim surfaces as `ALREADY_ACTIVATED` rather than dispatching a now-stale token.
- Audit event `CORPORATE_INVITATION_RESENT` with `{ email, inviteId }`.

**Errors:** `FORBIDDEN` (not `CORPORATE_HOST` of the pool), `NOT_FOUND` (invite ID belongs to a different pool — IDOR defence), `ALREADY_ACTIVATED` (employee already has account; no resend possible), `TOO_MANY_INVITE_REQUESTS_PER_HOUR`, `DAILY_INVITE_LIMIT_EXCEEDED`.

**Rate limits:** SAME per-user buckets as `/send-invitations` (200/hour, 1000/day) keyed on `req.auth.userId`. The bulk-send and individual-resend share the budget so a host cannot bypass the bulk cap by spamming individual resends.

#### POST /corporate/pools/:poolId/employees/bulk-resend-expired

Reissues activation emails for every expired invite in the pool in one call, rotating each invite's token and resetting its 30-day expiry. Host-only (`CORPORATE_HOST`).

**Body:** none.

**Errors:** `FORBIDDEN` (not `CORPORATE_HOST`), `NOT_FOUND` (pool), `TOO_MANY_INVITE_REQUESTS_PER_HOUR`, `DAILY_INVITE_LIMIT_EXCEEDED`.

**Rate limits:** SAME per-user buckets as `/send-invitations` (`inviteSendLimiter` + `inviteSendDailyLimiter`, 200/hour + 1000/day) keyed on `req.auth.userId`, so bulk-resend cannot bypass the bulk-send cap.

#### PATCH /corporate/pools/:poolId/branding

Edits the pool's Organization branding after creation. Host-only. Every field is optional: pass `null` to clear a field, a string/hex value to set it, omit to leave unchanged. Each successful change records an `OrganizationBrandingAudit` entry.

**Body (all optional):**
```json
{
  "logoBase64": "data:image/png;base64,...",
  "welcomeMessage": "Welcome!",
  "invitationMessage": "You've been invited!",
  "primaryColor": "#4F46E5",
  "secondaryColor": "#8F0E70",
  "invitationLocale": "en"
}
```

`invitationLocale` is non-nullable (the column has `NOT NULL DEFAULT 'es'`); the other fields accept `null` to clear.

**Errors:** `FORBIDDEN` (not `CORPORATE_HOST`), `NOT_FOUND` (pool), `VALIDATION_ERROR`.

#### DELETE /corporate/pools/:poolId/employees/:inviteId

Removes a corporate invite from the pool. Allowed only if `status !== "ACTIVATED"` (an employee who already created their account can be removed via the regular pool member flow).

**Errors:** `FORBIDDEN` (not `CORPORATE_HOST`), `NOT_FOUND`, `ALREADY_ACTIVATED`.

#### GET /corporate/csv-template

Returns a CSV file with UTF-8 BOM for Excel compatibility:
```
email,nombre
empleado1@empresa.com,Juan Perez
empleado2@empresa.com,Maria Garcia
```

---

### 5.20 Admin -- General

All admin endpoints are under `/admin` and require `platformRole === "ADMIN"`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/ping` | Admin | RBAC validation check |
| GET | `/admin/stats` | Admin | Platform-wide statistics |
| POST | `/admin/bootstrap-admin` | No (one-shot) | Bootstrap the first ADMIN user when the table is empty |
| POST | `/admin/jobs/trigger-fixture-tracking` | Admin | Manually trigger the fixture-tracking cron once |
| POST | `/admin/prediction-update` | Admin | Push an AI prediction update to subscribed users |
| POST | `/admin/seed-wc2026` | Admin | Seed World Cup 2026 data |
| POST | `/admin/update-ucl-r16` | Admin | Update UCL R16 draw |
| GET | `/admin/audit/r16-late-picks` | Admin | Audit R16 late picks |
| POST | `/admin/fix-r16-integrity` | Admin | Fix R16 data integrity |

#### POST /admin/fix-r16-integrity

**Query:** `?dryRun=true` (default: true)

---

### 5.21 Admin -- Templates

Template and version management. All require Admin.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/templates` | Admin | List all templates |
| POST | `/admin/templates` | Admin | Create template |
| GET | `/admin/templates/:templateId/versions` | Admin | List versions for a template |
| POST | `/admin/templates/:templateId/versions` | Admin | Create new version |
| PUT | `/admin/templates/:templateId/versions/:versionId` | Admin | Update DRAFT version |
| POST | `/admin/templates/:templateId/versions/:versionId/publish` | Admin | Publish a DRAFT version |

#### POST /admin/templates

**Body:** `{ "key": "worldcup_2026", "name": "FIFA World Cup 2026", "description": "..." }`

**Errors:** `CONFLICT` (key already exists)

#### POST /admin/templates/:templateId/versions

**Body:** `{ "dataJson": { ... } }`

dataJson is validated against the templateDataSchema (teams, groups, matches, phases).

#### PUT /admin/templates/:templateId/versions/:versionId

Only DRAFT versions can be edited. Published versions are immutable.

**Body:** `{ "dataJson": { ... } }`

**Errors:** `CONFLICT` (not DRAFT)

---

### 5.22 Admin -- Instances

Tournament instance lifecycle and sync management. All require Admin.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/instances` | Admin | List all instances |
| GET | `/admin/instances/:instanceId` | Admin | Get instance detail |
| POST | `/admin/templates/:templateId/instances` | Admin | Create instance from template |
| POST | `/admin/instances/:instanceId/activate` | Admin | DRAFT -> ACTIVE |
| POST | `/admin/instances/:instanceId/complete` | Admin | ACTIVE -> COMPLETED |
| POST | `/admin/instances/:instanceId/archive` | Admin | DRAFT/COMPLETED -> ARCHIVED |
| POST | `/admin/instances/:instanceId/advance-to-r32` | Admin | Advance to round of 32 |
| POST | `/admin/instances/:instanceId/advance-knockout` | Admin | Advance knockout phase |
| POST | `/admin/instances/:instanceId/advance-two-legged` | Admin | Advance two-legged knockout |
| GET | `/admin/instances/:instanceId/group-stage-status` | Admin | Group stage completion status |
| PUT | `/admin/instances/:instanceId/result-source` | Admin | Configure result source mode |
| POST | `/admin/instances/:instanceId/match-mappings` | Admin | Create API-Football match mappings |
| GET | `/admin/instances/:instanceId/match-mappings` | Admin | List match mappings |
| DELETE | `/admin/instances/:instanceId/match-mappings/:mappingId` | Admin | Delete a mapping |
| POST | `/admin/instances/:instanceId/sync` | Admin | Trigger manual sync |
| GET | `/admin/instances/:instanceId/sync-status` | Admin | Get sync status |
| POST | `/admin/sync/trigger-all` | Admin | Trigger global sync for all AUTO instances |
| GET | `/admin/sync/status` | Admin | Global sync status |
| POST | `/admin/instances/:instanceId/update-r16-draw` | Admin | Update R16 draw from API |

#### POST /admin/templates/:templateId/instances

**Body (optional):**
```json
{ "name": "UCL 2025/26", "templateVersionId": "uuid" }
```

If `templateVersionId` is omitted, uses the current published version.

#### PUT /admin/instances/:instanceId/result-source

**Body:**
```json
{
  "resultSourceMode": "AUTO",
  "apiFootballLeagueId": 2,
  "apiFootballSeasonId": 2025,
  "syncEnabled": true
}
```

#### POST /admin/instances/:instanceId/match-mappings

**Body:**
```json
{
  "mappings": [
    { "internalMatchId": "gs_a_m1", "apiFootballFixtureId": 123456 },
    { "internalMatchId": "gs_a_m2", "apiFootballFixtureId": 123457 }
  ]
}
```

Max 200 mappings per request.

#### POST /admin/instances/:instanceId/advance-knockout

**Body:** `{ "currentPhaseId": "r16", "nextPhaseId": "qf" }`

#### POST /admin/instances/:instanceId/advance-two-legged

**Body:** `{ "currentRound": "r16", "nextRound": "qf", "poolId": "uuid" }`

`poolId` is optional; if provided, only that pool's fixture is advanced.

---

### 5.23 Admin -- Settings

Platform settings management under `/admin/settings`. All require Admin.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/settings/email` | Admin | Get email toggle settings |
| PUT | `/admin/settings/email` | Admin | Update email toggle settings |
| POST | `/admin/settings/email/test` | Admin | Send test email |
| POST | `/admin/settings/email/reminders/run` | Admin | Manually trigger deadline reminders |
| GET | `/admin/settings/email/reminders/stats` | Admin | Get reminder statistics |
| GET | `/admin/settings/scores` | Admin | Read `scoresServiceEnabled` toggle |
| PUT | `/admin/settings/scores` | Admin | Write `scoresServiceEnabled` toggle |

#### PUT /admin/settings/email

**Body (all optional, at least one required):**
```json
{
  "emailWelcomeEnabled": true,
  "emailPoolInvitationEnabled": true,
  "emailDeadlineReminderEnabled": false,
  "emailResultPublishedEnabled": true,
  "emailPoolCompletedEnabled": true
}
```

#### POST /admin/settings/email/test

**Body:** `{ "type": "welcome" | "poolInvitation" | "deadlineReminder" | "resultPublished" | "poolCompleted" | "newMemberDigest" | "phaseCompletionSummary", "to": "test@example.com" }`

#### GET /admin/settings/scores

**Response:** `{ "scoresServiceEnabled": true }`

#### PUT /admin/settings/scores

**Body:** `{ "scoresServiceEnabled": false }`

**Response:** `{ "scoresServiceEnabled": false }`

#### POST /admin/settings/email/reminders/run

**Body:**
```json
{ "hoursBeforeDeadline": 24, "dryRun": false }
```

`hoursBeforeDeadline`: 1-168 (default 24). `dryRun`: if true, simulates without sending.

#### GET /admin/settings/email/reminders/stats

**Query:** `?poolId=uuid&days=7`

---

### 5.24 Admin -- Corporate

Corporate management under `/admin/corporate`. All require Admin.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/corporate/inquiries` | Admin | List corporate inquiries |
| PATCH | `/admin/corporate/inquiries/:id` | Admin | Mark inquiry as responded |
| GET | `/admin/corporate/organizations` | Admin | List organizations |
| POST | `/admin/corporate/organizations` | Admin | Create organization |
| PATCH | `/admin/corporate/organizations/:id` | Admin | Update organization |
| POST | `/admin/corporate/organizations/:orgId/pools` | Admin | Create pool for organization |
| POST | `/admin/corporate/bulk-create-users` | Admin | Bulk create users and add to pool |

#### GET /admin/corporate/inquiries

**Query:** `?responded=false&page=1&limit=50`

**Response:** Paginated list with `inquiries[]` and `pagination`.

#### POST /admin/corporate/organizations

**Body:**
```json
{
  "name": "Acme Corp",
  "contactEmail": "admin@acme.com",
  "contactName": "John Doe",
  "contactPhone": "+573001234567",
  "logoUrl": "https://...",
  "website": "https://acme.com",
  "employeeCount": "51-200",
  "notes": "Internal notes...",
  "inquiryId": "uuid"
}
```

If `inquiryId` is provided, links the organization to that inquiry.

#### PATCH /admin/corporate/organizations/:id

**Body (all optional):**
```json
{
  "name": "...", "contactEmail": "...", "contactName": "...",
  "contactPhone": "...", "logoUrl": null, "website": null,
  "employeeCount": "201-500", "notes": "...",
  "status": "ACTIVE"
}
```

#### POST /admin/corporate/organizations/:orgId/pools

**Body:**
```json
{
  "name": "Acme WC 2026",
  "description": "...",
  "tournamentInstanceId": "uuid",
  "logoUrl": "https://..."
}
```

Creates pool with status ACTIVE and adds the admin as HOST.

#### POST /admin/corporate/bulk-create-users

**Body:**
```json
{
  "emails": ["user1@acme.com", "user2@acme.com"],
  "poolId": "uuid"
}
```

Creates users with auto-generated usernames and passwords. If `poolId` is provided, adds all users as ACTIVE PLAYER members. Existing users are skipped for creation but still added to the pool.

**Response (201):**
```json
{
  "created": [{ "id", "email", "username" }],
  "existing": [{ "id", "email" }],
  "addedToPool": 5,
  "summary": { "totalEmails", "newUsers", "existingUsers", "addedToPool" }
}
```

---

### 5.25 Admin — Analytics Health

Diagnostic endpoints under `/admin/analytics`. All require Admin. Used
by the `/admin/analytics-health` dashboard and by an ops human debugging
a tracking pipeline outage. See
[`docs/guides/ANALYTICS_PIPELINE.md`](guides/ANALYTICS_PIPELINE.md) for
the underlying flow.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/admin/analytics/probe`                      | Admin | Run all health checks in parallel (GA4, Meta CAPI, DLQ, frontend HTML, env vars) |
| POST | `/admin/analytics/probe/send-real-purchase`   | Admin | Emit a real $0.01 Purchase to GA4 + Meta using the admin's own userId, for end-to-end validation |

#### GET /admin/analytics/probe

Fires one call per sink and returns structured results. Defensive — no
check throws; failures surface in the `status`/`details` of each block.

**Response (200):**
```json
{
  "ok": true,
  "overall": "ok | degraded | error",
  "timestamp": "2026-04-22T20:30:00.000Z",
  "checks": {
    "ga4":           { "status": "ok|error|not_configured", "message": "...", "details": { "validationMessages": [], "clientId": "...", "measurementId": "G-..." } },
    "metaCapi":      { "status": "ok|error|not_configured", "message": "...", "details": { "events_received": 1, "fbtrace_id": "...", "messages": [], "eventId": "...", "test_event_code_used": true } },
    "dlqBacklog":    { "status": "ok|error",                "message": "...", "details": { "unresolved": 0, "resolvedTotal": 0, "providerCounts": { "META_CAPI": 0, "GA4_MP": 0 }, "oldest": null } },
    "frontendHtml":  { "status": "ok|error|not_configured", "message": "...", "details": { "gtmId": "GTM-...", "ga4Id": "G-...", "pixelPresent": true, "missing": [], "frontendUrl": "..." } }
  },
  "envVars": {
    "backend":  { "GA4_MEASUREMENT_ID": true, "GA4_API_SECRET": true, "META_PIXEL_ID": true, "META_CAPI_ACCESS_TOKEN": true, "META_TEST_EVENT_CODE": true, "FRONTEND_URL": true },
    "frontend_note": "NEXT_PUBLIC_* vars are inlined at build time..."
  }
}
```

The probe itself NEVER sends to GA4's production endpoint — it uses
`https://www.google-analytics.com/debug/mp/collect` so events do not
pollute reports. Meta CAPI uses the configured `META_TEST_EVENT_CODE`
when set so events surface in the Events Manager Test Events tab only.

#### POST /admin/analytics/probe/send-real-purchase

Body is strictly `{ "allowReal": true, "transactionId"?: string }`. The
`allowReal` flag is a guardrail against accidental pollution. Emits a
$0.01 `purchase` event to both GA4 MP (production `/mp/collect`) and
Meta CAPI with the same `transaction_id` so they dedupe as one
conversion. Response reports per-sink outcome — if a sink was skipped
because its env vars are missing, `sent: false` and `reason` carry the
detail instead of lying about delivery.

**Response (200):**
```json
{
  "ok": true,
  "transactionId": "probe_1776800084507",
  "ga4":     { "sent": true, "note": "Event attempted. ..." },
  "metaCapi":{ "sent": true, "note": "Event attempted. ..." },
  "instructions": [
    "GA4 > Reports > Realtime: purchase should appear within 10-30 seconds.",
    "Meta Events Manager > Test Events tab: event should appear within 10-30 seconds."
  ]
}
```

---

### 5.26 Admin — Analytics Dashboard

Single platform-wide growth + health snapshot consumed by the
`/admin/analytics` page in the SPA. Admin-gated.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/analytics/dashboard` | Admin | Combined snapshot of users, pools, predictions, revenue, retention, corporate funnel, and operational health |

**Query:** `?refresh=1` to bypass the 60-second in-process cache.

**Response (200):** Large JSON with `generatedAtUtc`, `cacheTtlSeconds`,
`cached`, an `errors[]` array (failed sub-queries surface here without
taking the whole payload down) and ~20 sections including `topLine`,
`signupsByWeek`, `poolsByWeek`, `picksByWeek`, `revenueByWeek`,
`dailyActiveUsers`, `usersByCountry`, `poolsByStatus`, `funnel`,
`corporateFunnel`, `topAcquisition`, `organicReferrals`, `poolHealth`,
`cohortRetention`, `paymentBreakdown`, `operationalHealth`. The TS
contract lives in `frontend-next/src/lib/api/admin.ts`
(`AnalyticsDashboardResponse`).

The handler wraps every query bundle in `safeRun` so a single broken
SQL fragment cannot return 500 — the affected section falls back to
defaults and its name is appended to `errors`.

---

### 5.27 Payments

Pool capacity-upgrade payments. Polar (USD) for international, Mercado
Pago (COP) for Colombia. Country detection runs at frontend time via
the dedicated endpoint and is also derivable server-side from the
Cloudflare `CF-IPCountry` header.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/payments/country` | No | Detects the requester's country from Cloudflare headers and returns the recommended gateway (`"polar"` for everyone except CO; `"mercadopago"` for CO). |
| POST | `/payments/checkout` | Yes | Initiate a Polar (USD) checkout for a capacity upgrade. Returns the hosted-checkout URL. Captures Meta Advanced Matching signals (`_fbp`, `_fbc`, IP, UA) so async webhook emissions can attach them to the CAPI Purchase event. |
| POST | `/payments/mp-checkout` | Yes | Initiate a Mercado Pago checkout (COP). Returns a Brick `preferenceId`. Idempotent: a re-entry returns the existing preference instead of creating a duplicate that would race the customer into paying twice. |
| POST | `/payments/mp-process` | Yes | Server-side processing of a Mercado Pago Brick payment. Used by the SPA when the Brick UI submits payment data directly. |
| POST | `/payments/attempts/:paymentId/event` | Yes | Payment-attempt telemetry beacon (MP Brick lifecycle). Returns `202`. |
| GET  | `/payments/pool/:poolId/status` | Yes | Returns the latest `PoolPayment` row for the pool — used by the post-checkout polling loop on `/pago/exitoso`. |

**`POST /payments/checkout` body:**
```json
{ "poolId": "uuid", "targetCapacity": 100, "accountReceivableId": "uuid" }
```

`targetCapacity` is an integer 2–10000. `accountReceivableId` is optional: when the customer pre-paid via a cuenta de cobro, the wizard/expand-capacity tab attaches its id and `paymentService` validates the snapshot against live `pricing.ts` before atomically locking the CC to `REDEEMED` inside the same transaction that creates the `PoolPayment` (ADR-061).

**Response (200):** `{ "checkoutUrl": "https://buy.polar.sh/...", "checkoutId": "..." }`

**`POST /payments/mp-checkout` body:** identical schema to Polar checkout (`poolId`, `targetCapacity`, optional `accountReceivableId`).

**Response (200):** `{ "preferenceId": "...", "amountCop": 28500, "publicKey": "TEST-..." }`

**`POST /payments/mp-process` body:**
```json
{
  "paymentId": "uuid",
  "formData": { ... },
  "metaCookies": { "fbc": "...", "fbp": "..." }
}
```

`formData` is the Brick's native MP payload (accepted permissively, validated server-side). `metaCookies` is optional and only improves Meta CAPI match quality.

**`POST /payments/attempts/:paymentId/event` body:**
```json
{ "eventType": "BRICK_LOADED" | "BRICK_ERROR" | "USER_CLOSED_TAB" | ..., "details": { ... } }
```

The MP Brick lifecycle telemetry surface (ADR-066). `eventType` is one of the `CLIENT_EVENT_TYPES` enum values; `details` is an optional free-form bag. Accepts both `application/json` and `text/plain` bodies (the latter so `navigator.sendBeacon` can flush a `USER_CLOSED_TAB` event on page unload without a CORS preflight; body capped at 8 KB). Ownership is enforced server-side — the service refuses to write events for another user's payment. Events are intentionally NOT deduplicated (each is a forensic row). Returns `202` with `{ "recorded": true }`.

**Errors:** `VALIDATION_ERROR`, `FORBIDDEN` (caller is not the pool's host), `NOT_FOUND` (pool), `CONFLICT` (capacity downgrade or invalid tier), `GATEWAY_ERROR` (Polar/MP rejected the request).

---

### 5.28 Webhooks

Async callbacks from external providers. None of these accept user JWTs
— each verifies the provider's own signature scheme.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/webhook` | Polar signature (`standardwebhooks`) | Polar webhook handler. Mounted with `express.raw()` BEFORE `express.json()` so the signature can be verified against the unparsed body. Handles `order.paid`, `order.refunded`. On `order.paid`: claims `PaymentEvent.polarEventId` UNIQUE inside the same transaction as the `PoolPayment.update` + `Pool.update` so a failure rolls back atomically and the gateway's retry can re-process. Returns 5xx on processing errors so Polar retries; 401 only on signature mismatch. |
| POST | `/payments/mp-webhook` | MP HMAC + timestamp drift | Mercado Pago IPN handler. Validates `x-signature` HMAC and rejects events whose `webhook-timestamp` drifts beyond `MP_WEBHOOK_MAX_DRIFT_MS` (default 5 min). Synthetic event id `mp-{paymentId}-{status}` so `pending → in_process → approved` transitions don't dedupe each other. Same atomic claim + 5xx retry semantics as Polar. |
| POST | `/webhooks/resend` | Resend signature header | Resend webhook for `email.bounced` and `email.complained` events. Inserts a row in `EmailSuppression` so future `sendEmail()` calls short-circuit before hitting Resend. |

**Response on success:** 200 with empty body.
**Response on processing error (any provider):** 5xx (triggers retry).
**Response on signature mismatch:** 401 (terminal).

---

### 5.29 Unsubscribe

Tokenised email unsubscribe surface. The token is delivered in every
notification email's footer link and identifies the user without
requiring login. Unsubscribe is all-or-nothing: both verbs set
`User.emailNotificationsEnabled = false` (there is no per-scope
granularity). The token is read from the query string for both verbs.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/unsubscribe?token=...` | Token (query) | Disables all email notifications for the token's user, then redirects to `${FRONTEND_URL}/unsubscribed`. |
| POST | `/unsubscribe?token=...` | Token (query) | RFC 8058 one-click unsubscribe (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`). Disables all email notifications and returns `{ "unsubscribed": true }`. |

**Errors:** `MISSING_TOKEN` (no `token` query param), `INVALID_TOKEN` (signature/lookup failure), `USER_NOT_FOUND`.
