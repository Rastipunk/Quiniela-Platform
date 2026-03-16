import jwt from "jsonwebtoken";
import type { PlatformRole } from "@prisma/client";

export type AuthTokenPayload = {
  userId: string;
  platformRole: PlatformRole;
};

/** Sign a JWT with 4-hour expiry. */
export function signToken(payload: AuthTokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return jwt.sign(payload, secret, { expiresIn: "4h", algorithm: "HS256" });
}

/** Verify and decode a JWT. Throws on invalid/expired tokens. */
export function verifyToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return jwt.verify(token, secret, { algorithms: ["HS256"] }) as AuthTokenPayload;
}
