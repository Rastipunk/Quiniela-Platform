import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { adminTemplatesRouter } from "./routes/adminTemplates";
import { requireAuth } from "./middleware/requireAuth";
import { adminInstancesRouter } from "./routes/adminInstances";
import { poolsRouter } from "./routes/pools";
// import { poolsLockRouter } from "./routes/poolsLock"; // TODO: implementar
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
import { apiLimiter, authLimiter, passwordResetLimiter } from "./middleware/rateLimit";







const app = express();

app.use(cors());

// Comentario en español: MUY IMPORTANTE para que req.body no sea undefined
app.use(express.json({ limit: "1mb" }));

// Rate limiting global para toda la API (excepto health check)
app.use(apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "2026-01-18-v3" });
});

// Rate limiting específico para auth (más estricto)
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", passwordResetLimiter);
app.use("/auth/reset-password", passwordResetLimiter);

app.use("/auth", authRouter);

// Comentario en español: ping admin
app.use("/admin", adminRouter);

// Comentario en español: templates admin
app.use("/admin", adminTemplatesRouter);
app.use("/admin", adminInstancesRouter);
app.use("/admin/settings", adminSettingsRouter);
app.use("/pools", poolsRouter);
// app.use("/pools", poolsLockRouter); // TODO: implementar
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







app.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, auth: req.auth });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
