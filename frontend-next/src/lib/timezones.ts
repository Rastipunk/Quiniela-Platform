// Common timezones for pool configuration dropdown
// Sorted by region relevance (LATAM first, then NA, then Europe)

export const COMMON_TIMEZONES = [
  { value: "America/Bogota", label: "Colombia (UTC-5)" },
  { value: "America/Mexico_City", label: "México (UTC-6)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (UTC-3)" },
  { value: "America/Santiago", label: "Chile (UTC-4)" },
  { value: "America/Lima", label: "Perú (UTC-5)" },
  { value: "America/Montevideo", label: "Uruguay (UTC-3)" },
  { value: "America/Sao_Paulo", label: "Brasil (UTC-3)" },
  { value: "America/Caracas", label: "Venezuela (UTC-4)" },
  { value: "America/Panama", label: "Panamá (UTC-5)" },
  { value: "America/Guayaquil", label: "Ecuador (UTC-5)" },
  { value: "America/New_York", label: "Este EEUU (UTC-5)" },
  { value: "America/Los_Angeles", label: "Pacífico EEUU (UTC-8)" },
  { value: "Europe/Madrid", label: "España (UTC+1)" },
  { value: "Europe/London", label: "Reino Unido (UTC+0)" },
  { value: "Europe/Paris", label: "Francia (UTC+1)" },
  { value: "Europe/Berlin", label: "Alemania (UTC+1)" },
  { value: "Europe/Rome", label: "Italia (UTC+1)" },
  { value: "Europe/Lisbon", label: "Portugal (UTC+0)" },
] as const;
