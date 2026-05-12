// Group Standings API — predictions and results
import { requestJson } from "./client";

export async function saveGroupStandingsPick(token: string, poolId: string, phaseId: string, groupId: string, teamIds: string[]): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/group-standings/${phaseId}/${groupId}`, { method: "PUT", body: JSON.stringify({ teamIds }) });
}

export async function getGroupStandingsPick(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ prediction: any | null }> {
  return requestJson<{ prediction: any | null }>(`/pools/${poolId}/group-standings/${phaseId}/${groupId}`, { method: "GET" });
}

export async function publishGroupStandingsResult(token: string, poolId: string, phaseId: string, groupId: string, teamIds: string[], reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`, { method: "PUT", body: JSON.stringify({ teamIds, reason }) });
}

export async function getGroupStandingsResult(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ result: any | null }> {
  return requestJson<{ result: any | null }>(`/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`, { method: "GET" });
}

export async function generateGroupStandings(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ result: any; standings: any[] }> {
  return requestJson<{ result: any; standings: any[] }>(`/pools/${poolId}/group-standings-generate/${phaseId}/${groupId}`, { method: "POST" });
}

export async function getGroupMatchResults(token: string, poolId: string, groupId: string): Promise<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }> {
  return requestJson<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }>(`/pools/${poolId}/group-match-results/${groupId}`, { method: "GET" });
}

export type TeamStandingRow = {
  teamId: string;
  groupId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type GroupStandingsStats = {
  standings: TeamStandingRow[];
  completedMatches: number;
  totalMatches: number;
  publishedTeamIds: string[] | null;
  publishedAtUtc: string | null;
  publishedVersion: number | null;
  publishedReason: string | null;
};

// Live classic-table stats. Used by the ClassicStandingsTable to render
// the FIFA-style view (Pos / PJ / G / E / P / GF / GC / DG / Pts) and
// detect divergence between live-computed order and the host-published
// order when a manual override was performed.
export async function getGroupStandingsStats(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string,
): Promise<GroupStandingsStats> {
  return requestJson<GroupStandingsStats>(
    `/pools/${poolId}/group-standings-stats/${phaseId}/${groupId}`,
    { method: "GET" },
  );
}
