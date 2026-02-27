// Renderiza JSON-LD como raw HTML para evitar que Next.js lo duplique
// en el RSC payload. Al usar dangerouslySetInnerHTML en un <div>,
// el <script> interno no es un elemento React y no se serializa.

interface JsonLdProps {
  data: Record<string, any>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <div
      hidden
      dangerouslySetInnerHTML={{
        __html: `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
      }}
    />
  );
}
