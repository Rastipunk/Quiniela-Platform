// Pools API — CRUD, join, overview, members, admin actions, notifications
import { requestJson } from "./client";
import type { PoolOverview } from "../poolTypes";
export type { PoolOverview } from "../poolTypes";

export type ScoringPresetKey = "CLASSIC" | "OUTCOME_ONLY" | "EXACT_HEAVY";

export type CatalogInstance = {
  id: string;
  name: string;
  status: string;
  [key: string]: any;
};

export type MePoolRow = {
  poolId: string;
  role: string;
  status: string;
  leftAtUtc?: string | null;
  pool: {
    id: string;
    name: string;
    description?: string;
    timeZone: string;
    deadlineMinutesBeforeKickoff: number;
    scoringPresetKey?: string;
    status?: string;
    [key: string]: any;
  };
  tournamentInstance?: {
    id: string;
    name: string;
    status: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type InstancePhase = {
  id: string;
  name: string;
  type: string;
  order: number;
};

export type CreatePoolInput = {
  tournamentInstanceId: string;
  name: string;
  description?: string;
  visibility?: "PRIVATE" | "PUBLIC";
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  scoringPresetKey?: string;
  pickTypesConfig?: any;
  requireApproval?: boolean;
  maxParticipants?: number;
};

export type PoolNotifications = {
  pendingPicks: number;
  urgentDeadlines: Array<{
    matchId: string;
    phaseId: string;
    deadlineUtc: string;
    homeTeamId: string;
    awayTeamId: string;
    kickoffUtc: string;
  }>;
  pendingJoins: number;
  pendingResults: number;
  phasesReadyToAdvance: string[];
  isHostOrCoAdmin: boolean;
  updatedAt: string;
};

// Dashboard / Catalog
export async function getMePools(token: string): Promise<MePoolRow[]> {
  return requestJson<MePoolRow[]>("/me/pools", { method: "GET" }, token);
}

export async function listInstances(token: string): Promise<CatalogInstance[]> {
  return requestJson<CatalogInstance[]>("/catalog/instances", { method: "GET" }, token);
}

export const listCatalogInstances = listInstances;

export async function getInstancePhases(token: string, instanceId: string): Promise<{ phases: InstancePhase[] }> {
  return requestJson<{ phases: InstancePhase[] }>(`/catalog/instances/${instanceId}/phases`, { method: "GET" }, token);
}

// Pool CRUD
export async function createPool(token: string, input: CreatePoolInput): Promise<any> {
  return requestJson<any>("/pools", { method: "POST", body: JSON.stringify(input) }, token);
}

export async function joinPool(token: string, code: string): Promise<any> {
  return requestJson<any>("/pools/join", { method: "POST", body: JSON.stringify({ code }) }, token);
}

export async function getPoolOverview(token: string, poolId: string, leaderboardVerbose = false): Promise<PoolOverview> {
  const q = leaderboardVerbose ? "?leaderboardVerbose=1" : "?leaderboardVerbose=0";
  return requestJson<PoolOverview>(`/pools/${poolId}/overview${q}`, { method: "GET" }, token);
}

export async function createInvite(token: string, poolId: string): Promise<{ code: string }> {
  return requestJson<{ code: string }>(`/pools/${poolId}/invites`, { method: "POST" }, token);
}

export async function leavePool(token: string, poolId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/leave`, { method: "POST" }, token);
}

export async function getPoolNotifications(token: string, poolId: string): Promise<PoolNotifications> {
  return requestJson(`/pools/${poolId}/notifications`, { method: "GET" }, token);
}

export async function sendPoolInviteEmail(
  token: string, poolId: string, email: string, inviteCode: string
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  return requestJson(
    `/pools/${poolId}/send-invite-email`,
    { method: "POST", body: JSON.stringify({ email, inviteCode }) },
    token
  );
}

// Pool Admin / Host actions
export async function updatePoolSettings(token: string, poolId: string, settings: { autoAdvanceEnabled?: boolean; requireApproval?: boolean; extraTimePhases?: string[] }): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/settings`, { method: "PATCH", body: JSON.stringify(settings) }, token);
}

export async function manualAdvancePhase(token: string, poolId: string, currentPhaseId: string, nextPhaseId?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/advance-phase`, { method: "POST", body: JSON.stringify({ currentPhaseId, nextPhaseId }) }, token);
}

export async function lockPhase(token: string, poolId: string, phaseId: string, locked: boolean): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/lock-phase`, { method: "POST", body: JSON.stringify({ phaseId, locked }) }, token);
}

export async function archivePool(token: string, poolId: string): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/pools/${poolId}/archive`, { method: "POST" }, token);
}

// Member management
export async function promoteMemberToCoAdmin(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/promote`, { method: "POST" }, token);
}

export async function demoteMemberFromCoAdmin(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/demote`, { method: "POST" }, token);
}

export async function getPendingMembers(token: string, poolId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/pending-members`, {}, token);
}

export async function approveMember(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/approve`, { method: "POST" }, token);
}

export async function rejectMember(token: string, poolId: string, memberId: string, reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/reject`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}

export async function kickMember(token: string, poolId: string, memberId: string, reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/kick`, { method: "POST", body: JSON.stringify({ reason }) }, token);
}

export async function banMember(token: string, poolId: string, memberId: string, reason: string, deletePicks: boolean): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/ban`, { method: "POST", body: JSON.stringify({ reason, deletePicks }) }, token);
}

export async function setScoringOverride(token: string, poolId: string, matchId: string, scoringEnabled: boolean, reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/matches/${matchId}/scoring-override`, { method: "PUT", body: JSON.stringify({ scoringEnabled, reason }) }, token);
}
