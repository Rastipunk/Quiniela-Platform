// Centralized site configuration — runtime values with brand defaults.
// Brand identity comes from lib/brand.ts.

import { BRAND } from "./brand";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${BRAND.domain}`;
export const SITE_NAME = BRAND.name;
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || BRAND.domain;
