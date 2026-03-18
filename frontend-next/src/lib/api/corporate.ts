// Corporate API — pool creation, employee management, activation
import { requestJson } from "./client";

export type CreateCorporatePoolInput = {
  companyName: string;
  logoBase64?: string;
  welcomeMessage?: string;
  invitationMessage?: string;
  tournamentInstanceId: string;
  poolName: string;
  poolDescription?: string;
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  requireApproval?: boolean;
  pickTypesConfig?: string | Record<string, unknown>;
  maxParticipants?: number;
  emails?: string[];
};

export type CreateCorporatePoolResponse = {
  success: boolean;
  pool: Record<string, unknown>;
  organization: { id: string; name: string };
  pendingInvites: number;
};

export type CorporateInvite = {
  id: string;
  email: string;
  name: string | null;
  status: "PENDING" | "SENT" | "ACTIVATED" | "FAILED";
  activatedAt: string | null;
  createdAtUtc: string;
};

export type CorporateEmployeesResponse = {
  invites: CorporateInvite[];
  summary: { total: number; pending: number; sent: number; activated: number; failed: number };
};

export type ActivateCorporateInput = {
  activationToken: string;
  displayName?: string;
  username?: string;
  password?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptAge?: boolean;
};

export type ActivateCorporateResponse = {
  token: string;
  user: { id: string; email: string; username: string; displayName: string; platformRole: string; status: string };
  poolId: string;
  poolName?: string;
  companyName?: string | null;
  alreadyExisted?: boolean;
};

export type CheckCorporateInviteResponse = {
  email: string;
  alreadyExists: boolean;
  poolName: string;
  companyName: string | null;
};

export async function createCorporatePool(token: string, input: CreateCorporatePoolInput): Promise<CreateCorporatePoolResponse> {
  return requestJson<CreateCorporatePoolResponse>("/corporate/pools", { method: "POST", body: JSON.stringify(input) });
}

export async function getCorporateEmployees(token: string, poolId: string): Promise<CorporateEmployeesResponse> {
  return requestJson<CorporateEmployeesResponse>(`/corporate/pools/${poolId}/employees`, { method: "GET" });
}

export async function addCorporateEmployees(token: string, poolId: string, emails: string[]): Promise<{ success: boolean; added: number; skipped: number; total: number }> {
  return requestJson(`/corporate/pools/${poolId}/employees`, { method: "POST", body: JSON.stringify({ emails }) });
}

export async function sendCorporateInvitations(token: string, poolId: string): Promise<{ success: boolean; sent: number; activated: number; failed: number }> {
  return requestJson(`/corporate/pools/${poolId}/send-invitations`, { method: "POST" });
}

export async function deleteCorporateEmployee(token: string, poolId: string, inviteId: string): Promise<{ success: boolean }> {
  return requestJson(`/corporate/pools/${poolId}/employees/${inviteId}`, { method: "DELETE" });
}

export async function checkCorporateInvite(token: string): Promise<CheckCorporateInviteResponse> {
  return requestJson<CheckCorporateInviteResponse>(`/auth/check-corporate-invite?token=${encodeURIComponent(token)}`);
}

export async function activateCorporateAccount(input: ActivateCorporateInput): Promise<ActivateCorporateResponse> {
  return requestJson<ActivateCorporateResponse>("/auth/activate-corporate", { method: "POST", body: JSON.stringify(input) });
}
