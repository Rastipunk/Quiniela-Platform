# Data Model Specification
# Quiniela Platform

> **Version:** 1.1
> **Last Updated:** 2026-01-04
> **Status:** Production Schema (v0.1-alpha + Tournament Advancement)
> **Database:** PostgreSQL 14+
> **ORM:** Prisma 6.19.1

---

## 1. Overview

This document defines the complete data model for the Quiniela Platform, including:
- Entity schemas
- Relationships & cardinality
- Constraints & indexes
- Invariants & business rules
- Migration history

**Design Principles:**
- ✅ **Immutability where critical** (templates, results versions)
- ✅ **Auditability** (track who did what, when)
- ✅ **Versioning** (templates, results support corrections)
- ✅ **Soft deletes** (status fields vs hard deletes)
- ✅ **Extensibility** (JSON fields for future schema evolution)

---

## 2. Entity Relationship Diagram (ERD)

### High-Level Relationships

```
User
 ├─── 1:N ──→ Pool (createdBy)
 ├─── 1:N ──→ PoolMember
 ├─── 1:N ──→ PoolInvite (createdBy)
 ├─── 1:N ──→ Prediction
 └─── 1:N ──→ PoolMatchResultVersion (createdBy)

TournamentTemplate
 ├─── 1:N ──→ TournamentTemplateVersion
 ├─── 1:1 ──→ TournamentTemplateVersion (currentPublishedVersion)
 └─── 1:N ──→ TournamentInstance

TournamentTemplateVersion
 └─── 1:N ──→ TournamentInstance (instances based on this version)

TournamentInstance
 └─── 1:N ──→ Pool

Pool
 ├─── 1:N ──→ PoolMember
 ├─── 1:N ──→ PoolInvite
 ├─── 1:N ──→ Prediction
 └─── 1:N ──→ PoolMatchResult

PoolMatchResult
 ├─── 1:N ──→ PoolMatchResultVersion
 └─── 1:1 ──→ PoolMatchResultVersion (currentVersion)

AuditEvent (global, no FK constraints)
```

---

## 3. Core Entities

### 3.1 User

**Purpose:** Represents a platform user (player, host, or admin).

**Schema:**

```prisma
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  displayName  String
  passwordHash String
  platformRole PlatformRole @default(PLAYER)
  status       UserStatus   @default(ACTIVE)

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  poolsCreated          Pool[]
  poolMemberships       PoolMember[]
  poolInvitesCreated    PoolInvite[]
  predictions           Prediction[]
  resultVersionsCreated PoolMatchResultVersion[]
}

enum PlatformRole {
  ADMIN   // Platform administrator
  HOST    // Can create pools (same as PLAYER technically)
  PLAYER  // Regular user
}

enum UserStatus {
  ACTIVE    // Can use platform
  DISABLED  // Suspended/banned (platform-level)
}
```

**Constraints:**
- `email` must be unique (enforced by DB)
- `passwordHash` must never be null (authentication required)
- `displayName` must be 3-50 characters (enforced in API)

**Indexes:**
- Primary: `id` (UUID, indexed)
- Unique: `email`

**Business Rules:**
- Users cannot be hard-deleted (set `status = DISABLED` instead)
- Email is case-insensitive (normalized to lowercase in API)
- `platformRole` does not enforce permissions (pools use `PoolMember.role`)

**Future Fields (v0.2-beta):**
```prisma
username     String  @unique  // e.g., "juancho123"
timezone     String?          // IANA timezone, e.g., "America/Mexico_City"
avatarUrl    String?
bio          String?
```

---

### 3.2 AuditEvent

**Purpose:** Immutable log of all significant platform actions.

**Schema:**

```prisma
model AuditEvent {
  id           String   @id @default(uuid())
  createdAtUtc DateTime @default(now())

  actorUserId String?  // Who performed the action (nullable for system events)
  action      String   // e.g., "POOL_CREATED", "RESULT_PUBLISHED"
  entityType  String?  // e.g., "Pool", "PoolMatchResult"
  entityId    String?  // ID of affected entity
  poolId      String?  // Pool context (if applicable)

  dataJson  Json?    // Additional context (flexible)
  ip        String?  // IP address of actor
  userAgent String?  // Browser/client info
}
```

**No Foreign Keys:** Intentionally decoupled to preserve audit trail even if entities are deleted.

**Common Actions:**
- `USER_REGISTERED`, `USER_LOGGED_IN`
- `POOL_CREATED`, `POOL_JOINED`, `POOL_ARCHIVED`
- `POOL_INVITE_CREATED`, `POOL_INVITE_USED`
- `PREDICTION_UPSERTED`
- `RESULT_PUBLISHED`, `RESULT_CORRECTED`
- `CO_ADMIN_NOMINATED`, `CO_ADMIN_REMOVED`
- `PLAYER_BANNED`, `PLAYER_SUSPENDED`, `PLAYER_REACTIVATED`
- `TEMPLATE_CREATED`, `TEMPLATE_VERSION_PUBLISHED`
- `TOURNAMENT_INSTANCE_CREATED`, `TOURNAMENT_INSTANCE_ACTIVATED`

**Indexes:**
- Primary: `id`
- Composite: `(poolId, createdAtUtc)` for pool-specific audit queries
- Composite: `(actorUserId, createdAtUtc)` for user activity tracking

**Retention Policy:**
- Retain forever (no deletion)
- Archive to cold storage after 2 years (future)

---

## 4. Tournament Entities

### 4.1 TournamentTemplate

**Purpose:** Reusable tournament definition (e.g., "World Cup Format").

**Schema:**

```prisma
model TournamentTemplate {
  id          String  @id @default(uuid())
  key         String  @unique  // e.g., "worldcup_2026", "champions_league"
  name        String           // e.g., "FIFA World Cup"
  description String?

  status TemplateStatus @default(DRAFT)

  // Quick reference to current published version (nullable)
  currentPublishedVersionId String?                    @unique
  currentPublishedVersion   TournamentTemplateVersion? @relation("CurrentPublishedVersion", fields: [currentPublishedVersionId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  versions  TournamentTemplateVersion[]
  instances TournamentInstance[]
}

enum TemplateStatus {
  DRAFT       // Being created/edited
  PUBLISHED   // At least one version published
  DEPRECATED  // No longer recommended (archived)
}
```

**Constraints:**
- `key` must be unique (URL-safe, lowercase, alphanumeric + underscore)
- `key` immutable after creation
- Must have at least one PUBLISHED version to create instances

**Indexes:**
- Primary: `id`
- Unique: `key`, `currentPublishedVersionId`

**Business Rules:**
- Templates can have multiple versions
- Instances must reference a PUBLISHED version
- Deprecating a template does NOT affect existing instances

---

### 4.2 TournamentTemplateVersion

**Purpose:** Immutable snapshot of tournament data at a specific version.

**Schema:**

```prisma
model TournamentTemplateVersion {
  id         String             @id @default(uuid())
  templateId String
  template   TournamentTemplate @relation(fields: [templateId], references: [id])

  versionNumber Int  // Auto-increment per template (1, 2, 3...)
  status        TemplateVersionStatus @default(DRAFT)

  dataJson       Json      // Full tournament data (teams, matches, phases)
  publishedAtUtc DateTime?

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  currentForTemplate TournamentTemplate?  @relation("CurrentPublishedVersion")
  instances          TournamentInstance[] @relation("InstanceSourceVersion")

  @@unique([templateId, versionNumber])
}

enum TemplateVersionStatus {
  DRAFT       // Editable
  PUBLISHED   // Immutable, can be used for instances
  DEPRECATED  // Replaced by newer version
}
```

**Constraints:**
- `(templateId, versionNumber)` must be unique
- `versionNumber` starts at 1 per template
- Once `status = PUBLISHED`, `dataJson` is **immutable**

**Indexes:**
- Primary: `id`
- Unique: `(templateId, versionNumber)`

**Business Rules:**
- DRAFT versions can be edited/deleted
- PUBLISHED versions are frozen (no edits, no deletion)
- Instances can only be created from PUBLISHED versions
- `publishedAtUtc` must be set when transitioning to PUBLISHED

**dataJson Structure:** See section 5 (Template Data Schema).

---

### 4.3 TournamentInstance

**Purpose:** A playable instance of a tournament (e.g., "World Cup 2026").

**Schema:**

```prisma
model TournamentInstance {
  id String @id @default(uuid())

  templateId String
  template   TournamentTemplate @relation(fields: [templateId], references: [id])

  templateVersionId String
  templateVersion   TournamentTemplateVersion @relation("InstanceSourceVersion", fields: [templateVersionId], references: [id])

  name   String
  status TournamentInstanceStatus @default(DRAFT)

  dataJson Json  // Frozen snapshot from templateVersion.dataJson

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  pools Pool[]

  @@index([templateId])
  @@index([templateVersionId])
}

enum TournamentInstanceStatus {
  DRAFT      // Not yet available for pool creation
  ACTIVE     // Pools can be created
  COMPLETED  // Tournament ended
  ARCHIVED   // Hidden from catalog
}
```

**Constraints:**
- `templateVersionId` must point to a PUBLISHED version
- `dataJson` is a **frozen snapshot** (never changes even if template updates)

**Indexes:**
- Primary: `id`
- Foreign: `templateId`, `templateVersionId`

**Business Rules:**
- Instances in ACTIVE status appear in catalog
- Pools cannot be created on ARCHIVED instances
- `dataJson` is copied from `templateVersion.dataJson` at creation time
- State transitions:
  - DRAFT → ACTIVE (manual, by admin)
  - ACTIVE → COMPLETED (manual or auto when last match ends)
  - COMPLETED → ARCHIVED (manual or auto after 90 days)

---

## 5. Template Data Schema (JSON)

**Stored in:** `TournamentTemplateVersion.dataJson` and `TournamentInstance.dataJson`

**Zod Schema Reference:** `backend/src/schemas/templateData.ts`

### 5.1 Structure

```typescript
{
  meta?: {
    name: string,              // "FIFA World Cup 2026"
    competition: string,       // "World Cup"
    seasonYear: number,        // 2026
    sport: "football"          // Currently only "football"
  },

  teams: [
    {
      id: string,              // "mex", "usa", "t_A1"
      name: string,            // "Mexico"
      shortName?: string,      // "MEX"
      code?: string,           // "MEX" (ISO 3166-1 alpha-3)
      groupId?: string         // "A" (for GROUP phase teams)
    }
  ],

  phases: [
    {
      id: string,              // "group_stage", "r16", "quarterfinals"
      name: string,            // "Group Stage"
      type: "GROUP" | "KNOCKOUT",
      order: number,           // 1, 2, 3... (determines phase sequence)
      config?: {
        groupsCount?: number,  // 12 (for GROUP phases)
        teamsPerGroup?: number,// 4
        legs?: number          // 1 or 2 (for KNOCKOUT phases)
      }
    }
  ],

  matches: [
    {
      id: string,              // "m1", "m2", "match_a1_a2"
      phaseId: string,         // References phases[].id
      kickoffUtc: string,      // ISO 8601: "2026-06-11T18:00:00Z"
      homeTeamId: string,      // References teams[].id
      awayTeamId: string,      // References teams[].id
      matchNumber?: number,    // 1, 2, 3... (display order)
      roundLabel?: string,     // "Group A - Matchday 1"
      venue?: string,          // "Estadio Azteca"
      groupId?: string         // "A" (for GROUP phase matches)
    }
  ],

  note?: string                // Internal notes, max 500 chars
}
```

### 5.2 Validation Rules (Enforced in API)

**Schema Validation (Zod):**
- All required fields present
- Correct data types (string, number, enum)
- String length limits (e.g., name max 120 chars)
- ISO 8601 datetime format for `kickoffUtc`

**Consistency Validation (Custom Logic):**
- ✅ No duplicate team IDs
- ✅ No duplicate phase IDs
- ✅ No duplicate match IDs
- ✅ No duplicate phase `order` values
- ✅ All `match.phaseId` references exist in `phases[]`
- ✅ All `match.homeTeamId` and `awayTeamId` exist in `teams[]`
- ✅ `homeTeamId !== awayTeamId` (team cannot play itself)
- ✅ If `meta.sport` exists, must be `"football"`

**Example:** See `backend/src/wc2026Sandbox.ts` for complete WC2026 data.

---

## 6. Pool Entities

### 6.1 Pool

**Purpose:** A user-created competition within a tournament instance.

**Schema:**

```prisma
model Pool {
  id String @id @default(uuid())

  tournamentInstanceId String
  tournamentInstance   TournamentInstance @relation(fields: [tournamentInstanceId], references: [id])

  name        String
  description String?

  visibility PoolVisibility @default(PRIVATE)
  timeZone   String         @default("UTC")  // IANA timezone

  deadlineMinutesBeforeKickoff Int    @default(10)
  scoringPresetKey             String @default("CLASSIC")

  // Tournament progression settings (v0.1-alpha, added 2026-01-04)
  autoAdvanceEnabled Boolean @default(true)  // Enable automatic phase advancement
  lockedPhases       Json    @default("[]")  // Array of phaseIds blocked from advancing

  createdByUserId String
  createdByUser   User   @relation(fields: [createdByUserId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  members      PoolMember[]
  invites      PoolInvite[]
  predictions  Prediction[]
  matchResults PoolMatchResult[]

  @@index([tournamentInstanceId])
  @@index([createdByUserId])
}

enum PoolVisibility {
  PRIVATE  // Only via invite
  PUBLIC   // Listed in lobby (future)
}
```

**Constraints:**
- `name` must be 3-120 characters
- `description` max 500 characters
- `deadlineMinutesBeforeKickoff` range: 0-1440 (0 to 24 hours)
- `scoringPresetKey` must be valid preset or "CUSTOM"

**Indexes:**
- Primary: `id`
- Foreign: `tournamentInstanceId`, `createdByUserId`

**Business Rules:**
- Creator automatically becomes HOST (via PoolMember record)
- Pool cannot be hard-deleted (only archived via status field, future)
- `timeZone` used for display purposes (all DB times in UTC)
- Once 2nd player joins, scoring rules become immutable (enforced in API)
- `autoAdvanceEnabled`: Controls automatic tournament phase progression when all matches complete
- `lockedPhases`: JSON array of phaseIds (e.g., `["group_stage", "round_of_32"]`) that block auto/manual advancement
  - Empty array `[]` = no locks
  - Locked phases prevent both automatic and manual advancement until unlocked

**Future Fields (v0.2-beta):**
```prisma
status               PoolStatus  @default(DRAFT)
requireApproval      Boolean     @default(false)
pickRulesJson        Json?       // Custom pick types & points config
```

---

### 6.2 PoolMember

**Purpose:** User membership in a pool with role and status.

**Schema:**

```prisma
model PoolMember {
  id String @id @default(uuid())

  poolId String
  pool   Pool   @relation(fields: [poolId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id])

  role   PoolMemberRole   @default(PLAYER)
  status PoolMemberStatus @default(ACTIVE)

  joinedAtUtc DateTime  @default(now())
  leftAtUtc   DateTime?  // Nullable (only set when status = LEFT)

  @@unique([poolId, userId])
  @@index([userId])
}

enum PoolMemberRole {
  HOST    // Pool owner
  PLAYER  // Regular participant
}

enum PoolMemberStatus {
  ACTIVE  // Can participate
  LEFT    // Voluntarily left
  BANNED  // Expelled by host
}
```

**Constraints:**
- `(poolId, userId)` must be unique (user can join pool only once)
- Creator must have role = HOST

**Indexes:**
- Primary: `id`
- Unique: `(poolId, userId)`
- Foreign: `userId`

**Business Rules:**
- Each pool must have exactly 1 HOST (enforced in API)
- HOST cannot leave or be banned (must transfer ownership first, future)
- `joinedAtUtc` used for leaderboard tiebreaker
- BANNED users remain in leaderboard (marked with badge)

**Future Fields (v0.2-beta):**
```prisma
role: HOST | CO_ADMIN | PLAYER
status: ACTIVE | LEFT | BANNED | SUSPENDED
bannedAtUtc     DateTime?
bannedUntilUtc  DateTime?  // Null = permanent, future date = temporary
bannedReason    String?
```

---

### 6.3 PoolInvite

**Purpose:** Shareable invite code for joining a pool.

**Schema:**

```prisma
model PoolInvite {
  id String @id @default(uuid())

  poolId String
  pool   Pool   @relation(fields: [poolId], references: [id])

  code String @unique  // 12-char hex (e.g., "a3f9c2d8e1b4")

  createdByUserId String
  createdByUser   User   @relation(fields: [createdByUserId], references: [id])

  maxUses Int?  // Null = unlimited
  uses    Int   @default(0)

  expiresAtUtc DateTime?  // Null = never expires

  createdAtUtc DateTime @default(now())

  @@index([poolId])
}
```

**Constraints:**
- `code` must be globally unique
- `uses` cannot exceed `maxUses` (enforced in API)

**Indexes:**
- Primary: `id`
- Unique: `code`
- Foreign: `poolId`

**Business Rules:**
- Code generated via `crypto.randomBytes(6).toString("hex")`
- Collision probability negligible (16^12 combinations)
- Expired codes cannot be used (checked in API)
- Used-up codes (uses >= maxUses) rejected
- Multiple active codes allowed per pool

**Future Enhancements:**
- Revoke code (soft delete or `revokedAt` field)
- Track which code each user used (join audit)

---

## 7. Prediction & Result Entities

### 7.1 Prediction (Pick)

**Purpose:** User's prediction for a specific match in a pool.

**Schema:**

```prisma
model Prediction {
  id String @id @default(uuid())

  poolId String
  pool   Pool   @relation(fields: [poolId], references: [id])

  userId String
  user   User   @relation(fields: [userId], references: [id])

  matchId String  // References instance.dataJson.matches[].id

  pickJson Json  // Flexible structure for different pick types

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, userId, matchId])
  @@index([userId])
  @@index([poolId])
}
```

**Constraints:**
- `(poolId, userId, matchId)` must be unique (one pick per match per user)
- `matchId` must exist in pool's instance snapshot (validated in API)

**Indexes:**
- Primary: `id`
- Unique: `(poolId, userId, matchId)`
- Foreign: `poolId`, `userId`

**Business Rules:**
- Picks can be created/updated until deadline
- After deadline, picks are locked (immutable)
- Deadline: `match.kickoffUtc - pool.deadlineMinutesBeforeKickoff`

### 7.2 pickJson Structure (v0.1-alpha)

**Current Implementation (2 types):**

**Type 1: SCORE**
```json
{
  "type": "SCORE",
  "homeGoals": 2,
  "awayGoals": 1
}
```

**Type 2: OUTCOME**
```json
{
  "type": "OUTCOME",
  "outcome": "HOME" | "DRAW" | "AWAY"
}
```

**Future (v0.2-beta, 4+ types):**

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

**Validation:**
- Performed via Zod discriminated union
- All active pick types for pool must be present
- Goals must be non-negative integers

---

### 7.3 PoolMatchResult

**Purpose:** Container for versioned match results within a pool.

**Schema:**

```prisma
model PoolMatchResult {
  id String @id @default(uuid())

  poolId  String
  pool    Pool   @relation(fields: [poolId], references: [id])

  matchId String  // References pool.instance.dataJson.matches[].id

  // Pointer to current version (latest published result)
  currentVersionId String?                 @unique
  currentVersion   PoolMatchResultVersion? @relation("CurrentPoolMatchResult", fields: [currentVersionId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  versions PoolMatchResultVersion[] @relation("PoolMatchResultVersions")

  @@unique([poolId, matchId])
  @@index([poolId])
}
```

**Constraints:**
- `(poolId, matchId)` must be unique (one result record per match per pool)
- `currentVersionId` always points to latest version

**Indexes:**
- Primary: `id`
- Unique: `(poolId, matchId)`, `currentVersionId`
- Foreign: `poolId`

**Business Rules:**
- Result can have multiple versions (for corrections/erratas)
- Only current version used for leaderboard calculation
- Cannot delete result (only add new version)

---

### 7.4 PoolMatchResultVersion

**Purpose:** Immutable version of a match result (supports erratas).

**Schema:**

```prisma
model PoolMatchResultVersion {
  id String @id @default(uuid())

  resultId String
  result   PoolMatchResult @relation("PoolMatchResultVersions", fields: [resultId], references: [id])

  versionNumber Int  // 1, 2, 3... (increments per result)
  status        ResultVersionStatus @default(PUBLISHED)

  homeGoals Int
  awayGoals Int

  // Penalty shootout scores (v0.1-alpha, added 2026-01-04)
  homePenalties Int?  // Optional: for knockout phases that end in draw
  awayPenalties Int?  // Optional: determines winner when regular time tied

  reason String?  // Required for version > 1 (errata reason)

  createdByUserId String
  createdBy       User   @relation(fields: [createdByUserId], references: [id])

  publishedAtUtc DateTime @default(now())

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Inverse relation
  currentForResult PoolMatchResult? @relation("CurrentPoolMatchResult")

  @@unique([resultId, versionNumber])
  @@index([resultId])
}

enum ResultVersionStatus {
  PUBLISHED  // Only valid status (no drafts for results)
}
```

**Constraints:**
- `(resultId, versionNumber)` must be unique
- `versionNumber` starts at 1 per result
- `homeGoals >= 0`, `awayGoals >= 0`
- `reason` required if `versionNumber > 1` (enforced in API transaction)

**Indexes:**
- Primary: `id`
- Unique: `(resultId, versionNumber)`
- Foreign: `resultId`, `createdByUserId`

**Business Rules:**
- All versions immutable once created
- Version 1: `reason` optional (initial publication)
- Version 2+: `reason` mandatory (errata explanation)
- `publishedAtUtc` always set to creation time
- Audit event created for each version
- `homePenalties`/`awayPenalties`: Nullable, used for knockout phases
  - Group stage: penalties usually NULL (draws allowed)
  - Knockout: if `homeGoals == awayGoals`, penalties required to determine winner
  - Winner determination: regular time first, then penalties if tied

**Example Version History:**
```
Version 1: 2-1 (published by @host at 18:05)
Version 2: 2-0 (corrected by @coadmin at 18:12, reason: "VAR anulled away goal")
Version 3: 3-0 (corrected by @host at 18:30, reason: "Additional goal in stoppage time")
```

---

## 8. Indexes & Performance

### 8.1 Current Indexes

| Table | Index Type | Columns | Purpose |
|-------|------------|---------|---------|
| User | Primary | id | Fast user lookup |
| User | Unique | email | Unique constraint + login |
| AuditEvent | Primary | id | Fast audit lookup |
| AuditEvent | Composite | (poolId, createdAtUtc) | Pool audit queries |
| AuditEvent | Composite | (actorUserId, createdAtUtc) | User activity |
| TournamentTemplate | Primary | id | Fast lookup |
| TournamentTemplate | Unique | key | Catalog queries |
| TournamentTemplateVersion | Primary | id | Fast lookup |
| TournamentTemplateVersion | Unique | (templateId, versionNumber) | Version queries |
| TournamentInstance | Primary | id | Fast lookup |
| TournamentInstance | Foreign | templateId | Template instances |
| TournamentInstance | Foreign | templateVersionId | Version instances |
| Pool | Primary | id | Fast lookup |
| Pool | Foreign | tournamentInstanceId | Instance pools |
| Pool | Foreign | createdByUserId | User's created pools |
| PoolMember | Primary | id | Fast lookup |
| PoolMember | Unique | (poolId, userId) | Membership uniqueness |
| PoolMember | Foreign | userId | User's pools |
| PoolInvite | Primary | id | Fast lookup |
| PoolInvite | Unique | code | Code validation |
| PoolInvite | Foreign | poolId | Pool invites |
| Prediction | Primary | id | Fast lookup |
| Prediction | Unique | (poolId, userId, matchId) | Pick uniqueness |
| Prediction | Foreign | userId | User's picks |
| Prediction | Foreign | poolId | Pool picks |
| PoolMatchResult | Primary | id | Fast lookup |
| PoolMatchResult | Unique | (poolId, matchId) | Result uniqueness |
| PoolMatchResult | Unique | currentVersionId | Current version |
| PoolMatchResult | Foreign | poolId | Pool results |
| PoolMatchResultVersion | Primary | id | Fast lookup |
| PoolMatchResultVersion | Unique | (resultId, versionNumber) | Version uniqueness |
| PoolMatchResultVersion | Foreign | resultId | Result versions |

### 8.2 Query Patterns & Optimization

**Common Queries:**

1. **Get pool overview** (most complex)
   ```sql
   -- Single query optimized in /pools/:id/overview endpoint
   -- Joins: Pool + Instance + Members + Predictions + Results + Versions
   -- Postgres explain plan shows < 50ms for 100 players, 72 matches
   ```

2. **Leaderboard calculation**
   ```sql
   -- Joins Predictions + Results (currentVersion only)
   -- Aggregates in-memory (future: materialized view)
   ```

3. **User's pools**
   ```sql
   -- PoolMember.userId = ? WHERE status = ACTIVE
   -- Indexed on userId
   ```

**Future Optimizations (v1.0+):**
- Materialized view for leaderboard (refresh on result publish)
- Read replica for heavy queries
- Redis cache for pool overview (invalidate on updates)

---

## 9. Invariants & Business Rules

### 9.1 Data Integrity Invariants

**Must NEVER be violated:**

1. **User email uniqueness**
   - ✅ Enforced by: DB unique constraint + API validation

2. **Pool membership uniqueness**
   - ✅ Enforced by: `(poolId, userId)` unique constraint

3. **Pick uniqueness per match**
   - ✅ Enforced by: `(poolId, userId, matchId)` unique constraint

4. **Result uniqueness per match per pool**
   - ✅ Enforced by: `(poolId, matchId)` unique constraint

5. **Template version immutability**
   - ✅ Enforced by: API blocks edits to PUBLISHED versions
   - ⚠️ DB does not enforce (app-level only)

6. **Result version immutability**
   - ✅ Enforced by: No UPDATE allowed on PoolMatchResultVersion (only INSERT)
   - ⚠️ DB does not enforce (app-level only)

7. **Exactly one HOST per pool**
   - ✅ Enforced by: API transaction during pool creation
   - ⚠️ DB allows multiple (potential for corruption, needs DB trigger or check constraint)

8. **Current version always exists**
   - ✅ Enforced by: API sets `currentVersionId` on every result publish
   - ⚠️ Can be null temporarily during transaction (acceptable)

---

### 9.2 Business Logic Rules

**Enforced in API layer:**

1. **Deadline enforcement**
   - Picks cannot be created/updated after `kickoffUtc - deadlineMinutes`
   - Returns `409 DEADLINE_PASSED` error

2. **Scoring rules immutability**
   - After 2nd player joins pool, `scoringPresetKey` cannot change
   - Returns `403 FORBIDDEN` error

3. **Errata reason requirement**
   - Result version > 1 requires non-empty `reason` field
   - Enforced in transaction, returns `400 VALIDATION_ERROR`

4. **Instance status validation**
   - Pools cannot be created on ARCHIVED instances
   - Returns `409 CONFLICT` error

5. **Template version status**
   - Instances can only be created from PUBLISHED template versions
   - Returns `400 VALIDATION_ERROR`

6. **Pick type validation**
   - Pick must match pool's active pick types (future)
   - Returns `400 VALIDATION_ERROR`

7. **Match existence**
   - `matchId` in Prediction must exist in instance snapshot
   - Returns `404 NOT_FOUND` error

---

### 9.3 Soft Delete Rules

**Entities that use status fields instead of hard deletes:**

| Entity | Status Field | States | Soft Delete State |
|--------|--------------|--------|-------------------|
| User | status | ACTIVE, DISABLED | DISABLED |
| TournamentTemplate | status | DRAFT, PUBLISHED, DEPRECATED | DEPRECATED |
| TournamentTemplateVersion | status | DRAFT, PUBLISHED, DEPRECATED | DEPRECATED |
| TournamentInstance | status | DRAFT, ACTIVE, COMPLETED, ARCHIVED | ARCHIVED |
| Pool | (future) status | DRAFT, ACTIVE, COMPLETED, ARCHIVED | ARCHIVED |
| PoolMember | status | ACTIVE, LEFT, BANNED | LEFT or BANNED |

**Hard deletes allowed:**
- ⚠️ TournamentTemplateVersion (DRAFT only)
- ⚠️ TournamentInstance (DRAFT only, no pools)
- ⚠️ Pool (DRAFT only, < 2 members, future)
- ✅ PoolInvite (revoked codes, future)

**Never hard delete:**
- ❌ User (compliance, audit trail)
- ❌ AuditEvent (legal requirement)
- ❌ Prediction (transparency)
- ❌ PoolMatchResult / PoolMatchResultVersion (transparency)

---

## 10. Migration History

### 10.1 Migrations Log

| Migration | Date | Description |
|-----------|------|-------------|
| `m0_users_audit` | 2024-12-28 | Initial: User, AuditEvent |
| `m1_templates` | 2024-12-29 | TournamentTemplate, TournamentTemplateVersion |
| `m2_tournament_instances` | 2024-12-29 | TournamentInstance |
| `m3_pools` | 2024-12-29 | Pool, PoolMember, PoolInvite |
| `m4_predictions` | 2024-12-29 | Prediction |
| `m5_results_leaderboard` | 2024-12-29 | PoolMatchResult, PoolMatchResultVersion |
| `pool_preset_and_deadline10` | 2024-12-29 | Add scoringPresetKey, deadlineMinutesBeforeKickoff defaults |
| `add_auto_advance_enabled_to_pool` | 2026-01-04 | Add autoAdvanceEnabled boolean to Pool (default: true) |
| `add_penalties_and_locked_phases` | 2026-01-04 | Add homePenalties/awayPenalties to PoolMatchResultVersion, lockedPhases to Pool |

**Total Migrations:** 9

### 10.2 Pending Migrations (v0.2-beta)

**Planned additions:**

1. **User enhancements:**
   - Add `username` (unique, alphanumeric)
   - Add `timezone` (IANA string)
   - Add `avatarUrl`, `bio` (optional)

2. **Pool enhancements:**
   - Add `status` enum (DRAFT, ACTIVE, COMPLETED, ARCHIVED)
   - Add `requireApproval` boolean
   - Add `pickRulesJson` (custom scoring config)

3. **PoolMember enhancements:**
   - Expand `role` enum: HOST | CO_ADMIN | PLAYER
   - Expand `status` enum: ACTIVE | LEFT | BANNED | SUSPENDED
   - Add `bannedAtUtc`, `bannedUntilUtc`, `bannedReason`

4. **New table: PoolMemberRequest**
   ```prisma
   model PoolMemberRequest {
     id        String @id @default(uuid())
     poolId    String
     userId    String
     inviteCodeId String
     status    RequestStatus @default(PENDING)
     reason    String?
     requestedAtUtc  DateTime @default(now())
     processedAtUtc  DateTime?
     processedByUserId String?
   }

   enum RequestStatus {
     PENDING
     APPROVED
     REJECTED
   }
   ```

### 10.3 Migration Best Practices

**When creating migrations:**

1. ✅ Use descriptive names (`add_username_to_users`, not `migration_8`)
2. ✅ Test migrations on dev DB before production
3. ✅ Write rollback migrations for critical changes
4. ✅ Document breaking changes in DECISION_LOG.md
5. ✅ Use transactions for multi-step migrations
6. ✅ Add indexes CONCURRENTLY in production (Postgres)
7. ✅ Avoid breaking changes to JSON fields (use versioning)

**Prisma Migration Commands:**
```bash
# Create migration
npx prisma migrate dev --name add_username

# Apply migrations (production)
npx prisma migrate deploy

# Reset DB (dev only, destructive)
npx prisma migrate reset
```

---

## 11. Data Retention & Archival

### 11.1 Retention Policies

| Entity | Retention | Archival Strategy |
|--------|-----------|-------------------|
| User | Forever | Soft delete (status=DISABLED) |
| AuditEvent | Forever | Move to cold storage after 2 years |
| Pool | Forever | Soft archive (status=ARCHIVED) |
| Prediction | Forever | Part of historical record |
| PoolMatchResult | Forever | Transparency requirement |
| TournamentInstance | Forever | ARCHIVED state hides from catalog |

### 11.2 GDPR Compliance (Future)

**User data deletion requests:**
- Anonymize user: Replace `email`, `displayName` with hashed ID
- Retain `userId` FK references (for data integrity)
- Mark audit events with `[DELETED USER]`
- Predictions/results remain (attributed to anonymized user)

**Implementation:** v1.1+ (GDPR required for EU users)

---

## 12. Future Enhancements

### 12.1 v0.2-beta (Immediate)

- [ ] Add `username` field to User (unique)
- [ ] Add Pool `status` field (state machine)
- [ ] Add PoolMember `role` expansion (CO_ADMIN)
- [ ] Add PoolMember ban/suspension fields
- [ ] Add PoolMemberRequest table (approval workflow)
- [ ] Add `pickRulesJson` to Pool (custom scoring)

### 12.2 v1.0 (MVP)

- [ ] Add `emailVerified` boolean to User
- [ ] Add `refreshToken` table (long-lived sessions)
- [ ] Add `Notification` table (email/in-app)
- [ ] Add `UserSettings` table (preferences)

### 12.3 v2.0+ (Scale)

- [ ] Add `PoolChat` table (optional chat feature)
- [ ] Add `Badge` + `UserBadge` tables (gamification)
- [ ] Add `SubscriptionTier` enum (free/premium)
- [ ] Partition AuditEvent by year (performance)
- [ ] Read replicas (Postgres replication)
- [ ] Materialized views for leaderboards

---

## 13. Appendix

### 13.1 Sample Data Sizes (WC2026 Sandbox)

| Entity | Count | Notes |
|--------|-------|-------|
| Teams | 48 | 12 groups × 4 teams |
| Phases | 1 | Group stage only (v0.1) |
| Matches | 72 | 12 groups × 6 matches |
| Users (test) | 3 | Admin, host, player |
| Pools | 0-N | Created by users |
| Predictions | ~72 × N | N = players per pool |

**Expected Scale (v1.0):**
- Users: 10,000
- Pools: 500
- Avg players per pool: 20
- Total predictions: 500 × 20 × 72 = 720,000

**Database Size Estimate:**
- Predictions: 720k × 1KB = 720 MB
- Audit events: ~2M events × 500B = 1 GB
- Total: < 2 GB (easily handled by 8GB Postgres instance)

### 13.2 Related Documentation

- [PRD.md](./PRD.md) - Product requirements & features
- [API_SPEC.md](./API_SPEC.md) - API contracts
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Validation logic
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**END OF DOCUMENT**
