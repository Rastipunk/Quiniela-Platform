# API Specification
# Quiniela Platform

> **Version:** 2.0 (v0.4.0 — Next.js Migration + SEO)
> **Last Updated:** 2026-02-22
> **Base URL:** `http://localhost:3000` (development) | `https://api.picks4all.com` (production)
> **Protocol:** REST over HTTP/HTTPS
> **Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Error Handling](#2-error-handling)
3. [Authentication Endpoints](#3-authentication-endpoints)
4. [User Endpoints](#4-user-endpoints)
5. [Catalog Endpoints](#5-catalog-endpoints)
6. [Pool Endpoints](#6-pool-endpoints)
7. [Pick Endpoints](#7-pick-endpoints)
8. [Structural Pick Endpoints](#8-structural-pick-endpoints)
9. [Group Standings Endpoints](#9-group-standings-endpoints)
10. [Result Endpoints](#10-result-endpoints)
11. [Structural Result Endpoints](#11-structural-result-endpoints)
12. [Scoring Breakdown Endpoints](#12-scoring-breakdown-endpoints)
13. [Pick Presets Endpoints](#13-pick-presets-endpoints)
14. [Legal Document Endpoints](#14-legal-document-endpoints)
15. [Feedback Endpoints](#15-feedback-endpoints)
16. [Admin General Endpoints](#16-admin-general-endpoints)
17. [Admin Template Endpoints](#17-admin-template-endpoints)
18. [Admin Instance Endpoints](#18-admin-instance-endpoints)
19. [Admin Sync Endpoints](#19-admin-sync-endpoints)
20. [Admin Settings Endpoints](#20-admin-settings-endpoints)

---

## 1. Authentication

### 1.1 Authentication Method

**All authenticated endpoints require a JWT token in the Authorization header:**

```http
Authorization: Bearer <jwt-token>
```

**Token Details:**
- **Algorithm:** HS256 (HMAC SHA-256)
- **Expiry:** 4 hours from issuance
- **Issuer:** Quiniela Platform
- **Payload:**
  ```json
  {
    "userId": "uuid",
    "platformRole": "PLAYER" | "HOST" | "ADMIN",
    "iat": 1234567890,
    "exp": 1234582290
  }
  ```

### 1.2 Token Acquisition

Tokens are obtained via:
- `POST /auth/register` (returns token after registration)
- `POST /auth/login` (returns token after login)
- `POST /auth/google` (returns token after Google OAuth)

### 1.3 Token Expiry Handling

**When token expires or is invalid:**
- API returns `401 UNAUTHENTICATED`
- Frontend must clear token and redirect to login page
- User must re-authenticate

**Refresh Tokens:** Not implemented in v0.1-alpha (planned for v1.1)

---

## 2. Error Handling

### 2.1 Error Response Format

**All errors return JSON with this structure:**

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}  // Optional, for validation errors
}
```

### 2.2 HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, POST (non-creation) |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing/invalid/expired token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Business rule violation (e.g., deadline passed) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | External dependency unavailable |

### 2.3 Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | Token missing, invalid, or expired |
| `FORBIDDEN` | 403 | User lacks permission for action |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `CONFLICT` | 409 | Business rule conflict (e.g., duplicate, deadline passed) |
| `DEADLINE_PASSED` | 409 | Cannot modify pick after deadline |
| `REASON_REQUIRED_FOR_ERRATA` | 400 | Errata requires reason field |
| `CONSENT_REQUIRED` | 400 | Legal consent not provided |
| `AGE_VERIFICATION_REQUIRED` | 400 | Age verification not confirmed |
| `GOOGLE_ACCOUNT` | 400 | Password reset not available for Google-only accounts |
| `INVALID_TOKEN` | 400 | Reset/verification token is invalid or expired |
| `ALREADY_VERIFIED` | 400 | Email is already verified |
| `BANNED_FROM_POOL` | 403 | User is permanently banned from pool |
| `MATCH_PENDING` | 409 | Cannot make picks on matches with undetermined teams |
| `RATE_LIMITED` | 429 | Too many requests |

### 2.4 Validation Error Details

**When validation fails (Zod errors):**

```json
{
  "error": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email format"],
      "password": ["Password must be at least 8 characters"]
    },
    "formErrors": []
  }
}
```

---

## 3. Authentication Endpoints

### 3.1 Register

**Create a new user account.**

**Endpoint:** `POST /auth/register`

**Authentication:** None (public)

**Rate Limit:** 10 requests / 15 minutes (auth limiter)

**Request Body:**

```json
{
  "email": "user@example.com",
  "username": "juank",
  "displayName": "Juan Carlos",
  "password": "SecurePass123!",
  "timezone": "America/Mexico_City",
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `username`: 3-20 characters, alphanumeric + underscores only, unique, lowercase normalized
- `displayName`: 2-50 characters
- `password`: 8-200 characters
- `timezone`: IANA timezone string (optional)
- `acceptTerms`: boolean, **required** (must be `true`)
- `acceptPrivacy`: boolean, **required** (must be `true`)
- `acceptAge`: boolean, **required** (must be `true`, confirms 13+ years old)
- `acceptMarketing`: boolean (optional, default `false`)

**Success Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "username": "juank",
    "displayName": "Juan Carlos",
    "platformRole": "PLAYER",
    "status": "ACTIVE",
    "timezone": "America/Mexico_City",
    "createdAtUtc": "2026-01-02T10:00:00.000Z"
  },
  "emailVerificationSent": true,
  "message": "Te hemos enviado un email de verificacion. Por favor revisa tu bandeja de entrada."
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `VALIDATION_ERROR` | 400 | Fields fail Zod validation |
| `CONSENT_REQUIRED` | 400 | `acceptTerms` or `acceptPrivacy` is `false` |
| `AGE_VERIFICATION_REQUIRED` | 400 | `acceptAge` is `false` |
| `CONFLICT` | 409 | Email or username already exists |

**Notes:**
- Password is hashed with bcrypt (salt rounds = 10) before storage
- Username is normalized to lowercase and trimmed
- Reserved usernames are blocked (admin, system, null, undefined, root, api, test)
- A verification email is sent asynchronously (does not block response)
- Email is marked as unverified (`emailVerified: false`) until user clicks verification link
- Legal consent timestamps and versions are recorded
- Audit event `USER_REGISTERED` is logged

---

### 3.2 Login

**Authenticate existing user.**

**Endpoint:** `POST /auth/login`

**Authentication:** None (public)

**Rate Limit:** 10 requests / 15 minutes (auth limiter)

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "username": "juank",
    "displayName": "Juan Carlos",
    "platformRole": "PLAYER",
    "status": "ACTIVE"
  }
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `VALIDATION_ERROR` | 400 | Missing or malformed fields |
| `UNAUTHENTICATED` | 401 | Invalid credentials or account not ACTIVE |

**Notes:**
- Email is case-insensitive (normalized to lowercase)
- Audit event `USER_LOGGED_IN` is logged (with IP, user-agent)

---

### 3.3 Forgot Password

**Request password reset email.**

**Endpoint:** `POST /auth/forgot-password`

**Authentication:** None (public)

**Rate Limit:** 5 requests / 15 minutes (password reset limiter)

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "message": "Si el email existe, recibiras un enlace para restablecer tu contrasena"
}
```

**Error Response (400) - Google-only Account:**

```json
{
  "error": "GOOGLE_ACCOUNT",
  "message": "Esta cuenta utiliza Google para iniciar sesion. Por favor, usa el boton 'Iniciar con Google' en la pagina de login."
}
```

**Notes:**
- Returns same success message whether email exists or not (prevents email enumeration)
- Exception: Google-only accounts return a specific error for better UX
- If email exists and user is ACTIVE, generates secure reset token (32 bytes hex)
- Token expires in 1 hour
- Sends email via Resend with reset link
- Audit event `PASSWORD_RESET_REQUESTED` is logged

---

### 3.4 Reset Password

**Reset password using valid token.**

**Endpoint:** `POST /auth/reset-password`

**Authentication:** None (public)

**Rate Limit:** 5 requests / 15 minutes (password reset limiter)

**Request Body:**

```json
{
  "token": "6cfa02b4ec5f7d9f79fb1d153acfbfd8d5c5546bbd46f6d4a08e8d44411ea1fe",
  "newPassword": "NewSecurePass123!"
}
```

**Success Response (200):**

```json
{
  "message": "Contrasena actualizada exitosamente"
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `INVALID_TOKEN` | 400 | Token invalid or expired |
| `VALIDATION_ERROR` | 400 | Password fails validation |

**Notes:**
- Token must be valid and not expired (< 1 hour old)
- User must have status `ACTIVE`
- Password must meet validation requirements (min 8 chars)
- Token is cleared after successful reset (single-use)
- Audit event `PASSWORD_RESET_COMPLETED` is logged

---

### 3.5 Google OAuth

**Authenticate or register user via Google OAuth.**

**Endpoint:** `POST /auth/google`

**Authentication:** None (public)

**Request Body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "timezone": "America/Mexico_City",
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false
}
```

**Fields:**
- `idToken`: Google ID token (required)
- `timezone`: IANA timezone auto-detected from browser (optional)
- `acceptTerms/acceptPrivacy/acceptAge`: **Required only for new users** (first-time registration)
- `acceptMarketing`: Optional, default `false`

**Success Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@gmail.com",
    "username": "user_gmail",
    "displayName": "John Doe",
    "platformRole": "PLAYER",
    "status": "ACTIVE"
  }
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `INVALID_TOKEN` | 401 | Google ID token verification failed |
| `FORBIDDEN` | 403 | User account is not ACTIVE |
| `CONSENT_REQUIRED` | 400 | New user without legal consent (returns `requiresConsent: true`) |
| `AGE_VERIFICATION_REQUIRED` | 400 | New user without age confirmation |

**Flow:**
1. Frontend receives ID token from Google Sign In
2. Backend verifies token with Google's API (`google-auth-library`)
3. Extracts user info (googleId, email, name, picture)
4. **If user exists by email or googleId:**
   - Login existing user (no consent fields needed)
   - If email exists but no googleId: link Google account
   - Audit event: `LOGIN_GOOGLE` or `GOOGLE_ACCOUNT_LINKED`
5. **If user doesn't exist:**
   - Requires `acceptTerms`, `acceptPrivacy`, `acceptAge`
   - Create new user with auto-generated username (from email)
   - `emailVerified: true` (Google already verified email)
   - Send welcome email asynchronously
   - Audit event: `REGISTER_GOOGLE`
6. Return JWT token (same as email/password login)

**Notes:**
- Google ID token is verified server-side (never trust frontend-only validation)
- Username auto-generated from email local part (e.g., `juan_chacon` from `juan.chacon@gmail.com`)
- If username collision, append number (`juan_chacon1`, `juan_chacon2`)
- OAuth users can still use forgot password to set a password
- Account linking is automatic if emails match

---

### 3.6 Verify Email

**Verify user's email address using a token.**

**Endpoint:** `GET /auth/verify-email?token=<token>`

**Authentication:** None (public)

**Query Parameters:**
- `token` (string, required): Email verification token

**Success Response (200) - First verification:**

```json
{
  "message": "Email verificado exitosamente! Ya puedes disfrutar de todas las funciones.",
  "verified": true
}
```

**Success Response (200) - Already verified:**

```json
{
  "message": "Tu email ya estaba verificado.",
  "alreadyVerified": true
}
```

**Error Response (400):**

```json
{
  "error": "INVALID_TOKEN",
  "message": "El enlace de verificacion es invalido o ha expirado. Solicita un nuevo enlace desde tu perfil."
}
```

**Notes:**
- Token is a 32-byte hex string
- Token expires after 24 hours
- After verification, token is cleared from the database
- Audit event `EMAIL_VERIFIED` is logged

---

### 3.7 Resend Verification Email

**Resend the email verification link.**

**Endpoint:** `POST /auth/resend-verification`

**Authentication:** Required

**Request Body:** None

**Success Response (200):**

```json
{
  "message": "Email de verificacion enviado. Revisa tu bandeja de entrada (y spam)."
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `USER_NOT_FOUND` | 404 | User not found |
| `ALREADY_VERIFIED` | 400 | Email is already verified |
| `EMAIL_SEND_FAILED` | 500 | Failed to send email |

**Notes:**
- Generates a new verification token (invalidates any previous token)
- New token expires after 24 hours
- Audit event `VERIFICATION_EMAIL_RESENT` is logged

---

## 4. User Endpoints

### 4.1 Get My Pools

**Get list of pools where user is an active or pending member.**

**Endpoint:** `GET /me/pools`

**Authentication:** Required

**Success Response (200):**

```json
[
  {
    "poolId": "pool-uuid-1",
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z",
    "pool": {
      "id": "pool-uuid-1",
      "name": "Office Friends WC2026",
      "description": "World Cup predictions with the office crew",
      "visibility": "PRIVATE",
      "status": "ACTIVE",
      "timeZone": "America/Mexico_City",
      "deadlineMinutesBeforeKickoff": 10,
      "tournamentInstanceId": "instance-uuid",
      "scoringPresetKey": "CLASSIC",
      "createdAtUtc": "2026-01-02T09:00:00.000Z",
      "updatedAtUtc": "2026-01-02T09:00:00.000Z"
    },
    "tournamentInstance": {
      "id": "instance-uuid",
      "name": "World Cup 2026 (Sandbox Instance)",
      "status": "ACTIVE",
      "templateId": "template-uuid",
      "templateVersionId": "version-uuid",
      "createdAtUtc": "2024-12-29T10:00:00.000Z",
      "updatedAtUtc": "2024-12-29T10:00:00.000Z"
    }
  }
]
```

**Notes:**
- Returns pools where member status is `ACTIVE` or `PENDING_APPROVAL`
- Ordered by `joinedAtUtc DESC` (most recent first)

---

### 4.2 Get My Profile

**Get full profile of the authenticated user.**

**Endpoint:** `GET /users/me/profile`

**Authentication:** Required

**Success Response (200):**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "username": "juank",
    "displayName": "Juan Carlos",
    "platformRole": "PLAYER",
    "status": "ACTIVE",
    "firstName": "Juan",
    "lastName": "Carlos",
    "dateOfBirth": "1990-05-15T00:00:00.000Z",
    "gender": "MALE",
    "bio": "Football fan",
    "country": "MX",
    "timezone": "America/Mexico_City",
    "lastUsernameChangeAt": null,
    "createdAtUtc": "2026-01-02T10:00:00.000Z",
    "updatedAtUtc": "2026-01-02T10:00:00.000Z",
    "isGoogleAccount": false
  }
}
```

---

### 4.3 Update My Profile

**Update the authenticated user's profile.**

**Endpoint:** `PATCH /users/me/profile`

**Authentication:** Required

**Request Body (all fields optional):**

```json
{
  "displayName": "Juan Carlos R.",
  "username": "juank_new",
  "firstName": "Juan",
  "lastName": "Carlos",
  "dateOfBirth": "1990-05-15T00:00:00.000Z",
  "gender": "MALE",
  "bio": "Football fan and pick expert",
  "country": "MX",
  "timezone": "America/Mexico_City"
}
```

**Validation Rules:**
- `displayName`: 1-100 characters
- `username`: 3-20 characters, alphanumeric + underscores only. Can only be changed once every 30 days.
- `firstName`: 1-50 characters (nullable)
- `lastName`: 1-50 characters (nullable)
- `dateOfBirth`: ISO 8601 datetime string (nullable). User must be at least 13 years old.
- `gender`: One of `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` (nullable)
- `bio`: Max 200 characters (nullable)
- `country`: ISO 3166-1 alpha-2 code (nullable)
- `timezone`: IANA timezone string (nullable)

**Success Response (200):**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "juank_new",
    "displayName": "Juan Carlos R.",
    ...
  }
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `VALIDATION_ERROR` | 400 | Invalid field values |
| `USERNAME_TAKEN` | 400 | Username already in use |
| `USERNAME_CHANGE_TOO_SOON` | 400 | Username changed less than 30 days ago |
| `AGE_TOO_YOUNG` | 400 | User must be at least 13 years old |
| `AGE_INVALID` | 400 | Invalid date of birth |

**Notes:**
- Audit event `PROFILE_UPDATED` logged
- Username change also logs `USERNAME_CHANGED` audit event

---

### 4.4 Get Email Preferences

**Get the user's email notification preferences.**

**Endpoint:** `GET /me/email-preferences`

**Authentication:** Required

**Success Response (200):**

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
    "emailDeadlineReminders": true,
    "emailResultNotifications": true,
    "emailPoolCompletions": true
  },
  "descriptions": {
    "emailNotificationsEnabled": "Recibir notificaciones por email (excepto recuperacion de contrasena)",
    "emailPoolInvitations": "Invitaciones a quinielas",
    "emailDeadlineReminders": "Recordatorios de deadline para hacer pronosticos",
    "emailResultNotifications": "Notificaciones de resultados publicados",
    "emailPoolCompletions": "Notificaciones de quinielas finalizadas"
  }
}
```

**Notes:**
- `platformEnabled` indicates which email types the platform admin has globally enabled
- If a type is disabled at platform level, the user cannot receive it even if their preference is `true`

---

### 4.5 Update Email Preferences

**Update the user's email notification preferences.**

**Endpoint:** `PUT /me/email-preferences`

**Authentication:** Required

**Request Body (all fields optional, at least one required):**

```json
{
  "emailNotificationsEnabled": true,
  "emailPoolInvitations": true,
  "emailDeadlineReminders": false,
  "emailResultNotifications": true,
  "emailPoolCompletions": true
}
```

**Success Response (200):**

```json
{
  "message": "Preferencias de email actualizadas exitosamente.",
  "preferences": {
    "emailNotificationsEnabled": true,
    "emailPoolInvitations": true,
    "emailDeadlineReminders": false,
    "emailResultNotifications": true,
    "emailPoolCompletions": true
  }
}
```

---

## 5. Catalog Endpoints

### 5.1 List Tournament Instances

**Get list of active tournament instances available for pool creation.**

**Endpoint:** `GET /catalog/instances`

**Authentication:** Required

**Success Response (200):**

```json
[
  {
    "id": "instance-uuid",
    "name": "UCL 2025-26",
    "status": "ACTIVE",
    "templateId": "template-uuid",
    "templateVersionId": "version-uuid",
    "createdAtUtc": "2026-01-15T10:00:00.000Z",
    "updatedAtUtc": "2026-01-15T10:00:00.000Z",
    "template": {
      "id": "template-uuid",
      "key": "ucl-2025",
      "name": "UEFA Champions League 2025-26",
      "status": "PUBLISHED",
      "currentPublishedVersionId": "version-uuid"
    }
  }
]
```

**Notes:**
- Only returns instances with `status = ACTIVE`
- Includes template metadata (not full `dataJson`)
- Used in frontend "Create Pool" flow

---

### 5.2 Get Instance Phases

**Get the phases defined in a tournament instance.**

**Endpoint:** `GET /catalog/instances/:instanceId/phases`

**Authentication:** Required

**Success Response (200):**

```json
{
  "phases": [
    {
      "id": "group_stage",
      "name": "Fase de Grupos",
      "type": "GROUP",
      "order": 1
    },
    {
      "id": "round_of_32",
      "name": "Dieciseisavos de Final",
      "type": "KNOCKOUT",
      "order": 2
    }
  ]
}
```

---

## 6. Pool Endpoints

### 6.1 Create Pool

**Create a new pool.**

**Endpoint:** `POST /pools`

**Authentication:** Required

**Request Body:**

```json
{
  "tournamentInstanceId": "instance-uuid",
  "name": "Office Friends WC2026",
  "description": "World Cup predictions with the office crew",
  "timeZone": "America/Mexico_City",
  "deadlineMinutesBeforeKickoff": 10,
  "scoringPresetKey": "CLASSIC",
  "requireApproval": false,
  "pickTypesConfig": "CUMULATIVE"
}
```

**Field Details:**

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `tournamentInstanceId` | string | yes | - | Must exist and not be ARCHIVED |
| `name` | string | yes | - | 3-120 characters |
| `description` | string | no | null | Max 500 characters |
| `timeZone` | string | no | "UTC" | IANA timezone |
| `deadlineMinutesBeforeKickoff` | number | no | 10 | 0-1440 |
| `scoringPresetKey` | enum | no | "CLASSIC" | "CLASSIC" \| "OUTCOME_ONLY" \| "EXACT_HEAVY" |
| `requireApproval` | boolean | no | false | If true, join requests need HOST/CO_ADMIN approval |
| `pickTypesConfig` | string or object | no | null | Preset key ("BASIC" \| "SIMPLE" \| "CUMULATIVE") or custom PhasePickConfig array |

**Success Response (201):** Pool object with all fields

**Notes:**
- Creator automatically becomes HOST
- A `fixtureSnapshot` is copied from the tournament instance (each pool has its own copy)
- If `pickTypesConfig` is a preset string, it's dynamically expanded using the instance's phases
- Audit event `POOL_CREATED` logged

---

### 6.2 Get Pool Details

**Get basic pool information.**

**Endpoint:** `GET /pools/:poolId`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
{
  "pool": {
    "id": "pool-uuid",
    "name": "Office Friends WC2026",
    "description": "...",
    "visibility": "PRIVATE",
    "status": "ACTIVE",
    "timeZone": "America/Mexico_City",
    "deadlineMinutesBeforeKickoff": 10,
    "tournamentInstanceId": "instance-uuid",
    "createdByUserId": "user-uuid",
    "createdAtUtc": "...",
    "updatedAtUtc": "...",
    "scoringPresetKey": "CLASSIC",
    "autoAdvanceEnabled": true,
    "requireApproval": false
  },
  "myMembership": {
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "..."
  },
  "counts": {
    "membersActive": 5
  },
  "tournamentInstance": { ... },
  "permissions": {
    "canManageResults": true,
    "canInvite": true
  }
}
```

---

### 6.3 Get Pool Overview (Single-Call Endpoint)

**Get comprehensive pool data: matches, picks, results, leaderboard in ONE call.**

**Endpoint:** `GET /pools/:poolId/overview`

**Authentication:** Required (must be active member)

**Query Parameters:**
- `leaderboardVerbose` (optional): `"1"` or `"true"` to include per-match breakdown

**Success Response (200):** Comprehensive object containing:
- `nowUtc`: Server time
- `pool`: Pool configuration + `pickTypesConfig` + `lockedPhases`
- `myMembership`: Current user's membership details
- `counts`: `{ membersActive }`
- `tournamentInstance`: Instance data + `templateKey` + `dataJson` (uses fixtureSnapshot)
- `permissions`: `{ canManageResults, canInvite }`
- `matches[]`: Each match with `deadlineUtc`, `isLocked`, `homeTeam`, `awayTeam`, `myPick`, `result`
- `leaderboard`: Scoring preset info + `phases[]` + `rows[]` (rank, points, pointsByPhase, structuralPickPoints, breakdown)

**Notes:**
- **Optimized endpoint:** Reduces frontend API calls from many to 1
- `isLocked` calculated per match based on current server time
- Leaderboard includes both match pick points and structural pick points
- `pointsByPhase` provides per-phase breakdown for columnar display
- Uses `fixtureSnapshot` (pool's own copy) for match data, with fallback to instance `dataJson`

---

### 6.4 Get Pool Members

**Get list of all pool members.**

**Endpoint:** `GET /pools/:poolId/members`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
[
  {
    "id": "member-uuid",
    "userId": "user-uuid",
    "displayName": "Juan Carlos",
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z"
  }
]
```

---

### 6.5 Get Pending Members

**Get list of members awaiting approval.**

**Endpoint:** `GET /pools/:poolId/pending-members`

**Authentication:** Required (HOST or CO_ADMIN only)

**Success Response (200):**

```json
{
  "ok": true,
  "pendingMembers": [
    {
      "id": "member-uuid",
      "userId": "user-uuid",
      "username": "player1",
      "displayName": "Player One",
      "email": "player1@example.com",
      "requestedAt": "2026-01-02T10:00:00.000Z"
    }
  ]
}
```

---

### 6.6 Approve Member

**Approve a pending join request.**

**Endpoint:** `POST /pools/:poolId/members/:memberId/approve`

**Authentication:** Required (HOST or CO_ADMIN only)

**Request Body:** None

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Member approved successfully"
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `FORBIDDEN` | 403 | Not HOST or CO_ADMIN |
| `NOT_FOUND` | 404 | Member not found |
| `CONFLICT` | 409 | Member is not pending approval |

**Notes:**
- May trigger pool transition from DRAFT to ACTIVE
- Audit event `JOIN_REQUEST_APPROVED` logged

---

### 6.7 Reject Member

**Reject a pending join request.**

**Endpoint:** `POST /pools/:poolId/members/:memberId/reject`

**Authentication:** Required (HOST or CO_ADMIN only)

**Request Body (optional):**

```json
{
  "reason": "Pool is full"
}
```

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Member rejected successfully"
}
```

**Notes:**
- Rejected members are deleted (can re-apply)
- Audit event `JOIN_REQUEST_REJECTED` logged

---

### 6.8 Kick Member

**Remove a member from the pool (temporary -- they can re-join).**

**Endpoint:** `POST /pools/:poolId/members/:memberId/kick`

**Authentication:** Required (HOST or CO_ADMIN only)

**Request Body (optional):**

```json
{
  "reason": "Inactive player"
}
```

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Member kicked successfully"
}
```

**Notes:**
- Sets member status to `LEFT`
- Cannot kick yourself or the pool creator
- Only active members can be kicked
- Audit event `MEMBER_KICKED` logged

---

### 6.9 Ban Member

**Permanently ban a member from the pool.**

**Endpoint:** `POST /pools/:poolId/members/:memberId/ban`

**Authentication:** Required (HOST or CO_ADMIN only)

**Request Body:**

```json
{
  "reason": "Repeated misconduct",
  "deletePicks": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | yes | Reason for ban (min 1 char) |
| `deletePicks` | boolean | no | If true, delete all of the user's picks |

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Member permanently banned and 5 picks deleted"
}
```

**Notes:**
- Sets member status to `BANNED` (permanent, cannot re-join)
- Cannot ban yourself or the pool creator
- Optionally deletes the user's picks from this pool
- Audit event `MEMBER_BANNED` logged

---

### 6.10 Promote Member to Co-Admin

**Promote a PLAYER to CO_ADMIN role.**

**Endpoint:** `POST /pools/:poolId/members/:memberId/promote`

**Authentication:** Required (HOST only)

**Request Body:** None

**Success Response (200):**

```json
{
  "success": true,
  "member": {
    "id": "member-uuid",
    "role": "CO_ADMIN",
    "user": {
      "id": "user-uuid",
      "email": "player@example.com",
      "displayName": "Player One"
    }
  }
}
```

**Notes:**
- Only the HOST can promote members
- Only ACTIVE PLAYERs can be promoted
- Audit event `MEMBER_PROMOTED_TO_CO_ADMIN` logged

---

### 6.11 Demote Co-Admin to Player

**Demote a CO_ADMIN back to PLAYER role.**

**Endpoint:** `POST /pools/:poolId/members/:memberId/demote`

**Authentication:** Required (HOST only)

**Request Body:** None

**Success Response (200):**

```json
{
  "success": true,
  "member": {
    "id": "member-uuid",
    "role": "PLAYER",
    "user": { ... }
  }
}
```

**Notes:**
- Only the HOST can demote co-admins
- Audit event `MEMBER_DEMOTED_FROM_CO_ADMIN` logged

---

### 6.12 Create Invite Code

**Generate a new invite code for the pool.**

**Endpoint:** `POST /pools/:poolId/invites`

**Authentication:** Required (HOST or CO_ADMIN)

**Request Body (both fields optional):**

```json
{
  "maxUses": 10,
  "expiresAtUtc": "2026-06-30T23:59:59.000Z"
}
```

**Success Response (201):** PoolInvite object

**Notes:**
- Code generated via `crypto.randomBytes(6).toString('hex')` (12 chars)
- Pool must be in a status that allows invites (DRAFT or ACTIVE)
- Audit event `POOL_INVITE_CREATED` logged

---

### 6.13 Send Invite Email

**Send a pool invitation email to a specific person.**

**Endpoint:** `POST /pools/:poolId/send-invite-email`

**Authentication:** Required (HOST or CO_ADMIN)

**Request Body:**

```json
{
  "email": "invitee@example.com",
  "inviteCode": "a3f9c2d8e1b4"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Invitacion enviada exitosamente.",
  "skipped": false
}
```

**Notes:**
- Validates that the invite code belongs to this pool
- Respects the recipient's email notification preferences (if registered user)
- `skipped: true` if the user has disabled pool invitation emails
- Audit event `POOL_INVITE_EMAIL_SENT` logged

---

### 6.14 Join Pool

**Join a pool using an invite code.**

**Endpoint:** `POST /pools/join`

**Authentication:** Required

**Request Body:**

```json
{
  "code": "a3f9c2d8e1b4"
}
```

**Success Response (200):**

```json
{
  "ok": true,
  "poolId": "pool-uuid",
  "status": "ACTIVE",
  "message": "Successfully joined the pool."
}
```

Or if pool requires approval:

```json
{
  "ok": true,
  "poolId": "pool-uuid",
  "status": "PENDING_APPROVAL",
  "message": "Join request submitted. Awaiting approval from pool administrator."
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `NOT_FOUND` | 404 | Invite code not found |
| `CONFLICT` | 409 | Invite expired, maxUses reached, or pool not accepting members |
| `BANNED_FROM_POOL` | 403 | User is permanently banned from this pool |

**Notes:**
- If `requireApproval` is enabled, sets status to `PENDING_APPROVAL`
- Users who previously LEFT can re-join
- Increments `PoolInvite.uses` counter
- Audit event `POOL_JOINED` or `JOIN_REQUEST_SUBMITTED` logged
- May trigger pool DRAFT -> ACTIVE transition

---

### 6.15 Update Pool Settings

**Update pool configuration.**

**Endpoint:** `PATCH /pools/:poolId/settings`

**Authentication:** Required (HOST only)

**Request Body (all fields optional):**

```json
{
  "autoAdvanceEnabled": true,
  "requireApproval": false
}
```

**Success Response (200):**

```json
{
  "success": true,
  "pool": {
    "id": "pool-uuid",
    "autoAdvanceEnabled": true,
    "requireApproval": false
  }
}
```

---

### 6.16 Manual Advance Phase

**Manually trigger tournament phase advancement.**

**Endpoint:** `POST /pools/:poolId/advance-phase`

**Authentication:** Required (HOST only)

**Request Body:**

```json
{
  "currentPhaseId": "group_stage",
  "nextPhaseId": "round_of_32"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPhaseId` | string | yes | Phase to advance from |
| `nextPhaseId` | string | no | Phase to advance to (auto-derived if omitted) |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Avance manual exitoso: group_stage -> round_of_32",
  "data": { ... }
}
```

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `FORBIDDEN` | 403 | Not HOST |
| `PHASE_INCOMPLETE` | 400 | Phase has incomplete matches |
| `INVALID_PHASE` | 400 | Cannot determine next phase |
| `ADVANCEMENT_FAILED` | 400 | Advancement logic failed |

**Notes:**
- Validates all matches in phase have published results
- Group stage: Calculates standings, ranks third-place teams, advances qualifiers
- Knockout phases: Advances winners to next round
- Updates placeholder matches with actual team IDs
- Next phase is auto-derived from tournament data phase order (with WC-style fallback)

---

### 6.17 Lock/Unlock Phase

**Lock or unlock a tournament phase to prevent/allow auto-advancement.**

**Endpoint:** `POST /pools/:poolId/lock-phase`

**Authentication:** Required (HOST only)

**Request Body:**

```json
{
  "phaseId": "group_stage",
  "locked": true
}
```

**Success Response (200):**

```json
{
  "success": true,
  "pool": {
    "id": "pool-uuid",
    "lockedPhases": ["group_stage"]
  }
}
```

---

### 6.18 Archive Pool

**Archive a completed pool.**

**Endpoint:** `POST /pools/:poolId/archive`

**Authentication:** Required (HOST only)

**Request Body:** None

**Success Response (200):**

```json
{
  "success": true
}
```

**Notes:**
- Pool must be in COMPLETED status to archive
- Transitions pool to ARCHIVED status

---

### 6.19 Get Pool Notifications

**Get notification data for a pool (badges, pending actions).**

**Endpoint:** `GET /pools/:poolId/notifications`

**Authentication:** Required (must be active member)

**Success Response (200):** Object with notification counts and pending items

**Notes:**
- Used by frontend for notification badges on pool tabs
- Includes counts of pending results, picks to make, etc.

---

### 6.20 Get Player Summary

**Get a player's detailed scoring summary.**

**Endpoint:** `GET /pools/:poolId/players/:userId/summary`

**Authentication:** Required (must be active member)

**Success Response (200):** Detailed breakdown of the player's points, picks, and performance

---

## 7. Pick Endpoints

### 7.1 List Matches with Deadlines

**Get all matches in pool with deadline/lock status.**

**Endpoint:** `GET /pools/:poolId/matches`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
{
  "pool": {
    "id": "pool-uuid",
    "name": "Office Friends WC2026",
    "timeZone": "America/Mexico_City",
    "deadlineMinutesBeforeKickoff": 10,
    "tournamentInstanceId": "instance-uuid"
  },
  "nowUtc": "2026-01-02T15:00:00.000Z",
  "matches": [
    {
      "id": "m1",
      "phaseId": "group_stage",
      "kickoffUtc": "2026-06-11T18:00:00.000Z",
      "homeTeamId": "t_A1",
      "awayTeamId": "t_A2",
      "matchNumber": 1,
      "roundLabel": "Group A - Matchday 1",
      "venue": "Estadio Azteca",
      "groupId": "A",
      "deadlineUtc": "2026-06-11T17:50:00.000Z",
      "isLocked": false
    }
  ]
}
```

---

### 7.2 Submit/Update Pick

**Create or update user's pick for a match.**

**Endpoint:** `PUT /pools/:poolId/picks/:matchId`

**Authentication:** Required (must be active member)

**Request Body (3 pick types):**

**Type 1: SCORE**
```json
{
  "pick": {
    "type": "SCORE",
    "homeGoals": 2,
    "awayGoals": 1
  }
}
```

**Type 2: OUTCOME**
```json
{
  "pick": {
    "type": "OUTCOME",
    "outcome": "HOME"
  }
}
```

**Type 3: WINNER**
```json
{
  "pick": {
    "type": "WINNER",
    "winnerTeamId": "t_A1"
  }
}
```

**Validation:**
- `type` must be "SCORE", "OUTCOME", or "WINNER"
- `homeGoals`, `awayGoals`: 0-99 integers
- `outcome`: "HOME", "DRAW", or "AWAY"
- `winnerTeamId`: 1-50 character string
- Cannot pick on placeholder matches (teams with TBD/W_/RU_/L_/3rd_ prefixes)

**Error Responses:**

| Code | HTTP | Condition |
|------|------|-----------|
| `DEADLINE_PASSED` | 409 | Cannot modify pick after deadline |
| `NOT_FOUND` | 404 | Match not found in snapshot |
| `FORBIDDEN` | 403 | Not a member of this pool |
| `CONFLICT` | 409 | Pool status doesn't allow picks, or instance archived |
| `MATCH_PENDING` | 409 | Teams not yet determined |

**Notes:**
- Upsert operation (creates if not exists, updates if exists)
- **IMPORTANT:** Frontend must convert number inputs (strings) to actual numbers before sending
- Audit event `PREDICTION_UPSERTED` logged

---

### 7.3 Get My Picks

**Get all picks submitted by current user in pool.**

**Endpoint:** `GET /pools/:poolId/picks`

**Authentication:** Required (must be active member)

**Success Response (200):** Array of Prediction objects

---

### 7.4 Get All Picks for a Match (Post-Deadline)

**Get picks from all users for a specific match.**

**Endpoint:** `GET /pools/:poolId/matches/:matchId/picks`

**Authentication:** Required (must be active member)

**Success Response (200) - Before deadline:**

```json
{
  "matchId": "m1",
  "deadlineUtc": "2026-06-11T17:50:00.000Z",
  "isUnlocked": false,
  "message": "Deadline not passed yet. Only your pick is visible.",
  "picks": [
    {
      "userId": "user-uuid",
      "displayName": "Juan Carlos",
      "pick": { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 },
      "isCurrentUser": true
    }
  ]
}
```

**Success Response (200) - After deadline:**

```json
{
  "matchId": "m1",
  "deadlineUtc": "2026-06-11T17:50:00.000Z",
  "isUnlocked": true,
  "picks": [
    {
      "userId": "user1-uuid",
      "displayName": "Juan Carlos",
      "pick": { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 },
      "isCurrentUser": true
    },
    {
      "userId": "user2-uuid",
      "displayName": "Maria Lopez",
      "pick": { "type": "SCORE", "homeGoals": 1, "awayGoals": 1 },
      "isCurrentUser": false
    }
  ]
}
```

**Notes:**
- Before deadline: only shows current user's pick
- After deadline: shows all active members' picks
- Current user's pick is always first in the list

---

## 8. Structural Pick Endpoints

### 8.1 Submit/Update Structural Pick

**Create or update structural picks for an entire phase (e.g., group standings order, knockout winners).**

**Endpoint:** `PUT /pools/:poolId/structural-picks/:phaseId`

**Authentication:** Required (must be active member)

**Request Body - Group Standings:**

```json
{
  "groups": [
    {
      "groupId": "A",
      "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"]
    },
    {
      "groupId": "B",
      "teamIds": ["t_B2", "t_B1", "t_B3", "t_B4"]
    }
  ]
}
```

**Request Body - Knockout Winners:**

```json
{
  "matches": [
    {
      "matchId": "m_R32_1",
      "winnerId": "t_A1"
    },
    {
      "matchId": "m_R32_2",
      "winnerId": "t_B2"
    }
  ]
}
```

**Success Response (200):** StructuralPrediction object

**Notes:**
- Upsert: creates or updates
- For knockout picks, new picks are merged with existing ones (update individual matches without overwriting others)
- Pool must be in a status that allows picks
- Audit event `STRUCTURAL_PREDICTION_UPSERTED` logged

---

### 8.2 Get Structural Pick for Phase

**Get the current user's structural pick for a specific phase.**

**Endpoint:** `GET /pools/:poolId/structural-picks/:phaseId`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
{
  "pick": {
    "groups": [
      { "groupId": "A", "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"] }
    ]
  }
}
```

Or `{ "pick": null }` if no pick exists.

---

### 8.3 List All Structural Picks

**Get all structural picks for the current user in a pool.**

**Endpoint:** `GET /pools/:poolId/structural-picks`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
{
  "picks": [
    {
      "id": "prediction-uuid",
      "poolId": "pool-uuid",
      "userId": "user-uuid",
      "phaseId": "group_stage",
      "pickJson": { ... },
      "createdAtUtc": "...",
      "updatedAtUtc": "..."
    }
  ]
}
```

---

## 9. Group Standings Endpoints

**Granular per-group picks and results (separate from phase-level structural picks).**

### 9.1 Save Group Standings Pick

**Save/update a pick for a specific group's standings order.**

**Endpoint:** `PUT /pools/:poolId/group-standings/:phaseId/:groupId`

**Authentication:** Required (must be active member)

**Request Body:**

```json
{
  "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"]
}
```

**Notes:**
- `teamIds` must contain exactly 4 team IDs in predicted finishing order (1st to 4th)
- Pool must be in a status that allows picks

---

### 9.2 Get Group Standings Pick

**Get the user's pick for a specific group.**

**Endpoint:** `GET /pools/:poolId/group-standings/:phaseId/:groupId`

**Authentication:** Required (must be active member)

---

### 9.3 Get All Group Standings Picks for Phase

**Get all of the user's group standings picks for a phase.**

**Endpoint:** `GET /pools/:poolId/group-standings/:phaseId`

**Authentication:** Required (must be active member)

---

### 9.4 Publish Group Standings Result

**Publish the official standings result for a specific group.**

**Endpoint:** `PUT /pools/:poolId/group-standings-results/:phaseId/:groupId`

**Authentication:** Required (HOST or CO_ADMIN)

**Request Body:**

```json
{
  "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"]
}
```

---

### 9.5 Get Group Standings Result

**Get the official standings result for a specific group.**

**Endpoint:** `GET /pools/:poolId/group-standings-results/:phaseId/:groupId`

**Authentication:** Required (must be active member)

---

### 9.6 Get All Group Standings Results for Phase

**Get all group standings results for a phase.**

**Endpoint:** `GET /pools/:poolId/group-standings-results/:phaseId`

**Authentication:** Required (must be active member)

---

### 9.7 Auto-Generate Group Standings from Match Results

**Automatically calculate group standings based on published match results.**

**Endpoint:** `POST /pools/:poolId/group-standings-generate/:phaseId/:groupId`

**Authentication:** Required (HOST or CO_ADMIN)

---

### 9.8 Get Group Match Results

**Get all published match results for a specific group.**

**Endpoint:** `GET /pools/:poolId/group-match-results/:groupId`

**Authentication:** Required (must be active member)

---

## 10. Result Endpoints

### 10.1 Publish/Update Result

**Publish match result (or correct it with errata).**

**Endpoint:** `PUT /pools/:poolId/results/:matchId`

**Authentication:** Required (HOST or CO_ADMIN)

**Request Body:**

```json
{
  "homeGoals": 2,
  "awayGoals": 1,
  "homePenalties": 4,
  "awayPenalties": 3,
  "reason": "VAR annulled away goal"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `homeGoals` | number | yes | 0-99, integer |
| `awayGoals` | number | yes | 0-99, integer |
| `homePenalties` | number | no | 0-99, integer (knockout ties only) |
| `awayPenalties` | number | no | 0-99, integer (knockout ties only) |
| `reason` | string | conditional | 1-500 chars, **required if version > 1 or source is HOST_OVERRIDE** |

**Result Source Tracking:**

| Source | Meaning | When |
|--------|---------|------|
| `HOST_MANUAL` | Host published in MANUAL instance | Always for MANUAL mode |
| `HOST_PROVISIONAL` | Host published in AUTO instance, awaiting API | First publish in AUTO mode |
| `API_CONFIRMED` | Result confirmed by API-Football | Set by sync service |
| `HOST_OVERRIDE` | Host corrected an API result (requires reason) | Overriding API in AUTO mode |

**Notes:**
- First publication (version 1): `reason` optional
- Correction (version 2+): `reason` **required**
- HOST_OVERRIDE: `reason` **required**
- All versions retained (immutable audit trail)
- **Auto-Advance Trigger:** After publishing, if auto-advance is enabled and all phase matches complete, tournament advances automatically (unless phase is locked)
- **Pool Completion:** After publishing, checks if all matches have results to transition pool to COMPLETED
- **Email Notifications:** Sends result notification emails to all pool members asynchronously
- Audit event `RESULT_PUBLISHED` logged

---

### 10.2 Get Leaderboard

**Get pool leaderboard with optional verbose breakdown.**

**Endpoint:** `GET /pools/:poolId/leaderboard`

**Authentication:** Required (must be active member)

**Query Parameters:**
- `verbose` (optional): `"1"` or `"true"` for per-match breakdown

**Success Response (200):**

```json
{
  "pool": { "id": "pool-uuid", "name": "..." },
  "scoring": { "outcomePoints": 3, "exactScoreBonus": 2 },
  "updatedAtUtc": "2026-01-02T15:00:00.000Z",
  "verbose": false,
  "leaderboard": [
    {
      "rank": 1,
      "userId": "user1-uuid",
      "displayName": "Juan Carlos",
      "role": "HOST",
      "points": 42,
      "scoredMatches": 15,
      "joinedAtUtc": "2026-01-02T10:00:00.000Z"
    }
  ]
}
```

**Sorting Logic:**
1. **Primary:** `points` DESC
2. **Tiebreaker:** `joinedAtUtc` ASC (earliest member wins)

---

## 11. Structural Result Endpoints

### 11.1 Publish Structural Result

**Publish structural results for an entire phase (group standings or knockout winners).**

**Endpoint:** `PUT /pools/:poolId/structural-results/:phaseId`

**Authentication:** Required (HOST or CO_ADMIN)

**Request Body - Group Standings:**

```json
{
  "groups": [
    {
      "groupId": "A",
      "teamIds": ["t_A1", "t_A3", "t_A2", "t_A4"]
    }
  ]
}
```

**Request Body - Knockout Winners:**

```json
{
  "matches": [
    {
      "matchId": "m_R32_1",
      "winnerId": "t_A1"
    }
  ]
}
```

**Notes:**
- Upsert: creates or updates
- Pool must be in a status that allows publishing results
- Audit event `STRUCTURAL_RESULT_PUBLISHED` logged

---

### 11.2 Get Structural Result for Phase

**Get the official structural result for a specific phase.**

**Endpoint:** `GET /pools/:poolId/structural-results/:phaseId`

**Authentication:** Required (must be active member)

---

### 11.3 List All Structural Results

**Get all structural results for a pool.**

**Endpoint:** `GET /pools/:poolId/structural-results`

**Authentication:** Required (must be active member)

---

## 12. Scoring Breakdown Endpoints

### 12.1 Match Pick Breakdown

**Get detailed scoring breakdown for a specific match pick.**

**Endpoint:** `GET /pools/:poolId/breakdown/match/:matchId`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
{
  "breakdown": {
    "totalPoints": 15,
    "evaluations": [
      {
        "type": "EXACT_SCORE",
        "points": 10,
        "correct": true,
        "details": { ... }
      },
      {
        "type": "MATCH_OUTCOME_90MIN",
        "points": 5,
        "correct": true,
        "details": { ... }
      }
    ]
  },
  "match": {
    "id": "m1",
    "phaseId": "group_stage",
    "homeTeam": { "id": "t_A1", "name": "Mexico" },
    "awayTeam": { "id": "t_A2", "name": "Canada" },
    "kickoffUtc": "2026-06-11T18:00:00.000Z"
  }
}
```

**Notes:**
- Only works for pools with `pickTypesConfig`
- Only for phases with `requiresScore: true` and `matchPicks`

---

### 12.2 Phase Structural Breakdown

**Get detailed scoring breakdown for structural picks of a phase.**

**Endpoint:** `GET /pools/:poolId/breakdown/phase/:phaseId`

**Authentication:** Required (must be active member)

---

### 12.3 Group Breakdown

**Get detailed scoring breakdown for a specific group's standings prediction.**

**Endpoint:** `GET /pools/:poolId/breakdown/group/:groupId`

**Authentication:** Required (must be active member)

---

## 13. Pick Presets Endpoints

### 13.1 List All Presets

**Get all available pick type presets.**

**Endpoint:** `GET /pick-presets`

**Authentication:** None (public)

**Success Response (200):**

```json
{
  "presets": [
    {
      "key": "BASIC",
      "name": "Basico",
      "description": "..."
    },
    {
      "key": "SIMPLE",
      "name": "Simple",
      "description": "..."
    },
    {
      "key": "CUMULATIVE",
      "name": "Acumulativo",
      "description": "..."
    }
  ]
}
```

---

### 13.2 Get Preset by Key

**Get a specific preset with its full configuration.**

**Endpoint:** `GET /pick-presets/:key`

**Authentication:** None (public)

**Success Response (200):** Full preset object with `config` (PhasePickConfig array)

---

## 14. Legal Document Endpoints

### 14.1 Get Legal Document

**Get an active legal document by type.**

**Endpoint:** `GET /legal/documents/:type`

**Authentication:** None (public)

**Path Parameters:**
- `type`: `terms` | `privacy` | `TERMS_OF_SERVICE` | `PRIVACY_POLICY`

**Query Parameters:**
- `locale` (optional, default: `"es"`): Language code

**Success Response (200):**

```json
{
  "document": {
    "id": "doc-uuid",
    "type": "TERMS_OF_SERVICE",
    "version": "2026-01-25",
    "title": "Terminos de Servicio",
    "content": "...",
    "locale": "es",
    "publishedAt": "2026-01-25T00:00:00.000Z",
    "effectiveAt": "2026-01-25T00:00:00.000Z"
  }
}
```

---

### 14.2 Get Current Legal Versions

**Get the current active versions of all legal documents.**

**Endpoint:** `GET /legal/current-versions`

**Authentication:** None (public)

**Query Parameters:**
- `locale` (optional, default: `"es"`)

**Success Response (200):**

```json
{
  "versions": {
    "termsOfService": "2026-01-25",
    "privacyPolicy": "2026-01-25"
  },
  "documents": {
    "termsOfService": { "version": "2026-01-25", "title": "...", "publishedAt": "..." },
    "privacyPolicy": { "version": "2026-01-25", "title": "...", "publishedAt": "..." }
  }
}
```

---

### 14.3 Get Consent Status

**Check if the user has accepted the current versions of legal documents.**

**Endpoint:** `GET /legal/consent-status`

**Authentication:** Required

**Success Response (200):**

```json
{
  "consent": {
    "termsOfService": {
      "accepted": true,
      "version": "2026-01-25",
      "acceptedAt": "2026-01-02T10:00:00.000Z",
      "isUpToDate": true,
      "currentVersion": "2026-01-25"
    },
    "privacyPolicy": { ... },
    "ageVerified": true,
    "marketingConsent": false
  },
  "requiresUpdate": false
}
```

---

### 14.4 Accept Legal Documents

**Record user's acceptance of legal documents.**

**Endpoint:** `POST /legal/accept`

**Authentication:** Required

**Request Body:**

```json
{
  "acceptTerms": true,
  "acceptPrivacy": true,
  "acceptAge": true,
  "acceptMarketing": false
}
```

---

## 15. Feedback Endpoints

### 15.1 Submit Feedback

**Submit a bug report or feature suggestion.**

**Endpoint:** `POST /feedback`

**Authentication:** Optional (includes user info if authenticated)

**Rate Limit:** 5 requests / minute per IP

**Request Body:**

```json
{
  "type": "BUG",
  "message": "The leaderboard is not updating correctly after result publish",
  "imageBase64": "data:image/png;base64,...",
  "wantsContact": true,
  "contactName": "Juan",
  "phoneNumber": "+52 55 1234 5678",
  "currentUrl": "/pools/abc-123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | enum | yes | "BUG" or "SUGGESTION" |
| `message` | string | yes | 10-2000 characters |
| `imageBase64` | string | no | Max ~500KB image as base64 |
| `wantsContact` | boolean | no | Default false |
| `contactName` | string | no | Max 100 chars (only if wantsContact) |
| `phoneNumber` | string | no | Max 20 chars (only if wantsContact) |
| `currentUrl` | string | no | Max 500 chars |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Feedback enviado exitosamente. Gracias por tu ayuda!",
  "id": "feedback-uuid"
}
```

---

### 15.2 List Feedback (Admin)

**Get all submitted feedback with pagination and filters.**

**Endpoint:** `GET /feedback/admin`

**Authentication:** Required (ADMIN only)

**Query Parameters:**
- `type` (optional): `"BUG"` or `"SUGGESTION"`
- `wantsContact` (optional): `"true"`
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 100)

**Success Response (200):**

```json
{
  "feedbacks": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 237,
    "totalPages": 5
  }
}
```

---

## 16. Admin General Endpoints

**All admin endpoints require `platformRole = ADMIN` unless noted otherwise.**

### 16.1 Admin Ping

**Test admin RBAC.**

**Endpoint:** `GET /admin/ping`

**Authentication:** Required (ADMIN only)

**Success Response (200):** `{ "ok": true, "admin": true }`

---

### 16.2 Platform Stats

**Get platform-wide statistics.**

**Endpoint:** `GET /admin/stats`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "users": {
    "total": 150,
    "test": 5,
    "real": 145,
    "byMonth": [
      { "month": "2026-01", "count": 50 },
      { "month": "2026-02", "count": 95 }
    ]
  },
  "pools": { "total": 30 },
  "feedback": { "total": 12 }
}
```

---

### 16.3 Bootstrap Admin

**Create the first admin user (only works if no admins exist).**

**Endpoint:** `POST /admin/bootstrap-admin`

**Authentication:** None (public -- disabled once an admin exists)

**Request Body:**

```json
{
  "email": "admin@example.com",
  "password": "SecureAdminPass!",
  "displayName": "Admin",
  "username": "admin"
}
```

---

### 16.4 Seed WC2026

**Seed the WC2026 sandbox tournament in production.**

**Endpoint:** `POST /admin/seed-wc2026`

**Authentication:** Required (ADMIN only)

---

## 17. Admin Template Endpoints

### 17.1 List Templates

**Endpoint:** `GET /admin/templates`

**Authentication:** Required (ADMIN only)

---

### 17.2 Create Template

**Endpoint:** `POST /admin/templates`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "key": "wc_2026_sandbox",
  "name": "World Cup 2026 Format",
  "description": "48 teams, 12 groups"
}
```

**Notes:**
- `key` must be unique, 3-50 characters
- Initial status: DRAFT

---

### 17.3 List Template Versions

**Endpoint:** `GET /admin/templates/:templateId/versions`

**Authentication:** Required (ADMIN only)

---

### 17.4 Create Template Version (DRAFT)

**Endpoint:** `POST /admin/templates/:templateId/versions`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "dataJson": {
    "meta": { "name": "...", "competition": "...", "seasonYear": 2026, "sport": "football" },
    "teams": [ ... ],
    "phases": [ ... ],
    "matches": [ ... ]
  }
}
```

**Notes:**
- `dataJson` is validated against `templateDataSchema` + consistency checks
- `versionNumber` auto-increments

---

### 17.5 Update Template Version (DRAFT only)

**Endpoint:** `PUT /admin/templates/:templateId/versions/:versionId`

**Authentication:** Required (ADMIN only)

**Notes:**
- Only DRAFT versions can be edited
- PUBLISHED versions are immutable

---

### 17.6 Publish Template Version

**Endpoint:** `POST /admin/templates/:templateId/versions/:versionId/publish`

**Authentication:** Required (ADMIN only)

**Notes:**
- Validates `dataJson` before publishing
- Sets `status = PUBLISHED`, `publishedAtUtc = now()`
- Updates template's `currentPublishedVersionId`
- Version becomes immutable

---

## 18. Admin Instance Endpoints

### 18.1 List Instances

**Endpoint:** `GET /admin/instances`

**Authentication:** Required (ADMIN only)

---

### 18.2 Get Instance

**Endpoint:** `GET /admin/instances/:instanceId`

**Authentication:** Required (ADMIN only)

---

### 18.3 Create Instance

**Endpoint:** `POST /admin/templates/:templateId/instances`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "name": "World Cup 2026 (Sandbox Instance)",
  "templateVersionId": "version-uuid"
}
```

**Notes:**
- If `templateVersionId` not provided, uses template's `currentPublishedVersionId`
- `dataJson` is frozen snapshot from template version
- Initial status: DRAFT

---

### 18.4 Activate Instance

**Endpoint:** `POST /admin/instances/:instanceId/activate`

**Authentication:** Required (ADMIN only)

**Notes:** DRAFT -> ACTIVE. Instance appears in catalog.

---

### 18.5 Complete Instance

**Endpoint:** `POST /admin/instances/:instanceId/complete`

**Authentication:** Required (ADMIN only)

**Notes:** ACTIVE -> COMPLETED. Removed from catalog, no new pools.

---

### 18.6 Archive Instance

**Endpoint:** `POST /admin/instances/:instanceId/archive`

**Authentication:** Required (ADMIN only)

**Notes:** DRAFT|COMPLETED -> ARCHIVED. Hidden from all listings.

---

### 18.7 Advance to Round of 32

**Advance tournament from group stage to R32.**

**Endpoint:** `POST /admin/instances/:instanceId/advance-to-r32`

**Authentication:** Required (ADMIN only)

---

### 18.8 Advance Knockout Phase

**Advance a knockout phase to the next one.**

**Endpoint:** `POST /admin/instances/:instanceId/advance-knockout`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "currentPhaseId": "round_of_32",
  "nextPhaseId": "round_of_16"
}
```

---

### 18.9 Get Group Stage Status

**Check if group stage is complete.**

**Endpoint:** `GET /admin/instances/:instanceId/group-stage-status`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "isComplete": false,
  "missingMatches": ["m_A_1_1", "m_A_1_2"],
  "missingCount": 2
}
```

---

### 18.10 Configure Result Source

**Configure the result source mode for an instance (MANUAL or AUTO).**

**Endpoint:** `PUT /admin/instances/:instanceId/result-source`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "resultSourceMode": "AUTO",
  "apiFootballLeagueId": 2,
  "apiFootballSeasonId": 2025,
  "syncEnabled": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resultSourceMode` | enum | yes | "MANUAL" or "AUTO" |
| `apiFootballLeagueId` | number | conditional | Required for AUTO mode |
| `apiFootballSeasonId` | number | conditional | Required for AUTO mode |
| `syncEnabled` | boolean | no | Default: true for AUTO |

---

### 18.11 Create/Update Match Mappings (Bulk)

**Map internal match IDs to API-Football fixture IDs.**

**Endpoint:** `POST /admin/instances/:instanceId/match-mappings`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "mappings": [
    {
      "internalMatchId": "m_R16_1",
      "apiFootballFixtureId": 1234567
    }
  ]
}
```

**Notes:**
- Instance must be in AUTO mode
- Uses upsert (create or update each mapping)
- Max 200 mappings per request

---

### 18.12 List Match Mappings

**Endpoint:** `GET /admin/instances/:instanceId/match-mappings`

**Authentication:** Required (ADMIN only)

---

### 18.13 Delete Match Mapping

**Endpoint:** `DELETE /admin/instances/:instanceId/match-mappings/:mappingId`

**Authentication:** Required (ADMIN only)

---

## 19. Admin Sync Endpoints

### 19.1 Trigger Instance Sync

**Manually trigger result synchronization for an instance.**

**Endpoint:** `POST /admin/instances/:instanceId/sync`

**Authentication:** Required (ADMIN only)

**Notes:**
- Instance must be in AUTO mode
- Calls the API-Football service
- Returns sync result summary

---

### 19.2 Get Instance Sync Status

**Get sync status and recent logs for an instance.**

**Endpoint:** `GET /admin/instances/:instanceId/sync-status`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "instanceId": "instance-uuid",
  "instanceName": "UCL 2025-26",
  "resultSourceMode": "AUTO",
  "syncEnabled": true,
  "apiFootballLeagueId": 2,
  "apiFootballSeasonId": 2025,
  "lastSyncAtUtc": "2026-02-20T15:00:00.000Z",
  "mappingsCount": 16,
  "jobStatus": { ... },
  "recentSyncLogs": [ ... ]
}
```

---

### 19.3 Trigger Global Sync

**Manually trigger sync for ALL AUTO instances.**

**Endpoint:** `POST /admin/sync/trigger-all`

**Authentication:** Required (ADMIN only)

---

### 19.4 Get Global Sync Status

**Get overall sync system status.**

**Endpoint:** `GET /admin/sync/status`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "serviceAvailable": true,
  "jobStatus": { ... },
  "autoInstancesCount": 1,
  "enabledAutoInstancesCount": 1,
  "recentLogs": [ ... ]
}
```

---

## 20. Admin Settings Endpoints

**Mounted at `/admin/settings`.**

### 20.1 Get Email Settings

**Get platform-wide email notification settings.**

**Endpoint:** `GET /admin/settings/email`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "settings": {
    "emailWelcomeEnabled": true,
    "emailPoolInvitationEnabled": true,
    "emailDeadlineReminderEnabled": true,
    "emailResultPublishedEnabled": true,
    "emailPoolCompletedEnabled": true
  },
  "metadata": {
    "updatedAt": "2026-01-15T10:00:00.000Z",
    "updatedBy": {
      "displayName": "Admin",
      "email": "admin@example.com"
    }
  }
}
```

---

### 20.2 Update Email Settings

**Update platform-wide email notification toggles.**

**Endpoint:** `PUT /admin/settings/email`

**Authentication:** Required (ADMIN only)

**Request Body (all fields optional, at least one required):**

```json
{
  "emailWelcomeEnabled": true,
  "emailPoolInvitationEnabled": false,
  "emailDeadlineReminderEnabled": true,
  "emailResultPublishedEnabled": true,
  "emailPoolCompletedEnabled": true
}
```

**Notes:**
- Only changed values are logged in audit
- Audit event `PLATFORM_EMAIL_SETTINGS_UPDATED` logged

---

### 20.3 Get Email Stats

**Get email usage statistics.**

**Endpoint:** `GET /admin/settings/email/stats`

**Authentication:** Required (ADMIN only)

**Notes:** Currently returns a placeholder directing to the Resend dashboard.

---

### 20.4 Send Test Email

**Send a test email of a specific type.**

**Endpoint:** `POST /admin/settings/email/test`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "type": "welcome",
  "to": "test@example.com"
}
```

| Type | Description |
|------|-------------|
| `welcome` | Welcome email |
| `poolInvitation` | Pool invitation email |
| `deadlineReminder` | Deadline reminder email |
| `resultPublished` | Result published notification |
| `poolCompleted` | Pool completed notification |

---

### 20.5 Run Deadline Reminders

**Manually trigger deadline reminder email processing.**

**Endpoint:** `POST /admin/settings/email/reminders/run`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "hoursBeforeDeadline": 24,
  "dryRun": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hoursBeforeDeadline` | number | 24 | 1-168 hours (up to 7 days) |
| `dryRun` | boolean | false | If true, simulates without sending |

---

### 20.6 Get Deadline Reminder Stats

**Get statistics about deadline reminders sent.**

**Endpoint:** `GET /admin/settings/email/reminders/stats`

**Authentication:** Required (ADMIN only)

**Query Parameters:**
- `poolId` (optional): Filter by specific pool
- `days` (optional, default: 7): Number of days to look back

---

## Appendix A: Rate Limiting

**Implemented in v0.3.0:**

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| All authenticated endpoints | 100 requests | 1 minute |
| `POST /auth/login`, `POST /auth/register` | 10 requests | 15 minutes |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | 5 requests | 15 minutes |
| `POST /feedback` | 5 requests | 1 minute |

**Implementation:** `express-rate-limit` middleware with `trust proxy` enabled for Railway deployment.

---

## Appendix B: Pagination (Future)

**Not currently implemented for most endpoints. Planned for v1.1+:**

**Currently paginated:**
- `GET /feedback/admin` - supports `page` and `limit` params

**Standard pagination response format:**
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalPages": 5,
    "totalItems": 237
  }
}
```

---

## Appendix C: Webhook Events (Future v2.0+)

**Planned webhook support for integrations:**

**Events:**
- `pool.created`
- `pool.member_joined`
- `result.published`
- `result.corrected`
- `leaderboard.updated`

---

## Appendix D: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Validation rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [CURRENT_STATE.md](./CURRENT_STATE.md) - Current system state

---

**END OF DOCUMENT**
