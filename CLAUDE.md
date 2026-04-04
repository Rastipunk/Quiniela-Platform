# CLAUDE.md — Picks4All Development Standards

> **Last updated:** 2026-04-04
>
> This file defines the mandatory standards, principles, and constraints for ALL work in this repository. Every change — code, documentation, infrastructure — must comply with these rules.

---

## 1) Product Identity

**Picks4All** — Multi-tournament sports prediction platform (football only, for now).

- **Domain:** picks4all.com (frontend), api.picks4all.com (backend)
- **Locales:** ES (default, no prefix), EN (`/en/`), PT (`/pt/`) via next-intl v4
- **Branding:** Defined in `frontend-next/src/lib/brand.ts` and `backend/src/lib/brand.ts` — single source of truth for colors, gradients, name, domain
- **Hosting:** Railway (frontend + backend + PostgreSQL)

### User Roles

| Role | Description |
|------|-------------|
| **PLAYER** | Joins pools, makes picks, views leaderboard |
| **HOST** | Creates/manages pools, invites players, can override results (with justification + notification) |
| **CO_ADMIN** | Same as HOST except cannot delete pool |
| **CORPORATE_HOST** | HOST for corporate pools created via enterprise flow |
| **PLATFORM ADMIN** | Manages templates, instances, platform settings |

---

## 2) Mandatory Quality Standards

### These rules are NON-NEGOTIABLE. Every change must comply.

### Code Quality
- **Zero hardcoded values.** All configuration comes from environment variables, centralized constants (`lib/constants.ts`, `lib/brand.ts`, `lib/siteConfig.ts`), or the database. Static mappings (like flag URLs) are acceptable ONLY as fallbacks — the primary source must always be dynamic data from the API.
- **Zero magic numbers.** Every numeric literal in business logic must be a named constant with a comment explaining its purpose.
- **Zero duplicated logic.** If the same pattern appears twice, extract it to a shared utility, hook, or service.
- **Strict TypeScript.** No `any` types except at system boundaries (external API responses). Always narrow `unknown` before use.
- **Zod validation** on every API endpoint input. Never trust client data.
- **Audit trail** for every sensitive operation (result publish, member ban, pool delete, errata).

### Architecture
- **Backend:** Routes validate input → Services contain business logic → Libraries provide utilities. Business logic NEVER lives in route handlers.
- **Frontend:** Components render UI → Hooks manage state/effects → Lib provides utilities. Business logic NEVER lives in components.
- **Single source of truth.** Every piece of data lives in ONE place. If it's in the database, don't also hardcode it in the frontend.
- **Separation of concerns.** Each file has ONE responsibility. Components >500 lines must be split. Services >800 lines must be decomposed.

### Internationalization (i18n)
- **Every user-facing string** must use `t()` from next-intl. No hardcoded text in TSX components.
- **All three locales** (ES/EN/PT) must have complete translations. Never add a key to one locale without adding it to all three.
- **Dates and numbers** must respect the user's locale and timezone.

### SEO
- **Every public page** must have: metadata (title, description), canonical URL, Open Graph tags, JSON-LD structured data, and hreflang alternates.
- **All URLs** derive from `SITE_URL` in `lib/siteConfig.ts`, never hardcoded.
- **Sitemap and robots.txt** must be kept current with all public routes.

### Security
- **Never expose** stack traces, internal errors, or database details to clients.
- **Rate limiting** on all public and auth endpoints (configurable via env vars).
- **Input sanitization** for any user content rendered as HTML (use `escapeHtml`).
- **CORS** restricted to configured origins via `SITE_DOMAIN` env var.

### Results System
- **Results are API-first.** The host CANNOT publish results manually. Results come from the API-Football sync system.
- **Host can override** an existing result only with: mandatory reason, warning shown, and email notification sent to ALL pool members.
- **Legacy MANUAL mode** instances are exempt (backwards compatibility).

---

## 3) Documentation Structure

```
docs/
├── PRD.md                    # Product definition and scope
├── ARCHITECTURE.md           # Technical architecture and stack
├── DATA_MODEL.md             # Database schema (mirrors Prisma)
├── API_SPEC.md               # REST API contracts
├── BUSINESS_RULES.md         # Business rules and invariants
├── GLOSSARY.md               # Domain terminology
├── DECISION_LOG.md           # Architectural Decision Records
└── guides/
    ├── SETUP.md              # Local development setup
    ├── DEPLOYMENT.md         # Railway deployment and env vars
    ├── EMAIL_SYSTEM.md       # Email notification system
    ├── TOURNAMENT_SYSTEM.md  # Tournaments, phases, advancement, sync
    └── GOOGLE_OAUTH.md       # Google OAuth configuration
CLAUDE.md                     # This file — development standards
README.md                     # Repository entry point
CHANGELOG.md                  # Version history (Keep a Changelog format)
```

### Documentation Rules
- **Docs reflect the current state of the code.** No "planned features", no "to-do" sections, no history of changes.
- **If code and docs disagree → alert the user.** Never silently assume either is correct.
- **Every architectural decision** gets recorded in `DECISION_LOG.md` as an ADR.
- **Update docs in the same commit** as the code change, not in a separate pass.

---

## 4) Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router, standalone) | 16 |
| UI | React + TypeScript + CSS custom properties | 19 |
| i18n | next-intl | v4 |
| Backend | Express + TypeScript | 5 |
| ORM | Prisma | 6.19+ |
| Database | PostgreSQL (Railway managed) | 16 |
| Auth | JWT (4h) + Google Sign-In | — |
| Email | Resend | — |
| Sports Data | API-Football (api-sports.io) | v3 |
| Hosting | Railway (2 services + Postgres) | — |
| DNS | Cloudflare (+ Email Routing) | — |

---

## 5) Key File Locations

### Backend (`backend/src/`)
| Category | Files |
|----------|-------|
| Entry point | `server.ts` |
| Database | `db.ts`, `prisma/schema.prisma` |
| Auth | `lib/jwt.ts`, `lib/password.ts`, `middleware/requireAuth.ts` |
| Branding | `lib/brand.ts` |
| Constants | `lib/constants.ts` (time, pagination, sync, locales, user rules) |
| Shared schemas | `lib/schemas.ts` (Zod field schemas for reuse) |
| Email | `lib/email.ts`, `lib/emailTemplates.ts` |
| Scoring | `lib/scoringAdvanced.ts`, `lib/pickPresets.ts` |
| API-Football | `services/apiFootball/client.ts` |
| Smart Sync | `services/smartSync/service.ts` |
| Jobs | `jobs/smartSyncJob.ts`, `jobs/phaseSyncJob.ts`, `jobs/deadlineReminderJob.ts` |

### Frontend (`frontend-next/src/`)
| Category | Files |
|----------|-------|
| Theme | `lib/theme.ts` (derives from `lib/brand.ts`) |
| Site config | `lib/siteConfig.ts` (SITE_URL, SITE_NAME, EMAIL_DOMAIN) |
| Branding | `lib/brand.ts` |
| Validation | `lib/validation.ts` (centralized form constraints) |
| API client | `lib/api/client.ts` |
| i18n | `i18n/routing.ts`, `messages/{es,en,pt}/*.json` |
| Pool page | `app/[locale]/(authenticated)/pools/[poolId]/page.tsx` |

---

## 6) Critical Invariants (NEVER break)

1. **Deadline enforcement:** User cannot edit picks if `isLocked=true` (kickoff - deadline minutes reached).
2. **Result versioning:** Every result change creates a new version. Corrections require `reason`. All versions are immutable.
3. **Pool rules immutability:** Scoring configuration cannot change after pool has ACTIVE members.
4. **Leave pool:** Only PLAYER can leave (not HOST/CORPORATE_HOST). Status → LEFT, points preserved, read-only mode.
5. **Template immutability:** Published TournamentTemplateVersions are frozen snapshots.
6. **Pool independence:** Each pool has its own `fixtureSnapshot`. Advancing phases in one pool does not affect others.
7. **API-first results:** In AUTO mode, results come from API-Football. Host can only override existing results.

---

## 7) Workflow Protocol

### Before writing ANY code:
1. **Read relevant docs** in `/docs/` to understand current state.
2. **Propose a plan** (3-7 bullets) and wait for user approval.
3. **Never assume** — if unclear, ask. Better to ask 5 questions than make 1 wrong assumption.

### While writing code:
4. **Test against production** when possible (via Railway CLI or production DB queries). Never say "it should work" — verify.
5. **Track progress** with the TodoWrite tool for multi-step tasks.
6. **Commit atomically** — each commit should compile and deploy independently.

### After writing code:
7. **Verify in production** that the change works (API call, DB query, or user confirmation).
8. **Update documentation** in the same session if any docs are affected.
9. **Configure env vars** in Railway if new ones were introduced.

---

## 8) Environment Variables

All configurable values are documented in `docs/guides/DEPLOYMENT.md`. Key categories:

- **SITE_DOMAIN, FRONTEND_URL** — Domain configuration
- **JWT_SECRET** — Auth signing key
- **RESEND_API_KEY, RESEND_FROM_EMAIL** — Email service
- **API_FOOTBALL_KEY** — Sports data
- **RATE_LIMIT_*_MAX** — Rate limiting thresholds
- **MATCH_SYNC_*_MIN** — Match sync timing
- **NEXT_PUBLIC_*** — Frontend-exposed config (pricing, domain, etc.)
- **BRAND_COLORS_JSON** — Runtime brand override (backend only)

---

## 9) Communication

- **Language:** Communicate with the user in Spanish. Write code, comments, and documentation in English.
- **Be direct.** Lead with the answer, not the reasoning.
- **Admit mistakes immediately.** Never defend a wrong approach.
- **Verify, don't assume.** "The database shows X" is better than "X should be there".
