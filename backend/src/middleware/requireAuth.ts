import type { Request, Response, NextFunction } from "express";
import type { PlatformRole } from "@prisma/client";
import { verifyToken, type AuthTokenPayload } from "../lib/jwt";
import { prisma } from "../db";
import { getTokenFromCookies } from "../lib/authCookies";
import { sendUnauthorized } from "../lib/apiResponse";
import { touchSession } from "../services/sessionService";
import { fireAndForget } from "../lib/asyncHelpers";

type ResolvedAuth = { userId: string; platformRole: PlatformRole; sessionId?: string };
type ResolveResult =
  | { ok: true; auth: ResolvedAuth; touchSessionId?: string }
  | { ok: false; reason: string };

/**
 * Resolve the authenticated user from a verified token payload.
 *
 * Session-backed tokens (ADR-081, payload has `sessionId`) load the session
 * WITH its user in ONE query and reject a revoked/expired session — that is
 * what makes revoking a device take effect on its very next request. Legacy
 * tokens (no `sessionId`, issued before persistent sessions shipped) take the
 * original user-lookup path, so the deploy logs no one out.
 */
async function resolveAuthenticatedUser(payload: AuthTokenPayload): Promise<ResolveResult> {
  if (payload.sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });
    if (!session || session.revokedAtUtc) return { ok: false, reason: "SESSION_REVOKED" };
    if (session.expiresAtUtc < new Date()) return { ok: false, reason: "SESSION_EXPIRED" };
    if (!session.user) return { ok: false, reason: "USER_NOT_FOUND" };
    if (session.user.status !== "ACTIVE") return { ok: false, reason: "USER_NOT_ACTIVE" };
    return {
      ok: true,
      auth: { userId: session.user.id, platformRole: session.user.platformRole, sessionId: session.id },
      touchSessionId: session.id,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return { ok: false, reason: "USER_NOT_FOUND" };
  if (user.status !== "ACTIVE") return { ok: false, reason: "USER_NOT_ACTIVE" };
  return { ok: true, auth: { userId: user.id, platformRole: user.platformRole } };
}

/** Extract Bearer token from Authorization header */
function extractBearerToken(req: Request): string | null {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

// Middleware que requiere JWT válido y usuario activo
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Read token from httpOnly cookie first, fall back to Authorization header
    const token = getTokenFromCookies(req.cookies) || extractBearerToken(req);

    if (!token) {
      return sendUnauthorized(res, "UNAUTHENTICATED", { reason: "NO_AUTH_TOKEN" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (jwtError: any) {
      const errorName = jwtError?.name || "UnknownError";
      return sendUnauthorized(res, "UNAUTHENTICATED", {
        reason: errorName === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      });
    }

    // Validate user + session (revoked/expired → 401) in one resolver.
    const result = await resolveAuthenticatedUser(payload);
    if (!result.ok) {
      return sendUnauthorized(res, "UNAUTHENTICATED", { reason: result.reason });
    }

    req.auth = result.auth;
    if (result.touchSessionId) {
      fireAndForget("requireAuth:touch-session", touchSession(result.touchSessionId));
    }
    return next();
  } catch (error: any) {
    console.error("[AUTH] Unexpected error:", error instanceof Error ? error.message : String(error));
    return sendUnauthorized(res, "UNAUTHENTICATED", { reason: "INTERNAL_ERROR" });
  }
}

// Like requireAuth but does not fail if no token — sets req.auth if valid, otherwise proceeds anonymously
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromCookies(req.cookies) || extractBearerToken(req);
    if (!token) return next();

    const payload = verifyToken(token);
    const result = await resolveAuthenticatedUser(payload);
    if (result.ok) {
      req.auth = result.auth;
      if (result.touchSessionId) {
        fireAndForget("optionalAuth:touch-session", touchSession(result.touchSessionId));
      }
    }
  } catch {
    // Invalid token — proceed as anonymous
  }
  return next();
}
