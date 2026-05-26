/**
 * Build the corporate-activation page URL for the given locale.
 *
 * Must mirror `frontend-next/src/i18n/routing.ts` (the pathnames
 * registry). When that file's "/activar-cuenta" entry changes,
 * change this helper too — there's no single source of truth across
 * the backend/frontend boundary today.
 *
 * Concrete mapping at the time of writing (routing.ts:86-90):
 *   es → /activar-cuenta
 *   en → /en/activate-account
 *   pt → /pt/ativar-conta
 *
 * Triggered by Caterine Ochoa's case: the activation email correctly
 * arrives in the host's chosen language but the link sent every
 * employee to the Spanish UI. See EMAIL_LOCALE_HANDOFF_AUDIT.md §3.3.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export function buildActivationUrl(
  locale: "es" | "en" | "pt",
  token: string,
): string {
  const path =
    locale === "en"
      ? "/en/activate-account"
      : locale === "pt"
        ? "/pt/ativar-conta"
        : "/activar-cuenta"; // es default — no prefix per next-intl localePrefix: "as-needed"
  return `${FRONTEND_URL}${path}?token=${encodeURIComponent(token)}`;
}
