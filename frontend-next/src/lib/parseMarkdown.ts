// Simple markdown parser for legal documents
export function parseMarkdown(md: string): string {
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
    // Links (only allow safe protocols)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, text, url) => {
        if (/^https?:\/\/|^mailto:/i.test(url)) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return text;
      }
    )
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
