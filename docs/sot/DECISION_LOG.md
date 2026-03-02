# Architectural Decision Log (ADL)
# Quiniela Platform

> **Purpose:** Record all significant architectural, technical, and product decisions with context and rationale.
>
> **Format:** Each decision includes: Context, Decision, Rationale, Consequences, Alternatives Considered, Status
>
> **Last Updated:** 2026-03-01

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
| [018](#adr-018-read-vs-edit-mode-for-picks-and-results) | Read vs Edit Mode for Picks/Results | Accepted | 2026-01-03 |
| [019](#adr-019-penalty-shootouts-in-knockout-phases) | Penalty Shootouts in Knockout Phases | Accepted | 2026-01-04 |
| [020](#adr-020-auto-advance-for-tournament-phases) | Auto-Advance for Tournament Phases | Accepted | 2026-01-04 |
| [021](#adr-021-phase-locking-mechanism) | Phase Locking Mechanism | Accepted | 2026-01-04 |
| [022](#adr-022-placeholder-system-for-knockout-matches) | Placeholder System for Knockout Matches | Accepted | 2026-01-04 |
| [023](#adr-023-tournament-advancement-service-architecture) | Tournament Advancement Service Architecture | Accepted | 2026-01-04 |
| [024](#adr-024-username-system-separate-from-email) | Username System (Separate from Email) | Accepted | 2026-01-04 |
| [025](#adr-025-password-reset-flow-with-email-tokens) | Password Reset Flow with Email Tokens | Accepted | 2026-01-04 |
| [026](#adr-026-google-oauth-integration) | Google OAuth Integration | Accepted | 2026-01-04 |
| [027](#adr-027-cumulative-scoring-system) | Cumulative Scoring System | Accepted | 2026-01-18 |
| [028](#adr-028-rate-limiting-strategy) | Rate Limiting Strategy | Accepted | 2026-01-18 |
| [029](#adr-029-internal-notification-system-badges) | Internal Notification System (Badges) | Accepted | 2026-01-18 |
| [030](#adr-030-slide-in-auth-panel) | Slide-in Auth Panel | Accepted | 2026-02-01 |
| [031](#adr-031-automatic-results-via-api-football) | Automatic Results via API-Football | Accepted | 2026-02-04 |

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

## ADR-018: Read/Edit Mode UI Pattern for Picks & Results

**Date:** 2026-01-03
**Status:** Accepted
**Deciders:** User + Claude Code
**Tags:** #ux #frontend #pattern

### Context

Initial implementation showed picks and results always in edit mode (inputs always visible), making the UI cluttered and confusing after saving. Users couldn't easily see their saved picks or published results in a clean, readable format.

**User feedback:**
> "Tanto en la selección de pick como en la publicación del resultado, una vez guardo o publico, deberían desaparecer las cajas de modificaciones, y el marcador mostrarse de forma bonita."

### Decision

Implement a **Read/Edit Mode Pattern** for both Picks and Results with the following behavior:

**Picks (Players):**
1. **Default Mode (Saved Pick):** Display pick visually (🏠 3 - 1 🚪)
2. **Edit Mode:** Show inputs + "Guardar" + "Cancelar"
3. **Edit Button:** "✏️ Modificar elección" only visible if `!isLocked`
4. **Locked State:** "🔒 No hiciste pick (deadline pasado)" if no pick saved
5. **Transitions:** Clicking "Modificar" → Edit mode, "Guardar" → Read mode, "Cancelar" → Read mode

**Results (Host):**
1. **Default Mode (Published):** Display result visually (⚽ 2 - 1 ⚽ Resultado oficial)
2. **Edit Mode:** Show inputs + reason field (if correction) + "Publicar" + "Cancelar"
3. **Edit Button:** "✏️ Corregir resultado" only visible to HOST
4. **Correction Badge:** Yellow alert if `result.reason` exists (errata)
5. **States:** "Sin resultado (publicar cuando termine)" (host) vs "Pendiente de resultado oficial" (player)

### Rationale

**User Experience:**
- Clear visual distinction between "viewing" and "editing" states
- Reduces cognitive load - users see clean data by default
- Edit mode is intentional (requires button click)
- Matches familiar patterns (Gmail, Notion, Linear)

**Technical Benefits:**
- State management is simple (local `editMode` boolean)
- No accidental edits from UI interactions
- "Cancelar" button allows escape hatch without saving
- Icons (✏️, 🔒, ⚽, 🏠, 🚪) provide visual cues

### Consequences

**Positive:**
- ✅ Much cleaner UI after saving picks/results
- ✅ Clear affordance for "when can I edit" (button visibility)
- ✅ Visual display shows picks/results at larger font size (28px vs 16px input)
- ✅ Users can easily scan multiple matches to see their picks
- ✅ Host can see published results without clutter
- ✅ Correction reason is mandatory and visible in yellow badge

**Negative:**
- ⚠️ One extra click to edit (but this is intentional friction)
- ⚠️ Slightly more complex component logic (read vs edit state)

### Alternatives Considered

1. **Always Edit Mode:** Rejected - too cluttered, confusing after save
2. **Inline Edit (double-click):** Rejected - not discoverable enough for MVP
3. **Modal for Edit:** Rejected - too heavy for small edits
4. **Separate Pages:** Rejected - breaks flow, requires navigation

### Implementation

**Components Created:**
- `PickSection` - Container with mode toggle logic
- `PickDisplay` - Visual read-only display (🏠 2 - 1 🚪)
- `PickEditor` - Input fields for editing
- `ResultSection` - Container with mode toggle logic
- `ResultDisplay` - Visual read-only display (⚽ 2 - 1 ⚽) + correction badge
- `ResultEditor` - Input fields + reason field

**File Modified:**
- `frontend/src/pages/PoolPage.tsx` (~807 lines)

**Key UX Patterns:**
```tsx
// Pick Section Logic
{!editMode && hasPick && (
  <>
    <PickDisplay pick={pick} />
    {!isLocked && <button onClick={() => setEditMode(true)}>✏️ Modificar</button>}
  </>
)}

{(editMode || !hasPick) && !isLocked && (
  <PickEditor onSave={() => setEditMode(false)} onCancel={() => setEditMode(false)} />
)}
```

### Related Decisions

- ADR-016: React Without State Management (local state sufficient for edit mode)
- ADR-017: Light Theme Only (visual design focused on clarity)

---

## ADR-019: Penalty Shootouts in Knockout Phases

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #business-rules #database #api

### Context

FIFA World Cup 2026 includes knockout phases (Round of 32, Round of 16, QF, SF, Final) where matches cannot end in a draw. When teams are tied after regular time, a penalty shootout determines the winner.

The system needs to:
1. Store penalty shootout scores separately from regular time
2. Determine match winners for tournament advancement
3. Support manual result entry by Hosts (penalties optional for group stage, required for knockout draws)

### Decision

Add optional `homePenalties` and `awayPenalties` fields to `PoolMatchResultVersion` table.

**Database Migration:**
```sql
ALTER TABLE "PoolMatchResultVersion"
  ADD COLUMN "homePenalties" INTEGER,
  ADD COLUMN "awayPenalties" INTEGER;
```

**API Contract (PUT /pools/:poolId/results/:matchId):**
```json
{
  "homeGoals": 2,
  "awayGoals": 2,
  "homePenalties": 4,  // Optional
  "awayPenalties": 3,  // Optional
  "reason": "..."      // Required if version > 1
}
```

**Business Rules:**
- Penalties are nullable (not required for group stage matches)
- For knockout phases with draws, penalties must be provided
- Winner determination logic:
  1. If `homeGoals > awayGoals` → Home wins
  2. Else if `awayGoals > homeGoals` → Away wins
  3. Else if draw in regular time:
     - If penalties exist: higher penalty score wins
     - Else: error (knockout requires tiebreaker)

### Rationale

**Why Optional Fields?**
- Group stage matches can end in draws (penalties not needed)
- Knockout matches require penalties only when tied
- Nullable fields are simpler than separate tables

**Why Store Separately?**
- Penalties are conceptually different from regular time goals
- Some scoring systems may weight penalties differently
- Historical data should distinguish regular time vs penalties

**Why Not Separate Table?**
- MVP complexity - single table is simpler
- Penalties always belong to a specific result version
- Query performance - no JOIN needed

### Consequences

**Positive:**
- ✅ Simple schema (2 new columns)
- ✅ Backward compatible (nullable)
- ✅ Auto-advance can determine knockout winners correctly
- ✅ Frontend can display penalties separately ("2-2 (4-3 on pens)")

**Negative:**
- ⚠️ Validation logic must check knockout phase + draw → require penalties
- ⚠️ Frontend must handle nullable values

**Risks:**
- ⚠️ Host might forget to enter penalties for knockout draw (mitigated by backend validation)

### Alternatives Considered

1. **Separate `PenaltyShootout` table:** Rejected - over-engineering for MVP
2. **Store in JSON field:** Rejected - loses type safety and query ability
3. **Combine into single "goals" field (e.g., "2+4"):** Rejected - parsing complexity

### Implementation

**Files Modified:**
- `backend/prisma/schema.prisma` - Added fields
- `backend/src/routes/results.ts` - Accept penalties in request body
- `backend/src/services/instanceAdvancement.ts` - Use penalties for winner determination
- `frontend/src/pages/PoolPage.tsx` - Penalty input UI for draws

**Migration:**
- `20260104161019_add_penalties_and_locked_phases`

### Related Decisions

- ADR-020: Auto-Advance (uses penalties for winner determination)
- ADR-007: Result Versioning (penalties included in versions)

---

## ADR-020: Auto-Advance for Tournament Phases

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #feature #business-rules #automation

### Context

FIFA World Cup 2026 has 6 phases: Group Stage → R32 → R16 → QF → SF → Final.

After each phase completes (all matches have results), the system must:
1. Determine qualified teams (group stage: winners, runners-up, best 3rd place)
2. Resolve placeholder matches in next phase (e.g., "Winner Group A" → actual team)
3. Optionally trigger this automatically when last result is published

**Manual vs Automatic:**
- **Manual:** Host clicks "Avanzar Fase" button (full control)
- **Automatic:** System advances immediately after last result published (convenience)

### Decision

Implement **opt-in auto-advance** with manual override capability.

**Database Schema:**
```sql
ALTER TABLE "Pool" ADD COLUMN "autoAdvanceEnabled" BOOLEAN NOT NULL DEFAULT true;
```

**Behavior:**
- When last match of a phase gets a result published:
  1. Check if `pool.autoAdvanceEnabled == true`
  2. Check if phase is NOT in `pool.lockedPhases` (ADR-021)
  3. If both true → automatically resolve next phase placeholders
  4. Log audit event with `triggeredBy: "RESULT_PUBLISH"`

- Host can always manually advance via `POST /pools/:poolId/advance-phase`

**API Endpoints:**
- `PATCH /pools/:poolId/settings` - Toggle autoAdvanceEnabled
- `POST /pools/:poolId/advance-phase` - Manual advance (always works)

### Rationale

**Why Opt-In Instead of Forced?**
- Some Hosts want full control (e.g., verify all results before advancing)
- Erratas might require rolling back advancement
- Phase locking (ADR-021) allows blocking auto-advance for corrections

**Why Default to TRUE?**
- Most users expect automatic progression (convenience)
- Can be disabled if needed
- Reduces Host workload for large tournaments

**Why NOT Always Automatic?**
- Hosts need ability to review/correct before advancing
- Complex tiebreakers might need manual resolution
- Erratas published after advancement would break bracket

### Consequences

**Positive:**
- ✅ Convenience - tournament progresses automatically for 95% of cases
- ✅ Host can disable if they want full control
- ✅ Manual advance always available as fallback
- ✅ Audit log tracks whether advancement was auto or manual

**Negative:**
- ⚠️ Auto-advance might surprise users if they don't know it's enabled
- ⚠️ Erratas after auto-advance require phase locking + manual fix

**Risks:**
- ⚠️ Bug in advancement logic could corrupt bracket (mitigated by extensive testing)
- ⚠️ Performance spike if many pools advance simultaneously (acceptable for MVP scale)

### Alternatives Considered

1. **Always Manual:** Rejected - too much Host work for large tournaments
2. **Always Automatic:** Rejected - no escape hatch for corrections
3. **Delayed Auto-Advance (e.g., 5 min):** Rejected - adds complexity, doesn't solve errata problem

### Implementation

**Services Created:**
- `backend/src/services/tournamentAdvancement.ts` - Pure algorithms (group standings, rankings, placeholders)
- `backend/src/services/instanceAdvancement.ts` - DB integration (validation, advancement execution)

**Logic Flow:**
1. Host publishes result via `PUT /pools/:poolId/results/:matchId`
2. After saving result, backend checks if phase is complete
3. If complete + autoAdvanceEnabled + not locked → call `advanceToRoundOf32()` or `advanceKnockoutPhase()`
4. Update instance dataJson with resolved team IDs
5. Log audit event

**Files Modified:**
- `backend/src/routes/results.ts` - Auto-advance after result publish
- `backend/src/routes/pools.ts` - Manual advance endpoint + settings toggle
- `frontend/src/pages/PoolPage.tsx` - Toggle UI in admin panel

### Related Decisions

- ADR-021: Phase Locking (blocks auto-advance)
- ADR-019: Penalties (required for knockout winner determination)
- ADR-022: Placeholder System (what gets resolved)
- ADR-023: Service Architecture (separation of concerns)

---

## ADR-021: Phase Locking Mechanism

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #feature #business-rules #host-tools

### Context

Auto-advance (ADR-020) can cause problems when:
1. Host discovers an error in published results AFTER phase advanced
2. Correcting the result would invalidate the entire next phase bracket
3. Host needs time to review/verify results before allowing advancement

**Example Scenario:**
- Round of 32 completes, auto-advances to R16
- Host discovers wrong score in R32 Match #5
- Correcting it would change which team advanced → R16 bracket is now invalid

### Decision

Add per-phase locking mechanism that blocks auto-advance.

**Database Schema:**
```sql
ALTER TABLE "Pool" ADD COLUMN "lockedPhases" JSONB NOT NULL DEFAULT '[]';
```

**Data Format:**
```json
{
  "lockedPhases": ["group_stage", "round_of_32"]
}
```

**Behavior:**
- If a phase is in `lockedPhases`, auto-advance is blocked (even if `autoAdvanceEnabled = true`)
- Manual advance via `POST /pools/:poolId/advance-phase` is also blocked
- Host must first unlock the phase to allow advancement
- Allows Host to publish corrections (erratas) without triggering advancement

**API Endpoint:**
```
POST /pools/:poolId/lock-phase
{
  "phaseId": "round_of_32",
  "locked": true  // or false to unlock
}
```

**UI:**
- Admin panel shows phase status: INCOMPLETE | COMPLETE | LOCKED
- Lock/Unlock button appears when phase is complete
- Visual indicator (🔒) shows locked phases

### Rationale

**Why JSON Array Instead of Boolean Per Phase?**
- Flexible - supports any phase ID without schema changes
- Simple - empty array = no locks
- Extensible - could add lock metadata (reason, lockedBy, lockedAt) later

**Why Not Just Disable Auto-Advance?**
- Locking is phase-specific (might want to lock R32 but advance R16)
- Provides clearer intent ("I'm fixing this phase, don't touch it")
- Can lock even with auto-advance disabled (prevents accidental manual advance)

**Why Allow Manual Advance Block?**
- Consistency - locked means locked (auto OR manual)
- Safety - prevents Host from accidentally advancing while fixing errors
- If Host wants to advance, they unlock first (explicit action)

### Consequences

**Positive:**
- ✅ Host can safely publish corrections without breaking brackets
- ✅ Fine-grained control (per-phase, not all-or-nothing)
- ✅ Clear UI affordance (lock button) prevents confusion
- ✅ Audit log tracks lock/unlock actions

**Negative:**
- ⚠️ One more concept for Hosts to learn
- ⚠️ Locked phases stay locked until manually unlocked (could be forgotten)

**Risks:**
- ⚠️ Host forgets to unlock → tournament stuck (mitigated by clear UI)

### Alternatives Considered

1. **Boolean `locked` field:** Rejected - not granular enough (all-or-nothing)
2. **Separate `PhaseOverride` table:** Rejected - over-engineering for MVP
3. **Time-based lock (e.g., 24h cooldown):** Rejected - too opinionated, removes control
4. **Auto-unlock after corrections:** Rejected - dangerous (could auto-advance mid-fix)

### Implementation

**Files Modified:**
- `backend/prisma/schema.prisma` - Added `lockedPhases` JSONB column
- `backend/src/routes/pools.ts` - Lock/unlock endpoint
- `backend/src/services/instanceAdvancement.ts` - Check locks before advancing
- `frontend/src/pages/PoolPage.tsx` - Lock/unlock buttons in admin panel

**UI Components:**
```tsx
{phaseStatus === "COMPLETE" && (
  <button onClick={isLocked ? unlockPhase : lockPhase}>
    {isLocked ? "🔓 Desbloquear" : "🔒 Bloquear"}
  </button>
)}
```

### Related Decisions

- ADR-020: Auto-Advance (what this blocks)
- ADR-007: Result Versioning (used for corrections)

---

## ADR-022: Placeholder System for Knockout Matches

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #architecture #tournament-structure

### Context

Tournament knockout brackets are defined BEFORE teams are known.

**Example:**
- Round of 32 Match #1: "Winner Group A" vs "3rd Place Pool 1"
- We don't know which teams until group stage completes

**Requirements:**
1. Define full tournament structure upfront (104 matches for WC2026)
2. Matches reference teams that don't exist yet
3. After each phase, "resolve" placeholders to actual team IDs
4. Display placeholders in UI ("Ganador Grupo A" before resolution, "Mexico" after)

### Decision

Use **string-based placeholder IDs** in match `homeTeamId` and `awayTeamId` fields.

**Placeholder Formats:**

**Group Stage → R32:**
- Winners: `W_A`, `W_B`, ..., `W_L` (12 teams)
- Runners-up: `RU_A`, `RU_B`, ..., `RU_L` (12 teams)
- Best 3rd place: `3rd_POOL_1`, `3rd_POOL_2`, ..., `3rd_POOL_8` (8 teams)

**Knockout Progression:**
- Match winners: `W_R32_1`, `W_R32_2`, ..., `W_R32_16`
- Match losers (for 3rd place): `L_SF_1`, `L_SF_2`

**Example Match Definition:**
```json
{
  "id": "m_R32_1",
  "phaseId": "round_of_32",
  "homeTeamId": "W_A",        // Placeholder
  "awayTeamId": "3rd_POOL_1", // Placeholder
  "kickoffUtc": "2026-06-20T18:00:00Z"
}
```

**After Group Stage Completes:**
```json
{
  "id": "m_R32_1",
  "homeTeamId": "t_MEX",  // Resolved to Mexico
  "awayTeamId": "t_URU",  // Resolved to Uruguay
  ...
}
```

**Resolution Logic:**
- Stored in `backend/src/services/tournamentAdvancement.ts`
- `resolvePlaceholders()` function maps placeholders to actual team IDs
- Updates `TournamentInstance.dataJson` in place

### Rationale

**Why String IDs Instead of Separate Table?**
- Simpler - no JOINs needed
- Matches are stored in JSON anyway (not relational)
- Easy to check if resolved: `teamId.startsWith("W_")` → placeholder

**Why Not NULL Until Resolved?**
- NULL doesn't convey semantic meaning (which winner?)
- Placeholders allow UI to show "Ganador Grupo A" before resolution
- Easier to validate tournament structure (all matches defined upfront)

**Why In-Place Update Instead of Immutable?**
- Instance `dataJson` is already a snapshot (version controlled via Instance creation)
- Simpler than managing multiple versions of match definitions
- Pools reference instance, so all pools see updated brackets

### Consequences

**Positive:**
- ✅ Full tournament defined upfront (good for testing/validation)
- ✅ UI can show placeholders before resolution ("TBD" with context)
- ✅ Simple resolution logic (string replacement)
- ✅ No schema changes needed (uses existing `dataJson`)

**Negative:**
- ⚠️ Placeholder format is hard-coded (changing it requires migration)
- ⚠️ Type safety lost (string could be placeholder OR team ID)

**Risks:**
- ⚠️ Typo in placeholder ID would break resolution (mitigated by tests)
- ⚠️ Multiple pools on same instance share resolved state (by design, but could confuse)

### Alternatives Considered

1. **Create matches dynamically:** Rejected - harder to test, no upfront validation
2. **Separate `PlaceholderMatch` and `ResolvedMatch` tables:** Rejected - over-engineering
3. **Store resolution mapping separately:** Rejected - harder to query current state
4. **Use numeric IDs (e.g., -1 for winner A):** Rejected - less readable, harder to debug

### Implementation

**Services:**
- `tournamentAdvancement.ts`:
  - `resolvePlaceholders()` - Group stage → R32
  - `resolveKnockoutPlaceholders()` - Knockout progression

**Logic Example:**
```typescript
function resolvePlaceholders(matches, winners, runnersUp, bestThirds) {
  return matches.map(match => ({
    ...match,
    homeTeamId: resolveTeamId(match.homeTeamId, winners, runnersUp, bestThirds),
    awayTeamId: resolveTeamId(match.awayTeamId, winners, runnersUp, bestThirds),
  }));
}

function resolveTeamId(placeholder, winners, runnersUp, bestThirds) {
  if (placeholder.startsWith("W_")) return winners.get(placeholder.slice(2));
  if (placeholder.startsWith("RU_")) return runnersUp.get(placeholder.slice(3));
  if (placeholder.startsWith("3rd_POOL_")) return bestThirds[parseInt(placeholder.slice(9)) - 1];
  return placeholder; // Already resolved
}
```

**Frontend:**
```tsx
function getTeamDisplay(teamId: string) {
  if (teamId.startsWith("W_")) return `Ganador Grupo ${teamId.slice(2)}`;
  if (teamId.startsWith("RU_")) return `2° Grupo ${teamId.slice(3)}`;
  if (teamId.startsWith("3rd_POOL_")) return `${teamId.slice(9)}° Mejor 3ro`;
  return getTeamName(teamId); // Actual team
}
```

### Related Decisions

- ADR-020: Auto-Advance (triggers resolution)
- ADR-023: Service Architecture (where resolution logic lives)
- ADR-006: Template/Version/Instance (where matches are stored)

---

## ADR-023: Tournament Advancement Service Architecture

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Engineering Team
**Tags:** #architecture #separation-of-concerns #testing

### Context

Tournament advancement logic is complex:
1. Calculate group standings (points, goal difference, fair play)
2. Rank third-place teams across all groups
3. Determine qualifiers (winners, runners-up, best 3rds)
4. Resolve placeholder matches
5. Validate all results exist before advancing
6. Handle errors (ties, incomplete results)
7. Integrate with database (read results, update instance)

**Concerns:**
- Business logic mixed with DB queries is hard to test
- Route handlers become bloated with algorithm code
- FIFA ranking rules are complex and need unit testing

### Decision

Split advancement logic into **two services** with clear separation:

**1. `tournamentAdvancement.ts` - Pure Algorithms (no DB)**
- Exported pure functions (no side effects)
- Inputs: simple data structures (arrays, objects)
- Outputs: calculated results (standings, qualifiers, resolved matches)
- Fully testable without database

**Functions:**
- `calculateGroupStandings(teamIds, results)` → `TeamStanding[]`
- `rankThirdPlaceTeams(allStandings)` → `ThirdPlaceRanking[]`
- `determineQualifiers(standings, bestThirds)` → `QualifiedTeams`
- `resolvePlaceholders(matches, winners, runnersUp, bestThirds)` → `ResolvedMatches[]`
- `resolveKnockoutPlaceholders(matches, currentPhase, results)` → `ResolvedMatches[]`

**2. `instanceAdvancement.ts` - DB Integration**
- Fetches data from Prisma
- Calls pure functions from `tournamentAdvancement.ts`
- Saves results back to database
- Handles errors and validation

**Functions:**
- `validateGroupStageComplete(instanceId, poolId)` → validation result
- `advanceToRoundOf32(instanceId, poolId)` → advancement result
- `advanceKnockoutPhase(instanceId, currentPhase, nextPhase, poolId)` → advancement result
- `validateCanAutoAdvance(instanceId, phaseId, poolId)` → can advance?

### Rationale

**Why Separate Pure vs Impure?**
- **Testability:** Pure functions easy to unit test (no mocks needed)
- **Reusability:** Same algorithms work for previews, simulations, testing
- **Clarity:** Business logic isolated from DB queries
- **Performance:** Pure functions can be memoized/cached

**Why Not Single Service?**
- Mixed concerns are harder to test (need DB mocks for every test)
- Algorithm changes shouldn't require DB changes
- Pure functions are more maintainable

**Why Not Models/Repositories Pattern?**
- Overkill for MVP (Prisma already provides good abstraction)
- Two services sufficient for current complexity
- Can refactor later if needed

### Consequences

**Positive:**
- ✅ Pure functions easily unit tested (no DB setup)
- ✅ Business logic (FIFA rules) isolated and clear
- ✅ Can preview/simulate advancement without DB writes
- ✅ Route handlers stay thin (delegate to services)
- ✅ Easier to debug (inspect intermediate data structures)

**Negative:**
- ⚠️ Two files instead of one (more to navigate)
- ⚠️ Data mapping between DB models and algorithm inputs

**Risks:**
- ⚠️ Temptation to add DB queries to pure service (mitigated by code review)

### Alternatives Considered

1. **All Logic in Route Handlers:** Rejected - untestable, bloated files
2. **Single Unified Service:** Rejected - mixing concerns, hard to test
3. **Hexagonal Architecture (Ports/Adapters):** Rejected - over-engineering for MVP
4. **Domain-Driven Design:** Rejected - too much ceremony for current scale

### Implementation

**File Structure:**
```
backend/src/services/
  ├── tournamentAdvancement.ts  (pure algorithms)
  ├── instanceAdvancement.ts    (DB integration)
```

**Example Usage in Route:**
```typescript
// routes/results.ts
import { validateCanAutoAdvance, advanceToRoundOf32 } from "../services/instanceAdvancement";

// After publishing result
const validation = await validateCanAutoAdvance(instanceId, phaseId, poolId);
if (validation.canAdvance) {
  await advanceToRoundOf32(instanceId, poolId);
}
```

**Example Test (Pure Function):**
```typescript
// tournamentAdvancement.test.ts
import { calculateGroupStandings } from "./tournamentAdvancement";

test("calculates standings with correct tiebreakers", () => {
  const results = [
    { homeTeamId: "t_A1", awayTeamId: "t_A2", homeGoals: 2, awayGoals: 1 },
    // ...
  ];

  const standings = calculateGroupStandings("A", ["t_A1", "t_A2", "t_A3", "t_A4"], results);

  expect(standings[0].teamId).toBe("t_A1");
  expect(standings[0].points).toBe(3);
});
```

### Related Decisions

- ADR-020: Auto-Advance (uses these services)
- ADR-022: Placeholder System (resolved by `tournamentAdvancement.ts`)
- ADR-019: Penalties (used in winner determination)

---

## ADR-024: Username System (Separate from Email)

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team, Engineering Team
**Tags:** #authentication #user-experience #data-model

### Context

In the initial MVP, users were identified only by email address. However, for social features (co-admin nominations, player references, leaderboards), using email addresses has several issues:

1. **Privacy:** Email addresses are personal information that shouldn't be shared publicly
2. **UX:** Emails are long and less memorable than usernames (e.g., "juan.k.chacon9729@gmail.com" vs "@juank")
3. **Future Features:** Mentioning users (@username), searching players, and social interactions require human-friendly identifiers
4. **Display vs Identity:** Users want different public display names without changing their unique identifier

**Requirements:**
- Unique identifier for each user (separate from email)
- Human-readable and memorable
- Immutable once created (username changes not allowed in MVP)
- Validation to prevent offensive/confusing usernames

### Decision

Implement a **separate username field** alongside email with the following design:

**Data Model:**
```prisma
model User {
  email       String  @unique  // Authentication only (private)
  username    String  @unique  // Unique identifier (public)
  displayName String           // Changeable display name (public)
  // ...
}
```

**Username Rules:**
- **Length:** 3-20 characters
- **Allowed Characters:** Alphanumeric + hyphens (`-`) + underscores (`_`)
- **Normalization:** Stored as lowercase, trimmed
- **Reserved Words:** Block system/offensive names (`admin`, `system`, `null`, etc.)
- **Cannot Start/End With:** Special characters (must start/end with alphanumeric)
- **Immutable:** Cannot be changed after registration (may allow in future versions)

**Login Method:**
- Login uses **email only** (not username) for simplicity and security
- Username is for identification/mention, not authentication

**Migration Strategy:**
- Existing users: Auto-generate username from email local part (e.g., `juan.k.chacon9729` from `juan.k.chacon9729@gmail.com`)
- Two-step migration: nullable field first, populate data, then make required

### Rationale

**Why Username AND DisplayName?**
- Username: Unique, immutable identifier (like Twitter handle `@juank`)
- DisplayName: Changeable, human-friendly name (like "Juan Chacón")
- Separation allows future features like display name changes without breaking references

**Why Alphanumeric + Hyphens/Underscores Only?**
- Prevents URL encoding issues
- Safe for mentions (`@username`)
- Easy to type and remember
- Industry standard (GitHub, Twitter, Discord)

**Why Login with Email (Not Username)?**
- Email is already unique and verified
- Users less likely to forget email vs username
- Simpler UX: one field for login
- Username reserved for social features

**Why Immutable Usernames?**
- Prevents confusion (usernames don't change)
- Simplifies database references (no need to update mentions/history)
- Can add username changes later if needed (with alias system)

### Consequences

**Positive:**
- ✅ Privacy: Emails not exposed in UI/leaderboards
- ✅ UX: Short, memorable identifiers (@juank vs juan.k.chacon9729@gmail.com)
- ✅ Social Features Ready: Mentions, player search, co-admin nominations
- ✅ Flexible Display: Users can change displayName without breaking identity
- ✅ Future-Proof: Foundation for @mentions, profiles, sharing

**Negative:**
- ⚠️ Username Availability: Popular usernames may be taken
- ⚠️ Username Squatting: Users may register desirable usernames and not use them
- ⚠️ No Changes: Users cannot change username (may cause support requests)

**Risks:**
- ⚠️ Migration Complexity: Existing users need auto-generated usernames (may not like them)
- ⚠️ Validation Bypass: Client-side validation must match server-side

### Alternatives Considered

1. **Email Only (No Username):**
   - ❌ Rejected: Privacy concerns, poor UX for mentions/leaderboards

2. **Username for Login:**
   - ❌ Rejected: Users forget usernames more easily than emails
   - ❌ Adds complexity (two ways to log in)

3. **UUID-Based Identifiers:**
   - ❌ Rejected: Not human-readable, defeats purpose of friendly identifiers

4. **Mutable Usernames:**
   - ❌ Rejected: Breaks references, confusing for other users
   - ⏳ May revisit with alias system in v2.0

### Implementation

**Database Migration:**
```sql
-- Step 1: Add nullable username field
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Step 2: Populate usernames (via migration script)
-- Run: npm run migrate:add-usernames

-- Step 3: Make username required
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
```

**Validation (Backend):**
```typescript
// lib/username.ts
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "Username must be 3-20 characters" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, hyphens, and underscores" };
  }
  if (/^[-_]|[-_]$/.test(username)) {
    return { valid: false, error: "Username cannot start or end with special characters" };
  }
  const reserved = ["admin", "system", "null", "undefined", "root", "api", "test"];
  if (reserved.includes(username.toLowerCase())) {
    return { valid: false, error: "This username is reserved" };
  }
  return { valid: true };
}

export function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}
```

**Registration Form (Frontend):**
```tsx
<input
  type="text"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  placeholder="tu_usuario"
  minLength={3}
  maxLength={20}
  pattern="[a-zA-Z0-9_-]+"
  required
/>
```

**API Changes:**
```typescript
// POST /auth/register
{
  email: "juan@example.com",
  username: "juank",          // NEW: Required
  displayName: "Juan Chacón",
  password: "********"
}

// Response
{
  token: "...",
  user: {
    id: "...",
    email: "juan@example.com",
    username: "juank",          // NEW: Returned
    displayName: "Juan Chacón",
    platformRole: "PLAYER"
  }
}
```

### Related Decisions

- ADR-004: JWT for Authentication (login still uses email)
- ADR-012: Co-Admin Permissions (uses username for nominations in future)
- ADR-025: Password Reset Flow (uses email, not username)

---

## ADR-025: Password Reset Flow with Email Tokens

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team, Engineering Team
**Tags:** #authentication #security #email #user-experience

### Context

Users need a way to recover their accounts when they forget their password. This is a standard security feature required for production applications.

**Requirements:**
- Secure password reset mechanism
- Email delivery to verified addresses
- Time-limited reset links (prevent token reuse)
- User-friendly flow (minimal friction)
- No security information leakage (don't reveal if email exists)

**Constraints:**
- MVP budget: Free email provider required
- Development environment: Need to test emails without production domain

### Decision

Implement a **token-based password reset flow** with email delivery via **Resend** (free tier):

**Flow:**
1. User requests password reset with email address
2. System generates secure random token (32 bytes hex)
3. Token stored in database with 1-hour expiration
4. Email sent with reset link: `https://app.com/reset-password?token=XXX`
5. User clicks link, enters new password
6. System validates token (exists + not expired)
7. Password updated, token cleared from database
8. User can log in with new password

**Security Measures:**
- ✅ Crypto-secure random tokens (`crypto.randomBytes(32)`)
- ✅ 1-hour expiration (short window for attack)
- ✅ Single-use tokens (cleared after successful reset)
- ✅ Same response for existing/non-existing emails (no enumeration)
- ✅ Audit log events (reset requested, reset completed)
- ✅ Active users only (status check)

**Email Provider:**
- **Resend** (https://resend.com)
- Free tier: 100 emails/day, 3,000/month
- Modern API, excellent DX
- Sandbox mode for development (verified recipients only)
- Production-ready (domain verification required)

### Rationale

**Why Email Tokens (Not SMS/TOTP)?**
- Email is universal (all users have email)
- No additional cost (SMS is expensive)
- Better UX (click link vs copy code)
- Industry standard (Gmail, GitHub, etc.)

**Why 1-Hour Expiration?**
- Short enough to limit attack window
- Long enough for legitimate users to receive/use email
- Industry standard (most services use 30min-24hr)

**Why Resend?**
- Free tier sufficient for MVP
- Modern API (better than SendGrid/Mailgun)
- Easy integration (3 lines of code)
- Good deliverability
- Sandbox mode for development
- Can upgrade to production easily

**Why Same Response for All Emails (Existing or Not)?**
- **Security:** Prevents email enumeration attacks
- Attacker cannot determine if email exists in system
- Industry best practice (GitHub, Google, etc.)

**Why Not Email Confirmation on Registration?**
- ⏳ Deferred to v0.2-beta
- MVP focuses on core quiniela functionality
- Users can still reset password if they typo email
- Email confirmation field in registration form reduces typos

### Consequences

**Positive:**
- ✅ Standard password recovery flow (familiar to users)
- ✅ Secure token generation and expiration
- ✅ Free email delivery (100/day sufficient for MVP)
- ✅ Audit trail for security events
- ✅ No email enumeration vulnerability
- ✅ Professional HTML email template

**Negative:**
- ⚠️ Requires email provider account setup
- ⚠️ Free tier limitations (100 emails/day)
- ⚠️ Sandbox mode in dev (must verify recipient emails)
- ⚠️ No rate limiting (user can spam reset requests)

**Risks:**
- ⚠️ Email deliverability issues (spam filters)
- ⚠️ Token brute-force (mitigated by 1-hour expiration + 32-byte randomness)
- ⚠️ Denial of service (spam reset requests to victim email)
  - ⏳ Mitigated in v1.0 with rate limiting

### Alternatives Considered

1. **Security Questions:**
   - ❌ Rejected: Insecure, poor UX, easily guessable

2. **SMS Codes:**
   - ❌ Rejected: Expensive ($0.01-0.10 per SMS), requires phone number

3. **Email Codes (6-digit):**
   - ❌ Rejected: More friction (copy/paste), same email requirement
   - Links are more user-friendly

4. **SendGrid / Mailgun:**
   - ❌ Rejected: Resend has better free tier and DX

5. **AWS SES:**
   - ❌ Rejected: Requires AWS account, more complex setup, overkill for MVP

6. **NodeMailer + Gmail SMTP:**
   - ❌ Rejected: Gmail blocks apps with "less secure" access, unreliable

### Implementation

**Database Schema:**
```prisma
model User {
  // ...
  resetToken          String?   @unique
  resetTokenExpiresAt DateTime?
  @@index([resetToken])
}
```

**Backend (Request Reset):**
```typescript
// POST /auth/forgot-password
import crypto from "crypto";

const resetToken = crypto.randomBytes(32).toString("hex");
const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

await prisma.user.update({
  where: { id: user.id },
  data: { resetToken, resetTokenExpiresAt },
});

await sendPasswordResetEmail({
  to: user.email,
  username: user.username,
  resetToken,
});

// Always return success (security: don't reveal if email exists)
return res.json({ message: "Si el email existe, recibirás un enlace..." });
```

**Backend (Reset Password):**
```typescript
// POST /auth/reset-password
const user = await prisma.user.findFirst({
  where: {
    resetToken: token,
    resetTokenExpiresAt: { gte: new Date() }, // Not expired
    status: "ACTIVE",
  },
});

if (!user) {
  return res.status(400).json({ error: "Token inválido o expirado" });
}

const passwordHash = await hashPassword(newPassword);

await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordHash,
    resetToken: null,           // Clear token (single-use)
    resetTokenExpiresAt: null,
  },
});
```

**Email Template:**
- Professional HTML design with gradient header
- Clear CTA button with reset link
- Alternative plain-text link (for email clients that break buttons)
- Security warning (1-hour expiration highlighted)
- Footer with "ignore this email if you didn't request it"

**Frontend Routes:**
```typescript
// /forgot-password - Request reset form
<ForgotPasswordPage />

// /reset-password?token=XXX - New password form
<ResetPasswordPage />
```

**Resend Setup (Development):**
1. Sign up at resend.com (free tier)
2. Generate API key
3. Add to `.env`: `RESEND_API_KEY=re_xxx`
4. Add verified recipients (Settings → Verified Recipients)
5. Verify email via confirmation link
6. Test forgot password flow

**Resend Setup (Production):**
1. Verify custom domain (add DNS records)
2. Update `RESEND_FROM_EMAIL=noreply@yourdomain.com`
3. Remove sandbox mode restrictions
4. Monitor delivery metrics in dashboard

### Related Decisions

- ADR-004: JWT for Authentication (login after reset uses JWT)
- ADR-024: Username System (reset flow uses email, not username)
- ADR-015: Resend as Email Provider (also used for future email confirmations)

---

## ADR-026: Google OAuth Integration

**Date:** 2026-01-04
**Status:** Accepted
**Deciders:** Product Team, Engineering Team
**Tags:** #authentication #oauth #user-experience #google

### Context

The initial MVP only supported email/password authentication. While functional, this has several UX friction points:

1. **Registration Friction:** Users must create yet another account with username + password
2. **Password Management:** Users must remember another password or use password managers
3. **Trust & Security:** Users may hesitate to create accounts on new platforms
4. **Mobile UX:** Typing passwords on mobile is cumbersome

**User Feedback:**
- "Can I just use my Google account?"
- "I don't want to create another password"

**Industry Standard:**
- 90%+ of modern web apps offer social login (Google, Facebook, Apple)
- Google OAuth is the most popular (highest conversion rates)

**Requirements:**
- Seamless login/registration with Google account
- No separate username/password needed for OAuth users
- Link existing email/password accounts with Google
- Secure token validation (don't trust frontend tokens blindly)

### Decision

Implement **Google OAuth 2.0** using:

**Backend:**
- `google-auth-library` (official Google library for Node.js)
- Verify ID tokens server-side (never trust client-only validation)
- Endpoint: `POST /auth/google` (receives ID token from frontend)

**Frontend:**
- Google Identity Services (GIS) - official JavaScript SDK
- One Tap / Sign In with Google button
- ID token sent to backend for verification

**Flow:**
1. User clicks "Sign in with Google" button
2. Google popup/redirect for authentication
3. Frontend receives ID token from Google
4. Frontend sends ID token to `POST /auth/google`
5. Backend verifies token with Google's API
6. Backend creates/updates user, returns JWT token
7. User logged in (same JWT flow as email/password)

**Data Model:**
```prisma
model User {
  // ...
  googleId String? @unique  // Google User ID (sub claim)
  // passwordHash can be empty for OAuth-only users
}
```

**Username Generation (OAuth Users):**
- Extract from email local part (e.g., `juan_chacon` from `juan.chacon@gmail.com`)
- Normalize: lowercase, replace non-alphanumeric with underscores
- Ensure uniqueness: append number if needed (`juan_chacon1`, `juan_chacon2`)
- Future: Allow users to change username in settings

**Account Linking:**
- If user exists with same email (email/password account) → link Google ID to existing account
- Future logins can use either method (email/password OR Google)

### Rationale

**Why Google OAuth (Not Others)?**
- **Ubiquity:** 3 billion+ Google accounts globally
- **High Trust:** Users already trust Google with their data
- **Best Conversion:** Industry data shows Google has highest OAuth conversion rates
- **Future-Proof:** Can add Facebook/Apple OAuth later (same architecture)

**Why google-auth-library (Not Passport.js)?**
- **Lighter:** No session management overhead (we use JWT)
- **Official:** Maintained by Google, always up-to-date
- **Simpler:** Direct token verification (no strategies/middleware complexity)
- **Control:** Full control over flow (better for learning/debugging)

**Why Server-Side Token Verification?**
- **Security:** Never trust tokens from frontend alone
- Frontend tokens can be spoofed/tampered
- Google's verification ensures token is legitimate and not expired
- Prevents impersonation attacks

**Why Auto-Generate Usernames (Not Ask User)?**
- **Lower Friction:** One-click login (no extra steps)
- **Better Conversion:** Fewer form fields = higher signup rates
- Username is for backend only (frontend shows displayName)
- Users can change username later if desired

### Consequences

**Positive:**
- ✅ **Reduced Friction:** One-click registration/login
- ✅ **Higher Conversion:** OAuth users sign up 3-5x more than email/password
- ✅ **Better Security:** No password to forget/leak/phish
- ✅ **Mobile-Friendly:** Google handles auth flow (optimized for mobile)
- ✅ **Account Linking:** Existing users can link Google account
- ✅ **Future-Proof:** Foundation for other OAuth providers
- ✅ **Professional UX:** Matches industry standard (GitHub, Notion, etc.)

**Negative:**
- ⚠️ **Dependency on Google:** If Google OAuth is down, users can't log in (mitigated: email/password still works)
- ⚠️ **Privacy Concerns:** Some users distrust Google (mitigated: offer email/password option)
- ⚠️ **Setup Complexity:** Requires Google Cloud Console configuration
- ⚠️ **Auto-Generated Usernames:** Users may not like generated username (mitigated: allow changes)

**Risks:**
- ⚠️ **Token Validation Downtime:** If Google's verification API is down, OAuth fails
  - Mitigated: Email/password login still available
- ⚠️ **OAuth Phishing:** Users could be phished via fake Google login
  - Mitigated: Use official Google GIS SDK (verified domains)
- ⚠️ **Account Takeover:** If Google account compromised, attacker gets access
  - Same risk as email/password (email compromise = password reset access)

### Alternatives Considered

1. **Passport.js with passport-google-oauth20:**
   - ❌ Rejected: Heavier, requires session management, overkill for JWT-based auth
   - ✅ Good for: Express apps with session-based auth

2. **NextAuth.js / Auth.js:**
   - ❌ Rejected: Designed for Next.js, awkward standalone usage
   - ✅ Good for: Next.js/React full-stack apps

3. **Manual OAuth 2.0 Flow (Without Library):**
   - ❌ Rejected: Reinventing the wheel, error-prone, hard to maintain
   - Security-critical code should use well-tested libraries

4. **Firebase Authentication:**
   - ❌ Rejected: Vendor lock-in, costs money at scale, less control
   - ✅ Good for: Quick prototypes, Firebase-centric apps

5. **OAuth Only (No Email/Password):**
   - ❌ Rejected: Some users prefer email/password (privacy, control)
   - Better to offer both options

### Implementation

**Backend Dependencies:**
```bash
npm install google-auth-library
```

**Environment Variables:**
```env
# backend/.env
GOOGLE_CLIENT_ID=123456789-abc...xyz.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=123456789-abc...xyz.apps.googleusercontent.com
```

**Backend Helper ([lib/googleAuth.ts](../../backend/src/lib/googleAuth.ts)):**
```typescript
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
}
```

**Backend Endpoint ([routes/auth.ts](../../backend/src/routes/auth.ts)):**
```typescript
// POST /auth/google
authRouter.post("/google", async (req, res) => {
  const { idToken } = req.body;

  const googleUser = await verifyGoogleToken(idToken);
  if (!googleUser) {
    return res.status(401).json({ error: "Invalid Google token" });
  }

  // Find existing user by email or googleId
  let user = await prisma.user.findFirst({
    where: { OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }] }
  });

  if (user) {
    // Link Google account if not already linked
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId },
      });
    }
  } else {
    // Create new user with auto-generated username
    const username = generateUsernameFromEmail(googleUser.email);
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        username,
        displayName: googleUser.name,
        passwordHash: "", // OAuth users don't need password
        googleId: googleUser.googleId,
      },
    });
  }

  const token = signToken({ userId: user.id, platformRole: user.platformRole });
  return res.json({ token, user });
});
```

**Frontend ([LoginPage.tsx](../../frontend/src/pages/LoginPage.tsx)):**
```tsx
// Load Google Identity Services SDK in index.html
<script src="https://accounts.google.com/gsi/client" async defer></script>

// Initialize Google Sign In
useEffect(() => {
  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleGoogleCallback,
  });

  window.google.accounts.id.renderButton(buttonRef.current, {
    theme: "outline",
    size: "large",
    text: "signin_with",
  });
}, []);

async function handleGoogleCallback(response: any) {
  const result = await loginWithGoogle(response.credential);
  setToken(result.token);
  onLoggedIn();
}
```

**Database Migration:**
```sql
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
```

**Audit Events:**
- `REGISTER_GOOGLE`: New user created via Google OAuth
- `LOGIN_GOOGLE`: Existing user logged in via Google
- `GOOGLE_ACCOUNT_LINKED`: Email/password user linked Google account

### Setup Guide

See [GOOGLE_OAUTH_SETUP.md](../GOOGLE_OAUTH_SETUP.md) for detailed instructions on:
1. Creating a Google Cloud project
2. Configuring OAuth consent screen
3. Creating OAuth 2.0 credentials
4. Adding authorized origins
5. Testing the flow

**Quick Start:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable OAuth
3. Create OAuth 2.0 Client ID (Web application)
4. Add `http://localhost:5173` to authorized origins
5. Copy Client ID to `.env` files
6. Restart backend and frontend

### Related Decisions

- ADR-004: JWT for Authentication (Google OAuth returns same JWT token)
- ADR-024: Username System (auto-generated for OAuth users)
- ADR-025: Password Reset (OAuth users don't need password reset)

---

## ADR-027: Cumulative Scoring System

**Date:** 2026-01-18
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #scoring #business-rules #ux

### Context

El sistema de scoring original funcionaba de forma "exclusiva" - si acertabas el marcador exacto (EXACT_SCORE), obtenías esos puntos y la evaluación terminaba. Esto era simple pero limitado:

**Problemas del sistema legacy:**
1. **Falta de recompensa parcial:** Si aciertas 2-1 y el resultado es 2-0, obtienes 0 puntos (no reconoce que acertaste los goles del local)
2. **Baja motivación:** Sin puntos parciales, los jugadores sienten que "casi acertar" no vale nada
3. **Poca diferenciación:** Todos los picks incorrectos valen 0, no hay gradiente de precisión

**Requisitos del usuario:**
> "Quiero que si acierto los goles del local pero no del visitante, me den puntos por el local. Y si acierto el resultado (ganó/empató/perdió) también me den puntos adicionales."

### Decision

Implementar un **Sistema de Scoring Acumulativo** donde los puntos se SUMAN por cada criterio independiente que el jugador acierte.

**Criterios evaluados (todos acumulan):**
1. **MATCH_OUTCOME_90MIN** - ¿Acertó quién ganó/empató? (5 pts grupos, 10 pts knockouts)
2. **HOME_GOALS** - ¿Acertó goles del local? (2 pts grupos, 4 pts knockouts)
3. **AWAY_GOALS** - ¿Acertó goles del visitante? (2 pts grupos, 4 pts knockouts)
4. **GOAL_DIFFERENCE** - ¿Acertó la diferencia de goles? (1 pt grupos, 2 pts knockouts)

**Ejemplo de cálculo:**
```
Pick: 2-1 | Resultado: 2-1
- MATCH_OUTCOME_90MIN: HOME gana = HOME gana ✅ → 5 pts
- HOME_GOALS: 2 = 2 ✅ → 2 pts
- AWAY_GOALS: 1 = 1 ✅ → 2 pts
- GOAL_DIFFERENCE: +1 = +1 ✅ → 1 pt
- TOTAL: 10 pts (máximo posible en grupos)

Pick: 2-1 | Resultado: 2-0
- MATCH_OUTCOME_90MIN: HOME gana = HOME gana ✅ → 5 pts
- HOME_GOALS: 2 = 2 ✅ → 2 pts
- AWAY_GOALS: 1 ≠ 0 ❌ → 0 pts
- GOAL_DIFFERENCE: +1 ≠ +2 ❌ → 0 pts
- TOTAL: 7 pts (recompensa parcial)
```

**Detección automática:**
```typescript
function isCumulativeScoring(config: PhasePickConfig): boolean {
  return config.matchPickTypes.HOME_GOALS?.enabled ||
         config.matchPickTypes.AWAY_GOALS?.enabled;
}
```

**Presets implementados:**
1. **CUMULATIVE (Recomendado):** Scoring acumulativo completo
2. **BASIC:** Solo EXACT_SCORE + MATCH_OUTCOME (legacy)
3. **ADVANCED:** Todos los criterios con puntos más altos
4. **SIMPLE:** Sin marcador en grupos, solo knockouts

### Rationale

**¿Por qué acumulativo vs exclusivo?**
- **Más justo:** Recompensa precisión parcial
- **Más motivante:** "Casi acertar" vale algo
- **Más estratégico:** Jugadores pueden apuntar a resultados conservadores vs arriesgados
- **Estándar de industria:** Quinielas profesionales usan sistemas similares

**¿Por qué HOME_GOALS y AWAY_GOALS como criterios separados?**
- Permite premiar cuando aciertas uno pero no el otro
- Hace el scoring más granular
- Compatible con resultados de empate (donde diferencia=0 pero goles individuales importan)

**¿Por qué puntos más altos en knockouts?**
- Knockouts son más difíciles de predecir (menos historial)
- Mayor emoción en fases finales
- Recompensa a quienes llegan bien posicionados

### Consequences

**Positive:**
- ✅ Jugadores reciben puntos por aciertos parciales
- ✅ Más engagement (cada criterio acertado se celebra)
- ✅ Diferenciación clara entre picks "casi correctos" vs "completamente errados"
- ✅ Compatible con sistema legacy (detección automática)
- ✅ UI muestra breakdown de cada criterio

**Negative:**
- ⚠️ Mayor complejidad de cálculo (4 evaluaciones por partido)
- ⚠️ Usuarios deben entender el nuevo sistema (requiere explicación clara)
- ⚠️ Puntajes totales más altos (puede confundir vs pools legacy)

**Risks:**
- ⚠️ Posible confusión si mezclas presets en misma liga (mitigado: no permitido)

### Alternatives Considered

1. **Mantener sistema exclusivo:** Rechazado - feedback de usuarios pedía recompensa parcial
2. **Bonus multiplicador por exacto:** Rechazado - matemáticamente confuso
3. **Puntos negativos por errores:** Rechazado - desmotivante, anti-fun

### Implementation

**Backend Files:**
- `backend/src/types/pickConfig.ts` - Tipos HOME_GOALS, AWAY_GOALS
- `backend/src/lib/pickPresets.ts` - 4 presets con configs por fase
- `backend/src/lib/scoringAdvanced.ts` - `isCumulativeScoring()` + evaluación
- `backend/src/lib/scoringBreakdown.ts` - Generación de breakdown

**Frontend Files:**
- `frontend/src/components/PoolConfigWizard.tsx` - Preset cards
- `frontend/src/components/PickRulesDisplay.tsx` - Explicación por modo
- `frontend/src/components/PlayerSummary.tsx` - Breakdown visual

**Key Algorithm:**
```typescript
function scoreMatchPickCumulative(pick, result, config): ScoringResult {
  const evaluations: PickEvaluation[] = [];
  let totalPoints = 0;

  // Evaluate ALL enabled criteria
  for (const [type, typeConfig] of Object.entries(config.matchPickTypes)) {
    if (!typeConfig?.enabled) continue;

    const matched = evaluateCriterion(type, pick, result);
    const points = matched ? typeConfig.points : 0;

    evaluations.push({ type, matched, points, maxPoints: typeConfig.points });
    totalPoints += points;
  }

  return { totalPoints, evaluations };
}
```

### Related Decisions

- ADR-011: Multi-Type Pick System (foundation for pick types)
- ADR-013: Leaderboard Tiebreaker Rules (uses totalPoints from this system)

---

## ADR-028: Rate Limiting Strategy

**Date:** 2026-01-18
**Status:** Accepted
**Deciders:** Development Team
**Tags:** #security #api #performance

### Context

La plataforma necesita protección contra:
1. Ataques de fuerza bruta en login/registro
2. Abuso de API (scraping, spam)
3. Agotamiento de recursos (DoS involuntario)
4. Spam en password reset (costo de emails)

### Decision

Implementar rate limiting en capas usando `express-rate-limit`:

| Endpoint | Límite | Ventana | Razón |
|----------|--------|---------|-------|
| API General | 100 req | 1 min | Uso normal generoso |
| Login/Register | 10 intentos | 15 min | Anti brute-force |
| Password Reset | 5 solicitudes | 1 hora | Previene spam de emails |

### Rationale

1. **Simple:** `express-rate-limit` es maduro, bien mantenido, sin dependencias externas
2. **In-memory:** Suficiente para MVP (no requiere Redis)
3. **Estándar:** Usa headers `RateLimit-*` (IETF draft standard)
4. **Flexible:** Fácil de ajustar límites sin cambiar código

### Consequences

**Positive:**
- ✅ Protección inmediata contra ataques básicos
- ✅ Cero costo adicional de infraestructura
- ✅ Headers informan al cliente sobre límites restantes
- ✅ Health check excluido del rate limit

**Negative:**
- ⚠️ Rate limit se resetea al reiniciar servidor
- ⚠️ No distribuido: cada instancia tiene su propio contador
- ⚠️ IP-based: usuarios detrás de NAT comparten límite

**Risks:**
- ⚠️ En producción multi-instancia, necesitará Redis store

### Alternatives Considered

1. **Redis-based rate limiting:** Rechazado - overengineering para MVP
2. **Cloudflare/WAF:** Rechazado - dependencia externa, costo
3. **Token bucket algorithm:** Rechazado - `express-rate-limit` ya lo implementa

### Implementation

**Files:**
- `backend/src/middleware/rateLimit.ts` - 4 limiters configurados
- `backend/src/server.ts` - Aplicación de middleware

```typescript
// Configuración principal
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 100,             // 100 requests
  standardHeaders: true,
  skip: (req) => req.path === "/health",
});
```

### Related Decisions

- ADR-025: Password Recovery (usa passwordResetLimiter)

---

## ADR-029: Internal Notification System (Badges)

**Date:** 2026-01-18
**Status:** Accepted
**Deciders:** Development Team
**Tags:** #ux #frontend #api

### Context

Los usuarios (especialmente hosts) necesitan indicadores visuales de:
1. Acciones pendientes (aprobar solicitudes, publicar resultados)
2. Deadlines cercanos (picks por hacer)
3. Estado del pool (fases listas para avanzar)

Sin notificaciones push (todavía no hay PWA), necesitamos un sistema interno que alerte visualmente.

### Decision

Implementar sistema de badges en tabs con polling:

| Badge | Color | Tab | Condición |
|-------|-------|-----|-----------|
| Picks pendientes | 🔴 Rojo | Partidos | Deadline no pasado, sin pick |
| Deadline urgente | 🔴 Rojo (pulse) | Partidos | < 24h sin pick |
| Resultados pendientes | 🔴 Rojo | Partidos | (Host) Partido jugado sin resultado |
| Solicitudes | 🟠 Naranja | Admin | PENDING_APPROVAL members |
| Fases listas | 🟠 Naranja | Admin | Fase completa sin avanzar |

**Polling:** 60 segundos (balance entre responsividad y carga)

### Rationale

1. **Visual claro:** Badges son patrón conocido (apps móviles, Gmail, etc.)
2. **Bajo costo:** Polling es simple, endpoint ligero
3. **Escalable:** Fácil migrar a WebSocket en v2.0
4. **No invasivo:** No interrumpe al usuario, solo informa

### Consequences

**Positive:**
- ✅ Host nunca pierde solicitudes pendientes
- ✅ Jugadores ven picks urgentes inmediatamente
- ✅ Animación pulse llama atención en deadlines críticos
- ✅ Badges se actualizan tras cada acción

**Negative:**
- ⚠️ Polling genera requests cada 60s por usuario activo
- ⚠️ No es tiempo real (hasta 60s de delay)

**Risks:**
- ⚠️ Si hay muchos usuarios simultáneos, considerar cache

### Implementation

**Backend:**
- `GET /pools/:poolId/notifications` - Retorna contadores

**Frontend:**
- `usePoolNotifications(poolId)` - Hook con polling
- `NotificationBadge` - Componente visual
- `calculateTabBadges()` - Lógica de agregación

### Related Decisions

- ADR-028: Rate Limiting (protege el endpoint de notifications)

---

## ADR-030: Slide-in Auth Panel

**Date:** 2026-02-01
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #ux #frontend #authentication

### Context

El flujo de login/registro original navegaba a una página separada (`/login`), lo que causaba:

1. **Pérdida de contexto:** Usuario pierde de vista la landing page mientras se registra
2. **Experiencia interrumpida:** Se siente como "cambiar de página" en lugar de una acción fluida
3. **UX menos moderna:** Apps modernas (Notion, Figma, etc.) usan modales/panels para auth

**User Feedback:**
> "Al dar ingresar se cambia a otra página, tal vez debería ocurrir allí mismo, como en un pop up o algo así"

**Opciones evaluadas:**
1. Página separada (actual)
2. Modal/Popup centrado
3. **Slide-in panel desde la derecha** ← Elegida
4. Panel expandible inline

### Decision

Implementar un **Slide-in Auth Panel** que desliza desde la derecha con las siguientes características:

**Diseño:**
- Desktop: Panel de 420px de ancho, desliza desde la derecha
- Mobile: Pantalla completa (100% width)
- Backdrop semi-transparente detrás
- Animación suave (0.3s ease)

**Funcionalidad completa:**
- Tabs para alternar Login/Registro
- Todos los campos de registro (email, confirm email, username, displayName, password)
- Checkboxes de consent (términos, privacidad, edad, marketing)
- Google Sign-in integrado con flujo de consent para usuarios nuevos
- Link "¿Olvidaste tu contraseña?" que cierra el panel y navega
- Link "Abrir en página completa" para compatibilidad con password managers

**Accesibilidad:**
- Escape key cierra el panel
- Click en backdrop cierra el panel
- Focus trap (navegación por tab dentro del panel)
- Body scroll bloqueado cuando está abierto
- `aria-label` en botón de cerrar

**Estados manejados:**
- Loading (mientras procesa login/registro)
- Error (validación, credenciales inválidas)
- Google consent modal (para nuevos usuarios OAuth)

### Rationale

**¿Por qué slide-in panel vs modal centrado?**
- **App-like feel:** Más elegante, similar a apps nativas (carrito de compras, settings)
- **Más espacio:** Mejor para formularios largos (especialmente registro)
- **Menos intrusivo:** No bloquea completamente la vista de la página
- **Animación natural:** Deslizar desde el lado es más suave que aparecer/desaparecer

**¿Por qué mantener también la página /login?**
- **Password managers:** Algunos no funcionan bien con panels/modals
- **Bookmarking:** Usuarios pueden guardar link directo a login
- **Deep linking:** Permite enviar links directos de login (ej: password reset redirect)
- **Accesibilidad:** Página separada es más robusta para screen readers

**¿Por qué replicar la lógica de LoginPage en el panel?**
- Evita complejidad de extraer componente compartido (por ahora)
- Panel tiene consideraciones de UX únicas (tamaño, scroll, etc.)
- Fácil de mantener sincronizado (misma estructura)

### Consequences

**Positive:**
- ✅ UX más fluida y moderna
- ✅ Usuario mantiene contexto de la página
- ✅ Funcionalidad completa (login, registro, Google, consent)
- ✅ Mobile-first (full-screen en móvil)
- ✅ Accessible (escape, backdrop, focus)
- ✅ Fallback a página completa disponible

**Negative:**
- ⚠️ Código duplicado con LoginPage (puede unificarse en v2)
- ⚠️ Más código JavaScript cargado (componente adicional)
- ⚠️ Google Sign-in puede tener issues en algunos browsers con panels

**Risks:**
- ⚠️ Password managers podrían no detectar el formulario (mitigado: link a página completa)
- ⚠️ Focus management en mobile puede ser complicado (mitigado: full-screen mode)

### Alternatives Considered

1. **Página separada (mantener actual):**
   - ❌ Rechazada: UX menos fluida, feedback del usuario

2. **Modal centrado:**
   - ❌ Rechazada: Menos espacio, más intrusivo, menos elegante

3. **Dropdown desde navbar:**
   - ❌ Rechazada: Muy pequeño para formulario de registro completo

4. **Expandir inline en la página:**
   - ❌ Rechazada: Empuja contenido, menos predecible

### Implementation

**Componentes creados:**
- `frontend/src/components/AuthSlidePanel.tsx` - Panel principal con toda la lógica

**Componentes modificados:**
- `frontend/src/components/PublicNavbar.tsx` - Botón "Ingresar" abre panel
- `frontend/src/components/PublicLayout.tsx` - Maneja estado del panel
- `frontend/src/App.tsx` - Pasa `onLoggedIn` callback

**CSS Animations:**
```css
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Estado del panel:**
```typescript
interface AuthSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}
```

**Key UX Details:**
```typescript
// Lock body scroll when open
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}, [isOpen]);

// Handle escape key
useEffect(() => {
  function handleEscape(e: KeyboardEvent) {
    if (e.key === "Escape" && isOpen) onClose();
  }
  window.addEventListener("keydown", handleEscape);
  return () => window.removeEventListener("keydown", handleEscape);
}, [isOpen, onClose]);
```

### Related Decisions

- ADR-026: Google OAuth Integration (reutilizado en panel)
- ADR-024: Username System (validación en registro)
- ADR-017: Light Theme Only (estilos del panel)

---

## ADR-031: Automatic Results via API-Football

**Date:** 2026-02-04
**Status:** Accepted
**Deciders:** Product Team, Engineering Team
**Tags:** #api #automation #results #integration

### Context

El sistema original requería que el Host ingresara manualmente todos los resultados de partidos. Esto funcionaba bien para:
- Torneos amateur donde no hay fuente externa
- Pools pequeños con pocos partidos

Sin embargo, para el **producto principal** (World Cup 2026, Champions League, ligas oficiales), esto presenta problemas:

1. **Trabajo manual excesivo:** 104 partidos en WC2026, Host debe publicar cada resultado
2. **Delays en resultados:** Host podría no estar disponible cuando termina un partido
3. **Errores humanos:** Posibilidad de ingresar marcadores incorrectos
4. **Experiencia de usuario:** Jugadores quieren ver resultados inmediatamente

**Requisitos:**
- Resultados automáticos para torneos oficiales via API externa
- Mantener capacidad de resultados manuales para torneos amateur
- Fallback si la API falla/tarda: Host puede ingresar resultado provisional
- Host puede corregir un resultado de API si hay erratas (con justificación)

**API Elegida:** API-Football (api-sports.io)
- 100 requests/día gratis (suficiente para desarrollo)
- Cobertura completa de World Cup, Champions, ligas principales
- API REST bien documentada con JSON
- $19/mes para producción (10,000 requests/día)

### Decision

Implementar un **sistema híbrido de resultados** con dos modos por instancia y tracking de fuente por resultado.

**Modo de Instancia (ResultSourceMode):**
```prisma
enum ResultSourceMode {
  MANUAL  // Host ingresa resultados (torneos amateur)
  AUTO    // Resultados se obtienen de API-Football
}
```

**Fuente de Resultado (ResultSource):**
```prisma
enum ResultSource {
  HOST_MANUAL       // Host en instancia MANUAL
  HOST_PROVISIONAL  // Host en instancia AUTO mientras espera API
  API_CONFIRMED     // Resultado confirmado de API-Football
  HOST_OVERRIDE     // Host corrigió resultado de API (errata)
}
```

**Arquitectura:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                     TournamentInstance                               │
│  resultSourceMode: MANUAL | AUTO                                     │
│  apiFootballLeagueId: 1 (World Cup)                                 │
│  apiFootballSeasonId: 2026                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────────┐
│ MatchMapping  │   │  ResultSync     │   │ PoolMatchResult   │
│ internalId ↔  │   │  Cron Job       │   │ source:           │
│ apiFootball   │   │  (cada 5min)    │   │ - HOST_MANUAL     │
│ fixtureId     │   │                 │   │ - HOST_PROVISIONAL│
└───────────────┘   └─────────────────┘   │ - API_CONFIRMED   │
                              │           │ - HOST_OVERRIDE   │
                              ▼           └───────────────────┘
                    ┌─────────────────┐
                    │  API-Football   │
                    │  External API   │
                    └─────────────────┘
```

**Matriz de Decisiones:**
| Modo | Resultado Existente | Nueva Fuente | Acción |
|------|---------------------|--------------|--------|
| MANUAL | Ninguno | HOST | Crear como HOST_MANUAL |
| MANUAL | Cualquiera | HOST | Crear nueva versión (reason si v>1) |
| AUTO | Ninguno | HOST | Crear como HOST_PROVISIONAL |
| AUTO | Ninguno | API | Crear como API_CONFIRMED |
| AUTO | PROVISIONAL | API (=score) | Cambiar source a API_CONFIRMED |
| AUTO | PROVISIONAL | API (≠score) | Crear versión API_CONFIRMED |
| AUTO | CONFIRMED | HOST | Crear como HOST_OVERRIDE (**reason obligatorio**) |
| AUTO | OVERRIDE | API | **IGNORAR** (override es final) |

### Rationale

**¿Por qué nivel de instancia (no pool)?**
- Una instancia puede tener múltiples pools
- Todos los pools de una instancia comparten la misma fuente de resultados
- Configuración centralizada: Admin configura una vez, aplica a todos

**¿Por qué HOST_PROVISIONAL?**
- API puede tardar 5-10 minutos después del partido
- Host puede publicar para que jugadores vean puntos rápido
- Se reemplaza automáticamente cuando llega el resultado oficial
- Transparencia: UI muestra que es provisional

**¿Por qué HOST_OVERRIDE no se reemplaza?**
- Override es una corrección deliberada (ej: error de API, partido suspendido)
- Requiere justificación obligatoria (reason)
- Decisión final del Host prevalece sobre API

**¿Por qué API-Football vs alternativas?**
- Live Score API: Problemas con registro (botón no funcionaba)
- Football-Data.org: Cobertura limitada de World Cup
- ESPN/CBS: Sin API pública
- API-Football: Free tier generoso, buena documentación, cobertura completa

### Consequences

**Positive:**
- ✅ Resultados automáticos en tiempo real para torneos oficiales
- ✅ Cero trabajo manual para Host en modo AUTO
- ✅ Fallback provisional si API falla
- ✅ Host mantiene control total (puede corregir API)
- ✅ Trazabilidad completa (source tracking + audit log)
- ✅ Misma UX para jugadores (no saben si resultado es manual o auto)
- ✅ Compatibilidad total con flujo existente (MANUAL = comportamiento actual)

**Negative:**
- ⚠️ Dependencia de servicio externo (API-Football)
- ⚠️ Costo mensual en producción ($19/mes)
- ⚠️ Complejidad adicional (mapeos, sync job, rate limiting)
- ⚠️ Requiere configuración inicial (Admin debe crear mapeos)

**Risks:**
- ⚠️ API-Football down → sin resultados auto (mitigado: HOST_PROVISIONAL)
- ⚠️ Rate limit excedido → sync incompleto (mitigado: 10 req/min, job cada 5min)
- ⚠️ Datos incorrectos de API → errores en puntuación (mitigado: HOST_OVERRIDE)

### Alternatives Considered

1. **Manual only (sin API):**
   - ❌ Rechazado: Producto principal necesita automatización
   - Demasiado trabajo para Host en torneos grandes

2. **Scraping de sitios web:**
   - ❌ Rechazado: Frágil, posiblemente ilegal, sin garantía de estructura
   - Requiere mantenimiento constante

3. **API por pool (no instancia):**
   - ❌ Rechazado: Duplicación de configuración, inconsistencia entre pools
   - Un torneo = una fuente de verdad

4. **Sin fallback provisional:**
   - ❌ Rechazado: Mala UX si API tarda
   - Hosts deben poder publicar rápidamente

5. **Sin override (API es final):**
   - ❌ Rechazado: Quita control al Host
   - APIs pueden tener errores, partidos pueden ser anulados

### Implementation

**Database Schema:**
```prisma
// TournamentInstance
resultSourceMode     ResultSourceMode @default(MANUAL)
apiFootballLeagueId  Int?
apiFootballSeasonId  Int?
lastSyncAtUtc        DateTime?
syncEnabled          Boolean @default(true)

// PoolMatchResultVersion
source              ResultSource @default(HOST_MANUAL)
externalFixtureId   Int?
externalDataJson    Json?

// New models
model MatchExternalMapping {
  id                    String @id @default(uuid())
  tournamentInstanceId  String
  internalMatchId       String
  apiFootballFixtureId  Int
  @@unique([tournamentInstanceId, internalMatchId])
}

model ResultSyncLog {
  id                   String @id @default(uuid())
  tournamentInstanceId String
  status               SyncStatus
  fixturesChecked      Int
  fixturesUpdated      Int
  errors               Json?
}
```

**Services Created:**
- `backend/src/services/apiFootball/client.ts` - HTTP client con rate limiting
- `backend/src/services/apiFootball/types.ts` - TypeScript types para API responses
- `backend/src/services/resultSync/service.ts` - Sincronización de resultados
- `backend/src/jobs/resultSyncJob.ts` - Cron job (cada 5 min)

**Admin Endpoints:**
```typescript
PUT /admin/instances/:id/result-source  // Configurar modo AUTO/MANUAL
POST /admin/instances/:id/match-mappings // Crear mapeos en bulk
GET /admin/instances/:id/match-mappings  // Listar mapeos
POST /admin/instances/:id/sync           // Disparar sync manual
GET /admin/instances/:id/sync-status     // Ver logs de sync
```

**Environment Variables:**
```env
API_FOOTBALL_KEY=xxx
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_ENABLED=true
```

**Rate Limiting:**
- API-Football free tier: 100 requests/día
- Cliente implementa: máximo 10 requests/minuto
- Cron job: ejecuta cada 5 minutos (12 requests/hora max)

**Fixture Status Handling:**
```typescript
// Only sync finished matches
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
// FT = Full Time (90 min)
// AET = After Extra Time
// PEN = After Penalty Shootout
```

### Related Decisions

- ADR-007: Result Versioning (source se almacena en versión)
- ADR-019: Penalty Shootouts (API proporciona scores de penales)
- ADR-006: Template/Version/Instance (configuración a nivel instancia)

---

## ADR-032: Smart Sync - Optimized API Polling Strategy

**Date:** 2026-02-04
**Status:** Accepted
**Deciders:** Product Team, Engineering Team
**Tags:** #api #optimization #performance #sync

### Context

El sistema inicial de sincronización (ADR-031) usaba **polling periódico** cada 5 minutos para consultar todos los partidos con kickoff pasado. Esto presentaba problemas:

1. **Desperdicio de requests:** Consultas a partidos ya finalizados
2. **Límite diario agotado rápidamente:** 100 requests/día (free tier) se agotaban con ~100 partidos
3. **Consultas innecesarias:** Partidos que no han empezado o que no pueden haber terminado aún

**Observación clave:** Para una plataforma de quinielas que **no requiere resultados en tiempo real** (no es betting), solo necesitamos saber si el partido inició (para mostrar "En juego") y el resultado final (para calcular puntos).

**Dato importante:** Un partido de fútbol dura mínimo 105 minutos (90 juego + 15 descanso).

### Decision

Implementar **Smart Sync**: un sistema que consulta cada partido solo en momentos estratégicos.

**Flujo por partido:**
```
KICKOFF              +5min                    +110min                Cada 5min
   │                   │                         │                      │
   ▼                   ▼                         ▼                      ▼
[PENDING] ────────► [IN_PROGRESS] ────────► [AWAITING_FINISH] ────► [COMPLETED]
                       │                         │
                  Consulta 1                Consulta 2+
                 "¿Inició?"                "¿Terminó?"
```

**Estados (MatchSyncStatus):**
- `PENDING` - Esperando kickoff + 5min
- `IN_PROGRESS` - Partido inició, esperando finishCheckAtUtc
- `AWAITING_FINISH` - Pasó tiempo estimado, polling cada 5min
- `COMPLETED` - Partido finalizado, nunca más consultar
- `SKIPPED` - Sin mapping de API o modo manual

**Tiempos configurados:**
| Parámetro | Valor | Razón |
|-----------|-------|-------|
| FIRST_CHECK_DELAY | 5 min | Confirmar que el partido inició |
| FINISH_CHECK_DELAY | 110 min | Cubre 95% de partidos sin tiempo extra |
| AWAITING_FINISH_POLL | 5 min | Balance entre rapidez y ahorro |

### Rationale

**Eficiencia comparada:**

| Método | Requests por partido | Total 64 partidos |
|--------|---------------------|-------------------|
| Polling cada 5 min | ~20-30 | 1,280-1,920 |
| **Smart Sync** | 2-4 | 128-256 |

**Reducción: ~85-90% en llamadas a API**

### Consequences

**Positive:**
- ✅ Reducción dramática de requests (85-90%)
- ✅ Nunca se agotan los 100 requests/día del free tier
- ✅ Estado "En juego" disponible para UI
- ✅ Cada partido tiene trazabilidad completa

**Negative:**
- ⚠️ Complejidad adicional (nueva tabla, estados)
- ⚠️ Delay máximo de 5 minutos para resultados

### Implementation Notes

**Archivos:**
- `backend/src/services/smartSync/service.ts` - Lógica principal
- `backend/src/jobs/smartSyncJob.ts` - Cron job (cada minuto)
- `backend/src/scripts/initSmartSyncStates.ts` - Inicialización

**Comando:** `npm run init:smart-sync [instanceId]`

### Related Decisions

- ADR-031: Automatic Results via API-Football (sistema base)
- ADR-028: Rate Limiting Strategy (complementa con smart polling)

---

## ADR-033: Next.js Migration (SSR + SEO)

**Date:** 2026-02-13
**Status:** Accepted
**Deciders:** Juan, Claude
**Tags:** #architecture #frontend #seo #deployment

### Context

The platform frontend was a React SPA (Vite) with no server-side rendering. This created critical limitations:
- **No SEO**: Search engine crawlers see empty HTML divs, zero indexable content
- **No social sharing**: OG tags not present in initial HTML, so WhatsApp/Twitter/LinkedIn show blank previews
- **No regional SEO**: Platform targets all Spanish-speaking countries with different terms (quiniela, polla, prode, penca, porra) — need indexable landing pages
- **World Cup 2026 approaching**: Need organic traffic from searches like "quiniela mundial 2026 gratis"

### Decision

Migrate frontend from React SPA (Vite) to **Next.js App Router** with:
- **Blue-green deployment**: New `/frontend-next` project deployed as separate Railway service
- **SSR for public pages**: Landing, FAQ, Cómo Funciona, regional pages, legal
- **Client components for authenticated pages**: Dashboard, Pool, Profile, Admin (same auth via localStorage)
- **Spanish URLs**: `/como-funciona`, `/terminos`, `/privacidad`, `/que-es-una-quiniela`
- **Regional landing pages**: `/polla-futbolera`, `/prode-deportivo`, `/penca-futbol`, `/porra-deportiva`
- **Full SEO stack**: metadata API, JSON-LD structured data, sitemap.xml, robots.txt, OG images

### Rationale

- Next.js App Router provides SSR/SSG out of the box with zero config
- Metadata API is type-safe and generates all meta/OG tags automatically
- `output: 'standalone'` works perfectly with Railway/nixpacks
- Blue-green approach means zero downtime — switch domain when ready
- Same API, same auth tokens — backend unchanged

### Consequences

**Positive:**
- ✅ Full SEO: All public content visible to crawlers in initial HTML
- ✅ Social sharing works (OG tags rendered server-side)
- ✅ Regional SEO captures traffic from 10+ Spanish-speaking countries
- ✅ Google Search Console verified, sitemap submitted, pages indexed
- ✅ Google Analytics (GA4) integrated
- ✅ PageSpeed: Performance 93, Accessibility 95, Best Practices 96, SEO 100
- ✅ Core Web Vitals optimized (modern browserslist, no legacy polyfills)

**Negative:**
- ⚠️ Two frontend projects during transition (old SPA still on Railway)
- ⚠️ Slightly more complex deployment (Next.js standalone vs static Vite build)
- ⚠️ `beforeInteractive` script strategy needed for Google Identity Services on Safari

### Implementation Notes

**Key files:**
- `frontend-next/src/app/layout.tsx` — Root layout with global metadata, GA4, Google Identity Services
- `frontend-next/src/app/page.tsx` — Landing page (SSR)
- `frontend-next/src/middleware.ts` — www → non-www 301 redirect
- `frontend-next/src/app/sitemap.ts` — Dynamic sitemap
- `frontend-next/src/app/robots.ts` — Dynamic robots.txt
- `frontend-next/src/app/icon.tsx` — Dynamic favicon (branded P)
- `frontend-next/src/components/JsonLd.tsx` — Reusable structured data helper

**SEO pages:**
- `/como-funciona` — How it works (SSR)
- `/faq` — FAQ with FAQPage JSON-LD schema
- `/que-es-una-quiniela` — Regional glossary (DefinedTermSet schema)
- `/polla-futbolera`, `/prode-deportivo`, `/penca-futbol`, `/porra-deportiva` — Regional landing pages
- `/terminos`, `/privacidad` — Legal pages (SSR)

**Railway config:**
- Service: Frontend-Next (ad6cc321-0e26-454b-8253-a2b67f49a050)
- Domain: picks4all.com + www.picks4all.com
- Start command: `node .next/standalone/server.js`

**Safari Google login fix:**
- `use_fedcm_for_prompt: false` in Google Identity Services init (Safari doesn't support FedCM)
- Script loaded with `strategy="beforeInteractive"` (Safari ITP delays afterInteractive)
- Retry timeout increased from 5s to 10s

### Related Decisions

- ADR-030: Slide-in Auth Panel (migrated to Next.js)
- ADR-031: Auto Results (backend unchanged)

---

## ADR-034: Cloudflare Email Routing for Incoming Email

**Date:** 2026-03-01
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #infrastructure #email

### Context

The platform advertises `soporte@picks4all.com` in the Footer, FAQ, and legal documents, but no MX records exist for the domain. Emails sent to any @picks4all.com address go nowhere. Outgoing email uses Resend (transactional), but receiving email requires MX records and a mail server.

Options considered:
1. Google Workspace ($7/user/month) — full email hosting
2. Cloudflare Email Routing (free) — forwards to existing Gmail
3. Zoho Mail (free tier) — limited webmail
4. Self-hosted (Postfix/Dovecot) — high maintenance

### Decision

Use **Cloudflare Email Routing** to forward all incoming @picks4all.com emails to the founder's personal Gmail.

### Rationale

- ✅ **Free:** No monthly cost
- ✅ **Already on Cloudflare:** Domain DNS is managed in Cloudflare, so setup is 1-click
- ✅ **Instant:** MX records auto-created, no propagation wait
- ✅ **Catch-all support:** Forward `*@picks4all.com` to catch any address
- ✅ **No new accounts:** Uses existing Gmail inbox
- ✅ **Non-blocking:** Can upgrade to Google Workspace later without disruption

### Consequences

**Positive:**
- ✅ soporte@picks4all.com actually receives emails
- ✅ Zero cost, zero maintenance
- ✅ Can reply from Gmail (with "Send As" configuration)

**Negative:**
- ⚠️ Cannot send FROM @picks4all.com via Gmail natively (need "Send As" config)
- ⚠️ No dedicated mailbox (emails arrive in personal Gmail mixed with other mail)
- ⚠️ Not suitable for multiple team members (all goes to one inbox)

### Implementation

1. Cloudflare Dashboard → Email → Email Routing → Enable
2. Add destination: personal Gmail, verify
3. Create route: soporte@picks4all.com → Gmail
4. Create catch-all: *@picks4all.com → Gmail (optional)
5. MX records auto-created by Cloudflare

---

## ADR-035: Corporate Pool Feature — MVP Approach

**Date:** 2026-03-01
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #feature #corporate #architecture

### Context

Companies want to organize prediction pools for their employees as team-building activities. This requires:
- A way for companies to discover and contact us
- Customization (company logo on pool)
- Bulk user creation (employees don't have accounts)
- Organization tracking

Full self-service enterprise features (dashboard, SSO, billing portal) would take 2-3 months. We need an MVP for April 1st launch.

### Decision

Implement a **manual-process MVP** with three components:

1. **Public enterprise landing page** (`/empresas`) with a contact form that creates `OrganizationInquiry` records
2. **Database models** (`Organization`, `OrganizationInquiry`) and **Pool fields** (`organizationId`, `logoUrl`) for corporate tracking
3. **Admin-only endpoints** for bulk user creation and corporate pool management

The workflow is: Company fills form → Admin receives email → Admin manually creates org, users, and pool via admin API.

### Rationale

- ✅ **Ships in 1 week:** Contact form + backend endpoints, no complex UI
- ✅ **Validates demand:** Captures inquiries before building full dashboard
- ✅ **Low risk:** Manual process means we control quality
- ✅ **Extensible:** Organization model supports future self-service features
- ✅ **Pool branding:** `logoUrl` field works for both corporate and future premium

### Consequences

**Positive:**
- ✅ Companies can contact us and get set up
- ✅ Pool branding works immediately
- ✅ Database ready for future enterprise features
- ✅ Admin has full control over onboarding

**Negative:**
- ⚠️ Not self-service (manual admin work per company)
- ⚠️ No company admin role (everything goes through platform admin)
- ⚠️ Logo must be provided as URL (no upload UI)

### Future Evolution (v1.1+)

- Self-service enterprise dashboard
- Company admin role
- Logo upload via platform
- SSO integration (SAML/OIDC)
- Billing portal for corporate accounts

---

## ADR-036: Lemon Squeezy as Merchant of Record

**Date:** 2026-03-01
**Status:** Accepted (pending approval)
**Deciders:** Product Team
**Tags:** #payments #business

### Context

The platform needs a payment system for pools exceeding 20 participants (one-time fee per pool). The founder is based in Colombia, which limits payment processor options:
- **Stripe Direct:** Not available for Colombian residents
- **PayPal Commerce:** Complex setup, high fees for LATAM
- **Lemon Squeezy:** Merchant of Record model, handles taxes/compliance, supports Colombia

### Decision

Use **Lemon Squeezy** as Merchant of Record for all payments.

**Monetization model:**
- **Free tier:** Pools with up to 20 participants
- **Paid tier:** One-time payment per pool for pools with >20 participants
- Price TBD (likely $2-5 USD per pool)

### Rationale

- ✅ **Colombia-friendly:** LS supports merchants in Colombia
- ✅ **MoR model:** LS handles tax collection, compliance, invoicing
- ✅ **Simple integration:** Hosted checkout + webhooks
- ✅ **One-time payments:** Supports single-purchase model (not just subscriptions)
- ✅ **Multiple currencies:** Users can pay in their local currency

### Consequences

**Positive:**
- ✅ No tax/compliance burden on the founder
- ✅ Simple webhook-based integration
- ✅ Supports global payments
- ✅ Dashboard for revenue tracking

**Negative:**
- ⚠️ LS takes ~5-8% commission + payment processor fees
- ⚠️ Approval not guaranteed (application pending as of 2026-03-01)
- ⚠️ If rejected, need alternative (Paddle, manual payments)
- ⚠️ Hosted checkout means redirect (not inline payment form)

### Implementation Plan

1. Create PoolPayment model in database
2. Create Lemon Squeezy product (one-time purchase)
3. Implement checkout URL generation endpoint
4. Implement webhook handler for payment confirmation
5. Wire payment gate to pool join flow
6. DEFERRED until LS approval is confirmed

---

## ADR-037: Resend Domain Verification for Production Email

**Date:** 2026-03-01
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #email #infrastructure

### Context

Outgoing emails currently use Resend's sandbox address `onboarding@resend.dev`. This:
- Looks unprofessional (not @picks4all.com)
- May have lower deliverability (shared sandbox reputation)
- Confuses users who don't recognize the sender

Additionally, email templates still reference the old domain `soporte@tuquiniela.com` and the old brand name "Quiniela Platform".

### Decision

1. **Verify `picks4all.com` domain in Resend** by adding SPF/DKIM TXT records to Cloudflare DNS
2. **Update FROM_EMAIL** to `noreply@picks4all.com` via Railway environment variable
3. **Fix brand references** in email code: APP_NAME → "Picks4All", supportEmail → "soporte@picks4all.com"

### Rationale

- ✅ **Professional:** Emails come from @picks4all.com
- ✅ **Better deliverability:** Own domain reputation > shared sandbox
- ✅ **Brand consistency:** All touchpoints say "Picks4All"
- ✅ **Free:** Resend domain verification is included in free tier
- ✅ **No conflict with Cloudflare Email Routing:** Only TXT records needed (not MX)

### Consequences

**Positive:**
- ✅ Professional sender address
- ✅ Better email deliverability
- ✅ Consistent branding across all emails

**Negative:**
- ⚠️ Need to monitor SPF/DKIM records if DNS changes
- ⚠️ Initial warm-up period for new domain reputation

### Implementation

1. Resend Dashboard → Add domain `picks4all.com`
2. Add SPF TXT record to Cloudflare DNS
3. Add DKIM TXT records (2-3 records) to Cloudflare DNS
4. Wait for verification
5. Update Railway env var: `RESEND_FROM_EMAIL=noreply@picks4all.com`
6. Update `backend/src/lib/email.ts`: APP_NAME → "Picks4All"
7. Update `backend/src/lib/emailTemplates.ts`: BRAND.name, supportEmail

---

## Future Decisions (To Be Documented)

**v0.3.0:**
- [x] ADR-027: Cumulative Scoring System ✅ (2026-01-18)
- [x] ADR-028: Rate Limiting Strategy ✅ (2026-01-18)
- [x] ADR-029: Internal Notification System ✅ (2026-01-18)

**v0.3.2:**
- [x] Email verification on registration ✅ (2026-01-26) — implemented without separate ADR

**v0.3.3:**
- [x] ADR-030: Slide-in Auth Panel ✅ (2026-02-01)

**v0.3.4:**
- [x] ADR-031: Automatic Results via API-Football ✅ (2026-02-04)
- [x] ADR-032: Smart Sync - Optimized API Polling ✅ (2026-02-04)

**v0.3.5:**
- [x] Comprehensive Code Review ✅ (2026-02-10) — findings documented in CURRENT_STATE.md

**v0.4.0:**
- [x] ADR-033: Next.js Migration ✅ (2026-02-13)

**v0.6.0:**
- [x] ADR-034: Cloudflare Email Routing for Incoming Email ✅ (2026-03-01)
- [x] ADR-035: Corporate Pool Feature — MVP Approach ✅ (2026-03-01)
- [x] ADR-036: Lemon Squeezy as Merchant of Record ✅ (2026-03-01)
- [x] ADR-037: Resend Domain Verification for Production Email ✅ (2026-03-01)

**v1.0:**
- [ ] ADR-038: PWA + Service Worker
- [ ] ADR-039: Redis caching layer

**v2.0:**
- [ ] ADR-040: Multi-sport support architecture
- [ ] ADR-041: WebSocket for real-time updates
- [ ] ADR-042: Facebook/Apple OAuth providers

---

**END OF DOCUMENT**
