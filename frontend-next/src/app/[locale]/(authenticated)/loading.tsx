/**
 * Generic streaming-SSR skeleton for authenticated routes.
 * Renders immediately on navigation while the segment fetches data.
 */
export default function AuthenticatedLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <span style={{ position: "absolute", left: -9999 }}>Loading…</span>
      <div
        style={{
          height: 64,
          borderRadius: 12,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)",
          backgroundSize: "200% 100%",
          animation: "p4a-skeleton-shimmer 1.4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: 240,
          borderRadius: 12,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)",
          backgroundSize: "200% 100%",
          animation: "p4a-skeleton-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}
