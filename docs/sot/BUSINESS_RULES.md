# Business Rules & Validations
# Picks4All

> **Version:** v0.6.0
> **Last Updated:** 2026-03-05
> **Status:** Living Document (updated as rules evolve)

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [User & Authentication Rules](#2-user--authentication-rules)
3. [Tournament & Template Rules](#3-tournament--template-rules)
4. [Pool Rules](#4-pool-rules)
5. [Pick (Prediction) Rules](#5-pick-prediction-rules)
6. [Result & Errata Rules](#6-result--errata-rules)
7. [Scoring System](#7-scoring-system)
8. [Member Management Rules](#8-member-management-rules)
9. [Corporate Pool Rules](#9-corporate-pool-rules)
10. [Smart Sync & Automatic Results](#10-smart-sync--automatic-results)
11. [Data Integrity Invariants](#11-data-integrity-invariants)
12. [Validation Matrix](#12-validation-matrix)

---

## 1. Core Principles

### 1.1 Fundamental Truths

**These rules MUST NEVER be violated:**

1. **Fairness First:** Once players join, scoring rules cannot change
2. **Transparency:** All actions must be auditable (who did what, when, why)
3. **Immutability:** Critical data (results, published templates) is append-only
4. **Deadline Integrity:** Picks locked after deadline, no exceptions
5. **Single Source of Truth:** Current version is always authoritative
6. **No Retroactive Changes:** Past data cannot be silently altered

---

### 1.2 Design Philosophy

**Fail-Safe vs Fail-Secure:**

| Scenario | Approach | Example |
|----------|----------|---------|
| Validation Error | **Fail-safe** | Return 400 with clear message (don't crash) |
| Auth Failure | **Fail-secure** | Deny access, clear token (don't leak data) |
| Business Rule Violation | **Fail-safe** | Return 409 with explanation |
| Database Error | **Fail-secure** | Rollback transaction, log error |

**Default Deny:** If a rule is ambiguous, deny the action and ask for clarification.

---

## 2. User & Authentication Rules

### 2.1 User Registration

**Validation Rules (Zod schema):**

| Field | Rule | Error Code |
|-------|------|------------|
| `email` | Valid email format (z.string().email()) | `VALIDATION_ERROR` |
| `email` | Unique (case-sensitive DB constraint) | `CONFLICT: Email already exists` |
| `username` | 3-20 characters | `VALIDATION_ERROR` |
| `username` | Unique (case-insensitive via normalizeUsername) | `CONFLICT: Username already exists` |
| `username` | Alphanumeric + underscore + hyphen (validated by `validateUsername`) | `VALIDATION_ERROR` |
| `displayName` | 2-50 characters | `VALIDATION_ERROR` |
| `password` | 8-200 characters | `VALIDATION_ERROR` |
| `timezone` | Optional IANA timezone string | - |

**Legal Consent (required for registration):**

| Field | Rule | Error Code |
|-------|------|------------|
| `acceptTerms` | Must be `true` | `CONSENT_REQUIRED` |
| `acceptPrivacy` | Must be `true` | `CONSENT_REQUIRED` |
| `acceptAge` | Must be `true` (confirms 13+ years) | `AGE_VERIFICATION_REQUIRED` |
| `acceptMarketing` | Optional, defaults to `false` | - |

**Business Rules:**

1. **Default Platform Role:** New users are `PLAYER` (`platformRole: "PLAYER"`)
2. **Default Status:** New users are `ACTIVE`
3. **Username Normalization:** Converted to lowercase before uniqueness check
4. **Password Storage:** Hash with bcrypt via `hashPassword()`, never store plaintext
5. **Email Verification:** Token generated (32 bytes, hex), expires in 24 hours
6. **Audit Logging:** Log `USER_REGISTERED` event with IP, user-agent
7. **Welcome Email:** Verification email sent on registration; welcome email sent after verification

---

### 2.2 User Authentication

**Login Rules:**

1. **Email Lookup:** Exact match (Prisma findUnique)
2. **Password Verification:** Use bcrypt via `verifyPassword()` (timing-safe)
3. **Account Status:** Reject if `status !== "ACTIVE"` (returns 401 UNAUTHENTICATED)
4. **Token Generation:** JWT signed with `signToken({ userId, platformRole })`
5. **Audit Logging:** Log `USER_LOGGED_IN` with IP, user-agent

**Token Rules:**

1. **Bearer Token:** Must be in `Authorization: Bearer <token>` header
2. **Signature Validation:** Verified by `requireAuth` middleware on every request
3. **Expiry Check:** Reject if expired
4. **User Validation:** Re-check user exists and is ACTIVE via middleware

**Google OAuth:**

1. **Token Verification:** `verifyGoogleToken(idToken)` validates with Google
2. **Account Linking:** If email exists without googleId, links automatically
3. **New User:** Auto-generates username from email local part, requires legal consent
4. **Email Verified:** Google accounts are auto-verified (`emailVerified: true`)
5. **Password:** OAuth users have empty passwordHash (`""`)

**Password Reset:**

1. **Token:** 32 bytes `crypto.randomBytes`, hex encoded
2. **Expiry:** 1 hour from generation
3. **Google-Only Accounts:** Returns `GOOGLE_ACCOUNT` error if no local password exists
4. **Security:** Always returns success message regardless of email existence (prevents enumeration)

**Email Verification:**

1. **Token:** 32 bytes `crypto.randomBytes`, hex encoded, stored in `emailVerificationToken`
2. **Expiry:** 24 hours from generation
3. **Resend:** Authenticated users can request new verification email via `POST /auth/resend-verification`
4. **Idempotent:** If already verified, returns `alreadyVerified: true`

---

### 2.3 Rate Limiting

| Limiter | Scope | Limit | Window | Error Code |
|---------|-------|-------|--------|------------|
| `apiLimiter` | All API endpoints (except /health) | 100 requests | 1 minute | `RATE_LIMIT_EXCEEDED` |
| `authLimiter` | `POST /auth/login`, `POST /auth/register` | 10 attempts | 15 minutes | `TOO_MANY_LOGIN_ATTEMPTS` |
| `passwordResetLimiter` | `POST /auth/forgot-password`, `POST /auth/reset-password` | 5 requests | 1 hour | `TOO_MANY_RESET_REQUESTS` |
| `createResourceLimiter` | Pool/invite creation | 20 creations | 1 hour | `TOO_MANY_CREATIONS` |
| `inquiryLimiter` | `POST /corporate/inquiry` | 5 submissions | 15 minutes | `RATE_LIMITED` |

All rate limiters return standard `RateLimit-*` headers and 429 status on exceed.

---

## 3. Tournament & Template Rules

### 3.1 Tournament Template Rules

**Creation Rules:**

1. **Key Uniqueness:** `key` must be globally unique
2. **Key Format:** Example: `"worldcup_2026"`, `"ucl_2025"`
3. **Key Immutability:** Cannot change key after creation
4. **Default Status:** New templates are `DRAFT`

**Version Rules:**

1. **Version Numbering:** Auto-increment per template (1, 2, 3, ...)
2. **Draft Editability:** DRAFT versions can be edited/deleted
3. **Published Immutability:** PUBLISHED versions **cannot** be edited
4. **Publishing Requirement:** Must pass validation before publishing
5. **Current Version:** Template's `currentPublishedVersionId` points to latest PUBLISHED version

**Template Status Enum:** `DRAFT | PUBLISHED | DEPRECATED`

---

### 3.2 Tournament Instance Rules

**Creation Rules:**

1. **Source Version:** Must be created from a PUBLISHED template version
2. **Snapshot Freeze:** `dataJson` is copied from version at creation time
3. **Immutability:** Instance `dataJson` **never changes** even if template updates
4. **Default Status:** New instances are `DRAFT`
5. **Result Source Mode:** `MANUAL` (default) or `AUTO` (API-Football integration)

**State Transition Rules:**

```
DRAFT --> ACTIVE --> COMPLETED --> ARCHIVED
```

**Instance Status Enum:** `DRAFT | ACTIVE | COMPLETED | ARCHIVED`

**Pool Creation Rules:**

| Instance Status | Can Create Pools | Reason |
|-----------------|:----------------:|--------|
| DRAFT | Depends on admin | May be available for testing |
| ACTIVE | Yes | Available in catalog |
| COMPLETED | No | Tournament ended |
| ARCHIVED | No | Returns `409 CONFLICT` |

---

## 4. Pool Rules

### 4.1 Pool Creation Rules

**Required Fields (Zod schema `createPoolSchema`):**

| Field | Validation | Default |
|-------|------------|---------|
| `tournamentInstanceId` | Must exist, not ARCHIVED | - |
| `name` | 3-120 characters | - |
| `description` | Max 500 characters or null | null |
| `timeZone` | 3-64 characters, IANA timezone | `"UTC"` |
| `deadlineMinutesBeforeKickoff` | Integer, 0-1440 (0 to 24 hours) | 10 |
| `scoringPresetKey` | `"CLASSIC"` / `"OUTCOME_ONLY"` / `"EXACT_HEAVY"` (legacy) | `"CLASSIC"` |
| `requireApproval` | Boolean | false |
| `maxParticipants` | Integer, 20-10000 | 20 |
| `pickTypesConfig` | Preset key (`"CUMULATIVE"` / `"BASIC"` / `"SIMPLE"`) or custom config object | null |

**Automatic Actions:**

1. **Creator as HOST:** User who creates pool becomes HOST (via PoolMember record)
2. **Default Visibility:** `PRIVATE`
3. **Fixture Snapshot:** Pool gets its own copy of `instance.dataJson` in `fixtureSnapshot`
4. **Audit Event:** Log `POOL_CREATED`
5. **No auto invite code:** Invite codes must be explicitly created

**Pick Types Config Processing:**

- If `pickTypesConfig` is a string (`"CUMULATIVE"`, `"BASIC"`, `"SIMPLE"`): Generates dynamic config using the actual phases from the tournament instance
- If `pickTypesConfig` is an object: Validates against `PoolPickTypesConfigSchema`
- If null: Uses legacy scoring via `scoringPresetKey`

---

### 4.2 Pool State Machine

**States:** `DRAFT | ACTIVE | COMPLETED | ARCHIVED`

```
DRAFT -----> ACTIVE -----> COMPLETED -----> ARCHIVED
```

**State Transitions (from `poolStateMachine.ts`):**

| From | To | Trigger | Conditions |
|------|-----|---------|------------|
| DRAFT | ACTIVE | `transitionToActive()` | First PLAYER joins (directly or via approval) |
| ACTIVE | COMPLETED | `transitionToCompleted()` | All matches in tournament have published results |
| COMPLETED | ARCHIVED | `transitionToArchived()` | Manual by HOST |

**State-Dependent Permissions:**

| Action | DRAFT | ACTIVE | COMPLETED | ARCHIVED |
|--------|:-----:|:------:|:---------:|:--------:|
| Join pool | Yes | Yes | No | No |
| Make picks | No | Yes | No | No |
| Publish results | No | Yes | Yes (erratas) | No |
| Edit pool settings | Yes | No | No | No |
| Create invites | Yes | Yes | No | No |

---

### 4.3 Pool Configuration Editability

**Editable in DRAFT only:**

- `timeZone`
- `deadlineMinutesBeforeKickoff`
- Scoring configuration

**NEVER Editable after creation:**

- `scoringPresetKey` / `pickTypesConfig` (enforced by `canEditPoolSettings`)
- `tournamentInstanceId`

---

### 4.4 Join Pool Rules

**Join Flow (POST /pools/join):**

1. **Invite Code Lookup:** Must exist in `PoolInvite` table
2. **Pool Status Check:** `canJoinPool()` requires DRAFT or ACTIVE
3. **Invite Expiry:** Check `expiresAtUtc` if set
4. **Invite Max Uses:** Check `uses < maxUses` if maxUses set
5. **Capacity Check:** If `pool.maxParticipants` set, count ACTIVE + PENDING_APPROVAL members
6. **Ban Check:** If user is BANNED, reject with `403 BANNED_FROM_POOL`
7. **Duplicate Check:** If already ACTIVE, return current status
8. **Rejoin Check:** If status is LEFT, reactivate with new status (ACTIVE or PENDING_APPROVAL)
9. **Approval Mode:** If `pool.requireApproval = true`, set status to `PENDING_APPROVAL`

**Join Approval Workflow (`requireApproval = true`):**

1. **Submit Request:** User joins with status `PENDING_APPROVAL`
2. **Approve:** HOST/CO_ADMIN calls `POST /pools/:poolId/members/:memberId/approve`
   - Sets status to ACTIVE, records `approvedByUserId` and `approvedAtUtc`
   - Triggers `transitionToActive()` if pool is DRAFT
3. **Reject:** HOST/CO_ADMIN calls `POST /pools/:poolId/members/:memberId/reject`
   - Deletes the PoolMember record (user can try again)
   - Optional `reason` (1-500 chars)

**Post-Join Actions:**

- Increment invite `uses` counter
- Trigger `transitionToActive()` if pool is DRAFT and join was direct
- Send `POOL_FULL` notification email to HOST if capacity reached

---

### 4.5 Invite Code Rules

**Generation:**

- 12-character hex string (e.g., `a3f9c2d8e1b4`)
- `crypto.randomBytes(6).toString("hex")`
- Collision retry: up to 5 attempts

**Creation Schema:**

| Field | Validation | Default |
|-------|------------|---------|
| `maxUses` | Integer, 1-500, optional | null (unlimited) |
| `expiresAtUtc` | ISO 8601 datetime, optional | null (never expires) |

**Who Can Create:**

- HOST or CO_ADMIN (verified by `requirePoolHostOrCoAdmin`)
- Pool status must allow invites: DRAFT or ACTIVE

**Email Invitations:**

- HOST/CO_ADMIN can send invite email via `POST /pools/:poolId/send-invite-email`
- Respects target user's email notification preferences
- Returns `skipped: true` if user has disabled pool invitation emails

---

### 4.6 Leave Pool Rules

**Endpoint:** `POST /pools/:poolId/leave`

**Who Can Leave:**

| Role | Can Leave |
|------|:---------:|
| PLAYER | Yes |
| CO_ADMIN | Yes |
| HOST | **No** (returns `403 HOST_CANNOT_LEAVE`) |
| CORPORATE_HOST | **No** (returns `403 HOST_CANNOT_LEAVE`) |

**Effect:**

- Sets `PoolMember.status = "LEFT"`
- Sets `PoolMember.leftAtUtc = now()`
- Picks remain in the database
- Points preserved in leaderboard (shown as "Retirado")
- User enters read-only mode (can view pool but cannot submit picks)
- Audit event: `MEMBER_LEFT`

**Rejoin After Leave:**

- User can rejoin with a valid invite code
- PoolMember record is reactivated (status set to ACTIVE or PENDING_APPROVAL)
- `leftAtUtc` is cleared
- Previous picks are preserved

---

## 5. Pick (Prediction) Rules

### 5.1 Pick Submission Rules

**Endpoint:** `PUT /pools/:poolId/picks/:matchId`

**Uniqueness Constraint:**

- `(poolId, userId, matchId)` must be unique (DB unique constraint)
- One pick per match per user per pool

**Pick Schema (Zod discriminated union):**

```
Type 1: OUTCOME
  { type: "OUTCOME", outcome: "HOME" | "DRAW" | "AWAY" }

Type 2: SCORE
  { type: "SCORE", homeGoals: int(0-99), awayGoals: int(0-99) }

Type 3: WINNER
  { type: "WINNER", winnerTeamId: string(1-50) }
```

**Deadline Enforcement:**

```
deadlineUtc = kickoffUtc - (pool.deadlineMinutesBeforeKickoff * 60000)

if (now > deadlineUtc) -> 409 DEADLINE_PASSED
```

**Additional Validations:**

1. **Pool Status:** `canMakePicks()` requires pool status ACTIVE
2. **Member Status:** Must be ACTIVE member (not LEFT, BANNED, or PENDING_APPROVAL)
3. **Instance Status:** Cannot pick on ARCHIVED tournament instance
4. **Match Existence:** `matchId` must exist in tournament instance snapshot
5. **Placeholder Teams:** Cannot pick on matches with TBD teams (prefixes: `t_TBD`, `W_`, `RU_`, `L_`, `3rd_`)

**Upsert Behavior:**

- Uses Prisma `upsert` on the compound unique `(poolId, userId, matchId)`
- If pick exists: **Update** (`pickJson` overwritten, `updatedAtUtc` auto-updated)
- If pick doesn't exist: **Create** new Prediction record
- Audit event: `PREDICTION_UPSERTED`

---

### 5.2 Pick Visibility Rules

**Before Deadline (match not locked):**

- Only the current user's own pick is visible
- Other users' picks are hidden
- Response includes `isUnlocked: false`

**After Deadline (match locked):**

- All active members' picks are visible
- Response includes `isUnlocked: true`
- Sorted: current user first, then alphabetical by displayName

---

### 5.3 Structural Picks

**For SIMPLE preset and custom configs with `structuralPicks`:**

**GROUP_STANDINGS Pick:**

- Stored in `GroupStandingsPrediction` model
- Per group: `{ groupId, teamIds: [1st, 2nd, 3rd, 4th] }`
- Unique constraint: `(poolId, userId, phaseId, groupId)`

**KNOCKOUT_WINNER Pick:**

- Stored in `StructuralPrediction` model
- Per phase: `{ matches: [{ matchId, winnerId }] }`
- Unique constraint: `(poolId, userId, phaseId)`

---

## 6. Result & Errata Rules

### 6.1 Result Publication Rules

**Endpoint:** `PUT /pools/:poolId/results/:matchId`

**Who Can Publish:**

- HOST (always)
- CO_ADMIN (always)
- Validated by `requirePoolHostOrCoAdmin()`

**Pool Status Check:**

- `canPublishResults()` requires ACTIVE or COMPLETED
- COMPLETED allows erratas (corrections) on existing results

**Result Schema (Zod):**

| Field | Validation | Required |
|-------|------------|----------|
| `homeGoals` | Integer, 0-99 | Yes |
| `awayGoals` | Integer, 0-99 | Yes |
| `homeGoals90` | Integer, 0-99 | No (only if extra time played) |
| `awayGoals90` | Integer, 0-99 | No (only if extra time played) |
| `homePenalties` | Integer, 0-99 | No (knockout only) |
| `awayPenalties` | Integer, 0-99 | No (knockout only) |
| `reason` | String, 1-500 chars | Required for errata (version > 1) |

---

### 6.2 Result Source Tracking

**Result Source Enum:** `HOST_MANUAL | HOST_PROVISIONAL | API_CONFIRMED | HOST_OVERRIDE`

**Source Determination Logic:**

| Instance Mode | Previous Result | New Source |
|---------------|----------------|------------|
| MANUAL | Any | `HOST_MANUAL` |
| AUTO | None | `HOST_PROVISIONAL` |
| AUTO | `API_CONFIRMED` | `HOST_OVERRIDE` (requires reason) |
| AUTO | `HOST_PROVISIONAL` | `HOST_PROVISIONAL` |
| AUTO | `HOST_OVERRIDE` | `HOST_OVERRIDE` |

---

### 6.3 Version Immutability

**Rules:**

1. Once created, `PoolMatchResultVersion` is **immutable** (no UPDATEs)
2. All versions retained (full history)
3. Only `currentVersion` used for scoring
4. `PoolMatchResult.currentVersionId` always points to latest version
5. Version numbering: auto-increment per result header (1, 2, 3, ...)

**Errata (Version > 1):**

- `reason` is **REQUIRED** (1-500 chars, enforced in transaction)
- If `reason` is null or empty: Transaction throws `REASON_REQUIRED_FOR_ERRATA`
- If source is `HOST_OVERRIDE`: Also throws `REASON_REQUIRED_FOR_OVERRIDE`
- Audit event: `RESULT_PUBLISHED` (same event for all versions)

---

### 6.4 Post-Result Actions

**After publishing a result, the system automatically:**

1. **Email Notifications:** Sends result notification to all active pool members (async, non-blocking)
   - Includes match description, score, points earned, current ranking
2. **Auto-Advance:** Checks if the completed match's phase is now fully resolved
   - Group stage complete: advances to Round of 32
   - Knockout phase complete: advances to next knockout phase
   - Only if `pool.autoAdvanceEnabled = true` and phase is not locked
3. **Pool Completion:** Checks if ALL matches have results via `transitionToCompleted()`
   - If yes, pool status changes to COMPLETED
   - Sends pool completed emails with final rankings

---

### 6.5 Penalty Shootout Rules

**Storage:**

- `homePenalties` and `awayPenalties` in `PoolMatchResultVersion`
- Default: `null` (not applicable)

**Winner Determination (knockout phases):**

1. Check regulation time score (homeGoals vs awayGoals)
2. If tied, check penalties
3. Winner is the team with more penalty goals

**Scoring Impact:**

- Penalties do NOT affect pick scoring (players predict regulation time score)
- Penalties determine team advancement only

---

### 6.6 Extra Time Configuration

**Per-phase `includeExtraTime` flag:**

- If `true`: Scoring uses `homeGoals`/`awayGoals` (full time including ET)
- If `false` or absent: Scoring uses `homeGoals90`/`awayGoals90` (90-minute score), falling back to `homeGoals`/`awayGoals` if 90-minute score not available

---

### 6.7 Auto-Advance & Phase Locking Rules

**Pool Configuration:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoAdvanceEnabled` | boolean | `true` | Enable/disable automatic phase advancement |
| `lockedPhases` | JSON array | `[]` | List of phaseIds manually locked by host |

**Auto-Advance Trigger:**

- Triggered after every result publication
- Validates via `validateCanAutoAdvance(instanceId, phaseId, poolId)`
- If blocked, logs reason but does NOT fail the result publication

**Phase Advancement Order:**

```
group_stage -> round_of_32 -> round_of_16 -> quarter_finals -> semi_finals -> finals
```

**Manual Advance:**

- Endpoint: `POST /pools/:poolId/advance-phase`
- Only HOST can trigger
- Validates phase completeness before advancing

**Phase Locking:**

- Only HOST can lock/unlock phases
- Locked phases are skipped by auto-advance
- Purpose: allows time to correct errors before advancing

---

## 7. Scoring System

### 7.1 Legacy Scoring Presets

**Used when `pickTypesConfig` is null (backward compatibility):**

| Preset | Key | Outcome Points | Exact Score Bonus | Allow Score Pick |
|--------|-----|:--------------:|:-----------------:|:----------------:|
| Clasico | `CLASSIC` | 3 | 2 | Yes |
| Solo ganador/empate | `OUTCOME_ONLY` | 3 | 0 | No |
| Marcador pesado | `EXACT_HEAVY` | 2 | 3 | Yes |

**Legacy Scoring Logic:**

- OUTCOME pick correct: +outcomePoints
- SCORE pick, outcome correct: +outcomePoints
- SCORE pick, exact score correct: +exactScoreBonus (only if outcome also correct)
- Maximum per match (CLASSIC): 5 points (3 + 2)

---

### 7.2 Advanced Pick Type Presets

**Used when `pickTypesConfig` is set (per-phase configuration):**

#### CUMULATIVE Preset

Points accumulate for each correct criterion:

| Criterion | Group Stage | Knockout |
|-----------|:-----------:|:--------:|
| Match Outcome (90 min) | 5 pts | 10 pts |
| Home Goals Exact | 2 pts | 4 pts |
| Away Goals Exact | 2 pts | 4 pts |
| Goal Difference | 1 pt | 2 pts |
| **Max per match (exact score)** | **10 pts** | **20 pts** |

#### BASIC Preset

Only exact score, with auto-scaling by phase:

| Phase | Points |
|-------|:------:|
| Group Stage | 20 pts |
| Round of 16 | 30 pts |
| Quarter Finals | 40 pts |
| Semi Finals | 50 pts |
| Final | 60 pts |

Auto-scaling multipliers: 1.0x (groups) -> 1.5x -> 2.0x -> 2.5x -> 3.0x (final)

#### SIMPLE Preset

No match scores -- structural picks only:

| Phase Type | Pick Type | Points |
|------------|-----------|:------:|
| Group Stage | GROUP_STANDINGS: Exact position | 10 pts per correct position |
| Group Stage | GROUP_STANDINGS: Perfect group bonus | +20 pts |
| Round of 32 | KNOCKOUT_WINNER: Correct advance | 10 pts |
| Round of 16 | KNOCKOUT_WINNER: Correct advance | 15 pts |
| Quarter Finals | KNOCKOUT_WINNER: Correct advance | 20 pts |
| Semi Finals | KNOCKOUT_WINNER: Correct advance | 25 pts |
| Final | KNOCKOUT_WINNER: Correct advance | 30 pts |

#### CUSTOM Config

- Host provides full `PhasePickConfig[]` array
- Validated by `validatePoolPickTypesConfig()`
- Each phase can have different enabled pick types and point values

---

### 7.3 Advanced Scoring Engine (`scoringAdvanced.ts`)

**Two scoring systems detected automatically:**

**1. Cumulative System** (when HOME_GOALS or AWAY_GOALS types are enabled):

- Evaluates ALL criteria independently
- Points from each matching criterion are summed
- Criteria evaluated: MATCH_OUTCOME_90MIN, HOME_GOALS, AWAY_GOALS, GOAL_DIFFERENCE, TOTAL_GOALS

**2. Legacy System** (when using EXACT_SCORE):

- EXACT_SCORE evaluated first; if matched, **terminates evaluation** (no further checks)
- If EXACT_SCORE misses, evaluates remaining types in order: GOAL_DIFFERENCE, PARTIAL_SCORE, TOTAL_GOALS, MATCH_OUTCOME_90MIN

**Evaluation Functions:**

| Type | Logic |
|------|-------|
| `EXACT_SCORE` | `pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals` |
| `GOAL_DIFFERENCE` | `(pick.home - pick.away) === (result.home - result.away)` |
| `PARTIAL_SCORE` | Exactly one of home/away goals matches (XOR) |
| `TOTAL_GOALS` | `(pick.home + pick.away) === (result.home + result.away)` |
| `MATCH_OUTCOME_90MIN` | Same outcome (HOME/DRAW/AWAY) based on goals |
| `HOME_GOALS` | `pick.homeGoals === result.homeGoals` |
| `AWAY_GOALS` | `pick.awayGoals === result.awayGoals` |

**Auto-Scaling:**

- Optional per-preset, configured in `matchPicks.autoScaling`
- Multipliers map phase IDs to scaling factors
- Applied via `applyAutoScaling()` and `applyAutoScalingToConfig()`

---

### 7.4 Leaderboard Ranking Rules

**Primary Sort:** `totalPoints DESC`

**Tiebreaker:** `joinedAtUtc ASC` (earliest member wins)

**Leaderboard Composition:**

- Includes members with status ACTIVE and LEFT
- LEFT members retain their points and rank (shown as "Retirado")
- BANNED members are excluded from leaderboard display
- Points combine: match pick points + structural pick points

**Points Breakdown:**

- `pointsByPhase`: Points broken down by tournament phase
- `matchPickPoints`: Points from match-level predictions
- `structuralPickPoints`: Points from structural predictions (GROUP_STANDINGS, KNOCKOUT_WINNER)

---

## 8. Member Management Rules

### 8.1 Role Permissions Matrix

| Action | HOST | CORPORATE_HOST | CO_ADMIN | PLAYER |
|--------|:----:|:--------------:|:--------:|:------:|
| Publish/correct results | Yes | Yes | Yes | No |
| Generate invite codes | Yes | Yes | Yes | No |
| Send invite emails | Yes | Yes | Yes | No |
| Approve/reject join requests | Yes | N/A | Yes | No |
| Kick players | Yes | N/A | Yes | No |
| Ban players | Yes | N/A | Yes | No |
| Advance phases manually | Yes | N/A | No | No |
| Nominate co-admins | Yes | N/A | No | No |
| Remove co-admins | Yes | N/A | No | No |
| Archive pool | Yes | N/A | No | No |
| Leave pool | No | No | Yes | Yes |

**Note:** CORPORATE_HOST has result management and invite permissions via the overview endpoint (`canManageResults` and `canInvite` both true), but manages employees through the corporate-specific endpoints rather than the standard member management flow.

---

### 8.2 Kick Rules

**Endpoint:** `POST /pools/:poolId/members/:memberId/kick`

**Who Can Kick:** HOST or CO_ADMIN

**Schema:**

| Field | Validation | Required |
|-------|------------|----------|
| `reason` | String, optional | No |

**Validations:**

1. Target must be ACTIVE member (`status === "ACTIVE"`)
2. Cannot kick yourself (`CANNOT_KICK_SELF`)
3. Cannot kick the pool creator (`CANNOT_KICK_HOST`)

**Effect:**

- Sets `status = "LEFT"`, `leftAtUtc = now()`
- Picks remain in the database
- User CAN rejoin with a new invite code
- Audit event: `MEMBER_KICKED`

---

### 8.3 Ban Rules

**Endpoint:** `POST /pools/:poolId/members/:memberId/ban`

**Who Can Ban:** HOST or CO_ADMIN

**Schema:**

| Field | Validation | Required |
|-------|------------|----------|
| `reason` | String, min 1 char | **Yes** (mandatory) |
| `deletePicks` | Boolean | No (default false) |

**Validations:**

1. Target must be ACTIVE member (`status === "ACTIVE"`)
2. Cannot ban yourself (`CANNOT_BAN_SELF`)
3. Cannot ban the pool creator (`CANNOT_BAN_HOST`)

**Effect:**

- Sets `status = "BANNED"`, records `bannedAt`, `bannedByUserId`, `banReason`
- `banExpiresAt = null` (always permanent in current implementation)
- If `deletePicks = true`: All user's predictions in this pool are deleted
- If `deletePicks = false`: Picks remain visible
- User **CANNOT** rejoin (blocked by `BANNED_FROM_POOL` check in join flow)
- Audit event: `MEMBER_BANNED`

---

### 8.4 Member Status Enum

| Status | Description |
|--------|-------------|
| `PENDING_APPROVAL` | Waiting for HOST/CO_ADMIN to approve join request |
| `ACTIVE` | Full member, can make picks and view pool |
| `LEFT` | Voluntarily left or kicked; read-only access, points preserved |
| `BANNED` | Permanently expelled; cannot rejoin |

---

## 9. Corporate Pool Rules

### 9.1 Corporate Inquiry

**Endpoint:** `POST /corporate/inquiry` (public, no auth required)

**Schema:**

| Field | Validation | Required |
|-------|------------|----------|
| `companyName` | 2-200 chars | Yes |
| `contactName` | 2-100 chars | Yes |
| `contactEmail` | Valid email, max 255 | Yes |
| `contactPhone` | Max 30 chars | No |
| `employeeCount` | Enum: `"1-50"`, `"51-200"`, `"201-500"`, `"500+"` | No |
| `message` | Max 2000 chars | No |
| `locale` | `"es"`, `"en"`, `"pt"` | Default: `"es"` |

**Actions:**

- Creates `OrganizationInquiry` record
- Sends admin notification email
- Sends confirmation email to contact

---

### 9.2 Corporate Pool Creation

**Endpoint:** `POST /corporate/pools` (authenticated)

**Schema:**

| Field | Validation | Default |
|-------|------------|---------|
| `companyName` | 2-200 chars | - |
| `logoBase64` | Max 700,000 chars | null |
| `welcomeMessage` | Max 1000 chars | null |
| `invitationMessage` | Max 1000 chars | null |
| `tournamentInstanceId` | Must exist, not ARCHIVED | - |
| `poolName` | 3-120 chars | - |
| `poolDescription` | Max 500 chars | null |
| `timeZone` | Optional IANA | `"UTC"` |
| `deadlineMinutesBeforeKickoff` | 0-1440 | 10 |
| `requireApproval` | Boolean | false |
| `pickTypesConfig` | Preset key or custom config | null |
| `maxParticipants` | Integer, 100-10000 | 100 |
| `emails` | Array of emails, max 500 | null |

**Transaction creates:**

1. `Organization` (status: ACTIVE) with company info and branding
2. `Pool` (visibility: PRIVATE) linked to organization
3. `PoolMember` with role `CORPORATE_HOST`
4. `CorporateInvite` records for each email (with activation tokens)

**Corporate Invite Token:**

- 48 bytes `crypto.randomBytes`, hex encoded (96 chars)
- Expires in 30 days
- Unique per (poolId, email) combination

---

### 9.3 Corporate Activation

**Check Invite:** `GET /auth/check-corporate-invite?token=xxx`

- Returns email, poolName, companyName, and whether user already exists

**Activate:** `POST /auth/activate-corporate`

**Two flows:**

**Existing User:**

- Finds user by email
- Adds as PLAYER to pool (if not already member)
- Marks invite as ACTIVATED
- Triggers `transitionToActive()` for pool

**New User:**

- Requires: `displayName`, `username`, `password`, `acceptTerms`, `acceptPrivacy`, `acceptAge`
- Creates user account (emailVerified: true, auto-verified for corporate)
- Creates PoolMember (role: PLAYER)
- Marks invite as ACTIVATED
- Triggers `transitionToActive()` for pool

**Capacity Check:**

- Both flows check `pool.maxParticipants` before adding member
- Returns `409 POOL_FULL` if at capacity

**Corporate Invite Status Enum:** `PENDING | SENT | ACTIVATED | FAILED`

---

## 10. Smart Sync & Automatic Results

### 10.1 Result Source Modes

**Instance-level configuration:**

| Mode | Description |
|------|-------------|
| `MANUAL` | Host enters results manually (default) |
| `AUTO` | Results obtained automatically from API-Football |

**AUTO Mode Configuration:**

| Field | Description |
|-------|-------------|
| `apiFootballLeagueId` | League ID in API-Football |
| `apiFootballSeasonId` | Season/year in API-Football |
| `lastSyncAtUtc` | Last successful sync timestamp |
| `syncEnabled` | Kill switch for emergency sync stop |

---

### 10.2 Match Sync State Machine

**States:** `PENDING -> IN_PROGRESS -> AWAITING_FINISH -> COMPLETED`

| State | Description | Trigger |
|-------|-------------|---------|
| `PENDING` | Waiting for kickoff + 5 minutes | Default for new matches |
| `IN_PROGRESS` | Match started, waiting for estimated finish | `firstCheckAtUtc` reached |
| `AWAITING_FINISH` | Past estimated end, polling every 5 minutes | `finishCheckAtUtc` reached |
| `COMPLETED` | Match finished, never check again | API returns "FT" status |
| `SKIPPED` | No API mapping or manual mode | No external fixture ID |

---

### 10.3 Match External Mapping

- `MatchExternalMapping` links internal match IDs to API-Football fixture IDs
- Unique constraints: `(tournamentInstanceId, internalMatchId)` and `(tournamentInstanceId, apiFootballFixtureId)`
- Optional verification fields: `apiFootballHomeTeamId`, `apiFootballAwayTeamId`

---

### 10.4 Sync Logging

- `ResultSyncLog` tracks each sync job execution
- Records: fixtures checked, updated, skipped, errors
- Tracks API response time and rate limit remaining

---

## 11. Data Integrity Invariants

### 11.1 Database Constraints (Must NEVER Be Violated)

1. **User email uniqueness** (`@unique` on User.email)
2. **User username uniqueness** (`@unique` on User.username)
3. **`(poolId, userId)` uniqueness** (PoolMember `@@unique`)
4. **`(poolId, userId, matchId)` uniqueness** (Prediction `@@unique`)
5. **`(poolId, matchId)` uniqueness** (PoolMatchResult `@@unique`)
6. **`(resultId, versionNumber)` uniqueness** (PoolMatchResultVersion `@@unique`)
7. **`(poolId, userId, phaseId)` uniqueness** (StructuralPrediction)
8. **`(poolId, userId, phaseId, groupId)` uniqueness** (GroupStandingsPrediction)
9. **`(poolId, phaseId, groupId)` uniqueness** (GroupStandingsResult)
10. **`(poolId, email)` uniqueness** (CorporateInvite)
11. **Foreign key integrity** (all relations enforced by Prisma)

### 11.2 Application-Level Invariants

1. **Exactly one HOST (or CORPORATE_HOST) per pool** (enforced at creation)
2. **Result version immutability** (no UPDATEs to PoolMatchResultVersion)
3. **Template version immutability** (PUBLISHED versions read-only)
4. **Current version always set** (`currentVersionId` never null after first publish)
5. **Errata reason required** (version > 1 requires reason, enforced in transaction)
6. **Override reason required** (`HOST_OVERRIDE` source requires reason)
7. **Picks locked after deadline** (enforced in API, not DB trigger)
8. **Hosts cannot leave** (HOST and CORPORATE_HOST blocked from leave endpoint)
9. **Banned users cannot rejoin** (checked in join transaction)

---

### 11.3 Soft Invariants (Enforced in API)

These should be checked but won't cause data corruption if violated:

- Pool scoring rules not editable after pool creation (integrity, not corruption)
- Template key immutability (structural, not functional)
- Instance status transitions forward-only (operational, not critical)

---

## 12. Validation Matrix

### 12.1 Request Body Validation

**All endpoints use Zod schemas. Example validation errors:**

| Field Error | HTTP Status | Error Code | Message |
|-------------|-------------|------------|---------|
| Missing required field | 400 | VALIDATION_ERROR | "Required" |
| Wrong type | 400 | VALIDATION_ERROR | "Expected number, received string" |
| Out of range | 400 | VALIDATION_ERROR | "Number must be greater than 0" |
| Invalid enum | 400 | VALIDATION_ERROR | "Invalid enum value..." |
| String too short | 400 | VALIDATION_ERROR | "String must contain at least N character(s)" |
| String too long | 400 | VALIDATION_ERROR | "String must contain at most N character(s)" |

---

### 12.2 Business Rule Violation Errors

| Rule Violation | HTTP Status | Error Code | Example Message |
|----------------|-------------|------------|-----------------|
| Deadline passed | 409 | DEADLINE_PASSED | (includes deadlineUtc and nowUtc) |
| Not a member | 403 | FORBIDDEN | "Not a member of this pool" |
| Not host/co-admin | 403 | FORBIDDEN | "Only HOST/CO_ADMIN can perform this action" |
| Duplicate email | 409 | CONFLICT | "Email already exists" |
| Duplicate username | 409 | CONFLICT | "Username already exists" |
| Invalid credentials | 401 | UNAUTHENTICATED | (no details for security) |
| Disabled account | 401 | UNAUTHENTICATED | (same as invalid credentials) |
| Instance archived | 409 | CONFLICT | "Cannot create pool on ARCHIVED instance" |
| Code expired | 409 | CONFLICT | "Invite expired" |
| Code exhausted | 409 | CONFLICT | "Invite maxUses reached" |
| Already member | 409 | CONFLICT | (returns existing status) |
| Banned user | 403 | BANNED_FROM_POOL | "Has sido expulsado permanentemente..." |
| Pool full | 409 | POOL_FULL | "Este pool ha alcanzado su capacidad maxima." |
| Errata without reason | 400 | VALIDATION_ERROR | "reason is required for errata (version > 1)" |
| Override without reason | 400 | VALIDATION_ERROR | "REASON_REQUIRED_FOR_OVERRIDE" |
| Pool not accepting joins | 409 | CONFLICT | "Pool is not accepting new members" |
| Cannot make picks | 409 | CONFLICT | "Cannot make picks in this pool status" |
| Cannot publish results | 409 | CONFLICT | "Cannot publish results in this pool status" |
| Placeholder match | 409 | MATCH_PENDING | "Cannot make picks on matches with teams not yet determined" |
| Host cannot leave | 403 | HOST_CANNOT_LEAVE | "Hosts cannot leave their own pool" |
| Cannot kick self | 400 | CANNOT_KICK_SELF | "You cannot kick yourself" |
| Cannot kick host | 400 | CANNOT_KICK_HOST | "Cannot kick the pool creator" |
| Cannot ban self | 400 | CANNOT_BAN_SELF | "You cannot ban yourself" |
| Cannot ban host | 400 | CANNOT_BAN_HOST | "Cannot ban the pool creator" |
| Legal consent missing | 400 | CONSENT_REQUIRED | "Debes aceptar los Terminos de Servicio..." |
| Age verification missing | 400 | AGE_VERIFICATION_REQUIRED | "Debes confirmar que tienes al menos 13 anos..." |
| Google-only account | 400 | GOOGLE_ACCOUNT | "Esta cuenta utiliza Google para iniciar sesion..." |
| Invalid reset token | 400 | INVALID_TOKEN | "Token invalido o expirado" |
| Corporate token expired | 400 | TOKEN_EXPIRED | "El enlace de activacion ha expirado..." |
| Already activated | 409 | ALREADY_ACTIVATED | "Esta invitacion ya fue activada." |
| Rate limited | 429 | RATE_LIMIT_EXCEEDED / TOO_MANY_LOGIN_ATTEMPTS | "Demasiadas solicitudes..." |

---

## Appendix A: Validation Checklist (For Developers)

**Before implementing new endpoint, ensure:**

- [ ] Zod schema defined for request body
- [ ] Authentication checked (`requireAuth` middleware)
- [ ] Authorization checked (role/permission validation via `requirePoolHostOrCoAdmin` or similar)
- [ ] Pool state checked (use `poolStateMachine` functions)
- [ ] Input sanitized (Zod handles this)
- [ ] Business rules validated (deadline, membership, capacity, etc.)
- [ ] Database constraints enforced (unique, foreign keys)
- [ ] Transaction used for multi-step operations
- [ ] Audit event logged (if sensitive action)
- [ ] Email notifications sent where appropriate (async, non-blocking)
- [ ] Rate limiting applied where needed
- [ ] Clear error messages returned (user-facing, i18n-aware)
- [ ] TypeScript types match Prisma schema

---

## Appendix B: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [API_SPEC.md](./API_SPEC.md) - API contracts
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DECISION_LOG.md](./DECISION_LOG.md) - Architectural decision records

---

**END OF DOCUMENT**
