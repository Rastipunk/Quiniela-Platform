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
  // The user first picks how many independent pools they want to run.
  // Editing this number resizes `poolSlots` immediately so they see the
  // matching number of slot inputs. Each pool can hold a different
  // slot count.
  const [poolCount, setPoolCount] = useState("1");
  const [poolSlots, setPoolSlots] = useState<string[]>([""]);
  const [showCountTooltip, setShowCountTooltip] = useState(false);
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
    setPoolCount("1");
    setPoolSlots([""]);
    setShowCountTooltip(false);
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

  // Per-pool slot edit — keep the array immutable and re-set state.
  function updatePoolSlots(index: number, value: string) {
    setPoolSlots((prev) => prev.map((v, i) => (i === index ? value : v)));
    // Clear the per-row error as the user types.
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`poolSlots.${index}`];
      return next;
    });
  }

  // Live-resize the slot rows as the user edits the count input. We
  // accept transient empty/invalid input (so the user can clear and
  // retype) but only resize when the value parses inside the valid
  // range. Out-of-range values are surfaced as an error and snapped
  // back on blur.
  function handlePoolCountChange(value: string) {
    setPoolCount(value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.poolCount;
      return next;
    });
    if (value.trim() === "") return;
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1 || n > MAX_POOLS) return;
    setPoolSlots((prev) => {
      if (n === prev.length) return prev;
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill("")];
      return prev.slice(0, n);
    });
    // Drop any per-row errors that now point past the end.
    setErrors((prev) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith("poolSlots.")) {
          out[k] = v;
          continue;
        }
        const i = parseInt(k.split(".")[1] ?? "", 10);
        if (Number.isFinite(i) && i < n) out[k] = v;
      }
      return out;
    });
  }

  // Snap the count input back to the array length on blur, so the
  // visible value always matches what will be submitted.
  function handlePoolCountBlur() {
    const n = parseInt(poolCount, 10);
    if (!Number.isFinite(n) || n < 1 || n > MAX_POOLS) {
      setPoolCount(String(poolSlots.length));
    }
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

            {/* How many independent pools? Editing this number live-
                resizes the slot rows below. */}
            <div style={fieldGroupStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  position: "relative",
                }}
              >
                <label htmlFor="cqp-pool-count" style={{ ...labelStyle, marginBottom: 0 }}>
                  {t("fields.poolCount")}
                </label>
                <button
                  type="button"
                  onClick={() => setShowCountTooltip((s) => !s)}
                  onBlur={() => setShowCountTooltip(false)}
                  aria-label={t("fields.poolCountTooltipAria")}
                  aria-expanded={showCountTooltip}
                  style={{
                    background: "transparent",
                    padding: 0,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    color: "var(--muted)",
                    fontSize: 11,
                    fontStyle: "italic",
                    lineHeight: 1,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: fw.semibold,
                    border: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  i
                </button>
                {showCountTooltip && (
                  <div
                    role="tooltip"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: "var(--text)",
                      color: "var(--surface)",
                      padding: "10px 12px",
                      borderRadius: radii.md,
                      fontSize: 12,
                      lineHeight: 1.5,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                      zIndex: 2,
                    }}
                  >
                    {t("fields.poolCountTooltip")}
                  </div>
                )}
              </div>
              <input
                id="cqp-pool-count"
                type="number"
                min={1}
                max={MAX_POOLS}
                value={poolCount}
                onChange={(e) => handlePoolCountChange(e.target.value)}
                onBlur={handlePoolCountBlur}
                required
                inputMode="numeric"
                style={{
                  ...inputStyle,
                  borderColor: errors.poolCount ? "#dc2626" : inputStyle.borderColor,
                }}
              />
              {errors.poolCount && <p style={errorTextStyle}>{errors.poolCount}</p>}
            </div>

            {/* Slot inputs — one row per pool. */}
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>
                {poolSlots.length === 1 ? t("fields.slotsSingle") : t("fields.slotsMultiple")}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {poolSlots.map((raw, i) => {
                  const errKey = `poolSlots.${i}`;
                  const err = errors[errKey];
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
                      </div>
                      {err && <p style={errorTextStyle}>{err}</p>}
                    </div>
                  );
                })}
              </div>
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
