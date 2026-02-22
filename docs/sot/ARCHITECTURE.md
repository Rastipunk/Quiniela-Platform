# Technical Architecture
# Quiniela Platform (Picks4All)

> **Version:** 2.0 (v0.3-beta implementation)
> **Last Updated:** 2026-02-22
> **Status:** Production (Railway)
> **Domain:** picks4all.com | api.picks4all.com

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
11. [Performance & Scalability](#11-performance--scalability)
12. [Future Architecture Evolution](#12-future-architecture-evolution)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
│        Next.js 16 (App Router) + TypeScript + next-intl v4       │
│                                                                  │
│  Rendering: SSR (public/SEO) + CSR (authenticated app pages)     │
│  i18n: ES (default, no prefix) / EN / PT                         │
│  Auth: JWT in localStorage + Google Sign-In                      │
│  Styling: CSS custom properties (no Tailwind, no CSS-in-JS)      │
│  SEO: Metadata API, JSON-LD, dynamic sitemap, OG images          │
│  Analytics: Google Analytics (GA4)                                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ HTTP/JSON (REST)
                           │ Authorization: Bearer <JWT>
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                          BACKEND                                  │
│      Node.js 22+ / Express 5 / TypeScript 5.9 / Prisma 6.19     │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐             │
│  │  Routes      │  │ Middleware   │  │  Libraries   │             │
│  │ /auth        │  │ requireAuth  │  │ jwt.ts       │             │
│  │ /pools       │  │ requireAdmin │  │ password.ts  │             │
│  │ /picks       │  │ rateLimit    │  │ audit.ts     │             │
│  │ /results     │  │              │  │ scoring*.ts  │             │
│  │ /admin       │  │              │  │ email.ts     │             │
│  │ /feedback    │  │              │  │ googleAuth.ts│             │
│  │ /legal       │  │              │  │              │             │
│  └─────────────┘  └─────────────┘  └──────────────┘             │
│                                                                   │
│  ┌─────────────────┐  ┌───────────────────────────────┐          │
│  │  Services        │  │  Jobs (cron)                  │          │
│  │  smartSync/      │  │  smartSyncJob.ts              │          │
│  │  resultSync/     │  │  resultSyncJob.ts (inactive)  │          │
│  │  apiFootball/    │  │                               │          │
│  │  poolStateMachine│  └───────────────────────────────┘          │
│  └─────────────────┘                                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐            │
│  │              Prisma ORM                           │            │
│  │  Query Builder + Type-Safe Client + Migrations    │            │
│  └──────────────────┬───────────────────────────────┘            │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      │ SQL Queries (Parameterized)
                      │
┌─────────────────────▼────────────────────────────────────────────┐
│                     DATABASE                                      │
│           PostgreSQL 16 (Railway managed)                         │
│                                                                   │
│  30+ migrations applied                                           │
│  Tables: User, Pool, PoolMember, Prediction,                     │
│          PoolMatchResult, TournamentTemplate/Version/Instance,    │
│          MatchSyncState, AuditEvent, BetaFeedback, etc.          │
│                                                                   │
│  Features: ACID Transactions, Indexes, Foreign Keys, JSON fields │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Style

**Monorepo + Monolithic Services**

- **Monorepo:** Single repository with `/backend` and `/frontend-next`
- **Backend:** Monolithic Express app with service layer and cron jobs
- **Frontend:** Next.js App Router with SSR for public pages and CSR for authenticated app
- **Database:** Single PostgreSQL instance (Railway managed)

**Benefits:**
- Shared type patterns between frontend and backend
- Atomic commits across frontend + backend
- Simple deployment (two Railway services + one DB)
- SSR for SEO-critical pages, CSR for interactive app pages

**Trade-offs:**
- Tight coupling (backend changes may require frontend updates)
- No shared type package yet (types duplicated where needed)

---

## 2. Technology Stack

### 2.1 Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 22+ | JavaScript execution environment |
| **Framework** | Express | 5.2.1 | HTTP server & routing |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript |
| **ORM** | Prisma | 6.19.1 | Database client & migrations |
| **Database** | PostgreSQL | 16 | Relational data store |
| **Validation** | Zod | 4.2.1 | Runtime schema validation |
| **Authentication** | jsonwebtoken | 9.0.3 | JWT signing & verification |
| **Password** | bcrypt | 6.0.0 | Password hashing (salt rounds = 10) |
| **OAuth** | google-auth-library | 10.5.0 | Google OAuth token verification |
| **Email** | Resend | 6.6.0 | Transactional email delivery |
| **CORS** | cors | 2.8.5 | Cross-origin resource sharing |
| **Rate Limiting** | express-rate-limit | 8.2.1 | Brute-force & abuse protection |
| **Cron** | node-cron | 4.2.1 | Scheduled jobs (smart sync) |
| **Config** | dotenv | 17.2.3 | Environment variable management |
| **Testing** | Vitest | 4.x | Unit & integration tests |

**Dev Dependencies:**
- `ts-node-dev` 2.0.0: Live reload during development

### 2.2 Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 16.1.6 | Full-stack React framework (App Router) |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **UI Library** | React | 19.2.3 | Component library |
| **i18n** | next-intl | 4.8.3 | Internationalization (ES/EN/PT) |
| **Drag & Drop** | @dnd-kit | 6.x / 10.x | Sortable UI for group standings |
| **HTTP Client** | Fetch API | Native | API requests |
| **Styling** | CSS custom properties | - | Light theme, no framework |
| **Linting** | ESLint + eslint-config-next | 9.x | Code quality |

**State Management:**
- Local component state (`useState`, `useEffect`)
- Auth state: `localStorage` + custom event system (`quiniela:auth`)
- Data fetching: On-demand via `fetch` wrapper (`lib/api.ts`)
- No global state library (no Redux, no Zustand)

### 2.3 Infrastructure Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend Hosting** | Railway | Backend service (Node.js) |
| **Frontend Hosting** | Railway | Next.js standalone server |
| **Database** | Railway PostgreSQL | Managed PostgreSQL 16 |
| **DNS** | Cloudflare | DNS management, CNAME to Railway |
| **Email** | Resend | Transactional emails (verification, invites, reminders) |
| **External API** | API-Football | Live match results & fixtures |
| **Analytics** | Google Analytics (GA4) | User analytics |
| **OAuth** | Google Identity Services | Google Sign-In |

**Domains:**
- Frontend: `picks4all.com` (Cloudflare DNS -> Railway CNAME)
- Backend API: `api.picks4all.com` (Cloudflare DNS -> Railway CNAME)

---

## 3. Project Structure

### 3.1 Monorepo Layout

```
quiniela-platform/
├── backend/                  # Node.js + Express backend
│   ├── prisma/               # Schema + migrations (30+)
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
│   ├── guides/               # Operational guides
│   └── sprints/              # Sprint reports
├── .claude/                  # Claude Code settings
├── CLAUDE.md                 # Operational manual
├── CHANGELOG.md              # Change history
├── README.md                 # Project overview
├── railway.toml              # Railway deployment config (backend)
└── .gitignore
```

### 3.2 Backend Directory Structure

```
backend/src/
├── server.ts                          # Express app entry point + cron startup
├── db.ts                              # Prisma client singleton
├── middleware/
│   ├── requireAuth.ts                 # JWT authentication middleware
│   ├── requireAdmin.ts                # Platform admin role check
│   └── rateLimit.ts                   # Rate limiters (api, auth, password, create)
├── lib/
│   ├── jwt.ts                         # JWT sign/verify utilities
│   ├── password.ts                    # bcrypt hash/verify
│   ├── passwordVerification.ts        # Password strength verification
│   ├── googleAuth.ts                  # Google OAuth token verification
│   ├── audit.ts                       # Audit event logger
│   ├── email.ts                       # Resend email client
│   ├── emailTemplates.ts              # HTML email templates
│   ├── scoringPresets.ts              # Scoring preset definitions
│   ├── scoringAdvanced.ts             # Advanced scoring engine
│   ├── scoringBreakdown.ts            # Detailed scoring breakdown
│   ├── pickPresets.ts                 # Pick type preset definitions
│   └── username.ts                    # Username generation/validation
├── routes/
│   ├── auth.ts                        # Register, login, Google OAuth, password reset, email verify
│   ├── me.ts                          # /me/pools, /me/email-preferences
│   ├── pools.ts                       # Pool CRUD, join, overview, settings, members, invites
│   ├── picks.ts                       # Match pick upsert & list
│   ├── structuralPicks.ts             # Structural picks (group standings, knockout winners)
│   ├── results.ts                     # Result publish + leaderboard + breakdown
│   ├── structuralResults.ts           # Structural results (group/knockout)
│   ├── groupStandings.ts              # Granular group standings picks/results
│   ├── catalog.ts                     # /catalog/instances (public tournament catalog)
│   ├── pickPresets.ts                 # /pick-presets (available pick configurations)
│   ├── userProfile.ts                 # /users/me/profile (CRUD)
│   ├── feedback.ts                    # /feedback (beta bug reports)
│   ├── legal.ts                       # /legal (terms, privacy)
│   ├── admin.ts                       # /admin/ping
│   ├── adminTemplates.ts              # Template CRUD
│   ├── adminInstances.ts              # Instance CRUD + advancement
│   └── adminSettings.ts              # Platform-wide settings (email toggles)
├── services/
│   ├── smartSync/                     # Smart Sync: per-match optimized API-Football polling
│   │   ├── index.ts                   # Exports
│   │   └── service.ts                 # Core sync logic
│   ├── resultSync/                    # Legacy result sync (batch mode)
│   │   ├── index.ts
│   │   └── service.ts
│   ├── apiFootball/                   # API-Football client
│   │   ├── index.ts
│   │   ├── client.ts                  # HTTP client with rate limiting
│   │   └── types.ts                   # API response types
│   ├── poolStateMachine.ts            # Pool lifecycle (DRAFT/ACTIVE/COMPLETED/ARCHIVED)
│   ├── instanceAdvancement.ts         # Tournament phase advancement
│   ├── tournamentAdvancement.ts       # Bracket advancement logic
│   ├── structuralScoring.ts           # Scoring for structural picks
│   └── deadlineReminderService.ts     # Email reminders for upcoming deadlines
├── jobs/
│   ├── smartSyncJob.ts                # Cron: Smart Sync scheduler
│   └── resultSyncJob.ts              # Cron: Legacy batch sync (inactive)
├── validation/
│   └── pickConfig.ts                  # Zod schemas for pick configuration
├── schemas/
│   └── templateData.ts               # Zod schema for tournament template data
├── scripts/
│   ├── seedAdmin.ts                   # Create admin user
│   ├── seedTestAccounts.ts            # Create test accounts
│   ├── seedWc2026Sandbox.ts           # Seed WC2026 tournament data
│   ├── seedUcl2025.ts                 # Seed UCL 2025-26 data
│   ├── seedLegalDocuments.ts          # Seed terms/privacy documents
│   ├── initSmartSyncStates.ts         # Initialize MatchSyncState records
│   ├── fetchUclData.ts               # Fetch UCL data from API-Football
│   └── ...                            # Various utility/test scripts
├── types/
│   ├── express.d.ts                   # Extend Express.Request with auth
│   └── pickConfig.ts                  # Pick configuration types
└── wc2026Sandbox.ts                   # WC2026 data builder
```

### 3.3 Frontend Directory Structure

```
frontend-next/src/
├── app/
│   ├── layout.tsx                     # Root layout (minimal, no html/body)
│   ├── robots.ts                      # Dynamic robots.txt generation
│   ├── sitemap.ts                     # Dynamic sitemap.xml generation
│   ├── manifest.ts                    # PWA manifest
│   ├── opengraph-image.tsx            # Dynamic OG image generation (ImageResponse)
│   ├── apple-icon.tsx                 # Apple touch icon generation
│   ├── icon.tsx                       # Favicon generation
│   ├── pwa-icon-192/route.tsx         # PWA icon 192px
│   ├── pwa-icon-512/route.tsx         # PWA icon 512px
│   └── [locale]/                      # Locale segment (all pages nested here)
│       ├── layout.tsx                 # Locale layout: <html lang>, NextIntlClientProvider, GA4, GIS
│       ├── page.tsx                   # Landing page (SSR)
│       ├── not-found.tsx              # 404 page
│       ├── login/                     # Login page
│       │   ├── page.tsx
│       │   └── LoginContent.tsx       # Client component
│       ├── forgot-password/           # Forgot password flow
│       ├── reset-password/            # Reset password flow
│       ├── verify-email/              # Email verification
│       ├── faq/                       # FAQ page (SSR + JSON-LD)
│       ├── como-funciona/             # "How it works" (SSR)
│       ├── que-es-una-quiniela/       # "What is a pool" (SSR)
│       ├── terminos/                  # Terms of service
│       ├── privacidad/                # Privacy policy
│       ├── polla-futbolera/           # Regional SEO page (ES only)
│       ├── prode-deportivo/           # Regional SEO page (ES only)
│       ├── penca-futbol/              # Regional SEO page (ES only)
│       ├── porra-deportiva/           # Regional SEO page (ES only)
│       ├── football-pool/             # Regional SEO page (EN only)
│       └── (authenticated)/           # Route group: AuthGuard wrapper
│           ├── layout.tsx             # AuthGuard + NavBar + Footer
│           ├── dashboard/page.tsx     # User dashboard (my pools)
│           ├── pools/[poolId]/page.tsx # Pool detail page
│           ├── profile/page.tsx       # User profile
│           └── admin/                 # Platform admin pages
│               ├── feedback/page.tsx  # Beta feedback viewer
│               └── settings/email/page.tsx # Email settings
├── i18n/
│   ├── routing.ts                     # next-intl routing config (locales, pathnames)
│   ├── request.ts                     # next-intl server config (message loading)
│   └── navigation.ts                 # Typed navigation helpers (Link, redirect)
├── messages/                          # Translation JSON files
│   ├── es/                            # Spanish (15+ namespaces)
│   │   ├── common.json
│   │   ├── auth.json
│   │   ├── dashboard.json
│   │   ├── pool.json
│   │   ├── profile.json
│   │   ├── seo.json
│   │   ├── faq.json
│   │   ├── howItWorks.json
│   │   ├── whatIsQuiniela.json
│   │   ├── legal.json
│   │   ├── polla.json, prode.json, penca.json, porra.json
│   │   └── footballPool.json
│   ├── en/                            # English (same namespaces)
│   └── pt/                            # Portuguese (same namespaces)
├── components/
│   ├── AuthGuard.tsx                  # Client-side auth gate (redirect if no token)
│   ├── AuthSlidePanel.tsx             # Slide-in login/register panel
│   ├── NavBar.tsx                     # Authenticated app navigation
│   ├── PublicNavbar.tsx               # Public pages navigation
│   ├── Footer.tsx                     # Site footer
│   ├── LandingContent.tsx             # Landing page content (client component)
│   ├── TeamFlag.tsx                   # Team flag/logo display
│   ├── KnockoutMatchCard.tsx          # Knockout bracket match card
│   ├── GroupStandingsCard.tsx         # Draggable group standings
│   ├── StructuralPicksManager.tsx     # Structural picks UI
│   ├── PoolConfigWizard.tsx           # Pool creation wizard
│   ├── PhaseConfigStep.tsx            # Phase configuration in wizard
│   ├── PickRulesDisplay.tsx           # Pick rules explanation
│   ├── PlayerSummary.tsx              # Player detail view
│   ├── MobileLeaderboard.tsx          # Mobile-optimized leaderboard
│   ├── ScoringBreakdownModal.tsx      # Scoring detail modal
│   ├── NotificationBadge.tsx          # Badge for notifications
│   ├── NotificationBanner.tsx         # Banner notifications
│   ├── BetaFeedbackBar.tsx            # Beta feedback strip
│   ├── FeedbackModal.tsx              # Bug/suggestion feedback form
│   ├── EmailVerificationBanner.tsx    # Email verification reminder
│   ├── EmailPreferencesSection.tsx    # Email notification settings
│   ├── LanguageSelector.tsx           # Language switcher (ES/EN/PT)
│   ├── Breadcrumbs.tsx                # Breadcrumb navigation
│   ├── BrandLogo.tsx                  # Picks4All logo
│   ├── RegisterButton.tsx             # CTA registration button
│   ├── PublicPageWrapper.tsx          # Wrapper for public content pages
│   ├── RegionalArticlePage.tsx        # Template for regional SEO pages
│   ├── FAQAccordion.tsx               # Expandable FAQ items
│   └── JsonLd.tsx                     # JSON-LD structured data helper
├── hooks/
│   ├── useAuth.ts                     # Auth state hook (token, isAuthenticated)
│   ├── useIsMobile.ts                 # Responsive breakpoint hook
│   └── usePoolNotifications.ts        # Pool notification polling hook
├── contexts/
│   └── AuthPanelContext.tsx            # Context for auth slide panel state
├── lib/
│   ├── api.ts                         # API client (fetch wrapper, 70+ methods)
│   ├── auth.ts                        # Token storage + auth event system
│   └── timezone.ts                    # Timezone detection utility
├── data/
│   └── teamFlags.ts                   # Team code -> flag URL mapping
├── types/
│   └── pickConfig.ts                  # Pick configuration types
├── proxy.ts                           # Next.js middleware: www redirect + i18n routing
└── globals.css                        # Global styles (CSS custom properties)
```

---

## 4. Backend Architecture

### 4.1 Express Application Structure

**server.ts (Entry Point):**

```typescript
import "dotenv/config";
import express from "express";
import cors from "cors";
import { apiLimiter, authLimiter, passwordResetLimiter } from "./middleware/rateLimit";
import { startSmartSyncJob } from "./jobs/smartSyncJob";
// ... router imports

const app = express();

// Trust proxy (required for Railway — reverse proxy environment)
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(apiLimiter); // Global rate limiting

// Health check with version info
app.get("/health", (_req, res) => {
  res.json({ ok: true, version: BUILD_VERSION, commit: COMMIT_SHA });
});

// Stricter rate limiting for auth endpoints
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", passwordResetLimiter);
app.use("/auth/reset-password", passwordResetLimiter);

// Mount routers
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/admin", adminTemplatesRouter);
app.use("/admin", adminInstancesRouter);
app.use("/admin/settings", adminSettingsRouter);
app.use("/pools", poolsRouter);
app.use("/pools", picksRouter);
app.use("/pools", structuralPicksRouter);
app.use("/pools", resultsRouter);
app.use("/pools", structuralResultsRouter);
app.use("/pools", groupStandingsRouter);
app.use("/me", meRouter);
app.use("/users", userProfileRouter);
app.use("/catalog", catalogRouter);
app.use("/pick-presets", pickPresetsRouter);
app.use("/legal", legalRouter);
app.use("/feedback", feedbackRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startSmartSyncJob(); // Start cron-based match result syncing
});
```

### 4.2 Middleware Architecture

**Rate Limiting:**

| Limiter | Scope | Window | Max Requests |
|---------|-------|--------|-------------|
| `apiLimiter` | All endpoints (except /health) | 1 min | 100 |
| `authLimiter` | Login & register | 15 min | 10 |
| `passwordResetLimiter` | Forgot/reset password | 1 hour | 5 |
| `createResourceLimiter` | Pool/invite creation | 1 hour | 20 |

**Authentication Flow:**

```typescript
// requireAuth: extracts JWT, validates, attaches user to request
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const payload = verifyJWT(token);
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status !== "ACTIVE") {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  req.auth = { userId: user.id, platformRole: user.platformRole };
  next();
}

// requireAdmin: checks platform role after requireAuth
function requireAdmin(req, res, next) {
  if (req.auth.platformRole !== "ADMIN") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  next();
}
```

### 4.3 Service Layer

**Smart Sync System (API-Football Integration):**

The Smart Sync system automatically fetches match results from API-Football, optimized to poll only matches that are likely to have updates:

- `MatchSyncState`: tracks per-match sync status (PENDING, LIVE, FINISHED, etc.)
- Cron job runs periodically, queries only matches in active windows
- Respects API-Football rate limits (100 req/day on free tier)
- Auto-publishes results to all pools containing that match

**Pool State Machine:**

Pools follow a lifecycle: `DRAFT` -> `ACTIVE` -> `COMPLETED` -> `ARCHIVED`

**Structural Scoring:**

Beyond simple match picks, the scoring system supports:
- Group standings predictions (drag-and-drop order)
- Knockout winner predictions
- Advanced scoring rules (exact score, correct outcome, goal difference, etc.)

### 4.4 Validation Layer (Zod)

All request bodies are validated with Zod schemas before processing:

```typescript
const pickSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SCORE"),
    homeGoals: z.number().int().min(0).max(99),
    awayGoals: z.number().int().min(0).max(99),
  }),
  z.object({
    type: z.literal("OUTCOME"),
    outcome: z.enum(["HOME", "DRAW", "AWAY"]),
  }),
]);
```

### 4.5 Email System (Resend)

Transactional emails powered by Resend:
- Welcome email on registration
- Email verification
- Password reset
- Pool invitation
- Deadline reminders
- Result published notifications

Platform admin can toggle email types globally via `/admin/settings/email`.
Users can manage their own email preferences via `/me/email-preferences`.

---

## 5. Frontend Architecture

### 5.1 Next.js App Router Structure

The frontend uses **Next.js 16 with the App Router**. All pages are nested under `[locale]/` for i18n support.

**Rendering Strategy:**
- **SSR (Server-Side Rendering):** Public pages (landing, FAQ, how-it-works, regional SEO pages, legal pages). These are pre-rendered for SEO.
- **CSR (Client-Side Rendering):** Authenticated app pages (dashboard, pool page, profile, admin). These use `"use client"` directives and fetch data client-side.

**Locale Layout (`app/[locale]/layout.tsx`):**

```typescript
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} style={{ colorScheme: "light only" }}>
      <head>
        <link rel="preconnect" href="https://accounts.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <JsonLd data={...} />
          <BetaFeedbackBar />
          {children}
        </NextIntlClientProvider>
        <Script src="https://www.googletagmanager.com/gtag/js?id=..." strategy="lazyOnload" />
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
      </body>
    </html>
  );
}
```

### 5.2 Internationalization (next-intl v4)

**Configuration (`i18n/routing.ts`):**

```typescript
export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed", // ES has no prefix, EN/PT have /en/, /pt/
  pathnames: {
    "/": "/",
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

**URL Patterns:**
- `picks4all.com/` -- Spanish (default, no prefix)
- `picks4all.com/en/` -- English
- `picks4all.com/pt/` -- Portuguese
- `picks4all.com/en/how-it-works` -- Localized path

**Message Organization:**
- JSON files split by namespace: `auth.json`, `dashboard.json`, `pool.json`, `seo.json`, etc.
- Each locale has the same set of namespace files
- Currently 15+ namespaces per locale

### 5.3 Middleware (`proxy.ts`)

Next.js middleware handles two concerns:

1. **www redirect:** `www.picks4all.com` -> `picks4all.com` (301)
2. **i18n routing:** Locale detection, cookie persistence, and redirect via `next-intl/middleware`

```typescript
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (host.startsWith("www.")) {
    const nonWwwHost = host.replace("www.", "");
    return NextResponse.redirect(new URL(..., `https://${nonWwwHost}`), 301);
  }

  return handleI18nRouting(request);
}
```

### 5.4 Authentication Flow (Frontend)

**Auth is fully client-side** (no server-side sessions):

1. User logs in or registers -> backend returns JWT
2. `setToken(jwt)` saves to `localStorage` and fires `quiniela:auth` event
3. `useAuth()` hook listens for auth changes, exposes `{ token, isAuthenticated, isLoading }`
4. `AuthGuard` component wraps authenticated route group -> redirects to `/` if no token
5. API client (`lib/api.ts`) auto-injects `Authorization: Bearer <token>` header
6. On 401 response: `clearToken()` fires event -> `useAuth` updates -> `AuthGuard` redirects

**Google Sign-In:**
- Google Identity Services (GIS) library loaded via `<Script strategy="lazyOnload">`
- On successful Google sign-in, frontend sends `idToken` to `POST /auth/google`
- Backend verifies token with `google-auth-library`, creates or links user

### 5.5 API Client (`lib/api.ts`)

Centralized fetch wrapper with 70+ typed methods:

```typescript
function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    markSessionExpired();
    clearToken();
  }

  if (!res.ok) throw new Error(...);
  return data as T;
}
```

**API method categories:**
- Auth: `login`, `register`, `loginWithGoogle`, `forgotPassword`, `resetPassword`, `verifyEmail`
- Dashboard: `getMePools`, `listInstances`, `createPool`, `joinPool`
- Pool: `getPoolOverview`, `upsertPick`, `upsertResult`, `createInvite`
- Structural: `upsertStructuralPick`, `publishStructuralResult`, `saveGroupStandingsPick`
- Scoring: `getMatchBreakdown`, `getPhaseBreakdown`, `getGroupBreakdown`
- Members: `promoteMemberToCoAdmin`, `approveMember`, `kickMember`, `banMember`
- Profile: `getUserProfile`, `updateUserProfile`, `getUserEmailPreferences`
- Admin: `getAdminFeedback`, `getAdminEmailSettings`, `updateAdminEmailSettings`

### 5.6 Styling Architecture

**CSS Custom Properties (no Tailwind, no CSS-in-JS):**

```css
:root {
  color-scheme: light;
  --bg: #f4f5f7;
  --surface: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --primary: #111827;
  --accent: #2563eb;
}
```

- Light theme only
- Utility CSS classes (`.card`, `.badge`, `.button`)
- Responsive design with mobile-first approach
- `globals.css` as single stylesheet
- `experimental.inlineCss: true` in Next.js config to eliminate render-blocking CSS

### 5.7 SEO Architecture

- **Metadata API:** `generateMetadata()` in layouts/pages for `<title>`, `<meta>`, OG tags
- **Dynamic OG images:** `opengraph-image.tsx` using `ImageResponse`
- **Sitemap:** `sitemap.ts` generates XML sitemap dynamically
- **Robots:** `robots.ts` generates robots.txt
- **JSON-LD:** Structured data on landing, FAQ, and organization pages
- **Alternate hreflang:** All pages include `es`, `en`, `pt`, and `x-default` alternates
- **Regional SEO pages:** Locale-specific content pages targeting regional terms (polla, prode, penca, porra, football pool)

---

## 6. Database Architecture

### 6.1 PostgreSQL Configuration

**Production:** Railway managed PostgreSQL 16
**Local Development:** Docker container via `backend/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16
    container_name: quiniela-db
    environment:
      POSTGRES_USER: quiniela
      POSTGRES_PASSWORD: password
      POSTGRES_DB: quiniela
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

### 6.2 Schema Design Principles

**See [DATA_MODEL.md](./DATA_MODEL.md) for full schema.**

Key principles:
1. **Normalization:** 3NF (Third Normal Form)
2. **Foreign Keys:** Enforce referential integrity
3. **Indexes:** Primary keys + frequently queried columns
4. **Immutability:** Critical entities (results, published templates) are append-only/versioned
5. **Soft Deletes:** Status fields instead of hard deletes
6. **Audit Trail:** `createdAtUtc`, `updatedAtUtc` on all tables
7. **JSON Fields:** For flexible data (`pickJson`, `dataJson`, `pickTypesConfig`)
8. **30+ migrations** applied, managed by Prisma

### 6.3 Migration Strategy

```bash
# Create migration (dev)
npx prisma migrate dev --name add_feature

# Deploy migrations (production — runs automatically on Railway start)
npx prisma migrate deploy

# Reset (dev only, destructive)
npx prisma migrate reset
```

Production migrations run automatically as part of the `npm run start` script:
```json
"start": "prisma migrate deploy && node dist/server.js"
```

---

## 7. Authentication & Security

### 7.1 JWT Authentication

**Token payload:**
```json
{
  "userId": "uuid",
  "platformRole": "PLAYER",
  "iat": 1672531200,
  "exp": 1672545600
}
```

- Algorithm: HMAC-SHA256
- Expiry: 4 hours
- No refresh tokens (user re-authenticates after 4h)
- No token revocation mechanism

### 7.2 Google OAuth

- Uses Google Identity Services (GIS) on the frontend
- Backend verifies `idToken` using `google-auth-library`
- Auto-creates account on first Google sign-in
- Links to existing account if email matches

### 7.3 Password Security

- bcrypt with salt rounds = 10
- Password strength validation on registration
- Forgot/reset password flow via Resend email with time-limited tokens

### 7.4 Security Headers (Next.js)

Configured in `next.config.ts`:

- **Content-Security-Policy:** Restricts script, style, image, connect, and frame sources
- **Strict-Transport-Security:** HSTS with 2-year max-age, includeSubDomains, preload
- **X-Frame-Options:** DENY (prevents clickjacking)
- COOP intentionally omitted to allow Google Sign-In popup flow

### 7.5 Input Validation & Protection

- **Zod:** Runtime validation on all request bodies
- **Prisma:** Parameterized queries (SQL injection impossible)
- **React/Next.js:** Automatic XSS escaping in JSX
- **Rate Limiting:** Per-endpoint rate limits (see section 4.2)
- **CORS:** Configured on backend

---

## 8. API Design Patterns

### 8.1 RESTful Conventions

```
/auth/login             POST    Login
/auth/register          POST    Register
/auth/google            POST    Google OAuth
/auth/forgot-password   POST    Password reset request
/auth/reset-password    POST    Password reset
/auth/verify-email      GET     Email verification

/me/pools               GET     User's pools
/me/email-preferences   GET/PUT Email notification preferences

/pools                  POST    Create pool
/pools/join             POST    Join pool by code
/pools/:id/overview     GET     Pool overview (single-call)
/pools/:id/picks/:mid   PUT     Upsert match pick
/pools/:id/results/:mid PUT     Publish/update result
/pools/:id/members/:mid/promote POST  Promote to co-admin
/pools/:id/members/:mid/kick    POST  Kick member

/catalog/instances      GET     Available tournament instances
/users/me/profile       GET/PATCH  User profile
/feedback               POST    Submit beta feedback
/legal/:type            GET     Legal documents
```

### 8.2 Response Format Standards

**Success:**
```json
{ "id": "uuid", "name": "Pool Name", "createdAtUtc": "2026-01-02T10:00:00Z" }
```

**Error:**
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": { /* optional validation details */ }
}
```

**Status Codes:**
- `200 OK`: Successful GET/PUT/PATCH
- `201 Created`: Successful POST (resource created)
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Auth required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Business rule violation
- `429 Too Many Requests`: Rate limit exceeded

### 8.3 Single-Call Optimization

`GET /pools/:poolId/overview` returns everything needed for the pool page in one request:
- Pool details + tournament instance info
- All matches with team info, grouped by phase
- User's picks for all matches
- All published results
- Leaderboard with rankings
- Pick configuration and scoring rules

This eliminates 5-6 separate API calls and provides a fast, single-load experience.

---

## 9. Data Flow

### 9.1 Create Pool Flow

```
User fills form          POST /pools                    Backend
(name, instance,  ─────> { name, instanceId,     ─────> Validate (Zod)
 preset, picks)           scoringPresetKey,              Check instance exists
                          pickTypesConfig }              Check instance ACTIVE

                                                         BEGIN TRANSACTION
                                                           Create Pool
                                                           Create PoolMember (HOST)
                                                           Create PoolInvite
                                                         COMMIT
                                                         Write AuditEvent

                         <── 201 Created ───────────────
                         { pool, membership, inviteCode }
```

### 9.2 Submit Pick Flow

```
User enters score        PUT /pools/:id/picks/:matchId    Backend
(2-1)             ─────> { pick: { type: "SCORE",   ─────> Validate (Zod)
                           homeGoals: 2,                    Check membership
                           awayGoals: 1 } }                 Check match exists
                                                            Check deadline not passed

                                                            UPSERT Prediction
                                                            Write AuditEvent

                         <── 200 OK ────────────────────
                         { prediction }
```

### 9.3 Smart Sync Flow (Automatic Results)

```
Cron (every N minutes) ─────> Check MatchSyncState records
                              Filter: matches in "live window"

                              For each active match:
                                Call API-Football /fixtures?id=...
                                If match finished:
                                  Auto-publish result to all pools
                                  Update MatchSyncState -> FINISHED
                                  Trigger leaderboard recalc
```

---

## 10. Deployment Architecture

### 10.1 Production (Railway)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare DNS                                │
│  picks4all.com      → CNAME → frontend-next-*.up.railway.app   │
│  api.picks4all.com  → CNAME → backend-*.up.railway.app         │
└──────────┬───────────────────────┬──────────────────────────────┘
           │                       │
┌──────────▼──────────┐  ┌────────▼─────────────┐
│  Railway Service:   │  │  Railway Service:     │
│  frontend-next      │  │  backend              │
│                     │  │                       │
│  Next.js 16         │  │  Node.js + Express    │
│  standalone output  │  │  + Prisma + cron jobs │
│  Port: $PORT        │  │  Port: $PORT          │
└─────────────────────┘  └────────┬──────────────┘
                                  │
                         ┌────────▼──────────────┐
                         │  Railway PostgreSQL    │
                         │  PostgreSQL 16         │
                         │  Managed instance      │
                         │  Auto backups          │
                         └───────────────────────┘
```

**Backend Deployment (`railway.toml`):**
```toml
[build]
builder = "nixpacks"
buildCommand = "cd backend && npm install && npm run build"

[deploy]
startCommand = "cd backend && npm run start"
```

The `npm run start` script runs migrations before starting the server:
```
prisma migrate deploy && node dist/server.js
```

**Frontend Deployment:**
Configured as a separate Railway service with:
- Build: `cd frontend-next && npm install && npm run build`
- Start: `cd frontend-next && node .next/standalone/server.js`
- `output: "standalone"` in `next.config.ts` for optimized Railway deployment

**Git-based deploys:** Both services auto-deploy on push to `main`.

### 10.2 Local Development

**Prerequisites:**
- Node.js 22+
- Docker Desktop (for local PostgreSQL)
- npm

**Start Backend:**

```bash
cd backend
docker compose up -d              # Start local PostgreSQL
npm install
npx prisma migrate dev            # Run migrations
npm run seed:test-accounts        # Seed test users
npm run seed:wc2026-sandbox       # Seed WC2026 tournament
npm run dev                       # Start dev server (ts-node-dev, port 3000)
```

**Start Frontend:**

```bash
cd frontend-next
npm install
npm run dev                       # Start Next.js dev server (port 3000 or next available)
```

**Access:**
- Frontend: `http://localhost:3000` (or next available port)
- Backend: `http://localhost:3000` (configure different port if running both)
- Database: `localhost:5432`

---

## 11. Performance & Scalability

### 11.1 Current Performance Characteristics

**Backend:**
- API response time: < 100ms (p50), < 500ms (p95)
- Database queries: avg 2-3 per request
- Leaderboard calculation: < 1s for 100 players, 72 matches
- Rate limiting prevents abuse

**Frontend (Next.js):**
- SSR for public pages: fast FCP, good for SEO
- CSS inlining: eliminates render-blocking stylesheets
- `lazyOnload` for GA4 and Google Identity Services
- Preconnect hints for external domains
- Standalone output: minimal deployment size

### 11.2 Bottlenecks & Future Optimizations

| Bottleneck | Current State | Future Solution |
|------------|---------------|-----------------|
| Leaderboard calc | In-memory O(n*m) | Materialized view or pre-computed cache |
| Single-call endpoint | Large payload (~50KB for 72 matches) | Pagination or lazy-load by phase |
| No caching | Every request hits DB | Redis cache (invalidate on updates) |
| No CDN for API | Direct to Railway | Cloudflare Workers or API caching |

### 11.3 Scalability Strategy

**Current (v0.3):**
- Single Railway instance per service
- Managed PostgreSQL
- Stateless API (JWT = no session store)

**Near-term:**
- Add Redis for caching (leaderboard, pool overview)
- Connection pooling (PgBouncer)
- Database read replicas for leaderboard queries

**Long-term:**
- Multiple backend instances behind load balancer
- Background job queue (separate from API process)
- WebSocket support for real-time leaderboard updates

---

## 12. Future Architecture Evolution

### 12.1 Near-Term

- [ ] Redis caching layer (pool overview, leaderboard)
- [ ] Background job queue (decouple sync jobs from API process)
- [ ] Error tracking (Sentry integration)
- [ ] Database connection pooling (PgBouncer)
- [ ] Automated database backups with point-in-time recovery

### 12.2 Mid-Term

- [ ] Read replicas for leaderboard queries
- [ ] WebSockets for real-time leaderboard updates
- [ ] Shared TypeScript types package between frontend/backend
- [ ] Component library extraction
- [ ] API versioning (v1, v2)

### 12.3 Long-Term

- [ ] Microservices split (Auth, Pools, Leaderboard, Sync)
- [ ] Event-driven architecture (message queue for result updates)
- [ ] Multi-region deployment
- [ ] Mobile apps (React Native)
- [ ] More sports beyond football

---

## Appendix A: Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/quiniela"

# JWT
JWT_SECRET="your-secret-key-here-min-32-chars"

# Server
PORT=3000

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"

# Email (Resend)
RESEND_API_KEY="re_your-resend-api-key"
RESEND_FROM_EMAIL="Picks4All <noreply@picks4all.com>"

# API-Football
API_FOOTBALL_KEY="your-api-football-key"

# Frontend URL (for email links)
FRONTEND_URL="https://picks4all.com"

# Railway (auto-injected)
RAILWAY_GIT_COMMIT_SHA="..."

# Test Accounts (for seeding only)
TEST_ADMIN_EMAIL="admin@test.com"
TEST_ADMIN_PASSWORD="Admin123!"
TEST_HOST_EMAIL="host@test.com"
TEST_HOST_PASSWORD="Host123!"
TEST_PLAYER_EMAIL="player@test.com"
TEST_PLAYER_PASSWORD="Player123!"
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## Appendix B: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [API_SPEC.md](./API_SPEC.md) - API documentation
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Business logic
- [DECISION_LOG.md](./DECISION_LOG.md) - Architectural decisions
- [GLOSSARY.md](./GLOSSARY.md) - Term definitions

---

**END OF DOCUMENT**
