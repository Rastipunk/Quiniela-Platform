"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";

const WHATS_NEW_VERSION = "2026-02-22";
const STORAGE_KEY = "quiniela.whatsNewVersion";
const TOKEN_KEY = "quiniela.token";

export function WhatsNewModal() {
  const t = useTranslations("whatsNew");
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (token && seenVersion !== WHATS_NEW_VERSION) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 440,
          padding: isMobile ? 24 : 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>&#127881;</div>
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            {t("title")}
          </h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            {t("subtitle")}
          </p>
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
          {/* Item 1: Languages */}
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>&#127760;</div>
            <div>
              <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                {t("item1Title")}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                {t("item1Desc")}
              </div>
            </div>
          </div>

          {/* Item 2: Mobile */}
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>&#128241;</div>
            <div>
              <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                {t("item2Title")}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                {t("item2Desc")}
              </div>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            width: "100%",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
