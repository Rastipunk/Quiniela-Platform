# Technical Architecture
# Picks4All

> **Status:** Production (Railway)
> **Domain:** picks4all.com | api.picks4all.com
> **Document reflects:** Codebase as of 2026-04-04

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Database Architecture](#6-database-architecture)
7. [Authentication & Security](#7-authentication--security)
8. [API Design Patterns](#8-api-design-patterns)
9. [Data Flow](#9-data-flow)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Branding System](#11-branding-system)
12. [Configuration](#12-configuration)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                     │
│              Browser (Desktop / Mobile)                                │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           │ HTTPS
                           │
┌──────────────────────────▼───────────────────────────────────────────┐
│                      CLOUDFLARE DNS                                    │
│  picks4all.com     → CNAME → frontend-next-*.up.railway.app          │
│  api.picks4all.com → CNAME → backend-*.up.railway.app                │
│  Email Routing: 16 addresses + catch-all                              │
└─────────┬───────────────────────────┬────────────────────────────────┘
          │                           │
┌─────────▼──────────────┐  ┌────────▼───────────────────────────────┐
│  FRONTEND SERVICE       │  │  BACKEND SERVICE                        │
│  Railway                │  │  Railway                                 │
│                         │  │                                          │
│  Next.js 16 (App Router)│  │  Node.js 22+ / Express 5 / TypeScript   │
│  TypeScript + React 19  │  │  Prisma 6.19+ ORM                       │
│  next-intl v4           │  │                                          │
│  standalone output      │  │  ┌────────┐ ┌──────────┐ ┌────────┐    │
│                         │  │  │ Routes │ │ Services │ │  Jobs  │    │
│  SSR: public/SEO pages  │  │  │  23    │ │   20     │ │   4    │    │
│  CSR: authenticated app │  │  └───┬────┘ └────┬─────┘ └───┬────┘    │
│                         │  │      │           │           │          │
│  CSS custom properties  │  │  ┌───▼───────────▼───────────▼──────┐   │
│  (no Tailwind)          │  │  │         Libraries (34 files)      │   │
│                         │  │  │  jwt, email, scoring, audit, etc. │   │
│                         │  │  └──────────────┬───────────────────┘   │
│                         │  │                 │                        │
│                         │  │  ┌──────────────▼───────────────────┐   │
│                         │  │  │        Prisma ORM Client          │   │
│                         │  │  └──────────────┬───────────────────┘   │
└─────────────────────────┘  └─────────────────┼───────────────────────┘
                                               │
                                               │ SQL (parameterized)
                                               │
                             ┌─────────────────▼───────────────────────┐
                             │          POSTGRESQL 16                    │
                             │          Railway managed                  │
                             │                                          │
                             │  27 models, 36 migrations                │
                             │  ACID transactions, indexes, FK, JSON    │
                             └──────────────────────────────────────────┘

External Integrations:
  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
  │ API-Football │  │   Resend     │  │ Google Identity Svcs  │
  │ (api-sports) │  │   (email)    │  │ (OAuth)               │
  │ SmartSync    │  │   6 types    │  │ Sign-In + verify      │
  └──────────────┘  └──────────────┘  └──────────────────────┘
```

### 1.2 Architecture Style

**Monorepo + Monolithic Services**

- **Monorepo:** Single Git repository with `/backend` and `/frontend-next`
- **Backend:** Monolithic Express app with service layer, libraries, and cron jobs
- **Frontend:** Next.js App Router. SSR for public pages, CSR for authenticated app
- **Database:** Single PostgreSQL instance (Railway managed)
- **Communication:** REST/JSON over HTTPS. Frontend calls backend via `Authorization: Bearer <JWT>` header
- **State management:** Client-side only (localStorage + custom events). No server-side sessions.

---

## 2. Technology Stack

### 2.1 Backend

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 22+ | JavaScript execution |
| Framework | Express | 5.2.1 | HTTP server and routing |
| Language | TypeScript | 5.9.3 | Type-safe JavaScript |
| ORM | Prisma | 6.19.1 | Database client, migrations, type generation |
| Database | PostgreSQL | 16 | Relational data store |
| Validation | Zod | 4.2.1 | Runtime schema validation on all endpoints |
| Auth | jsonwebtoken | 9.0.3 | JWT signing and verification |
| Password | bcrypt | 6.0.0 | Password hashing (salt rounds = 10) |
| OAuth | google-auth-library | 10.5.0 | Google OAuth token verification |
| Email | Resend | 6.6.0 | Transactional email delivery |
| HTTP Security | helmet | 8.1.0 | Security headers |
| CORS | cors | 2.8.5 | Cross-origin resource sharing |
| Rate Limiting | express-rate-limit | 8.2.1 | Brute-force and abuse protection |
| Cron | node-cron | 4.2.1 | Scheduled jobs (SmartSync, phase sync, reminders) |
| Config | dotenv | 17.2.3 | Environment variable management |
| Testing | Vitest | 4.x | Unit and integration tests |

### 2.2 Frontend

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 16.1.6 | Full-stack React framework (App Router, standalone) |
| Language | TypeScript | 5.x | Type-safe JavaScript |
| UI | React | 19.2.3 | Component library |
| i18n | next-intl | 4.8.3 | Internationalization (ES/EN/PT) |
| Drag & Drop | @dnd-kit | 6.x / 10.x | Sortable UI for group standings predictions |
| HTTP | Fetch API | Native | API requests (no Axios) |
| Styling | CSS custom properties | -- | Light theme, no framework (no Tailwind, no CSS-in-JS) |
| Linting | ESLint + eslint-config-next | 9.x | Code quality |

**State management:** Local component state (`useState`/`useEffect`). Auth state via `localStorage` + custom event system (`quiniela:auth`). No global state library.

### 2.3 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend hosting | Railway | Node.js service |
| Frontend hosting | Railway | Next.js standalone server |
| Database | Railway PostgreSQL | Managed PostgreSQL 16 |
| DNS | Cloudflare | DNS management, CNAME to Railway, Email Routing |
| Email (outbound) | Resend | Transactional emails (verified domain) |
| Email (inbound) | Cloudflare Email Routing | 16 addresses + catch-all |
| Sports data | API-Football (api-sports.io) | Live match results and fixtures |
| Analytics | Google Analytics (GA4) | User analytics |
| OAuth | Google Identity Services | Google Sign-In |

---

## 3. Project Structure

### 3.1 Monorepo Layout

```
quiniela-platform/
├── backend/                  # Node.js + Express backend
│   ├── prisma/               # Schema + 36 migrations
│   ├── src/                  # TypeScript source
│   ├── dist/                 # Compiled JS (gitignored)
│   ├── .env                  # Environment variables (gitignored)
│   ├── docker-compose.yml    # Local PostgreSQL container
│   ├── package.json
│   └── tsconfig.json
├── frontend-next/            # Next.js 16 App Router
│   ├── src/                  # TypeScript source
│   ├── public/               # Static assets
│   ├── .env.local            # Environment variables (gitignored)
│   ├── next.config.ts        # Next.js + next-intl configuration
│   ├── package.json
│   └── tsconfig.json
├── infra/                    # Docker compose for local DB
├── docs/                     # Documentation
│   ├── sot/                  # Source of Truth docs
│   └── guides/               # Operational guides
├── CLAUDE.md                 # Development standards (operational manual)
├── CHANGELOG.md              # Version history
├── README.md                 # Repository entry point
├── railway.toml              # Railway deployment config (backend)
└── .gitignore
```

### 3.2 Backend Directory Structure

```
backend/src/
├── server.ts                          # Express entry point + cron startup
├── db.ts                              # Prisma client singleton
├── middleware/
│   ├── requireAuth.ts                 # JWT authentication
│   ├── requireAdmin.ts                # Platform admin role check
│   └── rateLimit.ts                   # Rate limiters (api, auth, password, create)
├── lib/
│   ├── jwt.ts                         # JWT sign/verify
│   ├── password.ts                    # bcrypt hash/verify
│   ├── passwordRules.ts              # Password strength validation
│   ├── googleAuth.ts                  # Google OAuth token verification
│   ├── audit.ts                       # Audit event logger
│   ├── email.ts                       # Resend email client + send functions
│   ├── emailTemplates.ts             # HTML email templates (locale-aware)
│   ├── brand.ts                       # Brand identity (colors, name, domain)
│   ├── constants.ts                   # Centralized constants (time, tokens, sync, locales)
│   ├── schemas.ts                     # Shared Zod field schemas
│   ├── env.ts                         # Environment variable helpers
│   ├── roles.ts                       # Role permission helpers
│   ├── scoringPresets.ts             # Legacy scoring presets (CLASSIC, OUTCOME_ONLY, EXACT_HEAVY)
│   ├── scoringAdvanced.ts            # Advanced scoring engine
│   ├── scoringBreakdown.ts           # Detailed scoring breakdown per match
│   ├── pickPresets.ts                 # Pick config presets (BASIC, SIMPLE, CUMULATIVE)
│   ├── poolCapacity.ts               # Pool capacity enforcement with row-level locking
│   ├── poolHelpers.ts                # Pool utility functions
│   ├── fixture.ts                     # Fixture data helpers
│   ├── serializers.ts                # Response serialization
│   ├── timezone.ts                    # Timezone utilities
│   ├── username.ts                    # Username generation/validation
│   ├── logger.ts                      # Logging utility
│   ├── authCookies.ts                # HTTP-only cookie handling
│   ├── apiResponse.ts                # Standardized API response helpers
│   ├── asyncHelpers.ts               # Async utility functions
│   └── validateBase64Image.ts        # Base64 image validation
├── routes/
│   ├── auth.ts                        # Register, login, Google OAuth, password reset,
│   │                                  #   email verify, corporate activation
│   ├── me.ts                          # /me/pools, /me/email-preferences
│   ├── pools.ts                       # Pool CRUD, join
│   ├── poolOverview.ts               # Single-call pool overview endpoint
│   ├── poolMembers.ts                # Member management (promote, kick, ban)
│   ├── poolInvites.ts                # Invite code management
│   ├── poolAdmin.ts                  # Pool admin actions
│   ├── picks.ts                       # Match pick upsert and list
│   ├── structuralPicks.ts            # Group standings + knockout predictions
│   ├── results.ts                     # Result publish + leaderboard + breakdown
│   ├── structuralResults.ts          # Structural results (group/knockout)
│   ├── groupStandings.ts             # Granular group standings picks/results
│   ├── catalog.ts                     # /catalog/instances (public tournament catalog)
│   ├── pickPresets.ts                 # /pick-presets (available configs)
│   ├── userProfile.ts                # /users/me/profile (CRUD)
│   ├── feedback.ts                    # /feedback (user bug reports)
│   ├── legal.ts                       # /legal (terms, privacy documents)
│   ├── corporate.ts                   # Corporate pool endpoints (inquiry, create, employees)
│   ├── admin.ts                       # /admin/ping
│   ├── adminCorporate.ts             # Admin corporate management
│   ├── adminTemplates.ts             # Template CRUD
│   ├── adminInstances.ts             # Instance CRUD + phase advancement
│   └── adminSettings.ts              # Platform-wide settings (email toggles)
├── services/
│   ├── smartSync/                     # Smart Sync: per-match API-Football polling
│   │   ├── index.ts
│   │   └── service.ts                # Core sync logic
│   ├── resultSync/                    # Legacy result sync (batch mode, inactive)
│   │   ├── index.ts
│   │   └── service.ts
│   ├── apiFootball/                   # API-Football HTTP client
│   │   ├── index.ts
│   │   ├── client.ts                 # Rate-limited HTTP client
│   │   └── types.ts                  # API response types
│   ├── authService.ts                # Authentication business logic
│   ├── pickService.ts                # Pick submission logic
│   ├── resultService.ts              # Result publication logic
│   ├── poolStateMachine.ts           # Pool lifecycle (DRAFT/ACTIVE/COMPLETED/ARCHIVED)
│   ├── poolOverviewService.ts        # Single-call overview assembly
│   ├── poolMemberService.ts          # Member management logic
│   ├── poolAdminService.ts           # Pool admin business logic
│   ├── corporateService.ts           # Corporate pool business logic
│   ├── adminService.ts               # Admin business logic
│   ├── adminInstanceService.ts       # Instance management logic
│   ├── instanceAdvancement.ts        # Tournament phase advancement
│   ├── tournamentAdvancement.ts      # Bracket advancement logic
│   ├── structuralScoring.ts          # Scoring for structural picks
│   ├── groupStandingsService.ts      # Group standings logic
│   └── deadlineReminderService.ts    # Email reminder scheduling logic
├── jobs/
│   ├── smartSyncJob.ts               # Cron: SmartSync scheduler
│   ├── phaseSyncJob.ts               # Cron: Phase sync / advancement
│   ├── deadlineReminderJob.ts        # Cron: Deadline reminder emails
│   └── resultSyncJob.ts              # Cron: Legacy batch sync (inactive)
├── validation/
│   └── pickConfig.ts                 # Zod schemas for pick configuration
├── schemas/
│   └── templateData.ts              # Zod schema for tournament template data
├── scripts/
│   ├── seedAdmin.ts                  # Create admin user
│   ├── seedTestAccounts.ts           # Create test accounts
│   ├── seedWc2026Sandbox.ts          # Seed WC2026 tournament data
│   ├── seedUcl2025.ts                # Seed UCL 2025-26 data
│   ├── seedLegalDocuments.ts         # Seed terms/privacy documents
│   ├── initSmartSyncStates.ts        # Initialize MatchSyncState records
│   ├── fetchUclData.ts              # Fetch UCL data from API-Football
│   └── ...                           # Various utility scripts
├── types/
│   ├── express.d.ts                  # Extend Express.Request with auth
│   └── pickConfig.ts                 # Pick configuration types
└── wc2026Sandbox.ts                  # WC2026 data builder
```

### 3.3 Frontend Directory Structure

```
frontend-next/src/
├── app/
│   ├── layout.tsx                     # Root layout (minimal, no html/body)
│   ├── robots.ts                      # Dynamic robots.txt generation
│   ├── sitemap.ts                     # Dynamic sitemap.xml generation
│   ├── manifest.ts                    # PWA manifest
│   ├── opengraph-image.tsx            # Dynamic OG image (ImageResponse)
│   ├── apple-icon.tsx                 # Apple touch icon
│   ├── icon.tsx                       # Favicon generation
│   ├── pwa-icon-192/route.tsx         # PWA icon 192px
│   ├── pwa-icon-512/route.tsx         # PWA icon 512px
│   └── [locale]/                      # Locale segment (all pages nested here)
│       ├── layout.tsx                 # Locale layout: <html lang>, NextIntlClientProvider
│       ├── page.tsx                   # Landing page (SSR)
│       ├── not-found.tsx              # 404 page
│       ├── error.tsx                  # Error boundary
│       ├── login/                     # Login page
│       ├── forgot-password/           # Forgot password flow
│       ├── reset-password/            # Reset password flow
│       ├── verify-email/              # Email verification
│       ├── activar-cuenta/            # Corporate employee activation
│       ├── faq/                       # FAQ page (SSR + JSON-LD)
│       ├── como-funciona/             # "How it works" (SSR)
│       ├── que-es-una-quiniela/       # "What is a pool" (SSR)
│       ├── empresas/                  # Enterprise landing + pool creation wizard
│       ├── precios/                   # Pricing page
│       ├── terminos/                  # Terms of service
│       ├── privacidad/                # Privacy policy
│       ├── reembolsos/                # Refund policy
│       ├── polla-futbolera/           # Regional SEO (ES)
│       ├── prode-deportivo/           # Regional SEO (ES)
│       ├── penca-futbol/              # Regional SEO (ES)
│       ├── porra-deportiva/           # Regional SEO (ES)
│       ├── football-pool/             # Regional SEO (EN)
│       └── (authenticated)/           # Route group: AuthGuard wrapper
│           ├── layout.tsx             # AuthGuard + NavBar + Footer
│           ├── dashboard/page.tsx     # User dashboard (my pools)
│           ├── pools/[poolId]/page.tsx # Pool detail page
│           ├── profile/page.tsx       # User profile
│           └── admin/                 # Platform admin pages
│               ├── feedback/page.tsx
│               └── settings/email/page.tsx
├── i18n/
│   ├── routing.ts                     # next-intl routing config
│   ├── request.ts                     # next-intl server config (message loading)
│   └── navigation.ts                 # Typed navigation helpers (Link, redirect)
├── messages/                          # Translation JSON files
│   ├── es/                            # Spanish (15+ namespace files)
│   ├── en/                            # English
│   └── pt/                            # Portuguese
├── components/
│   ├── AuthGuard.tsx                  # Client-side auth gate
│   ├── AuthSlidePanel.tsx             # Slide-in login/register panel
│   ├── NavBar.tsx                     # Authenticated app navigation
│   ├── PublicNavbar.tsx               # Public pages navigation
│   ├── Footer.tsx                     # Site footer
│   ├── LandingContent.tsx             # Landing page (client component)
│   ├── LanguageSelector.tsx           # Language switcher (ES/EN/PT)
│   ├── BrandLogo.tsx                  # Picks4All logo
│   ├── PoolConfigWizard.tsx           # Pool creation/config wizard
│   ├── pool-wizard/                   # Wizard components (context, steps, nav)
│   ├── corporate/                     # Corporate components (7 step files + creation wizard)
│   ├── CorporatePoolCreation.tsx      # Legacy corporate creation (6-step)
│   ├── EnterpriseLandingContent.tsx    # Enterprise landing page content
│   ├── ActivationContent.tsx          # Corporate employee activation
│   ├── CorporateEmployeeManager.tsx   # Employee management UI
│   ├── GroupStandingsCard.tsx         # Draggable group standings
│   ├── groupStandings/               # Group standings sub-components
│   ├── KnockoutMatchCard.tsx          # Knockout bracket card
│   ├── StructuralPicksManager.tsx     # Structural picks UI
│   ├── PlayerSummary.tsx              # Player detail view
│   ├── MobileLeaderboard.tsx          # Mobile-optimized leaderboard
│   ├── ScoringBreakdownModal.tsx      # Scoring detail modal
│   ├── TeamFlag.tsx                   # Team flag display
│   ├── PickRulesDisplay.tsx           # Pick rules explanation
│   ├── PhaseConfigStep.tsx            # Phase configuration in wizard
│   ├── CapacitySelector.tsx           # Pool capacity selector
│   ├── PasswordStrengthIndicator.tsx  # Password strength UI
│   ├── EmailVerificationBanner.tsx    # Email verification reminder
│   ├── EmailPreferencesSection.tsx    # Email notification settings
│   ├── NotificationBadge.tsx          # Notification badge
│   ├── NotificationBanner.tsx         # Banner notifications
│   ├── WhatsNewModal.tsx              # "What's new" modal
│   ├── BetaFeedbackBar.tsx            # Beta feedback strip
│   ├── FeedbackModal.tsx              # Bug/suggestion feedback form
│   ├── PublicPageWrapper.tsx          # Wrapper for public content pages
│   ├── RegionalArticlePage.tsx        # Template for regional SEO pages
│   ├── FAQAccordion.tsx               # Expandable FAQ items
│   ├── JsonLd.tsx                     # JSON-LD structured data helper
│   ├── Breadcrumbs.tsx                # Breadcrumb navigation
│   └── RegisterButton.tsx             # CTA registration button
├── hooks/
│   ├── useAuth.ts                     # Auth state (token, isAuthenticated, isLoading)
│   ├── useIsMobile.ts                 # Responsive breakpoint detection
│   └── usePoolNotifications.ts        # Pool notification polling
├── contexts/
│   └── AuthPanelContext.tsx            # Auth slide panel state + redirectTo parameter
├── lib/
│   ├── api/                           # Modular API client
│   │   ├── client.ts                  # requestJson, getApiBase, 401 handling
│   │   ├── auth.ts                    # login, register, google, password flows
│   │   ├── dashboard.ts              # getMePools, listInstances, createPool, joinPool
│   │   ├── pool.ts                    # getPoolOverview, upsertPick, upsertResult
│   │   ├── structural.ts             # structural picks and results
│   │   ├── scoring.ts                # match/phase/group breakdowns
│   │   ├── members.ts                # member management
│   │   ├── profile.ts                # user profile and preferences
│   │   ├── admin.ts                   # admin operations
│   │   ├── corporate.ts              # corporate pool operations
│   │   └── index.ts                   # Re-exports
│   ├── auth.ts                        # Token storage + auth event system
│   ├── brand.ts                       # Brand identity (mirrors backend)
│   ├── siteConfig.ts                 # SITE_URL, SITE_NAME, EMAIL_DOMAIN
│   ├── theme.ts                       # Theme derived from brand
│   ├── validation.ts                  # Centralized form constraints
│   └── timezone.ts                    # Timezone detection
├── data/
│   └── teamFlags.ts                   # Team code -> flag URL mapping
├── types/
│   └── pickConfig.ts                  # Pick configuration types
├── proxy.ts                           # Next.js middleware: www redirect + i18n routing
└── globals.css                        # Global styles (CSS custom properties)
```

---

## 4. Backend Architecture

### 4.1 Request Processing Pattern

All backend logic follows the pattern: **Route -> Service -> Library**

```
Request
  -> Middleware (requireAuth, rateLimit)
  -> Route handler (input validation via Zod)
  -> Service (business logic, transaction orchestration)
  -> Library (utilities: email, scoring, audit)
  -> Prisma (database operations)
  -> Response
```

Business logic never lives in route handlers. Routes validate input and call services.

### 4.2 Express Application Entry Point

`server.ts` configures:

1. Trust proxy (Railway reverse proxy environment)
2. CORS
3. JSON body parser (1MB limit)
4. Global rate limiting
5. Stricter rate limiting on auth endpoints
6. Router mounting (23 route files)
7. Health check endpoint with version/commit info
8. Cron job startup (SmartSync, phase sync, deadline reminders)

### 4.3 Middleware

**Rate Limiting:**

| Limiter | Scope | Window | Max Requests |
|---------|-------|--------|-------------|
| `apiLimiter` | All endpoints (except /health) | 1 min | 100 |
| `authLimiter` | Login, register | 15 min | 10 |
| `passwordResetLimiter` | Forgot/reset password | 1 hour | 5 |
| `createResourceLimiter` | Pool/invite creation | 1 hour | 20 |

All limits are configurable via `RATE_LIMIT_*_MAX` environment variables.

**Authentication middleware (`requireAuth`):**
1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify signature and expiry
3. Load user from database, check `status === ACTIVE`
4. Attach `{ userId, platformRole }` to `req.auth`

**Admin middleware (`requireAdmin`):**
- Runs after `requireAuth`, checks `platformRole === ADMIN`

### 4.4 Service Layer

Key services and their responsibilities:

| Service | Purpose |
|---------|---------|
| `smartSync/service.ts` | Per-match API-Football polling, result auto-publication |
| `poolStateMachine.ts` | Pool lifecycle transitions (DRAFT -> ACTIVE -> COMPLETED -> ARCHIVED) |
| `instanceAdvancement.ts` | Tournament phase advancement (group -> R16 -> QF -> SF -> F) |
| `tournamentAdvancement.ts` | Bracket advancement logic (populating knockout matches) |
| `resultService.ts` | Result publication, override, errata, leaderboard recalculation |
| `pickService.ts` | Pick submission with deadline enforcement |
| `poolOverviewService.ts` | Single-call overview assembly (matches, picks, results, leaderboard) |
| `corporateService.ts` | Corporate pool creation, employee management, invitation |
| `deadlineReminderService.ts` | Email reminder scheduling (48h window, excludes pools with muted reminders) |
| `structuralScoring.ts` | Scoring for group standings and knockout bracket predictions |

### 4.5 Cron Jobs

| Job | File | Schedule | Purpose |
|-----|------|----------|---------|
| Smart Sync | `smartSyncJob.ts` | Periodic (configurable) | Poll API-Football for live match results |
| Phase Sync | `phaseSyncJob.ts` | Periodic | Check and process pending phase advancement |
| Deadline Reminders | `deadlineReminderJob.ts` | Periodic | Send email reminders for upcoming match deadlines |
| Result Sync (legacy) | `resultSyncJob.ts` | Inactive | Batch mode sync (replaced by SmartSync) |

### 4.6 Validation

All request bodies validated with Zod schemas before processing. Key validation files:
- `validation/pickConfig.ts` -- Pick configuration and preset schemas
- `schemas/templateData.ts` -- Tournament template data schema
- `lib/schemas.ts` -- Shared field schemas (email, username, password, etc.)

---

## 5. Frontend Architecture

### 5.1 Rendering Strategy

| Page Type | Rendering | Examples |
|-----------|-----------|---------|
| Public/SEO pages | SSR (server-side) | Landing, FAQ, how-it-works, legal, regional SEO, pricing |
| Authenticated app | CSR (client-side) | Dashboard, pool page, profile, admin |
| Corporate public | CSR (client component) | Enterprise landing, activation |

### 5.2 Internationalization (next-intl v4)

**Routing configuration (`i18n/routing.ts`):**

```typescript
export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed",  // ES has no prefix; EN/PT have /en/, /pt/
  pathnames: {
    "/como-funciona": {
      es: "/como-funciona",
      en: "/how-it-works",
      pt: "/como-funciona",
    },
    "/terminos": {
      es: "/terminos",
      en: "/terms",
      pt: "/termos",
    },
    // ... more localized paths
  },
});
```

**URL patterns:**
- `picks4all.com/` -- Spanish (default, no prefix)
- `picks4all.com/en/` -- English
- `picks4all.com/pt/` -- Portuguese
- `picks4all.com/en/how-it-works` -- Localized path

**Messages:** JSON files split by namespace (auth, dashboard, pool, seo, faq, etc.). 15+ namespaces per locale.

### 5.3 Middleware (`proxy.ts`)

Next.js middleware handles:
1. **www redirect:** `www.picks4all.com` -> `picks4all.com` (301)
2. **i18n routing:** Locale detection, NEXT_LOCALE cookie persistence, redirect via `next-intl/middleware`

### 5.4 Authentication Flow

```
1. User logs in or registers
     -> Backend returns JWT

2. setToken(jwt) saves to localStorage
     -> fires "quiniela:auth" custom event

3. useAuth() hook listens for auth changes
     -> exposes { token, isAuthenticated, isLoading }

4. AuthGuard wraps (authenticated) route group
     -> redirects to landing if no token

5. API client auto-injects Authorization: Bearer <token>

6. On 401 response:
     -> clearToken() fires event
     -> useAuth updates
     -> AuthGuard redirects to landing
```

**Google Sign-In:**
- GIS library loaded via `<Script strategy="lazyOnload">`
- On success, frontend sends `idToken` to `POST /auth/google`
- Backend verifies with `google-auth-library`, creates or links user

### 5.5 API Client (`lib/api/`)

Modular API client organized by domain:

| Module | Methods |
|--------|---------|
| `client.ts` | `requestJson()`, `getApiBase()`, 401 handling, session expiry |
| `auth.ts` | login, register, loginWithGoogle, forgotPassword, resetPassword, verifyEmail |
| `dashboard.ts` | getMePools, listInstances, createPool, joinPool |
| `pool.ts` | getPoolOverview, upsertPick, upsertResult, createInvite |
| `structural.ts` | structural picks, structural results, group standings |
| `scoring.ts` | match/phase/group breakdowns |
| `members.ts` | promote, approve, kick, ban |
| `profile.ts` | getUserProfile, updateUserProfile, getUserEmailPreferences |
| `admin.ts` | feedback, email settings |
| `corporate.ts` | createCorporatePool, addEmployees, sendInvitations |

### 5.6 Styling

- **CSS custom properties** in `globals.css` (no Tailwind, no CSS-in-JS)
- Light theme only (`color-scheme: light`)
- Utility CSS classes (`.card`, `.badge`, `.button`)
- Mobile-first responsive design
- `experimental.inlineCss: true` in Next.js config (eliminates render-blocking CSS)

### 5.7 SEO

| Feature | Implementation |
|---------|---------------|
| Metadata | `generateMetadata()` in every public layout/page |
| OG images | Dynamic generation via `opengraph-image.tsx` (ImageResponse) |
| Sitemap | `sitemap.ts` generates XML dynamically |
| Robots | `robots.ts` generates robots.txt |
| JSON-LD | Structured data on landing, FAQ, organization pages |
| hreflang | All pages include es, en, pt, and x-default alternates |
| Regional pages | Locale-specific content pages targeting regional search terms |

---

## 6. Database Architecture

### 6.1 Configuration

- **Production:** Railway managed PostgreSQL 16, auto-backups
- **Local development:** Docker container via `backend/docker-compose.yml`
- **ORM:** Prisma 6.19+ with type-safe client and migration system

### 6.2 Models (27 total)

| Category | Models |
|----------|--------|
| **Users** | `User` |
| **Tournaments** | `TournamentTemplate`, `TournamentTemplateVersion`, `TournamentInstance` |
| **Pools** | `Pool`, `PoolMember`, `PoolInvite` |
| **Predictions** | `Prediction`, `StructuralPrediction`, `GroupStandingsPrediction` |
| **Results** | `PoolMatchResult`, `PoolMatchResultVersion`, `PoolMatchOverride`, `StructuralPhaseResult`, `GroupStandingsResult` |
| **Sync** | `MatchExternalMapping`, `MatchSyncState`, `ResultSyncLog`, `PendingPhaseSync` |
| **Corporate** | `Organization`, `OrganizationInquiry`, `CorporateInvite` |
| **Platform** | `AuditEvent`, `BetaFeedback`, `LegalDocument`, `PlatformSettings`, `DeadlineReminderLog` |

### 6.3 Design Principles

1. **Normalization:** Third Normal Form (3NF)
2. **Foreign keys:** Enforce referential integrity
3. **Indexes:** Primary keys + compound indexes on frequently queried columns
4. **Immutability:** Results and published templates are append-only/versioned
5. **Soft deletes:** Status fields (ACTIVE, BANNED, LEFT, ARCHIVED) instead of hard deletes
6. **Audit trail:** `createdAtUtc`, `updatedAtUtc` on all tables
7. **JSON fields:** Flexible data for `pickJson`, `dataJson`, `pickTypesConfig`
8. **Row-level locking:** `SELECT ... FOR UPDATE` for pool capacity enforcement

### 6.4 Migration Strategy

- **36 migrations** applied (from `20251228053519_init_m0` to `20260404120000_add_mute_reminders`)
- Created with `npx prisma migrate dev --name <name>`
- Production migrations run automatically on deploy:
  ```
  prisma migrate deploy && node dist/server.js
  ```

---

## 7. Authentication & Security

### 7.1 JWT

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 |
| Expiry | 4 hours |
| Payload | `{ userId, platformRole, iat, exp }` |
| Storage | `localStorage` (frontend) |
| Refresh | None (re-authenticate after expiry) |
| Revocation | None (stateless) |

### 7.2 Google OAuth

1. Frontend loads Google Identity Services (`<Script strategy="lazyOnload">`)
2. User clicks "Sign in with Google"
3. Google returns `idToken` to frontend callback
4. Frontend sends `idToken` to `POST /auth/google`
5. Backend verifies token with `google-auth-library`
6. If email matches existing user: link accounts. Otherwise: create new user.
7. Backend returns JWT

### 7.3 Corporate Activation Tokens

- Generated with `crypto.randomBytes(48)` (96-character hex string)
- Stored in `CorporateInvite` model (status: PENDING -> ACTIVATED -> EXPIRED)
- 30-day expiry
- Single-use (status changes to ACTIVATED after use)
- Verification: `GET /auth/check-corporate-invite?token=xxx`
- Activation: `POST /auth/activate-corporate` (creates account + joins pool)

### 7.4 Password Security

- bcrypt with salt rounds = 10
- Strength validation: min 8 chars, 1 uppercase, 1 number, 1 special character

### 7.5 Security Headers (Next.js)

Configured in `next.config.ts`:
- **Content-Security-Policy:** Restricts script, style, image, connect, frame sources
- **Strict-Transport-Security:** HSTS with 2-year max-age, includeSubDomains, preload
- **X-Frame-Options:** DENY
- COOP intentionally omitted (Google Sign-In popup compatibility)

### 7.6 Input Protection

| Layer | Mechanism |
|-------|-----------|
| Request validation | Zod schemas on all endpoint inputs |
| SQL injection | Prisma parameterized queries |
| XSS | React/Next.js automatic JSX escaping |
| Rate limiting | Per-endpoint limits (configurable via env) |
| CORS | Configured origins via `SITE_DOMAIN` env var |

---

## 8. API Design Patterns

### 8.1 RESTful Endpoints

```
AUTH
  POST   /auth/register              Register with email/password
  POST   /auth/login                 Login
  POST   /auth/google                Google OAuth
  POST   /auth/forgot-password       Request password reset
  POST   /auth/reset-password        Reset password
  GET    /auth/verify-email          Email verification
  GET    /auth/check-corporate-invite Check corporate token
  POST   /auth/activate-corporate    Corporate employee activation

USER
  GET    /me/pools                   User's pools
  GET/PUT /me/email-preferences      Email notification preferences
  GET/PATCH /users/me/profile        User profile

POOLS
  POST   /pools                      Create pool
  POST   /pools/join                 Join pool by code
  GET    /pools/:id/overview         Single-call pool overview
  PUT    /pools/:id/picks/:matchId   Upsert match pick
  PUT    /pools/:id/results/:matchId Publish/update result
  POST   /pools/:id/members/:mid/promote  Promote to co-admin
  POST   /pools/:id/members/:mid/kick     Kick member

CATALOG
  GET    /catalog/instances          Available tournament instances
  GET    /pick-presets               Pick configuration presets

CORPORATE
  POST   /corporate/inquiry          Enterprise inquiry form
  POST   /corporate/pools            Create corporate pool
  POST   /corporate/pools/:id/employees      Add employees
  POST   /corporate/pools/:id/send-invitations  Send invitations

ADMIN
  GET    /admin/ping                 Health check
  CRUD   /admin/templates            Tournament template management
  CRUD   /admin/instances            Instance management + advancement
  GET/PUT /admin/settings/email      Platform email toggles

OTHER
  POST   /feedback                   Submit user feedback
  GET    /legal/:type                Legal documents
```

### 8.2 Response Format

**Success:**
```json
{ "id": "uuid", "name": "Pool Name", "createdAtUtc": "2026-01-02T10:00:00Z" }
```

**Error:**
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

**Status codes:** 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict/Business rule violation), 429 (Rate limit exceeded)

### 8.3 Single-Call Optimization

`GET /pools/:poolId/overview` returns everything needed for the pool page in one request:
- Pool details + tournament instance info
- All matches with team info, grouped by phase
- User's picks for all matches
- All published results
- Leaderboard with rankings
- Pick configuration and scoring rules
- Member list and roles

This eliminates 5-6 separate API calls.

---

## 9. Data Flow

### 9.1 Pick Submission

```
User enters score (2-1)
  │
  ▼
PUT /pools/:id/picks/:matchId
  │
  ▼
Route: Zod validation
  │
  ▼
Service: pickService.ts
  ├── Verify membership (ACTIVE status)
  ├── Verify match exists in pool's fixture snapshot
  ├── Check deadline not passed: now < (kickoffUtc - deadlineMinutes)
  │     └── If passed: 409 CONFLICT (DEADLINE_PASSED)
  ├── UPSERT Prediction record (unique per poolId/userId/matchId)
  └── Write AuditEvent
  │
  ▼
200 OK { prediction }
```

### 9.2 Result Publication (SmartSync)

```
Cron job triggers
  │
  ▼
smartSyncJob.ts: Query MatchSyncState records
  │
  ▼
Filter: matches in "live window"
  (kickoff + FIRST_CHECK_MIN to kickoff + FINISH_CHECK_MIN)
  │
  ▼
For each active match:
  ├── Call API-Football: GET /fixtures?id={externalId}
  ├── If match finished:
  │     ├── Extract home/away goals, penalties
  │     ├── Update MatchSyncState -> FINISHED
  │     ├── For each pool containing this match:
  │     │     ├── Create PoolMatchResult + PoolMatchResultVersion
  │     │     ├── Recalculate leaderboard
  │     │     └── Send "result published" email notifications
  │     └── Write ResultSyncLog
  └── If match still live:
        └── Update MatchSyncState, retry next cycle
```

### 9.3 Phase Advancement

```
Admin triggers advancement (or auto-triggered after all phase results)
  │
  ▼
instanceAdvancement.ts
  ├── Verify all matches in current phase have results
  ├── Calculate group standings (if GROUP phase)
  ├── Determine advancing teams based on tournament rules
  ├── Populate placeholder teams in next phase matches
  │     (e.g., "Winner Group A" -> "Mexico")
  ├── Update instance dataJson with resolved teams
  ├── Create PendingPhaseSync for each affected pool
  └── Write AuditEvent (PHASE_ADVANCED)
  │
  ▼
phaseSyncJob.ts (processes PendingPhaseSync records)
  ├── Update each pool's fixtureSnapshot with new teams
  └── Mark PendingPhaseSync as processed
```

### 9.4 Pool Creation

```
User fills form (name, instance, preset, config)
  │
  ▼
POST /pools
  │
  ▼
Route: Zod validation
  │
  ▼
Service:
  BEGIN TRANSACTION
    ├── Verify instance exists and is ACTIVE
    ├── Create Pool (state: DRAFT)
    ├── Create PoolMember (role: HOST)
    ├── Create PoolInvite (auto-generated code)
    └── Create fixtureSnapshot from instance data
  COMMIT
  │
  ▼
Write AuditEvent (POOL_CREATED)
  │
  ▼
201 Created { pool, membership, inviteCode }
```

---

## 10. Deployment Architecture

### 10.1 Production (Railway)

```
┌──────────────────────────────────────────────────────────────────┐
│                      Cloudflare DNS                                │
│  picks4all.com     → CNAME → frontend-next-*.up.railway.app      │
│  api.picks4all.com → CNAME → backend-*.up.railway.app            │
│  Email Routing: 16 addresses + catch-all → team inbox             │
└──────────┬──────────────────────────┬────────────────────────────┘
           │                          │
┌──────────▼─────────────┐  ┌────────▼──────────────────┐
│  Railway Service:       │  │  Railway Service:          │
│  frontend-next          │  │  backend                   │
│                         │  │                            │
│  Build:                 │  │  Build:                    │
│    npm install          │  │    npm install             │
│    next build           │  │    prisma generate && tsc  │
│                         │  │                            │
│  Start:                 │  │  Start:                    │
│    node .next/          │  │    prisma migrate deploy   │
│      standalone/        │  │    && node dist/server.js  │
│      server.js          │  │                            │
│                         │  │  Cron jobs start on boot   │
└─────────────────────────┘  └────────┬─────────────────┘
                                      │
                             ┌────────▼─────────────────┐
                             │  Railway PostgreSQL        │
                             │  PostgreSQL 16             │
                             │  Managed, auto-backups     │
                             └───────────────────────────┘
```

**Git-based deploys:** Both services auto-deploy on push to `main`.

**Backend deployment (`railway.toml`):**
```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install && npm run build"

[deploy]
startCommand = "cd backend && npm run start"
```

**Frontend deployment:** Separate Railway service:
- Build: `cd frontend-next && npm install && npm run build`
- Start: `cd frontend-next && node .next/standalone/server.js`
- `output: "standalone"` in `next.config.ts`

### 10.2 Local Development

**Prerequisites:** Node.js 22+, Docker Desktop, npm

**Backend:**
```bash
cd backend
docker compose up -d              # Start local PostgreSQL
npm install
npx prisma migrate dev            # Run migrations
npm run seed:test-accounts        # Seed test data
npm run dev                       # ts-node-dev on port 3000
```

**Frontend:**
```bash
cd frontend-next
npm install
npm run dev                       # Next.js dev server
```

---

## 11. Branding System

### 11.1 Dual Brand Files

Brand identity is defined in two mirrored files that must be kept in sync:

| File | Purpose |
|------|---------|
| `backend/src/lib/brand.ts` | Email templates, notifications |
| `frontend-next/src/lib/brand.ts` | Theme, images, OG generation |

Both export a `BRAND` object with: `name`, `domain`, `primary`, `primaryLight`, `primaryDark`, `secondary`, `accent`, `gradient`, `gradientAlt`, `text`, `textMuted`, `background`, `card`.

### 11.2 Runtime Override (Backend Only)

The backend supports runtime brand overrides via the `BRAND_COLORS_JSON` environment variable:
```json
{"primary": "#ff0000", "gradient": "linear-gradient(...)"}
```
This merges with defaults without requiring a redeploy.

### 11.3 Related Configuration

| File | Purpose |
|------|---------|
| `frontend-next/src/lib/siteConfig.ts` | `SITE_URL`, `SITE_NAME`, `EMAIL_DOMAIN` |
| `frontend-next/src/lib/theme.ts` | CSS theme values derived from brand |

---

## 12. Configuration

### 12.1 Centralized Constants (`backend/src/lib/constants.ts`)

| Category | Constants |
|----------|-----------|
| Time | `MS.SECOND`, `MS.MINUTE`, `MS.HOUR`, `MS.DAY` |
| Token expiry | Email verification (24h), password reset (1h), corporate invite (30d), pool invite (30d) |
| Crypto sizes | Token (32 bytes), pool invite code (6 bytes), username suffix (3 bytes) |
| Match sync | First check (5 min after kickoff), finish check (110 min after kickoff) -- configurable via env |
| Locales | `["es", "en", "pt"]`, default: `"es"` |
| User rules | Username change cooldown (30 days), min age (13), max age (120) |
| Pagination | Default limit (50), max limit (100) |
| Reserved usernames | admin, root, system, quiniela, api, www |
| Placeholder teams | Prefixes that block pick submission: `t_TBD`, `W_`, `RU_`, `L_`, `3rd_` |

### 12.2 Environment Variables

All configurable values are loaded from environment variables. Key categories:

| Category | Variables |
|----------|-----------|
| Domain | `SITE_DOMAIN`, `FRONTEND_URL` |
| Auth | `JWT_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Sports data | `API_FOOTBALL_KEY` |
| Rate limiting | `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`, etc. |
| Match sync | `MATCH_SYNC_FIRST_CHECK_MIN`, `MATCH_SYNC_FINISH_CHECK_MIN` |
| Frontend public | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_DOMAIN` |
| Branding | `BRAND_COLORS_JSON` (runtime override) |

### 12.3 No Hardcoded Values

All configuration comes from:
1. Environment variables (secrets, URLs, feature flags)
2. Centralized constants (`lib/constants.ts`, `lib/brand.ts`, `lib/siteConfig.ts`)
3. Database (platform settings, legal documents, tournament data)

Static mappings (like team flag URLs in `data/teamFlags.ts`) exist only as fallbacks.
