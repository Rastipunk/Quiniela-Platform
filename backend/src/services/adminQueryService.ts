/**
 * Admin ad-hoc query service — validates and executes a single read-only
 * SQL statement against the read-only Postgres role.
 *
 * Security layers (defense in depth):
 *   1. Postgres role `picks4all_readonly` — SELECT-only grants. THE real
 *      write-protection: the DB physically cannot mutate via this client.
 *   2. statement validation here — single statement, must be SELECT/WITH,
 *      no DML/DDL keywords. (Layer-2 — gives clear errors; the role is
 *      what actually guarantees safety.)
 *   3. sensitive-identifier rejection — queries referencing secret columns
 *      (passwordHash, resetToken, …) are refused, defeating the
 *      `SELECT passwordHash AS x` aliasing bypass of output redaction.
 *   4. output redaction — any result key whose name matches a secret is
 *      replaced with "[REDACTED]" (belt-and-suspenders with layer 3).
 *   5. row cap — results truncated to maxRows; statement_timeout on the
 *      role caps runtime.
 *
 * Pure module: no Express. The route handles auth, audit and HTTP.
 */

import { getReadonlyDb } from "../lib/readonlyDb";

export class AdminQueryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AdminQueryError";
  }
}

const MAX_ROWS = parseInt(process.env.ADMIN_QUERY_MAX_ROWS || "1000", 10);

// Column names that must never leave the database through this tool.
// Used both to reject queries that mention them (layer 3) and to redact
// any result key that matches (layer 4).
const SENSITIVE_IDENTIFIERS = [
  "passwordHash",
  "resetToken",
  "emailVerificationToken",
  "activationToken",
];

// Write / DDL keywords. The read-only role already blocks these at the
// database; this is a layer-2 guard that returns a clear error instead of
// a Postgres permission failure.
const FORBIDDEN_KEYWORDS = [
  "insert", "update", "delete", "drop", "alter", "truncate",
  "create", "grant", "revoke", "merge", "copy", "vacuum",
  "reindex", "refresh", "comment",
];

/** Strip SQL comments so prefix/keyword checks see real tokens only. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/--[^\n]*/g, " ");        // line comments
}

export function validateQuery(rawSql: string): string {
  if (typeof rawSql !== "string" || rawSql.trim().length === 0) {
    throw new AdminQueryError("EMPTY_QUERY", "Query is empty.");
  }

  // Normalize: drop a single trailing semicolon, collapse for inspection.
  let sql = rawSql.trim();
  sql = sql.replace(/;\s*$/, "");

  const inspect = stripComments(sql);

  // Single statement only — no embedded semicolons after the trailing one
  // was removed. (A semicolon inside a string literal would false-positive;
  // acceptable for an operator-driven tool, and the role blocks writes
  // regardless.)
  if (inspect.includes(";")) {
    throw new AdminQueryError(
      "MULTIPLE_STATEMENTS",
      "Only a single statement is allowed (no embedded semicolons).",
    );
  }

  // Must be a read query: starts with SELECT or WITH (CTE).
  const head = inspect.trimStart().slice(0, 6).toLowerCase();
  const startsOk = head.startsWith("select") || head.startsWith("with ") || head.startsWith("with(");
  if (!startsOk) {
    throw new AdminQueryError(
      "NOT_A_SELECT",
      "Only SELECT (or WITH … SELECT) queries are allowed.",
    );
  }

  // Layer-2 keyword denylist (word-boundary so column names like
  // "updatedAtUtc" don't trip "update").
  const lower = inspect.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      throw new AdminQueryError(
        "FORBIDDEN_KEYWORD",
        `Query contains a forbidden keyword: "${kw}". This endpoint is read-only.`,
      );
    }
  }

  // Layer-3 sensitive-identifier rejection (defeats alias bypass).
  for (const id of SENSITIVE_IDENTIFIERS) {
    if (new RegExp(`\\b${id}\\b`, "i").test(inspect)) {
      throw new AdminQueryError(
        "SENSITIVE_COLUMN",
        `Query references a protected column: "${id}". Secrets cannot be read through this endpoint.`,
      );
    }
  }

  return sql;
}

/** Replace any sensitive-named key in each row with "[REDACTED]". */
function redactRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const lowerSet = new Set(SENSITIVE_IDENTIFIERS.map((s) => s.toLowerCase()));
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = lowerSet.has(k.toLowerCase()) ? "[REDACTED]" : v;
    }
    return out;
  });
}

/** Make Prisma raw results JSON-safe (BigInt → Number, Date → ISO). */
function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

export interface AdminQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  maxRows: number;
}

export async function runAdminQuery(rawSql: string): Promise<AdminQueryResult> {
  const sql = validateQuery(rawSql);

  const db = getReadonlyDb();
  if (!db) {
    throw new AdminQueryError(
      "NOT_CONFIGURED",
      "DATABASE_READONLY_URL is not set — the read-only query endpoint is disabled.",
    );
  }

  let result: unknown;
  try {
    result = await db.$queryRawUnsafe(sql);
  } catch (err) {
    // Surface the DB error message (e.g. a write attempt the role rejected,
    // or a syntax error) without leaking a stack trace.
    throw new AdminQueryError(
      "QUERY_FAILED",
      err instanceof Error ? err.message : String(err),
    );
  }

  const allRows = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const truncated = allRows.length > MAX_ROWS;
  const capped = truncated ? allRows.slice(0, MAX_ROWS) : allRows;
  const safe = (jsonSafe(redactRows(capped)) as Record<string, unknown>[]);

  return {
    rows: safe,
    rowCount: safe.length,
    truncated,
    maxRows: MAX_ROWS,
  };
}
