import jwt from "jsonwebtoken";
import type { PlatformRole } from "@prisma/client";

export type AuthTokenPayload = {
  userId: string;
  platformRole: PlatformRole;
};

// Comentario en español: firma un JWT con expiración
export function signToken(payload: AuthTokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return jwt.sign(payload, secret, { expiresIn: "4h" });
}

// Comentario en español: valida y decodifica el JWT
export function verifyToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }
  return jwt.verify(token, secret) as AuthTokenPayload;
}
