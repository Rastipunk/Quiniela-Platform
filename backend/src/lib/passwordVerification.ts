/**
 * Servicio modular de verificación de contraseña
 * 
 * Usado para acciones críticas que requieren confirmar identidad del usuario:
 * - Expulsar jugadores
 * - Eliminar pool
 * - Cambiar configuraciones críticas
 * - Transferir ownership
 * etc.
 */

import { prisma } from "../db";
import { verifyPassword } from "./password";

export type PasswordVerificationResult = {
  verified: boolean;
  error?: string;
};

/**
 * Verifica que la contraseña proporcionada coincida con la del usuario autenticado
 * 
 * @param userId - ID del usuario que intenta realizar la acción
 * @param password - Contraseña en texto plano para verificar
 * @returns Objeto con verified: true/false y mensaje de error opcional
 */
export async function verifyUserPassword(
  userId: string,
  password: string
): Promise<PasswordVerificationResult> {
  // Validar que se proporcionó contraseña
  if (!password || password.trim().length === 0) {
    return {
      verified: false,
      error: "Password is required for this action",
    };
  }

  // Obtener usuario de la base de datos
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, googleId: true },
  });

  if (!user) {
    return {
      verified: false,
      error: "User not found",
    };
  }

  // Si el usuario usa Google OAuth (no tiene password local)
  if (user.googleId && !user.passwordHash) {
    return {
      verified: false,
      error: "This account uses Google sign-in and does not have a password. Please use alternative verification.",
    };
  }

  // Verificar contraseña
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return {
      verified: false,
      error: "Incorrect password",
    };
  }

  return {
    verified: true,
  };
}

/**
 * Middleware helper para verificar contraseña desde request body
 * 
 * Uso en routes:
 * ```typescript
 * const verification = await verifyUserPassword(req.auth!.userId, req.body.password);
 * if (!verification.verified) {
 *   return res.status(401).json({ error: "UNAUTHORIZED", message: verification.error });
 * }
 * ```
 */
export async function requirePasswordVerification(
  userId: string,
  password: string | undefined
): Promise<{ success: boolean; error?: { status: number; error: string; message: string } }> {
  if (!password) {
    return {
      success: false,
      error: {
        status: 400,
        error: "VALIDATION_ERROR",
        message: "Password verification required for this action",
      },
    };
  }

  const verification = await verifyUserPassword(userId, password);

  if (!verification.verified) {
    return {
      success: false,
      error: {
        status: 401,
        error: "UNAUTHORIZED",
        message: verification.error || "Password verification failed",
      },
    };
  }

  return { success: true };
}
