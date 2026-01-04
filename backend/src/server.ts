import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { adminTemplatesRouter } from "./routes/adminTemplates";
import { requireAuth } from "./middleware/requireAuth";
import { adminInstancesRouter } from "./routes/adminInstances";
import { poolsRouter } from "./routes/pools";
import { poolsLockRouter } from "./routes/poolsLock";
import { picksRouter } from "./routes/picks";
import { resultsRouter } from "./routes/results";
import { meRouter } from "./routes/me";
import { catalogRouter } from "./routes/catalog";







const app = express();

app.use(cors());

// Comentario en español: MUY IMPORTANTE para que req.body no sea undefined
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);

// Comentario en español: ping admin
app.use("/admin", adminRouter);

// Comentario en español: templates admin
app.use("/admin", adminTemplatesRouter);
app.use("/admin", adminInstancesRouter);
app.use("/pools", poolsRouter);
app.use("/pools", poolsLockRouter);
app.use("/pools", picksRouter);
app.use("/pools", resultsRouter);
app.use("/me", meRouter);
app.use("/catalog", catalogRouter);







app.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, auth: req.auth });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
