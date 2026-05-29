## Audit: docs/guides/SETUP.md

**Verdict: update (minor)** — The guide is largely accurate and reflects the dual-gateway, analytics, and seed reality. A handful of concrete drifts: the `/health` JSON shape omits `ok: true`, the `FRONTEND_URL` documented default contradicts the code default (`5173`), the Windows-incompatible `PORT=3001 npm run dev` shell idiom, and the documented `.env.example` is far richer than the real file (real `.env.example` lacks MP/Polar/GA4/Meta/scores/notification vars). No obsolete payment processors (Wompi/Lemon Squeezy) leak into this doc.

---

### Prerequisites table — ok
Node 22+ matches `backend/package.json` (`engines.node: ">=22"`). PostgreSQL 16 matches `infra/docker-compose.yml` (`image: postgres:16`). No issue.

### Section 2 (Docker DB credentials) — ok
`infra/docker-compose.yml` confirms user `quiniela`, password `quiniela_pass`, db `quiniela_db`, port 5432. Container name is `quiniela_postgres` (not mentioned, fine). Accurate.

### Section 3.1 — Required vars — ok
`backend/src/lib/env.ts` confirms `DATABASE_URL` (min 1) and `JWT_SECRET` (min 16 chars). The "minimum 16 characters" note is exactly right.

### Section 3.1 — FRONTEND_URL default — incorrect
Doc says `FRONTEND_URL` "default: `http://localhost:3001`". Real code default in `backend/src/lib/env.ts:15` is `http://localhost:5173` (a leftover Vite-era port). Either fix the code default to `3001` or fix the doc to state the actual default. The doc's intent (frontend on 3001) is correct, but the stated default does not match the code.

### Section 3.1 — Optional vars table vs real .env.example — incorrect / missing
The doc instructs `cp .env.example .env` (3.1) and then lists `MP_ACCESS_TOKEN/MP_PUBLIC_KEY/MP_WEBHOOK_SECRET`, `POLAR_API_KEY/POLAR_WEBHOOK_SECRET`, `SCORES_SERVICE_URL/SCORES_SERVICE_API_KEY`, `GA4_MEASUREMENT_ID/GA4_API_SECRET`, `META_PIXEL_ID/META_CAPI_ACCESS_TOKEN`, `BRAND_COLORS_JSON`. These env-var NAMES are all real (confirmed used in `services/mercadopago/client.ts`, `services/polar/client.ts`, `services/scoresService/client.ts`, `lib/ga4.ts`/`lib/metaCapi.ts` via `env.ts:warnMissingAnalyticsVars`, and `lib/brand.ts`). BUT the actual `backend/.env.example` only contains: `DATABASE_URL, JWT_SECRET, PORT, FRONTEND_URL, GOOGLE_CLIENT_ID, RESEND_API_KEY, RESEND_FROM_EMAIL, API_FOOTBALL_KEY, API_FOOTBALL_ENABLED, SMART_SYNC_ENABLED, RESULT_SYNC_ENABLED, TEST_*`. So copying `.env.example` will NOT surface any payment/analytics/scores vars. Fix: either (a) update `.env.example` to include the documented optional vars (recommended), or (b) note in the doc that these must be added manually since `.env.example` does not contain them. Also note: the doc omits `RESULT_SYNC_ENABLED` and the per-category notification inboxes (`ADMIN_NOTIFICATION_EMAIL`, `SUPPORT_NOTIFICATION_EMAIL`, `ENTERPRISE_NOTIFICATION_EMAIL`, `SALES_NOTIFICATION_EMAIL`) which are validated in `env.ts:23-26`.

### Section 3.1 — SMART_SYNC_ENABLED description — minor
Doc says it enables "the API-Football fallback cron." Accurate in spirit. There is also a separate `RESULT_SYNC_ENABLED` (in `.env.example` and not in the doc) governing result sync; worth listing alongside.

### Section 3.3 — Seed scripts — ok (one nuance)
All four scripts exist in `package.json` (`seed:admin`, `seed:test-accounts`, `seed:legal`, `seed:wc2026-sandbox`) plus `seed:ucl2025`. `seedLegalDocuments.ts` seeds `TERMS_OF_SERVICE` + `PRIVACY_POLICY` (LegalDocumentType) — matches "terms v1, privacy v1". WC2026 sandbox config shows 12 groups × 4 teams = 48 teams and stage configs summing to group stage + 16+8+4+2+2 knockout matches; the "104 matches" claim is plausible for a 48-team format — not contradicted, leave as-is unless precise count is verified. `seed:ucl2025` exists; the "45 matches" figure is not independently confirmed here but the script is real.

### Section 3.5 — /health response shape — incorrect
Doc shows `{ "version": "v1.0.0", "commit": "local", "timestamp": "..." }`. Real handler (`server.ts:89-94`) calls `sendOk(res, {...})`, and `lib/apiResponse.ts:28-33` spreads into `{ ok: true, ...extra }`. So the actual response is `{ "ok": true, "version": "v1.0.0", "commit": "local", "timestamp": "..." }`. `version` (`v1.0.0`) and `commit` (`local` when `RAILWAY_GIT_COMMIT_SHA` unset) are correct. Fix: add `"ok": true` to the documented sample.

### Section 4.1 — Frontend env vars — ok
`NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` all consistent with the frontend lib (gtm.ts/metaPixel.ts/api/client.ts). The note that legacy `NEXT_PUBLIC_GA_ID` is no longer read and GA4 loads via GTM is consistent with `env.ts:101-102` ("NEXT_PUBLIC_GTM_ID must be set on the FRONTEND service at BUILD time"). Pricing/limit vars are plausible. No contradiction found.

### Section 4.2 + Section 5 (Port conflict) — incorrect (Windows) / obsolete idiom
Doc instructs `PORT=3001 npm run dev`. This is a POSIX/bash idiom and FAILS in PowerShell (the repo's documented shell per MEMORY/env). On Windows the equivalent is `$env:PORT=3001; npm run dev` (or cross-env). `frontend-next/package.json` `dev` script is plain `next dev` (defaults to 3000), so the PORT override is the only mechanism. Fix: provide both a bash form and a PowerShell form, since the project is developed on Windows 11.

### Section 6 — Useful Commands — incorrect (one entry)
Backend: `npm run dev`, `npm run build`, `npm test`, `npm run test:watch` all exist in `backend/package.json`. Frontend: `npm run dev`, `npm run build` exist; **`npm run lint` maps to `"lint": "eslint"`** (bare `eslint`, not `next lint`) — the description "Run ESLint" is fine. No `start` discrepancy. Minor: backend also has `test:integration`, `test:coverage`, `init:smart-sync`, and several `script:*` helpers worth mentioning, but their omission is not an error.

### Duplication — none significant
This is the only local-dev setup guide; no overlap detected with `docs/sot/` (which are SoT specs, not setup steps). No action.
