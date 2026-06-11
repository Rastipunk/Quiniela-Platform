# Glossary of Terms
# Picks4All

> **Purpose:** Centralized definition of all domain-specific terminology, concepts, and jargon used in Picks4All.
>
> **Audience:** Developers, product managers, stakeholders, and new team members.
>
> **Last Updated:** 2026-05-28

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [User Roles & Permissions](#user-roles--permissions)
- [Tournament Architecture](#tournament-architecture)
- [Pool Management](#pool-management)
- [Predictions & Scoring](#predictions--scoring)
- [Technical Terms](#technical-terms)
- [Acronyms & Abbreviations](#acronyms--abbreviations)
- [Domain-Specific Slang](#domain-specific-slang)

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

**Types:** the player always submits an exact score; the engine evaluates it against multiple criteria simultaneously. The full list is in [Pick Type](#pick-type) below.

**Example:** "My pick for MEX vs CAN is 2-1. The engine credits points for the exact score AND for the correct outcome AND for the goal difference, depending on the pool's preset."

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

**Values:**
- **HOST:** Pool creator/owner (full control)
- **CO_ADMIN:** Delegated manager (most permissions, can't delete pool)
- **PLAYER:** Regular participant (can only make picks)

**Permissions Matrix:** See [BUSINESS_RULES.md](./BUSINESS_RULES.md#81-co-admin-rules)

**Example:** "Alice is HOST in Pool A, CO_ADMIN in Pool B, and PLAYER in Pool C."

---

### Co-Admin

**Definition:** Trusted user nominated by HOST to help manage the pool.

**Permissions:**
- ✅ Publish/correct results
- ✅ Generate invite codes
- ✅ Approve/reject join requests
- ✅ Kick or ban players
- ❌ Nominate other co-admins
- ❌ Delete or archive the pool
- ❌ Advance phases manually
- ❌ Remove the host

**Nomination:** Only HOST can nominate/remove co-admins.

**Example:** "Bob was promoted to co-admin to help publish results while Alice is traveling."

---

### CORPORATE_HOST

**Definición:** Rol especial de PoolMember para el administrador de una pool corporativa.

**Permisos:**
- Publicar y corregir resultados
- Generar códigos de invitación y enviar emails
- Gestionar empleados vía endpoints corporativos específicos
- **No puede:** abandonar la pool, nominar co-admins, ni archivar

**Diferencia con HOST:** CORPORATE_HOST gestiona empleados a través de los endpoints `/corporate/` dedicados en vez del flujo estándar de miembros.

**Técnico:** Valor del enum `PoolMemberRole` en Prisma.

---

### Active Member

**Definition:** User with `PoolMember.status = ACTIVE` (can participate).

**Contrast:** BANNED, LEFT, or PENDING_APPROVAL members cannot submit picks. The `PoolMemberStatus` enum has exactly these four values; there is no `SUSPENDED` state.

**Example:** "This pool has 20 active members and 2 banned members."

---

### LEFT

**Definition:** A `PoolMember.status` indicating the player voluntarily left the pool.

**Behavior:**
- Player retains their accumulated points on the leaderboard
- Displayed as "Retirado" (retired) on the leaderboard
- Cannot submit new picks (read-only access)
- `leftAtUtc` timestamp is recorded
- HOST and CORPORATE_HOST cannot leave their own pools

**Example:** "Carlos left the pool mid-tournament. His 32 points remain on the leaderboard but he can no longer make picks."

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

**Example:** "The 'World Cup Format' template defines 48 teams in 12 groups."

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

### ResultSourceMode

**Definition:** Configuration on a `TournamentInstance` that determines how match results are obtained.

**Values:**
- **MANUAL:** The pool host (or co-admin) manually enters match results (legacy / amateur tournaments)
- **AUTO:** Results come from the scraper-first pipeline — picks4all-scores publishes provisional and final scores in real time, with API-Football as the ~30 min fallback. The host can only override an existing result, not publish from scratch.

**Technical:** Stored as a field on the `TournamentInstance` model. See ADR-052 for the scraper-first decision.

**Example:** "The UCL 2025-26 instance uses AUTO mode, so live scores arrive via picks4all-scores and are finalised either by the scraper grace period or by API-Football."

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

**Example:** "World Cup 2026 has a Group Stage (12 groups, 72 matches) and a Knockout Stage."

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

### Activation Token (Token de Activación)

**Definition:** A secure token sent to corporate employees via email for pool activation.

**Generation:** `crypto.randomBytes(CRYPTO_BYTES.TOKEN = 32)` → 64-char hex string.

**Expiry:** 30 days from creation. Single-use; rotated by `POST /corporate/pools/:poolId/employees/:inviteId/resend`.

**Flow:**
1. CORPORATE_HOST adds employee emails (manual or CSV import) from the pool admin tab
2. System generates unique activation token per employee
3. Employee receives email with activation link (`/activar-cuenta?token=...`)
4. Employee sets password and joins the corporate pool

**Technical:** Stored in the `CorporateInvite` model. See ADR-048 for the magic-link session-mismatch defence and ADR-050 for the resend / token-rotation flow.

**Example:** "Employee received an activation token via email and used it to join the corporate pool and set their password."

---

### Corporate Pool (Pool Corporativo)

**Definition:** A pool created through the enterprise flow (`/empresas/crear`), managed by a CORPORATE_HOST, with employee invitations and organization branding.

**Characteristics:**
- Created via the 6-step corporate pool creation wizard
- Associated with an Organization entity
- Members are invited via activation tokens (not invite codes)
- Managed by a user with CORPORATE_HOST role

**Technical:** Uses `Organization`, `CorporateInvite`, and `Pool` models in a transaction.

**Example:** "Acme Corp created a corporate pool for the World Cup 2026 with 50 employees."

---

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

### Pool State

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

### Join Approval

**Definition:** Optional workflow requiring host approval before users can join pool.

**Setting:** `Pool.requireApproval` (boolean)

**Flow:**
- User enters invite code
- If `requireApproval = true`:
  1. A `PoolMember` row is created with `status = PENDING_APPROVAL`
  2. Host/co-admin approves → status flips to `ACTIVE`, records `approvedByUserId`/`approvedAtUtc`
  3. Host/co-admin rejects → the `PoolMember` row is deleted (optional `rejectionReason`); the user can try again with a new invite
- If `requireApproval = false`:
  - User joins immediately as `ACTIVE`

There is NO separate `PoolMemberRequest` table — the entire workflow uses `PoolMember.status` transitions.

**Example:** "Private pool requires approval. Alice requested to join, host approved her."

---

### Leave Pool (Abandonar Pool)

**Definición:** Acción voluntaria de un miembro para retirarse de una pool.

**Restricciones:**
- Solo disponible para roles PLAYER y CO_ADMIN
- HOST y CORPORATE_HOST **no pueden abandonar** (deben archivar la pool)
- El miembro conserva sus puntos en el leaderboard
- Aparece como "Retirado" en la tabla de posiciones
- No puede volver a unirse ni hacer más picks (modo read-only)

**Técnico:** Cambia `PoolMember.status` a `LEFT` y registra `leftAtUtc`.

---

### Organization (Organización)

**Definition:** An entity representing a company or organization that creates corporate pools for their employees.

**Technical:** Stored in the `Organization` model. Created as part of the corporate pool creation transaction.

**Key Attributes:**
- Name (company name)
- Associated corporate pools
- Employee list (via `CorporateInvite` records)

**Example:** "Organization 'Acme Corp' has 2 corporate pools: one for the World Cup and one for the UCL."

---

## Predictions & Scoring

### Pick Type

**Definition:** A scoring criterion the engine evaluates against a player's submitted score. The player always submits an exact score; the pool's `pickTypesConfig` decides which criteria award points.

**Types** (canonical list — matches `backend/src/lib/pickPresets.ts` and the scoring engine):

| Type | What it evaluates |
|------|--------------------|
| `EXACT_SCORE` | Both home and away goals match exactly |
| `GOAL_DIFFERENCE` | `pick.home - pick.away === result.home - result.away` |
| `MATCH_OUTCOME_90MIN` | Same winner / draw outcome at 90 min |
| `HOME_GOALS` | Correct number of home goals (independent of away) |
| `AWAY_GOALS` | Correct number of away goals (independent of home) |
| `PARTIAL_SCORE` | At least one of the two scores matches (inclusive OR — ADR-073) |
| `TOTAL_GOALS` | `pick.home + pick.away === result.home + result.away` |

**Single additive engine (ADR-072):** every enabled criterion is evaluated independently and matched criteria sum — `EXACT_SCORE` is an additive bonus and never terminates evaluation, so the per-match maximum (sum of enabled criteria) is reachable with an exact pick.

**Note:** earlier versions of this glossary listed `MATCH_OUTCOME`, `BOTH_TEAMS_SCORE`, and `WINNING_MARGIN` — those names never existed in the engine. The real outcome type is `MATCH_OUTCOME_90MIN`; the others are not implemented.

**Example:** "My exact pick is 2-1. In the BASIC preset only `EXACT_SCORE` scores. In CUMULATIVE I can also score `MATCH_OUTCOME_90MIN`, `HOME_GOALS`, and `GOAL_DIFFERENCE` if any of those match — points stack."

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

**Definition:** A packaged scoring rule a host applies when creating a pool. Picks4All ships TWO independent scoring systems, each with its own preset set.

#### (a) Legacy scoring presets (`lib/scoringPresets.ts`)

Single-key system. Stored in `Pool.scoringPresetKey` (schema default `"CLASSIC"`). Each preset is a flat `{ outcomePoints, exactScoreBonus, allowScorePick }`.

| Key | `outcomePoints` | `exactScoreBonus` | Description |
|-----|-----------------|-------------------|-------------|
| **CLASSIC** (default) | 3 | 2 | Outcome points plus an exact-score bonus. |
| **OUTCOME_ONLY** | 3 | 0 | Outcome only; no exact-score pick. |
| **EXACT_HEAVY** | 2 | 3 | Lighter outcome, heavier exact-score bonus. |

#### (b) Advanced pick-type presets (`lib/pickPresets.ts`)

Per-phase system. Stored in `Pool.pickTypesConfig` (a `PoolPickTypesConfig`, see [Pick Rules](#pick-rules)). `getAllPresets()` returns exactly three packaged presets:

| Key | Description |
|-----|-------------|
| **CUMULATIVE** | Points stack per matched criterion (`MATCH_OUTCOME_90MIN` 10 + `HOME_GOALS` 4 + `AWAY_GOALS` 4 + `GOAL_DIFFERENCE` 2 = 20 max at base phase), auto-scaling ×1→×4 by phase. |
| **BASIC** | Exact-score-only (`EXACT_SCORE`), auto-scaling 20 pts (group) → 80 pts (final). |
| **SIMPLE** | Structural, no scores: `GROUP_STANDINGS` in groups, `KNOCKOUT_WINNER` in knockout rounds (15→40 pts by phase). |

**CUSTOM** is NOT a packaged preset — it exists only as a member of the `PickConfigPresetKey` type union, denoting a host-defined `pickTypesConfig`.

**Example:** "In the CUMULATIVE preset a correct exact score scores `MATCH_OUTCOME_90MIN` + `HOME_GOALS` + `AWAY_GOALS` + `GOAL_DIFFERENCE` simultaneously."

---

### Pick Rules

**Definition:** The advanced per-phase scoring configuration a host stores in `Pool.pickTypesConfig`. Shape defined by `PoolPickTypesConfig` in `backend/src/types/pickConfig.ts` — an array of `PhasePickConfig`, one per tournament phase. Each phase sets `requiresScore` and then carries EITHER `matchPicks.types[]` (`{ key, enabled, points }`) when `requiresScore = true`, OR `structuralPicks` when `requiresScore = false`. The two branches are mutually exclusive.

**Example** (a `group_stage` phase enabling `MATCH_OUTCOME_90MIN` and `EXACT_SCORE`):
```json
{
  "phaseId": "group_stage",
  "phaseName": "Fase de Grupos",
  "requiresScore": true,
  "matchPicks": {
    "types": [
      { "key": "MATCH_OUTCOME_90MIN", "enabled": true, "points": 10 },
      { "key": "EXACT_SCORE", "enabled": true, "points": 20 }
    ]
  }
}
```

**Scoring:** With the cumulative system the engine sums points for every matched, enabled criterion in the phase config.

---

### Exact Score

**Definition:** Pick where the predicted score exactly matches the actual score.

**Validation:** the player's score is parsed from `Prediction.pickJson` (e.g. `pick.home` / `pick.away`) and compared against `homeGoals` / `awayGoals` on the published `PoolMatchResultVersion`. There are no top-level `homeGoals`/`awayGoals` scalar fields on the prediction — the pick lives entirely in the flexible `pickJson` JSON column.

**Bonus:** Awards extra points (configurable by preset).

**Example:** "I predicted 2-1, result was 2-1 → Exact score! Under the legacy CLASSIC preset I get 3 pts (outcome) + 2 pts (bonus) = 5 pts. Other presets award different amounts."

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

### picks4all-scores

**Definition:** In-house live-scoring scraper service that picks4all maintains separately. **Primary** source of live scores in AUTO-mode tournament instances.

**Cadence:** `liveScoresJob` polls every 15 seconds during a match's live window. Provisional scores publish as `SCRAPER_PROVISIONAL`; after a 5-minute grace period past full time the result is finalised as `API_CONFIRMED` (the source name predates the scraper but is the canonical "final" tag).

**Kill switch:** `PlatformSettings.scoresServiceEnabled` (admin-toggleable) — disables the scraper layer without redeploy.

**Technical:** Client in `backend/src/services/scoresService/`; service-to-service auth via `Authorization: Bearer ${SCORES_SERVICE_API_KEY}` (NOT user JWTs). See ADR-052.

---

### API-Football

**Definition:** Third-party data provider (api-football.com via RapidAPI). **Fallback** layer in AUTO-mode tournament instances; activates ~30 minutes after estimated full time when picks4all-scores hasn't reported. Also seeds fixture data and powers the `/admin/instances/:id/sync` flow for one-shot syncs.

**Usage:** When a `TournamentInstance` has `ResultSourceMode = AUTO`, `smartSyncJob` polls API-Football and only publishes results that the scraper has not already reported. Source hierarchy `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL` is enforced server-side.

**Technical:** Client implementation in `backend/src/services/apiFootball/client.ts`. Smart Sync state machine in `backend/src/services/smartSync/`. See ADR-031 (original AUTO mode), ADR-032 (Smart Sync polling strategy), and ADR-052 (scraper-first reordering).

**Example:** "When a UCL 2025-26 match starts, picks4all-scores publishes live scores every 15 s. If FT happens and the scraper hasn't sent a final, API-Football publishes the final 30 min later."

---

### Polar.sh

**Definition:** Merchant-of-Record payment processor used for international (USD) pool capacity upgrades. Handles taxes, compliance, and hosted checkout.

**Integration:** `@polar-sh/sdk` for checkout creation; `standardwebhooks` library for signature verification on the webhook handler (`POST /payments/webhook`, mounted with `express.raw()` BEFORE the JSON body parser so the signature can be verified against the unparsed body). Idempotency at `PaymentEvent.polarEventId` UNIQUE inside the same transaction as the `PoolPayment.update` + `Pool.update`.

**Pricing:** $7.99/block of 50 players, declining $0.40 every 2 blocks, minimum $4.99/block. Corporate base $49.99 for 100 players. See `backend/src/lib/pricing.ts`.

**Technical:** `backend/src/services/polar/`. See ADR-044 (replaced Lemon Squeezy from ADR-036).

---

### Mercado Pago

**Definition:** Local payment gateway used for Colombia (COP) pool capacity upgrades. The customer pays in pesos via the embedded Brick checkout; webhook IPN confirms the charge.

**Integration:** `mercadopago` SDK 2.12, `Payment Brick` on the frontend, and IPN webhook (`POST /payments/mp-webhook`). Webhook validates HMAC AND timestamp drift (`MP_WEBHOOK_MAX_DRIFT_MS`, default 5 min) to defend against replay. EventId is `mp-{paymentId}-{status}` so async transitions (`pending → in_process → approved`) don't dedupe each other. See ADR-053.

**Routing:** Country detection via Cloudflare's `CF-IPCountry` header — Colombia routes to MP, everywhere else to Polar.

**Technical:** `backend/src/services/mercadopago/`.

---

### Brick (Mercado Pago Brick)

**Definition:** Embedded payment UI component provided by Mercado Pago. The frontend renders Brick after calling `POST /payments/mp-checkout` to create a preference; the customer enters card / PSE / Nequi data inside Brick which submits payment data straight to MP. The platform then calls `POST /payments/mp-process` server-side to finalise.

---

### CF-IPCountry

**Definition:** HTTP header injected by Cloudflare on every request, containing the requesting client's ISO country code. Used by `GET /payments/country` to decide whether to route the user to Polar (international USD) or Mercado Pago (Colombia COP).

---

### EmailSuppression

**Definition:** Persistent block-list for email recipients. Populated by Resend's `email.bounced` and `email.complained` webhooks (`POST /webhooks/resend`). `sendEmail()` checks this table before hitting Resend, short-circuiting deliveries to addresses that hard-bounced or marked us as spam.

**Technical:** `backend/prisma/schema.prisma` model `EmailSuppression`. See ADR-055.

---

### DLQ (Dead-Letter Queue)

**Full Form:** Dead-Letter Queue

**Definition:** Persistence layer for analytics events that exhausted in-process retries. Implemented via the `FailedAnalyticsEvent` table; drained by `capiRetryJob` on an exponential ladder. The drainer holds a Postgres advisory lock so multi-replica Railway deployments never double-send.

**Sinks covered:** `META_CAPI` (Meta Conversions API) and `GA4_MP` (GA4 Measurement Protocol). See ADR-054.

---

### GA4 MP

**Full Form:** Google Analytics 4 Measurement Protocol

**Definition:** Server-side endpoint Google exposes for emitting GA4 events without going through the browser tag. Used to deduplicate Purchase events against the browser-side Pixel/GTM emission and to backstop ad-blocked or no-JS sessions. Validation calls hit `/debug/mp/collect` so test events do not pollute production reports.

---

### Meta CAPI

**Full Form:** Meta Conversions API

**Definition:** Server-to-server event ingestion for Meta Pixel. Pairs with the browser Pixel via a shared `eventId` so Meta deduplicates one conversion. The platform attaches Advanced Matching signals (`_fbp`, `_fbc`, IP, UA) captured at checkout init so async webhook emissions still match users at high EMQ.

---

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

### Cloudflare Email Routing

**Definición:** Servicio de enrutamiento de correo entrante configurado para el dominio picks4all.com.

**Configuración:**
- 16 direcciones de email configuradas + catch-all
- Direcciones por idioma: soporte@ (ES), support@ (EN), suporte@ (PT)
- Direcciones especializadas: privacidad@, empresas@, facturacion@
- Documentado en ADR-034

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

### Locale

**Definition:** A language/region setting that determines the user interface language and content localization.

**Supported Locales:**
- **ES:** Spanish (default locale, no URL prefix)
- **EN:** English (URL prefix `/en/`)
- **PT:** Portuguese (URL prefix `/pt/`)

**Technical:** Managed by next-intl v4. Locale is determined by URL prefix, `NEXT_LOCALE` cookie, or browser `Accept-Language` header.

**Configuration:** `frontend-next/src/i18n/routing.ts`

**Example:** "A user visiting `/en/pools` sees the English interface, while `/pools` shows Spanish (default)."

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

### Smart Sync

**Definición:** Sistema de sincronización inteligente que consulta API-Football. Hoy actúa como **fallback layer**: el sistema primario es picks4all-scores (ver entrada). Smart Sync sólo publica resultados que el scraper no haya reportado, normalmente ~30 min después del FT estimado.

**Arquitectura:**
- `smartSyncJob` corre periódicamente (configurable via `SMART_SYNC_CRON`)
- Solo procesa instancias con `resultSourceMode = AUTO` y `syncEnabled = true`
- Máquina de estados por partido: PENDING → IN_PROGRESS → AWAITING_FINISH → COMPLETED
- Eficiencia: 2-4 requests por partido (vs 20-30 con polling estándar)
- Kill switch por instancia (`syncEnabled`) para emergencias

**Técnico:** Documentado en ADR-031 (creación), ADR-032 (estrategia de polling) y ADR-052 (re-clasificación a fallback). Implementado en `services/smartSync/`.

---

### Snapshot (Instantánea)

**Definition:** Frozen copy of data at a specific point in time.

**Use Cases:**
- `TournamentInstance.dataJson` (frozen copy of template version)

**Purpose:** Immutability, preventing cascading changes.

**Example:** "Instance snapshot contains 48 teams. If template updates to 64 teams, instance is unaffected."

---

### Token de Activación Corporativa

**Definición:** Token criptográfico de un solo uso que permite a un empleado activar su cuenta y unirse a una pool corporativa.

**Especificaciones:**
- Generado con `crypto.randomBytes(CRYPTO_BYTES.TOKEN = 32)` → 64 caracteres hexadecimales
- Vigencia: 30 días desde la creación
- Estados (`CorporateInviteStatus`): PENDING → SENT → ACTIVATED, o FAILED si el envío falla
- Enviado por email al empleado con enlace a `/activar-cuenta?token=xxx`
- Rotable: `POST /corporate/pools/:poolId/employees/:inviteId/resend` invalida el token previo (ADR-050)

**Técnico:** Almacenado en el modelo `CorporateInvite`. Defensa de session-mismatch documentada en ADR-048.

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

**Example:** "Pools endpoint supports CRUD operations."

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

### i18n

**Full Form:** Internationalization

**Definition:** The system's support for multiple languages and regional content. Picks4All supports Spanish (ES), English (EN), and Portuguese (PT).

**Technical:** Implemented with next-intl v4 in the frontend. Messages are stored in `frontend-next/src/messages/{es,en,pt}/`. Backend emails are also locale-aware.

**Example:** "i18n allows users in Brazil to see the platform in Portuguese while Colombian users see it in Spanish."

---

### JWT

**Full Form:** JSON Web Token

**Definition:** See [JWT entry above](#jwt-json-web-token).

---

### MVP

**Full Form:** Minimum Viable Product

**Definition:** Simplest version of product with core features to validate market demand.

**Example:** "MVP includes pools, picks, results, and leaderboard."

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

**Location:** `docs/` directory at the repository root.

---

### SPA

**Full Form:** Single-Page Application

**Definition:** Web app that loads once and dynamically updates (no full page reloads).

**Note:** The Picks4All frontend is NOT an SPA. It is a Next.js 16 App Router application with SSR (server-side rendering) for public pages and CSR (client-side rendering) for authenticated pages.

**Example:** "Traditional SPAs load once and update dynamically. Picks4All uses a hybrid SSR/CSR approach instead."

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

### Ban (Expulsión)

**Definition:** Permanent removal of a player from a pool. The user **cannot** rejoin even with a valid invite — the join flow rejects with `403 BANNED_FROM_POOL`.

**Effect:** `PoolMember.status` flips to `BANNED`; `bannedAt`, `bannedByUserId`, and `banReason` are recorded. Picks remain visible on the leaderboard for transparency. If `deletePicks=true` was passed, the user's predictions in this pool are also deleted.

**Reversibility:** the schema has a `banExpiresAt` column for future temporary-ban support, but the current implementation always sets it to `null` (permanent only). To restore a banned member the host must explicitly unban (status → ACTIVE).

**Example:** "Charlie was banned for violating pool rules. His picks still count on the leaderboard."

---

### Kick (Sacar)

**Definition:** Removal of a player that DOES allow rejoining. Status flips to `LEFT` (same end state as voluntary leave); the user can join again with a fresh invite code, and previous picks are preserved on rejoin.

**Endpoint:** `POST /pools/:poolId/members/:memberId/kick`. Available to HOST and CO_ADMIN. Cannot kick self or HOST.

**Contrast:** kick = soft removal (LEFT, can rejoin). Ban = hard removal (BANNED, cannot rejoin). There is no "suspend" state.

---

### Upset (Sorpresa)

**Definition:** Unexpected result where underdog wins or heavily favored team loses.

**Example:** "Saudi Arabia beating Argentina 2-1 in World Cup 2022 was a major upset."

---

### Brand System

**Definition:** Centralized brand identity configuration (`lib/brand.ts` in both frontend and backend) containing colors, gradients, name, and domain. All visual branding (emails, icons, OG images, theme) derives from this single source.

**Key principle:** No brand color or name should ever be hardcoded inline. Always import from `brand.ts`.

### Result Override

**Definition:** When a HOST modifies an API-published result. Requires a mandatory reason/justification. Triggers email notification to ALL active pool members. Creates a new `PoolMatchResultVersion` with source `HOST_OVERRIDE`.

### Scraper-First Results

**Definition:** The current rule for AUTO-mode tournament instances. picks4all-scores publishes provisional and final scores in real time (15-second polling during live windows); API-Football's Smart Sync is the ~30-min fallback. Hosts cannot publish results from scratch — they can only override an existing confirmed result with a mandatory reason and member-wide email notification. Legacy MANUAL-mode instances are exempt.

**Source hierarchy** (higher rows are never overwritten by lower ones): `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL`.

See ADR-052. Supersedes the prior "API-First Results" formulation (ADR-031 / ADR-043).

---

### API-First Results (legacy term)

**Status:** Superseded.

**Definition:** Earlier formulation of the AUTO-mode rule that designated API-Football as the exclusive source. Replaced by **Scraper-First Results** above when picks4all-scores became the primary live-scoring channel. Term retained here only because older docs and ADR-031 / ADR-043 still use it.

### Mute Reminders

**Definition:** Boolean flag (`muteReminders`) on the Pool model that excludes a pool from deadline reminder emails. Replaces hardcoded pool ID exclusions.

### SITE_URL / SITE_DOMAIN

**Definition:** Environment-driven configuration for the platform's domain. `SITE_URL` (full URL with protocol) is used in the frontend for SEO/canonical links. `SITE_DOMAIN` (domain only) is used in the backend for CORS, cookies, and email footers. Both default to `picks4all.com` via `brand.ts`.

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
