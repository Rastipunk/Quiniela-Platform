# API Specification — Picks4All Platform

> **Last updated:** 2026-04-04
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

Authentication uses **JWT Bearer tokens** (4-hour expiry) delivered via HTTP-only cookies.

- On successful login/register, the server sets `token` and `token_exists` cookies.
- The `token` cookie is `HttpOnly`, `Secure`, `SameSite=None`.
- The `token_exists` cookie is readable by JavaScript (for UI state).
- On logout, both cookies are cleared.

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
| Corporate invites | `/corporate/pools/*` | 1 hour | 5 | `RATE_LIMIT_CORP_INVITE_WINDOW_MS`, `RATE_LIMIT_CORP_INVITE_MAX` |
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

---

## 5. Endpoints

### 5.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

**Response:**
```json
{ "version": "v0.6.0", "commit": "abc1234", "timestamp": "2026-04-04T12:00:00.000Z" }
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
  "acceptMarketing": false
}
```

**Validation:** email (valid email), username (3-20 chars), displayName (2-50 chars), password (8-200 chars, 1 uppercase + 1 number), acceptTerms/acceptPrivacy/acceptAge (required true).

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
  "acceptMarketing": false
}
```

consent fields are only required if this is a new user registration.

**Response (200):** `{ "user": { id, email, username, displayName, platformRole } }`

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
| GET | `/me/email-preferences` | Yes | Get email notification preferences |
| PUT | `/me/email-preferences` | Yes | Update email notification preferences |

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

#### GET /me/email-preferences

**Response:**
```json
{
  "preferences": {
    "emailNotificationsEnabled": true,
    "emailPoolInvitations": true,
    "emailDeadlineReminders": true,
    "emailResultNotifications": true,
    "emailPoolCompletions": true
  },
  "platformEnabled": {
    "emailPoolInvitations": true,
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
  "emailPoolCompletions": true
}
```

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

Knockout picks support incremental merge: new picks are merged with existing ones, not replaced entirely.

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
| POST | `/corporate/pools/:poolId/send-invitations` | Yes | Send invitation emails to pending employees |
| DELETE | `/corporate/pools/:poolId/employees/:inviteId` | Yes | Remove pending employee |
| GET | `/corporate/csv-template` | No | Download CSV template for employee upload |

#### POST /corporate/inquiry

**Body:**
```json
{
  "companyName": "Acme Corp",
  "contactName": "Maria Garcia",
  "contactEmail": "maria@acme.com",
  "contactPhone": "+573001234567",
  "employeeCount": "51-200",
  "message": "We want to create a pool for our company...",
  "locale": "es"
}
```

#### POST /corporate/pools

**Body:**
```json
{
  "companyName": "Acme Corp",
  "logoBase64": "data:image/png;base64,...",
  "welcomeMessage": "Welcome to our corporate pool!",
  "invitationMessage": "You've been invited to our company pool!",
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

Creates Organization + Pool + PoolMember(CORPORATE_HOST) + CorporateInvites in a transaction.

#### POST /corporate/pools/:poolId/employees

**Body:** `{ "emails": ["emp3@acme.com", "emp4@acme.com"] }`

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

**Body:** `{ "type": "welcome" | "poolInvitation" | "deadlineReminder" | "resultPublished" | "poolCompleted", "to": "test@example.com" }`

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
