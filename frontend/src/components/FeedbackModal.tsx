import { useState, useRef } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { submitFeedback } from "../lib/api";

interface FeedbackModalProps {
  type: "BUG" | "SUGGESTION";
  onClose: () => void;
}

export function FeedbackModal({ type, onClose }: FeedbackModalProps) {
  const isMobile = useIsMobile();
  const [message, setMessage] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [wantsContact, setWantsContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = type === "BUG" ? "Reportar Bug" : "Enviar Sugerencia";
  const placeholder =
    type === "BUG"
      ? "Describe el bug: qué esperabas que pasara y qué pasó en su lugar..."
      : "Describe tu sugerencia o idea para mejorar la plataforma...";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500_000) {
      setErrorMsg("La imagen no debe superar 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      // Strip the data:image/...;base64, prefix for storage
      setImageBase64(result.split(",")[1] || result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (message.trim().length < 10) {
      setErrorMsg("El mensaje debe tener al menos 10 caracteres.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      await submitFeedback(
        type,
        message.trim(),
        imageBase64 || undefined,
        wantsContact,
        wantsContact ? contactName.trim() || undefined : undefined,
        wantsContact ? phoneNumber.trim() || undefined : undefined
      );
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Error al enviar. Intenta de nuevo.");
    }
  };

  return (
    <div
      onClick={onClose}
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
          background: "var(--bg, #fff)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: isMobile ? 20 : 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "1px solid var(--border, #e5e7eb)",
        }}
      >
        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
              {type === "BUG" ? "\uD83D\uDC1B" : "\uD83D\uDCA1"}
            </div>
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--text, #111)",
                marginBottom: 8,
              }}
            >
              Enviado exitosamente
            </h3>
            <p style={{ color: "var(--muted, #6b7280)", marginBottom: 20 }}>
              Gracias por tu feedback. Nos ayuda mucho a mejorar la plataforma.
            </p>
            <button
              onClick={onClose}
              style={{
                background: "var(--text, #111)",
                color: "var(--bg, #fff)",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text, #111)",
              }}
            >
              {title}
            </h3>

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              rows={5}
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--border, #d1d5db)",
                padding: 12,
                fontSize: "0.9rem",
                resize: "vertical",
                fontFamily: "inherit",
                background: "var(--surface, #f9fafb)",
                color: "var(--text, #111)",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--muted, #9ca3af)",
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              {message.length}/2000 caracteres (min. 10)
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text, #111)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Captura de pantalla (opcional, max 500KB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "var(--surface, #f3f4f6)",
                  border: "1px dashed var(--border, #d1d5db)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "var(--muted, #6b7280)",
                  width: "100%",
                }}
              >
                {imagePreview ? "Cambiar imagen" : "Seleccionar imagen..."}
              </button>
              {imagePreview && (
                <div style={{ marginTop: 8, position: "relative" }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 150,
                      borderRadius: 8,
                      border: "1px solid var(--border, #e5e7eb)",
                    }}
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageBase64(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "rgba(0,0,0,0.6)",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    X
                  </button>
                </div>
              )}
            </div>

            {/* Contact checkbox */}
            <div style={{ marginBottom: wantsContact ? 8 : 16 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.85rem",
                  color: "var(--text, #111)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={wantsContact}
                  onChange={(e) => setWantsContact(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Me gustaría ser contactado para ampliar esta información
              </label>
            </div>

            {/* Contact fields (conditional) */}
            {wantsContact && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Tu nombre"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid var(--border, #d1d5db)",
                    padding: 10,
                    fontSize: "0.9rem",
                    background: "var(--surface, #f9fafb)",
                    color: "var(--text, #111)",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Número de celular (ej: +57 300 123 4567)"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid var(--border, #d1d5db)",
                    padding: 10,
                    fontSize: "0.9rem",
                    background: "var(--surface, #f9fafb)",
                    color: "var(--text, #111)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Error message */}
            {errorMsg && (
              <div
                style={{
                  background: "rgba(220, 38, 38, 0.1)",
                  color: "#dc2626",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  marginBottom: 16,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                disabled={status === "loading"}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border, #d1d5db)",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  color: "var(--text, #111)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={status === "loading" || message.trim().length < 10}
                style={{
                  background:
                    type === "BUG"
                      ? "rgba(220, 38, 38, 0.9)"
                      : "rgba(22, 163, 74, 0.9)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: status === "loading" ? "wait" : "pointer",
                  opacity: status === "loading" || message.trim().length < 10 ? 0.6 : 1,
                }}
              >
                {status === "loading" ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
