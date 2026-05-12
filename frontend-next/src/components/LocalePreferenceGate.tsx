"use client";

// Wrapper that mounts the LocalePreferenceModal whenever the
// authenticated user has not yet completed the language-preference
// prompt. Lives in the authenticated layout so it appears on EVERY
// page once login is established and disappears the moment the user
// submits (the submit handler reloads the page in the chosen locale).
//
// We intentionally keep this guard cheap: a single /users/me/profile
// fetch on mount. If the fetch fails (network, expired token), we
// silently no-op — the modal is meant to improve UX, never to block
// the app on a transient API hiccup.

import { useEffect, useState } from "react";
import { getUserProfile } from "../lib/api/user";
import { getToken } from "../lib/auth";
import { LocalePreferenceModal } from "./LocalePreferenceModal";

export function LocalePreferenceGate() {
  const [needsPrompt, setNeedsPrompt] = useState(false);
  const [initialCountry, setInitialCountry] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return; // not authenticated yet — nothing to check
    let cancelled = false;
    void getUserProfile(token)
      .then((r) => {
        if (cancelled) return;
        if (r.user.needsLocalePrompt) {
          setInitialCountry(r.user.country ?? null);
          setNeedsPrompt(true);
        }
      })
      .catch(() => {
        /* never block on transient auth/network issues */
      });
    return () => { cancelled = true; };
  }, []);

  if (!needsPrompt) return null;
  return <LocalePreferenceModal initialCountry={initialCountry} />;
}
