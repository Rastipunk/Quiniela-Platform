// Centralized site configuration — runtime values with brand defaults.
// Brand identity comes from lib/brand.ts.

import { BRAND } from "./brand";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${BRAND.domain}`;
export const SITE_NAME = BRAND.name;
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || BRAND.domain;

// Temporary marketing focus flag for the FIFA World Cup 2026 cycle.
// When enabled, ES copy pivots to "polla mundialista" messaging. Disable by
// setting NEXT_PUBLIC_WORLD_CUP_FOCUS=false in Railway after the tournament.
export const WORLD_CUP_FOCUS =
  process.env.NEXT_PUBLIC_WORLD_CUP_FOCUS !== "false";
