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
import { inviteSendLimiter, inviteSendDailyLimiter } from "../middleware/rateLimit";
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
  resendInvitation,
  bulkResendExpired,
  type DerivedInviteStatus,
} from "../services/corporateService";
import { updateBranding } from "../services/corporateBrandingService";

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
const CORP_MIN_PARTICIPANTS = envInt("CORPORATE_POOL_MIN_PARTICIPANTS", 1);
const CORP_MAX_PARTICIPANTS = envInt("CORPORATE_POOL_MAX_PARTICIPANTS", 10000);

// ─── Schemas ─────────────────────────────────────────────────

const inquirySchema = z.object({
  companyName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().max(30).optional(),
  // Legacy tiered selector (kept for back-compat). The new quote panel
  // sends numberOfPools + slotsPerPool instead.
  employeeCount: z.enum(["1-50", "51-200", "201-500", "500+"]).optional(),
  // Quote-panel fields. Optional at the API boundary so legacy callers
  // still work; the quote panel always sends them.
  country: z.string().regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2").optional(),
  currency: z.enum(["COP", "USD"]).optional(),
  // Structured per-pool slot list (the quote panel sends this). When
  // present, the service will derive numberOfPools/slotsPerPool from
  // the array, ignoring whatever the client also sends in those fields.
  poolsConfig: z.array(z.number().int().min(1).max(10000)).min(1).max(50).optional(),
  numberOfPools: z.number().int().min(1).max(100).optional(),
  slotsPerPool: z.number().int().min(1).max(10000).optional(),
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
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #4F46E5)").optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #4F46E5)").optional(),
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

// PATCH /corporate/pools/:poolId/branding — every field is optional;
// `null` clears the field, a string sets it. Limits mirror the create
// schema so what's allowed at creation is also allowed at edit time.
const updateBrandingSchema = z.object({
  logoBase64: z
    .string()
    .max(700_000)
    .nullable()
    .optional()
    .refine(
      (val) => val == null || validateBase64Image(val) !== null,
      { message: "Logo must be a valid image (PNG, JPEG, GIF, or WebP)" },
    ),
  welcomeMessage: z.string().max(1000).nullable().optional(),
  invitationMessage: z.string().max(1000).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #4F46E5)")
    .nullable()
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #4F46E5)")
    .nullable()
    .optional(),
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

// GET /corporate/pools/:poolId/employees — Paginated list with search + multi-select status filter
corporateRouter.get("/pools/:poolId/employees", requireAuth, async (req, res) => {
  // Query params arrive as strings — coerce/validate before calling the service.
  const qs = req.query;

  let statusFilter: DerivedInviteStatus[] = [];
  if (typeof qs.status === "string" && qs.status.length > 0) {
    const allowed: ReadonlySet<DerivedInviteStatus> = new Set([
      "PENDING", "SENT", "ACTIVATED", "FAILED", "EXPIRED",
    ]);
    statusFilter = qs.status
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is DerivedInviteStatus => allowed.has(s as DerivedInviteStatus));
  }

  const page = typeof qs.page === "string" ? parseInt(qs.page, 10) : undefined;
  const limit = typeof qs.limit === "string" ? parseInt(qs.limit, 10) : undefined;

  try {
    const result = await listEmployees({
      userId: req.auth!.userId,
      poolId: req.params.poolId as string,
      search: typeof qs.search === "string" ? qs.search : undefined,
      statusFilter,
      page: Number.isFinite(page) ? page : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return sendData(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /corporate/pools/:poolId/employees/bulk-resend-expired — Reissue
// emails for every expired invite. Reuses the per-host invite send rate
// limit so this is not a way to bypass the bulk-send cap.
corporateRouter.post(
  "/pools/:poolId/employees/bulk-resend-expired",
  requireAuth,
  inviteSendLimiter,
  inviteSendDailyLimiter,
  async (req, res) => {
    try {
      const result = await bulkResendExpired({
        userId: req.auth!.userId,
        poolId: req.params.poolId as string,
      });
      return sendOk(res, result);
    } catch (err) {
      return handleServiceError(res, err);
    }
  },
);

// POST /corporate/pools/:poolId/send-invitations — Send invitations.
// Rate limit is per-host (200/hour, 1000/day) to absorb large rollouts while
// still capping abuse from a compromised account. Order matters: requireAuth
// first so the limiters can read req.auth.userId for keying.
corporateRouter.post("/pools/:poolId/send-invitations", requireAuth, inviteSendLimiter, inviteSendDailyLimiter, async (req, res) => {
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

// PATCH /corporate/pools/:poolId/branding — Edit organization branding
// after the pool exists. Host-only (CORPORATE_HOST / HOST / CO_ADMIN)
// for that pool. Pass `null` to clear a field; omit a field to leave
// it unchanged. Every successful change is recorded in
// OrganizationBrandingAudit.
corporateRouter.patch("/pools/:poolId/branding", requireAuth, async (req, res) => {
  const parsed = updateBrandingSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const result = await updateBranding(
      {
        userId: req.auth!.userId,
        poolId: req.params.poolId as string,
        payload: parsed.data,
      },
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

// POST /corporate/pools/:poolId/employees/:inviteId/resend — Resend a single
// invitation. Reuses the same per-user rate limit as bulk send (200/hour,
// 1000/day) keyed on req.auth.userId — a malicious host cannot use this
// endpoint to bypass the bulk limit.
corporateRouter.post(
  "/pools/:poolId/employees/:inviteId/resend",
  requireAuth,
  inviteSendLimiter,
  inviteSendDailyLimiter,
  async (req, res) => {
    try {
      const result = await resendInvitation({
        userId: req.auth!.userId,
        poolId: req.params.poolId as string,
        inviteId: req.params.inviteId as string,
      });
      return sendOk(res, result);
    } catch (err) {
      return handleServiceError(res, err);
    }
  },
);

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
