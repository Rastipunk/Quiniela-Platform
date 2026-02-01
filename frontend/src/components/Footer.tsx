import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";

export function Footer() {
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        padding: isMobile ? "20px 16px" : "24px 32px",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "center" : "flex-start",
          gap: isMobile ? 20 : 40,
        }}
      >
        {/* Brand & Disclaimer */}
        <div
          style={{
            textAlign: isMobile ? "center" : "left",
            maxWidth: isMobile ? "100%" : 400,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 8,
              color: "var(--text)",
            }}
          >
            Picks4All
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Plataforma de entretenimiento para predicciones deportivas.
            No involucra dinero real ni apuestas.
          </p>
        </div>

        {/* Legal Links */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            gap: isMobile ? 24 : 10,
            textAlign: isMobile ? "center" : "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: isMobile ? 0 : 4,
              display: isMobile ? "none" : "block",
            }}
          >
            Legal
          </div>
          <Link
            to="/terms"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Términos de Servicio
          </Link>
          <Link
            to="/privacy"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Política de Privacidad
          </Link>
        </div>

        {/* Contact */}
        <div
          style={{
            textAlign: isMobile ? "center" : "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
              display: isMobile ? "none" : "block",
            }}
          >
            Contacto
          </div>
          <a
            href="mailto:soporte@picks4all.com"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            soporte@picks4all.com
          </a>
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          maxWidth: 1200,
          margin: "16px auto 0",
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        © {currentYear} Picks4All. Todos los derechos reservados.
      </div>
    </footer>
  );
}
