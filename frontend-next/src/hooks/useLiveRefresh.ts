"use client";

import { useEffect, useRef } from "react";

const envInt = (key: string, fallback: number) =>
  parseInt(process.env[key] || String(fallback), 10);

const POLL_INTERVAL_MS = envInt("NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS", 15_000);

/**
 * Auto-refresh hook for live match updates.
 *
 * When at least one match has `isLive: true`, polls `refetch` every 15s.
 * Cleans up automatically when no matches are live or component unmounts.
 */
export function useLiveRefresh(
  matches: Array<{ isLive?: boolean }>,
  refetch: () => Promise<void> | void,
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const hasLive = matches.some((m) => m.isLive);

  useEffect(() => {
    if (!hasLive) return;

    const id = setInterval(() => {
      refetchRef.current();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [hasLive]);
}
