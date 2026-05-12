// User API — profile, email preferences
import { requestJson } from "./client";

export type UserProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  platformRole: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  lastUsernameChangeAt: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  isGoogleAccount?: boolean;
  /** ISO 639-1. Null if the user has not completed the locale-preference modal yet. */
  locale?: string | null;
  /** ISO 639-1 of a language we don't support (captured from the "other language" picker). */
  requestedLocale?: string | null;
  /** True until the user submits the first-login locale-preference modal. */
  needsLocalePrompt?: boolean;
};

export type UpdateProfileInput = {
  displayName?: string;
  username?: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  bio?: string | null;
  country?: string | null;
  timezone?: string | null;
};

export async function getUserProfile(token: string): Promise<{ user: UserProfile }> {
  return requestJson<{ user: UserProfile }>("/users/me/profile", { method: "GET" });
}

/**
 * Aggregated snapshot used to populate GA4 user_properties. Returns
 * derived values the client cannot compute cheaply (pool count, tier).
 * Shape mirrors what GA4 accepts directly — keep names stable, they end
 * up as custom dimensions in reports.
 */
export interface UserAggregatedSnapshot {
  pool_count: number;
  paid_pool_count: number;
  tier: "free" | "paid";
  is_corporate: boolean;
  country: string | null;
  platform_role: string;
  account_age_days: number;
  acquisition_source: string | null;
  acquisition_campaign: string | null;
  // Behavioural segmentation — added so GA4 cohorts can separate
  // verified-active users from "zombie" signups and score engagement.
  is_verified_email: boolean;
  signup_method: "email" | "google";
  predictions_count: number;
  /** ISO 8601 UTC of the most recent user action (login, pick, pool view). */
  last_active_at: string | null;
  pool_host_count: number;
}

export async function getUserAggregated(): Promise<UserAggregatedSnapshot> {
  return requestJson<UserAggregatedSnapshot>("/me/aggregated", { method: "GET" });
}

export async function updateUserProfile(
  token: string,
  input: UpdateProfileInput
): Promise<{ user: UserProfile }> {
  return requestJson<{ user: UserProfile }>(
    "/users/me/profile",
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

// =========================================================================
// LOCALE PREFERENCE — first-login modal
// =========================================================================

export type LocalePreferenceInput = {
  locale: "es" | "en" | "pt";
  country?: string | null;
  requestedLocale?: string | null;
};

export async function setLocalePreference(
  input: LocalePreferenceInput,
): Promise<{ locale: "es" | "en" | "pt" }> {
  return requestJson("/users/me/locale-preference", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Best-effort country detection from Cloudflare CF-IPCountry header.
 *  Returns null when the header isn't present — never throws. */
export async function detectCountry(): Promise<{ country: string | null }> {
  try {
    return await requestJson("/users/me/detect-country", { method: "GET" });
  } catch {
    return { country: null };
  }
}

export type UserEmailPreferences = {
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
  emailNewMemberDigest: boolean;
};

export type PlatformEmailEnabled = {
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

export type UserEmailPreferencesResponse = {
  preferences: UserEmailPreferences;
  platformEnabled?: PlatformEmailEnabled;
  descriptions: Record<keyof UserEmailPreferences, string>;
};

export async function getUserEmailPreferences(
  token: string
): Promise<UserEmailPreferencesResponse> {
  return requestJson("/me/email-preferences", { method: "GET" });
}

export async function updateUserEmailPreferences(
  token: string,
  preferences: Partial<UserEmailPreferences>
): Promise<{
  message: string;
  preferences: UserEmailPreferences;
}> {
  return requestJson(
    "/me/email-preferences",
    { method: "PUT", body: JSON.stringify(preferences) }
  );
}
