"use client";

/**
 * Cross-tab analytics identity flush.
 *
 * The user can be signed in on multiple tabs. When they log out in one,
 * the server clears the httpOnly auth cookie — but the other tabs keep
 * firing events with the previous `user_id` bound to GA4 and Meta Pixel
 * until they refresh or re-navigate. On a shared device this causes
 * cross-user attribution: events produced by user B get stamped as
 * user A.
 *
 * `clearToken()` writes a timestamp to `localStorage` (cookies don't
 * emit `storage` events) so every other tab can see the logout. This
 * component owns the listener: when it fires, it unbinds the analytics
 * user id and revokes Meta Pixel consent, matching what the logging-out
 * tab did for itself. Pure side-effect; renders nothing.
 */

import { useEffect } from "react";
import { AUTH_LOGOUT_BROADCAST_KEY } from "@/lib/auth";
import { setAnalyticsUserId } from "@/lib/analytics";
import { revokeMetaPixelConsent } from "@/lib/metaPixel";

export function AuthAnalyticsSync(): null {
  useEffect(() => {
    function onStorage(event: StorageEvent): void {
      if (event.key !== AUTH_LOGOUT_BROADCAST_KEY) return;
      // `newValue` is non-null whenever the logging-out tab wrote a new
      // timestamp. A null value means the key was removed — we still
      // treat it as a logout signal.
      setAnalyticsUserId(null);
      revokeMetaPixelConsent();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
