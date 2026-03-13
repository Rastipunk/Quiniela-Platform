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
  ADMIN_NOTIFICATION_EMAIL: z.string().optional(),

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

  return result.data;
}
