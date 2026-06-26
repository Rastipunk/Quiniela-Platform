/**
 * Feature flags — runtime gates driven by environment variables.
 *
 * Single source of truth for beta / gradual rollouts so that turning a
 * feature on or off is an env-var change in Railway, never a code deploy.
 */

/**
 * Prediction-status feature (per-match "who has / hasn't submitted a pick").
 *
 * Rollout is scoped by the POOL CREATOR's email (`User.email` of
 * `Pool.createdByUserId`) via `PREDICTION_STATUS_HOST_ALLOWLIST`:
 *   - ""  / undefined        → disabled everywhere (safe default)
 *   - "*"                    → enabled for every pool (full rollout)
 *   - "a@x.com,b@y.com"      → enabled only for pools created by those users
 *
 * The env var is read at call time (not module load) so the gate can be
 * flipped without a process restart and so tests can vary it per-case.
 */
export function isPredictionStatusEnabled(creatorEmail: string | null | undefined): boolean {
  return emailInAllowlist(process.env.PREDICTION_STATUS_HOST_ALLOWLIST, creatorEmail);
}

/**
 * Persistent sessions ("mantener sesión abierta", ADR-081). Rollout scoped by
 * the logging-in user's email via `PERSISTENT_SESSIONS_ALLOWLIST`:
 *   - "" / undefined   → off for everyone (safe default — legacy 4h tokens)
 *   - "*"              → full rollout (every user gets session-backed tokens)
 *   - "a@x.com,b@y.com" → only those users get session-backed/persistent tokens
 *
 * Users OUTSIDE the allowlist get a legacy token (no sessionId, no refresh,
 * no Session row) — behaviour identical to before this feature. Read at call
 * time so flipping the env (me → "*") needs no redeploy.
 */
export function isPersistentSessionsEnabled(email: string | null | undefined): boolean {
  return emailInAllowlist(process.env.PERSISTENT_SESSIONS_ALLOWLIST, email);
}

/**
 * Leaderboard "puntos ganados / posiciones movidas" delta columns. Rollout
 * scoped by POOL id via `LEADERBOARD_DELTA_ALLOWLIST`:
 *   - "" / undefined        → columns hidden everywhere (safe default)
 *   - "*"                   → enabled for every pool
 *   - "<poolId>,<poolId>"   → enabled only for those pools
 * Read at call time so flipping the env needs no redeploy.
 */
export function isLeaderboardDeltaEnabledForPool(poolId: string | null | undefined): boolean {
  return emailInAllowlist(process.env.LEADERBOARD_DELTA_ALLOWLIST, poolId);
}

/** Shared allowlist semantics: ""→none, "*"→all, else case-insensitive match. */
function emailInAllowlist(raw: string | undefined, email: string | null | undefined): boolean {
  const v = (raw ?? "").trim();
  if (v === "") return false;
  if (v === "*") return true;
  if (!email) return false;
  const allow = new Set(
    v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  return allow.has(email.toLowerCase());
}
