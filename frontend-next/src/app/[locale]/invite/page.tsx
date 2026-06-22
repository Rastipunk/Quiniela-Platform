"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getToken } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { BRAND } from "@/lib/brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface InvitePreview {
  poolName: string;
  tournamentName: string | null;
  hostName: string | null;
  memberCount: number;
  status: string;
  valid: boolean;
  /**
   * Locale the landing should render in — the corporate host's chosen
   * invitation language. Null for personal pools (landing keeps the URL's
   * locale, as before). See ADR-062.
   */
  invitationLocale: string | null;
  /**
   * Present when the pool belongs to an Organization (corporate
   * pool). Used to swap Picks4All default branding for the
   * company's. Null for personal pools — landing renders unchanged.
   */
  organization: {
    name: string;
    logoBase64: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    welcomeMessage: string | null;
  } | null;
}

/**
 * Resolve the brand gradient colors for the landing.
 * Falls back to the platform default when the organization either
 * didn't set them or this is a personal pool.
 */
function resolveBrandColors(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): { primary: string; secondary: string; isCustom: boolean } {
  if (primary && secondary) {
    return { primary, secondary, isCustom: true };
  }
  return { primary: "#4f46e5", secondary: "#8b5cf6", isCustom: false };
}

/**
 * Distinguished error states so the landing renders honest copy
 * instead of always claiming "Invitation not found" — the rate-limit
 * case used to look identical to a truly-invalid code and made
 * corporate hosts look like they sent broken links to their teams.
 */
type InviteError = "INVALID" | "RATE_LIMITED" | "SERVER_ERROR";

function InviteContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("pool");
  const locale = useLocale();
  const code = searchParams.get("code");

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<InviteError | null>(null);
  const [attempt, setAttempt] = useState(0); // bump → re-fetch

  const isLoggedIn = typeof window !== "undefined" && !!getToken();
  const joinUrl = `/pools/join?code=${code}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(joinUrl)}`;

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setError("INVALID");
      return;
    }
    setLoading(true);
    setError(null);

    fetch(`${API_URL}/invite-preview/${encodeURIComponent(code)}`)
      .then(async (r) => {
        // Inspect status BEFORE parsing — a 429 has a JSON body whose
        // shape (just { error: "RATE_LIMIT_EXCEEDED" }) used to fall
        // through the !data.poolName branch and surface as
        // "Invitation not found", an outright wrong message.
        if (r.status === 429) {
          setError("RATE_LIMITED");
          return;
        }
        if (r.status >= 500) {
          setError("SERVER_ERROR");
          return;
        }
        const data = await r.json().catch(() => null);
        if (data && data.poolName) {
          setPreview(data);
        } else {
          setError("INVALID");
        }
      })
      .catch(() => setError("SERVER_ERROR"))
      .finally(() => setLoading(false));
  }, [code, attempt]);

  // Corporate invite locale handoff (ADR-062): a corporate host's invite link
  // is shared prefix-less, so it lands on the Spanish default and the browser
  // tab shows the Spanish title. If the pool's invitation language differs from
  // the current locale, hard-redirect to that locale's URL so the page AND the
  // tab title render in the right language — fixing even links already shared.
  // Scoped to corporate pools: personal pools return invitationLocale=null →
  // no redirect (behaviour unchanged). No loop: after the redirect the URL's
  // locale matches invitationLocale.
  const target = preview?.invitationLocale ?? null;
  const needsLocaleRedirect =
    !!target && ["es", "en", "pt"].includes(target) && target !== locale && !!code;

  useEffect(() => {
    if (!needsLocaleRedirect || !code || !target) return;
    const prefix = target === "es" ? "" : `/${target}`;
    window.location.replace(`${prefix}/invite?code=${encodeURIComponent(code)}`);
  }, [needsLocaleRedirect, code, target]);

  if (loading || needsLocaleRedirect) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--muted)", fontSize: "1rem" }}>...</div>
      </div>
    );
  }

  if (error || !preview) {
    // Map the discriminated error → specific copy. The retryable
    // branches expose a "Try again" CTA in addition to "Go home" so
    // the user has a one-click path that doesn't lose the link.
    const isRetryable = error === "RATE_LIMITED" || error === "SERVER_ERROR";
    const titleKey =
      error === "RATE_LIMITED"
        ? "inviteLanding.rateLimitTitle"
        : error === "SERVER_ERROR"
          ? "inviteLanding.serverErrorTitle"
          : "inviteLanding.invalidTitle";
    const descKey =
      error === "RATE_LIMITED"
        ? "inviteLanding.rateLimitDesc"
        : error === "SERVER_ERROR"
          ? "inviteLanding.serverErrorDesc"
          : "inviteLanding.invalidDesc";
    const emoji = error === "RATE_LIMITED" ? "⏳" : error === "SERVER_ERROR" ? "⚠️" : "😕";

    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "48px 32px", maxWidth: 440, width: "100%", textAlign: "center",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{emoji}</div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
            {t(titleKey)}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 24, lineHeight: 1.6 }}>
            {t(descKey)}
          </p>
          {isRetryable && (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              style={{
                display: "inline-block", background: "var(--primary)", color: "white",
                padding: "12px 24px", borderRadius: 12, fontWeight: 700, border: "none",
                cursor: "pointer", marginRight: 8, marginBottom: 8,
              }}
            >
              {t("inviteLanding.tryAgain")}
            </button>
          )}
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: isRetryable ? "transparent" : "var(--primary)",
              color: isRetryable ? "var(--text)" : "white",
              border: isRetryable ? "1px solid var(--border)" : "none",
              padding: "12px 24px", borderRadius: 12, fontWeight: 700, textDecoration: "none",
            }}
          >
            {t("inviteLanding.goHome")}
          </Link>
        </div>
      </div>
    );
  }

  // I18N_AUDIT F-7 + corporate-link work: detect corporate pool so
  // we render the company's branding (logo + colors + welcome
  // message) instead of the generic Picks4All gradient. Personal
  // pools (organization === null) render exactly as before — no
  // regression.
  const org = preview.organization;
  const brand = resolveBrandColors(org?.primaryColor, org?.secondaryColor);
  const ctaGradient = brand.isCustom
    ? `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`
    : colors.brandGradient;

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 20, padding: "0", maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* Top band — Picks4All eyebrow for personal pools,
            company logo + brand-color gradient for corporate */}
        {org ? (
          <div style={{
            background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`,
            padding: "32px 24px 24px",
            color: "white",
          }}>
            {org.logoBase64 ? (
              <img
                src={org.logoBase64}
                alt={org.name}
                style={{
                  maxHeight: 80, maxWidth: "70%", width: "auto", height: "auto",
                  objectFit: "contain",
                  background: "rgba(255,255,255,0.95)",
                  borderRadius: 12,
                  padding: "8px 16px",
                  marginBottom: 12,
                }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: "0 auto 12px",
                background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 800, color: "white",
                border: "2px solid rgba(255,255,255,0.3)",
              }}>
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: 1,
              textTransform: "uppercase", opacity: 0.85,
            }}>
              {org.name}
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1,
            color: BRAND.primary, textTransform: "uppercase",
            padding: "32px 24px 12px",
          }}>
            {BRAND.name}
          </div>
        )}

        <div style={{ padding: org ? "24px 32px 40px" : "8px 32px 40px" }}>
          {/* Invite message */}
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 12, lineHeight: 1.3, color: "var(--text)" }}>
            {org
              ? t("inviteLanding.companyInvite", { company: org.name })
              : t("inviteLanding.title", { host: preview.hostName || t("inviteLanding.someone") })}
          </h1>

          {/* Welcome message (corporate only). Stored escaped at
              persistence time per ADR-047, rendered as-is. */}
          {org?.welcomeMessage && (
            <div style={{
              background: brand.isCustom ? `${brand.primary}10` : "var(--bg)",
              border: `1px solid ${brand.isCustom ? `${brand.primary}33` : "var(--border)"}`,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: "0.92rem",
              fontStyle: "italic",
              color: "var(--text)",
              lineHeight: 1.5,
              textAlign: "left",
            }}>
              &ldquo;{org.welcomeMessage}&rdquo;
            </div>
          )}

          {/* Pool card */}
          <div style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14,
            padding: "20px 24px", marginBottom: 24, textAlign: "left",
          }}>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 6 }}>
              {preview.poolName}
            </div>
            {preview.tournamentName && (
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 8 }}>
                {preview.tournamentName}
              </div>
            )}
            <div style={{
              display: "flex", gap: 16, fontSize: "0.82rem", color: "var(--muted)",
            }}>
              <span>👥 {t("inviteLanding.members", { count: preview.memberCount })}</span>
              {preview.valid && (
                <span style={{ color: colors.successAlt }}>✓ {t("inviteLanding.active")}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {preview.valid ? (
            isLoggedIn ? (
              <a
                href={joinUrl}
                style={{
                  display: "block", background: ctaGradient, color: "white",
                  padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: "1rem",
                  textDecoration: "none", marginBottom: 12,
                }}
              >
                {t("inviteLanding.joinNow")}
              </a>
            ) : (
              <>
                <a
                  href={loginUrl}
                  style={{
                    display: "block", background: ctaGradient, color: "white",
                    padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: "1rem",
                    textDecoration: "none", marginBottom: 12,
                  }}
                >
                  {t("inviteLanding.createAccountToJoin")}
                </a>
                <a
                  href={loginUrl}
                  style={{
                    display: "block", color: "var(--text)", fontSize: "0.9rem",
                    fontWeight: 600, textDecoration: "none",
                  }}
                >
                  {t("inviteLanding.alreadyHaveAccount")}
                </a>
              </>
            )
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {t("inviteLanding.expired")}
            </p>
          )}

          {/* Picks4All attribution footer — corporate only, so the
              company hero up top doesn't compete with our brand
              while the platform is still acknowledged. */}
          {org && (
            <div style={{
              marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)",
              fontSize: "0.72rem", color: "var(--muted)", letterSpacing: 0.3,
            }}>
              {t("inviteLanding.poweredBy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--muted)" }}>...</div>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
