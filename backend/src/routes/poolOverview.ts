/**
 * Pool Overview Routes — Thin HTTP layer.
 *
 * Each handler: parse params/query → call service → send HTTP response.
 * All business logic lives in services/poolOverviewService.ts.
 */

import { Router } from "express";
import {
  sendData,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendInternal,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import { getPoolOverview } from "../services/poolOverviewService";

export const poolOverviewRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────

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

// ─── Routes ──────────────────────────────────────────────────

// GET /pools/:poolId/overview
poolOverviewRouter.get("/:poolId/overview", async (req, res) => {
  const { poolId } = req.params;
  const leaderboardVerbose =
    req.query.leaderboardVerbose === "1" || req.query.leaderboardVerbose === "true";

  try {
    const data = await getPoolOverview(req.auth!.userId, poolId, leaderboardVerbose);
    return sendData(res, data);
  } catch (err) {
    return handleServiceError(res, err);
  }
});
