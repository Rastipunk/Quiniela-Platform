"use client";

import { createContext, useContext, useMemo, useCallback } from "react";
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
  /** Change region manually (sets cookie + triggers re-render) */
  setRegion: (region: PoolRegion) => void;
}

const PoolTermContext = createContext<PoolTermContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PoolTermProviderProps {
  region: PoolRegion;
  locale: string;
  children: ReactNode;
}

export function PoolTermProvider({
  region: initialRegion,
  locale,
  children,
}: PoolTermProviderProps) {
  // We use a state-like approach via useMemo. Since region changes are rare
  // (only when user manually switches), a full page reload on change is acceptable.
  const terms = useMemo(() => getPoolTermsES(initialRegion), [initialRegion]);
  const params = useMemo(
    () => getPoolTermParams(locale, initialRegion),
    [locale, initialRegion],
  );

  const setRegion = useCallback((newRegion: PoolRegion) => {
    if (!isValidRegion(newRegion)) return;
    // Update cookie
    document.cookie = `${POOL_REGION_COOKIE}=${newRegion};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    // Reload to reflect changes across all server-rendered content
    window.location.reload();
  }, []);

  const value = useMemo<PoolTermContextValue>(
    () => ({
      region: initialRegion,
      terms,
      params,
      availableRegions: POOL_REGIONS,
      setRegion,
    }),
    [initialRegion, terms, params, setRegion],
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
    // in normal flow, but safe during SSR edge cases or tests)
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
