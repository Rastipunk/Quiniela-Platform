/**
 * Picks4All brand logo — purple gradient circle with "P".
 * Matches the OG image and apple-icon design.
 */
export function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.55,
        fontWeight: 800,
        color: "white",
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      P
    </span>
  );
}
