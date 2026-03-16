import bcrypt from "bcrypt";

/** Hash a plain-text password using bcrypt (12 salt rounds). */
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(plainPassword, saltRounds);
}

/** Compare a plain-text password against a stored bcrypt hash. */
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
