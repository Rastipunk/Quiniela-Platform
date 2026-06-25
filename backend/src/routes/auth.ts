/**
 * Auth Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → set cookies → send response.
 * All business logic lives in services/authService.ts.
 */

import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import type { PlatformRole } from "@prisma/client";
import { signToken, verifyToken } from "../lib/jwt";
import { requireAuth, optionalAuth } from "../middleware/requireAuth";
import {
  setAuthCookies,
  clearAuthCookies,
  getTokenFromCookies,
  setRefreshCookie,
  getRefreshFromCookies,
} from "../lib/authCookies";
import {
  createSession,
  rotateRefresh,
  revokeSession,
  revokeOthersForUser,
  listSessions,
} from "../services/sessionService";
import { isPersistentSessionsEnabled } from "../lib/featureFlags";
import {
  sendData, sendOk, sendCreated, sendBadRequest,
  sendUnauthorized, sendForbidden, sendNotFound,
  sendConflict, sendInternal,
} from "../lib/apiResponse";
import {
  ServiceError,
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  authenticateWithGoogle,
  verifyEmail,
  checkCorporateInvite,
  activateCorporateAccount,
  resendVerification,
} from "../services/authService";
import { isPasswordValid } from "../lib/passwordRules";
import type { AuditContext } from "../services/authService";

export const authRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────

/** Extract audit context from the Express request. */
function auditCtx(req: { ip?: string; get: (h: string) => string | undefined }): AuditContext {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

/** Map ServiceError to HTTP response. */
function handleServiceError(res: any, err: unknown): void {
  if (err instanceof ServiceError) {
    const send = {
      400: sendBadRequest,
      401: sendUnauthorized,
      403: sendForbidden,
      404: sendNotFound,
      409: sendConflict,
      500: sendInternal,
    }[err.statusHint] ?? sendInternal;
    send(res, err.code, err.extra);
    return;
  }
  throw err; // Re-throw unexpected errors → global error handler
}

/**
 * Create a Session, mint a session-backed access token, and set cookies —
 * the single path every login entry point uses (ADR-081), so behaviour stays
 * identical across register / login / google / corporate activation.
 * `persistent` ("remember me") also issues the long-lived refresh cookie; when
 * false, this behaves exactly like the legacy 4h flow (no refresh token).
 */
async function establishSession(
  res: Response,
  user: { id: string; platformRole: PlatformRole; locale?: string | null; email: string },
  opts: { persistent: boolean; ctx: AuditContext },
): Promise<void> {
  // Rollout gate (ADR-081, PERSISTENT_SESSIONS_ALLOWLIST). Outside the
  // allowlist → a legacy token: no sessionId, no Session row, no refresh
  // cookie → behaviour byte-for-byte identical to before this feature. Flip
  // the env to "*" (no redeploy) to give every user session-backed tokens.
  if (!isPersistentSessionsEnabled(user.email)) {
    const token = signToken({ userId: user.id, platformRole: user.platformRole });
    setAuthCookies(res, token, {
      isAdmin: user.platformRole === "ADMIN",
      locale: user.locale ?? null,
    });
    return;
  }

  const { sessionId, refreshToken } = await createSession({
    userId: user.id,
    persistent: opts.persistent,
    userAgent: opts.ctx.userAgent,
    ipAddress: opts.ctx.ip,
  });
  const token = signToken({
    userId: user.id,
    platformRole: user.platformRole,
    sessionId,
  });
  setAuthCookies(res, token, {
    isAdmin: user.platformRole === "ADMIN",
    locale: user.locale ?? null,
    persistent: opts.persistent,
  });
  if (refreshToken) setRefreshCookie(res, refreshToken);
}

// ─── Schemas ─────────────────────────────────────────────────

// Attribution payload forwarded by the frontend's captureAttribution().
// Every field is optional — a cold-organic user won't have any of these.
// Capped at 200 chars each to absorb nothing malicious in case the URL
// was crafted; we don't trust the client even though the data is cosmetic.
const attributionSchema = z
  .object({
    source: z.string().max(200).optional(),
    medium: z.string().max(200).optional(),
    campaign: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
    gclid: z.string().max(200).optional(),
    gbraid: z.string().max(200).optional(),
    wbraid: z.string().max(200).optional(),
    fbclid: z.string().max(200).optional(),
    landingPath: z.string().max(500).optional(),
    referrerUrl: z.string().max(500).optional(),
  })
  .strict()
  .optional();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  displayName: z.string().min(2).max(50),
  password: z.string().min(8).max(200).refine(isPasswordValid, { message: "Password must contain at least 1 uppercase letter and 1 number" }),
  timezone: z.string().optional(),
  acceptTerms: z.boolean(),
  acceptPrivacy: z.boolean(),
  acceptAge: z.boolean(),
  acceptMarketing: z.boolean().optional().default(false),
  fbClickId: z.string().optional(),
  fbBrowserId: z.string().optional(),
  attribution: attributionSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  // "Mantener sesión abierta" (ADR-081). Default FALSE: persistence is strictly
  // opt-in via the top-of-panel checkbox. Unchecked → 4h-only (no refresh
  // token, no persistent cookie); checked → 90d sliding session.
  rememberMe: z.boolean().optional().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200).refine(isPasswordValid, { message: "Password must contain at least 1 uppercase letter and 1 number" }),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  timezone: z.string().optional(),
  // "Mantener sesión abierta" (ADR-081) — the single top-of-panel checkbox
  // governs Google too. Default false: persistence is strictly opt-in.
  rememberMe: z.boolean().optional().default(false),
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptAge: z.boolean().optional(),
  acceptMarketing: z.boolean().optional().default(false),
  fbClickId: z.string().optional(),
  fbBrowserId: z.string().optional(),
  attribution: attributionSchema,
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const activateCorporateSchema = z.object({
  activationToken: z.string().min(1),
  displayName: z.string().min(2).max(50).optional(),
  username: z.string().min(3).max(20).optional(),
  password: z.string().min(8).max(200).optional().refine(
    (val) => !val || isPasswordValid(val),
    { message: "Password must contain at least 1 uppercase letter and 1 number" }
  ),
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptAge: z.boolean().optional(),
});

// ─── Routes ──────────────────────────────────────────────────

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    const result = await registerUser(parsed.data, auditCtx(req));
    // Persistence is opt-in via the login checkbox only — a fresh signup gets a
    // normal 4h session; the user opts in next time they log in. (ADR-081)
    await establishSession(res, result.user, { persistent: false, ctx: auditCtx(req) });
    return sendCreated(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    const result = await loginUser(parsed.data.email, parsed.data.password, auditCtx(req));
    await establishSession(res, result.user, {
      persistent: parsed.data.rememberMe,
      ctx: auditCtx(req),
    });
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    await requestPasswordReset(parsed.data.email, auditCtx(req));
  } catch (err) {
    if (err instanceof ServiceError) return handleServiceError(res, err);
    throw err;
  }
  // Always 200 to prevent email enumeration
  return sendOk(res);
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    await resetPassword(parsed.data.token, parsed.data.newPassword, auditCtx(req));
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

authRouter.post("/google", async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    const result = await authenticateWithGoogle(parsed.data, auditCtx(req));
    await establishSession(res, result.user, { persistent: parsed.data.rememberMe, ctx: auditCtx(req) });
    return sendData(res, { user: result.user, metaEventId: result.metaEventId });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /auth/verify-email?token=xxx (legacy — kept for backward compatibility)
authRouter.get("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.query);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { reason: "TOKEN_REQUIRED" });

  try {
    const result = await verifyEmail(parsed.data.token, auditCtx(req));
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /auth/verify-email — HI-02: token in body instead of URL
authRouter.post("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { reason: "TOKEN_REQUIRED" });

  try {
    const result = await verifyEmail(parsed.data.token, auditCtx(req));
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /auth/check-corporate-invite?token=xxx
authRouter.get("/check-corporate-invite", async (req, res) => {
  const { token: activationToken } = req.query;
  if (!activationToken || typeof activationToken !== "string") return sendBadRequest(res, "MISSING_TOKEN");

  try {
    const result = await checkCorporateInvite(activationToken);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /auth/activate-corporate
authRouter.post("/activate-corporate", async (req, res) => {
  const parsed = activateCorporateSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  // Read the current session cookie (if any) so the service can detect a
  // magic-link mismatch — i.e. someone logged in as Alice opening a link
  // addressed to Bob. We swallow verify errors silently because an invalid
  // or expired cookie is equivalent to "no session" for this check, not an
  // error to surface.
  let currentUserId: string | null = null;
  const sessionToken = getTokenFromCookies(req.cookies);
  if (sessionToken) {
    try {
      const payload = verifyToken(sessionToken);
      currentUserId = payload.userId ?? null;
    } catch {
      // Expired / malformed cookie → treat as anonymous, no mismatch.
    }
  }

  try {
    const result = await activateCorporateAccount(
      { ...parsed.data, currentUserId },
      auditCtx(req),
    );
    // Persistence is opt-in via the login checkbox only (ADR-081) — activation
    // gives a normal 4h session; the employee opts in on their next login.
    await establishSession(res, result.user, { persistent: false, ctx: auditCtx(req) });
    const status = result.alreadyExisted ? sendData : sendCreated;
    return status(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /auth/resend-verification
authRouter.post("/resend-verification", requireAuth, async (req, res) => {
  try {
    await resendVerification(req.auth!.userId, auditCtx(req));
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /auth/logout — revoke the current device's session (if any) + clear
// cookies. optionalAuth (not requireAuth) so logout still clears cookies even
// with an expired/invalid token.
authRouter.post("/logout", optionalAuth, async (req, res) => {
  if (req.auth?.sessionId) {
    await revokeSession(req.auth.sessionId, req.auth.userId).catch(() => {});
  }
  clearAuthCookies(res);
  return sendOk(res);
});

// POST /auth/refresh — silent renewal (ADR-081). Validates + rotates the
// refresh token, mints a fresh access JWT for the same session. The browser
// only sends the refresh cookie here (path-scoped). No requireAuth: the access
// token is expected to be expired.
authRouter.post("/refresh", async (req, res) => {
  const raw = getRefreshFromCookies(req.cookies);
  if (!raw) return sendUnauthorized(res, "UNAUTHENTICATED", { reason: "NO_REFRESH_TOKEN" });

  const result = await rotateRefresh(raw);
  if (!result.ok) {
    clearAuthCookies(res); // dead/rotated/expired refresh → fully log out
    return sendUnauthorized(res, "UNAUTHENTICATED", { reason: "REFRESH_INVALID" });
  }

  const token = signToken({
    userId: result.userId,
    platformRole: result.platformRole,
    sessionId: result.sessionId,
  });
  setAuthCookies(res, token, {
    isAdmin: result.platformRole === "ADMIN",
    persistent: true,
  });
  setRefreshCookie(res, result.newRefreshToken);
  return sendOk(res);
});

// GET /auth/sessions — active sessions for the profile panel.
authRouter.get("/sessions", requireAuth, async (req, res) => {
  const sessions = await listSessions(req.auth!.userId);
  const currentId = req.auth!.sessionId ?? null;
  return sendData(res, {
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      persistent: s.persistent,
      createdAtUtc: s.createdAtUtc,
      lastUsedAtUtc: s.lastUsedAtUtc,
      expiresAtUtc: s.expiresAtUtc,
      current: s.id === currentId,
    })),
  });
});

// POST /auth/sessions/revoke-others — "cerrar sesión en los demás dispositivos".
// Declared before the :id route so the literal path wins.
authRouter.post("/sessions/revoke-others", requireAuth, async (req, res) => {
  const revoked = await revokeOthersForUser(req.auth!.userId, req.auth!.sessionId ?? null);
  return sendData(res, { revoked });
});

// DELETE /auth/sessions/:id — revoke one device (scoped to the caller).
authRouter.delete("/sessions/:id", requireAuth, async (req, res) => {
  const sessionId = req.params.id;
  if (typeof sessionId !== "string" || !sessionId) {
    return sendBadRequest(res, "VALIDATION_ERROR", { reason: "SESSION_ID_REQUIRED" });
  }
  await revokeSession(sessionId, req.auth!.userId);
  return sendOk(res);
});
