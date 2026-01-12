// Script para probar envío de email
import "dotenv/config";
import { sendPasswordResetEmail } from "../lib/email";

async function main() {
  const testEmail = process.argv[2] || "test@example.com";
  const testUsername = process.argv[3] || "testuser";
  const testToken = "test-token-123456789";

  console.log("🔍 Probando envío de email...\n");
  console.log(`   Email destino: ${testEmail}`);
  console.log(`   Username: ${testUsername}`);
  console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "✅ Configurada" : "❌ No configurada"}`);
  console.log(`   RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}`);
  console.log("");

  const result = await sendPasswordResetEmail({
    to: testEmail,
    username: testUsername,
    resetToken: testToken,
  });

  console.log("\n📊 Resultado:");
  if (result.success) {
    console.log("   ✅ Email enviado exitosamente");
  } else {
    console.log("   ❌ Error al enviar email");
    console.log(`   Error: ${result.error}`);
  }
}

main()
  .catch((e) => console.error("❌ Error:", e))
  .finally(() => process.exit(0));
