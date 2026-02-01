import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { API_BASE } from "../lib/api";

export function PrivacyPage() {
  const isMobile = useIsMobile();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrivacy() {
      try {
        const res = await fetch(`${API_BASE}/legal/documents/PRIVACY_POLICY`);
        if (!res.ok) {
          throw new Error("No se pudo cargar el documento");
        }
        const data = await res.json();
        setContent(data.document.content);
        setVersion(data.document.version);
      } catch (err) {
        setError("Error al cargar la Política de Privacidad");
        // Fallback content if API fails
        setContent(FALLBACK_PRIVACY);
      } finally {
        setLoading(false);
      }
    }

    loadPrivacy();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: isMobile ? "20px 16px" : "40px 24px",
      }}
    >
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 24,
          color: "var(--muted)",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        ← Volver al inicio
      </Link>

      {error && (
        <div
          className="alert-error"
          style={{ marginBottom: 20 }}
        >
          {error}
        </div>
      )}

      <article
        className="legal-content"
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: isMobile ? 20 : 32,
          border: "1px solid var(--border)",
          lineHeight: 1.7,
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: parseMarkdown(content || "") }}
          style={{ color: "var(--text)" }}
        />
      </article>

      {version && (
        <p
          style={{
            marginTop: 20,
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          Versión del documento: {version}
        </p>
      )}

      <style>{`
        .legal-content h1 {
          font-size: 1.75rem;
          margin: 0 0 8px 0;
          color: var(--text);
        }
        .legal-content h2 {
          font-size: 1.25rem;
          margin: 32px 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }
        .legal-content h3 {
          font-size: 1.1rem;
          margin: 24px 0 8px 0;
          color: var(--text);
        }
        .legal-content p {
          margin: 0 0 16px 0;
          color: var(--text);
        }
        .legal-content ul, .legal-content ol {
          margin: 0 0 16px 0;
          padding-left: 24px;
        }
        .legal-content li {
          margin-bottom: 8px;
          color: var(--text);
        }
        .legal-content strong {
          font-weight: 600;
        }
        .legal-content hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 24px 0;
        }
        .legal-content a {
          color: #2563eb;
        }
        .legal-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }
        .legal-content th, .legal-content td {
          border: 1px solid var(--border);
          padding: 10px 12px;
          text-align: left;
        }
        .legal-content th {
          background: var(--surface-2);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// Simple markdown parser for legal documents
function parseMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Horizontal rule
    .replace(/^---$/gim, "<hr />")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    // Tables (basic support)
    .replace(/^\|(.+)\|$/gim, (_match, content) => {
      const cells = content.split("|").map((c: string) => c.trim());
      const isHeader = cells.every((c: string) => c.match(/^-+$/));
      if (isHeader) return "";
      const tag = "td";
      return `<tr>${cells.map((c: string) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
    });

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[123]>)/g, "$1");
  html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr \/>)<\/p>/g, "$1");

  // Handle tables
  html = html.replace(/<p>(<tr>.*?<\/tr>)<\/p>/gs, "<table>$1</table>");

  return html;
}

// Fallback content if API fails
const FALLBACK_PRIVACY = `# Política de Privacidad

**Última actualización:** Enero 2026

## 1. Introducción

Esta Política de Privacidad describe cómo la plataforma Picks4All recopila, utiliza, almacena y protege su información personal.

## 2. Información que Recopilamos

**Datos de registro:**
- Dirección de correo electrónico
- Nombre de usuario
- Contraseña (almacenada de forma segura)

**Datos de uso:**
- Predicciones realizadas
- Participación en pools

## 3. Cómo Utilizamos su Información

Utilizamos su información para:
- Proveer el servicio
- Mejorar la experiencia de usuario
- Enviar comunicaciones importantes

## 4. Sus Derechos

Usted tiene derecho a:
- Acceder a sus datos
- Rectificar información incorrecta
- Solicitar la eliminación de sus datos

## 5. Contacto

Para preguntas sobre esta política, contáctenos en privacidad@picks4all.com
`;
