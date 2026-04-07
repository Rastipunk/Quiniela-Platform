/**
 * Picks4All brand assets — uses the official brand SVGs/PNGs from /public/brand/
 *
 * Three components:
 * - BrandIsotipo: square logo with gradient background (favicon, profile pic style)
 * - BrandLogotipo: horizontal logo with text (header, navbar)
 * - BrandLogo: legacy alias for BrandIsotipo (kept for backwards compatibility)
 */

interface BrandIsotipoProps {
  /** Pixel size (default: 32) */
  size?: number;
  /** Visual variant */
  variant?: "degradado" | "transparente-blanca" | "transparente-degradado";
  /** Optional className */
  className?: string;
}

/**
 * Square isotipo — the "P" symbol.
 * - degradado: gradient background, white P (use anywhere)
 * - transparente-blanca: transparent bg, white P (use on dark backgrounds only)
 * - transparente-degradado: transparent bg, gradient P (use on light backgrounds only)
 */
export function BrandIsotipo({ size = 32, variant = "degradado", className }: BrandIsotipoProps) {
  // Choose the best size variant available
  const fileSize = size <= 40 ? 32 : size <= 200 ? 180 : size <= 400 ? 320 : 500;
  const ext = variant === "degradado" ? "png" : "svg";
  const src = `/brand/isotipo-${variant}-${fileSize}.${ext}`;

  return (
    <img
      src={src}
      alt="Picks4All"
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", flexShrink: 0 }}
    />
  );
}

interface BrandLogotipoProps {
  /** Height in pixels (default: 40) — width auto-scales */
  height?: number;
  /** Visual variant — "blanco" for dark bg, "degradado" for light bg */
  variant?: "blanco" | "degradado";
  /** Optional className */
  className?: string;
}

/**
 * Horizontal logotipo — full "Picks4All" wordmark with the P icon.
 */
export function BrandLogotipo({ height = 40, variant = "blanco", className }: BrandLogotipoProps) {
  // Choose the best size variant: 40, 80, or 120
  const fileSize = height <= 50 ? 40 : height <= 100 ? 80 : 120;
  const src = `/brand/logotipo-${variant}-${fileSize}.svg`;

  return (
    <img
      src={src}
      alt="Picks4All"
      height={height}
      className={className}
      style={{ display: "inline-block", height, width: "auto", flexShrink: 0 }}
    />
  );
}

/**
 * Legacy alias — defaults to the gradient isotipo.
 * Kept for backwards compatibility with existing components.
 */
export function BrandLogo({ size = 28 }: { size?: number }) {
  return <BrandIsotipo size={size} variant="degradado" />;
}
