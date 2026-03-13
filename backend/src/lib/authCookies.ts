import type { Response, CookieOptions } from "express";

const COOKIE_NAME = "p4a_token";
const LOGGED_IN_COOKIE = "p4a_logged_in";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCookieOptions(overrides?: Partial<CookieOptions>): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
    ...(isProduction ? { domain: ".picks4all.com" } : {}),
    ...overrides,
  };
}

/** Set httpOnly JWT cookie + non-httpOnly logged-in flag */
export function setAuthCookies(res: Response, jwt: string): void {
  res.cookie(COOKIE_NAME, jwt, getCookieOptions());
  // Non-httpOnly flag so frontend JS can check if logged in
  res.cookie(LOGGED_IN_COOKIE, "1", getCookieOptions({ httpOnly: false }));
}

/** Clear both auth cookies */
export function clearAuthCookies(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  const opts: CookieOptions = {
    path: "/",
    ...(isProduction ? { domain: ".picks4all.com" } : {}),
  };
  res.clearCookie(COOKIE_NAME, opts);
  res.clearCookie(LOGGED_IN_COOKIE, opts);
}

/** Read auth token from cookie (used by requireAuth middleware) */
export function getTokenFromCookies(cookies: Record<string, string> | undefined): string | null {
  return cookies?.[COOKIE_NAME] || null;
}
