# Picks4All

Multi-tournament football prediction platform. Create pools, invite friends, predict match results, and compete on leaderboards.

**Live:** [picks4all.com](https://picks4all.com)

## Features

- **Pools** — Create or join prediction pools with custom scoring rules
- **Predictions** — Score-based, outcome-based, or structural picks (group standings, knockout winners)
- **Scoring** — 4 preset modes (Basic, Cumulative, Simple, Custom) with per-phase configuration
- **Results** — Automatic via API-Football sync. Host can override with justification (all members notified)
- **Leaderboard** — Real-time standings with tiebreaker logic
- **Tournaments** — FIFA World Cup 2026 (48 teams, official FIFA bracket), UEFA Champions League 2025-26
- **Corporate** — Enterprise self-service: inquiry, pool creation, employee activation via CSV/email
- **i18n** — Spanish (default), English, Portuguese
- **SEO** — Server-rendered public pages, JSON-LD, Open Graph, regional landing pages

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| i18n | next-intl v4 |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL 16 + Prisma 6.19 |
| Auth | JWT + Google Sign-In |
| Email | Resend |
| Sports Data | API-Football (api-sports.io) |
| Hosting | Railway |
| DNS | Cloudflare |

## Project Structure

```
quiniela-platform/
├── backend/                # Express API
│   ├── prisma/             # Schema + 38 migrations
│   └── src/
│       ├── routes/         # HTTP handlers (23 route files)
│       ├── services/       # Business logic (24 service files)
│       ├── lib/            # Utilities (brand, constants, email, scoring, etc.)
│       ├── middleware/      # Auth, rate limiting
│       ├── jobs/           # Cron: SmartSync, deadline reminders, phase sync
│       └── scripts/        # Seeds and data migrations
├── frontend-next/          # Next.js App
│   └── src/
│       ├── app/            # Routes (26 pages)
│       ├── components/     # UI components (60+)
│       ├── lib/            # Brand, theme, API client, validation, config
│       ├── messages/       # i18n (18 namespaces x 3 locales)
│       └── data/           # Static data (team flags)
└── docs/                   # Documentation
    ├── PRD.md              # Product definition
    ├── ARCHITECTURE.md     # Technical architecture
    ├── DATA_MODEL.md       # Database schema
    ├── API_SPEC.md         # API contracts
    ├── BUSINESS_RULES.md   # Business rules
    ├── GLOSSARY.md         # Domain terminology
    ├── DECISION_LOG.md     # Architectural decisions (ADRs)
    └── guides/             # Setup, deployment, email, tournaments, OAuth
```

## Getting Started

See [docs/guides/SETUP.md](docs/guides/SETUP.md) for local development setup.

See [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) for production deployment.

## Documentation

| Document | Description |
|----------|------------|
| [PRD](docs/PRD.md) | Product scope, features, user roles |
| [Architecture](docs/ARCHITECTURE.md) | System design, tech stack, data flows |
| [Data Model](docs/DATA_MODEL.md) | Database schema, models, relationships |
| [API Spec](docs/API_SPEC.md) | REST endpoints, auth, error handling |
| [Business Rules](docs/BUSINESS_RULES.md) | Invariants, validation, scoring logic |
| [Glossary](docs/GLOSSARY.md) | Domain terminology |
| [Decision Log](docs/DECISION_LOG.md) | Architectural decision records |
| [CLAUDE.md](CLAUDE.md) | Development standards and quality requirements |

## License

MIT
