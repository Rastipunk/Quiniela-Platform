## Audit: README.md

**Verdict:** keep (update) — Severity: minor. The README is a high-level overview and is overwhelmingly accurate against the shipped code. Tech-stack versions, tournaments, payment dual-gateway, scraper-first scoring, i18n locales, scoring presets, project structure, and the docs/guides table all match the real repo. One material error (License) and a couple of minor omissions are the only issues.

### License — incorrect (material)
- **What's wrong:** README line 99-101 states `## License` / `MIT`. The actual root `LICENSE` file is a proprietary "All rights reserved" license: *"No permission is granted to use, copy, modify... without explicit written permission from the copyright holder."* `backend/package.json` also declares `"license": "SEE LICENSE IN LICENSE"` (not MIT). This is a legally significant contradiction.
- **Fix:** Replace the `MIT` line with a statement matching `LICENSE`, e.g. "Proprietary — all rights reserved. Source is published for transparency/educational purposes only. See [LICENSE](LICENSE)."

### Features → Scoring — ok
- "4 preset modes (Basic, Cumulative, Simple, Custom)" is accurate. `frontend-next/src/components/scoring-editor/presets.ts` exposes exactly four keys: `CUMULATIVE`, `BASIC`, `SIMPLE`, `CUSTOM` (backend `pickPresets.ts` ships the first three as hardcoded configs; CUSTOM is the editor's free-form mode). Note: do not confuse with `backend/src/lib/scoringPresets.ts` (CLASSIC/OUTCOME_ONLY/EXACT_HEAVY) which is a separate legacy score-pick preset set — README correctly references the pick-preset family.

### Features → Results — ok
- "Scraper-first live scoring (picks4all-scores) with API-Football as fallback. Host can override with justification" matches `backend/src/services/scoresService/*` (primary) and `resultSync/service.ts` (API-Football described as "the FALLBACK source behind the scraper" in part-12). Override-with-justification is implemented (ScoringOverrideModal + results route).

### Features → Tournaments — ok
- FIFA World Cup 2026 (48 teams, 12 groups A–L) and UEFA Champions League 2025-26 confirmed by `seedWc2026Sandbox.ts` and `seedUcl2025.ts` (part-07).

### Features list — missing (minor)
- The Features list omits the **Sales / Cuenta de Cobro + Quote system** (ADR-061), a fully shipped admin subsystem: `backend/src/services/sales/*` (quoteService, accountReceivableService, documentCounterService), `routes/adminSales.ts`, `routes/salesRedemption.ts`, PDF generation in `backend/src/pdf/` (QuoteDocument/CcDocument), and admin UI under `frontend-next/src/app/[locale]/(authenticated)/admin/ventas/`. It is an internal/back-office capacity-sales flow, so its absence from a customer-facing feature list is defensible, but a one-liner (e.g. "Sales — admin quote + cuenta-de-cobro flow for pre-paid pool capacity") would make the overview complete.
- **Fix (optional):** add a "Sales" bullet, or leave out if README is intentionally end-user-facing only.

### Tech Stack table — ok
- Next.js 16 (`next 16.1.6`), React 19 (`react 19.2.3`), next-intl v4 (`^4.8.3`), Express 5 (`^5.2.1`), Prisma 6.19 (`^6.19.3`), PostgreSQL 16 (`infra/docker-compose.yml` → `postgres:16`). Mercado Pago + Polar.sh dual gateway, Resend + Cloudflare Email Routing, GA4/GTM + GA4 MP/Meta CAPI, Railway, Cloudflare — all match the shipped code/services. No obsolete entries (no Wompi, no Lemon Squeezy, no port-5173 frontend).

### Project Structure tree — ok
- All listed dirs exist: `backend/{prisma,src/{routes,services,lib,middleware,jobs,scripts}}`, `frontend-next/src/{app,components,lib,messages,data}`. `messages/` holds `es/en/pt`. `data/` holds `teamFlags.ts` + `languages.ts`. The jobs note ("live scores, SmartSync, deadline reminders, phase sync, CAPI retry") is a representative subset; the repo also has reconcilers (Polar + MP), new-member digest, welcome-email fallback, fixture tracking/verification, AR-expiry — not wrong, just non-exhaustive, which is fine for a tree comment.

### Documentation table — ok
- Every referenced doc exists: top-level `docs/{PRD,ARCHITECTURE,DATA_MODEL,API_SPEC,BUSINESS_RULES,GLOSSARY,DECISION_LOG}.md`, root `CLAUDE.md`/`TECH_DEBT.md`/`CHANGELOG.md`, and all 10 `docs/guides/*.md` links (SETUP, DEPLOYMENT, EMAIL_SYSTEM, TOURNAMENT_SYSTEM, SCORES_INTEGRATION, PREDICTION_UPDATES, GOOGLE_OAUTH, ATTRIBUTION_TAXONOMY, ANALYTICS_PIPELINE, TESTING). PREDICTION_UPDATES is correctly described as "AI prediction updates + subscriber notifications" (guide title is "AI Prediction Update Process").
