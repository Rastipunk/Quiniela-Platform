// Picks API — match picks, structural picks, results
import { requestJson } from "./client";
import type { StructuralPickData } from "@/types/pickConfig";

// ── Types ──

export type MatchPickBody = {
  pick: Record<string, unknown>;
};

export type MatchResultBody = {
  homeGoals: number;
  awayGoals: number;
  homeGoals90?: number;
  awayGoals90?: number;
  homePenalties?: number;
  awayPenalties?: number;
  reason?: string;
};

export type UpsertResponse = {
  ok: boolean;
  prediction?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

export type StructuralRecord = Record<string, unknown>;

// ── Match picks ──

export async function upsertPick(token: string, poolId: string, matchId: string, body: MatchPickBody): Promise<UpsertResponse> {
  return requestJson<UpsertResponse>(`/pools/${poolId}/picks/${matchId}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function upsertResult(token: string, poolId: string, matchId: string, result: MatchResultBody): Promise<UpsertResponse> {
  return requestJson<UpsertResponse>(`/pools/${poolId}/results/${matchId}`, { method: "PUT", body: JSON.stringify(result) });
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
  return requestJson(`/pools/${poolId}/matches/${matchId}/picks`, { method: "GET" });
}

// ── Structural picks ──

export async function upsertStructuralPick(token: string, poolId: string, phaseId: string, pickData: StructuralPickData): Promise<UpsertResponse> {
  return requestJson<UpsertResponse>(`/pools/${poolId}/structural-picks/${phaseId}`, { method: "PUT", body: JSON.stringify(pickData) });
}

export async function getStructuralPick(token: string, poolId: string, phaseId: string): Promise<{ pick: StructuralRecord | null }> {
  return requestJson<{ pick: StructuralRecord | null }>(`/pools/${poolId}/structural-picks/${phaseId}`, { method: "GET" });
}

export async function listStructuralPicks(token: string, poolId: string): Promise<{ picks: StructuralRecord[] }> {
  return requestJson<{ picks: StructuralRecord[] }>(`/pools/${poolId}/structural-picks`, { method: "GET" });
}

// ── Structural results ──

export async function publishStructuralResult(token: string, poolId: string, phaseId: string, resultData: StructuralPickData): Promise<UpsertResponse> {
  return requestJson<UpsertResponse>(`/pools/${poolId}/structural-results/${phaseId}`, { method: "PUT", body: JSON.stringify(resultData) });
}

export async function getStructuralResult(token: string, poolId: string, phaseId: string): Promise<{ result: StructuralRecord | null }> {
  return requestJson<{ result: StructuralRecord | null }>(`/pools/${poolId}/structural-results/${phaseId}`, { method: "GET" });
}

export async function listStructuralResults(token: string, poolId: string): Promise<{ results: StructuralRecord[] }> {
  return requestJson<{ results: StructuralRecord[] }>(`/pools/${poolId}/structural-results`, { method: "GET" });
}
