import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { PlatformRole } from "@prisma/client";

export type AuthTokenPayload = {
  userId: string;
  platformRole: PlatformRole;
};

// Helper para obtener fingerprint del secret (para debugging sin exponer el valor)
function getSecretFingerprint(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) return "NO_SECRET";
  // Crear hash corto del secret para identificación
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 8);
}

// Comentario en español: firma un JWT con expiración
export function signToken(payload: AuthTokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[JWT] signToken: JWT_SECRET is missing!");
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  const token = jwt.sign(payload, secret, { expiresIn: "4h" });

  // Log para debugging (solo primeros 20 chars del token)
  console.log(`[JWT] Token signed for user ${payload.userId}, secret fingerprint: ${getSecretFingerprint()}, token prefix: ${token.slice(0, 20)}...`);

  return token;
}

// Comentario en español: valida y decodifica el JWT
export function verifyToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[JWT] verifyToken: JWT_SECRET is missing!");
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  try {
    const payload = jwt.verify(token, secret) as AuthTokenPayload;

    // Log para debugging
    console.log(`[JWT] Token verified for user ${payload.userId}, secret fingerprint: ${getSecretFingerprint()}`);

    return payload;
  } catch (err: any) {
    // Log detallado del error
    console.error(`[JWT] Verification failed: ${err?.name || "UnknownError"} - ${err?.message || "No message"}`);
    console.error(`[JWT] Token prefix: ${token.slice(0, 20)}..., secret fingerprint: ${getSecretFingerprint()}`);
    throw err;
  }
}
