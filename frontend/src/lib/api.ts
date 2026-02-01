// frontend/src/lib/api.ts
// Cliente HTTP simple para hablar con el backend
import { clearToken, getToken, markSessionExpired } from "./auth";

// Detectar API base URL:
// 1. Si hay variable de entorno VITE_API_BASE_URL, usarla
// 2. Si estamos en producción (railway), usar el backend de producción
// 3. Fallback a localhost para desarrollo
function getApiBase(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL ?? (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;

  // Auto-detect production: si el frontend está en railway, asumir backend en railway
  if (typeof window !== "undefined" && window.location.hostname.includes("railway.app")) {
    return "https://quiniela-platform-production.up.railway.app";
  }

  return "http://localhost:3000";
}

const API_BASE = getApiBase();

// Export for use in other components that need direct API access
export { API_BASE };

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  // Si enviamos body y no está Content-Type, lo asumimos JSON
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text; // por si llega HTML u otro texto
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `HTTP ${res.status}`;

    if (res.status === 401) {
      // Token inválido/expirado → logout automático
      // Solo marcar como expirado si había un token (no en login fallido)
      if (getToken()) {
        markSessionExpired();
      }
      clearToken();
    }
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

/* =========================
   AUTH
   ========================= */

export type LoginResponse = {
  token: string;
  user?: any;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export type RegisterConsentOptions = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAge: boolean;
  acceptMarketing?: boolean;
};

export async function register(
  email: string,
  username: string,
  displayName: string,
  password: string,
  timezone?: string,
  consent?: RegisterConsentOptions
): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      username,
      displayName,
      password,
      timezone,
      acceptTerms: consent?.acceptTerms ?? false,
      acceptPrivacy: consent?.acceptPrivacy ?? false,
      acceptAge: consent?.acceptAge ?? false,
      acceptMarketing: consent?.acceptMarketing ?? false,
    }),
  });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function loginWithGoogle(
  idToken: string,
  timezone?: string,
  consent?: RegisterConsentOptions
): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      timezone,
      acceptTerms: consent?.acceptTerms,
      acceptPrivacy: consent?.acceptPrivacy,
      acceptAge: consent?.acceptAge,
      acceptMarketing: consent?.acceptMarketing,
    }),
  });
}

/* =========================
   USER PROFILE
   ========================= */

export type UserProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  platformRole: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  lastUsernameChangeAt: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  isGoogleAccount?: boolean;
};

export type UpdateProfileInput = {
  displayName?: string;
  username?: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  bio?: string | null;
  country?: string | null;
  timezone?: string | null;
};

export async function getUserProfile(token: string): Promise<{ user: UserProfile }> {
  return requestJson<{ user: UserProfile }>("/users/me/profile", { method: "GET" }, token);
}

export async function updateUserProfile(
  token: string,
  input: UpdateProfileInput
): Promise<{ user: UserProfile }> {
  return requestJson<{ user: UserProfile }>(
    "/users/me/profile",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token
  );
}

/* =========================
   DASHBOARD / CATALOG
   ========================= */

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

export async function getMePools(token: string): Promise<MePoolRow[]> {
  return requestJson<MePoolRow[]>("/me/pools", { method: "GET" }, token);
}

export async function listInstances(token: string): Promise<CatalogInstance[]> {
  return requestJson<CatalogInstance[]>("/catalog/instances", { method: "GET" }, token);
}

// Alias para compatibilidad
export const listCatalogInstances = listInstances;

export type InstancePhase = {
  id: string;
  name: string;
  type: string;
  order: number;
};

export async function getInstancePhases(token: string, instanceId: string): Promise<{ phases: InstancePhase[] }> {
  return requestJson<{ phases: InstancePhase[] }>(`/catalog/instances/${instanceId}/phases`, { method: "GET" }, token);
}


export type CreatePoolInput = {
  tournamentInstanceId: string;
  name: string;
  description?: string;
  visibility?: "PRIVATE" | "PUBLIC";
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  scoringPresetKey?: string; // "CLASSIC" | "OUTCOME_ONLY" | "EXACT_HEAVY" ... (legacy)
  pickTypesConfig?: any; // PhasePickConfig[] | "BASIC" | "ADVANCED" | "SIMPLE"
  requireApproval?: boolean;
};

export async function createPool(token: string, input: CreatePoolInput): Promise<any> {
  return requestJson<any>(
    "/pools",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function joinPool(token: string, code: string): Promise<any> {
  return requestJson<any>(
    "/pools/join",
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
    token
  );
}

/* =========================
   POOL PAGE
   ========================= */

export type PoolOverview = any;

export async function getPoolOverview(token: string, poolId: string, leaderboardVerbose = false): Promise<PoolOverview> {
  const q = leaderboardVerbose ? "?leaderboardVerbose=1" : "?leaderboardVerbose=0";
  return requestJson<PoolOverview>(`/pools/${poolId}/overview${q}`, { method: "GET" }, token);
}

export async function createInvite(token: string, poolId: string): Promise<{ code: string }> {
  return requestJson<{ code: string }>(`/pools/${poolId}/invites`, { method: "POST" }, token);
}

export async function upsertPick(token: string, poolId: string, matchId: string, body: any): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/picks/${matchId}`,
    { method: "PUT", body: JSON.stringify(body) },
    token
  );
}



export async function upsertResult(token: string, poolId: string, matchId: string, result: any): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/results/${matchId}`,
    {
      method: "PUT",
      body: JSON.stringify(result),
    },
    token
  );
}

/* =========================
   ADMIN / HOST ACTIONS
   ========================= */

export async function updatePoolSettings(token: string, poolId: string, settings: { autoAdvanceEnabled?: boolean; requireApproval?: boolean }): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify(settings),
    },
    token
  );
}

export async function manualAdvancePhase(
  token: string,
  poolId: string,
  currentPhaseId: string,
  nextPhaseId?: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/advance-phase`,
    {
      method: "POST",
      body: JSON.stringify({ currentPhaseId, nextPhaseId }),
    },
    token
  );
}

export async function lockPhase(
  token: string,
  poolId: string,
  phaseId: string,
  locked: boolean
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/lock-phase`,
    {
      method: "POST",
      body: JSON.stringify({ phaseId, locked }),
    },
    token
  );
}

export async function archivePool(token: string, poolId: string): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(
    `/pools/${poolId}/archive`,
    {
      method: "POST",
    },
    token
  );
}

export async function promoteMemberToCoAdmin(
  token: string,
  poolId: string,
  memberId: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/promote`,
    {
      method: "POST",
    },
    token
  );
}

export async function demoteMemberFromCoAdmin(
  token: string,
  poolId: string,
  memberId: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/demote`,
    {
      method: "POST",
    },
    token
  );
}

// Join Approval Workflow
export async function getPendingMembers(token: string, poolId: string): Promise<any> {
  return requestJson<any>(`/pools/${poolId}/pending-members`, {}, token);
}

export async function approveMember(
  token: string,
  poolId: string,
  memberId: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/approve`,
    {
      method: "POST",
    },
    token
  );
}

export async function rejectMember(
  token: string,
  poolId: string,
  memberId: string,
  reason?: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    token
  );
}

export async function kickMember(
  token: string,
  poolId: string,
  memberId: string,
  reason?: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/kick`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    token
  );
}

export async function banMember(
  token: string,
  poolId: string,
  memberId: string,
  reason: string,
  deletePicks: boolean
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/members/${memberId}/ban`,
    {
      method: "POST",
      body: JSON.stringify({ reason, deletePicks }),
    },
    token
  );
}

/* =========================
   STRUCTURAL PICKS (Sprint 2)
   ========================= */

// Guardar/actualizar picks estructurales para una fase completa
export async function upsertStructuralPick(
  token: string,
  poolId: string,
  phaseId: string,
  pickData: any
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/structural-picks/${phaseId}`,
    {
      method: "PUT",
      body: JSON.stringify(pickData),
    },
    token
  );
}

// Obtener pick estructural del usuario para una fase
export async function getStructuralPick(
  token: string,
  poolId: string,
  phaseId: string
): Promise<{ pick: any | null }> {
  return requestJson<{ pick: any | null }>(
    `/pools/${poolId}/structural-picks/${phaseId}`,
    { method: "GET" },
    token
  );
}

// Listar todos los picks estructurales del usuario en la pool
export async function listStructuralPicks(
  token: string,
  poolId: string
): Promise<{ picks: any[] }> {
  return requestJson<{ picks: any[] }>(
    `/pools/${poolId}/structural-picks`,
    { method: "GET" },
    token
  );
}

/* =========================
   STRUCTURAL RESULTS (Sprint 2)
   ========================= */

// HOST/CO-ADMIN: Publicar resultados estructurales de una fase
export async function publishStructuralResult(
  token: string,
  poolId: string,
  phaseId: string,
  resultData: any
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/structural-results/${phaseId}`,
    {
      method: "PUT",
      body: JSON.stringify(resultData),
    },
    token
  );
}

// Obtener resultado estructural oficial de una fase
export async function getStructuralResult(
  token: string,
  poolId: string,
  phaseId: string
): Promise<{ result: any | null }> {
  return requestJson<{ result: any | null }>(
    `/pools/${poolId}/structural-results/${phaseId}`,
    { method: "GET" },
    token
  );
}

// Listar todos los resultados estructurales de la pool
export async function listStructuralResults(
  token: string,
  poolId: string
): Promise<{ results: any[] }> {
  return requestJson<{ results: any[] }>(
    `/pools/${poolId}/structural-results`,
    { method: "GET" },
    token
  );
}



// ==================== GRANULAR GROUP STANDINGS ====================

// Player: Guardar pick de un grupo específico
export async function saveGroupStandingsPick(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string,
  teamIds: string[]
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/group-standings/${phaseId}/${groupId}`,
    { method: "PUT", body: JSON.stringify({ teamIds }) },
    token
  );
}

// Player: Obtener pick de un grupo específico
export async function getGroupStandingsPick(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string
): Promise<{ prediction: any | null }> {
  return requestJson<{ prediction: any | null }>(
    `/pools/${poolId}/group-standings/${phaseId}/${groupId}`,
    { method: "GET" },
    token
  );
}

// Player: Obtener todos los picks de grupos de una fase
export async function getAllGroupStandingsPicks(
  token: string,
  poolId: string,
  phaseId: string
): Promise<{ predictions: any[] }> {
  return requestJson<{ predictions: any[] }>(
    `/pools/${poolId}/group-standings/${phaseId}`,
    { method: "GET" },
    token
  );
}

// Host: Publicar resultado oficial de un grupo específico
export async function publishGroupStandingsResult(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string,
  teamIds: string[],
  reason?: string
): Promise<any> {
  return requestJson<any>(
    `/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`,
    { method: "PUT", body: JSON.stringify({ teamIds, reason }) },
    token
  );
}

// Obtener resultado oficial de un grupo específico
export async function getGroupStandingsResult(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string
): Promise<{ result: any | null }> {
  return requestJson<{ result: any | null }>(
    `/pools/${poolId}/group-standings-results/${phaseId}/${groupId}`,
    { method: "GET" },
    token
  );
}

// Obtener todos los resultados oficiales de grupos de una fase
export async function getAllGroupStandingsResults(
  token: string,
  poolId: string,
  phaseId: string
): Promise<{ results: any[] }> {
  return requestJson<{ results: any[] }>(
    `/pools/${poolId}/group-standings-results/${phaseId}`,
    { method: "GET" },
    token
  );
}

// Generar posiciones desde resultados de partidos
export async function generateGroupStandings(
  token: string,
  poolId: string,
  phaseId: string,
  groupId: string
): Promise<{ result: any; standings: any[] }> {
  return requestJson<{ result: any; standings: any[] }>(
    `/pools/${poolId}/group-standings-generate/${phaseId}/${groupId}`,
    { method: "POST" },
    token
  );
}

// Obtener resultados de partidos de un grupo
export async function getGroupMatchResults(
  token: string,
  poolId: string,
  groupId: string
): Promise<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }> {
  return requestJson<{ matches: any[]; results: Record<string, any>; completedCount: number; totalCount: number }>(
    `/pools/${poolId}/group-match-results/${groupId}`,
    { method: "GET" },
    token
  );
}

/* =========================
   SCORING BREAKDOWN (Sprint 2)
   ========================= */

// Tipos de breakdown
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

// Obtener breakdown de puntuación para un partido específico
export async function getMatchBreakdown(
  token: string,
  poolId: string,
  matchId: string
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
  return requestJson(
    `/pools/${poolId}/breakdown/match/${matchId}`,
    { method: "GET" },
    token
  );
}

// Obtener breakdown de puntuación para una fase estructural
export async function getPhaseBreakdown(
  token: string,
  poolId: string,
  phaseId: string
): Promise<{ breakdown: ScoringBreakdown }> {
  return requestJson(
    `/pools/${poolId}/breakdown/phase/${phaseId}`,
    { method: "GET" },
    token
  );
}

// Tipo para breakdown de grupo individual
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

// Obtener breakdown de puntuación para un grupo específico
export async function getGroupBreakdown(
  token: string,
  poolId: string,
  groupId: string
): Promise<{ breakdown: GroupSingleBreakdown }> {
  return requestJson(
    `/pools/${poolId}/breakdown/group/${groupId}`,
    { method: "GET" },
    token
  );
}

/* =========================
   PLAYER SUMMARY
   ========================= */

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

// Obtener resumen detallado de un jugador (puntos por fase/partido)
export async function getPlayerSummary(
  token: string,
  poolId: string,
  userId: string
): Promise<PlayerSummaryResponse> {
  return requestJson(
    `/pools/${poolId}/players/${userId}/summary`,
    { method: "GET" },
    token
  );
}

// ========== MATCH PICKS (ver picks de otros después del deadline) ==========

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

// Obtener picks de todos los usuarios para un partido (solo si deadline pasó)
export async function getMatchPicks(
  token: string,
  poolId: string,
  matchId: string
): Promise<MatchPicksResponse> {
  return requestJson(
    `/pools/${poolId}/matches/${matchId}/picks`,
    { method: "GET" },
    token
  );
}

// ========== NOTIFICACIONES INTERNAS (badges) ==========

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

export async function getPoolNotifications(
  token: string,
  poolId: string
): Promise<PoolNotifications> {
  return requestJson(
    `/pools/${poolId}/notifications`,
    { method: "GET" },
    token
  );
}

// ========== ADMIN EMAIL SETTINGS ==========

export type PlatformEmailSettings = {
  emailWelcomeEnabled: boolean;
  emailPoolInvitationEnabled: boolean;
  emailDeadlineReminderEnabled: boolean;
  emailResultPublishedEnabled: boolean;
  emailPoolCompletedEnabled: boolean;
};

export type AdminEmailSettingsResponse = {
  settings: PlatformEmailSettings;
  metadata: {
    updatedAt: string;
    updatedBy: { displayName: string; email: string } | null;
  };
};

export async function getAdminEmailSettings(
  token: string
): Promise<AdminEmailSettingsResponse> {
  return requestJson("/admin/settings/email", { method: "GET" }, token);
}

export async function updateAdminEmailSettings(
  token: string,
  settings: Partial<PlatformEmailSettings>
): Promise<{
  message: string;
  settings: PlatformEmailSettings;
  changes: Record<string, { from: boolean; to: boolean }>;
}> {
  return requestJson(
    "/admin/settings/email",
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
    token
  );
}

// ========== USER EMAIL PREFERENCES ==========

export type UserEmailPreferences = {
  emailNotificationsEnabled: boolean;
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

export type PlatformEmailEnabled = {
  emailPoolInvitations: boolean;
  emailDeadlineReminders: boolean;
  emailResultNotifications: boolean;
  emailPoolCompletions: boolean;
};

export type UserEmailPreferencesResponse = {
  preferences: UserEmailPreferences;
  platformEnabled?: PlatformEmailEnabled;
  descriptions: Record<keyof UserEmailPreferences, string>;
};

export async function getUserEmailPreferences(
  token: string
): Promise<UserEmailPreferencesResponse> {
  return requestJson("/me/email-preferences", { method: "GET" }, token);
}

export async function updateUserEmailPreferences(
  token: string,
  preferences: Partial<UserEmailPreferences>
): Promise<{
  message: string;
  preferences: UserEmailPreferences;
}> {
  return requestJson(
    "/me/email-preferences",
    {
      method: "PUT",
      body: JSON.stringify(preferences),
    },
    token
  );
}

// ========== EMAIL VERIFICATION ==========

export type VerifyEmailResponse = {
  message: string;
  verified?: boolean;
  alreadyVerified?: boolean;
};

export async function verifyEmail(verificationToken: string): Promise<VerifyEmailResponse> {
  return requestJson<VerifyEmailResponse>(
    `/auth/verify-email?token=${encodeURIComponent(verificationToken)}`,
    { method: "GET" }
  );
}

export async function resendVerificationEmail(token: string): Promise<{ message: string }> {
  return requestJson<{ message: string }>(
    "/auth/resend-verification",
    { method: "POST" },
    token
  );
}

// ========== POOL INVITE BY EMAIL ==========

export async function sendPoolInviteEmail(
  token: string,
  poolId: string,
  email: string,
  inviteCode: string
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  return requestJson(
    `/pools/${poolId}/send-invite-email`,
    {
      method: "POST",
      body: JSON.stringify({ email, inviteCode }),
    },
    token
  );
}
