/**
 * Session service (persistent login, ADR-081).
 *
 * One Session row per device/login. The access JWT carries `sessionId`, so
 * `requireAuth` can reject a revoked device on its very next request. Only
 * "remember me" (persistent) sessions get an opaque refresh token (stored
 * sha256-hashed) and a long-lived refresh cookie; non-persistent sessions
 * expire with the 4h access token and behave like the legacy flow.
 *
 * No Express here — receives plain data, returns plain data.
 */

import crypto from "crypto";
import type { PlatformRole } from "@prisma/client";
import { prisma } from "../db";
import { SESSION } from "../lib/constants";

const REFRESH_TOKEN_BYTES = 48;

/** Opaque, URL-safe refresh token. The raw value goes in the cookie; only its
 *  hash is persisted, so a DB leak can't be replayed as a live token. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session for a fresh login. Persistent → long expiry + refresh token;
 * non-persistent → expires with the access token, no refresh token.
 */
export async function createSession(params: {
  userId: string;
  persistent: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ sessionId: string; refreshToken: string | null }> {
  const refreshToken = params.persistent ? generateRefreshToken() : null;
  const expiresAtUtc = new Date(
    Date.now() + (params.persistent ? SESSION.PERSISTENT_MS : SESSION.ACCESS_TTL_MS),
  );
  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      persistent: params.persistent,
      refreshTokenHash: refreshToken ? hashRefreshToken(refreshToken) : null,
      userAgent: params.userAgent ? params.userAgent.slice(0, 512) : null,
      ipAddress: params.ipAddress ?? null,
      expiresAtUtc,
    },
    select: { id: true },
  });
  return { sessionId: session.id, refreshToken };
}

export type RotateResult =
  | { ok: true; userId: string; platformRole: PlatformRole; sessionId: string; newRefreshToken: string }
  | { ok: false };

/**
 * Validate a presented refresh token and rotate it. Returns the data needed to
 * mint a new access JWT. Rotation is atomic (only the holder of the CURRENT
 * hash wins) so two concurrent refreshes — or a replayed old token — can't both
 * succeed. Slides the expiry to now + PERSISTENT window (stay logged in while
 * in use).
 */
export async function rotateRefresh(rawToken: string): Promise<RotateResult> {
  const hash = hashRefreshToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: { select: { id: true, platformRole: true, status: true } } },
  });
  const now = new Date();
  if (
    !session ||
    !session.persistent ||
    session.revokedAtUtc ||
    session.expiresAtUtc < now ||
    session.user.status !== "ACTIVE"
  ) {
    return { ok: false };
  }

  const newRefreshToken = generateRefreshToken();
  const rotated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: hash, revokedAtUtc: null },
    data: {
      refreshTokenHash: hashRefreshToken(newRefreshToken),
      lastUsedAtUtc: now,
      expiresAtUtc: new Date(now.getTime() + SESSION.PERSISTENT_MS),
    },
  });
  if (rotated.count === 0) return { ok: false };

  return {
    ok: true,
    userId: session.user.id,
    platformRole: session.user.platformRole,
    sessionId: session.id,
    newRefreshToken,
  };
}

/** Revoke one session — scoped to the owner (can't revoke someone else's). */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const res = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAtUtc: null },
    data: { revokedAtUtc: new Date() },
  });
  return res.count > 0;
}

/** "Log out everywhere else" — revoke all the user's sessions but the current. */
export async function revokeOthersForUser(userId: string, keepSessionId: string | null): Promise<number> {
  const res = await prisma.session.updateMany({
    where: {
      userId,
      revokedAtUtc: null,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    data: { revokedAtUtc: new Date() },
  });
  return res.count;
}

/** Active (non-revoked, non-expired) sessions for the panel. */
export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAtUtc: null, expiresAtUtc: { gt: new Date() } },
    orderBy: { lastUsedAtUtc: "desc" },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      persistent: true,
      createdAtUtc: true,
      lastUsedAtUtc: true,
      expiresAtUtc: true,
    },
  });
}

/**
 * Update lastUsedAt for the panel, throttled to at most once per 5 min per
 * session (conditional update — no write on every request). Fire-and-forget.
 */
export async function touchSession(sessionId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 5 * 60_000);
  await prisma.session
    .updateMany({
      where: { id: sessionId, lastUsedAtUtc: { lt: cutoff } },
      data: { lastUsedAtUtc: new Date() },
    })
    .catch(() => {});
}
