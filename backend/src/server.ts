import "dotenv/config";
import { validateEnv } from "./lib/env";
validateEnv();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { poolsRouter } from "./routes/pools";
import { meRouter } from "./routes/me";
import { catalogRouter } from "./routes/catalog";
import { userProfileRouter } from "./routes/userProfile";
import { pickPresetsRouter } from "./routes/pickPresets";
import { legalRouter } from "./routes/legal";
import { feedbackRouter } from "./routes/feedback";
import { corporateRouter } from "./routes/corporate";
import { salesRedemptionRouter } from "./routes/salesRedemption";
import { publicRouter } from "./routes/publicRoutes";
import { sendOk, sendForbidden, sendInternal, sendNotFound } from "./lib/apiResponse";
import { logger } from "./lib/logger";
import { apiLimiter, authLimiter, authIpLimiter, passwordResetLimiter, verificationResendLimiter, corporateInviteCheckLimiter, corporateActivateLimiter } from "./middleware/rateLimit";
import { startSmartSyncJob, stopSmartSyncJob } from "./jobs/smartSyncJob";
import { startPlatformHealthJob, stopPlatformHealthJob } from "./jobs/platformHealthJob";
import { startEventLoopMonitor, stopEventLoopMonitor } from "./lib/eventLoopMonitor";
import { initAdminDashboardCache } from "./routes/adminAnalyticsDashboard";
import { disconnectReadonlyDb } from "./lib/readonlyDb";
import { startDeadlineReminderJob, stopDeadlineReminderJob } from "./jobs/deadlineReminderJob";
import { startNewMemberDigestJob, stopNewMemberDigestJob } from "./jobs/newMemberDigestJob";
import { startPhaseSyncJob, stopPhaseSyncJob } from "./jobs/phaseSyncJob";
import { startLiveScoresJob, stopLiveScoresJob } from "./jobs/liveScoresJob";
import { startFixtureTrackingJob, stopFixtureTrackingJob } from "./jobs/fixtureTrackingJob";
import { startFixtureVerificationJob, stopFixtureVerificationJob } from "./jobs/fixtureVerificationJob";
import { startTrackStatusCheckerJob, stopTrackStatusCheckerJob } from "./jobs/trackStatusCheckerJob";
import { startCapiRetryJob, stopCapiRetryJob } from "./jobs/capiRetryJob";
import { startPaymentReconcileJob, stopPaymentReconcileJob } from "./jobs/paymentReconcileJob";
import { startMpPaymentReconcileJob, stopMpPaymentReconcileJob } from "./jobs/mpPaymentReconcileJob";
import {
  startAccountReceivableExpiryJob,
  stopAccountReceivableExpiryJob,
} from "./jobs/accountReceivableExpiryJob";
import {
  startWelcomeEmailFallbackJob,
  stopWelcomeEmailFallbackJob,
} from "./jobs/welcomeEmailFallbackJob";
import { startCaprichoSanJob, stopCaprichoSanJob } from "./jobs/caprichoSanJob";
import { prisma } from "./db";

const app = express();

// Trust proxy — Railway's chain has TWO hops, not one. Verified
// empirically 2026-06-11 (RATE_LIMIT_INCIDENT_2026-06-10.md §E3): the
// edge (CDN77/DataCamp "hikari") appends itself to X-Forwarded-For, so
// the chain arrives as "client_ip, edge_ip". With `1`, Express resolved
// req.ip to the EDGE node and every user routed through it shared one
// rate-limit bucket (37 IPs for 1,950 users in AuditEvent). `2` makes
// req.ip the entry the edge wrote — the real client, spoof-safe (a
// client-forged XFF lands further left and is never reached).
app.set("trust proxy", 2);

// CORS — only allow our frontend origins (configurable via env)
const SITE_DOMAIN = process.env.SITE_DOMAIN || "picks4all.com";
const ALLOWED_ORIGINS = [
  `https://${SITE_DOMAIN}`,
  `https://www.${SITE_DOMAIN}`,
  ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(",") : []),
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000"] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(cookieParser());

// Polar webhook — must be BEFORE express.json() to receive raw body for signature verification
import { createWebhookHandler } from "./routes/payments";
app.post("/payments/webhook", express.raw({ type: "application/json" }), createWebhookHandler());

app.use(express.json({ limit: "1mb" }));

// Global rate limiting
app.use(apiLimiter);

// Health check
const BUILD_VERSION = "v1.0.0";
const COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "local";

app.get("/health", (_req, res) => {
  sendOk(res, {
    version: BUILD_VERSION,
    commit: COMMIT_SHA,
    timestamp: new Date().toISOString(),
  });
});

// Public invite preview (no auth required).
//
// Two fixes applied per CORPORATE_INVITES_IMPLEMENTATION.md commit 1:
//   1. `members.where` includes CORPORATE_HOST — pre-fix it only
//      matched HOST, so corporate pools always returned hostName=null
//      and the landing page read "te invita alguien".
//   2. Response now carries the pool's Organization (logo, colors,
//      welcomeMessage) when set, so the public landing page can
//      render the company's branding instead of the default
//      Picks4All gradient. Personal pools get `organization: null`.
app.get("/invite-preview/:code", async (req, res) => {
  try {
    const invite = await prisma.poolInvite.findUnique({
      where: { code: req.params.code },
      select: {
        id: true,
        expiresAtUtc: true,
        maxUses: true,
        uses: true,
        pool: {
          select: {
            id: true,
            name: true,
            status: true,
            tournamentInstance: {
              select: { name: true },
            },
            _count: {
              select: { members: { where: { status: "ACTIVE" } } },
            },
            members: {
              where: { role: { in: ["HOST", "CORPORATE_HOST"] } },
              take: 1,
              select: {
                user: { select: { displayName: true } },
              },
            },
            organization: {
              select: {
                name: true,
                logoBase64: true,
                primaryColor: true,
                secondaryColor: true,
                welcomeMessage: true,
                // Drives the invite landing's locale (ADR-062): the corporate
                // host's chosen invitation language. The landing redirects to
                // this locale's URL prefix so an English/PT invite never lands
                // on the Spanish default. Personal pools have no organization →
                // invitationLocale stays null → no redirect (unchanged).
                invitationLocale: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      return sendNotFound(res, "NOT_FOUND", { message: "Invite not found" });
    }

    const expired = invite.expiresAtUtc && invite.expiresAtUtc.getTime() < Date.now();
    const maxUsesReached = invite.maxUses != null && invite.uses >= invite.maxUses;

    return sendOk(res, {
      poolName: invite.pool.name,
      tournamentName: invite.pool.tournamentInstance?.name || null,
      hostName: invite.pool.members[0]?.user?.displayName || null,
      memberCount: invite.pool._count.members,
      status: invite.pool.status,
      valid: !expired && !maxUsesReached && invite.pool.status !== "ARCHIVED",
      organization: invite.pool.organization
        ? {
            name: invite.pool.organization.name,
            logoBase64: invite.pool.organization.logoBase64 ?? null,
            primaryColor: invite.pool.organization.primaryColor ?? null,
            secondaryColor: invite.pool.organization.secondaryColor ?? null,
            welcomeMessage: invite.pool.organization.welcomeMessage ?? null,
          }
        : null,
      // Locale the invite landing should render in. Only set for corporate
      // pools (personal pools → null → landing keeps the URL's locale).
      invitationLocale: invite.pool.organization?.invitationLocale ?? null,
    });
  } catch {
    return sendInternal(res, "INTERNAL_ERROR");
  }
});

// Service-to-service endpoint for picks4all-scores scraping service
// Authenticated via shared API key (SCORES_SERVICE_API_KEY env var)
app.get("/api/active-matches", async (req, res) => {
  const apiKey = process.env.SCORES_SERVICE_API_KEY;
  if (!apiKey) return sendNotFound(res, "NOT_CONFIGURED");

  const provided = req.headers["x-api-key"] || req.query.key;
  if (provided !== apiKey) return sendForbidden(res, "INVALID_API_KEY");

  try {
    // Find all AUTO instances with sync enabled
    const instances = await prisma.tournamentInstance.findMany({
      where: { resultSourceMode: "AUTO", syncEnabled: true, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        apiFootballLeagueId: true,
        apiFootballSeasonId: true,
        dataJson: true,
        matchMappings: {
          select: { internalMatchId: true, apiFootballFixtureId: true },
        },
      },
    });

    const now = new Date();
    const windowStart = new Date(now.getTime() - 3 * 60 * 60_000); // 3h ago (in-progress matches)
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000);  // Next 24h

    const activeMatches: Array<{
      fixtureId: number;
      internalMatchId: string;
      instanceId: string;
      instanceName: string;
      homeTeamName: string;
      awayTeamName: string;
      kickoffUtc: string;
      leagueId: number | null;
      season: number | null;
    }> = [];

    for (const inst of instances) {
      const data = inst.dataJson as { matches?: Array<{ id: string; homeTeamId: string; awayTeamId: string; kickoffUtc?: string }>; teams?: Array<{ id: string; name: string }> };
      const teams = data.teams || [];
      const matches = data.matches || [];
      const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id;

      for (const mapping of inst.matchMappings) {
        const match = matches.find(m => m.id === mapping.internalMatchId);
        if (!match?.kickoffUtc) continue;

        const kickoff = new Date(match.kickoffUtc);
        if (kickoff < windowStart || kickoff > windowEnd) continue;

        activeMatches.push({
          fixtureId: mapping.apiFootballFixtureId,
          internalMatchId: mapping.internalMatchId,
          instanceId: inst.id,
          instanceName: inst.name,
          homeTeamName: teamName(match.homeTeamId),
          awayTeamName: teamName(match.awayTeamId),
          kickoffUtc: match.kickoffUtc,
          leagueId: inst.apiFootballLeagueId,
          season: inst.apiFootballSeasonId,
        });
      }
    }

    return sendOk(res, {
      matches: activeMatches,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      timestamp: now.toISOString(),
    });
  } catch {
    return sendInternal(res, "INTERNAL_ERROR");
  }
});

// Stricter rate limiting for auth endpoints
// Two layers (ADR-071): per-IP ceiling first (bounds email-rotation
// stuffing from one IP), then the precise per-(email, IP) limiter.
app.use("/auth/login", authIpLimiter, authLimiter);
app.use("/auth/register", authIpLimiter, authLimiter);
app.use("/auth/forgot-password", passwordResetLimiter);
app.use("/auth/reset-password", passwordResetLimiter);
app.use("/auth/resend-verification", verificationResendLimiter);
app.use("/auth/check-corporate-invite", corporateInviteCheckLimiter);
app.use("/auth/activate-corporate", corporateActivateLimiter);
// /corporate/pools rate limiting now applied per-endpoint in routes/corporate.ts
// (only on the actual invitation-send action, keyed per-user instead of per-IP).

// Routes — each path has a single composed router
app.use("/auth", authRouter);
app.use("/admin", adminRouter);       // composes: templates, instances, settings, corporate
app.use("/pools", poolsRouter);       // composes: picks, results, structural, groupStandings, members, invites, admin, overview
app.use("/me", meRouter);
app.use("/users", userProfileRouter);
app.use("/catalog", catalogRouter);
app.use("/public", publicRouter); // no auth — shareable read-only artifacts (Evolución link)
app.use("/pick-presets", pickPresetsRouter);
app.use("/legal", legalRouter);
app.use("/feedback", express.json({ limit: "2mb" }), feedbackRouter);
app.use("/corporate", corporateRouter);
// Customer-facing CC redemption (authed, not admin-gated). The
// admin-side issuance routes live under /admin/sales/* — see
// routes/adminSales.ts.
app.use("/sales/account-receivables", salesRedemptionRouter);

// Unsubscribe route (public, no auth)
import { unsubscribeRouter } from "./routes/unsubscribe";
app.use("/unsubscribe", unsubscribeRouter);

// Resend webhook (email bounces/complaints)
import { resendWebhookRouter } from "./routes/resendWebhook";
app.use("/webhooks/resend", resendWebhookRouter);

// Payment routes (checkout + status — Polar webhook mounted above express.json, MP below)
import { paymentsRouter, createMpWebhookHandler } from "./routes/payments";
app.use("/payments", paymentsRouter);
app.post("/payments/mp-webhook", createMpWebhookHandler());

// Global error handler — catches unhandled errors from all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // CORS errors
  if (err.message.includes("not allowed by CORS")) {
    sendForbidden(res, "CORS_ERROR", { message: err.message });
    return;
  }

  logger.error("Unhandled route error", { error: err.message });
  sendInternal(res, "INTERNAL_ERROR", {
    message: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message,
  });
});

// Process-level error handlers — catch async errors outside request lifecycle
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled rejection", { error: reason instanceof Error ? reason.message : String(reason) });
});

process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  // Give time for the log to flush, then exit — the process is in an undefined state
  setTimeout(() => process.exit(1), 1000).unref();
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = app.listen(PORT, () => {
  logger.info("API started", { port: PORT, version: BUILD_VERSION, commit: COMMIT_SHA });
  startSmartSyncJob();
  startDeadlineReminderJob();
  startNewMemberDigestJob();
  startPhaseSyncJob();
  startFixtureTrackingJob();
  startLiveScoresJob();
  startFixtureVerificationJob();
  startTrackStatusCheckerJob();
  startCapiRetryJob();
  startPaymentReconcileJob();
  startMpPaymentReconcileJob();
  startAccountReceivableExpiryJob();
  startWelcomeEmailFallbackJob();
  startCaprichoSanJob();
  // Restore the persisted admin dashboard snapshot into memory so the view
  // survives deploys. Recompute is MANUAL (POST /dashboard/rebuild) — boot
  // does NOT recompute (except a one-time seed on a brand-new install).
  void initAdminDashboardCache();
  // Event-loop monitor must come up BEFORE the health job so the p99
  // it reports on the first tick reflects real activity, not zero.
  startEventLoopMonitor();
  startPlatformHealthJob();
  // Advancement timers live in memory — re-arm any advancement lost to
  // this restart (audit F3-7). Delayed so boot queries don't compete.
  setTimeout(() => {
    import("./services/advancementTrigger")
      .then(({ rearmPendingAdvancements }) => rearmPendingAdvancements())
      .catch((err) =>
        console.error(
          "[Server] rearmPendingAdvancements failed:",
          err instanceof Error ? err.message : String(err),
        ),
      );
  }, 45_000).unref();
});

// Graceful shutdown — clean up on SIGTERM (Railway redeploy) and SIGINT (Ctrl+C)
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info("Shutdown initiated", { signal });

  // 1. Stop accepting new connections
  server.close(() => {
    logger.info("HTTP server closed");
  });

  // 2. Stop cron jobs so no new DB work starts
  stopSmartSyncJob();
  stopDeadlineReminderJob();
  stopNewMemberDigestJob();
  stopPhaseSyncJob();
  stopLiveScoresJob();
  stopFixtureTrackingJob();
  stopFixtureVerificationJob();
  stopTrackStatusCheckerJob();
  stopCapiRetryJob();
  stopPaymentReconcileJob();
  stopMpPaymentReconcileJob();
  stopAccountReceivableExpiryJob();
  stopWelcomeEmailFallbackJob();
  stopCaprichoSanJob();
  stopPlatformHealthJob();
  stopEventLoopMonitor();
  await disconnectReadonlyDb();

  // 3. Disconnect Prisma (closes DB connection pool)
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (err) {
    logger.error("Error disconnecting Prisma", { error: err instanceof Error ? err.message : String(err) });
  }

  // 4. Force exit if cleanup takes too long
  const forceTimer = setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
