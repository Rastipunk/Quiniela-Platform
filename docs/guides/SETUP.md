# Local Development Setup
# Picks4All

> **Last Updated:** 2026-05-04

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22+ | Required by both frontend and backend |
| npm | 10+ | Comes with Node.js |
| PostgreSQL | 16 | Via Docker (recommended) or local install |
| Docker | Latest | Optional -- only needed for the local database |
| Git | Latest | Source control |

---

## 1. Clone the Repository

```bash
git clone <repo-url>
cd quiniela-platform
```

The monorepo contains two independent projects:

```
quiniela-platform/
├── backend/           # Express API
├── frontend-next/     # Next.js frontend
├── infra/             # Docker Compose for local DB
└── docs/              # Documentation
```

---

## 2. Start PostgreSQL

### Option A: Docker (Recommended)

```bash
cd infra
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` with:
- User: `quiniela`
- Password: `quiniela_pass`
- Database: `quiniela_db`

### Option B: Local PostgreSQL

If you have PostgreSQL installed locally, create a database:

```sql
CREATE DATABASE quiniela_db;
```

---

## 3. Backend Setup

```bash
cd backend
npm install
```

### 3.1 Environment Variables

Copy the example file and edit:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Value for local dev |
|----------|---------------------|
| `DATABASE_URL` | `postgresql://quiniela:quiniela_pass@localhost:5432/quiniela_db?schema=public` |
| `JWT_SECRET` | Any string, minimum 16 characters (e.g., `local-dev-secret-key-1234`) |

**Optional variables (features degrade gracefully without them):**

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | Frontend origin for CORS and email links (default: `http://localhost:3001`) |
| `PORT` | API port (default: `3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth — leave empty to disable |
| `RESEND_API_KEY` | Email sending via Resend — leave empty to silently skip emails |
| `RESEND_FROM_EMAIL` | Sender address for emails (e.g. `Picks4All <noreply@picks4all.com>`) |
| `API_FOOTBALL_KEY` | API-Football fallback layer — leave empty to disable |
| `SMART_SYNC_ENABLED` | `"true"` to enable the API-Football fallback cron |
| `SCORES_SERVICE_URL` / `SCORES_SERVICE_API_KEY` | picks4all-scores client (primary live-scoring layer). Leave empty to disable. |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` | Mercado Pago (COP). Optional locally — checkout endpoints will return 503 without them. |
| `POLAR_API_KEY` / `POLAR_WEBHOOK_SECRET` | Polar.sh (USD). Same. |
| `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` | Server-side GA4. `sendGa4Event` no-ops silently when unset. |
| `META_PIXEL_ID` / `META_CAPI_ACCESS_TOKEN` | Meta CAPI. Same. |
| `BRAND_COLORS_JSON` | Runtime brand override (backend only). |

### 3.2 Database Migration

```bash
npx prisma migrate dev
```

This applies all migrations and generates the Prisma client.

### 3.3 Seed Data

Run seeds in this order:

```bash
npm run seed:admin          # Creates platform admin (admin@example.com / Admin123!)
npm run seed:test-accounts  # Creates test host + player (uses TEST_*_EMAIL env vars)
npm run seed:legal          # Seeds terms of service and privacy policy documents
npm run seed:wc2026-sandbox # Seeds FIFA World Cup 2026 template, version, and instance
```

**What each seed creates:**

| Seed | Creates |
|------|---------|
| `seed:admin` | Admin user (`admin@example.com`, role ADMIN) |
| `seed:test-accounts` | Test host and player users (emails from env vars) |
| `seed:legal` | LegalDocument records (terms v1, privacy v1) |
| `seed:wc2026-sandbox` | WC2026 template + published version + active instance with 48 teams, 104 matches |
| `seed:ucl2025` | UCL 2025-26 template + instance with 45 matches |

All seeds are idempotent -- safe to run multiple times.

### 3.4 Start Development Server

```bash
npm run dev
```

Backend runs on `http://localhost:3000` (or the `PORT` env var). Uses `ts-node-dev` with live reload.

### 3.5 Verify

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "version": "v0.6.0", "commit": "local", "timestamp": "..." }
```

---

## 4. Frontend Setup

```bash
cd frontend-next
npm install
```

### 4.1 Environment Variables

Create `.env.local`:

```bash
# Required
NEXT_PUBLIC_API_URL=http://localhost:3000          # Backend API
NEXT_PUBLIC_SITE_URL=http://localhost:3001         # This frontend

# Optional
NEXT_PUBLIC_GOOGLE_CLIENT_ID=                      # Google OAuth client ID
NEXT_PUBLIC_GTM_ID=                                # Google Tag Manager (loads GA4 + consent mode)
NEXT_PUBLIC_META_PIXEL_ID=                         # Meta Pixel id (must match backend META_PIXEL_ID)
NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS=15000            # Live-match auto-refresh
NEXT_PUBLIC_PERSONAL_FREE_LIMIT=20                 # Free tier cap (personal)
NEXT_PUBLIC_CORPORATE_FREE_LIMIT=2                 # Free tier cap (corporate) — match backend
NEXT_PUBLIC_BASE_PRICE_COP=28500                   # COP base price per 50-player block
NEXT_PUBLIC_CORPORATE_BASE_PRICE_COP=200000        # COP corporate base (100 players)
```

The legacy `NEXT_PUBLIC_GA_ID` is no longer read — GA4 is loaded by GTM, so `NEXT_PUBLIC_GTM_ID` is what matters.

### 4.2 Start Development Server

The backend already occupies port 3000, so the frontend goes on 3001:

```bash
PORT=3001 npm run dev
```

Visit `http://localhost:3001`. If you launch with the default `npm run dev` (no `PORT`) you'll see a port-conflict error — either start the frontend first OR use the `PORT=3001` form above.

---

## 5. Common Issues

### Prisma client out of date

If you see type errors after pulling new migrations:

```bash
cd backend
npx prisma generate
```

### Port conflict

Backend and frontend both default to port 3000. Run the frontend on 3001:

```bash
cd frontend-next
PORT=3001 npm run dev
```

### Docker database connection refused

Ensure the Docker container is running:

```bash
cd infra
docker compose ps
docker compose up -d   # restart if needed
```

### Migration fails with existing database

If you have a stale local database:

```bash
npx prisma migrate reset   # WARNING: drops and recreates all tables
npm run seed:admin
npm run seed:legal
npm run seed:wc2026-sandbox
```

### Google OAuth not working locally

Google OAuth requires HTTPS in production. For local development, it works on `localhost` without HTTPS. Ensure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set and the Google Cloud Console has `http://localhost:3001` in the authorized JavaScript origins.

---

## 6. Useful Commands

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with live reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npx prisma studio` | Open Prisma's database GUI |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma migrate dev --name <name>` | Create a new migration |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
