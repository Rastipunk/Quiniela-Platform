import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        padding: "24px 32px",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 40,
        }}
      >
        {/* Brand & Disclaimer */}
        <div style={{ maxWidth: 420 }}>
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
            Plataforma gratuita de predicciones deportivas entre amigos.
            Quinielas, pollas, prodes y pencas — 100% gratis, sin dinero real ni apuestas.
          </p>
        </div>

        {/* Legal Links */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Legal
          </div>
          <Link
            href="/terminos"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Terminos de Servicio
          </Link>
          <Link
            href="/privacidad"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Politica de Privacidad
          </Link>
        </div>

        {/* Resources */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Recursos
          </div>
          <Link
            href="/como-funciona"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Como Funciona
          </Link>
          <Link
            href="/faq"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Preguntas Frecuentes
          </Link>
          <Link
            href="/que-es-una-quiniela"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Que es una Quiniela?
          </Link>
        </div>

        {/* Contact */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 4,
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
        &copy; {currentYear} Picks4All. Todos los derechos reservados.
      </div>
    </footer>
  );
}
