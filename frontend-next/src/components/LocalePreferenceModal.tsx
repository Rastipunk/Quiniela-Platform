"use client";

// Blocking first-login modal that captures the user's communication
// language. The language they pick is then used for both:
//   - emails (User.locale on the backend)
//   - UI rendering (we set NEXT_LOCALE cookie + reload to the correct
//     URL prefix so next-intl serves the page in that language)
//
// Cannot be dismissed without choosing a language: there is no close
// button, escape key, or click-outside path. Submitting is the only
// way out. The country dropdown is optional, and the "my language
// isn't in the list" picker is optional and never affects rendering —
// it only records demand for future locale support.
//
// Default radio selection is Spanish (the platform's primary locale).
// The trilingual heading + help text makes the modal legible to users
// who don't yet speak the URL-detected locale.

import { useEffect, useMemo, useState } from "react";
import { setLocalePreference, detectCountry } from "../lib/api/user";
import { LANGUAGES, COUNTRIES } from "../data/languages";
import { useIsMobile } from "../hooks/useIsMobile";
import { colors, radii, shadows } from "@/lib/theme";

type SupportedLocale = "es" | "en" | "pt";

type LocalePreferenceModalProps = {
  /** Optional pre-fill (e.g. from /me/detect-country called by the parent). */
  initialCountry?: string | null;
  /** Called after successful submit. Parent should typically set the
   *  cookie + reload to the new locale URL (see DEFAULT_ON_SAVE below). */
  onComplete?: (locale: SupportedLocale) => void;
};

const LOCALE_OPTIONS: Array<{ value: SupportedLocale; native: string; flag: string }> = [
  { value: "es", native: "Español", flag: "🇪🇸" },
  { value: "en", native: "English", flag: "🇬🇧" },
  { value: "pt", native: "Português", flag: "🇧🇷" },
];

// The modal can render before the user has picked a language, so all
// labels carry their text in the three supported locales simultaneously
// (line-stacked). This is intentional — they don't read all three, they
// read whichever they recognise.
const COPY = {
  title: {
    es: "Elige tu idioma",
    en: "Choose your language",
    pt: "Escolha seu idioma",
  },
  subtitle: {
    es: "Usaremos este idioma para tus correos y tu experiencia en Picks4All.",
    en: "We'll use this language for your emails and your Picks4All experience.",
    pt: "Usaremos este idioma para seus e-mails e sua experiência no Picks4All.",
  },
  countryLabel: {
    es: "País (opcional)",
    en: "Country (optional)",
    pt: "País (opcional)",
  },
  countryPlaceholder: {
    es: "Selecciona tu país",
    en: "Select your country",
    pt: "Selecione seu país",
  },
  otherLanguageHeading: {
    es: "¿Tu idioma no está en la lista?",
    en: "Is your language not in the list?",
    pt: "Seu idioma não está na lista?",
  },
  otherLanguageBody: {
    es: "Por ahora solo soportamos español, inglés y portugués. Si hablas otro idioma, dínoslo abajo — nos ayudará a decidir cuáles agregar en el futuro.",
    en: "We currently only support Spanish, English and Portuguese. If you speak another language, tell us below — it helps us decide which ones to add next.",
    pt: "Por enquanto só suportamos espanhol, inglês e português. Se você fala outro idioma, diga-nos abaixo — isso nos ajuda a decidir quais adicionar no futuro.",
  },
  otherLanguagePlaceholder: {
    es: "Busca tu idioma...",
    en: "Search your language...",
    pt: "Busque seu idioma...",
  },
  submit: {
    es: "Continuar",
    en: "Continue",
    pt: "Continuar",
  },
  submitting: {
    es: "Guardando...",
    en: "Saving...",
    pt: "Salvando...",
  },
};

function Trilingual({ slot }: { slot: keyof typeof COPY }) {
  const lines = COPY[slot];
  return (
    <>
      <div>{lines.es}</div>
      <div style={{ color: colors.textMuted, fontSize: "0.9em", marginTop: 2 }}>{lines.en}</div>
      <div style={{ color: colors.textMuted, fontSize: "0.9em", marginTop: 2 }}>{lines.pt}</div>
    </>
  );
}

export function LocalePreferenceModal({ initialCountry, onComplete }: LocalePreferenceModalProps) {
  const isMobile = useIsMobile();
  const [locale, setLocale] = useState<SupportedLocale>("es");
  const [country, setCountry] = useState<string>(initialCountry ?? "");
  const [showOther, setShowOther] = useState(false);
  const [otherSearch, setOtherSearch] = useState("");
  const [requestedLocale, setRequestedLocale] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(initialCountry ?? null);

  // Best-effort country detection when no initialCountry was passed.
  useEffect(() => {
    if (initialCountry) return;
    let cancelled = false;
    void detectCountry()
      .then((r) => {
        if (cancelled) return;
        if (r.country) {
          setDetected(r.country);
          setCountry(r.country);
        }
      })
      .catch(() => {
        /* detection is best-effort; silent failure is fine */
      });
    return () => { cancelled = true; };
  }, [initialCountry]);

  // Block native browser nav inside the modal (escape, etc). We don't
  // try to block the back button — that's outside our control and would
  // be hostile. The modal re-appears on the next page load anyway
  // because `needsLocalePrompt` is still true server-side.
  useEffect(() => {
    function blockEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", blockEscape, true);
    return () => window.removeEventListener("keydown", blockEscape, true);
  }, []);

  const filteredLanguages = useMemo(() => {
    if (!otherSearch.trim()) return LANGUAGES;
    const q = otherSearch.toLowerCase();
    return LANGUAGES.filter((l) =>
      l.code.toLowerCase().includes(q) ||
      l.names.es.toLowerCase().includes(q) ||
      l.names.en.toLowerCase().includes(q) ||
      l.names.pt.toLowerCase().includes(q),
    );
  }, [otherSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await setLocalePreference({
        locale,
        country: country || null,
        requestedLocale: requestedLocale || null,
      });
      if (onComplete) {
        onComplete(locale);
        return;
      }
      // Default success behaviour: set the NEXT_LOCALE cookie and
      // navigate to the user's chosen-locale URL so the UI renders
      // in the right language from this point onward. Pattern mirrors
      // LanguageSelector.switchLocale.
      document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax;Secure`;
      const path = window.location.pathname;
      let basePath = path;
      for (const loc of ["es", "en", "pt"] as const) {
        if (path === `/${loc}`) { basePath = "/"; break; }
        if (path.startsWith(`/${loc}/`)) { basePath = path.slice(loc.length + 1); break; }
      }
      const newPath = locale === "es" ? basePath : `/${locale}${basePath}`;
      window.location.href = newPath + window.location.search;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 12 : 24,
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="locale-modal-title"
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          overflow: "auto",
          background: colors.white,
          borderRadius: radii.xl,
          boxShadow: shadows.xl,
          padding: isMobile ? 20 : 28,
          boxSizing: "border-box",
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src="/brand/isotipo-degradado-180.png"
            alt="Picks4All"
            width={56}
            height={56}
            style={{ display: "inline-block", borderRadius: 12 }}
          />
        </div>

        {/* Title trilingual */}
        <h2
          id="locale-modal-title"
          style={{
            margin: "0 0 8px",
            fontSize: isMobile ? 20 : 24,
            fontWeight: 800,
            color: colors.textDark,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          <Trilingual slot="title" />
        </h2>

        {/* Subtitle trilingual */}
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          <Trilingual slot="subtitle" />
        </div>

        {/* Language radios */}
        <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {LOCALE_OPTIONS.map((opt) => {
            const checked = locale === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  border: `2px solid ${checked ? colors.brand : "#e5e7eb"}`,
                  borderRadius: radii.lg,
                  background: checked ? "#EEF2FF" : colors.white,
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  minHeight: 48,
                }}
              >
                <input
                  type="radio"
                  name="locale"
                  value={opt.value}
                  checked={checked}
                  onChange={() => setLocale(opt.value)}
                  style={{ width: 18, height: 18, accentColor: colors.brand }}
                />
                <span style={{ fontSize: 24 }}>{opt.flag}</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: checked ? 700 : 600,
                    color: colors.textDark,
                  }}
                >
                  {opt.native}
                </span>
              </label>
            );
          })}
        </div>

        {/* Country (optional) */}
        <label style={{ display: "block", marginBottom: 18 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 6 }}>
            <Trilingual slot="countryLabel" />
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 15,
              border: `1px solid ${colors.borderMedium}`,
              borderRadius: radii.md,
              background: colors.white,
              color: colors.textDark,
              boxSizing: "border-box",
              minHeight: 44,
            }}
          >
            <option value="">{COPY.countryPlaceholder[locale]}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.names[locale]}{detected === c.code ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>

        {/* "Other language" accordion */}
        <div
          style={{
            border: `1px dashed ${colors.borderMedium}`,
            borderRadius: radii.md,
            padding: showOther ? 14 : 12,
            marginBottom: 20,
            background: "#fafafa",
          }}
        >
          <button
            type="button"
            onClick={() => setShowOther((s) => !s)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: colors.brand,
            }}
          >
            {showOther ? "▼" : "▶"} <Trilingual slot="otherLanguageHeading" />
          </button>
          {showOther && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
                <Trilingual slot="otherLanguageBody" />
              </div>
              <input
                type="search"
                value={otherSearch}
                onChange={(e) => setOtherSearch(e.target.value)}
                placeholder={COPY.otherLanguagePlaceholder[locale]}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 14,
                  border: `1px solid ${colors.borderMedium}`,
                  borderRadius: radii.md,
                  marginBottom: 8,
                  boxSizing: "border-box",
                  minHeight: 40,
                }}
              />
              <select
                value={requestedLocale}
                onChange={(e) => setRequestedLocale(e.target.value)}
                size={Math.min(filteredLanguages.length + 1, 6)}
                style={{
                  width: "100%",
                  padding: 8,
                  fontSize: 14,
                  border: `1px solid ${colors.borderMedium}`,
                  borderRadius: radii.md,
                  background: colors.white,
                  boxSizing: "border-box",
                }}
              >
                <option value="">—</option>
                {filteredLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.names[locale]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              background: colors.errorBg,
              border: `1px solid ${colors.errorBorder}`,
              borderRadius: radii.md,
              color: colors.error,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 700,
            color: colors.white,
            background: submitting ? colors.disabled : colors.brand,
            border: "none",
            borderRadius: radii.lg,
            cursor: submitting ? "not-allowed" : "pointer",
            minHeight: 52,
          }}
        >
          {submitting ? COPY.submitting[locale] : COPY.submit[locale]}
        </button>
      </form>
    </div>
  );
}
