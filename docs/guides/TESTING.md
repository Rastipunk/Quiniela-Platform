# Testing Guide

> **Last updated:** 2026-05-28

---

## Overview

The project has two layers of automated tests:

| Layer | Tool | Location | Runs against | Coverage |
|-------|------|----------|-------------|----------|
| Backend unit tests | Vitest | `backend/src/**/*.test.ts` | In-memory mocks | Services, utilities, scoring logic |
| Backend integration tests | Vitest | `backend/src/__tests__/**` | Real Prisma | Route-level flows (auth, pools, corporate, etc.) |
| Frontend E2E tests | Playwright | `frontend-next/e2e/*.spec.ts` | Production site | Pages, SEO, navigation, i18n, responsive, auth/pool/invite/prediction flows |

---

## Backend Unit Tests (Vitest)

### Run

```bash
cd backend
npm test              # Run all unit tests (co-located *.test.ts)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report (scoped, see note below)
npm run test:integration # Integration tests in src/__tests__/ (real Prisma)
```

> **Coverage scope:** `vitest.config.ts` restricts `coverage.include` to `src/lib/email.ts` and `src/services/deadlineReminderService.ts`. `test:coverage` therefore reports coverage only for those two files, not the whole backend (intentional include list).

### Structure

Tests live next to the source file. Categories:

| Area | Examples |
|------|----------|
| Scoring | `scoringAdvanced.test.ts`, `scoringBreakdown.test.ts`, `pickPresets.test.ts` |
| Auth | `jwt.test.ts`, `password.test.ts`, `authService.security.test.ts`, `authService.activateCorporate.test.ts` |
| Email | `email.test.ts`, `emailTemplates.xss.test.ts` (XSS regression for every template) |
| Pool flows | `poolStateMachine.test.ts`, `poolHelpers.test.ts`, `poolCapacity.test.ts`, `poolCapacity.notify.test.ts`, `poolAdminService.scoringConfig.test.ts` |
| Username | `username.test.ts` |
| Picks config | `pickConfig.test.ts` |
| Picks / structural | `groupStandingsService.test.ts` |
| Tournament | `tournamentAdvancement.test.ts` |
| Reminders | `deadlineReminderService.test.ts` |
| Payments | `paymentService.test.ts`, `payments.test.ts` (route layer) |
| Validation | `schemas.test.ts`, `constants.test.ts`, `fixture.test.ts` |
| Branding | `brand.test.ts` |
| Pricing | `pricing.test.ts` (USD/COP parity) |
| Misc | `serializers.test.ts`, `corporateService.test.ts`, `rateLimit.test.ts` |

### Current count

~29 unit test files (co-located `*.test.ts`) plus 6 integration test files in `src/__tests__/`. The two suites are disjoint: the unit `vitest.config.ts` explicitly `exclude`s `src/__tests__/**`, and the integration suite is the only thing the integration config includes. Run `npm test -- --run` to see the live unit total.

### Adding new tests

Follow the existing pattern: co-locate `*.test.ts` next to the source file. Mock Prisma with `vi.mock("../db")`. Integration tests that need a real DB go through `vitest.integration.config.ts` (`include: src/__tests__/**`, run with `npm run test:integration`).

---

## Frontend E2E Tests (Playwright)

### Setup (first time)

`@playwright/test` is already a committed devDependency, so a normal install provides it. The only first-time step is downloading the browser binary:

```bash
cd frontend-next
npm install                      # deps (incl. @playwright/test) already declared
npx playwright install chromium  # one-time browser download
```

> The frontend has **no** `npm test` / `npm run e2e` script (only `dev`, `build`, `start`, `lint`). Run Playwright directly via `npx playwright test`.

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
│   ├── pages.ts                      # Page registry — single source of truth
│   └── auth.ts                       # Auth helper (login via .env.local creds), used by flow specs
├── public-pages.spec.ts              # All pages load, no errors, no forbidden text
├── seo-metadata.spec.ts              # Title, description, OG, hreflang, canonical
├── navigation.spec.ts                # NavBar, Footer, internal links
├── i18n.spec.ts                      # 3 locales render, lang attribute, translated
├── i18n-completeness.spec.ts         # No missing/raw keys across ES/EN/PT namespaces
├── world-cup.spec.ts                 # WC2026 hub data integrity (groups, teams, etc.)
├── responsive.spec.ts                # Mobile viewport, touch targets, no overflow
├── visual-regression.spec.ts         # Screenshot diffing (desktop only)
├── analytics-tracking.spec.ts        # GTM dataLayer / event tracking
├── auth-flow.spec.ts                 # Login / signup authenticated journey
├── invite-flow.spec.ts               # Pool invite acceptance flow
├── pool-lifecycle.spec.ts            # Pool create → manage → state transitions
└── prediction-subscription.spec.ts   # Prediction + subscriber journey
```

The flow specs (`auth-flow`, `invite-flow`, `pool-lifecycle`, `prediction-subscription`) exercise authenticated journeys, signing in via credentials read from `frontend-next/.env.local` (loaded by `playwright.config.ts`). The remaining specs only touch public pages.

### Page Registry (`helpers/pages.ts`)

Every public page is registered with:
- URL paths per locale (ES/EN/PT)
- Expected SEO metadata (title, description substrings)
- Required DOM elements
- Forbidden text patterns (TBD, undefined, raw i18n keys)

When adding a new public page: add it to `pages.ts` and all test suites pick it up automatically.

### Test projects

| Project | Device | Browser | Scope |
|---------|--------|---------|-------|
| desktop-chrome | `Desktop Chrome` (Playwright default) | Chromium | All specs except `responsive.spec.ts` (`testIgnore`) |
| mobile-chrome | `Pixel 5` (Playwright default) | Chromium | Only `responsive.spec.ts` (`testMatch`), skips `visual-regression.spec.ts` |

Project scoping matters: responsive specs run **only** on the mobile project, and `visual-regression.spec.ts` runs **only** on desktop. Viewports come from Playwright's built-in `devices` entries — there are no hardcoded pixel dimensions in `playwright.config.ts`.

### What the tests catch

| Bug type | Test file | Example |
|----------|-----------|---------|
| Page returns 404 | public-pages.spec.ts | Missing page route |
| Missing SEO title | seo-metadata.spec.ts | generateMetadata not exported |
| Broken nav link | navigation.spec.ts | Link to non-existent route |
| Raw i18n key shown | i18n.spec.ts | `pool.invite.createCode` visible |
| TBD team name | world-cup.spec.ts | Unresolved placeholder |
| i18n key collision | public-pages.spec.ts | One namespace overwrites another |
| Mobile overflow | responsive.spec.ts | Content wider than viewport (mobile project only) |
| Console JS error | public-pages.spec.ts | Runtime crash in component |
| Missing translation key | i18n-completeness.spec.ts | Key present in one locale but not another |
| Visual regression | visual-regression.spec.ts | Layout drift vs baseline screenshot (desktop project only) |
| Broken auth journey | auth-flow.spec.ts | Login/signup flow fails |
| Broken pool flow | pool-lifecycle.spec.ts | Pool create/manage transition fails |
| Broken invite flow | invite-flow.spec.ts | Invite acceptance fails |
| Missing analytics event | analytics-tracking.spec.ts | Expected dataLayer event not fired |

### Configuration

`playwright.config.ts` — main config:
- `baseURL`: defaults to `https://picks4all.com`, override with `BASE_URL` env var
- `timeout`: 30 seconds per test
- `locale`: `es` (default request locale)
- Screenshots: only on failure
- Trace: on first retry
- Visual regression: `toHaveScreenshot` tolerance `maxDiffPixelRatio: 0.05`, animations disabled
- Report: HTML (open with `npx playwright show-report`)

> **Test-only config note:** `backend/vitest.config.ts` sets `env.FRONTEND_URL` to the legacy Vite port `http://localhost:5173`. This is a harmless unit-test-only value; the live frontend is Next.js on port 3000.

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

# Frontend E2E (local — next dev defaults to port 3000)
cd frontend-next && BASE_URL=http://localhost:3000 npx playwright test

# View report
cd frontend-next && npx playwright show-report
```
