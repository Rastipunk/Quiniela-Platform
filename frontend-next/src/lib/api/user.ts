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
