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
import { countryToLocale } from "../lib/constants";

// Sub-routers — all admin-related routes composed here
import { adminTemplatesRouter } from "./adminTemplates";
import { adminInstancesRouter } from "./adminInstances";
import { adminSettingsRouter } from "./adminSettings";
import { adminCorporateRouter } from "./adminCorporate";

export const adminRouter = Router();

// Mount sub-routers
adminRouter.use("/", adminTemplatesRouter);
adminRouter.use("/", adminInstancesRouter);
adminRouter.use("/settings", adminSettingsRouter);
adminRouter.use("/corporate", adminCorporateRouter);

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
            locale: countryToLocale(user.country),
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
