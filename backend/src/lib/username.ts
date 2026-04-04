// backend/src/lib/username.ts
// Validaciones y utilidades para usernames
import { RESERVED_USERNAMES } from "./constants";

/**
 * Valida que un username cumpla con las reglas:
 * - Solo alfanuméricos, guiones y guiones bajos
 * - Mínimo 3 caracteres, máximo 20
 * - No puede empezar ni terminar con guión o guión bajo
 */
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  // Trim y lowercase
  const clean = username.trim().toLowerCase();

  // Longitud
  if (clean.length < 3) {
    return { valid: false, error: "El username debe tener al menos 3 caracteres" };
  }

  if (clean.length > 20) {
    return { valid: false, error: "El username no puede tener más de 20 caracteres" };
  }

  // Solo alfanuméricos, guiones y guiones bajos
  const validPattern = /^[a-z0-9_-]+$/;
  if (!validPattern.test(clean)) {
    return {
      valid: false,
      error: "El username solo puede contener letras, números, guiones y guiones bajos",
    };
  }

  // No puede empezar ni terminar con guión o guión bajo
  if (/^[-_]|[-_]$/.test(clean)) {
    return {
      valid: false,
      error: "El username no puede empezar ni terminar con guión o guión bajo",
    };
  }

  if ((RESERVED_USERNAMES as readonly string[]).includes(clean)) {
    return { valid: false, error: "Este username está reservado" };
  }

  return { valid: true };
}

/**
 * Normaliza un username (trim + lowercase)
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
