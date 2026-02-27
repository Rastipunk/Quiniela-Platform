"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { routing, type Locale } from "@/i18n/routing";

/* ── SVG Flag Components ── */

function FlagSpain({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 640 480" style={{ borderRadius: 3, display: "block" }}>
      <rect width="640" height="480" fill="#c60b1e" />
      <rect width="640" height="240" y="120" fill="#ffc400" />
    </svg>
  );
}

function FlagUSA({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 640 480" style={{ borderRadius: 3, display: "block" }}>
      <rect width="640" height="480" fill="#fff" />
      {/* Red stripes */}
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} width="640" height={Math.round(480 / 13)} y={Math.round(i * 480 / 13)} fill="#b22234" />
      ))}
      {/* Blue canton */}
      <rect width="256" height={Math.round(480 * 7 / 13)} fill="#3c3b6e" />
    </svg>
  );
}

function FlagBrazil({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 640 480" style={{ borderRadius: 3, display: "block" }}>
      <rect width="640" height="480" fill="#009b3a" />
      <polygon points="320,40 600,240 320,440 40,240" fill="#fedf00" />
      <circle cx="320" cy="240" r="100" fill="#002776" />
      <path d="M220,240 Q320,190 420,240" fill="none" stroke="#fff" strokeWidth="12" />
    </svg>
  );
}

/* ── Config ── */

const localeConfig: { locale: Locale; flag: (size?: number) => ReactNode; label: string }[] = [
  { locale: "es", flag: (s) => <FlagSpain size={s} />, label: "ES" },
  { locale: "en", flag: (s) => <FlagUSA size={s} />, label: "EN" },
  { locale: "pt", flag: (s) => <FlagBrazil size={s} />, label: "PT" },
];

/* ── Component ── */

export function LanguageSelector({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const t = useTranslations("language");
  const currentLocale = useLocale() as Locale;
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = localeConfig.find((l) => l.locale === currentLocale) ?? localeConfig[0];
  const isDark = variant === "dark";
  const locales: Locale[] = ["es", "en", "pt"];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function switchLocale(next: Locale) {
    if (next === currentLocale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setIsPending(true);

    // Use the browser's actual URL to reliably switch locale on any route,
    // including dynamic ones like /pools/[poolId].
    const currentPath = window.location.pathname;

    // Strip existing locale prefix (e.g. /en/pools/abc → /pools/abc)
    let basePath = currentPath;
    for (const loc of locales) {
      if (currentPath === `/${loc}`) {
        basePath = "/";
        break;
      }
      if (currentPath.startsWith(`/${loc}/`)) {
        basePath = currentPath.slice(loc.length + 1);
        break;
      }
    }

    // Translate localized paths (e.g. /terminos → /terms for EN)
    let targetPath = basePath;
    for (const mapping of Object.values(routing.pathnames)) {
      if (typeof mapping === "string") continue; // same for all locales
      const currentExternal = mapping[currentLocale as keyof typeof mapping];
      if (currentExternal === basePath) {
        targetPath = mapping[next as keyof typeof mapping] as string;
        break;
      }
    }

    // Default locale (es) needs no prefix (localePrefix: "as-needed")
    const newPath = next === "es" ? targetPath : `/${next}${targetPath}`;

    // Set cookie so the middleware knows the preferred locale and doesn't
    // redirect back (e.g. switching to ES without prefix while cookie says EN).
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;

    // Full navigation through the middleware ensures proper i18n setup
    window.location.href = newPath + window.location.search;
  }

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-block" }}
      role="group"
      aria-label={t("label")}
    >
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          color: isDark ? "white" : "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 600,
          opacity: isPending ? 0.6 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {current.flag(18)}
        <span>{current.label}</span>
        <span
          style={{
            fontSize: "0.65rem",
            marginLeft: 2,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          role="listbox"
          aria-activedescendant={`lang-${currentLocale}`}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: isDark ? "#1e1e1e" : "white",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            overflow: "hidden",
            zIndex: 1000,
            minWidth: 170,
            animation: "fadeInDown 0.15s ease",
          }}
        >
          {localeConfig.map((item) => {
            const isActive = item.locale === currentLocale;
            return (
              <button
                key={item.locale}
                id={`lang-${item.locale}`}
                role="option"
                aria-selected={isActive}
                onClick={() => switchLocale(item.locale)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  background: isActive
                    ? isDark ? "rgba(255,255,255,0.1)" : "rgba(102,126,234,0.08)"
                    : "transparent",
                  color: isDark ? "white" : "var(--text)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.target as HTMLElement).style.background = isDark
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(0,0,0,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.target as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {item.flag(22)}
                <span style={{ fontWeight: isActive ? 700 : 400 }}>
                  {t(item.locale)}
                </span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.75rem",
                      color: "#667eea",
                    }}
                  >
                    &#10003;
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
