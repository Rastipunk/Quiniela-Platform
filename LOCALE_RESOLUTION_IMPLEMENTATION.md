# Locale Resolution — Implementation Tracker

> Companion to `LOCALE_RESOLUTION_AUDIT.md`. This is the per-commit checklist. Update the status emoji + SHA as each commit lands so the work survives context breaks.
>
> Every locked decision is in `LOCALE_RESOLUTION_AUDIT.md` §3. Re-check that section before changing anything in this file's scope.

---

## Status legend

- 🟥 PENDING — not started
- 🟧 IN PROGRESS — partially written, not yet merged
- 🟩 DONE — committed + pushed + type-check passes
- ⚪ DEFERRED — out of scope for this cycle

## Commits at a glance

| # | Title | Status | SHA |
|---|---|---|---|
| 1 | Frontend: `localeDetection: false` in `routing.ts` + comment | 🟩 DONE | `cbdb7dd` |
| 2 | Frontend: rewrite cookie-aware locale resolution in `proxy.ts` (precedence: URL prefix > cookie > Accept-Language > default) | 🟩 DONE | `215aa0d` |
| 3 | Backend: `setAuthCookies` accepts optional `locale`; `clearAuthCookies` clears `NEXT_LOCALE` | 🟩 DONE | `6d1f925` |
| 4 | Backend: 4 auth route handlers pass `user.locale` to `setAuthCookies`; `POST /users/me/locale-preference` sets cookie server-side | 🟩 DONE | `3c5baa1` |
| 5 | Docs: ADR-064 + BUSINESS_RULES §17 + CLAUDE.md invariant 12 + MEMORY entry | 🟩 DONE | (this commit) |

After commit 4 the bug is functionally fixed end-to-end. Commit 5 is documentation hygiene.

---

## Pre-flight

- [x] Audit doc reviewed.
- [x] Bug reproduced empirically on owner's admin account (URL `/en/dashboard` after click `Español`, with Accept-Language=en-US).
- [x] All 8 sub-decisions in audit §3 confirmed.
- [ ] User says "go" for commit 1.

---

## 1 — Commit 1: `localeDetection: false`

**Goal**: stop next-intl from doing Accept-Language detection. Our manual logic in `proxy.ts` (commit 2) becomes the sole detection authority.

### 1.1 Files

- `frontend-next/src/i18n/routing.ts` — add one option to the config.

### 1.2 Exact diff

```diff
 export const routing = defineRouting({
   locales: ["es", "en", "pt"],
   defaultLocale: "es",
   localePrefix: "as-needed",
   // Disable next-intl's automatic NEXT_LOCALE cookie write. ...
   localeCookie: false,
+  // Disable next-intl's Accept-Language auto-redirect. Combined with
+  // localeCookie:false above, next-intl now only consults URL prefix +
+  // defaultLocale. All other signals (cookie, Accept-Language) flow
+  // through our manual logic in `proxy.ts` so we keep one source of
+  // truth for locale resolution. See LOCALE_RESOLUTION_AUDIT.md §3.1.
+  localeDetection: false,
   pathnames: { ... },
 });
```

### 1.3 Acceptance

- [ ] `npx tsc --noEmit` in frontend passes.
- [ ] `npx next build` succeeds.
- [ ] **Critical: after deploy, navigating to `/dashboard` with Accept-Language=en-US (and no `NEXT_LOCALE` cookie) should NOT redirect to `/en/dashboard`** — instead the page renders in Spanish (defaultLocale). This is the inverse of the original bug; we deliberately want auto-detection OFF so commit 2's manual logic owns it.

  ⚠️ This commit ALONE breaks anonymous Accept-Language detection. Commit 2 immediately follows to restore it manually. Deploy these two together (commit 2 before letting traffic hit prod). Local dev acceptable.

### 1.4 Commit message template

```
feat(locale): disable next-intl auto Accept-Language redirect

Adds `localeDetection: false` to the routing config so next-intl only
consults URL prefix + defaultLocale. Combined with localeCookie:false
already in place, this removes the conflict where a manually-set
NEXT_LOCALE cookie gets overridden by Accept-Language.

The auto-detection logic moves to proxy.ts in the next commit, where
we control the precedence (URL > cookie > Accept-Language > default)
in one place.

See LOCALE_RESOLUTION_AUDIT.md §3.1 for the locked precedence rule.
Tracks LOCALE_RESOLUTION_IMPLEMENTATION.md commit 1.

Co-Authored-By: …
```

### 1.5 Status

🟥 PENDING — SHA: —

---

## 2 — Commit 2: rewrite cookie-aware logic in `proxy.ts`

**Goal**: implement the full precedence (URL prefix > cookie > Accept-Language > default) in one block. Replaces the asymmetric `cookieLocale !== routing.defaultLocale` guard.

### 2.1 Files

- `frontend-next/src/proxy.ts` — rewrite the Step 1b block (lines 147-171). Keep Step 1 (www redirect), Step 2 (handleI18nRouting), Step 3 (Link header filtering) intact.

### 2.2 New logic — pseudocode

```
const path = request.nextUrl.pathname;
const urlLocale = extractUrlLocalePrefix(path); // "en" | "pt" | null
const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
const cookieIsValid = cookieLocale && locales.includes(cookieLocale);

// Only apply to paths in COOKIE_REDIRECT_PREFIXES (auth/auth-flow paths).
// Public SEO pages keep falling through to handleI18nRouting unchanged.
if (pathMatchesCookieRedirect(stripLocalePrefix(path))) {
  // Step A: cookie present and valid → it wins.
  if (cookieIsValid) {
    const desiredUrlLocale =
      cookieLocale === defaultLocale ? null : cookieLocale;
    const currentUrlLocale = urlLocale;
    if (desiredUrlLocale !== currentUrlLocale) {
      // Mismatch — redirect.
      const stripped = stripLocalePrefix(path);
      const target = desiredUrlLocale
        ? `/${desiredUrlLocale}${stripped}`
        : stripped;
      return NextResponse.redirect(new URL(target + search, origin), 307);
    }
    // URL and cookie agree → no-op, fall through.
  }
  // Step B: no cookie → manual Accept-Language detection.
  else if (!urlLocale) {
    const detected = detectLocaleFromAcceptLanguage(
      request.headers.get("accept-language"),
    );
    if (detected && detected !== defaultLocale) {
      const target = `/${detected}${path}`;
      return NextResponse.redirect(new URL(target + search, origin), 307);
    }
    // detected is default or null → fall through (defaultLocale handles it).
  }
  // Step C: cookie absent, URL has prefix → respect URL, fall through.
}

return handleI18nRouting(request);
```

### 2.3 New helpers (added in same file)

```ts
function extractUrlLocalePrefix(path: string): string | null {
  for (const l of routing.locales) {
    if (path === `/${l}` || path.startsWith(`/${l}/`)) return l;
  }
  return null;
}

function stripLocalePrefix(path: string): string {
  const p = extractUrlLocalePrefix(path);
  if (!p) return path;
  const after = path.slice(p.length + 1);
  return after === "" ? "/" : after;
}

function detectLocaleFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  // Parse "en-US,en;q=0.9,es;q=0.8" → ["en-US","en","es"] in priority order.
  const langs = header
    .split(",")
    .map((part) => part.split(";")[0]!.trim().toLowerCase())
    .filter(Boolean);
  for (const lang of langs) {
    // Match by primary subtag: "en-US" → "en", "pt-BR" → "pt".
    const primary = lang.split("-")[0]!;
    if ((routing.locales as readonly string[]).includes(primary)) {
      return primary;
    }
  }
  return null;
}
```

### 2.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] `npx next build` succeeds, 140+ static pages emit.
- [ ] **Critical reproductions (matches AUDIT §7):**
  - Chrome incognito + Accept-Language=en-US + URL `/en/dashboard` + click "Español" → URL `/dashboard` (no prefix) + UI in Spanish + cookie `NEXT_LOCALE=es`. NO 307 to `/en/`.
  - Same setup + click "Português" → URL `/pt/dashboard` + UI Portuguese.
  - Chrome incognito + Accept-Language=en-US + URL `picks4all.com/` (no path) → redirect to `/en` (anonymous Accept-Language fallback preserved).
  - Same with Accept-Language=es → no redirect, stays at `/`.
  - Bot (no Accept-Language) → no redirect, default Spanish.

### 2.5 Status

🟥 PENDING — SHA: —

---

## 3 — Commit 3: extend `authCookies.ts`

**Goal**: backend gains the ability to write `NEXT_LOCALE` alongside `p4a_token`, and `clearAuthCookies` clears it.

### 3.1 Files

- `backend/src/lib/authCookies.ts` — extend `setAuthCookies` signature; extend `clearAuthCookies` body.

### 3.2 Diff sketch

```diff
+import type { CookieOptions } from "express";
+
+const NEXT_LOCALE_COOKIE = "NEXT_LOCALE";
+const NEXT_LOCALE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — mirrors frontend write
+const SUPPORTED_LOCALES = ["es", "en", "pt"] as const;
+
+function getLocaleCookieOptions(): CookieOptions {
+  const isProduction = process.env.NODE_ENV === "production";
+  return {
+    httpOnly: false,         // Frontend reads it via document.cookie too
+    secure: isProduction,
+    sameSite: "lax",
+    path: "/",
+    maxAge: NEXT_LOCALE_MAX_AGE_MS,
+    ...(isProduction
+      ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` }
+      : {}),
+  };
+}

 export function setAuthCookies(
   res: Response,
   jwt: string,
-  opts?: { isAdmin?: boolean },
+  opts?: { isAdmin?: boolean; locale?: string | null },
 ): void {
   res.cookie(COOKIE_NAME, jwt, getCookieOptions());
   res.cookie(LOGGED_IN_COOKIE, "1", getCookieOptions({ httpOnly: false }));
   if (opts?.isAdmin) {
     res.cookie(ADMIN_HINT_COOKIE, "1", getCookieOptions({ httpOnly: false }));
   }
+  // Sync NEXT_LOCALE with User.locale so the frontend middleware
+  // honours the user's saved preference on every request after login.
+  // Skipped when locale is null/unknown (e.g. fresh signup before
+  // LocalePreferenceModal runs). See LOCALE_RESOLUTION_AUDIT.md §3.3.
+  if (
+    opts?.locale &&
+    (SUPPORTED_LOCALES as readonly string[]).includes(opts.locale)
+  ) {
+    res.cookie(NEXT_LOCALE_COOKIE, opts.locale, getLocaleCookieOptions());
+  }
 }

 export function clearAuthCookies(res: Response): void {
   const isProduction = process.env.NODE_ENV === "production";
   const opts: CookieOptions = {
     path: "/",
     ...(isProduction ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` } : {}),
   };
   res.clearCookie(COOKIE_NAME, opts);
   res.clearCookie(LOGGED_IN_COOKIE, opts);
   res.clearCookie(ADMIN_HINT_COOKIE, opts);
+  // Clear the locale preference too — otherwise the next user logging in
+  // on this browser inherits the previous user's locale until they pick
+  // explicitly. See LOCALE_RESOLUTION_AUDIT.md §3.4.
+  res.clearCookie(NEXT_LOCALE_COOKIE, opts);
 }
```

### 3.3 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] Unit-test style: call `setAuthCookies(mockRes, "token", { locale: "en" })` → `mockRes.cookie` called with `NEXT_LOCALE`, `"en"`, the right options.
- [ ] Same with `locale: null` → NEXT_LOCALE NOT called.
- [ ] `clearAuthCookies(mockRes)` → `mockRes.clearCookie` called with `NEXT_LOCALE`.

### 3.4 Status

🟥 PENDING — SHA: —

---

## 4 — Commit 4: wire `user.locale` into call sites + server-side cookie in locale-preference

**Goal**: every existing call to `setAuthCookies` passes the user's locale; the locale-preference handler also writes the cookie defensively.

### 4.1 Files

- `backend/src/routes/auth.ts` — 4 call sites (lines 149, 163, 203, 276) gain `locale: result.user.locale`.
- `backend/src/routes/userProfile.ts` — `POST /me/locale-preference` (around line 184) gains a `res.cookie("NEXT_LOCALE", …)` call before `sendOk`.

### 4.2 auth.ts diff sketch (one repeated 4× pattern)

```diff
 setAuthCookies(res, token, {
   isAdmin: result.user.platformRole === "ADMIN",
+  locale: result.user.locale,
 });
```

### 4.3 userProfile.ts diff sketch

```diff
   fireAndForget("locale-prompt: deferred welcome email", sendWelcomeEmail({
     to: before.email,
     userId,
     displayName: before.displayName,
     locale: data.locale,
   }));
 }

+// Persist the locale preference in NEXT_LOCALE so the proxy middleware
+// can route the user correctly on subsequent requests. The frontend
+// (LocalePreferenceModal) also writes this cookie client-side; doing
+// it server-side here is a defensive backstop for the case where the
+// client write fails (browser extension, JS error). Same attributes as
+// setAuthCookies uses to keep both writers in lockstep. See
+// LOCALE_RESOLUTION_AUDIT.md §3.5.
+const isProduction = process.env.NODE_ENV === "production";
+res.cookie("NEXT_LOCALE", data.locale, {
+  httpOnly: false,
+  secure: isProduction,
+  sameSite: "lax",
+  path: "/",
+  maxAge: 365 * 24 * 60 * 60 * 1000,
+  ...(isProduction
+    ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` }
+    : {}),
+});
+
   return sendOk(res, { locale: data.locale });
});
```

(Alternative: extract a `setLocaleCookie(res, locale)` helper into `lib/authCookies.ts` and import it here. Worth doing if we end up with a 3rd call site.)

### 4.4 Acceptance

- [ ] `npx tsc --noEmit` passes.
- [ ] curl `POST /auth/login` against prod-like dev → response has `Set-Cookie: NEXT_LOCALE=es` (or whatever the user's locale is).
- [ ] curl `POST /users/me/locale-preference` with `{"locale":"en"}` → response has `Set-Cookie: NEXT_LOCALE=en; Max-Age=31536000`.
- [ ] Returning user logs in → next request to `/dashboard` is correctly localized without any frontend JS running.

### 4.5 Status

🟥 PENDING — SHA: —

---

## 5 — Commit 5: docs

### 5.1 Files

- `docs/DECISION_LOG.md` — new entry **ADR-064: Locale resolution architecture**.
- `docs/BUSINESS_RULES.md` — new §17 "Locale resolution".
- `CLAUDE.md` — §6 invariant 12.
- `C:\Users\juank\.claude\projects\c--Users-juank-Desktop-Quinel-Web\memory\MEMORY.md` — index entry pointing to a new `project_locale_resolution.md` memory file.

### 5.2 ADR-064 outline

- **Context**: Santiago Arcila's report (2026-05-26) + owner reproduction. The bug, the asymmetry in `proxy.ts:162`, the `localeDetection: true` default of next-intl, the dual conflict with `localeCookie: false`.
- **Decision**: precedence model (URL > cookie > Accept-Language > default), manual implementation in `proxy.ts`, backend syncs cookie on auth events, server-side defense on `POST /users/me/locale-preference`.
- **Consequences**: ✅ deterministic locale resolution; ✅ DB ↔ cookie sync at every auth event; ✅ logout fully cleans state; ⚠️ next-intl's auto-detection is replaced by manual code we now maintain; ⚠️ `COOKIE_REDIRECT_PREFIXES` is still a hand-curated list (out of scope to expand here).

### 5.3 BUSINESS_RULES §17 outline

- §17.1 Precedence (URL > cookie > Accept-Language > default)
- §17.2 SEO posture (no Set-Cookie on public SSG; manual cookie reads only)
- §17.3 Backend sync (login, register, google, corporate-activate, locale-preference all write the cookie when locale is known)
- §17.4 Logout state (NEXT_LOCALE is cleared along with auth cookies)
- §17.5 next-intl boundaries (`localeDetection: false`, `localeCookie: false`)

### 5.4 CLAUDE.md invariant 12

> **12. Locale resolution is URL-prefix-first, then cookie, then Accept-Language, then default.** `next-intl` is configured with `localeDetection: false` and `localeCookie: false` — it only consults URL prefix and defaultLocale. All other signals flow through `frontend-next/src/proxy.ts`. Backend `setAuthCookies` writes `NEXT_LOCALE` when `User.locale` is known; `clearAuthCookies` clears it. Never re-enable next-intl's auto-detection without removing our manual logic first. See ADR-064.

### 5.5 Acceptance

- [ ] ADR-064 in DECISION_LOG.md.
- [ ] BUSINESS_RULES.md §17 added.
- [ ] CLAUDE.md invariant 12 added.
- [ ] MEMORY.md indexed + `project_locale_resolution.md` written.

### 5.6 Status

🟥 PENDING — SHA: —

---

## Post-flight (after commit 4 lands)

Manual end-to-end verification against production:

- [ ] Reproduce Santiago's flow with the owner's account in Chrome incognito + English Accept-Language. Confirm: click "Español" → URL `/dashboard`, UI Spanish, cookie `NEXT_LOCALE=es`. NO 307 to `/en/`.
- [ ] Same with "Português" → URL `/pt/...`, UI Portuguese.
- [ ] New incognito with Spanish Accept-Language → URL `/dashboard`, UI Spanish.
- [ ] Anonymous visit to `picks4all.com/` with English Accept-Language → redirect to `/en` (manual Accept-Language fallback works).
- [ ] Returning user login → response `Set-Cookie: NEXT_LOCALE=…` headers visible in DevTools Network.
- [ ] Logout → `Set-Cookie: NEXT_LOCALE=; Max-Age=0` clears it.
- [ ] Mailer to Santiago: confirm his issue resolved.

---

## Rollback plan

Each commit is atomic; rollback is sequential reverts:

- Revert 5 → docs lose references; harmless.
- Revert 4 → backend stops syncing cookie on auth events. Frontend selector still writes cookie, so bug fix from commit 2 still works for users who use the selector. Returning login users lose the "automatic" cookie sync.
- Revert 3 → setAuthCookies signature reverts; commit 4 won't type-check anyway, so we'd also need to revert 4 first. Effective rollback: 4 → 3 in order.
- Revert 2 → proxy.ts reverts to the asymmetric Step 1b. Combined with commit 1 still in place (localeDetection: false), this makes the bug WORSE — no fallback at all. So if 2 needs revert, also revert 1.
- Revert 1 → next-intl auto-detection turns back on; combined with the asymmetric proxy.ts (if 2 is reverted too) restores the original bug. Full restoration of pre-cycle state.

Safe sequence if everything goes wrong: revert in reverse order (5 → 4 → 3 → 2 → 1).

No customer-data destruction at any rollback step.

---

## Document version

- v1 — 2026-05-26 — locked alongside LOCALE_RESOLUTION_AUDIT.md v1, after owner reproduction.
