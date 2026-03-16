/** Allowed base64 image prefixes (magic bytes). */
const ALLOWED_PREFIXES: { mime: string; prefix: string }[] = [
  { mime: "image/png", prefix: "iVBOR" },
  { mime: "image/jpeg", prefix: "/9j/" },
  { mime: "image/gif", prefix: "R0lGOD" },
  { mime: "image/webp", prefix: "UklGR" },
];

/**
 * Validate that a base64 string represents a real image by checking magic bytes.
 * Accepts both raw base64 and data-URI format (data:image/png;base64,...).
 * Returns the MIME type if valid, or null if not a recognized image.
 */
export function validateBase64Image(input: string): string | null {
  // Strip data-URI prefix if present
  const raw = input.includes(",") ? input.split(",")[1] : input;
  if (!raw) return null;

  for (const { mime, prefix } of ALLOWED_PREFIXES) {
    if (raw.startsWith(prefix)) return mime;
  }
  return null;
}
