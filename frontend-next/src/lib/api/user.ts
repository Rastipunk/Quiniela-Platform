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
  return requestJson<{ user: UserProfile }>("/users/me/profile", { method: "GET" }, token);
}

export async function updateUserProfile(
  token: string,
  input: UpdateProfileInput
): Promise<{ user: UserProfile }> {
  return requestJson<{ user: UserProfile }>(
    "/users/me/profile",
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export type UserEmailPreferences = {
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

export type PlatformEmailEnabled = {
  emailPoolInvitations: boolean;
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
  return requestJson("/me/email-preferences", { method: "GET" }, token);
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
    { method: "PUT", body: JSON.stringify(preferences) },
    token
  );
}
