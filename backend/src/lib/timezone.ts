/**
 * Timezone validation helper.
 *
 * Uses Intl.DateTimeFormat to verify that a string is a valid IANA timezone.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
