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

/**
 * Animated "Evolución" bar-chart-race view. Rollout scoped by POOL id via
 * `BAR_RACE_ALLOWLIST` ("" off / "*" all / csv of poolIds). Read at call time.
 */
export function isBarRaceEnabledForPool(poolId: string | null | undefined): boolean {
  return emailInAllowlist(process.env.BAR_RACE_ALLOWLIST, poolId);
}

/**
 * Knockout extra-time scoring config v2 (per-phase toggle + "save per phase" +
 * end-of-group-stage deadline + blocking host banner; no email — each match
 * shows a per-match scoring legend instead). Rollout scoped by the
 * VIEWING/ACTING user's email via
 * `EXTRA_TIME_CONFIG_ALLOWLIST` ("" off / "*" all / csv of emails).
 *
 * Users OUTSIDE the allowlist keep the legacy live extra-time toggle in
 * `AdminSettingsToggles` untouched — this gate selects which UI + endpoint a
 * host gets, so the migration to v2 is reversible with one env change.
 * Read at call time so flipping the env needs no redeploy.
 */
export function isExtraTimeConfigEnabled(email: string | null | undefined): boolean {
  return emailInAllowlist(process.env.EXTRA_TIME_CONFIG_ALLOWLIST, email);
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
