// Auth API — login, register, Google OAuth, password recovery, email verification
import { requestJson } from "./client";
import { getMetaCookies } from "@/lib/metaPixel";
import { getAttributionPayload, clearAttribution } from "@/lib/attribution";

export type LoginResponse = {
  token?: string;
  user?: { id: string; email: string; username: string; displayName: string; role: string };
  metaEventId?: string;
};

export type RegisterConsentOptions = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAge: boolean;
  acceptMarketing?: boolean;
};

export async function login(
  email: string,
  password: string,
  rememberMe = true,
): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

// ── Active sessions / devices (ADR-081) ──────────────────────
export type ActiveSession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  persistent: boolean;
  createdAtUtc: string;
  lastUsedAtUtc: string;
  expiresAtUtc: string;
  current: boolean;
};

export async function getSessions(): Promise<{ sessions: ActiveSession[] }> {
  return requestJson<{ sessions: ActiveSession[] }>("/auth/sessions", { method: "GET" });
}

export async function revokeSession(id: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; revoked: number }> {
  return requestJson<{ ok: boolean; revoked: number }>("/auth/sessions/revoke-others", {
    method: "POST",
  });
}

export async function register(
  email: string,
  username: string,
  displayName: string,
  password: string,
  timezone?: string,
  consent?: RegisterConsentOptions
): Promise<LoginResponse> {
  const { fbc, fbp } = getMetaCookies();
  const attribution = getAttributionPayload();
  const result = await requestJson<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      username,
      displayName,
      password,
      timezone,
      acceptTerms: consent?.acceptTerms ?? false,
      acceptPrivacy: consent?.acceptPrivacy ?? false,
      acceptAge: consent?.acceptAge ?? false,
      acceptMarketing: consent?.acceptMarketing ?? false,
      fbClickId: fbc,
      fbBrowserId: fbp,
      attribution,
    }),
  });
  // Clear session attribution after successful signup so subsequent
  // re-logins from the same browser don't re-send it.
  if (result.token) clearAttribution();
  return result;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function loginWithGoogle(
  idToken: string,
  timezone?: string,
  consent?: RegisterConsentOptions
): Promise<LoginResponse> {
  const { fbc, fbp } = getMetaCookies();
  const attribution = getAttributionPayload();
  const result = await requestJson<LoginResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      timezone,
      acceptTerms: consent?.acceptTerms,
      acceptPrivacy: consent?.acceptPrivacy,
      acceptAge: consent?.acceptAge,
      acceptMarketing: consent?.acceptMarketing,
      fbClickId: fbc,
      fbBrowserId: fbp,
      attribution,
    }),
  });
  if (result.token) clearAttribution();
  return result;
}

export type VerifyEmailResponse = {
  message: string;
  verified?: boolean;
  alreadyVerified?: boolean;
};

export async function verifyEmail(verificationToken: string): Promise<VerifyEmailResponse> {
  return requestJson<VerifyEmailResponse>(
    "/auth/verify-email",
    { method: "POST", body: JSON.stringify({ token: verificationToken }) }
  );
}

export async function logout(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function resendVerificationEmail(token: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>(
    "/auth/resend-verification",
    { method: "POST" }
  );
}
