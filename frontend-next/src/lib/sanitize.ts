/**
 * Lightweight HTML sanitizer for translated content.
 * Allows only safe inline tags (links, bold, italic, br).
 * Strips all other tags to prevent XSS if translation content
 * is ever sourced from an untrusted origin.
 */

const ALLOWED_TAGS = new Set(["a", "b", "strong", "i", "em", "br", "span", "u", "p"]);

export function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    const tagLower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(tagLower)) {
      // For <a> tags, ensure only href with http/https/mailto
      if (tagLower === "a" && match.startsWith("<a")) {
        const hrefMatch = match.match(/href="(https?:\/\/[^"]*|mailto:[^"]*)"/i);
        if (hrefMatch) {
          return `<a href="${hrefMatch[1]}" rel="noopener noreferrer">`;
        }
        return `<a rel="noopener noreferrer">`;
      }
      return match;
    }
    return ""; // Strip disallowed tags
  });
}
