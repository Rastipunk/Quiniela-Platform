import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { adminTemplatesRouter } from "./routes/adminTemplates";
import { requireAuth } from "./middleware/requireAuth";
import { adminInstancesRouter } from "./routes/adminInstances";
import { poolsRouter } from "./routes/pools";
import { picksRouter } from "./routes/picks";
import { structuralPicksRouter } from "./routes/structuralPicks";
import { resultsRouter } from "./routes/results";
import { structuralResultsRouter } from "./routes/structuralResults";
import { groupStandingsRouter } from "./routes/groupStandings";
import { meRouter } from "./routes/me";
import { catalogRouter } from "./routes/catalog";
import { userProfileRouter } from "./routes/userProfile";
import { pickPresetsRouter } from "./routes/pickPresets";
import legalRouter from "./routes/legal";
import adminSettingsRouter from "./routes/adminSettings";
import { feedbackRouter } from "./routes/feedback";
import { corporateRouter } from "./routes/corporate";
import { adminCorporateRouter } from "./routes/adminCorporate";
import { apiLimiter, authLimiter, passwordResetLimiter, verificationResendLimiter, corporateInviteLimiter } from "./middleware/rateLimit";
import { startSmartSyncJob } from "./jobs/smartSyncJob";
import { startDeadlineReminderJob } from "./jobs/deadlineReminderJob";

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
app.use(express.json({ limit: "1mb" }));

// Global rate limiting
app.use(apiLimiter);

// Health check
const BUILD_VERSION = "v0.6.0";
const COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "local";

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
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

// Routes
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/admin", adminTemplatesRouter);
app.use("/admin", adminInstancesRouter);
app.use("/admin/settings", adminSettingsRouter);
app.use("/admin/corporate", adminCorporateRouter);
app.use("/pools", poolsRouter);
app.use("/pools", picksRouter);
app.use("/pools", structuralPicksRouter);
app.use("/pools", resultsRouter);
app.use("/pools", structuralResultsRouter);
app.use("/pools", groupStandingsRouter);
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
    res.status(403).json({ error: "CORS_ERROR", message: err.message });
    return;
  }

  console.error("[UNHANDLED ERROR]", err.stack || err.message);
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message,
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startSmartSyncJob();
  startDeadlineReminderJob();
});
