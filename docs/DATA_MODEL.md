# Data Model — Picks4All Platform

> **Last updated:** 2026-04-04
>
> This document describes every model, enum, relationship, index, and pattern in the PostgreSQL database as defined in `backend/prisma/schema.prisma`.

---

## Table of Contents

1. [Design Patterns](#1-design-patterns)
2. [Enums](#2-enums)
3. [Models](#3-models)
   - [User](#31-user)
   - [AuditEvent](#32-auditevent)
   - [TournamentTemplate](#33-tournamenttemplate)
   - [TournamentTemplateVersion](#34-tournamenttemplateversion)
   - [TournamentInstance](#35-tournamentinstance)
   - [Pool](#36-pool)
   - [PoolMember](#37-poolmember)
   - [PoolInvite](#38-poolinvite)
   - [Prediction](#39-prediction)
   - [StructuralPrediction](#310-structuralprediction)
   - [GroupStandingsPrediction](#311-groupstandingsprediction)
   - [PoolMatchResult](#312-poolmatchresult)
   - [PoolMatchResultVersion](#313-poolmatchresultversion)
   - [PoolMatchOverride](#314-poolmatchoverride)
   - [StructuralPhaseResult](#315-structuralphaseresult)
   - [GroupStandingsResult](#316-groupstandingsresult)
   - [LegalDocument](#317-legaldocument)
   - [PlatformSettings](#318-platformsettings)
   - [DeadlineReminderLog](#319-deadlinereminderlog)
   - [MatchExternalMapping](#320-matchexternalmapping)
   - [ResultSyncLog](#321-resultsynclog)
   - [MatchSyncState](#322-matchsyncstate)
   - [PendingPhaseSync](#323-pendingphasesync)
   - [BetaFeedback](#324-betafeedback)
   - [Organization](#325-organization)
   - [OrganizationInquiry](#326-organizationinquiry)
   - [CorporateInvite](#327-corporateinvite)
4. [Relationship Diagram](#4-relationship-diagram)

---

## 1. Design Patterns

### 1.1 Template / Version / Instance Pattern

Tournament data flows through three layers:

```
TournamentTemplate  (1)
    └── TournamentTemplateVersion  (N)  ← immutable once PUBLISHED
            └── TournamentInstance  (N)  ← frozen snapshot of version data
                    └── Pool  (N)        ← each pool gets its own fixtureSnapshot
```

- **TournamentTemplate** is a named container (e.g., "Champions League 2025/26").
- **TournamentTemplateVersion** holds the actual tournament structure (`dataJson`) — teams, groups, matches, phases. Once published, a version is immutable.
- **TournamentInstance** is created from a published version. It copies `dataJson` as a frozen snapshot. The instance is the "live" tournament that pools subscribe to.
- **Pool** copies the instance's `dataJson` into its own `fixtureSnapshot` at creation time.

### 1.2 Pool fixtureSnapshot Independence

Each pool has its own `fixtureSnapshot` (copied from the TournamentInstance at creation). When a phase advances (e.g., knockout brackets are populated with winners), ONLY the pool's `fixtureSnapshot` is modified — never the TournamentInstance. This means:

- Two pools on the same instance can be at different advancement stages.
- Phase advancement in one pool does not affect any other pool.
- The TournamentInstance remains the canonical reference; the pool's snapshot is the pool-specific working copy.

### 1.3 Result Versioning Pattern

Match results use a header + versions pattern:

```
PoolMatchResult  (header, 1 per pool+match)
    └── PoolMatchResultVersion  (N)  ← immutable, append-only
            ↑ currentVersionId points to the active version
```

- **PoolMatchResult** is the header row linking a pool and a match. It has a `currentVersionId` pointer.
- **PoolMatchResultVersion** is an immutable version record. Each correction (errata) creates a new version with an incremented `versionNumber` and a mandatory `reason`.
- The `currentVersionId` always points to the latest active version.
- Versions track their `source`: HOST_MANUAL, HOST_PROVISIONAL, API_CONFIRMED, or HOST_OVERRIDE.

### 1.4 MatchSyncState State Machine

For AUTO-mode instances, each match has a `MatchSyncState` that progresses through:

```
PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
                                      └→ SKIPPED (no mapping / manual mode)
```

| State | Description | Transition |
|-------|-------------|------------|
| `PENDING` | Waiting for kickoff + 5 minutes | Moves to IN_PROGRESS when `firstCheckAtUtc` is reached |
| `IN_PROGRESS` | Match started, waiting for `finishCheckAtUtc` (kickoff + 110 min) | Moves to AWAITING_FINISH when `finishCheckAtUtc` is reached |
| `AWAITING_FINISH` | Past estimated end time, polling every 5 minutes until FT | Moves to COMPLETED when API returns FT status |
| `COMPLETED` | Match finished. Never checked again | Terminal state |
| `SKIPPED` | No API mapping or manual-mode instance | Terminal state |

---

## 2. Enums

### PlatformRole

| Value | Description |
|-------|-------------|
| `ADMIN` | Platform administrator |
| `HOST` | Creates and manages pools |
| `PLAYER` | Joins pools and makes picks |

### UserStatus

| Value | Description |
|-------|-------------|
| `ACTIVE` | Normal active user |
| `DISABLED` | Account disabled |

### Gender

| Value | Description |
|-------|-------------|
| `MALE` | Male |
| `FEMALE` | Female |
| `OTHER` | Other |
| `PREFER_NOT_TO_SAY` | Prefer not to say |

### TemplateStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Template not yet published |
| `PUBLISHED` | Has at least one published version |
| `DEPRECATED` | No longer in use |

### TemplateVersionStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Version being edited |
| `PUBLISHED` | Frozen, immutable |
| `DEPRECATED` | Superseded by newer version |

### TournamentInstanceStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Instance created but not active |
| `ACTIVE` | Pools can be created on it |
| `COMPLETED` | Tournament finished |
| `ARCHIVED` | No longer visible |

### PoolVisibility

| Value | Description |
|-------|-------------|
| `PRIVATE` | Invite-only |
| `PUBLIC` | Discoverable (not currently used) |

### PoolStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Pool created, waiting for first member join |
| `ACTIVE` | Pool is live, picks can be made |
| `COMPLETED` | All matches finished |
| `ARCHIVED` | Pool archived by host |

### PoolMemberRole

| Value | Description |
|-------|-------------|
| `HOST` | Pool creator/owner |
| `CO_ADMIN` | Co-administrator with most HOST privileges |
| `PLAYER` | Regular participant |
| `CORPORATE_HOST` | Host of a corporate pool |

### PoolMemberStatus

| Value | Description |
|-------|-------------|
| `PENDING_APPROVAL` | Awaiting host approval |
| `ACTIVE` | Active member |
| `LEFT` | Voluntarily left |
| `BANNED` | Expelled by host/co-admin |

### ResultVersionStatus

| Value | Description |
|-------|-------------|
| `PUBLISHED` | Result version is published |

### ResultSourceMode

| Value | Description |
|-------|-------------|
| `MANUAL` | Host enters results manually |
| `AUTO` | Results obtained from API-Football |

### ResultSource

| Value | Description |
|-------|-------------|
| `HOST_MANUAL` | Host entered in MANUAL-mode instance |
| `HOST_PROVISIONAL` | Host entered in AUTO-mode instance while waiting for API |
| `API_CONFIRMED` | Confirmed result from API-Football (authoritative) |
| `HOST_OVERRIDE` | Host corrected an API result (errata, requires mandatory reason) |

### SyncStatus

| Value | Description |
|-------|-------------|
| `RUNNING` | Sync job in progress |
| `COMPLETED` | Sync finished successfully |
| `FAILED` | Sync failed |
| `PARTIAL` | Some fixtures updated, others had errors |

### MatchSyncStatus

| Value | Description |
|-------|-------------|
| `PENDING` | Waiting for kickoff + 5 min |
| `IN_PROGRESS` | Match started, waiting for finishCheckAtUtc |
| `AWAITING_FINISH` | Past estimated end, polling every 5 min |
| `COMPLETED` | Match finished, never check again |
| `SKIPPED` | No API mapping or manual mode |

### PhaseSyncStatus

| Value | Description |
|-------|-------------|
| `PENDING` | Waiting for API to have fixtures |
| `RESOLVED` | Successfully synced from API |
| `FAILED` | Gave up after too many attempts |

### LegalDocumentType

| Value | Description |
|-------|-------------|
| `TERMS_OF_SERVICE` | Terms of Service |
| `PRIVACY_POLICY` | Privacy Policy |

### BetaFeedbackType

| Value | Description |
|-------|-------------|
| `BUG` | Bug report |
| `SUGGESTION` | Feature suggestion |

### OrganizationStatus

| Value | Description |
|-------|-------------|
| `INQUIRY` | Company contacted via form |
| `ONBOARDING` | Admin is configuring |
| `ACTIVE` | Operational |
| `SUSPENDED` | Temporarily suspended |

### CorporateInviteStatus

| Value | Description |
|-------|-------------|
| `PENDING` | Email validated, awaiting send |
| `SENT` | Invitation email sent |
| `ACTIVATED` | User created account and joined pool |
| `FAILED` | Error sending email |

---

## 3. Models

### 3.1 User

Core user account. Supports email/password and Google OAuth registration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | Primary key |
| `email` | String | Unique | Login email |
| `username` | String | Unique | Display username |
| `displayName` | String | Required | Display name |
| `passwordHash` | String | Required | bcrypt hash |
| `platformRole` | PlatformRole | Default: PLAYER | Role on the platform |
| `status` | UserStatus | Default: ACTIVE | Account status |
| `firstName` | String? | | First name |
| `lastName` | String? | | Last name |
| `dateOfBirth` | DateTime? | | Date of birth |
| `gender` | Gender? | | Gender |
| `bio` | String? | VarChar(200) | Short bio |
| `country` | String? | VarChar(2) | ISO 3166-1 alpha-2 code |
| `timezone` | String? | | IANA timezone |
| `lastUsernameChangeAt` | DateTime? | | Last username change (30-day cooldown) |
| `resetToken` | String? | | Password reset token |
| `resetTokenExpiresAt` | DateTime? | | Reset token expiry (1 hour) |
| `googleId` | String? | Unique | Google OAuth ID |
| `emailVerified` | Boolean | Default: false | Whether email is verified |
| `emailVerificationToken` | String? | Unique | Email verification token |
| `emailVerificationTokenExpiresAt` | DateTime? | | Token expiry (24 hours) |
| `acceptedTermsAt` | DateTime? | | When TOS was accepted |
| `acceptedTermsVersion` | String? | | Version of accepted TOS |
| `acceptedPrivacyAt` | DateTime? | | When Privacy Policy was accepted |
| `acceptedPrivacyVersion` | String? | | Version of accepted Privacy Policy |
| `marketingConsent` | Boolean | Default: false | Marketing email consent |
| `marketingConsentAt` | DateTime? | | When marketing consent was given |
| `ageVerifiedAt` | DateTime? | | When age (13+) was verified |
| `emailNotificationsEnabled` | Boolean | Default: true | Master email toggle |
| `emailPoolInvitations` | Boolean | Default: true | Pool invitation emails |
| `emailDeadlineReminders` | Boolean | Default: true | Deadline reminder emails |
| `emailResultNotifications` | Boolean | Default: true | Result published emails |
| `emailPoolCompletions` | Boolean | Default: true | Pool completed emails |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Indexes:** `username`, `resetToken`, `googleId`, `emailVerificationToken`

**Relations:**
- `predictions` -> Prediction[] (1:N)
- `poolsCreated` -> Pool[] (1:N)
- `poolMemberships` -> PoolMember[] (1:N)
- `poolInvitesCreated` -> PoolInvite[] (1:N)
- `resultVersionsCreated` -> PoolMatchResultVersion[] (1:N)
- `structuralPredictions` -> StructuralPrediction[] (1:N)
- `structuralPhaseResults` -> StructuralPhaseResult[] (1:N)
- `groupStandingsPredictions` -> GroupStandingsPrediction[] (1:N)
- `groupStandingsResults` -> GroupStandingsResult[] (1:N)
- `poolMatchOverrides` -> PoolMatchOverride[] (1:N)

---

### 3.2 AuditEvent

Immutable audit log for sensitive operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `createdAtUtc` | DateTime | Default: now() | |
| `actorUserId` | String? | | User who performed the action |
| `action` | String | Required | Action identifier (e.g., POOL_CREATED, RESULT_PUBLISHED) |
| `entityType` | String? | | Type of entity (e.g., Pool, User) |
| `entityId` | String? | | ID of the affected entity |
| `poolId` | String? | | Pool context (if applicable) |
| `dataJson` | Json? | | Additional structured data |
| `ip` | String? | | Client IP address |
| `userAgent` | String? | | Client User-Agent |

**Indexes:** `actorUserId`, `createdAtUtc`

---

### 3.3 TournamentTemplate

Named container for tournament definitions. See [Template/Version/Instance pattern](#11-template--version--instance-pattern).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `key` | String | Unique | Slug identifier (e.g., "worldcup_2026") |
| `name` | String | Required | Human-readable name |
| `description` | String? | | |
| `status` | TemplateStatus | Default: DRAFT | |
| `currentPublishedVersionId` | String? | Unique | FK to current published version |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Relations:**
- `currentPublishedVersion` -> TournamentTemplateVersion? (1:1, named "CurrentPublishedVersion")
- `versions` -> TournamentTemplateVersion[] (1:N)
- `instances` -> TournamentInstance[] (1:N)

---

### 3.4 TournamentTemplateVersion

Immutable snapshot of a tournament's structure once published.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `templateId` | String | FK -> TournamentTemplate | |
| `versionNumber` | Int | Unique per template | Auto-incremented |
| `status` | TemplateVersionStatus | Default: DRAFT | |
| `dataJson` | Json | Required | Full tournament structure (teams, groups, matches, phases) |
| `publishedAtUtc` | DateTime? | | When this version was published |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[templateId, versionNumber]`

**Relations:**
- `template` -> TournamentTemplate (N:1)
- `currentForTemplate` -> TournamentTemplate? (inverse of currentPublishedVersion)
- `instances` -> TournamentInstance[] (1:N, named "InstanceSourceVersion")

---

### 3.5 TournamentInstance

Live tournament that pools subscribe to. Contains frozen snapshot of template data and auto-results configuration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `templateId` | String | FK -> TournamentTemplate | |
| `templateVersionId` | String | FK -> TournamentTemplateVersion | |
| `name` | String | Required | |
| `status` | TournamentInstanceStatus | Default: DRAFT | |
| `dataJson` | Json | Required | Frozen snapshot of tournament data |
| `resultSourceMode` | ResultSourceMode | Default: MANUAL | MANUAL or AUTO |
| `apiFootballLeagueId` | Int? | | API-Football league ID (AUTO mode) |
| `apiFootballSeasonId` | Int? | | API-Football season year (AUTO mode) |
| `lastSyncAtUtc` | DateTime? | | Last successful sync with API-Football |
| `syncEnabled` | Boolean | Default: true | Kill switch for sync |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Indexes:** `templateId`, `templateVersionId`, `resultSourceMode`

**Relations:**
- `template` -> TournamentTemplate (N:1)
- `templateVersion` -> TournamentTemplateVersion (N:1)
- `pools` -> Pool[] (1:N)
- `matchMappings` -> MatchExternalMapping[] (1:N)
- `syncLogs` -> ResultSyncLog[] (1:N)
- `matchSyncStates` -> MatchSyncState[] (1:N)
- `pendingPhaseSyncs` -> PendingPhaseSync[] (1:N)

---

### 3.6 Pool

A prediction contest. Each pool has its own fixtureSnapshot, scoring config, and member list.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `tournamentInstanceId` | String | FK -> TournamentInstance | |
| `name` | String | Required | |
| `description` | String? | | |
| `visibility` | PoolVisibility | Default: PRIVATE | |
| `status` | PoolStatus | Default: DRAFT | |
| `timeZone` | String | Default: "UTC" | IANA timezone |
| `deadlineMinutesBeforeKickoff` | Int | Default: 10 | Lock picks X min before kickoff |
| `maxParticipants` | Int? | | null = unlimited (legacy pools) |
| `scoringPresetKey` | String | Default: "CLASSIC" | Scoring preset identifier |
| `autoAdvanceEnabled` | Boolean | Default: true | Auto-advance phases on result completion |
| `lockedPhases` | Json | Default: "[]" | Array of manually locked phase IDs |
| `requireApproval` | Boolean | Default: false | Require host approval for new members |
| `muteReminders` | Boolean | Default: false | Suppress deadline reminder emails |
| `pickTypesConfig` | Json? | | Advanced pick types configuration per phase |
| `fixtureSnapshot` | Json? | | Pool's own copy of tournament fixture data |
| `organizationId` | String? | FK -> Organization | Corporate pool link |
| `logoUrl` | String? | | Logo URL for pool header |
| `createdByUserId` | String | FK -> User | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Indexes:** `tournamentInstanceId`, `createdByUserId`, `organizationId`, `status`

**Relations:**
- `tournamentInstance` -> TournamentInstance (N:1)
- `organization` -> Organization? (N:1)
- `createdByUser` -> User (N:1)
- `members` -> PoolMember[] (1:N)
- `invites` -> PoolInvite[] (1:N)
- `corporateInvites` -> CorporateInvite[] (1:N)
- `predictions` -> Prediction[] (1:N)
- `matchResults` -> PoolMatchResult[] (1:N)
- `structuralPredictions` -> StructuralPrediction[] (1:N)
- `structuralPhaseResults` -> StructuralPhaseResult[] (1:N)
- `groupStandingsPredictions` -> GroupStandingsPrediction[] (1:N)
- `groupStandingsResults` -> GroupStandingsResult[] (1:N)
- `matchOverrides` -> PoolMatchOverride[] (1:N)

---

### 3.7 PoolMember

Join table between User and Pool. Tracks role, status, approval, and ban information.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `userId` | String | FK -> User | |
| `role` | PoolMemberRole | Default: PLAYER | |
| `status` | PoolMemberStatus | Default: ACTIVE | |
| `joinedAtUtc` | DateTime | Default: now() | |
| `leftAtUtc` | DateTime? | | When member left voluntarily |
| `approvedByUserId` | String? | | Who approved/rejected |
| `approvedAtUtc` | DateTime? | | When approved/rejected |
| `rejectionReason` | String? | | Reason for rejection |
| `bannedAt` | DateTime? | | When banned |
| `bannedByUserId` | String? | | Who banned them |
| `banReason` | String? | | Ban reason (required) |
| `banExpiresAt` | DateTime? | | null = permanent, date = temporary |

**Unique:** `[poolId, userId]`

**Indexes:** `userId`, `status`, `[poolId, status]`, `[poolId, role]`

---

### 3.8 PoolInvite

Shareable invite code for joining a pool.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `code` | String | Unique | Invite code |
| `createdByUserId` | String | FK -> User | |
| `maxUses` | Int? | | null = unlimited |
| `uses` | Int | Default: 0 | Current use count |
| `expiresAtUtc` | DateTime? | | Expiry date (default: 30 days) |
| `createdAtUtc` | DateTime | Default: now() | |

**Indexes:** `poolId`

---

### 3.9 Prediction

A user's pick for a specific match in a pool. Supports OUTCOME, SCORE, and WINNER pick types.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `userId` | String | FK -> User | |
| `matchId` | String | Required | Match ID from tournament snapshot |
| `pickJson` | Json | Required | Flexible pick data (type-discriminated) |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, userId, matchId]`

**Indexes:** `userId`, `poolId`, `[poolId, matchId]`, `[poolId, userId]`

**pickJson format (discriminated union):**
```json
{ "type": "OUTCOME", "outcome": "HOME" | "DRAW" | "AWAY" }
{ "type": "SCORE", "homeGoals": 2, "awayGoals": 1 }
{ "type": "WINNER", "winnerTeamId": "t_BRA" }
```

---

### 3.10 StructuralPrediction

A user's structural pick for an entire phase (e.g., knockout bracket winners, group standings).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `userId` | String | FK -> User | |
| `phaseId` | String | Required | Phase ID from tournament instance |
| `pickJson` | Json | Required | Phase-level prediction data |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, userId, phaseId]`

**Indexes:** `userId`, `poolId`

**pickJson format:**
```json
{ "groups": [{ "groupId": "A", "teamIds": ["t1", "t2", "t3", "t4"] }] }
{ "matches": [{ "matchId": "m1", "winnerId": "t_BRA" }] }
```

---

### 3.11 GroupStandingsPrediction

Granular per-group standings prediction. One row per pool + user + phase + group.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `userId` | String | FK -> User | |
| `phaseId` | String | Required | Tournament phase |
| `groupId` | String | Required | Group ID (A, B, C, etc.) |
| `teamIds` | String[] | Required | Team IDs in order, 1st to 4th |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, userId, phaseId, groupId]`

**Indexes:** `poolId`, `userId`

---

### 3.12 PoolMatchResult

Header record for a match result in a pool. Points to the current active version.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `matchId` | String | Required | Match ID from tournament snapshot |
| `currentVersionId` | String? | Unique, FK -> PoolMatchResultVersion | Active version pointer |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, matchId]`

**Indexes:** `poolId`

**Relations:**
- `versions` -> PoolMatchResultVersion[] (1:N, named "PoolMatchResultVersions")
- `currentVersion` -> PoolMatchResultVersion? (1:1, named "CurrentPoolMatchResult")

---

### 3.13 PoolMatchResultVersion

Immutable version of a match result. Supports erratas, auto-sync, and host overrides.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `resultId` | String | FK -> PoolMatchResult | |
| `versionNumber` | Int | Unique per resultId | |
| `status` | ResultVersionStatus | Default: PUBLISHED | |
| `homeGoals` | Int | Required | Final home goals (including ET if applicable) |
| `awayGoals` | Int | Required | Final away goals (including ET if applicable) |
| `homeGoals90` | Int? | | Home goals at 90 minutes (before ET) |
| `awayGoals90` | Int? | | Away goals at 90 minutes (before ET) |
| `homePenalties` | Int? | | Home penalty goals (knockout only) |
| `awayPenalties` | Int? | | Away penalty goals (knockout only) |
| `reason` | String? | | Required for erratas/overrides |
| `source` | ResultSource | Default: HOST_MANUAL | Origin of this result |
| `externalFixtureId` | Int? | | API-Football fixture ID (if API_CONFIRMED) |
| `externalDataJson` | Json? | | API-Football response snapshot (audit) |
| `createdByUserId` | String? | FK -> User | null for API-sourced results |
| `publishedAtUtc` | DateTime | Default: now() | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[resultId, versionNumber]`

**Indexes:** `resultId`, `source`

---

### 3.14 PoolMatchOverride

Host can exclude specific matches from scoring (e.g., cancelled match).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `matchId` | String | Required | |
| `scoringEnabled` | Boolean | Default: true | false = match excluded from leaderboard |
| `reason` | String? | | Visible to all members |
| `setByUserId` | String | FK -> User | |
| `setAtUtc` | DateTime | Default: now() | |

**Unique:** `[poolId, matchId]`

**Indexes:** `poolId`

---

### 3.15 StructuralPhaseResult

Official results for a structural phase, published by host/co-admin.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `phaseId` | String | Required | Phase ID from tournament instance |
| `resultJson` | Json | Required | Official result data (same format as StructuralPrediction.pickJson) |
| `createdByUserId` | String | FK -> User | |
| `publishedAtUtc` | DateTime | Default: now() | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, phaseId]`

**Indexes:** `poolId`

---

### 3.16 GroupStandingsResult

Official group standings result. Supports versioning for erratas.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `phaseId` | String | Required | |
| `groupId` | String | Required | |
| `teamIds` | String[] | Required | Official standings order, 1st to 4th |
| `version` | Int | Default: 1 | Incremented on errata |
| `reason` | String? | | Required if version > 1 |
| `createdByUserId` | String | FK -> User | |
| `publishedAtUtc` | DateTime | Default: now() | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[poolId, phaseId, groupId]`

**Indexes:** `poolId`

---

### 3.17 LegalDocument

Versioned legal documents (TOS, Privacy Policy) with multi-locale support.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `type` | LegalDocumentType | Required | TERMS_OF_SERVICE or PRIVACY_POLICY |
| `version` | String | Required | e.g., "2026-01-25" |
| `title` | String | Required | |
| `content` | String | @db.Text | Full markdown content |
| `changeSummary` | String? | @db.Text | Summary for users on version change |
| `locale` | String | Default: "es" | ISO 639-1 |
| `isActive` | Boolean | Default: false | Only one active per type+locale |
| `publishedAt` | DateTime? | | |
| `effectiveAt` | DateTime? | | Can be future-dated |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[type, version, locale]`

**Indexes:** `[type, locale, isActive]`

---

### 3.18 PlatformSettings

Singleton table for platform-wide configuration (email toggles).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, Default: "singleton" | Fixed ID ensures single row |
| `emailWelcomeEnabled` | Boolean | Default: true | Welcome email on registration |
| `emailPoolInvitationEnabled` | Boolean | Default: true | Pool invitation notifications |
| `emailDeadlineReminderEnabled` | Boolean | Default: false | Deadline reminders (off by default) |
| `emailResultPublishedEnabled` | Boolean | Default: true | Result published notifications |
| `emailPoolCompletedEnabled` | Boolean | Default: true | Pool completed notifications |
| `updatedAt` | DateTime | @updatedAt | |
| `updatedById` | String? | | Admin who last changed settings |

---

### 3.19 DeadlineReminderLog

Tracks sent deadline reminders to prevent duplicates.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | Required | |
| `userId` | String | Required | |
| `matchId` | String | Required | |
| `sentAt` | DateTime | Default: now() | |
| `sentToEmail` | String | Required | |
| `success` | Boolean | Default: true | |
| `error` | String? | | Error message if failed |
| `hoursBeforeDeadline` | Int | Required | Hours before deadline when sent |

**Unique:** `[poolId, userId, matchId]`

**Indexes:** `poolId`, `userId`, `sentAt`

---

### 3.20 MatchExternalMapping

Maps internal match IDs to API-Football fixture IDs for AUTO-mode instances.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `tournamentInstanceId` | String | FK -> TournamentInstance | |
| `internalMatchId` | String | Required | Match ID from dataJson |
| `apiFootballFixtureId` | Int | Required | API-Football fixture ID |
| `apiFootballHomeTeamId` | Int? | | For verification |
| `apiFootballAwayTeamId` | Int? | | For verification |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[tournamentInstanceId, internalMatchId]`, `[tournamentInstanceId, apiFootballFixtureId]`

**Indexes:** `apiFootballFixtureId`

---

### 3.21 ResultSyncLog

Audit log for each sync job execution with API-Football.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `tournamentInstanceId` | String | FK -> TournamentInstance | |
| `startedAtUtc` | DateTime | Default: now() | |
| `completedAtUtc` | DateTime? | | |
| `status` | SyncStatus | Default: RUNNING | |
| `fixturesChecked` | Int | Default: 0 | |
| `fixturesUpdated` | Int | Default: 0 | |
| `fixturesSkipped` | Int | Default: 0 | |
| `errors` | Json? | | Array of error objects |
| `apiResponseTimeMs` | Int? | | API response time in ms |
| `apiRateLimitRemaining` | Int? | | Remaining API rate limit |

**Indexes:** `tournamentInstanceId`, `status`, `startedAtUtc`

---

### 3.22 MatchSyncState

Per-match sync tracking for smart polling. See [state machine](#14-matchsyncstate-state-machine).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `tournamentInstanceId` | String | FK -> TournamentInstance (onDelete: Restrict) | |
| `internalMatchId` | String | Required | Match ID from dataJson |
| `syncStatus` | MatchSyncStatus | Default: PENDING | Current state |
| `kickoffUtc` | DateTime | Required | Match kickoff time |
| `firstCheckAtUtc` | DateTime? | | kickoff + 5 min |
| `finishCheckAtUtc` | DateTime? | | kickoff + 110 min |
| `lastCheckedAtUtc` | DateTime? | | |
| `completedAtUtc` | DateTime? | | |
| `lastApiStatus` | String? | | e.g., "1H", "HT", "2H", "FT" |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[tournamentInstanceId, internalMatchId]`

**Indexes:** `syncStatus`, `firstCheckAtUtc`, `finishCheckAtUtc`

---

### 3.23 PendingPhaseSync

When a knockout phase completes, the system tries to fetch the next phase from API-Football. If fixtures are not available yet, a pending record is created and checked every 12 hours.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `tournamentInstanceId` | String | FK -> TournamentInstance (onDelete: Restrict) | |
| `completedPhase` | String | Required | Phase that just completed (e.g., "r16") |
| `nextPhase` | String | Required | Phase to configure (e.g., "qf") |
| `apiRoundName` | String | Required | API-Football round name (e.g., "Quarter-finals") |
| `status` | PhaseSyncStatus | Default: PENDING | |
| `attempts` | Int | Default: 0 | |
| `lastAttemptAtUtc` | DateTime? | | |
| `resolvedAtUtc` | DateTime? | | |
| `errorMessage` | String? | | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Unique:** `[tournamentInstanceId, nextPhase]`

**Indexes:** `status`

---

### 3.24 BetaFeedback

User-submitted bug reports and feature suggestions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `type` | BetaFeedbackType | Required | BUG or SUGGESTION |
| `message` | String | Required | |
| `imageBase64` | String? | | Screenshot as base64 |
| `wantsContact` | Boolean | Default: false | |
| `contactName` | String? | | |
| `phoneNumber` | String? | | |
| `userId` | String? | | Nullable (anonymous feedback allowed) |
| `userEmail` | String? | | |
| `currentUrl` | String? | | Page URL at submission time |
| `userAgent` | String? | | |
| `createdAtUtc` | DateTime | Default: now() | |

**Indexes:** `type`, `createdAtUtc`

---

### 3.25 Organization

Company entity for corporate pools.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `name` | String | Required | Company name (not unique) |
| `contactEmail` | String | Required | |
| `contactName` | String | Required | |
| `contactPhone` | String? | | |
| `logoUrl` | String? | | External URL to logo |
| `logoBase64` | String? | | Logo as base64 string |
| `website` | String? | | |
| `employeeCount` | String? | | Range: "1-50", "51-200", "201-500", "500+" |
| `welcomeMessage` | String? | @db.Text | Shown in pool splash |
| `invitationMessage` | String? | @db.Text | Included in invitation email |
| `notes` | String? | @db.Text | Internal admin notes |
| `status` | OrganizationStatus | Default: INQUIRY | |
| `createdAtUtc` | DateTime | Default: now() | |
| `updatedAtUtc` | DateTime | @updatedAt | |

**Indexes:** `status`

**Relations:**
- `inquiries` -> OrganizationInquiry[] (1:N)
- `pools` -> Pool[] (1:N)

---

### 3.26 OrganizationInquiry

Contact form submissions from companies interested in corporate pools.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `organizationId` | String? | FK -> Organization | Linked after org creation |
| `companyName` | String | Required | |
| `contactName` | String | Required | |
| `contactEmail` | String | Required | |
| `contactPhone` | String? | | |
| `employeeCount` | String? | | |
| `message` | String? | @db.Text | |
| `locale` | String | Default: "es" | |
| `responded` | Boolean | Default: false | |
| `respondedAt` | DateTime? | | |
| `createdAtUtc` | DateTime | Default: now() | |

**Indexes:** `responded`, `createdAtUtc`

---

### 3.27 CorporateInvite

Employee invitation to a corporate pool. Token-based activation with 30-day expiry.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID | |
| `poolId` | String | FK -> Pool | |
| `email` | String | Required | Employee email |
| `name` | String? | | Employee name (from CSV) |
| `activationToken` | String | Unique | 48-byte crypto token |
| `activationTokenExpiresAt` | DateTime | Required | 30-day expiry |
| `status` | CorporateInviteStatus | Default: PENDING | |
| `activatedUserId` | String? | | User ID after activation |
| `activatedAt` | DateTime? | | |
| `createdAtUtc` | DateTime | Default: now() | |

**Unique:** `[poolId, email]`

**Indexes:** `activationToken`, `poolId`, `status`

---

## 4. Relationship Diagram

```
User ────────────────── 1:N ── PoolMember ── N:1 ── Pool
  |                                                   |
  |-- 1:N ── Prediction ──────────────── N:1 ────────-|
  |-- 1:N ── StructuralPrediction ────── N:1 ────────-|
  |-- 1:N ── GroupStandingsPrediction ── N:1 ────────-|
  |-- 1:N ── PoolMatchOverride ──────── N:1 ────────-|
  |-- 1:N ── PoolMatchResultVersion                   |
  |-- 1:N ── StructuralPhaseResult ──── N:1 ────────-|
  |-- 1:N ── GroupStandingsResult ───── N:1 ────────-|
  '-- 1:N ── PoolInvite ────────────── N:1 ──────────'

Pool ── N:1 ── TournamentInstance ── N:1 ── TournamentTemplateVersion ── N:1 ── TournamentTemplate
  |                  |
  |                  |-- 1:N ── MatchExternalMapping
  |                  |-- 1:N ── ResultSyncLog
  |                  |-- 1:N ── MatchSyncState
  |                  '-- 1:N ── PendingPhaseSync
  |
  |-- N:1 ── Organization ── 1:N ── OrganizationInquiry
  |-- 1:N ── CorporateInvite
  '-- 1:N ── PoolMatchResult ── 1:N ── PoolMatchResultVersion

PlatformSettings (singleton)
LegalDocument (standalone, versioned)
AuditEvent (standalone, append-only)
DeadlineReminderLog (standalone)
BetaFeedback (standalone)
```
