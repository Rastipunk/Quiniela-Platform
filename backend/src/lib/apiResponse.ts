import type { Response } from "express";

/**
 * Standardized API response helpers.
 * Use these instead of raw res.json() for consistent response shapes.
 *
 * Success: { data: T }
 * Error:   { error: string, message?: string }
 */

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendError(
  res: Response,
  status: number,
  error: string,
  message?: string,
): void {
  res.status(status).json({ error, ...(message ? { message } : {}) });
}

export function sendBadRequest(res: Response, error: string, message?: string): void {
  sendError(res, 400, error, message);
}

export function sendUnauthorized(res: Response, message?: string): void {
  sendError(res, 401, "UNAUTHORIZED", message);
}

export function sendForbidden(res: Response, message?: string): void {
  sendError(res, 403, "FORBIDDEN", message);
}

export function sendNotFound(res: Response, message?: string): void {
  sendError(res, 404, "NOT_FOUND", message);
}

export function sendConflict(res: Response, error: string, message?: string): void {
  sendError(res, 409, error, message);
}
