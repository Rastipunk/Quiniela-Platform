/**
 * POST /admin/query — admin-only ad-hoc read-only SQL.
 *
 * Auth is a dedicated static token (ADMIN_QUERY_TOKEN), compared in
 * constant time, sent as the `X-Admin-Query-Token` header. This is a
 * standalone credential (not a 4 h human JWT) precisely so the tool can
 * be driven programmatically; it is read-only, audited, and the
 * underlying Postgres role cannot write — see adminQueryService.
 *
 * Every call writes an AuditEvent (ADMIN_QUERY_EXECUTED) regardless of
 * success, recording the SQL, row count and outcome.
 */

import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { writeAuditEvent } from "../lib/audit";
import { runAdminQuery, AdminQueryError } from "../services/adminQueryService";

export const adminQueryRouter = Router();

const bodySchema = z.object({
  sql: z.string().min(1).max(20_000),
});

function tokenValid(provided: string | undefined): boolean {
  const expected = process.env.ADMIN_QUERY_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first, and still do
  // a dummy compare so the failure path doesn't leak length via timing.
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

adminQueryRouter.post("/query", async (req, res) => {
  // Auth — dedicated token only.
  if (!process.env.ADMIN_QUERY_TOKEN) {
    return res.status(503).json({
      error: "NOT_CONFIGURED",
      message: "ADMIN_QUERY_TOKEN is not set — endpoint disabled.",
    });
  }
  const provided = req.get("x-admin-query-token") ?? undefined;
  if (!tokenValid(provided)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const sql = parsed.data.sql;
  const ip = req.ip ?? null;
  const userAgent = req.get("user-agent") ?? null;

  try {
    const result = await runAdminQuery(sql);

    // Fire-and-forget audit — never block the response, never let an audit
    // failure mask a successful read.
    writeAuditEvent({
      action: "ADMIN_QUERY_EXECUTED",
      entityType: "AdminQuery",
      dataJson: { sql, rowCount: result.rowCount, truncated: result.truncated, outcome: "OK" },
      ip,
      userAgent,
    }).catch((e) =>
      console.error("[adminQuery] audit write failed:", e instanceof Error ? e.message : String(e)),
    );

    return res.json(result);
  } catch (err) {
    const code = err instanceof AdminQueryError ? err.code : "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : String(err);

    writeAuditEvent({
      action: "ADMIN_QUERY_EXECUTED",
      entityType: "AdminQuery",
      dataJson: { sql, outcome: "ERROR", code, message },
      ip,
      userAgent,
    }).catch(() => { /* already logging the primary error below */ });

    // 503 when the endpoint isn't configured; 400 for everything else
    // (bad/unsafe query). Never 500 with a stack trace.
    const status = code === "NOT_CONFIGURED" ? 503 : 400;
    return res.status(status).json({ error: code, message });
  }
});
