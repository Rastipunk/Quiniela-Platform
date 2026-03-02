# Data Model Specification
# Quiniela Platform

> **Version:** 2.0
> **Last Updated:** 2026-03-01
> **Status:** Production Schema (v0.5.0)
> **Database:** PostgreSQL 14+
> **ORM:** Prisma 6.x

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
 ├─── 1:N ──→ PoolMatchResultVersion (createdBy)
 ├─── 1:N ──→ StructuralPrediction
 ├─── 1:N ──→ StructuralPhaseResult (createdBy)
 ├─── 1:N ──→ GroupStandingsPrediction
 └─── 1:N ──→ GroupStandingsResult (createdBy)

TournamentTemplate
 ├─── 1:N ──→ TournamentTemplateVersion
 ├─── 1:1 ──→ TournamentTemplateVersion (currentPublishedVersion)
 └─── 1:N ──→ TournamentInstance

TournamentTemplateVersion
 └─── 1:N ──→ TournamentInstance (instances based on this version)

TournamentInstance
 ├─── 1:N ──→ Pool
 ├─── 1:N ──→ MatchExternalMapping
 ├─── 1:N ──→ MatchSyncState
 └─── 1:N ──→ ResultSyncLog

Pool
 ├─── 1:N ──→ PoolMember
 ├─── 1:N ──→ PoolInvite
 ├─── 1:N ──→ Prediction
 ├─── 1:N ──→ PoolMatchResult
 ├─── 1:N ──→ StructuralPrediction
 ├─── 1:N ──→ StructuralPhaseResult
 ├─── 1:N ──→ GroupStandingsPrediction
 └─── 1:N ──→ GroupStandingsResult

PoolMatchResult
 ├─── 1:N ──→ PoolMatchResultVersion
 └─── 1:1 ──→ PoolMatchResultVersion (currentVersion)

AuditEvent (global, no FK constraints)
LegalDocument (standalone)
PlatformSettings (singleton)
DeadlineReminderLog (standalone)
BetaFeedback (standalone)
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
  username     String       @unique
  displayName  String
  passwordHash String
  platformRole PlatformRole @default(PLAYER)
  status       UserStatus   @default(ACTIVE)

  // Profile fields
  firstName   String?
  lastName    String?
  dateOfBirth DateTime?
  gender      Gender?
  bio         String?   @db.VarChar(200)
  country     String?   @db.VarChar(2)
  timezone    String?

  lastUsernameChangeAt DateTime?

  // Password reset
  resetToken          String?
  resetTokenExpiresAt DateTime?

  // Google OAuth
  googleId String? @unique

  // Email verification
  emailVerified                   Boolean   @default(false)
  emailVerificationToken          String?   @unique
  emailVerificationTokenExpiresAt DateTime?

  // Legal consent
  acceptedTermsAt      DateTime?
  acceptedTermsVersion String?
  acceptedPrivacyAt      DateTime?
  acceptedPrivacyVersion String?
  marketingConsent   Boolean   @default(false)
  marketingConsentAt DateTime?
  ageVerifiedAt DateTime?

  // Email notification preferences
  emailNotificationsEnabled Boolean @default(true)
  emailPoolInvitations     Boolean @default(true)
  emailDeadlineReminders   Boolean @default(true)
  emailResultNotifications Boolean @default(true)
  emailPoolCompletions     Boolean @default(true)

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  poolsCreated          Pool[]
  poolMemberships       PoolMember[]
  poolInvitesCreated    PoolInvite[]
  predictions           Prediction[]
  resultVersionsCreated PoolMatchResultVersion[]
  structuralPredictions StructuralPrediction[]
  structuralPhaseResults StructuralPhaseResult[]
  groupStandingsPredictions GroupStandingsPrediction[]
  groupStandingsResults GroupStandingsResult[]

  // Indexes
  @@index([username])
  @@index([resetToken])
  @@index([googleId])
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

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}
```

**Constraints:**
- `email` must be unique (enforced by DB)
- `username` must be unique (3-20 chars, alphanumeric + hyphens/underscores)
- `passwordHash` can be empty for OAuth-only users
- `displayName` must be 3-50 characters (enforced in API)
- `bio` max 200 characters
- `country` ISO 3166-1 alpha-2 (2 chars)

**Indexes:**
- Primary: `id` (UUID, indexed)
- Unique: `email`, `username`, `googleId`, `emailVerificationToken`

**Business Rules:**
- Users cannot be hard-deleted (set `status = DISABLED` instead)
- Email is case-insensitive (normalized to lowercase in API)
- `platformRole` does not enforce permissions (pools use `PoolMember.role`)
- Username changes tracked via `lastUsernameChangeAt`
- Email verification required for full platform access
- Legal consent (terms + privacy) tracked with version for compliance

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

  // Auto-results / Smart Sync fields
  resultSourceMode      ResultSourceMode @default(MANUAL)
  apiFootballLeagueId   Int?
  apiFootballSeasonId   Int?
  lastSyncAtUtc         DateTime?
  syncEnabled           Boolean @default(false)

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  pools                 Pool[]
  matchExternalMappings MatchExternalMapping[]
  matchSyncStates       MatchSyncState[]
  resultSyncLogs        ResultSyncLog[]

  @@index([templateId])
  @@index([templateVersionId])
}

enum TournamentInstanceStatus {
  DRAFT      // Not yet available for pool creation
  ACTIVE     // Pools can be created
  COMPLETED  // Tournament ended
  ARCHIVED   // Hidden from catalog
}

enum ResultSourceMode {
  MANUAL  // Results entered manually by host
  AUTO    // Results fetched automatically via API-Football
}
```

**Constraints:**
- `templateVersionId` must point to a PUBLISHED version
- `dataJson` is a **frozen snapshot** (never changes even if template updates)
- `apiFootballLeagueId` and `apiFootballSeasonId` required when `resultSourceMode = AUTO`

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
- When `resultSourceMode = AUTO`, the Smart Sync system polls API-Football for results
- `syncEnabled` can be toggled to pause/resume automatic syncing
- `lastSyncAtUtc` tracks the last successful sync operation

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
  status      PoolStatus     @default(DRAFT)

  visibility PoolVisibility @default(PRIVATE)
  timeZone   String         @default("UTC")  // IANA timezone

  deadlineMinutesBeforeKickoff Int    @default(10)
  scoringPresetKey             String @default("CLASSIC")

  // Join approval
  requireApproval Boolean @default(false)

  // Pick types configuration
  pickTypesConfig  Json?  // Custom pick types config per pool
  fixtureSnapshot  Json?  // Frozen fixture data snapshot

  // Tournament progression settings
  autoAdvanceEnabled Boolean @default(true)  // Enable automatic phase advancement
  lockedPhases       Json    @default("[]")  // Array of phaseIds blocked from advancing

  createdByUserId String
  createdByUser   User   @relation(fields: [createdByUserId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  // Relations
  members                PoolMember[]
  invites                PoolInvite[]
  predictions            Prediction[]
  matchResults           PoolMatchResult[]
  structuralPredictions  StructuralPrediction[]
  structuralPhaseResults StructuralPhaseResult[]
  groupStandingsPredictions GroupStandingsPrediction[]
  groupStandingsResults  GroupStandingsResult[]

  @@index([tournamentInstanceId])
  @@index([createdByUserId])
}

enum PoolStatus {
  DRAFT      // Being configured by host
  ACTIVE     // Open for play
  COMPLETED  // All matches finished
  ARCHIVED   // Hidden from listings
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
- Pool cannot be hard-deleted (only archived via status field)
- `timeZone` used for display purposes (all DB times in UTC)
- Once 2nd player joins, scoring rules become immutable (enforced in API)
- `requireApproval`: When true, new members start with PENDING_APPROVAL status
- `pickTypesConfig`: JSON config defining which pick types are active for this pool
- `fixtureSnapshot`: Frozen copy of fixture data for the pool
- `autoAdvanceEnabled`: Controls automatic tournament phase progression when all matches complete
- `lockedPhases`: JSON array of phaseIds (e.g., `["group_stage", "round_of_32"]`) that block auto/manual advancement
  - Empty array `[]` = no locks
  - Locked phases prevent both automatic and manual advancement until unlocked

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

  // Approval fields
  approvedByUserId String?
  approvedAtUtc    DateTime?
  rejectionReason  String?

  // Ban fields
  bannedAt        DateTime?
  bannedByUserId  String?
  banReason       String?
  banExpiresAt    DateTime?  // Null = permanent, future date = temporary

  @@unique([poolId, userId])
  @@index([userId])
}

enum PoolMemberRole {
  HOST      // Pool owner
  CO_ADMIN  // Co-administrator (can publish results, manage members)
  PLAYER    // Regular participant
}

enum PoolMemberStatus {
  PENDING_APPROVAL  // Awaiting host/co-admin approval
  ACTIVE            // Can participate
  LEFT              // Voluntarily left
  BANNED            // Expelled by host/co-admin
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
- CO_ADMIN can publish results, approve members, and ban players (but cannot modify pool settings)
- `joinedAtUtc` used for leaderboard tiebreaker
- BANNED users remain in leaderboard (marked with badge)
- When `Pool.requireApproval = true`, new members start with PENDING_APPROVAL status
- `banExpiresAt = null` means permanent ban; a future date means temporary ban

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

  // Score at 90 minutes (for extra time tracking)
  homeGoals90 Int?  // Regular time score (before extra time)
  awayGoals90 Int?  // Regular time score (before extra time)

  // Penalty shootout scores
  homePenalties Int?  // Optional: for knockout phases that end in draw
  awayPenalties Int?  // Optional: determines winner when regular time tied

  reason String?  // Required for version > 1 (errata reason)

  // Result source tracking
  source            ResultSource @default(HOST_MANUAL)
  externalFixtureId Int?           // API-Football fixture ID (for auto results)
  externalDataJson  Json?          // Raw API response data

  createdByUserId String?  // Nullable for system-generated results (Smart Sync)
  createdBy       User?    @relation(fields: [createdByUserId], references: [id])

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

enum ResultSource {
  HOST_MANUAL       // Manually entered by host/co-admin
  HOST_PROVISIONAL  // Provisional result by host (may be updated)
  API_CONFIRMED     // Confirmed result from API-Football
  HOST_OVERRIDE     // Host override of an API result
}
```

**Constraints:**
- `(resultId, versionNumber)` must be unique
- `versionNumber` starts at 1 per result
- `homeGoals >= 0`, `awayGoals >= 0`
- `reason` required if `versionNumber > 1` (enforced in API transaction)
- `createdByUserId` is optional (null for system-generated Smart Sync results)

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
- `homeGoals90`/`awayGoals90`: Score at end of regular time (before extra time)
  - Allows tracking whether a match went to extra time
- `homePenalties`/`awayPenalties`: Nullable, used for knockout phases
  - Group stage: penalties usually NULL (draws allowed)
  - Knockout: if `homeGoals == awayGoals`, penalties required to determine winner
  - Winner determination: regular time first, then penalties if tied
- `source` tracks how the result was created (manual, API, override)
- `externalFixtureId` links to API-Football fixture for traceability
- `externalDataJson` stores raw API response for audit purposes

**Example Version History:**
```
Version 1: 2-1 (published by @host at 18:05)
Version 2: 2-0 (corrected by @coadmin at 18:12, reason: "VAR anulled away goal")
Version 3: 3-0 (corrected by @host at 18:30, reason: "Additional goal in stoppage time")
```

---

## 8. Smart Sync Models

### 8.1 MatchExternalMapping

**Purpose:** Maps internal match IDs (from tournament instance dataJson) to API-Football fixture IDs.

**Schema:**

```prisma
model MatchExternalMapping {
  id                   String @id @default(uuid())

  tournamentInstanceId String
  tournamentInstance   TournamentInstance @relation(fields: [tournamentInstanceId], references: [id])

  internalMatchId      String
  apiFootballFixtureId Int
  apiFootballHomeTeamId Int?
  apiFootballAwayTeamId Int?

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([tournamentInstanceId, internalMatchId])
  @@unique([tournamentInstanceId, apiFootballFixtureId])
}
```

**Constraints:**
- `(tournamentInstanceId, internalMatchId)` must be unique
- `(tournamentInstanceId, apiFootballFixtureId)` must be unique
- One mapping per internal match per instance

**Business Rules:**
- Created during Smart Sync initialization (mapping internal matches to API-Football fixtures)
- `apiFootballHomeTeamId`/`apiFootballAwayTeamId` used for validation during sync

---

### 8.2 MatchSyncState

**Purpose:** Tracks the sync status of individual matches for the Smart Sync system.

**Schema:**

```prisma
model MatchSyncState {
  id                   String @id @default(uuid())

  tournamentInstanceId String
  tournamentInstance   TournamentInstance @relation(fields: [tournamentInstanceId], references: [id])

  internalMatchId      String
  syncStatus           MatchSyncStatus @default(PENDING)

  kickoffUtc           DateTime
  firstCheckAtUtc      DateTime?
  finishCheckAtUtc     DateTime?
  lastCheckedAtUtc     DateTime?
  completedAtUtc       DateTime?
  lastApiStatus        String?

  @@unique([tournamentInstanceId, internalMatchId])
}

enum MatchSyncStatus {
  PENDING        // Not yet checked
  IN_PROGRESS    // Match is live, being monitored
  AWAITING_FINISH // Match expected to end soon
  COMPLETED      // Result confirmed and synced
  SKIPPED        // Manually skipped from sync
}
```

**Constraints:**
- `(tournamentInstanceId, internalMatchId)` must be unique

**Business Rules:**
- State machine: PENDING -> IN_PROGRESS -> AWAITING_FINISH -> COMPLETED
- `kickoffUtc` determines when the sync system starts checking for results
- `lastApiStatus` stores the latest status string from API-Football (e.g., "FT", "1H", "HT")
- SKIPPED matches are excluded from sync polling

---

### 8.3 ResultSyncLog

**Purpose:** Audit log of Smart Sync jobs, tracking API calls and results.

**Schema:**

```prisma
model ResultSyncLog {
  id                   String @id @default(uuid())

  tournamentInstanceId String
  tournamentInstance   TournamentInstance @relation(fields: [tournamentInstanceId], references: [id])

  startedAtUtc         DateTime
  completedAtUtc       DateTime?
  status               SyncStatus @default(RUNNING)

  fixturesChecked      Int @default(0)
  fixturesUpdated      Int @default(0)
  fixturesSkipped      Int @default(0)

  errors               Json?     // Array of error objects
  apiResponseTimeMs    Int?      // API response time in ms
  apiRateLimitRemaining Int?     // Remaining API rate limit

  createdAtUtc DateTime @default(now())
}

enum SyncStatus {
  RUNNING    // Sync job in progress
  COMPLETED  // Sync job finished successfully
  FAILED     // Sync job failed
  PARTIAL    // Some fixtures updated, some failed
}
```

**Business Rules:**
- One log entry per sync job execution
- `errors` stores structured error data (fixture ID, error message, etc.)
- `apiRateLimitRemaining` helps monitor API quota usage
- Used for diagnostics and monitoring of the Smart Sync system

---

## 9. Structural Predictions

### 9.1 StructuralPrediction

**Purpose:** Predictions for complete tournament phases (e.g., which teams advance from group stage), not individual matches.

**Schema:**

```prisma
model StructuralPrediction {
  id       String @id @default(uuid())

  poolId   String
  pool     Pool   @relation(fields: [poolId], references: [id])

  userId   String
  user     User   @relation(fields: [userId], references: [id])

  phaseId  String  // References instance.dataJson.phases[].id
  pickJson Json    // Flexible structure for structural picks

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, userId, phaseId])
}
```

**Constraints:**
- `(poolId, userId, phaseId)` must be unique (one structural prediction per phase per user per pool)

**Business Rules:**
- Used for predictions like "which teams advance to Round of 16" or "who wins the final"
- `pickJson` structure varies by phase type (group advancement, bracket predictions, etc.)
- Subject to deadline enforcement like match predictions

---

### 9.2 StructuralPhaseResult

**Purpose:** Official results for structural predictions (e.g., actual teams that advanced).

**Schema:**

```prisma
model StructuralPhaseResult {
  id              String @id @default(uuid())

  poolId          String
  pool            Pool   @relation(fields: [poolId], references: [id])

  phaseId         String  // References instance.dataJson.phases[].id
  resultJson      Json    // Official result data

  createdByUserId String
  createdBy       User   @relation(fields: [createdByUserId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, phaseId])
}
```

**Constraints:**
- `(poolId, phaseId)` must be unique (one official result per phase per pool)

**Business Rules:**
- Published by host or co-admin
- `resultJson` contains the official outcome for that phase
- Used to score structural predictions

---

### 9.3 GroupStandingsPrediction

**Purpose:** Per-group standings predictions (ordered list of teams in a group).

**Schema:**

```prisma
model GroupStandingsPrediction {
  id      String   @id @default(uuid())

  poolId  String
  pool    Pool     @relation(fields: [poolId], references: [id])

  userId  String
  user    User     @relation(fields: [userId], references: [id])

  phaseId String   // References instance.dataJson.phases[].id
  groupId String   // Group identifier (e.g., "A", "B")
  teamIds String[] // Ordered list of team IDs (1st, 2nd, 3rd, 4th)

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, userId, phaseId, groupId])
}
```

**Constraints:**
- `(poolId, userId, phaseId, groupId)` must be unique

**Business Rules:**
- `teamIds` is an ordered array representing predicted standings (index 0 = 1st place)
- Each team ID must exist in the group's team list from the instance data

---

### 9.4 GroupStandingsResult

**Purpose:** Official group standings results.

**Schema:**

```prisma
model GroupStandingsResult {
  id              String   @id @default(uuid())

  poolId          String
  pool            Pool     @relation(fields: [poolId], references: [id])

  phaseId         String   // References instance.dataJson.phases[].id
  groupId         String   // Group identifier
  teamIds         String[] // Official ordered standings
  version         Int      @default(1)
  reason          String?  // Reason for update (version > 1)

  createdByUserId String
  createdBy       User     @relation(fields: [createdByUserId], references: [id])

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([poolId, phaseId, groupId])
}
```

**Constraints:**
- `(poolId, phaseId, groupId)` must be unique

**Business Rules:**
- Published by host or co-admin
- `version` increments on corrections (similar to result errata)
- `reason` required for version > 1
- Used to score group standings predictions

---

## 10. Platform Models

### 10.1 LegalDocument

**Purpose:** Versioned legal documents (terms of service, privacy policy) for compliance tracking.

**Schema:**

```prisma
model LegalDocument {
  id       String @id @default(uuid())

  type     LegalDocumentType
  version  String            // Semantic version (e.g., "1.0", "1.1")
  title    String
  content  String @db.Text   // Full document content
  changeSummary String?      // Summary of changes from previous version

  locale   String  @default("es")  // Language locale
  isActive Boolean @default(false) // Only one active per type+locale

  publishedAt DateTime?
  effectiveAt DateTime?

  createdAtUtc DateTime @default(now())
  updatedAtUtc DateTime @updatedAt

  @@unique([type, version, locale])
}

enum LegalDocumentType {
  TERMS_OF_SERVICE
  PRIVACY_POLICY
}
```

**Constraints:**
- `(type, version, locale)` must be unique
- Only one document per type+locale can be active at a time (enforced in API)

**Business Rules:**
- Users must accept the active version of terms and privacy policy
- Acceptance tracked via `User.acceptedTermsVersion` and `User.acceptedPrivacyVersion`
- Old versions retained for compliance auditing

---

### 10.2 PlatformSettings

**Purpose:** Singleton table for platform-wide configuration settings.

**Schema:**

```prisma
model PlatformSettings {
  id String @id @default("singleton")

  // Email notification toggles (platform-wide)
  emailWelcomeEnabled          Boolean @default(true)
  emailPoolInvitationEnabled   Boolean @default(true)
  emailDeadlineReminderEnabled Boolean @default(false)
  emailResultPublishedEnabled  Boolean @default(true)
  emailPoolCompletedEnabled    Boolean @default(true)

  updatedAt   DateTime @updatedAt
  updatedById String?  // Admin who last updated
}
```

**Business Rules:**
- Only one row exists (id = "singleton")
- Controls platform-wide email notification behavior
- Individual user preferences (in User model) override platform settings
- Only ADMIN users can modify

---

### 10.3 DeadlineReminderLog

**Purpose:** Tracks sent deadline reminder emails to prevent duplicates.

**Schema:**

```prisma
model DeadlineReminderLog {
  id      String @id @default(uuid())

  poolId  String
  userId  String
  matchId String

  sentAt      DateTime
  sentToEmail String
  success     Boolean
  error       String?

  hoursBeforeDeadline Int  // How many hours before deadline the reminder was sent

  @@unique([poolId, userId, matchId])
}
```

**Constraints:**
- `(poolId, userId, matchId)` must be unique (one reminder per user per match per pool)

**Business Rules:**
- Prevents sending duplicate reminders
- `hoursBeforeDeadline` records the reminder tier (e.g., 24h, 6h, 1h)
- Failed sends tracked via `success = false` and `error` message

---

### 10.4 BetaFeedback

**Purpose:** Collects user feedback during beta testing.

**Schema:**

```prisma
model BetaFeedback {
  id           String @id @default(uuid())

  type         BetaFeedbackType
  message      String
  imageBase64  String?           // Screenshot in base64

  wantsContact Boolean @default(false)
  contactName  String?
  phoneNumber  String?

  userId       String?  // Nullable (anonymous feedback allowed)
  userEmail    String?
  currentUrl   String?  // Page URL where feedback was submitted
  userAgent    String?  // Browser info

  createdAtUtc DateTime @default(now())
}

enum BetaFeedbackType {
  BUG         // Bug report
  SUGGESTION  // Feature suggestion
}
```

**Business Rules:**
- Anonymous feedback allowed (`userId` nullable)
- `imageBase64` stores optional screenshot for bug reports
- `wantsContact` indicates if user wants to be contacted about their feedback

---

## 11. Indexes & Performance

### 11.1 Current Indexes

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

### 11.2 Query Patterns & Optimization

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

## 12. Invariants & Business Rules

### 12.1 Data Integrity Invariants

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

### 12.2 Business Logic Rules

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

### 12.3 Soft Delete Rules

**Entities that use status fields instead of hard deletes:**

| Entity | Status Field | States | Soft Delete State |
|--------|--------------|--------|-------------------|
| User | status | ACTIVE, DISABLED | DISABLED |
| TournamentTemplate | status | DRAFT, PUBLISHED, DEPRECATED | DEPRECATED |
| TournamentTemplateVersion | status | DRAFT, PUBLISHED, DEPRECATED | DEPRECATED |
| TournamentInstance | status | DRAFT, ACTIVE, COMPLETED, ARCHIVED | ARCHIVED |
| Pool | status | DRAFT, ACTIVE, COMPLETED, ARCHIVED | ARCHIVED |
| PoolMember | status | PENDING_APPROVAL, ACTIVE, LEFT, BANNED | LEFT or BANNED |

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

## 13. Migration History

### 13.1 Migrations Log

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
| `add_username_system` | 2026-01-04 | Add username, profile fields, password reset, Google OAuth |
| `add_co_admin_and_ban` | 2026-01-18 | CO_ADMIN role, PENDING_APPROVAL status, ban fields |
| `add_pool_status_and_approval` | 2026-01-18 | Pool status enum, requireApproval, pickTypesConfig, fixtureSnapshot |
| `add_structural_predictions` | 2026-01-18 | StructuralPrediction, StructuralPhaseResult, GroupStandingsPrediction, GroupStandingsResult |
| `add_email_verification` | 2026-01-25 | Email verification fields, legal consent fields, notification prefs |
| `add_legal_and_platform_settings` | 2026-01-25 | LegalDocument, PlatformSettings, DeadlineReminderLog |
| `add_smart_sync` | 2026-02-01 | MatchExternalMapping, ResultSyncLog, MatchSyncState, auto-results fields |
| `add_beta_feedback` | 2026-02-01 | BetaFeedback model |

**Total Migrations:** 17

### 13.2 Planned Migrations (v1.0)

1. **Organization/Corporate:**
   - Add `Organization`, `OrganizationInquiry` models
   - Add `Pool.organizationId`, `Pool.logoUrl`

2. **Payment:**
   - Add `PoolPayment` model (Lemon Squeezy integration)

### 13.3 Migration Best Practices

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

## 14. Data Retention & Archival

### 14.1 Retention Policies

| Entity | Retention | Archival Strategy |
|--------|-----------|-------------------|
| User | Forever | Soft delete (status=DISABLED) |
| AuditEvent | Forever | Move to cold storage after 2 years |
| Pool | Forever | Soft archive (status=ARCHIVED) |
| Prediction | Forever | Part of historical record |
| PoolMatchResult | Forever | Transparency requirement |
| TournamentInstance | Forever | ARCHIVED state hides from catalog |

### 14.2 GDPR Compliance (Future)

**User data deletion requests:**
- Anonymize user: Replace `email`, `displayName` with hashed ID
- Retain `userId` FK references (for data integrity)
- Mark audit events with `[DELETED USER]`
- Predictions/results remain (attributed to anonymized user)

**Implementation:** v1.1+ (GDPR required for EU users)

---

## 15. Future Enhancements

### 15.1 v1.0 (Launch -- April 2026)

- [ ] Add Organization/OrganizationInquiry models (corporate feature)
- [ ] Add Pool.organizationId, Pool.logoUrl (corporate branding)
- [ ] Add PoolPayment model (payment tracking)

### 15.2 v1.1+ (Post-Launch)

- [ ] Add PoolChat table
- [ ] Add Badge + UserBadge tables (gamification)
- [ ] Self-service enterprise dashboard
- [ ] Company admin role

### 15.3 v2.0+ (Scale)

- [ ] Partition AuditEvent by year
- [ ] Read replicas
- [ ] Materialized views for leaderboards
- [ ] Multi-sport models

---

## 16. Appendix

### 16.1 Sample Data Sizes (WC2026 Sandbox)

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

### 16.2 Related Documentation

- [PRD.md](./PRD.md) - Product requirements & features
- [API_SPEC.md](./API_SPEC.md) - API contracts
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Validation logic
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**END OF DOCUMENT**
