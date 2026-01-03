# Architectural Decision Log (ADL)
# Quiniela Platform

> **Purpose:** Record all significant architectural, technical, and product decisions with context and rationale.
>
> **Format:** Each decision includes: Context, Decision, Rationale, Consequences, Alternatives Considered, Status
>
> **Last Updated:** 2026-01-02

---

## How to Use This Document

**When to Add a Decision:**
- Architecture choice (database, framework, deployment)
- API design pattern (REST endpoint structure, error handling)
- Data model change (new table, schema migration)
- Business rule change (scoring, deadlines, permissions)
- Security/performance trade-off

**Template:**

```markdown
## ADR-XXX: [Short Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY
**Deciders:** [Who made this decision]
**Tags:** #architecture #api #database #security #performance

### Context
What is the issue we're facing? What constraints exist?

### Decision
What did we decide to do?

### Rationale
Why did we choose this option? What were the driving factors?

### Consequences
**Positive:**
- ✅ Benefit 1
- ✅ Benefit 2

**Negative:**
- ⚠️ Trade-off 1
- ⚠️ Trade-off 2

**Risks:**
- ⚠️ Risk 1

### Alternatives Considered
1. **Option A:** Why we rejected it
2. **Option B:** Why we rejected it

### Implementation Notes
How to implement this decision (if applicable)

### Related Decisions
- ADR-XXX (depends on/supersedes/related to)
```

---

## Decision Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](#adr-001-monorepo-structure) | Monorepo Structure | Accepted | 2024-12-28 |
| [002](#adr-002-postgresql-as-primary-database) | PostgreSQL as Primary Database | Accepted | 2024-12-28 |
| [003](#adr-003-prisma-orm) | Prisma ORM | Accepted | 2024-12-28 |
| [004](#adr-004-jwt-for-authentication) | JWT for Authentication | Accepted | 2024-12-28 |
| [005](#adr-005-zod-for-validation) | Zod for Validation | Accepted | 2024-12-28 |
| [006](#adr-006-template-version-instance-architecture) | Template/Version/Instance Architecture | Accepted | 2024-12-29 |
| [007](#adr-007-result-versioning-for-erratas) | Result Versioning for Erratas | Accepted | 2024-12-29 |
| [008](#adr-008-json-fields-for-picks-and-tournament-data) | JSON Fields for Picks & Tournament Data | Accepted | 2024-12-29 |
| [009](#adr-009-single-call-overview-endpoint) | Single-Call Overview Endpoint | Accepted | 2024-12-29 |
| [010](#adr-010-no-pool-deletion-only-archival) | No Pool Deletion (Only Archival) | Accepted | 2026-01-02 |
| [011](#adr-011-multi-type-pick-system) | Multi-Type Pick System | Accepted | 2026-01-02 |
| [012](#adr-012-co-admin-permissions-model) | Co-Admin Permissions Model | Accepted | 2026-01-02 |
| [013](#adr-013-leaderboard-tiebreaker-rules) | Leaderboard Tiebreaker Rules | Accepted | 2026-01-02 |
| [014](#adr-014-player-expulsion-permanent-and-temporary) | Player Expulsion (Permanent & Temporary) | Accepted | 2026-01-02 |
| [015](#adr-015-resend-as-email-provider) | Resend as Email Provider | Accepted | 2026-01-02 |
| [016](#adr-016-react-without-state-management-library) | React Without State Management Library | Accepted | 2024-12-28 |
| [017](#adr-017-light-theme-only-for-mvp) | Light Theme Only for MVP | Accepted | 2024-12-28 |

---

## ADR-001: Monorepo Structure

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #architecture #project-structure

### Context

We need to decide how to organize the codebase for a platform with frontend (React) and backend (Node.js). Options include:
1. Monorepo (single repo with /frontend and /backend)
2. Separate repos (frontend-repo and backend-repo)
3. Monolithic repo (all code in one package)

### Decision

**Use a monorepo structure** with `/backend` and `/frontend` as separate packages in a single Git repository.

### Rationale

- ✅ **Atomic commits:** Changes spanning frontend + backend can be committed together
- ✅ **Simplified local development:** Clone once, run both services
- ✅ **Shared documentation:** Single source of truth (CLAUDE.md, docs/)
- ✅ **Easier dependency management:** Can share TypeScript types (future)
- ✅ **Single CI/CD pipeline:** Build and deploy both services in one workflow

### Consequences

**Positive:**
- ✅ Simplified workflow for full-stack changes
- ✅ Single version tag for coordinated releases
- ✅ Easier onboarding for new developers

**Negative:**
- ⚠️ Larger repo size (two node_modules directories)
- ⚠️ Potential merge conflicts if team grows
- ⚠️ CI/CD must handle both services (more complex)

**Risks:**
- ⚠️ Tight coupling (changes in one service may force changes in other)

### Alternatives Considered

1. **Separate repos:** Rejected due to overhead of coordinating changes across repos
2. **Lerna/Nx monorepo tools:** Overkill for 2 packages, adds complexity

### Implementation Notes

```
quiniela-platform/
├── backend/
│   ├── package.json
│   └── src/
├── frontend/
│   ├── package.json
│   └── src/
├── docs/
└── CLAUDE.md
```

Each package has its own `package.json` and runs independently.

---

## ADR-002: PostgreSQL as Primary Database

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #database #architecture

### Context

Need to choose a database for storing users, pools, predictions, results, templates. Requirements:
- **Relational data** (users → pools → predictions)
- **ACID transactions** (critical for result versioning)
- **Complex queries** (leaderboard calculation with JOINs)
- **Scalability** (support 10k+ users, 1M+ predictions)

### Decision

**Use PostgreSQL 14+** as the primary (and only) database.

### Rationale

- ✅ **Proven relational database** (mature, stable)
- ✅ **Excellent JSON support** (for `pickJson`, `dataJson`)
- ✅ **ACID transactions** (critical for result versioning)
- ✅ **Foreign key constraints** (referential integrity)
- ✅ **Powerful indexing** (B-tree, GiST for JSON queries)
- ✅ **Open source** (no licensing costs)
- ✅ **Wide ecosystem** (ORMs, monitoring, backups)
- ✅ **Horizontal scaling** (read replicas, sharding if needed)

### Consequences

**Positive:**
- ✅ Single database to learn/maintain
- ✅ Strong data integrity guarantees
- ✅ Rich query capabilities (CTEs, window functions)

**Negative:**
- ⚠️ Requires Docker for local development (not native)
- ⚠️ Vertical scaling limits (max ~64GB RAM before sharding)

**Risks:**
- ⚠️ Over-reliance on RDBMS (future NoSQL needs require migration)

### Alternatives Considered

1. **MySQL:** Similar but less robust JSON support
2. **MongoDB:** Better for unstructured data, but lacks ACID transactions (at document level)
3. **SQLite:** Too limited for production (file-based, no concurrency)

### Implementation Notes

- Run via Docker Compose for local dev
- Use managed PostgreSQL (e.g., Railway, Render, AWS RDS) for production

---

## ADR-003: Prisma ORM

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #database #orm #typescript

### Context

Need an ORM/query builder for interacting with PostgreSQL. Options:
1. Prisma (declarative schema, type-safe client)
2. TypeORM (ActiveRecord/DataMapper patterns)
3. Sequelize (mature, but less TypeScript-friendly)
4. Knex.js (SQL builder, no models)
5. Raw SQL (maximum control, no abstraction)

### Decision

**Use Prisma ORM** for all database interactions.

### Rationale

- ✅ **Type safety:** Generates TypeScript types from schema
- ✅ **Migration system:** Version-controlled schema changes
- ✅ **Developer experience:** Autocomplete, inline docs
- ✅ **Query builder:** Prevents SQL injection (parameterized queries)
- ✅ **Relations:** Automatic JOIN generation
- ✅ **Transactions:** Built-in `$transaction()` support
- ✅ **Active development:** Well-maintained, modern tooling

### Consequences

**Positive:**
- ✅ Fast development (less boilerplate)
- ✅ Fewer runtime errors (TypeScript catches issues)
- ✅ Clear migration history (Git-tracked)

**Negative:**
- ⚠️ Abstraction layer (harder to optimize complex queries)
- ⚠️ Vendor lock-in (Prisma-specific syntax)
- ⚠️ Generated client adds build step

**Risks:**
- ⚠️ Performance overhead (vs raw SQL) - mitigated by Prisma's query optimization

### Alternatives Considered

1. **TypeORM:** More verbose, less TypeScript-first
2. **Sequelize:** Older API, less type-safe
3. **Knex.js:** Too low-level, no type generation
4. **Raw SQL:** Maximum performance but high maintenance

### Implementation Notes

```typescript
// schema.prisma defines models
// npx prisma migrate dev creates migrations
// @prisma/client auto-generated

import { prisma } from './db';
const users = await prisma.user.findMany();
```

---

## ADR-004: JWT for Authentication

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #security #authentication

### Context

Need authentication mechanism for API. Requirements:
- Stateless (no session store)
- Secure (prevent tampering)
- Short-lived (limit exposure)
- Easy to validate (on every request)

### Decision

**Use JWT (JSON Web Tokens)** with HMAC-SHA256 signing, 4-hour expiry.

### Rationale

- ✅ **Stateless:** No database lookup on every request (fast)
- ✅ **Self-contained:** Payload includes userId, role
- ✅ **Standard:** Widely supported (libraries, tools)
- ✅ **Tamper-proof:** Signature prevents modification
- ✅ **Scalable:** No shared session store needed

### Consequences

**Positive:**
- ✅ Fast authentication (no DB hit per request)
- ✅ Easy to scale horizontally (stateless)
- ✅ Works across domains (CORS-friendly)

**Negative:**
- ⚠️ Cannot revoke tokens (once issued, valid until expiry)
- ⚠️ Token theft risk (XSS, network sniffing)
- ⚠️ No built-in refresh mechanism (user re-authenticates after 4h)

**Risks:**
- ⚠️ Secret key leakage → all tokens compromised

### Alternatives Considered

1. **Session cookies:** Stateful, requires session store (Redis)
2. **OAuth 2.0 (external):** Overkill for MVP, adds complexity
3. **HTTP Basic Auth:** Insecure (credentials in every request)

### Implementation Notes

```typescript
// Sign JWT on login
const token = jwt.sign({ userId, platformRole }, JWT_SECRET, { expiresIn: '4h' });

// Verify JWT on every protected endpoint
const payload = jwt.verify(token, JWT_SECRET);
```

**Future (v1.1):**
- Add refresh tokens (long-lived, can be revoked)
- Store refresh tokens in database
- Rotate access tokens every 15 minutes

---

## ADR-005: Zod for Validation

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #validation #typescript

### Context

Need runtime validation for API request bodies. Options:
1. Zod (TypeScript-first schema validation)
2. Joi (mature, widely used)
3. Yup (React Forms-oriented)
4. class-validator (decorator-based)
5. Manual validation (if/else checks)

### Decision

**Use Zod** for all request body validation.

### Rationale

- ✅ **TypeScript integration:** Infer types from schemas
- ✅ **Composable:** Build complex schemas from primitives
- ✅ **Discriminated unions:** Perfect for pick types
- ✅ **Clear error messages:** User-friendly validation errors
- ✅ **Zero dependencies:** Lightweight
- ✅ **Active development:** Modern, well-maintained

### Consequences

**Positive:**
- ✅ Single source of truth (schema = type + validation)
- ✅ Catch errors early (runtime validation)
- ✅ Clear error responses (structured, actionable)

**Negative:**
- ⚠️ Learning curve (Zod-specific API)
- ⚠️ Bundle size (adds ~10KB gzipped)

**Risks:**
- ⚠️ Performance overhead (validation on every request) - negligible in practice

### Alternatives Considered

1. **Joi:** Not TypeScript-first, requires separate type definitions
2. **Yup:** Async validation (overkill for API)
3. **class-validator:** Decorator-based (verbose)
4. **Manual validation:** Error-prone, hard to maintain

### Implementation Notes

```typescript
const createPoolSchema = z.object({
  name: z.string().min(3).max(120),
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
});

const parsed = createPoolSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error });
}
```

---

## ADR-006: Template/Version/Instance Architecture

**Date:** 2024-12-29
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #architecture #data-model

### Context

Need a way to manage tournament definitions that:
- Can evolve over time (e.g., World Cup 32 teams → 48 teams)
- Can be reused (e.g., same format for WC 2026, 2030)
- Ensures pools don't break when template changes
- Supports admin curation (not user-generated)

### Decision

**Use a 3-tier architecture:**
1. **TournamentTemplate:** Reusable definition (e.g., "World Cup Format")
2. **TournamentTemplateVersion:** Immutable snapshot (e.g., "v1.0: 32 teams", "v2.0: 48 teams")
3. **TournamentInstance:** Playable instance (e.g., "World Cup 2026")

### Rationale

- ✅ **Versioning:** Templates can evolve without breaking existing instances
- ✅ **Immutability:** Instances freeze a snapshot (never change even if template updates)
- ✅ **Reusability:** Same template can power multiple instances
- ✅ **Curation:** Only admins create templates/instances (quality control)

### Consequences

**Positive:**
- ✅ Future-proof (supports format changes like 48-team World Cup)
- ✅ Data integrity (pools never break due to template updates)
- ✅ Clear separation (templates vs actual tournaments)

**Negative:**
- ⚠️ Complexity (3 entities vs 1)
- ⚠️ Storage duplication (each instance copies template data)

**Risks:**
- ⚠️ Learning curve for admins (must understand versioning)

### Alternatives Considered

1. **Single Tournament table:** Rejected due to lack of versioning
2. **Template only (no instances):** Rejected due to coupling (pools directly on templates)

### Implementation Notes

**Flow:**
1. Admin creates Template (key: "worldcup_2026")
2. Admin creates Version (data: 48 teams, 12 groups, 72 matches)
3. Admin publishes Version → Immutable
4. Admin creates Instance from Version → Frozen snapshot
5. Users create Pools on Instance

---

## ADR-007: Result Versioning for Erratas

**Date:** 2024-12-29
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #data-model #transparency

### Context

Match results can have errors (typos, VAR decisions, score changes). Need a way to:
- Correct results after publication
- Preserve history (audit trail)
- Require explanation for changes (accountability)
- Recalculate leaderboard on corrections

### Decision

**Use result versioning:** Each correction creates a new immutable version with reason.

**Schema:**
- `PoolMatchResult` (header with currentVersionId pointer)
- `PoolMatchResultVersion` (immutable versions: 1, 2, 3, ...)

### Rationale

- ✅ **Transparency:** Players see what changed and why
- ✅ **Auditability:** Full history of changes
- ✅ **Accountability:** Reason required for corrections
- ✅ **Dispute resolution:** Evidence if players disagree
- ✅ **Leaderboard recalc:** Use latest version for scoring

### Consequences

**Positive:**
- ✅ Trust (players trust results can be corrected transparently)
- ✅ Fairness (no silent changes)
- ✅ Compliance (audit trail for disputes)

**Negative:**
- ⚠️ Complexity (2 tables vs 1)
- ⚠️ Storage overhead (old versions retained)

**Risks:**
- ⚠️ Hosts abusing corrections (mitigated by audit log visibility)

### Alternatives Considered

1. **Single result row (UPDATE):** Rejected due to lost history
2. **Soft delete + new row:** Rejected due to confusion (which is current?)

### Implementation Notes

**First publication (version 1):**
```sql
INSERT INTO PoolMatchResultVersion (resultId, versionNumber, homeGoals, awayGoals, reason)
VALUES (result_id, 1, 2, 1, NULL);
```

**Errata (version 2):**
```sql
INSERT INTO PoolMatchResultVersion (resultId, versionNumber, homeGoals, awayGoals, reason)
VALUES (result_id, 2, 2, 0, 'VAR anulled away goal');
```

**Constraint:** `reason` required if `versionNumber > 1`

---

## ADR-008: JSON Fields for Picks & Tournament Data

**Date:** 2024-12-29
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #data-model #flexibility

### Context

Need flexible storage for:
- **Pick data:** Different pick types (SCORE, OUTCOME, future: WINNER, GROUP_POS)
- **Tournament data:** Teams, matches, phases (evolving schema)

Options:
1. Strict columns (e.g., `homeGoals INT, awayGoals INT`)
2. JSON fields (flexible schema)
3. EAV (Entity-Attribute-Value) pattern

### Decision

**Use JSON fields** (`pickJson`, `dataJson`) with runtime validation (Zod).

### Rationale

- ✅ **Schema evolution:** Add new pick types without migration
- ✅ **Backward compatibility:** Old picks remain valid
- ✅ **Flexibility:** Different pick types can coexist
- ✅ **PostgreSQL support:** Excellent JSON indexing/querying
- ✅ **Type safety:** Zod validates JSON at runtime

### Consequences

**Positive:**
- ✅ Future-proof (add pick types without migrations)
- ✅ Simplified schema (fewer columns)
- ✅ Easy to extend (new fields in JSON)

**Negative:**
- ⚠️ Less database-level validation (relies on app layer)
- ⚠️ Harder to query (JSON path queries)
- ⚠️ Migration complexity (changing JSON structure)

**Risks:**
- ⚠️ Schema drift (JSON structure inconsistencies over time)

### Alternatives Considered

1. **Strict columns:** Rejected due to frequent schema changes
2. **EAV pattern:** Rejected due to query complexity

### Implementation Notes

**Pick JSON (discriminated union):**
```typescript
const pickSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SCORE"), homeGoals: z.number(), awayGoals: z.number() }),
  z.object({ type: z.literal("OUTCOME"), outcome: z.enum(["HOME", "DRAW", "AWAY"]) }),
]);
```

**Tournament Data JSON:**
```typescript
{
  "teams": [...],
  "phases": [...],
  "matches": [...],
  "note": "..."
}
```

---

## ADR-009: Single-Call Overview Endpoint

**Date:** 2024-12-29
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #api #performance #ux

### Context

Pool page needs:
1. Pool details
2. Tournament instance (teams, matches)
3. User's picks
4. Match results
5. Leaderboard

Fetching these separately = 5+ API calls = slow UX + loading spinners.

### Decision

**Create `/pools/:poolId/overview` endpoint** that returns all data in one call.

### Rationale

- ✅ **Fewer API calls:** 1 instead of 5-6
- ✅ **Faster UX:** No cascading loading states
- ✅ **Optimized queries:** Backend can JOIN efficiently
- ✅ **Simpler frontend:** Single fetch call

### Consequences

**Positive:**
- ✅ Faster page load (reduced latency)
- ✅ Better UX (no loading spinners between sections)
- ✅ Server-side optimization (control query execution)

**Negative:**
- ⚠️ Larger payload (~50KB for 72 matches)
- ⚠️ Over-fetching (loads all data even if user only needs leaderboard)
- ⚠️ Harder to cache (entire object invalidates on any change)

**Risks:**
- ⚠️ Scalability (large pools with 500+ members)

### Alternatives Considered

1. **Multiple endpoints:** Rejected due to UX concerns (loading spinners)
2. **GraphQL:** Overkill for MVP, adds complexity

### Implementation Notes

**Endpoint:** `GET /pools/:poolId/overview?leaderboardVerbose=1`

**Response structure:**
```json
{
  "nowUtc": "...",
  "pool": { /* ... */ },
  "myMembership": { /* ... */ },
  "permissions": { /* ... */ },
  "matches": [ /* enriched with picks, results, teams */ ],
  "leaderboard": { /* ... */ }
}
```

**Future optimization (v1.0):**
- Add pagination for matches
- Cache response in Redis (invalidate on updates)

---

## ADR-010: No Pool Deletion (Only Archival)

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #data-integrity #transparency

### Context

Should hosts be able to delete pools? Concerns:
- **Transparency:** Players lose access to historical data
- **Disputes:** No evidence if host deletes pool
- **Data loss:** Accidental deletion (no undo)

### Decision

**Pools cannot be deleted after 2nd player joins.** Only archival is allowed.

**State machine:**
```
DRAFT (< 2 members) ──→ Can be DELETED
ACTIVE (2+ members) ──→ Cannot be deleted, only ARCHIVED
```

### Rationale

- ✅ **Transparency:** Players can review historical pools
- ✅ **Dispute resolution:** Evidence preserved
- ✅ **Data safety:** No accidental deletion
- ✅ **Statistics:** Future features (user win rate, etc.) require history

### Consequences

**Positive:**
- ✅ Data integrity (no accidental loss)
- ✅ Trust (players feel secure)
- ✅ Historical data (enables future analytics)

**Negative:**
- ⚠️ Database growth (pools never truly deleted)
- ⚠️ GDPR concerns (user data retained)

**Risks:**
- ⚠️ Storage costs (mitigate with archival policies)

### Alternatives Considered

1. **Allow deletion always:** Rejected due to transparency concerns
2. **Allow deletion after 90 days:** Rejected due to statistical value of old pools

### Implementation Notes

**v0.2-beta:**
- Add `status` field to Pool (DRAFT, ACTIVE, COMPLETED, ARCHIVED)
- Allow deletion only if `status = DRAFT` AND `memberCount < 2`
- Hosts can manually archive (hides from UI)
- Auto-archive after 90 days of COMPLETED status

**Future (v1.1 - GDPR):**
- Anonymization: Replace user email/name with `[DELETED USER]`
- Retain userId FK for data integrity
- Predictions attributed to anonymized user

---

## ADR-011: Multi-Type Pick System

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #product #picks #scoring

### Context

Hosts want flexibility in pick types and scoring. Requirements:
- Support different prediction types (exact score, difference, outcome, partial score, etc.)
- Allow multiple pick types to coexist (cumulative scoring)
- Host configures which types are active + points per type

### Decision

**Implement multi-type pick system** with 7 pick types (v0.2-beta: 4 types).

**Pick Types:**
1. EXACT_SCORE (both scores exact)
2. GOAL_DIFFERENCE (difference correct)
3. MATCH_OUTCOME (HOME/DRAW/AWAY)
4. PARTIAL_SCORE (one team's score correct)
5. BOTH_TEAMS_SCORE (yes/no)
6. TOTAL_GOALS (over/under)
7. WINNING_MARGIN (+1, +2, +3+)

**Host Configuration:**
- Select active pick types
- Assign points per type
- Allow cumulative scoring (multiple types on same match)

### Rationale

- ✅ **Flexibility:** Hosts customize difficulty/complexity
- ✅ **Engagement:** More ways to score = more fun
- ✅ **Skill differentiation:** Rewards precise predictions
- ✅ **Future-proof:** Easy to add more types

### Consequences

**Positive:**
- ✅ Highly customizable pools
- ✅ Appeals to different player types (casual vs competitive)
- ✅ Extensible (add new types without breaking existing)

**Negative:**
- ⚠️ Complexity (more types = harder to explain)
- ⚠️ UI challenge (show 7 inputs per match)
- ⚠️ Scoring calculation complexity

**Risks:**
- ⚠️ User confusion (too many options)

### Alternatives Considered

1. **Fixed pick types:** Rejected due to lack of flexibility
2. **Only exact score:** Rejected due to high difficulty
3. **Presets only:** Considered but limiting for advanced hosts

### Implementation Notes

**v0.2-beta (4 types):**
- EXACT_SCORE, GOAL_DIFFERENCE, MATCH_OUTCOME, PARTIAL_SCORE

**v1.0 (7 types):**
- Add BOTH_TEAMS_SCORE, TOTAL_GOALS, WINNING_MARGIN

**Pick JSON structure:**
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

**Validation:** All active pick types must be submitted.

---

## ADR-012: Co-Admin Permissions Model

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #permissions #roles

### Context

Hosts need help managing pools (publish results, approve members, etc.). Options:
1. Single HOST (no delegation)
2. CO_ADMIN role (delegated management)
3. Granular permissions (per-user custom permissions)

### Decision

**Implement CO_ADMIN role** with fixed permission set.

**Permissions:**
| Action | HOST | CO_ADMIN | PLAYER |
|--------|:----:|:--------:|:------:|
| Publish results | ✅ | ✅ | ❌ |
| Correct results | ✅ | ✅ | ❌ |
| Invite players | ✅ | ✅ | ❌ |
| Approve join requests | ✅ | ✅ | ❌ |
| Expel players | ✅ | ✅ | ❌ |
| Nominate co-admins | ✅ | ❌ | ❌ |
| Delete pool | ✅ | ❌ | ❌ |

### Rationale

- ✅ **Delegation:** Hosts can share workload
- ✅ **Trust model:** CO_ADMIN trusted but not equal to HOST
- ✅ **Simplicity:** Fixed permissions (no custom config)
- ✅ **Accountability:** Audit log tracks who did what

### Consequences

**Positive:**
- ✅ Scalability (hosts can manage large pools with help)
- ✅ Redundancy (results can be published if host unavailable)
- ✅ Clear hierarchy (HOST > CO_ADMIN > PLAYER)

**Negative:**
- ⚠️ Potential abuse (CO_ADMIN could ban players maliciously)
- ⚠️ No granularity (all-or-nothing permissions)

**Risks:**
- ⚠️ Power struggles (mitigated by HOST-only removal power)

### Alternatives Considered

1. **No delegation:** Rejected due to scalability issues
2. **Granular permissions:** Overkill for MVP, adds UI complexity

### Implementation Notes

**Nomination:**
- HOST selects PLAYER → Upgrades to CO_ADMIN
- Creates audit event

**Removal:**
- HOST removes CO_ADMIN → Downgrades to PLAYER (doesn't kick)
- Creates audit event

**Future (v1.1):**
- Custom permission sets (e.g., "can publish results" but not "can ban players")

---

## ADR-013: Leaderboard Tiebreaker Rules

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #scoring #leaderboard

### Context

Multiple players can have same total points. Need tiebreaker rules that are:
- Fair
- Deterministic (no randomness)
- Rewarding skill (not just luck)

### Decision

**Tiebreaker order:**
1. **Total points** (DESC)
2. **Exact score count** (DESC) - most exact predictions wins
3. **Joined date** (ASC) - earliest member wins

### Rationale

- ✅ **Skill-based:** Exact scores harder than outcomes
- ✅ **Loyalty bonus:** Early joiners rewarded
- ✅ **Deterministic:** No ties possible (joinedAtUtc is unique)
- ✅ **Simple to explain:** Clear hierarchy

### Consequences

**Positive:**
- ✅ Rewards precision (exact scores)
- ✅ Rewards loyalty (early join)
- ✅ No random tiebreakers

**Negative:**
- ⚠️ Joiners-first advantage (timing matters)
- ⚠️ Discourages late joins (psychological)

**Risks:**
- ⚠️ Perceived unfairness (skill vs timing debate)

### Alternatives Considered

1. **Total correct outcomes (fallback):** Considered, may add in v1.1
2. **Head-to-head record:** Too complex to calculate
3. **Random tiebreaker:** Rejected due to unfairness
4. **Shared rank (ties allowed):** Rejected due to competitive nature

### Implementation Notes

**SQL sort:**
```sql
ORDER BY totalPoints DESC, exactScoreCount DESC, joinedAtUtc ASC
```

**Future (v1.1 discussion):**
- Add "total correct outcomes" as tiebreaker #2 (before joined date)
- Add "difficulty weighting" (upset predictions worth more)

---

## ADR-014: Player Expulsion (Permanent & Temporary)

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #moderation #roles

### Context

Hosts need ability to remove disruptive players. Requirements:
- Prevent rejoining (not just kicking)
- Preserve data transparency (picks remain visible)
- Support temporary suspensions (e.g., late payment)
- Require accountability (reason must be given)

### Decision

**Implement two expulsion types:**

1. **Permanent Ban:**
   - `status = BANNED`, `bannedUntilUtc = null`
   - Cannot rejoin (blocked by userId check)
   - Can be reactivated by HOST

2. **Temporary Suspension:**
   - `status = SUSPENDED`, `bannedUntilUtc = <date>`
   - Auto-reactivate after date (cron job)
   - Can be manually reactivated early

**Effect:**
- Picks remain visible (transparency)
- Leaderboard shows "❌ Expulsado" badge
- Cannot submit new picks
- Cannot rejoin with any invite code

### Rationale

- ✅ **Flexibility:** Permanent vs temporary
- ✅ **Transparency:** Picks visible (data integrity)
- ✅ **Accountability:** Reason required
- ✅ **Reversible:** Can be reactivated

### Consequences

**Positive:**
- ✅ Hosts can manage disruptive players
- ✅ Data preserved (no deletion)
- ✅ Audit trail (who banned, when, why)

**Negative:**
- ⚠️ Potential abuse (host bans unfairly)
- ⚠️ Complexity (temp vs perm)

**Risks:**
- ⚠️ Disputes (player contests ban) - mitigated by visible audit log

### Alternatives Considered

1. **Kick only (can rejoin):** Rejected due to ineffectiveness
2. **Hard delete (remove all data):** Rejected due to transparency loss

### Implementation Notes

**Fields:**
```prisma
status: ACTIVE | BANNED | SUSPENDED
bannedAtUtc: DateTime?
bannedUntilUtc: DateTime?  // null = permanent
bannedReason: String
```

**Cron job (daily):**
```sql
UPDATE PoolMember
SET status = 'ACTIVE', bannedUntilUtc = NULL
WHERE status = 'SUSPENDED' AND bannedUntilUtc < NOW();
```

---

## ADR-015: Resend as Email Provider

**Date:** 2026-01-02
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #email #infrastructure

### Context

Need email provider for:
- Forgot password (reset links)
- Notifications (result published, join approved)
- Future: weekly digests, reminders

Requirements:
- Reliable delivery
- Good free tier (cost-effective for MVP)
- Developer-friendly API
- Low maintenance

### Decision

**Use Resend** as email provider.

### Rationale

- ✅ **Generous free tier:** 3,000 emails/month (sufficient for MVP)
- ✅ **Simple API:** Send email in 3 lines of code
- ✅ **Developer experience:** React Email integration (future)
- ✅ **Reliability:** Built on AWS SES
- ✅ **Domain verification:** Easy setup
- ✅ **No credit card required:** True free tier

### Consequences

**Positive:**
- ✅ Cost-effective (free until 3k emails/month)
- ✅ Easy integration (REST API, Node SDK)
- ✅ Modern tooling (TypeScript support)

**Negative:**
- ⚠️ Vendor lock-in (Resend-specific features)
- ⚠️ Free tier limits (need to upgrade if > 3k/month)

**Risks:**
- ⚠️ Service availability (mitigate with fallback provider)

### Alternatives Considered

1. **SendGrid:** More complex, overkill for MVP
2. **AWS SES:** Requires AWS account setup, more config
3. **Mailgun:** Similar pricing, less modern
4. **Postmark:** Great but no free tier

### Implementation Notes

**Install:**
```bash
npm install resend
```

**Usage:**
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'noreply@quiniela.app',
  to: user.email,
  subject: 'Password Reset',
  html: '<p>Click <a href="...">here</a> to reset your password.</p>',
});
```

**Future (v1.1):**
- Use React Email for templates
- Email verification on registration
- Weekly digest emails

---

## ADR-016: React Without State Management Library

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #frontend #react

### Context

Frontend needs state management. Options:
1. No library (useState, props)
2. Redux (heavy, boilerplate)
3. Zustand (lightweight)
4. Jotai (atomic)
5. React Query (server state)

### Decision

**Use no state management library for MVP.** Rely on:
- `useState` for local component state
- LocalStorage + custom events for auth state
- Props for data passing

### Rationale

- ✅ **Simplicity:** No learning curve
- ✅ **Less boilerplate:** No actions/reducers/stores
- ✅ **Fewer dependencies:** Smaller bundle
- ✅ **Sufficient for MVP:** Limited global state needs

### Consequences

**Positive:**
- ✅ Fast development (no setup)
- ✅ Easy to understand (standard React)
- ✅ Smaller bundle (~150KB vs ~200KB with Redux)

**Negative:**
- ⚠️ Prop drilling (pass data through multiple levels)
- ⚠️ No central state (harder to debug)
- ⚠️ No time-travel debugging

**Risks:**
- ⚠️ Refactor needed if app grows (mitigate by adding library later)

### Alternatives Considered

1. **Redux:** Overkill for MVP (too much boilerplate)
2. **Zustand:** Lightweight, but unnecessary for current needs
3. **React Query:** Considered for v1.0 (caching layer)

### Implementation Notes

**Auth state:**
```typescript
// lib/auth.ts
const TOKEN_KEY = 'quiniela.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Custom event for auth changes
window.dispatchEvent(new CustomEvent('quiniela:auth'));
```

**App.tsx:**
```typescript
const [token, setToken] = useState(getToken());

useEffect(() => {
  const handler = () => setToken(getToken());
  window.addEventListener('quiniela:auth', handler);
  return () => window.removeEventListener('quiniela:auth', handler);
}, []);
```

**Future (v1.0):**
- Add React Query for server state caching
- Add Zustand if global state needs grow

---

## ADR-017: Light Theme Only for MVP

**Date:** 2024-12-28
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #ui #design

### Context

Should we support dark mode in MVP? Considerations:
- Implementation time (2x CSS)
- User preference (dark mode popular)
- Design consistency

### Decision

**Ship with light theme only for MVP.** Add dark mode in v1.1.

### Rationale

- ✅ **Focus on features:** MVP time better spent on core functionality
- ✅ **Design consistency:** Easier to polish one theme
- ✅ **Smaller bundle:** No theme switching logic

### Consequences

**Positive:**
- ✅ Faster MVP delivery
- ✅ Simpler CSS (one color palette)
- ✅ Less testing (no theme bugs)

**Negative:**
- ⚠️ Dark mode users annoyed (significant user base)
- ⚠️ Accessibility concerns (bright screen at night)

**Risks:**
- ⚠️ Negative feedback from dark mode fans

### Alternatives Considered

1. **Dark mode MVP:** Rejected due to time constraints
2. **System preference only:** Considered, but adds complexity without choice

### Implementation Notes

**CSS (index.css):**
```css
:root {
  color-scheme: light; /* Force light mode */
  --bg: #f4f5f7;
  --text: #111827;
}
```

**Future (v1.1):**
- Add theme toggle (localStorage persistence)
- Duplicate CSS variables for dark theme
- Respect `prefers-color-scheme` as default

---

## Future Decisions (To Be Documented)

**v0.2-beta:**
- [ ] ADR-018: Username uniqueness enforcement strategy
- [ ] ADR-019: Join approval notification system
- [ ] ADR-020: Pool state transition automation (manual vs auto)

**v1.0:**
- [ ] ADR-021: Forgot password flow (email link vs code)
- [ ] ADR-022: Google OAuth integration
- [ ] ADR-023: Rate limiting strategy
- [ ] ADR-024: Redis caching layer

**v2.0:**
- [ ] ADR-025: External API for results ingestion
- [ ] ADR-026: Multi-sport support architecture
- [ ] ADR-027: WebSocket for real-time updates

---

**END OF DOCUMENT**
