# Product Requirements Document (PRD)
# Picks4All

> **Status:** Live at picks4all.com
> **Document reflects:** Codebase as of 2026-05-03

---

## 1. Product Definition

### 1.1 What Is Picks4All

Picks4All is a **multi-tournament football prediction platform** that enables users to create, manage, and compete in customizable prediction pools. Users predict match outcomes and scores, earn points based on configurable scoring rules, and compete on real-time leaderboards.

The platform supports both personal pools (friends, family, communities) and corporate pools (company-organized events with employee invitation workflows).

### 1.2 Product Identity

| Attribute | Value |
|-----------|-------|
| **Name** | Picks4All |
| **Domain** | picks4all.com (frontend), api.picks4all.com (backend) |
| **Locales** | ES (default, no URL prefix), EN (`/en/`), PT (`/pt/`) |
| **Regional names** | Quiniela (Mexico), polla futbolera (Colombia), prode (Argentina), penca (Uruguay), porra (Spain) |

### 1.3 Target Audience

| Segment | Description |
|---------|-------------|
| **Sports fans** | Friends and family who want to compete on match predictions |
| **Office organizers** | Workplace pool coordinators managing prediction contests |
| **Social groups** | WhatsApp groups, Discord communities, sports clubs |
| **Corporate clients** | Companies running branded prediction pools for employees |

---

## 2. Product Scope

### 2.1 Supported Tournaments

Picks4All uses a template/version/instance architecture that supports any football tournament format.

| Tournament | Status | Format |
|------------|--------|--------|
| **FIFA World Cup 2026** | Sandbox (seeded, not yet live) | 48 teams, 12 groups, 104 matches |
| **UEFA Champions League 2025-26** | Live (active pools, SmartSync enabled) | League phase + knockout, 45+ matches |

**Architecture:**
```
TournamentTemplate (reusable format definition)
  -> TournamentTemplateVersion (immutable snapshot)
    -> TournamentInstance (playable edition with real dates/teams)
      -> Pool (user-created competition)
```

### 2.2 Core Capabilities

1. **Authentication** -- Email/password + Google OAuth, JWT-based sessions
2. **Pool management** -- Create, configure, invite, join, administer prediction pools
3. **Predictions** -- Match score picks, structural picks (group standings, knockout brackets)
4. **Results** -- Scraper-first live scoring (picks4all-scores) with API-Football as fallback. Host override with justification.
5. **Scoring** -- 7 pick types, 4 presets (3 base + custom), cumulative scoring with auto-scaling
6. **Leaderboard** -- Real-time rankings with scoring breakdowns per match/phase
7. **Corporate self-service** -- Enterprise inquiry, pool creation wizard, employee activation
8. **Payments** -- Dual gateway: Mercado Pago (Colombia/COP) + Polar.sh (international/USD)
9. **Internationalization** -- Full ES/EN/PT support for UI, emails, legal pages, SEO
10. **SEO** -- SSR public pages, JSON-LD, hreflang, localized sitemap, regional landing pages
11. **Email notifications** -- Welcome, verification, invitation, deadline reminder, result published, pool completed, corporate activation, capacity warnings, new-member digest, admin alerts
12. **Admin tooling** -- Platform analytics dashboard (`/admin/analytics`), feedback inbox (`/admin/feedback`), email/settings panels
13. **Server-side analytics** -- GA4 Measurement Protocol + Meta CAPI (with retry queue) for purchase deduplication and EMQ uplift

---

## 3. User Roles & Permissions

### 3.1 Platform Roles

| Role | Description |
|------|-------------|
| **PLAYER** | Default role. Joins pools, makes predictions, views leaderboards. |
| **ADMIN** | Platform administrator. Manages tournament templates, instances, platform settings. |

### 3.2 Pool Roles

| Role | Description |
|------|-------------|
| **HOST** | Pool creator and owner. Full control over pool configuration and members. |
| **CO_ADMIN** | Delegated manager nominated by HOST. Can publish results, manage members. Cannot delete pool or nominate other co-admins. |
| **CORPORATE_HOST** | HOST role for corporate pools created via the enterprise flow. |
| **PLAYER** | Pool participant. Can submit/edit own picks before deadlines. |

### 3.3 Permissions Matrix

| Permission | HOST | CO_ADMIN | CORPORATE_HOST | PLAYER |
|------------|:----:|:--------:|:--------------:|:------:|
| View pool details | Yes | Yes | Yes | Yes |
| Submit/edit own picks | Yes | Yes | Yes | Yes |
| View others' picks (after deadline) | Yes | Yes | Yes | Yes |
| View leaderboard | Yes | Yes | Yes | Yes |
| View audit log | Yes | Yes | Yes | Yes |
| Generate invite codes | Yes | Yes | Yes | No |
| Approve/reject join requests | Yes | Yes | Yes | No |
| Expel/ban players | Yes | Yes | Yes | No |
| Reactivate expelled players | Yes | Yes | Yes | No |
| Publish match results (override) | Yes | Yes | Yes | No |
| Correct results (errata) | Yes | Yes | Yes | No |
| Edit pool name/description | Yes | No | Yes | No |
| Nominate co-admins | Yes | No | Yes | No |
| Remove co-admins | Yes | No | Yes | No |
| Delete pool (DRAFT only) | Yes | No | Yes | No |
| Archive pool | Yes | No | Yes | No |
| Manage corporate employees | No | No | Yes | No |

---

## 4. Authentication

### 4.1 Registration Methods

| Method | Details |
|--------|---------|
| **Email + Password** | Email validation, password strength rules (min 8 chars, 1 uppercase, 1 number, 1 special). Unique email enforcement. |
| **Google OAuth** | One-click via Google Identity Services. Auto-creates account or links to existing if email matches. |

### 4.2 Session Management

- JWT tokens with 4-hour expiry, HMAC-SHA256 signed
- Token stored in `localStorage` on frontend
- No refresh tokens; user re-authenticates after expiry
- Auto-logout on 401 response

### 4.3 Account Features

| Feature | Details |
|---------|---------|
| **Email verification** | Required after registration. Token sent via Resend (24h expiry). |
| **Forgot password** | Email-based reset flow. Token expires in 1 hour. |
| **Username** | Unique, 3-20 chars, alphanumeric + underscore. 30-day change cooldown. |
| **Display name** | Public-facing, editable, 3-50 chars. |
| **Timezone** | Auto-detected from browser, manually overridable. All match times shown in user's local timezone. |
| **Email preferences** | Users control which notification types they receive. |

---

## 5. Pool Management

### 5.1 Pool Creation

A pool is created by selecting a tournament instance and configuring:

| Setting | Details |
|---------|---------|
| **Name** | 3-120 characters |
| **Description** | Optional, max 500 characters |
| **Tournament instance** | Selected from active instances |
| **Scoring preset** | BASIC, CUMULATIVE, SIMPLE, or CUSTOM |
| **Pick types config** | Which pick types are active and their point values per phase |
| **Deadline** | Minutes before kickoff (default: 10, range: 0-1440) |
| **Join approval** | Optional requirement for host approval before joining |
| **Max participants** | Optional capacity limit |

On creation, the pool enters DRAFT state, the creator becomes HOST, and an invite code is auto-generated.

### 5.2 Pool State Machine

```
DRAFT ---------> ACTIVE ---------> COMPLETED ---------> ARCHIVED
  |
  v
DELETE (allowed when 0-1 members)
```

| Transition | Trigger |
|------------|---------|
| DRAFT -> ACTIVE | Second player joins the pool |
| DRAFT -> DELETE | Host deletes (only if 0-1 members) |
| ACTIVE -> COMPLETED | Tournament ends (all matches have results) |
| COMPLETED -> ARCHIVED | 90 days pass (auto) or host manual action |
| ACTIVE -> ARCHIVED | Host archives (emergency) |

| State | Can Join | Can Pick | Can Edit Rules | Can Delete |
|-------|:--------:|:--------:|:--------------:|:----------:|
| DRAFT | Yes | Yes | Yes | Yes |
| ACTIVE | Yes | Yes | No | No |
| COMPLETED | No | No | No | No |
| ARCHIVED | No | No | No | No |

**Invariant:** Scoring configuration is immutable after the pool transitions to ACTIVE (second player joins).

### 5.3 Invite System

- 12-character hex invite codes
- Multiple codes per pool allowed
- Optional expiry date and max uses
- If pool requires approval: join request goes to PENDING state, host/co-admins approve or reject

### 5.4 Member Management

| Action | Who Can Do It | Details |
|--------|--------------|---------|
| Expel (ban) | HOST, CO_ADMIN | Status -> BANNED. Player cannot rejoin. Reason required. Picks remain visible in leaderboard. |
| Unban | HOST, CO_ADMIN | Restores BANNED player to ACTIVE. |
| Approve / reject join request | HOST, CO_ADMIN | Only when pool requires approval. PENDING_APPROVAL -> ACTIVE / removed. |
| Leave pool | PLAYER only | Status -> LEFT. Points preserved. Read-only access. |
| Promote to CO_ADMIN | HOST only | By username. |
| Remove CO_ADMIN | HOST only | Demotes back to PLAYER. |

**`PoolMemberStatus` enum:** `PENDING_APPROVAL`, `ACTIVE`, `LEFT`, `BANNED`. There is no temporary "suspended" state — bans are revertible only via explicit unban.

---

## 6. Predictions

### 6.1 Match Pick Types

Players submit a single prediction per match containing an exact score. The scoring engine evaluates that prediction against multiple pick types simultaneously.

| Pick Type | Code | What It Evaluates |
|-----------|------|-------------------|
| Exact Score | `EXACT_SCORE` | Full score match (e.g., predicted 2-1, result 2-1) |
| Goal Difference | `GOAL_DIFFERENCE` | Correct goal difference (e.g., predicted +1, result +1) |
| Match Outcome (90 min) | `MATCH_OUTCOME_90MIN` | Correct winner/draw prediction |
| Home Goals | `HOME_GOALS` | Correct number of home team goals |
| Away Goals | `AWAY_GOALS` | Correct number of away team goals |
| Partial Score | `PARTIAL_SCORE` | Correct goals for at least one team |
| Total Goals | `TOTAL_GOALS` | Correct total goals in the match |

### 6.2 Scoring Presets

| Preset | Key | Description |
|--------|-----|-------------|
| **Cumulative** | `CUMULATIVE` | All 7 pick types active. Points accumulate across all matching criteria. Auto-scaling multipliers for knockout phases. |
| **Basic** | `BASIC` | Exact score only. Auto-scaling multipliers for knockout phases. |
| **Simple** | `SIMPLE` | No match score picks. Only structural predictions (group standings, knockout advancement). |
| **Custom** | `CUSTOM` | Host selects which pick types to enable and sets points per type per phase. |

**Auto-scaling multipliers** (when enabled):

| Phase | Multiplier |
|-------|-----------|
| Group Stage | 1.0x |
| Round of 16 | 1.5x |
| Quarter-finals | 2.0x |
| Semi-finals | 2.5x |
| Third place | 2.5x |
| Final | 3.0x |

### 6.3 Structural Predictions

Beyond match picks, players can predict:

- **Group standings:** Drag-and-drop ordering of teams within each group
- **Knockout bracket winners:** Predict which teams advance through knockout rounds

Structural predictions are scored separately using the structural scoring engine.

### 6.4 Deadlines

- Configurable per pool: `deadlineMinutesBeforeKickoff` (default: 10)
- Once deadline passes, picks are locked (`isLocked = true`)
- Other players' picks become visible only after the match deadline passes
- Deadline reminder emails sent 48 hours before upcoming match kickoffs

---

## 7. Results System

### 7.1 Scraper-First Results

Results are fetched automatically. The platform runs two sync layers:

1. **picks4all-scores (primary)** — In-house scraper service polled by `liveScoresJob` every 15 seconds during a match's live window. Reports provisional and final scores in near real-time.
2. **API-Football (fallback)** — `smartSyncJob` polls API-Football and only publishes results that the scraper has not already reported, activating ~30 minutes after estimated full-time as a safety net.

**Source hierarchy** (higher sources never overwritten by lower ones): `HOST_OVERRIDE > API_CONFIRMED > SCRAPER_PROVISIONAL > HOST_PROVISIONAL > HOST_MANUAL`.

**Grace period:** 5 minutes after estimated full-time before a result is finalized (configurable via `SCORES_GRACE_PERIOD_MS`).

When a result is published in any source:
- Leaderboard is recalculated immediately
- Email notifications go out to pool members (if enabled)
- All match-aware advancement is triggered for the relevant tournament instance

**Key models:**
- `PoolMatchResult` / `PoolMatchResultVersion` — Per-pool result, immutable version history
- `MatchExternalMapping` — Maps internal match IDs to API-Football fixture IDs
- `MatchSyncState` — Tracks per-match sync status (PENDING, LIVE, FINISHED)
- `ResultSyncLog` — Audit trail of all sync operations
- `PlatformSettings.scoresServiceEnabled` — Kill switch for the scraper layer

### 7.2 Host Override

The host can correct an existing result (does not publish from scratch in the AUTO modes — sync layers do that). Override requirements:

- Mandatory: written justification (stored in `PoolMatchOverride`)
- Warning dialog shown before confirmation
- Email notification sent to all pool members informing of the correction
- All result versions are immutable and auditable via `PoolMatchResultVersion`

Legacy tournament instances configured with MANUAL mode are exempt from the scraper-first rule and rely on host publication.

### 7.3 Result Data

Each result includes:
- Home goals, away goals (regular time)
- Penalties home/away (knockout phases)
- Extra time regulation scores (when applicable)
- Result version number
- Publisher info (system source for sync layers, user for overrides)

---

## 8. Leaderboard

- Real-time rankings calculated on each result publication
- Points broken down per match, per phase, per pick type
- Player summary view: personal breakdown of points by match
- Expelled players marked in leaderboard (points preserved, transparency)
- Scoring breakdown modal: click any player-match cell to see point-by-point evaluation
- Mobile-optimized leaderboard view

---

## 9. Corporate Self-Service

### 9.1 Enterprise Flow

| Step | Details |
|------|---------|
| **1. Landing page** | Public page at `/empresas` with marketing content and inquiry form |
| **2. Inquiry** | Company submits contact info via `OrganizationInquiry` (no auth required) |
| **3. Pool creation** | Authenticated CORPORATE_HOST uses 6-step wizard at `/empresas/crear` |
| **4. Employee management** | Add employees manually or via CSV upload (UTF-8 BOM for Excel compatibility) |
| **5. Invitation** | System generates `CorporateInvite` tokens (32-byte / 64-char hex, 30-day expiry) and sends activation emails |
| **6. Activation** | Employee visits `/activar-cuenta?token=xxx`, creates password, joins pool |

### 9.2 Corporate Models

| Model | Purpose |
|-------|---------|
| `Organization` | Company info (name, logo URL, contact, branding fields) |
| `OrganizationInquiry` | Enterprise contact form submissions |
| `CorporateInvite` | Token-based employee invitations (PENDING -> ACTIVATED / EXPIRED) |

### 9.3 Corporate Pool Creation Wizard Steps

1. Company information
2. Tournament selection
3. Pool details (name, description)
4. Scoring configuration (preset selection)
5. Employee invitations (manual + CSV)
6. Summary and confirmation

On creation, the system creates an Organization + Pool + PoolMember(CORPORATE_HOST) in a single transaction.

---

## 10. Internationalization

### 10.1 Locale Configuration

| Locale | URL Pattern | Example |
|--------|-------------|---------|
| Spanish (default) | No prefix | `picks4all.com/como-funciona` |
| English | `/en/` prefix | `picks4all.com/en/how-it-works` |
| Portuguese | `/pt/` prefix | `picks4all.com/pt/como-funciona` |

### 10.2 Coverage

- **UI:** All user-facing strings use `t()` from next-intl. 15+ namespace files per locale.
- **Emails:** All transactional emails support ES/EN/PT with locale-aware templates.
- **Legal:** Terms of service and privacy policy available in all three locales.
- **SEO:** Localized metadata, hreflang alternates, locale-specific sitemap entries.
- **Dates/numbers:** Formatted per user's locale and timezone.

### 10.3 Localized Paths

Key routes have localized slugs:

| Route | ES | EN | PT |
|-------|-----|-----|-----|
| How it works | `/como-funciona` | `/en/how-it-works` | `/pt/como-funciona` |
| Terms | `/terminos` | `/en/terms` | `/pt/termos` |
| Privacy | `/privacidad` | `/en/privacy` | `/pt/privacidade` |
| FAQ | `/faq` | `/en/faq` | `/pt/faq` |

---

## 11. SEO

### 11.1 Public Pages (SSR)

All public-facing pages are server-side rendered for SEO:

| Page | Path | Purpose |
|------|------|---------|
| Landing | `/` | Main landing page with CTAs |
| How it works | `/como-funciona` | Product explanation |
| What is a pool | `/que-es-una-quiniela` | Educational content |
| FAQ | `/faq` | Frequently asked questions (with JSON-LD FAQPage) |
| Terms | `/terminos` | Terms of service |
| Privacy | `/privacidad` | Privacy policy |
| Pricing | `/precios` | Pricing tiers |
| Refunds | `/reembolsos` | Refund policy |
| Enterprise | `/empresas` | Corporate landing page |

### 11.2 Regional SEO Pages

Locale-specific content pages targeting regional search terms:

| Page | Locale | Path |
|------|--------|------|
| Polla futbolera | ES | `/polla-futbolera` |
| Prode deportivo | ES | `/prode-deportivo` |
| Penca futbol | ES | `/penca-futbol` |
| Porra deportiva | ES | `/porra-deportiva` |
| Football pool | EN | `/en/football-pool` |

### 11.3 SEO Features

- `generateMetadata()` on every page for title, description, Open Graph tags
- Dynamic OG image generation via `opengraph-image.tsx` (using `ImageResponse`)
- Dynamic `sitemap.xml` and `robots.txt` generation
- JSON-LD structured data (Organization, FAQPage, WebSite)
- hreflang alternates for all locales + x-default
- Canonical URLs derived from `SITE_URL` in `lib/siteConfig.ts`

---

## 12. Email System

### 12.1 Outbound (Resend)

| Email Type | Trigger |
|------------|---------|
| Welcome | User registers |
| Email verification | On registration (token, 24h expiry) |
| Password reset | User requests password reset (token, 1h expiry) |
| Pool invitation | Member invited to pool |
| Deadline reminder | 48 hours before upcoming match kickoffs |
| Result published | Result published/synced for a match |
| Pool completed | Tournament/pool finishes |
| Corporate activation | Corporate employee invited to join |
| Corporate inquiry confirmation | Company submits enterprise inquiry |
| Admin notification | System alerts for important events (feedback, inquiries) |

All templates are locale-aware (ES/EN/PT), mobile-responsive, and use the Picks4All brand gradient.

### 12.2 Inbound (Cloudflare Email Routing)

16 email addresses configured + catch-all, covering all three locales:
- `soporte@picks4all.com`, `support@picks4all.com`, `suporte@picks4all.com`
- `privacidad@picks4all.com`, `privacy@picks4all.com`, `privacidade@picks4all.com`
- `empresas@picks4all.com`, `enterprise@picks4all.com`

### 12.3 Preferences

- Users can toggle notification types on/off via `/me/email-preferences`
- Platform admin can toggle email types globally via `/admin/settings/email`

---

## 13. Pricing Model

### Personal Pools
- **Free tier:** Up to 20 participants at no cost
- **Paid tiers:** One-time payment per capacity upgrade (blocks of 50 players)
- **COP pricing:** $28,500/block base, declining $1,500 every 2 blocks, min $18,000/block
- **USD pricing:** $7.99/block base, declining $0.40 every 2 blocks, min $4.99/block

### Corporate Pools
- **Free trial:** 2 participants (host + 1 guest) at no cost
- **First paid tier:** 100 participants — $200,000 COP / $49.99 USD
- **Additional blocks:** Same pricing curve as personal (50-player increments)

### Payment Processors
- **Colombia (COP):** Mercado Pago — Payment Brick embedded checkout + IPN webhooks
- **International (USD):** Polar.sh — External hosted checkout
- **Country detection:** ipapi.co (frontend) + Cloudflare headers (backend)

### Pricing Page
- Available at `/precios` (ES), `/pricing` (EN), `/precos` (PT)

---

## 14. Legal & Compliance

| Document | Path | Current Version |
|----------|------|----------------|
| Terms of Service | `/terminos` | v2026-01-25 |
| Privacy Policy | `/privacidad` | Available in ES/EN/PT |
| Refund Policy | `/reembolsos` | Available in ES/EN/PT |

- Legal consent tracked on User model at registration
- Disclaimer: "No real money transactions, entertainment only"
- Minimum age: 13 years

---

## 15. Out of Scope

The following are explicitly **not** part of the platform:

- Real money transactions, gambling, or betting
- Live streaming of matches
- Match commentary or play-by-play
- Direct messaging between users
- User-generated tournament templates (admin-curated only)
- Peer-to-peer payments
- Native mobile apps (web-only)
- Facebook or Apple OAuth (Google only)
- In-pool chat
- Push notifications
- PWA offline mode
