// frontend/src/lib/api.ts
// Cliente HTTP simple para hablar con el backend
import { clearToken, getToken, markSessionExpired } from "./auth";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ??
  (import.meta as any).env?.VITE_API_URL ??
  "http://localhost:3000";

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
      // ✅ hardening: token inválido/expirado → logout automático
      // Solo marcar como expirado si había un token (no en login fallido)
      const hadToken = !!getToken();
      if (hadToken) {
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

export async function register(email: string, displayName: string, password: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, displayName, password }),
  });
}

/* =========================
   DASHBOARD / CATALOG
   ========================= */

export async function getMePools(token: string): Promise<any[]> {
  return requestJson<any[]>("/me/pools", { method: "GET" }, token);
}

// Alias por si algún archivo usaba otro nombre
export const listMyPools = getMePools;

export async function listInstances(token: string): Promise<any[]> {
  return requestJson<any[]>("/catalog/instances", { method: "GET" }, token);
}
export const listCatalogInstances = listInstances;


export type CreatePoolInput = {
  tournamentInstanceId: string;
  name: string;
  description?: string;
  visibility?: "PRIVATE" | "PUBLIC";
  timeZone?: string;
  deadlineMinutesBeforeKickoff?: number;
  scoringPresetKey?: string; // "CLASSIC" | "OUTCOME_ONLY" | "EXACT_HEAVY" ...
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

export async function updatePoolSettings(token: string, poolId: string, settings: { autoAdvanceEnabled?: boolean }): Promise<any> {
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

