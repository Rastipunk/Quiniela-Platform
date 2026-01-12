// Script temporal para verificar tokens de reset
import "dotenv/config";
import { prisma } from "../db";

async function main() {
  const email = process.argv[2] || "test-username@example.com";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      username: true,
      email: true,
      resetToken: true,
      resetTokenExpiresAt: true,
    },
  });

  if (!user) {
    console.log("❌ Usuario no encontrado");
    return;
  }

  console.log("✅ Usuario encontrado:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Reset Token: ${user.resetToken ? "✅ Generado" : "❌ No generado"}`);
  console.log(`   Token Expira: ${user.resetTokenExpiresAt || "N/A"}`);

  if (user.resetToken) {
    console.log(`\n🔗 URL de reset: http://localhost:5173/reset-password?token=${user.resetToken}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
