import { useState } from "react";
import { PublicNavbar } from "./PublicNavbar";
import { Footer } from "./Footer";
import { AuthSlidePanel } from "./AuthSlidePanel";
import { AuthPanelContext } from "../contexts/AuthPanelContext";

interface PublicLayoutProps {
  children: React.ReactNode;
  onLoggedIn?: () => void;
}

export function PublicLayout({ children, onLoggedIn }: PublicLayoutProps) {
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authPanelMode, setAuthPanelMode] = useState<"login" | "register">("login");

  const openAuthPanel = (mode: "login" | "register" = "login") => {
    setAuthPanelMode(mode);
    setShowAuthPanel(true);
  };

  const handleLoggedIn = () => {
    setShowAuthPanel(false);
    onLoggedIn?.();
  };

  return (
    <AuthPanelContext.Provider value={{ openAuthPanel }}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <PublicNavbar onOpenAuth={() => openAuthPanel("login")} />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />

        <AuthSlidePanel
          isOpen={showAuthPanel}
          onClose={() => setShowAuthPanel(false)}
          onLoggedIn={handleLoggedIn}
          initialMode={authPanelMode}
        />
      </div>
    </AuthPanelContext.Provider>
  );
}
