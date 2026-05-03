// Corporate API — pool creation, employee management, activation
import { requestJson } from "./client";

export type CreateCorporatePoolInput = {
  companyName: string;
  logoBase64?: string;
  welcomeMessage?: string;
  invitationMessage?: string;
  /** Hex #RRGGBB. Applied to splash, header, and invitation email. */
  primaryColor?: string;
  /** Hex #RRGGBB. Paired with primaryColor for the splash gradient. */
  secondaryColor?: string;
  tournamentInstanceId: string;
  poolName: string;
  poolDescription?: string;
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  requireApproval?: boolean;
  pickTypesConfig?: unknown;
  maxParticipants?: number;
  emails?: string[];
};

export type CreateCorporatePoolResponse = {
  success: boolean;
  pool: Record<string, unknown>;
  organization: { id: string; name: string };
  pendingInvites: number;
};

export type DerivedInviteStatus =
  | "PENDING"
  | "SENT"
  | "ACTIVATED"
  | "FAILED"
  | "EXPIRED";

export type CorporateInvite = {
  id: string;
  email: string;
  name: string | null;
  /**
   * Derived status — `EXPIRED` reflects a SENT invite whose token
   * window has lapsed (computed server-side, never stored in the DB).
   */
  status: DerivedInviteStatus;
  activatedAt: string | null;
  createdAtUtc: string;
  activationTokenExpiresAt: string;
};

export type CorporateEmployeesResponse = {
  invites: CorporateInvite[];
  summary: {
    total: number;
    pending: number;
    sent: number;
    activated: number;
    failed: number;
    expired: number;
  };
  page: number;
  limit: number;
  totalFiltered: number;
  totalPages: number;
};

export type ListCorporateEmployeesParams = {
  search?: string;
  status?: ReadonlyArray<DerivedInviteStatus>;
  /** 0-based page index. */
  page?: number;
  /** Default 25, max 100. */
  limit?: number;
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

export async function getCorporateEmployees(
  token: string,
  poolId: string,
  params: ListCorporateEmployeesParams = {},
): Promise<CorporateEmployeesResponse> {
  const qs = new URLSearchParams();
  if (params.search && params.search.trim().length > 0) {
    qs.set("search", params.search.trim());
  }
  if (params.status && params.status.length > 0) {
    qs.set("status", params.status.join(","));
  }
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  const query = qs.toString();
  const path = `/corporate/pools/${poolId}/employees${query ? `?${query}` : ""}`;
  return requestJson<CorporateEmployeesResponse>(path, { method: "GET" });
}

export type BulkResendExpiredResponse = {
  attempted: number;
  sent: number;
  failed: number;
  hasMore: boolean;
};

export async function bulkResendExpiredInvitations(
  token: string,
  poolId: string,
): Promise<BulkResendExpiredResponse> {
  return requestJson<BulkResendExpiredResponse>(
    `/corporate/pools/${poolId}/employees/bulk-resend-expired`,
    { method: "POST" },
  );
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

export async function resendCorporateInvitation(
  token: string,
  poolId: string,
  inviteId: string,
): Promise<{ email: string; status: "SENT" | "FAILED" }> {
  return requestJson(`/corporate/pools/${poolId}/employees/${inviteId}/resend`, {
    method: "POST",
  });
}

// ─── Branding (post-creation editing) ────────────────────────

export type UpdatePoolBrandingInput = {
  /** Base64 data URL. `null` to clear, omit to leave unchanged. */
  logoBase64?: string | null;
  /** Hex #RRGGBB. `null` to revert to Picks4All default. */
  primaryColor?: string | null;
  secondaryColor?: string | null;
  /** Plain text, max 1000 chars. `null` to clear. */
  welcomeMessage?: string | null;
  invitationMessage?: string | null;
};

export type UpdatePoolBrandingResponse = {
  organizationId: string;
  fieldsChanged: Array<
    | "logoBase64"
    | "primaryColor"
    | "secondaryColor"
    | "welcomeMessage"
    | "invitationMessage"
  >;
  branding: {
    logoBase64: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    welcomeMessage: string | null;
    invitationMessage: string | null;
  };
};

export async function updatePoolBranding(
  token: string,
  poolId: string,
  input: UpdatePoolBrandingInput,
): Promise<UpdatePoolBrandingResponse> {
  return requestJson<UpdatePoolBrandingResponse>(
    `/corporate/pools/${poolId}/branding`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function checkCorporateInvite(token: string): Promise<CheckCorporateInviteResponse> {
  return requestJson<CheckCorporateInviteResponse>(`/auth/check-corporate-invite?token=${encodeURIComponent(token)}`);
}

export async function activateCorporateAccount(input: ActivateCorporateInput): Promise<ActivateCorporateResponse> {
  return requestJson<ActivateCorporateResponse>("/auth/activate-corporate", { method: "POST", body: JSON.stringify(input) });
}

// ─── Corporate Inquiry (Quote Panel) ─────────────────────────

export type SubmitCorporateInquiryInput = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  /** ISO 3166-1 alpha-2 (e.g. "CO", "AR"). */
  country: string;
  currency: "COP" | "USD";
  /**
   * Per-pool slot counts. Length is the number of pools requested;
   * each entry is the slot count for that pool. The backend derives
   * numberOfPools and slotsPerPool from this array.
   */
  poolsConfig: number[];
  message?: string;
  locale: "es" | "en" | "pt";
};

export type SubmitCorporateInquiryResponse = {
  id: string;
  message: string;
};

export async function submitCorporateInquiry(
  input: SubmitCorporateInquiryInput,
): Promise<SubmitCorporateInquiryResponse> {
  return requestJson<SubmitCorporateInquiryResponse>("/corporate/inquiry", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
