// Helper para formateo de fechas con timezone del usuario

/**
 * Formatea una fecha UTC a la zona horaria del usuario
 * @param utcDate - Fecha en formato ISO string (UTC)
 * @param userTimezone - Timezone IANA del usuario (ej: "America/Mexico_City") o null para usar timezone del navegador
 * @returns Fecha formateada en español con timezone del usuario
 */
export function formatMatchDateTime(utcDate: string, userTimezone: string | null): string {
  const date = new Date(utcDate);
  const timezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
