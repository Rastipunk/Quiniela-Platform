# Testing Guide

> **Last updated:** 2026-05-04

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

Tests live next to the source file. Categories:

| Area | Examples |
|------|----------|
| Scoring | `scoringAdvanced.test.ts`, `scoringBreakdown.test.ts`, `pickPresets.test.ts` |
| Auth | `jwt.test.ts`, `password.test.ts`, `authService.security.test.ts`, `authService.activateCorporate.test.ts` |
| Email | `email.test.ts`, `emailTemplates.xss.test.ts` (XSS regression for every template) |
| Pool flows | `poolStateMachine.test.ts`, `poolHelpers.test.ts`, `poolCapacity.test.ts`, `poolCapacity.notify.test.ts` |
| Picks / structural | `groupStandingsService.test.ts` |
| Tournament | `tournamentAdvancement.test.ts` |
| Reminders | `deadlineReminderService.test.ts` |
| Payments | `paymentService.test.ts`, `payments.test.ts` (route layer) |
| Validation | `schemas.test.ts`, `constants.test.ts`, `fixture.test.ts` |
| Branding | `brand.test.ts` |
| Pricing | `pricing.test.ts` (USD/COP parity) |
| Misc | `serializers.test.ts`, `corporateService.test.ts`, `rateLimit.test.ts` |

### Current count

~28 test files / ~600+ tests. Run `npm test -- --run` to see the live total.

### Adding new tests

Follow the existing pattern: co-locate `*.test.ts` next to the source file. Mock Prisma with `vi.mock("../db")`. Integration tests that need a real DB go through `vitest.integration.config.ts` (run with `npm run test:integration`).

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

Route-level tests already exist (see `backend/src/routes/payments.test.ts` for the canonical pattern: mock the service layer, exercise the HTTP handler). Add a sibling `routes/<name>.test.ts` and stub `req`/`res` via Vitest mocks.

For tests that need real Prisma, add them to the integration config and run with `npm run test:integration`.

---

## Quick Reference

```bash
# Backend
cd backend && npm test -- --run         # All unit tests
cd backend && npm run test:integration  # Tests that hit real Prisma

# Frontend E2E (production)
cd frontend-next && npx playwright test

# Frontend E2E (local)
cd frontend-next && BASE_URL=http://localhost:3001 npx playwright test

# View report
cd frontend-next && npx playwright show-report
```
