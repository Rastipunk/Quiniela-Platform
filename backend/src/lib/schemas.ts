// Shared Zod field schemas — single source of truth for validation constraints.
// Import and reuse in route-level schemas to prevent drift.

import { z } from "zod";

// ── User fields ──────────────────────────────────────────────
export const usernameField = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/);
export const passwordField = z.string().min(8).max(128);
export const emailField = z.string().email().max(255);
export const displayNameField = z.string().min(1).max(50);

// ── Pool fields ──────────────────────────────────────────────
export const poolNameField = z.string().min(3).max(120);
export const poolDescriptionField = z.string().max(500).optional();

// ── Organization / corporate fields ──────────────────────────
export const companyNameField = z.string().min(2).max(200);
export const welcomeMessageField = z.string().max(1000).optional();
export const invitationMessageField = z.string().max(1000).optional();

// ── Template / instance fields ───────────────────────────────
export const templateNameField = z.string().min(3).max(120);
