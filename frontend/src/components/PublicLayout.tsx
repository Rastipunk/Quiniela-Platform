import { PublicNavbar } from "./PublicNavbar";
import { Footer } from "./Footer";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicNavbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}
