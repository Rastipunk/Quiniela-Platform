"use client";

import { AuthGuard } from "../../components/AuthGuard";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavBar />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
