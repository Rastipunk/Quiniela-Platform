import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
        background: "var(--bg)",
      }}
    >
      <BrandLogo size={48} />

      <h1
        style={{
          fontSize: "6rem",
          fontWeight: 800,
          color: "var(--text)",
          margin: "24px 0 0",
          lineHeight: 1,
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: "1.25rem",
          color: "var(--muted)",
          marginBottom: 8,
          maxWidth: 450,
        }}
      >
        La pagina que buscas no existe o fue movida.
      </p>

      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--muted)",
          marginBottom: 32,
        }}
      >
        Pero tu quiniela te esta esperando.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Ir al inicio
        </Link>
        <Link
          href="/faq"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Preguntas frecuentes
        </Link>
      </div>
    </div>
  );
}
