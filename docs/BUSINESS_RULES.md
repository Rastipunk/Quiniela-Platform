# Business Rules & Validations
# Picks4All

> **Version:** v1.0.0
> **Last Updated:** 2026-05-04

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Authentication Rules](#2-authentication-rules)
3. [Pool Lifecycle Rules](#3-pool-lifecycle-rules)
4. [Pick / Prediction Rules](#4-pick--prediction-rules)
5. [Result Rules](#5-result-rules)
6. [Scoring System](#6-scoring-system)
7. [Member Management](#7-member-management)
8. [Corporate Pool Rules](#8-corporate-pool-rules)
9. [Tournament Rules](#9-tournament-rules)
10. [Live Scoring & Sync Rules](#10-live-scoring--sync-rules)
11. [Data Integrity Invariants](#11-data-integrity-invariants)
12. [Referral Graph](#12-referral-graph)
13. [Consent Mode v2 & Privacy](#13-consent-mode-v2--privacy)

---

## 1. Core Principles

### 1.1 Fundamental Truths

These rules **MUST NEVER** be violated:

1. **Fairness First** — Once players join, scoring rules cannot change.
2. **Transparency** — All actions are auditable (who, what, when, why).
3. **Immutability** — Critical data (published results, published template versions) is append-only.
4. **Deadline Integrity** — Picks are locked after the deadline. No exceptions.
5. **Single Source of Truth** — The current version is always authoritative.
6. **Scraper-First Results** — In AUTO mode, picks4all-scores is the primary live-scoring source (15s polling), with API-Football as fallback (~30 min after estimated FT). The host cannot publish results from scratch; they can only override an existing confirmed result with a mandatory reason and member notification. Source hierarchy `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL` is never violated.

### 1.2 Fail-Safe / Fail-Secure

| Scenario | Approach | Example |
|----------|----------|---------|
| Validation error | Fail-safe | Return 400 with clear message |
| Auth failure | Fail-secure | Deny access, clear token |
| Business rule violation | Fail-safe | Return 409 with explanation |
| Database error | Fail-secure | Rollback transaction, log error |

Default deny: if a rule is ambiguous, deny the action.

---

## 2. Authentication Rules

### 2.1 Registration

**Field validation (Zod):**

| Field | Rule | Error |
|-------|------|-------|
| `email` | Valid email format | `VALIDATION_ERROR` |
| `email` | Unique (case-sensitive DB constraint) | `CONFLICT` |
| `username` | 3-20 chars, alphanumeric + underscore + hyphen | `VALIDATION_ERROR` |
| `username` | Unique (case-insensitive via `normalizeUsername`) | `CONFLICT` |
| `displayName` | 2-50 characters | `VALIDATION_ERROR` |
| `password` | 8-200 characters | `VALIDATION_ERROR` |
| `timezone` | Optional IANA timezone string | - |

**Legal consent (all required except marketing):**

| Field | Rule |
|-------|------|
| `acceptTerms` | Must be `true` |
| `acceptPrivacy` | Must be `true` |
| `acceptAge` | Must be `true` (confirms 13+ years) |
| `acceptMarketing` | Optional, defaults to `false` |

**Business rules:**

- Default platform role: `PLAYER`.
- Default status: `ACTIVE`.
- Username normalized to lowercase before uniqueness check.
- Password hashed with bcrypt (salt rounds = 10), never stored in plaintext.
- Email verification token: 32 bytes `crypto.randomBytes`, hex, expires in 24 hours.
- Audit event: `USER_REGISTERED` with IP and user-agent.
- Verification email sent on registration; welcome email sent after verification.
- Reserved usernames blocked: `admin`, `root`, `system`, `quiniela`, `api`, `www`.

### 2.2 Login

1. Email lookup: exact match (`findUnique`).
2. Password verification: bcrypt timing-safe compare.
3. Account status: reject if `status !== ACTIVE` (returns 401).
4. Token: JWT signed with `{ userId, platformRole }`, 4-hour expiry.
5. Bearer token required in `Authorization: Bearer <token>` header.
6. `requireAuth` middleware re-validates user existence and ACTIVE status on every request.
7. Audit event: `USER_LOGGED_IN`.

### 2.3 Google OAuth

1. Token verified with `google-auth-library`.
2. If email exists without `googleId`: account linked automatically.
3. New user: auto-generates username from email local part; requires legal consent.
4. Google accounts are auto-verified (`emailVerified: true`).
5. OAuth-only users have empty `passwordHash` (`""`).

### 2.4 Password Reset

1. Token: 32 bytes `crypto.randomBytes`, hex encoded.
2. Expiry: 1 hour.
3. Google-only accounts: returns `GOOGLE_ACCOUNT` error.
4. Always returns success message regardless of email existence (prevents enumeration).

### 2.5 Email Verification

1. Token: 32 bytes hex, stored in `emailVerificationToken`, 24-hour expiry.
2. Resend: authenticated users can request a new token via `POST /auth/resend-verification`.
3. Idempotent: if already verified, returns `alreadyVerified: true`.

### 2.6 Rate Limiting

All rate limit values are overridable via environment variables.

| Limiter | Scope | Default Limit | Default Window |
|---------|-------|:-------------:|:--------------:|
| `apiLimiter` | All endpoints (except `/health`) | 100 req | 1 min |
| `authLimiter` | Login, register | 10 req | 15 min |
| `passwordResetLimiter` | Forgot/reset password | 5 req | 1 hour |
| `verificationResendLimiter` | Resend verification | 3 req | 1 hour |
| `corporateInviteCheckLimiter` | `GET /auth/check-corporate-invite` (per IP) | 20 req | 1 min |
| `corporateActivateLimiter` | `POST /auth/activate-corporate` (per IP) | 10 req | 15 min |
| `inquiryLimiter` | `POST /corporate/inquiry` | 5 req | 15 min |
| `inviteSendLimiter` (per user) | `POST /corporate/pools/:id/send-invitations` and `…/employees/:inviteId/resend` | 200 sends | 1 hour |
| `inviteSendDailyLimiter` (per user) | same as above | 1000 sends | 24 hours |
| `poolJoinLimiter` | `POST /pools/join` (per IP) | 10 req | 15 min |
| `poolCreationLimiter` | `POST /pools` | 10 req | 1 hour |
| `resultPublishLimiter` | `PUT /pools/:id/results/:matchId` | 10 req | 1 min |
| `feedbackLimiter` | `POST /feedback` | 5 req | 1 min |

All return standard `RateLimit-*` headers and HTTP 429 on exceed. The historical `corporateInviteLimiter` (5/hour per IP, applied catch-all to `/corporate/pools/*`) was removed — see §8.4 for rationale. See `docs/API_SPEC.md §3` for env-var names per limiter.

---

## 3. Pool Lifecycle Rules

### 3.1 Pool Creation

**Required fields (Zod `createPoolSchema`):**

| Field | Validation | Default |
|-------|------------|---------|
| `tournamentInstanceId` | Must exist, not ARCHIVED | - |
| `name` | 3-120 chars | - |
| `description` | Max 500 chars, optional | `null` |
| `timeZone` | 3-64 chars, IANA timezone | `"UTC"` |
| `deadlineMinutesBeforeKickoff` | Integer 0-1440 | 10 |
| `scoringPresetKey` | Legacy preset key | `"CLASSIC"` |
| `requireApproval` | Boolean | `false` |
| `maxParticipants` | Integer 20-10000 | 20 |
| `pickTypesConfig` | Preset key string or custom config object | `null` |

**Automatic actions on creation:**

1. Creator becomes HOST via a `PoolMember` record.
2. Default visibility: `PRIVATE`.
3. Fixture snapshot: pool gets its own copy of `instance.dataJson` in `fixtureSnapshot`.
4. Audit event: `POOL_CREATED`.
5. No automatic invite code -- must be explicitly created.

**Pick types config processing:**

- String value (`"CUMULATIVE"`, `"BASIC"`, `"SIMPLE"`): generates dynamic config from actual tournament phases.
- Object value: validates against `PoolPickTypesConfigSchema`.
- `null`: uses legacy scoring via `scoringPresetKey`.

### 3.2 Pool State Machine

```
DRAFT ──> ACTIVE ──> COMPLETED ──> ARCHIVED
```

| From | To | Trigger |
|------|----|---------|
| DRAFT | ACTIVE | First PLAYER joins (directly or approved) |
| ACTIVE | COMPLETED | All matches have published results |
| COMPLETED | ARCHIVED | Manual by HOST |

**State-dependent permissions:**

| Action | DRAFT | ACTIVE | COMPLETED | ARCHIVED |
|--------|:-----:|:------:|:---------:|:--------:|
| Join pool | Yes | Yes | No | No |
| Make picks | No | Yes | No | No |
| Publish results | No | Yes | Yes (erratas) | No |
| Edit pool settings | Yes | No | No | No |
| Create invites | Yes | Yes | No | No |

### 3.3 Pool Configuration Editability

- **Editable in DRAFT only:** `timeZone`, `deadlineMinutesBeforeKickoff`.
- **NEVER editable after creation:** `scoringPresetKey`, `pickTypesConfig`, `tournamentInstanceId`.

### 3.4 Join Pool

**Flow (`POST /pools/join`):**

1. Invite code lookup in `PoolInvite` table.
2. Pool status check: `canJoinPool()` requires DRAFT or ACTIVE.
3. Invite expiry check: `expiresAtUtc` if set.
4. Invite max uses check: `uses < maxUses` if set.
5. Capacity check: count ACTIVE + PENDING_APPROVAL members vs `maxParticipants`.
6. Ban check: if BANNED, reject with `403 BANNED_FROM_POOL`.
7. Duplicate check: if already ACTIVE, return current status.
8. Rejoin check: if LEFT, reactivate (ACTIVE or PENDING_APPROVAL).
9. Approval mode: if `requireApproval = true`, set status to `PENDING_APPROVAL`.

**Join approval workflow:**

- `PENDING_APPROVAL` members wait for HOST/CO_ADMIN action.
- Approve: sets ACTIVE, records `approvedByUserId` and `approvedAtUtc`, triggers `transitionToActive()` if DRAFT.
- Reject: deletes the `PoolMember` record (user can try again). Optional reason (1-500 chars).

**Post-join actions:**

- Increment invite `uses` counter.
- Trigger `transitionToActive()` if pool is DRAFT and join was direct.
- Run `checkAndNotifyCapacityThresholds()` to dispatch (at most one of):
  - `CAPACITY_WARNING` email when count crosses the configurable threshold (default 95%, overridable per pool via `Pool.capacityWarningThresholdPct`, env default `CAPACITY_WARNING_THRESHOLD_PCT`).
  - `POOL_FULL` email when count >= `maxParticipants`.
  Both deduped via `Pool.capacityWarningNotifiedAt` / `Pool.poolFullNotifiedAt`. Flags re-armed when capacity is expanded via payment, so notifications fire again if the pool refills.

**Blocked join attempts:** if the capacity check fails (`POOL_FULL`), the attempting email is forwarded to the host via `sendBlockedJoinAttemptEmail`. Throttled per pool by `Pool.lastBlockedAttemptNotifiedAt` (env `BLOCKED_ATTEMPT_THROTTLE_HOURS`, default 24h) so a flood of failed joins produces at most one email per window. Audit event `BLOCKED_JOIN_ATTEMPT` fires unconditionally for forensics.

### 3.5 Invite Code Rules

- Generator: `crypto.randomBytes(CRYPTO_BYTES.POOL_INVITE_CODE = 6).toString("hex")` → 12-char hex string. Collision retry up to 5 attempts.
- Validator (`POST /pools/join`): `z.string().min(6).max(64)` — accepts any code in that length range so legacy invites or future formats keep working. The current generator only ever produces 12-char codes; the wider validator is intentional asymmetry, not a bug.
- Created by HOST or CO_ADMIN only; pool must be DRAFT or ACTIVE.
- Optional `maxUses` (1-500) and `expiresAtUtc` (ISO 8601).
- Email invitations respect target user's notification preferences.

### 3.6 Leave Pool

| Role | Can Leave |
|------|:---------:|
| PLAYER | Yes |
| CO_ADMIN | Yes |
| HOST | **No** (`HOST_CANNOT_LEAVE`) |
| CORPORATE_HOST | **No** (`HOST_CANNOT_LEAVE`) |

**Effect of leaving:**

- `PoolMember.status = "LEFT"`, `leftAtUtc = now()`.
- Picks remain in the database.
- Points preserved in leaderboard (shown as "Retirado").
- User enters read-only mode.
- Audit event: `MEMBER_LEFT`.

**Rejoin:** user can rejoin with a valid invite code. Record reactivated, `leftAtUtc` cleared, previous picks preserved.

### 3.7 Archive / Delete

- Only HOST can archive: sets `status = ARCHIVED`.
- Only allowed from COMPLETED state.
- No hard-delete of pools; archived pools are hidden from listings.

---

## 4. Pick / Prediction Rules

### 4.1 Pick Submission

**Endpoint:** `PUT /pools/:poolId/picks/:matchId`

**Uniqueness:** `(poolId, userId, matchId)` -- one pick per match per user per pool.

**Pick types (Zod discriminated union):**

| Type | Schema |
|------|--------|
| `OUTCOME` | `{ type: "OUTCOME", outcome: "HOME" \| "DRAW" \| "AWAY" }` |
| `SCORE` | `{ type: "SCORE", homeGoals: int(0-99), awayGoals: int(0-99) }` |
| `WINNER` | `{ type: "WINNER", winnerTeamId: string(1-50) }` |

**Deadline enforcement:**

```
deadlineUtc = kickoffUtc - (pool.deadlineMinutesBeforeKickoff * 60000)
if (now > deadlineUtc) → 409 DEADLINE_PASSED
```

**Additional validations:**

1. Pool status: must be ACTIVE.
2. Member status: must be ACTIVE (not LEFT, BANNED, PENDING_APPROVAL).
3. Instance status: cannot pick on ARCHIVED tournament.
4. Match must exist in the tournament instance snapshot.
5. Placeholder teams block picks: prefixes `t_TBD`, `W_`, `RU_`, `L_`, `3rd_`.

**Upsert behavior:** Prisma upsert on compound unique. Existing pick is overwritten. Audit event: `PREDICTION_UPSERTED`.

### 4.2 Pick Visibility

- **Before deadline (unlocked = false):** only the current user sees their own pick.
- **After deadline (unlocked = true):** all active members' picks visible. Sorted: current user first, then alphabetical.

### 4.3 Structural Picks

For SIMPLE preset and custom configs with structural picks:

**GROUP_STANDINGS:**

- Stored in `GroupStandingsPrediction`.
- Per group: `{ groupId, teamIds: [1st, 2nd, 3rd, 4th] }`.
- Unique: `(poolId, userId, phaseId, groupId)`.

**KNOCKOUT_WINNER:**

- Stored in `StructuralPrediction`.
- Per phase: `{ matches: [{ matchId, winnerId }] }`.
- Unique: `(poolId, userId, phaseId)`.

---

## 5. Result Rules

### 5.1 Result Publication

**Endpoint:** `PUT /pools/:poolId/results/:matchId`

**Who can publish:** HOST, CORPORATE_HOST, or CO_ADMIN (via `requirePoolHostOrCoAdmin()`).

**Pool status:** `canPublishResults()` requires ACTIVE or COMPLETED. COMPLETED allows erratas only.

**Result schema (Zod):**

| Field | Validation | Required |
|-------|------------|----------|
| `homeGoals` | Integer 0-99 | Yes |
| `awayGoals` | Integer 0-99 | Yes |
| `homeGoals90` | Integer 0-99 | No (extra time only) |
| `awayGoals90` | Integer 0-99 | No (extra time only) |
| `homePenalties` | Integer 0-99 | No (knockout only) |
| `awayPenalties` | Integer 0-99 | No (knockout only) |
| `reason` | String 1-500 chars | Required for errata or override |

### 5.2 Result Source Tracking

**Enum:** `HOST_MANUAL | HOST_PROVISIONAL | API_CONFIRMED | HOST_OVERRIDE | SCRAPER_PROVISIONAL`

**Source Hierarchy (highest priority first):**

```
HOST_OVERRIDE        → Host corrected a result (requires reason + email to all)
API_CONFIRMED        → Finalized by scraper grace period or API-Football fallback
SCRAPER_PROVISIONAL  → Live score from picks4all-scores (during match)
HOST_PROVISIONAL     → Host entered in AUTO mode (awaiting confirmation)
HOST_MANUAL          → Host entered in MANUAL mode
```

Higher-priority sources are NEVER overwritten by lower-priority ones.

| Instance Mode | Scenario | Source |
|---------------|----------|--------|
| AUTO | Match in progress (scraper polling) | `SCRAPER_PROVISIONAL` |
| AUTO | Match ended + 5min grace period passed | `API_CONFIRMED` (upgraded from SCRAPER_PROVISIONAL) |
| AUTO | Scraper failed + 30min fallback | `API_CONFIRMED` (from API-Football) |
| AUTO | Host corrects existing result | `HOST_OVERRIDE` (requires reason + notifies all) |
| MANUAL | Host publishes | `HOST_MANUAL` |

**Scraper-first enforcement (AUTO mode):**

- picks4all-scores is the **primary** scoring source. It polls live scores every 15 seconds during matches.
- After FT, a 5-minute grace period ensures score stability before finalizing as `API_CONFIRMED`.
- API-Football is a **fallback only** — activates 30 minutes after estimated FT if the scraper hasn't reported.
- The host **cannot** publish results from scratch in AUTO mode. Results must come from the scraper or API-Football.
- The host **can** override an existing confirmed result, but must provide a reason. A warning is shown and an email notification is sent to all pool members.
- Legacy MANUAL mode instances are exempt from scraper-first enforcement.

### 5.3 Version Immutability

1. Once created, `PoolMatchResultVersion` records are **immutable** (no UPDATEs).
2. All versions are retained (full history).
3. Only `currentVersion` is used for scoring.
4. `currentVersionId` always points to the latest version.
5. Version numbering: auto-increment per result (1, 2, 3...).

**Errata (version > 1):**

- `reason` is **required** (1-500 chars).
- If `reason` missing: transaction throws `REASON_REQUIRED_FOR_ERRATA`.
- If source is `HOST_OVERRIDE`: throws `REASON_REQUIRED_FOR_OVERRIDE`.
- Audit event: `RESULT_PUBLISHED`.

### 5.4 Post-Result Actions

After publishing a result, the system automatically:

1. **Email notifications** to all active pool members (async, non-blocking). Includes match description, score, points earned, current ranking.
2. **Auto-advance check:** validates if the completed match's phase is now fully resolved. Only if `autoAdvanceEnabled = true` and phase is not locked.
3. **Pool completion check** via `transitionToCompleted()`. If all matches have results, pool status changes to COMPLETED and final ranking emails are sent.

### 5.5 Penalty Shootout Rules

- `homePenalties` / `awayPenalties` stored on `PoolMatchResultVersion`, default `null`.
- Winner determination for knockout: regulation score first, then penalties if tied.
- Penalties do **not** affect pick scoring. Players predict regulation-time score. Penalties determine advancement only.

### 5.6 Extra Time Configuration

Per-phase `includeExtraTime` flag:

- `true`: scoring uses `homeGoals`/`awayGoals` (full time including ET).
- `false` or absent: scoring uses `homeGoals90`/`awayGoals90` (90-min score), falling back to full-time score if 90-min not available.

### 5.7 Auto-Advance and Phase Locking

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoAdvanceEnabled` | boolean | `true` | Toggle automatic phase advancement |
| `lockedPhases` | JSON array | `[]` | Phase IDs blocked from advancing |

- Auto-advance triggers after every result publication.
- If blocked, logs reason but does NOT fail the result publication.
- Only HOST can lock/unlock phases or trigger manual advance.
- Phase advancement order: `group_stage -> round_of_32 -> round_of_16 -> quarter_finals -> semi_finals -> finals`.

---

## 6. Scoring System

### 6.1 Legacy Scoring Presets

Used when `pickTypesConfig` is null (backward compatibility):

| Preset | Key | Outcome Pts | Exact Score Bonus |
|--------|-----|:-----------:|:-----------------:|
| Clasico | `CLASSIC` | 3 | 2 |
| Solo ganador | `OUTCOME_ONLY` | 3 | 0 |
| Marcador pesado | `EXACT_HEAVY` | 2 | 3 |

Logic: OUTCOME correct = +outcomePoints. SCORE correct outcome = +outcomePoints. SCORE exact match = +exactScoreBonus (only if outcome correct). Max per match (CLASSIC) = 5 pts.

### 6.2 Advanced Pick Type Presets

Used when `pickTypesConfig` is set. Four presets available:

#### CUMULATIVE (Recommended)

Points accumulate for each correct criterion independently:

| Criterion | Group Stage | Knockout |
|-----------|:-----------:|:--------:|
| Match Outcome (90 min) | 5 pts | 10 pts |
| Home Goals Exact | 2 pts | 4 pts |
| Away Goals Exact | 2 pts | 4 pts |
| Goal Difference | 1 pt | 2 pts |
| **Max per match** | **10 pts** | **20 pts** |

#### BASIC

Exact score only, auto-scaled by phase:

| Phase | Points |
|-------|:------:|
| Group Stage | 20 pts |
| Round of 16 | 30 pts |
| Quarter Finals | 40 pts |
| Semi Finals | 50 pts |
| Final | 60 pts |

Auto-scaling multipliers: 1.0x (groups) -> 1.5x -> 2.0x -> 2.5x -> 3.0x (final).

#### SIMPLE

No match scores -- structural picks only:

| Phase Type | Pick Type | Points |
|------------|-----------|:------:|
| Group Stage | GROUP_STANDINGS: Exact position | 10 pts |
| Group Stage | GROUP_STANDINGS: Perfect group bonus | +20 pts |
| Round of 32 | KNOCKOUT_WINNER: Correct advance | 10 pts |
| Round of 16 | KNOCKOUT_WINNER: Correct advance | 15 pts |
| Quarter Finals | KNOCKOUT_WINNER: Correct advance | 20 pts |
| Semi Finals | KNOCKOUT_WINNER: Correct advance | 25 pts |
| Final | KNOCKOUT_WINNER: Correct advance | 30 pts |

#### CUSTOM

Host provides full `PhasePickConfig[]` array, validated by `validatePoolPickTypesConfig()`. Each phase can have different enabled pick types and point values.

### 6.3 Advanced Scoring Engine

The engine (`scoringAdvanced.ts`) auto-detects scoring mode:

**Cumulative system** (when HOME_GOALS or AWAY_GOALS types are enabled):

- Evaluates ALL criteria independently and sums points.
- Criteria: MATCH_OUTCOME_90MIN, HOME_GOALS, AWAY_GOALS, GOAL_DIFFERENCE, TOTAL_GOALS.

**Legacy system** (when using EXACT_SCORE):

- EXACT_SCORE evaluated first; if matched, terminates evaluation (no accumulation).
- If missed, evaluates in order: GOAL_DIFFERENCE, PARTIAL_SCORE, TOTAL_GOALS, MATCH_OUTCOME_90MIN.

**Evaluation functions:**

| Type | Logic |
|------|-------|
| `EXACT_SCORE` | `pick.home === result.home && pick.away === result.away` |
| `GOAL_DIFFERENCE` | `(pick.home - pick.away) === (result.home - result.away)` |
| `PARTIAL_SCORE` | Exactly one of home/away goals matches (XOR) |
| `TOTAL_GOALS` | `(pick.home + pick.away) === (result.home + result.away)` |
| `MATCH_OUTCOME_90MIN` | Same outcome (HOME/DRAW/AWAY) |
| `HOME_GOALS` | `pick.homeGoals === result.homeGoals` |
| `AWAY_GOALS` | `pick.awayGoals === result.awayGoals` |

**Auto-scaling:** optional per-preset, applies multipliers by phase ID.

### 6.4 Leaderboard Ranking

- **Primary sort:** `totalPoints DESC`.
- **Tiebreaker:** `joinedAtUtc ASC` (earliest member wins).
- Includes ACTIVE and LEFT members. LEFT members retain points (shown as "Retirado"). BANNED members excluded.
- Points combine: match pick points + structural pick points.
- `pointsByPhase` breakdown available.

---

## 7. Member Management

### 7.1 Role Permissions Matrix

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

CORPORATE_HOST manages employees through corporate-specific endpoints rather than the standard member management flow.

### 7.2 Co-Admin System

- HOST can nominate any ACTIVE PLAYER as CO_ADMIN.
- HOST can remove CO_ADMIN (demotes back to PLAYER).
- CO_ADMIN has the same permissions as HOST except: cannot archive pool, cannot nominate/remove co-admins, cannot advance phases.
- Audit events: `CO_ADMIN_NOMINATED`, `CO_ADMIN_REMOVED`.

### 7.3 Kick Rules

**Endpoint:** `POST /pools/:poolId/members/:memberId/kick`

- Who can kick: HOST or CO_ADMIN.
- Target must be ACTIVE. Cannot kick self. Cannot kick HOST.
- Effect: `status = LEFT`, `leftAtUtc = now()`. Picks remain. User CAN rejoin with a new invite code.
- Audit event: `MEMBER_KICKED`.

### 7.4 Ban Rules

**Endpoint:** `POST /pools/:poolId/members/:memberId/ban`

- Who can ban: HOST or CO_ADMIN.
- `reason` is **mandatory** (min 1 char). Optional `deletePicks` boolean (default false).
- Target must be ACTIVE. Cannot ban self. Cannot ban HOST.
- Effect: `status = BANNED`, records `bannedAt`, `bannedByUserId`, `banReason`. `banExpiresAt = null` (always permanent).
- If `deletePicks = true`: all user's predictions in this pool deleted.
- User **CANNOT** rejoin (blocked by `BANNED_FROM_POOL` check).
- Audit event: `MEMBER_BANNED`.

### 7.5 Member Status Enum

| Status | Description |
|--------|-------------|
| `PENDING_APPROVAL` | Waiting for HOST/CO_ADMIN approval |
| `ACTIVE` | Full member |
| `LEFT` | Voluntarily left or kicked; read-only, points preserved |
| `BANNED` | Permanently expelled; cannot rejoin |

---

## 8. Corporate Pool Rules

### 8.1 Corporate Inquiry

**Endpoint:** `POST /corporate/inquiry` (public, no auth)

| Field | Validation | Required |
|-------|------------|----------|
| `companyName` | 2-200 chars | Yes |
| `contactName` | 2-100 chars | Yes |
| `contactEmail` | Valid email, max 255 | Yes |
| `contactPhone` | Max 30 chars | No |
| `employeeCount` | Enum: `"1-50"`, `"51-200"`, `"201-500"`, `"500+"` | No |
| `message` | Max 2000 chars | No |
| `locale` | `"es"`, `"en"`, `"pt"` | Default `"es"` |

Actions: creates `OrganizationInquiry`, sends admin notification, sends confirmation to contact.

### 8.2 Corporate Pool Creation

**Endpoint:** `POST /corporate/pools` (authenticated)

| Field | Validation | Default |
|-------|------------|---------|
| `companyName` | 2-200 chars | - |
| `logoBase64` | Max 700,000 chars | `null` |
| `welcomeMessage` | Max 1000 chars | `null` |
| `invitationMessage` | Max 1000 chars | `null` |
| `tournamentInstanceId` | Must exist, not ARCHIVED | - |
| `poolName` | 3-120 chars | - |
| `poolDescription` | Max 500 chars | `null` |
| `timeZone` | IANA timezone | `"UTC"` |
| `deadlineMinutesBeforeKickoff` | 0-1440 | 10 |
| `requireApproval` | Boolean | `false` |
| `pickTypesConfig` | Preset key or custom config | `null` |
| `maxParticipants` | Integer `CORPORATE_POOL_MIN_PARTICIPANTS` to `CORPORATE_POOL_MAX_PARTICIPANTS` (env, default 2-10000) | `CORPORATE_FREE_LIMIT` (env, default 2) |
| `emails` | Array of emails, max 500 | `null` |

**Transaction creates:**

1. `Organization` (status: ACTIVE) with company info and branding.
2. `Pool` (visibility: PRIVATE) linked to organization.
3. `PoolMember` with role `CORPORATE_HOST`.
4. `CorporateInvite` records for each email (with activation tokens).

**Capacity security gate:** the pool is **always** created with `maxParticipants = CORPORATE_FREE_LIMIT` regardless of the value in the request body. The wizard's requested value is treated as intent: if it exceeds the free tier, the wizard initiates checkout immediately after creation (Polar for international, Mercado Pago for Colombia) using the requested capacity as `PoolPayment.toCapacity`. On confirmed payment, `paymentService.handleOrderPaid` raises `Pool.maxParticipants` to the paid value. This cap is the only barrier preventing a malicious caller from creating a high-capacity pool by POSTing directly to the API without paying.

**Corporate invite token:** `crypto.randomBytes(CRYPTO_BYTES.TOKEN = 32)` → 64-char hex string, 30-day expiry. Unique per `(poolId, email)`.

### 8.3 Corporate Activation

**Check:** `GET /auth/check-corporate-invite?token=xxx` -- returns email, poolName, companyName, whether user exists.

**Activate:** `POST /auth/activate-corporate`

**Existing user flow:**

- Finds user by email.
- Adds as PLAYER to pool (if not already member).
- Marks invite as ACTIVATED.
- Triggers `transitionToActive()`.

**New user flow:**

- Requires: `displayName`, `username`, `password`, `acceptTerms`, `acceptPrivacy`, `acceptAge`.
- Creates user account (`emailVerified: true` -- auto-verified for corporate).
- Creates `PoolMember` (role: PLAYER).
- Marks invite as ACTIVATED.
- Triggers `transitionToActive()`.

**Capacity check:** both flows check `pool.maxParticipants` (counting ACTIVE + PENDING_APPROVAL members). Returns `409 POOL_FULL` if at capacity. On block, also fires `sendBlockedJoinAttemptEmail` to the host (throttled, see §3.4).

**Capacity threshold notifications:** the same `checkAndNotifyCapacityThresholds()` flow used in `/pools/join` runs at the end of activation. The host receives:
- `CAPACITY_WARNING` email at the configured threshold (default 95%, overridable per pool).
- `POOL_FULL` email when capacity is reached.
Both deduped, both re-armed on capacity expansion via payment.

**Session-mismatch defence (magic-link):** if the activation request arrives with a valid auth cookie for a DIFFERENT user than the invite recipient, the endpoint returns `409 SESSION_MISMATCH` without setting cookies and without joining the pool. The response body carries `currentUserEmail` and `inviteEmail` so the frontend renders a clear "log out and continue" UI. Email comparison is case-insensitive. Null/expired/invalid cookies are treated as anonymous and activation proceeds normally. This prevents a magic-link from silently overwriting Alice's session with Bob's when Alice accidentally opens Bob's invite.

**Invite status enum:** `PENDING | SENT | ACTIVATED | FAILED`

**Invitation lifecycle:**

```
   addEmployees                    sendInvitations / resendInvitation
       │                                       │
       ▼                                       ▼
   PENDING ─── activation token (30d) ─── PENDING ──email sent OK──► SENT
                                              │
                                              └──email send failed──► FAILED
                                                                       │
                                                                       └──resendInvitation──► PENDING (token rotated)
                                                                                                  │
                                                                                                  ▼ activate-corporate
                                                                                              ACTIVATED
```

- `addEmployees` creates rows directly in `PENDING` (token + 30-day expiry generated server-side).
- `sendInvitations` is bulk: it claims every PENDING invite atomically (`updateMany WHERE status=PENDING SET status=SENT`) BEFORE sending, so concurrent host clicks (double-click, browser restore) don't double-email any employee. If the email send actually fails, the row reverts to `FAILED`.
- `resendInvitation` is per-employee. It rotates the activation token and resets the 30-day expiry inside the same `updateMany` claim (`status IN (PENDING, SENT, FAILED)`), invalidating any leaked old email after the resend was issued. Refused for `ACTIVATED` invites.
- `ACTIVATED` is terminal. The corresponding `User` is now a `PLAYER` of the pool; further changes go through normal pool member flows.

### 8.4 Corporate Invitation Rate Limits

Per-host (not per-IP) limits on `POST /corporate/pools/:poolId/send-invitations`:

| Limiter | Default | Env override | Error code |
|---------|---------|--------------|------------|
| Hourly | 200 sends per user | `RATE_LIMIT_INVITE_SEND_MAX` / `RATE_LIMIT_INVITE_SEND_WINDOW_MS` | `TOO_MANY_INVITE_REQUESTS_PER_HOUR` |
| Daily | 1000 sends per user | `RATE_LIMIT_INVITE_SEND_DAILY_MAX` / `RATE_LIMIT_INVITE_SEND_DAILY_WINDOW_MS` | `DAILY_INVITE_LIMIT_EXCEEDED` |

Bucket key: `req.auth.userId` (falls back to `ipKeyGenerator(req.ip)` for unauthenticated requests, which shouldn't reach this endpoint anyway). Sized for a 500-employee corporate rollout in one sitting; the daily ceiling exists to cap abuse from a compromised host account, not to constrain legitimate flows.

The historical `corporateInviteLimiter` (5/hour per IP, applied catch-all to `/corporate/pools/*`) was removed — it conflated reads and writes, blocked co-hosts on the same office network from each other, and never enforced the right thing.

---

## 9. Tournament Rules

### 9.1 Template Rules

- `key` must be globally unique, URL-safe, lowercase, immutable after creation.
- Default status: `DRAFT`.
- Templates can have multiple versions.
- Deprecating a template does NOT affect existing instances.

**Template status:** `DRAFT | PUBLISHED | DEPRECATED`

### 9.2 Version Rules

- Auto-incrementing `versionNumber` per template (1, 2, 3...).
- DRAFT versions: editable and deletable.
- PUBLISHED versions: **frozen** -- no edits, no deletion. `dataJson` is immutable.
- Publishing requires validation (all references consistent, no duplicates).
- `publishedAtUtc` must be set on transition to PUBLISHED.

**Version status:** `DRAFT | PUBLISHED | DEPRECATED`

### 9.3 Instance Rules

- Created from a PUBLISHED template version.
- `dataJson` is a **frozen snapshot** copied at creation time. Never changes even if template updates.
- Default status: `DRAFT`.

**State transitions:**

```
DRAFT -> ACTIVE -> COMPLETED -> ARCHIVED
```

- DRAFT -> ACTIVE: manual by admin.
- ACTIVE -> COMPLETED: manual or auto when last match ends.
- COMPLETED -> ARCHIVED: manual or auto after 90 days.

| Instance Status | Can Create Pools |
|-----------------|:----------------:|
| DRAFT | Admin only |
| ACTIVE | Yes |
| COMPLETED | No |
| ARCHIVED | No (409) |

### 9.4 Instance Configuration (AUTO mode)

| Field | Description |
|-------|-------------|
| `resultSourceMode` | `MANUAL` or `AUTO` |
| `apiFootballLeagueId` | League ID in API-Football (required for AUTO) |
| `apiFootballSeasonId` | Season in API-Football (required for AUTO) |
| `syncEnabled` | Kill switch for emergency sync stop |
| `lastSyncAtUtc` | Last successful sync timestamp |

### 9.5 Phase Advancement

- **Group -> R32:** calculates group standings, ranks third-place teams, assigns top 8 per FIFA bracket, resolves R32 placeholders.
- **Knockout -> next knockout:** resolves winner placeholders with actual teams.
- Pool independence: advancing phases in one pool does not affect others. Each pool has its own `fixtureSnapshot`.
- Advancement updates `fixtureSnapshot` with resolved team IDs.

### 9.6 Placeholder System

| Context | Format | Example |
|---------|--------|---------|
| Group winners | `W_{groupId}` | `W_A`, `W_B` |
| Group runners-up | `RU_{groupId}` | `RU_A`, `RU_B` |
| Best third-place | `3rd_POOL_{n}` | `3rd_POOL_1` ... `3rd_POOL_8` |
| Knockout winners | `W_{phase}_{n}` | `W_R32_1`, `W_R16_1` |
| Knockout losers | `L_{phase}_{n}` | `L_SF_1`, `L_SF_2` (3rd place match) |
| TBD teams | `t_TBD*` | `t_TBD_R32_1` |

Picks are blocked on matches where either team has a placeholder prefix.

---

## 10. Live Scoring & Sync Rules

picks4all-scores (the in-house scraper) is the **primary** live-scoring channel. API-Football SmartSync is the **fallback** that fills gaps the scraper missed and finalises results. Both layers feed the same source-hierarchy enforcement in §5.2.

### 10.1 Match Sync State Machine

```
PENDING -> IN_PROGRESS -> AWAITING_FINISH -> COMPLETED
                                              SKIPPED
```

| State | Description | When |
|-------|-------------|------|
| `PENDING` | Waiting for kickoff + 5 min | Default for mapped matches |
| `IN_PROGRESS` | Match started, waiting for estimated finish | API confirms in-progress |
| `AWAITING_FINISH` | Past estimated end (kickoff + 110 min), polling every 5 min | Finish check time reached |
| `COMPLETED` | Result obtained, never check again | API returns FT status |
| `SKIPPED` | No API mapping or manual mode | No external fixture ID |

### 10.2 Polling Strategy

- Cron job runs every minute (`SMART_SYNC_CRON`, default `* * * * *`).
- Only processes instances with `resultSourceMode = AUTO` and `syncEnabled = true`.
- Expected API calls per match: 2-4 (vs 20-30 with naive polling).

**PENDING backoff tiers:**

| Time since first check | Poll interval |
|------------------------|:-------------:|
| 0-30 min late | Every 5 min |
| 30 min - 3 hours | Every 60 min |
| 3-10 hours | Every 120 min |
| 10+ hours | Every 24 hours |

### 10.3 Result Source Determination

**Primary path (picks4all-scores scraper):**
1. During match: `liveScoresJob` publishes `SCRAPER_PROVISIONAL` every 15s.
2. After FT + 5min grace: `liveScoresJob` upgrades to `API_CONFIRMED` via `finalizeResult()`.
3. Publishes to ALL pools linked to the instance.

**Fallback path (API-Football via SmartSync):**
1. Only activates if scraper hasn't reported 30min after estimated FT.
2. Source: `API_CONFIRMED`.
3. Can upgrade `SCRAPER_PROVISIONAL` or `HOST_PROVISIONAL` to `API_CONFIRMED`.
4. If host had a `HOST_OVERRIDE`, SmartSync does NOT overwrite it.

Both paths trigger scoring recalculation and auto-advance checks on completion.

### 10.4 Match External Mapping

- `MatchExternalMapping` links internal match IDs to API-Football fixture IDs.
- Unique constraints: `(tournamentInstanceId, internalMatchId)` and `(tournamentInstanceId, apiFootballFixtureId)`.
- Matches without mappings are set to SKIPPED (not synced).

### 10.5 PendingPhaseSync

When a knockout phase completes but the next phase's fixtures are not yet available in API-Football (e.g., draw not made):

- A `PendingPhaseSync` record is created with status `PENDING`.
- Phase sync job runs every 12 hours (08:00 and 20:00 UTC).
- Retries up to 28 attempts (~14 days). After that, marked `FAILED` for manual intervention.
- On success: updates instance data, initializes sync states, notifies admin.

### 10.6 Sync Logging

- `ResultSyncLog` tracks each sync job execution.
- Records: fixtures checked, updated, skipped, errors, API response time, rate limit remaining.

---

## 11. Data Integrity Invariants

### 11.1 Database Constraints (NEVER violated)

1. `User.email` unique.
2. `User.username` unique.
3. `(poolId, userId)` unique on PoolMember.
4. `(poolId, userId, matchId)` unique on Prediction.
5. `(poolId, matchId)` unique on PoolMatchResult.
6. `(resultId, versionNumber)` unique on PoolMatchResultVersion.
7. `(poolId, userId, phaseId)` unique on StructuralPrediction.
8. `(poolId, userId, phaseId, groupId)` unique on GroupStandingsPrediction.
9. `(poolId, phaseId, groupId)` unique on GroupStandingsResult.
10. `(poolId, email)` unique on CorporateInvite.
11. All foreign key integrity enforced by Prisma.

### 11.2 Application-Level Invariants

1. Exactly one HOST (or CORPORATE_HOST) per pool (enforced at creation).
2. Result version immutability: no UPDATEs to `PoolMatchResultVersion`.
3. Template version immutability: PUBLISHED versions are read-only.
4. `currentVersionId` never null after first publish.
5. Errata requires reason (version > 1).
6. HOST_OVERRIDE requires reason.
7. Picks locked after deadline (enforced in API, not DB trigger).
8. Hosts cannot leave pool.
9. Banned users cannot rejoin.

### 11.3 Soft Invariants (API-enforced)

- Pool scoring rules not editable after creation.
- Template key immutable after creation.
- Instance status transitions are forward-only.

---

## 12. Referral Graph

User-to-user attribution model. Enables cohort LTV analysis (referred vs
self-serve) without relying on UTM-only attribution which loses cross-device
and word-of-mouth paths.

### 12.1 Capture semantics

- `User.referredByUserId` is a **write-once first-touch** self-FK.
- Populated automatically when the user's very first pool membership is
  created via `/pools/join` with an invite code.
- Subsequent joins NEVER overwrite the value — the first referrer wins.
- `LEFT → ACTIVE` re-joins are NOT re-captured. A returning user is not
  a new referral.
- **Self-invites do not count** — if the inviter joins their own pool,
  the code skips the write so cohort LTV isn't inflated by host-self-use.

### 12.2 Invite-level tracking

- `PoolInvite.acceptedByUserId` + `acceptedAtUtc` record the FIRST
  redeemer of a code (multi-use invites keep the headline; later joiners
  are enumerable via the audit log).
- Both columns are written atomically inside the join transaction with
  a `WHERE acceptedByUserId IS NULL` guard so concurrent redemptions
  cannot race on the headline.

### 12.3 Analytics fan-out

When a first-time referral completes (ACTIVE join, non-self):

- GA4: `referral_conversion` event with `referrer_user_id`, `pool_id`,
  `invite_code`.
- Meta CAPI: `Lead` event with `content_name=referral_conversion`.
- Audit log: `POOL_JOINED` action dataJson carries `referrerUserId`.

See [`guides/ATTRIBUTION_TAXONOMY.md`](guides/ATTRIBUTION_TAXONOMY.md)
for the full event taxonomy.

---

## 13. Consent Mode v2 & Privacy

Google Consent Mode v2 governs what GA4 / GTM tags are allowed to do
before the user interacts with the banner. Meta Pixel respects a parallel
mechanism via `fbq("consent", "revoke")`.

### 13.1 Default state

The head-inline script in `frontend-next/src/lib/gtm.ts` sets defaults
BEFORE `gtm.js` loads, using returning-user signals available at document
parse time:

1. `localStorage.p4a_cookie_consent === "granted"` → all signals `granted`.
2. Authenticated user (`p4a_logged_in` cookie present) AND no explicit
   stored rejection → all signals `granted` (ToS at signup discloses
   analytics usage — Privacy Policy §11).
3. Otherwise → all signals `denied`.

`ads_data_redaction` tracks the effective state (true when denied) and
`url_passthrough` is always `true` so click IDs survive navigation.

### 13.2 LDU (Limited Data Use) for EEA / UK / CH

`backend/src/lib/metaCapi.ts` attaches `data_processing_options: ["LDU"]`
to every CAPI event whose user `country` is in the EEA + UK + Switzerland
set. Switzerland is included because its revFADP (2023) is aligned with
GDPR. Missing `country` defaults to no LDU — we do not fingerprint IP
for this decision.

### 13.3 Revocation

GDPR Art. 7(3) and CCPA both require consent to be as easy to withdraw
as to grant. The footer link **"Gestionar cookies"** dispatches the
`p4a:consent:reopen` custom event, which clears `p4a_cookie_consent`
from localStorage and re-opens the banner. Nothing else pivots — the
next banner interaction writes the new preference as if it were the
first choice.

---

## 14. Sales Management

Sales documents (cotizaciones + cuentas de cobro) and the
customer-facing CC redemption flow that ties them to capacity
purchases. Full rationale in `ADR-061` (DECISION_LOG.md); execution
log in `SALES_IMPLEMENTATION.md`; locked decisions in
`SALES_AUDIT.md` §11.

### 14.1 Documents

| Document | Consecutive | Lifecycle | Status transitions |
|---|---|---|---|
| **Cotización** (`Quote`) | `COT-{year}-{4 digits}` | `ACTIVE → EXPIRED` (sweep) or `→ CANCELLED` (admin) | Never DELETE. No `EXPIRED → ACTIVE` ressurrection — admin must issue a new one. |
| **Cuenta de cobro** (`AccountReceivable`) | `CC-{year}-{4 digits}` | `PENDING → REDEEMED → PAID`. Sweep `PENDING → EXPIRED` past `validUntil`. Reconciler `REDEEMED → PENDING` on payment expiry. Any → `CANCELLED` (admin). | `PAID` is terminal — never reverted. |

Both rows carry an immutable `issuerSnapshotJson` (deep copy of
`backend/src/lib/issuerInfo.ts` at issue time). The PDF renderer
reads from the snapshot, never from the live constant — so updating
the issuer's bank account / address tomorrow does not retroactively
edit yesterday's documents.

### 14.2 Pricing safeguard

- Admin input names participants (Quote) or `targetCapacity` (CC) plus
  currency. The amount is **computed server-side** via
  `backend/src/lib/pricing.ts` (`calculateUpgradePrice` /
  `calculateUpgradePriceCop` from `CORPORATE_FREE_LIMIT` to the
  requested count). Client-supplied amounts are rejected.
- At redemption, the live `pricing.ts` is **re-evaluated** against the
  CC's snapshot. A mismatch (configuration drift between issue date
  and redemption date) blocks the checkout with `409 CONFLICT` and
  fires the `cc_pricing_drift` admin notification. Admin must reissue
  with the current price.

### 14.3 Redemption

- 8-digit numeric code stored raw in `redemptionCode UNIQUE`; rendered
  in PDFs + UI as `XXXX-XXXX`. Lookup normalises both forms.
- Two concurrent redeemers of the same code → the lock is `tx
  .accountReceivable.updateMany WHERE status = 'PENDING'`. The winner
  proceeds; the loser sees `count === 0` and `paymentService` throws
  `CONFLICT`. Same pattern as `activate-corporate` (ADR-048).
- Pre-flight lookup `POST /sales/account-receivables/redeem`
  (auth-required, NOT admin-required) returns a redemption summary
  the wizard uses to preview capacity + amount; the actual lock
  happens later inside `paymentService.initiateCheckout` /
  `initiateMpCheckout`.
- Redemption is **only available on corporate pools**. The
  `AccountReceivableRedemptionBox` is hidden in standard-pool flows
  and the backend rejects issuance for `poolType !== "corporate"`.

### 14.4 Reconciliation

- `paymentReconcileJob` (ADR-060) transitions stale `PoolPayment`s.
  When the linked payment lands in `EXPIRED` / `FAILED` / `ABANDONED`,
  the same transaction calls `releaseAccountReceivable(tx, ccId)` —
  flips `REDEEMED → PENDING` only. `PAID` rows are left alone so a
  webhook race never undoes a completed charge.
- `accountReceivableExpiryJob` (hourly, advisory lock `82636504n`)
  sweeps `PENDING` CCs whose `validUntil` is past and flips them to
  `EXPIRED`. Bounded batch, distinct lock key so it does not contend
  with `paymentReconcileJob`.

### 14.5 Trilingual PDFs

- Per-locale string dictionary in `backend/src/pdf/i18n.ts`. The
  `{term}` placeholder is substituted by the admin's choice from
  `SALE_TERMS[locale]` (es: polla/penca/prode/quiniela/porra/pool;
  en: pool/prediction game/sports pool; pt: bolão/palpites/pool).
- The DIAN régimen-tributario phrase appears **only when
  `locale === "es"`** — the issuer's tax status is Colombian and the
  phrase carries no legal meaning in other jurisdictions.
- The Bancolombia bank-transfer block appears **only when
  `currency === "COP"`** — international USD clients see the online
  card-payment block (Polar) only.
- Every section view carries `wrap={false}` — sections never split
  across pages.

### 14.6 Soft revoke

`DELETE FROM Quote` and `DELETE FROM AccountReceivable` are forbidden.
Cancellation sets `status = 'CANCELLED'`. The consecutive number is
preserved so audit gaps (missing numbers in the series) never appear.

---

## 15. Corporate invitation locale

Full rationale in `ADR-062` (DECISION_LOG.md); execution log in
`CORPORATE_LOCALE_IMPLEMENTATION.md`; locked decisions in
`CORPORATE_LOCALE_AUDIT.md` §3.

### 15.1 Scope

`Organization.invitationLocale` (TEXT NOT NULL DEFAULT `'es'`)
governs **only** the first email each employee receives — the
corporate activation email triggered by `sendCorporateActivationEmail`.
After the employee activates the account, the existing
`LocalePreferenceModal` blocks the dashboard until they pick a
personal locale; from that point onward, `User.locale` is the
authoritative source for every downstream email (deadline reminders,
results, etc.) and `invitationLocale` no longer applies to that user.

### 15.2 Lifecycle

| Trigger | invitationLocale read at | Effect |
|---|---|---|
| Pool created via wizard | Insert time (from form payload) | Persisted on the new `Organization` row. Default `"es"` if the wizard omits it. |
| Host edits via `PoolBrandingTab` | Patch time | `OrganizationBrandingAudit` row written with `{ from, to }`. No-op detection: setting the same value writes nothing. |
| `sendInvitations` runs | Send time | Reads `org.invitationLocale` and passes it to `sendCorporateActivationEmail`. Last-writer-wins — see §15.3. |
| `resendInvitation` or `bulkResendExpired` runs | Send time | Same as above. A resend after a value change ships in the NEW language. |
| Employee activates + completes `LocalePreferenceModal` | First login | `User.locale` set. All downstream emails to that user now read `User.locale`, NOT `Organization.invitationLocale`. |

### 15.3 Last-writer-wins

The org's `invitationLocale` is read at send time, not at upload time.
A host who uploads a CSV when the value is `"es"` and changes it to
`"en"` before any email actually leaves will see the queued
invitations ship in English. Locked semantic per
`CORPORATE_LOCALE_AUDIT.md` §3.8.

### 15.4 No retroactive resend

Changing `invitationLocale` does NOT re-send invitations that already
shipped. PENDING invites whose emails already left keep the old
language in the recipient's inbox; the host must explicitly use the
resend action to re-ship in the new language.

### 15.5 Restricted to corporate pools

Standard (non-corporate) pools have no `Organization`, so
`invitationLocale` does not exist for them. The branding panel only
surfaces the picker when the pool is corporate.

---

## 16. Welcome email handoff

Full rationale in `ADR-063` (DECISION_LOG.md); execution log in
`EMAIL_LOCALE_HANDOFF_IMPLEMENTATION.md`; locked decisions in
`EMAIL_LOCALE_HANDOFF_AUDIT.md` §3.

### 16.1 Single trigger surface

The welcome email is dispatched from **exactly two places**, never inline at signup or activation:

1. `POST /users/me/locale-preference` — happy path. Fires when the user closes `LocalePreferenceModal`, with the just-chosen `User.locale`.
2. `welcomeEmailFallbackJob` — safety net. Fires 24h after user creation if path 1 hasn't run.

`User.welcomeEmailSentAt` (DateTime nullable) is the idempotency key. Set in the same `prisma.user.update` as `User.locale` and `User.localePromptCompletedAt`. Once non-null, the user is excluded from the fallback's candidate set.

### 16.2 Locale resolution for the fallback

When the fallback job fires (user never closed the modal), locale is resolved as:

| Path | Locale source |
|---|---|
| Corporate employee (member of a pool whose pool.organization has `invitationLocale`) | `org.invitationLocale` |
| Otherwise (signup path, no corporate pool) | `resolveUserLocale(user)` — chain of User.locale → User.country → platform default |

### 16.3 Activation page locale matches the email

The corporate-invitation email's link is built with `backend/src/lib/activationUrl.ts`, which mirrors the localized pathnames registered in `frontend-next/src/i18n/routing.ts`. Concrete mapping:

- `es → /activar-cuenta`
- `en → /en/activate-account`
- `pt → /pt/ativar-conta`

The employee whose invitation arrived in English clicks the link and lands directly on the English activation page. No intermediate Spanish UI.

### 16.4 Reliability semantics

- `welcomeEmailSentAt` is set BEFORE the Resend call (inside the tx). If Resend fails, the welcome is lost (no retry-with-counter). Acceptable trade-off — manual support recovery is cheaper than a retry mechanism, and the alternative (set-after-send) would double-send on transient Resend errors.
- The fallback job leaves `welcomeEmailSentAt` NULL on its own thrown errors (e.g. network issue talking to Resend), so the next tick retries.
- The migration backfilled every pre-existing user with `welcomeEmailSentAt = createdAtUtc` so the fallback job ignores them on its first run.

### 16.5 No effect on other emails

The deferred dispatch concerns ONLY the welcome email. All other emails (deadline reminders, results, payment receipts, corporate check-in, etc.) continue to read `User.locale` once it's set, which after the modal is always populated. Background jobs are NOT filtered by `localePromptCompletedAt` — punishing closed-tab users by silencing their pool notifications would be worse than the rare locale mismatch.

---

## 17. Locale resolution

Full rationale in `ADR-064` (DECISION_LOG.md); execution log in
`LOCALE_RESOLUTION_IMPLEMENTATION.md`; locked decisions in
`LOCALE_RESOLUTION_AUDIT.md` §3.

### 17.1 Precedence

For every request that reaches `proxy.ts`, locale is resolved in this fixed order:

| Priority | Signal | Authoritative when |
|---|---|---|
| 1 | URL prefix (`/en/`, `/pt/`) | Cookie agrees or is absent |
| 2 | `NEXT_LOCALE` cookie | Present and a valid locale |
| 3 | `Accept-Language` header | No cookie AND no URL prefix |
| 4 | `routing.defaultLocale = "es"` | Everything else fails |

If the URL prefix disagrees with the cookie, the cookie wins — the middleware issues a 307 redirect to align them.

### 17.2 SEO posture

`routing.localeCookie: false` is preserved. next-intl does NOT write `NEXT_LOCALE` on every response — public SSG pages stay cacheable, avoiding the Set-Cookie vs Cache-Control contradiction that downgrades Google indexing priority. Only our explicit writers set the cookie:

- `LanguageSelector.tsx` (client-side, on user click)
- `LocalePreferenceModal.tsx` (client-side, on modal submit)
- `setAuthCookies` (server-side, on register / login / google / activate-corporate)
- `setLocaleCookie` (server-side, on POST `/users/me/locale-preference`)

### 17.3 Backend sync at every auth event

Every endpoint that establishes or refreshes a session writes `NEXT_LOCALE` if the user's `locale` is known:

| Endpoint | Cookie written? |
|---|---|
| `POST /auth/register` | Only if `User.locale` non-null (typically null at register — modal sets it later) |
| `POST /auth/login` | Yes if `User.locale` non-null (returning users) |
| `POST /auth/google` | Same as login |
| `POST /auth/activate-corporate` | Only if existing user with `locale` populated |
| `POST /users/me/locale-preference` | Always (`setLocaleCookie`) — defensive backup for client write |

When `User.locale` is null (fresh signups before the modal), the cookie is NOT written. The modal will set it client-side on first dashboard load.

### 17.4 Logout clears the locale cookie

`clearAuthCookies` clears `NEXT_LOCALE` in addition to the auth cookies. Without this, two users sharing a browser would inherit each other's locale until the new user explicitly changes it. ADR-064 closes this latent bug.

### 17.5 next-intl boundaries

`routing.ts` configures:
- `localePrefix: "as-needed"` — ES (default) has no URL prefix; EN and PT do.
- `localeCookie: false` — next-intl doesn't read/write the cookie.
- `localeDetection: false` — next-intl doesn't auto-redirect by `Accept-Language`.

The result: next-intl only renders based on URL prefix or falls back to `defaultLocale`. All other locale signals flow through our `proxy.ts`.

## 18. Payment completion + reconciliation (ADR-065)

Every code path that needs to mark a `PoolPayment` as `COMPLETED` goes through `paymentService.markPaymentCompleted`. Direct writes of `poolPayment.status = "COMPLETED"` are forbidden. The shared function exists so the two payment gateways (Polar for USD/international, Mercado Pago for COP/Colombia) provide identical downstream treatment to the customer regardless of how the success signal arrived.

### 18.1 Callers

| Caller | Path | Source value | Idempotency key |
|---|---|---|---|
| `handleOrderPaid` | Polar webhook (`order.paid`) | `POLAR_WEBHOOK` | `polar.event.id` |
| `processMpPayment` | MP Brick sync response (`approved`) | `MP_SYNC` | `mp-{paymentId}-approved` |
| `handleMpWebhook` | MP IPN webhook (`approved`) | `MP_WEBHOOK` | `mp-{paymentId}-approved` |
| `reconcileStaleMpPayment` | MP reconciler (`getPayment.status=approved`) | `RECONCILER` | `mp-{paymentId}-reconciled` |

The MP sync and IPN paths share the same idempotency key on purpose: whichever lands first claims the `PaymentEvent.polarEventId` UNIQUE slot, and the second dedupes silently via either the status entry guard (status already `COMPLETED`) or the P2002 race. The `source` field records which path actually wrote the row.

### 18.2 Atomic completion sequence

Every successful invocation commits the following inside one `prisma.$transaction`:

1. `PaymentEvent.create` — claims the idempotency slot (UNIQUE `polarEventId`).
2. `PoolPayment.update` — `status: COMPLETED`, `paidAtUtc`, `polarOrderId`, `mpPaymentId` (when provided), `metaEventId`.
3. `Pool.update` — `maxParticipants: payment.toCapacity`, reset capacity-warning + full-pool notification flags.
4. `AccountReceivable.update` (when `payment.accountReceivableId` is set) — `status: PAID`, `paidAtUtc`.
5. `AuditEvent.create` — `action: "PAYMENT_COMPLETED"` with full `dataJson`.

Any failure rolls back the entire sequence, including the idempotency slot, so the gateway's retry (or the reconciler's next tick) can re-process cleanly. The audit row is **inside** the tx — a rollback never leaves a `PAYMENT_COMPLETED` row claiming a non-event.

### 18.3 Post-tx fan-out

Once the tx commits, the function fires four non-blocking side effects via `fireAndForget`:

- **Admin notification** (`sendAdminNotification`) — operator visibility, includes pasarela + source labels.
- **CAPI Purchase event** (`sendCapiEvent`) — server-side Meta event with `metaEventId` for Pixel dedup.
- **GA4 purchase event** (`sendGa4Event`) — measurement-protocol event with correct currency + affiliation per gateway.
- **Payment receipt email** (`sendPaymentReceiptEmail`) — includes CC consecutive when redeemed from a sales document.

A downstream outage at Resend / Meta / GA4 cannot roll back a confirmed payment.

### 18.4 Gateway derivation

`markPaymentCompleted` does not hardcode currency, affiliation, or transaction id. It derives:

- `isMp = source ∈ {MP_SYNC, MP_WEBHOOK} ∨ (source = RECONCILER ∧ payment.mpPreferenceId ≠ NULL)`
- `currency = isMp ? "COP" : "USD"`
- `affiliation = isMp ? "Mercado Pago Colombia" : "Polar International"`
- `value = isMp ? mpPurchaseValue(payment) : payment.amountUsd / 100`

The reconciler routes correctly for either gateway by inspecting `payment.mpPreferenceId`. A new gateway would add a new `PAYMENT_EVENT_SOURCE` value and a new isMp-style branch.

### 18.5 Reconciliation

Two reconcilers run alongside the main flow:

| Job | Scope (WHERE) | Advisory lock | Default cadence |
|---|---|---|---|
| `paymentReconcileJob` | `status IN (INITIATED, PENDING) AND mpPreferenceId IS NULL` | `82636503n` | `*/30 * * * *` |
| `mpPaymentReconcileJob` | `status IN (INITIATED, PENDING) AND mpPreferenceId IS NOT NULL` | `82636506n` | `*/30 * * * *` |

Both query the compound index `PoolPayment_status_createdAtUtc_idx` (migration `20260527_add_mp_payment_id_and_status_index`) for stale rows past the grace period (15 min). Both write `PaymentEvent` rows with `source: RECONCILER`. The two locks are distinct so the jobs run concurrently across Railway replicas without mutual blocking.

The MP reconciler's `approved` branch calls `markPaymentCompleted` — same code path as IPN/sync. Customer gets the receipt, capacity bumps, CAPI/GA4 fire, admin gets notified. The Polar reconciler diverges from this posture and flags `succeeded`-but-uncompleted rows for human review — Polar's completion side effects are tangled enough that the audit kept that path human-mediated. The two postures are intentional and documented in ADR-065.

### 18.6 mpPaymentId capture

MP's real `payment.id` is captured on the `PoolPayment.mpPaymentId` column at the earliest opportunity:

1. On every IPN delivery (any status) before the branch tx — `handleMpWebhook` writes it if NULL.
2. By the reconciler's search fallback for legacy rows that never received an IPN.
3. By `markPaymentCompleted` on any path that includes `mpPaymentId` in its input.

The reconciler reads `payment.mpPaymentId` to call `getPayment()` for canonical state. Without it, the reconciler falls back to `searchPaymentByExternalReference(polarCheckoutId)` — slower but functional.

### 18.7 Webhook return semantics

Webhook handlers return 5xx on processing errors, not 200. Both Polar and Mercado Pago retry with exponential backoff. The 401 signature-error path is the only exception. This ensures a transient failure (DB blip, retry exhaustion at CAPI, etc.) gets re-delivered by the gateway rather than dropped silently.

## 19. Payment-attempt telemetry (ADR-066)

Client-side beacons posted from the browser to `POST /payments/attempts/:paymentId/event` populate `PaymentEvent` rows with `source=CLIENT` so the backend can reconstruct what the user did during a checkout attempt — information no webhook can supply.

### 19.1 Event taxonomy

| `eventType` | Emit site | Meaning |
|---|---|---|
| `REDIRECT_INITIATED` | Pre-redirect, both gateways | Browser is about to assign `window.location.href`. |
| `REDIRECT_FAILED` | Catch around `window.location.href`, both gateways | Synchronous throw during assignment (CSP, popup blocker). |
| `USER_CANCELLED` | `/pago/cancelado` (Polar return path) + Cancel button in `/pago/checkout` (MP). | User chose to leave deliberately. |
| `CLIENT_ERROR` | Reserved — no current emit site. | Catch-all for ad-hoc fetch errors during the flow. |
| `BRICK_LOADED` | MP `/pago/checkout` `onReady`. | MP form rendered and is interactive. |
| `BRICK_ERROR` | MP `/pago/checkout` `onError` + outer SDK-load catch. | MP-supplied error; `details.stage` ∈ `init` / `render` / `submit`. |
| `USER_CLOSED_TAB` | MP `/pago/checkout` `beforeunload`. | Browser tearing down the page mid-flow. |

### 19.2 Lifecycle reconstruction

For an MP attempt, ordering `PaymentEvent` rows by `createdAtUtc` yields one of six terminal sequences:

| Sequence | Interpretation |
|---|---|
| `REDIRECT_INITIATED` alone | Never reached `/pago/checkout` (CSP, popup blocker, network abort). |
| `… BRICK_ERROR(init)` | SDK failed to load or instantiate. |
| `… BRICK_LOADED → USER_CANCELLED` | User clicked the Cancel button. |
| `… BRICK_LOADED → USER_CLOSED_TAB` | User closed the tab without interacting. |
| `… BRICK_LOADED → BRICK_ERROR(render)` | Form rendered then broke. |
| `… BRICK_LOADED → MP_SYNC PAYMENT_COMPLETED` | Paid successfully. |
| `… BRICK_LOADED → MP_SYNC (rejected)` | Card declined / fraud check failed. |

For a Polar attempt, only two extra signals exist: `USER_CANCELLED` from `/pago/cancelado` if the user clicked Polar's cancel exit, or — if neither webhook nor `/pago/cancelado` fires — the reconciler (ADR-060) eventually marks the row `ABANDONED_LOCAL_TIMEOUT` after 24h. Polar's hosted checkout is out-of-domain so we cannot instrument it further.

### 19.3 Transport rules

- **In-flow beacons** (`REDIRECT_INITIATED`, `BRICK_LOADED`, `BRICK_ERROR`, `USER_CANCELLED` from buttons): use `reportPaymentAttemptEvent` (fetch-based). Errors are swallowed silently — a missing beacon must not affect the user-visible flow.
- **Unload-time beacons** (`USER_CLOSED_TAB`): MUST use `reportPaymentAttemptEventBeacon` (`navigator.sendBeacon`). `fetch()` is cancelled by modern browsers during page tear-down, so any audit row sent that way is lost roughly half the time.

Both helpers live in `frontend-next/src/lib/api/paymentAttemptEvent.ts`.

### 19.4 CORS / Content-Type

`navigator.sendBeacon` sends a Blob with `Content-Type: text/plain` to escape the CORS preflight that aborts during unload. The backend route at `POST /payments/attempts/:paymentId/event` mounts a dedicated `express.text({ type: "text/plain", limit: "8kb" })` middleware in front of the handler. The handler `JSON.parse`s the raw string before the Zod schema runs. JSON-body callers (the in-flow beacons) bypass this branch because `req.body` arrives already parsed.

### 19.5 Forensic queries

To reconstruct the lifecycle of a specific attempt:

```sql
SELECT "eventType", source, "createdAtUtc",
       "payloadJson"::text AS details
FROM "PaymentEvent"
WHERE "poolPaymentId" = $1
ORDER BY "createdAtUtc";
```

To count MP attempts by exit state in a window:

```sql
SELECT
  COUNT(*) FILTER (WHERE last_event = 'USER_CANCELLED')        AS cancelled,
  COUNT(*) FILTER (WHERE last_event = 'USER_CLOSED_TAB')       AS closed,
  COUNT(*) FILTER (WHERE last_event = 'BRICK_ERROR')           AS errored,
  COUNT(*) FILTER (WHERE pp.status = 'COMPLETED')              AS completed,
  COUNT(*) FILTER (WHERE pp.status = 'FAILED')                 AS rejected
FROM "PoolPayment" pp
LEFT JOIN LATERAL (
  SELECT "eventType" AS last_event FROM "PaymentEvent"
  WHERE "poolPaymentId" = pp.id
  ORDER BY "createdAtUtc" DESC LIMIT 1
) le ON true
WHERE pp."mpPreferenceId" IS NOT NULL
  AND pp."createdAtUtc" > NOW() - INTERVAL '7 days';
```
