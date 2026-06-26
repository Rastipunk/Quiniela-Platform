/**
 * Public routes — NO authentication. Read-only, shareable artifacts.
 *
 * Currently: the "Evolución" bar-chart-race for a pool, resolved by its short
 * public share code (set by a member via POST /pools/:id/share-code). Returns a
 * curated, anonymous series (top-N, no viewer highlight).
 */

import { Router } from "express";
import { sendData, sendNotFound, sendForbidden, sendInternal, sendConflict, sendBadRequest } from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import { getPublicBarRace } from "../services/poolOverviewService";

export const publicRouter = Router();

// GET /public/evolution/:code — anonymous bar-race for a shared link.
publicRouter.get("/evolution/:code", async (req, res) => {
  const code = String(req.params.code ?? "");
  try {
    const data = await getPublicBarRace(code);
    return sendData(res, data);
  } catch (err) {
    if (err instanceof ServiceError) {
      const send = ({
        400: sendBadRequest,
        403: sendForbidden,
        404: sendNotFound,
        409: sendConflict,
        500: sendInternal,
      } as const)[err.statusHint] ?? sendInternal;
      send(res, err.code, err.extra);
      return;
    }
    throw err;
  }
});
