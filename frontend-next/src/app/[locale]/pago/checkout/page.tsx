"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
 * Query params: publicKey, amount, paymentId, reference, poolId
 */
export default function MpCheckoutPage() {
  const t = useTranslations("payment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const brickContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const brickInitialized = useRef(false);

  const publicKey = searchParams.get("publicKey") || "";
  const amount = Number(searchParams.get("amount") || "0");
  const paymentId = searchParams.get("paymentId") || "";
  const reference = searchParams.get("reference") || "";
  const poolId = searchParams.get("poolId") || "";

  const handleSubmit = useCallback(async (formData: Record<string, unknown>) => {
    setStatus("processing");
    try {
      const result = await processMpPayment(paymentId, {
        ...formData,
        transactionAmount: amount,
        externalReference: reference,
        description: `Picks4All — Pool capacity upgrade`,
      });

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
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Error procesando el pago");
    }
  }, [paymentId, amount, reference, poolId, router]);

  useEffect(() => {
    if (brickInitialized.current) return;

    // Validate required params before attempting to load
    if (!publicKey) {
      setStatus("error");
      setErrorMsg("Configuración de pagos incompleta. Contacta al administrador.");
      console.error("[PaymentBrick] Missing publicKey param");
      return;
    }
    if (!amount) {
      setStatus("error");
      setErrorMsg("Monto inválido.");
      return;
    }

    brickInitialized.current = true;

    // Load MP SDK dynamically
    const loadMpSdk = async () => {
      try {
        const { loadMercadoPago } = await import("@mercadopago/sdk-js");
        await loadMercadoPago();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mp = new (window as any).MercadoPago(publicKey, { locale: "es-CO" });
        const bricksBuilder = (mp as any).bricks();

        await bricksBuilder.create("payment", "mp-brick-container", {
          initialization: {
            amount,
          },
          customization: {
            paymentMethods: {
              maxInstallments: 1,
              minInstallments: 1,
            },
            visual: {
              style: {
                theme: "default",
              },
            },
          },
          callbacks: {
            onReady: () => {
              setStatus("ready");
            },
            onSubmit: async (cardFormData: Record<string, unknown>) => {
              await handleSubmit(cardFormData);
            },
            onError: (error: Error) => {
              console.error("[PaymentBrick] Error:", error);
              setStatus("error");
              setErrorMsg("Error al cargar el formulario de pago");
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
  }, [publicKey, amount, handleSubmit]);

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

        <div id="mp-brick-container" ref={brickContainerRef} />

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
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <p style={{ color: colors.error, fontWeight: fontWeight.semibold }}>{errorMsg}</p>
            <button
              onClick={() => { setStatus("loading"); brickInitialized.current = false; }}
              style={{
                marginTop: 16, padding: "12px 24px", borderRadius: radii.lg,
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
        ← Volver
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
