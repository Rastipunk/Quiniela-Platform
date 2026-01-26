import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/email.ts", "src/services/deadlineReminderService.ts"],
    },
    // Mock de variables de entorno para tests
    env: {
      RESEND_API_KEY: "test_api_key",
      FRONTEND_URL: "http://localhost:5173",
    },
  },
});
