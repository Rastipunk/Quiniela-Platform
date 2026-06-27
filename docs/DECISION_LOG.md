# Architectural Decision Log (ADL)
# Picks4All

> **Purpose:** Record all significant architectural, technical, and product decisions with context and rationale.
>
> **Format:** Each decision includes: Context, Decision, Rationale, Consequences, Alternatives Considered, Status
>
> **Last Updated:** 2026-05-28

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
| [031](#adr-031-automatic-results-via-api-football) | Automatic Results via API-Football | Superseded by ADR-052 | 2026-02-04 |
| [032](#adr-032-smart-sync---optimized-api-polling-strategy) | Smart Sync - Optimized API Polling Strategy | Accepted | 2026-02-04 |
| [033](#adr-033-nextjs-migration-ssr--seo) | Next.js Migration (SSR + SEO) | Accepted | 2026-02-13 |
| [034](#adr-034-cloudflare-email-routing-for-incoming-email) | Cloudflare Email Routing for Incoming Email | Accepted | 2026-03-01 |
| [035](#adr-035-corporate-pool-feature--self-service-mvp) | Corporate Pool Feature — Self-Service MVP | Accepted | 2026-03-01 |
| [036](#adr-036-lemon-squeezy-as-merchant-of-record) | Lemon Squeezy as Merchant of Record | Superseded by ADR-044 | 2026-03-01 |
| [037](#adr-037-resend-domain-verification-for-production-email) | Resend Domain Verification for Production Email | Accepted | 2026-03-01 |
| [038](#adr-038-limpieza-de-código-y-documentación-v060) | Limpieza de Código y Documentación v0.6.0 | Accepted | 2026-03-17 |
| [039](#adr-039-security--infrastructure-audit) | Security & Infrastructure Audit | Accepted | 2026-03-18 |
| [040](#adr-040-wc-2026-instance-rebuild-with-api-data) | WC 2026 Instance Rebuild with API Data | Accepted | 2026-04-03 |
| [041](#adr-041-centralized-branding-system) | Centralized Branding System | Accepted | 2026-04-04 |
| [042](#adr-042-eliminate-hardcoded-values-4-audit-rounds) | Eliminate Hardcoded Values (4 Audit Rounds) | Accepted | 2026-04-04 |
| [043](#adr-043-api-first-results-with-host-override) | API-First Results with Host Override | Superseded by ADR-052 | 2026-04-04 |
| [044](#adr-044-polarsh-as-payment-processor-replacing-lemon-squeezy) | Polar.sh as Payment Processor (replacing Lemon Squeezy) | Accepted | 2026-04-13 |
| [045](#adr-045-per-user-invitation-rate-limit-capacity-threshold-notifications) | Per-user invitation rate limit; capacity-threshold notifications | Accepted | 2026-05-01 |
| [046](#adr-046-webhook-retry-contract-5xx-on-error-throw-on-orphan) | Webhook retry contract (5xx-on-error, throw-on-orphan) | Accepted | 2026-05-03 |
| [047](#adr-047-html-escape-strategy-for-email-templates-defence-at-render-time) | HTML escape strategy for email templates | Accepted | 2026-05-03 |
| [048](#adr-048-magic-link-session-mismatch-defence) | Magic-link session-mismatch defence | Accepted | 2026-05-03 |
| [049](#adr-049-corporate-wizard--drop-the-invite-employees-step) | Corporate wizard — drop the "invite employees" step | Accepted | 2026-05-03 |
| [050](#adr-050-per-invite-resend-with-token-rotation) | Per-invite resend with token rotation | Accepted | 2026-05-03 |
| [051](#adr-051-usd-cents-vs-cop-pesos-field-discipline) | USD-cents vs COP-pesos field discipline | Accepted | 2026-05-03 |
| [052](#adr-052-scraper-first-results-picks4all-scores-as-primary-api-football-as-fallback) | Scraper-first results (picks4all-scores primary; API-Football fallback) | Accepted | 2026-05-03 |
| [053](#adr-053-mercado-pago-for-colombia-dual-gateway-routing) | Mercado Pago for Colombia (dual-gateway routing) | Accepted | 2026-04-14 |
| [054](#adr-054-server-side-analytics-with-dlq--advisory-locked-drainer) | Server-side analytics with DLQ + advisory-locked drainer | Accepted | 2026-05-03 |
| [055](#adr-055-email-suppression-via-resend-webhook) | Email suppression via Resend webhook | Accepted | 2026-05-03 |
| [056](#adr-056-organization-branding-edits-with-audit-trail) | Organization branding edits with audit trail | Accepted | 2026-05-03 |
| [057](#adr-057-admin-analytics-dashboard-with-saferun-fault-tolerance) | Admin analytics dashboard with safeRun fault tolerance | Accepted | 2026-05-03 |
| [058](#adr-058-editable-scoring-rules-with-auto-revert-active--draft) | Editable scoring rules with auto-revert ACTIVE → DRAFT | Accepted | 2026-05-11 |
| [059](#adr-059-estratega-is-100-scraper-driven-host-only-intervenes-for-overrides) | Estratega is 100% scraper-driven; host only intervenes for overrides | Accepted | 2026-05-11 |
| [060](#adr-060-payment-funnel-observability--initiated-state-every-event-audit-log-reconciler) | Payment funnel observability — INITIATED state, audit log, reconciler | Accepted | 2026-05-21 |
| [061](#adr-061-sales-management--quotes-cuentas-de-cobro-and-cc-redemption-checkout-path) | Sales Management — quotes, cuentas de cobro, CC-redemption checkout | Accepted | 2026-05-26 |
| [062](#adr-062-corporate-invitation-locale) | Corporate invitation locale | Accepted | 2026-05-26 |
| [063](#adr-063-welcome-email-locale-handoff) | Welcome email locale handoff | Accepted | 2026-05-26 |
| [064](#adr-064-locale-resolution-architecture) | Locale resolution architecture | Accepted | 2026-05-26 |
| [065](#adr-065-mercado-pago--polar-payment-completion-parity) | Mercado Pago / Polar payment-completion parity | Accepted | 2026-05-28 |
| [066](#adr-066-payment-attempt-client-side-telemetry-mp-brick-visibility) | Payment-attempt client-side telemetry (MP Brick visibility) | Accepted | 2026-05-28 |

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
├── frontend-next/
│   ├── package.json
│   └── src/
├── docs/
└── CLAUDE.md
```

Each package has its own `package.json` and runs independently.

> **Update (ADR-033):** The original Vite SPA at `frontend/` was retired and replaced by the Next.js App Router app at `frontend-next/`. Early ADRs that reference `frontend/src/...` paths now resolve under `frontend-next/src/...`.

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
**Status:** Accepted (delivery mechanism superseded in part by ADR-064)
**Deciders:** Product Team
**Tags:** #security #authentication

> **Update:** The HS256 / 4-hour-expiry JWT decision below still holds (`backend/src/lib/jwt.ts` — `expiresIn: "4h", algorithm: "HS256"`). What changed is *delivery*: tokens are no longer carried by the client in an `Authorization` header or `localStorage`. They are issued as **httpOnly cookies** via `setAuthCookies` / `clearAuthCookies` (`backend/src/lib/authCookies.ts`), and the legacy `quiniela.token` localStorage key is treated as `LEGACY_TOKEN_KEY` and cleared on first load (`frontend-next/src/lib/auth.ts`). The "Token theft risk (XSS)" negative is mitigated by the httpOnly flag. ADR-064 also writes a `NEXT_LOCALE` cookie alongside the auth cookies. The "Implementation Notes" snippet below reflects the original header-based design and is retained for historical context.

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

The "no Redux/Zustand" decision still holds. The auth-state snippet below is **historical** — it describes the Vite-era `localStorage` + custom-event pattern. Since the httpOnly-cookie migration (ADR-064), the session token is no longer read from `localStorage`; `quiniela.token` is now a `LEGACY_TOKEN_KEY` cleared on first load (`frontend-next/src/lib/auth.ts`), and auth state is consumed via the `useAuth` hook backed by cookie-authenticated `/users/me` calls.

**Auth state (historical, Vite SPA):**
```typescript
// lib/auth.ts
const TOKEN_KEY = 'quiniela.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Custom event for auth changes
window.dispatchEvent(new CustomEvent('quiniela:auth'));
```

**App.tsx (historical):**
```typescript
const [token, setToken] = useState(getToken());

useEffect(() => {
  const handler = () => setToken(getToken());
  window.addEventListener('quiniela:auth', handler);
  return () => window.removeEventListener('quiniela:auth', handler);
}, []);
```

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
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx`

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
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx` - Penalty input UI for draws

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
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx` - Toggle UI in admin panel

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
- `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/page.tsx` - Lock/unlock buttons in admin panel

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
- ⚠️ ~~No rate limiting (user can spam reset requests)~~ — superseded by ADR-028, which adds a 5/hour password-reset limiter

**Risks:**
- ⚠️ Email deliverability issues (spam filters)
- ⚠️ Token brute-force (mitigated by 1-hour expiration + 32-byte randomness)
- ⚠️ Denial of service (spam reset requests to victim email) — mitigated with rate limiting

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
**Status:** Accepted (setup details updated for Next.js — see note)
**Deciders:** Product Team, Engineering Team
**Tags:** #authentication #oauth #user-experience #google

> **Update (ADR-033):** This ADR was written during the Vite SPA era. The decision (server-side ID-token verification via `google-auth-library`, `POST /auth/google`, account linking, auto-generated usernames) is unchanged and current. Only the frontend wiring moved to Next.js: the client ID env var is `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (not `VITE_GOOGLE_CLIENT_ID` / `import.meta.env`), there is no `localhost:5173` origin, and the token is now returned as an httpOnly cookie rather than handed back in the response body (ADR-064). Configuration steps live in `docs/guides/GOOGLE_OAUTH.md`. The Vite-flavoured snippets below are retained for historical context.

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

# frontend-next/.env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abc...xyz.apps.googleusercontent.com
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

**Frontend ([login/page.tsx](../../frontend-next/src/app/[locale]/login/page.tsx)):**
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

See [guides/GOOGLE_OAUTH.md](guides/GOOGLE_OAUTH.md) for detailed instructions on:
1. Creating a Google Cloud project
2. Configuring OAuth consent screen
3. Creating OAuth 2.0 credentials
4. Adding authorized origins
5. Testing the flow

**Quick Start:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable OAuth
3. Create OAuth 2.0 Client ID (Web application)
4. Add the local dev origin (Next.js default `http://localhost:3000`) to authorized origins
5. Set `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) in `.env`
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
- `frontend-next/src/components/PoolConfigWizard.tsx` - Preset cards
- `frontend-next/src/components/PickRulesDisplay.tsx` - Explicación por modo
- `frontend-next/src/components/PlayerSummary.tsx` - Breakdown visual

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
- `frontend-next/src/components/AuthSlidePanel.tsx` - Panel principal con toda la lógica

**Componentes modificados:**
- `frontend-next/src/components/PublicNavbar.tsx` - Botón "Ingresar" abre panel
- `frontend-next/src/components/PublicLayout.tsx` - Maneja estado del panel
- `frontend-next/src/app/[locale]/layout.tsx` - Root layout con auth state

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
**Status:** Superseded by ADR-052 (scraper-first re-classifies API-Football as fallback). The hybrid MANUAL/AUTO framework, the per-result `ResultSource` discriminator, and the host-override semantics described below remain in force.
**Deciders:** Product Team, Engineering Team
**Tags:** #api #automation #results #integration #superseded

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

## ADR-035: Corporate Pool Feature — Self-Service MVP

**Date:** 2026-03-01
**Status:** Accepted (Implemented)
**Deciders:** Product Team
**Tags:** #feature #corporate #architecture

### Context

Companies want to organize prediction pools for their employees as team-building activities. This requires:
- A way for companies to discover and contact us
- Customization (company logo on pool)
- Bulk user creation (employees don't have accounts)
- Organization tracking
- Self-service flow (no admin intervention)

### Decision

Implement a **self-service MVP** with full end-to-end flow:

1. **Public enterprise landing page** (`/empresas`) with CTA and contact form
2. **Database models** — `Organization` (company info + logo + messages), `OrganizationInquiry` (contact form), `CorporateInvite` (employee invitations with activation tokens)
3. **CORPORATE_HOST role** — New PoolMemberRole for the company representative who manages the corporate pool
4. **6-step guided wizard** (`/empresas/crear`) — Company info → Tournament → Pool details → Scoring → Employees → Summary
5. **Employee invitation flow** — CSV upload or manual entry → Email invitations with activation tokens (30-day expiry)
6. **Token-based activation** (`/activar?token=...`) — Employee creates password, enters pool automatically

**Workflow:** Company fills wizard → Pool created → Employees invited via email → Employees activate accounts → Pool auto-activates.

### Rationale

- ✅ **Fully self-service:** No admin intervention required
- ✅ **Guided experience:** 6-step wizard prevents confusion
- ✅ **CSV support:** Bulk employee import for large companies
- ✅ **Token activation:** Employees don't need to know pool codes
- ✅ **Extensible:** Organization model supports future premium features

### Consequences

**Positive:**
- ✅ Companies can set up pools independently
- ✅ Employee onboarding is frictionless (email → click → set password → play)
- ✅ Logo stored as base64 (no external hosting needed)
- ✅ Database ready for branding features (splash, personalized emails)

**Negative:**
- ⚠️ Logo as base64 increases DB size (mitigated by client-side compression)
- ⚠️ No company admin dashboard yet (CORPORATE_HOST manages via pool page)

### Implementation (Completed)

**Backend:**
- `backend/src/routes/corporate.ts` — 7 endpoints (inquiry, pools, employees, invitations, CSV template)
- `backend/src/routes/auth.ts` — POST /auth/activate-corporate
- `backend/src/lib/email.ts` — sendCorporateActivationEmail, sendCorporateInquiryConfirmationEmail
- `backend/prisma/schema.prisma` — Organization, OrganizationInquiry, CorporateInvite models

**Frontend:**
- `frontend-next/src/components/EnterpriseLandingContent.tsx` — Landing page
- `frontend-next/src/components/CorporatePoolCreation.tsx` — 6-step wizard
- `frontend-next/src/components/ActivationContent.tsx` — Employee activation

### Future Evolution (v0.7+)

- Pool branding: splash welcome screen + persistent logo header
- Personalized emails with company logo + custom invitation message
- invitationMessage field in Organization model
- Company admin dashboard
- SSO integration (SAML/OIDC)
- Billing portal for corporate accounts

---

## ADR-036: Lemon Squeezy as Merchant of Record

**Date:** 2026-03-01
**Status:** **Superseded by ADR-044.** Lemon Squeezy rejected our application; Polar.sh replaced it as MoR for international USD payments.
**Deciders:** Product Team
**Tags:** #payments #business #superseded

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

## ADR-038: Limpieza de Código y Documentación v0.6.0

**Date:** 2026-03-17
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #maintenance #documentation #cleanup

### Context

Tras completar el Corporate Self-Service MVP (v0.6.0), se realizó una auditoría exhaustiva del repositorio para identificar código muerto, archivos huérfanos y documentación desactualizada.

### Decision

Realizar limpieza de código y actualización completa de documentación:
1. Eliminar archivos huérfanos y código muerto
2. Actualizar todos los documentos SoT a estado actual
3. Agregar endpoints y términos faltantes en la documentación

### Rationale

La documentación es la fuente de verdad del proyecto. Mantenerla actualizada reduce el riesgo de decisiones basadas en información obsoleta y facilita el onboarding de nuevos colaboradores.

### Consequences

**Positive:**
- ✅ Documentación 100% sincronizada con el código
- ✅ Eliminados 18 MB de artefactos innecesarios
- ✅ Removido código muerto (wc2026Sandbox.ts, createResourceLimiter)
- ✅ Endpoints faltantes documentados en API_SPEC.md
- ✅ Términos corporativos agregados al GLOSSARY.md

**Negative:**
- ⚠️ Requiere disciplina continua para mantener sincronización

### Implementation Notes

**Archivos eliminados:**
- `backend/src/wc2026Sandbox.ts` — exportaba función sin importar
- `createResourceLimiter` en `middleware/rateLimit.ts` — rate limiter sin uso
- `.railwayignore` (raíz) — artefacto Windows
- `.tmp.driveupload/` — 18 MB de artefactos Google Drive

**Documentos actualizados:**
- CURRENT_STATE.md, PRD.md, API_SPEC.md, ARCHITECTURE.md, DATA_MODEL.md, GLOSSARY.md, DECISION_LOG.md, CLAUDE.md

### Related Decisions
- ADR-035 (Corporate Pool Feature)
- ADR-037 (Resend Domain Verification)

---

## ADR-039: Security & Infrastructure Audit

**Date:** 2026-03-18
**Status:** Accepted
**Deciders:** Product Team
**Tags:** #security #infrastructure #ci-cd #accessibility

### Context

A comprehensive audit of the entire codebase (frontend, backend, infrastructure) identified 20 findings across critical, high, medium, and low severity. Key concerns: exposed API keys in local `.env`, no process-level error handlers, no CI/CD pipeline, missing error boundaries, no request timeout, and accessibility gaps.

### Decision

Address all critical and high severity findings immediately, medium findings in the same session, and defer low-priority items (PoolPage refactor, token revocation, comprehensive test coverage) to dedicated sessions.

### Rationale

The platform is approaching its April 1st launch. Critical security and stability fixes cannot wait. Infrastructure improvements (CI/CD, Dependabot, structured logging) provide immediate value and prevent regressions. Accessibility improvements align with professional standards.

### Consequences

**Positive:**
- ✅ API keys rotated, exposure eliminated
- ✅ Process won't crash silently on unhandled errors
- ✅ CI pipeline catches type errors and test failures before deploy
- ✅ Dependabot alerts on vulnerable dependencies weekly
- ✅ Error boundaries prevent full-page crashes for users
- ✅ API requests fail gracefully after 30s instead of hanging
- ✅ WCAG 2.1 AA focus indicators and skip-to-content
- ✅ Structured logging enables future log aggregation (Sentry, Datadog)
- ✅ NavBar no longer spams API on every navigation
- ✅ XSS protection on translated HTML content

**Negative:**
- ⚠️ `pools.ts` and `groupStandings.ts` still have `any` types
- ⚠️ PoolPage (720 lines) deferred — functional but hard to maintain
- ⚠️ No Sentry yet — requires account setup

### Files Created
- `backend/src/lib/logger.ts` — Structured logging module
- `frontend-next/src/lib/sanitize.ts` — HTML sanitizer for translated content
- `frontend-next/src/app/[locale]/error.tsx` — Public error boundary
- `frontend-next/src/app/[locale]/(authenticated)/error.tsx` — Authenticated error boundary
- `.github/workflows/ci.yml` — CI pipeline
- `.github/dependabot.yml` — Dependency scanning

### Files Modified
- `backend/src/server.ts` — Logger + unhandled rejection/exception handlers
- `frontend-next/src/lib/api/client.ts` — 30s timeout with AbortController
- `frontend-next/src/lib/api/picks.ts` — Full type safety rewrite
- `frontend-next/src/lib/api/corporate.ts` — Replaced `any` types
- `frontend-next/src/types/pickConfig.ts` — `Record<string, unknown>` instead of `any`
- `frontend-next/src/components/AuthSlidePanel.tsx` — ARIA dialog attributes
- `frontend-next/src/components/NavBar.tsx` — SessionStorage profile cache
- `frontend-next/src/components/RegionalArticlePage.tsx` — sanitizeHtml() wrapper
- `frontend-next/src/app/[locale]/layout.tsx` — Skip-to-content link
- `frontend-next/src/app/[locale]/(authenticated)/layout.tsx` — `id="main-content"`
- `frontend-next/src/app/globals.css` — `:focus-visible` indicators
- `frontend-next/src/messages/{es,en,pt}/common.json` — Error boundary translations

### Related Decisions
- ADR-038 (Code Cleanup v0.6.0)
- ADR-028 (Rate Limiting Strategy)

---

## ADR-040: WC 2026 Instance Rebuild with API Data

**Date:** 2026-04-03 | **Status:** Accepted

**Context:** The WC 2026 tournament instance had placeholder teams (TBD), incorrect bracket structure, and no API-Football integration. The seed used fake kickoff times and venues.

**Decision:** Rebuild the entire WC 2026 seed from API-Football data:
- Replace all 7 placeholder teams with confirmed qualifiers (verified against ESPN, FIFA.com, NBC Sports)
- Rebuild 72 group matches with real kickoff times, venues, home/away from API
- Correct R32 bracket to match official FIFA structure (was using simplified sequential bracket)
- Fix R16/QF/SF connections to follow FIFA bracket paths
- Add `apiFootballId` to team schema for API sync
- Create MatchExternalMapping + MatchSyncState for all group fixtures
- Configure instance as AUTO mode (league=1, season=2026)

**Consequences:** WC 2026 instance is now production-ready for automatic result sync when matches begin in June 2026.

---

## ADR-041: Centralized Branding System

**Date:** 2026-04-04 | **Status:** Accepted

**Context:** Brand colors (#667eea, #764ba2, #4f46e5) were duplicated across ~30 frontend files and backend email templates. Changing a brand color required modifying dozens of files across both services.

**Decision:** Create `lib/brand.ts` in both frontend and backend as single source of truth:
- Frontend: `brand.ts` → consumed by `theme.ts`, `siteConfig.ts`, icon files, OG images
- Backend: `brand.ts` → consumed by `emailTemplates.ts`, `email.ts` (runtime override via `BRAND_COLORS_JSON` env var)
- Future brand assets (logo URL, icon URL) will be added to `brand.ts` and propagate automatically

**Consequences:** Brand changes require editing ONE file per service. Backend supports runtime rebranding without redeploy.

---

## ADR-042: Eliminate Hardcoded Values (4 Audit Rounds)

**Date:** 2026-04-04 | **Status:** Accepted

**Context:** Comprehensive audit found 28+ hardcoded values across the codebase including domain names (52 files), email addresses, rate limits, sync windows, pricing, and pool IDs.

**Decision:** Systematic elimination across 4 rounds:
- Round 1: Domain → SITE_URL/SITE_DOMAIN env vars, pool IDs → muteReminders DB field, rate limits → env vars, sync windows → MATCH_SYNC constants
- Round 2: Pricing → NEXT_PUBLIC env vars, locales → SUPPORTED_LOCALES constant, phase names → i18n
- Round 3: Magic numbers → constants.ts (pagination, user rules, reserved usernames), validation → shared schemas
- Round 4: Brand colors → brand.ts, CSP legacy URL removed

**Principles established:**
- Primary data source = API/DB. Static mappings only as fallback.
- Every env var has a sensible default.
- Frontend validation mirrors backend Zod schemas via centralized `validation.ts`.

---

## ADR-043: API-First Results with Host Override

**Date:** 2026-04-04 | **Status:** Superseded by ADR-052. The host-override constraints (mandatory reason, member email, version immutability) and the "no manual publishing in AUTO mode" rule remain in force; the "results come from API-Football" framing is now "results come from the scraper-first pipeline (picks4all-scores primary, API-Football fallback)".

**Context:** Hosts could publish match results manually at any time. This created data integrity risks and inconsistency with the SmartSync automatic results system.

**Decision:**
- Block manual result publishing in AUTO mode. Results come exclusively from API-Football via SmartSync.
- After API publishes a result, host CAN override with: mandatory reason + warning banner + email notification to ALL active pool members.
- Each override creates a new PoolMatchResultVersion with source=HOST_OVERRIDE.
- Legacy MANUAL mode instances are exempt (backwards compatibility).
- "In play" badge shown when MatchSyncState is IN_PROGRESS.

**Consequences:** Results are authoritative from API. Host overrides have full audit trail and transparency. All members are informed of any manual changes.

---

## ADR-044: Polar.sh as Payment Processor (replacing Lemon Squeezy)

**Date:** 2026-04-13 | **Status:** Accepted

**Context:** Lemon Squeezy (ADR-036) rejected our application. We needed an alternative Merchant of Record that supports Colombia-based businesses, handles taxes/compliance, and allows one-time payments in USD.

**Decision:**
- Use Polar.sh as Merchant of Record for pool capacity upgrades.
- One-time payments only (not subscriptions). HOST pays to expand pool capacity beyond the free limit.
- Pricing: $7.99/block of 50 players, declining $0.40 every 2 blocks, minimum $4.99/block. Corporate: $49.99 base for 100 players.
- Currency: USD only (COP deferred to a future local payment gateway for Colombia).
- Integration: `@polar-sh/sdk` for checkout creation, `@polar-sh/express` for webhook signature verification.
- Pool is created at free limit initially. If user selected a paid tier, checkout is initiated post-creation and capacity expands on `order.paid` webhook.
- Two checkout entry points: (1) pool creation wizard when capacity > free limit, (2) pool admin panel to expand existing pool.
- Database: `PoolPayment` (checkout tracking) + `PaymentEvent` (immutable webhook audit log).
- Idempotency: unique constraints on `polarCheckoutId` and `polarEventId`.
- Price computed server-side only — client sends `targetCapacity`, never the price.

**Consequences:**
- ✅ Polar approved, no compliance burden (MoR handles taxes)
- ✅ SDK with Express adapter + built-in webhook verification
- ✅ Ad-hoc pricing allows dynamic amounts per checkout
- ⚠️ Hosted checkout (redirect, not inline) — acceptable tradeoff
- ⚠️ USD only for now — Colombian users pay in USD until local gateway is added

---

## ADR-045: Per-user invitation rate limit; capacity-threshold notifications

**Date:** 2026-05-01 | **Status:** Accepted

**Context:** The legacy `corporateInviteLimiter` capped any request to `/corporate/pools/*` at 5/hour per IP. Three problems compounded:

1. **Wrong unit.** GETs (load pool, list employees, refresh) shared the same bucket as POST sends. Hosts hit the limit just by navigating their own pool.
2. **Wrong key.** Per-IP collided co-hosts on the same office network and rate-limited the host's own static IP regardless of the action.
3. **Wrong threshold.** 5/hour was unusable for any rollout above a handful of employees, while paradoxically not actually defending against the threat model (a compromised account could still send 5/hour from a legitimate IP).

Separately, the existing `POOL_FULL` notification fired only at 100% capacity, with no early warning to the host that they were running out of slots, and no signal at all when someone tried to join a full pool.

**Decision:**

1. **Rate limit redesign.** Drop the catch-all on `/corporate/pools/*`. Introduce two per-user limiters applied only at `POST /corporate/pools/:poolId/send-invitations`:
   - `inviteSendLimiter` — 200/hour per user (env `RATE_LIMIT_INVITE_SEND_MAX`).
   - `inviteSendDailyLimiter` — 1000/day per user (env `RATE_LIMIT_INVITE_SEND_DAILY_MAX`).
   Bucket key: `req.auth.userId`, falling back to `ipKeyGenerator(req.ip)` (IPv6-safe per express-rate-limit guidance).

2. **Capacity-threshold notifications.** Single function `checkAndNotifyCapacityThresholds()` runs after every successful join (corporate activation + regular pool invite) and dispatches at most one of:
   - `CAPACITY_WARNING` email at the configurable threshold (default 95%, overridable per pool via `Pool.capacityWarningThresholdPct`).
   - `POOL_FULL` email at 100%.
   Both deduped via `updateMany WHERE flag IS NULL` against `Pool.capacityWarningNotifiedAt` / `Pool.poolFullNotifiedAt`. Flags re-armed in `paymentService` whenever capacity expands, so notifications fire again if the pool refills.

3. **Blocked-attempt notification.** When a join is rejected with `POOL_FULL`, the host receives `BLOCKED_JOIN_ATTEMPT` email (subject lists the attempting email). Throttled per-pool via `Pool.lastBlockedAttemptNotifiedAt` (env `BLOCKED_ATTEMPT_THROTTLE_HOURS`, default 24h) so a flood of failed joins (bots, link-share storms) produces at most one email per window. Audit event fires unconditionally.

4. **Member count definition.** Both `ensurePoolCapacity` and `checkAndNotifyCapacityThresholds` count `ACTIVE + PENDING_APPROVAL`. Previously the join-block used both but the pool-full notification used `ACTIVE` only — pools with pending approvals could refuse joins without ever notifying the host they were at capacity.

**Consequences:**
- ✅ Hosts can run 200-employee rollouts without hitting any limit.
- ✅ Co-hosts on the same network no longer collide.
- ✅ Host gets early warning at 95%, decides whether to expand before the cap.
- ✅ Host learns about demand for a full pool (blocked attempts) without spam.
- ✅ Capacity definition consistent across enforcement and notification.
- ⚠️ Two new nullable columns on `Pool` (additive migrations, no backfill).
- ⚠️ `RATE_LIMIT_CORP_INVITE_MAX` / `RATE_LIMIT_CORP_INVITE_WINDOW_MS` env vars no longer read; safe to delete from prod.

**Related code:** `backend/src/lib/poolCapacity.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/lib/emailTemplates.ts` (new `getCapacityWarningTemplate`, `getBlockedJoinAttemptTemplate`), migrations `20260502_add_capacity_warning_fields` + `20260502_add_blocked_attempt_notify`.

---

## ADR-046: Webhook retry contract (5xx-on-error, throw-on-orphan)

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** Polar and Mercado Pago webhooks were silently dropping pagos in two failure modes:

1. **DB / network blip during processing.** The handler caught the error, logged it, and returned `200 received: true, error: "Processing failed"` with the explicit comment "Return 200 anyway to prevent Polar from retrying on our errors." This was paranoia mis-applied — the inner code is idempotent at `PaymentEvent.polarEventId` UNIQUE, so retries are safe. The 200 caused the gateway to dequeue the event and never come back. Customer paid into nothing.

2. **PoolPayment row not yet committed when the webhook arrived.** A 50-200ms race between `initiateCheckout` returning and the gateway firing its first webhook. `findUnique` returned null, the handler did `console.error(...); return;`, route returned 200, gateway dequeued. Same outcome.

The audit (round 4 grupo B) confirmed both via code reading and a grep through past payment metrics.

**Decision:**

1. **Wrap the catch block to return 5xx for everything except signature errors.** Polar and MP both use exponential backoff on 5xx. Idempotency at the `PaymentEvent.polarEventId` UNIQUE constraint guarantees that successful retries dedupe correctly; failed retries roll the slot back atomically (see ADR-046b below). Signature errors stay 401 — those won't get fixed by retry.

2. **Throw `PAYMENT_NOT_FOUND_RETRYABLE` instead of returning silently** when the local `PoolPayment` row isn't found. The throw happens BEFORE the handler claims the `PaymentEvent` slot, so a retry isn't dedup-skipped. After the gateway exhausts its retry budget the event lands in their DLQ for human triage — the right outcome for a genuinely orphan webhook.

3. **Add MP webhook timestamp drift validation.** MP's HMAC includes a timestamp but the verification function never compared it to `Date.now()`. An attacker who captured a valid webhook (mirrored TLS, proxy logs, screenshots) could replay it indefinitely. Fixed: reject anything outside `MP_WEBHOOK_MAX_DRIFT_MS` (default 5 min, env-overridable). Auto-detects seconds vs ms units (MP's docs example shows seconds; ms is forward-compat).

4. **Make the MP eventId include the payment status.** Previously the ID was `mp-${paymentId}`, so when MP fired multiple webhooks for the same payment (`pending → in_process → approved`), the FIRST one consumed the only slot and the `approved` was deduped silently — pool stuck in PENDING. Now the ID is `mp-${paymentId}-${status}`; each transition gets its own slot, while genuine retries of the SAME status still dedupe.

**ADR-046b — sub-decision (atomic claim):** the `PaymentEvent.create` call now lives INSIDE the same `$transaction` as the `PoolPayment.update` + `Pool.update`. Previously it ran first as a standalone INSERT, so a tx failure mid-flight left the slot persisted and blocked retries. Both Polar (`handleOrderPaid` / `handleOrderRefunded`) and MP (`handleMpWebhook` per branch) follow this pattern.

**Consequences:**
- ✅ Cero pagos perdidos por blips transitorios — gateway retries until the row exists.
- ✅ Replay attack window on MP closed (was infinite, now 5 min).
- ✅ MP async payments (PSE / Nequi) reliably transition to COMPLETED.
- ⚠️ Slightly more 5xx noise in observability when the DB blips. Monitoring threshold may need adjustment.
- ⚠️ Genuine orphan events (test webhooks, deleted PoolPayments) consume retry budget before landing in DLQ. Acceptable trade-off; happens rarely.

**Related code:** `backend/src/services/paymentService.ts` (handleOrderPaid + handleOrderRefunded + handleMpWebhook), `backend/src/routes/payments.ts` (Polar + MP webhook handlers).

---

## ADR-047: HTML escape strategy for email templates (defence at render time)

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** The original template code interpolated host-controlled values (`companyName`, `poolName`, `displayName`, etc.) directly into HTML without escaping. Two attack vectors materialised:

1. The `/corporate/inquiry` confirmation email is sent by a PUBLIC endpoint. An attacker submits an inquiry with `companyName: "<script>...</script>"` and `contactEmail: "victim@target.com"`; the resulting confirmation email arrives at the victim's inbox SIGNED BY OUR DOMAIN with arbitrary HTML.

2. The corporate activation email is sent by a legitimate host. The host registers an "organization" with HTML payload in `companyName`, then mass-invites employees — each receives a phishing-grade email that looks like it came from us.

A scattered approach (escape some inputs at persistence time, leave others raw at render time) had already created bugs (double-escape on `welcomeMessage` / `invitationMessage`).

**Decision:**

- **Escape at render time, not at persistence time.** The DB stores user-controlled values raw; templates wrap each with `escapeHtml()` at the point of HTML interpolation. This is the standard for safe HTML emission because the rendering context is what matters — a value that's safe in JSON metadata is unsafe in `<p>` content, and a value that's safe in `<p>` is unsafe in `<img alt="...">`. Escaping at render makes the boundary explicit.

- **Cover EVERY user-controlled interpolation across all email templates**, not just the two flagged in the audit. The codebase has 17 email templates; we audited all of them and added `safeX` locals for `companyName`, `poolName`, `employeeName`, `displayName`, `memberName`, `inviterName`, `poolDescription`, `phaseName`, `matchDescription`, `result`, `reason`, `attemptedEmail`, `hostName`, and array-iterated `top10[].displayName` / `newMembers[].name`. Defence in depth — even templates with no flagged attack vector get the same treatment so the codebase doesn't drift back into "some are escaped, some aren't" inconsistency.

- **Keep the existing persistence-time escape on `welcomeMessage` / `invitationMessage`** (`corporateService.ts:286-287`). Belt-and-suspenders. The slight cosmetic overhead of double-escaping HTML special characters in user-typed messages (rare in normal use) is acceptable; reverting that escape in a separate refactor is non-blocking.

- **Extract `escapeHtml` to its own module** (`backend/src/lib/htmlSafe.ts`) to break a circular dependency: `email.ts` imports `emailTemplates.ts` (to send them); the templates import `htmlSafe.ts`. `email.ts` re-exports `escapeHtml` for back-compat with existing call sites.

**Consequences:**
- ✅ XSS via email is closed at the rendering boundary; new templates added in the future inherit the same escape pattern by convention.
- ✅ A regression test (`emailTemplates.xss.test.ts`) renders every template with a `<script>...</script>` payload as input and asserts the raw payload does NOT survive in the rendered HTML.
- ⚠️ Adding new template variables requires the author to remember to wrap with `safeX = escapeHtml(x)` and reference `safeX` in the JSX strings. Mitigated by code review + the regression test catching omissions.

**Related code:** `backend/src/lib/htmlSafe.ts` (new), `backend/src/lib/emailTemplates.ts` (17 templates), `backend/src/lib/emailTemplates.xss.test.ts` (regression).

---

## ADR-048: Magic-link session-mismatch defence

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** `POST /auth/activate-corporate` is a public endpoint that, on success, issues a fresh JWT for the user matched by `invite.email` and sets it as the auth cookie. The endpoint did not check whether the request already carried a valid auth cookie — so if Alice was logged in and clicked Bob's invite link (shared inbox, forwarded chat, accidental tab), her session was silently overwritten with Bob's. Three real risk scenarios:

1. UX confusion — Alice didn't ask to switch accounts but suddenly is Bob.
2. Family/shared device pivot — invite link forwarded by an attacker who controls Bob's email; if Alice was already logged in, opening the link takes over her browser session.
3. Multi-tenant test environments where a host has both an admin and a player account.

Magic-link auto-sign-in is a deliberate UX choice (ADR-N — see CLAUDE.md §1 corporate magic-link decision); we keep it as the default path. But silent identity replacement is a separate harm.

**Decision:**

- The `activate-corporate` route handler reads the auth cookie (if any) BEFORE calling the service. It passes the resolved `currentUserId` (or null) into `activateCorporateAccount`.
- The service compares the current user's email (case-insensitive) to `invite.email`. On mismatch it throws `ServiceError("SESSION_MISMATCH", 409, { currentUserEmail, inviteEmail })` — BEFORE issuing any new cookies, BEFORE marking the invite ACTIVATED, BEFORE adding the user to the pool.
- The frontend (`ActivationContent.tsx`) catches this error code and renders a dedicated panel: "You're signed in as X, this invite is for Y. [Sign out and continue]". The button calls the existing logout endpoint, clears the local token, and re-runs the activation handler — which now succeeds without a cookie.
- A null/expired/invalid cookie is treated as anonymous (no mismatch) so first-time visitors aren't blocked.

**Consequences:**
- ✅ Silent identity replacement is no longer possible. Alice keeps her session; Bob's invite waits for Bob.
- ✅ Frontend has explicit messaging instead of a confused "why am I logged in as someone else" experience.
- ⚠️ One extra `user.findUnique` per activation when a cookie is present. Negligible.

**Related code:** `backend/src/services/authService.ts` (activateCorporateAccount), `backend/src/routes/auth.ts` (activate-corporate handler), `frontend-next/src/components/ActivationContent.tsx` (mismatch UI), i18n keys `activation.sessionMismatchTitle/Desc/Cta/Busy` in ES/EN/PT.

---

## ADR-049: Corporate wizard — drop the "invite employees" step

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** The corporate pool creation wizard had a step (`StepEmployeeInvites`) where the host pasted a list of employee emails. Those emails became `CorporateInvite` rows when the pool was created. After creation, the host could ALSO add/remove/manage employees from the pool admin tab via `CorporateEmployeeManager`. Two sources of truth for the same operation produced:

- A wizard funnel that required a "list of all my emails ready" commitment up-front.
- Hosts mid-wizard cleaning their CSV and having to backtrack.
- A Summary step counting emails whose number had no impact on what could actually be invited later.
- Surface area for race conditions between the two paths.

**Decision:**

- Remove `StepEmployeeInvites` and `state.employeeEmails` from the wizard. The wizard ends at the Summary → Capacity → checkout flow.
- Pool is created with only the host as `CORPORATE_HOST`. ALL employee invitations are managed post-creation from the pool admin tab via `CorporateEmployeeManager`.
- The backend `createCorporatePool` endpoint still accepts an optional `emails` array for back-compat with any older callers, but the wizard never sends it.
- Pair this change with the new resend-invitation endpoint (ADR-050 below) so hosts have full lifecycle control over each invite from the same UI.

**Consequences:**
- ✅ Wizard is shorter and less commit-heavy.
- ✅ Single source of truth for invitation management.
- ✅ Race conditions between wizard preload and admin-tab additions disappear by construction.
- ⚠️ Hosts who used to upload a CSV during the wizard now upload it from the admin tab after creation. Same UI element (CSV import lives in `CorporateEmployeeManager`), one extra navigation step.

**Related code:** `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx`, `frontend-next/src/components/pool-wizard/PoolWizardContext.tsx`, `frontend-next/src/types/poolWizard.ts`, deleted `frontend-next/src/components/pool-wizard/steps/corporate/StepEmployeeInvites.tsx`.

---

## ADR-050: Per-invite resend with token rotation

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** Once a corporate invite hit `SENT` status, the host had no way to re-send it. Real failure modes (employee deleted the email, spam filter, address typo at the activation page, Resend transient bounce) had no recovery path other than deleting the row and re-adding the email — which generated a new token and was awkward to coordinate with the affected employee.

**Decision:**

- New endpoint `POST /corporate/pools/:poolId/employees/:inviteId/resend`. Authorised to `CORPORATE_HOST` only. Refused if `invite.status === "ACTIVATED"`.
- The resend ROTATES the activation token: a fresh `crypto.randomBytes(...)` token replaces the previous one in the same `updateMany WHERE status IN (PENDING, SENT, FAILED) SET status=PENDING, activationToken=<new>, activationTokenExpiresAt=now()+30d`. Any forwarded copy of the OLD email becomes useless after the resend was issued — defence-in-depth against leaked-email scenarios.
- The atomic claim guards against an activation race: if the employee just activated their account in another tab between our `findUnique` and `updateMany`, the count returns 0 and the endpoint surfaces `ALREADY_ACTIVATED` instead of dispatching a now-stale token.
- The resend reuses the same per-user rate limiters (`inviteSendLimiter` / `inviteSendDailyLimiter`) as the bulk send. A host cannot use this endpoint to bypass the bulk-send caps; both flows draw from the same per-user budget.
- Frontend: `CorporateEmployeeManager` shows a per-row "Reenviar" button on `SENT` invites and "Reintentar" on `FAILED` invites. `ACTIVATED` rows show no button.

**Consequences:**
- ✅ Real recovery path for the most common invite-delivery failures.
- ✅ Token rotation closes the "leaked email forever valid" gap.
- ✅ Bulk + individual share the rate budget so abuse paths converge.
- ⚠️ Audit trail must distinguish bulk send vs individual resend; emit `CORPORATE_INVITATION_RESENT` for the latter.

**Related code:** `backend/src/services/corporateService.ts` (resendInvitation), `backend/src/routes/corporate.ts` (route + rate limiters), `frontend-next/src/components/CorporateEmployeeManager.tsx` (per-row UI), `frontend-next/src/lib/api/corporate.ts` (client), i18n keys `pool.admin.employees.resend/retry/resendSuccess/resendFailed` in ES/EN/PT.

---

## ADR-051: USD-cents vs COP-pesos field discipline

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** `PoolPayment.amountUsd` stores USD CENTS (Polar's native unit). For Mercado Pago payments we ALSO need the actual COP pesos paid (MP has no sub-unit; pesos are integers). The original code stored both correctly (migration 20260421 added `amountCop`), but five different code paths read `payment.amountUsd` and emitted/displayed it as if it were pesos:

1. Receipt email to the customer — showed `$6.597 COP` when the customer's bank statement read `$260,000 COP`.
2. GA4 `refund` event — under-reported refunded revenue ~40×.
3. Meta CAPI `Refund` — same.
4. GA4 `refund` items[].price — same.
5. `getPaymentStatus()` consumed by the success page — showed cents-as-pesos.

Plus a bug in the corporate USD pricing function itself (the BE used `(target - CORPORATE_FREE_LIMIT) / INCREMENT` blocks counting from the free tier; the FE used `(target - 100) / INCREMENT` blocks counting from the first paid tier). For 100-employee corporate the BE charged $65.97 while the UI showed $49.99 — a 32% over-charge.

**Decision:**

- Single helper `mpPurchaseValue(payment)` is the ONLY way to read the COP amount for an MP payment. It prefers the persisted `amountCop` column; falls back to recomputing from `pricing.calculateUpgradePriceCop` for pre-migration rows where the column is null.
- All five sites that previously read `payment.amountUsd` for COP context now go through this helper. Visual / numeric parity verified by tests.
- The corporate USD pricing function `corporateCumulativePrice` was rewritten to mirror the COP version exactly: short-circuit at `capacity <= 100` returning `CORPORATE_BASE_PRICE_USD`, then count `extraBlocks = (capacity - 100) / INCREMENT` for tiers above 100. Regression tests assert BE-vs-FE parity at 100, 150, 200, 300.
- The MP `additional_info.unit_price` field sent to the gateway also moves to `mpPurchaseValue(payment)` (was USD cents, MP expects COP). Fixes a metadata-vs-charge mismatch that could trip MP's antifraud.

**Consequences:**
- ✅ Customer never sees a receipt amount mismatched from their bank statement.
- ✅ Refund analytics report the right magnitude in dashboards.
- ✅ MP antifraud sees consistent metadata.
- ✅ Corporate USD checkout charges exactly what the UI promised.

**Related code:** `backend/src/lib/pricing.ts` (`corporateCumulativePrice`), `backend/src/services/paymentService.ts` (5 sites), `backend/src/lib/pricing.test.ts` (regression).

---

## ADR-052: Scraper-first results (picks4all-scores as primary; API-Football as fallback)

**Date:** 2026-05-03 | **Status:** Accepted | **Supersedes:** ADR-031, ADR-043

**Context:** ADR-031 made API-Football the sole source of automatic results. Two operational facts pushed against this:

1. **Latency.** API-Football publishes finals minutes-to-tens-of-minutes after FT, sometimes longer for less-covered leagues. For a real-time leaderboard during a live World Cup match this is a UX cliff — users refresh and see nothing while every other live-score site has the goal.
2. **Cost & coverage gaps.** API-Football's free tier (100 req/day) is inadequate for production polling and the paid tier still rate-limits aggressively per league. Coverage of niche tournaments and friendlies is patchy.

We built `picks4all-scores`, a separate in-house scraper service, to ingest live scores from public scoreboard sites at ~15 s cadence. Once we had it producing reliable provisional scores, the question was whether to swap it in as primary OR run it as a "first impression" UI layer with API-Football still being the source of truth for finals.

**Decision:**

- **picks4all-scores is the primary live-scoring channel.** `liveScoresJob` polls it every 15 s during each match's live window and publishes a `PoolMatchResultVersion` with `source = SCRAPER_PROVISIONAL` for every score change. The scraper "owns" the in-play UX.
- **A grace period of `SCORES_GRACE_PERIOD_MS` (default 5 min) past full-time** allows the scraper to confirm its final before any finalisation. If the scraper still reports the same FT after the grace period, the result is upgraded to `API_CONFIRMED` (the source name predates the rename and is the canonical "final" tag — kept for backwards compat with downstream code that reads it).
- **API-Football becomes a fallback layer.** `smartSyncJob` continues to run for AUTO instances, but only publishes a result if the scraper has not already produced an `API_CONFIRMED` (or higher) version. The activation window (~30 min after estimated FT) is wide enough that a working scraper renders Smart Sync a no-op for that match, while a broken scraper run still produces a final — same SLA as before, just shifted to fallback.
- **Source hierarchy is enforced everywhere a result is written.** `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL`. Lower sources never overwrite higher ones; the `resultService` layer rejects the write rather than silently downgrading.
- **Kill switch:** `PlatformSettings.scoresServiceEnabled` (admin toggle, default false in dev / true in prod) — disables the scraper layer without redeploy. When off, Smart Sync silently becomes the primary again.
- **`SCRAPER_PROVISIONAL` added to `ResultSource` enum** (additive migration). All five values now coexist; older instances continue to use `HOST_MANUAL` / `HOST_PROVISIONAL` / `API_CONFIRMED` as before.

**Consequences:**

- ✅ Live scores arrive in seconds, not minutes — leaderboard updates feel real-time during matches.
- ✅ API-Football quota usage drops sharply (only one fallback poll per match, vs continuous live polling).
- ✅ Scraper outages degrade to ADR-031 behaviour — no user-visible failure.
- ⚠️ Two layers to monitor instead of one. Mitigated by `/admin/analytics-health` probe which checks both sinks.
- ⚠️ The `API_CONFIRMED` source name is now slightly misleading (the scraper, not API-Football, can produce it). Renaming would be a destructive enum change — left as is and clarified in this ADR + GLOSSARY.

**Related code:** `backend/src/services/scoresService/`, `backend/src/jobs/liveScoresJob.ts`, `backend/src/services/resultService.ts`, `backend/src/lib/constants.ts` (`SCORES_GRACE_PERIOD_MS`), `backend/prisma/schema.prisma` (`ResultSource` enum, `PlatformSettings.scoresServiceEnabled`).

---

## ADR-053: Mercado Pago for Colombia (dual-gateway routing)

**Date:** 2026-04-14 | **Status:** Accepted | **Extends:** ADR-044

**Context:** ADR-044 closed the international payment story (Polar.sh, USD only) but explicitly deferred Colombia: "Colombian users pay in USD until local gateway is added." That deferral mattered because:

1. **Conversion penalty.** Local users paying in USD incur a 6-8 % FX margin from their card issuer plus a worse psychological price perception ("this is a foreign service").
2. **Acquirer rejection rates.** Colombian-issued debit cards have higher international-transaction rejection rates than domestic transactions; Polar's checkout sees ~15 % decline rates from CO IPs.
3. **PSE / Nequi.** Colombia's domestic non-card rails (PSE for bank transfer, Nequi for instant pay) are unavailable through Polar but native to Mercado Pago.

**Decision:**

- **Dual-gateway routing** keyed on country detection. Cloudflare's `CF-IPCountry` header is the source of truth; the frontend hits `GET /payments/country` and receives `{ "gateway": "mercadopago" }` for `CO`, `{ "gateway": "polar" }` for everyone else. Server-side, `paymentService` re-validates the routing on the checkout-init call so a tampered frontend cannot force the wrong gateway.
- **Mercado Pago integration uses the Brick component** (embedded card form) for cards, and Brick's PSE / Nequi paths for bank transfer / instant pay. Frontend POSTs Brick's submission to `/payments/mp-process`; backend confirms via `mercadopago` SDK (v2.12) and returns the canonical `PoolPayment` row.
- **Webhook (`POST /payments/mp-webhook`)** validates two things on every request:
  - HMAC signature against the configured secret (standard MP scheme).
  - **Timestamp drift** against `MP_WEBHOOK_MAX_DRIFT_MS` (default 5 min). Without this an attacker who captured a single legitimate webhook (mirrored TLS, screenshots, leaked logs) could replay it indefinitely. ADR-046 documents the broader retry contract; the drift check is MP-specific because MP doesn't ship a per-event UNIQUE id strong enough to dedupe replays.
- **Synthetic eventId is `mp-{paymentId}-{status}`** (NOT `mp-{paymentId}` as originally implemented). MP fires multiple webhooks for the same `paymentId` as the payment moves through `pending → in_process → approved`. With the original ID the FIRST webhook claimed the only `PaymentEvent` slot and every subsequent transition deduped silently — pools stayed in PENDING. The status suffix gives each transition its own slot while genuine retries of the same status still dedupe correctly.
- **`amountCop` column on PoolPayment** stores the actual pesos charged. `amountUsd` keeps storing USD-cents (Polar-native) for cross-gateway reporting parity. ADR-051 documents the field-discipline that prevents the 40× under-report from reading the wrong column.
- **Pricing parity:** the COP table in `pricing.ts` is computed on the same volume-discount curve as USD, anchored at `BASE_PRICE_COP = 28,500` per block of 50 with `MIN_PRICE_COP = 18,000`. Corporate base $200,000 COP for 100 employees. Server is the only source — frontend never POSTs a price.

**Consequences:**

- ✅ Colombian users pay in pesos through their preferred local rail.
- ✅ Acquirer decline rate drops because issuers see a domestic transaction.
- ✅ Replay window on MP webhooks is 5 min (was infinite).
- ✅ Async MP transitions (`pending → in_process → approved` for PSE / Nequi) reliably reach `COMPLETED`.
- ⚠️ Two gateways to maintain, two webhook contracts, two reconciliation flows.
- ⚠️ Country detection is not perfect — VPN users from CO routed to Polar, EU users behind a CO VPN routed to MP. We accept the edge cases; both gateways will reject mismatched cards.

**Related code:** `backend/src/services/mercadopago/`, `backend/src/routes/payments.ts` (`/mp-checkout`, `/mp-process`, `/mp-webhook`), `backend/src/services/paymentService.ts` (cross-gateway orchestration), `backend/src/lib/pricing.ts` (COP curve), `frontend-next/src/lib/api/payments.ts` (country routing), `backend/prisma/schema.prisma` (`PoolPayment.amountCop`, `mpPreferenceId`).

---

## ADR-054: Server-side analytics with DLQ + advisory-locked drainer

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** Picks4All emits Purchase / Lead / CompleteRegistration / Refund events to two server-side sinks: Google Analytics 4 Measurement Protocol and Meta Conversions API. Both sinks fail intermittently (~1 % baseline per request) for reasons outside our control: rate limiting at the sink, transient 5xx, regional outages, network blips. A naive in-process retry burns CPU on the request-handling thread and still loses events when the process restarts mid-retry. A naive cron-only retry has no idempotency guarantees against multiple replicas.

We needed a layer that:
1. Persists an event the moment in-process retries are exhausted, before responding to the user / webhook.
2. Drains the persistence layer asynchronously without double-sending under multi-replica deploys.
3. Distinguishes retryable from permanent failures so we don't burn the budget on 4xx-permanent.

**Decision:**

- **`FailedAnalyticsEvent` model** (additive migration). One row per failed emission; columns: `provider` (`META_CAPI` / `GA4_MP`), `eventName`, `eventId` (dedup key — `transaction_id` for Purchases, UUID otherwise), `payloadJson` (full request body, replayed verbatim), `attemptCount`, `lastError`, `lastAttemptAt`, `nextRetryAt`, `resolvedAt`.
- **In-process retry budget = 2** (immediate + one delayed retry). On exhaustion, `sendCapiEvent` / `sendGa4Event` does `INSERT FailedAnalyticsEvent` with `attemptCount = 1`, `nextRetryAt = now() + 60s`, then returns. The user-facing path is never blocked by analytics retries.
- **`capiRetryJob` cron** drains the queue. Each tick:
  1. Acquires a Postgres advisory lock keyed on the job name. Multi-replica deploys grant the lock to one process; others no-op. **This is the cheapest correct primitive against double-send across replicas** — no Redis, no leader election, no app-level coordination.
  2. `findMany WHERE resolvedAt IS NULL AND nextRetryAt <= now() ORDER BY nextRetryAt`.
  3. Replays each `payloadJson` verbatim against the sink (same code path as the original emit so dedup at the sink works on `eventId`).
  4. Disposition: `2xx` → `resolvedAt = now()`. `4xx` permanent (anything except `401/403/408/429`) → `resolvedAt = now()` with no further retry. Else → bump `attemptCount`, schedule `nextRetryAt = now() + min(5min * 2^attemptCount, 24h)` (capped at 8 attempts).
  5. Releases the lock.
- **Purge:** rows with `resolvedAt < now() - 30 days` are deleted by the same job to keep the table bounded.
- **Compound index `[provider, nextRetryAt, resolvedAt]`** makes the drainer's main query an index scan even at scale.
- **Diagnostic surface:** `/admin/analytics-health` (probe) returns `dlqBacklog: { unresolved, oldest }` so an operator sees buildup before customers do.

**Consequences:**

- ✅ Sink outages no longer cost the platform Purchases — events buffer and replay.
- ✅ Multi-replica deploys are safe by construction (advisory lock).
- ✅ The DLQ is a self-cleaning bounded table — no operator action needed in normal operation.
- ⚠️ `payloadJson` contains PII fragments (email hash, IP, UA). Acceptable: same data the original POST sent to the sink, retained ≤ 30 days, never exposed to non-admin endpoints.
- ⚠️ Sustained sink outages (>24 h) cap an event at 8 attempts. After that the row is "permanent failure" and lost. Acceptable trade-off for a marketing pixel; a financial event would need stronger guarantees.

**Related code:** `backend/src/lib/ga4.ts`, `backend/src/lib/metaCapi.ts`, `backend/src/jobs/capiRetryJob.ts`, `backend/prisma/schema.prisma` (`FailedAnalyticsEvent`), `docs/guides/ANALYTICS_PIPELINE.md` (full retry ladder + dedup keys reference).

---

## ADR-055: Email suppression via Resend webhook

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** Resend (our outbound email provider) enforces its own block-list against hard-bounced or complained addresses, but the platform discovers a bounce / complaint only AFTER it has spent the API call. Two consequences mattered:

1. **Wasted quota.** Pool invitation rollouts of 200+ employees hit Resend's per-second rate limit; 5-10 % were known-bad addresses already on Resend's suppression list. Each one consumed a request slot.
2. **Operational opacity.** When a host asked "did Maria get her invite?" we had no easy way to answer "no, her address bounced last month" without poking Resend's dashboard.

**Decision:**

- **Local mirror of Resend's suppression list.** New table `EmailSuppression { email UNIQUE, reason ("bounced"|"complained"), resendId, eventData, createdAt }`.
- **Populated by Resend webhook** (`POST /webhooks/resend`). On `email.bounced` or `email.complained` we INSERT (idempotent on `email`) and store the raw `eventData` for forensics.
- **`sendEmail()` short-circuits before hitting Resend** when the recipient appears in `EmailSuppression`. Returns a structured `{ skipped: true, reason: "suppressed" }` result so callers can record the skip in audit logs and count it in admin metrics, but never makes the network call.
- **Admin surface:** the analytics dashboard exposes `operationalHealth.emailSuppressions` count. Per-row inspection is available via the Resend dashboard for now (cheap; we don't need a UI for the table yet).

**Consequences:**

- ✅ Quota waste eliminated at the boundary — the platform never tries to email a known-dead address again.
- ✅ "Did X get the invite?" is answerable by a single DB query.
- ⚠️ The local mirror diverges from Resend's truth if their webhook delivery is lost. Acceptable: their dashboard remains canonical, ours is an optimisation.
- ⚠️ A user who lands on the suppression list legitimately (bounced once due to mailbox-full) cannot un-suppress themselves through the product UI. Out-of-band: support deletes the row manually. Build a self-service "I fixed my email, retry" flow when the support volume justifies it.

**Related code:** `backend/src/routes/resendWebhook.ts`, `backend/src/lib/email.ts` (suppression check), `backend/prisma/schema.prisma` (`EmailSuppression`).

---

## ADR-056: Organization branding edits with audit trail

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** Corporate hosts (and their co-admins) can edit their organisation's branding mid-tournament — logo, primary / secondary colours, welcome message, invitation message. These fields surface in the pool splash, the in-pool header, and the body of every invitation email sent under that organisation. Two failure modes worried us:

1. **Accidental brand vandalism.** A co-admin accidentally clears the logo at 9 pm before a Saturday match; the splash goes generic for the whole pool overnight; nobody knows who did it or how to revert.
2. **Compliance / dispute.** A host claims "we never agreed to that wording in the invite email" — we have no record of what the message was when the invite was actually sent.

The audit needed to live ON the org, not on the pool, because the same brand is shared across all of an org's pools.

**Decision:**

- **`OrganizationBrandingAudit` model.** Append-only log of every branding edit. Columns: `organizationId`, `userId` (who), `changedAt` (when), `fieldsChanged String[]` (which fields mutated this update — `"logoBase64" | "primaryColor" | "secondaryColor" | "welcomeMessage" | "invitationMessage"`), `beforeJson` / `afterJson` (snapshots of the changed fields only — keeps each row compact and makes one-click revert trivial), `ipAddress` / `userAgent` (forensic, both nullable so missing trust-proxy doesn't block legitimate edits).
- **`corporateBrandingService` is the only writer.** It computes the diff, builds the audit row, and persists both the org update and the audit insert in the same transaction. A successful diff is a no-op write — no audit row is created when the user submits the same value.
- **Platform-admin edits go through `AuditEvent`, not this table.** This keeps the org-scoped log focused on host-driven changes that the host themselves should be able to inspect later.
- **Per-org indexes** `[organizationId, changedAt]` and `[userId, changedAt]` so both per-org timelines and per-user activity drill-downs are index scans.

**Consequences:**

- ✅ Branding history is queryable per org with full before/after snapshots — revert is `UPDATE Organization SET ... = beforeJson`.
- ✅ Disputes about "what did the invite email look like at time T" are answerable from the audit row covering that period.
- ✅ Per-co-admin attribution surfaces who is editing what and how often.
- ⚠️ `beforeJson` / `afterJson` for `logoBase64` can be a few hundred KB each. Two snapshots per logo edit. Bounded by a low edit frequency in practice; if it grows we can move to a logo-history table separate from the colour/text history.

**Related code:** `backend/src/services/corporateBrandingService.ts`, `backend/prisma/schema.prisma` (`OrganizationBrandingAudit`, `Organization.primaryColor` / `secondaryColor`), `backend/src/routes/corporate.ts` (PATCH branding endpoint).

---

## ADR-057: Admin analytics dashboard with safeRun fault tolerance

**Date:** 2026-05-03 | **Status:** Accepted

**Context:** The platform owner needs a single live view of growth (signups, pools, picks, revenue), engagement (DAU, funnel, cohort retention), corporate funnel (inquiries → activations), pool health (zombies, full pools, alerts), payment breakdown, and operational health (DLQ backlog, email suppressions, recent feedback, audit volume). The pre-existing patchwork was a mix of one-off SQL queries the operator ran by hand and the `/admin/stats` endpoint which only surfaced a handful of counters.

A naïve "one big endpoint that runs ~20 SQL queries" approach has a sharp failure mode: a single buggy query (a renamed column, an enum drift, a permission glitch) returns 500 and the whole dashboard goes blank. The operator can't tell what's wrong and loses the rest of the data they DO have access to.

**Decision:**

- **One endpoint, `GET /admin/analytics/dashboard`**, admin-gated, returns one JSON payload covering all sections.
- **`safeRun<T>(section, fallback, fn)` wrapper** around every query bundle. If `fn` throws, the section gets `fallback` (typed defaults — empty arrays, zero counters, etc.) and `{ section, message }` is appended to the response's `errors[]` array. The whole payload remains a valid response; the failed section renders empty in the UI.
- **In-process cache, 60-second TTL.** Live operations (post-deploy regression scan) override with `?refresh=1`. The dashboard polls at 30 s by default so most loads hit cache.
- **Frontend renders a collapsible red banner** above the KPI grid when `errors[]` is non-empty, listing each failed section with the captured error message — the operator sees IMMEDIATELY what's broken without diving into logs.
- **Auto-refresh with stale-fetch guard.** Polling intervals: 10 s, 30 s, 1 min, 5 min, off. A `fetchSeqRef` discards out-of-order responses so the UI is never stale-after-fresh. A 5 s ticker drives "hace Xs" relative timestamps without re-fetching.
- **No new tables.** Every metric is a query against existing models — `User`, `Pool`, `PoolMember`, `PoolPayment`, `OrganizationInquiry`, `CorporateInvite`, `FailedAnalyticsEvent`, `BetaFeedback`, `AuditEvent`. The dashboard is purely a read surface.
- **Type contract** lives in `frontend-next/src/lib/api/admin.ts` (`AnalyticsDashboardResponse`) — backend changes that break the shape get caught at frontend typecheck.

**Consequences:**

- ✅ One render of one URL gives the full health picture; no SQL knowledge required.
- ✅ Fault isolation: a section failing doesn't take down the others.
- ✅ Auto-refresh + low TTL keeps the dashboard live without expensive recomputation.
- ⚠️ Roughly 20 raw SQL queries per uncached load. Cheap individually (all indexed) but the aggregate runs 50-150 ms — acceptable behind the 60 s cache.
- ⚠️ Adding a new metric means editing both the backend (new `safeRun` block) and the frontend (new render). Acceptable cost for the stronger contract.

**Related code:** `backend/src/routes/adminAnalyticsDashboard.ts` (handler + safeRun pattern), `frontend-next/src/components/AdminAnalyticsContent.tsx` (UI + auto-refresh + error banner), `frontend-next/src/lib/api/admin.ts` (`AnalyticsDashboardResponse` type).

---

## ADR-058: Editable scoring rules with auto-revert ACTIVE → DRAFT

**Date:** 2026-05-11 | **Status:** Accepted

**Context:** Hosts who invited people who never accepted, or whose players all left, were stuck — pool sat in ACTIVE with stale rules and no path back to editable. CLAUDE.md §6.3 said scoring config could not change once the pool had ACTIVE members, which was the right invariant for an in-flight pool but over-applied to pools where the only remaining member was the host. Two real production reports (`cocholo@gmail.com`, `german.lopezbellomo@gmail.com`) surfaced this from feedback emails.

We needed an "Administrar reglas" host panel without breaking the original invariant for active pools where players are mid-tournament.

**Decision:**

- **Refine the invariant.** Scoring config remains immutable while *any* ACTIVE member with role `PLAYER` or `CO_ADMIN` exists. The host (HOST / CORPORATE_HOST) is considered staff and alone doesn't justify locking the editor. CLAUDE.md §6.3 updated to match.
- **New transition `revertPoolToDraft(poolId, actorUserId, reason)` in `poolStateMachine.ts`.** Idempotent (no-op when pool is not ACTIVE). Inside one transaction:
  - Deletes `Prediction`, `StructuralPrediction`, `GroupStandingsPrediction` (player data, no longer meaningful with old members gone).
  - Updates `Pool.status = "DRAFT"`.
  - Preserves `PoolMatchResult` + versions + overrides (tournament data, not player data).
  - Audit `POOL_STATUS_CHANGED { from: "ACTIVE", to: "DRAFT", deletedPredictions, deletedStructural, deletedGroupStandings }`.
  - Sends `sendPoolRevertedToDraftEmail` to the pool creator so they know the editor is unlocked.
- **Helper `wouldCauseRevert(poolId, excludingMemberId)`** that counts ACTIVE non-host members ignoring the one we're about to remove. Used by `kickMember` / `banMember` / `leaveMember`.
- **Two confirmation paths:**
  - `kickMember` / `banMember` require `confirmRevert: true` in the body when the op will trigger a revert. Without it, the backend returns 409 `REVERT_PENDING_CONFIRMATION`. The frontend `ExpulsionModal` catches that, shows `window.confirm` describing the consequences (pool → DRAFT, all predictions deleted, match results preserved), and retries with the flag.
  - `leaveMember` does NOT require confirmation. A player has the right to leave at any time. The revert (and the resulting host email) is the consequence the host must accept.
- **Backend endpoint `PATCH /pools/:poolId/scoring-config`** (in `routes/poolAdmin.ts` → `updatePoolScoringConfig` in `poolAdminService.ts`). Accepts the same shape as pool creation: a preset key string (`BASIC` / `SIMPLE` / `CUMULATIVE`) which the service expands against the instance's real phases, or a fully-detailed `PoolPickTypesConfig` validated structurally. State-gated by `canEditScoringConfig(poolStatus)` which is `DRAFT`-only. Audit `POOL_RULES_CHANGED { from, to }` captures the full diff.
- **Frontend reuses the wizard's editor.** `StepScoring` got split: `components/scoring-editor/ScoringEditor.tsx` is now a container-agnostic, props-driven component (`scoringStyle`, `scoringConfig`, `instancePhases`, `onSetScoring`, `onUpdateScoringConfig`). `StepScoring.tsx` is a thin wizard wrapper. The new `ManageRulesPanel` inside `PoolAdminTab` mounts the same editor in a modal and PATCHes the new endpoint.
- **Eligible roles to keep the pool ACTIVE: `PLAYER` + `CO_ADMIN`.** If the host has only CO_ADMINs left and no players, the pool stays ACTIVE — the host must demote or kick them first. This is a deliberately stricter interpretation: CO_ADMIN is administrative staff, but removing all the actual gameplay (PLAYERs) is still the trigger.

**Consequences:**

- ✅ Hosts can recover stalled pools without contacting support or recreating from scratch.
- ✅ The revert is informed (confirm dialog) and reversible-by-construction (the host can always invite players again, the pool goes back to ACTIVE on first PLAYER approval).
- ✅ Tournament results survive the revert, so re-activating a pool with new players doesn't lose the host's work entering scores.
- ⚠️ Player predictions are deleted at revert time. Acceptable because the predicting players already left, but documented in the host email so they understand.
- ⚠️ A volatile pool (members joining and leaving repeatedly) could thrash ACTIVE ↔ DRAFT. Each transition is audited and the host gets an email each time, so the noise is observable. Not optimizing for this case until we see it in production.
- ⚠️ The original CLAUDE.md §6.3 phrasing ("after pool has ACTIVE members") over-locked the editor when only the host remained. The new wording is precise — ADR-058 is the authoritative statement.

**Related code:** `backend/src/services/poolStateMachine.ts` (`revertPoolToDraft`, `wouldCauseRevert`, `canEditScoringConfig`), `backend/src/services/poolMemberService.ts` (`kickMember` / `banMember` / `leaveMember` with confirmRevert), `backend/src/services/poolAdminService.ts` (`updatePoolScoringConfig`), `backend/src/routes/poolAdmin.ts` (PATCH route), `backend/src/lib/email.ts` (`sendPoolRevertedToDraftEmail`), `frontend-next/src/components/scoring-editor/ScoringEditor.tsx` (standalone editor), `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ManageRulesPanel.tsx` (host panel), `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/admin/ExpulsionModal.tsx` (409 retry dialog).

---

## ADR-059: Estratega is 100% scraper-driven; host only intervenes for overrides

**Date:** 2026-05-11 | **Status:** Accepted

**Context:** The original Estratega (SIMPLE preset) host UX asked the host to enter match scores so the system could compute the group table and derive knockout winners — but Estratega's whole point is that *marcadores* don't matter, only positions and who advances. The score-entry form was vestigial and confused hosts. Earlier this session we briefly tried letting the host publish the table / winners by drag-and-drop, but the right model is the one the score-based presets already use: the scraper is the source of truth and the host only intervenes to correct mistakes.

**Decision:**

- **Auto-publication from the scraper-fed pipeline.** `liveScoresJob.finalizeResult()` (and `resultService.publishResult()` for host overrides of a `PoolMatchResult`) now call `autoPublishStructuralResults(poolId, matchId)`. For Estratega phases:
  - **GROUP_STANDINGS**: when every match in the group has a `PoolMatchResult.currentVersion`, run `calculateGroupStandings()` (FIFA tiebreakers: points → GD → GF → H2H → fair play) and upsert `GroupStandingsResult` with the resulting team order.
  - **KNOCKOUT_WINNER**: derive winner from the match's `currentVersion` (`homeGoals` vs `awayGoals`, penalty fallback if tied) and merge `{matchId, winnerId}` into `StructuralPhaseResult.resultJson.matches[]`.
  - Idempotent: re-running on already-published structural results that haven't changed is a no-op (Prisma `upsert` + array-equal short-circuit).
  - Audit: `GROUP_STANDINGS_AUTO_PUBLISHED` / `GROUP_STANDINGS_AUTO_RECOMPUTED`, `KNOCKOUT_WINNER_AUTO_PUBLISHED` / `KNOCKOUT_WINNER_AUTO_RECOMPUTED`. SYSTEM actor.
  - **No emails.** The scraper is authoritative — notifications are reserved for host overrides.

- **Host UI shows real data, not editable fields.**
  - `GroupStandingsCard` (right column) renders the new reusable `ClassicStandingsTable` component (Pos / Equipo / PJ / G / E / P / GF / GC / DG / Pts). Empty / partial / complete states render from the same component. When the host publishes an override that diverges from the scraper-derived natural order, the table follows `publishedTeamIds` and surfaces a "★ Sobrescrita por el organizador" badge with the reason as tooltip.
  - `KnockoutMatchCard` (right column) shows the final score (with penalty line if applicable) and the winner badge, exactly like the player view. No score / penalty inputs. The host gets a "Sobrescribir ganador" button only when a winner is already published.
  - Data wiring: new `GET /pools/.../group-standings-stats/.../...` endpoint returns the live FIFA-table computed from current `PoolMatchResult`s plus the published team order (if any), so the card renders in one round-trip. Knockouts: `StructuralPicksManager` loads `StructuralPhaseResult.matches[]` and threads each `winnerId` into the matching `KnockoutMatchCard` via the new `publishedWinnerId` prop.

- **Override flows remain manual + audited + emailed.**
  - Groups: `PUT /pools/.../group-standings-results/.../...` with `teamIds` + `reason`. Sends `sendGroupStandingsOverrideNotification` to every active member.
  - Knockouts: `PUT /pools/.../structural-results/:phaseId/match/:matchId` with `winnerId` + `reason`. Sends `sendKnockoutWinnerOverrideNotification`. Backend returns 400 `REASON_REQUIRED_FOR_OVERRIDE` if the host tries to change an already-published winner without a reason; the frontend prompts and retries.
  - The `PoolMatchResult` itself is NOT touched by a knockout override — the override only writes to `StructuralPhaseResult`. This is intentional: the scraper's score is the ground truth of "what happened on the field", and the host's override is "who actually advanced". The card shows both (real score + winner badge) so the divergence is transparent.

- **Multi-leg knockouts deferred.** Champions League ida+vuelta is not supported on Estratega in this iteration — `advanceTwoLeggedPhase` still derives aggregate winners from match scores, and a per-leg `publishKnockoutMatchWinner` doesn't compose cleanly with that semantics. Mundial Sub-20 / WC2026 / Libertadores single-match knockouts work.

- **Cancelled / abandoned matches.** If a match never reaches `API_CONFIRMED`, `autoPublishStructuralResults` never fires for it and the group / round stays unpublished. Workaround for now: host edits via the existing override path once the situation is resolved. TODO: surface a "publicar manualmente" admin fallback button if this becomes a real operational problem.

**Consequences:**

- ✅ Hosts in Estratega don't have to type anything during normal pool operation. Tournament progress is visible the moment the scraper confirms a match.
- ✅ Players see the classic FIFA-style table fill in row-by-row as matches finalise, instead of an "empty until host clicks Generate" placeholder.
- ✅ Single shared truth: `GroupStandingsResult` / `StructuralPhaseResult` is the only thing the leaderboard / advancement pipeline reads. UI reflects that.
- ⚠️ For best-thirds qualifier tournaments (WC2026), in case of a host override of the standings, the system has no way to recompute the third-place cross-group ranking from a manual order — the auto path takes care of the normal case, the override path is a documented escape hatch.
- ⚠️ Auto-recomputations are silent (no email). If a scraper errata cascades into recomputing the group table, players see the change on next load. This is consistent with how PoolMatchResult overrides already work in score-based presets (only HOST_OVERRIDE notifies).

**Related code:** `backend/src/services/structuralAutoPublish.ts` (the trigger function), `backend/src/jobs/liveScoresJob.ts` (hook after `finalizeResult`), `backend/src/services/resultService.ts` (hook after `publishResult`), `backend/src/services/groupStandingsService.ts` (`getGroupStandingsStats`), `backend/src/routes/groupStandings.ts` (new GET endpoint), `backend/src/routes/structuralResults.ts` (`PUT .../match/:matchId` from ADR-058 — same endpoint, also used by the auto-publish path indirectly), `frontend-next/src/components/groupStandings/ClassicStandingsTable.tsx` (new table component), `frontend-next/src/components/groupStandings/GroupStandingsCard.tsx` (refactor), `frontend-next/src/components/KnockoutMatchCard.tsx` (refactor), `frontend-next/src/components/StructuralPicksManager.tsx` (publishedWinners wiring).

---

## ADR-060: Payment funnel observability — INITIATED state, every-event audit log, reconciler

**Date:** 2026-05-21 | **Status:** Accepted

**Context:** Abril Alonso (abrilalonso123@gmail.com) reported "no me anda la página" trying to upgrade her pool. Diagnosis surfaced **20 findings** across the Polar payment flow — see `POLAR_AUDIT.md` for the full audit + per-finding status tracker. The critical defects fell into four buckets:

1. **Silent failures.** `PoolCapacityTab.handleExpand`'s catch was `console.error + setBusy(false)` — the user saw the spinner disappear with no error message. Abril's case verbatim.
2. **Black-box gateway interactions.** `PoolPayment` rows were INSERTed only AFTER Polar accepted the create. Any failure before that (Polar 5xx, network, rate limit) left ZERO trace.
3. **Webhook log only persisted `order.paid`.** Every other Polar delivery (`checkout.updated open/processing/expired/failed`, future event types) was dropped. Production had exactly 1 PaymentEvent row. The "immutable audit log of every webhook event" promise in the schema docstring was a lie.
4. **No reconciliation.** PoolPayment rows that went PENDING and never received a webhook stayed that way forever — 8 zombies, the oldest +28 days old, sat in the funnel skewing every report.

**Decision:** Six-commit hardening cycle. Every change auditable in `POLAR_AUDIT.md` against its numbered finding (F-1 … F-20).

- **Lifecycle states (F-15):** `PaymentStatus` enum extended with `INITIATED`, `ABANDONED`, `EXPIRED`, `CANCELLED`. Distinct semantics, distinct funnel buckets.
- **Universal audit log (F-3 + F-18 + F-19):** `PaymentEvent` extended with `source` (POLAR_WEBHOOK / MP_WEBHOOK / CLIENT / RECONCILER / SERVER), `poolPaymentId` (FK), `webhookId` / `webhookTimestamp`. `polarEventId` made nullable with a partial unique index (UNIQUE WHERE polarEventId IS NOT NULL) so non-gateway sources coexist while idempotency on gateway events remains intact. `handleCheckoutUpdated` rewritten to persist EVERY delivery; `recordUnhandledPolarEvent` audits any webhook type without a dedicated handler.
- **Client beacons (F-13):** New endpoint `POST /payments/attempts/:paymentId/event` (auth + ownership-checked). `reportPaymentAttemptEvent(paymentId, eventType)` fires REDIRECT_INITIATED before `window.location.href`, REDIRECT_FAILED in the inner catch, USER_CANCELLED from `/pago/cancelado`. Fire-and-forget so beacon failures never stall the user.
- **INSERT-before-gateway (F-4):** Both `initiateCheckout` (Polar) and `initiateMpCheckout` (MP) INSERT in `INITIATED` BEFORE the gateway call. Success → atomic transition to PENDING + populate gateway IDs + SERVER `STATUS_TRANSITION` audit. Failure → atomic transition to FAILED + audit + re-throw. The row's existence is a function of "user clicked Pay", not "gateway accepted".
- **cancelUrl + ownership-scoped idempotency (F-2 + F-5):** Verified against `@polar-sh/sdk` v0.47 types: Polar's cancel hook is `returnUrl` (the SDK has NO `cancelUrl` field). Idempotency `findFirst` now scopes by `userId` so a CO_ADMIN re-initiating can't be handed the HOST's pre-created URL (wrong customer email, wrong CAPI attribution).
- **Reconciliation job (F-14):** `paymentReconcileJob` runs every 30 min (configurable `RECONCILE_CRON`), multi-instance-safe via Postgres advisory_xact_lock, early-exits on idle. `reconcileStalePayment` queries Polar and maps response to RESCUED / EXPIRED / FAILED_FROM_GATEWAY / ABANDONED_GATEWAY_404 / ABANDONED_LOCAL_TIMEOUT / NOOP. RESCUED emails admin — no auto-complete because replaying CAPI / GA4 / receipt-email side effects unsafely is worse than asking a human.
- **Visible failure UX (F-1):** PoolCapacityTab catches set a typed `errorMsg` state rendered as a styled inline alert (errorTitle / errorHint / Reintentar). PoolCreationWizard's `window.alert` replaced with the existing inline error banner. i18n keys added in es/en/pt.
- **Funnel events from every entry point (F-16 + F-17):** PoolCapacityTab emits `begin_checkout` + `InitiateCheckout` (was wizard-only). `/pago/cancelado` fires GA4 `payment_cancelled` + USER_CANCELLED beacon. Both gateway cancel URLs carry `&paymentId={id}` so the beacon attributes to the right attempt.

**Migrations (additive-only, zero-downtime):**
- `20260519_extend_payment_observability` — PaymentEvent extension + 4 new enum values.
- `20260521_pool_payment_initiated_state` — `polarCheckoutId` nullable + partial unique index.

**Consequences:**

- ✅ Full funnel observability. PaymentEvent records `click → INITIATED → gateway accepts → REDIRECT_INITIATED → gateway webhook(s) → USER_CANCELLED` for every attempt. Funnel queries on `(source, eventType, createdAtUtc)` (composite index) are cheap.
- ✅ Silent failures eliminated. Every catch surfaces an actionable banner.
- ✅ The 8 PENDING zombies will be reconciler-resolved on the next tick once Railway picks up the build.
- ✅ RESCUED never auto-completes — replaying side effects unsafely is intentionally a human review.
- ⚠️ Legacy cancel URLs created before Commit 6 only carry `poolId`. The cancel page handles missing `paymentId` — GA4 event still fires, backend beacon is skipped.
- ⚠️ The reconciler does NOT call `getOrder` (F-10 deferred). RESCUED detection is by `checkout.status` only. If we ever need to auto-process a RESCUED row, that wiring is required.
- ⚠️ Deferred findings (revisit post-mundial): F-6 (ipapi.co dependency), F-7 (module-scoped cache), F-8 (rename `polarCheckoutId` → `gatewayReference`), F-11 (decompose `paymentService.ts`), F-12 (pricing duplication backend↔frontend).

**Related code:**
- Backend schema: `backend/prisma/schema.prisma` (PoolPayment + PaymentEvent), `backend/prisma/migrations/20260519_extend_payment_observability/migration.sql`, `backend/prisma/migrations/20260521_pool_payment_initiated_state/migration.sql`.
- Backend taxonomy: `backend/src/lib/paymentEvents.ts` (NEW — single source of truth for source + event-type constants).
- Backend service: `backend/src/services/paymentService.ts` (initiate flows, webhook handlers, `recordClientEvent`, `recordUnhandledPolarEvent`, `reconcileStalePayment`, `findStalePayments`), `backend/src/services/polar/client.ts` (returnUrl).
- Backend routes + jobs: `backend/src/routes/payments.ts` (new endpoint + webhook header capture), `backend/src/jobs/paymentReconcileJob.ts` (NEW), `backend/src/server.ts` (job wiring), `backend/src/lib/email.ts` (`payment_reconciler_rescued` AdminCategory).
- Frontend: `frontend-next/src/lib/api/paymentAttemptEvent.ts` (NEW beacon helper), `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx` (banner + beacons + funnel events), `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx` (banner + beacons), `frontend-next/src/app/[locale]/pago/cancelado/page.tsx` (USER_CANCELLED + GA4), `frontend-next/src/messages/{es,en,pt}/payment.json`.
- Docs: `POLAR_AUDIT.md` (per-finding status tracker — kept current with commit SHAs).

---

## ADR-061: Sales Management — quotes, cuentas de cobro, and CC-redemption checkout path

**Date:** 2026-05-26 | **Status:** Accepted

**Context:** The issuer (Juan Camilo Chacón Alvarado, persona natural, régimen simplificado, Colombia) needs to (a) send sales proposals to corporate prospects with branded PDFs and (b) issue Colombian "cuentas de cobro" (the non-tax-invoice billing document used by simplified-régime issuers) that the customer then redeems at checkout. Both documents must be auditable, trilingual (ES / EN / PT), and tie cleanly into the existing capacity-upgrade payment flow without bypassing the pricing safeguards added in ADR-046. v1 explicitly scopes to "generate + persist to DB + download PDF" — no email send, no public quote-acceptance link, only Picks4All corporate pools (no free-form line items).

See `SALES_AUDIT.md` for the full per-decision log (§11.1–§11.23) and `SALES_IMPLEMENTATION.md` for the 14-commit execution tracker.

**Decision:** Two new aggregate roots backed by a shared atomic-counter table, three PDF templates rendered server-side via `@react-pdf/renderer`, an admin UI at `/admin/ventas/...`, and a customer-facing redemption box that funnels into the existing payment service.

**Data model (additive, see `backend/prisma/schema.prisma`):**

- `Quote`: client snapshot + locale/term + computed pricing snapshot + lifecycle (`ACTIVE` / `EXPIRED` / `CANCELLED`). Consecutive `COT-{year}-{4 digits}`.
- `AccountReceivable`: same shape plus 8-digit UNIQUE `redemptionCode`, `targetCapacity`, `paidAtUtc`, optional `linkedQuoteId`, and a 1:1 FK to `PoolPayment.accountReceivableId`. Lifecycle `PENDING → REDEEMED → PAID`; `PENDING → EXPIRED` via sweep; any → `CANCELLED` via admin. Consecutive `CC-{year}-{4 digits}`.
- `DocumentCounter`: atomic `(kind, year) → lastNumber` counter with `INSERT … ON CONFLICT DO UPDATE … RETURNING` so two concurrent issuances get sequential numbers, never duplicates.

**Lifecycle invariants (locked):**

1. **Pricing is server-derived.** Admin input names participants/targetCapacity + currency; amount is computed via `backend/src/lib/pricing.ts`. Client-supplied amounts are rejected. The CC snapshot is re-verified against live `pricing.ts` at redemption; mismatch fires `cc_pricing_drift` admin alert and blocks checkout with `CONFLICT` — admin must reissue.
2. **Issuer snapshot is frozen.** `issuerSnapshotJson` is a deep copy of `lib/issuerInfo.ts` taken at issuance time, persisted on the row, and read by the PDF renderer. Editing `issuerInfo.ts` later does not retroactively mutate documents already issued (legal audit requirement).
3. **CC redemption is atomic.** `tx.accountReceivable.updateMany WHERE status='PENDING'` inside the same `prisma.$transaction` as `PoolPayment.create`. The single winner of two concurrent redeemers gets the lock; the loser sees `count===0` and the route returns 409. Mirrors the activate-corporate pattern (ADR-048).
4. **CC release on payment expiry.** Reconciler (ADR-060) transitions EXPIRED / FAILED / ABANDONED PoolPayments inside a tx that also calls `releaseAccountReceivable(tx, ccId)` — flips `REDEEMED → PENDING` only, leaving `PAID` alone (so a webhook race never undoes a completed payment).
5. **Sweep-to-EXPIRED.** Hourly `accountReceivableExpiryJob` (advisory lock `82636504n`) flips PENDING CCs whose `validUntil` is past to EXPIRED. Bounded batch + distinct lock key so it runs concurrently with `paymentReconcileJob`.
6. **Soft-revoke only.** No `DELETE FROM AccountReceivable` ever. Cancellation sets `status='CANCELLED'`. Same for quotes. Consecutive numbers are never reused — gaps are visible in the audit trail.
7. **Trilingual PDFs with locale-conditional copy.** `backend/src/pdf/i18n.ts` carries an `es | en | pt` dictionary; the renderer substitutes `{term}` per the admin's chosen term (filtered by locale via `SALE_TERMS`). The DIAN régimen-tributario phrase appears only when `locale === "es"` (the issuer's tax status is Colombian — the phrase has no legal meaning in en/pt copies).
8. **Bancolombia bank-transfer block COP-only.** CC PDFs show the wire-transfer instructions only when `currency === "COP"`. USD international clients see only the online card-payment block (Polar).
9. **Section-level no-split.** Every `<View>` block in both PDF templates carries `wrap={false}` so sections never split across pages — visual integrity for legal documents the issuer signs.

**Customer-facing redemption path:**

- New `POST /sales/account-receivables/redeem` (auth-required, NOT admin) — pure lookup. Distinguishes statuses with distinct 409 codes (`ALREADY_PAID`, `ALREADY_REDEEMED`, `CANCELLED`, `EXPIRED`) so the wizard renders a clear message.
- `AccountReceivableRedemptionBox` (component) sits above `CapacitySelector` in both `StepCapacity` (wizard) and `ExpandCapacitySection` (existing-pool capacity tab). Gated to `poolType === "corporate"` to match the backend's CC issuance restriction. When applied, capacity locks to `CC.targetCapacity` and both checkout helpers pass `accountReceivableId` through to `paymentService.initiateCheckout / initiateMpCheckout`.
- The payment-service validate-and-lock pipeline blocks redemption on snapshot drift, capacity mismatch, and stale `validUntil`; on success it links the new `PoolPayment.accountReceivableId` and flips CC → REDEEMED inside the same tx.
- Webhook completion handlers (Polar `order.paid`, MP IPN approved at both Brick and webhook entry points) flip CC → `PAID` inside the same tx that flips PoolPayment → `COMPLETED`. The receipt email (`sendPaymentReceiptEmail`) renders an extra row with the CC consecutive when `payment.accountReceivableId` is set.

**Admin UI:**

- `/admin/ventas/cotizaciones` and `/admin/ventas/cuentas-de-cobro`, gated by `requireAdmin`. Mobile-first (issuer's stated use case: emit documents on the go). List + filter + paginate; create with sectioned form + live amount preview from the frontend mirror of `pricing.ts`; detail with status badge, download PDF (opens via `credentials: include` cookies so no token plumbing), "Cancelar" for both, "Marcar como pagada" for CCs in PENDING/REDEEMED.
- "→ Emitir cuenta de cobro" on ACTIVE quote detail navigates to the CC create page with `?fromQuoteId=` so client + locale + term + capacity + currency + tournament pre-fill.

**Migration footprint (additive only, zero-downtime):**

- `20260522_add_sales_management/migration.sql` — three new tables, three new enums, one new column + FK on `PoolPayment`, indexes on `[status, validUntil]` for the expiry sweep and on `clientContactEmail` for admin search.

**Consequences:**

- ✅ End-to-end traceability: every cotización and CC has a UNIQUE consecutive, an issuer snapshot, and a PDF that can be regenerated at any time from the row.
- ✅ Race-safe redemption — the activate-corporate atomic-claim pattern extended to CCs.
- ✅ Drift-safe pricing — a CC issued at one price/tier configuration cannot be silently honoured at a different one after pricing.ts changes; the customer gets a clear 409 + admin gets a `cc_pricing_drift` alert.
- ✅ Cookies-only auth on PDF downloads — no token plumbing, opens cleanly in a new tab from the admin UI.
- ✅ Admin convention preserved: hardcoded Spanish (matches `AdminFeedbackContent` / `AdminEmailSettingsContent`); customer-facing redemption box uses next-intl `defaultMessage` so ES renders now and EN/PT keys can be populated later without component changes.
- ⚠️ Standard (non-corporate) pools cannot redeem CCs. The redemption box is hidden for those flows. If/when personal-pool CCs become a thing, lift the `poolType === "corporate"` gate on both the box and the backend issuance.
- ⚠️ `lib/saleTerms.ts` is duplicated between backend and frontend (same pattern as `lib/pricing.ts` per ADR-046 / F-12). Both files are small and changes require deliberate intent — acceptable until a shared package emerges.
- ⚠️ No email send for v1. Admin downloads the PDF and sends manually via existing email channels. Auto-send + tokenized customer-facing quote-acceptance link is a future commit.

**Related code:**
- Backend schema: `backend/prisma/schema.prisma` (Quote, AccountReceivable, DocumentCounter, PoolPayment.accountReceivableId), `backend/prisma/migrations/20260522_add_sales_management/migration.sql`.
- Backend services: `backend/src/services/sales/quoteService.ts`, `backend/src/services/sales/accountReceivableService.ts`, `backend/src/services/sales/documentCounterService.ts`, `backend/src/services/paymentService.ts` (validate-and-lock + release helper).
- Backend libs: `backend/src/lib/issuerInfo.ts`, `backend/src/lib/saleTerms.ts`, `backend/src/lib/amountInWords.ts`.
- Backend PDF: `backend/src/pdf/i18n.ts`, `backend/src/pdf/QuoteDocument.tsx`, `backend/src/pdf/CcDocument.tsx`, `backend/src/pdf/renderQuotePdf.tsx`, `backend/src/pdf/renderCcPdf.tsx`.
- Backend routes + jobs: `backend/src/routes/adminSales.ts`, `backend/src/routes/salesRedemption.ts`, `backend/src/routes/payments.ts` (accountReceivableId Zod field), `backend/src/jobs/accountReceivableExpiryJob.ts`.
- Frontend libs: `frontend-next/src/lib/api/sales.ts`, `frontend-next/src/lib/api/payments.ts` (accountReceivableId param), `frontend-next/src/lib/saleTerms.ts`.
- Frontend admin UI: `frontend-next/src/components/AdminSalesHeader.tsx`, `frontend-next/src/components/AdminQuotesListContent.tsx`, `frontend-next/src/components/AdminQuoteCreateContent.tsx`, `frontend-next/src/components/AdminQuoteDetailContent.tsx`, `frontend-next/src/components/AdminCcsListContent.tsx`, `frontend-next/src/components/AdminCcCreateContent.tsx`, `frontend-next/src/components/AdminCcDetailContent.tsx`, six `page.tsx` files under `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/`.
- Frontend customer flow: `frontend-next/src/components/AccountReceivableRedemptionBox.tsx`, `frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx`, `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx`, `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx`.
- Frontend nav: `frontend-next/src/components/NavBar.tsx` (admin "Gestión de Ventas" link).
- Specs: `SALES_AUDIT.md`, `SALES_IMPLEMENTATION.md`.

---

## ADR-062: Corporate invitation locale

**Date:** 2026-05-26 | **Status:** Accepted

**Context:** Caterine Ochoa (Native Intelligence SAS) reported on 2026-05-26 that her English-speaking employees received corporate-activation emails with Spanish copy hardcoded ("Hey! Tu equipo en Native Intelligence SAS ya está armando su quiniela…"). The `getCorporateActivationTemplate` helper had ES/EN/PT branches (emailTemplates.ts:1006-1050) but `corporateService.sendInvitations` never passed `locale` to `sendCorporateActivationEmail`, so every employee got the Spanish branch via the `DEFAULT_LOCALE` fallback at email.ts:929.

The Organization model had no field to carry the host's preference, and neither the wizard nor the post-creation branding panel offered a way to pick one.

Full per-decision rationale in `CORPORATE_LOCALE_AUDIT.md` §3 (granularity, scope, naming, UI, backfill, validation, audit, no-retroactive-resend).

**Decision:** A single new column `Organization.invitationLocale` (TEXT NOT NULL DEFAULT 'es') that controls the language of the first email each employee receives. After activation, `LocalePreferenceModal` (which already exists and runs on every authenticated layout mount via `LocalePreferenceGate`) blocks the dashboard until the user picks their personal locale; from that point, `User.locale` governs every downstream email and `invitationLocale` stops mattering for them.

**Scope is deliberately narrow:**

- `invitationLocale` governs ONLY `sendCorporateActivationEmail`. Other corporate emails to employees (`sendCorporateCheckinEmail`, deadline reminders, results, etc.) read `User.locale` once it exists.
- `sendCorporateInquiryConfirmationEmail` (to the prospect, before any org exists) already reads locale from the inquiry payload — untouched by this work.
- Standard (non-corporate) pools are unaffected; the field does not exist on personal pools.

**Lifecycle invariants:**

1. **Last-writer-wins at send time.** `sendInvitations`, `resendInvitation`, and `bulkResendExpired` all re-read the current `org.invitationLocale` at send time. If the host updates the field between original upload and an actual send, the new value ships. This means a stuck PENDING invite that the host re-sends after switching ES → EN will arrive in English even though the original (never-shipped) version was queued in Spanish.
2. **No retroactive resend.** Changing the field does NOT re-trigger emails that already left. PENDING invites whose emails already shipped before the change keep the old language in the recipient's inbox; the host must explicitly use the resend action to re-ship in the new language.
3. **Soft handoff to `User.locale`.** `LocalePreferenceModal` is the contractually-enforced handoff point. The window between activation and modal completion is sub-minute (modal is blocking), and no scheduled email targets users whose `localePromptCompletedAt` is NULL — so the "wrong locale" window is bounded to the single activation email.
4. **Audit on change.** Every PATCH on the branding endpoint that modifies `invitationLocale` writes an `OrganizationBrandingAudit` row with `fieldsChanged: ["invitationLocale"]`, `beforeJson: { invitationLocale: "es" }`, `afterJson: { invitationLocale: "en" }`. Reused the existing branding audit table — no new audit type or schema.
5. **Validation at boundaries.** Both the create-pool POST and the branding PATCH use `z.enum(["es", "en", "pt"])` at the route layer. The dropdown emits only those three values so anything else is a tampered request → 400.

**Migration:**

`backend/prisma/migrations/20260526_add_organization_invitation_locale/migration.sql` — single additive `ALTER TABLE` with `DEFAULT 'es'`. Zero data loss, zero behavioural change for existing pools (they keep sending Spanish exactly as today until the host opens the branding panel and picks otherwise).

**Consequences:**

- ✅ Unblocks Caterine's case and every future non-Spanish-speaking corporate client. The English template that has been silently sitting in the codebase finally reaches an inbox.
- ✅ Host-mediated: the platform doesn't auto-detect employee language (which would be a guess based on TLDs, names, or IP). The host knows their team better than any heuristic and now has the explicit knob.
- ✅ No drift: the `OrganizationBrandingAudit` trail records every change with `{ from, to }`. If a host claims "I never set it to Spanish", the row proves otherwise.
- ⚠️ Mixed-language teams (e.g. 5 EN + 3 ES) get one default; each employee right-sizes their own language via the post-activation modal. Worst case: one wrong-language email per employee.
- ⚠️ A host that changes the field after an upload but before the actual send job runs may get a different language than they expected at upload time. Documented as last-writer-wins; revisit if real users complain.
- ⚠️ Per-invitation override (CSV column) is out of scope for v1 and deliberately so — adds two columns of UX surface area for a use case that hasn't been requested yet.

**Related code:**

- Backend schema: `backend/prisma/schema.prisma` (Organization model) + `backend/prisma/migrations/20260526_add_organization_invitation_locale/migration.sql`.
- Backend routes + services: `backend/src/routes/corporate.ts` (create-pool + branding-patch Zod schemas), `backend/src/services/corporateService.ts` (`createCorporatePool` persists the field; `sendInvitations`, `resendInvitation`, `bulkResendExpired` all read + forward to email), `backend/src/services/corporateBrandingService.ts` (diff + audit), `backend/src/services/poolOverviewService.ts` (selects + surfaces the field).
- Email plumbing (pre-existing, untouched): `backend/src/lib/email.ts` (`sendCorporateActivationEmail`), `backend/src/lib/emailTemplates.ts` (`getCorporateActivationTemplate` ES/EN/PT blocks).
- Locale handoff (pre-existing, verified in audit §2.5): `frontend-next/src/components/LocalePreferenceModal.tsx`, `frontend-next/src/components/LocalePreferenceGate.tsx`, `POST /users/me/locale-preference`.
- Frontend wizard: `frontend-next/src/types/poolWizard.ts`, `frontend-next/src/components/pool-wizard/PoolWizardContext.tsx`, `frontend-next/src/components/pool-wizard/steps/corporate/StepCompanyInfo.tsx`, `frontend-next/src/components/pool-wizard/PoolCreationWizard.tsx`, `frontend-next/src/lib/api/corporate.ts`.
- Frontend branding panel: `frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolBrandingTab.tsx`, `frontend-next/src/lib/poolTypes.ts`.
- Specs: `CORPORATE_LOCALE_AUDIT.md`, `CORPORATE_LOCALE_IMPLEMENTATION.md`.

---

## ADR-063: Welcome email locale handoff

**Date:** 2026-05-26 | **Status:** Accepted

**Context:** ADR-062 fixed the corporate-invitation email's locale plumbing but left two unaddressed gaps:

1. The welcome email (fired right after a User row is created) ignored locale entirely. Three call sites in `authService.ts` — Google signup (line 483), email-verify (line 545), corporate activation (line 792) — never passed `locale` to `sendWelcomeEmail`, so every welcome shipped in the `DEFAULT_LOCALE` ("es"). Even the user who chose English in the next breath received a Spanish welcome first.
2. The corporate-activation email's link (`email.ts:930`) was hardcoded to `/activar-cuenta` so a non-Spanish employee — even after ADR-062 made their invitation email arrive in English — clicked through and landed in the Spanish UI.

The user (2026-05-26) asked: "Is it possible to always send the welcome AFTER the language-selection banner?" Yes. We defer it.

Full per-decision rationale in `EMAIL_LOCALE_HANDOFF_AUDIT.md` §3.

**Decision:**

- New column `User.welcomeEmailSentAt DateTime?`. NULL = pending. Migration includes a backfill that sets the column to `createdAtUtc` for every pre-existing user, so the fallback job's first tick doesn't attempt to re-welcome the existing base.
- All three inline `sendWelcomeEmail` call sites in `authService.ts` are removed.
- `POST /users/me/locale-preference` becomes the single trigger point in the happy path. Inside the same `prisma.user.update` that sets `User.locale` + `User.localePromptCompletedAt`, the endpoint sets `welcomeEmailSentAt = now` if it was NULL, then dispatches the welcome with the just-chosen locale via `fireAndForget`.
- New `welcomeEmailFallbackJob` (hourly at `:15`, advisory lock `82636505n`, batch cap 50) catches users with `welcomeEmailSentAt IS NULL AND createdAtUtc < now - 24h`. Resolves locale: `org.invitationLocale` for users who are members of a corporate pool; `resolveUserLocale(user)` otherwise (country + platform default chain).
- New helper `backend/src/lib/activationUrl.ts` returns the locale-correct path that mirrors `frontend-next/src/i18n/routing.ts:86-90`:
  - `es → /activar-cuenta`
  - `en → /en/activate-account`
  - `pt → /pt/ativar-conta`
  Called from `email.ts:930` so the link in the corporate-activation email points to the matching-language page.

**Scope is the welcome email AND the activation link — not the broader email system:**

- Other emails (deadline reminders, results, payment receipts) already read `User.locale` correctly once it's set; they're untouched.
- Inquiry-confirmation emails are already correct (read `locale` from the inquiry payload).
- Background jobs (deadline reminders, new-member digest) are NOT filtered by `localePromptCompletedAt` — punishing users who never close the modal by silencing their pool notifications would be worse than the rare locale mismatch.

**Lifecycle invariants:**

1. **`welcomeEmailSentAt` is set inside the same tx as `locale` + `localePromptCompletedAt`.** No partial state where the user has been welcomed but their locale is null.
2. **`welcomeEmailSentAt` is set BEFORE the Resend call.** If Resend fails, the flag is already set. Trade-off: a small rate of "missed welcomes" on Resend outages in exchange for guaranteed idempotency. Recovery is via support, not a retry counter.
3. **Backfill at migration time.** Existing users get `welcomeEmailSentAt = createdAtUtc` so the fallback job ignores them.
4. **The fallback never re-welcomes a row whose `welcomeEmailSentAt` is non-null.** Idempotency property of the candidate query, not behavioural.
5. **Activation URL helper mirrors routing.ts.** A comment in the helper flags the cross-boundary dependency. Future routing changes must update both.

**Migration:**

`backend/prisma/migrations/20260526_add_user_welcome_email_sent_at/migration.sql` — additive column + backfill UPDATE. Zero data loss.

**Consequences:**

- ✅ Welcome email always arrives in the user's chosen locale (or the best available fallback for closed-tab users).
- ✅ Activation page renders in the email's language end-to-end. No more "email in English → page in Spanish" mismatch.
- ✅ The locked-down trigger surface (one endpoint + one job) means future code can't accidentally reintroduce the inline-locale-blind welcome.
- ⚠️ Welcome arrives slightly later in the user journey (after dashboard load, not at signup). For users who immediately log in, this is sub-minute. For users who delay, the 24h fallback ships it.
- ⚠️ If Resend fails between the flag-set and the actual send, the welcome is lost (won't retry). v1 chooses simplicity over a retry counter; revisit if real undeliverable cases surface.
- ⚠️ The activation URL helper duplicates the path table from `routing.ts`. Same pattern as `lib/saleTerms.ts` and `lib/pricing.ts` (ADR-061 also has this cross-boundary issue). Acceptable until a shared package emerges.

**Related code:**
- Backend schema: `backend/prisma/schema.prisma` (User model) + `backend/prisma/migrations/20260526_add_user_welcome_email_sent_at/migration.sql`.
- Backend libs: `backend/src/lib/activationUrl.ts` (new), `backend/src/lib/email.ts` (line 930 uses the helper).
- Backend service: `backend/src/services/authService.ts` (three `sendWelcomeEmail` call sites removed; import cleaned).
- Backend routes: `backend/src/routes/userProfile.ts` (`POST /me/locale-preference` is the new trigger).
- Backend jobs: `backend/src/jobs/welcomeEmailFallbackJob.ts` (new), registered in `backend/src/server.ts`.
- Pre-existing infra (untouched): `frontend-next/src/components/LocalePreferenceModal.tsx`, `LocalePreferenceGate.tsx`, `frontend-next/src/i18n/routing.ts`.
- Specs: `EMAIL_LOCALE_HANDOFF_AUDIT.md`, `EMAIL_LOCALE_HANDOFF_IMPLEMENTATION.md`.

---

## ADR-064: Locale resolution architecture

**Date:** 2026-05-26 | **Status:** Accepted

**Context:** Santiago Arcila (senriquearcila@hotmail.com) reported on 2026-05-26 that when he picked Spanish in the language selector, the page reloaded back to English. The owner reproduced the exact flow on his own admin account in Chrome incognito with `Accept-Language: en-US`: clicking "Español" wrote `NEXT_LOCALE=es`, navigated to `/dashboard` (unprefixed because ES is `defaultLocale`), and then a 307 redirect bounced back to `/en/dashboard`.

Forensic mapping (`LOCALE_RESOLUTION_AUDIT.md` §2) identified three bugs in the locale-resolution pipeline:

1. The cookie-aware redirect in `proxy.ts:158-171` had an asymmetric guard `cookieLocale !== routing.defaultLocale` — it only honoured the cookie when the user picked a NON-default locale. A user picking ES (the default) was ignored at this layer, falling through to next-intl's auto-detection.
2. next-intl's `localeDetection: true` default + Picks4All's `localeCookie: false` (set for SEO reasons in `routing.ts:15`) created a hostile combination: next-intl ignored the cookie and used `Accept-Language`, so a user on an English browser who picked ES via the selector was redirected back to `/en/`.
3. `setAuthCookies` never wrote `NEXT_LOCALE`, and `clearAuthCookies` never cleared it — so a fresh login on a shared browser would inherit the previous user's locale, and a successful modal submission was entirely client-side (a single `document.cookie = …` in `LocalePreferenceModal.tsx:177`) with no server-side defense.

**Decision:** A four-layer locale resolution chain with the cookie as the canonical user signal, manual `Accept-Language` detection in `proxy.ts` for anonymous visitors, and backend cookie sync at every auth event.

**Precedence (locked):**

1. **URL prefix** (`/en/`, `/pt/`) — authoritative if the cookie agrees or is absent.
2. **`NEXT_LOCALE` cookie** — if present and valid, redirect the URL to match.
3. **`Accept-Language`** — manual parsing in `proxy.ts` for anonymous visitors only.
4. **`routing.defaultLocale = "es"`** — terminal fallback.

**Implementation:**

- `frontend-next/src/i18n/routing.ts`: `localeDetection: false` added. next-intl now only consults URL prefix + defaultLocale. All other detection moves to our code so we have a single authority.
- `frontend-next/src/proxy.ts`: Step 1b rewritten with the full precedence chain. Three branches:
  - cookie present + URL mismatch → redirect to match cookie
  - no cookie + no URL prefix → manual `Accept-Language` detection
  - cookie absent + URL has prefix → respect URL
- `backend/src/lib/authCookies.ts`:
  - `setAuthCookies` accepts `locale?: string | null`. When non-null and a valid locale, writes `NEXT_LOCALE` with attributes mirroring the frontend writers (1-year `maxAge`, `Lax`, `Secure`, `.picks4all.com` domain in prod).
  - New helper `setLocaleCookie(res, locale)` for the locale-preference handler.
  - `clearAuthCookies` clears `NEXT_LOCALE` along with the auth cookies — closes the inherited-locale-on-shared-browser bug.
- `backend/src/routes/auth.ts`: 4 call sites of `setAuthCookies` (register, login, google, activate-corporate) now pass `result.user.locale`.
- `backend/src/routes/userProfile.ts`: `POST /users/me/locale-preference` calls `setLocaleCookie(res, data.locale)` before returning — server-side defense against client-side cookie write failures.
- `backend/src/lib/serializers.ts`: `SerializedUser` gains `locale: string | null` (not sensitive — the frontend has it via cookie anyway, this just plumbs it cleanly through service results).

**SEO posture preserved:** `localeCookie: false` stays — next-intl still does not write `NEXT_LOCALE` on every response. Only our explicit writers (selector, modal, login) set it. Public SSG pages stay cacheable per the original architectural decision documented in `routing.ts:7-14`.

**Consequences:**

- ✅ Santiago's exact bug is fixed. Cookie always wins.
- ✅ Returning users land in their saved locale immediately after login, no client JS needed.
- ✅ Logout fully cleans the browser state. No locale leak between users on shared devices.
- ✅ POST `/users/me/locale-preference` is now resilient to client-side JS failures.
- ✅ Single source of truth for locale resolution: `proxy.ts`. No more dual-authority confusion between `proxy.ts` and next-intl.
- ⚠️ We now own the `Accept-Language` parsing logic that next-intl used to handle. Small, well-isolated function (`detectLocaleFromAcceptLanguage` in `proxy.ts`). Future locale additions need a single change in `routing.locales` to propagate correctly.
- ⚠️ `COOKIE_REDIRECT_PREFIXES` is still a curated list. `/empresas`, `/activar-cuenta`, `/crear-pool` are NOT in it. Bounded-impact (these pages either start a journey before the cookie is set, or are short-lived). Adding them is a quality improvement deferred to a future cycle.

**Related code:**

- Frontend: `frontend-next/src/i18n/routing.ts`, `frontend-next/src/proxy.ts`. Pre-existing writers (untouched): `frontend-next/src/components/LanguageSelector.tsx:120`, `frontend-next/src/components/LocalePreferenceModal.tsx:177`.
- Backend: `backend/src/lib/authCookies.ts`, `backend/src/lib/serializers.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/userProfile.ts`, `backend/src/services/authService.ts` (Prisma selects extended).
- Specs: `LOCALE_RESOLUTION_AUDIT.md`, `LOCALE_RESOLUTION_IMPLEMENTATION.md`.

---

## ADR-065: Mercado Pago / Polar payment-completion parity

**Date:** 2026-05-28 | **Status:** Accepted

**Context:** The Santiago fix in ADR-064 surfaced a question the owner pushed on: are the two payment gateways — Polar (USD, international) and Mercado Pago (COP, Colombia) — capturing the same information and giving the customer the same downstream treatment? A forensic line-by-line audit (`PAYMENTS_PARITY_AUDIT.md`) of `handleOrderPaid` (Polar webhook) vs `processMpPayment` (MP Brick sync) vs `handleMpWebhook` (MP IPN) identified five concrete gaps plus a sixth structural one:

1. **No PaymentEvent for MP sync completions.** The Brick's synchronous `approved` response wrote nothing to `PaymentEvent`. Forensic trail of synchronously-approved MP payments was effectively absent.
2. **No receipt email for MP sync completions.** `sendPaymentReceiptEmail` only ran in the IPN path. Cards that resolved instantly on the Brick (the common case) never triggered the IPN's receipt branch.
3. **Audit row inconsistencies.** Polar wrote `PAYMENT_COMPLETED` post-tx via `fireAndForget`; MP sync wrote `MP_PAYMENT_COMPLETED` post-tx; MP IPN wrote nothing. A tx commit followed by a fire-and-forget failure could leave a COMPLETED PoolPayment with no audit row.
4. **No reconciler for stuck MP rows.** Polar had `paymentReconcileJob` (ADR-060/F-14) but MP did not — leaving 7 rows in production stuck in PENDING (oldest 23 days, 2 paid for ~$228,500 COP each).
5. **No admin notification for MP completions.** `sendAdminNotification` only fired from the Polar handler.
6. **Structural duplication.** Completion side effects (idempotency claim, PoolPayment update, Pool capacity bump, AccountReceivable PAID flip, audit row, receipt, CAPI, GA4, admin notification) were re-implemented inline in three places. Adding a new side effect required edits in three locations with three different orderings.

**Decision:** Consolidate the completion sequence into one shared function and use it from every code path that can complete a payment. Add an MP-specific reconciler symmetrical to Polar's. Persist MP's payment id on first IPN delivery so the reconciler can always look up canonical state.

**Implementation (6 commits, 2026-05-27 → 2026-05-28):**

- **`PoolPayment.mpPaymentId`** (migration `20260527_add_mp_payment_id_and_status_index`) — MP's real `payment.id`, populated by the IPN on first delivery and by the reconciler's search fallback. Required because the legacy `polarCheckoutId` column for MP rows holds our `P4A-{poolId}-{ts}` external reference, not MP's id.
- **Compound index `[status, createdAtUtc]`** — covers both reconcilers' stale-row query. The previous single-column `status` index forced a sequential scan within the bucket to filter by `createdAtUtc`.
- **`markPaymentCompleted` (paymentService.ts)** — single source of truth. Inputs: `paymentId`, `gatewayEventId` (the polarEventId UNIQUE slot), `eventType`, `source` (`POLAR_WEBHOOK` / `MP_SYNC` / `MP_WEBHOOK` / `RECONCILER`), `paidAtUtc`, `polarOrderId`, optional `mpPaymentId`, full `payloadJson`, optional Polar `webhookContext`. Owns an atomic tx (PaymentEvent + PoolPayment + Pool + AccountReceivable + AuditEvent) and a post-tx fan-out (admin notification + CAPI Purchase + GA4 purchase + receipt email). Cheap pre-check on PaymentEvent.findFirst short-circuits known duplicates; the real lock is the partial UNIQUE index inside the tx. Currency/affiliation/transactionId are derived from `source` + `payment.mpPreferenceId`, so the reconciler can call it for either gateway.
- **`AuditEvent` is now inside the tx.** Previously fire-and-forget post-tx. With it inside, a rollback never leaves a `PAYMENT_COMPLETED` audit row claiming a non-event.
- **`PAYMENT_EVENT_SOURCE.MP_SYNC`** — new enum value, distinguishes Brick sync completions from IPN deliveries. The PaymentEvent idempotency key is `mp-{paymentId}-approved` for both sync and IPN, so whichever path lands first claims the slot; the `source` field records who.
- **IPN persists `mpPaymentId` defensively** at the top of `handleMpWebhook`, on every delivery regardless of status. Subsequent deliveries are no-ops (column already set). Outside any branch tx so a downstream rollback doesn't revert the capture.
- **`mpPaymentReconcileJob`** — mirror of `paymentReconcileJob`. Advisory lock `82636506n` (distinct from Polar's `82636503n` and CAPI retry's `82636502n`). Default 30-min cadence (`MP_RECONCILE_CRON`). Batch 50/tick. Resolves the MP payment id from `PoolPayment.mpPaymentId` first; falls back to `searchPaymentByExternalReference(polarCheckoutId)` for legacy rows; marks ABANDONED if neither yields anything past the abandon threshold.
- **Reconciler auto-completes on `approved`.** When MP reports a stuck row was actually paid, the reconciler calls `markPaymentCompleted` with `source: RECONCILER` — same code path as IPN/sync, so the customer gets the receipt email, the pool capacity bumps, CAPI/GA4 fire, and the admin gets notified. Diverges from the Polar reconciler's "flag for human review" posture: Polar's completion side effects are tangled enough that the audit kept it human-mediated; MP's were uniformed by this very ADR, so replaying them is safe.

**Consequences:**

- ✅ Synchronously-approved MP cards now get a PaymentEvent row, an AuditEvent row, a receipt email, an admin notification, a CAPI Purchase event, and a GA4 purchase event. Identical to Polar's downstream treatment.
- ✅ A tx rollback never produces an audit row claiming success — audit is atomic with the state change.
- ✅ Stuck rows (the 7 found in prod + any future occurrence) self-resolve within one cron tick. Customers who paid no longer wait indefinitely for pool capacity.
- ✅ Single source of truth for completion. Adding a new side effect is one edit in `markPaymentCompleted`, propagates to all four callers automatically.
- ✅ Forensic trail uniform across gateways and sources. `PaymentEvent.source` makes the provenance queryable: Polar webhook vs MP IPN vs MP sync vs reconciler.
- ⚠️ Behaviour change for IPN deliveries that arrive AFTER the sync path already completed: previously the IPN wrote a `PaymentEvent` row for `mp-{id}-approved` with `source=MP_WEBHOOK`; now the sync's `MP_SYNC` row wins and the IPN dedupes silently via UNIQUE. Trade-off: one row instead of two; forensic trail is the sync's. Acceptable — the IPN provides no information the sync didn't already capture.
- ⚠️ The reconciler's auto-complete posture (vs Polar's flag-for-human-review) accepts that markPaymentCompleted has been rigorously vetted in this ADR's audit. If the function ever changes substantively, the reconciler's behaviour changes with it — invariant 13 protects against accidental drift.
- ⚠️ `searchPaymentByExternalReference` was added to the MP client. Used only by the reconciler's legacy fallback. After the 7 stuck rows are resolved, this path runs only for rows that never receive any IPN at all (a rare scenario).

**Related code:**

- Schema: `backend/prisma/schema.prisma` (`PoolPayment.mpPaymentId` + compound index), migration `20260527_add_mp_payment_id_and_status_index`.
- Service: `backend/src/services/paymentService.ts` (`markPaymentCompleted`, `findStaleMpPayments`, `reconcileStaleMpPayment`, refactored `handleOrderPaid` / `processMpPayment` / `handleMpWebhook`).
- Job: `backend/src/jobs/mpPaymentReconcileJob.ts` (registered in `backend/src/server.ts`).
- Lib: `backend/src/lib/paymentEvents.ts` (`PAYMENT_EVENT_SOURCE.MP_SYNC`, `RECONCILER_EVENT_TYPE.FAILED`), `backend/src/services/mercadopago/client.ts` (`searchPaymentByExternalReference`).
- Specs: `PAYMENTS_PARITY_AUDIT.md`, `PAYMENTS_PARITY_IMPLEMENTATION.md`.
- Commits: `9e85fa9` (schema), `a062d1c` (markPaymentCompleted), `5881f9a` (MP refactor), `c15f843` (defensive mpPaymentId), `78efdd2` (reconciler).

---

## ADR-066: Payment-attempt client-side telemetry (MP Brick visibility)

**Date:** 2026-05-28 | **Status:** Accepted

**Context:** On 2026-05-28 the owner attempted two payments on Mercado Pago and asked: "cuando un usuario da click en pagar, saber si solo cerró la ventana y no lo hizo, o hizo click en volver, o qué pasó." Forensic audit of his two attempts (PoolPayments `f543a1a9`, `f7cf0bde`) showed both in PENDING with `mpPaymentId=NULL` and PaymentEvent sequence ending at `CLIENT REDIRECT_INITIATED` — the backend had zero signal about what happened after he reached `/pago/checkout`. The 7 stuck MP rows the reconciler resolved on the same day (ADR-065) had the same forensic dead-end.

`PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md` mapped five concrete gaps:

1. **G-1.** MP Brick load success/failure invisible — `onReady` and `onError` only wrote to local React state.
2. **G-2.** MP Brick tab-close invisible — no `beforeunload` listener.
3. **G-3.** MP Brick had no visible cancel exit — only a hardcoded "← Volver" link that called `router.back()` and silently navigated.
4. **G-4.** `CLIENT_ERROR` enum value was documented but never emitted from anywhere in `frontend-next/`.
5. **G-5.** `REDIRECT_FAILED` only catches synchronous `window.location.href` throws — async navigation aborts (CSP, popup blocker) are missed. **Out of scope for this ADR.**

**Decision:** Three new `CLIENT_EVENT_TYPE` values (`BRICK_LOADED`, `BRICK_ERROR`, `USER_CLOSED_TAB`), `navigator.sendBeacon` transport for the unload-safe event, and a visible Cancel button on `/pago/checkout` that emits `USER_CANCELLED`. Polar is unchanged — out-of-domain limits prevent equivalent instrumentation; the existing `/pago/cancelado` flow already covers deliberate cancellations from polar.sh.

**Locked decisions (PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md §3, confirmed via AskUserQuestion):**

- **3.1 Taxonomy:** new specific event types instead of reusing `CLIENT_ERROR` with discriminating details. Queryable directly in SQL (`WHERE eventType = 'BRICK_LOADED'`) without parsing the payload JSON.
- **3.2 Cancel button:** yes, with a beacon. Resolves the "back vs close" ambiguity that the audit's gap inventory called out as the owner's primary question.
- **3.3 `beforeunload` scope:** only `/pago/checkout`. Adding it on the pool-capacity tab pre-Polar-redirect window would noise on every legitimate navigation and add no signal Polar can't already give us via `/pago/cancelado`.
- **3.4 Transport:** `navigator.sendBeacon` via a new `reportPaymentAttemptEventBeacon` helper. `fetch()` does not survive page unload; mixing transports in one function would hide that operational difference.
- **3.5 CORS:** `text/plain` Blob (sendBeacon-friendly, simple-request, no preflight). Backend route teaches itself to parse `text/plain` bodies via a dedicated 8kb `express.text()` middleware mounted only on this route.

**Implementation (5 commits, 2026-05-28):**

- `e705992` — `CLIENT_EVENT_TYPE` enum extended; route accepts `text/plain` body with 8kb cap. Additive backend change (column is TEXT — no migration).
- `c6b6064` — `reportPaymentAttemptEventBeacon` helper; local `ClientEventType` union mirrors backend.
- `b8da1fa` — `/pago/checkout` emits `BRICK_LOADED` from `onReady`; `BRICK_ERROR` from `onError` with stage=`init`/`render`; outer SDK-load catch also emits `BRICK_ERROR` with stage=`init`, phase=`sdk_load_or_instantiation`. A `brickReadyRef` distinguishes the two stages without relying on React state lag.
- `f7cafac` — `beforeunload` listener emits `USER_CLOSED_TAB` via sendBeacon with `{ brickStatus, msOnPage, hadBrickLoaded, gateway }`. Cancel button rewritten as i18n'd exit emitting `USER_CANCELLED`. `suppressUnloadRef` flipped before deliberate navigations so beforeunload does not double-count. i18n key `payment.checkout.cancel` added to ES/EN/PT.
- `<this commit>` — ADR-066, BUSINESS_RULES §19, MEMORY entry.

**Consequences:**

- ✅ For any MP payment attempt the audit log distinguishes six exit states: paid, rejected, cancelled-via-button, closed-tab, broken-form-render, SDK-failed-init. The owner's exact question is answerable by reading `PaymentEvent` rows ordered by `createdAtUtc`.
- ✅ Brick failures pre-`onReady` (SDK fetch, instantiation throw) are no longer invisible — the outer try/catch emits `BRICK_ERROR(init)`.
- ✅ The Cancel button is i18n'd, deterministic (no `router.back()` weirdness for fresh-tab users), and matches the locale chosen by the user.
- ⚠️ `sendBeacon` returns silently false on some browsers if the page is shutting down faster than the queue can flush. Acceptable — the audit log accepts intermittent loss; a missing `USER_CLOSED_TAB` is no worse than today's zero coverage.
- ⚠️ `BRICK_ERROR` `stage` is inferred from `brickReadyRef`. If MP changes `onReady`/`onError` semantics in a future SDK version the classification could drift. We re-validate manually if the SDK major-bumps.
- ⚠️ Polar lifecycle visibility is unchanged. The cycle is intentionally MP-focused — Polar's hosted checkout is out-of-domain and the existing `USER_CANCELLED` from `/pago/cancelado` already covers the deliberate-cancel case.
- ⚠️ The wizard's MP flow (`PoolCreationWizard.tsx`) routes users through the SAME `/pago/checkout` page (verified at code level), so it inherits the new telemetry automatically. No separate wizard work needed.

**Related code:**

- Backend: `backend/src/lib/paymentEvents.ts` (enum), `backend/src/routes/payments.ts` (text/plain parser).
- Frontend: `frontend-next/src/lib/api/paymentAttemptEvent.ts` (sendBeacon helper), `frontend-next/src/app/[locale]/pago/checkout/page.tsx` (beacon emit sites + Cancel button), `frontend-next/src/messages/{es,en,pt}/payment.json`.
- Specs: `PAYMENT_ATTEMPT_TELEMETRY_AUDIT.md`, `PAYMENT_ATTEMPT_TELEMETRY_IMPLEMENTATION.md`.

---

## ADR-067: Applying a transfer-paid Cuenta de Cobro to a pool

**Date:** 2026-06-02 | **Status:** Accepted

**Context:** A Cuenta de Cobro (CC) is a billing document, not a prepay. It can be paid two ways (owner-confirmed model): **(A) with the redemption code via card** (MP/Polar) — automatic, `paymentService.initiateCheckout` locks the CC `PENDING→REDEEMED` and `markPaymentCompleted` expands the pool; or **(B) by bank transfer** — the client wires the money, the admin reconciles by hand and applies the capacity to the pool the client names.

Leg (B) was broken in half. `PATCH /admin/sales/account-receivables/:id/status → PAID` (`markAccountReceivablePaid`) only flipped the status — it took no `poolId`, created no `PoolPayment`, expanded no capacity. So a transfer-paid CC ended up `PAID` with `poolPaymentId = null` and the capacity never applied (the CC-2026-0002 / Native Intelligence incident, resolved by a one-off script on 2026-06-02 before this ADR). There was no clean, repeatable path — and it would recur for every corporate client paying by transfer.

**Decision:** Add an admin "register payment and apply" path that produces the exact same final state as a completed card redemption, without charging again.

**Implementation:**
- **Service** `applyPaidAccountReceivableToPool({ ccId, poolId, adminUserId })` (`accountReceivableService.ts`), one transaction: mark `PAID` if not already → create a `COMPLETED` `PoolPayment` attributed to the pool's host (`polarOrderId = "manual-cc-{consecutive}"`) → expand `Pool.maxParticipants` to `cc.targetCapacity` (+ reset capacity-notification flags) → link the CC (`poolPaymentId`, `redeemedAtUtc`, `redeemedByUserId`) → `AuditEvent` (`appliedManually`, `method: "bank_transfer"`).
- **Single-apply lock:** `poolPaymentId != null` is the guard — a CC can only ever be applied to one pool; a second attempt is `409 ALREADY_APPLIED`. Also rejects `CANCELLED`/`EXPIRED`/`REDEEMED` and nothing-to-apply (capacity already ≥ target).
- **Endpoints:** `POST /admin/sales/account-receivables/:id/apply { poolId }` + `GET /admin/sales/pools/search?q=` (pool picker by name or host email).
- **Confirmation email:** reuses `sendPaymentReceiptEmail` (it already renders pool, capacity change, amount, CC consecutive) — fire-and-forget, sent to the CC's contact.
- **UI:** a button + pool-search modal on the CC detail screen (admin, Spanish-only like the rest of `admin/ventas`).

**Decisions taken (owner, 2026-06-02):**
- **No re-pricing / no drift handling.** The CC amount the client paid is the source of truth; the price will not change. (Diverges from the card-redemption drift guard in ADR-061 — intentional, scoped to leg B.)
- **One button** ("register payment and apply"): marks PAID if needed and applies in one step (idempotent via the single-apply lock).
- **CC stays `PAID`** after applying (no new status); `poolPaymentId` is the "applied" signal.

**Consequences:**
- ✅ Transfer-paid CCs have a clean, audited, repeatable application path; no more manual scripts.
- ✅ Capacity always flows through a `PoolPayment` with a contable trace (respects the ADR-061 invariant) and the CC is locked against double application.
- ⚠️ The `PoolPayment` is attributed to the pool's host, who may differ from the CC's contact email (cross-account case). Intentional — the capacity belongs to the pool; the audit row records the CC.
- ⚠️ No drift guard on leg B by design; if pricing ever does change, a transfer-paid CC applies at its original amount. Acceptable per the owner.

**Related code:**
- Backend: `backend/src/services/sales/accountReceivableService.ts` (`applyPaidAccountReceivableToPool`, `searchPoolsForCcApply`), `backend/src/routes/adminSales.ts`.
- Frontend: `frontend-next/src/lib/api/sales.ts`, `frontend-next/src/components/AdminCcDetailContent.tsx`.
- Spec: `SALES_CC_APPLY_PLAN.md`.

---

## ADR-068: picks4all-scores v2 contract — timeline-derived scoring, confirmation gate, stale detection

**Date:** 2026-06-02 | **Status:** Accepted

**Context:** The scores service was reworked into a **monotonic** state machine (a match never regresses; terminal states `FT`/`AET`/`PEN`/`ABD` are final) and now exposes a per-match `timeline[]` of confirmed milestones. As part of that rework `fulltime*`/`halftime*`/`extratime*` are **always `null`**. Two things broke or were exposed on the Picks4All side:

1. **Minute-90 score derivation.** `liveScoresJob` computed `homeGoals90/awayGoals90` from `score.fulltimeHome` (`homeGoals90 = wentToExtraTime ? score.fulltimeHome : null`). With that field now always `null`, any single match that goes to extra time (the final, one-leg knockouts) would lose its regulation score, so phases configured `includeExtraTime=false` would score off the post-ET result.
2. **Silent limbo.** The 30-may Champions final sat as `SCRAPER_PROVISIONAL 1-1` forever: the old scraper regressed to `NS`, which blocked both scraper finalization and the API-Football fallback, and nobody was alerted (`SCORING_RESULTS_AUDIT.md` §8). The monotonic machine prevents the `NS` regression, but the platform still had no time-based safety net of its own.

**Decision:** Adopt the v2 contract on the Picks4All side with the timeline as the source of truth for period scores and confirmations, plus our own time-based safety nets (the scraper deliberately never closes by time).

**Implementation:**
- **Client** (`scoresService/client.ts`): `LiveScore.timeline?: TimelineEvent[]`; typed `ScoresServiceError` (`isUnavailable` 503 / `isAuthError` 401·403 / `isRateLimited` 429 + `Retry-After`).
- **Minute-90** (`scoresService/timeline.ts` · `deriveNinetyMinuteScore`): the regulation score = the `ET` milestone's goals (the score with which ET began); `null` when the match never reached ET (then `homeGoals/awayGoals` already are regulation) or when ET was reached but the `ET` milestone is missing (no invented value). Penalties never affect goals90.
- **Confirmation gate** (`liveScoresJob`): finalization to `API_CONFIRMED` requires the terminal `timeline[]` milestone to be confirmed by ≥ `SCORES_MIN_CONFIRMATIONS` (default **3**) sources (`terminalConfirmationCount`); below that the match stays `AWAITING_FINISH`. Falls back to live `sourcesAgreeing` when `timeline[]` is absent (legacy feed).
- **ABD terminal:** `ABD` added to `FINISHED_STATUSES` so an abandoned match is recognized as over (and routed through the same gate) rather than polled forever. The duplicated local list in `adminService.ts` now reuses the canonical constant.
- **Stale detector** (`scoresService/staleDetector.ts`): throttled scan (`SCORES_STALE_SCAN_INTERVAL_MS`, default 5 min) for AUTO matches whose `MatchSyncState` is not `COMPLETED` more than `SCORES_STALE_THRESHOLD_MS` (default **210 min**) after kickoff → one-time admin alert, idempotent via a `MATCH_STALE_DETECTED` audit event; runs even when the scraper is down.
- **Undecidable-knockout safeguard** (`structuralAutoPublish.ts`): when a knockout result is authoritative (`API_CONFIRMED`/`HOST_OVERRIDE`) but no winner is derivable (draw without penalties, or penalties tied), a one-time admin alert (`KNOCKOUT_WINNER_UNDECIDABLE`) instead of waiting forever.

**Decisions taken (owner, 2026-06-02):** stale threshold **210 min** (covers 90' + HT + stoppage + full ET + penalties + margin); confirmation threshold **≥3** sources; the stuck 30-may final is unstuck by a separate one-off host override action, independent of this deploy.

**Consequences:**
- ✅ Single matches with extra time score correctly off the regulation result; the limbo failure mode is now caught and surfaced within ~210 min even if every automatic path fails.
- ✅ No schema migration — idempotency uses audit events, not a new `MatchSyncStatus`.
- ⚠️ A match the scraper can never confirm with 3 sources won't auto-finalize via the scraper; it relies on the API-Football fallback and, failing that, the stale alert + a manual override. Intentional (correctness over speed).
- ⚠️ `STALE_THRESHOLD = 210 min` assumes no legitimate match runs longer; a rare long suspension would alert. Acceptable — an alert, not an auto-action.

**Related code:** `backend/src/services/scoresService/{client,timeline,staleDetector}.ts`, `backend/src/jobs/liveScoresJob.ts`, `backend/src/services/apiFootball/types.ts`, `backend/src/services/structuralAutoPublish.ts`, `backend/src/lib/constants.ts` (`SCORES`).
**Spec / audit:** `SCRAPER_INTEGRATION_PLAN.md`, `SCORING_RESULTS_AUDIT.md`.

---

## ADR-069: Leaderboard tiebreakers + shared positions + single ranking source

**Date:** 2026-06-08 | **Status:** Accepted

**Context:** The leaderboard had a single, non-sporting tiebreaker — `joinedAtUtc` ascending (`poolOverviewService.ts`) — and assigned `rank = idx + 1`, so two players with identical points got different ranks (the earlier joiner silently "won"). There were no perfect/partial-based tiebreakers, and tied players never shared a position. Separately, the pool-completed email computed its own simplified 3/5-point OUTCOME/SCORE scoring (`poolStateMachine.ts`) that diverged from the real leaderboard in advanced/structural configs.

**Decision:** Tiebreaker order: **(1) points → (2) # perfect hits → (3) # partial hits → (4) shared position** (the organization decides the final tie). One ranking function is the single source of truth for both the leaderboard and the email.

**Implementation:**
- **`lib/leaderboardRanking.ts`** (`rankLeaderboardRows`): sorts by points → perfectCount → partialCount → joinedAt (stable order only), and assigns **shared "1-2-2-4" competition ranks** (players equal on all three visible criteria share a rank; the next group jumps past the tie). Returns `tiedGroupSize`.
- **Perfect/partial (config-agnostic):** "perfect" = earned the **maximum achievable** for that match (computed as the score of a prediction equal to the result — result-independent, cached per phase; respects the XOR `PARTIAL_SCORE` which never co-occurs with an exact hit). "partial" = `0 < earned < max`. Structural (D3): perfect += perfect groups + correct knockout winners; partial += groups with some-but-not-all positions. Counted by **units** so volume across phases breaks ties (5 correct R32 winners rank above 1 correct final). Does NOT use `calculateMaxPointsForPhase` (it sums all enabled types incl. partial → overstates; also unused).
- **`partialApplicable` (D4):** the partial column is shown only when the mode can produce a partial (≥2 enabled match criteria, or a GROUP_STANDINGS phase); hidden in all-or-nothing modes (e.g. exact-score-only).
- **Email unified (D6):** `poolStateMachine` now calls `getPoolOverview` and uses `leaderboard.rows` (correct points + tiebreakers + shared rank), removing its divergent inline scoring.
- **Frontend:** desktop + mobile leaderboards key the medal/highlight off the shared rank, show perfect/partial counters under the name (when meaningful), mark tied rows, and show a banner when 1st place is tied. Rules display gains a tiebreaker note (ES/EN/PT).
- **No scoring formula changed.**

**Decisions taken (owner, 2026-06-08):** D1 perfect = max achievable; D2 partial = `0<x<max`; D3 structural counted by units (perfect groups + correct knockouts + partial groups); D4 hide partial column where N/A; D5 shared rank "1-2-2-4"; D6 unify email now.

**Consequences:**
- ✅ Ties are resolved by performance, then shared honestly; the email never diverges from the table.
- ⚠️ Changing `rank = idx+1` to shared ranks changes the **displayed** rank of every existing pool with a points tie (correct, but visible to all users on deploy).
- ⚠️ "Perfect-via-exact-simulation" understates the max in a pathological config where PARTIAL_SCORE is worth more than a full hit; not a real configuration.

**Related code:** `backend/src/lib/leaderboardRanking.ts`, `backend/src/services/poolOverviewService.ts`, `backend/src/services/poolStateMachine.ts`, `frontend-next/.../PoolLeaderboardTab.tsx`, `frontend-next/src/components/{MobileLeaderboard,PickRulesDisplay}.tsx`.
**Related (D7, same cycle):** `TournamentInstance.isTest` excludes test instances from the public catalog (`routes/catalog.ts`) — root-cause fix for the "test instance stuck in prod" incident.
**Spec:** `TIEBREAKER_PLAN.md`.

---

## ADR-070: Estratega deadlines — per-group lock on every write path, structural notifications, deadline UX

**Date:** 2026-06-10 | **Status:** Accepted

**Context:** Estratega (SIMPLE preset) pools take structural picks — group standings order and knockout winners — never per-match `Prediction` rows. After `9481d63` stopped counting structural-phase matches as "missing picks" (false positives), three gaps remained. **(1) Integrity:** group picks live in TWO storages that both score (`GroupStandingsPrediction` rows and `StructuralPrediction.pickJson.groups`, merged in `poolAdminService`/`poolOverviewService`), but only the dedicated `PUT /group-standings/:phaseId/:groupId` endpoint enforced the group deadline — `PUT /structural-picks/:phaseId` with a `{groups}` payload saved without any lock AND replaced the whole `pickJson`, so a direct API call after kickoff could add or erase group picks and still score. **(2) Utility:** neither the notifications banner nor the deadline-reminder emails knew about structural units — Estratega members got zero warnings. **(3) UX:** the cards never showed the lock time; users discovered the deadline only when the save failed with a raw `DEADLINE_PASSED` code.

**Decision:** One shared lock rule, enforced on every write path and surfaced everywhere:

```
groupLockUtc = min(kickoffUtc of the group's matches) - deadlineMinutes
matchLockUtc = kickoffUtc - deadlineMinutes
```

- **Single source:** `buildGroupLockTimes` in `lib/poolHelpers.ts` (+ `partitionGroupPicksByLock`, `mergeGroupPicks`) — consumed by the dedicated group-standings endpoint (refactored), the structural-picks route, notifications, and reminders. A group locks at its **earliest** kickoff because the first result starts revealing the real table.
- **Mirror semantics with the knockout path:** locked/unknown units in a payload are dropped, the rest saved; merge preserves locked units verbatim (no post-lock erase); `409 DEADLINE_PASSED` + `lockedGroupIds` only when every submitted unit is locked.
- **Fail-open on malformed fixtures:** a group with no parseable kickoff never locks (`lockTimeMs = Infinity`), matching match-based behavior; a previously latent quirk where ONE bad kickoff date disabled the lock for the whole group (NaN via `Math.min`) is fixed — the earliest *parseable* kickoff governs.
- **Notifications/reminders (delivery 2):** `pendingPicks` becomes the total of pending units (match picks + unsaved groups + unpicked knockouts); detail arrays `urgentGroups[]` / `urgentKnockouts[]` are additive (backward-compatible). Reminder dedupe reuses `DeadlineReminderLog.matchId` with the synthetic key `group:{phaseId}:{groupId}` — no migration.
- **UX (delivery 3):** cards show the lock time in the **user's** timezone (consistent with `MatchCard`; emails keep the pool's timezone), lock client-side at `lockTime`, and map `DEADLINE_PASSED` to friendly copy (ES/EN/PT).

**Owner decisions (2026-06-10):** D1 synthetic dedupe key (no migration); D2 `pendingPicks` = total units; D3 user TZ in cards / pool TZ in emails; D4 keep the `{groups}` route, protected (option A); D5 ship order: integrity → notifications → UX.

**Consequences:**
- ✅ The fairness hole closes: no write path can score a post-kickoff group pick, and locked picks cannot be erased.
- ✅ The lock rule lives in one helper — drift between paths is no longer possible.
- ⚠️ The first reminder tick after deploy will email every Estratega member with unsaved groups inside the 48h window (intended — World Cup opener); dedupe caps it at one email per user/group.
- ⚠️ `{groups}` saves now merge instead of replace: a client can no longer clear a group pick by omitting it (clearing was never a product feature; the dedicated endpoint never allowed it).

**Related code:** `backend/src/lib/poolHelpers.ts`, `backend/src/routes/structuralPicks.ts`, `backend/src/services/{groupStandingsService,poolAdminService,deadlineReminderService}.ts`, `backend/src/lib/{email,emailTemplates}.ts`, `frontend-next/src/components/{groupStandings/GroupStandingsCard,KnockoutMatchCard,PickRulesDisplay}.tsx`.
**Spec:** `ESTRATEGA_DEADLINES_PLAN.md`.

---

## ADR-071: Rate limiting — client IP resolution (trust proxy 2) + per-identity bucket keying

**Date:** 2026-06-11 | **Status:** Accepted

**Context:** During WC-eve (2026-06-10) users were blocked all day by `TOO_MANY_LOGIN_ATTEMPTS` / `RATE_LIMIT_EXCEEDED` / join failures, despite a morning mitigation that raised limits via Railway env vars. Forensic investigation (full evidence log: `RATE_LIMIT_INCIDENT_2026-06-10.md`) **proved** the root cause: `app.set("trust proxy", 1)` while Railway's proxy chain has TWO hops. The edge (CDN77/DataCamp "hikari") appends itself to `X-Forwarded-For`, so the chain arrives as `"client_ip, edge_ip"`; with `1`, Express resolved `req.ip` to the **edge node**. Production data: 24h of `AuditEvent` showed **37 distinct IPs for 1,950 distinct users** (top edge IP: 967 users). Every "per-IP" limit was effectively a near-global limit per edge node — `authLimiter` 10/15min and `poolJoinLimiter` 10/15min (never raised by env) throttled the whole platform. Raising bucket sizes could never fix a shared-bucket problem. Collateral: `AuditEvent.ip` forensics polluted; API traffic verified NOT behind Cloudflare (`cf-ipcountry` undefined → see pending payments-country issue).

**Decision:**
1. **`trust proxy = 2`** — with the verified 2-hop chain, `req.ip` becomes the entry the edge wrote: the real client. Spoof-safe: a client-forged XFF lands further left and is never reached while the trusted hop count ≤ real honest hops. Verified empirically before AND after deploy by injecting a request and reading the logged chain / `RateLimit-Remaining` headers.
2. **`ipv6Subnet: 64`** on every limiter (library default /56 can span hundreds of subscribers on IPv6-first CO mobile carriers).
3. **Per-identity keying where identity exists** (phase 2 of the fix):
   - `poolJoinLimiter` → keyed by `userId` (endpoint is authenticated; `poolsRouter.use(requireAuth)` runs first), IP fallback.
   - `authLimiter` → keyed by `email|IP` (express.json runs before it, so `req.body.email` is available): brute force on one account from one IP is capped without collectively punishing a CGNAT/NAT/VPN crowd. A separate **per-IP ceiling** (`authIpLimiter`) bounds email-rotation credential stuffing from a single IP.
   - `apiLimiter` stays per-IP (it runs before any auth middleware, so no identity is available) sized as a **CGNAT ceiling** — app-level rate limiting is abuse throttling, not DoS protection (that belongs at the edge).
4. **Env values re-tuned to per-client scale** after the keying fix (the morning's 2000-5000 values were calibrated for shared edge buckets and are brute-force-friendly per client).

**Consequences:**
- ✅ A user's limits depend on their own behavior, not on how many neighbors share their carrier IP or edge node.
- ✅ `AuditEvent.ip`, payment fraud signals (CAPI) and any `req.ip` consumer now record the real client. Historical rows before 2026-06-11 contain edge IPs — flagged for forensics.
- ⚠️ If Railway ever changes its proxy chain depth, `trust proxy` must be re-verified (test: `GET /payments/country` logs the full XFF chain).
- ⚠️ In-memory store: counters are per-replica (single replica today).

**Related code:** `backend/src/server.ts` (trust proxy), `backend/src/middleware/rateLimit.ts` (all limiters + keying).
**Forensic log:** `RATE_LIMIT_INCIDENT_2026-06-10.md`.

---

## ADR-072: Single additive scoring engine — EXACT_SCORE never short-circuits

**Date:** 2026-06-11 | **Status:** Accepted

**Context:** First live support report of the World Cup (host of pool "Apuesta Familia", 11 members, during México–Sudáfrica): with host-configured rules Outcome=3 / GoalDiff=1 / Exact=1, players who picked the exact score (1-0) showed **1 point** on the leaderboard while players who picked 2-1 showed **4 points**. Root cause: `scoreMatchPick` had two engines selected by a fragile heuristic (`isCumulativeScoring` = config has HOME_GOALS/AWAY_GOALS enabled). Configs without per-side goals fell into a "legacy" branch where a matched EXACT_SCORE **terminated evaluation and paid only its own points** — so the best possible prediction could earn less than a near miss. The product's own UI always promised additive semantics: the wizard describes EXACT_SCORE as *"Bonus por acertar ambos marcadores"* and the player rules screen lists criteria as independent point sources. Production scope (verified by read-only probe): 648 pools → 576 cumulative (unaffected), 55 single-criterion (unaffected), **17 multi-criteria "legacy" pools (8 ACTIVE, ~90 members, all WC 2026, created via the custom rules editor; 2 with the full inversion paradox; 0 COMPLETED → zero historical impact)**.

**Decision:**
1. **One additive engine for all configs** (`scoreMatchPick`): every enabled criterion evaluates independently and matched criteria SUM. EXACT_SCORE is an additive bonus; PARTIAL_SCORE stays XOR (one side only — both sides = EXACT_SCORE territory) so it never pays together with EXACT_SCORE. The legacy short-circuit branch and the mode heuristic are deleted.
2. **`generateMatchPickBreakdown` mirrors the engine exactly** (same criteria, same semantics) and `maxPoints` is the sum of enabled types everywhere (`calculateMaxPointsForPhase` included).
3. **Player-facing copy fixed** (`rulesDisplay.nonCumulativeNote` ×3 locales): it stated the opposite ("solo ganas los puntos del exacto") — now describes additive scoring.
4. Deployed mid-matchday on purpose: points are computed on read (never stored), so the fix corrects every leaderboard instantly and retroactively; shipping before the first match finalized meant members never saw a wrong "final" score.

**Consequences:**
- ✅ An exact-score pick can never earn less than a worse pick on the same match (monotonicity restored).
- ✅ Engine, breakdown modal and rules screen all tell the same story.
- ⚠️ In the 6 non-paradox legacy-multi pools, exact hits now pay MORE than the old short-circuit did (e.g. Outcome=3/Exact=5 pays 8, not 5) — this matches the wizard's "Bonus" promise, and no result had finalized when it shipped.
- ⚠️ BASIC-style single-criterion pools (EXACT only) are numerically identical under both semantics.

**Related code:** `backend/src/lib/scoringAdvanced.ts`, `backend/src/lib/scoringBreakdown.ts`, `backend/src/types/pickConfig.ts`, `frontend-next/src/messages/{es,en,pt}/pool.json`.
**Support report:** email "INCONVENIENTES CON LOS MARCADORES EN TIEMPO REAL", 2026-06-11.

---

## ADR-073: PARTIAL_SCORE is inclusive — "at least one side", not XOR

**Date:** 2026-06-11 | **Status:** Accepted

**Context:** Second support report of the inaugural matchday (host of pool "Slaski Szpil World Cup 2026", 6 members): all five players hit the exact 2-0 and earned **16 of an advertised 21** (`MATCH_OUTCOME=10, EXACT=5, TOTAL_GOALS=1, PARTIAL=5`). The host demonstrated — with screenshots of the wizard's **Example calculator** — that the product itself promised an exact pick earns ALL criteria including partial. Investigation confirmed a three-way contradiction: the engine and breakdown treated `PARTIAL_SCORE` as **XOR** (one side only; both sides = pays nothing), the **calculator** evaluated it as inclusive OR ([ScoringEditor.tsx] `realHome === predHome || realAway === predAway`), and the copy disagreed with itself (`pickTypeDescriptions`: "al menos uno" = inclusive; `pickTypeExtended`: "NO ambos a la vez" = XOR; PRD said inclusive, BUSINESS_RULES/GLOSSARY said XOR). Under XOR the advertised per-match maximum (sum of enabled criteria — shown as "/21" in the breakdown header and used by `calculateMaxPointsForPhase`) was **unreachable by construction**.

**Decision:** `evaluatePartialScore` = `homeMatch || awayMatch` (inclusive). An exact pick satisfies "at least one side" and earns the partial points too, making the advertised maximum reachable. The calculator is the contract hosts design their rules with — it already behaved this way and is untouched. Copy unified to inclusive ×3 locales (`pickTypeExtended.PARTIAL_SCORE`, `poolWizard.criteriaDesc.PARTIAL_SCORE`); breakdown detail for the both-sides case now reads "Acertaste ambos marcadores".

**Verified blast radius (read-only prod probes before coding):** only **5 pools ever enabled PARTIAL_SCORE** (3 DRAFT with no results, 2 ACTIVE, **0 COMPLETED → zero historical impact**). Simulation over all 5 real configs proved the three invariants: (I1) exact pick = advertised max in every pool; (I2) **non-exact picks are bit-identical under both semantics** — nobody loses a point; (I3) monotonicity holds. Slaski's five exact hitters: 16 → 21, uniform.

**Consequences:**
- ✅ Engine, breakdown, calculator, copy, PRD, BUSINESS_RULES and GLOSSARY now state the same rule.
- ✅ `maxPoints` (naive sum of enabled) is truthful everywhere; the leaderboard's probe-derived max and the modal max reconcile automatically.
- ⚠️ "Partial as consolation prize" (XOR) is no longer expressible; hosts who want that effect can price EXACT_SCORE higher.

**Related code:** `backend/src/lib/scoringAdvanced.ts` (`evaluatePartialScore`), `backend/src/lib/scoringBreakdown.ts`, `frontend-next/src/messages/{es,en,pt}/{pool,poolWizard}.json`, `docs/BUSINESS_RULES.md` §6.3, `docs/GLOSSARY.md`.
**Support report:** email "Points rules problem" (Poiu, siptrenujemy@gmail.com), 2026-06-11.

---

## ADR-074: Confirmed-results backfill on pool activation

**Date:** 2026-06-11 | **Status:** Accepted

**Context:** `liveScoresJob` fans results out only to **ACTIVE** pools, and only while a match sits inside the polling window (kickoff −pre/+post hours). A pool that transitions DRAFT → ACTIVE *after* matches of its tournament already finished therefore never receives those results — **permanently**: group tables stay incomplete, `transitionToCompleted` can never fire (it requires a FINAL result for every match), and the Estratega structural derivations for finished groups never run. Discovered on inaugural matchday via the owner's DRAFT test pool showing an all-zeros group table; prod scan showed 0 ACTIVE pools affected *that day* (all existed before kickoff), but every pool created during the month-long World Cup group stage would hit it.

**Decision:** New `resultBackfillService.backfillConfirmedResultsForPool(poolId)`, invoked fire-and-forget from `transitionToActive` (activation never fails because of the backfill). It seeds `PoolMatchResult` rows for every snapshot match whose **`MatchSyncState.syncStatus === "COMPLETED"`** — i.e., matches the scraper pipeline itself finalized — using the confirmed `LiveScore` snapshot persisted in `lastLiveDataJson` (the same payload `finalizeResult` wrote into sibling pools): `source = API_CONFIRMED`, goals90 derived from `timeline[]`, penalties included. After seeding it runs `autoPublishStructuralResults` per match (Estratega tables/knockouts derive) and an idempotent `transitionToCompleted` check.

**Boundaries (explicit):**
- Idempotent — matches with an existing result version (any source) are never touched; concurrent `liveScoresJob` publishes win unique races harmlessly.
- MANUAL-mode instances are a no-op (no scraper pipeline to backfill from).
- Matches resolved **only** via admin master override while the scraper was stuck are NOT seeded (their `MatchSyncState` never reached COMPLETED; no trustworthy instance-level snapshot) — the master override panel remains the tool for those.
- Silent: no member emails; one `RESULTS_BACKFILLED_ON_ACTIVATION` audit event summarizes the seeding.

**Consequences:**
- ✅ Pools created/activated mid-tournament get complete tables and can complete normally.
- ✅ Re-activation after revert-to-draft is a no-op (results were preserved by the revert).
- ⚠️ Static import cycle `poolStateMachine ↔ resultBackfillService` is intentional and safe (both sides dereference only at call time; verified on compiled CJS output).

**Related code:** `backend/src/services/resultBackfillService.ts`, `backend/src/services/poolStateMachine.ts` (`transitionToActive`).

---

## ADR-075: "Capricho San" — env-allowlisted gifted features; random score on missed deadline

**Date:** 2026-06-11 | **Status:** Accepted

**Context:** The owner wanted to gift a friend's pool a playful house rule: players who let a match's pick deadline pass without predicting receive a RANDOM score (uniform integer per team, host-configurable range, e.g. 0–4) instead of simply earning nothing. The feature must exist ONLY in that pool, never silently affect anyone else, and be unmistakably transparent to every player.

**Decision:**
1. **Env-allowlist gating pattern:** `CAPRICHO_SAN_POOL_IDS` (comma-separated pool IDs) is the single availability switch — no pool IDs in code (per the zero-hardcode standard), gifting another pool is a Railway variable change. The backend exposes `pool.caprichoSan.available` in the overview; the host settings card renders only when true. The settings route rejects writes for non-allowlisted pools (`FEATURE_NOT_AVAILABLE`), and the job re-checks the allowlist per pool (defence in depth).
2. **Host controls:** toggle + min/max goals (hard bounds 0–9, min ≤ max) via the existing `PATCH /pools/:poolId/settings` (OWNER only, audited as `POOL_SETTINGS_UPDATED`). Stored in three new `Pool` columns (`caprichoSanEnabled/Min/Max`, additive defaults).
3. **Assignment job** (`caprichoSanJob`, 60 s; does not even start when the allowlist is empty): for enabled ACTIVE pools, matches in `requiresScore` phases whose deadline passed within the lookback window (default 6 h — enabling mid-tournament never backfills old matches) and which have **no result version yet** (never assigns once any score is known), every ACTIVE member without a prediction gets `pickJson = { type:"SCORE", homeGoals/awayGoals: random[min..max], autoAssigned:true, autoSource:"CAPRICHO_SAN" }` via `createMany skipDuplicates` (a real pick always wins races). Audited per match (`CAPRICHO_SAN_ASSIGNED`). Crypto-backed randomness (`crypto.randomInt`).
4. **Transparency is non-negotiable:** the `autoAssigned` flag rides inside `pickJson` (no schema change; flows through every existing endpoint untouched) and renders as a 🎲 badge in the others-picks modal and on the player's own pick, ×3 locales. Scoring treats the pick like any other — that's the game.
5. **Deadline reminders are untouched:** reminders fire BEFORE the deadline; Capricho San acts only AFTER it. Same timeline, different phases.

**Consequences:**
- ✅ Zero impact outside allowlisted pools (job doesn't start without the env var).
- ✅ The pattern (env allowlist + `available` in overview + gated settings) is reusable for future gifted/experimental per-pool features.
- ⚠️ Random picks are created post-deadline by design; the picks route still rejects human post-deadline writes — the job writes via Prisma directly.

**Related code:** `backend/src/lib/caprichoSan.ts`, `backend/src/services/caprichoSanService.ts`, `backend/src/jobs/caprichoSanJob.ts`, `backend/src/services/poolAdminService.ts` (`updatePoolSettings`), `backend/src/services/poolOverviewService.ts`, `frontend-next/.../admin/AdminSettingsToggles.tsx`, `MatchPicksModal.tsx`, `PickComponents.tsx`.
---

## ADR-076 — Read-only ad-hoc query endpoint for operational diagnostics

**Status:** Accepted (2026-06-17)

**Context:** Operational support recurrently needs ad-hoc reads of
production data ("what pool does user X have", "did these emails
register", "are picks being saved"). Direct DB access (psql, `railway
ssh`) is unavailable from some operator environments because only
HTTPS/443 egress is allowed; the Postgres proxy port is firewalled.
Building a structured lookup endpoint per question doesn't scale.

**Decision:** A single admin endpoint `POST /admin/query` accepts one
**read-only** SQL statement and returns rows as JSON. The backend (which
is co-located with the DB) proxies the query, so HTTPS-only callers can
use it. Defense in depth:
1. A dedicated Postgres role `picks4all_readonly` with SELECT-only grants
   — the real write-protection boundary (the DB cannot mutate via this
   client regardless of any app-layer bypass).
2. App-layer validation: single statement, `SELECT`/`WITH` only, DML/DDL
   keyword denylist.
3. Sensitive-identifier rejection + output redaction for `passwordHash`,
   `resetToken`, `emailVerificationToken`, `activationToken`.
4. Row cap (`ADMIN_QUERY_MAX_ROWS`) + role `statement_timeout`.
5. `AuditEvent` (`ADMIN_QUERY_EXECUTED`) on every call.
6. Dedicated static token auth (`ADMIN_QUERY_TOKEN`, `X-Admin-Query-Token`,
   constant-time compare) — independent of the 4 h human JWT so the tool
   can be driven programmatically.

**Explicitly out of scope — WRITES.** Any mutation of production data
stays a reviewed SQL statement executed by a human in the Railway
console. An autonomous arbitrary-write endpoint is rejected: the
risk/reward is unacceptable when the Railway console already provides the
human checkpoint for the rare, high-stakes write.

**Consequences:**
- ✅ Any diagnostic read is one HTTPS call; no DB port needed.
- ✅ The read-only role bounds the worst case to information disclosure,
  itself bounded by secret-column blocking + redaction + row cap.
- ⚠️ The role/grants must be created once manually in Railway (password
  out of git) and kept in sync (`ALTER DEFAULT PRIVILEGES` covers new
  tables; new secret columns must be added to the denylist).
- ⚠️ `ADMIN_QUERY_TOKEN` is a real bearer credential — rotate on
  suspicion; unset either env var to disable instantly.

**Related code:** `backend/src/routes/adminQuery.ts`,
`backend/src/services/adminQueryService.ts`,
`backend/src/lib/readonlyDb.ts`, `backend/src/routes/admin.ts`.
**Guide:** `docs/guides/ADMIN_QUERY_ENDPOINT.md`.

---

## ADR-077: Per-Match Prediction Status (privacy-preserving, flag-gated rollout)

**Date:** 2026-06-17 | **Status:** Accepted

**Context:** Host feedback (Felipe Hincapié): hosts have no way to know which players already saved a prediction for a match. Several users typed a score but forgot to click "save" and silently lost points. Hosts need to see who is still pending so they can remind them before the deadline — without seeing the actual predictions (the existing "ver predicciones de otros" flow already exposes scores, but only after the deadline).

**Decision:**
- New feature surfaces, per match, the list of ACTIVE members with a boolean `hasPredicted` (✓/✗) and a `count/total` badge on each match card. It NEVER exposes pick contents.
- **Privacy guarantee enforced in code:** the read query selects `userId` only (`prisma.prediction.findMany({ where: { poolId, matchId }, select: { userId: true } })`) — `pickJson` is never read. This is what makes it safe to show *before* the deadline without leaking scores.
- **Denominator** = ACTIVE pool members (`status='ACTIVE'`), consistent with `counts.membersActive`. Excludes `PENDING_APPROVAL`, `LEFT`, `BANNED`. Includes HOST/CO_ADMIN (they predict too).
- **Badge count is free:** `predictedCount` per match is derived in-memory in `poolOverviewService` from the `allPredictions` already loaded for the leaderboard — no extra DB query. `allPredictions` includes LEFT members' preserved picks, so the numerator intersects with the ACTIVE user set.
- **Detail endpoint:** `GET /pools/:poolId/matches/:matchId/prediction-status` (auth + `requirePoolMemberReadAccess`). Indexed by `Prediction @@index([poolId, matchId])` and `PoolMember @@index([poolId, status])`.
- **Gradual rollout via feature flag** `PREDICTION_STATUS_HOST_ALLOWLIST` (`lib/featureFlags.ts`): `""`/unset → off everywhere (safe default); `*` → on for all pools; comma-separated emails → on only for pools whose **creator** (`Pool.createdByUserId`) email is listed. Evaluated server-side in both the overview (`predictionStatusEnabled` flag per pool) and the detail endpoint (404 when disabled — never reveals existence). Frontend only reacts to the boolean.
- **Frontend:** clickable badge on `MatchCard` (always visible when enabled, pre + post deadline) → `PredictionStatusModal` with filters (All / Pending / Ready), name search, ✓/✗ per member.

**Consequences:**
- ✅ Solves the real problem (pre-deadline visibility) without breaking the hidden-score rule
- ✅ Badge adds zero DB queries; detail endpoint is indexed
- ✅ Beta-safe: defaults off; rollout is an env-var change, not a deploy
- ⚠️ PDF export of the list (requested) deferred to a fast-follow (the `jspdf` infra exists on `main`)

---

## ADR-078: Admin analytics dashboard is recomputed on demand, persisted, and served from a snapshot

**Date:** 2026-06-22 | **Status:** Accepted

**Context:** The admin analytics dashboard build is a heavy multi-minute SQL pass. The frontend auto-refreshed every 30 s while the backend cache TTL was 5 min and a build took 4–5 min, so a single open admin tab produced **back-to-back rebuilds forever** — saturating Node's event loop and Postgres connections and making the whole platform slow (users couldn't even log in). The cache was also in-memory only, so every deploy paid a fresh cold build.

**Decision:**
- **Recompute is manual only.** A plain `GET /admin/analytics/dashboard` NEVER rebuilds — it serves the last snapshot instantly. Rebuild is an explicit `POST /admin/analytics/dashboard/rebuild` that fires the build and returns immediately (a 4–5 min build far exceeds the 30 s HTTP client timeout, so a synchronous refresh was impossible — the original source of the WC-eve timeouts).
- **Async rebuild + polling.** The "🔄 Recalcular ahora" button POSTs the trigger, then the client polls GET every 5 s (15 min cap) until `building:false` with a newer `generatedAtUtc`. The old snapshot stays on screen meanwhile.
- **Persisted snapshot.** New singleton model `AnalyticsDashboardSnapshot` stores the last payload, so the view survives restarts/deploys. Boot restores it into memory (no recompute); a one-time background seed runs only on a brand-new install (DB empty).
- **No auto-poll on the frontend.** The interval selector and 30 s polling are removed entirely.
- The immediate incident mitigation was raising `ADMIN_DASHBOARD_CACHE_TTL_MS` 5 min → 1 h; this code change is the permanent fix.

**Consequences:**
- ✅ The rebuild loop is structurally impossible — builds happen only on button press (or one-time seed)
- ✅ User-facing latency is fully decoupled from the build; the dashboard survives deploys
- ⚠️ The displayed data is only as fresh as the last manual rebuild (by design) — the header shows "Última actualización: hace X"
- ⚠️ The underlying ~4–5 min build time is a separate perf debt (N+1 / missing indexes) to address later

---

## ADR-079: Per-pool cache for the pool-overview leaderboard

**Date:** 2026-06-23 | **Status:** Accepted

**Context:** `GET /pools/:id/overview` is ≈43% of all backend traffic. Railway proxy logs (`totalDuration ≈ upstreamRqDuration`, p50 2.4 s, max 55 s) proved the time is spent in the Node app: it recomputed the FULL leaderboard (load every member's predictions + an O(members × matches) scoring loop + structural breakdown) on EVERY request. The result is identical for every user of a pool, yet was recomputed per request. During live matches everyone refreshes at once → dozens of multi-second synchronous computations queue on Node's single event loop → the whole platform (logins included) freezes.

**Decision:**
- Cache the heavy leaderboard bundle **per pool** in memory (`poolLeaderboardCache.ts`). Only the pool-global leaderboard is cached — `matchCards` (live scores), the user's own pick, membership and permissions are still computed fresh per request, and emails are still filtered by the requester's role at response time.
- **Invalidation follows the data, not a clock.** Each request computes a cheap `fingerprint` from the leaderboard's inputs (results count + max(updatedAtUtc), structural-result aggregates, member count, prediction count, override count/disabled-count — all on poolId-indexed columns). A cached entry is served only if its fingerprint still matches. So a freshly published result is reflected on the very next request. A max-age TTL (`POOL_LEADERBOARD_CACHE_TTL_MS`, default 20 s) is a pure safety net for the rare input a fingerprint can't capture; it self-heals within the window.
- **Refresh-storm safety:** concurrent misses for the same pool coalesce onto a single computation (`inFlight`).
- **Verbose** (`?verbose=true`, admin debug) bypasses the cache so the per-row breakdown is always fresh.
- The leaderboard scoring code is byte-identical — it was wrapped in a closure, not rewritten, so points cannot change.
- **Read-only derived cache:** it never writes to the DB, so it cannot lose or corrupt data. Kill-switch: `POOL_LEADERBOARD_CACHE_TTL_MS=0` disables it entirely (recompute-every-time, exactly as before) — instant, no code change.

**Consequences:**
- ✅ Overview drops from 2–55 s to ms on cache hits; the event loop stops being blocked, so the whole platform speeds up.
- ✅ The table refreshes the instant a result changes (fingerprint), not on a fixed timer.
- ✅ No schema change, no migration, no frontend change.
- ⚠️ A rare edge (member status flip that nets a zero count change, or an override toggled off-then-on) can be ≤20 s stale until the TTL net fires.
- ⚠️ The underlying single-pass cost is still high on huge pools (it just runs far less often now) — query/algorithm optimisation remains a future cleanup.

---

## ADR-083: Knockout extra-time scoring config v2 — per-phase toggle, group-stage deadline, per-match legend

**Date:** 2026-06-27 | **Status:** Accepted (flag-gated rollout)

**Context:** Score predictions ("marcadores") in knockout phases are graded on the minute-90 result by default (`goals90` = 90' + stoppage; penalties never count — ADR-068). The per-phase `includeExtraTime` flag (in `Pool.pickTypesConfig`) already existed, exposed via a legacy "live toggle" in `AdminSettingsToggles` that saved immediately and locked per-phase at `<48 h` before kickoff or once a phase had results. Hosts had no clear communication of the rule, and players had none. The owner wanted: (1) a clear per-match legend so players see the rule where they predict; (2) a host config with a per-phase toggle + per-phase Save; (3) an edit window that closes when the group stage finishes; (4) a one-time blocking host banner. Rolled out to one host first.

**Decision:**
- **Edit window** closes at the earlier of (a) every group-stage match being *finalized* (`currentVersion.source ∈ FINAL_RESULT_SOURCES` = API_CONFIRMED / HOST_OVERRIDE / HOST_MANUAL) or (b) the first knockout kickoff (hard backstop). Pure helper `computeExtraTimeWindow` (`lib/extraTimeConfig.ts`). **Safe by construction:** the window always closes before any knockout result exists, so a flip is forward-looking and can never re-grade a played match.
- **Endpoint** `PATCH /pools/:id/phases/:phaseId/extra-time` (`updatePhaseExtraTime`): admin-only, flag-gated, validates the phase is a knockout scoreline phase + the window is open (409 `WINDOW_CLOSED`), persists `includeExtraTime` for that phase, writes audit `EXTRA_TIME_CONFIG_CHANGED`, and invalidates the leaderboard cache (the ADR-079 fingerprint does not track `pickTypesConfig`).
- **No player emails.** Communication is a **per-match legend** on knockout scoreline matches (`MatchCard`), text adapting to the phase's `includeExtraTime` (90'+stoppage vs end of extra time). `overview.extraTime.phases` is the backend-authoritative list (group phases excluded).
- **Blocking host banner**, acknowledged once per (host, pool) via `PoolMember.extraTimeBannerAckAt` (mirrors `User.localePromptCompletedAt`); shown only while the window is open and not acked.
- **Rollout gate** `EXTRA_TIME_CONFIG_ALLOWLIST` (acting/viewing user's email). Gated users get the new section + legend + banner; everyone else keeps the legacy `AdminSettingsToggles` extra-time toggle untouched (hidden only for gated users). One env flip (`*`) opens it to all.

**Consequences:**
- ✅ Players see the scoring rule on each knockout match; hosts get a clear per-phase config with an honest deadline.
- ✅ Reversible rollout; no behaviour change for non-gated pools.
- ✅ One migration (`PoolMember.extraTimeBannerAckAt`). No change to the scoring engine.
- ⚠️ The legacy live toggle remains in the codebase until the flag is `*`, after which it (and `extraTimePhases` in `updatePoolSettings`) should be removed (TECH_DEBT).

---

## ADR-084: Gestor de Fases — admin knockout-release gate + bracket review + single phase-summary email

**Date:** 2026-06-27 | **Status:** Accepted (instance-gated, nothing released to real users yet)

**Context:** Knockout phases advance automatically: when a phase's last match finalizes, `checkAndTriggerAdvancement` (10-min delay) runs `advanceToRoundOf32` / `advanceKnockoutPhase`, which resolve the FIFA bracket (12 winners + 12 runners-up + 8 best thirds → `resolvePlaceholders`) into **each pool's own `fixtureSnapshot`** (invariant 6). Predictions for the next phase open the instant the bracket fills. The owner wanted a controlled moment instead: hold every World Cup pool's knockout phases closed until an admin (1) reviews the FIFA-computed bracket per match, (2) optionally edits teams/date/time, (3) **releases** the round — at which point predictions open for everyone and players receive **one** email recapping the phase that just ended with a prominent "you can now predict <next phase>" call-to-action. Host lock buttons were replaced by read-only state indicators (Pendiente / Confirmando / Abierta / Finalizada). Must be opt-in per instance so other tournaments (UCL, tests) are untouched.

**Decision:**
- **Instance-level gate (opt-in).** Three `TournamentInstance` columns: `knockoutReleaseGateEnabled` (master switch), `releasedKnockoutPhases` (JSON array of opened phaseIds), `knockoutBracketOverrides` (JSON map `matchId → {homeTeamId?, awayTeamId?, kickoffUtc?}`). Default off/empty → zero behaviour change for non-gated instances.
- **Pick gate.** `pickService.upsertPick` adds a `PHASE_NOT_RELEASED` (409) check after the existing `lockedPhases` check: when the instance gate is enabled and the match's phase is not in `releasedKnockoutPhases`, predictions are refused. Lock semantics (`Pool.lockedPhases`) are unchanged and orthogonal.
- **Canonical bracket preview.** `getKnockoutBracketPreview(instanceId)` (service `knockoutBracketAdmin.ts`) recomputes the bracket at **instance level** with the same production FIFA logic (`calculateAllGroupStandings` on an ACTIVE reference pool — scraper scores are identical across pools — `determineQualifiers`, `resolvePlaceholders`), merges admin overrides, and flags still-placeholder slots (`homePending`/`awayPending`). Robust before the group stage finishes (try/catch keeps placeholder labels). Admin reviews/edits via `POST .../knockout-brackets/overrides`; the bracket fills automatically — the admin only reviews.
- **Release is the single trigger.** `setKnockoutPhaseReleased(instanceId, phaseId, true)` — only on a fresh release **and** while the gate is enabled — (a) **propagates** the reviewed bracket into every non-archived pool's `fixtureSnapshot` (`propagateBracketToPools`: fills team slots from the canonical resolution, never overwriting a real team with a placeholder; writes kickoff only where the admin explicitly overrode it), then (b) fires the phase-summary **broadcast** in the background (`fireAndForget`). Re-locking just clears the flag. Gate-off release is a no-op flag toggle (predictions were never held → no propagation, no email).
- **One email, fired on release.** `sendPhaseSummaryBroadcast` (`phaseSummaryBroadcast.ts`) is **generic by phase order**: the released phase is the one being opened; the phase summarized is the one immediately before it (works for group_stage→R32 and any later round). One `getPoolOverview` per pool (the leaderboard is viewer-independent), personalized per member — same shape as the pool-completed broadcast. The template (`getPhaseSummaryTemplate`) adapts to the pool's scoring mode (score → exact/partial scorelines + "of X possible"; structural/estratega → positions/perfect-groups, possible-line hidden because `calculateMaxPointsForPool` returns 0 for structural phases) and shows a prominent **green** "you can now predict <next>" banner, or a **gold** "tournament over" banner when there is no next phase. Phase names are localized via `PHASE_DISPLAY_NAMES` (added `finals`/`third_place`) so EN/PT emails are fully in-language.
- **Idempotency + bounded fan-out.** Per-pool marker `Pool.phaseSummaryEmailedPhases` (JSON array) — re-releasing the same phase skips already-emailed pools. Cross-pool concurrency capped at 4 (`createLimiter`) to protect the Postgres pool across the 457-pool World Cup fan-out (2026-06-10 connection-pool incident); per-batch sending via `batchSendEmails`. Members filtered by `emailNotificationsEnabled`.
- **Rehearsal-safe.** `POST .../knockout-phases/:phaseId/broadcast-summary` accepts `{ dryRun, force, restrictToEmail, onlyPoolIds }` — `dryRun` computes everything and returns per-pool samples without sending or marking; `restrictToEmail` sends only to one address. `POST /admin/phase-summary-test` accepts `{ locale, poolId }` so an admin can preview any pool's email (e.g. an estratega pool) in any locale to their own inbox.
- **Player-facing state.** `derivePhaseState` (frontend `poolHelpers`) → GROUP_ACTIVE / PENDING / CONFIRMING / OPEN / FINALIZED drives read-only indicators (replacing host lock buttons) + the "Confirmando brackets" message. Admin panel at `/admin/fases` (link in the admin user menu) shows the bracket with 🇨🇴 COL time and Guardar/Liberar per phase.
- **Gate covers BOTH pick types.** The `PHASE_NOT_RELEASED` (409) check lives in `pickService.upsertPick` (score picks) AND `routes/structuralPicks.ts` (estratega "who advances" picks) — otherwise enabling the gate would hold marcadores pools closed but leave estratega pools open. Group-standings picks are group-stage only and never gated.
- **Canary "test release".** `TournamentInstance.knockoutPhaseTestPools` (JSON map `phaseId → [poolId]`) lets the admin open a phase for ONE pool before the global release: `testReleaseKnockoutPhase(instanceId, phaseId, poolId)` propagates the bracket to that pool, and — only if the teams are resolved (else a no-op + "wait for groups" report) — opens predictions for it and emails its members. The pick gate honours `released OR pool ∈ testPools[phase]`. The pool is marked emailed, so the later global release skips it (no double email); a global release clears the phase's test list. Endpoint `POST .../knockout-phases/:phaseId/test-release {poolId}`; the panel exposes a "🧪 Prueba a 1 pool" control alongside "Liberar a TODOS".

**Consequences:**
- ✅ The admin controls exactly when each knockout round opens; players get one coherent, localized recap + call-to-action at that moment.
- ✅ Reuses the FIFA advancement logic that has run in production for months — the gestor shows the same bracket auto-advance writes; the admin only reviews/edits.
- ✅ Opt-in per instance; default-off means UCL/test instances are unaffected. Nothing released to real users pending end-to-end validation.
- ✅ Migrations: `20260627_add_knockout_release` (3 instance columns) + `20260627_add_phase_summary_emailed` (`Pool.phaseSummaryEmailedPhases`) + `20260627_add_knockout_test_pools` (`TournamentInstance.knockoutPhaseTestPools`).
- ⚠️ Propagation assumes group results are uniform across pools (true for AUTO-mode World Cup); a host who overrode a group result in their own pool would be realigned to canonical on release — acceptable for the gated instance.
- ⏳ Pending: enable the gate + release the real round only after live validation; structural recap for *knockout* rounds still shows group-stage positions (meaningful for the R32 recap; revisit for later rounds).

---

## ADR-085: Host-editable prediction deadline + anti-cheat player notification

**Date:** 2026-06-27 | **Status:** Accepted (core tested to owner; broad announcement gated pending authorization)

**Context:** With the knockout-release gate (ADR-084), a phase opens only when the admin releases it — often close to the first knockout kickoff. A pool whose `deadlineMinutesBeforeKickoff` is large (e.g. 24 h) would then have the round "born closed": predictions lock before players ever get to make them. Of 457 active World Cup pools, 383 use ≤10 min (safe), but **16 use > 60 min** (14 at 24 h) — those need a way to give players more time. `deadlineMinutesBeforeKickoff` was set only at pool creation and was NOT editable afterwards.

**Decision:**
- **Editable deadline.** `updatePoolSettings` (owner-only) now accepts `deadlineMinutesBeforeKickoff` (integer, 0–1440, mirrors creation). It is NOT scoring config, so the DRAFT-only immutability (invariant 3) does not apply — hosts can adjust it on ACTIVE pools. Changing it only affects FUTURE locks (the deadline is computed live as `kickoff − minutes`); reducing it reopens an about-to-lock round, and a host can never reopen a match whose kickoff already passed. Surfaced in `AdminSettingsToggles` (Manage tab) as a preset selector (10 m / 30 m / 1 h / 3 h / 6 h / 12 h / 24 h).
- **Anti-cheat transparency.** Because the deadline governs WHEN every player's predictions close, any change emails ALL active members (`sendDeadlineChangedEmail`, es/en/pt: old → new, "you have more time"/"submit in time"), and the host sees a confirm warning before saving. No mandatory reason (the warning + email provide the accountability) — lighter than result overrides. Bounded fan-out via `batchSendEmails`, respects `emailNotificationsEnabled`; audit `POOL_SETTINGS_UPDATED`.
- **Anti-reopen ratchet.** Reducing the deadline moves locks LATER and could reopen a match whose predictions are already VISIBLE (its deadline passed and players saw each other's picks → cheat). Rather than blocking the host, a reduction RAISES `Pool.predictionLockFloorUtc` — the latest kickoff among *revealed* matches (deadline passed under the old setting AND the phase carries ≥1 prediction). Any match kicking off at/before the floor stays locked (and its picks stay visible) regardless of the new deadline, via the shared helper `isKickoffFloorLocked` + a floor-aware `buildGroupLockTimes`, applied at every lock/visibility site (pickService, structuralPicks, groupStandingsService, poolOverview match cards, structural detail). Gated-unreleased knockout phases carry no predictions, so a "born closed" R32 is NOT floored and CAN be reopened to give players time — the floor is always `< R32 kickoff` because revealed matches precede it. The host is told upfront the change "won't reopen already-closed matches of active phases". The floor is monotonic (only rises).
- **Announcement to hosts.** Two channels: (a) a one-time email (`sendDeadlineOptionEmail`, es/en/pt) to the **16 at-risk hosts** (deadline > 60 min) — highest reach, since the first R32 match is imminent; (b) an in-app host banner (`DeadlineConfigHostBanner`, dismissable, acked via `POST /pools/:id/deadline-banner/ack` → `PoolMember.deadlineConfigBannerAckAt`) shown on entry: "¿Necesitas dar más tiempo…? Ya puedes modificarlo desde Administración".
- **Single allowlist gate.** `DEADLINE_CONFIG_ALLOWLIST` (`isDeadlineConfigEnabled`, viewer/actor email) gates the WHOLE feature — the editing card (`overview.deadlineConfig.canEdit`), the edit endpoint (server-side reject for non-allowlisted), AND the banner (`needsBanner`). Set to the owner's email to self-test, then `*` to release to all hosts. No redeploy to flip.
- **Test-first rollout.** Both emails were sent to the owner (juan.k) in all three locales for review BEFORE any blast; the at-risk blast and the `*` flip happen only after explicit authorization (standing workflow rule).

**Consequences:**
- ✅ Hosts can rescue an about-to-lock knockout round; players are always told when the deadline moves (no silent lock-out / no silent reopen for cheating).
- ✅ Migrations: `PoolMember.deadlineConfigBannerAckAt` + `Pool.predictionLockFloorUtc` (the deadline column itself already existed). One env flag gates editing + banner together.
- ⚠️ The ratchet is conservative: a reduction made BEFORE a revealed match has kicked off is impossible to misuse, and a reduction is always safe to apply — already-revealed matches simply never reopen.
- ⚠️ A host could also INCREASE the deadline (close earlier); the mandatory email-everyone makes that visible to all players.

---

**END OF DOCUMENT**
