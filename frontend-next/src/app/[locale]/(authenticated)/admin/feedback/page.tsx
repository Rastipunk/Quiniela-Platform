"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getAdminFeedback, type BetaFeedbackItem, type AdminFeedbackResponse } from "@/lib/api";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function AdminFeedbackPage() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<AdminFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterContact, setFilterContact] = useState<string>("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);

  const fetchData = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminFeedback(token, {
        type: filterType || undefined,
        wantsContact: filterContact || undefined,
        page,
        limit: 25,
      });
      setData(result);
    } catch (err: any) {
      if (err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err.message || "Error al cargar feedback");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, filterContact, page]);

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.feedbacks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "0 16px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: "var(--text)", marginBottom: 8 }}>Acceso Restringido</h2>
        <p style={{ color: "var(--muted)" }}>Solo administradores pueden ver el feedback.</p>
        <Link href="/" style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>
          ← Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/settings/email"
          style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.9rem" }}
        >
          ← Panel Admin
        </Link>
        <h1 style={{ fontSize: isMobile ? "1.5rem" : "1.75rem", fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>
          Feedback de Beta
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
          {data ? `${data.pagination.total} envíos en total` : "Cargando..."}
        </p>
      </div>

      {/* Filters + Download */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: "0.85rem",
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="BUG">Bugs</option>
          <option value="SUGGESTION">Sugerencias</option>
        </select>

        <select
          value={filterContact}
          onChange={(e) => { setFilterContact(e.target.value); setPage(1); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: "0.85rem",
          }}
        >
          <option value="">Contacto: todos</option>
          <option value="true">Quiere ser contactado</option>
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleDownload}
          disabled={!data || data.feedbacks.length === 0}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            opacity: !data || data.feedbacks.length === 0 ? 0.5 : 1,
          }}
        >
          Descargar JSON
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          Cargando feedback...
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.feedbacks.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
          <p>No hay feedback todavía{filterType || filterContact ? " con estos filtros" : ""}.</p>
        </div>
      )}

      {/* Feedback cards */}
      {!loading && data && data.feedbacks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.feedbacks.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onImageClick={(img) => setImageModal(img)}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{ ...paginationBtn, opacity: page === 1 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ padding: "8px 16px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Página {page} de {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
            disabled={page === data.pagination.totalPages}
            style={{ ...paginationBtn, opacity: page === data.pagination.totalPages ? 0.4 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Image modal */}
      {imageModal && (
        <div
          onClick={() => setImageModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            cursor: "pointer",
          }}
        >
          <img
            src={`data:image/png;base64,${imageModal}`}
            alt="Screenshot"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}

const paginationBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.85rem",
  cursor: "pointer",
};

function FeedbackCard({
  item,
  expanded,
  onToggle,
  onImageClick,
  isMobile,
}: {
  item: BetaFeedbackItem;
  expanded: boolean;
  onToggle: () => void;
  onImageClick: (base64: string) => void;
  isMobile: boolean;
}) {
  const date = new Date(item.createdAtUtc);
  const dateStr = date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isBug = item.type === "BUG";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        borderLeft: `4px solid ${isBug ? "#dc2626" : "#16a34a"}`,
        overflow: "hidden",
      }}
    >
      {/* Header row - always visible */}
      <div
        onClick={onToggle}
        style={{
          padding: isMobile ? "12px 14px" : "14px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Type badge */}
        <span
          style={{
            background: isBug ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)",
            color: isBug ? "#dc2626" : "#16a34a",
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {isBug ? "Bug" : "Sugerencia"}
        </span>

        {/* Message preview */}
        <span
          style={{
            flex: 1,
            color: "var(--text)",
            fontSize: "0.9rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: expanded ? "normal" : "nowrap",
            minWidth: 0,
          }}
        >
          {item.message}
        </span>

        {/* Indicators */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {item.imageBase64 && (
            <span title="Tiene imagen" style={{ fontSize: "0.85rem" }}>📷</span>
          )}
          {item.wantsContact && (
            <span title="Quiere contacto" style={{ fontSize: "0.85rem" }}>📞</span>
          )}
        </div>

        {/* Date */}
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", whiteSpace: "nowrap", flexShrink: 0 }}>
          {dateStr}
        </span>

        {/* Expand arrow */}
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: isMobile ? "0 14px 14px" : "0 20px 20px",
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          {/* Full message */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>
              Mensaje
            </div>
            <p style={{ color: "var(--text)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              {item.message}
            </p>
          </div>

          {/* Image */}
          {item.imageBase64 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>
                Captura
              </div>
              <img
                src={`data:image/png;base64,${item.imageBase64}`}
                alt="Screenshot"
                onClick={() => onImageClick(item.imageBase64!)}
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
            </div>
          )}

          {/* Metadata grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
              fontSize: "0.85rem",
            }}
          >
            <MetaField label="Usuario" value={item.userEmail || (item.userId ? `ID: ${item.userId}` : "Anónimo")} />
            <MetaField label="URL" value={item.currentUrl || "—"} />
            {item.wantsContact && (
              <MetaField
                label="Contacto"
                value={[item.contactName, item.phoneNumber].filter(Boolean).join(" — ") || "Sí (sin datos)"}
                highlight
              />
            )}
            <MetaField
              label="User Agent"
              value={item.userAgent ? (item.userAgent.length > 80 ? item.userAgent.slice(0, 80) + "..." : item.userAgent) : "—"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          color: highlight ? "#4f46e5" : "var(--text)",
          fontWeight: highlight ? 600 : 400,
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
