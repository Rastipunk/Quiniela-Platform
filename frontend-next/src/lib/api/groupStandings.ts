// Group Standings API — predictions and results
import { requestJson } from "./client";

export async function saveGroupStandingsPick(token: string, poolId: string, phaseId: string, groupId: string, teamIds: string[]): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/group-standings/${phaseId}/${groupId}`, { method: "PUT", body: JSON.stringify({ teamIds }) }, token);
}

export async function getGroupStandingsPick(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ prediction: any | null }> {
  return requestJson<{ prediction: any | null }>(`/pools/${poolId}/group-standings/${phaseId}/${groupId}`, { method: "GET" }, token);
}

export async function getAllGroupStandingsPicks(token: string, poolId: string, phaseId: string): Promise<{ predictions: any[] }> {
  return requestJson<{ predictions: any[] }>(`/pools/${poolId}/group-standings/${phaseId}`, { method: "GET" }, token);
}

export async function publishGroupStandingsResult(token: string, poolId: string, phaseId: string, groupId: string, teamIds: string[], reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`, { method: "PUT", body: JSON.stringify({ teamIds, reason }) }, token);
}

export async function getGroupStandingsResult(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ result: any | null }> {
  return requestJson<{ result: any | null }>(`/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`, { method: "GET" }, token);
}

export async function getAllGroupStandingsResults(token: string, poolId: string, phaseId: string): Promise<{ results: any[] }> {
  return requestJson<{ results: any[] }>(`/pools/${poolId}/group-standings-results/${phaseId}`, { method: "GET" }, token);
}

export async function generateGroupStandings(token: string, poolId: string, phaseId: string, groupId: string): Promise<{ result: any; standings: any[] }> {
  return requestJson<{ result: any; standings: any[] }>(`/pools/${poolId}/group-standings-generate/${phaseId}/${groupId}`, { method: "POST" }, token);
}

export async function getGroupMatchResults(token: string, poolId: string, groupId: string): Promise<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }> {
  return requestJson<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }>(`/pools/${poolId}/group-match-results/${groupId}`, { method: "GET" }, token);
}
