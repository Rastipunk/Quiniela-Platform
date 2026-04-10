"use client";

import { useTranslations } from "next-intl";
import { useAuthPanel } from "../contexts/AuthPanelContext";
import { colors } from "@/lib/theme";
import { trackEvent } from "@/lib/analytics";

interface RegisterButtonProps {
  label?: string;
  style?: React.CSSProperties;
}

export function RegisterButton({ label, style }: RegisterButtonProps) {
  const t = useTranslations("common");
  const { openAuthPanel } = useAuthPanel();

  return (
    <button
      onClick={() => {
        trackEvent("cta_clicked", { cta_text: "register", page: "content" });
        openAuthPanel("register");
      }}
      aria-label={t("nav.registerAriaLabel", { defaultMessage: "Create free account on Picks4All" })}
      style={{
        background: colors.white,
        color: colors.purple,
        padding: "16px 32px",
        borderRadius: 8,
        fontSize: "1.1rem",
        fontWeight: 700,
        textDecoration: "none",
        display: "inline-block",
        border: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {label || t("nav.registerCta", { defaultMessage: "Start now — It's free" })}
    </button>
  );
}
