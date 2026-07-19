/**
 * Admin Routes — Thin HTTP layer.
 *
 * Each handler: validate input → call service → send response.
 * All business logic lives in services/adminService.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  sendOk, sendData, sendBadRequest, sendNotFound, sendInternal,
  sendUnauthorized, sendForbidden, sendConflict,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import type { AuditContext } from "../services/authService";
import {
  getPlatformStats,
  seedWc2026,
  updateUclR16,
  auditR16LatePicks,
  fixR16Integrity,
} from "../services/adminService";
import { prisma } from "../db";
import { sendPredictionUpdateEmail } from "../lib/email";
import { writeAuditEvent } from "../lib/audit";
import { fireAndForget } from "../lib/asyncHelpers";
import { resolveUserLocale } from "../lib/constants";

// Sub-routers — all admin-related routes composed here
import { adminTemplatesRouter } from "./adminTemplates";
import { adminInstancesRouter } from "./adminInstances";
import { adminSettingsRouter } from "./adminSettings";
import { adminCorporateRouter } from "./adminCorporate";
import { analyticsHealthRouter } from "./analyticsHealth";
import { adminAnalyticsDashboardRouter } from "./adminAnalyticsDashboard";
import { adminSalesRouter } from "./adminSales";
import { surveyAdminRouter } from "./survey";
import { adminQueryRouter } from "./adminQuery";

export const adminRouter = Router();

// Mount the ad-hoc query router FIRST. It only defines POST /query and
// authenticates via its own static token (X-Admin-Query-Token), NOT the
// admin JWT. Mounting it ahead of the JWT-gated sub-routers below (which
// apply requireAuth/requireAdmin at router level on "/") ensures the
// token-auth path isn't pre-empted by a 401 from the JWT middleware.
// Every other path falls straight through to the routers that follow.
adminRouter.use("/", adminQueryRouter);

// Mount sub-routers
adminRouter.use("/", adminTemplatesRouter);
adminRouter.use("/", adminInstancesRouter);
adminRouter.use("/settings", adminSettingsRouter);
adminRouter.use("/corporate", adminCorporateRouter);
// Both analytics routers mount under /analytics — Express matches by
// path so /analytics/probe goes to the health router, /analytics/dashboard
// goes to the new dashboard router. Order matters only for path-overlap
// which we deliberately avoid.
adminRouter.use("/analytics", analyticsHealthRouter);
adminRouter.use("/analytics", adminAnalyticsDashboardRouter);
adminRouter.use("/sales", adminSalesRouter);
adminRouter.use("/survey", surveyAdminRouter); // ADR-089 summary

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

const fixR16IntegritySchema = z.object({
  dryRun: z.enum(["true", "false"]).optional().default("true"),
});

// ─── Routes ──────────────────────────────────────────────────

// Comentario en español: endpoint de prueba para validar RBAC admin
adminRouter.get("/ping", requireAuth, requireAdmin, (_req, res) => {
  sendOk(res, { admin: true });
});

// GET /admin/health/deep — on-demand platform health snapshot.
// Same collectors/thresholds the cron uses, evaluated synchronously.
// Useful to confirm a recovery before the next 5-min tick, or to
// drill into the value that triggered an alert email.
adminRouter.get(
  "/health/deep",
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    try {
      const { collectSnapshot, evaluateSnapshot } = await import(
        "../services/platformHealthService"
      );
      const snapshot = evaluateSnapshot(await collectSnapshot());
      const summary = {
        ok: snapshot.metrics.filter((m) => m.severity === "OK").length,
        warn: snapshot.metrics.filter((m) => m.severity === "WARN").length,
        critical: snapshot.metrics.filter((m) => m.severity === "CRITICAL").length,
      };
      sendOk(res, { ...snapshot, summary });
    } catch (err) {
      console.error("[GET /admin/health/deep] failed:", err);
      res.status(500).json({
        error: "HEALTH_SNAPSHOT_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

// GET /admin/stats — platform stats (users, pools, feedback)
adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const data = await getPlatformStats();
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// Bootstrap-admin disabled in production — use seed script for admin creation
adminRouter.post("/bootstrap-admin", (_req, res) => {
  sendNotFound(res, "Not found");
});

// GET /admin/matches/monitor — Operational view of every match in the
// live window: scraper state, tracking freshness, grace countdown and
// per-source result propagation across ACTIVE pools (audit §6, Etapa 3A).
adminRouter.get("/matches/monitor", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { getMatchMonitor } = await import("../services/matchMonitorService");
    const rows = await getMatchMonitor();
    return sendData(res, { matches: rows, generatedAt: new Date().toISOString() });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/matches/master-override — Apply a result override to EVERY
// ACTIVE pool of an instance at once (audit §6, Etapa 3B). Writes
// source=HOST_OVERRIDE (the scraper can never undo it), reason
// mandatory, silent by design (no member emails — scraper-correction
// path). Pools whose host already overrode are skipped unless
// overwriteHostOverrides=true.
const masterOverrideSchema = z
  .object({
    instanceId: z.string().min(1),
    matchId: z.string().min(1),
    homeGoals: z.number().int().min(0).max(99),
    awayGoals: z.number().int().min(0).max(99),
    homeGoals90: z.number().int().min(0).max(99).nullish(),
    awayGoals90: z.number().int().min(0).max(99).nullish(),
    homePenalties: z.number().int().min(0).max(99).nullish(),
    awayPenalties: z.number().int().min(0).max(99).nullish(),
    reason: z.string().trim().min(5).max(500),
    overwriteHostOverrides: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    const has90 = d.homeGoals90 != null || d.awayGoals90 != null;
    if (has90 && (d.homeGoals90 == null || d.awayGoals90 == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "goals90 requires BOTH sides" });
    }
    if (d.homeGoals90 != null && d.homeGoals90 > d.homeGoals) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "homeGoals90 cannot exceed homeGoals" });
    }
    if (d.awayGoals90 != null && d.awayGoals90 > d.awayGoals) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "awayGoals90 cannot exceed awayGoals" });
    }
    const hasPens = d.homePenalties != null || d.awayPenalties != null;
    if (hasPens && (d.homePenalties == null || d.awayPenalties == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "penalties require BOTH sides" });
    }
    if (hasPens && d.homeGoals !== d.awayGoals) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "penalties only apply to a drawn match" });
    }
  });

adminRouter.post("/matches/master-override", requireAuth, requireAdmin, async (req, res) => {
  const parsed = masterOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const { applyMasterOverride } = await import("../services/matchMonitorService");
    const summary = await applyMasterOverride({
      ...parsed.data,
      actorUserId: req.auth!.userId,
    });
    return sendData(res, summary as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof Error && (err.message === "INSTANCE_NOT_FOUND" || err.message === "MATCH_NOT_FOUND_IN_INSTANCE")) {
      return sendNotFound(res, err.message);
    }
    return handleServiceError(res, err);
  }
});

// POST /admin/matches/retrack — Force one fixture's re-registration with
// the scraper, immediately (audit §6, Etapa 3C).
const retrackSchema = z.object({
  instanceId: z.string().min(1),
  matchId: z.string().min(1),
});
adminRouter.post("/matches/retrack", requireAuth, requireAdmin, async (req, res) => {
  const parsed = retrackSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const { retrackMatch } = await import("../services/matchMonitorService");
    const result = await retrackMatch(parsed.data.instanceId, parsed.data.matchId, req.auth!.userId);
    return sendData(res, result as unknown as Record<string, unknown>);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/matches/master-scoring-override — Exclude a match from
// scoring (or re-enable it) across EVERY ACTIVE pool of the instance —
// the ABD tool (audit §6, Etapa 3C / F1-6).
const masterScoringSchema = z.object({
  instanceId: z.string().min(1),
  matchId: z.string().min(1),
  scoringEnabled: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});
adminRouter.post("/matches/master-scoring-override", requireAuth, requireAdmin, async (req, res) => {
  const parsed = masterScoringSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const { applyMasterScoringExclusion } = await import("../services/matchMonitorService");
    const result = await applyMasterScoringExclusion({
      ...parsed.data,
      actorUserId: req.auth!.userId,
    });
    return sendData(res, result as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof Error && (err.message === "INSTANCE_NOT_FOUND" || err.message === "MATCH_NOT_FOUND_IN_INSTANCE")) {
      return sendNotFound(res, err.message);
    }
    return handleServiceError(res, err);
  }
});

// POST /admin/jobs/trigger-fixture-tracking — Manually trigger fixtureTrackingJob
// Used to test the picks4all-scores integration end-to-end without waiting for the hourly cron.
adminRouter.post("/jobs/trigger-fixture-tracking", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { triggerFixtureTracking } = await import("../jobs/fixtureTrackingJob");
    fireAndForget("admin:trigger-fixture-tracking", triggerFixtureTracking());
    fireAndForget("audit:trigger-fixture-tracking", writeAuditEvent({
      actorUserId: req.auth!.userId,
      action: "manual_fixture_tracking_triggered",
      entityType: "Job",
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    }));
    return sendOk(res, { triggered: true, message: "Fixture tracking job triggered in background" });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// Endpoint para seedear WC2026 en producción (solo admin)
adminRouter.post("/seed-wc2026", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await seedWc2026();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/update-ucl-r16 — UCL R16 Update (from updateUclR16Draw script)
adminRouter.post("/update-ucl-r16", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await updateUclR16();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// GET /admin/audit/r16-late-picks — UCL R16 Audit: late picks
adminRouter.get("/audit/r16-late-picks", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await auditR16LatePicks();
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /admin/fix-r16-integrity?dryRun=true — UCL R16 Integrity Fix
adminRouter.post("/fix-r16-integrity", requireAuth, requireAdmin, async (req, res) => {
  const parsed = fixR16IntegritySchema.safeParse(req.query);
  if (!parsed.success) return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });

  const dryRun = parsed.data.dryRun !== "false"; // default true

  try {
    const result = await fixR16Integrity(dryRun);
    return sendOk(res, result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ─── Prediction Update Mass Send ────────────────────────────

const predictionUpdateSchema = z.object({
  changes: z.array(z.object({
    type: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
  })).min(1).max(50),
});

const PREDICTION_EMAIL_BATCH_SIZE = 10;
const PREDICTION_EMAIL_BATCH_DELAY_MS = 1_000;

// POST /admin/prediction-update — Send prediction update email to all subscribers
adminRouter.post("/prediction-update", requireAuth, requireAdmin, async (req, res) => {
  const parsed = predictionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten().fieldErrors });
  }

  const { changes } = parsed.data;

  // Query all subscribed users
  const subscribers = await prisma.user.findMany({
    where: {
      predictionUpdates: true,
      status: "ACTIVE",
      emailNotificationsEnabled: true,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      country: true,
    },
  });

  if (subscribers.length === 0) {
    return sendOk(res, { message: "No subscribers found.", emailsSent: 0 });
  }

  // Audit event for the mass send
  fireAndForget("audit:prediction-update-send", writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "prediction_update_mass_send",
    entityType: "PredictionUpdate",
    dataJson: { subscriberCount: subscribers.length, changesCount: changes.length },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  }));

  // Fire-and-forget: send emails in batches to avoid rate limits
  const totalSubscribers = subscribers.length;

  fireAndForget("prediction-update-emails", (async () => {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < subscribers.length; i += PREDICTION_EMAIL_BATCH_SIZE) {
      const batch = subscribers.slice(i, i + PREDICTION_EMAIL_BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((user) =>
          sendPredictionUpdateEmail({
            to: user.email,
            userId: user.id,
            displayName: user.displayName,
            locale: resolveUserLocale(user),
            changes,
          })
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.success) {
          sent++;
        } else {
          failed++;
        }
      }

      // Delay between batches (skip after last batch)
      if (i + PREDICTION_EMAIL_BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, PREDICTION_EMAIL_BATCH_DELAY_MS));
      }
    }

    console.log(`✅ Prediction update mass send complete: ${sent} sent, ${failed} failed out of ${totalSubscribers}`);
  })());

  // Return immediately — emails are sent in background
  return sendOk(res, {
    message: "Prediction update emails queued.",
    emailsQueued: totalSubscribers,
  });
});
