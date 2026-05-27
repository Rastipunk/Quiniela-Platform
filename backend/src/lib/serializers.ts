/**
 * Entity serializers — centralized functions that control which fields
 * are safe to expose in API responses.
 *
 * Every entity returned to the client should pass through its serializer
 * to prevent accidental exposure of sensitive fields (e.g. passwordHash,
 * tokens, internal IDs).
 */

import type { PlatformRole } from "@prisma/client";

// ─── User ────────────────────────────────────────────────────

/** Standard shape for a serialized user (safe for API responses). */
export type SerializedUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  platformRole: PlatformRole;
  status: string;
  /** Locale picked by the user via LocalePreferenceModal (es / en / pt)
   *  or null if they haven't completed it yet. Consumed by auth route
   *  handlers to sync the NEXT_LOCALE cookie via setAuthCookies. Not
   *  sensitive — the frontend already has it via the cookie itself. */
  locale: string | null;
};

/** Strip sensitive fields from a User record before sending to client. */
export function serializeUser(u: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  platformRole: PlatformRole;
  status: string;
  locale: string | null;
}): SerializedUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    platformRole: u.platformRole,
    status: u.status,
    locale: u.locale,
  };
}
