"use client";

import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/BrandLogo";

export default function AuthenticatedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <BrandLogo size={40} />

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "var(--text)",
          margin: "24px 0 8px",
        }}
      >
        {t("title")}
      </h1>

      <p
        style={{
          fontSize: "1rem",
          color: "var(--muted)",
          marginBottom: 32,
          maxWidth: 450,
        }}
      >
        {t("message")}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          {t("retry")}
        </button>
        <a
          href="/"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("goHome")}
        </a>
      </div>
    </div>
  );
}
