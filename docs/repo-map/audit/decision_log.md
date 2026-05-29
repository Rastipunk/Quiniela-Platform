## Audit: docs/DECISION_LOG.md

**Overall verdict: UPDATE (minor).** The body of the ADL is, surprisingly, almost fully current: it carries 66 ADRs through 2026-05-28 and correctly marks the big supersessions (ADR-036→044 for Lemon Squeezy→Polar, ADR-031/043→052 for API-Football→scraper-first). Dual-gateway payments (ADR-044/053), the sales/CC system (ADR-061), locale resolution (ADR-064), payment parity (ADR-065), and payment-attempt telemetry (ADR-066) are all documented and verified against `schema.prisma` and the route tree. The defects are concentrated in (1) the front-matter **Decision Index table** which is stale at ADR-038, (2) the **"Last Updated" header**, and (3) a handful of **early ADRs** that still describe pre-Next.js / pre-cookie-auth realities as "current" without a superseded marker. No invented problems; the prose is largely accurate.

---

### Decision Index table — obsolete (structural)
**Section:** "Decision Index" table, lines ~67-107.
**Type:** obsolete / missing.
**What's wrong:** The index table stops at `ADR-038`. The document body contains ADR-039 through ADR-066 (verified via heading scan: 28 ADRs are missing from the index). A reader using the index believes the log ends at v0.6.0 cleanup (March), when it actually runs through the May 28 payment-telemetry work. ADR-031's own status line even references "Superseded by ADR-052" — an ADR not in the index.
**Fix:** Regenerate the index table to include ADR-039…ADR-066 with their real status (note the Superseded entries: 031, 036, 043). Or drop the hand-maintained table in favor of an auto-generated TOC, since it has demonstrably drifted.

### "Last Updated" header — incorrect
**Section:** Front matter, line 8 (`**Last Updated:** 2026-05-03`).
**Type:** incorrect.
**What's wrong:** ADR-064/065/066 are dated 2026-05-26 / 2026-05-28. The header is ~3 weeks stale.
**Fix:** Set to 2026-05-28.

### ADR-004 (JWT) — partially obsolete: auth moved to httpOnly cookies
**Section:** ADR-004 JWT for Authentication.
**Type:** obsolete.
**What's wrong:** The 4h HS256 expiry is correct (`backend/src/lib/jwt.ts:15` — `expiresIn: "4h", algorithm: "HS256"`). But the surrounding framing ("Token theft risk (XSS)", token carried by client, "Implementation Notes" implying header-based bearer) predates the cookie migration. Auth is now httpOnly-cookie based: `setAuthCookies`/`clearAuthCookies` in `backend/src/lib/authCookies.ts`, and `frontend-next/src/lib/auth.ts` treats `quiniela.token` localStorage keys as `LEGACY_TOKEN_KEY` that are *cleared on first load*. ADR-064 (cookie sync of `NEXT_LOCALE` alongside auth cookies) confirms cookies are the live mechanism.
**Fix:** Add a "Superseded in part by ADR-064 (cookie-based session)" note, or a short addendum clarifying tokens are delivered via httpOnly cookies, not localStorage/Authorization header.

### ADR-016 (No state mgmt) — obsolete code sample
**Section:** ADR-016 React Without State Management Library, Implementation Notes.
**Type:** obsolete.
**What's wrong:** The sample shows `const TOKEN_KEY = 'quiniela.token'; localStorage.getItem(TOKEN_KEY)` and a `quiniela:auth` custom event as the current auth-state pattern. `quiniela.token` is now a legacy key cleared on load (`frontend-next/src/lib/auth.ts:16`). The decision itself (no Redux/Zustand) is still broadly true, but the illustrative auth code is dead.
**Fix:** Replace the localStorage snippet with the current cookie/`useAuth` hook pattern, or mark the snippet historical.

### ADR-025 / ADR-026 — obsolete dev-setup details (Vite, port 5173, VITE_ env, localStorage token)
**Section:** ADR-025 (Password Reset) and ADR-026 (Google OAuth), Implementation/Setup sections.
**Type:** obsolete.
**What's wrong:** ADR-026 references `VITE_GOOGLE_CLIENT_ID`, `import.meta.env`, `http://localhost:5173` authorized origin, and `frontend/.env` — all Vite-era. The frontend is Next.js (ADR-033); env vars are `NEXT_PUBLIC_*`. ADR-026 also links `docs/GOOGLE_OAUTH_SETUP.md` and ADR-026's "Frontend ([login/page.tsx])" path — `GOOGLE_OAUTH_SETUP.md` does not exist in the repo (Glob returned nothing). ADR-025's "no rate limiting (user can spam reset requests)" negative is contradicted by ADR-028 which adds a 5/hour password-reset limiter (the ADR-025 "Risks" line does acknowledge this as mitigated, so it's borderline, but the "Negative" bullet is stale).
**Fix:** Update ADR-026 to Next.js terms (NEXT_PUBLIC_GOOGLE_CLIENT_ID, no port 5173, no `import.meta.env`); remove or correct the dead `GOOGLE_OAUTH_SETUP.md` link. In ADR-025 drop the "No rate limiting" negative (superseded by ADR-028).

### ADR-001 / Implementation-Notes monorepo tree — minor incorrect
**Section:** ADR-001 Monorepo Structure, Implementation Notes.
**Type:** incorrect (minor).
**What's wrong:** The tree shows `frontend/`. The live frontend directory is `frontend-next/` (the old `/frontend` Vite SPA was retired per ADR-033). Several early ADRs also write `frontend/src/...` paths that no longer resolve.
**Fix:** Update the tree to `frontend-next/`. Optionally add a one-line note that `frontend/` (Vite SPA) was replaced by `frontend-next/` in ADR-033.

### ResultSource enum / scraper-first — OK (verified)
**Section:** ADR-031, ADR-043, ADR-052.
**Type:** ok.
**What's wrong:** Nothing. `schema.prisma:284-289` defines exactly `HOST_MANUAL, HOST_PROVISIONAL, API_CONFIRMED, HOST_OVERRIDE, SCRAPER_PROVISIONAL`, matching ADR-052's claim that `SCRAPER_PROVISIONAL` was added additively and `API_CONFIRMED` retained as the canonical "final" tag. The Superseded markers on 031/043 are correct.

### Payments / sales / locale late-ADRs — OK (verified)
**Section:** ADR-044, ADR-051, ADR-053, ADR-060, ADR-061, ADR-062, ADR-063, ADR-064, ADR-065, ADR-066.
**Type:** ok.
**What's wrong:** Nothing material. Schema fields cited are all present: `PoolPayment.mpPaymentId` (1318), `PoolPayment.accountReceivableId` UNIQUE + relation (1331-1332), `PoolPayment.amountCop` (1281), `Organization.invitationLocale @default("es")` (1094), `User.welcomeEmailSentAt` (133), `PlatformSettings.scoresServiceEnabled @default(false)` (847), `Pool.capacityWarningThresholdPct` (435). Routes `adminSales.ts`, `salesRedemption.ts`, `adminAnalyticsDashboard.ts`, `resendWebhook.ts`, `analyticsHealth.ts` all exist. These ADRs are current and accurate.

### "Future Decisions" section — minor duplication / drift
**Section:** "Future Decisions (To Be Documented)" block (~lines 3887-3922), sitting between ADR-039 and ADR-040.
**Type:** duplication / obsolete.
**What's wrong:** This checklist re-lists ADR-027 through ADR-043 as "[x] done" — duplicating the (stale) index and the body, and it stops at ADR-043, so it's both redundant and incomplete. It's wedged oddly mid-document (after ADR-039, before ADR-040).
**Fix:** Delete this block; the index table (once regenerated) and the ADR bodies are the single source of truth. At minimum, move it to the end and stop double-maintaining status.

### Template "Status" enum vs usage — OK
**Section:** "How to Use This Document" template.
**Type:** ok.
**What's wrong:** Nothing. The template lists Proposed/Accepted/Deprecated/Superseded; the body uses "Superseded by ADR-NNN" and "Accepted" consistently. No action.
