"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { colors, radii, fontWeight } from "@/lib/theme";
import { BRAND } from "@/lib/brand";
import { processMpPayment } from "@/lib/api/payments";
import { formatCOP } from "@/lib/pricing";

/**
 * Mercado Pago Payment Brick page.
 *
 * Renders the Payment Brick embedded in the page. The user never leaves.
 * Query params: publicKey, amount, paymentId, reference, preferenceId, poolId
 *
 * Integration follows the official MP pattern:
 * - preferenceId is required for Brick initialization
 * - onSubmit receives { selectedPaymentMethod, formData }
 * - formData is passed directly to the backend (MP native format)
 */
export default function MpCheckoutPage() {
  const t = useTranslations("payment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brickControllerRef = useRef<any>(null);
  const brickInitialized = useRef(false);

  const publicKey = searchParams.get("publicKey") || "";
  const amount = Number(searchParams.get("amount") || "0");
  const paymentId = searchParams.get("paymentId") || "";
  const preferenceId = searchParams.get("preferenceId") || "";
  const poolId = searchParams.get("poolId") || "";

  useEffect(() => {
    if (brickInitialized.current) return;

    // Validate required params
    if (!publicKey) {
      setStatus("error");
      setErrorMsg("Configuración de pagos incompleta (falta publicKey). Contacta al administrador.");
      console.error("[PaymentBrick] Missing publicKey param");
      return;
    }
    if (!amount) {
      setStatus("error");
      setErrorMsg("Monto inválido.");
      return;
    }
    if (!preferenceId) {
      setStatus("error");
      setErrorMsg("Configuración de pagos incompleta (falta preferenceId). Contacta al administrador.");
      console.error("[PaymentBrick] Missing preferenceId param");
      return;
    }

    brickInitialized.current = true;

    const loadMpSdk = async () => {
      try {
        console.log("[PaymentBrick] Init params:", { publicKey: publicKey ? `${publicKey.slice(0, 12)}...` : "MISSING", amount, preferenceId: preferenceId || "MISSING", paymentId: paymentId || "MISSING" });
        const { loadMercadoPago } = await import("@mercadopago/sdk-js");
        await loadMercadoPago();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp = new (window as any).MercadoPago(publicKey, { locale: "es-CO" });
        const bricksBuilder = mp.bricks();

        brickControllerRef.current = await bricksBuilder.create("payment", "mp-brick-container", {
          initialization: {
            amount,
            preferenceId,
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              bankTransfer: "all",
              ticket: "all",
              mercadoPago: "all",
            },
          },
          callbacks: {
            onReady: () => {
              setStatus("ready");
            },
            onSubmit: ({ selectedPaymentMethod, formData }: {
              selectedPaymentMethod: string;
              formData: Record<string, unknown>;
            }) => {
              // Wallet/credits payments are handled by MP redirect — just resolve
              if (selectedPaymentMethod === "wallet_purchase" || selectedPaymentMethod === "onboarding_credits") {
                return Promise.resolve();
              }

              setStatus("processing");

              return processMpPayment(paymentId, formData)
                .then((result) => {
                  if (result.status === "approved") {
                    setStatus("success");
                    setTimeout(() => router.push(`/pools/${poolId}`), 2000);
                  } else if (result.status === "rejected") {
                    setStatus("error");
                    setErrorMsg("El pago fue rechazado. Intenta con otro medio de pago.");
                  } else {
                    // pending / in_process — async payment (PSE, Nequi)
                    setStatus("success");
                    setTimeout(() => router.push(`/pago/exitoso?poolId=${poolId}`), 2000);
                  }
                })
                .catch((err) => {
                  setStatus("error");
                  setErrorMsg(err instanceof Error ? err.message : "Error procesando el pago");
                  throw err; // reject the promise so the Brick shows error state
                });
            },
            onError: (error: unknown) => {
              console.error("[PaymentBrick] Error:", error);
              setStatus("error");
              // Show the actual Brick error for diagnosis
              const detail = error instanceof Error
                ? error.message
                : typeof error === "object" && error !== null
                  ? JSON.stringify(error)
                  : String(error);
              setErrorMsg(`Error al cargar el formulario de pago: ${detail}`);
            },
          },
        });
      } catch (err) {
        console.error("[PaymentBrick] Failed to load:", err);
        setStatus("error");
        setErrorMsg("No se pudo cargar el formulario de pago. Verifica tu conexión e intenta de nuevo.");
      }
    };

    loadMpSdk();

    // Cleanup on unmount
    return () => {
      if (brickControllerRef.current?.unmount) {
        brickControllerRef.current.unmount();
      }
    };
  }, [publicKey, amount, preferenceId, paymentId, poolId, router]);

  const handleRetry = () => {
    // Unmount existing Brick before re-creating
    if (brickControllerRef.current?.unmount) {
      brickControllerRef.current.unmount();
      brickControllerRef.current = null;
    }
    brickInitialized.current = false;
    setErrorMsg("");
    setStatus("loading");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.bgLighter,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 600,
        width: "100%",
        marginBottom: 20,
        textAlign: "center",
      }}>
        <h1 style={{ fontSize: 24, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 8 }}>
          {t("checkout.upgradeTitle")}
        </h1>
        <p style={{ fontSize: 16, color: colors.textMuted }}>
          {t("checkout.price", { price: formatCOP(amount) })}
        </p>
      </div>

      {/* Brick container */}
      <div style={{
        maxWidth: 600,
        width: "100%",
        background: colors.white,
        borderRadius: radii["2xl"],
        padding: 24,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{
              width: 40, height: 40, margin: "0 auto 16px",
              border: `4px solid ${colors.borderLight}`,
              borderTopColor: BRAND.primary,
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <p style={{ color: colors.textMuted }}>Cargando formulario de pago...</p>
          </div>
        )}

        <div id="mp-brick-container" />

        {status === "processing" && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{
              width: 40, height: 40, margin: "0 auto 16px",
              border: `4px solid ${colors.borderLight}`,
              borderTopColor: BRAND.primary,
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <p style={{ color: colors.textMuted, fontWeight: fontWeight.semibold }}>
              {t("checkout.processing")}
            </p>
          </div>
        )}

        {status === "success" && (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: fontWeight.bold, color: colors.text }}>
              {t("success.title")}
            </h2>
            <p style={{ color: colors.textMuted, marginTop: 8 }}>
              {t("success.subtitle")}
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ color: colors.error, fontWeight: fontWeight.semibold, marginBottom: 16 }}>{errorMsg}</p>
            <button
              onClick={handleRetry}
              style={{
                padding: "12px 24px", borderRadius: radii.lg,
                border: `1px solid ${colors.brand}`, background: colors.white,
                color: colors.brand, fontWeight: fontWeight.semibold, cursor: "pointer",
              }}
            >
              {t("cancel.tryAgain")}
            </button>
          </div>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => router.back()}
        style={{
          marginTop: 20, background: "none", border: "none",
          color: colors.textMuted, cursor: "pointer", fontSize: 14,
        }}
      >
        &#8592; Volver
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
