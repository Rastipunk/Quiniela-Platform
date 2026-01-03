# Business Rules & Validations
# Quiniela Platform

> **Version:** 1.0 (v0.1-alpha implementation + v0.2-beta planned)
> **Last Updated:** 2026-01-02
> **Status:** Living Document (updated as rules evolve)

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [User & Authentication Rules](#2-user--authentication-rules)
3. [Tournament & Template Rules](#3-tournament--template-rules)
4. [Pool Rules](#4-pool-rules)
5. [Pick (Prediction) Rules](#5-pick-prediction-rules)
6. [Result & Errata Rules](#6-result--errata-rules)
7. [Leaderboard & Scoring Rules](#7-leaderboard--scoring-rules)
8. [Member Management Rules](#8-member-management-rules)
9. [Data Integrity Invariants](#9-data-integrity-invariants)
10. [Validation Matrix](#10-validation-matrix)

---

## 1. Core Principles

### 1.1 Fundamental Truths

**These rules MUST NEVER be violated:**

1. **Fairness First:** Once players join, rules cannot change without consent
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

**Validation Rules:**

| Field | Rule | Error Code |
|-------|------|------------|
| `email` | Valid email format (RFC 5322) | `VALIDATION_ERROR` |
| `email` | Unique (case-insensitive) | `VALIDATION_ERROR: Email already exists` |
| `email` | Max 254 characters | `VALIDATION_ERROR` |
| `displayName` | 3-50 characters | `VALIDATION_ERROR` |
| `displayName` | No leading/trailing whitespace | `VALIDATION_ERROR` |
| `password` | 8-100 characters | `VALIDATION_ERROR` |
| `password` | At least 1 uppercase letter | `VALIDATION_ERROR` |
| `password` | At least 1 number | `VALIDATION_ERROR` |
| `password` | At least 1 special character | `VALIDATION_ERROR` |

**Business Rules:**

1. **Default Role:** New users are `PLAYER` (host/admin roles assigned manually)
2. **Default Status:** New users are `ACTIVE`
3. **Email Normalization:** Convert to lowercase before uniqueness check
4. **Password Storage:** Hash with bcrypt (salt rounds = 10), never store plaintext
5. **Audit Logging:** Log `USER_REGISTERED` event with IP, user-agent

**v0.2-beta Additional Rules:**

| Field | Rule | Error Code |
|-------|------|------------|
| `username` | Unique (case-insensitive) | `VALIDATION_ERROR: Username taken` |
| `username` | 3-20 characters | `VALIDATION_ERROR` |
| `username` | Alphanumeric + underscore only | `VALIDATION_ERROR` |
| `username` | No leading/trailing underscore | `VALIDATION_ERROR` |
| `timezone` | Valid IANA timezone or null | `VALIDATION_ERROR` |

---

### 2.2 User Authentication

**Login Rules:**

1. **Email Lookup:** Case-insensitive match
2. **Password Verification:** Use bcrypt.compare (timing-safe)
3. **Account Status:** Reject if `status = DISABLED`
4. **Token Expiry:** JWT valid for 4 hours from issuance
5. **Audit Logging:** Log `USER_LOGGED_IN` with IP, user-agent

**Token Rules:**

1. **Bearer Token:** Must be in `Authorization: Bearer <token>` header
2. **Signature Validation:** Verify HMAC-SHA256 signature
3. **Expiry Check:** Reject if `exp` < current time
4. **User Validation:** Re-check user exists and is ACTIVE on EVERY request
5. **No Refresh Tokens:** User must re-authenticate after expiry (v1.1: add refresh tokens)

**Rate Limiting (v1.0):**

| Endpoint | Limit | Window | Action on Exceed |
|----------|-------|--------|------------------|
| `POST /auth/login` | 5 attempts | 15 minutes | 429 Too Many Requests |
| `POST /auth/register` | 3 attempts | 1 hour | 429 Too Many Requests |

---

## 3. Tournament & Template Rules

### 3.1 Tournament Template Rules

**Creation Rules:**

1. **Key Uniqueness:** `key` must be globally unique
2. **Key Format:** Lowercase, alphanumeric + underscore, max 50 chars
3. **Key Immutability:** Cannot change key after creation
4. **Default Status:** New templates are `DRAFT`

**Version Rules:**

1. **Version Numbering:** Auto-increment per template (1, 2, 3, ...)
2. **Draft Editability:** DRAFT versions can be edited/deleted
3. **Published Immutability:** PUBLISHED versions **cannot** be edited
4. **Publishing Requirement:** Must pass validation before publishing
5. **Current Version:** Template's `currentPublishedVersionId` points to latest PUBLISHED version

**Data Validation (dataJson):**

**Schema Validation:**
- `meta.sport` must be `"football"` (if present)
- `teams[]`, `phases[]`, `matches[]` are required arrays
- All IDs (`team.id`, `phase.id`, `match.id`) must be non-empty strings
- `kickoffUtc` must be valid ISO 8601 datetime

**Consistency Validation:**
- No duplicate team IDs
- No duplicate phase IDs
- No duplicate match IDs
- No duplicate phase `order` values
- All `match.phaseId` must reference existing phase
- All `match.homeTeamId` and `awayTeamId` must reference existing teams
- `match.homeTeamId ≠ match.awayTeamId` (team cannot play itself)

**Error Response Example:**

```json
{
  "error": "VALIDATION_ERROR",
  "details": {
    "issues": [
      { "path": "teams.mex", "message": "Team id duplicado: mex" },
      { "path": "matches.m1.phaseId", "message": "phaseId no existe: invalid_phase" }
    ]
  }
}
```

---

### 3.2 Tournament Instance Rules

**Creation Rules:**

1. **Source Version:** Must be created from a PUBLISHED template version
2. **Snapshot Freeze:** `dataJson` is copied from version at creation time
3. **Immutability:** Instance `dataJson` **never changes** even if template updates
4. **Default Status:** New instances are `DRAFT`

**State Transition Rules:**

```
DRAFT ──────→ ACTIVE ──────→ COMPLETED ──────→ ARCHIVED
```

**Allowed Transitions:**

| From | To | Trigger | Reversible |
|------|-----|---------|------------|
| DRAFT | ACTIVE | Manual (admin) | ❌ |
| DRAFT | ARCHIVED | Manual (admin) | ❌ |
| ACTIVE | COMPLETED | Manual (admin) or auto | ❌ |
| COMPLETED | ARCHIVED | Manual or auto (90 days) | ❌ |

**Pool Creation Rules:**

| Instance Status | Can Create Pools | Reason |
|-----------------|:----------------:|--------|
| DRAFT | ❌ | Not ready |
| ACTIVE | ✅ | Available in catalog |
| COMPLETED | ❌ | Tournament ended |
| ARCHIVED | ❌ | Hidden from catalog |

**Violation:** Attempting to create pool on ARCHIVED instance returns `409 CONFLICT`

---

## 4. Pool Rules

### 4.1 Pool Creation Rules

**Required Fields:**

| Field | Validation | Default |
|-------|------------|---------|
| `tournamentInstanceId` | Must exist and be ACTIVE | - |
| `name` | 3-120 characters | - |
| `description` | Max 500 characters or null | null |
| `timeZone` | Valid IANA timezone | "UTC" |
| `deadlineMinutesBeforeKickoff` | 0-1440 (0 to 24 hours) | 10 |
| `scoringPresetKey` | CLASSIC / OUTCOME_ONLY / EXACT_HEAVY | "CLASSIC" |

**Automatic Actions:**

1. **Creator as HOST:** User who creates pool becomes HOST (via PoolMember record)
2. **First Invite Code:** Auto-generate 12-char hex code
3. **Default Visibility:** PRIVATE
4. **Audit Event:** Log `POOL_CREATED`

**v0.2-beta Additional Fields:**

| Field | Validation | Default |
|-------|------------|---------|
| `status` | DRAFT / ACTIVE / COMPLETED / ARCHIVED | DRAFT |
| `requireApproval` | Boolean | false |
| `pickRulesJson` | Valid pick rules config or null | null |

---

### 4.2 Pool State Rules (v0.2-beta)

**State Machine:**

```
DRAFT ──────→ ACTIVE ──────→ COMPLETED ──────→ ARCHIVED
  │
  └──→ DELETED (only if < 2 members)
```

**State Transition Logic:**

| From | To | Automatic Trigger |
|------|-----|-------------------|
| DRAFT | ACTIVE | 2nd player joins |
| ACTIVE | COMPLETED | Manual (host) or auto when last match ends |
| COMPLETED | ARCHIVED | Manual or auto after 90 days |

**Deletion Rules:**

| State | Members | Can Delete | Who Can Delete |
|-------|---------|:----------:|----------------|
| DRAFT | 0-1 | ✅ | HOST only |
| DRAFT | 2+ | ❌ | - |
| ACTIVE | Any | ❌ | - |
| COMPLETED | Any | ❌ | - |
| ARCHIVED | Any | ❌ | - |

**Rationale:** Prevent hosts from deleting pools after players join (data integrity, transparency)

---

### 4.3 Pool Configuration Editability

**Always Editable:**

- `name` (cosmetic)
- `description` (cosmetic)
- `visibility` (PRIVATE ↔ PUBLIC)

**Editable Before First Match Kickoff:**

- `timeZone` (affects deadline calculation)
- `deadlineMinutesBeforeKickoff` (affects all future matches)

**NEVER Editable After 2nd Player Joins:**

- `scoringPresetKey` (or `pickRulesJson`)
- `tournamentInstanceId` (structural change)

**Validation:**

```javascript
if (pool.memberCount >= 2 && changingScoring) {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "Cannot change scoring rules after 2nd player joins. This ensures fair competition."
  });
}
```

---

### 4.4 Join Request Rules (v0.2-beta)

**If `requireApproval = false`:**
- User joins immediately
- No approval needed
- PoolMember created with `status = ACTIVE`

**If `requireApproval = true`:**

1. **Create Request:**
   - Create `PoolMemberRequest` with `status = PENDING`
   - Notify host/co-admins
   - User sees "Pending approval" message

2. **Approval:**
   - HOST or CO_ADMIN can approve
   - Creates `PoolMember` with `status = ACTIVE`
   - Updates request to `APPROVED`
   - User notified

3. **Rejection:**
   - HOST or CO_ADMIN can reject with optional `reason`
   - Updates request to `REJECTED`
   - User notified with reason
   - User can request again (no cooldown)

**Validation:**

- User cannot request to join if already member (active or banned)
- User cannot request if instance is ARCHIVED
- Invite code must be valid (not expired, not exhausted)

---

### 4.5 Invite Code Rules

**Generation:**

- 12-character hex string (e.g., `a3f9c2d8e1b4`)
- Cryptographically random (`crypto.randomBytes(6)`)
- Globally unique (collision probability: 1 in 16^12 ≈ 2.8×10^14)

**Expiry:**

- `expiresAtUtc = null` → Never expires
- `expiresAtUtc = <date>` → Cannot use after date

**Max Uses:**

- `maxUses = null` → Unlimited
- `maxUses = N` → Can be used N times

**Validation on Join:**

```javascript
if (now > invite.expiresAtUtc) {
  return res.status(409).json({ error: "CONFLICT", message: "Invite code has expired" });
}

if (invite.uses >= invite.maxUses) {
  return res.status(409).json({ error: "CONFLICT", message: "Invite code has reached max uses" });
}
```

**Multiple Codes:**

- Pool can have multiple active codes (e.g., one for friends, one for family)
- Different expiry/max uses per code

---

## 5. Pick (Prediction) Rules

### 5.1 Pick Submission Rules

**Uniqueness Constraint:**

- **(poolId, userId, matchId)** must be unique
- One pick per match per user per pool

**Deadline Enforcement:**

```javascript
const deadline = new Date(match.kickoffUtc.getTime() - pool.deadlineMinutesBeforeKickoff * 60000);
const now = new Date();

if (now >= deadline) {
  return res.status(409).json({
    error: "DEADLINE_PASSED",
    message: "Cannot modify pick after deadline"
  });
}
```

**Lock Status:**

- `isLocked = now >= deadlineUtc`
- Frontend disables edit UI if locked
- Backend rejects PUT requests if locked

**Upsert Behavior:**

- If pick exists → **Update** (overwrite `pickJson`, update `updatedAtUtc`)
- If pick doesn't exist → **Create** (insert new row)

---

### 5.2 Pick Type Validation (v0.1-alpha)

**Type 1: SCORE**

```json
{
  "type": "SCORE",
  "homeGoals": 2,
  "awayGoals": 1
}
```

**Validation:**
- `homeGoals` and `awayGoals` must be non-negative integers
- Max value: 99 (reasonable upper bound)

**Type 2: OUTCOME**

```json
{
  "type": "OUTCOME",
  "outcome": "HOME" | "DRAW" | "AWAY"
}
```

**Validation:**
- `outcome` must be one of three enum values

---

### 5.3 Pick Type Validation (v0.2-beta)

**Multi-Type Picks:**

```json
{
  "picks": {
    "EXACT_SCORE": { "homeGoals": 2, "awayGoals": 1 },
    "GOAL_DIFFERENCE": { "difference": 1 },
    "MATCH_OUTCOME": { "outcome": "HOME" },
    "PARTIAL_SCORE": { "team": "HOME", "goals": 2 }
  }
}
```

**Validation Rules:**

1. **All Active Types Required:** If pool has `activePickTypes = [EXACT_SCORE, MATCH_OUTCOME]`, user MUST submit both
2. **No Extra Types:** Cannot submit pick types not enabled in pool
3. **Type-Specific Validation:**
   - `EXACT_SCORE`: homeGoals, awayGoals (0-99 integers)
   - `GOAL_DIFFERENCE`: difference (-99 to +99 integer)
   - `MATCH_OUTCOME`: outcome (HOME/DRAW/AWAY)
   - `PARTIAL_SCORE`: team (HOME/AWAY), goals (0-99 integer)

**Error Example:**

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Missing required pick type: MATCH_OUTCOME"
}
```

---

### 5.4 Match Existence Validation

**Rule:** `matchId` must exist in `pool.tournamentInstance.dataJson.matches[]`

**Validation:**

```javascript
const matches = extractMatches(pool.tournamentInstance.dataJson);
const match = matches.find(m => m.id === matchId);

if (!match) {
  return res.status(404).json({
    error: "NOT_FOUND",
    message: "Match not found in tournament instance"
  });
}
```

---

## 6. Result & Errata Rules

### 6.1 Result Publication Rules

**Who Can Publish:**

- HOST (always)
- CO_ADMIN (v0.2-beta)
- Platform ADMIN (emergency override, future)

**Validation:**

```javascript
const isHost = await prisma.poolMember.findFirst({
  where: { poolId, userId, status: "ACTIVE", role: "HOST" }
});

if (!isHost) {
  return res.status(403).json({ error: "FORBIDDEN" });
}
```

**First Publication (Version 1):**

- `homeGoals` and `awayGoals` required (0-99 integers)
- `reason` optional (can be null)
- Creates `PoolMatchResult` + `PoolMatchResultVersion` (version=1)
- Sets `currentVersionId` to new version
- Audit event: `RESULT_PUBLISHED`

**Errata (Version 2+):**

- `reason` **REQUIRED** (enforced in transaction)
- If `reason` is null or empty → Transaction fails
- Creates new `PoolMatchResultVersion` (version=n+1)
- Updates `currentVersionId` to new version
- Audit event: `RESULT_CORRECTED`

**Reason Validation:**

```javascript
if (nextVersion > 1 && !reason) {
  throw new Error("REASON_REQUIRED_FOR_ERRATA");
}
```

---

### 6.2 Version Immutability

**Rules:**

1. Once created, `PoolMatchResultVersion` is **immutable** (no UPDATEs)
2. All versions retained (full history)
3. Only `currentVersion` used for leaderboard
4. Players can view version history (future: diff view)

**Why?**

- Transparency: See what changed and why
- Auditability: Track who made each change
- Dispute resolution: Evidence if players disagree

---

### 6.3 Leaderboard Recalculation

**Trigger:** Automatic on result publish/update

**Logic:**

1. Fetch all predictions for match
2. For each prediction:
   - Calculate points using current version
   - Update user's total points
3. Re-sort leaderboard (no caching in v0.1)

**Future Optimization (v1.0):**

- Materialized view (pre-computed leaderboard)
- Refresh on result change
- Reduces query time from O(n×m) to O(1)

---

## 7. Leaderboard & Scoring Rules

### 7.1 Scoring Algorithm (v0.1-alpha)

**Presets:**

| Preset | Outcome Points | Exact Score Bonus |
|--------|----------------|-------------------|
| CLASSIC | 3 | 2 |
| OUTCOME_ONLY | 3 | 0 |
| EXACT_HEAVY | 2 | 3 |

**Calculation (SCORE Pick):**

```javascript
function calculatePoints(pick, result, preset) {
  let points = 0;

  // Step 1: Calculate predicted outcome from predicted score
  const predictedOutcome = outcomeFromScore(pick.homeGoals, pick.awayGoals);
  const actualOutcome = outcomeFromScore(result.homeGoals, result.awayGoals);

  // Step 2: Award outcome points if correct
  if (predictedOutcome === actualOutcome) {
    points += preset.outcomePoints;
  }

  // Step 3: Award exact score bonus if applicable
  if (pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals) {
    points += preset.exactScoreBonus;
  }

  return points;
}
```

**Calculation (OUTCOME Pick):**

```javascript
if (pick.outcome === actualOutcome) {
  return preset.outcomePoints;
}
return 0;
```

---

### 7.2 Scoring Algorithm (v0.2-beta)

**Multi-Type Scoring:**

```javascript
function calculatePoints(picks, result, pointsMap) {
  let totalPoints = 0;

  // Evaluate EXACT_SCORE
  if (picks.EXACT_SCORE) {
    if (picks.EXACT_SCORE.homeGoals === result.homeGoals &&
        picks.EXACT_SCORE.awayGoals === result.awayGoals) {
      totalPoints += pointsMap.EXACT_SCORE;
    }
  }

  // Evaluate GOAL_DIFFERENCE
  if (picks.GOAL_DIFFERENCE) {
    const actualDiff = result.homeGoals - result.awayGoals;
    if (picks.GOAL_DIFFERENCE.difference === actualDiff) {
      totalPoints += pointsMap.GOAL_DIFFERENCE;
    }
  }

  // Evaluate MATCH_OUTCOME
  if (picks.MATCH_OUTCOME) {
    const actualOutcome = outcomeFromScore(result.homeGoals, result.awayGoals);
    if (picks.MATCH_OUTCOME.outcome === actualOutcome) {
      totalPoints += pointsMap.MATCH_OUTCOME;
    }
  }

  // Evaluate PARTIAL_SCORE
  if (picks.PARTIAL_SCORE) {
    const actualGoals = picks.PARTIAL_SCORE.team === "HOME"
      ? result.homeGoals
      : result.awayGoals;
    if (picks.PARTIAL_SCORE.goals === actualGoals) {
      totalPoints += pointsMap.PARTIAL_SCORE;
    }
  }

  return totalPoints;
}
```

**Cumulative Points:**

- User can score multiple pick types on same match
- Example: Exact score correct → Earns points for EXACT_SCORE + GOAL_DIFFERENCE + MATCH_OUTCOME
- Max possible per match: Sum of all active pick type points

---

### 7.3 Leaderboard Ranking Rules

**Primary Sort:** `totalPoints DESC`

**Tiebreaker 1 (v0.2-beta):** `exactScoreCount DESC` (most exact predictions wins)

**Tiebreaker 2:** `joinedAtUtc ASC` (earliest member wins)

**Example:**

```
Rank  User          Points  Exact  Joined
1     Alice         45      5      2026-01-01
2     Bob           45      4      2026-01-02  ← Fewer exact scores than Alice
3     Charlie       45      4      2026-01-01  ← Same exact scores as Bob, but joined earlier
4     Diana         40      6      2026-01-03  ← Lower total points
```

**Why `joinedAtUtc` as final tiebreaker?**

- Rewards early adopters (loyalty)
- Deterministic (no random tiebreaker)
- Simple to implement

**Alternative (for v1.1 discussion):**

- Head-to-head record (who scored more in same matches)
- Total correct outcomes (fallback before joined date)
- Difficulty weighting (upset predictions worth more)

---

## 8. Member Management Rules

### 8.1 Co-Admin Rules (v0.2-beta)

**Nomination:**

- Only HOST can nominate co-admins
- User must be ACTIVE member (PLAYER role)
- User cannot already be CO_ADMIN or HOST

**Permissions:**

| Action | HOST | CO_ADMIN | PLAYER |
|--------|:----:|:--------:|:------:|
| Publish results | ✅ | ✅ | ❌ |
| Correct results (erratas) | ✅ | ✅ | ❌ |
| Generate invite codes | ✅ | ✅ | ❌ |
| Approve/reject join requests | ✅ | ✅ | ❌ |
| Expel/ban players | ✅ | ✅ | ❌ |
| Nominate co-admins | ✅ | ❌ | ❌ |
| Remove co-admins | ✅ | ❌ | ❌ |
| Delete pool | ✅ | ❌ | ❌ |
| Transfer host ownership | ✅ | ❌ | ❌ |

**Removal:**

- Only HOST can remove co-admins
- Removal downgrades user to PLAYER (doesn't kick from pool)
- Audit event: `CO_ADMIN_REMOVED`

---

### 8.2 Player Expulsion Rules (v0.2-beta)

**Types:**

**1. Permanent Ban:**
- `status = BANNED`
- `bannedUntilUtc = null`
- Cannot rejoin with any invite code
- Can be reactivated by HOST/CO_ADMIN

**2. Temporary Suspension:**
- `status = SUSPENDED`
- `bannedUntilUtc = <future date>`
- Auto-reactivate when date passes (cron job)
- Can be manually reactivated early

**Effect on Data:**

| What Happens | Details |
|--------------|---------|
| **Picks Remain** | All past predictions stay visible (transparency) |
| **Leaderboard** | Appears with "❌ Expulsado" badge |
| **Cannot Submit Picks** | Validation blocks new/updated picks |
| **Cannot Rejoin** | Blocked by userId check (not just code) |

**Reason Requirement:**

- `reason` field **required** (1-500 characters)
- Visible to banned user
- Stored in `PoolMember.bannedReason`
- Audit event: `PLAYER_BANNED` or `PLAYER_SUSPENDED`

**Reactivation:**

- HOST/CO_ADMIN can click "Reactivate"
- Sets `status = ACTIVE`, clears `bannedAtUtc`, `bannedUntilUtc`
- Audit event: `PLAYER_REACTIVATED`

---

### 8.3 Voluntary Leave

**User Action:** "Leave Pool" button

**Effect:**
- Sets `status = LEFT`
- Sets `leftAtUtc = now()`
- Picks remain visible
- User removed from leaderboard

**Rejoin:**

- Can rejoin with new invite code (if not banned)
- Creates new `PoolMember` record (fresh `joinedAtUtc`)
- Old picks **do not carry over** (fresh start)

---

## 9. Data Integrity Invariants

### 9.1 Must NEVER Be Violated

**Database Constraints:**

1. ✅ **User email uniqueness** (DB unique constraint)
2. ✅ **(poolId, userId) uniqueness** (PoolMember)
3. ✅ **(poolId, userId, matchId) uniqueness** (Prediction)
4. ✅ **(poolId, matchId) uniqueness** (PoolMatchResult)
5. ✅ **(resultId, versionNumber) uniqueness** (PoolMatchResultVersion)
6. ✅ **Foreign key integrity** (no orphaned records)

**Application-Level Invariants:**

7. ✅ **Exactly one HOST per pool** (enforced in API)
8. ✅ **Result version immutability** (no UPDATEs to versions)
9. ✅ **Template version immutability** (PUBLISHED versions read-only)
10. ✅ **Current version always set** (result.currentVersionId never null after publish)
11. ✅ **Errata reason required** (version > 1 requires reason, enforced in transaction)
12. ✅ **Picks locked after deadline** (enforced in API, not DB trigger)

---

### 9.2 Soft Invariants (Enforced in API)

**These should be checked but won't cause data corruption if violated:**

- Pool scoring rules unchanged after 2nd player (integrity, not corruption)
- Template key immutability (structural, not functional)
- Instance status transitions forward-only (operational, not critical)

---

## 10. Validation Matrix

### 10.1 Request Body Validation

**All endpoints use Zod schemas. Example validation errors:**

| Field Error | HTTP Status | Error Code | Message |
|-------------|-------------|------------|---------|
| Missing required field | 400 | VALIDATION_ERROR | "Required" |
| Wrong type | 400 | VALIDATION_ERROR | "Expected number, received string" |
| Out of range | 400 | VALIDATION_ERROR | "Number must be greater than 0" |
| Invalid enum | 400 | VALIDATION_ERROR | "Invalid enum value. Expected 'HOME' \| 'DRAW' \| 'AWAY'" |
| String too short | 400 | VALIDATION_ERROR | "String must contain at least 3 character(s)" |
| String too long | 400 | VALIDATION_ERROR | "String must contain at most 120 character(s)" |

---

### 10.2 Business Rule Violation Errors

| Rule Violation | HTTP Status | Error Code | Example Message |
|----------------|-------------|------------|-----------------|
| Deadline passed | 409 | DEADLINE_PASSED | "Cannot modify pick after deadline" |
| Not a member | 403 | FORBIDDEN | "Not a member of this pool" |
| Not a host | 403 | FORBIDDEN | "Only HOST can publish results" |
| Duplicate email | 400 | VALIDATION_ERROR | "Email already exists" |
| Invalid credentials | 401 | UNAUTHENTICATED | "Invalid credentials" |
| Token expired | 401 | UNAUTHENTICATED | "Token expired" |
| Disabled account | 401 | UNAUTHENTICATED | "Account is disabled" |
| Instance archived | 409 | CONFLICT | "Cannot create pool on ARCHIVED instance" |
| Code expired | 409 | CONFLICT | "Invite code has expired" |
| Already member | 409 | CONFLICT | "Already a member of this pool" |
| Banned user | 409 | CONFLICT | "You are banned from this pool" |
| Errata without reason | 400 | VALIDATION_ERROR | "reason is required for errata (version > 1)" |
| Immutable field change | 403 | FORBIDDEN | "Cannot change scoring rules after players join" |

---

## Appendix A: Validation Checklist (For Developers)

**Before implementing new endpoint, ensure:**

- [ ] Zod schema defined for request body
- [ ] Authentication checked (requireAuth middleware)
- [ ] Authorization checked (role/permission validation)
- [ ] Input sanitized (Zod handles this)
- [ ] Business rules validated (deadline, membership, etc.)
- [ ] Database constraints enforced (unique, foreign keys)
- [ ] Transaction used for multi-step operations
- [ ] Audit event logged (if sensitive action)
- [ ] Clear error messages returned (user-facing)
- [ ] TypeScript types match Prisma schema

---

## Appendix B: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [API_SPEC.md](./API_SPEC.md) - API contracts
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**END OF DOCUMENT**
