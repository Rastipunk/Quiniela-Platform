"use client";

import { useTranslations } from "next-intl";

type Props = {
  password: string;
};

export default function PasswordStrengthIndicator({ password }: Props) {
  const t = useTranslations("auth");

  const rules = [
    { key: "minLength", pass: password.length >= 8, label: t("passwordRules.minLength") },
    { key: "uppercase", pass: /[A-Z]/.test(password), label: t("passwordRules.uppercase") },
    { key: "number", pass: /[0-9]/.test(password), label: t("passwordRules.number") },
  ];

  if (!password) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
      {rules.map((r) => (
        <span
          key={r.key}
          style={{
            fontSize: 11,
            color: r.pass ? "var(--success, #16a34a)" : "var(--muted, #6b7280)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 13 }}>{r.pass ? "\u2713" : "\u2717"}</span>
          {r.label}
        </span>
      ))}
    </div>
  );
}
