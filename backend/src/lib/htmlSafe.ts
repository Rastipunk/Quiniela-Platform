/**
 * HTML-escape a string for safe interpolation into HTML markup (email
 * templates, server-rendered fragments, etc).
 *
 * Escapes the five characters that change parser state in HTML:
 *   &  →  &amp;  (must be first to avoid double-escaping the others)
 *   <  →  &lt;
 *   >  →  &gt;
 *   "  →  &quot;
 *   '  →  &#39;
 *
 * Lives in its own module to avoid the circular dependency between
 * lib/email.ts and lib/emailTemplates.ts (email.ts imports the templates
 * to send them; the templates need escaping for host-controlled inputs).
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
