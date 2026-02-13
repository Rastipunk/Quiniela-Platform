"use client";

import { useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { FeedbackModal } from "./FeedbackModal";

export function BetaFeedbackBar() {
  const isMobile = useIsMobile();
  const [modalType, setModalType] = useState<"BUG" | "SUGGESTION" | null>(null);

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
          color: "#1a1a1a",
          padding: isMobile ? "8px 12px" : "8px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: isMobile ? 8 : 16,
          flexWrap: "wrap",
          fontSize: isMobile ? "0.8rem" : "0.875rem",
          fontWeight: 600,
        }}
      >
        <span style={{ opacity: 0.9 }}>
          {isMobile ? "Beta - Tu feedback nos ayuda" : "Beta - Tu feedback nos ayuda a mejorar"}
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setModalType("BUG")}
            style={{
              background: "rgba(220, 38, 38, 0.9)",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: isMobile ? "4px 10px" : "5px 14px",
              fontSize: isMobile ? "0.75rem" : "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Reportar Bug
          </button>
          <button
            onClick={() => setModalType("SUGGESTION")}
            style={{
              background: "rgba(22, 163, 74, 0.9)",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: isMobile ? "4px 10px" : "5px 14px",
              fontSize: isMobile ? "0.75rem" : "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Enviar Sugerencia
          </button>
        </div>
      </div>

      {modalType && (
        <FeedbackModal
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </>
  );
}
