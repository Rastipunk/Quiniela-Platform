"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { getPaymentStatus } from "@/lib/api/payments";
import { colors, radii, fontWeight } from "@/lib/theme";
import { BRAND } from "@/lib/brand";

/** Maximum polling attempts (2s interval × 15 = 30s) */
const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;

export default function PaymentSuccessPage() {
  const t = useTranslations("payment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("poolId");

  const [status, setStatus] = useState<"polling" | "confirmed" | "timeout">("polling");
  const [capacity, setCapacity] = useState<number | null>(null);

  useEffect(() => {
    if (!poolId) return;

    let polls = 0;
    const interval = setInterval(async () => {
      try {
        const result = await getPaymentStatus(poolId);
        if (result.status === "COMPLETED") {
          setStatus("confirmed");
          setCapacity(result.toCapacity ?? null);
          clearInterval(interval);
        }
      } catch { /* ignore polling errors */ }

      polls++;
      if (polls >= MAX_POLLS) {
        setStatus("timeout");
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [poolId]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: colors.bgLighter,
      padding: 20,
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: colors.white,
        borderRadius: radii["2xl"],
        padding: 40,
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        {status === "polling" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, margin: "0 auto",
                border: `4px solid ${colors.borderLight}`,
                borderTopColor: BRAND.primary,
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 8 }}>
              {t("success.processing")}
            </h1>
          </>
        )}

        {status === "confirmed" && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 8 }}>
              {t("success.title")}
            </h1>
            <p style={{ fontSize: 16, color: colors.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
              {t("success.confirmed", { capacity: capacity ?? "?" })}
            </p>
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              style={{
                padding: "14px 32px",
                borderRadius: radii.lg,
                border: "none",
                background: BRAND.gradient,
                color: colors.white,
                fontSize: 16,
                fontWeight: fontWeight.bold,
                cursor: "pointer",
              }}
            >
              {t("success.goToPool")}
            </button>
          </>
        )}

        {status === "timeout" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9203;</div>
            <h1 style={{ fontSize: 24, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 8 }}>
              {t("success.title")}
            </h1>
            <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
              {t("success.timeout")}
            </p>
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              style={{
                padding: "14px 32px",
                borderRadius: radii.lg,
                border: "none",
                background: BRAND.gradient,
                color: colors.white,
                fontSize: 16,
                fontWeight: fontWeight.bold,
                cursor: "pointer",
              }}
            >
              {t("success.goToPool")}
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
