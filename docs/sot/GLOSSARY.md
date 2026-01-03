# Glossary of Terms
# Quiniela Platform

> **Purpose:** Centralized definition of all domain-specific terminology, concepts, and jargon used in the Quiniela Platform.
>
> **Audience:** Developers, product managers, stakeholders, and new team members.
>
> **Last Updated:** 2026-01-02

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [User Roles & Permissions](#user-roles--permissions)
- [Tournament Architecture](#tournament-architecture)
- [Pool Management](#pool-management)
- [Predictions & Scoring](#predictions--scoring)
- [Technical Terms](#technical-terms)
- [Acronyms & Abbreviations](#acronyms--abbreviations)

---

## Core Concepts

### Quiniela

**Definition:** A Spanish term for a sports prediction pool or betting pool. In this platform, it refers to a group of users competing to predict match outcomes.

**Context:** The name of the platform and the core concept.

**Example:** "I joined my office quiniela for the World Cup."

---

### Pool

**Definition:** A user-created competition where members make predictions on matches from a specific tournament instance.

**Aliases:** Quiniela, Contest, Group

**Technical:** Represented by the `Pool` database table.

**Key Attributes:**
- Name (e.g., "Office Friends WC2026")
- Tournament Instance (e.g., World Cup 2026)
- Scoring Rules (preset or custom)
- Members (players + host)
- Visibility (private/public)

**Example:** "Alice created a pool called 'Family World Cup' with 10 members."

---

### Pick (Prediction/Pronóstico)

**Definition:** A user's prediction for a specific match outcome (e.g., final score, winner).

**Aliases:** Prediction, Pronóstico, Bet (informal, but platform doesn't involve money)

**Technical:** Stored in `Prediction` table with flexible `pickJson` field.

**Types (v0.2-beta):**
- **EXACT_SCORE:** Predict exact final score (e.g., 2-1)
- **GOAL_DIFFERENCE:** Predict goal difference (e.g., +1, -2, 0)
- **MATCH_OUTCOME:** Predict winner/draw (HOME/DRAW/AWAY)
- **PARTIAL_SCORE:** Predict goals for one team

**Example:** "My pick for MEX vs CAN is 2-1 (exact score)."

---

### Leaderboard (Tabla de Posiciones)

**Definition:** Ranked list of pool members sorted by total points, with tiebreakers.

**Sorting Rules:**
1. Total points (DESC)
2. Exact score count (DESC)
3. Joined date (ASC)

**Display:** Shows rank, username, display name, points, matches scored.

**Example:** "Alice is #1 on the leaderboard with 45 points."

---

### Errata (Correction)

**Definition:** A correction to a previously published match result due to error (typo, VAR decision, score change).

**Business Rule:** Requires a mandatory `reason` field explaining the correction.

**Technical:** Creates a new `PoolMatchResultVersion` (version > 1) with immutable history.

**Example:** "Host corrected MEX vs CAN from 2-1 to 2-0. Reason: 'VAR anulled away goal.'"

---

## User Roles & Permissions

### Platform Role

**Definition:** Global role assigned to users at the platform level.

**Values:**
- **ADMIN:** Platform administrator (manages templates, instances)
- **HOST:** User who creates pools (same as PLAYER technically)
- **PLAYER:** Regular user (can join pools, make picks)

**Note:** `platformRole` does NOT grant pool-level permissions. Use `PoolMember.role` for pool permissions.

**Example:** "Juan has platformRole = ADMIN, so he can create tournament templates."

---

### Pool Role

**Definition:** Role assigned to a user within a specific pool.

**Values (v0.2-beta):**
- **HOST:** Pool creator/owner (full control)
- **CO_ADMIN:** Delegated manager (most permissions, can't delete pool)
- **PLAYER:** Regular participant (can only make picks)

**Permissions Matrix:** See [BUSINESS_RULES.md](./BUSINESS_RULES.md#81-co-admin-rules)

**Example:** "Alice is HOST in Pool A, CO_ADMIN in Pool B, and PLAYER in Pool C."

---

### Co-Admin (v0.2-beta)

**Definition:** Trusted user nominated by HOST to help manage the pool.

**Permissions:**
- ✅ Publish/correct results
- ✅ Generate invite codes
- ✅ Approve/reject join requests
- ✅ Expel/suspend players
- ❌ Nominate other co-admins
- ❌ Delete pool
- ❌ Remove host

**Nomination:** Only HOST can nominate/remove co-admins.

**Example:** "Bob was promoted to co-admin to help publish results while Alice is traveling."

---

### Active Member

**Definition:** User with `PoolMember.status = ACTIVE` (can participate).

**Contrast:** BANNED, SUSPENDED, or LEFT members cannot submit picks.

**Example:** "This pool has 20 active members and 2 banned members."

---

## Tournament Architecture

### Tournament Template

**Definition:** Reusable definition of a tournament format (e.g., "FIFA World Cup Format").

**Purpose:** Allows creating multiple instances with same structure.

**Key Attributes:**
- Key (unique identifier, e.g., `worldcup_2026`)
- Name (display name)
- Status (DRAFT, PUBLISHED, DEPRECATED)
- Versions (1:N relationship)

**Example:** "The 'World Cup Format' template has 2 versions: v1.0 (32 teams) and v2.0 (48 teams)."

---

### Tournament Template Version

**Definition:** Immutable snapshot of tournament data at a specific version.

**Immutability:** Once PUBLISHED, data cannot be edited (only new versions created).

**Contains:**
- Teams (id, name, code, groupId)
- Phases (id, name, type, order)
- Matches (id, kickoffUtc, homeTeamId, awayTeamId)

**Example:** "Version 2.0 of World Cup template defines 48 teams in 12 groups."

---

### Tournament Instance

**Definition:** A playable instance of a tournament (e.g., "World Cup 2026").

**Snapshot:** Frozen copy of template version data (never changes).

**Status States:**
- **DRAFT:** Not yet available for pools
- **ACTIVE:** Pools can be created (visible in catalog)
- **COMPLETED:** Tournament ended
- **ARCHIVED:** Hidden from catalog

**Example:** "World Cup 2026 instance is ACTIVE, so users can create pools for it."

---

### Match (Partido)

**Definition:** A single game between two teams within a tournament instance.

**Attributes:**
- `id` (unique identifier, e.g., "m1")
- `phaseId` (which phase: group stage, quarterfinal, etc.)
- `kickoffUtc` (match start time in UTC)
- `homeTeamId` / `awayTeamId` (references teams)
- `matchNumber` (display order)
- `roundLabel` (e.g., "Group A - Matchday 1")
- `groupId` (optional, for GROUP phase)

**Example:** "Match m1: Mexico vs Canada, Group A, kickoff June 11 2026 at 18:00 UTC."

---

### Phase (Fase)

**Definition:** A stage of the tournament (e.g., Group Stage, Knockout Stage).

**Types:**
- **GROUP:** Round-robin groups (e.g., World Cup groups A-L)
- **KNOCKOUT:** Single-elimination (e.g., Round of 16, Quarterfinals)

**Future:** Support custom phase types, rules per phase.

**Example:** "World Cup has 1 phase in v0.1: Group Stage (12 groups, 72 matches)."

---

### Team (Equipo)

**Definition:** A national team or club participating in the tournament.

**Attributes:**
- `id` (unique identifier, e.g., "mex")
- `name` (full name, e.g., "Mexico")
- `shortName` (abbreviation, e.g., "MEX")
- `code` (ISO code, e.g., "MEX")
- `groupId` (for GROUP phase, e.g., "A")

**Example:** "Team 'mex' (Mexico) is in Group A of World Cup 2026."

---

## Pool Management

### Invite Code (Código de Invitación)

**Definition:** Shareable code used to join a pool.

**Format:** 12-character hexadecimal string (e.g., `a3f9c2d8e1b4`)

**Generation:** Cryptographically random (`crypto.randomBytes(6).toString('hex')`)

**Attributes:**
- `code` (unique globally)
- `maxUses` (optional, null = unlimited)
- `uses` (counter, incremented on each join)
- `expiresAtUtc` (optional, null = never expires)

**Example:** "Use code `a3f9c2d8e1b4` to join the pool (expires in 7 days, max 20 uses)."

---

### Deadline (Cierre de Pronósticos)

**Definition:** Cutoff time after which picks cannot be submitted/modified.

**Calculation:**
```
deadlineUtc = match.kickoffUtc - pool.deadlineMinutesBeforeKickoff
```

**Default:** 10 minutes before match kickoff (configurable per pool: 0-1440 minutes).

**Enforcement:**
- Backend: Returns `409 DEADLINE_PASSED` if attempt to edit after deadline
- Frontend: Shows "LOCKED" badge, disables edit UI

**Example:** "Match kickoff is 18:00, deadline is 10 minutes before (17:50). Picks locked at 17:50."

---

### Pool State (v0.2-beta)

**Definition:** Lifecycle stage of a pool.

**States:**
- **DRAFT:** Pool being configured by host (< 2 members)
- **ACTIVE:** Players have joined, picks being submitted (2+ members)
- **COMPLETED:** Tournament ended, leaderboard final
- **ARCHIVED:** Hidden from UI, read-only

**Transitions:**
- DRAFT → ACTIVE (automatic when 2nd player joins)
- ACTIVE → COMPLETED (manual or auto when last match ends)
- COMPLETED → ARCHIVED (manual or auto after 90 days)

**Example:** "Pool transitions from DRAFT to ACTIVE when Bob joins (2nd member)."

---

### Join Approval (v0.2-beta)

**Definition:** Optional workflow requiring host approval before users can join pool.

**Setting:** `Pool.requireApproval` (boolean)

**Flow:**
- User enters invite code
- If `requireApproval = true`:
  1. Creates `PoolMemberRequest` (status: PENDING)
  2. Host/co-admin approves → Creates `PoolMember` (ACTIVE)
  3. Host/co-admin rejects → Updates request (REJECTED) with reason
- If `requireApproval = false`:
  - User joins immediately

**Example:** "Private pool requires approval. Alice requested to join, host approved her."

---

## Predictions & Scoring

### Pick Type

**Definition:** Category of prediction (e.g., exact score, outcome, goal difference).

**v0.1-alpha Types:**
1. **SCORE:** Predict exact score (homeGoals, awayGoals)
2. **OUTCOME:** Predict winner/draw (HOME/DRAW/AWAY)

**v0.2-beta Types (4 total):**
3. **GOAL_DIFFERENCE:** Predict goal difference (+1, -2, 0)
4. **PARTIAL_SCORE:** Predict goals for one team

**v1.0 Types (7 total):**
5. **BOTH_TEAMS_SCORE:** Both teams will score (yes/no)
6. **TOTAL_GOALS:** Over/under total goals (e.g., over 2.5)
7. **WINNING_MARGIN:** Margin of victory (+1, +2, +3+)

**Example:** "My pick type is EXACT_SCORE (2-1). My friend uses OUTCOME (HOME)."

---

### Outcome (Resultado)

**Definition:** Result of a match (who won or if it was a draw).

**Values:**
- **HOME:** Home team won
- **DRAW:** Tie/Draw
- **AWAY:** Away team won

**Calculation:**
```typescript
if (homeGoals > awayGoals) return "HOME";
if (homeGoals < awayGoals) return "AWAY";
return "DRAW";
```

**Example:** "MEX 2-1 CAN → Outcome is HOME (Mexico won)."

---

### Scoring Preset

**Definition:** Pre-configured scoring rule defining points awarded per pick type.

**v0.1-alpha Presets:**

| Preset | Outcome Points | Exact Score Bonus |
|--------|----------------|-------------------|
| **CLASSIC** | 3 | 2 |
| **OUTCOME_ONLY** | 3 | 0 |
| **EXACT_HEAVY** | 2 | 3 |

**Example:** "In CLASSIC preset, correct outcome = 3pts, exact score bonus = 2pts (total 5pts)."

---

### Pick Rules (v0.2-beta)

**Definition:** Host-configured rules defining which pick types are active and points per type.

**Configuration:**
- `activePickTypes`: Array of enabled types
- `pointsMap`: Points awarded per type

**Example:**
```json
{
  "activePickTypes": ["EXACT_SCORE", "MATCH_OUTCOME"],
  "pointsMap": {
    "EXACT_SCORE": 5,
    "MATCH_OUTCOME": 1
  }
}
```

**Scoring:** User can earn 5+1=6 pts if exact score correct (cumulative).

---

### Exact Score

**Definition:** Pick where predicted score exactly matches actual score.

**Validation:** `pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals`

**Bonus:** Awards extra points (configurable by preset).

**Example:** "I predicted 2-1, result was 2-1 → Exact score! I get 3pts (outcome) + 2pts (bonus) = 5pts."

---

### Leaderboard Verbose Mode

**Definition:** Detailed leaderboard view showing per-match breakdown of points.

**Endpoint:** `GET /pools/:poolId/leaderboard?verbose=1`

**Response:** Includes `breakdown` array per user:
```json
{
  "matchId": "m1",
  "pointsEarned": 5,
  "details": {
    "outcomeCorrect": true,
    "exactScoreCorrect": true,
    "outcomePoints": 3,
    "exactBonus": 2
  }
}
```

**Use Case:** Understanding how a user earned their points.

**Example:** "Alice's verbose leaderboard shows she earned 5pts on Match 1, 3pts on Match 2."

---

## Technical Terms

### Audit Event (Evento de Auditoría)

**Definition:** Immutable log entry recording a significant action performed by a user or system.

**Purpose:** Transparency, accountability, compliance, dispute resolution.

**Attributes:**
- `actorUserId` (who performed the action)
- `action` (e.g., "POOL_CREATED", "RESULT_PUBLISHED")
- `entityType` / `entityId` (what was affected)
- `dataJson` (additional context)
- `ip` / `userAgent` (forensic data)

**Common Events:**
- `USER_REGISTERED`, `USER_LOGGED_IN`
- `POOL_CREATED`, `POOL_JOINED`
- `PREDICTION_UPSERTED`
- `RESULT_PUBLISHED`, `RESULT_CORRECTED`

**Example:** "Audit event shows Alice published result for Match 1 at 18:05 from IP 192.168.1.1."

---

### JWT (JSON Web Token)

**Definition:** Compact, URL-safe token used for stateless authentication.

**Structure:**
```
Header.Payload.Signature
```

**Payload (Platform):**
```json
{
  "userId": "uuid",
  "platformRole": "PLAYER",
  "iat": 1672531200,
  "exp": 1672545600
}
```

**Expiry:** 4 hours (14,400 seconds)

**Security:** HMAC-SHA256 signature prevents tampering.

**Example:** "User logs in, receives JWT, includes it in `Authorization: Bearer <token>` header for API calls."

---

### Zod Schema

**Definition:** TypeScript-first schema declaration and validation library.

**Purpose:** Runtime validation of request bodies, ensuring type safety.

**Example:**
```typescript
const createPoolSchema = z.object({
  name: z.string().min(3).max(120),
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
});

const parsed = createPoolSchema.safeParse(req.body);
if (!parsed.success) {
  // Return validation error
}
```

**Benefits:** Type inference, clear error messages, composability.

---

### Prisma

**Definition:** Next-generation TypeScript ORM (Object-Relational Mapping) for Node.js.

**Features:**
- Declarative schema (`schema.prisma`)
- Type-safe query builder
- Migration system
- Auto-generated client

**Example:**
```typescript
const pool = await prisma.pool.findUnique({
  where: { id: poolId },
  include: { members: true }
});
```

**Benefits:** Developer experience, type safety, prevents SQL injection.

---

### Upsert

**Definition:** Database operation that either **updates** an existing record or **inserts** a new one (portmanteau of "update" + "insert").

**Use Case:** Picks (user can modify pick before deadline).

**Prisma Example:**
```typescript
await prisma.prediction.upsert({
  where: { poolId_userId_matchId: { poolId, userId, matchId } },
  update: { pickJson },
  create: { poolId, userId, matchId, pickJson }
});
```

**Example:** "User submits pick for Match 1 → Upsert creates new record. User changes pick → Upsert updates existing record."

---

### Immutability (Inmutabilidad)

**Definition:** Property of data that cannot be changed after creation (read-only).

**Applied To:**
- `TournamentTemplateVersion` (once PUBLISHED)
- `PoolMatchResultVersion` (all versions)
- `AuditEvent` (all events)

**Purpose:** Data integrity, audit trail, dispute resolution.

**Example:** "Result version 1 is immutable. To correct, create version 2 (with reason)."

---

### Soft Delete (Borrado Suave)

**Definition:** Marking a record as deleted (e.g., `status = ARCHIVED`) instead of physically removing it from the database.

**Purpose:** Data retention, audit trail, recovery.

**Applied To:**
- Pools (ARCHIVED instead of DELETE)
- Users (DISABLED instead of DELETE)
- PoolMembers (BANNED/LEFT instead of DELETE)

**Contrast:** Hard delete (permanent removal from database).

**Example:** "Pool is ARCHIVED (soft delete), not deleted. Data remains for historical purposes."

---

### Snapshot (Instantánea)

**Definition:** Frozen copy of data at a specific point in time.

**Use Cases:**
- `TournamentInstance.dataJson` (frozen copy of template version)
- Future: Leaderboard snapshots (before errata)

**Purpose:** Immutability, preventing cascading changes.

**Example:** "Instance snapshot contains 48 teams. If template updates to 64 teams, instance is unaffected."

---

## Acronyms & Abbreviations

### ADR

**Full Form:** Architectural Decision Record

**Definition:** Document recording a significant architectural or technical decision.

**Example:** "ADR-006 explains why we use template/version/instance architecture."

---

### CRUD

**Full Form:** Create, Read, Update, Delete

**Definition:** Four basic operations for persistent storage.

**Example:** "Pools endpoint supports CRUD operations (except Delete in v0.1)."

---

### ERD

**Full Form:** Entity Relationship Diagram

**Definition:** Visual representation of database schema showing entities and relationships.

**Location:** See [DATA_MODEL.md](./DATA_MODEL.md#2-entity-relationship-diagram-erd)

---

### FK

**Full Form:** Foreign Key

**Definition:** Database constraint enforcing referential integrity between tables.

**Example:** "`Pool.tournamentInstanceId` is a foreign key to `TournamentInstance.id`."

---

### JWT

**Full Form:** JSON Web Token

**Definition:** See [JWT entry above](#jwt-json-web-token).

---

### MVP

**Full Form:** Minimum Viable Product

**Definition:** Simplest version of product with core features to validate market demand.

**Context:** v0.1-alpha is internal MVP, v1.0 is public MVP.

**Example:** "MVP includes pools, picks, results, leaderboard. Dark mode is post-MVP."

---

### ORM

**Full Form:** Object-Relational Mapping

**Definition:** Library that maps database tables to code objects (e.g., Prisma, TypeORM).

**Example:** "Prisma ORM generates TypeScript types from `schema.prisma`."

---

### PRD

**Full Form:** Product Requirements Document

**Definition:** Document defining product vision, features, user stories, success metrics.

**Location:** [PRD.md](./PRD.md)

---

### REST

**Full Form:** Representational State Transfer

**Definition:** Architectural style for APIs using HTTP methods (GET, POST, PUT, DELETE).

**Example:** "`GET /pools/:id` returns pool details (RESTful endpoint)."

---

### SoT

**Full Form:** Source of Truth

**Definition:** Authoritative reference for information (this documentation).

**Location:** `/docs/sot/` directory

---

### SPA

**Full Form:** Single-Page Application

**Definition:** Web app that loads once and dynamically updates (no full page reloads).

**Example:** "Quiniela frontend is an SPA built with React."

---

### TZ / Timezone

**Full Form:** Time Zone

**Definition:** Geographic region with uniform standard time.

**Format:** IANA timezone (e.g., "America/Mexico_City", "UTC")

**Use:** Pool timezone for localizing match times to user's region.

**Example:** "Pool timezone is 'America/Bogota' (UTC-5)."

---

### UI / UX

**Full Forms:**
- **UI:** User Interface (visual design, buttons, layouts)
- **UX:** User Experience (flow, usability, satisfaction)

**Example:** "UX of picks improved: read mode vs edit mode."

---

### UUID

**Full Form:** Universally Unique Identifier

**Definition:** 128-bit identifier with near-zero collision probability.

**Format:** `a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6` (36 chars with hyphens)

**Use:** Primary keys for all entities (User, Pool, etc.)

**Example:** "Pool ID is `a3f9c2d8-e1b4-4c5d-6e7f-8g9h0i1j2k3l` (UUID)."

---

## Domain-Specific Slang

### Host (Anfitrión)

**Definition:** User who creates and manages a pool.

**Responsibilities:**
- Configure pool settings
- Publish match results
- Invite/approve members
- Enforce pool rules (outside platform)

**Example:** "Alice is the host of 'Office WC2026' pool."

---

### Player (Jugador)

**Definition:** User who participates in a pool by making predictions.

**Contrast:** HOST (manages pool), PLAYER (just makes picks).

**Example:** "Bob is a player in 3 pools: Office, Family, and Friends."

---

### Ban (Expulsión/Veto)

**Definition:** Permanent removal of a player from a pool (cannot rejoin).

**Types:**
- **Permanent:** Cannot rejoin unless reactivated by host
- **Temporary:** Auto-reactivate after specified date

**Effect:** Picks remain visible (transparency), but cannot submit new picks.

**Example:** "Charlie was banned for violating pool rules. His picks still count."

---

### Kick (Expulsar)

**Definition:** Informal term for removing a player (in this platform, same as "ban").

**Note:** Platform uses "ban" (permanent) or "suspend" (temporary), not "kick."

---

### Upset (Sorpresa)

**Definition:** Unexpected result where underdog wins or heavily favored team loses.

**Future:** Upset predictions may earn bonus points (difficulty weighting).

**Example:** "Predicting underdog win in upset match could earn 2x points (future feature)."

---

## Related Documentation

- [PRD.md](./PRD.md) - Product requirements & features
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema & entities
- [API_SPEC.md](./API_SPEC.md) - API endpoints & contracts
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Validation rules & business logic
- [DECISION_LOG.md](./DECISION_LOG.md) - Architectural decisions

---

**END OF GLOSSARY**
