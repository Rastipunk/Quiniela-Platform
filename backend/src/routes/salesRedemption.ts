/**
 * Customer-facing CC redemption endpoint.
 *
 * Requires authentication (any logged-in user can redeem) but NOT
 * admin. The endpoint resolves a redemption code into a CC summary
 * the wizard can use to lock its capacity (commit 12 frontend).
 *
 * IMPORTANT: this does NOT yet lock the CC into REDEEMED — that
 * happens later inside paymentService.initiateCheckout (commit 6)
 * when the customer actually starts the checkout. This endpoint is
 * a pure lookup so the wizard can preview the CC before the user
 * commits.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import {
  sendData, sendBadRequest, sendNotFound, sendConflict, sendInternal,
} from "../lib/apiResponse";
import { findByRedemptionCode } from "../services/sales/accountReceivableService";

export const salesRedemptionRouter = Router();

salesRedemptionRouter.use(requireAuth);

const redeemSchema = z.object({
  // Accept any 8-12 char input; the lookup normalises to 8 digits.
  redemptionCode: z.string().min(8).max(12),
});

salesRedemptionRouter.post("/redeem", async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  try {
    const cc = await findByRedemptionCode(parsed.data.redemptionCode);
    if (!cc) {
      return sendNotFound(res, "NOT_FOUND", { message: "Redemption code not found" });
    }

    // Status pre-checks so the frontend can render a clear message
    // without redeeming. The actual atomic lock happens at checkout.
    if (cc.status === "PAID") {
      return sendConflict(res, "ALREADY_PAID", { message: "This account receivable was already paid" });
    }
    if (cc.status === "REDEEMED") {
      return sendConflict(res, "ALREADY_REDEEMED", { message: "This account receivable is already in checkout by another user" });
    }
    if (cc.status === "CANCELLED") {
      return sendConflict(res, "CANCELLED", { message: "This account receivable was cancelled" });
    }
    if (cc.status === "EXPIRED" || (cc.validUntil && cc.validUntil.getTime() < Date.now())) {
      return sendConflict(res, "EXPIRED", { message: "This account receivable expired" });
    }

    // PENDING — return the summary the wizard needs to apply.
    return sendData(res, {
      accountReceivable: {
        id: cc.id,
        consecutive: cc.consecutive,
        targetCapacity: cc.targetCapacity,
        currency: cc.currency,
        amountCop: cc.amountCop,
        amountUsdCents: cc.amountUsdCents,
        poolType: cc.poolType,
        clientLegalName: cc.clientLegalName,
        validUntil: cc.validUntil.toISOString(),
      },
    });
  } catch (err) {
    console.error("[salesRedemption] Unexpected error:", err);
    return sendInternal(res, "INTERNAL_ERROR");
  }
});
