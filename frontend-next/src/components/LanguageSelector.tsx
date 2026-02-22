"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import type { Locale } from "@/i18n/routing";

const locales: Locale[] = ["es", "en", "pt"];

export function LanguageSelector({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const t = useTranslations("language");
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    if (next === currentLocale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- runtime pathname is always valid
        pathname,
        { locale: next }
      );
    });
  }

  const isDark = variant === "dark";

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderRadius: 6,
        overflow: "hidden",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.2s ease",
      }}
      role="group"
      aria-label={t("label")}
    >
      {locales.map((loc) => {
        const isActive = loc === currentLocale;
        return (
          <button
            key={loc}
            onClick={() => switchLocale(loc)}
            aria-current={isActive ? "true" : undefined}
            style={{
              background: isActive
                ? isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"
                : "transparent",
              border: "none",
              color: isActive
                ? isDark ? "white" : "var(--text)"
                : isDark ? "rgba(255,255,255,0.5)" : "var(--muted)",
              padding: "4px 8px",
              fontSize: "0.8rem",
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}
