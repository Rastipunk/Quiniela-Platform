"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Preserve the current URL so login can redirect back
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(currentUrl)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname, searchParams]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--muted, #6b7280)",
          fontSize: "1rem",
        }}
      >
        {t("loading")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
