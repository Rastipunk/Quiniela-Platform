"use client";

// Public (no-login) renderer for the "Evolución" bar-chart-race. Resolves the
// race by its share code via the public API and plays it full-page. Reuses the
// same animation component as the in-app modal (mode="page").

import { useIsMobile } from "@/hooks/useIsMobile";
import { BarChartRaceModal } from "../../(authenticated)/pools/[poolId]/components/BarChartRaceModal";

export function PublicBarRace({ code }: { code: string }) {
  const isMobile = useIsMobile();
  return <BarChartRaceModal mode="page" code={code} isMobile={isMobile} />;
}
