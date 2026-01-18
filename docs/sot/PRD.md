# Product Requirements Document (PRD)
# Quiniela Platform

> **Version:** 0.2-beta (Sprint 2 Complete)
> **Last Updated:** 2026-01-18
> **Status:** Internal Development - Sprint 2 Complete
> **Document Owner:** Product Team

---

## 1. Executive Summary

### 1.1 Product Vision

Build a **world-class multi-tournament sports prediction platform** (currently football-only) that enables users to create, manage, and participate in highly customizable prediction pools with professional-grade UX, robust architecture, and enterprise-level features.

**North Star:** Become the go-to platform for sports fans worldwide to organize and compete in prediction contests with friends, colleagues, and communities.

---

### 1.2 Product Name

**Working Name:** Quiniela Platform
**Status:** Official branding and naming TBD
**Note:** Brand identity (logo, colors, design system) will be developed in future phase.

---

### 1.3 Target Audience

**Primary Users:**
- **Sports fans** who want to compete with friends/family on match predictions
- **Office pools organizers** who manage workplace prediction contests
- **Social groups** (WhatsApp groups, Discord communities) looking for competitive engagement

**User Personas:**
1. **The Organizer (Host):** Creates pools, manages participants, publishes results, maintains fairness
2. **The Competitor (Player):** Joins pools, makes predictions, tracks performance, climbs leaderboards
3. **The Curator (Platform Admin):** Manages tournament templates, ensures data quality, oversees platform

---

### 1.4 Core Value Propositions

**For Hosts:**
- ✅ **Extreme Customization:** Configure scoring rules, pick types, deadlines, approval workflows
- ✅ **Transparency & Auditability:** Full change tracking, errata system with reasons, visible audit logs
- ✅ **Collaboration:** Delegate management to co-admins while maintaining ownership
- ✅ **Fairness Guarantees:** Immutable rules after players join, locked picks after deadlines

**For Players:**
- ✅ **Flexible Prediction Options:** Multiple pick types (exact score, difference, outcome, partial score)
- ✅ **Personalized Experience:** See all times in your timezone, customizable profile
- ✅ **Real-time Leaderboards:** Instant updates when results are published
- ✅ **Trust & Transparency:** See who published/corrected results, review audit trails

**For Platform:**
- ✅ **Scalable Architecture:** Template/version/instance model supports unlimited tournaments
- ✅ **Data Integrity:** Versioning, auditing, and immutability by design
- ✅ **Future-Proof:** Extensible for multiple sports, advanced rules, external APIs

---

## 2. Product Scope

### 2.1 Current State (v0.1-alpha)

**Implemented Features:**
- ✅ User authentication (email/password + **Google OAuth**, JWT-based)
- ✅ **Username system** (unique identifier, separate from email and displayName)
- ✅ **Password recovery** (forgot password flow with email tokens via Resend)
- ✅ Pool creation and join (via invite code)
- ✅ Basic pick system (OUTCOME and SCORE picks)
- ✅ Result publishing with errata support (versioned)
- ✅ **Penalty shootouts in knockout phases** (penaltiesHome/penaltiesAway)
- ✅ **Auto-advance tournament phases** (group stage → round of 32 → knockout)
- ✅ **Phase locking mechanism** (prevents advancing incomplete phases)
- ✅ **Placeholder system for knockout matches** (e.g., "Winner of Group A")
- ✅ Leaderboard with scoring presets (CLASSIC, OUTCOME_ONLY, EXACT_HEAVY)
- ✅ Deadline enforcement (configurable minutes before kickoff)
- ✅ **Enhanced audit logging** (OAuth events, password resets, phase transitions)
- ✅ Tournament template/version/instance architecture
- ✅ WC2026 sandbox (72 matches, 12 groups, 48 teams + knockout phases)
- ✅ Single-call overview endpoint (optimized UX)
- ✅ Frontend: Dashboard, Pool Page, Leaderboard
- ✅ **Professional email templates** (gradient design, mobile-responsive)

**Recent Additions (2026-01-04):**
- 🆕 **Google Sign In** - One-click registration/login with Google accounts
- 🆕 **Account Linking** - Link existing email/password accounts with Google
- 🆕 **Username Auto-Generation** - For OAuth users (from email address)
- 🆕 **Forgot Password Flow** - Secure token-based password reset via email
- 🆕 **Email Confirmation Field** - Reduce typos during registration
- 🆕 **Tournament Advancement System** - Automatic phase transitions with validation
- 🆕 **Penalty Shootout Support** - Track penalty results in knockout matches

**Limitations:**
- ⚠️ No co-admin support (planned for v0.2-beta)
- ⚠️ No approval workflow for join requests (planned for v0.2-beta)
- ⚠️ Limited pick types (only 2, expanding to 7 in v1.0)
- ⚠️ No timezone personalization per user (planned for v0.2-beta)
- ⚠️ No player expulsion/ban system (planned for v0.2-beta)
- ⚠️ Rules can be changed even after players join (planned for v0.2-beta)
- ⚠️ No Facebook/Apple login (Google only for now)
- ⚠️ Mobile UX needs polish
- ⚠️ Email confirmation not required (only double-entry field)

---

### 2.2 Roadmap by Version

#### **v0.2-beta (Sprint 2 Complete)** — Internal Complete Version
**Timeline:** Completed 2026-01-18
**Goal:** Feature-complete internal version with all core functionality

**Must-Have Features:**

**🔐 User System Enhancements:**
- [x] Unique username system (@username, separate from displayName) ✅
- [x] User timezone configuration (auto-detect + manual override) ✅
- [x] User profile page ✅

**👥 Co-Admin System:**
- [x] Host can nominate co-admins (by username) ✅
- [x] Co-admin permissions (publish results, approve members, expel players, invite) ✅
- [x] Co-admins CANNOT delete pool, remove host, or nominate other co-admins ✅
- [x] Audit log for co-admin actions ✅

**🎯 Advanced Pick Rules System:**
- [x] 7 Pick Types implemented:
  1. **EXACT_SCORE:** Predict exact score (e.g., 2-1) ✅
  2. **GOAL_DIFFERENCE:** Predict goal difference (e.g., +2, -1, 0) ✅
  3. **MATCH_OUTCOME_90MIN:** Predict winner/draw (HOME/DRAW/AWAY) ✅
  4. **HOME_GOALS:** Predict goals for home team ✅ (NEW)
  5. **AWAY_GOALS:** Predict goals for away team ✅ (NEW)
  6. **PARTIAL_SCORE:** Predict goals for one team ✅
  7. **TOTAL_GOALS:** Predict total goals in match ✅
- [x] Host configures which pick types are active in pool ✅
- [x] Host assigns points per pick type ✅
- [x] **Cumulative scoring system** (ADR-027) ✅ (NEW)
- [x] Frontend: Dynamic pick UI based on active types ✅
- [x] **4 Presets:** CUMULATIVE, BASIC, ADVANCED, SIMPLE ✅

**🚪 Join Approval Workflow:**
- [x] Pool setting: "Require approval for new members" ✅
- [x] Join request system (PENDING → APPROVED/REJECTED) ✅
- [x] Host/co-admins can approve/reject with optional reason ✅
- [ ] Notifications for pending requests (deferred to v1.0)

**🚫 Player Expulsion System:**
- [x] Host/co-admins can expel (ban) players ✅
- [x] Two expulsion types:
  - **Permanent ban:** Player cannot rejoin (reactivation possible) ✅
  - **Temporary suspension:** Ban for X days ✅
- [x] Expelled player's picks REMAIN visible (transparency) ✅
- [x] Expelled players marked in leaderboard ✅
- [x] Expulsion requires reason (audit trail) ✅

**🔒 Pool State Machine:**
- [x] Pool states: DRAFT → ACTIVE → COMPLETED → ARCHIVED ✅
- [x] DRAFT: Host can delete pool (no players yet) ✅
- [x] ACTIVE: Pool locked, cannot delete (only archive) ✅
- [x] COMPLETED: Tournament ended (30-day grace period) ✅
- [x] ARCHIVED: Auto-archive after 90 days (hidden by default) ✅

**⚙️ Configuration Validation:**
- [x] Rules immutable after 2nd player joins ✅
- [x] Deadline/timezone editable only before first match kicks off ✅
- [x] Name/description always editable ✅
- [x] Clear error messages when validation fails ✅

**🌍 Timezone Enhancements:**
- [x] Auto-detect user timezone from browser ✅
- [x] User can manually override in settings ✅
- [x] All match times shown in user's local timezone ✅
- [x] Deadline calculated per user's timezone ✅
- [x] Display format: "11 Jun 2026, 18:00 (CDT)" ✅

**📊 Audit & Transparency:**
- [x] Visible audit log for all members (who did what, when) ✅
- [x] Track: result publications, erratas, expulsions, co-admin changes ✅
- [ ] Filter audit log by action type, actor (deferred to v1.0)

**🎨 UX Improvements:**
- [x] Pick mode: Read mode (saved) vs Edit mode (button "Modificar") ✅
- [x] Loading states per action (not global spinner) ✅
- [x] Responsive mobile layout (basic) ✅
- [x] Error messages: Clear, actionable, user-friendly ✅
- [x] **Player Summary:** Personal breakdown of points by match ✅ (NEW)
- [x] **Pick Visibility:** See other players' picks post-deadline ✅ (NEW)

**Nice-to-Have:**
- [ ] Team flags/logos (partial - some implemented)
- [ ] Advanced match filters
- [ ] Dark mode toggle (respect user preference)

---

#### **v1.0 (MVP - Public Launch)** — First Public Release
**Timeline:** 8-12 weeks from now
**Goal:** Production-ready platform for general public

**On top of v0.2-beta:**

**🔑 Authentication Enhancements:**
- [ ] Google login (OAuth 2.0)
- [ ] Facebook login (OAuth 2.0)
- [ ] Forgot password flow (email-based, using Resend)
- [ ] Email verification (optional: on registration)

**🎯 Complete Pick Rules System:**
- [ ] 3 Additional Pick Types:
  5. **BOTH_TEAMS_SCORE:** Predict if both teams score (Yes/No)
  6. **TOTAL_GOALS:** Predict over/under total goals (e.g., Over 2.5)
  7. **WINNING_MARGIN:** Predict margin of victory (+1, +2, +3+)
- [ ] UI builder for hosts to configure scoring matrix
- [ ] Preset templates for quick setup (e.g., "World Cup Classic")

**📧 Notification System:**
- [ ] Email notifications (via Resend):
  - Result published
  - Result corrected (errata)
  - Invited to pool
  - Join request approved/rejected
- [ ] User can configure notification preferences

**✅ Onboarding & Help:**
- [ ] First-time user tutorial (interactive walkthrough)
- [ ] Contextual help tooltips
- [ ] FAQ page
- [ ] Demo pool (auto-join for new users)

**⚖️ Legal & Compliance:**
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie consent (if applicable)
- [ ] Age gate (13+ or 18+ depending on jurisdiction)
- [ ] Disclaimer: "No real money transactions, entertainment only"

**🎨 UX Polish:**
- [ ] Team flags for all WC2026 teams
- [ ] Fully responsive (mobile, tablet, desktop)
- [ ] Accessibility (WCAG 2.1 AA compliance)
- [ ] Social sharing (share pool invite via link)
- [ ] Confirmation dialogs for critical actions
- [ ] Empty states, loading skeletons

**🧪 Quality Assurance:**
- [ ] End-to-end testing with beta testers (50+ users)
- [ ] Performance optimization (target: < 2s load time)
- [ ] SEO optimization (meta tags, Open Graph, Twitter Cards)
- [ ] Error tracking (Sentry or similar)
- [ ] Analytics (basic usage metrics)

---

#### **v1.1 - v1.5 (Post-Launch Iterations)** — 3-6 months
**Goal:** Enhance user engagement and retention

- [ ] Admin UI for template creation (no-code tournament builder)
- [ ] Player statistics dashboard (historical performance, streaks, best picks)
- [ ] Public user profiles
- [ ] Badges & achievements (gamification)
- [ ] Pool themes (custom colors, logos)
- [ ] In-app notifications (bell icon)
- [ ] Export leaderboard (CSV, PDF)
- [ ] Advanced filtering (sort leaderboard by different metrics)

---

#### **v2.0 (Scale & Expand)** — 6-12 months
**Goal:** Multi-sport platform with advanced features

- [ ] **Public Pool Lobby:**
  - Discover public pools (search, filter by tournament)
  - Request to join (host approval)
  - Rating system for pools
- [ ] **Multi-Sport Support:**
  - Basketball (NBA, EuroLeague)
  - American Football (NFL, College)
  - Baseball (MLB)
  - Custom sport templates
- [ ] **Advanced Rules Engine:**
  - Phase-specific rules (group stage vs knockout)
  - "Who advances" predictions
  - Bracket predictions
- [ ] **External API Integration:**
  - Auto-fetch results from ESPN, TheScore, etc.
  - Reduce manual result entry
- [ ] **Chat & Social:**
  - In-pool chat (optional, per pool)
  - Reactions to matches/results
  - Trash talk wall (moderated)
- [ ] **Internationalization (i18n):**
  - Spanish, English, Portuguese
  - Locale-specific date/time formats
- [ ] **Premium Features:**
  - Unlimited pools (free: 3 max)
  - Advanced analytics
  - White-label branding
  - API access for automation

---

### 2.3 Out of Scope (Not Planned)

**Explicitly NOT included:**
- ❌ Real money transactions / gambling / betting
- ❌ Live streaming of matches
- ❌ Match commentary or play-by-play
- ❌ Direct messaging between users (privacy/moderation concerns)
- ❌ User-generated tournaments (admin-curated only)
- ❌ Peer-to-peer payments (Venmo, PayPal integration)
- ❌ Mobile native apps (web-first, PWA later)

---

## 3. User Roles & Permissions

### 3.1 Platform Roles

| Role | Description | Count |
|------|-------------|-------|
| **PLATFORM ADMIN** | Curates tournament templates, manages instances, oversees platform | Few (1-5) |
| **HOST** | Creates and owns pools, manages members, publishes results | Many |
| **PLAYER** | Joins pools, makes predictions, competes on leaderboards | Most |

**Note:** A user can be PLAYER on platform level but HOST in their own pools.

---

### 3.2 Pool Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **HOST** | Pool owner/creator | All permissions (see below) |
| **CO-ADMIN** | Delegated manager | Subset of host permissions |
| **PLAYER** | Pool participant | Limited to own picks |

---

### 3.3 Detailed Permissions Matrix

| Permission | HOST | CO-ADMIN | PLAYER |
|------------|:----:|:--------:|:------:|
| **Pool Management** |
| View pool details | ✅ | ✅ | ✅ |
| Edit pool name/description | ✅ | ❌ | ❌ |
| Edit pool rules/scoring | ✅ | ❌ | ❌ |
| Delete pool (DRAFT only) | ✅ | ❌ | ❌ |
| Archive pool | ✅ | ❌ | ❌ |
| **Member Management** |
| Generate invite codes | ✅ | ✅ | ❌ |
| Approve/reject join requests | ✅ | ✅ | ❌ |
| Expel players (ban/suspend) | ✅ | ✅ | ❌ |
| Reactivate expelled players | ✅ | ✅ | ❌ |
| Nominate co-admins | ✅ | ❌ | ❌ |
| Remove co-admins | ✅ | ❌ | ❌ |
| Remove host | ❌ | ❌ | ❌ |
| **Results Management** |
| Publish match results | ✅ | ✅ | ❌ |
| Correct results (errata) | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ✅ |
| **Predictions** |
| Submit own picks | ✅ | ✅ | ✅ |
| Edit own picks (before deadline) | ✅ | ✅ | ✅ |
| View others' picks (before match) | ❌* | ❌* | ❌* |
| View others' picks (after match) | ✅ | ✅ | ✅ |
| **Leaderboard** |
| View leaderboard | ✅ | ✅ | ✅ |

**\*Future feature:** Pool setting to allow/hide picks visibility before match.

---

## 4. Core Features (Detailed)

### 4.1 Authentication & User Management

#### 4.1.1 Registration
- **Email + Password** (v0.2-beta)
  - Email validation (format check)
  - Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
  - Unique email enforcement
  - Display name (3-50 chars)
- **Google OAuth** (v1.0)
- **Facebook OAuth** (v1.0)

#### 4.1.2 Login
- Email + password
- JWT token (4-hour expiry)
- Remember me (optional: 30-day refresh token)
- Auto-logout on 401 (token expiry/invalidation)

#### 4.1.3 Password Recovery (v1.0)
- "Forgot password" link on login page
- Email with reset token (1-hour expiry)
- Reset password form (token validation)
- Email provider: **Resend** (3000 free emails/month)

#### 4.1.4 User Profile (v0.2-beta)
- **Username:** Unique, immutable, 3-20 chars, alphanumeric + underscore
  - Format: `@username` or `username`
  - Validation: `/^[a-zA-Z0-9_]{3,20}$/`
  - Used for: Co-admin nomination, @mentions (future)
- **Display Name:** Public-facing name, editable, 3-50 chars
- **Email:** Private, editable (with verification)
- **Timezone:** Auto-detected, manually overridable
  - IANA timezone (e.g., "America/Mexico_City")
- **Avatar:** (v1.1+) Upload or Gravatar
- **Bio:** (v1.1+) Short description, 200 chars

---

### 4.2 Tournament Architecture

#### 4.2.1 Entities Hierarchy

```
TournamentTemplate (reusable definition)
  └─ TournamentTemplateVersion (immutable snapshot)
      └─ TournamentInstance (playable edition)
          └─ Pool (user-created competition)
```

**Example:**
```
Template: "FIFA World Cup Format"
  Version 1.0 (2024-12-29): 32 teams, 8 groups
  Version 2.0 (2025-06-01): 48 teams, 12 groups ← New format
    Instance: "World Cup 2026"
      Pool: "Office Friends WC2026"
      Pool: "Family Tournament"
    Instance: "World Cup 2030"
```

#### 4.2.2 Template Data Structure

**Teams:**
```json
{
  "id": "mex",
  "name": "Mexico",
  "shortName": "MEX",
  "code": "MEX",
  "groupId": "A"
}
```

**Phases:**
```json
{
  "id": "group_stage",
  "name": "Group Stage",
  "type": "GROUP",
  "order": 1,
  "config": {
    "groupsCount": 12,
    "teamsPerGroup": 4
  }
}
```

**Matches:**
```json
{
  "id": "m1",
  "phaseId": "group_stage",
  "kickoffUtc": "2026-06-11T18:00:00Z",
  "homeTeamId": "mex",
  "awayTeamId": "can",
  "matchNumber": 1,
  "roundLabel": "Group A - Matchday 1",
  "venue": "Estadio Azteca",
  "groupId": "A"
}
```

#### 4.2.3 Version Immutability

**Rules:**
- ✅ DRAFT versions: Editable
- 🔒 PUBLISHED versions: **Immutable** (cannot edit data)
- 🚀 Instances: Created from PUBLISHED versions only
- 📸 Instance dataJson: Frozen snapshot (never changes even if template updates)

**Why?** Ensures pools created from a template don't break if template evolves.

---

### 4.3 Pool Management

#### 4.3.1 Pool Creation

**Required Fields:**
- Tournament instance (select from active instances)
- Pool name (3-120 chars)
- Description (optional, max 500 chars)

**Configuration:**
- **Visibility:** PRIVATE (default) or PUBLIC
- **Timezone:** Auto-detected or manual (IANA format)
- **Deadline:** Minutes before kickoff (default: 10, range: 0-1440)
- **Scoring Preset:** CLASSIC (default), OUTCOME_ONLY, EXACT_HEAVY, or CUSTOM
- **Pick Rules:** (v0.2-beta)
  - Select active pick types (4 available)
  - Assign points per pick type
  - Example: Exact Score = 5pts, Outcome = 1pt
- **Join Approval:** Require host approval (checkbox, default: off)

**On Creation:**
1. Pool created in **DRAFT** state
2. Creator becomes HOST (PoolMember with role=HOST)
3. First invite code auto-generated
4. Audit event: `POOL_CREATED`

#### 4.3.2 Pool States

```
DRAFT ──────→ ACTIVE ──────→ COMPLETED ──────→ ARCHIVED
  ↓
DELETE (allowed)              (no deletion, only archival)
```

**State Transitions:**

| From | To | Trigger | Conditions |
|------|-----|---------|------------|
| DRAFT | ACTIVE | 2nd player joins | Auto |
| DRAFT | DELETED | Host deletes | Only if 0 or 1 members |
| ACTIVE | COMPLETED | Last match ends | Manual or auto (TBD) |
| COMPLETED | ARCHIVED | 90 days pass | Auto or manual |
| ACTIVE | ARCHIVED | Host archives | Emergency only |

**State Effects:**

| State | Can Join | Can Pick | Can Edit Rules | Can Delete |
|-------|:--------:|:--------:|:--------------:|:----------:|
| DRAFT | ✅ | ✅ | ✅ | ✅ |
| ACTIVE | ✅ | ✅ | ❌ | ❌ |
| COMPLETED | ❌ | ❌ | ❌ | ❌ |
| ARCHIVED | ❌ | ❌ | ❌ | ❌ |

#### 4.3.3 Invite System

**Invite Codes:**
- 12-character hex string (e.g., `a3f9c2d8e1b4`)
- Unique per pool
- Multiple codes allowed per pool
- Optional expiry date
- Optional max uses (null = unlimited)

**Join Flow:**
1. Player enters invite code
2. System validates:
   - Code exists and not expired
   - Max uses not exceeded
   - Player not already member
   - Player not banned
   - Instance not ARCHIVED
3. **If approval required:**
   - Create `PoolMemberRequest` (status: PENDING)
   - Notify host/co-admins
   - Player sees "Pending approval" message
4. **If no approval required:**
   - Create `PoolMember` (status: ACTIVE, role: PLAYER)
   - Increment invite code uses
   - Audit event: `POOL_JOINED`
   - If 2nd member → pool transitions to ACTIVE

#### 4.3.4 Join Approval Workflow (v0.2-beta)

**New Table:** `PoolMemberRequest`
```
id, poolId, userId, inviteCodeId
status: PENDING | APPROVED | REJECTED
reason (nullable, for rejection)
requestedAtUtc, processedAtUtc, processedByUserId
```

**Host Actions:**
- **Approve:** Creates PoolMember, updates request to APPROVED
- **Reject:** Updates request to REJECTED with optional reason
- Audit events: `JOIN_REQUEST_APPROVED` / `JOIN_REQUEST_REJECTED`

**Player Notifications:**
- "Your request is pending"
- "You've been approved! You can now make picks."
- "Your request was rejected. Reason: [reason]"

---

### 4.4 Pick System (Predictions)

#### 4.4.1 Pick Types (v0.2-beta: 4 types)

| Type | Code | Description | Example | Points Config |
|------|------|-------------|---------|---------------|
| Exact Score | `EXACT_SCORE` | Predict exact final score | 2-1 | Default: 5 |
| Goal Difference | `GOAL_DIFFERENCE` | Predict goal difference | +2, -1, 0 | Default: 3 |
| Match Outcome | `MATCH_OUTCOME` | Predict winner or draw | HOME/DRAW/AWAY | Default: 1 |
| Partial Score | `PARTIAL_SCORE` | Predict goals for one team | Home: 2 (bonus) | Default: 1 |

**v1.0 Additional Types:**

| Type | Code | Description | Example | Points Config |
|------|------|-------------|---------|---------------|
| Both Teams Score | `BOTH_TEAMS_SCORE` | Will both teams score? | Yes/No | Default: 1 |
| Total Goals | `TOTAL_GOALS` | Over/under total goals | Over 2.5 | Default: 1 |
| Winning Margin | `WINNING_MARGIN` | Margin of victory | +1, +2, +3+ | Default: 2 |

#### 4.4.2 Pick Configuration (Host Settings)

**Per Pool:**
- **Active Pick Types:** Array of enabled types
- **Points Map:** `{ EXACT_SCORE: 5, GOAL_DIFFERENCE: 3, MATCH_OUTCOME: 1, PARTIAL_SCORE: 1 }`
- **Allow Multiple:** Can players score multiple pick types on same match? (Default: Yes)

**Example Configurations:**

**Config 1: "Classic World Cup"**
```json
{
  "activePickTypes": ["EXACT_SCORE", "MATCH_OUTCOME"],
  "pointsMap": {
    "EXACT_SCORE": 5,
    "MATCH_OUTCOME": 1
  },
  "allowMultiple": true
}
```
→ Players submit exact score (2-1). System calculates:
  - If exact match: 5 + 1 = 6 pts
  - If outcome correct only: 1 pt
  - If wrong: 0 pts

**Config 2: "Outcome Only"**
```json
{
  "activePickTypes": ["MATCH_OUTCOME"],
  "pointsMap": {
    "MATCH_OUTCOME": 3
  },
  "allowMultiple": false
}
```
→ Players only pick winner/draw. 3 pts per correct outcome.

**Config 3: "High Roller"**
```json
{
  "activePickTypes": ["EXACT_SCORE", "GOAL_DIFFERENCE", "MATCH_OUTCOME", "PARTIAL_SCORE"],
  "pointsMap": {
    "EXACT_SCORE": 10,
    "GOAL_DIFFERENCE": 5,
    "MATCH_OUTCOME": 2,
    "PARTIAL_SCORE": 1
  },
  "allowMultiple": true
}
```
→ Players submit exact score. System evaluates all 4 types. Max possible: 10+5+2+1 = 18 pts/match.

#### 4.4.3 Pick Submission

**Endpoint:** `PUT /pools/:poolId/picks/:matchId`

**Request Body (v0.2-beta):**
```json
{
  "picks": {
    "EXACT_SCORE": { "homeGoals": 2, "awayGoals": 1 },
    "PARTIAL_SCORE": { "team": "HOME", "goals": 2 }
  }
}
```

**Validation:**
- All active pick types must be submitted
- Match must exist in pool's instance snapshot
- Deadline not passed: `now < (kickoffUtc - deadlineMinutes)`
- User must be active member

**On Success:**
- Upsert `Prediction` record (unique per poolId/userId/matchId)
- Store entire pick object in `pickJson`
- Update `updatedAtUtc`
- Return: Updated pick + match lock status

**On Deadline Passed:**
- Return `409 CONFLICT` with `DEADLINE_PASSED` error code
- Message: "Deadline has passed. Picks are locked."

#### 4.4.4 Pick Deadlines

**Per Pool Configuration:**
- `deadlineMinutesBeforeKickoff` (default: 10)

**Calculation:**
```typescript
deadlineUtc = kickoffUtc - (deadlineMinutesBeforeKickoff * 60000)
isLocked = currentTime >= deadlineUtc
```

**User Experience:**
- **Before deadline:** Edit button enabled, can modify picks
- **After deadline:** Locked badge shown, edit button disabled
- **Display:** "Deadline: 11 Jun 2026, 17:50 (10 minutes before kickoff)"

**Edge Cases:**
- If `deadlineMinutesBeforeKickoff = 0` → Picks locked at kickoff
- If match already started → Always locked (even if deadline was in future)

---

### 4.5 Results Management

#### 4.5.1 Publishing Results

**Who Can Publish:**
- Host
- Co-admins
- Platform admins (emergency override, future)

**Endpoint:** `PUT /pools/:poolId/results/:matchId`

**Request Body:**
```json
{
  "homeGoals": 2,
  "awayGoals": 1,
  "reason": null  // Only required for erratas (version > 1)
}
```

**Business Logic:**

**First Publication (version = 1):**
1. Create `PoolMatchResult` record
2. Create `PoolMatchResultVersion` (version=1, status=PUBLISHED)
3. Link `currentVersionId` to new version
4. Store `createdByUserId` (actor)
5. Set `publishedAtUtc` to now
6. Audit event: `RESULT_PUBLISHED`

**Errata (Correction, version > 1):**
1. Validate `reason` field is NOT empty (required)
2. Create new `PoolMatchResultVersion` (version = currentVersion + 1)
3. Update `PoolMatchResult.currentVersionId` to new version
4. Store actor, reason, timestamp
5. Audit event: `RESULT_CORRECTED`
6. Leaderboard recalculates automatically

**Version History:**
- All versions retained (immutable)
- Current version is "source of truth"
- Players can view version history (future: diff view)

**Example Scenario:**
```
Version 1: MEX 2-1 CAN (published by @hostuser at 18:05)
Version 2: MEX 2-0 CAN (corrected by @coadmin at 18:12, reason: "Gol de CAN anulado por VAR")
Version 3: MEX 3-0 CAN (corrected by @hostuser at 18:30, reason: "Gol adicional en tiempo añadido")
```

#### 4.5.2 Result Validation

**Constraints:**
- `homeGoals >= 0` and `awayGoals >= 0`
- Both must be integers
- No upper limit (technically allows 99-99, but UI may warn)

**UI Safeguards:**
- Confirmation dialog: "Publish result MEX 2-1 CAN?"
- If errata: "You're correcting a published result. Reason is required."
- Show current version before overwriting

---

### 4.6 Leaderboard & Scoring

#### 4.6.1 Scoring Algorithm

**For each match, for each player's picks:**

1. **Evaluate each active pick type:**
   - `EXACT_SCORE`: `predictedHome === actualHome && predictedAway === actualAway`
   - `GOAL_DIFFERENCE`: `(predictedHome - predictedAway) === (actualHome - actualAway)`
   - `MATCH_OUTCOME`: `outcome(predicted) === outcome(actual)`
   - `PARTIAL_SCORE`: `predictedGoals === actualGoals for specified team`

2. **Award points:**
   - If pick correct → Add `pointsMap[pickType]`
   - If wrong → 0 pts

3. **Cumulative scoring:**
   - Player can earn points for multiple pick types on same match
   - Example: Exact score correct → Earns points for EXACT_SCORE, GOAL_DIFFERENCE, MATCH_OUTCOME all at once

**Outcome Calculation:**
```typescript
function outcome(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}
```

#### 4.6.2 Leaderboard Ranking

**Primary Sort:** Total points (DESC)

**Tiebreakers (in order):**
1. **Total exact scores** (most exact predictions wins)
2. **Total correct outcomes** (fallback)
3. **Joined earliest** (`joinedAtUtc ASC`)

**Rationale:**
- Rewards precision (exact scores) over general correctness
- Early joiners have slight advantage (loyalty bonus)
- Deterministic (no ties possible)

**Alternative (for discussion in v1.1):**
- Head-to-head record (who scored more in same matches)
- Streak bonus (consecutive correct picks)
- Difficulty weighting (upset predictions worth more)

#### 4.6.3 Leaderboard Display

**Columns:**
- Rank (#1, #2, etc.)
- Username (with avatar, future)
- Display Name
- Total Points
- Matches Scored (how many matches contributed to score)
- Exact Scores Count (how many exact predictions)
- Status badge (❌ Expulsado if banned)

**Verbose Mode:**
```
GET /pools/:poolId/leaderboard?verbose=1
```

Returns per-match breakdown:
```json
{
  "rank": 1,
  "userId": "...",
  "username": "juancho123",
  "displayName": "Juan Carlos",
  "totalPoints": 42,
  "matchesScored": 15,
  "exactScores": 3,
  "breakdown": [
    {
      "matchId": "m1",
      "pointsEarned": 6,
      "picks": { "EXACT_SCORE": { "homeGoals": 2, "awayGoals": 1 } },
      "result": { "homeGoals": 2, "awayGoals": 1 },
      "scoredPickTypes": ["EXACT_SCORE", "GOAL_DIFFERENCE", "MATCH_OUTCOME"]
    }
  ]
}
```

---

### 4.7 Member Management

#### 4.7.1 Co-Admin System (v0.2-beta)

**Nomination Flow:**
1. Host types username: `@juancho123`
2. System validates:
   - User exists
   - User is active member of pool
   - User is not already co-admin
3. Update `PoolMember.role` from PLAYER → CO_ADMIN
4. Audit event: `CO_ADMIN_NOMINATED`
5. Notification to user: "You've been promoted to co-admin in [Pool Name]"

**Removal Flow:**
1. Host selects co-admin
2. Confirmation: "Remove @juancho123 as co-admin?"
3. Update `PoolMember.role` from CO_ADMIN → PLAYER
4. Audit event: `CO_ADMIN_REMOVED`
5. Notification: "You've been removed as co-admin"

**Constraints:**
- Only HOST can nominate/remove co-admins
- Co-admins CANNOT nominate other co-admins (prevents power grab)
- Host cannot demote themselves
- Unlimited co-admins per pool (no technical limit, but UI may warn if > 5)

#### 4.7.2 Player Expulsion (v0.2-beta)

**Ban Types:**

**1. Permanent Ban:**
```json
{
  "action": "BAN_PERMANENT",
  "userId": "user-id",
  "reason": "Violation of pool rules"
}
```

**2. Temporary Suspension:**
```json
{
  "action": "SUSPEND_TEMPORARY",
  "userId": "user-id",
  "reason": "Late payment",
  "durationDays": 7
}
```

**Effect on User:**
- `PoolMember.status` → BANNED (or SUSPENDED)
- `PoolMember.bannedAtUtc` → timestamp
- `PoolMember.bannedUntilUtc` → null (permanent) or future date (temporary)
- User CANNOT submit new picks
- User CANNOT rejoin with new invite code (blocked by userId check)
- User's existing picks REMAIN visible (transparency)
- User appears in leaderboard with "❌ Expulsado" badge

**Reactivation:**
- Host/co-admin can "Reactivate" banned user
- `PoolMember.status` → ACTIVE
- User can resume making picks
- Audit event: `PLAYER_REACTIVATED`

**Auto-Unban (Temporary Suspensions):**
- Cron job checks `bannedUntilUtc` daily
- If `now > bannedUntilUtc` → Auto-reactivate
- Notification: "Your suspension has ended"

**Audit Trail:**
- `PLAYER_BANNED` / `PLAYER_SUSPENDED`
- Includes: actor, reason, duration (if temp)
- Visible to all members (transparency)

#### 4.7.3 Member Status

**Enum:** `ACTIVE | LEFT | BANNED | SUSPENDED`

**Transitions:**

```
         JOIN
          ↓
      [ACTIVE] ←──── REACTIVATE ───┐
          │                        │
    LEFT  │  BAN                   │
          ↓                        │
      [LEFT]                  [BANNED]
                                   ↑
                            [SUSPENDED]
                                   │
                              (auto-expire)
```

**LEFT vs BANNED:**
- **LEFT:** User voluntarily left (can rejoin)
- **BANNED:** Expelled by host/co-admin (cannot rejoin without reactivation)

---

## 5. User Stories

### 5.1 Host Stories

**As a host, I want to...**

1. **Create a customized pool**
   - Select tournament (e.g., World Cup 2026)
   - Name my pool ("Office Amigos WC2026")
   - Configure scoring rules (exact score = 5pts, outcome = 1pt)
   - Set deadline (15 minutes before kickoff)
   - Require approval for new members

2. **Invite friends to my pool**
   - Generate shareable invite code
   - Share via WhatsApp/email
   - See who has joined
   - Approve/reject join requests

3. **Delegate management to trusted friends**
   - Nominate co-admins by username
   - Co-admins can publish results while I'm busy
   - Remove co-admins if needed

4. **Publish match results**
   - Enter final score (MEX 2-1 CAN)
   - See leaderboard update in real-time
   - Confirm before publishing

5. **Correct mistakes (erratas)**
   - Edit published result
   - Provide reason ("VAR anulled goal")
   - See audit log of changes

6. **Manage problematic members**
   - Expel player with reason
   - Temporarily suspend player
   - Reactivate if they resolve issue

7. **Review transparency & audit**
   - See who published each result
   - See who corrected results and why
   - Review member join/leave history

8. **Prevent rule changes mid-tournament**
   - Rules locked once 2nd player joins
   - Ensures fairness for all participants

---

### 5.2 Player Stories

**As a player, I want to...**

1. **Join a pool easily**
   - Enter invite code
   - See pool details before confirming
   - Wait for approval (if required)

2. **Make predictions my way**
   - Pick exact score (2-1) for max points
   - Or just pick winner for simpler play
   - See how many points each pick type is worth

3. **See match times in my timezone**
   - Automatically detect my location
   - Change timezone manually if needed
   - See clear deadline countdown

4. **Edit my picks before deadline**
   - Change my mind (e.g., 2-1 → 3-0)
   - See locked badge after deadline
   - Know picks are final

5. **Trust the leaderboard**
   - See real-time ranking
   - Know results can't be secretly changed
   - See audit log if results are corrected

6. **Compete fairly**
   - Rules can't change after I join
   - Everyone has same deadline
   - No one can cheat or manipulate

7. **Track my performance**
   - See my total points
   - See my rank (1st, 2nd, etc.)
   - (v1.1+) See my best picks, streaks

---

### 5.3 Platform Admin Stories

**As a platform admin, I want to...**

1. **Curate tournament templates**
   - Create World Cup 2026 template
   - Define teams, groups, matches, schedules
   - Publish template for host use

2. **Manage tournament instances**
   - Create "WC 2026" instance from template
   - Activate instance when tournament starts
   - Mark as completed when tournament ends
   - Archive old instances

3. **Ensure data quality**
   - Validate template data (no duplicate IDs, valid refs)
   - Preview template before publishing
   - Version templates (v1.0 → v2.0)

4. **(Future) Moderate platform**
   - Review reported pools
   - Suspend abusive hosts
   - Override results in disputes

---

## 6. Non-Functional Requirements

### 6.1 Performance

- **Page Load:** < 2 seconds (first contentful paint)
- **API Response:** < 500ms (p95)
- **Leaderboard Calculation:** < 1 second for 100 players
- **Concurrent Users:** Support 1000+ concurrent (v1.0 target)

### 6.2 Scalability

- **Pools:** No technical limit (DB design supports millions)
- **Players per Pool:** Recommended max 500 (UX degrades above this)
- **Matches per Tournament:** Tested up to 72, supports 1000+
- **Database:** Postgres (vertical scaling to 64GB+ RAM)

### 6.3 Security

- **Authentication:** JWT with 4-hour expiry, secure HTTP-only cookies (future)
- **Password Storage:** bcrypt with salt rounds = 10
- **Input Validation:** Zod schemas on all endpoints
- **SQL Injection:** Protected by Prisma (parameterized queries)
- **XSS:** React escapes by default, CSP headers (future)
- **CORS:** Whitelist frontend origin only
- **Rate Limiting:** (v1.0) 100 requests/min per IP

### 6.4 Reliability

- **Uptime:** 99.5% target (v1.0), 99.9% target (v2.0)
- **Data Backup:** Daily automated backups (retention: 30 days)
- **Disaster Recovery:** RTO < 4 hours, RPO < 1 hour
- **Error Tracking:** Sentry integration (v1.0)

### 6.5 Accessibility

- **WCAG 2.1 Level AA** compliance (v1.0)
- Keyboard navigation
- Screen reader support
- Color contrast ratios (4.5:1 minimum)
- Focus indicators

### 6.6 Browser Support

- **Desktop:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile:** iOS Safari 14+, Chrome Android 90+
- **No IE11 support** (EOL June 2022)

### 6.7 Localization (v2.0+)

- **Languages:** Spanish (primary), English, Portuguese
- **Date/Time:** Locale-aware formatting
- **Timezones:** IANA timezone support
- **Currency:** (future) If premium features added

---

## 7. Success Metrics (KPIs)

### 7.1 Acquisition (v1.0 Launch)

- **Target:** 500 registered users in first month
- **Target:** 100 active pools in first month
- **Conversion:** 60% of visitors create account or join pool

### 7.2 Engagement

- **DAU/MAU Ratio:** > 40% (daily active / monthly active)
- **Picks per User:** Avg 15+ picks per pool
- **Return Rate:** 70% of users return after 7 days

### 7.3 Retention

- **D1 Retention:** > 60% (return next day)
- **D7 Retention:** > 40%
- **D30 Retention:** > 25%

### 7.4 Quality

- **Bug Reports:** < 5 critical bugs per month (v1.0)
- **Support Tickets:** < 2% of users submit tickets
- **NPS Score:** > 40 (v1.1+)

### 7.5 Performance

- **Load Time:** < 2s for 90% of page loads
- **Error Rate:** < 0.5% of API requests fail

---

## 8. Risks & Mitigations

### 8.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Database performance degrades** | High | Medium | Index optimization, query caching, read replicas (v2.0) |
| **JWT token theft** | High | Low | HTTP-only cookies, short expiry, refresh tokens (v1.1) |
| **External API downtime** (v2.0) | Medium | Medium | Fallback to manual entry, cache results |
| **Timezone bugs** | Medium | Medium | Extensive testing, use battle-tested libraries (date-fns-tz) |

### 8.2 Product Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low user adoption** | High | Medium | Beta testing, referral incentives, viral invite system |
| **Users confused by pick types** | Medium | High | Tooltips, tutorial, demo pool, clear UI labels |
| **Hosts abuse power** (ban unfairly) | Medium | Medium | Audit logs visible to all, player can dispute (future) |
| **Dispute over results** | Medium | Low | Audit trail, version history, transparent corrections |

### 8.3 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Perceived as gambling** | High | Low | Clear disclaimers, no real money, "entertainment only" |
| **Legal issues** (ToS violations) | High | Low | Lawyer-reviewed ToS, age gate, ban abusive users |
| **Monetization fails** | Medium | Medium | Start free, validate engagement first, A/B test premium |

---

## 9. Open Questions

**For Product Team to Decide:**

1. **Pick Visibility:** Should players see others' picks before matches? Or only after?
   - **Option A:** Always hidden until match ends (builds suspense)
   - **Option B:** Host configurable per pool
   - **Recommendation:** Option B (more flexibility)

2. **Leaderboard Tiebreaker:** Keep `joinedAtUtc` or switch to total exact scores?
   - **Current:** Early joiners win ties
   - **Alternative:** Most exact scores wins ties
   - **Recommendation:** Use exact scores (rewards skill, not timing)

3. **Pool Deletion:** Allow host to delete ACTIVE pools under any condition?
   - **Current Plan:** No deletion, only archive
   - **Alternative:** Allow deletion if < 5 members AND < 3 days old
   - **Recommendation:** Stick with no deletion (data integrity)

4. **Email Notifications:** Default opt-in or opt-out?
   - **Option A:** Opt-in (user must enable)
   - **Option B:** Opt-out (enabled by default, user can disable)
   - **Recommendation:** Opt-out (better engagement, but respect privacy)

5. **Premium Tier Pricing:** $4.99 or $9.99/month?
   - **Market Research Needed:** Survey beta users on willingness to pay
   - **Recommendation:** Start with free tier, validate engagement, then test pricing

6. **Multi-Sport Timeline:** v2.0 or later?
   - **Depends on:** Football adoption success
   - **Recommendation:** Don't commit until v1.0 is proven

---

## 10. Appendix

### 10.1 Glossary

See [GLOSSARY.md](./GLOSSARY.md) for full domain terminology.

### 10.2 Related Documents

- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema & entity relationships
- [API_SPEC.md](./API_SPEC.md) - Complete API documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture & stack
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Business logic & validations
- [DECISION_LOG.md](./DECISION_LOG.md) - Architectural decision records

### 10.3 Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-02 | 1.0 | Product Team | Initial PRD based on v0.1-alpha codebase |
| 2026-01-18 | 1.1 | Product Team | Sprint 2 complete: Cumulative scoring, Player Summary, Pick visibility |

---

**END OF DOCUMENT**
