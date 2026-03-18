// Auth API — login, register, Google OAuth, password recovery, email verification
import { requestJson } from "./client";

export type LoginResponse = {
  token?: string;
  user?: { id: string; email: string; username: string; displayName: string; role: string };
};

export type RegisterConsentOptions = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAge: boolean;
  acceptMarketing?: boolean;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  return requestJson<LoginResponse>("/auth/register", {
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
    }),
  });
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
  return requestJson<LoginResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      timezone,
      acceptTerms: consent?.acceptTerms,
      acceptPrivacy: consent?.acceptPrivacy,
      acceptAge: consent?.acceptAge,
      acceptMarketing: consent?.acceptMarketing,
    }),
  });
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
