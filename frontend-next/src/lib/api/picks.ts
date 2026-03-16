// Picks API — match picks, structural picks, results
import { requestJson } from "./client";

// Match picks
export async function upsertPick(token: string, poolId: string, matchId: string, body: any): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/picks/${matchId}`, { method: "PUT", body: JSON.stringify(body) }, token);
}

export async function upsertResult(token: string, poolId: string, matchId: string, result: any): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/results/${matchId}`, { method: "PUT", body: JSON.stringify(result) }, token);
}

export type MatchPicksResponse = {
  matchId: string;
  deadlineUtc: string;
  isUnlocked: boolean;
  message?: string;
  picks: Array<{
    userId: string;
    displayName: string;
    pick: { type: string; homeGoals?: number; awayGoals?: number; outcome?: string } | null;
    isCurrentUser: boolean;
  }>;
};

export async function getMatchPicks(token: string, poolId: string, matchId: string): Promise<MatchPicksResponse> {
  return requestJson(`/pools/${poolId}/matches/${matchId}/picks`, { method: "GET" }, token);
}

// Structural picks
export async function upsertStructuralPick(token: string, poolId: string, phaseId: string, pickData: any): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/structural-picks/${phaseId}`, { method: "PUT", body: JSON.stringify(pickData) }, token);
}

export async function getStructuralPick(token: string, poolId: string, phaseId: string): Promise<{ pick: any | null }> {
  return requestJson<{ pick: any | null }>(`/pools/${poolId}/structural-picks/${phaseId}`, { method: "GET" }, token);
}

export async function listStructuralPicks(token: string, poolId: string): Promise<{ picks: any[] }> {
  return requestJson<{ picks: any[] }>(`/pools/${poolId}/structural-picks`, { method: "GET" }, token);
}

// Structural results
export async function publishStructuralResult(token: string, poolId: string, phaseId: string, resultData: any): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/structural-results/${phaseId}`, { method: "PUT", body: JSON.stringify(resultData) }, token);
}

export async function getStructuralResult(token: string, poolId: string, phaseId: string): Promise<{ result: any | null }> {
  return requestJson<{ result: any | null }>(`/pools/${poolId}/structural-results/${phaseId}`, { method: "GET" }, token);
}

export async function listStructuralResults(token: string, poolId: string): Promise<{ results: any[] }> {
  return requestJson<{ results: any[] }>(`/pools/${poolId}/structural-results`, { method: "GET" }, token);
}
