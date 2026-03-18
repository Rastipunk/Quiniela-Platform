// Helper para formateo de fechas con timezone del usuario

const LOCALE_MAP: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  pt: "pt-BR",
};

/**
 * Formatea una fecha UTC a la zona horaria del usuario
 */
export function formatMatchDateTime(utcDate: string, userTimezone: string | null, locale: string = "es"): string {
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) return utcDate; // Return original string as fallback
  const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const bcp47 = LOCALE_MAP[locale] || LOCALE_MAP.es;

  return new Intl.DateTimeFormat(bcp47, {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
