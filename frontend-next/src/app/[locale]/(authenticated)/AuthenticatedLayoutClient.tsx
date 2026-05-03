"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { PoolNavRootProvider } from "@/components/pool/PoolNav";

export function AuthenticatedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {/* PoolNavRootProvider wraps both navbar and children so the
          pool detail page can publish its section state up to the
          navbar drawer on mobile. */}
      <PoolNavRootProvider>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <NavBar />
          <WhatsNewModal />
          <main id="main-content" style={{ flex: 1 }}>{children}</main>
          <Footer />
        </div>
      </PoolNavRootProvider>
    </AuthGuard>
  );
}
