## Audit: docs/guides/GOOGLE_OAUTH.md

**Overall verdict: keep (minor edits).** This guide is a Google Cloud Console setup walkthrough plus app wiring instructions. It matches the shipped implementation almost exactly. Every load-bearing technical claim was verified against real source:

- Backend env var `GOOGLE_CLIENT_ID` — confirmed in `backend/src/lib/googleAuth.ts:4`, `backend/src/lib/env.ts:29` (`z.string().optional()`), and `backend/.env.example:12`.
- Frontend env var `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — confirmed in `frontend-next/src/app/[locale]/login/LoginContent.tsx:141` and `frontend-next/src/components/AuthSlidePanel.tsx:202`.
- The exact warning string `⚠️  GOOGLE_CLIENT_ID no configurado. Google OAuth NO funcionará.` — confirmed verbatim in `backend/src/lib/googleAuth.ts:7`.
- Audit actions `LOGIN_GOOGLE` / `REGISTER_GOOGLE` — confirmed in `backend/src/services/authService.ts:404` and `:478`.
- FedCM-disabling troubleshooting (`use_fedcm_for_prompt: false`) — confirmed live in `frontend-next/src/app/[locale]/login/LoginContent.tsx:158` (comment "Safari no soporta FedCM bien") and in `AuthSlidePanel.tsx`. Also recorded in CHANGELOG.md:493 and DECISION_LOG.md:3525.
- "Same Client ID in backend and frontend" — correct; backend uses it as the `verifyIdToken` audience (`googleAuth.ts:32-35`), frontend uses it to init Google Identity Services.

This guide is OAuth-specific and does NOT overlap problematically with the payments/sales/locale subsystems, so the usual "missing dual-gateway / sales / reconciler" findings do not apply here.

### Finding 1 — Verification steps tell you to start the frontend with bare `npm run dev` (will hit a port conflict)

- **Section:** "✅ Verificar la Configuración → 2. Frontend" (lines 156-162)
- **Type:** incorrect
- **What's wrong:** The doc says to run `cd frontend-next && npm run dev` and then visit `http://localhost:3001`. But `frontend-next/package.json` defines `"dev": "next dev"` with no `-p` flag, so `next dev` binds to port **3000** by default — the same port the backend uses (`backend/.env.example:8` `PORT=3000`). `docs/guides/SETUP.md:187-193` explicitly documents this: "The backend already occupies port 3000, so the frontend goes on 3001 … `PORT=3001 npm run dev` … If you launch with the default `npm run dev` (no `PORT`) you'll see a port-conflict error." So following this guide's bare `npm run dev` while the backend is running produces a conflict, and the app will NOT be at 3001.
- **Fix:** Change the frontend start command to `PORT=3001 npm run dev` (matching SETUP.md), or add a note that the frontend must be launched on 3001 because the backend occupies 3000.

### Finding 2 — Parenthetical port hints are correct but lean on an undocumented default

- **Section:** "4.1 Configurar el Cliente OAuth" (lines 86-91) and Troubleshooting (line 217)
- **Type:** ok (with caveat)
- **What's wrong:** The doc lists `http://localhost:3001` as the authorized JavaScript origin and annotates "(puerto del frontend; el backend usa 3000)". This is consistent with the canonical local-dev convention in SETUP.md:170 (`NEXT_PUBLIC_SITE_URL=http://localhost:3001`) and SETUP.md:240 (Google Console must have `http://localhost:3001`). No change required to the port value itself — only Finding 1's launch command needs fixing so the user actually lands on 3001.

### Finding 3 — "Google+ API" enablement step is stale Google guidance (cosmetic)

- **Section:** "2. Habilitar Google+ API (Opcional pero recomendado)" (lines 25-32)
- **Type:** obsolete (external, not code)
- **What's wrong:** Google+ API was shut down by Google in 2019; the modern flow uses Google Identity Services (the `gsi/client` script this app actually loads). The app verifies ID tokens via `google-auth-library` and never touches the Google+ API. The step is harmless (it's marked optional) but misleading.
- **Fix:** Remove the Google+ API section or replace it with a note that no extra API needs enabling for Google Identity Services / Sign-In with Google.

### Finding 4 — "Mejoras futuras (v2.0)" still lists desvinculación / multi-provider as not done

- **Section:** "✨ Siguientes Pasos → 3. Mejoras futuras (v2.0)" (lines 286-289)
- **Type:** ok
- **What's wrong:** Nothing — confirmed the codebase has no Google account-unlink endpoint, no additional OAuth providers, and no passwordless flow. The "future" list is accurate.

### Notes / non-issues
- The "Last Updated: 2026-05-04" stamp matches the v1.0.0 doc-audit date in MEMORY; content is current.
- The example log line `✅ Email enviado: ...` alongside `LOGIN_GOOGLE o REGISTER_GOOGLE` (lines 176-179) is illustrative; the audit action names are real, the email line is just sample output. Acceptable.
- `env.ts:15` still defaults `FRONTEND_URL` to the legacy Vite port `http://localhost:5173`, but this guide never references 5173, so it is not a defect of THIS doc (flag it against env.ts / SETUP instead).
