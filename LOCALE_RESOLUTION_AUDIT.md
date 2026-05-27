# Locale Resolution — Audit & Design

> Companion to `LOCALE_RESOLUTION_IMPLEMENTATION.md`. This is the "why" doc — every decision below is locked **before** code lands. If we need to change something, edit here first.
>
> Triggered by user report on 2026-05-26: rpasimunt@gmail.com... wait, Santiago Arcila (senriquearcila@hotmail.com) reports that the page stays in English even after he changes the selector to Spanish. Reproduced empirically by the project owner on his own admin account on 2026-05-26 (URL ends at `/en/dashboard` after a click on "Español" with `Accept-Language: en-US`).

---

## 1. Problem statement

When a user manually picks Spanish in the language selector, the page reloads in English. Specifically:

- User completes the modal or clicks the selector → frontend writes `NEXT_LOCALE=es` cookie → frontend navigates to `/dashboard` (no prefix, because ES is `defaultLocale`)
- Backend middleware (`proxy.ts`) skips the cookie-aware redirect because of an asymmetric guard
- next-intl middleware then takes over with `localeDetection: true` (its default) and detects the user's `Accept-Language: en-US`
- next-intl redirects `/dashboard` → `/en/dashboard` (HTTP 307)
- Page renders in English

The user can change to Portuguese without issue because PT URLs carry an explicit `/pt/` prefix and next-intl respects them — the asymmetry only bites the default locale (Spanish), which is the unprefixed variant.

The investigation also surfaced two latent bugs in the same area, which we fix in the same cycle (§2.7, §2.8).

## 2. Verified current state

Every claim below is a file:line citation. No assumptions.

### 2.1 The exact bug mechanism (4 steps, traced through prod code)

1. **`frontend-next/src/components/LanguageSelector.tsx:120`** — on user click, writes `document.cookie = "NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax;Secure"` and navigates to `newPath` (line 123). For ES (default), `newPath` has no prefix (line 116: `next === "es" ? targetPath : "/${next}${targetPath}"`).
2. **`frontend-next/src/proxy.ts:158-171`** — receives `/dashboard`. `pathStartsWithLocale("/dashboard")` is false, `pathMatchesCookieRedirect("/dashboard")` is true, `cookieLocale = "es"`. Then **line 162 asymmetry**: `cookieLocale !== routing.defaultLocale` evaluates to `"es" !== "es"` = `false`. **Redirect skipped.** Falls through to `handleI18nRouting(request)` on line 192.
3. **next-intl middleware** receives `/dashboard`. `routing.localeCookie === false` (`frontend-next/src/i18n/routing.ts:15`) → next-intl does NOT read the cookie. `routing.localeDetection` is **not set** (`routing.ts`) → defaults to `true` → next-intl reads `Accept-Language: en-US, en;q=0.9, …`. Detects `en` as the preferred locale.
4. next-intl with `localePrefix: "as-needed"` issues HTTP 307 → `/en/dashboard`. Page renders in English.

**Confirmed empirically on 2026-05-26** by the project owner replicating the exact flow in Chrome incognito with English-first `Accept-Language`. URL after click `Español`: `https://picks4all.com/en/dashboard`. Network tab shows the 307 redirect.

### 2.2 `setAuthCookies` — definition + call sites

**Definition: `backend/src/lib/authCookies.ts:26-33`**

```ts
export function setAuthCookies(res: Response, jwt: string, opts?: { isAdmin?: boolean }): void {
  res.cookie(COOKIE_NAME, jwt, getCookieOptions());
  res.cookie(LOGGED_IN_COOKIE, "1", getCookieOptions({ httpOnly: false }));
  if (opts?.isAdmin) {
    res.cookie(ADMIN_HINT_COOKIE, "1", getCookieOptions({ httpOnly: false }));
  }
}
```

**Cookie options** (`backend/src/lib/authCookies.ts:12-23`): `httpOnly: true` (overridable), `secure: isProduction`, `sameSite: "lax"`, `path: "/"`, `maxAge: 4h`, `domain: .picks4all.com` (production only).

**Call sites (all 4, all have the full User row available):**

| File:line | Endpoint | Returns `user.locale`? |
|---|---|---|
| `backend/src/routes/auth.ts:149` | `POST /auth/register` | YES (from `serializeUser(newUser)`) but always `null` because register doesn't set locale (audit confirmed against `authService.ts:177` data block — no `locale` field) |
| `backend/src/routes/auth.ts:163` | `POST /auth/login` | YES, real value from DB (loginUser fetches the row) |
| `backend/src/routes/auth.ts:203` | `POST /auth/google` | YES, real value if returning user; `null` for new users (audit confirmed against `authService.ts:441-474` data block — no `locale` field on user.create) |
| `backend/src/routes/auth.ts:276` | `POST /auth/activate-corporate` | YES, real value if existing user; `null` for new users (audit confirmed against `authService.ts:740-749` data block — no `locale` field) |

Every call site has access to `result.user.locale`. **Only `loginUser` returns a non-null value reliably** (returning users). The other three create users with `locale = null` and rely on `LocalePreferenceModal` running afterwards to populate it via `POST /users/me/locale-preference`.

### 2.3 Frontend cookie write — both write sites are identical

**`frontend-next/src/components/LanguageSelector.tsx:120`:**
```js
document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax;Secure`;
```

**`frontend-next/src/components/LocalePreferenceModal.tsx:177`:**
```js
document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax;Secure`;
```

Both: 1-year max-age, SameSite=Lax, Secure. Identical attributes. No mismatches.

### 2.4 `proxy.ts` cookie-aware block — verbatim

**`frontend-next/src/proxy.ts:147-171`:**
```ts
// Step 1b: cookie-aware sticky locale.
const path = request.nextUrl.pathname;
if (!pathStartsWithLocale(path) && pathMatchesCookieRedirect(path)) {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (
    cookieLocale &&
    cookieLocale !== routing.defaultLocale &&    // ← LINE 162 — THE ASYMMETRY
    (routing.locales as readonly string[]).includes(cookieLocale)
  ) {
    const target = new URL(
      `/${cookieLocale}${path}${request.nextUrl.search}`,
      request.nextUrl.origin,
    );
    return NextResponse.redirect(target, 307);
  }
}
```

The current block only handles: "cookie says non-default, URL has no prefix → add prefix". It does NOT handle:
- "cookie says default, URL has prefix → strip prefix" (the bug Santiago hit)
- "cookie says X, URL has Y prefix (X ≠ Y) → reconcile" (a related case if user has stale cookie)

### 2.5 `COOKIE_REDIRECT_PREFIXES` inventory

**`frontend-next/src/proxy.ts:108-120`:**
```ts
const COOKIE_REDIRECT_PREFIXES = [
  // Authenticated app
  "/dashboard", "/profile", "/pools", "/admin", "/pago",
  // Public auth flows
  "/login", "/forgot-password", "/reset-password", "/verify-email",
];
```

**Missing paths that DO exist as authenticated/auth-flow routes** (verified against `routing.ts:76-90, 138-150`):
- `/empresas`, `/empresas/crear` — corporate enterprise pages
- `/activar-cuenta` — corporate employee activation
- `/crear-pool` — standard pool creation wizard
- `/invite` — public invite landing

The current set covers the **most-trafficked authenticated routes**. The locale-correction redirect won't fire for the missing ones, but the impact is bounded — those pages either start the journey (so the cookie won't be set yet) or are short-lived flows.

### 2.6 `localeDetection: false` behavior — verified

**`node_modules/next-intl/dist/types/routing/config.d.ts:36-39`:**
```ts
/**
 * By setting this to `false`, the cookie as well as the `accept-language` header
 * will no longer be used for locale detection.
 * @see https://next-intl.dev/docs/routing/middleware#locale-detection
 */
localeDetection?: boolean;
```

**Confirmed**: with `localeDetection: false` AND `localeCookie: false`, next-intl ignores Accept-Language and the cookie entirely. The only signal it considers is the URL prefix; if absent, it falls back to `defaultLocale`.

### 2.7 Latent bug — logout does not clear `NEXT_LOCALE`

**`backend/src/lib/authCookies.ts:36-45`:**
```ts
export function clearAuthCookies(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  const opts: CookieOptions = {
    path: "/",
    ...(isProduction ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` } : {}),
  };
  res.clearCookie(COOKIE_NAME, opts);
  res.clearCookie(LOGGED_IN_COOKIE, opts);
  res.clearCookie(ADMIN_HINT_COOKIE, opts);
}
```

`NEXT_LOCALE` is NOT cleared. Consequence: if user A logs out on a browser and user B logs in immediately afterwards, user B inherits user A's locale until LanguageSelector or LocalePreferenceModal updates it. Low impact in practice (shared browsers are rare for Picks4All), but a clean fix.

### 2.8 Defensive gap — POST `/users/me/locale-preference` does NOT set `NEXT_LOCALE` server-side

**`backend/src/routes/userProfile.ts:115-186`** — the handler updates DB (`User.locale`, `User.localePromptCompletedAt`) and dispatches deferred emails. It does NOT call `res.cookie("NEXT_LOCALE", …)` on the response. The cookie is set only client-side by `LocalePreferenceModal.tsx:177`.

If the frontend JS fails to run that line (rare but possible — browser extension, JS error mid-handler), the user's choice persists in DB but the cookie is never written. Next page load: DB says "en" but no cookie → middleware can't honour the choice → next-intl falls back to Accept-Language. Same class of bug as the main one.

## 3. Locked decisions

### §3.1 Locale precedence (canonical order)

For **every request that reaches `proxy.ts`**, locale is resolved in this order:

1. **URL prefix** (`/en/`, `/pt/`) — if present, authoritative. The user is explicitly on a localized URL.
2. **`NEXT_LOCALE` cookie** — if present and a valid locale, authoritative for the URL: middleware redirects to match.
3. **`Accept-Language` header** — only for anonymous visitors with no cookie. Manual detection in `proxy.ts`, NOT delegated to next-intl.
4. **`routing.defaultLocale = "es"`** — terminal fallback.

`next-intl` is configured with `localeDetection: false` (new) + `localeCookie: false` (preserved). It only consults the URL prefix and `defaultLocale`. All other signals flow through our custom logic in `proxy.ts`.

### §3.2 SEO preserved — `localeCookie: false` stays

The comment in `routing.ts:7-14` documents the SEO rationale: Set-Cookie on public SSG responses contradicts cacheable headers and Google de-prioritises indexing. **This is non-negotiable per the original decision and we preserve it.** Our manual cookie logic in `proxy.ts` only redirects (no Set-Cookie on the response), so SEO posture is unchanged.

### §3.3 Backend syncs cookie to `User.locale` at login

`setAuthCookies` extended with optional `locale?: string | null` parameter. When provided AND non-null AND a valid `routing.locales` member, it sets `NEXT_LOCALE` on the response with the same attributes as the frontend writes (1-year max-age, Lax, Secure, domain). When `locale` is null (new signups before modal), no `NEXT_LOCALE` is written — the modal will set it client-side and the next request through `proxy.ts` will honour it.

All 4 call sites pass `result.user.locale`. `loginUser` populates it for returning users; `register` / `google` (new user path) / `activate-corporate` (new user path) pass `null` and rely on the modal.

### §3.4 Logout clears `NEXT_LOCALE`

`clearAuthCookies` extended to also call `res.clearCookie("NEXT_LOCALE", opts)`. Closes §2.7.

### §3.5 `POST /users/me/locale-preference` sets cookie server-side

The route handler in `routes/userProfile.ts` calls `res.cookie("NEXT_LOCALE", data.locale, opts)` with the same options as `setAuthCookies` uses for the locale cookie, **before** returning `sendOk`. Defensive — the frontend already writes it on submit, but if JS fails the server has us covered. Closes §2.8.

### §3.6 `COOKIE_REDIRECT_PREFIXES` — left as-is for v1

The missing paths (`/empresas`, `/activar-cuenta`, `/crear-pool`, `/invite`) are bounded-impact. Adding them is a future quality improvement, not part of this bug fix. Out of scope per §3.7.

### §3.7 Out of scope

- ❌ Adding more entries to `COOKIE_REDIRECT_PREFIXES`. The current set covers the user-reported bug path.
- ❌ Embedding `locale` in the JWT payload. Stays in DB + cookie only — `User.locale` is mutable and re-baking the JWT every change is overkill.
- ❌ Cross-device locale sync (user changes locale on phone, expects desktop to follow). Today, each device's `NEXT_LOCALE` cookie is independent. The DB is the eventual source of truth (next login on desktop will pull the latest), which is good enough.
- ❌ Touching the SEO landing pages' Accept-Language detection beyond what `proxy.ts` will do manually. Bots without `Accept-Language` continue to get the default locale.

## 4. Architecture sketch

### 4.1 New `proxy.ts` request flow

```
request /dashboard
   │
   ▼
Step 1: www redirect (unchanged)
   │
   ▼
Step 1b: locale resolution
   │
   ├─ URL has prefix /en/ or /pt/?
   │     YES → cookie says default? → redirect to unprefixed
   │     YES → cookie says different non-default? → redirect to match cookie
   │     YES → cookie matches URL or absent? → keep URL
   │
   │  NO → cookie present + valid?
   │     YES → cookie is default (es)? → keep URL (no redirect)
   │     YES → cookie is non-default? → redirect to `/${cookieLocale}${path}`
   │     NO → cookie absent, fall through to Accept-Language detection
   │
   │  NO cookie:
   │     Accept-Language reads en* → redirect to /en/${path}
   │     Accept-Language reads pt* → redirect to /pt/${path}
   │     Accept-Language reads es* or unknown → keep URL (default)
   │
   ▼
Step 2: handleI18nRouting (now operates with localeDetection: false)
   │     - URL prefix matches a locale? render that locale.
   │     - No prefix? render defaultLocale (es).
   │
   ▼
Step 3: Link header filtering (unchanged)
```

### 4.2 Backend cookie sync

```
POST /auth/login
   ↓
loginUser returns { user: { ..., locale: "en" } }
   ↓
setAuthCookies(res, token, { isAdmin, locale: "en" })
   ↓
res.cookie("p4a_token", ...)
res.cookie("p4a_logged_in", ...)
res.cookie("NEXT_LOCALE", "en", { 1y, Lax, Secure, domain })  ← NEW
   ↓
Response with all cookies set
   ↓
Next request hits proxy.ts → cookie wins → user lands in their locale
```

```
POST /auth/logout
   ↓
clearAuthCookies(res)
   ↓
clearCookie("p4a_token")
clearCookie("p4a_logged_in")
clearCookie("p4a_admin")
clearCookie("NEXT_LOCALE")   ← NEW
   ↓
Browser is clean
```

```
POST /users/me/locale-preference
   ↓
prisma.user.update({ locale, localePromptCompletedAt, welcomeEmailSentAt })
   ↓
res.cookie("NEXT_LOCALE", data.locale, { 1y, Lax, Secure, domain })  ← NEW
   ↓
fireAndForget welcome email + return sendOk
```

## 5. Open questions

None at locking time. Empirical reproduction by the project owner confirmed the bug mechanism end-to-end. All 8 sub-decisions in §3 confirmed via the AskUserQuestion exchange on 2026-05-26.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `localeDetection: false` breaks auto-detection for new anonymous visitors | The manual Accept-Language fallback in `proxy.ts` reproduces what next-intl did before, with predictable code we control. |
| Loop between `proxy.ts` redirect and next-intl redirect | next-intl with `localeDetection: false` won't redirect any unprefixed URL — it serves defaultLocale. No loop possible. |
| Backend sets `NEXT_LOCALE` but with wrong attributes vs frontend | We mirror the frontend's exact attributes (Path=/; 1-year; SameSite=Lax; Secure; production domain). Audit §2.3 + §3.3 keeps them in sync explicitly. |
| Anonymous visitors land on /dashboard with no cookie and no Accept-Language hint | Falls through to defaultLocale (es). Same as today; no regression. |
| User with stale `NEXT_LOCALE=en` cookie from a previous account on the same browser logs in as a new ES user | New login overwrites the cookie via `setAuthCookies` (§3.3). Clean. |
| User logs in but their User.locale is `null` (signed up but never completed modal) | `setAuthCookies` skips the cookie write. Modal will run on next authenticated layout mount and populate both DB + cookie. |
| Frontend extension or JS failure prevents the modal/selector's `document.cookie = …` from running | `POST /users/me/locale-preference` now also sets the cookie server-side (§3.5). Double safety net. |

## 7. Acceptance criteria

After all commits land:

- [ ] Santiago's exact reproduction (Chrome incognito + Accept-Language en-US + URL /en/dashboard + click "Español") results in **URL `/dashboard` (no prefix) + UI in Spanish + cookie `NEXT_LOCALE=es`**. No HTTP 307 redirect to `/en/`.
- [ ] Cross-locale: same flow but click "Português" → URL `/pt/dashboard` + UI in Portuguese + cookie `NEXT_LOCALE=pt`.
- [ ] Returning ES user logs in via `POST /auth/login` → `Set-Cookie: NEXT_LOCALE=es` in the response headers.
- [ ] New signup via `POST /auth/register` (locale = null) → NO `NEXT_LOCALE` Set-Cookie in the response.
- [ ] Logout (`POST /auth/logout`) → `Set-Cookie: NEXT_LOCALE=; Max-Age=0` in the response (clearing it).
- [ ] `POST /users/me/locale-preference` with `locale: "en"` → `Set-Cookie: NEXT_LOCALE=en; Max-Age=31536000; …` in the response.
- [ ] Anonymous visitor with Accept-Language=en-US lands on `picks4all.com/` → middleware redirects to `/en` (auto-detection preserved manually).
- [ ] Anonymous visitor with Accept-Language=es-CO lands on `picks4all.com/` → no redirect, stays on default Spanish.
- [ ] Bot (no Accept-Language, no cookie) lands on `/` → default Spanish.
- [ ] Type-check + Next build pass cleanly.
- [ ] ADR-064 + BUSINESS_RULES.md §17 + CLAUDE.md invariant 12 + MEMORY entry land.

## 8. Document version

- v1 — 2026-05-26 — initial draft after empirical bug reproduction on the project owner's admin account + Explore-agent forensic verification of all 8 affected sites.
