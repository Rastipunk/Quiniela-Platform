/** Password must have at least 8 chars, 1 uppercase letter, and 1 number. */
export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
} as const;

export type PasswordCheck = {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
};

/** Check all password rules. Returns which rules pass/fail. */
export function checkPasswordRules(password: string): PasswordCheck {
  return {
    minLength: password.length >= PASSWORD_RULES.minLength,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

/** Returns true if all rules pass. */
export function isPasswordValid(password: string): boolean {
  const checks = checkPasswordRules(password);
  return checks.minLength && checks.hasUppercase && checks.hasNumber;
}
