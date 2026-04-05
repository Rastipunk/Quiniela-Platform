# Testing Guide

> **Last updated:** 2026-04-04

---

## Overview

The project has two layers of automated tests:

| Layer | Tool | Location | Runs against | Coverage |
|-------|------|----------|-------------|----------|
| Backend unit tests | Vitest | `backend/src/**/*.test.ts` | In-memory mocks | Services, utilities, scoring logic |
| Frontend E2E tests | Playwright | `frontend-next/e2e/*.spec.ts` | Production site | Pages, SEO, navigation, i18n, responsive |

---

## Backend Unit Tests (Vitest)

### Run

```bash
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Structure

```
backend/src/
├── lib/
│   ├── scoringAdvanced.test.ts     # Scoring engine (38 tests)
│   ├── scoringBreakdown.test.ts    # Score breakdown (38 tests)
│   ├── pickPresets.test.ts         # Preset validation (36 tests)
│   ├── serializers.test.ts         # Data serialization (3 tests)
│   ├── jwt.test.ts                 # Token signing/verification (7 tests)
│   ├── password.test.ts            # Hash/verify (4 tests)
│   └── email.test.ts               # Email client readiness (2 tests)
├── services/
│   ├── poolStateMachine.test.ts    # State transitions (26 tests)
│   └── deadlineReminderService.test.ts  # Reminder logic (20 tests)
```

### Current count: 196 tests

### Adding new tests

Follow the existing pattern: co-locate `*.test.ts` next to the source file. Mock Prisma with `vi.mock("../db")`.

---

## Frontend E2E Tests (Playwright)

### Setup (first time)

```bash
cd frontend-next
npm install -D @playwright/test
npx playwright install chromium
```

### Run

```bash
cd frontend-next

# Run all tests against production
npx playwright test

# Run against local dev server
BASE_URL=http://localhost:3000 npx playwright test

# Run specific test file
npx playwright test e2e/world-cup.spec.ts

# Run with visible browser (debug)
npx playwright test --headed

# Run with UI debugger
npx playwright test --ui

# View HTML report after run
npx playwright show-report
```

### Structure

```
frontend-next/e2e/
├── helpers/
│   └── pages.ts                 # Page registry — single source of truth
├── public-pages.spec.ts         # All pages load, no errors, no forbidden text
├── seo-metadata.spec.ts         # Title, description, OG, hreflang, canonical
├── navigation.spec.ts           # NavBar, Footer, internal links
├── i18n.spec.ts                 # 3 locales render, lang attribute, translated
├── world-cup.spec.ts            # WC2026 hub data integrity (groups, teams, etc.)
└── responsive.spec.ts           # Mobile viewport, touch targets, no overflow
```

### Page Registry (`helpers/pages.ts`)

Every public page is registered with:
- URL paths per locale (ES/EN/PT)
- Expected SEO metadata (title, description substrings)
- Required DOM elements
- Forbidden text patterns (TBD, undefined, raw i18n keys)

When adding a new public page: add it to `pages.ts` and all test suites pick it up automatically.

### Test projects

| Project | Viewport | Browser |
|---------|----------|---------|
| desktop-chrome | 1280×720 | Chromium |
| mobile-chrome | 393×851 (Pixel 5) | Chromium |

### What the tests catch

| Bug type | Test file | Example |
|----------|-----------|---------|
| Page returns 404 | public-pages.spec.ts | Missing page route |
| Missing SEO title | seo-metadata.spec.ts | generateMetadata not exported |
| Broken nav link | navigation.spec.ts | Link to non-existent route |
| Raw i18n key shown | i18n.spec.ts | `pool.invite.createCode` visible |
| TBD team name | world-cup.spec.ts | Unresolved placeholder |
| i18n key collision | public-pages.spec.ts | One namespace overwrites another |
| Mobile overflow | responsive.spec.ts | Content wider than viewport |
| Console JS error | public-pages.spec.ts | Runtime crash in component |

### Configuration

`playwright.config.ts` — main config:
- `baseURL`: defaults to `https://picks4all.com`, override with `BASE_URL` env var
- `timeout`: 30 seconds per test
- Screenshots: only on failure
- Trace: on first retry
- Report: HTML (open with `npx playwright show-report`)

---

## Adding Tests for New Features

### New public page

1. Add entry to `e2e/helpers/pages.ts` with paths, metadata, and required elements
2. Run `npx playwright test` — the existing test suites automatically test the new page
3. If the page has specific data (like WC2026 groups), add a dedicated test in the relevant spec file

### New backend service

1. Create `serviceName.test.ts` next to the source file
2. Mock Prisma: `vi.mock("../db")`
3. Test business logic, not HTTP — keep tests fast and deterministic
4. Run `npm test` to verify

### New API endpoint

Future: integration tests will be added in Phase 4 (see testing roadmap below).

---

## Testing Roadmap

| Phase | Status | Tests |
|-------|--------|-------|
| 1. E2E public pages (Playwright) | Done | ~100 tests |
| 2. E2E auth + pool flows | Planned | ~25 tests |
| 3. Backend unit tests expansion | Planned | ~80 tests |
| 4. Backend API integration tests | Planned | ~50 tests |
| 5. i18n completeness validation | Planned | ~10 tests |
| 6. Visual regression screenshots | Planned | ~15 tests |

---

## Quick Reference

```bash
# Backend
cd backend && npm test                        # 196 unit tests

# Frontend E2E (production)
cd frontend-next && npx playwright test       # All E2E tests

# Frontend E2E (local)
cd frontend-next && BASE_URL=http://localhost:3000 npx playwright test

# View report
cd frontend-next && npx playwright show-report
```
