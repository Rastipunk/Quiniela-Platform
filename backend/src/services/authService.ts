/**
 * Auth Service — Pure business logic for authentication flows.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (email, audit) are fire-and-forget but logged on failure.
 */

import crypto from "crypto";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { writeAuditEvent } from "../lib/audit";
import { validateUsername, normalizeUsername } from "../lib/username";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordChangedEmail,
} from "../lib/email";
import { verifyGoogleToken } from "../lib/googleAuth";
import { transitionToActive } from "./poolStateMachine";
import { ensurePoolCapacity, checkAndNotifyCapacityThresholds, notifyHostOfBlockedAttempt } from "../lib/poolCapacity";
import { CURRENT_LEGAL_VERSIONS } from "../routes/legal";
import { TOKEN_EXPIRY_MS, CRYPTO_BYTES, resolveUserLocale } from "../lib/constants";
import { serializeUser } from "../lib/serializers";
import type { SerializedUser } from "../lib/serializers";
import { fireAndForget } from "../lib/asyncHelpers";
import { sendCapiEvent } from "../lib/metaCapi";
import { sendGa4Event } from "../lib/ga4";

// ─── Types ───────────────────────────────────────────────────

/** Context passed from the HTTP layer for audit logging. */
export type AuditContext = {
  ip?: string | null;
  userAgent?: string | null;
};

/** Thrown when a service operation fails with a known business reason. */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusHint: number,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ServiceError";
  }
}

// Re-export for consumers that import from authService
export type { SerializedUser };

/**
 * Generate a unique username from an email local part.
 * Appends numeric suffixes until unique, keeping <= 20 chars.
 */
async function generateUniqueUsername(email: string): Promise<string> {
  const emailLocalPart = email.split("@")[0] ?? "user";
  let base = emailLocalPart.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

  if (base.length < 3) base = `user_${base}`;
  if (base.length > 20) base = base.substring(0, 20);

  let username = base;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}${suffix}`;
    if (username.length > 20) {
      const maxBaseLength = 20 - String(suffix).length;
      username = `${base.substring(0, maxBaseLength)}${suffix}`;
    }
    suffix++;
  }
  return username;
}

// ─── Service Functions ───────────────────────────────────────

// -- Register --

/**
 * First-touch marketing attribution forwarded by the frontend. Every
 * field is optional; an organic cold-start user won't supply any. Stored
 * verbatim on the User row at creation and NEVER overwritten later.
 */
export interface AttributionInput {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  landingPath?: string;
  referrerUrl?: string;
}

export type RegisterInput = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  timezone?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAge: boolean;
  acceptMarketing?: boolean;
  fbClickId?: string;
  fbBrowserId?: string;
  attribution?: AttributionInput;
};

export type RegisterResult = {
  user: SerializedUser & { timezone: string | null; createdAtUtc: Date };
  emailVerificationSent: boolean;
  metaEventId?: string;
};

export async function registerUser(data: RegisterInput, ctx: AuditContext): Promise<RegisterResult> {
  const email = data.email.trim().toLowerCase();

  if (!data.acceptTerms) throw new ServiceError("CONSENT_REQUIRED", 400, { reason: "TERMS_REQUIRED" });
  if (!data.acceptPrivacy) throw new ServiceError("CONSENT_REQUIRED", 400, { reason: "PRIVACY_REQUIRED" });
  if (!data.acceptAge) throw new ServiceError("AGE_VERIFICATION_REQUIRED", 400);

  const usernameValidation = validateUsername(data.username);
  if (!usernameValidation.valid) throw new ServiceError("VALIDATION_ERROR", 400, { reason: usernameValidation.error });

  const username = normalizeUsername(data.username);

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new ServiceError("EMAIL_TAKEN", 409);

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) throw new ServiceError("USERNAME_TAKEN", 409);

  const passwordHash = await hashPassword(data.password);
  const now = new Date();
  const emailVerificationToken = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
  const emailVerificationTokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS.EMAIL_VERIFICATION);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName: data.displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
      timezone: data.timezone || null,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationTokenExpiresAt,
      acceptedTermsAt: now,
      acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
      acceptedPrivacyAt: now,
      acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
      ageVerifiedAt: now,
      marketingConsent: data.acceptMarketing || false,
      marketingConsentAt: data.acceptMarketing ? now : null,
      // First-touch attribution: only written at creation, never updated.
      acquisitionSource: data.attribution?.source,
      acquisitionMedium: data.attribution?.medium,
      acquisitionCampaign: data.attribution?.campaign,
      acquisitionContent: data.attribution?.content,
      acquisitionTerm: data.attribution?.term,
      landingPath: data.attribution?.landingPath,
      referrerUrl: data.attribution?.referrerUrl,
      gclid: data.attribution?.gclid,
      gbraid: data.attribution?.gbraid,
      wbraid: data.attribution?.wbraid,
      fbclid: data.attribution?.fbclid,
    },
    select: {
      id: true, email: true, username: true, displayName: true,
      platformRole: true, status: true, timezone: true, createdAtUtc: true,
    },
  });

  fireAndForget("audit:register", writeAuditEvent({
    actorUserId: user.id, action: "USER_REGISTERED",
    entityType: "User", entityId: user.id,
    dataJson: { email: user.email }, ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  fireAndForget("verification email", sendVerificationEmail({
    to: user.email, displayName: user.displayName, verificationToken: emailVerificationToken,
  }));
  // Activation-funnel telemetry. Without this step, every signup looks
  // identical in analytics — we can't distinguish users who got a
  // deliverable email from those who bounced (bad address, spam filter).
  fireAndForget("ga4mp:email_verification_sent", sendGa4Event({
    userId: user.id,
    events: [{ name: "email_verification_sent", params: { method: "email" } }],
  }));

  const metaEventId = crypto.randomUUID();
  fireAndForget("capi:register", sendCapiEvent({
    eventName: "CompleteRegistration",
    eventId: metaEventId,
    userData: {
      email: user.email,
      firstName: user.displayName,
      externalId: user.id,
      clientIpAddress: ctx.ip || undefined,
      clientUserAgent: ctx.userAgent || undefined,
      fbc: data.fbClickId,
      fbp: data.fbBrowserId,
    },
    customData: buildAttributionCustomData(data.attribution),
  }));

  // Server-side GA4 `sign_up`. Browsers sometimes miss this event when the
  // post-signup redirect occurs before hydration. The failsafe makes sure
  // conversions always reach GA4 regardless of client state.
  fireAndForget("ga4mp:sign_up", sendGa4Event({
    userId: user.id,
    ipOverride: ctx.ip || undefined,
    userAgent: ctx.userAgent || undefined,
    events: [{
      name: "sign_up",
      params: {
        method: "email",
        ...(data.attribution?.source ? { utm_source: data.attribution.source } : {}),
        ...(data.attribution?.campaign ? { utm_campaign: data.attribution.campaign } : {}),
        ...(data.attribution?.medium ? { utm_medium: data.attribution.medium } : {}),
      },
    }],
  }));

  return { user, emailVerificationSent: true, metaEventId };
}

/**
 * Project the frontend attribution payload into the shape Meta expects
 * as `custom_data`. Returns `undefined` when there is nothing to send,
 * keeping the CAPI payload compact.
 */
function buildAttributionCustomData(
  attribution?: AttributionInput,
): Record<string, string> | undefined {
  if (!attribution) return undefined;
  const out: Record<string, string> = {};
  if (attribution.source) out.utm_source = attribution.source;
  if (attribution.medium) out.utm_medium = attribution.medium;
  if (attribution.campaign) out.utm_campaign = attribution.campaign;
  if (attribution.content) out.utm_content = attribution.content;
  if (attribution.term) out.utm_term = attribution.term;
  if (attribution.gclid) out.gclid = attribution.gclid;
  if (attribution.fbclid) out.fbclid = attribution.fbclid;
  return Object.keys(out).length > 0 ? out : undefined;
}

// -- Login --

export type LoginResult = { user: SerializedUser };

export async function loginUser(email: string, password: string, ctx: AuditContext): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || user.status !== "ACTIVE") throw new ServiceError("UNAUTHENTICATED", 401);

  const isGoogleOnly = !!user.googleId && (!user.passwordHash || user.passwordHash === "");
  if (isGoogleOnly) throw new ServiceError("GOOGLE_ACCOUNT_NO_PASSWORD", 400);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new ServiceError("UNAUTHENTICATED", 401);

  fireAndForget("audit:login", writeAuditEvent({
    actorUserId: user.id, action: "USER_LOGGED_IN",
    entityType: "User", entityId: user.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  return { user: serializeUser(user) };
}

// -- Forgot Password --

export type ForgotPasswordResult = { sent: boolean; isGoogleOnly?: boolean };

export async function requestPasswordReset(email: string, ctx: AuditContext): Promise<ForgotPasswordResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || user.status !== "ACTIVE") return { sent: false };

  const isGoogleOnly = !!user.googleId && (!user.passwordHash || user.passwordHash === "");
  if (isGoogleOnly) return { sent: false, isGoogleOnly: true };

  const resetToken = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
  const resetTokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS.PASSWORD_RESET);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiresAt },
  });

  const emailResult = await sendPasswordResetEmail({
    to: user.email, username: user.username, resetToken,
    locale: resolveUserLocale(user),
  });

  if (!emailResult.success) {
    console.error("[AuthService] Error sending reset email:", emailResult.error);
  }

  fireAndForget("audit:forgot-password", writeAuditEvent({
    actorUserId: user.id, action: "PASSWORD_RESET_REQUESTED",
    entityType: "User", entityId: user.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  return { sent: true };
}

// -- Reset Password --

export async function resetPassword(token: string, newPassword: string, ctx: AuditContext): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiresAt: { gte: new Date() }, status: "ACTIVE" },
  });

  if (!user) throw new ServiceError("INVALID_TOKEN", 400);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  fireAndForget("audit:reset-password", writeAuditEvent({
    actorUserId: user.id, action: "PASSWORD_RESET_COMPLETED",
    entityType: "User", entityId: user.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  fireAndForget("password-changed-email", sendPasswordChangedEmail({
    to: user.email,
    displayName: user.displayName,
    locale: resolveUserLocale(user),
  }));
}

// -- Google OAuth --

export type GoogleAuthInput = {
  idToken: string;
  timezone?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptAge?: boolean;
  acceptMarketing?: boolean;
  fbClickId?: string;
  fbBrowserId?: string;
  attribution?: AttributionInput;
};

export type GoogleAuthResult = { user: SerializedUser; isNewUser: boolean; metaEventId?: string };

export async function authenticateWithGoogle(data: GoogleAuthInput, ctx: AuditContext): Promise<GoogleAuthResult> {
  const googleUser = await verifyGoogleToken(data.idToken);
  if (!googleUser) throw new ServiceError("INVALID_TOKEN", 401);

  const normalizedEmail = googleUser.email.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { googleId: googleUser.googleId }] },
    select: { id: true, email: true, username: true, displayName: true, platformRole: true, status: true, googleId: true },
  });

  // Existing user — login
  if (user) {
    if (user.status !== "ACTIVE") throw new ServiceError("ACCOUNT_INACTIVE", 403);

    // Link Google ID if not yet linked
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId },
        select: { id: true, email: true, username: true, displayName: true, platformRole: true, status: true, googleId: true },
      });
      fireAndForget("audit:google-link", writeAuditEvent({
        actorUserId: user.id, action: "GOOGLE_ACCOUNT_LINKED",
        entityType: "User", entityId: user.id,
        ip: ctx.ip, userAgent: ctx.userAgent,
      }));
    }

    fireAndForget("audit:google-login", writeAuditEvent({
      actorUserId: user.id, action: "LOGIN_GOOGLE",
      entityType: "User", entityId: user.id,
      ip: ctx.ip, userAgent: ctx.userAgent,
    }));

    // Server-side Login event fan-out. New users emit `sign_up` further
    // down; returning users get a `login` signal so GA4 can distinguish
    // acquisition from re-engagement, and Meta CAPI receives a canonical
    // Login event to feed back into audience building.
    fireAndForget("capi:google-login", sendCapiEvent({
      eventName: "Login",
      eventId: `login_google_${user.id}_${Date.now()}`,
      userData: {
        externalId: user.id,
        email: user.email,
        clientIpAddress: ctx.ip ?? undefined,
        clientUserAgent: ctx.userAgent ?? undefined,
      },
      customData: { method: "google" },
    }));
    fireAndForget("ga4mp:login-google", sendGa4Event({
      userId: user.id,
      ipOverride: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
      events: [{ name: "login", params: { method: "google" } }],
    }));

    return { user: serializeUser(user), isNewUser: false };
  }

  // New user — require consent
  if (!data.acceptTerms) throw new ServiceError("CONSENT_REQUIRED", 400, { reason: "TERMS_REQUIRED", requiresConsent: true });
  if (!data.acceptPrivacy) throw new ServiceError("CONSENT_REQUIRED", 400, { reason: "PRIVACY_REQUIRED", requiresConsent: true });
  if (!data.acceptAge) throw new ServiceError("AGE_VERIFICATION_REQUIRED", 400, { requiresConsent: true });

  const username = await generateUniqueUsername(googleUser.email);
  const now = new Date();

  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username,
      displayName: googleUser.name || username,
      passwordHash: "",
      googleId: googleUser.googleId,
      platformRole: "PLAYER",
      status: "ACTIVE",
      timezone: data.timezone || null,
      emailVerified: true,
      acceptedTermsAt: now,
      acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
      acceptedPrivacyAt: now,
      acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
      ageVerifiedAt: now,
      marketingConsent: data.acceptMarketing || false,
      marketingConsentAt: data.acceptMarketing ? now : null,
      // First-touch attribution — write-once, same rules as the
      // email/password path above.
      acquisitionSource: data.attribution?.source,
      acquisitionMedium: data.attribution?.medium,
      acquisitionCampaign: data.attribution?.campaign,
      acquisitionContent: data.attribution?.content,
      acquisitionTerm: data.attribution?.term,
      landingPath: data.attribution?.landingPath,
      referrerUrl: data.attribution?.referrerUrl,
      gclid: data.attribution?.gclid,
      gbraid: data.attribution?.gbraid,
      wbraid: data.attribution?.wbraid,
      fbclid: data.attribution?.fbclid,
    },
    select: { id: true, email: true, username: true, displayName: true, platformRole: true, status: true, googleId: true },
  });

  fireAndForget("audit:google-register", writeAuditEvent({
    actorUserId: newUser.id, action: "REGISTER_GOOGLE",
    entityType: "User", entityId: newUser.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  fireAndForget("welcome email", sendWelcomeEmail({
    to: newUser.email, userId: newUser.id, displayName: newUser.displayName,
  }));

  const metaEventId = crypto.randomUUID();
  fireAndForget("capi:google-register", sendCapiEvent({
    eventName: "CompleteRegistration",
    eventId: metaEventId,
    userData: {
      email: newUser.email,
      firstName: newUser.displayName,
      externalId: newUser.id,
      clientIpAddress: ctx.ip || undefined,
      clientUserAgent: ctx.userAgent || undefined,
      fbc: data.fbClickId,
      fbp: data.fbBrowserId,
    },
    customData: buildAttributionCustomData(data.attribution),
  }));

  fireAndForget("ga4mp:sign_up-google", sendGa4Event({
    userId: newUser.id,
    ipOverride: ctx.ip || undefined,
    userAgent: ctx.userAgent || undefined,
    events: [{
      name: "sign_up",
      params: {
        method: "google",
        ...(data.attribution?.source ? { utm_source: data.attribution.source } : {}),
        ...(data.attribution?.campaign ? { utm_campaign: data.attribution.campaign } : {}),
        ...(data.attribution?.medium ? { utm_medium: data.attribution.medium } : {}),
      },
    }],
  }));

  return { user: serializeUser(newUser), isNewUser: true, metaEventId };
}

// -- Verify Email --


export type VerifyEmailResult = { verified: boolean; alreadyVerified: boolean };

export async function verifyEmail(token: string, ctx: AuditContext): Promise<VerifyEmailResult> {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token, emailVerificationTokenExpiresAt: { gte: new Date() } },
  });

  if (!user) throw new ServiceError("INVALID_TOKEN", 400);
  if (user.emailVerified) return { verified: false, alreadyVerified: true };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationTokenExpiresAt: null },
  });

  fireAndForget("audit:email-verified", writeAuditEvent({
    actorUserId: user.id, action: "EMAIL_VERIFIED",
    entityType: "User", entityId: user.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  fireAndForget("welcome email", sendWelcomeEmail({
    to: user.email, userId: user.id, displayName: user.displayName,
    locale: resolveUserLocale(user),
  }));

  // Activation-funnel telemetry. Pairing `email_verification_sent` with
  // this completes the ratio GA4 reports use to spot deliverability /
  // token-link breakage (time-to-verify + verification rate).
  fireAndForget("ga4mp:email_verification_completed", sendGa4Event({
    userId: user.id,
    ipOverride: ctx.ip ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
    events: [{ name: "email_verification_completed", params: { method: "email" } }],
  }));

  return { verified: true, alreadyVerified: false };
}

// -- Check Corporate Invite --

export type CorporateInviteInfo = {
  email: string;
  alreadyExists: boolean;
  poolName: string;
  companyName: string | null;
};

export async function checkCorporateInvite(activationToken: string): Promise<CorporateInviteInfo> {
  const invite = await prisma.corporateInvite.findUnique({
    where: { activationToken },
    include: { pool: { select: { id: true, name: true, organization: { select: { name: true } } } } },
  });

  if (!invite) throw new ServiceError("INVALID_TOKEN", 400);
  if (invite.activationTokenExpiresAt < new Date()) throw new ServiceError("TOKEN_EXPIRED", 400);
  if (invite.status === "ACTIVATED") throw new ServiceError("ALREADY_ACTIVATED", 409);

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });

  return {
    email: invite.email,
    alreadyExists: !!existingUser,
    poolName: invite.pool.name,
    companyName: invite.pool.organization?.name ?? null,
  };
}

// -- Activate Corporate Account --

export type CorporateActivationInput = {
  activationToken: string;
  displayName?: string;
  username?: string;
  password?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptAge?: boolean;
  /** Optional: ID of the user currently logged in (read from auth cookie by
   *  the route handler). Used to detect a magic-link session mismatch — if
   *  someone logged in as Alice opens an invitation link addressed to Bob,
   *  we refuse to silently overwrite Alice's session with Bob's. */
  currentUserId?: string | null;
};

export type CorporateActivationResult = {
  user: SerializedUser;
  poolId: string;
  poolName: string;
  companyName: string | null;
  alreadyExisted: boolean;
};

export async function activateCorporateAccount(
  data: CorporateActivationInput,
  ctx: AuditContext,
): Promise<CorporateActivationResult> {
  const invite = await prisma.corporateInvite.findUnique({
    where: { activationToken: data.activationToken },
    include: {
      pool: {
        select: { id: true, name: true, maxParticipants: true, organization: { select: { name: true } } },
      },
    },
  });

  if (!invite) throw new ServiceError("INVALID_TOKEN", 400);
  if (invite.activationTokenExpiresAt < new Date()) throw new ServiceError("TOKEN_EXPIRED", 400);
  if (invite.status === "ACTIVATED") throw new ServiceError("ALREADY_ACTIVATED", 409);

  const poolId = invite.poolId;
  const poolName = invite.pool.name;
  const companyName = invite.pool.organization?.name ?? null;

  // Session mismatch defence — if there's already a logged-in user in this
  // browser session AND their email doesn't match the invite's, refuse to
  // silently overwrite their cookies with someone else's. This protects
  // against three real scenarios:
  //   (1) Alice (logged in) accidentally opens Bob's invite from a shared
  //       inbox / forwarded chat → previously she'd be silently signed in
  //       as Bob with no warning.
  //   (2) An attacker who controls the email account of an invitee can,
  //       when the victim is already logged in, take over the victim's
  //       browser session by clicking the magic-link.
  //   (3) Genuine UX confusion when the host has multiple test accounts.
  // The frontend handles the SESSION_MISMATCH error by offering a "log out
  // and continue" flow.
  if (data.currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: data.currentUserId },
      select: { email: true },
    });
    if (
      currentUser &&
      currentUser.email.toLowerCase() !== invite.email.toLowerCase()
    ) {
      throw new ServiceError("SESSION_MISMATCH", 409, {
        currentUserEmail: currentUser.email,
        inviteEmail: invite.email,
      });
    }
  }

  // ── Existing user path ──
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.corporateInvite.updateMany({
        where: { id: invite.id, status: { in: ["PENDING", "SENT"] } },
        data: { status: "ACTIVATED", activatedUserId: existingUser.id, activatedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("ALREADY_ACTIVATED");

      const existingMember = await tx.poolMember.findUnique({
        where: { poolId_userId: { poolId, userId: existingUser.id } },
      });
      if (!existingMember) {
        await ensurePoolCapacity(tx, poolId, invite.pool.maxParticipants);
        await tx.poolMember.create({
          data: { poolId, userId: existingUser.id, role: "PLAYER", status: "ACTIVE" },
        });
      }
    }).catch(async (err) => {
      if (err.message === "ALREADY_ACTIVATED") throw new ServiceError("ALREADY_ACTIVATED", 409);
      if (err.message === "POOL_FULL") {
        // Notify host (throttled) so they see the demand and can expand.
        await notifyHostOfBlockedAttempt({
          poolId,
          attemptedEmail: invite.email,
          attemptedUserId: existingUser.id,
        }).catch(() => {});
        throw new ServiceError("POOL_FULL", 409);
      }
      throw err;
    });

    await transitionToActive(poolId, existingUser.id).catch((err) =>
      console.error("[AuthService] transitionToActive error (existing):", err instanceof Error ? err.message : String(err)),
    );

    await checkAndNotifyCapacityThresholds({ poolId, actorUserId: existingUser.id });

    return {
      user: serializeUser(existingUser),
      poolId, poolName, companyName, alreadyExisted: true,
    };
  }

  // ── New user path ──
  if (!data.displayName || !data.username || !data.password) {
    throw new ServiceError("VALIDATION_ERROR", 400, { reason: "MISSING_REQUIRED_FIELDS" });
  }
  if (!data.acceptTerms || !data.acceptPrivacy || !data.acceptAge) {
    throw new ServiceError("CONSENT_REQUIRED", 400);
  }

  const usernameValidation = validateUsername(data.username);
  if (!usernameValidation.valid) throw new ServiceError("VALIDATION_ERROR", 400, { reason: usernameValidation.error });

  const username = normalizeUsername(data.username);
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) throw new ServiceError("USERNAME_TAKEN", 409);

  const passwordHash = await hashPassword(data.password);
  const now = new Date();

  let newUser: SerializedUser;
  try {
    newUser = await prisma.$transaction(async (tx) => {
      const claimed = await tx.corporateInvite.updateMany({
        where: { id: invite.id, status: { in: ["PENDING", "SENT"] } },
        data: { status: "ACTIVATED", activatedAt: now },
      });
      if (claimed.count === 0) throw new Error("ALREADY_ACTIVATED");

      const created = await tx.user.create({
        data: {
          email: invite.email, username, displayName: data.displayName!, passwordHash,
          platformRole: "PLAYER", status: "ACTIVE", emailVerified: true,
          acceptedTermsAt: now, acceptedTermsVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
          acceptedPrivacyAt: now, acceptedPrivacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
          ageVerifiedAt: now,
        },
        select: { id: true, email: true, username: true, displayName: true, platformRole: true, status: true },
      });

      await ensurePoolCapacity(tx, poolId, invite.pool.maxParticipants);
      await tx.poolMember.create({
        data: { poolId, userId: created.id, role: "PLAYER", status: "ACTIVE" },
      });

      await tx.corporateInvite.update({
        where: { id: invite.id },
        data: { activatedUserId: created.id },
      });

      return serializeUser(created);
    });
  } catch (err: any) {
    if (err.message === "ALREADY_ACTIVATED") throw new ServiceError("ALREADY_ACTIVATED", 409);
    if (err.message === "POOL_FULL") {
      // No userId yet — the user wasn't created because the tx rolled back.
      await notifyHostOfBlockedAttempt({
        poolId,
        attemptedEmail: invite.email,
        attemptedUserId: null,
      }).catch(() => {});
      throw new ServiceError("POOL_FULL", 409);
    }
    throw err;
  }

  await transitionToActive(poolId, newUser.id).catch((err) =>
    console.error("[AuthService] transitionToActive error (new):", err instanceof Error ? err.message : String(err)),
  );

  await checkAndNotifyCapacityThresholds({ poolId, actorUserId: newUser.id });

  fireAndForget("audit:corporate-activation", writeAuditEvent({
    actorUserId: newUser.id, action: "CORPORATE_ACCOUNT_ACTIVATED",
    entityType: "User", entityId: newUser.id,
    dataJson: { poolId, email: invite.email },
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));

  fireAndForget("welcome email", sendWelcomeEmail({
    to: newUser.email, userId: newUser.id, displayName: newUser.displayName,
  }));

  return { user: newUser, poolId, poolName, companyName, alreadyExisted: false };
}

// -- Resend Verification --

export async function resendVerification(userId: string, ctx: AuditContext): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, emailVerified: true, country: true },
  });

  if (!user) throw new ServiceError("USER_NOT_FOUND", 404);
  if (user.emailVerified) throw new ServiceError("ALREADY_VERIFIED", 400);

  const verificationToken = crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex");
  const verificationTokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS.EMAIL_VERIFICATION);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: verificationToken, emailVerificationTokenExpiresAt: verificationTokenExpiresAt },
  });

  const emailResult = await sendVerificationEmail({
    to: user.email, displayName: user.displayName, verificationToken,
    locale: resolveUserLocale(user),
  });

  if (!emailResult.success) {
    console.error("[AuthService] Error sending verification email:", emailResult.error);
    throw new ServiceError("EMAIL_SEND_FAILED", 500);
  }

  fireAndForget("audit:resend-verification", writeAuditEvent({
    actorUserId: user.id, action: "VERIFICATION_EMAIL_RESENT",
    entityType: "User", entityId: user.id,
    ip: ctx.ip, userAgent: ctx.userAgent,
  }));
}
