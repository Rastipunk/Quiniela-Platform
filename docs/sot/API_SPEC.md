# API Specification
# Quiniela Platform

> **Version:** 1.0 (v0.1-alpha implementation)
> **Last Updated:** 2026-01-02
> **Base URL:** `http://localhost:3000` (development)
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
8. [Result Endpoints](#8-result-endpoints)
9. [Admin Template Endpoints](#9-admin-template-endpoints)
10. [Admin Instance Endpoints](#10-admin-instance-endpoints)

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

**Request Body:**

```json
{
  "email": "user@example.com",
  "displayName": "Juan Carlos",
  "password": "SecurePass123!"
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `displayName`: 3-50 characters
- `password`: 8-100 characters, must contain uppercase, number, special char

**Success Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "displayName": "Juan Carlos",
    "platformRole": "PLAYER",
    "status": "ACTIVE",
    "createdAtUtc": "2026-01-02T10:00:00.000Z",
    "updatedAtUtc": "2026-01-02T10:00:00.000Z"
  }
}
```

**Error Responses:**

```json
// 400 - Validation Error
{
  "error": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "email": ["Email already exists"]
    }
  }
}

// 400 - Duplicate Email
{
  "error": "VALIDATION_ERROR",
  "message": "Email already exists"
}
```

**Notes:**
- Password is hashed with bcrypt (salt rounds = 10) before storage
- Audit event `USER_REGISTERED` is logged

---

### 3.2 Login

**Authenticate existing user.**

**Endpoint:** `POST /auth/login`

**Authentication:** None (public)

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
    "displayName": "Juan Carlos",
    "platformRole": "PLAYER",
    "status": "ACTIVE",
    "createdAtUtc": "2026-01-02T10:00:00.000Z",
    "updatedAtUtc": "2026-01-02T10:00:00.000Z"
  }
}
```

**Error Responses:**

```json
// 401 - Invalid Credentials
{
  "error": "UNAUTHENTICATED",
  "message": "Invalid credentials"
}

// 401 - Disabled Account
{
  "error": "UNAUTHENTICATED",
  "message": "Account is disabled"
}
```

**Notes:**
- Email is case-insensitive (normalized to lowercase)
- Audit event `USER_LOGGED_IN` is logged (with IP, user-agent)
- Rate limiting recommended (future: 5 attempts / 15 min)

---

## 4. User Endpoints

### 4.1 Get My Pools

**Get list of pools where user is an active member.**

**Endpoint:** `GET /me/pools`

**Authentication:** Required

**Query Parameters:** None

**Success Response (200):**

```json
[
  {
    "id": "pool-uuid-1",
    "poolId": "pool-uuid-1",
    "userId": "user-uuid",
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z",
    "leftAtUtc": null,
    "pool": {
      "id": "pool-uuid-1",
      "name": "Office Friends WC2026",
      "description": "World Cup predictions with the office crew",
      "visibility": "PRIVATE",
      "timeZone": "America/Mexico_City",
      "deadlineMinutesBeforeKickoff": 10,
      "scoringPresetKey": "CLASSIC",
      "createdAtUtc": "2026-01-02T09:00:00.000Z",
      "tournamentInstance": {
        "id": "instance-uuid",
        "name": "World Cup 2026 (Sandbox Instance)",
        "status": "ACTIVE"
      }
    }
  },
  {
    "id": "pool-uuid-2",
    "poolId": "pool-uuid-2",
    "userId": "user-uuid",
    "role": "PLAYER",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T11:00:00.000Z",
    "pool": {
      "id": "pool-uuid-2",
      "name": "Family Tournament",
      "description": null,
      "visibility": "PRIVATE",
      "timeZone": "UTC",
      "deadlineMinutesBeforeKickoff": 15,
      "scoringPresetKey": "OUTCOME_ONLY",
      "createdAtUtc": "2026-01-02T10:30:00.000Z",
      "tournamentInstance": {
        "id": "instance-uuid",
        "name": "World Cup 2026 (Sandbox Instance)",
        "status": "ACTIVE"
      }
    }
  }
]
```

**Notes:**
- Only returns pools where `status = ACTIVE`
- Includes pool details + tournament instance
- Ordered by `joinedAtUtc DESC` (most recent first)

---

## 5. Catalog Endpoints

### 5.1 List Tournament Instances

**Get list of active tournament instances available for pool creation.**

**Endpoint:** `GET /catalog/instances`

**Authentication:** Required

**Query Parameters:** None

**Success Response (200):**

```json
[
  {
    "id": "instance-uuid",
    "templateId": "template-uuid",
    "templateVersionId": "version-uuid",
    "name": "World Cup 2026 (Sandbox Instance)",
    "status": "ACTIVE",
    "createdAtUtc": "2024-12-29T10:00:00.000Z",
    "updatedAtUtc": "2024-12-29T10:00:00.000Z",
    "dataJson": {
      "meta": {
        "name": "FIFA World Cup 2026",
        "competition": "World Cup",
        "seasonYear": 2026,
        "sport": "football"
      },
      "teams": [ /* 48 teams */ ],
      "phases": [ /* 1 phase */ ],
      "matches": [ /* 72 matches */ ],
      "note": "Sandbox instance for testing"
    }
  }
]
```

**Notes:**
- Only returns instances with `status = ACTIVE`
- Full `dataJson` included (teams, matches, etc.)
- Used in frontend "Create Pool" flow

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
  "scoringPresetKey": "CLASSIC"
}
```

**Field Details:**

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `tournamentInstanceId` | UUID | ✅ | - | Must exist and be ACTIVE |
| `name` | string | ✅ | - | 3-120 characters |
| `description` | string | ❌ | null | Max 500 characters |
| `timeZone` | string | ❌ | "UTC" | IANA timezone (e.g., "America/Bogota") |
| `deadlineMinutesBeforeKickoff` | number | ❌ | 10 | 0-1440 (0 to 24 hours) |
| `scoringPresetKey` | enum | ❌ | "CLASSIC" | "CLASSIC" \| "OUTCOME_ONLY" \| "EXACT_HEAVY" |

**Success Response (201):**

```json
{
  "pool": {
    "id": "pool-uuid",
    "tournamentInstanceId": "instance-uuid",
    "name": "Office Friends WC2026",
    "description": "World Cup predictions with the office crew",
    "visibility": "PRIVATE",
    "timeZone": "America/Mexico_City",
    "deadlineMinutesBeforeKickoff": 10,
    "scoringPresetKey": "CLASSIC",
    "createdByUserId": "user-uuid",
    "createdAtUtc": "2026-01-02T10:00:00.000Z",
    "updatedAtUtc": "2026-01-02T10:00:00.000Z"
  },
  "membership": {
    "id": "member-uuid",
    "poolId": "pool-uuid",
    "userId": "user-uuid",
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z",
    "leftAtUtc": null
  },
  "firstInviteCode": "a3f9c2d8e1b4"
}
```

**Error Responses:**

```json
// 404 - Instance Not Found
{
  "error": "NOT_FOUND",
  "message": "TournamentInstance not found"
}

// 409 - Archived Instance
{
  "error": "CONFLICT",
  "message": "Cannot create pool on ARCHIVED instance"
}
```

**Notes:**
- Creator automatically becomes HOST
- First invite code auto-generated (12-char hex)
- Audit event `POOL_CREATED` logged
- Transaction ensures atomicity (pool + membership + invite)

---

### 6.2 Get Pool Details

**Get basic pool information.**

**Endpoint:** `GET /pools/:poolId`

**Authentication:** Required (must be active member)

**Path Parameters:**
- `poolId` (UUID): Pool ID

**Success Response (200):**

```json
{
  "id": "pool-uuid",
  "tournamentInstanceId": "instance-uuid",
  "name": "Office Friends WC2026",
  "description": "World Cup predictions with the office crew",
  "visibility": "PRIVATE",
  "timeZone": "America/Mexico_City",
  "deadlineMinutesBeforeKickoff": 10,
  "scoringPresetKey": "CLASSIC",
  "createdByUserId": "user-uuid",
  "createdAtUtc": "2026-01-02T10:00:00.000Z",
  "updatedAtUtc": "2026-01-02T10:00:00.000Z",
  "tournamentInstance": {
    "id": "instance-uuid",
    "name": "World Cup 2026 (Sandbox Instance)",
    "status": "ACTIVE",
    "dataJson": { /* full data */ }
  }
}
```

**Error Responses:**

```json
// 404 - Pool Not Found
{
  "error": "NOT_FOUND",
  "message": "Pool not found"
}

// 403 - Not a Member
{
  "error": "FORBIDDEN",
  "message": "Not a member of this pool"
}
```

---

### 6.3 Get Pool Overview (Single-Call Endpoint)

**Get comprehensive pool data: matches, picks, results, leaderboard in ONE call.**

**Endpoint:** `GET /pools/:poolId/overview`

**Authentication:** Required (must be active member)

**Query Parameters:**
- `leaderboardVerbose` (optional): `"1"` or `"true"` to include per-match breakdown

**Success Response (200):**

```json
{
  "nowUtc": "2026-01-02T15:00:00.000Z",
  "pool": {
    "id": "pool-uuid",
    "name": "Office Friends WC2026",
    "description": "World Cup predictions",
    "visibility": "PRIVATE",
    "timeZone": "America/Mexico_City",
    "deadlineMinutesBeforeKickoff": 10,
    "scoringPresetKey": "CLASSIC",
    "createdAtUtc": "2026-01-02T10:00:00.000Z",
    "scoringPreset": {
      "key": "CLASSIC",
      "name": "Clásico",
      "description": "3 pts por ganador/empate + 2 bonus por marcador exacto.",
      "outcomePoints": 3,
      "exactScoreBonus": 2,
      "allowScorePick": true
    }
  },
  "myMembership": {
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z"
  },
  "permissions": {
    "canManageResults": true,
    "canInvite": true
  },
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
      "homeTeam": {
        "id": "t_A1",
        "name": "Team A1",
        "code": "TA1",
        "groupId": "A"
      },
      "awayTeam": {
        "id": "t_A2",
        "name": "Team A2",
        "code": "TA2",
        "groupId": "A"
      },
      "deadlineUtc": "2026-06-11T17:50:00.000Z",
      "isLocked": false,
      "myPick": {
        "pickJson": {
          "type": "SCORE",
          "homeGoals": 2,
          "awayGoals": 1
        },
        "createdAtUtc": "2026-01-02T12:00:00.000Z",
        "updatedAtUtc": "2026-01-02T12:00:00.000Z"
      },
      "result": null
    },
    {
      "id": "m2",
      "kickoffUtc": "2026-06-11T20:00:00.000Z",
      "homeTeamId": "t_A3",
      "awayTeamId": "t_A4",
      "groupId": "A",
      "deadlineUtc": "2026-06-11T19:50:00.000Z",
      "isLocked": false,
      "myPick": null,
      "result": {
        "currentVersion": {
          "versionNumber": 1,
          "homeGoals": 3,
          "awayGoals": 0,
          "reason": null,
          "createdByUserId": "host-uuid",
          "publishedAtUtc": "2026-06-11T22:00:00.000Z"
        }
      },
      "homeTeam": { /* ... */ },
      "awayTeam": { /* ... */ }
    }
  ],
  "leaderboard": {
    "scoring": {
      "outcomePoints": 3,
      "exactScoreBonus": 2
    },
    "rows": [
      {
        "rank": 1,
        "userId": "user1-uuid",
        "displayName": "Juan Carlos",
        "totalPoints": 15,
        "matchesScored": 5,
        "exactScoreCount": 1,
        "joinedAtUtc": "2026-01-02T10:00:00.000Z"
      },
      {
        "rank": 2,
        "userId": "user2-uuid",
        "displayName": "Maria Lopez",
        "totalPoints": 12,
        "matchesScored": 4,
        "exactScoreCount": 0,
        "joinedAtUtc": "2026-01-02T10:05:00.000Z"
      }
    ]
  }
}
```

**With `leaderboardVerbose=1`:**

Adds `breakdown` array to each leaderboard row:

```json
{
  "leaderboard": {
    "rows": [
      {
        "rank": 1,
        "userId": "user1-uuid",
        "displayName": "Juan Carlos",
        "totalPoints": 15,
        "breakdown": [
          {
            "matchId": "m1",
            "pointsEarned": 5,
            "details": {
              "outcomeCorrect": true,
              "exactScoreCorrect": true,
              "outcomePoints": 3,
              "exactBonus": 2
            }
          },
          {
            "matchId": "m2",
            "pointsEarned": 3,
            "details": {
              "outcomeCorrect": true,
              "exactScoreCorrect": false,
              "outcomePoints": 3,
              "exactBonus": 0
            }
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- **Optimized endpoint:** Reduces frontend API calls from 4-5 to 1
- `isLocked` calculated per match based on current server time
- `myPick` only included if user has submitted pick for that match
- `result` only included if result has been published
- Leaderboard sorted by: `totalPoints DESC, joinedAtUtc ASC`

---

### 6.4 Get Pool Members

**Get list of all pool members.**

**Endpoint:** `GET /pools/:poolId/members`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
[
  {
    "id": "member-uuid-1",
    "userId": "user-uuid-1",
    "role": "HOST",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T10:00:00.000Z",
    "leftAtUtc": null,
    "user": {
      "id": "user-uuid-1",
      "displayName": "Juan Carlos",
      "email": "juan@example.com"
    }
  },
  {
    "id": "member-uuid-2",
    "userId": "user-uuid-2",
    "role": "PLAYER",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T11:00:00.000Z",
    "user": {
      "id": "user-uuid-2",
      "displayName": "Maria Lopez"
    }
  }
]
```

**Notes:**
- Includes all members (ACTIVE, LEFT, BANNED)
- Email only shown for current user (privacy)
- Ordered by `joinedAtUtc ASC`

---

### 6.5 Create Invite Code

**Generate a new invite code for the pool.**

**Endpoint:** `POST /pools/:poolId/invites`

**Authentication:** Required (HOST only)

**Request Body:**

```json
{
  "maxUses": 10,
  "expiresAtUtc": "2026-06-30T23:59:59.000Z"
}
```

**Both fields optional:**
- `maxUses` (number): Max times code can be used (null = unlimited)
- `expiresAtUtc` (ISO 8601 string): Expiry date (null = never)

**Success Response (201):**

```json
{
  "id": "invite-uuid",
  "poolId": "pool-uuid",
  "code": "d7e8f9a0b1c2",
  "createdByUserId": "user-uuid",
  "maxUses": 10,
  "uses": 0,
  "expiresAtUtc": "2026-06-30T23:59:59.000Z",
  "createdAtUtc": "2026-01-02T15:00:00.000Z"
}
```

**Error Responses:**

```json
// 403 - Not Host
{
  "error": "FORBIDDEN",
  "message": "Only HOST can create invites"
}
```

**Notes:**
- Code generated via `crypto.randomBytes(6).toString('hex')`
- Audit event `POOL_INVITE_CREATED` logged
- Multiple active codes allowed per pool

---

### 6.6 Join Pool

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
  "pool": {
    "id": "pool-uuid",
    "name": "Office Friends WC2026",
    "description": "World Cup predictions"
  },
  "membership": {
    "id": "member-uuid",
    "poolId": "pool-uuid",
    "userId": "user-uuid",
    "role": "PLAYER",
    "status": "ACTIVE",
    "joinedAtUtc": "2026-01-02T15:30:00.000Z"
  }
}
```

**Error Responses:**

```json
// 404 - Invalid Code
{
  "error": "NOT_FOUND",
  "message": "Invite code not found"
}

// 409 - Code Expired
{
  "error": "CONFLICT",
  "message": "Invite code has expired"
}

// 409 - Code Exhausted
{
  "error": "CONFLICT",
  "message": "Invite code has reached max uses"
}

// 409 - Already Member
{
  "error": "CONFLICT",
  "message": "Already a member of this pool"
}

// 409 - Banned User
{
  "error": "CONFLICT",
  "message": "You are banned from this pool"
}
```

**Notes:**
- Increments `PoolInvite.uses` counter
- Creates `PoolMember` with `role = PLAYER`, `status = ACTIVE`
- Audit event `POOL_JOINED` logged
- If 2nd member joins, pool transitions to ACTIVE state (future)

---

## 7. Pick Endpoints

### 7.1 List Matches with Deadlines

**Get all matches in pool with deadline/lock status.**

**Endpoint:** `GET /pools/:poolId/matches`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
[
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
  },
  {
    "id": "m2",
    "kickoffUtc": "2026-06-11T20:00:00.000Z",
    "homeTeamId": "t_A3",
    "awayTeamId": "t_A4",
    "groupId": "A",
    "deadlineUtc": "2026-06-11T19:50:00.000Z",
    "isLocked": false
  }
]
```

**Notes:**
- `deadlineUtc` = `kickoffUtc - deadlineMinutesBeforeKickoff`
- `isLocked` = `now >= deadlineUtc`
- Matches extracted from `pool.tournamentInstance.dataJson`

---

### 7.2 Submit/Update Pick

**Create or update user's pick for a match.**

**Endpoint:** `PUT /pools/:poolId/picks/:matchId`

**Authentication:** Required (must be active member)

**Path Parameters:**
- `poolId` (UUID): Pool ID
- `matchId` (string): Match ID from instance snapshot

**Request Body (v0.1-alpha, 2 pick types):**

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

**Validation:**
- `type` must be "SCORE" or "OUTCOME"
- `homeGoals`, `awayGoals` must be non-negative integers (0-99)
- `outcome` must be "HOME", "DRAW", or "AWAY"

**Success Response (200):**

```json
{
  "id": "prediction-uuid",
  "poolId": "pool-uuid",
  "userId": "user-uuid",
  "matchId": "m1",
  "pickJson": {
    "type": "SCORE",
    "homeGoals": 2,
    "awayGoals": 1
  },
  "createdAtUtc": "2026-01-02T12:00:00.000Z",
  "updatedAtUtc": "2026-01-02T15:30:00.000Z"
}
```

**Error Responses:**

```json
// 409 - Deadline Passed
{
  "error": "DEADLINE_PASSED",
  "message": "Cannot modify pick after deadline"
}

// 404 - Match Not Found
{
  "error": "NOT_FOUND",
  "message": "Match not found in tournament instance"
}

// 403 - Not a Member
{
  "error": "FORBIDDEN",
  "message": "Not a member of this pool"
}
```

**Notes:**
- Upsert operation (creates if not exists, updates if exists)
- Constraint: `(poolId, userId, matchId)` unique
- Audit event `PREDICTION_UPSERTED` logged
- **IMPORTANT:** Frontend must convert number inputs (strings) to actual numbers before sending

---

### 7.3 Get My Picks

**Get all picks submitted by current user in pool.**

**Endpoint:** `GET /pools/:poolId/picks`

**Authentication:** Required (must be active member)

**Success Response (200):**

```json
[
  {
    "id": "prediction-uuid-1",
    "poolId": "pool-uuid",
    "userId": "user-uuid",
    "matchId": "m1",
    "pickJson": {
      "type": "SCORE",
      "homeGoals": 2,
      "awayGoals": 1
    },
    "createdAtUtc": "2026-01-02T12:00:00.000Z",
    "updatedAtUtc": "2026-01-02T12:00:00.000Z"
  },
  {
    "id": "prediction-uuid-2",
    "poolId": "pool-uuid",
    "userId": "user-uuid",
    "matchId": "m5",
    "pickJson": {
      "type": "OUTCOME",
      "outcome": "HOME"
    },
    "createdAtUtc": "2026-01-02T13:00:00.000Z",
    "updatedAtUtc": "2026-01-02T13:00:00.000Z"
  }
]
```

**Notes:**
- Only returns current user's picks (privacy)
- Other users' picks visible after match ends (future feature)

---

## 8. Result Endpoints

### 8.1 Publish/Update Result

**Publish match result (or correct it with errata).**

**Endpoint:** `PUT /pools/:poolId/results/:matchId`

**Authentication:** Required (HOST only, future: CO_ADMIN)

**Path Parameters:**
- `poolId` (UUID): Pool ID
- `matchId` (string): Match ID from instance snapshot

**Request Body:**

```json
{
  "homeGoals": 2,
  "awayGoals": 1,
  "reason": "VAR anulled away goal"
}
```

**Field Details:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `homeGoals` | number | ✅ | 0-99, integer |
| `awayGoals` | number | ✅ | 0-99, integer |
| `reason` | string | ⚠️ Conditional | 1-500 chars, **required if version > 1** |

**Success Response (200):**

```json
{
  "id": "result-uuid",
  "poolId": "pool-uuid",
  "matchId": "m1",
  "currentVersionId": "version-uuid",
  "createdAtUtc": "2026-06-11T22:00:00.000Z",
  "updatedAtUtc": "2026-06-11T22:05:00.000Z",
  "currentVersion": {
    "id": "version-uuid",
    "resultId": "result-uuid",
    "versionNumber": 1,
    "status": "PUBLISHED",
    "homeGoals": 2,
    "awayGoals": 1,
    "reason": null,
    "createdByUserId": "host-uuid",
    "publishedAtUtc": "2026-06-11T22:00:00.000Z",
    "createdAtUtc": "2026-06-11T22:00:00.000Z",
    "updatedAtUtc": "2026-06-11T22:00:00.000Z"
  }
}
```

**Errata Example (Version 2):**

**Request:**
```json
{
  "homeGoals": 2,
  "awayGoals": 0,
  "reason": "VAR anulled away goal"
}
```

**Response:**
```json
{
  "id": "result-uuid",
  "currentVersionId": "version-uuid-2",
  "currentVersion": {
    "versionNumber": 2,
    "homeGoals": 2,
    "awayGoals": 0,
    "reason": "VAR anulled away goal",
    "createdByUserId": "host-uuid",
    "publishedAtUtc": "2026-06-11T22:15:00.000Z"
  }
}
```

**Error Responses:**

```json
// 403 - Not Host
{
  "error": "FORBIDDEN",
  "message": "Only HOST can publish results"
}

// 400 - Missing Reason for Errata
{
  "error": "VALIDATION_ERROR",
  "message": "reason is required for errata (version > 1)"
}

// 404 - Match Not Found
{
  "error": "NOT_FOUND",
  "message": "Match not found in instance snapshot"
}
```

**Notes:**
- First publication (version 1): `reason` optional
- Correction (version 2+): `reason` **required** (enforced in transaction)
- All versions retained (immutable audit trail)
- Leaderboard recalculates automatically
- Audit event `RESULT_PUBLISHED` logged

---

### 8.2 Get Leaderboard

**Get pool leaderboard with optional verbose breakdown.**

**Endpoint:** `GET /pools/:poolId/leaderboard`

**Authentication:** Required (must be active member)

**Query Parameters:**
- `verbose` (optional): `"1"` or `"true"` for per-match breakdown

**Success Response (200) - Basic:**

```json
{
  "scoring": {
    "outcomePoints": 3,
    "exactScoreBonus": 2
  },
  "rows": [
    {
      "rank": 1,
      "userId": "user1-uuid",
      "displayName": "Juan Carlos",
      "totalPoints": 42,
      "matchesScored": 15,
      "exactScoreCount": 3,
      "joinedAtUtc": "2026-01-02T10:00:00.000Z"
    },
    {
      "rank": 2,
      "userId": "user2-uuid",
      "displayName": "Maria Lopez",
      "totalPoints": 38,
      "matchesScored": 14,
      "exactScoreCount": 2,
      "joinedAtUtc": "2026-01-02T10:05:00.000Z"
    }
  ]
}
```

**Success Response (200) - Verbose (`?verbose=1`):**

```json
{
  "scoring": {
    "outcomePoints": 3,
    "exactScoreBonus": 2
  },
  "rows": [
    {
      "rank": 1,
      "userId": "user1-uuid",
      "displayName": "Juan Carlos",
      "totalPoints": 42,
      "matchesScored": 15,
      "exactScoreCount": 3,
      "joinedAtUtc": "2026-01-02T10:00:00.000Z",
      "breakdown": [
        {
          "matchId": "m1",
          "pointsEarned": 5,
          "details": {
            "outcomeCorrect": true,
            "exactScoreCorrect": true,
            "outcomePoints": 3,
            "exactBonus": 2
          }
        },
        {
          "matchId": "m2",
          "pointsEarned": 3,
          "details": {
            "outcomeCorrect": true,
            "exactScoreCorrect": false,
            "outcomePoints": 3,
            "exactBonus": 0
          }
        },
        {
          "matchId": "m3",
          "pointsEarned": 0,
          "details": {
            "outcomeCorrect": false,
            "exactScoreCorrect": false,
            "outcomePoints": 0,
            "exactBonus": 0
          }
        }
      ]
    }
  ]
}
```

**Sorting Logic:**
1. **Primary:** `totalPoints` DESC (highest points first)
2. **Tiebreaker:** `joinedAtUtc` ASC (earliest member wins)

**Notes:**
- Only includes matches with published results
- `exactScoreCount`: How many exact score predictions user got right
- `matchesScored`: Matches where user earned > 0 points
- Verbose mode can be large (use sparingly)

---

## 9. Admin Template Endpoints

**All admin endpoints require `platformRole = ADMIN`.**

### 9.1 List Templates

**Get all tournament templates.**

**Endpoint:** `GET /admin/templates`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
[
  {
    "id": "template-uuid",
    "key": "wc_2026_sandbox",
    "name": "World Cup 2026 Format",
    "description": "48 teams, 12 groups",
    "status": "PUBLISHED",
    "currentPublishedVersionId": "version-uuid",
    "createdAtUtc": "2024-12-29T10:00:00.000Z",
    "updatedAtUtc": "2024-12-29T10:00:00.000Z"
  }
]
```

---

### 9.2 Create Template

**Create a new tournament template.**

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

**Success Response (201):**

```json
{
  "id": "template-uuid",
  "key": "wc_2026_sandbox",
  "name": "World Cup 2026 Format",
  "description": "48 teams, 12 groups",
  "status": "DRAFT",
  "currentPublishedVersionId": null,
  "createdAtUtc": "2026-01-02T16:00:00.000Z",
  "updatedAtUtc": "2026-01-02T16:00:00.000Z"
}
```

**Notes:**
- `key` must be unique, lowercase, alphanumeric + underscore
- Initial status: DRAFT
- Audit event `TEMPLATE_CREATED` logged

---

### 9.3 List Template Versions

**Get all versions of a template.**

**Endpoint:** `GET /admin/templates/:templateId/versions`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
[
  {
    "id": "version-uuid-1",
    "templateId": "template-uuid",
    "versionNumber": 1,
    "status": "PUBLISHED",
    "publishedAtUtc": "2024-12-29T10:00:00.000Z",
    "createdAtUtc": "2024-12-29T09:00:00.000Z",
    "updatedAtUtc": "2024-12-29T10:00:00.000Z"
  },
  {
    "id": "version-uuid-2",
    "templateId": "template-uuid",
    "versionNumber": 2,
    "status": "DRAFT",
    "publishedAtUtc": null,
    "createdAtUtc": "2026-01-02T15:00:00.000Z",
    "updatedAtUtc": "2026-01-02T15:00:00.000Z"
  }
]
```

---

### 9.4 Create Template Version (DRAFT)

**Create a new DRAFT version of a template.**

**Endpoint:** `POST /admin/templates/:templateId/versions`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "dataJson": {
    "meta": {
      "name": "FIFA World Cup 2026",
      "competition": "World Cup",
      "seasonYear": 2026,
      "sport": "football"
    },
    "teams": [
      {
        "id": "mex",
        "name": "Mexico",
        "shortName": "MEX",
        "code": "MEX",
        "groupId": "A"
      }
    ],
    "phases": [
      {
        "id": "group_stage",
        "name": "Group Stage",
        "type": "GROUP",
        "order": 1,
        "config": {
          "groupsCount": 12,
          "teamsPerGroup": 4
        }
      }
    ],
    "matches": [
      {
        "id": "m1",
        "phaseId": "group_stage",
        "kickoffUtc": "2026-06-11T18:00:00Z",
        "homeTeamId": "mex",
        "awayTeamId": "can",
        "matchNumber": 1,
        "roundLabel": "Group A - Matchday 1",
        "venue": "Estadio Azteca",
        "groupId": "A"
      }
    ],
    "note": "Sandbox version for testing"
  }
}
```

**Validation:** See [DATA_MODEL.md](./DATA_MODEL.md) section 5 for full `dataJson` schema.

**Success Response (201):**

```json
{
  "id": "version-uuid",
  "templateId": "template-uuid",
  "versionNumber": 1,
  "status": "DRAFT",
  "dataJson": { /* full data */ },
  "publishedAtUtc": null,
  "createdAtUtc": "2026-01-02T16:00:00.000Z",
  "updatedAtUtc": "2026-01-02T16:00:00.000Z"
}
```

**Error Responses:**

```json
// 400 - Validation Error
{
  "error": "VALIDATION_ERROR",
  "details": {
    "issues": [
      {
        "path": "teams.mex",
        "message": "Team id duplicado: mex"
      }
    ]
  }
}
```

**Notes:**
- `versionNumber` auto-increments per template
- DRAFT versions are editable
- Audit event `TEMPLATE_VERSION_CREATED` logged

---

### 9.5 Update Template Version (DRAFT only)

**Update dataJson of a DRAFT version.**

**Endpoint:** `PUT /admin/templates/:templateId/versions/:versionId`

**Authentication:** Required (ADMIN only)

**Request Body:** Same as create (full `dataJson`)

**Success Response (200):** Updated version object

**Error Responses:**

```json
// 409 - Version Already Published
{
  "error": "CONFLICT",
  "message": "Cannot edit PUBLISHED version"
}
```

**Notes:**
- Only DRAFT versions can be edited
- PUBLISHED versions are immutable

---

### 9.6 Publish Template Version

**Transition version from DRAFT to PUBLISHED.**

**Endpoint:** `POST /admin/templates/:templateId/versions/:versionId/publish`

**Authentication:** Required (ADMIN only)

**Request Body:** None

**Success Response (200):**

```json
{
  "id": "version-uuid",
  "templateId": "template-uuid",
  "versionNumber": 1,
  "status": "PUBLISHED",
  "dataJson": { /* full data */ },
  "publishedAtUtc": "2026-01-02T16:30:00.000Z",
  "createdAtUtc": "2026-01-02T16:00:00.000Z",
  "updatedAtUtc": "2026-01-02T16:30:00.000Z"
}
```

**Effect:**
- Sets `status = PUBLISHED`
- Sets `publishedAtUtc = now()`
- Updates template's `currentPublishedVersionId`
- Version becomes **immutable**
- Audit event `TEMPLATE_VERSION_PUBLISHED` logged

---

## 10. Admin Instance Endpoints

### 10.1 List Instances

**Get all tournament instances.**

**Endpoint:** `GET /admin/instances`

**Authentication:** Required (ADMIN only)

**Query Parameters:**
- `status` (optional): Filter by status ("DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED")

**Success Response (200):**

```json
[
  {
    "id": "instance-uuid",
    "templateId": "template-uuid",
    "templateVersionId": "version-uuid",
    "name": "World Cup 2026 (Sandbox Instance)",
    "status": "ACTIVE",
    "createdAtUtc": "2024-12-29T10:00:00.000Z",
    "updatedAtUtc": "2024-12-29T10:00:00.000Z"
  }
]
```

---

### 10.2 Get Instance

**Get single instance with full data.**

**Endpoint:** `GET /admin/instances/:instanceId`

**Authentication:** Required (ADMIN only)

**Success Response (200):**

```json
{
  "id": "instance-uuid",
  "templateId": "template-uuid",
  "templateVersionId": "version-uuid",
  "name": "World Cup 2026 (Sandbox Instance)",
  "status": "ACTIVE",
  "dataJson": { /* full frozen snapshot */ },
  "createdAtUtc": "2024-12-29T10:00:00.000Z",
  "updatedAtUtc": "2024-12-29T10:00:00.000Z"
}
```

---

### 10.3 Create Instance

**Create instance from a PUBLISHED template version.**

**Endpoint:** `POST /admin/templates/:templateId/instances`

**Authentication:** Required (ADMIN only)

**Request Body:**

```json
{
  "templateVersionId": "version-uuid",
  "name": "World Cup 2026 (Sandbox Instance)"
}
```

**Success Response (201):**

```json
{
  "id": "instance-uuid",
  "templateId": "template-uuid",
  "templateVersionId": "version-uuid",
  "name": "World Cup 2026 (Sandbox Instance)",
  "status": "DRAFT",
  "dataJson": { /* copied from version */ },
  "createdAtUtc": "2026-01-02T17:00:00.000Z",
  "updatedAtUtc": "2026-01-02T17:00:00.000Z"
}
```

**Error Responses:**

```json
// 400 - Version Not Published
{
  "error": "VALIDATION_ERROR",
  "message": "Can only create instances from PUBLISHED versions"
}
```

**Notes:**
- `dataJson` is frozen snapshot from template version
- Initial status: DRAFT
- Audit event `TOURNAMENT_INSTANCE_CREATED` logged

---

### 10.4 Activate Instance

**Transition instance from DRAFT to ACTIVE.**

**Endpoint:** `POST /admin/instances/:instanceId/activate`

**Authentication:** Required (ADMIN only)

**Request Body:** None

**Success Response (200):**

```json
{
  "id": "instance-uuid",
  "status": "ACTIVE",
  "updatedAtUtc": "2026-01-02T17:05:00.000Z"
}
```

**Effect:**
- Instance appears in `/catalog/instances`
- Pools can be created on this instance
- Audit event `TOURNAMENT_INSTANCE_ACTIVATED` logged

---

### 10.5 Complete Instance

**Transition instance from ACTIVE to COMPLETED.**

**Endpoint:** `POST /admin/instances/:instanceId/complete`

**Authentication:** Required (ADMIN only)

**Request Body:** None

**Success Response (200):**

```json
{
  "id": "instance-uuid",
  "status": "COMPLETED",
  "updatedAtUtc": "2026-07-19T23:00:00.000Z"
}
```

**Effect:**
- Instance removed from catalog
- Existing pools continue to function
- No new pools can be created
- Audit event `TOURNAMENT_INSTANCE_COMPLETED` logged

---

### 10.6 Archive Instance

**Transition instance to ARCHIVED (from DRAFT or COMPLETED).**

**Endpoint:** `POST /admin/instances/:instanceId/archive`

**Authentication:** Required (ADMIN only)

**Request Body:** None

**Success Response (200):**

```json
{
  "id": "instance-uuid",
  "status": "ARCHIVED",
  "updatedAtUtc": "2026-10-01T00:00:00.000Z"
}
```

**Effect:**
- Instance hidden from all listings
- Existing pools become read-only (future)
- No new pools can be created
- Audit event `TOURNAMENT_INSTANCE_ARCHIVED` logged

---

## Appendix A: Rate Limiting (Future)

**Planned for v1.0:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 5 requests | 15 minutes |
| `POST /auth/register` | 3 requests | 1 hour |
| All authenticated endpoints | 100 requests | 1 minute |

**Implementation:** Express rate-limit middleware

---

## Appendix B: Pagination (Future)

**Not currently implemented. Planned for v1.1+:**

**Standard pagination params:**
- `page` (number): Page number (1-indexed)
- `limit` (number): Items per page (default: 50, max: 100)

**Response format:**
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

**Endpoints that will need pagination:**
- `GET /me/pools` (if user has 100+ pools)
- `GET /pools/:id/members` (if 500+ members)
- `GET /admin/templates` (if 100+ templates)

---

## Appendix C: Webhook Events (Future v2.0+)

**Planned webhook support for integrations:**

**Events:**
- `pool.created`
- `pool.member_joined`
- `result.published`
- `result.corrected`
- `leaderboard.updated`

**Payload format:**
```json
{
  "event": "result.published",
  "timestamp": "2026-06-11T22:00:00.000Z",
  "data": {
    "poolId": "pool-uuid",
    "matchId": "m1",
    "result": { /* ... */ }
  }
}
```

---

## Appendix D: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Validation rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**END OF DOCUMENT**
