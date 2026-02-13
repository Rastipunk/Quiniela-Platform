"use client";

import { AuthGuard } from "../../components/AuthGuard";
import { BetaFeedbackBar } from "../../components/BetaFeedbackBar";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <BetaFeedbackBar />
      <NavBar />
      <main style={{ minHeight: "calc(100vh - 200px)" }}>{children}</main>
      <Footer />
    </AuthGuard>
  );
}
