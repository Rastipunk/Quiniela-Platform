"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "../hooks/useIsMobile";

interface PublicNavbarProps {
  onOpenAuth?: () => void;
}

export function PublicNavbar({ onOpenAuth }: PublicNavbarProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navLinks = [
    { to: "/", label: "Inicio" },
    { to: "/como-funciona", label: "Como Funciona" },
    { to: "/faq", label: "FAQ" },
    { to: "/que-es-una-quiniela", label: "¿Qué es una quiniela?" },
  ];

  const isActive = (path: string) => pathname === path;

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
        Picks4All
      </Link>

      {/* Desktop Navigation */}
      {!isMobile && (
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              href={link.to}
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

          <button
            onClick={onOpenAuth}
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
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
          >
            Ingresar
          </button>
        </div>
      )}

      {/* Mobile: Hamburger Button */}
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={onOpenAuth}
            style={{
              background: "white",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "6px",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ingresar
          </button>

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

            <div style={{ flex: 1, padding: "0.5rem 0" }}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  href={link.to}
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

            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenAuth?.();
                }}
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
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  minHeight: TOUCH_TARGET.comfortable,
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                Ingresar
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
