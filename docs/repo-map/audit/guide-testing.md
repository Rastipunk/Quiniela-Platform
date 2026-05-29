## Audit: docs/guides/TESTING.md

**Overall verdict: UPDATE (minor-to-major).** The doc's high-level shape is correct (Vitest backend unit tests + Playwright frontend E2E, co-located test files, page registry, production-by-default baseURL). But the E2E suite has roughly doubled since this doc was last touched (2026-05-04) and the doc lists fewer than half the spec files. Several concrete claims (Playwright install step, mobile viewport numbers, test counts, dev port) are stale or wrong. No fully-obsolete subsystems, but enough drift to mislead a contributor.

Verified against: `frontend-next/playwright.config.ts`, `frontend-next/package.json`, `backend/package.json`, `backend/vitest.config.ts`, `backend/vitest.integration.config.ts`, actual `frontend-next/e2e/*.spec.ts` and `backend/src/**/*.test.ts` listings, repo-map README index.

---

### Finding 1 — E2E spec list is incomplete (missing)
**Section:** Frontend E2E Tests (Playwright) → Structure; also playwright.config.ts header comment mirrors the same stale list.

The doc lists 6 spec files: `public-pages`, `seo-metadata`, `navigation`, `i18n`, `world-cup`, `responsive`. The repo actually has **13** spec files in `frontend-next/e2e/`:
`analytics-tracking.spec.ts`, `auth-flow.spec.ts`, `i18n-completeness.spec.ts`, `i18n.spec.ts`, `invite-flow.spec.ts`, `navigation.spec.ts`, `pool-lifecycle.spec.ts`, `prediction-subscription.spec.ts`, `public-pages.spec.ts`, `responsive.spec.ts`, `seo-metadata.spec.ts`, `visual-regression.spec.ts`, `world-cup.spec.ts`.

Missing from the doc: `analytics-tracking`, `auth-flow`, `invite-flow`, `pool-lifecycle`, `prediction-subscription`, `visual-regression`, `i18n-completeness`. Also `e2e/helpers/auth.ts` (auth helper, used by the flow specs) is not mentioned alongside `helpers/pages.ts`.

**Fix:** Replace the structure tree with all 13 specs and the two helpers (`pages.ts`, `auth.ts`). Note that the flow specs (auth/invite/pool-lifecycle/prediction-subscription) exercise authenticated journeys via credentials from `.env.local`, not just public pages.

### Finding 2 — mobile-chrome viewport / project scoping is wrong (incorrect)
**Section:** Test projects table + "What the tests catch".

The doc's table says `mobile-chrome | 393×851 (Pixel 5)`. The config (`playwright.config.ts`) uses `...devices["Pixel 5"]` (no hardcoded 393×851 — Playwright's Pixel 5 device is the source of truth). More importantly the doc omits the project scoping that actually exists:
- `desktop-chrome` has `testIgnore: ["**/responsive.spec.ts"]`
- `mobile-chrome` has `testMatch: ["**/responsive.spec.ts"]` AND `testIgnore: ["**/visual-regression.spec.ts"]`

So responsive specs run ONLY on mobile, and visual-regression runs ONLY on desktop. The "What the tests catch" table implies a flat mapping with no project scoping.

**Fix:** Drop the invented `393×851` literal (or mark it as "Pixel 5 default"). Add the testMatch/testIgnore behavior: desktop project skips responsive; mobile project runs only responsive and skips visual-regression.

### Finding 3 — Playwright install step is stale (obsolete)
**Section:** Frontend E2E Tests → Setup (first time).

The doc says `npm install -D @playwright/test`. `@playwright/test` (^1.59.1) is already a committed devDependency in `frontend-next/package.json`, so a normal `npm install` already provides it. The only first-time step truly needed is the browser download (`npx playwright install chromium`).

**Fix:** Replace with `cd frontend-next && npm install` (deps already declared), then `npx playwright install chromium`.

### Finding 4 — There is no npm test script for E2E (missing/incorrect)
**Section:** Run blocks throughout.

`frontend-next/package.json` scripts are only `dev`, `build`, `start`, `lint` — there is no `test` or `e2e` script. The doc correctly uses raw `npx playwright test`, which is fine, but it never states that there is no npm alias, which can confuse readers expecting `npm test` in the frontend.

**Fix:** Add a one-line note that the frontend has no `npm test`; run Playwright via `npx playwright test`.

### Finding 5 — Backend test count is stale (incorrect, minor)
**Section:** Current count.

Doc says "~28 test files / ~600+ tests". Actual co-located unit test files: **29** (`src/lib`, `src/services`, `src/middleware`, `src/routes`, `src/validation`), plus **6** integration tests under `src/__tests__/` (`auth`, `catalog`, `corporate`, `features`, `pools`, `user`) run via the integration config. The unit `vitest.config.ts` explicitly `exclude`s `src/__tests__/**`, so the two suites are disjoint.

**Fix:** Update to "~29 unit test files (co-located) + 6 integration test files in `src/__tests__/`". Keep the "run to see live total" guidance.

### Finding 6 — Quick Reference local port inconsistent (incorrect, minor)
**Section:** Frontend E2E (local) examples / Quick Reference.

The body uses `BASE_URL=http://localhost:3000` but the Quick Reference block uses `localhost:3001`. `next dev` (frontend `package.json`) defaults to port **3000**. The 3001 reference is inconsistent and likely wrong unless a custom port is documented elsewhere.

**Fix:** Use `localhost:3000` consistently (Next.js default), or document why 3001 would be used.

### Finding 7 — vitest env still points at legacy port 5173 (informational, not a doc error)
**Section:** Backend Unit Tests.

Not a doc defect, but worth a contributor note: `backend/vitest.config.ts` sets `env.FRONTEND_URL: "http://localhost:5173"` (the old Vite dev port; the live frontend is Next.js on 3000). This is harmless test-only config but is the kind of stale value that could confuse readers cross-referencing ports. Optional: add a footnote, or (better) raise as a tiny cleanup outside this doc.

### Finding 8 — Coverage scope is narrow (missing detail)
**Section:** Run → `npm run test:coverage`.

`vitest.config.ts` `coverage.include` is restricted to just `src/lib/email.ts` and `src/services/deadlineReminderService.ts`. So `test:coverage` does NOT report whole-project coverage; it reports only those two files. The doc presents `test:coverage` as a generic "with coverage report" which overstates what it measures.

**Fix:** Note that coverage is currently scoped to `email.ts` + `deadlineReminderService.ts` only (intentional include list), not the whole backend.

---

### Sections that are OK
- Two-layer overview (Vitest unit + Playwright E2E), tools and locations — correct.
- Backend run commands (`npm test`, `test:watch`, `test:coverage`, `test:integration`) match `backend/package.json` exactly.
- Co-location convention + `vi.mock("../db")` guidance — correct.
- Integration tests routed through `vitest.integration.config.ts` (`include: src/__tests__/**`) and run via `npm run test:integration` — correct.
- baseURL defaults to `https://picks4all.com`, override via `BASE_URL`; timeout 30s; screenshot on failure; trace on first retry; HTML report — all match `playwright.config.ts`.
- Page registry (`helpers/pages.ts`) as single source of truth — correct.
- `payments.test.ts` cited as the canonical route-level pattern — file exists at `backend/src/routes/payments.test.ts`.
