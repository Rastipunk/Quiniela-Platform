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
  const raw = (process.env.PREDICTION_STATUS_HOST_ALLOWLIST ?? "").trim();
  if (raw === "") return false; // default: off for everyone
  if (raw === "*") return true; // full rollout
  if (!creatorEmail) return false;

  const allow = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allow.has(creatorEmail.toLowerCase());
}
