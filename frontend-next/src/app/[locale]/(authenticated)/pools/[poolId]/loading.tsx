/**
 * Streaming SSR skeleton for the pool detail route.
 *
 * Next.js renders this immediately while the page's async data resolves,
 * which improves perceived LCP and avoids a blank screen during navigation.
 */
export default function PoolLoading() {
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
      <span style={{ position: "absolute", left: -9999 }}>Loading pool…</span>
      <SkeletonBlock height={120} />
      <SkeletonBlock height={48} />
      <SkeletonBlock height={320} />
      <SkeletonBlock height={320} />
    </div>
  );
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 12,
        background:
          "linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)",
        backgroundSize: "200% 100%",
        animation: "p4a-skeleton-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
