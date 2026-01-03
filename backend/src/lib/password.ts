import bcrypt from "bcrypt";

// Comentario en español: hashea contraseñas de forma segura
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(plainPassword, saltRounds);
}

// Comentario en español: valida contraseña contra el hash guardado
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
