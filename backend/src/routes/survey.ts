/**
 * Post-World-Cup survey routes (ADR-089) — thin HTTP layer.
 *
 * Lifecycle: GET /survey/status decides whether the client shows the modal;
 * POST /survey persists the three mandatory 1-10 scores (creates the row —
 * one per user, immutable scores); POST /survey/details appends the optional
 * expansion (comment, share consent, host dimensions). Host dimensions are
 * server-filtered: a non-host payload carrying them is silently stripped.
 *
 * Gating: SURVEY_ALLOWLIST + SURVEY_OPENS_AT/CLOSES_AT (lib/featureFlags),
 * fail-closed. Rate limiting is the global apiLimiter (server.ts).
 */

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { sendData, sendOk, sendBadRequest, sendForbidden, sendNotFound } from "../lib/apiResponse";
import {
  isSurveyAllowlisted,
  isSurveyOpenFor,
  getSurveyWindow,
} from "../lib/featureFlags";
import {
  surveySubmitSchema,
  surveyDetailsSchema,
  recommendBuckets,
  HOST_SCORE_FIELDS,
} from "../lib/surveyValidation";

export const surveyRouter = Router();
surveyRouter.use(requireAuth);

/** Roles that make a user a "host" for the survey (CO_ADMIN excluded — owner decision). */
const SURVEY_HOST_ROLES = ["HOST", "CORPORATE_HOST"] as const;

async function getSurveyContext(userId: string) {
  const [user, hostMembership, corporateMembership, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } }),
    prisma.poolMember.findFirst({
      where: { userId, role: { in: [...SURVEY_HOST_ROLES] } },
      select: { id: true },
    }),
    prisma.poolMember.findFirst({
      where: { userId, role: "CORPORATE_HOST" },
      select: { id: true },
    }),
    prisma.surveyResponse.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  return {
    email: user?.email ?? null,
    userLocale: user?.locale ?? null,
    isHost: hostMembership != null,
    isCorporateHost: corporateMembership != null,
    alreadySubmitted: existing != null,
  };
}

// GET /survey/status — the client's single source of truth for showing the
// modal. Window instants are returned (when allowlisted) so an open session
// can flip to visible via a local clock check without refetching.
surveyRouter.get("/status", async (req, res) => {
  const ctx = await getSurveyContext(req.auth!.userId);
  const allowlisted = isSurveyAllowlisted(ctx.email);
  const { opensAt, closesAt } = getSurveyWindow();

  return sendData(res, {
    open: isSurveyOpenFor(ctx.email),
    opensAtUtc: allowlisted && opensAt ? opensAt.toISOString() : null,
    closesAtUtc: allowlisted && closesAt ? closesAt.toISOString() : null,
    alreadySubmitted: ctx.alreadySubmitted,
    isHost: ctx.isHost,
  });
});

// POST /survey — persist the three mandatory scores. Idempotent: an existing
// response (any path — race included) answers { alreadySubmitted: true }
// without modifying the stored scores.
surveyRouter.post("/", async (req, res) => {
  const parsed = surveySubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const userId = req.auth!.userId;
  const ctx = await getSurveyContext(userId);
  if (!isSurveyOpenFor(ctx.email)) {
    return sendForbidden(res, "SURVEY_CLOSED");
  }
  if (ctx.alreadySubmitted) {
    return sendOk(res, { alreadySubmitted: true });
  }

  try {
    await prisma.surveyResponse.create({
      data: {
        userId,
        isHost: ctx.isHost,
        isCorporateHost: ctx.isCorporateHost,
        overallScore: parsed.data.overallScore,
        recommendScore: parsed.data.recommendScore,
        otherTournamentsScore: parsed.data.otherTournamentsScore,
        locale: parsed.data.locale ?? ctx.userLocale,
      },
    });
  } catch (err) {
    // Unique(userId) race: two tabs submitting together — first wins, both OK.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendOk(res, { alreadySubmitted: true });
    }
    throw err;
  }
  return sendOk(res, { submitted: true });
});

// POST /survey/details — append the optional expansion to the caller's own
// row. Everything optional; an effectively-empty payload is a successful
// no-op (the client's "Omitir" doesn't even call this).
surveyRouter.post("/details", async (req, res) => {
  const parsed = surveyDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }

  const userId = req.auth!.userId;
  const ctx = await getSurveyContext(userId);
  if (!isSurveyOpenFor(ctx.email)) {
    return sendForbidden(res, "SURVEY_CLOSED");
  }
  if (!ctx.alreadySubmitted) {
    return sendNotFound(res, "SURVEY_NOT_SUBMITTED");
  }

  const data: Record<string, unknown> = {};
  const comment = parsed.data.comment;
  if (comment !== undefined && comment !== "") data.comment = comment;
  if (parsed.data.shareConsent !== undefined) data.shareConsent = parsed.data.shareConsent;
  if (ctx.isHost) {
    for (const field of HOST_SCORE_FIELDS) {
      const v = parsed.data[field];
      if (v !== undefined) data[field] = v;
    }
  }
  if (Object.keys(data).length === 0) {
    return sendOk(res, { updated: false });
  }

  await prisma.surveyResponse.update({ where: { userId }, data });
  return sendOk(res, { updated: true });
});

// ─── Admin summary ───────────────────────────────────────────

export const surveyAdminRouter = Router();
surveyAdminRouter.use(requireAuth, requireAdmin);

// GET /admin/survey/summary — aggregate read for the owner: volumes, score
// averages, recommend buckets (1-10 scale), host-dimension averages, consent
// rate, and the latest shareable comments (the testimonial bank).
surveyAdminRouter.get("/summary", async (_req, res) => {
  const [total, hostCount, corporateCount, consentCount, averages, hostAverages, recommendRows, latestComments] =
    await Promise.all([
      prisma.surveyResponse.count(),
      prisma.surveyResponse.count({ where: { isHost: true } }),
      prisma.surveyResponse.count({ where: { isCorporateHost: true } }),
      prisma.surveyResponse.count({ where: { shareConsent: true, comment: { not: null } } }),
      prisma.surveyResponse.aggregate({
        _avg: { overallScore: true, recommendScore: true, otherTournamentsScore: true },
      }),
      prisma.surveyResponse.aggregate({
        where: { isHost: true },
        _avg: {
          hostCreateScore: true,
          hostInviteScore: true,
          hostLiveResultsScore: true,
          hostRulesScore: true,
          hostSupportScore: true,
        },
      }),
      prisma.surveyResponse.findMany({ select: { recommendScore: true } }),
      prisma.surveyResponse.findMany({
        where: { comment: { not: null } },
        orderBy: { createdAtUtc: "desc" },
        take: 20,
        select: {
          comment: true,
          shareConsent: true,
          isHost: true,
          isCorporateHost: true,
          createdAtUtc: true,
          user: { select: { displayName: true } },
        },
      }),
    ]);

  return sendData(res, {
    total,
    hosts: hostCount,
    corporateHosts: corporateCount,
    players: total - hostCount,
    averages: averages._avg,
    hostDimensionAverages: hostAverages._avg,
    recommend: recommendBuckets(recommendRows.map((r) => r.recommendScore)),
    consent: { shareableComments: consentCount },
    latestComments,
  });
});
