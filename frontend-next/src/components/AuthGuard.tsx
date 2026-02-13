"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

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
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
