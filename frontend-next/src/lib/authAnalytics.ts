/**
 * Auth-success analytics binding.
 *
 * Centralises the sequence of calls we make after any successful login
 * or registration so every path (email, Google, corporate activation)
 * sets the same GA4 user_properties and Meta Advanced Matching data.
 * Keeping this in one place avoids drift between auth flows.
 */

import { setAnalyticsUserId, setUserProperties } from "./analytics";
import { setMetaUserData } from "./metaPixel";
import { getUserAggregated } from "./api/user";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
}

/**
 * Bind a freshly authenticated user to both GA4 and Meta. Fetches the
 * aggregated snapshot so user_properties (tier, pool_count, is_corporate)
 * are available on the very next event. Failures on the snapshot fetch
 * are swallowed — analytics must never block the auth UX.
 */
export async function bindAuthenticatedUserForAnalytics(user: AuthUser): Promise<void> {
  setAnalyticsUserId(user.id);
  // Advanced Matching for Meta — hashed in metaPixel.ts before dispatch.
  await setMetaUserData({
    externalId: user.id,
    email: user.email,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    country: user.country ?? undefined,
    gender: user.gender ?? undefined,
    dateOfBirth: user.dateOfBirth ?? undefined,
  });

  // GA4 user_properties, best-effort. If the aggregated snapshot endpoint
  // fails (network glitch, 5xx, etc.) we still keep the user_id bound;
  // a later event can refresh properties when the network recovers.
  try {
    const snapshot = await getUserAggregated();
    setUserProperties({
      tier: snapshot.tier,
      is_corporate: snapshot.is_corporate,
      country: snapshot.country,
      pool_count: snapshot.pool_count,
      paid_pool_count: snapshot.paid_pool_count,
      account_age_days: snapshot.account_age_days,
      platform_role: snapshot.platform_role,
      acquisition_source: snapshot.acquisition_source,
      acquisition_campaign: snapshot.acquisition_campaign,
    });
  } catch {
    // swallow — user_id is already bound, properties can refresh later
  }
}

/**
 * Re-fetch and re-apply user_properties. Call after mutations that
 * change the user's segment (pool created, payment completed) so the
 * next events report the updated values.
 */
export async function refreshUserProperties(): Promise<void> {
  try {
    const snapshot = await getUserAggregated();
    setUserProperties({
      tier: snapshot.tier,
      is_corporate: snapshot.is_corporate,
      country: snapshot.country,
      pool_count: snapshot.pool_count,
      paid_pool_count: snapshot.paid_pool_count,
      account_age_days: snapshot.account_age_days,
      platform_role: snapshot.platform_role,
      acquisition_source: snapshot.acquisition_source,
      acquisition_campaign: snapshot.acquisition_campaign,
    });
  } catch {
    // ignore — best effort
  }
}
