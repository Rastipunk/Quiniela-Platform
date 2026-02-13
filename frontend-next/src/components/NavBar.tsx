"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "../lib/auth";
import { getUserProfile, type UserProfile } from "../lib/api";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

export function NavBar() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // Cerrar menú móvil cuando cambia el tamaño de pantalla
  useEffect(() => {
    if (!isMobile) {
      setShowMobileMenu(false);
    }
  }, [isMobile]);

  async function loadProfile() {
    try {
      const token = getToken();
      if (!token) return;

      const data = await getUserProfile(token);
      setProfile(data.user);

      // Auto-actualizar timezone si no está configurado (cuentas existentes)
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
      const { updateUserProfile } = await import("../lib/api");

      await updateUserProfile(token, { timezone });

      // Recargar perfil para reflejar el cambio
      const data = await getUserProfile(token);
      setProfile(data.user);

      console.log(`Zona horaria configurada: ${timezone}`);
    } catch (err) {
      console.error("Error auto-updating timezone:", err);
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/");
    window.location.reload();
  }

  // Estilos base para el avatar
  const avatarStyle = {
    width: isMobile ? 36 : 32,
    height: isMobile ? 36 : 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: isMobile ? "1rem" : "1rem",
    fontWeight: "bold" as const,
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
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Logo / Brand */}
      <Link
        href="/"
        style={{
          fontSize: isMobile ? "1.25rem" : "1.5rem",
          fontWeight: "bold",
          color: "white",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          ...mobileInteractiveStyles.tapHighlight,
        }}
      >
        {"\uD83C\uDFC6"} Picks4All
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
              fontWeight: 500,
            }}
          >
            Mis Pools
          </Link>

          <Link
            href="/faq"
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: 500,
            }}
          >
            FAQ
          </Link>

          {/* User Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
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
                {/* Backdrop para cerrar el menú al hacer click fuera */}
                <div
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999,
                  }}
                />

                {/* Dropdown Menu */}
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    right: 0,
                    background: "white",
                    color: "#333",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    minWidth: "200px",
                    zIndex: 1000,
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
                    <div style={{ fontSize: "0.875rem", color: "#666" }}>
                      @{profile?.username}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>
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
                      color: "#333",
                      textDecoration: "none",
                      borderBottom: "1px solid #eee",
                      minHeight: TOUCH_TARGET.minimum,
                      lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    {"\uD83D\uDC64"} Mi Perfil
                  </Link>

                  {/* Admin Panel - solo para ADMIN */}
                  {profile?.platformRole === "ADMIN" && (
                    <>
                      <Link
                        href="/admin/settings/email"
                        onClick={() => setShowUserMenu(false)}
                        style={{
                          display: "block",
                          padding: "0.75rem 1rem",
                          color: "#333",
                          textDecoration: "none",
                          borderBottom: "1px solid #eee",
                          minHeight: TOUCH_TARGET.minimum,
                          lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f5f5f5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        {"\u2699\uFE0F"} Panel Admin
                      </Link>
                      <Link
                        href="/admin/feedback"
                        onClick={() => setShowUserMenu(false)}
                        style={{
                          display: "block",
                          padding: "0.75rem 1rem",
                          color: "#333",
                          textDecoration: "none",
                          borderBottom: "1px solid #eee",
                          minHeight: TOUCH_TARGET.minimum,
                          lineHeight: `${TOUCH_TARGET.minimum - 24}px`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f5f5f5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        {"\uD83D\uDCAC"} Ver Feedback
                      </Link>
                    </>
                  )}

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
                    {"\uD83D\uDEAA"} Cerrar Sesion
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
          {/* Avatar (visual only on mobile, menu opens on hamburger) */}
          <div style={avatarStyle}>
            {profile?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Abrir menu"
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
          {/* Backdrop */}
          <div
            onClick={() => setShowMobileMenu(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 998,
              animation: "fadeIn 0.2s ease",
            }}
          />

          {/* Slide-in Menu */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(280px, 85vw)",
              background: "#1a1a1a",
              zIndex: 999,
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
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                aria-label="Cerrar menu"
                style={{
                  width: TOUCH_TARGET.minimum,
                  height: TOUCH_TARGET.minimum,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "8px",
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
                  <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
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
                {"\uD83C\uDFE0"} Mis Pools
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
                {"\uD83D\uDC64"} Mi Perfil
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
                FAQ
              </Link>

              {/* Admin Panel - solo para ADMIN */}
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
                    {"\u2699\uFE0F"} Panel Admin
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
                    {"\uD83D\uDCAC"} Ver Feedback
                  </Link>
                </>
              )}
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
                  borderRadius: "8px",
                  color: "#ff6b6b",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {"\uD83D\uDEAA"} Cerrar Sesion
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
    </nav>
  );
}
