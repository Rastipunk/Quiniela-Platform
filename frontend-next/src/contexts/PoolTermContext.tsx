"use client";

import { createContext, useContext, useMemo, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  type PoolRegion,
  type PoolTermsES,
  DEFAULT_REGION,
  POOL_REGION_COOKIE,
  POOL_REGIONS,
  getPoolTermsES,
  getPoolTermParams,
  isValidRegion,
} from "@/lib/poolTerms";

// ---------------------------------------------------------------------------
// Storage keys & TTL
// ---------------------------------------------------------------------------

// The region was previously stored as a cookie set by the middleware so the
// Server Components could read it during render. That made every page
// dynamic (`Cache-Control: no-store`), which Search Console punishes — so
// we moved the source of truth to localStorage and read it client-side.
const STORAGE_KEY = "p4a_pool_region";
const STORAGE_TS_KEY = "p4a_pool_region_ts";
// Stored 1 year — same TTL the legacy cookie used. CF-IPCountry doesn't
// change often per device; refreshing once a year is plenty.
const STORAGE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface PoolTermContextValue {
  /** Current region key: "quiniela" | "polla" | "prode" | "penca" | "porra" */
  region: PoolRegion;
  /** Full Spanish grammatical variants */
  terms: PoolTermsES;
  /** Flat params object ready to spread into t("key", params) */
  params: Record<string, string>;
  /** All available regions (for the manual selector) */
  availableRegions: readonly PoolRegion[];
  /** Change region manually (writes localStorage + updates context) */
  setRegion: (region: PoolRegion) => void;
}

const PoolTermContext = createContext<PoolTermContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers — localStorage with safe fallbacks (private mode, SSR, etc.)
// ---------------------------------------------------------------------------

function readStoredRegion(): PoolRegion | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const tsRaw = window.localStorage.getItem(STORAGE_TS_KEY);
    if (!value || !isValidRegion(value)) return null;
    if (tsRaw) {
      const ts = Number(tsRaw);
      if (Number.isFinite(ts) && Date.now() - ts > STORAGE_TTL_MS) {
        // Expired — let the network detection refresh it.
        return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}

function writeStoredRegion(region: PoolRegion): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, region);
    window.localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  } catch {
    /* private mode / quota — silently ignore */
  }
}

// One-shot migration: if the legacy cookie is present and localStorage is
// empty, copy the cookie value over so users who already had a region
// detected don't need a fresh /api/region roundtrip after the deploy.
function migrateLegacyCookie(): PoolRegion | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${POOL_REGION_COOKIE}=`));
    if (!match) return null;
    const value = decodeURIComponent(match.split("=")[1] ?? "");
    if (!isValidRegion(value)) return null;
    writeStoredRegion(value);
    // Best-effort cookie cleanup so we stop sending it on every request
    // (which still adds bytes even if the server no longer reads it).
    document.cookie = `${POOL_REGION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return value;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PoolTermProviderProps {
  /**
   * Initial region used during SSR and first paint. The provider always
   * receives DEFAULT_REGION here in production — the server never knows the
   * visitor's real region anymore (that would re-introduce the cache-control
   * problem). After mount, the provider hydrates the real region from
   * localStorage or `/api/region` and re-renders descendants with it.
   */
  region: PoolRegion;
  locale: string;
  children: ReactNode;
}

export function PoolTermProvider({
  region: initialRegion,
  locale,
  children,
}: PoolTermProviderProps) {
  // Active region — starts as the SSR-safe default, then is replaced once
  // we've resolved the real region client-side. Components that consume
  // `usePoolTerm()` re-render at that moment.
  const [region, setRegionState] = useState<PoolRegion>(initialRegion);

  // Hydration effect: figure out the visitor's region exactly once per page
  // load. Order:
  //   1. localStorage (fast, already known).
  //   2. Legacy cookie (one-shot migration for users who had it pre-deploy).
  //   3. /api/region (uses CF-IPCountry, populates localStorage on success).
  // Falls back silently to `initialRegion` if all three are unavailable.
  useEffect(() => {
    const stored = readStoredRegion();
    if (stored) {
      if (stored !== initialRegion) setRegionState(stored);
      return;
    }
    const migrated = migrateLegacyCookie();
    if (migrated) {
      if (migrated !== initialRegion) setRegionState(migrated);
      return;
    }
    let cancelled = false;
    fetch("/api/region", { credentials: "omit" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { region?: string } | null) => {
        if (cancelled || !body || !isValidRegion(body.region)) return;
        writeStoredRegion(body.region);
        if (body.region !== initialRegion) setRegionState(body.region);
      })
      .catch(() => {
        // Network error — keep the default region. No retry; the user can
        // still pick manually from the footer selector.
      });
    return () => {
      cancelled = true;
    };
  }, [initialRegion]);

  const terms = useMemo(() => getPoolTermsES(region), [region]);
  const params = useMemo(
    () => getPoolTermParams(locale, region),
    [locale, region],
  );

  const setRegion = useCallback((newRegion: PoolRegion) => {
    if (!isValidRegion(newRegion)) return;
    writeStoredRegion(newRegion);
    setRegionState(newRegion);
    // No reload anymore — the entire tree subscribes to the context, so
    // calling setRegionState propagates the new wording immediately.
  }, []);

  const value = useMemo<PoolTermContextValue>(
    () => ({
      region,
      terms,
      params,
      availableRegions: POOL_REGIONS,
      setRegion,
    }),
    [region, terms, params, setRegion],
  );

  return (
    <PoolTermContext.Provider value={value}>
      {children}
    </PoolTermContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access pool terminology for the current user's region.
 *
 * Usage in components:
 * ```tsx
 * const { params } = usePoolTerm();
 * const t = useTranslations("common");
 * t("landing.feature1.title", params);  // "Crea tu polla en minutos"
 * ```
 */
export function usePoolTerm(): PoolTermContextValue {
  const ctx = useContext(PoolTermContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (shouldn't happen
    // in normal flow, but safe during SSR edge cases or tests).
    return {
      region: DEFAULT_REGION,
      terms: getPoolTermsES(DEFAULT_REGION),
      params: getPoolTermParams("es", DEFAULT_REGION),
      availableRegions: POOL_REGIONS,
      setRegion: () => {},
    };
  }
  return ctx;
}
