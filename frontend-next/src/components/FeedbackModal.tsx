"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { submitFeedback } from "@/lib/api";

interface FeedbackModalProps {
  type: "BUG" | "SUGGESTION";
  onClose: () => void;
}

export function FeedbackModal({ type, onClose }: FeedbackModalProps) {
  const t = useTranslations("feedback");
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

  const title = type === "BUG" ? t("bugTitle") : t("suggestionTitle");
  const placeholder = type === "BUG" ? t("bugPlaceholder") : t("suggestionPlaceholder");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500_000) {
      setErrorMsg(t("imageSize"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1] || result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (message.trim().length < 10) {
      setErrorMsg(t("minChars"));
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
      setErrorMsg(err.message || t("submitError"));
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
              {t("success")}
            </h3>
            <p style={{ color: "var(--muted, #6b7280)", marginBottom: 20 }}>
              {t("successMessage")}
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
              {t("close")}
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
              {message.length}/2000 {t("charCounter")}
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
                {t("screenshotLabel")}
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
                {imagePreview ? t("changeImage") : t("selectImage")}
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
                {t("contactCheckbox")}
              </label>
            </div>

            {/* Contact fields (conditional) */}
            {wantsContact && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={t("nameField")}
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
                  placeholder={t("phoneField")}
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
                {t("cancel")}
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
                {status === "loading" ? t("sending") : t("send")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
