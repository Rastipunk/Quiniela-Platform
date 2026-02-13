"use client";

import { useAuthPanel } from "../contexts/AuthPanelContext";

interface RegisterButtonProps {
  label?: string;
  style?: React.CSSProperties;
}

export function RegisterButton({
  label = "Comenzar ahora — Es gratis",
  style,
}: RegisterButtonProps) {
  const { openAuthPanel } = useAuthPanel();

  return (
    <button
      onClick={() => openAuthPanel("register")}
      style={{
        background: "white",
        color: "#764ba2",
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
      {label}
    </button>
  );
}
