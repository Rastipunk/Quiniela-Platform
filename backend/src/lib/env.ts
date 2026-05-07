import { z } from "zod";

/**
 * Validates required environment variables at startup.
 * Fails fast with a clear message if anything is missing.
 */
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  // Optional with defaults
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  FRONTEND_URL: z.string().optional().default("http://localhost:5173"),

  // Email (optional — features degrade gracefully without it)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  // Internal notification routing — one inbox per category. Each is
  // optional and falls back to ADMIN_NOTIFICATION_EMAIL if unset, so
  // an undeployed env var never silently drops a notification.
  ADMIN_NOTIFICATION_EMAIL: z.string().optional(),
  SUPPORT_NOTIFICATION_EMAIL: z.string().optional(),
  ENTERPRISE_NOTIFICATION_EMAIL: z.string().optional(),
  SALES_NOTIFICATION_EMAIL: z.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),

  // API-Football (optional)
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_ENABLED: z.string().optional(),

  // Railway
  RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`\n❌ Environment validation failed:\n${errors}\n`);
    process.exit(1);
  }

  warnMissingAnalyticsVars();
  return result.data;
}

/**
 * Non-fatal warnings for analytics integrations.
 *
 * Missing analytics env vars must NOT crash the server — the product still
 * works without tracking. But silent failures are worse: an operator sees
 * "GA4 has no data" and has no visible signal that the backend was never
 * configured to emit. This prints one loud block at boot so Railway logs
 * make the gap obvious.
 */
function warnMissingAnalyticsVars(): void {
  const checks: Array<{ name: string; present: boolean; effect: string }> = [
    {
      name: "GA4_MEASUREMENT_ID",
      present: Boolean(process.env.GA4_MEASUREMENT_ID),
      effect: "Server-side GA4 Measurement Protocol disabled. Purchase/refund webhooks will NOT reach GA4.",
    },
    {
      name: "GA4_API_SECRET",
      present: Boolean(process.env.GA4_API_SECRET),
      effect: "Server-side GA4 Measurement Protocol disabled.",
    },
    {
      name: "META_PIXEL_ID",
      present: Boolean(process.env.META_PIXEL_ID),
      effect: "Server-side Meta CAPI disabled. Meta will see browser Pixel events only (no iOS / ad-block recovery).",
    },
    {
      name: "META_CAPI_ACCESS_TOKEN",
      present: Boolean(process.env.META_CAPI_ACCESS_TOKEN),
      effect: "Server-side Meta CAPI disabled.",
    },
    {
      name: "META_TEST_EVENT_CODE",
      present: Boolean(process.env.META_TEST_EVENT_CODE),
      effect: "Meta Events Manager > Test Events tab cannot be used for verification.",
    },
  ];

  const missing = checks.filter((c) => !c.present);
  if (missing.length === 0) return;

  console.warn("\n⚠️  Analytics env vars missing:");
  for (const c of missing) {
    console.warn(`   - ${c.name}: ${c.effect}`);
  }
  console.warn(
    "   NOTE: NEXT_PUBLIC_GTM_ID / NEXT_PUBLIC_META_PIXEL_ID must be set on the FRONTEND service at BUILD time, not here.\n",
  );
}
