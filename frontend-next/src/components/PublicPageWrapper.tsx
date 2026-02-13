"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { PublicNavbar } from "./PublicNavbar";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";
import { AuthSlidePanel } from "./AuthSlidePanel";
import { AuthPanelContext } from "../contexts/AuthPanelContext";

interface PublicPageWrapperProps {
  children: React.ReactNode;
}

export function PublicPageWrapper({ children }: PublicPageWrapperProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authPanelMode, setAuthPanelMode] = useState<"login" | "register">("login");

  const openAuthPanel = (mode: "login" | "register" = "login") => {
    setAuthPanelMode(mode);
    setShowAuthPanel(true);
  };

  const handleLoggedIn = () => {
    setShowAuthPanel(false);
    router.push("/dashboard");
  };

  return (
    <AuthPanelContext.Provider value={{ openAuthPanel }}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {isLoading ? (
          // Brief placeholder while checking auth to avoid flash
          <div style={{ height: 56, background: "#1a1a1a" }} />
        ) : isAuthenticated ? (
          <NavBar />
        ) : (
          <PublicNavbar onOpenAuth={() => openAuthPanel("login")} />
        )}
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />

        {!isAuthenticated && (
          <AuthSlidePanel
            isOpen={showAuthPanel}
            onClose={() => setShowAuthPanel(false)}
            onLoggedIn={handleLoggedIn}
            initialMode={authPanelMode}
          />
        )}
      </div>
    </AuthPanelContext.Provider>
  );
}
