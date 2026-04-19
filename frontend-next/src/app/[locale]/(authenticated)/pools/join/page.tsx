"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getToken } from "@/lib/auth";
import { joinPool } from "@/lib/api/pools";
import { ApiError } from "@/lib/apiError";
import { colors } from "@/lib/theme";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

function JoinPoolInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("pool");
  const code = searchParams.get("code");

  const [status, setStatus] = useState<"joining" | "success" | "error">("joining");
  const [error, setError] = useState("");
  const [poolId, setPoolId] = useState("");

  useEffect(() => {
    if (!code) {
      router.replace("/dashboard");
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=/pools/join?code=${code}`);
      return;
    }

    let cancelled = false;

    joinPool(token, code)
      .then((res) => {
        if (cancelled) return;
        setPoolId(res.poolId);
        setStatus("success");
        trackEvent("pool_joined", { method: "invite_code" });
        trackMetaCustomEvent("PoolJoined", { content_name: "invite_code" });
        setTimeout(() => {
          router.replace(`/pools/${res.poolId}`);
        }, 1500);
      })
      .catch((err) => {
        if (cancelled) return;
        let msg: string;
        if (err instanceof ApiError && err.code === "POOL_FULL") {
          msg = t("join.poolFull", {
            defaultMessage: "Esta pool está llena. Comunícate con el administrador para que amplíe la capacidad.",
          });
        } else {
          msg = err instanceof ApiError
            ? err.message || t("join.errorDesc")
            : t("join.errorDesc");
        }
        setError(msg);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [code, router, t]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "joining" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>&#9203;</div>
            <h1
              style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}
            >
              {t("join.joining")}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {t("join.joiningDesc")}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>&#9989;</div>
            <h1
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: 8,
                color: colors.successAlt,
              }}
            >
              {t("join.success")}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {t("join.successDesc")}
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>&#10060;</div>
            <h1
              style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}
            >
              {t("join.error")}
            </h1>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                marginBottom: 16,
              }}
            >
              {error || t("join.errorDesc")}
            </p>
            <a
              href="/dashboard"
              style={{
                display: "inline-block",
                background: colors.brandGradient,
                color: "white",
                padding: "12px 24px",
                borderRadius: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("join.backToDashboard")}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPoolPage() {
  return (
    <Suspense>
      <JoinPoolInner />
    </Suspense>
  );
}
