"use client";

// Blocking host banner (knockout extra-time config v2). Shown once per
// (host, pool) while the edit window is open and not yet acknowledged. No
// dismiss-by-outside / Escape — the host must press a button (both ack in DB
// via POST /pools/:id/extra-time-banner/ack). Mirrors LocalePreferenceModal's
// blocking pattern.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ackExtraTimeBanner } from "@/lib/api";
import { colors, radii, zIndex } from "@/lib/theme";

export function ExtraTimeHostBanner({
  poolId,
  token,
  isMobile,
  onAck,
  onGoToConfig,
}: {
  poolId: string;
  token: string;
  isMobile: boolean;
  onAck: () => void;
  onGoToConfig: () => void;
}) {
  const t = useTranslations("pool");
  const [busy, setBusy] = useState(false);

  // Block Escape (capture phase) so the banner is truly modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const ack = async (goConfig: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (token) await ackExtraTimeBanner(token, poolId);
    } catch {
      // best-effort; close anyway so the host isn't trapped on a transient error
    } finally {
      onAck();
      if (goConfig) onGoToConfig();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)",
        zIndex: zIndex.expulsion, display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? 14 : 24,
      }}
    >
      <div style={{
        background: colors.white, borderRadius: 18, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 70px rgba(0,0,0,0.45)", overflow: "hidden",
      }}>
        <div style={{ background: colors.brandGradient, color: colors.white, padding: isMobile ? "18px 18px" : "22px 24px" }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>⚠️</div>
          <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 800, lineHeight: 1.3 }}>
            {t("extraTimeBanner.title")}
          </div>
        </div>
        <div style={{ padding: isMobile ? "18px" : "22px 24px" }}>
          <p style={{ margin: 0, fontSize: isMobile ? 14 : 15, lineHeight: 1.6, color: colors.textDark }}>
            {t("extraTimeBanner.body")}
          </p>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => ack(true)}
              disabled={busy}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: radii.lg, border: "none",
                background: colors.brand, color: colors.white, fontSize: 15, fontWeight: 800,
                cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
              }}
            >
              {t("extraTimeBanner.cta")}
            </button>
            <button
              type="button"
              onClick={() => ack(false)}
              disabled={busy}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: radii.lg, border: `1px solid ${colors.borderMedium}`,
                background: colors.white, color: colors.textDark, fontSize: 15, fontWeight: 700,
                cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
              }}
            >
              {t("extraTimeBanner.ack")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
