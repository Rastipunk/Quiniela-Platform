import type { Response, CookieOptions } from "express";

const COOKIE_NAME = "p4a_token";
const LOGGED_IN_COOKIE = "p4a_logged_in";
// Non-httpOnly hint that opens analytics debug mode (`?gtm_debug=1`)
// only for platform admins. Not a security boundary — a curious user
// cannot inspect PII from dataLayer anyway — just a UX guardrail so
// random visitors don't stumble into a console firehose.
const ADMIN_HINT_COOKIE = "p4a_admin";
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours — aligned with JWT expiry

// next-intl locale preference cookie. Read by the frontend middleware
// (proxy.ts) to honour the user's saved locale on every request.
// Written by the frontend (LanguageSelector, LocalePreferenceModal)
// AND by this backend at login/locale-preference so the cookie always
// reflects User.locale even on the very first request after a fresh
// login. See LOCALE_RESOLUTION_AUDIT.md §3.3.
const NEXT_LOCALE_COOKIE = "NEXT_LOCALE";
const NEXT_LOCALE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — mirrors the frontend writers
const SUPPORTED_LOCALES = ["es", "en", "pt"] as const;

function getCookieOptions(overrides?: Partial<CookieOptions>): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
    ...(isProduction ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` } : {}),
    ...overrides,
  };
}

// Attributes for the locale cookie — must match what
// LanguageSelector.tsx and LocalePreferenceModal.tsx write client-side
// so reads/writes from either side land on the same cookie row.
function getLocaleCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: false, // frontend reads it via document.cookie + middleware reads it server-side
    secure: isProduction,
    sameSite: "lax",
    maxAge: NEXT_LOCALE_MAX_AGE_MS,
    path: "/",
    ...(isProduction ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` } : {}),
  };
}

/** Set httpOnly JWT cookie + non-httpOnly logged-in flag. When `locale`
 *  is a known SUPPORTED_LOCALES member, also sets NEXT_LOCALE so the
 *  frontend middleware honours the user's saved language preference
 *  on every request. Skipped when locale is null/undefined (fresh
 *  signups before LocalePreferenceModal completes). */
export function setAuthCookies(
  res: Response,
  jwt: string,
  opts?: { isAdmin?: boolean; locale?: string | null },
): void {
  res.cookie(COOKIE_NAME, jwt, getCookieOptions());
  // Non-httpOnly flag so frontend JS can check if logged in
  res.cookie(LOGGED_IN_COOKIE, "1", getCookieOptions({ httpOnly: false }));
  if (opts?.isAdmin) {
    res.cookie(ADMIN_HINT_COOKIE, "1", getCookieOptions({ httpOnly: false }));
  }
  if (
    opts?.locale &&
    (SUPPORTED_LOCALES as readonly string[]).includes(opts.locale)
  ) {
    res.cookie(NEXT_LOCALE_COOKIE, opts.locale, getLocaleCookieOptions());
  }
}

/** Helper for routes that want to set NEXT_LOCALE without touching auth
 *  cookies (e.g. POST /users/me/locale-preference). Uses the same
 *  attributes as setAuthCookies so the cookie row is fungible across
 *  writers. */
export function setLocaleCookie(res: Response, locale: string): void {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return;
  res.cookie(NEXT_LOCALE_COOKIE, locale, getLocaleCookieOptions());
}

/** Clear all auth cookies AND the locale preference cookie. Without
 *  clearing NEXT_LOCALE, the next user logging in on the same browser
 *  would inherit the previous user's locale until they change it
 *  explicitly. See LOCALE_RESOLUTION_AUDIT.md §3.4. */
export function clearAuthCookies(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  const opts: CookieOptions = {
    path: "/",
    ...(isProduction ? { domain: `.${process.env.SITE_DOMAIN || "picks4all.com"}` } : {}),
  };
  res.clearCookie(COOKIE_NAME, opts);
  res.clearCookie(LOGGED_IN_COOKIE, opts);
  res.clearCookie(ADMIN_HINT_COOKIE, opts);
  res.clearCookie(NEXT_LOCALE_COOKIE, opts);
}

/** Read auth token from cookie (used by requireAuth middleware) */
export function getTokenFromCookies(cookies: Record<string, string> | undefined): string | null {
  return cookies?.[COOKIE_NAME] || null;
}
