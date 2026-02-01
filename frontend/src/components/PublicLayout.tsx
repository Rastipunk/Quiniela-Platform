import { useState } from "react";
import { PublicNavbar } from "./PublicNavbar";
import { Footer } from "./Footer";
import { AuthSlidePanel } from "./AuthSlidePanel";

interface PublicLayoutProps {
  children: React.ReactNode;
  onLoggedIn?: () => void;
}

export function PublicLayout({ children, onLoggedIn }: PublicLayoutProps) {
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const handleLoggedIn = () => {
    setShowAuthPanel(false);
    onLoggedIn?.();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicNavbar onOpenAuth={() => setShowAuthPanel(true)} />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />

      <AuthSlidePanel
        isOpen={showAuthPanel}
        onClose={() => setShowAuthPanel(false)}
        onLoggedIn={handleLoggedIn}
      />
    </div>
  );
}
