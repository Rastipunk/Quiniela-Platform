import type { PoolOverview, MatchPicksResponse } from "@/lib/api";
import type { PoolPickTypesConfig } from "@/types/pickConfig";

/** Shared props passed from PoolPage to tab components */
export interface PoolTabBaseProps {
  poolId: string;
  token: string;
  overview: PoolOverview;
  isMobile: boolean;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  userTimezone: string | null;
  reload: () => Promise<void>;
  refetchNotifications: () => void;
  friendlyError: (e: any) => string;
}

export interface PhaseData {
  id: string;
  name: string;
  type: string;
  order: number;
}

export interface ExpulsionModalData {
  memberId: string;
  memberName: string;
  type: "KICK" | "BAN";
}

export interface BreakdownModalData {
  matchId?: string;
  matchTitle?: string;
  phaseId?: string;
  phaseTitle?: string;
}

export interface PlayerSummaryModalData {
  userId: string;
  displayName: string;
  initialPhase?: string;
}

export interface MatchPicksModalData {
  matchId: string;
  matchTitle: string;
  picks: MatchPicksResponse | null;
  loading: boolean;
  error: string | null;
}

export interface ScoringOverrideModalData {
  matchId: string;
  matchTitle: string;
  currentEnabled: boolean;
}
