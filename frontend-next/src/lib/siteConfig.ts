// Centralized site configuration — single source of truth for domain, name, etc.
// All values come from environment variables with sensible defaults.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://picks4all.com";
export const SITE_NAME = "Picks4All";
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "picks4all.com";
