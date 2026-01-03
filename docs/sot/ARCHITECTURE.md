# Technical Architecture
# Quiniela Platform

> **Version:** 1.0 (v0.1-alpha implementation)
> **Last Updated:** 2026-01-02
> **Status:** Production-Ready Foundation
> **Environment:** Development (Windows), Production TBD

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
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  React 19.2 + Vite 7.2 + TypeScript 5.9 + React Router 7   │
│                                                              │
│  Pages: Login, Dashboard, Pool, Admin                       │
│  State: Local + URL params (no global state lib)            │
│  API Client: Fetch-based with JWT auth                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/JSON (REST)
                       │ Authorization: Bearer <JWT>
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                         BACKEND                              │
│    Node.js + Express 5.2 + TypeScript 5.9 + Prisma 6.19    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐           │
│  │  Routes    │  │ Middleware │  │  Libraries  │           │
│  │ /auth      │  │ requireAuth│  │  jwt.ts     │           │
│  │ /pools     │  │ requireAdmin│  │  password.ts│           │
│  │ /picks     │  │ errorHandler│  │  audit.ts   │           │
│  │ /results   │  │            │  │  scoring.ts │           │
│  │ /admin     │  │            │  │             │           │
│  └────────────┘  └────────────┘  └─────────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │           Prisma ORM                          │           │
│  │  Query Builder + Type-Safe Client             │           │
│  └───────────────────┬──────────────────────────┘           │
└────────────────────────┼───────────────────────────────────┘
                         │
                         │ SQL Queries (Parameterized)
                         │
┌────────────────────────▼───────────────────────────────────┐
│                    DATABASE                                 │
│         PostgreSQL 14+ (Docker Container)                   │
│                                                             │
│  Tables: User, Pool, PoolMember, Prediction,               │
│          PoolMatchResult, TournamentTemplate, etc.         │
│                                                             │
│  Features: ACID Transactions, Indexes, Foreign Keys        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Style

**Monorepo + Monolithic Services**

- **Monorepo:** Single repository with `/backend` and `/frontend`
- **Backend:** Monolithic Express app (future: could split into microservices)
- **Frontend:** Single-page app (SPA) with client-side routing
- **Database:** Single PostgreSQL instance (future: read replicas)

**Benefits:**
- ✅ Simple deployment (2 services: API + SPA)
- ✅ Shared type definitions possible (future)
- ✅ Atomic commits across frontend + backend
- ✅ Easy local development (docker-compose for DB)

**Trade-offs:**
- ⚠️ Tight coupling (backend changes may require frontend updates)
- ⚠️ Scaling requires vertical scaling (for now)
- ⚠️ Deployment of one service restarts entire backend

---

## 2. Technology Stack

### 2.1 Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 18+ LTS | JavaScript execution environment |
| **Framework** | Express | 5.2.1 | HTTP server & routing |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript |
| **ORM** | Prisma | 6.19.1 | Database client & migrations |
| **Database** | PostgreSQL | 14+ | Relational data store |
| **Validation** | Zod | 4.2.1 | Runtime schema validation |
| **Authentication** | jsonwebtoken | 9.0.3 | JWT signing & verification |
| **Password** | bcrypt | 6.0.0 | Password hashing (salt rounds = 10) |
| **CORS** | cors | 2.8.5 | Cross-origin resource sharing |
| **Config** | dotenv | 17.2.3 | Environment variable management |

**Dev Dependencies:**
- `ts-node-dev` 2.0.0: Live reload during development
- `@types/*`: TypeScript definitions for libraries

**Package Manager:** npm (default Node.js package manager)

---

### 2.2 Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | React | 19.2.0 | UI component library |
| **Build Tool** | Vite | 7.2.4 | Fast dev server & bundler |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript |
| **Routing** | React Router DOM | 7.11.0 | Client-side routing |
| **HTTP Client** | Fetch API | Native | API requests |
| **Styling** | CSS (custom) | - | Light theme, CSS variables |
| **Linting** | ESLint | 9.39.1 | Code quality |

**No Global State Library:**
- State management: Local component state (`useState`)
- Auth state: LocalStorage + custom event system
- Data fetching: On-demand (no caching layer yet)

**Future Considerations:**
- React Query / TanStack Query (for caching)
- Zustand / Jotai (lightweight state management)
- Tailwind CSS (utility-first styling)

---

### 2.3 Infrastructure Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database Host** | Docker (PostgreSQL image) | Local development DB |
| **Reverse Proxy** | TBD (Nginx/Caddy) | Production HTTPS termination |
| **Process Manager** | TBD (PM2/systemd) | Production process supervision |
| **Hosting** | TBD (VPS/Cloud) | Application hosting |
| **CDN** | TBD (Cloudflare/Vercel) | Static asset delivery |
| **Monitoring** | TBD (Sentry/DataDog) | Error tracking & performance |

**Current Deployment:** Manual (npm scripts)
**Future:** CI/CD pipeline (GitHub Actions + Docker)

---

## 3. Project Structure

### 3.1 Monorepo Layout

```
quiniela-platform/
├── backend/              # Node.js + Express backend
│   ├── prisma/           # Database schema & migrations
│   ├── src/              # TypeScript source code
│   ├── dist/             # Compiled JavaScript (gitignored)
│   ├── .env              # Environment variables (gitignored)
│   ├── .env.example      # Example env vars (committed)
│   ├── package.json      # Node dependencies
│   ├── tsconfig.json     # TypeScript config
│   └── docker-compose.yml# PostgreSQL container
├── frontend/             # React + Vite frontend
│   ├── src/              # TypeScript source code
│   ├── dist/             # Build output (gitignored)
│   ├── public/           # Static assets
│   ├── .env              # Environment variables (gitignored)
│   ├── package.json      # Node dependencies
│   ├── tsconfig.json     # TypeScript config
│   └── vite.config.ts    # Vite configuration
├── docs/                 # Documentation
│   ├── sot/              # Source of Truth docs
│   ├── SPRINT_1.md       # Sprint status
│   ├── BACKLOG.md        # Feature backlog
│   └── ...
├── .gitignore            # Git ignore rules
├── CLAUDE.md             # Operational manual
└── README.md             # Project overview
```

---

### 3.2 Backend Directory Structure

```
backend/src/
├── server.ts                  # Express app entry point
├── db.ts                      # Prisma client singleton
├── middleware/
│   ├── requireAuth.ts         # JWT authentication middleware
│   └── requireAdmin.ts        # Admin role check middleware
├── lib/
│   ├── jwt.ts                 # JWT sign/verify utilities
│   ├── password.ts            # bcrypt hash/verify utilities
│   ├── audit.ts               # Audit event logger
│   ├── scoringPresets.ts      # Scoring preset definitions
│   └── auth.ts                # Legacy token storage helper
├── routes/
│   ├── auth.ts                # POST /auth/register, /auth/login
│   ├── me.ts                  # GET /me/pools
│   ├── pools.ts               # Pool CRUD, join, overview
│   ├── picks.ts               # Pick upsert, list
│   ├── results.ts             # Result publish, leaderboard
│   ├── catalog.ts             # GET /catalog/instances
│   ├── admin.ts               # GET /admin/ping
│   ├── adminTemplates.ts      # Template management
│   └── adminInstances.ts      # Instance management
├── schemas/
│   └── templateData.ts        # Zod schema for tournament data
├── scripts/
│   ├── seedAdmin.ts           # Create admin user
│   ├── seedTestAccounts.ts    # Create test accounts
│   └── seedWc2026Sandbox.ts   # Seed WC2026 data
├── types/
│   └── express.d.ts           # Extend Express.Request with auth
└── wc2026Sandbox.ts           # WC2026 data builder
```

**Key Design Patterns:**
- **Route Handlers:** One file per resource (RESTful)
- **Middleware:** Composable (requireAuth → requireAdmin)
- **Utilities:** Pure functions in `/lib` (no side effects)
- **Schemas:** Centralized validation (Zod schemas)
- **Scripts:** Idempotent seed scripts (safe to re-run)

---

### 3.3 Frontend Directory Structure

```
frontend/src/
├── main.tsx                   # React app entry point
├── App.tsx                    # Router + auth state manager
├── index.css                  # Global styles (light theme)
├── App.css                    # App-specific styles
├── lib/
│   ├── api.ts                 # API client (fetch wrapper)
│   └── auth.ts                # Token storage + auth events
├── pages/
│   ├── LoginPage.tsx          # Login/Register form
│   ├── DashboardPage.tsx      # Pool list + create/join
│   └── PoolPage.tsx           # Pool overview (matches + leaderboard)
└── assets/                    # Static assets (images, icons)
```

**Component Organization:**
- **Pages:** Top-level route components (one per route)
- **Components:** (Future) Reusable UI components
- **Lib:** Shared utilities & API client

**No Component Library:**
- Custom CSS components (`.card`, `.badge`, `.button`)
- Future: Consider Radix UI + Tailwind CSS

---

## 4. Backend Architecture

### 4.1 Express Application Structure

**server.ts (Entry Point):**

```typescript
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
// ... other routers

const app = express();

// Middleware
app.use(cors());                          // Enable CORS
app.use(express.json({ limit: "1mb" })); // Parse JSON bodies

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use("/auth", authRouter);
app.use("/pools", poolsRouter);
app.use("/pools", picksRouter);
app.use("/pools", resultsRouter);
app.use("/me", meRouter);
app.use("/catalog", catalogRouter);
app.use("/admin", adminRouter);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
```

**Design Decisions:**
- ✅ **CORS enabled globally** (no origin restriction in dev, will restrict in prod)
- ✅ **JSON body limit: 1MB** (prevents abuse)
- ✅ **No global error handler yet** (future: centralized error middleware)
- ✅ **Modular routers** (easy to split into microservices later)

---

### 4.2 Middleware Architecture

**Authentication Flow:**

```typescript
// 1. requireAuth middleware extracts & validates JWT
requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const payload = verifyJWT(token);  // Throws if invalid/expired

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status !== "ACTIVE") {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  req.auth = { userId: user.id, platformRole: user.platformRole };
  next();
}

// 2. requireAdmin middleware checks platform role
requireAdmin(req, res, next) {
  if (req.auth.platformRole !== "ADMIN") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  next();
}
```

**Type Safety:**

```typescript
// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        platformRole: "ADMIN" | "HOST" | "PLAYER";
      };
    }
  }
}
```

**Benefits:**
- ✅ TypeScript knows `req.auth` exists after `requireAuth`
- ✅ Composable (chain multiple middlewares)
- ✅ Single responsibility (auth, admin check separate)

---

### 4.3 Database Layer (Prisma)

**db.ts (Singleton Pattern):**

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

**Why Prisma?**
- ✅ **Type-safe queries:** Full TypeScript support
- ✅ **Migration system:** Version-controlled schema changes
- ✅ **Query builder:** No raw SQL (prevents injection)
- ✅ **Relations:** Automatic JOIN generation
- ✅ **Transactions:** Built-in support

**Example Query:**

```typescript
// Type-safe, autocomplete works
const pool = await prisma.pool.findUnique({
  where: { id: poolId },
  include: {
    tournamentInstance: true,
    members: { where: { status: "ACTIVE" } }
  }
});
```

**Transaction Example:**

```typescript
const result = await prisma.$transaction(async (tx) => {
  const header = await tx.poolMatchResult.create({ data: { poolId, matchId } });
  const version = await tx.poolMatchResultVersion.create({ data: { ... } });
  await tx.poolMatchResult.update({ where: { id: header.id }, data: { currentVersionId: version.id } });
  return { header, version };
});
```

---

### 4.4 Validation Layer (Zod)

**Why Zod?**
- ✅ Runtime validation (catches bad requests)
- ✅ TypeScript integration (infer types from schemas)
- ✅ Composable (discriminated unions, refinements)
- ✅ Clear error messages

**Example Schema:**

```typescript
const createPoolSchema = z.object({
  tournamentInstanceId: z.string().uuid(),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  timeZone: z.string().min(3).max(64).optional(),
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
  scoringPresetKey: z.enum(["CLASSIC", "OUTCOME_ONLY", "EXACT_HEAVY"]).optional(),
});

// Usage
const parsed = createPoolSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    error: "VALIDATION_ERROR",
    details: parsed.error.flatten()
  });
}

// TypeScript knows parsed.data has correct types
const { name, description } = parsed.data;
```

**Discriminated Union (Pick Types):**

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

---

### 4.5 Business Logic Layer

**Location:** Inline in route handlers (for now)

**Future:** Extract to service layer (e.g., `services/scoring.ts`)

**Example: Leaderboard Calculation (in results.ts):**

```typescript
// Calculate points per user per match
const userPoints = new Map<string, number>();

for (const member of members) {
  let totalPoints = 0;

  for (const match of matchesWithResults) {
    const pick = predictions.find(p => p.userId === member.userId && p.matchId === match.id);
    if (!pick) continue;

    const result = match.result.currentVersion;
    const points = calculatePoints(pick.pickJson, result, scoringPreset);
    totalPoints += points;
  }

  userPoints.set(member.userId, totalPoints);
}

// Sort by points DESC, joinedAtUtc ASC
const sorted = members.sort((a, b) => {
  const pointsDiff = userPoints.get(b.userId) - userPoints.get(a.userId);
  if (pointsDiff !== 0) return pointsDiff;
  return a.joinedAtUtc - b.joinedAtUtc;
});
```

**Scoring Logic (simplified):**

```typescript
function calculatePoints(pick: any, result: any, preset: ScoringPreset): number {
  if (pick.type === "OUTCOME") {
    return pick.outcome === outcomeFromScore(result.homeGoals, result.awayGoals)
      ? preset.outcomePoints
      : 0;
  }

  if (pick.type === "SCORE") {
    let points = 0;

    // Outcome correct?
    if (outcomeFromScore(pick.homeGoals, pick.awayGoals) === outcomeFromScore(result.homeGoals, result.awayGoals)) {
      points += preset.outcomePoints;
    }

    // Exact score?
    if (pick.homeGoals === result.homeGoals && pick.awayGoals === result.awayGoals) {
      points += preset.exactScoreBonus;
    }

    return points;
  }

  return 0;
}
```

---

## 5. Frontend Architecture

### 5.1 React Application Structure

**main.tsx (Entry Point):**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**App.tsx (Router + Auth State):**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getToken, onAuthChange } from './lib/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PoolPage from './pages/PoolPage';

function App() {
  const [token, setToken] = useState<string | null>(getToken());

  useEffect(() => {
    const unsubscribe = onAuthChange(() => {
      setToken(getToken());
    });
    return unsubscribe;
  }, []);

  if (!token) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pools/:poolId" element={<PoolPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Design Decisions:**
- ✅ **Conditional rendering** (no protected route wrapper yet)
- ✅ **Auth state in top-level component** (simple, no context needed)
- ✅ **Custom event system** for auth changes (see lib/auth.ts)

---

### 5.2 API Client Architecture

**lib/api.ts:**

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

async function apiFetch(endpoint: string, options?: RequestInit) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    // Token expired or invalid
    markSessionExpired();
    clearToken();
    // Triggers App re-render via auth event
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || err.error);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  register: (email: string, displayName: string, password: string) =>
    apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, displayName, password }) }),

  getMePools: () => apiFetch("/me/pools"),

  getPoolOverview: (poolId: string, verbose = false) =>
    apiFetch(`/pools/${poolId}/overview?leaderboardVerbose=${verbose ? "1" : "0"}`),

  // ... other methods
};
```

**Benefits:**
- ✅ **Centralized auth header injection**
- ✅ **Auto-logout on 401** (hardening)
- ✅ **Type-safe methods** (future: use codegen from OpenAPI)

---

### 5.3 Authentication Flow (Frontend)

**lib/auth.ts:**

```typescript
const TOKEN_KEY = "quiniela.token";
const SESSION_EXPIRED_KEY = "quiniela.sessionExpired";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token"); // Legacy support
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChange();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token"); // Legacy
  notifyAuthChange();
}

export function markSessionExpired() {
  localStorage.setItem(SESSION_EXPIRED_KEY, "true");
}

export function consumeSessionExpiredFlag(): boolean {
  const flag = localStorage.getItem(SESSION_EXPIRED_KEY) === "true";
  localStorage.removeItem(SESSION_EXPIRED_KEY);
  return flag;
}

// Custom event system
function notifyAuthChange() {
  window.dispatchEvent(new CustomEvent("quiniela:auth"));
}

export function onAuthChange(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("quiniela:auth", handler);
  return () => window.removeEventListener("quiniela:auth", handler);
}
```

**Flow:**
1. User logs in → `setToken()` → Saves to localStorage → Fires `quiniela:auth` event
2. App listens → `onAuthChange()` → Re-renders with token
3. API call returns 401 → `clearToken()` → Fires event → App shows login page

---

### 5.4 Styling Architecture

**Global Styles (index.css):**

```css
:root {
  color-scheme: light; /* Force light mode */

  /* CSS Variables */
  --bg: #f4f5f7;
  --surface: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --primary: #111827;
}

/* Utility Classes */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--bg);
  color: var(--text);
}
```

**Design System:**
- ✅ **Light theme only** (dark mode planned for v1.1)
- ✅ **CSS custom properties** (easy to theme)
- ✅ **Utility classes** (card, badge, button, alert)
- ✅ **No CSS-in-JS** (plain CSS for simplicity)

---

## 6. Database Architecture

### 6.1 PostgreSQL Configuration

**Docker Compose (docker-compose.yml):**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: quiniela-db
    environment:
      POSTGRES_USER: quiniela
      POSTGRES_PASSWORD: password
      POSTGRES_DB: quiniela
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

**Connection String:**
```
DATABASE_URL="postgresql://quiniela:password@localhost:5432/quiniela"
```

---

### 6.2 Schema Design Principles

**See [DATA_MODEL.md](./DATA_MODEL.md) for full schema.**

**Key Principles:**
1. **Normalization:** 3NF (Third Normal Form)
2. **Foreign Keys:** Enforce referential integrity
3. **Indexes:** Primary keys + frequently queried columns
4. **Immutability:** Critical entities (results, templates) are append-only
5. **Soft Deletes:** Use status fields instead of hard deletes
6. **Audit Trail:** `createdAtUtc`, `updatedAtUtc` on all tables
7. **JSON Fields:** For flexible/evolving data (pickJson, dataJson)

---

### 6.3 Migration Strategy

**Prisma Migrations:**

```bash
# Create migration
npx prisma migrate dev --name add_username

# Apply migrations (production)
npx prisma migrate deploy

# Reset (dev only, destructive)
npx prisma migrate reset
```

**Migration Workflow:**
1. Edit `schema.prisma`
2. Run `migrate dev` → Creates SQL migration file
3. Review migration file (manual edits if needed)
4. Commit migration to git
5. Deploy: `migrate deploy` on production

**Best Practices:**
- ✅ Descriptive migration names
- ✅ Test migrations on dev DB first
- ✅ Avoid breaking changes (add nullable columns first, then fill data, then make NOT NULL)
- ✅ Use transactions for multi-step migrations

---

## 7. Authentication & Security

### 7.1 JWT Authentication

**Token Structure:**

```json
{
  "userId": "a1b2c3d4-...",
  "platformRole": "PLAYER",
  "iat": 1672531200,
  "exp": 1672545600
}
```

**Signing:**
```typescript
import jwt from "jsonwebtoken";

export function signJWT(payload: { userId: string; platformRole: string }): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: "4h" });
}
```

**Verification:**
```typescript
export function verifyJWT(token: string): { userId: string; platformRole: string } {
  const secret = process.env.JWT_SECRET!;
  return jwt.verify(token, secret) as any;
}
```

**Security Notes:**
- ✅ Secret stored in environment variable (not in code)
- ✅ HMAC-SHA256 algorithm (symmetric, fast)
- ⚠️ No refresh tokens yet (user re-authenticates after 4h)
- ⚠️ No token revocation (future: Redis blacklist)

---

### 7.2 Password Security

**Hashing (bcrypt):**

```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Security Properties:**
- ✅ **Salt rounds = 10** (good balance of security vs performance)
- ✅ **Adaptive hashing** (slower = harder to brute-force)
- ✅ **Passwords never logged or exposed** (stored as hash only)

---

### 7.3 Input Validation & Sanitization

**Layers of Defense:**

1. **Zod Schemas** (type + format validation)
2. **Prisma** (SQL injection prevention via parameterized queries)
3. **React** (XSS prevention via automatic escaping)

**Example:**

```typescript
// 1. Zod validates input
const parsed = createPoolSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: "VALIDATION_ERROR" });
}

// 2. Prisma uses parameterized queries (safe)
const pool = await prisma.pool.create({
  data: {
    name: parsed.data.name, // Even if contains SQL, it's escaped
  }
});
```

**SQL Injection:** ✅ **Impossible** (Prisma always uses parameterized queries)
**XSS:** ✅ **Mitigated** (React escapes JSX by default)
**CSRF:** ⚠️ **Not protected** (future: CSRF tokens for state-changing endpoints)

---

### 7.4 CORS Configuration

**Current (Development):**

```typescript
app.use(cors()); // Allow all origins
```

**Production (Future):**

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL, // e.g., https://quiniela.app
  credentials: true,
}));
```

---

## 8. API Design Patterns

### 8.1 RESTful Conventions

**Resource-Oriented URLs:**

```
/pools                    # Collection
/pools/:poolId            # Single resource
/pools/:poolId/members    # Nested collection
/pools/:poolId/picks      # Nested collection
```

**HTTP Methods:**

| Method | Endpoint | Action | Idempotent |
|--------|----------|--------|------------|
| GET | `/pools/:id` | Retrieve pool | ✅ |
| POST | `/pools` | Create pool | ❌ |
| PUT | `/pools/:id/picks/:matchId` | Upsert pick | ✅ |
| DELETE | `/pools/:id` | Delete pool (future) | ✅ |
| PATCH | `/pools/:id` | Partial update (future) | ❌ |

**Status Codes:**
- `200 OK`: Successful GET/PUT/PATCH
- `201 Created`: Successful POST (resource created)
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Auth required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Business rule violation

---

### 8.2 Response Format Standards

**Success (Single Resource):**

```json
{
  "id": "uuid",
  "name": "Pool Name",
  "createdAtUtc": "2026-01-02T10:00:00.000Z"
}
```

**Success (Collection):**

```json
[
  { "id": "uuid-1", "name": "Pool 1" },
  { "id": "uuid-2", "name": "Pool 2" }
]
```

**Error:**

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": { /* Optional, for validation errors */ }
}
```

**No Envelope:** Resources returned directly (not wrapped in `{ data: ... }`)

---

### 8.3 Optimizations

**Single-Call Endpoint:**

`GET /pools/:poolId/overview` returns:
- Pool details
- Tournament instance
- Matches with team info
- User's picks
- Results
- Leaderboard

**Why?**
- ✅ **Reduces frontend API calls** (1 instead of 5-6)
- ✅ **Optimized backend queries** (JOINs instead of N+1)
- ✅ **Faster UX** (no loading spinners between sections)

**Trade-off:**
- ⚠️ Larger payload (~50KB for 72 matches)
- ⚠️ Can't cache individual pieces separately

---

## 9. Data Flow

### 9.1 Create Pool Flow

```
┌─────────┐                ┌─────────┐              ┌──────────┐
│ User    │                │ Frontend│              │ Backend  │
└────┬────┘                └────┬────┘              └────┬─────┘
     │                          │                        │
     │ Fills form               │                        │
     │ (name, instance, preset) │                        │
     │─────────────────────────>│                        │
     │                          │                        │
     │                          │ POST /pools            │
     │                          │ { name, instanceId, ...}
     │                          │───────────────────────>│
     │                          │                        │
     │                          │                        │ Validate input (Zod)
     │                          │                        │ Check instance exists
     │                          │                        │ Check instance not ARCHIVED
     │                          │                        │
     │                          │                        │ BEGIN TRANSACTION
     │                          │                        │   Create Pool
     │                          │                        │   Create PoolMember (HOST)
     │                          │                        │   Create PoolInvite (first code)
     │                          │                        │ COMMIT
     │                          │                        │
     │                          │                        │ Write AuditEvent
     │                          │                        │
     │                          │<───────────────────────│
     │                          │ 201 Created            │
     │                          │ { pool, membership, inviteCode }
     │<─────────────────────────│                        │
     │                          │                        │
     │ Redirect to /pools/:id   │                        │
     │─────────────────────────>│                        │
```

---

### 9.2 Submit Pick Flow

```
┌─────────┐                ┌─────────┐              ┌──────────┐
│ User    │                │ Frontend│              │ Backend  │
└────┬────┘                └────┬────┘              └────┬─────┘
     │                          │                        │
     │ Enters score (2-1)       │                        │
     │─────────────────────────>│                        │
     │                          │                        │
     │                          │ PUT /pools/:id/picks/:matchId
     │                          │ { pick: { type: "SCORE", homeGoals: 2, awayGoals: 1 } }
     │                          │───────────────────────>│
     │                          │                        │
     │                          │                        │ Validate input (Zod)
     │                          │                        │ Check user is member
     │                          │                        │ Check match exists
     │                          │                        │ Check deadline not passed
     │                          │                        │
     │                          │                        │ UPSERT Prediction
     │                          │                        │ (creates or updates)
     │                          │                        │
     │                          │                        │ Write AuditEvent
     │                          │                        │
     │                          │<───────────────────────│
     │                          │ 200 OK                 │
     │                          │ { prediction }         │
     │<─────────────────────────│                        │
     │                          │                        │
     │ Shows success message    │                        │
```

---

### 9.3 Publish Result Flow

```
┌─────────┐                ┌─────────┐              ┌──────────┐
│ Host    │                │ Frontend│              │ Backend  │
└────┬────┘                └────┬────┘              └────┬─────┘
     │                          │                        │
     │ Enters result (2-1)      │                        │
     │─────────────────────────>│                        │
     │                          │                        │
     │                          │ PUT /pools/:id/results/:matchId
     │                          │ { homeGoals: 2, awayGoals: 1, reason?: "..." }
     │                          │───────────────────────>│
     │                          │                        │
     │                          │                        │ Validate input (Zod)
     │                          │                        │ Check user is HOST
     │                          │                        │ Check match exists
     │                          │                        │
     │                          │                        │ BEGIN TRANSACTION
     │                          │                        │   Find or create PoolMatchResult
     │                          │                        │   Get last versionNumber
     │                          │                        │   IF version > 1, require reason
     │                          │                        │   Create PoolMatchResultVersion
     │                          │                        │   Update currentVersionId
     │                          │                        │ COMMIT
     │                          │                        │
     │                          │                        │ Write AuditEvent
     │                          │                        │
     │                          │<───────────────────────│
     │                          │ 200 OK                 │
     │                          │ { result with version }│
     │<─────────────────────────│                        │
     │                          │                        │
     │ Leaderboard auto-updates │                        │
     │ (re-fetch overview)      │                        │
     │─────────────────────────>│                        │
```

---

## 10. Deployment Architecture

### 10.1 Local Development

**Prerequisites:**
- Node.js 18+ LTS
- Docker Desktop (for PostgreSQL)
- npm

**Start Backend:**

```bash
cd backend
docker compose up -d              # Start PostgreSQL
npm install                       # Install dependencies
npx prisma migrate dev            # Run migrations
npm run seed:test-accounts        # Seed test users
npm run seed:wc2026-sandbox       # Seed tournament
npm run dev                       # Start dev server (ts-node-dev)
```

**Start Frontend:**

```bash
cd frontend
npm install
npm run dev                       # Start Vite dev server
```

**Access:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Database: `localhost:5432` (Postgres client)

---

### 10.2 Production Deployment (Planned)

**Option 1: VPS (DigitalOcean, Linode, Hetzner)**

```
┌─────────────────────────────────────────────────┐
│                 VPS (Ubuntu 22.04)              │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy + HTTPS)           │  │
│  │  - Terminates SSL (Let's Encrypt)        │  │
│  │  - Serves frontend static files          │  │
│  │  - Proxies /api to backend               │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                 │
│  ┌────────────▼─────────────────────────────┐  │
│  │  Node.js Backend (PM2)                   │  │
│  │  - Express app on port 3000              │  │
│  │  - Auto-restart on crash                 │  │
│  │  - Log management                        │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                 │
│  ┌────────────▼─────────────────────────────┐  │
│  │  PostgreSQL (Docker or native)           │  │
│  │  - Persistent volume                     │  │
│  │  - Daily backups to S3                   │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Deployment Steps:**
1. Build frontend: `npm run build` → `/dist`
2. Copy dist to VPS: `/var/www/quiniela`
3. Build backend: `npm run build` → `/dist`
4. Copy backend to VPS: `/opt/quiniela-api`
5. Run migrations: `npx prisma migrate deploy`
6. Restart PM2: `pm2 restart quiniela-api`
7. Nginx serves frontend, proxies API

---

**Option 2: Cloud (Vercel + Railway/Render)**

```
┌──────────────────┐         ┌──────────────────┐
│  Vercel          │         │  Railway/Render  │
│  (Frontend)      │         │  (Backend + DB)  │
│                  │         │                  │
│  - Static SPA    │◄────────┤  - Node.js API   │
│  - CDN           │  HTTPS  │  - PostgreSQL    │
│  - Auto SSL      │         │  - Auto deploys  │
└──────────────────┘         └──────────────────┘
```

**Benefits:**
- ✅ Zero-config HTTPS
- ✅ Auto-scaling
- ✅ Git-based deploys
- ✅ Managed DB backups

**Costs (est.):**
- Vercel: Free (hobby tier)
- Railway: ~$5-10/month (starter DB)

---

### 10.3 CI/CD Pipeline (Planned)

**GitHub Actions Workflow:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test  # Future: add tests

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: scp -r dist user@vps:/opt/quiniela-api
      - run: ssh user@vps "pm2 restart quiniela-api"

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: scp -r dist user@vps:/var/www/quiniela
```

---

## 11. Performance & Scalability

### 11.1 Current Performance Characteristics

**Backend:**
- **API Response Time:** < 100ms (p50), < 500ms (p95)
- **Database Queries:** Avg 2-3 queries per request
- **Leaderboard Calculation:** < 1s for 100 players, 72 matches
- **Concurrent Users:** Tested up to 10 (dev only)

**Frontend:**
- **First Contentful Paint:** < 1.5s (Vite dev server)
- **Time to Interactive:** < 2s
- **Bundle Size:** ~150KB (gzipped)

---

### 11.2 Bottlenecks & Optimizations

**Current Bottlenecks:**

1. **Leaderboard Calculation** (in-memory, O(n×m) where n=players, m=matches)
   - **Solution (v1.0):** Materialized view or pre-computed cache

2. **Single-Call Endpoint** (large payload for pools with many matches)
   - **Solution (v1.1):** Pagination or lazy-load matches

3. **No Caching** (every request hits DB)
   - **Solution (v1.0):** Redis cache for pool overview (invalidate on updates)

**Future Optimizations:**

- **Read Replicas:** Separate read/write DB instances
- **Connection Pooling:** Prisma connection limits (current: unlimited)
- **CDN:** Serve frontend static assets from edge locations
- **Compression:** gzip/brotli for API responses
- **Database Indexes:** Add composite indexes for hot queries

---

### 11.3 Scalability Strategy

**Vertical Scaling (v1.0 - v1.5):**
- Increase VPS size (2GB → 4GB → 8GB RAM)
- Increase DB size (shared CPU → dedicated CPU)
- Add read replica for leaderboard queries

**Horizontal Scaling (v2.0+):**
- Multiple backend instances behind load balancer
- Stateless API (JWT = no session store needed)
- Shared PostgreSQL (with pgBouncer for connection pooling)
- Redis for distributed caching

**Microservices (v3.0+):**
- Split services: Auth, Pools, Leaderboard, Admin
- Event-driven (message queue for leaderboard recalc)
- Separate databases per service (if needed)

---

## 12. Future Architecture Evolution

### 12.1 Short-Term (v0.2-beta → v1.0)

- [ ] **Add Redis caching** (pool overview, leaderboard)
- [ ] **Implement rate limiting** (express-rate-limit)
- [ ] **Add health check endpoint** (DB connectivity, Redis connectivity)
- [ ] **Error tracking** (Sentry integration)
- [ ] **Analytics** (basic usage metrics)
- [ ] **HTTPS in production** (Let's Encrypt)
- [ ] **Database backups** (automated daily to S3)

---

### 12.2 Mid-Term (v1.1 → v2.0)

- [ ] **Read replicas** (PostgreSQL replication)
- [ ] **Materialized views** (leaderboard pre-computation)
- [ ] **Email service integration** (Resend for notifications)
- [ ] **OAuth providers** (Google, Facebook)
- [ ] **WebSockets** (real-time leaderboard updates)
- [ ] **Background jobs** (cron for auto-archiving)
- [ ] **GraphQL API** (alternative to REST)

---

### 12.3 Long-Term (v2.0+)

- [ ] **Microservices** (separate auth, pools, leaderboard services)
- [ ] **Event-driven architecture** (Kafka/RabbitMQ)
- [ ] **Multi-region deployment** (CDN + geo-distributed DB)
- [ ] **Mobile apps** (React Native)
- [ ] **Real-time collaboration** (WebRTC for in-pool chat)
- [ ] **Machine learning** (pick recommendations, upset predictions)

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

# Test Accounts (for seeding)
TEST_ADMIN_EMAIL="admin@test.com"
TEST_ADMIN_PASSWORD="Admin123!"
TEST_HOST_EMAIL="host@test.com"
TEST_HOST_PASSWORD="Host123!"
TEST_PLAYER_EMAIL="player@test.com"
TEST_PLAYER_PASSWORD="Player123!"
```

### Frontend (.env)

```bash
VITE_API_BASE_URL=http://localhost:3000
```

---

## Appendix B: Related Documentation

- [PRD.md](./PRD.md) - Product requirements
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [API_SPEC.md](./API_SPEC.md) - API documentation
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Business logic

---

**END OF DOCUMENT**
