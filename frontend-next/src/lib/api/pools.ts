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
    templateKey?: string | null;
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
  const data = await requestJson<{ pools: MePoolRow[] }>("/me/pools", { method: "GET" });
  return data.pools;
}

export async function listInstances(token: string): Promise<CatalogInstance[]> {
  const data = await requestJson<{ instances: CatalogInstance[] }>("/catalog/instances", { method: "GET" });
  return data.instances;
}

export const listCatalogInstances = listInstances;

export async function getInstancePhases(token: string, instanceId: string): Promise<{ phases: InstancePhase[] }> {
  return requestJson<{ phases: InstancePhase[] }>(`/catalog/instances/${instanceId}/phases`, { method: "GET" });
}

// Pool CRUD
export async function createPool(token: string, input: CreatePoolInput): Promise<any> {
  return requestJson<any>("/pools", { method: "POST", body: JSON.stringify(input) });
}

export async function joinPool(token: string, code: string): Promise<any> {
  return requestJson<any>("/pools/join", { method: "POST", body: JSON.stringify({ code }) });
}

export async function getPoolOverview(token: string, poolId: string, leaderboardVerbose = false): Promise<PoolOverview> {
  const q = leaderboardVerbose ? "?leaderboardVerbose=1" : "?leaderboardVerbose=0";
  return requestJson<PoolOverview>(`/pools/${poolId}/overview${q}`, { method: "GET" });
}

export async function createInvite(token: string, poolId: string): Promise<{ code: string }> {
  return requestJson<{ code: string }>(`/pools/${poolId}/invites`, { method: "POST" });
}

export async function leavePool(token: string, poolId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/leave`, { method: "POST" });
}

export async function getPoolNotifications(token: string, poolId: string): Promise<PoolNotifications> {
  return requestJson(`/pools/${poolId}/notifications`, { method: "GET" });
}

export async function sendPoolInviteEmail(
  token: string, poolId: string, email: string, inviteCode: string
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  return requestJson(
    `/pools/${poolId}/send-invite-email`,
    { method: "POST", body: JSON.stringify({ email, inviteCode }) }
  );
}

// Pool Admin / Host actions
export async function updatePoolSettings(token: string, poolId: string, settings: { autoAdvanceEnabled?: boolean; requireApproval?: boolean; extraTimePhases?: string[] }): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/settings`, { method: "PATCH", body: JSON.stringify(settings) });
}

export async function manualAdvancePhase(token: string, poolId: string, currentPhaseId: string, nextPhaseId?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/advance-phase`, { method: "POST", body: JSON.stringify({ currentPhaseId, nextPhaseId }) });
}

export async function lockPhase(token: string, poolId: string, phaseId: string, locked: boolean): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/lock-phase`, { method: "POST", body: JSON.stringify({ phaseId, locked }) });
}

export async function archivePool(token: string, poolId: string): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/pools/${poolId}/archive`, { method: "POST" });
}

// "Administrar reglas" — host can replace the pool's scoring config while
// the pool is in DRAFT. The body shape mirrors the create-pool endpoint:
// either a preset key string ("BASIC" | "SIMPLE" | "CUMULATIVE") that
// the backend expands against the instance's real phases, or a
// fully-detailed PoolPickTypesConfig the validator will check.
export async function updatePoolScoringConfig(
  token: string,
  poolId: string,
  pickTypesConfig: unknown,
): Promise<{ pool: { id: string; pickTypesConfig: unknown } }> {
  return requestJson(
    `/pools/${poolId}/scoring-config`,
    { method: "PATCH", body: JSON.stringify({ pickTypesConfig }) },
  );
}

// Member management
export async function promoteMemberToCoAdmin(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/promote`, { method: "POST" });
}

export async function demoteMemberFromCoAdmin(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/demote`, { method: "POST" });
}

export async function getPendingMembers(token: string, poolId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/pending-members`, {});
}

export async function approveMember(token: string, poolId: string, memberId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/approve`, { method: "POST" });
}

export async function rejectMember(token: string, poolId: string, memberId: string, reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/members/${memberId}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
}

// `confirmRevert` acknowledges that removing the last non-host member
// will auto-revert the pool to DRAFT (deleting all player predictions).
// Without it, the backend returns 409 REVERT_PENDING_CONFIRMATION so
// the UI can show a warning dialog before retrying.
export async function kickMember(
  token: string,
  poolId: string,
  memberId: string,
  reason?: string,
  confirmRevert?: boolean,
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/kick`,
    { method: "POST", body: JSON.stringify({ reason, confirmRevert }) },
  );
}

export async function banMember(
  token: string,
  poolId: string,
  memberId: string,
  reason: string,
  deletePicks: boolean,
  confirmRevert?: boolean,
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/ban`,
    { method: "POST", body: JSON.stringify({ reason, deletePicks, confirmRevert }) },
  );
}

export async function setScoringOverride(token: string, poolId: string, matchId: string, scoringEnabled: boolean, reason?: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/matches/${matchId}/scoring-override`, { method: "PUT", body: JSON.stringify({ scoringEnabled, reason }) });
}
