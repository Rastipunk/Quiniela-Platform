import type { Response } from "express";

/**
 * Standardized API response helpers.
 *
 * Conventions:
 *   Data queries  → sendData(res, { pools, total })   → 200 { pools, total }
 *   Mutations     → sendOk(res)                        → 200 { ok: true }
 *                   sendOk(res, { id })                → 200 { ok: true, id }
 *   Errors        → sendBadRequest(res, "message")     → 400 { error: "message" }
 *                   sendNotFound(res, "message")        → 404 { error: "message" }
 *
 * NEVER use `res.json()` or `res.status().json()` directly in routes.
 */

// ── Success ─────────────────────────────────────────────────────────

/** Send a direct JSON object (for GET/data endpoints). No wrapper. */
export function sendData<T extends Record<string, unknown>>(
  res: Response,
  data: T,
  status = 200,
): void {
  res.status(status).json(data);
}

/** Send `{ ok: true, ...extra }` (for mutations/actions). */
export function sendOk(
  res: Response,
  extra?: Record<string, unknown>,
): void {
  res.json({ ok: true, ...extra });
}

/** Send 201 with data (for resource creation). */
export function sendCreated<T extends Record<string, unknown>>(
  res: Response,
  data: T,
): void {
  res.status(201).json(data);
}

// ── Errors ──────────────────────────────────────────────────────────

/** Generic error response. Prefer the named helpers below. */
export function sendError(
  res: Response,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): void {
  res.status(status).json({ error, ...extra });
}

export function sendBadRequest(res: Response, error: string, extra?: Record<string, unknown>): void {
  sendError(res, 400, error, extra);
}

export function sendUnauthorized(res: Response, error = "Unauthorized", extra?: Record<string, unknown>): void {
  sendError(res, 401, error, extra);
}

export function sendForbidden(res: Response, error = "Forbidden", extra?: Record<string, unknown>): void {
  sendError(res, 403, error, extra);
}

export function sendNotFound(res: Response, error = "Not found", extra?: Record<string, unknown>): void {
  sendError(res, 404, error, extra);
}

export function sendConflict(res: Response, error: string, extra?: Record<string, unknown>): void {
  sendError(res, 409, error, extra);
}

export function sendGone(res: Response, error: string, extra?: Record<string, unknown>): void {
  sendError(res, 410, error, extra);
}

export function sendTooMany(res: Response, error: string, extra?: Record<string, unknown>): void {
  sendError(res, 429, error, extra);
}

export function sendInternal(res: Response, error = "Internal server error", extra?: Record<string, unknown>): void {
  sendError(res, 500, error, extra);
}
