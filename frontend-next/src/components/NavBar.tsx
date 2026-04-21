"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getUserProfile, logout as apiLogout, type UserProfile } from "@/lib/api";
import { setAnalyticsUserId } from "@/lib/analytics";
import { revokeMetaPixelConsent } from "@/lib/metaPixel";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { BrandIsotipo, BrandLogotipo } from "./BrandLogo";
import { LanguageSelector } from "./LanguageSelector";
import { FeedbackModal } from "./FeedbackModal";
import { colors, radii, shadows, fontWeight as fw, zIndex } from "@/lib/theme";

export function NavBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const isMobile = useIsMobile();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMobile) {
      setShowMobileMenu(false);
    }
  }, [isMobile]);

  async function loadProfile() {
    try {
      const token = getToken();
      if (!token) return;

      // Use sessionStorage cache to avoid refetching on every navigation
      const CACHE_KEY = "p4a_profile_cache";
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { user, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            setProfile(user);
            if (!user.timezone) await autoUpdateTimezone(token);
            return;
          }
        } catch { /* ignore corrupt cache */ }
      }

      const data = await getUserProfile(token);
      setProfile(data.user);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user: data.user, ts: Date.now() }));

      if (!data.user.timezone) {
        await autoUpdateTimezone(token);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }

  async function autoUpdateTimezone(token: string) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { updateUserProfile } = await import("@/lib/api");

      await updateUserProfile(token, { timezone });

      const data = await getUserProfile(token);
      setProfile(data.user);
    } catch (err) {
      console.error("Error auto-updating timezone:", err);
    }
  }

  function handleLogout() {
    // Clear analytics identity BEFORE redirect so no event is attributed to
    // the previous user once the next page renders. Meta Pixel consent is
    // revoked as well to prevent cross-user tracking on shared devices.
    setAnalyticsUserId(null);
    revokeMetaPixelConsent();
    apiLogout().catch(() => {}); // Clear server-side cookie
    clearToken();
    sessionStorage.removeItem("p4a_profile_cache");
    router.push("/");
  }

  const avatarStyle = {
    width: isMobile ? 36 : 32,
    height: isMobile ? 36 : 32,
    borderRadius: radii.circle as string,
    background: colors.brandGradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: isMobile ? "1rem" : "1rem",
    fontWeight: fw.bold,
    color: "white",
    flexShrink: 0,
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0.75rem 1rem" : "1rem 2rem",
        background: "#1a1a1a",
        color: "white",
        boxShadow: shadows.card,
        position: "relative",
        zIndex: zIndex.sticky,
      }}
    >
      {/* Logo / Brand */}
      <Link
        href="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 12,
          ...mobileInteractiveStyles.tapHighlight,
        }}
      >
        <BrandIsotipo
          size={isMobile ? 40 : 48}
          variant="degradado"
          borderRadius={isMobile ? 8 : 10}
        />
        <BrandLogotipo height={isMobile ? 30 : 36} variant="blanco" />
      </Link>

      {/* Desktop Navigation */}
      {!isMobile && (
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          <Link
            href="/dashboard"
            style={{
              color: "white",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: fw.medium,
            }}
          >
            {t("myPools")}
          </Link>

          <Link
            href="/faq"
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: fw.medium,
            }}
          >
            {t("faq")}
          </Link>

          <Link
            href="/mundial-2026"
            style={{
              color: "white",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: fw.semibold,
            }}
          >
            {t("worldCup")}
          </Link>

          <Link
            href="/empresas"
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: fw.medium,
            }}
          >
            {t("enterprises")}
          </Link>

          <LanguageSelector />

          {/* User Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label={t("userMenu")}
              aria-expanded={showUserMenu}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: radii.lg,
                padding: "0.5rem 1rem",
                color: "white",
                cursor: "pointer",
                fontSize: "1rem",
                minHeight: TOUCH_TARGET.minimum,
              }}
            >
              <div style={avatarStyle}>
                {profile?.displayName?.charAt(0).toUpperCase() || "U"}
              </div>
              <span>{profile?.displayName || "Usuario"}</span>
              <span style={{ fontSize: "0.75rem" }}>{"\u25BC"}</span>
            </button>

            {showUserMenu && (
              <>
                <div
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: zIndex.overlay,
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    right: 0,
                    background: colors.white,
                    color: colors.textDark,
                    borderRadius: radii.lg,
                    boxShadow: shadows.md,
                    minWidth: "200px",
                    zIndex: zIndex.modal,
                    overflow: "hidden",
                  }}
                >
                  {/* User Info */}
                  <div
                    style={{
                      padding: "1rem",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                      {profile?.displayName}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: colors.textMuted }}>
                      @{profile?.username}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: colors.textLight, marginTop: "0.25rem" }}>
                      {profile?.email}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <Link
                    href="/profile"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: "block",
                      padding: "0.75rem 1rem",
                      color: colors.textDark,
                      textDecoration: "none",
                      borderBottom: "1px solid #eee",
                      minHeight: TOUCH_TARGET.minimum,
                      lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgLight;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    {"\uD83D\uDC64"} {t("myProfile")}
                  </Link>

                  {/* Admin Panel */}
                  {profile?.platformRole === "ADMIN" && (
                    <>
                      <Link
                        href="/admin/settings/email"
                        onClick={() => setShowUserMenu(false)}
                        style={{
                          display: "block",
                          padding: "0.75rem 1rem",
                          color: colors.textDark,
                          textDecoration: "none",
                          borderBottom: "1px solid #eee",
                          minHeight: TOUCH_TARGET.minimum,
                          lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = colors.bgLight;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        {"\u2699\uFE0F"} {t("adminPanel")}
                      </Link>
                      <Link
                        href="/admin/feedback"
                        onClick={() => setShowUserMenu(false)}
                        style={{
                          display: "block",
                          padding: "0.75rem 1rem",
                          color: colors.textDark,
                          textDecoration: "none",
                          borderBottom: "1px solid #eee",
                          minHeight: TOUCH_TARGET.minimum,
                          lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = colors.bgLight;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        {"\uD83D\uDCAC"} {t("viewFeedback")}
                      </Link>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowFeedback(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      background: "white",
                      border: "none",
                      color: colors.textDark,
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      borderBottom: "1px solid #eee",
                      minHeight: TOUCH_TARGET.minimum,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgLight;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    {"\uD83D\uDCAC"} {t("helpReport")}
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      background: "white",
                      border: "none",
                      color: "#d32f2f",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "1rem",
                      minHeight: TOUCH_TARGET.minimum,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#ffebee";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    {"\uD83D\uDEAA"} {t("logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Hamburger Button + Avatar */}
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={avatarStyle}>
            {profile?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label={t("openMenu")}
            aria-expanded={showMobileMenu}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              width: TOUCH_TARGET.comfortable,
              height: TOUCH_TARGET.comfortable,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "white",
                borderRadius: "2px",
                transition: "transform 0.2s ease, opacity 0.2s ease",
                transform: showMobileMenu ? "rotate(45deg) translate(5px, 5px)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "white",
                borderRadius: "2px",
                transition: "opacity 0.2s ease",
                opacity: showMobileMenu ? 0 : 1,
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "white",
                borderRadius: "2px",
                transition: "transform 0.2s ease, opacity 0.2s ease",
                transform: showMobileMenu ? "rotate(-45deg) translate(5px, -5px)" : "none",
              }}
            />
          </button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && showMobileMenu && (
        <>
          <div
            onClick={() => setShowMobileMenu(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: colors.overlay,
              zIndex: zIndex.overlay,
              animation: "fadeIn 0.2s ease",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(280px, 85vw)",
              background: "#1a1a1a",
              zIndex: zIndex.overlay,
              boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
              animation: "slideInRight 0.25s ease",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Header with close button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span style={{ fontWeight: fw.bold, fontSize: "1.1rem" }}>{t("menu")}</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                aria-label={t("closeMenu")}
                style={{
                  width: TOUCH_TARGET.minimum,
                  height: TOUCH_TARGET.minimum,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: radii.lg,
                  color: "white",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                X
              </button>
            </div>

            {/* User Info */}
            <div
              style={{
                padding: "1.25rem 1rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ ...avatarStyle, width: 48, height: 48, fontSize: "1.25rem" }}>
                  {profile?.displayName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <div style={{ fontWeight: fw.bold, marginBottom: "0.25rem" }}>
                    {profile?.displayName || "Usuario"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                    @{profile?.username || "usuario"}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div style={{ flex: 1, padding: "0.5rem 0" }}>
              <Link
                href="/dashboard"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "1rem",
                  minHeight: TOUCH_TARGET.comfortable,
                  borderLeft: "3px solid transparent",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\uD83C\uDFE0"} {t("myPools")}
              </Link>

              <Link
                href="/profile"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "1rem",
                  minHeight: TOUCH_TARGET.comfortable,
                  borderLeft: "3px solid transparent",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\uD83D\uDC64"} {t("myProfile")}
              </Link>

              <Link
                href="/faq"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  color: "rgba(255,255,255,0.7)",
                  textDecoration: "none",
                  fontSize: "1rem",
                  minHeight: TOUCH_TARGET.comfortable,
                  borderLeft: "3px solid transparent",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {t("faq")}
              </Link>

              <Link
                href="/mundial-2026"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "1rem",
                  fontWeight: 600,
                  minHeight: TOUCH_TARGET.comfortable,
                  borderLeft: "3px solid transparent",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {t("worldCup")}
              </Link>

              <Link
                href="/empresas"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  color: "rgba(255,255,255,0.7)",
                  textDecoration: "none",
                  fontSize: "1rem",
                  minHeight: TOUCH_TARGET.comfortable,
                  borderLeft: "3px solid transparent",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\u{1F3E2}"} {t("enterprises")}
              </Link>

              {/* Admin Panel */}
              {profile?.platformRole === "ADMIN" && (
                <>
                  <Link
                    href="/admin/settings/email"
                    onClick={() => setShowMobileMenu(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem",
                      color: "#a78bfa",
                      textDecoration: "none",
                      fontSize: "1rem",
                      minHeight: TOUCH_TARGET.comfortable,
                      borderLeft: "3px solid #a78bfa",
                      background: "rgba(167, 139, 250, 0.1)",
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {"\u2699\uFE0F"} {t("adminPanel")}
                  </Link>
                  <Link
                    href="/admin/feedback"
                    onClick={() => setShowMobileMenu(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem",
                      color: "#a78bfa",
                      textDecoration: "none",
                      fontSize: "1rem",
                      minHeight: TOUCH_TARGET.comfortable,
                      borderLeft: "3px solid #a78bfa",
                      background: "rgba(167, 139, 250, 0.1)",
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {"\uD83D\uDCAC"} {t("viewFeedback")}
                  </Link>
                </>
              )}

              {/* Language Selector in mobile menu */}
              <div
                style={{
                  padding: "1rem",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <LanguageSelector />
              </div>
            </div>

            {/* Help / Report */}
            <div style={{ padding: "0 1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowFeedback(true);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem 0",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "1rem",
                  textAlign: "left",
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\uD83D\uDCAC"} {t("helpReport")}
              </button>
            </div>

            {/* Logout */}
            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  handleLogout();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.875rem 1rem",
                  background: "rgba(211, 47, 47, 0.1)",
                  border: "1px solid #d32f2f",
                  borderRadius: radii.lg,
                  color: "#ff6b6b",
                  fontSize: "1rem",
                  fontWeight: fw.semibold,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\uD83D\uDEAA"} {t("logout")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Keyframe animations for mobile menu */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}
      </style>

      {showFeedback && (
        <FeedbackModal type="BUG" onClose={() => setShowFeedback(false)} />
      )}
    </nav>
  );
}
