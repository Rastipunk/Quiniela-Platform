# Picks4All

Multi-tournament football prediction platform. Create pools, invite friends, predict match results, and compete on leaderboards.

**Live:** [picks4all.com](https://picks4all.com)

## Features

- **Pools** — Create or join prediction pools with custom scoring rules
- **Predictions** — Score-based, outcome-based, or structural picks (group standings, knockout winners)
- **Scoring** — 4 preset modes (Basic, Cumulative, Simple, Custom) with per-phase configuration
- **Results** — Scraper-first live scoring (picks4all-scores) with API-Football as fallback. Host can override with justification (all members notified)
- **Leaderboard** — Real-time standings with tiebreaker logic
- **Tournaments** — FIFA World Cup 2026 (48 teams, official FIFA bracket), UEFA Champions League 2025-26
- **Corporate** — Enterprise self-service: inquiry, pool creation, employee activation via CSV/email
- **Payments** — Dual gateway: Mercado Pago (Colombia/COP) + Polar.sh (international/USD)
- **i18n** — Spanish (default), English, Portuguese
- **SEO** — Server-rendered public pages, JSON-LD, Open Graph, regional landing pages
- **Admin analytics** — Real-time dashboard with growth, retention, revenue, corporate funnel

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| i18n | next-intl v4 |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL 16 + Prisma 6.19 |
| Auth | JWT + Google Sign-In |
| Email | Resend (outbound), Cloudflare Email Routing (inbound) |
| Sports Data | picks4all-scores (primary live scoring), API-Football (fallback) |
| Payments | Mercado Pago (CO/COP) + Polar.sh (international/USD) |
| Analytics | Google Analytics 4 + GTM (browser) + GA4 MP / Meta CAPI (server-side) |
| Hosting | Railway (frontend + backend + Postgres) |
| DNS | Cloudflare |

## Project Structure

```
quiniela-platform/
├── backend/                # Express API
│   ├── prisma/             # Schema + migrations
│   └── src/
│       ├── routes/         # HTTP handlers
│       ├── services/       # Business logic (auth, pools, payments, scoring, sync)
│       ├── lib/            # Utilities (brand, constants, email, scoring, pricing, GA4, Meta CAPI)
│       ├── middleware/     # Auth, admin gate, rate limiting
│       ├── jobs/           # Cron: live scores, SmartSync, deadline reminders, phase sync, CAPI retry
│       └── scripts/        # Seeds, data migrations, ad-hoc admin scripts
├── frontend-next/          # Next.js App
│   └── src/
│       ├── app/            # Routes (locale-aware; public + authenticated + admin)
│       ├── components/     # UI components (pool wizard, leaderboard, admin dashboards, etc.)
│       ├── lib/            # Brand, theme, API client, validation, config, pricing, analytics
│       ├── messages/       # i18n (ES/EN/PT)
│       └── data/           # Static data (team flags)
└── docs/                   # Documentation
    ├── PRD.md              # Product definition
    ├── ARCHITECTURE.md     # Technical architecture
    ├── DATA_MODEL.md       # Database schema
    ├── API_SPEC.md         # API contracts
    ├── BUSINESS_RULES.md   # Business rules
    ├── GLOSSARY.md         # Domain terminology
    ├── DECISION_LOG.md     # Architectural decisions (ADRs)
    └── guides/             # Setup, deployment, email, tournaments, scores, OAuth, analytics
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
| [TECH_DEBT.md](TECH_DEBT.md) | Tracked tech-debt deferred to post-launch |
| [CHANGELOG.md](CHANGELOG.md) | Version history (Keep a Changelog format) |
| [guides/SETUP.md](docs/guides/SETUP.md) | Local development setup |
| [guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) | Railway deployment + env vars |
| [guides/EMAIL_SYSTEM.md](docs/guides/EMAIL_SYSTEM.md) | Email notifications |
| [guides/TOURNAMENT_SYSTEM.md](docs/guides/TOURNAMENT_SYSTEM.md) | Tournament templates, phases, sync |
| [guides/SCORES_INTEGRATION.md](docs/guides/SCORES_INTEGRATION.md) | picks4all-scores live scoring |
| [guides/PREDICTION_UPDATES.md](docs/guides/PREDICTION_UPDATES.md) | AI prediction updates + subscriber notifications |
| [guides/GOOGLE_OAUTH.md](docs/guides/GOOGLE_OAUTH.md) | Google OAuth setup |
| [guides/ATTRIBUTION_TAXONOMY.md](docs/guides/ATTRIBUTION_TAXONOMY.md) | UTM / event taxonomy |
| [guides/ANALYTICS_PIPELINE.md](docs/guides/ANALYTICS_PIPELINE.md) | Server-side GA4 / Meta CAPI |
| [guides/TESTING.md](docs/guides/TESTING.md) | Test strategy and conventions |

## License

MIT
