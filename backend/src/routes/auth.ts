/**
 * Auth Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → set cookies → send response.
 * All business logic lives in services/authService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/requireAuth";
import { setAuthCookies, clearAuthCookies } from "../lib/authCookies";
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

// ─── Schemas ─────────────────────────────────────────────────

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
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
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
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptAge: z.boolean().optional(),
  acceptMarketing: z.boolean().optional().default(false),
  fbClickId: z.string().optional(),
  fbBrowserId: z.string().optional(),
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
    const token = signToken({ userId: result.user.id, platformRole: result.user.platformRole });
    setAuthCookies(res, token);
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
    const token = signToken({ userId: result.user.id, platformRole: result.user.platformRole });
    setAuthCookies(res, token);
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
    const token = signToken({ userId: result.user.id, platformRole: result.user.platformRole });
    setAuthCookies(res, token);
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

  try {
    const result = await activateCorporateAccount(parsed.data, auditCtx(req));
    const token = signToken({ userId: result.user.id, platformRole: result.user.platformRole });
    setAuthCookies(res, token);
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

// POST /auth/logout
authRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  return sendOk(res);
});
