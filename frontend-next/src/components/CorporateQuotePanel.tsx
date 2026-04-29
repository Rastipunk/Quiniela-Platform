"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { colors, radii, fontWeight as fw, zIndex } from "@/lib/theme";
import { LIMITS } from "@/lib/validation";
import {
  COUNTRY_CODES,
  getCountriesSorted,
  isValidCountryCode,
  resolveCountryCode,
  type SupportedLocale,
} from "@/lib/countries";
import { submitCorporateInquiry } from "@/lib/api/corporate";
import { getPaymentCountry } from "@/lib/api/payments";
import { trackEvent } from "@/lib/analytics";

interface CorporateQuotePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

const COUNTRY_DATALIST_ID = "corp-quote-countries";

export function CorporateQuotePanel({ isOpen, onClose }: CorporateQuotePanelProps) {
  const t = useTranslations("enterprise.quotePanel");
  const locale = useLocale() as SupportedLocale;
  const isMobile = useIsMobile();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("USD");
  // One slot count per pool. The user starts with a single input ("how
  // many slots") and can press "Add another pool" to append more
  // entries — each pool can have a different size if they want.
  const [poolSlots, setPoolSlots] = useState<string[]>([""]);
  const [message, setMessage] = useState("");
  const MAX_POOLS = 50;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sortedCountries = useMemo(() => getCountriesSorted(locale), [locale]);

  // Pre-select currency based on geo (Colombia → COP, else USD).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getPaymentCountry()
      .then((c) => {
        if (cancelled) return;
        setCurrency(c === "CO" ? "COP" : "USD");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ESC closes.
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset form when panel closes (so reopening shows a clean slate).
  useEffect(() => {
    if (isOpen) return;
    setCompanyName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setCountryInput("");
    setPoolSlots([""]);
    setMessage("");
    setErrors({});
    setStatus("idle");
    setSubmitError(null);
  }, [isOpen]);

  function validate(): { ok: boolean; countryCode: string | null; parsedPools: number[] } {
    const next: Record<string, string> = {};
    const cn = companyName.trim();
    const ctn = contactName.trim();
    const cem = contactEmail.trim();
    const ctp = contactPhone.trim();

    if (cn.length < LIMITS.companyName.min) next.companyName = t("errors.required");
    if (cn.length > LIMITS.companyName.max) next.companyName = t("errors.tooLong");

    if (ctn.length < 2) next.contactName = t("errors.required");
    if (ctn.length > LIMITS.contactName.max) next.contactName = t("errors.tooLong");

    if (!cem || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cem)) {
      next.contactEmail = t("errors.invalidEmail");
    }

    if (ctp.length > LIMITS.contactPhone.max) next.contactPhone = t("errors.tooLong");

    const countryCode = resolveCountryCode(countryInput, locale);
    if (!countryCode) next.country = t("errors.invalidCountry");

    // Validate each pool slot input. The error key is suffixed with the
    // index so we can highlight the specific row.
    const parsedPools: number[] = [];
    poolSlots.forEach((raw, i) => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v) || v < LIMITS.slotsPerPool.min) {
        next[`poolSlots.${i}`] = t("errors.minSlots");
      } else if (v > LIMITS.slotsPerPool.max) {
        next[`poolSlots.${i}`] = t("errors.maxSlots");
      } else {
        parsedPools.push(v);
      }
    });

    if (message.length > LIMITS.inquiryMessage.max) {
      next.message = t("errors.tooLong");
    }

    setErrors(next);
    return {
      ok: Object.keys(next).length === 0,
      countryCode,
      parsedPools,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    const { ok, countryCode, parsedPools } = validate();
    if (!ok || !countryCode) return;

    setStatus("loading");
    setSubmitError(null);

    try {
      await submitCorporateInquiry({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim() || undefined,
        country: countryCode,
        currency,
        poolsConfig: parsedPools,
        message: message.trim() || undefined,
        locale,
      });

      trackEvent("corporate_quote_submitted", {
        country: countryCode,
        currency,
        number_of_pools: parsedPools.length,
        total_slots: parsedPools.reduce((sum, n) => sum + n, 0),
      });

      setStatus("success");
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message ? err.message : t("errors.submitFailed");
      setSubmitError(errMsg);
      setStatus("error");
    }
  }

  // Pool list helpers — keep the array immutable and re-set state.
  function updatePoolSlots(index: number, value: string) {
    setPoolSlots((prev) => prev.map((v, i) => (i === index ? value : v)));
    // Clear the per-row error as the user types.
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`poolSlots.${index}`];
      return next;
    });
  }

  function addPool() {
    setPoolSlots((prev) => (prev.length >= MAX_POOLS ? prev : [...prev, ""]));
  }

  function removePool(index: number) {
    setPoolSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    setErrors((prev) => {
      const next = { ...prev };
      // Reindex error keys so highlighting still matches the new array.
      const remapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(next)) {
        if (!k.startsWith("poolSlots.")) {
          remapped[k] = v;
          continue;
        }
        const i = parseInt(k.split(".")[1] ?? "", 10);
        if (i === index) continue;
        remapped[`poolSlots.${i > index ? i - 1 : i}`] = v;
      }
      return remapped;
    });
  }

  if (!isOpen) return null;

  // ─── Styles ───────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: zIndex.modal - 1,
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: isMobile ? "100%" : 480,
    maxWidth: "100%",
    background: "var(--surface)",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
    zIndex: zIndex.modal,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--muted)",
    fontWeight: fw.medium,
    marginBottom: 6,
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontSize: 15,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: radii.md,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    boxSizing: "border-box",
  };
  const errorTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  };
  const fieldGroupStyle: React.CSSProperties = { marginBottom: 16 };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="corp-quote-title"
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            position: "sticky",
            top: 0,
            background: "var(--surface)",
            zIndex: 1,
          }}
        >
          <div>
            <h2
              id="corp-quote-title"
              style={{ fontSize: 20, fontWeight: fw.bold, margin: 0, color: "var(--text)" }}
            >
              {t("title")}
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeButton")}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 24,
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--muted)",
              padding: 4,
              minWidth: TOUCH_TARGET.minimum,
              minHeight: TOUCH_TARGET.minimum,
              ...mobileInteractiveStyles.tapHighlight,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        {status === "success" ? (
          <div style={{ padding: "32px 24px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h3 style={{ fontSize: 18, fontWeight: fw.bold, color: "var(--text)", marginBottom: 12 }}>
              {t("successTitle")}
            </h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 24 }}>
              {t("successMessage")}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: colors.brandGradient,
                color: "white",
                border: "none",
                padding: "12px 32px",
                borderRadius: radii.md,
                fontSize: 15,
                fontWeight: fw.semibold,
                cursor: "pointer",
                minHeight: TOUCH_TARGET.comfortable,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {t("closeButton")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "20px 24px", flex: 1 }} noValidate>
            <datalist id={COUNTRY_DATALIST_ID}>
              {sortedCountries.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>

            {/* Company name */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-company" style={labelStyle}>
                {t("fields.companyName")}
              </label>
              <input
                id="cqp-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={LIMITS.companyName.max}
                required
                autoComplete="organization"
                style={{
                  ...inputStyle,
                  borderColor: errors.companyName ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.companyName && <p style={errorTextStyle}>{errors.companyName}</p>}
            </div>

            {/* Contact name */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-contact-name" style={labelStyle}>
                {t("fields.contactName")}
              </label>
              <input
                id="cqp-contact-name"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                maxLength={LIMITS.contactName.max}
                required
                autoComplete="name"
                style={{
                  ...inputStyle,
                  borderColor: errors.contactName ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.contactName && <p style={errorTextStyle}>{errors.contactName}</p>}
            </div>

            {/* Contact email */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-email" style={labelStyle}>
                {t("fields.contactEmail")}
              </label>
              <input
                id="cqp-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  ...inputStyle,
                  borderColor: errors.contactEmail ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.contactEmail && <p style={errorTextStyle}>{errors.contactEmail}</p>}
            </div>

            {/* Contact phone (optional) */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-phone" style={labelStyle}>
                {t("fields.contactPhone")}
              </label>
              <input
                id="cqp-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                maxLength={LIMITS.contactPhone.max}
                autoComplete="tel"
                style={{
                  ...inputStyle,
                  borderColor: errors.contactPhone ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.contactPhone && <p style={errorTextStyle}>{errors.contactPhone}</p>}
            </div>

            {/* Country (datalist autocomplete) */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-country" style={labelStyle}>
                {t("fields.country")}
              </label>
              <input
                id="cqp-country"
                type="text"
                list={COUNTRY_DATALIST_ID}
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                onBlur={() => {
                  if (!countryInput) return;
                  const code = resolveCountryCode(countryInput, locale);
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (code) {
                      delete next.country;
                    } else {
                      next.country = t("errors.invalidCountry");
                    }
                    return next;
                  });
                }}
                placeholder={t("fields.countryPlaceholder")}
                required
                autoComplete="country-name"
                style={{
                  ...inputStyle,
                  borderColor: errors.country ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.country && <p style={errorTextStyle}>{errors.country}</p>}
            </div>

            {/* Pool slots — one input by default, plus an "Add another pool"
                button so different pools can have different sizes. */}
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>
                {poolSlots.length === 1 ? t("fields.slotsSingle") : t("fields.slotsMultiple")}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {poolSlots.map((raw, i) => {
                  const errKey = `poolSlots.${i}`;
                  const err = errors[errKey];
                  const showRemove = poolSlots.length > 1;
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {poolSlots.length > 1 && (
                          <span
                            style={{
                              fontSize: 13,
                              color: "var(--muted)",
                              minWidth: 64,
                              fontWeight: fw.medium,
                            }}
                          >
                            {t("fields.poolLabel", { n: i + 1 })}
                          </span>
                        )}
                        <input
                          type="number"
                          min={LIMITS.slotsPerPool.min}
                          max={LIMITS.slotsPerPool.max}
                          value={raw}
                          onChange={(e) => updatePoolSlots(i, e.target.value)}
                          required
                          inputMode="numeric"
                          placeholder="50"
                          aria-label={
                            poolSlots.length === 1
                              ? t("fields.slotsSingle")
                              : t("fields.poolLabel", { n: i + 1 })
                          }
                          style={{
                            ...inputStyle,
                            flex: 1,
                            borderColor: err ? "#dc2626" : inputStyle.borderColor,
                          }}
                        />
                        {showRemove && (
                          <button
                            type="button"
                            onClick={() => removePool(i)}
                            aria-label={t("fields.removePool")}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--border)",
                              borderRadius: radii.md,
                              color: "var(--muted)",
                              fontSize: 18,
                              lineHeight: 1,
                              cursor: "pointer",
                              minWidth: TOUCH_TARGET.minimum,
                              minHeight: TOUCH_TARGET.minimum,
                              ...mobileInteractiveStyles.tapHighlight,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {err && <p style={errorTextStyle}>{err}</p>}
                    </div>
                  );
                })}
              </div>
              {poolSlots.length < MAX_POOLS && (
                <button
                  type="button"
                  onClick={addPool}
                  style={{
                    marginTop: 10,
                    background: "transparent",
                    border: `1px dashed var(--border)`,
                    borderRadius: radii.md,
                    color: colors.brand,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: fw.semibold,
                    cursor: "pointer",
                    width: "100%",
                    minHeight: TOUCH_TARGET.minimum,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  + {t("fields.addPool")}
                </button>
              )}
            </div>

            {/* Currency radios */}
            <div style={fieldGroupStyle}>
              <span style={labelStyle}>{t("fields.currency")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {(["COP", "USD"] as const).map((cur) => {
                  const selected = currency === cur;
                  return (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setCurrency(cur)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: radii.md,
                        border: `2px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                        background: selected ? "rgba(102, 126, 234, 0.08)" : "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontWeight: selected ? fw.semibold : fw.medium,
                        cursor: "pointer",
                        minHeight: TOUCH_TARGET.minimum,
                        ...mobileInteractiveStyles.tapHighlight,
                      }}
                    >
                      {t(`currencyOptions.${cur}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div style={fieldGroupStyle}>
              <label htmlFor="cqp-message" style={labelStyle}>
                {t("fields.message")}
              </label>
              <textarea
                id="cqp-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={LIMITS.inquiryMessage.max}
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              {errors.message && <p style={errorTextStyle}>{errors.message}</p>}
            </div>

            {/* Submit error */}
            {status === "error" && submitError && (
              <div
                style={{
                  padding: 12,
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  borderRadius: radii.md,
                  color: "#dc2626",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                width: "100%",
                padding: 14,
                background: colors.brandGradient,
                color: "white",
                border: "none",
                borderRadius: radii.md,
                fontSize: 15,
                fontWeight: fw.semibold,
                cursor: status === "loading" ? "wait" : "pointer",
                opacity: status === "loading" ? 0.7 : 1,
                minHeight: TOUCH_TARGET.comfortable,
                ...mobileInteractiveStyles.tapHighlight,
              }}
            >
              {status === "loading" ? t("submitting") : t("submitButton")}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

// Re-export the COUNTRY_CODES so consumers can introspect if needed.
export { COUNTRY_CODES, isValidCountryCode };
