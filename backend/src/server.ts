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
import legalRouter from "./routes/legal";
import { feedbackRouter } from "./routes/feedback";
import { corporateRouter } from "./routes/corporate";
import { sendOk, sendForbidden, sendInternal } from "./lib/apiResponse";
import { apiLimiter, authLimiter, passwordResetLimiter, verificationResendLimiter, corporateInviteLimiter } from "./middleware/rateLimit";
import { startSmartSyncJob, stopSmartSyncJob } from "./jobs/smartSyncJob";
import { startDeadlineReminderJob, stopDeadlineReminderJob } from "./jobs/deadlineReminderJob";
import { prisma } from "./db";

const app = express();

// Trust proxy — needed behind Railway's reverse proxy so rate-limit sees real client IP
app.set("trust proxy", 1);

// CORS — only allow our frontend origins
const ALLOWED_ORIGINS = [
  "https://picks4all.com",
  "https://www.picks4all.com",
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
app.use(express.json({ limit: "1mb" }));

// Global rate limiting
app.use(apiLimiter);

// Health check
const BUILD_VERSION = "v0.6.0";
const COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "local";

app.get("/health", (_req, res) => {
  sendOk(res, {
    version: BUILD_VERSION,
    commit: COMMIT_SHA,
    timestamp: new Date().toISOString(),
  });
});

// Stricter rate limiting for auth endpoints
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", passwordResetLimiter);
app.use("/auth/reset-password", passwordResetLimiter);
app.use("/auth/resend-verification", verificationResendLimiter);
app.use("/corporate/pools", corporateInviteLimiter);

// Routes — each path has a single composed router
app.use("/auth", authRouter);
app.use("/admin", adminRouter);       // composes: templates, instances, settings, corporate
app.use("/pools", poolsRouter);       // composes: picks, results, structural, groupStandings, members, invites, admin, overview
app.use("/me", meRouter);
app.use("/users", userProfileRouter);
app.use("/catalog", catalogRouter);
app.use("/pick-presets", pickPresetsRouter);
app.use("/legal", legalRouter);
app.use("/feedback", express.json({ limit: "2mb" }), feedbackRouter);
app.use("/corporate", corporateRouter);

// Global error handler — catches unhandled errors from all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // CORS errors
  if (err.message.includes("not allowed by CORS")) {
    sendForbidden(res, "CORS_ERROR", { message: err.message });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    // In production, log only the error message — stack traces may contain
    // query parameters, user data, or other sensitive information.
    console.error("[UNHANDLED ERROR]", err.message);
  } else {
    console.error("[UNHANDLED ERROR]", err.stack || err.message);
  }
  sendInternal(res, "INTERNAL_ERROR", {
    message: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message,
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startSmartSyncJob();
  startDeadlineReminderJob();
});

// Graceful shutdown — clean up on SIGTERM (Railway redeploy) and SIGINT (Ctrl+C)
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[SHUTDOWN] ${signal} received — shutting down gracefully...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log("[SHUTDOWN] HTTP server closed");
  });

  // 2. Stop cron jobs so no new DB work starts
  stopSmartSyncJob();
  stopDeadlineReminderJob();

  // 3. Disconnect Prisma (closes DB connection pool)
  try {
    await prisma.$disconnect();
    console.log("[SHUTDOWN] Prisma disconnected");
  } catch (err) {
    console.error("[SHUTDOWN] Error disconnecting Prisma:", err);
  }

  // 4. Force exit if cleanup takes too long
  const forceTimer = setTimeout(() => {
    console.error("[SHUTDOWN] Timed out — forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
