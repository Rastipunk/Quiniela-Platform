import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

export function PublicNavbar() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navLinks = [
    { to: "/", label: "Inicio" },
    { to: "/how-it-works", label: "Cómo Funciona" },
    { to: "/faq", label: "FAQ" },
  ];

  const isActive = (path: string) => location.pathname === path;

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
        to="/"
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
        🏆 Picks4All
      </Link>

      {/* Desktop Navigation */}
      {!isMobile && (
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                color: isActive(link.to) ? "white" : "rgba(255,255,255,0.7)",
                textDecoration: "none",
                fontSize: "1rem",
                fontWeight: isActive(link.to) ? 600 : 400,
                transition: "color 0.2s ease",
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Login Button */}
          <Link
            to="/login"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "white",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "8px",
              padding: "0.625rem 1.25rem",
              fontSize: "1rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.2s ease",
            }}
          >
            Ingresar
          </Link>
        </div>
      )}

      {/* Mobile: Hamburger Button */}
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Login Button (compact) */}
          <Link
            to="/login"
            style={{
              background: "white",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "6px",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ingresar
          </Link>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Abrir menú"
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
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Menú</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                aria-label="Cerrar menú"
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
                ✕
              </button>
            </div>

            {/* Navigation Links */}
            <div style={{ flex: 1, padding: "0.5rem 0" }}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setShowMobileMenu(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem",
                    color: isActive(link.to) ? "white" : "rgba(255,255,255,0.7)",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: isActive(link.to) ? 600 : 400,
                    minHeight: TOUCH_TARGET.comfortable,
                    borderLeft: isActive(link.to) ? "3px solid white" : "3px solid transparent",
                    background: isActive(link.to) ? "rgba(255,255,255,0.1)" : "transparent",
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* CTA Button */}
            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <Link
                to="/login"
                onClick={() => setShowMobileMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.875rem 1rem",
                  background: "white",
                  color: "#1a1a1a",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                Ingresar
              </Link>
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
