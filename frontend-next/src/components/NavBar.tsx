"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getUserProfile, logout as apiLogout, type UserProfile } from "@/lib/api";
import { setAnalyticsUserId } from "@/lib/analytics";
import { revokeMetaPixelConsent } from "@/lib/metaPixel";
import { useIsMobile, BREAKPOINTS, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { BrandIsotipo, BrandLogotipo } from "./BrandLogo";
import { LanguageSelector } from "./LanguageSelector";
import { FeedbackModal } from "./FeedbackModal";
import { PoolNavItems, usePoolNavSnapshot } from "./pool/PoolNav";
import { colors, radii, shadows, spacing, fontSize, fontWeight as fw, zIndex } from "@/lib/theme";

// Hardcoded mobile height mirrors the rendered nav: 12px padding y +
// 40px logo. Update if the padding / logo size in the JSX below
// changes so the section header stacks under the navbar at the right
// offset (CSS var below). Desktop doesn't need this — the navbar
// stays in normal flow and the section header sticks at top:0 once
// the navbar scrolls past.
const NAVBAR_HEIGHT_MOBILE = 64;
// Don't auto-hide while the user is near the top — feels twitchy when
// the navbar snaps away on a tiny downward gesture.
const SCROLL_HIDE_THRESHOLD_PX = 80;
// Minimum delta in either direction before we react to a scroll
// gesture, smooths out trackpad jitter on mobile browsers.
const SCROLL_DELTA_THRESHOLD_PX = 6;

export function NavBar() {
  const t = useTranslations("nav");
  const tPool = useTranslations("pool");
  const router = useRouter();
  // Below tabletLg (1024px) we collapse to the consolidated drawer so
  // the global menu and pool sections live in one familiar place.
  const isMobile = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });
  const poolNav = usePoolNavSnapshot();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Auto-hide the navbar on mobile while the user is scrolling down,
  // bring it back as soon as they scroll up. Standard mobile pattern
  // (Twitter, Medium): keeps the section header anchored at the top
  // when reading, but a quick upward swipe surfaces global nav.
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMobile) {
      setShowMobileMenu(false);
    }
  }, [isMobile]);

  // Scroll-direction-aware hide. Only active on mobile; desktop
  // keeps the navbar in normal flow so it scrolls away with the page.
  useEffect(() => {
    if (!isMobile) {
      setNavHidden(false);
      return;
    }

    lastScrollYRef.current = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollYRef.current;

        if (currentY < SCROLL_HIDE_THRESHOLD_PX) {
          // Near the top: always visible. Avoids the "bouncy" feeling
          // when the user is at the start of the page.
          setNavHidden(false);
        } else if (delta > SCROLL_DELTA_THRESHOLD_PX) {
          setNavHidden(true);
        } else if (delta < -SCROLL_DELTA_THRESHOLD_PX) {
          setNavHidden(false);
        }

        lastScrollYRef.current = currentY;
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  // Publish the rendered navbar height as a CSS variable so any sticky
  // chrome below (e.g. PoolSectionHeader) can stack under the navbar
  // when it's visible and slide up to top:0 when it's hidden.
  useEffect(() => {
    const root = document.documentElement;
    if (!isMobile) {
      // Desktop: navbar lives in normal flow, sticky descendants don't
      // need to offset for it. Reset to 0.
      root.style.setProperty("--p4a-navbar-h", "0px");
      return;
    }
    const visibleHeight = navHidden ? 0 : NAVBAR_HEIGHT_MOBILE;
    root.style.setProperty("--p4a-navbar-h", `${visibleHeight}px`);
  }, [isMobile, navHidden]);

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
    <>
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0.75rem 1rem" : "1rem 2rem",
        background: "#1a1a1a",
        color: "white",
        boxShadow: shadows.card,
        // Mobile: sticky so the navbar can slide back in when the user
        // scrolls up without having to return to the top. Desktop:
        // relative so the navbar scrolls away with the page like before.
        position: isMobile ? "sticky" : "relative",
        top: 0,
        // The hide animation only kicks in when navHidden flips. We
        // intentionally don't set transform when navHidden=false because
        // any non-`none` transform turns this <nav> into the containing
        // block for `position: fixed` descendants — and the drawer used
        // to live inside <nav>, which is what made it collapse to a
        // 64px-tall sliver on mobile. The drawer now lives outside the
        // <nav> below, so this is double-safe.
        transform: navHidden ? "translateY(-100%)" : undefined,
        transition: "transform 0.25s ease",
        zIndex: zIndex.sticky,
        // Track height matches NAVBAR_HEIGHT_MOBILE constant so the
        // CSS variable above stays in sync with what's actually rendered.
        height: isMobile ? NAVBAR_HEIGHT_MOBILE : undefined,
        boxSizing: "border-box" as const,
      }}
    >
      {/* Left slot: hamburger (mobile only) + logo */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 12 }}>
        {isMobile && (
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
        )}
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
      </div>

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
                      <Link
                        href="/admin/analytics"
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
                        {"\uD83D\uDCCA"} {t("viewAnalytics")}
                      </Link>
                      <Link
                        href="/admin/ventas/cotizaciones"
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
                        {"\uD83D\uDCB0"} {t("salesManagement")}
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

      {/* Mobile: Avatar (right slot — also opens drawer for thumb access) */}
      {isMobile && (
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label={t("openMenu")}
          aria-expanded={showMobileMenu}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            ...mobileInteractiveStyles.tapHighlight,
          }}
        >
          <div style={avatarStyle}>
            {profile?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
        </button>
      )}
    </nav>

      {/* Mobile Menu Overlay — rendered OUTSIDE <nav> on purpose. The
          nav uses `transform` for its hide-on-scroll animation, which
          would turn it into the containing block for `position: fixed`
          descendants (the drawer is fixed-positioned). Sibling-of-nav
          keeps the drawer fixed-to-viewport regardless of nav state. */}
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
              left: 0,
              bottom: 0,
              width: "min(280px, 85vw)",
              background: "#1a1a1a",
              zIndex: zIndex.overlay,
              boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
              animation: "slideInLeft 0.25s ease",
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

            {/* Pool sections — only when the user is on a pool page (priority block) */}
            {poolNav && (
              <>
                <div
                  style={{
                    padding: `${spacing.md}px ${spacing.lg}px ${spacing.xs}px`,
                    fontSize: fontSize.xs,
                    fontWeight: fw.bold,
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {tPool("nav.sectionsTitle")}
                </div>
                <PoolNavItems
                  variant="dark"
                  showHostItems={poolNav.showHostItems}
                  showBrandingTab={poolNav.showBrandingTab}
                  tabBadges={poolNav.tabBadges}
                  hasUrgent={poolNav.hasUrgent}
                  onAfterSelect={() => setShowMobileMenu(false)}
                />
                <div
                  style={{
                    margin: `${spacing.md}px 0`,
                    height: 1,
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
              </>
            )}

            {/* Navigation Links */}
            <div style={{ flex: 1, padding: "0.5rem 0" }}>
              {poolNav && (
                <div
                  style={{
                    padding: `${spacing.xs}px ${spacing.lg}px ${spacing.xs}px`,
                    fontSize: fontSize.xs,
                    fontWeight: fw.bold,
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {t("appSection")}
                </div>
              )}
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
                  <Link
                    href="/admin/analytics"
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
                    {"\uD83D\uDCCA"} {t("viewAnalytics")}
                  </Link>
                  <Link
                    href="/admin/ventas/cotizaciones"
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
                    {"\uD83D\uDCB0"} {t("salesManagement")}
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
          @keyframes slideInLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}
      </style>

      {showFeedback && (
        <FeedbackModal type="BUG" onClose={() => setShowFeedback(false)} />
      )}
    </>
  );
}
