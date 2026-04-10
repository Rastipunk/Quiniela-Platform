/**
 * Corporate Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send HTTP response.
 * All business logic lives in services/corporateService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../lib/constants";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendOk, sendCreated, sendBadRequest,
  sendForbidden, sendNotFound, sendConflict, sendInternal,
} from "../lib/apiResponse";
import { PoolPickTypesConfigSchema } from "../validation/pickConfig";
import { validateBase64Image } from "../lib/validateBase64Image";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";
import {
  submitInquiry,
  createCorporatePool,
  addEmployees,
  listEmployees,
  sendInvitations,
  deleteEmployee,
} from "../services/corporateService";

export const corporateRouter = Router();

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
      401: sendBadRequest,
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

// ─── Rate Limiters ───────────────────────────────────────────

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const inquiryLimiter = rateLimit({
  windowMs: envInt("RATE_LIMIT_CORP_INQUIRY_WINDOW_MS", 15 * 60 * 1000),
  max: envInt("RATE_LIMIT_CORP_INQUIRY_MAX", 5),
  message: { error: "RATE_LIMITED" },
});

// ─── Corporate pool capacity limits ──────────────────────────
const CORP_MIN_PARTICIPANTS = envInt("CORPORATE_POOL_MIN_PARTICIPANTS", 100);
const CORP_MAX_PARTICIPANTS = envInt("CORPORATE_POOL_MAX_PARTICIPANTS", 10000);

// ─── Schemas ─────────────────────────────────────────────────

const inquirySchema = z.object({
  companyName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().max(30).optional(),
  employeeCount: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
  message: z.string().max(2000).optional(),
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
});

const createCorporatePoolSchema = z.object({
  companyName: z.string().min(2).max(200),
  logoBase64: z.string().max(700_000).optional().refine(
    (val) => !val || validateBase64Image(val) !== null,
    { message: "Logo must be a valid image (PNG, JPEG, GIF, or WebP)" }
  ),
  welcomeMessage: z.string().max(1000).optional(),
  invitationMessage: z.string().max(1000).optional(),
  tournamentInstanceId: z.string().min(1),
  poolName: z.string().min(3).max(120),
  poolDescription: z.string().max(500).optional(),
  timeZone: z.string().optional(),
  deadlineMinutesBeforeKickoff: z.number().min(0).max(1440).optional(),
  requireApproval: z.boolean().optional(),
  pickTypesConfig: z.union([
    z.enum(["BASIC", "SIMPLE", "CUMULATIVE"]),
    PoolPickTypesConfigSchema,
  ]).optional(),
  maxParticipants: z.number().int().min(CORP_MIN_PARTICIPANTS).max(CORP_MAX_PARTICIPANTS).optional(),
  emails: z.array(z.string().email()).max(500).optional(),
});

const addEmployeesSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
});

// ─── Routes ──────────────────────────────────────────────────

// POST /corporate/inquiry — Public, no auth (contact form)
corporateRouter.post("/inquiry", inquiryLimiter, async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    const result = await submitInquiry(parsed.data);
    return sendCreated(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /corporate/pools — Create corporate pool (self-service, authenticated)
corporateRouter.post("/pools", requireAuth, async (req, res) => {
  const parsed = createCorporatePoolSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  const { pickTypesConfig, ...rest } = parsed.data;

  try {
    const result = await createCorporatePool(
      {
        ...rest,
        userId: req.auth!.userId,
        pickTypesConfig: pickTypesConfig as string | Record<string, unknown> | undefined,
      },
      auditCtx(req),
    );
    return sendCreated(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /corporate/pools/:poolId/employees — Add employees
corporateRouter.post("/pools/:poolId/employees", requireAuth, async (req, res) => {
  const parsed = addEmployeesSchema.safeParse(req.body);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  try {
    const result = await addEmployees({
      userId: req.auth!.userId,
      poolId: req.params.poolId as string,
      emails: parsed.data.emails,
    });
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /corporate/pools/:poolId/employees — List employees
corporateRouter.get("/pools/:poolId/employees", requireAuth, async (req, res) => {
  try {
    const result = await listEmployees(req.auth!.userId, req.params.poolId as string);
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /corporate/pools/:poolId/send-invitations — Send invitations
corporateRouter.post("/pools/:poolId/send-invitations", requireAuth, async (req, res) => {
  try {
    const result = await sendInvitations(
      { userId: req.auth!.userId, poolId: req.params.poolId as string },
      auditCtx(req),
    );
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /corporate/csv-template — Download CSV template
corporateRouter.get("/csv-template", (_req, res) => {
  const bom = "\uFEFF";
  const csv = bom + "email,nombre\nempleado1@empresa.com,Juan Perez\nempleado2@empresa.com,Maria Garcia\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=empleados_template.csv");
  return res.send(csv);
});

// DELETE /corporate/pools/:poolId/employees/:inviteId — Remove pending employee
corporateRouter.delete("/pools/:poolId/employees/:inviteId", requireAuth, async (req, res) => {
  try {
    await deleteEmployee({
      userId: req.auth!.userId,
      poolId: req.params.poolId as string,
      inviteId: req.params.inviteId as string,
    });
    return sendOk(res);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
