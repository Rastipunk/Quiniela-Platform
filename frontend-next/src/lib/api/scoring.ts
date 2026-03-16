// Scoring API — breakdowns and player summary
import { requestJson } from "./client";

// Breakdown types
export type RuleEvaluation = {
  ruleKey: string;
  ruleName: string;
  enabled: boolean;
  matched: boolean;
  pointsEarned: number;
  pointsMax: number;
  details?: string;
};

export type MatchPickBreakdown = {
  type: "MATCH";
  matchId: string;
  hasPick: boolean;
  hasResult: boolean;
  pick?: { homeGoals: number; awayGoals: number };
  result?: { homeGoals: number; awayGoals: number };
  totalPointsEarned: number;
  totalPointsMax: number;
  rules: RuleEvaluation[];
  summary: string;
};

export type GroupEvaluation = {
  groupId: string;
  groupName: string;
  hasPick: boolean;
  hasResult: boolean;
  positions: Array<{
    position: number;
    teamId: string;
    teamName?: string;
    predictedPosition: number | null;
    actualPosition: number | null;
    matched: boolean;
    pointsEarned: number;
  }>;
  bonusPerfectGroup: {
    enabled: boolean;
    achieved: boolean;
    pointsEarned: number;
    pointsMax: number;
  };
  totalPointsEarned: number;
  totalPointsMax: number;
};

export type GroupStandingsBreakdown = {
  type: "GROUP_STANDINGS";
  phaseId: string;
  hasPick: boolean;
  hasResult: boolean;
  groups: GroupEvaluation[];
  totalPointsEarned: number;
  totalPointsMax: number;
  config: {
    pointsPerExactPosition: number;
    bonusPerfectGroup?: number;
  };
  summary: string;
};

export type KnockoutMatchEvaluation = {
  matchId: string;
  hasPick: boolean;
  hasResult: boolean;
  predictedWinnerId: string | null;
  actualWinnerId: string | null;
  predictedWinnerName?: string;
  actualWinnerName?: string;
  matched: boolean;
  pointsEarned: number;
  pointsMax: number;
};

export type KnockoutWinnerBreakdown = {
  type: "KNOCKOUT_WINNER";
  phaseId: string;
  hasPick: boolean;
  hasResult: boolean;
  matches: KnockoutMatchEvaluation[];
  totalPointsEarned: number;
  totalPointsMax: number;
  config: {
    pointsPerCorrectAdvance: number;
  };
  summary: string;
};

export type NoPickBreakdown = {
  type: "NO_PICK";
  reason: string;
  totalPointsEarned: 0;
  totalPointsMax: number;
  summary: string;
};

export type ScoringBreakdown =
  | MatchPickBreakdown
  | GroupStandingsBreakdown
  | KnockoutWinnerBreakdown
  | NoPickBreakdown;

export type GroupSingleBreakdown = {
  type: "GROUP_SINGLE";
  groupId: string;
  groupName: string;
  hasPick: boolean;
  hasResult: boolean;
  totalPointsEarned: number;
  totalPointsMax: number;
  config: {
    pointsPerExactPosition: number;
    bonusPerfectGroup?: number;
  };
  positions: Array<{
    position: number;
    teamId: string;
    teamName?: string;
    predictedPosition: number | null;
    actualPosition: number | null;
    matched: boolean;
    pointsEarned: number;
  }>;
  bonusPerfectGroup: {
    enabled: boolean;
    achieved: boolean;
    pointsEarned: number;
    pointsMax: number;
  };
};

// Breakdown functions
export async function getMatchBreakdown(
  token: string, poolId: string, matchId: string
): Promise<{
  breakdown: ScoringBreakdown;
  match: {
    id: string;
    phaseId: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    kickoffUtc: string;
  };
}> {
  return requestJson(`/pools/${poolId}/breakdown/match/${matchId}`, { method: "GET" }, token);
}

export async function getPhaseBreakdown(token: string, poolId: string, phaseId: string): Promise<{ breakdown: ScoringBreakdown }> {
  return requestJson(`/pools/${poolId}/breakdown/phase/${phaseId}`, { method: "GET" }, token);
}

export async function getGroupBreakdown(token: string, poolId: string, groupId: string): Promise<{ breakdown: GroupSingleBreakdown }> {
  return requestJson(`/pools/${poolId}/breakdown/group/${groupId}`, { method: "GET" }, token);
}

// Player summary
export type PlayerSummaryMatch = {
  matchId: string;
  homeTeam: { id: string; name: string; code?: string } | null;
  awayTeam: { id: string; name: string; code?: string } | null;
  kickoffUtc: string;
  groupId: string | null;
  pick: { homeGoals: number; awayGoals: number; type: string } | null;
  result: { homeGoals: number; awayGoals: number } | null;
  pointsEarned: number;
  pointsMax: number;
  status: "SCORED" | "NO_PICK" | "PENDING_RESULT" | "LOCKED";
  breakdown: Array<{ type: string; matched: boolean; points: number }>;
};

export type PlayerSummaryPhase = {
  phaseId: string;
  phaseName: string;
  phaseOrder: number;
  totalPoints: number;
  maxPossiblePoints: number;
  matchCount: number;
  scoredCount: number;
  matches: PlayerSummaryMatch[];
};

export type PlayerSummaryResponse = {
  player: {
    userId: string;
    displayName: string;
    role: string;
    rank: number;
    totalPoints: number;
    joinedAtUtc: string;
  };
  isViewingSelf: boolean;
  phases: PlayerSummaryPhase[];
};

export async function getPlayerSummary(token: string, poolId: string, userId: string): Promise<PlayerSummaryResponse> {
  return requestJson(`/pools/${poolId}/players/${userId}/summary`, { method: "GET" }, token);
}
