"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  redeemAccountReceivable,
  type RedemptionSummary,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatPrice } from "@/lib/pricing";
import { colors, fontSize, fontWeight, spacing, radii } from "@/lib/theme";
import { ApiError } from "@/lib/apiError";

interface Props {
  /** Called when the customer applies a valid PENDING code. The
   *  parent receives the full summary and is responsible for locking
   *  capacity + propagating accountReceivableId to checkout. */
  onRedeem: (summary: RedemptionSummary) => void;
  /** Called when the customer removes the applied CC via the "Quitar"
   *  button. The parent should clear its accountReceivableId state. */
  onClear: () => void;
  /** The summary currently applied (if any). Passed in as a prop so
   *  the parent owns the source of truth; the box re-derives its
   *  "applied" visual state from this. */
  applied: RedemptionSummary | null;
  isMobile: boolean;
}

// Normalises user input on the fly: allows hyphens / spaces, strips
// non-digits for the API call. Up to 12 chars input (matches backend
// Zod min/max).
function normaliseCode(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 8);
}

function formatDisplay(raw: string): string {
  const digits = normaliseCode(raw);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function formatRedeemedAmount(summary: RedemptionSummary): string {
  if (summary.currency === "COP" && summary.amountCop !== null) {
    return formatPrice(summary.amountCop, "COP");
  }
  if (summary.currency === "USD" && summary.amountUsdCents !== null) {
    return formatPrice(summary.amountUsdCents / 100, "USD");
  }
  return "";
}

export default function AccountReceivableRedemptionBox({
  onRedeem,
  onClear,
  applied,
  isMobile,
}: Props) {
  const t = useTranslations("accountReceivableRedemption");
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Applied state ───────────────────────────────────────────
  if (applied) {
    return (
      <div
        style={{
          padding: spacing.md,
          background: "#dcfce7",
          border: "1px solid #86efac",
          borderRadius: radii.md,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: spacing.md,
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: "1.2rem" }}>✓</span>
            <span style={{ color: "#166534", fontWeight: fontWeight.semibold, fontSize: fontSize.sm }}>
              {t("successTitle", { defaultMessage: "Cuenta de cobro aplicada" })}
            </span>
          </div>
          <div style={{ color: "#15803d", fontSize: fontSize.sm }}>
            <span style={{ fontFamily: "monospace", fontWeight: fontWeight.semibold }}>{applied.consecutive}</span>
            {" — "}
            {applied.targetCapacity}{" "}
            {t("slots", { defaultMessage: "cupos" })}
            {" "}
            {t("forAmount", { defaultMessage: "por" })}
            {" "}
            <strong>{formatRedeemedAmount(applied)}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setInput("");
            setExpanded(false);
            setError(null);
          }}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "1px solid #86efac",
            borderRadius: radii.md,
            color: "#166534",
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.sm,
            cursor: "pointer",
            minHeight: 40,
            alignSelf: isMobile ? "stretch" : "center",
          }}
        >
          {t("remove", { defaultMessage: "Quitar" })}
        </button>
      </div>
    );
  }

  // ── Collapsed CTA ───────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        style={{
          marginBottom: spacing.md,
          padding: spacing.md,
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: radii.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: fontSize.sm }}>
          {t("cta", { defaultMessage: "¿Tienes una cuenta de cobro?" })}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            padding: "8px 16px",
            background: "var(--surface)",
            border: `1px solid ${colors.brand}`,
            borderRadius: radii.md,
            color: colors.brand,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.sm,
            cursor: "pointer",
            minHeight: 40,
          }}
        >
          {t("applyCta", { defaultMessage: "Aplicar código" })}
        </button>
      </div>
    );
  }

  // ── Expanded form ───────────────────────────────────────────
  async function handleApply() {
    setError(null);
    const code = normaliseCode(input);
    if (code.length !== 8) {
      setError(t("errorFormat", { defaultMessage: "El código debe tener 8 dígitos." }));
      return;
    }
    const token = getToken();
    if (!token) {
      setError(t("errorAuth", { defaultMessage: "Inicia sesión para aplicar el código." }));
      return;
    }
    setBusy(true);
    try {
      const { accountReceivable } = await redeemAccountReceivable(token, code);
      onRedeem(accountReceivable);
      // Collapse the input; parent will re-render with `applied`
      // set, so we won't actually re-enter this branch.
      setInput("");
      setExpanded(false);
    } catch (err: unknown) {
      const e = err as ApiError;
      // Map backend error codes to user-friendly messages. The
      // redemption endpoint distinguishes statuses with distinct
      // codes (ALREADY_PAID, ALREADY_REDEEMED, CANCELLED, EXPIRED,
      // NOT_FOUND).
      const code = e?.code ?? "";
      if (code === "NOT_FOUND") {
        setError(t("errorNotFound", { defaultMessage: "No encontramos esta cuenta de cobro." }));
      } else if (code === "ALREADY_PAID") {
        setError(t("errorAlreadyPaid", { defaultMessage: "Esta cuenta de cobro ya fue pagada." }));
      } else if (code === "ALREADY_REDEEMED") {
        setError(t("errorAlreadyRedeemed", { defaultMessage: "Esta cuenta de cobro ya está en uso." }));
      } else if (code === "CANCELLED") {
        setError(t("errorCancelled", { defaultMessage: "Esta cuenta de cobro fue anulada." }));
      } else if (code === "EXPIRED") {
        setError(t("errorExpired", { defaultMessage: "Esta cuenta de cobro venció. Contacta al equipo de ventas." }));
      } else {
        setError(e?.message || t("errorGeneric", { defaultMessage: "No pudimos aplicar el código. Intenta de nuevo." }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: spacing.md,
        padding: spacing.md,
        background: "var(--surface)",
        border: `1px solid ${colors.brand}`,
        borderRadius: radii.md,
      }}
    >
      <label
        style={{
          display: "block",
          color: "var(--text)",
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.sm,
          marginBottom: 8,
        }}
      >
        {t("inputLabel", { defaultMessage: "Código de cuenta de cobro" })}
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          placeholder="XXXX-XXXX"
          value={input}
          onChange={(e) => {
            setInput(formatDisplay(e.target.value));
            setError(null);
          }}
          style={{
            flex: "1 1 180px",
            minWidth: 0,
            padding: "12px",
            fontFamily: "monospace",
            fontSize: "1.1rem",
            letterSpacing: "0.1em",
            textAlign: "center",
            border: "1px solid var(--border)",
            borderRadius: radii.md,
            background: "var(--surface)",
            color: "var(--text)",
            minHeight: 48,
          }}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={busy || normaliseCode(input).length !== 8}
          style={{
            padding: "12px 20px",
            borderRadius: radii.md,
            border: "none",
            background: busy || normaliseCode(input).length !== 8 ? "#9ca3af" : colors.brandGradient,
            color: "white",
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.sm,
            cursor: busy || normaliseCode(input).length !== 8 ? "not-allowed" : "pointer",
            minHeight: 48,
            minWidth: 100,
          }}
        >
          {busy ? t("applying", { defaultMessage: "Aplicando…" }) : t("apply", { defaultMessage: "Aplicar" })}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: fontSize.xs, marginTop: 8, marginBottom: 0 }}>
        {t("findCodeHint", { defaultMessage: "El código de 8 dígitos aparece en la sección «Forma de pago» del PDF que recibiste." })}
      </p>
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--danger-bg)",
            color: "var(--danger-text)",
            border: "1px solid var(--danger-border)",
            borderRadius: radii.md,
            fontSize: fontSize.sm,
          }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setExpanded(false);
          setInput("");
          setError(null);
        }}
        style={{
          marginTop: 12,
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: fontSize.xs,
          cursor: "pointer",
          padding: 4,
        }}
      >
        {t("cancel", { defaultMessage: "Cancelar" })}
      </button>
    </div>
  );
}
